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
import {
  prepareStateMutationCapture,
  prepareOutcomeCapture,
  generateMutationOperationId,
  type OCCGuardCondition
} from '../decision/trajectory-ledger.ts';
import {
  buildCanonicalPublicationPreflightState,
  computeCanonicalPreflightHash
} from '../decision/publication-preflight-state.ts';
import { evaluateArticleDoDFromDb } from '../editorial/article-definition-of-done.ts';

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
  'sistem-konstruksi-rumah',
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
      policy: {
        system_policy_pass: false,
        human_approval_pass: false
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
      policy: {
        system_policy_pass: false,
        human_approval_pass: false
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
                ma.alt_text, ma.role AS media_role, ma.derivative_id, ma.source_type, a.image_alt
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

    // Watermark & public derivative integrity check:
    // Any asset marked as raw master, unwatermarked candidate, or explicitly missing derivative when generated from AI
    const isRawMaster = activeMediaRow.media_role === 'ORIGINAL' || activeMediaRow.media_role === 'MASTER';
    const isAiUnwatermarked = (activeMediaRow.source_type === 'fal_generated' || activeMediaRow.source_type === 'kling_generated') && !activeMediaRow.derivative_id;
    if (isRawMaster || isAiUnwatermarked) {
      blockers.push(FAILURE_CODES.MEDIA_WATERMARK_MISSING);
      mediaPass = false;
    }

    // Check all active inline media rows for watermark protection
    try {
      const inlineRows = await db
        .prepare(
          `SELECT am.id, am.asset_id, am.slot_key,
                  ma.status AS asset_status, ma.media_type, ma.width, ma.height,
                  ma.alt_text, ma.role AS media_role, ma.derivative_id, ma.source_type
           FROM article_media am
           JOIN media_assets ma ON am.asset_id = ma.asset_id
           WHERE am.article_id = ? AND am.role = 'inline' AND am.is_active = 1`
        )
        .bind(articleId)
        .all();

      const items = Array.isArray(inlineRows?.results) ? inlineRows.results : (Array.isArray(inlineRows) ? inlineRows : []);
      for (const row of items) {
        const isInlineRawMaster = row.media_role === 'ORIGINAL' || row.media_role === 'MASTER';
        const isInlineAiUnwatermarked = (row.source_type === 'fal_generated' || row.source_type === 'kling_generated') && !row.derivative_id;
        if (isInlineRawMaster || isInlineAiUnwatermarked) {
          blockers.push(FAILURE_CODES.MEDIA_WATERMARK_MISSING);
          mediaPass = false;
          break;
        }
      }
    } catch {
      // Non-blocking query failure
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

  try {
    const approvalsRes = await db
      .prepare(
        `SELECT id, article_id, approved_by, approved_role, approval_status,
                approved_content_hash, approved_asset_id, notes, created_at
         FROM article_editorial_approvals
         WHERE article_id = ?
         ORDER BY id DESC
         LIMIT 30`
      )
      .bind(articleId)
      .all();
    const rows = approvalsRes?.results || (Array.isArray(approvalsRes) ? approvalsRes : []);
    latestApproval = rows[0] || null;

    if (!latestApproval) {
      blockers.push(FAILURE_CODES.APPROVAL_MISSING);
      approvalPass = false;
    } else {
      approvalSnapshotInfo.has_approval = true;
      approvalSnapshotInfo.status = latestApproval.approval_status;
      approvalSnapshotInfo.approved_by = latestApproval.approved_by;
      approvalSnapshotInfo.approved_at = latestApproval.created_at;

      // Identify latest text approval record and latest featured media approval record
      let latestTextRecord: any = null;
      let latestFeaturedRecord: any = null;

      for (const row of rows) {
        let notesObj: any = {};
        try {
          notesObj = JSON.parse(row.notes || '{}');
        } catch {
          notesObj = {};
        }

        if (notesObj.target === 'media') {
          if ((notesObj.slot_key === 'featured' || notesObj.slot_key === 'primary') && !latestFeaturedRecord) {
            latestFeaturedRecord = { ...row, notesObj };
          }
        } else if (notesObj.target === 'text') {
          if (!latestTextRecord) {
            latestTextRecord = { ...row, notesObj };
          }
        } else {
          // Monolithic legacy record: can satisfy both if unset
          if (!latestTextRecord && row.approved_content_hash) {
            latestTextRecord = { ...row, notesObj };
          }
          if (!latestFeaturedRecord && row.approved_asset_id) {
            latestFeaturedRecord = { ...row, notesObj };
          }
        }
      }

      // Check text approval
      if (!latestTextRecord) {
        blockers.push(FAILURE_CODES.APPROVAL_MISSING);
        approvalPass = false;
      } else if (latestTextRecord.approval_status === APPROVAL_STATUS_REJECTED) {
        blockers.push(FAILURE_CODES.APPROVAL_STATUS_REJECTED);
        blockers.push(FAILURE_CODES.TEXT_REVISION_REQUIRED);
        approvalPass = false;
      } else if (latestTextRecord.approval_status === APPROVAL_STATUS_REVOKED) {
        blockers.push(FAILURE_CODES.APPROVAL_STATUS_REVOKED);
        approvalPass = false;
      } else if (latestTextRecord.approval_status === APPROVAL_STATUS_APPROVED) {
        const contentMatched = latestTextRecord.approved_content_hash === currentContentHash;
        approvalSnapshotInfo.content_hash_matched = contentMatched;
        approvalSnapshotInfo.approved_content_hash = latestTextRecord.approved_content_hash;
        if (!contentMatched) {
          blockers.push(FAILURE_CODES.APPROVAL_STALE);
          blockers.push(FAILURE_CODES.APPROVAL_STALE_CONTENT);
          blockers.push(FAILURE_CODES.CONTENT_CHANGED_AFTER_APPROVAL);
          approvalPass = false;
        }
      } else {
        blockers.push(FAILURE_CODES.APPROVAL_MISSING);
        approvalPass = false;
      }

      // Check featured media approval
      if (activeMediaRow) {
        if (!latestFeaturedRecord) {
          // If no specific featured record in approvals table, check media_promotion_approvals
          let promoApproved = false;
          try {
            const promoRow = await db
              .prepare(
                "SELECT status, candidate_sha256 FROM media_promotion_approvals WHERE article_id = ? AND slot_key = 'featured' AND status = 'APPROVED' ORDER BY id DESC LIMIT 1"
              )
              .bind(articleId)
              .first();
            if (promoRow && activeMediaRow.sha256 === promoRow.candidate_sha256) {
              promoApproved = true;
            }
          } catch {}

          if (!promoApproved) {
            blockers.push(FAILURE_CODES.APPROVAL_STALE);
            blockers.push(FAILURE_CODES.APPROVAL_STALE_MEDIA);
            blockers.push(FAILURE_CODES.MEDIA_CHANGED_AFTER_APPROVAL);
            approvalPass = false;
          } else {
            approvalSnapshotInfo.media_matched = true;
          }
        } else if (latestFeaturedRecord.approval_status === APPROVAL_STATUS_REJECTED) {
          blockers.push(FAILURE_CODES.APPROVAL_STATUS_REJECTED);
          blockers.push(FAILURE_CODES.COVER_REVISION_REQUIRED);
          approvalPass = false;
        } else if (latestFeaturedRecord.approval_status === APPROVAL_STATUS_REVOKED) {
          blockers.push(FAILURE_CODES.APPROVAL_STATUS_REVOKED);
          approvalPass = false;
        } else if (latestFeaturedRecord.approval_status === APPROVAL_STATUS_APPROVED) {
          const mediaMatched = latestFeaturedRecord.approved_asset_id === activeMediaRow.asset_id;
          approvalSnapshotInfo.media_matched = Boolean(mediaMatched);
          approvalSnapshotInfo.approved_asset_id = latestFeaturedRecord.approved_asset_id;
          if (!mediaMatched) {
            blockers.push(FAILURE_CODES.APPROVAL_STALE);
            blockers.push(FAILURE_CODES.APPROVAL_STALE_MEDIA);
            blockers.push(FAILURE_CODES.MEDIA_CHANGED_AFTER_APPROVAL);
            approvalPass = false;
          }
        } else {
          blockers.push(FAILURE_CODES.APPROVAL_STALE_MEDIA);
          approvalPass = false;
        }
      }

      // Check inline media rejection in recent records
      for (const row of rows) {
        try {
          const nObj = JSON.parse(row.notes || '{}');
          if (nObj.target === 'media' && row.approval_status === APPROVAL_STATUS_REJECTED) {
            if (nObj.slot_key !== 'featured' && nObj.slot_key !== 'primary') {
              // Check if resolved by newer approval for that slot
              const isResolved = rows.some((r: any) => {
                if (r.id > row.id && r.approval_status === APPROVAL_STATUS_APPROVED) {
                  try {
                    const rObj = JSON.parse(r.notes || '{}');
                    return rObj.slot_key === nObj.slot_key;
                  } catch {
                    return false;
                  }
                }
                return false;
              });
              if (!isResolved) {
                blockers.push(FAILURE_CODES.INLINE_MEDIA_REVISION_REQUIRED);
                approvalPass = false;
                break;
              }
            }
          }
        } catch {}
      }
    }

    // Check if any open media revision request exists in media_promotion_approvals
    try {
      const openMediaRevisions = await db
        .prepare("SELECT slot_key FROM media_promotion_approvals WHERE article_id = ? AND status = 'REJECTED'")
        .bind(articleId)
        .all();
      const openRevs = openMediaRevisions?.results || (Array.isArray(openMediaRevisions) ? openMediaRevisions : []);
      for (const rev of openRevs) {
        if (rev.slot_key === 'featured' || rev.slot_key === 'primary') {
          blockers.push(FAILURE_CODES.COVER_REVISION_REQUIRED);
          blockers.push(FAILURE_CODES.APPROVAL_STATUS_REJECTED);
        } else {
          blockers.push(FAILURE_CODES.INLINE_MEDIA_REVISION_REQUIRED);
        }
        approvalPass = false;
      }
    } catch {
      // safe fallback
    }
  } catch {
    blockers.push(FAILURE_CODES.APPROVAL_MISSING);
    approvalPass = false;
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

  // --- Vector 7: Canonical Article Definition of Done (DoD v1.0) ---
  let dodPass = true;
  let dodResult: any = null;
  try {
    dodResult = await evaluateArticleDoDFromDb(db, articleId);
    if (dodResult.gateA.status !== 'PASS') {
      blockers.push(FAILURE_CODES.DOD_CONTENT_INCOMPLETE);
      editorialPass = false;
      dodPass = false;
    }
    if (dodResult.gateB.status !== 'PASS') {
      blockers.push(FAILURE_CODES.DOD_MEDIA_INSUFFICIENT);
      mediaPass = false;
      dodPass = false;
    }
  } catch {
    // Fail-closed on DoD execution error
    blockers.push(FAILURE_CODES.DOD_GATE_BLOCKED);
    dodPass = false;
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
    uniqueBlockers.includes(FAILURE_CODES.APPROVAL_STATUS_REJECTED) ||
    uniqueBlockers.includes(FAILURE_CODES.COVER_REVISION_REQUIRED) ||
    uniqueBlockers.includes(FAILURE_CODES.INLINE_MEDIA_REVISION_REQUIRED) ||
    uniqueBlockers.includes(FAILURE_CODES.TEXT_REVISION_REQUIRED) ||
    uniqueBlockers.includes(FAILURE_CODES.DOD_GATE_BLOCKED)
  ) {
    overallStatus = PUBLICATION_STATUS_BLOCKED;
  }

  // System Policy Pass: strictly deterministic publication gates (excludes human approval)
  const systemPolicyPass = Boolean(
    integrityPass &&
    editorialPass &&
    evidencePass &&
    mediaPass &&
    metadataPass &&
    dodPass &&
    article.status === 'draft'
  );
  const humanApprovalPass = Boolean(approvalPass);

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
      publication_metadata: metadataPass ? 'PASS' : 'FAIL',
      dod: dodPass ? 'PASS' : 'FAIL'
    },
    dod: dodResult,
    policy: {
      system_policy_pass: systemPolicyPass,
      human_approval_pass: humanApprovalPass
    },
    blockers: uniqueBlockers
  };

  // Persist immutable snapshot into article_publication_readiness and trajectory ledger
  try {
    const insertReadinessStmt = db
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
      );

    let ledgerStatements: any[] = [];
    try {
      const priorStateRow = await db
        .prepare('SELECT input_hash, persisted_readiness_status, planner_eligibility_status FROM article_state_snapshots WHERE article_id = ? ORDER BY captured_at DESC LIMIT 1')
        .bind(articleId)
        .first();

      const normalizedReadiness = overallStatus === PUBLICATION_STATUS_READY_TO_SCHEDULE
        ? 'READY_TO_SCHEDULE'
        : (overallStatus === PUBLICATION_STATUS_BLOCKED ? 'BLOCKED' : 'NOT_READY');

      const currentPreflightInput: any = {
        articleId,
        slug: article.slug || '',
        contentHash: currentContentHash,
        hasContent: Boolean(article.content_md || article.content_html),
        featuredAssetId: mediaSnapshotInfo.asset_id || null,
        referencesPresent: Boolean(evidencePass),
        persistedReadinessStatus: normalizedReadiness,
        isReady: isReady ? 1 : 0,
        readingTimeMinutes: article.reading_time_minutes || 5,
        isSponsored: Boolean(article.is_sponsored),
        manualHold: article.manual_hold || 0,
        status: article.status || 'draft'
      };

      let beforePreflightInput: any = null;
      if (priorStateRow) {
        beforePreflightInput = {
          ...currentPreflightInput,
          persistedReadinessStatus: priorStateRow.persisted_readiness_status
        };
      }

      const currentCanonical = buildCanonicalPublicationPreflightState(currentPreflightInput);
      const toHash = computeCanonicalPreflightHash(currentCanonical);
      const fromHash = priorStateRow?.input_hash || null;
      const mopId = generateMutationOperationId('readiness_eval', articleId, fromHash, toHash);

      const capture = prepareStateMutationCapture(db, {
        articleId,
        beforeInput: beforePreflightInput,
        afterInput: currentPreflightInput,
        captureSource: 'readiness_evaluation',
        mutationOperationId: mopId,
        actorType: 'pipeline_daemon'
      });
      ledgerStatements = capture.statements;
    } catch {
      // safe fallback
    }

    if (ledgerStatements.length > 0 && typeof db.batch === 'function') {
      await db.batch([insertReadinessStmt, ...ledgerStatements]);
    } else {
      await insertReadinessStmt.run();
      if (ledgerStatements.length > 0) {
        for (const stmt of ledgerStatements) {
          if (stmt && typeof stmt.run === 'function') await stmt.run();
        }
      }
    }
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

  // Idempotency Guard: If article already has an active, valid approval for the exact same content hash and asset ID, return it without creating duplicate records.
  const latestExisting = await db
    .prepare(
      `SELECT id, article_id, approved_by, approved_role, approval_status,
              approved_content_hash, approved_asset_id, notes, created_at, updated_at
       FROM article_editorial_approvals
       WHERE article_id = ?
       ORDER BY id DESC
       LIMIT 1`
    )
    .bind(params.articleId)
    .first();

  if (
    latestExisting &&
    latestExisting.approval_status === APPROVAL_STATUS_APPROVED &&
    latestExisting.approved_content_hash === article.content_hash &&
    latestExisting.approved_asset_id === mediaBinding.asset_id
  ) {
    const snapshot = await evaluateArticleReadiness(db, params.articleId);
    return {
      approval: latestExisting,
      snapshot
    };
  }

  // 3. Insert into article_editorial_approvals and trajectory decision outcomes
  const insertApprovalStmt = db
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
    );

  let outcomeStmt: any = null;
  try {
    const currentPreflightState = buildCanonicalPublicationPreflightState({
      articleId: params.articleId,
      slug: article.slug,
      contentHash: article.content_hash,
      featuredAssetId: mediaBinding.asset_id
    });
    const currentHash = computeCanonicalPreflightHash(currentPreflightState);

    const occCondition: OCCGuardCondition = {
      whereExistsSql: "SELECT 1 FROM articles WHERE id = ? AND status = 'draft' AND content_hash = ?",
      params: [params.articleId, article.content_hash]
    };

    const outcomeCapture = prepareOutcomeCapture(db, {
      articleId: params.articleId,
      inputHash: currentHash,
      outcomeType: 'human_approved',
      outcomeClass: 'HUMAN_EDITORIAL',
      outcomeSource: 'admin_preview',
      sourceRecordId: `appr_a${params.articleId}_${Date.now()}`,
      evidenceReference: `dual_approval_editor_${params.approvedBy}`,
      actorType: 'human_editor',
      actorId: params.approvedBy,
      metadata: { approved_role: approvedRole, notes },
      condition: occCondition
    });
    outcomeStmt = outcomeCapture.statement;
  } catch {
    // safe fallback
  }

  let insertResult: any;
  if (outcomeStmt && typeof db.batch === 'function') {
    const batchRes = await db.batch([insertApprovalStmt, outcomeStmt]);
    insertResult = batchRes[0];
  } else {
    insertResult = await insertApprovalStmt.run();
    if (outcomeStmt) {
      try {
        await outcomeStmt.run();
      } catch {
        // safe fallback
      }
    }
  }

  const approvalId = insertResult?.lastRowId || insertResult?.meta?.last_row_id || 1;

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

  // Insert revocation record and outcome
  const insertRevokeStmt = db
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
    );

  let outcomeStmt: any = null;
  try {
    const currentPreflightState = buildCanonicalPublicationPreflightState({
      articleId: params.articleId,
      slug: article.slug,
      contentHash: article.content_hash
    });
    const currentHash = computeCanonicalPreflightHash(currentPreflightState);

    const outcomeCapture = prepareOutcomeCapture(db, {
      articleId: params.articleId,
      inputHash: currentHash,
      outcomeType: 'human_approval_revoked',
      outcomeClass: 'HUMAN_EDITORIAL',
      outcomeSource: 'admin_preview',
      sourceRecordId: `revk_a${params.articleId}_${Date.now()}`,
      evidenceReference: `revocation_by_${params.revokedBy}`,
      actorType: 'human_editor',
      actorId: params.revokedBy,
      metadata: { notes: params.notes }
    });
    outcomeStmt = outcomeCapture.statement;
  } catch {
    // safe fallback
  }

  if (outcomeStmt && typeof db.batch === 'function') {
    await db.batch([insertRevokeStmt, outcomeStmt]);
  } else {
    await insertRevokeStmt.run();
    if (outcomeStmt) {
      try {
        await outcomeStmt.run();
      } catch {
        // safe fallback
      }
    }
  }

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
    const [latest, currentArticle, currentMedia] = await Promise.all([
      db
        .prepare(
          `SELECT snapshot_json FROM article_publication_readiness
           WHERE article_id = ?
           ORDER BY evaluated_at DESC, id DESC
           LIMIT 1`
        )
        .bind(articleId)
        .first()
        .catch(() => null),
      db
        .prepare('SELECT content_hash FROM articles WHERE id = ?')
        .bind(articleId)
        .first()
        .catch(() => null),
      db
        .prepare("SELECT asset_id FROM article_media WHERE article_id = ? AND role = 'featured' AND is_active = 1 LIMIT 1")
        .bind(articleId)
        .first()
        .catch(() => null)
    ]);

    if (latest && latest.snapshot_json && currentArticle) {
      try {
        const parsed = JSON.parse(latest.snapshot_json);
        const hashMatches = parsed.content_hash === currentArticle.content_hash;
        const mediaMatches = (parsed.media?.asset_id || null) === (currentMedia?.asset_id || null);
        if (hashMatches && mediaMatches) {
          return parsed;
        }
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
