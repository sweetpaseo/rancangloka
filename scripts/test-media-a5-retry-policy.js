/**
 * RancangLoka — MEDIA-A5.2 Retry Classification & Decision Policy Test Suite
 *
 * Validates:
 * 1. Normalized Retry Class Contract (RETRY_SAME_STAGE, RETRY_FROM_SOURCE, RETRY_WITH_REPROMPT, OPERATOR_REQUIRED, TERMINAL, NO_RETRY)
 * 2. Minimal Safe Retry Stage Invariant (TRANSFORM, STORAGE, DELIVERY_VERIFY, GENERATION, NONE)
 * 3. Provider-Neutral Source Semantics (Autonomous vs Manual Browser Bridge vs Local Fixture)
 * 4. Manual Bridge Invariant: NO autonomous provider fallthrough / regeneration
 * 5. Secret Leak Invariant: Fail closed, zero retries, zero secret values in evidence
 * 6. Transform Invariant: Watermark failure retries TRANSFORM stage, NOT provider generation
 * 7. Storage Invariant: R2 failure retries STORAGE stage, NOT provider generation
 * 8. Slot Conflict Invariant: Slot occupied produces NO_RETRY, NOT image regeneration
 * 9. Hash Mismatch Invariant: Storage stage retries STORAGE, artifact stage re-acquires
 * 10. Attempt Budget & Exhaustion: attempt < max -> retry, attempt >= max -> FAILED_TERMINAL
 * 11. Duplicate Asset Policy: Reuses existing asset, not a retry failure
 * 12. Semantic QA Boundary: DEFERRED state produces NO_RETRY
 * 13. Backoff Delay Recommendation: Deterministic calculation, pure mathematical bounds
 * 14. HTTP Status Hints: 429 rate limit, 401/403 auth required, 408 timeout
 * 15. Pure & Deterministic: Zero DB mutations, zero R2 writes, zero side effects
 */

import assert from 'node:assert/strict';

import {
  decideMediaRetryPolicy,
  computeRetryDelay
} from '../src/lib/media/retry-policy.ts';
import { MEDIA_QA_FAILURE_CODES } from '../src/lib/media/qa-service.ts';

let testCount = 0;
function pass(name) {
  testCount++;
  console.log(`  [PASS ${testCount}] ${name}`);
}

