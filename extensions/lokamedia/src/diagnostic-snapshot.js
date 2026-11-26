/**
 * RancangLoka LokaMedia — Diagnostic Snapshot Engine
 *
 * Provides a one-click, read-only diagnostic snapshot of the complete
 * extension state before any media process is triggered.
 *
 * Security Invariants:
 * 1. STRICT ALLOWLISTING ONLY: Zero passwords, device tokens, bearer tokens,
 *    cookies, full conversation URLs, prompt bodies, or base64 blobs.
 * 2. READ-ONLY OBSERVATION: Collecting a snapshot causes ZERO state mutations,
 *    zero queue advancement, zero leases, and zero provider interactions.
 * 3. FAULT-ISOLATED SECTIONS: Any failure in one section is contained; other
 *    sections continue to report accurately.
 * 4. FACTUAL INTEGRITY: Explicitly labels data as OBSERVED, DERIVED, or UNKNOWN.
 */

import {
  EXTENSION_VERSION,
  LOKAMEDIA_PROTOCOL_VERSION,
  detectEnvironment
} from './constants.js';
import {
  resolveAuthoritativeProvider,
  normalizeProviderStatus,
  normalizeServerStatus,
  resolveCurrentJob,
  getJobWorkflowDetails,
  evaluateRunOnceEligibility,
  evaluateJobLease,
  resolveEffectiveDeviceId,
  isVersionCompatible
} from './popup-core.js';
import {
  computeQueueCounters,
  isProviderExecutionInFlight
} from './execution-state.js';

/**
 * Extracts domain-only from a URL without exposing private conversation paths.
 */
export function extractSafeDomainOnly(url) {
  if (!url || typeof url !== 'string') return 'none';
  try {
    const parsed = new URL(url.startsWith('http') ? url : `https://${url}`);
    return parsed.hostname;
  } catch {
    return String(url).split('/')[0] || 'none';
  }
}

/**
 * Truncates SHA-256 for display without leaking full strings if sensitive.
 */
export function safeShaPrefix(sha, length = 16) {
  if (!sha || typeof sha !== 'string' || sha === '--' || sha === 'NONE') return 'NONE';
  return sha.slice(0, length) + (sha.length > length ? '...' : '');
}

/**
 * Evaluates the button state matrix across all primary UI controls.
 */
export function evaluateButtonMatrix({
  state = {},
  workflow = {},
  currentJob = null,
  authProvider = {},
  pStatus = {},
  doc = null
} = {}) {
  const activeKey = authProvider.activeProviderKey || 'chatgpt';
  const providerLabel = authProvider.providerName || 'Provider';
  const runOnceElig = evaluateRunOnceEligibility({
    state,
    current: {
      job_id: currentJob?.job_id,
      operation: workflow.stage === 'WAITING' ? 'Waiting' : (currentJob?.local_state ?? 'active'),
      slot: currentJob?.slot_key || currentJob?.role || 'featured',
      article: currentJob?.article_title
    },
    provider: pStatus,
    server: normalizeServerStatus(state),
    runtimeVersion: EXTENSION_VERSION,
    expectedVersion: state.expected_extension_version || EXTENSION_VERSION
  });

  const matrix = [];

  function addControl(id, name, visibleLabel, enabled, reason, actualDomId = null) {
    let domEnabled = enabled;
    if (doc && actualDomId) {
      const el = doc.querySelector(`#${actualDomId}`);
      if (el) {
        domEnabled = !el.disabled;
      }
    }
    const isEffectivelyEnabled = Boolean(domEnabled && enabled);
    matrix.push({
      control_id: id,
      control_name: name,
      visible_label: visibleLabel,
      enabled: isEffectivelyEnabled,
      eligibility_result: isEffectivelyEnabled ? 'ELIGIBLE' : 'BLOCKED',
      disabled_reason: isEffectivelyEnabled ? 'READY' : (reason && reason !== 'READY' ? reason : 'Control disabled by workflow invariants')
    });
  }

  // 1. Run Once
  addControl(
    'run_once',
    'Run Once',
    'Run Once',
    runOnceElig.eligible,
    runOnceElig.reason || 'Job already consumed or queue empty',
    'run-once'
  );

  // 2. Provider Check
  addControl(
    'provider_check',
    'Provider Check',
    'Provider Check',
    true,
    'Always available for diagnostic probe',
    'diagnostic'
  );

  // 3. Bind Current Tab
  addControl(
    'bind_tab',
    'Bind Current Tab',
    `Bind Current ${providerLabel} Tab`,
    true,
    'Available when provider tab is focused in operator window',
    'bind-tab'
  );

  // 4. Send to Provider
  const sendDisabledReason = !workflow.can_send
    ? (workflow.send_reason ||
        (workflow.stage === 'RESULT READY'
          ? 'CURRENT_JOB_ALREADY_CAPTURED (Candidate review required before new prompt dispatch)'
          : workflow.stage === 'UPLOAD COMPLETE'
          ? 'CURRENT_JOB_ALREADY_COMPLETE'
          : 'Provider tab not ready or single-run consumed'))
    : 'READY';
  addControl(
    'send_to_provider',
    'Send to Provider',
    `Send to ${providerLabel}`,
    Boolean(workflow.can_send),
    sendDisabledReason,
    'send-to-chatgpt'
  );

  // 5. Acquire Job Lease
  const isServerOnline = normalizeServerStatus(state) === 'online';
  const acquireDisabledReason = !workflow.can_acquire_lease
    ? (workflow.acquire_lease_reason || 'Job lease is not available for acquisition')
    : (!isServerOnline ? 'RancangLoka server is offline' : 'READY');
  const isAcquireEligible = Boolean(workflow.can_acquire_lease && isServerOnline);
  addControl(
    'acquire_lease',
    'Acquire Job Lease',
    'Acquire Job Lease',
    isAcquireEligible,
    acquireDisabledReason,
    'btn-acquire-lease'
  );

  // 6. Copy Prompt
  addControl(
    'copy_prompt',
    'Copy Prompt',
    'Copy Prompt',
    Boolean(workflow.can_copy),
    workflow.can_copy ? 'READY' : 'No prompt text loaded',
    'copy-prompt'
  );

  // 6. Capture Latest Image
  addControl(
    'capture_latest',
    'Capture Latest Image',
    'Capture Latest Image',
    Boolean(workflow.can_capture_latest),
    workflow.can_capture_latest ? 'READY' : 'Provider tab not LOCKED or no image detected',
    'capture-latest'
  );

  // 7. Approve & Upload
  addControl(
    'approve_upload',
    'Approve & Upload',
    'Approve & Upload',
    Boolean(workflow.can_approve_upload),
    workflow.can_approve_upload ? 'READY' : 'No reviewable candidate or approval already consumed',
    'approve-upload'
  );

  // 8. Reject Result
  let rejectDisabledReason = workflow.can_reject ? 'READY' : 'No captured candidate to reject';
  if (!workflow.can_reject) {
    const isCompletedOrUploaded = Boolean(
      currentJob?.status === 'COMPLETE' ||
      currentJob?.local_state === 'UPLOAD_COMPLETE' ||
      workflow.preview?.is_uploaded
    );
    if (isCompletedOrUploaded) {
      rejectDisabledReason = 'Candidate already uploaded and confirmed; cannot reject completed asset';
    } else if (state?.jobApprovals?.[currentJob?.job_id]?.consumed) {
      rejectDisabledReason = 'Approval already consumed; cannot reject';
    } else if (workflow.stage !== 'RESULT READY') {
      rejectDisabledReason = 'No captured candidate in review stage to reject';
    }
  }
  addControl(
    'reject_result',
    'Reset Image',
    'Reset Image',
    Boolean(workflow.can_reject),
    rejectDisabledReason,
    'reject-result'
  );

  // 9. Select Fallback
  addControl(
    'select_fallback',
    'Select Fallback',
    'Select Fallback for Active Job',
    Boolean(workflow.can_select_fallback_file),
    workflow.can_select_fallback_file ? 'READY' : 'Active job complete or not selected',
    'btn-select-file'
  );

  // 10. Assign as Featured
  addControl(
    'assign_featured',
    'Assign as Featured',
    'Assign as Featured',
    Boolean(workflow.can_assign_featured),
    'Manual post-upload assignment required',
    'assign-featured'
  );

  // 11. Manual Media Promotion
  const manualState = state.manualPromotionState;
  const canRequestManual = Boolean(
    manualState?.article &&
    manualState?.candidate?.bytes &&
    manualState?.altText?.trim() &&
    manualState?.status === 'RESOLVED'
  );
  addControl(
    'manual_promotion_request',
    'Manual Promotion Request',
    'Request Promotion Approval',
    canRequestManual,
    canRequestManual ? 'READY' : 'Requires resolved article, local image candidate, and non-empty alt text',
    'manual-btn-approve'
  );

  return matrix;
}

