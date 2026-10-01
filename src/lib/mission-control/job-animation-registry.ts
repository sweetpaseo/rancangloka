/**
 * RancangLoka Hermes Mission Control — Role & Job Animation Registry
 * Milestone: HERMES-MC-9
 * 
 * Strict Invariants:
 * 1. PRESENTATION ONLY. Zero execution authority.
 * 2. Deterministic derivation: REAL TASK → CAPABILITY → STAFF → JOB VISUAL STATE → ROLE ANIMATION.
 * 3. No real task = no working animation. Zero synthesized or fake work.
 * 4. Queued tasks (MC-5 chat queue) MUST NOT trigger working animations until RUNNING.
 * 5. Completed tasks stop animation and return staff to Lounge / resting state.
 * 6. Media worker DISABLED strictly enforces OFFLINE_DISABLED (Budi never shows active work when disabled).
 * 7. Publication automation OFF strictly prevents PUBLICATION_DISPATCH (Sari never fakes dispatch).
 * 8. JEV shadow evaluation does NOT imply Dimas controls publication.
 * 9. IDLE staff stay in Lounge without typing, reviewing, or console usage.
 * 10. Machine IDs remain strictly authoritative — never use human display names as keys.
 * 11. Zero random movement, zero continuous rAF simulation, lightweight CSS/SVG primitives.
 * 12. Respects prefers-reduced-motion accessibility rules.
 */

import type { MissionControlSnapshot } from './types.ts';
import type { StaffMemberStatus } from './staff-registry.ts';
import { sanitizeString } from './redact.ts';

// ============================================================================
// Types & Animation Keys
// ============================================================================

export type JobAnimationKey =
  | 'IDLE_STANDBY'
  | 'ARTICLE_TYPING'
  | 'ARTICLE_REWRITE'
  | 'RESEARCH_BROWSING'
  | 'EVIDENCE_READING'
  | 'QA_REVIEW'
  | 'QA_CHECKLIST'
  | 'MEDIA_PROCESSING'
  | 'MEDIA_REVIEW'
  | 'PUBLICATION_MONITORING'
  | 'PUBLICATION_DISPATCH'
  | 'TELEMETRY_MONITORING'
  | 'JEV_ANALYSIS'
  | 'BLOCKED_WARNING'
  | 'OFFLINE_DISABLED'
  | 'UNKNOWN_NEUTRAL'
  | 'WORKING_GENERIC';

export type AnimationFreshness = 'REALTIME' | 'RECENT' | 'STALE' | 'UNKNOWN';

export interface StaffWorkVisualState {
  agent_id: string;
  capability_id: string;
  task_id: string | null;
  task_type: string | null;
  task_status: string | null;
  animation_key: JobAnimationKey;
  workstation_key: string;
  visual_detail: string;
  started_at: string | null;
  freshness: AnimationFreshness;
  evidence_reference: string | null;
  task_label: string | null;
  is_actively_working: boolean;
}

export interface JobAnimationDefinition {
  animation_key: JobAnimationKey;
  label: string;
  description: string;
  target_agent_ids: string[];
  capabilities: string[];
  workstation_key: string;
  visual_detail: string;
  is_work_animation: boolean;
  css_animation_class: string;
  reduced_motion_class: string;
  prop_icon: string;
}

// ============================================================================
// Central Animation Registry
// ============================================================================

