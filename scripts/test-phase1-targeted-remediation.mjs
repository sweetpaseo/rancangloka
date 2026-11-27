/**
 * Test Suite: Phase 1 Targeted Remediation Verification
 * Verifies the 5 targeted remediation fixes identified in Hosted Hermes's authentic operational audit:
 * 1. OLCI Memory Write Governance (fail-closed, explicit authorization scope)
 * 2. Second Brain Retrieval (onlyValidated enforcement)
 * 3. Editorial Curiosity Principle (Gate A.1b blocking on new drafts, exempt on legacy)
 * 4. Canonical Staff Runtime Integration (Maya, SEON, Dimas, JEV in active roster)
 * 5. Primary Brain loader for SEON and Maya
 */

import assert from 'node:assert';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';

import {
  writeMemoryNote,
  withMemoryWriteAuthorization,
  isSharedMemoryWriteEnabled
} from '../src/lib/editorial/shared-memory-adapter.ts';

import {
  recordExperience,
  getStaffExperiences,
  getStaffPrimaryBrain
} from '../src/lib/editorial/olci-manager.ts';

import { evaluateArticleDoD } from '../src/lib/editorial/article-definition-of-done.ts';
import { getMissionControlOrganization } from '../src/lib/mission-control/index.ts';
import { getStaffDefinitionByAgentId } from '../src/lib/mission-control/staff-registry.ts';

console.log('=== TEST SUITE: PHASE 1 TARGETED REMEDIATION ===\n');

let passedTests = 0;
let totalTests = 0;

function runTest(name, fn) {
  totalTests++;
  try {
    fn();
    console.log(`  [PASS] ${name}`);
    passedTests++;
  } catch (err) {
    console.error(`  [FAIL] ${name}`);
    console.error(`         ${err.message}`);
    throw err;
  }
}

// -------------------------------------------------------------
// 1. OLCI Memory Write Governance
// -------------------------------------------------------------
console.log('--- 1. OLCI Memory Write Governance ---');

runTest('1.1 Unauthorized memory write throws READ_ONLY_VIOLATION by default', () => {
  // Ensure write is not globally enabled
  delete process.env.ENABLE_SHARED_MEMORY_WRITES;
  assert.strictEqual(isSharedMemoryWriteEnabled(), false);

  assert.throws(
    () => {
      recordExperience({
        experience_id: 'EXP-TEST-UNAUTHORIZED',
        staff_id: 'content_writer_primary',
        observed_at: new Date().toISOString(),
        kind: 'writing_craft',
        observation: 'Attempting unauthorized write without permission',
        action: 'None',
        outcome: 'Should be blocked',
        lesson: 'Testing fail-closed memory security',
        validation: 'unverified'
      });
    },
    (err) => {
      return err.message.includes('[SharedMemory:READ_ONLY_VIOLATION]');
    },
    'Should throw READ_ONLY_VIOLATION when not authorized'
  );
});

runTest('1.2 Authorized memory write succeeds inside withMemoryWriteAuthorization scope', () => {
  // Temporary isolated folder for test write
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'rl-mem-test-'));
  const prevEnv = process.env.SHARED_MEMORY_DIR;
  process.env.SHARED_MEMORY_DIR = tempDir;

  try {
    const auth = {
      authorized: true,
      staff_id: 'content_writer_primary',
      reason: 'Automated remediation test verification',
      approved_by: 'owner_test_harness'
    };

    const result = withMemoryWriteAuthorization(auth, () => {
      return recordExperience({
        experience_id: 'EXP-TEST-AUTHORIZED-001',
        staff_id: 'content_writer_primary',
        observed_at: new Date().toISOString(),
        kind: 'writing_craft',
        observation: 'Controlled authorized write within approved test scope',
        action: 'Supplied valid MemoryWriteAuthorization',
        outcome: 'Successfully written to isolated store',
        lesson: 'Verifying scoped write permissions',
        validation: 'verified'
      });
    });

    assert.strictEqual(result.success, true);
    assert.ok(fs.existsSync(result.filePath), 'Target file should exist on disk');
  } finally {
    process.env.SHARED_MEMORY_DIR = prevEnv;
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
});

// -------------------------------------------------------------
// 2. Second Brain Retrieval & onlyValidated Enforcement
// -------------------------------------------------------------
console.log('\n--- 2. Second Brain Retrieval & onlyValidated ---');

