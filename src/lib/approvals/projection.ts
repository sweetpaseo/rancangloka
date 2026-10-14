/**
 * RancangLoka — Scalable Human Approval Projection Engine
 * Milestone: APPROVAL-INBOX-V1
 *
 * Implements a pure read-projection of canonical workflow state.
 * No secondary duplicate queues that can get stale.
 *
 * Invariants:
 * 1. Single Source of Truth: Projects directly from `articles`, `article_editorial_approvals`,
 *    and `media_promotion_approvals`.
 * 2. Oldest Waiting First: Primary pending sort order ensures zero starvation.
 * 3. Bell Capping: Header preview is capped at 3–5 items.
 * 4. Deterministic Next Item: Provides lightweight continuation without bulk approvals.
 */

import type {
  ApprovalInboxItem,
  ApprovalProjectionOptions,
  ApprovalProjectionResult,
  ApprovalCounts,
  ApprovalStatus,
  ApprovalType
} from './types.ts';
import { formatWaitingDuration } from './formatters.ts';
import { injectDevVisualFixturesIfEligible } from './dev-fixtures.ts';

/**
 * Checks if a table exists in SQLite / D1 database.
 */
async function tableExists(db: any, tableName: string): Promise<boolean> {
  try {
    const row = await db
      .prepare("SELECT 1 FROM sqlite_master WHERE type = 'table' AND name = ?")
      .bind(tableName)
      .first();
    return Boolean(row);
  } catch {
    return false;
  }
}

/**
 * Projects all workflow records into normalized ApprovalInboxItems.
 */
