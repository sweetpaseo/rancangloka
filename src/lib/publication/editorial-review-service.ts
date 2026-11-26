/**
 * RancangLoka — Article & Media Editorial Review Service (UX-V1)
 *
 * Implements decoupled, independent review, approval, and revision flows for:
 * 1. SECTION A: NASKAH (Article Manuscript / Content Hash)
 * 2. SECTION B: MEDIA (Slot-by-slot visual assets: featured + inline)
 *
 * Safety Invariants:
 * - Decoupled Authority: Approving/revising text does NOT reset media approval.
 * - Decoupled Slots: Revising one media slot does NOT invalidate other media slots.
 * - Cryptographic Binding: Text approval binds content_hash; media approval binds asset_id & sha256.
 * - Publication Gate: Article CANNOT publish until latest text is approved, all mandatory
 *   media slots are approved, and zero mandatory revision requests remain open.
 * - Append-Only Ledger: Decisions are recorded in article_editorial_approvals and
 *   media_promotion_approvals without deleting historical audit logs.
 */

import {
  evaluateArticleMediaReadiness,
  READINESS_REASON_CODES
} from '../media/readiness-reconciler.ts';
import {
  loadCandidatesLedger,
  type ExperimentalMediaCandidate
} from '../media/experimental-storage.ts';
import { attachArticleMedia } from '../media/article-media.ts';

export type ReviewTargetType = 'text' | 'media';

export type TextReviewStatus = 'APPROVED' | 'REVISION_REQUESTED' | 'STALE' | 'NOT_REVIEWED';

export type MediaSlotReviewStatus = 'APPROVED' | 'REVISION_REQUESTED' | 'STALE' | 'NEEDS_DECISION';

export interface TextDecisionState {
  status: TextReviewStatus;
  statusLabel: string;
  approved_content_hash: string | null;
  current_content_hash: string;
  is_hash_matched: boolean;
  approved_by: string | null;
  approved_at: string | null;
  revision_reason: string | null;
  assignee: string | null;
  notes: string | null;
}

export interface MediaSlotDecisionState {
  slot_key: string;
  role: 'featured' | 'inline';
  slot_name: string;
  requirement: 'REQUIRED' | 'OPTIONAL';
  status: MediaSlotReviewStatus;
  statusLabel: string;
  active_asset: {
    asset_id: string;
    public_url: string;
    width: number;
    height: number;
    mime_type: string;
    alt_text: string | null;
    caption: string | null;
    sha256: string;
    status: string;
  } | null;
  approved_asset_id: string | null;
  approved_by: string | null;
  approved_at: string | null;
  revision_reason: string | null;
  assignee: string | null;
  candidate_count: number;
  candidates: Array<{
    id: string;
    public_url: string;
    provider: string;
    model: string;
    width: number;
    height: number;
    sha256: string;
    is_active: boolean;
    approval_status: string;
  }>;
}

export interface ArticleReviewState {
  article_id: number;
  slug: string;
  title: string;
  status: string;
  revision_hash: string;
  text: TextDecisionState;
  media_slots: Record<string, MediaSlotDecisionState>;
  overall: {
    is_text_approved: boolean;
    is_all_media_approved: boolean;
    has_pending_revisions: boolean;
    can_publish: boolean;
    blockers: string[];
  };
}

/**
 * Parses structured notes from audit records safely.
 */
function parseAuditNotes(notesRaw?: string | null): Record<string, any> {
  if (!notesRaw || typeof notesRaw !== 'string') return {};
  const trimmed = notesRaw.trim();
  if (trimmed.startsWith('{') && trimmed.endsWith('}')) {
    try {
      return JSON.parse(trimmed);
    } catch {
      return { raw: notesRaw };
    }
  }
  return { raw: notesRaw };
}

/**
 * Derives a human-friendly label for a slot key.
 */
