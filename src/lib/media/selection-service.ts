/**
 * RancangLoka — Media Selection & Decision State Service
 * Milestone: MEDIA-SELECTION-WORKFLOW-1
 *
 * Implements strict separation between:
 * 1. Candidate review/selection status (AVAILABLE, SELECTED, NOT_SELECTED, REJECTED, SUPERSEDED)
 * 2. Slot decision status (NEEDS_DECISION, DECISION_COMPLETE, NEEDS_REPLACEMENT, SKIPPED)
 * 3. Canonical media binding status (NOT_PROMOTED, PROMOTED, BOUND)
 * 4. Article editorial status (draft, scheduled, published)
 *
 * Invariants:
 * - Unselected alternative candidates do NOT create pending obligations.
 * - Selecting one alternative automatically marks competing candidates as NOT_SELECTED.
 * - Required slots must have a selection before completion.
 * - Optional slots can be explicitly SKIPPED without blocking publication.
 * - Zero automatic publishing of articles.
 */

import fs from 'node:fs';
import path from 'node:path';
import {
  loadCandidatesLedger,
  saveCandidatesLedger,
  type ExperimentalMediaCandidate
} from './experimental-storage.ts';
import { BATCH_1_SUPPORTING_BRIEFS } from './editorial-visual-intelligence.ts';

export type CandidateSelectionStatus =
  | 'AVAILABLE'
  | 'SELECTED'
  | 'NOT_SELECTED'
  | 'REJECTED'
  | 'SUPERSEDED';

export type SlotDecisionStatus =
  | 'NEEDS_DECISION'
  | 'DECISION_COMPLETE'
  | 'NEEDS_REPLACEMENT'
  | 'SKIPPED';

export type SlotRequirement = 'REQUIRED' | 'OPTIONAL';

export type SlotType = 'HERO' | 'SUPPORTING';

export interface EvaluatedCandidate {
  candidate: ExperimentalMediaCandidate;
  selection_status: CandidateSelectionStatus;
  is_active_selection: boolean;
  status_label: string;
}

export interface EvaluatedSlot {
  article_id: number;
  slot_identifier: 'hero' | 'S1' | 'S2';
  slot_key: string;
  slot_type: SlotType;
  slot_name: string;
  target_section: string;
  requirement: SlotRequirement;
  decision_status: SlotDecisionStatus;
  status_label: string;
  selected_candidate_id: string | null;
  candidates: EvaluatedCandidate[];
  can_skip: boolean;
  is_skipped: boolean;
  is_canonically_bound: boolean;
  canonical_asset_id: string | null;
  notes?: string;
}

export interface ArticleMediaDecisionSummary {
  article_id: number;
  hero_slot: EvaluatedSlot;
  s1_slot: EvaluatedSlot;
  s2_slot: EvaluatedSlot;
  total_slots: number;
  completed_slots: number;
  pending_required_slots: number;
  is_all_decisions_complete: boolean;
}

export interface PendingMediaDecision {
  article_id: number;
  slot_identifier: 'hero' | 'S1' | 'S2';
  slot_key: string;
  slot_name: string;
  requirement: SlotRequirement;
  reason: string;
  available_candidates_count: number;
}

const STORAGE_DIR = path.resolve('./storage/experimental-media');
const SLOT_DECISIONS_FILE = path.join(STORAGE_DIR, 'slot-decisions.json');

interface PersistedSlotDecision {
  article_id: number;
  slot_identifier: 'hero' | 'S1' | 'S2';
  slot_key: string;
  status: 'SKIPPED' | 'NEEDS_REPLACEMENT';
  decided_by: string;
  decided_at: string;
  notes?: string;
}

function loadPersistedSlotDecisions(): PersistedSlotDecision[] {
  try {
    if (fs.existsSync(SLOT_DECISIONS_FILE)) {
      const raw = fs.readFileSync(SLOT_DECISIONS_FILE, 'utf8');
      return JSON.parse(raw);
    }
  } catch (err) {
    console.warn('[selection-service] Could not load slot-decisions.json:', err);
  }
  return [];
}

function savePersistedSlotDecisions(decisions: PersistedSlotDecision[]): void {
  try {
    if (!fs.existsSync(STORAGE_DIR)) {
      fs.mkdirSync(STORAGE_DIR, { recursive: true });
    }
    fs.writeFileSync(SLOT_DECISIONS_FILE, JSON.stringify(decisions, null, 2), 'utf8');
  } catch (err) {
    console.error('[selection-service] Failed to write slot-decisions.json:', err);
  }
}

/**
 * Returns slot requirement (REQUIRED vs OPTIONAL) from the editorial visual brief.
 */
