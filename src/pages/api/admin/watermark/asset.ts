import type { APIRoute } from 'astro';
import { getDb } from '../../../../lib/db';
import {
  uploadWatermarkMasterAsset,
  WatermarkAssetValidationError
} from '../../../../lib/watermark/assets';

export const POST: APIRoute = async ({ request, locals }) => {
  try {
    const contentType = request.headers.get('content-type') || '';
    if (!contentType.includes('multipart/form-data')) {
      return new Response(
        JSON.stringify({
          status: 'error',
          code: 'INVALID_CONTENT_TYPE',
          message: 'Permintaan harus menggunakan format multipart/form-data.'
        }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    const formData = await request.formData();
    const file = formData.get('file');

    if (!file || !(file instanceof Blob)) {
      return new Response(
        JSON.stringify({
          status: 'error',
          code: 'FILE_REQUIRED',
          message: 'Berkas gambar watermark master (file) wajib disertakan.'
        }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    const filename = (file as any).name || (formData.get('filename') as string) || 'watermark-master';
    const declaredMime = file.type || '';
    const arrayBuffer = await file.arrayBuffer();
    const fileBuffer = new Uint8Array(arrayBuffer);

    // Cloudflare Runtime Bindings
    const env = (locals as any).runtime?.env || (globalThis as any).process?.env || {};
    const db = (await getDb(locals)) || env.DB || (locals as any)?.db;
    const bucket = env.MEDIA_BUCKET;

    const actor = (locals as any)?.user?.username || (locals as any)?.user?.email || 'admin';

    const result = await uploadWatermarkMasterAsset({
      fileBuffer,
      filename,
      declaredMime,
      db,
      bucket,
      actor
    });

    return new Response(
      JSON.stringify({
        status: 'success',
        asset: result.asset,
        deduplicated: result.deduplicated,
        message: result.deduplicated
          ? 'Watermark master identik sudah ada, asset digunakan kembali.'
          : 'Watermark master berhasil divalidasi dan disimpan di R2.'
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
          code: err.code || 'VALIDATION_ERROR',
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
        message: err.message || 'Gagal memproses upload watermark master asset.'
      }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
};