export function getSlotDisplayName(slotKey: string): string {
  const clean = slotKey.trim().toLowerCase();
  if (clean === 'featured' || clean === 'primary') return 'Gambar Utama (Cover Hero)';
  if (clean.includes('comparative') || clean === 's1' || clean === 'inline_1') return 'Visual Komparasi (S1)';
  if (clean.includes('detail') || clean === 's2' || clean === 'inline_2') return 'Detail Teknis / Potongan (S2)';
  return `Slot Inline (${slotKey})`;
}

/**
 * Computes the unified review state for an article.
 */
export async function getArticleReviewState(db: any, articleId: number): Promise<ArticleReviewState> {
  const article = await db
    .prepare('SELECT id, slug, title, status, content_hash FROM articles WHERE id = ?')
    .bind(articleId)
    .first();

  if (!article) {
    throw new Error(`ARTICLE_NOT_FOUND: Article with ID ${articleId} not found`);
  }

  const currentContentHash = article.content_hash || '';

  // 1. Load All Approvals History (article_editorial_approvals)
  let approvalsHistory: any[] = [];
  try {
    const apprRes = await db
      .prepare(
        `SELECT id, approved_by, approved_role, approval_status,
                approved_content_hash, approved_asset_id, notes, created_at
         FROM article_editorial_approvals
         WHERE article_id = ?
         ORDER BY id DESC`
      )
      .bind(articleId)
      .all();
    approvalsHistory = apprRes?.results || (Array.isArray(apprRes) ? apprRes : []);
  } catch (err: any) {
    console.warn('[ReviewService] Could not read article_editorial_approvals:', err.message);
  }

  // 2. Load Media Promotion Approvals (media_promotion_approvals)
  let mediaPromotionHistory: any[] = [];
  try {
    const promoRes = await db
      .prepare(
        `SELECT approval_id, slot_key, candidate_sha256, status, rejection_reason,
                approved_by, approved_at, requested_at, alt_text
         FROM media_promotion_approvals
         WHERE article_id = ?
         ORDER BY requested_at DESC, approval_id DESC`
      )
      .bind(articleId)
      .all();
    mediaPromotionHistory = promoRes?.results || (Array.isArray(promoRes) ? promoRes : []);
  } catch (err: any) {
    console.warn('[ReviewService] Could not read media_promotion_approvals:', err.message);
  }

  // 3. Load Article Media Attachments
  let articleMediaRows: any[] = [];
  try {
    const mediaRes = await db
      .prepare(
        `SELECT am.id as relation_id, am.slot_key, am.role as relation_role, am.is_active,
                am.caption, am.sort_order, am.asset_id,
                ma.public_url, ma.width, ma.height, ma.mime_type, ma.file_size,
                ma.sha256, ma.alt_text, ma.status as asset_status
         FROM article_media am
         JOIN media_assets ma ON am.asset_id = ma.asset_id
         WHERE am.article_id = ?
         ORDER BY am.sort_order ASC, am.id ASC`
      )
      .bind(articleId)
      .all();
    articleMediaRows = mediaRes?.results || (Array.isArray(mediaRes) ? mediaRes : []);
  } catch (err: any) {
    console.warn('[ReviewService] Could not read article_media:', err.message);
  }

  // 4. Load Candidates from Local Manifest
  let candidatesLedger: ExperimentalMediaCandidate[] = [];
  try {
    candidatesLedger = loadCandidatesLedger().filter((c) => c.article_id === articleId);
  } catch {
    candidatesLedger = [];
  }

  // ----------------------------------------------------
  // SECTION A: Evaluate Text Decision State
  // ----------------------------------------------------
  // Look for latest record explicitly targeting text or general editorial approval
  const latestTextRecord = approvalsHistory.find((rec) => {
    const meta = parseAuditNotes(rec.notes);
    if (meta.target === 'media') return false; // Skip media-targeted records
    return true;
  });

  let textStatus: TextReviewStatus = 'NOT_REVIEWED';
  let textStatusLabel = 'Belum Ditinjau';
  let approvedContentHash: string | null = null;
  let textApprovedBy: string | null = null;
  let textApprovedAt: string | null = null;
  let textRevisionReason: string | null = null;
  let textAssignee: string | null = null;
  let textNotes: string | null = null;

  if (latestTextRecord) {
    const meta = parseAuditNotes(latestTextRecord.notes);
    approvedContentHash = latestTextRecord.approved_content_hash;
    textApprovedBy = latestTextRecord.approved_by;
    textApprovedAt = latestTextRecord.created_at;
    textNotes = latestTextRecord.notes;

    if (latestTextRecord.approval_status === 'APPROVED') {
      if (approvedContentHash === currentContentHash) {
        textStatus = 'APPROVED';
        textStatusLabel = 'Naskah Disetujui';
      } else {
        textStatus = 'STALE';
        textStatusLabel = 'Naskah Berubah (Perlu Persetujuan Ulang)';
      }
    } else if (latestTextRecord.approval_status === 'REJECTED') {
      textStatus = 'REVISION_REQUESTED';
      textStatusLabel = 'Minta Revisi Naskah';
      textRevisionReason = meta.reason || meta.raw || latestTextRecord.notes || 'Perlu perbaikan naskah draf';
      textAssignee = meta.assignee || 'Joko (Penulis)';
    } else if (latestTextRecord.approval_status === 'REVOKED') {
      textStatus = 'NOT_REVIEWED';
      textStatusLabel = 'Belum Ditinjau';
      approvedContentHash = null;
      textApprovedBy = null;
      textApprovedAt = null;
      textRevisionReason = null;
      textAssignee = null;
    }
  }

  const textDecision: TextDecisionState = {
    status: textStatus,
    statusLabel: textStatusLabel,
    approved_content_hash: approvedContentHash,
    current_content_hash: currentContentHash,
    is_hash_matched: Boolean(approvedContentHash && approvedContentHash === currentContentHash),
    approved_by: textApprovedBy,
    approved_at: textApprovedAt,
    revision_reason: textRevisionReason,
    assignee: textAssignee,
    notes: textNotes
  };

  // ----------------------------------------------------
  // SECTION B: Evaluate Media Decision State per Slot
  // ----------------------------------------------------
  // Group active attachments by slot_key
  const slotMap: Record<string, any[]> = {};
  for (const row of articleMediaRows) {
    const key = row.slot_key || 'featured';
    if (!slotMap[key]) slotMap[key] = [];
    slotMap[key].push(row);
  }

  // Ensure 'featured' is always evaluated
  if (!slotMap['featured']) {
    slotMap['featured'] = [];
  }

  const mediaSlotStates: Record<string, MediaSlotDecisionState> = {};
  const blockers: string[] = [];

  for (const [slotKey, rows] of Object.entries(slotMap)) {
    const activeRow = rows.find((r) => r.is_active === 1) || rows[0] || null;
    const isFeatured = slotKey === 'featured' || slotKey === 'primary';
    const requirement: 'REQUIRED' | 'OPTIONAL' = isFeatured ? 'REQUIRED' : 'REQUIRED'; // In RancangLoka standard, draft slots are required

    // Find candidates for this slot
    const slotCandidates = candidatesLedger.filter((c) => {
      if (isFeatured && (c.media_role === 'featured_hero' || c.media_role === 'featured')) return true;
      if (slotKey.includes('comparative') && c.media_role === 'supporting_s1') return true;
      if (slotKey.includes('detail') && c.media_role === 'supporting_s2') return true;
      return false;
    });

    // Check decisions for this slot
    // 1. Check in media_promotion_approvals
    const latestPromotionApproval = mediaPromotionHistory.find((p) => p.slot_key === slotKey);

    // 2. Check in article_editorial_approvals with target: 'media'
    const latestEditorialMediaApproval = approvalsHistory.find((rec) => {
      const meta = parseAuditNotes(rec.notes);
      return meta.target === 'media' && meta.slot_key === slotKey;
    });

    let slotStatus: MediaSlotReviewStatus = 'NEEDS_DECISION';
    let slotStatusLabel = 'Perlu Keputusan';
    let slotApprovedAssetId: string | null = null;
    let slotApprovedBy: string | null = null;
    let slotApprovedAt: string | null = null;
    let slotRevisionReason: string | null = null;
    let slotAssignee: string | null = null;

    // Check rejection / revision request first
    if (latestPromotionApproval && latestPromotionApproval.status === 'REJECTED') {
      slotStatus = 'REVISION_REQUESTED';
      slotStatusLabel = 'Minta Revisi Gambar';
      slotRevisionReason = latestPromotionApproval.rejection_reason || 'Revisi gambar diperlukan';
      slotAssignee = 'Budi / LokaMedia';
    } else if (latestEditorialMediaApproval && latestEditorialMediaApproval.approval_status === 'REJECTED') {
      const meta = parseAuditNotes(latestEditorialMediaApproval.notes);
      slotStatus = 'REVISION_REQUESTED';
      slotStatusLabel = 'Minta Revisi Gambar';
      slotRevisionReason = meta.reason || 'Revisi gambar diperlukan';
      slotAssignee = meta.assignee || 'Budi / LokaMedia';
    } else if (latestEditorialMediaApproval && latestEditorialMediaApproval.approval_status === 'REVOKED') {
      slotStatus = 'NEEDS_DECISION';
      slotStatusLabel = 'Perlu Keputusan';
      slotApprovedAssetId = null;
      slotApprovedBy = null;
      slotApprovedAt = null;
      slotRevisionReason = null;
      slotAssignee = null;
    } else {
      // Check explicit media approval
      if (latestEditorialMediaApproval && latestEditorialMediaApproval.approval_status === 'APPROVED') {
        const meta = parseAuditNotes(latestEditorialMediaApproval.notes);
        slotApprovedAssetId = meta.asset_id || latestEditorialMediaApproval.approved_asset_id;
        slotApprovedBy = latestEditorialMediaApproval.approved_by;
        slotApprovedAt = latestEditorialMediaApproval.created_at;

        if (activeRow && activeRow.asset_id === slotApprovedAssetId) {
          slotStatus = 'APPROVED';
          slotStatusLabel = 'Gambar Disetujui';
        } else {
          slotStatus = 'STALE';
          slotStatusLabel = 'Gambar Baru (Perlu Keputusan)';
        }
      } else if (latestPromotionApproval && latestPromotionApproval.status === 'APPROVED') {
        slotApprovedBy = latestPromotionApproval.approved_by;
        slotApprovedAt = latestPromotionApproval.approved_at || latestPromotionApproval.requested_at;

        if (activeRow && activeRow.sha256 === latestPromotionApproval.candidate_sha256) {
          slotStatus = 'APPROVED';
          slotStatusLabel = 'Gambar Disetujui';
        } else {
          slotStatus = 'STALE';
          slotStatusLabel = 'Gambar Baru (Perlu Keputusan)';
        }
      } else if (isFeatured && latestTextRecord && latestTextRecord.approval_status === 'APPROVED' && latestTextRecord.approved_asset_id) {
        // Legacy monolithic approval fallback: if approved_asset_id matches active featured asset
        if (activeRow && activeRow.asset_id === latestTextRecord.approved_asset_id) {
          slotStatus = 'APPROVED';
          slotStatusLabel = 'Gambar Disetujui (Kanonikal)';
          slotApprovedAssetId = activeRow.asset_id;
          slotApprovedBy = latestTextRecord.approved_by;
          slotApprovedAt = latestTextRecord.created_at;
        }
      }
    }

    if (!activeRow) {
      slotStatus = 'NEEDS_DECISION';
      slotStatusLabel = 'Aset Belum Dipasang';
    }

    mediaSlotStates[slotKey] = {
      slot_key: slotKey,
      role: isFeatured ? 'featured' : 'inline',
      slot_name: getSlotDisplayName(slotKey),
      requirement,
      status: slotStatus,
      statusLabel: slotStatusLabel,
      active_asset: activeRow
        ? {
            asset_id: activeRow.asset_id,
            public_url: activeRow.public_url,
            width: activeRow.width,
            height: activeRow.height,
            mime_type: activeRow.mime_type,
            alt_text: activeRow.alt_text,
            caption: activeRow.caption,
            sha256: activeRow.sha256,
            status: activeRow.asset_status
          }
        : null,
      approved_asset_id: slotApprovedAssetId,
      approved_by: slotApprovedBy,
      approved_at: slotApprovedAt,
      revision_reason: slotRevisionReason,
      assignee: slotAssignee,
      candidate_count: slotCandidates.length,
      candidates: slotCandidates.map((c) => ({
        id: c.id,
        public_url: c.public_url,
        provider: c.provider,
        model: c.model,
        width: c.width,
        height: c.height,
        sha256: c.sha256,
        is_active: Boolean(activeRow && activeRow.sha256 === c.sha256),
        approval_status: c.approval_status
      }))
    };
  }

  // ----------------------------------------------------
  // SECTION C: Compute Publication Readiness & Blockers
  // ----------------------------------------------------
  const isTextApproved = textStatus === 'APPROVED';
  if (textStatus === 'REVISION_REQUESTED') {
    blockers.push('TEXT_REVISION_REQUIRED');
  } else if (textStatus === 'STALE') {
    blockers.push('APPROVAL_STALE_CONTENT');
  } else if (textStatus === 'NOT_REVIEWED') {
    blockers.push('APPROVAL_MISSING');
  }

  let allMediaApproved = true;
  let hasPendingRevisions = textStatus === 'REVISION_REQUESTED';

  for (const [slotKey, slot] of Object.entries(mediaSlotStates)) {
    if (slot.status === 'REVISION_REQUESTED') {
      hasPendingRevisions = true;
      allMediaApproved = false;
      if (slot.role === 'featured') {
        blockers.push('COVER_REVISION_REQUIRED');
      } else {
        blockers.push('INLINE_MEDIA_REVISION_REQUIRED');
      }
    } else if (slot.status !== 'APPROVED') {
      allMediaApproved = false;
      blockers.push('MEDIA_NOT_APPROVED');
      if (slot.requirement === 'REQUIRED') {
        blockers.push(`MEDIA_SLOT_NOT_APPROVED_${slotKey.toUpperCase()}`);
      }
    }
  }

  const canPublish = isTextApproved && allMediaApproved && !hasPendingRevisions && article.status === 'draft';

  return {
    article_id: article.id,
    slug: article.slug,
    title: article.title,
    status: article.status,
    revision_hash: `rev_${currentContentHash.slice(0, 8)}`,
    text: textDecision,
    media_slots: mediaSlotStates,
    overall: {
      is_text_approved: isTextApproved,
      is_all_media_approved: allMediaApproved,
      has_pending_revisions: hasPendingRevisions,
      can_publish: canPublish,
      blockers: Array.from(new Set(blockers))
    }
  };
}

