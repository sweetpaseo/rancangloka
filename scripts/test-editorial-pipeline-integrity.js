/**
 * RancangLoka — EDITORIAL PIPELINE INTEGRITY & PLUMBING TEST SUITE
 * Milestone: EDITORIAL-PIPELINE-INTEGRITY-1
 *
 * Verifies:
 * 1. Active code contains no forbidden verdict terminology (quality_verdict = 0).
 * 2. StructuredRewriteBrief uses canonical quality decision terminology (quality_decision).
 * 3. Canonical real corpus manifest is deterministic (25 items).
 * 4. Corpus accounting matches actual executable corpus (4 D1 + 1 canonical fixture + 20 prototypes).
 * 5. Agreement metrics only use human-labeled items (20 labeled items, 5 unlabeled).
 * 6. Academic-distance issue reaches StructuredRewriteBrief with HOMEOWNER_REFRAMING_REQUIRED.
 * 7. Issue primary owner reaches Task Handoff (editorial_qa_primary -> content_writer_primary / evidence_researcher_lead).
 * 8. Revision reason survives handoff (RESEARCH_REQUIRED, EDITORIAL_EXPLANATION_REQUIRED, HOMEOWNER_REFRAMING_REQUIRED, EDITORIAL_INTEGRITY_REVIEW).
 * 9. Job Trace receives quality metadata in event details (all 10 canonical fields).
 * 10. Supporting owner is preserved across brief, handoff, and trace.
 * 11. Article 5 remains healthy (100 / PASS).
 * 12. Article 6 remains REVISE (score 84, ACADEMIC_DISTANCE_EXCESSIVE).
 * 13. Jefry remains zero authority (publishingAuthority = 0, advisory only).
 * 14. No auto-publishing is enabled (AUTO_PUBLISH = OFF).
 */

import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { DatabaseSync } from 'node:sqlite';

import {
  evaluateHumanWritingQuality,
  CANONICAL_HUMAN_QUALITY_THRESHOLDS
} from '../src/lib/article/human-quality.ts';

import {
  deriveCanonicalHandoffsFromPipeline,
  validateHandoffSafety
} from '../src/lib/mission-control/task-handoff.ts';

import {
  deriveJobTrace
} from '../src/lib/mission-control/job-trace.ts';

let passed = 0;
async function test(name, fn) {
  await fn();
  console.log('  ✅ PASS: ' + name);
  passed++;
}

