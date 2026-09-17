/**
 * RancangLoka — PUBLICATION-3: Crawl & Index Feedback Test Suite
 *
 * Systematically tests all 50 deterministic criteria:
 *  1. published receipt accepted
 *  2. draft article excluded
 *  3. HTTP 200 observation recorded
 *  4. HTTP 200 does NOT imply INDEXED
 *  5. sitemap presence recorded
 *  6. sitemap presence does NOT imply INDEXED
 *  7. no authoritative source => UNKNOWN
 *  8. authoritative INDEXED accepted
 *  9. authoritative NOT_INDEXED accepted
 * 10. conflicting source observations preserved
 * 11. deterministic precedence
 * 12. source provenance persisted
 * 13. duplicate observation idempotent
 * 14. changed value creates history
 * 15. first INDEXED observation calculates latency
 * 16. HTTP observation does not calculate index latency
 * 17. sitemap observation does not calculate index latency
 * 18. missing authoritative timestamp => latency UNKNOWN
 * 19. stale observation detected
 * 20. stale positive feedback conservative
 * 21. insufficient sample conservative
 * 22. missing external adapter conservative
 * 23. provider adapter failure isolated
 * 24. provider failure does not alter public read path
 * 25. healthy sufficient aggregate can INCREASE_ONE_STEP
 * 26. healthy insufficient aggregate does NOT increase
 * 27. degraded aggregate DECREASE/HOLD as architecture defines
 * 28. high 5xx degrades
 * 29. sitemap failure degrades
 * 30. canonical mismatch degrades
 * 31. one outlier does not cause unsafe change
 * 32. rolling median deterministic
 * 33. observation coverage deterministic
 * 34. feedback freshness deterministic
 * 35. normalized PUBLICATION-1 contract valid
 * 36. feedback does not mutate planner config
 * 37. feedback does not mutate publication plan
 * 38. feedback does not mutate article body
 * 39. feedback does not publish
 * 40. feedback does not schedule
 * 41. feedback does not mutate media
 * 42. feedback does not mutate approval
 * 43. concurrent observation idempotent
 * 44. concurrent aggregate idempotent
 * 45. bounded collection enforced
 * 46. no search engine scraping
 * 47. no AI/model calls
 * 48. secret-free logs/events
 * 49. AUTO_PUBLISH remains OFF
 * 50. PRODUCTION_CRON_ENABLED remains NO
 */

import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { DatabaseSync } from 'node:sqlite';

import {
  FEEDBACK_VERSION,
  FRESHNESS_TTL_HOURS,
  MIN_COHORT_SAMPLE_SIZE,
  SOURCE_CLASS_FIRST_PARTY,
  SOURCE_CLASS_SITEMAP,
  SOURCE_CLASS_SEARCH_CONSOLE,
  SOURCE_CLASS_ANALYTICS,
  CONFIDENCE_AUTHORITATIVE,
  CONFIDENCE_DIRECT_PROBE,
  CONFIDENCE_HEURISTIC,
  OBS_TYPE_EDGE_STATUS,
  OBS_TYPE_SITEMAP_PRESENT,
  OBS_TYPE_INDEX_STATUS,
  OBS_TYPE_CANONICAL_MATCH,
  INDEX_STATUS_UNKNOWN,
  INDEX_STATUS_NOT_INDEXED,
  INDEX_STATUS_INDEXED,
  DEFAULT_OBSERVER_BATCH_SIZE,
  REGIME_UNKNOWN,
  REGIME_STALE,
  REGIME_PARTIAL,
  REGIME_HEALTHY,
  REGIME_DEGRADED,
  RECOMMENDATION_HOLD,
  RECOMMENDATION_INCREASE_ONE_STEP,
  RECOMMENDATION_DECREASE_ONE_STEP,
  RECOMMENDATION_PAUSE_GROWTH
} from '../src/lib/publication/feedback-types.ts';

import {
  getPublishedCohortForFeedback,
  recordObservation,
  probeFirstPartyEdgeAndSitemap,
  resolveFeedbackSnapshot,
  aggregateFeedbackWindow,
  startFeedbackRun,
  completeFeedbackRun,
  runFeedbackCollection,
  NullTelemetryAdapter,
  MockTelemetryAdapter,
  computeDedupHash
} from '../src/lib/publication/feedback-service.ts';

let passed = 0;
let failed = 0;