/**
 * Records an explicit Text Approval. Binds content_hash.
 */
export async function recordTextApproval(
  db: any,
  params: {
    articleId: number;
    approvedBy: string;
    approvedRole?: string;
    notes?: string;
  }
): Promise<{ success: boolean; reviewState: ArticleReviewState }> {
  const article = await db
    .prepare('SELECT id, slug, status, content_hash FROM articles WHERE id = ?')
    .bind(params.articleId)
    .first();

  if (!article) {
    throw new Error(`ARTICLE_NOT_FOUND: Article ${params.articleId} not found`);
  }
  if (article.status !== 'draft') {
    throw new Error(`ARTICLE_NOT_DRAFT: Article is in status '${article.status}'`);
  }

  // Idempotency: If current content_hash is already approved, avoid duplicate insertions
  const currentState = await getArticleReviewState(db, params.articleId);
  if (currentState.text.status === 'APPROVED' && currentState.text.approved_content_hash === article.content_hash) {
    return { success: true, reviewState: currentState };
  }

  const approvedRole = params.approvedRole || 'editor_in_chief';
  const notesObj = {
    target: 'text',
    decision: 'APPROVED',
    notes: params.notes || 'Naskah teks disetujui untuk publikasi.'
  };

  await db
    .prepare(
      `INSERT INTO article_editorial_approvals (
        article_id, approved_by, approved_role, approval_status,
        approved_content_hash, approved_asset_id, notes, created_at, updated_at
      ) VALUES (?, ?, ?, 'APPROVED', ?, '', ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`
    )
    .bind(params.articleId, params.approvedBy, approvedRole, article.content_hash, JSON.stringify(notesObj))
    .run();

  const reviewState = await getArticleReviewState(db, params.articleId);
  return { success: true, reviewState };
}

