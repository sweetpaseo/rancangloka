/**
 * ============================================================================
 * RancangLoka Product Review Desk (PRODUCT_REVIEW_AFFILIATE-1B)
 * Centralized Typed Freshness Policy
 *
 * Invariant:
 * FRESHNESS_POLICY_MUST_BE_CONFIGURABLE_AND_EXPLICIT
 * Freshness limits are not hardcoded physical truths; they are explicitly
 * defined, configurable editorial thresholds that vary by entity type.
 * ============================================================================
 */

export interface FreshnessPolicyConfig {
  product_identity_max_age_days: number;
  spec_snapshot_max_age_days: number;
  review_snapshot_max_age_days: number;
  offer_max_age_days: number;
  price_snapshot_max_age_hours: number;
  /** Category-specific or source-specific override durations in days */
  overrides?: Record<string, number>;
}

export const DEFAULT_FRESHNESS_POLICY: FreshnessPolicyConfig = Object.freeze({
  product_identity_max_age_days: 180,
  spec_snapshot_max_age_days: 90,
  review_snapshot_max_age_days: 30,
  offer_max_age_days: 7,
  price_snapshot_max_age_hours: 48,
  overrides: {}
});

export type FreshnessStatus = 'FRESH' | 'STALE' | 'EXPIRED' | 'INVALID_TIMESTAMP';

export interface FreshnessEvaluation {
  status: FreshnessStatus;
  is_fresh: boolean;
  captured_at: string;
  reference_time: string;
  age_ms: number;
  max_allowed_age_ms: number;
  days_remaining: number;
}

/**
 * Checks whether an ISO timestamp is within max allowed age.
 */
export function isFresh(
  capturedAt: string,
  maxAgeMs: number,
  referenceTime: string = new Date().toISOString()
): boolean {
  const capturedMs = Date.parse(capturedAt);
  const refMs = Date.parse(referenceTime);
  if (Number.isNaN(capturedMs) || Number.isNaN(refMs)) {
    return false;
  }
  const age = refMs - capturedMs;
  return age >= 0 && age <= maxAgeMs;
}

/**
 * Evaluates freshness for a specific product review entity type.
 */
export function evaluateEntityFreshness(
  entityType: 'product' | 'spec_snapshot' | 'review_snapshot' | 'offer' | 'price_snapshot',
  capturedAt: string,
  options?: {
    config?: FreshnessPolicyConfig;
    referenceTime?: string;
    overrideKey?: string;
  }
): FreshnessEvaluation {
  const config = options?.config ?? DEFAULT_FRESHNESS_POLICY;
  const refTime = options?.referenceTime ?? new Date().toISOString();
  const refMs = Date.parse(refTime);
  const capMs = Date.parse(capturedAt);

  if (Number.isNaN(capMs) || Number.isNaN(refMs)) {
    return {
      status: 'INVALID_TIMESTAMP',
      is_fresh: false,
      captured_at: capturedAt,
      reference_time: refTime,
      age_ms: -1,
      max_allowed_age_ms: 0,
      days_remaining: 0
    };
  }

  // Determine max allowed age
  let maxAgeMs: number;
  if (options?.overrideKey && config.overrides?.[options.overrideKey]) {
    maxAgeMs = config.overrides[options.overrideKey] * 24 * 60 * 60 * 1000;
  } else {
    switch (entityType) {
      case 'product':
        maxAgeMs = config.product_identity_max_age_days * 24 * 60 * 60 * 1000;
        break;
      case 'spec_snapshot':
        maxAgeMs = config.spec_snapshot_max_age_days * 24 * 60 * 60 * 1000;
        break;
      case 'review_snapshot':
        maxAgeMs = config.review_snapshot_max_age_days * 24 * 60 * 60 * 1000;
        break;
      case 'offer':
        maxAgeMs = config.offer_max_age_days * 24 * 60 * 60 * 1000;
        break;
      case 'price_snapshot':
        maxAgeMs = config.price_snapshot_max_age_hours * 60 * 60 * 1000;
        break;
      default:
        maxAgeMs = 30 * 24 * 60 * 60 * 1000;
    }
  }

  const ageMs = refMs - capMs;
  const isWithinWindow = ageMs >= 0 && ageMs <= maxAgeMs;
  const daysRemaining = Math.max(0, Math.floor((maxAgeMs - ageMs) / (24 * 60 * 60 * 1000)));

  let status: FreshnessStatus;
  if (ageMs < 0) {
    status = 'INVALID_TIMESTAMP'; // Future timestamp
  } else if (isWithinWindow) {
    status = 'FRESH';
  } else if (ageMs <= maxAgeMs * 1.5) {
    status = 'STALE';
  } else {
    status = 'EXPIRED';
  }

  return {
    status,
    is_fresh: isWithinWindow,
    captured_at: capturedAt,
    reference_time: refTime,
    age_ms: ageMs,
    max_allowed_age_ms: maxAgeMs,
    days_remaining: daysRemaining
  };
}
