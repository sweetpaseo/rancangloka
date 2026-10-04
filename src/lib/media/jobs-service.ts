/**
 * RancangLoka - LokaMedia Durable Jobs Service (Phase 2A)
 *
 * Server-canonical state only. Browser/provider continuation state and binary
 * blob references remain extension-local.
 */

export const JOB_STATUS_QUEUED = 'QUEUED';
export const JOB_STATUS_LEASED = 'LEASED';
export const JOB_STATUS_PROMPT_PREPARING = 'PROMPT_PREPARING';
export const JOB_STATUS_PROMPT_READY = 'PROMPT_READY';
export const JOB_STATUS_PROMPT_SENDING = 'PROMPT_SENDING';
export const JOB_STATUS_PROMPT_ACKNOWLEDGED = 'PROMPT_ACKNOWLEDGED';
export const JOB_STATUS_GENERATING = 'GENERATING';
export const JOB_STATUS_IMAGE_DETECTED = 'IMAGE_DETECTED';
export const JOB_STATUS_CAPTURING = 'CAPTURING';
export const JOB_STATUS_CAPTURED = 'CAPTURED';
export const JOB_STATUS_UPLOAD_QUEUED = 'UPLOAD_QUEUED';
export const JOB_STATUS_UPLOADING = 'UPLOADING';
export const JOB_STATUS_UPLOAD_RECEIVED = 'UPLOAD_RECEIVED';
export const JOB_STATUS_ATTACHING = 'ATTACHING';
export const JOB_STATUS_ATTACHMENT_CONFIRMED = 'ATTACHMENT_CONFIRMED';
export const JOB_STATUS_COMPLETE = 'COMPLETE';
export const JOB_STATUS_WAITING_RETRY = 'WAITING_RETRY';
export const JOB_STATUS_RECOVERING = 'RECOVERING';
export const JOB_STATUS_AUTH_REQUIRED = 'AUTH_REQUIRED';
export const JOB_STATUS_PROVIDER_BLOCKED = 'PROVIDER_BLOCKED';
export const JOB_STATUS_USER_ACTION_REQUIRED = 'USER_ACTION_REQUIRED';
export const JOB_STATUS_FAILED_TERMINAL = 'FAILED_TERMINAL';
export const JOB_STATUS_SUPERSEDED = 'SUPERSEDED';
export const JOB_STATUS_CANCELLED = 'CANCELLED';

// Backward-compatible aliases accepted at service/API boundaries.
export const JOB_STATUS_PENDING = JOB_STATUS_QUEUED;
export const JOB_STATUS_IN_PROGRESS = JOB_STATUS_LEASED;
export const JOB_STATUS_READY_TO_UPLOAD = JOB_STATUS_UPLOAD_QUEUED;
export const JOB_STATUS_UPLOADING_LEGACY = JOB_STATUS_UPLOADING;
export const JOB_STATUS_ATTACHED = JOB_STATUS_COMPLETE;
export const JOB_STATUS_FAILED = JOB_STATUS_FAILED_TERMINAL;
export const JOB_STATUS_SKIPPED = JOB_STATUS_CANCELLED;

export const PRIORITY_NORMAL = 100;
export const PRIORITY_HIGH = 200;
export const PRIORITY_URGENT = 300;

export const PRIORITY_BY_NAME = {
  NORMAL: PRIORITY_NORMAL,
  HIGH: PRIORITY_HIGH,
  URGENT: PRIORITY_URGENT
} as const;

export const LOKAMEDIA_PROTOCOL_VERSION = 1;
export const MEDIA_JOB_LEASE_SECONDS = 300;
export const MEDIA_JOB_HEARTBEAT_SECONDS = 60;
export const NO_ELIGIBLE_JOB_RETRY_AFTER_MS = 15000;

export const SCHEDULABLE_STATES = new Set([
  JOB_STATUS_QUEUED,
  JOB_STATUS_WAITING_RETRY
]);

export const TERMINAL_STATES = new Set([
  JOB_STATUS_COMPLETE,
  JOB_STATUS_FAILED_TERMINAL,
  JOB_STATUS_SUPERSEDED,
  JOB_STATUS_CANCELLED
]);

export const CANONICAL_JOB_STATUSES = new Set([
  JOB_STATUS_QUEUED,
  JOB_STATUS_LEASED,
  JOB_STATUS_PROMPT_PREPARING,
  JOB_STATUS_PROMPT_READY,
  JOB_STATUS_PROMPT_SENDING,
  JOB_STATUS_PROMPT_ACKNOWLEDGED,
  JOB_STATUS_GENERATING,
  JOB_STATUS_IMAGE_DETECTED,
  JOB_STATUS_CAPTURING,
  JOB_STATUS_CAPTURED,
  JOB_STATUS_UPLOAD_QUEUED,
  JOB_STATUS_UPLOADING,
  JOB_STATUS_UPLOAD_RECEIVED,
  JOB_STATUS_ATTACHING,
  JOB_STATUS_ATTACHMENT_CONFIRMED,
  JOB_STATUS_COMPLETE,
  JOB_STATUS_WAITING_RETRY,
  JOB_STATUS_RECOVERING,
  JOB_STATUS_AUTH_REQUIRED,
  JOB_STATUS_PROVIDER_BLOCKED,
  JOB_STATUS_USER_ACTION_REQUIRED,
  JOB_STATUS_FAILED_TERMINAL,
  JOB_STATUS_SUPERSEDED,
  JOB_STATUS_CANCELLED
]);

export const LEGACY_STATUS_ALIASES: Record<string, string> = {
  PENDING: JOB_STATUS_QUEUED,
  IN_PROGRESS: JOB_STATUS_LEASED,
  READY_TO_UPLOAD: JOB_STATUS_UPLOAD_QUEUED,
  UPLOADING: JOB_STATUS_UPLOADING,
  ATTACHED: JOB_STATUS_COMPLETE,
  FAILED: JOB_STATUS_FAILED_TERMINAL,
  SKIPPED: JOB_STATUS_CANCELLED
};

export const VALID_JOB_STATUSES = new Set([
  ...CANONICAL_JOB_STATUSES,
  ...Object.keys(LEGACY_STATUS_ALIASES)
]);

