import type { APIRoute } from 'astro';
import { ADMIN_COOKIE_NAME, isValidAdminSession } from '../../../../lib/auth.ts';
import {
  getDailyUsageSummary,
  loadMonitorConfig,
  updateMonitorConfig,
  loadUsageLedger,
  probeCloudflareUsageApi
} from '../../../../lib/media/neurons-usage-service.ts';

export const GET: APIRoute = async ({ cookies, locals }) => {
  try {
    const env = (locals as any)?.runtime?.env || (import.meta as any).env || {};
    const sessionCookie = cookies.get(ADMIN_COOKIE_NAME);
    const isAuthenticated = await isValidAdminSession(sessionCookie, env);

    if (!isAuthenticated) {
      return new Response(
        JSON.stringify({
          status: 'error',
          code: 'UNAUTHORIZED',
          message: 'Admin authentication required to access Neurons usage data.'
        }),
        { status: 401, headers: { 'Content-Type': 'application/json' } }
      );
    }

    const summary = getDailyUsageSummary();
    const config = loadMonitorConfig();
    const ledger = loadUsageLedger();
    const probe = await probeCloudflareUsageApi();

    // Sort entries descending by timestamp, limit to recent 50
    const recentHistory = [...ledger]
      .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
      .slice(0, 50);

    return new Response(
      JSON.stringify({
        status: 'ok',
        data: {
          summary,
          config,
          history: recentHistory,
          probe
        }
      }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );
  } catch (err: any) {
    return new Response(
      JSON.stringify({
        status: 'error',
        code: 'INTERNAL_ERROR',
        message: err?.message || 'Failed to retrieve Neurons usage monitor data'
      }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
};

export const POST: APIRoute = async ({ request, cookies, locals }) => {
  try {
    const env = (locals as any)?.runtime?.env || (import.meta as any).env || {};
    const sessionCookie = cookies.get(ADMIN_COOKIE_NAME);
    const isAuthenticated = await isValidAdminSession(sessionCookie, env);

    if (!isAuthenticated) {
      return new Response(
        JSON.stringify({
          status: 'error',
          code: 'UNAUTHORIZED',
          message: 'Admin authentication required to update Neurons budget configuration.'
        }),
        { status: 401, headers: { 'Content-Type': 'application/json' } }
      );
    }

    const body = await request.json().catch(() => ({}));

    // Safety Invariant: Prohibit enabling paid usage
    if (body.allow_paid_usage === true || body.allowPaidUsage === true) {
      return new Response(
        JSON.stringify({
          status: 'error',
          code: 'PAID_USAGE_FORBIDDEN',
          message: 'Safety Invariant Violation: Paid usage cannot be enabled. Strict free tier quota enforced.'
        }),
        { status: 403, headers: { 'Content-Type': 'application/json' } }
      );
    }

    const customDailyLimit = body.custom_daily_limit !== undefined
      ? Number(body.custom_daily_limit)
      : (body.customDailyLimit !== undefined ? Number(body.customDailyLimit) : undefined);

    const warningThreshold = body.warning_threshold_percent !== undefined
      ? Number(body.warning_threshold_percent)
      : (body.warningThresholdPercent !== undefined ? Number(body.warningThresholdPercent) : undefined);

    const highWarningThreshold = body.high_warning_threshold_percent !== undefined
      ? Number(body.high_warning_threshold_percent)
      : (body.highWarningThresholdPercent !== undefined ? Number(body.highWarningThresholdPercent) : undefined);

    const updatedConfig = updateMonitorConfig({
      customDailyLimit,
      warningThresholdPercent: warningThreshold,
      highWarningThresholdPercent: highWarningThreshold,
      allowPaidUsage: false // Strictly false
    });

    return new Response(
      JSON.stringify({
        status: 'ok',
        data: {
          config: updatedConfig,
          summary: getDailyUsageSummary()
        }
      }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );
  } catch (err: any) {
    return new Response(
      JSON.stringify({
        status: 'error',
        code: 'INTERNAL_ERROR',
        message: err?.message || 'Failed to update Neurons budget configuration'
      }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
};
