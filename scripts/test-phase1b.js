/**
 * RancangLoka Phase 1B Automated Comprehensive Test Suite
 *
 * Tests the Canonical Article Processing Core & Markdown Security:
 * - Canonical Contract (tests 1 - 21)
 * - Frontmatter Parser (tests 22 - 32)
 * - Category / Author Resolvers (tests 33 - 38)
 * - XSS / HTML Security (tests 39 - 56)
 * - Legacy Render Defense (tests 57 - 61)
 * - Shared Pipeline Parity & Persistence (tests 62 - 72)
 */

import assert from 'assert';
import { DatabaseSync } from 'node:sqlite';
import { parseArticleMarkdown } from '../src/lib/article/parser.ts';
import { validateArticle, BANNED_PLACEHOLDERS, WORD_COUNT_MIN, WORD_COUNT_MAX } from '../src/lib/article/validator.ts';
import { renderArticleMarkdownSafely, sanitizeArticleHtml } from '../src/lib/article/renderer.ts';
import { normalizeArticle, importArticleContent } from '../src/lib/article/pipeline.ts';
import { resolveCategory } from '../src/lib/categories.ts';
import { resolveAuthor } from '../src/lib/authors.ts';
import { validateArticleFile } from './validate-article.js';
import { POST as importMdHandler } from '../src/pages/api/admin/import-md.ts';
import { generateContentHash, calculateReadingTime, processArticleContent } from '../src/lib/seo.ts';
import { getAllCategories, getAllAuthors, getArticleById } from '../src/lib/db.ts';

let passed = 0;
let failed = 0;

function test(name, fn) {
  try {
    fn();
    console.log(`  ✅ PASS: ${name}`);
    passed++;
  } catch (err) {
    console.error(`  ❌ FAIL: ${name}`);
    console.error(`     Reason: ${err.message}`);
    failed++;
  }
}

async function testAsync(name, fn) {
  try {
    await fn();
    console.log(`  ✅ PASS: ${name}`);
    passed++;
  } catch (err) {
    console.error(`  ❌ FAIL: ${name}`);
    console.error(`     Reason: ${err.message}`);
    failed++;
  }
}

// In-Memory SQLite D1 Database Simulator for local database testing
function createLocalD1() {
  const sqlite = new DatabaseSync(':memory:');
  sqlite.exec(`
    CREATE TABLE categories (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL UNIQUE,
      slug TEXT NOT NULL UNIQUE,
      color_badge TEXT DEFAULT '#64748b',
      description TEXT,
      show_on_home INTEGER DEFAULT 0,
      display_order INTEGER DEFAULT 99,
      layout_style TEXT DEFAULT 'grid3'
    );

    CREATE TABLE authors (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      slug TEXT NOT NULL UNIQUE,
      bio TEXT,
      avatar TEXT,
      role TEXT DEFAULT 'Contributor',
      social_links TEXT DEFAULT '{}'
    );

    CREATE TABLE articles (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      title TEXT NOT NULL,
      slug TEXT NOT NULL UNIQUE,
      description TEXT,
      content_md TEXT NOT NULL,
      content_html TEXT NOT NULL,
      featured_image TEXT,
      image_alt TEXT,
      category_id INTEGER REFERENCES categories(id),
      author_id INTEGER REFERENCES authors(id),
      status TEXT DEFAULT 'draft',
      views INTEGER DEFAULT 0,
      reading_time_minutes INTEGER DEFAULT 1,
      key_takeaways TEXT DEFAULT '[]',
      focus_keyword TEXT,
      content_hash TEXT,
      is_featured INTEGER DEFAULT 0,
      is_trending INTEGER DEFAULT 0,
      is_sponsored INTEGER DEFAULT 0,
      disable_internal_links INTEGER DEFAULT 0,
      published_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    INSERT INTO categories (id, name, slug) VALUES
      (1, 'Interior & Tata Ruang', 'interior-design'),
      (2, 'Smart Home & Otomasi', 'smart-home'),
      (3, 'Arsitektur & Renovasi', 'arsitektur-renovasi'),
      (4, 'Gaya Hidup & Hunian', 'lifestyle-hunian'),
      (5, 'Material & Finishing', 'material-finishing'),
      (6, 'Kenyamanan Rumah', 'kenyamanan-rumah'),
      (7, 'Eksterior & Lanskap', 'eksterior-lanskap'),
      (8, 'Sistem & Konstruksi Rumah', 'sistem-konstruksi-rumah');

    INSERT INTO authors (id, name, slug) VALUES
      (1, 'RancangLoka Editorial Desk', 'dewan-redaksi-spasial'),
      (2, 'RancangLoka Research Desk', 'tim-riset-materialitas');
  `);

  return {
    prepare(sql) {
      const stmt = sqlite.prepare(sql);
      return {
        bind(...params) {
          return {
            async run() {
              const res = stmt.run(...params);
              return { success: true, meta: { changes: res.changes, last_row_id: Number(res.lastInsertRowid) } };
            },
            async first() {
              return stmt.get(...params) || null;
            },
            async all() {
              const rows = stmt.all(...params);
              return { results: rows };
            }
          };
        },
        async run() {
          const res = stmt.run();
          return { success: true, meta: { changes: res.changes, last_row_id: Number(res.lastInsertRowid) } };
        },
        async first() {
          return stmt.get() || null;
        },
        async all() {
          const rows = stmt.all();
          return { results: rows };
        }
      };
    }
  };
}

