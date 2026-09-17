/**
 * RancangLoka — Adaptive Publication Planner Mathematical & Temporal Engine
 * Milestone: PUBLICATION-1
 * 
 * Invariants:
 * - 100% Deterministic (Zero AI/LLM models, zero random unseeded numbers)
 * - Operational Timezone: Asia/Jakarta (WIB, UTC+7)
 * - Quality Dominates Quota: If ready count < capacity, plans exactly ready count
 * - 20/day is NOT a universal quota (only a configurable ceiling for GROWING profile)
 */

function fnv1a32(str: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

function getRandomHex(byteCount: number): string {
  const bytes = new Uint8Array(byteCount);
  if (typeof crypto !== 'undefined' && crypto.getRandomValues) {
    crypto.getRandomValues(bytes);
  } else {
    for (let i = 0; i < byteCount; i++) {
      bytes[i] = Math.floor(Math.random() * 256);
    }
  }
  return Array.from(bytes, b => b.toString(16).padStart(2, '0')).join('');
}
import {
  PLANNER_PROFILE_NEW,
  PLANNER_PROFILE_GROWING,
  PLANNER_PROFILE_ESTABLISHED,
  PLANNER_PROFILE_HIGH_AUTHORITY,
  CANONICAL_TIMEZONE,
  PLANNER_VERSION,
  type PlannerProfile,
  type ProfileConfig,
  type ScoringWeights,
  type PlannerCandidate,
  type ScoredCandidate,
  type PlannedAssignment,
  type IndexHealthSignals
} from './planner-types.ts';

/**
 * Standard Profile Definitions
 */
export const DEFAULT_PROFILES: Record<PlannerProfile, ProfileConfig> = {
  [PLANNER_PROFILE_NEW]: {
    profile: PLANNER_PROFILE_NEW,
    baseCapacity: 4,               // Target: 3-5/day
    maxCeiling: 8,                 // Conservative ceiling
    minCapacity: 1,
    minSpacingMinutes: 150,        // 2.5h spacing
    categorySpacingMinutes: 240,   // 4h category spacing
    windowStartHour: 7,            // 07:00 WIB
    windowEndHour: 22,             // 22:00 WIB (15h operating spread)
    maxJitterMinutes: 15
  },
  [PLANNER_PROFILE_GROWING]: {
    profile: PLANNER_PROFILE_GROWING,
    baseCapacity: 8,               // Target: 6-12/day
    maxCeiling: 20,                // Configurable ceiling (NOT permanent fixed law)
    minCapacity: 2,
    minSpacingMinutes: 60,         // 1h spacing
    categorySpacingMinutes: 120,   // 2h category spacing
    windowStartHour: 7,            // 07:00 WIB
    windowEndHour: 22,             // 22:00 WIB
    maxJitterMinutes: 12
  },
  [PLANNER_PROFILE_ESTABLISHED]: {
    profile: PLANNER_PROFILE_ESTABLISHED,
    baseCapacity: 20,              // Target: 15-25/day
    maxCeiling: 40,
    minCapacity: 5,
    minSpacingMinutes: 30,         // 30 min spacing
    categorySpacingMinutes: 60,    // 1h category spacing
    windowStartHour: 6,            // 06:00 WIB
    windowEndHour: 23,             // 23:00 WIB (17h operating spread)
    maxJitterMinutes: 8
  },
  [PLANNER_PROFILE_HIGH_AUTHORITY]: {
    profile: PLANNER_PROFILE_HIGH_AUTHORITY,
    baseCapacity: 40,              // Scalable only when measured health supports it
    maxCeiling: 80,
    minCapacity: 10,
    minSpacingMinutes: 15,
    categorySpacingMinutes: 30,
    windowStartHour: 0,            // 24h continuous staggered
    windowEndHour: 24,
    maxJitterMinutes: 5
  }
};

export const DEFAULT_SCORING_WEIGHTS: ScoringWeights = {
  wAge: 0.35,
  wOperator: 0.40,
  wBalance: 0.25,
  pCannibalism: 50.0
};

/**
 * 1. Adaptive Capacity Calculation
 * Calculates safe daily publication volume from profile and feedback signals.
 */
export function calculateEffectiveCapacity(
  config: ProfileConfig,
  signals: IndexHealthSignals | undefined,
  eligibleCount: number,
  manualOverride?: number | null
): { effectiveCapacity: number; reasons: string[]; multipliers: Record<string, number> } {
  const reasons: string[] = [];
  const multipliers: Record<string, number> = {
    mIndex: 1.0,
    mCrawl: 1.0,
    mError: 1.0,
    mBacklog: 1.0
  };

  // If explicit human override within safety bounds
  if (manualOverride != null && Number.isFinite(manualOverride) && manualOverride > 0) {
    const safetyCap = Math.round(config.maxCeiling * 1.5);
    const clampedOverride = Math.min(manualOverride, safetyCap);
    reasons.push(`OPERATOR_CAPACITY_OVERRIDE_${clampedOverride}`);
    return {
      effectiveCapacity: Math.min(clampedOverride, eligibleCount),
      reasons,
      multipliers
    };
  }

  // If no feedback signals or unknown: use conservative baseline
  if (!signals || Object.keys(signals).length === 0) {
    reasons.push('BASELINE_PROFILE_CAPACITY_NO_TELEMETRY');
    const effective = Math.min(config.baseCapacity, eligibleCount);
    return { effectiveCapacity: effective, reasons, multipliers };
  }

  // A. Indexing Success Multiplier
  if (typeof signals.indexingSuccessRatio === 'number' && Number.isFinite(signals.indexingSuccessRatio)) {
    if (signals.indexingSuccessRatio >= 0.85) {
      multipliers.mIndex = 1.15;
      reasons.push('HIGH_INDEXING_RATIO_BOOST');
    } else if (signals.indexingSuccessRatio < 0.60) {
      multipliers.mIndex = 0.70;
      reasons.push('LOW_INDEXING_RATIO_THROTTLE');
    }
  }

  // B. Crawl Latency Multiplier
  if (typeof signals.medianIndexLatencyHours === 'number' && Number.isFinite(signals.medianIndexLatencyHours)) {
    if (signals.medianIndexLatencyHours <= 48) {
      multipliers.mCrawl = 1.10;
      reasons.push('FAST_CRAWL_LATENCY_BOOST');
    } else if (signals.medianIndexLatencyHours > 120) {
      multipliers.mCrawl = 0.80;
      reasons.push('SLUGGISH_CRAWL_LATENCY_THROTTLE');
    }
  }

  // C. Error Rate Multiplier
  if (typeof signals.publicationErrorRate === 'number' && Number.isFinite(signals.publicationErrorRate)) {
    if (signals.publicationErrorRate >= 0.02) {
      multipliers.mError = 0.40;
      reasons.push('ELEVATED_ERROR_RATE_RESTRICT');
    } else if (signals.publicationErrorRate >= 0.005) {
      multipliers.mError = 0.70;
      reasons.push('MODERATE_ERROR_RATE_THROTTLE');
    }
  }

  // D. Inventory Backlog Multiplier
  const backlogRatio = eligibleCount / Math.max(1, config.baseCapacity);
  if (backlogRatio >= 3.0 && multipliers.mIndex >= 1.0 && multipliers.mError >= 1.0) {
    multipliers.mBacklog = 1.25;
    reasons.push('HEALTHY_INVENTORY_BACKLOG_BOOST');
  }

  // Combine bounded multipliers
  const combined = multipliers.mIndex * multipliers.mCrawl * multipliers.mError * multipliers.mBacklog;
  const rawTarget = Math.round(config.baseCapacity * combined);
  
  // Clamp between minCapacity and maxCeiling
  const clamped = Math.max(config.minCapacity, Math.min(config.maxCeiling, rawTarget));
  reasons.push(`ADAPTIVE_CAPACITY_CLAMPED_${clamped}_OF_${config.maxCeiling}`);

  // Invariant: Quality Dominates Quota (never plan non-existent articles)
  const effective = Math.min(clamped, eligibleCount);
  if (effective < clamped) {
    reasons.push(`QUALITY_DOMINATES_QUOTA_CAPPED_BY_READY_COUNT_${eligibleCount}`);
  }

  return { effectiveCapacity: effective, reasons, multipliers };
}

/**
 * 2. Deterministic Jitter Algorithm
 * Produces reproducible pseudo-random seconds within [-maxJitterMinutes, +maxJitterMinutes]
 */
export function computeDeterministicJitter(
  dateStr: string,
  articleId: number,
  contentHash: string,
  plannerVersion: string,
  maxJitterMinutes: number
): number {
  if (maxJitterMinutes <= 0) return 0;
  const seedString = `${dateStr}:${articleId}:${contentHash}:${plannerVersion}`;
  const intVal = fnv1a32(seedString);
  // Map uniformly to [-1.0, 1.0]
  const normalized = (intVal / 0xffffffff) * 2 - 1;
  return Math.round(normalized * maxJitterMinutes * 60);
}

/**
 * 3. Deterministic Scoring and Ranking
 */
export function scoreAndRankCandidates(
  candidates: PlannerCandidate[],
  historicalPublished: Array<{ categoryId: number; focusKeyword?: string; publishedAt: string }>,
  weights: ScoringWeights = DEFAULT_SCORING_WEIGHTS,
  nowMs: number = Date.now()
): ScoredCandidate[] {
  // Count category distribution in trailing history (last 7 days)
  const categoryCounts = new Map<number, number>();
  for (const pub of historicalPublished) {
    categoryCounts.set(pub.categoryId, (categoryCounts.get(pub.categoryId) || 0) + 1);
  }
  const totalHistorical = historicalPublished.length || 1;

  // Recent focus keywords (last 72 hours) for cannibalization check
  const recentKeywords = new Set<string>();
  const seventyTwoHoursAgo = nowMs - 72 * 3600 * 1000;
  for (const pub of historicalPublished) {
    const pubTime = new Date(pub.publishedAt).getTime();
    if (pubTime >= seventyTwoHoursAgo && pub.focusKeyword) {
      recentKeywords.add(pub.focusKeyword.trim().toLowerCase());
    }
  }

  const scored: ScoredCandidate[] = candidates.map(c => {
    const reasons: string[] = [];

    // A. Age Score (FIFO wait time, older is higher)
    const evalTimeMs = new Date(c.readinessEvaluatedAt).getTime();
    const waitHours = Math.max(0, (nowMs - evalTimeMs) / (3600 * 1000));
    const ageScore = Math.min(100, waitHours * 2.5);
    reasons.push(`AGE_WAIT_${Math.round(waitHours)}H`);

    // B. Operator Priority Score (0-100)
    const operatorScore = Math.max(0, Math.min(100, c.operatorPriority || 0));
    if (operatorScore > 0) {
      reasons.push(`OPERATOR_PRIORITY_${operatorScore}`);
    }

    // C. Taxonomy Balance Score (underrepresented categories get boost)
    const catCount = categoryCounts.get(c.categoryId) || 0;
    const catShare = catCount / totalHistorical;
    // Lower share -> higher score
    const balanceScore = Math.max(0, Math.min(100, Math.round((1 - catShare) * 100)));
    reasons.push(`TAXONOMY_SHARE_${Math.round(catShare * 100)}PCT`);

    // D. Cannibalism Penalty
    let cannibalismPenalty = 0;
    if (c.focusKeyword && recentKeywords.has(c.focusKeyword.trim().toLowerCase())) {
      cannibalismPenalty = weights.pCannibalism;
      reasons.push('TOPIC_CANNIBALISM_CONFLICT_PENALTY');
    }

    // Weighted sum
    const priorityScore =
      weights.wAge * ageScore +
      weights.wOperator * operatorScore +
      weights.wBalance * balanceScore -
      cannibalismPenalty;

    return {
      ...c,
      priorityScore: Math.round(priorityScore * 100) / 100,
      scoreBreakdown: {
        ageScore,
        operatorScore,
        balanceScore,
        cannibalismPenalty
      },
      reasonCodes: reasons
    };
  });

  // Sort descending by priorityScore, tie-break deterministically
  scored.sort((a, b) => {
    if (b.priorityScore !== a.priorityScore) {
      return b.priorityScore - a.priorityScore;
    }
    // Tie-break: older readiness evaluated_at first
    const timeA = new Date(a.readinessEvaluatedAt).getTime();
    const timeB = new Date(b.readinessEvaluatedAt).getTime();
    if (timeA !== timeB) {
      return timeA - timeB;
    }
    // Final tie-break: article ID ascending
    return a.articleId - b.articleId;
  });

  return scored;
}

/**
 * 4. Temporal Window Sequencing
 * Assigns discrete publication slots with deterministic jitter and spacing enforcement.
 */
export function assignPublicationWindows(
  rankedCandidates: ScoredCandidate[],
  dateStr: string, // 'YYYY-MM-DD'
  config: ProfileConfig,
  capacity: number,
  plannerVersion: string = PLANNER_VERSION
): {
  planned: PlannedAssignment[];
  deferred: ScoredCandidate[];
} {
  const planned: PlannedAssignment[] = [];
  const deferred: ScoredCandidate[] = [];

  const candidatesToConsider = rankedCandidates.slice(0);
  const totalSlots = Math.min(capacity, candidatesToConsider.length);

  if (totalSlots <= 0) {
    return { planned, deferred: candidatesToConsider };
  }

  // Operating window in minutes from midnight WIB
  const startMinute = config.windowStartHour * 60;
  const endMinute = config.windowEndHour * 60;
  const totalOperatingMinutes = Math.max(60, endMinute - startMinute);

  // Spacing interval
  const slotIntervalMinutes = totalSlots === 1
    ? totalOperatingMinutes / 2
    : Math.floor(totalOperatingMinutes / totalSlots);

  // We place up to totalSlots
  let lastAssignedMinuteWib = -1;
  const categorySchedule: Array<{ categoryId: number; minuteWib: number }> = [];

  for (let slot = 1; slot <= totalSlots; slot++) {
    // Base minute for this slot
    const baseSlotMinute = totalSlots === 1
      ? Math.round(startMinute + totalOperatingMinutes / 2)
      : Math.round(startMinute + (slot - 0.5) * slotIntervalMinutes);

    // Pick best candidate from remaining that satisfies category spacing
    let candidateIndex = -1;
    for (let i = 0; i < candidatesToConsider.length; i++) {
      const cand = candidatesToConsider[i];
      // Check category spacing against already assigned slots
      const lastSameCat = categorySchedule.slice().reverse().find(c => c.categoryId === cand.categoryId);
      if (!lastSameCat || Math.abs(baseSlotMinute - lastSameCat.minuteWib) >= config.categorySpacingMinutes) {
        candidateIndex = i;
        break;
      }
    }

    // If no candidate satisfies category spacing, take the top candidate anyway to respect capacity
    if (candidateIndex === -1 && candidatesToConsider.length > 0) {
      candidateIndex = 0;
    }

    if (candidateIndex === -1) {
      break;
    }

    const [chosen] = candidatesToConsider.splice(candidateIndex, 1);

    // Compute deterministic jitter
    const jitterSec = computeDeterministicJitter(
      dateStr,
      chosen.articleId,
      chosen.contentHash,
      plannerVersion,
      config.maxJitterMinutes
    );

    // Candidate minute with jitter
    let targetMinuteWib = Math.round(baseSlotMinute + jitterSec / 60);

    // Ensure within window bounds
    targetMinuteWib = Math.max(startMinute + 5, Math.min(endMinute - 5, targetMinuteWib));

    // Ensure minimum spacing from previous assigned slot
    if (lastAssignedMinuteWib !== -1) {
      const minRequired = lastAssignedMinuteWib + config.minSpacingMinutes;
      if (targetMinuteWib < minRequired) {
        targetMinuteWib = Math.min(endMinute - 5, minRequired);
      }
    }
    lastAssignedMinuteWib = targetMinuteWib;
    categorySchedule.push({ categoryId: chosen.categoryId, minuteWib: targetMinuteWib });

    // Format local and UTC timestamps
    const hours = Math.floor(targetMinuteWib / 60);
    const minutes = targetMinuteWib % 60;
    const seconds = Math.abs(jitterSec) % 60;

    const pad = (n: number) => String(n).padStart(2, '0');
    const localTimeStr = `${dateStr} ${pad(hours)}:${pad(minutes)}:${pad(seconds)} WIB`;

    // Convert Asia/Jakarta (WIB = UTC+7) to UTC ISO
    // dateStr: YYYY-MM-DD
    const [y, m, d] = dateStr.split('-').map(Number);
    // UTC hours = hours - 7
    const utcDate = new Date(Date.UTC(y, m - 1, d, hours - 7, minutes, seconds));
    const utcIso = utcDate.toISOString();

    const planId = `plan_${getRandomHex(8)}`;

    const assignmentReasons = [
      ...chosen.reasonCodes,
      `SLOT_${slot}_OF_${totalSlots}`,
      `INTERVAL_${slotIntervalMinutes}M`,
      `JITTER_${jitterSec}S`
    ];

    planned.push({
      candidate: chosen,
      planId,
      slotIndex: slot,
      targetPublishAt: utcIso,
      targetPublishLocal: localTimeStr,
      timezone: CANONICAL_TIMEZONE,
      jitterSeconds: jitterSec,
      reasonCodes: assignmentReasons
    });
  }

  // Any remaining candidates are deferred to subsequent planning cycles
  deferred.push(...candidatesToConsider);

  return { planned, deferred };
}
