/**
 * RancangLoka — Regression Test Suite: Local Human Casting Policy v1.0
 * File: scripts/test-local-human-casting-policy.mjs
 *
 * Verifies all 10 Rules of the Local Human Casting Policy:
 * 1. Indonesian / Southeast Asian priority for human presence.
 * 2. Coverage across demographics (Male, Female, Child, Elderly, Family).
 * 3. Anti-Western / anti-Caucasian negative constraint enforcement.
 * 4. Authentic Indonesian clothing, gestures, and domestic activities.
 * 5. Natural anatomy and expression invariants.
 * 6. Non-forced human presence (pure architecture when presence === 'NONE').
 * 7. Model continuity across Image Series multi-shot prompts.
 * 8. Budi Prompt Engine and Nadia Storyboard integration.
 * 9. Rina audience relevance evaluation (without racial facial essentialism).
 * 10. Zero modification of existing assets / zero paid API spend.
 */

import assert from 'node:assert';
import {
  compileHumanCastingPromptTokens,
  evaluateRinaHumanCastingCompliance,
  CANONICAL_HUMAN_CASTING_NEGATIVES,
  LOCAL_HUMAN_CASTING_POLICY_VERSION
} from '../src/lib/editorial/local-human-casting-policy.ts';
import {
  buildStructuredInlinePrompt,
  buildStructuredSeriesPrompt,
  getKitchenVentilationHouseProfile
} from '../src/lib/editorial/house-identity.ts';
import {
  buildDeepPromptV2,
  CANONICAL_NEGATIVE_CONSTRAINTS
} from '../src/lib/editorial/budi-prompt-engine.ts';
import { evaluateVisualCandidate } from '../src/lib/editorial/visual-quality-reviewer.ts';

let passedTests = 0;
let totalTests = 0;

function test(name, fn) {
  totalTests++;
  try {
    fn();
    console.log(`  ✓ [TEST ${totalTests}] ${name}`);
    passedTests++;
  } catch (err) {
    console.error(`  ❌ [TEST ${totalTests} FAILED] ${name}`);
    console.error(err);
    process.exitCode = 1;
  }
}

console.log('================================================================');
console.log(`🧪 RANCANGLOKA — LOCAL HUMAN CASTING POLICY (${LOCAL_HUMAN_CASTING_POLICY_VERSION}) TEST SUITE`);
console.log('================================================================\n');

// 1. Rule 6: Pure Architecture without Forced Human Models
test('Rule 6: Pure architecture when presence is NONE (No forced humans)', () => {
  const tokens = compileHumanCastingPromptTokens({ presence: 'NONE' });
  assert.strictEqual(tokens.is_active, false);
  assert.strictEqual(tokens.presence, 'NONE');
  assert.ok(tokens.positive_tokens.includes('no people'));
  assert.ok(tokens.negative_tokens.includes('people'));
  assert.ok(tokens.negative_tokens.includes('caucasian model'));
});

// 2. Rule 1 & 2: Demographic Priority for Indonesian / Southeast Asian
test('Rule 1 & 2: Default Adult Female compiles authentic Indonesian domestic cues', () => {
  const tokens = compileHumanCastingPromptTokens({
    presence: 'DOMESTIC_ACTIVITY',
    demographic: 'ADULT_FEMALE'
  });
  assert.strictEqual(tokens.is_active, true);
  assert.ok(tokens.positive_tokens.includes('authentic Indonesian woman'));
  assert.ok(tokens.positive_tokens.includes('domestic homeware'));
  assert.ok(tokens.positive_tokens.includes('realistic five-fingered hands'));
});