/**
 * Collects a structured, read-only diagnostic snapshot object.
 */
export async function collectDiagnosticSnapshot({
  state = {},
  windowContext = null,
  doc = typeof document !== 'undefined' ? document : null,
  manifestVersion = EXTENSION_VERSION
} = {}) {
  const now = new Date().toISOString();

  // Section A: EXTENSION IDENTITY
  let identity = {};
  try {
    const expected = state.expected_extension_version || manifestVersion;
    const isCurrent = isVersionCompatible(manifestVersion, expected);
    identity = {
      manifest_version: manifestVersion,
      protocol_version: LOKAMEDIA_PROTOCOL_VERSION,
      snapshot_timestamp: now,
      user_agent: typeof navigator !== 'undefined' ? navigator.userAgent : 'UNKNOWN',
      runtime_readiness: 'ONLINE',
      expected_version: expected,
      compatibility: isCurrent ? 'CURRENT' : 'RELOAD_REQUIRED'
    };
  } catch (err) {
    identity = { error: String(err?.message || err), manifest_version: manifestVersion };
  }

  // Section B: CURRENT BROWSER PROVIDER
  let provider = {};
  let authProvider = {};
  let pStatus = {};
  try {
    authProvider = resolveAuthoritativeProvider(state, windowContext);
    const activeKey = authProvider.activeProviderKey || 'chatgpt';
    pStatus = normalizeProviderStatus(state.provider?.[activeKey] ?? {});
    provider = {
      detected_foreground: windowContext?.tabUrl?.includes('gemini.google.com')
        ? 'Gemini'
        : windowContext?.tabUrl?.includes('chatgpt.com')
        ? 'ChatGPT'
        : 'None',
      selected: authProvider.providerName,
      bound: pStatus.target === 'LOCKED' ? authProvider.providerName : 'None',
      selection_reason: authProvider.selectionReason,
      domain: extractSafeDomainOnly(pStatus.bound_url),
      tab_status: pStatus.tab,
      target_state: pStatus.target,
      auth_state: pStatus.auth,
      dom_status: pStatus.dom,
      composer_status: pStatus.composer,
      image_candidates: pStatus.images,
      lane: pStatus.lane,
      execution_lock: isProviderExecutionInFlight(state) ? 'LOCKED' : 'NONE'
    };
  } catch (err) {
    provider = { error: String(err?.message || err) };
  }

  // Section C: CURRENT EDITORIAL JOB
  let job = {};
  let currentJob = null;
  let workflow = {};
  let isCanaryMasking = false;
  let maskedJobs = [];
  let isCurrentArt4 = false;
  try {
    currentJob = resolveCurrentJob(state);
    workflow = getJobWorkflowDetails(
      state,
      state.provider?.[authProvider.activeProviderKey] ?? {},
      null,
      authProvider.providerName
    );

    const allJobs = Object.values(state.jobs ?? {});
    const art4InStore = Boolean(
      state.jobs?.['mjob_art4_inline_material_comparison'] ||
      state.jobs?.['mjob_art4_featured_hero'] ||
      allJobs.some((j) => j.article_id === 4 || j.article_slug?.includes('perbedaan-atap-metal'))
    );
    isCurrentArt4 = Boolean(
      currentJob && (
        currentJob.article_id === 4 ||
        currentJob.job_id?.startsWith('mjob_art4_') ||
        currentJob.article_slug?.includes('perbedaan-atap-metal')
      )
    );
    isCanaryMasking = Boolean(
      currentJob &&
      !isCurrentArt4 &&
      ['CAPTURED', 'RESULT_READY'].includes(currentJob.local_state) &&
      allJobs.some(
        (j) => j.job_id !== currentJob.job_id && (j.local_state === 'QUEUED' || j.status === 'QUEUED')
      )
    );

    if (isCanaryMasking) {
      maskedJobs = allJobs
        .filter((j) => j.job_id !== currentJob.job_id && (j.local_state === 'QUEUED' || j.status === 'QUEUED'))
        .map((j) => j.job_id);
    }

    const lease = evaluateJobLease(currentJob, state);
    const leaseEvaluation = lease.leaseEvaluation;

    job = {
      local_job_id: currentJob?.job_id || 'NONE',
      article_title: currentJob?.article_title || 'None',
      article_slug: currentJob?.article_slug || 'None',
      media_job_id: currentJob?.job_id || 'NONE',
      role: currentJob?.role || currentJob?.slot_key || 'NONE',
      slot_key: currentJob?.slot_key || 'NONE',
      stage: workflow.stage || 'WAITING',
      job_status: currentJob?.status || 'NONE',
      local_state: currentJob?.local_state || 'NONE',
      provider_provenance: currentJob?.provider || authProvider.providerName || 'NONE',
      candidate_status: currentJob?.blob_key || currentJob?.sha256 ? 'CAPTURED' : (workflow.preview?.available ? 'CAPTURED' : 'NONE'),
      review_approval_state: state.jobApprovals?.[currentJob?.job_id]?.consumed
        ? 'APPROVAL_CONSUMED'
        : state.jobApprovals?.[currentJob?.job_id]
        ? 'APPROVED_READY'
        : 'PENDING_REVIEW',
      lease_status: currentJob?.lease_owner ? `LEASED_BY_${currentJob.lease_owner}` : 'UNLEASED',
      lease_evaluation: leaseEvaluation,
      lease_owner: currentJob?.lease_owner || 'NONE',
      lease_expires_at: currentJob?.lease_expires_at || 'NONE',
      last_transition_reason: currentJob?.last_error_code || currentJob?.attention_reason || 'NORMAL',
      canary_masking: isCanaryMasking
        ? (art4InStore
            ? `YES (Masking ${maskedJobs.length} queued job(s): ${maskedJobs.join(', ')})`
            : `YES (Masking ${maskedJobs.length} other queued job(s): ${maskedJobs.join(', ')}; Article 4 pilot is NOT in store)`)
        : 'NO'
    };
  } catch (err) {
    job = { error: String(err?.message || err) };
  }

  // Expected Pilot Article 4 Diagnostic Block
  let expectedPilot = {};
  try {
    const art4Job = isCurrentArt4
      ? currentJob
      : (state.jobs?.['mjob_art4_inline_material_comparison'] ||
         state.jobs?.['mjob_art4_featured_hero'] ||
         Object.values(state.jobs ?? {}).find((j) => j.article_id === 4 || j.article_slug?.includes('perbedaan-atap-metal')));
    if (art4Job) {
      expectedPilot = {
        job_id: art4Job.job_id,
        article_title: art4Job.article_title,
        role: art4Job.role || 'inline',
        slot_key: art4Job.slot_key,
        status_in_store: art4Job.status,
        local_state_in_store: art4Job.local_state || art4Job.status,
        selection_state: currentJob?.job_id === art4Job.job_id ? 'ACTIVE_SELECTED' : 'SHADOWED_BY_REVIEW_PENDING_CANARY',
        remedy: currentJob?.job_id === art4Job.job_id ? 'ACTIVE' : 'Use Job Selector dropdown to select Article 4'
      };
    } else {
      expectedPilot = {
        job_id: 'mjob_art4_inline_material_comparison',
        status_in_store: 'NOT_FOUND_IN_LOCAL_EXTENSION_STORE',
        selection_state: 'NOT_IN_LOCAL_STORE',
        remedy: (state.activeEnvironment === 'production' || detectEnvironment(state.config?.serverBaseUrl) === 'production')
          ? 'Switch environment to LOCAL DEVELOPMENT in Configuration drawer and ensure local dev server is running'
          : 'Verify local dev server is running on port 4321 and jobs are synchronized'
      };
    }
  } catch (err) {
    expectedPilot = { error: String(err?.message || err) };
  }

  // Section D: QUEUE & SERVER
  let server = {};
  try {
    const counters = computeQueueCounters(state);
    const allJobs = Object.values(state.jobs ?? {});
    const queueSummary = allJobs
      .map((j) => `[${j.job_id}] ${j.role || j.slot_key || 'media'}:${j.local_state || j.status}`)
      .join('; ');

    const configuredEnv = state.activeEnvironment || 'local';
    const actualHttpDestination = state.config?.serverBaseUrl || 'http://localhost:4321';
    const detectedEnv = detectEnvironment(actualHttpDestination);
    const isConsistent = configuredEnv === detectedEnv;
    const isLocalDev = configuredEnv === 'local' || detectedEnv === 'local';
    const isTokenlessDev = (!state.config?.deviceToken && isLocalDev);

    server = {
      server_connection: normalizeServerStatus(state),
      configured_environment: configuredEnv,
      actual_http_destination: actualHttpDestination,
      environment_consistency: isConsistent ? 'CONSISTENT' : 'MISMATCH_BLOCKER',
      environment: configuredEnv,
      server_base_url: actualHttpDestination,
      device_id: resolveEffectiveDeviceId(state),
      device_token_configured: Boolean(state.config?.deviceToken),
      executing: counters.executing,
      awaiting_review: counters.awaitingReview,
      waiting: counters.waiting,
      complete: counters.complete,
      failed_rejected: counters.failedRejected,
      total: counters.totalJobs,
      local_queue_summary: queueSummary || 'EMPTY',
      backend_queue_sync: Boolean(state.config?.deviceToken)
        ? (isConsistent ? 'AUTHENTICATED_AND_POLLING' : 'BLOCKED_BY_ENVIRONMENT_MISMATCH')
        : (isTokenlessDev
          ? (isConsistent ? 'LOCAL_DEV_TOKENLESS_POLLING' : 'BLOCKED_BY_ENVIRONMENT_MISMATCH')
          : 'PAUSED_MISSING_DEVICE_TOKEN')
    };
  } catch (err) {
    server = { error: String(err?.message || err) };
  }

  // Section E: BUTTON STATE MATRIX
  let buttons = [];
  try {
    buttons = evaluateButtonMatrix({
      state,
      workflow,
      currentJob,
      authProvider,
      pStatus,
      doc
    });
  } catch (err) {
    buttons = [{ error: String(err?.message || err) }];
  }

  // Section F: CURRENT MEDIA CANDIDATE
  let candidate = {};
  try {
    const candObj = currentJob?.candidate || currentJob?.preview_candidate || (currentJob?.blob_key ? currentJob : null);
    const hasBlob = Boolean(candObj?.blob_key || currentJob?.blob_key || workflow.preview?.available);
    candidate = {
      candidate_exists: hasBlob ? 'YES' : 'NONE',
      original_provider: candObj?.provider || authProvider.providerName || 'NONE',
      target_role: currentJob?.role || 'NONE',
      target_slot: currentJob?.slot_key || 'NONE',
      dimensions: workflow.preview?.dimensions || (candObj?.width ? `${candObj.width} × ${candObj.height}` : 'NONE'),
      mime_type: workflow.preview?.mime || candObj?.mime || 'NONE',
      byte_size: workflow.preview?.size || (candObj?.size ? `${candObj.size} B` : 'NONE'),
      sha256_prefix: safeShaPrefix(workflow.preview?.short_sha256 || candObj?.sha256 || currentJob?.sha256),
      capture_complete: hasBlob ? 'YES' : 'NO',
      human_approval: state.jobApprovals?.[currentJob?.job_id] ? 'APPROVED' : 'AWAITING_REVIEW',
      upload_status: (currentJob?.status === 'COMPLETE' || currentJob?.local_state === 'UPLOAD_COMPLETE')
        ? 'UPLOADED'
        : 'NOT_UPLOADED'
    };
  } catch (err) {
    candidate = { error: String(err?.message || err) };
  }

  // Section G: ERRORS & READINESS
  let errors = {};
  try {
    errors = {
      last_safe_error_code: state.status?.last_error || 'NONE',
      version_mismatch: identity.compatibility === 'CURRENT' ? 'NONE' : `Runtime ${identity.manifest_version} vs Expected ${identity.expected_version}`,
      environment_mismatch_blocker: server.environment_consistency === 'MISMATCH_BLOCKER'
        ? `ENVIRONMENT_URL_MISMATCH (Configured '${server.configured_environment}' vs HTTP target '${server.actual_http_destination}')`
        : 'NONE',
      provider_mismatch: (authProvider.activeProviderId !== 'GEMINI_BROWSER' && authProvider.activeProviderId !== 'CHATGPT_BROWSER')
        ? 'UNSUPPORTED_PROVIDER'
        : 'NONE',
      job_eligibility_blocker: workflow.stage === 'RESULT READY'
        ? 'CURRENT_JOB_IN_RESULT_READY (Historical canary candidate awaiting review; select Article 4 to dispatch)'
        : !workflow.can_send
        ? (workflow.send_reason || 'Send disabled by workflow invariants')
        : 'NONE',
      missing_queue_item_blocker: server.total === 0 ? 'QUEUE_EMPTY' : 'NONE',
      approval_boundary_blocker: candidate.candidate_exists === 'YES' && candidate.human_approval !== 'APPROVED'
        ? 'HUMAN_APPROVAL_REQUIRED_BEFORE_UPLOAD'
        : 'NONE',
      snapshot_collection_failures: 'NONE'
    };
  } catch (err) {
    errors = { error: String(err?.message || err) };
  }

  return {
    timestamp: now,
    identity,
    provider,
    job,
    expected_pilot: expectedPilot,
    server,
    buttons,
    candidate,
    errors
  };
}