async function projectRawApprovalItems(db: any, nowMs?: number): Promise<ApprovalInboxItem[]> {
  const items: ApprovalInboxItem[] = [];

  // 1. Project Editorial Draft Articles
  try {
    const hasArticles = await tableExists(db, 'articles');
    if (hasArticles) {
      // Query draft articles
      const draftsResult = await db
        .prepare(
          `SELECT id, slug, title, status, content_hash, updated_at, published_at
           FROM articles
           WHERE status = 'draft'
           ORDER BY updated_at ASC`
        )
        .all();

      const drafts = draftsResult?.results || (Array.isArray(draftsResult) ? draftsResult : []);

      const hasEditorialApprovals = await tableExists(db, 'article_editorial_approvals');
      const hasReadiness = await tableExists(db, 'article_publication_readiness');

      for (const draft of drafts) {
        let latestApproval: any = null;

        if (hasEditorialApprovals) {
          latestApproval = await db
            .prepare(
              `SELECT id, approved_by, approved_role, approval_status,
                      approved_content_hash, approved_asset_id, notes, created_at, updated_at
               FROM article_editorial_approvals
               WHERE article_id = ?
               ORDER BY id DESC
               LIMIT 1`
            )
            .bind(draft.id)
            .first();
        }

        // 1. Evaluate Canonical Gate Provenance & Readiness Snapshot
        // Pipeline: Irwan (Evidence) -> Joko (Authoring) -> Nadia (Reader Voice) -> Rina (Editorial QA) -> Human Approval -> Sari
        let irwanPass = false;
        let jokoPass = false;
        let nadiaPass = false;
        let rinaPass = false;
        let hasNamedStaffProvenance = false;

        let latestReadiness: any = null;
        if (hasReadiness) {
          latestReadiness = await db
            .prepare(
              `SELECT overall_status, is_ready, snapshot_json
               FROM article_publication_readiness
               WHERE article_id = ?
               ORDER BY id DESC
               LIMIT 1`
            )
            .bind(draft.id)
            .first();
        }

        let isHumanApprovalRequired = false;
        let allUpstreamGatesPassed = false;

        if (latestReadiness?.snapshot_json) {
          try {
            const snap = JSON.parse(latestReadiness.snapshot_json);
            const checks = snap.checks || {};
            const staffGates = snap.staff_gates || {};

            // Determine whether named staff provenance is proven
            if (
              snap.has_named_staff_provenance === true ||
              Boolean(snap.staff_gates) ||
              snap.pipeline_mode === 'named_staff' ||
              checks.rina !== undefined ||
              checks.irwan !== undefined
            ) {
              hasNamedStaffProvenance = true;
            }

            // Upstream Gates: Strict evaluation with zero unproven assumptions
            irwanPass = Boolean(staffGates.irwan === 'PASS' || checks.irwan === 'PASS' || checks.evidence_and_citations === 'PASS');
            jokoPass = Boolean(staffGates.joko === 'PASS' || checks.joko === 'PASS' || checks.editorial_guards === 'PASS');
            nadiaPass = Boolean(staffGates.nadia === 'PASS' || checks.nadia === 'PASS' || checks.audience_voice === 'PASS' || snap.reader_voice_pass === true || snap.reader_voice_decision === 'READER_VOICE_PASS');

            // Rina / Final Editorial QA: Requires EXPLICIT PASS. Absence of failure is NOT proof of completion!
            const explicitRinaNamedPass = staffGates.rina === 'PASS' || checks.rina === 'PASS';
            const explicitEditorialQaPass = checks.editorial_qa === 'PASS' || snap.final_editorial_qa === 'PASS';
            const technicalPrerequisitesPass = checks.article_integrity === 'PASS' && checks.visual_media === 'PASS';

            if (explicitRinaNamedPass) {
              rinaPass = true;
            } else if (explicitEditorialQaPass && technicalPrerequisitesPass) {
              rinaPass = true;
            } else {
              rinaPass = false;
            }

            allUpstreamGatesPassed = Boolean(irwanPass && jokoPass && nadiaPass && rinaPass);

            // Blockers & Human Gate requirement
            const blockers: string[] = snap.blockers || [];
            const onlyApprovalBlockers = blockers.length > 0 && blockers.every((b: string) =>
              ['APPROVAL_MISSING', 'APPROVAL_STALE', 'APPROVAL_STALE_CONTENT', 'APPROVAL_STALE_MEDIA'].includes(b)
            );
            const humanApprovalNotYetGranted = checks.human_approval !== 'PASS';

            // Human approval is required ONLY when all upstream gates passed and human approval is the sole remaining blocker
            isHumanApprovalRequired = allUpstreamGatesPassed && onlyApprovalBlockers && humanApprovalNotYetGranted;
          } catch {
            // Malformed JSON fails closed
          }
        }

        // 2. Determine Approval Item Status based on Canonical Truth
        let status: ApprovalStatus | null = null;
        let statusLabel = 'Menunggu';
        let waitingSince = draft.updated_at || draft.published_at || new Date().toISOString();

        if (latestApproval) {
          const approvalTime = new Date(latestApproval.created_at).getTime();
          const readinessEvalTime = latestReadiness?.evaluated_at ? new Date(latestReadiness.evaluated_at).getTime() : 0;

          if (latestApproval.approval_status === 'APPROVED') {
            // Check content staleness
            const contentChanged = Boolean(
              draft.content_hash &&
              latestApproval.approved_content_hash &&
              draft.content_hash !== latestApproval.approved_content_hash
            );
            const isReEvaluatedAfterApproval = readinessEvalTime > approvalTime && isHumanApprovalRequired;

            if (contentChanged && isReEvaluatedAfterApproval) {
              status = 'PENDING';
              statusLabel = 'Menunggu (Konten Diperbarui)';
              waitingSince = draft.updated_at;
            } else if (contentChanged) {
              // Upstream gates not yet complete on modified content -> NOT pending
              status = null;
            } else {
              status = 'APPROVED';
              statusLabel = 'Selesai';
              waitingSince = latestApproval.created_at;
            }
          } else if (latestApproval.approval_status === 'REJECTED') {
            // Revision requested
            // It only returns to PENDING if a NEW readiness evaluation occurred strictly AFTER the rejection,
            // proving that the revision cycle completed through all upstream gates.
            const isRevisedAfterRejection = readinessEvalTime > approvalTime && isHumanApprovalRequired;

            if (isRevisedAfterRejection) {
              status = 'PENDING';
              statusLabel = 'Menunggu (Revisi Siap Ditinjau)';
              waitingSince = draft.updated_at;
            } else {
              // Active revision cycle in progress: strictly REVISION_REQUESTED (not PENDING)
              status = 'REVISION_REQUESTED';
              statusLabel = 'Minta Revisi';
              waitingSince = latestApproval.created_at;
            }
          } else if (latestApproval.approval_status === 'REVOKED') {
            const isReEvaluatedAfterRevoke = readinessEvalTime > approvalTime && isHumanApprovalRequired;
            if (isReEvaluatedAfterRevoke) {
              status = 'PENDING';
              statusLabel = 'Menunggu';
              waitingSince = latestApproval.updated_at || latestApproval.created_at;
            } else {
              status = null;
            }
          }
        } else {
          // No prior approval record
          if (isHumanApprovalRequired) {
            status = 'PENDING';
            statusLabel = 'Menunggu';
          }
        }

        // SEMANTIC INVARIANT: If not in a valid human review state, strictly skip
        if (!status) {
          continue;
        }

        // Derive Previous Gates truthfully (Named staff if proven, otherwise generic stage labels)
        let gateTokens: string[];
        if (hasNamedStaffProvenance) {
          gateTokens = [
            irwanPass ? 'Irwan ✓' : 'Irwan ⏳',
            jokoPass ? 'Joko ✓' : 'Joko ⏳',
            nadiaPass ? 'Nadia ✓' : 'Nadia ⏳',
            rinaPass ? 'Rina ✓' : 'Rina ⏳'
          ];
        } else {
          gateTokens = [
            irwanPass ? 'Evidence ✓' : 'Evidence ⏳',
            jokoPass ? 'Authoring ✓' : 'Authoring ⏳',
            nadiaPass ? 'Reader Voice ✓' : 'Reader Voice ⏳',
            rinaPass ? 'Editorial QA ✓' : 'Editorial QA ⏳'
          ];
        }
        const previousGates = gateTokens.join(' ');

        items.push({
          id: `article:${draft.id}`,
          rawId: draft.id,
          type: 'article',
          typeLabel: 'Artikel',
          title: draft.title || draft.slug || `Artikel #${draft.id}`,
          slug: draft.slug,
          workflowStage: 'Editorial Approval',
          previousGates,
          waitingSince,
          waitingAgeFormatted: formatWaitingDuration(waitingSince, nowMs),
          requiredActor: 'Chief Editor',
          status,
          statusLabel,
          notes: latestApproval?.notes || null,
          detailUrl: `/admin/preview/${draft.slug}`,
          metadata: {
            article_id: draft.id,
            slug: draft.slug,
            content_hash: draft.content_hash,
            gates: {
              irwan: irwanPass,
              joko: jokoPass,
              nadia: nadiaPass,
              rina: rinaPass
            }
          }
        });
      }
    }
  } catch (err) {
    console.error('Failed to project editorial draft approvals:', err);
  }

  // 2. Project Media Promotion Approvals (Dual-Control published media)
  try {
    const hasMediaApprovals = await tableExists(db, 'media_promotion_approvals');
    if (hasMediaApprovals) {
      const mediaResult = await db
        .prepare(
          `SELECT mpa.approval_id, mpa.device_id, mpa.article_id, mpa.article_slug,
                  mpa.content_hash, mpa.candidate_sha256, mpa.slot_key,
                  mpa.status, mpa.requested_at, mpa.approved_at, mpa.rejection_reason,
                  a.title as article_title
           FROM media_promotion_approvals mpa
           LEFT JOIN articles a ON mpa.article_id = a.id
           ORDER BY mpa.requested_at ASC`
        )
        .all();

      const mediaRows = mediaResult?.results || (Array.isArray(mediaResult) ? mediaResult : []);

      for (const row of mediaRows) {
        let status: ApprovalStatus = 'PENDING';
        let statusLabel = 'Menunggu';

        if (row.status === 'REQUESTED') {
          status = 'PENDING';
          statusLabel = 'Menunggu';
        } else if (row.status === 'REJECTED') {
          status = 'REVISION_REQUESTED';
          statusLabel = 'Minta Revisi';
        } else if (['APPROVED', 'CONSUMED', 'ISSUED'].includes(row.status)) {
          status = 'APPROVED';
          statusLabel = 'Selesai';
        } else {
          // EXPIRED, REVOKED, etc.
          continue;
        }

        const waitingSince = row.requested_at || new Date().toISOString();
        const displayTitle = row.article_title
          ? `Media: ${row.article_title} [${row.slot_key || 'featured'}]`
          : `Media: ${row.article_slug} [${row.slot_key || 'featured'}]`;

        items.push({
          id: `media:${row.approval_id}`,
          rawId: row.approval_id,
          type: 'media',
          typeLabel: 'Promosi Media',
          title: displayTitle,
          slug: row.article_slug,
          workflowStage: 'Media Dual-Control Review',
          previousGates: 'Device Budi ✓',
          waitingSince,
          waitingAgeFormatted: formatWaitingDuration(waitingSince, nowMs),
          requiredActor: 'Chief Editor / Admin',
          status,
          statusLabel,
          notes: row.rejection_reason || null,
          detailUrl: `/admin/preview/${row.article_slug}?review_media=${encodeURIComponent(row.approval_id)}`,
          metadata: {
            approval_id: row.approval_id,
            device_id: row.device_id,
            candidate_sha256: row.candidate_sha256,
            slot_key: row.slot_key
          }
        });
      }
    }
  } catch (err) {
    console.error('Failed to project media promotion approvals:', err);
  }

  // 3. Primary Sort: OLDEST WAITING FIRST
  items.sort((a, b) => {
    const timeA = new Date(a.waitingSince).getTime();
    const timeB = new Date(b.waitingSince).getTime();
    return timeA - timeB;
  });

  return items;
}

