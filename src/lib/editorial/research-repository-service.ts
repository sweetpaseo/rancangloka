/**
 * RancangLoka — Irwan Research Repository Service (UTLIS-V1 Phase 3)
 *
 * Indexes Irwan's evidence packs into D1 (`research_evidence_packs`) using
 * lightweight metadata & artifact pointers (`storage/masters/art100XX/evidence_pack.json`)
 * without redundantly duplicating full payloads.
 *
 * Supports:
 * - Search by topic, keyword, domain, claim, technical standard, or article.
 * - Claim-level verification & freshness tracking (FRESH / STALE / EXPIRED / UNVERIFIED).
 * - Research reuse tracking (`reuse_count`, `reuse_history_json`).
 */

import fs from 'node:fs';
import path from 'node:path';
import type {
  ResearchEvidenceIndexRecord,
  ResearchFreshnessStatus
} from './topic-lifecycle-contracts.ts';

export interface ResearchIndexInput {
  research_id: string;
  topic_id?: string | null;
  canonical_article_uid?: string | null;
  research_domain: string;
  topic_keywords: string;
  evidence_claims: Array<{ claim_id: string; statement: string; support_level?: string; standard_ref?: string }>;
  source_references: Array<{ source_id?: string; title: string; url?: string; publisher?: string }>;
  document_editions?: string[];
  section_references?: string[];
  source_provenance?: string;
  verified_at?: string | null;
  freshness_days?: number; // default 180 days
  artifact_reference: string;
}

export function evaluateResearchFreshness(
  freshnessExpiresAt: string | null | undefined,
  sourceProvenance: string | null | undefined,
  nowIso: string = new Date().toISOString()
): ResearchFreshnessStatus {
  if (!sourceProvenance || sourceProvenance === 'UNVERIFIED') {
    return 'UNVERIFIED';
  }
  if (!freshnessExpiresAt) return 'FRESH';

  const nowMs = Date.parse(nowIso);
  const expMs = Date.parse(freshnessExpiresAt);
  if (isNaN(expMs)) return 'UNVERIFIED';
  if (nowMs > expMs) return 'EXPIRED';

  const thirtyDaysMs = 30 * 24 * 60 * 60 * 1000;
  if (expMs - nowMs <= thirtyDaysMs) return 'STALE';

  return 'FRESH';
}

export async function indexResearchEvidencePack(
  db: any,
  input: ResearchIndexInput
): Promise<{ success: boolean; research_id: string; freshness_status: ResearchFreshnessStatus }> {
  const verifiedAt = input.verified_at || new Date().toISOString();
  const freshnessDays = input.freshness_days ?? 180;
  const expiresAt = new Date(Date.parse(verifiedAt) + freshnessDays * 24 * 60 * 60 * 1000).toISOString();
  const provenance = input.source_provenance || 'VERIFIED_PRIMARY';
  const freshnessStatus = evaluateResearchFreshness(expiresAt, provenance);

  if (db && typeof db.prepare === 'function') {
    await db
      .prepare(`
        INSERT INTO research_evidence_packs (
          research_id, topic_id, canonical_article_uid, research_domain, topic_keywords,
          evidence_claims_json, source_references_json, document_editions_json,
          section_references_json, source_provenance, verified_at, freshness_expires_at,
          freshness_status, artifact_reference, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
        ON CONFLICT(research_id) DO UPDATE SET
          topic_id = COALESCE(excluded.topic_id, research_evidence_packs.topic_id),
          canonical_article_uid = COALESCE(excluded.canonical_article_uid, research_evidence_packs.canonical_article_uid),
          research_domain = excluded.research_domain,
          topic_keywords = excluded.topic_keywords,
          evidence_claims_json = excluded.evidence_claims_json,
          source_references_json = excluded.source_references_json,
          document_editions_json = excluded.document_editions_json,
          section_references_json = excluded.section_references_json,
          source_provenance = excluded.source_provenance,
          verified_at = excluded.verified_at,
          freshness_expires_at = excluded.freshness_expires_at,
          freshness_status = excluded.freshness_status,
          artifact_reference = excluded.artifact_reference,
          updated_at = CURRENT_TIMESTAMP
      `)
      .bind(
        input.research_id,
        input.topic_id || null,
        input.canonical_article_uid || null,
        input.research_domain,
        input.topic_keywords,
        JSON.stringify(input.evidence_claims || []),
        JSON.stringify(input.source_references || []),
        JSON.stringify(input.document_editions || []),
        JSON.stringify(input.section_references || []),
        provenance,
        verifiedAt,
        expiresAt,
        freshnessStatus,
        input.artifact_reference
      )
      .run();
  }

  return {
    success: true,
    research_id: input.research_id,
    freshness_status: freshnessStatus
  };
}

