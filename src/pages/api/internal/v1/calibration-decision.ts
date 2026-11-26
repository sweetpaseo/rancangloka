import type { APIRoute } from 'astro';
import fs from 'node:fs';
import path from 'node:path';
import {
  isProductionEnvironment,
  getAdminSessionFromRequest,
  verifyAdminSession,
  getAdminSessionSecret,
  timingSafeEqual
} from '../../../../lib/auth.ts';

export const prerender = false;

function getAllowedOrigin(request: Request): string | null {
  const origin = request.headers.get('origin');
  if (!origin) {
    // Same-origin or non-browser request (e.g. curl/server-side fetch)
    return null;
  }
  // Strictly allow local development loopback origins only
  if (/^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin)) {
    return origin;
  }
  return 'FORBIDDEN';
}

function buildCorsHeaders(allowedOrigin: string | null): Record<string, string> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    'Vary': 'Origin',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Requested-With, X-Calibration-Auth'
  };
  if (allowedOrigin && allowedOrigin !== 'FORBIDDEN') {
    headers['Access-Control-Allow-Origin'] = allowedOrigin;
    headers['Access-Control-Allow-Credentials'] = 'true';
  }
  return headers;
}

function getAuthoritativeStatePath(): string {
  const cwd = process.cwd();
  let baseDir = cwd;
  if (!fs.existsSync(path.join(baseDir, 'state')) && fs.existsSync(path.join(baseDir, 'rancangloka-astro/state'))) {
    baseDir = path.join(baseDir, 'rancangloka-astro');
  }
  return path.resolve(baseDir, 'state/calibration_decisions.json');
}

function getSecondaryMirrorPath(): string | null {
  const cwd = process.cwd();
  let baseDir = cwd;
  if (!fs.existsSync(path.join(baseDir, 'public')) && fs.existsSync(path.join(baseDir, 'rancangloka-astro/public'))) {
    baseDir = path.join(baseDir, 'rancangloka-astro');
  }
  const mirrorDir = path.resolve(baseDir, 'public/experimental-media');
  if (fs.existsSync(mirrorDir)) {
    return path.join(mirrorDir, 'calibration_decisions.json');
  }
  return null;
}

async function verifyOwnerAuthentication(request: Request, env: any, cookies?: any): Promise<boolean> {
  // 1. Try extracting token from Astro cookies, HTTP Cookie header, or Authorization/X-Calibration-Auth header
  const cookieToken = cookies?.get?.('admin_session')?.value;
  const token = cookieToken || getAdminSessionFromRequest(request) || request.headers.get('x-calibration-auth');
  if (token) {
    // A. Check if it is a signed admin session token
    const sessionRes = await verifyAdminSession(token, env);
    if (sessionRes.valid) {
      return true;
    }

    // B. Check if it matches direct admin session secret
    const secret = getAdminSessionSecret(env);
    if (secret && timingSafeEqual(token, secret)) {
      return true;
    }
  }

  return false;
}

function isProdRuntime(env?: any): boolean {
  if (isProductionEnvironment(env)) return true;
  if (typeof process !== 'undefined' && process.env?.NODE_ENV === 'production') return true;
  try {
    if ((import.meta as any).env?.PROD) return true;
  } catch (_) {}
  return false;
}

export const OPTIONS: APIRoute = async ({ request, locals }) => {
  const env = (locals as any)?.runtime?.env || process.env;
  if (isProdRuntime(env)) {
    return new Response(JSON.stringify({ error: 'ENDPOINT_DISABLED_IN_PRODUCTION' }), {
      status: 403,
      headers: { 'Content-Type': 'application/json' }
    });
  }

  const allowedOrigin = getAllowedOrigin(request);
  if (allowedOrigin === 'FORBIDDEN') {
    return new Response(JSON.stringify({ error: 'FORBIDDEN_ORIGIN' }), {
      status: 403,
      headers: { 'Content-Type': 'application/json' }
    });
  }

  return new Response(null, {
    status: 204,
    headers: buildCorsHeaders(allowedOrigin)
  });
};

