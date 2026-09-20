import type { APIRoute } from 'astro';
import { getDb } from '../../../../../../lib/db';
import { authenticateDeviceRequest } from '../../../../../../lib/media/device-auth';
import { getD1WatermarkSettings } from '../../../../../../lib/watermark/settings';

export const GET: APIRoute = async ({ request, locals }) => {
  try {
    const env = (locals as any).runtime?.env || (globalThis as any).process?.env || {};
    const db = (await getDb(locals)) || env.DB || (locals as any)?.db;

    // 1. Device authentication & authorization
    const auth = await authenticateDeviceRequest(request, db, env);
    if (!auth.authenticated) {
      return new Response(
        JSON.stringify({
          status: 'error',
          code: 'UNAUTHORIZED',
          message: auth.error || 'Device authentication required'
        }),
        {
          status: auth.statusCode || 401,
          headers: {
            'Content-Type': 'application/json',
            'Cache-Control': 'no-store, private',
            'X-Robots-Tag': 'noindex, nofollow, noarchive'
          }
        }
      );
    }

    // 2. Read effective normalized settings from D1
    const settings = await getD1WatermarkSettings(db);

    // 3. Construct safe runtime config response (no admin audits, no secrets)
    const runtimeConfig = {
      enabled: settings.enabled,
      type: settings.type,
      position: settings.position,
      opacity: settings.opacity,
      margin_x_ratio: settings.margin_x_ratio,
      margin_y_ratio: settings.margin_y_ratio,
      text: {
        value: settings.text.value,
        font_size_ratio: settings.text.font_size_ratio,
        font_weight: settings.text.font_weight
      },
      image: {
        asset_id: settings.image.asset_id,
        width_ratio: settings.image.width_ratio
      },
      watermark_version: settings.watermark_version,
      engine_version: '1.0.0'
    };

    return new Response(
      JSON.stringify({
        status: 'ok',
        ...runtimeConfig,
        config: runtimeConfig
      }),
      {
        status: 200,
        headers: {
          'Content-Type': 'application/json',
          'Cache-Control': 'no-store, private',
          'X-Robots-Tag': 'noindex, nofollow, noarchive'
        }
      }
    );
  } catch (err: any) {
    return new Response(
      JSON.stringify({
        status: 'error',
        code: 'INTERNAL_ERROR',
        message: err.message || 'Gagal membaca runtime watermark config'
      }),
      {
        status: 500,
        headers: {
          'Content-Type': 'application/json',
          'Cache-Control': 'no-store, private',
          'X-Robots-Tag': 'noindex, nofollow, noarchive'
        }
      }
    );
  }
};
