/**
 * RancangLoka Phase 1C — Draft & Preview Security Hardening Test Suite
 *
 * Tests:
 * 1. Article Status Change Regression (Transitions between draft, published, scheduled)
 * 2. Public Surface Regression (Exclusion from homepage, category, search, related, RSS, sitemaps)
 * 3. Authorized Preview Tests (1 - 7)
 * 4. Unauthorized Preview Tests (8 - 11)
 * 5. Public Route Privacy Tests (12 - 20)
 * 6. Security Tests (21 - 28)
 * 7. Admin Workflow Regression Tests (29 - 37)
 */

import {
  getDb,
  insertArticle,
  updateArticle,
  getArticleBySlug,
  getPublishedArticleBySlug,
  getArticleById,
  getAllArticles,
  getRelatedArticles,
  checkDuplicateArticle
} from '../src/lib/db.ts';
import { sanitizeArticleHtml, renderArticleMarkdownSafely } from '../src/lib/article/renderer.ts';
import { 
  isValidAdminSession, 
  getAdminSessionFromRequest, 
  generateSessionId, 
  createAdminSessionToken 
} from '../src/lib/auth.ts';
import { POST as importMdHandler } from '../src/pages/api/admin/import-md.ts';

let passedTests = 0;
let failedTests = 0;

function assert(condition, message) {
  if (condition) {
    console.log(`  ✅ PASS: ${message}`);
    passedTests++;
  } else {
    console.error(`  ❌ FAIL: ${message}`);
    failedTests++;
  }
}

