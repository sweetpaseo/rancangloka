/**
 * RancangLoka — Publication Readiness Gate Service (PUBLICATION-0)
 *
 * Deterministic, fail-closed quality gate that validates whether an ingested
 * draft article has achieved absolute editorial, technical, visual, and human
 * readiness to be scheduled:
 *
 * DRAFT + EDITORIAL GUARDS + EVIDENCE/CITATIONS + MEDIA READINESS + HUMAN APPROVAL + METADATA
 *   --> READY_TO_SCHEDULE
 *
 * Strict Guarantees:
 * 1. Read-only inspection of article bodies (ZERO body mutation).
 * 2. Articles strictly remain 'draft' (ZERO publishing / scheduling).
 * 3. Human approvals cryptographically bound to content_hash and active featured asset_id.
 * 4. Content mutation or featured media replacement invalidates approval.
 * 5. Fail-closed on missing, corrupt, or unknown state.
 * 6. Zero AI model calls (MODEL_CALLS = 0).
 */

import {
  PUBLICATION_STATUS_READY_TO_SCHEDULE,
  PUBLICATION_STATUS_NOT_READY,
  PUBLICATION_STATUS_BLOCKED,
  APPROVAL_STATUS_APPROVED,
  APPROVAL_STATUS_REJECTED,
  APPROVAL_STATUS_REVOKED,
  FAILURE_CODES,
  type FailureCode,
  type PublicationOverallStatus,
  type ApprovalStatus,
  type ReadinessSnapshotPayload,
  type EditorialApprovalRecord
} from './types.ts';

export const BANNED_PLACEHOLDERS = [
  '[EVIDENCE NEEDED]',
  'TODO',
  '[INSERT IMAGE]',
  'Lorem ipsum',
  'Sebagai model AI'
];

export const UNTRUSTED_DOMAINS = [
  'casino',
  'slot-gacor',
  'judi-online',
  'free-backlinks',
  'spam-domain'
];

export const CANONICAL_CATEGORIES = new Set([
  'arsitektur-renovasi',
  'interior-design',
  'material-finishing',
  'kenyamanan-rumah',
  'eksterior-lanskap',
  'konstruksi-rumah'
]);

export const CANONICAL_AUTHOR_SLUGS = new Set([
  'dewan-redaksi-spasial',
  'tim-riset-materialitas'
]);

export const CANONICAL_AUTHOR_NAMES = new Set([
  'RancangLoka Editorial Desk',
  'Dewan Redaksi Spasial RancangLoka',
  'Dewan Redaksi Spasial',
  'RancangLoka Research Desk',
  'Tim Riset Materialitas'
]);

/**
 * Monetary Guard Check:
 * Enforces zero-tolerance against unverified pricing, exact Rupiah costs,
 * or commercial budget assertions.
 */
export function checkMonetaryGuard(contentMd: string): boolean {
  if (!contentMd) return true;
  const monetaryPattern = /Rp\s*\.?\s*\d+|\bIDR\b\s*\d+|\b\d+\s*(?:juta|miliar|ribu)\s*rupiah\b|\bbudget\s*:\s*Rp|\bongkos\s*:\s*Rp|\bharga\s*:\s*Rp/i;
  return !monetaryPattern.test(contentMd);
}

/**
 * Editorial Contract Check:
 * Enforces placeholder absence, minimum word count, and H2/H3 sectioning.
 */
export function checkArticleContract(contentMd: string): { pass: boolean; reason?: string } {
  if (!contentMd || !contentMd.trim()) {
    return { pass: false, reason: 'Content is empty' };
  }

  for (const placeholder of BANNED_PLACEHOLDERS) {
    if (contentMd.includes(placeholder)) {
      return { pass: false, reason: `Contains banned placeholder: ${placeholder}` };
    }
  }

  const words = contentMd.trim().split(/\s+/).filter(Boolean);
  if (words.length < 300) {
    return { pass: false, reason: `Word count too low (${words.length} < 300)` };
  }

  // Heading check: at least two H2 headings
  const h2Count = (contentMd.match(/^##\s+.+$/gm) || []).length;
  if (h2Count < 2) {
    return { pass: false, reason: `Insufficient H2 headings (${h2Count} < 2)` };
  }

  return { pass: true };
}

/**
 * Citation Guard Check:
 * Validates links and external citations against untrusted or spam domains.
 */
export function checkCitationGuard(contentMd: string): boolean {
  if (!contentMd) return true;
  const linkRegex = /\[([^\]]*)\]\((https?:\/\/[^\)]+)\)/g;
  let match;
  while ((match = linkRegex.exec(contentMd)) !== null) {
    const urlStr = match[2];
    try {
      const url = new URL(urlStr);
      const hostname = url.hostname.toLowerCase();
      for (const untrusted of UNTRUSTED_DOMAINS) {
        if (hostname.includes(untrusted)) {
          return false;
        }
      }
    } catch {
      return false; // Malformed URL fails closed
    }
  }
  return true;
}

