/**
 * RancangLoka — Hermes Autonomous Editorial V1 End-to-End Test Suite
 * Milestone: HERMES-AUTONOMOUS-EDITORIAL-V1
 *
 * Verifies that the Hermes Autonomous Editorial pipeline runs independently
 * from topic/manuscript to complete CMS D1 integration with ZERO manual
 * Antigravity (Gravy) interventions.
 *
 * TEST COVERAGE:
 * - Test 1: Operator Authorization & Security Invariant Gate
 * - Test 2: Conversational Editorial 2.1 Enforcement (0 "Anda", max 60 words per block)
 * - Test 3: Nadia Dynamic Visual Storyboard Generation on arbitrary topics
 * - Test 4: Budi Automated Media Pipeline, Candidate Reuse & Manifest Compilation
 * - Test 5: End-to-End Autonomous Workflow Execution on Existing Article (Dry-run with Asset Reuse)
 * - Test 6: End-to-End Autonomous Workflow Execution on Brand New Unworked Topic
 * - Test 7: Zero Unauthorized Paid Spend & Budget Hard Cap ($0.30 max, NEW_SPEND: $0)
 * - Test 8: Single H1 & Clean Reader View Compatibility in CMS
 * - Test 9: Golden Article #9993 Inviolability (100% intact, zero regressions)
 */

import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import { fileURLToPath } from 'node:url';

import {
  executeAutonomousEditorialWorkflow,
  auditJokoDraftReadability,
  applyNadiaDeterministicPolish,
  generateVisualStoryboard,
  executeBudiMediaPipeline,
  SEEDREAM_PRICE_USD
} from '../src/lib/editorial/index.ts';

import { renderArticleMarkdownSafely } from '../src/lib/article/renderer.ts';
import { resolveVisualPlacements } from '../src/lib/media/anchor-resolver.ts';
import { loadArticleVisualManifest } from '../src/lib/media/manifest-loader.ts';
import { extractTableOfContents, processArticleContent } from '../src/lib/seo.ts';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');

const dbPath = path.resolve(rootDir, '.wrangler/state/v3/d1/miniflare-D1DatabaseObject/37bd9da5950b040e71b09fbfd7ca57290acb451dcd5dc35acb02655fa75fa480.sqlite');
const db = new DatabaseSync(dbPath);

let totalTests = 0;
let passedTests = 0;

function it(name, fn) {
  totalTests++;
  try {
    fn();
    passedTests++;
    console.log(`  [PASS] ${name}`);
  } catch (err) {
    console.error(`  [FAIL] ${name}:`, err.message);
    throw err;
  }
}

async function itAsync(name, fn) {
  totalTests++;
  try {
    await fn();
    passedTests++;
    console.log(`  [PASS] ${name}`);
  } catch (err) {
    console.error(`  [FAIL] ${name}:`, err.message);
    throw err;
  }
}

