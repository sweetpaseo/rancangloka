import { test } from 'node:test';
import assert from 'node:assert/strict';
import zlib from 'node:zlib';
import { DatabaseSync } from 'node:sqlite';
import { readFileSync, readdirSync } from 'node:fs';
import { resolve } from 'node:path';
import {
  processMediaUpload,
  computeBufferSha256,
  calculateArticleReadiness,
  READINESS_READY_FOR_REVIEW,
  READINESS_MEDIA_IN_PROGRESS,
  SOURCE_TYPE_LOKAMEDIA_EXTENSION
} from '../src/lib/media/service.ts';
import {
  LOKAMEDIA_PROTOCOL_VERSION,
  createMediaRequirement,
  transitionMediaJob,
  reconcileMediaJob,
  appendLeasedProgressEvent,
  JOB_STATUS_GENERATING,
  JOB_STATUS_CAPTURED
} from '../src/lib/media/jobs-service.ts';
import { renderMediaSlotAnchors } from '../src/lib/media/renderer.ts';

function png(width = 800, height = 450) {
  const signature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  const ihdrData = Buffer.alloc(13);
  ihdrData.writeUInt32BE(width, 0);
  ihdrData.writeUInt32BE(height, 4);
  ihdrData.writeUInt8(8, 8);
  ihdrData.writeUInt8(6, 9);
  const scanlines = Buffer.alloc(height * (1 + width * 4), 0);
  const compressed = zlib.deflateSync(scanlines);
  function chunk(type, data) {
    const len = Buffer.alloc(4);
    len.writeUInt32BE(data.length, 0);
    const crc = Buffer.alloc(4);
    return Buffer.concat([len, Buffer.from(type, 'ascii'), data, crc]);
  }
  return Buffer.concat([signature, chunk('IHDR', ihdrData), chunk('IDAT', compressed), chunk('IEND', Buffer.alloc(0))]);
}

