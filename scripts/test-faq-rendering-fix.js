/**
 * RancangLoka Magazine 2.1 — FAQ Rendering Regression Suite
 * MISSION: RANCANGLOKA_FAQ_RAW_JSON_RENDER_FIX_1
 *
 * Verifies:
 * 1. FAQ from JSON source (array or string)
 * 2. FAQ from recognized Markdown comment markers (FAQ_START, EDITORIAL_FAQ_START, FAQ_JSON)
 * 3. FAQ absent (returns empty array, zero accordion rendered, body untouched)
 * 4. FAQ malformed (fails safely, returns empty array, zero raw JSON or delimiter leaks into body)
 * 5. FAQ with Indonesian Unicode characters (em-dash, accents, quotes)
 * 6. FAQ containing quotation marks (straight and curly)
 * 7. FAQ in admin preview pipeline
 * 8. FAQ in public article rendering pipeline
 * 9. No duplicate FAQ output
 * 10. No raw JSON visible in rendered HTML
 * 11. Real Batch 1 drafts (Balcony, Moisture Wall, Interior Spatial)
 */

import assert from 'node:assert';
import fs from 'node:fs';
import {
  extractEditorialFaqs,
  parseFaqPayload,
  stripFaqCommentMarkers,
  validateEditorialFaqQuality
} from '../src/lib/editorial/faq.ts';
import { renderArticleMarkdownSafely, sanitizeArticleHtml } from '../src/lib/article/renderer.ts';
import { getDevLocalBatch1Article } from '../src/lib/approvals/dev-fixtures.ts';

console.log('=== TEST SUITE: RANCANGLOKA FAQ RAW JSON RENDER FIX ===\n');

let passedTests = 0;

async function runTest(name, fn) {
  try {
    await fn();
    console.log(`✅ [PASS] ${name}`);
    passedTests++;
  } catch (err) {
    console.error(`❌ [FAIL] ${name}`);
    console.error(err);
    process.exit(1);
  }
}

// 1. FAQ from JSON source (direct array or JSON string)
await runTest('1. FAQ from JSON source (array & string payload)', () => {
  const fromArray = extractEditorialFaqs({
    faq: [
      { question: 'Berapa ukuran balkon minimal?', answer: 'Ukuran 1x2 meter sudah cukup nyaman.' }
    ]
  });
  assert.strictEqual(fromArray.length, 1);
  assert.strictEqual(fromArray[0].question, 'Berapa ukuran balkon minimal?');

  const fromString = extractEditorialFaqs({
    faqs: JSON.stringify([
      { question: 'Material apa yang tahan panas?', answer: 'Besi powder-coated dan kayu WPC.' }
    ])
  });
  assert.strictEqual(fromString.length, 1);
  assert.strictEqual(fromString[0].question, 'Material apa yang tahan panas?');
});

// 2. FAQ from recognized Markdown comment markers
await runTest('2. FAQ from recognized Markdown comment markers (FAQ_START, EDITORIAL_FAQ_START, FAQ_JSON)', () => {
  const md1 = `
# Judul Artikel
Paragraf artikel.

<!-- FAQ_START -->
[
  { "question": "Pertanyaan 1?", "answer": "Jawaban 1." }
]
<!-- FAQ_END -->
`;
  const faqs1 = extractEditorialFaqs({ content_md: md1 });
  assert.strictEqual(faqs1.length, 1);
  assert.strictEqual(faqs1[0].question, 'Pertanyaan 1?');

  const md2 = `
# Judul Artikel
<!-- EDITORIAL_FAQ_START -->
[
  { "question": "Pertanyaan 2?", "answer": "Jawaban 2." }
]
<!-- EDITORIAL_FAQ_END -->
`;
  const faqs2 = extractEditorialFaqs({ content_md: md2 });
  assert.strictEqual(faqs2.length, 1);
  assert.strictEqual(faqs2[0].question, 'Pertanyaan 2?');

  const md3 = `
# Judul Artikel
<!-- FAQ_JSON: [{"question":"Pertanyaan 3?","answer":"Jawaban 3."}] -->
`;
  const faqs3 = extractEditorialFaqs({ content_md: md3 });
  assert.strictEqual(faqs3.length, 1);
  assert.strictEqual(faqs3[0].question, 'Pertanyaan 3?');
});

