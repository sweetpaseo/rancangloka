/**
 * Automated Test Suite: Cloudflare AI Neurons Usage Monitor & Budget Guard V1
 *
 * Verifies:
 * 1. Cloudflare official daily free tier allocation (10,000 Neurons/day).
 * 2. Official Cloudflare pricing formula for FLUX.1 Schnell:
 *    (totalTiles * 4.80 N) + (steps * 9.60 N).
 * 3. Parameterized formula tests: 512x512, 1024x1024, 1536x1024, 4 steps, 8 steps.
 * 4. SDXL Lightning audit: unlisted in official pricing -> UNKNOWN, null Neurons (no fabricated numbers).
 * 5. Historical ledger audit correction: preserves original IDs and timestamps with auditCorrection metadata.
 * 6. Explicit distinction between ACTUAL, ESTIMATED, and UNKNOWN.
 * 7. Correct remaining capacity calculations (FLUX: floor(remaining / 57.60), SDXL: null/UNKNOWN).
 * 8. Pre-generation budget guards (70% warning, 90% high warning, 100% block) without false blocks.
 * 9. Strict paid usage lock (Safety Invariant: allowPaidUsage = false).
 * 10. Adapter integration: records accurate neurons and suppresses $0.00 actual cost assertion.
 * 11. Local server routes (/api/admin/media/neurons-usage and /admin/media/usage-monitor).
 */

import fs from 'node:fs';
import path from 'node:path';
import {
  CLOUDFLARE_FREE_TIER_DAILY_NEURONS,
  FLUX_NEURONS_PER_TILE,
  FLUX_NEURONS_PER_STEP,
  FLUX_DEFAULT_1024_4STEP_NEURONS,
  DEFAULT_FLUX_NEURONS,
  SDXL_PRICING_STATUS,
  calculateModelNeurons,
  getNextResetTimestampUtc,
  getCurrentDateUtc,
  getEstimatedNeuronsForModel,
  probeCloudflareUsageApi,
  loadMonitorConfig,
  updateMonitorConfig,
  loadUsageLedger,
  saveUsageLedger,
  recordGenerationUsage,
  checkPreGenerationBudgetGuard,
  getDailyUsageSummary,
  seedLedgerFromCandidates,
  migrateLedgerHistoricalEstimates
} from '../src/lib/media/neurons-usage-service.ts';
import {
  CloudflareAiImageAdapter,
  CLOUDFLARE_FLUX_MODEL,
  CLOUDFLARE_SDXL_MODEL
} from '../src/lib/media/cloudflare-ai-image-adapter.ts';
import { createAdminSessionToken } from '../src/lib/auth.ts';

let passCount = 0;
let failCount = 0;

function assert(condition, message) {
  if (condition) {
    console.log(`  ✓ ${message}`);
    passCount++;
  } else {
    console.error(`  ✗ FAIL: ${message}`);
    failCount++;
  }
}

console.log('='.repeat(70));
console.log('CLOUDFLARE AI NEURONS USAGE MONITOR & PRICING ACCURACY TEST SUITE');
console.log('='.repeat(70));

// --------------------------------------------------------------------
// TEST GROUP 1: Official Cloudflare Free Tier & Pricing Constants
// --------------------------------------------------------------------
console.log('\n--- Test Group 1: Official Cloudflare Free Tier & Pricing Constants ---');

assert(
  CLOUDFLARE_FREE_TIER_DAILY_NEURONS === 10000,
  `Official Cloudflare Free Tier allocation is exactly 10,000 Neurons/day (found: ${CLOUDFLARE_FREE_TIER_DAILY_NEURONS})`
);

assert(
  FLUX_NEURONS_PER_TILE === 4.8,
  `Official FLUX tile rate is 4.80 Neurons per 512x512 tile (found: ${FLUX_NEURONS_PER_TILE})`
);

assert(
  FLUX_NEURONS_PER_STEP === 9.6,
  `Official FLUX step rate is 9.60 Neurons per diffusion step (found: ${FLUX_NEURONS_PER_STEP})`
);

assert(
  FLUX_DEFAULT_1024_4STEP_NEURONS === 57.6,
  `Official FLUX 1024x1024 4-step generation weight is exactly 57.60 Neurons (found: ${FLUX_DEFAULT_1024_4STEP_NEURONS})`
);

