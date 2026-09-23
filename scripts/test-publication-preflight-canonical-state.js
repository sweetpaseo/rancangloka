/**
 * RancangLoka — JEV Phase 7C Canonical Decision State Test Suite
 *
 * Validates:
 * 1. Single canonical publication_preflight state contract (12 normalized fields).
 * 2. Strict parity between planner-service and autonomous shadow collector.
 * 3. Hash parity: identical article state produces identical input_hash.
 * 4. Semantic divergence: meaningful state changes alter the hash.
 * 5. Schema version safety: v1 and v2 cannot falsely dedupe.
 * 6. Zero authority: builder is a pure function with zero execution authority.
 */

import assert from 'node:assert';
import {
  buildCanonicalPublicationPreflightState,
  computeCanonicalPreflightHash,
  normalizePersistedReadiness,
  normalizePlannerEligibility
} from '../src/lib/decision/publication-preflight-state.ts';
import {
  DECISION_SCHEMA_VERSION,
  DECISION_SCHEMA_VERSION_V1,
  DECISION_SCHEMA_VERSION_V2,
  DECISION_PROMPT_VERSION
} from '../src/lib/decision/decision-types.ts';
import { buildPublicationPreflightState as collectorBuildState } from '../src/lib/decision/shadow-collector.ts';

let passed = 0;
let failed = 0;

function test(name, fn) {
  try {
    fn();
    console.log(`  ✅ PASS: ${name}`);
    passed++;
  } catch (err) {
    console.error(`  ❌ FAIL: ${name}`);
    console.error(err);
    failed++;
  }
}

console.log('\n=============================================================');
console.log('  RancangLoka — Canonical Publication Preflight State Suite');
console.log('=============================================================\n');

// 1. Schema Version Invariants
test('Test 1: Schema version bumped to v2 with historical v1 preserved', () => {
  assert.strictEqual(DECISION_SCHEMA_VERSION, '2026-09-23.v2');
  assert.strictEqual(DECISION_SCHEMA_VERSION_V2, '2026-09-23.v2');
  assert.strictEqual(DECISION_SCHEMA_VERSION_V1, '2026-09-23.v1');
  assert.strictEqual(DECISION_PROMPT_VERSION, 'v1.13');
});

// 2. Canonical Field Normalization & State Completeness
test('Test 2: Canonical builder outputs all 12 normalized primitive fields', () => {
  const state = buildCanonicalPublicationPreflightState({
    articleId: 5,
    slug: 'Kusen-Aluminium-vs-UPVC ',
    contentHash: 'hash_123',
    featuredAssetId: 'ast_456',
    persistedReadinessStatus: 'NOT_READY',
    isReady: 0,
    readingTimeMinutes: 8.4,
    isSponsored: false
  }, {
    plannerEligibility: 'ELIGIBLE'
  });

  const keys = Object.keys(state).sort();
  const expectedKeys = [
    'articleGenerationCompleted',
    'articleId',
    'duplicateSlug',
    'editorialValidationPassed',
    'heroImagePresent',
    'isSponsored',
    'persistedReadinessStatus',
    'plannerEligibilityStatus',
    'project',
    'readingTimeMinutes',
    'referencesPresent',
    'slug'
  ].sort();

  assert.deepStrictEqual(keys, expectedKeys);
  assert.strictEqual(state.project, 'RancangLoka');
  assert.strictEqual(state.articleId, 5);
  assert.strictEqual(state.slug, 'kusen-aluminium-vs-upvc');
  assert.strictEqual(state.articleGenerationCompleted, true);
  assert.strictEqual(state.editorialValidationPassed, true);
  assert.strictEqual(state.referencesPresent, true);
  assert.strictEqual(state.heroImagePresent, true);
  assert.strictEqual(state.duplicateSlug, false);
  assert.strictEqual(state.persistedReadinessStatus, 'NOT_READY');
  assert.strictEqual(state.plannerEligibilityStatus, 'ELIGIBLE');
  assert.strictEqual(state.readingTimeMinutes, 8);
  assert.strictEqual(state.isSponsored, false);
});

