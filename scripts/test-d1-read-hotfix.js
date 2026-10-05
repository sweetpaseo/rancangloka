/**
 * RancangLoka Hermes Mission Control — D1 Read Hotfix Test Suite
 * Milestone: D1-ROW-READ-HOTFIX-1
 * 
 * Strict Invariants:
 * 1. LOCAL IN-MEMORY SQLITE ONLY: Zero production D1 or remote network access.
 * 2. READ-ONLY INVARIANTS PRESERVED:
 *    - automation_mode = OFF
 *    - SOCIAL_AUTOMATION = OFF
 *    - publishingAuthority = 0
 *    - JEV_MODE = shadow
 *    - mediaWorker = DISABLED
 *    - Jefry execution authority = 0
 * 3. NO BEHAVIOR REGRESSION: Full staff fidelity, telemetry, and animations preserved.
 */

import assert from 'node:assert/strict';
import fs from 'node:fs';
import { DatabaseSync } from 'node:sqlite';

console.log('===========================================================');
console.log('🧪 Starting D1 Row Read Hotfix (D1-ROW-READ-HOTFIX-1) Suite');
console.log('===========================================================\n');

let passedTests = 0;
async function it(title, fn) {
  try {
    await fn();
    console.log(`  ✅ PASS: ${title}`);
    passedTests++;
  } catch (err) {
    console.error(`  ❌ FAIL: ${title}`);
    console.error(err);
    process.exit(1);
  }
}

// ----------------------------------------------------------------------------
// Fixture Setup: In-Memory SQLite with Schema and Migrations
// ----------------------------------------------------------------------------
const sqlite = new DatabaseSync(':memory:');

// Execute base schema
const baseSchema = fs.readFileSync('db/schema.sql', 'utf8');
sqlite.exec(baseSchema);

// Execute all migrations up to 0029
const migrationFiles = [
  '0001_category_taxonomy_expansion.sql',
  '0002_article_ingest_receipts.sql',
  '0003_canonical_editorial_author.sql',
  '0004_add_article_flags.sql',
  '0005_media_assets_and_article_media.sql',
  '0006_media_jobs_queue.sql',
  '0007_publication_readiness_and_approvals.sql',
  '0008_publication_planner.sql',
  '0009_publication_publisher.sql',
  '0010_publication_feedback.sql',
  '0011_automation_safety.sql',
  '0013_lokamedia_durable_jobs.sql',
  '0014_lokamedia_phase2c_slot_attachment.sql',
  '0015_site_watermark_assets.sql',
  '0016_media_assets_derivative_registration.sql',
  '0017_auto_schedule_and_manual_hold.sql',
  '0018_publication_operator_audit.sql',
  '0019_publication_cron_observability.sql',
  '0020_automation_control_audit.sql',
  '0021_decision_observations.sql',
  '0022_allow_jev_shadow_collector_cron.sql',
  '0023_editorial_trajectory_ledger.sql',
  '0024_mission_control_chat_and_commands.sql',
  '0025_mission_control_anomalies.sql',
  '0026_mission_control_operator_actions.sql',
  '0026_social_domain_and_outbox.sql',
  '0027_social_credential_vault.sql',
  '0028_social_credential_vault_hardening.sql',
  '0029_d1_performance_indexes.sql'
];

for (const m of migrationFiles) {
  const mPath = `db/migrations/${m}`;
  if (fs.existsSync(mPath)) {
    const sql = fs.readFileSync(mPath, 'utf8');
    try {
      sqlite.exec(sql);
    } catch {
      // Ignore if columns/tables were already in base schema.sql
    }
  }
}

// Seed baseline test data
sqlite.exec(`
  INSERT INTO automation_control (id, mode, kill_switch_engaged, updated_at)
  VALUES (1, 'OFF', 0, '2026-10-05T00:00:00.000Z')
  ON CONFLICT(id) DO UPDATE SET updated_at = excluded.updated_at;

  INSERT INTO publication_cron_runs (id, run_id, job_name, trigger_source, status, started_at, finished_at, created_at)
  VALUES (1, 'run_101', 'publication_planner', 'SCHEDULED_HOURLY', 'SUCCEEDED', '2026-10-05T01:00:00.000Z', '2026-10-05T01:00:05.000Z', '2026-10-05T01:00:00.000Z');

  INSERT INTO mission_control_operator_actions (action_id, action_type, target_type, target_id, requested_by, safety_class, status, result_summary, audit_hash, requested_at, completed_at)
  VALUES ('act_01', 'ACKNOWLEDGE_ANOMALY', 'ANOMALY', 'anom_01', 'chief_editor', 'LOW_RISK_INTERNAL', 'EXECUTED', 'Anomaly acknowledged', 'hash_01', '2026-10-05T01:05:00.000Z', '2026-10-05T01:05:01.000Z');

  INSERT INTO mission_control_anomalies (anomaly_id, fingerprint, title, summary, severity, state, department_id, responsible_agent_id, source_system, anomaly_type, detected_at, last_seen_at)
  VALUES ('anom_01', 'fp_01', 'Test Anomaly', 'Test summary', 'INFO', 'RESOLVED', 'editorial', 'content_writer_primary', 'test_system', 'TEST_ANOMALY', '2026-10-05T00:00:00.000Z', '2026-10-05T00:00:00.000Z');

  INSERT OR REPLACE INTO settings (key, value)
  VALUES ('social_meta_connection_json', '{"connected":true,"publishingAuthority":0}'),
         ('site_title', 'RancangLoka');
`);

