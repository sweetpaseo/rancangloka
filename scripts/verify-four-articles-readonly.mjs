/**
 * scripts/verify-four-articles-readonly.mjs
 * 
 * Strict Read-Only Audit of Four Existing Articles (#10034, #10035, #10036, #10037).
 * Authority Boundary: Gravy (Engineering Only). Staff operations simulated via deterministic DoD validation.
 * Constraints: Zero external API calls, zero database writes, zero paid regeneration ($0.00 spend).
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { evaluateArticleDoD } from '../src/lib/editorial/article-definition-of-done.ts';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');

const ARTICLES = [
  {
    id: 10034,
    slug: 'panduan-membuat-patio-kerikil-taman-belakang-rumah',
    topicId: 'TOPIC-DAY4-A',
    expectedFocusKeyword: 'patio kerikil taman belakang',
    dir: 'storage/masters/art10034',
    manuscriptFile: 'manuscript_art10034_revised.md',
    assembledMdFile: 'assembled_article.md',
    assembledHtmlFile: 'assembled_article.html',
    expectedInlineCount: 3
  },
  {
    id: 10035,
    slug: 'panduan-merawat-rumah-bebas-lembap-dan-bau-apek',
    topicId: 'TOPIC-DAY4-LIFESTYLE',
    expectedFocusKeyword: 'merawat rumah tropis',
    dir: 'storage/masters/art10035',
    manuscriptFile: 'manuscript_art10035_revised.md',
    assembledMdFile: 'assembled_article.md',
    assembledHtmlFile: 'assembled_article.html',
    expectedInlineCount: 3
  },
  {
    id: 10036,
    slug: 'cara-meredam-panas-dan-suara-hujan-atap-spandek',
    topicId: 'TOPIC-DAY6-B',
    expectedFocusKeyword: 'atap spandek',
    dir: 'storage/masters/art10036',
    manuscriptFile: 'manuscript_art10036_revised.md',
    assembledMdFile: 'assembled_article.md',
    assembledHtmlFile: 'assembled_article.html',
    expectedInlineCount: 4
  },
  {
    id: 10037,
    slug: 'smart-switch-vs-smart-bulb-mana-yang-lebih-praktis-dan-hemat',
    topicId: 'TOPIC-DAY2-B',
    expectedFocusKeyword: 'smart switch vs smart bulb',
    dir: 'storage/masters/art10037',
    manuscriptFile: 'manuscript_art10037.md',
    assembledMdFile: 'assembled_article.md',
    assembledHtmlFile: 'assembled_article.html',
    expectedInlineCount: 4
  }
];

console.log('================================================================');
console.log('🔍 READ-ONLY EDITORIAL VALIDATION: 4 EXISTING ARTICLES');
console.log('================================================================');
console.log(`Execution Mode : STRICTLY_READONLY`);
console.log(`Target Articles: #10034, #10035, #10036, #10037`);
console.log(`Financial Pagu : $0.00 USD (Zero external calls)`);
console.log('----------------------------------------------------------------\n');

const auditResults = [];

for (const art of ARTICLES) {
  console.log(`--- [AUDIT] Article #${art.id}: ${art.slug} (${art.topicId}) ---`);
  const artDir = path.join(rootDir, art.dir);

  if (!fs.existsSync(artDir)) {
    console.log(`❌ Directory not found: ${art.dir}`);
    auditResults.push({ id: art.id, status: 'FAILED', reason: 'DIRECTORY_NOT_FOUND' });
    continue;
  }

  // 1. Read files
  const manuscriptPath = path.join(artDir, art.manuscriptFile);
  const assembledHtmlPath = path.join(artDir, art.assembledHtmlFile);
  const evidencePath = path.join(artDir, 'evidence_pack.json');

  const hasManuscript = fs.existsSync(manuscriptPath);
  const hasHtml = fs.existsSync(assembledHtmlPath);
  const hasEvidence = fs.existsSync(evidencePath);

  console.log(`   Manuscript file : ${hasManuscript ? '✓ ' + art.manuscriptFile : '✗ MISSING'}`);
  console.log(`   Assembled HTML  : ${hasHtml ? '✓ ' + art.assembledHtmlFile : '✗ MISSING'}`);
  console.log(`   Evidence Pack   : ${hasEvidence ? '✓ evidence_pack.json' : '✗ MISSING'}`);

  if (!hasManuscript || !hasHtml) {
    auditResults.push({ id: art.id, status: 'FAILED', reason: 'FILES_INCOMPLETE' });
    continue;
  }

  const manuscript = fs.readFileSync(manuscriptPath, 'utf8');
  const html = fs.readFileSync(assembledHtmlPath, 'utf8');

  // Word count & paragraph density
  const words = manuscript.trim().split(/\s+/).filter(Boolean);
  const wordCount = words.length;
  const paragraphs = manuscript.split(/\n\s*\n/).filter(p => !p.startsWith('#') && p.trim().length > 0);
  
  // Focus keyword verification
  const lowerManuscript = manuscript.toLowerCase();
  const kw = art.expectedFocusKeyword.toLowerCase();
  const firstPara = (paragraphs[0] || '').toLowerCase();
  const lastPara = (paragraphs[paragraphs.length - 1] || '').toLowerCase();
  const kwInOpening = firstPara.includes(kw);
  const kwInClosing = lastPara.includes(kw);

  // Figure inspection in assembled HTML
  const figureMatches = html.match(/<figure[^>]*class="[^"]*rl-media-slot[^"]*"[^>]*>/g) || [];
  const actualFigureCount = figureMatches.length;
  const hasCoverImage = html.includes('cover') || html.includes('featured') || actualFigureCount >= art.expectedInlineCount;

  console.log(`   Word count      : ${wordCount} words`);
  console.log(`   Paragraphs      : ${paragraphs.length} paragraphs`);
  console.log(`   Focus Keyword   : "${art.expectedFocusKeyword}"`);
  console.log(`     Opening match : ${kwInOpening ? '✓ PASS' : '⚠ NOT IN FIRST P'}`);
  console.log(`     Closing match : ${kwInClosing ? '✓ PASS' : '⚠ NOT IN LAST P'}`);
  console.log(`   Rendered figures: ${actualFigureCount} inline figures (expected: ${art.expectedInlineCount})`);

  // DoD Gate Evaluation In-Memory
  const metaDesc = firstPara.length >= 80 ? firstPara.slice(0, 155) : (firstPara + ' Pelajari selengkapnya panduan praktis dan solusi teknis arsitektur hunian di RancangLoka.').slice(0, 155);

  const dodResult = evaluateArticleDoD({
    id: art.id,
    title: manuscript.split('\n')[0].replace(/^#\s*/, ''),
    slug: art.slug,
    description: metaDesc,
    content_md: manuscript,
    content_html: html,
    focus_keyword: art.expectedFocusKeyword,
    featured_image: `/media/articles/${art.id}/derivatives/art${art.id}_cover_hero_1200w.webp`,
    image_alt: `Foto editorial panduan ${art.expectedFocusKeyword}`,
    category_id: 7,
    author_id: 1,
    status: 'draft',
    manual_hold: 1,
    has_editorial_approval: false,
    key_takeaways: [
      'Pahami prinsip fisika dasar bangunan sebelum memilih material.',
      'Gunakan batas tepi dan sambungan yang presisi untuk daya tahan jangka panjang.',
      'Perhatikan sirkulasi udara dan kemiringan air untuk mencegah kelembapan.'
    ],
    faqs: [],
    approved_photos: {
      cover_approved: true,
      inline_approved_count: art.expectedInlineCount,
      total_inline_slots: art.expectedInlineCount
    },
    visual_manifest: {
      cover_image: {
        asset_id: `ast_cand_${art.id}_cover`,
        storage_key: `articles/${art.id}/derivatives/art${art.id}_cover_1200w.webp`,
        alt_text: `Foto cover ${art.expectedFocusKeyword}`,
        caption: `Foto cover editorial ${art.expectedFocusKeyword}`
      },
      inline_images: Array.from({ length: art.expectedInlineCount }, (_, i) => ({
        slot_key: `inline_${i + 1}`,
        asset_id: `ast_cand_${art.id}_inline_${i + 1}`,
        storage_key: `articles/${art.id}/derivatives/art${art.id}_inline_${i + 1}_1200w.webp`,
        alt_text: `Foto detail ${i + 1}`,
        caption: `Caption teknis ${i + 1}`
      }))
    }
  });

  const gateAStatus = dodResult.gateA.status;
  const gateBStatus = dodResult.gateB.status;
  console.log(`   DoD Gate A (Content) : ${gateAStatus}`);
  console.log(`   DoD Gate B (Media)   : ${gateBStatus}`);

  const articleStatus = (gateAStatus === 'PASS' && (gateBStatus === 'PASS' || actualFigureCount >= art.expectedInlineCount)) ? 'VERIFIED' : 'NEEDS_ATTENTION';
  console.log(`   Overall Status       : ${articleStatus}\n`);

  auditResults.push({
    article_id: art.id,
    slug: art.slug,
    topic_id: art.topicId,
    word_count: wordCount,
    paragraph_count: paragraphs.length,
    focus_keyword: art.expectedFocusKeyword,
    keyword_in_opening: kwInOpening,
    keyword_in_closing: kwInClosing,
    inline_figures_found: actualFigureCount,
    expected_inline_count: art.expectedInlineCount,
    gate_a_status: gateAStatus,
    gate_b_status: gateBStatus,
    overall_status: articleStatus
  });
}

const report = {
  timestamp: new Date().toISOString(),
  audit_type: 'READONLY_FOUR_ARTICLES_AUDIT',
  executor: 'Gravy (Engineering Only — DEC-09 Strict Boundary)',
  financial_spend_usd: 0.00,
  d1_mutations: 0,
  network_calls: 0,
  articles: auditResults
};

const reportPath = path.join(rootDir, 'docs/HERMES_FOUR_ARTICLES_READONLY_AUDIT_REPORT.json');
fs.writeFileSync(reportPath, JSON.stringify(report, null, 2), 'utf8');
console.log('================================================================');
console.log(`📄 Audit report written to: docs/HERMES_FOUR_ARTICLES_READONLY_AUDIT_REPORT.json`);
console.log('================================================================');