export const LEGAL_TRANSITIONS: Record<string, Set<string>> = {
  [JOB_STATUS_QUEUED]: new Set([JOB_STATUS_LEASED, JOB_STATUS_WAITING_RETRY, JOB_STATUS_FAILED_TERMINAL, JOB_STATUS_CANCELLED, JOB_STATUS_SUPERSEDED]),
  [JOB_STATUS_LEASED]: new Set([JOB_STATUS_QUEUED, JOB_STATUS_PROMPT_PREPARING, JOB_STATUS_RECOVERING, JOB_STATUS_CANCELLED, JOB_STATUS_WAITING_RETRY, JOB_STATUS_USER_ACTION_REQUIRED]),
  [JOB_STATUS_PROMPT_PREPARING]: new Set([JOB_STATUS_PROMPT_READY, JOB_STATUS_WAITING_RETRY, JOB_STATUS_FAILED_TERMINAL]),
  [JOB_STATUS_PROMPT_READY]: new Set([JOB_STATUS_PROMPT_SENDING, JOB_STATUS_WAITING_RETRY, JOB_STATUS_FAILED_TERMINAL]),
  [JOB_STATUS_PROMPT_SENDING]: new Set([JOB_STATUS_PROMPT_ACKNOWLEDGED, JOB_STATUS_RECOVERING, JOB_STATUS_WAITING_RETRY]),
  [JOB_STATUS_PROMPT_ACKNOWLEDGED]: new Set([JOB_STATUS_GENERATING, JOB_STATUS_RECOVERING, JOB_STATUS_WAITING_RETRY]),
  [JOB_STATUS_GENERATING]: new Set([JOB_STATUS_IMAGE_DETECTED, JOB_STATUS_AUTH_REQUIRED, JOB_STATUS_PROVIDER_BLOCKED, JOB_STATUS_WAITING_RETRY, JOB_STATUS_FAILED_TERMINAL]),
  [JOB_STATUS_IMAGE_DETECTED]: new Set([JOB_STATUS_CAPTURING, JOB_STATUS_RECOVERING, JOB_STATUS_WAITING_RETRY]),
  [JOB_STATUS_CAPTURING]: new Set([JOB_STATUS_CAPTURED, JOB_STATUS_WAITING_RETRY, JOB_STATUS_FAILED_TERMINAL]),
  [JOB_STATUS_CAPTURED]: new Set([JOB_STATUS_UPLOAD_QUEUED, JOB_STATUS_RECOVERING]),
  [JOB_STATUS_UPLOAD_QUEUED]: new Set([JOB_STATUS_UPLOADING, JOB_STATUS_WAITING_RETRY, JOB_STATUS_CANCELLED]),
  [JOB_STATUS_UPLOADING]: new Set([JOB_STATUS_UPLOAD_RECEIVED, JOB_STATUS_RECOVERING, JOB_STATUS_WAITING_RETRY, JOB_STATUS_FAILED_TERMINAL]),
  [JOB_STATUS_UPLOAD_RECEIVED]: new Set([JOB_STATUS_ATTACHING, JOB_STATUS_RECOVERING]),
  [JOB_STATUS_ATTACHING]: new Set([JOB_STATUS_ATTACHMENT_CONFIRMED, JOB_STATUS_RECOVERING, JOB_STATUS_FAILED_TERMINAL]),
  [JOB_STATUS_ATTACHMENT_CONFIRMED]: new Set([JOB_STATUS_COMPLETE]),
  [JOB_STATUS_WAITING_RETRY]: new Set([JOB_STATUS_QUEUED, JOB_STATUS_RECOVERING, JOB_STATUS_FAILED_TERMINAL, JOB_STATUS_CANCELLED]),
  [JOB_STATUS_RECOVERING]: new Set([JOB_STATUS_QUEUED, JOB_STATUS_CAPTURED, JOB_STATUS_UPLOAD_QUEUED, JOB_STATUS_ATTACHMENT_CONFIRMED, JOB_STATUS_COMPLETE, JOB_STATUS_WAITING_RETRY, JOB_STATUS_FAILED_TERMINAL]),
  [JOB_STATUS_AUTH_REQUIRED]: new Set([JOB_STATUS_QUEUED, JOB_STATUS_RECOVERING, JOB_STATUS_CANCELLED]),
  [JOB_STATUS_PROVIDER_BLOCKED]: new Set([JOB_STATUS_WAITING_RETRY, JOB_STATUS_USER_ACTION_REQUIRED, JOB_STATUS_CANCELLED]),
  [JOB_STATUS_USER_ACTION_REQUIRED]: new Set([JOB_STATUS_QUEUED, JOB_STATUS_RECOVERING, JOB_STATUS_CANCELLED, JOB_STATUS_FAILED_TERMINAL]),
  [JOB_STATUS_COMPLETE]: new Set(),
  [JOB_STATUS_FAILED_TERMINAL]: new Set(),
  [JOB_STATUS_SUPERSEDED]: new Set(),
  [JOB_STATUS_CANCELLED]: new Set()
};

export const RECEIPT_TYPES = new Set([
  'UPLOAD_ACCEPTED',
  'ASSET_EXISTS',
  'UPLOAD_RECEIVED',
  'ATTACHMENT_CONFIRMED',
  'REJECTED',
  'RETRYABLE_ERROR',
  'TERMINAL_ERROR'
]);

export const EVENT_TYPES = new Set([
  'JOB_PROGRESS',
  'GENERATION_STARTED',
  'IMAGE_DETECTED',
  'CAPTURE_STARTED',
  'CAPTURED',
  'UPLOAD_STARTED',
  'UPLOAD_PROGRESS',
  'UPLOAD_RECEIVED',
  'ATTACHMENT_CONFIRMED',
  'JOB_COMPLETE',
  'JOB_RECOVERING',
  'JOB_FAILED'
]);

export const RETRY_FAILURES: Record<string, { status: string; retryable: boolean; baseDelaySeconds: number }> = {
  TRANSIENT_NETWORK: { status: JOB_STATUS_WAITING_RETRY, retryable: true, baseDelaySeconds: 60 },
  SERVER_TRANSIENT: { status: JOB_STATUS_WAITING_RETRY, retryable: true, baseDelaySeconds: 120 },
  PROVIDER_TIMEOUT: { status: JOB_STATUS_WAITING_RETRY, retryable: true, baseDelaySeconds: 180 },
  PROVIDER_AUTH: { status: JOB_STATUS_AUTH_REQUIRED, retryable: false, baseDelaySeconds: 0 },
  PROVIDER_BLOCKED: { status: JOB_STATUS_PROVIDER_BLOCKED, retryable: false, baseDelaySeconds: 0 },
  DOM_CONTRACT_DRIFT: { status: JOB_STATUS_USER_ACTION_REQUIRED, retryable: false, baseDelaySeconds: 0 },
  VALIDATION_REJECTED: { status: JOB_STATUS_FAILED_TERMINAL, retryable: false, baseDelaySeconds: 0 },
  TERMINAL_MEDIA_ERROR: { status: JOB_STATUS_FAILED_TERMINAL, retryable: false, baseDelaySeconds: 0 }
};