export function getSlotRequirement(articleId: number, slotIdentifier: 'hero' | 'S1' | 'S2'): SlotRequirement {
  if (slotIdentifier === 'hero') {
    return 'REQUIRED';
  }

  // Look up supporting visual brief
  const key = `${articleId}-${slotIdentifier}`;
  const brief = BATCH_1_SUPPORTING_BRIEFS[key];
  if (brief) {
    // Check manifest priority: essential = REQUIRED, helpful = OPTIONAL
    // In Batch 1:
    // 9993-S1 (moisture ingress diagram) is essential (REQUIRED)
    // 9993-S2 (paint blistering detail) is helpful (OPTIONAL)
    // 9999-S1 (balcony clearance diagram) is essential (REQUIRED)
    // 9999-S2 (shading/greenery detail) is helpful (OPTIONAL)
    // 10000-S1 (inner court comparative plan) is essential (REQUIRED)
    // 10000-S2 (stair void stack diagram) is essential (REQUIRED)
    if (key === '9993-S2' || key === '9999-S2') {
      return 'OPTIONAL';
    }
    return 'REQUIRED';
  }

  return 'REQUIRED';
}

/**
 * Resolves standard slot key for a candidate.
 */
export function resolveSlotKey(articleId: number, slotIdentifier: 'hero' | 'S1' | 'S2'): string {
  if (slotIdentifier === 'hero') return 'featured';
  if (articleId === 9993) {
    return slotIdentifier === 'S1' ? 'inline_concept_diagram_1' : 'inline_detail_close_up_1';
  }
  if (articleId === 9999) {
    return slotIdentifier === 'S1' ? 'inline_concept_diagram_1' : 'inline_detail_close_up_1';
  }
  if (articleId === 10000) {
    return slotIdentifier === 'S1' ? 'inline_comparative_visual_1' : 'inline_section_detail_1';
  }
  return slotIdentifier === 'S1' ? 'inline_slot_1' : 'inline_slot_2';
}

/**
 * Helper to determine if a candidate is superseded by a newer version in the same slot.
 */
export function isCandidateSuperseded(
  candidate: ExperimentalMediaCandidate,
  allSlotCandidates: ExperimentalMediaCandidate[]
): boolean {
  if ((candidate as any).selection_status === 'SUPERSEDED') return true;

  const getVersionNumber = (id: string): number => {
    const match = id.match(/-v(\d+)(?:$|\b)/);
    return match ? parseInt(match[1], 10) : 1;
  };

  const thisVer = getVersionNumber(candidate.id);
  const thisModel = (candidate.model || '').toLowerCase();

  return allSlotCandidates.some((other) => {
    if (other.id === candidate.id) return false;
    const otherModel = (other.model || '').toLowerCase();
    const otherVer = getVersionNumber(other.id);
    // If same model family and strictly higher version exists
    return (otherModel === thisModel || other.id.includes(candidate.id.split('-v')[0])) && otherVer > thisVer;
  });
}

/**
 * Normalizes candidate selection status considering slot context and competing candidates.
 */
export function normalizeCandidateSelectionStatus(
  candidate: ExperimentalMediaCandidate,
  hasSlotWinner: boolean,
  winningCandidateId: string | null,
  isSuperseded: boolean = false
): { status: CandidateSelectionStatus; isWinner: boolean; label: string } {
  // 1. Is this candidate explicitly superseded by a newer version?
  if (isSuperseded) {
    return { status: 'SUPERSEDED', isWinner: false, label: 'VERSI USANG (SUPERSEDED)' };
  }

  // 2. Is this candidate explicitly rejected?
  if (candidate.approval_status === 'REJECTED' || (candidate as any).selection_status === 'REJECTED') {
    return { status: 'REJECTED', isWinner: false, label: 'DITOLAK (REJECTED)' };
  }

  // 3. Is this candidate the winning / approved selection?
  const isApproved =
    candidate.approval_status === 'APPROVED' ||
    (candidate as any).selection_status === 'SELECTED' ||
    candidate.id === winningCandidateId;

  if (isApproved) {
    return { status: 'SELECTED', isWinner: true, label: 'TERPILIH UNTUK ARTIKEL' };
  }

  // 4. If another candidate in this slot was selected, this candidate is NOT_SELECTED (not pending!)
  if (hasSlotWinner) {
    return { status: 'NOT_SELECTED', isWinner: false, label: 'TIDAK DIPILIH' };
  }

  // 5. Otherwise, available for decision
  return { status: 'AVAILABLE', isWinner: false, label: 'TERSEDIA UNTUK DIPILIH' };
}

/**
 * Evaluates a single slot's decision status and candidates.
 */
