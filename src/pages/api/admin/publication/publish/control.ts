import type { APIRoute } from 'astro';
import { getDb } from '../../../../../lib/db.ts';
import {
  schedulePlanForExecution,
  publishNow,
  cancelExecution,
  retryExecution,
  inspectExecution
} from '../../../../../lib/publication/publisher-service.ts';

/**
 * Scheduled Publisher Operator Controls API Endpoint (PUBLICATION-2)
 *
 * Provides human-in-the-loop actions:
 * - GET: Inspects an execution and its audit history (?execution_id=...)
 * - POST:
 *   - action: 'schedule' -> schedules an active plan for execution
 *   - action: 'publish_now' -> runs pre-publish gate and publishes immediately (NO BYPASS!)
 *   - action: 'cancel' -> cancels a scheduled or retrying execution
 *   - action: 'retry' -> resets a failed execution for another attempt
 */
export const GET: APIRoute = async ({ url, locals }) => {
  try {
    const db = (await getDb(locals)) || (locals as any)?.db;
    const executionId = url.searchParams.get('execution_id');

    if (!executionId) {
      return new Response(
        JSON.stringify({ status: 'error', message: 'Missing execution_id query parameter' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    const data = await inspectExecution(db, executionId);

    return new Response(
      JSON.stringify({ status: 'success', data }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );
  } catch (err: any) {
    return new Response(
      JSON.stringify({ status: 'error', message: err.message }),
      { status: err.message.includes('NOT_FOUND') ? 404 : 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
};

export const POST: APIRoute = async ({ request, locals }) => {
  try {
    const body = await request.json();
    const db = (await getDb(locals)) || (locals as any)?.db;
    const action = body.action;
    const actor = body.actor || 'admin_operator';

    if (!action) {
      return new Response(
        JSON.stringify({ status: 'error', message: 'Missing action field' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    switch (action) {
      case 'schedule': {
        if (!body.plan_id) {
          return new Response(
            JSON.stringify({ status: 'error', message: 'Missing plan_id for schedule action' }),
            { status: 400, headers: { 'Content-Type': 'application/json' } }
          );
        }
        const execution = await schedulePlanForExecution(db, body.plan_id, actor);
        return new Response(
          JSON.stringify({ status: 'success', execution }),
          { status: 200, headers: { 'Content-Type': 'application/json' } }
        );
      }

      case 'publish_now': {
        const targetId = body.execution_id || body.plan_id;
        if (!targetId) {
          return new Response(
            JSON.stringify({ status: 'error', message: 'Missing execution_id or plan_id for publish_now action' }),
            { status: 400, headers: { 'Content-Type': 'application/json' } }
          );
        }
        // Exactly same gate - NO BYPASS!
        const result = await publishNow(db, targetId, actor, body.nowUtc);
        return new Response(
          JSON.stringify({ status: 'success', result }),
          { status: 200, headers: { 'Content-Type': 'application/json' } }
        );
      }

      case 'cancel': {
        if (!body.execution_id) {
          return new Response(
            JSON.stringify({ status: 'error', message: 'Missing execution_id for cancel action' }),
            { status: 400, headers: { 'Content-Type': 'application/json' } }
          );
        }
        await cancelExecution(db, body.execution_id, actor, body.reason);
        return new Response(
          JSON.stringify({ status: 'success', message: 'Execution cancelled' }),
          { status: 200, headers: { 'Content-Type': 'application/json' } }
        );
      }

      case 'retry': {
        if (!body.execution_id) {
          return new Response(
            JSON.stringify({ status: 'error', message: 'Missing execution_id for retry action' }),
            { status: 400, headers: { 'Content-Type': 'application/json' } }
          );
        }
        const execution = await retryExecution(db, body.execution_id, actor);
        return new Response(
          JSON.stringify({ status: 'success', execution }),
          { status: 200, headers: { 'Content-Type': 'application/json' } }
        );
      }

      default:
        return new Response(
          JSON.stringify({ status: 'error', message: `Unknown action: ${action}` }),
          { status: 400, headers: { 'Content-Type': 'application/json' } }
        );
    }
  } catch (err: any) {
    return new Response(
      JSON.stringify({ status: 'error', message: err.message }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
};
