/**
 * RancangLoka — SKILL ADOPTION MILESTONE 1 TEST SUITE
 * Milestone: HERMES-SKILL-ADOPTION-M1
 *
 * Verifies:
 * Part A — Systematic Debugging for Dimas (Tests 1-5)
 * Part B — Grounded Citations Pilot for Irwan (Tests 6-17)
 */

import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';

import {
  createInvestigationRecord,
  recordHypothesisTest,
  proposeMinimalFix,
  verifyAndResolveInvestigation,
  getInvestigationRecord,
  resetInvestigationStore
} from '../src/lib/mission-control/systematic-debugging.ts';

import {
  verifySourceMetadata,
  verifyLiteralExcerpt,
  validateClaimStrengthBound,
  evaluateIrwanProvenanceGate,
  INVARIANT_SOURCE_EXCERPT_IS_LITERAL,
  INVARIANT_AUTHOR_SAFE_CLAIM_MAY_BE_PARAPHRASED,
  INVARIANT_PUBLIC_ARTICLE_MAY_BE_NATURAL_LANGUAGE_PARAPHRASE,
  INVARIANT_CLAIM_STRENGTH_MUST_NOT_EXCEED_SOURCE_EVIDENCE
} from '../src/lib/editorial/source-provenance-verifier.ts';

console.log('======================================================');
console.log('🧪 Starting SKILL ADOPTION MILESTONE 1 Test Suite...');
console.log('======================================================\n');

let passed = 0;

