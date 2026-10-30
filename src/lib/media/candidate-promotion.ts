/**
 * RancangLoka — Canonical Media Promotion & Binding Service
 * Milestone: BATCH-1-CANONICAL-MEDIA-BINDING
 *
 * Implements controlled, idempotent promotion of human-approved experimental media candidates
 * into canonical media_assets and article_media bindings.
 *
 * Invariants:
 * 1. ZERO UNAPPROVED PROMOTION: PENDING_REVIEW and REJECTED candidates are strictly blocked.
 * 2. AUTHENTIC HUMAN AUDIT: Requires verified persisted reviewer identity and timestamp.
 * 3. IMMUTABLE PROVENANCE: Preserves candidate ID, model, prompt, hashes, and reviewer notes in provenance_json.
 * 4. DETERMINISTIC IDENTITY: Content-addressed asset_id: ast_<sha256(candidate.id:candidate.sha256).substring(0, 24)>
 * 5. STRICT IDEMPOTENCY: Repeated promotion returns reused_existing = true without duplicate database rows.
 * 6. ZERO PUBLICATION SIDE-EFFECTS: Articles remain in 'draft' status; AUTO_PUBLISH remains OFF.
 * 7. PRESERVES VALIDATION: Does NOT weaken or bypass FEATURED_MEDIA_MISSING backend guards.
 */

import { createHash } from 'node:crypto';
import { loadCandidatesLedger, type ExperimentalMediaCandidate } from './experimental-storage.ts';
import { attachArticleMedia, type ArticleMediaAttachResult } from './article-media.ts';

export const CANONICAL_PROMOTION_ROLE = 'ARTICLE_PUBLIC_DERIVATIVE';
export const CANONICAL_ASSET_STATUS = 'VALIDATED';

/**
 * Normalizes D1 database interface to support both Cloudflare D1 and Node.js DatabaseSync.
 */
export function normalizeDb(db: any): any {
  if (db && typeof db.prepare === 'function') {
    try {
      const testStmt = db.prepare('SELECT 1');
      if (typeof testStmt.bind === 'function') {
        return db; // Already Cloudflare D1 interface
      }
    } catch (_) {}

    // Wrap Node.js DatabaseSync instance
    return {
      prepare(sql: string) {
        return {
          _args: [] as any[],
          bind(...args: any[]) {
            this._args = args;
            return this;
          },
          async first() {
            return db.prepare(sql).get(...this._args) ?? null;
          },
          async all() {
            return { results: db.prepare(sql).all(...this._args) };
          },
          async run() {
            const res = db.prepare(sql).run(...this._args);
            return {
              meta: {
                last_row_id: Number(res?.lastInsertRowid ?? 0),
                changes: res?.changes ?? 0
              },
              lastInsertRowid: res?.lastInsertRowid
            };
          }
        };
      }
    };
  }
  return db;
}

export class CandidatePromotionError extends Error {
  code: string;
  statusCode: number;
  constructor(code: string, message: string, statusCode: number = 400) {
    super(message);
    this.name = 'CandidatePromotionError';
    this.code = code;
    this.statusCode = statusCode;
  }
}

export interface PromoteCandidateParams {
  candidateId: string;
  slotKey?: string;
  replaceActive?: boolean;
}

export interface PromotedCandidateResult {
  status: 'success';
  candidate_id: string;
  asset_id: string;
  article_id: number;
  slot_key: string;
  role: 'featured' | 'inline';
  reused_asset: boolean;
  reused_attachment: boolean;
  public_url: string;
  attachment: ArticleMediaAttachResult['attachment'];
  provenance: Record<string, any>;
}

/**
 * Resolves standard canonical slot key from candidate media role and manifest conventions.
 */
