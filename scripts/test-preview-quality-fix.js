import { DatabaseSync } from 'node:sqlite';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { extractEditorialFaqs } from '../src/lib/editorial/faq.ts';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');

const dbPath = path.resolve(
  rootDir,
  '.wrangler/state/v3/d1/miniflare-D1DatabaseObject/37bd9da5950b040e71b09fbfd7ca57290acb451dcd5dc35acb02655fa75fa480.sqlite'
);

console.log('======================================================================');
console.log('TEST SUITE: RANCANGLOKA_EDITORIAL_PREVIEW_QUALITY_FIX_1');
console.log('======================================================================\n');

if (!fs.existsSync(dbPath)) {
  console.error('❌ Database not found at:', dbPath);
  process.exit(1);
}

const db = new DatabaseSync(dbPath);
let passed = 0;
let total = 0;

function assert(condition, message) {
  total++;
  if (condition) {
    passed++;
    console.log(`  ✓ PASS: ${message}`);
  } else {
    console.error(`  ❌ FAIL: ${message}`);
  }
}

// -----------------------------------------------------------------------------
// TEST GROUP 1: FEATURED IMAGE FALLBACK & PLACEHOLDER INVARIANTS
// -----------------------------------------------------------------------------
console.log('--- Test Group 1: Featured Image & Motherboard Removal ---');

const article9999 = db.prepare('SELECT id, slug, title, featured_image, image_alt, content_html, content_md FROM articles WHERE id = 9999').get();
assert(article9999 !== undefined, 'Article ID 9999 (Balcony) exists in local D1 staging');
assert(article9999?.featured_image === null, 'Article ID 9999 has featured_image = NULL (no motherboard/generic fallback)');
assert(article9999?.image_alt === null, 'Article ID 9999 has image_alt = NULL');

const article9993 = db.prepare('SELECT id, slug, title, featured_image, image_alt, content_html, content_md FROM articles WHERE id = 9993').get();
assert(article9993 !== undefined, 'Article ID 9993 (Dinding Rembes) exists in local D1 staging');
assert(article9993?.featured_image === null, 'Article ID 9993 has featured_image = NULL (no generic fallback)');

const article10000 = db.prepare('SELECT id, slug, title, featured_image, image_alt, content_html, content_md FROM articles WHERE id = 10000').get();
assert(article10000 !== undefined, 'Article ID 10000 (Denah 5-6m) exists in local D1 staging');
assert(article10000?.featured_image === null, 'Article ID 10000 has featured_image = NULL (no generic fallback)');

// Check preview template for explicit editorial placeholder
const previewPath = path.resolve(rootDir, 'src/pages/admin/preview/[slug].astro');
const previewCode = fs.readFileSync(previewPath, 'utf8');
assert(previewCode.includes('Gambar editorial belum tersedia'), 'Admin preview renders explicit "Gambar editorial belum tersedia" placeholder');
assert(previewCode.includes('MEDIA_PENDING'), 'Admin preview shows MEDIA_PENDING status badge on missing featured image');
assert(previewCode.includes('LokaMedia Dual-Control Gate'), 'Admin preview identifies LokaMedia Dual-Control Gate pipeline');

// Check live published articles to ensure zero regression on existing images
const publishedWithImages = db.prepare("SELECT id, slug, featured_image FROM articles WHERE status = 'published' AND featured_image IS NOT NULL").all();
console.log(`  (Found ${publishedWithImages.length} live published articles with existing images)`);
for (const pub of publishedWithImages) {
  assert(Boolean(pub.featured_image && pub.featured_image.length > 5), `Published article ID ${pub.id} (${pub.slug}) retains valid featured_image without disruption`);
}

// -----------------------------------------------------------------------------
// TEST GROUP 2: SHORT PARAGRAPH EDITORIAL FORMATTING
// -----------------------------------------------------------------------------
console.log('\n--- Test Group 2: Short Paragraph Editorial Readability ---');

function analyzeParagraphs(html) {
  // Extract all <p>...</p> tags
  const pMatches = [...html.matchAll(/<p>([\s\S]*?)<\/p>/gi)].map(m => m[1].replace(/<[^>]+>/g, '').trim()).filter(Boolean);
  
  const sentenceCounts = pMatches.map(p => {
    // Sentence splitting by punctuation (. ! ?) followed by whitespace or end of string
    const sentences = p.split(/(?<=[.!?])\s+/).filter(s => s.trim().length > 3);
    return { text: p, count: sentences.length };
  });

  const longParagraphs = sentenceCounts.filter(sc => sc.count >= 5);
  const avgSentences = sentenceCounts.reduce((acc, curr) => acc + curr.count, 0) / (sentenceCounts.length || 1);

  return { totalP: sentenceCounts.length, longParagraphs, avgSentences, sentenceCounts };
}

