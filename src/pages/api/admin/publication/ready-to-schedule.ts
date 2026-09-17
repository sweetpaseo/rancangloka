import type { APIRoute } from 'astro';
import { getDb } from '../../../../lib/db.ts';
import { getArticlesReadyToSchedule } from '../../../../lib/publication/service.ts';

/**
 * Planner Handoff Endpoint (PUBLICATION-1 Integration).
 * Returns all articles that have satisfied all 6 readiness vectors and have
 * achieved READY_TO_SCHEDULE status with matching content hashes.
 *
 * Strictly Read-Only:
 * - Does NOT decide publication time.
 * - Does NOT schedule or publish.
 * - Does NOT mutate articles.
 */
export const GET: APIRoute = async ({ locals }) => {
  try {
    const db = (await getDb(locals)) || (locals as any)?.db;
    const articles = await getArticlesReadyToSchedule(db);

    return new Response(
      JSON.stringify({
        status: 'success',
        total: articles.length,
        articles
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