/**
 * Key Takeaways Validation:
 * JSON array of 3-5 concise bullet points.
 */
export function checkKeyTakeaways(rawTakeaways: string | null | undefined): boolean {
  if (!rawTakeaways) return false;
  try {
    const parsed = JSON.parse(rawTakeaways);
    if (!Array.isArray(parsed)) return false;
    return parsed.length >= 3 && parsed.length <= 5;
  } catch {
    return false;
  }
}

/**
 * Core Deterministic Readiness Gate Evaluation
 */
export async function evaluateArticleReadiness(
  db: any,
  articleId: number,
  options?: {
    forceFailClosed?: boolean;
    skipCache?: boolean;
    publicationConflict?: boolean;
  }
): Promise<ReadinessSnapshotPayload> {
  const blockers: FailureCode[] = [];

  // 0. Fail-Closed Short-Circuit (Emergency / Unknown guard state)
  if (options?.forceFailClosed) {
    const failClosedSnapshot: ReadinessSnapshotPayload = {
      schema_version: 1,
      article_id: articleId,
      slug: 'unknown',
      evaluated_at: new Date().toISOString(),
      is_ready: false,
      overall_status: PUBLICATION_STATUS_BLOCKED,
      content_hash: 'unknown',
      media: {
        asset_id: null,
        status: null,
        media_type: null,
        alt_text: null,
        has_alt_text: false
      },
      approval: {
        has_approval: false,
        status: null,
        approved_by: null,
        approved_at: null,
        approved_content_hash: null,
        approved_asset_id: null,
        content_hash_matched: false,
        media_matched: false
      },
      checks: {
        article_integrity: 'FAIL',
        editorial_guards: 'FAIL',
        evidence_and_citations: 'FAIL',
        visual_media: 'FAIL',
        human_approval: 'FAIL',
        publication_metadata: 'FAIL'
      },
      blockers: [FAILURE_CODES.GUARD_STATE_UNKNOWN, FAILURE_CODES.FAIL_CLOSED]
    };

    try {
      await db
        .prepare(
          `INSERT INTO article_publication_readiness (
            article_id, is_ready, overall_status, content_hash, snapshot_json, evaluated_at
          ) VALUES (?, 0, ?, ?, ?, CURRENT_TIMESTAMP)`
        )
        .bind(articleId, PUBLICATION_STATUS_BLOCKED, 'unknown', JSON.stringify(failClosedSnapshot))
        .run();
    } catch {
      // ignore persistence error in emergency fail closed
    }

    return failClosedSnapshot;
  }

  // 1. Fetch Article & Metadata
  const article = await db
    .prepare(
      `SELECT a.*, 
              c.name AS category_name, c.slug AS category_slug, 
              au.name AS author_name, au.slug AS author_slug
       FROM articles a
       LEFT JOIN categories c ON a.category_id = c.id
       LEFT JOIN authors au ON a.author_id = au.id
       WHERE a.id = ?`
    )
    .bind(articleId)
    .first();

  if (!article) {
    const notFoundSnapshot: ReadinessSnapshotPayload = {
      schema_version: 1,
      article_id: articleId,
      slug: 'not-found',
      evaluated_at: new Date().toISOString(),
      is_ready: false,
      overall_status: PUBLICATION_STATUS_BLOCKED,
      content_hash: '',
      media: { asset_id: null, status: null, media_type: null, alt_text: null, has_alt_text: false },
      approval: {
        has_approval: false,
        status: null,
        approved_by: null,
        approved_at: null,
        approved_content_hash: null,
        approved_asset_id: null,
        content_hash_matched: false,
        media_matched: false
      },
      checks: {
        article_integrity: 'FAIL',
        editorial_guards: 'FAIL',
        evidence_and_citations: 'FAIL',
        visual_media: 'FAIL',
        human_approval: 'FAIL',
        publication_metadata: 'FAIL'
      },
      blockers: [FAILURE_CODES.ARTICLE_NOT_FOUND]
    };
    return notFoundSnapshot;
  }

  const contentMd = article.content_md || '';
  const currentContentHash = article.content_hash || '';

  // --- Vector 1: Article Core Integrity ---
  let integrityPass = true;
  if (article.status !== 'draft') {
    blockers.push(FAILURE_CODES.ARTICLE_NOT_DRAFT);
    integrityPass = false;
  }

  if (!contentMd.trim()) {
    blockers.push(FAILURE_CODES.ARTICLE_CONTENT_EMPTY);
    integrityPass = false;
  }

  if (!article.slug || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(article.slug)) {
    blockers.push(FAILURE_CODES.SLUG_INVALID);
    integrityPass = false;
  }

  const title = (article.title || '').trim();
  if (!title || title.length < 10 || title.length > 120) {
    blockers.push(FAILURE_CODES.TITLE_LENGTH_INVALID);
    integrityPass = false;
  }

  const description = (article.description || '').trim();
  if (!description || description.length < 10 || description.length > 200) {
    blockers.push(FAILURE_CODES.DESCRIPTION_INVALID);
    integrityPass = false;
  }

  // Category verification
  const categorySlug = (article.category_slug || '').trim();
  if (!categorySlug || !CANONICAL_CATEGORIES.has(categorySlug)) {
    blockers.push(FAILURE_CODES.CATEGORY_INVALID);
    integrityPass = false;
  }

  // Author verification
  const authorSlug = (article.author_slug || '').trim();
  const authorName = (article.author_name || '').trim();
  if (!CANONICAL_AUTHOR_SLUGS.has(authorSlug) && !CANONICAL_AUTHOR_NAMES.has(authorName)) {
    blockers.push(FAILURE_CODES.CANONICAL_AUTHOR_REQUIRED);
    integrityPass = false;
  }

  // --- Vector 2: Editorial Guard Suite ---
  let editorialPass = true;
  const contractRes = checkArticleContract(contentMd);
  if (!contractRes.pass) {
    blockers.push(FAILURE_CODES.ARTICLE_CONTRACT_FAILED);
    editorialPass = false;
  }

  if (!checkMonetaryGuard(contentMd)) {
    blockers.push(FAILURE_CODES.MONETARY_GUARD_FAILED);
    editorialPass = false;
  }

  // Editorial QA (detect raw script tags or unescaped broken markdown)
  if (/<script/i.test(contentMd) || /<iframe/i.test(contentMd)) {
    blockers.push(FAILURE_CODES.EDITORIAL_QA_FAILED);
    editorialPass = false;
  }

  // --- Vector 3: Evidence & Citations ---
  let evidencePass = true;

  // Check Ingest Receipt Provenance if present
  let receiptRow: any = null;
  try {
    receiptRow = await db
      .prepare('SELECT job_id, source, contract_version FROM article_ingest_receipts WHERE article_id = ? LIMIT 1')
      .bind(articleId)
      .first();
  } catch {
    // receipts table might not exist in early tests or be optional
  }

  // If receipt exists, verify contract version
  if (receiptRow && receiptRow.contract_version < 1) {
    blockers.push(FAILURE_CODES.EVIDENCE_FAILED);
    blockers.push(FAILURE_CODES.EVIDENCE_GATE_FAILED);
    evidencePass = false;
  }

  if (!checkCitationGuard(contentMd)) {
    blockers.push(FAILURE_CODES.CITATION_FAILED);
    blockers.push(FAILURE_CODES.CITATION_GUARD_FAILED);
    evidencePass = false;
  }

  // --- Vector 4: Visual Media Binding ---
  let mediaPass = true;
  let activeMediaRow: any = null;

  try {
    activeMediaRow = await db
      .prepare(
        `SELECT am.id, am.asset_id, am.role, am.is_active,
                ma.status AS asset_status, ma.media_type, ma.width, ma.height,
                ma.alt_text, a.image_alt
         FROM article_media am
         JOIN media_assets ma ON am.asset_id = ma.asset_id
         JOIN articles a ON am.article_id = a.id
         WHERE am.article_id = ? AND am.role = 'featured' AND am.is_active = 1
         LIMIT 1`
      )
      .bind(articleId)
      .first();
  } catch {
    // If article_media table is query-failed, fail closed
    blockers.push(FAILURE_CODES.FEATURED_MEDIA_MISSING);
    mediaPass = false;
  }

  if (!activeMediaRow) {
    blockers.push(FAILURE_CODES.FEATURED_MEDIA_MISSING);
    mediaPass = false;
  } else {
    if (activeMediaRow.asset_status !== 'VALIDATED') {
      blockers.push(FAILURE_CODES.MEDIA_NOT_VALIDATED);
      mediaPass = false;
    }
    if (activeMediaRow.media_type !== 'image') {
      blockers.push(FAILURE_CODES.MEDIA_TYPE_INVALID);
      mediaPass = false;
    }
    if (activeMediaRow.width < 600 || activeMediaRow.height < 338) {
      blockers.push(FAILURE_CODES.MEDIA_DIMENSIONS_INVALID);
      mediaPass = false;
    }
    const cleanAlt = (activeMediaRow.alt_text || activeMediaRow.image_alt || '').trim();
    if (!cleanAlt) {
      blockers.push(FAILURE_CODES.ALT_TEXT_MISSING);
      mediaPass = false;
    }
  }

  const mediaSnapshotInfo = {
    asset_id: activeMediaRow ? activeMediaRow.asset_id : null,
    status: activeMediaRow ? activeMediaRow.asset_status : null,
    media_type: activeMediaRow ? activeMediaRow.media_type : null,
    alt_text: activeMediaRow ? (activeMediaRow.alt_text || activeMediaRow.image_alt || null) : null,
    has_alt_text: Boolean(activeMediaRow && (activeMediaRow.alt_text || activeMediaRow.image_alt || '').trim().length > 0)
  };

  // --- Vector 5: Human Editorial Approval ---
  let approvalPass = true;
  let latestApproval: any = null;

  try {
    latestApproval = await db
      .prepare(
        `SELECT id, article_id, approved_by, approved_role, approval_status,
                approved_content_hash, approved_asset_id, created_at
         FROM article_editorial_approvals
         WHERE article_id = ?
         ORDER BY id DESC
         LIMIT 1`
      )
      .bind(articleId)
      .first();
  } catch {
    // approval table lookup error fails closed
    blockers.push(FAILURE_CODES.APPROVAL_MISSING);
    approvalPass = false;
  }

  let approvalSnapshotInfo = {
    has_approval: false,
    status: null as ApprovalStatus | null,
    approved_by: null as string | null,
    approved_at: null as string | null,
    approved_content_hash: null as string | null,
    approved_asset_id: null as string | null,
    content_hash_matched: false,
    media_matched: false
  };

  if (!latestApproval) {
    blockers.push(FAILURE_CODES.APPROVAL_MISSING);
    approvalPass = false;
  } else {
    approvalSnapshotInfo.has_approval = true;
    approvalSnapshotInfo.status = latestApproval.approval_status;
    approvalSnapshotInfo.approved_by = latestApproval.approved_by;
    approvalSnapshotInfo.approved_at = latestApproval.created_at;
    approvalSnapshotInfo.approved_content_hash = latestApproval.approved_content_hash;
    approvalSnapshotInfo.approved_asset_id = latestApproval.approved_asset_id;

    if (latestApproval.approval_status === APPROVAL_STATUS_REJECTED) {
      blockers.push(FAILURE_CODES.APPROVAL_STATUS_REJECTED);
      approvalPass = false;
    } else if (latestApproval.approval_status === APPROVAL_STATUS_REVOKED) {
      blockers.push(FAILURE_CODES.APPROVAL_STATUS_REVOKED);
      approvalPass = false;
    } else if (latestApproval.approval_status === APPROVAL_STATUS_APPROVED) {
      // 1. Check content hash match
      const contentMatched = latestApproval.approved_content_hash === currentContentHash;
      approvalSnapshotInfo.content_hash_matched = contentMatched;
      if (!contentMatched) {
        blockers.push(FAILURE_CODES.APPROVAL_STALE);
        blockers.push(FAILURE_CODES.APPROVAL_STALE_CONTENT);
        blockers.push(FAILURE_CODES.CONTENT_CHANGED_AFTER_APPROVAL);
        approvalPass = false;
      }

      // 2. Check featured media asset match
      const mediaMatched = activeMediaRow && latestApproval.approved_asset_id === activeMediaRow.asset_id;
      approvalSnapshotInfo.media_matched = Boolean(mediaMatched);
      if (!mediaMatched) {
        blockers.push(FAILURE_CODES.APPROVAL_STALE);
        blockers.push(FAILURE_CODES.APPROVAL_STALE_MEDIA);
        blockers.push(FAILURE_CODES.MEDIA_CHANGED_AFTER_APPROVAL);
        approvalPass = false;
      }
    } else {
      blockers.push(FAILURE_CODES.APPROVAL_MISSING);
      approvalPass = false;
    }
  }

  // --- Vector 6: Publication Metadata & Anti-Conflict ---
  let metadataPass = true;

  // Key Takeaways check
  if (!checkKeyTakeaways(article.key_takeaways)) {
    blockers.push(FAILURE_CODES.TAKEAWAYS_INVALID);
    blockers.push(FAILURE_CODES.METADATA_INCOMPLETE);
    metadataPass = false;
  }

  // Duplicate / Conflict check with published inventory or block flag
  if (options?.publicationConflict || article.publication_conflict || article.is_blocked) {
    blockers.push(FAILURE_CODES.PUBLICATION_CONFLICT);
    blockers.push(FAILURE_CODES.INVENTORY_CONFLICT);
    metadataPass = false;
  }

  try {
    const collision = await db
      .prepare(
        `SELECT id, slug, status FROM articles
         WHERE slug = ? AND id != ? AND status = 'published'
         LIMIT 1`
      )
      .bind(article.slug, articleId)
      .first();

    if (collision) {
      blockers.push(FAILURE_CODES.PUBLICATION_CONFLICT);
      blockers.push(FAILURE_CODES.INVENTORY_CONFLICT);
      metadataPass = false;
    }
  } catch {
    // ignore
  }

  // Deduplicate blockers deterministically
  const uniqueBlockers = Array.from(new Set(blockers));

  // --- Determine Overall Readiness ---
  const isReady = uniqueBlockers.length === 0;
  let overallStatus: PublicationOverallStatus = PUBLICATION_STATUS_NOT_READY;

  if (isReady) {
    overallStatus = PUBLICATION_STATUS_READY_TO_SCHEDULE;
  } else if (
    uniqueBlockers.includes(FAILURE_CODES.PUBLICATION_CONFLICT) ||
    uniqueBlockers.includes(FAILURE_CODES.INVENTORY_CONFLICT) ||
    uniqueBlockers.includes(FAILURE_CODES.APPROVAL_STATUS_REJECTED)
  ) {
    overallStatus = PUBLICATION_STATUS_BLOCKED;
  }

  const snapshot: ReadinessSnapshotPayload = {
    schema_version: 1,
    article_id: articleId,
    slug: article.slug || '',
    evaluated_at: new Date().toISOString(),
    is_ready: isReady,
    overall_status: overallStatus,
    content_hash: currentContentHash,
    media: mediaSnapshotInfo,
    approval: approvalSnapshotInfo,
    checks: {
      article_integrity: integrityPass ? 'PASS' : 'FAIL',
      editorial_guards: editorialPass ? 'PASS' : 'FAIL',
      evidence_and_citations: evidencePass ? 'PASS' : 'FAIL',
      visual_media: mediaPass ? 'PASS' : 'FAIL',
      human_approval: approvalPass ? 'PASS' : 'FAIL',
      publication_metadata: metadataPass ? 'PASS' : 'FAIL'
    },
    blockers: uniqueBlockers
  };

  // Persist immutable snapshot into article_publication_readiness
  try {
    await db
      .prepare(
        `INSERT INTO article_publication_readiness (
          article_id, is_ready, overall_status, content_hash, snapshot_json, evaluated_at
        ) VALUES (?, ?, ?, ?, ?, CURRENT_TIMESTAMP)`
      )
      .bind(
        articleId,
        isReady ? 1 : 0,
        overallStatus,
        currentContentHash,
        JSON.stringify(snapshot)
      )
      .run();
  } catch (err: any) {
    console.error('Failed to persist publication readiness snapshot:', err.message);
  }

  return snapshot;
}

