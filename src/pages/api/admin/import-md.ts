import type { APIRoute } from 'astro';
import { marked } from 'marked';
import { getDb, checkDuplicateArticle, insertArticle } from '../../../lib/db';
import { generateContentHash, calculateReadingTime, slugifyText } from '../../../lib/seo';

export const POST: APIRoute = async ({ request, locals }) => {
  try {
    const formData = await request.formData();
    const filename = (formData.get('filename') as string) || 'untitled.md';
    const rawContent = (formData.get('content') as string) || '';
    const strategy = (formData.get('strategy') as string) || 'skip'; // 'skip' | 'overwrite' | 'rename'

    if (!rawContent.trim()) {
      return new Response(JSON.stringify({ status: 'error', error: 'File kosong' }), { status: 400 });
    }

    // 1. Simple Frontmatter Parser (YAML between ---)
    let frontmatter: Record<string, any> = {};
    let markdownBody = rawContent;

    const fmMatch = rawContent.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n([\s\S]*)$/);
    if (fmMatch) {
      const yamlBlock = fmMatch[1];
      markdownBody = fmMatch[2];

      yamlBlock.split('\n').forEach((line) => {
        const colonIdx = line.indexOf(':');
        if (colonIdx !== -1) {
          const key = line.slice(0, colonIdx).trim();
          let val = line.slice(colonIdx + 1).trim().replace(/^["']|["']$/g, '');
          frontmatter[key] = val;
        }
      });
    }

    // Extract title fallback from first H1 or filename
    let title = frontmatter.title;
    if (!title) {
      const h1Match = markdownBody.match(/^#\s+(.+)$/m);
      title = h1Match ? h1Match[1].trim() : filename.replace(/\.(md|markdown|txt)$/i, '').replace(/[-_]/g, ' ');
    }

    let slug = frontmatter.slug ? slugifyText(frontmatter.slug) : slugifyText(title);
    const contentHash = await generateContentHash(markdownBody);
    const db = await getDb(locals);

    // 2. Duplicate Detection Check
    const dupCheck = await checkDuplicateArticle(db, slug, contentHash);

    if (dupCheck.isDuplicate) {
      if (strategy === 'skip') {
        return new Response(
          JSON.stringify({
            status: 'duplicate_skipped',
            reason: dupCheck.reason,
            title,
            slug
          }),
          { status: 200 }
        );
      } else if (strategy === 'rename') {
        slug = `${slug}-${Date.now().toString().slice(-4)}`;
      }
      // if overwrite, continue and update
    }

    // 3. Render HTML from Markdown
    const contentHtml = await marked.parse(markdownBody);
    const readingTime = calculateReadingTime(markdownBody);

    // 4. Save to Database D1
    const newArticle = await insertArticle(db, {
      title,
      slug,
      description: frontmatter.description || title,
      content_md: markdownBody,
      content_html: contentHtml,
      featured_image: frontmatter.featured_image || 'https://images.unsplash.com/photo-1518770660439-4636190af475?w=1200&auto=format&fit=crop&q=80',
      image_alt: frontmatter.image_alt || title,
      category_id: parseInt(frontmatter.category_id || '1', 10),
      author_id: parseInt(frontmatter.author_id || '1', 10),
      status: frontmatter.status || 'draft',
      reading_time_minutes: readingTime,
      focus_keyword: frontmatter.focus_keyword || '',
      content_hash: contentHash,
      key_takeaways: frontmatter.key_takeaways || '[]',
      is_featured: frontmatter.is_featured === 'true' || frontmatter.is_featured === '1' ? 1 : 0,
      is_trending: frontmatter.is_trending === 'true' || frontmatter.is_trending === '1' ? 1 : 0
    });

    return new Response(
      JSON.stringify({
        status: 'success',
        title: newArticle.title,
        slug: newArticle.slug,
        id: newArticle.id
      }),
      { status: 200 }
    );
  } catch (err: any) {
    return new Response(
      JSON.stringify({ status: 'error', error: err.message || 'Gagal memproses markdown' }),
      { status: 500 }
    );
  }
};
