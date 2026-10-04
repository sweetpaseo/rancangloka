/**
 * RancangLoka Hermes Mission Control — Anomaly Intelligence Layer
 * Milestone: MC-INTEL-1
 * 
 * Strict Invariants:
 * 1. READ / ANALYZE / RECOMMEND ONLY: Zero autonomous remediation, zero background execution.
 * 2. DETERMINISTIC DERIVATION: Identical inputs produce 100% identical intelligence outputs (No random drift).
 * 3. STRICT SEPARATION OF FACT VS INFERENCE: Never label an inference as confirmed fact;
 *    explicit confidence metrics apply strictly to inferred causes.
 * 4. CONSERVATIVE BLAST RADIUS: Never overstate impact or falsely attribute unrelated departments/staff.
 * 5. SAFE HUMAN RECOMMENDATIONS: Recommendations map strictly to allowlisted, human-gated operator actions
 *    (MC-LIVEOPS-3); NEVER recommend autonomous publication, worker activation, or authority escalation.
 * 6. ZERO JEFRY EXECUTION AUTHORITY: Jefry (TypeSafe JEV) remains shadow-only (0 execution authority).
 */

import type { MissionControlSnapshot, TaskCard } from './types.ts';
import type { MissionControlAnomaly, MissionControlAnomalyEvent, AnomalyState } from './anomalies.ts';
import { getStaffDefinitions, getStaffDefinitionByAgentId } from './staff-registry.ts';
import { CANONICAL_DEPARTMENTS, type DepartmentCanonicalConfig } from './department-registry.ts';
import { ACTION_ALLOWLIST, type OperatorActionType } from './actions.ts';

// ============================================================================
// Types & Contracts
// ============================================================================

export type AnomalyTaxonomyCategory =
  | 'PIPELINE_BLOCKED'
  | 'EVIDENCE_INCOMPLETE'
  | 'PUBLICATION_STALLED'
  | 'WORKER_UNAVAILABLE'
  | 'HANDOFF_FAILURE'
  | 'JOB_STALE'
  | 'HEALTH_DEGRADED'
  | 'AUTH_FAILURE'
  | 'DATA_INTEGRITY'
  | 'TELEMETRY_STALE'
  | 'DEPENDENCY_FAILURE';

export type IntelligenceSeverity = 'INFO' | 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';

export interface AffectedScope {
  affected_subsystems: string[];
  affected_departments: string[];
  unaffected_departments: string[];
  affected_staff: string[];
  unaffected_staff: string[];
  blocked_pipeline_stages: string[];
  blast_radius_rating: 'MINIMAL' | 'LOCALIZED' | 'SIGNIFICANT' | 'SYSTEMIC';
}

export interface RecurrencePattern {
  is_recurring: boolean;
  total_occurrences: number;
  reopened: boolean;
  pattern_type: 'SINGLE_INCIDENT' | 'PERSISTENT_OUTAGE' | 'REPEATED_TASK_FAILURE' | 'REOPENED_AFTER_RESOLUTION';
  frequency_descriptor: string;
}

export interface AnomalyEvidenceItem {
  evidence_id: string;
  source_type: 'TELEMETRY' | 'JOB_TRACE' | 'OPERATOR_ACTION' | 'PIPELINE_TASK' | 'CIRCUIT_BREAKER' | 'SYSTEM_SETTINGS';
  reference: string;
  description: string;
  observed_at: string;
  confidence: number; // 1.0 for direct factual observations
}

export interface SuspectedCauseItem {
  cause_id: string;
  hypothesis: string;
  classification: 'FACT' | 'INFERENCE';
  confidence: number; // 1.0 for FACT, 0.70-0.95 for INFERENCE
  reasoning: string;
  supporting_evidence_ids: string[];
}

export interface RecommendedHumanActionItem {
  action_key: string;
  label: string;
  action_type: OperatorActionType | 'INSPECT_JOB_TRACE' | 'CHECK_TELEMETRY' | 'VERIFY_PROVIDER_CREDENTIALS';
  target_type: 'TASK' | 'ANOMALY' | 'STAFF' | 'SYSTEM';
  target_id: string;
  rationale: string;
  safety_class: 'LOW_RISK_INTERNAL' | 'GOVERNANCE_REVIEW' | 'INFORMATIONAL';
  is_operator_executable: boolean;
}

export interface AnomalyIntelligence {
  anomaly_id: string;
  fingerprint: string;
  category: AnomalyTaxonomyCategory;
  severity: IntelligenceSeverity;
  confidence: number;
  status: AnomalyState;
  source_system: string;
  department_id: string;
  department_name: string;
  responsible_agent_id: string | null;
  responsible_agent_name: string | null;
  related_task_id: string | null;
  related_article_id: string | null;
  related_article_title: string | null;
  first_seen_at: string;
  last_seen_at: string;
  occurrence_count: number;
  unresolved_duration_minutes: number;
  affected_scope: AffectedScope;
  recurrence_pattern: RecurrencePattern;
  impact_summary: string;
  evidence: AnomalyEvidenceItem[];
  suspected_causes: SuspectedCauseItem[];
  recommended_human_actions: RecommendedHumanActionItem[];
  anomaly_score: number;
  management_summary: string;
  raw_anomaly_reference: string;
  generated_at: string;
}

