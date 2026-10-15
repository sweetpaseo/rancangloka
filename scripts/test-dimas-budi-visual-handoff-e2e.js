/**
 * RancangLoka Hermes Editorial Test Suite: Dimas -> Budi E2E Visual Handoff
 * Milestone: RANCANGLOKA_PREMIUM_EDITORIAL_DEPTH_1 (Visual Storytelling Dispatch Bridge)
 *
 * Proves 12 Canonical Invariants:
 * 1. Joko/draft context exists
 * 2. Premium Depth emits REQUIRED
 * 3. Visual brief generator is invoked automatically with complete contract preservation
 * 4. Canonical Budi work item is created in media_jobs (role=inline, status=QUEUED, required_for_readiness=1)
 * 5. Repeated same evaluation produces NO duplicate (Strict Idempotency)
 * 6. Mission Control sees Budi as owner (waiting_media stage & media subsystem)
 * 7. Task handoff resolves to lokamedia_worker_primary in media department
 * 8. Pixel Office / staff state reflects actual work without decorative fabrication
 * 9. Budi cannot publish (BUDI_PUBLISHING_AUTHORITY = 0)
 * 10. Nadia/Rina/Human Approval remain downstream gates (Zero bypass)
 * 11. OPTIONAL creates no automatic task
 * 12. NOT_REQUIRED creates no task
 * 13. Publication readiness genuinely blocked by REQUIRED visual
 * 14. Article C integrity preserved (SHA-256 untouched, no retrofit)
 */

import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { DatabaseSync } from 'node:sqlite';

import {
  evaluatePremiumEditorialDepth,
  INVARIANT_VISUAL_STORYTELLING
} from '../src/lib/editorial/premium-editorial-depth-guard.ts';

import {
  INVARIANT_BUDI_VISUAL_STORYTELLING_OWNER,
  INVARIANT_ZERO_DECORATION_QUOTAS,
  INVARIANT_VISUAL_EDITORIAL_REVIEW_LOOP,
  INVARIANT_EDITORIAL_MEDIA_DISPATCH_BRIDGE,
  BUDI_PUBLISHING_AUTHORITY,
  generateEditorialVisualBriefs,
  dispatchEditorialVisualBriefs,
  evaluateAndDispatchEditorialVisuals,
  formatVisualBriefToPrompt,
  extractVisualBriefFromMediaJob,
  deriveSlotKeyForBrief,
  validateEditorialVisualReviewFlow,
  canBudiPublish,
  canBudiOverrideReviewers
} from '../src/lib/editorial/visual-brief.ts';

import {
  getPipelineBoard
} from '../src/lib/mission-control/tasks.ts';

import {
  attributeTaskOwnership
} from '../src/lib/mission-control/department-registry.ts';

import {
  deriveStaffCurrentTask,
  getStaffDefinitionByAgentId
} from '../src/lib/mission-control/staff-registry.ts';

import {
  deriveCanonicalHandoffsFromPipeline
} from '../src/lib/mission-control/task-handoff.ts';

import {
  evaluateArticleMediaReadiness
} from '../src/lib/media/readiness-reconciler.ts';

// Helper to create an in-memory SQLite D1 mock
function createMockD1() {
  const sqlite = new DatabaseSync(':memory:');

  const schemaSql = fs.readFileSync(path.resolve(process.cwd(), 'db/schema.sql'), 'utf-8');
  sqlite.exec(schemaSql);

  const migrations = [
    '0001_category_taxonomy_expansion.sql',
    '0002_article_ingest_receipts.sql',
    '0006_media_jobs_queue.sql',
    '0007_publication_readiness_and_approvals.sql',
    '0008_publication_planner.sql',
    '0009_publication_publisher.sql',
    '0010_publication_feedback.sql',
    '0011_automation_safety.sql',
    '0013_lokamedia_durable_jobs.sql',
    '0019_publication_cron_observability.sql',
    '0020_automation_control_audit.sql',
    '0021_decision_observations.sql'
  ];

  for (const mig of migrations) {
    const p = path.resolve(process.cwd(), 'db/migrations', mig);
    if (fs.existsSync(p)) {
      const sql = fs.readFileSync(p, 'utf-8');
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
          this._params = args.map((v) => (v === undefined ? null : v));
          return this;
        },
        async first() {
          const stmt = sqlite.prepare(this._sql);
          return stmt.get(...this._params) || null;
        },
        async all() {
          const stmt = sqlite.prepare(this._sql);
          const results = stmt.all(...this._params);
          return { results };
        },
        async run() {
          const stmt = sqlite.prepare(this._sql);
          return stmt.run(...this._params);
        }
      };
    }
  };
}

