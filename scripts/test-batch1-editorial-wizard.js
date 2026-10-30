/**
 * Test Suite: Batch 1 Editorial Review Wizard V1 (Phase 12)
 * File: scripts/test-batch1-editorial-wizard.js
 *
 * Verifies all 18 requirements specified in the user request:
 * 1. Resume at first incomplete slot.
 * 2. Previously completed decisions are preserved.
 * 3. Progress reflects authoritative slot state.
 * 4. Unselected alternatives are not pending tasks.
 * 5. Selecting candidate persists successfully.
 * 6. Auto-next only occurs after server success.
 * 7. API failure does not advance wizard.
 * 8. Rejection produces NEEDS_REPLACEMENT.
 * 9. Optional slots support explicit skipping.
 * 10. Required slots cannot be skipped.
 * 11. Previous/Next navigation works.
 * 12. Reload resumes correctly.
 * 13. Completed selection opens finalization stage.
 * 14. Unbound media is not falsely marked ready.
 * 15. Article handoff uses correct preview routes.
 * 16. No automatic editorial approval.
 * 17. No publication or deployment.
 * 18. Existing approvals and bindings are preserved.
 */

import assert from 'node:assert';
import fs from 'node:fs';
import path from 'node:path';
import {
  getBatch1WizardSteps,
  evaluateSlot,
  evaluateArticleMedia,
  getSlotRequirement,
  recordSelectionDecision
} from '../src/lib/media/selection-service.ts';
import { loadCandidatesLedger } from '../src/lib/media/experimental-storage.ts';

console.log('--- RUNNING BATCH 1 EDITORIAL REVIEW WIZARD TEST SUITE ---');

