/**
 * RancangLoka — Scalable Human Approval Inbox Types & UX Principles
 * Milestone: APPROVAL-INBOX-V1
 *
 * Canonical Admin UX Principles:
 * 1. "The bell tells the administrator that work exists.
 *     The Approval Inbox organizes the work.
 *     The Approval Detail is where the decision happens."
 * 2. "Human approval queues may scale;
 *     human decisions remain deliberate and individual."
 *
 * Safety Invariants:
 * - NO BULK APPROVAL: Editorial & publication decisions remain item-by-item.
 * - OLDEST WAITING FIRST: Requests cannot silently starve.
 * - SINGLE SOURCE OF TRUTH: The inbox is a projection of canonical workflow state.
 */

export type ApprovalType = 'article' | 'media' | 'publication_plan';

export type ApprovalStatus = 'PENDING' | 'REVISION_REQUESTED' | 'APPROVED';

export interface ApprovalInboxItem {
  id: string; // Composite ID, e.g. "article:12" or "media:appr_38b"
  rawId: number | string;
  type: ApprovalType;
  typeLabel: string; // 'Artikel', 'Promosi Media', 'Publication Plan'
  title: string;
  slug?: string;
  workflowStage: string; // e.g. 'Editorial Approval', 'Media Review'
  previousGates: string; // e.g. 'Irwan ✓ Joko ✓ Nadia ✓ Rina ✓', 'Device Budi ✓'
  waitingSince: string; // ISO-8601 string
  waitingAgeFormatted: string; // e.g. 'Baru saja', '18 menit', '2 jam', '1 hari'
  requiredActor: string; // e.g. 'Chief Editor', 'Admin'
  status: ApprovalStatus;
  statusLabel: string; // 'Menunggu', 'Minta Revisi', 'Selesai'
  notes?: string | null;
  detailUrl: string; // e.g. '/admin/preview/shading-luar'
  metadata?: Record<string, any>;
}

export interface ApprovalProjectionOptions {
  status?: ApprovalStatus | 'ALL';
  type?: ApprovalType | 'ALL';
  search?: string;
  page?: number;
  limit?: number;
  now?: number; // Optional mock timestamp for deterministic testing
  includeDevFixtures?: boolean; // Isolated local DEV visual testing only
}

export interface ApprovalProjectionResult {
  items: ApprovalInboxItem[];
  totalCount: number;
  pendingCount: number;
  revisionCount: number;
  completedCount: number;
  previewItems: ApprovalInboxItem[]; // Capped at max 3–5 items for header bell
  pagination: {
    page: number;
    limit: number;
    totalPages: number;
  };
  filter: {
    status: ApprovalStatus | 'ALL';
    type: ApprovalType | 'ALL';
    search?: string;
  };
}

export interface ApprovalCounts {
  pendingCount: number;
  revisionCount: number;
  completedCount: number;
}

export const ADMIN_UX_PRINCIPLES = {
  BELL_ROLE: 'The bell tells the administrator that work exists.',
  INBOX_ROLE: 'The Approval Inbox organizes the work.',
  DETAIL_ROLE: 'The Approval Detail is where the decision happens.',
  DELIBERATE_DECISION: 'Human approval queues may scale; human decisions remain deliberate and individual.',
  HUMAN_GATE_NEXT_ACTION: 'An item appears in the Chief Editor Approval Inbox only when human approval is the next legitimate workflow action.',
  TRUTHFUL_STAFF_EVIDENCE: 'The UI must not claim a named staff member completed a gate unless canonical workflow evidence proves it.',
  INBOX_FAST_FIND: 'The Approval Inbox is for finding the next decision quickly. Detailed workflow provenance belongs on the Approval Detail page.',
  INBOX_VS_DETAIL: 'Inbox = find the work. Detail = understand the context and make the decision.',
  MOBILE_TASK_FIRST: 'On mobile, Approval Inbox is task-first.',
  MOBILE_FIRST_DECISION_ABOVE_FOLD: 'The first pending decision should appear as early as practical in the initial viewport.'
} as const;

