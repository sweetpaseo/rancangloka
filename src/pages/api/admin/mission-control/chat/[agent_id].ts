/**
 * RancangLoka Hermes Mission Control — Staff Chat & Interaction API
 * Milestone: HERMES-MC-5
 * Route: /api/admin/mission-control/chat/[agent_id]
 * 
 * Strict Invariants:
 * 1. Protected by admin_session middleware authentication.
 * 2. Canonical machine agent_id is strictly authoritative.
 * 3. Raw text is sanitized and normalized — zero raw SQL, shell, or MCP tool execution.
 * 4. High-authority commands (admin control, dangerous production action) fail closed.
 */

import type { APIRoute } from 'astro';
import { getDb } from '../../../../../lib/db.ts';
import {
  getMissionControlSnapshot,
  getStaffDefinitionByAgentId,
  getOrCreateConversation,
  getConversationMessages,
  processOperatorInteraction,
  getCommandById
} from '../../../../../lib/mission-control/index.ts';

export const GET: APIRoute = async ({ params, locals }) => {
  const { agent_id } = params;
  if (!agent_id) {
    return new Response(JSON.stringify({ error: 'AGENT_ID_REQUIRED' }), { status: 400 });
  }

  const staff = getStaffDefinitionByAgentId(agent_id);
  if (!staff) {
    return new Response(JSON.stringify({ error: 'STAFF_NOT_FOUND', message: `Staf ${agent_id} tidak terdaftar.` }), { status: 404 });
  }

  const env = (locals as any)?.runtime?.env || (globalThis as any).process?.env || {};
  const db = (await getDb(locals)) || env.DB || (locals as any)?.db;

  try {
    const conversation = await getOrCreateConversation(db, staff.agent_id);
    const messages = await getConversationMessages(db, conversation.conversation_id);
    const snapshot = await getMissionControlSnapshot(db, env);
    const staffState = snapshot.staff?.staff?.find((s: any) => s.agent_id === staff.agent_id);

    return new Response(
      JSON.stringify({
        staff: {
          agent_id: staff.agent_id,
          display_name: staff.display_name,
          role: staff.role,
          department_id: staff.department_id,
          avatar_key: staff.avatar_key,
          capabilities: staff.capabilities,
          operational_state: staffState?.state || 'IDLE',
          current_task: staffState?.current_task || null,
          badge_text: staffState?.state || 'IDLE'
        },
        conversation,
        messages
      }),
      {
        status: 200,
        headers: {
          'Content-Type': 'application/json',
          'Cache-Control': 'no-store, private',
          'X-Robots-Tag': 'noindex, nofollow, noarchive, nosnippet'
        }
      }
    );
  } catch (err: any) {
    return new Response(
      JSON.stringify({
        status: 'error',
        code: 'MISSION_CONTROL_CHAT_FAILED',
        message: err?.message || 'Gagal memuat riwayat percakapan staf'
      }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
};

export const POST: APIRoute = async ({ params, request, locals }) => {
  const { agent_id } = params;
  if (!agent_id) {
    return new Response(JSON.stringify({ error: 'AGENT_ID_REQUIRED' }), { status: 400 });
  }

  const staff = getStaffDefinitionByAgentId(agent_id);
  if (!staff) {
    return new Response(JSON.stringify({ error: 'STAFF_NOT_FOUND', message: `Staf ${agent_id} tidak terdaftar.` }), { status: 404 });
  }

  let body: any = {};
  try {
    body = await request.json();
  } catch {
    return new Response(JSON.stringify({ error: 'INVALID_JSON_PAYLOAD' }), { status: 400 });
  }

  const messageText = typeof body.message === 'string' ? body.message.trim() : '';
  if (!messageText) {
    return new Response(JSON.stringify({ error: 'EMPTY_MESSAGE', message: 'Teks instruksi tidak boleh kosong.' }), { status: 400 });
  }

  const env = (locals as any)?.runtime?.env || (globalThis as any).process?.env || {};
  const db = (await getDb(locals)) || env.DB || (locals as any)?.db;

  try {
    const snapshot = await getMissionControlSnapshot(db, env);
    const result = await processOperatorInteraction(db, staff.agent_id, messageText, snapshot);
    const allMessages = await getConversationMessages(db, result.conversation.conversation_id);

    return new Response(
      JSON.stringify({
        success: true,
        conversation: result.conversation,
        operator_message: result.operator_message,
        response_message: result.response_message,
        command: result.command || null,
        messages: allMessages
      }),
      {
        status: 200,
        headers: {
          'Content-Type': 'application/json',
          'Cache-Control': 'no-store, private',
          'X-Robots-Tag': 'noindex, nofollow, noarchive, nosnippet'
        }
      }
    );
  } catch (err: any) {
    return new Response(
      JSON.stringify({
        status: 'error',
        code: 'INTERACTION_PROCESS_ERROR',
        message: err?.message || 'Gagal memproses interaksi operator'
      }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
};