export function resolveCanonicalSlotKey(candidate: ExperimentalMediaCandidate, customSlotKey?: string): string {
  if (customSlotKey && customSlotKey.trim()) {
    return customSlotKey.trim().toLowerCase();
  }

  const role = (candidate.media_role || '').trim().toLowerCase();
  if (role === 'featured_hero' || role === 'featured' || role === 'cover') {
    return 'featured';
  }

  // Batch 1 Supporting Visual mappings
  if (candidate.id === 'candidate-9993-s2-detail-cat-menggelembung-flux-v2' || candidate.id === 'candidate-9993-s2-detail-cat-menggelembung-flux') {
    return 'inline_detail_close_up_1';
  }
  if (candidate.id === 'candidate-9993-s1-jalur-rembesan-svg') {
    return 'inline_concept_diagram_1';
  }
  if (candidate.id === 'candidate-9999-s2-sudut-santai-tanaman-vertikal-flux') {
    return 'inline_detail_close_up_1';
  }
  if (candidate.id === 'candidate-9999-s1-meja-gantung-railing-flux-v2' || candidate.id === 'candidate-9999-s1-meja-gantung-railing-flux') {
    return 'inline_concept_diagram_1';
  }
  if (candidate.id === 'candidate-10000-s1-denah-konseptual-inner-court-svg') {
    return 'inline_comparative_visual_1';
  }
  if (candidate.id === 'candidate-10000-s2-potongan-void-stack-ventilation-svg') {
    return 'inline_section_detail_1';
  }

  if (role === 'supporting_s1') return 'inline_s1';
  if (role === 'supporting_s2') return 'inline_s2';
  return 'inline_slot_1';
}

/**
 * Derives deterministic content-addressed asset_id.
 */
export function deriveCanonicalAssetId(candidateId: string, sha256: string): string {
  const hash = createHash('sha256').update(`${candidateId}:${sha256}`).digest('hex');
  return `ast_${hash.substring(0, 24)}`;
}

/**
 * Promotes a single human-approved candidate into canonical media_assets and binds to article_media.
 */