export const POST: APIRoute = async ({ request, locals, cookies }) => {
  const env = (locals as any)?.runtime?.env || process.env;

  // 1. Fail closed in production
  if (isProdRuntime(env)) {
    return new Response(JSON.stringify({
      error: 'ENDPOINT_DISABLED_IN_PRODUCTION',
      message: 'Owner calibration endpoint is strictly disabled in production runtime.'
    }), {
      status: 403,
      headers: { 'Content-Type': 'application/json' }
    });
  }

  // 2. Validate Origin policy (no wildcard '*')
  const allowedOrigin = getAllowedOrigin(request);
  if (allowedOrigin === 'FORBIDDEN') {
    return new Response(JSON.stringify({
      error: 'FORBIDDEN_ORIGIN',
      message: 'Cross-origin requests from external origins are strictly forbidden.'
    }), {
      status: 403,
      headers: { 'Content-Type': 'application/json' }
    });
  }

  const corsHeaders = buildCorsHeaders(allowedOrigin);

  // 3. Authenticate Owner/Admin
  const isAuth = await verifyOwnerAuthentication(request, env, cookies);
  if (!isAuth) {
    return new Response(JSON.stringify({
      error: 'UNAUTHORIZED_OWNER_CALIBRATION',
      message: 'Valid owner/admin session or authorization credentials required.'
    }), {
      status: 401,
      headers: corsHeaders
    });
  }

  try {
    const payload = await request.json();
    const { model_key, decision, notes, source, operator } = payload;

    if (!model_key || !decision) {
      return new Response(JSON.stringify({ error: 'model_key and decision required' }), {
        status: 400,
        headers: corsHeaders
      });
    }

    const validDecisions = ['TERBAIK', 'LAYAK', 'TOLAK'];
    if (!validDecisions.includes(decision)) {
      return new Response(JSON.stringify({
        error: `Invalid decision '${decision}'. Must be one of: ${validDecisions.join(', ')}`
      }), {
        status: 400,
        headers: corsHeaders
      });
    }

    const statePath = getAuthoritativeStatePath();

    // Read authoritative decisions from state/
    let existing: any[] = [];
    if (fs.existsSync(statePath)) {
      try {
        existing = JSON.parse(fs.readFileSync(statePath, 'utf8'));
      } catch (e) {
        existing = [];
      }
    }

    const entry = {
      model_key,
      decision,
      notes: notes || '',
      source: source || 'owner_manual_calibration',
      operator: operator || 'owner',
      recorded_at: new Date().toISOString()
    };

    // Upsert by model_key without destroying existing decisions
    const idx = existing.findIndex(d => d.model_key === model_key);
    if (idx >= 0) {
      existing[idx] = { ...existing[idx], ...entry };
    } else {
      existing.push(entry);
    }

    // Persist primarily to state/
    const stateDir = path.dirname(statePath);
    if (!fs.existsSync(stateDir)) {
      fs.mkdirSync(stateDir, { recursive: true });
    }
    fs.writeFileSync(statePath, JSON.stringify(existing, null, 2), 'utf8');

    // Secondary mirror for static UI preview only
    const mirrorPath = getSecondaryMirrorPath();
    if (mirrorPath) {
      try {
        const mirrorDir = path.dirname(mirrorPath);
        if (!fs.existsSync(mirrorDir)) {
          fs.mkdirSync(mirrorDir, { recursive: true });
        }
        fs.writeFileSync(mirrorPath, JSON.stringify(existing, null, 2), 'utf8');
      } catch (_) {
        // Non-blocking mirror failure
      }
    }

    return new Response(JSON.stringify({
      success: true,
      count: existing.length,
      record: entry,
      primary_storage: statePath
    }), {
      status: 200,
      headers: corsHeaders
    });
  } catch (err: any) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: corsHeaders
    });
  }
};

export const GET: APIRoute = async ({ request, locals, cookies }) => {
  const env = (locals as any)?.runtime?.env || process.env;

  if (isProdRuntime(env)) {
    return new Response(JSON.stringify({ error: 'ENDPOINT_DISABLED_IN_PRODUCTION' }), {
      status: 403,
      headers: { 'Content-Type': 'application/json' }
    });
  }

  const allowedOrigin = getAllowedOrigin(request);
  if (allowedOrigin === 'FORBIDDEN') {
    return new Response(JSON.stringify({ error: 'FORBIDDEN_ORIGIN' }), {
      status: 403,
      headers: { 'Content-Type': 'application/json' }
    });
  }

  const corsHeaders = buildCorsHeaders(allowedOrigin);

  // Check true authentication status
  const isAuth = await verifyOwnerAuthentication(request, env, cookies);

  const statePath = getAuthoritativeStatePath();
  let existing: any[] = [];
  if (fs.existsSync(statePath)) {
    try {
      existing = JSON.parse(fs.readFileSync(statePath, 'utf8'));
    } catch (e) {
      existing = [];
    }
  }

  return new Response(JSON.stringify({
    authenticated: isAuth,
    user: isAuth ? 'owner' : null,
    decisions: existing,
    primary_storage: statePath
  }), {
    status: 200,
    headers: corsHeaders
  });
};