// 3. FAQ absent (clean pass-through, zero accordion)
await runTest('3. FAQ absent returns empty array and preserves normal body', async () => {
  const normalMd = `# Renovasi Dapur\n\nDapur bersih harus memiliki ventilasi cukup.\n\n## Poin Penting\n- Exhaust fan\n- Jendela hidup`;
  const faqs = extractEditorialFaqs({ content_md: normalMd });
  assert.strictEqual(faqs.length, 0);

  const rendered = await renderArticleMarkdownSafely(normalMd);
  assert.ok(rendered.includes('Dapur bersih harus memiliki ventilasi'));
  assert.ok(!rendered.includes('FAQ'));
});

// 4. FAQ malformed (fails safely, no leak of raw data into HTML)
await runTest('4. FAQ malformed fails safely with zero raw JSON leakage into rendered HTML', async () => {
  const malformedMd = `
# Artikel Eksperimen
Paragraf pembuka artikel normal.

<!-- FAQ_START -->
[
  { "question": "Pertanyaan rusak tanpa kurung tutup", "answer": "Teks tidak lengkap
<!-- FAQ_END -->

## Bagian Penutup
Paragraf penutup artikel normal.
`;

  // Must not throw, returns empty faqs
  const faqs = extractEditorialFaqs({ content_md: malformedMd });
  assert.strictEqual(faqs.length, 0);

  // Rendered HTML must NOT contain the malformed JSON or delimiters
  const rendered = await renderArticleMarkdownSafely(malformedMd);
  assert.ok(!rendered.includes('Pertanyaan rusak tanpa kurung tutup'));
  assert.ok(!rendered.includes('FAQ_START'));
  assert.ok(!rendered.includes('FAQ_END'));
  assert.ok(rendered.includes('Paragraf pembuka artikel normal.'));
  assert.ok(rendered.includes('Paragraf penutup artikel normal.'));
});

// 5. FAQ with Indonesian Unicode characters (em-dash, accents, symbols)
await runTest('5. FAQ with Indonesian Unicode characters (em-dash, symbols)', () => {
  const unicodeMd = `
<!-- FAQ_START -->
[
  {
    "question": "Berapa ukuran kedalaman meja balkon 1–2 meter?",
    "answer": "Kedalaman meja gantung railing dianjurkan 45–50 cm agar sirkulasi ±60 cm tetap lega."
  }
]
<!-- FAQ_END -->
`;
  const faqs = extractEditorialFaqs({ content_md: unicodeMd });
  assert.strictEqual(faqs.length, 1);
  assert.ok(faqs[0].question.includes('1–2 meter'));
  assert.ok(faqs[0].answer.includes('45–50 cm'));
  assert.ok(faqs[0].answer.includes('±60 cm'));
});

// 6. FAQ containing quotation marks (straight and curly)
await runTest('6. FAQ containing straight and curly quotation marks', () => {
  const quotesMd = `
<!-- FAQ_START -->
[
  {
    "question": "Apakah tanaman \\"lidah mertua\\" tahan cuaca panas?",
    "answer": "Ya, tanaman berjuluk “sansevieria” ini sangat tangguh terhadap sengatan panas matahari sore."
  }
]
<!-- FAQ_END -->
`;
  const faqs = extractEditorialFaqs({ content_md: quotesMd });
  assert.strictEqual(faqs.length, 1);
  assert.ok(faqs[0].question.includes('"lidah mertua"'));
  assert.ok(faqs[0].answer.includes('“sansevieria”'));
});

// 7. FAQ in admin preview pipeline: Markdown rendered safely has no raw JSON
await runTest('7. Admin preview rendering pipeline strips raw JSON from body', async () => {
  const rawBalconyMd = fs.readFileSync('scripts/content-bootstrap/batch-1-import-ready/article-02-menata-balkon.md', 'utf8');
  
  // Extract FAQs first
  const faqs = extractEditorialFaqs({ content_md: rawBalconyMd });
  assert.strictEqual(faqs.length, 4);

  // Render HTML safely
  const renderedHtml = await renderArticleMarkdownSafely(rawBalconyMd);

  // Verify raw JSON is completely stripped from HTML
  assert.ok(!renderedHtml.includes('<!-- FAQ_START -->'));
  assert.ok(!renderedHtml.includes('<!-- FAQ_END -->'));
  assert.ok(!renderedHtml.includes('"question"'));
  assert.ok(!renderedHtml.includes('&quot;question&quot;'));
  assert.ok(!renderedHtml.includes('Berapa ukuran minimal balkon'));

  // Verify normal sections are 100% intact
  assert.ok(renderedHtml.includes('7. Kesalahan Umum yang Wajib Dihindari'));
  assert.ok(renderedHtml.includes('Balkon kecil tidak harus menjadi ruang yang penuh barang'));
});

