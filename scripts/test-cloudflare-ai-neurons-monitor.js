/**
 * Automated Test Suite: Cloudflare AI Neurons Usage Monitor & Budget Guard V1
 *
 * Verifies:
 * 1. Cloudflare official daily free tier allocation (10,000 Neurons/day).
 * 2. Next UTC reset timestamp calculation (00:00:00 UTC).
 * 3. Authoritative source labeling: ACTUAL vs ESTIMATED vs UNAVAILABLE.
 * 4. Model estimation weights and scope isolation.
 * 5. Pre-generation budget guard thresholds (70% warning, 90% high warning, 100% block).
 * 6. Custom daily limit enforcement.
 * 7. Prevention of double counting on retries, duplicates, and pre-network blocks.
 * 8. Strict paid usage lock (Safety Invariant: allowPaidUsage = false).
 * 9. Adapter integration with pre-generation guard and execution accounting.
 * 10. Local server routes (/api/admin/media/neurons-usage and /admin/media/usage-monitor).
 */

import fs from 'node:fs';
import path from 'node:path';
import {
  CLOUDFLARE_FREE_TIER_DAILY_NEURONS,
  DEFAULT_FLUX_NEURONS,
  DEFAULT_SDXL_NEURONS,
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
  seedLedgerFromCandidates
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
console.log('CLOUDFLARE AI NEURONS USAGE MONITOR & BUDGET GUARD V1 TEST SUITE');
console.log('='.repeat(70));

// --------------------------------------------------------------------
// TEST GROUP 1: Constants & Official Cloudflare Free Tier Verification
// --------------------------------------------------------------------
console.log('\n--- Test Group 1: Constants & Cloudflare Free Tier Verification ---');

assert(
  CLOUDFLARE_FREE_TIER_DAILY_NEURONS === 10000,
  `Official Cloudflare Free Tier allocation is exactly 10,000 Neurons/day (found: ${CLOUDFLARE_FREE_TIER_DAILY_NEURONS})`
);

assert(
  DEFAULT_FLUX_NEURONS === 1500,
  `FLUX.1 Schnell standard 4-step generation weight is ~1,500 Neurons (found: ${DEFAULT_FLUX_NEURONS})`
);

assert(
  DEFAULT_SDXL_NEURONS === 1200,
  `SDXL Lightning standard 4-step generation weight is ~1,200 Neurons (found: ${DEFAULT_SDXL_NEURONS})`
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
// TEST GROUP 2: Official API Probe & Telemetry Source Labeling
// --------------------------------------------------------------------
console.log('\n--- Test Group 2: Official API Probe & Source Labeling ---');

const probe = await probeCloudflareUsageApi();
assert(
  probe.available === false,
  'Official Cloudflare real-time daily free neuron REST API is unavailable'
);
assert(
  probe.authoritativeSource === 'UNAVAILABLE',
  'API probe authoritativeSource is marked UNAVAILABLE'
);
assert(
  typeof probe.reason === 'string' && probe.reason.length > 20,
  'Clear explanation documented for why local estimation ledger is authoritative'
);

// Verify model weight resolver
assert(
  getEstimatedNeuronsForModel(CLOUDFLARE_FLUX_MODEL) === 1500,
  'getEstimatedNeuronsForModel returns 1,500 for FLUX.1 Schnell'
);
assert(
  getEstimatedNeuronsForModel(CLOUDFLARE_SDXL_MODEL) === 1200,
  'getEstimatedNeuronsForModel returns 1,200 for SDXL Lightning'
);
assert(
  getEstimatedNeuronsForModel('@cf/stabilityai/stable-diffusion-xl-base-1.0') === 1200,
  'getEstimatedNeuronsForModel resolves other SDXL variants conservatively'
);

// --------------------------------------------------------------------
// TEST GROUP 3: Pre-Generation Budget Guard Thresholds
// --------------------------------------------------------------------
console.log('\n--- Test Group 3: Pre-Generation Budget Guard Thresholds ---');

// Backup original config and ledger
const originalConfig = loadMonitorConfig();
const originalLedger = loadUsageLedger();

// Test Scenario A: Clean state (0 usage)
const checkZero = checkPreGenerationBudgetGuard(CLOUDFLARE_FLUX_MODEL, {
  customLimit: 10000,
  currentUsageOverride: 0
});
assert(checkZero.allowed === true, 'Budget guard allows generation when usage is 0');
assert(checkZero.warningLevel === 'NONE', 'Warning level is NONE when usage is low');

// Test Scenario B: 70% Warning threshold
// 7,000 usage + 1,500 FLUX = 8,500 / 10,000 = 85%
const checkWarn = checkPreGenerationBudgetGuard(CLOUDFLARE_FLUX_MODEL, {
  customLimit: 10000,
  currentUsageOverride: 7000
});
assert(checkWarn.allowed === true, 'Generation is allowed at 70% threshold with warning');
assert(checkWarn.warningLevel === 'WARNING', 'Warning level is WARNING when projected usage >= 70% and < 90%');
assert(Boolean(checkWarn.reason), 'Warning reason message provided to operator');

// Test Scenario C: 90% High Warning threshold
// 8,500 usage + 1,200 SDXL = 9,700 / 10,000 = 97%
const checkHighWarn = checkPreGenerationBudgetGuard(CLOUDFLARE_SDXL_MODEL, {
  customLimit: 10000,
  currentUsageOverride: 8500
});
assert(checkHighWarn.allowed === true, 'Generation is allowed at 90% threshold with high warning');
assert(checkHighWarn.warningLevel === 'HIGH_WARNING', 'Warning level is HIGH_WARNING when projected usage >= 90%');

// Test Scenario D: Exceeding daily limit (Block)
// 9,500 usage + 1,500 FLUX = 11,000 / 10,000 = 110%
const checkBlock = checkPreGenerationBudgetGuard(CLOUDFLARE_FLUX_MODEL, {
  customLimit: 10000,
  currentUsageOverride: 9500
});
assert(checkBlock.allowed === false, 'Budget guard strictly BLOCKS generation when projected usage exceeds limit');
assert(checkBlock.warningLevel === 'BLOCK', 'Warning level is BLOCK when limit exceeded');
assert(checkBlock.reason.includes('terlampaui') || checkBlock.reason.includes('exceeded'), 'Block reason explains limit reached');

// Test Scenario E: Custom Daily Limit enforcement
// Custom limit = 5,000. Usage = 4,000. FLUX = 1,500. Total = 5,500 -> Blocked!
const checkCustomBlock = checkPreGenerationBudgetGuard(CLOUDFLARE_FLUX_MODEL, {
  customLimit: 5000,
  currentUsageOverride: 4000
});
assert(checkCustomBlock.allowed === false, 'Budget guard respects custom lower daily limit (5,000 N)');
assert(checkCustomBlock.configuredLimit === 5000, 'Configured limit reflects custom value');

// --------------------------------------------------------------------
// TEST GROUP 4: Strict Paid Usage Lock & Safety Invariants
// --------------------------------------------------------------------
console.log('\n--- Test Group 4: Strict Paid Usage Lock Invariant ---');

// Attempt to enable paid usage via updateMonitorConfig
const updatedWithPaidAttempt = updateMonitorConfig({
  allowPaidUsage: true // Malicious or mistaken attempt
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

// Restore original config
updateMonitorConfig(originalConfig);

// --------------------------------------------------------------------
// TEST GROUP 5: Double-Counting Prevention & Ledger Accounting
// --------------------------------------------------------------------
console.log('\n--- Test Group 5: Double Counting Prevention & Ledger Accounting ---');

const testGenId = `TEST-DEDUP-${Date.now()}`;

// 1. Initial success entry
const entry1 = recordGenerationUsage({
  id: testGenId,
  articleId: 9993,
  model: CLOUDFLARE_FLUX_MODEL,
  status: 'SUCCESS',
  latencyMs: 3200,
  httpStatus: 200
});
assert(entry1.id === testGenId, 'Entry recorded successfully');
assert(entry1.neuronsEstimated === 1500, 'FLUX generation consumes 1,500 estimated Neurons');
assert(entry1.authoritativeSource === 'ESTIMATED', 'Source is clearly marked ESTIMATED');

// 2. Duplicate generation ID should UPDATE, not create a second row
const ledgerAfterFirst = loadUsageLedger();
const countFirst = ledgerAfterFirst.filter((e) => e.id === testGenId).length;
assert(countFirst === 1, 'Exactly one record exists after first write');

const entry2 = recordGenerationUsage({
  id: testGenId,
  articleId: 9993,
  model: CLOUDFLARE_FLUX_MODEL,
  status: 'SUCCESS',
  latencyMs: 3500,
  httpStatus: 200
});
const ledgerAfterSecond = loadUsageLedger();
const countSecond = ledgerAfterSecond.filter((e) => e.id === testGenId).length;
assert(countSecond === 1, 'Duplicate generation ID does NOT duplicate row in ledger');

// 3. Blocked requests consume ZERO neurons
const blockedGenId = `TEST-BLOCKED-${Date.now()}`;
const blockedEntry = recordGenerationUsage({
  id: blockedGenId,
  articleId: 9993,
  model: CLOUDFLARE_FLUX_MODEL,
  status: 'BLOCKED',
  errorCategory: 'BUDGET_GUARD_EXCEEDED',
  errorMessage: 'Budget limit exceeded'
});
assert(blockedEntry.neuronsEstimated === 0, 'Blocked generation consumes 0 Neurons');

// Clean up test entries from ledger
const cleanedLedger = loadUsageLedger().filter(
  (e) => !e.id.startsWith('TEST-DEDUP-') && !e.id.startsWith('TEST-BLOCKED-')
);
saveUsageLedger(cleanedLedger);

// --------------------------------------------------------------------
// TEST GROUP 6: Daily Summary & Capacity Calculations
// --------------------------------------------------------------------
console.log('\n--- Test Group 6: Daily Summary & Capacity Calculations ---');

const summary = getDailyUsageSummary();
assert(summary.freeTierAllocation === 10000, 'Summary includes 10,000 N free tier allocation');
assert(summary.configuredDailyLimit >= 1000 && summary.configuredDailyLimit <= 10000, 'Configured daily limit within valid range');
assert(typeof summary.neuronsUsedToday === 'number', 'neuronsUsedToday is calculated');
assert(typeof summary.neuronsRemainingEstimated === 'number', 'neuronsRemainingEstimated is calculated');
assert(summary.percentageUsed >= 0 && summary.percentageUsed <= 100, `percentageUsed is valid percentage (${summary.percentageUsed}%)`);
assert(Array.isArray(summary.modelBreakdown), 'modelBreakdown is an array');
assert(summary.modelBreakdown.length >= 2, 'modelBreakdown covers at least FLUX and SDXL');

assert(
  typeof summary.estimatedRemainingCapacity.fluxImages === 'number',
  `Estimated remaining FLUX capacity calculated: ${summary.estimatedRemainingCapacity.fluxImages} images`
);
assert(
  typeof summary.estimatedRemainingCapacity.sdxlImages === 'number',
  `Estimated remaining SDXL capacity calculated: ${summary.estimatedRemainingCapacity.sdxlImages} images`
);

// --------------------------------------------------------------------
// TEST GROUP 7: Adapter Integration with Budget Guard
// --------------------------------------------------------------------
console.log('\n--- Test Group 7: Adapter Integration with Budget Guard ---');

// Mock adapter with low limit to trigger budget guard block
updateMonitorConfig({ customDailyLimit: 1000 });

// Record a dummy entry that consumes 1,500 neurons to push today's usage over 1,000
const dummyOverId = `TEST-OVER-${Date.now()}`;
recordGenerationUsage({
  id: dummyOverId,
  articleId: 9993,
  model: CLOUDFLARE_FLUX_MODEL,
  status: 'SUCCESS',
  neuronsEstimatedOverride: 1500
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

assert(guardBlocked === true, 'CloudflareAiImageAdapter.generate throws ImageProviderError (RATE_LIMIT) when budget guard triggers');

// Clean up dummy entry and restore config
const cleanLedger2 = loadUsageLedger().filter((e) => e.id !== dummyOverId);
saveUsageLedger(cleanLedger2);
updateMonitorConfig({ customDailyLimit: 10000 });

// --------------------------------------------------------------------
// TEST GROUP 8: Server Endpoints & Security Protection
// --------------------------------------------------------------------
console.log('\n--- Test Group 8: Server Endpoints & Security Protection ---');

const adminToken = await createAdminSessionToken();

// 1. Unauthenticated GET to /api/admin/media/neurons-usage
try {
  const resUnauth = await fetch('http://localhost:4321/api/admin/media/neurons-usage');
  assert(resUnauth.status === 401, 'Unauthenticated GET to /api/admin/media/neurons-usage is rejected with HTTP 401');
} catch (e) {
  console.warn('  ⚠️ Server check skipped or offline:', e.message);
}

// 2. Authenticated GET to /api/admin/media/neurons-usage
try {
  const resAuth = await fetch('http://localhost:4321/api/admin/media/neurons-usage', {
    headers: { Cookie: `admin_session=${adminToken}` }
  });
  assert(resAuth.status === 200, 'Authenticated GET to /api/admin/media/neurons-usage returns HTTP 200');
  const json = await resAuth.json();
  assert(json.status === 'ok', 'API response has status ok');
  assert(json.data.summary.freeTierAllocation === 10000, 'API returns summary with 10,000 N free tier');
  assert(json.data.probe.authoritativeSource === 'UNAVAILABLE', 'API returns probe status UNAVAILABLE');
  assert(Array.isArray(json.data.history), 'API returns recent generation history');
} catch (e) {
  console.warn('  ⚠️ Server check skipped or offline:', e.message);
}

// 3. Authenticated POST with paid usage attempt
try {
  const resPaidAttempt = await fetch('http://localhost:4321/api/admin/media/neurons-usage', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Cookie: `admin_session=${adminToken}`
    },
    body: JSON.stringify({ allow_paid_usage: true })
  });
  assert(
    resPaidAttempt.status === 403,
    'POST attempting to activate paid usage is rejected with HTTP 403 Forbidden'
  );
  const paidJson = await resPaidAttempt.json();
  assert(
    paidJson.code === 'PAID_USAGE_FORBIDDEN',
    'Rejection code is PAID_USAGE_FORBIDDEN'
  );
} catch (e) {
  console.warn('  ⚠️ Server check skipped or offline:', e.message);
}

// 4. UI Route verification: /admin/media/usage-monitor
try {
  const resPage = await fetch('http://localhost:4321/admin/media/usage-monitor', {
    headers: { Cookie: `admin_session=${adminToken}` }
  });
  assert(resPage.status === 200, '/admin/media/usage-monitor renders with HTTP 200');
  const pageHtml = await resPage.text();
  assert(pageHtml.includes('Cloudflare AI Neurons Usage Monitor'), 'Page contains monitor title');
  assert(pageHtml.includes('ESTIMATED'), 'Page prominently displays ESTIMATED badge');
  assert(pageHtml.includes('UNAVAILABLE'), 'Page prominently displays UNAVAILABLE Cloudflare API badge');
  assert(pageHtml.includes('Budget Guard'), 'Page contains Budget Guard controls');
  assert(pageHtml.includes('10.000'), 'Page contains 10.000 Neurons free tier allocation reference');
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
  console.log('>>> ALL CLOUDFLARE AI NEURONS USAGE MONITOR TESTS PASS! <<<');
}