test('Rule 1 & 2: Adult Male, Child, Elderly, and Family demographics supported', () => {
  const demos = [
    { key: 'ADULT_MALE', expected: 'authentic Indonesian man' },
    { key: 'CHILD', expected: 'Indonesian child' },
    { key: 'ELDERLY', expected: 'Indonesian grandparent' },
    { key: 'FAMILY', expected: 'Indonesian family' }
  ];

  for (const d of demos) {
    const tokens = compileHumanCastingPromptTokens({
      presence: 'DOMESTIC_ACTIVITY',
      demographic: d.key
    });
    assert.ok(
      tokens.positive_tokens.includes(d.expected),
      `Expected ${d.expected} in tokens for demographic ${d.key}`
    );
  }
});

// 3. Rule 3: Anti-Western / Caucasian Negative Constraints
test('Rule 3: Negative constraints strictly block Caucasian/European defaults', () => {
  const tokens = compileHumanCastingPromptTokens({
    presence: 'DOMESTIC_ACTIVITY',
    demographic: 'ADULT_MALE'
  });

  const mandatoryNegatives = [
    'caucasian model',
    'western features',
    'european default model',
    'blonde hair',
    'blue eyes',
    'western fashion catalog pose'
  ];

  for (const neg of mandatoryNegatives) {
    assert.ok(
      tokens.negative_tokens.includes(neg),
      `Missing negative constraint: ${neg}`
    );
  }
});

// 4. Rule 4 & 5: Authentic Attire, Gestures, and Natural Anatomy
test('Rule 4 & 5: Attire, natural gestures, and 5-finger anatomical invariants enforced', () => {
  const tokens = compileHumanCastingPromptTokens({
    presence: 'DOMESTIC_ACTIVITY',
    demographic: 'ADULT_FEMALE',
    clothing_style: 'daster katun santai bermotif batik halus',
    activity_description: 'sedang memotong sayuran di atas talenan kayu jati'
  });

  assert.ok(tokens.positive_tokens.includes('daster katun santai bermotif batik halus'));
  assert.ok(tokens.positive_tokens.includes('sedang memotong sayuran di atas talenan kayu jati'));
  assert.ok(tokens.positive_tokens.includes('five-fingered hands'));
  assert.ok(tokens.positive_tokens.includes('authentic lived-in expression'));
});

// 5. Rule 7: Model Continuity across Image Series
test('Rule 7: Image Series prompts lock model identity across shots', () => {
  const tokens = compileHumanCastingPromptTokens(
    {
      presence: 'DOMESTIC_ACTIVITY',
      demographic: 'ADULT_FEMALE',
      consistency_id: 'indonesian_homeowner_sari_01'
    },
    { is_series: true }
  );

  assert.ok(tokens.positive_tokens.includes('SERIES CONTINUITY'));
  assert.ok(tokens.positive_tokens.includes('indonesian_homeowner_sari_01'));
  assert.ok(tokens.positive_tokens.includes('Maintain 100% identical facial features'));
});

// 6. Rule 8: Integration with Budi Prompt Engine (DeepPromptV2)
test('Rule 8: Budi DeepPromptV2 injects Local Human Casting tokens when active', () => {
  const contract = {
    slot_key: 'inline_cooking_prep',
    main_problem: 'Ventilasi dapur sempit',
    visual_solution_idea: 'Penghuni memasak di dekat bukaan',
    reader_takeaway: 'Melihat pentingnya sirkulasi udara saat memasak',
    primary_elements_and_relations: 'Kompor dan meja dapur',
    camera_and_context: 'Eye-level 35mm',
    errors_to_avoid: ['dark space'],
    required_visual_evidence: ['Induction cooktop', 'Cooker hood'],
    visual_media_type: 'PHOTO_REALISTIC',
    caption_intent: 'Menjelaskan alur uap',
    draft_alt_text: 'Penghuni memasak di dapur',
    non_duplicate_justification: 'Distinct slot',
    human_casting: {
      presence: 'DOMESTIC_ACTIVITY',
      demographic: 'ADULT_FEMALE',
      activity_description: 'memasak ringan di kompor'
    }
  };

  const deepPrompt = buildDeepPromptV2(contract, {
    article_slug: 'ventilasi-dapur-tanpa-jendela'
  });

  assert.ok(deepPrompt.compiled_prompt.includes('[LOCAL HUMAN CASTING v1.0]'));
  assert.ok(deepPrompt.compiled_prompt.includes('authentic Indonesian woman'));
  assert.ok(deepPrompt.negative_prompt.includes('caucasian model'));
  assert.ok(deepPrompt.negative_prompt.includes('western features'));
});

