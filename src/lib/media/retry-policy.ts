/**
 * RancangLoka — Media Retry Classification & Decision Policy (MEDIA-A5.2)
 *
 * Pure, side-effect-free decision engine for media processing failures:
 * 1. Normalized Retry Classification:
 *    - RETRY_SAME_STAGE: deterministic retry on same bytes (watermark, storage)
 *    - RETRY_FROM_SOURCE: re-acquire from upstream without changing prompt
 *    - RETRY_WITH_REPROMPT: re-prompt/regenerate with altered parameters
 *    - OPERATOR_REQUIRED: manual user or chief editor intervention required
 *    - TERMINAL: non-retryable fatal error or exhausted attempts
 *    - NO_RETRY: non-failure condition or pipeline continuation (e.g. duplicate reuse)
 *
 * 2. Stage-Aware Minimal Retry Invariant:
 *    - Failure at Transform (watermark) -> retry TRANSFORM, NOT provider generation
 *    - Failure at Storage (R2) -> retry STORAGE, NOT provider generation
 *    - Failure at Attachment (slot occupied) -> NO_RETRY / editorial workflow
 *    - Secret leak -> TERMINAL / fail-closed, ZERO retry loop, ZERO leaked tokens
 *
 * 3. Provider-Neutral Source Invariant:
 *    - AUTONOMOUS_PROVIDER: provider acquisition/regeneration retry permitted
 *    - MANUAL_BROWSER_BRIDGE: provider generation NEVER silently invoked;
 *      falls back to USER_ACTION_REQUIRED
 *    - LOCAL_FIXTURE: offline fixture, no remote provider retry
 *
 * 4. 100% Side-Effect Free:
 *    - ZERO database mutations (D1)
 *    - ZERO R2 uploads or deletions
 *    - ZERO provider API calls (fal.ai, openai)
 *    - ZERO sleep / timer execution
 */

import {
  MEDIA_QA_FAILURE_CODES,
  type MediaQaFailureCode,
  type MediaQaStage
} from './qa-service.ts';

export type MediaRetryClass =
  | 'RETRY_SAME_STAGE'
  | 'RETRY_FROM_SOURCE'
  | 'RETRY_WITH_REPROMPT'
  | 'OPERATOR_REQUIRED'
  | 'TERMINAL'
  | 'NO_RETRY';

export type MediaRetryStage =
  | 'SOURCE_ACQUISITION'
  | 'GENERATION'
  | 'ARTIFACT_QA'
  | 'TRANSFORM'
  | 'STORAGE'
  | 'DELIVERY_VERIFY'
  | 'ATTACHMENT'
  | 'NONE';

export type MediaSourceChannel =
  | 'AUTONOMOUS_PROVIDER'
  | 'MANUAL_BROWSER_BRIDGE'
  | 'LOCAL_FIXTURE';

export interface MediaRetryEvidence {
  failure_code: string;
  qa_stage?: MediaQaStage | string | null;
  source_channel: MediaSourceChannel;
  attempt_number: number;
  max_attempts: number;
  reasons: string[];
  http_status?: number;
  provider?: string;
  role?: string;
  slot_key?: string;
  reusable_asset_id?: string;
  [key: string]: any;
}

export interface MediaRetryDecision {
  retry_class: MediaRetryClass;
  retry_stage: MediaRetryStage;
  next_job_status: string;
  consume_attempt: boolean;
  suggested_delay_ms?: number;
  terminal_reason?: string | null;
  operator_reason?: string | null;
  evidence: MediaRetryEvidence;
}

export interface MediaRetryPolicyInput {
  failure_code: string;
  qa_stage?: MediaQaStage | string | null;
  source_channel: MediaSourceChannel;
  attempt_number: number;
  max_attempts?: number;
  role?: string;
  slot_key?: string;
  http_status?: number;
  provider?: string;
  has_bytes?: boolean;
  has_derivative?: boolean;
  is_duplicate_asset?: boolean;
  reusable_asset_id?: string;
}

export interface BackoffDelayOptions {
  baseDelayMs?: number;
  maxDelayMs?: number;
  factor?: number;
  isRateLimit?: boolean;
}

