/**
 * RancangLoka — Joko Prompt Generalization & Domain Leak Audit Test Suite
 * Milestone: JOKO-PROMPT-GENERALIZATION-1
 *
 * Verifies:
 * 1. Test A: Damp-wall topic compiled prompt contains NO inherited roof terms (foil, ventilasi atap, radiant barrier, atap metal).
 * 2. Test B: Window topic compiled prompt contains NO damp-wall or metal-roof concepts in generic instructions.
 * 3. Test C: Metal-roof topic allows foil/ventilation vocabulary because it originates from active topic/claims.
 * 4. Test D: Static instruction injection ("bandingkan foil dengan ventilasi loteng") for damp-wall topic triggers WRITER_PROMPT_DOMAIN_LEAK.
 * 5. Test E: CONTRACTOR_CONFLICT derives competing recommendations dynamically from active topic/context, not fixed wording.
 * 6. Test F: Canonical editorial invariants (Native Indonesian authoring, ONE IDEA - ONE BEST HOME, Claim Grounding, Envelope format) remain strictly preserved.
 */

import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

import {
  buildJokoPrompt,
  buildJokoSystemPrompt,
  buildJokoUserPrompt,
  auditPromptSemanticLeaks,
  deriveCompetingOptionsFromTopicOrContext,
  buildDynamicOpeningGuidance,
  SUSPICIOUS_STATIC_DOMAIN_TERMS
} from '../src/lib/editorial/joko-prompt-builder.ts';

import {
  generateDynamicVisitorPain
} from '../src/lib/article/visitor-pain.ts';

let passed = 0;
async function test(name, fn) {
  await fn();
  console.log('  ✅ PASS: ' + name);
  passed++;
}