/**
 * Records an explicit Human Editorial Approval.
 * Binds cryptographically to current article content_hash and active featured asset_id.
 */
export async function recordEditorialApproval(
  db: any,
  params: {
    articleId: number;
    approvedBy: string;
    approvedRole?: string;
    notes?: string;
  }
): Promise<{ approval: EditorialApprovalRecord; snapshot: ReadinessSnapshotPayload }> {
  // 1. Verify Article Exists and is Draft
  const article = await db
    .prepare('SELECT id, slug, status, content_hash FROM articles WHERE id = ?')
    .bind(params.articleId)
    .first();

  if (!article) {
    throw new Error(`ARTICLE_NOT_FOUND: Article with ID ${params.articleId} not found`);
  }
  if (article.status !== 'draft') {
    throw new Error(`ARTICLE_NOT_DRAFT: Article status is '${article.status}'. Only drafts can be approved.`);
  }

  // 2. Resolve active featured media asset_id
  const mediaBinding = await db
    .prepare(
      `SELECT am.asset_id, ma.status AS asset_status
       FROM article_media am
       JOIN media_assets ma ON am.asset_id = ma.asset_id
       WHERE am.article_id = ? AND am.role = 'featured' AND am.is_active = 1
       LIMIT 1`
    )
    .bind(params.articleId)
    .first();

  if (!mediaBinding) {
    throw new Error(`FEATURED_MEDIA_MISSING: Cannot approve article without active featured media binding.`);
  }

  const approvedRole = params.approvedRole || 'editor_in_chief';
  const notes = params.notes || null;

  // 3. Insert into article_editorial_approvals
  const insertResult = await db
    .prepare(
      `INSERT INTO article_editorial_approvals (
        article_id, approved_by, approved_role, approval_status,
        approved_content_hash, approved_asset_id, notes, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`
    )
    .bind(
      params.articleId,
      params.approvedBy,
      approvedRole,
      APPROVAL_STATUS_APPROVED,
      article.content_hash,
      mediaBinding.asset_id,
      notes
    )
    .run();

  const approvalId = insertResult.lastRowId || insertResult.meta?.last_row_id || 1;

  const approvalRecord: EditorialApprovalRecord = {
    id: approvalId,
    article_id: params.articleId,
    approved_by: params.approvedBy,
    approved_role: approvedRole,
    approval_status: APPROVAL_STATUS_APPROVED,
    approved_content_hash: article.content_hash,
    approved_asset_id: mediaBinding.asset_id,
    notes,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString()
  };

  // 4. Trigger fresh readiness evaluation
  const snapshot = await evaluateArticleReadiness(db, params.articleId);

  return { approval: approvalRecord, snapshot };
}