// ============================================================================
// Phase 2: Canonical Anomaly Taxonomy
// ============================================================================

export function mapAnomalyToTaxonomyCategory(anomaly: MissionControlAnomaly): AnomalyTaxonomyCategory {
  const type = anomaly.anomaly_type || '';
  const errorClass = anomaly.error_class || '';

  // 1. Data Integrity & System Failures
  if (
    type === 'CIRCUIT_BREAKER_OPEN' ||
    type === 'EMERGENCY_KILL_SWITCH_ACTIVE' ||
    errorClass.includes('INTEGRITY')
  ) {
    return 'DATA_INTEGRITY';
  }

  // 2. Telemetry & Heartbeat Failures
  if (
    type === 'HERMES_HEARTBEAT_STALE' ||
    type === 'HERMES_HEARTBEAT_OFFLINE' ||
    type.includes('HEARTBEAT')
  ) {
    return 'TELEMETRY_STALE';
  }

  // 3. Worker & Media Availability
  if (
    type === 'MEDIA_WORKER_DISABLED' ||
    type === 'MEDIA_STAGE_FAILURE' ||
    type === 'MEDIA_RETRY_EXHAUSTED' ||
    type.includes('WORKER')
  ) {
    return 'WORKER_UNAVAILABLE';
  }

  // 4. Evidence & Research Completeness
  if (
    type === 'RESEARCH_PACK_FAILED' ||
    type.includes('RESEARCH') ||
    type.includes('EVIDENCE')
  ) {
    return 'EVIDENCE_INCOMPLETE';
  }

  // 5. Editorial & Workflow Pipeline Blockers
  if (
    type === 'EDITORIAL_VALIDATION_FAILED' ||
    type === 'EDITORIAL_QA_FAILED' ||
    type === 'SOCIAL_CAMPAIGN_BLOCKED' ||
    type === 'SOCIAL_TASK_FAILED' ||
    type.includes('PIPELINE')
  ) {
    return 'PIPELINE_BLOCKED';
  }

  // 6. Publication Stalled
  if (type === 'CRON_JOB_FAILED' || type.includes('PUBLICATION')) {
    return 'PUBLICATION_STALLED';
  }

  // 7. Handoff & Outbox Failures
  if (type === 'OUTBOX_DEAD_LETTER' || type.includes('HANDOFF') || type.includes('OUTBOX')) {
    return 'HANDOFF_FAILURE';
  }

  // 8. Auth & Credential Failures
  if (
    type === 'SOCIAL_AUTH_REAUTH_REQUIRED' ||
    type === 'SOCIAL_PERMISSION_INCOMPLETE' ||
    type.includes('AUTH')
  ) {
    return 'AUTH_FAILURE';
  }

  // 9. Dependency & External Failures
  if (
    type === 'JEV_PROVIDER_ERROR' ||
    errorClass.includes('PROVIDER_UNREACHABLE')
  ) {
    return 'DEPENDENCY_FAILURE';
  }

  // 10. Health Degraded (Breaker half open, provider fallback, intentional dormancy)
  if (
    type === 'CIRCUIT_BREAKER_HALF_OPEN' ||
    type === 'JEV_PROVIDER_FALLBACK' ||
    type === 'AUTOMATION_MODE_OFF' ||
    type === 'SOCIAL_AUTOMATION_OFF'
  ) {
    return 'HEALTH_DEGRADED';
  }

  return 'HEALTH_DEGRADED';
}

// ============================================================================
// Phase 3: Severity Model (5 Tiers: INFO, LOW, MEDIUM, HIGH, CRITICAL)
// ============================================================================

export function classifyAnomalySeverity(
  anomaly: MissionControlAnomaly,
  context?: { relatedTasksCount?: number; isCriticalPath?: boolean }
): IntelligenceSeverity {
  // 1. INFO: Expected conditions & dormancy by design
  if (
    anomaly.expected_condition ||
    anomaly.state === 'EXPECTED' ||
    anomaly.severity === 'INFO' ||
    anomaly.error_class === 'INTENTIONAL_DORMANCY'
  ) {
    return 'INFO';
  }

  // 2. CRITICAL: Global emergency lock, open publication/media circuit breakers, or critical systemic halt
  if (
    anomaly.anomaly_type === 'EMERGENCY_KILL_SWITCH_ACTIVE' ||
    anomaly.anomaly_type === 'CIRCUIT_BREAKER_OPEN' ||
    anomaly.error_class === 'CIRCUIT_BREAKER_OPEN' ||
    anomaly.severity === 'CRITICAL'
  ) {
    return 'CRITICAL';
  }

  // 3. HIGH: Multi-task impact, dead-letter outbox, daemon offline, retry exhausted, or recurring failures
  const occurrences = anomaly.occurrence_count || 1;
  if (
    anomaly.anomaly_type === 'OUTBOX_DEAD_LETTER' ||
    anomaly.anomaly_type === 'HERMES_HEARTBEAT_OFFLINE' ||
    anomaly.anomaly_type === 'MEDIA_RETRY_EXHAUSTED' ||
    occurrences >= 3 ||
    context?.isCriticalPath ||
    (context?.relatedTasksCount && context.relatedTasksCount > 1)
  ) {
    return 'HIGH';
  }

  // 4. LOW: Minor degradation, half-open breaker probing, minor non-blocking warnings
  if (
    anomaly.anomaly_type === 'CIRCUIT_BREAKER_HALF_OPEN' ||
    anomaly.anomaly_type === 'HERMES_HEARTBEAT_STALE' ||
    (anomaly.severity === 'WARNING' && !anomaly.operator_action_required)
  ) {
    return 'LOW';
  }

  // 5. MEDIUM: Default for single blocked task, provider fallback, standard actionable warning
  return 'MEDIUM';
}

