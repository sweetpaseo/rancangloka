/**
 * RancangLoka Publication Inventory Endpoint
 * GET /api/internal/v1/publication-inventory
 *
 * Phase 3B-5B Implementation
 *
 * Purpose:
 * Machine-to-Machine Authenticated Read-Only Publication Inventory
 * Used downstream by Hermes for anti-duplicate / anti-cannibalization checks
 * before topics enter the Topic Queue.
 *
 * Enforces:
 * - GET only (Other methods return 405 with Allow: GET)
 * - Strict query parameter validation (limit, after_id, status)
 * - Rejection of unknown query parameters (400)
 * - Dedicated Read-Only HMAC-SHA256 authentication (separated from ingest secret)
 * - Fail-closed production key resolution with previous-key rotation support
 * - Strict timestamp replay tolerance window (±300s)
 * - Safe identifier validation (req_[A-Za-z0-9_-]{16,80})
 * - SELECT-only D1 queries using parameterized .bind() (Zero mutation)
 * - Ascending id cursor-based pagination (ORDER BY a.id ASC LIMIT limit + 1)
 * - Strict separation of publication state (articles.status is authoritative)
 * - Compact metadata response (No content_md, content_html, or secrets)
 */

import type { APIRoute } from 'astro';
import {
  extractAndValidateInventoryHeaders,
  getInventoryReadSecret,
  verifyInventoryHmac,
  buildInventoryCanonicalQuery,
  buildInventoryCanonicalString
} from '../../../../lib/inventory-auth.ts';
import { getDb, getRuntimeEnv, getSiteSettings } from '../../../../lib/db.ts';

const ALLOWED_QUERY_PARAMS = new Set(['limit', 'after_id', 'status']);
const ALLOWED_STATUSES = new Set(['all', 'draft', 'published']);
const DEFAULT_LIMIT = 50;
const MIN_LIMIT = 1;
const MAX_LIMIT = 100;
const DEFAULT_STATUS = 'all';

/**
 * Standard JSON error response builder.
 */
function errorResponse(
  status: number,
  code: string,
  message: string,
  headers?: Record<string, string>
): Response {
  return new Response(
    JSON.stringify({
      status: 'error',
      code,
      message
    }),
    {
      status,
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'no-store, private',
        'X-Robots-Tag': 'noindex, nofollow, noarchive, nosnippet',
        ...(headers || {})
      }
    }
  );
}

/**
 * Safe server-side structured logging helper.
 * Never logs secrets, signatures, or sensitive query data.
 */
function safeLog(event: string, meta: Record<string, any>) {
  const cleanMeta: Record<string, any> = {
    timestamp: new Date().toISOString(),
    event,
    ...meta
  };
  delete cleanMeta.secret;
  delete cleanMeta.signature;
  delete cleanMeta.sigHeader;
  console.log(`[Inventory-API] ${JSON.stringify(cleanMeta)}`);
}

