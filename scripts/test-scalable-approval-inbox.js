/**
 * RancangLoka — SCALABLE APPROVAL INBOX TEST SUITE
 * Milestone: APPROVAL-INBOX-V1
 *
 * Verifies:
 * 1.  0 pending approvals: Calm state, badge is 0, empty bell preview.
 * 2.  1 pending approval: Accurate count, single preview item, valid detailUrl.
 * 3.  5 pending approvals: Oldest-waiting ordering, bell preview has 5 items.
 * 4.  20 pending approvals: Scale case, bell preview strictly capped at 5 (not 20).
 * 5.  Oldest pending ordering guarantees zero request starvation.
 * 6.  Pagination & bounded rendering support for high-volume queues.
 * 7.  Filtering by status (Menunggu, Minta Revisi, Selesai) does not mutate workflow records.
 * 8.  Filtering by type (Artikel, Media) isolates categories correctly.
 * 9.  Search filter matches title and slug.
 * 10. Single Source of Truth: Header Bell count & Sidebar count use exact same projection.
 * 11. NO BULK APPROVAL: Enforces that human decisions remain deliberate, individual, and item-by-item.
 * 12. Approval completion removes item from pending queue and increments completed count.
 * 13. Deterministic next pending navigation (Fast Review Flow) follows queue order.
 * 14. Human-readable age formatting ('Baru saja', '18 menit', '2 jam', '1 hari', '3 hari').
 * 15. Admin UX Principles recorded and validated.
 */

import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';

import {
  getApprovalInboxProjection,
  getApprovalCounts,
  getNextPendingApproval
} from '../src/lib/approvals/projection.ts';

import {
  formatWaitingDuration
} from '../src/lib/approvals/formatters.ts';

import {
  ADMIN_UX_PRINCIPLES
} from '../src/lib/approvals/types.ts';

let testCount = 0;
function pass(name) {
  testCount++;
  console.log(`  [PASS ${String(testCount).padStart(2, '0')}] ${name}`);
}

function createTestDatabase() {
  const db = new DatabaseSync(':memory:');

  db.exec(`
    CREATE TABLE articles (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      slug TEXT NOT NULL UNIQUE,
      title TEXT NOT NULL,
      status TEXT DEFAULT 'draft',
      content_hash TEXT,
      content_md TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      published_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE article_editorial_approvals (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      article_id INTEGER NOT NULL REFERENCES articles(id) ON DELETE CASCADE,
      approved_by TEXT NOT NULL,
      approved_role TEXT NOT NULL DEFAULT 'editor_in_chief',
      approval_status TEXT NOT NULL DEFAULT 'APPROVED',
      approved_content_hash TEXT NOT NULL,
      approved_asset_id TEXT NOT NULL,
      notes TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE media_promotion_approvals (
      approval_id TEXT PRIMARY KEY,
      device_id TEXT NOT NULL,
      article_id INTEGER NOT NULL REFERENCES articles(id) ON DELETE CASCADE,
      article_slug TEXT NOT NULL,
      content_hash TEXT NOT NULL,
      candidate_sha256 TEXT NOT NULL,
      slot_key TEXT NOT NULL DEFAULT 'featured',
      alt_text TEXT,
      status TEXT NOT NULL DEFAULT 'REQUESTED',
      requested_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      approved_at DATETIME,
      rejection_reason TEXT
    );

    CREATE TABLE article_publication_readiness (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      article_id INTEGER NOT NULL REFERENCES articles(id) ON DELETE CASCADE,
      is_ready INTEGER NOT NULL DEFAULT 0,
      overall_status TEXT NOT NULL DEFAULT 'NOT_READY',
      content_hash TEXT NOT NULL,
      snapshot_json TEXT NOT NULL,
      evaluated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
  `);

  return {
    raw: db,
    prepare(sql) {
      return {
        _sql: sql,
        _params: [],
        bind(...params) {
          this._params = params;
          return this;
        },
        async first() {
          const stmt = db.prepare(this._sql);
          return stmt.get(...this._params) || null;
        },
        async all() {
          const stmt = db.prepare(this._sql);
          return { results: stmt.all(...this._params) };
        },
        async run() {
          const stmt = db.prepare(this._sql);
          const info = stmt.run(...this._params);
          return {
            meta: {
              changes: info.changes,
              last_row_id: Number(info.lastInsertRowid)
            }
          };
        }
      };
    }
  };
}

function insertReadyArticleDraft(db, { id, slug, title, content_hash = 'h1', updated_at = new Date().toISOString() }) {
  db.raw.prepare(`
    INSERT INTO articles (id, slug, title, status, content_hash, updated_at)
    VALUES (?, ?, ?, 'draft', ?, ?)
  `).run(id, slug, title, content_hash, updated_at);

  db.raw.prepare(`
    INSERT INTO article_publication_readiness (article_id, is_ready, overall_status, content_hash, snapshot_json, evaluated_at)
    VALUES (?, 0, 'READY_FOR_REVIEW', ?, ?, ?)
  `).run(
    id,
    content_hash,
    JSON.stringify({
      has_named_staff_provenance: true,
      staff_gates: {
        irwan: 'PASS',
        joko: 'PASS',
        nadia: 'PASS',
        rina: 'PASS'
      },
      checks: {
        article_integrity: 'PASS',
        editorial_guards: 'PASS',
        evidence_and_citations: 'PASS',
        visual_media: 'PASS',
        audience_voice: 'PASS',
        editorial_qa: 'PASS',
        human_approval: 'FAIL'
      },
      blockers: ['APPROVAL_MISSING']
    }),
    updated_at
  );
}

