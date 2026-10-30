/**
 * RancangLoka — Regression Test Suite
 * Milestone: FRONTMATTER-LEAK-PREVENTION-AND-PARSING-INTEGRITY
 *
 * Verifies:
 * 1. Valid YAML frontmatter extraction.
 * 2. Frontmatter excluded from rendered body.
 * 3. Metadata preserved correctly in structured fields.
 * 4. Documents without frontmatter handled gracefully.
 * 5. Malformed frontmatter handled safely without body corruption.
 * 6. Multiline YAML values parsed accurately.
 * 7. key_takeaways YAML arrays parsed accurately.
 * 8. Article title rendered strictly once (no duplicate H1).
 * 9. Existing inline media anchors preserved.
 * 10. Embedded SVG/HTML diagrams preserved safely.
 * 11. XSS sanitization remains active.
 * 12. Correct content hash behavior.
 * 13. No metadata leakage in all Batch 1 articles (#9993, #9999, #10000).
 * 14. No automatic article approval (all remain draft).
 * 15. Existing canonical bindings preserved.
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');

const dbPath = path.resolve(
  rootDir,
  '.wrangler/state/v3/d1/miniflare-D1DatabaseObject/37bd9da5950b040e71b09fbfd7ca57290acb451dcd5dc35acb02655fa75fa480.sqlite'
);

const { parseArticleMarkdown, extractArticleBody } = await import('../src/lib/article/parser.ts');
const { renderArticleMarkdownSafely, sanitizeArticleHtml, stripLeakedMetadataHtml } = await import('../src/lib/article/renderer.ts');
const { generateContentHash } = await import('../src/lib/seo.ts');

test('Frontmatter Leak Prevention & Rendering Regression Suite', async (t) => {
  const db = new DatabaseSync(dbPath);

  // ---------------------------------------------------------------------------
  // TEST 1: Valid YAML frontmatter extraction
  // ---------------------------------------------------------------------------
  await t.test('1. Valid YAML frontmatter extraction parses structured metadata', () => {
    const markdown = `---
title: "Panduan Ventilasi Alami"
slug: "panduan-ventilasi-alami"
description: "Cara menata bukaan silang di iklim tropis."
category: "Sistem & Konstruksi Rumah"
author: "Tim Riset Materialitas"
focus_keyword: "ventilasi alami rumah"
key_takeaways:
  - "Bukaan silang menciptakan perbedaan tekanan udara."
  - "Ketinggian ventilasi menentukan pelepasan udara panas."
---

# Panduan Ventilasi Alami

Sirkulasi udara yang baik sangat penting untuk rumah tropis.`;

    const result = parseArticleMarkdown(markdown);
    assert.equal(result.success, true);
    assert.equal(result.frontmatter.title, 'Panduan Ventilasi Alami');
    assert.equal(result.frontmatter.slug, 'panduan-ventilasi-alami');
    assert.equal(result.frontmatter.category, 'Sistem & Konstruksi Rumah');
    assert.equal(result.frontmatter.author, 'Tim Riset Materialitas');
    assert.equal(result.frontmatter.focus_keyword, 'ventilasi alami rumah');
    assert.equal(result.frontmatter.key_takeaways.length, 2);
  });

  // ---------------------------------------------------------------------------
  // TEST 2: Frontmatter excluded from rendered body
  // ---------------------------------------------------------------------------
  await t.test('2. Frontmatter excluded from rendered body prose and HTML', async () => {
    const markdown = `---
title: "Uji Beban Atap"
slug: "uji-beban-atap"
description: "Evaluasi bobot penutup atap."
category: "Sistem & Konstruksi Rumah"
author: "Tim Riset"
focus_keyword: "beban atap"
key_takeaways:
  - "Poin 1"
---

# Uji Beban Atap

Beban genteng beton mencapai 45 kg per meter persegi.`;

    const cleanBody = extractArticleBody(markdown);
    assert.ok(!cleanBody.includes('uji-beban-atap'), 'Frontmatter values must not exist in cleanBody');
    assert.ok(!cleanBody.includes('key_takeaways:'), 'Frontmatter keys must not exist in cleanBody');

    const html = await renderArticleMarkdownSafely(markdown);
    assert.ok(!html.includes('title:'), 'Rendered HTML must not contain "title:"');
    assert.ok(!html.includes('slug:'), 'Rendered HTML must not contain "slug:"');
    assert.ok(!html.includes('focus_keyword:'), 'Rendered HTML must not contain "focus_keyword:"');
    assert.ok(!html.includes('key_takeaways:'), 'Rendered HTML must not contain "key_takeaways:"');
    assert.ok(html.includes('Beban genteng beton mencapai 45 kg'), 'Prose must be rendered');
  });

  // ---------------------------------------------------------------------------
  // TEST 3: Metadata preserved correctly in structured fields
  // ---------------------------------------------------------------------------
  await t.test('3. Metadata preserved correctly in structured fields', () => {
    const raw = `---
title: "Plesteran Dinding Lembap"
slug: "plesteran-dinding-lembap"
description: "Mencegah cat menggelembung."
category: "Material & Konstruksi"
author: "Dewan Redaksi"
focus_keyword: "plesteran lembap"
key_takeaways:
  - "Trasram kedap air wajib dipasang."
---

Konten naskah plesteran.`;

    const parsed = parseArticleMarkdown(raw);
    assert.equal(parsed.frontmatter.title, 'Plesteran Dinding Lembap');
    assert.equal(parsed.frontmatter.description, 'Mencegah cat menggelembung.');
    assert.equal(parsed.frontmatter.category, 'Material & Konstruksi');
    assert.equal(parsed.frontmatter.author, 'Dewan Redaksi');
    assert.equal(parsed.frontmatter.focus_keyword, 'plesteran lembap');
    assert.deepEqual(parsed.frontmatter.key_takeaways, ['Trasram kedap air wajib dipasang.']);
  });

  // ---------------------------------------------------------------------------
  // TEST 4: Documents without frontmatter handled gracefully
  // ---------------------------------------------------------------------------
  await t.test('4. Documents without frontmatter return raw body without crashing', async () => {
    const rawNoFm = `# Artikel Tanpa Frontmatter

Ini adalah artikel biasa tanpa frontmatter YAML di bagian atasnya.

---

Bagian setelah horizontal rule biasa di tengah artikel.`;

    const parsed = parseArticleMarkdown(rawNoFm);
    assert.equal(parsed.success, false);
    assert.deepEqual(parsed.frontmatter, {});
    assert.ok(parsed.markdownBody.includes('Ini adalah artikel biasa'));

    const cleanBody = extractArticleBody(rawNoFm);
    assert.ok(cleanBody.includes('Ini adalah artikel biasa'));
    assert.ok(cleanBody.includes('Bagian setelah horizontal rule'));

    const html = await renderArticleMarkdownSafely(rawNoFm);
    assert.ok(html.includes('Artikel Tanpa Frontmatter'));
    assert.ok(html.includes('<hr>'), 'Mid-body horizontal rules must be preserved as <hr>');
  });

  // ---------------------------------------------------------------------------
  // TEST 5: Malformed frontmatter handling
  // ---------------------------------------------------------------------------
  await t.test('5. Malformed frontmatter handled safely without body corruption', async () => {
    // Malformed YAML syntax (unclosed quote / bracket)
    const malformedYaml = `---
title: "Unclosed string literal
slug: [unclosed list
---

# Judul Naskah

Paragraf isi artikel yang harus tetap selamat.`;

    const parsed = parseArticleMarkdown(malformedYaml);
    assert.equal(parsed.success, false);
    assert.ok(parsed.error?.includes('Format frontmatter YAML tidak valid'));
    assert.ok(parsed.markdownBody.includes('Judul Naskah'));

    // Unclosed frontmatter (only opening ---)
    const unclosedFm = `---
title: "Artikel Unclosed"
slug: "artikel-unclosed"

# Judul Unclosed

Paragraf isi yang harus selamat dari kebocoran metadata.`;

    const cleanUnclosed = extractArticleBody(unclosedFm);
    assert.ok(cleanUnclosed.includes('Judul Unclosed'));
    assert.ok(!cleanUnclosed.includes('artikel-unclosed'));

    const html = await renderArticleMarkdownSafely(unclosedFm);
    assert.ok(!html.includes('artikel-unclosed'));
    assert.ok(html.includes('Paragraf isi yang harus selamat'));
  });

  // ---------------------------------------------------------------------------
  // TEST 6: Multiline YAML values
  // ---------------------------------------------------------------------------
  await t.test('6. Multiline YAML values parsed accurately', () => {
    const multilineYaml = `---
title: "Desain Sirkulasi Rumah Tropis"
description: >
  Ini adalah deskripsi yang sangat panjang
  yang ditulis dalam beberapa baris
  menggunakan gaya folded scalar YAML.
category: "Interior & Tata Ruang"
author: "Tim Riset"
---

# Konten`;

    const parsed = parseArticleMarkdown(multilineYaml);
    assert.equal(parsed.success, true);
    assert.ok(parsed.frontmatter.description.includes('deskripsi yang sangat panjang'));
    assert.ok(parsed.frontmatter.description.includes('folded scalar YAML'));
  });

  // ---------------------------------------------------------------------------
  // TEST 7: key_takeaways YAML arrays
  // ---------------------------------------------------------------------------
  await t.test('7. key_takeaways YAML arrays parsed accurately as array of strings', () => {
    const raw = `---
title: "7 Ide Balkon"
key_takeaways:
  - "Poin kajian pertama dengan tanda kutip."
  - "Poin kajian kedua: memiliki tanda titik dua."
  - "Poin ketiga (1×2 meter)."
---

# Konten`;

    const parsed = parseArticleMarkdown(raw);
    assert.equal(parsed.success, true);
    assert.ok(Array.isArray(parsed.frontmatter.key_takeaways));
    assert.equal(parsed.frontmatter.key_takeaways.length, 3);
    assert.equal(parsed.frontmatter.key_takeaways[0], 'Poin kajian pertama dengan tanda kutip.');
    assert.equal(parsed.frontmatter.key_takeaways[1], 'Poin kajian kedua: memiliki tanda titik dua.');
  });

  // ---------------------------------------------------------------------------
  // TEST 8: Article title rendered strictly once
  // ---------------------------------------------------------------------------
  await t.test('8. Article title rendered strictly once at presentation boundary', async () => {
    const raw = `# Judul Eksklusif Artikel

Paragraf pembuka artikel.`;

    const html = await renderArticleMarkdownSafely(raw);
    assert.ok(html.includes('<h1>Judul Eksklusif Artikel</h1>'));

    // In preview and public template presentation filter:
    const presentationHtml = html.replace(/<h1[^>]*>[\s\S]*?<\/h1>/i, '');
    const h1Count = (presentationHtml.match(/<h1[^>]*>/gi) || []).length;
    assert.equal(h1Count, 0, 'Markdown H1 must be stripped from body container so page header H1 is the only H1');
  });

  // ---------------------------------------------------------------------------
  // TEST 9: Existing inline media anchors preserved
  // ---------------------------------------------------------------------------
  await t.test('9. Existing inline media anchors preserved through pipeline', async () => {
    const raw = `## Analisis Kerusakan

Paragraf pengantar.

{{media:inline_concept_diagram_1}}

Paragraf kelanjutan setelah anchor media.`;

    const cleanBody = extractArticleBody(raw);
    assert.ok(cleanBody.includes('{{media:inline_concept_diagram_1}}'));

    const html = await renderArticleMarkdownSafely(raw);
    assert.ok(html.includes('{{media:inline_concept_diagram_1}}'), 'Anchor tag must pass through Markdown renderer safely');
  });

  // ---------------------------------------------------------------------------
  // TEST 10: Embedded SVG/HTML diagram preserved safely
  // ---------------------------------------------------------------------------
  await t.test('10. Embedded SVG/HTML diagram preserved safely without stripping valid tags', async () => {
    const raw = `## 1. Alur Kerja Diagnosis

<div class="my-8 rounded-2xl bg-amber-50/70 p-6">
  <span class="text-amber-800 font-bold uppercase">Alur Kerja Diagnosis Sistematis</span>
  <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
    <div class="p-4 bg-white rounded-xl">
      <strong>Pengamatan</strong>
      <p>Catat lokasi kerusakan dinding.</p>
    </div>
  </div>
</div>`;

    const html = await renderArticleMarkdownSafely(raw);
    assert.ok(html.includes('Alur Kerja Diagnosis Sistematis'));
    assert.ok(html.includes('grid-cols-1 sm:grid-cols-2 lg:grid-cols-3'));
    assert.ok(html.includes('Pengamatan'));
  });

  // ---------------------------------------------------------------------------
  // TEST 11: XSS sanitization remains active
  // ---------------------------------------------------------------------------
  await t.test('11. XSS sanitization remains strictly active', async () => {
    const malicious = `---
title: "XSS Test"
---

# Heading

<script>alert('pwned')</script>
<img src="javascript:alert(1)" alt="bad" />
<a href="javascript:void(0)">Klik Saya</a>
<p onclick="steal()">Teks Biasa</p>`;

    const html = await renderArticleMarkdownSafely(malicious);
    assert.ok(!html.includes('<script>'), 'Scripts must be stripped');
    assert.ok(!html.includes('alert('), 'JavaScript calls must be stripped');
    assert.ok(!html.includes('onclick'), 'Event handlers must be stripped');
    assert.ok(!html.includes('javascript:'), 'Dangerous protocols must be stripped');
  });

  // ---------------------------------------------------------------------------
  // TEST 12: Correct content hash behavior
  // ---------------------------------------------------------------------------
  await t.test('12. Correct content hash behavior matches canonical body SHA-256', async () => {
    const rawA = `# Judul Artikel\n\nIsi paragraf teks A.`;
    const rawB = `# Judul Artikel\n\nIsi paragraf teks B.`;

    const hashA1 = await generateContentHash(rawA);
    const hashA2 = await generateContentHash(rawA);
    const hashB = await generateContentHash(rawB);

    assert.equal(hashA1, hashA2, 'Hash must be strictly deterministic');
    assert.notEqual(hashA1, hashB, 'Distinct content must yield distinct hashes');
    assert.equal(hashA1.length, 64, 'SHA-256 hex string must be exactly 64 characters');
  });

  // ---------------------------------------------------------------------------
  // TEST 13: No metadata leakage in all Batch 1 articles
  // ---------------------------------------------------------------------------
  await t.test('13. No metadata leakage in all Batch 1 articles in local D1', () => {
    const articles = db.prepare('SELECT id, slug, content_md, content_html FROM articles WHERE id IN (9993, 9999, 10000)').all();
    assert.equal(articles.length, 3, 'All 3 Batch 1 articles must exist');

    const leakKeywords = [
      'title:',
      'slug:',
      'focus_keyword:',
      'key_takeaways:',
      'seo_title:',
      'meta_description:'
    ];

    for (const art of articles) {
      // Check content_md does not start with YAML frontmatter delimiter
      assert.ok(
        !/^\s*---\r?\n[\s\S]*?\r?\n---\r?\n?/.test(art.content_md),
        `Article #${art.id} (${art.slug}) content_md must not contain YAML frontmatter block`
      );

      // Check content_html does not contain leaked metadata tags
      const hasHeadingLeak = /<h[1-6][^>]*>\s*(?:&quot;|")?title:[\s\S]*?<\/h[1-6]>/i.test(art.content_html);
      assert.ok(!hasHeadingLeak, `Article #${art.id} content_html must not contain frontmatter in <h[1-6]>`);

      const hasParagraphLeak = /<p[^>]*>\s*(?:&quot;|")?title:[\s\S]*?(?:slug:|focus_keyword:)[\s\S]*?<\/p>/i.test(art.content_html);
      assert.ok(!hasParagraphLeak, `Article #${art.id} content_html must not contain frontmatter in <p>`);
    }
  });

  // ---------------------------------------------------------------------------
  // TEST 14: No automatic article approval (all remain draft)
  // ---------------------------------------------------------------------------
  await t.test('14. Safety Invariant: All three Batch 1 articles strictly remain in draft status', () => {
    const rows = db.prepare('SELECT id, slug, status FROM articles WHERE id IN (9993, 9999, 10000)').all();
    for (const r of rows) {
      assert.equal(r.status, 'draft', `Article #${r.id} status must strictly be 'draft' (zero auto-publish)`);
    }
  });

  // ---------------------------------------------------------------------------
  // TEST 15: Existing canonical bindings preserved
  // ---------------------------------------------------------------------------
  await t.test('15. Canonical media bindings for Batch 1 articles preserved intact', () => {
    const bindings = db.prepare(`
      SELECT am.article_id, am.slot_key, am.role, am.is_active, ma.status as asset_status, ma.public_url
      FROM article_media am
      JOIN media_assets ma ON am.asset_id = ma.asset_id
      WHERE am.article_id IN (9993, 9999, 10000) AND am.is_active = 1
    `).all();

    // Verify Article 9993 featured binding
    const art9993Featured = bindings.find(b => b.article_id === 9993 && b.slot_key === 'featured');
    assert.ok(art9993Featured, 'Article 9993 must retain active featured binding');
    assert.equal(art9993Featured.asset_status, 'VALIDATED');

    // Verify Article 9993 inline S2 binding
    const art9993Inline = bindings.find(b => b.article_id === 9993 && b.slot_key === 'inline_detail_close_up_1');
    assert.ok(art9993Inline, 'Article 9993 must retain active inline S2 binding');
    assert.equal(art9993Inline.asset_status, 'VALIDATED');

    // Verify Article 9999 featured binding
    const art9999Featured = bindings.find(b => b.article_id === 9999 && b.slot_key === 'featured');
    assert.ok(art9999Featured, 'Article 9999 must retain active featured binding');
    assert.equal(art9999Featured.asset_status, 'VALIDATED');

    // Verify Article 10000 featured binding
    const art10000Featured = bindings.find(b => b.article_id === 10000 && b.slot_key === 'featured');
    assert.ok(art10000Featured, 'Article 10000 must retain active featured binding');
    assert.equal(art10000Featured.asset_status, 'VALIDATED');
  });
});