// ============================================================================
// Phase 4: Impact Analysis & Conservative Blast Radius
// ============================================================================

export function calculateAffectedScope(
  anomaly: MissionControlAnomaly,
  snapshot?: MissionControlSnapshot | null
): AffectedScope {
  const allDepts = CANONICAL_DEPARTMENTS.map((d: DepartmentCanonicalConfig) => d.department_id);
  const allStaff = getStaffDefinitions().map((s) => s.agent_id);

  let affectedSubsystems: string[] = [anomaly.source_system];
  let affectedDepts: string[] = [];
  let affectedStaff: string[] = [];
  let blockedStages: string[] = [];
  let rating: AffectedScope['blast_radius_rating'] = 'LOCALIZED';

  // 1. INFO / EXPECTED has zero blast radius on live pipelines
  if (anomaly.expected_condition || anomaly.state === 'EXPECTED' || anomaly.severity === 'INFO') {
    return {
      affected_subsystems: [anomaly.source_system],
      affected_departments: [],
      unaffected_departments: allDepts,
      affected_staff: [],
      unaffected_staff: allStaff,
      blocked_pipeline_stages: [],
      blast_radius_rating: 'MINIMAL'
    };
  }

  // 2. CRITICAL Global Locks (Kill Switch or Global Publisher Breaker)
  if (
    anomaly.anomaly_type === 'EMERGENCY_KILL_SWITCH_ACTIVE' ||
    anomaly.anomaly_type === 'CIRCUIT_BREAKER_OPEN'
  ) {
    affectedSubsystems = ['publication', 'editorial', 'media', 'outbox'];
    affectedDepts = ['publication_operations', 'editorial', 'media'];
    affectedStaff = ['publication_dispatcher_core', 'content_writer_primary'];
    blockedStages = ['publication_dispatch', 'scheduled'];
    rating = 'SYSTEMIC';
  }
  // 3. Media Subsystem
  else if (anomaly.department_id === 'media' || anomaly.source_system === 'media') {
    affectedDepts = ['media'];
    affectedStaff = ['lokamedia_worker_primary'];
    blockedStages = ['media_processing', 'ready_for_ingest'];
    rating = 'LOCALIZED';
  }
  // 4. Research Subsystem
  else if (anomaly.department_id === 'research_evidence' || anomaly.source_system === 'research') {
    affectedDepts = ['research_evidence'];
    affectedStaff = ['evidence_researcher_lead'];
    // In editorial workflow, research failure directly stops writing
    blockedStages = ['researching', 'writing'];
    rating = 'SIGNIFICANT';
    if (anomaly.task_id) {
      affectedStaff.push('content_writer_primary'); // Writer cannot proceed without evidence pack
    }
  }
  // 5. Editorial Subsystem
  else if (anomaly.department_id === 'editorial' || anomaly.source_system === 'editorial') {
    affectedDepts = ['editorial'];
    const isQA = anomaly.anomaly_type === 'EDITORIAL_QA_FAILED';
    affectedStaff = isQA
      ? ['editorial_qa_primary', 'content_writer_primary']
      : ['content_writer_primary'];
    blockedStages = isQA ? ['editorial_qa', 'ready_for_ingest'] : ['writing', 'validating'];
    rating = 'SIGNIFICANT';
  }
  // 6. Engineering & Telemetry
  else if (anomaly.department_id === 'engineering_telemetry') {
    affectedDepts = ['engineering_telemetry'];
    affectedStaff = ['telemetry_observer_jev'];
    if (anomaly.anomaly_type === 'OUTBOX_DEAD_LETTER') {
      blockedStages = ['ready_for_ingest'];
      rating = 'SIGNIFICANT';
    } else {
      blockedStages = [];
      rating = 'LOCALIZED';
    }
  }
  // 7. Social Distribution
  else if (anomaly.department_id === 'social') {
    affectedDepts = ['social'];
    affectedStaff = ['social_distribution_operator'];
    blockedStages = ['variant_curation'];
    rating = 'LOCALIZED';
  }
  // Fallback
  else {
    if (anomaly.department_id) affectedDepts = [anomaly.department_id];
    if (anomaly.responsible_agent_id) affectedStaff = [anomaly.responsible_agent_id];
    rating = 'LOCALIZED';
  }

  // Deduplicate
  affectedDepts = Array.from(new Set(affectedDepts));
  affectedStaff = Array.from(new Set(affectedStaff));

  const unaffectedDepts = allDepts.filter((d) => !affectedDepts.includes(d));
  const unaffectedStaff = allStaff.filter((s) => !affectedStaff.includes(s));

  return {
    affected_subsystems: affectedSubsystems,
    affected_departments: affectedDepts,
    unaffected_departments: unaffectedDepts,
    affected_staff: affectedStaff,
    unaffected_staff: unaffectedStaff,
    blocked_pipeline_stages: blockedStages,
    blast_radius_rating: rating
  };
}

