import { test } from 'node:test';
import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import { readFileSync, readdirSync } from 'node:fs';
import { resolve } from 'node:path';
import {
  JOB_STATUS_QUEUED,
  JOB_STATUS_LEASED,
  JOB_STATUS_PROMPT_PREPARING,
  JOB_STATUS_COMPLETE,
  JOB_STATUS_FAILED_TERMINAL,
  PRIORITY_NORMAL,
  PRIORITY_HIGH,
  TERMINAL_STATES,
  createMediaRequirement,
  hasActiveJobForSlot,
  transitionMediaJob,
  appendMediaJobReceipt,
  getReceiptByIdempotencyKey,
  appendMediaJobEvent,
  computePromptHash
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
    INSERT INTO authors (id, name, slug) VALUES (1, 'RancangLoka Editorial Desk', 'dewan-redaksi-spasial');
    INSERT INTO articles (
      id, slug, title, description, content_md, content_html, status, category_id, author_id, content_hash
    ) VALUES (
      81, 'rumah-tropis-ventilasi-silang', 'Rumah Tropis Ventilasi Silang',
      'Draft', '# Draft', '<p>Draft</p>', 'draft', 1, 1, 'hash81'
    );
    INSERT INTO articles (
      id, slug, title, description, content_md, content_html, status, category_id, author_id, content_hash
    ) VALUES (
      82, 'artikel-published', 'Artikel Published',
      'Published', '# Published', '<p>Published</p>', 'published', 1, 1, 'hash82'
    );
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

test('LokaMedia Phase 2A: migration extends durable media job schema', () => {
  const db = createDb();
  const columns = db.prepare('PRAGMA table_info(media_jobs)').all().map((row) => row.name);
  for (const col of [
    'required_for_readiness',
    'priority',
    'sequence',
    'prompt_version',
    'prompt_hash',
    'lease_owner',
    'lease_expires_at',
    'heartbeat_at',
    'attempt',
    'max_attempts',
    'next_retry_at',
    'last_error_code',
    'last_error_message_safe',
    'idempotency_key',
    'submitted_at',
    'completed_at',
    'job_revision',
    'superseded_by_job_id'
  ]) {
    assert.ok(columns.includes(col), `media_jobs has ${col}`);
  }

  const indexes = db.prepare("PRAGMA index_list('media_jobs')").all().map((row) => row.name);
  assert.ok(indexes.includes('idx_media_jobs_one_active_slot'), 'active slot partial unique index exists');
  assert.ok(indexes.includes('idx_media_jobs_status_priority_retry'), 'scheduler index exists');
  assert.ok(indexes.includes('idx_media_jobs_lease'), 'lease index exists');
  assert.deepEqual([...TERMINAL_STATES].sort(), ['CANCELLED', 'COMPLETE', 'FAILED_TERMINAL', 'SUPERSEDED'].sort());
});

test('LokaMedia Phase 2A: legacy rows migrate without data loss', () => {
  const db = createDb();
  db.exec(`
    INSERT INTO media_jobs (
      job_id, article_id, article_slug, article_title, role, slot_key,
      media_type, prompt, alt_text, status
    ) VALUES (
      'mjob_legacy_done', 81, 'rumah-tropis-ventilasi-silang',
      'Rumah Tropis Ventilasi Silang', 'featured', 'featured',
      'image', 'Prompt lama', 'Alt lama', 'COMPLETE'
    );
  `);
  const row = db.prepare("SELECT status, prompt, required_for_readiness, priority FROM media_jobs WHERE job_id = 'mjob_legacy_done'").get();
  assert.equal(row.status, JOB_STATUS_COMPLETE);
  assert.equal(row.prompt, 'Prompt lama');
  assert.equal(row.required_for_readiness, 1);
  assert.equal(row.priority, PRIORITY_NORMAL);
});

test('LokaMedia Phase 2A: media requirement creation and active-slot guard', async () => {
  const db = createDb();
  const d1 = asD1(db);
  const job = await createMediaRequirement(d1, {
    job_id: 'mjob_81_featured_a',
    article_id: 81,
    slot_key: 'featured',
    role: 'featured',
    required_for_readiness: true,
    priority: 'HIGH',
    prompt: 'Rumah tropis dengan ventilasi silang alami',
    alt_text: 'Ilustrasi rumah tropis dengan ventilasi silang'
  });

  assert.equal(job.status, JOB_STATUS_QUEUED);
  assert.equal(job.prompt_version, 1);
  assert.equal(job.prompt_hash, await computePromptHash('Rumah tropis dengan ventilasi silang alami', 1));
  assert.equal(job.required_for_readiness, 1);
  assert.equal(job.priority, PRIORITY_HIGH);
  assert.equal(await hasActiveJobForSlot(d1, 81, 'featured'), true);

  await assert.rejects(
    () => createMediaRequirement(d1, {
      job_id: 'mjob_81_featured_b',
      article_id: 81,
      slot_key: 'featured',
      role: 'featured',
      prompt: 'Prompt kedua',
      alt_text: 'Alt kedua'
    }),
    /Active media job/
  );

  await assert.rejects(
    () => createMediaRequirement(d1, {
      article_id: 81,
      slot_key: 'Image 1',
      role: 'inline',
      prompt: 'Prompt',
      alt_text: 'Alt'
    }),
    /slot_key/
  );

  await assert.rejects(
    () => createMediaRequirement(d1, {
      article_id: 82,
      slot_key: 'featured',
      role: 'featured',
      prompt: 'Prompt',
      alt_text: 'Alt'
    }),
    /draft/
  );
});

test('LokaMedia Phase 2A: terminal historical job allows new attempt', async () => {
  const db = createDb();
  const d1 = asD1(db);
  await createMediaRequirement(d1, {
    job_id: 'mjob_81_window_a',
    article_id: 81,
    slot_key: 'window_detail',
    role: 'inline',
    required_for_readiness: false,
    prompt: 'Detail jendela tropis',
    alt_text: 'Detail jendela'
  });

  await transitionMediaJob(d1, 'mjob_81_window_a', JOB_STATUS_FAILED_TERMINAL);
  assert.equal(await hasActiveJobForSlot(d1, 81, 'window_detail'), false);

  const retry = await createMediaRequirement(d1, {
    job_id: 'mjob_81_window_b',
    article_id: 81,
    slot_key: 'window_detail',
    role: 'inline',
    prompt: 'Detail jendela tropis revisi',
    alt_text: 'Detail jendela revisi'
  });
  assert.equal(retry.status, JOB_STATUS_QUEUED);
});

test('LokaMedia Phase 2A: legal transitions, illegal transitions, attempts, receipts, events', async () => {
  const db = createDb();
  const d1 = asD1(db);
  await createMediaRequirement(d1, {
    job_id: 'mjob_81_cross',
    article_id: 81,
    slot_key: 'cross_ventilation',
    role: 'inline',
    required_for_readiness: true,
    prompt: 'Diagram ventilasi silang',
    alt_text: 'Diagram ventilasi silang'
  });

  let job = await transitionMediaJob(d1, 'mjob_81_cross', JOB_STATUS_LEASED);
  assert.equal(job.status, JOB_STATUS_LEASED);
  job = await transitionMediaJob(d1, 'mjob_81_cross', JOB_STATUS_PROMPT_PREPARING);
  assert.equal(job.status, JOB_STATUS_PROMPT_PREPARING);

  await assert.rejects(
    () => transitionMediaJob(d1, 'mjob_81_cross', JOB_STATUS_COMPLETE),
    /tidak legal/
  );

  job = await transitionMediaJob(d1, 'mjob_81_cross', 'WAITING_RETRY', {
    incrementAttempt: true,
    errorCode: 'PROVIDER_TIMEOUT',
    errorMessageSafe: 'Generation timed out'
  });
  assert.equal(job.attempt, 1);
  assert.equal(job.last_error_code, 'PROVIDER_TIMEOUT');

  const receipt1 = await appendMediaJobReceipt(d1, {
    receipt_id: 'mjr_cross_1',
    job_id: 'mjob_81_cross',
    idempotency_key: 'idem_cross',
    receipt_type: 'UPLOAD_ACCEPTED',
    sha256: 'abc123',
    safe_payload: { token: 'secret', note: 'safe' }
  });
  const receipt2 = await appendMediaJobReceipt(d1, {
    receipt_id: 'mjr_cross_duplicate',
    job_id: 'mjob_81_cross',
    idempotency_key: 'idem_cross',
    receipt_type: 'UPLOAD_ACCEPTED',
    sha256: 'abc123'
  });
  assert.equal(receipt1.receipt_id, receipt2.receipt_id);
  assert.match(receipt1.safe_payload_json, /\[REDACTED\]/);
  assert.equal((await getReceiptByIdempotencyKey(d1, 'mjob_81_cross', 'idem_cross', 'UPLOAD_ACCEPTED')).receipt_id, 'mjr_cross_1');

  const event = await appendMediaJobEvent(d1, {
    event_id: 'mje_cross_1',
    job_id: 'mjob_81_cross',
    event_type: 'JOB_PROGRESS',
    stage: 'WAITING_RETRY',
    attempt: 1,
    safe_payload: { cookie: 'private', percent: 40 }
  });
  assert.equal(event.event_type, 'JOB_PROGRESS');
  assert.match(event.safe_payload_json, /\[REDACTED\]/);
});

test('LokaMedia Phase 2A: media jobs never publish articles and AUTO_PUBLISH remains OFF-compatible', async () => {
  const db = createDb();
  const d1 = asD1(db);
  await createMediaRequirement(d1, {
    job_id: 'mjob_81_material',
    article_id: 81,
    slot_key: 'material_comparison',
    role: 'inline',
    prompt: 'Perbandingan material fasad',
    alt_text: 'Perbandingan material fasad'
  });
  const article = db.prepare('SELECT status FROM articles WHERE id = 81').get();
  assert.equal(article.status, 'draft');

  const automation = db.prepare('SELECT mode FROM automation_control WHERE id = 1').get();
  assert.equal(automation.mode, 'OFF');
});
