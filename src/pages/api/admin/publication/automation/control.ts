import type { APIRoute } from 'astro';
import { getDb } from '../../../../../lib/db.ts';
import {
  isValidAdminSession,
  getAdminSessionFromRequest,
  verifySameOrigin,
  isCronServiceAuthenticated
} from '../../../../../lib/auth.ts';
import {
  changeAutomationMode,
  changeAutoSchedule,
  getAutomationControl,
  getRecentAutomationControlAudit
} from '../../../../../lib/safety/automation-controller.ts';
import type { AutomationMode } from '../../../../../lib/safety/safety-types.ts';

/**
 * Publication Automation Control API (Phase 5L12B)
 *
 * Canonical operator endpoint for managing global automation controls.
 *
 * Security:
 * 1. Strictly requires admin authentication (isValidAdminSession).
 * 2. Media device credentials rejected (403).
 * 3. CRON_SECRET rejected (403) — Cron services cannot operate control plane.
 * 4. CSRF protection enforced for mutating browser requests.
 * 5. Secret-firewalled: No tokens or secrets returned.
 */

function isMediaDeviceRequest(request: Request): boolean {
  const deviceHeader = request.headers.get('x-lokamedia-device-id');
  const authHeader = request.headers.get('Authorization') || '';
  const userAgent = request.headers.get('user-agent') || '';
  return Boolean(
    deviceHeader ||
    authHeader.toLowerCase().includes('lkmd_') ||
    authHeader.toLowerCase().includes('media:device') ||
    userAgent.includes('LokaMediaExtension') ||
    userAgent.includes('MediaDevice')
  );
}