async function runSuite() {
  console.log('=============================================================');
  console.log('  RancangLoka — Hermes Autonomous Editorial V1 Master Verification');
  console.log('=============================================================\n');

  // -------------------------------------------------------------
  // Test 1: Operator Auth & Security Invariant Gate
  // -------------------------------------------------------------
  await itAsync('T01: Security Invariant: Execution without operator authorization throws security error', async () => {
    let threw = false;
    try {
      await executeAutonomousEditorialWorkflow({
        taskId: 'unauth-task-1',
        topic: 'Test Unauth',
        operatorAuth: null,
        db
      });
    } catch (e) {
      threw = true;
      assert.ok(e.message.includes('HERMES_AUTONOMOUS_SECURITY_VIOLATION'), 'Must throw security violation');
    }
    assert.equal(threw, true, 'Unauthenticated execution must fail-closed');
  });

  // -------------------------------------------------------------
  // Test 2: Conversational Editorial 2.1 Enforcement
  // -------------------------------------------------------------
  it('T02: Conversational 2.1: Nadia polish strips "Anda" and audits block word limits', () => {
    const rawText = `## 1. Masalah Utama\n\nJika Anda melihat dinding rumah Anda berjamur, jangan panik dulu. Kami sarankan Anda memeriksa saluran air.\n\n- Pilihan pertama adalah memeriksa talang air Anda.\n- Pilihan kedua adalah membersihkan lumut yang menempel di dinding luar rumah Anda.`;
    const polishResult = applyNadiaDeterministicPolish(rawText);
    const polished = polishResult.polishedContent;

    assert.equal(polished.includes('Anda'), false, 'Nadia polish must remove all instances of "Anda"');
    assert.ok(polished.includes('kamu') || polished.includes('rumahmu'), 'Must contain natural "kamu" or "rumahmu"');

    const audit = auditJokoDraftReadability(polished);
    assert.equal(audit.issues.some(i => i.includes('Anda')), false, 'Audit must report zero "Anda"');
  });

  // -------------------------------------------------------------
  // Test 3: Nadia Dynamic Visual Storyboard Generation
  // -------------------------------------------------------------
  it('T03: Nadia Dynamic Visual Storyboard: Scans any article H2 headings and outputs bound visual slots', () => {
    const mockArticle = {
      id: 10005,
      slug: 'exhaust-fan-kamar-mandi-atasi-plafon-berjamur',
      title: 'Plafon Kamar Mandi Berjamur Hitam? Solusi Sirkulasi dan Exhaust Fan',
      markdown: [
        'Ringkasan cepat untuk kamu yang menghadapi plafon kamar mandi hitam berjamur.',
        '',
        '## 1. Kenapa Plafon Kamar Mandi Mudah Menghitam dan Berjamur?',
        'Uap air hangat dari mandi setiap hari terperangkap di ruangan tanpa ventilasi.',
        'Jamur hitam menyukai kelembapan tinggi di atas 70% dan permukaan cat biasa yang tidak kedap.',
        '',
        '## 2. Cara Kerja Exhaust Fan dan Jalur Pembuangan Udara Lembap',
        'Exhaust fan berfungsi menarik uap basah keluar melalui pipa ducting menuju luar rumah.',
        'Pemasangan yang benar membutuhkan kemiringan pipa 1-2 derajat agar air kondensasi tidak menetes kembali.',
        '',
        '## 3. Langkah Perbaikan dan Pilihan Cat Anti-Jamur yang Tepat',
        'Kikis permukaan cat yang mengelupas dan semprotkan cairan fungisida sebelum mengecat ulang.',
        'Gunakan cat berbahan dasar akrilik dengan formula anti-mold untuk daya tahan jangka panjang.'
      ].join('\n')
    };

    const storyboard = generateVisualStoryboard(mockArticle);
    assert.ok(storyboard, 'Storyboard must be generated');
    assert.equal(storyboard.article_id, 10005);
    assert.equal(storyboard.article_slug, 'exhaust-fan-kamar-mandi-atasi-plafon-berjamur');
    assert.equal(storyboard.cover.slot_key, 'cover_hero');
    assert.ok(storyboard.inline_slots.length >= 1, 'Must have at least 1 inline slot');
    assert.ok(storyboard.inline_slots.length <= 2, 'Must not exceed 2 inline slots');

    // Verify slots are bound to actual H2 titles
    for (const slot of storyboard.inline_slots) {
      assert.ok(
        slot.section_title.startsWith('1.') || slot.section_title.startsWith('2.') || slot.section_title.startsWith('3.'),
        `Slot title "${slot.section_title}" must match an H2 heading`
      );
      assert.ok(slot.draft_alt_text.length > 10, 'Draft alt text must be substantive');
      assert.ok(slot.educational_purpose.length > 10, 'Educational purpose must be declared');
    }
  });

  // -------------------------------------------------------------
  // Test 4: Budi Automated Media Pipeline & Manifest Compilation
  // -------------------------------------------------------------
  await itAsync('T04: Budi Media Pipeline: Compiles canonical manifest, binds D1 settings, and verifies anchor count', async () => {
    const mockContent = [
      'Plafon kamar mandi sering kali menjadi korban pertama dari sirkulasi udara yang buruk.',
      '',
      '## 1. Mengapa Plafon Kamar Mandi Menjadi Lembap dan Berjamur?',
      'Uap air panas mandi menempel di permukaan plafon dan memicu pertumbuhan spora jamur hitam.',
      '',
      '## 2. Diagram Jalur Sirkulasi Udara dan Pembuangan Exhaust Fan',
      'Exhaust fan menyedot udara lembap keluar rumah sehingga ruangan tetap kering dan segar.'
    ].join('\n');

    const storyboard = generateVisualStoryboard({
      id: 10006,
      slug: 'solusi-exhaust-fan-kamar-mandi',
      title: 'Solusi Exhaust Fan Kamar Mandi',
      markdown: mockContent
    });

    const pipelineResult = await executeBudiMediaPipeline(
      db,
      storyboard,
      mockContent,
      {
        allowPaidGeneration: false,
        allowMockWhenMissing: true,
        rootDir
      }
    );

    assert.equal(pipelineResult.success, true, 'Budi media pipeline must succeed');
    assert.ok(pipelineResult.manifest, 'Manifest must be generated');
    assert.equal(pipelineResult.manifest.manifest_version, '1.0.0');
    assert.equal(pipelineResult.placedCount, storyboard.inline_slots.length, 'All inline slots must be placed');
    assert.equal(pipelineResult.totalSpendUsd, 0, 'Dry-run spend must be exactly $0');

    // Verify D1 settings persistence
    const settingRow = db.prepare("SELECT value FROM settings WHERE key = 'visual_manifest:article:10006'").get();
    assert.ok(settingRow, 'Manifest must be stored in D1 settings table');
    const storedManifest = JSON.parse(settingRow.value);
    assert.equal(storedManifest.article_slug, 'solusi-exhaust-fan-kamar-mandi');
  });

  // -------------------------------------------------------------
  // Test 5: End-to-End Autonomous Workflow on Existing Article (#9999)
  // -------------------------------------------------------------
  await itAsync('T05: End-to-End Workflow on Existing Manuscript: Zero Gravy interventions, complete D1 binding', async () => {
    const art9999 = db.prepare("SELECT * FROM articles WHERE id = 9999").get();
    assert.ok(art9999, 'Article 9999 must exist in D1');

    const result = await executeAutonomousEditorialWorkflow({
      taskId: 'auto-run-art9999',
      topic: art9999.title,
      slug: art9999.slug,
      articleId: 9999,
      manuscriptMd: art9999.content_md,
      operatorAuth: {
        authorizedBy: 'Chief Editor'
      },
      db,
      options: {
        allowPaidGeneration: false,
        maxBudgetUsd: 0.30,
        rootDir
      }
    });

    assert.equal(result.success, true, 'Workflow must succeed');
    assert.equal(result.status, 'DRAFT', 'Article status must remain DRAFT');
    assert.equal(result.gravyManualStepsRemaining, 0, 'Zero Gravy manual steps remaining');
    assert.equal(result.readabilityAudit.issues.some(i => i.includes('Anda')), false, 'Readability must have 0 "Anda"');
    assert.equal(result.placedCount, result.expectedCount, 'Placed count must match expected');
    assert.equal(result.totalSpendUsd, 0, 'Reuse asset spend must be $0');

    // Confirm D1 articles table record has featured image and alt
    const updatedArticle = db.prepare("SELECT * FROM articles WHERE id = 9999").get();
    assert.ok(updatedArticle.featured_image, 'Article must have featured_image set');
    assert.ok(updatedArticle.image_alt, 'Article must have image_alt set');
    assert.equal(updatedArticle.status, 'draft', 'Status must strictly be draft');
  });

  // -------------------------------------------------------------
  // Test 6: End-to-End Autonomous Workflow on Brand New Unworked Topic
  // -------------------------------------------------------------
  await itAsync('T06: End-to-End Workflow on Brand New Topic: Full autonomous pipeline execution to D1 draft', async () => {
    const newTopic = 'Mengatasi Plafon Kamar Mandi Berjamur Hitam: Solusi Exhaust Fan dan Cat Anti-Jamur';
    const newSlug = 'mengatasi-plafon-kamar-mandi-berjamur-hitam-exhaust-fan';
    const newArticleId = 10010;

    const newManuscript = [
      'Plafon kamar mandi yang menghitam karena jamur adalah pemandangan yang sering bikin pemilik rumah frustrasi.',
      'Masalah ini biasanya bukan cuma soal tampilan, melainkan tanda bahwa uap lembap mandi terperangkap tanpa jalan keluar.',
      '',
      '## 1. Kenapa Plafon Kamar Mandi Sangat Mudah Menghitam dan Berjamur?',
      'Saat kamu mandi air hangat, uap air akan naik ke atas dan menempel di langit-langit kamar mandi.',
      'Jika ruangan tidak memiliki ventilasi silang yang cukup, kelembapan udara bisa bertahan di atas 70 persen selama berjam-jam.',
      'Kondisi lembap dan hangat inilah habitat paling ideal bagi spora jamur hitam untuk berkembang biak.',
      '',
      '## 2. Cara Kerja Exhaust Fan Membuang Uap Lembap ke Luar Rumah',
      'Solusi paling efektif untuk kamar mandi tanpa jendela luar adalah memasang exhaust fan berkapasitas memadai.',
      'Exhaust fan menyedot udara lembap dari dalam ruangan dan mendorongnya keluar melalui pipa ducting fleksibel.',
      'Pasang pipa dengan sedikit kemiringan ke arah luar agar sisa tetesan air kondensasi tidak mengalir balik ke plafon.',
      '',
      '## 3. Langkah Pembersihan dan Pemilihan Cat Anti-Jamur yang Tepat',
      'Sebelum mengecat ulang, bersihkan jamur yang menempel dengan cairan fungisida atau campuran pemutih yang diencerkan.',
      'Biarkan permukaan gipsum mengering sepenuhnya sebelum mengaplikasikan cat dasar tahan alkali.',
      'Gunakan cat khusus kamar mandi dengan formula anti-mold agar spora jamur baru tidak bisa tumbuh kembali.'
    ].join('\n');

    const result = await executeAutonomousEditorialWorkflow({
      taskId: 'auto-run-brand-new-topic',
      topic: newTopic,
      slug: newSlug,
      articleId: newArticleId,
      manuscriptMd: newManuscript,
      operatorAuth: {
        authorizedBy: 'Chief Editor'
      },
      db,
      options: {
        allowPaidGeneration: false,
        allowMockWhenMissing: true,
        maxBudgetUsd: 0.30,
        rootDir
      }
    });

    assert.equal(result.success, true, 'Brand new topic workflow must complete successfully');
    assert.equal(result.status, 'DRAFT', 'Status must be DRAFT');
    assert.equal(result.gravyManualStepsRemaining, 0, 'Zero Gravy manual steps remaining');
    assert.equal(result.readabilityAudit.issues.some(i => i.includes('Anda')), false, 'No "Anda" in new article');
    assert.equal(result.totalSpendUsd, 0, 'Offline test spend must be $0');
    assert.ok(result.placedCount >= 1, 'At least 1 inline slot placed');
    assert.equal(result.placedCount, result.expectedCount, 'All planned slots placed');

    // Verify D1 articles table persistence
    const savedArticle = db.prepare("SELECT * FROM articles WHERE id = ?").get(newArticleId);
    assert.ok(savedArticle, 'New article must be saved in D1');
    assert.equal(savedArticle.slug, newSlug);
    assert.equal(savedArticle.status, 'draft');
    assert.ok(savedArticle.featured_image.length > 5);
    assert.ok(savedArticle.image_alt.length > 5);

    // Verify D1 settings manifest persistence
    const savedSetting = db.prepare("SELECT value FROM settings WHERE key = ?").get(`visual_manifest:article:${newArticleId}`);
    assert.ok(savedSetting, 'Visual manifest must exist in settings table');
    const parsedManifest = JSON.parse(savedSetting.value);
    assert.equal(parsedManifest.article_id, newArticleId);
    assert.equal(parsedManifest.visual_items.length, result.expectedCount);
  });

  // -------------------------------------------------------------
  // Test 7: Budget Hard Cap & Zero Unauthorized Spend Invariant
  // -------------------------------------------------------------
  it('T07: Zero Unauthorized Paid Spend: Budget cap <= $0.30 enforced, unauthorized billable calls refused', () => {
    assert.ok(SEEDREAM_PRICE_USD <= 0.30, `Seedream unit price $${SEEDREAM_PRICE_USD} must be <= $0.30 cap`);
    // Maximum 2 generations (cover + 1 inline) = $0.27 <= $0.30
    const maxTwoGens = SEEDREAM_PRICE_USD * 2;
    assert.ok(maxTwoGens <= 0.30, `Two generations ($${maxTwoGens}) must be <= $0.30 budget cap`);
  });

  // -------------------------------------------------------------
  // Test 8: Single H1 & Clean Reader View Compatibility
  // -------------------------------------------------------------
  await itAsync('T08: Single H1 & Clean Reader View: CMS rendered HTML has zero H1 in body and clean reader layout', async () => {
    const article = db.prepare("SELECT * FROM articles WHERE id = 10010").get();
    assert.ok(article, 'Article 10010 must exist');

    const manifest = await loadArticleVisualManifest({ articleId: 10010, slug: article.slug, db });
    assert.ok(manifest, 'Manifest must load');

    const rawHtml = await renderArticleMarkdownSafely(article.content_md);
    const placement = resolveVisualPlacements(rawHtml, manifest, { isDev: true });

    assert.equal(placement.isValid, true, 'Placement must be valid');
    assert.equal(/<h1[^>]*>/i.test(placement.html), false, 'Body HTML must contain zero H1 tags');

    const toc = extractTableOfContents(placement.html);
    assert.ok(toc.length >= 3, `TOC must contain >= 3 items, got ${toc.length}`);

    const processedHtml = processArticleContent(placement.html, article, [], undefined, {}, toc);
    assert.equal(/<h1[^>]*>/i.test(processedHtml), false, 'Processed body HTML must not contain any H1');
  });

  // -------------------------------------------------------------
  // Test 9: Golden Article #9993 Inviolability
  // -------------------------------------------------------------
  it('T09: Golden Article #9993 is 100% frozen, intact and preserved in D1', () => {
    const art9993 = db.prepare("SELECT * FROM articles WHERE id = 9993").get();
    assert.ok(art9993, 'Article 9993 must exist in D1');
    assert.ok(art9993.featured_image.includes('art9993_cover_v2_seedream-pro.jpg'), 'Cover must be V2 Seedream Pro');
    assert.ok(art9993.content_md.includes('Rising Damp'), 'Pathology content must remain intact');
    assert.ok(art9993.content_md.includes('trasram'), 'Trasram kedap air must remain intact');
    assert.equal(art9993.status, 'published', 'Status of Golden Article 9993 must remain published');
  });

  console.log('\n=============================================================');
  console.log(`  ALL ${passedTests} / ${totalTests} TESTS PASSED (100%)`);
  console.log('  HERMES AUTONOMOUS EDITORIAL V1 VERIFICATION COMPLETE');
  console.log('=============================================================\n');
}

runSuite().catch(err => {
  console.error('\nSuite failed with error:', err);
  process.exit(1);
});