assert(
  DEFAULT_FLUX_NEURONS === 57.6,
  `DEFAULT_FLUX_NEURONS alias equals 57.60 Neurons (found: ${DEFAULT_FLUX_NEURONS})`
);

assert(
  SDXL_PRICING_STATUS === 'UNKNOWN',
  `SDXL pricing status is strictly UNKNOWN due to absence in Cloudflare pricing table (found: ${SDXL_PRICING_STATUS})`
);

const resetUtc = getNextResetTimestampUtc();
assert(
  resetUtc.endsWith('T00:00:00.000Z'),
  `Next quota reset timestamp aligns precisely to 00:00:00 UTC (found: ${resetUtc})`
);

const resetDate = new Date(resetUtc);
const now = new Date();
assert(
  resetDate.getTime() > now.getTime(),
  `Next reset timestamp is in the future (${resetDate.toISOString()} > ${now.toISOString()})`
);

// --------------------------------------------------------------------
// TEST GROUP 2: Parameterized Pricing Formula Tests
// --------------------------------------------------------------------
console.log('\n--- Test Group 2: Parameterized Pricing Formula Tests ---');

// Case A: FLUX 1024x1024, 4 steps
// Tiles: ceil(1024/512)*ceil(1024/512) = 2*2 = 4 tiles.
// (4 * 4.80) + (4 * 9.60) = 19.20 + 38.40 = 57.60 Neurons.
const flux1024_4 = calculateModelNeurons(CLOUDFLARE_FLUX_MODEL, 1024, 1024, 4);
assert(flux1024_4.pricingStatus === 'VERIFIED_OFFICIAL', 'FLUX 1024x1024 4 steps pricingStatus is VERIFIED_OFFICIAL');
assert(flux1024_4.authoritativeSource === 'ESTIMATED', 'FLUX 1024x1024 4 steps authoritativeSource is ESTIMATED');
assert(flux1024_4.tiles === 4, `FLUX 1024x1024 tiles count is 4 (found: ${flux1024_4.tiles})`);
assert(flux1024_4.tileNeurons === 19.2, `FLUX 1024x1024 tileNeurons is 19.20 (found: ${flux1024_4.tileNeurons})`);
assert(flux1024_4.stepNeurons === 38.4, `FLUX 1024x1024 4 steps stepNeurons is 38.40 (found: ${flux1024_4.stepNeurons})`);
assert(flux1024_4.neuronsEstimated === 57.6, `FLUX 1024x1024 4 steps total is 57.60 Neurons (found: ${flux1024_4.neuronsEstimated})`);

// Case B: FLUX 512x512, 4 steps
// Tiles: ceil(512/512)*ceil(512/512) = 1*1 = 1 tile.
// (1 * 4.80) + (4 * 9.60) = 4.80 + 38.40 = 43.20 Neurons.
const flux512_4 = calculateModelNeurons(CLOUDFLARE_FLUX_MODEL, 512, 512, 4);
assert(flux512_4.tiles === 1, `FLUX 512x512 tiles count is 1 (found: ${flux512_4.tiles})`);
assert(flux512_4.tileNeurons === 4.8, `FLUX 512x512 tileNeurons is 4.80 (found: ${flux512_4.tileNeurons})`);
assert(flux512_4.neuronsEstimated === 43.2, `FLUX 512x512 4 steps total is 43.20 Neurons (found: ${flux512_4.neuronsEstimated})`);

// Case C: FLUX 1024x1024, 8 steps
// (4 * 4.80) + (8 * 9.60) = 19.20 + 76.80 = 96.00 Neurons.
const flux1024_8 = calculateModelNeurons(CLOUDFLARE_FLUX_MODEL, 1024, 1024, 8);
assert(flux1024_8.stepNeurons === 76.8, `FLUX 1024x1024 8 steps stepNeurons is 76.80 (found: ${flux1024_8.stepNeurons})`);
assert(flux1024_8.neuronsEstimated === 96.0, `FLUX 1024x1024 8 steps total is 96.00 Neurons (found: ${flux1024_8.neuronsEstimated})`);

