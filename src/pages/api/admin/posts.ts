import type { APIRoute } from 'astro';
import { marked } from 'marked';
import { getDb, insertArticle } from '../../../lib/db';
import { generateContentHash, calculateReadingTime, slugifyText } from '../../../lib/seo';

export const POST: APIRoute = async ({ request, locals }) => {
  try {
    const body = await request.json();
    const db = await getDb(locals);

    const title = body.title || 'Untitled';
    const slug = body.slug ? slugifyText(body.slug) : slugifyText(title);
    const contentMd = body.content_md || '';
    const contentHtml = await marked.parse(contentMd);
    const readingTime = calculateReadingTime(contentMd);
    const contentHash = await generateContentHash(contentMd);

    let status = body.status || 'draft';

    // Automatic Quality Gate / Completeness Validation for 'published'
    if (status === 'published') {
      const missingFields: string[] = [];
      if (!title || title.trim().length < 5 || title === 'Untitled') missingFields.push('Judul Artikel (min. 5 karakter)');
      if (!contentMd || contentMd.trim().length < 50) missingFields.push('Konten Artikel (min. 50 karakter)');
      if (!body.description || body.description.trim().length < 10) missingFields.push('Meta Deskripsi (min. 10 karakter)');
      if (!body.featured_image || body.featured_image.trim() === '') missingFields.push('Featured Image / Cover');
      if (!body.category_id) missingFields.push('Kategori Artikel');
      if (!body.author_id) missingFields.push('Penulis (Author E-E-A-T)');

      if (missingFields.length > 0) {
        return new Response(
          JSON.stringify({
            status: 'validation_error',
            message: `Artikel belum lengkap untuk dipublish. Mohon lengkapi: ${missingFields.join(', ')}.`,
            missingFields
          }),
          { status: 422 }
        );
      }
    }

    const article = await insertArticle(db, {
      title,
      slug,
      description: body.description || title,
      content_md: contentMd,
      content_html: contentHtml,
      featured_image: body.featured_image || 'https://images.unsplash.com/photo-1600585154340-be6161a56a0c?w=720&auto=format&fit=crop&q=75',
      image_alt: body.image_alt || title,
      category_id: body.category_id || 1,
      author_id: body.author_id || 1,
      status,
      reading_time_minutes: readingTime,
      key_takeaways: body.key_takeaways || '[]',
      focus_keyword: body.focus_keyword || '',
      content_hash: contentHash,
      is_featured: body.is_featured ? 1 : 0,
      is_trending: body.is_trending ? 1 : 0
    });

    return new Response(JSON.stringify({ status: 'success', article }), { status: 200 });
  } catch (err: any) {
    return new Response(JSON.stringify({ status: 'error', message: err.message }), { status: 500 });
  }
};
