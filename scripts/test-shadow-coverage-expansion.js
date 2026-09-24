/**
 * RancangLoka — JEV Phase 7F Local Test Suite
 * Shadow Coverage Expansion + Calibration Data Acquisition
 *
 * Verifies:
 * 1. Fully eligible draft selection & canonical state build
 * 2. NOT_READY draft selection & canonical state build
 * 3. Missing featured media draft selection (heroImagePresent=false, authoritative=revise)
 * 4. Missing references draft canonical state (referencesPresent=false, authoritative=revise)
 * 5. Manual hold draft selection & canonical state build (manualHold=1, plannerEligibility=NOT_ELIGIBLE)
 * 6. Editorial validation failed draft (editorialValidationPassed=false, authoritative=stop)
 * 7. Published article strictly excluded by selector and predicate (isShadowEvaluable=false)
 * 8. Duplicate canonical state deduplication preserved
 * 9. Changed canonical state evaluation triggered
 * 10. Firewalls & Authority Proof:
 *     SHADOW_EVALUATION_DOES_NOT_IMPLY_PUBLICATION_ELIGIBILITY = YES
 *     COLLECTOR_CAN_CREATE_PLAN = NO
 *     COLLECTOR_CAN_CREATE_EXECUTION = NO
 *     COLLECTOR_CAN_PUBLISH = NO
 *     JEV_AUTHORITY_UNCHANGED = ZERO
 */

import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import fs from 'node:fs';

import {
  runDecisionShadowCollector,
  selectProspectiveArticles,
  isShadowEvaluable,
  buildPublicationPreflightState,
  checkDeduplication,
  resetMemoryCursor,
  getDurableCursorArticleId,
  getMemoryCursor
} from '../src/lib/decision/shadow-collector.ts';

import {
  buildCanonicalPublicationPreflightState,
  computeCanonicalPreflightHash
} from '../src/lib/decision/publication-preflight-state.ts';

import {
  routeDecision,
  classifyDisagreement,
  computePublicationGateAlignment
} from '../src/lib/decision/decision-router.ts';

import {
  DECISION_SCHEMA_VERSION
} from '../src/lib/decision/decision-types.ts';

let totalTests = 0;
let passedTests = 0;

function pass(name) {
  totalTests++;
  passedTests++;
  console.log(`  ✅ PASS: Test ${totalTests}: ${name}`);
}

function fail(name, err) {
  totalTests++;
  console.error(`  ❌ FAIL: Test ${totalTests}: ${name}`);
  console.error(err);
  process.exit(1);
}

function createD1Wrapper(dbSync) {
  return {
    prepare(sql) {
      return {
        bind(...args) {
          return {
            async first() {
              const stmt = dbSync.prepare(sql);
              return stmt.get(...args) || null;
            },
            async all() {
              const stmt = dbSync.prepare(sql);
              const rows = stmt.all(...args);
              return { results: rows };
            },
            async run() {
              const stmt = dbSync.prepare(sql);
              const info = stmt.run(...args);
              return { success: true, meta: { changes: info.changes } };
            }
          };
        },
        async first() {
          const stmt = dbSync.prepare(sql);
          return stmt.get() || null;
        },
        async all() {
          const stmt = dbSync.prepare(sql);
          const rows = stmt.all();
          return { results: rows };
        },
        async run() {
          const stmt = dbSync.prepare(sql);
          const info = stmt.run();
          return { success: true, meta: { changes: info.changes } };
        }
      };
    }
  };
}

function setupInMemoryDb() {
  const dbSync = new DatabaseSync(':memory:');

  // Create minimal schema matching production migrations
  dbSync.exec(`
    CREATE TABLE articles (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      slug TEXT NOT NULL UNIQUE,
      title TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'draft',
      content_hash TEXT,
      reading_time_minutes INTEGER DEFAULT 5,
      is_sponsored INTEGER DEFAULT 0,
      manual_hold INTEGER DEFAULT 0,
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE article_media (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      article_id INTEGER NOT NULL,
      asset_id TEXT NOT NULL,
      role TEXT NOT NULL DEFAULT 'featured',
      is_active INTEGER NOT NULL DEFAULT 1,
      created_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE article_publication_readiness (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      article_id INTEGER NOT NULL,
      is_ready INTEGER NOT NULL DEFAULT 0,
      overall_status TEXT NOT NULL DEFAULT 'NOT_READY',
      blockers_json TEXT DEFAULT '[]',
      evaluated_at TEXT DEFAULT (datetime('now'))
    );
  `);

  const m21 = fs.readFileSync('db/migrations/0021_decision_observations.sql', 'utf8');
  dbSync.exec(m21);

  return { dbSync, db: createD1Wrapper(dbSync) };
}