/**
 * Returns summary counts for the notification bell & sidebar.
 * Used to guarantee EXACT same projection counts across all navigation elements.
 */
export async function getApprovalCounts(
  db: any,
  options: { includeDevFixtures?: boolean; now?: number } = {}
): Promise<ApprovalCounts> {
  let allItems = await projectRawApprovalItems(db, options.now);
  if (options.includeDevFixtures) {
    allItems = injectDevVisualFixturesIfEligible(allItems, options.now);
    allItems.sort((a, b) => new Date(a.waitingSince).getTime() - new Date(b.waitingSince).getTime());
  }
  const pendingCount = allItems.filter((i) => i.status === 'PENDING').length;
  const revisionCount = allItems.filter((i) => i.status === 'REVISION_REQUESTED').length;
  const completedCount = allItems.filter((i) => i.status === 'APPROVED').length;

  return {
    pendingCount,
    revisionCount,
    completedCount
  };
}

/**
 * Retrieves the full or filtered Approval Inbox projection with pagination and bell preview.
 */
export async function getApprovalInboxProjection(
  db: any,
  options: ApprovalProjectionOptions = {}
): Promise<ApprovalProjectionResult> {
  const nowMs = options.now || Date.now();
  let allItems = await projectRawApprovalItems(db, nowMs);

  if (options.includeDevFixtures) {
    allItems = injectDevVisualFixturesIfEligible(allItems, nowMs);
    allItems.sort((a, b) => new Date(a.waitingSince).getTime() - new Date(b.waitingSince).getTime());
  }

  // Global counts across all un-filtered items
  const pendingItems = allItems.filter((i) => i.status === 'PENDING');
  const pendingCount = pendingItems.length;
  const revisionCount = allItems.filter((i) => i.status === 'REVISION_REQUESTED').length;
  const completedCount = allItems.filter((i) => i.status === 'APPROVED').length;

  // Bell preview: capped at max 5 oldest pending items
  const previewItems = pendingItems.slice(0, 5);

  // Apply Filters
  const targetStatus = options.status || 'PENDING'; // Default view: MENUNGGU PERSETUJUAN
  const targetType = options.type || 'ALL';
  const searchTerm = options.search?.trim().toLowerCase() || '';

  let filtered = allItems;

  if (targetStatus !== 'ALL') {
    filtered = filtered.filter((i) => i.status === targetStatus);
  }

  if (targetType !== 'ALL') {
    filtered = filtered.filter((i) => i.type === targetType);
  }

  if (searchTerm) {
    filtered = filtered.filter(
      (i) =>
        i.title.toLowerCase().includes(searchTerm) ||
        (i.slug && i.slug.toLowerCase().includes(searchTerm)) ||
        i.workflowStage.toLowerCase().includes(searchTerm) ||
        i.requiredActor.toLowerCase().includes(searchTerm)
    );
  }

  const totalCount = filtered.length;
  const page = Math.max(1, options.page || 1);
  const limit = Math.max(1, options.limit || 20);
  const totalPages = Math.max(1, Math.ceil(totalCount / limit));
  const offset = (page - 1) * limit;

  const paginatedItems = filtered.slice(offset, offset + limit);

  return {
    items: paginatedItems,
    totalCount,
    pendingCount,
    revisionCount,
    completedCount,
    previewItems,
    pagination: {
      page,
      limit,
      totalPages
    },
    filter: {
      status: targetStatus,
      type: targetType,
      search: options.search
    }
  };
}

/**
 * Fast Review Continuation:
 * Given a current raw ID and type, returns the next pending item in the canonical queue.
 */
export async function getNextPendingApproval(
  db: any,
  currentRawId: number | string,
  currentType: ApprovalType,
  options?: { now?: number; includeDevFixtures?: boolean }
): Promise<ApprovalInboxItem | null> {
  const currentId = `${currentType}:${currentRawId}`;
  let allItems = await projectRawApprovalItems(db, options?.now);
  if (options?.includeDevFixtures) {
    allItems = injectDevVisualFixturesIfEligible(allItems, options?.now);
    allItems.sort((a, b) => new Date(a.waitingSince).getTime() - new Date(b.waitingSince).getTime());
  }
  const pendingItems = allItems.filter((i) => i.status === 'PENDING');

  const currentIndex = pendingItems.findIndex((i) => i.id === currentId);
  if (currentIndex >= 0 && currentIndex < pendingItems.length - 1) {
    return pendingItems[currentIndex + 1];
  }

  // If current was not found or is the last item, return the first pending item that isn't the current
  const alternative = pendingItems.find((i) => i.id !== currentId);
  return alternative || null;
}
