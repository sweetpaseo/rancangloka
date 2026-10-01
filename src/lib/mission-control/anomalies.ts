/**
 * RancangLoka Hermes Mission Control — Anomaly Detection & Staff Escalation Engine
 * Milestone: HERMES-MC-6
 * 
 * Strict Invariants:
 * 1. Zero Hallucination: Anomaly normalization occurs strictly on real telemetry signals.
 * 2. Expected Dormancy Isolation: Expected conditions (e.g. Media worker disabled, Automation OFF)
 *    are classified as INFO/EXPECTED and NEVER trigger alarms or escalate.
 * 3. Deterministic Staff Assignment: Blame/assignment to named staff requires deterministic evidence;
 *    infrastructure issues remain unassigned (responsible_agent_id = null).
 * 4. Safe Staff Escalation: Escalation messages generated in staff chat are strictly informational
 *    and NEVER execute commands or grant automated remediation authority.
 * 5. Deterministic Resolution & Audit History: Anomalies resolve when underlying conditions clear,
 *    and resolved anomalies are retained for full auditability.
 */

import type { MissionControlSnapshot, TaskCard } from './types.ts';
import { getStaffDefinitionByAgentId } from './staff-registry.ts';
import {
  getCapabilityDefinition,
  resolveCapabilityOwnership,
  getRegisteredCapabilities
} from './capability-registry.ts';
import { redactSensitiveString } from './redact.ts';
import { getOrCreateConversation, appendMessage } from './chat.ts';

// ============================================================================
// Types & Data Contracts
// ============================================================================

export type AnomalySeverity = 'INFO' | 'WARNING' | 'ERROR' | 'CRITICAL';
export type AnomalyState = 'OPEN' | 'ACKNOWLEDGED' | 'RESOLVED' | 'SUPPRESSED' | 'EXPECTED';

export interface MissionControlAnomaly {
  anomaly_id: string;
  detected_at: string;
  updated_at: string;
  source_system: string;
  source_event_id?: string | null;
  department_id: string;
  responsible_agent_id?: string | null;
  task_id?: string | null;
  entity_type?: string | null;
  entity_id?: string | null;
  severity: AnomalySeverity;
  anomaly_type: string;
  error_class?: string | null;
  title: string;
  summary: string;
  technical_detail?: string | null;
  state: AnomalyState;
  retryable: boolean;
  operator_action_required: boolean;
  expected_condition: boolean;
  evidence_reference?: string | null;
  fingerprint: string;
  occurrence_count: number;
  first_seen_at: string;
  last_seen_at: string;
  resolved_at?: string | null;
  metadata?: Record<string, any>;
}

export interface MissionControlAnomalyEvent {
  event_id: string;
  anomaly_id: string;
  event_type: 'DETECTED' | 'UPDATED' | 'ESCALATED' | 'ACKNOWLEDGED' | 'RESOLVED' | 'SUPPRESSED';
  previous_state?: string | null;
  new_state: string;
  message: string;
  created_at: string;
  metadata?: Record<string, any>;
}

export interface AnomaliesSummary {
  active_anomalies: MissionControlAnomaly[];
  expected_conditions: MissionControlAnomaly[];
  resolved_anomalies: MissionControlAnomaly[];
  counts: {
    total_active: number;
    critical: number;
    error: number;
    warning: number;
    expected: number;
    resolved: number;
  };
}

// ============================================================================
// Dual-Store Fallback (In-Memory + D1 Support)
// ============================================================================

const memoryAnomalies: Map<string, MissionControlAnomaly> = new Map();
const memoryAnomalyEvents: MissionControlAnomalyEvent[] = [];
const escalatedFingerprints: Set<string> = new Set();

/**
 * Reset utility for unit tests and local isolation.
 */
export function resetAnomalyMemoryStore(): void {
  memoryAnomalies.clear();
  memoryAnomalyEvents.length = 0;
  escalatedFingerprints.clear();
}

// ============================================================================
// Fingerprint Generation (Deterministic & Stable)
// ============================================================================

export function createAnomalyFingerprint(
  sourceSystem: string,
  departmentId: string,
  anomalyType: string,
  targetEntityOrTask = 'none',
  errorClass = 'none'
): string {
  const norm = (s: string) => s.trim().toLowerCase().replace(/[^a-z0-9_]/g, '_');
  return `fp_${norm(sourceSystem)}_${norm(departmentId)}_${norm(anomalyType)}_${norm(targetEntityOrTask)}_${norm(errorClass)}`;
}

// ============================================================================
// Raw Telemetry Scanner (Pure Function)
// ============================================================================

/**
 * Normalizes raw signals from a MissionControlSnapshot into candidate anomalies.
 * Strict Invariant: Does not invent non-existent faults.
 */