console.log('================================================================');
console.log('🧪 Starting DIMAS -> BUDI E2E VISUAL HANDOFF TEST SUITE...');
console.log('================================================================\n');

let passed = 0;

// --------------------------------------------------------------------------
// Test 1: Invariant Constants Verification
// --------------------------------------------------------------------------
console.log('Test 1: Master Invariants');
assert.equal(INVARIANT_EDITORIAL_MEDIA_DISPATCH_BRIDGE, 'EDITORIAL_MEDIA_DISPATCH_BRIDGE');
assert.equal(INVARIANT_BUDI_VISUAL_STORYTELLING_OWNER, 'BUDI_VISUAL_STORYTELLING_OWNER');
assert.equal(INVARIANT_ZERO_DECORATION_QUOTAS, 'ZERO_DECORATION_QUOTAS');
assert.equal(INVARIANT_VISUAL_EDITORIAL_REVIEW_LOOP, 'VISUAL_EDITORIAL_REVIEW_LOOP');
assert.equal(INVARIANT_VISUAL_STORYTELLING, 'VISUAL_STORYTELLING');
assert.equal(BUDI_PUBLISHING_AUTHORITY, 0);
assert.equal(canBudiPublish(), false);
assert.equal(canBudiOverrideReviewers(), false);
console.log('  ✅ PASS: Master invariant constants & Budi authority = 0 verified.\n');
passed++;

// --------------------------------------------------------------------------
// Test 2: Synthetic Comparison Article Draft Triggers visual_storytelling_need = REQUIRED
// --------------------------------------------------------------------------
console.log('Test 2: Synthetic Draft Triggers visual_storytelling_need = REQUIRED');
const syntheticComparisonDraft = `
# Komparasi Louver Aluminium vs Overhang Beton untuk Kamar Hadap Barat

Bagi pemilik rumah dengan bukaan kamar tidur lantai dua yang menghadap tepat ke barat, panas sore tropis sering kali menembus jauh ke dalam ruangan. Sudut datang sinar matahari sore berada pada kemiringan rendah (20 hingga 40 derajat terhadap garis horizon), sehingga naungan atap datar horizontal tidak mampu memotong berkas radiasi termal secara efektif.

Dalam arsitektur tropis lembap, pemilik rumah biasanya mempertimbangkan dua alternatif utama: memasang kisi-kisi louver aluminium ekstrusi di luar jendela atau memperpanjang bidang overhang beton dari pelat atap.

## Perbandingan Mekanisme dan Sudut Matahari

Overhang horizontal efektif untuk orientasi utara-selatan di mana lintasan matahari berada tinggi di atas kepala. Namun untuk orientasi barat, kisi-kisi louver vertikal jauh lebih unggul karena dapat membiaskan sinar matahari miring sebelum menyentuh bidang kaca.

Tabel komparasi berikut merangkum perbedaan parameter teknis kedua sistem:
- Louver Aluminium: Fleksibilitas sudut tinggi, bobot struktur ringan, namun membutuhkan pembersihan berkala dari debu perkotaan dan tempias hujan.
- Overhang Beton: Struktur permanen, durabilitas sangat tinggi, namun tidak dapat diatur sudut naungannya dan membebani balok lantai atas.

## Titik Rawan dan Kegagalan Lapangan

Banyak kegagalan naungan louver terjadi pada engsel atau sambungan sekrup yang mengalami korosi akibat kelembapan tinggi dan tempias air hujan saat musim basah. Sambungan yang longgar menimbulkan bunyi berisik saat angin kencang.

## Langkah Pemeriksaan Berikutnya

Sebelum memesan fabrikasi, periksa orientasi kompas bukaan kamar tidur Anda dan amati jatuhnya bayangan matahari antara pukul 14.30 hingga 16.30 guna memastikan sudut kemiringan sirip louver yang dibutuhkan.
`.trim();

const depthCheck = evaluatePremiumEditorialDepth(syntheticComparisonDraft, {
  contentFamily: 'comparison',
  title: 'Komparasi Louver Aluminium vs Overhang Beton'
});

assert.equal(depthCheck.visual_storytelling_need, 'REQUIRED', 'Comparison + solar angles + failure modes must trigger REQUIRED visual need');
assert.ok(depthCheck.recommended_visual_classes.includes('DECISION_MATRIX') || depthCheck.recommended_visual_classes.includes('COMPARATIVE_VISUAL'));
console.log('  ✅ PASS: Dimas detects complex spatial & comparative problem -> visual_storytelling_need = REQUIRED.\n');
passed++;