function arrayBuffer(buf) {
  return buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength);
}

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
      id INTEGER PRIMARY KEY,
      slug TEXT UNIQUE,
      title TEXT,
      description TEXT,
      content_md TEXT,
      content_html TEXT,
      featured_image TEXT,
      image_alt TEXT,
      category_id INTEGER,
      author_id INTEGER,
      status TEXT DEFAULT 'draft',
      reading_time_minutes INTEGER DEFAULT 3,
      key_takeaways TEXT,
      focus_keyword TEXT,
      content_hash TEXT,
      is_featured INTEGER DEFAULT 0,
      is_trending INTEGER DEFAULT 0,
      published_at DATETIME,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
    INSERT INTO categories (id, name, slug) VALUES (1, 'Interior', 'interior');
    INSERT INTO authors (id, name, slug) VALUES (1, 'Desk', 'desk');
    INSERT INTO articles (id, slug, title, description, content_md, content_html, status, category_id, author_id, content_hash)
    VALUES
      (201, 'draft-a', 'Draft A', 'A', '# A', '<p>A</p>{{media:cross_ventilation}}', 'draft', 1, 1, 'ha'),
      (202, 'draft-b', 'Draft B', 'B', '# B', '<p>B</p>', 'draft', 1, 1, 'hb');
  `);
  for (const file of readdirSync(resolve(process.cwd(), 'db/migrations')).filter((f) => f.endsWith('.sql')).sort()) {
    db.exec(readFileSync(resolve(process.cwd(), 'db/migrations', file), 'utf8'));
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
          const res = stmt.run(...values);
          return { success: true, changes: res.changes, lastInsertRowid: Number(res.lastInsertRowid), meta: { changes: res.changes, last_row_id: Number(res.lastInsertRowid) } };
        }
      };
    }
  };
}

function bucket() {
  const store = new Map();
  return {
    puts: 0,
    store,
    async put(key, body, options) {
      this.puts++;
      store.set(key, { body, options });
    }
  };
}

async function requirement(d1, articleId, slotKey, role = 'inline', required = true) {
  const job = await createMediaRequirement(d1, {
    job_id: `mjob_${articleId}_${slotKey}`,
    article_id: articleId,
    slot_key: slotKey,
    role,
    sequence: role === 'featured' ? 0 : slotKey.endsWith('optional') ? 9 : 1,
    required_for_readiness: required,
    prompt: `Prompt ${articleId} ${slotKey}`,
    alt_text: `Alt ${slotKey}`
  });
  dbFromD1(d1).prepare("UPDATE media_jobs SET status = 'CAPTURED', job_revision = job_revision + 1 WHERE job_id = ?").run(job.job_id);
  return d1.prepare('SELECT * FROM media_jobs WHERE job_id = ?').bind(job.job_id).first();
}

function dbFromD1(d1) {
  return d1.raw;
}

async function upload(d1, r2, job, body, extra = {}) {
  return processMediaUpload({
    sourceType: SOURCE_TYPE_LOKAMEDIA_EXTENSION,
    protocolVersion: LOKAMEDIA_PROTOCOL_VERSION,
    jobId: job.job_id,
    expectedJobRevision: job.job_revision,
    articleId: job.article_id,
    slotKey: job.slot_key,
    role: job.role,
    sequence: job.sequence,
    promptVersion: job.prompt_version,
    promptHash: job.prompt_hash,
    idempotencyKey: `idem_${job.job_id}`,
    clientSha256: await computeBufferSha256(body),
    imageBuffer: body,
    altText: job.alt_text,
    deviceId: job.lease_owner,
    ...extra
  }, d1, r2);
}

test('Phase 2C job-bound upload, receipts, readiness and renderer', async () => {
  const db = createDb();
  const d1 = asD1(db);
  const r2 = bucket();
  const body = arrayBuffer(png());

  const featured = await requirement(d1, 201, 'featured', 'featured', true);
  const inline = await requirement(d1, 201, 'cross_ventilation', 'inline', true);
  await requirement(d1, 201, 'inline_optional', 'inline', false);
  assert.equal(await calculateArticleReadiness(d1, 201), READINESS_MEDIA_IN_PROGRESS);

  const first = await upload(d1, r2, featured, body);
  assert.equal(first.slotKey, 'featured');
  assert.equal(first.receiptType, 'ATTACHMENT_CONFIRMED');
  assert.equal(first.deduplicated, false);
  assert.equal(r2.puts, 1);
  assert.equal(db.prepare("SELECT status FROM articles WHERE id = 201").get().status, 'draft');

  await upload(d1, r2, inline, body);
  assert.equal(await calculateArticleReadiness(d1, 201), READINESS_READY_FOR_REVIEW);
  assert.equal(db.prepare("SELECT COUNT(*) AS c FROM media_assets").get().c, 1);
  assert.equal(db.prepare("SELECT COUNT(*) AS c FROM article_media WHERE article_id = 201 AND is_active = 1").get().c, 2);

  const html = await renderMediaSlotAnchors(d1, 201, '<p>X</p>{{media:cross_ventilation}}{{media:missing_slot}}');
  assert.match(html, /data-media-slot="cross_ventilation"/);
  assert.doesNotMatch(html, /missing_slot/);
});

test('Phase 2C idempotency, lost response recovery and wrong target rejection', async () => {
  const db = createDb();
  const d1 = asD1(db);
  const r2 = bucket();
  const body = arrayBuffer(png());
  const job = await requirement(d1, 202, 'featured', 'featured', true);

  await assert.rejects(() => upload(d1, r2, job, body, { articleId: 201 }), /JOB_ARTICLE_MISMATCH/);
  await assert.rejects(() => upload(d1, r2, job, body, { slotKey: 'wrong_slot' }), /JOB_SLOT_MISMATCH/);
  await assert.rejects(() => upload(d1, r2, job, body, { expectedJobRevision: 999 }), /JOB_REVISION_CONFLICT/);
  await assert.rejects(() => upload(d1, r2, job, body, { clientSha256: '0'.repeat(64) }), /CLIENT_SHA256_MISMATCH/);

  await assert.rejects(() => upload(d1, r2, job, body, { failureInjectionPoint: 'AFTER_RECEIPT' }), /INJECTED_AFTER_RECEIPT/);
  const rec = await reconcileMediaJob(d1, job.job_id);
  assert.equal(rec.attachment_confirmed, true);
  assert.equal(rec.recommended_action, 'COMPLETE');

  const replay = await upload(d1, r2, job, body);
  assert.equal(replay.receiptType, 'ATTACHMENT_CONFIRMED');
  assert.equal(r2.puts, 1);
  assert.equal(db.prepare("SELECT COUNT(*) AS c FROM article_media WHERE article_id = 202 AND slot_key = 'featured' AND is_active = 1").get().c, 1);
});

test('Phase 2C concurrent independent uploads and generation/upload overlap', async () => {
  const db = createDb();
  const d1 = asD1(db);
  const r2 = bucket();
  const bodyA = arrayBuffer(png(800, 450));
  const bodyB = arrayBuffer(png(900, 506));
  const a = await requirement(d1, 201, 'featured', 'featured', true);
  let b = await requirement(d1, 202, 'featured', 'featured', true);
  db.prepare("UPDATE media_jobs SET status = 'GENERATING', job_revision = job_revision + 1 WHERE job_id = ?").run(b.job_id);
  b = d1.prepare('SELECT * FROM media_jobs WHERE job_id = ?').bind(b.job_id).first();

  const resA = await upload(d1, r2, a, bodyA);
  assert.equal(resA.articleId, 201);
  assert.equal((await reconcileMediaJob(d1, b.job_id)).status, JOB_STATUS_GENERATING);

  db.prepare("UPDATE media_jobs SET status = 'CAPTURED', job_revision = job_revision + 1 WHERE job_id = ?").run(b.job_id);
  b = d1.prepare('SELECT * FROM media_jobs WHERE job_id = ?').bind(b.job_id).first();
  const resB = await upload(d1, r2, b, bodyB);
  assert.equal(resB.articleId, 202);
  assert.equal(db.prepare("SELECT COUNT(*) AS c FROM article_media WHERE is_active = 1").get().c, 2);
  assert.equal(db.prepare("SELECT COUNT(*) AS c FROM media_assets").get().c, 2);
});

test('Phase 2C progress events are bounded', async () => {
  const db = createDb();
  const d1 = asD1(db);
  const job = await requirement(d1, 201, 'featured', 'featured', true);
  await appendLeasedProgressEvent(d1, {
    job_id: job.job_id,
    event_type: 'UPLOAD_PROGRESS',
    stage: 'UPLOADING',
    device_id: 'device',
    safe_payload: { bytes_sent: 10, bytes_total: 100, percentage: 10 }
  });
  await assert.rejects(() => appendLeasedProgressEvent(d1, {
    job_id: job.job_id,
    event_type: 'UPLOAD_PROGRESS',
    stage: 'UPLOADING',
    device_id: 'device',
    safe_payload: { bytes_sent: 200, bytes_total: 100, percentage: 200 }
  }), /INVALID_PROGRESS/);
});
