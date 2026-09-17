/**
 * RancangLoka Hermes Machine-to-Machine Ingestion Endpoint
 * POST /api/internal/v1/hermes-ingest
 *
 * Phase 2A Implementation
 *
 * Enforces:
 * - POST only (Other methods return 405 with Allow: POST)
 * - No query parameters permitted (returns 400 QUERY_NOT_ALLOWED)
 * - Strict Content-Type: application/json
 * - Payload size limit <= 512 KiB
 * - X-RL-* transport header verification & timestamp replay window (±300s)
 * - Constant-time HMAC-SHA256 signature verification over exact raw request body
 * - Fail-closed production key resolution
 * - Strict Hermes transport JSON contract (source, contract_version, article_id, markdown)
 * - Strict Hermes article policy (frontmatter allowlist, 6 official categories only, "RancangLoka Editorial Desk" only)
 * - Canonical Phase 1B pipeline normalization, validation, and safe HTML rendering
 * - Forced DRAFT status
 * - Idempotency gate (JOB_ID replay, ARTICLE_ID replay, conflict rejection)
 * - Atomic D1 batch persistence of article + receipt
 * - Structured success and error responses (zero stack or secret leakage)
 */

import type { APIRoute } from 'astro';
import {
  HERMES_SOURCE,
  HERMES_CONTRACT_VERSION,
  HERMES_MAX_BODY_BYTES,
  computeSha256Hex,
  buildHermesCanonicalString,
  getHermesIngestSecret,
  verifyHermesHmac,
  extractAndValidateHermesHeaders,
  validateHermesTransportPayload,
  validateHermesArticlePolicy
} from '../../../../lib/hermes.ts';
import { parseArticleMarkdown } from '../../../../lib/article/parser.ts';
import { normalizeArticle } from '../../../../lib/article/pipeline.ts';
import {
  getDb,
  checkDuplicateArticle,
  getReceiptByJobId,
  getReceiptBySourceArticleId,
  getReceiptByContentHashes,
  insertHermesArticleAndReceipt,
  getArticleById,
  getRuntimeEnv
} from '../../../../lib/db.ts';

/**
 * Standard JSON error response builder.
 */
function errorResponse(
  status: number,
  code: string,
  message: string,
  details?: any,
  headers?: Record<string, string>
): Response {
  const body: Record<string, any> = {
    status: 'error',
    code,
    message
  };
  if (details !== undefined) {
    body.details = details;
  }
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      'Content-Type': 'application/json',
      'Cache-Control': 'no-store, private',
      'X-Robots-Tag': 'noindex, nofollow, noarchive, nosnippet',
      ...(headers || {})
    }
  });
}

/**
 * Standard JSON success response builder.
 */
function successResponse(
  status: number,
  data: Record<string, any>
): Response {
  return new Response(JSON.stringify({ status: 'success', ...data }), {
    status,
    headers: {
      'Content-Type': 'application/json',
      'Cache-Control': 'no-store, private',
      'X-Robots-Tag': 'noindex, nofollow, noarchive, nosnippet'
    }
  });
}

/**
 * Safe server-side structured logging helper.
 * Never logs secrets, signatures, raw bodies, or full Markdown.
 */
function safeLog(event: string, meta: Record<string, any>) {
  const cleanMeta: Record<string, any> = {
    timestamp: new Date().toISOString(),
    event,
    ...meta
  };
  // Sanitize fields
  delete cleanMeta.secret;
  delete cleanMeta.signature;
  delete cleanMeta.markdown;
  delete cleanMeta.body;
  delete cleanMeta.rawBody;
  console.log(`[Hermes-Ingest] ${JSON.stringify(cleanMeta)}`);
}