export interface BackoffDelayResult {
  delay_ms: number;
  min_delay_ms: number;
  max_delay_ms: number;
}

/**
 * Deterministic backoff delay recommendation function.
 * Pure mathematical calculation: NO sleeping, NO uncontrolled randomness.
 */
export function computeRetryDelay(
  attempt: number,
  options: BackoffDelayOptions = {}
): BackoffDelayResult {
  const baseDelayMs = options.baseDelayMs || (options.isRateLimit ? 10000 : 2000);
  const maxDelayMs = options.maxDelayMs || (options.isRateLimit ? 120000 : 30000);
  const factor = options.factor || 2;

  // Normalized attempt for exponential backoff (attempt 0 or 1 starts at baseDelay)
  const exponent = Math.max(0, attempt - 1);
  const calculatedDelay = baseDelayMs * Math.pow(factor, exponent);
  const boundedDelay = Math.min(maxDelayMs, Math.max(baseDelayMs, calculatedDelay));

  return {
    delay_ms: boundedDelay,
    min_delay_ms: baseDelayMs,
    max_delay_ms: maxDelayMs
  };
}

/**
 * Main Pure Decision Function: Evaluates failure context and returns
 * the canonical next action recommendation.
 *
 * Guarantees:
 * - Deterministic: identical input always produces identical output
 * - Pure: 0 I/O, 0 mutations
 * - Minimal retry stage: restarts at smallest safe stage
 * - Manual bridge firewall: never falls through to autonomous generation
 * - Secret leak fail-closed: zero secrets logged, zero retries
 */