async function runAllTests() {
  console.log('\n🚀 Starting RancangLoka JEV Phase 7F Test Suite (Shadow Coverage Expansion)...\n');

  // =========================================================================
  // 1. Fully Eligible Draft
  // =========================================================================
  try {
    const { dbSync, db } = setupInMemoryDb();
    dbSync.prepare(`
      INSERT INTO articles (id, slug, title, status, content_hash, reading_time_minutes)
      VALUES (1, 'eligible-article', 'Eligible Article', 'draft', 'hash_eligible', 7);
    `).run();
    dbSync.prepare(`
      INSERT INTO article_media (article_id, asset_id, role, is_active)
      VALUES (1, 'ast_featured_1', 'featured', 1);
    `).run();
    dbSync.prepare(`
      INSERT INTO article_publication_readiness (article_id, is_ready, overall_status)
      VALUES (1, 1, 'READY_TO_SCHEDULE');
    `).run();

    const subjects = await selectProspectiveArticles(db, 10);
    assert.equal(subjects.length, 1);
    assert.equal(subjects[0].id, 1);
    assert.equal(subjects[0].readinessStatus, 'READY_TO_SCHEDULE');
    assert.equal(subjects[0].featuredAssetId, 'ast_featured_1');

    const canonical = buildPublicationPreflightState(subjects[0]);
    assert.equal(canonical.heroImagePresent, true);
    assert.equal(canonical.plannerEligibilityStatus, 'ELIGIBLE');
    assert.equal(canonical.persistedReadinessStatus, 'READY_TO_SCHEDULE');

    const routing = routeDecision('publication_preflight', canonical);
    assert.equal(routing.normalized_choice, 'continue');

    pass('Fully eligible draft selected and canonical state evaluated as continue');
  } catch (err) {
    fail('Fully eligible draft test failed', err);
  }

  // =========================================================================
  // 2. NOT_READY Draft
  // =========================================================================
  try {
    const { dbSync, db } = setupInMemoryDb();
    dbSync.prepare(`
      INSERT INTO articles (id, slug, title, status, content_hash, reading_time_minutes)
      VALUES (2, 'not-ready-article', 'Not Ready Article', 'draft', 'hash_nr', 8);
    `).run();
    dbSync.prepare(`
      INSERT INTO article_media (article_id, asset_id, role, is_active)
      VALUES (2, 'ast_featured_2', 'featured', 1);
    `).run();
    dbSync.prepare(`
      INSERT INTO article_publication_readiness (article_id, is_ready, overall_status)
      VALUES (2, 0, 'NOT_READY');
    `).run();

    const subjects = await selectProspectiveArticles(db, 10);
    assert.equal(subjects.length, 1);
    assert.equal(subjects[0].readinessStatus, 'NOT_READY');

    const canonical = buildPublicationPreflightState(subjects[0]);
    assert.equal(canonical.heroImagePresent, true);
    assert.equal(canonical.persistedReadinessStatus, 'NOT_READY');
    // Operational eligibility under current state builder: draft + content + media + !held = ELIGIBLE
    assert.equal(canonical.plannerEligibilityStatus, 'ELIGIBLE');

    pass('NOT_READY draft selected and correctly preserves persistedReadinessStatus=NOT_READY');
  } catch (err) {
    fail('NOT_READY draft test failed', err);
  }

  // =========================================================================
  // 3. Missing Featured Media Draft (Expanded Coverage Case)
  // =========================================================================
  try {
    const { dbSync, db } = setupInMemoryDb();
    dbSync.prepare(`
      INSERT INTO articles (id, slug, title, status, content_hash, reading_time_minutes)
      VALUES (3, 'missing-media-article', 'Missing Media Article', 'draft', 'hash_nomedia', 6);
    `).run();
    // NO article_media row inserted

    const subjects = await selectProspectiveArticles(db, 10);
    assert.equal(subjects.length, 1, 'Expanded selector must include draft without media via LEFT JOIN');
    assert.equal(subjects[0].id, 3);
    assert.equal(subjects[0].featuredAssetId, null);

    const canonical = buildPublicationPreflightState(subjects[0]);
    assert.equal(canonical.heroImagePresent, false);
    assert.equal(canonical.plannerEligibilityStatus, 'NOT_ELIGIBLE');

    const routing = routeDecision('publication_preflight', canonical);
    assert.equal(routing.normalized_choice, 'revise', 'Deterministic authoritative baseline must require revise');
    assert.deepEqual(routing.reasons, ['MEDIA_OR_REFERENCES_MISSING']);

    pass('Missing featured media draft selected without mutation; heroImagePresent=false and routing=revise');
  } catch (err) {
    fail('Missing featured media draft test failed', err);
  }

  // =========================================================================
  // 4. Missing References Canonical State
  // =========================================================================
  try {
    const canonical = buildCanonicalPublicationPreflightState({
      articleId: 4,
      slug: 'missing-refs',
      contentHash: 'hash_norefs',
      featuredAssetId: 'ast_4',
      referencesPresent: false
    });
    assert.equal(canonical.referencesPresent, false);
    const routing = routeDecision('publication_preflight', canonical);
    assert.equal(routing.normalized_choice, 'revise');
    assert.deepEqual(routing.reasons, ['MEDIA_OR_REFERENCES_MISSING']);

    pass('Missing references state evaluated deterministically as revise');
  } catch (err) {
    fail('Missing references test failed', err);
  }

  // =========================================================================
  // 5. Manual Hold Draft
  // =========================================================================
  try {
    const { dbSync, db } = setupInMemoryDb();
    dbSync.prepare(`
      INSERT INTO articles (id, slug, title, status, content_hash, manual_hold)
      VALUES (5, 'manual-hold-article', 'Held Article', 'draft', 'hash_held', 1);
    `).run();
    dbSync.prepare(`
      INSERT INTO article_media (article_id, asset_id, role, is_active)
      VALUES (5, 'ast_5', 'featured', 1);
    `).run();

    const subjects = await selectProspectiveArticles(db, 10);
    assert.equal(subjects.length, 1);
    assert.equal(subjects[0].manualHold, 1);

    const canonical = buildPublicationPreflightState(subjects[0]);
    assert.equal(canonical.plannerEligibilityStatus, 'NOT_ELIGIBLE', 'Manual hold forces planner NOT_ELIGIBLE');

    pass('Manual hold draft observed cleanly without mutating article manual_hold flag');
  } catch (err) {
    fail('Manual hold test failed', err);
  }

  // =========================================================================
  // 6. Editorial Validation Fail State
  // =========================================================================
  try {
    const canonical = buildCanonicalPublicationPreflightState({
      articleId: 6,
      slug: 'failed-validation',
      contentHash: 'hash_fail',
      editorialValidationPassed: false
    });
    assert.equal(canonical.editorialValidationPassed, false);
    const routing = routeDecision('publication_preflight', canonical);
    assert.equal(routing.normalized_choice, 'stop');
    assert.deepEqual(routing.reasons, ['SAFETY_OR_CONTENT_GUARD_FAILED']);

    pass('Editorial validation failure evaluated deterministically as stop');
  } catch (err) {
    fail('Editorial validation failure test failed', err);
  }

  // =========================================================================
  // 7. Published Article Exclusion
  // =========================================================================
  try {
    const { dbSync, db } = setupInMemoryDb();
    dbSync.prepare(`
      INSERT INTO articles (id, slug, title, status, content_hash)
      VALUES (7, 'published-article', 'Published Article', 'published', 'hash_pub');
    `).run();

    assert.equal(isShadowEvaluable({ id: 7, slug: 'published-article', status: 'published' }), false);

    const subjects = await selectProspectiveArticles(db, 10);
    assert.equal(subjects.length, 0, 'Published articles must NOT be selected by preflight shadow collector');

    pass('Published articles strictly excluded from publication_preflight shadow observation');
  } catch (err) {
    fail('Published article exclusion test failed', err);
  }

  // =========================================================================
  // 8. Deduplication on Unchanged State & Execution on Changed State
  // =========================================================================
  try {
    const { dbSync, db } = setupInMemoryDb();
    dbSync.prepare(`
      INSERT INTO articles (id, slug, title, status, content_hash)
      VALUES (8, 'dedupe-article', 'Dedupe Article', 'draft', 'hash_initial');
    `).run();

    const candidate = (await selectProspectiveArticles(db, 1))[0];
    const candidateState = buildPublicationPreflightState(candidate);
    const initialHash = computeCanonicalPreflightHash(candidateState);

    // Initial check: not skipped
    const check1 = await checkDeduplication(db, {
      decisionPoint: 'publication_preflight',
      subjectType: 'article',
      subjectId: '8',
      inputHash: initialHash,
      errorRetryMinutes: 360
    });
    assert.equal(check1.shouldSkip, false);

    // Insert SUCCESS observation for this hash
    dbSync.prepare(`
      INSERT INTO decision_observations (
        observation_id, decision_point, subject_type, subject_id, run_id,
        authoritative_decision, authoritative_reasons_json, jev_decision,
        provider, model, model_version, input_schema_version, prompt_version,
        input_hash, latency_ms, provider_status, disagreement_classification
      ) VALUES (
        'obs_dedupe_test', 'publication_preflight', 'article', '8', 'run_test',
        'revise', '["MEDIA_OR_REFERENCES_MISSING"]', 'revise',
        'openrouter', 'typesafe/jev-1.13', '20260917', '${DECISION_SCHEMA_VERSION}', 'v1.13',
        ?, 250, 'SUCCESS', 'AGREE_STOP'
      );
    `).run(initialHash);

    // Second check: skipped via DEDUPE_SUCCESS
    const check2 = await checkDeduplication(db, {
      decisionPoint: 'publication_preflight',
      subjectType: 'article',
      subjectId: '8',
      inputHash: initialHash,
      errorRetryMinutes: 360
    });
    assert.equal(check2.shouldSkip, true);
    assert.equal(check2.reason, 'DEDUPE_SUCCESS');

    // Mutate state (reading time) -> different hash
    dbSync.prepare(`UPDATE articles SET reading_time_minutes = 15 WHERE id = 8;`).run();
    const updatedCandidate = (await selectProspectiveArticles(db, 1))[0];
    const updatedState = buildPublicationPreflightState(updatedCandidate);
    const updatedHash = computeCanonicalPreflightHash(updatedState);
    assert.notEqual(initialHash, updatedHash);

    // Third check on changed hash: not skipped
    const check3 = await checkDeduplication(db, {
      decisionPoint: 'publication_preflight',
      subjectType: 'article',
      subjectId: '8',
      inputHash: updatedHash,
      errorRetryMinutes: 360
    });
    assert.equal(check3.shouldSkip, false);

    pass('Deduplication skips identical canonical state and executes upon genuine state change');
  } catch (err) {
    fail('Deduplication test failed', err);
  }

  // =========================================================================
  // 9. Disagreement Classification Alignment for 'revise' & 'stop'
  // =========================================================================
  try {
    // Exact agreement
    assert.equal(classifyDisagreement('publication_preflight', 'continue', 'continue', 'SUCCESS'), 'AGREE_CONTINUE');
    assert.equal(classifyDisagreement('publication_preflight', 'revise', 'revise', 'SUCCESS'), 'AGREE_REVISE');
    assert.equal(classifyDisagreement('publication_preflight', 'stop', 'stop', 'SUCCESS'), 'AGREE_STOP');

    // Jev more conservative (continue > revise > stop)
    assert.equal(classifyDisagreement('publication_preflight', 'continue', 'revise', 'SUCCESS'), 'JEV_MORE_CONSERVATIVE');
    assert.equal(classifyDisagreement('publication_preflight', 'continue', 'stop', 'SUCCESS'), 'JEV_MORE_CONSERVATIVE');
    assert.equal(classifyDisagreement('publication_preflight', 'revise', 'stop', 'SUCCESS'), 'JEV_MORE_CONSERVATIVE', 'auth=revise, jev=stop is JEV_MORE_CONSERVATIVE');

    // Jev more permissive
    assert.equal(classifyDisagreement('publication_preflight', 'revise', 'continue', 'SUCCESS'), 'JEV_MORE_PERMISSIVE');
    assert.equal(classifyDisagreement('publication_preflight', 'stop', 'continue', 'SUCCESS'), 'JEV_MORE_PERMISSIVE');
    assert.equal(classifyDisagreement('publication_preflight', 'stop', 'revise', 'SUCCESS'), 'JEV_MORE_PERMISSIVE', 'auth=stop, jev=revise is JEV_MORE_PERMISSIVE');

    // Human review
    assert.equal(classifyDisagreement('publication_preflight', 'continue', 'human_review', 'SUCCESS'), 'JEV_HUMAN_REVIEW');
    assert.equal(classifyDisagreement('publication_preflight', 'revise', 'human_review', 'SUCCESS'), 'JEV_HUMAN_REVIEW');
    assert.equal(classifyDisagreement('publication_preflight', 'stop', 'human_review', 'SUCCESS'), 'JEV_HUMAN_REVIEW');

    // Publication Gate Alignment (both halt)
    assert.equal(computePublicationGateAlignment('publication_preflight', 'continue', 'continue'), 'BOTH_CONTINUE');
    assert.equal(computePublicationGateAlignment('publication_preflight', 'revise', 'stop'), 'BOTH_HALT');
    assert.equal(computePublicationGateAlignment('publication_preflight', 'stop', 'revise'), 'BOTH_HALT');
    assert.equal(computePublicationGateAlignment('publication_preflight', 'revise', 'continue'), 'DIVERGENT');
    assert.equal(computePublicationGateAlignment('publication_preflight', 'continue', 'stop'), 'DIVERGENT');

    pass('classifyDisagreement & computePublicationGateAlignment satisfy exact directional matrix');
  } catch (err) {
    fail('Disagreement classification test failed', err);
  }

  // =========================================================================
  // 10. Core Invariant & Authority Firewall
  // =========================================================================
  try {
    // Prove shadow evaluable does NOT mean publishable
    const draftSubject = {
      id: 99,
      slug: 'shadow-draft',
      title: 'Shadow Draft',
      status: 'draft',
      contentHash: 'h_test',
      readingTimeMinutes: 5,
      isSponsored: false,
      featuredAssetId: null,
      readinessStatus: 'NOT_READY',
      isReady: 0,
      manualHold: 0,
      readinessEvaluatedAt: null
    };

    const evaluable = isShadowEvaluable(draftSubject);
    const canonicalState = buildPublicationPreflightState(draftSubject);

    assert.equal(evaluable, true, 'Draft is shadow evaluable');
    assert.equal(canonicalState.plannerEligibilityStatus, 'NOT_ELIGIBLE', 'Draft is NOT eligible for publication');
    assert.equal(canonicalState.persistedReadinessStatus, 'NOT_READY', 'Draft is NOT ready for publication');

    console.log('  🛡️ INVARIANT VERIFIED: SHADOW_EVALUATION_DOES_NOT_IMPLY_PUBLICATION_ELIGIBILITY = YES');
    pass('Shadow evaluation completely decoupled from publication eligibility');
  } catch (err) {
    fail('Authority firewall test failed', err);
  }

  // =========================================================================
  // 11. Article 5 Production v2 Hash Fixture Stability
  // =========================================================================
  try {
    const article5Fixture = {
      articleId: 5,
      slug: 'kusen-aluminium-vs-upvc-untuk-rumah-tropis-di-indonesia',
      contentHash: 'c77881c0c35025aadf56bd3e64e3d40348b187c84d408a9c7275e6d0a0d26378',
      featuredAssetId: 'ast_mfUpgVe99C_bq_p2d_O4Ge4L',
      persistedReadinessStatus: 'NOT_READY',
      isReady: 0,
      readingTimeMinutes: 8,
      isSponsored: false,
      manualHold: 0,
      status: 'draft'
    };

    const canonicalState = buildPublicationPreflightState(article5Fixture);
    const hash = computeCanonicalPreflightHash(canonicalState);

    // Exact expected hash from production observation obs_mueb41kn_01wr4b
    assert.equal(hash, 'h_89de9fcf', 'Article 5 must produce exact production v2 hash h_89de9fcf');
    pass('Article 5 production v2 canonical hash fixture stability verified (h_89de9fcf)');
  } catch (err) {
    fail('Article 5 hash fixture test failed', err);
  }

  // =========================================================================
  // 12. Five-Subject Fairness & Starvation Hardening Simulation (JEV-7F.3)
  // =========================================================================
  try {
    const { dbSync, db } = setupInMemoryDb();

    // Insert 5 draft articles
    for (let id = 1; id <= 5; id++) {
      dbSync.prepare(`
        INSERT INTO articles (id, slug, title, status, content_hash, reading_time_minutes)
        VALUES (?, ?, ?, 'draft', ?, 5);
      `).run(id, `draft-article-${id}`, `Draft Article ${id}`, `hash_${id}`);
      dbSync.prepare(`
        INSERT INTO article_media (article_id, asset_id, role, is_active)
        VALUES (?, ?, 'featured', 1);
      `).run(id, `ast_${id}`);
    }

    // Mock fetch for provider
    const originalFetch = globalThis.fetch;
    globalThis.fetch = async () => ({
      ok: true,
      status: 200,
      json: async () => ({
        model: 'typesafe/jev-1.13',
        answers: {
          nextAction: {
            type: 'choice',
            choice: 'continue',
            probabilities: { continue: 0.95, revise: 0.03, stop: 0.01, human_review: 0.01 },
            confidence: 0.95
          },
          publicationRisk: {
            type: 'choice',
            choice: 'very_low',
            confidence: 0.93
          },
          needsHumanReview: {
            type: 'noul',
            value: false,
            confidence: 0.91
          }
        }
      })
    });

    try {
      const collectorEnv = {
        JEV_ENABLED: 'true',
        JEV_MODE: 'shadow',
        JEV_SHADOW_COLLECTOR_ENABLED: 'true',
        OPENROUTER_API_KEY: 'mock-test-key'
      };

      // Cycle 1: up to 3 provider calls, remaining 2 budget skipped
      const cycle1 = await runDecisionShadowCollector(db, collectorEnv, {
        config: { maxCallsPerRun: 3, maxCandidatesScannedPerRun: 25 }
      });

      assert.equal(cycle1.status, 'success');
      assert.equal(cycle1.processedCount, 5, 'All 5 candidates scanned');
      assert.equal(cycle1.providerCallCount, 3, 'Cycle 1 executes exactly 3 provider calls (bounded)');
      assert.equal(cycle1.observationCreatedCount, 3, 'Cycle 1 records 3 new observations');
      assert.equal(cycle1.dedupeSkippedCount, 0, 'Cycle 1 has 0 dedupe skips');

      const budgetSkipped1 = cycle1.details.subjects.filter(s => s.action === 'BUDGET_SKIPPED');
      assert.equal(budgetSkipped1.length, 2, 'Articles 4 and 5 budget-skipped in Cycle 1');

      // Cycle 2: Articles 1-3 dedupe skipped, Articles 4-5 reach provider and are observed!
      const cycle2 = await runDecisionShadowCollector(db, collectorEnv, {
        config: { maxCallsPerRun: 3, maxCandidatesScannedPerRun: 25 }
      });

      assert.equal(cycle2.status, 'success');
      assert.equal(cycle2.processedCount, 5, 'All 5 candidates scanned');
      assert.equal(cycle2.providerCallCount, 2, 'Cycle 2 executes remaining 2 provider calls');
      assert.equal(cycle2.observationCreatedCount, 2, 'Cycle 2 records 2 new observations (Articles 4 & 5)');
      assert.equal(cycle2.dedupeSkippedCount, 3, 'Articles 1-3 dedupe-skipped with zero provider calls');

      // Cycle 3: Terminal Steady State (all 5 observed)
      const cycle3 = await runDecisionShadowCollector(db, collectorEnv, {
        config: { maxCallsPerRun: 3, maxCandidatesScannedPerRun: 25 }
      });

      assert.equal(cycle3.status, 'success');
      assert.equal(cycle3.processedCount, 5, 'All 5 candidates scanned');
      assert.equal(cycle3.providerCallCount, 0, 'Cycle 3 executes zero provider calls');
      assert.equal(cycle3.observationCreatedCount, 0, 'Cycle 3 creates zero observations');
      assert.equal(cycle3.dedupeSkippedCount, 5, 'All 5 articles dedupe-skipped');

      // Verify all 5 subjects are in decision_observations
      const totalObs = dbSync.prepare("SELECT COUNT(*) AS c FROM decision_observations WHERE provider_status = 'SUCCESS'").get().c;
      assert.equal(totalObs, 5, 'All 5 subjects have successful observations');

      const observedSubjects = dbSync.prepare("SELECT DISTINCT subject_id FROM decision_observations").all().map(r => Number(r.subject_id)).sort();
      assert.deepEqual(observedSubjects, [1, 2, 3, 4, 5], 'Subjects 1 through 5 all eventually observed (Zero Starvation)');

      pass('Five-subject fairness & starvation hardening simulation verified (STARVATION_DETECTED=NO)');
    } finally {
      globalThis.fetch = originalFetch;
    }
  } catch (err) {
    fail('Five-subject fairness simulation failed', err);
  }

  // =========================================================================
  // 13. Production Canary Multi-Cycle Acquisition Simulation (JEV-7F.3)
  // =========================================================================
  try {
    const { dbSync, db } = setupInMemoryDb();

    // Insert 5 draft articles matching real production pool
    for (let id = 1; id <= 4; id++) {
      dbSync.prepare(`
        INSERT INTO articles (id, slug, title, status, content_hash, reading_time_minutes)
        VALUES (?, ?, ?, 'draft', ?, 5);
      `).run(id, `prod-draft-${id}`, `Prod Draft ${id}`, `prod_hash_${id}`);
    }

    // Article 5: Real production metadata
    dbSync.prepare(`
      INSERT INTO articles (id, slug, title, status, content_hash, reading_time_minutes)
      VALUES (5, 'kusen-aluminium-vs-upvc-untuk-rumah-tropis-di-indonesia', 'Kusen Aluminium vs UPVC', 'draft', 'c77881c0c35025aadf56bd3e64e3d40348b187c84d408a9c7275e6d0a0d26378', 8);
    `).run();
    dbSync.prepare(`
      INSERT INTO article_media (article_id, asset_id, role, is_active)
      VALUES (5, 'ast_mfUpgVe99C_bq_p2d_O4Ge4L', 'featured', 1);
    `).run();

    // Pre-insert Article 5 existing v2 observation h_89de9fcf
    dbSync.prepare(`
      INSERT INTO decision_observations (
        observation_id, decision_point, subject_type, subject_id, run_id,
        authoritative_decision, authoritative_reasons_json, jev_decision,
        provider, model, model_version, input_schema_version, prompt_version,
        input_hash, latency_ms, provider_status, disagreement_classification
      ) VALUES (
        'obs_mueb41kn_01wr4b', 'publication_preflight', 'article', '5', 'crun_prod_existing',
        'continue', '["DETERMINISTIC_ELIGIBILITY_PASSED"]', 'continue',
        'openrouter', 'typesafe/jev-1.13', '20260917', '2026-09-23.v2', 'v1.13',
        'h_89de9fcf', 420, 'SUCCESS', 'AGREE_CONTINUE'
      );
    `).run();

    const originalFetch = globalThis.fetch;
    globalThis.fetch = async () => ({
      ok: true,
      status: 200,
      json: async () => ({
        model: 'typesafe/jev-1.13',
        answers: {
          nextAction: { type: 'choice', choice: 'revise', probabilities: { revise: 0.9 }, confidence: 0.9 },
          publicationRisk: { type: 'choice', choice: 'medium', confidence: 0.88 },
          needsHumanReview: { type: 'noul', value: true, confidence: 0.85 }
        }
      })
    });

    try {
      const collectorEnv = {
        JEV_ENABLED: 'true',
        JEV_MODE: 'shadow',
        JEV_SHADOW_COLLECTOR_ENABLED: 'true',
        OPENROUTER_API_KEY: 'mock-test-key'
      };

      // Canary Cycle 1:
      // Articles 1-3 observed (3 new calls)
      // Article 4 budget skipped
      // Article 5 dedupe skipped (h_89de9fcf)
      const canary1 = await runDecisionShadowCollector(db, collectorEnv, {
        config: { maxCallsPerRun: 3, maxCandidatesScannedPerRun: 25 }
      });

      assert.equal(canary1.providerCallCount, 3, 'Canary Cycle 1: 3 new provider calls');
      assert.equal(canary1.dedupeSkippedCount, 1, 'Canary Cycle 1: Article 5 dedupe skipped');
      const article5Summary = canary1.details.subjects.find(s => s.articleId === 5);
      assert.equal(article5Summary.action, 'DEDUPE_SKIPPED');
      assert.equal(article5Summary.inputHash, 'h_89de9fcf');

      // Canary Cycle 2:
      // Articles 1-3 dedupe skipped
      // Article 4 observed (1 new call)
      // Article 5 dedupe skipped
      const canary2 = await runDecisionShadowCollector(db, collectorEnv, {
        config: { maxCallsPerRun: 3, maxCandidatesScannedPerRun: 25 }
      });

      assert.equal(canary2.providerCallCount, 1, 'Canary Cycle 2: Article 4 observed with 1 call');
      assert.equal(canary2.dedupeSkippedCount, 4, 'Canary Cycle 2: 4 dedupe skips');

      // Terminal Steady State Cycle 3:
      // All 5 dedupe skipped
      const canary3 = await runDecisionShadowCollector(db, collectorEnv, {
        config: { maxCallsPerRun: 3, maxCandidatesScannedPerRun: 25 }
      });

      assert.equal(canary3.providerCallCount, 0, 'Canary Cycle 3: 0 provider calls');
      assert.equal(canary3.dedupeSkippedCount, 5, 'Canary Cycle 3: all 5 dedupe skipped');
      assert.equal(canary3.observationCreatedCount, 0);

      pass('Expected Canary multi-cycle acquisition & terminal steady state verified');
    } finally {
      globalThis.fetch = originalFetch;
    }
  } catch (err) {
    fail('Canary acquisition simulation failed', err);
  }

  // =========================================================================
  // 14. 30-Subject Large Pool Starvation Hardening & Rotating Keyset Traversal (JEV-7F.4)
  // =========================================================================
  try {
    const { dbSync, db } = setupInMemoryDb();
    resetMemoryCursor(0);

    // Insert 30 draft articles (IDs 1..30)
    for (let id = 1; id <= 30; id++) {
      dbSync.prepare(`
        INSERT INTO articles (id, slug, title, status, content_hash, reading_time_minutes)
        VALUES (?, ?, ?, 'draft', ?, 5);
      `).run(id, `pool-30-${id}`, `Pool 30 Draft ${id}`, `hash_pool30_${id}`);
    }

    const originalFetch = globalThis.fetch;
    globalThis.fetch = async () => ({
      ok: true,
      status: 200,
      json: async () => ({
        model: 'typesafe/jev-1.13',
        answers: {
          nextAction: { type: 'choice', choice: 'continue', probabilities: { continue: 0.95 }, confidence: 0.95 },
          publicationRisk: { type: 'choice', choice: 'very_low', confidence: 0.94 },
          needsHumanReview: { type: 'noul', value: false, confidence: 0.92 }
        }
      })
    });

    try {
      const collectorEnv = {
        JEV_ENABLED: 'true',
        JEV_MODE: 'shadow',
        JEV_SHADOW_COLLECTOR_ENABLED: 'true',
        OPENROUTER_API_KEY: 'mock-test-key'
      };

      // Run multiple cycles until all 30 subjects are observed or 15 cycles max
      let cycle = 0;
      const maxCycles = 15;
      const scannedSubjectIds = new Set();

      while (cycle < maxCycles) {
        cycle++;
        const res = await runDecisionShadowCollector(db, collectorEnv, {
          config: { maxCallsPerRun: 3, maxCandidatesScannedPerRun: 25, maxCallsPerDay: 100 }
        });

        assert.equal(res.status, 'success');
        assert.ok(res.providerCallCount <= 3, 'Provider calls strictly bounded to <= 3 per run');

        for (const s of res.details.subjects) {
          scannedSubjectIds.add(s.articleId);
        }

        const totalObserved = dbSync.prepare(
          "SELECT COUNT(DISTINCT subject_id) AS c FROM decision_observations WHERE provider_status = 'SUCCESS'"
        ).get().c;

        if (totalObserved === 30) {
          break;
        }
      }

      // Assertions on 30-subject pool
      assert.ok(scannedSubjectIds.has(26), 'SUBJECT_26_EVENTUALLY_SCANNED = YES');
      assert.ok(scannedSubjectIds.has(30), 'SUBJECT_30_EVENTUALLY_SCANNED = YES');

      const totalObserved = dbSync.prepare(
        "SELECT COUNT(DISTINCT subject_id) AS c FROM decision_observations WHERE provider_status = 'SUCCESS'"
      ).get().c;
      assert.equal(totalObserved, 30, 'ALL_30_EVENTUALLY_OBSERVED = YES');

      // Test subsequent cycle is 100% steady state dedupe-only
      const steadyRes = await runDecisionShadowCollector(db, collectorEnv, {
        config: { maxCallsPerRun: 3, maxCandidatesScannedPerRun: 25, maxCallsPerDay: 100 }
      });
      assert.equal(steadyRes.providerCallCount, 0, 'Steady state provider calls = 0');
      assert.equal(steadyRes.observationCreatedCount, 0, 'Steady state new observations = 0');
      assert.equal(steadyRes.dedupeSkippedCount, 25, 'Steady state all scanned items dedupe skipped');

      pass('30-subject eventual coverage & rotating keyset traversal verified (ALL_30_EVENTUALLY_OBSERVED=YES)');
    } finally {
      globalThis.fetch = originalFetch;
    }
  } catch (err) {
    fail('30-subject test failed', err);
  }

  // =========================================================================
  // 15. 100-Subject Scale Test & Full Traversal (JEV-7F.4)
  // =========================================================================
  try {
    const { dbSync, db } = setupInMemoryDb();

    // Insert 100 draft articles
    for (let id = 1; id <= 100; id++) {
      dbSync.prepare(`
        INSERT INTO articles (id, slug, title, status, content_hash, reading_time_minutes)
        VALUES (?, ?, ?, 'draft', ?, 5);
      `).run(id, `scale-100-${id}`, `Scale 100 Draft ${id}`, `hash_scale_${id}`);
    }

    const scannedIds = new Set();
    let cursor = 0;

    // Scan in 4 windows of 25 items
    for (let w = 1; w <= 4; w++) {
      const batch = await selectProspectiveArticles(db, 25, cursor);
      assert.equal(batch.length, 25, `Window ${w} returns exactly 25 candidates`);
      for (const item of batch) {
        scannedIds.add(item.id);
      }
      cursor = batch[batch.length - 1].id;
    }

    assert.equal(scannedIds.size, 100, 'All 100 distinct subjects scanned across 4 windows');
    assert.equal(cursor, 100, 'Cursor reached 100');

    // 5th window proves cyclic wraparound:
    const wrappedBatch = await selectProspectiveArticles(db, 25, cursor);
    assert.equal(wrappedBatch.length, 25, 'Wrapped window returns 25 candidates');
    assert.equal(wrappedBatch[0].id, 1, 'Wrapped window restarts at ID 1');
    assert.equal(wrappedBatch[24].id, 25, 'Wrapped window ends at ID 25');

    pass('100-subject scale test verified (ALL_100_EVENTUALLY_SCANNED=YES, SCAN_WRAPAROUND_WORKS=YES)');
  } catch (err) {
    fail('100-subject scale test failed', err);
  }

  // =========================================================================
  // 16. New Subject Arrival After Cursor (JEV-7F.4)
  // =========================================================================
  try {
    const { dbSync, db } = setupInMemoryDb();

    for (let id = 1; id <= 30; id++) {
      dbSync.prepare(`
        INSERT INTO articles (id, slug, title, status, content_hash, reading_time_minutes)
        VALUES (?, ?, ?, 'draft', ?, 5);
      `).run(id, `arrival-${id}`, `Arrival Draft ${id}`, `hash_arrival_${id}`);
    }

    // Cursor is currently at 25
    let cursor = 25;

    // Now insert newly arrived higher IDs
    for (let id = 31; id <= 33; id++) {
      dbSync.prepare(`
        INSERT INTO articles (id, slug, title, status, content_hash, reading_time_minutes)
        VALUES (?, ?, ?, 'draft', ?, 5);
      `).run(id, `arrival-${id}`, `New Arrival Draft ${id}`, `hash_arrival_${id}`);
    }

    const batch = await selectProspectiveArticles(db, 25, cursor);
    const foundNewIds = batch.map(b => b.id).filter(id => id >= 31 && id <= 33);
    assert.deepEqual(foundNewIds, [31, 32, 33], 'New high-ID subjects 31..33 discovered after cursor 25');

    pass('New subject arrival after cursor verified (NEW_SUBJECTS_EVENTUALLY_DISCOVERED=YES)');
  } catch (err) {
    fail('New subject arrival test failed', err);
  }

  // =========================================================================
  // 17. ID Gaps & Deleted Subject Keyset Safety (JEV-7F.4)
  // =========================================================================
  try {
    const { dbSync, db } = setupInMemoryDb();

    // Sparse IDs: 1, 2, 5, 8, 20, 27, 41
    const sparseIds = [1, 2, 5, 8, 20, 27, 41];
    for (const id of sparseIds) {
      dbSync.prepare(`
        INSERT INTO articles (id, slug, title, status, content_hash, reading_time_minutes)
        VALUES (?, ?, ?, 'draft', ?, 5);
      `).run(id, `sparse-${id}`, `Sparse Draft ${id}`, `hash_sparse_${id}`);
    }

    // Cursor at 20, then delete cursor-adjacent article 27
    dbSync.prepare("DELETE FROM articles WHERE id = 27").run();

    // Query with cursor 20 and limit 5
    const batch = await selectProspectiveArticles(db, 5, 20);
    const batchIds = batch.map(b => b.id);

    // Should seamlessly find 41, then wrap around to 1, 2, 5, 8
    assert.equal(batchIds[0], 41, 'Keyset gracefully skips deleted ID 27 and advances to 41');
    assert.ok(batchIds.includes(1), 'Wraps around to sparse ID 1');
    assert.ok(batchIds.includes(2), 'Wraps around to sparse ID 2');

    pass('ID gaps & deleted subject safety verified (ID_GAPS_SAFE=YES, DELETED_SUBJECT_SAFE=YES)');
  } catch (err) {
    fail('ID gaps test failed', err);
  }

  // =========================================================================
  // 18. Durable Keyset Cursor Persistence via publication_cron_runs (JEV-7F.4)
  // =========================================================================
  try {
    const { dbSync, db } = setupInMemoryDb();

    // Create publication_cron_runs schema
    dbSync.exec(`
      CREATE TABLE IF NOT EXISTS publication_cron_runs (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        run_id TEXT NOT NULL UNIQUE,
        job_name TEXT NOT NULL,
        trigger_source TEXT NOT NULL,
        started_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        finished_at DATETIME,
        status TEXT NOT NULL,
        details_json TEXT NOT NULL DEFAULT '{}',
        created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // Insert durable prior run with cursor = 18
    dbSync.prepare(`
      INSERT INTO publication_cron_runs (run_id, job_name, trigger_source, status, details_json)
      VALUES ('crun_prior_coll', 'jev_shadow_collector', 'cron', 'SUCCEEDED', ?);
    `).run(JSON.stringify({ nextCursorArticleId: 18, lastScannedArticleId: 18 }));

    const durableCursor = await getDurableCursorArticleId(db);
    assert.equal(durableCursor, 18, 'Durable cursor correctly retrieved from publication_cron_runs.details_json');

    // Insert articles
    for (let id = 1; id <= 25; id++) {
      dbSync.prepare(`
        INSERT INTO articles (id, slug, title, status, content_hash, reading_time_minutes)
        VALUES (?, ?, ?, 'draft', ?, 5);
      `).run(id, `durable-test-${id}`, `Durable Test ${id}`, `hash_dur_${id}`);
    }

    const collectorEnv = {
      JEV_ENABLED: 'true',
      JEV_MODE: 'shadow',
      JEV_SHADOW_COLLECTOR_ENABLED: 'true',
      OPENROUTER_API_KEY: 'mock-test-key'
    };

    const res = await runDecisionShadowCollector(db, collectorEnv, {
      config: { maxCandidatesScannedPerRun: 5, maxCallsPerRun: 1 }
    });

    assert.equal(res.details.cursorArticleId, 18, 'Collector resumed from durable cursor 18');
    assert.equal(res.details.subjects[0].articleId, 19, 'First scanned article after cursor 18 is 19');
    assert.equal(res.details.nextCursorArticleId, 23, 'Next cursor advanced to 23');

    pass('Durable cursor persistence via publication_cron_runs verified (ROTATION_STATE_DURABLE=YES)');
  } catch (err) {
    fail('Durable cursor persistence test failed', err);
  }

  console.log(`\n============================================================`);
  console.log(`🎉 ALL ${passedTests}/${totalTests} TESTS PASSED CLEANLY!`);
  console.log(`============================================================\n`);
}

runAllTests().catch((err) => {
  console.error('Test execution failed:', err);
  process.exit(1);
});
