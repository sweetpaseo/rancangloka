/**
 * RancangLoka — Editorial Visual Intelligence (EVI) Test Suite (LOKAMEDIA-EVI-1)
 *
 * Verifies:
 * 1. EditorialVisualBrief structure & mandatory fields.
 * 2. Visual Subject Priority enforcement (physical evidence vs clean slop).
 * 3. Architectural Geometry QA (8 criteria, decking joints, perspective, scale).
 * 4. Image Format QA (16:9 crop calculations, safe framing, focal bias).
 * 5. Batch 1 Canonical Briefs & Prompt Synthesis fidelity.
 * 6. Candidate Ledger integrity, PENDING_REVIEW invariants, and zero auto-promotion.
 */

import assert from 'node:assert';
import fs from 'node:fs';
import path from 'node:path';
import {
  BATCH_1_CANONICAL_BRIEFS,
  synthesizeEviPrompt,
  calculate16to9Crop,
  evaluateVisualSubjectPriority,
  evaluateArchitecturalGeometryQA
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

// 3. Architectural Geometry QA
console.log('\n[3] Architectural Geometry QA:');

it('evaluates all 8 architectural geometry criteria', () => {
  const qa = evaluateArchitecturalGeometryQA(9993, 'FLUX');
  assert.ok('deckingJoints' in qa);
  assert.ok('spatialPerspective' in qa);
  assert.ok('doorWindowGeometry' in qa);
  assert.ok('railingPosition' in qa);
  assert.ok('structuralConsistency' in qa);
  assert.ok('lightingAndShadow' in qa);
  assert.ok('materialForm' in qa);
  assert.ok('damageRealism' in qa);
  assert.ok('overallStatus' in qa);
});

it('flags SDXL candidate for Article #9999 as NEEDS_REGENERATION due to wood decking joint defect', () => {
  const qa = evaluateArchitecturalGeometryQA(9999, 'SDXL');
  assert.strictEqual(qa.deckingJoints, 'FAIL');
  assert.strictEqual(qa.overallStatus, 'NEEDS_REGENERATION');
  assert.ok(qa.notes.includes('Cacat geometri: Pola sambungan lantai kayu'));
});

it('approves FLUX candidate for Article #9999 as APPROVED_PREFERRED with clean decking', () => {
  const qa = evaluateArchitecturalGeometryQA(9999, 'FLUX');
  assert.strictEqual(qa.deckingJoints, 'PASS');
  assert.strictEqual(qa.overallStatus, 'APPROVED_PREFERRED');
  assert.ok(qa.notes.includes('Pilihan Editorial'));
});

it('approves SDXL candidate for Article #10000 as APPROVED_PREFERRED with interior visualization caveat', () => {
  const qa = evaluateArchitecturalGeometryQA(10000, 'SDXL');
  assert.strictEqual(qa.spatialPerspective, 'PASS');
  assert.strictEqual(qa.overallStatus, 'APPROVED_PREFERRED');
  assert.ok(qa.notes.includes('bukan denah teknis 2D'));
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
  assert.strictEqual(crop.cropTopPercent, 38.75); // 100 - 56.25 - 5
  assert.strictEqual(crop.subjectFocalPointY, 'bottom');
});

it('preserves native 16:9 dimensions without unnecessary crop', () => {
  const crop = calculate16to9Crop(1280, 720, 'center');
  assert.strictEqual(crop.cropHeightPercent, 100);
  assert.strictEqual(crop.cropTopPercent, 0);
});

// 5. Candidate Ledger & Safety Governance
console.log('\n[5] Candidate Ledger & Safety Governance:');

it('loads candidates ledger with complete candidate entries', () => {
  const ledger = loadCandidatesLedger();
  assert.ok(Array.isArray(ledger), 'Ledger is not an array');
  assert.ok(ledger.length >= 6, `Expected at least 6 candidates, found ${ledger.length}`);
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

it('verifies no candidate has automatically mutated articles in database', () => {
  const ledger = loadCandidatesLedger();
  for (const c of ledger) {
    assert.strictEqual(c.approval_status, 'PENDING_REVIEW', `Candidate ${c.id} was prematurely approved`);
  }
});

console.log('\n' + '='.repeat(70));
console.log(`ALL ${passed}/${total} EVI TESTS PASSED SUCCESSFULLY.`);
console.log('='.repeat(70));