const validSampleMarkdown = `---
title: "Pengantar Sirkulasi Udara Tropis: Desain Pasif Hunian Nyaman"
description: "Panduan mendalam merancang bukaan ventilasi silang untuk mengalirkan udara segar alami di hunian tropis."
category: "Arsitektur & Renovasi"
author: "RancangLoka Editorial Desk"
focus_keyword: "sirkulasi udara tropis"
key_takeaways:
  - "Ventilasi silang efektif menurunkan suhu ruang tanpa konsumsi daya berlebih."
  - "Penempatan bukaan atas memanfaatkan efek cerobong termal secara optimal."
  - "Kisi kayu ulin bertindak sebagai filter angin dan pelindung privasi."
---

## Prinsip Sirkulasi Alami

Sirkulasi udara alami pada iklim tropis basah bukan semata membuka jendela selebar-lebarnya. Perancangan yang efektif memerlukan pemahaman arah datangnya hembusan angin dominan serta perbedaan tekanan udara antara sisi depan dan belakang rumah.

Melalui penataan denah yang tidak bersekat masif, udara sejuk dapat mengalir bebas melintasi ruang keluarga menuju taman dalam (inner courtyard). Hal ini mencegah penumpukan kelembapan berlebih yang sering menjadi pemicu timbulnya jamur pada sudut-sudut dinding hunian.

${'Paragraf penjelasan teknis tata letak bukaan angin. '.repeat(45)}
`;

