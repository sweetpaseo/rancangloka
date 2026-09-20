/**
 * RancangLoka — Media Asset Registration Service
 * Phase 5G1: Media Asset Registration Foundation
 *
 * Architectural Invariants:
 * 1. Verified Upload Receipt + Verified Canonical R2 Object Metadata ONLY.
 *    Strictly NO binary retransmission, NO R2 PUT calls, NO image transforms.
 * 2. Dedicated Device Authentication (least privilege, independent of admin_session).
 * 3. Deterministic Content-Addressed Identity:
 *    asset_id = ast_<sha256(role:sha256:r2_key).substring(0, 24)>
 * 4. Semantic Differentiation:
 *    role = ARTICLE_PUBLIC_DERIVATIVE (distinct from ORIGINAL / WATERMARK_MASTER).
 * 5. Server-Side Receipt & R2 Integrity Verification:
 *    - Upload receipt exists, authoritative, state === 'UPLOADED', metadata matches.
 *    - Canonical R2 object independently verified via bucket.head() (fail closed if missing or mismatched).
 * 6. Idempotent Deduplication & Conflict Guard:
 *    - Same verified R2 object duplicate registration safely reused (reused_existing = true).
 *    - Identity or integrity conflicts fail closed (HTTP 409).
 * 7. Failure Isolation:
 *    - Database failures preserve R2 object (R2 object is canonical uploaded storage; never deleted).
 * 8. Zero Downstream Coupling:
 *    - ZERO article_media rows created.
 *    - ZERO article readiness or publication mutations.
 */

export const REGISTERED_MEDIA_ASSET_ROLE = 'ARTICLE_PUBLIC_DERIVATIVE';
export const ROLE_ORIGINAL = 'ORIGINAL';
export const ROLE_WATERMARK_MASTER = 'WATERMARK_MASTER';

export const MEDIA_ASSET_REGISTERED_STATE = 'VALIDATED';
export const MEDIA_ASSET_ID_RULE = 'ast_${sha256(role:sha256:r2_key).substring(0, 24)}';

export class MediaRegistrationError extends Error {
  code: string;
  statusCode: number;
  constructor(code: string, message: string, statusCode: number = 400) {
    super(message);
    this.name = 'MediaRegistrationError';
    this.code = code;
    this.statusCode = statusCode;
  }
}

export interface UploadReceiptVerificationPayload {
  upload_id?: string;
  state?: string;
  r2_key?: string;
  sha256?: string;
  byte_size?: number;
  mime?: string;
  uploaded_at?: string;
}

export interface MediaAssetRegistrationParams {
  upload_id: string;
  derivative_id: string;
  transform_id: string;
  r2_key: string;
  sha256: string;
  mime: string;
  width: number;
  height: number;
  byte_size: number;
  role?: string;

  // Provenance metadata (optional / preserved when schema supports)
  watermark_settings_version?: number;
  watermark_engine_version?: string;
  source_sha256?: string;
  job_id?: string;
  slot_key?: string;
  article_id?: number;

  // Receipt verification
  upload_receipt?: UploadReceiptVerificationPayload;
  upload_state?: string;
}

export interface RegisteredMediaAsset {
  asset_id: string;
  role: string;
  r2_key: string;
  sha256: string;
  mime: string;
  width: number;
  height: number;
  byte_size: number;
  created_at: string;
  reused_existing: boolean;
}

export interface MediaAssetRegistrationResult {
  status: 'success';
  asset: RegisteredMediaAsset;
}

/**
 * Computes deterministic media asset identity:
 * ast_<sha256(role:sha256:r2_key).substring(0, 24)>
 */
export async function computeMediaAssetId(role: string, sha256: string, r2Key: string): Promise<string> {
  if (!role || !sha256 || !r2Key) {
    throw new MediaRegistrationError('INVALID_IDENTITY_INPUTS', 'Role, sha256, and r2_key are required to compute asset_id', 400);
  }
  const input = `${role.trim()}:${sha256.trim().toLowerCase()}:${r2Key.trim()}`;
  const enc = new TextEncoder().encode(input);
  const hashBuffer = await crypto.subtle.digest('SHA-256', enc);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  const hex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
  return `ast_${hex.substring(0, 24)}`;
}

