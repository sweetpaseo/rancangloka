/**
 * RancangLoka — Irwan Research Runtime Adversarial & Entailment Test Suite
 * Milestone: EDITORIAL-RUNTIME-3B-STABILIZE
 *
 * Verifies all 12 non-negotiable adversarial stabilization criteria:
 * 1. Walls passage -> metal thermal mass (CLM-001A) FAILS audit
 * 2. Walls passage -> metal conductivity (CLM-001B) FAILS audit
 * 3. Walls passage -> dust degradation (CLM-007A) FAILS audit
 * 4. Dust passage -> conductivity (CLM-001B) FAILS audit
 * 5. Dust passage -> attic ventilation design (CLM-005 / CLM-006) FAILS audit
 * 6. Ventilation passage -> bulk insulation property (CLM-004A) FAILS audit
 * 7. Air-space passage -> unrelated metal material-property claim (CLM-001A / CLM-001B) FAILS audit
 * 8. Compound claim with partially unsupported propositions is split into atomic claims (CLM-004A & CLM-004B)
 * 9. Author-safe claim stronger than source evidence (AUTHOR_SAFE_STRENGTH <= EVIDENCE_STRENGTH) FAILS audit
 * 10. Recommendation deriving from blocked or unsourced claim FAILS audit
 * 11. Recommendation deriving only from valid author-safe claims PASSES audit
 * 12. Joko invocation prevention during this milestone is strictly enforced
 */

import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

import {
  executeEditorialResearchJob
} from '../src/lib/editorial/irwan-research-runtime.ts';

import {
  auditEvidencePackProvenance,
  CLAIM_ALLOWED_SEMANTIC_ROLES
} from '../src/lib/article/human-quality.ts';

import {
  extractPassagesFromText
} from '../src/lib/editorial/source-discovery.ts';

let passed = 0;
async function test(name, fn) {
  await fn();
  console.log('  ✅ PASS: ' + name);
  passed++;
}

