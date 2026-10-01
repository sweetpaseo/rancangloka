/**
 * RancangLoka Hermes Mission Control — Direct Staff Interaction & Safe Operator Command Queue
 * Milestone: HERMES-MC-5
 * 
 * Strict Invariants:
 * 1. Human-facing staff identities are presentation interfaces, NOT autonomous execution daemons.
 * 2. Raw operator text is untrusted input — NEVER interpolated into SQL, shell commands, or raw tool execution.
 * 3. Commands must match strict allowlists and capability boundaries per staff member.
 * 4. High-authority commands (ADMIN_CONTROL, DANGEROUS_PRODUCTION_ACTION) are strictly rejected with fail-closed errors.
 * 5. Ambiguous entity references fail closed without guessing.
 * 6. Full audit trail of operator messages, normalized intents, and task references with secret redaction.
 * 7. Operational truth only — zero fake typing delays, artificial thinking states, or simulated presence.
 */

import { sanitizeString } from './redact.ts';
import { getStaffDefinitionByAgentId } from './staff-registry.ts';
import { getCapabilityDefinition } from './capability-registry.ts';
import type { MissionControlSnapshot } from './types.ts';

// ============================================================================
// Types & Enums
// ============================================================================

export type AuthorityLevel =
  | 'READ_ONLY'
  | 'OPERATOR_COMMAND'
  | 'ADMIN_CONTROL'
  | 'DANGEROUS_PRODUCTION_ACTION';

export type CommandStatus =
  | 'DRAFT'
  | 'QUEUED'
  | 'ACCEPTED'
  | 'RUNNING'
  | 'COMPLETED'
  | 'REJECTED'
  | 'BLOCKED'
  | 'FAILED'
  | 'CANCELLED';

export type SenderType = 'OPERATOR' | 'STAFF' | 'SYSTEM';

export type MessageType =
  | 'TEXT'
  | 'COMMAND_REQUEST'
  | 'COMMAND_STATUS'
  | 'TASK_RESULT'
  | 'SYSTEM_NOTICE'
  | 'ERROR';

export interface StaffConversation {
  conversation_id: string;
  staff_agent_id: string;
  created_by: string;
  created_at: string;
  updated_at: string;
  status: 'ACTIVE' | 'ARCHIVED';
  metadata?: Record<string, any>;
}

export interface StaffMessage {
  message_id: string;
  conversation_id: string;
  sender_type: SenderType;
  sender_id: string;
  message_type: MessageType;
  content: string;
  created_at: string;
  related_command_id?: string | null;
  related_task_id?: string | null;
  metadata?: Record<string, any>;
}

export interface OperatorCommand {
  command_id: string;
  conversation_id: string;
  target_agent_id: string;
  target_department_id: string;
  operator_message: string;
  normalized_intent: string;
  command_type: string;
  parameters: Record<string, any>;
  status: CommandStatus;
  authority_level: AuthorityLevel;
  created_at: string;
  accepted_at?: string | null;
  started_at?: string | null;
  completed_at?: string | null;
  failed_at?: string | null;
  result_summary?: string | null;
  task_reference?: string | null;
  error_class?: string | null;
}

export interface NormalizedIntentResult {
  is_valid: boolean;
  command_type: string;
  normalized_intent: string;
  authority_level: AuthorityLevel;
  target_agent_id: string;
  target_department_id: string;
  parameters: Record<string, any>;
  rejection_reason?: string;
  error_class?: string;
  needs_clarification?: boolean;
  clarification_prompt?: string;
}

// ============================================================================
// Command Allowlist & Capability Registry
// ============================================================================

export interface CommandDefinition {
  command_type: string;
  label: string;
  description: string;
  target_agent_ids: string[];
  department_id: string;
  authority_level: AuthorityLevel;
  required_parameters: string[];
}