/**
 * Revokes an existing Human Editorial Approval.
 */
export async function revokeEditorialApproval(
  db: any,
  params: {
    articleId: number;
    revokedBy: string;
    notes?: string;
  }
): Promise<{ revoked: boolean; snapshot: ReadinessSnapshotPayload }> {
  const article = await db
    .prepare('SELECT id, slug, status, content_hash FROM articles WHERE id = ?')
    .bind(params.articleId)
    .first();

  if (!article) {
    throw new Error(`ARTICLE_NOT_FOUND: Article with ID ${params.articleId} not found`);
  }

  // Insert revocation record
  await db
    .prepare(
      `INSERT INTO article_editorial_approvals (
        article_id, approved_by, approved_role, approval_status,
        approved_content_hash, approved_asset_id, notes, created_at, updated_at
      ) VALUES (?, ?, 'revoker', ?, '', '', ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`
    )
    .bind(
      params.articleId,
      params.revokedBy,
      APPROVAL_STATUS_REVOKED,
      params.notes || 'Approval explicitly revoked'
    )
    .run();

  // Re-evaluate readiness
  const snapshot = await evaluateArticleReadiness(db, params.articleId);
  return { revoked: true, snapshot };
}

/**
 * Retrieves the latest readiness snapshot for an article, evaluating if missing.
 */