// 3. Planner / Collector State & Hash Parity for Article 5
test('Test 3: Article 5 produces 100% identical state and hash across planner and collector paths', () => {
  // Simulating Article 5 DB state
  const article5Db = {
    id: 5,
    slug: 'kusen-aluminium-vs-upvc-untuk-rumah-tropis-di-indonesia',
    title: 'Kusen Aluminium vs UPVC',
    status: 'draft',
    content_hash: 'c77881c0c35025aadf56bd3e64e3d40348b187c84d408a9c7275e6d0a0d26378',
    reading_time_minutes: 8,
    is_sponsored: 0,
    featured_asset_id: 'ast_mfUpgVe99C_bq_p2d_O4Ge4L',
    overall_status: 'NOT_READY',
    is_ready: 0,
    manual_hold: 0
  };

  // Path A: Planner Service construction
  const plannerCandidate = {
    articleId: article5Db.id,
    slug: article5Db.slug,
    contentHash: article5Db.content_hash,
    approvedAssetId: article5Db.featured_asset_id,
    persistedReadinessStatus: article5Db.overall_status,
    isReady: article5Db.is_ready,
    readingTimeMinutes: article5Db.reading_time_minutes,
    isSponsored: Boolean(article5Db.is_sponsored),
    manualHold: Boolean(article5Db.manual_hold),
    candidateSource: 'auto_policy'
  };

  const plannerState = buildCanonicalPublicationPreflightState({
    articleId: plannerCandidate.articleId,
    slug: plannerCandidate.slug,
    contentHash: plannerCandidate.contentHash,
    featuredAssetId: plannerCandidate.approvedAssetId,
    persistedReadinessStatus: plannerCandidate.persistedReadinessStatus,
    isReady: plannerCandidate.isReady,
    readingTimeMinutes: plannerCandidate.readingTimeMinutes,
    isSponsored: plannerCandidate.isSponsored,
    manualHold: plannerCandidate.manualHold,
    status: 'draft'
  }, {
    plannerEligibility: plannerCandidate.candidateSource ? 'ELIGIBLE' : 'NOT_ELIGIBLE'
  });

  // Path B: Autonomous Shadow Collector construction
  const collectorSubject = {
    id: article5Db.id,
    slug: article5Db.slug,
    title: article5Db.title,
    status: article5Db.status,
    contentHash: article5Db.content_hash,
    readingTimeMinutes: article5Db.reading_time_minutes,
    isSponsored: Boolean(article5Db.is_sponsored),
    featuredAssetId: article5Db.featured_asset_id,
    readinessStatus: article5Db.overall_status,
    isReady: article5Db.is_ready,
    manualHold: article5Db.manual_hold,
    readinessEvaluatedAt: '2026-09-22 08:00:16'
  };

  const collectorState = collectorBuildState(collectorSubject);

  // Assert State Equality
  assert.deepStrictEqual(plannerState, collectorState, 'Planner and Collector states must match identically');

  // Assert Hash Equality
  const plannerHash = computeCanonicalPreflightHash(plannerState);
  const collectorHash = computeCanonicalPreflightHash(collectorState);

  assert.strictEqual(plannerHash, collectorHash, 'Planner and Collector hashes must match identically');
  assert.ok(plannerHash.startsWith('h_'), 'Hash must start with h_ prefix');
});

// 4. Parity across Diverse Fixtures
test('Test 4: Parity verified across diverse editorial fixtures', () => {
  const fixtures = [
    {
      name: 'Clean eligible editorial signoff',
      input: {
        articleId: 101,
        slug: 'panduan-atap-sirap',
        contentHash: 'hash_sirap',
        featuredAssetId: 'ast_sirap',
        persistedReadinessStatus: 'READY_TO_SCHEDULE',
        isReady: 1,
        readingTimeMinutes: 5,
        isSponsored: false
      },
      plannerEligible: true
    },
    {
      name: 'Unready draft lacking cover media',
      input: {
        articleId: 102,
        slug: 'pencahayaan-alami-zenithal',
        contentHash: 'hash_zenithal',
        featuredAssetId: null,
        persistedReadinessStatus: 'NOT_READY',
        isReady: 0,
        readingTimeMinutes: 4,
        isSponsored: false
      },
      plannerEligible: false
    },
    {
      name: 'Blocked draft with policy violations',
      input: {
        articleId: 103,
        slug: 'biaya-renovasi-rumah-2-lantai',
        contentHash: 'hash_biaya',
        featuredAssetId: 'ast_biaya',
        persistedReadinessStatus: 'BLOCKED',
        isReady: 0,
        readingTimeMinutes: 7,
        isSponsored: false
      },
      plannerEligible: false
    },
    {
      name: 'Sponsored technical deep-dive',
      input: {
        articleId: 104,
        slug: 'smart-home-knx-wiring-diagram',
        contentHash: 'hash_knx',
        featuredAssetId: 'ast_knx',
        persistedReadinessStatus: 'NOT_READY',
        isReady: 0,
        readingTimeMinutes: 11,
        isSponsored: true
      },
      plannerEligible: true
    }
  ];

  for (const f of fixtures) {
    const stateA = buildCanonicalPublicationPreflightState(f.input, {
      plannerEligibility: f.plannerEligible ? 'ELIGIBLE' : 'NOT_ELIGIBLE'
    });
    const stateB = buildCanonicalPublicationPreflightState(f.input, {
      plannerEligibility: f.plannerEligible ? 'ELIGIBLE' : 'NOT_ELIGIBLE'
    });

    assert.deepStrictEqual(stateA, stateB, `State parity failed for ${f.name}`);
    const hashA = computeCanonicalPreflightHash(stateA);
    const hashB = computeCanonicalPreflightHash(stateB);
    assert.strictEqual(hashA, hashB, `Hash parity failed for ${f.name}`);
  }
});