// ============================================================================
// Phase 5: Recurrence & Pattern Detection
// ============================================================================

export function detectRecurrencePattern(
  anomaly: MissionControlAnomaly,
  events: MissionControlAnomalyEvent[] = []
): RecurrencePattern {
  const occurrences = Math.max(1, anomaly.occurrence_count || 1);
  const isRecurring = occurrences > 1;
  const reopened = Boolean(anomaly.resolved_at && anomaly.state === 'OPEN');

  const nowMs = Date.now();
  const firstSeenMs = new Date(anomaly.first_seen_at || anomaly.detected_at).getTime();
  const durationMinutes = Math.max(0, Math.floor((nowMs - firstSeenMs) / 60000));

  let patternType: RecurrencePattern['pattern_type'] = 'SINGLE_INCIDENT';
  let descriptor = 'Insiden tunggal terdeteksi.';

  if (reopened) {
    patternType = 'REOPENED_AFTER_RESOLUTION';
    descriptor = `Terbuka kembali setelah sebelumnya selesai (${occurrences} kali deteksi total).`;
  } else if (occurrences >= 3 && anomaly.task_id) {
    patternType = 'REPEATED_TASK_FAILURE';
    descriptor = `Kegagalan berulang pada tugas yang sama (${occurrences} kali percobaan).`;
  } else if (durationMinutes >= 30 && anomaly.state === 'OPEN') {
    patternType = 'PERSISTENT_OUTAGE';
    descriptor = `Kondisi persisten berlangsung selama ${durationMinutes} menit (${occurrences} siklus deteksi).`;
  } else if (isRecurring) {
    patternType = 'SINGLE_INCIDENT';
    descriptor = `Berulang ${occurrences} kali sejak pertama terlihat.`;
  }

  return {
    is_recurring: isRecurring,
    total_occurrences: occurrences,
    reopened,
    pattern_type: patternType,
    frequency_descriptor: descriptor
  };
}

// ============================================================================
// Phase 6 & 7: Correlation Engine & Canonical Evidence Compilation
// ============================================================================

export function compileAnomalyEvidence(
  anomaly: MissionControlAnomaly,
  snapshot?: MissionControlSnapshot | null
): {
  evidence: AnomalyEvidenceItem[];
  relatedTask: TaskCard | null;
  relatedArticleTitle: string | null;
} {
  const evidence: AnomalyEvidenceItem[] = [];
  const now = new Date().toISOString();

  // 1. Evidence Reference from Anomaly Record
  if (anomaly.evidence_reference) {
    evidence.push({
      evidence_id: `ev_anom_ref_${anomaly.anomaly_id.substring(0, 10)}`,
      source_type: 'TELEMETRY',
      reference: anomaly.evidence_reference,
      description: `Sinyal telemetri dasar: ${anomaly.technical_detail || anomaly.summary}`,
      observed_at: anomaly.last_seen_at || anomaly.detected_at || now,
      confidence: 1.0
    });
  }

  // 2. Correlation with Pipeline Task
  let relatedTask: TaskCard | null = null;
  let relatedArticleTitle: string | null = null;

  if (snapshot?.pipeline?.tasks) {
    relatedTask = snapshot.pipeline.tasks.find(
      (t) => t.taskId === anomaly.task_id || t.taskId === anomaly.entity_id
    ) || null;

    if (relatedTask) {
      relatedArticleTitle = relatedTask.title;
      evidence.push({
        evidence_id: `ev_task_${relatedTask.taskId}`,
        source_type: 'PIPELINE_TASK',
        reference: `tasks:${relatedTask.taskId}`,
        description: `Tugas '${relatedTask.title}' berstatus ${relatedTask.status} pada tahap ${relatedTask.stage} (Percobaan ke-${relatedTask.retryCount}). Penghambat: ${relatedTask.blockerOrError || 'Tidak ada'}`,
        observed_at: relatedTask.lastUpdate || now,
        confidence: 1.0
      });
    }
  }

  // 3. Correlation with Circuit Breakers
  if (snapshot?.health?.circuitBreakers) {
    const breaker = snapshot.health.circuitBreakers.find(
      (cb) => anomaly.title.includes(cb.id) || (anomaly.evidence_reference && anomaly.evidence_reference.includes(cb.id))
    );
    if (breaker) {
      evidence.push({
        evidence_id: `ev_breaker_${breaker.id}`,
        source_type: 'CIRCUIT_BREAKER',
        reference: `circuit_breakers:${breaker.id}`,
        description: `Circuit breaker '${breaker.id}' berstatus ${breaker.state} (${breaker.failureCount}/${breaker.failureThreshold} kegagalan). Alasan: ${breaker.tripReason || 'Batas kegagalan terlampaui.'}`,
        observed_at: breaker.lastStateChangeAt || now,
        confidence: 1.0
      });
    }
  }

  // 4. Correlation with System Health & Automation Gates
  if (snapshot?.health?.automation) {
    if (anomaly.anomaly_type === 'EMERGENCY_KILL_SWITCH_ACTIVE' && snapshot.health.automation.killSwitchEngaged) {
      evidence.push({
        evidence_id: 'ev_kill_switch_active',
        source_type: 'SYSTEM_SETTINGS',
        reference: 'automation_control:kill_switch',
        description: `Saklar darurat global terkunci: ${snapshot.health.automation.killReason || 'Global lock aktif'}`,
        observed_at: snapshot.health.automation.updatedAt || now,
        confidence: 1.0
      });
    }
  }

  return { evidence, relatedTask, relatedArticleTitle };
}

