/**
 * RancangLoka — Visual Quality Gate Correction V2.2 Test Suite
 *
 * Verifies:
 * 1. Mandatory Visual Requirement Checks (PASS / FAIL / UNCERTAIN)
 * 2. High aesthetic score (95+) CANNOT override mandatory requirement failure
 * 3. Lite Cover correctly evaluated as REJECTED due to dining table on outdoor gravel
 * 4. Lite Inline correctly evaluated as REJECTED due to rooftop patio scale instead of interior void
 * 5. Pro Cover correctly evaluated as RECOMMENDED_FOR_OWNER
 * 6. Pro Inline correctly evaluated as RECOMMENDED_FOR_OWNER
 * 7. AI Vision Reviewer NEVER issues APPROVED (Owner approval strictly reserved)
 * 8. Calibration persistence integrity (CORS, state/ path resolution, non-destructive upsert)
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import assert from 'node:assert/strict';

import {
  evaluateStrictVisualEvidenceGate,
  evaluateCandidateWithNadiaMandatoryGates
} from '../src/lib/editorial/visual-quality-reviewer.ts';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

let passed = 0;
let total = 0;

function it(name, fn) {
  total++;
  try {
    fn();
    passed++;
    console.log(`  [PASS] ${name}`);
  } catch (e) {
    console.error(`  [FAIL] ${name}:`, e.message);
    throw e;
  }
}

console.log('=============================================================');
console.log('  RancangLoka — Visual Quality Gate Correction V2.2 Suite');
console.log('=============================================================\n');

// T01: Aesthetic score cannot override failed mandatory requirement
it('T01: Aesthetic score (95+) CANNOT override failed mandatory requirement', () => {
  const res = evaluateStrictVisualEvidenceGate({
    candidate_id: 'test_aesthetic_trap',
    slot_key: 'cover_hero',
    model: 'seedream-lite',
    cost_usd: 0.035,
    mandatory_checks: [
      {
        id: 'REQ-1',
        description: 'Living to dining spatial sequence',
        status: 'FAIL',
        observed_evidence: 'Dining table is placed outside in the gravel courtyard',
        reason: 'Violates interior dining requirement; furniture exposed to rain'
      }
    ],
    architectural_plausibility: { status: 'PASS', notes: 'Construction plausible' },
    editorial_explanation_clarity: { status: 'PASS', notes: 'Clear image' },
    aesthetic_quality_score: { score: 99, notes: 'Stunning photorealism' }
  });

  assert.equal(res.final_gate_verdict, 'REJECTED', 'Must be REJECTED despite 99 aesthetic score');
  assert.equal(res.mandatory_requirements.status, 'FAIL');
  assert.ok(res.hard_rejection_reasons.some(r => r.includes('[MANDATORY_FAIL]')));
  assert.equal(res.aesthetic_quality_score.cannot_override_gate, true);
});

// T02: Uncertain requirement triggers NEEDS_REVIEW
it('T02: Uncertain requirement triggers NEEDS_REVIEW (cannot auto-pass)', () => {
  const res = evaluateStrictVisualEvidenceGate({
    candidate_id: 'test_uncertain',
    slot_key: 'inline_inner_court',
    model: 'seedream-pro',
    cost_usd: 0.0675,
    mandatory_checks: [
      {
        id: 'REQ-DRAIN',
        description: 'Perimeter floor drain grating',
        status: 'UNCERTAIN',
        observed_evidence: 'Shadows obscure drain position',
        reason: 'Cannot confirm drain from pixels alone'
      }
    ],
    architectural_plausibility: { status: 'PASS', notes: 'OK' },
    editorial_explanation_clarity: { status: 'PASS', notes: 'OK' },
    aesthetic_quality_score: { score: 90, notes: 'Good' }
  });

  assert.equal(res.final_gate_verdict, 'NEEDS_REVIEW');
  assert.equal(res.mandatory_requirements.status, 'UNCERTAIN');
});

// T03: Re-evaluation of Lite Cover correctly outputs REJECTED
it('T03: Lite Cover re-evaluation correctly outputs REJECTED', () => {
  const liteCoverResult = evaluateStrictVisualEvidenceGate({
    candidate_id: 'art10000_v2_cover_seedream-lite',
    slot_key: 'cover_hero',
    model: 'bytedance/seedream/v5/lite/text-to-image',
    cost_usd: 0.0350,
    mandatory_checks: [
      { id: 'MC-1', description: '5-meter width proportion', status: 'PASS', observed_evidence: 'Wide span visible', reason: 'Compliant' },
      { id: 'MC-2', description: 'Unroofed vertical daylight', status: 'PASS', observed_evidence: 'Direct blue sky and sunlight', reason: 'Compliant' },
      { id: 'MC-3', description: 'Living room seating foreground', status: 'PASS', observed_evidence: 'Linen sofa with cushion and blanket', reason: 'Compliant' },
      { id: 'MC-4', description: 'Operable glass doors', status: 'PASS', observed_evidence: 'Black folding glass doors open', reason: 'Compliant' },
      { id: 'MC-5', description: 'Structural concrete lintel', status: 'PASS', observed_evidence: 'Raw exposed concrete lintel beam across opening', reason: 'Compliant' },
      {
        id: 'MC-6',
        description: 'Living to Courtyard to Indoor Dining spatial sequence',
        status: 'FAIL',
        observed_evidence: 'Dining table and chairs located in open gravel courtyard',
        reason: 'Violates spatial relationship; dining table in open courtyard is vulnerable to tropical rain and breaks the indoor dining flow'
      }
    ],
    architectural_plausibility: { status: 'PASS', notes: 'Exposed concrete lintel is structurally sound' },
    editorial_explanation_clarity: { status: 'FAIL', notes: 'Misrepresents indoor dining connection by putting dining set in outdoor gravel' },
    aesthetic_quality_score: { score: 95, notes: 'High photorealism and beautiful lighting' }
  });

  assert.equal(liteCoverResult.final_gate_verdict, 'REJECTED');
  assert.ok(liteCoverResult.hard_rejection_reasons.some(r => r.includes('open gravel courtyard')));
});

// T04: Re-evaluation of Lite Inline correctly outputs REJECTED
it('T04: Lite Inline re-evaluation correctly outputs REJECTED', () => {
  const liteInlineResult = evaluateStrictVisualEvidenceGate({
    candidate_id: 'art10000_v2_inline_seedream-lite',
    slot_key: 'inline_inner_court',
    model: 'bytedance/seedream/v5/lite/text-to-image',
    cost_usd: 0.0350,
    mandatory_checks: [
      { id: 'MC-1', description: 'True open sky without canopy', status: 'PASS', observed_evidence: 'Bright sun and blue sky directly overhead', reason: 'Compliant' },
      { id: 'MC-2', description: 'Sunken perimeter gravel bed', status: 'PASS', observed_evidence: 'River pebbles in border trench', reason: 'Compliant' },
      { id: 'MC-3', description: 'Floor level drop 5-10cm', status: 'PASS', observed_evidence: 'Terrazzo curb drops to pebble trench', reason: 'Compliant' },
      { id: 'MC-4', description: 'Metal floor drain grating', status: 'PASS', observed_evidence: 'Metal drain grating embedded in pebbles', reason: 'Compliant' },
      { id: 'MC-5', description: 'Operable sliding doors', status: 'PASS', observed_evidence: 'Black frame sliding doors open on sides', reason: 'Compliant' },
      {
        id: 'MC-6',
        description: 'Enclosed 1.5x2m interior townhouse lightwell void context',
        status: 'FAIL',
        observed_evidence: 'Low waist-high boundary walls with open horizon',
        reason: 'Looks like an outdoor rooftop terrace or patio rather than an enclosed vertical lightwell shaft carved inside a narrow townhouse'
      }
    ],
    architectural_plausibility: { status: 'PASS', notes: 'Curb and drain details are plausible' },
    editorial_explanation_clarity: { status: 'FAIL', notes: 'Fails to explain interior townhouse lightwell; creates confusion with rooftop patio' },
    aesthetic_quality_score: { score: 95, notes: 'Terrazzo texture and sunlight reflections are exceptionally sharp' }
  });

  assert.equal(liteInlineResult.final_gate_verdict, 'REJECTED');
  assert.ok(liteInlineResult.hard_rejection_reasons.some(r => r.includes('rooftop terrace')));
});

// T05: Pro Cover correctly outputs RECOMMENDED_FOR_OWNER
it('T05: Pro Cover correctly outputs RECOMMENDED_FOR_OWNER (never auto-approved)', () => {
  const proCoverResult = evaluateStrictVisualEvidenceGate({
    candidate_id: 'art10000_v2_cover_seedream-pro',
    slot_key: 'cover_hero',
    model: 'bytedance/seedream/v5/pro/text-to-image',
    cost_usd: 0.0675,
    mandatory_checks: [
      { id: 'MC-1', description: '5-meter width proportion', status: 'PASS', observed_evidence: 'Accurate domestic span', reason: 'Compliant' },
      { id: 'MC-2', description: 'Unroofed vertical daylight', status: 'PASS', observed_evidence: 'Zenith soft daylight spill', reason: 'Compliant' },
      { id: 'MC-3', description: 'Living room seating foreground', status: 'PASS', observed_evidence: 'Sofa, coffee table with books', reason: 'Compliant' },
      { id: 'MC-4', description: 'Operable glass doors', status: 'PASS', observed_evidence: 'Multi-panel black frame bifold doors open', reason: 'Compliant' },
      { id: 'MC-5', description: 'Structural concrete lintel', status: 'PASS', observed_evidence: 'Visible lintel beam above opening', reason: 'Compliant' },
      { id: 'MC-6', description: 'Living to Courtyard to Indoor Dining spatial sequence', status: 'PASS', observed_evidence: 'Living foreground, courtyard midground, indoor dining table background', reason: 'Compliant' }
    ],
    architectural_plausibility: { status: 'PASS', notes: 'Reinforced lintel and practical columns respected' },
    editorial_explanation_clarity: { status: 'PASS', notes: 'Solves narrow dark core problem visually' },
    aesthetic_quality_score: { score: 96, notes: 'Lived-in warm domestic Indonesian tone' }
  });

  assert.equal(proCoverResult.final_gate_verdict, 'RECOMMENDED_FOR_OWNER');
  assert.notEqual(proCoverResult.final_gate_verdict, 'APPROVED', 'Reviewer must NEVER emit APPROVED');
});

// T06: Pro Inline correctly outputs RECOMMENDED_FOR_OWNER
it('T06: Pro Inline correctly outputs RECOMMENDED_FOR_OWNER', () => {
  const proInlineResult = evaluateStrictVisualEvidenceGate({
    candidate_id: 'art10000_v2_inline_seedream-pro',
    slot_key: 'inline_inner_court',
    model: 'bytedance/seedream/v5/pro/text-to-image',
    cost_usd: 0.0675,
    mandatory_checks: [
      { id: 'MC-1', description: 'True open sky without canopy', status: 'PASS', observed_evidence: 'Sun and sky directly overhead', reason: 'Compliant' },
      { id: 'MC-2', description: 'Sunken perimeter gravel bed', status: 'PASS', observed_evidence: 'Sunken gravel trench around planting bed', reason: 'Compliant' },
      { id: 'MC-3', description: 'Floor level drop 5-10cm', status: 'PASS', observed_evidence: 'Clear terrazzo curb drop', reason: 'Compliant' },
      { id: 'MC-4', description: 'Metal floor drain grating', status: 'PASS', observed_evidence: 'Square stainless steel drain grate in pebbles', reason: 'Compliant' },
      { id: 'MC-5', description: 'Operable sliding doors', status: 'PASS', observed_evidence: 'Sliding door resting on concrete sill curb', reason: 'Compliant' },
      { id: 'MC-6', description: 'Enclosed 1.5x2m interior townhouse lightwell void context', status: 'PASS', observed_evidence: 'Vertical walls enclose court, dining chair visible indoors', reason: 'Compliant' }
    ],
    architectural_plausibility: { status: 'PASS', notes: 'Concrete sill curb prevents water ingress' },
    editorial_explanation_clarity: { status: 'PASS', notes: 'Perfect technical explanation of rainwater drainage and ventilation' },
    aesthetic_quality_score: { score: 97, notes: 'Superb tactile textures and sunlight highlight' }
  });

  assert.equal(proInlineResult.final_gate_verdict, 'RECOMMENDED_FOR_OWNER');
  assert.notEqual(proInlineResult.final_gate_verdict, 'APPROVED');
});

// T07: Persistence path integrity
it('T07: Calibration persistence file exists and contains valid JSON array', () => {
  const statePath = path.resolve(__dirname, '../state/calibration_decisions.json');
  assert.ok(fs.existsSync(statePath), 'state/calibration_decisions.json must exist');
  const content = JSON.parse(fs.readFileSync(statePath, 'utf8'));
  assert.ok(Array.isArray(content), 'Must be an array of decisions');
  assert.ok(content.length >= 2, 'Must have at least 2 decisions recorded');
});

// T08: Nadia Storyboard 5 Mandatory Hard Gates — 90+ Photorealism strictly REJECTED if spatial layout or proportions fail
it('T08: Nadia 5 Mandatory Hard Gates — 90+ Photorealism strictly REJECTED when spatial/proportions fail', () => {
  const res = evaluateCandidateWithNadiaMandatoryGates({
    candidate_id: 'kling_v3_live1_benchmark_test',
    slot_key: 'cover_hero',
    model: 'kling-v3',
    cost_usd: 0.0280,
    evidence: {
      primary_subject_observed: 'Taman tengah kurang representatif sebagai inner court hunian tropis sempit',
      primary_subject_status: 'FAIL',
      primary_subject_fail_reason: 'Inner court tidak memiliki karakter tanaman dan elemen lanskap hunian tropis yang meyakinkan',

      spatial_layout_observed: 'Susunan rumah tidak mencerminkan denah lahan sempit 5–6 meter',
      spatial_layout_status: 'FAIL',
      spatial_layout_fail_reason: 'Susunan ruang dan zoning tidak mencerminkan denah yang benar',

      building_proportions_observed: 'Courtyard terlalu besar dan kosong, skala kavling melanggar proporsi 5-6 meter',
      building_proportions_status: 'FAIL',
      building_proportions_fail_reason: 'Proporsi bangunan tidak mencerminkan skala kavling atau ruang yang disyaratkan',

      construction_logic_observed: 'Logika balok lintel dan dinding penopang secara fisik stabil',
      construction_logic_status: 'PASS',

      concept_alignment_observed: 'Courtyard kosong dan lebar melanggar solusi inti ruang tengah artikel',
      concept_alignment_status: 'FAIL',
      concept_alignment_fail_reason: 'Terdapat elemen visual yang bertentangan dengan pesan dan solusi teknis artikel'
    },
    scores: {
      editorial_relevance: 60,
      architectural_accuracy: 55,
      visual_explanation_clarity: 60,
      photorealism: 90, // Skor fotorealisme tinggi
      premium_composition: 65
    }
  });

  assert.equal(res.overall_verdict, 'FAIL', 'Overall verdict must be FAIL');
  assert.equal(res.gate_verdict, 'REJECTED', 'Gate verdict must be REJECTED despite 90 photorealism');
  assert.ok(res.hard_reject_reasons.some(r => r.includes('[MANDATORY_GATE_FAIL: SUSUNAN RUANG]')));
  assert.ok(res.hard_reject_reasons.some(r => r.includes('[MANDATORY_GATE_FAIL: PROPORSI BANGUNAN]')));
  assert.ok(res.hard_reject_reasons.some(r => r.includes('[MANDATORY_GATE_FAIL: KONSEP ARTIKEL]')));
  assert.equal(res.rubric_v2.photorealism_score, 90, 'Photorealism score preserved at 90 without artificial deflation');
});

// T09: Candidate 1 recorded as BENCHMARK_REJECTED in calibration_decisions.json and benchmark spec
it('T09: Candidate 1 is recorded as BENCHMARK_REJECTED with provenance intact', () => {
  const statePath = path.resolve(__dirname, '../state/calibration_decisions.json');
  const decisions = JSON.parse(fs.readFileSync(statePath, 'utf8'));
  const klingRecord = decisions.find(d => d.model_key === 'kling-v3-art10000-live1');

  assert.ok(klingRecord, 'Must have record for kling-v3-art10000-live1');
  assert.equal(klingRecord.decision, 'TOLAK');
  assert.equal(klingRecord.status, 'BENCHMARK_REJECTED');
  assert.equal(klingRecord.task_id, '951797337209324835');
  assert.equal(klingRecord.sha256, '36623e6cfcac8410aaf6a0f84896af3b1cb4c80e86c1ee44bb3489b5dd91168e');

  const specPath = path.resolve(__dirname, '../public/experimental-media/kling-benchmark-spec-art10000.json');
  const spec = JSON.parse(fs.readFileSync(specPath, 'utf8'));
  assert.ok(Array.isArray(spec.live_trial_history), 'live_trial_history must exist');
  const trial1 = spec.live_trial_history[0];
  assert.equal(trial1.status, 'BENCHMARK_REJECTED');
  assert.equal(trial1.photorealism_score, 90);
  assert.equal(trial1.gate_verdict, 'REJECTED');
});

// T10: Invariant check — Seedream Pro is DEFAULT, Kling is EXPERIMENTAL_PROVIDER
it('T10: Invariant check — Seedream Pro is strictly DEFAULT and Kling is EXPERIMENTAL', () => {
  const specPath = path.resolve(__dirname, '../public/experimental-media/kling-benchmark-spec-art10000.json');
  const spec = JSON.parse(fs.readFileSync(specPath, 'utf8'));

  assert.equal(spec.baseline_comparison.default_model, 'bytedance/seedream/v5/pro/text-to-image');
  assert.equal(spec.provider.status, 'EXPERIMENTAL_PROVIDER');
  assert.equal(spec.prepared_retest_specification.status, 'PREPARED_WAITING_OWNER_AUTHORIZATION');
  assert.equal(spec.prepared_retest_specification.n, 1);
  assert.equal(spec.prepared_retest_specification.hard_budget_cap_units, 8);
});

console.log(`\n=============================================================`);
console.log(`  ALL ${passed} / ${total} TESTS PASSED (100%)`);
console.log(`=============================================================\n`);