async function main() {
  console.log('🧪 Starting Joko Prompt Generalization Suite (JOKO-PROMPT-GENERALIZATION-1)...\n');

  // --- SECTION 1: Test A - Damp-Wall Topic & Evidence Generalization ---
  console.log('--- TEST SECTION 1: Damp-Wall Topic Generalization ---');

  const dampTopic = 'Dinding Rumah Lembap dan Berjamur: Cat Waterproofing Cukup atau Sumber Air Harus Diperbaiki?';
  const dampVisitorPain = generateDynamicVisitorPain(dampTopic, 'problem_solver');

  const dampEvidencePack = {
    evidence_pack_id: 'ev_damp_test_01',
    topic: dampTopic,
    claim_inventory: [
      { claim_id: 'CLM-001', statement: 'Structural dampness is the presence of unwanted moisture in building assemblies.' },
      { claim_id: 'CLM-002', statement: 'Rain penetration occurs through masonry fissures and damaged joints.' },
      { claim_id: 'CLM-003', statement: 'Applying internal waterproofing over saturated walls traps moisture inside.' }
    ],
    prohibited_claims: ['Estimasi biaya tanpa riset empiris', 'Klaim uji lab palsu']
  };

  const dampAuthorSafeClaims = [
    { claim_id: 'CLM-001', statement: 'Kelembapan struktural adalah kehadiran air yang tidak diinginkan dalam struktur bangunan.', allowed_for_authoring: true },
    { claim_id: 'CLM-002', statement: 'Penetrasi air hujan terjadi melalui retak pasangan bata dan sambungan rusak.', allowed_for_authoring: true },
    { claim_id: 'CLM-003', statement: 'Aplikasi cat waterproofing sisi dalam tanpa memperbaiki kebocoran luar menahan air di balik dinding.', allowed_for_authoring: true }
  ];

  const dampContext = {
    topic: dampTopic,
    requestedTitle: dampTopic,
    evidencePack: dampEvidencePack,
    authorSafeClaims: dampAuthorSafeClaims,
    visitorContext: {
      primaryContextId: dampVisitorPain.primary_context.context_id,
      primaryContextLabel: dampVisitorPain.primary_context.label,
      primaryPainDimension: dampVisitorPain.primary_context.pain_dimension,
      openingAngle: dampVisitorPain.opening_angle,
      preferredSignature: dampVisitorPain.narrative_signature
    }
  };

  await test('1. Damp-wall compiled prompt contains zero inherited roof concepts', () => {
    const compiled = buildJokoPrompt(dampContext);

    // Verify system prompt is domain-neutral
    assert.ok(!compiled.systemPrompt.toLowerCase().includes('foil'), 'System prompt must not mention foil');
    assert.ok(!compiled.systemPrompt.toLowerCase().includes('ventilasi atap'), 'System prompt must not mention ventilasi atap');
    assert.ok(!compiled.systemPrompt.toLowerCase().includes('radiant barrier'), 'System prompt must not mention radiant barrier');
    assert.ok(!compiled.systemPrompt.toLowerCase().includes('atap metal'), 'System prompt must not mention atap metal');
    assert.ok(!compiled.systemPrompt.toLowerCase().includes('seng'), 'System prompt must not mention seng');
    assert.ok(!compiled.systemPrompt.toLowerCase().includes('loteng'), 'System prompt must not mention loteng');

    // Verify non-evidence user prompt instructions are domain-neutral
    const safeClaimsIdx = compiled.userPrompt.indexOf('# FAKTA & KLAIM TEKNIS AMAN');
    const userPromptInstructions = compiled.userPrompt.substring(0, safeClaimsIdx) + '\n' +
      compiled.userPrompt.substring(compiled.userPrompt.indexOf('# PERSYARATAN STRUKTUR ARTIKEL'));

    assert.ok(!userPromptInstructions.toLowerCase().includes('foil'), 'User instructions must not mention foil');
    assert.ok(!userPromptInstructions.toLowerCase().includes('ventilasi atap'), 'User instructions must not mention ventilasi atap');
    assert.ok(!userPromptInstructions.toLowerCase().includes('ventilasi loteng'), 'User instructions must not mention ventilasi loteng');
    assert.ok(!userPromptInstructions.toLowerCase().includes('radiant barrier'), 'User instructions must not mention radiant barrier');
    assert.ok(!userPromptInstructions.toLowerCase().includes('atap metal'), 'User instructions must not mention atap metal');

    // Verify leak audit passes cleanly
    const audit = auditPromptSemanticLeaks(compiled, dampContext);
    assert.equal(audit.passed, true, 'Prompt leak audit must pass for damp-wall topic');
    assert.equal(audit.leaks.length, 0);
  });

  // --- SECTION 2: Test B - Window Topic Generalization ---
  console.log('\n--- TEST SECTION 2: Window Topic Generalization ---');

  const windowTopic = 'Kusen Jendela Rumah Tropis: Aluminium vs uPVC, Mana yang Lebih Awet?';
  const windowVisitorPain = generateDynamicVisitorPain(windowTopic, 'comparison');

  const windowEvidencePack = {
    evidence_pack_id: 'ev_window_test_01',
    topic: windowTopic,
    claim_inventory: [
      { claim_id: 'CLM-W01', statement: 'Kusen aluminium memiliki konduktivitas termal lebih tinggi namun tahan deformasi cuaca tropis.' },
      { claim_id: 'CLM-W02', statement: 'Profil uPVC memiliki insulasi termal lebih baik namun memerlukan penguat baja internal.' }
    ]
  };

  const windowAuthorSafeClaims = [
    { claim_id: 'CLM-W01', statement: 'Kusen aluminium memiliki konduktivitas termal lebih tinggi namun tahan cuaca.', allowed_for_authoring: true },
    { claim_id: 'CLM-W02', statement: 'Profil uPVC memiliki insulasi termal lebih baik dengan penguat baja.', allowed_for_authoring: true }
  ];

  const windowContext = {
    topic: windowTopic,
    requestedTitle: windowTopic,
    evidencePack: windowEvidencePack,
    authorSafeClaims: windowAuthorSafeClaims,
    visitorContext: {
      primaryContextId: windowVisitorPain.primary_context.context_id,
      primaryContextLabel: windowVisitorPain.primary_context.label,
      primaryPainDimension: windowVisitorPain.primary_context.pain_dimension,
      openingAngle: windowVisitorPain.opening_angle,
      preferredSignature: windowVisitorPain.narrative_signature
    }
  };

  await test('2. Window compiled prompt contains zero damp-wall or roof concepts in static instructions', () => {
    const compiled = buildJokoPrompt(windowContext);

    // Verify static system prompt
    assert.ok(!compiled.systemPrompt.toLowerCase().includes('waterproofing'), 'System prompt must not mention waterproofing');
    assert.ok(!compiled.systemPrompt.toLowerCase().includes('foil'), 'System prompt must not mention foil');
    assert.ok(!compiled.systemPrompt.toLowerCase().includes('ventilasi atap'), 'System prompt must not mention ventilasi atap');

    // Verify non-evidence user instructions
    const safeClaimsIdx = compiled.userPrompt.indexOf('# FAKTA & KLAIM TEKNIS AMAN');
    const userPromptInstructions = compiled.userPrompt.substring(0, safeClaimsIdx) + '\n' +
      compiled.userPrompt.substring(compiled.userPrompt.indexOf('# PERSYARATAN STRUKTUR ARTIKEL'));

    assert.ok(!userPromptInstructions.toLowerCase().includes('waterproofing'), 'User instructions must not mention waterproofing');
    assert.ok(!userPromptInstructions.toLowerCase().includes('foil'), 'User instructions must not mention foil');
    assert.ok(!userPromptInstructions.toLowerCase().includes('ventilasi atap'), 'User instructions must not mention ventilasi atap');
    assert.ok(!userPromptInstructions.toLowerCase().includes('radiant barrier'), 'User instructions must not mention radiant barrier');

    // Verify leak audit passes cleanly
    const audit = auditPromptSemanticLeaks(compiled, windowContext);
    assert.equal(audit.passed, true, 'Prompt leak audit must pass for window topic');
  });

  // --- SECTION 3: Test C - Metal-Roof Topic with Roof Evidence Remains Allowed ---
  console.log('\n--- TEST SECTION 3: Metal-Roof Topic Validity Preserved ---');

  const roofTopic = 'Atap Metal Terasa Panas: Apakah Insulasi Foil Cukup atau Perlu Ventilasi Atap?';
  const roofVisitorPain = generateDynamicVisitorPain(roofTopic, 'problem_solver');

  const roofEvidencePack = {
    evidence_pack_id: 'ev_roof_test_01',
    topic: roofTopic,
    claim_inventory: [
      { claim_id: 'CLM-001', statement: 'Lembaran atap metal memancarkan radiasi termal ke ruang di bawahnya.' },
      { claim_id: 'CLM-002', statement: 'Insulasi foil aluminium bekerja memantulkan radiasi jika disertai air gap minimal.' },
      { claim_id: 'CLM-003', statement: 'Ventilasi atap atau loteng membantu mengeluarkan udara panas yang terperangkap.' }
    ]
  };

  const roofAuthorSafeClaims = [
    { claim_id: 'CLM-001', statement: 'Lembaran atap metal memancarkan radiasi termal ke ruang di bawahnya.', allowed_for_authoring: true },
    { claim_id: 'CLM-002', statement: 'Insulasi foil aluminium bekerja memantulkan radiasi jika disertai air gap minimal.', allowed_for_authoring: true },
    { claim_id: 'CLM-003', statement: 'Ventilasi atap atau loteng membantu mengeluarkan udara panas yang terperangkap.', allowed_for_authoring: true }
  ];

  const roofContext = {
    topic: roofTopic,
    requestedTitle: roofTopic,
    evidencePack: roofEvidencePack,
    authorSafeClaims: roofAuthorSafeClaims,
    visitorContext: {
      primaryContextId: roofVisitorPain.primary_context.context_id,
      primaryContextLabel: roofVisitorPain.primary_context.label,
      primaryPainDimension: roofVisitorPain.primary_context.pain_dimension,
      openingAngle: roofVisitorPain.opening_angle,
      preferredSignature: roofVisitorPain.narrative_signature
    }
  };

  await test('3. Metal-roof topic with roof evidence allows foil/ventilation vocabulary from active input', () => {
    const compiled = buildJokoPrompt(roofContext);

    // Active input has foil and ventilasi atap
    assert.ok(compiled.userPrompt.includes('Insulasi foil aluminium'), 'User prompt contains safe claims on foil');
    assert.ok(compiled.userPrompt.includes('Ventilasi atap'), 'User prompt contains safe claims on ventilation');

    // Leak audit recognizes terms are part of active input and PASSES
    const audit = auditPromptSemanticLeaks(compiled, roofContext);
    assert.equal(audit.passed, true, 'Prompt leak audit must PASS for genuine metal-roof topic');
    assert.equal(audit.leaks.length, 0);
  });

  // --- SECTION 4: Test D - Suspicious Static Prompt Leak Detection ---
  console.log('\n--- TEST SECTION 4: Prompt Semantic Leak Audit Rejection ---');

  await test('4. Injecting static generic instruction with roof terms on damp-wall topic FAILS with WRITER_PROMPT_DOMAIN_LEAK', () => {
    const cleanCompiled = buildJokoPrompt(dampContext);

    // Simulate adversarial/buggy injection of static text containing roof terms
    const corruptedUserPrompt = cleanCompiled.userPrompt.replace(
      '# PERSYARATAN STRUKTUR ARTIKEL',
      'Instruksi Khusus: Bandingkan kinerja insulasi foil dengan ventilasi loteng pada rumah.\n# PERSYARATAN STRUKTUR ARTIKEL'
    );

    const corruptedCompiled = {
      ...cleanCompiled,
      userPrompt: corruptedUserPrompt
    };

    const audit = auditPromptSemanticLeaks(corruptedCompiled, dampContext);
    assert.equal(audit.passed, false, 'Audit must fail when static prompt injects ungrounded domain concepts');
    assert.equal(audit.code, 'WRITER_PROMPT_DOMAIN_LEAK', 'Error code must be WRITER_PROMPT_DOMAIN_LEAK');
    assert.ok(audit.leaks.some(l => l.term === 'insulasi foil' || l.term === 'foil'), 'Must identify foil leak');
    assert.ok(audit.leaks.some(l => l.term === 'ventilasi loteng'), 'Must identify ventilasi loteng leak');
  });

  // --- SECTION 5: Test E - Dynamic CONTRACTOR_CONFLICT Derivation ---
  console.log('\n--- TEST SECTION 5: Dynamic Contractor Conflict & Decision Fork ---');

  await test('5. CONTRACTOR_CONFLICT derives competing recommendations dynamically per topic', () => {
    // 5a. Damp wall topic
    const dampConflictGuidance = buildDynamicOpeningGuidance(dampTopic, {
      primaryContextId: 'CTX-04-CONTRACTOR-CONFLICT',
      primaryPainDimension: 'INFORMATION_CONFLICT',
      openingAngle: 'EXPERT_OBSERVATION'
    });
    assert.ok(dampConflictGuidance.includes('cat waterproofing'), 'Must derive cat waterproofing');
    assert.ok(dampConflictGuidance.includes('sumber air harus diperbaiki'), 'Must derive sumber air harus diperbaiki');
    assert.ok(!dampConflictGuidance.includes('foil'), 'Must not mention foil');
    assert.ok(!dampConflictGuidance.includes('ventilasi atap'), 'Must not mention ventilasi atap');

    // 5b. Window topic
    const windowConflictGuidance = buildDynamicOpeningGuidance(windowTopic, {
      primaryContextId: 'CTX-04-CONTRACTOR-CONFLICT',
      primaryPainDimension: 'INFORMATION_CONFLICT',
      openingAngle: 'EXPERT_OBSERVATION'
    });
    assert.ok(windowConflictGuidance.includes('aluminium'), 'Must derive aluminium');
    assert.ok(windowConflictGuidance.includes('upvc'), 'Must derive upvc');
    assert.ok(!windowConflictGuidance.includes('foil'), 'Must not mention foil');
    assert.ok(!windowConflictGuidance.includes('waterproofing'), 'Must not mention waterproofing');

    // 5c. Roof topic
    const roofConflictGuidance = buildDynamicOpeningGuidance(roofTopic, {
      primaryContextId: 'CTX-04-CONTRACTOR-CONFLICT',
      primaryPainDimension: 'INFORMATION_CONFLICT',
      openingAngle: 'EXPERT_OBSERVATION'
    });
    assert.ok(roofConflictGuidance.includes('insulasi foil'), 'Must derive insulasi foil');
    assert.ok(roofConflictGuidance.includes('ventilasi atap'), 'Must derive ventilasi atap');
  });

  // --- SECTION 6: Test F - Canonical Invariants Preserved ---
  console.log('\n--- TEST SECTION 6: Canonical Invariants Preservation ---');

  await test('6. Master editorial guidelines and canonical knowledge invariants remain intact', () => {
    const sys = buildJokoSystemPrompt();

    // Native Indonesian contract
    assert.ok(sys.includes('authoring_language = id-ID'), 'Must mandate authoring_language = id-ID');
    assert.ok(sys.includes('translation_mode = prohibited_by_default'), 'Must prohibit translation mode');
    assert.ok(sys.includes('TULIS LANGSUNG dalam bahasa Indonesia asli'), 'Must mandate direct Indonesian writing');
    assert.ok(sys.includes('translationese'), 'Must ban translationese');

    // Editorial quality DNA
    assert.ok(sys.includes('content_writer_primary'), 'Must identify Joko');
    assert.ok(sys.includes('Diagnosis Mendahului Solusi'), 'Must include Diagnosis Mendahului Solusi');
    assert.ok(sys.includes('Rekomendasi Berbasis Skenario'), 'Must include Rekomendasi Berbasis Skenario');
    assert.ok(sys.includes('Transparansi Risiko & Kompromi Nyata'), 'Must include Transparansi Risiko & Kompromi Nyata');
    assert.ok(sys.includes('Daftar Periksa Pra-Biaya'), 'Must include Daftar Periksa Pra-Biaya');
    assert.ok(sys.includes('Prescriptive Certainty <= Evidence Certainty'), 'Must enforce certainty bound');
    assert.ok(sys.includes('ONE IDEA — ONE BEST HOME'), 'Must enforce ONE IDEA — ONE BEST HOME');

    // Grounding contract & safety invariants
    assert.ok(sys.includes('CLAIM GROUNDING CONTRACT'), 'Must instruct claim grounding contract');
    assert.ok(sys.includes('GROUNDED DRAFT ENVELOPE'), 'Must instruct JSON envelope format');
    assert.ok(sys.includes('Kepatuhan Monetary Silence Mutlak'), 'Must enforce monetary silence');

    // Check user prompt structure
    const compiled = buildJokoPrompt(dampContext);
    assert.ok(compiled.userPrompt.includes('# TUGAS PENULISAN DRAF ARTIKEL'));
    assert.ok(compiled.userPrompt.includes('# KONTEKS MASALAH PENGUNJUNG'));
    assert.ok(compiled.userPrompt.includes('# FAKTA & KLAIM TEKNIS AMAN'));
    assert.ok(compiled.userPrompt.includes('# KLAIM DILARANG & BATASAN ETIKA'));
    assert.ok(compiled.userPrompt.includes('# PERSYARATAN STRUKTUR ARTIKEL (ONE IDEA — ONE BEST HOME)'));
    assert.ok(compiled.userPrompt.includes('Daftar Periksa Pra-Biaya'));
  });

  console.log(`\n🎉 All ${passed} tests in Joko Prompt Generalization Suite passed successfully!`);
}

main().catch(err => {
  console.error('Test suite failed:', err);
  process.exit(1);
});