// 8. Stripping leaked raw FAQ HTML paragraph from legacy pre-rendered records
await runTest('8. stripFaqCommentMarkers removes leaked <p>[{"question"...}]</p> from pre-rendered HTML', () => {
  const leakedHtml = `
<p>Paragraf akhir artikel sebelum FAQ.</p>
<p>[
  {
    &quot;question&quot;: &quot;Pertanyaan bocor?&quot;,
    &quot;answer&quot;: &quot;Jawaban bocor.&quot;
  }
]</p>
`;
  const cleaned = stripFaqCommentMarkers(leakedHtml);
  assert.ok(!cleaned.includes('Pertanyaan bocor?'));
  assert.ok(!cleaned.includes('&quot;question&quot;'));
  assert.ok(cleaned.includes('<p>Paragraf akhir artikel sebelum FAQ.</p>'));
});

// 9. No duplicate FAQ output
await runTest('9. Single canonical FAQ extraction produces zero duplicates', () => {
  const testArticle = {
    faq: [{ question: 'Q1', answer: 'A1' }],
    content_md: '<!-- FAQ_START -->[{"question":"Q1","answer":"A1"}]<!-- FAQ_END -->'
  };
  const extracted = extractEditorialFaqs(testArticle);
  assert.strictEqual(extracted.length, 1, 'Direct property takes precedence, zero duplicates');
});

// 10. Actual Batch 1 Balcony draft verification
await runTest('10. Batch 1 Balcony draft (JOB-04-BALKON-COMPACT) render integrity', async () => {
  const fixture = await getDevLocalBatch1Article('7-ide-menata-balkon-rumah-kecil-agar-nyaman');
  assert.ok(fixture, 'Fixture exists');

  const faqs = extractEditorialFaqs(fixture);
  assert.strictEqual(faqs.length, 4, 'Balcony article has 4 FAQs');

  const rendered = await renderArticleMarkdownSafely(fixture.content_md);
  assert.strictEqual(rendered.includes('Berapa ukuran minimal balkon'), false, 'Zero FAQ JSON in rendered body');
  assert.strictEqual(rendered.includes('&quot;question&quot;'), false, 'Zero JSON quotes in rendered body');
});

// 11. Actual Batch 1 Moisture Wall draft verification
await runTest('11. Batch 1 Moisture Wall draft (JOB-02-MOISTURE-WALL) render integrity', async () => {
  const fixture = await getDevLocalBatch1Article('dinding-rembes-dan-cat-menggelembung-cara-membedakan-masalah-talang-plesteran-kelembapan-tanah');
  assert.ok(fixture, 'Fixture exists');

  const faqs = extractEditorialFaqs(fixture);
  assert.strictEqual(faqs.length, 4, 'Moisture Wall article has 4 FAQs');

  const rendered = await renderArticleMarkdownSafely(fixture.content_md);
  assert.strictEqual(rendered.includes('Mengapa cat dinding tetap menggelembung'), false, 'Zero FAQ JSON in rendered body');
  assert.strictEqual(rendered.includes('&quot;question&quot;'), false, 'Zero JSON quotes in rendered body');
});

// 12. Actual Batch 1 Interior Spatial draft verification
await runTest('12. Batch 1 Interior Spatial draft (JOB-03-INTERIOR-SPATIAL) render integrity', async () => {
  const fixture = await getDevLocalBatch1Article('menata-denah-rumah-lebar-5-6-meter-solusi-sirkulasi-bukaan-ruang-tengah-tidak-pengap');
  assert.ok(fixture, 'Fixture exists');

  const faqs = extractEditorialFaqs(fixture);
  assert.strictEqual(faqs.length, 4, 'Interior Spatial article has 4 FAQs');

  const rendered = await renderArticleMarkdownSafely(fixture.content_md);
  assert.strictEqual(rendered.includes('Mengapa ruang tengah rumah lebar 5–6 meter tetap terasa gerah'), false, 'Zero FAQ JSON in rendered body');
  assert.strictEqual(rendered.includes('&quot;question&quot;'), false, 'Zero JSON quotes in rendered body');
});

console.log(`\n======================================================`);
console.log(`🎉 ALL ${passedTests} FAQ RENDERING REGRESSION TESTS PASSED!`);
console.log(`======================================================\n`);