const SLOT_KEY_PATTERN = /^[a-z][a-z0-9_]{1,63}$/;
const SAFE_PAYLOAD_FORBIDDEN_KEYS = new Set(['token', 'cookie', 'authorization', 'secret', 'password', 'binary', 'blob', 'image_data']);

export interface MediaJobRecord {
  job_id: string;
  article_id: number;
  article_slug: string;
  article_title: string;
  role: 'featured' | 'inline';
  slot_key: string;
  sequence: number;
  media_type: 'image' | 'video';
  prompt: string;
  prompt_version: number;
  prompt_hash: string;
  alt_text: string;
  aspect_ratio: string;
  target_width: number;
  target_height: number;
  required_for_readiness: number;
  priority: number;
  status: string;
  lease_owner: string | null;
  lease_expires_at: string | null;
  heartbeat_at: string | null;
  attempt: number;
  max_attempts: number;
  next_retry_at: string | null;
  last_error_code: string | null;
  last_error_message_safe: string | null;
  idempotency_key: string | null;
  submitted_at: string | null;
  completed_at: string | null;
  job_revision: number;
  superseded_by_job_id: string | null;
  created_at: string;
  updated_at: string;
}

export interface ListJobsParams {
  status?: string;
  articleId?: number;
  limit?: number;
}

export interface CreateMediaRequirementParams {
  job_id?: string;
  article_id: number;
  slot_key: string;
  role: 'featured' | 'inline';
  sequence?: number;
  required_for_readiness?: boolean;
  priority?: keyof typeof PRIORITY_BY_NAME | number;
  prompt: string;
  alt_text: string;
  aspect_ratio?: string;
  target_width?: number;
  target_height?: number;
  media_type?: 'image' | 'video';
  max_attempts?: number;
}

export interface MediaJobReceiptParams {
  receipt_id?: string;
  job_id: string;
  idempotency_key: string;
  receipt_type: string;
  asset_id?: string | null;
  article_media_id?: number | null;
  sha256?: string | null;
  safe_payload?: Record<string, any> | null;
}

export interface MediaJobEventParams {
  event_id?: string;
  job_id: string;
  event_type: string;
  stage: string;
  attempt?: number;
  safe_payload?: Record<string, any> | null;
}

export interface EligibilityResult {
  eligible: boolean;
  reason?: string;
}

export interface LeaseOptions {
  leaseSeconds?: number;
  now?: Date;
}

export interface ReconcileResult {
  protocol_version: number;
  job_id: string;
  job_revision: number;
  status: string;
  article_id: number;
  slot_key: string;
  lease_owner: string | null;
  lease_expires_at: string | null;
  lease_owned_by_requester: boolean;
  lease_active: boolean;
  attempt: number;
  prompt_version: number;
  prompt_hash: string;
  idempotency_key: string | null;
  latest_receipt: any | null;
  asset_id: string | null;
  attachment_confirmed: boolean;
  next_retry_at: string | null;
  last_error_code: string | null;
  last_error_message_safe: string | null;
  completed_at: string | null;
  recommended_action: string;
}

export function normalizeJobStatus(status: string): string {
  return LEGACY_STATUS_ALIASES[status] || status;
}

export function isTerminalJobState(status: string): boolean {
  return TERMINAL_STATES.has(normalizeJobStatus(status));
}

export function assertValidSlotKey(slotKey: string): void {
  if (!SLOT_KEY_PATTERN.test(slotKey)) {
    throw new Error(`slot_key tidak valid: '${slotKey}'. Gunakan huruf kecil, angka, dan underscore; harus diawali huruf.`);
  }
}

export function normalizePriority(priority: keyof typeof PRIORITY_BY_NAME | number | undefined): number {
  if (priority === undefined || priority === null) return PRIORITY_NORMAL;
  if (typeof priority === 'number') {
    if (![PRIORITY_NORMAL, PRIORITY_HIGH, PRIORITY_URGENT].includes(priority)) {
      throw new Error(`Priority tidak valid: ${priority}`);
    }
    return priority;
  }
  const value = PRIORITY_BY_NAME[priority];
  if (!value) throw new Error(`Priority tidak valid: ${priority}`);
  return value;
}

export function assertLegalTransition(fromStatus: string, toStatus: string): void {
  const from = normalizeJobStatus(fromStatus);
  const to = normalizeJobStatus(toStatus);
  if (!CANONICAL_JOB_STATUSES.has(from) || !CANONICAL_JOB_STATUSES.has(to)) {
    throw new Error(`Status pekerjaan media tidak valid: '${fromStatus}' -> '${toStatus}'`);
  }
  if (!LEGAL_TRANSITIONS[from]?.has(to)) {
    throw new Error(`Transisi pekerjaan media tidak legal: '${from}' -> '${to}'`);
  }
}

export async function computePromptHash(prompt: string, promptVersion: number): Promise<string> {
  const canonical = JSON.stringify({ prompt: prompt.trim(), prompt_version: promptVersion });
  const bytes = new TextEncoder().encode(canonical);
  const digest = await crypto.subtle.digest('SHA-256', bytes);
  return Array.from(new Uint8Array(digest)).map((b) => b.toString(16).padStart(2, '0')).join('');
}

function generateId(prefix: string): string {
  const bytes = new Uint8Array(12);
  crypto.getRandomValues(bytes);
  const suffix = Array.from(bytes).map((b) => b.toString(16).padStart(2, '0')).join('');
  return `${prefix}_${suffix}`;
}

function safeJson(payload?: Record<string, any> | null): string | null {
  if (!payload) return null;
  const scrubbed: Record<string, any> = {};
  for (const [key, value] of Object.entries(payload)) {
    const lowered = key.toLowerCase();
    if ([...SAFE_PAYLOAD_FORBIDDEN_KEYS].some((bad) => lowered.includes(bad))) {
      scrubbed[key] = '[REDACTED]';
    } else if (typeof value === 'string' && value.length > 2000) {
      scrubbed[key] = value.slice(0, 2000);
    } else {
      scrubbed[key] = value;
    }
  }
  return JSON.stringify(scrubbed);
}