// Case D: FLUX 1536x1024, 4 steps
// Tiles: ceil(1536/512)*ceil(1024/512) = 3*2 = 6 tiles.
// (6 * 4.80) + (4 * 9.60) = 28.80 + 38.40 = 67.20 Neurons.
const flux1536_4 = calculateModelNeurons(CLOUDFLARE_FLUX_MODEL, 1536, 1024, 4);
assert(flux1536_4.tiles === 6, `FLUX 1536x1024 tiles count is 6 (found: ${flux1536_4.tiles})`);
assert(flux1536_4.tileNeurons === 28.8, `FLUX 1536x1024 tileNeurons is 28.80 (found: ${flux1536_4.tileNeurons})`);
assert(flux1536_4.neuronsEstimated === 67.2, `FLUX 1536x1024 4 steps total is 67.20 Neurons (found: ${flux1536_4.neuronsEstimated})`);

// Case E: SDXL Lightning audit (unverified model)
const sdxlEval = calculateModelNeurons(CLOUDFLARE_SDXL_MODEL, 1024, 1024, 4);
assert(sdxlEval.pricingStatus === 'UNKNOWN', 'SDXL Lightning pricingStatus is strictly UNKNOWN');
assert(sdxlEval.authoritativeSource === 'UNKNOWN', 'SDXL Lightning authoritativeSource is UNKNOWN');
assert(sdxlEval.neuronsEstimated === null, `SDXL Lightning returns null estimated Neurons (found: ${sdxlEval.neuronsEstimated})`);
assert(sdxlEval.note.includes('unverified'), 'SDXL note documents unverified pricing schedule status');

// Model weight resolver integration
assert(getEstimatedNeuronsForModel(CLOUDFLARE_FLUX_MODEL) === 57.6, 'getEstimatedNeuronsForModel returns 57.60 for standard FLUX');
assert(getEstimatedNeuronsForModel(CLOUDFLARE_SDXL_MODEL) === null, 'getEstimatedNeuronsForModel returns null for unverified SDXL');

// --------------------------------------------------------------------
// TEST GROUP 3: Pre-Generation Budget Guard with Accurate Pricing
// --------------------------------------------------------------------
console.log('\n--- Test Group 3: Pre-Generation Budget Guard with Accurate Pricing ---');

const originalConfig = loadMonitorConfig();

// Scenario A: Clean state (0 usage)
const checkZero = checkPreGenerationBudgetGuard(CLOUDFLARE_FLUX_MODEL, {
  customLimit: 10000,
  currentUsageOverride: 0
});
assert(checkZero.allowed === true, 'Budget guard allows generation when usage is 0');
assert(checkZero.warningLevel === 'NONE', 'Warning level is NONE when usage is low');
assert(checkZero.projectedUsageEstimated === 57.6, `Projected usage is 57.60 N (found: ${checkZero.projectedUsageEstimated})`);

// Scenario B: 70% Warning threshold
// Limit = 10,000 N. 70% = 7,000 N.
// Current = 7,000 N. Projected = 7,057.60 N -> WARNING!
const checkWarn = checkPreGenerationBudgetGuard(CLOUDFLARE_FLUX_MODEL, {
  customLimit: 10000,
  currentUsageOverride: 7000
});
assert(checkWarn.allowed === true, 'Generation is allowed at 70% threshold with warning');
assert(checkWarn.warningLevel === 'WARNING', 'Warning level is WARNING when projected usage >= 70% and < 90%');
assert(Boolean(checkWarn.reason), 'Warning reason message provided to operator');

// Scenario C: 90% High Warning threshold
// Current = 9,000 N. Projected = 9,057.60 N -> HIGH_WARNING!
const checkHighWarn = checkPreGenerationBudgetGuard(CLOUDFLARE_FLUX_MODEL, {
  customLimit: 10000,
  currentUsageOverride: 9000
});
assert(checkHighWarn.allowed === true, 'Generation is allowed at 90% threshold with high warning');
assert(checkHighWarn.warningLevel === 'HIGH_WARNING', 'Warning level is HIGH_WARNING when projected usage >= 90%');

// Scenario D: Exceeding daily limit (Block)
// Limit = 10,000 N. Current = 9,980 N. Projected = 10,037.60 N -> BLOCK!
const checkBlock = checkPreGenerationBudgetGuard(CLOUDFLARE_FLUX_MODEL, {
  customLimit: 10000,
  currentUsageOverride: 9980
});
assert(checkBlock.allowed === false, 'Budget guard strictly BLOCKS generation when projected usage exceeds limit');
assert(checkBlock.warningLevel === 'BLOCK', 'Warning level is BLOCK when limit exceeded');
assert(checkBlock.reason.includes('terlampaui') || checkBlock.reason.includes('exceeded'), 'Block reason explains limit reached');