runTest('2.1 getStaffExperiences with onlyValidated: true excludes unverified records', () => {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'rl-sb-test-'));
  const prevEnv = process.env.SHARED_MEMORY_DIR;
  process.env.SHARED_MEMORY_DIR = tempDir;

  try {
    const jokoDir = path.join(tempDir, '06-staff-memory', 'joko-author');
    fs.mkdirSync(jokoDir, { recursive: true });

    // 1. Create a verified experience
    fs.writeFileSync(
      path.join(jokoDir, 'EXP-JOKO-VERIFIED.md'),
      `---
experience_id: "EXP-JOKO-VERIFIED"
staff_id: "content_writer_primary"
article_ref: "ART-TEST-001"
kind: "writing_craft"
observed_at: "2026-11-27T10:00:00Z"
validation: "verified"
---

# Experience: EXP-JOKO-VERIFIED (WRITING_CRAFT)

**Staff Role:** \`content_writer_primary\`  
**Article Reference:** \`ART-TEST-001\`  
**Observed At:** 2026-11-27T10:00:00Z  
**Validation Status:** \`verified\`  

## 1. Observation
Verified acoustics observation about sound dampening insulation.

## 6. Durable Lesson Learned
Always provide grounded acoustic decibel context.
`
    );

    // 2. Create an unverified/hypothesis experience
    fs.writeFileSync(
      path.join(jokoDir, 'EXP-JOKO-UNVERIFIED.md'),
      `---
experience_id: "EXP-JOKO-UNVERIFIED"
staff_id: "content_writer_primary"
article_ref: "ART-TEST-002"
kind: "writing_craft"
observed_at: "2026-11-27T10:00:00Z"
validation: "unverified"
---

# Experience: EXP-JOKO-UNVERIFIED (WRITING_CRAFT)

**Staff Role:** \`content_writer_primary\`  
**Article Reference:** \`ART-TEST-002\`  
**Observed At:** 2026-11-27T10:00:00Z  
**Validation Status:** \`unverified\`  

## 1. Observation
Unverified acoustics observation without experimental evidence.
`
    );

    // Retrieval with onlyValidated: true
    const verifiedOnly = getStaffExperiences('content_writer_primary', {
      onlyValidated: true,
      context_ref: 'acoustics'
    });

    assert.strictEqual(verifiedOnly.length, 1, 'Should only return 1 verified experience');
    assert.strictEqual(verifiedOnly[0].experience_id, 'EXP-JOKO-VERIFIED');

    // Retrieval without onlyValidated
    const all = getStaffExperiences('content_writer_primary', {
      onlyValidated: false,
      context_ref: 'acoustics'
    });
    assert.strictEqual(all.length, 2, 'Should return both when onlyValidated is false');
  } finally {
    process.env.SHARED_MEMORY_DIR = prevEnv;
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
});

// -------------------------------------------------------------
// 3. Editorial Curiosity Principle in Quality Gates (DoD Gate A.1b)
// -------------------------------------------------------------
console.log('\n--- 3. Editorial Curiosity Principle Gate Enforcement ---');

runTest('3.1 Non-compliant headline on new draft article is BLOCKED', () => {
  const evalResult = evaluateArticleDoD({
    id: 10040,
    title: 'Panduan Lengkap Memilih Seng Gelombang Anti Karat untuk Atap Rumah', // Statement, no '?'
    slug: 'panduan-memilih-seng-gelombang',
    category: 'Material',
    content_md: `
# Panduan Lengkap Memilih Seng Gelombang Anti Karat untuk Atap Rumah

Pernahkah Anda bertanya-tanya mengapa atap seng cepat berkarat? Mari kita teliti faktanya.

## Karakteristik Seng
Seng gelombang memiliki ketebalan bervariasi.

## Kesimpulan
Pilihlah bahan yang tepat untuk jangka panjang.
    `.trim(),
    reading_time: 5,
    focus_keyword: 'seng gelombang',
    status: 'draft'
  });

  const gateA1b = evalResult.gateA.checks.find(c => c.id === 'A.1b_EDITORIAL_CURIOSITY');
  assert.ok(gateA1b, 'Gate A.1b check must exist');
  assert.strictEqual(gateA1b.status, 'BLOCKED', 'New draft without question headline must be BLOCKED');
  assert.strictEqual(evalResult.gateA.status, 'BLOCKED', 'Gate A must fail');
  assert.strictEqual(evalResult.summary.isEditorialDraftReady, false, 'Draft readiness must fail');
});

runTest('3.2 Compliant natural question headline on new draft article is PASS', () => {
  const evalResult = evaluateArticleDoD({
    id: 10041,
    title: 'Kenapa Seng Gelombang Cepat Panas dan Berisik Saat Hujan?',
    slug: 'kenapa-seng-gelombang-cepat-panas',
    category: 'Material',
    content_md: `
Pernahkah Anda terbangun di tengah malam karena suara hujan deras di atas atap seng gelombang terdengar seperti dentuman drum? Rasa penasaran pemilik rumah tentang peredaman suara ini sangat wajar.

Seng gelombang memang menghantarkan panas dan suara dengan cepat karena sifat fisiknya. Solusinya adalah insulasi aluminium foil dan glasswool yang terpasang rapat.

Pilihlah material insulasi yang tepat agar rumah tetap sejuk dan senyap.
    `.trim(),
    reading_time: 4,
    focus_keyword: 'seng gelombang',
    status: 'draft',
    // Supply other minimums to let other checks pass or check gate A specifically
    hero_image: '/images/hero.webp',
    reading_path_category: 'Material'
  });

  const gateA1b = evalResult.gateA.checks.find(c => c.id === 'A.1b_EDITORIAL_CURIOSITY');
  assert.ok(gateA1b, 'Gate A.1b check must exist');
  assert.strictEqual(gateA1b.status, 'PASS', 'Compliant draft must PASS Gate A.1b');
});