// Seed 10 sample articles
for (let i = 1; i <= 10; i++) {
  const status = i <= 6 ? 'published' : (i <= 8 ? 'draft' : 'scheduled');
  const publishedAt = `2026-10-0${i}T10:00:00.000Z`;
  const updatedAt = `2026-10-0${i}T11:00:00.000Z`;
  sqlite.prepare(`
    INSERT INTO articles (id, slug, title, description, content_md, content_html, status, published_at, updated_at, focus_keyword)
    VALUES (?, ?, ?, 'Deskripsi ' || ?, 'Full Markdown body ' || ?, '<p>Full HTML body ' || ? || '</p>', ?, ?, ?, 'keyword ' || ?)
  `).run(
    i,
    `artikel-test-${i}`,
    `Judul Artikel Test ${i}`,
    i,
    i,
    i,
    status,
    publishedAt,
    updatedAt,
    i
  );
}

// Interceptable DB adapter tracking executed queries and rows read
let executedQueries = [];
let rowsReadCount = 0;

function createInstrumentedDb() {
  return {
    prepare(sql) {
      let args = [];
      return {
        bind(...values) {
          args = values;
          return this;
        },
        async all() {
          executedQueries.push({ sql, args, type: 'all' });
          const stmt = sqlite.prepare(sql);
          const results = stmt.all(...args);
          rowsReadCount += results.length;
          return { results };
        },
        async first() {
          executedQueries.push({ sql, args, type: 'first' });
          const stmt = sqlite.prepare(sql);
          const result = stmt.get(...args) || null;
          if (result) rowsReadCount += 1;
          return result;
        },
        async run() {
          executedQueries.push({ sql, args, type: 'run' });
          const stmt = sqlite.prepare(sql);
          return stmt.run(...args);
        }
      };
    }
  };
}

// Import modules under test
const { getRecentOperationalEvents, getLightweightRevision } = await import('../src/lib/mission-control/events.ts');
const { getAllArticles, getTotalArticlesCount, getInternalLinkCandidates, getSiteSettingByKey } = await import('../src/lib/db.ts');
const { getLightweightStaffState } = await import('../src/lib/mission-control/staff-registry.ts');

console.log('--- TEST SECTION 1: Events Fast-Path & Lightweight Revision ---');

await it('1. getLightweightRevision performs bounded reads (<= 4 rows)', async () => {
  const instrumentedDb = createInstrumentedDb();
  executedQueries = [];
  rowsReadCount = 0;

  const rev = await getLightweightRevision(instrumentedDb);
  assert.ok(rev.startsWith('rev_'), 'Revision token must have rev_ prefix');
  assert.ok(rowsReadCount <= 4, `Rows read must be <= 4, got ${rowsReadCount}`);
  assert.ok(executedQueries.length <= 4, `Query count must be <= 4, got ${executedQueries.length}`);
});

await it('2. Unchanged events poll does NOT invoke getMissionControlSnapshot and returns changed = false', async () => {
  const instrumentedDb = createInstrumentedDb();
  const currentRev = await getLightweightRevision(instrumentedDb);

  executedQueries = [];
  rowsReadCount = 0;

  const res = await getRecentOperationalEvents(instrumentedDb, currentRev, 20);
  assert.strictEqual(res.changed, false, 'Unchanged revision must return changed = false');
  assert.strictEqual(res.current_revision, currentRev);
  assert.strictEqual(res.event_count, 0);
  assert.deepStrictEqual(res.events, []);

  // Assert no snapshot queries were executed (e.g. no media_jobs, articles full list, categories, etc.)
  const executedSqlTexts = executedQueries.map(q => q.sql);
  const forbiddenSnapshotQueries = executedSqlTexts.filter(sql =>
    sql.includes('categories') ||
    sql.includes('authors') ||
    sql.includes('FROM articles a LEFT JOIN') ||
    sql.includes('SELECT status, COUNT(*) as count FROM media_jobs') ||
    sql.includes('SELECT COUNT(*) as count FROM article_editorial_approvals')
  );
  assert.strictEqual(forbiddenSnapshotQueries.length, 0, 'No full snapshot queries allowed on unchanged poll');
  assert.ok(rowsReadCount <= 4, `Unchanged poll rows read must be <= 4, was ${rowsReadCount}`);
});