// ============================================================================
// Phase 8: Suspected Cause Model (Strict FACT vs INFERENCE)
// ============================================================================

export function deriveSuspectedCauses(
  anomaly: MissionControlAnomaly,
  evidence: AnomalyEvidenceItem[],
  relatedTask: TaskCard | null
): SuspectedCauseItem[] {
  const causes: SuspectedCauseItem[] = [];
  const type = anomaly.anomaly_type;

  // 1. Direct Factual Observations (Confidence = 1.0, FACT)
  if (type === 'EMERGENCY_KILL_SWITCH_ACTIVE') {
    causes.push({
      cause_id: 'cause_kill_switch_engaged',
      hypothesis: 'Saklar darurat global (Emergency Kill Switch) diaktifkan secara eksplisit.',
      classification: 'FACT',
      confidence: 1.0,
      reasoning: 'State automation_control.killSwitchEngaged terverifikasi bernilai true pada database keselamatan.',
      supporting_evidence_ids: evidence.map((e) => e.evidence_id)
    });
  } else if (type === 'CIRCUIT_BREAKER_OPEN') {
    causes.push({
      cause_id: 'cause_breaker_tripped',
      hypothesis: 'Ambang batas kegagalan beruntun pemutus sirkuit (circuit breaker) terlampaui.',
      classification: 'FACT',
      confidence: 1.0,
      reasoning: 'Failure count mencapai atau melampaui failure threshold yang ditentukan oleh safety envelope.',
      supporting_evidence_ids: evidence.map((e) => e.evidence_id)
    });
  } else if (type === 'MEDIA_WORKER_DISABLED' || type === 'AUTOMATION_MODE_OFF' || type === 'SOCIAL_AUTOMATION_OFF') {
    causes.push({
      cause_id: 'cause_intentional_dormancy',
      hypothesis: 'Subsistem dinonaktifkan secara sengaja sesuai konfigurasi keselamatan (By Design).',
      classification: 'FACT',
      confidence: 1.0,
      reasoning: 'Nilai konfigurasi produksi berstatus disabled/OFF untuk mematuhi invarian Human Approval.',
      supporting_evidence_ids: evidence.map((e) => e.evidence_id)
    });
  }

  // 2. Inferred Observations (Confidence = 0.70 - 0.95, INFERENCE)
  if (type === 'RESEARCH_PACK_FAILED') {
    const detail = (anomaly.technical_detail || anomaly.summary || '').toLowerCase();
    const isCitation = detail.includes('sitasi') || detail.includes('referensi') || detail.includes('evidence');

    causes.push({
      cause_id: 'cause_missing_citations',
      hypothesis: isCitation
        ? 'Draf riset kekurangan sitasi empiris / rujukan SNI yang dapat diverifikasi.'
        : 'Ekstraksi bukti teknis mengalami kegagalan parsing atau dependensi sumber data.',
      classification: 'INFERENCE',
      confidence: isCitation ? 0.90 : 0.75,
      reasoning: `Berdasarkan pesan kesalahan penugasan '${anomaly.summary}', subsistem riset tidak dapat melengkapi evidence pack yang dipersyaratkan.`,
      supporting_evidence_ids: evidence.map((e) => e.evidence_id)
    });
  } else if (type === 'EDITORIAL_VALIDATION_FAILED' || type === 'EDITORIAL_QA_FAILED') {
    causes.push({
      cause_id: 'cause_editorial_rule_breach',
      hypothesis: 'Naskah melanggar aturan editorial RancangLoka (tone of voice, anti-slop, atau Monetary Silence).',
      classification: 'INFERENCE',
      confidence: 0.88,
      reasoning: 'Pemeriksaan QA deterministik menemukan ketidaksesuaian pedoman editorial sebelum naskah dapat disetujui.',
      supporting_evidence_ids: evidence.map((e) => e.evidence_id)
    });
  } else if (type === 'OUTBOX_DEAD_LETTER') {
    causes.push({
      cause_id: 'cause_bridge_delivery_exhausted',
      hypothesis: 'Paket draf Hermes Outbox gagal dikirim ke endpoint Astro setelah retry maksimal.',
      classification: 'INFERENCE',
      confidence: 0.85,
      reasoning: 'Antrean dead-letter terisi paket yang gagal melewati verifikasi HMAC atau batas waktu timeout jaringan.',
      supporting_evidence_ids: evidence.map((e) => e.evidence_id)
    });
  } else if (type === 'HERMES_HEARTBEAT_OFFLINE' || type === 'HERMES_HEARTBEAT_STALE') {
    causes.push({
      cause_id: 'cause_scheduler_daemon_stall',
      hypothesis: 'Daemon scheduler container Hermes terhenti atau proses init mengalami crash.',
      classification: 'INFERENCE',
      confidence: 0.80,
      reasoning: 'Heartbeat scheduler tidak diperbarui melampaui batas toleransi kesegaran (freshness threshold).',
      supporting_evidence_ids: evidence.map((e) => e.evidence_id)
    });
  } else if (type === 'JEV_PROVIDER_FALLBACK' || type === 'JEV_PROVIDER_ERROR') {
    causes.push({
      cause_id: 'cause_openrouter_api_degraded',
      hypothesis: 'API OpenRouter mengalami peningkatan latensi, rate limit, atau kegagalan upstream.',
      classification: 'INFERENCE',
      confidence: 0.82,
      reasoning: 'Koneksi keputusan bayangan Jev beralih ke cadangan lokal tanpa mengorbankan integritas publikasi.',
      supporting_evidence_ids: evidence.map((e) => e.evidence_id)
    });
  } else if (type === 'SOCIAL_AUTH_REAUTH_REQUIRED' || type === 'SOCIAL_PERMISSION_INCOMPLETE') {
    causes.push({
      cause_id: 'cause_oauth_token_revoked',
      hypothesis: 'Token akses Meta OAuth telah dicabut, kedaluwarsa, atau cakupan izin tidak memadai.',
      classification: 'INFERENCE',
      confidence: 0.95,
      reasoning: 'Penyedia Meta Graph API mengembalikan kode kesalahan otentikasi sesi OAuth.',
      supporting_evidence_ids: evidence.map((e) => e.evidence_id)
    });
  }

  return causes;
}