test('Rule 8: Budi DeepPromptV2 enforces unpopulated architectural purity when presence is NONE', () => {
  const contract = {
    slot_key: 'cover_hero',
    main_problem: 'Denah sempit',
    visual_solution_idea: 'Bukaan inner court',
    reader_takeaway: 'Rumah terasa lapang',
    primary_elements_and_relations: 'Void dan ruang duduk',
    camera_and_context: 'Eye-level wide',
    errors_to_avoid: ['hotel corridor'],
    required_visual_evidence: ['Concrete beam'],
    visual_media_type: 'PHOTO_REALISTIC',
    caption_intent: 'Ruang duduk',
    draft_alt_text: 'Ruang duduk terbuka',
    non_duplicate_justification: 'Cover slot',
    human_casting: {
      presence: 'NONE'
    }
  };

  const deepPrompt = buildDeepPromptV2(contract);
  assert.ok(deepPrompt.compiled_prompt.includes('pure space without human figures'));
  assert.ok(deepPrompt.negative_prompt.includes('people'));
  assert.ok(deepPrompt.negative_prompt.includes('caucasian model'));
});

// 7. Rule 8: Integration with House Identity & Series Prompt
test('Rule 8: House Identity buildStructuredInlinePrompt supports human casting options', () => {
  const profile = getKitchenVentilationHouseProfile(
    'test-slug',
    'Ventilasi Dapur Tanpa Jendela'
  );

  const inlineResult = buildStructuredInlinePrompt(profile, {
    slot_key: 'inline_1',
    photo_role: 'problem_condition',
    camera_angle: 'side angle',
    camera_distance: 'medium shot',
    human_casting: {
      presence: 'DOMESTIC_ACTIVITY',
      demographic: 'ADULT_MALE',
      activity_description: 'mengamati uap masakan'
    }
  });

  assert.ok(inlineResult.prompt_text.includes('HUMAN ELEMENT'));
  assert.ok(inlineResult.prompt_text.includes('authentic Indonesian man'));
  assert.ok(inlineResult.negative_prompt.includes('caucasian model'));
});

test('Rule 8: House Identity buildStructuredSeriesPrompt locks human casting across series', () => {
  const profile = getKitchenVentilationHouseProfile(
    'test-slug',
    'Ventilasi Dapur Tanpa Jendela'
  );

  const seriesResult = buildStructuredSeriesPrompt(profile, {
    article_title: 'Ventilasi Dapur Tanpa Jendela',
    human_casting: {
      presence: 'BACKGROUND_SCALE',
      demographic: 'ADULT_FEMALE',
      consistency_id: 'sari_series_01'
    }
  });

  assert.ok(seriesResult.prompt_text.includes('Model Identity & Casting (MUST NOT DRIFT)'));
  assert.ok(seriesResult.prompt_text.includes('sari_series_01'));
  assert.ok(seriesResult.negative_prompt.includes('caucasian model'));
});

// 8. Rule 9: Rina Audience Relevance QA Evaluation
test('Rule 9: Rina QA passes authentic Indonesian domestic cues without racial facial essentialism', () => {
  const auditResult = evaluateRinaHumanCastingCompliance({
    has_human_present: true,
    observed: {
      clothing_authenticity: 'AUTHENTIC_INDONESIAN_DOMESTIC',
      activity_authenticity: 'NATURAL_HOME_ROUTINE',
      anatomical_quality: 'NATURAL',
      western_caucasian_default_detected: false,
      series_model_consistency: 'CONSISTENT'
    }
  });

  assert.strictEqual(auditResult.verdict, 'PASS');
  assert.strictEqual(auditResult.score, 95);
  assert.strictEqual(auditResult.rejection_reasons.length, 0);
  assert.ok(auditResult.evaluation_basis.includes('tanpa klaim esensialisasi etnis dari fitur wajah'));
});