function validateProgressPayload(eventType: string, payload?: Record<string, any> | null): void {
  if (!payload) return;
  const jsonLength = JSON.stringify(payload).length;
  if (jsonLength > 4096) throw new Error('PAYLOAD_TOO_LARGE');
  if (eventType === 'UPLOAD_PROGRESS' || eventType === 'UPLOAD_STARTED' || eventType === 'UPLOAD_RECEIVED') {
    const sent = payload.bytes_sent;
    const total = payload.bytes_total;
    const pct = payload.percentage;
    if (sent !== undefined && (!Number.isFinite(Number(sent)) || Number(sent) < 0)) throw new Error('INVALID_PROGRESS_BYTES');
    if (total !== undefined && (!Number.isFinite(Number(total)) || Number(total) < 0)) throw new Error('INVALID_PROGRESS_BYTES');
    if (sent !== undefined && total !== undefined && Number(sent) > Number(total)) throw new Error('INVALID_PROGRESS_RANGE');
    if (pct !== undefined && (!Number.isFinite(Number(pct)) || Number(pct) < 0 || Number(pct) > 100)) throw new Error('INVALID_PROGRESS_PERCENTAGE');
  }
}

function selectColumns(): string {
  return `
    job_id, article_id, article_slug, article_title,
    role, slot_key, sequence, media_type, prompt, prompt_version, prompt_hash, alt_text,
    aspect_ratio, target_width, target_height, required_for_readiness, priority,
    status, lease_owner, lease_expires_at, heartbeat_at, attempt, max_attempts,
    next_retry_at, last_error_code, last_error_message_safe, idempotency_key,
    submitted_at, completed_at, job_revision, superseded_by_job_id, created_at, updated_at
  `;
}

export async function listMediaJobs(db: any, params: ListJobsParams = {}): Promise<MediaJobRecord[]> {
  const conditions: string[] = [];
  const bindings: any[] = [];

  if (params.status && params.status !== 'all') {
    conditions.push('status = ?');
    bindings.push(normalizeJobStatus(params.status));
  }

  if (params.articleId) {
    conditions.push('article_id = ?');
    bindings.push(params.articleId);
  }

  const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
  const limit = Math.min(Math.max(params.limit || 20, 1), 100);

  const { results } = await db
    .prepare(
      `
      SELECT ${selectColumns()}
      FROM media_jobs
      ${whereClause}
      ORDER BY priority DESC, created_at ASC
      LIMIT ?
    `
    )
    .bind(...bindings, limit)
    .all();

  return (results || []) as MediaJobRecord[];
}

export async function getMediaJobById(db: any, jobId: string): Promise<MediaJobRecord | null> {
  const row = await db
    .prepare(
      `
      SELECT ${selectColumns()}
      FROM media_jobs
      WHERE job_id = ?
      LIMIT 1
    `
    )
    .bind(jobId)
    .first();

  return (row as MediaJobRecord) || null;
}

export async function listArticleMediaJobs(db: any, articleId: number): Promise<MediaJobRecord[]> {
  const { results } = await db
    .prepare(
      `
      SELECT ${selectColumns()}
      FROM media_jobs
      WHERE article_id = ?
      ORDER BY sequence ASC, created_at ASC
    `
    )
    .bind(articleId)
    .all();

  return (results || []) as MediaJobRecord[];
}

export async function hasActiveJobForSlot(db: any, articleId: number, slotKey: string): Promise<boolean> {
  assertValidSlotKey(slotKey);
  const row = await db
    .prepare(
      `
      SELECT job_id
      FROM media_jobs
      WHERE article_id = ?
        AND slot_key = ?
        AND status NOT IN ('COMPLETE', 'FAILED_TERMINAL', 'SUPERSEDED', 'CANCELLED')
      LIMIT 1
    `
    )
    .bind(articleId, slotKey)
    .first();
  return Boolean(row);
}

export async function createMediaRequirement(db: any, params: CreateMediaRequirementParams): Promise<MediaJobRecord> {
  assertValidSlotKey(params.slot_key);
  if (!['featured', 'inline'].includes(params.role)) throw new Error(`role tidak valid: '${params.role}'`);
  if (!params.prompt?.trim()) throw new Error('prompt wajib diisi.');
  if (!params.alt_text?.trim()) throw new Error('alt_text wajib diisi.');

  const article = await db
    .prepare('SELECT id, slug, title, status, content_md, content_html, content_hash FROM articles WHERE id = ? LIMIT 1')
    .bind(params.article_id)
    .first();
  if (!article) throw new Error(`Article ${params.article_id} tidak ditemukan.`);
  if (article.status !== 'draft') throw new Error(`Article ${params.article_id} harus berstatus draft untuk membuat media requirement.`);

  if (await hasActiveJobForSlot(db, params.article_id, params.slot_key)) {
    throw new Error(`Active media job untuk article_id=${params.article_id} slot_key='${params.slot_key}' sudah ada.`);
  }

  const promptVersion = 1;
  const promptHash = await computePromptHash(params.prompt, promptVersion);
  const jobId = params.job_id || generateId('mjob');
  const priority = normalizePriority(params.priority);
  const requiredForReadiness = params.required_for_readiness === undefined ? (params.role === 'featured' ? 1 : 0) : (params.required_for_readiness ? 1 : 0);

  await db
    .prepare(
      `
      INSERT INTO media_jobs (
        job_id, article_id, article_slug, article_title,
        role, slot_key, sequence, media_type, prompt, prompt_version, prompt_hash, alt_text,
        aspect_ratio, target_width, target_height, required_for_readiness, priority,
        status, attempt, max_attempts, job_revision
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `
    )
    .bind(
      jobId,
      params.article_id,
      article.slug,
      article.title,
      params.role,
      params.slot_key,
      params.sequence || 0,
      params.media_type || 'image',
      params.prompt.trim(),
      promptVersion,
      promptHash,
      params.alt_text.trim(),
      params.aspect_ratio || '16:9',
      params.target_width || 1200,
      params.target_height || 675,
      requiredForReadiness,
      priority,
      JOB_STATUS_QUEUED,
      0,
      params.max_attempts || 3,
      1
    )
    .run();

  return (await getMediaJobById(db, jobId))!;
}

export async function createMediaJob(
  db: any,
  job: Partial<MediaJobRecord> & {
    article_id: number;
    article_slug?: string;
    article_title?: string;
    prompt: string;
    alt_text: string;
  }
): Promise<MediaJobRecord> {
  if (job.article_slug && job.article_title) {
    return createMediaRequirement(db, {
      job_id: job.job_id,
      article_id: job.article_id,
      slot_key: job.slot_key || (job.role === 'inline' ? 'inline_1' : 'featured'),
      role: job.role || 'featured',
      sequence: job.sequence,
      required_for_readiness: job.required_for_readiness === undefined ? undefined : Boolean(job.required_for_readiness),
      priority: job.priority,
      prompt: job.prompt,
      alt_text: job.alt_text,
      aspect_ratio: job.aspect_ratio,
      target_width: job.target_width,
      target_height: job.target_height,
      media_type: job.media_type,
      max_attempts: job.max_attempts
    });
  }

  return createMediaRequirement(db, {
    job_id: job.job_id,
    article_id: job.article_id,
    slot_key: job.slot_key || (job.role === 'inline' ? 'inline_1' : 'featured'),
    role: job.role || 'featured',
    sequence: job.sequence,
    required_for_readiness: job.required_for_readiness === undefined ? undefined : Boolean(job.required_for_readiness),
    priority: job.priority,
    prompt: job.prompt,
    alt_text: job.alt_text,
    aspect_ratio: job.aspect_ratio,
    target_width: job.target_width,
    target_height: job.target_height,
    media_type: job.media_type,
    max_attempts: job.max_attempts
  });
}

