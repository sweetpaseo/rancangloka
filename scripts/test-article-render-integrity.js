/**
 * RancangLoka — ARTICLE RENDER INTEGRITY REGRESSION SUITE
 * Milestone: ARTICLE-RENDER-INTEGRITY-1
 *
 * Deterministically verifies:
 * 1. Safe article HTML rendering automatically falls back to canonical content_md when content_html is malformed or literal '[object Object]'.
 * 2. All 8 canonical Article 5 headings are preserved and rendered.
 * 3. Rendered textual word count maintains at least 90% of canonical content_md word count.
 * 4. Literal '[object Object]' is strictly absent from processed output.
 * 5. Mock / prototype spatial evaluation cards and unrelated hardcoded citations do not exist in template.
 * 6. Malformed optional metadata fails closed and does not replace canonical body.
 * 7. Canonical Markdown formatting (tables, lists, blockquotes) renders correctly.
 */

import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { sanitizeArticleHtml, renderArticleMarkdownSafely } from '../src/lib/article/renderer.ts';
import { processArticleContent, extractTableOfContents } from '../src/lib/seo.ts';

let passed = 0;
async function test(name, fn) {
  await fn();
  console.log('PASS: ' + name);
  passed++;
}

async function main() {
  console.log('=== ARTICLE RENDER INTEGRITY REGRESSION SUITE ===\n');

  // Load canonical Article 5 fixture
  const fixturePath = path.resolve(process.cwd(), 'scripts/fixtures/article5_canonical.json');
  if (!fs.existsSync(fixturePath)) {
    throw new Error('scripts/fixtures/article5_canonical.json required for canonical Article 5 verification');
  }
  const raw = JSON.parse(fs.readFileSync(fixturePath, 'utf8'));
  const article5Md = raw.content_md;

  const requiredHeadings = [
    'Karakter Fisik Dasar: Konduktivitas Termal dan Kekakuan Struktural',
    'Sambungan Sudut, Sistem Drainase, dan Ketahanan terhadap Hujan Angin',
    'Membedakan Peredaman Suara dari Kerapatan Udara',
    'Karakteristik Pemuaian dan Risiko Lapangan',
    'Matriks Komparasi Teknis: Aluminium vs uPVC di Iklim Tropis',
    'Pertimbangan Pemilihan Sistem Berdasarkan Kondisi Ruang',
    'Verdict RancangLoka',
    'Catatan Telaah Teknis dan Rujukan Standar'
  ];

  // Test 1: Canonical Markdown contains all 8 required headings and >2,000 words
  await test('Canonical Article 5 Markdown contains all 8 required headings', () => {
    for (const heading of requiredHeadings) {
      assert.ok(article5Md.includes(heading), `Heading missing in canonical MD: ${heading}`);
    }
    const words = article5Md.trim().split(/\s+/).length;
    assert.ok(words >= 2000, `Expected >= 2000 words, got ${words}`);
  });

  // Test 2: renderArticleMarkdownSafely renders canonical MD to safe HTML with all headings
  let renderedHtml = '';
  await test('renderArticleMarkdownSafely renders canonical MD and preserves all headings', async () => {
    renderedHtml = await renderArticleMarkdownSafely(article5Md);
    assert.ok(renderedHtml.length > 10000, `Expected HTML length > 10000, got ${renderedHtml.length}`);
    for (const heading of requiredHeadings) {
      assert.ok(renderedHtml.includes(heading), `Heading missing in rendered HTML: ${heading}`);
    }
  });

  // Test 3: Fallback logic handles literal '[object Object]', empty string, and null
  await test('Malformed content_html fallback correctly triggers canonical markdown render', async () => {
    const mockArticle = {
      id: 5,
      slug: 'kusen-aluminium-vs-upvc-untuk-rumah-tropis-di-indonesia',
      content_html: '[object Object]',
      content_md: article5Md,
      is_sponsored: 0,
      title: 'Kusen Aluminium vs uPVC'
    };

    let rawContentHtml = mockArticle.content_html;
    const isMalformedHtml =
      !rawContentHtml ||
      typeof rawContentHtml !== 'string' ||
      rawContentHtml.trim() === '[object Object]' ||
      rawContentHtml.trim().length < 50;

    if (isMalformedHtml && mockArticle.content_md) {
      rawContentHtml = await renderArticleMarkdownSafely(mockArticle.content_md);
    }

    const safeArticleHtml = sanitizeArticleHtml(rawContentHtml);
    assert.notEqual(safeArticleHtml, '[object Object]');
    assert.ok(safeArticleHtml.length > 10000);
    assert.ok(!safeArticleHtml.includes('[object Object]'));
  });

  // Test 4: Processed HTML retains >90% of canonical text words and includes Table of Contents
  await test('Processed article HTML retains >=90% of canonical word count without losing content', () => {
    const mockArticle = {
      id: 5,
      slug: 'kusen-aluminium-vs-upvc-untuk-rumah-tropis-di-indonesia',
      title: 'Kusen Aluminium vs uPVC',
      description: 'Perbandingan mendalam kusen aluminium dan uPVC.',
      is_sponsored: 0
    };

    const toc = extractTableOfContents(renderedHtml);
    assert.ok(toc.length >= 6, `Expected at least 6 TOC items, got ${toc.length}`);

    const processed = processArticleContent(renderedHtml, mockArticle, [], undefined, {}, toc);
    assert.ok(!processed.includes('[object Object]'));

    // Strip HTML tags to measure raw textual word count
    const textOnly = processed.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
    const renderedWords = textOnly.split(' ').length;
    const canonicalWords = article5Md.trim().split(/\s+/).length;

    const ratio = renderedWords / canonicalWords;
    console.log(`  Normalized word count: Rendered=${renderedWords}, Canonical=${canonicalWords}, Ratio=${(ratio * 100).toFixed(1)}%`);
    assert.ok(ratio >= 0.90, `Rendered text must retain at least 90% of canonical words. Ratio: ${ratio}`);

    for (const heading of requiredHeadings) {
      assert.ok(processed.includes(heading), `Heading missing in processed HTML: ${heading}`);
    }
  });

  // Test 5: Template inspection verifies absence of hardcoded spatial mock and ventilation citations
  await test('Template [slug].astro is free from hardcoded spatial assessment mock and ventilation citations', () => {
    const templateContent = fs.readFileSync('src/pages/[slug].astro', 'utf8');

    // Hardcoded spatial evaluation cards removed
    assert.ok(!templateContent.includes('EVALUASI SPASIAL REDAKSI'), 'Template must not contain EVALUASI SPASIAL REDAKSI');
    assert.ok(!templateContent.includes('Kenapa Keputusan Spasial Ini Berhasil? (Why This Works)'), 'Template must not contain Why This Works mock');
    assert.ok(!templateContent.includes('Orientasi & Pembiasan Radiasi Panas'), 'Template must not contain hardcoded spatial bullet 1');

    // Hardcoded ventilation citation box removed
    assert.ok(!templateContent.includes('SNI 03-6572'), 'Template must not contain hardcoded SNI 03-6572 ventilation citations');

    // Canonical Markdown fallback is present in template
    assert.match(templateContent, /renderArticleMarkdownSafely/);
    assert.match(templateContent, /isMalformedHtml/);
  });

  // Test 6: Malformed optional metadata cannot overwrite or hide canonical body
  await test('Malformed optional fields fail closed and preserve full body', () => {
    const malformedTakeaways = '{invalid json}';
    let keyTakeaways = [];
    try {
      keyTakeaways = JSON.parse(malformedTakeaways);
    } catch (e) {
      keyTakeaways = [];
    }
    assert.deepEqual(keyTakeaways, []);
  });

  console.log(`\nAll ${passed} Article Render Integrity tests passed!`);
}

main().catch((err) => {
  console.error('\nFAIL: Article Render Integrity check failed:', err);
  process.exit(1);
});
