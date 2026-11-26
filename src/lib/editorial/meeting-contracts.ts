/**
 * RancangLoka — Staff Meeting Minutes & Decision Register Contracts
 * File: src/lib/editorial/meeting-contracts.ts
 * Milestone: OLCI-MEETING-MINUTES-V1
 *
 * Implements corporate-grade meeting minutes, decision registers, action item tracking,
 * and organizational learning integration as an extension of existing OLCI mechanisms.
 */

export type StaffMeetingType =
  | 'EDITORIAL_COORDINATION'      // Koordinasi Redaksi & Perencanaan Topik
  | 'INCIDENT_POSTMORTEM'        // Evaluasi Cacat/Insiden Redaksional & Visual
  | 'TECHNICAL_REVIEW'           // Tinjauan Teknis & Rekayasa Arsitektur
  | 'STRATEGY_ALIGNMENT'         // Penyelarasan Strategi Konten & Kategori
  | 'QUALITY_IMPROVEMENT'        // Peningkatan Kualitas Gaya Bahasa & Pengalaman Pembaca
  | 'GOVERNANCE_AND_SAFETY';     // Tata Kelola, Anggaran & Keselamatan Sistem

export type StaffMeetingLifecycleStatus =
  | 'INITIATED'                  // Rapat Diinisiasi
  | 'IN_PROGRESS'                // Rapat Sedang Berlangsung
  | 'COMPLETED'                  // Rapat Selesai (Semua Action Selesai)
  | 'COMPLETED_WITH_PENDING_ACTIONS' // Rapat Selesai, Tindak Lanjut Masih Berjalan
  | 'CANCELLED'                  // Rapat Dibatalkan
  | 'FAILED';                    // Rapat Gagal / Terinterupsi

export type ExecutionProvenance =
  | 'REAL_RUNTIME'               // Eksekusi Runtime Nyata Hermes / SumoPod dengan event start/end terverifikasi
  | 'HISTORICAL_RECONSTRUCTION'  // Rekonstruksi Historis Berdasarkan Catatan Kolaborasi / Dokumen Asinkron
  | 'DRY_RUN'                    // Pengujian Validasi / Dry Run Terkontrol
  | 'SIMULATION'                 // Simulasi Lokal
  | 'FIXTURE_TEST';              // Pengujian Unit / Fixture

export type ActionItemStatus =
  | 'PENDING'
  | 'IN_PROGRESS'
  | 'COMPLETED'
  | 'BLOCKED'
  | 'CANCELLED';

export type DecisionAuthorityType =
  | 'STAFF_AUTONOMOUS'           // Kewenangan Otonom Staf / Departemen
  | 'COORDINATOR_ARBITRATION'    // Arbitrase Koordinator (JEV / Jefry)
  | 'PENDING_OWNER_APPROVAL';    // Memerlukan Persetujuan Pemilik (Owner Sign-off)

export type DecisionStatus =
  | 'ADOPTED'                    // Berlaku Aktif
  | 'PENDING_OWNER'              // Menunggu Persetujuan Owner
  | 'SUPERSEDED'                 // Digantikan Keputusan Baru
  | 'REJECTED';                  // Ditolak

export interface MeetingParticipant {
  id: string;
  name: string;
  role: string;
  department: string;
  is_chair?: boolean;
}

export interface StaffContribution {
  staff_id: string;
  staff_name: string;
  role: string;
  department_id: string;
  statement_summary: string;
  reported_findings?: string[];
  complaints_raised?: string[];     // Keluhan jujur staf (unvarnished)
  suggestions_proposed?: string[];
  concerns_or_disagreements?: string[]; // Perbedaan pendapat sebelum konsensus
}

export interface MeetingDecision {
  decision_id: string;              // e.g. "DEC-MTG-01"
  meeting_id: string;
  title: string;
  decision_text: string;
  rationale: string;
  authority_role: string;
  authority_type: DecisionAuthorityType;
  status: DecisionStatus;
  related_action_ids: string[];
  decided_at: string;               // ISO UTC
}

export interface MeetingActionItem {
  action_id: string;                // e.g. "ACT-MTG-01"
  meeting_id: string;
  description: string;
  responsible_staff_id: string;
  responsible_staff_name: string;
  related_task_id?: string | null;
  related_article_ref?: string | null;
  status: ActionItemStatus;
  created_at: string;               // ISO UTC
  due_date?: string | null;         // YYYY-MM-DD atau ISO UTC
  completed_at?: string | null;     // ISO UTC
  completion_evidence?: string | null;
  result_summary?: string | null;
}

export type LearningValidationStatus =
  | 'HYPOTHESIS'                 // Hipotesis yang belum diuji
  | 'PROVISIONAL_OBSERVATION'    // Observasi awal yang perlu konfirmasi lanjutan
  | 'VALIDATED_EXPERIENCE';      // Pengalaman yang telah tervalidasi hasil kerjanya

export interface MeetingLearningOutcome {
  learning_id: string;
  target_staff_id: string;
  domain: string;
  insight: string;
  actionable_guidance: string;
  validation_status?: LearningValidationStatus;
  stored_in_memory_ref?: string | null; // e.g. "EXP-MAYA-20261125-02-STAFF-MEETING"
}

export interface MeetingRevisionEntry {
  revised_at: string;
  revised_by: string;
  reason: string;
}

export interface StaffMeetingRecord {
  meeting_id: string;               // e.g. "MEETING-OLCI-MWWAMSP9"
  title: string;
  meeting_type: StaffMeetingType;
  meeting_trigger: string;
  initiator_id: string;
  initiator_name: string;
  chair_id: string;
  chair_name: string;
  participants: MeetingParticipant[];
  related_staff_roles: string[];
  meeting_date: string;             // YYYY-MM-DD
  actual_start_at: string;          // ISO UTC
  actual_end_at: string | null;     // ISO UTC
  actual_duration_seconds: number | null; // Dihitung dari timestamp aktual
  agenda: string[];
  objectives: string[];
  issues_raised: string[];
  staff_complaints: string[];       // Rekaman keluhan operasional staf
  findings: string[];
  supporting_evidence: string[];
  individual_contributions: StaffContribution[];
  suggestions: string[];
  disagreements: string[];          // Rekaman perbedaan pandangan
  discussion_summary: string;
  decisions: MeetingDecision[];
  action_items: MeetingActionItem[];
  unresolved_issues: string[];
  learning_outcomes: MeetingLearningOutcome[];
  related_tasks: string[];
  related_articles: string[];
  related_memory_records: string[];
  meeting_status: StaffMeetingLifecycleStatus;
  cancellation_reason?: string | null;
  failure_reason?: string | null;
  provenance: ExecutionProvenance;
  created_at: string;               // ISO UTC
  updated_at: string;               // ISO UTC
  revision_history: MeetingRevisionEntry[];
}