export async function transitionMediaJob(
  db: any,
  jobId: string,
  status: string,
  options: { incrementAttempt?: boolean; errorCode?: string; errorMessageSafe?: string; supersededByJobId?: string } = {}
): Promise<MediaJobRecord> {
  const existing = await getMediaJobById(db, jobId);
  if (!existing) throw new Error(`Pekerjaan media dengan ID '${jobId}' tidak ditemukan.`);

  const nextStatus = normalizeJobStatus(status);
  assertLegalTransition(existing.status, nextStatus);

  const currentAttempt = Number.isFinite(Number(existing.attempt)) ? Number(existing.attempt) : 0;
  const completedAt = nextStatus === JOB_STATUS_COMPLETE ? new Date().toISOString() : existing.completed_at || null;
  const nextAttempt = options.incrementAttempt ? currentAttempt + 1 : currentAttempt;

  await db
    .prepare(
      `
      UPDATE media_jobs
      SET status = ?,
          attempt = ?,
          last_error_code = ?,
          last_error_message_safe = ?,
          superseded_by_job_id = ?,
          completed_at = ?,
          job_revision = job_revision + 1,
          updated_at = CURRENT_TIMESTAMP
      WHERE job_id = ?
    `
    )
    .bind(
      nextStatus,
      nextAttempt,
      options.errorCode || existing.last_error_code,
      options.errorMessageSafe || existing.last_error_message_safe,
      options.supersededByJobId || existing.superseded_by_job_id,
      completedAt,
      jobId
    )
    .run();

  return (await getMediaJobById(db, jobId))!;
}

export async function updateMediaJobStatus(
  db: any,
  jobId: string,
  status: string,
  errorMessage?: string
): Promise<MediaJobRecord> {
  return transitionMediaJob(db, jobId, status, {
    incrementAttempt: normalizeJobStatus(status) === JOB_STATUS_WAITING_RETRY,
    errorMessageSafe: errorMessage
  });
}

export async function supersedeMediaJob(db: any, oldJobId: string, newJobId: string): Promise<MediaJobRecord> {
  return transitionMediaJob(db, oldJobId, JOB_STATUS_SUPERSEDED, { supersededByJobId: newJobId });
}

export async function appendMediaJobReceipt(db: any, params: MediaJobReceiptParams): Promise<any> {
  if (!RECEIPT_TYPES.has(params.receipt_type)) throw new Error(`receipt_type tidak valid: '${params.receipt_type}'`);
  const receiptId = params.receipt_id || generateId('mjr');
  await db
    .prepare(
      `
      INSERT OR IGNORE INTO media_job_receipts (
        receipt_id, job_id, idempotency_key, receipt_type, asset_id,
        article_media_id, sha256, safe_payload_json
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `
    )
    .bind(
      receiptId,
      params.job_id,
      params.idempotency_key,
      params.receipt_type,
      params.asset_id || null,
      params.article_media_id || null,
      params.sha256 || null,
      safeJson(params.safe_payload)
    )
    .run();

  return getReceiptByIdempotencyKey(db, params.job_id, params.idempotency_key, params.receipt_type);
}

export async function getReceiptByIdempotencyKey(db: any, jobId: string, idempotencyKey: string, receiptType?: string): Promise<any | null> {
  const typeClause = receiptType ? 'AND receipt_type = ?' : '';
  const bindings = receiptType ? [jobId, idempotencyKey, receiptType] : [jobId, idempotencyKey];
  return db
    .prepare(
      `
      SELECT receipt_id, job_id, idempotency_key, receipt_type, asset_id,
             article_media_id, sha256, safe_payload_json, created_at
      FROM media_job_receipts
      WHERE job_id = ? AND idempotency_key = ?
      ${typeClause}
      ORDER BY created_at DESC
      LIMIT 1
    `
    )
    .bind(...bindings)
    .first();
}

export async function appendMediaJobEvent(db: any, params: MediaJobEventParams): Promise<any> {
  if (!EVENT_TYPES.has(params.event_type)) throw new Error(`event_type tidak valid: '${params.event_type}'`);
  validateProgressPayload(params.event_type, params.safe_payload);
  const eventId = params.event_id || generateId('mje');
  const attempt = params.attempt || 0;
  await db
    .prepare(
      `
      INSERT INTO media_job_events (
        event_id, job_id, event_type, stage, attempt, safe_payload_json
      ) VALUES (?, ?, ?, ?, ?, ?)
    `
    )
    .bind(eventId, params.job_id, params.event_type, params.stage, attempt, safeJson(params.safe_payload))
    .run();

  return db
    .prepare(
      `
      SELECT event_id, job_id, event_type, stage, attempt, safe_payload_json, created_at
      FROM media_job_events
      WHERE event_id = ?
      LIMIT 1
    `
    )
    .bind(eventId)
    .first();
}

function iso(date: Date): string {
  return date.toISOString();
}

function parseTime(value: string | null | undefined): number {
  if (!value) return 0;
  const t = Date.parse(value);
  return Number.isFinite(t) ? t : 0;
}

function roleRank(role: string): number {
  return role === 'featured' ? 0 : 1;
}

function passRank(job: MediaJobRecord): number {
  return roleRank(job.role) === 0 ? 0 : Math.max(1, Number(job.sequence || 0) + 1);
}

function makeLeaseExpiry(now: Date, seconds: number): string {
  return iso(new Date(now.getTime() + seconds * 1000));
}

export function validateProtocolVersion(version: any): void {
  if (Number(version) !== LOKAMEDIA_PROTOCOL_VERSION) {
    throw new Error('PROTOCOL_VERSION_UNSUPPORTED');
  }
}