// --------------------------------------------------------------------------
// Test 3: Structured Visual Briefs Automatically Generated with Canonical Contract Preservation
// --------------------------------------------------------------------------
console.log('Test 3: Structured Visual Brief Generation & Payload Preservation');
const briefs = generateEditorialVisualBriefs({
  article_slug: 'komparasi-louver-vs-overhang',
  content: syntheticComparisonDraft,
  title: 'Komparasi Louver Aluminium vs Overhang Beton',
  checklist: depthCheck,
  evidenceReferences: ['SNI 6389:2020', 'BMKG Tropical Solar Geometry']
});

assert.ok(briefs.length >= 1, 'At least 1 visual brief must be generated for REQUIRED need');
const firstBrief = briefs[0];

assert.equal(firstBrief.assigned_operator, 'lokamedia_worker_primary');
assert.equal(firstBrief.visual_truth_label, 'EDITORIAL_CONCEPT_VISUAL');
assert.equal(firstBrief.requires_editorial_qa, true);
assert.equal(firstBrief.requires_human_approval, true);
assert.ok(firstBrief.reader_problem.length > 10);
assert.ok(firstBrief.visual_goal.length > 10);
assert.ok(firstBrief.technical_truth_to_preserve.length > 10);
assert.ok(firstBrief.misrepresentation_risks.length > 0);
assert.ok(firstBrief.alt_text_intent.length > 10);

// Verify format and extraction losslessness
const formattedPrompt = formatVisualBriefToPrompt(firstBrief);
assert.ok(formattedPrompt.includes('[EDITORIAL_VISUAL_BRIEF:'));
assert.ok(formattedPrompt.includes('--- BRIEF_PAYLOAD_JSON ---'));

const recoveredBrief = extractVisualBriefFromMediaJob({ prompt: formattedPrompt });
assert.ok(recoveredBrief, 'Brief must be recovered losslessly from prompt');
assert.equal(recoveredBrief.brief_id, firstBrief.brief_id);
assert.equal(recoveredBrief.visual_class, firstBrief.visual_class);
assert.equal(recoveredBrief.assigned_operator, 'lokamedia_worker_primary');
assert.equal(recoveredBrief.visual_truth_label, 'EDITORIAL_CONCEPT_VISUAL');
assert.equal(recoveredBrief.alt_text_intent, firstBrief.alt_text_intent);
console.log('  ✅ PASS: Structured visual brief generated and verified for lossless extraction.\n');
passed++;

// --------------------------------------------------------------------------
// Test 4: Canonical Budi Work Item Created in media_jobs (status=QUEUED, required_for_readiness=1)
// --------------------------------------------------------------------------
console.log('Test 4: Dispatch to Canonical media_jobs');
const db = createMockD1();

// Insert synthetic article in draft state
db.raw.exec(`
  INSERT INTO articles (
    id, slug, title, status, content_md, content_html, content_hash,
    category_id, author_id, views, reading_time_minutes, is_featured, is_trending,
    published_at, updated_at
  ) VALUES (
    401, 'komparasi-louver-vs-overhang', 'Komparasi Louver Aluminium vs Overhang Beton',
    'draft', '# Draft', '<p>Draft</p>', 'hash_draft_401',
    1, 1, 0, 6, 0, 0,
    datetime('now'), datetime('now')
  );
`);

const dispatchResult = await dispatchEditorialVisualBriefs(db, {
  articleId: 401,
  articleSlug: 'komparasi-louver-vs-overhang',
  articleTitle: 'Komparasi Louver Aluminium vs Overhang Beton',
  briefs
});

assert.equal(dispatchResult.article_id, 401);
assert.equal(dispatchResult.dispatched_jobs.length, briefs.length);
assert.equal(dispatchResult.idempotent_noops, 0);

const mediaJobRow = await db.prepare('SELECT * FROM media_jobs WHERE article_id = 401').first();
assert.ok(mediaJobRow, 'media_jobs row must exist for article 401');
assert.equal(mediaJobRow.role, 'inline');
assert.equal(mediaJobRow.status, 'QUEUED');
assert.equal(mediaJobRow.required_for_readiness, 1, 'REQUIRED visual must have required_for_readiness = 1');
assert.equal(mediaJobRow.media_type, 'image');
assert.ok(mediaJobRow.slot_key.startsWith('inline_'));
assert.ok(mediaJobRow.prompt.includes('--- BRIEF_PAYLOAD_JSON ---'));
assert.equal(mediaJobRow.alt_text, firstBrief.alt_text_intent);
console.log('  ✅ PASS: Canonical work item created for Budi (role=inline, status=QUEUED, required_for_readiness=1).\n');
passed++;

