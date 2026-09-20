import type { APIRoute } from 'astro';
import { getDb } from '../../../../../lib/db';
import {
  getWatermarkMasterAsset,
  deleteWatermarkMasterAsset,
  WatermarkAssetValidationError
} from '../../../../../lib/watermark/assets';

export const GET: APIRoute = async ({ params, locals }) => {
  try {
    const assetId = params.asset_id;
    if (!assetId) {
      return new Response(
        JSON.stringify({ status: 'error', message: 'asset_id parameter is required' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    const env = (locals as any).runtime?.env || (globalThis as any).process?.env || {};
    const db = (await getDb(locals)) || env.DB || (locals as any)?.db;

    const asset = await getWatermarkMasterAsset(db, assetId);
    if (!asset) {
      return new Response(
        JSON.stringify({
          status: 'error',
          code: 'ASSET_NOT_FOUND',
          message: `Watermark master asset dengan ID '${assetId}' tidak ditemukan.`
        }),
        { status: 404, headers: { 'Content-Type': 'application/json' } }
      );
    }

    return new Response(
      JSON.stringify({
        status: 'success',
        asset: {
          asset_id: asset.asset_id,
          purpose: asset.purpose,
          source_filename: asset.source_filename,
          mime_type: asset.mime_type,
          width: asset.width,
          height: asset.height,
          byte_size: asset.byte_size,
          sha256: asset.sha256,
          alpha_present: asset.alpha_present,
          status: asset.status,
          created_at: asset.created_at,
          updated_at: asset.updated_at
        }
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
        code: 'INTERNAL_ERROR',
        message: err.message || 'Gagal membaca metadata watermark asset.'
      }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
};

export const DELETE: APIRoute = async ({ params, locals }) => {
  try {
    const assetId = params.asset_id;
    if (!assetId) {
      return new Response(
        JSON.stringify({ status: 'error', message: 'asset_id parameter is required' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    const env = (locals as any).runtime?.env || (globalThis as any).process?.env || {};
    const db = (await getDb(locals)) || env.DB || (locals as any)?.db;
    const bucket = env.MEDIA_BUCKET;

    const result = await deleteWatermarkMasterAsset(db, bucket, assetId);

    return new Response(
      JSON.stringify({
        status: 'success',
        message: result.message
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
    if (err instanceof WatermarkAssetValidationError) {
      return new Response(
        JSON.stringify({
          status: 'error',
          code: err.code,
          message: err.message
        }),
        {
          status: err.statusCode || 400,
          headers: { 'Content-Type': 'application/json' }
        }
      );
    }

    return new Response(
      JSON.stringify({
        status: 'error',
        code: 'INTERNAL_ERROR',
        message: err.message || 'Gagal menghapus watermark master asset.'
      }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
};