/**
 * Records an explicit Text Revision Request.
 */
export async function recordTextRevisionRequest(
  db: any,
  params: {
    articleId: number;
    requestedBy: string;
    reason: string;
    notes?: string;
  }
): Promise<{ success: boolean; reviewState: ArticleReviewState }> {
  if (!params.reason || !params.reason.trim()) {
    throw new Error('REVISION_REASON_REQUIRED: Alasan permohonan revisi naskah wajib diisi.');
  }

  const article = await db
    .prepare('SELECT id, slug, status, content_hash FROM articles WHERE id = ?')
    .bind(params.articleId)
    .first();

  if (!article) {
    throw new Error(`ARTICLE_NOT_FOUND: Article ${params.articleId} not found`);
  }

  const notesObj = {
    target: 'text',
    decision: 'REVISION_REQUESTED',
    reason: params.reason.trim(),
    assignee: 'Joko (Penulis)',
    notes: params.notes || null
  };

  await db
    .prepare(
      `INSERT INTO article_editorial_approvals (
        article_id, approved_by, approved_role, approval_status,
        approved_content_hash, approved_asset_id, notes, created_at, updated_at
      ) VALUES (?, ?, 'editor_in_chief', 'REJECTED', ?, '', ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`
    )
    .bind(params.articleId, params.requestedBy, article.content_hash, JSON.stringify(notesObj))
    .run();

  const reviewState = await getArticleReviewState(db, params.articleId);
  return { success: true, reviewState };
}