// --------------------------------------------------------------------------
// Test 5: Idempotency Verification (Repeated Evaluation Produces 0 Duplicates)
// --------------------------------------------------------------------------
console.log('Test 5: Strict Idempotency Verification');
const repeatDispatch = await dispatchEditorialVisualBriefs(db, {
  articleId: 401,
  articleSlug: 'komparasi-louver-vs-overhang',
  articleTitle: 'Komparasi Louver Aluminium vs Overhang Beton',
  briefs
});

assert.equal(repeatDispatch.dispatched_jobs.length, 0, 'Must dispatch 0 new jobs on repeated run');
assert.equal(repeatDispatch.existing_jobs.length, briefs.length, 'All existing jobs must be recognized');
assert.equal(repeatDispatch.idempotent_noops, briefs.length, 'Every slot must be recognized as idempotent NO-OP');

const { results: allJobs } = await db.prepare('SELECT job_id FROM media_jobs WHERE article_id = 401').all();
assert.equal(allJobs.length, briefs.length, 'Total job count in DB must remain exactly briefs.length (zero duplicates)');
console.log('  ✅ PASS: Repeated evaluation produces zero duplicates; idempotency strictly enforced.\n');
passed++;

// --------------------------------------------------------------------------
// Test 6: Mission Control Sees Budi as Owner & Task Stage = waiting_media
// --------------------------------------------------------------------------
console.log('Test 6: Mission Control Visibility & Ownership Attribution');
const board = await getPipelineBoard(db);
assert.ok(board.totalActiveTasks >= 1);
assert.equal(board.stageCounts.waiting_media, briefs.length, 'Stage count for waiting_media must match total briefs');

const articleCard = board.tasks.find((t) => t.relatedArticleId === 401);
assert.ok(articleCard, 'Task card for article 401 must exist');
assert.equal(articleCard.stage, 'waiting_media', 'Task stage must be waiting_media');
assert.equal(articleCard.relatedMediaJobId, mediaJobRow.job_id);

const ownership = attributeTaskOwnership(articleCard);
assert.equal(ownership.department_id, 'media');
assert.equal(ownership.responsible_agent_id, 'lokamedia_worker_primary');
assert.equal(getStaffDefinitionByAgentId(ownership.responsible_agent_id)?.display_name, 'Budi');
console.log('  ✅ PASS: Mission Control attributes task to Budi (lokamedia_worker_primary / Media Operations).\n');
passed++;

// --------------------------------------------------------------------------
// Test 7: Task Handoff Resolves to lokamedia_worker_primary
// --------------------------------------------------------------------------
console.log('Test 7: Task Handoff Derivation');
const mockSnapshot = {
  pipeline: board,
  health: {
    mediaWorker: {
      effectiveState: 'ENABLED'
    }
  }
};

const handoffs = deriveCanonicalHandoffsFromPipeline(mockSnapshot);
const budiHandoff = handoffs.find((h) => h.to_agent_id === 'lokamedia_worker_primary');
assert.ok(budiHandoff, 'Handoff to lokamedia_worker_primary must be derived');
assert.equal(budiHandoff.from_agent_id, 'content_writer_primary');
assert.equal(budiHandoff.from_department_id, 'editorial');
assert.equal(budiHandoff.to_department_id, 'media');
assert.equal(budiHandoff.from_stage, 'writing');
assert.equal(budiHandoff.to_stage, 'waiting_media');
assert.equal(budiHandoff.evidence_source, 'd1_media_jobs:relatedMediaJobId');
assert.equal(budiHandoff.evidence_id, mediaJobRow.job_id);
console.log('  ✅ PASS: Canonical handoff cleanly derived: Joko (writing) -> Budi (waiting_media).\n');
passed++;

// --------------------------------------------------------------------------
// Test 8: Pixel Office / Staff State Truth (Real Task Truth vs Zero Fake Activity)
// --------------------------------------------------------------------------
console.log('Test 8: Pixel Office Staff State Truth');
const snapshotWithBoard = {
  pipeline: board,
  health: {
    mediaWorker: {
      effectiveState: 'ENABLED'
    }
  }
};

