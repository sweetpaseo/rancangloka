/**
 * RancangLoka — VERDICT PROHIBITION & CANONICAL TERMINOLOGY GUARD TEST SUITE
 * Milestone: EDITORIAL-VERDICT-GUARD-1
 *
 * Verifies:
 * 1. Prohibited term 'verdict' is strictly absent from all user-facing fixtures and templates.
 * 2. Canonical terminology map correctly identifies and intercepts 'verdict' variations.
 * 3. Human Writing Quality heuristic rejects/penalizes 'verdict' with PROHIBITED_JARGON_VERDICT.
 * 4. Runtime user-facing normalizer transforms 'verdict' into contextually appropriate Indonesian:
 *    - Product review final assessment: "Penilaian RancangLoka" / "Rekomendasi RancangLoka"
 *    - Comparison/educational ending: "Kesimpulan & Rekomendasi"
 *    - Standalone recommendation: "Rekomendasi" / "Pilihan yang Lebih Cocok"
 * 5. Table of contents and processed article HTML never expose 'verdict' to readers.
 * 6. CANONICAL_PRODUCT_REVIEW_TERMINOLOGY is fully defined and exportable for Phase 5.
 */

import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {
  CANONICAL_EDITORIAL_KNOWLEDGE,
  CANONICAL_TERMINOLOGY_MAP,
  getCanonicalTerm,
  CANONICAL_PRODUCT_REVIEW_TERMINOLOGY,
  RANCANGLOKA_PRODUCT_REVIEW_KNOWLEDGE_VERSION
} from '../src/lib/article/editorial-knowledge.ts';
import { evaluateHumanWritingQuality } from '../src/lib/article/human-quality.ts';
import {
  normalizeUserFacingTerminology,
  extractTableOfContents,
  processArticleContent
} from '../src/lib/seo.ts';

let passed = 0;
async function test(name, fn) {
  await fn();
  console.log('  ✅ PASS: ' + name);
  passed++;
}