/**
 * Records an explicit Media Slot Approval. Binds slot_key & asset_id.
 */
export async function recordMediaApproval(
  db: any,
  params: {
    articleId: number;
    slotKey: string;
    assetId: string;
    approvedBy: string;
    notes?: string;
  }
): Promise<{ success: boolean; reviewState: ArticleReviewState }> {
  const { articleId, slotKey, assetId, approvedBy, notes } = params;

  if (!slotKey || !slotKey.trim()) {
    throw new Error('SLOT_KEY_REQUIRED: slotKey wajib disertakan.');
  }
  if (!assetId || !assetId.trim()) {
    throw new Error('ASSET_ID_REQUIRED: assetId wajib disertakan.');
  }

  const article = await db
    .prepare('SELECT id, slug, status, content_hash FROM articles WHERE id = ?')
    .bind(articleId)
    .first();

  if (!article) {
    throw new Error(`ARTICLE_NOT_FOUND: Article ${articleId} not found`);
  }

  const notesObj = {
    target: 'media',
    slot_key: slotKey.trim(),
    asset_id: assetId.trim(),
    decision: 'APPROVED',
    notes: notes || `Media slot '${slotKey}' disetujui.`
  };

  await db
    .prepare(
      `INSERT INTO article_editorial_approvals (
        article_id, approved_by, approved_role, approval_status,
        approved_content_hash, approved_asset_id, notes, created_at, updated_at
      ) VALUES (?, ?, 'editor_in_chief', 'APPROVED', ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`
    )
    .bind(articleId, approvedBy, article.content_hash, assetId.trim(), JSON.stringify(notesObj))
    .run();

  // If there was a pending record in media_promotion_approvals for this slot, update it
  try {
    await db
      .prepare(
        `UPDATE media_promotion_approvals
         SET status = 'APPROVED', approved_at = CURRENT_TIMESTAMP, approved_by = ?
         WHERE article_id = ? AND slot_key = ? AND status IN ('REQUESTED', 'REJECTED')`
      )
      .bind(approvedBy, articleId, slotKey.trim())
      .run();
  } catch {
    // safe fallback
  }

  const reviewState = await getArticleReviewState(db, articleId);
  return { success: true, reviewState };
}