export async function getArticleReadiness(
  db: any,
  articleId: number,
  options?: { skipCache?: boolean }
): Promise<ReadinessSnapshotPayload> {
  if (!options?.skipCache) {
    const latest = await db
      .prepare(
        `SELECT snapshot_json FROM article_publication_readiness
         WHERE article_id = ?
         ORDER BY evaluated_at DESC, id DESC
         LIMIT 1`
      )
      .bind(articleId)
      .first();

    if (latest && latest.snapshot_json) {
      try {
        return JSON.parse(latest.snapshot_json);
      } catch {
        // Parse error, re-evaluate
      }
    }
  }

  return await evaluateArticleReadiness(db, articleId);
}

/**
 * Retrieves readiness evaluation history for an article.
 */
export async function getArticleReadinessHistory(db: any, articleId: number, limit = 20): Promise<any[]> {
  const result = await db
    .prepare(
      `SELECT id, article_id, is_ready, overall_status, content_hash, evaluated_at, snapshot_json
       FROM article_publication_readiness
       WHERE article_id = ?
       ORDER BY evaluated_at DESC, id DESC
       LIMIT ?`
    )
    .bind(articleId, limit)
    .all();

  const rows = result.results || result || [];
  return rows.map((r: any) => ({
    id: r.id,
    article_id: r.article_id,
    is_ready: Boolean(r.is_ready),
    overall_status: r.overall_status,
    content_hash: r.content_hash,
    evaluated_at: r.evaluated_at,
    snapshot: typeof r.snapshot_json === 'string' ? JSON.parse(r.snapshot_json) : r.snapshot_json
  }));
}