export function scanRawAnomaliesFromSnapshot(
  snapshot: MissionControlSnapshot | null
): MissionControlAnomaly[] {
  if (!snapshot) return [];

  const candidates: MissionControlAnomaly[] = [];
  const now = new Date().toISOString();

  // --------------------------------------------------------------------------
  // 1. MEDIA SUBSYSTEM
  // --------------------------------------------------------------------------
  const mediaWorkerState = snapshot.health?.mediaWorker?.effectiveState || 'DISABLED';
  
  // A. Intentional Worker Disabled (EXPECTED CONDITION - NOT AN ALERT)
  if (mediaWorkerState === 'DISABLED') {
    const fp = createAnomalyFingerprint('media', 'media', 'MEDIA_WORKER_DISABLED', 'worker_gate');
    candidates.push({
      anomaly_id: `anom_${fp}`,
      detected_at: now,
      updated_at: now,
      source_system: 'media',
      department_id: 'media',
      responsible_agent_id: 'lokamedia_worker_primary',
      severity: 'INFO',
      anomaly_type: 'MEDIA_WORKER_DISABLED',
      error_class: 'INTENTIONAL_DORMANCY',
      title: 'Pekerja Media Dinonaktifkan Secara Sengaja',
      summary: 'Media worker dalam kondisi nonaktif (DISABLED) sesuai konfigurasi sistem yang aman.',
      technical_detail: snapshot.health?.mediaWorker?.reason || 'Pengaturan settings.media_worker_enabled bernilai false.',
      state: 'EXPECTED',
      retryable: false,
      operator_action_required: false,
      expected_condition: true,
      evidence_reference: 'settings:media_worker_enabled',
      fingerprint: fp,
      occurrence_count: 1,
      first_seen_at: now,
      last_seen_at: now
    });
  }

  // B. Media Circuit Breaker Open (CRITICAL)
  const mediaBreaker = snapshot.health?.circuitBreakers?.find((cb) => cb.id.includes('media'));
  if (mediaBreaker && mediaBreaker.state === 'OPEN') {
    const fp = createAnomalyFingerprint('media', 'media', 'CIRCUIT_BREAKER_OPEN', mediaBreaker.id, 'BREAKER_TRIPPED');
    candidates.push({
      anomaly_id: `anom_${fp}`,
      detected_at: mediaBreaker.lastStateChangeAt || now,
      updated_at: now,
      source_system: 'media',
      department_id: 'media',
      responsible_agent_id: 'lokamedia_worker_primary',
      severity: 'CRITICAL',
      anomaly_type: 'CIRCUIT_BREAKER_OPEN',
      error_class: 'CIRCUIT_BREAKER_OPEN',
      title: `Circuit Breaker Media [${mediaBreaker.id}] Terbuka`,
      summary: `Pemutus sirkuit media terbuka setelah ${mediaBreaker.failureCount} kegagalan berturut-turut.`,
      technical_detail: mediaBreaker.tripReason || 'Ambang batas kegagalan terlampaui.',
      state: 'OPEN',
      retryable: true,
      operator_action_required: true,
      expected_condition: false,
      evidence_reference: `circuit_breakers:${mediaBreaker.id}`,
      fingerprint: fp,
      occurrence_count: 1,
      first_seen_at: mediaBreaker.lastStateChangeAt || now,
      last_seen_at: now
    });
  }

  // C. Failed Media Tasks (Retry Exhausted vs Stage Failure)
  const mediaTasks = snapshot.pipeline?.tasks?.filter((t) => t.subsystem === 'media' && t.stage === 'failed') || [];
  for (const t of mediaTasks) {
    const isExhausted = Boolean(t.retryCount >= 3 || (t.blockerOrError && t.blockerOrError.toLowerCase().includes('habis')));
    const severity: AnomalySeverity = isExhausted ? 'ERROR' : 'WARNING';
    const anomType = isExhausted ? 'MEDIA_RETRY_EXHAUSTED' : 'MEDIA_STAGE_FAILURE';
    const fp = createAnomalyFingerprint('media', 'media', anomType, t.taskId, isExhausted ? 'RETRY_EXHAUSTED' : 'RETRY_IN_PROGRESS');

    candidates.push({
      anomaly_id: `anom_${fp}`,
      detected_at: t.lastUpdate || now,
      updated_at: now,
      source_system: 'media',
      department_id: 'media',
      responsible_agent_id: 'lokamedia_worker_primary',
      task_id: t.taskId,
      entity_type: 'media_job',
      entity_id: t.relatedMediaJobId || t.taskId,
      severity,
      anomaly_type: anomType,
      error_class: isExhausted ? 'MEDIA_RETRY_EXHAUSTED' : 'MEDIA_STAGE_FAILURE',
      title: isExhausted ? `Percobaan Ulang Media Habis (${t.title})` : `Kendala Tahap Media (${t.title})`,
      summary: `Tugas media [${t.title}] gagal pada percobaan ke-${t.retryCount}. ${t.blockerOrError || ''}`,
      technical_detail: `Task ID: ${t.taskId}, Retry Count: ${t.retryCount}, Blocker: ${t.blockerOrError || 'Unknown'}`,
      state: 'OPEN',
      retryable: !isExhausted,
      operator_action_required: isExhausted,
      expected_condition: false,
      evidence_reference: `media_jobs:${t.relatedMediaJobId || t.taskId}`,
      fingerprint: fp,
      occurrence_count: 1,
      first_seen_at: t.lastUpdate || now,
      last_seen_at: now
    });
  }

  // --------------------------------------------------------------------------
  // 2. PUBLICATION SUBSYSTEM
  // --------------------------------------------------------------------------
  const autoMode = snapshot.health?.automation?.mode || 'OFF';

  // A. Automation Mode OFF by Design (EXPECTED CONDITION - NOT AN ALERT)
  if (autoMode === 'OFF') {
    const fp = createAnomalyFingerprint('publication', 'publication_operations', 'AUTOMATION_MODE_OFF', 'automation_gate');
    candidates.push({
      anomaly_id: `anom_${fp}`,
      detected_at: now,
      updated_at: now,
      source_system: 'publication',
      department_id: 'publication_operations',
      responsible_agent_id: 'publication_dispatcher_core',
      severity: 'INFO',
      anomaly_type: 'AUTOMATION_MODE_OFF',
      error_class: 'INTENTIONAL_DORMANCY',
      title: 'Otomasi Publikasi Nonaktif Sesuai Desain',
      summary: 'Mode otomatisasi publikasi berstatus OFF (Draft-only) sesuai invarian keselamatan produksi.',
      technical_detail: 'Invarian produksi mewajibkan persetujuan manusia sebelum naskah dipublikasikan ke publik.',
      state: 'EXPECTED',
      retryable: false,
      operator_action_required: false,
      expected_condition: true,
      evidence_reference: 'automation_control:mode',
      fingerprint: fp,
      occurrence_count: 1,
      first_seen_at: now,
      last_seen_at: now
    });
  }

  // B. Emergency Kill Switch Active (CRITICAL)
  if (snapshot.health?.automation?.killSwitchEngaged) {
    const fp = createAnomalyFingerprint('publication', 'publication_operations', 'EMERGENCY_KILL_SWITCH_ACTIVE', 'global_kill_switch');
    candidates.push({
      anomaly_id: `anom_${fp}`,
      detected_at: snapshot.health.automation.updatedAt || now,
      updated_at: now,
      source_system: 'publication',
      department_id: 'publication_operations',
      responsible_agent_id: 'publication_dispatcher_core',
      severity: 'CRITICAL',
      anomaly_type: 'EMERGENCY_KILL_SWITCH_ACTIVE',
      error_class: 'EMERGENCY_KILL_SWITCH_ACTIVE',
      title: 'Saklar Darurat Publikasi (Kill Switch) Aktif',
      summary: `Seluruh jalur mutasi publikasi terkunci darurat: ${snapshot.health.automation.killReason || 'Global lock aktif'}`,
      technical_detail: 'Mutasi artikel diblokir sepenuhnya sampai operator melepaskan saklar darurat.',
      state: 'OPEN',
      retryable: false,
      operator_action_required: true,
      expected_condition: false,
      evidence_reference: 'automation_control:kill_switch',
      fingerprint: fp,
      occurrence_count: 1,
      first_seen_at: snapshot.health.automation.updatedAt || now,
      last_seen_at: now
    });
  }

  // C. Global Publisher Circuit Breaker Open (CRITICAL)
  const pubBreaker = snapshot.health?.circuitBreakers?.find((cb) => cb.id === 'global_publisher');
  if (pubBreaker) {
    if (pubBreaker.state === 'OPEN') {
      const fp = createAnomalyFingerprint('publication', 'publication_operations', 'CIRCUIT_BREAKER_OPEN', pubBreaker.id, 'BREAKER_TRIPPED');
      candidates.push({
        anomaly_id: `anom_${fp}`,
        detected_at: pubBreaker.lastStateChangeAt || now,
        updated_at: now,
        source_system: 'publication',
        department_id: 'publication_operations',
        responsible_agent_id: 'publication_dispatcher_core',
        severity: 'CRITICAL',
        anomaly_type: 'CIRCUIT_BREAKER_OPEN',
        error_class: 'CIRCUIT_BREAKER_OPEN',
        title: 'Circuit Breaker Publikasi Terbuka (OPEN)',
        summary: `Pemutus sirkuit publikasi terbuka: ${pubBreaker.tripReason || 'Kegagalan batas penerbitan'}`,
        technical_detail: `Breaker ID: ${pubBreaker.id}, Failure Count: ${pubBreaker.failureCount}/${pubBreaker.failureThreshold}`,
        state: 'OPEN',
        retryable: true,
        operator_action_required: true,
        expected_condition: false,
        evidence_reference: `circuit_breakers:${pubBreaker.id}`,
        fingerprint: fp,
        occurrence_count: 1,
        first_seen_at: pubBreaker.lastStateChangeAt || now,
        last_seen_at: now
      });
    } else if (pubBreaker.state === 'HALF_OPEN') {
      const fp = createAnomalyFingerprint('publication', 'publication_operations', 'CIRCUIT_BREAKER_HALF_OPEN', pubBreaker.id, 'HALF_OPEN_PROBING');
      candidates.push({
        anomaly_id: `anom_${fp}`,
        detected_at: pubBreaker.lastStateChangeAt || now,
        updated_at: now,
        source_system: 'publication',
        department_id: 'publication_operations',
        responsible_agent_id: 'publication_dispatcher_core',
        severity: 'WARNING',
        anomaly_type: 'CIRCUIT_BREAKER_HALF_OPEN',
        error_class: 'CIRCUIT_BREAKER_HALF_OPEN',
        title: 'Circuit Breaker Publikasi Mode Uji (HALF_OPEN)',
        summary: 'Pemutus sirkuit sedang menguji koneksi kembali secara terbatas setelah kegagalan sebelumnya.',
        technical_detail: `Breaker ID: ${pubBreaker.id}, Probing active`,
        state: 'OPEN',
        retryable: true,
        operator_action_required: false,
        expected_condition: false,
        evidence_reference: `circuit_breakers:${pubBreaker.id}`,
        fingerprint: fp,
        occurrence_count: 1,
        first_seen_at: pubBreaker.lastStateChangeAt || now,
        last_seen_at: now
      });
    }
  }

  // D. Failed Cloudflare Cron Runs
  const cronRuns = snapshot.scheduler?.cloudflareCron || [];
  const failedCrons = cronRuns.filter((c) => c.status === 'FAILED');
  for (const c of failedCrons) {
    const fp = createAnomalyFingerprint('publication', 'publication_operations', 'CRON_JOB_FAILED', c.jobName, 'CRON_FAILURE');
    candidates.push({
      anomaly_id: `anom_${fp}`,
      detected_at: c.startedAt || now,
      updated_at: now,
      source_system: 'publication',
      department_id: 'publication_operations',
      responsible_agent_id: 'publication_dispatcher_core',
      task_id: c.runId,
      severity: 'WARNING',
      anomaly_type: 'CRON_JOB_FAILED',
      error_class: 'CRON_EXECUTION_FAILED',
      title: `Cron Publikasi Gagal [${c.jobName}]`,
      summary: `Eksekusi scheduled runner Cloudflare '${c.jobName}' mengalami kesalahan: ${c.errorSummary || 'Runner Error'}`,
      technical_detail: `Run ID: ${c.runId}, Started At: ${c.startedAt}`,
      state: 'OPEN',
      retryable: true,
      operator_action_required: false,
      expected_condition: false,
      evidence_reference: `cloudflare_cron:${c.runId}`,
      fingerprint: fp,
      occurrence_count: 1,
      first_seen_at: c.startedAt || now,
      last_seen_at: now
    });
  }

  // --------------------------------------------------------------------------
  // 3. TYPESAFE JEV & TELEMETRY SUBSYSTEM
  // --------------------------------------------------------------------------
  const jevStatus = snapshot.health?.jev?.providerStatus;
  if (jevStatus === 'FALLBACK') {
    const fp = createAnomalyFingerprint('jev', 'engineering_telemetry', 'JEV_PROVIDER_FALLBACK', 'openrouter_provider', 'FALLBACK_TRIGGERED');
    candidates.push({
      anomaly_id: `anom_${fp}`,
      detected_at: snapshot.health?.jev?.latestTimestamp || now,
      updated_at: now,
      source_system: 'jev',
      department_id: 'engineering_telemetry',
      responsible_agent_id: 'telemetry_observer_jev',
      severity: 'WARNING',
      anomaly_type: 'JEV_PROVIDER_FALLBACK',
      error_class: 'JEV_FALLBACK_ENGAGED',
      title: 'Penyedia TypeSafe Jev Memasuki Mode Fallback',
      summary: 'Koneksi keputusan bayangan Jev beralih ke cadangan lokal karena timeout atau degradasi model OpenRouter.',
      technical_detail: `Error Class: ${snapshot.health?.jev?.errorClass || 'FALLBACK'}, Latency: ${snapshot.health?.jev?.latestLatencyMs || 0}ms. Catatan: JEV shadow memiliki 0 otoritas eksekusi.`,
      state: 'OPEN',
      retryable: true,
      operator_action_required: false,
      expected_condition: false,
      evidence_reference: 'typesafe_jev:fallback',
      fingerprint: fp,
      occurrence_count: 1,
      first_seen_at: snapshot.health?.jev?.latestTimestamp || now,
      last_seen_at: now
    });
  } else if (jevStatus === 'ERROR') {
    const fp = createAnomalyFingerprint('jev', 'engineering_telemetry', 'JEV_PROVIDER_ERROR', 'openrouter_provider', 'PROVIDER_UNREACHABLE');
    candidates.push({
      anomaly_id: `anom_${fp}`,
      detected_at: snapshot.health?.jev?.latestTimestamp || now,
      updated_at: now,
      source_system: 'jev',
      department_id: 'engineering_telemetry',
      responsible_agent_id: 'telemetry_observer_jev',
      severity: 'WARNING',
      anomaly_type: 'JEV_PROVIDER_ERROR',
      error_class: 'JEV_PROVIDER_UNREACHABLE',
      title: 'Kesalahan Komunikasi Provider TypeSafe Jev',
      summary: `Permintaan observasi bayangan Jev gagal: ${snapshot.health?.jev?.errorClass || 'HTTP 5xx / Network Error'}`,
      technical_detail: 'Log keputusan bayangan terhambat, namun integritas artikel 100% terjaga (fail-safe).',
      state: 'OPEN',
      retryable: true,
      operator_action_required: false,
      expected_condition: false,
      evidence_reference: 'typesafe_jev:error',
      fingerprint: fp,
      occurrence_count: 1,
      first_seen_at: snapshot.health?.jev?.latestTimestamp || now,
      last_seen_at: now
    });
  }

  // --------------------------------------------------------------------------
  // 4. HERMES SCHEDULER & CONTAINER SUBSYSTEM
  // --------------------------------------------------------------------------
  const hermesStatus = snapshot.scheduler?.hermes?.status;
  if (hermesStatus === 'stale') {
    const fp = createAnomalyFingerprint('hermes', 'engineering_telemetry', 'HERMES_HEARTBEAT_STALE', 'scheduler_daemon', 'STALE_HEARTBEAT');
    candidates.push({
      anomaly_id: `anom_${fp}`,
      detected_at: snapshot.scheduler?.hermes?.recordedAt || now,
      updated_at: now,
      source_system: 'hermes',
      department_id: 'engineering_telemetry',
      responsible_agent_id: 'telemetry_observer_jev',
      severity: 'WARNING',
      anomaly_type: 'HERMES_HEARTBEAT_STALE',
      error_class: 'STALE_HEARTBEAT',
      title: 'Detak Jantung Scheduler Hermes Usang (Stale)',
      summary: `Scheduler Hermes belum mengirim sinyal selama ${snapshot.scheduler?.hermes?.freshnessSeconds || 0} detik (>300s).`,
      technical_detail: snapshot.scheduler?.hermes?.note || 'Sinyal heartbeat terlambat melampaui batas toleransi normal.',
      state: 'OPEN',
      retryable: true,
      operator_action_required: false,
      expected_condition: false,
      evidence_reference: 'scheduler:hermes_heartbeat',
      fingerprint: fp,
      occurrence_count: 1,
      first_seen_at: snapshot.scheduler?.hermes?.recordedAt || now,
      last_seen_at: now
    });
  } else if (hermesStatus === 'offline') {
    const fp = createAnomalyFingerprint('hermes', 'engineering_telemetry', 'HERMES_HEARTBEAT_OFFLINE', 'scheduler_daemon', 'OFFLINE_DAEMON');
    candidates.push({
      anomaly_id: `anom_${fp}`,
      detected_at: snapshot.scheduler?.hermes?.recordedAt || now,
      updated_at: now,
      source_system: 'hermes',
      department_id: 'engineering_telemetry',
      responsible_agent_id: 'telemetry_observer_jev',
      severity: 'ERROR',
      anomaly_type: 'HERMES_HEARTBEAT_OFFLINE',
      error_class: 'OFFLINE_DAEMON',
      title: 'Daemon Container Hermes Tidak Terhubung (Offline)',
      summary: `Container Hermes tidak merespons selama ${snapshot.scheduler?.hermes?.freshnessSeconds || 0} detik (>600s).`,
      technical_detail: 'Daemon background orkestrator terputus; pipeline editorial dan sinkronisasi outbox terhenti.',
      state: 'OPEN',
      retryable: true,
      operator_action_required: true,
      expected_condition: false,
      evidence_reference: 'scheduler:hermes_heartbeat',
      fingerprint: fp,
      occurrence_count: 1,
      first_seen_at: snapshot.scheduler?.hermes?.recordedAt || now,
      last_seen_at: now
    });
  }

  // Dead Letter Outbox Anomaly
  const deadLetterCount = snapshot.outbox?.deadLetter || 0;
  if (deadLetterCount > 0) {
    const fp = createAnomalyFingerprint('hermes', 'engineering_telemetry', 'OUTBOX_DEAD_LETTER', 'outbox_queue', 'DEAD_LETTER_ACCUMULATION');
    candidates.push({
      anomaly_id: `anom_${fp}`,
      detected_at: snapshot.outbox?.lastIngestAt || now,
      updated_at: now,
      source_system: 'hermes',
      department_id: 'engineering_telemetry',
      responsible_agent_id: null, // Ambiguous infrastructure issue remains unassigned
      severity: 'ERROR',
      anomaly_type: 'OUTBOX_DEAD_LETTER',
      error_class: 'DEAD_LETTER_ACCUMULATION',
      title: `Antrean Dead-Letter Outbox Terisi (${deadLetterCount} paket)`,
      summary: `Terdapat ${deadLetterCount} pesan outbox yang gagal terkirim setelah batas percobaan maksimal.`,
      technical_detail: 'Paket draf artikel tertahan di outbox dan memerlukan inspeksi log bridge.',
      state: 'OPEN',
      retryable: true,
      operator_action_required: true,
      expected_condition: false,
      evidence_reference: 'outbox:dead_letter',
      fingerprint: fp,
      occurrence_count: 1,
      first_seen_at: snapshot.outbox?.lastIngestAt || now,
      last_seen_at: now
    });
  }

  // --------------------------------------------------------------------------
  // 5. EDITORIAL & RESEARCH SUBSYSTEM
  // --------------------------------------------------------------------------
  const editorialTasks = snapshot.pipeline?.tasks?.filter((t) => t.subsystem === 'editorial' && t.stage === 'failed') || [];
  for (const t of editorialTasks) {
    const isQA = t.title.toLowerCase().includes('qa') || (t.blockerOrError && t.blockerOrError.toLowerCase().includes('qa'));
    const assignedAgent = isQA ? 'editorial_qa_primary' : 'content_writer_primary';
    const anomType = isQA ? 'EDITORIAL_QA_FAILED' : 'EDITORIAL_VALIDATION_FAILED';
    const fp = createAnomalyFingerprint('editorial', 'editorial', anomType, t.taskId, 'TASK_FAILED');

    candidates.push({
      anomaly_id: `anom_${fp}`,
      detected_at: t.lastUpdate || now,
      updated_at: now,
      source_system: 'editorial',
      department_id: 'editorial',
      responsible_agent_id: assignedAgent,
      task_id: t.taskId,
      entity_type: 'article',
      entity_id: String(t.relatedArticleId || t.taskId),
      severity: 'WARNING',
      anomaly_type: anomType,
      error_class: 'EDITORIAL_TASK_FAILED',
      title: isQA ? `Kegagalan Inspeksi Mutu QA (${t.title})` : `Hambatan Penulisan Editorial (${t.title})`,
      summary: `Naskah [${t.title}] mengalami kendala: ${t.blockerOrError || 'Validasi aturan gagal.'}`,
      technical_detail: `Task ID: ${t.taskId}, Blocker: ${t.blockerOrError || 'Unknown'}`,
      state: 'OPEN',
      retryable: true,
      operator_action_required: true,
      expected_condition: false,
      evidence_reference: `articles:${t.relatedArticleId || t.taskId}`,
      fingerprint: fp,
      occurrence_count: 1,
      first_seen_at: t.lastUpdate || now,
      last_seen_at: now
    });
  }

  const researchTasks = snapshot.pipeline?.tasks?.filter((t) => t.subsystem === 'research' && t.stage === 'failed') || [];
  for (const t of researchTasks) {
    const fp = createAnomalyFingerprint('research', 'research_evidence', 'RESEARCH_PACK_FAILED', t.taskId, 'RESEARCH_FAILED');
    candidates.push({
      anomaly_id: `anom_${fp}`,
      detected_at: t.lastUpdate || now,
      updated_at: now,
      source_system: 'research',
      department_id: 'research_evidence',
      responsible_agent_id: 'evidence_researcher_lead',
      task_id: t.taskId,
      severity: 'WARNING',
      anomaly_type: 'RESEARCH_PACK_FAILED',
      error_class: 'RESEARCH_PACK_FAILED',
      title: `Riset Bukti Teknis Terhambat (${t.title})`,
      summary: `Penyusunan referensi empiris/SNI terhambat: ${t.blockerOrError || 'Sitasi tidak lengkap'}`,
      technical_detail: `Task ID: ${t.taskId}, Blocker: ${t.blockerOrError || 'Unknown'}`,
      state: 'OPEN',
      retryable: true,
      operator_action_required: false,
      expected_condition: false,
      evidence_reference: `tasks:${t.taskId}`,
      fingerprint: fp,
      occurrence_count: 1,
      first_seen_at: t.lastUpdate || now,
      last_seen_at: now
    });
  }

  // --------------------------------------------------------------------------
  // 6. SOCIAL & DISTRIBUTION SUBSYSTEM
  // --------------------------------------------------------------------------
  if (snapshot.social) {
    const socialSummary = snapshot.social;

    // A. Social Automation Mode OFF by Design (EXPECTED CONDITION - NOT AN ALERT)
    if (socialSummary.mode === 'OFF' || socialSummary.mode === 'SHADOW' || !socialSummary.providerExecutionAvailable) {
      const fp = createAnomalyFingerprint('social', 'social', 'SOCIAL_AUTOMATION_OFF', 'social_gate');
      candidates.push({
        anomaly_id: `anom_${fp}`,
        detected_at: now,
        updated_at: now,
        source_system: 'social',
        department_id: 'social',
        responsible_agent_id: 'social_distribution_operator',
        severity: 'INFO',
        anomaly_type: 'SOCIAL_AUTOMATION_OFF',
        error_class: 'INTENTIONAL_DORMANCY',
        title: 'Otomasi Distribusi Sosial Nonaktif Sesuai Desain',
        summary: 'Mode otomatisasi sosial berstatus OFF (Shadow / Read-Only) sesuai invarian keselamatan produksi.',
        technical_detail: 'Invarian produksi mewajibkan persetujuan manual operator dan provider execution masih belum aktif (disabled).',
        state: 'EXPECTED',
        retryable: false,
        operator_action_required: false,
        expected_condition: true,
        evidence_reference: 'social_control:mode',
        fingerprint: fp,
        occurrence_count: 1,
        first_seen_at: now,
        last_seen_at: now
      });
    }

    // B. Blocked Social Campaigns (WARNING)
    if (socialSummary.blockedCampaigns > 0) {
      const fp = createAnomalyFingerprint('social', 'social', 'SOCIAL_CAMPAIGN_BLOCKED', 'campaign_queue', 'CAMPAIGN_BLOCKED');
      candidates.push({
        anomaly_id: `anom_${fp}`,
        detected_at: now,
        updated_at: now,
        source_system: 'social',
        department_id: 'social',
        responsible_agent_id: 'social_distribution_operator',
        severity: 'WARNING',
        anomaly_type: 'SOCIAL_CAMPAIGN_BLOCKED',
        error_class: 'SOCIAL_CAMPAIGN_BLOCKED',
        title: `Kampanye Sosial Terhambat (${socialSummary.blockedCampaigns} kampanye)`,
        summary: `Terdapat ${socialSummary.blockedCampaigns} kampanye sosial berstatus BLOCKED atau FAILED pada tahap pembuatan varian.`,
        technical_detail: 'Penyusunan naskah atau kurasi media varian sosial mengalami hambatan validasi atau dependensi aset.',
        state: 'OPEN',
        retryable: true,
        operator_action_required: true,
        expected_condition: false,
        evidence_reference: 'social_campaigns:status_blocked',
        fingerprint: fp,
        occurrence_count: 1,
        first_seen_at: now,
        last_seen_at: now
      });
    }

    // C. Meta Connection Anomalies (Reauth required / Permission incomplete)
    const metaConn = (socialSummary as any).metaConnection;
    if (metaConn && metaConn.overallStatus === 'REAUTH_REQUIRED') {
      const fp = createAnomalyFingerprint('social', 'social', 'SOCIAL_AUTH_REAUTH_REQUIRED', 'meta_connection', 'REAUTH_REQUIRED');
      candidates.push({
        anomaly_id: `anom_${fp}`,
        detected_at: now,
        updated_at: now,
        source_system: 'social',
        department_id: 'social',
        responsible_agent_id: 'social_distribution_operator',
        severity: 'WARNING',
        anomaly_type: 'SOCIAL_AUTH_REAUTH_REQUIRED',
        error_class: 'SOCIAL_AUTH_REAUTH_REQUIRED',
        title: 'Otorisasi Akun Meta Perlu Diperbarui (Re-auth Required)',
        summary: 'Akses token Meta telah kedaluwarsa atau dicabut. Diperlukan autentikasi ulang oleh operator.',
        technical_detail: metaConn.operatorActionMessage || 'Meta OAuth session expired.',
        state: 'OPEN',
        retryable: false,
        operator_action_required: true,
        expected_condition: false,
        evidence_reference: 'social_settings:meta_connection',
        fingerprint: fp,
        occurrence_count: 1,
        first_seen_at: now,
        last_seen_at: now
      });
    } else if (metaConn && metaConn.overallStatus === 'PERMISSION_INCOMPLETE') {
      const fp = createAnomalyFingerprint('social', 'social', 'SOCIAL_PERMISSION_INCOMPLETE', 'meta_connection', 'PERMISSION_INCOMPLETE');
      candidates.push({
        anomaly_id: `anom_${fp}`,
        detected_at: now,
        updated_at: now,
        source_system: 'social',
        department_id: 'social',
        responsible_agent_id: 'social_distribution_operator',
        severity: 'WARNING',
        anomaly_type: 'SOCIAL_PERMISSION_INCOMPLETE',
        error_class: 'SOCIAL_PERMISSION_INCOMPLETE',
        title: 'Izin Akun Meta Belum Lengkap (Missing Permissions)',
        summary: `Izin akun belum lengkap: ${(metaConn.missingPermissions || []).join(', ')}.`,
        technical_detail: 'Operator perlu memberikan izin yang diperlukan pada dialog Meta OAuth.',
        state: 'OPEN',
        retryable: false,
        operator_action_required: true,
        expected_condition: false,
        evidence_reference: 'social_settings:meta_connection',
        fingerprint: fp,
        occurrence_count: 1,
        first_seen_at: now,
        last_seen_at: now
      });
    }
  }

  // D. Social Tasks Failed
  const socialTasks = snapshot.pipeline?.tasks?.filter((t) => t.subsystem === 'social' && t.stage === 'failed') || [];
  for (const t of socialTasks) {
    const fp = createAnomalyFingerprint('social', 'social', 'SOCIAL_TASK_FAILED', t.taskId, 'TASK_FAILED');
    candidates.push({
      anomaly_id: `anom_${fp}`,
      detected_at: t.lastUpdate || now,
      updated_at: now,
      source_system: 'social',
      department_id: 'social',
      responsible_agent_id: 'social_distribution_operator',
      task_id: t.taskId,
      severity: 'WARNING',
      anomaly_type: 'SOCIAL_TASK_FAILED',
      error_class: 'SOCIAL_TASK_FAILED',
      title: `Tugas Distribusi Sosial Terhambat (${t.title})`,
      summary: `Tugas sosial [${t.title}] mengalami kendala: ${t.blockerOrError || 'Validasi varian gagal'}`,
      technical_detail: `Task ID: ${t.taskId}, Blocker: ${t.blockerOrError || 'Unknown'}`,
      state: 'OPEN',
      retryable: true,
      operator_action_required: true,
      expected_condition: false,
      evidence_reference: `tasks:${t.taskId}`,
      fingerprint: fp,
      occurrence_count: 1,
      first_seen_at: t.lastUpdate || now,
      last_seen_at: now
    });
  }

  return candidates;
}