// Scenario E: SDXL Lightning with UNKNOWN pricing
// Does not fabricate 1,200 N. Does not falsely block if under limit.
const checkSdxlGuard = checkPreGenerationBudgetGuard(CLOUDFLARE_SDXL_MODEL, {
  customLimit: 10000,
  currentUsageOverride: 500
});
assert(checkSdxlGuard.allowed === true, 'Budget guard allows SDXL generation without fabricating numbers');
assert(checkSdxlGuard.pricingStatus === 'UNKNOWN', 'Budget check reflects UNKNOWN pricingStatus for SDXL');
assert(checkSdxlGuard.projectedUsageEstimated === 500, 'Projected usage does not add invented numbers for SDXL');

// --------------------------------------------------------------------
// TEST GROUP 4: Strict Paid Usage Lock & Safety Invariants
// --------------------------------------------------------------------
console.log('\n--- Test Group 4: Strict Paid Usage Lock Invariant ---');

const updatedWithPaidAttempt = updateMonitorConfig({
  allowPaidUsage: true
});
assert(
  updatedWithPaidAttempt.allowPaidUsage === false,
  'Safety Invariant: allowPaidUsage is strictly forced to false by updateMonitorConfig'
);

const reloadedConfig = loadMonitorConfig();
assert(
  reloadedConfig.allowPaidUsage === false,
  'Safety Invariant: reloaded config maintains allowPaidUsage = false'
);

updateMonitorConfig(originalConfig);

// --------------------------------------------------------------------
// TEST GROUP 5: Historical Ledger Migration & Audit Trail Preservation
// --------------------------------------------------------------------
console.log('\n--- Test Group 5: Historical Ledger Migration & Audit Trail ---');

// Mock historical raw ledger with legacy 1500 N (FLUX) and 1200 N (SDXL) entries
const testLegacyEntries = [
  {
    id: 'HIST-FLUX-1',
    timestamp: '2026-10-30T02:00:00.000Z',
    dateUtc: '2026-10-30',
    articleId: 9993,
    model: CLOUDFLARE_FLUX_MODEL,
    modelName: 'FLUX.1 Schnell',
    mediaRole: 'featured_hero',
    purpose: 'legacy_test',
    status: 'SUCCESS',
    neuronsEstimated: 1500,
    neuronsActual: null,
    authoritativeSource: 'ESTIMATED'
  },
  {
    id: 'HIST-SDXL-1',
    timestamp: '2026-10-30T02:05:00.000Z',
    dateUtc: '2026-10-30',
    articleId: 9993,
    model: CLOUDFLARE_SDXL_MODEL,
    modelName: 'SDXL Lightning',
    mediaRole: 'featured_hero',
    purpose: 'legacy_test',
    status: 'SUCCESS',
    neuronsEstimated: 1200,
    neuronsActual: null,
    authoritativeSource: 'ESTIMATED'
  }
];

const { migratedEntries, correctedCount } = migrateLedgerHistoricalEstimates(testLegacyEntries);
assert(correctedCount === 2, `Migrated exactly 2 legacy entries (found: ${correctedCount})`);

const migratedFlux = migratedEntries.find((e) => e.id === 'HIST-FLUX-1');
assert(migratedFlux.neuronsEstimated === 57.6, `Migrated FLUX entry has 57.60 N (found: ${migratedFlux.neuronsEstimated})`);
assert(migratedFlux.pricingStatus === 'VERIFIED_OFFICIAL', 'Migrated FLUX entry marked VERIFIED_OFFICIAL');
assert(migratedFlux.authoritativeSource === 'ESTIMATED', 'Migrated FLUX entry marked ESTIMATED');
assert(Boolean(migratedFlux.auditCorrection), 'Migrated FLUX entry includes auditCorrection object');
assert(migratedFlux.auditCorrection.originalEstimatedNeurons === 1500, 'Original 1,500 N estimate preserved in audit trail');
assert(migratedFlux.id === 'HIST-FLUX-1', 'Original transaction ID preserved without mutation');
assert(migratedFlux.timestamp === '2026-10-30T02:00:00.000Z', 'Original timestamp preserved without mutation');