export const JOB_ANIMATION_REGISTRY: Record<JobAnimationKey, JobAnimationDefinition> = {
  IDLE_STANDBY: {
    animation_key: 'IDLE_STANDBY',
    label: 'Siaga Santai di Lounge',
    description: 'Staf berada di area Lounge, posisi duduk/santai tanpa aktivitas mengetik atau pemrosesan tugas.',
    target_agent_ids: [
      'content_writer_primary',
      'editorial_qa_primary',
      'evidence_researcher_lead',
      'publication_dispatcher_core',
      'telemetry_observer_jev',
      'lokamedia_worker_primary'
    ],
    capabilities: [],
    workstation_key: 'lounge',
    visual_detail: 'Duduk santai di sofa Lounge, secangkir kopi, monitor kerja tidak aktif.',
    is_work_animation: false,
    css_animation_class: 'animate-idle-breathing',
    reduced_motion_class: 'motion-reduce:animate-none',
    prop_icon: '☕'
  },

  ARTICLE_TYPING: {
    animation_key: 'ARTICLE_TYPING',
    label: 'Menulis Draf Naskah',
    description: 'Joko aktif mengetik draf naskah baru pada workstation editorial.',
    target_agent_ids: ['content_writer_primary'],
    capabilities: ['ARTICLE_WRITING'],
    workstation_key: 'editorial_writer_desk',
    visual_detail: 'Mengetik keyboard, layar monitor editorial aktif bercahaya, lembar draf terbuka.',
    is_work_animation: true,
    css_animation_class: 'animate-typing-loop',
    reduced_motion_class: 'motion-reduce:animate-none',
    prop_icon: '⌨️'
  },

  ARTICLE_REWRITE: {
    animation_key: 'ARTICLE_REWRITE',
    label: 'Penulisan Ulang Naskah',
    description: 'Joko merevisi atau menulis ulang naskah untuk peningkatan sudut pandang atau ketajaman editorial.',
    target_agent_ids: ['content_writer_primary'],
    capabilities: ['ARTICLE_WRITING'],
    workstation_key: 'editorial_writer_desk',
    visual_detail: 'Mengetik revisi intensif, catatan perbaikan redaksi, lembar revisi aktif.',
    is_work_animation: true,
    css_animation_class: 'animate-rewrite-pulse',
    reduced_motion_class: 'motion-reduce:animate-none',
    prop_icon: '✍️'
  },

  RESEARCH_BROWSING: {
    animation_key: 'RESEARCH_BROWSING',
    label: 'Riset Bukti Empiris',
    description: 'Irwan mencari dan memvalidasi sumber primer SNI/ASTM dan dokumen teknis.',
    target_agent_ids: ['evidence_researcher_lead'],
    capabilities: ['EVIDENCE_RESEARCH'],
    workstation_key: 'research_main_desk',
    visual_detail: 'Konsol riset aktif, tab referensi standar konstruksi, penelaahan bukti empiris.',
    is_work_animation: true,
    css_animation_class: 'animate-research-scan',
    reduced_motion_class: 'motion-reduce:animate-none',
    prop_icon: '🔍'
  },

  EVIDENCE_READING: {
    animation_key: 'EVIDENCE_READING',
    label: 'Pemeriksaan Sitasi & Bukti',
    description: 'Irwan memverifikasi klaim teknis dan kepatuhan monetary silence pada draf.',
    target_agent_ids: ['evidence_researcher_lead'],
    capabilities: ['EVIDENCE_RESEARCH'],
    workstation_key: 'research_main_desk',
    visual_detail: 'Tumpukan dokumen standar SNI, pembacaan rujukan empiris, kaca pembesar telaah.',
    is_work_animation: true,
    css_animation_class: 'animate-evidence-flip',
    reduced_motion_class: 'motion-reduce:animate-none',
    prop_icon: '📖'
  },

  QA_REVIEW: {
    animation_key: 'QA_REVIEW',
    label: 'Inspeksi Mutu Redaksi',
    description: 'Rina meninjau naskah berdasarkan 13 kriteria First Article Gate pra-penerbitan.',
    target_agent_ids: ['editorial_qa_primary'],
    capabilities: ['EDITORIAL_QA'],
    workstation_key: 'editorial_review_desk',
    visual_detail: 'Meja review editorial, pena telaah, lembar evaluasi mutu naskah.',
    is_work_animation: true,
    css_animation_class: 'animate-qa-review',
    reduced_motion_class: 'motion-reduce:animate-none',
    prop_icon: '📝'
  },

  QA_CHECKLIST: {
    animation_key: 'QA_CHECKLIST',
    label: 'Validasi Checklist Kelayakan',
    description: 'Rina memeriksa checklist First Article Gate (sitasi, format, gambar autentik, anti-slop).',
    target_agent_ids: ['editorial_qa_primary'],
    capabilities: ['EDITORIAL_QA'],
    workstation_key: 'editorial_review_desk',
    visual_detail: 'Papan checklist kelayakan dengan 13 kriteria gerbang verifikasi.',
    is_work_animation: true,
    css_animation_class: 'animate-checklist-check',
    reduced_motion_class: 'motion-reduce:animate-none',
    prop_icon: '📋'
  },

  MEDIA_PROCESSING: {
    animation_key: 'MEDIA_PROCESSING',
    label: 'Pemrosesan Aset Media',
    description: 'Budi memproses rendering visual atau kompresi gambar (hanya saat worker aktif & ada tugas riil).',
    target_agent_ids: ['lokamedia_worker_primary'],
    capabilities: ['MEDIA_OPERATIONS'],
    workstation_key: 'media_console',
    visual_detail: 'Konsol media aktif, monitor menampilkan progres rendering dan kanvas gambar.',
    is_work_animation: true,
    css_animation_class: 'animate-media-render',
    reduced_motion_class: 'motion-reduce:animate-none',
    prop_icon: '🖼️'
  },

  MEDIA_REVIEW: {
    animation_key: 'MEDIA_REVIEW',
    label: 'Inspeksi Kualitas Visual',
    description: 'Budi memeriksa lisensi, resolusi, dan metadata visual artikel.',
    target_agent_ids: ['lokamedia_worker_primary'],
    capabilities: ['MEDIA_OPERATIONS'],
    workstation_key: 'media_console',
    visual_detail: 'Frame inspection zoom, monitor QA warna dan lisensi hak cipta foto.',
    is_work_animation: true,
    css_animation_class: 'animate-media-inspect',
    reduced_motion_class: 'motion-reduce:animate-none',
    prop_icon: '🎨'
  },

  PUBLICATION_MONITORING: {
    animation_key: 'PUBLICATION_MONITORING',
    label: 'Pemantauan Jadwal Publikasi',
    description: 'Sari memantau antrean rencana tayang, kuota harian, dan tanda terima (receipts).',
    target_agent_ids: ['publication_dispatcher_core'],
    capabilities: ['PUBLICATION_OPERATIONS'],
    workstation_key: 'publication_console',
    visual_detail: 'Konsol jadwal publikasi, grafik kuota harian, indikator detak jam scheduler.',
    is_work_animation: true,
    css_animation_class: 'animate-schedule-pulse',
    reduced_motion_class: 'motion-reduce:animate-none',
    prop_icon: '⏱️'
  },

  PUBLICATION_DISPATCH: {
    animation_key: 'PUBLICATION_DISPATCH',
    label: 'Penerbitan Artikel Langsung',
    description: 'Sari mengeksekusi dispatch atomik penerbitan artikel (hanya saat automation aktif & artikel tayang).',
    target_agent_ids: ['publication_dispatcher_core'],
    capabilities: ['PUBLICATION_OPERATIONS'],
    workstation_key: 'publication_console',
    visual_detail: 'Konsol dispatch aktif memancarkan sinyal rilis, cetak tanda terima eksekusi D1.',
    is_work_animation: true,
    css_animation_class: 'animate-dispatch-pulse',
    reduced_motion_class: 'motion-reduce:animate-none',
    prop_icon: '🚀'
  },

  TELEMETRY_MONITORING: {
    animation_key: 'TELEMETRY_MONITORING',
    label: 'Pemantauan Sensor & Telemetri',
    description: 'Dimas memantau aliran sensor, liveness container, dan latensi query D1.',
    target_agent_ids: ['telemetry_observer_jev'],
    capabilities: ['SYSTEM_TELEMETRY'],
    workstation_key: 'operations_console',
    visual_detail: 'Monitor ganda menampilkan grafik latensi server, matriks sirkuit, dan log detak jantung.',
    is_work_animation: true,
    css_animation_class: 'animate-telemetry-wave',
    reduced_motion_class: 'motion-reduce:animate-none',
    prop_icon: '📊'
  },

  JEV_ANALYSIS: {
    animation_key: 'JEV_ANALYSIS',
    label: 'Analisis Evaluasi Bayangan JEV',
    description: 'Dimas menganalisis sinyal keputusan TypeSafe JEV mode shadow (0 otoritas publikasi).',
    target_agent_ids: ['telemetry_observer_jev'],
    capabilities: ['SYSTEM_TELEMETRY'],
    workstation_key: 'operations_console',
    visual_detail: 'Visualisasi pohon keputusan bayangan JEV, probabilitas risiko, non-blocking telemetry.',
    is_work_animation: true,
    css_animation_class: 'animate-jev-radar',
    reduced_motion_class: 'motion-reduce:animate-none',
    prop_icon: '🧠'
  },

  BLOCKED_WARNING: {
    animation_key: 'BLOCKED_WARNING',
    label: 'Terhenti / Alarm Terblokir',
    description: 'Staf terhenti di meja kerja akibat kegagalan tugas, circuit breaker open, atau kill switch.',
    target_agent_ids: [
      'content_writer_primary',
      'editorial_qa_primary',
      'evidence_researcher_lead',
      'publication_dispatcher_core',
      'telemetry_observer_jev',
      'lokamedia_worker_primary'
    ],
    capabilities: [],
    workstation_key: 'department_workstation',
    visual_detail: 'Postur terhenti, lampu peringatan merah/kuning di atas workstation, badge terblokir.',
    is_work_animation: false,
    css_animation_class: 'animate-blocked-warning',
    reduced_motion_class: 'motion-reduce:animate-none',
    prop_icon: '⚠️'
  },

  OFFLINE_DISABLED: {
    animation_key: 'OFFLINE_DISABLED',
    label: 'Workstation Redup / Nonaktif Sengaja',
    description: 'Workstation dalam kondisi redup karena pekerja dinonaktifkan sengaja (misal Media Worker DISABLED).',
    target_agent_ids: [
      'lokamedia_worker_primary',
      'content_writer_primary',
      'editorial_qa_primary',
      'evidence_researcher_lead',
      'publication_dispatcher_core',
      'telemetry_observer_jev'
    ],
    capabilities: [],
    workstation_key: 'department_workstation',
    visual_detail: 'Workstation redup, layar mati, staf terlihat siaga pasif tanpa kepanikan atau alarm.',
    is_work_animation: false,
    css_animation_class: 'opacity-50',
    reduced_motion_class: 'motion-reduce:opacity-50',
    prop_icon: '💤'
  },

  UNKNOWN_NEUTRAL: {
    animation_key: 'UNKNOWN_NEUTRAL',
    label: 'Status Netral Tidak Diketahui',
    description: 'Data telemetri staf tidak mencukupi untuk menentukan animasi kerja.',
    target_agent_ids: [],
    capabilities: [],
    workstation_key: 'department_workstation',
    visual_detail: 'Workstation netral tanpa animasi atau properti kerja aktif.',
    is_work_animation: false,
    css_animation_class: '',
    reduced_motion_class: '',
    prop_icon: '❓'
  },

  WORKING_GENERIC: {
    animation_key: 'WORKING_GENERIC',
    label: 'Bekerja',
    description: 'Staf aktif bekerja pada workstation untuk tugas operasional umum.',
    target_agent_ids: [],
    capabilities: [],
    workstation_key: 'department_workstation',
    visual_detail: 'Workstation aktif, staf memproses tugas operasional terdaftar.',
    is_work_animation: true,
    css_animation_class: 'animate-working-generic',
    reduced_motion_class: 'motion-reduce:animate-none',
    prop_icon: '⚙️'
  }
};