export function getRecommendedAction(job: MediaJobRecord, requesterDeviceId?: string | null, now: Date = new Date()): string {
  const status = normalizeJobStatus(job.status);
  if (status === JOB_STATUS_COMPLETE || status === JOB_STATUS_ATTACHMENT_CONFIRMED) return 'COMPLETE';
  if (status === JOB_STATUS_AUTH_REQUIRED) return 'REAUTHENTICATE';
  if (status === JOB_STATUS_SUPERSEDED || status === JOB_STATUS_CANCELLED || status === JOB_STATUS_FAILED_TERMINAL) return 'STOP';
  if (status === JOB_STATUS_WAITING_RETRY) return parseTime(job.next_retry_at) > now.getTime() ? 'WAIT' : 'RETRY';
  if (status === JOB_STATUS_CAPTURED || status === JOB_STATUS_UPLOAD_QUEUED) return 'RECONCILE_LOCAL_CAPTURE';
  if (job.lease_owner && requesterDeviceId && job.lease_owner !== requesterDeviceId && parseTime(job.lease_expires_at) > now.getTime()) return 'STOP';
  return 'CONTINUE';
}

export async function evaluateMediaJobEligibility(db: any, job: MediaJobRecord, now: Date = new Date()): Promise<EligibilityResult> {
  const status = normalizeJobStatus(job.status);
  if (isTerminalJobState(status)) return { eligible: false, reason: 'JOB_TERMINAL' };
  if (!SCHEDULABLE_STATES.has(status)) return { eligible: false, reason: 'STATUS_NOT_SCHEDULABLE' };
  if (job.superseded_by_job_id || status === JOB_STATUS_SUPERSEDED) return { eligible: false, reason: 'SUPERSEDED' };
  if (status === JOB_STATUS_CANCELLED) return { eligible: false, reason: 'CANCELLED' };
  if (parseTime(job.next_retry_at) > now.getTime()) return { eligible: false, reason: 'RETRY_NOT_DUE' };
  if (Number(job.attempt || 0) >= Number(job.max_attempts || 3)) return { eligible: false, reason: 'MAX_ATTEMPTS_REACHED' };
  if (job.lease_owner && parseTime(job.lease_expires_at) > now.getTime()) return { eligible: false, reason: 'LEASE_ACTIVE' };
  if (!job.prompt?.trim() || Number(job.prompt_version || 0) < 1 || !job.prompt_hash?.trim()) return { eligible: false, reason: 'INVALID_PROMPT_CONTRACT' };

  const article = await db
    .prepare('SELECT id, status FROM articles WHERE id = ? LIMIT 1')
    .bind(job.article_id)
    .first();
  if (!article) return { eligible: false, reason: 'ARTICLE_NOT_FOUND' };
  if (article.status !== 'draft') return { eligible: false, reason: 'ARTICLE_NOT_DRAFT' };

  const replacement = await db
    .prepare(
      `
      SELECT job_id
      FROM media_jobs
      WHERE article_id = ?
        AND slot_key = ?
        AND job_id <> ?
        AND status NOT IN ('COMPLETE', 'FAILED_TERMINAL', 'SUPERSEDED', 'CANCELLED')
      LIMIT 1
    `
    )
    .bind(job.article_id, job.slot_key, job.job_id)
    .first();
  if (replacement) return { eligible: false, reason: 'REQUIREMENT_REPLACED' };

  return { eligible: true };
}

export async function listSchedulerCandidates(db: any, now: Date = new Date(), limit: number = 200): Promise<MediaJobRecord[]> {
  const { results } = await db
    .prepare(
      `
      SELECT ${selectColumns()}
      FROM media_jobs
      WHERE status IN ('QUEUED', 'WAITING_RETRY')
        AND (next_retry_at IS NULL OR next_retry_at <= ?)
        AND (lease_expires_at IS NULL OR lease_expires_at <= ?)
        AND attempt < max_attempts
      ORDER BY priority DESC, created_at ASC, job_id ASC
      LIMIT ?
    `
    )
    .bind(iso(now), iso(now), limit)
    .all();
  return (results || []) as MediaJobRecord[];
}

export async function chooseNextMediaJob(db: any, now: Date = new Date()): Promise<MediaJobRecord | null> {
  const candidates = await listSchedulerCandidates(db, now);
  const eligible: MediaJobRecord[] = [];
  for (const job of candidates) {
    const eligibility = await evaluateMediaJobEligibility(db, job, now);
    if (eligibility.eligible) eligible.push(job);
  }
  if (eligible.length === 0) return null;

  eligible.sort((a, b) => {
    const priority = Number(b.priority) - Number(a.priority);
    if (priority !== 0) return priority;
    const pass = passRank(a) - passRank(b);
    if (pass !== 0) return pass;
    const required = Number(b.required_for_readiness) - Number(a.required_for_readiness);
    if (required !== 0) return required;
    const sequence = Number(a.sequence) - Number(b.sequence);
    if (sequence !== 0) return sequence;
    const articleAge = parseTime(a.created_at) - parseTime(b.created_at);
    if (articleAge !== 0) return articleAge;
    return String(a.job_id).localeCompare(String(b.job_id));
  });

  return eligible[0];
}

export async function acquireMediaJobLease(
  db: any,
  deviceId: string,
  options: LeaseOptions = {}
): Promise<{ acquired: boolean; job?: MediaJobRecord; code?: string; retry_after_ms?: number }> {
  const now = options.now || new Date();
  const leaseSeconds = options.leaseSeconds || MEDIA_JOB_LEASE_SECONDS;

  for (let i = 0; i < 3; i++) {
    const candidate = await chooseNextMediaJob(db, now);
    if (!candidate) return { acquired: false, code: 'NO_ELIGIBLE_JOB', retry_after_ms: NO_ELIGIBLE_JOB_RETRY_AFTER_MS };
    const leaseExpiresAt = makeLeaseExpiry(now, leaseSeconds);
    const res = await db
      .prepare(
        `
        UPDATE media_jobs
        SET status = 'LEASED',
            lease_owner = ?,
            lease_expires_at = ?,
            heartbeat_at = ?,
            job_revision = job_revision + 1,
            updated_at = CURRENT_TIMESTAMP
        WHERE job_id = ?
          AND job_revision = ?
          AND status IN ('QUEUED', 'WAITING_RETRY')
          AND (lease_expires_at IS NULL OR lease_expires_at <= ?)
      `
      )
      .bind(deviceId, leaseExpiresAt, iso(now), candidate.job_id, candidate.job_revision, iso(now))
      .run();
    const changed = Number(res?.meta?.changes ?? res?.changes ?? 0);
    if (changed === 1) return { acquired: true, job: (await getMediaJobById(db, candidate.job_id))! };
  }

  return { acquired: false, code: 'LEASE_CONFLICT', retry_after_ms: 1000 };
}