/**
 * Routes an arbitrary anomaly class or subsystem to its owning department and responsible staff
 * using the Capability Registry and Department Registry contracts.
 */
export function routeAnomalyByCapability(
  anomalyClass: string,
  sourceSystem?: string
): {
  department_id: string | null;
  responsible_agent_id: string | null;
} {
  if (!anomalyClass) {
    return { department_id: null, responsible_agent_id: null };
  }

  // Look through registered capabilities for a match in anomaly_classes or source_systems
  const registeredCaps = getRegisteredCapabilities();
  for (const cap of registeredCaps) {
    if (cap.anomaly_classes && cap.anomaly_classes.includes(anomalyClass)) {
      return {
        department_id: cap.owning_department_id,
        responsible_agent_id: cap.default_agent_id
      };
    }
  }

  // Fallback to source system match if available
  if (sourceSystem) {
    for (const cap of registeredCaps) {
      if (cap.source_systems && cap.source_systems.includes(sourceSystem)) {
        return {
          department_id: cap.owning_department_id,
          responsible_agent_id: cap.default_agent_id
        };
      }
    }
  }

  return { department_id: null, responsible_agent_id: null };
}

// ============================================================================
// Sync & Deduplication Engine (Database & Memory Dual-Store)
// ============================================================================

/**
 * Synchronizes scanned anomalies against persistent records:
 * 1. Deduplicates and updates existing open records (occurrence_count, last_seen_at).
 * 2. Automatically resolves records whose underlying condition has cleared.
 * 3. Dispatches staff conversation escalation for newly opened actionable anomalies.
 */