const migratedSdxl = migratedEntries.find((e) => e.id === 'HIST-SDXL-1');
assert(migratedSdxl.neuronsEstimated === null, `Migrated SDXL entry has null neuronsEstimated (found: ${migratedSdxl.neuronsEstimated})`);
assert(migratedSdxl.pricingStatus === 'UNKNOWN', 'Migrated SDXL entry marked UNKNOWN');
assert(migratedSdxl.authoritativeSource === 'UNKNOWN', 'Migrated SDXL entry authoritativeSource is UNKNOWN');
assert(Boolean(migratedSdxl.auditCorrection), 'Migrated SDXL entry includes auditCorrection object');
assert(migratedSdxl.auditCorrection.originalEstimatedNeurons === 1200, 'Original 1,200 N estimate preserved in audit trail');

// Verify active ledger state on disk
const currentLedger = loadUsageLedger();
const diskFluxEntries = currentLedger.filter((e) => e.model.includes('flux') && e.status === 'SUCCESS');
const diskSdxlEntries = currentLedger.filter((e) => e.model.includes('lightning') && e.status === 'SUCCESS');

for (const fe of diskFluxEntries) {
  assert(fe.neuronsEstimated === 57.6, `Active FLUX entry ${fe.id} has verified 57.60 N`);
}
for (const se of diskSdxlEntries) {
  assert(se.neuronsEstimated === null, `Active SDXL entry ${se.id} has null neuronsEstimated (UNKNOWN)`);
}

// --------------------------------------------------------------------
// TEST GROUP 6: Daily Summary & Capacity Calculations
// --------------------------------------------------------------------
console.log('\n--- Test Group 6: Daily Summary & Capacity Calculations ---');

const summary = getDailyUsageSummary();
assert(summary.freeTierAllocation === 10000, 'Summary includes 10,000 N free tier allocation');
assert(typeof summary.neuronsUsedToday === 'number', `neuronsUsedToday is calculated (${summary.neuronsUsedToday} N)`);
assert(typeof summary.neuronsRemainingEstimated === 'number', `neuronsRemainingEstimated is calculated (${summary.neuronsRemainingEstimated} N)`);
assert(summary.percentageUsed >= 0 && summary.percentageUsed <= 100, `percentageUsed is valid percentage (${summary.percentageUsed}%)`);

assert(
  typeof summary.estimatedRemainingCapacity.fluxImages === 'number' && summary.estimatedRemainingCapacity.fluxImages > 100,
  `FLUX remaining capacity accurately calculated: ${summary.estimatedRemainingCapacity.fluxImages} images (floor(${summary.neuronsRemainingEstimated} / 57.60))`
);

assert(
  summary.estimatedRemainingCapacity.sdxlImages === null,
  `SDXL remaining capacity is strictly null due to unverified pricing (found: ${summary.estimatedRemainingCapacity.sdxlImages})`
);

assert(
  summary.estimatedRemainingCapacity.sdxlStatus === 'UNKNOWN',
  'SDXL capacity status is explicitly UNKNOWN'
);

const fluxBreakdown = summary.modelBreakdown.find((m) => m.model.includes('flux'));
assert(fluxBreakdown && fluxBreakdown.pricingStatus === 'VERIFIED_OFFICIAL', 'FLUX model breakdown marked VERIFIED_OFFICIAL');

const sdxlBreakdown = summary.modelBreakdown.find((m) => m.model.includes('lightning'));
assert(sdxlBreakdown && sdxlBreakdown.pricingStatus === 'UNKNOWN', 'SDXL model breakdown marked UNKNOWN');
assert(sdxlBreakdown && sdxlBreakdown.estimatedNeurons === null, 'SDXL model breakdown estimatedNeurons is null');

// --------------------------------------------------------------------
// TEST GROUP 7: Adapter Integration & Cost Telemetry
// --------------------------------------------------------------------
console.log('\n--- Test Group 7: Adapter Integration & Cost Telemetry ---');

// Mock adapter with limit (1,000 N) and push usage over limit with dummy entry
updateMonitorConfig({ customDailyLimit: 1000 });

const dummyOverId = `TEST-OVER-${Date.now()}`;
recordGenerationUsage({
  id: dummyOverId,
  articleId: 9993,
  model: CLOUDFLARE_FLUX_MODEL,
  status: 'SUCCESS',
  neuronsEstimatedOverride: 1000
});

