import type { APIRoute } from 'astro';

export const POST: APIRoute = async ({ request, locals }) => {
  try {
    const formData = await request.formData();
    const file = formData.get('file') as File;

    if (!file) {
      return new Response(JSON.stringify({ status: 'error', message: 'Tidak ada file gambar yang diunggah' }), { status: 400 });
    }

    const filename = (formData.get('filename') as string) || `cover-${Date.now()}.webp`;
    const arrayBuffer = await file.arrayBuffer();

    // 1. Get Cloudflare R2 Bucket Binding
    const env = (locals as any).runtime?.env || (globalThis as any).process?.env;
    const bucket = env?.MEDIA_BUCKET;

    if (bucket && typeof bucket.put === 'function') {
      await bucket.put(filename, arrayBuffer, {
        httpMetadata: {
          contentType: file.type || 'image/webp',
          cacheControl: 'public, max-age=31536000, immutable'
        }
      });

      const imageUrl = `/media/${filename}`;
      return new Response(
        JSON.stringify({
          status: 'success',
          url: imageUrl,
          filename,
          size: arrayBuffer.byteLength
        }),
        { status: 200 }
      );
    }

    // Fallback if R2 binding is not available (local testing)
    const base64Data = Buffer.from(arrayBuffer).toString('base64');
    const dataUrl = `data:${file.type || 'image/webp'};base64,${base64Data}`;

    return new Response(
      JSON.stringify({
        status: 'success',
        url: dataUrl,
        filename,
        size: arrayBuffer.byteLength
      }),
      { status: 200 }
    );
  } catch (err: any) {
    return new Response(
      JSON.stringify({ status: 'error', message: err.message || 'Gagal mengunggah gambar ke R2' }),
      { status: 500 }
    );
  }
};