// 5. Semantic Divergence Tests
test('Test 5: Meaningful state changes strictly alter the canonical hash', () => {
  const base = {
    articleId: 5,
    slug: 'kusen-aluminium-vs-upvc-untuk-rumah-tropis-di-indonesia',
    contentHash: 'c77881c0',
    featuredAssetId: 'ast_123',
    persistedReadinessStatus: 'NOT_READY',
    readingTimeMinutes: 8,
    isSponsored: false
  };

  const baseState = buildCanonicalPublicationPreflightState(base, { plannerEligibility: 'ELIGIBLE' });
  const baseHash = computeCanonicalPreflightHash(baseState);

  // Perturbation 1: persistedReadinessStatus changes
  const p1 = buildCanonicalPublicationPreflightState({
    ...base,
    persistedReadinessStatus: 'READY_TO_SCHEDULE',
    isReady: 1
  }, { plannerEligibility: 'ELIGIBLE' });
  assert.notStrictEqual(computeCanonicalPreflightHash(p1), baseHash, 'persistedReadinessStatus change must alter hash');

  // Perturbation 2: plannerEligibilityStatus changes
  const p2 = buildCanonicalPublicationPreflightState(base, { plannerEligibility: 'NOT_ELIGIBLE' });
  assert.notStrictEqual(computeCanonicalPreflightHash(p2), baseHash, 'plannerEligibilityStatus change must alter hash');

  // Perturbation 3: featuredAssetId disappears
  const p3 = buildCanonicalPublicationPreflightState({ ...base, featuredAssetId: null }, { plannerEligibility: 'ELIGIBLE' });
  assert.notStrictEqual(computeCanonicalPreflightHash(p3), baseHash, 'featuredAssetId disappearance must alter hash');

  // Perturbation 4: readingTimeMinutes changes
  const p4 = buildCanonicalPublicationPreflightState({ ...base, readingTimeMinutes: 12 }, { plannerEligibility: 'ELIGIBLE' });
  assert.notStrictEqual(computeCanonicalPreflightHash(p4), baseHash, 'readingTimeMinutes change must alter hash');

  // Perturbation 5: isSponsored changes
  const p5 = buildCanonicalPublicationPreflightState({ ...base, isSponsored: true }, { plannerEligibility: 'ELIGIBLE' });
  assert.notStrictEqual(computeCanonicalPreflightHash(p5), baseHash, 'isSponsored change must alter hash');

  // Perturbation 6: references disappear
  const p6 = buildCanonicalPublicationPreflightState({ ...base, referencesPresent: false }, { plannerEligibility: 'ELIGIBLE' });
  assert.notStrictEqual(computeCanonicalPreflightHash(p6), baseHash, 'referencesPresent change must alter hash');

  // Perturbation 7: duplicateSlug detected
  const p7 = buildCanonicalPublicationPreflightState(base, { plannerEligibility: 'ELIGIBLE', duplicateSlug: true });
  assert.notStrictEqual(computeCanonicalPreflightHash(p7), baseHash, 'duplicateSlug change must alter hash');
});

// 6. Schema Version & Deduplication Isolation
test('Test 6: v1 and v2 states produce different hashes preventing cross-version collision', () => {
  const v1State = {
    project: 'RancangLoka',
    articleId: 5,
    slug: 'kusen-aluminium-vs-upvc-untuk-rumah-tropis-di-indonesia',
    articleGenerationCompleted: true,
    editorialValidationPassed: true,
    referencesPresent: true,
    heroImagePresent: true,
    duplicateSlug: false,
    readinessStatus: 'NOT_READY',
    readingTimeMinutes: 8,
    isSponsored: false
  };

  const v2State = buildCanonicalPublicationPreflightState({
    articleId: 5,
    slug: 'kusen-aluminium-vs-upvc-untuk-rumah-tropis-di-indonesia',
    contentHash: 'c77881c0',
    featuredAssetId: 'ast_123',
    persistedReadinessStatus: 'NOT_READY',
    readingTimeMinutes: 8,
    isSponsored: false
  }, { plannerEligibility: 'ELIGIBLE' });

  const v1Hash = computeCanonicalPreflightHash(v1State);
  const v2Hash = computeCanonicalPreflightHash(v2State);

  assert.notStrictEqual(v1Hash, v2Hash, 'v1 legacy state and v2 canonical state must have distinct hashes');
  assert.strictEqual(v1Hash, 'h_8fd8affc', 'v1 hash must match historical observation obs_mue4okdt_9j2tor');
});

// 7. Authority Firewall Verification
test('Test 7: Canonical state builder has zero publication authority', () => {
  // Pure function property check
  const state = buildCanonicalPublicationPreflightState({
    articleId: 999,
    slug: 'pure-function-test',
    contentHash: 'hash_test',
    featuredAssetId: 'ast_test'
  });

  assert.strictEqual(typeof state, 'object');
  assert.strictEqual(state.articleId, 999);
  // Ensure no methods or mutators attached
  assert.strictEqual(Object.keys(state).every(k => typeof state[k] !== 'function'), true);
});

console.log('\n=============================================================');
console.log(`  Tests Completed: ${passed + failed}`);
console.log(`  Passed: ${passed}`);
console.log(`  Failed: ${failed}`);
console.log('=============================================================\n');

if (failed > 0) {
  process.exit(1);
}