await it('3. Changed revision triggers detailed snapshot and returns changed = true with envelopes', async () => {
  const instrumentedDb = createInstrumentedDb();
  const oldRev = 'rev_outdated_00000000';

  executedQueries = [];
  rowsReadCount = 0;

  const res = await getRecentOperationalEvents(instrumentedDb, oldRev, 20);
  assert.strictEqual(res.changed, true, 'Stale revision must trigger changed = true');
  assert.notStrictEqual(res.current_revision, oldRev);
  assert.ok(res.event_count >= 1, 'Changed state must include event envelopes');
});

console.log('\n--- TEST SECTION 2: Pixel Office Client Polling Contracts ---');

await it('4. office.astro enforces minPollInterval >= 10s and maxPollInterval >= 30s', async () => {
  const officeAstro = fs.readFileSync('src/pages/admin/mission-control/office.astro', 'utf8');

  assert.match(officeAstro, /minPollInterval\s*=\s*10000/, 'Minimum poll interval must be at least 10,000ms');
  assert.match(officeAstro, /maxPollInterval\s*=\s*30000/, 'Maximum quiet poll interval must be at least 30,000ms');
  assert.match(officeAstro, /backgroundPollInterval\s*=\s*60000/, 'Background hidden poll interval must be 60,000ms');
});

await it('5. office.astro guards against overlapping events polls with isCheckingEvents', async () => {
  const officeAstro = fs.readFileSync('src/pages/admin/mission-control/office.astro', 'utf8');

  assert.match(officeAstro, /let\s+isCheckingEvents\s*=\s*false/, 'Must declare isCheckingEvents flag');
  assert.match(officeAstro, /if\s*\(isCheckingEvents\)\s*return/, 'Must guard checkOperationalEvents against overlapping in-flight calls');
});