async function runAllTests() {
  console.log('=============================================================');
  console.log('🧪 RANCANGLOKA — SCALABLE APPROVAL INBOX TEST SUITE');
  console.log('=============================================================\n');

  // -------------------------------------------------------------------------
  // Test 1: Scale Case 0 Pending Approvals
  // -------------------------------------------------------------------------
  console.log('--- Test Suite 1: Scale Case 0 Pending Approvals ---');
  {
    const db = createTestDatabase();
    const result = await getApprovalInboxProjection(db);

    assert.equal(result.pendingCount, 0, 'Pending count must be 0');
    assert.equal(result.totalCount, 0, 'Total count must be 0');
    assert.equal(result.previewItems.length, 0, 'Bell preview items must be empty');
    assert.deepEqual(result.items, [], 'Items array must be empty');

    const counts = await getApprovalCounts(db);
    assert.equal(counts.pendingCount, 0, 'getApprovalCounts pending must be 0');
    pass('0 pending approvals: Calm state, zero counts, empty bell preview');
  }

  // -------------------------------------------------------------------------
  // Test 2: Scale Case 1 Pending Approval
  // -------------------------------------------------------------------------
  console.log('\n--- Test Suite 2: Scale Case 1 Pending Approval ---');
  {
    const db = createTestDatabase();
    const now = new Date('2026-10-13T12:00:00Z').getTime();
    const oneHourAgo = new Date('2026-10-13T11:00:00Z').toISOString();

    insertReadyArticleDraft(db, {
      id: 1,
      slug: 'memilih-sistem-shading-luar',
      title: 'Memilih Sistem Shading Luar Tropis',
      content_hash: 'hash_aaa',
      updated_at: oneHourAgo
    });

    const result = await getApprovalInboxProjection(db, { now });
    assert.equal(result.pendingCount, 1, 'Pending count must be 1');
    assert.equal(result.previewItems.length, 1, 'Bell preview must contain 1 item');
    assert.equal(result.previewItems[0].title, 'Memilih Sistem Shading Luar Tropis');
    assert.equal(result.previewItems[0].detailUrl, '/admin/preview/memilih-sistem-shading-luar');
    assert.equal(result.previewItems[0].waitingAgeFormatted, '1 jam');
    assert.equal(result.previewItems[0].workflowStage, 'Editorial Approval');
    assert.equal(result.previewItems[0].previousGates, 'Irwan ✓ Joko ✓ Nadia ✓ Rina ✓');
    assert.equal(result.previewItems[0].requiredActor, 'Chief Editor');

    pass('1 pending approval: Accurate count, single preview item, canonical metadata');
  }

  // -------------------------------------------------------------------------
  // Test 3: Scale Case 5 Pending Approvals & Oldest-Waiting Ordering
  // -------------------------------------------------------------------------
  console.log('\n--- Test Suite 3: Scale Case 5 Pending Approvals & Starvation Defense ---');
  {
    const db = createTestDatabase();
    const now = new Date('2026-10-13T15:00:00Z').getTime();

    // Insert 3 ready draft articles with different waiting times
    insertReadyArticleDraft(db, { id: 1, slug: 'artikel-1', title: 'Artikel Tertua (3 jam lalu)', content_hash: 'hash_1', updated_at: new Date('2026-10-13T12:00:00Z').toISOString() });
    insertReadyArticleDraft(db, { id: 2, slug: 'artikel-2', title: 'Artikel Tengah (2 jam lalu)', content_hash: 'hash_2', updated_at: new Date('2026-10-13T13:00:00Z').toISOString() });
    insertReadyArticleDraft(db, { id: 3, slug: 'artikel-3', title: 'Artikel Terbaru (10 menit lalu)', content_hash: 'hash_3', updated_at: new Date('2026-10-13T14:50:00Z').toISOString() });

    // Insert 2 media promotion requests
    db.raw.prepare(`
      INSERT INTO media_promotion_approvals (approval_id, device_id, article_id, article_slug, content_hash, candidate_sha256, slot_key, status, requested_at)
      VALUES
        ('media-1', 'dev-budi', 1, 'artikel-1', 'hash_1', 'cand_1', 'featured', 'REQUESTED', ?),
        ('media-2', 'dev-budi', 2, 'artikel-2', 'hash_2', 'cand_2', 'featured', 'REQUESTED', ?)
    `).run(
      new Date('2026-10-13T12:30:00Z').toISOString(), // 2.5 jam lalu
      new Date('2026-10-13T14:00:00Z').toISOString()  // 1 jam lalu
    );

    const result = await getApprovalInboxProjection(db, { now });
    assert.equal(result.pendingCount, 5, 'Pending count must be 5');
    assert.equal(result.previewItems.length, 5, 'Bell preview must contain exactly 5 items');

    // Verify Oldest Waiting First Sort
    const items = result.items;
    assert.equal(items[0].id, 'article:1', 'First item must be oldest article (3 hours waiting)');
    assert.equal(items[1].id, 'media:media-1', 'Second item must be media-1 (2.5 hours waiting)');
    assert.equal(items[2].id, 'article:2', 'Third item must be article-2 (2 hours waiting)');
    assert.equal(items[3].id, 'media:media-2', 'Fourth item must be media-2 (1 hour waiting)');
    assert.equal(items[4].id, 'article:3', 'Fifth item must be article-3 (10 minutes waiting)');

    pass('5 pending approvals: Oldest-waiting ordering guarantees zero request starvation');
  }

  // -------------------------------------------------------------------------
  // Test 4: Scale Case 20 Pending Approvals & Bell Capping
  // -------------------------------------------------------------------------
  console.log('\n--- Test Suite 4: Scale Case 20 Pending Approvals & Bell Capping ---');
  {
    const db = createTestDatabase();
    const now = new Date('2026-10-13T20:00:00Z').getTime();

    // Insert 20 draft articles
    for (let i = 1; i <= 20; i++) {
      const waitHours = 25 - i; // Older items have higher waitHours
      const waitingDate = new Date(now - waitHours * 3600 * 1000).toISOString();
      insertReadyArticleDraft(db, {
        id: i,
        slug: `artikel-${i}`,
        title: `Artikel Uji #${i}`,
        content_hash: `hash_${i}`,
        updated_at: waitingDate
      });
    }

    const result = await getApprovalInboxProjection(db, { now, limit: 15 });

    assert.equal(result.pendingCount, 20, 'Total pending count must be exactly 20');

    // CRITICAL: Bell preview must be strictly capped at 3–5 items (default 5), NOT 20!
    assert.equal(result.previewItems.length, 5, 'Bell preview must be capped at 5 items max');
    assert.equal(result.previewItems[0].title, 'Artikel Uji #1', 'Bell preview starts with oldest');

    // Verify Inbox pagination & bounded rendering
    assert.equal(result.items.length, 15, 'Page limit respected (15 items on page 1)');
    assert.equal(result.pagination.totalPages, 2, 'Total pages must be 2');
    assert.equal(result.pagination.page, 1, 'Current page must be 1');

    // Query Page 2
    const page2 = await getApprovalInboxProjection(db, { now, page: 2, limit: 15 });
    assert.equal(page2.items.length, 5, 'Page 2 must contain remaining 5 items');
    assert.equal(page2.items[0].title, 'Artikel Uji #16');

    pass('20 pending approvals: Scale clean, bell preview strictly capped at 5, pagination working');
  }

  // -------------------------------------------------------------------------
  // Test 5: Single Source of Truth for Bell & Sidebar Count
  // -------------------------------------------------------------------------
  console.log('\n--- Test Suite 5: Single Source of Truth Invariant ---');
  {
    const db = createTestDatabase();

    // Insert 7 articles and 3 media
    for (let i = 1; i <= 7; i++) {
      insertReadyArticleDraft(db, {
        id: i,
        slug: `slug-${i}`,
        title: `Judul ${i}`,
        content_hash: `h_${i}`
      });
    }
    for (let j = 1; j <= 3; j++) {
      db.raw.prepare(`
        INSERT INTO media_promotion_approvals (approval_id, device_id, article_id, article_slug, content_hash, candidate_sha256, slot_key, status)
        VALUES (?, 'dev-budi', ?, ?, 'h_1', 'cand_1', 'featured', 'REQUESTED')
      `).run(`media-${j}`, j, `slug-${j}`);
    }

    const counts = await getApprovalCounts(db);
    const fullProj = await getApprovalInboxProjection(db);

    assert.equal(counts.pendingCount, 10, 'Total pending count must be 10');
    assert.equal(fullProj.pendingCount, counts.pendingCount, 'Inbox projection pendingCount must match getApprovalCounts exactly');
    pass('Single Source of Truth: Header Bell and Sidebar use exact same canonical count');
  }

  // -------------------------------------------------------------------------
  // Test 6: Filtering by Status (Pending First, Revision, Completed)
  // -------------------------------------------------------------------------
  console.log('\n--- Test Suite 6: Filtering by Status ---');
  {
    const db = createTestDatabase();

    // Article 1: Pending (Ready for review)
    insertReadyArticleDraft(db, {
      id: 1,
      slug: 'art-1',
      title: 'Artikel Pending',
      content_hash: 'hash_1'
    });

    // Article 2: Revision Requested
    insertReadyArticleDraft(db, {
      id: 2,
      slug: 'art-2',
      title: 'Artikel Perlu Revisi',
      content_hash: 'hash_2'
    });
    db.raw.prepare(`
      INSERT INTO article_editorial_approvals (article_id, approved_by, approval_status, approved_content_hash, approved_asset_id, notes)
      VALUES (2, 'chief_editor', 'REJECTED', 'hash_2', 'asset_2', 'Perlu penajaman pembuka')
    `).run();

    // Article 3: Approved (Completed)
    insertReadyArticleDraft(db, {
      id: 3,
      slug: 'art-3',
      title: 'Artikel Selesai Disetujui',
      content_hash: 'hash_3'
    });
    db.raw.prepare(`
      INSERT INTO article_editorial_approvals (article_id, approved_by, approval_status, approved_content_hash, approved_asset_id, notes)
      VALUES (3, 'chief_editor', 'APPROVED', 'hash_3', 'asset_3', 'Siap publikasi')
    `).run();

    // 1. Pending view (default landing state)
    const pendingView = await getApprovalInboxProjection(db, { status: 'PENDING' });
    assert.equal(pendingView.items.length, 1);
    assert.equal(pendingView.items[0].id, 'article:1');
    assert.equal(pendingView.pendingCount, 1);
    assert.equal(pendingView.revisionCount, 1);
    assert.equal(pendingView.completedCount, 1);

    // 2. Revision view
    const revisionView = await getApprovalInboxProjection(db, { status: 'REVISION_REQUESTED' });
    assert.equal(revisionView.items.length, 1);
    assert.equal(revisionView.items[0].id, 'article:2');
    assert.equal(revisionView.items[0].status, 'REVISION_REQUESTED');

    // 3. Completed view
    const completedView = await getApprovalInboxProjection(db, { status: 'APPROVED' });
    assert.equal(completedView.items.length, 1);
    assert.equal(completedView.items[0].id, 'article:3');
    assert.equal(completedView.items[0].status, 'APPROVED');

    pass('Status filtering: Correctly isolates Pending, Revision, and Completed records');
  }

  // -------------------------------------------------------------------------
  // Test 7: Filtering by Type & Search Query
  // -------------------------------------------------------------------------
  console.log('\n--- Test Suite 7: Type & Search Filtering ---');
  {
    const db = createTestDatabase();

    insertReadyArticleDraft(db, { id: 1, slug: 'shading-khatulistiwa', title: 'Optimalisasi Shading Khatulistiwa', content_hash: 'h1' });
    insertReadyArticleDraft(db, { id: 2, slug: 'atap-baja-ringan', title: 'Panduan Atap Baja Ringan', content_hash: 'h2' });

    db.raw.prepare(`
      INSERT INTO media_promotion_approvals (approval_id, device_id, article_id, article_slug, content_hash, candidate_sha256, slot_key, status)
      VALUES ('med-1', 'dev-budi', 1, 'shading-khatulistiwa', 'h1', 'cand1', 'featured', 'REQUESTED')
    `).run();

    // Type filter: article only
    const articleOnly = await getApprovalInboxProjection(db, { type: 'article' });
    assert.equal(articleOnly.items.length, 2);
    assert.ok(articleOnly.items.every(i => i.type === 'article'));

    // Type filter: media only
    const mediaOnly = await getApprovalInboxProjection(db, { type: 'media' });
    assert.equal(mediaOnly.items.length, 1);
    assert.equal(mediaOnly.items[0].type, 'media');

    // Search filter
    const searchResult = await getApprovalInboxProjection(db, { search: 'shading' });
    assert.equal(searchResult.items.length, 2); // article 1 and media 1

    const searchAtap = await getApprovalInboxProjection(db, { search: 'atap' });
    assert.equal(searchAtap.items.length, 1);
    assert.equal(searchAtap.items[0].id, 'article:2');

    pass('Type & Search filtering: Accurately filters without cross-contamination');
  }

  // -------------------------------------------------------------------------
  // Test 8: NO BULK APPROVAL Invariant
  // -------------------------------------------------------------------------
  console.log('\n--- Test Suite 8: NO BULK APPROVAL Invariant ---');
  {
    // The projection module exposes zero bulk approval functions
    const mod = await import('../src/lib/approvals/projection.ts');
    assert.equal(typeof mod.bulkApprove, 'undefined', 'bulkApprove must NOT exist');
    assert.equal(typeof mod.approveAll, 'undefined', 'approveAll must NOT exist');
    assert.equal(typeof mod.selectAllAndApprove, 'undefined', 'selectAllAndApprove must NOT exist');

    pass('NO BULK APPROVAL: Enforces deliberate, individual human decision-making');
  }

  // -------------------------------------------------------------------------
  // Test 9: Approval Completion Decrements Pending Queue
  // -------------------------------------------------------------------------
  console.log('\n--- Test Suite 9: Approval Lifecycle & Queue Removal ---');
  {
    const db = createTestDatabase();

    insertReadyArticleDraft(db, { id: 10, slug: 'art-10', title: 'Artikel Baru', content_hash: 'hash_10' });

    const before = await getApprovalCounts(db);
    assert.equal(before.pendingCount, 1);
    assert.equal(before.completedCount, 0);

    // Operator approves article 10
    db.raw.prepare(`
      INSERT INTO article_editorial_approvals (article_id, approved_by, approval_status, approved_content_hash, approved_asset_id, notes)
      VALUES (10, 'chief_editor', 'APPROVED', 'hash_10', 'asset_10', 'Disetujui penuh')
    `).run();

    const after = await getApprovalCounts(db);
    assert.equal(after.pendingCount, 0, 'Pending count decrements to 0');
    assert.equal(after.completedCount, 1, 'Completed count increments to 1');

    const inbox = await getApprovalInboxProjection(db, { status: 'PENDING' });
    assert.equal(inbox.items.length, 0, 'Approved item removed from pending inbox view');

    pass('Approval completion immediately removes item from pending queue');
  }

  // -------------------------------------------------------------------------
  // Test 10: Deterministic Next Pending Navigation (Fast Review Flow)
  // -------------------------------------------------------------------------
  console.log('\n--- Test Suite 10: Deterministic Fast Review Continuation ---');
  {
    const db = createTestDatabase();
    const now = new Date('2026-10-13T10:00:00Z').getTime();

    // Insert 3 ready draft articles
    insertReadyArticleDraft(db, { id: 101, slug: 'art-101', title: 'Artikel Pertama (Tertua)', content_hash: 'h1', updated_at: new Date('2026-10-13T07:00:00Z').toISOString() });
    insertReadyArticleDraft(db, { id: 102, slug: 'art-102', title: 'Artikel Kedua', content_hash: 'h2', updated_at: new Date('2026-10-13T08:00:00Z').toISOString() });
    insertReadyArticleDraft(db, { id: 103, slug: 'art-103', title: 'Artikel Ketiga', content_hash: 'h3', updated_at: new Date('2026-10-13T09:00:00Z').toISOString() });

    // While on Article 101, next pending should be 102
    const nextAfter101 = await getNextPendingApproval(db, 101, 'article', { now });
    assert.ok(nextAfter101);
    assert.equal(nextAfter101.rawId, 102, 'Next after 101 must be 102');

    // While on Article 102, next pending should be 103
    const nextAfter102 = await getNextPendingApproval(db, 102, 'article', { now });
    assert.ok(nextAfter102);
    assert.equal(nextAfter102.rawId, 103, 'Next after 102 must be 103');

    // While on Article 103 (last item), fallback returns alternative (101)
    const nextAfter103 = await getNextPendingApproval(db, 103, 'article', { now });
    assert.ok(nextAfter103);
    assert.equal(nextAfter103.rawId, 101, 'Next after last item wraps to remaining pending item');

    pass('Deterministic Fast Review navigation follows queue order without auto-approval');
  }

  // -------------------------------------------------------------------------
  // Test 11: Human-Readable Age Formatting
  // -------------------------------------------------------------------------
  console.log('\n--- Test Suite 11: Human-Readable Age Formatting ---');
  {
    const now = new Date('2026-10-13T12:00:00Z').getTime();

    // 2 minutes ago -> 'Baru saja'
    assert.equal(formatWaitingDuration(now - 2 * 60 * 1000, now), 'Baru saja');

    // 18 minutes ago -> '18 menit'
    assert.equal(formatWaitingDuration(now - 18 * 60 * 1000, now), '18 menit');

    // 2 hours ago -> '2 jam'
    assert.equal(formatWaitingDuration(now - 2 * 3600 * 1000, now), '2 jam');

    // 1 day ago -> '1 hari'
    assert.equal(formatWaitingDuration(now - 26 * 3600 * 1000, now), '1 hari');

    // 3 days ago -> '3 hari'
    assert.equal(formatWaitingDuration(now - 74 * 3600 * 1000, now), '3 hari');

    pass('Human-readable age formatting conforms to exact editorial specifications');
  }

  // -------------------------------------------------------------------------
  // Test 12: Admin UX Principles Invariant Record
  // -------------------------------------------------------------------------
  console.log('\n--- Test Suite 12: Admin UX Principles ---');
  {
    assert.equal(ADMIN_UX_PRINCIPLES.BELL_ROLE, 'The bell tells the administrator that work exists.');
    assert.equal(ADMIN_UX_PRINCIPLES.INBOX_ROLE, 'The Approval Inbox organizes the work.');
    assert.equal(ADMIN_UX_PRINCIPLES.DETAIL_ROLE, 'The Approval Detail is where the decision happens.');
    assert.equal(
      ADMIN_UX_PRINCIPLES.DELIBERATE_DECISION,
      'Human approval queues may scale; human decisions remain deliberate and individual.'
    );
    assert.equal(
      ADMIN_UX_PRINCIPLES.HUMAN_GATE_NEXT_ACTION,
      'An item appears in the Chief Editor Approval Inbox only when human approval is the next legitimate workflow action.'
    );
    assert.equal(
      ADMIN_UX_PRINCIPLES.TRUTHFUL_STAFF_EVIDENCE,
      'The UI must not claim a named staff member completed a gate unless canonical workflow evidence proves it.'
    );

    pass('Admin UX Principles verified and codified as system invariant');
  }

  // -------------------------------------------------------------------------
  // Test 13: Partial Pipeline States & Canonical Gate Invariants (Cases A - H)
  // -------------------------------------------------------------------------
  console.log('\n--- Test Suite 13: Partial Pipeline States & Canonical Gate Invariants ---');
  {
    const db = createTestDatabase();

    // CASE A: Irwan PASS, Joko PASS, Nadia NOT RUN, Rina NOT RUN -> NOT in approval inbox
    db.raw.prepare(`
      INSERT INTO articles (id, slug, title, status, content_hash, updated_at)
      VALUES (901, 'case-a', 'Case A: Nadia & Rina Not Run', 'draft', 'hash_a', datetime('now'))
    `).run();
    db.raw.prepare(`
      INSERT INTO article_publication_readiness (article_id, is_ready, overall_status, content_hash, snapshot_json, evaluated_at)
      VALUES (901, 0, 'NOT_READY', 'hash_a', ?, datetime('now'))
    `).run(JSON.stringify({
      has_named_staff_provenance: true,
      staff_gates: { irwan: 'PASS', joko: 'PASS' },
      checks: { evidence_and_citations: 'PASS', editorial_guards: 'PASS', human_approval: 'FAIL' },
      blockers: ['NADIA_GATE_PENDING', 'APPROVAL_MISSING']
    }));

    let resA = await getApprovalInboxProjection(db);
    assert.equal(resA.pendingCount, 0, 'Case A: Article must NOT enter approval inbox when Nadia and Rina have not run');

    // CASE B: Irwan PASS, Joko PASS, Nadia PASS, Rina NOT RUN -> NOT in approval inbox
    db.raw.prepare(`
      INSERT INTO articles (id, slug, title, status, content_hash, updated_at)
      VALUES (902, 'case-b', 'Case B: Rina Not Run', 'draft', 'hash_b', datetime('now'))
    `).run();
    db.raw.prepare(`
      INSERT INTO article_publication_readiness (article_id, is_ready, overall_status, content_hash, snapshot_json, evaluated_at)
      VALUES (902, 0, 'NOT_READY', 'hash_b', ?, datetime('now'))
    `).run(JSON.stringify({
      has_named_staff_provenance: true,
      staff_gates: { irwan: 'PASS', joko: 'PASS', nadia: 'PASS' },
      checks: { evidence_and_citations: 'PASS', editorial_guards: 'PASS', audience_voice: 'PASS', human_approval: 'FAIL' },
      blockers: ['RINA_GATE_PENDING', 'APPROVAL_MISSING']
    }));

    let resB = await getApprovalInboxProjection(db);
    assert.equal(resB.pendingCount, 0, 'Case B: Article must NOT enter approval inbox when Rina has not run');

    // CASE C: Irwan PASS, Joko PASS, Nadia PASS, Rina FAIL -> NOT in approval inbox
    db.raw.prepare(`
      INSERT INTO articles (id, slug, title, status, content_hash, updated_at)
      VALUES (903, 'case-c', 'Case C: Rina QA Failed', 'draft', 'hash_c', datetime('now'))
    `).run();
    db.raw.prepare(`
      INSERT INTO article_publication_readiness (article_id, is_ready, overall_status, content_hash, snapshot_json, evaluated_at)
      VALUES (903, 0, 'BLOCKED', 'hash_c', ?, datetime('now'))
    `).run(JSON.stringify({
      has_named_staff_provenance: true,
      staff_gates: { irwan: 'PASS', joko: 'PASS', nadia: 'PASS', rina: 'FAIL' },
      checks: { evidence_and_citations: 'PASS', editorial_guards: 'PASS', audience_voice: 'PASS', editorial_qa: 'FAIL', human_approval: 'FAIL' },
      blockers: ['EDITORIAL_QA_FAILED', 'APPROVAL_MISSING']
    }));

    let resC = await getApprovalInboxProjection(db);
    assert.equal(resC.pendingCount, 0, 'Case C: Article must NOT enter approval inbox when Rina fails');

    // CASE D: All canonical upstream gates PASS, only human approval missing -> PENDING
    insertReadyArticleDraft(db, {
      id: 904,
      slug: 'case-d',
      title: 'Case D: All Upstream Gates Pass',
      content_hash: 'hash_d',
      updated_at: new Date().toISOString()
    });

    let resD = await getApprovalInboxProjection(db);
    assert.equal(resD.pendingCount, 1, 'Case D: Article enters PENDING queue when all upstream gates pass');
    assert.equal(resD.items[0].slug, 'case-d');
    assert.equal(resD.items[0].previousGates, 'Irwan ✓ Joko ✓ Nadia ✓ Rina ✓');
    assert.equal(resD.items[0].status, 'PENDING');

    // CASE E: Previously APPROVED -> NOT PENDING
    db.raw.prepare(`
      INSERT INTO article_editorial_approvals (article_id, approved_by, approval_status, approved_content_hash, approved_asset_id, notes)
      VALUES (904, 'chief_editor', 'APPROVED', 'hash_d', 'asset_d', 'Persetujuan sah')
    `).run();

    let resE = await getApprovalInboxProjection(db, { status: 'PENDING' });
    assert.equal(resE.pendingCount, 0, 'Case E: Previously APPROVED article decrements pending queue to 0');
    let resECompleted = await getApprovalInboxProjection(db, { status: 'APPROVED' });
    assert.equal(resECompleted.items.length, 1, 'Case E: Shows under Selesai filter');

    // CASE F: REVISION_REQUESTED -> NOT PENDING until revision cycle returns to human gate
    insertReadyArticleDraft(db, {
      id: 905,
      slug: 'case-f',
      title: 'Case F: Revision Requested',
      content_hash: 'hash_f',
      updated_at: new Date().toISOString()
    });
    db.raw.prepare(`
      INSERT INTO article_editorial_approvals (article_id, approved_by, approval_status, approved_content_hash, approved_asset_id, notes)
      VALUES (905, 'chief_editor', 'REJECTED', 'hash_f', 'asset_f', 'Perbaiki diksi bagian 3')
    `).run();

    let resF = await getApprovalInboxProjection(db, { status: 'PENDING' });
    assert.equal(resF.pendingCount, 0, 'Case F: REVISION_REQUESTED does NOT enter pending queue');
    let resFRevision = await getApprovalInboxProjection(db, { status: 'REVISION_REQUESTED' });
    assert.equal(resFRevision.items.length, 1, 'Case F: Appears under Minta Revisi queue');

    // CASE G: Raw draft with content_md + basic contract/citation pass -> NOT PENDING
    db.raw.prepare(`
      INSERT INTO articles (id, slug, title, status, content_hash, content_md, updated_at)
      VALUES (906, 'case-g', 'Case G: Raw Draft Basic Contract', 'draft', 'hash_g', '# Judul Draft\n\nIsi naskah biasa tanpa evaluasi gate.', datetime('now'))
    `).run();

    let resG = await getApprovalInboxProjection(db, { status: 'PENDING' });
    assert.equal(resG.pendingCount, 0, 'Case G: Raw draft with content_md and no gate proof must NOT enter pending queue');

    // CASE H: Historical approval record exists but current workflow no longer awaits human approval
    // (e.g. content hash changed but new content has not passed upstream gates)
    db.raw.prepare(`
      INSERT INTO articles (id, slug, title, status, content_hash, updated_at)
      VALUES (907, 'case-h', 'Case H: Historical Approval Old Hash', 'draft', 'new_unverified_hash', datetime('now'))
    `).run();
    db.raw.prepare(`
      INSERT INTO article_editorial_approvals (article_id, approved_by, approval_status, approved_content_hash, approved_asset_id, notes)
      VALUES (907, 'chief_editor', 'APPROVED', 'old_past_hash', 'asset_h', 'Old approval')
    `).run();

    let resH = await getApprovalInboxProjection(db, { status: 'PENDING' });
    assert.equal(resH.pendingCount, 0, 'Case H: Historical approval record with new unverified content must NOT enter pending queue');

    // BONUS: Truthful Generic Labels when named staff provenance is not explicitly recorded
    db.raw.prepare(`
      INSERT INTO articles (id, slug, title, status, content_hash, updated_at)
      VALUES (908, 'generic-gate', 'Generic Gate Proof', 'draft', 'hash_gen', datetime('now'))
    `).run();
    db.raw.prepare(`
      INSERT INTO article_publication_readiness (article_id, is_ready, overall_status, content_hash, snapshot_json, evaluated_at)
      VALUES (908, 0, 'READY_FOR_REVIEW', 'hash_gen', ?, datetime('now'))
    `).run(JSON.stringify({
      has_named_staff_provenance: false,
      checks: {
        evidence_and_citations: 'PASS',
        editorial_guards: 'PASS',
        audience_voice: 'PASS',
        article_integrity: 'PASS',
        editorial_qa: 'PASS',
        visual_media: 'PASS',
        human_approval: 'FAIL'
      },
      blockers: ['APPROVAL_MISSING']
    }));

    let resGen = await getApprovalInboxProjection(db, { status: 'PENDING' });
    assert.equal(resGen.pendingCount, 1, 'Generic gates article enters pending queue');
    assert.equal(resGen.items[0].previousGates, 'Evidence ✓ Authoring ✓ Reader Voice ✓ Editorial QA ✓', 'Uses truthful generic labels when staff is not named');

    pass('Partial pipeline cases A through H and truthful gate provenance verified 100%');
  }

  // -------------------------------------------------------------------------
  // Test 14: Rina / Final Editorial QA Explicit Gate Reachability (R1 - R6)
  // -------------------------------------------------------------------------
  console.log('\n--- Test Suite 14: Rina / Final Editorial QA Explicit Gate Reachability ---');
  {
    const db = createTestDatabase();

    // R1: article_integrity = PASS, visual_media = PASS, editorial_qa = undefined -> NOT PENDING
    db.raw.prepare(`
      INSERT INTO articles (id, slug, title, status, content_hash, updated_at)
      VALUES (801, 'case-r1', 'Case R1: editorial_qa is undefined', 'draft', 'hash_r1', datetime('now'))
    `).run();
    db.raw.prepare(`
      INSERT INTO article_publication_readiness (article_id, is_ready, overall_status, content_hash, snapshot_json, evaluated_at)
      VALUES (801, 0, 'NOT_READY', 'hash_r1', ?, datetime('now'))
    `).run(JSON.stringify({
      has_named_staff_provenance: false,
      checks: {
        evidence_and_citations: 'PASS',
        editorial_guards: 'PASS',
        audience_voice: 'PASS',
        article_integrity: 'PASS',
        visual_media: 'PASS',
        human_approval: 'FAIL'
      },
      blockers: ['APPROVAL_MISSING']
    }));

    let resR1 = await getApprovalInboxProjection(db, { status: 'PENDING' });
    assert.equal(resR1.pendingCount, 0, 'R1: editorial_qa undefined must NOT enter pending queue');

    // R2: article_integrity = PASS, visual_media = PASS, editorial_qa = NOT_RUN -> NOT PENDING
    db.raw.prepare(`
      INSERT INTO articles (id, slug, title, status, content_hash, updated_at)
      VALUES (802, 'case-r2', 'Case R2: editorial_qa is NOT_RUN', 'draft', 'hash_r2', datetime('now'))
    `).run();
    db.raw.prepare(`
      INSERT INTO article_publication_readiness (article_id, is_ready, overall_status, content_hash, snapshot_json, evaluated_at)
      VALUES (802, 0, 'NOT_READY', 'hash_r2', ?, datetime('now'))
    `).run(JSON.stringify({
      has_named_staff_provenance: false,
      checks: {
        evidence_and_citations: 'PASS',
        editorial_guards: 'PASS',
        audience_voice: 'PASS',
        article_integrity: 'PASS',
        visual_media: 'PASS',
        editorial_qa: 'NOT_RUN',
        human_approval: 'FAIL'
      },
      blockers: ['APPROVAL_MISSING']
    }));

    let resR2 = await getApprovalInboxProjection(db, { status: 'PENDING' });
    assert.equal(resR2.pendingCount, 0, 'R2: editorial_qa NOT_RUN must NOT enter pending queue');

    // R3: article_integrity = PASS, visual_media = PASS, editorial_qa = PENDING -> NOT PENDING
    db.raw.prepare(`
      INSERT INTO articles (id, slug, title, status, content_hash, updated_at)
      VALUES (803, 'case-r3', 'Case R3: editorial_qa is PENDING', 'draft', 'hash_r3', datetime('now'))
    `).run();
    db.raw.prepare(`
      INSERT INTO article_publication_readiness (article_id, is_ready, overall_status, content_hash, snapshot_json, evaluated_at)
      VALUES (803, 0, 'NOT_READY', 'hash_r3', ?, datetime('now'))
    `).run(JSON.stringify({
      has_named_staff_provenance: false,
      checks: {
        evidence_and_citations: 'PASS',
        editorial_guards: 'PASS',
        audience_voice: 'PASS',
        article_integrity: 'PASS',
        visual_media: 'PASS',
        editorial_qa: 'PENDING',
        human_approval: 'FAIL'
      },
      blockers: ['APPROVAL_MISSING']
    }));

    let resR3 = await getApprovalInboxProjection(db, { status: 'PENDING' });
    assert.equal(resR3.pendingCount, 0, 'R3: editorial_qa PENDING must NOT enter pending queue');

    // R4: article_integrity = PASS, visual_media = PASS, editorial_qa = FAIL -> NOT PENDING
    db.raw.prepare(`
      INSERT INTO articles (id, slug, title, status, content_hash, updated_at)
      VALUES (804, 'case-r4', 'Case R4: editorial_qa is FAIL', 'draft', 'hash_r4', datetime('now'))
    `).run();
    db.raw.prepare(`
      INSERT INTO article_publication_readiness (article_id, is_ready, overall_status, content_hash, snapshot_json, evaluated_at)
      VALUES (804, 0, 'BLOCKED', 'hash_r4', ?, datetime('now'))
    `).run(JSON.stringify({
      has_named_staff_provenance: false,
      checks: {
        evidence_and_citations: 'PASS',
        editorial_guards: 'PASS',
        audience_voice: 'PASS',
        article_integrity: 'PASS',
        visual_media: 'PASS',
        editorial_qa: 'FAIL',
        human_approval: 'FAIL'
      },
      blockers: ['EDITORIAL_QA_FAILED', 'APPROVAL_MISSING']
    }));

    let resR4 = await getApprovalInboxProjection(db, { status: 'PENDING' });
    assert.equal(resR4.pendingCount, 0, 'R4: editorial_qa FAIL must NOT enter pending queue');

    // R5: article_integrity = PASS, visual_media = PASS, editorial_qa = PASS, all other gates PASS -> PENDING
    db.raw.prepare(`
      INSERT INTO articles (id, slug, title, status, content_hash, updated_at)
      VALUES (805, 'case-r5', 'Case R5: editorial_qa is PASS', 'draft', 'hash_r5', datetime('now'))
    `).run();
    db.raw.prepare(`
      INSERT INTO article_publication_readiness (article_id, is_ready, overall_status, content_hash, snapshot_json, evaluated_at)
      VALUES (805, 0, 'READY_FOR_REVIEW', 'hash_r5', ?, datetime('now'))
    `).run(JSON.stringify({
      has_named_staff_provenance: false,
      checks: {
        evidence_and_citations: 'PASS',
        editorial_guards: 'PASS',
        audience_voice: 'PASS',
        article_integrity: 'PASS',
        visual_media: 'PASS',
        editorial_qa: 'PASS',
        human_approval: 'FAIL'
      },
      blockers: ['APPROVAL_MISSING']
    }));

    let resR5 = await getApprovalInboxProjection(db, { status: 'PENDING' });
    assert.equal(resR5.pendingCount, 1, 'R5: Explicit editorial_qa PASS enters pending queue');
    assert.equal(resR5.items[0].slug, 'case-r5');
    assert.equal(resR5.items[0].previousGates, 'Evidence ✓ Authoring ✓ Reader Voice ✓ Editorial QA ✓', 'Shows generic Editorial QA ✓ when staff is not named');

    // R6: staff_gates.rina = PASS with canonical named staff provenance -> Rina shown as named PASS
    db.raw.prepare(`
      INSERT INTO articles (id, slug, title, status, content_hash, updated_at)
      VALUES (806, 'case-r6', 'Case R6: staff_gates.rina is PASS', 'draft', 'hash_r6', datetime('now'))
    `).run();
    db.raw.prepare(`
      INSERT INTO article_publication_readiness (article_id, is_ready, overall_status, content_hash, snapshot_json, evaluated_at)
      VALUES (806, 0, 'READY_FOR_REVIEW', 'hash_r6', ?, datetime('now'))
    `).run(JSON.stringify({
      has_named_staff_provenance: true,
      staff_gates: {
        irwan: 'PASS',
        joko: 'PASS',
        nadia: 'PASS',
        rina: 'PASS'
      },
      checks: {
        evidence_and_citations: 'PASS',
        editorial_guards: 'PASS',
        audience_voice: 'PASS',
        article_integrity: 'PASS',
        visual_media: 'PASS',
        editorial_qa: 'PASS',
        human_approval: 'FAIL'
      },
      blockers: ['APPROVAL_MISSING']
    }));

    let resR6 = await getApprovalInboxProjection(db, { status: 'PENDING' });
    assert.equal(resR6.pendingCount, 2, 'R6: Named staff rina PASS increments pending count');
    const itemR6 = resR6.items.find(i => i.slug === 'case-r6');
    assert.ok(itemR6);
    assert.equal(itemR6.previousGates, 'Irwan ✓ Joko ✓ Nadia ✓ Rina ✓', 'Shows named Rina ✓ when staff provenance is proven');

    pass('Rina / Final Editorial QA Explicit Gate Reachability R1 through R6 verified 100%');
  }

  console.log('\n=============================================================');
  console.log(`✅ ALL ${testCount} SCALABLE APPROVAL INBOX TESTS PASSED!`);
  console.log('=============================================================');
}

runAllTests().catch((err) => {
  console.error('\n❌ TEST RUN FAILED:', err);
  process.exit(1);
});