export function decideMediaRetryPolicy(input: MediaRetryPolicyInput): MediaRetryDecision {
  const {
    failure_code,
    qa_stage,
    source_channel,
    attempt_number,
    role = 'featured',
    slot_key,
    http_status,
    provider,
    has_bytes = false,
    has_derivative = false,
    is_duplicate_asset = false,
    reusable_asset_id
  } = input;

  const max_attempts = input.max_attempts !== undefined ? input.max_attempts : 3;
  const isBudgetExhausted = attempt_number >= max_attempts;

  const baseEvidence: MediaRetryEvidence = {
    failure_code,
    qa_stage,
    source_channel,
    attempt_number,
    max_attempts,
    role,
    slot_key,
    provider,
    reasons: []
  };

  if (http_status) {
    baseEvidence.http_status = http_status;
  }

  // ---------------------------------------------------------------------------
  // 1. NON-FAILURE & DUPLICATE ASSET REUSE SEMANTICS
  // ---------------------------------------------------------------------------
  if (is_duplicate_asset) {
    baseEvidence.reusable_asset_id = reusable_asset_id;
    baseEvidence.reasons.push(
      `Content-addressed asset already exists (${reusable_asset_id || 'verified'}). Reusing existing validated asset without re-generation.`
    );
    return {
      retry_class: 'NO_RETRY',
      retry_stage: 'NONE',
      next_job_status: 'ATTACHING',
      consume_attempt: false,
      evidence: baseEvidence
    };
  }

  // ---------------------------------------------------------------------------
  // 2. SEMANTIC QA DEFERRED (Not a failure, pipeline continuation)
  // ---------------------------------------------------------------------------
  if (failure_code === 'SEMANTIC_DEFERRED' || failure_code === 'DEFERRED') {
    baseEvidence.reasons.push('Semantic evaluation was deferred; no retry action is required.');
    return {
      retry_class: 'NO_RETRY',
      retry_stage: 'NONE',
      next_job_status: 'COMPLETE',
      consume_attempt: false,
      evidence: baseEvidence
    };
  }

  // ---------------------------------------------------------------------------
  // 3. SECURITY & PRIVACY FIREWALL (SECRET_LEAK)
  // ---------------------------------------------------------------------------
  if (failure_code === MEDIA_QA_FAILURE_CODES.SECRET_LEAK) {
    baseEvidence.reasons.push(
      'Security firewall triggered: credential or secret leak pattern detected in metadata. Automatic retry prohibited.'
    );
    return {
      retry_class: 'TERMINAL',
      retry_stage: 'NONE',
      next_job_status: 'FAILED_TERMINAL',
      consume_attempt: false,
      terminal_reason: 'SECURITY_FIREWALL_SECRET_LEAK',
      evidence: baseEvidence
    };
  }

  if (failure_code === MEDIA_QA_FAILURE_CODES.PROVENANCE_INVALID) {
    baseEvidence.reasons.push('Invalid or unverified provenance structure. Requires operator verification.');
    return {
      retry_class: 'OPERATOR_REQUIRED',
      retry_stage: 'NONE',
      next_job_status: 'USER_ACTION_REQUIRED',
      consume_attempt: false,
      operator_reason: 'PROVENANCE_UNVERIFIED',
      evidence: baseEvidence
    };
  }

  // ---------------------------------------------------------------------------
  // 4. ATTACHMENT ELIGIBILITY FAILURES (Must NEVER regenerate image)
  // ---------------------------------------------------------------------------
  if (
    failure_code === MEDIA_QA_FAILURE_CODES.SLOT_OCCUPIED ||
    failure_code === MEDIA_QA_FAILURE_CODES.ARTICLE_NOT_ELIGIBLE ||
    failure_code === MEDIA_QA_FAILURE_CODES.ROLE_INCOMPATIBLE
  ) {
    if (failure_code === MEDIA_QA_FAILURE_CODES.SLOT_OCCUPIED) {
      baseEvidence.reasons.push(
        `Target slot "${slot_key || 'slot'}" is already occupied by an active asset. Automated media generation must not retry.`
      );
      return {
        retry_class: 'NO_RETRY',
        retry_stage: 'NONE',
        next_job_status: 'USER_ACTION_REQUIRED',
        consume_attempt: false,
        operator_reason: 'SLOT_OCCUPIED',
        evidence: baseEvidence
      };
    }

    if (failure_code === MEDIA_QA_FAILURE_CODES.ARTICLE_NOT_ELIGIBLE) {
      baseEvidence.reasons.push('Article is not in an eligible state (e.g. already published or not draft). Media retry aborted.');
      return {
        retry_class: 'NO_RETRY',
        retry_stage: 'NONE',
        next_job_status: 'USER_ACTION_REQUIRED',
        consume_attempt: false,
        operator_reason: 'ARTICLE_NOT_ELIGIBLE',
        evidence: baseEvidence
      };
    }

    baseEvidence.reasons.push(`Asset role is incompatible with target slot "${slot_key || 'slot'}". Requires manual review.`);
    return {
      retry_class: 'OPERATOR_REQUIRED',
      retry_stage: 'NONE',
      next_job_status: 'USER_ACTION_REQUIRED',
      consume_attempt: false,
      operator_reason: 'ROLE_INCOMPATIBLE',
      evidence: baseEvidence
    };
  }

  if (failure_code === MEDIA_QA_FAILURE_CODES.ASSET_NOT_VALIDATED) {
    if (isBudgetExhausted) {
      baseEvidence.reasons.push(`Attempt budget (${attempt_number}/${max_attempts}) exhausted for validation.`);
      return {
        retry_class: 'TERMINAL',
        retry_stage: 'NONE',
        next_job_status: 'FAILED_TERMINAL',
        consume_attempt: false,
        terminal_reason: 'MAX_ATTEMPTS_EXHAUSTED',
        evidence: baseEvidence
      };
    }
    baseEvidence.reasons.push('Asset has not completed validation. Retrying artifact QA stage.');
    return {
      retry_class: 'RETRY_SAME_STAGE',
      retry_stage: 'ARTIFACT_QA',
      next_job_status: 'WAITING_RETRY',
      consume_attempt: false,
      suggested_delay_ms: computeRetryDelay(attempt_number).delay_ms,
      evidence: baseEvidence
    };
  }

  // ---------------------------------------------------------------------------
  // 5. TRANSFORM FAILURES (Watermark) -> Smallest Safe Stage: TRANSFORM
  // ---------------------------------------------------------------------------
  if (
    failure_code === MEDIA_QA_FAILURE_CODES.WATERMARK_FAILED ||
    failure_code === MEDIA_QA_FAILURE_CODES.TRANSFORM_INTEGRITY_MISMATCH
  ) {
    if (isBudgetExhausted) {
      baseEvidence.reasons.push(`Watermark transform retry budget (${attempt_number}/${max_attempts}) exhausted.`);
      return {
        retry_class: 'TERMINAL',
        retry_stage: 'NONE',
        next_job_status: 'FAILED_TERMINAL',
        consume_attempt: false,
        terminal_reason: 'MAX_ATTEMPTS_EXHAUSTED',
        evidence: baseEvidence
      };
    }
    baseEvidence.reasons.push(
      'Watermark derivative generation failed. Retrying transform stage from immutable source bytes without regenerating upstream.'
    );
    return {
      retry_class: 'RETRY_SAME_STAGE',
      retry_stage: 'TRANSFORM',
      next_job_status: 'WAITING_RETRY',
      consume_attempt: false, // Does NOT consume provider-generation budget
      suggested_delay_ms: computeRetryDelay(attempt_number, { baseDelayMs: 1000 }).delay_ms,
      evidence: baseEvidence
    };
  }

  // ---------------------------------------------------------------------------
  // 6. STORAGE FAILURES (R2) -> Smallest Safe Stage: STORAGE / DELIVERY_VERIFY
  // ---------------------------------------------------------------------------
  if (
    failure_code === MEDIA_QA_FAILURE_CODES.R2_UPLOAD_FAILED ||
    failure_code === MEDIA_QA_FAILURE_CODES.R2_INTEGRITY_MISMATCH ||
    failure_code === MEDIA_QA_FAILURE_CODES.PUBLIC_DELIVERY_FAILED
  ) {
    if (isBudgetExhausted) {
      baseEvidence.reasons.push(`Storage retry budget (${attempt_number}/${max_attempts}) exhausted.`);
      return {
        retry_class: 'TERMINAL',
        retry_stage: 'NONE',
        next_job_status: 'FAILED_TERMINAL',
        consume_attempt: false,
        terminal_reason: 'MAX_ATTEMPTS_EXHAUSTED',
        evidence: baseEvidence
      };
    }

    if (failure_code === MEDIA_QA_FAILURE_CODES.PUBLIC_DELIVERY_FAILED) {
      baseEvidence.reasons.push(
        'Public edge delivery verification failed. Retrying verification/delivery stage without re-uploading or regenerating.'
      );
      return {
        retry_class: 'RETRY_SAME_STAGE',
        retry_stage: 'DELIVERY_VERIFY',
        next_job_status: 'WAITING_RETRY',
        consume_attempt: false,
        suggested_delay_ms: computeRetryDelay(attempt_number, { baseDelayMs: 2000 }).delay_ms,
        evidence: baseEvidence
      };
    }

    baseEvidence.reasons.push(
      'R2 durable storage upload/integrity failed. Retrying storage stage using existing derivative bytes without re-generating.'
    );
    return {
      retry_class: 'RETRY_SAME_STAGE',
      retry_stage: 'STORAGE',
      next_job_status: 'WAITING_RETRY',
      consume_attempt: false,
      suggested_delay_ms: computeRetryDelay(attempt_number, { baseDelayMs: 2000 }).delay_ms,
      evidence: baseEvidence
    };
  }

  // ---------------------------------------------------------------------------
  // 7. HASH INTEGRITY MISMATCH (Context & Stage Dependent)
  // ---------------------------------------------------------------------------
  if (failure_code === MEDIA_QA_FAILURE_CODES.HASH_MISMATCH) {
    // If derivative bytes already exist and storage check failed, retry STORAGE
    if (has_derivative || qa_stage === 'STORAGE') {
      if (isBudgetExhausted) {
        baseEvidence.reasons.push(`Storage hash integrity retry budget exhausted (${attempt_number}/${max_attempts}).`);
        return {
          retry_class: 'TERMINAL',
          retry_stage: 'NONE',
          next_job_status: 'FAILED_TERMINAL',
          consume_attempt: false,
          terminal_reason: 'MAX_ATTEMPTS_EXHAUSTED',
          evidence: baseEvidence
        };
      }
      baseEvidence.reasons.push('Storage SHA-256 integrity mismatch. Retrying STORAGE stage with trusted derivative bytes.');
      return {
        retry_class: 'RETRY_SAME_STAGE',
        retry_stage: 'STORAGE',
        next_job_status: 'WAITING_RETRY',
        consume_attempt: false,
        suggested_delay_ms: computeRetryDelay(attempt_number).delay_ms,
        evidence: baseEvidence
      };
    }

    // Artifact acquisition stage hash mismatch
    if (source_channel === 'MANUAL_BROWSER_BRIDGE') {
      baseEvidence.reasons.push('Artifact hash mismatch from manual bridge capture. Requires user recapture.');
      return {
        retry_class: 'OPERATOR_REQUIRED',
        retry_stage: 'NONE',
        next_job_status: 'USER_ACTION_REQUIRED',
        consume_attempt: false,
        operator_reason: 'MANUAL_CAPTURE_HASH_MISMATCH',
        evidence: baseEvidence
      };
    }

    if (source_channel === 'LOCAL_FIXTURE') {
      baseEvidence.reasons.push('Local fixture hash mismatch. Fatal configuration error.');
      return {
        retry_class: 'TERMINAL',
        retry_stage: 'NONE',
        next_job_status: 'FAILED_TERMINAL',
        consume_attempt: false,
        terminal_reason: 'LOCAL_FIXTURE_HASH_CORRUPT',
        evidence: baseEvidence
      };
    }

    // Autonomous provider acquisition hash mismatch
    if (isBudgetExhausted) {
      baseEvidence.reasons.push(`Provider acquisition hash mismatch attempts exhausted (${attempt_number}/${max_attempts}).`);
      return {
        retry_class: 'TERMINAL',
        retry_stage: 'NONE',
        next_job_status: 'FAILED_TERMINAL',
        consume_attempt: true,
        terminal_reason: 'MAX_ATTEMPTS_EXHAUSTED',
        evidence: baseEvidence
      };
    }

    baseEvidence.reasons.push('Provider artifact SHA-256 mismatch against declared metadata. Re-acquiring from provider source.');
    return {
      retry_class: 'RETRY_FROM_SOURCE',
      retry_stage: 'SOURCE_ACQUISITION',
      next_job_status: 'WAITING_RETRY',
      consume_attempt: true,
      suggested_delay_ms: computeRetryDelay(attempt_number).delay_ms,
      evidence: baseEvidence
    };
  }

  // ---------------------------------------------------------------------------
  // 8. UPSTREAM PROVIDER FAILURES
  // ---------------------------------------------------------------------------
  if (
    failure_code === MEDIA_QA_FAILURE_CODES.PROVIDER_AUTH_FAILED ||
    http_status === 401 ||
    http_status === 403
  ) {
    baseEvidence.reasons.push('Provider authentication or authorization failed. Operator intervention required; automatic retry blocked.');
    return {
      retry_class: 'OPERATOR_REQUIRED',
      retry_stage: 'NONE',
      next_job_status: 'AUTH_REQUIRED',
      consume_attempt: false,
      operator_reason: 'PROVIDER_AUTH_FAILED',
      evidence: baseEvidence
    };
  }

  if (failure_code === MEDIA_QA_FAILURE_CODES.PROVIDER_CONTENT_REJECTED) {
    baseEvidence.reasons.push('Upstream provider rejected content or safety policy triggered. Blind automatic reprompt blocked.');
    return {
      retry_class: 'OPERATOR_REQUIRED',
      retry_stage: 'NONE',
      next_job_status: 'PROVIDER_BLOCKED',
      consume_attempt: false,
      operator_reason: 'PROVIDER_CONTENT_REJECTED',
      evidence: baseEvidence
    };
  }

  if (
    failure_code === MEDIA_QA_FAILURE_CODES.PROVIDER_RATE_LIMIT ||
    http_status === 429
  ) {
    if (source_channel === 'MANUAL_BROWSER_BRIDGE') {
      baseEvidence.reasons.push('Rate limit encountered on manual bridge. Operator intervention required.');
      return {
        retry_class: 'OPERATOR_REQUIRED',
        retry_stage: 'NONE',
        next_job_status: 'USER_ACTION_REQUIRED',
        consume_attempt: false,
        operator_reason: 'MANUAL_BRIDGE_RATE_LIMITED',
        evidence: baseEvidence
      };
    }

    if (isBudgetExhausted) {
      baseEvidence.reasons.push(`Provider rate limit retry budget exhausted (${attempt_number}/${max_attempts}).`);
      return {
        retry_class: 'TERMINAL',
        retry_stage: 'NONE',
        next_job_status: 'FAILED_TERMINAL',
        consume_attempt: true,
        terminal_reason: 'MAX_ATTEMPTS_EXHAUSTED',
        evidence: baseEvidence
      };
    }

    const backoff = computeRetryDelay(attempt_number, { isRateLimit: true, baseDelayMs: 15000 });
    baseEvidence.reasons.push(`Upstream provider rate limited (HTTP 429). Retrying after exponential backoff (${backoff.delay_ms} ms).`);
    return {
      retry_class: 'RETRY_FROM_SOURCE',
      retry_stage: 'GENERATION',
      next_job_status: 'WAITING_RETRY',
      consume_attempt: true,
      suggested_delay_ms: backoff.delay_ms,
      evidence: baseEvidence
    };
  }

  if (
    failure_code === MEDIA_QA_FAILURE_CODES.PROVIDER_TIMEOUT ||
    http_status === 408 ||
    http_status === 504
  ) {
    if (source_channel === 'MANUAL_BROWSER_BRIDGE') {
      baseEvidence.reasons.push('Manual capture timed out. User action required.');
      return {
        retry_class: 'OPERATOR_REQUIRED',
        retry_stage: 'NONE',
        next_job_status: 'USER_ACTION_REQUIRED',
        consume_attempt: false,
        operator_reason: 'MANUAL_CAPTURE_TIMEOUT',
        evidence: baseEvidence
      };
    }

    if (isBudgetExhausted) {
      baseEvidence.reasons.push(`Provider timeout retry budget exhausted (${attempt_number}/${max_attempts}).`);
      return {
        retry_class: 'TERMINAL',
        retry_stage: 'NONE',
        next_job_status: 'FAILED_TERMINAL',
        consume_attempt: true,
        terminal_reason: 'MAX_ATTEMPTS_EXHAUSTED',
        evidence: baseEvidence
      };
    }

    baseEvidence.reasons.push('Upstream provider timed out. Retrying generation from provider.');
    return {
      retry_class: 'RETRY_FROM_SOURCE',
      retry_stage: 'GENERATION',
      next_job_status: 'WAITING_RETRY',
      consume_attempt: true,
      suggested_delay_ms: computeRetryDelay(attempt_number).delay_ms,
      evidence: baseEvidence
    };
  }

  // ---------------------------------------------------------------------------
  // 9. TECHNICAL & ARTIFACT FAILURES (SOURCE CHANNEL DISCRIMINATED)
  // ---------------------------------------------------------------------------

  // INVARIANT: Manual browser bridge captures NEVER trigger autonomous provider generation!
  if (source_channel === 'MANUAL_BROWSER_BRIDGE') {
    baseEvidence.reasons.push(
      `Manual capture encountered technical failure (${failure_code}). Manual bridge invariant enforces USER_ACTION_REQUIRED without falling through to autonomous provider generation.`
    );
    return {
      retry_class: 'OPERATOR_REQUIRED',
      retry_stage: 'NONE',
      next_job_status: 'USER_ACTION_REQUIRED',
      consume_attempt: false,
      operator_reason: `MANUAL_CAPTURE_INVALID_${failure_code}`,
      evidence: baseEvidence
    };
  }

  // Local fixture is offline/static - cannot be regenerated automatically
  if (source_channel === 'LOCAL_FIXTURE') {
    baseEvidence.reasons.push(`Local fixture failed QA (${failure_code}). Fixture is immutable; automatic regeneration is unsupported.`);
    return {
      retry_class: 'TERMINAL',
      retry_stage: 'NONE',
      next_job_status: 'FAILED_TERMINAL',
      consume_attempt: false,
      terminal_reason: `LOCAL_FIXTURE_FAILED_${failure_code}`,
      evidence: baseEvidence
    };
  }

  // Autonomous Provider Source:
  // Check if attempt budget is exhausted
  if (isBudgetExhausted) {
    baseEvidence.reasons.push(`Retry attempt budget exhausted (${attempt_number}/${max_attempts}) for failure ${failure_code}.`);
    return {
      retry_class: 'TERMINAL',
      retry_stage: 'NONE',
      next_job_status: 'FAILED_TERMINAL',
      consume_attempt: true,
      terminal_reason: 'MAX_ATTEMPTS_EXHAUSTED',
      evidence: baseEvidence
    };
  }

  // Technical dimension / sizing issues -> RETRY_WITH_REPROMPT (generation parameters)
  if (
    failure_code === MEDIA_QA_FAILURE_CODES.DIMENSIONS_TOO_SMALL ||
    failure_code === MEDIA_QA_FAILURE_CODES.FILE_TOO_SMALL ||
    failure_code === MEDIA_QA_FAILURE_CODES.FILE_TOO_LARGE ||
    failure_code === MEDIA_QA_FAILURE_CODES.INVALID_ASPECT_RATIO ||
    failure_code === MEDIA_QA_FAILURE_CODES.MIME_MISMATCH ||
    failure_code === MEDIA_QA_FAILURE_CODES.UNSUPPORTED_FORMAT
  ) {
    baseEvidence.reasons.push(
      `Artifact failed technical quality (${failure_code}). Retrying autonomous provider generation with revised parameters/prompt.`
    );
    return {
      retry_class: 'RETRY_WITH_REPROMPT',
      retry_stage: 'GENERATION',
      next_job_status: 'WAITING_RETRY',
      consume_attempt: true,
      suggested_delay_ms: computeRetryDelay(attempt_number).delay_ms,
      evidence: baseEvidence
    };
  }

  // Binary integrity / decode / error response issues -> RETRY_FROM_SOURCE
  if (
    failure_code === MEDIA_QA_FAILURE_CODES.EMPTY_BYTES ||
    failure_code === MEDIA_QA_FAILURE_CODES.INVALID_BINARY ||
    failure_code === MEDIA_QA_FAILURE_CODES.DECODE_OR_HEADER_INVALID ||
    failure_code === MEDIA_QA_FAILURE_CODES.ERROR_PAYLOAD
  ) {
    baseEvidence.reasons.push(
      `Artifact integrity failure (${failure_code}). Retrying acquisition from provider source.`
    );
    return {
      retry_class: 'RETRY_FROM_SOURCE',
      retry_stage: 'GENERATION',
      next_job_status: 'WAITING_RETRY',
      consume_attempt: true,
      suggested_delay_ms: computeRetryDelay(attempt_number).delay_ms,
      evidence: baseEvidence
    };
  }

  // Fallback for unknown failure codes
  baseEvidence.reasons.push(`Unrecognized failure code "${failure_code}". Defaulting to OPERATOR_REQUIRED for safety.`);
  return {
    retry_class: 'OPERATOR_REQUIRED',
    retry_stage: 'NONE',
    next_job_status: 'USER_ACTION_REQUIRED',
    consume_attempt: false,
    operator_reason: `UNKNOWN_FAILURE_${failure_code}`,
    evidence: baseEvidence
  };
}

/**
 * Canonical alias for decideMediaRetryPolicy per MEDIA-A5.4 single authority rule.
 */
export const classifyMediaRetry = decideMediaRetryPolicy;

/**
 * Stage retry budgets: number of permissible retries per stage before escalating to FAILED_TERMINAL.
 * 2 retries per stage (e.g. 1 initial attempt + 2 retries = 3 total attempts for that stage),
 * exactly matching generation budget semantics without consuming generation attempts.
 */
export const DEFAULT_STAGE_RETRY_CONFIG: Record<string, number> = {
  TRANSFORM: 2,
  STORAGE: 2,
  DELIVERY_VERIFY: 2,
  ATTACHMENT: 0,
  DEFAULT: 2
};

export function getMaxStageAttemptsForStage(stage: string): number {
  return DEFAULT_STAGE_RETRY_CONFIG[stage] ?? DEFAULT_STAGE_RETRY_CONFIG.DEFAULT;
}