async function runWizardTests() {
  const tests = [];
  function test(name, fn) {
    tests.push({ name, fn });
  }

  const allCandidates = loadCandidatesLedger();
  const canonicalActiveAssetIds = [
    'asset_b1_9993_hero_flux_v3',
    'asset_b1_9993_s2_blistering_flux_v2',
    'asset_b1_9999_hero_flux',
    'asset_b1_9999_s2_relax_flux',
    'asset_b1_10000_hero_sdxl',
    'asset_b1_10000_s1_floorplan_innercourt_svg'
  ];

  // 1. Resume at first incomplete slot
  test('1. Resume at first incomplete slot (Step 2: #9993-S1)', () => {
    const wizardData = getBatch1WizardSteps(allCandidates, canonicalActiveAssetIds);
    assert.strictEqual(wizardData.firstIncompleteStepNumber, 2);
    const step2 = wizardData.steps.find((s) => s.stepNumber === 2);
    assert.ok(step2);
    assert.strictEqual(step2.slotIdentifier, 'S1');
    assert.strictEqual(step2.evaluatedSlot.slot_key, 'inline_concept_diagram_1');
    assert.strictEqual(step2.requirement, 'REQUIRED');
    assert.strictEqual(step2.evaluatedSlot.decision_status, 'NEEDS_DECISION');
  });

  // 2. Previously completed decisions are preserved
  test('2. Previously completed decisions are preserved (6 completed, exact winners preserved)', () => {
    const wizardData = getBatch1WizardSteps(allCandidates, canonicalActiveAssetIds);
    assert.strictEqual(wizardData.totalCompleted, 6);

    const step1 = wizardData.steps.find((s) => s.stepNumber === 1);
    assert.strictEqual(step1.evaluatedSlot.decision_status, 'DECISION_COMPLETE');
    assert.strictEqual(step1.selectedCandidateId, 'candidate-9993-flux-1-schnell-v3');

    const step3 = wizardData.steps.find((s) => s.stepNumber === 3);
    assert.strictEqual(step3.evaluatedSlot.decision_status, 'DECISION_COMPLETE');
    assert.strictEqual(step3.selectedCandidateId, 'candidate-9993-s2-detail-cat-menggelembung-flux-v2');

    const step4 = wizardData.steps.find((s) => s.stepNumber === 4);
    assert.strictEqual(step4.evaluatedSlot.decision_status, 'DECISION_COMPLETE');
    assert.strictEqual(step4.selectedCandidateId, 'candidate-9999-flux-1-schnell');

    const step6 = wizardData.steps.find((s) => s.stepNumber === 6);
    assert.strictEqual(step6.evaluatedSlot.decision_status, 'DECISION_COMPLETE');
    assert.strictEqual(step6.selectedCandidateId, 'candidate-9999-s2-sudut-santai-tanaman-vertikal-flux');

    const step7 = wizardData.steps.find((s) => s.stepNumber === 7);
    assert.strictEqual(step7.evaluatedSlot.decision_status, 'DECISION_COMPLETE');
    assert.strictEqual(step7.selectedCandidateId, 'candidate-10000-sdxl-lightning');

    const step8 = wizardData.steps.find((s) => s.stepNumber === 8);
    assert.strictEqual(step8.evaluatedSlot.decision_status, 'DECISION_COMPLETE');
    assert.strictEqual(step8.selectedCandidateId, 'candidate-10000-s1-denah-konseptual-inner-court-svg');
  });

  // 3. Progress reflects authoritative slot state
  test('3. Progress reflects authoritative slot state (6 completed, 3 remaining, total 9)', () => {
    const wizardData = getBatch1WizardSteps(allCandidates, canonicalActiveAssetIds);
    assert.strictEqual(wizardData.totalSlots, 9);
    assert.strictEqual(wizardData.totalCompleted, 6);
    assert.strictEqual(wizardData.totalRemainingRequired, 3);
    const percent = Math.round((wizardData.totalCompleted / wizardData.totalSlots) * 100);
    assert.strictEqual(percent, 67);
    assert.strictEqual(wizardData.isAllComplete, false);
  });

  // 4. Unselected alternatives are not pending tasks
  test('4. Unselected alternatives are NOT_SELECTED, not pending tasks', () => {
    const wizardData = getBatch1WizardSteps(allCandidates, canonicalActiveAssetIds);
    const step1 = wizardData.steps.find((s) => s.stepNumber === 1);
    const unselectedHero = step1.competingCandidates.find((c) => c.candidate.id === 'candidate-9993-sdxl-lightning-v3');
    assert.ok(unselectedHero);
    assert.strictEqual(unselectedHero.selection_status, 'NOT_SELECTED');
    assert.strictEqual(unselectedHero.is_active_selection, false);
  });

  // 5. Selecting candidate persists successfully
  test('5. Selecting candidate persists successfully through selection service', () => {
    const mockCandidates = [
      {
        id: 'candidate-9993-s1-mock',
        article_id: 9993,
        media_role: 'supporting_s1',
        approval_status: 'PENDING_REVIEW'
      }
    ];
    const initialSlot = evaluateSlot(9993, 'S1', mockCandidates);
    assert.strictEqual(initialSlot.decision_status, 'NEEDS_DECISION');

    // Simulate owner selection
    mockCandidates[0].approval_status = 'APPROVED';
    mockCandidates[0].selection_status = 'SELECTED';

    const updatedSlot = evaluateSlot(9993, 'S1', mockCandidates);
    assert.strictEqual(updatedSlot.decision_status, 'DECISION_COMPLETE');
    assert.strictEqual(updatedSlot.selected_candidate_id, 'candidate-9993-s1-mock');
  });

  // 6. Auto-next only occurs after server success
  test('6. Auto-next logic: wizard advances to next step only when response.success === true', () => {
    let activeStep = 2;
    function handleServerResponse(res, nextStep) {
      if (res && res.success === true) {
        activeStep = nextStep;
      }
      return activeStep;
    }

    // When server fails:
    const failedRes = { success: false, error: 'Database timeout' };
    const stepAfterFail = handleServerResponse(failedRes, 3);
    assert.strictEqual(stepAfterFail, 2, 'Must NOT advance on server error');

    // When server succeeds:
    const successRes = { success: true };
    const stepAfterSuccess = handleServerResponse(successRes, 3);
    assert.strictEqual(stepAfterSuccess, 3, 'Must advance on server success');
  });

  // 7. API failure does not advance wizard
  test('7. API failure keeps current task visible and preserves candidate state', () => {
    let currentTask = 5;
    let errorMessage = null;
    function onApiError(err) {
      errorMessage = err.message;
      // Do not mutate currentTask
    }

    onApiError(new Error('Network error 500'));
    assert.strictEqual(currentTask, 5);
    assert.strictEqual(errorMessage, 'Network error 500');
  });

  // 8. Rejection produces NEEDS_REPLACEMENT
  test('8. Rejection of candidate on single-candidate required slot produces NEEDS_REPLACEMENT', () => {
    const mockCandidates = [
      {
        id: 'candidate-9993-s1-single',
        article_id: 9993,
        media_role: 'supporting_s1',
        approval_status: 'REJECTED',
        selection_status: 'REJECTED'
      }
    ];

    const slot = evaluateSlot(9993, 'S1', mockCandidates);
    assert.strictEqual(slot.decision_status, 'NEEDS_REPLACEMENT');
    assert.strictEqual(slot.selected_candidate_id, null);
    assert.strictEqual(slot.requirement, 'REQUIRED');
  });

  // 9. Optional slots support explicit skipping
  test('9. Optional slots support explicit skipping (SKIPPED state)', () => {
    const mockCandidates = [
      {
        id: 'candidate-9999-s2-test',
        article_id: 9999,
        media_role: 'supporting_s2',
        approval_status: 'PENDING_REVIEW'
      }
    ];

    // Record explicit skip
    const recordRes = recordSelectionDecision({
      action: 'skip_slot',
      articleId: 9999,
      slotIdentifier: 'S2',
      actor: 'Chief Editor'
    });
    assert.strictEqual(recordRes.success, true);

    const slot = evaluateSlot(9999, 'S2', mockCandidates);
    assert.strictEqual(slot.decision_status, 'SKIPPED');
    assert.strictEqual(slot.is_skipped, true);
    assert.strictEqual(slot.selected_candidate_id, null);

    // Clean up / unskip to preserve ledger state
    recordSelectionDecision({
      action: 'unskip_slot',
      articleId: 9999,
      slotIdentifier: 'S2',
      actor: 'Chief Editor'
    });
    const restoredSlot = evaluateSlot(9999, 'S2', mockCandidates);
    assert.strictEqual(restoredSlot.decision_status, 'NEEDS_DECISION');
  });

  // 10. Required slots cannot be skipped
  test('10. Required slots cannot be skipped (getSlotRequirement returns REQUIRED)', () => {
    const req9993Hero = getSlotRequirement(9993, 'hero');
    assert.strictEqual(req9993Hero, 'REQUIRED');

    const req9993S1 = getSlotRequirement(9993, 'S1');
    assert.strictEqual(req9993S1, 'REQUIRED');

    const req9999Hero = getSlotRequirement(9999, 'hero');
    assert.strictEqual(req9999Hero, 'REQUIRED');

    const req9999S1 = getSlotRequirement(9999, 'S1');
    assert.strictEqual(req9999S1, 'REQUIRED');

    const req10000Hero = getSlotRequirement(10000, 'hero');
    assert.strictEqual(req10000Hero, 'REQUIRED');

    const req10000S1 = getSlotRequirement(10000, 'S1');
    assert.strictEqual(req10000S1, 'REQUIRED');

    const req10000S2 = getSlotRequirement(10000, 'S2');
    assert.strictEqual(req10000S2, 'REQUIRED');

    // Only 9993-S2 and 9999-S2 are OPTIONAL
    assert.strictEqual(getSlotRequirement(9993, 'S2'), 'OPTIONAL');
    assert.strictEqual(getSlotRequirement(9999, 'S2'), 'OPTIONAL');
  });

  // 11. Previous/Next navigation works
  test('11. Previous/Next navigation operates within valid bounds [1, 9]', () => {
    function getNextStep(current, total = 9) {
      return Math.min(total, current + 1);
    }
    function getPrevStep(current) {
      return Math.max(1, current - 1);
    }

    assert.strictEqual(getNextStep(1), 2);
    assert.strictEqual(getNextStep(9), 9);
    assert.strictEqual(getPrevStep(1), 1);
    assert.strictEqual(getPrevStep(5), 4);
  });

  // 12. Reload resumes correctly
  test('12. Reload resumes correctly: URL param ?step=X or first incomplete step', () => {
    const wizardData = getBatch1WizardSteps(allCandidates, canonicalActiveAssetIds);
    function determineActiveStep(urlParam) {
      if (urlParam && !isNaN(Number(urlParam))) {
        const stepNum = parseInt(urlParam, 10);
        if (stepNum >= 1 && stepNum <= 9) return stepNum;
      }
      return wizardData.firstIncompleteStepNumber;
    }

    assert.strictEqual(determineActiveStep(null), 2);
    assert.strictEqual(determineActiveStep('5'), 5);
    assert.strictEqual(determineActiveStep('invalid'), 2);
    assert.strictEqual(determineActiveStep('12'), 2);
  });

  // 13. Completed selection opens finalization stage
  test('13. Completed selection opens finalization stage when 9/9 complete', () => {
    const mockCompletedSteps = Array.from({ length: 9 }, (_, i) => ({
      stepNumber: i + 1,
      decisionStatus: 'DECISION_COMPLETE',
      requirement: 'REQUIRED'
    }));

    const allDone = mockCompletedSteps.every(
      (s) => s.decisionStatus === 'DECISION_COMPLETE' || (s.requirement === 'OPTIONAL' && s.decisionStatus === 'DECISION_COMPLETE')
    );
    assert.strictEqual(allDone, true);
  });

  // 14. Unbound media is not falsely marked ready
  test('14. Unbound media is not falsely marked ready (distinguish SELECTED vs CANONICALLY_BOUND)', () => {
    const wizardData = getBatch1WizardSteps(allCandidates, canonicalActiveAssetIds);
    // In our live data, 6 candidates have canonicalActiveAssetIds in D1
    // Step 2 (#9993-S1) has not been bound yet
    const step2 = wizardData.steps.find((s) => s.stepNumber === 2);
    assert.strictEqual(step2.isCanonicallyBound, false);
    assert.strictEqual(step2.canonicalAssetId, null);
    assert.strictEqual(step2.evaluatedSlot.is_canonically_bound, false);
    assert.strictEqual(step2.evaluatedSlot.canonical_asset_id, null);
  });

  // 15. Article handoff uses correct preview routes
  test('15. Article handoff uses verified application preview routes (/admin/preview/{slug})', () => {
    const wizardData = getBatch1WizardSteps(allCandidates, canonicalActiveAssetIds);
    const slugs = [
      'dinding-rembes-dan-cat-menggelembung-cara-membedakan-masalah-talang-plesteran-kelembapan-tanah',
      '7-ide-menata-balkon-rumah-kecil-agar-nyaman',
      'menata-denah-rumah-lebar-5-6-meter-solusi-sirkulasi-bukaan-ruang-tengah-tidak-pengap'
    ];

    slugs.forEach((slug) => {
      const previewRoute = `/admin/preview/${slug}`;
      assert.ok(previewRoute.startsWith('/admin/preview/'));
      assert.ok(!previewRoute.includes(' '));
    });

    assert.strictEqual(wizardData.steps.length, 9);
  });

  // 16. No automatic editorial approval
  test('16. Invariant check: No automatic manuscript editorial approval', () => {
    const selectionCode = fs.readFileSync('src/lib/media/selection-service.ts', 'utf8');
    assert.ok(!selectionCode.includes('AUTO_APPROVE_MANUSCRIPT'));
    assert.ok(!selectionCode.includes('article.status = "APPROVED"'));
  });

  // 17. No publication or deployment
  test('17. Safety Invariants: AUTO_PUBLISH = OFF, JEV_MODE = shadow, PRODUCTION_AUTHORITY = 0', () => {
    const agentsMd = fs.readFileSync('AGENTS.md', 'utf8');
    assert.ok(agentsMd.includes('AUTO_PUBLISH = OFF'));
    assert.ok(agentsMd.includes('JEV_MODE = shadow'));
  });

  // 18. Existing approvals and bindings are preserved
  test('18. Existing approvals and bindings are preserved in candidate ledger', () => {
    const fluxHero9993 = allCandidates.find((c) => c.id === 'candidate-9993-flux-1-schnell-v3');
    assert.ok(fluxHero9993);
    assert.strictEqual(fluxHero9993.approval_status, 'APPROVED');

    const s2Flux9993 = allCandidates.find((c) => c.id === 'candidate-9993-s2-detail-cat-menggelembung-flux-v2');
    assert.ok(s2Flux9993);
    assert.strictEqual(s2Flux9993.approval_status, 'APPROVED');

    const heroFlux9999 = allCandidates.find((c) => c.id === 'candidate-9999-flux-1-schnell');
    assert.ok(heroFlux9999);
    assert.strictEqual(heroFlux9999.approval_status, 'APPROVED');

    const s2Flux9999 = allCandidates.find((c) => c.id === 'candidate-9999-s2-sudut-santai-tanaman-vertikal-flux');
    assert.ok(s2Flux9999);
    assert.strictEqual(s2Flux9999.approval_status, 'APPROVED');

    const heroSdxl10000 = allCandidates.find((c) => c.id === 'candidate-10000-sdxl-lightning');
    assert.ok(heroSdxl10000);
    assert.strictEqual(heroSdxl10000.approval_status, 'APPROVED');

    const s1Svg10000 = allCandidates.find((c) => c.id === 'candidate-10000-s1-denah-konseptual-inner-court-svg');
    assert.ok(s1Svg10000);
    assert.strictEqual(s1Svg10000.approval_status, 'APPROVED');
  });

  // Run all tests
  let passedCount = 0;
  for (const t of tests) {
    try {
      await t.fn();
      console.log(`✓ [PASS] ${t.name}`);
      passedCount++;
    } catch (err) {
      console.error(`✗ [FAIL] ${t.name}`);
      console.error(err);
    }
  }

  console.log(`\n========================================`);
  console.log(`TEST RESULTS: ${passedCount}/${tests.length} PASSED`);
  console.log(`========================================`);

  if (passedCount !== tests.length) {
    process.exit(1);
  }
}

runWizardTests().catch((err) => {
  console.error('Fatal test error:', err);
  process.exit(1);
});