const analysisB = analyzeParagraphs(article9999.content_html);
assert(analysisB.totalP >= 15, `Article 9999 has ${analysisB.totalP} semantic paragraphs (adequate distribution)`);
assert(analysisB.longParagraphs.length === 0, `Article 9999 has zero paragraphs with 5+ sentences (longest is ${Math.max(...analysisB.sentenceCounts.map(s => s.count))} sentences)`);
assert(analysisB.avgSentences <= 3.2, `Article 9999 average sentences per paragraph is ${analysisB.avgSentences.toFixed(2)} (<= 3.2 ideal)`);

// Specifically check Meja Gantung, Set Bistro, Bangku Sudut sections in Article B
const htmlB = article9999.content_html;
const mejaGantungIdx = htmlB.indexOf('Meja Gantung pada Railing');
const mejaSnippet = htmlB.substring(mejaGantungIdx, htmlB.indexOf('Set Bistro Lipat'));
const mejaPCount = (mejaSnippet.match(/<p>/g) || []).length;
assert(mejaPCount >= 3, `Section "Meja Gantung pada Railing" is divided into ${mejaPCount} distinct <p> tags (previously 1 monolithic block)`);

const bistroIdx = htmlB.indexOf('Set Bistro Lipat');
const bistroSnippet = htmlB.substring(bistroIdx, htmlB.indexOf('Bangku Sudut dengan Ruang Penyimpanan'));
const bistroPCount = (bistroSnippet.match(/<p>/g) || []).length;
assert(bistroPCount >= 3, `Section "Set Bistro Lipat" is divided into ${bistroPCount} distinct <p> tags (previously 1 monolithic block)`);

const bangkuIdx = htmlB.indexOf('Bangku Sudut dengan Ruang Penyimpanan');
const bangkuSnippet = htmlB.substring(bangkuIdx, htmlB.indexOf('3. Buat Lantai Terasa Lebih Hangat'));
const bangkuPCount = (bangkuSnippet.match(/<p>/g) || []).length;
assert(bangkuPCount >= 3, `Section "Bangku Sudut" is divided into ${bangkuPCount} distinct <p> tags (previously 1 monolithic block)`);

const analysisA = analyzeParagraphs(article9993.content_html);
assert(analysisA.totalP >= 10, `Article 9993 has ${analysisA.totalP} semantic paragraphs`);
assert(analysisA.longParagraphs.length === 0, `Article 9993 has zero paragraphs with 5+ sentences (longest is ${Math.max(...analysisA.sentenceCounts.map(s => s.count))} sentences)`);

const analysisC = analyzeParagraphs(article10000.content_html);
assert(analysisC.totalP >= 12, `Article 10000 has ${analysisC.totalP} semantic paragraphs`);
assert(analysisC.longParagraphs.length === 0, `Article 10000 has zero paragraphs with 5+ sentences (longest is ${Math.max(...analysisC.sentenceCounts.map(s => s.count))} sentences)`);

// -----------------------------------------------------------------------------
// TEST GROUP 3: FAQ RENDERING & ZERO RAW JSON LEAKAGE
// -----------------------------------------------------------------------------
console.log('\n--- Test Group 3: FAQ Rendering & Metadata Extraction ---');

for (const art of [article9993, article9999, article10000]) {
  assert(!art.content_html.includes('<!-- FAQ_START -->'), `Article ${art.id} content_html stripped <!-- FAQ_START --> delimiter`);
  assert(!art.content_html.includes('<!-- FAQ_END -->'), `Article ${art.id} content_html stripped <!-- FAQ_END --> delimiter`);
  assert(!art.content_html.includes('"question":'), `Article ${art.id} content_html does not contain raw FAQ JSON string`);
  
  const faqs = extractEditorialFaqs({ content_md: art.content_md, content_html: art.content_html });
  assert(faqs.length >= 4, `Article ${art.id} successfully extracted ${faqs.length} structured FAQ items for EditorialFAQ accordion`);
  assert(faqs[0].question.length > 10, `Article ${art.id} FAQ item 1 has valid question: "${faqs[0].question.substring(0, 40)}..."`);
  assert(faqs[0].answer.length > 20, `Article ${art.id} FAQ item 1 has valid answer: "${faqs[0].answer.substring(0, 40)}..."`);
}

// -----------------------------------------------------------------------------
// TEST SUMMARY
// -----------------------------------------------------------------------------
console.log('\n======================================================================');
console.log(`TOTAL TESTS: ${total}`);
console.log(`PASSED: ${passed}`);
console.log(`FAILED: ${total - passed}`);
console.log('======================================================================');

if (passed === total) {
  console.log('>>> ALL EDITORIAL PREVIEW QUALITY FIX INVARIANTS PASS! <<<');
  process.exit(0);
} else {
  console.error('>>> SOME INVARIANTS FAILED! <<<');
  process.exit(1);
}