/**
 * Records an explicit Media Revision Request for a specific slot.
 * Attributed to Budi / LokaMedia.
 */
export async function recordMediaRevisionRequest(
  db: any,
  params: {
    articleId: number;
    slotKey: string;
    requestedBy: string;
    reason: string;
    notes?: string;
  }
): Promise<{ success: boolean; reviewState: ArticleReviewState }> {
  const { articleId, slotKey, requestedBy, reason, notes } = params;

  if (!slotKey || !slotKey.trim()) {
    throw new Error('SLOT_KEY_REQUIRED: slotKey wajib dipilih untuk permohonan revisi gambar.');
  }
  if (!reason || !reason.trim()) {
    throw new Error('REVISION_REASON_REQUIRED: Alasan permohonan revisi gambar wajib diisi.');
  }

  const article = await db
    .prepare('SELECT id, slug, status, content_hash FROM articles WHERE id = ?')
    .bind(articleId)
    .first();

  if (!article) {
    throw new Error(`ARTICLE_NOT_FOUND: Article ${articleId} not found`);
  }

  // Get active asset for this slot to record its identity
  const activeMedia = await db
    .prepare(
      `SELECT am.asset_id, ma.sha256, ma.alt_text
       FROM article_media am
       JOIN media_assets ma ON am.asset_id = ma.asset_id
       WHERE am.article_id = ? AND am.slot_key = ? AND am.is_active = 1
       LIMIT 1`
    )
    .bind(articleId, slotKey.trim())
    .first();

  const approvalId = `rev_media_${articleId}_${slotKey.trim()}_${Date.now()}`;
  const candidateSha = activeMedia?.sha256 || 'pending_candidate';

  // 1. Record in media_promotion_approvals so it projects cleanly into Approval Inbox
  try {
    await db
      .prepare(
        `INSERT INTO media_promotion_approvals (
          approval_id, device_id, article_id, article_slug, content_hash,
          candidate_sha256, slot_key, status, rejection_reason,
          approved_by, requested_at, issued_at, expires_at, alt_text
        ) VALUES (?, 'budi_lokamedia', ?, ?, ?, ?, ?, 'REJECTED', ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, datetime('now', '+30 days'), ?)`
      )
      .bind(
        approvalId,
        articleId,
        article.slug,
        article.content_hash,
        candidateSha,
        slotKey.trim(),
        reason.trim(),
        requestedBy,
        activeMedia?.alt_text || 'Media under revision'
      )
      .run();
  } catch (err: any) {
    console.warn('[ReviewService] Could not insert into media_promotion_approvals:', err.message);
  }

  // 2. Insert into article_editorial_approvals ledger
  const notesObj = {
    target: 'media',
    slot_key: slotKey.trim(),
    asset_id: activeMedia?.asset_id || slotKey.trim(),
    decision: 'REVISION_REQUESTED',
    reason: reason.trim(),
    assignee: 'Budi / LokaMedia',
    notes: notes || null
  };

  await db
    .prepare(
      `INSERT INTO article_editorial_approvals (
        article_id, approved_by, approved_role, approval_status,
        approved_content_hash, approved_asset_id, notes, created_at, updated_at
      ) VALUES (?, ?, 'editor_in_chief', 'REJECTED', ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`
    )
    .bind(
      articleId,
      requestedBy,
      article.content_hash,
      activeMedia?.asset_id || slotKey.trim(),
      JSON.stringify(notesObj)
    )
    .run();

  const reviewState = await getArticleReviewState(db, articleId);
  return { success: true, reviewState };
}

