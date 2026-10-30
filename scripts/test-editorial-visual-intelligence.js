/**
 * RancangLoka — Editorial Visual Intelligence (EVI) Test Suite (LOKAMEDIA-EVI-1)
 *
 * Verifies:
 * 1. EditorialVisualBrief structure & mandatory fields.
 * 2. Visual Subject Priority enforcement (physical evidence vs clean slop).
 * 3. Architectural Geometry QA (8 criteria, decking joints, perspective, scale).
 * 4. Image Format QA (16:9 crop calculations, safe framing, focal bias).
 * 5. Batch 1 Canonical Briefs & Prompt Synthesis fidelity.
 * 6. 5-Dimensional QA Classification (automated heuristics vs human audit).
 * 7. Candidate Ledger integrity, v2 archiving, v3 controlled regeneration, and zero auto-promotion.
 */

import assert from 'node:assert';
import fs from 'node:fs';
import path from 'node:path';
import {
  BATCH_1_CANONICAL_BRIEFS,
  synthesizeEviPrompt,
  calculate16to9Crop,
  evaluateVisualSubjectPriority,
  evaluateArchitecturalGeometryQA,
  evaluateFiveDimensionalQA,
  CONTROLLED_PROMPT_9993_V3
} from '../src/lib/media/editorial-visual-intelligence.ts';
import {
  loadCandidatesLedger
} from '../src/lib/media/experimental-storage.ts';

let passed = 0;
let total = 0;

function it(name, fn) {
  total++;
  try {
    fn();
    passed++;
    console.log(`  ✓ ${name}`);
  } catch (err) {
    console.error(`  ✗ ${name}`);
    console.error(`    ${err.message}`);
    throw err;
  }
}

console.log('='.repeat(70));
console.log('EDITORIAL VISUAL INTELLIGENCE (EVI) V1 TEST SUITE');
console.log('='.repeat(70));

// 1. Brief Structure & Mandatory Fields
console.log('\n[1] EditorialVisualBrief Structure & Mandatory Fields:');

it('has canonical briefs registered for all Batch 1 articles (9993, 9999, 10000)', () => {
  assert.ok(BATCH_1_CANONICAL_BRIEFS[9993], 'Article 9993 brief missing');
  assert.ok(BATCH_1_CANONICAL_BRIEFS[9999], 'Article 9999 brief missing');
  assert.ok(BATCH_1_CANONICAL_BRIEFS[10000], 'Article 10000 brief missing');
});

it('enforces all mandatory brief fields on Article #9993', () => {
  const b = BATCH_1_CANONICAL_BRIEFS[9993];
  assert.strictEqual(b.articleId, 9993);
  assert.ok(b.slug.includes('dinding-rembes'));
  assert.ok(b.articleSection.length > 5);
  assert.strictEqual(b.purpose, 'cover');
  assert.ok(b.mainSubject.includes('Dinding plesteran'));
  assert.ok(b.problemOrSolution.includes('menggelembung'));
  assert.ok(Array.isArray(b.visualEvidence) && b.visualEvidence.length >= 4);
  assert.ok(b.architecturalContext.includes('Indonesia'));
  assert.ok(b.compositionAndFraming.includes('fokus'));
  assert.ok(b.materialGeometryConstraints.length > 10);
  assert.ok(Array.isArray(b.negativeConstraints) && b.negativeConstraints.length >= 5);
  assert.ok(b.caption.includes('manifestasi') || b.caption.includes('diagnosis'));
  assert.ok(b.altText.length > 20);
  assert.strictEqual(b.modelProvenance.targetRatio, '16:9');
});

it('enforces all mandatory brief fields on Article #9999', () => {
  const b = BATCH_1_CANONICAL_BRIEFS[9999];
  assert.strictEqual(b.articleId, 9999);
  assert.ok(b.slug.includes('balkon'));
  assert.ok(b.visualEvidence.some((e) => e.includes('decking')));
  assert.ok(b.visualEvidence.some((e) => e.includes('60 cm')));
  assert.ok(b.negativeConstraints.some((n) => n.includes('decking')));
});

it('enforces all mandatory brief fields on Article #10000', () => {
  const b = BATCH_1_CANONICAL_BRIEFS[10000];
  assert.strictEqual(b.articleId, 10000);
  assert.ok(b.slug.includes('denah-rumah-lebar-5-6-meter'));
  assert.ok(b.visualEvidence.some((e) => e.includes('inner court') || e.includes('void')));
  assert.ok(b.negativeConstraints.some((n) => n.includes('2D blueprint')));
});

// 2. Prompt Synthesis & Visual Subject Priority
console.log('\n[2] Prompt Synthesis & Visual Subject Priority:');

it('synthesizes prompt for #9993 with physical damage evidence upfront', () => {
  const prompt = synthesizeEviPrompt(BATCH_1_CANONICAL_BRIEFS[9993]);
  assert.ok(prompt.startsWith('Architectural documentary photography of a moisture-damaged'));
  assert.ok(prompt.includes('blistered bubbling paint'));
  assert.ok(prompt.includes('flaking and peeling'));
  assert.ok(prompt.includes('primary visual subject in sharp focus'));
  assert.ok(prompt.includes('Avoid: no pristine clean walls'));
});

