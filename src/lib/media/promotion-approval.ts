/**
 * RancangLoka — LokaMedia Server-Side Promotion Approval Dual-Control (MEDIA-PROMOTION-APPROVAL)
 *
 * Implements server-side authority separation for manual published media promotion:
 * 1. Authority Separation:
 *    - Media Device Authority: Can only create promotion requests (status: 'REQUESTED').
 *      CANNOT mint approved receipts or execute promotions on its own.
 *    - Human Admin Authority: Authenticated admin operator reviews candidate fingerprints
 *      and issues cryptographic approval (status: 'APPROVED').
 * 2. Cryptographic Binding:
 *    Anchored to device_id, article_id, slug, content_hash, candidate_sha256, slot_key, and admin approval.
 * 3. Durable State Machine:
 *    REQUESTED -> APPROVED -> CONSUMED
 *    (or EXPIRED, REJECTED)
 * 4. Content Drift & Replay Defense:
 *    Any drift in article content_hash, candidate SHA-256, or article slug fails closed.
 *    Consumed approvals cannot authorize another article or candidate.
 * 5. Idempotent Retry:
 *    Retries for the exact same candidate SHA and target return safely.
 */

export interface PromotionApprovalRecord {
  approval_id: string; // also known as request_id
  device_id: string;
  article_id: number;
  article_slug: string;
  content_hash: string;
  candidate_sha256: string;
  slot_key: string;
  alt_text?: string | null;
  candidate_width?: number | null;
  candidate_height?: number | null;
  candidate_mime?: string | null;
  candidate_byte_size?: number | null;
  status: 'REQUESTED' | 'APPROVED' | 'CONSUMED' | 'EXPIRED' | 'REJECTED' | 'ISSUED' | 'REVOKED';
  signature?: string | null;
  requested_at: string;
  approved_at?: string | null;
  approved_by?: string | null;
  rejection_reason?: string | null;
  issued_at: string;
  expires_at: string;
  consumed_at?: string | null;
  consumed_by_upload_id?: string | null;
}

export interface PromotionApprovalReceipt {
  approval_id: string;
  request_id?: string;
  device_id: string;
  article_id: number;
  article_slug: string;
  content_hash: string;
  expected_content_hash?: string;
  candidate_sha256: string;
  slot_key: string;
  alt_text?: string | null;
  status: string;
  approved_at?: string;
  issued_at: string;
  expires_at: string;
  signature: string;
}

export interface RequestPromotionApprovalParams {
  deviceId: string;
  articleSlug: string;
  expectedContentHash?: string;
  candidateSha256: string;
  slotKey?: string;
  altText?: string;
  candidateWidth?: number;
  candidateHeight?: number;
  candidateMime?: string;
  candidateByteSize?: number;
  ttlSeconds?: number;
}

export interface RequestPromotionApprovalResult {
  success: boolean;
  promotionRequest?: {
    request_id: string;
    approval_id: string;
    status: 'REQUESTED';
    device_id: string;
    article_id: number;
    article_slug: string;
    article_title: string;
    content_hash: string;
    candidate_sha256: string;
    slot_key: string;
    alt_text?: string;
    candidate_width?: number;
    candidate_height?: number;
    candidate_mime?: string;
    candidate_byte_size?: number;
    requested_at: string;
    expires_at: string;
  };
  error?: string;
  code?: string;
  statusCode?: number;
}

export interface AdminApprovePromotionParams {
  requestId: string;
  adminActor: string;
  env?: any;
}

export interface AdminApprovePromotionResult {
  success: boolean;
  approvalReceipt?: PromotionApprovalReceipt;
  error?: string;
  code?: string;
  statusCode?: number;
}

export interface VerifyPromotionApprovalResult {
  valid: boolean;
  approval?: PromotionApprovalRecord;
  isReplayIdempotent?: boolean;
  error?: string;
  code?: string;
  statusCode?: number;
}