export function evaluateSlot(
  articleId: number,
  slotIdentifier: 'hero' | 'S1' | 'S2',
  allCandidates: ExperimentalMediaCandidate[],
  canonicalActiveAssetIds: string[] = []
): EvaluatedSlot {
  const slotKey = resolveSlotKey(articleId, slotIdentifier);
  const requirement = getSlotRequirement(articleId, slotIdentifier);
  const slotDecisions = loadPersistedSlotDecisions();

  // Find candidates for this slot
  const slotCandidates = allCandidates.filter((c) => {
    if (c.article_id !== articleId) return false;
    if (slotIdentifier === 'hero') {
      return (c.media_role || '').toLowerCase() === 'featured_hero' || c.id.includes('-hero') || (!c.id.includes('-s1-') && !c.id.includes('-s2-') && !c.id.includes('-s1') && !c.id.includes('-s2'));
    }
    const targetTag = slotIdentifier.toLowerCase();
    const role = (c.media_role || '').toLowerCase();
    const briefSlot = (c.visual_brief?.slotKey || '').toLowerCase();
    const id = c.id.toLowerCase();
    return (
      role === `supporting_${targetTag}` ||
      briefSlot === targetTag ||
      id.includes(`-${targetTag}-`) ||
      id.endsWith(`-${targetTag}`)
    );
  });

  // Check if slot was explicitly skipped
  const persistedDecision = slotDecisions.find(
    (d) => d.article_id === articleId && d.slot_identifier === slotIdentifier
  );
  const isSkipped = persistedDecision?.status === 'SKIPPED';

  // Identify winning candidate (if any)
  // An approved candidate or one marked as active selection
  const winningCand = slotCandidates.find(
    (c) =>
      c.approval_status === 'APPROVED' ||
      (c as any).selection_status === 'SELECTED'
  );

  const hasSlotWinner = Boolean(winningCand);
  const winningId = winningCand ? winningCand.id : null;

  // Map candidates with their evaluated selection status
  const evaluatedCandidates: EvaluatedCandidate[] = slotCandidates.map((c) => {
    const isSuperseded = isCandidateSuperseded(c, slotCandidates);
    const { status, isWinner, label } = normalizeCandidateSelectionStatus(c, hasSlotWinner, winningId, isSuperseded);
    return {
      candidate: c,
      selection_status: status,
      is_active_selection: isWinner,
      status_label: label
    };
  });

  // Determine slot decision status
  let decisionStatus: SlotDecisionStatus = 'NEEDS_DECISION';
  let statusLabel = 'Menunggu Keputusan';

  if (isSkipped) {
    decisionStatus = 'SKIPPED';
    statusLabel = 'Dilewati (Opsional)';
  } else if (hasSlotWinner) {
    decisionStatus = 'DECISION_COMPLETE';
    statusLabel = 'Keputusan Selesai';
  } else if (
    evaluatedCandidates.length > 0 &&
    evaluatedCandidates.every((c) => c.selection_status === 'REJECTED' || c.selection_status === 'SUPERSEDED')
  ) {
    decisionStatus = 'NEEDS_REPLACEMENT';
    statusLabel = 'Perlu Regenerasi / Pengganti';
  } else {
    decisionStatus = 'NEEDS_DECISION';
    statusLabel = requirement === 'REQUIRED' ? 'Menunggu Keputusan (Wajib)' : 'Menunggu Keputusan (Opsional)';
  }

  const slotBrief = slotIdentifier === 'hero' ? null : BATCH_1_SUPPORTING_BRIEFS[`${articleId}-${slotIdentifier}`];
  const slotName =
    slotIdentifier === 'hero'
      ? 'Gambar Utama (Hero)'
      : slotBrief?.mainSubject
      ? `Slot ${slotIdentifier}: ${slotBrief.mainSubject.split('—')[0].trim()}`
      : `Slot ${slotIdentifier}`;

  const targetSection =
    slotIdentifier === 'hero'
      ? 'Sampul / Bagian Atas Artikel'
      : slotBrief?.articleSection || 'Bagian Pembahasan Relevan';

  const matchedCanonicalAsset = canonicalActiveAssetIds.find((id) =>
    id.includes(`_${articleId}_${slotIdentifier.toLowerCase()}_`) ||
    id.includes(`_${articleId}_${slotIdentifier.toLowerCase()}`)
  ) || null;
  const isCanonicallyBound = Boolean(matchedCanonicalAsset);

  return {
    article_id: articleId,
    slot_identifier: slotIdentifier,
    slot_key: slotKey,
    slot_type: slotIdentifier === 'hero' ? 'HERO' : 'SUPPORTING',
    slot_name: slotName,
    target_section: targetSection,
    requirement,
    decision_status: decisionStatus,
    status_label: statusLabel,
    selected_candidate_id: isSkipped ? null : winningId,
    candidates: evaluatedCandidates,
    can_skip: requirement === 'OPTIONAL' && decisionStatus !== 'DECISION_COMPLETE',
    is_skipped: isSkipped,
    is_canonically_bound: isCanonicallyBound,
    canonical_asset_id: matchedCanonicalAsset,
    notes: persistedDecision?.notes
  };
}

/**
 * Evaluates all slots for an article.
 */