// ============================================================================
// Helper & Lookup Functions
// ============================================================================

export function getAnimationDefinition(key: JobAnimationKey): JobAnimationDefinition {
  return JOB_ANIMATION_REGISTRY[key] || JOB_ANIMATION_REGISTRY.UNKNOWN_NEUTRAL;
}

export function getAllAnimationDefinitions(): JobAnimationDefinition[] {
  return Object.values(JOB_ANIMATION_REGISTRY);
}

export function getWorkstationKeyForAgent(agentId: string): string {
  switch (agentId) {
    case 'content_writer_primary':
      return 'editorial_writer_desk';
    case 'editorial_qa_primary':
      return 'editorial_review_desk';
    case 'evidence_researcher_lead':
      return 'research_main_desk';
    case 'lokamedia_worker_primary':
      return 'media_console';
    case 'publication_dispatcher_core':
      return 'publication_console';
    case 'telemetry_observer_jev':
      return 'operations_console';
    case 'social_distribution_operator':
      return 'social_workstation';
    default:
      return `${agentId}_workstation`;
  }
}

// Helper: Calculate timestamp freshness
export function evaluateFreshness(timestamp?: string | null): AnimationFreshness {
  if (!timestamp) return 'UNKNOWN';
  try {
    const ageMs = Date.now() - new Date(timestamp).getTime();
    if (ageMs < 0) return 'REALTIME';
    if (ageMs < 120_000) return 'REALTIME'; // < 2 mins
    if (ageMs < 600_000) return 'RECENT';   // < 10 mins
    return 'STALE';
  } catch {
    return 'UNKNOWN';
  }
}