try {
  resetInvestigationStore();

  // ==========================================================================
  // PART A: Systematic Debugging for Dimas (Tests 1 - 5)
  // ==========================================================================

  // Test 1: Anomaly begins in investigation state
  console.log('Test 1: Anomaly begins in ROOT_CAUSE_INVESTIGATION state');
  const inv1 = createInvestigationRecord({
    investigation_id: 'INV-TEST-001',
    anomaly_id: 'ANOM-WORKER-STALL-01',
    subsystem: 'engineering',
    problem: 'Cloudflare Worker SSR execution timeout during heavy traffic',
    reproduction: {
      command_or_script: 'node scripts/repro-worker-stall.js',
      is_deterministic: true,
      failure_observed: 'TimeoutError: 504 Gateway Timeout'
    },
    observed_evidence: ['Edge log: connection reset at /articles/dynamic', 'D1 query latency spike 450ms']
  });

  assert.equal(inv1.status, 'ROOT_CAUSE_INVESTIGATION', 'Initial status must be ROOT_CAUSE_INVESTIGATION');
  assert.equal(inv1.investigator_agent_id, 'telemetry_observer_jev', 'Investigator must be Dimas');
  assert.equal(inv1.publishing_authority, 0, 'Publishing authority must be 0');
  console.log('  ✅ PASS: Investigation begins strictly in ROOT_CAUSE_INVESTIGATION state.\n');
  passed++;

  // Test 2: Root-cause investigation precedes fix (The Iron Law)
  console.log('Test 2: Root-cause investigation strictly precedes fix (The Iron Law)');
  assert.throws(
    () => {
      proposeMinimalFix('INV-TEST-001', {
        target_files: ['src/lib/db.ts'],
        rationale: 'Quick patch to increase timeout limit without root cause analysis'
      });
    },
    (err) => {
      assert.ok(err.message.includes('VIOLATION OF THE IRON LAW'), 'Must trigger Iron Law violation error');
      return true;
    },
    'Cannot propose fix before root cause investigation'
  );
  console.log('  ✅ PASS: Premature fix proposal without confirmed root cause is blocked by The Iron Law.\n');
  passed++;

  // Test 3: Hypothesis is recorded
  console.log('Test 3: Hypothesis is recorded and tested');
  // 3a. Disproved hypothesis keeps record in ROOT_CAUSE_INVESTIGATION
  recordHypothesisTest('INV-TEST-001', 'D1 connection pool exhaustion', {
    test_description: 'Mock D1 pool connection limit expansion to 50 concurrent',
    result: 'DISPROVED',
    notes: 'Timeout still occurs; connection pool was not saturated.'
  });
  const updatedInvDisproved = getInvestigationRecord('INV-TEST-001');
  assert.equal(updatedInvDisproved.status, 'ROOT_CAUSE_INVESTIGATION', 'Disproved hypothesis keeps investigation in Phase 1/2');
  assert.equal(updatedInvDisproved.confirmed_root_cause, null, 'Root cause must remain unconfirmed');

  // 3b. Confirmed hypothesis advances record to HYPOTHESIS_TESTING & confirms root cause
  recordHypothesisTest('INV-TEST-001', 'Unindexed D1 full-table scan on article tags join', {
    test_description: 'Run query EXPLAIN QUERY PLAN on article tags query',
    result: 'CONFIRMED',
    notes: 'Execution plan shows SCAN TABLE articles_tags without index.'
  });
  const updatedInvConfirmed = getInvestigationRecord('INV-TEST-001');
  assert.equal(updatedInvConfirmed.status, 'HYPOTHESIS_TESTING', 'Confirmed hypothesis advances state');
  assert.equal(updatedInvConfirmed.confirmed_root_cause, 'Unindexed D1 full-table scan on article tags join');
  console.log('  ✅ PASS: Hypothesis testing lifecycle and root cause confirmation verified.\n');
  passed++;

  // Test 4: Fix requires verification
  console.log('Test 4: Fix requires deterministic regression verification before resolution');
  // Propose minimal fix now that root cause is confirmed
  proposeMinimalFix('INV-TEST-001', {
    target_files: ['migrations/0009_add_tags_index.sql'],
    rationale: 'Add composite index idx_articles_tags_lookup to eliminate table scan'
  });
  const fixState = getInvestigationRecord('INV-TEST-001');
  assert.equal(fixState.status, 'FIX_VERIFICATION', 'Status must advance to FIX_VERIFICATION');

  // Attempt to resolve with failing verification should be blocked
  assert.throws(
    () => {
      verifyAndResolveInvestigation('INV-TEST-001', {
        repro_passed: false,
        typecheck_passed: true,
        build_passed: true,
        suites_verified: ['scripts/test-d1-read-hotfix.js']
      });
    },
    (err) => {
      assert.ok(err.message.includes('VERIFICATION_FAILED'), 'Must reject unresolved verification');
      return true;
    }
  );

  // Successful verification resolves investigation
  const resolved = verifyAndResolveInvestigation('INV-TEST-001', {
    repro_passed: true,
    typecheck_passed: true,
    build_passed: true,
    suites_verified: ['scripts/test-d1-read-hotfix.js', 'scripts/test-soak-safety.js']
  });
  assert.equal(resolved.status, 'RESOLVED', 'Status must transition to RESOLVED');
  assert.equal(resolved.minimal_fix.status, 'VERIFIED');
  console.log('  ✅ PASS: Fix verification gate enforces all checks before marking RESOLVED.\n');
  passed++;

  // Test 5: Dimas has no publishing authority
  console.log('Test 5: Dimas authority is strictly 0 (Zero publishing authority)');
  assert.equal(resolved.investigator_agent_id, 'telemetry_observer_jev');
  assert.equal(resolved.publishing_authority, 0);
  console.log('  ✅ PASS: Dimas retains strictly 0 publishing authority.\n');
  passed++;

  // ==========================================================================
  // PART B: Grounded Citations Pilot for Irwan (Tests 6 - 17)
  // ==========================================================================

  // Canonical baseline source metadata for Article C
  const canonicalRisaExpected = {
    authors: ['Luke Sidharta Wirajaya', 'Wulani Enggar Sari'],
    year: 2024,
    page_range: '127-143',
    doi: '10.26593/risa.v8i02.7868.127-143',
    canonical_url: 'https://journal.unpar.ac.id/index.php/risa/article/view/7868'
  };

  // Test 6: Valid metadata passes
  console.log('Test 6: Valid metadata passes verification');
  const validMetaRes = verifySourceMetadata(canonicalRisaExpected, {
    authors: ['Luke Sidharta Wirajaya', 'Wulani Enggar Sari'],
    year: 2024,
    page_range: '127-143',
    doi: '10.26593/risa.v8i02.7868.127-143',
    canonical_url: 'https://journal.unpar.ac.id/index.php/risa/article/view/7868'
  });
  assert.equal(validMetaRes.valid, true, 'Valid metadata must pass');
  assert.equal(validMetaRes.errors.length, 0);
  console.log('  ✅ PASS: Valid academic source metadata passes.\n');
  passed++;

  // Test 7: Wrong author fails
  console.log('Test 7: Wrong author fails verification');
  const wrongAuthorRes = verifySourceMetadata(canonicalRisaExpected, {
    authors: ['Budi Santoso', 'Wulani Enggar Sari'],
    year: 2024,
    page_range: '127-143',
    doi: '10.26593/risa.v8i02.7868.127-143'
  });
  assert.equal(wrongAuthorRes.valid, false);
  assert.ok(wrongAuthorRes.errors.some((e) => e.includes('AUTHOR_MISMATCH')));
  console.log('  ✅ PASS: Wrong author correctly caught and rejected.\n');
  passed++;

  // Test 8: Wrong year fails
  console.log('Test 8: Wrong year fails verification');
  const wrongYearRes = verifySourceMetadata(canonicalRisaExpected, {
    authors: ['Luke Sidharta Wirajaya', 'Wulani Enggar Sari'],
    year: 2022,
    page_range: '127-143'
  });
  assert.equal(wrongYearRes.valid, false);
  assert.ok(wrongYearRes.errors.some((e) => e.includes('YEAR_MISMATCH')));
  console.log('  ✅ PASS: Wrong year correctly caught and rejected.\n');
  passed++;

  // Test 9: Wrong page range fails (historical regression catch: 119-130 vs 127-143)
  console.log('Test 9: Wrong page range fails verification (e.g. 119-130 vs 127-143)');
  const wrongPagesRes = verifySourceMetadata(canonicalRisaExpected, {
    authors: ['Luke Sidharta Wirajaya', 'Wulani Enggar Sari'],
    year: 2024,
    page_range: '119-130'
  });
  assert.equal(wrongPagesRes.valid, false);
  assert.ok(wrongPagesRes.errors.some((e) => e.includes('PAGE_RANGE_MISMATCH')));
  console.log('  ✅ PASS: Page range mismatch caught and rejected.\n');
  passed++;

  // Test 10: Wrong DOI fails
  console.log('Test 10: Wrong DOI fails verification');
  const wrongDoiRes = verifySourceMetadata(canonicalRisaExpected, {
    doi: '10.26593/risa.v8i02.9999.000-000'
  });
  assert.equal(wrongDoiRes.valid, false);
  assert.ok(wrongDoiRes.errors.some((e) => e.includes('DOI_MISMATCH')));
  console.log('  ✅ PASS: Wrong DOI correctly caught and rejected.\n');
  passed++;

  // Test 11: Quote absent from source text fails literal verification
  console.log('Test 11: Quote absent from source text fails literal verification');
  const mockSniText = 'Standar Nasional Indonesia SNI 6389:2020 menetapkan nilai OTTV pada dinding luar bangunan gedung yang dikondisikan tidak boleh melebihi 35 W/m2.';
  const falseQuote = 'Semua rumah tinggal diwajibkan oleh BSN memasang penangkal petir dan AC inverter.';
  const quoteFailRes = verifyLiteralExcerpt(falseQuote, mockSniText);
  assert.equal(quoteFailRes.status, 'EXCERPT_NOT_FOUND');
  console.log('  ✅ PASS: Absent quote correctly fails literal verification.\n');
  passed++;

  // Test 12: Paraphrased author-safe claim is allowed
  console.log('Test 12: Paraphrased author-safe claim is allowed (meaning preserved)');
  const claimText = 'SNI 6389:2020 menetapkan kriteria nilai perpindahan termal menyeluruh (OTTV) maksimum sebesar 35 W/m² untuk selubung bangunan gedung yang dikondisikan.';
  const claimBoundRes = validateClaimStrengthBound(
    'Nilai OTTV pada dinding luar bangunan gedung yang dikondisikan tidak boleh melebihi 35 W/m².',
    claimText
  );
  assert.equal(claimBoundRes.valid, true);
  console.log('  ✅ PASS: Paraphrased author-safe claim within evidence boundaries is accepted.\n');
  passed++;

  // Test 13: Natural public paraphrase is allowed
  console.log('Test 13: Natural public paraphrase is allowed in homeowner Indonesian');
  const articleSentence = 'Angka batas maksimum yang ditetapkan adalah 35 W/m², sebuah patokan teknis bahwa selubung bangunan di Indonesia dituntut hemat energi.';
  const publicBoundRes = validateClaimStrengthBound(
    'Nilai OTTV pada dinding luar bangunan gedung yang dikondisikan tidak boleh melebihi 35 W/m².',
    claimText,
    articleSentence
  );
  assert.equal(publicBoundRes.valid, true);
  console.log('  ✅ PASS: Natural public paraphrase in Indonesian is accepted.\n');
  passed++;

  // Test 14: Stronger claim than source is rejected
  console.log('Test 14: Claim stronger than source is strictly rejected');
  const exaggeratedClaims = [
    'Sistem peneduh ini membuat konsumsi listrik AC turun drastis hingga nol rupiah.',
    'Panas matahari tidak bisa masuk ke dalam ruangan sama sekali.',
    'Secondary facade pasti menghilangkan seluruh panas matahari.',
    'Peneduh luar 100% bebas dari radiasi matahari.'
  ];
  for (const ex of exaggeratedClaims) {
    const exRes = validateClaimStrengthBound('Membantu mereduksi beban termal', ex);
    assert.equal(exRes.valid, false, `Must reject exaggerated claim: ${ex}`);
  }
  console.log('  ✅ PASS: All exaggerated claim patterns exceeding evidence are rejected.\n');
  passed++;

  // Test 15: Missing literal source text is explicitly marked, never fabricated
  console.log('Test 15: Missing literal source text is explicitly marked, never fabricated');
  const missingTextRes = verifyLiteralExcerpt('Bab 3 Prinsip Bangunan Tropis', null);
  assert.equal(missingTextRes.status, 'SOURCE_TEXT_NOT_AVAILABLE_FOR_LITERAL_VERIFICATION');
  assert.ok(missingTextRes.reason.includes('not cached locally'));
  console.log('  ✅ PASS: Honest status SOURCE_TEXT_NOT_AVAILABLE_FOR_LITERAL_VERIFICATION enforced without fabrication.\n');
  passed++;

  // Test 16: No public Markdown mutation occurs
  console.log('Test 16: No public Markdown citation mutation occurs');
  const artCDraftPath = path.resolve('scripts/content-bootstrap/artC-research-reset/article-c-clean-draft.md');
  const artCDraftContent = fs.readFileSync(artCDraftPath, 'utf-8');
  assert.equal(artCDraftContent.includes('## Sources'), false, 'Public article must NOT have injected ## Sources blocks');
  assert.equal(artCDraftContent.includes('Sources:'), false, 'Public article must NOT have injected Sources: block');
  assert.equal(artCDraftContent.includes('[1]'), false, 'Public article must NOT have injected Perplexity-style [1] brackets');
  console.log('  ✅ PASS: Public article Markdown remains pristine with zero automated citation injections.\n');
  passed++;

  // Test 17: No Article C content mutation occurs
  console.log('Test 17: Article C content hash remains strictly immutable');
  const currentHash = crypto.createHash('sha256').update(artCDraftContent).digest('hex');
  const expectedHash = '100cee76b051d0b531f5c27b1cf980eda4958532b931239b49c98290920b86a9';
  assert.equal(currentHash, expectedHash, 'Article C content hash must remain 100% unchanged');
  console.log(`  Article C SHA-256: ${currentHash}`);
  console.log('  ✅ PASS: Article C clean draft hash matches expected hash perfectly.\n');
  passed++;

  console.log('======================================================');
  console.log(`🎉 ALL ${passed}/17 SKILL ADOPTION MILESTONE 1 TESTS PASSED!`);
  console.log('======================================================\n');
} catch (err) {
  console.error('\n❌ TEST SUITE FAILED:', err);
  process.exit(1);
}