export function evaluateArticleMedia(
  articleId: number,
  allCandidates: ExperimentalMediaCandidate[] = loadCandidatesLedger()
): ArticleMediaDecisionSummary {
  const heroSlot = evaluateSlot(articleId, 'hero', allCandidates);
  const s1Slot = evaluateSlot(articleId, 'S1', allCandidates);
  const s2Slot = evaluateSlot(articleId, 'S2', allCandidates);

  const slots = [heroSlot, s1Slot, s2Slot];
  const totalSlots = slots.length;
  const completedSlots = slots.filter((s) => s.decision_status === 'DECISION_COMPLETE' || s.decision_status === 'SKIPPED').length;
  const pendingRequiredSlots = slots.filter((s) => s.requirement === 'REQUIRED' && s.decision_status !== 'DECISION_COMPLETE').length;

  return {
    article_id: articleId,
    hero_slot: heroSlot,
    s1_slot: s1Slot,
    s2_slot: s2Slot,
    total_slots: totalSlots,
    completed_slots: completedSlots,
    pending_required_slots: pendingRequiredSlots,
    is_all_decisions_complete: pendingRequiredSlots === 0 && completedSlots === totalSlots
  };
}

/**
 * Counts actionable pending media decisions across articles.
 * Crucial invariant: Unselected alternative candidates do NOT contribute to this count.
 */
export function getPendingMediaDecisions(
  articleIds: number[] = [9993, 9999, 10000]
): PendingMediaDecision[] {
  const allCandidates = loadCandidatesLedger();
  const pending: PendingMediaDecision[] = [];

  for (const artId of articleIds) {
    const summary = evaluateArticleMedia(artId, allCandidates);
    const slots = [summary.hero_slot, summary.s1_slot, summary.s2_slot];

    for (const slot of slots) {
      if (slot.decision_status === 'NEEDS_DECISION' || slot.decision_status === 'NEEDS_REPLACEMENT') {
        const availableCount = slot.candidates.filter(
          (c) => c.selection_status === 'AVAILABLE' || c.selection_status === 'NOT_SELECTED'
        ).length;

        pending.push({
          article_id: artId,
          slot_identifier: slot.slot_identifier,
          slot_key: slot.slot_key,
          slot_name: slot.slot_name,
          requirement: slot.requirement,
          reason:
            slot.decision_status === 'NEEDS_REPLACEMENT'
              ? 'Seluruh kandidat ditolak; membutuhkan regenerasi atau pengganti'
              : slot.requirement === 'REQUIRED'
              ? 'Slot visual wajib belum memiliki kandidat terpilih'
              : 'Slot visual opsional belum diputuskan (pilih atau lewati)',
          available_candidates_count: availableCount
        });
      }
    }
  }

  return pending;
}

export interface RecordSelectionParams {
  candidateId?: string;
  articleId?: number;
  slotIdentifier?: 'hero' | 'S1' | 'S2';
  action: 'select' | 'reject' | 'skip_slot' | 'unskip_slot' | 'reset';
  actor?: string;
  notes?: string;
}

/**
 * Records an editorial media selection or slot action atomically.
 */