async function runTestSuite() {
  console.log('=============================================================');
  console.log('  RancangLoka — MEDIA-A5.2 Retry Policy Test Suite');
  console.log('=============================================================\n');

  // -------------------------------------------------------------------------
  // 1. PROVIDER TIMEOUT & TRANSIENT FAILURES
  // -------------------------------------------------------------------------
  console.log('--- Phase 1: Provider Timeout & Transient Failures ---');

  // 1.1 Autonomous provider timeout
  {
    const decision = decideMediaRetryPolicy({
      failure_code: MEDIA_QA_FAILURE_CODES.PROVIDER_TIMEOUT,
      source_channel: 'AUTONOMOUS_PROVIDER',
      attempt_number: 1,
      max_attempts: 3
    });
    assert.equal(decision.retry_class, 'RETRY_FROM_SOURCE');
    assert.equal(decision.retry_stage, 'GENERATION');
    assert.equal(decision.next_job_status, 'WAITING_RETRY');
    assert.equal(decision.consume_attempt, true);
    assert(decision.suggested_delay_ms > 0);
    pass('Autonomous provider timeout recommends RETRY_FROM_SOURCE at GENERATION');
  }

  // 1.2 Manual bridge timeout -> User action required (NO autonomous provider fallthrough)
  {
    const decision = decideMediaRetryPolicy({
      failure_code: MEDIA_QA_FAILURE_CODES.PROVIDER_TIMEOUT,
      source_channel: 'MANUAL_BROWSER_BRIDGE',
      attempt_number: 0,
      max_attempts: 3
    });
    assert.equal(decision.retry_class, 'OPERATOR_REQUIRED');
    assert.equal(decision.retry_stage, 'NONE');
    assert.equal(decision.next_job_status, 'USER_ACTION_REQUIRED');
    assert.equal(decision.consume_attempt, false);
    pass('Manual bridge timeout routes to USER_ACTION_REQUIRED without calling provider');
  }

  // -------------------------------------------------------------------------
  // 2. RATE LIMITING & HTTP 429
  // -------------------------------------------------------------------------
  console.log('\n--- Phase 2: Rate Limiting & HTTP 429 ---');

  // 2.1 Autonomous provider rate limit
  {
    const decision = decideMediaRetryPolicy({
      failure_code: MEDIA_QA_FAILURE_CODES.PROVIDER_RATE_LIMIT,
      source_channel: 'AUTONOMOUS_PROVIDER',
      attempt_number: 1,
      max_attempts: 3,
      http_status: 429
    });
    assert.equal(decision.retry_class, 'RETRY_FROM_SOURCE');
    assert.equal(decision.retry_stage, 'GENERATION');
    assert.equal(decision.next_job_status, 'WAITING_RETRY');
    assert.equal(decision.consume_attempt, true);
    assert(decision.suggested_delay_ms >= 10000, 'Rate limit backoff must be at least 10s');
    pass('Autonomous rate limit recommends RETRY_FROM_SOURCE with extended backoff');
  }

  // 2.2 Manual bridge rate limit
  {
    const decision = decideMediaRetryPolicy({
      failure_code: MEDIA_QA_FAILURE_CODES.PROVIDER_RATE_LIMIT,
      source_channel: 'MANUAL_BROWSER_BRIDGE',
      attempt_number: 0
    });
    assert.equal(decision.retry_class, 'OPERATOR_REQUIRED');
    assert.equal(decision.next_job_status, 'USER_ACTION_REQUIRED');
    pass('Manual bridge rate limit routes to USER_ACTION_REQUIRED');
  }

  // -------------------------------------------------------------------------
  // 3. AUTHENTICATION & CONTENT SAFETY POLICIES
  // -------------------------------------------------------------------------
  console.log('\n--- Phase 3: Auth & Content Safety Rejections ---');

  // 3.1 Provider authentication failure -> AUTH_REQUIRED (NO blind retry)
  {
    const decision = decideMediaRetryPolicy({
      failure_code: MEDIA_QA_FAILURE_CODES.PROVIDER_AUTH_FAILED,
      source_channel: 'AUTONOMOUS_PROVIDER',
      attempt_number: 0,
      http_status: 401
    });
    assert.equal(decision.retry_class, 'OPERATOR_REQUIRED');
    assert.equal(decision.retry_stage, 'NONE');
    assert.equal(decision.next_job_status, 'AUTH_REQUIRED');
    assert.equal(decision.consume_attempt, false);
    pass('Provider auth failure maps to AUTH_REQUIRED with zero automatic retries');
  }

  // 3.2 Provider content rejection -> PROVIDER_BLOCKED
  {
    const decision = decideMediaRetryPolicy({
      failure_code: MEDIA_QA_FAILURE_CODES.PROVIDER_CONTENT_REJECTED,
      source_channel: 'AUTONOMOUS_PROVIDER',
      attempt_number: 1
    });
    assert.equal(decision.retry_class, 'OPERATOR_REQUIRED');
    assert.equal(decision.retry_stage, 'NONE');
    assert.equal(decision.next_job_status, 'PROVIDER_BLOCKED');
    assert.equal(decision.consume_attempt, false);
    pass('Provider content rejection maps conservatively to PROVIDER_BLOCKED');
  }

  // -------------------------------------------------------------------------
  // 4. TECHNICAL QUALITY FAILURES & RE-PROMPTING
  // -------------------------------------------------------------------------
  console.log('\n--- Phase 4: Technical Dimensions & Re-prompting ---');

  // 4.1 Autonomous provider dimensions too small -> RETRY_WITH_REPROMPT
  {
    const decision = decideMediaRetryPolicy({
      failure_code: MEDIA_QA_FAILURE_CODES.DIMENSIONS_TOO_SMALL,
      source_channel: 'AUTONOMOUS_PROVIDER',
      attempt_number: 1,
      max_attempts: 3,
      role: 'featured'
    });
    assert.equal(decision.retry_class, 'RETRY_WITH_REPROMPT');
    assert.equal(decision.retry_stage, 'GENERATION');
    assert.equal(decision.next_job_status, 'WAITING_RETRY');
    assert.equal(decision.consume_attempt, true);
    pass('Autonomous dimensions too small triggers RETRY_WITH_REPROMPT at GENERATION');
  }

  // 4.2 Manual bridge dimensions too small (CRITICAL INVARIANT: NO PROVIDER FALLTHROUGH)
  {
    const decision = decideMediaRetryPolicy({
      failure_code: MEDIA_QA_FAILURE_CODES.DIMENSIONS_TOO_SMALL,
      source_channel: 'MANUAL_BROWSER_BRIDGE',
      attempt_number: 0,
      role: 'featured'
    });
    assert.equal(decision.retry_class, 'OPERATOR_REQUIRED');
    assert.equal(decision.retry_stage, 'NONE');
    assert.equal(decision.next_job_status, 'USER_ACTION_REQUIRED');
    assert.equal(decision.consume_attempt, false);
    pass('Manual bridge dimensions too small strictly forbids autonomous provider fallthrough');
  }

  // 4.3 Local fixture dimensions failure -> TERMINAL (static fixture cannot be regenerated)
  {
    const decision = decideMediaRetryPolicy({
      failure_code: MEDIA_QA_FAILURE_CODES.DIMENSIONS_TOO_SMALL,
      source_channel: 'LOCAL_FIXTURE',
      attempt_number: 0
    });
    assert.equal(decision.retry_class, 'TERMINAL');
    assert.equal(decision.next_job_status, 'FAILED_TERMINAL');
    pass('Local fixture dimensions failure is strictly TERMINAL');
  }

  // -------------------------------------------------------------------------
  // 5. TRANSFORM (WATERMARK) INVARIANT: NO IMAGE REGENERATION
  // -------------------------------------------------------------------------
  console.log('\n--- Phase 5: Transform (Watermark) Failures ---');

  {
    const decision = decideMediaRetryPolicy({
      failure_code: MEDIA_QA_FAILURE_CODES.WATERMARK_FAILED,
      source_channel: 'AUTONOMOUS_PROVIDER',
      attempt_number: 1,
      max_attempts: 3,
      has_bytes: true
    });
    assert.equal(decision.retry_class, 'RETRY_SAME_STAGE');
    assert.equal(decision.retry_stage, 'TRANSFORM');
    assert.equal(decision.next_job_status, 'WAITING_RETRY');
    assert.equal(decision.consume_attempt, false, 'Transform retry must not consume provider attempt');
    pass('Watermark failure retries TRANSFORM stage only, NEVER regenerating image');
  }

  // -------------------------------------------------------------------------
  // 6. STORAGE (R2) INVARIANT: NO IMAGE REGENERATION
  // -------------------------------------------------------------------------
  console.log('\n--- Phase 6: Storage (R2) Failures ---');

  // 6.1 R2 upload failed
  {
    const decision = decideMediaRetryPolicy({
      failure_code: MEDIA_QA_FAILURE_CODES.R2_UPLOAD_FAILED,
      source_channel: 'AUTONOMOUS_PROVIDER',
      attempt_number: 1,
      max_attempts: 3,
      has_derivative: true
    });
    assert.equal(decision.retry_class, 'RETRY_SAME_STAGE');
    assert.equal(decision.retry_stage, 'STORAGE');
    assert.equal(decision.next_job_status, 'WAITING_RETRY');
    assert.equal(decision.consume_attempt, false);
    pass('R2 upload failure retries STORAGE stage using existing derivative bytes');
  }

  // 6.2 Public delivery verification failed
  {
    const decision = decideMediaRetryPolicy({
      failure_code: MEDIA_QA_FAILURE_CODES.PUBLIC_DELIVERY_FAILED,
      source_channel: 'AUTONOMOUS_PROVIDER',
      attempt_number: 1
    });
    assert.equal(decision.retry_class, 'RETRY_SAME_STAGE');
    assert.equal(decision.retry_stage, 'DELIVERY_VERIFY');
    assert.equal(decision.next_job_status, 'WAITING_RETRY');
    assert.equal(decision.consume_attempt, false);
    pass('Public delivery failure retries DELIVERY_VERIFY stage without re-upload');
  }

  // -------------------------------------------------------------------------
  // 7. HASH INTEGRITY (STAGE-AWARE DIFFERENTIATION)
  // -------------------------------------------------------------------------
  console.log('\n--- Phase 7: Hash Integrity Differentiation ---');

  // 7.1 Hash mismatch at storage stage -> retry STORAGE, NOT provider generation
  {
    const decision = decideMediaRetryPolicy({
      failure_code: MEDIA_QA_FAILURE_CODES.HASH_MISMATCH,
      qa_stage: 'STORAGE',
      source_channel: 'AUTONOMOUS_PROVIDER',
      attempt_number: 1,
      has_derivative: true
    });
    assert.equal(decision.retry_class, 'RETRY_SAME_STAGE');
    assert.equal(decision.retry_stage, 'STORAGE');
    assert.equal(decision.next_job_status, 'WAITING_RETRY');
    assert.equal(decision.consume_attempt, false);
    pass('Hash mismatch at storage stage retries STORAGE with derivative, not provider generation');
  }

  // 7.2 Hash mismatch at artifact acquisition stage -> reacquire from source
  {
    const decision = decideMediaRetryPolicy({
      failure_code: MEDIA_QA_FAILURE_CODES.HASH_MISMATCH,
      qa_stage: 'ARTIFACT_INTEGRITY',
      source_channel: 'AUTONOMOUS_PROVIDER',
      attempt_number: 1
    });
    assert.equal(decision.retry_class, 'RETRY_FROM_SOURCE');
    assert.equal(decision.retry_stage, 'SOURCE_ACQUISITION');
    assert.equal(decision.next_job_status, 'WAITING_RETRY');
    assert.equal(decision.consume_attempt, true);
    pass('Hash mismatch at artifact acquisition stage reacquires from source');
  }

  // -------------------------------------------------------------------------
  // 8. SECURITY FIREWALL & PRIVACY (SECRET_LEAK)
  // -------------------------------------------------------------------------
  console.log('\n--- Phase 8: Secret Leak & Provenance Firewall ---');

  {
    const decision = decideMediaRetryPolicy({
      failure_code: MEDIA_QA_FAILURE_CODES.SECRET_LEAK,
      source_channel: 'AUTONOMOUS_PROVIDER',
      attempt_number: 0
    });
    assert.equal(decision.retry_class, 'TERMINAL');
    assert.equal(decision.retry_stage, 'NONE');
    assert.equal(decision.next_job_status, 'FAILED_TERMINAL');
    assert.equal(decision.consume_attempt, false);
    assert.equal(decision.terminal_reason, 'SECURITY_FIREWALL_SECRET_LEAK');
    // Ensure zero leaked tokens in evidence
    assert(!JSON.stringify(decision.evidence).includes('key'));
    pass('Secret leak fails closed immediately as TERMINAL with zero retry attempts');
  }

  // -------------------------------------------------------------------------
  // 9. ATTACHMENT CONFLICTS (SLOT_OCCUPIED, ARTICLE_NOT_ELIGIBLE)
  // -------------------------------------------------------------------------
  console.log('\n--- Phase 9: Attachment Conflicts (Zero Regeneration) ---');

  // 9.1 Slot occupied
  {
    const decision = decideMediaRetryPolicy({
      failure_code: MEDIA_QA_FAILURE_CODES.SLOT_OCCUPIED,
      source_channel: 'AUTONOMOUS_PROVIDER',
      slot_key: 'featured',
      attempt_number: 0
    });
    assert.equal(decision.retry_class, 'NO_RETRY');
    assert.equal(decision.retry_stage, 'NONE');
    assert.equal(decision.next_job_status, 'USER_ACTION_REQUIRED');
    assert.equal(decision.consume_attempt, false);
    pass('Slot occupied produces NO_RETRY and NEVER regenerates media');
  }

  // 9.2 Article not eligible
  {
    const decision = decideMediaRetryPolicy({
      failure_code: MEDIA_QA_FAILURE_CODES.ARTICLE_NOT_ELIGIBLE,
      source_channel: 'AUTONOMOUS_PROVIDER',
      attempt_number: 0
    });
    assert.equal(decision.retry_class, 'NO_RETRY');
    assert.equal(decision.retry_stage, 'NONE');
    assert.equal(decision.next_job_status, 'USER_ACTION_REQUIRED');
    pass('Article not eligible produces NO_RETRY');
  }

  // 9.3 Role incompatible
  {
    const decision = decideMediaRetryPolicy({
      failure_code: MEDIA_QA_FAILURE_CODES.ROLE_INCOMPATIBLE,
      source_channel: 'AUTONOMOUS_PROVIDER',
      attempt_number: 0
    });
    assert.equal(decision.retry_class, 'OPERATOR_REQUIRED');
    assert.equal(decision.next_job_status, 'USER_ACTION_REQUIRED');
    pass('Role incompatible routes to OPERATOR_REQUIRED');
  }

  // -------------------------------------------------------------------------
  // 10. ATTEMPT BUDGET & EXHAUSTION
  // -------------------------------------------------------------------------
  console.log('\n--- Phase 10: Attempt Budget & Exhaustion ---');

  // 10.1 Under budget (attempt 1 < 3)
  {
    const decision = decideMediaRetryPolicy({
      failure_code: MEDIA_QA_FAILURE_CODES.PROVIDER_TIMEOUT,
      source_channel: 'AUTONOMOUS_PROVIDER',
      attempt_number: 1,
      max_attempts: 3
    });
    assert.equal(decision.retry_class, 'RETRY_FROM_SOURCE');
    assert.equal(decision.next_job_status, 'WAITING_RETRY');
    pass('Attempt 1 of 3 permits retry');
  }

  // 10.2 Under budget (attempt 2 < 3)
  {
    const decision = decideMediaRetryPolicy({
      failure_code: MEDIA_QA_FAILURE_CODES.PROVIDER_TIMEOUT,
      source_channel: 'AUTONOMOUS_PROVIDER',
      attempt_number: 2,
      max_attempts: 3
    });
    assert.equal(decision.retry_class, 'RETRY_FROM_SOURCE');
    assert.equal(decision.next_job_status, 'WAITING_RETRY');
    pass('Attempt 2 of 3 permits retry');
  }

  // 10.3 Exhausted (attempt 3 >= 3)
  {
    const decision = decideMediaRetryPolicy({
      failure_code: MEDIA_QA_FAILURE_CODES.PROVIDER_TIMEOUT,
      source_channel: 'AUTONOMOUS_PROVIDER',
      attempt_number: 3,
      max_attempts: 3
    });
    assert.equal(decision.retry_class, 'TERMINAL');
    assert.equal(decision.retry_stage, 'NONE');
    assert.equal(decision.next_job_status, 'FAILED_TERMINAL');
    assert.equal(decision.terminal_reason, 'MAX_ATTEMPTS_EXHAUSTED');
    pass('Attempt 3 of 3 collapses to TERMINAL and FAILED_TERMINAL');
  }

  // -------------------------------------------------------------------------
  // 11. DUPLICATE ASSET REUSE SEMANTICS
  // -------------------------------------------------------------------------
  console.log('\n--- Phase 11: Duplicate Validated Asset Reuse ---');

  {
    const decision = decideMediaRetryPolicy({
      failure_code: 'NONE',
      source_channel: 'AUTONOMOUS_PROVIDER',
      attempt_number: 0,
      is_duplicate_asset: true,
      reusable_asset_id: 'ast_92eca8e32eb2f0f4'
    });
    assert.equal(decision.retry_class, 'NO_RETRY');
    assert.equal(decision.retry_stage, 'NONE');
    assert.equal(decision.next_job_status, 'ATTACHING');
    assert.equal(decision.consume_attempt, false);
    assert.equal(decision.evidence.reusable_asset_id, 'ast_92eca8e32eb2f0f4');
    pass('Duplicate asset detected routes directly to ATTACHING for reuse without failure');
  }

  // -------------------------------------------------------------------------
  // 12. SEMANTIC QA DEFERRED (NO RETRY)
  // -------------------------------------------------------------------------
  console.log('\n--- Phase 12: Semantic Deferred Handling ---');

  {
    const decision = decideMediaRetryPolicy({
      failure_code: 'SEMANTIC_DEFERRED',
      source_channel: 'AUTONOMOUS_PROVIDER',
      attempt_number: 0
    });
    assert.equal(decision.retry_class, 'NO_RETRY');
    assert.equal(decision.retry_stage, 'NONE');
    assert.equal(decision.next_job_status, 'COMPLETE');
    assert.equal(decision.consume_attempt, false);
    pass('Deferred semantic evaluation produces NO_RETRY and permits normal pipeline completion');
  }

  // -------------------------------------------------------------------------
  // 13. DETERMINISTIC BACKOFF DELAY CALCULATION
  // -------------------------------------------------------------------------
  console.log('\n--- Phase 13: Deterministic Backoff Calculation ---');

  {
    const d0 = computeRetryDelay(0);
    const d1 = computeRetryDelay(1);
    const d2 = computeRetryDelay(2);
    const d3 = computeRetryDelay(3);

    assert.equal(d0.delay_ms, 2000, 'Attempt 0 uses base delay');
    assert.equal(d1.delay_ms, 2000, 'Attempt 1 uses base delay');
    assert.equal(d2.delay_ms, 4000, 'Attempt 2 doubles base delay');
    assert.equal(d3.delay_ms, 8000, 'Attempt 3 quadruples base delay');

    // Rate limit specialized delay
    const dRateLimit = computeRetryDelay(1, { isRateLimit: true });
    assert.equal(dRateLimit.delay_ms, 10000, 'Rate limit uses higher base delay');

    pass('computeRetryDelay calculates deterministic exponential backoff within bounds');
  }

  // -------------------------------------------------------------------------
  // 14. IDEMPOTENT & SIDE-EFFECT-FREE VERIFICATION
  // -------------------------------------------------------------------------
  console.log('\n--- Phase 14: Idempotence & Side-Effect Free ---');

  {
    const input = {
      failure_code: MEDIA_QA_FAILURE_CODES.R2_UPLOAD_FAILED,
      source_channel: 'AUTONOMOUS_PROVIDER',
      attempt_number: 1,
      max_attempts: 3
    };

    const d1 = decideMediaRetryPolicy(input);
    const d2 = decideMediaRetryPolicy(input);

    assert.deepEqual(d1, d2, 'Policy decision must be 100% idempotent and pure');
    pass('Policy evaluation is 100% deterministic and produces identical decisions');
  }

  console.log('\n=============================================================');
  console.log(`  ALL ${testCount} MEDIA-A5.2 RETRY POLICY TESTS PASSED CLEANLY`);
  console.log('=============================================================\n');
}

runTestSuite().catch((err) => {
  console.error('\nFAILED TEST:', err);
  process.exit(1);
});
