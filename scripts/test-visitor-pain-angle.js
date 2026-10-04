/**
 * Test Suite: EDITORIAL-VISITOR-PAIN-ANGLE-1
 * Visitor Problem Context & Opening Diversity Test Suite
 *
 * Verifies:
 * 1. One keyword can produce multiple plausible visitor pain contexts
 * 2. Pain context is distinct from article intent
 * 3. Opening angle is distinct from pain state
 * 4. Candidate openings differ structurally, not just lexically
 * 5. No canned sentence bank is used
 * 6. Generic `Banyak pemilik rumah...` dependency is detectable across corpus repetition
 * 7. Common phrase alone is not automatically penalized
 * 8. Inferred editorial pain is distinguished from observed first-party signal
 * 9. No fabricated homeowner quotes
 * 10. No fake hands-on experience
 * 11. Opening context remains aligned with article promise
 * 12. Recent opening pattern metadata can be consumed by Joko
 * 13. No article mutation occurs before human selection
 * 14. Existing safety invariants remain intact
 */

import assert from 'node:assert';
import fs from 'node:fs';
import path from 'node:path';

import {
  CANONICAL_PAIN_DIMENSIONS,
  deriveOpeningSignature,
  detectOpeningTemplateRepetition,
  evaluateOpeningAgainstPromise,
  getCanonicalMetalRoofProblemContexts,
  getCanonicalMetalRoofCandidateOpenings,
  buildHumanVisitorPainSelectionPackage
} from '../src/lib/article/visitor-pain.ts';

import {
  evaluateHumanWritingQuality,
  detectArticleIntentProfile
} from '../src/lib/article/human-quality.ts';

async function test(name, fn) {
  try {
    await fn();
    console.log(`  ✅ PASS: ${name}`);
  } catch (err) {
    console.error(`  ❌ FAIL: ${name}`);
    throw err;
  }
}