export function recordSelectionDecision(params: RecordSelectionParams): {
  success: boolean;
  action: string;
  affectedCandidateId?: string;
  slot?: EvaluatedSlot;
} {
  const { candidateId, articleId, slotIdentifier, action, actor = 'Chief Editor', notes } = params;
  const now = new Date().toISOString();

  // Handle slot-level skip / unskip
  if (action === 'skip_slot' || action === 'unskip_slot') {
    if (!articleId || !slotIdentifier) {
      throw new Error('MISSING_SLOT_TARGET: articleId and slotIdentifier required for skip/unskip.');
    }

    const req = getSlotRequirement(articleId, slotIdentifier);
    if (action === 'skip_slot' && req === 'REQUIRED') {
      throw new Error(`CANNOT_SKIP_REQUIRED_SLOT: Slot '${slotIdentifier}' pada artikel ${articleId} berstatus WAJIB (REQUIRED) dan tidak dapat dilewati.`);
    }

    const slotDecisions = loadPersistedSlotDecisions();
    const existingIdx = slotDecisions.findIndex(
      (d) => d.article_id === articleId && d.slot_identifier === slotIdentifier
    );

    if (action === 'skip_slot') {
      const newEntry: PersistedSlotDecision = {
        article_id: articleId,
        slot_identifier: slotIdentifier,
        slot_key: resolveSlotKey(articleId, slotIdentifier),
        status: 'SKIPPED',
        decided_by: actor,
        decided_at: now,
        notes: notes || 'Dilewati secara eksplisit oleh Chief Editor (Slot Opsional)'
      };
      if (existingIdx >= 0) {
        slotDecisions[existingIdx] = newEntry;
      } else {
        slotDecisions.push(newEntry);
      }
    } else {
      // unskip
      if (existingIdx >= 0) {
        slotDecisions.splice(existingIdx, 1);
      }
    }

    savePersistedSlotDecisions(slotDecisions);
    const updatedSlot = evaluateSlot(articleId, slotIdentifier, loadCandidatesLedger());
    return { success: true, action, slot: updatedSlot };
  }

  // Handle candidate-level select / reject / reset
  if (!candidateId) {
    throw new Error('MISSING_CANDIDATE_ID: candidateId required.');
  }

  const candidates = loadCandidatesLedger();
  const targetCandidate = candidates.find((c) => c.id === candidateId);
  if (!targetCandidate) {
    throw new Error(`CANDIDATE_NOT_FOUND: Candidate with id '${candidateId}' not found.`);
  }

  const targetArtId = targetCandidate.article_id;
  const targetSlotKey = (targetCandidate.visual_brief?.slotKey || targetCandidate.media_role || 'featured').toLowerCase();

  if (action === 'select') {
    // 1. Mark this candidate as APPROVED and SELECTED
    targetCandidate.approval_status = 'APPROVED';
    (targetCandidate as any).selection_status = 'SELECTED';
    targetCandidate.reviewed_by = actor;
    targetCandidate.reviewed_at = now;
    targetCandidate.review_notes = notes || 'Terpilih untuk artikel via Inspeksi Visual';

    if (!targetCandidate.approval_history) targetCandidate.approval_history = [];
    targetCandidate.approval_history.unshift({
      action: 'approve',
      previous_status: 'PENDING_REVIEW',
      new_status: 'APPROVED',
      actor,
      timestamp: now,
      notes: targetCandidate.review_notes
    });

    // 2. Mark any competing candidates for the same article & slot as NOT_SELECTED
    // E.g. If selecting FLUX for hero, SDXL for hero becomes NOT_SELECTED
    for (const c of candidates) {
      if (c.id === candidateId) continue;
      if (c.article_id !== targetArtId) continue;

      const otherSlotKey = (c.visual_brief?.slotKey || c.media_role || 'featured').toLowerCase();
      const isSameSlot =
        (targetSlotKey.includes('hero') && otherSlotKey.includes('hero')) ||
        (targetSlotKey.includes('s1') && otherSlotKey.includes('s1')) ||
        (targetSlotKey.includes('s2') && otherSlotKey.includes('s2')) ||
        targetSlotKey === otherSlotKey;

      if (isSameSlot) {
        // Demote previous winner or pending competing alternative to NOT_SELECTED
        c.approval_status = 'NOT_SELECTED' as any;
        (c as any).selection_status = 'NOT_SELECTED';
        if (!c.approval_history) c.approval_history = [];
        c.approval_history.unshift({
          action: 'reset',
          previous_status: c.approval_status,
          new_status: 'NOT_SELECTED' as any,
          actor,
          timestamp: now,
          notes: `Tidak dipilih: kandidat '${candidateId}' dipilih untuk slot ini.`
        });
      }
    }

    saveCandidatesLedger(candidates);
    return { success: true, action, affectedCandidateId: candidateId };
  }

  if (action === 'reject') {
    targetCandidate.approval_status = 'REJECTED';
    (targetCandidate as any).selection_status = 'REJECTED';
    targetCandidate.reviewed_by = actor;
    targetCandidate.reviewed_at = now;
    targetCandidate.review_notes = notes || 'Ditolak via Inspeksi Visual';

    if (!targetCandidate.approval_history) targetCandidate.approval_history = [];
    targetCandidate.approval_history.unshift({
      action: 'reject',
      previous_status: targetCandidate.approval_status,
      new_status: 'REJECTED',
      actor,
      timestamp: now,
      notes: targetCandidate.review_notes
    });

    saveCandidatesLedger(candidates);
    return { success: true, action, affectedCandidateId: candidateId };
  }

  if (action === 'reset') {
    targetCandidate.approval_status = 'PENDING_REVIEW';
    (targetCandidate as any).selection_status = 'AVAILABLE';
    targetCandidate.reviewed_by = null;
    targetCandidate.reviewed_at = null;
    targetCandidate.review_notes = null;

    if (!targetCandidate.approval_history) targetCandidate.approval_history = [];
    targetCandidate.approval_history.unshift({
      action: 'reset',
      previous_status: targetCandidate.approval_status,
      new_status: 'PENDING_REVIEW',
      actor,
      timestamp: now,
      notes: 'Pilihan di-reset ke status tersedia'
    });

    saveCandidatesLedger(candidates);
    return { success: true, action, affectedCandidateId: candidateId };
  }

  throw new Error(`UNKNOWN_ACTION: Action '${action}' is not supported.`);
}

/**
 * Reconciles the persisted Batch 1 candidates manifest with correct selection semantics.
 * Ensures unselected hero alternatives are NOT_SELECTED, superseded versions are SUPERSEDED,
 * and valid existing approvals are strictly preserved.
 */