export function getApprovalSigningSecret(env?: any): string {
  return (
    env?.MEDIA_APPROVAL_SECRET ||
    env?.RANCANGLOKA_ADMIN_SESSION_SECRET ||
    env?.ADMIN_SESSION_SECRET ||
    env?.JWT_SECRET ||
    'rancangloka_canonical_media_promotion_secret_2026'
  );
}

export function buildCanonicalApprovalString(
  approvalId: string,
  deviceId: string,
  articleId: number,
  articleSlug: string,
  contentHash: string,
  candidateSha256: string,
  slotKey: string,
  approvedAt: string,
  expiresAt: string,
  altText?: string
): string {
  const parts = [
    approvalId,
    deviceId,
    String(articleId),
    articleSlug,
    contentHash,
    candidateSha256.toLowerCase(),
    slotKey,
    approvedAt,
    expiresAt
  ];
  if (altText !== undefined && altText !== null) {
    parts.push(altText.trim());
  }
  return parts.join(':');
}

export async function signApprovalCanonicalString(canonical: string, secret: string): Promise<string> {
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey(
    'raw',
    enc.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );
  const sigBuffer = await crypto.subtle.sign('HMAC', key, enc.encode(canonical));
  return Array.from(new Uint8Array(sigBuffer))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

export async function verifyApprovalSignature(
  canonical: string,
  signatureHex: string,
  secret: string
): Promise<boolean> {
  if (!signatureHex || typeof signatureHex !== 'string') return false;
  const cleanHex = signatureHex.trim().toLowerCase();
  if (cleanHex.length !== 64 || !/^[0-9a-f]{64}$/.test(cleanHex)) return false;

  const sigBytes = new Uint8Array(32);
  for (let i = 0; i < 32; i++) {
    sigBytes[i] = parseInt(cleanHex.substring(i * 2, i * 2 + 2), 16);
  }

  try {
    const enc = new TextEncoder();
    const key = await crypto.subtle.importKey(
      'raw',
      enc.encode(secret),
      { name: 'HMAC', hash: 'SHA-256' },
      false,
      ['verify']
    );
    return await crypto.subtle.verify('HMAC', key, sigBytes, enc.encode(canonical));
  } catch {
    return false;
  }
}

/**
 * Ensures media_promotion_approvals table exists in D1.
 */
export async function ensurePromotionApprovalsTable(db: any): Promise<void> {
  if (!db || typeof db.exec !== 'function') return;
  try {
    await db.exec(`
      CREATE TABLE IF NOT EXISTS media_promotion_approvals (
        approval_id TEXT PRIMARY KEY,
        device_id TEXT NOT NULL,
        article_id INTEGER NOT NULL REFERENCES articles(id) ON DELETE CASCADE,
        article_slug TEXT NOT NULL,
        content_hash TEXT NOT NULL,
        candidate_sha256 TEXT NOT NULL,
        slot_key TEXT NOT NULL DEFAULT 'featured',
        alt_text TEXT,
        candidate_width INTEGER,
        candidate_height INTEGER,
        candidate_mime TEXT,
        candidate_byte_size INTEGER,
        status TEXT NOT NULL DEFAULT 'REQUESTED',
        signature TEXT,
        requested_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        approved_at DATETIME,
        approved_by TEXT,
        rejection_reason TEXT,
        issued_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        expires_at DATETIME NOT NULL,
        consumed_at DATETIME,
        consumed_by_upload_id TEXT,
        CHECK (status IN ('REQUESTED', 'APPROVED', 'CONSUMED', 'EXPIRED', 'REJECTED', 'ISSUED', 'REVOKED'))
      );
      CREATE INDEX IF NOT EXISTS idx_prom_appr_slug ON media_promotion_approvals(article_slug);
      CREATE INDEX IF NOT EXISTS idx_prom_appr_sha ON media_promotion_approvals(candidate_sha256);
      CREATE INDEX IF NOT EXISTS idx_prom_appr_device ON media_promotion_approvals(device_id);
      CREATE INDEX IF NOT EXISTS idx_prom_appr_status ON media_promotion_approvals(status);
    `);
    try {
      await db.exec('ALTER TABLE media_promotion_approvals ADD COLUMN alt_text TEXT;');
    } catch (_) {}
  } catch (_) {}
}

/**
 * Creates a pending Promotion Request (Media Device Authority).
 * Creates status 'REQUESTED' with zero usable signature.
 */
export async function requestPromotionApproval(
  db: any,
  params: RequestPromotionApprovalParams,
  _env?: any
): Promise<RequestPromotionApprovalResult> {
  const {
    deviceId,
    articleSlug,
    expectedContentHash,
    candidateSha256,
    slotKey = 'featured',
    altText,
    candidateWidth,
    candidateHeight,
    candidateMime,
    candidateByteSize,
    ttlSeconds = 900 // 15 minutes default
  } = params;

  if (!deviceId || typeof deviceId !== 'string') {
    return { success: false, statusCode: 401, code: 'DEVICE_ID_REQUIRED', error: 'device_id wajib disertakan.' };
  }

  if (!articleSlug || typeof articleSlug !== 'string') {
    return { success: false, statusCode: 422, code: 'ARTICLE_SLUG_REQUIRED', error: 'article_slug wajib disertakan.' };
  }

  if (!candidateSha256 || typeof candidateSha256 !== 'string' || !/^[0-9a-fA-F]{64}$/.test(candidateSha256.trim())) {
    return { success: false, statusCode: 422, code: 'INVALID_CANDIDATE_SHA', error: 'candidate_sha256 harus berupa hex 64 karakter valid.' };
  }

  if (slotKey !== 'featured') {
    return { success: false, statusCode: 422, code: 'INVALID_SLOT_KEY', error: 'Hanya slot_key "featured" yang diizinkan untuk promosi manual.' };
  }

  const cleanAlt = (altText || '').trim();
  if (!cleanAlt) {
    return {
      success: false,
      statusCode: 422,
      code: 'ALT_TEXT_REQUIRED',
      error: 'alt_text wajib disertakan dan tidak boleh kosong untuk promosi manual.'
    };
  }

  await ensurePromotionApprovalsTable(db);

  // 1. Resolve Target Article
  let article: any;
  if (db) {
    try {
      article = await db
        .prepare('SELECT id, slug, status, title, content_hash FROM articles WHERE slug = ? LIMIT 1')
        .bind(articleSlug.trim())
        .first();
    } catch (err: any) {
      return { success: false, statusCode: 500, code: 'DATABASE_ERROR', error: `Gagal membaca artikel: ${err.message}` };
    }
  }

  if (!article) {
    return { success: false, statusCode: 404, code: 'ARTICLE_NOT_FOUND', error: `Artikel target '${articleSlug}' tidak ditemukan.` };
  }

  if (article.status !== 'published') {
    return {
      success: false,
      statusCode: 409,
      code: 'ARTICLE_NOT_PUBLISHED',
      error: `Hanya artikel berstatus 'published' yang dapat dipromosikan manual. Artikel ini berstatus '${article.status}'.`
    };
  }

  // 2. Validate Content Hash if provided
  if (expectedContentHash && article.content_hash && expectedContentHash !== article.content_hash) {
    return {
      success: false,
      statusCode: 409,
      code: 'CONTENT_HASH_MISMATCH',
      error: 'expected_content_hash tidak cocok dengan content_hash artikel saat ini.'
    };
  }

  const cleanSha = candidateSha256.trim().toLowerCase();
  const cleanContentHash = String(article.content_hash || '').trim();
  const requestedAt = new Date().toISOString();
  const expiresAt = new Date(Date.now() + ttlSeconds * 1000).toISOString();
  const randHex = Array.from(crypto.getRandomValues(new Uint8Array(8)))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
  const requestId = `prom_req_${Date.now().toString(36)}_${randHex}`;

  // 3. Persist to D1 with status = 'REQUESTED' (Zero signature)
  if (db) {
    try {
      await db
        .prepare(
          `INSERT INTO media_promotion_approvals
           (approval_id, device_id, article_id, article_slug, content_hash, candidate_sha256, slot_key, alt_text,
            candidate_width, candidate_height, candidate_mime, candidate_byte_size,
            status, signature, requested_at, issued_at, expires_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'REQUESTED', NULL, ?, ?, ?)`
        )
        .bind(
          requestId,
          deviceId,
          article.id,
          article.slug,
          cleanContentHash,
          cleanSha,
          slotKey,
          cleanAlt,
          candidateWidth || null,
          candidateHeight || null,
          candidateMime || null,
          candidateByteSize || null,
          requestedAt,
          requestedAt,
          expiresAt
        )
        .run();
    } catch (dbErr: any) {
      return { success: false, statusCode: 500, code: 'REQUEST_PERSIST_FAILED', error: `Gagal mencatat permintaan promosi: ${dbErr.message}` };
    }
  }

  return {
    success: true,
    promotionRequest: {
      request_id: requestId,
      approval_id: requestId,
      status: 'REQUESTED',
      device_id: deviceId,
      article_id: article.id,
      article_slug: article.slug,
      article_title: article.title || article.slug,
      content_hash: cleanContentHash,
      candidate_sha256: cleanSha,
      slot_key: slotKey,
      alt_text: cleanAlt,
      candidate_width: candidateWidth,
      candidate_height: candidateHeight,
      candidate_mime: candidateMime,
      candidate_byte_size: candidateByteSize,
      requested_at: requestedAt,
      expires_at: expiresAt
    }
  };
}

/**
 * Human Admin Approval Authority.
 * Transitions a pending REQUESTED promotion to APPROVED and mints the HMAC signature.
 */
export async function adminApprovePromotionRequest(
  db: any,
  params: AdminApprovePromotionParams
): Promise<AdminApprovePromotionResult> {
  const { requestId, adminActor, env } = params;

  if (!requestId || typeof requestId !== 'string') {
    return { success: false, statusCode: 400, code: 'REQUEST_ID_REQUIRED', error: 'requestId wajib disertakan.' };
  }

  await ensurePromotionApprovalsTable(db);

  let record: any = null;
  if (db) {
    try {
      record = await db
        .prepare('SELECT * FROM media_promotion_approvals WHERE approval_id = ? LIMIT 1')
        .bind(requestId.trim())
        .first();
    } catch (err: any) {
      return { success: false, statusCode: 500, code: 'DATABASE_ERROR', error: `Gagal membaca permintaan: ${err.message}` };
    }
  }

  if (!record) {
    return { success: false, statusCode: 404, code: 'PROMOTION_REQUEST_NOT_FOUND', error: `Permintaan promosi '${requestId}' tidak ditemukan.` };
  }

  if (record.status !== 'REQUESTED') {
    return {
      success: false,
      statusCode: 409,
      code: 'INVALID_PROMOTION_REQUEST_STATUS',
      error: `Permintaan promosi berstatus '${record.status}'. Hanya status 'REQUESTED' yang dapat disetujui.`
    };
  }

  const nowMs = Date.now();
  const expiresAtMs = new Date(record.expires_at).getTime();
  if (nowMs > expiresAtMs) {
    return {
      success: false,
      statusCode: 403,
      code: 'PROMOTION_REQUEST_EXPIRED',
      error: `Permintaan promosi telah kedaluwarsa pada ${record.expires_at}.`
    };
  }

  // Verify article content hash has not drifted
  let article: any;
  if (db) {
    article = await db
      .prepare('SELECT id, slug, status, content_hash FROM articles WHERE id = ? LIMIT 1')
      .bind(record.article_id)
      .first();
  }

  if (!article || article.status !== 'published') {
    return {
      success: false,
      statusCode: 409,
      code: 'ARTICLE_STATUS_CHANGED',
      error: 'Artikel target tidak lagi dalam status published.'
    };
  }

  if (article.content_hash !== record.content_hash) {
    return {
      success: false,
      statusCode: 409,
      code: 'CONTENT_HASH_DRIFT_DETECTED',
      error: 'Konten artikel telah berubah sejak permintaan promosi diajukan. Persetujuan ditolak.'
    };
  }

  const approvedAt = new Date().toISOString();
  const secret = getApprovalSigningSecret(env);
  const canonical = buildCanonicalApprovalString(
    record.approval_id,
    record.device_id,
    record.article_id,
    record.article_slug,
    record.content_hash,
    record.candidate_sha256,
    record.slot_key,
    approvedAt,
    record.expires_at,
    record.alt_text || ''
  );

  const signature = await signApprovalCanonicalString(canonical, secret);

  // Atomically transition REQUESTED -> APPROVED
  if (db) {
    try {
      const updateRes = await db
        .prepare(
          `UPDATE media_promotion_approvals
           SET status = 'APPROVED', approved_at = ?, approved_by = ?, signature = ?
           WHERE approval_id = ? AND status = 'REQUESTED'`
        )
        .bind(approvedAt, adminActor || 'admin_operator', signature, record.approval_id)
        .run();

      if (updateRes && updateRes.changes === 0) {
        return {
          success: false,
          statusCode: 409,
          code: 'CONCURRENT_APPROVAL_CONFLICT',
          error: 'Konflik persetujuan bersamaan.'
        };
      }
    } catch (updErr: any) {
      return { success: false, statusCode: 500, code: 'APPROVAL_UPDATE_FAILED', error: `Gagal memperbarui approval: ${updErr.message}` };
    }
  }

  const receipt: PromotionApprovalReceipt = {
    approval_id: record.approval_id,
    request_id: record.approval_id,
    device_id: record.device_id,
    article_id: record.article_id,
    article_slug: record.article_slug,
    content_hash: record.content_hash,
    expected_content_hash: record.content_hash,
    candidate_sha256: record.candidate_sha256,
    slot_key: record.slot_key,
    alt_text: record.alt_text || null,
    status: 'APPROVED',
    approved_at: approvedAt,
    issued_at: record.issued_at,
    expires_at: record.expires_at,
    signature
  };

  return {
    success: true,
    approvalReceipt: receipt
  };
}

/**
 * Convenience helper combining request + admin approval for tests and migrations.
 */
export async function issuePromotionApproval(
  db: any,
  params: RequestPromotionApprovalParams,
  env?: any
): Promise<AdminApprovePromotionResult> {
  const effectiveParams: RequestPromotionApprovalParams = {
    ...params,
    altText: params.altText !== undefined ? params.altText : ((params as any).alt_text !== undefined ? (params as any).alt_text : 'Test promotion alt text')
  };
  const reqRes = await requestPromotionApproval(db, effectiveParams, env);
  if (!reqRes.success || !reqRes.promotionRequest) {
    return {
      success: false,
      statusCode: reqRes.statusCode,
      code: reqRes.code,
      error: reqRes.error
    };
  }
  return adminApprovePromotionRequest(db, {
    requestId: reqRes.promotionRequest.request_id,
    adminActor: 'admin_test_operator',
    env
  });
}

/**
 * Human Admin Rejection Authority.
 */
export async function adminRejectPromotionRequest(
  db: any,
  requestId: string,
  adminActor: string,
  reason?: string
): Promise<{ success: boolean; error?: string; statusCode?: number; code?: string }> {
  if (!requestId) return { success: false, statusCode: 400, code: 'REQUEST_ID_REQUIRED', error: 'requestId wajib.' };

  await ensurePromotionApprovalsTable(db);

  if (db) {
    try {
      const updateRes = await db
        .prepare(
          `UPDATE media_promotion_approvals
           SET status = 'REJECTED', approved_by = ?, rejection_reason = ?
           WHERE approval_id = ? AND status = 'REQUESTED'`
        )
        .bind(adminActor || 'admin_operator', reason || 'Ditolak oleh admin', requestId.trim())
        .run();

      if (updateRes && updateRes.changes === 0) {
        return { success: false, statusCode: 409, code: 'NOT_IN_REQUESTED_STATE', error: 'Permintaan tidak dalam status REQUESTED.' };
      }
    } catch (err: any) {
      return { success: false, statusCode: 500, code: 'DATABASE_ERROR', error: err.message };
    }
  }

  return { success: true };
}

/**
 * Retrieves the status and details of a promotion request.
 */
export async function getPromotionRequestStatus(
  db: any,
  requestId: string,
  callingDeviceId?: string
): Promise<{ success: boolean; record?: PromotionApprovalRecord; approvalReceipt?: PromotionApprovalReceipt; error?: string; statusCode?: number; code?: string }> {
  if (!requestId) return { success: false, statusCode: 400, code: 'REQUEST_ID_REQUIRED', error: 'requestId wajib.' };

  await ensurePromotionApprovalsTable(db);

  let record: any = null;
  if (db) {
    try {
      record = await db
        .prepare('SELECT * FROM media_promotion_approvals WHERE approval_id = ? LIMIT 1')
        .bind(requestId.trim())
        .first();
    } catch (err: any) {
      return { success: false, statusCode: 500, code: 'DATABASE_ERROR', error: err.message };
    }
  }

  if (!record) {
    return { success: false, statusCode: 404, code: 'NOT_FOUND', error: 'Permintaan promosi tidak ditemukan.' };
  }

  if (callingDeviceId && record.device_id !== callingDeviceId) {
    return { success: false, statusCode: 403, code: 'DEVICE_MISMATCH', error: 'Permintaan dimiliki oleh device_id berbeda.' };
  }

  // Check if expired
  if (record.status === 'REQUESTED' && Date.now() > new Date(record.expires_at).getTime()) {
    record.status = 'EXPIRED';
  }

  let approvalReceipt: PromotionApprovalReceipt | undefined = undefined;
  if ((record.status === 'APPROVED' || record.status === 'ISSUED') && record.signature) {
    approvalReceipt = {
      approval_id: record.approval_id,
      request_id: record.approval_id,
      device_id: record.device_id,
      article_id: record.article_id,
      article_slug: record.article_slug,
      content_hash: record.content_hash,
      expected_content_hash: record.content_hash,
      candidate_sha256: record.candidate_sha256,
      slot_key: record.slot_key,
      alt_text: record.alt_text || null,
      status: record.status,
      approved_at: record.approved_at,
      issued_at: record.issued_at,
      expires_at: record.expires_at,
      signature: record.signature
    };
  }

  return {
    success: true,
    record: record as PromotionApprovalRecord,
    approvalReceipt
  };
}

/**
 * Lists pending promotion requests for Admin review.
 */
export async function listPendingPromotionRequests(db: any): Promise<any[]> {
  await ensurePromotionApprovalsTable(db);
  if (!db) return [];
  try {
    const rows = await db
      .prepare(
        `SELECT mpa.*, a.title as article_title
         FROM media_promotion_approvals mpa
         LEFT JOIN articles a ON a.id = mpa.article_id
         ORDER BY mpa.requested_at DESC
         LIMIT 50`
      )
      .all();
    return rows && rows.results ? rows.results : [];
  } catch {
    return [];
  }
}

/**
 * Validates and atomically consumes a server-issued promotion approval receipt.
 * Enforces: Only status = 'APPROVED' (or legacy 'ISSUED') may execute.
 * Rejects status = 'REQUESTED' with 403 HUMAN_ADMIN_APPROVAL_REQUIRED.
 */
export async function verifyAndConsumePromotionApproval(
  db: any,
  approvalReceipt: any,
  computedSha256: string,
  uploadId: string,
  env?: any,
  callingDeviceId?: string
): Promise<VerifyPromotionApprovalResult> {
  if (!approvalReceipt || typeof approvalReceipt !== 'object') {
    return {
      valid: false,
      statusCode: 403,
      code: 'SERVER_APPROVAL_REQUIRED',
      error: 'Upload standalone memerlukan server-issued approval receipt.'
    };
  }

  const approval_id = approvalReceipt.approval_id || approvalReceipt.request_id;
  const signature = approvalReceipt.signature;
  if (!approval_id || typeof approval_id !== 'string') {
    return {
      valid: false,
      statusCode: 403,
      code: 'APPROVAL_ID_REQUIRED',
      error: 'Approval receipt wajib menyertakan approval_id.'
    };
  }

  await ensurePromotionApprovalsTable(db);

  let record: any = null;
  if (db) {
    try {
      record = await db
        .prepare('SELECT * FROM media_promotion_approvals WHERE approval_id = ? LIMIT 1')
        .bind(approval_id.trim())
        .first();
    } catch (err: any) {
      return {
        valid: false,
        statusCode: 500,
        code: 'APPROVAL_LOOKUP_FAILED',
        error: `Gagal memeriksa approval di database: ${err.message}`
      };
    }
  }

  if (!record) {
    return {
      valid: false,
      statusCode: 403,
      code: 'APPROVAL_RECEIPT_NOT_FOUND',
      error: 'Approval receipt tidak ditemukan atau tidak pernah diterbitkan oleh server.'
    };
  }

  // 1. Dual Control Check: Must NOT be mere REQUESTED state
  if (record.status === 'REQUESTED') {
    return {
      valid: false,
      statusCode: 403,
      code: 'HUMAN_ADMIN_APPROVAL_REQUIRED',
      error: 'Permintaan promosi belum disetujui oleh admin manusia. Upload ditolak.'
    };
  }

  if (record.status === 'REJECTED') {
    return {
      valid: false,
      statusCode: 403,
      code: 'PROMOTION_REJECTED',
      error: 'Permintaan promosi telah ditolak oleh admin manusia.'
    };
  }

  // 2. Device identity verification
  if (callingDeviceId && record.device_id !== callingDeviceId) {
    return {
      valid: false,
      statusCode: 403,
      code: 'APPROVAL_DEVICE_MISMATCH',
      error: 'Approval receipt diterbitkan untuk device_id yang berbeda.'
    };
  }

  // 2b. Target Article binding verification
  if (approvalReceipt.article_slug && approvalReceipt.article_slug.trim() !== record.article_slug) {
    return {
      valid: false,
      statusCode: 422,
      code: 'APPROVAL_SLUG_MISMATCH',
      error: `Approval receipt diterbitkan untuk artikel '${record.article_slug}', bukan '${approvalReceipt.article_slug}'.`
    };
  }

  if (approvalReceipt.article_id && Number(approvalReceipt.article_id) !== record.article_id) {
    return {
      valid: false,
      statusCode: 422,
      code: 'APPROVAL_ARTICLE_MISMATCH',
      error: `Approval receipt diterbitkan untuk article_id ${record.article_id}, bukan ${approvalReceipt.article_id}.`
    };
  }

  // 2c. Target Article content_hash verification
  if (db) {
    const curArt = await db
      .prepare('SELECT content_hash FROM articles WHERE id = ? LIMIT 1')
      .bind(record.article_id)
      .first();
    if (curArt && curArt.content_hash !== record.content_hash) {
      return {
        valid: false,
        statusCode: 409,
        code: 'CONTENT_HASH_DRIFT_DETECTED',
        error: 'Konten artikel target telah berubah setelah persetujuan diterbitkan. Eksekusi dibatalkan.'
      };
    }
  }

  // 3. Candidate SHA verification
  const normalizedComputedSha = computedSha256.toLowerCase();
  if (record.candidate_sha256.toLowerCase() !== normalizedComputedSha) {
    return {
      valid: false,
      statusCode: 422,
      code: 'APPROVAL_SHA_MISMATCH',
      error: `Candidate SHA (${record.candidate_sha256}) tidak cocok dengan hash payload aktual (${normalizedComputedSha}).`
    };
  }

  // 4. Expiration verification
  const nowMs = Date.now();
  const expiresAtMs = new Date(record.expires_at).getTime();
  if (nowMs > expiresAtMs) {
    return {
      valid: false,
      statusCode: 403,
      code: 'APPROVAL_EXPIRED',
      error: `Approval receipt telah kedaluwarsa pada ${record.expires_at}.`
    };
  }

  // 4b. Alt text binding verification
  if (approvalReceipt.alt_text && record.alt_text && approvalReceipt.alt_text.trim() !== record.alt_text.trim()) {
    return {
      valid: false,
      statusCode: 422,
      code: 'APPROVAL_ALT_TEXT_MISMATCH',
      error: `Approval receipt diterbitkan untuk alt_text '${record.alt_text}', bukan '${approvalReceipt.alt_text}'.`
    };
  }

  // 5. Cryptographic Signature Verification
  const secret = getApprovalSigningSecret(env);
  const timeForSig = record.approved_at || record.issued_at;
  const canonical = buildCanonicalApprovalString(
    record.approval_id,
    record.device_id,
    record.article_id,
    record.article_slug,
    record.content_hash,
    record.candidate_sha256,
    record.slot_key,
    timeForSig,
    record.expires_at,
    record.alt_text || ''
  );

  const sigToVerify = signature || record.signature;
  const isSigValid = await verifyApprovalSignature(canonical, sigToVerify, secret);
  if (!isSigValid) {
    return {
      valid: false,
      statusCode: 403,
      code: 'APPROVAL_SIGNATURE_INVALID',
      error: 'Tanda tangan kriptografis approval receipt tidak valid.'
    };
  }

  // 6. Consumption / Idempotency handling
  if (record.status === 'CONSUMED') {
    // If the exact same candidate SHA and target article was already consumed by this approval, allow idempotent retry
    if (
      record.candidate_sha256.toLowerCase() === normalizedComputedSha &&
      (!approvalReceipt.article_slug || approvalReceipt.article_slug.trim() === record.article_slug)
    ) {
      return {
        valid: true,
        approval: record as PromotionApprovalRecord,
        isReplayIdempotent: true
      };
    }

    return {
      valid: false,
      statusCode: 409,
      code: 'APPROVAL_ALREADY_CONSUMED',
      error: 'Approval receipt ini telah digunakan dan tidak dapat digunakan kembali untuk operasi lain.'
    };
  }

  if (record.status === 'REVOKED') {
    return {
      valid: false,
      statusCode: 403,
      code: 'APPROVAL_REVOKED',
      error: 'Approval receipt telah dicabut oleh operator.'
    };
  }

  // 7. Atomically transition APPROVED (or ISSUED) -> CONSUMED
  if (db) {
    try {
      const res = await db
        .prepare(
          `UPDATE media_promotion_approvals
           SET status = 'CONSUMED', consumed_at = CURRENT_TIMESTAMP, consumed_by_upload_id = ?
           WHERE approval_id = ? AND (status = 'APPROVED' OR status = 'ISSUED')`
        )
        .bind(uploadId, record.approval_id)
        .run();

      if (res && res.changes === 0) {
        return {
          valid: false,
          statusCode: 409,
          code: 'APPROVAL_CONSUMPTION_CONFLICT',
          error: 'Konflik konsumsi approval receipt; receipt telah dikonsumsi oleh proses lain.'
        };
      }
    } catch (updErr: any) {
      return {
        valid: false,
        statusCode: 500,
        code: 'APPROVAL_UPDATE_FAILED',
        error: `Gagal memperbarui status approval: ${updErr.message}`
      };
    }
  }

  return {
    valid: true,
    approval: { ...record, status: 'CONSUMED', consumed_by_upload_id: uploadId } as PromotionApprovalRecord,
    isReplayIdempotent: false
  };
}
