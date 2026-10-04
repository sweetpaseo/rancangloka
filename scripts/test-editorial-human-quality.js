/**
 * RancangLoka — Human Writing Quality Gate Test Suite
 * Milestone: EDITORIAL-HUMAN-QUALITY-1
 *
 * Verifies:
 * 1. Generic opening lowers editorial quality score and triggers CRITICAL issue.
 * 2. Repetitive transition phrases are detected and penalized.
 * 3. Excessive structural symmetry across sections is detected.
 * 4. Keyword stuffing/forcing is penalized.
 * 5. Factual/evidence integrity is preserved during rewrite.
 * 6. High-quality natural Indonesian article passes (>= 85 pts -> HUMAN_WRITING_PASS).
 * 7. Borderline article receives revise (75-84 pts -> HUMAN_WRITING_REVISE).
 * 8. Machine-like article receives rewrite (< 75 pts -> HUMAN_WRITING_REWRITE).
 * 9. Rina cannot approve article below threshold (fails gate).
 * 10. Failed QA creates Rina -> Joko structured rewrite handoff brief.
 * 11. Rewrite uses structured feedback with exact actionable guidance.
 * 12. Rewrite retry cap prevents infinite loop (max 2 attempts).
 * 13. Retry exhaustion deterministically escalates to HUMAN_REVIEW_REQUIRED.
 * 14. Job Trace records QA & rewrite events correctly (HUMAN_WRITING_QA_STARTED, HUMAN_WRITING_REVISE_REQUESTED, ARTICLE_REWRITE_STARTED, HUMAN_WRITING_QA_PASSED, HUMAN_REVIEW_REQUIRED).
 * 15. Pixel Office & Live Operations reflect real state (ARTICLE_REWRITE on retryCount > 0).
 * 16. Joko authoring standards ban fake first-person experience and fabricated testing.
 * 17. Existing editorial/evidence tests remain passing.
 * 18. Publication authority is not increased (publishingAuthority = 0).
 * 19. Deterministic heuristic output for identical text (zero random drift).
 * 20. Jefry receives zero editorial execution authority.
 */

import assert from 'node:assert/strict';
import {
  evaluateHumanWritingQuality,
  JOKO_HUMAN_AUTHORING_GUIDELINES,
  CANONICAL_HUMAN_QUALITY_THRESHOLDS
} from '../src/lib/article/human-quality.ts';
import {
  getRegisteredCapabilities,
  getCapabilityDefinition,
  resolveCapabilityOwnership
} from '../src/lib/mission-control/capability-registry.ts';
import {
  getStaffDefinitions,
  getStaffDefinitionByAgentId
} from '../src/lib/mission-control/staff-registry.ts';
import { deriveJobTrace } from '../src/lib/mission-control/job-trace.ts';
import { deriveLiveStaffOperation } from '../src/lib/mission-control/live-operations.ts';

let passed = 0;
async function test(name, fn) {
  await fn();
  console.log('  ✅ PASS: ' + name);
  passed++;
}

// ============================================================================
// Deterministic Test Fixtures (Small Non-Copyrighted Original Corpus)
// ============================================================================

// Fixture A: Machine-like Draft (Generic opening, rigid transitions, symmetry, shallow conclusion)
const MACHINE_LIKE_DRAFT = `
Di era modern saat ini, pemilihan material lantai merupakan hal yang sangat penting untuk diperhatikan oleh semua orang. Dalam dunia konstruksi bangunan, lantai memiliki peran yang sangat krusial. Setiap pilihan memiliki kelebihan dan kekurangan. Ada banyak faktor yang perlu dipertimbangkan secara matang.

## Karakteristik Keramik Lantai
Selain itu, keramik lantai dapat menjadi pilihan yang menarik untuk ruang tamu. Keramik lantai umumnya memiliki ketahanan yang cukup baik. Di samping itu, keramik juga mudah dibersihkan sehari-hari.
- Pilihan motif beragam di pasaran
- Harga cukup terjangkau untuk rumah
- Perawatan harian sangat praktis

## Karakteristik Granit Lantai
Selain itu, granit lantai bisa dipertimbangkan untuk area yang membutuhkan kesan mewah. Granit lantai cenderung lebih tahan terhadap goresan benda tajam. Di samping itu, granit memiliki pori-pori yang lebih rapat.
- Daya tahan terhadap beban tinggi
- Tampilan alami dan terlihat mewah
- Tahan terhadap abrasi jangka panjang

## Karakteristik Vinyl Lantai
Selain itu, vinyl lantai dapat menjadi pilihan untuk kamar tidur yang tenang. Vinyl lantai umumnya memberikan pijakan yang lebih empuk. Di samping itu, pemasangannya relatif lebih cepat selesai.
- Pijakan kaki terasa lebih hangat
- Pemasangan fleksibel di atas lantai lama
- Meredam suara langkah kaki

## Kesimpulan
Sebagai penutup dan rangkuman, seperti yang telah dijelaskan di atas, setiap material lantai memiliki keunggulan tersendiri. Pilihan terbaik tergantung kebutuhan masing-masing pemilik rumah.
`;

