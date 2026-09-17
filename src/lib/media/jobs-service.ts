/**
 * RancangLoka — LokaMedia Jobs Service (MEDIA-1)
 *
 * Provides database queries and state machine transitions for pending media jobs.
 * Ensures:
 * - Articles remain strictly in 'draft' status (never mutated to published).
 * - Jobs transition through: PENDING -> IN_PROGRESS -> READY_TO_UPLOAD -> UPLOADING -> ATTACHED | FAILED | SKIPPED.
 * - Idempotency on repeated updates.
 */

export const JOB_STATUS_PENDING = 'PENDING';
export const JOB_STATUS_IN_PROGRESS = 'IN_PROGRESS';
export const JOB_STATUS_READY_TO_UPLOAD = 'READY_TO_UPLOAD';
export const JOB_STATUS_UPLOADING = 'UPLOADING';
export const JOB_STATUS_ATTACHED = 'ATTACHED';
export const JOB_STATUS_FAILED = 'FAILED';
export const JOB_STATUS_SKIPPED = 'SKIPPED';

export const VALID_JOB_STATUSES = new Set([
  JOB_STATUS_PENDING,
  JOB_STATUS_IN_PROGRESS,
  JOB_STATUS_READY_TO_UPLOAD,
  JOB_STATUS_UPLOADING,
  JOB_STATUS_ATTACHED,
  JOB_STATUS_FAILED,
  JOB_STATUS_SKIPPED
]);

export interface MediaJobRecord {
  job_id: string;
  article_id: number;
  article_slug: string;
  article_title: string;
  role: 'featured' | 'inline';
  slot_key: string;
  media_type: 'image' | 'video';
  prompt: string;
  alt_text: string;
  aspect_ratio: string;
  target_width: number;
  target_height: number;
  status: string;
  created_at: string;
  updated_at: string;
}

export interface ListJobsParams {
  status?: string;
  articleId?: number;
  limit?: number;
}

/**
 * Lists media jobs with optional filtering.
 */
export async function listMediaJobs(
  db: any,
  params: ListJobsParams = {}
): Promise<MediaJobRecord[]> {
  const conditions: string[] = [];
  const bindings: any[] = [];

  if (params.status && params.status !== 'all') {
    conditions.push('status = ?');
    bindings.push(params.status);
  }

  if (params.articleId) {
    conditions.push('article_id = ?');
    bindings.push(params.articleId);
  }

  const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
  const limit = Math.min(Math.max(params.limit || 20, 1), 100);

  const querySql = `
    SELECT
      job_id, article_id, article_slug, article_title,
      role, slot_key, media_type, prompt, alt_text,
      aspect_ratio, target_width, target_height,
      status, created_at, updated_at
    FROM media_jobs
    ${whereClause}
    ORDER BY created_at ASC
    LIMIT ?
  `;
  bindings.push(limit);

  const { results } = await db.prepare(querySql).bind(...bindings).all();
  return (results || []) as MediaJobRecord[];
}

/**
 * Retrieves a single media job by job_id.
 */
export async function getMediaJobById(
  db: any,
  jobId: string
): Promise<MediaJobRecord | null> {
  const row = await db
    .prepare(
      `
      SELECT
        job_id, article_id, article_slug, article_title,
        role, slot_key, media_type, prompt, alt_text,
        aspect_ratio, target_width, target_height,
        status, created_at, updated_at
      FROM media_jobs
      WHERE job_id = ?
      LIMIT 1
    `
    )
    .bind(jobId)
    .first();

  return (row as MediaJobRecord) || null;
}

/**
 * Updates the status of a media job.
 */
export async function updateMediaJobStatus(
  db: any,
  jobId: string,
  status: string,
  errorMessage?: string
): Promise<MediaJobRecord> {
  if (!VALID_JOB_STATUSES.has(status)) {
    throw new Error(`Status pekerjaan media tidak valid: '${status}'`);
  }

  const existing = await getMediaJobById(db, jobId);
  if (!existing) {
    throw new Error(`Pekerjaan media dengan ID '${jobId}' tidak ditemukan.`);
  }

  await db
    .prepare(
      `
      UPDATE media_jobs
      SET status = ?, updated_at = CURRENT_TIMESTAMP
      WHERE job_id = ?
    `
    )
    .bind(status, jobId)
    .run();

  const updated = await getMediaJobById(db, jobId);
  return updated!;
}

/**
 * Creates a new media job record.
 */
export async function createMediaJob(
  db: any,
  job: Partial<MediaJobRecord> & {
    article_id: number;
    article_slug: string;
    article_title: string;
    prompt: string;
    alt_text: string;
  }
): Promise<MediaJobRecord> {
  const jobId =
    job.job_id ||
    `mjob_${Date.now()}_${Math.random().toString(36).substring(2, 10)}`;

  const role = job.role || 'featured';
  const slotKey = job.slot_key || 'primary';
  const mediaType = job.media_type || 'image';
  const aspectRatio = job.aspect_ratio || '16:9';
  const targetWidth = job.target_width || 1200;
  const targetHeight = job.target_height || 675;
  const status = job.status || JOB_STATUS_PENDING;

  await db
    .prepare(
      `
      INSERT INTO media_jobs (
        job_id, article_id, article_slug, article_title,
        role, slot_key, media_type, prompt, alt_text,
        aspect_ratio, target_width, target_height, status
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `
    )
    .bind(
      jobId,
      job.article_id,
      job.article_slug,
      job.article_title,
      role,
      slotKey,
      mediaType,
      job.prompt,
      job.alt_text,
      aspectRatio,
      targetWidth,
      targetHeight,
      status
    )
    .run();

  return (await getMediaJobById(db, jobId))!;
}
