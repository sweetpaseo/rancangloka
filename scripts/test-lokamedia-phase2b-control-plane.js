import { test } from 'node:test';
import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import { readFileSync, readdirSync } from 'node:fs';
import { resolve } from 'node:path';
import {
  JOB_STATUS_LEASED,
  JOB_STATUS_PROMPT_PREPARING,
  JOB_STATUS_QUEUED,
  JOB_STATUS_RECOVERING,
  JOB_STATUS_WAITING_RETRY,
  JOB_STATUS_COMPLETE,
  LOKAMEDIA_PROTOCOL_VERSION,
  MEDIA_JOB_LEASE_SECONDS,
  MEDIA_JOB_HEARTBEAT_SECONDS,
  PRIORITY_URGENT,
  createMediaRequirement,
  acquireMediaJobLease,
  heartbeatMediaJobLease,
  recoverExpiredLease,
  releaseMediaJobLease,
  scheduleMediaJobRetry,
  appendMediaJobReceipt,
  appendLeasedProgressEvent,
  reconcileMediaJob,
  chooseNextMediaJob,
  transitionMediaJob
} from '../src/lib/media/jobs-service.ts';

function createDb() {
  const db = new DatabaseSync(':memory:');
  db.exec(`
    CREATE TABLE categories (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      slug TEXT NOT NULL UNIQUE,
      color_badge TEXT DEFAULT '#059669',
      description TEXT,
      show_on_home INTEGER DEFAULT 1,
      display_order INTEGER DEFAULT 1,
      layout_style TEXT DEFAULT 'bento',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
    CREATE TABLE authors (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      slug TEXT NOT NULL UNIQUE,
      bio TEXT,
      avatar TEXT,
      role TEXT DEFAULT 'Editor',
      social_links TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
    CREATE TABLE articles (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      slug TEXT NOT NULL UNIQUE,
      title TEXT NOT NULL,
      description TEXT,
      content_md TEXT NOT NULL,
      content_html TEXT NOT NULL,
      featured_image TEXT,
      image_alt TEXT,
      category_id INTEGER REFERENCES categories(id) ON DELETE SET NULL,
      author_id INTEGER REFERENCES authors(id) ON DELETE SET NULL,
      status TEXT DEFAULT 'published' CHECK(status IN ('draft', 'published', 'scheduled')),
      views INTEGER DEFAULT 0,
      reading_time_minutes INTEGER DEFAULT 3,
      key_takeaways TEXT,
      focus_keyword TEXT,
      content_hash TEXT,
      is_featured INTEGER DEFAULT 0,
      is_trending INTEGER DEFAULT 0,
      published_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
    INSERT INTO categories (id, name, slug) VALUES (1, 'Interior', 'interior');
    INSERT INTO authors (id, name, slug) VALUES (1, 'Desk', 'desk');
    INSERT INTO articles (id, slug, title, description, content_md, content_html, status, category_id, author_id, content_hash)
    VALUES
      (81, 'a', 'Article A', 'A', '# A', '<p>A</p>', 'draft', 1, 1, 'h81'),
      (82, 'b', 'Article B', 'B', '# B', '<p>B</p>', 'draft', 1, 1, 'h82'),
      (83, 'c', 'Article C', 'C', '# C', '<p>C</p>', 'draft', 1, 1, 'h83'),
      (84, 'published', 'Published', 'P', '# P', '<p>P</p>', 'published', 1, 1, 'h84');
  `);
  const migrationsDir = resolve(process.cwd(), 'db/migrations');
  for (const file of readdirSync(migrationsDir).filter((f) => f.endsWith('.sql')).sort()) {
    db.exec(readFileSync(resolve(migrationsDir, file), 'utf8'));
  }
  return db;
}

function asD1(db) {
  return {
    raw: db,
    prepare(sql) {
      const stmt = db.prepare(sql);
      let values = [];
      return {
        bind(...args) {
          values = args;
          return this;
        },
        first() {
          return stmt.get(...values) || null;
        },
        all() {
          return { results: stmt.all(...values) };
        },
        run() {
          return stmt.run(...values);
        }
      };
    }
  };
}

async function seedFairnessJobs(d1) {
  const defs = [
    [81, 'featured', 'featured', 0, true],
    [81, 'inline1', 'inline', 1, false],
    [81, 'inline2', 'inline', 2, false],
    [81, 'inline3', 'inline', 3, false],
    [82, 'featured', 'featured', 0, true],
    [82, 'inline1', 'inline', 1, false],
    [83, 'featured', 'featured', 0, true]
  ];
  for (const [article_id, slot_key, role, sequence, required] of defs) {
    await createMediaRequirement(d1, {
      job_id: `mjob_${article_id}_${slot_key}`,
      article_id,
      slot_key,
      role,
      sequence,
      required_for_readiness: required,
      prompt: `Prompt ${article_id} ${slot_key}`,
      alt_text: `Alt ${article_id} ${slot_key}`
    });
  }
}