export async function searchResearchRepository(
  db: any,
  filters?: {
    query?: string;
    domain?: string;
    freshness?: ResearchFreshnessStatus;
    topicId?: string;
    limit?: number;
  }
): Promise<ResearchEvidenceIndexRecord[]> {
  if (!db || typeof db.prepare !== 'function') return [];

  const conditions: string[] = ['1=1'];
  const params: any[] = [];

  if (filters?.domain) {
    conditions.push('research_domain = ?');
    params.push(filters.domain);
  }
  if (filters?.freshness) {
    conditions.push('freshness_status = ?');
    params.push(filters.freshness);
  }
  if (filters?.topicId) {
    conditions.push('topic_id = ?');
    params.push(filters.topicId);
  }
  if (filters?.query && filters.query.trim()) {
    const q = `%${filters.query.trim().toLowerCase()}%`;
    conditions.push(`(
      LOWER(research_id) LIKE ? OR
      LOWER(COALESCE(topic_keywords, '')) LIKE ? OR
      LOWER(research_domain) LIKE ? OR
      LOWER(evidence_claims_json) LIKE ? OR
      LOWER(source_references_json) LIKE ? OR
      LOWER(artifact_reference) LIKE ?
    )`);
    params.push(q, q, q, q, q, q);
  }

  const limit = Math.min(100, Math.max(1, filters?.limit || 50));
  const sql = `
    SELECT * FROM research_evidence_packs
    WHERE ${conditions.join(' AND ')}
    ORDER BY verified_at DESC, updated_at DESC
    LIMIT ?
  `;
  params.push(limit);

  const res = await db.prepare(sql).bind(...params).all();
  const rows = (res?.results || []) as ResearchEvidenceIndexRecord[];

  // Dynamically re-evaluate freshness status on read
  const nowIso = new Date().toISOString();
  return rows.map((r) => ({
    ...r,
    freshness_status: evaluateResearchFreshness(r.freshness_expires_at, r.source_provenance, nowIso)
  }));
}

/**
 * Records reuse of an existing verified research pack for a new topic or angle.
 * Enforces freshness check: EXPIRED or UNVERIFIED packs cannot be reused blindly.
 */
export async function recordResearchReuse(
  db: any,
  researchId: string,
  targetTopicId: string,
  actor: string,
  verificationNote: string
): Promise<{
  allowed: boolean;
  freshness_status: ResearchFreshnessStatus;
  reason: string;
  reuse_count: number;
}> {
  if (!db || typeof db.prepare !== 'function') {
    return { allowed: false, freshness_status: 'UNVERIFIED', reason: 'DB unavailable', reuse_count: 0 };
  }

  const row = await db
    .prepare('SELECT * FROM research_evidence_packs WHERE research_id = ? LIMIT 1')
    .bind(researchId)
    .first() as ResearchEvidenceIndexRecord | null;

  if (!row) {
    return { allowed: false, freshness_status: 'UNVERIFIED', reason: `Research ${researchId} not found.`, reuse_count: 0 };
  }

  const currentFreshness = evaluateResearchFreshness(row.freshness_expires_at, row.source_provenance);
  if (currentFreshness === 'EXPIRED' || currentFreshness === 'UNVERIFIED') {
    return {
      allowed: false,
      freshness_status: currentFreshness,
      reason: `Research ${researchId} berstatus ${currentFreshness}. Wajib verifikasi ulang sumber primer oleh Irwan sebelum digunakan kembali.`,
      reuse_count: row.reuse_count
    };
  }

  let history: any[] = [];
  try {
    history = JSON.parse(row.reuse_history_json || '[]');
  } catch (_) {}

  history.push({
    target_topic_id: targetTopicId,
    actor,
    reused_at: new Date().toISOString(),
    freshness_at_reuse: currentFreshness,
    note: verificationNote
  });

  const nextCount = Number(row.reuse_count || 0) + 1;

  await db
    .prepare(`
      UPDATE research_evidence_packs
      SET reuse_count = ?,
          reuse_history_json = ?,
          freshness_status = ?,
          updated_at = CURRENT_TIMESTAMP
      WHERE research_id = ?
    `)
    .bind(nextCount, JSON.stringify(history), currentFreshness, researchId)
    .run();

  return {
    allowed: true,
    freshness_status: currentFreshness,
    reason: `Research ${researchId} terverifikasi (${currentFreshness}) dan digunakan kembali untuk ${targetTopicId}.`,
    reuse_count: nextCount
  };
}

