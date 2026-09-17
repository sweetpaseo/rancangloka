import type { APIRoute } from 'astro';
import { getDb } from '../../../../lib/db.ts';
import { runFeedbackCollection } from '../../../../lib/publication/feedback-service.ts';

/**
 * Publication Crawl & Index Feedback API Endpoint (PUBLICATION-3)
 *
 * Strictly Feedback Domain:
 * - GET: returns latest feedback aggregate, health regime, and snapshot summaries.
 * - POST: triggers bounded feedback collection and computes fresh rolling aggregates.
 * - Does NOT publish.
 * - Does NOT schedule.
 * - Does NOT mutate article bodies.
 * - Does NOT alter publication plans directly.
 */
export const GET: APIRoute = async ({ url, locals }) => {
  try {
    const db = (await getDb(locals)) || (locals as any)?.db;

    // Fetch latest aggregate
    const latestAgg = await db
      .prepare('SELECT * FROM publication_feedback_aggregates ORDER BY evaluated_at DESC LIMIT 1')
      .first();

    // Fetch recent snapshots
    const limit = parseInt(url.searchParams.get('limit') || '30', 10);
    const snapsRes = await db
      .prepare(`
        SELECT s.*, a.slug, a.title, a.published_at
        FROM publication_feedback_snapshots s
        JOIN articles a ON s.article_id = a.id
        ORDER BY s.updated_at DESC
        LIMIT ?
      `)
      .bind(limit)
      .all();

    return new Response(
      JSON.stringify({
        status: 'success',
        aggregate: latestAgg || null,
        signals: latestAgg?.signals_payload_json ? JSON.parse(latestAgg.signals_payload_json) : null,
        snapshots: snapsRes.results || []
      }),
      {
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      }
    );
  } catch (err: any) {
    return new Response(
      JSON.stringify({
        status: 'error',
        message: err.message
      }),
      {
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      }
    );
  }
};

export const POST: APIRoute = async ({ request, locals }) => {
  try {
    let body: any = {};
    try {
      body = await request.json();
    } catch {
      // empty body permitted
    }

    const db = (await getDb(locals)) || (locals as any)?.db;
    const actor = body.actor || 'admin_operator';
    const batchSize = body.batchSize ? parseInt(body.batchSize, 10) : undefined;

    const result = await runFeedbackCollection(db, {
      triggerSource: 'manual',
      actor,
      batchSize
    });

    return new Response(
      JSON.stringify({
        status: result.executed ? 'success' : 'skipped',
        runId: result.runId,
        articlesEvaluated: result.articlesEvaluated,
        observationsRecorded: result.observationsRecorded,
        recommendation: result.aggregate?.planner_recommendation,
        healthRegime: result.aggregate?.health_regime,
        aggregate: result.aggregate,
        reason: result.reason
      }),
      {
        status: result.executed ? 200 : 409,
        headers: { 'Content-Type': 'application/json' }
      }
    );
  } catch (err: any) {
    return new Response(
      JSON.stringify({
        status: 'error',
        message: err.message
      }),
      {
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      }
    );
  }
};