export async function scanAndSyncAnomalies(
  db: any,
  snapshot: MissionControlSnapshot | null
): Promise<AnomaliesSummary> {
  const scanned = scanRawAnomaliesFromSnapshot(snapshot);
  const now = new Date().toISOString();

  // Load existing anomalies
  let existingList: MissionControlAnomaly[] = [];

  if (db && typeof db.prepare === 'function') {
    try {
      const { results } = await db.prepare(
        'SELECT anomaly_id, detected_at, updated_at, source_system, source_event_id, department_id, responsible_agent_id, task_id, entity_type, entity_id, severity, anomaly_type, error_class, title, summary, technical_detail, state, retryable, operator_action_required, expected_condition, evidence_reference, fingerprint, occurrence_count, first_seen_at, last_seen_at, resolved_at, metadata_json FROM mission_control_anomalies'
      ).all();

      if (Array.isArray(results)) {
        existingList = results.map((r: any) => ({
          ...r,
          retryable: Boolean(r.retryable),
          operator_action_required: Boolean(r.operator_action_required),
          expected_condition: Boolean(r.expected_condition),
          metadata: r.metadata_json ? JSON.parse(r.metadata_json) : undefined
        }));
      }
    } catch {
      // Fallback to memory
      existingList = Array.from(memoryAnomalies.values());
    }
  } else {
    existingList = Array.from(memoryAnomalies.values());
  }

  const existingByFp = new Map<string, MissionControlAnomaly>();
  for (const anom of existingList) {
    existingByFp.set(anom.fingerprint, anom);
  }

  const currentFpSet = new Set<string>();

  // Process scanned candidates
  for (const candidate of scanned) {
    currentFpSet.add(candidate.fingerprint);
    const existing = existingByFp.get(candidate.fingerprint);

    if (existing) {
      if (existing.state === 'OPEN' || existing.state === 'EXPECTED') {
        // Increment occurrence count & update timestamps
        const updatedCount = existing.occurrence_count + 1;
        const severityChanged = existing.severity !== candidate.severity;
        const newSeverity = candidate.severity;

        existing.occurrence_count = updatedCount;
        existing.last_seen_at = now;
        existing.updated_at = now;
        existing.technical_detail = candidate.technical_detail;
        existing.evidence_reference = candidate.evidence_reference;
        existing.severity = newSeverity;

        // Persist update
        if (db && typeof db.prepare === 'function') {
          try {
            await db.prepare(
              'UPDATE mission_control_anomalies SET occurrence_count = ?, last_seen_at = ?, updated_at = ?, technical_detail = ?, evidence_reference = ?, severity = ? WHERE anomaly_id = ?'
            ).bind(
              updatedCount,
              now,
              now,
              candidate.technical_detail || null,
              candidate.evidence_reference || null,
              newSeverity,
              existing.anomaly_id
            ).run();

            if (severityChanged) {
              await db.prepare(
                'INSERT INTO mission_control_anomaly_events (event_id, anomaly_id, event_type, previous_state, new_state, message, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)'
              ).bind(
                `anev_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
                existing.anomaly_id,
                'UPDATED',
                existing.state,
                existing.state,
                `Tingkat keparahan eskalasi diperbarui menjadi ${newSeverity}`,
                now
              ).run();
            }
          } catch {
            // Memory fallback
          }
        }

        memoryAnomalies.set(existing.anomaly_id, existing);
      } else if (existing.state === 'RESOLVED') {
        // Re-open previously resolved anomaly
        existing.state = candidate.state;
        existing.resolved_at = null;
        existing.last_seen_at = now;
        existing.updated_at = now;
        existing.occurrence_count += 1;
        existing.severity = candidate.severity;

        if (db && typeof db.prepare === 'function') {
          try {
            await db.prepare(
              'UPDATE mission_control_anomalies SET state = ?, resolved_at = NULL, last_seen_at = ?, updated_at = ?, occurrence_count = occurrence_count + 1, severity = ? WHERE anomaly_id = ?'
            ).bind(existing.state, now, now, candidate.severity, existing.anomaly_id).run();
          } catch {
            // Memory fallback
          }
        }

        memoryAnomalies.set(existing.anomaly_id, existing);
      }
    } else {
      // Brand new anomaly
      const newAnom: MissionControlAnomaly = {
        ...candidate,
        title: redactSensitiveString(candidate.title),
        summary: redactSensitiveString(candidate.summary),
        technical_detail: candidate.technical_detail ? redactSensitiveString(candidate.technical_detail) : null
      };

      if (db && typeof db.prepare === 'function') {
        try {
          await db.prepare(
            `INSERT INTO mission_control_anomalies (
              anomaly_id, detected_at, updated_at, source_system, source_event_id, department_id,
              responsible_agent_id, task_id, entity_type, entity_id, severity, anomaly_type,
              error_class, title, summary, technical_detail, state, retryable,
              operator_action_required, expected_condition, evidence_reference, fingerprint,
              occurrence_count, first_seen_at, last_seen_at, resolved_at, metadata_json
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
          ).bind(
            newAnom.anomaly_id, newAnom.detected_at, newAnom.updated_at, newAnom.source_system,
            newAnom.source_event_id || null, newAnom.department_id, newAnom.responsible_agent_id || null,
            newAnom.task_id || null, newAnom.entity_type || null, newAnom.entity_id || null,
            newAnom.severity, newAnom.anomaly_type, newAnom.error_class || null, newAnom.title,
            newAnom.summary, newAnom.technical_detail || null, newAnom.state,
            newAnom.retryable ? 1 : 0, newAnom.operator_action_required ? 1 : 0,
            newAnom.expected_condition ? 1 : 0, newAnom.evidence_reference || null,
            newAnom.fingerprint, newAnom.occurrence_count, newAnom.first_seen_at,
            newAnom.last_seen_at, null, newAnom.metadata ? JSON.stringify(newAnom.metadata) : null
          ).run();

          await db.prepare(
            'INSERT INTO mission_control_anomaly_events (event_id, anomaly_id, event_type, previous_state, new_state, message, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)'
          ).bind(
            `anev_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
            newAnom.anomaly_id,
            'DETECTED',
            null,
            newAnom.state,
            `Anomali baru terdeteksi: ${newAnom.title}`,
            now
          ).run();
        } catch {
          // Memory fallback
        }
      }

      memoryAnomalies.set(newAnom.anomaly_id, newAnom);
      existingList.push(newAnom);

      // Trigger Staff Conversation Escalation if actionable and assigned
      if (newAnom.state === 'OPEN' && newAnom.severity !== 'INFO' && newAnom.responsible_agent_id) {
        await dispatchStaffAnomalyEscalation(db, newAnom);
      }
    }
  }

  // Detect and resolve cleared conditions
  for (const existing of existingList) {
    if ((existing.state === 'OPEN' || existing.state === 'EXPECTED') && !currentFpSet.has(existing.fingerprint)) {
      // Condition has cleared deterministically
      existing.state = 'RESOLVED';
      existing.resolved_at = now;
      existing.updated_at = now;

      if (db && typeof db.prepare === 'function') {
        try {
          await db.prepare(
            'UPDATE mission_control_anomalies SET state = ?, resolved_at = ?, updated_at = ? WHERE anomaly_id = ?'
          ).bind('RESOLVED', now, now, existing.anomaly_id).run();

          await db.prepare(
            'INSERT INTO mission_control_anomaly_events (event_id, anomaly_id, event_type, previous_state, new_state, message, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)'
          ).bind(
            `anev_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
            existing.anomaly_id,
            'RESOLVED',
            'OPEN',
            'RESOLVED',
            `Kondisi anomali telah terselesaikan secara deterministik: ${existing.title}`,
            now
          ).run();
        } catch {
          // Memory fallback
        }
      }

      memoryAnomalies.set(existing.anomaly_id, existing);
    }
  }

  // Compile summary
  const allCurrent = Array.from(memoryAnomalies.values());
  const active_anomalies = allCurrent.filter((a) => a.state === 'OPEN' && !a.expected_condition);
  const expected_conditions = allCurrent.filter((a) => a.expected_condition || a.state === 'EXPECTED');
  const resolved_anomalies = allCurrent.filter((a) => a.state === 'RESOLVED');

  const counts = {
    total_active: active_anomalies.length,
    critical: active_anomalies.filter((a) => a.severity === 'CRITICAL').length,
    error: active_anomalies.filter((a) => a.severity === 'ERROR').length,
    warning: active_anomalies.filter((a) => a.severity === 'WARNING').length,
    expected: expected_conditions.length,
    resolved: resolved_anomalies.length
  };

  return {
    active_anomalies,
    expected_conditions,
    resolved_anomalies,
    counts
  };
}

// ============================================================================
// Staff Conversation Escalation ("Staff Reports to Operator")
// ============================================================================

/**
 * Dispatches an automated, informational escalation message into the staff member's
 * conversation thread.
 * Strict Invariant: Does NOT execute commands or bypass authority models.
 */
export async function dispatchStaffAnomalyEscalation(
  db: any,
  anomaly: MissionControlAnomaly
): Promise<boolean> {
  if (!anomaly.responsible_agent_id) return false;
  if (escalatedFingerprints.has(anomaly.fingerprint)) return false;

  const staff = getStaffDefinitionByAgentId(anomaly.responsible_agent_id);
  const staffName = staff?.display_name || anomaly.responsible_agent_id;

  try {
    const conv = await getOrCreateConversation(db, anomaly.responsible_agent_id, 'system');
    const msgId = `msg_anom_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
    const now = new Date().toISOString();

    const severityTag = anomaly.severity === 'CRITICAL' ? '🚨 [KRITIS]' : anomaly.severity === 'ERROR' ? '⚠️ [ERROR]' : 'ℹ️ [PERINGATAN]';
    const content = `${severityTag} Laporan Operasional: ${anomaly.title}.\n${anomaly.summary}\nDetail Teknis: ${anomaly.technical_detail || 'Lihat Alert Center'}`;

    await appendMessage(db, {
      message_id: msgId,
      conversation_id: conv.conversation_id,
      sender_type: 'STAFF',
      sender_id: anomaly.responsible_agent_id,
      message_type: anomaly.severity === 'CRITICAL' || anomaly.severity === 'ERROR' ? 'ERROR' : 'SYSTEM_NOTICE',
      content,
      created_at: now,
      metadata: {
        anomaly_id: anomaly.anomaly_id,
        fingerprint: anomaly.fingerprint,
        severity: anomaly.severity,
        source_system: anomaly.source_system
      }
    });

    escalatedFingerprints.add(anomaly.fingerprint);
    return true;
  } catch (err) {
    console.error(`Failed to dispatch staff anomaly escalation for ${anomaly.responsible_agent_id}:`, err);
    return false;
  }
}

// ============================================================================
// Department Health Model Integration
// ============================================================================

/**
 * Feeds normalized active anomalies into department health derivation.
 * Strict Invariant: INFO and EXPECTED anomalies NEVER degrade department health.
 */
export function applyAnomaliesToDepartmentHealth(
  departmentId: string,
  baseHealth: string,
  anomalies: MissionControlAnomaly[]
): { health: string; evidence?: string } {
  // If base health is already NOT_AVAILABLE or UNKNOWN, preserve precedence
  if (baseHealth === 'NOT_AVAILABLE' || baseHealth === 'UNKNOWN') {
    return { health: baseHealth };
  }

  const deptActiveAnomalies = anomalies.filter(
    (a) => a.department_id === departmentId && a.state === 'OPEN' && !a.expected_condition
  );

  if (deptActiveAnomalies.length === 0) {
    return { health: baseHealth };
  }

  // Precedence 1: CRITICAL anomaly -> BLOCKED
  const critical = deptActiveAnomalies.find((a) => a.severity === 'CRITICAL');
  if (critical) {
    return {
      health: 'BLOCKED',
      evidence: `Anomali kritis aktif: ${critical.title}`
    };
  }

  // Precedence 2: ERROR anomaly -> DEGRADED (or BLOCKED if already degraded)
  const error = deptActiveAnomalies.find((a) => a.severity === 'ERROR');
  if (error) {
    return {
      health: 'DEGRADED',
      evidence: `Anomali error aktif: ${error.title}`
    };
  }

  // Precedence 3: WARNING anomaly -> DEGRADED if base was HEALTHY or ACTIVE
  const warning = deptActiveAnomalies.find((a) => a.severity === 'WARNING');
  if (warning && (baseHealth === 'HEALTHY' || baseHealth === 'ACTIVE')) {
    return {
      health: 'DEGRADED',
      evidence: `Peringatan operasional: ${warning.title}`
    };
  }

  return { health: baseHealth };
}

/**
 * Pure read-model aggregator for anomalies from snapshot.
 * Strict Invariant: Executes zero mutations and zero database writes.
 */
export function getAnomaliesSnapshot(snapshot: MissionControlSnapshot | null): AnomaliesSummary {
  const scanned = scanRawAnomaliesFromSnapshot(snapshot);
  const active_anomalies = scanned.filter((a) => a.state === 'OPEN' && !a.expected_condition);
  const expected_conditions = scanned.filter((a) => a.expected_condition || a.state === 'EXPECTED');
  const resolved_anomalies = Array.from(memoryAnomalies.values()).filter((a) => a.state === 'RESOLVED');

  const counts = {
    total_active: active_anomalies.length,
    critical: active_anomalies.filter((a) => a.severity === 'CRITICAL').length,
    error: active_anomalies.filter((a) => a.severity === 'ERROR').length,
    warning: active_anomalies.filter((a) => a.severity === 'WARNING').length,
    expected: expected_conditions.length,
    resolved: resolved_anomalies.length
  };

  return {
    active_anomalies,
    expected_conditions,
    resolved_anomalies,
    counts
  };
}