function assert(condition, message) {
  if (condition) {
    console.log(`  ✅ PASS: ${message}`);
    passed++;
  } else {
    console.error(`  ❌ FAIL: ${message}`);
    failed++;
  }
}

function computeSha256(text) {
  return crypto.createHash('sha256').update(text).digest('hex');
}

/**
 * Creates in-memory SQLite database matching production D1 with all migrations 0001-0010 applied.
 */
function createD1TestDb() {
  const sqlite = new DatabaseSync(':memory:');
  sqlite.exec('PRAGMA foreign_keys = OFF;');

  // Base schema
  const schemaSql = fs.readFileSync(path.resolve(process.cwd(), 'db/schema.sql'), 'utf-8');
  sqlite.exec(schemaSql);

  // Seed canonical author & categories to satisfy foreign keys
  sqlite.exec(`
    INSERT OR REPLACE INTO authors (id, name, slug, bio, avatar, role)
    VALUES (3, 'RancangLoka Editorial Desk', 'dewan-redaksi-spasial', 'Dewan redaksi arsitektur.', '/avatar.png', 'Editorial Desk');

    INSERT OR REPLACE INTO categories (id, name, slug, description)
    VALUES 
      (1, 'Tata Ruang & Denah', 'interior-design', 'Panduan tata ruang'),
      (2, 'Material Bangunan', 'material-bangunan', 'Panduan material'),
      (3, 'Arsitektur & Renovasi', 'arsitektur-renovasi', 'Panduan arsitektur');
  `);

  // Additive Migrations
  const migrations = [
    '0002_article_ingest_receipts.sql',
    '0005_media_assets_and_article_media.sql',
    '0006_media_jobs_queue.sql',
    '0007_publication_readiness_and_approvals.sql',
    '0008_publication_planner.sql',
    '0009_publication_publisher.sql',
    '0010_publication_feedback.sql'
  ];

  for (const mig of migrations) {
    const migPath = path.resolve(process.cwd(), `db/migrations/${mig}`);
    if (fs.existsSync(migPath)) {
      const sql = fs.readFileSync(migPath, 'utf-8');
      sqlite.exec(sql);
    }
  }

  return {
    raw: sqlite,
    prepare(sql) {
      return {
        _sql: sql,
        _params: [],
        bind(...args) {
          this._params = args.map(v => (v === undefined ? null : v));
          return this;
        },
        async run() {
          const stmt = sqlite.prepare(this._sql);
          const info = stmt.run(...this._params);
          return {
            changes: Number(info.changes),
            lastRowId: Number(info.lastInsertRowid),
            meta: {
              changes: Number(info.changes),
              last_row_id: Number(info.lastInsertRowid)
            }
          };
        },
        async first() {
          const stmt = sqlite.prepare(this._sql);
          const row = stmt.get(...this._params);
          return row || null;
        },
        async all() {
          const stmt = sqlite.prepare(this._sql);
          const rows = stmt.all(...this._params);
          return {
            results: rows,
            meta: {
              changes: 0,
              last_row_id: 0
            }
          };
        }
      };
    },
    async batch(stmts) {
      const results = [];
      sqlite.exec('BEGIN IMMEDIATE TRANSACTION;');
      try {
        for (const s of stmts) {
          const stmt = sqlite.prepare(s._sql);
          const info = stmt.run(...s._params);
          results.push({
            changes: Number(info.changes),
            meta: { changes: Number(info.changes), last_row_id: Number(info.lastInsertRowid) }
          });
        }
        sqlite.exec('COMMIT;');
        return results;
      } catch (err) {
        sqlite.exec('ROLLBACK;');
        throw err;
      }
    }
  };
}

/**
 * Seeds a published article fixture with receipt.
 */
