import type { APIRoute } from 'astro';
import { getDb } from '../../../lib/db';
import {
  getD1WatermarkSettings,
  saveD1WatermarkSettings,
  WatermarkSettingsValidationError,
  WatermarkSettingsConcurrencyError
} from '../../../lib/watermark/settings';

export const GET: APIRoute = async ({ locals }) => {
  try {
    const db = await getDb(locals);
    const settings = await getD1WatermarkSettings(db);

    return new Response(
      JSON.stringify({
        status: 'success',
        settings
      }),
      {
        status: 200,
        headers: {
          'Content-Type': 'application/json',
          'Cache-Control': 'no-store, private'
        }
      }
    );
  } catch (err: any) {
    return new Response(
      JSON.stringify({
        status: 'error',
        message: err.message || 'Gagal membaca pengaturan watermark'
      }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
};

export const POST: APIRoute = async ({ request, locals }) => {
  try {
    const body = await request.json();
    const db = await getDb(locals);

    const rawSettings = body.settings || body;
    const expectedVersion = body.expected_version !== undefined ? body.expected_version : rawSettings.expected_version;

    // Get actor from locals if available
    const actor = (locals as any)?.user?.username || (locals as any)?.user?.email || 'admin';

    const result = await saveD1WatermarkSettings(db, rawSettings, {
      expectedVersion,
      actor
    });

    return new Response(
      JSON.stringify({
        status: 'success',
        settings: result.settings,
        versionBumped: result.versionBumped,
        message: result.versionBumped
          ? 'Pengaturan watermark berhasil diperbarui.'
          : 'Pengaturan identik, tidak ada perubahan versi.'
      }),
      {
        status: 200,
        headers: {
          'Content-Type': 'application/json',
          'Cache-Control': 'no-store, private'
        }
      }
    );
  } catch (err: any) {
    if (err instanceof WatermarkSettingsConcurrencyError) {
      return new Response(
        JSON.stringify({
          status: 'error',
          code: 'STALE_SETTINGS_REVISION',
          message: err.message
        }),
        { status: 409, headers: { 'Content-Type': 'application/json' } }
      );
    }

    if (err instanceof WatermarkSettingsValidationError) {
      return new Response(
        JSON.stringify({
          status: 'error',
          code: err.code || 'VALIDATION_ERROR',
          message: err.message
        }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    return new Response(
      JSON.stringify({
        status: 'error',
        code: 'INTERNAL_ERROR',
        message: err.message || 'Gagal menyimpan pengaturan watermark'
      }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
};