test('Phase 2B scheduler fairness: covers before inline and deterministic article rotation', async () => {
  const db = createDb();
  const d1 = asD1(db);
  await seedFairnessJobs(d1);

  const order = [];
  for (let i = 0; i < 7; i++) {
    const next = await chooseNextMediaJob(d1);
    order.push(`${next.article_id}:${next.slot_key}`);
    db.prepare("UPDATE media_jobs SET status = 'COMPLETE' WHERE job_id = ?").run(next.job_id);
  }
  assert.deepEqual(order, [
    '81:featured',
    '82:featured',
    '83:featured',
    '81:inline1',
    '82:inline1',
    '81:inline2',
    '81:inline3'
  ]);
});

test('Phase 2B scheduler excludes retries not due, leased, terminal, superseded, and published articles', async () => {
  const db = createDb();
  const d1 = asD1(db);
  await createMediaRequirement(d1, { job_id: 'mjob_due', article_id: 81, slot_key: 'featured', role: 'featured', prompt: 'Due', alt_text: 'Due' });
  await createMediaRequirement(d1, { job_id: 'mjob_published', article_id: 84, slot_key: 'featured', role: 'featured', prompt: 'Published', alt_text: 'Published' }).catch(() => null);
  await createMediaRequirement(d1, { job_id: 'mjob_retry', article_id: 82, slot_key: 'featured', role: 'featured', prompt: 'Retry', alt_text: 'Retry' });
  db.prepare("UPDATE media_jobs SET status = 'WAITING_RETRY', next_retry_at = '2099-01-01T00:00:00.000Z' WHERE job_id = 'mjob_retry'").run();
  const next = await chooseNextMediaJob(d1);
  assert.equal(next.job_id, 'mjob_due');
});

test('Phase 2B urgent priority wins without letting one article monopolize same-priority inline jobs', async () => {
  const db = createDb();
  const d1 = asD1(db);
  await seedFairnessJobs(d1);
  await createMediaRequirement(d1, {
    job_id: 'mjob_82_urgent',
    article_id: 82,
    slot_key: 'material_comparison',
    role: 'inline',
    sequence: 9,
    priority: PRIORITY_URGENT,
    prompt: 'Urgent',
    alt_text: 'Urgent'
  });
  const first = await chooseNextMediaJob(d1);
  assert.equal(first.job_id, 'mjob_82_urgent');
});

test('Phase 2B atomic lease races: 2 and 10 workers cannot lease the same job', async () => {
  for (const workerCount of [2, 10]) {
    const db = createDb();
    const d1 = asD1(db);
    await createMediaRequirement(d1, { job_id: `mjob_race_${workerCount}`, article_id: 81, slot_key: 'featured', role: 'featured', prompt: 'Race', alt_text: 'Race' });
    const results = await Promise.all(Array.from({ length: workerCount }, (_, i) => acquireMediaJobLease(d1, `worker_${i}`)));
    assert.equal(results.filter((r) => r.acquired).length, 1);
    assert.equal(new Set(results.filter((r) => r.acquired).map((r) => r.job.job_id)).size, 1);
  }
});

test('Phase 2B many workers many jobs produce no duplicate active leases', async () => {
  const db = createDb();
  const d1 = asD1(db);
  await seedFairnessJobs(d1);
  const results = await Promise.all(Array.from({ length: 10 }, (_, i) => acquireMediaJobLease(d1, `worker_many_${i}`)));
  const leased = results.filter((r) => r.acquired).map((r) => r.job.job_id);
  assert.equal(leased.length, new Set(leased).size);
});