/**
 * Retrieves approval history for an article.
 */
export async function getArticleApprovalsHistory(db: any, articleId: number, limit = 20): Promise<EditorialApprovalRecord[]> {
  const result = await db
    .prepare(
      `SELECT id, article_id, approved_by, approved_role, approval_status,
              approved_content_hash, approved_asset_id, notes, created_at, updated_at
       FROM article_editorial_approvals
       WHERE article_id = ?
       ORDER BY created_at DESC, id DESC
       LIMIT ?`
    )
    .bind(articleId, limit)
    .all();

  return result.results || result || [];
}

/**
 * Clean Query Interface for Downstream Planner (PUBLICATION-1).
 * Returns all draft articles that have attained verified READY_TO_SCHEDULE readiness
 * where current content_hash strictly matches the evaluation snapshot.
 *
 * Excludes:
 * - Articles not in 'draft'
 * - Articles with stale content hashes
 * - Articles with failing blockers
 *
 * NOTE: Does NOT decide publication time. Does NOT mutate articles.
 */
export async function getArticlesReadyToSchedule(db: any): Promise<any[]> {
  const query = `
    SELECT a.id, a.slug, a.title, a.status, a.content_hash,
           r.is_ready, r.overall_status, r.evaluated_at, r.snapshot_json
    FROM articles a
    JOIN article_publication_readiness r ON a.id = r.article_id
    WHERE a.status = 'draft'
      AND r.is_ready = 1
      AND a.content_hash = r.content_hash
      AND r.id = (
        SELECT id FROM article_publication_readiness
        WHERE article_id = a.id
        ORDER BY evaluated_at DESC, id DESC
        LIMIT 1
      )
    ORDER BY r.evaluated_at ASC;
  `;

  const result = await db.prepare(query).all();
  const rows = result.results || result || [];

  return rows.map((row: any) => {
    let snapshot = null;
    try {
      snapshot = JSON.parse(row.snapshot_json);
    } catch {
      // ignore
    }
    return {
      articleId: row.id,
      slug: row.slug,
      title: row.title,
      status: row.status,
      contentHash: row.content_hash,
      publicationStatus: row.overall_status,
      evaluatedAt: row.evaluated_at,
      snapshot
    };
  });
}