// ============================================================================
// Master Task → Animation Derivation Logic
// ============================================================================

export function deriveStaffWorkVisualState(
  staff: StaffMemberStatus,
  snapshot: MissionControlSnapshot | null,
  activeCommands: any[] = []
): StaffWorkVisualState {
  const agentId = staff.agent_id;
  const primaryCapability = staff.capabilities && staff.capabilities[0] ? staff.capabilities[0] : 'UNKNOWN_CAPABILITY';
  const workstationKey = getWorkstationKeyForAgent(agentId);

  // --------------------------------------------------------------------------
  // Step 1: Check MC-5 Chat Command Queue (Strict Queued vs Running Distinction)
  // --------------------------------------------------------------------------
  const agentCommand = (activeCommands || []).find(
    (c: any) => c.target_agent_id === agentId && ['QUEUED', 'ACCEPTED', 'RUNNING'].includes(c.status)
  );

  if (agentCommand) {
    const cmdStatus = agentCommand.status;
    const cmdType = agentCommand.command_type || '';
    const cmdTitle = agentCommand.parameters?.article_title ||
                     agentCommand.parameters?.topic ||
                     agentCommand.parameters?.article_reference ||
                     agentCommand.normalized_intent ||
                     cmdType;

    // Rule: QUEUED / ACCEPTED commands MUST NOT show working animation
    if (cmdStatus === 'QUEUED' || cmdStatus === 'ACCEPTED') {
      return {
        agent_id: agentId,
        capability_id: primaryCapability,
        task_id: agentCommand.command_id,
        task_type: cmdType,
        task_status: cmdStatus,
        animation_key: 'IDLE_STANDBY',
        workstation_key: 'lounge',
        visual_detail: `Instruksi dalam antrean (${cmdStatus}): ${sanitizeString(cmdTitle)}. Menunggu eksekusi resmi.`,
        started_at: agentCommand.created_at || null,
        freshness: evaluateFreshness(agentCommand.created_at),
        evidence_reference: agentCommand.command_id,
        task_label: null, // No working label while queued
        is_actively_working: false
      };
    }

    // Command is RUNNING: map directly to role-specific working animation
    if (cmdStatus === 'RUNNING') {
      return resolveRunningCommandToVisualState(staff, agentCommand, workstationKey, primaryCapability, snapshot);
    }
  }

  // --------------------------------------------------------------------------
  // Step 2: Handle Terminal / Resting States (OFFLINE, BLOCKED, UNKNOWN, IDLE)
  // --------------------------------------------------------------------------

  // A. OFFLINE
  if (staff.state === 'OFFLINE') {
    // Intentional Disabled: Media Worker
    if (agentId === 'lokamedia_worker_primary') {
      return {
        agent_id: agentId,
        capability_id: 'MEDIA_OPERATIONS',
        task_id: null,
        task_type: null,
        task_status: 'DISABLED',
        animation_key: 'OFFLINE_DISABLED',
        workstation_key: workstationKey,
        visual_detail: 'Pekerja media dinonaktifkan sengaja (settings). Workstation redup, siaga non-aktif.',
        started_at: null,
        freshness: 'RECENT',
        evidence_reference: 'media_worker=DISABLED',
        task_label: null,
        is_actively_working: false
      };
    }

    // Other unexpected offline
    return {
      agent_id: agentId,
      capability_id: primaryCapability,
      task_id: null,
      task_type: null,
      task_status: 'OFFLINE',
      animation_key: 'OFFLINE_DISABLED',
      workstation_key: workstationKey,
      visual_detail: staff.state_evidence || 'Detak jantung daemon terputus.',
      started_at: null,
      freshness: 'STALE',
      evidence_reference: staff.state_evidence || null,
      task_label: null,
      is_actively_working: false
    };
  }

  // B. BLOCKED
  if (staff.state === 'BLOCKED') {
    return {
      agent_id: agentId,
      capability_id: primaryCapability,
      task_id: staff.current_task?.current_task_id || null,
      task_type: 'BLOCKED_TASK',
      task_status: 'BLOCKED',
      animation_key: 'BLOCKED_WARNING',
      workstation_key: workstationKey,
      visual_detail: staff.state_evidence || 'Workstation terhenti oleh kendala teknis atau pemutus sirkuit.',
      started_at: staff.current_task?.current_task_updated_at || null,
      freshness: evaluateFreshness(staff.current_task?.current_task_updated_at),
      evidence_reference: staff.state_evidence || null,
      task_label: staff.current_task ? `Terblokir: ${staff.current_task.current_task_title}` : 'Terblokir',
      is_actively_working: false
    };
  }

  // C. UNKNOWN
  if (staff.state === 'UNKNOWN') {
    return {
      agent_id: agentId,
      capability_id: primaryCapability,
      task_id: null,
      task_type: null,
      task_status: 'UNKNOWN',
      animation_key: 'UNKNOWN_NEUTRAL',
      workstation_key: workstationKey,
      visual_detail: 'Telemetri operasional staf belum mencukupi (UNKNOWN).',
      started_at: null,
      freshness: 'UNKNOWN',
      evidence_reference: null,
      task_label: null,
      is_actively_working: false
    };
  }

  // D. IDLE
  if (staff.state === 'IDLE') {
    return {
      agent_id: agentId,
      capability_id: primaryCapability,
      task_id: null,
      task_type: null,
      task_status: 'IDLE',
      animation_key: 'IDLE_STANDBY',
      workstation_key: 'lounge',
      visual_detail: 'Siaga operasional di Lounge; tidak ada tugas aktif berjalan.',
      started_at: null,
      freshness: 'RECENT',
      evidence_reference: 'automation_mode=OFF / no active tasks',
      task_label: null,
      is_actively_working: false
    };
  }

  // --------------------------------------------------------------------------
  // Step 3: WORKING or REVIEWING — Derive from Genuine Current Task
  // --------------------------------------------------------------------------
  const currentTask = staff.current_task;

  // Strict Invariant: No real task = no working animation
  if (!currentTask) {
    return {
      agent_id: agentId,
      capability_id: primaryCapability,
      task_id: null,
      task_type: null,
      task_status: staff.state,
      animation_key: 'IDLE_STANDBY',
      workstation_key: 'lounge',
      visual_detail: 'Siaga operasional; tidak ada tugas aktif yang tercatat.',
      started_at: null,
      freshness: 'RECENT',
      evidence_reference: null,
      task_label: null,
      is_actively_working: false
    };
  }

  // Staff has a genuine current task; resolve role animation
  return resolveTaskToVisualState(staff, currentTask, workstationKey, primaryCapability, snapshot);
}