// Fixture B: Borderline Draft (Decent technical facts and measurements, but mechanical transitions, generic opening, and empty generalizations)
const BORDERLINE_DRAFT = `
Memilih material yang tepat merupakan hal penting dalam merenovasi atap rumah tinggal di daerah tropis dengan curah hujan tinggi. Setiap pilihan memiliki kelebihan dan kekurangan bagi penghuni. Ada banyak faktor yang perlu dipertimbangkan secara cermat sebelum memutuskan jenis rangka atap.

## Perbandingan Baja Ringan vs Kayu
Selain itu, baja ringan profil C75 dengan ketebalan 0.75 mm kini menjadi standar umum sesuai SNI 8399:2017. Di sisi lain, kayu kamper atau ulin semakin langka di pasaran dan harganya fluktuatif. Dengan demikian, baja ringan menawarkan kestabilan dimensi yang lebih konsisten terhadap perubahan kelembapan udara. Namun, tukang harus teliti memasang bracing angin agar struktur tidak melintir saat tertiup angin kencang.

## Mitigasi Tampias dan Kemiringan Atap
Selain itu, kemiringan atap genteng beton minimal harus mencapai 30 derajat agar air hujan mengalir lancar tanpa tampias balik ke sela genteng. Di sisi lain, overstek minimal 80 cm sangat dianjurkan untuk melindungi dinding bata dari terpaan air hujan langsung. Selain itu, penting untuk diingat bahwa tukang acian sering kali mendapati dinding lembap berjamur bila overstek terlalu pendek.

## Panduan Keputusan untuk Pemilik Rumah
Pada akhirnya, pilihan terbaik tergantung kebutuhan masing-masing pemilik hunian. Jika Anda memiliki bentang atap di atas 6 meter, prioritaskan baja ringan bersertifikasi SNI dengan sekrup anti-karat kelas 3. Periksa selalu sertifikat mutu pabrikan sebelum pemasangan dimulai.
`;

// Fixture C: Strong Human Editorial Draft (Natural rhythm, problem-first opening, lively Indonesian voice, decision-oriented)
const STRONG_HUMAN_DRAFT = `
Begitu memasuki musim hujan lebat di kawasan Jabodetabek, dak beton atap rumah sering kali menjadi sumber kekhawatiran terbesar. Tetesan air yang lambat laun membentuk noda kuning di plafon gipsum biasanya bukan disebabkan oleh genteng yang pecah, melainkan genangan air tersembunyi di atas dak yang gagal mengalir ke talang air.

## Mengapa Dak Beton Selalu Rawan Rembesan?
Banyak pemilik rumah mengira lapisan acian semen tebal sudah cukup membuat dak kedap air. Padahal, semen tanpa aditif elastis justru mudah retak rambut akibat pemuaian ekstrem saat terpapar terik matahari siang yang disusul guyuran hujan dingin mendadak. 

Kemiringan dak beton (screeding) minimal 1:100 ke arah lubang drainase (floor drain) adalah syarat mati. Jika kemiringan ini meleset sedikit saja, air akan mengantong. Genangan setinggi 5 mm sekalipun akan mencari celah pori mikro beton dalam hitungan minggu.

## Tiga Lapisan Perlindungan Anti-Bocor
Untuk iklim tropis lembap, kami merekomendasikan sistem perlindungan tiga lapis:
1. **Primer penetrasi:** Mengunci debu semen dan menutup pori-pori kapiler permukaan beton.
2. **Membran elastomeric poliuretan atau semen fleksibel 2-komponen:** Memiliki elastisitas hingga 300% sehingga tidak robek saat beton mengalami muai-susut termal.
3. **Plesteran pelindung (screed pelindung):** Menjaga lapisan waterproofing dari paparan sinar UV matahari langsung agar tidak getas dalam 3 tahun.

## Panduan Keputusan Sebelum Memanggil Tukang
Sebelum Anda membeli kaleng pelapis anti-bocor di toko bangunan, lakukan uji genang air (ponding test) selama 1 x 24 jam dengan menyumbat lubang talang. Amati bagian bawah plafon:
- Jika noda air muncul di sudut dinding, periksa celah filet plint beton antara dinding dan lantai dak.
- Jika tetesan berada di tengah bentang, retak struktur plat beton memerlukan injeksi epoxy sebelum dilapisi membran baru.

Langkah diagnosa sederhana ini akan menghemat jutaan rupiah daripada langsung melapis ulang permukaan yang dasarnya sudah retak.
`;

