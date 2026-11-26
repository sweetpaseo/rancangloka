import type { APIRoute } from 'astro';
import { getDb, getArticleById, insertArticle, updateArticle } from '../../../lib/db';
import { generateContentHash, calculateReadingTime, slugifyText } from '../../../lib/seo';
import { renderArticleMarkdownSafely } from '../../../lib/article/renderer.ts';
import { synchronizeVisualManifestOnContentEdit } from '../../../lib/media/manifest-synchronizer.ts';
import { computeCanonicalContentHash, resolveVisualPlacements } from '../../../lib/media/anchor-resolver.ts';
import { screenTopicCandidateWithD1 } from '../../../lib/editorial/duplicate-prevention-service.ts';
import {
  registerOrUpdateEditorialTopic,
  recordOwnerDuplicateOverride
} from '../../../lib/editorial/topic-registry-service.ts';

export const POST: APIRoute = async ({ request, locals }) => {
  try {
    const body = await request.json();
    const db = await getDb(locals);

    const title = body.title || 'Untitled';
    const slug = body.slug ? slugifyText(body.slug) : slugifyText(title);
    const contentMd = body.content_md || '';
    const contentHtml = await renderArticleMarkdownSafely(contentMd);
    const readingTime = calculateReadingTime(contentMd);
    const contentHash = await generateContentHash(contentMd);

    let status = body.status || 'draft';

    // CANONICAL INVARIANT: Direct published article creation is forbidden
    if (status === 'published') {
      return new Response(
        JSON.stringify({
          status: 'error',
          code: 'DIRECT_PUBLISHED_INSERT_FORBIDDEN',
          message: 'DIRECT_PUBLISHED_INSERT_FORBIDDEN: Artikel baru tidak dapat langsung dibuat dengan status published. Simpan sebagai draft terlebih dahulu, lalu lakukan publikasi melalui alur Chief Editor / Publisher kanonikal.'
        }),
        { status: 400 }
      );
    }

    const ctx = (locals as any)?.runtime?.ctx || (locals as any)?.ctx;

    // UTLIS-V1: Unified Duplicate Screening for Manual Owner Articles
    let screening: any = null;
    try {
      screening = await screenTopicCandidateWithD1(db, {
        title,
        slug,
        focus_keyword: body.focus_keyword || '',
        search_intent: body.search_intent || 'Informational',
        content_angle: body.content_angle || 'Manual Owner Article',
        content_md: contentMd,
        screening_stage: 'PRE_DISPATCH'
      });

      if (screening.action === 'BLOCK' && !body.override_duplicate_warning) {
        return new Response(
          JSON.stringify({
            status: 'error',
            code: 'DUPLICATE_TOPIC_WARNING',
            message: `Peringatan Duplikasi: ${screening.decision_rationale}`,
            screening
          }),
          { status: 409 }
        );
      }
    } catch (_) {}

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
      is_trending: body.is_trending ? 1 : 0,
      is_sponsored: body.is_sponsored ? 1 : 0,
      disable_internal_links: body.disable_internal_links ? 1 : (body.is_sponsored ? 1 : 0)
    }, { ctx });

    // Sync Manual Owner draft into Maya's Persistent Topic Registry (non-blocking)
    try {
      const reg = await registerOrUpdateEditorialTopic(
        db,
        {
          topic_id: body.topic_id || `TOPIC-OWNER-${article.id}`,
          category_id: body.category_id || 1,
          candidate_title: title,
          canonical_slug: slug,
          focus_keyword: body.focus_keyword || slug.replace(/-/g, ' '),
          discovery_source: 'MANUAL_OWNER',
          proposing_staff: 'owner',
          lifecycle_status: 'EDITORIAL_REVIEW',
          related_article_id: article.id,
          environment_scope: 'staging',
          override_duplicate_warning: Boolean(body.override_duplicate_warning),
          override_reason: body.override_reason
        },
        'owner',
        { skipDuplicateScreening: true }
      );
      if (body.override_duplicate_warning && reg.topic_id) {
        await recordOwnerDuplicateOverride(
          db,
          reg.topic_id,
          'owner',
          body.override_reason || 'Owner memilih melanjutkan pembuatan draf manual.',
          { article_id: article.id, matched_title: screening?.matched_title }
        );
      }
    } catch (_) {}

    return new Response(JSON.stringify({ status: 'success', article, screening }), { status: 200 });
  } catch (err: any) {
    return new Response(JSON.stringify({ status: 'error', message: err.message }), { status: 500 });
  }
};

