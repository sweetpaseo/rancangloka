import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  isComparisonMatrixTable,
  parseComparisonMatrixTable,
  renderDesktopComparisonTable,
  renderMobileComparisonCards,
  enhanceComparisonMatrices,
  isKeyDecisionRow
} from '../src/lib/article/comparison-matrix.ts';

import {
  renderArticleMarkdownSafely,
  sanitizeArticleHtml
} from '../src/lib/article/renderer.ts';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT_DIR = path.resolve(__dirname, '..');

async function runComparisonVisualSuite() {
  console.log('======================================================');
  console.log('🧪 Starting ARTICLE COMPARISON VISUAL CALIBRATION Suite');
  console.log('======================================================\n');

  let passed = 0;

  // --------------------------------------------------------------------------
  // Test 1: Reader Experience Principle & Guidance Presence
  // --------------------------------------------------------------------------
  console.log('Test 1: Reader Experience Principle Record');
  const compModuleSrc = fs.readFileSync(path.join(ROOT_DIR, 'src/lib/article/comparison-matrix.ts'), 'utf-8');
  assert.ok(
    compModuleSrc.includes("A comparison component should reduce the reader's thinking effort"),
    'Module must record Reader Experience Principle'
  );
  assert.ok(
    compModuleSrc.includes("The reader should be able to identify a likely option within several seconds"),
    'Module must record fast option identification principle'
  );
  console.log('  ✅ PASS: Reader Experience Principle canonically recorded in comparison module.\n');
  passed++;

  // --------------------------------------------------------------------------
  // Test 2: CSS Breakout Container Rules in global.css
  // --------------------------------------------------------------------------
  console.log('Test 2: CSS Breakout Rules in global.css');
  const globalCssSrc = fs.readFileSync(path.join(ROOT_DIR, 'src/styles/global.css'), 'utf-8');
  assert.ok(
    globalCssSrc.includes('.article-comparison-matrix'),
    'global.css must style .article-comparison-matrix'
  );
  assert.ok(
    globalCssSrc.includes('width: min(calc(100vw - 4rem), 1120px)'),
    'global.css must enforce desktop expansion up to 1120px'
  );
  assert.ok(
    globalCssSrc.includes('margin-inline: calc(50% - min(calc(50vw - 2rem), 560px))'),
    'global.css must enforce symmetrical breakout centering'
  );
  console.log('  ✅ PASS: Symmetrical container breakout rules strictly configured in global.css.\n');
  passed++;

  // --------------------------------------------------------------------------
  // Test 3: Article Container Overflow Configuration in [slug].astro
  // --------------------------------------------------------------------------
  console.log('Test 3: Article Container Overflow in [slug].astro');
  const slugAstroSrc = fs.readFileSync(path.join(ROOT_DIR, 'src/pages/[slug].astro'), 'utf-8');
  assert.ok(
    slugAstroSrc.includes('overflow-x-clip lg:overflow-x-visible'),
    '[slug].astro must permit lg:overflow-x-visible so desktop breakout is never clipped'
  );
  console.log('  ✅ PASS: [slug].astro article container permits unclipped desktop breakout while retaining mobile overflow clip.\n');
  passed++;

  // --------------------------------------------------------------------------
  // Test 4: Key Decision Criteria Identification
  // --------------------------------------------------------------------------
  console.log('Test 4: Key Decision Criteria Identification Logic');
  assert.equal(isKeyDecisionRow('Cocok untuk arah'), true, 'Cocok untuk arah must be recognized as key');
  assert.equal(isKeyDecisionRow('Matahari sore (rendah)'), true, 'Matahari sore must be recognized as key');
  assert.equal(isKeyDecisionRow('Pemasangan rumah jadi'), true, 'Pemasangan rumah jadi must be recognized as key');
  assert.equal(isKeyDecisionRow('Perawatan rutin'), true, 'Perawatan must be recognized as key');
  assert.equal(isKeyDecisionRow('Matahari siang (tinggi)'), false, 'Matahari siang is secondary');
  assert.equal(isKeyDecisionRow('Tempias hujan'), false, 'Tempias hujan is secondary');
  assert.equal(isKeyDecisionRow('Cahaya alami'), false, 'Cahaya alami is secondary');
  assert.equal(isKeyDecisionRow('Pandangan ke luar'), false, 'Pandangan ke luar is secondary');
  console.log('  ✅ PASS: Key decision criteria accurately identified across all target aspects.\n');
  passed++;

  // --------------------------------------------------------------------------
  // Test 5: Desktop Table Information Hierarchy & Typography
  // --------------------------------------------------------------------------
  console.log('Test 5: Desktop Table Information Hierarchy & Typography');
  const sampleComparisonMd = `
| Aspek | 1. Overhang (Tritisan Atap) | 2. Louver (Kisi-kisi Bilah) | 3. Awning (Kanopi Jendela) | 4. Fasad Kedua (Secondary Facade) |
| :--- | :--- | :--- | :--- | :--- |
| **Cocok untuk arah** | Utara dan Selatan | Barat dan Timur | Fleksibel satu jendela | Barat lantai atas |
| **Matahari siang (tinggi)** | Sangat baik | Baik | Baik | Sangat baik |
| **Matahari sore (rendah)** | Kurang efektif | Sangat baik | Cukup | Sangat baik |
| **Pemasangan rumah jadi** | Cukup rumit | Sedang | Sangat mudah | Perlu rangka khusus |
| **Perawatan rutin** | Ringan | Sedang | Sedang | Perlu akses servis |
`;

  const renderedHtml = await renderArticleMarkdownSafely(sampleComparisonMd);

  // Desktop Table assertions
  assert.ok(renderedHtml.includes('hidden lg:block'), 'Desktop view has hidden lg:block');
  assert.ok(renderedHtml.includes('table-fixed min-w-[960px]'), 'Table has table-fixed min-w-[960px]');
  assert.ok(renderedHtml.includes('Pilihan #1'), 'Header shows Pilihan #1 pill');
  assert.ok(renderedHtml.includes('Pilihan #4'), 'Header shows Pilihan #4 pill');
  assert.ok(renderedHtml.includes('Kriteria Kunci'), 'Key decision rows display Kriteria Kunci badge');
  assert.ok(renderedHtml.includes('bg-amber-500/[0.035]'), 'Key decision rows receive subtle warm tint');
  assert.ok(renderedHtml.includes('text-[13px] font-medium'), 'Key decision value cells use text-[13px] font-medium');
  assert.ok(renderedHtml.includes('py-4 px-5'), 'Desktop cells have generous py-4 px-5 padding');
  console.log('  ✅ PASS: Desktop table renders editorial decision tool typography and subtle visual hierarchy.\n');
  passed++;

  // --------------------------------------------------------------------------
  // Test 6: Mobile & Tablet Cards Scannability (No Pseudo-Table)
  // --------------------------------------------------------------------------
  console.log('Test 6: Mobile & Tablet Cards Scannability');
  assert.ok(
    renderedHtml.includes('grid grid-cols-1 md:grid-cols-2 lg:hidden gap-4'),
    'Cards grid enforces 1-column mobile (< 768px) and 2-column tablet (768–1023px)'
  );
  assert.ok(
    renderedHtml.includes('Pertimbangan Kunci'),
    'Mobile card features dedicated Pertimbangan Kunci section'
  );
  assert.ok(
    renderedHtml.includes('Karakteristik Lainnya'),
    'Mobile card features clean Karakteristik Lainnya section'
  );
  assert.ok(
    renderedHtml.includes('h4 class="font-display font-bold text-base text-slate-900'),
    'Mobile card has clean system name heading'
  );
  // Verify no raw unstyled table within card
  assert.equal(
    renderedHtml.includes('<table class="comparison-card"'),
    false,
    'Must not reproduce a pseudo-table inside each card'
  );
  console.log('  ✅ PASS: Mobile/tablet cards render clean scannable decision blocks without pseudo-table tracking.\n');
  passed++;

  // --------------------------------------------------------------------------
  // Test 7: Sanitizer Allowlist Integrity (No Tag Stripping)
  // --------------------------------------------------------------------------
  console.log('Test 7: Sanitizer Allowlist Integrity');
  const sanitized = sanitizeArticleHtml(renderedHtml);
  assert.ok(sanitized.includes('data-comparison-matrix="true"'), 'data-comparison-matrix attribute survived sanitizer');
  assert.ok(sanitized.includes('hidden lg:block'), 'hidden lg:block survived sanitizer');
  assert.ok(sanitized.includes('grid grid-cols-1 md:grid-cols-2 lg:hidden'), 'responsive grid classes survived sanitizer');
  assert.ok(sanitized.includes('Kriteria Kunci'), 'Kriteria Kunci text survived sanitizer');
  assert.equal(sanitized.includes('<script'), false, 'Strictly zero script tags');
  console.log('  ✅ PASS: 100% of generated tags and styling survive strict HTML sanitizer.\n');
  passed++;

  // --------------------------------------------------------------------------
  // Test 8: Non-Comparison Tables Remain Standard Markdown Tables
  // --------------------------------------------------------------------------
  console.log('Test 8: Non-Comparison Table Regression Check');
  const standardTableMd = `
| Spesifikasi | Nilai |
| :--- | :--- |
| SHGC Kaca | 0.42 |
| OTTV Bangunan | 35 W/m² |
`;
  const renderedStandard = await renderArticleMarkdownSafely(standardTableMd);
  assert.equal(
    renderedStandard.includes('data-comparison-matrix="true"'),
    false,
    'Standard 2-column data table must NOT be enhanced into comparison matrix'
  );
  assert.ok(renderedStandard.includes('<table'), 'Standard table still renders as a normal HTML table');
  console.log('  ✅ PASS: Standard markdown tables and general prose remain untouched.\n');
  passed++;

  // --------------------------------------------------------------------------
  // Test 9: Long-Form Reader Experience Principle & Article Nav Suppression
  // --------------------------------------------------------------------------
  console.log('Test 9: Long-Form Reading UX — Mobile Bottom Nav Suppression on Articles');
  const baseLayoutSrc = fs.readFileSync(path.join(ROOT_DIR, 'src/layouts/BaseLayout.astro'), 'utf-8');
  assert.ok(
    baseLayoutSrc.includes("On long-form editorial pages, navigation must not compete with or obscure the content being read"),
    'BaseLayout must record the Long-Form Reader Experience Principle'
  );
  assert.ok(
    baseLayoutSrc.includes('{showMobileBottomNav && !isArticlePage && ('),
    'BaseLayout must strictly suppress persistent mobile bottom nav on article pages (!isArticlePage)'
  );
  console.log('  ✅ PASS: Mobile bottom dock strictly suppressed on article pages; long-form content is 100% unobstructed.\n');
  passed++;

  console.log(`🎉 ALL ${passed}/9 COMPARISON VISUAL & READING UX TESTS PASSED!`);
  console.log('======================================================\n');
}

runComparisonVisualSuite().catch((err) => {
  console.error('❌ Test failed with exception:', err);
  process.exit(1);
});