export function reconcileBatch1Manifest(): {
  reconciledCount: number;
  changes: Array<{ id: string; old_status: string; new_selection_status: CandidateSelectionStatus }>;
} {
  const candidates = loadCandidatesLedger();
  const changes: Array<{ id: string; old_status: string; new_selection_status: CandidateSelectionStatus }> = [];

  for (const artId of [9993, 9999, 10000]) {
    for (const slotId of ['hero', 'S1', 'S2'] as const) {
      const slot = evaluateSlot(artId, slotId, candidates);
      for (const evalCand of slot.candidates) {
        const c = candidates.find((item) => item.id === evalCand.candidate.id);
        if (!c) continue;

        const currentSelectionStatus = (c as any).selection_status;
        const targetSelectionStatus = evalCand.selection_status;

        if (currentSelectionStatus !== targetSelectionStatus) {
          (c as any).selection_status = targetSelectionStatus;
          changes.push({
            id: c.id,
            old_status: c.approval_status,
            new_selection_status: targetSelectionStatus
          });
        }
      }
    }
  }

  if (changes.length > 0) {
    saveCandidatesLedger(candidates);
  }

  return { reconciledCount: changes.length, changes };
}

export interface WizardStep {
  stepNumber: number; // 1 to 9
  articleId: number;
  articleCode: string;
  articleTitle: string;
  articleSlug: string;
  slotIdentifier: 'hero' | 'S1' | 'S2';
  slotType: SlotType;
  slotName: string;
  targetSection: string;
  requirement: SlotRequirement;
  evaluatedSlot: EvaluatedSlot;
  isComplete: boolean;
  isSkipped: boolean;
  isCanonicallyBound: boolean;
  canonicalAssetId: string | null;
  selectedCandidateId: string | null;
  activeCandidate: EvaluatedCandidate | null;
  competingCandidates: EvaluatedCandidate[];
  caption: string;
  altText: string;
  purpose: string;
  recommendedMethod?: string;
  notes?: string;
}

export interface Batch1WizardSummary {
  steps: WizardStep[];
  totalSlots: number;
  totalCompleted: number;
  totalRemainingRequired: number;
  firstIncompleteStepNumber: number | null;
  isAllComplete: boolean;
  articlesSummary: Array<{
    articleId: number;
    title: string;
    slug: string;
    isFullyComplete: boolean;
    heroComplete: boolean;
    s1Complete: boolean;
    s2Complete: boolean;
    canonicalBindingsComplete: boolean;
  }>;
}

/**
 * Returns structured Batch 1 Wizard Steps representing 1 actionable task per media slot.
 */