// ============================================================================
// Phase 9: Safe Human Action Recommendations
// ============================================================================

export function generateSafeHumanRecommendations(
  anomaly: MissionControlAnomaly,
  relatedTask: TaskCard | null
): RecommendedHumanActionItem[] {
  const recommendations: RecommendedHumanActionItem[] = [];

  // 1. If Anomaly is OPEN and actionable -> Recommend Acknowledge
  if (anomaly.state === 'OPEN' && !anomaly.expected_condition) {
    recommendations.push({
      action_key: `rec_ack_${anomaly.anomaly_id}`,
      label: 'Akui Anomali (Acknowledge)',
      action_type: 'ACKNOWLEDGE_ANOMALY',
      target_type: 'ANOMALY',
      target_id: anomaly.anomaly_id,
      rationale: 'Menandai anomali sebagai diketahui operator untuk meredam alarm dan mencatat audit formal.',
      safety_class: 'LOW_RISK_INTERNAL',
      is_operator_executable: true
    });
  }

  // 2. Task-specific Recommendations (Mapping strictly to MC-LIVEOPS-3 allowlist)
  if (relatedTask) {
    if (anomaly.department_id === 'research_evidence' || anomaly.anomaly_type === 'RESEARCH_PACK_FAILED') {
      recommendations.push({
        action_key: `rec_ev_${relatedTask.taskId}`,
        label: 'Minta Tindak Lanjut Bukti',
        action_type: 'REQUEST_EVIDENCE_FOLLOWUP',
        target_type: 'TASK',
        target_id: relatedTask.taskId,
        rationale: 'Menginstruksikan Irwan untuk melengkapi sitasi atau data empiris yang belum memadai.',
        safety_class: 'LOW_RISK_INTERNAL',
        is_operator_executable: true
      });
    }

    if (anomaly.department_id === 'editorial' || anomaly.anomaly_type === 'EDITORIAL_VALIDATION_FAILED') {
      recommendations.push({
        action_key: `rec_esc_${relatedTask.taskId}`,
        label: 'Eskalasi Tugas Terhambat',
        action_type: 'ESCALATE_BLOCKED_TASK',
        target_type: 'TASK',
        target_id: relatedTask.taskId,
        rationale: 'Mencatat eskalasi formal naskah ke antrean prioritas perhatian Chief Editor.',
        safety_class: 'LOW_RISK_INTERNAL',
        is_operator_executable: true
      });

      recommendations.push({
        action_key: `rec_rev_${relatedTask.taskId}`,
        label: 'Minta Peninjauan Manusia (Human Review)',
        action_type: 'REQUEST_HUMAN_REVIEW',
        target_type: 'TASK',
        target_id: relatedTask.taskId,
        rationale: 'Menandai draf naskah untuk tinjauan manual langsung sebelum tahap berikutnya dibuka.',
        safety_class: 'GOVERNANCE_REVIEW',
        is_operator_executable: true
      });
    }

    // Inspect Job Trace
    recommendations.push({
      action_key: `rec_trace_${relatedTask.taskId}`,
      label: 'Buka Canonical Job Trace',
      action_type: 'INSPECT_JOB_TRACE',
      target_type: 'TASK',
      target_id: relatedTask.taskId,
      rationale: 'Memeriksa linimasa audit kanonikal tugas untuk melacak transisi tahap sebelumnya.',
      safety_class: 'INFORMATIONAL',
      is_operator_executable: false
    });
  }

  // 3. Infrastructure & Telemetry Recommendations
  if (anomaly.department_id === 'engineering_telemetry') {
    recommendations.push({
      action_key: `rec_chk_telemetry_${anomaly.anomaly_id}`,
      label: 'Periksa Status Kontainer & Telemetri',
      action_type: 'CHECK_TELEMETRY',
      target_type: 'SYSTEM',
      target_id: 'engineering_telemetry',
      rationale: 'Periksa status proses daemon Hermes dan koneksi database edge pada konsol server.',
      safety_class: 'INFORMATIONAL',
      is_operator_executable: false
    });
  }

  // 4. Social Auth Recommendations
  if (anomaly.anomaly_type === 'SOCIAL_AUTH_REAUTH_REQUIRED' || anomaly.anomaly_type === 'SOCIAL_PERMISSION_INCOMPLETE') {
    recommendations.push({
      action_key: `rec_meta_auth_${anomaly.anomaly_id}`,
      label: 'Perbarui Kredensial Meta OAuth',
      action_type: 'VERIFY_PROVIDER_CREDENTIALS',
      target_type: 'SYSTEM',
      target_id: 'meta_oauth',
      rationale: 'Buka pengaturan integrasi Meta dan lakukan proses autentikasi ulang secara aman.',
      safety_class: 'INFORMATIONAL',
      is_operator_executable: false
    });
  }

  return recommendations;
}