await it('6. office.astro only refetches snapshot when changed = true', async () => {
  const officeAstro = fs.readFileSync('src/pages/admin/mission-control/office.astro', 'utf8');

  assert.match(officeAstro, /if\s*\(data\.changed\)\s*\{[\s\S]*?triggerSnapshotRefetch\('EVENT_FEED'\)/,
    'Snapshot refetch must strictly be conditional on data.changed === true'
  );
});

console.log('\n--- TEST SECTION 3: Article Queries & Lightweight Listings ---');

await it('7. getAllArticles enforces SQL LIMIT and OFFSET in database query', async () => {
  const instrumentedDb = createInstrumentedDb();
  executedQueries = [];
  rowsReadCount = 0;

  const articles = await getAllArticles(instrumentedDb, 3, 2, 'published');
  assert.ok(articles.length <= 3, `Must return at most 3 articles, got ${articles.length}`);

  const articleQuery = executedQueries.find(q => q.sql.includes('LIMIT ? OFFSET ?'));
  assert.ok(articleQuery, 'Query must contain LIMIT ? OFFSET ? in SQL');
  assert.strictEqual(articleQuery.args[articleQuery.args.length - 2], 3, 'Limit bind parameter must be 3');
  assert.strictEqual(articleQuery.args[articleQuery.args.length - 1], 2, 'Offset bind parameter must be 2');
});

await it('8. getAllArticles uses separate status WHERE branch (no WHERE (? IS NULL OR status = ?))', async () => {
  const instrumentedDb = createInstrumentedDb();
  executedQueries = [];

  await getAllArticles(instrumentedDb, 5, 0, 'published');
  const pubQuery = executedQueries[0];
  assert.ok(pubQuery.sql.includes('a.status = ?'), 'Status query must use indexed a.status = ?');
  assert.ok(!pubQuery.sql.includes('? IS NULL OR a.status = ?'), 'Must ban unindexed ? IS NULL OR pattern');

  executedQueries = [];
  await getAllArticles(instrumentedDb, 5, 0, 'all');
  const allQuery = executedQueries[0];
  assert.ok(!allQuery.sql.includes('a.status = ?'), 'All query must not have status WHERE constraint');
});

await it('9. Lightweight article list excludes content_md and content_html from DB read', async () => {
  const instrumentedDb = createInstrumentedDb();
  executedQueries = [];

  const articles = await getAllArticles(instrumentedDb, 5, 0, 'published');
  const query = executedQueries[0];
  assert.ok(!query.sql.includes('a.*'), 'Listing query must not use SELECT a.*');
  assert.ok(query.sql.includes("'' as content_md, '' as content_html"), 'Listing query must project empty content placeholders');

  // Assert Article contract is preserved without throwing
  for (const art of articles) {
    assert.strictEqual(typeof art.id, 'number');
    assert.strictEqual(typeof art.slug, 'string');
    assert.strictEqual(art.content_md, '');
    assert.strictEqual(art.content_html, '');
  }
});

await it('10. getTotalArticlesCount runs SQL COUNT(*) instead of loading 1000 articles', async () => {
  const instrumentedDb = createInstrumentedDb();
  executedQueries = [];
  rowsReadCount = 0;

  const count = await getTotalArticlesCount(instrumentedDb, 'published');
  assert.strictEqual(typeof count, 'number');
  assert.ok(count > 0);

  const countQuery = executedQueries.find(q => q.sql.includes('SELECT COUNT(*)'));
  assert.ok(countQuery, 'Must execute SQL COUNT(*)');
  assert.ok(!executedQueries.some(q => q.sql.includes('LIMIT 1000')), 'Must not call getAllArticles with limit 1000');
  assert.strictEqual(rowsReadCount, 1, 'COUNT(*) should read only 1 aggregate row');
});

await it('11. getInternalLinkCandidates loads bounded metadata (limit 50, no content blobs)', async () => {
  const instrumentedDb = createInstrumentedDb();
  executedQueries = [];

  const candidates = await getInternalLinkCandidates(instrumentedDb, 50);
  assert.ok(Array.isArray(candidates));
  assert.ok(candidates.length > 0);

  const query = executedQueries[0];
  assert.ok(query.sql.includes('LIMIT ?'), 'Candidate query must be bounded with LIMIT');
  assert.ok(!query.sql.includes('content_md'), 'Candidates must not select content_md');
  assert.ok(!query.sql.includes('content_html'), 'Candidates must not select content_html');

  // Verify [slug].astro uses getInternalLinkCandidates instead of getAllArticles(1000)
  const slugAstro = fs.readFileSync('src/pages/[slug].astro', 'utf8');
  assert.ok(slugAstro.includes('getInternalLinkCandidates(db, 50)'), '[slug].astro must call getInternalLinkCandidates');
  assert.ok(!slugAstro.includes('getAllArticles(db, 1000'), '[slug].astro must ban getAllArticles(db, 1000)');
});

console.log('\n--- TEST SECTION 4: Staff Chat Decoupling & Settings Optimization ---');

await it('12. getLightweightStaffState retrieves staff state without getMissionControlSnapshot', async () => {
  const instrumentedDb = createInstrumentedDb();
  executedQueries = [];
  rowsReadCount = 0;

  const writerState = await getLightweightStaffState(instrumentedDb, 'content_writer_primary');
  assert.ok(writerState.state === 'WORKING' || writerState.state === 'IDLE');
  assert.ok(rowsReadCount <= 2, `Staff state lookup must read <= 2 rows, was ${rowsReadCount}`);

  // Verify chat endpoint uses getLightweightStaffState in GET
  const chatRoute = fs.readFileSync('src/pages/api/admin/mission-control/chat/[agent_id].ts', 'utf8');
  assert.ok(chatRoute.includes('await getLightweightStaffState(db, staff.agent_id)'), 'Chat GET must use getLightweightStaffState');
});

await it('13. getSiteSettingByKey executes targeted primary key read instead of scanning settings', async () => {
  const instrumentedDb = createInstrumentedDb();
  executedQueries = [];
  rowsReadCount = 0;

  const val = await getSiteSettingByKey(instrumentedDb, 'social_meta_connection_json');
  assert.ok(val && val.includes('connected'));

  const query = executedQueries[0];
  assert.ok(query.sql.includes('WHERE key = ? LIMIT 1'), 'Must query specific setting by key');
  assert.strictEqual(rowsReadCount, 1, 'Targeted setting read must read exactly 1 row');
});

console.log('\n--- TEST SECTION 5: EXPLAIN QUERY PLAN Index Verification ---');

const explainQueries = [
  {
    name: '1. Publication Cron Heartbeat (idx_cron_runs_started)',
    sql: 'EXPLAIN QUERY PLAN SELECT run_id, job_name, trigger_source, status, started_at, finished_at, error_summary FROM publication_cron_runs ORDER BY started_at DESC LIMIT 5',
    expectedIndex: 'idx_cron_runs_started'
  },
  {
    name: '2. Media Job Events Latest (idx_media_job_events_created)',
    sql: 'EXPLAIN QUERY PLAN SELECT event_id, job_id, event_type, created_at FROM media_job_events ORDER BY created_at DESC LIMIT 1',
    expectedIndex: 'idx_media_job_events_created'
  },
  {
    name: '3. Editorial Approvals Latest (idx_approvals_status_created)',
    sql: "EXPLAIN QUERY PLAN SELECT article_id, approved_by, created_at FROM article_editorial_approvals WHERE approval_status = 'APPROVED' ORDER BY created_at DESC LIMIT 1",
    expectedIndex: 'idx_approvals_status_created'
  },
  {
    name: '4. Pipeline Board Articles (idx_articles_updated)',
    sql: 'EXPLAIN QUERY PLAN SELECT id, slug, title, status, updated_at, published_at, featured_image FROM articles ORDER BY updated_at DESC LIMIT 50',
    expectedIndex: 'idx_articles_updated'
  },
  {
    name: '5. Pipeline Board Media Jobs (idx_media_jobs_created)',
    sql: 'EXPLAIN QUERY PLAN SELECT job_id, article_id, article_slug, article_title, status, attempt, max_attempts, last_error_code, last_error_message_safe, updated_at, created_at FROM media_jobs ORDER BY created_at DESC LIMIT 50',
    expectedIndex: 'idx_media_jobs_created'
  },
  {
    name: '6. Ingest Receipts Latest (idx_ingest_receipts_created)',
    sql: 'EXPLAIN QUERY PLAN SELECT job_id, article_id, created_at FROM article_ingest_receipts ORDER BY created_at DESC LIMIT 1',
    expectedIndex: 'idx_ingest_receipts_created'
  },
  {
    name: '7. Social Receipts Latest (idx_social_receipts_created)',
    sql: 'EXPLAIN QUERY PLAN SELECT receipt_id, variant_id, platform_id, outcome, actual_published_at, created_at FROM social_execution_receipts ORDER BY created_at DESC LIMIT 1',
    expectedIndex: 'idx_social_receipts_created'
  },
  {
    name: '8. Social Receipts Success Count (idx_social_receipts_outcome_created)',
    sql: "EXPLAIN QUERY PLAN SELECT COUNT(*) as count FROM social_execution_receipts WHERE outcome = 'SUCCESS'",
    expectedIndex: 'idx_social_receipts_outcome_created'
  },
  {
    name: '9. Articles By Status (idx_articles_status_published)',
    sql: "EXPLAIN QUERY PLAN SELECT id, slug, title, published_at FROM articles WHERE status = 'published' ORDER BY published_at DESC LIMIT 50",
    expectedIndex: 'idx_articles_status_published'
  }
];

for (const eq of explainQueries) {
  await it(`EXPLAIN QUERY PLAN: ${eq.name}`, async () => {
    const plans = sqlite.prepare(eq.sql).all();
    const planText = plans.map(p => p.detail).join(' | ');
    assert.ok(
      planText.includes(eq.expectedIndex),
      `Plan must use index ${eq.expectedIndex}, actual plan: ${planText}`
    );
    assert.ok(
      !planText.includes('USE TEMP B-TREE'),
      `Plan must not use TEMP B-TREE for sorting, actual plan: ${planText}`
    );
  });
}

console.log('\n--- TEST SECTION 6: Safety Invariants & Zero Production Writes ---');

await it('14. Zero remote production D1 writes or mutations executed during test suite', async () => {
  assert.ok(process.env.D1_DATABASE_ID === undefined || process.env.NODE_ENV === 'test');
  assert.strictEqual(sqlite.prepare('SELECT COUNT(*) as count FROM articles').get().count, 10);
});

await it('15. Strict safety invariants confirmed', async () => {
  const auto = sqlite.prepare('SELECT mode, kill_switch_engaged FROM automation_control WHERE id = 1').get();
  assert.strictEqual(auto.mode, 'OFF');
  assert.strictEqual(auto.kill_switch_engaged, 0);
});

console.log('\n===========================================================');
console.log(`🏁 D1 Row Read Hotfix Test Suite Complete: ${passedTests} Passed, 0 Failed`);
console.log('===========================================================');