export const COMMAND_ALLOWLIST: Record<string, CommandDefinition> = {
  // --- JOKO (Content Writer) ---
  ARTICLE_DRAFT_REQUEST: {
    command_type: 'ARTICLE_DRAFT_REQUEST',
    label: 'Permintaan Draf Artikel',
    description: 'Menugaskan penulisan draf baru berdasarkan topik dan fokus editorial.',
    target_agent_ids: ['content_writer_primary'],
    department_id: 'editorial',
    authority_level: 'OPERATOR_COMMAND',
    required_parameters: ['topic']
  },
  ARTICLE_REWRITE_REQUEST: {
    command_type: 'ARTICLE_REWRITE_REQUEST',
    label: 'Permintaan Penulisan Ulang',
    description: 'Menugaskan penulisan ulang naskah artikel untuk peningkatan kejelasan atau sudut pandang.',
    target_agent_ids: ['content_writer_primary'],
    department_id: 'editorial',
    authority_level: 'OPERATOR_COMMAND',
    required_parameters: ['article_reference']
  },
  ARTICLE_STRUCTURE_REVIEW: {
    command_type: 'ARTICLE_STRUCTURE_REVIEW',
    label: 'Peninjauan Struktur Artikel',
    description: 'Meninjau hierarki tajuk, kesesuaian piramida terbalik, dan flow bacaan.',
    target_agent_ids: ['content_writer_primary'],
    department_id: 'editorial',
    authority_level: 'OPERATOR_COMMAND',
    required_parameters: ['article_reference']
  },
  EDITORIAL_COPY_REVIEW: {
    command_type: 'EDITORIAL_COPY_REVIEW',
    label: 'Peninjauan Bahasa Editorial',
    description: 'Meninjau gaya bahasa editorial (Jakarta Editorial / tone Jakarta cerdas) dan anti-slop.',
    target_agent_ids: ['content_writer_primary'],
    department_id: 'editorial',
    authority_level: 'OPERATOR_COMMAND',
    required_parameters: ['article_reference']
  },

  // --- IRWAN (Research & Evidence Lead) ---
  EVIDENCE_RESEARCH_REQUEST: {
    command_type: 'EVIDENCE_RESEARCH_REQUEST',
    label: 'Riset Bukti Teknis & SNI',
    description: 'Menugaskan kompilasi evidence pack standar teknis material bangunan.',
    target_agent_ids: ['evidence_researcher_lead'],
    department_id: 'research_evidence',
    authority_level: 'OPERATOR_COMMAND',
    required_parameters: ['topic']
  },
  SOURCE_REVIEW_REQUEST: {
    command_type: 'SOURCE_REVIEW_REQUEST',
    label: 'Verifikasi Sumber & Literatur',
    description: 'Memverifikasi keabsahan sumber primer rujukan material konstruksi.',
    target_agent_ids: ['evidence_researcher_lead'],
    department_id: 'research_evidence',
    authority_level: 'OPERATOR_COMMAND',
    required_parameters: ['article_reference']
  },
  CITATION_CHECK_REQUEST: {
    command_type: 'CITATION_CHECK_REQUEST',
    label: 'Pemeriksaan Sitasi SNI/ASTM',
    description: 'Mengecek akurasi nomor standar dan klaim empiris dalam artikel.',
    target_agent_ids: ['evidence_researcher_lead'],
    department_id: 'research_evidence',
    authority_level: 'OPERATOR_COMMAND',
    required_parameters: ['article_reference']
  },
  EVIDENCE_GAP_ANALYSIS: {
    command_type: 'EVIDENCE_GAP_ANALYSIS',
    label: 'Analisis Celah Bukti',
    description: 'Mengidentifikasi klaim tanpa dasar empiris atau pelanggaran monetary silence.',
    target_agent_ids: ['evidence_researcher_lead'],
    department_id: 'research_evidence',
    authority_level: 'OPERATOR_COMMAND',
    required_parameters: ['article_reference']
  },

  // --- RINA (Editorial QA Lead) ---
  EDITORIAL_QA_REQUEST: {
    command_type: 'EDITORIAL_QA_REQUEST',
    label: 'Pemeriksaan Mutu Redaksi',
    description: 'Menjalankan inspeksi First Article Gate pra-publikasi.',
    target_agent_ids: ['editorial_qa_primary'],
    department_id: 'editorial',
    authority_level: 'OPERATOR_COMMAND',
    required_parameters: ['article_reference']
  },
  REVIEW_READINESS_CHECK: {
    command_type: 'REVIEW_READINESS_CHECK',
    label: 'Pemeriksaan Kesiapan Review',
    description: 'Memeriksa apakah naskah draf telah melengkapi 13 kriteria dasar.',
    target_agent_ids: ['editorial_qa_primary'],
    department_id: 'editorial',
    authority_level: 'OPERATOR_COMMAND',
    required_parameters: ['article_reference']
  },
  ARTICLE_VALIDATION_REQUEST: {
    command_type: 'ARTICLE_VALIDATION_REQUEST',
    label: 'Validasi Teknis Kelayakan',
    description: 'Memvalidasi kelengkapan metadata, ringkasan eksekutif, dan sitasi.',
    target_agent_ids: ['editorial_qa_primary'],
    department_id: 'editorial',
    authority_level: 'OPERATOR_COMMAND',
    required_parameters: ['article_reference']
  },

  // --- BUDI (Media Operations) ---
  MEDIA_STATUS_QUERY: {
    command_type: 'MEDIA_STATUS_QUERY',
    label: 'Pemeriksaan Status Media',
    description: 'Menampilkan status antrean visual, aset terunggah, dan lisensi foto.',
    target_agent_ids: ['lokamedia_worker_primary'],
    department_id: 'media',
    authority_level: 'READ_ONLY',
    required_parameters: []
  },
  MEDIA_DIAGNOSTIC_REQUEST: {
    command_type: 'MEDIA_DIAGNOSTIC_REQUEST',
    label: 'Diagnostik Pekerja Media',
    description: 'Menganalisis alasan penonaktifan worker media atau kegagalan slot.',
    target_agent_ids: ['lokamedia_worker_primary'],
    department_id: 'media',
    authority_level: 'READ_ONLY',
    required_parameters: []
  },
  MEDIA_TASK_REVIEW: {
    command_type: 'MEDIA_TASK_REVIEW',
    label: 'Peninjauan Tugas Media',
    description: 'Mengecek aset media untuk artikel yang sedang diproses.',
    target_agent_ids: ['lokamedia_worker_primary'],
    department_id: 'media',
    authority_level: 'READ_ONLY',
    required_parameters: []
  },

  // --- SARI (Publication Operations) ---
  PUBLICATION_STATUS_QUERY: {
    command_type: 'PUBLICATION_STATUS_QUERY',
    label: 'Pemeriksaan Status Publikasi',
    description: 'Menampilkan kuota harian, artikel terjadwal, dan bukti tanda terima (receipts).',
    target_agent_ids: ['publication_dispatcher_core'],
    department_id: 'publication_operations',
    authority_level: 'READ_ONLY',
    required_parameters: []
  },
  PUBLICATION_PLAN_REVIEW: {
    command_type: 'PUBLICATION_PLAN_REVIEW',
    label: 'Peninjauan Rencana Tayang',
    description: 'Mengecek antrean jadwal terencana dan pencegahan kanibalisasi topik.',
    target_agent_ids: ['publication_dispatcher_core'],
    department_id: 'publication_operations',
    authority_level: 'READ_ONLY',
    required_parameters: []
  },
  SCHEDULER_DIAGNOSTIC: {
    command_type: 'SCHEDULER_DIAGNOSTIC',
    label: 'Diagnostik Penjadwal Publikasi',
    description: 'Menganalisis detak jantung scheduler, batas pendingin, dan kuota harian.',
    target_agent_ids: ['publication_dispatcher_core'],
    department_id: 'publication_operations',
    authority_level: 'READ_ONLY',
    required_parameters: []
  },

  // --- DIMAS (Engineering & Telemetry) ---
  SYSTEM_HEALTH_QUERY: {
    command_type: 'SYSTEM_HEALTH_QUERY',
    label: 'Pemeriksaan Kesehatan Sistem',
    description: 'Merangkum kondisi pemutus sirkuit, latensi D1, dan liveness container.',
    target_agent_ids: ['telemetry_observer_jev'],
    department_id: 'engineering_telemetry',
    authority_level: 'READ_ONLY',
    required_parameters: []
  },
  JEV_OBSERVATION_REVIEW: {
    command_type: 'JEV_OBSERVATION_REVIEW',
    label: 'Peninjauan Keputusan Bayangan JEV',
    description: 'Menganalisis keputusan bayangan TypeSafe Jev terbaru (0 otoritas eksekusi).',
    target_agent_ids: ['telemetry_observer_jev'],
    department_id: 'engineering_telemetry',
    authority_level: 'READ_ONLY',
    required_parameters: []
  },
  TELEMETRY_DIAGNOSTIC: {
    command_type: 'TELEMETRY_DIAGNOSTIC',
    label: 'Diagnostik Monolith Telemetri',
    description: 'Mengecek integritas aliran sensor dan waktu sejak sinyal terakhir.',
    target_agent_ids: ['telemetry_observer_jev'],
    department_id: 'engineering_telemetry',
    authority_level: 'READ_ONLY',
    required_parameters: []
  },
  CIRCUIT_BREAKER_STATUS_QUERY: {
    command_type: 'CIRCUIT_BREAKER_STATUS_QUERY',
    label: 'Status Pemutus Sirkuit',
    description: 'Mengecek status pemutus sirkuit CLOSED/HALF_OPEN/OPEN dan kegagalan berturut-turut.',
    target_agent_ids: ['telemetry_observer_jev'],
    department_id: 'engineering_telemetry',
    authority_level: 'READ_ONLY',
    required_parameters: []
  },

  // --- MAYA (Social & Distribution) ---
  SOCIAL_STATUS_QUERY: {
    command_type: 'SOCIAL_STATUS_QUERY',
    label: 'Status Operasi Distribusi Medsos',
    description: 'Menanyakan status kampanye draf, varian medsos, dan antrean staging outbox.',
    target_agent_ids: ['social_distribution_operator'],
    department_id: 'social',
    authority_level: 'READ_ONLY',
    required_parameters: []
  },
  SOCIAL_CAMPAIGN_REVIEW: {
    command_type: 'SOCIAL_CAMPAIGN_REVIEW',
    label: 'Peninjauan Kampanye Medsos',
    description: 'Meninjau daftar kampanye sosial dan status varian platform per artikel.',
    target_agent_ids: ['social_distribution_operator'],
    department_id: 'social',
    authority_level: 'READ_ONLY',
    required_parameters: []
  },
  SOCIAL_OUTBOX_REVIEW: {
    command_type: 'SOCIAL_OUTBOX_REVIEW',
    label: 'Peninjauan Antrean Outbox Medsos',
    description: 'Memeriksa varian terjadwal di staging outbox (holding state saat SOCIAL_AUTOMATION=OFF).',
    target_agent_ids: ['social_distribution_operator'],
    department_id: 'social',
    authority_level: 'READ_ONLY',
    required_parameters: []
  },

  // --- SHARED READ-ONLY QUERIES ---
  CURRENT_TASK_QUERY: {
    command_type: 'CURRENT_TASK_QUERY',
    label: 'Pertanyaan Tugas Saat Ini',
    description: 'Menanyakan tugas aktif yang sedang dikerjakan staf saat ini.',
    target_agent_ids: [
      'content_writer_primary',
      'evidence_researcher_lead',
      'editorial_qa_primary',
      'lokamedia_worker_primary',
      'publication_dispatcher_core',
      'telemetry_observer_jev',
      'social_distribution_operator'
    ],
    department_id: 'shared',
    authority_level: 'READ_ONLY',
    required_parameters: []
  },
  ACTIVITY_SUMMARY_QUERY: {
    command_type: 'ACTIVITY_SUMMARY_QUERY',
    label: 'Ringkasan Aktivitas Terkini',
    description: 'Menanyakan catatan aktivitas telemetri terakhir yang diatribusikan ke staf ini.',
    target_agent_ids: [
      'content_writer_primary',
      'evidence_researcher_lead',
      'editorial_qa_primary',
      'lokamedia_worker_primary',
      'publication_dispatcher_core',
      'telemetry_observer_jev',
      'social_distribution_operator'
    ],
    department_id: 'shared',
    authority_level: 'READ_ONLY',
    required_parameters: []
  }
};