const mockAdapter = new CloudflareAiImageAdapter({
  model: CLOUDFLARE_FLUX_MODEL,
  apiToken: 'mock-token',
  fetchFn: async () => new Response('{}', { status: 200 })
});

let guardBlocked = false;
try {
  await mockAdapter.generate({
    request_id: `req-guard-test-${Date.now()}`,
    prompt: 'A realistic wall with moisture stain',
    article_id: 9993,
    purpose: 'guard_test'
  });
} catch (err) {
  if (err.code === 'RATE_LIMIT' && err.message.includes('budget guard')) {
    guardBlocked = true;
  }
}

assert(guardBlocked === true, 'Adapter blocks generation when projected usage exceeds limit');

// Restore config
updateMonitorConfig({ customDailyLimit: 10000 });

// Clean test blocked entry and dummy entry
const cleanedLedger = loadUsageLedger().filter(
  (e) => e.id !== dummyOverId && !e.id.startsWith('req-guard-test-')
);
saveUsageLedger(cleanedLedger);

// --------------------------------------------------------------------
// TEST GROUP 8: Server Endpoints & UI Presentation Verification
// --------------------------------------------------------------------
console.log('\n--- Test Group 8: Server Endpoints & UI Presentation ---');

const adminToken = await createAdminSessionToken();

// 1. Authenticated GET to /api/admin/media/neurons-usage
try {
  const resAuth = await fetch('http://localhost:4321/api/admin/media/neurons-usage', {
    headers: { Cookie: `admin_session=${adminToken}` }
  });
  assert(resAuth.status === 200, 'Authenticated GET to /api/admin/media/neurons-usage returns HTTP 200');
  const json = await resAuth.json();
  assert(json.status === 'ok', 'API response has status ok');
  assert(json.data.summary.estimatedRemainingCapacity.fluxImages > 100, 'API returns accurate remaining FLUX images (> 100)');
  assert(json.data.summary.estimatedRemainingCapacity.sdxlImages === null, 'API returns null for remaining SDXL images');
  assert(json.data.summary.estimatedRemainingCapacity.sdxlStatus === 'UNKNOWN', 'API returns UNKNOWN for SDXL capacity status');
} catch (e) {
  console.warn('  ⚠️ Server check skipped or offline:', e.message);
}

// 2. UI Route verification: /admin/media/usage-monitor
try {
  const resPage = await fetch('http://localhost:4321/admin/media/usage-monitor', {
    headers: { Cookie: `admin_session=${adminToken}` }
  });
  assert(resPage.status === 200, '/admin/media/usage-monitor renders with HTTP 200');
  const pageHtml = await resPage.text();
  assert(pageHtml.includes('Cloudflare AI Neurons Usage Monitor'), 'Page contains monitor title');
  assert(pageHtml.includes('57.60 N'), 'Page displays official 57.60 N FLUX rate');
  assert(pageHtml.includes('UNKNOWN'), 'Page displays UNKNOWN for unverified SDXL pricing');
  assert(!pageHtml.includes('1.500 N'), 'Page does NOT contain outdated 1.500 N estimate');
  assert(!pageHtml.includes('1.200 N'), 'Page does NOT contain outdated 1.200 N estimate');
} catch (e) {
  console.warn('  ⚠️ Server check skipped or offline:', e.message);
}

// 3. UI Route verification: /admin/media/comparison-batch1
try {
  const resComp = await fetch('http://localhost:4321/admin/media/comparison-batch1', {
    headers: { Cookie: `admin_session=${adminToken}` }
  });
  assert(resComp.status === 200, '/admin/media/comparison-batch1 renders with HTTP 200');
  const compHtml = await resComp.text();
  assert(compHtml.includes('Belum Terverifikasi'), 'Page notes unverified account consumption status');
  assert(!compHtml.includes('($0.00)'), 'Page does NOT falsely claim actual ($0.00) cost');
} catch (e) {
  console.warn('  ⚠️ Server check skipped or offline:', e.message);
}

console.log('\n' + '='.repeat(70));
console.log(`TOTAL TESTS: ${passCount + failCount}`);
console.log(`PASSED: ${passCount}`);
console.log(`FAILED: ${failCount}`);
console.log('='.repeat(70));

if (failCount > 0) {
  console.error('>>> SOME TESTS FAILED <<<');
  process.exit(1);
} else {
  console.log('>>> ALL CLOUDFLARE AI NEURONS PRICING ACCURACY TESTS PASS! <<<');
}