// ----------------------------------------------------------------------------
// Internal Helper: Resolve Running Operator Command
// ----------------------------------------------------------------------------
function resolveRunningCommandToVisualState(
  staff: StaffMemberStatus,
  cmd: any,
  workstationKey: string,
  primaryCapability: string,
  snapshot: MissionControlSnapshot | null
): StaffWorkVisualState {
  const agentId = staff.agent_id;
  const cmdType = (cmd.command_type || '').toUpperCase();
  const cmdTitle = cmd.parameters?.article_title ||
                   cmd.parameters?.topic ||
                   cmd.parameters?.article_reference ||
                   cmd.normalized_intent ||
                   cmd.command_type;

  let animKey: JobAnimationKey = 'WORKING_GENERIC';
  let taskLabel: string | null = `Tugas: ${cmdTitle}`;
  let isWorking = true;

  switch (agentId) {
    case 'content_writer_primary': {
      if (cmdType.includes('REWRITE')) {
        animKey = 'ARTICLE_REWRITE';
        taskLabel = `Revisi: ${cmdTitle}`;
      } else {
        animKey = 'ARTICLE_TYPING';
        taskLabel = `Menulis: ${cmdTitle}`;
      }
      break;
    }

    case 'evidence_researcher_lead': {
      if (cmdType.includes('CITATION') || cmdType.includes('GAP')) {
        animKey = 'EVIDENCE_READING';
        taskLabel = `Cek sitasi: ${cmdTitle}`;
      } else {
        animKey = 'RESEARCH_BROWSING';
        taskLabel = `Riset evidence: ${cmdTitle}`;
      }
      break;
    }

    case 'editorial_qa_primary': {
      if (cmdType.includes('VALIDATION') || cmdType.includes('READINESS')) {
        animKey = 'QA_CHECKLIST';
        taskLabel = `Checklist QA: ${cmdTitle}`;
      } else {
        animKey = 'QA_REVIEW';
        taskLabel = `QA: ${cmdTitle}`;
      }
      break;
    }

    case 'lokamedia_worker_primary': {
      // Invariant: Media worker DISABLED prevents working animation
      const isMediaDisabled = snapshot?.health?.mediaWorker?.effectiveState === 'DISABLED';
      if (isMediaDisabled) {
        animKey = 'OFFLINE_DISABLED';
        taskLabel = null;
        isWorking = false;
      } else if (cmdType.includes('REVIEW')) {
        animKey = 'MEDIA_REVIEW';
        taskLabel = `Review visual: ${cmdTitle}`;
      } else {
        animKey = 'MEDIA_PROCESSING';
        taskLabel = `Proses media: ${cmdTitle}`;
      }
      break;
    }

    case 'publication_dispatcher_core': {
      // Invariant: Automation OFF prevents publication dispatch
      const isAutoOff = snapshot?.health?.automation?.mode === 'OFF';
      if (isAutoOff) {
        animKey = 'PUBLICATION_MONITORING';
        taskLabel = `Pantau jadwal: ${cmdTitle}`;
      } else {
        animKey = 'PUBLICATION_DISPATCH';
        taskLabel = `Dispatch: ${cmdTitle}`;
      }
      break;
    }

    case 'telemetry_observer_jev': {
      if (cmdType.includes('JEV')) {
        animKey = 'JEV_ANALYSIS';
        taskLabel = `Evaluasi JEV: ${cmdTitle}`;
      } else {
        animKey = 'TELEMETRY_MONITORING';
        taskLabel = `Monitoring: ${cmdTitle}`;
      }
      break;
    }

    case 'social_distribution_operator': {
      if (cmdType.includes('REVIEW') || cmdType.includes('CAROUSEL')) {
        animKey = 'MEDIA_REVIEW';
        taskLabel = `Review visual: ${cmdTitle}`;
      } else if (cmdType.includes('QA')) {
        animKey = 'QA_REVIEW';
        taskLabel = `QA format: ${cmdTitle}`;
      } else if (cmdType.includes('SCHEDULE') || cmdType.includes('OUTBOX')) {
        animKey = 'PUBLICATION_MONITORING';
        taskLabel = `Pantau outbox: ${cmdTitle}`;
      } else {
        animKey = 'ARTICLE_TYPING';
        taskLabel = `Draf medsos: ${cmdTitle}`;
      }
      break;
    }
  }

  const animDef = getAnimationDefinition(animKey);

  return {
    agent_id: agentId,
    capability_id: primaryCapability,
    task_id: cmd.command_id,
    task_type: cmd.command_type,
    task_status: 'RUNNING',
    animation_key: animKey,
    workstation_key: workstationKey,
    visual_detail: animDef.visual_detail,
    started_at: cmd.started_at || cmd.created_at || null,
    freshness: evaluateFreshness(cmd.started_at || cmd.created_at),
    evidence_reference: cmd.command_id,
    task_label: taskLabel,
    is_actively_working: isWorking
  };
}

