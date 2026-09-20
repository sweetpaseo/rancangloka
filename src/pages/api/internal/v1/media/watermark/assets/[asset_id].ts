import type { APIRoute } from 'astro';
import { getDb } from '../../../../../../../lib/db';
import { authenticateDeviceRequest } from '../../../../../../../lib/media/device-auth';
import { getD1WatermarkSettings } from '../../../../../../../lib/watermark/settings';
import {
  getWatermarkMasterAssetObject,
  WatermarkAssetValidationError
} from '../../../../../../../lib/watermark/assets';

export const GET: APIRoute = async ({ request, params, locals }) => {
  try {
    const assetId = params.asset_id;
    if (!assetId) {
      return new Response(
        JSON.stringify({ status: 'error', code: 'MISSING_ASSET_ID', message: 'asset_id parameter is required' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    const env = (locals as any).runtime?.env || (globalThis as any).process?.env || {};
    const db = (await getDb(locals)) || env.DB || (locals as any)?.db;
    const bucket = env.MEDIA_BUCKET;

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

    // 2. Validate that asset matches current effective watermark configuration
    const currentSettings = await getD1WatermarkSettings(db);
    if (currentSettings.type !== 'IMAGE') {
      return new Response(
        JSON.stringify({
          status: 'error',
          code: 'WATERMARK_NOT_IMAGE_MODE',
          message: 'Current watermark configuration is not in IMAGE mode.'
        }),
        {
          status: 400,
          headers: {
            'Content-Type': 'application/json',
            'Cache-Control': 'no-store, private',
            'X-Robots-Tag': 'noindex, nofollow, noarchive'
          }
        }
      );
    }

    if (currentSettings.image?.asset_id !== assetId) {
      return new Response(
        JSON.stringify({
          status: 'error',
          code: 'CONFIG_ASSET_MISMATCH',
          message: `Requested asset '${assetId}' does not match active watermark configuration asset '${currentSettings.image?.asset_id}'.`
        }),
        {
          status: 403,
          headers: {
            'Content-Type': 'application/json',
            'Cache-Control': 'no-store, private',
            'X-Robots-Tag': 'noindex, nofollow, noarchive'
          }
        }
      );
    }

    // 3. Retrieve private master asset and R2 object
    const { asset, object } = await getWatermarkMasterAssetObject(db, bucket, assetId);

    // 4. Return metadata if specifically requested via accept header or query param
    const url = new URL(request.url);
    const wantsMeta = url.searchParams.get('meta') === '1' || request.headers.get('accept')?.includes('application/json');
    if (wantsMeta) {
      return new Response(
        JSON.stringify({
          status: 'ok',
          asset: {
            asset_id: asset.asset_id,
            mime: asset.mime_type,
            width: asset.width,
            height: asset.height,
            byte_size: asset.byte_size,
            sha256: asset.sha256,
            alpha_present: Boolean(asset.alpha_present)
          }
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
    }

    // 5. Stream master bytes with verified identity headers
    return new Response(object.body, {
      status: 200,
      headers: {
        'Content-Type': asset.mime_type,
        'Content-Length': String(asset.byte_size),
        'X-Asset-Id': asset.asset_id,
        'X-Asset-Mime': asset.mime_type,
        'X-Asset-Width': String(asset.width),
        'X-Asset-Height': String(asset.height),
        'X-Asset-Byte-Size': String(asset.byte_size),
        'X-Asset-Sha256': asset.sha256,
        'X-Asset-Alpha-Present': String(Boolean(asset.alpha_present)),
        'Cache-Control': 'private, no-store, no-transform',
        'X-Content-Type-Options': 'nosniff',
        'X-Robots-Tag': 'noindex, nofollow, noarchive'
      }
    });
  } catch (err: any) {
    if (err instanceof WatermarkAssetValidationError) {
      return new Response(
        JSON.stringify({
          status: 'error',
          code: err.code,
          message: err.message
        }),
        {
          status: err.statusCode || 400,
          headers: {
            'Content-Type': 'application/json',
            'Cache-Control': 'no-store, private'
          }
        }
      );
    }

    return new Response(
      JSON.stringify({
        status: 'error',
        code: 'INTERNAL_ERROR',
        message: err.message || 'Gagal menyajikan master watermark binary'
      }),
      {
        status: 500,
        headers: {
          'Content-Type': 'application/json',
          'Cache-Control': 'no-store, private'
        }
      }
    );
  }
};