export async function heartbeatMediaJobLease(
  db: any,
  jobId: string,
  deviceId: string,
  expectedJobRevision: number,
  options: LeaseOptions = {}
): Promise<MediaJobRecord> {
  const now = options.now || new Date();
  const job = await getMediaJobById(db, jobId);
  if (!job) throw new Error('JOB_NOT_FOUND');
  if (isTerminalJobState(job.status)) throw new Error('JOB_TERMINAL');
  if (job.lease_owner !== deviceId) throw new Error('LEASE_NOT_OWNER');
  if (parseTime(job.lease_expires_at) <= now.getTime()) throw new Error('LEASE_EXPIRED');
  if (Number(job.job_revision) !== Number(expectedJobRevision)) throw new Error('JOB_REVISION_CONFLICT');

  await db
    .prepare(
      `
      UPDATE media_jobs
      SET heartbeat_at = ?,
          lease_expires_at = ?,
          updated_at = CURRENT_TIMESTAMP
      WHERE job_id = ?
        AND lease_owner = ?
        AND job_revision = ?
    `
    )
    .bind(iso(now), makeLeaseExpiry(now, options.leaseSeconds || MEDIA_JOB_LEASE_SECONDS), jobId, deviceId, expectedJobRevision)
    .run();

  return (await getMediaJobById(db, jobId))!;
}

export async function recoverExpiredLease(db: any, jobId: string, now: Date = new Date()): Promise<MediaJobRecord> {
  const job = await getMediaJobById(db, jobId);
  if (!job) throw new Error('JOB_NOT_FOUND');
  if (isTerminalJobState(job.status)) throw new Error('JOB_TERMINAL');
  if (!job.lease_expires_at || parseTime(job.lease_expires_at) > now.getTime()) throw new Error('LEASE_ACTIVE');

  await db
    .prepare(
      `
      UPDATE media_jobs
      SET status = 'RECOVERING',
          lease_owner = NULL,
          lease_expires_at = NULL,
          heartbeat_at = NULL,
          job_revision = job_revision + 1,
          updated_at = CURRENT_TIMESTAMP
      WHERE job_id = ?
    `
    )
    .bind(jobId)
    .run();

  await appendMediaJobEvent(db, {
    job_id: jobId,
    event_type: 'JOB_RECOVERING',
    stage: JOB_STATUS_RECOVERING,
    attempt: Number(job.attempt || 0),
    safe_payload: { reason: 'LEASE_EXPIRED' }
  });

  return (await getMediaJobById(db, jobId))!;
}

export async function releaseMediaJobLease(
  db: any,
  jobId: string,
  deviceId: string,
  expectedJobRevision: number,
  intent: 'SAFE_REQUEUE' | 'WAITING_RETRY' | 'RECOVERING' | 'USER_ACTION_REQUIRED',
  reasonCode: string,
  messageSafe?: string,
  now: Date = new Date()
): Promise<MediaJobRecord> {
  const job = await getMediaJobById(db, jobId);
  if (!job) throw new Error('JOB_NOT_FOUND');
  if (isTerminalJobState(job.status)) throw new Error('JOB_TERMINAL');
  if (job.lease_owner !== deviceId) throw new Error('LEASE_NOT_OWNER');
  if (Number(job.job_revision) !== Number(expectedJobRevision)) throw new Error('JOB_REVISION_CONFLICT');

  const nextStatus =
    intent === 'SAFE_REQUEUE' ? JOB_STATUS_QUEUED :
    intent === 'WAITING_RETRY' ? JOB_STATUS_WAITING_RETRY :
    intent === 'RECOVERING' ? JOB_STATUS_RECOVERING :
    JOB_STATUS_USER_ACTION_REQUIRED;
  assertLegalTransition(job.status, nextStatus);

  const retry = intent === 'WAITING_RETRY' ? calculateRetry(job, reasonCode, now) : null;
  await db
    .prepare(
      `
      UPDATE media_jobs
      SET status = ?,
          lease_owner = NULL,
          lease_expires_at = NULL,
          heartbeat_at = NULL,
          attempt = ?,
          next_retry_at = ?,
          last_error_code = ?,
          last_error_message_safe = ?,
          job_revision = job_revision + 1,
          updated_at = CURRENT_TIMESTAMP
      WHERE job_id = ? AND lease_owner = ? AND job_revision = ?
    `
    )
    .bind(
      nextStatus,
      retry ? retry.attempt : job.attempt,
      retry ? retry.next_retry_at : job.next_retry_at,
      reasonCode,
      messageSafe || job.last_error_message_safe,
      jobId,
      deviceId,
      expectedJobRevision
    )
    .run();

  return (await getMediaJobById(db, jobId))!;
}

export function calculateRetry(job: MediaJobRecord, errorCode: string, now: Date = new Date()): { status: string; attempt: number; next_retry_at: string | null } {
  const rule = RETRY_FAILURES[errorCode] || RETRY_FAILURES.TRANSIENT_NETWORK;
  const attempt = Number(job.attempt || 0) + 1;
  if (!rule.retryable || attempt >= Number(job.max_attempts || 3)) {
    return { status: rule.status === JOB_STATUS_WAITING_RETRY ? JOB_STATUS_FAILED_TERMINAL : rule.status, attempt, next_retry_at: null };
  }
  const jitter = Math.min(30, attempt * 7);
  const delay = rule.baseDelaySeconds * Math.pow(2, Math.max(0, attempt - 1)) + jitter;
  return { status: JOB_STATUS_WAITING_RETRY, attempt, next_retry_at: iso(new Date(now.getTime() + delay * 1000)) };
}

export async function scheduleMediaJobRetry(
  db: any,
  jobId: string,
  errorCode: string,
  messageSafe?: string,
  now: Date = new Date()
): Promise<MediaJobRecord> {
  const job = await getMediaJobById(db, jobId);
  if (!job) throw new Error('JOB_NOT_FOUND');
  if (isTerminalJobState(job.status)) throw new Error('JOB_TERMINAL');
  const retry = calculateRetry(job, errorCode, now);
  assertLegalTransition(job.status, retry.status);
  await db
    .prepare(
      `
      UPDATE media_jobs
      SET status = ?,
          attempt = ?,
          next_retry_at = ?,
          last_error_code = ?,
          last_error_message_safe = ?,
          lease_owner = NULL,
          lease_expires_at = NULL,
          heartbeat_at = NULL,
          job_revision = job_revision + 1,
          updated_at = CURRENT_TIMESTAMP
      WHERE job_id = ?
    `
    )
    .bind(retry.status, retry.attempt, retry.next_retry_at, errorCode, messageSafe || null, jobId)
    .run();
  return (await getMediaJobById(db, jobId))!;
}