export const PUT: APIRoute = async ({ request, locals }) => {
  try {
    const body = await request.json();
    const db = await getDb(locals);
    const id = parseInt(body.id, 10);

    if (isNaN(id)) {
      return new Response(JSON.stringify({ status: 'error', message: 'ID artikel tidak valid' }), { status: 400 });
    }

    // 1. Fetch existing article to protect against concurrent overwrites & verify state
    let existingArticle: any = null;
    if (db) {
      existingArticle = await getArticleById(db, id);
    }
    if (!existingArticle) {
      return new Response(JSON.stringify({ status: 'error', message: `Artikel dengan ID ${id} tidak ditemukan.` }), { status: 404 });
    }

    // 2. Concurrency check: If client provided expected_content_hash, verify it matches
    if (body.expected_content_hash && existingArticle.content_hash && body.expected_content_hash !== existingArticle.content_hash) {
      return new Response(JSON.stringify({
        status: 'error',
        code: 'CONCURRENT_EDIT_CONFLICT',
        message: 'Konflik Pengeditan: Artikel ini telah diubah di sesi lain sejak Anda membukanya. Silakan muat ulang halaman sebelum menyimpan perubahan.'
      }), {
        status: 409,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    const updates: any = {};
    if (body.title !== undefined) updates.title = body.title;
    if (body.slug !== undefined) updates.slug = slugifyText(body.slug);
    if (body.description !== undefined) updates.description = body.description;

    const activeMarkdown = body.content_md !== undefined ? body.content_md : existingArticle.content_md;

    // 3. Synchronize visual manifest if markdown content or manifest items are touched
    let syncResult: any = null;
    if (body.content_md !== undefined || body.visual_manifest_items !== undefined) {
      syncResult = await synchronizeVisualManifestOnContentEdit(db, id, activeMarkdown, {
        newSlug: updates.slug || existingArticle.slug,
        expectedOldHash: body.expected_content_hash || existingArticle.content_hash,
        userEditedItems: body.visual_manifest_items,
        featuredUpdate: body.featured_image ? {
          src: body.featured_image,
          alt: body.image_alt,
          caption: body.image_caption
        } : undefined
      });

      // Fail-closed with actionable message if any image anchor is broken
      if (!syncResult.success) {
        return new Response(JSON.stringify({
          status: 'error',
          code: syncResult.code || 'CANNOT_RESOLVE_PLACEMENT',
          message: syncResult.message,
          unplacedItems: syncResult.unplacedItems,
          warnings: syncResult.warnings
        }), {
          status: 422,
          headers: { 'Content-Type': 'application/json' }
        });
      }
    }

    if (body.content_md !== undefined) {
      updates.content_md = body.content_md;
      const rawHtml = await renderArticleMarkdownSafely(body.content_md);
      if (syncResult?.manifest) {
        const placement = resolveVisualPlacements(rawHtml, syncResult.manifest, {
          isDev: true,
          allowUnapprovedInPreview: true
        });
        updates.content_html = placement.isValid && placement.html ? placement.html : rawHtml;
      } else {
        updates.content_html = rawHtml;
      }
      updates.reading_time_minutes = calculateReadingTime(body.content_md);
      updates.content_hash = syncResult?.newContentHash || computeCanonicalContentHash(body.content_md);
    }
    if (body.featured_image !== undefined) updates.featured_image = body.featured_image;
    if (body.image_alt !== undefined) updates.image_alt = body.image_alt;
    if (body.category_id !== undefined) updates.category_id = parseInt(body.category_id, 10);
    if (body.author_id !== undefined) updates.author_id = parseInt(body.author_id, 10);
    if (body.status !== undefined) updates.status = body.status;
    if (body.key_takeaways !== undefined) updates.key_takeaways = body.key_takeaways;
    if (body.focus_keyword !== undefined) updates.focus_keyword = body.focus_keyword;
    if (body.is_featured !== undefined) updates.is_featured = body.is_featured ? 1 : 0;
    if (body.is_trending !== undefined) updates.is_trending = body.is_trending ? 1 : 0;
    if (body.is_sponsored !== undefined) updates.is_sponsored = body.is_sponsored ? 1 : 0;
    if (body.disable_internal_links !== undefined) updates.disable_internal_links = body.disable_internal_links ? 1 : 0;

    const ctx = (locals as any)?.runtime?.ctx || (locals as any)?.ctx;
    const article = await updateArticle(db, id, updates, { ctx });
    return new Response(JSON.stringify({
      status: 'success',
      article,
      manifest: syncResult?.manifest,
      placedCount: syncResult?.placedCount
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (err: any) {
    return new Response(JSON.stringify({ status: 'error', message: err.message }), { status: 500 });
  }
};