export const GET: APIRoute = async ({ request, url, locals }) => {
  const startTime = Date.now();

  // 1. Method verification
  if (request.method.toUpperCase() !== 'GET') {
    return errorResponse(405, 'METHOD_NOT_ALLOWED', 'Hanya metode HTTP GET yang diizinkan.', {
      Allow: 'GET'
    });
  }

  // 2. Validate Query Parameters - Reject unknown parameters
  for (const key of url.searchParams.keys()) {
    if (!ALLOWED_QUERY_PARAMS.has(key)) {
      return errorResponse(
        400,
        'INVALID_PARAMETER',
        `Parameter query tidak diizinkan: "${key}". Hanya [limit, after_id, status] yang didukung.`
      );
    }
  }

  // 2a. Validate 'limit'
  let limit = DEFAULT_LIMIT;
  const limitParam = url.searchParams.get('limit');
  if (limitParam !== null) {
    if (!/^\d+$/.test(limitParam.trim())) {
      return errorResponse(
        400,
        'INVALID_LIMIT',
        'Parameter "limit" harus berupa bilangan bulat positif antara 1 dan 100.'
      );
    }
    const parsedLimit = parseInt(limitParam.trim(), 10);
    if (parsedLimit < MIN_LIMIT || parsedLimit > MAX_LIMIT) {
      return errorResponse(
        400,
        'INVALID_LIMIT',
        `Parameter "limit" (${parsedLimit}) berada di luar rentang yang diizinkan (${MIN_LIMIT}-${MAX_LIMIT}).`
      );
    }
    limit = parsedLimit;
  }

  // 2b. Validate 'after_id'
  let afterId: number | null = null;
  const afterIdParam = url.searchParams.get('after_id');
  if (afterIdParam !== null) {
    if (!/^\d+$/.test(afterIdParam.trim())) {
      return errorResponse(
        400,
        'INVALID_AFTER_ID',
        'Parameter "after_id" harus berupa bilangan bulat non-negatif.'
      );
    }
    afterId = parseInt(afterIdParam.trim(), 10);
  }

  // 2c. Validate 'status'
  let statusFilter = DEFAULT_STATUS;
  const statusParam = url.searchParams.get('status');
  if (statusParam !== null) {
    const cleanStatus = statusParam.trim().toLowerCase();
    if (!ALLOWED_STATUSES.has(cleanStatus)) {
      return errorResponse(
        400,
        'INVALID_STATUS',
        `Nilai status "${statusParam}" tidak valid. Hanya ['all', 'draft', 'published'] yang didukung.`
      );
    }
    statusFilter = cleanStatus;
  }

  // 3. Extract and validate X-RL-* transport headers
  const headerValidation = extractAndValidateInventoryHeaders(request.headers);
  if (!headerValidation.valid || !headerValidation.data) {
    safeLog('AUTH_HEADER_REJECTED', {
      code: headerValidation.code,
      message: headerValidation.message
    });
    return errorResponse(
      401,
      headerValidation.code || 'SIGNATURE_INVALID',
      headerValidation.message || 'Header transport autentikasi tidak valid.'
    );
  }

  const { signatureVersion, timestamp, requestId, keyId, signature } = headerValidation.data;

  // 4. Resolve Dedicated Read-Only Secret with Fail-Closed semantics
  const env = await getRuntimeEnv(locals);
  const secretResolution = getInventoryReadSecret(keyId, env);

  if (!secretResolution.configured) {
    safeLog('INVENTORY_AUTH_NOT_CONFIGURED', { requestId, keyId });
    return errorResponse(
      503,
      'INVENTORY_NOT_CONFIGURED',
      'Kunci rahasia internal Publication Inventory belum dikonfigurasi pada server runtime.'
    );
  }

  if (!secretResolution.isKnownKey || !secretResolution.secret) {
    safeLog('KEY_NOT_ACCEPTED', { requestId, keyId });
    return errorResponse(401, 'KEY_NOT_ACCEPTED', `Key ID "${keyId}" tidak dikenali atau tidak diizinkan.`);
  }

  const readSecret = secretResolution.secret;

  // 5. Construct Canonical Query String and Canonical HMAC String
  const canonicalQuery = buildInventoryCanonicalQuery(url.searchParams);
  const canonicalString = buildInventoryCanonicalString(timestamp, requestId, canonicalQuery);

  // 6. Verify HMAC-SHA256 signature
  const isSignatureValid = await verifyInventoryHmac(canonicalString, signature, readSecret);
  if (!isSignatureValid) {
    safeLog('HMAC_SIGNATURE_MISMATCH', { requestId, keyId });
    return errorResponse(401, 'SIGNATURE_INVALID', 'Verifikasi signature HMAC-SHA256 gagal.');
  }

  // 7. Connect to Database (Require D1 connection)
  const db = await getDb(locals);
  if (!db) {
    safeLog('DATABASE_UNAVAILABLE', { requestId });
    return errorResponse(
      500,
      'DATABASE_UNAVAILABLE',
      'Database D1 tidak tersedia untuk membaca inventaris publikasi.'
    );
  }

  try {
    // 8. Resolve Site URL for Canonical URLs
    const siteSettings = await getSiteSettings(db);
    const siteUrl = (siteSettings.site_url || 'https://rancangloka.com').replace(/\/+$/, '');

    // 9. Construct Read-Only Query with strict parameterized binding
    const conditions: string[] = [];
    const bindings: any[] = [];

    if (afterId !== null) {
      conditions.push('a.id > ?');
      bindings.push(afterId);
    }

    if (statusFilter !== 'all') {
      conditions.push('a.status = ?');
      bindings.push(statusFilter);
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    // Fetch limit + 1 to check has_more deterministically without OFFSET
    const querySql = `
      SELECT
        a.id,
        a.slug,
        a.title,
        a.description,
        c.name AS category,
        au.name AS author,
        a.focus_keyword,
        a.status,
        a.content_hash,
        a.published_at,
        a.updated_at
      FROM articles a
      LEFT JOIN categories c ON c.id = a.category_id
      LEFT JOIN authors au ON au.id = a.author_id
      ${whereClause}
      ORDER BY a.id ASC
      LIMIT ?
    `;
    bindings.push(limit + 1);

    const { results } = await db.prepare(querySql).bind(...bindings).all();
    const rows = (results || []) as Array<{
      id: number;
      slug: string;
      title: string;
      description: string | null;
      category: string | null;
      author: string | null;
      focus_keyword: string | null;
      status: string;
      content_hash: string | null;
      published_at: string | null;
      updated_at: string | null;
    }>;

    const hasMore = rows.length > limit;
    const returnedRows = hasMore ? rows.slice(0, limit) : rows;
    const nextAfterId =
      hasMore && returnedRows.length > 0 ? returnedRows[returnedRows.length - 1].id : null;

    const articles = returnedRows.map((r) => ({
      id: r.id,
      slug: r.slug,
      title: r.title,
      description: r.description || '',
      category: r.category || '',
      author: r.author || '',
      focus_keyword: r.focus_keyword || '',
      status: r.status || 'draft',
      content_hash: r.content_hash || null,
      published_at: r.published_at || '',
      updated_at: r.updated_at || '',
      canonical_url: `${siteUrl}/${r.slug}`
    }));

    safeLog('INVENTORY_FETCHED', {
      requestId,
      count: articles.length,
      hasMore,
      durationMs: Date.now() - startTime
    });

    return new Response(
      JSON.stringify({
        schema_version: 1,
        generated_at: new Date().toISOString(),
        query: {
          status: statusFilter,
          limit,
          after_id: afterId
        },
        articles,
        page: {
          count: articles.length,
          has_more: hasMore,
          next_after_id: nextAfterId
        }
      }),
      {
        status: 200,
        headers: {
          'Content-Type': 'application/json',
          'Cache-Control': 'no-store, private',
          'X-Robots-Tag': 'noindex, nofollow, noarchive, nosnippet'
        }
      }
    );
  } catch (err: any) {
    safeLog('DATABASE_READ_FAILED', {
      requestId,
      error: err?.message
    });
    return errorResponse(500, 'DATABASE_READ_FAILED', 'Gagal membaca data inventaris publikasi.');
  }
};

/**
 * Handle all non-GET methods with 405 Method Not Allowed.
 */
export const ALL: APIRoute = async ({ request }) => {
  if (request.method.toUpperCase() === 'GET') {
    return new Response(null, { status: 404 });
  }
  return errorResponse(405, 'METHOD_NOT_ALLOWED', 'Hanya metode HTTP GET yang diizinkan.', {
    Allow: 'GET'
  });
};