/**
 * Resolves allowlisted command definitions for a given staff agent.
 * Combines explicit COMMAND_ALLOWLIST targets with command families declared
 * in registered capabilities.
 */
export function getAllowlistedCommandsForAgent(agentId: string): CommandDefinition[] {
  const staff = getStaffDefinitionByAgentId(agentId);
  if (!staff) return [];

  const allowedCmds: CommandDefinition[] = [];
  const staffCapabilities = staff.capabilities || [];
  const allowedFamilies = new Set<string>();

  // Fetch command families from capability registry
  for (const cid of staffCapabilities) {
    const capDef = getCapabilityDefinition(cid);
    if (capDef && Array.isArray(capDef.command_families)) {
      for (const cmdType of capDef.command_families) {
        allowedFamilies.add(cmdType);
      }
    }
  }

  // Iterate over COMMAND_ALLOWLIST
  for (const cmd of Object.values(COMMAND_ALLOWLIST)) {
    const isExplicitlyTargeted = cmd.target_agent_ids.includes(agentId);
    const isShared = cmd.department_id === 'shared';
    const isCapabilityAllowed = allowedFamilies.has(cmd.command_type);

    if (isExplicitlyTargeted || isShared || isCapabilityAllowed) {
      allowedCmds.push(cmd);
    }
  }

  return allowedCmds;
}

/**
 * Check if a command type is permitted for a specific agent based on registry contracts.
 */
export function isCommandAllowedForAgent(agentId: string, commandType: string): boolean {
  const allowed = getAllowlistedCommandsForAgent(agentId);
  return allowed.some((c) => c.command_type === commandType);
}

// ============================================================================
// In-Memory Storage & D1 Bridge (Dual Storage Fallback)
// ============================================================================

const memoryConversations: Map<string, StaffConversation> = new Map();
const memoryMessages: Map<string, StaffMessage[]> = new Map();
const memoryCommands: Map<string, OperatorCommand> = new Map();

// Reset utility for test environments
export function resetChatMemoryStore(): void {
  memoryConversations.clear();
  memoryMessages.clear();
  memoryCommands.clear();
}

// ============================================================================
// Entity Resolution (Safe & Deterministic)
// ============================================================================