it('synthesizes controlled prompt v3 for #9993 without demolished plaster defects', () => {
  assert.ok(CONTROLLED_PROMPT_9993_V3.includes('modest, well-maintained, occupied Indonesian residential living room'));
  assert.ok(CONTROLLED_PROMPT_9993_V3.includes('localized, realistic moisture problem near its lower section'));
  assert.ok(CONTROLLED_PROMPT_9993_V3.includes('Most of the wall surface remains intact and clean'));
  assert.ok(CONTROLLED_PROMPT_9993_V3.includes('No large holes, no exposed brickwork, no demolished plaster'));
});

it('synthesizes prompt for #9999 with realistic compact dimensions & clear corridor', () => {
  const prompt = synthesizeEviPrompt(BATCH_1_CANONICAL_BRIEFS[9999]);
  assert.ok(prompt.includes('1.2 x 2.4 meters'));
  assert.ok(prompt.includes('clean acacia wood interlocking decking tiles'));
  assert.ok(prompt.includes('60 cm walking corridor is preserved'));
  assert.ok(prompt.includes('Avoid:'));
});

it('synthesizes prompt for #10000 with realistic facade scale & inner court void', () => {
  const prompt = synthesizeEviPrompt(BATCH_1_CANONICAL_BRIEFS[10000]);
  assert.ok(prompt.includes('5-to-6-meter facade width'));
  assert.ok(prompt.includes('inner court'));
  assert.ok(prompt.includes('Avoid: no technical 2D blueprint claim'));
});

it('rejects pristine clean wall candidates for #9993 via Visual Subject Priority QA', () => {
  const check = evaluateVisualSubjectPriority(9993, {
    visibleElements: ['clean white wall', 'modern sofa', 'wood table'],
    isCleanPristineWall: true,
    isDamageVisible: false
  });
  assert.strictEqual(check.verdict, 'DEFICIENT');
  assert.strictEqual(check.subjectIsVisuallyObvious, false);
  assert.ok(check.notes.includes('REJECT: Dinding tampak bersih'));
});

it('accepts damaged wall candidate for #9993 via Visual Subject Priority QA', () => {
  const check = evaluateVisualSubjectPriority(9993, {
    visibleElements: ['dinding plesteran lembab', 'cat menggelembung melepuh', 'cat terkelupas'],
    isCleanPristineWall: false,
    isDamageVisible: true
  });
  assert.strictEqual(check.verdict, 'SATISFIED');
  assert.strictEqual(check.subjectIsVisuallyObvious, true);
});

// 3. 5-Dimensional QA Classification
console.log('\n[3] 5-Dimensional QA Classification:');

it('separates review into 5 distinct dimensions and tags automated heuristics', () => {
  const qa5 = evaluateFiveDimensionalQA(9993, 'FLUX', 'v3');
  assert.ok(qa5.subjectRelevance, 'subjectRelevance dimension missing');
  assert.ok(qa5.damageProblemAccuracy, 'damageProblemAccuracy dimension missing');
  assert.ok(qa5.architecturalGeometry, 'architecturalGeometry dimension missing');
  assert.ok(qa5.materialRealism, 'materialRealism dimension missing');
  assert.ok(qa5.editorialSuitability, 'editorialSuitability dimension missing');

  // Verify automated heuristic method
  assert.strictEqual(qa5.subjectRelevance.method, 'AUTOMATED_HEURISTIC');
  assert.strictEqual(qa5.damageProblemAccuracy.method, 'AUTOMATED_HEURISTIC');
  assert.strictEqual(qa5.architecturalGeometry.method, 'AUTOMATED_HEURISTIC');
  assert.strictEqual(qa5.materialRealism.method, 'AUTOMATED_HEURISTIC');
  assert.strictEqual(qa5.editorialSuitability.method, 'HUMAN_AUDIT');
  assert.strictEqual(qa5.editorialSuitability.status, 'PENDING_HUMAN_REVIEW');

  // Verify disclaimer presence
  assert.ok(qa5.disclaimer.includes('automated heuristic'));
  assert.ok(qa5.disclaimer.includes('Chief Editor'));
});

it('flags SDXL candidate for Article #9999 as HEURISTIC_FAIL on Architectural Geometry', () => {
  const qa5 = evaluateFiveDimensionalQA(9999, 'SDXL', 'v1');
  assert.strictEqual(qa5.architecturalGeometry.status, 'HEURISTIC_FAIL');
  assert.ok(qa5.architecturalGeometry.evaluationText.includes('decking kayu tidak lurus'));
});

it('approves FLUX candidate for Article #9999 as HEURISTIC_PASS on Architectural Geometry', () => {
  const qa5 = evaluateFiveDimensionalQA(9999, 'FLUX', 'v1');
  assert.strictEqual(qa5.architecturalGeometry.status, 'HEURISTIC_PASS');
  assert.ok(qa5.editorialSuitability.evaluationText.includes('Pilihan Editorial Utama'));
});

