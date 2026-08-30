import type { APIRoute } from 'astro';

export const DELETE: APIRoute = async ({ request, locals }) => {
  try {
    const body = await request.json();
    const filename = body?.filename;

    if (!filename) {
      return new Response(
        JSON.stringify({ status: 'error', message: 'Nama file tidak boleh kosong' }),
        { status: 400 }
      );
    }

    // Clean filename (strip leading /media/ or URL protocol if present)
    const cleanFilename = filename.split('/').pop()?.split('?')[0] || filename;

    // Get Cloudflare R2 Bucket Binding
    const env = (locals as any).runtime?.env || (globalThis as any).process?.env;
    const bucket = env?.MEDIA_BUCKET;

    if (bucket && typeof bucket.delete === 'function') {
      await bucket.delete(cleanFilename);
    }

    return new Response(
      JSON.stringify({
        status: 'success',
        message: `File ${cleanFilename} berhasil dihapus dari Cloudflare R2.`
      }),
      { status: 200 }
    );
  } catch (err: any) {
    return new Response(
      JSON.stringify({ status: 'error', message: err.message || 'Gagal menghapus file dari R2' }),
      { status: 500 }
    );
  }
};