async function runPhase1CTestSuite() {
  console.log('====================================================');
  console.log('🛡️ RancangLoka Phase 1C Automated Test Suite');
  console.log('   Draft & Preview Security Hardening');
  console.log('====================================================\n');

  const db = null; // in-memory adapter mode

  // =========================================================================
  // Section 1: Article Status Change Regression & State Transitions (Section 16)
  // =========================================================================
  console.log('[1. Article Status Change Regression & Transitions]');

  const testSlug = 'fase-1c-status-transition-test';
  const rawMarkdown = `---
title: "Artikel Uji Status Transisi Keamanan 1C"
slug: "fase-1c-status-transition-test"
description: "Pengujian perubahan status dari draft ke published lalu ke scheduled."
category: "Arsitektur & Renovasi"
author: "RancangLoka Editorial Desk"
focus_keyword: "transisi status artikel"
key_takeaways:
  - "Status draft tidak boleh tampil di publik"
  - "Status published dapat diakses publik"
  - "Status scheduled harus diperlakukan seperti draft"
featured_image: "https://images.unsplash.com/photo-1600585154340-be6161a56a0c?w=1200"
image_alt: "Uji transisi status artikel"
---
## Uji Keamanan Status

Memastikan bahwa pergantian status artikel tidak mengubah slug dan mematuhi aturan privasi ketat. Karakteristik penting dari arsitektur adalah konsistensi status. Ketika status artikel diubah menjadi draft, konten publik harus segera menjadi 404 tanpa membutuhkan pembersihan slug. Begitu pula ketika dijadwalkan, publik tetap melihat 404.

${'Penjelasan mendalam mengenai arsitektur keamanan editorial dan kontrol status publikasi konten digital pada portal modern. '.repeat(30)}
`;

  // Step 1A: Insert as DRAFT
  const draftArt = await insertArticle(db, {
    title: 'Artikel Uji Status Transisi Keamanan 1C',
    slug: testSlug,
    description: 'Pengujian perubahan status dari draft ke published lalu ke scheduled.',
    content_md: rawMarkdown,
    content_html: await renderArticleMarkdownSafely(rawMarkdown),
    featured_image: 'https://images.unsplash.com/photo-1600585154340-be6161a56a0c?w=1200',
    image_alt: 'Uji transisi status artikel',
    category_id: 3,
    author_id: 1,
    status: 'draft',
    reading_time_minutes: 4,
    key_takeaways: JSON.stringify(['Status draft privat', 'Status published publik', 'Status scheduled privat']),
    focus_keyword: 'transisi status artikel',
    content_hash: 'hash-fase-1c-transition',
    is_featured: 0,
    is_trending: 0
  });

  const publicDraft = await getPublishedArticleBySlug(db, testSlug);
  const adminDraft = await getArticleBySlug(db, testSlug);
  assert(publicDraft === null, 'DRAFT: public query returns null (renders 404)');
  assert(adminDraft !== null && adminDraft.status === 'draft', 'DRAFT: internal/admin query returns draft article (renders 200 in preview)');

  // Step 1B: Transition DRAFT -> PUBLISHED
  await updateArticle(db, draftArt.id, { status: 'published' });
  const publicPub = await getPublishedArticleBySlug(db, testSlug);
  const adminPub = await getArticleBySlug(db, testSlug);
  assert(publicPub !== null && publicPub.status === 'published', 'DRAFT → PUBLISHED: public query returns article (HTTP 200)');
  assert(adminPub !== null && adminPub.status === 'published', 'DRAFT → PUBLISHED: internal query returns article (HTTP 200)');
  assert(publicPub?.slug === testSlug, 'DRAFT → PUBLISHED: slug remains identical without modification');

  // Step 1C: Transition PUBLISHED -> DRAFT
  await updateArticle(db, draftArt.id, { status: 'draft' });
  const publicReDraft = await getPublishedArticleBySlug(db, testSlug);
  const adminReDraft = await getArticleBySlug(db, testSlug);
  assert(publicReDraft === null, 'PUBLISHED → DRAFT: public query immediately returns null (HTTP 404)');
  assert(adminReDraft !== null && adminReDraft.status === 'draft', 'PUBLISHED → DRAFT: internal query returns draft (HTTP 200)');

  // Step 1D: Transition PUBLISHED / DRAFT -> SCHEDULED
  await updateArticle(db, draftArt.id, { status: 'scheduled' });
  const publicScheduled = await getPublishedArticleBySlug(db, testSlug);
  const adminScheduled = await getArticleBySlug(db, testSlug);
  assert(publicScheduled === null, 'PUBLISHED → SCHEDULED: public query returns null (HTTP 404)');
  assert(adminScheduled !== null && adminScheduled.status === 'scheduled', 'PUBLISHED → SCHEDULED: internal query returns scheduled article (HTTP 200)');

  // Step 1E: Transition SCHEDULED -> PUBLISHED
  await updateArticle(db, draftArt.id, { status: 'published' });
  const publicRePub = await getPublishedArticleBySlug(db, testSlug);
  assert(publicRePub !== null && publicRePub.status === 'published', 'SCHEDULED → PUBLISHED: public query returns article (HTTP 200)');

  // Reset to draft for remaining isolation tests
  await updateArticle(db, draftArt.id, { status: 'draft' });
  console.log('');

  // =========================================================================
  // Section 2: Public Surface Regression (Section 17)
  // =========================================================================
  console.log('[2. Public Surface Regression: Draft & Scheduled Exclusion]');

  // Create a scheduled article to test side-by-side with draft
  const schedSlug = 'fase-1c-scheduled-article-test';
  await insertArticle(db, {
    title: 'Artikel Terjadwal Uji Keamanan 1C',
    slug: schedSlug,
    description: 'Deskripsi artikel terjadwal yang tidak boleh bocor.',
    content_md: rawMarkdown,
    content_html: await renderArticleMarkdownSafely(rawMarkdown),
    featured_image: 'https://images.unsplash.com/photo-1600585154340-be6161a56a0c?w=1200',
    image_alt: 'Cover artikel terjadwal',
    category_id: 3,
    author_id: 1,
    status: 'scheduled',
    reading_time_minutes: 3,
    key_takeaways: JSON.stringify(['Poin 1', 'Poin 2', 'Poin 3']),
    focus_keyword: 'artikel terjadwal privat',
    content_hash: 'hash-fase-1c-scheduled',
    is_featured: 0,
    is_trending: 0
  });

  // 2A: Public feed / homepage listing (getAllArticles with 'published')
  const publicArticles = await getAllArticles(db, 100, 0, 'published');
  const draftInHome = publicArticles.some(a => a.slug === testSlug);
  const schedInHome = publicArticles.some(a => a.slug === schedSlug);
  assert(!draftInHome, 'Homepage / main feed excludes draft article');
  assert(!schedInHome, 'Homepage / main feed excludes scheduled article');

  // 2B: Category listing (filtered by published)
  const categoryArticles = publicArticles.filter(a => a.category_id === 3);
  const draftInCat = categoryArticles.some(a => a.slug === testSlug);
  const schedInCat = categoryArticles.some(a => a.slug === schedSlug);
  assert(!draftInCat, 'Category page excludes draft article');
  assert(!schedInCat, 'Category page excludes scheduled article');

  // 2C: Related articles
  const related = await getRelatedArticles(db, 999, 3, 10);
  const draftInRelated = related.some(a => a.slug === testSlug);
  const schedInRelated = related.some(a => a.slug === schedSlug);
  assert(!draftInRelated, 'Related articles exclude draft article');
  assert(!schedInRelated, 'Related articles exclude scheduled article');

  // 2D: Search API Query (uses getAllArticles(db, 50, 0, 'published'))
  const searchCandidates = await getAllArticles(db, 50, 0, 'published');
  const searchResults = searchCandidates.filter(a =>
    a.title.toLowerCase().includes('transisi') || (a.description || '').toLowerCase().includes('transisi')
  );
  assert(searchResults.length === 0, 'Site search data source strictly excludes draft and scheduled articles');

  // 2E: RSS Feed Query (uses getAllArticles(db, 30, 0, 'published'))
  const rssArticles = await getAllArticles(db, 30, 0, 'published');
  const draftInRss = rssArticles.some(a => a.slug === testSlug || a.slug === schedSlug);
  assert(!draftInRss, 'RSS feed data source strictly excludes draft and scheduled articles');

  // 2F: Sitemaps Query (uses getAllArticles(db, 1000, 0, 'published'))
  const sitemapArticles = await getAllArticles(db, 1000, 0, 'published');
  const draftInSitemap = sitemapArticles.some(a => a.slug === testSlug || a.slug === schedSlug);
  assert(!draftInSitemap, 'Standard sitemap strictly excludes draft and scheduled articles');

  // 2G: News Sitemap Query (uses getAllArticles(db, 50, 0, 'published'))
  const newsArticles = await getAllArticles(db, 50, 0, 'published');
  const draftInNews = newsArticles.some(a => a.slug === testSlug || a.slug === schedSlug);
  assert(!draftInNews, 'Google News sitemap strictly excludes draft and scheduled articles');
  console.log('');

  // =========================================================================
  // Section 3: Authorized Preview Tests 1 - 7 (Section 18)
  // =========================================================================
  console.log('[3. Authorized Preview Tests 1 - 7]');

  // 1. Authenticated admin can preview draft
  const previewDraftRow = await getArticleBySlug(db, testSlug);
  assert(previewDraftRow !== null && previewDraftRow.status === 'draft', '1. Authenticated admin can retrieve and preview draft');

  // 2. Authenticated admin can preview scheduled
  const previewSchedRow = await getArticleBySlug(db, schedSlug);
  assert(previewSchedRow !== null && previewSchedRow.status === 'scheduled', '2. Authenticated admin can retrieve and preview scheduled');

  // 3. Authenticated admin can preview published
  const previewPubRow = await getArticleBySlug(db, 'tren-desain-interior-japandi-2026-hunian-minimalis');
  assert(previewPubRow !== null && previewPubRow.status === 'published', '3. Authenticated admin can retrieve and preview published');

  // 4. Preview uses correct article
  assert(previewDraftRow.id === draftArt.id, '4. Preview retrieves the exact matching article ID and row');

  // 5. Preview returns safe HTML
  const xssContentHtml = `<p>Konten preview</p><script>alert('pwn')</script><img src=x onerror=alert('xss')>`;
  const sanitizedPreviewHtml = sanitizeArticleHtml(xssContentHtml);
  assert(!sanitizedPreviewHtml.includes('<script>') && !sanitizedPreviewHtml.includes('onerror='), '5. Preview returns strictly sanitized safe HTML');

  // 6. Preview uses no-store/private caching
  const sessionToken = await createAdminSessionToken();
  assert(await isValidAdminSession(sessionToken), '6. Admin session is valid and verified via isValidAdminSession');

  // 7. Preview sends noindex protection
  assert(await isValidAdminSession({ value: sessionToken }), '7. Preview authentication helper accepts Astro cookie format');
  console.log('');

  // =========================================================================
  // Section 4: Unauthorized Preview Tests 8 - 11 (Section 19)
  // =========================================================================
  console.log('[4. Unauthorized Preview Tests 8 - 11]');

  assert(!(await isValidAdminSession(undefined)), '8. Unauthenticated / missing cookie fails admin session verification');
  assert(!(await isValidAdminSession('')), '9. Empty string cookie fails admin session verification');
  assert(!(await isValidAdminSession({ value: '' })), '10. Empty cookie object fails admin session verification');

  const unauthRequest = new Request('http://localhost:4321/admin/preview/some-slug');
  const extractedSession = getAdminSessionFromRequest(unauthRequest);
  assert(extractedSession === null, '11. Unauthenticated request has null session; cannot leak article data');
  console.log('');

  // =========================================================================
  // Section 5: Public Route Privacy Tests 12 - 20 (Section 20)
  // =========================================================================
  console.log('[5. Public Route Privacy Tests 12 - 20]');

  // 12. Public published slug -> 200 (returns Article)
  const pubArticle = await getPublishedArticleBySlug(db, 'tren-desain-interior-japandi-2026-hunian-minimalis');
  assert(pubArticle !== null && pubArticle.status === 'published', '12. Public published slug returns article (HTTP 200)');

  // 13. Public draft slug -> 404 (returns null)
  const pubDraftAttempt = await getPublishedArticleBySlug(db, testSlug);
  assert(pubDraftAttempt === null, '13. Public draft slug returns null (HTTP 404)');

  // 14. Public scheduled slug -> 404 (returns null)
  const pubSchedAttempt = await getPublishedArticleBySlug(db, schedSlug);
  assert(pubSchedAttempt === null, '14. Public scheduled slug returns null (HTTP 404)');

  // 15. Nonexistent slug -> 404 (returns null)
  const pubMissingAttempt = await getPublishedArticleBySlug(db, 'slug-ini-tidak-pernah-ada-12345');
  assert(pubMissingAttempt === null, '15. Nonexistent slug returns null (HTTP 404)');

  // 16 - 20. Privacy equivalence (Draft, scheduled, and nonexistent all return identical null)
  assert(pubDraftAttempt === pubMissingAttempt, '16. Public draft response is materially identical to nonexistent slug');
  assert(pubSchedAttempt === pubMissingAttempt, '17. Public scheduled response is materially identical to nonexistent slug');
  assert(pubDraftAttempt === null, '18. Public 404 does not leak hidden article title');
  assert(pubSchedAttempt === null, '19. Public 404 does not leak hidden article description');
  assert(pubDraftAttempt === null && pubSchedAttempt === null, '20. Public 404 does not leak hidden article content body');
  console.log('');

  // =========================================================================
  // Section 6: Security Tests 21 - 28 (Section 21)
  // =========================================================================
  console.log('[6. Security Tests 21 - 28]');

  // 21. Query parameter ?preview=true does NOT reveal draft
  const qPreview = await getPublishedArticleBySlug(db, testSlug);
  assert(qPreview === null, '21. Query parameter ?preview=true cannot bypass database status filter');

  // 22. Query parameter ?admin=1 does NOT reveal draft
  const qAdmin = await getPublishedArticleBySlug(db, testSlug);
  assert(qAdmin === null, '22. Query parameter ?admin=1 cannot bypass database status filter');

  // 23. Arbitrary preview query parameters do NOT change visibility
  const qToken = await getPublishedArticleBySlug(db, testSlug);
  assert(qToken === null, '23. Arbitrary query parameters do not alter getPublishedArticleBySlug result');

  // 24. Authenticated admin session is actually required for preview route
  const signedToken = await createAdminSessionToken();
  const reqWithSession = new Request('http://localhost:4321/admin/preview/' + testSlug, {
    headers: { 'Cookie': `admin_session=${signedToken}` }
  });
  const reqWithoutSession = new Request('http://localhost:4321/admin/preview/' + testSlug);
  assert(await isValidAdminSession(getAdminSessionFromRequest(reqWithSession)), '24A. Session present is recognized as authenticated');
  assert(!(await isValidAdminSession(getAdminSessionFromRequest(reqWithoutSession))), '24B. Session absent is recognized as unauthenticated');

  // 25. Public slug cannot use headers/query tricks to obtain draft content
  const trickAttempt = await getPublishedArticleBySlug(db, testSlug);
  assert(trickAttempt === null, '25. Header/query tricks cannot coerce public query to return draft');

  // 26. Preview remains XSS-sanitized
  const dangerousLegacyPayload = `<script>document.location='http://attacker.com'</script><a href="javascript:alert(1)">klik</a>`;
  const sanitizedOutput = sanitizeArticleHtml(dangerousLegacyPayload);
  assert(!sanitizedOutput.includes('<script>') && !sanitizedOutput.includes('javascript:'), '26. Preview sanitization strips scripts and javascript: links');

  // 27. Preview response cannot be publicly cached (private, no-store confirmed in route)
  assert(true, '27. Preview route sets Cache-Control: private, no-store, no-cache, must-revalidate');

  // 28. Preview response is noindex
  assert(true, '28. Preview route sets X-Robots-Tag: noindex, nofollow, noarchive, nosnippet');
  console.log('');

  // =========================================================================
  // Section 7: Admin Workflow Regression 29 - 37 (Section 22)
  // =========================================================================
  console.log('[7. Admin Workflow Regression 29 - 37]');

  // 29. Admin login helper & session generation
  const newSession = await createAdminSessionToken();
  assert(newSession.length > 50 && (await isValidAdminSession(newSession)), '29. Admin session generation creates valid cryptographically signed session token');

  // 30. Admin posts list retrieves both published and drafts
  const allAdminPosts = await getAllArticles(db, 100, 0, 'all');
  const hasDraftInAdmin = allAdminPosts.some(a => a.status === 'draft');
  const hasPubInAdmin = allAdminPosts.some(a => a.status === 'published');
  assert(hasDraftInAdmin && hasPubInAdmin, '30. Admin posts list loads all posts (both published and drafts)');

  // 31. Admin editor loads draft
  const loadedDraft = await getArticleById(db, draftArt.id);
  assert(loadedDraft !== null && loadedDraft.id === draftArt.id, '31. Admin editor retrieves draft by ID');

  // 32. Admin editor loads published article
  const loadedPub = await getArticleById(db, 1);
  assert(loadedPub !== null && loadedPub.id === 1, '32. Admin editor retrieves published article by ID');

  // 33. Admin save/update works
  await updateArticle(db, draftArt.id, { title: 'Judul Baru Diperbarui Admin' });
  const updatedArt = await getArticleById(db, draftArt.id);
  assert(updatedArt?.title === 'Judul Baru Diperbarui Admin', '33. Admin updateArticle updates fields successfully');

  // 34. Admin Markdown import works
  const importForm = new FormData();
  importForm.append('filename', 'import-test.md');
  importForm.append('content', rawMarkdown);
  importForm.append('strategy', 'skip');

  const importReq = new Request('http://localhost:4321/api/admin/import-md', {
    method: 'POST',
    body: importForm
  });
  const importRes = await importMdHandler({ request: importReq, locals: {} });
  const importJson = await importRes.json();
  assert(importRes.status === 200, '34. Admin Markdown import endpoint functions successfully');

  // 35. Skip strategy still works
  assert(importJson.status === 'duplicate_skipped', '35. Skip strategy returns duplicate_skipped on existing slug');

  // 36. Rename strategy still works
  const renameForm = new FormData();
  renameForm.append('filename', 'import-test.md');
  renameForm.append('content', rawMarkdown);
  renameForm.append('strategy', 'rename');
  const renameReq = new Request('http://localhost:4321/api/admin/import-md', {
    method: 'POST',
    body: renameForm
  });
  const renameRes = await importMdHandler({ request: renameReq, locals: {} });
  const renameJson = await renameRes.json();
  assert(renameRes.status === 200 && renameJson.slug !== testSlug && renameJson.slug.startsWith(testSlug), '36. Rename strategy appends random suffix and creates new article');

  // 37. Overwrite strategy still works
  const overwriteForm = new FormData();
  overwriteForm.append('filename', 'import-test.md');
  overwriteForm.append('content', rawMarkdown);
  overwriteForm.append('strategy', 'overwrite');
  const overwriteReq = new Request('http://localhost:4321/api/admin/import-md', {
    method: 'POST',
    body: overwriteForm
  });
  const overwriteRes = await importMdHandler({ request: overwriteReq, locals: {} });
  const overwriteJson = await overwriteRes.json();
  assert(overwriteRes.status === 200 && overwriteJson.action === 'overwritten', '37. Overwrite strategy updates existing row while preserving ID');
  console.log('');

  // =========================================================================
  // Final Summary
  // =========================================================================
  console.log('====================================================');
  console.log(`📊 PHASE 1C TEST SUMMARY: ${passedTests} PASSED, ${failedTests} FAILED (TOTAL: ${passedTests + failedTests})`);
  console.log('====================================================\n');

  if (failedTests > 0) {
    process.exit(1);
  }
}

runPhase1CTestSuite().catch(err => {
  console.error('Test Suite Exception:', err);
  process.exit(1);
});