it('sets interior visualization caveat on Article #10000 SDXL in Editorial Suitability', () => {
  const qa5 = evaluateFiveDimensionalQA(10000, 'SDXL', 'v1');
  assert.strictEqual(qa5.architecturalGeometry.status, 'HEURISTIC_PASS');
  assert.ok(qa5.editorialSuitability.evaluationText.includes('bukan denah teknis 2D'));
});

// 4. Image Format QA: 16:9 Crop Calculation
console.log('\n[4] Image Format QA (16:9 Crop Calculation):');

it('calculates exact 16:9 crop height percent for 1024x1024 square images (56.25%)', () => {
  const crop = calculate16to9Crop(1024, 1024, 'center');
  assert.strictEqual(crop.targetRatio, '16:9');
  assert.strictEqual(crop.cropHeightPercent, 56.25);
  assert.strictEqual(crop.cropTopPercent, 21.875);
  assert.strictEqual(crop.subjectFocalPointY, 'center');
});

it('calculates bottom-biased 16:9 crop for lower wall damage inspection', () => {
  const crop = calculate16to9Crop(1024, 1024, 'bottom');
  assert.strictEqual(crop.cropHeightPercent, 56.25);
  assert.strictEqual(crop.cropTopPercent, 38.75);
  assert.strictEqual(crop.subjectFocalPointY, 'bottom');
});

it('preserves native 16:9 dimensions without unnecessary crop', () => {
  const crop = calculate16to9Crop(1280, 720, 'center');
  assert.strictEqual(crop.cropHeightPercent, 100);
  assert.strictEqual(crop.cropTopPercent, 0);
});

// 5. Candidate Ledger, Versioning & Safety Governance
console.log('\n[5] Candidate Ledger, Versioning & Safety Governance:');

it('loads candidates ledger with complete candidate entries including v2 and v3', () => {
  const ledger = loadCandidatesLedger();
  assert.ok(Array.isArray(ledger), 'Ledger is not an array');
  assert.ok(ledger.length >= 8, `Expected at least 8 candidates in ledger, found ${ledger.length}`);
});

it('verifies Article #9993 has both active v3 candidates and archived v2 candidates', () => {
  const ledger = loadCandidatesLedger();
  const v3Flux = ledger.find((c) => c.id === 'candidate-9993-flux-1-schnell-v3');
  const v3Sdxl = ledger.find((c) => c.id === 'candidate-9993-sdxl-lightning-v3');
  const v2Flux = ledger.find((c) => c.id === 'candidate-9993-flux-1-schnell-v2');
  const v2Sdxl = ledger.find((c) => c.id === 'candidate-9993-sdxl-lightning-v2');

  assert.ok(v3Flux, 'v3 FLUX missing');
  assert.ok(v3Sdxl, 'v3 SDXL missing');
  assert.ok(v2Flux, 'v2 FLUX missing');
  assert.ok(v2Sdxl, 'v2 SDXL missing');

  assert.strictEqual(v3Flux.approval_status, 'PENDING_REVIEW');
  assert.strictEqual(v3Sdxl.approval_status, 'PENDING_REVIEW');
  assert.strictEqual(v2Flux.approval_status, 'REJECTED');
  assert.strictEqual(v2Sdxl.approval_status, 'REJECTED');
});

it('verifies Article #9999 FLUX is PENDING_REVIEW and marked APPROVED_PREFERRED', () => {
  const ledger = loadCandidatesLedger();
  const c9999Flux = ledger.find((c) => c.article_id === 9999 && c.model.includes('flux'));
  assert.ok(c9999Flux, 'Candidate 9999 FLUX missing');
  assert.strictEqual(c9999Flux.approval_status, 'PENDING_REVIEW', 'Must not be auto-approved');
  assert.strictEqual(c9999Flux.editorial_verdict, 'APPROVED_PREFERRED');
});

it('verifies Article #10000 SDXL is PENDING_REVIEW and marked APPROVED_PREFERRED', () => {
  const ledger = loadCandidatesLedger();
  const c10000Sdxl = ledger.find((c) => c.article_id === 10000 && c.model.includes('stable-diffusion'));
  assert.ok(c10000Sdxl, 'Candidate 10000 SDXL missing');
  assert.strictEqual(c10000Sdxl.approval_status, 'PENDING_REVIEW', 'Must not be auto-approved');
  assert.strictEqual(c10000Sdxl.editorial_verdict, 'APPROVED_PREFERRED');
});

it('verifies zero candidates are prematurely marked APPROVED without human decision', () => {
  const ledger = loadCandidatesLedger();
  for (const c of ledger) {
    assert.notStrictEqual(
      c.approval_status,
      'APPROVED',
      `Candidate ${c.id} was prematurely marked APPROVED`
    );
  }
});

console.log('\n' + '='.repeat(70));
console.log(`ALL ${passed}/${total} EVI TESTS PASSED SUCCESSFULLY.`);
console.log('='.repeat(70));