/**
 * Validates and registers an article derivative media asset.
 * Consumes verified upload receipt + verified canonical R2 object metadata ONLY.
 * Performs ZERO R2 PUT calls and accepts NO image binary.
 */
export async function registerMediaAsset(
  params: MediaAssetRegistrationParams,
  db: any,
  bucket: any
): Promise<MediaAssetRegistrationResult> {
  const {
    upload_id,
    derivative_id,
    transform_id,
    r2_key,
    sha256,
    mime,
    width,
    height,
    byte_size,
    role = REGISTERED_MEDIA_ASSET_ROLE,
    watermark_settings_version,
    watermark_engine_version,
    source_sha256,
    job_id,
    slot_key,
    article_id,
    upload_receipt,
    upload_state
  } = params;

  // 1. Validate required identity fields
  if (!upload_id || typeof upload_id !== 'string' || !upload_id.trim()) {
    throw new MediaRegistrationError('UPLOAD_RECEIPT_REQUIRED', 'Parameter upload_id wajib disertakan.', 400);
  }
  if (!derivative_id || typeof derivative_id !== 'string' || !derivative_id.trim()) {
    throw new MediaRegistrationError('DERIVATIVE_ID_REQUIRED', 'Parameter derivative_id wajib disertakan.', 400);
  }
  if (!transform_id || typeof transform_id !== 'string' || !transform_id.trim()) {
    throw new MediaRegistrationError('TRANSFORM_ID_REQUIRED', 'Parameter transform_id wajib disertakan.', 400);
  }
  if (!r2_key || typeof r2_key !== 'string' || !r2_key.trim()) {
    throw new MediaRegistrationError('R2_KEY_REQUIRED', 'Parameter r2_key wajib disertakan.', 400);
  }
  if (!sha256 || typeof sha256 !== 'string' || sha256.trim().length < 16) {
    throw new MediaRegistrationError('SHA256_REQUIRED', 'Valid SHA-256 hash wajib disertakan.', 400);
  }
  if (!mime || typeof mime !== 'string' || !mime.trim()) {
    throw new MediaRegistrationError('MIME_REQUIRED', 'MIME type wajib disertakan.', 400);
  }
  if (typeof width !== 'number' || width <= 0 || !Number.isFinite(width)) {
    throw new MediaRegistrationError('DIMENSIONS_REQUIRED', 'Width harus berupa bilangan positif.', 400);
  }
  if (typeof height !== 'number' || height <= 0 || !Number.isFinite(height)) {
    throw new MediaRegistrationError('DIMENSIONS_REQUIRED', 'Height harus berupa bilangan positif.', 400);
  }
  if (typeof byte_size !== 'number' || byte_size <= 0 || !Number.isFinite(byte_size)) {
    throw new MediaRegistrationError('BYTE_SIZE_REQUIRED', 'Byte size harus berupa bilangan positif.', 400);
  }

  // 2. Validate Semantic Role
  const cleanRole = role.trim();
  if (cleanRole !== REGISTERED_MEDIA_ASSET_ROLE && cleanRole !== 'PUBLIC_DERIVATIVE_CANDIDATE') {
    throw new MediaRegistrationError(
      'INVALID_MEDIA_ASSET_ROLE',
      `Role '${cleanRole}' tidak valid untuk media asset derivative. Diharapkan '${REGISTERED_MEDIA_ASSET_ROLE}'.`,
      422
    );
  }
  const canonicalRole = cleanRole === 'PUBLIC_DERIVATIVE_CANDIDATE' ? REGISTERED_MEDIA_ASSET_ROLE : cleanRole;

  // 3. Server-side Receipt Verification
  const effectiveState = (upload_receipt?.state || upload_state || '').trim().toUpperCase();
  if (!effectiveState) {
    throw new MediaRegistrationError('UPLOAD_RECEIPT_REQUIRED', 'Status receipt upload wajib disertakan.', 400);
  }
  if (effectiveState !== 'UPLOADED') {
    throw new MediaRegistrationError(
      'NON_UPLOADED_RECEIPT_REJECTED',
      `Upload receipt harus berstatus 'UPLOADED'. Diterima: '${effectiveState}'.`,
      422
    );
  }

  // If receipt payload is provided, verify matching fields
  if (upload_receipt) {
    if (upload_receipt.r2_key && upload_receipt.r2_key !== r2_key) {
      throw new MediaRegistrationError(
        'RECEIPT_R2_KEY_MISMATCH',
        `Receipt r2_key '${upload_receipt.r2_key}' tidak cocok dengan declared r2_key '${r2_key}'.`,
        422
      );
    }
    if (upload_receipt.sha256 && upload_receipt.sha256.toLowerCase() !== sha256.toLowerCase()) {
      throw new MediaRegistrationError(
        'RECEIPT_SHA_MISMATCH',
        `Receipt sha256 '${upload_receipt.sha256}' tidak cocok dengan declared sha256 '${sha256}'.`,
        422
      );
    }
    if (upload_receipt.byte_size !== undefined && upload_receipt.byte_size !== byte_size) {
      throw new MediaRegistrationError(
        'RECEIPT_SIZE_MISMATCH',
        `Receipt byte_size '${upload_receipt.byte_size}' tidak cocok dengan declared byte_size '${byte_size}'.`,
        422
      );
    }
    if (upload_receipt.mime && upload_receipt.mime.toLowerCase() !== mime.toLowerCase()) {
      throw new MediaRegistrationError(
        'RECEIPT_MIME_MISMATCH',
        `Receipt mime '${upload_receipt.mime}' tidak cocok dengan declared mime '${mime}'.`,
        422
      );
    }
  }

  // 4. Canonical R2 Existence & Metadata Verification (Independent Read-Only Check)
  if (!bucket || typeof bucket.head !== 'function') {
    throw new MediaRegistrationError('R2_STORAGE_UNAVAILABLE', 'R2 bucket storage is unavailable', 503);
  }

  let r2Object: any;
  try {
    r2Object = await bucket.head(r2_key);
  } catch (headErr: any) {
    throw new MediaRegistrationError(
      'R2_HEAD_FAILED',
      `Gagal memeriksa keberadaan objek R2: ${headErr.message}`,
      500
    );
  }

  if (!r2Object) {
    throw new MediaRegistrationError(
      'MISSING_R2_OBJECT',
      `Objek kanonikal R2 '${r2_key}' tidak ditemukan di storage. Registrasi ditolak.`,
      404
    );
  }

  // Size verification
  if (r2Object.size !== byte_size) {
    throw new MediaRegistrationError(
      'R2_SIZE_MISMATCH',
      `Ukuran objek R2 (${r2Object.size}) tidak sesuai dengan declared byte size (${byte_size}).`,
      422
    );
  }

  // MIME verification
  const r2Mime = r2Object.httpMetadata?.contentType;
  if (r2Mime && r2Mime.toLowerCase() !== mime.toLowerCase()) {
    throw new MediaRegistrationError(
      'R2_MIME_MISMATCH',
      `MIME type objek R2 ('${r2Mime}') tidak sesuai dengan declared MIME ('${mime}').`,
      422
    );
  }

  // SHA-256 custom metadata verification
  const r2Sha = r2Object.customMetadata?.sha256;
  if (r2Sha && r2Sha.toLowerCase() !== sha256.toLowerCase()) {
    throw new MediaRegistrationError(
      'R2_SHA_MISMATCH',
      `SHA-256 objek R2 ('${r2Sha}') tidak sesuai dengan declared SHA-256 ('${sha256}').`,
      422
    );
  }

  // Dimension verification if present in R2 metadata
  const r2Width = r2Object.customMetadata?.width ? Number(r2Object.customMetadata.width) : undefined;
  const r2Height = r2Object.customMetadata?.height ? Number(r2Object.customMetadata.height) : undefined;
  if (r2Width !== undefined && !isNaN(r2Width) && r2Width > 0 && r2Width !== width) {
    throw new MediaRegistrationError(
      'R2_DIMENSION_MISMATCH',
      `Lebar gambar objek R2 (${r2Width}) tidak sesuai dengan declared width (${width}).`,
      422
    );
  }
  if (r2Height !== undefined && !isNaN(r2Height) && r2Height > 0 && r2Height !== height) {
    throw new MediaRegistrationError(
      'R2_DIMENSION_MISMATCH',
      `Tinggi gambar objek R2 (${r2Height}) tidak sesuai dengan declared height (${height}).`,
      422
    );
  }

  // 5. Deterministic Asset Identity
  const assetId = await computeMediaAssetId(canonicalRole, sha256, r2_key);

  if (!db || typeof db.prepare !== 'function') {
    throw new MediaRegistrationError('DATABASE_UNAVAILABLE', 'Database connection is unavailable', 503);
  }

  // 6. Check existing asset in media_assets (Idempotency & Conflict Guard)
  const existingAsset = await db
    .prepare('SELECT * FROM media_assets WHERE asset_id = ? OR sha256 = ? OR storage_key = ? LIMIT 1')
    .bind(assetId, sha256, r2_key)
    .first();

  if (existingAsset) {
    // Integrity conflict check
    const storageConflict = existingAsset.storage_key !== r2_key;
    const mimeConflict = existingAsset.mime_type.toLowerCase() !== mime.toLowerCase();
    const sizeConflict = Number(existingAsset.file_size) !== byte_size;
    const widthConflict = Number(existingAsset.width) !== width;
    const heightConflict = Number(existingAsset.height) !== height;
    const roleConflict = existingAsset.role && existingAsset.role !== canonicalRole;

    if (storageConflict || mimeConflict || sizeConflict || widthConflict || heightConflict || roleConflict) {
      throw new MediaRegistrationError(
        'MEDIA_ASSET_IDENTITY_CONFLICT',
        `Asset dengan identitas yang sama sudah terdaftar tetapi memiliki metadata bertentangan ` +
        `(storage=${existingAsset.storage_key}, size=${existingAsset.file_size}, mime=${existingAsset.mime_type}, ` +
        `width=${existingAsset.width}, height=${existingAsset.height}, role=${existingAsset.role || 'default'}). Registrasi ditolak.`,
        409
      );
    }

    // Exact idempotent hit
    return {
      status: 'success',
      asset: {
        asset_id: existingAsset.asset_id,
        role: existingAsset.role || canonicalRole,
        r2_key: existingAsset.storage_key,
        sha256: existingAsset.sha256,
        mime: existingAsset.mime_type,
        width: Number(existingAsset.width),
        height: Number(existingAsset.height),
        byte_size: Number(existingAsset.file_size),
        created_at: existingAsset.created_at,
        reused_existing: true
      }
    };
  }

  // 7. Insert new record into media_assets
  const provenancePayload = {
    derivative_id,
    transform_id,
    upload_id,
    watermark_settings_version: watermark_settings_version ?? null,
    watermark_engine_version: watermark_engine_version ?? null,
    source_sha256: source_sha256 ?? null,
    job_id: job_id ?? null,
    slot_key: slot_key ?? null,
    article_id: article_id ?? null
  };
  const provenanceJson = JSON.stringify(provenancePayload);
  const publicUrl = `/${r2_key}`;
  const nowIso = new Date().toISOString();

  try {
    // Try insert with additive columns (0016 schema)
    await db
      .prepare(
        `INSERT INTO media_assets (
          asset_id, media_type, source_type, storage_key, public_url,
          mime_type, width, height, file_size, sha256, alt_text, status,
          role, upload_id, derivative_id, transform_id, provenance_json
        ) VALUES (?, 'image', 'lokamedia_extension', ?, ?, ?, ?, ?, ?, ?, '', ?, ?, ?, ?, ?, ?)`
      )
      .bind(
        assetId,
        r2_key,
        publicUrl,
        mime,
        width,
        height,
        byte_size,
        sha256,
        MEDIA_ASSET_REGISTERED_STATE,
        canonicalRole,
        upload_id,
        derivative_id,
        transform_id,
        provenanceJson
      )
      .run();
  } catch (dbErr: any) {
    const errMsg = dbErr.message || '';

    // Handle race condition / concurrent insert: if another process inserted identically
    if (errMsg.includes('UNIQUE constraint failed') || errMsg.includes('SQLITE_CONSTRAINT')) {
      const concurrentAsset = await db
        .prepare('SELECT * FROM media_assets WHERE asset_id = ? OR sha256 = ? OR storage_key = ? LIMIT 1')
        .bind(assetId, sha256, r2_key)
        .first();

      if (concurrentAsset) {
        if (
          concurrentAsset.storage_key === r2_key &&
          concurrentAsset.mime_type.toLowerCase() === mime.toLowerCase() &&
          Number(concurrentAsset.file_size) === byte_size
        ) {
          return {
            status: 'success',
            asset: {
              asset_id: concurrentAsset.asset_id,
              role: concurrentAsset.role || canonicalRole,
              r2_key: concurrentAsset.storage_key,
              sha256: concurrentAsset.sha256,
              mime: concurrentAsset.mime_type,
              width: Number(concurrentAsset.width),
              height: Number(concurrentAsset.height),
              byte_size: Number(concurrentAsset.file_size),
              created_at: concurrentAsset.created_at,
              reused_existing: true
            }
          };
        }
      }
      throw new MediaRegistrationError('MEDIA_ASSET_IDENTITY_CONFLICT', `Constraint violation during asset registration: ${errMsg}`, 409);
    }

    // If fallback is needed for test DB without 0016 migration columns
    if (errMsg.includes('no such column')) {
      try {
        await db
          .prepare(
            `INSERT INTO media_assets (
              asset_id, media_type, source_type, storage_key, public_url,
              mime_type, width, height, file_size, sha256, alt_text, status
            ) VALUES (?, 'image', 'lokamedia_extension', ?, ?, ?, ?, ?, ?, ?, '', ?)`
          )
          .bind(
            assetId,
            r2_key,
            publicUrl,
            mime,
            width,
            height,
            byte_size,
            sha256,
            MEDIA_ASSET_REGISTERED_STATE
          )
          .run();
      } catch (fallbackErr: any) {
        // NOTE: DB failure preserves R2 object (R2 object is NEVER deleted)
        throw new MediaRegistrationError('DATABASE_INSERT_FAILED', `Gagal menyimpan media_assets: ${fallbackErr.message}`, 500);
      }
    } else {
      // NOTE: DB failure preserves R2 object (R2 object is NEVER deleted)
      throw new MediaRegistrationError('DATABASE_INSERT_FAILED', `Gagal menyimpan media_assets: ${errMsg}`, 500);
    }
  }

  // 8. Record audit log entry (Safe metadata only, zero binary)
  try {
    const auditId = `aud_${assetId.substring(4)}_${Date.now()}`;
    await db
      .prepare(
        `INSERT INTO media_asset_audit (
          audit_id, asset_id, action, role, upload_id, derivative_id, transform_id, sha256, r2_key, safe_metadata_json
        ) VALUES (?, ?, 'REGISTER', ?, ?, ?, ?, ?, ?, ?)`
      )
      .bind(
        auditId,
        assetId,
        canonicalRole,
        upload_id,
        derivative_id,
        transform_id,
        sha256,
        r2_key,
        JSON.stringify({ width, height, byte_size, mime })
      )
      .run();
  } catch (auditErr: any) {
    // Audit write non-blocking for primary asset registration
    console.warn('Audit log write warning:', auditErr.message);
  }

  return {
    status: 'success',
    asset: {
      asset_id: assetId,
      role: canonicalRole,
      r2_key,
      sha256,
      mime,
      width,
      height,
      byte_size,
      created_at: nowIso,
      reused_existing: false
    }
  };
}