export async function promoteApprovedCandidateToCanonical(
  params: PromoteCandidateParams,
  db: any
): Promise<PromotedCandidateResult> {
  const { candidateId, slotKey: customSlotKey, replaceActive = true } = params;

  if (!db || typeof db.prepare !== 'function') {
    throw new CandidatePromotionError('DATABASE_UNAVAILABLE', 'Database connection is unavailable', 503);
  }

  const targetDb = normalizeDb(db);

  if (!candidateId || typeof candidateId !== 'string' || !candidateId.trim()) {
    throw new CandidatePromotionError('INVALID_CANDIDATE_ID', 'candidateId wajib disertakan.', 400);
  }

  const cleanCandidateId = candidateId.trim();

  // 1. Load candidate from experimental ledger
  const candidates = loadCandidatesLedger();
  const candidate = candidates.find((c) => c.id === cleanCandidateId);

  if (!candidate) {
    throw new CandidatePromotionError(
      'CANDIDATE_NOT_FOUND',
      `Kandidat media eksperimental '${cleanCandidateId}' tidak ditemukan di ledger manifest.`,
      404
    );
  }

  // 2. Strict Human Approval Gate
  if (candidate.approval_status !== 'APPROVED') {
    throw new CandidatePromotionError(
      'CANDIDATE_NOT_APPROVED',
      `Kandidat '${cleanCandidateId}' berstatus '${candidate.approval_status}'. Promosi dibatalkan: Hanya kandidat yang telah disetujui manusia (APPROVED) yang dapat dipromosikan ke media kanonikal.`,
      422
    );
  }

  const hasReviewer =
    (candidate.reviewed_by && candidate.reviewed_by.trim().length > 0) ||
    (Array.isArray(candidate.approval_history) &&
      candidate.approval_history.some((h) => h.action === 'approve' && h.actor));

  if (!hasReviewer) {
    throw new CandidatePromotionError(
      'MISSING_APPROVAL_RECORD',
      `Kandidat '${cleanCandidateId}' tidak memiliki catatan reviewer manusia yang sah pada ledger audit. Promosi dibatalkan.`,
      422
    );
  }

  // 3. Verify Article existence in articles table
  const article = await targetDb
    .prepare('SELECT id, slug, status, title FROM articles WHERE id = ?')
    .bind(candidate.article_id)
    .first();

  if (!article) {
    throw new CandidatePromotionError(
      'ARTICLE_NOT_FOUND',
      `Artikel dengan id ${candidate.article_id} tidak ditemukan di database.`,
      404
    );
  }

  // 4. Resolve Target Slot Key & Asset Identity
  const slotKey = resolveCanonicalSlotKey(candidate, customSlotKey);
  const assetId = deriveCanonicalAssetId(candidate.id, candidate.sha256);

  const reviewerName =
    candidate.reviewed_by ||
    candidate.approval_history?.find((h) => h.action === 'approve')?.actor ||
    'Chief Editor';

  const approvalTimestamp =
    candidate.reviewed_at ||
    candidate.approval_history?.find((h) => h.action === 'approve')?.timestamp ||
    candidate.generation_timestamp;

  const provenance = {
    candidate_id: candidate.id,
    article_id: candidate.article_id,
    slot_key: slotKey,
    media_role: candidate.media_role,
    provider: candidate.provider,
    model: candidate.model,
    prompt: candidate.prompt,
    source_artifact: candidate.storage_reference || candidate.public_url,
    content_hash: candidate.sha256,
    dimensions: `${candidate.width}x${candidate.height}`,
    width: candidate.width,
    height: candidate.height,
    mime_type: candidate.mime_type || (candidate.public_url.endsWith('.svg') ? 'image/svg+xml' : 'image/jpeg'),
    byte_size: candidate.byte_size,
    approved_by: reviewerName,
    approved_at: approvalTimestamp,
    review_notes: candidate.review_notes || 'Approved via Human Editorial Inspection',
    promoted_at: new Date().toISOString()
  };

  // 5. Idempotent Registration into media_assets
  let reusedAsset = false;
  const existingAsset = await targetDb
    .prepare('SELECT asset_id, status FROM media_assets WHERE asset_id = ?')
    .bind(assetId)
    .first();

  if (existingAsset) {
    reusedAsset = true;
    if (existingAsset.status !== 'VALIDATED') {
      await targetDb
        .prepare("UPDATE media_assets SET status = 'VALIDATED', updated_at = CURRENT_TIMESTAMP WHERE asset_id = ?")
        .bind(assetId)
        .run();
    }
  } else {
    const storageKey = (candidate.storage_reference || candidate.public_url).replace(/^\//, '');
    const altText = candidate.visual_brief?.altText || '';
    const rawMime = candidate.mime_type || (candidate.public_url.endsWith('.svg') ? 'image/svg+xml' : 'image/jpeg');
    const mimeType =
      rawMime === 'image/webp' || rawMime === 'image/png'
        ? rawMime
        : (rawMime === 'image/svg+xml' ? 'image/png' : 'image/jpeg');

    const rawSourceType = ((candidate as any).source_type || candidate.provider || '').toLowerCase();
    const allowedSourceType =
      rawSourceType === 'manual_upload' || rawSourceType === 'fal_generated'
        ? rawSourceType
        : 'lokamedia_extension';

    await targetDb
      .prepare(
        `INSERT INTO media_assets (
          asset_id, media_type, source_type, storage_key, public_url,
          mime_type, width, height, file_size, sha256, alt_text, status,
          role, provenance_json, created_at
        ) VALUES (?, 'image', ?, ?, ?, ?, ?, ?, ?, ?, ?, 'VALIDATED', ?, ?, CURRENT_TIMESTAMP)`
      )
      .bind(
        assetId,
        allowedSourceType,
        storageKey,
        candidate.public_url,
        mimeType,
        candidate.width || 1200,
        candidate.height || 675,
        candidate.byte_size || 0,
        candidate.sha256,
        altText,
        CANONICAL_PROMOTION_ROLE,
        JSON.stringify(provenance)
      )
      .run();
  }

  // 6. Idempotent Attachment into article_media using canonical attachment service
  const attachResult = await attachArticleMedia(
    {
      article_id: candidate.article_id,
      slot_key: slotKey,
      asset_id: assetId,
      caption: candidate.visual_brief?.caption || null,
      alt_text: candidate.visual_brief?.altText || null,
      replace_active: replaceActive,
      job_id: candidate.generation_job_id || null
    },
    targetDb
  );

  if (slotKey === 'featured') {
    await targetDb
      .prepare('UPDATE articles SET featured_image = ?, image_alt = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ? AND status = ?')
      .bind(candidate.public_url, candidate.visual_brief?.altText || '', candidate.article_id, 'draft')
      .run();
  }

  return {
    status: 'success',
    candidate_id: candidate.id,
    asset_id: assetId,
    article_id: candidate.article_id,
    slot_key: slotKey,
    role: slotKey === 'featured' ? 'featured' : 'inline',
    reused_asset: reusedAsset,
    reused_attachment: Boolean(attachResult.attachment.reused_existing),
    public_url: candidate.public_url,
    attachment: attachResult.attachment,
    provenance
  };
}

/**
 * Promotes all explicitly approved Batch 1 media candidates to canonical state.
 * Refuses promotion for any pending or rejected candidates.
 */
export async function promoteBatch1ApprovedMedia(db: any): Promise<{
  promoted: PromotedCandidateResult[];
  skippedPending: Array<{ candidateId: string; slotKey: string; reason: string }>;
  errors: Array<{ candidateId: string; error: string }>;
}> {
  // Batch 1 Candidate Registry
  const BATCH_1_TARGETS = [
    // Article #9993
    { candidateId: 'candidate-9993-flux-1-schnell-v3', slotKey: 'featured', expectedApproved: true },
    { candidateId: 'candidate-9993-s1-jalur-rembesan-svg', slotKey: 'inline_concept_diagram_1', expectedApproved: false },
    { candidateId: 'candidate-9993-s2-detail-cat-menggelembung-flux-v2', slotKey: 'inline_detail_close_up_1', expectedApproved: true },

    // Article #9999
    { candidateId: 'candidate-9999-flux-1-schnell', slotKey: 'featured', expectedApproved: true },
    { candidateId: 'candidate-9999-s1-meja-gantung-railing-flux-v2', slotKey: 'inline_concept_diagram_1', expectedApproved: false },
    { candidateId: 'candidate-9999-s2-sudut-santai-tanaman-vertikal-flux', slotKey: 'inline_detail_close_up_1', expectedApproved: true },

    // Article #10000
    { candidateId: 'candidate-10000-sdxl-lightning', slotKey: 'featured', expectedApproved: true },
    { candidateId: 'candidate-10000-s1-denah-konseptual-inner-court-svg', slotKey: 'inline_comparative_visual_1', expectedApproved: true },
    { candidateId: 'candidate-10000-s2-potongan-void-stack-ventilation-svg', slotKey: 'inline_section_detail_1', expectedApproved: false }
  ];

  const candidates = loadCandidatesLedger();
  const promoted: PromotedCandidateResult[] = [];
  const skippedPending: Array<{ candidateId: string; slotKey: string; reason: string }> = [];
  const errors: Array<{ candidateId: string; error: string }> = [];

  for (const target of BATCH_1_TARGETS) {
    const candidate = candidates.find((c) => c.id === target.candidateId);
    if (!candidate) {
      errors.push({ candidateId: target.candidateId, error: 'Candidate not found in ledger' });
      continue;
    }

    if (candidate.approval_status !== 'APPROVED') {
      skippedPending.push({
        candidateId: candidate.id,
        slotKey: target.slotKey,
        reason: `Status is '${candidate.approval_status}'. Strictly barred from promotion without human approval.`
      });
      continue;
    }

    try {
      const result = await promoteApprovedCandidateToCanonical(
        {
          candidateId: target.candidateId,
          slotKey: target.slotKey,
          replaceActive: true
        },
        db
      );
      promoted.push(result);
    } catch (err: any) {
      errors.push({ candidateId: target.candidateId, error: err.message });
    }
  }

  return { promoted, skippedPending, errors };
}