runTest('3.3 Legacy published article is exempted from forced ECP BLOCKED status', () => {
  const evalResult = evaluateArticleDoD({
    id: 10,
    title: 'Tips Memilih Cat Tembok Eksterior Tahan Cuaca', // Non-question legacy title
    slug: 'tips-memilih-cat-tembok',
    category: 'Material',
    content_md: `
Memilih cat tembok eksterior membutuhkan ketelitian.

Berikut panduannya.
    `.trim(),
    reading_time: 3,
    status: 'published'
  });

  const gateA1b = evalResult.gateA.checks.find(c => c.id === 'A.1b_EDITORIAL_CURIOSITY');
  assert.ok(gateA1b, 'Gate A.1b check must exist');
  assert.notStrictEqual(gateA1b.status, 'BLOCKED', 'Legacy published article must NOT be BLOCKED');
  assert.strictEqual(gateA1b.status, 'WARNING', 'Legacy article receives non-blocking WARNING');
});

// -------------------------------------------------------------
// 4. Canonical Staff Runtime Integration & Separation
// -------------------------------------------------------------
console.log('\n--- 4. Canonical Staff Runtime Integration ---');

runTest('4.1 getMissionControlOrganization registers all 10 canonical staff members', () => {
  const org = getMissionControlOrganization(null);
  assert.ok(org, 'Mission control org must return snapshot');
  assert.ok(Array.isArray(org.staff), 'org.staff must be an array');
  assert.ok(org.staff.length >= 10, `Expected at least 10 staff members, got ${org.staff.length}`);

  const maya = org.staff.find(s => s.agent_id === 'maya');
  assert.ok(maya, 'Maya must be in staff roster');
  assert.strictEqual(maya.role, 'Head of Content Strategy, Planning & Audience Intelligence');

  const seon = org.staff.find(s => s.agent_id === 'seo_specialist_lead');
  assert.ok(seon, 'SEON must be in staff roster');
  assert.strictEqual(seon.role, 'Search Intent & Topic Selector Specialist');

  const dimas = org.staff.find(s => s.agent_id === 'telemetry_observer_jev');
  assert.ok(dimas, 'Dimas must be in staff roster');
  assert.strictEqual(dimas.display_name, 'Dimas');

  const jefry = org.staff.find(s => s.agent_id === 'management_advisor_jefry');
  assert.ok(jefry, 'JEV/Jefry must be in staff roster');
  assert.strictEqual(jefry.display_name, 'Jefry');
});

runTest('4.2 JEV and Dimas aliases remain strictly separated with zero conflation', () => {
  const resolvedJev = getStaffDefinitionByAgentId('jev');
  assert.ok(resolvedJev, 'Alias jev must resolve');
  assert.strictEqual(resolvedJev.agent_id, 'management_advisor_jefry');
  assert.strictEqual(resolvedJev.role, 'Management Decision Advisor');

  const resolvedDimas = getStaffDefinitionByAgentId('dimas');
  assert.ok(resolvedDimas, 'Alias dimas must resolve');
  assert.strictEqual(resolvedDimas.agent_id, 'telemetry_observer_jev');
  assert.strictEqual(resolvedDimas.role, 'Telemetry & JEV Systems Operator');

  assert.notStrictEqual(resolvedJev.agent_id, resolvedDimas.agent_id, 'JEV and Dimas must have distinct canonical IDs');
});

// -------------------------------------------------------------
// 5. Authoritative Primary Brain Loader
// -------------------------------------------------------------
console.log('\n--- 5. Primary Brain Loader ---');

runTest('5.1 getStaffPrimaryBrain loads SEON Primary Brain from shared memory', () => {
  const brain = getStaffPrimaryBrain('seo_specialist_lead');
  assert.strictEqual(brain.found, true, 'SEON Primary Brain must be found');
  assert.ok(brain.content && brain.content.length > 100, 'SEON Primary Brain content must be non-empty');
  assert.ok(brain.content.includes('SEON'), 'Content must mention SEON');
  assert.ok(brain.content.includes('Search Intent'), 'Content must include Search Intent guidance');
});

runTest('5.2 getStaffPrimaryBrain loads Maya Primary Brain from shared memory', () => {
  const brain = getStaffPrimaryBrain('maya');
  assert.strictEqual(brain.found, true, 'Maya Primary Brain must be found');
  assert.ok(brain.content && brain.content.length > 100, 'Maya Primary Brain content must be non-empty');
  assert.ok(brain.content.includes('Maya'), 'Content must mention Maya');
});

console.log(`\n======================================================`);
console.log(`ALL TESTS PASSED: ${passedTests}/${totalTests}`);
console.log(`======================================================\n`);
