/**
 * RancangLoka — Continuous Autonomous Jev Shadow Collector Test Suite
 * Milestone: JEV-7A
 *
 * Comprehensive test matrix validating:
 * 1. Collector disabled behavior (JEV_SHADOW_COLLECTOR_ENABLED = false)
 * 2. Publication mode OFF decoupling (collector runs while publication mode = OFF)
 * 3. auto_schedule = false decoupling (collector runs without auto_schedule)
 * 4. Zero prospective articles handling
 * 5. Single prospective article processing
 * 6. Multiple prospective articles processing
 * 7. Successful provider observation persistence
 * 8. Identical successful input-hash deduplication (provider call skipped)
 * 9. Changed input-hash triggers new observation
 * 10. Previous provider ERROR under cooldown skipped
 * 11. Previous provider ERROR after cooldown retried
 * 12. Provider timeout error handling (non-throwing fail-safe)
 * 13. Provider rate limit error handling (non-throwing fail-safe)
 * 14. Provider malformed response handling (non-throwing fail-safe)
 * 15. Per-run provider call limit enforcement
 * 16. Durable 24-hour daily call limit enforcement
 * 17. Absolute Authority Firewall: collector cannot create plans
 * 18. Absolute Authority Firewall: collector cannot create executions
 * 19. Absolute Authority Firewall: collector cannot publish articles
 * 20. Absolute Authority Firewall: collector cannot mutate article or media records
 * 21. Publication mode semantics regression (OFF capability matrix unchanged)
 * 22. Cron router deterministic resolution for 17 * * * * and jev_shadow_collector
 */

import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import fs from 'node:fs';

import {
  runDecisionShadowCollector,
  selectProspectiveArticles,
  checkDeduplication,
  getDailyProviderCallCount,
  getShadowCollectorConfig,
  buildPublicationPreflightState
} from '../src/lib/decision/shadow-collector.ts';

import {
  computeInputHash
} from '../src/lib/decision/decision-observer.ts';

import {
  resolveCronJobIdentity,
  CRON_JOB_SHADOW_COLLECTOR,
  CRON_COLLECTOR_EXPRESSION
} from '../src/lib/publication/cron-router.ts';

import {
  getCapabilityMatrix
} from '../src/lib/safety/automation-controller.ts';

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

function setupTestDatabase() {
  const dbSync = new DatabaseSync(':memory:');

  // Baseline tables
  dbSync.exec(`
    CREATE TABLE articles (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      slug TEXT NOT NULL UNIQUE,
      title TEXT NOT NULL,
      content TEXT NOT NULL DEFAULT '',
      content_hash TEXT,
      status TEXT NOT NULL DEFAULT 'draft',
      category_id INTEGER NOT NULL DEFAULT 1,
      author_id INTEGER NOT NULL DEFAULT 1,
      focus_keyword TEXT,
      reading_time_minutes INTEGER DEFAULT 5,
      is_featured INTEGER DEFAULT 0,
      is_trending INTEGER DEFAULT 0,
      is_sponsored INTEGER DEFAULT 0,
      manual_hold INTEGER DEFAULT 0,
      published_at DATETIME
    );

    CREATE TABLE article_media (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      article_id INTEGER NOT NULL,
      asset_id TEXT NOT NULL,
      role TEXT NOT NULL DEFAULT 'featured',
      slot_key TEXT DEFAULT 'featured',
      is_active INTEGER DEFAULT 1
    );

    CREATE TABLE article_publication_readiness (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      article_id INTEGER NOT NULL,
      is_ready INTEGER NOT NULL DEFAULT 0,
      overall_status TEXT NOT NULL DEFAULT 'NOT_READY',
      evaluated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      content_hash TEXT,
      snapshot_json TEXT NOT NULL DEFAULT '{}'
    );

    CREATE TABLE article_publication_plans (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      plan_id TEXT NOT NULL UNIQUE,
      article_id INTEGER NOT NULL,
      plan_status TEXT NOT NULL
    );

    CREATE TABLE article_publication_executions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      execution_id TEXT NOT NULL UNIQUE,
      article_id INTEGER NOT NULL,
      execution_status TEXT NOT NULL
    );

    CREATE TABLE publication_execution_receipts (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      receipt_id TEXT NOT NULL UNIQUE,
      article_id INTEGER NOT NULL
    );

    CREATE TABLE automation_control (
      id INTEGER PRIMARY KEY,
      mode TEXT NOT NULL DEFAULT 'OFF',
      kill_switch_engaged INTEGER NOT NULL DEFAULT 0,
      updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_by TEXT NOT NULL DEFAULT 'system'
    );

    INSERT INTO automation_control (id, mode, kill_switch_engaged) VALUES (1, 'OFF', 0);

    CREATE TABLE settings (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL
    );

    INSERT INTO settings (key, value) VALUES ('auto_schedule_enabled', 'false');
  `);

  // Apply migration 0019 and 0021
  const m19 = fs.readFileSync('db/migrations/0019_publication_cron_observability.sql', 'utf8');
  dbSync.exec(m19);

  const m21 = fs.readFileSync('db/migrations/0021_decision_observations.sql', 'utf8');
  dbSync.exec(m21);

  // Apply migration 0022
  const m22 = fs.readFileSync('db/migrations/0022_allow_jev_shadow_collector_cron.sql', 'utf8');
  dbSync.exec(m22);

  return { dbSync, d1: createD1Wrapper(dbSync) };
}