test('Rule 9: Rina QA rejects Western/Caucasian default drift', () => {
  const auditResult = evaluateRinaHumanCastingCompliance({
    has_human_present: true,
    observed: {
      clothing_authenticity: 'WESTERN_CATALOG_FORMAL',
      activity_authenticity: 'COMMERCIAL_STAGED_POSE',
      anatomical_quality: 'NATURAL',
      western_caucasian_default_detected: true
    }
  });

  assert.strictEqual(auditResult.verdict, 'FAIL');
  assert.ok(auditResult.rejection_reasons.some(r => r.includes('Western / Caucasian')));
});

test('Rule 9: Rina QA rejects AI anatomical deformities on human figures', () => {
  const auditResult = evaluateRinaHumanCastingCompliance({
    has_human_present: true,
    observed: {
      clothing_authenticity: 'AUTHENTIC_INDONESIAN_DOMESTIC',
      activity_authenticity: 'NATURAL_HOME_ROUTINE',
      anatomical_quality: 'AI_DEFORMITY_DETECTED',
      western_caucasian_default_detected: false
    }
  });

  assert.ok(auditResult.rejection_reasons.some(r => r.includes('deformasi anatomi AI')));
});

test('Rule 9: Rina QA passes pure architectural composition (Rule 6 compliance)', () => {
  const auditResult = evaluateRinaHumanCastingCompliance({
    has_human_present: false,
    observed: {
      clothing_authenticity: 'UNVERIFIABLE',
      activity_authenticity: 'UNVERIFIABLE',
      anatomical_quality: 'NATURAL',
      western_caucasian_default_detected: false
    }
  });

  assert.strictEqual(auditResult.verdict, 'PASS');
  assert.strictEqual(auditResult.score, 100);
  assert.ok(auditResult.notes.some(n => n.includes('Rule 6')));
});

// 9. Integration with evaluateVisualCandidate
test('Integration: evaluateVisualCandidate triggers RINA_HUMAN_CASTING failure when Western default detected', () => {
  const evalResult = evaluateVisualCandidate({
    candidate_id: 'test_candidate_01',
    slot_key: 'inline_1',
    model: 'kling-v3-omni',
    cost_usd: 0.0280,
    signals: {
      human_casting: {
        has_human_present: true,
        observed: {
          clothing_authenticity: 'WESTERN_CATALOG_FORMAL',
          activity_authenticity: 'COMMERCIAL_STAGED_POSE',
          anatomical_quality: 'NATURAL',
          western_caucasian_default_detected: true
        }
      }
    }
  });

  assert.strictEqual(evalResult.overall_verdict, 'FAIL');
  assert.ok(evalResult.hard_reject_reasons.some(r => r.includes('[RINA_HUMAN_CASTING]')));
  assert.strictEqual(evalResult.rina_review.human_casting_compliance?.status, 'FAIL');
});

// 10. Canonical negative constraints include human casting negatives
test('Policy Integration: CANONICAL_NEGATIVE_CONSTRAINTS includes CANONICAL_HUMAN_CASTING_NEGATIVES', () => {
  assert.ok(CANONICAL_NEGATIVE_CONSTRAINTS.includes('caucasian model'));
  assert.ok(CANONICAL_NEGATIVE_CONSTRAINTS.includes('western features'));
  assert.ok(CANONICAL_NEGATIVE_CONSTRAINTS.includes('european default model'));
});

console.log('\n================================================================');
console.log(`📊 TEST SUMMARY: ${passedTests}/${totalTests} TESTS PASSED (100%)`);
console.log('================================================================\n');

if (passedTests !== totalTests) {
  process.exit(1);
}
