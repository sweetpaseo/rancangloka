/**
 * RancangLoka — Article Media Attachment Service
 * Phase 5H1: Article Media Attachment Foundation
 *
 * Architectural Contracts & Invariants:
 * 1. Decoupled Canonical Attachment:
 *    Represents the relational binding: ARTICLE EDITORIAL SLOT <-> REGISTERED MEDIA ASSET.
 *    Operates purely on identifiers: (article_id, slot_key, asset_id).
 *    Zero binary retransmission, ZERO R2 calls, ZERO image transforms.
 * 2. Dedicated Device Authentication:
 *    Uses least-privilege device credentials (independent of admin_session).
 * 3. Editorial Need Identity:
 *    Identified by (article_id, slot_key) e.g. (1, 'featured').
 * 4. Strict Validation Guards:
 *    - Article existence verified in articles table (fails closed 404).
 *    - Media asset existence and VALIDATED status verified in media_assets (fails closed 404/422).
 *    - Role compatibility verified: permits ARTICLE_PUBLIC_DERIVATIVE, rejects WATERMARK_MASTER / unknown (422).
 *    - Slot validation: safe regex /^[a-z][a-z0-9_]{1,63}$/ (400).
 *    - Provenance compatibility: generated asset bound to article_id/slot_key cannot be cross-attached (422).
 * 5. Deterministic Idempotency & Slot Occupancy:
 *    - Active slot cardinality: exactly ONE active asset per slot (enforced by idx_article_media_one_active_slot).
 *    - Duplicate attachment of same (article_id, slot_key, asset_id) safely reused (reused_existing = true).
 *    - Different asset attempting to occupy same active slot fails closed with 409 (explicit replacement required).
 * 6. Zero Downstream Coupling:
 *    - ZERO article status mutations (articles table untouched).
 *    - ZERO article readiness mutations (article_publication_readiness untouched).
 *    - ZERO publication side-effects (AUTO_PUBLISH = OFF, MEDIA_CAN_PUBLISH = NO).
 * 7. Transactional & Audit Integrity:
 *    - Database failures preserve media_assets, R2 object, upload receipt, and derivative.
 *    - Safe audit log recorded in media_asset_audit (zero binary).
 */

export const EDITORIAL_SLOT_IDENTITY_MODEL = 'ARTICLE_ID_PLUS_SLOT_KEY';
export const ACTIVE_SLOT_CARDINALITY_RULE = 'ONE_ACTIVE_ASSET_PER_SLOT';
export const DIFFERENT_ASSET_SAME_SLOT_POLICY = 'FAIL_CLOSED_REPLACEMENT_REQUIRED';
export const MEDIA_ASSET_MULTI_ARTICLE_POLICY = 'SCHEMA_PERMITS_PROVENANCE_RESTRICTS';

export const SAFE_SLOT_KEY_PATTERN = /^[a-z][a-z0-9_]{1,63}$/;

export const ALLOWED_MEDIA_ASSET_ROLES = new Set([
  'ARTICLE_PUBLIC_DERIVATIVE',
  'ORIGINAL',
  'featured',
  'inline'
]);

export const BARRED_MEDIA_ASSET_ROLES = new Set([
  'WATERMARK_MASTER'
]);

export class MediaAttachmentError extends Error {
  code: string;
  statusCode: number;
  constructor(code: string, message: string, statusCode: number = 400) {
    super(message);
    this.name = 'MediaAttachmentError';
    this.code = code;
    this.statusCode = statusCode;
  }
}

export interface ArticleMediaAttachParams {
  article_id: number;
  slot_key: string;
  asset_id: string;
  caption?: string | null;
  sort_order?: number | null;
  job_id?: string | null;
}

export interface AttachedArticleMedia {
  id: number;
  article_id: number;
  slot_key: string;
  asset_id: string;
  role: string;
  is_active: number;
  sort_order: number;
  caption?: string | null;
  created_at: string;
  reused_existing: boolean;
}

export interface ArticleMediaAttachResult {
  status: 'success';
  attachment: AttachedArticleMedia;
}

/**
 * Resolves the editorial role ('featured' | 'inline') for article_media from the slot_key.
 */
export function resolveEditorialRole(slotKey: string): string {
  const clean = slotKey.trim().toLowerCase();
  if (clean === 'featured' || clean === 'primary') {
    return 'featured';
  }
  return 'inline';
}

/**
 * Validates slot_key format.
 */
export function assertValidSlotKey(slotKey: string): void {
  if (!slotKey || typeof slotKey !== 'string' || !SAFE_SLOT_KEY_PATTERN.test(slotKey)) {
    throw new MediaAttachmentError(
      'INVALID_SLOT_KEY',
      `slot_key '${slotKey}' tidak valid. Harus diawali huruf kecil dan hanya berisi huruf kecil, angka, serta underscore (2-64 karakter).`,
      400
    );
  }
}

