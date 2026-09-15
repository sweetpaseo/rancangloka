/**
 * RancangLoka — First Genuine Article Execution Gate & Preflight Checklist
 * Milestone: SOAK-0
 * 
 * Inspects all required production criteria before the first authentic
 * editorial article may be published under supervised control.
 * 
 * Returns READY only if all 13 strict checks pass. Otherwise returns HOLD.
 */

import {
  type FirstGenuineArticlePreflight,
  type FirstGenuineArticleGateResult
} from './safety-types.ts';

export async function evaluateFirstGenuineArticleGate(
  preflight: FirstGenuineArticlePreflight
): Promise<FirstGenuineArticleGateResult> {
  const reasons: string[] = [];

  if (!preflight.production_health_ok) {
    reasons.push('PRODUCTION_HEALTH_NOT_OK');
  }
  if (!preflight.automation_mode_controlled) {
    reasons.push('AUTOMATION_MODE_NOT_CONTROLLED (Must be CONTROLLED mode)');
  }
  if (!preflight.kill_switch_disengaged) {
    reasons.push('KILL_SWITCH_ENGAGED');
  }
  if (!preflight.circuit_breakers_closed) {
    reasons.push('CIRCUIT_BREAKER_NOT_CLOSED');
  }
  if (!preflight.article_editorial_guards_pass) {
    reasons.push('EDITORIAL_GUARDS_FAILED (Contract/Monetary/Citation violation)');
  }
  if (!preflight.content_hash_verified) {
    reasons.push('CONTENT_HASH_UNVERIFIED');
  }
  if (!preflight.media_validated) {
    reasons.push('MEDIA_NOT_VALIDATED');
  }
  if (!preflight.approval_verified) {
    reasons.push('EDITORIAL_APPROVAL_MISSING');
  }
  if (!preflight.readiness_ready_to_schedule) {
    reasons.push('READINESS_NOT_READY_TO_SCHEDULE');
  }
  if (!preflight.plan_active) {
    reasons.push('NO_ACTIVE_PLAN');
  }
  if (!preflight.canonical_conflict_free) {
    reasons.push('CANONICAL_CONFLICT_DETECTED');
  }
  if (!preflight.publisher_ready) {
    reasons.push('PUBLISHER_NOT_READY');
  }
  if (!preflight.production_cron_disabled) {
    reasons.push('PRODUCTION_CRON_NOT_DISABLED (Must remain OFF during supervised publication)');
  }

  if (reasons.length > 0) {
    return {
      status: 'HOLD',
      reasons,
      preflight
    };
  }

  return {
    status: 'READY',
    reasons: [],
    preflight
  };
}