export async function appendLeasedProgressEvent(
  db: any,
  params: MediaJobEventParams & { device_id: string; expected_job_revision?: number }
): Promise<any> {
  const job = await getMediaJobById(db, params.job_id);
  if (!job) throw new Error('JOB_NOT_FOUND');
  if (isTerminalJobState(job.status)) throw new Error('JOB_TERMINAL');
  if (job.lease_owner && job.lease_owner !== params.device_id) throw new Error('LEASE_NOT_OWNER');
  if (params.expected_job_revision !== undefined && Number(params.expected_job_revision) !== Number(job.job_revision)) {
    throw new Error('JOB_REVISION_CONFLICT');
  }
  const payloadJson = safeJson(params.safe_payload);
  return appendMediaJobEvent(db, params);
}

export async function getLatestReceiptForJob(db: any, jobId: string): Promise<any | null> {
  return db
    .prepare(
      `
      SELECT receipt_id, job_id, idempotency_key, receipt_type, asset_id,
             article_media_id, sha256, safe_payload_json, created_at
      FROM media_job_receipts
      WHERE job_id = ?
      ORDER BY created_at DESC
      LIMIT 1
    `
    )
    .bind(jobId)
    .first();
}

export async function reconcileMediaJob(db: any, jobId: string, requesterDeviceId?: string | null, now: Date = new Date()): Promise<ReconcileResult> {
  const job = await getMediaJobById(db, jobId);
  if (!job) throw new Error('JOB_NOT_FOUND');
  const latestReceipt = await getLatestReceiptForJob(db, jobId);
  let activeAttachment: any = null;
  try {
    activeAttachment = await db
      .prepare(
        `
        SELECT am.id AS article_media_id, am.asset_id
        FROM article_media am
        JOIN media_assets ma ON am.asset_id = ma.asset_id
        WHERE am.article_id = ? AND am.slot_key = ? AND am.is_active = 1 AND ma.status = 'VALIDATED'
        LIMIT 1
      `
      )
      .bind(job.article_id, job.slot_key)
      .first();
  } catch (_) {
    activeAttachment = null;
  }

  const leaseActive = Boolean(job.lease_owner && parseTime(job.lease_expires_at) > now.getTime());
  const attachmentConfirmed = Boolean(activeAttachment || latestReceipt?.receipt_type === 'ATTACHMENT_CONFIRMED');
  const baseRecommendedAction = getRecommendedAction(job, requesterDeviceId, now);
  return {
    protocol_version: LOKAMEDIA_PROTOCOL_VERSION,
    job_id: job.job_id,
    job_revision: Number(job.job_revision),
    status: normalizeJobStatus(job.status),
    article_id: Number(job.article_id),
    slot_key: job.slot_key,
    lease_owner: job.lease_owner,
    lease_expires_at: job.lease_expires_at,
    lease_owned_by_requester: Boolean(requesterDeviceId && job.lease_owner === requesterDeviceId),
    lease_active: leaseActive,
    attempt: Number(job.attempt || 0),
    prompt_version: Number(job.prompt_version || 1),
    prompt_hash: job.prompt_hash,
    idempotency_key: job.idempotency_key,
    latest_receipt: latestReceipt,
    asset_id: activeAttachment?.asset_id || latestReceipt?.asset_id || null,
    attachment_confirmed: attachmentConfirmed,
    next_retry_at: job.next_retry_at,
    last_error_code: job.last_error_code,
    last_error_message_safe: job.last_error_message_safe,
    completed_at: job.completed_at,
    recommended_action: baseRecommendedAction === 'STOP' ? 'STOP' : (attachmentConfirmed ? 'COMPLETE' : baseRecommendedAction)
  };
}

export function publicLeasePayload(job: MediaJobRecord): Record<string, any> {
  return {
    protocol_version: LOKAMEDIA_PROTOCOL_VERSION,
    job_id: job.job_id,
    job_revision: job.job_revision,
    article_id: job.article_id,
    article_title: job.article_title,
    slot_key: job.slot_key,
    role: job.role,
    sequence: job.sequence,
    required_for_readiness: Boolean(job.required_for_readiness),
    priority: job.priority,
    prompt: job.prompt,
    prompt_version: job.prompt_version,
    prompt_hash: job.prompt_hash,
    alt_text: job.alt_text,
    aspect_ratio: job.aspect_ratio,
    target_width: job.target_width,
    target_height: job.target_height,
    lease_expires_at: job.lease_expires_at,
    attempt: job.attempt
  };
}

export const CANARY_ARTICLE_ID = 1;
export const CANARY_SLOT_KEY = 'inline_canary_a57';
export const CANARY_IDEMPOTENCY_KEY = 'a57_canary_idemp_20260927';
export const CANARY_PROVENANCE_MARKER = 'RANCANGLOKA_A57_PRODUCTION_CANARY';

/**
 * Canonical helper to cancel a media job.
 * Transitions to CANCELLED and records optional error message.
 * Safe from QUEUED, LEASED, and WAITING_RETRY.
 */
export async function cancelMediaJob(
  db: any,
  jobId: string,
  options: { reason?: string } = {}
): Promise<MediaJobRecord> {
  return transitionMediaJob(db, jobId, JOB_STATUS_CANCELLED, {
    errorMessageSafe: options.reason || 'Pekerjaan dibatalkan oleh operator.'
  });
}

/**
 * Canonical helper to create or retrieve the production canary media job.
 * Enforces Article 1, inline slot, LOCAL_FIXTURE metadata, and idempotency.
 */
export async function createCanaryMediaJob(
  db: any,
  options: { jobId?: string; prompt?: string; altText?: string } = {}
): Promise<{ job: MediaJobRecord; created: boolean }> {
  // Check if active canary job already exists
  const existingRows = await listMediaJobs(db, { articleId: CANARY_ARTICLE_ID, limit: 10 });
  const activeCanary = existingRows.find(
    (j) => j.slot_key === CANARY_SLOT_KEY && !TERMINAL_STATES.has(normalizeJobStatus(j.status))
  );

  if (activeCanary) {
    return {
      job: activeCanary,
      created: false
    };
  }

  const article = await db
    .prepare('SELECT id, slug, title, status FROM articles WHERE id = ? LIMIT 1')
    .bind(CANARY_ARTICLE_ID)
    .first();

  if (!article) {
    throw new Error(`Canary article ID ${CANARY_ARTICLE_ID} not found.`);
  }

  const job = await createMediaJob(db, {
    job_id: options.jobId,
    article_id: CANARY_ARTICLE_ID,
    article_slug: article.slug,
    article_title: article.title,
    role: 'inline',
    slot_key: CANARY_SLOT_KEY,
    prompt: options.prompt || `A5.7 Production Canary: contemporary architectural timber louvers [${CANARY_PROVENANCE_MARKER}]`,
    alt_text: options.altText || 'A5.7 Production Canary Alt Text',
    priority: 100
  });

  return {
    job,
    created: true
  };
}