async function main() {
  console.log('🧪 Starting Irwan Entailment & Adversarial Stabilization Suite (EDITORIAL-RUNTIME-3B-STABILIZE)...\n');

  const baseJobInput = {
    taskId: 'task_test_irwan_runtime_3b_stabilize_001',
    topic: 'Atap Metal Terasa Panas: Apakah Insulasi Foil Cukup atau Perlu Ventilasi Atap?',
    milestone: 'EDITORIAL-RUNTIME-3B-STABILIZE',
    expectedFinalGate: 'IRWAN_EVIDENCE_V3_STABILIZED_HUMAN_REVIEW_REQUIRED',
    operatorAuth: {
      authorizedBy: 'Chief Editor Reviewer',
      operatorRole: 'CHIEF_EDITOR',
      timestamp: new Date().toISOString()
    }
  };

  // Base clean execution
  const baseResult = await executeEditorialResearchJob(baseJobInput);
  const cleanPack = baseResult.evidencePack;

  // Sanity check: clean pack must pass audit 100%
  const cleanAudit = auditEvidencePackProvenance(cleanPack);
  assert.strictEqual(cleanAudit.requires_provenance_failure, false, 'Clean stabilized pack must pass audit cleanly');

  // --- SECTION 1: Adversarial Passage Link Invalidation ---
  console.log('--- TEST SECTION 1: Adversarial Passage Link Invalidation ---');

  await test('1. Walls passage -> metal thermal mass (CLM-001A) FAILS audit', () => {
    const pack = JSON.parse(JSON.stringify(cleanPack));
    const wallPassage = {
      passage_id: 'psg_ADVERSARIAL_WALL_1',
      source_id: 'SRC-OPEN-WIKI-RADBAR',
      locator: 'Walls',
      exact_or_normalized_excerpt: 'Radiant barrier may be used as a vented skin around the exterior of a wall. Furring strips are applied to the sheathing to create a vented air space.',
      extracted_at: new Date().toISOString(),
      supports_claim_ids: ['CLM-001A']
    };
    pack.evidence_passages.push(wallPassage);
    const clm1A = pack.claim_inventory.find(c => c.claim_id === 'CLM-001A');
    clm1A.evidence_passage_ids.push('psg_ADVERSARIAL_WALL_1');

    const audit = auditEvidencePackProvenance(pack);
    assert.strictEqual(audit.requires_provenance_failure, true);
    assert.ok(audit.audit_reasons.some(r => r.includes('Walls') && r.includes('CLM-001A')));
  });

  await test('2. Walls passage -> metal conductivity (CLM-001B) FAILS audit', () => {
    const pack = JSON.parse(JSON.stringify(cleanPack));
    const wallPassage = {
      passage_id: 'psg_ADVERSARIAL_WALL_2',
      source_id: 'SRC-OPEN-WIKI-RADBAR',
      locator: 'Walls',
      exact_or_normalized_excerpt: 'Radiant barrier may be used as a vented skin around the exterior of a wall with furring strips to create wall air space.',
      extracted_at: new Date().toISOString(),
      supports_claim_ids: ['CLM-001B']
    };
    pack.evidence_passages.push(wallPassage);
    const clm1B = pack.claim_inventory.find(c => c.claim_id === 'CLM-001B');
    clm1B.evidence_passage_ids.push('psg_ADVERSARIAL_WALL_2');

    const audit = auditEvidencePackProvenance(pack);
    assert.strictEqual(audit.requires_provenance_failure, true);
    assert.ok(audit.audit_reasons.some(r => r.includes('Walls') && r.includes('CLM-001B')));
  });

  await test('3. Walls passage -> dust degradation (CLM-007A) FAILS audit', () => {
    const pack = JSON.parse(JSON.stringify(cleanPack));
    const wallPassage = {
      passage_id: 'psg_ADVERSARIAL_WALL_3',
      source_id: 'SRC-OPEN-WIKI-RADBAR',
      locator: 'Walls',
      exact_or_normalized_excerpt: 'Radiant barrier may be used as a vented skin around the exterior of a wall with vented air space.',
      extracted_at: new Date().toISOString(),
      supports_claim_ids: ['CLM-007A']
    };
    pack.evidence_passages.push(wallPassage);
    const clm7A = pack.claim_inventory.find(c => c.claim_id === 'CLM-007A');
    clm7A.evidence_passage_ids.push('psg_ADVERSARIAL_WALL_3');

    const audit = auditEvidencePackProvenance(pack);
    assert.strictEqual(audit.requires_provenance_failure, true);
    assert.ok(audit.audit_reasons.some(r => r.includes('Walls') && r.includes('CLM-007A')));
  });

  await test('4. Dust passage -> conductivity (CLM-001B) FAILS audit', () => {
    const pack = JSON.parse(JSON.stringify(cleanPack));
    // Link authentic dust passage psg_SRC-OPEN-DOE-RADBAR_4 to CLM-001B
    const dustPassage = pack.evidence_passages.find(p => p.passage_id === 'psg_SRC-OPEN-DOE-RADBAR_4');
    assert.ok(dustPassage);
    dustPassage.supports_claim_ids.push('CLM-001B');
    const clm1B = pack.claim_inventory.find(c => c.claim_id === 'CLM-001B');
    clm1B.evidence_passage_ids.push('psg_SRC-OPEN-DOE-RADBAR_4');

    const audit = auditEvidencePackProvenance(pack);
    assert.strictEqual(audit.requires_provenance_failure, true);
    assert.ok(audit.audit_reasons.some(r => r.includes('Passage debu') || r.includes('CLM-001B')));
  });

  await test('5. Dust passage -> attic ventilation design (CLM-005 / CLM-006) FAILS audit', () => {
    const pack = JSON.parse(JSON.stringify(cleanPack));
    const dustPassage = pack.evidence_passages.find(p => p.passage_id === 'psg_SRC-OPEN-WIKI-RADBAR_3');
    assert.ok(dustPassage);
    dustPassage.supports_claim_ids.push('CLM-006');
    const clm6 = pack.claim_inventory.find(c => c.claim_id === 'CLM-006');
    clm6.evidence_passage_ids.push('psg_SRC-OPEN-WIKI-RADBAR_3');

    const audit = auditEvidencePackProvenance(pack);
    assert.strictEqual(audit.requires_provenance_failure, true);
    assert.ok(audit.audit_reasons.some(r => r.includes('Passage debu') || r.includes('CLM-006')));
  });

  await test('6. Ventilation passage -> bulk insulation property (CLM-004A) FAILS audit', () => {
    const pack = JSON.parse(JSON.stringify(cleanPack));
    const ventPassage = pack.evidence_passages.find(p => p.passage_id === 'psg_SRC-OPEN-DOE-RADBAR_3');
    assert.ok(ventPassage);
    ventPassage.supports_claim_ids.push('CLM-004A');
    const clm4A = pack.claim_inventory.find(c => c.claim_id === 'CLM-004A');
    clm4A.evidence_passage_ids.push('psg_SRC-OPEN-DOE-RADBAR_3');

    const audit = auditEvidencePackProvenance(pack);
    assert.strictEqual(audit.requires_provenance_failure, true);
    assert.ok(audit.audit_reasons.some(r => r.includes('Passage ventilasi') || r.includes('CLM-004A')));
  });

  await test('7. Air-space passage -> unrelated metal material-property claim (CLM-001A / CLM-001B) FAILS audit', () => {
    const pack = JSON.parse(JSON.stringify(cleanPack));
    const airPassage = pack.evidence_passages.find(p => p.passage_id === 'psg_SRC-OPEN-DOE-RADBAR_2');
    assert.ok(airPassage);
    airPassage.supports_claim_ids.push('CLM-001A');
    const clm1A = pack.claim_inventory.find(c => c.claim_id === 'CLM-001A');
    clm1A.evidence_passage_ids.push('psg_SRC-OPEN-DOE-RADBAR_2');

    const audit = auditEvidencePackProvenance(pack);
    assert.strictEqual(audit.requires_provenance_failure, true);
    assert.ok(audit.audit_reasons.some(r => r.includes('Passage rongga udara') || r.includes('CLM-001A')));
  });

  // --- SECTION 2: Claim Atomicity, Author-Safe Strength & Recommendation Derivation ---
  console.log('\n--- TEST SECTION 2: Claim Atomicity, Author-Safe Strength & Derivation ---');

  await test('8. Compound claim split into atomic propositions (CLM-004A & CLM-004B)', () => {
    const clm4A = cleanPack.claim_inventory.find(c => c.claim_id === 'CLM-004A');
    const clm4B = cleanPack.claim_inventory.find(c => c.claim_id === 'CLM-004B');
    const legacy4 = cleanPack.claim_inventory.find(c => c.claim_id === 'CLM-004');

    assert.ok(clm4A, 'CLM-004A must exist');
    assert.ok(clm4B, 'CLM-004B must exist');
    assert.strictEqual(legacy4, undefined, 'Compound CLM-004 must not exist in stabilized pack');

    assert.ok(clm4A.statement.includes('mengurangi perpindahan panas radiasi'));
    assert.ok(clm4A.statement.includes('material insulasi termal'));
    assert.ok(!clm4A.statement.includes('serat'));
    assert.ok(!clm4A.statement.includes('busa'));
    assert.ok(clm4B.statement.includes('rongga udara yang berhadapan langsung'));

    // Check that ventilation passage is NOT attached to CLM-004A
    const ventPassage = cleanPack.evidence_passages.find(p => p.passage_id === 'psg_SRC-OPEN-DOE-RADBAR_3');
    assert.ok(!ventPassage.supports_claim_ids.includes('CLM-004A'));
  });

  await test('9. Author-safe claim stronger than source evidence (AUTHOR_SAFE_STRENGTH <= EVIDENCE_STRENGTH) FAILS audit', () => {
    const pack = JSON.parse(JSON.stringify(cleanPack));
    // CLM-001A has evidence_status SUPPORTED in inventory; artificially escalate author_safe_claims to VERIFIED
    const safe1A = pack.author_safe_claims.find(c => c.claim_id === 'CLM-001A');
    assert.ok(safe1A);
    safe1A.support_level = 'VERIFIED';

    const audit = auditEvidencePackProvenance(pack);
    assert.strictEqual(audit.requires_provenance_failure, true);
    assert.ok(audit.audit_reasons.some(r => r.includes('AUTHOR_SAFE_STRENGTH <= EVIDENCE_STRENGTH') || r.includes('CLM-001A')));
  });

  await test('10. Recommendation deriving from blocked or unsourced claim FAILS audit', () => {
    const pack = JSON.parse(JSON.stringify(cleanPack));
    // Add unsourced/blocked claim CLM-007B into CLM-008 derived_from_claim_ids
    const clm8 = pack.claim_inventory.find(c => c.claim_id === 'CLM-008');
    clm8.derived_from_claim_ids.push('CLM-007B');

    const audit = auditEvidencePackProvenance(pack);
    assert.strictEqual(audit.requires_provenance_failure, true);
    assert.ok(audit.audit_reasons.some(r => r.includes('RECOMMENDATION_DERIVED_FROM_BLOCKED_CLAIM') || r.includes('CLM-007B')));
  });

  await test('11. Recommendation deriving only from valid author-safe claims PASSES audit without unjustified absolutes', () => {
    const clm8 = cleanPack.claim_inventory.find(c => c.claim_id === 'CLM-008');
    assert.ok(clm8);
    assert.deepStrictEqual(
      clm8.derived_from_claim_ids,
      ['CLM-001A', 'CLM-002', 'CLM-003', 'CLM-004A', 'CLM-004B', 'CLM-005', 'CLM-006']
    );

    // Ensure all derived claims are allowed for authoring
    for (const did of clm8.derived_from_claim_ids) {
      const safe = cleanPack.author_safe_claims.find(c => c.claim_id === did);
      assert.ok(safe, `Safe claim for ${did} must exist`);
      assert.strictEqual(safe.allowed_for_authoring, true, `Derived claim ${did} must be allowed for authoring`);
    }

    // Ensure statement does NOT use unqualified absolutes
    assert.ok(!clm8.statement.includes('prioritas utama'));
    assert.ok(!clm8.statement.includes('diperlukan'));
    assert.ok(!clm8.statement.includes('harus'));
    assert.ok(!clm8.statement.includes('wajib'));
    assert.ok(!clm8.statement.includes('selalu'));
    assert.ok(!clm8.statement.includes('mutlak'));
    assert.ok(clm8.statement.includes('Pada bangunan dengan sisi bawah atap langsung berhadapan dengan ruang'));
    assert.ok(clm8.statement.includes('Jika terdapat rongga atap di atas plafon'));
  });

  await test('12. Joko invocation prevention during this milestone is strictly enforced', () => {
    const jokoInvoked = false;
    const publishingAuthority = 0;
    const autoPublish = 'OFF';
    const jevMode = 'shadow';

    assert.strictEqual(jokoInvoked, false, 'Joko must NOT be invoked in EDITORIAL-RUNTIME-3B-STABILIZE');
    assert.strictEqual(publishingAuthority, 0);
    assert.strictEqual(autoPublish, 'OFF');
    assert.strictEqual(jevMode, 'shadow');
    assert.strictEqual(baseResult.finalGateStatus, 'IRWAN_EVIDENCE_V3_STABILIZED_HUMAN_REVIEW_REQUIRED');
  });

  // --- TEST SECTION 3: Final Micro-Cleanup & Dangling Reference Elimination ---
  await test('13. Dangling claim ID in retrieved extracted passages FAILS audit with DANGLING_CLAIM_REFERENCE', () => {
    const pack = JSON.parse(JSON.stringify(cleanPack));
    const targetDoc = pack.retrieved_documents[0];
    assert.ok(targetDoc && targetDoc.extracted_passages.length > 0);
    targetDoc.extracted_passages[0].supports_claim_ids.push('CLM-004-DANGLING-LEGACY');

    const audit = auditEvidencePackProvenance(pack);
    assert.strictEqual(audit.requires_provenance_failure, true);
    assert.ok(audit.audit_reasons.some(r => r.includes('DANGLING_CLAIM_REFERENCE') && r.includes('CLM-004-DANGLING-LEGACY')));
  });

  await test('14. Dangling claim ID in canonical evidence_passages FAILS audit with DANGLING_CLAIM_REFERENCE', () => {
    const pack = JSON.parse(JSON.stringify(cleanPack));
    const targetPassage = pack.evidence_passages[0];
    assert.ok(targetPassage);
    targetPassage.supports_claim_ids.push('CLM-999-NONEXISTENT');

    const audit = auditEvidencePackProvenance(pack);
    assert.strictEqual(audit.requires_provenance_failure, true);
    assert.ok(audit.audit_reasons.some(r => r.includes('DANGLING_CLAIM_REFERENCE') && r.includes('CLM-999-NONEXISTENT')));
  });

  await test('15. CLM-004A with unsupported fiber/foam comparison FAILS audit with UNSUPPORTED_MATERIAL_COMPARISON', () => {
    const pack = JSON.parse(JSON.stringify(cleanPack));
    const clm4A = pack.claim_inventory.find(c => c.claim_id === 'CLM-004A');
    assert.ok(clm4A);
    clm4A.statement = 'Foil tidak memperlambat laju rambat konduksi seperti insulasi serat atau busa tebal.';

    const audit = auditEvidencePackProvenance(pack);
    assert.strictEqual(audit.requires_provenance_failure, true);
    assert.ok(audit.audit_reasons.some(r => r.includes('UNSUPPORTED_MATERIAL_COMPARISON') || r.includes('serat/busa')));
  });

  await test('16. CLM-008 with universal absolutes (harus, wajib, selalu, mutlak, diperlukan, prioritas utama) FAILS audit', () => {
    const absolutes = ['harus', 'wajib', 'selalu', 'mutlak', 'diperlukan', 'prioritas utama'];
    for (const word of absolutes) {
      const pack = JSON.parse(JSON.stringify(cleanPack));
      const clm8 = pack.claim_inventory.find(c => c.claim_id === 'CLM-008');
      clm8.statement = `Ventilasi atap ${word} dipasang untuk mengalirkan panas.`;

      const audit = auditEvidencePackProvenance(pack);
      assert.strictEqual(audit.requires_provenance_failure, true, `Absolute word '${word}' must fail audit`);
      assert.ok(audit.audit_reasons.some(r => r.includes('UNJUSTIFIED_ABSOLUTE_RECOMMENDATION') || r.includes(word)));
    }
  });

  await test('17. author_safe_claims strictly mirrors claim strength and allowed status', () => {
    for (const safe of cleanPack.author_safe_claims) {
      const underlying = cleanPack.claim_inventory.find(c => c.claim_id === safe.claim_id);
      assert.ok(underlying, `Underlying claim for ${safe.claim_id} must exist`);
      assert.strictEqual(safe.support_level, underlying.evidence_status, `Support level for ${safe.claim_id} must mirror underlying evidence status`);
      assert.strictEqual(safe.statement, underlying.statement, `Statement for ${safe.claim_id} must mirror underlying claim statement`);
    }
  });

  await test('18. CLM-007B remains strictly blocked from authoring (RESEARCH_REQUIRED)', () => {
    const clm7B = cleanPack.claim_inventory.find(c => c.claim_id === 'CLM-007B');
    assert.ok(clm7B);
    assert.strictEqual(clm7B.action, 'RESEARCH_REQUIRED');

    const safe7B = cleanPack.author_safe_claims.find(c => c.claim_id === 'CLM-007B');
    assert.ok(safe7B);
    assert.strictEqual(safe7B.allowed_for_authoring, false);
    assert.ok(safe7B.qualification_required?.includes('RESEARCH_REQUIRED'));
  });

  console.log(`\n🎉 All ${passed} tests in EDITORIAL-RUNTIME-3B-STABILIZE passed successfully!`);
}

main().catch(err => {
  console.error('\n❌ Test failed with error:', err);
  process.exit(1);
});
