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

    const article = await insertArticle(db, {
      title,
      slug,
      description: body.description || title,
      content_md: contentMd,
      content_html: contentHtml,
      featured_image: body.featured_image || 'https://images.unsplash.com/photo-1518770660439-4636190af475?w=1200&auto=format&fit=crop&q=80',
      image_alt: body.image_alt || title,
      category_id: body.category_id || 1,
      author_id: body.author_id || 1,
      status: body.status || 'published',
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