test('Phase 2B heartbeat, stale revision protection, release, retry and recovery semantics', async () => {
  const db = createDb();
  const d1 = asD1(db);
  await createMediaRequirement(d1, { job_id: 'mjob_control', article_id: 81, slot_key: 'featured', role: 'featured', prompt: 'Control', alt_text: 'Control' });
  const lease = await acquireMediaJobLease(d1, 'device_a', { now: new Date('2026-09-14T00:00:00.000Z') });
  assert.equal(lease.acquired, true);
  assert.equal(lease.job.status, JOB_STATUS_LEASED);
  assert.equal(lease.job.attempt, 0);

  const heartbeat = await heartbeatMediaJobLease(d1, 'mjob_control', 'device_a', lease.job.job_revision, { now: new Date('2026-09-14T00:01:00.000Z') });
  assert.equal(heartbeat.lease_owner, 'device_a');
  await assert.rejects(() => heartbeatMediaJobLease(d1, 'mjob_control', 'device_b', heartbeat.job_revision), /LEASE_NOT_OWNER/);
  const repeatedHeartbeat = await heartbeatMediaJobLease(d1, 'mjob_control', 'device_a', lease.job.job_revision, { now: new Date('2026-09-14T00:02:00.000Z') });
  assert.equal(repeatedHeartbeat.job_revision, lease.job.job_revision);

  const released = await releaseMediaJobLease(d1, 'mjob_control', 'device_a', heartbeat.job_revision, 'SAFE_REQUEUE', 'EXTENSION_SHUTDOWN');
  assert.equal(released.status, JOB_STATUS_QUEUED);
  assert.equal(released.attempt, 0);

  const lease2 = await acquireMediaJobLease(d1, 'device_a', { now: new Date('2026-09-14T00:02:00.000Z') });
  const waiting = await releaseMediaJobLease(d1, 'mjob_control', 'device_a', lease2.job.job_revision, 'WAITING_RETRY', 'TRANSIENT_NETWORK', 'temporary network issue', new Date('2026-09-14T00:03:00.000Z'));
  assert.equal(waiting.status, JOB_STATUS_WAITING_RETRY);
  assert.equal(waiting.attempt, 1);
  assert.ok(waiting.next_retry_at);

  db.prepare("UPDATE media_jobs SET status = 'LEASED', lease_owner = 'dead_worker', lease_expires_at = '2026-09-14T00:00:00.000Z' WHERE job_id = 'mjob_control'").run();
  const recovered = await recoverExpiredLease(d1, 'mjob_control', new Date('2026-09-14T00:10:00.000Z'));
  assert.equal(recovered.status, JOB_STATUS_RECOVERING);
  assert.equal(recovered.lease_owner, null);
});

test('Phase 2B reconciliation handles lost responses, receipts, lease reassignment and no article mutation', async () => {
  const db = createDb();
  const d1 = asD1(db);
  await createMediaRequirement(d1, { job_id: 'mjob_reconcile', article_id: 81, slot_key: 'featured', role: 'featured', prompt: 'Reconcile', alt_text: 'Reconcile' });
  const lease = await acquireMediaJobLease(d1, 'device_a');
  await appendMediaJobReceipt(d1, {
    receipt_id: 'mjr_reconcile',
    job_id: 'mjob_reconcile',
    idempotency_key: 'idem_reconcile',
    receipt_type: 'ATTACHMENT_CONFIRMED',
    asset_id: null,
    article_media_id: null
  });
  db.prepare("UPDATE media_jobs SET status = 'ATTACHMENT_CONFIRMED' WHERE job_id = 'mjob_reconcile'").run();
  const rec = await reconcileMediaJob(d1, 'mjob_reconcile', 'device_a');
  assert.equal(rec.attachment_confirmed, true);
  assert.equal(rec.recommended_action, 'COMPLETE');
  assert.equal(rec.latest_receipt.receipt_id, 'mjr_reconcile');

  db.prepare("UPDATE media_jobs SET status = 'SUPERSEDED', lease_owner = 'device_b', lease_expires_at = '2099-01-01T00:00:00.000Z' WHERE job_id = 'mjob_reconcile'").run();
  const oldClient = await reconcileMediaJob(d1, 'mjob_reconcile', 'device_a');
  assert.equal(oldClient.recommended_action, 'STOP');
  assert.equal(oldClient.lease_owned_by_requester, false);

  const article = db.prepare('SELECT status FROM articles WHERE id = 81').get();
  assert.equal(article.status, 'draft');
  assert.equal(MEDIA_JOB_LEASE_SECONDS, 300);
  assert.equal(MEDIA_JOB_HEARTBEAT_SECONDS, 60);
  assert.equal(LOKAMEDIA_PROTOCOL_VERSION, 1);
});

test('Phase 2B progress event API primitive is safe and lease-bound', async () => {
  const db = createDb();
  const d1 = asD1(db);
  await createMediaRequirement(d1, { job_id: 'mjob_event', article_id: 81, slot_key: 'featured', role: 'featured', prompt: 'Event', alt_text: 'Event' });
  const lease = await acquireMediaJobLease(d1, 'device_a');
  const event = await appendLeasedProgressEvent(d1, {
    job_id: 'mjob_event',
    device_id: 'device_a',
    expected_job_revision: lease.job.job_revision,
    event_type: 'GENERATION_STARTED',
    stage: 'GENERATING',
    safe_payload: { token: 'secret', elapsed_ms: 500 }
  });
  assert.match(event.safe_payload_json, /\[REDACTED\]/);
  await assert.rejects(() => appendLeasedProgressEvent(d1, {
    job_id: 'mjob_event',
    device_id: 'device_b',
    event_type: 'JOB_PROGRESS',
    stage: 'GENERATING'
  }), /LEASE_NOT_OWNER/);
});

test('Phase 2B next-job no-work behavior is deterministic', async () => {
  const db = createDb();
  const d1 = asD1(db);
  const res = await acquireMediaJobLease(d1, 'device_a');
  assert.equal(res.acquired, false);
  assert.equal(res.code, 'NO_ELIGIBLE_JOB');
  assert.ok(res.retry_after_ms > 0);
});