export function getBatch1WizardSteps(
  allCandidates?: ExperimentalMediaCandidate[],
  canonicalActiveAssetIds: string[] = []
): Batch1WizardSummary {
  const candidates = allCandidates || loadCandidatesLedger();

  const articleMeta: Record<number, { code: string; title: string; slug: string }> = {
    9993: {
      code: 'ARTICLE_A',
      title: 'Dinding Rembes dan Cat Menggelembung',
      slug: 'dinding-rembes-dan-cat-menggelembung-cara-membedakan-masalah-talang-plesteran-kelembapan-tanah'
    },
    9999: {
      code: 'ARTICLE_B',
      title: '7 Ide Menata Balkon Rumah Kecil',
      slug: '7-ide-menata-balkon-rumah-kecil-agar-nyaman'
    },
    10000: {
      code: 'ARTICLE_C',
      title: 'Menata Denah Rumah Lebar 5–6 Meter',
      slug: 'menata-denah-rumah-lebar-5-6-meter-solusi-sirkulasi-bukaan-ruang-tengah-tidak-pengap'
    }
  };

  const slotDefinitions: Array<{
    articleId: number;
    slotIdentifier: 'hero' | 'S1' | 'S2';
    slotType: SlotType;
    slotName: string;
    targetSection: string;
    caption: string;
    altText: string;
    purpose: string;
    recommendedMethod?: string;
  }> = [
    // Step 1: Article #9993 - Hero
    {
      articleId: 9993,
      slotIdentifier: 'hero',
      slotType: 'HERO',
      slotName: 'Featured Hero Cover',
      targetSection: 'Header Utama Artikel',
      caption: 'Dinding rembes bagian bawah dengan plesteran terkelupas dan cat menggelembung pada rumah tropis.',
      altText: 'Dinding bata rumah lembap dengan cat mengelupas dan bercak jamur akibat rembesan air.',
      purpose: 'Visualisasi cover artikel pembuka untuk mengenali kerusakan rembesan dinding secara realistis.',
      recommendedMethod: 'Cloudflare Workers AI (FLUX.1 Schnell)'
    },
    // Step 2: Article #9993 - S1
    {
      articleId: 9993,
      slotIdentifier: 'S1',
      slotType: 'SUPPORTING',
      slotName: 'Diagram Jalur Rembesan',
      targetSection: 'Identifikasi Gejala & Pola Kerusakan',
      caption: 'Diagram potongan melintang dinding mengidentifikasi 3 zona sumber rembesan: atap/talang, tampias dinding luar, dan rembesan tanah kapiler.',
      altText: 'Diagram teknis arsitektur potongan dinding memperlihatkan jalur pergerakan air dari talang bocor, retak rambut, dan naiknya air tanah.',
      purpose: 'Memberikan panduan teknis visual bagi pemilik rumah untuk mendiagnosis asal sumber rembesan.',
      recommendedMethod: 'Deterministic Architectural SVG Engine'
    },
    // Step 3: Article #9993 - S2
    {
      articleId: 9993,
      slotIdentifier: 'S2',
      slotType: 'SUPPORTING',
      slotName: 'Detail Cat Menggelembung & Garam Ef floresensi',
      targetSection: 'Tanda Fisik Kelembapan Tanah Naik (Rising Damp)',
      caption: 'Close-up kerusakan dinding dengan kristal garam putih (efflorescence) dan lapisan cat lateks terangkat gelembung udara.',
      altText: 'Tampilan dekat lapisan cat dinding rumah menggelembung dan serbuk putih garam akibat rembesan kelembapan tanah kapiler.',
      purpose: 'Menunjukkan detail mikroskopis perbedaan cat menggelembung karena rising damp vs rembesan biasa.',
      recommendedMethod: 'Cloudflare Workers AI (FLUX.1 Schnell)'
    },
    // Step 4: Article #9999 - Hero
    {
      articleId: 9999,
      slotIdentifier: 'hero',
      slotType: 'HERO',
      slotName: 'Featured Hero Cover',
      targetSection: 'Header Utama Artikel',
      caption: 'Penataan balkon mungil 1.2 x 2.4 meter dengan ubin decking kayu interlocking dan meja gantung pada railing besi.',
      altText: 'Balkon kecil lantai dua rumah dengan lantai decking kayu interlocking, meja lipat gantung pada railing besi, dan tanaman vertikal.',
      purpose: 'Menampilkan solusi inspiratif penataan balkon kompak tropis yang nyaman dan teduh tanpa membuat sempit.',
      recommendedMethod: 'Cloudflare Workers AI (FLUX.1 Schnell)'
    },
    // Step 5: Article #9999 - S1
    {
      articleId: 9999,
      slotIdentifier: 'S1',
      slotType: 'SUPPORTING',
      slotName: 'Meja Gantung Railing Balkon',
      targetSection: 'Zona Sirkulasi & Batas Beban',
      caption: 'Detail meja lipat gantung berbahan kayu solid yang dikaitkan kuat pada struktur railing balkon besi hollow.',
      altText: 'Detail konstruksi meja kerja gantung lipat yang terpasang pada railing balkon apartemen/rumah sempit.',
      purpose: 'Menjelaskan efisiensi ruang meja gantung tanpa kaki meja yang mengganggu jalur sirkulasi balkon.',
      recommendedMethod: 'Cloudflare Workers AI (FLUX.1 Schnell)'
    },
    // Step 6: Article #9999 - S2
    {
      articleId: 9999,
      slotIdentifier: 'S2',
      slotType: 'SUPPORTING',
      slotName: 'Proteksi Cuaca Railing Balkon',
      targetSection: 'Material & Proteksi Cuaca',
      caption: 'Aplikasi tanaman pelindung tampias dan kanopi kisi-kisi kayu pelindung panas sore pada balkon rumah.',
      altText: 'Balkon rumah tropis dengan kisi-kisi pelindung sinar matahari barat dan tanaman sirih gading penahan tampias hujan.',
      purpose: 'Menampilkan proteksi cuaca alami terhadap panas matahari dan tampias hujan iklim tropis.',
      recommendedMethod: 'Cloudflare Workers AI (FLUX.1 Schnell)'
    },
    // Step 7: Article #10000 - Hero
    {
      articleId: 10000,
      slotIdentifier: 'hero',
      slotType: 'HERO',
      slotName: 'Featured Hero Cover',
      targetSection: 'Header Utama Artikel',
      caption: 'Visualisasi interior ruang tengah rumah lebar 5–6 meter dengan bukaan taman kering (inner court) sebagai penyuplai ventilasi silang.',
      altText: 'Interior rumah tropis modern berlebar 6 meter dengan bukaan taman kering di ruang tengah dan pintu kaca geser.',
      purpose: 'Visualisasi ruang tengah rumah lebar 5–6 meter yang terang dan sejuk berkat bukaan vertikal void inner court.',
      recommendedMethod: 'Cloudflare Workers AI (SDXL Lightning)'
    },
    // Step 8: Article #10000 - S1
    {
      articleId: 10000,
      slotIdentifier: 'S1',
      slotType: 'SUPPORTING',
      slotName: 'Perbandingan Layout 5m vs 6m',
      targetSection: 'Perbandingan Layout 5m vs 6m',
      caption: 'Komparasi zoning denah rumah lebar 5 meter (sirkulasi linear satu sisi) vs lebar 6 meter (ruang keluarga & makan leluasa berdampingan).',
      altText: 'Denah komparatif arsitektur tata ruang rumah lebar 5 meter dibandingkan rumah lebar 6 meter dengan penempatan inner court.',
      purpose: 'Membandingkan trade-off ruang sirkulasi antara lebar 5 meter dan 6 meter secara jelas dan terukur.',
      recommendedMethod: 'Deterministic Architectural SVG Engine'
    },
    // Step 9: Article #10000 - S2
    {
      articleId: 10000,
      slotIdentifier: 'S2',
      slotType: 'SUPPORTING',
      slotName: 'Diagram Void & Sirkulasi Silang (Stack Ventilation)',
      targetSection: 'Potongan Void Tangga & Sirkulasi Silang',
      caption: 'Potongan vertikal rumah 2 lantai memperlihatkan efek cerobong udara (stack ventilation) melalui void tangga dan bukaan atas.',
      altText: 'Diagram aliran udara potongan vertikal rumah dua lantai menunjukkan udara hangat keluar melalui void atap dan udara sejuk masuk dari bawah.',
      purpose: 'Menjelaskan prinsip fisika bangunan efek cerobong udara (stack effect) agar ruang tengah tidak pengap.',
      recommendedMethod: 'Deterministic Architectural SVG Engine'
    }
  ];

  let totalCompleted = 0;
  let totalRemainingRequired = 0;
  let firstIncompleteStepNumber: number | null = null;

  const steps: WizardStep[] = slotDefinitions.map((def, index) => {
    const stepNumber = index + 1;
    const art = articleMeta[def.articleId];
    const evaluatedSlot = evaluateSlot(def.articleId, def.slotIdentifier, candidates, canonicalActiveAssetIds);
    const isComplete = evaluatedSlot.decision_status === 'DECISION_COMPLETE' || evaluatedSlot.decision_status === 'SKIPPED';
    const isSkipped = evaluatedSlot.decision_status === 'SKIPPED';

    if (isComplete) {
      totalCompleted++;
    } else if (evaluatedSlot.requirement === 'REQUIRED') {
      totalRemainingRequired++;
      if (firstIncompleteStepNumber === null) {
        firstIncompleteStepNumber = stepNumber;
      }
    }

    const selectedCand = evaluatedSlot.candidates.find((c) => c.selection_status === 'SELECTED');
    const availableCands = evaluatedSlot.candidates.filter((c) => c.selection_status !== 'SUPERSEDED');
    const activeCandidate = selectedCand || availableCands[0] || evaluatedSlot.candidates[0] || null;

    return {
      stepNumber,
      articleId: def.articleId,
      articleCode: art.code,
      articleTitle: art.title,
      articleSlug: art.slug,
      slotIdentifier: def.slotIdentifier,
      slotType: def.slotType,
      slotName: def.slotName,
      targetSection: def.targetSection,
      requirement: evaluatedSlot.requirement,
      evaluatedSlot,
      isComplete,
      isSkipped,
      isCanonicallyBound: evaluatedSlot.is_canonically_bound,
      canonicalAssetId: evaluatedSlot.canonical_asset_id,
      selectedCandidateId: evaluatedSlot.selected_candidate_id,
      activeCandidate,
      competingCandidates: evaluatedSlot.candidates,
      caption: def.caption,
      altText: def.altText,
      purpose: def.purpose,
      recommendedMethod: def.recommendedMethod,
      notes: evaluatedSlot.notes
    };
  });

  const isAllComplete = totalCompleted === 9 || (totalRemainingRequired === 0 && totalCompleted >= 6);

  const articlesSummary = [9993, 9999, 10000].map((artId) => {
    const art = articleMeta[artId];
    const artSteps = steps.filter((s) => s.articleId === artId);
    const heroStep = artSteps.find((s) => s.slotIdentifier === 'hero');
    const s1Step = artSteps.find((s) => s.slotIdentifier === 'S1');
    const s2Step = artSteps.find((s) => s.slotIdentifier === 'S2');

    const heroComplete = heroStep?.isComplete ?? false;
    const s1Complete = s1Step?.isComplete ?? false;
    const s2Complete = s2Step?.isComplete ?? false;
    const isFullyComplete = heroComplete && s1Complete && s2Complete;

    return {
      articleId: artId,
      title: art.title,
      slug: art.slug,
      isFullyComplete,
      heroComplete,
      s1Complete,
      s2Complete,
      canonicalBindingsComplete: true
    };
  });

  return {
    steps,
    totalSlots: 9,
    totalCompleted,
    totalRemainingRequired,
    firstIncompleteStepNumber,
    isAllComplete,
    articlesSummary
  };
}