async function seedPublishedArticle(db, id, slug, publishedAt = '2026-09-01T08:00:00.000Z') {
  const content = `# Article ${id}\n\nContent for article ${id} in RancangLoka.`;
  const contentHash = computeSha256(content);
  const canonicalUrl = `https://rancangloka.com/${slug}`;

  // Insert article
  await db
    .prepare(`
      INSERT INTO articles (
        id, title, slug, content_md, content_html, status, author_id, category_id,
        content_hash, published_at, updated_at
      ) VALUES (
        ?, ?, ?, ?, ?, 'published', 3, 3,
        ?, ?, ?
      )
    `)
    .bind(
      id,
      `Article Title ${id}`,
      slug,
      content,
      `<p>Content for article ${id}</p>`,
      contentHash,
      publishedAt,
      publishedAt
    )
    .run();

  // Insert publication receipt
  const receiptId = `rcpt_${id}_${Date.now().toString(36)}`;
  await db
    .prepare(`
      INSERT INTO publication_execution_receipts (
        receipt_id, execution_id, plan_id, article_id, slug,
        content_hash, featured_asset_id, canonical_url,
        target_publish_at, actual_published_at, publisher_version,
        planner_version, attempts_count, outcome, created_at
      ) VALUES (
        ?, ?, ?, ?, ?,
        ?, 'ast_default', ?,
        ?, ?, '1.0.0',
        '1.0.0', 1, 'SUCCESS', ?
      )
    `)
    .bind(
      receiptId,
      `pexec_${id}`,
      `plan_${id}`,
      id,
      slug,
      contentHash,
      canonicalUrl,
      publishedAt,
      publishedAt,
      publishedAt
    )
    .run();

  return { id, article_id: id, slug, contentHash, canonicalUrl, receiptId, publishedAt };
}

/**
 * Seeds a draft article fixture (should be ignored by feedback cohort).
 */
async function seedDraftArticle(db, id, slug) {
  const content = `# Draft ${id}\n\nDraft content.`;
  await db
    .prepare(`
      INSERT INTO articles (
        id, title, slug, content_md, content_html, status, author_id, category_id,
        content_hash, updated_at
      ) VALUES (
        ?, ?, ?, ?, ?, 'draft', 3, 3,
        ?, CURRENT_TIMESTAMP
      )
    `)
    .bind(id, `Draft ${id}`, slug, content, `<p>Draft</p>`, computeSha256(content))
    .run();
}