export const GET: APIRoute = async ({ request, locals }) => {
  try {
    const env = (locals as any)?.runtime?.env || (globalThis as any).process?.env;

    // 1. Media device firewall
    if (isMediaDeviceRequest(request)) {
      return new Response(
        JSON.stringify({
          status: 'error',
          code: 'MEDIA_DEVICE_FORBIDDEN',
          message: 'MEDIA_FIREWALL_BLOCK: Media devices cannot access automation control plane'
        }),
        { status: 403, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // 2. Cron secret firewall
    if (isCronServiceAuthenticated(request, env)) {
      return new Response(
        JSON.stringify({
          status: 'error',
          code: 'CRON_SECRET_FORBIDDEN',
          message: 'CRON_SECRET cannot be used to access automation control plane'
        }),
        { status: 403, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // 3. Admin Authentication
    const token = getAdminSessionFromRequest(request);
    const isAdminAuthed = await isValidAdminSession(token, env);
    if (!isAdminAuthed) {
      return new Response(
        JSON.stringify({
          status: 'error',
          code: 'UNAUTHORIZED',
          message: 'Admin authentication required to access automation control plane'
        }),
        { status: 401, headers: { 'Content-Type': 'application/json' } }
      );
    }

    const db = (await getDb(locals)) || (locals as any)?.db || (locals as any)?.runtime?.env?.DB;
    const control = await getAutomationControl(db);
    const recentAudits = await getRecentAutomationControlAudit(db, 10);

    let autoScheduleEnabled = false;
    try {
      const setting = await db
        .prepare("SELECT value FROM settings WHERE key = 'auto_schedule_enabled' LIMIT 1")
        .first();
      autoScheduleEnabled = Boolean(setting && (setting.value === 'true' || setting.value === '1'));
    } catch {
      autoScheduleEnabled = false;
    }

    return new Response(
      JSON.stringify({
        status: 'success',
        control: {
          mode: control.mode,
          kill_switch_engaged: Boolean(control.kill_switch_engaged === 1),
          kill_reason: control.kill_reason,
          auto_schedule_enabled: autoScheduleEnabled,
          updated_at: control.updated_at,
          updated_by: control.updated_by
        },
        recent_audits: recentAudits
      }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );
  } catch (err: any) {
    return new Response(
      JSON.stringify({ status: 'error', message: err.message }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
};

export const POST: APIRoute = async ({ request, locals }) => {
  try {
    const env = (locals as any)?.runtime?.env || (globalThis as any).process?.env;

    // 1. Media device firewall
    if (isMediaDeviceRequest(request)) {
      return new Response(
        JSON.stringify({
          status: 'error',
          code: 'MEDIA_DEVICE_FORBIDDEN',
          message: 'MEDIA_FIREWALL_BLOCK: Media devices cannot operate automation control plane'
        }),
        { status: 403, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // 2. Cron secret firewall: CRON_SECRET is strictly forbidden from changing control state
    if (isCronServiceAuthenticated(request, env)) {
      return new Response(
        JSON.stringify({
          status: 'error',
          code: 'CRON_SECRET_FORBIDDEN',
          message: 'CRON_SECRET cannot be used to operate automation control plane'
        }),
        { status: 403, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // 3. Admin Authentication
    const token = getAdminSessionFromRequest(request);
    const isAdminAuthed = await isValidAdminSession(token, env);
    if (!isAdminAuthed) {
      return new Response(
        JSON.stringify({
          status: 'error',
          code: 'UNAUTHORIZED',
          message: 'Admin authentication required to operate automation control plane'
        }),
        { status: 401, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // 4. CSRF Defense
    if (!verifySameOrigin(request)) {
      return new Response(
        JSON.stringify({
          status: 'error',
          code: 'FORBIDDEN_CSRF',
          message: 'CSRF validation failed for operator control mutation'
        }),
        { status: 403, headers: { 'Content-Type': 'application/json' } }
      );
    }

    let body: any = {};
    try {
      body = await request.json();
    } catch {
      return new Response(
        JSON.stringify({ status: 'error', message: 'Invalid JSON payload' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    const action = body.action;
    const actorId = (locals as any)?.authActor || body.actorId || 'admin_operator';
    const actorRole = 'admin_operator';
    const reason = typeof body.reason === 'string' ? body.reason.slice(0, 500) : null;
    const correlationId = typeof body.correlation_id === 'string' ? body.correlation_id.slice(0, 64) : null;

    if (!action) {
      return new Response(
        JSON.stringify({ status: 'error', message: 'Missing action parameter' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    const db = (await getDb(locals)) || (locals as any)?.db || (locals as any)?.runtime?.env?.DB;

    switch (action) {
      case 'set_mode': {
        const targetMode = body.mode as AutomationMode;
        if (!targetMode) {
          return new Response(
            JSON.stringify({ status: 'error', message: 'Missing mode parameter for set_mode action' }),
            { status: 400, headers: { 'Content-Type': 'application/json' } }
          );
        }

        const result = await changeAutomationMode(db, {
          targetMode,
          actorId,
          actorRole,
          source: 'operator_api',
          reason,
          correlationId,
          activationPredicates: body.activation_predicates
        });

        if (!result.success) {
          return new Response(
            JSON.stringify({
              status: 'error',
              code: 'MODE_CHANGE_REJECTED',
              message: result.reason || 'Mode change rejected',
              previous_mode: result.previousMode,
              current_mode: result.mode
            }),
            { status: 400, headers: { 'Content-Type': 'application/json' } }
          );
        }

        return new Response(
          JSON.stringify({
            status: 'success',
            action: 'set_mode',
            previous_mode: result.previousMode,
            current_mode: result.mode,
            changed: result.changed,
            audit_id: result.auditId,
            correlation_id: result.correlationId,
            message: result.message,
            timestamp: new Date().toISOString()
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } }
        );
      }

      case 'set_auto_schedule': {
        if (typeof body.enabled !== 'boolean') {
          return new Response(
            JSON.stringify({ status: 'error', message: 'Missing or invalid enabled boolean for set_auto_schedule action' }),
            { status: 400, headers: { 'Content-Type': 'application/json' } }
          );
        }

        const result = await changeAutoSchedule(db, {
          enabled: body.enabled,
          actorId,
          actorRole,
          source: 'operator_api',
          reason,
          correlationId
        });

        return new Response(
          JSON.stringify({
            status: 'success',
            action: 'set_auto_schedule',
            previous_auto_schedule: result.previousEnabled,
            current_auto_schedule: result.enabled,
            changed: result.changed,
            audit_id: result.auditId,
            correlation_id: result.correlationId,
            message: result.message,
            timestamp: new Date().toISOString()
          }),
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