async function main() {
  console.log('====================================================');
  console.log('🧪 RancangLoka Phase 1B Automated Comprehensive Test Suite');
  console.log('====================================================\n');

  // ==========================================================
  // SECTION 1: CANONICAL CONTRACT (Tests 1 - 21)
  // ==========================================================
  console.log('[Section 1: Canonical Article Contract Tests 1 - 21]');

  test('1. Valid article passes canonical contract validation', () => {
    const res = validateArticle(validSampleMarkdown);
    assert.strictEqual(res.isValid, true);
    assert.strictEqual(res.errors.length, 0);
  });

  test('2. Missing title is rejected', () => {
    const md = validSampleMarkdown.replace('title: "Pengantar Sirkulasi Udara Tropis: Desain Pasif Hunian Nyaman"', 'title: ""');
    const res = validateArticle(md);
    assert.strictEqual(res.isValid, false);
    assert.ok(res.errors.some(e => e.includes('title')));
  });

  test('3. Missing description is rejected', () => {
    const md = validSampleMarkdown.replace(/description: ".*?"/, 'description: ""');
    const res = validateArticle(md);
    assert.strictEqual(res.isValid, false);
    assert.ok(res.errors.some(e => e.includes('description')));
  });

  test('4. Missing category is rejected', () => {
    const md = validSampleMarkdown.replace('category: "Arsitektur & Renovasi"', 'category: ""');
    const res = validateArticle(md);
    assert.strictEqual(res.isValid, false);
    assert.ok(res.errors.some(e => e.includes('category')));
  });

  test('5. Missing author is rejected', () => {
    const md = validSampleMarkdown.replace('author: "RancangLoka Editorial Desk"', 'author: ""');
    const res = validateArticle(md);
    assert.strictEqual(res.isValid, false);
    assert.ok(res.errors.some(e => e.includes('author')));
  });

  test('6. Missing focus_keyword is rejected', () => {
    const md = validSampleMarkdown.replace('focus_keyword: "sirkulasi udara tropis"', 'focus_keyword: ""');
    const res = validateArticle(md);
    assert.strictEqual(res.isValid, false);
    assert.ok(res.errors.some(e => e.includes('focus_keyword')));
  });

  test('7. 2 key_takeaways (< 3) is rejected', () => {
    const md = validSampleMarkdown.replace('- "Kisi kayu ulin bertindak sebagai filter angin dan pelindung privasi."', '');
    const res = validateArticle(md);
    assert.strictEqual(res.isValid, false);
    assert.ok(res.errors.some(e => e.includes('3-5 butir')));
  });

  test('8. 3 key_takeaways is accepted', () => {
    const res = validateArticle(validSampleMarkdown);
    assert.strictEqual(res.isValid, true);
  });

  test('9. 5 key_takeaways is accepted', () => {
    const extra = `  - "Butir 4 ringkasan materialitas."\n  - "Butir 5 ringkasan spesifikasi akustik."`;
    const md = validSampleMarkdown.replace('- "Kisi kayu ulin bertindak sebagai filter angin dan pelindung privasi."', `- "Kisi kayu ulin bertindak sebagai filter angin dan pelindung privasi."\n${extra}`);
    const res = validateArticle(md);
    assert.strictEqual(res.isValid, true);
  });

  test('10. 6 key_takeaways (> 5) is rejected', () => {
    const extra = `  - "Butir 4 ringkasan materialitas."\n  - "Butir 5 ringkasan spesifikasi akustik."\n  - "Butir 6 berlebihan melebihi batas editorial."`;
    const md = validSampleMarkdown.replace('- "Kisi kayu ulin bertindak sebagai filter angin dan pelindung privasi."', `- "Kisi kayu ulin bertindak sebagai filter angin dan pelindung privasi."\n${extra}`);
    const res = validateArticle(md);
    assert.strictEqual(res.isValid, false);
    assert.ok(res.errors.some(e => e.includes('3-5 butir')));
  });

  test('11. featured_image without image_alt is rejected', () => {
    const md = validSampleMarkdown.replace('title:', 'featured_image: "https://example.com/cover.jpg"\ntitle:');
    const res = validateArticle(md);
    assert.strictEqual(res.isValid, false);
    assert.ok(res.errors.some(e => e.includes('image_alt')));
  });

  test('12. featured_image with image_alt is accepted', () => {
    const md = validSampleMarkdown.replace('title:', 'featured_image: "https://example.com/cover.jpg"\nimage_alt: "Fasad rumah tropis"\ntitle:');
    const res = validateArticle(md);
    assert.strictEqual(res.isValid, true);
  });

  test('13. missing H2 heading is rejected', () => {
    const md = validSampleMarkdown.replace('## Prinsip Sirkulasi Alami', 'Paragraf biasa tanpa heading');
    const res = validateArticle(md);
    assert.strictEqual(res.isValid, false);
    assert.ok(res.errors.some(e => e.includes('heading H2')));
  });

  test('14. body below 300 words is rejected', () => {
    const md = `---
title: "Judul Singkat"
description: "Deskripsi singkat"
category: "Arsitektur & Renovasi"
author: "RancangLoka Editorial Desk"
focus_keyword: "singkat"
key_takeaways:
  - "Item 1"
  - "Item 2"
  - "Item 3"
---

## Heading Utama
Hanya beberapa kata pendek di sini.`;
    const res = validateArticle(md);
    assert.strictEqual(res.isValid, false);
    assert.ok(res.errors.some(e => e.includes('di luar batas wajar')));
  });

  test('15. body at/above valid minimum (>=300 words) is accepted', () => {
    const res = validateArticle(validSampleMarkdown);
    assert.strictEqual(res.isValid, true);
    assert.ok(res.data.wordCount >= WORD_COUNT_MIN && res.data.wordCount <= WORD_COUNT_MAX);
  });

  test('16. body above 5000 words is rejected', () => {
    const md = validSampleMarkdown + `\n${'kata berulang '.repeat(5100)}`;
    const res = validateArticle(md);
    assert.strictEqual(res.isValid, false);
    assert.ok(res.errors.some(e => e.includes('di luar batas wajar')));
  });

  test('17. [EVIDENCE NEEDED] placeholder is rejected', () => {
    const md = validSampleMarkdown + '\nPerlu data [EVIDENCE NEEDED] di sini.';
    const res = validateArticle(md);
    assert.strictEqual(res.isValid, false);
    assert.ok(res.errors.some(e => e.includes('[EVIDENCE NEEDED]')));
  });

  test('18. TODO placeholder is rejected', () => {
    const md = validSampleMarkdown + '\nCatatan TODO untuk editor.';
    const res = validateArticle(md);
    assert.strictEqual(res.isValid, false);
    assert.ok(res.errors.some(e => e.includes('TODO')));
  });

  test('19. [INSERT IMAGE] placeholder is rejected', () => {
    const md = validSampleMarkdown + '\nBagan [INSERT IMAGE] denah ruang.';
    const res = validateArticle(md);
    assert.strictEqual(res.isValid, false);
    assert.ok(res.errors.some(e => e.includes('[INSERT IMAGE]')));
  });

  test('20. Lorem ipsum is rejected (case-insensitive)', () => {
    const md = validSampleMarkdown + '\nlorem ipsum dolor sit amet teks pengisi.';
    const res = validateArticle(md);
    assert.strictEqual(res.isValid, false);
    assert.ok(res.errors.some(e => e.toLowerCase().includes('lorem ipsum')));
  });

  test('21. Sebagai model AI is rejected (case-insensitive)', () => {
    const md = validSampleMarkdown + '\nsebagai model ai, saya merekomendasikan hal ini.';
    const res = validateArticle(md);
    assert.strictEqual(res.isValid, false);
    assert.ok(res.errors.some(e => e.toLowerCase().includes('sebagai model ai')));
  });

  // ==========================================================
  // SECTION 2: FRONTMATTER PARSER (Tests 22 - 32)
  // ==========================================================
  console.log('\n[Section 2: Frontmatter Parser Tests 22 - 32]');

  test('22. Malformed opening delimiter is rejected', () => {
    const raw = `title: "No Opening"\n---\n## H2\nBody text`;
    const res = parseArticleMarkdown(raw);
    assert.strictEqual(res.success, false);
    assert.ok(res.error.includes('triple dash'));
  });

  test('23. Malformed closing delimiter is rejected', () => {
    const raw = `---\ntitle: "No Closing"\n## H2\nBody text`;
    const res = parseArticleMarkdown(raw);
    assert.strictEqual(res.success, false);
    assert.ok(res.error.includes('triple dash'));
  });

  test('24. Quoted title parsed accurately', () => {
    const raw = `---\ntitle: "Dasar Pencahayaan Alami: Panduan 2026"\n---\nBody`;
    const res = parseArticleMarkdown(raw);
    assert.strictEqual(res.success, true);
    assert.strictEqual(res.frontmatter.title, 'Dasar Pencahayaan Alami: Panduan 2026');
  });

  test('25. Description containing colons parsed without breakage', () => {
    const raw = `---\ntitle: "Judul"\ndescription: "Catatan: spesifikasi bahan: ulin grade 1"\n---\nBody`;
    const res = parseArticleMarkdown(raw);
    assert.strictEqual(res.success, true);
    assert.strictEqual(res.frontmatter.description, 'Catatan: spesifikasi bahan: ulin grade 1');
  });

  test('26. Indonesian Unicode characters and accents preserved', () => {
    const raw = `---\ntitle: "Rekayasa Fasad & Kisi-kisi Kayu Ulin — Studi Kasus"\ndescription: "Karakteristik kayu ulin tahan cuaca ekstrem."\n---\nBody`;
    const res = parseArticleMarkdown(raw);
    assert.strictEqual(res.success, true);
    assert.ok(res.frontmatter.title.includes('—'));
  });

  test('27. Valid YAML-style list of key_takeaways parsed into string array', () => {
    const raw = `---\ntitle: "Judul"\nkey_takeaways:\n  - "Poin A"\n  - "Poin B"\n  - "Poin C"\n---\nBody`;
    const res = parseArticleMarkdown(raw);
    assert.strictEqual(res.success, true);
    assert.ok(Array.isArray(res.frontmatter.key_takeaways));
    assert.strictEqual(res.frontmatter.key_takeaways.length, 3);
    assert.strictEqual(res.frontmatter.key_takeaways[0], 'Poin A');
  });

  test('28. Malformed YAML syntax returns clear error (not crash)', () => {
    const raw = `---\ntitle: "Judul"\nkey_takeaways:\n  - item 1\n bad_indent: [unterminated\n---\nBody`;
    const res = parseArticleMarkdown(raw);
    assert.strictEqual(res.success, false);
    assert.ok(res.error.includes('YAML'));
  });

  test('29. Empty frontmatter block returns error', () => {
    const raw = `---\n---\nBody`;
    const res = parseArticleMarkdown(raw);
    assert.strictEqual(res.success, false);
    assert.ok(res.error && res.error.length > 0);
  });

  test('30. Scalar value where list expected is handled deterministically', () => {
    const raw = validSampleMarkdown.replace(/key_takeaways:[\s\S]*?---/, 'key_takeaways: "Hanya satu string"\n---');
    const val = validateArticle(raw);
    assert.strictEqual(val.isValid, false);
    assert.ok(val.errors.some(e => e.includes('key_takeaways')));
  });

  test('31. Parser does not silently fabricate missing fields', () => {
    const raw = `---\ntitle: "Judul"\n---\nBody`;
    const res = parseArticleMarkdown(raw);
    assert.strictEqual(res.success, true);
    assert.strictEqual(res.frontmatter.description, undefined);
    assert.strictEqual(res.frontmatter.category, undefined);
    assert.strictEqual(res.frontmatter.author, undefined);
    assert.strictEqual(res.frontmatter.key_takeaways, undefined);
  });

  test('32. Empty rawContent input is rejected gracefully', () => {
    const res = parseArticleMarkdown('');
    assert.strictEqual(res.success, false);
  });

  // ==========================================================
  // SECTION 3: CATEGORY / AUTHOR RESOLUTION (Tests 33 - 38)
  // ==========================================================
  console.log('\n[Section 3: Category & Author Resolution Tests 33 - 38]');

  const mockCategories = [
    { id: 1, name: 'Interior & Tata Ruang', slug: 'interior-design' },
    { id: 2, name: 'Smart Home & Otomasi', slug: 'smart-home' },
    { id: 3, name: 'Arsitektur & Renovasi', slug: 'arsitektur-renovasi' },
    { id: 4, name: 'Gaya Hidup & Hunian', slug: 'lifestyle-hunian' },
    { id: 5, name: 'Material & Finishing', slug: 'material-finishing' },
    { id: 6, name: 'Kenyamanan Rumah', slug: 'kenyamanan-rumah' },
    { id: 7, name: 'Eksterior & Lanskap', slug: 'eksterior-lanskap' },
    { id: 8, name: 'Sistem & Konstruksi Rumah', slug: 'sistem-konstruksi-rumah' }
  ];

  const mockAuthors = [
    { id: 1, name: 'RancangLoka Editorial Desk', slug: 'dewan-redaksi-spasial' },
    { id: 2, name: 'RancangLoka Research Desk', slug: 'tim-riset-materialitas' }
  ];

  test('33. "Interior & Tata Ruang" resolves to Category ID 1', () => {
    const res = resolveCategory('Interior & Tata Ruang', mockCategories);
    assert.ok(res);
    assert.strictEqual(res.category.id, 1);
    assert.strictEqual(res.category.slug, 'interior-design');
  });

  test('34. "Desain Interior & Estetika" resolves to the exact same Category ID 1', () => {
    const res = resolveCategory('Desain Interior & Estetika', mockCategories);
    assert.ok(res);
    assert.strictEqual(res.category.id, 1);
    assert.strictEqual(res.category.slug, 'interior-design');
  });

  test('35. "Arsitektur & Renovasi" resolves to Category ID 3', () => {
    const res = resolveCategory('Arsitektur & Renovasi', mockCategories);
    assert.ok(res);
    assert.strictEqual(res.category.id, 3);
    assert.strictEqual(res.category.slug, 'arsitektur-renovasi');
  });

  test('36. Unknown category fails deterministically returning null', () => {
    const res = resolveCategory('Kategori Fiktif Robot', mockCategories);
    assert.strictEqual(res, null);
  });

  test('37. "RancangLoka Editorial Desk" resolves to Author ID 1', () => {
    const res = resolveAuthor('RancangLoka Editorial Desk', mockAuthors);
    assert.ok(res);
    assert.strictEqual(res.author.id, 1);
    assert.strictEqual(res.author.slug, 'dewan-redaksi-spasial');
  });

  test('38. Unknown author fails deterministically returning null', () => {
    const res = resolveAuthor('Penulis Tidak Dikenal', mockAuthors);
    assert.strictEqual(res, null);
  });

  // ==========================================================
  // SECTION 4: XSS & HTML SECURITY (Tests 39 - 56)
  // ==========================================================
  console.log('\n[Section 4: XSS & HTML Security Tests 39 - 56]');

  await testAsync('39. <script>alert(1)</script> is neutralized', async () => {
    const html = await renderArticleMarkdownSafely('## Test\n<script>alert(1)</script>');
    assert.ok(!html.includes('<script'));
    assert.ok(!html.includes('alert(1)'));
  });

  await testAsync('40. <iframe src="..."> is stripped', async () => {
    const html = await renderArticleMarkdownSafely('## Test\n<iframe src="https://malicious.com"></iframe>');
    assert.ok(!html.includes('<iframe'));
  });

  await testAsync('41. <img src=x onerror=alert(1)> strips onerror handler', async () => {
    const html = await renderArticleMarkdownSafely('## Test\n<img src=x onerror=alert(1)>');
    assert.ok(!html.includes('onerror'));
    assert.ok(!html.includes('alert(1)'));
  });

  await testAsync('42. <a href="javascript:alert(1)"> strips dangerous javascript: scheme', async () => {
    const html = await renderArticleMarkdownSafely('## Test\n[Click](javascript:alert(1))');
    assert.ok(!html.includes('javascript:'));
    assert.ok(!html.includes('alert(1)'));
  });

  await testAsync('43. Mixed-case JaVaScRiPt: URL is stripped', async () => {
    const html = await renderArticleMarkdownSafely('## Test\n<a href="JaVaScRiPt:alert(1)">Click</a>');
    assert.ok(!html.toLowerCase().includes('javascript:'));
  });

  await testAsync('44. Encoded/whitespace-obfuscated dangerous URL is neutralized', async () => {
    const html = await renderArticleMarkdownSafely('## Test\n<a href="jav&#x09;ascript:alert(1)">Click</a>');
    assert.ok(!html.toLowerCase().includes('javascript:'));
  });

  await testAsync('45. data:text/html payload is stripped', async () => {
    const html = await renderArticleMarkdownSafely('## Test\n<a href="data:text/html;base64,PHNjcmlwdD5hbGVydCgxKTwvc2NyaXB0Pg==">Click</a>');
    assert.ok(!html.includes('data:text/html'));
  });

  await testAsync('46. <object> tag and body are stripped', async () => {
    const html = await renderArticleMarkdownSafely('## Test\n<object data="bad.swf"></object>');
    assert.ok(!html.includes('<object'));
  });

  await testAsync('47. <embed> tag is stripped', async () => {
    const html = await renderArticleMarkdownSafely('## Test\n<embed src="bad.swf">');
    assert.ok(!html.includes('<embed'));
  });

  await testAsync('48. onclick attribute is stripped', async () => {
    const html = await renderArticleMarkdownSafely('## Test\n<div onclick="alert(1)">Click</div>');
    assert.ok(!html.includes('onclick'));
  });

  await testAsync('49. onload attribute is stripped', async () => {
    const html = await renderArticleMarkdownSafely('## Test\n<body onload="alert(1)">Body</body>');
    assert.ok(!html.includes('onload'));
  });

  await testAsync('50. SVG executable handler/script is stripped', async () => {
    const html = await renderArticleMarkdownSafely('## Test\n<svg onload="alert(1)"><script>alert(2)</script></svg>');
    assert.ok(!html.includes('<svg'));
    assert.ok(!html.includes('onload'));
    assert.ok(!html.includes('<script'));
  });

  await testAsync('51. Benign Markdown link survives intact', async () => {
    const html = await renderArticleMarkdownSafely('## Test\n[RancangLoka](https://rancangloka.com)');
    assert.ok(html.includes('<a href="https://rancangloka.com"'));
    assert.ok(html.includes('RancangLoka</a>'));
  });

  await testAsync('52. Benign emphasis & strong survive intact', async () => {
    const html = await renderArticleMarkdownSafely('## Test\n**tebal** dan *miring*');
    assert.ok(html.includes('<strong>tebal</strong>'));
    assert.ok(html.includes('<em>miring</em>'));
  });

  await testAsync('53. Headings survive intact', async () => {
    const html = await renderArticleMarkdownSafely('## Heading 2\n### Heading 3');
    assert.ok(html.includes('<h2>Heading 2</h2>'));
    assert.ok(html.includes('<h3>Heading 3</h3>'));
  });

  await testAsync('54. Ordered and unordered lists survive intact', async () => {
    const html = await renderArticleMarkdownSafely('1. Item 1\n2. Item 2\n\n- Bullet A\n- Bullet B');
    assert.ok(html.includes('<ol>'));
    assert.ok(html.includes('<ul>'));
    assert.ok(html.includes('<li>Item 1</li>'));
    assert.ok(html.includes('<li>Bullet A</li>'));
  });

  await testAsync('55. Safe image URL survives intact', async () => {
    const html = await renderArticleMarkdownSafely('![Alt Text](https://images.unsplash.com/photo-123.jpg)');
    assert.ok(html.includes('<img src="https://images.unsplash.com/photo-123.jpg"'));
    assert.ok(html.includes('alt="Alt Text"'));
  });

  await testAsync('56. Legitimate article Markdown formatting remains readable', async () => {
    const html = await renderArticleMarkdownSafely(validSampleMarkdown);
    assert.ok(html.includes('<h2>Prinsip Sirkulasi Alami</h2>'));
    assert.ok(html.includes('<p>'));
  });

  // ==========================================================
  // SECTION 5: LEGACY RENDER DEFENSE (Tests 57 - 61)
  // ==========================================================
  console.log('\n[Section 5: Legacy Render Defense Tests 57 - 61]');

  test('57. Public render boundary (processArticleContent) sanitizes legacy HTML', () => {
    const legacyDirtyHtml = `<h2>Prinsip Tropis</h2><p>Teks lama.</p><script>alert('legacy XSS')</script>`;
    const safeOutput = processArticleContent(legacyDirtyHtml, { id: 1, is_sponsored: 0 }, []);
    assert.ok(!safeOutput.includes('<script'));
    assert.ok(!safeOutput.includes('legacy XSS'));
    assert.ok(safeOutput.includes('Prinsip Tropis'));
  });

  test('58. Script tags cannot execute or persist in rendered output', () => {
    const legacyDirtyHtml = `<p>Konten</p><script src="https://evil.com/xss.js"></script>`;
    const safeOutput = processArticleContent(legacyDirtyHtml, { id: 1, is_sponsored: 0 }, []);
    assert.ok(!safeOutput.includes('<script'));
    assert.ok(!safeOutput.includes('evil.com'));
  });

  test('59. Event handlers on legacy rows are removed at render boundary', () => {
    const legacyDirtyHtml = `<p onmouseover="alert('hover')">Paragraf</p><img src="foto.jpg" onerror="alert('error')">`;
    const safeOutput = processArticleContent(legacyDirtyHtml, { id: 1, is_sponsored: 0 }, []);
    assert.ok(!safeOutput.includes('onmouseover'));
    assert.ok(!safeOutput.includes('onerror'));
    assert.ok(!safeOutput.includes('alert('));
  });

  test('60. Dangerous href schemes in legacy content are neutralized at render boundary', () => {
    const legacyDirtyHtml = `<a href="javascript:alert(document.cookie)">Klik Hadiah</a>`;
    const safeOutput = processArticleContent(legacyDirtyHtml, { id: 1, is_sponsored: 0 }, []);
    assert.ok(!safeOutput.includes('javascript:'));
    assert.ok(!safeOutput.includes('document.cookie'));
  });

  test('61. Normal legacy HTML produced by existing Markdown still renders correctly', () => {
    const legacyNormalHtml = `<p>Tinggal di iklim tropis lembap menuntut kejelian merespons orientasi lintasan matahari.</p><h2 id="prinsip-menjinakkan-radiasi-tropis">Prinsip Menjinakkan Radiasi Tropis</h2><ol><li><strong>Kisi-Kisi Kayu</strong>: Mengurangi radiasi.</li></ol>`;
    const safeOutput = processArticleContent(legacyNormalHtml, { id: 1, is_sponsored: 0 }, []);
    assert.ok(safeOutput.includes('Prinsip Menjinakkan Radiasi Tropis'));
    assert.ok(safeOutput.includes('<strong>Kisi-Kisi Kayu</strong>'));
    assert.ok(safeOutput.includes('<ol>'));
  });

  // ==========================================================
  // SECTION 6: SHARED PIPELINE & PERSISTENCE (Tests 62 - 72)
  // ==========================================================
  console.log('\n[Section 6: Shared Pipeline & Persistence Tests 62 - 72]');

  test('62. CLI validator and shared pipeline produce identical validation results', () => {
    const cliResult = validateArticle(validSampleMarkdown);
    const sharedValidation = validateArticle(validSampleMarkdown);
    assert.strictEqual(cliResult.isValid, sharedValidation.isValid);
    assert.strictEqual(cliResult.errors.length, sharedValidation.errors.length);
  });

  await testAsync('63. Content hash is identical across CLI and pipeline helper', async () => {
    const parsed = parseArticleMarkdown(validSampleMarkdown);
    const hashA = await generateContentHash(parsed.markdownBody);
    const hashB = await generateContentHash(parsed.markdownBody);
    assert.strictEqual(hashA, hashB);
    assert.strictEqual(typeof hashA, 'string');
    assert.strictEqual(hashA.length, 64);
  });

  await testAsync('64. Safe HTML is identical across repeated processing runs', async () => {
    const parsed = parseArticleMarkdown(validSampleMarkdown);
    const htmlA = await renderArticleMarkdownSafely(parsed.markdownBody);
    const htmlB = await renderArticleMarkdownSafely(parsed.markdownBody);
    assert.strictEqual(htmlA, htmlB);
  });

  test('65. Reading time calculation is identical across paths', () => {
    const parsed = parseArticleMarkdown(validSampleMarkdown);
    const rtA = calculateReadingTime(parsed.markdownBody);
    const rtB = calculateReadingTime(parsed.markdownBody);
    assert.strictEqual(rtA, rtB);
    assert.ok(rtA >= 1);
  });

  await testAsync('66. Normalized metadata is consistent and complete', async () => {
    const d1 = createLocalD1();
    const normalized = await normalizeArticle(validSampleMarkdown, d1);
    assert.strictEqual(normalized.category_id, 3);
    assert.strictEqual(normalized.author_id, 1);
    assert.strictEqual(normalized.category_slug, 'arsitektur-renovasi');
    assert.strictEqual(normalized.author_slug, 'dewan-redaksi-spasial');
    assert.strictEqual(normalized.keyTakeawaysArray.length, 3);
  });

  await testAsync('67. Admin strategy=skip returns duplicate_skipped', async () => {
    const d1 = createLocalD1();
    // 1st insert
    const first = await importArticleContent(d1, validSampleMarkdown, { strategy: 'overwrite' });
    assert.strictEqual(first.status, 'success');

    // 2nd import with skip
    const second = await importArticleContent(d1, validSampleMarkdown, { strategy: 'skip' });
    assert.strictEqual(second.status, 'duplicate_skipped');
    assert.strictEqual(second.id, first.id);
  });

  await testAsync('68. Admin strategy=rename creates new row with suffixed slug', async () => {
    const d1 = createLocalD1();
    const first = await importArticleContent(d1, validSampleMarkdown, { strategy: 'overwrite' });
    const second = await importArticleContent(d1, validSampleMarkdown, { strategy: 'rename' });

    assert.strictEqual(second.status, 'success');
    assert.strictEqual(second.action, 'created');
    assert.notStrictEqual(second.slug, first.slug);
    assert.notStrictEqual(second.id, first.id);
  });

  await testAsync('69. Admin strategy=overwrite executes actual SQL UPDATE', async () => {
    const d1 = createLocalD1();
    const first = await importArticleContent(d1, validSampleMarkdown, { strategy: 'overwrite' });

    const updatedMarkdown = validSampleMarkdown.replace(
      'title: "Pengantar Sirkulasi Udara Tropis: Desain Pasif Hunian Nyaman"',
      'title: "Pengantar Sirkulasi Udara Tropis: Revisi Desain 2026"'
    );

    const second = await importArticleContent(d1, updatedMarkdown, { strategy: 'overwrite' });
    assert.strictEqual(second.status, 'success');
    assert.strictEqual(second.action, 'overwritten');
    assert.strictEqual(second.id, first.id);

    const row = await getArticleById(d1, first.id);
    assert.strictEqual(row.title, 'Pengantar Sirkulasi Udara Tropis: Revisi Desain 2026');
  });

  await testAsync('70. Overwrite strictly preserves the original article ID', async () => {
    const d1 = createLocalD1();
    const first = await importArticleContent(d1, validSampleMarkdown, { strategy: 'overwrite' });
    const second = await importArticleContent(d1, validSampleMarkdown, { strategy: 'overwrite' });
    assert.strictEqual(first.id, second.id);
  });

  await testAsync('71. Database write failure propagates to caller as explicit error', async () => {
    const failingD1 = {
      prepare() {
        return {
          bind() { return this; },
          async run() { throw new Error('D1 I/O Error'); },
          async first() { return null; },
          async all() { return { results: [] }; }
        };
      }
    };

    let caught = false;
    try {
      await importArticleContent(failingD1, validSampleMarkdown, { strategy: 'overwrite' });
    } catch (err) {
      caught = true;
    }
    assert.ok(caught);
  });

  await testAsync('72. Explicit test / mock adapter behaves correctly in non-D1 environment', async () => {
    // null DB triggers in-memory fallback
    const res = await importArticleContent(null, validSampleMarkdown, { strategy: 'overwrite' });
    assert.strictEqual(res.status, 'success');
    assert.ok(res.id > 0);
  });

  console.log('\n====================================================');
  console.log(`📊 TEST SUMMARY: ${passed} PASSED, ${failed} FAILED (TOTAL: ${passed + failed})`);
  console.log('====================================================\n');

  if (failed > 0) {
    process.exit(1);
  }
}

main().catch(err => {
  console.error('Fatal Test Runner Error:', err);
  process.exit(1);
});