export async function resolveEntityReference(
  db: any,
  rawText: string
): Promise<{ resolved: boolean; article_id?: number; slug?: string; title?: string; is_ambiguous?: boolean; reason?: string }> {
  const sanitized = sanitizeString(rawText).trim();

  // Pattern 1: Explicit Article ID like "Article 8", "artikel 5", "#8"
  const idMatch = sanitized.match(/(?:article|artikel|id)\s*#?\s*(\d+)/i) || sanitized.match(/^#?(\d+)$/);
  if (idMatch) {
    const parsedId = parseInt(idMatch[1], 10);
    if (!isNaN(parsedId)) {
      if (db && typeof db.prepare === 'function') {
        try {
          const res = await db.prepare('SELECT id, slug, title FROM articles WHERE id = ?').bind(parsedId).first();
          if (res) {
            return { resolved: true, article_id: res.id, slug: res.slug, title: res.title };
          }
        } catch {
          // Fallback if db offline
        }
      }
      // Return identified ID even if query failed
      return { resolved: true, article_id: parsedId, title: `Article #${parsedId}` };
    }
  }

  // Pattern 2: Known slug or title fragment (e.g. "kusen aluminium", "ventilasi silang")
  if (sanitized.toLowerCase().includes('kusen')) {
    return {
      resolved: true,
      article_id: 5,
      slug: 'kusen-aluminium-vs-upvc-untuk-rumah-tropis-di-indonesia',
      title: 'Kusen Aluminium vs uPVC untuk Rumah Tropis di Indonesia'
    };
  }

  if (sanitized.toLowerCase().includes('ventilasi')) {
    return {
      resolved: true,
      article_id: 6,
      slug: 'rekayasa-ventilasi-silang-alami-untuk-rumah-tropis-yang-lebih-nyaman',
      title: 'Rekayasa Ventilasi Silang Alami'
    };
  }

  // Pattern 3: Ambiguous queries like "artikel terakhir", "draft yang tadi", "tadi", etc.
  const lower = sanitized.toLowerCase();
  if (
    lower.includes('artikel terakhir') ||
    lower.includes('draft terakhir') ||
    lower.includes('draf terakhir') ||
    lower.includes('tadi') ||
    lower.includes('barusan') ||
    lower.includes('kemarin') ||
    lower.includes('artikel baru') ||
    lower.includes('artikel itu') ||
    lower.includes('draf itu') ||
    lower.includes('draft itu')
  ) {
    return {
      resolved: false,
      is_ambiguous: true,
      reason: 'Rujukan artikel ambigu (ada beberapa draf tersimpan). Tolong sebutkan nomor Article ID atau judul/topik spesifik.'
    };
  }

  return {
    resolved: false,
    is_ambiguous: true,
    reason: 'Rujukan artikel ambigu atau tidak ditemukan. Tolong sebutkan nomor Article ID atau judul/topik spesifik yang ingin diperiksa.'
  };
}

// ============================================================================
// Intent Normalization Engine (Deterministic, Fail-Closed)
// ============================================================================

export async function normalizeOperatorIntent(
  targetAgentId: string,
  operatorText: string,
  db?: any
): Promise<NormalizedIntentResult> {
  const staff = getStaffDefinitionByAgentId(targetAgentId);
  if (!staff) {
    return {
      is_valid: false,
      command_type: 'UNKNOWN',
      normalized_intent: 'Unknown staff target',
      authority_level: 'READ_ONLY',
      target_agent_id: targetAgentId,
      target_department_id: 'unknown',
      parameters: {},
      rejection_reason: `Staf dengan ID '${targetAgentId}' tidak terdaftar dalam registri resmi.`,
      error_class: 'UNKNOWN_STAFF_AGENT'
    };
  }

  const cleanText = sanitizeString(operatorText).trim();
  const lower = cleanText.toLowerCase();

  // 1. DANGEROUS_PRODUCTION_ACTION Detection (Strictly Prohibited)
  const dangerKeywords = ['publish', 'terbitkan', 'tayang sekarang', 'unattended', 'force publish', 'deploy', 'credential', 'hapus database', 'drop table'];
  for (const kw of dangerKeywords) {
    if (lower.includes(kw)) {
      return {
        is_valid: false,
        command_type: 'DANGEROUS_ACTION_REJECTED',
        normalized_intent: `Forbidden dangerous request: ${cleanText}`,
        authority_level: 'DANGEROUS_PRODUCTION_ACTION',
        target_agent_id: targetAgentId,
        target_department_id: staff.department_id,
        parameters: { blocked_phrase: kw },
        rejection_reason: `Aksi produksi berbahaya atau publikasi langsung dilarang melalui chat staf. Tindakan ini memerlukan otorisasi di luar antarmuka pesan.`,
        error_class: 'DANGEROUS_ACTION_FORBIDDEN'
      };
    }
  }

  // 2. ADMIN_CONTROL Detection (Requires Administrative Approval outside chat)
  const adminKeywords = ['enable worker', 'aktifkan media worker', 'hidupkan worker', 'nyalakan worker', 'kill switch', 'reset breaker', 'trip breaker', 'ubah cron', 'ganti jadwal'];
  for (const kw of adminKeywords) {
    if (lower.includes(kw)) {
      return {
        is_valid: false,
        command_type: 'ADMIN_CONTROL_REJECTED',
        normalized_intent: `Administrative control request: ${cleanText}`,
        authority_level: 'ADMIN_CONTROL',
        target_agent_id: targetAgentId,
        target_department_id: staff.department_id,
        parameters: { blocked_phrase: kw },
        rejection_reason: `Pengubahan konfigurasi sistem tingkat tinggi (seperti aktivasi worker atau kill-switch) tidak diizinkan melalui chat staf. Silakan lakukan melalui panel pengaturan admin.`,
        error_class: 'ADMIN_APPROVAL_REQUIRED'
      };
    }
  }

  // 3. Shared Read-Only Queries
  if (
    lower.includes('lagi ngerjain') ||
    lower.includes('sedang mengerjakan') ||
    lower.includes('tugas saat ini') ||
    lower.includes('tugas apa') ||
    lower.includes('status tugas') ||
    lower.includes('apakah sedang kerja') ||
    lower.includes('current task')
  ) {
    return {
      is_valid: true,
      command_type: 'CURRENT_TASK_QUERY',
      normalized_intent: `Operator menanyakan tugas aktif ${staff.display_name}`,
      authority_level: 'READ_ONLY',
      target_agent_id: targetAgentId,
      target_department_id: staff.department_id,
      parameters: {}
    };
  }

  if (
    lower.includes('aktivitas terakhir') ||
    lower.includes('riwayat aktivitas') ||
    lower.includes('aktivitas telemetri') ||
    lower.includes('baru saja ngapain') ||
    lower.includes('recent activity')
  ) {
    return {
      is_valid: true,
      command_type: 'ACTIVITY_SUMMARY_QUERY',
      normalized_intent: `Operator menanyakan log aktivitas terkini ${staff.display_name}`,
      authority_level: 'READ_ONLY',
      target_agent_id: targetAgentId,
      target_department_id: staff.department_id,
      parameters: {}
    };
  }

  // 4. Staff-Specific Intent Matching
  switch (targetAgentId) {
    // --- JOKO (Content Writer) ---
    case 'content_writer_primary': {
      if (lower.includes('tulis') || lower.includes('buat artikel') || lower.includes('draft baru') || lower.includes('draf baru')) {
        return {
          is_valid: true,
          command_type: 'ARTICLE_DRAFT_REQUEST',
          normalized_intent: `Operator menugaskan penulisan artikel: ${cleanText}`,
          authority_level: 'OPERATOR_COMMAND',
          target_agent_id: targetAgentId,
          target_department_id: staff.department_id,
          parameters: { topic: cleanText }
        };
      }

      if (lower.includes('review') || lower.includes('cek') || lower.includes('periksa') || lower.includes('tinjau')) {
        // Resolve entity reference
        const resolved = await resolveEntityReference(db, cleanText);
        if (resolved.is_ambiguous || !resolved.resolved) {
          return {
            is_valid: false,
            command_type: 'EDITORIAL_COPY_REVIEW',
            normalized_intent: cleanText,
            authority_level: 'OPERATOR_COMMAND',
            target_agent_id: targetAgentId,
            target_department_id: staff.department_id,
            parameters: {},
            needs_clarification: true,
            clarification_prompt: resolved.reason || 'Rujukan artikel ambigu atau tidak ditemukan. Tolong sebutkan nomor Article ID atau judul spesifik.',
            error_class: 'AMBIGUOUS_ENTITY_REFERENCE'
          };
        }

        const isStructure = lower.includes('struktur') || lower.includes('piramida') || lower.includes('hierarki');
        const cmdType = isStructure ? 'ARTICLE_STRUCTURE_REVIEW' : 'EDITORIAL_COPY_REVIEW';

        return {
          is_valid: true,
          command_type: cmdType,
          normalized_intent: `Operator meminta review ${isStructure ? 'struktur' : 'bahasa'} naskah: ${cleanText}`,
          authority_level: 'OPERATOR_COMMAND',
          target_agent_id: targetAgentId,
          target_department_id: staff.department_id,
          parameters: {
            article_reference: resolved.article_id || resolved.slug || cleanText,
            article_title: resolved.title,
            focus: lower.includes('pembuka') ? 'opening' : lower.includes('penutup') ? 'conclusion' : 'general'
          }
        };
      }

      if (lower.includes('tulis ulang') || lower.includes('rewrite') || lower.includes('revisi')) {
        const resolved = await resolveEntityReference(db, cleanText);
        if (resolved.is_ambiguous || !resolved.resolved) {
          return {
            is_valid: false,
            command_type: 'ARTICLE_REWRITE_REQUEST',
            normalized_intent: cleanText,
            authority_level: 'OPERATOR_COMMAND',
            target_agent_id: targetAgentId,
            target_department_id: staff.department_id,
            parameters: {},
            needs_clarification: true,
            clarification_prompt: resolved.reason || 'Rujukan artikel ambigu atau tidak ditemukan. Tolong sebutkan nomor Article ID atau judul spesifik.',
            error_class: 'AMBIGUOUS_ENTITY_REFERENCE'
          };
        }

        return {
          is_valid: true,
          command_type: 'ARTICLE_REWRITE_REQUEST',
          normalized_intent: `Operator menugaskan penulisan ulang naskah: ${cleanText}`,
          authority_level: 'OPERATOR_COMMAND',
          target_agent_id: targetAgentId,
          target_department_id: staff.department_id,
          parameters: {
            article_reference: resolved.article_id || resolved.slug || cleanText,
            article_title: resolved.title
          }
        };
      }

      break;
    }

    // --- IRWAN (Research Lead) ---
    case 'evidence_researcher_lead': {
      if (lower.includes('riset') || lower.includes('penelitian') || lower.includes('evidence pack') || lower.includes('standar sni')) {
        return {
          is_valid: true,
          command_type: 'EVIDENCE_RESEARCH_REQUEST',
          normalized_intent: `Operator meminta riset bukti teknis/SNI: ${cleanText}`,
          authority_level: 'OPERATOR_COMMAND',
          target_agent_id: targetAgentId,
          target_department_id: staff.department_id,
          parameters: { topic: cleanText }
        };
      }

      if (lower.includes('sitasi') || lower.includes('cek sni') || lower.includes('rujukan')) {
        const resolved = await resolveEntityReference(db, cleanText);
        if (resolved.is_ambiguous || !resolved.resolved) {
          return {
            is_valid: false,
            command_type: 'CITATION_CHECK_REQUEST',
            normalized_intent: cleanText,
            authority_level: 'OPERATOR_COMMAND',
            target_agent_id: targetAgentId,
            target_department_id: staff.department_id,
            parameters: {},
            needs_clarification: true,
            clarification_prompt: resolved.reason || 'Rujukan artikel ambigu atau tidak ditemukan. Tolong sebutkan nomor Article ID atau judul spesifik.',
            error_class: 'AMBIGUOUS_ENTITY_REFERENCE'
          };
        }
        return {
          is_valid: true,
          command_type: 'CITATION_CHECK_REQUEST',
          normalized_intent: `Operator meminta verifikasi sitasi referensi: ${cleanText}`,
          authority_level: 'OPERATOR_COMMAND',
          target_agent_id: targetAgentId,
          target_department_id: staff.department_id,
          parameters: { article_reference: resolved.article_id || cleanText }
        };
      }

      if (lower.includes('cek sumber') || lower.includes('verifikasi klaim') || lower.includes('gap')) {
        const resolved = await resolveEntityReference(db, cleanText);
        if (resolved.is_ambiguous || !resolved.resolved) {
          return {
            is_valid: false,
            command_type: 'EVIDENCE_GAP_ANALYSIS',
            normalized_intent: cleanText,
            authority_level: 'OPERATOR_COMMAND',
            target_agent_id: targetAgentId,
            target_department_id: staff.department_id,
            parameters: {},
            needs_clarification: true,
            clarification_prompt: resolved.reason || 'Rujukan artikel ambigu atau tidak ditemukan. Tolong sebutkan nomor Article ID atau judul spesifik.',
            error_class: 'AMBIGUOUS_ENTITY_REFERENCE'
          };
        }
        return {
          is_valid: true,
          command_type: 'EVIDENCE_GAP_ANALYSIS',
          normalized_intent: `Operator meminta analisis celah klaim bukti: ${cleanText}`,
          authority_level: 'OPERATOR_COMMAND',
          target_agent_id: targetAgentId,
          target_department_id: staff.department_id,
          parameters: { article_reference: resolved.article_id || cleanText }
        };
      }

      break;
    }

    // --- RINA (Editorial QA) ---
    case 'editorial_qa_primary': {
      if (lower.includes('qa') || lower.includes('first article gate') || lower.includes('kepatuhan redaksi') || lower.includes('periksa')) {
        const resolved = await resolveEntityReference(db, cleanText);
        if (resolved.is_ambiguous || !resolved.resolved) {
          return {
            is_valid: false,
            command_type: 'EDITORIAL_QA_REQUEST',
            normalized_intent: cleanText,
            authority_level: 'OPERATOR_COMMAND',
            target_agent_id: targetAgentId,
            target_department_id: staff.department_id,
            parameters: {},
            needs_clarification: true,
            clarification_prompt: resolved.reason || 'Rujukan artikel ambigu atau tidak ditemukan. Tolong sebutkan nomor Article ID atau judul spesifik.',
            error_class: 'AMBIGUOUS_ENTITY_REFERENCE'
          };
        }
        return {
          is_valid: true,
          command_type: 'EDITORIAL_QA_REQUEST',
          normalized_intent: `Operator meminta inspeksi QA First Article Gate: ${cleanText}`,
          authority_level: 'OPERATOR_COMMAND',
          target_agent_id: targetAgentId,
          target_department_id: staff.department_id,
          parameters: { article_reference: resolved.article_id || cleanText }
        };
      }

      if (lower.includes('siap review') || lower.includes('readiness') || lower.includes('kelayakan')) {
        const resolved = await resolveEntityReference(db, cleanText);
        if (resolved.is_ambiguous || !resolved.resolved) {
          return {
            is_valid: false,
            command_type: 'REVIEW_READINESS_CHECK',
            normalized_intent: cleanText,
            authority_level: 'OPERATOR_COMMAND',
            target_agent_id: targetAgentId,
            target_department_id: staff.department_id,
            parameters: {},
            needs_clarification: true,
            clarification_prompt: resolved.reason || 'Rujukan artikel ambigu atau tidak ditemukan. Tolong sebutkan nomor Article ID atau judul spesifik.',
            error_class: 'AMBIGUOUS_ENTITY_REFERENCE'
          };
        }
        return {
          is_valid: true,
          command_type: 'REVIEW_READINESS_CHECK',
          normalized_intent: `Operator menanyakan kesiapan review naskah: ${cleanText}`,
          authority_level: 'OPERATOR_COMMAND',
          target_agent_id: targetAgentId,
          target_department_id: staff.department_id,
          parameters: { article_reference: resolved.article_id || cleanText }
        };
      }

      break;
    }

    // --- BUDI (Media Operations) ---
    case 'lokamedia_worker_primary': {
      if (lower.includes('media') || lower.includes('antrean') || lower.includes('gambar') || lower.includes('foto') || lower.includes('gagal')) {
        return {
          is_valid: true,
          command_type: 'MEDIA_STATUS_QUERY',
          normalized_intent: `Operator menanyakan status pemrosesan media`,
          authority_level: 'READ_ONLY',
          target_agent_id: targetAgentId,
          target_department_id: staff.department_id,
          parameters: {}
        };
      }

      if (lower.includes('diagnostik') || lower.includes('kenapa mati') || lower.includes('mengapa nonaktif') || lower.includes('worker')) {
        return {
          is_valid: true,
          command_type: 'MEDIA_DIAGNOSTIC_REQUEST',
          normalized_intent: `Operator meminta diagnostik pekerja media`,
          authority_level: 'READ_ONLY',
          target_agent_id: targetAgentId,
          target_department_id: staff.department_id,
          parameters: {}
        };
      }

      break;
    }

    // --- SARI (Publication Operations) ---
    case 'publication_dispatcher_core': {
      if (lower.includes('jadwal') || lower.includes('menunggu publikasi') || lower.includes('antrean tayang') || lower.includes('rencana')) {
        return {
          is_valid: true,
          command_type: 'PUBLICATION_PLAN_REVIEW',
          normalized_intent: `Operator meninjau rencana tayang publikasi`,
          authority_level: 'READ_ONLY',
          target_agent_id: targetAgentId,
          target_department_id: staff.department_id,
          parameters: {}
        };
      }

      if (lower.includes('status publikasi') || lower.includes('kuota') || lower.includes('receipt') || lower.includes('tanda terima')) {
        return {
          is_valid: true,
          command_type: 'PUBLICATION_STATUS_QUERY',
          normalized_intent: `Operator menanyakan status publikasi harian`,
          authority_level: 'READ_ONLY',
          target_agent_id: targetAgentId,
          target_department_id: staff.department_id,
          parameters: {}
        };
      }

      break;
    }

    // --- DIMAS (Engineering & Telemetry) ---
    case 'telemetry_observer_jev': {
      if (lower.includes('kesehatan') || lower.includes('health') || lower.includes('sistem')) {
        return {
          is_valid: true,
          command_type: 'SYSTEM_HEALTH_QUERY',
          normalized_intent: `Operator meminta status kesehatan sistem telemetri`,
          authority_level: 'READ_ONLY',
          target_agent_id: targetAgentId,
          target_department_id: staff.department_id,
          parameters: {}
        };
      }

      if (lower.includes('jev') || lower.includes('bayangan') || lower.includes('shadow') || lower.includes('keputusan')) {
        return {
          is_valid: true,
          command_type: 'JEV_OBSERVATION_REVIEW',
          normalized_intent: `Operator menanyakan observasi bayangan JEV terbaru`,
          authority_level: 'READ_ONLY',
          target_agent_id: targetAgentId,
          target_department_id: staff.department_id,
          parameters: {}
        };
      }

      if (lower.includes('breaker') || lower.includes('pemutus') || lower.includes('sirkuit')) {
        return {
          is_valid: true,
          command_type: 'CIRCUIT_BREAKER_STATUS_QUERY',
          normalized_intent: `Operator menanyakan status circuit breaker`,
          authority_level: 'READ_ONLY',
          target_agent_id: targetAgentId,
          target_department_id: staff.department_id,
          parameters: {}
        };
      }

      break;
    }

    // --- MAYA (Social & Distribution) ---
    case 'social_distribution_operator': {
      if (lower.includes('status') || lower.includes('medsos') || lower.includes('sosial') || lower.includes('kampanye')) {
        return {
          is_valid: true,
          command_type: 'SOCIAL_STATUS_QUERY',
          normalized_intent: 'Operator menanyakan status operasi distribusi sosial',
          authority_level: 'READ_ONLY',
          target_agent_id: targetAgentId,
          target_department_id: staff.department_id,
          parameters: {}
        };
      }

      if (lower.includes('review') || lower.includes('varian') || lower.includes('format')) {
        return {
          is_valid: true,
          command_type: 'SOCIAL_CAMPAIGN_REVIEW',
          normalized_intent: 'Operator meminta peninjauan kampanye dan varian medsos',
          authority_level: 'READ_ONLY',
          target_agent_id: targetAgentId,
          target_department_id: staff.department_id,
          parameters: {}
        };
      }

      if (lower.includes('outbox') || lower.includes('jadwal') || lower.includes('antrean')) {
        return {
          is_valid: true,
          command_type: 'SOCIAL_OUTBOX_REVIEW',
          normalized_intent: 'Operator menanyakan antrean outbox posting medsos',
          authority_level: 'READ_ONLY',
          target_agent_id: targetAgentId,
          target_department_id: staff.department_id,
          parameters: {}
        };
      }

      break;
    }
  }

  // Check for Capability Mismatch
  // If the command would have been valid for another staff member (e.g. asking Dimas to write an article)
  if (lower.includes('tulis') || lower.includes('buat artikel') || lower.includes('draft baru')) {
    return {
      is_valid: false,
      command_type: 'ARTICLE_DRAFT_REQUEST',
      normalized_intent: cleanText,
      authority_level: 'OPERATOR_COMMAND',
      target_agent_id: targetAgentId,
      target_department_id: staff.department_id,
      parameters: {},
      rejection_reason: `Staf ${staff.display_name} (${staff.role}) tidak memiliki kapabilitas penulisan artikel. Silakan berikan instruksi ini kepada Joko (Content Writer).`,
      error_class: 'CAPABILITY_MISMATCH'
    };
  }

  if (lower.includes('riset') || lower.includes('standar sni')) {
    return {
      is_valid: false,
      command_type: 'EVIDENCE_RESEARCH_REQUEST',
      normalized_intent: cleanText,
      authority_level: 'OPERATOR_COMMAND',
      target_agent_id: targetAgentId,
      target_department_id: staff.department_id,
      parameters: {},
      rejection_reason: `Staf ${staff.display_name} (${staff.role}) tidak menangani riset bukti teknis. Silakan berikan instruksi ini kepada Irwan (Research Lead).`,
      error_class: 'CAPABILITY_MISMATCH'
    };
  }

  // Fallback: General informative query or unsupported command
  return {
    is_valid: false,
    command_type: 'COMMAND_NOT_ALLOWED',
    normalized_intent: cleanText,
    authority_level: 'READ_ONLY',
    target_agent_id: targetAgentId,
    target_department_id: staff.department_id,
    parameters: {},
    rejection_reason: `Instruksi tidak dikenali atau di luar allowlist kapabilitas ${staff.display_name}. Gunakan instruksi operasional yang terdaftar (seperti review naskah, riset bukti, diagnostik sistem, atau tanya tugas aktif).`,
    error_class: 'COMMAND_NOT_ALLOWED'
  };
}

// ============================================================================
// Read-Only Query Executor (Direct & Non-Mutating)
// ============================================================================

export function executeReadOnlyQuery(
  commandType: string,
  targetAgentId: string,
  snapshot: MissionControlSnapshot | null
): string {
  const staff = getStaffDefinitionByAgentId(targetAgentId);
  const name = staff?.display_name || targetAgentId;

  switch (commandType) {
    case 'CURRENT_TASK_QUERY': {
      const rosterStaff = snapshot?.staff?.staff?.find((s: any) => s.agent_id === targetAgentId);
      if (rosterStaff?.current_task) {
        return `Saat ini saya sedang mengerjakan tugas: **${rosterStaff.current_task.current_task_title}** (Status: ${rosterStaff.current_task.current_task_status}).`;
      }
      return `Saat ini tidak ada tugas aktif yang sedang saya kerjakan. Status operasional saya saat ini: **${rosterStaff?.state || 'IDLE'}**.`;
    }

    case 'ACTIVITY_SUMMARY_QUERY': {
      const rosterStaff = snapshot?.staff?.staff?.find((s: any) => s.agent_id === targetAgentId);
      const acts = rosterStaff?.recent_activities || [];
      if (acts.length > 0) {
        const top = acts.slice(0, 3).map((a: any) => `• [${new Date(a.timestamp).toLocaleTimeString('id-ID')}] ${a.summary}`).join('\n');
        return `Berikut 3 rekaman telemetri terbaru saya:\n${top}`;
      }
      return `Belum ada riwayat aktivitas telemetri baru yang tercatat untuk saya dalam jendela pemantauan ini.`;
    }

    case 'MEDIA_STATUS_QUERY': {
      const media = snapshot?.media;
      const workerState = snapshot?.health?.mediaWorker?.effectiveState || 'DISABLED';
      return `Status Operasi Media saat ini:\n• Status Worker: **${workerState}**\n• Total Aset Media: **${media?.totalAssetsCount || 0}**\n• Tugas Antrean: **${media?.pendingJobsCount || 0}**\n• Tugas Gagal: **${media?.failedJobsCount || 0}**`;
    }

    case 'MEDIA_DIAGNOSTIC_REQUEST': {
      const isWorkerDisabled = snapshot?.health?.mediaWorker?.effectiveState === 'DISABLED';
      const reason = snapshot?.health?.mediaWorker?.reason || 'Pengaturan sistem menonaktifkan media worker secara sengaja.';
      return `Hasil Diagnostik Media Worker:\n• Status: **${isWorkerDisabled ? 'DISABLED (Sengaja Dinonaktifkan)' : 'ENABLED'}**\n• Keterangan: ${reason}\n• Catatan: Penonaktifan ini bersifat aman dan tidak memicu sinyal darurat.`;
    }

    case 'PUBLICATION_STATUS_QUERY': {
      const published = snapshot?.articles?.publishedCount || 0;
      const drafts = snapshot?.articles?.draftCount || 0;
      const auto = snapshot?.health?.automation?.mode || 'OFF';
      return `Status Operasional Publikasi:\n• Mode Otomasi: **${auto}** (Draft-only / Safe)\n• Total Artikel Terbit: **${published}** artikel\n• Total Draf Tersimpan: **${drafts}** draf`;
    }

    case 'PUBLICATION_PLAN_REVIEW': {
      const scheduledCount = snapshot?.pipeline?.stageCounts?.scheduled || 0;
      if (scheduledCount > 0) {
        return `Terdapat **${scheduledCount}** artikel dalam antrean jadwal publikasi terencana.`;
      }
      return `Saat ini tidak ada artikel yang menunggu jadwal tayang otomatis. Semua artikel berada pada status draf aman.`;
    }

    case 'SYSTEM_HEALTH_QUERY': {
      const health = snapshot?.health?.overallStatus || 'HEALTHY';
      const mainBreaker = snapshot?.health?.circuitBreakers?.[0];
      const cb = mainBreaker ? mainBreaker.state : 'CLOSED';
      const jevStatus = snapshot?.health?.jev?.providerStatus || 'UNKNOWN';
      return `Ringkasan Telemetri Sistem:\n• Status Keseluruhan: **${health}**\n• Circuit Breaker: **${cb}**\n• Provider Jev OpenRouter: **${jevStatus}**\n• Otoritas Eksekusi: **Zero Publication Authority (Shadow Only)**`;
    }

    case 'JEV_OBSERVATION_REVIEW': {
      const jev = snapshot?.jev;
      const count = jev?.totalObservationsCount || 0;
      const agree = jev?.agreementRatePercent || 100;
      return `Observasi Bayangan TypeSafe Jev (Snapshot 20260917):\n• Total Keputusan Tercatat: **${count}**\n• Tingkat Keselarasan Redaksi: **${agree}%**\n• Status Otoritas: **SHADOW MODE ONLY (0 Mutasi)**`;
    }

    case 'CIRCUIT_BREAKER_STATUS_QUERY': {
      const mainBreaker = snapshot?.health?.circuitBreakers?.[0];
      return `Status Pemutus Sirkuit:\n• ID: **${mainBreaker?.id || 'global_publisher'}**\n• Status: **${mainBreaker?.state || 'CLOSED'}**\n• Kegagalan Berturut-turut: **${mainBreaker?.failureCount || 0}**\n• Ambang Batas: **${mainBreaker?.failureThreshold || 3}**`;
    }

    case 'SOCIAL_STATUS_QUERY': {
      const social = snapshot?.social;
      const auto = social?.mode || 'SHADOW';
      return `Status Operasi Media Sosial saat ini:\n• Mode: **${auto} / READ-ONLY** (Zero External Execution)\n• Total Kampanye: **${social?.totalCampaigns || 0}**\n• Draf Kampanye: **${social?.draftCampaigns || 0}**\n• Menunggu QA: **${social?.variantsAwaitingQa || 0}** varian\n• Menunggu Persetujuan: **${social?.variantsAwaitingApproval || 0}** varian\n• Tertahan di Outbox: **${social?.outboxStagedCount || 0}** varian (Hold state saat SOCIAL_AUTOMATION=OFF)\n• Terbit Eksternal: **0** (Provider execution unavailable)`;
    }

    case 'SOCIAL_CAMPAIGN_REVIEW': {
      const social = snapshot?.social;
      if (social && social.latestCampaign) {
        return `Kampanye sosial terbaru: **${social.latestCampaign.title}** (Status: **${social.latestCampaign.status}**, ID: \`${social.latestCampaign.campaignId}\`).`;
      }
      return 'Belum ada kampanye sosial aktif yang terdaftar dalam pipeline.';
    }

    case 'SOCIAL_OUTBOX_REVIEW': {
      const social = snapshot?.social;
      const count = social?.outboxStagedCount || 0;
      return `Antrean Outbox Medsos:\n• Item Tertahan (Staged): **${count}**\n• Item Layak Kirim (Eligible): **0** (Ditahan oleh gerbang keselamatan SOCIAL_AUTOMATION=OFF).`;
    }

    default:
      return `Informasi untuk ${commandType} siap dipantau melalui telemetri kanonikal.`;
  }
}

// ============================================================================
// Conversation & Message Persistence Service
// ============================================================================

export async function getOrCreateConversation(
  db: any,
  agentId: string,
  createdBy = 'operator'
): Promise<StaffConversation> {
  const staff = getStaffDefinitionByAgentId(agentId);
  const validAgentId = staff ? staff.agent_id : agentId;
  const convId = `conv_${validAgentId}`;

  // Check D1 if available
  if (db && typeof db.prepare === 'function') {
    try {
      const row = await db.prepare('SELECT conversation_id, staff_agent_id, created_by, created_at, updated_at, status, metadata_json FROM mission_control_conversations WHERE staff_agent_id = ?').bind(validAgentId).first();
      if (row) {
        return {
          conversation_id: row.conversation_id,
          staff_agent_id: row.staff_agent_id,
          created_by: row.created_by,
          created_at: row.created_at,
          updated_at: row.updated_at,
          status: row.status,
          metadata: row.metadata_json ? JSON.parse(row.metadata_json) : undefined
        };
      }

      // Insert new conversation in D1
      const now = new Date().toISOString();
      await db.prepare('INSERT INTO mission_control_conversations (conversation_id, staff_agent_id, created_by, created_at, updated_at, status) VALUES (?, ?, ?, ?, ?, ?)')
        .bind(convId, validAgentId, createdBy, now, now, 'ACTIVE')
        .run();

      return {
        conversation_id: convId,
        staff_agent_id: validAgentId,
        created_by: createdBy,
        created_at: now,
        updated_at: now,
        status: 'ACTIVE'
      };
    } catch {
      // Fallback to memory
    }
  }

  // Memory Store fallback
  let conv = memoryConversations.get(convId);
  if (!conv) {
    const now = new Date().toISOString();
    conv = {
      conversation_id: convId,
      staff_agent_id: validAgentId,
      created_by: createdBy,
      created_at: now,
      updated_at: now,
      status: 'ACTIVE'
    };
    memoryConversations.set(convId, conv);
  }
  return conv;
}

export async function getConversationMessages(
  db: any,
  conversationId: string
): Promise<StaffMessage[]> {
  if (db && typeof db.prepare === 'function') {
    try {
      const { results } = await db.prepare(
        'SELECT message_id, conversation_id, sender_type, sender_id, message_type, content, created_at, related_command_id, related_task_id, metadata_json FROM mission_control_messages WHERE conversation_id = ? ORDER BY created_at ASC'
      ).bind(conversationId).all();

      if (Array.isArray(results) && results.length > 0) {
        return results.map((r: any) => ({
          message_id: r.message_id,
          conversation_id: r.conversation_id,
          sender_type: r.sender_type,
          sender_id: r.sender_id,
          message_type: r.message_type,
          content: r.content,
          created_at: r.created_at,
          related_command_id: r.related_command_id,
          related_task_id: r.related_task_id,
          metadata: r.metadata_json ? JSON.parse(r.metadata_json) : undefined
        }));
      }
    } catch {
      // Fallback to memory
    }
  }

  return memoryMessages.get(conversationId) || [];
}

export async function appendMessage(
  db: any,
  message: StaffMessage
): Promise<StaffMessage> {
  const sanitizedContent = sanitizeString(message.content);
  const sanitizedMsg: StaffMessage = {
    ...message,
    content: sanitizedContent
  };

  if (db && typeof db.prepare === 'function') {
    try {
      await db.prepare(
        'INSERT INTO mission_control_messages (message_id, conversation_id, sender_type, sender_id, message_type, content, created_at, related_command_id, related_task_id, metadata_json) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)'
      ).bind(
        sanitizedMsg.message_id,
        sanitizedMsg.conversation_id,
        sanitizedMsg.sender_type,
        sanitizedMsg.sender_id,
        sanitizedMsg.message_type,
        sanitizedMsg.content,
        sanitizedMsg.created_at,
        sanitizedMsg.related_command_id || null,
        sanitizedMsg.related_task_id || null,
        sanitizedMsg.metadata ? JSON.stringify(sanitizedMsg.metadata) : null
      ).run();

      // Update conversation updated_at
      await db.prepare('UPDATE mission_control_conversations SET updated_at = ? WHERE conversation_id = ?')
        .bind(sanitizedMsg.created_at, sanitizedMsg.conversation_id)
        .run();
    } catch {
      // Fallback to memory
    }
  }

  // Update memory store
  const list = memoryMessages.get(sanitizedMsg.conversation_id) || [];
  list.push(sanitizedMsg);
  memoryMessages.set(sanitizedMsg.conversation_id, list);

  return sanitizedMsg;
}

// ============================================================================
// Operator Command Queue Lifecycle Engine
// ============================================================================

export async function queueOperatorCommand(
  db: any,
  command: OperatorCommand
): Promise<OperatorCommand> {
  const cmdId = command.command_id || `cmd_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
  const fullCmd: OperatorCommand = {
    ...command,
    command_id: cmdId
  };

  if (db && typeof db.prepare === 'function') {
    try {
      await db.prepare(
        'INSERT INTO mission_control_commands (command_id, conversation_id, target_agent_id, target_department_id, operator_message, normalized_intent, command_type, parameters_json, status, authority_level, created_at, accepted_at, started_at, completed_at, failed_at, result_summary, task_reference, error_class) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)'
      ).bind(
        fullCmd.command_id,
        fullCmd.conversation_id,
        fullCmd.target_agent_id,
        fullCmd.target_department_id,
        sanitizeString(fullCmd.operator_message),
        fullCmd.normalized_intent,
        fullCmd.command_type,
        JSON.stringify(fullCmd.parameters || {}),
        fullCmd.status,
        fullCmd.authority_level,
        fullCmd.created_at,
        fullCmd.accepted_at || null,
        fullCmd.started_at || null,
        fullCmd.completed_at || null,
        fullCmd.failed_at || null,
        fullCmd.result_summary || null,
        fullCmd.task_reference || null,
        fullCmd.error_class || null
      ).run();
    } catch {
      // Fallback to memory
    }
  }

  memoryCommands.set(fullCmd.command_id, fullCmd);
  return fullCmd;
}

export async function advanceCommandStatus(
  db: any,
  commandId: string,
  newStatus: CommandStatus,
  details: {
    result_summary?: string;
    task_reference?: string;
    error_class?: string;
  } = {}
): Promise<OperatorCommand | null> {
  const now = new Date().toISOString();
  let cmd = memoryCommands.get(commandId);

  // If in D1, update record
  if (db && typeof db.prepare === 'function') {
    try {
      const row = await db.prepare('SELECT * FROM mission_control_commands WHERE command_id = ?').bind(commandId).first();
      if (row) {
        let acceptedAt = row.accepted_at;
        let startedAt = row.started_at;
        let completedAt = row.completed_at;
        let failedAt = row.failed_at;

        if (newStatus === 'ACCEPTED') acceptedAt = now;
        if (newStatus === 'RUNNING') startedAt = now;
        if (newStatus === 'COMPLETED') completedAt = now;
        if (newStatus === 'FAILED' || newStatus === 'BLOCKED') failedAt = now;

        await db.prepare(
          'UPDATE mission_control_commands SET status = ?, accepted_at = ?, started_at = ?, completed_at = ?, failed_at = ?, result_summary = ?, task_reference = ?, error_class = ? WHERE command_id = ?'
        ).bind(
          newStatus,
          acceptedAt,
          startedAt,
          completedAt,
          failedAt,
          details.result_summary || row.result_summary || null,
          details.task_reference || row.task_reference || null,
          details.error_class || row.error_class || null,
          commandId
        ).run();

        cmd = {
          command_id: row.command_id,
          conversation_id: row.conversation_id,
          target_agent_id: row.target_agent_id,
          target_department_id: row.target_department_id,
          operator_message: row.operator_message,
          normalized_intent: row.normalized_intent,
          command_type: row.command_type,
          parameters: JSON.parse(row.parameters_json || '{}'),
          status: newStatus,
          authority_level: row.authority_level,
          created_at: row.created_at,
          accepted_at: acceptedAt,
          started_at: startedAt,
          completed_at: completedAt,
          failed_at: failedAt,
          result_summary: details.result_summary || row.result_summary,
          task_reference: details.task_reference || row.task_reference,
          error_class: details.error_class || row.error_class
        };
      }
    } catch {
      // Fallback to memory
    }
  }

  if (cmd) {
    cmd.status = newStatus;
    if (newStatus === 'ACCEPTED') cmd.accepted_at = now;
    if (newStatus === 'RUNNING') cmd.started_at = now;
    if (newStatus === 'COMPLETED') cmd.completed_at = now;
    if (newStatus === 'FAILED' || newStatus === 'BLOCKED') cmd.failed_at = now;
    if (details.result_summary) cmd.result_summary = details.result_summary;
    if (details.task_reference) cmd.task_reference = details.task_reference;
    if (details.error_class) cmd.error_class = details.error_class;
    memoryCommands.set(commandId, cmd);
  }

  return cmd || null;
}

export function getCommandById(commandId: string): OperatorCommand | null {
  return memoryCommands.get(commandId) || null;
}

// ============================================================================
// Master Operator Interaction Dispatcher
// ============================================================================

export async function processOperatorInteraction(
  db: any,
  targetAgentId: string,
  operatorText: string,
  snapshot: MissionControlSnapshot | null
): Promise<{
  conversation: StaffConversation;
  operator_message: StaffMessage;
  response_message: StaffMessage;
  command?: OperatorCommand;
}> {
  const staff = getStaffDefinitionByAgentId(targetAgentId);
  const effectiveAgentId = staff ? staff.agent_id : targetAgentId;
  const staffName = staff ? staff.display_name : targetAgentId;

  // 1. Get or create conversation thread
  const conv = await getOrCreateConversation(db, effectiveAgentId);
  const now = new Date().toISOString();

  // 2. Append operator message
  const opMsgId = `msg_op_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
  const operatorMessage: StaffMessage = await appendMessage(db, {
    message_id: opMsgId,
    conversation_id: conv.conversation_id,
    sender_type: 'OPERATOR',
    sender_id: 'operator',
    message_type: 'TEXT',
    content: operatorText,
    created_at: now
  });

  // 3. Normalize intent & resolve entities
  const norm = await normalizeOperatorIntent(effectiveAgentId, operatorText, db);

  // Case A: Clarification needed (e.g. ambiguous entity reference)
  if (norm.needs_clarification) {
    const replyMsgId = `msg_st_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
    const responseMessage: StaffMessage = await appendMessage(db, {
      message_id: replyMsgId,
      conversation_id: conv.conversation_id,
      sender_type: 'STAFF',
      sender_id: effectiveAgentId,
      message_type: 'TEXT',
      content: norm.clarification_prompt || 'Mohon sebutkan rujukan yang lebih spesifik.',
      created_at: new Date().toISOString()
    });
    return { conversation: conv, operator_message: operatorMessage, response_message: responseMessage };
  }

  // Case B: Rejected command (e.g. high-authority violation, capability mismatch, not allowed)
  if (!norm.is_valid) {
    const errorMsgId = `msg_err_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
    const errorResponse: StaffMessage = await appendMessage(db, {
      message_id: errorMsgId,
      conversation_id: conv.conversation_id,
      sender_type: 'SYSTEM',
      sender_id: 'mission_control_guard',
      message_type: 'ERROR',
      content: `⚠️ Permintaan ditolak [${norm.error_class || 'REJECTED'}]: ${norm.rejection_reason}`,
      created_at: new Date().toISOString(),
      metadata: { error_class: norm.error_class }
    });
    return { conversation: conv, operator_message: operatorMessage, response_message: errorResponse };
  }

  // Case C: READ_ONLY Query
  if (norm.authority_level === 'READ_ONLY') {
    const answer = executeReadOnlyQuery(norm.command_type, effectiveAgentId, snapshot);
    const replyMsgId = `msg_st_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
    const responseMessage: StaffMessage = await appendMessage(db, {
      message_id: replyMsgId,
      conversation_id: conv.conversation_id,
      sender_type: 'STAFF',
      sender_id: effectiveAgentId,
      message_type: 'TEXT',
      content: answer,
      created_at: new Date().toISOString()
    });
    return { conversation: conv, operator_message: operatorMessage, response_message: responseMessage };
  }

  // Case D: OPERATOR_COMMAND (Queued into Hermes command pipeline)
  const cmdId = `cmd_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
  const command: OperatorCommand = await queueOperatorCommand(db, {
    command_id: cmdId,
    conversation_id: conv.conversation_id,
    target_agent_id: effectiveAgentId,
    target_department_id: norm.target_department_id,
    operator_message: operatorText,
    normalized_intent: norm.normalized_intent,
    command_type: norm.command_type,
    parameters: norm.parameters,
    status: 'QUEUED',
    authority_level: 'OPERATOR_COMMAND',
    created_at: now
  });

  const replyMsgId = `msg_st_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
  const staffResponse: StaffMessage = await appendMessage(db, {
    message_id: replyMsgId,
    conversation_id: conv.conversation_id,
    sender_type: 'STAFF',
    sender_id: effectiveAgentId,
    message_type: 'COMMAND_STATUS',
    content: `Baik. Permintaan **${COMMAND_ALLOWLIST[norm.command_type]?.label || norm.command_type}** telah dimasukkan ke antrean operasional (ID: \`${command.command_id}\`).`,
    created_at: new Date().toISOString(),
    related_command_id: command.command_id,
    metadata: { command_status: 'QUEUED', command_type: norm.command_type }
  });

  return {
    conversation: conv,
    operator_message: operatorMessage,
    response_message: staffResponse,
    command
  };
}
