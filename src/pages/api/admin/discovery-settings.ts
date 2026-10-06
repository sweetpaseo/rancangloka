import type { APIRoute } from 'astro';
import { getDb } from '../../../lib/db.ts';
import { isValidAdminSession, getAdminSessionFromRequest } from '../../../lib/auth.ts';
import {
  getDiscoveryProviderStatus,
  saveDiscoveryProviderKey,
  removeDiscoveryProviderKey,
  toggleDiscoveryProvider,
  testDiscoveryProviderConnection
} from '../../../lib/editorial/discovery-settings-vault.ts';

/**
 * Admin Discovery Provider Settings API (ADMIN-BRAVE-SEARCH-SETTINGS-1)
 *
 * Invariants:
 * 1. Admin session authentication strictly required (401 for unauthorized actors).
 * 2. GET returns high-level status only; never exposes plaintext or encrypted secrets.
 * 3. Secret storage fails closed if KEK is unavailable (SECRET_STORAGE_NOT_READY).
 * 4. Toggle ON without configured key is rejected with Indonesian error message.
 * 5. Connection test performs exactly one bounded request and never runs Irwan/Joko.
 */

async function checkAdminAuth(request: Request, cookies: any, env: any): Promise<boolean> {
  const cookieSession = cookies?.get?.('admin_session');
  if (cookieSession && (await isValidAdminSession(cookieSession, env))) {
    return true;
  }
  const headerToken = getAdminSessionFromRequest(request);
  if (headerToken && (await isValidAdminSession(headerToken, env))) {
    return true;
  }
  return false;
}

export const GET: APIRoute = async ({ request, url, cookies, locals }) => {
  try {
    const env = (locals as any)?.runtime?.env || (globalThis as any).process?.env || {};
    const isAuth = await checkAdminAuth(request, cookies, env);

    if (!isAuth) {
      return new Response(
        JSON.stringify({ status: 'error', message: 'UNAUTHORIZED: Admin session required' }),
        { status: 401, headers: { 'Content-Type': 'application/json' } }
      );
    }

    const provider = url.searchParams.get('provider') || 'brave';
    const db = await getDb(locals);

    const statusData = await getDiscoveryProviderStatus(db, provider, env);

    return new Response(
      JSON.stringify({
        status: 'success',
        data: statusData
      }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );
  } catch (err: any) {
    return new Response(
      JSON.stringify({ status: 'error', message: err?.message || 'INTERNAL_ERROR' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
};

export const POST: APIRoute = async ({ request, cookies, locals }) => {
  try {
    const env = (locals as any)?.runtime?.env || (globalThis as any).process?.env || {};
    const isAuth = await checkAdminAuth(request, cookies, env);

    if (!isAuth) {
      return new Response(
        JSON.stringify({ status: 'error', message: 'UNAUTHORIZED: Admin session required' }),
        { status: 401, headers: { 'Content-Type': 'application/json' } }
      );
    }

    const body = await request.json();
    const action = body?.action;
    const provider = body?.provider || 'brave';
    const actor = body?.actor || 'chief_admin';
    const db = await getDb(locals);

    if (action === 'save_key') {
      const apiKey = body?.apiKey;
      if (!apiKey || typeof apiKey !== 'string' || !apiKey.trim()) {
        return new Response(
          JSON.stringify({ status: 'error', message: 'API_KEY_REQUIRED: API key tidak boleh kosong' }),
          { status: 400, headers: { 'Content-Type': 'application/json' } }
        );
      }

      const statusData = await saveDiscoveryProviderKey(db, {
        provider,
        apiKey,
        actor,
        env
      });

      return new Response(
        JSON.stringify({ status: 'success', data: statusData }),
        { status: 200, headers: { 'Content-Type': 'application/json' } }
      );
    }

    if (action === 'remove_key') {
      const statusData = await removeDiscoveryProviderKey(db, {
        provider,
        actor
      });

      return new Response(
        JSON.stringify({ status: 'success', data: statusData }),
        { status: 200, headers: { 'Content-Type': 'application/json' } }
      );
    }

    if (action === 'toggle') {
      const enabled = Boolean(body?.enabled);
      const statusData = await toggleDiscoveryProvider(db, {
        provider,
        enabled,
        actor,
        env
      });

      return new Response(
        JSON.stringify({ status: 'success', data: statusData }),
        { status: 200, headers: { 'Content-Type': 'application/json' } }
      );
    }

    if (action === 'test_connection') {
      const testResult = await testDiscoveryProviderConnection(db, {
        provider,
        actor,
        env
      });

      return new Response(
        JSON.stringify({ status: 'success', data: testResult }),
        { status: 200, headers: { 'Content-Type': 'application/json' } }
      );
    }

    return new Response(
      JSON.stringify({ status: 'error', message: `INVALID_ACTION: Tindakan '${action}' tidak dikenal` }),
      { status: 400, headers: { 'Content-Type': 'application/json' } }
    );
  } catch (err: any) {
    const msg = err?.message || 'INTERNAL_ERROR';
    const isKekError = msg.includes('SECRET_STORAGE_NOT_READY');
    const isKeyMissing = msg.includes('Masukkan Brave Search API Key terlebih dahulu');

    return new Response(
      JSON.stringify({
        status: 'error',
        code: isKekError ? 'SECRET_STORAGE_NOT_READY' : undefined,
        message: msg
      }),
      {
        status: isKeyMissing ? 400 : isKekError ? 500 : 500,
        headers: { 'Content-Type': 'application/json' }
      }
    );
  }
};