const budiTask = deriveStaffCurrentTask('lokamedia_worker_primary', snapshotWithBoard);
assert.ok(budiTask, 'Budi must have an active current task derived from real media job');
assert.equal(budiTask.current_task_id, articleCard.taskId);
assert.equal(budiTask.current_task_title, articleCard.title);

// Clean DB with zero tasks yields strictly null (zero fake activity)
const emptySnapshot = {
  pipeline: { tasks: [] },
  health: { mediaWorker: { effectiveState: 'ENABLED' } }
};
const budiEmptyTask = deriveStaffCurrentTask('lokamedia_worker_primary', emptySnapshot);
assert.equal(budiEmptyTask, null, 'When no media task exists, Budi current_task must be strictly null (zero fake decorative activity)');
console.log('  ✅ PASS: Pixel Office / Staff registry reflects real task truth and zero fake activity.\n');
passed++;

// --------------------------------------------------------------------------
// Test 9: Budi Publishing Authority = 0 & Direct Publish Prevention
// --------------------------------------------------------------------------
console.log('Test 9: Budi Authority Prohibition');
assert.equal(BUDI_PUBLISHING_AUTHORITY, 0);
assert.equal(canBudiPublish(), false);

const illegalBudiPublish = validateEditorialVisualReviewFlow({
  from_stage: 'BUDI_PREP',
  to_stage: 'PUBLICATION_DISPATCH',
  acting_agent_id: 'lokamedia_worker_primary'
});
assert.equal(illegalBudiPublish.allowed, false);
assert.ok(illegalBudiPublish.reason.includes('otoritas publikasi = 0') || illegalBudiPublish.reason.includes('Bypass editorial'));
console.log('  ✅ PASS: Budi publishing authority = 0 and direct publish strictly prevented.\n');
passed++;

// --------------------------------------------------------------------------
// Test 10: Downstream Editorial Review Chain (Nadia -> Rina -> Human Approval -> Sari)
// --------------------------------------------------------------------------
console.log('Test 10: Downstream Editorial Review Gates');
// 1. Budi prep -> Nadia review
const step1 = validateEditorialVisualReviewFlow({
  from_stage: 'BUDI_PREP',
  to_stage: 'NADIA_REVIEW',
  acting_agent_id: 'lokamedia_worker_primary'
});
assert.equal(step1.allowed, true);

// 2. Skipping Nadia to Rina is BLOCKED
const skipNadia = validateEditorialVisualReviewFlow({
  from_stage: 'NADIA_REVIEW',
  to_stage: 'RINA_REVIEW',
  acting_agent_id: 'editorial_qa_primary',
  has_nadia_approval: false
});
assert.equal(skipNadia.allowed, false);
assert.ok(skipNadia.reason.includes('Nadia'));

// 3. Nadia approval -> Rina review
const step2 = validateEditorialVisualReviewFlow({
  from_stage: 'NADIA_REVIEW',
  to_stage: 'RINA_REVIEW',
  acting_agent_id: 'editorial_qa_primary',
  has_nadia_approval: true
});
assert.equal(step2.allowed, true);

// 4. Skipping Rina to Human Approval is BLOCKED
const skipRina = validateEditorialVisualReviewFlow({
  from_stage: 'RINA_REVIEW',
  to_stage: 'HUMAN_APPROVAL',
  acting_agent_id: 'editorial_qa_primary',
  has_rina_approval: false
});
assert.equal(skipRina.allowed, false);
assert.ok(skipRina.reason.includes('Rina'));

// 5. Rina approval -> Human Approval
const step3 = validateEditorialVisualReviewFlow({
  from_stage: 'RINA_REVIEW',
  to_stage: 'HUMAN_APPROVAL',
  acting_agent_id: 'editorial_qa_primary',
  has_rina_approval: true
});
assert.equal(step3.allowed, true);

// 6. Skipping Human Approval to Publication Dispatch is BLOCKED
const skipHuman = validateEditorialVisualReviewFlow({
  from_stage: 'HUMAN_APPROVAL',
  to_stage: 'PUBLICATION_DISPATCH',
  acting_agent_id: 'publication_dispatcher_core',
  has_human_approval: false
});
assert.equal(skipHuman.allowed, false);
assert.ok(skipHuman.reason.includes('Chief Editor Human Approval'));