/**
 * Resolves and loads the full Evidence Pack JSON payload for Hermes runtime or local worker.
 * Checks candidate base directories (including /opt/data/rancangloka on hosted Hermes).
 * Falls back to DB-cached metadata if the filesystem artifact is unreachable.
 */
export async function loadResearchEvidencePayload(
  recordOrRef: string | ResearchEvidenceIndexRecord,
  options?: { baseDir?: string; db?: any }
): Promise<{
  success: boolean;
  payload?: any;
  resolved_path?: string;
  source: 'FILESYSTEM' | 'DB_CACHED' | 'NOT_FOUND';
  error?: string;
}> {
  let artifactRef = typeof recordOrRef === 'string' ? recordOrRef : recordOrRef.artifact_reference;
  let record: ResearchEvidenceIndexRecord | null = typeof recordOrRef === 'object' ? recordOrRef : null;

  // If researchId was passed instead of a file path, load the record from DB first
  if (typeof recordOrRef === 'string' && !recordOrRef.includes('/') && !recordOrRef.includes('\\') && options?.db) {
    try {
      record = await options.db
        .prepare('SELECT * FROM research_evidence_packs WHERE research_id = ? LIMIT 1')
        .bind(recordOrRef)
        .first() as ResearchEvidenceIndexRecord | null;
      if (record?.artifact_reference) {
        artifactRef = record.artifact_reference;
      }
    } catch (_) {}
  }

  // Normalize path and remove leading slashes
  const cleanRef = (artifactRef || '').replace(/^[\\/]+/, '').replace(/\\/g, '/');

  // Candidate root directories for Hermes / local / server runtime
  const candidateRoots: string[] = [];
  if (options?.baseDir) candidateRoots.push(options.baseDir);
  if (typeof process !== 'undefined' && process.cwd) {
    candidateRoots.push(process.cwd());
    candidateRoots.push(path.resolve(process.cwd(), '..'));
  }
  // Standard container mount points for hosted Hermes daemon
  candidateRoots.push('/opt/data/rancangloka');
  candidateRoots.push('/opt/hermes/data/rancangloka');
  candidateRoots.push('/opt/hermes');

  for (const root of candidateRoots) {
    if (!root) continue;
    try {
      const candidatePath = path.resolve(root, cleanRef);
      if (fs.existsSync(candidatePath)) {
        const raw = fs.readFileSync(candidatePath, 'utf8');
        const payload = JSON.parse(raw);
        return {
          success: true,
          payload,
          resolved_path: candidatePath,
          source: 'FILESYSTEM'
        };
      }
    } catch (_) {}
  }

  // Fallback: If DB record is available, construct usable payload from indexed JSON columns
  if (record && record.evidence_claims_json) {
    try {
      const claims = JSON.parse(record.evidence_claims_json || '[]');
      const sources = JSON.parse(record.source_references_json || '[]');
      return {
        success: true,
        payload: {
          research_id: record.research_id,
          topic_id: record.topic_id,
          topic: record.topic_keywords,
          author_safe_claims: claims,
          source_references: sources,
          document_editions: JSON.parse(record.document_editions_json || '[]')
        },
        source: 'DB_CACHED'
      };
    } catch (_) {}
  }

  return {
    success: false,
    source: 'NOT_FOUND',
    error: `Evidence artifact "${cleanRef}" could not be located in persistent storage or DB.`
  };
}