// ============================================================================
// Phase 10: Operational Anomaly Score (Deterministic 0 - 100)
// ============================================================================

export function calculateAnomalyScore(
  severity: IntelligenceSeverity,
  occurrenceCount: number,
  unresolvedMinutes: number,
  affectedDeptsCount: number
): number {
  if (severity === 'INFO') return 0;

  const basePoints = {
    CRITICAL: 50,
    HIGH: 35,
    MEDIUM: 20,
    LOW: 10,
    INFO: 0
  }[severity];

  const recurrencePenalty = Math.min(20, Math.max(0, occurrenceCount - 1) * 5);
  const blastRadiusPenalty = Math.min(15, affectedDeptsCount * 5);

  let durationPenalty = 0;
  if (unresolvedMinutes >= 60) durationPenalty = 15;
  else if (unresolvedMinutes >= 30) durationPenalty = 10;
  else if (unresolvedMinutes >= 15) durationPenalty = 5;

  return Math.min(100, basePoints + recurrencePenalty + blastRadiusPenalty + durationPenalty);
}

// ============================================================================
// Phase 11: Management Summary Generator
// ============================================================================

export function generateManagementSummary(intel: {
  category: AnomalyTaxonomyCategory;
  severity: IntelligenceSeverity;
  impact_summary: string;
  responsible_agent_name: string | null;
  department_name: string;
  anomaly_score: number;
  first_seen_at: string;
  unresolved_duration_minutes: number;
  recurrence_pattern: RecurrencePattern;
  affected_scope: AffectedScope;
  suspected_causes: SuspectedCauseItem[];
  recommended_human_actions: RecommendedHumanActionItem[];
  evidence: AnomalyEvidenceItem[];
}): string {
  const causesLines = intel.suspected_causes.length > 0
    ? intel.suspected_causes
        .map((c) => `• [${c.classification}] ${c.hypothesis} (Keyakinan: ${Math.round(c.confidence * 100)}%): ${c.reasoning}`)
        .join('\n')
    : '• Tidak ada anomali atau kegagalan yang memerlukan perbaikan.';

  const actionLines = intel.recommended_human_actions.length > 0
    ? intel.recommended_human_actions
        .map((a) => `• ${a.label}: ${a.rationale}`)
        .join('\n')
    : '• Tidak ada tindakan diperlukan (Sistem berjalan dalam batas normal).';

  return `[${intel.severity}] — ${intel.category}
Judul: ${intel.impact_summary}
Pemilik: ${intel.responsible_agent_name || 'Tidak Ditugaskan'} (${intel.department_name})
Skor Operasional: ${intel.anomaly_score}/100 | Terdeteksi: ${intel.first_seen_at} (${intel.unresolved_duration_minutes}m lalu)
Pola: ${intel.recurrence_pattern.frequency_descriptor}
Dampak: ${intel.affected_scope.blast_radius_rating} (Departemen terdampak: ${intel.affected_scope.affected_departments.join(', ') || 'tidak ada'})

Dugaan Penyebab:
${causesLines}

Rekomendasi Tindakan Manusia:
${actionLines}

Bukti Kanonikal (${intel.evidence.length} item):
${intel.evidence.map((e) => `• [${e.source_type}] ${e.reference}: ${e.description}`).join('\n')}`;
}