/**
 * Formats a snapshot object into the standardized, human-readable plain text report.
 */
export function formatDiagnosticSnapshotText(snapshot) {
  const lines = [];

  lines.push('======================================================================');
  lines.push('RANCANGLOKA LOKAMEDIA DIAGNOSTIC SNAPSHOT');
  lines.push(`Timestamp: ${snapshot.timestamp || 'UNKNOWN'}`);
  lines.push(`Extension: v${snapshot.identity?.manifest_version || 'UNKNOWN'} (Protocol v${snapshot.identity?.protocol_version || 'UNKNOWN'})`);
  lines.push(`Environment: ${snapshot.server?.environment || 'UNKNOWN'} (${snapshot.server?.server_base_url || 'UNKNOWN'})`);
  lines.push('======================================================================');
  lines.push('');

  // [EXTENSION IDENTITY]
  lines.push('[EXTENSION IDENTITY]');
  lines.push(`Manifest Version: ${snapshot.identity?.manifest_version || 'UNKNOWN'}`);
  lines.push(`Protocol Version: ${snapshot.identity?.protocol_version || 'UNKNOWN'}`);
  lines.push(`Runtime Readiness: ${snapshot.identity?.runtime_readiness || 'UNKNOWN'}`);
  lines.push(`Backend Expected Version: ${snapshot.identity?.expected_version || 'UNKNOWN'}`);
  lines.push(`Version Compatibility: ${snapshot.identity?.compatibility || 'UNKNOWN'}`);
  lines.push('');

  // [BROWSER PROVIDER]
  lines.push('[BROWSER PROVIDER]');
  lines.push(`Detected Foreground: ${snapshot.provider?.detected_foreground || 'UNKNOWN'}`);
  lines.push(`Selected Provider: ${snapshot.provider?.selected || 'UNKNOWN'}`);
  lines.push(`Bound Provider: ${snapshot.provider?.bound || 'UNKNOWN'}`);
  lines.push(`Selection Reason: ${snapshot.provider?.selection_reason || 'UNKNOWN'}`);
  lines.push(`Bound Domain Only: ${snapshot.provider?.domain || 'none'}`);
  lines.push(`Tab Status: ${snapshot.provider?.tab_status || 'UNKNOWN'}`);
  lines.push(`Target State: ${snapshot.provider?.target_state || 'UNKNOWN'}`);
  lines.push(`Auth Readiness: ${snapshot.provider?.auth_state || 'UNKNOWN'}`);
  lines.push(`DOM Capability: ${snapshot.provider?.dom_status || 'UNKNOWN'}`);
  lines.push(`Composer Readiness: ${snapshot.provider?.composer_status || 'UNKNOWN'}`);
  lines.push(`Visible Image Candidates: ${snapshot.provider?.image_candidates ?? 0}`);
  lines.push(`Execution Lane: ${snapshot.provider?.lane || 'UNKNOWN'}`);
  lines.push(`Execution Lock: ${snapshot.provider?.execution_lock || 'NONE'}`);
  lines.push('');

  // [CURRENT EDITORIAL JOB]
  lines.push('[CURRENT EDITORIAL JOB]');
  lines.push(`Local Job ID: ${snapshot.job?.local_job_id || 'NONE'}`);
  lines.push(`Article Title: ${snapshot.job?.article_title || 'None'}`);
  lines.push(`Article Slug: ${snapshot.job?.article_slug || 'None'}`);
  lines.push(`Role / Slot Key: ${snapshot.job?.role || 'NONE'} (${snapshot.job?.slot_key || 'NONE'})`);
  lines.push(`Current Workflow Stage: ${snapshot.job?.stage || 'WAITING'}`);
  lines.push(`Server Job Status: ${snapshot.job?.job_status || 'NONE'}`);
  lines.push(`Local State: ${snapshot.job?.local_state || 'NONE'}`);
  lines.push(`Provider Provenance: ${snapshot.job?.provider_provenance || 'NONE'}`);
  lines.push(`Candidate Status: ${snapshot.job?.candidate_status || 'NONE'}`);
  lines.push(`Lease Status: ${snapshot.job?.lease_status || 'UNLEASED'}`);
  lines.push(`Lease Evaluation: ${snapshot.job?.lease_evaluation || 'UNLEASED'}`);
  lines.push(`Lease Owner: ${snapshot.job?.lease_owner || 'NONE'}`);
  lines.push(`Lease Expires At: ${snapshot.job?.lease_expires_at || 'NONE'}`);
  lines.push(`Canary Masking Queued Jobs: ${snapshot.job?.canary_masking || 'NO'}`);
  lines.push('');

  // [EXPECTED PILOT (Article 4)]
  lines.push('[EXPECTED PILOT (Article 4)]');
  lines.push(`Target Job ID: ${snapshot.expected_pilot?.job_id || 'mjob_art4_inline_material_comparison'}`);
  lines.push(`Status in Store: ${snapshot.expected_pilot?.status_in_store || 'UNKNOWN'}`);
  lines.push(`Selection State: ${snapshot.expected_pilot?.selection_state || 'UNKNOWN'}`);
  lines.push(`Actionable Remedy: ${snapshot.expected_pilot?.remedy || 'UNKNOWN'}`);
  lines.push('');

  // [BUTTON STATE MATRIX]
  lines.push('[BUTTON STATE MATRIX]');
  if (Array.isArray(snapshot.buttons)) {
    for (const b of snapshot.buttons) {
      if (b.error) {
        lines.push(`- Error: ${b.error}`);
        continue;
      }
      const stateLabel = b.enabled ? 'ENABLED' : 'DISABLED';
      lines.push(`- ${b.visible_label} (${b.control_name}): ${stateLabel} | Reason: ${b.disabled_reason}`);
    }
  } else {
    lines.push('Buttons data unavailable.');
  }
  lines.push('');

  // [QUEUE & SERVER]
  lines.push('[QUEUE & SERVER]');
  lines.push(`Server Connection: ${snapshot.server?.server_connection || 'offline'}`);
  lines.push(`Configured Environment: ${snapshot.server?.configured_environment || snapshot.server?.environment || 'UNKNOWN'}`);
  lines.push(`Actual HTTP Destination: ${snapshot.server?.actual_http_destination || snapshot.server?.server_base_url || 'UNKNOWN'}`);
  lines.push(`Environment Consistency: ${snapshot.server?.environment_consistency || 'UNKNOWN'}`);
  lines.push(`Server Base URL: ${snapshot.server?.server_base_url || 'UNKNOWN'}`);
  lines.push(`Device Token Configured: ${snapshot.server?.device_token_configured ? 'YES' : 'NO'}`);
  lines.push(`Backend Queue Sync: ${snapshot.server?.backend_queue_sync || 'UNKNOWN'}`);
  lines.push(`Executing: ${snapshot.server?.executing ?? 0}`);
  lines.push(`Awaiting Review: ${snapshot.server?.awaiting_review ?? 0}`);
  lines.push(`Waiting: ${snapshot.server?.waiting ?? 0}`);
  lines.push(`Complete: ${snapshot.server?.complete ?? 0}`);
  lines.push(`Failed / Rejected: ${snapshot.server?.failed_rejected ?? 0}`);
  lines.push(`Total Jobs in Queue: ${snapshot.server?.total ?? 0}`);
  lines.push(`Local Queue Summary: ${snapshot.server?.local_queue_summary || 'EMPTY'}`);
  lines.push('');

  // [CURRENT MEDIA CANDIDATE]
  lines.push('[CURRENT MEDIA CANDIDATE]');
  lines.push(`Candidate Exists: ${snapshot.candidate?.candidate_exists || 'NONE'}`);
  lines.push(`Original Provider: ${snapshot.candidate?.original_provider || 'NONE'}`);
  lines.push(`Role / Slot: ${snapshot.candidate?.target_role || 'NONE'} / ${snapshot.candidate?.target_slot || 'NONE'}`);
  lines.push(`Dimensions: ${snapshot.candidate?.dimensions || 'NONE'}`);
  lines.push(`MIME Type: ${snapshot.candidate?.mime_type || 'NONE'}`);
  lines.push(`Byte Size: ${snapshot.candidate?.byte_size || 'NONE'}`);
  lines.push(`SHA-256 (prefix): ${snapshot.candidate?.sha256_prefix || 'NONE'}`);
  lines.push(`Human Approved: ${snapshot.candidate?.human_approval || 'NONE'}`);
  lines.push(`Upload Status: ${snapshot.candidate?.upload_status || 'NOT_UPLOADED'}`);
  lines.push('');

  // [ERRORS & READINESS]
  lines.push('[ERRORS & READINESS]');
  lines.push(`Last Safe Error Code: ${snapshot.errors?.last_safe_error_code || 'NONE'}`);
  lines.push(`Version Mismatch: ${snapshot.errors?.version_mismatch || 'NONE'}`);
  lines.push(`Environment Mismatch: ${snapshot.errors?.environment_mismatch_blocker || 'NONE'}`);
  lines.push(`Provider Mismatch: ${snapshot.errors?.provider_mismatch || 'NONE'}`);
  lines.push(`Job Eligibility Blocker: ${snapshot.errors?.job_eligibility_blocker || 'NONE'}`);
  lines.push(`Queue Empty Blocker: ${snapshot.errors?.missing_queue_item_blocker || 'NONE'}`);
  lines.push(`Human Approval Boundary: ${snapshot.errors?.approval_boundary_blocker || 'NONE'}`);
  lines.push('');

  // [DIAGNOSTIC CONCLUSION]
  lines.push('[DIAGNOSTIC CONCLUSION]');

  const configuredEnv = snapshot.server?.configured_environment || snapshot.server?.environment || 'local';
  const env = configuredEnv;
  const serverUrl = snapshot.server?.actual_http_destination || snapshot.server?.server_base_url || 'http://localhost:4321';
  const isConsistent = snapshot.server?.environment_consistency === 'CONSISTENT';
  const isServerOnline = snapshot.server?.server_connection === 'online';
  const isTokenConfigured = Boolean(snapshot.server?.device_token_configured);
  const art4InStore = Boolean(
    snapshot.expected_pilot?.status_in_store &&
    snapshot.expected_pilot.status_in_store !== 'NOT_FOUND_IN_LOCAL_EXTENSION_STORE'
  );
  const isArt4Selected = Boolean(
    snapshot.job?.local_job_id === (snapshot.expected_pilot?.job_id || 'mjob_art4_inline_material_comparison') ||
    snapshot.job?.local_job_id?.startsWith('mjob_art4_') ||
    snapshot.job?.article_id === 4 ||
    snapshot.job?.article_slug?.includes('perbedaan-atap-metal')
  );
  const isCanaryActive = snapshot.job?.stage === 'RESULT READY' && !isArt4Selected;

  const sendControl = Array.isArray(snapshot.buttons)
    ? snapshot.buttons.find((b) => b.control_id === 'send_to_provider')
    : null;
  const isCurrentJobComplete = Boolean(
    snapshot.job?.job_status === 'COMPLETE' ||
    snapshot.job?.stage === 'UPLOAD COMPLETE' ||
    snapshot.job?.local_state === 'UPLOAD_COMPLETE'
  );
  const isCurrentJobResultReady = snapshot.job?.stage === 'RESULT READY';
  const isCurrentJobInProgress = Boolean(
    ['SUBMITTING', 'GENERATING', 'UPLOADING'].includes(snapshot.job?.stage) ||
    ['SUBMITTING', 'GENERATING', 'UPLOADING'].includes(snapshot.job?.local_state)
  );

  let primaryBlocker = 'NONE';
  const observedEvidence = [];
  const derivedEvidence = [];
  const actionableGuidance = [];
  const unknowns = [];

  if (!isConsistent) {
    primaryBlocker = 'ENVIRONMENT_URL_MISMATCH';
    observedEvidence.push(`1. Configured environment is '${configuredEnv}', but actual HTTP destination is '${serverUrl}'.`);
    observedEvidence.push(`2. Environment Consistency is reported as 'MISMATCH_BLOCKER'.`);
    derivedEvidence.push(`1. Invariant violation: Environment ${configuredEnv.toUpperCase()} must never retain or use a mismatched backend URL.`);
    derivedEvidence.push(`2. All background polling and queue synchronization are blocked to prevent cross-environment contamination.`);
    actionableGuidance.push(`1. In Side Panel Environment dropdown, select '${configuredEnv.toUpperCase()}' and click 'Switch'.`);
    actionableGuidance.push(`2. Or click Save in Configuration to re-align server base URL with the active profile.`);
    unknowns.push(`1. Storage migration state that preserved production URL during local profile initialization.`);
  } else if (env === 'production' && !art4InStore) {
    primaryBlocker = 'CONNECTED_TO_PRODUCTION_BACKEND';
    observedEvidence.push(`1. Connected environment is 'production' (${snapshot.server?.server_base_url || 'https://rancangloka.com'}).`);
    observedEvidence.push(`2. Article 4 pilot job '${snapshot.expected_pilot?.job_id}' status in extension store is '${snapshot.expected_pilot?.status_in_store || 'NOT_FOUND_IN_LOCAL_EXTENSION_STORE'}'.`);
    observedEvidence.push(`3. Current active job is '${snapshot.job?.article_title}' (${snapshot.job?.local_job_id}) in stage '${snapshot.job?.stage}'.`);
    derivedEvidence.push(`1. Article 4 inline job was prepared in local development D1 / Miniflare, not production.`);
    derivedEvidence.push(`2. Extension connected to production cannot discover, poll, or lease local development jobs.`);
    actionableGuidance.push(`1. Open Configuration drawer in LokaMedia Side Panel.`);
    actionableGuidance.push(`2. In the Environment selector, choose 'LOCAL DEVELOPMENT' (http://localhost:4321).`);
    actionableGuidance.push(`3. Click 'Switch Environment' to safely isolate state and route to local backend.`);
    unknowns.push(`1. Is local Astro development server listening on port 4321? (Verify with: npm run dev)`);
    unknowns.push(`2. Has local media device token been authorized in local Miniflare D1?`);
  } else if (!isServerOnline && !art4InStore) {
    primaryBlocker = 'LOCAL_BACKEND_SERVER_OFFLINE';
    observedEvidence.push(`1. Connected environment is '${env}' (${snapshot.server?.server_base_url}), but server connection is '${snapshot.server?.server_connection}'.`);
    observedEvidence.push(`2. Target pilot job status in extension store is '${snapshot.expected_pilot?.status_in_store || 'NOT_FOUND_IN_LOCAL_EXTENSION_STORE'}'.`);
    derivedEvidence.push(`1. Extension cannot poll or synchronize media jobs from an offline local server.`);
    actionableGuidance.push(`1. Start the local Astro server: run 'npm run dev' in rancangloka-astro/ directory.`);
    actionableGuidance.push(`2. Confirm server is accessible at ${snapshot.server?.server_base_url}/api/internal/v1/media/jobs.`);
    unknowns.push(`1. Local server process port availability and firewall/sandbox constraints.`);
  } else if (!isTokenConfigured && env !== 'local' && !art4InStore) {
    primaryBlocker = 'DEVICE_TOKEN_UNCONFIGURED';
    observedEvidence.push(`1. Backend is online (${snapshot.server?.server_base_url}), but Device Token Configured is 'NO'.`);
    observedEvidence.push(`2. Target pilot job status in extension store is '${snapshot.expected_pilot?.status_in_store || 'NOT_FOUND_IN_LOCAL_EXTENSION_STORE'}'.`);
    derivedEvidence.push(`1. Non-local media job synchronization requires an authenticated device bearer token.`);
    actionableGuidance.push(`1. Open Configuration drawer in Side Panel.`);
    actionableGuidance.push(`2. Enter authorized device token and click Save.`);
    unknowns.push(`1. Device token authorization in remote environment.`);
  } else if (art4InStore && isCanaryActive) {
    primaryBlocker = 'HISTORICAL_CANARY_MASKING_NEW_JOB';
    observedEvidence.push(`1. Displayed current job is '${snapshot.job?.article_title}' in stage '${snapshot.job?.stage}'.`);
    observedEvidence.push(`2. Target pilot job '${snapshot.expected_pilot?.job_id}' is PRESENT in local extension store (status: '${snapshot.expected_pilot?.status_in_store}').`);
    observedEvidence.push(`3. Send to ${snapshot.provider?.selected || 'Provider'} disabled reason: ${sendControl?.disabled_reason || 'N/A'}.`);
    derivedEvidence.push(`1. Current canary job has an unreviewed candidate, locking workflow to prevent accidental overwrite.`);
    derivedEvidence.push(`2. Article 4 is present in extension store and ready to be selected.`);
    actionableGuidance.push(`1. Select Article 4 from the Active Job Selector dropdown.`);
    actionableGuidance.push(`2. Once Article 4 is active, stage will change to PROMPT READY.`);
    unknowns.push(`1. Operator intention regarding historical canary candidate.`);
  } else if (isCurrentJobComplete) {
    primaryBlocker = 'CURRENT_JOB_ALREADY_COMPLETE';
    observedEvidence.push(`1. Selected job '${snapshot.job?.article_title}' (${snapshot.job?.local_job_id}) is marked COMPLETE (stage: '${snapshot.job?.stage}').`);
    observedEvidence.push(`2. Send to ${snapshot.provider?.selected || 'Provider'} is DISABLED (Reason: CURRENT_JOB_ALREADY_COMPLETE).`);
    derivedEvidence.push(`1. Completed media jobs have confirmed server assets and cannot receive prompt dispatch.`);
    actionableGuidance.push(`1. Select an uncompleted job (such as Article 4) from the Active Job Selector dropdown.`);
  } else if (isCurrentJobResultReady) {
    primaryBlocker = 'CURRENT_JOB_IN_RESULT_READY';
    observedEvidence.push(`1. Selected job '${snapshot.job?.article_title}' (${snapshot.job?.local_job_id}) has a captured candidate awaiting review.`);
    observedEvidence.push(`2. Send to ${snapshot.provider?.selected || 'Provider'} is DISABLED pending operator candidate decision.`);
    derivedEvidence.push(`1. Candidate review required before new prompt dispatch.`);
    actionableGuidance.push(`1. Review the candidate preview in Side Panel, then click Approve & Upload or Reset Image.`);
  } else if (isCurrentJobInProgress) {
    primaryBlocker = 'JOB_IN_PROGRESS';
    observedEvidence.push(`1. Selected job '${snapshot.job?.local_job_id}' is actively in stage '${snapshot.job?.stage}'.`);
    derivedEvidence.push(`1. In-flight operations must complete before new prompt dispatch.`);
    actionableGuidance.push(`1. Wait for ${snapshot.job?.stage} operation to finish.`);
  } else if (!art4InStore && (snapshot.job?.local_job_id === 'NONE' || !snapshot.job?.local_job_id)) {
    primaryBlocker = 'PILOT_JOB_NOT_FOUND_IN_LOCAL_STORE';
    observedEvidence.push(`1. Connected to '${snapshot.server?.server_base_url}', but Article 4 pilot is '${snapshot.expected_pilot?.status_in_store}'.`);
    observedEvidence.push(`2. Active Job Selector dropdown contains ${snapshot.server?.total ?? 0} job(s), excluding Article 4.`);
    derivedEvidence.push(`1. Article 4 job has not been polled into extension storage or local D1 has not queued it.`);
    actionableGuidance.push(`1. Verify local D1 has 'mjob_art4_inline_material_comparison' in status 'QUEUED'.`);
    actionableGuidance.push(`2. Trigger queue refresh by clicking Save in Configuration or reloading extension.`);
    unknowns.push(`1. Timestamp of last successful local background poll.`);
  } else if (snapshot.job?.local_job_id === 'NONE' || !snapshot.job?.local_job_id) {
    primaryBlocker = 'NO_JOB_SELECTED';
    observedEvidence.push(`1. No active media job is selected in the local extension.`);
    actionableGuidance.push(`1. Select a job from the Active Job Selector dropdown.`);
  } else if (snapshot.job?.lease_evaluation === 'LEASE_EXPIRED') {
    primaryBlocker = 'JOB_LEASE_EXPIRED';
    observedEvidence.push(`1. Selected job '${snapshot.job?.local_job_id}' has an expired lease (expired at: ${snapshot.job?.lease_expires_at}).`);
    derivedEvidence.push(`1. A job with an expired lease cannot be safely dispatched without lease renewal.`);
    actionableGuidance.push(`1. Click 'Acquire Job Lease' in the Side Panel to refresh the expired lease, or trigger queue synchronization.`);
  } else if (snapshot.job?.lease_evaluation?.startsWith('MISMATCH_OWNED_BY_')) {
    primaryBlocker = 'JOB_LEASE_MISMATCH';
    observedEvidence.push(`1. Selected job '${snapshot.job?.local_job_id}' is leased to another device (${snapshot.job?.lease_owner}).`);
    derivedEvidence.push(`1. Current device (${snapshot.server?.device_id}) cannot dispatch a job leased to a different device.`);
    actionableGuidance.push(`1. Ensure active device matches lease owner or await lease expiration.`);
  } else if (snapshot.job?.lease_evaluation === 'UNLEASED') {
    primaryBlocker = 'JOB_UNLEASED';
    observedEvidence.push(`1. Selected job '${snapshot.job?.local_job_id}' is UNLEASED (no active lease held by this device).`);
    derivedEvidence.push(`1. Dispatch requires an active lease held by this device.`);
    actionableGuidance.push(`1. Click 'Acquire Job Lease' in the Side Panel to acquire an active lease.`);
  } else if (!snapshot.provider?.bound || snapshot.provider?.bound === 'None' || snapshot.provider?.target_state !== 'LOCKED') {
    primaryBlocker = 'PROVIDER_TAB_UNBOUND';
    observedEvidence.push(`1. Active provider is '${snapshot.provider?.selected || 'None'}', target state is '${snapshot.provider?.target_state || 'UNBOUND'}'.`);
    derivedEvidence.push(`1. Dispatch requires an active tab locked to the provider origin.`);
    actionableGuidance.push(`1. Open Gemini in a browser tab.`);
    actionableGuidance.push(`2. Click 'Bind Tab' in LokaMedia Side Panel.`);
    unknowns.push(`1. Gemini browser tab authentication state.`);
  } else if (snapshot.provider?.composer_status !== 'ready') {
    primaryBlocker = 'PROVIDER_COMPOSER_NOT_READY';
    observedEvidence.push(`1. Provider tab is locked, but composer status is '${snapshot.provider?.composer_status || 'NOT_READY'}'.`);
    derivedEvidence.push(`1. Provider composer must be ready to receive prompts.`);
    actionableGuidance.push(`1. Ensure composer input is visible and unlocked.`);
  } else if (!sendControl || !sendControl.enabled || sendControl.eligibility_result === 'BLOCKED') {
    let blockerCode = sendControl?.disabled_reason;
    if (!blockerCode || blockerCode === 'READY') {
      blockerCode = 'SEND_CONTROL_DISABLED';
    }
    primaryBlocker = blockerCode;
    observedEvidence.push(`1. Send to ${snapshot.provider?.selected || 'Provider'} control is DISABLED: ${blockerCode}.`);
    derivedEvidence.push(`1. Button eligibility matrix enforces safety invariants preventing prompt dispatch.`);
    actionableGuidance.push(`1. Resolve button eligibility constraint (${blockerCode}).`);
  } else if (snapshot.job?.stage === 'WAITING') {
    primaryBlocker = 'JOB_STAGE_WAITING';
    observedEvidence.push(`1. Selected job '${snapshot.job?.local_job_id}' is in workflow stage 'WAITING'.`);
    derivedEvidence.push(`1. Prompt dispatch requires workflow stage 'PROMPT READY'.`);
    actionableGuidance.push(`1. Await job readiness or renew active lease to advance workflow stage.`);
  } else {
    primaryBlocker = 'NONE_READY_FOR_DISPATCH';
    observedEvidence.push(`1. Active job '${snapshot.job?.article_title}' (${snapshot.job?.local_job_id}) is selected and ready.`);
    observedEvidence.push(`2. Provider '${snapshot.provider?.selected || 'Gemini'}' is locked, composer is ready, and lease is active.`);
    actionableGuidance.push(`1. Click 'Send to ${snapshot.provider?.selected || 'Gemini'}' to dispatch prompt.`);
  }

  lines.push(`Primary Blocker: ${primaryBlocker}`);
  lines.push('Evidence (OBSERVED):');
  for (const item of observedEvidence) lines.push(item);
  lines.push('Evidence (DERIVED):');
  for (const item of derivedEvidence) lines.push(item);
  lines.push('Actionable Guidance (OPERATOR ACTION):');
  for (const item of actionableGuidance) lines.push(item);
  if (unknowns.length > 0) {
    lines.push('Unknowns / Open Inquiries:');
    for (const item of unknowns) lines.push(item);
  }
  lines.push('');
  lines.push('======================================================================');
  lines.push('End Diagnostic Snapshot.');

  return lines.join('\n');
}
