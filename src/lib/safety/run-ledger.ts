/**
 * RancangLoka — Consolidated Publication Run Ledger Read Model
 * Milestone: SOAK-0
 * 
 * Centralized observability read model correlating:
 * Topic -> Orchestrator Job -> Outbox -> D1 Article -> LokaMedia ->
 * Readiness -> Approval -> Plan -> Execution -> Receipt -> Feedback.
 * 
 * Invariant: READ-ONLY OBSERVABILITY ONLY. Never mutates business state.
 */

import { type RunLedgerEntry } from './safety-types.ts';

/**
 * Fetch correlated run ledger entries by optional filter
 */
export async function getPublicationRunLedger(
  db: any,
  options: {
    articleId?: string;
    slug?: string;
    executionId?: string;
    limit?: number;
  } = {}
): Promise<RunLedgerEntry[]> {
  const limit = Math.min(options.limit || 50, 200);

  // We perform a joined read query across underlying tables without altering them
  let query = `
    SELECT 
      a.id as d1_article_id,
      a.slug as article_slug,
      a.status as article_status,
      COALESCE(air.job_id, CAST(a.id AS TEXT)) as correlation_id,
      air.source_article_id as ingest_request_id,
      air.job_id as ingest_receipt_id,
      apr.id as readiness_snapshot_id,
      apr.overall_status as readiness_status,
      aea.id as editorial_approval_id,
      app.plan_id as plan_id,
      app.target_publish_at as planned_target_time,
      pe.execution_id as execution_id,
      pe.execution_status as execution_status,
      pr.receipt_id as publication_receipt_id,
      pr.actual_published_at as actual_published_at,
      pfs.index_status as authoritative_index_state
    FROM articles a
    LEFT JOIN article_ingest_receipts air ON a.id = air.article_id
    LEFT JOIN article_publication_readiness apr ON a.id = apr.article_id
    LEFT JOIN article_editorial_approvals aea ON a.id = aea.article_id
    LEFT JOIN article_publication_plans app ON a.id = app.article_id
    LEFT JOIN article_publication_executions pe ON app.plan_id = pe.plan_id
    LEFT JOIN publication_execution_receipts pr ON pe.execution_id = pr.execution_id
    LEFT JOIN publication_feedback_snapshots pfs ON a.id = pfs.article_id
    WHERE 1=1
  `;

  const params: any[] = [];
  if (options.articleId) {
    query += ' AND a.id = ?';
    params.push(options.articleId);
  }
  if (options.slug) {
    query += ' AND a.slug = ?';
    params.push(options.slug);
  }
  if (options.executionId) {
    query += ' AND pe.execution_id = ?';
    params.push(options.executionId);
  }

  query += ` ORDER BY a.id DESC LIMIT ${limit}`;

  const rows = await db.prepare(query).bind(...params).all();

  return (rows?.results || []).map((r: any) => ({
    correlation_id: r.correlation_id || r.d1_article_id,
    topic: null,
    orchestration_job_id: null,
    evidence_hash: null,
    outbox_job_id: null,
    ingest_request_id: r.ingest_request_id || null,
    ingest_receipt_id: r.ingest_receipt_id ? String(r.ingest_receipt_id) : null,
    d1_article_id: r.d1_article_id,
    article_slug: r.article_slug,
    article_status: r.article_status,
    media_job_id: null,
    media_asset_id: null,
    readiness_snapshot_id: r.readiness_snapshot_id || null,
    readiness_status: r.readiness_status || null,
    editorial_approval_id: r.editorial_approval_id ? String(r.editorial_approval_id) : null,
    plan_id: r.plan_id || null,
    planned_target_time: r.planned_target_time || null,
    execution_id: r.execution_id || null,
    execution_status: r.execution_status || null,
    publication_receipt_id: r.publication_receipt_id || null,
    actual_published_at: r.actual_published_at || null,
    feedback_observation_id: r.feedback_observation_id || null,
    authoritative_index_state: r.authoritative_index_state || null
  }));
}