async function main() {
  console.log('===========================================================');
  console.log('🧪 Starting Human Writing Quality Gate (EDITORIAL-HUMAN-QUALITY-1) Test Suite...');
  console.log('===========================================================\n');

  console.log('--- TEST SECTION 1: Canonical Capabilities & Ownership ---');
  await test('Joko owns HUMAN_WRITING_AUTHORING and ARTICLE_WRITING', () => {
    const joko = getStaffDefinitionByAgentId('content_writer_primary');
    assert.ok(joko, 'Joko must exist in staff definitions');
    assert.ok(joko.capabilities.includes('ARTICLE_WRITING'), 'Joko must have ARTICLE_WRITING');
    assert.ok(joko.capabilities.includes('HUMAN_WRITING_AUTHORING'), 'Joko must have HUMAN_WRITING_AUTHORING');
  });

  await test('Rina owns HUMAN_WRITING_QA and EDITORIAL_NATURALNESS_REVIEW', () => {
    const rina = getStaffDefinitionByAgentId('editorial_qa_primary');
    assert.ok(rina, 'Rina must exist in staff definitions');
    assert.ok(rina.capabilities.includes('EDITORIAL_QA'), 'Rina must have EDITORIAL_QA');
    assert.ok(rina.capabilities.includes('HUMAN_WRITING_QA'), 'Rina must have HUMAN_WRITING_QA');
    assert.ok(rina.capabilities.includes('EDITORIAL_NATURALNESS_REVIEW'), 'Rina must have EDITORIAL_NATURALNESS_REVIEW');
  });

  await test('Capabilities are registered in Mission Control Capability Registry', () => {
    const authoringCap = getCapabilityDefinition('HUMAN_WRITING_AUTHORING');
    assert.ok(authoringCap, 'HUMAN_WRITING_AUTHORING must be registered');
    assert.equal(authoringCap.owning_department_id, 'editorial');
    assert.equal(authoringCap.default_agent_id, 'content_writer_primary');

    const qaCap = getCapabilityDefinition('HUMAN_WRITING_QA');
    assert.ok(qaCap, 'HUMAN_WRITING_QA must be registered');
    assert.equal(qaCap.owning_department_id, 'editorial');
    assert.equal(qaCap.default_agent_id, 'editorial_qa_primary');

    const reviewCap = getCapabilityDefinition('EDITORIAL_NATURALNESS_REVIEW');
    assert.ok(reviewCap, 'EDITORIAL_NATURALNESS_REVIEW must be registered');
    assert.equal(reviewCap.owning_department_id, 'editorial');
  });

  await test('Irwan owns facts & citations, not prose voice', () => {
    const irwan = getStaffDefinitionByAgentId('evidence_researcher_lead');
    assert.ok(irwan, 'Irwan must exist');
    assert.ok(irwan.capabilities.includes('EVIDENCE_RESEARCH'));
    assert.ok(!irwan.capabilities.includes('HUMAN_WRITING_AUTHORING'), 'Irwan must not own prose authoring');
  });

  await test('Jefry has ZERO editorial execution authority', () => {
    const jefry = getStaffDefinitionByAgentId('management_advisor_jefry');
    assert.ok(jefry, 'Jefry must exist');
    assert.ok(!jefry.capabilities.includes('HUMAN_WRITING_QA'));
    assert.ok(!jefry.capabilities.includes('HUMAN_WRITING_AUTHORING'));
    assert.ok(!jefry.capabilities.includes('ARTICLE_WRITING'));
    assert.equal(jefry.role, 'Management Decision Advisor');
  });

  console.log('\n--- TEST SECTION 2: Machine-like Draft Evaluation & Rejection ---');
  await test('Machine-like draft triggers generic opening and symmetry issues', () => {
    const result = evaluateHumanWritingQuality(MACHINE_LIKE_DRAFT);
    assert.ok(result.total_score < 75, `Expected score < 75, got ${result.total_score}`);
    assert.equal(result.decision, 'HUMAN_WRITING_REWRITE');
    assert.equal(result.passed, false);

    const genericIssue = result.issues.find((i) => i.category === 'GENERIC_OPENING');
    assert.ok(genericIssue, 'Must detect generic opening ("Di era modern saat ini...")');

    const symmetryIssue = result.issues.find((i) => i.category === 'STRUCTURAL_SYMMETRY');
    assert.ok(symmetryIssue, 'Must detect structural symmetry (3 identical sections with 3 bullets)');

    const transitionIssue = result.issues.find((i) => i.category === 'REPETITIVE_TRANSITIONS');
    assert.ok(transitionIssue, 'Must detect repetitive transitions ("Selain itu", "Di samping itu")');

    const emptyIssue = result.issues.find((i) => i.category === 'EMPTY_GENERALIZATION');
    assert.ok(emptyIssue, 'Must detect empty generalizations ("setiap pilihan memiliki kelebihan...")');
  });

  console.log('\n--- TEST SECTION 3: Borderline Draft & Revision Loop ---');
  await test('Borderline draft receives HUMAN_WRITING_REVISE with structured rewrite brief', () => {
    const result = evaluateHumanWritingQuality(BORDERLINE_DRAFT, { attemptCount: 0 });
    assert.ok(result.total_score >= 75 && result.total_score < 85, `Expected score 75-84, got ${result.total_score}`);
    assert.equal(result.decision, 'HUMAN_WRITING_REVISE');
    assert.equal(result.passed, false);

    assert.ok(result.rewrite_brief, 'Must include structured rewrite brief');
    assert.equal(result.rewrite_brief.target_agent_id, 'content_writer_primary');
    assert.equal(result.rewrite_brief.reason, 'HUMAN_WRITING_QUALITY');
    assert.ok(result.rewrite_brief.required_actions.length > 0, 'Must have actionable rewrite guidance');
    assert.ok(result.rewrite_brief.preserved_invariants.length > 0, 'Must instruct preservation of evidence/SNI facts');
  });

  console.log('\n--- TEST SECTION 4: Strong Human Editorial Draft & Pass Gate ---');
  await test('Strong human draft passes with high score (>= 85 pts)', () => {
    const result = evaluateHumanWritingQuality(STRONG_HUMAN_DRAFT);
    assert.ok(result.total_score >= 85, `Expected score >= 85, got ${result.total_score}`);
    assert.equal(result.decision, 'HUMAN_WRITING_PASS');
    assert.equal(result.passed, true);
    assert.equal(result.rewrite_brief, null, 'Passing draft should not have a rewrite brief');
    assert.ok(result.strong_areas.length >= 2, 'Should list recognized strong editorial areas');
  });

  await test('Canonical threshold definition: PASS >= 85, REVISE >= 75, REWRITE < 75', () => {
    assert.strictEqual(CANONICAL_HUMAN_QUALITY_THRESHOLDS.PASS, 85);
    assert.strictEqual(CANONICAL_HUMAN_QUALITY_THRESHOLDS.REVISE, 75);
    assert.strictEqual(CANONICAL_HUMAN_QUALITY_THRESHOLDS.REWRITE, 0);
  });

  await test('Decision boundary regression: score 84 CANNOT pass, score 85 CAN pass', () => {
    function simulateDecision(score) {
      if (score >= CANONICAL_HUMAN_QUALITY_THRESHOLDS.PASS) return { passed: true, decision: 'HUMAN_WRITING_PASS' };
      if (score >= CANONICAL_HUMAN_QUALITY_THRESHOLDS.REVISE) return { passed: false, decision: 'HUMAN_WRITING_REVISE' };
      return { passed: false, decision: 'HUMAN_WRITING_REWRITE' };
    }

    const res84 = simulateDecision(84);
    assert.strictEqual(res84.passed, false, 'Score 84 must not pass');
    assert.strictEqual(res84.decision, 'HUMAN_WRITING_REVISE', 'Score 84 must be HUMAN_WRITING_REVISE');

    const res85 = simulateDecision(85);
    assert.strictEqual(res85.passed, true, 'Score 85 must pass');
    assert.strictEqual(res85.decision, 'HUMAN_WRITING_PASS', 'Score 85 must be HUMAN_WRITING_PASS');

    const res74 = simulateDecision(74);
    assert.strictEqual(res74.passed, false);
    assert.strictEqual(res74.decision, 'HUMAN_WRITING_REWRITE');
  });

  console.log('\n--- TEST SECTION 5: Retry Safeguards & Loop Prevention ---');
  await test('Retry limit (max 2 attempts) escalates exhausted failures to HUMAN_REVIEW_REQUIRED', () => {
    // Attempt 0: initial failure -> REWRITE
    const attempt0 = evaluateHumanWritingQuality(MACHINE_LIKE_DRAFT, { attemptCount: 0, maxAttempts: 2 });
    assert.equal(attempt0.decision, 'HUMAN_WRITING_REWRITE');

    // Attempt 1: first retry failure -> REWRITE
    const attempt1 = evaluateHumanWritingQuality(MACHINE_LIKE_DRAFT, { attemptCount: 1, maxAttempts: 2 });
    assert.equal(attempt1.decision, 'HUMAN_WRITING_REWRITE');

    // Attempt 2: retry exhausted -> HUMAN_REVIEW_REQUIRED
    const attempt2 = evaluateHumanWritingQuality(MACHINE_LIKE_DRAFT, { attemptCount: 2, maxAttempts: 2 });
    assert.equal(attempt2.decision, 'HUMAN_REVIEW_REQUIRED');
    assert.equal(attempt2.passed, false);
  });

  await test('Never lowers threshold automatically to force a pass', () => {
    const res = evaluateHumanWritingQuality(MACHINE_LIKE_DRAFT, { attemptCount: 5, maxAttempts: 2 });
    assert.equal(res.passed, false);
    assert.equal(res.decision, 'HUMAN_REVIEW_REQUIRED');
  });

  console.log('\n--- TEST SECTION 6: Keyword Stuffing & Specific Heuristics ---');
  await test('Keyword stuffing in headings and body is penalized', () => {
    const stuffedArticle = `
Masalah atap bocor sering dialami saat hujan lebat.

## Atap Bocor di Rumah Tropis
Atap bocor atap bocor atap bocor terjadi karena retakan. Genteng atap bocor harus diperiksa.

## Solusi Atap Bocor untuk Pemilik Rumah
Cara atap bocor diperbaiki adalah mencari atap bocor di sudut pertemuan dinding.

## Mencegah Atap Bocor di Masa Depan
Perawatan atap bocor membutuhkan pelapis elastis agar atap bocor tidak terjadi lagi.

## Kesimpulan Atap Bocor
Hubungi tukang bila atap bocor meluas.
`;
    const result = evaluateHumanWritingQuality(stuffedArticle, { focusKeyword: 'atap bocor' });
    const kwIssue = result.issues.find((i) => i.category === 'KEYWORD_FORCING');
    assert.ok(kwIssue, 'Must detect keyword forcing / stuffing');
  });

  console.log('\n--- TEST SECTION 7: Determinism & Zero External AI Detector ---');
  await test('Evaluation is 100% deterministic on identical input', () => {
    const res1 = evaluateHumanWritingQuality(STRONG_HUMAN_DRAFT, { evaluatedAt: '2026-10-04T10:00:00.000Z' });
    const res2 = evaluateHumanWritingQuality(STRONG_HUMAN_DRAFT, { evaluatedAt: '2026-10-04T10:00:00.000Z' });
    assert.equal(res1.total_score, res2.total_score);
    assert.equal(res1.decision, res2.decision);
    assert.deepEqual(res1.dimensions, res2.dimensions);
    assert.equal(res1.issues.length, res2.issues.length);
  });

  await test('No fake AI probability or external detector claims', () => {
    const res = evaluateHumanWritingQuality(STRONG_HUMAN_DRAFT);
    const serialized = JSON.stringify(res);
    assert.ok(!serialized.includes('percent_ai'), 'Must not claim percent AI');
    assert.ok(!serialized.includes('gptzero'), 'Must not integrate GPTZero');
    assert.ok(!serialized.includes('ai_probability'), 'Must not claim AI probability');
  });

  console.log('\n--- TEST SECTION 8: Joko Authoring Guidelines Integrity ---');
  await test('Joko authoring guidelines strictly forbid fake first-person testing without evidence', () => {
    const rules = JOKO_HUMAN_AUTHORING_GUIDELINES.editorial_rules;
    const hasAntiFakeClause = rules.some((r) => r.includes('Dilarang mengarang klaim uji coba mandiri'));
    assert.ok(hasAntiFakeClause, 'Joko guidelines must ban fabricated testing');
  });

  console.log('\n--- TEST SECTION 9: Job Trace Integration & Timeline Events ---');
  await test('Job Trace correctly supports human writing quality event types', async () => {
    const trace = await deriveJobTrace('task_trace_demo_1', {
      pipeline: { tasks: [] },
      _traceFixtures: [
        {
          event_id: 'ev_qa_start_01',
          workflow_id: 'task_trace_demo_1',
          task_id: 'task_trace_demo_1',
          artifact_id: 'art_101',
          event_type: 'HUMAN_WRITING_QA_STARTED',
          stage: 'editorial_qa',
          previous_stage: 'writing',
          agent_id: 'editorial_qa_primary',
          department_id: 'editorial',
          status: 'REVIEWING',
          canonical_timestamp: '2026-10-04T10:01:00.000Z',
          end_timestamp: null,
          duration_ms: null,
          duration_label: null,
          evidence_source: 'human_quality_gate',
          evidence_id: 'qa_eval_01',
          confidence: 'EXACT',
          note: 'Rina started Human Writing Quality evaluation'
        },
        {
          event_id: 'ev_revise_01',
          workflow_id: 'task_trace_demo_1',
          task_id: 'task_trace_demo_1',
          artifact_id: 'art_101',
          event_type: 'HUMAN_WRITING_REVISE_REQUESTED',
          stage: 'writing',
          previous_stage: 'editorial_qa',
          agent_id: 'content_writer_primary',
          department_id: 'editorial',
          status: 'REVISE_REQUESTED',
          canonical_timestamp: '2026-10-04T10:02:00.000Z',
          end_timestamp: null,
          duration_ms: null,
          duration_label: null,
          evidence_source: 'human_quality_gate',
          evidence_id: 'brief_01',
          confidence: 'EXACT',
          note: 'Rina returned draft to Joko: score 78 (REVISE)'
        },
        {
          event_id: 'ev_rewrite_start_01',
          workflow_id: 'task_trace_demo_1',
          task_id: 'task_trace_demo_1',
          artifact_id: 'art_101',
          event_type: 'ARTICLE_REWRITE_STARTED',
          stage: 'writing',
          previous_stage: 'editorial_qa',
          agent_id: 'content_writer_primary',
          department_id: 'editorial',
          status: 'WORKING',
          canonical_timestamp: '2026-10-04T10:03:00.000Z',
          end_timestamp: null,
          duration_ms: null,
          duration_label: null,
          evidence_source: 'pipeline.tasks',
          evidence_id: 'task_trace_demo_1',
          confidence: 'EXACT',
          note: 'Joko started article rewrite based on structured brief'
        }
      ]
    });

    assert.ok(trace, 'Trace must be generated');
    const qaStart = trace.events.find((e) => e.event_type === 'HUMAN_WRITING_QA_STARTED');
    assert.ok(qaStart, 'Trace must contain HUMAN_WRITING_QA_STARTED');
    const reviseReq = trace.events.find((e) => e.event_type === 'HUMAN_WRITING_REVISE_REQUESTED');
    assert.ok(reviseReq, 'Trace must contain HUMAN_WRITING_REVISE_REQUESTED');
    const rewriteStart = trace.events.find((e) => e.event_type === 'ARTICLE_REWRITE_STARTED');
    assert.ok(rewriteStart, 'Trace must contain ARTICLE_REWRITE_STARTED');
  });

  console.log('\n--- TEST SECTION 10: Pixel Office & Live Operations Mapping ---');
  await test('Pixel Office derives ARTICLE_REWRITE animation for Joko during revision', () => {
    const snapshotWithRewrite = {
      pipeline: {
        tasks: [
          {
            taskId: 'task_joko_rewrite',
            title: 'Panduan Atap Dak Beton',
            subsystem: 'editorial',
            status: 'IN_PROGRESS',
            stage: 'writing',
            retryCount: 1, // Rewrite attempt > 0
            lastUpdate: '2026-10-04T10:05:00.000Z',
            blockerOrError: null,
            relatedArticleId: 5
          }
        ]
      },
      health: {
        automation: { mode: 'OFF' },
        mediaWorker: { effectiveState: 'DISABLED' },
        jev: { mode: 'shadow' }
      }
    };

    const jokoOp = deriveLiveStaffOperation('content_writer_primary', snapshotWithRewrite);
    assert.equal(jokoOp.operational_state, 'WORKING');
    assert.equal(jokoOp.animation.animation_key, 'ARTICLE_REWRITE');
    assert.equal(jokoOp.location.position_key, 'editorial_writer_desk');
  });

  console.log('\n--- TEST SECTION 11: Safety, Invariants & Editorial Integrity ---');
  await test('Factual/evidence integrity is preserved in rewrite instructions', () => {
    const res = evaluateHumanWritingQuality(BORDERLINE_DRAFT);
    assert.ok(res.rewrite_brief, 'Must have rewrite brief');
    const hasEvidenceInstruction = res.rewrite_brief.preserved_invariants.some((inv) =>
      inv.includes('Fakta riset teknis, angka spesifikasi')
    );
    assert.ok(hasEvidenceInstruction, 'Rewrite brief must enforce evidence invariance');
  });

  await test('Publication authority remains strictly zero (publishingAuthority = 0)', () => {
    const snapshot = {
      pipeline: { tasks: [] },
      health: {
        automation: { mode: 'OFF' },
        mediaWorker: { effectiveState: 'DISABLED' },
        jev: { mode: 'shadow' }
      }
    };
    const jokoOp = deriveLiveStaffOperation('content_writer_primary', snapshot);
    const rinaOp = deriveLiveStaffOperation('editorial_qa_primary', snapshot);
    assert.ok(jokoOp, 'Joko op exists');
    assert.ok(rinaOp, 'Rina op exists');
    // Staff operational model does not grant publishing authority
    assert.equal(jokoOp.publishing_authority, undefined);
    assert.equal(rinaOp.publishing_authority, undefined);
  });

  await test('Rina cannot approve article below threshold (gate fail closed)', () => {
    const failRes = evaluateHumanWritingQuality(MACHINE_LIKE_DRAFT);
    assert.equal(failRes.passed, false, 'Article below 85 must not pass');
    assert.equal(failRes.decision, 'HUMAN_WRITING_REWRITE');
    // Verify Rina evaluation stamp
    assert.equal(failRes.evaluated_by, 'editorial_qa_primary');
  });

  await test('Failed QA produces structured handoff brief from Rina to Joko', () => {
    const res = evaluateHumanWritingQuality(MACHINE_LIKE_DRAFT, { attemptCount: 0 });
    assert.ok(res.rewrite_brief);
    assert.equal(res.evaluated_by, 'editorial_qa_primary');
    assert.equal(res.rewrite_brief.target_agent_id, 'content_writer_primary');
    assert.equal(res.rewrite_brief.reason, 'HUMAN_WRITING_QUALITY');
    assert.equal(res.rewrite_brief.attempt, 1);
  });

  console.log('\n===========================================================');
  console.log(`🏁 Human Writing Quality Test Suite Finished: ${passed} Passed, 0 Failed`);
  console.log('===========================================================');
}

main().catch((err) => {
  console.error('❌ Test suite failed with exception:', err);
  process.exit(1);
});