// ----------------------------------------------------------------------------
// Internal Helper: Resolve Pipeline / Snapshot Task
// ----------------------------------------------------------------------------
function resolveTaskToVisualState(
  staff: StaffMemberStatus,
  task: any,
  workstationKey: string,
  primaryCapability: string,
  snapshot: MissionControlSnapshot | null
): StaffWorkVisualState {
  const agentId = staff.agent_id;
  const taskStatus = (task.current_task_status || '').toUpperCase();
  const taskTitle = task.current_task_title || 'Tugas Tanpa Judul';

  let animKey: JobAnimationKey = 'WORKING_GENERIC';
  let taskLabel: string | null = `Tugas: ${taskTitle}`;
  let isWorking = true;

  switch (agentId) {
    case 'content_writer_primary': {
      const lowerTitle = taskTitle.toLowerCase();
      if (lowerTitle.includes('revisi') || lowerTitle.includes('rewrite') || lowerTitle.includes('tulis ulang')) {
        animKey = 'ARTICLE_REWRITE';
        taskLabel = `Revisi: ${taskTitle}`;
      } else {
        animKey = 'ARTICLE_TYPING';
        taskLabel = `Menulis: ${taskTitle}`;
      }
      break;
    }

    case 'evidence_researcher_lead': {
      const lowerTitle = taskTitle.toLowerCase();
      if (lowerTitle.includes('sitasi') || lowerTitle.includes('citation') || lowerTitle.includes('cek sni')) {
        animKey = 'EVIDENCE_READING';
        taskLabel = `Cek sitasi: ${taskTitle}`;
      } else {
        animKey = 'RESEARCH_BROWSING';
        taskLabel = `Riset evidence: ${taskTitle}`;
      }
      break;
    }

    case 'editorial_qa_primary': {
      if (taskStatus === 'VALIDATING' || taskTitle.toLowerCase().includes('checklist') || taskTitle.toLowerCase().includes('gate')) {
        animKey = 'QA_CHECKLIST';
        taskLabel = `Checklist QA: ${taskTitle}`;
      } else {
        animKey = 'QA_REVIEW';
        taskLabel = `QA: ${taskTitle}`;
      }
      break;
    }

    case 'lokamedia_worker_primary': {
      // Invariant: Media worker DISABLED prevents working animation
      const isMediaDisabled = snapshot?.health?.mediaWorker?.effectiveState === 'DISABLED';
      if (isMediaDisabled) {
        animKey = 'OFFLINE_DISABLED';
        taskLabel = null;
        isWorking = false;
      } else if (['GENERATING', 'IN_PROGRESS', 'LEASED'].includes(taskStatus)) {
        animKey = 'MEDIA_PROCESSING';
        taskLabel = `Proses media: ${taskTitle}`;
      } else {
        animKey = 'MEDIA_REVIEW';
        taskLabel = `Review media: ${taskTitle}`;
      }
      break;
    }

    case 'publication_dispatcher_core': {
      // Invariant: Automation OFF prevents PUBLICATION_DISPATCH
      const isAutoOff = snapshot?.health?.automation?.mode === 'OFF';
      if (isAutoOff) {
        animKey = 'PUBLICATION_MONITORING';
        taskLabel = `Pantau jadwal: ${taskTitle}`;
      } else if (taskStatus === 'INGESTING' || taskStatus === 'RUNNING') {
        animKey = 'PUBLICATION_DISPATCH';
        taskLabel = `Dispatch: ${taskTitle}`;
      } else {
        animKey = 'PUBLICATION_MONITORING';
        taskLabel = `Pantau jadwal: ${taskTitle}`;
      }
      break;
    }

    case 'telemetry_observer_jev': {
      // JEV shadow mode: active observation vs general telemetry monitoring
      if (taskStatus === 'SHADOW_EVALUATING' || taskTitle.toLowerCase().includes('shadow') || taskTitle.toLowerCase().includes('jev')) {
        animKey = 'JEV_ANALYSIS';
        taskLabel = `Evaluasi JEV: ${taskTitle}`;
      } else {
        animKey = 'TELEMETRY_MONITORING';
        taskLabel = `Monitoring: ${taskTitle}`;
      }
      break;
    }

    case 'social_distribution_operator': {
      const lowerTitle = taskTitle.toLowerCase();
      if (taskStatus === 'BLOCKED' || lowerTitle.includes('terblokir') || lowerTitle.includes('failed')) {
        animKey = 'BLOCKED_WARNING';
        taskLabel = `Terblokir: ${taskTitle}`;
        isWorking = false;
      } else if (taskStatus === 'REVIEWING' || lowerTitle.includes('qa') || lowerTitle.includes('peninjauan')) {
        animKey = 'QA_REVIEW';
        taskLabel = `QA Medsos: ${taskTitle}`;
      } else if (lowerTitle.includes('carousel') || lowerTitle.includes('visual') || lowerTitle.includes('foto')) {
        animKey = 'MEDIA_REVIEW';
        taskLabel = `Kurasi Carousel: ${taskTitle}`;
      } else if (lowerTitle.includes('jadwal') || lowerTitle.includes('outbox') || lowerTitle.includes('schedule')) {
        animKey = 'PUBLICATION_MONITORING';
        taskLabel = `Pantau Jadwal: ${taskTitle}`;
      } else {
        animKey = 'ARTICLE_TYPING';
        taskLabel = `Penulisan Copy: ${taskTitle}`;
      }
      break;
    }

    default: {
      animKey = 'WORKING_GENERIC';
      taskLabel = `Bekerja: ${taskTitle}`;
      break;
    }
  }

  const animDef = getAnimationDefinition(animKey);

  return {
    agent_id: agentId,
    capability_id: primaryCapability,
    task_id: task.current_task_id || null,
    task_type: task.current_task_status || null,
    task_status: taskStatus,
    animation_key: animKey,
    workstation_key: workstationKey,
    visual_detail: animDef.visual_detail,
    started_at: task.current_task_updated_at || null,
    freshness: evaluateFreshness(task.current_task_updated_at),
    evidence_reference: task.current_task_id || null,
    task_label: taskLabel,
    is_actively_working: isWorking
  };
}