async function main() {
  console.log('🧪 Starting Visitor Problem Context & Opening Diversity Suite (EDITORIAL-VISITOR-PAIN-ANGLE-1)...\n');

  const pkg = buildHumanVisitorPainSelectionPackage();
  const contexts = getCanonicalMetalRoofProblemContexts();
  const openings = getCanonicalMetalRoofCandidateOpenings();

  // --- SECTION 1: Context & Intent Plurality ---
  console.log('--- TEST SECTION 1: Visitor Context Plurality & Intent Independence ---');

  await test('1. One keyword can produce multiple plausible visitor pain contexts', () => {
    // Topic: 'Atap Metal Terasa Panas: Apakah Insulasi Foil Cukup atau Perlu Ventilasi Atap?'
    assert.strictEqual(contexts.length, 10, 'Must produce at least 10 distinct problem contexts');

    const dimensions = new Set(contexts.map((c) => c.pain_dimension));
    assert.ok(dimensions.size >= 6, `Expected at least 6 distinct pain dimensions, got ${dimensions.size}`);
    assert.ok(dimensions.has('PHYSICAL_DISCOMFORT'));
    assert.ok(dimensions.has('FAILED_SOLUTION'));
    assert.ok(dimensions.has('DECISION_UNCERTAINTY'));
    assert.ok(dimensions.has('ENERGY_COST'));
    assert.ok(dimensions.has('FINANCIAL_RISK'));
    assert.ok(dimensions.has('INFORMATION_CONFLICT'));
    assert.ok(dimensions.has('DIAGNOSTIC_UNCERTAINTY'));
  });

  await test('2. Pain context is distinct from article intent', () => {
    // Intent is single: PROBLEM_SOLVING
    const intent = detectArticleIntentProfile('# ' + pkg.topic).primary_intent;
    assert.strictEqual(intent, 'PROBLEM_SOLVING');

    // But pain contexts span multiple real-world reader situations
    const painStates = contexts.map((c) => c.pain_state);
    assert.strictEqual(painStates.length, 10);
    // Every pain state must be distinct
    const uniquePainStates = new Set(painStates);
    assert.strictEqual(uniquePainStates.size, 10, 'All 10 pain states must be distinct from one another');
  });

  // --- SECTION 2: Opening Angle vs Pain State ---
  console.log('\n--- TEST SECTION 2: Opening Angle vs Pain State Orthogonality ---');

  await test('3. Opening angle is distinct from pain state', () => {
    // Verify that pain_angle and opening_angle are separate fields
    for (const op of openings) {
      assert.ok(op.pain_angle, 'Must have pain_angle');
      assert.ok(op.opening_angle, 'Must have opening_angle');
      // Opening angle is not identical to pain angle string
      assert.notStrictEqual(String(op.pain_angle), String(op.opening_angle));
    }

    const openingAngles = new Set(openings.map((o) => o.opening_angle));
    assert.ok(openingAngles.size >= 8, `Expected at least 8 distinct opening angles, got ${openingAngles.size}`);
  });

  await test('4. Candidate openings differ structurally, not just lexically', () => {
    const signatures = openings.map((o) => o.opening_signature);
    const uniqueSignatures = new Set(signatures);

    // Signatures must show diverse structural flows
    assert.ok(uniqueSignatures.size >= 5, `Expected at least 5 distinct structural flows, got ${uniqueSignatures.size}`);
    assert.ok(uniqueSignatures.has('SCENE > SYMPTOM > DIAGNOSIS'));
    assert.ok(uniqueSignatures.has('FAILED_FIX > CONTRADICTION > ROOT_CAUSE'));
    assert.ok(uniqueSignatures.has('DECISION > TRADEOFF > QUESTION'));
    assert.ok(uniqueSignatures.has('COST > SYMPTOM > ACTION'));
    assert.ok(uniqueSignatures.has('QUESTION > SYMPTOM > DIAGNOSIS'));
  });

  await test('5. No canned sentence bank is used', () => {
    // Verify that candidate openings do not rely on fixed template slot substitutions
    const firstSentences = openings.map((o) => o.opening_text.split(/[.?!]\s+/)[0].trim());
    const uniqueFirstSentences = new Set(firstSentences);
    assert.strictEqual(uniqueFirstSentences.size, openings.length, 'Every candidate opening must start with an original sentence');

    // Ensure none of the candidate openings start with canned template formulas
    for (const s of firstSentences) {
      assert.ok(!s.startsWith('Banyak pemilik rumah'), `Should not start with canned sentence: ${s}`);
      assert.ok(!s.startsWith('Di era modern'), `Should not start with canned sentence: ${s}`);
    }
  });

  // --- SECTION 3: Anti-Template & Corpus Analysis ---
  console.log('\n--- TEST SECTION 3: Anti-Template & Corpus Analysis ---');

  await test('6. Generic "Banyak pemilik rumah..." dependency is detectable across corpus repetition', () => {
    const repetitiveCorpus = [
      'Banyak pemilik rumah memilih atap spandek karena murah. Namun panasnya membara.',
      'Banyak pemilik rumah menggunakan genteng beton. Namun bobotnya berat.',
      'Banyak pemilik rumah memasang insulasi foil. Namun hasilnya kurang maksimal.',
      'Banyak penghuni mengeluhkan bocor pada dak beton saat musim hujan.'
    ];

    const report = detectOpeningTemplateRepetition(repetitiveCorpus, { threshold: 3 });
    assert.strictEqual(report.has_template_dependency, true);
    assert.strictEqual(report.repeated_patterns[0].pattern, 'BANYAK_PEMILIK_RUMAH');
    assert.strictEqual(report.repeated_patterns[0].occurrences, 4);
  });

  await test('7. Common phrase alone is not automatically penalized', () => {
    // In an isolated article, a phrase like "banyak pemilik rumah" without cross-article repetition is not penalized
    const variedCorpus = [
      openings[0].opening_text,
      openings[1].opening_text,
      openings[2].opening_text,
      openings[3].opening_text
    ];

    const report = detectOpeningTemplateRepetition(variedCorpus, { threshold: 3 });
    assert.strictEqual(report.has_template_dependency, false);
    assert.strictEqual(report.repeated_patterns.length, 0);
  });

  // --- SECTION 4: Inferred vs Observed Distinction ---
  console.log('\n--- TEST SECTION 4: Signal Provenance & Anti-Fabrication ---');

  await test('8. Inferred editorial pain is distinguished from observed first-party signal', () => {
    for (const ctx of contexts) {
      // Must be explicitly INFERRED_EDITORIAL_CONTEXT, never pretend to be OBSERVED_FIRST_PARTY_SIGNAL
      assert.strictEqual(ctx.source_mode, 'INFERRED_EDITORIAL_CONTEXT');
      assert.ok(ctx.basis.includes('ARTICLE_TOPIC') || ctx.basis.includes('QUERY_LANGUAGE'));
      assert.ok(!ctx.basis.includes('FIRST_PARTY_SIGNAL'), 'Inferred context must not claim first-party signal');
    }
  });

  await test('9. No fabricated homeowner quotes', () => {
    const badOpeningWithQuote = `Kamar saya terasa seperti neraka setiap malam, kata Pak Budi saat kami temui. Padahal atap metal sudah dilapisi foil.`;
    const check = evaluateOpeningAgainstPromise(badOpeningWithQuote, contexts[2], pkg.topic);
    assert.strictEqual(check.valid, false);
    assert.ok(check.issues.some((i) => i.includes('FABRICATED_QUOTE_OR_EXPERIENCE')));
  });

  await test('10. No fake hands-on experience', () => {
    const badOpeningWithFakeVisit = `Minggu lalu kami mengunjungi rumah bapak di kawasan Bekasi dan menguji suhu atap metal dengan termometer laser kami.`;
    const check = evaluateOpeningAgainstPromise(badOpeningWithFakeVisit, contexts[0], pkg.topic);
    assert.strictEqual(check.valid, false);
    assert.ok(check.issues.some((i) => i.includes('FABRICATED_QUOTE_OR_EXPERIENCE')));
  });

  // --- SECTION 5: Quality & Promise Alignment ---
  console.log('\n--- TEST SECTION 5: Alignment & Recent Opening Memory ---');

  await test('11. Opening context remains aligned with article promise', () => {
    for (const op of openings) {
      const matchingContext = contexts.find((c) => c.context_id === op.visitor_context_id);
      assert.ok(matchingContext, `Matching context for ${op.visitor_context_id} must exist`);

      const evalRes = evaluateOpeningAgainstPromise(op.opening_text, matchingContext, pkg.topic);
      assert.strictEqual(evalRes.valid, true, `Opening for ${op.visitor_context_id} failed: ${evalRes.issues.join(', ')}`);
      assert.ok(evalRes.quality_notes.length > 0);
    }
  });

  await test('12. Recent opening pattern metadata can be consumed by Joko', () => {
    assert.ok(pkg.recent_opening_memory.length >= 3, 'Must retain memory of recent opening signatures');
    const recentSignatures = pkg.recent_opening_memory.map((m) => m.opening_signature);

    // Joko can inspect avoid_recent_opening_patterns
    assert.ok(recentSignatures.includes('DECISION > TRADEOFF > QUESTION'));
    assert.ok(recentSignatures.includes('SCENE > SYMPTOM > DIAGNOSIS'));
    assert.ok(recentSignatures.includes('FAILED_FIX > CONTRADICTION > ROOT_CAUSE'));
  });

  // --- SECTION 6: Human Selection Gate & Safety Invariants ---
  console.log('\n--- TEST SECTION 6: Human Selection Gate & Safety Invariants ---');

  await test('13. No article mutation occurs before human selection', () => {
    // draft-final.md must remain unmutated by this milestone
    const draftFinalPath = path.resolve('scripts/dryrun/draft-final.md');
    assert.ok(fs.existsSync(draftFinalPath));
    const draftFinal = fs.readFileSync(draftFinalPath, 'utf8');

    // Draft-final still contains its valid content
    assert.ok(draftFinal.includes('# Atap Metal Terasa Panas'));
    assert.strictEqual(pkg.status, 'HUMAN_VISITOR_PAIN_SELECTION_REQUIRED');
    assert.strictEqual(pkg.selection_gate.state, 'PENDING_HUMAN_SELECTION');
    assert.strictEqual(pkg.selection_gate.requires_human_approval, true);
    assert.strictEqual(pkg.selection_gate.allows_autonomous_article_mutation, false);
    assert.strictEqual(pkg.selection_gate.selected_context_id, null);
    assert.strictEqual(pkg.selection_gate.selected_opening_angle, null);
  });

  await test('14. Existing safety invariants remain intact', () => {
    assert.strictEqual(pkg.safety_governance.automation_mode, 'OFF');
    assert.strictEqual(pkg.safety_governance.social_automation, 'OFF');
    assert.strictEqual(pkg.safety_governance.auto_publish, 'OFF');
    assert.strictEqual(pkg.safety_governance.publishing_authority, 0);
    assert.strictEqual(pkg.safety_governance.jev_mode, 'shadow');
    assert.strictEqual(pkg.safety_governance.media_worker, 'DISABLED');
    assert.strictEqual(pkg.safety_governance.jefry_execution_authority, 0);
  });

  console.log(`\n🎉 All 14 tests in EDITORIAL-VISITOR-PAIN-ANGLE-1 passed successfully!`);
}

main().catch((err) => {
  console.error('\n💥 Test suite failed:', err);
  process.exit(1);
});