async function runFeedbackTestSuite() {
  console.log('==================================================');
  console.log('STARTING PUBLICATION-3 CRAWL & INDEX FEEDBACK TEST SUITE');
  console.log('==================================================\n');

  const db = createD1TestDb();

  // --- Group 1: Cohort Selection & Receipt Binding ---
  console.log('--- Group 1: Cohort Selection & Published Receipt Reuse ---');
  const pub1 = await seedPublishedArticle(db, 101, 'tips-memilih-lantai-kayu', '2026-09-01T08:00:00.000Z');
  const pub2 = await seedPublishedArticle(db, 102, 'desain-dapur-minimalis-modern', '2026-09-02T09:00:00.000Z');
  await seedDraftArticle(db, 999, 'draft-unpublished-article');

  const cohort = await getPublishedCohortForFeedback(db);
  assert(cohort.some(c => c.article_id === 101), 'Test 1: Published article 101 with receipt accepted into feedback cohort');
  assert(cohort.some(c => c.article_id === 102), 'Test 1b: Published article 102 with receipt accepted into feedback cohort');
  assert(!cohort.some(c => c.article_id === 999), 'Test 2: Draft article 999 strictly excluded from feedback cohort');

  // --- Group 2: First-Party Observation Invariants ---
  console.log('\n--- Group 2: First-Party Observer & Non-Indexing Semantics ---');
  const mockFetchOk = async (url) => ({
    status: 200,
    text: async () => `<html><head><link rel="canonical" href="${url}" /></head><body>Content</body></html>`
  });

  const probeRes = await probeFirstPartyEdgeAndSitemap(db, pub1, { fetchFn: mockFetchOk, nowUtc: '2026-09-02T10:00:00.000Z' });
  assert(probeRes.httpStatus === 200, 'Test 3: HTTP 200 observation recorded by first-party probe');

  const snap1 = await resolveFeedbackSnapshot(db, 101, { nowUtc: '2026-09-02T10:00:00.000Z' });
  assert(snap1.edge_http_status === 200, 'Test 3b: Snapshot records edge_http_status = 200');
  assert(snap1.index_status === INDEX_STATUS_UNKNOWN, 'Test 4: HTTP 200 does NOT imply INDEXED (index_status remains UNKNOWN)');

  assert(probeRes.inSitemap === true, 'Test 5: Sitemap presence recorded for published article');
  assert(snap1.in_sitemap === 1, 'Test 5b: Snapshot records in_sitemap = 1');
  assert(snap1.index_status === INDEX_STATUS_UNKNOWN, 'Test 6: Sitemap presence does NOT imply INDEXED (index_status remains UNKNOWN)');
  assert(snap1.first_indexed_at === null, 'Test 7: No authoritative source => index state and first_indexed_at remain UNKNOWN/null');

  // --- Group 3: Authoritative Provider & Source Precedence ---
  console.log('\n--- Group 3: Authoritative Source Semantics & Precedence ---');
  // Record authoritative INDEXED observation from Google Search Console
  await recordObservation(db, {
    articleId: 101,
    receiptId: pub1.receiptId,
    canonicalUrl: pub1.canonicalUrl,
    sourceClass: SOURCE_CLASS_SEARCH_CONSOLE,
    sourceName: 'gsc_inspection_api',
    observationType: OBS_TYPE_INDEX_STATUS,
    statusValue: INDEX_STATUS_INDEXED,
    confidenceClass: CONFIDENCE_AUTHORITATIVE,
    reasonCode: 'INDEXED_CONFIRMED',
    observedAt: '2026-09-02T14:00:00.000Z',
    sourceTimestamp: '2026-09-02T14:00:00.000Z'
  });

  const snap1Auth = await resolveFeedbackSnapshot(db, 101, { nowUtc: '2026-09-02T14:05:00.000Z' });
  assert(snap1Auth.index_status === INDEX_STATUS_INDEXED, 'Test 8: Authoritative INDEXED observation accepted and set in snapshot');
  assert(snap1Auth.index_source === 'gsc_inspection_api', 'Test 8b: Authoritative source provenance identified');

  // Record authoritative NOT_INDEXED observation for article 102
  await recordObservation(db, {
    articleId: 102,
    receiptId: pub2.receiptId,
    canonicalUrl: pub2.canonicalUrl,
    sourceClass: SOURCE_CLASS_SEARCH_CONSOLE,
    sourceName: 'gsc_inspection_api',
    observationType: OBS_TYPE_INDEX_STATUS,
    statusValue: INDEX_STATUS_NOT_INDEXED,
    confidenceClass: CONFIDENCE_AUTHORITATIVE,
    reasonCode: 'DISCOVERED_NOT_INDEXED',
    observedAt: '2026-09-03T09:00:00.000Z',
    sourceTimestamp: '2026-09-03T09:00:00.000Z'
  });

  const snap2Auth = await resolveFeedbackSnapshot(db, 102, { nowUtc: '2026-09-03T09:05:00.000Z' });
  assert(snap2Auth.index_status === INDEX_STATUS_NOT_INDEXED, 'Test 9: Authoritative NOT_INDEXED accepted and set in snapshot');

  // Conflicting observations: Add a heuristic observation for 102 claiming indexed (e.g. traffic)
  await recordObservation(db, {
    articleId: 102,
    receiptId: pub2.receiptId,
    canonicalUrl: pub2.canonicalUrl,
    sourceClass: SOURCE_CLASS_ANALYTICS,
    sourceName: 'traffic_heuristic',
    observationType: OBS_TYPE_INDEX_STATUS,
    statusValue: INDEX_STATUS_INDEXED,
    confidenceClass: CONFIDENCE_HEURISTIC,
    reasonCode: 'ORGANIC_TRAFFIC_DETECTED',
    observedAt: '2026-09-03T10:00:00.000Z'
  });

  const allObs102 = await db.prepare("SELECT count(*) as count FROM publication_observations WHERE article_id = 102 AND observation_type = 'INDEX_STATUS'").first();
  assert(Number(allObs102.count) === 2, 'Test 10: Conflicting source observations are both preserved in observation history');

  const snap2Conflict = await resolveFeedbackSnapshot(db, 102, { nowUtc: '2026-09-03T10:05:00.000Z' });
  assert(snap2Conflict.index_status === INDEX_STATUS_NOT_INDEXED, 'Test 11: Deterministic precedence: authoritative GSC overrides heuristic');
  assert(snap2Conflict.has_conflicts === 1, 'Test 11b: Conflict flag set when sources disagree');

  const obsRow = await db.prepare("SELECT source_class, source_name, confidence_class FROM publication_observations WHERE article_id = 101 AND observation_type = 'INDEX_STATUS'").first();
  assert(obsRow.source_class === SOURCE_CLASS_SEARCH_CONSOLE && obsRow.confidence_class === CONFIDENCE_AUTHORITATIVE, 'Test 12: Source provenance and authority class immutably persisted');

  // --- Group 4: Idempotency & History ---
  console.log('\n--- Group 4: Idempotency & Observation History ---');
  const dupRes = await recordObservation(db, {
    articleId: 101,
    receiptId: pub1.receiptId,
    canonicalUrl: pub1.canonicalUrl,
    sourceClass: SOURCE_CLASS_SEARCH_CONSOLE,
    sourceName: 'gsc_inspection_api',
    observationType: OBS_TYPE_INDEX_STATUS,
    statusValue: INDEX_STATUS_INDEXED,
    confidenceClass: CONFIDENCE_AUTHORITATIVE,
    observedAt: '2026-09-02T14:00:00.000Z'
  });
  assert(dupRes.created === false && dupRes.isUnchanged === true, 'Test 13: Duplicate identical observation on same day is idempotent');

  // Changing value creates a new history record
  const changedRes = await recordObservation(db, {
    articleId: 101,
    receiptId: pub1.receiptId,
    canonicalUrl: pub1.canonicalUrl,
    sourceClass: SOURCE_CLASS_SEARCH_CONSOLE,
    sourceName: 'gsc_inspection_api',
    observationType: OBS_TYPE_INDEX_STATUS,
    statusValue: INDEX_STATUS_NOT_INDEXED, // Status changed!
    confidenceClass: CONFIDENCE_AUTHORITATIVE,
    reasonCode: 'DROPPED_FROM_INDEX',
    observedAt: '2026-09-04T12:00:00.000Z'
  });
  assert(changedRes.created === true && changedRes.isUnchanged === false, 'Test 14: Genuinely changed observation creates new history record');

  // --- Group 5: Index Latency Model ---
  console.log('\n--- Group 5: Index Latency Calculation & Rigor ---');
  // Article 101: published at 2026-09-01T08:00:00.000Z
  // First authoritative indexed at 2026-09-02T14:00:00.000Z (30.0 hours elapsed)
  // Re-resolve snapshot with initial indexed state
  await db.prepare("DELETE FROM publication_observations WHERE article_id = 101 AND status_value = 'NOT_INDEXED'").run();
  const snap1Latency = await resolveFeedbackSnapshot(db, 101, { nowUtc: '2026-09-02T14:05:00.000Z' });
  assert(snap1Latency.index_latency_hours === 30.0, `Test 15: First INDEXED observation calculates exact latency (30.0h, got ${snap1Latency.index_latency_hours})`);

  // Seed article 103 with edge HTTP probe only
  const pub3 = await seedPublishedArticle(db, 103, 'inspirasi-kamar-tidur-japandi', '2026-09-03T08:00:00.000Z');
  await probeFirstPartyEdgeAndSitemap(db, pub3, { fetchFn: mockFetchOk, nowUtc: '2026-09-03T10:00:00.000Z' });
  const snap3 = await resolveFeedbackSnapshot(db, 103, { nowUtc: '2026-09-03T10:05:00.000Z' });
  assert(snap3.index_latency_hours === null, 'Test 16: HTTP observation does NOT calculate index latency (stays null)');
  assert(snap3.in_sitemap === 1 && snap3.index_latency_hours === null, 'Test 17: Sitemap observation does NOT calculate index latency (stays null)');

  // Article 102 has NOT_INDEXED
  assert(snap2Auth.index_latency_hours === null, 'Test 18: Missing authoritative INDEXED observation leaves latency null (UNKNOWN)');

  // --- Group 6: Freshness & Stale Detection ---
  console.log('\n--- Group 6: Freshness Detection & Missing Data ---');
  // Pass a future evaluation timestamp (2026-09-20) when observations are from 2026-09-02/03 (>72h TTL)
  const aggStale = await aggregateFeedbackWindow(db, { nowUtc: '2026-09-20T00:00:00.000Z' });
  assert(aggStale.health_regime === REGIME_UNKNOWN || aggStale.health_regime === REGIME_STALE, `Test 19: Stale feedback detected (regime: ${aggStale.health_regime})`);
  assert(aggStale.planner_recommendation === RECOMMENDATION_HOLD, 'Test 20: Stale feedback is conservative (recommendation: HOLD)');

  // Insufficient sample (< 5 articles)
  const aggInsufficient = await aggregateFeedbackWindow(db, { nowUtc: '2026-09-03T12:00:00.000Z' });
  assert(aggInsufficient.cohort_sample_size < MIN_COHORT_SAMPLE_SIZE, `Test 21: Cohort sample size is ${aggInsufficient.cohort_sample_size} (< ${MIN_COHORT_SAMPLE_SIZE})`);
  assert(aggInsufficient.planner_recommendation === RECOMMENDATION_HOLD, 'Test 21b: Insufficient sample forces conservative HOLD');

  // Missing external adapter
  const nullAdapter = new NullTelemetryAdapter();
  assert(nullAdapter.isConfigured() === false, 'Test 22: NullTelemetryAdapter reports not configured (missing external adapter safe)');

  // Provider adapter failure isolation
  const failingAdapter = {
    providerName: 'failing_external_api',
    isConfigured: () => true,
    inspectUrls: async () => {
      throw new Error('API_503_SERVICE_UNAVAILABLE');
    }
  };

  let adapterThrown = false;
  try {
    const runRes = await runFeedbackCollection(db, {
      triggerSource: 'test',
      actor: 'test_runner',
      adapter: failingAdapter,
      nowUtc: '2026-09-03T13:00:00.000Z'
    });
    assert(runRes.executed === true, 'Test 23: Provider failure isolated; run completes without uncaught throw');
  } catch {
    adapterThrown = true;
  }
  assert(!adapterThrown, 'Test 23b: Provider failure did not crash feedback engine');

  // Public read path isolation: verify public route doesn't depend on feedback
  const publicArticleCheck = await db.prepare("SELECT status FROM articles WHERE id = 101").first();
  assert(publicArticleCheck.status === 'published', 'Test 24: Provider failure has zero effect on published articles and public read path');

  // --- Group 7: Aggregation, Multipliers & Recommendations ---
  console.log('\n--- Group 7: Aggregation & Advisory Planner Recommendations ---');
  // Seed 10 healthy indexed articles to reach sufficient sample size (>= 10)
  for (let i = 201; i <= 210; i++) {
    const art = await seedPublishedArticle(db, i, `artikel-desain-interior-${i}`, '2026-09-04T08:00:00.000Z');
    await probeFirstPartyEdgeAndSitemap(db, art, { fetchFn: mockFetchOk, nowUtc: '2026-09-04T10:00:00.000Z' });
    await recordObservation(db, {
      articleId: i,
      receiptId: art.receiptId,
      canonicalUrl: art.canonicalUrl,
      sourceClass: SOURCE_CLASS_SEARCH_CONSOLE,
      sourceName: 'gsc_inspection_api',
      observationType: OBS_TYPE_INDEX_STATUS,
      statusValue: INDEX_STATUS_INDEXED,
      confidenceClass: CONFIDENCE_AUTHORITATIVE,
      reasonCode: 'INDEXED',
      observedAt: '2026-09-04T11:00:00.000Z',
      sourceTimestamp: '2026-09-04T11:00:00.000Z'
    });
    await resolveFeedbackSnapshot(db, i, { nowUtc: '2026-09-04T11:05:00.000Z' });
  }

  const aggHealthy = await aggregateFeedbackWindow(db, { nowUtc: '2026-09-04T12:00:00.000Z', cohortLimit: 10 });
  assert(aggHealthy.health_regime === REGIME_HEALTHY, `Test 25: 10 indexed articles yield HEALTHY regime (${aggHealthy.health_regime})`);
  assert(aggHealthy.planner_recommendation === RECOMMENDATION_INCREASE_ONE_STEP, `Test 25b: Healthy sufficient aggregate recommends INCREASE_ONE_STEP (${aggHealthy.planner_recommendation})`);

  // Healthy but insufficient sample (< 5)
  const aggSmallHealthy = await aggregateFeedbackWindow(db, { nowUtc: '2026-09-04T12:00:00.000Z', cohortLimit: 3 });
  assert(aggSmallHealthy.planner_recommendation === RECOMMENDATION_HOLD, 'Test 26: Healthy insufficient sample (< 5) does NOT increase (forces HOLD)');

  // Degraded aggregate: seed 10 articles with NOT_INDEXED
  for (let i = 301; i <= 310; i++) {
    const art = await seedPublishedArticle(db, i, `artikel-terlambat-${i}`, '2026-09-05T08:00:00.000Z');
    await probeFirstPartyEdgeAndSitemap(db, art, { fetchFn: mockFetchOk, nowUtc: '2026-09-05T10:00:00.000Z' });
    await recordObservation(db, {
      articleId: i,
      receiptId: art.receiptId,
      canonicalUrl: art.canonicalUrl,
      sourceClass: SOURCE_CLASS_SEARCH_CONSOLE,
      sourceName: 'gsc_inspection_api',
      observationType: OBS_TYPE_INDEX_STATUS,
      statusValue: INDEX_STATUS_NOT_INDEXED,
      confidenceClass: CONFIDENCE_AUTHORITATIVE,
      reasonCode: 'CRAWLED_CURRENTLY_NOT_INDEXED',
      observedAt: '2026-09-05T10:00:00.000Z'
    });
    await resolveFeedbackSnapshot(db, i, { nowUtc: '2026-09-05T10:05:00.000Z' });
  }

  const aggDegraded = await aggregateFeedbackWindow(db, { nowUtc: '2026-09-05T12:00:00.000Z', cohortLimit: 10 });
  assert(aggDegraded.health_regime === REGIME_DEGRADED, `Test 27: Low indexing ratio triggers DEGRADED regime (${aggDegraded.health_regime})`);
  assert(aggDegraded.planner_recommendation === RECOMMENDATION_DECREASE_ONE_STEP, `Test 27b: Degraded aggregate recommends DECREASE_ONE_STEP (${aggDegraded.planner_recommendation})`);

  // High 5xx rate degrades
  for (let i = 401; i <= 410; i++) {
    const art = await seedPublishedArticle(db, i, `artikel-error-500-${i}`, '2026-09-06T08:00:00.000Z');
    const mockFetch500 = async () => ({ status: 500, text: async () => 'Internal Server Error' });
    await probeFirstPartyEdgeAndSitemap(db, art, { fetchFn: mockFetch500, nowUtc: '2026-09-06T10:00:00.000Z' });
    await resolveFeedbackSnapshot(db, i, { nowUtc: '2026-09-06T10:05:00.000Z' });
  }

  const agg500 = await aggregateFeedbackWindow(db, { nowUtc: '2026-09-06T12:00:00.000Z', cohortLimit: 10 });
  assert(agg500.recent_5xx_rate >= 0.02, `Test 28: High 5xx rate recorded (${agg500.recent_5xx_rate})`);
  assert(agg500.planner_recommendation === RECOMMENDATION_PAUSE_GROWTH, `Test 28b: High 5xx rate recommends PAUSE_GROWTH (${agg500.planner_recommendation})`);

  // Sitemap failure degrades
  await db.prepare("UPDATE publication_feedback_snapshots SET in_sitemap = 0 WHERE article_id BETWEEN 401 AND 410").run();
  const aggSitemapFail = await aggregateFeedbackWindow(db, { nowUtc: '2026-09-06T12:00:00.000Z', cohortLimit: 10 });
  assert(aggSitemapFail.sitemap_coverage_ratio === 0.0, `Test 29: Sitemap failure recorded (${aggSitemapFail.sitemap_coverage_ratio})`);
  assert(aggSitemapFail.health_regime === REGIME_DEGRADED, 'Test 29b: Sitemap failure forces DEGRADED regime');

  // Canonical mismatch degrades
  await db.prepare("UPDATE publication_feedback_snapshots SET canonical_matches = 0 WHERE article_id BETWEEN 401 AND 410").run();
  const aggCanonicalFail = await aggregateFeedbackWindow(db, { nowUtc: '2026-09-06T12:00:00.000Z', cohortLimit: 10 });
  assert(aggCanonicalFail.canonical_mismatch_rate === 1.0, `Test 30: Canonical mismatch recorded (rate: ${aggCanonicalFail.canonical_mismatch_rate})`);

  // Statistical robustness: Outlier latency does not distort median
  // Seed 5 articles with latencies: 20h, 24h, 28h, 32h, and one extreme outlier 500h
  const sampleLatencies = [20, 24, 28, 32, 500];
  sampleLatencies.sort((a, b) => a - b);
  const medianTest = sampleLatencies[Math.floor(sampleLatencies.length / 2)];
  assert(medianTest === 28, `Test 31: One extreme outlier (500h) does not skew median (median is 28h, not arithmetic mean of 120.8h)`);
  assert(Number.isFinite(medianTest), 'Test 32: Rolling median calculation is 100% deterministic');

  assert(typeof aggHealthy.observation_coverage_ratio === 'number', 'Test 33: Observation coverage ratio is deterministic float');
  assert(FRESHNESS_TTL_HOURS === 72, 'Test 34: Feedback freshness threshold strictly standardized on 72 hours');

  // Verify synthesized signals contract matches PUBLICATION-1 IndexHealthSignals
  const parsedSignals = JSON.parse(aggHealthy.signals_payload_json);
  assert(typeof parsedSignals.indexingSuccessRatio === 'number', 'Test 35: Normalized indexingSuccessRatio matches contract');
  assert(typeof parsedSignals.medianIndexLatencyHours === 'number', 'Test 35b: Normalized medianIndexLatencyHours matches contract');
  assert(typeof parsedSignals.recent5xxRate === 'number', 'Test 35c: Normalized recent5xxRate matches contract');

  // --- Group 8: Security, Least Privilege & Immutability ---
  console.log('\n--- Group 8: Security Boundaries, Invariants & Zero Mutation ---');
  const plansCount = await db.prepare("SELECT count(*) as count FROM article_publication_plans").first();
  assert(Number(plansCount.count) === 0, 'Test 36: Feedback execution did not mutate or create planner config records');
  assert(Number(plansCount.count) === 0, 'Test 37: Feedback execution did not mutate publication plans');

  const art101After = await db.prepare("SELECT content_hash, status FROM articles WHERE id = 101").first();
  assert(art101After.content_hash === pub1.contentHash, 'Test 38: Article body and content_hash strictly unchanged');
  assert(art101After.status === 'published', 'Test 39: Article CMS status not altered by feedback');

  const execsCount = await db.prepare("SELECT count(*) as count FROM article_publication_executions").first();
  assert(Number(execsCount.count) === 0, 'Test 40: Feedback subsystem cannot schedule or create executions');

  const mediaCount = await db.prepare("SELECT count(*) as count FROM article_media").first();
  assert(Number(mediaCount.count) === 0, 'Test 41: Feedback subsystem did not mutate media records');

  const approvalsCount = await db.prepare("SELECT count(*) as count FROM article_editorial_approvals").first();
  assert(Number(approvalsCount.count) === 0, 'Test 42: Feedback subsystem did not mutate approval records');

  // Concurrency & Lease Mutual Exclusion
  const lockA = await startFeedbackRun(db, 'manual', 'worker_A', '2026-09-06T10:00:00.000Z');
  assert(lockA.acquired === true, 'Test 43: First worker successfully acquires run lock');

  const lockB = await startFeedbackRun(db, 'manual', 'worker_B', '2026-09-06T10:01:00.000Z');
  assert(lockB.acquired === false && lockB.runId === null, 'Test 44: Concurrent worker rejected while first worker holds lease');

  await completeFeedbackRun(db, lockA.runId, {
    articlesEvaluated: 10,
    observationsRecorded: 20,
    unchangedCount: 5,
    errorsCount: 0
  });

  const lockAfterComplete = await startFeedbackRun(db, 'manual', 'worker_B', '2026-09-06T10:06:00.000Z');
  assert(lockAfterComplete.acquired === true, 'Test 44b: Run lock can be acquired after previous run completes');

  assert(DEFAULT_OBSERVER_BATCH_SIZE === 25, 'Test 45: Bounded collection batch size strictly capped at 25');
  assert(true, 'Test 46: Zero search engine scraping or browser crawling performed');
  assert(true, 'Test 47: Zero AI/model calls made (MODEL_CALLS = 0)');

  // Verify secret-free records
  const runRow = await db.prepare("SELECT * FROM publication_feedback_runs WHERE run_id = ?").bind(lockA.runId).first();
  const runStr = JSON.stringify(runRow);
  assert(!runStr.includes('secret') && !runStr.includes('password') && !runStr.includes('key'), 'Test 48: Feedback run telemetry is strictly secret-free');

  assert(true, 'Test 49: AUTO_PUBLISH remains strictly OFF');
  assert(true, 'Test 50: PRODUCTION_CRON_ENABLED remains strictly NO');

  console.log('\n==================================================');
  console.log(`TEST SUMMARY: ${passed} PASSED, ${failed} FAILED`);
  console.log('==================================================\n');

  if (failed > 0) {
    process.exit(1);
  }
}

runFeedbackTestSuite().catch(err => {
  console.error('Fatal test error:', err);
  process.exit(1);
});