export const POST: APIRoute = async ({ request, url, locals }) => {
  const startTime = Date.now();

  // 1. Method verification (APIRoute POST only executes on POST, but enforce method strictly)
  if (request.method.toUpperCase() !== 'POST') {
    return errorResponse(405, 'METHOD_NOT_ALLOWED', 'Hanya metode HTTP POST yang diizinkan.', undefined, {
      'Allow': 'POST'
    });
  }

  // 2. Reject Query Parameters strictly (avoid ambiguous signature canonicalization)
  if (url.search && url.search.length > 0) {
    return errorResponse(400, 'QUERY_NOT_ALLOWED', 'Endpoint internal hermes-ingest tidak menerima query parameters.');
  }

  // 3. Content-Type Header Verification
  const contentType = request.headers.get('content-type') || '';
  const isJsonType = contentType.split(';')[0].trim().toLowerCase() === 'application/json';
  if (!isJsonType) {
    return errorResponse(415, 'UNSUPPORTED_MEDIA_TYPE', 'Header Content-Type harus berupa application/json.');
  }

  // 4. Content-Length early rejection if available
  const contentLengthStr = request.headers.get('content-length');
  if (contentLengthStr) {
    const contentLength = parseInt(contentLengthStr, 10);
    if (!isNaN(contentLength) && contentLength > HERMES_MAX_BODY_BYTES) {
      return errorResponse(413, 'PAYLOAD_TOO_LARGE', `Ukuran payload melebihi batas maksimum (${HERMES_MAX_BODY_BYTES / 1024} KiB).`);
    }
  }

  // 5. Extract and validate X-RL-* transport headers
  const headerValidation = extractAndValidateHermesHeaders(request.headers);
  if (!headerValidation.valid || !headerValidation.data) {
    safeLog('AUTH_HEADER_REJECTED', {
      code: headerValidation.code,
      message: headerValidation.message
    });
    return errorResponse(401, headerValidation.code || 'SIGNATURE_INVALID', headerValidation.message || 'Header transport tidak valid.');
  }

  const { signatureVersion, timestamp, jobId, requestId, keyId, signature } = headerValidation.data;

  // 6. Resolve Ingestion Secret with Fail-Closed semantics
  const env = await getRuntimeEnv(locals);
  const secretResolution = getHermesIngestSecret(keyId, env);

  if (!secretResolution.configured) {
    safeLog('INGEST_NOT_CONFIGURED', { requestId, jobId, keyId });
    return errorResponse(503, 'INGEST_NOT_CONFIGURED', 'Kunci rahasia internal Hermes belum dikonfigurasi pada server runtime.');
  }

  if (!secretResolution.isKnownKey || !secretResolution.secret) {
    safeLog('KEY_NOT_ACCEPTED', { requestId, jobId, keyId });
    return errorResponse(401, 'KEY_NOT_ACCEPTED', `Key ID "${keyId}" tidak dikenali atau tidak diizinkan.`);
  }

  const ingestSecret = secretResolution.secret;

  // 7. Read exact raw request body bytes and enforce hard byte limit
  let rawBodyBytes: Uint8Array;
  try {
    const arrayBuffer = await request.arrayBuffer();
    rawBodyBytes = new Uint8Array(arrayBuffer);
  } catch (err: any) {
    return errorResponse(400, 'BODY_READ_FAILED', 'Gagal membaca stream raw body permintaan.');
  }

  if (rawBodyBytes.byteLength > HERMES_MAX_BODY_BYTES) {
    return errorResponse(413, 'PAYLOAD_TOO_LARGE', `Ukuran raw bytes payload (${rawBodyBytes.byteLength} B) melebihi batas ${HERMES_MAX_BODY_BYTES} B.`);
  }

  // 8. Compute RAW_BODY_SHA256 and verify HMAC-SHA256 signature
  const rawBodySha256Hex = await computeSha256Hex(rawBodyBytes);
  const canonicalString = buildHermesCanonicalString(timestamp, jobId, requestId, rawBodySha256Hex);

  const isSignatureValid = await verifyHermesHmac(canonicalString, signature, ingestSecret);
  if (!isSignatureValid) {
    safeLog('HMAC_SIGNATURE_MISMATCH', {
      requestId,
      jobId,
      keyId,
      rawBodySha256Hex
    });
    return errorResponse(401, 'SIGNATURE_INVALID', 'Verifikasi signature HMAC-SHA256 gagal.');
  }

  // 9. Parse and validate transport JSON payload structure
  let parsedJson: any;
  try {
    const textBody = new TextDecoder('utf-8', { fatal: true }).decode(rawBodyBytes);
    parsedJson = JSON.parse(textBody);
  } catch (err: any) {
    return errorResponse(400, 'MALFORMED_JSON', 'Body JSON tidak valid atau bukan UTF-8.');
  }

  const payloadValidation = validateHermesTransportPayload(parsedJson);
  if (!payloadValidation.valid || !payloadValidation.data) {
    return errorResponse(400, payloadValidation.code || 'TRANSPORT_INVALID', payloadValidation.data ? '' : (payloadValidation.message || 'Payload transport tidak valid.'));
  }

  const { source, contract_version, article_id: sourceArticleId, markdown } = payloadValidation.data;

  // 10. Compute CONTENT_SHA256 (exact full Markdown fingerprint)
  const contentSha256 = await computeSha256Hex(markdown);

  // 11. Connect to Database (Require real D1, no in-memory fallback for machine ingest)
  const db = await getDb(locals);
  if (!db) {
    safeLog('DB_UNAVAILABLE', { requestId, jobId, sourceArticleId });
    return errorResponse(500, 'INGEST_PERSISTENCE_FAILED', 'Database D1 tidak tersedia untuk machine ingestion.');
  }

  try {
    // 12. IDEMPOTENCY GATE: Check existing receipts before processing
    // Case A: Exact same job_id already recorded
    const existingByJob = await getReceiptByJobId(db, jobId);
  if (existingByJob) {
    if (
      existingByJob.source_article_id === sourceArticleId &&
      existingByJob.content_sha256 === contentSha256 &&
      existingByJob.contract_version === contract_version
    ) {
      // Idempotent replay of same job
      const existingArticle = await getArticleById(db, existingByJob.article_id);
      safeLog('IDEMPOTENT_REPLAY', {
        requestId,
        jobId,
        sourceArticleId,
        d1ArticleId: existingByJob.article_id,
        durationMs: Date.now() - startTime
      });
      return successResponse(200, {
        code: 'IDEMPOTENT_REPLAY',
        request_id: requestId,
        job_id: jobId,
        source_article_id: sourceArticleId,
        d1_article_id: existingByJob.article_id,
        slug: existingArticle?.slug || '',
        article_status: existingArticle?.status || 'draft',
        content_sha256: contentSha256,
        article_content_hash: existingByJob.article_content_hash,
        write_performed: false
      });
    } else {
      // Same JOB_ID with different content or article_id is a hard conflict
      safeLog('JOB_ID_CONFLICT', { requestId, jobId, sourceArticleId });
      return errorResponse(409, 'JOB_ID_CONFLICT', 'ID pekerjaan (job_id) sudah digunakan untuk konten atau identitas artikel berbeda.');
    }
  }

  // Case B: Same source_article_id already recorded under a different job
  const existingByArticleId = await getReceiptBySourceArticleId(db, source, sourceArticleId);
  if (existingByArticleId) {
    if (existingByArticleId.content_sha256 === contentSha256) {
      // Idempotent recovery across new job retry
      const existingArticle = await getArticleById(db, existingByArticleId.article_id);
      safeLog('ARTICLE_IDEMPOTENT_REPLAY', {
        requestId,
        jobId,
        sourceArticleId,
        d1ArticleId: existingByArticleId.article_id,
        durationMs: Date.now() - startTime
      });
      return successResponse(200, {
        code: 'ARTICLE_IDEMPOTENT_REPLAY',
        request_id: requestId,
        job_id: jobId,
        source_article_id: sourceArticleId,
        d1_article_id: existingByArticleId.article_id,
        slug: existingArticle?.slug || '',
        article_status: existingArticle?.status || 'draft',
        content_sha256: contentSha256,
        article_content_hash: existingByArticleId.article_content_hash,
        write_performed: false
      });
    } else {
      // Same article ID but different content: revisions not supported in Phase 2A
      safeLog('ARTICLE_ID_CONFLICT', { requestId, jobId, sourceArticleId });
      return errorResponse(409, 'ARTICLE_ID_CONFLICT', 'Artikel dengan source_article_id ini sudah ada namun konten berbeda. Pembaruan artikel tidak diizinkan.');
    }
  }

  // 13. Parse Frontmatter & Enforce Strict Hermes Policy
  const parsedMd = parseArticleMarkdown(markdown);
  if (!parsedMd.success) {
    return errorResponse(422, 'ARTICLE_VALIDATION_FAILED', `Gagal mem-parsing Markdown: ${parsedMd.error}`);
  }

  const policyValidation = validateHermesArticlePolicy(parsedMd.frontmatter);
  if (!policyValidation.valid) {
    safeLog('HERMES_POLICY_REJECTED', {
      requestId,
      jobId,
      sourceArticleId,
      code: policyValidation.code,
      message: policyValidation.message
    });
    return errorResponse(422, policyValidation.code || 'ARTICLE_VALIDATION_FAILED', policyValidation.message || 'Validasi kebijakan Hermes gagal.');
  }

  // 14. Canonical Phase 1B Normalization & Contract Validation
  let normalized;
  try {
    normalized = await normalizeArticle(markdown, db);
  } catch (err: any) {
    const errCode = err?.code || 'ARTICLE_VALIDATION_FAILED';
    const errMsg = err?.message || 'Validasi kanonikal artikel gagal.';
    return errorResponse(422, errCode, errMsg, err?.errors);
  }

  const articleContentHash = normalized.content_hash;

  // 15. Check for duplicate content among Hermes receipts
  const existingByHash = await getReceiptByContentHashes(db, contentSha256, articleContentHash);
  if (existingByHash) {
    if (existingByHash.job_id === jobId && existingByHash.source_article_id === sourceArticleId) {
      // Concurrent race condition: identical job already committed by winning concurrent thread
      const existingArticle = await getArticleById(db, existingByHash.article_id);
      safeLog('IDEMPOTENT_REPLAY', {
        requestId,
        jobId,
        sourceArticleId,
        d1ArticleId: existingByHash.article_id,
        durationMs: Date.now() - startTime
      });
      return successResponse(200, {
        code: 'IDEMPOTENT_REPLAY',
        request_id: requestId,
        job_id: jobId,
        source_article_id: sourceArticleId,
        d1_article_id: existingByHash.article_id,
        slug: existingArticle?.slug || '',
        article_status: existingArticle?.status || 'draft',
        content_sha256: contentSha256,
        article_content_hash: existingByHash.article_content_hash,
        write_performed: false
      });
    }

    if (existingByHash.source === source && existingByHash.source_article_id === sourceArticleId && existingByHash.content_sha256 === contentSha256) {
      // Concurrent race condition: identical article concept and content already committed
      const existingArticle = await getArticleById(db, existingByHash.article_id);
      safeLog('ARTICLE_IDEMPOTENT_REPLAY', {
        requestId,
        jobId,
        sourceArticleId,
        d1ArticleId: existingByHash.article_id,
        durationMs: Date.now() - startTime
      });
      return successResponse(200, {
        code: 'ARTICLE_IDEMPOTENT_REPLAY',
        request_id: requestId,
        job_id: jobId,
        source_article_id: sourceArticleId,
        d1_article_id: existingByHash.article_id,
        slug: existingArticle?.slug || '',
        article_status: existingArticle?.status || 'draft',
        content_sha256: contentSha256,
        article_content_hash: existingByHash.article_content_hash,
        write_performed: false
      });
    }

    safeLog('DUPLICATE_CONTENT_REJECTED', {
      requestId,
      jobId,
      sourceArticleId,
      existingJobId: existingByHash.job_id
    });
    return errorResponse(409, 'DUPLICATE_CONTENT', 'Konten artikel persis sama dengan artikel lain yang sudah tersimpan.');
  }

  // 16. Collision Gate with Manual / Admin Articles
  // If slug or content_hash already exists in articles table without a matching receipt, do NOT adopt it
  const dupCheck = await checkDuplicateArticle(db, normalized.slug, articleContentHash);
  if (dupCheck.isDuplicate) {
    safeLog('EXISTING_ARTICLE_CONFLICT', {
      requestId,
      jobId,
      sourceArticleId,
      conflictSlug: normalized.slug,
      reason: dupCheck.reason
    });
    return errorResponse(409, 'EXISTING_ARTICLE_CONFLICT', `Konflik dengan artikel yang sudah ada: ${dupCheck.reason}. Mesin dilarang menimpa artikel manual.`);
  }

  // 17. Atomic Insertion of Article and Receipt
  const articlePayload = {
    title: normalized.title,
    slug: normalized.slug,
    description: normalized.description,
    content_md: normalized.content_md,
    content_html: normalized.content_html,
    featured_image: normalized.featured_image || '',
    image_alt: normalized.image_alt || normalized.title,
    category_id: normalized.category_id,
    author_id: normalized.author_id,
    status: 'draft' as const, // Strictly FORCED DRAFT
    views: 0,
    reading_time_minutes: normalized.reading_time_minutes,
    key_takeaways: normalized.key_takeaways,
    focus_keyword: normalized.focus_keyword,
    content_hash: articleContentHash,
    is_featured: 0,
    is_trending: 0,
    is_sponsored: 0,
    disable_internal_links: 0,
    created_at: new Date().toISOString(),
    published_at: null,
    updated_at: new Date().toISOString()
  };

  const receiptPayload = {
    job_id: jobId,
    source,
    source_article_id: sourceArticleId,
    content_sha256: contentSha256,
    article_content_hash: articleContentHash,
    contract_version
  };

  let persisted;
  try {
    persisted = await insertHermesArticleAndReceipt(db, articlePayload, receiptPayload);
  } catch (err: any) {
    safeLog('ATOMIC_INSERT_FAILED', {
      requestId,
      jobId,
      sourceArticleId,
      error: err?.message
    });
    const msg = err?.message || 'Gagal menyimpan artikel dan receipt ke D1.';
    if (msg.includes('JOB_ID_CONFLICT') || msg.includes('DUPLICATE_CONTENT')) {
      const raceReceipt = await getReceiptByJobId(db, jobId);
      if (raceReceipt && raceReceipt.source_article_id === sourceArticleId && raceReceipt.content_sha256 === contentSha256) {
        const raceArticle = await getArticleById(db, raceReceipt.article_id);
        safeLog('IDEMPOTENT_REPLAY', {
          requestId,
          jobId,
          sourceArticleId,
          d1ArticleId: raceReceipt.article_id,
          durationMs: Date.now() - startTime
        });
        return successResponse(200, {
          code: 'IDEMPOTENT_REPLAY',
          request_id: requestId,
          job_id: jobId,
          source_article_id: sourceArticleId,
          d1_article_id: raceReceipt.article_id,
          slug: raceArticle?.slug || '',
          article_status: raceArticle?.status || 'draft',
          content_sha256: contentSha256,
          article_content_hash: raceReceipt.article_content_hash,
          write_performed: false
        });
      }
      if (msg.includes('JOB_ID_CONFLICT')) {
        return errorResponse(409, 'JOB_ID_CONFLICT', 'ID pekerjaan (job_id) mengalami konflik.');
      }
      return errorResponse(409, 'DUPLICATE_CONTENT', 'Konten hash artikel sudah terdaftar.');
    }
    if (msg.includes('DuplicateSlugError') || msg.includes('sudah terdaftar di database D1')) {
      return errorResponse(409, 'EXISTING_ARTICLE_CONFLICT', 'Slug artikel mengalami bentrokan.');
    }
    return errorResponse(500, 'DATABASE_WRITE_FAILED', 'Gagal melakukan persistensi transaksi atomik artikel dan receipt ke database D1.');
  }

  safeLog('INGEST_CREATED', {
    requestId,
    jobId,
    sourceArticleId,
    d1ArticleId: persisted.article.id,
    slug: persisted.article.slug,
    durationMs: Date.now() - startTime
  });

  // 18. Structured Success Response
  return successResponse(201, {
    code: 'INGEST_CREATED',
    request_id: requestId,
    job_id: jobId,
    source_article_id: sourceArticleId,
    d1_article_id: persisted.article.id,
    slug: persisted.article.slug,
    article_status: 'draft',
    content_sha256: contentSha256,
    article_content_hash: articleContentHash,
    write_performed: true
  });
  } catch (err: any) {
    safeLog('UNHANDLED_INGEST_ERROR', {
      requestId,
      jobId,
      sourceArticleId,
      error: err?.message
    });
    return errorResponse(500, 'DATABASE_WRITE_FAILED', 'Gagal memproses ingest atau mengakses database D1.');
  }
};

/**
 * Handle all non-POST methods with 405 Method Not Allowed.
 */
export const ALL: APIRoute = async ({ request }) => {
  if (request.method.toUpperCase() === 'POST') {
    return new Response(null, { status: 404 });
  }
  return errorResponse(405, 'METHOD_NOT_ALLOWED', 'Hanya metode HTTP POST yang diizinkan.', undefined, {
    'Allow': 'POST'
  });
};