// 7. Human Approval -> Sari Publication Dispatch
const step4 = validateEditorialVisualReviewFlow({
  from_stage: 'HUMAN_APPROVAL',
  to_stage: 'PUBLICATION_DISPATCH',
  acting_agent_id: 'publication_dispatcher_core',
  has_human_approval: true
});
assert.equal(step4.allowed, true);
console.log('  ✅ PASS: Linear editorial review chain verified with zero shortcuts.\n');
passed++;

// --------------------------------------------------------------------------
// Test 11: OPTIONAL Visual Need Does NOT Automatically Dispatch Work
// --------------------------------------------------------------------------
console.log('Test 11: OPTIONAL Visual Need Does NOT Automatically Dispatch');
const optionalDraft = `
# Memilih Warna Cat Tembok Ruang Tamu

Warna cat putih hangat sering kali menjadi pilihan aman untuk ruang tamu minimalis. Warna ini memberikan kesan luas dan bersih tanpa membutuhkan perawatan yang rumit.
`.trim();

const optResult = await evaluateAndDispatchEditorialVisuals({
  db,
  articleId: 402,
  content: optionalDraft,
  title: 'Memilih Warna Cat Tembok',
  slug: 'memilih-warna-cat-tembok',
  contentFamily: 'explainer'
});

assert.equal(optResult.checklist.visual_storytelling_need, 'OPTIONAL');
assert.equal(optResult.briefs.length, 0, 'OPTIONAL need must produce 0 briefs automatically');
assert.equal(optResult.dispatchResult, null, 'OPTIONAL need must dispatch 0 media jobs');
console.log('  ✅ PASS: OPTIONAL visual need creates no automatic media work item.\n');
passed++;

// --------------------------------------------------------------------------
// Test 12: NOT_REQUIRED Visual Need Produces Zero Tasks
// --------------------------------------------------------------------------
console.log('Test 12: NOT_REQUIRED Visual Need Produces Zero Tasks');
const notRequiredDraft = `
# Data Indeks Reflektansi Matahari Cat SNI 6389

Tabel standar indeks reflektansi untuk pengujian material selubung bangunan tropis sesuai SNI 6389:2020.
`.trim();

const notReqResult = await evaluateAndDispatchEditorialVisuals({
  db,
  articleId: 403,
  content: notRequiredDraft,
  title: 'Data Indeks Reflektansi',
  slug: 'data-indeks-reflektansi',
  contentFamily: 'reference'
});

assert.equal(notReqResult.checklist.visual_storytelling_need, 'NOT_REQUIRED');
assert.equal(notReqResult.briefs.length, 0);
assert.equal(notReqResult.dispatchResult, null);
console.log('  ✅ PASS: NOT_REQUIRED creates zero tasks.\n');
passed++;

// --------------------------------------------------------------------------
// Test 13: Publication Readiness Genuinely Blocked by REQUIRED Visual
// --------------------------------------------------------------------------
console.log('Test 13: Publication Readiness Gate for REQUIRED Visual');
const readiness = await evaluateArticleMediaReadiness(db, 401);
assert.equal(readiness.ready_for_review, false, 'Article 401 must NOT be ready for review while required visual is unfulfilled');
assert.ok(readiness.blocking_reasons.includes('MISSING_REQUIRED_MEDIA'), 'Must block on missing required media for visual slot');
assert.ok(readiness.required_media_slots.some((s) => s.startsWith('inline_')), 'Inline visual slot must be recognized as required');
console.log('  ✅ PASS: Publication readiness genuinely blocked until REQUIRED visual reaches approved state.\n');
passed++;

// --------------------------------------------------------------------------
// Test 14: Article C Safety & Zero Retrofit Invariant
// --------------------------------------------------------------------------
console.log('Test 14: Article C Safety Invariant');
const artCPath = path.resolve(process.cwd(), 'scripts/content-bootstrap/artC-research-reset/article-c-clean-draft.md');
const artCContent = fs.readFileSync(artCPath);
const artCHash = crypto.createHash('sha256').update(artCContent).digest('hex');
const expectedArtCHash = '12c59631d3b297b97e35cf192da05102661c281e3370399fef291eb014692c28';

assert.equal(artCHash, expectedArtCHash, 'Article C hash must remain 100% untouched');
console.log(`  Article C Current SHA : ${artCHash}`);
console.log(`  Expected Canonical SHA: ${expectedArtCHash}`);
console.log('  ✅ PASS: Article C integrity verified; zero retrofit and zero mutation.\n');
passed++;

console.log('================================================================');
console.log(`🎉 ALL ${passed}/${passed} DIMAS -> BUDI E2E VISUAL HANDOFF TESTS PASSED!`);
console.log('================================================================\n');