/**
 * Attaches a registered media asset to an article editorial slot.
 * Enforces existence, attachability, provenance, idempotency, and single-active-slot constraints.
 * Mutates ZERO article status/readiness and ZERO binary data.
 */
export async function attachArticleMedia(
  params: ArticleMediaAttachParams,
  db: any
): Promise<ArticleMediaAttachResult> {
  const {
    article_id,
    slot_key,
    asset_id,
    caption = null,
    sort_order = 0,
    job_id = null
  } = params;

  // 1. Input Validation
  if (!db || typeof db.prepare !== 'function') {
    throw new MediaAttachmentError('DATABASE_UNAVAILABLE', 'Database connection is unavailable', 503);
  }

  if (typeof article_id !== 'number' || article_id <= 0 || !Number.isInteger(article_id)) {
    throw new MediaAttachmentError('INVALID_ARTICLE_ID', 'article_id harus berupa bilangan bulat positif.', 400);
  }

  assertValidSlotKey(slot_key);

  if (!asset_id || typeof asset_id !== 'string' || !asset_id.trim()) {
    throw new MediaAttachmentError('INVALID_ASSET_ID', 'asset_id wajib disertakan.', 400);
  }
  const cleanAssetId = asset_id.trim();

  // 2. Article Existence Validation
  const article = await db
    .prepare('SELECT id, status FROM articles WHERE id = ?')
    .bind(article_id)
    .first();

  if (!article) {
    throw new MediaAttachmentError(
      'ARTICLE_NOT_FOUND',
      `Artikel dengan id ${article_id} tidak ditemukan. Attachment ditolak.`,
      404
    );
  }

  // 3. Media Asset Existence & Attachability Validation
  const asset = await db
    .prepare(
      `SELECT asset_id, role, status, storage_key, sha256, upload_id,
              derivative_id, transform_id, provenance_json
       FROM media_assets WHERE asset_id = ?`
    )
    .bind(cleanAssetId)
    .first();

  if (!asset) {
    throw new MediaAttachmentError(
      'MEDIA_ASSET_NOT_FOUND',
      `Media asset '${cleanAssetId}' tidak ditemukan di database. Attachment ditolak.`,
      404
    );
  }

  if (asset.status !== 'VALIDATED') {
    throw new MediaAttachmentError(
      'MEDIA_ASSET_NOT_VALIDATED',
      `Media asset '${cleanAssetId}' berstatus '${asset.status}'. Hanya asset berstatus 'VALIDATED' yang dapat di-attach ke editorial slot.`,
      422
    );
  }

  if (BARRED_MEDIA_ASSET_ROLES.has(asset.role)) {
    throw new MediaAttachmentError(
      'BARRED_MEDIA_ASSET_ROLE',
      `Media asset dengan role '${asset.role}' bersifat site-level dan tidak diizinkan untuk article editorial attachment.`,
      422
    );
  }

  if (!ALLOWED_MEDIA_ASSET_ROLES.has(asset.role)) {
    throw new MediaAttachmentError(
      'INCOMPATIBLE_MEDIA_ASSET_ROLE',
      `Role '${asset.role}' tidak kompatibel untuk article editorial attachment.`,
      422
    );
  }

  // 4. Provenance Compatibility Guard
  if (asset.provenance_json) {
    let prov: any = {};
    try {
      prov = JSON.parse(asset.provenance_json);
    } catch (_) {
      prov = {};
    }

    // Article ID match: if provenance specifies article_id, must match target
    if (prov.article_id !== undefined && prov.article_id !== null) {
      if (Number(prov.article_id) !== article_id) {
        throw new MediaAttachmentError(
          'PROVENANCE_ARTICLE_MISMATCH',
          `Media asset '${cleanAssetId}' dibuat secara khusus untuk article_id ${prov.article_id}, tidak dapat di-attach ke article_id ${article_id}.`,
          422
        );
      }
    }

    // Slot key match: if provenance specifies slot_key, must match target slot
    if (prov.slot_key !== undefined && prov.slot_key !== null) {
      if (prov.slot_key.trim().toLowerCase() !== slot_key.trim().toLowerCase()) {
        throw new MediaAttachmentError(
          'PROVENANCE_SLOT_MISMATCH',
          `Media asset '${cleanAssetId}' dibuat secara khusus untuk slot '${prov.slot_key}', tidak dapat di-attach ke slot '${slot_key}'.`,
          422
        );
      }
    }

    // Job ID match: if client declared a job_id, verify against provenance
    if (job_id && prov.job_id && prov.job_id !== job_id) {
      throw new MediaAttachmentError(
        'PROVENANCE_JOB_MISMATCH',
        `Job ID '${job_id}' tidak cocok dengan provenance job_id '${prov.job_id}'.`,
        422
      );
    }
  }

  // 5. Active Slot Occupancy & Idempotency Check
  const editorialRole = resolveEditorialRole(slot_key);

  const existingActive = await db
    .prepare('SELECT * FROM article_media WHERE article_id = ? AND slot_key = ? AND is_active = 1 LIMIT 1')
    .bind(article_id, slot_key)
    .first();

  if (existingActive) {
    // Exact idempotent hit: same asset in same slot
    if (existingActive.asset_id === cleanAssetId) {
      return {
        status: 'success',
        attachment: {
          id: Number(existingActive.id),
          article_id: Number(existingActive.article_id),
          slot_key: existingActive.slot_key,
          asset_id: existingActive.asset_id,
          role: existingActive.role,
          is_active: Number(existingActive.is_active),
          sort_order: Number(existingActive.sort_order),
          caption: existingActive.caption,
          created_at: existingActive.created_at,
          reused_existing: true
        }
      };
    }

    // Different asset in same active slot: FAIL CLOSED
    throw new MediaAttachmentError(
      'SLOT_OCCUPIED_CONFLICT',
      `Editorial slot '${slot_key}' pada artikel ${article_id} sudah ditempati oleh asset aktif '${existingActive.asset_id}'. ` +
      `Penggantian asset memerlukan aksi replacement eksplisit.`,
      409
    );
  }

  // 6. Insert new canonical relation
  const nowIso = new Date().toISOString();
  let insertedId: number;

  try {
    const insertRes = await db
      .prepare(
        `INSERT INTO article_media (
          article_id, asset_id, role, slot_key, is_active, sort_order, caption
        ) VALUES (?, ?, ?, ?, 1, ?, ?)`
      )
      .bind(
        article_id,
        cleanAssetId,
        editorialRole,
        slot_key,
        sort_order || 0,
        caption || null
      )
      .run();

    insertedId = Number(insertRes?.meta?.last_row_id ?? insertRes?.lastInsertRowid ?? 0);
  } catch (dbErr: any) {
    const errMsg = dbErr.message || '';

    // Concurrent race resolution: another request may have inserted simultaneously
    if (errMsg.includes('UNIQUE constraint failed') || errMsg.includes('SQLITE_CONSTRAINT')) {
      const concurrentRow = await db
        .prepare('SELECT * FROM article_media WHERE article_id = ? AND slot_key = ? AND is_active = 1 LIMIT 1')
        .bind(article_id, slot_key)
        .first();

      if (concurrentRow) {
        if (concurrentRow.asset_id === cleanAssetId) {
          return {
            status: 'success',
            attachment: {
              id: Number(concurrentRow.id),
              article_id: Number(concurrentRow.article_id),
              slot_key: concurrentRow.slot_key,
              asset_id: concurrentRow.asset_id,
              role: concurrentRow.role,
              is_active: Number(concurrentRow.is_active),
              sort_order: Number(concurrentRow.sort_order),
              caption: concurrentRow.caption,
              created_at: concurrentRow.created_at,
              reused_existing: true
            }
          };
        }
        throw new MediaAttachmentError(
          'SLOT_OCCUPIED_CONFLICT',
          `Konflik konkurensi: Editorial slot '${slot_key}' telah diisi oleh asset '${concurrentRow.asset_id}'.`,
          409
        );
      }
    }

    // Fail closed preserving media_assets, R2, etc.
    throw new MediaAttachmentError(
      'DATABASE_INSERT_FAILED',
      `Gagal menyimpan relasi article_media: ${errMsg}`,
      500
    );
  }

  // 7. Audit Log in media_asset_audit (Safe metadata only, zero binary)
  try {
    const auditId = `aud_att_${cleanAssetId.substring(4)}_${Date.now()}`;
    await db
      .prepare(
        `INSERT INTO media_asset_audit (
          audit_id, asset_id, action, role, upload_id, derivative_id, transform_id, sha256, r2_key, safe_metadata_json
        ) VALUES (?, ?, 'ATTACH', ?, ?, ?, ?, ?, ?, ?)`
      )
      .bind(
        auditId,
        cleanAssetId,
        editorialRole,
        asset.upload_id || null,
        asset.derivative_id || null,
        asset.transform_id || null,
        asset.sha256,
        asset.storage_key,
        JSON.stringify({
          article_id,
          slot_key,
          job_id: job_id || null,
          attachment_id: insertedId,
          action: 'ATTACH'
        })
      )
      .run();
  } catch (auditErr: any) {
    // Non-blocking audit warning
    console.warn('Media attachment audit write warning:', auditErr.message);
  }

  return {
    status: 'success',
    attachment: {
      id: insertedId,
      article_id,
      slot_key,
      asset_id: cleanAssetId,
      role: editorialRole,
      is_active: 1,
      sort_order: sort_order || 0,
      caption: caption || null,
      created_at: nowIso,
      reused_existing: false
    }
  };
}