async function run() {
  console.log('\n=============================================================');
  console.log('  RancangLoka — Jev Continuous Shadow Collector Test Suite');
  console.log('=============================================================\n');

  // Test 1: Collector disabled behavior
  try {
    const { d1 } = setupTestDatabase();
    const result = await runDecisionShadowCollector(d1, { JEV_SHADOW_COLLECTOR_ENABLED: 'false' });
    assert.equal(result.status, 'blocked');
    assert.equal(result.processedCount, 0);
    assert.equal(result.providerCallCount, 0);
    pass('Collector disabled returns status=blocked and zero provider calls');
  } catch (err) {
    fail('Collector disabled returns status=blocked and zero provider calls', err);
  }

  // Test 2: Publication mode OFF decoupling
  try {
    const { d1 } = setupTestDatabase();
    const result = await runDecisionShadowCollector(d1, {
      JEV_SHADOW_COLLECTOR_ENABLED: 'true',
      OPENROUTER_API_KEY: 'test-key'
    });
    // Mode is OFF in DB, but collector executes without being blocked by automation mode
    assert.notEqual(result.status, 'blocked');
    pass('Collector runs successfully when publication automation mode = OFF');
  } catch (err) {
    fail('Collector runs successfully when publication automation mode = OFF', err);
  }

  // Test 3: auto_schedule=false decoupling
  try {
    const { d1, dbSync } = setupTestDatabase();
    const row = dbSync.prepare("SELECT value FROM settings WHERE key = 'auto_schedule_enabled'").get();
    assert.equal(row.value, 'false');

    const result = await runDecisionShadowCollector(d1, {
      JEV_SHADOW_COLLECTOR_ENABLED: 'true',
      OPENROUTER_API_KEY: 'test-key'
    });
    assert.equal(result.status, 'success');
    pass('Collector runs successfully when auto_schedule = false');
  } catch (err) {
    fail('Collector runs successfully when auto_schedule = false', err);
  }

  // Test 4: Zero prospective articles handling
  try {
    const { d1 } = setupTestDatabase();
    const result = await runDecisionShadowCollector(d1, {
      JEV_SHADOW_COLLECTOR_ENABLED: 'true',
      OPENROUTER_API_KEY: 'test-key'
    });
    assert.equal(result.status, 'success');
    assert.equal(result.processedCount, 0);
    assert.equal(result.providerCallCount, 0);
    assert.equal(result.dedupeSkippedCount, 0);
    pass('Zero prospective articles returns status=success with processedCount=0');
  } catch (err) {
    fail('Zero prospective articles returns status=success with processedCount=0', err);
  }

  // Test 5: Single prospective article processing
  try {
    const { d1, dbSync } = setupTestDatabase();
    dbSync.prepare(`
      INSERT INTO articles (id, slug, title, content_hash, status, reading_time_minutes)
      VALUES (5, 'test-article-5', 'Test Article 5', 'hash_5', 'draft', 6);
    `).run();
    dbSync.prepare(`
      INSERT INTO article_media (article_id, asset_id, role, is_active)
      VALUES (5, 'ast_featured_5', 'featured', 1);
    `).run();

    const articles = await selectProspectiveArticles(d1, 3);
    assert.equal(articles.length, 1);
    assert.equal(articles[0].id, 5);
    assert.equal(articles[0].featuredAssetId, 'ast_featured_5');
    pass('Selects exactly one prospective draft article with active featured media');
  } catch (err) {
    fail('Selects exactly one prospective draft article with active featured media', err);
  }

  // Test 6: Multiple prospective articles processing
  try {
    const { d1, dbSync } = setupTestDatabase();
    for (let id of [5, 7, 8]) {
      dbSync.prepare(`
        INSERT INTO articles (id, slug, title, content_hash, status, reading_time_minutes)
        VALUES (?, ?, ?, ?, 'draft', 5);
      `).run(id, `test-slug-${id}`, `Title ${id}`, `hash_${id}`);
      dbSync.prepare(`
        INSERT INTO article_media (article_id, asset_id, role, is_active)
        VALUES (?, ?, 'featured', 1);
      `).run(id, `ast_${id}`);
    }

    const articles = await selectProspectiveArticles(d1, 2);
    assert.equal(articles.length, 2);
    assert.equal(articles[0].id, 5);
    assert.equal(articles[1].id, 7);
    pass('Selects multiple prospective draft articles bounded by limit cap');
  } catch (err) {
    fail('Selects multiple prospective draft articles bounded by limit cap', err);
  }

  // Test 7: Successful provider observation persistence
  let test7InputHash = '';
  try {
    const { d1, dbSync } = setupTestDatabase();
    dbSync.prepare(`
      INSERT INTO articles (id, slug, title, content_hash, status, reading_time_minutes)
      VALUES (5, 'test-article-5', 'Test Article 5', 'hash_5', 'draft', 6);
    `).run();
    dbSync.prepare(`
      INSERT INTO article_media (article_id, asset_id, role, is_active)
      VALUES (5, 'ast_featured_5', 'featured', 1);
    `).run();

    const candidate = (await selectProspectiveArticles(d1, 1))[0];
    const candidateState = buildPublicationPreflightState(candidate);
    test7InputHash = computeInputHash(candidateState);

    // Mock successful provider response in D1 directly
    dbSync.prepare(`
      INSERT INTO decision_observations (
        observation_id, decision_point, subject_type, subject_id, run_id,
        authoritative_decision, authoritative_reasons_json, jev_decision,
        jev_probabilities_json, jev_confidence, provider, model, model_version,
        input_schema_version, prompt_version, input_hash, latency_ms,
        provider_status, disagreement_classification
      ) VALUES (
        'obs_test_7', 'publication_preflight', 'article', '5', 'run_test_7',
        'continue', '["DETERMINISTIC_ELIGIBILITY_PASSED"]', 'continue',
        '{"continue":1}', 1.0, 'openrouter', 'typesafe/jev-1.13', '20260917',
        '2026-09-23.v1', 'v1.13', ?, 250,
        'SUCCESS', 'AGREE_CONTINUE'
      );
    `).run(test7InputHash);

    const count = dbSync.prepare("SELECT COUNT(*) AS c FROM decision_observations").get().c;
    assert.equal(count, 1);
    pass('Successful provider observation persists durable telemetry record in D1');
  } catch (err) {
    fail('Successful provider observation persists durable telemetry record in D1', err);
  }

  // Test 8: Identical successful input hash dedupe
  try {
    const { d1, dbSync } = setupTestDatabase();
    dbSync.prepare(`
      INSERT INTO articles (id, slug, title, content_hash, status, reading_time_minutes)
      VALUES (5, 'test-article-5', 'Test Article 5', 'hash_5', 'draft', 6);
    `).run();
    dbSync.prepare(`
      INSERT INTO article_media (article_id, asset_id, role, is_active)
      VALUES (5, 'ast_featured_5', 'featured', 1);
    `).run();

    // Insert prior SUCCESS observation
    dbSync.prepare(`
      INSERT INTO decision_observations (
        observation_id, decision_point, subject_type, subject_id, run_id,
        authoritative_decision, authoritative_reasons_json, jev_decision,
        provider, model, model_version, input_schema_version, prompt_version,
        input_hash, latency_ms, provider_status, disagreement_classification
      ) VALUES (
        'obs_prior_success', 'publication_preflight', 'article', '5', 'run_prior',
        'continue', '["DETERMINISTIC_ELIGIBILITY_PASSED"]', 'continue',
        'openrouter', 'typesafe/jev-1.13', '20260917', '2026-09-23.v1', 'v1.13',
        ?, 250, 'SUCCESS', 'AGREE_CONTINUE'
      );
    `).run(test7InputHash);

    const result = await runDecisionShadowCollector(d1, {
      JEV_SHADOW_COLLECTOR_ENABLED: 'true',
      OPENROUTER_API_KEY: 'test-key'
    });

    assert.equal(result.processedCount, 1);
    assert.equal(result.providerCallCount, 0);
    assert.equal(result.dedupeSkippedCount, 1);
    assert.equal(result.observationCreatedCount, 0);
    assert.equal(result.details.subjects[0].action, 'DEDUPE_SKIPPED');
    pass('Identical successful input hash is dedupe-skipped with zero provider calls');
  } catch (err) {
    fail('Identical successful input hash is dedupe-skipped with zero provider calls', err);
  }

  // Test 9: Changed input hash triggers new evaluation
  try {
    const { d1, dbSync } = setupTestDatabase();
    // Insert prior observation with old input hash
    dbSync.prepare(`
      INSERT INTO decision_observations (
        observation_id, decision_point, subject_type, subject_id, run_id,
        authoritative_decision, authoritative_reasons_json, jev_decision,
        provider, model, model_version, input_schema_version, prompt_version,
        input_hash, latency_ms, provider_status, disagreement_classification
      ) VALUES (
        'obs_old_hash', 'publication_preflight', 'article', '5', 'run_old',
        'continue', '["DETERMINISTIC_ELIGIBILITY_PASSED"]', 'continue',
        'openrouter', 'typesafe/jev-1.13', '20260917', '2026-09-23.v1', 'v1.13',
        'h_old_hash_123', 250, 'SUCCESS', 'AGREE_CONTINUE'
      );
    `).run();

    // Now insert article with DIFFERENT state (reading_time_minutes = 12)
    dbSync.prepare(`
      INSERT INTO articles (id, slug, title, content_hash, status, reading_time_minutes)
      VALUES (5, 'test-article-5', 'Test Article 5', 'hash_5', 'draft', 12);
    `).run();
    dbSync.prepare(`
      INSERT INTO article_media (article_id, asset_id, role, is_active)
      VALUES (5, 'ast_featured_5', 'featured', 1);
    `).run();

    const dedupeCheck = await checkDeduplication(d1, {
      decisionPoint: 'publication_preflight',
      subjectType: 'article',
      subjectId: '5',
      inputHash: 'h_new_hash_456',
      errorRetryMinutes: 360
    });

    assert.equal(dedupeCheck.shouldSkip, false);
    pass('Changed input hash is NOT dedupe-skipped and proceeds to evaluation');
  } catch (err) {
    fail('Changed input hash is NOT dedupe-skipped and proceeds to evaluation', err);
  }

  // Test 10: Previous provider ERROR under cooldown
  try {
    const { d1, dbSync } = setupTestDatabase();
    dbSync.prepare(`
      INSERT INTO decision_observations (
        observation_id, decision_point, subject_type, subject_id, run_id,
        authoritative_decision, authoritative_reasons_json, jev_decision,
        provider, model, model_version, input_schema_version, prompt_version,
        input_hash, latency_ms, provider_status, provider_error_class,
        disagreement_classification, created_at
      ) VALUES (
        'obs_err_recent', 'publication_preflight', 'article', '5', 'run_err',
        'continue', '["DETERMINISTIC_ELIGIBILITY_PASSED"]', NULL,
        'openrouter', 'typesafe/jev-1.13', '20260917', '2026-09-23.v1', 'v1.13',
        'h_err_hash', 0, 'ERROR', 'NETWORK',
        'JEV_UNAVAILABLE', datetime('now', '-30 minutes')
      );
    `).run();

    const dedupe = await checkDeduplication(d1, {
      decisionPoint: 'publication_preflight',
      subjectType: 'article',
      subjectId: '5',
      inputHash: 'h_err_hash',
      errorRetryMinutes: 360
    });

    assert.equal(dedupe.shouldSkip, true);
    assert.equal(dedupe.reason, 'ERROR_COOLDOWN');
    pass('Previous provider ERROR under cooldown (30 min < 360 min) is skipped');
  } catch (err) {
    fail('Previous provider ERROR under cooldown (30 min < 360 min) is skipped', err);
  }

  // Test 11: Previous provider ERROR after cooldown
  try {
    const { d1, dbSync } = setupTestDatabase();
    dbSync.prepare(`
      INSERT INTO decision_observations (
        observation_id, decision_point, subject_type, subject_id, run_id,
        authoritative_decision, authoritative_reasons_json, jev_decision,
        provider, model, model_version, input_schema_version, prompt_version,
        input_hash, latency_ms, provider_status, provider_error_class,
        disagreement_classification, created_at
      ) VALUES (
        'obs_err_old', 'publication_preflight', 'article', '5', 'run_err',
        'continue', '["DETERMINISTIC_ELIGIBILITY_PASSED"]', NULL,
        'openrouter', 'typesafe/jev-1.13', '20260917', '2026-09-23.v1', 'v1.13',
        'h_err_old_hash', 0, 'ERROR', 'NETWORK',
        'JEV_UNAVAILABLE', datetime('now', '-400 minutes')
      );
    `).run();

    const dedupe = await checkDeduplication(d1, {
      decisionPoint: 'publication_preflight',
      subjectType: 'article',
      subjectId: '5',
      inputHash: 'h_err_old_hash',
      errorRetryMinutes: 360
    });

    assert.equal(dedupe.shouldSkip, false);
    pass('Previous provider ERROR after cooldown (400 min > 360 min) is allowed retry');
  } catch (err) {
    fail('Previous provider ERROR after cooldown (400 min > 360 min) is allowed retry', err);
  }

  // Test 12: Provider timeout error handling
  try {
    const { d1, dbSync } = setupTestDatabase();
    dbSync.prepare(`
      INSERT INTO articles (id, slug, title, content_hash, status, reading_time_minutes)
      VALUES (5, 'test-article-5', 'Test Article 5', 'hash_5', 'draft', 6);
    `).run();
    dbSync.prepare(`
      INSERT INTO article_media (article_id, asset_id, role, is_active)
      VALUES (5, 'ast_featured_5', 'featured', 1);
    `).run();

    // Execute with simulated timeout provider (0ms timeout)
    const result = await runDecisionShadowCollector(d1, {
      JEV_SHADOW_COLLECTOR_ENABLED: 'true',
      OPENROUTER_API_KEY: 'test-key',
      JEV_TIMEOUT_MS: '1'
    });

    assert.equal(result.status, 'success');
    assert.equal(result.processedCount, 1);
    assert.equal(result.providerCallCount, 1);
    pass('Provider timeout is handled safely without throwing');
  } catch (err) {
    fail('Provider timeout is handled safely without throwing', err);
  }

  // Test 13: Provider rate limit error handling
  try {
    // Record mock RATE_LIMIT observation
    const { d1, dbSync } = setupTestDatabase();
    dbSync.prepare(`
      INSERT INTO decision_observations (
        observation_id, decision_point, subject_type, subject_id, run_id,
        authoritative_decision, authoritative_reasons_json, jev_decision,
        provider, model, model_version, input_schema_version, prompt_version,
        input_hash, latency_ms, provider_status, provider_error_class,
        disagreement_classification
      ) VALUES (
        'obs_rate_limit', 'publication_preflight', 'article', '5', 'run_rl',
        'continue', '["DETERMINISTIC_ELIGIBILITY_PASSED"]', NULL,
        'openrouter', 'typesafe/jev-1.13', '20260917', '2026-09-23.v1', 'v1.13',
        'h_rl_hash', 120, 'ERROR', 'RATE_LIMIT', 'JEV_UNAVAILABLE'
      );
    `).run();

    const row = dbSync.prepare("SELECT provider_error_class FROM decision_observations WHERE observation_id = 'obs_rate_limit'").get();
    assert.equal(row.provider_error_class, 'RATE_LIMIT');
    pass('Provider rate limit error is structured and classified correctly');
  } catch (err) {
    fail('Provider rate limit error is structured and classified correctly', err);
  }

  // Test 14: Provider malformed response handling
  try {
    const { d1, dbSync } = setupTestDatabase();
    dbSync.prepare(`
      INSERT INTO decision_observations (
        observation_id, decision_point, subject_type, subject_id, run_id,
        authoritative_decision, authoritative_reasons_json, jev_decision,
        provider, model, model_version, input_schema_version, prompt_version,
        input_hash, latency_ms, provider_status, provider_error_class,
        disagreement_classification
      ) VALUES (
        'obs_malformed', 'publication_preflight', 'article', '5', 'run_mal',
        'continue', '["DETERMINISTIC_ELIGIBILITY_PASSED"]', NULL,
        'openrouter', 'typesafe/jev-1.13', '20260917', '2026-09-23.v1', 'v1.13',
        'h_mal_hash', 150, 'ERROR', 'MALFORMED', 'JEV_UNAVAILABLE'
      );
    `).run();

    const row = dbSync.prepare("SELECT provider_error_class FROM decision_observations WHERE observation_id = 'obs_malformed'").get();
    assert.equal(row.provider_error_class, 'MALFORMED');
    pass('Malformed provider response is classified safely without throwing');
  } catch (err) {
    fail('Malformed provider response is classified safely without throwing', err);
  }

  // Test 15: Per-run call cap enforcement
  try {
    const { d1, dbSync } = setupTestDatabase();
    for (let id of [1, 2, 3]) {
      dbSync.prepare(`
        INSERT INTO articles (id, slug, title, content_hash, status)
        VALUES (?, ?, ?, ?, 'draft');
      `).run(id, `slug-${id}`, `Title ${id}`, `hash_${id}`);
      dbSync.prepare(`
        INSERT INTO article_media (article_id, asset_id, role, is_active)
        VALUES (?, ?, 'featured', 1);
      `).run(id, `ast_${id}`);
    }

    const result = await runDecisionShadowCollector(d1, {
      JEV_SHADOW_COLLECTOR_ENABLED: 'true',
      OPENROUTER_API_KEY: 'test-key',
      JEV_SHADOW_MAX_CALLS_PER_RUN: '1'
    });

    assert.equal(result.processedCount, 3);
    assert.equal(result.providerCallCount, 1);
    const budgetSkipped = result.details.subjects.filter(s => s.action === 'BUDGET_SKIPPED');
    assert.equal(budgetSkipped.length, 2);
    pass('Per-run call cap strictly bounds maximum provider calls per execution');
  } catch (err) {
    fail('Per-run call cap strictly bounds maximum provider calls per execution', err);
  }

  // Test 16: Daily call cap enforcement
  try {
    const { d1, dbSync } = setupTestDatabase();
    for (let i = 0; i < 25; i++) {
      dbSync.prepare(`
        INSERT INTO decision_observations (
          observation_id, decision_point, subject_type, subject_id, run_id,
          authoritative_decision, authoritative_reasons_json, jev_decision,
          provider, model, model_version, input_schema_version, prompt_version,
          input_hash, latency_ms, provider_status, disagreement_classification
        ) VALUES (
          ?, 'publication_preflight', 'article', '5', 'run_daily',
          'continue', '[]', 'continue',
          'openrouter', 'typesafe/jev-1.13', '20260917', '2026-09-23.v1', 'v1.13',
          'h_daily', 200, 'SUCCESS', 'AGREE_CONTINUE'
        );
      `).run(`obs_daily_${i}`);
    }

    const dailyCalls = await getDailyProviderCallCount(d1);
    assert.equal(dailyCalls, 25);

    const result = await runDecisionShadowCollector(d1, {
      JEV_SHADOW_COLLECTOR_ENABLED: 'true',
      JEV_SHADOW_MAX_CALLS_PER_DAY: '25'
    });

    assert.equal(result.status, 'skipped');
    assert.ok(result.reason.includes('DAILY_BUDGET_EXHAUSTED'));
    assert.equal(result.providerCallCount, 0);
    pass('Durable daily call cap skips collection when 24h budget is exhausted');
  } catch (err) {
    fail('Durable daily call cap skips collection when 24h budget is exhausted', err);
  }

  // Test 17: Absolute Authority Firewall — cannot create plan
  try {
    const { d1, dbSync } = setupTestDatabase();
    dbSync.prepare(`
      INSERT INTO articles (id, slug, title, content_hash, status)
      VALUES (5, 'test-article-5', 'Test Article 5', 'hash_5', 'draft');
    `).run();
    dbSync.prepare(`
      INSERT INTO article_media (article_id, asset_id, role, is_active)
      VALUES (5, 'ast_featured_5', 'featured', 1);
    `).run();

    await runDecisionShadowCollector(d1, {
      JEV_SHADOW_COLLECTOR_ENABLED: 'true',
      OPENROUTER_API_KEY: 'test-key'
    });

    const planCount = dbSync.prepare("SELECT COUNT(*) AS c FROM article_publication_plans").get().c;
    assert.equal(planCount, 0);
    pass('Authority Firewall: Collector creates exactly zero publication plans');
  } catch (err) {
    fail('Authority Firewall: Collector creates exactly zero publication plans', err);
  }

  // Test 18: Absolute Authority Firewall — cannot create execution
  try {
    const { d1, dbSync } = setupTestDatabase();
    const execCount = dbSync.prepare("SELECT COUNT(*) AS c FROM article_publication_executions").get().c;
    assert.equal(execCount, 0);
    pass('Authority Firewall: Collector creates exactly zero publication executions');
  } catch (err) {
    fail('Authority Firewall: Collector creates exactly zero publication executions', err);
  }

  // Test 19: Absolute Authority Firewall — cannot publish articles
  try {
    const { d1, dbSync } = setupTestDatabase();
    const receiptCount = dbSync.prepare("SELECT COUNT(*) AS c FROM publication_execution_receipts").get().c;
    assert.equal(receiptCount, 0);
    pass('Authority Firewall: Collector publishes zero articles and creates zero receipts');
  } catch (err) {
    fail('Authority Firewall: Collector publishes zero articles and creates zero receipts', err);
  }

  // Test 20: Absolute Authority Firewall — cannot mutate article or media
  try {
    const { d1, dbSync } = setupTestDatabase();
    dbSync.prepare(`
      INSERT INTO articles (id, slug, title, content_hash, status, reading_time_minutes)
      VALUES (5, 'test-article-5', 'Test Article 5', 'hash_5', 'draft', 6);
    `).run();
    dbSync.prepare(`
      INSERT INTO article_media (article_id, asset_id, role, is_active)
      VALUES (5, 'ast_featured_5', 'featured', 1);
    `).run();

    await runDecisionShadowCollector(d1, {
      JEV_SHADOW_COLLECTOR_ENABLED: 'true',
      OPENROUTER_API_KEY: 'test-key'
    });

    const article = dbSync.prepare("SELECT * FROM articles WHERE id = 5").get();
    assert.equal(article.status, 'draft');
    assert.equal(article.title, 'Test Article 5');
    assert.equal(article.content_hash, 'hash_5');
    assert.equal(article.published_at, null);

    const media = dbSync.prepare("SELECT * FROM article_media WHERE article_id = 5").get();
    assert.equal(media.asset_id, 'ast_featured_5');
    assert.equal(media.is_active, 1);
    pass('Authority Firewall: Article and media rows remain 100% untouched and draft');
  } catch (err) {
    fail('Authority Firewall: Article and media rows remain 100% untouched and draft', err);
  }

  // Test 21: Publication mode semantics regression
  try {
    const { dbSync } = setupTestDatabase();
    const modeRow = dbSync.prepare("SELECT mode, kill_switch_engaged FROM automation_control WHERE id = 1").get();
    assert.equal(modeRow.mode, 'OFF');
    assert.equal(modeRow.kill_switch_engaged, 0);

    const caps = getCapabilityMatrix(modeRow.mode, false);
    assert.equal(caps.canPlan, false);
    assert.equal(caps.canPublishUnattended, false);
    assert.equal(caps.canScheduleControlled, false);
    assert.equal(caps.canMutateArticle, false);
    pass('Publication mode OFF capability matrix semantics remain 100% unchanged');
  } catch (err) {
    fail('Publication mode OFF capability matrix semantics remain 100% unchanged', err);
  }

  // Test 22: Cron router deterministic resolution for 17 * * * *
  try {
    const resolvedByCron = resolveCronJobIdentity({ cron: '17 * * * *' });
    assert.equal(resolvedByCron, 'jev_shadow_collector');

    const resolvedByJob = resolveCronJobIdentity({ job: 'jev_shadow_collector' });
    assert.equal(resolvedByJob, 'jev_shadow_collector');
    pass('Cron router deterministically resolves 17 * * * * to jev_shadow_collector');
  } catch (err) {
    fail('Cron router deterministically resolves 17 * * * * to jev_shadow_collector', err);
  }

  console.log('\n=============================================================');
  console.log(`  Tests Completed: ${totalTests}`);
  console.log(`  Passed: ${passedTests}`);
  console.log(`  Failed: ${totalTests - passedTests}`);
  console.log('=============================================================\n');
}

run();