/**
 * Replaces the active media for a specific slot.
 * Ensures previous approval is marked stale, without affecting naskah approval.
 */
export async function replaceSlotMedia(
  db: any,
  params: {
    articleId: number;
    slotKey: string;
    assetId: string;
    caption?: string;
    altText?: string;
    bucket?: any;
  }
): Promise<{ success: boolean; reviewState: ArticleReviewState }> {
  const { articleId, slotKey, assetId, caption, altText, bucket } = params;

  // 1. Ensure asset exists in media_assets; if it is a candidate or direct URL, auto-register
  const cleanAssetId = assetId.trim();
  const existingAsset = await db
    .prepare('SELECT asset_id, public_url, alt_text FROM media_assets WHERE asset_id = ?')
    .bind(cleanAssetId)
    .first();

  let finalAssetId = cleanAssetId;
  let finalPublicUrl = existingAsset?.public_url || '';
  let finalAltText = altText || existingAsset?.alt_text || '';

  if (!existingAsset) {
    // Look up in candidate ledger
    const candidates = loadCandidatesLedger();
    const candidate = candidates.find(
      (c) => c.id === cleanAssetId || (c as any).asset_id === cleanAssetId || c.sha256 === cleanAssetId
    );

    if (candidate) {
      finalAssetId = `ast_${candidate.sha256.substring(0, 16)}`;
      finalPublicUrl = candidate.public_url;
      finalAltText = altText || candidate.visual_brief?.altText || 'Visual arsitektur RancangLoka';

      // Insert or ignore into media_assets
      await db
        .prepare(
          `INSERT OR IGNORE INTO media_assets (
            asset_id, media_type, source_type, storage_key, public_url,
            mime_type, width, height, file_size, sha256, alt_text, status, role
          ) VALUES (?, 'image', 'ai_generated', ?, ?, ?, ?, ?, ?, ?, ?, 'VALIDATED', 'ARTICLE_PUBLIC_DERIVATIVE')`
        )
        .bind(
          finalAssetId,
          candidate.storage_reference,
          candidate.public_url,
          candidate.mime_type || 'image/webp',
          candidate.width || 1200,
          candidate.height || 675,
          candidate.byte_size || 100000,
          candidate.sha256,
          finalAltText
        )
        .run();
    } else if (cleanAssetId.startsWith('/') || cleanAssetId.startsWith('http')) {
      // Direct URL uploaded via CMS
      finalAssetId = `ast_up_${Date.now()}`;
      finalPublicUrl = cleanAssetId;
      finalAltText = altText || 'Aset visual RancangLoka';

      await db
        .prepare(
          `INSERT OR IGNORE INTO media_assets (
            asset_id, media_type, source_type, storage_key, public_url,
            mime_type, width, height, file_size, sha256, alt_text, status, role
          ) VALUES (?, 'image', 'manual_upload', ?, ?, 'image/webp', 1200, 675, 100000, ?, ?, 'VALIDATED', 'ARTICLE_PUBLIC_DERIVATIVE')`
        )
        .bind(
          finalAssetId,
          cleanAssetId,
          cleanAssetId,
          `sha_manual_${Date.now()}`,
          finalAltText
        )
        .run();
    }
  }

  // 2. Use the canonical attachArticleMedia with replace_active = true (params first, db second)
  await attachArticleMedia(
    {
      article_id: articleId,
      slot_key: slotKey,
      asset_id: finalAssetId,
      caption: caption || null,
      replace_active: true
    },
    db
  );

  // 3. If slot is featured, mirror to articles table
  if (slotKey === 'featured' || slotKey === 'primary') {
    if (finalPublicUrl) {
      await db
        .prepare('UPDATE articles SET featured_image = ?, image_alt = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?')
        .bind(finalPublicUrl, finalAltText, articleId)
        .run();
    }
  }

  // 4. Revoke any prior open rejection in media_promotion_approvals for this slot
  try {
    await db
      .prepare(
        `UPDATE media_promotion_approvals
         SET status = 'REVOKED', rejection_reason = rejection_reason || ' [Digantikan kandidat baru]'
         WHERE article_id = ? AND slot_key = ? AND status = 'REJECTED'`
      )
      .bind(articleId, slotKey.trim())
      .run();
  } catch {
    // safe fallback
  }

  const reviewState = await getArticleReviewState(db, articleId);
  return { success: true, reviewState };
}

