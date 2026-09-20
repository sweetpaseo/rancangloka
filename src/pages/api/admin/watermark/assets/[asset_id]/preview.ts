import type { APIRoute } from 'astro';
import { getDb } from '../../../../../../lib/db';
import {
  getWatermarkMasterAssetObject,
  WatermarkAssetValidationError
} from '../../../../../../lib/watermark/assets';

export const GET: APIRoute = async ({ params, locals }) => {
  try {
    const assetId = params.asset_id;
    if (!assetId) {
      return new Response('asset_id parameter is required', { status: 400 });
    }

    const env = (locals as any).runtime?.env || (globalThis as any).process?.env || {};
    const db = (await getDb(locals)) || env.DB || (locals as any)?.db;
    const bucket = env.MEDIA_BUCKET;

    const { asset, object } = await getWatermarkMasterAssetObject(db, bucket, assetId);

    return new Response(object.body, {
      status: 200,
      headers: {
        'Content-Type': asset.mime_type,
        'Content-Length': String(asset.byte_size),
        'Cache-Control': 'private, no-cache, no-transform',
        'X-Content-Type-Options': 'nosniff',
        'X-Robots-Tag': 'noindex, nofollow, noarchive'
      }
    });
  } catch (err: any) {
    if (err instanceof WatermarkAssetValidationError) {
      return new Response(err.message, { status: err.statusCode || 400 });
    }

    return new Response(err.message || 'Gagal menyajikan preview master watermark', {
      status: 500
    });
  }
};