// ============================================================================
// Master Derivation: deriveAnomalyIntelligence
// ============================================================================

export function deriveAnomalyIntelligence(
  anomaly: MissionControlAnomaly,
  snapshot?: MissionControlSnapshot | null
): AnomalyIntelligence {
  const category = mapAnomalyToTaxonomyCategory(anomaly);
  const severity = classifyAnomalySeverity(anomaly);
  const affectedScope = calculateAffectedScope(anomaly, snapshot);
  const recurrencePattern = detectRecurrencePattern(anomaly);
  const { evidence, relatedTask, relatedArticleTitle } = compileAnomalyEvidence(anomaly, snapshot);
  const suspectedCauses = deriveSuspectedCauses(anomaly, evidence, relatedTask);
  const recommendedActions = generateSafeHumanRecommendations(anomaly, relatedTask);

  const nowMs = Date.now();
  const firstSeenMs = new Date(anomaly.first_seen_at || anomaly.detected_at).getTime();
  const durationMinutes = Math.max(0, Math.floor((nowMs - firstSeenMs) / 60000));

  const dept = CANONICAL_DEPARTMENTS.find((d: DepartmentCanonicalConfig) => d.department_id === anomaly.department_id);
  const deptName = dept?.display_name || anomaly.department_id;

  const staff = anomaly.responsible_agent_id
    ? getStaffDefinitionByAgentId(anomaly.responsible_agent_id)
    : null;
  const staffName = staff?.display_name || anomaly.responsible_agent_id || null;

  const anomalyScore = calculateAnomalyScore(
    severity,
    anomaly.occurrence_count || 1,
    durationMinutes,
    affectedScope.affected_departments.length
  );

  const impactSummary = anomaly.title || 'Anomali Operasional Terdeteksi';

  const managementSummary = generateManagementSummary({
    category,
    severity,
    impact_summary: impactSummary,
    responsible_agent_name: staffName,
    department_name: deptName,
    anomaly_score: anomalyScore,
    first_seen_at: anomaly.first_seen_at || anomaly.detected_at,
    unresolved_duration_minutes: durationMinutes,
    recurrence_pattern: recurrencePattern,
    affected_scope: affectedScope,
    suspected_causes: suspectedCauses,
    recommended_human_actions: recommendedActions,
    evidence
  });

  return {
    anomaly_id: anomaly.anomaly_id,
    fingerprint: anomaly.fingerprint,
    category,
    severity,
    confidence: severity === 'INFO' ? 1.0 : suspectedCauses.length > 0 ? suspectedCauses[0].confidence : 0.85,
    status: anomaly.state,
    source_system: anomaly.source_system,
    department_id: anomaly.department_id,
    department_name: deptName,
    responsible_agent_id: anomaly.responsible_agent_id || null,
    responsible_agent_name: staffName,
    related_task_id: anomaly.task_id || (relatedTask ? relatedTask.taskId : null),
    related_article_id: anomaly.entity_id || (relatedTask?.relatedArticleId ? String(relatedTask.relatedArticleId) : null),
    related_article_title: relatedArticleTitle,
    first_seen_at: anomaly.first_seen_at || anomaly.detected_at,
    last_seen_at: anomaly.last_seen_at || anomaly.updated_at,
    occurrence_count: anomaly.occurrence_count || 1,
    unresolved_duration_minutes: durationMinutes,
    affected_scope: affectedScope,
    recurrence_pattern: recurrencePattern,
    impact_summary: impactSummary,
    evidence,
    suspected_causes: suspectedCauses,
    recommended_human_actions: recommendedActions,
    anomaly_score: anomalyScore,
    management_summary: managementSummary,
    raw_anomaly_reference: `anomalies:${anomaly.anomaly_id}`,
    generated_at: new Date().toISOString()
  };
}

/**
 * Compiles intelligence for an array of anomalies against a MissionControlSnapshot.
 * Returns a map of anomaly_id -> AnomalyIntelligence.
 */
export function getAnomaliesIntelligenceSnapshot(
  anomalies: MissionControlAnomaly[],
  snapshot?: MissionControlSnapshot | null
): Record<string, AnomalyIntelligence> {
  const result: Record<string, AnomalyIntelligence> = {};
  for (const anom of anomalies) {
    result[anom.anomaly_id] = deriveAnomalyIntelligence(anom, snapshot);
  }
  return result;
}