async function main() {
  console.log('🧪 Starting RancangLoka Verdict Prohibition & Terminology Guard Test Suite...\n');

  // --- SECTION 1: Product Review Canonical Terminology & Knowledge Export ---
  console.log('--- TEST SECTION 1: Canonical Terminology Map & Product Review Knowledge ---');

  await test('RANCANGLOKA_PRODUCT_REVIEW_KNOWLEDGE_VERSION is RANCANGLOKA_PRODUCT_REVIEW_KNOWLEDGE_V1', () => {
    assert.strictEqual(RANCANGLOKA_PRODUCT_REVIEW_KNOWLEDGE_VERSION, 'RANCANGLOKA_PRODUCT_REVIEW_KNOWLEDGE_V1');
  });

  await test('CANONICAL_PRODUCT_REVIEW_TERMINOLOGY defines required contextual replacements', () => {
    assert.ok(CANONICAL_PRODUCT_REVIEW_TERMINOLOGY.overall_assessment.primary);
    assert.strictEqual(CANONICAL_PRODUCT_REVIEW_TERMINOLOGY.overall_assessment.primary, 'Penilaian RancangLoka');
    assert.strictEqual(CANONICAL_PRODUCT_REVIEW_TERMINOLOGY.overall_assessment.alternative, 'Rekomendasi Akhir');
    assert.strictEqual(CANONICAL_PRODUCT_REVIEW_TERMINOLOGY.overall_assessment.comparison_ending, 'Kesimpulan & Rekomendasi');

    assert.strictEqual(CANONICAL_PRODUCT_REVIEW_TERMINOLOGY.decision_recommendations.general, 'Rekomendasi');
    assert.strictEqual(CANONICAL_PRODUCT_REVIEW_TERMINOLOGY.decision_recommendations.more_suitable_choice, 'Pilihan yang Lebih Cocok');
    assert.strictEqual(CANONICAL_PRODUCT_REVIEW_TERMINOLOGY.decision_recommendations.context_fit, 'Rekomendasi untuk Kondisi Anda');

    assert.ok(CANONICAL_PRODUCT_REVIEW_TERMINOLOGY.banned_terms.includes('verdict'));
    assert.ok(CANONICAL_PRODUCT_REVIEW_TERMINOLOGY.banned_terms.includes('final verdict'));
    assert.ok(CANONICAL_PRODUCT_REVIEW_TERMINOLOGY.banned_terms.includes('review verdict'));
  });

  await test('getCanonicalTerm resolves verdict to Indonesian recommendation/assessment', () => {
    const verdictCheck = getCanonicalTerm('verdict');
    assert.ok(verdictCheck);
    assert.ok(verdictCheck.is_prohibited_variation, 'Should be flagged as prohibited variation');
    assert.strictEqual(verdictCheck.canonical, 'rekomendasi / penilaian');
    assert.ok(verdictCheck.explanation.includes('terlalu elitis') || verdictCheck.explanation.includes('verdict'));

    const finalVerdictCheck = getCanonicalTerm('final verdict');
    assert.ok(finalVerdictCheck);
    assert.ok(finalVerdictCheck.is_prohibited_variation);

    const reviewVerdictCheck = getCanonicalTerm('review verdict');
    assert.ok(reviewVerdictCheck);
    assert.ok(reviewVerdictCheck.is_prohibited_variation);
  });

  // --- SECTION 2: Human Writing Quality Gate Penalty ---
  console.log('\n--- TEST SECTION 2: Human Writing Quality Gate Penalty ---');

  await test('evaluateHumanWritingQuality flags and penalizes "verdict" with PROHIBITED_JARGON_VERDICT', () => {
    const draftWithVerdict = `
# Review Profil Kusen Aluminium Alexindo

Kusen aluminium Alexindo sering menjadi rujukan awal bagi pemilik rumah di kawasan Jabodetabek.
Profil dengan ketebalan 1,1 mm hingga 1,3 mm ini memberikan kekakuan yang memadai untuk bentang standar.

## Verdict RancangLoka
Secara keseluruhan, kusen ini layak dipertimbangkan jika anggaran terbatas namun menginginkan presisi pabrik.
    `;

    const result = evaluateHumanWritingQuality(draftWithVerdict);

    const verdictIssue = result.issues.find(i => i.code === 'PROHIBITED_JARGON_VERDICT');
    assert.ok(verdictIssue, 'Expected PROHIBITED_JARGON_VERDICT issue to be present');
    assert.strictEqual(verdictIssue.severity, 'WARNING');
    assert.ok(verdictIssue.description.includes('Penilaian RancangLoka') || verdictIssue.description.includes('Rekomendasi'));
    assert.ok(verdictIssue.occurrences.some(o => /verdict/i.test(o)));
  });

  await test('Draft using "Penilaian RancangLoka" or "Rekomendasi Akhir" has ZERO jargon warnings', () => {
    const cleanDraft = `
# Review Profil Kusen Aluminium Alexindo

Kusen aluminium Alexindo sering menjadi rujukan awal bagi pemilik rumah di kawasan Jabodetabek.
Profil dengan ketebalan 1,1 mm hingga 1,3 mm ini memberikan kekakuan yang memadai untuk bentang standar.

## Penilaian RancangLoka
Secara keseluruhan, kusen ini layak dipertimbangkan jika anggaran terbatas namun menginginkan presisi pabrik.

## Rekomendasi untuk Kondisi Anda
Pilihan yang lebih cocok untuk area tepi pantai adalah profil dengan finishing anodized berkualitas tinggi.
    `;

    const result = evaluateHumanWritingQuality(cleanDraft);

    const verdictIssue = result.issues.find(i => i.code === 'PROHIBITED_JARGON_VERDICT');
    assert.strictEqual(verdictIssue, undefined, 'Clean draft must not produce PROHIBITED_JARGON_VERDICT');
  });

  // --- SECTION 3: User-Facing Runtime Normalizer ---
  console.log('\n--- TEST SECTION 3: User-Facing Runtime Normalizer ---');

  await test('normalizeUserFacingTerminology replaces all contextual variants cleanly', () => {
    const text1 = 'Berikut adalah Verdict RancangLoka mengenai profil ini.';
    assert.strictEqual(normalizeUserFacingTerminology(text1), 'Berikut adalah Rekomendasi RancangLoka mengenai profil ini.');

    const text2 = '## Final Verdict';
    assert.strictEqual(normalizeUserFacingTerminology(text2), '## Kesimpulan & Rekomendasi');

    const text3 = 'Inilah Verdict Produk untuk batch pengujian ini.';
    assert.strictEqual(normalizeUserFacingTerminology(text3), 'Inilah Rekomendasi Produk untuk batch pengujian ini.');

    const text4 = 'Bagian Verdict memberikan panduan keputusan.';
    assert.strictEqual(normalizeUserFacingTerminology(text4), 'Bagian Penilaian RancangLoka memberikan panduan keputusan.');

    const text5 = 'Memberikan verdict yang adil dan objektif.';
    assert.strictEqual(normalizeUserFacingTerminology(text5), 'Memberikan rekomendasi yang adil dan objektif.');
  });

  await test('extractTableOfContents normalizes any legacy verdict headings in TOC', () => {
    const htmlWithLegacyHeading = `
      <h2 id="karakter-fisik">Karakter Fisik Dasar</h2>
      <p>Pembahasan materi fisik.</p>
      <h2 id="verdict">Verdict RancangLoka</h2>
      <p>Penilaian redaksi.</p>
    `;

    const toc = extractTableOfContents(htmlWithLegacyHeading);
    assert.strictEqual(toc.length, 2);
    assert.strictEqual(toc[1].text, 'Rekomendasi RancangLoka');
    assert.ok(!toc[1].text.toLowerCase().includes('verdict'));
  });

  await test('processArticleContent normalizes rendered HTML and sanitizes correctly', () => {
    const rawHtml = `
      <p>Kusen aluminium memiliki sifat konduktif.</p>
      <h2>Verdict RancangLoka</h2>
      <p>Pilihlah sistem dengan thermal break untuk efisiensi pendinginan ruang.</p>
    `;

    const processed = processArticleContent(
      rawHtml,
      { id: 7, is_sponsored: 0, title: 'Ulasan Kusen' },
      [],
      {},
      []
    );

    assert.ok(!processed.toLowerCase().includes('verdict'));
    assert.ok(processed.includes('Rekomendasi RancangLoka'));
  });

  // --- SECTION 4: Repository-Level Static Scan ---
  console.log('\n--- TEST SECTION 4: Static Scans on Fixtures & Templates ---');

  await test('Canonical fixture article5_canonical.json contains zero occurrences of verdict', () => {
    const fixturePath = path.resolve(process.cwd(), 'scripts/fixtures/article5_canonical.json');
    const content = fs.readFileSync(fixturePath, 'utf8');
    assert.ok(!/verdict/i.test(content), 'article5_canonical.json must not contain any case-insensitive verdict');
  });

  await test('Public user-facing Astro pages contain zero occurrences of verdict in markup', () => {
    const publicPages = [
      'src/pages/index.astro',
      'src/pages/[slug].astro',
      'src/pages/kategori/[category].astro',
      'src/pages/search.astro'
    ];

    for (const pageRel of publicPages) {
      const pagePath = path.resolve(process.cwd(), pageRel);
      if (fs.existsSync(pagePath)) {
        const content = fs.readFileSync(pagePath, 'utf8');
        // Check HTML template portion (after second --- frontmatter delimiter)
        const parts = content.split('---');
        const template = parts.length >= 3 ? parts.slice(2).join('---') : content;
        assert.ok(
          !/\bverdict\b/i.test(template),
          `Template ${pageRel} must not contain user-facing 'verdict' in template HTML`
        );
      }
    }
  });

  await test('Editorial Knowledge Master Document docs/RANCANGLOKA_EDITORIAL_KNOWLEDGE_V1.md defines verdict ban', () => {
    const docPath = path.resolve(process.cwd(), 'docs/RANCANGLOKA_EDITORIAL_KNOWLEDGE_V1.md');
    assert.ok(fs.existsSync(docPath), 'Editorial knowledge document must exist');
    const content = fs.readFileSync(docPath, 'utf8');
    assert.ok(content.includes('verdict'), 'Document should mention verdict ban');
    assert.ok(content.includes('Penilaian RancangLoka'), 'Document should document replacement');
  });

  console.log(`\n===========================================================`);
  console.log(`🏁 Verdict Guard Test Suite Finished: ${passed} Passed, 0 Failed`);
  console.log(`===========================================================\n`);
}

main().catch(err => {
  console.error('\n❌ TEST SUITE FAILED:', err);
  process.exit(1);
});