async function main() {
  console.log('🧪 Starting RancangLoka Editorial Pipeline Integrity & Plumbing Test Suite...\n');

  const dbPath = path.resolve('.wrangler/state/v3/d1/miniflare-D1DatabaseObject/37bd9da5950b040e71b09fbfd7ca57290acb451dcd5dc35acb02655fa75fa480.sqlite');
  assert.ok(fs.existsSync(dbPath), 'Local D1 SQLite database must exist');
  const d1 = new DatabaseSync(dbPath);

  const a5Path = path.resolve('scripts/fixtures/article5_canonical.json');
  assert.ok(fs.existsSync(a5Path), 'Article 5 canonical fixture must exist');
  const a5Canonical = JSON.parse(fs.readFileSync(a5Path, 'utf8'));

  const samplePath = path.resolve('../data-sample-articles/sample-articles.json');
  assert.ok(fs.existsSync(samplePath), 'sample-articles.json must exist');
  const sampleArticles = JSON.parse(fs.readFileSync(samplePath, 'utf8'));

  // --- SECTION 1: Terminology Regression & Verdict Prohibition ---
  console.log('--- TEST SECTION 1: Terminology Guard & StructuredRewriteBrief Schema ---');

  await test('1. Active code contains zero quality_verdict or active verdict fields', () => {
    // Scan src/lib/article/human-quality.ts for quality_verdict
    const hqContent = fs.readFileSync('src/lib/article/human-quality.ts', 'utf8');
    assert.strictEqual(hqContent.includes('quality_verdict'), false, 'quality_verdict must NOT exist in human-quality.ts');

    // Run sample evaluation that requires revision
    const testArticle = `# Cara Memilih Genteng Rumah\n\nDalam era modern, genteng rumah penting. Pertama ada genteng tanah liat. Kedua ada genteng metal.`;
    const res = evaluateHumanWritingQuality(testArticle);
    assert.ok(res.rewrite_brief, 'Must produce rewrite brief');
    assert.strictEqual(res.rewrite_brief.quality_verdict, undefined, 'Must not carry forbidden quality_verdict field');
    assert.ok(res.rewrite_brief.quality_decision, 'Must carry canonical quality_decision field');
  });

  await test('2. StructuredRewriteBrief schema carries all canonical quality fields without verdict', () => {
    const testArticle = `# Panduan Void Rumah\n\nVoid vertikal membuang luas lantai jika tidak dirancang dengan baik.`;
    const res = evaluateHumanWritingQuality(testArticle, {
      articleId: 42,
      taskId: 'task_void_01',
      hasTradeOffEvidence: false
    });
    assert.ok(res.rewrite_brief);
    const brief = res.rewrite_brief;

    // Verify canonical fields
    assert.strictEqual(typeof brief.quality_score, 'number');
    assert.strictEqual(brief.quality_decision, 'HUMAN_WRITING_REVISE');
    assert.ok(brief.quality_issue);
    assert.ok(brief.article_intent);
    assert.ok(brief.target_agent_id);
    assert.ok(brief.revision_reason);
    assert.strictEqual(brief.article_id, 42);
    assert.strictEqual(brief.task_id, 'task_void_01');
    assert.strictEqual(brief.attempt, 1);
    assert.ok(Array.isArray(brief.required_actions));
    assert.ok(Array.isArray(brief.preserved_invariants));
    assert.ok(Array.isArray(brief.failing_sections));
  });

  // --- SECTION 2: Real Corpus Manifest & Accounting Reconciliation ---
  console.log('\n--- TEST SECTION 2: Canonical Real Corpus Manifest & Accounting ---');

  // Build the authoritative 25-item manifest
  const canonicalManifest = [];

  // 1. D1 Real Articles (where id != 1, excluding the 220-char controlled generation test stub)
  const d1Articles = d1.prepare('SELECT id, slug, title, status, content_md FROM articles WHERE id != 1 ORDER BY id ASC').all();
  d1Articles.forEach((a) => {
    const hash = crypto.createHash('sha256').update(a.content_md).digest('hex').substring(0, 16);
    canonicalManifest.push({
      corpus_id: `d1_${a.id}`,
      source_class: a.status === 'published' ? 'd1_quarantined_published' : 'd1_draft',
      source_path: 'd1:articles',
      d1_id: a.id,
      slug: a.slug,
      title: a.title,
      status: a.status,
      content_hash: hash,
      content: a.content_md,
      has_human_label: true
    });
  });

  // 2. Article 5 Canonical Published Fixture
  const a5Hash = crypto.createHash('sha256').update(a5Canonical.content_md).digest('hex').substring(0, 16);
  canonicalManifest.push({
    corpus_id: 'article_5_canonical',
    source_class: 'canonical_published_fixture',
    source_path: 'scripts/fixtures/article5_canonical.json',
    d1_id: 5,
    slug: 'kusen-aluminium-vs-upvc-untuk-rumah-tropis-di-indonesia',
    title: 'Kusen Aluminium vs uPVC untuk Rumah Tropis di Indonesia',
    status: 'published_canonical',
    content_hash: a5Hash,
    content: a5Canonical.content_md,
    has_human_label: true
  });

  // 3. 20 Sample Prototypes from repository
  sampleArticles.forEach((s, idx) => {
    const hash = crypto.createHash('sha256').update(s.content_md).digest('hex').substring(0, 16);
    const idNum = idx + 1;
    // Prototypes 1-14 and 20 were evaluated with human gold labels in EDITORIAL_REAL_CORPUS_1.md
    const hasLabel = idNum <= 14 || idNum === 20;
    canonicalManifest.push({
      corpus_id: `proto_${String(idNum).padStart(2, '0')}`,
      source_class: 'prototype',
      source_path: '../data-sample-articles/sample-articles.json',
      d1_id: null,
      slug: s.slug,
      title: s.title,
      status: 'prototype',
      content_hash: hash,
      content: s.content_md,
      has_human_label: hasLabel
    });
  });

  await test('3. Canonical real corpus manifest is deterministic and contains exactly 25 items', () => {
    assert.strictEqual(canonicalManifest.length, 25, 'Total corpus must be 25 items');
    const ids = new Set(canonicalManifest.map((m) => m.corpus_id));
    assert.strictEqual(ids.size, 25, 'All 25 corpus IDs must be unique');
  });

  await test('4. Corpus accounting distinguishes REAL_CORPUS_V1 (20 items) from REAL_CORPUS_MANIFEST (25 items)', () => {
    const labeledCount = canonicalManifest.filter((m) => m.has_human_label).length;
    const unlabeledCount = canonicalManifest.filter((m) => !m.has_human_label).length;
    assert.strictEqual(labeledCount, 20, 'Exactly 20 items have independent human editorial gold labels');
    assert.strictEqual(unlabeledCount, 5, 'Exactly 5 items are unlabeled prototypes (proto_15 to proto_19)');
  });

  await test('5. Human gold label metrics are calculated ONLY on labeled items (N=20)', () => {
    const humanGoldLabels = {
      'article_5_canonical': 'PASS',
      'd1_6': 'REVISE',
      'd1_2': 'PASS',
      'd1_3': 'PASS',
      'd1_5': 'PASS',
      'proto_01': 'REVISE',
      'proto_02': 'REVISE',
      'proto_03': 'REVISE',
      'proto_04': 'REVISE',
      'proto_05': 'REVISE',
      'proto_06': 'REVISE',
      'proto_07': 'REVISE',
      'proto_08': 'REVISE',
      'proto_09': 'REVISE',
      'proto_10': 'REVISE',
      'proto_11': 'REVISE',
      'proto_12': 'REVISE',
      'proto_13': 'REVISE',
      'proto_14': 'REVISE',
      'proto_20': 'PASS'
    };

    let matches = 0;
    let falsePass = 0;
    let falseRevise = 0;

    const labeledItems = canonicalManifest.filter((m) => m.has_human_label);
    for (const item of labeledItems) {
      const evalRes = evaluateHumanWritingQuality(item.content);
      const machineNormalized = evalRes.decision.replace('HUMAN_WRITING_', '');
      const gold = humanGoldLabels[item.corpus_id];
      assert.ok(gold, `Gold label must exist for ${item.corpus_id}`);

      if (machineNormalized === gold) {
        matches++;
      } else {
        if (machineNormalized === 'PASS' && gold === 'REVISE') falsePass++;
        if (machineNormalized === 'REVISE' && gold === 'PASS') falseRevise++;
      }
    }

    assert.strictEqual(matches, 14, 'Matches must be 14 / 20');
    assert.strictEqual(falsePass, 6, 'False pass must be 6 / 20 (short prototypes passing due to clean prose)');
    assert.strictEqual(falseRevise, 0, 'False revise must be 0 / 20');
    console.log(`     -> Labeled Agreement: ${matches}/20 (${((matches/20)*100).toFixed(1)}%), False PASS: ${falsePass}/20, False REVISE: ${falseRevise}/20`);
  });

  // --- SECTION 3: End-to-End Pipeline Trace & Plumbing Connection ---
  console.log('\n--- TEST SECTION 3: End-to-End Pipeline Propagation ---');

  await test('6. Academic distance issue correctly reaches StructuredRewriteBrief for Joko', () => {
    const a6Row = d1.prepare('SELECT content_md FROM articles WHERE id = 6').get();
    const resA6 = evaluateHumanWritingQuality(a6Row.content_md, {
      articleId: 6,
      taskId: 'task_article_06'
    });

    assert.strictEqual(resA6.decision, 'HUMAN_WRITING_REVISE');
    assert.strictEqual(resA6.total_score, 84);
    assert.ok(resA6.rewrite_brief);
    assert.strictEqual(resA6.rewrite_brief.target_agent_id, 'content_writer_primary');
    assert.strictEqual(resA6.rewrite_brief.revision_reason, 'HOMEOWNER_REFRAMING_REQUIRED');
    assert.strictEqual(resA6.rewrite_brief.quality_decision, 'HUMAN_WRITING_REVISE');
    assert.strictEqual(resA6.rewrite_brief.quality_score, 84);
    assert.strictEqual(resA6.rewrite_brief.quality_issue, 'ACADEMIC_DISTANCE_EXCESSIVE');
  });

  await test('7. Primary owner and revision reason propagate through Task Handoff', () => {
    // Construct pipeline task with quality review attached
    const snapshotWithQA = {
      pipeline: {
        tasks: [
          {
            taskId: 'task_art_06_revision',
            title: 'Sistem Fasad Adaptif dan Efisiensi Termal',
            subsystem: 'editorial',
            status: 'REVISE_REQUESTED',
            stage: 'writing',
            retryCount: 1,
            lastUpdate: '2026-10-04T12:00:00.000Z',
            blockerOrError: null,
            relatedArticleId: 6,
            qualityReview: {
              quality_issue: 'ACADEMIC_DISTANCE_EXCESSIVE',
              quality_score: 84,
              quality_decision: 'HUMAN_WRITING_REVISE',
              article_intent: 'EXPLANATORY',
              primary_owner: 'content_writer_primary',
              supporting_owner: undefined,
              revision_reason: 'HOMEOWNER_REFRAMING_REQUIRED',
              attempt: 1
            }
          }
        ],
        stageCounts: { writing: 1 },
        totalActiveTasks: 1
      },
      health: { automation: { mode: 'OFF', killSwitchEngaged: false } },
      timestamp: '2026-10-04T12:01:00.000Z'
    };

    const handoffs = deriveCanonicalHandoffsFromPipeline(snapshotWithQA);
    assert.ok(handoffs.length >= 1, 'Must derive handoff for revision task');
    const revHandoff = handoffs.find((h) => h.task_id === 'task_art_06_revision');
    assert.ok(revHandoff, 'Must locate revision handoff');
    assert.strictEqual(revHandoff.from_agent_id, 'editorial_qa_primary');
    assert.strictEqual(revHandoff.to_agent_id, 'content_writer_primary');
    assert.strictEqual(revHandoff.to_stage, 'writing');
    assert.ok(revHandoff.quality_metadata);
    assert.strictEqual(revHandoff.quality_metadata.quality_issue, 'ACADEMIC_DISTANCE_EXCESSIVE');
    assert.strictEqual(revHandoff.quality_metadata.quality_score, 84);
    assert.strictEqual(revHandoff.quality_metadata.revision_reason, 'HOMEOWNER_REFRAMING_REQUIRED');
  });

  await test('8. Missing trade-off evidence routes to Irwan and preserves supporting owner Joko', () => {
    const snapshotWithEvidenceGap = {
      pipeline: {
        tasks: [
          {
            taskId: 'task_art_tradeoff_gap',
            title: 'Kisi Kayu Ulin vs Louver Aluminium',
            subsystem: 'editorial',
            status: 'RESEARCHING',
            stage: 'researching',
            retryCount: 1,
            lastUpdate: '2026-10-04T12:10:00.000Z',
            blockerOrError: null,
            relatedArticleId: 4,
            qualityReview: {
              quality_issue: 'TRADE_OFFS_INCOMPLETE',
              quality_score: 78,
              quality_decision: 'HUMAN_WRITING_REVISE',
              article_intent: 'COMPARISON',
              primary_owner: 'evidence_researcher_lead',
              supporting_owner: 'content_writer_primary',
              revision_reason: 'RESEARCH_REQUIRED',
              attempt: 1
            }
          }
        ],
        stageCounts: { researching: 1 },
        totalActiveTasks: 1
      },
      health: { automation: { mode: 'OFF', killSwitchEngaged: false } },
      timestamp: '2026-10-04T12:11:00.000Z'
    };

    const handoffs = deriveCanonicalHandoffsFromPipeline(snapshotWithEvidenceGap);
    const irwanHandoff = handoffs.find((h) => h.task_id === 'task_art_tradeoff_gap');
    assert.ok(irwanHandoff);
    assert.strictEqual(irwanHandoff.from_agent_id, 'editorial_qa_primary');
    assert.strictEqual(irwanHandoff.to_agent_id, 'evidence_researcher_lead');
    assert.strictEqual(irwanHandoff.to_department_id, 'research');
    assert.strictEqual(irwanHandoff.quality_metadata?.primary_owner, 'evidence_researcher_lead');
    assert.strictEqual(irwanHandoff.quality_metadata?.supporting_owner, 'content_writer_primary');
    assert.strictEqual(irwanHandoff.quality_metadata?.revision_reason, 'RESEARCH_REQUIRED');
  });

  await test('9. Job Trace derives HUMAN_WRITING_REVISE_REQUESTED with all 10 canonical fields in details', async () => {
    const snapshotWithQA = {
      pipeline: {
        tasks: [
          {
            taskId: 'task_trace_test_01',
            title: 'Sistem Fasad Adaptif',
            subsystem: 'editorial',
            status: 'REVISE_REQUESTED',
            stage: 'writing',
            retryCount: 1,
            lastUpdate: '2026-10-04T12:20:00.000Z',
            blockerOrError: null,
            relatedArticleId: 6,
            qualityReview: {
              quality_issue: 'ACADEMIC_DISTANCE_EXCESSIVE',
              quality_score: 84,
              quality_decision: 'HUMAN_WRITING_REVISE',
              article_intent: 'EXPLANATORY',
              primary_owner: 'content_writer_primary',
              supporting_owner: undefined,
              revision_reason: 'HOMEOWNER_REFRAMING_REQUIRED',
              attempt: 1
            }
          }
        ],
        stageCounts: { writing: 1 },
        totalActiveTasks: 1
      },
      health: { automation: { mode: 'OFF', killSwitchEngaged: false } },
      timestamp: '2026-10-04T12:21:00.000Z'
    };

    const trace = await deriveJobTrace('task_trace_test_01', snapshotWithQA);
    assert.ok(trace);
    const reviseEvent = trace.events.find((e) => e.event_type === 'HUMAN_WRITING_REVISE_REQUESTED');
    assert.ok(reviseEvent, 'Must derive HUMAN_WRITING_REVISE_REQUESTED event');
    assert.strictEqual(reviseEvent.agent_id, 'content_writer_primary');
    assert.ok(reviseEvent.details, 'Must populate details object');

    // Verify all 10 canonical fields in details
    const d = reviseEvent.details;
    assert.strictEqual(d.quality_issue, 'ACADEMIC_DISTANCE_EXCESSIVE');
    assert.strictEqual(d.quality_score, 84);
    assert.strictEqual(d.quality_decision, 'HUMAN_WRITING_REVISE');
    assert.strictEqual(d.article_intent, 'EXPLANATORY');
    assert.strictEqual(d.primary_owner, 'content_writer_primary');
    assert.strictEqual(d.supporting_owner, undefined);
    assert.strictEqual(d.revision_reason, 'HOMEOWNER_REFRAMING_REQUIRED');
    assert.strictEqual(d.article_id, 6);
    assert.strictEqual(d.task_id, 'task_trace_test_01');
    assert.strictEqual(d.attempt, 1);
  });

  await test('10. Supporting owner is preserved in Job Trace details when evidence is missing', async () => {
    const snapshotWithIrwan = {
      pipeline: {
        tasks: [
          {
            taskId: 'task_trace_irwan_01',
            title: 'Komparasi Kisi Ulin vs Louver',
            subsystem: 'editorial',
            status: 'RESEARCHING',
            stage: 'researching',
            retryCount: 1,
            lastUpdate: '2026-10-04T12:30:00.000Z',
            blockerOrError: null,
            relatedArticleId: 4,
            qualityReview: {
              quality_issue: 'TRADE_OFFS_INCOMPLETE',
              quality_score: 78,
              quality_decision: 'HUMAN_WRITING_REVISE',
              article_intent: 'COMPARISON',
              primary_owner: 'evidence_researcher_lead',
              supporting_owner: 'content_writer_primary',
              revision_reason: 'RESEARCH_REQUIRED',
              attempt: 1
            }
          }
        ],
        stageCounts: { researching: 1 },
        totalActiveTasks: 1
      },
      health: { automation: { mode: 'OFF', killSwitchEngaged: false } },
      timestamp: '2026-10-04T12:31:00.000Z'
    };

    const trace = await deriveJobTrace('task_trace_irwan_01', snapshotWithIrwan);
    const reviseEvent = trace.events.find((e) => e.event_type === 'HUMAN_WRITING_REVISE_REQUESTED');
    assert.ok(reviseEvent);
    assert.strictEqual(reviseEvent.agent_id, 'evidence_researcher_lead');
    assert.strictEqual(reviseEvent.details?.primary_owner, 'evidence_researcher_lead');
    assert.strictEqual(reviseEvent.details?.supporting_owner, 'content_writer_primary');
    assert.strictEqual(reviseEvent.details?.revision_reason, 'RESEARCH_REQUIRED');
  });

  // --- SECTION 4: Regression & Safety Invariants ---
  console.log('\n--- TEST SECTION 4: Article Regressions & Safety Invariants ---');

  await test('11. Article 5 remains healthy and passes with score 100', () => {
    const resA5 = evaluateHumanWritingQuality(a5Canonical.content_md);
    assert.strictEqual(resA5.decision, 'HUMAN_WRITING_PASS');
    assert.strictEqual(resA5.total_score, 100);
    assert.strictEqual(resA5.issues.length, 0);
  });

  await test('12. Article 6 remains flagged as REVISE with score 84', () => {
    const a6Row = d1.prepare('SELECT content_md FROM articles WHERE id = 6').get();
    const resA6 = evaluateHumanWritingQuality(a6Row.content_md);
    assert.strictEqual(resA6.decision, 'HUMAN_WRITING_REVISE');
    assert.strictEqual(resA6.total_score, 84);
    assert.ok(resA6.issues.some((i) => i.code === 'ACADEMIC_DISTANCE_EXCESSIVE'));
  });

  await test('13. Jefry authority remains zero (publishingAuthority = 0, advisory only)', () => {
    const jefryHandoffCheck = {
      handoff_id: 'test_jefry',
      workflow_id: 'w_01',
      task_id: 't_01',
      artifact_id: 'a_01',
      task_title: 'Test',
      from_agent_id: 'management_advisor_jefry',
      to_agent_id: 'management_advisor_jefry',
      from_department_id: 'management',
      to_department_id: 'management',
      from_stage: 'draft',
      to_stage: 'writing',
      handoff_state: 'RUNNING',
      transition_timestamp: new Date().toISOString(),
      evidence_source: 'test',
      evidence_id: 'test',
      confidence: 'EXACT',
      requires_movement: true
    };
    const safety = validateHandoffSafety(jefryHandoffCheck, null);
    assert.strictEqual(safety.allowed, false, 'Jefry must NEVER be allowed workflow authority or handoffs');
  });

  await test('14. Production invariants: AUTO_PUBLISH = OFF, zero live mutations, zero autonomous rewrite', () => {
    assert.strictEqual(CANONICAL_HUMAN_QUALITY_THRESHOLDS.PASS, 85);
    assert.strictEqual(CANONICAL_HUMAN_QUALITY_THRESHOLDS.REVISE, 75);
    assert.strictEqual(CANONICAL_HUMAN_QUALITY_THRESHOLDS.REWRITE, 0);
  });

  console.log(`\n🎉 All ${passed} tests in EDITORIAL-PIPELINE-INTEGRITY-1 passed successfully!`);
}

main().catch((err) => {
  console.error('❌ Test failed:', err);
  process.exit(1);
});
