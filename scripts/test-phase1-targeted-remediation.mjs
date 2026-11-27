/**
 * Test Suite: Phase 1 Targeted Remediation & Memory Governance Verification
 * 
 * Verifies the final memory governance acceptance criteria:
 * - TEST ISOLATION: PASS (Controlling RANCANGLOKA_SHARED_MEMORY_DIR & SHARED_MEMORY_DIR)
 * - UNAUTHORIZED: WRITE BLOCKED (Throws READ_ONLY_VIOLATION)
 * - AUTHORIZED: WRITE ALLOWED (Succeeds inside isolated tempDir)
 * - LEGACY OVERRIDE: WRITE BLOCKED (allowWriteOverride: true fails closed)
 * - FORGED AUTHORIZATION: WRITE BLOCKED (Throws FORGED_AUTHORIZATION_VIOLATION)
 * - MISMATCHED STAFF AUTHORIZATION: WRITE BLOCKED (Throws MISMATCHED_STAFF_AUTHORIZATION_VIOLATION)
 * - SECOND BRAIN RETRIEVAL: PASS (onlyValidated: true filters strictly verified records)
 * - EDITORIAL CURIOSITY PRINCIPLE: PASS (Gate A.1b blocks non-compliant new drafts, exempts legacy)
 * - CANONICAL STAFF RUNTIME INTEGRATION: PASS (Maya, SEON, Dimas, JEV distinct in active roster)
 * - PRIMARY BRAIN LOADER: PASS (SEON & Maya Primary Brains loaded)
 */

import assert from 'node:assert';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';

import {
  writeMemoryNote,
  withMemoryWriteAuthorization,
  isSharedMemoryWriteEnabled,
  resolveSharedMemoryDir
} from '../src/lib/editorial/shared-memory-adapter.ts';

import {
  recordExperience,
  getStaffExperiences,
  getStaffPrimaryBrain
} from '../src/lib/editorial/olci-manager.ts';

import { evaluateArticleDoD } from '../src/lib/editorial/article-definition-of-done.ts';
import { getMissionControlOrganization } from '../src/lib/mission-control/index.ts';
import { getStaffDefinitionByAgentId } from '../src/lib/mission-control/staff-registry.ts';

console.log('=== TEST SUITE: PHASE 1 FINAL MEMORY GOVERNANCE & REMEDIATION ===\n');

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

/**
 * Execute a test function with complete directory isolation by controlling
 * BOTH RANCANGLOKA_SHARED_MEMORY_DIR and SHARED_MEMORY_DIR environment variables.
 */
function withIsolatedMemory(fn) {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'rl-mem-iso-'));
  const prevRancangloka = process.env.RANCANGLOKA_SHARED_MEMORY_DIR;
  const prevShared = process.env.SHARED_MEMORY_DIR;

  process.env.RANCANGLOKA_SHARED_MEMORY_DIR = tempDir;
  process.env.SHARED_MEMORY_DIR = tempDir;

  try {
    return fn(tempDir);
  } finally {
    if (prevRancangloka !== undefined) {
      process.env.RANCANGLOKA_SHARED_MEMORY_DIR = prevRancangloka;
    } else {
      delete process.env.RANCANGLOKA_SHARED_MEMORY_DIR;
    }
    if (prevShared !== undefined) {
      process.env.SHARED_MEMORY_DIR = prevShared;
    } else {
      delete process.env.SHARED_MEMORY_DIR;
    }
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
}

// -------------------------------------------------------------
// 1. Memory Governance & Test Isolation
// -------------------------------------------------------------
console.log('--- 1. Memory Governance & Test Isolation ---');

runTest('1.1 TEST ISOLATION: Environment variables route directory exclusively to isolated tempDir', () => {
  withIsolatedMemory((tempDir) => {
    const resolved = resolveSharedMemoryDir();
    assert.strictEqual(
      path.resolve(resolved),
      path.resolve(tempDir),
      'resolveSharedMemoryDir() must resolve to tempDir when env vars are set'
    );
  });
});

runTest('1.2 UNAUTHORIZED: WRITE BLOCKED - Attempting write without authorization throws READ_ONLY_VIOLATION', () => {
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
    (err) => err.message.includes('[SharedMemory:READ_ONLY_VIOLATION]'),
    'Should throw READ_ONLY_VIOLATION when not authorized'
  );
});

runTest('1.3 AUTHORIZED: WRITE ALLOWED - Valid MemoryWriteAuthorization succeeds inside isolated tempDir', () => {
  withIsolatedMemory((tempDir) => {
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
    assert.ok(result.filePath.startsWith(tempDir), 'File must be written strictly inside isolated tempDir');
  });
});

runTest('1.4 LEGACY OVERRIDE: WRITE BLOCKED - Passing allowWriteOverride: true fails closed', () => {
  delete process.env.ENABLE_SHARED_MEMORY_WRITES;
  assert.throws(
    () => {
      // @ts-ignore - testing deprecated legacy override rejection
      writeMemoryNote({
        category: '04-agent-handoffs',
        filename: 'legacy-override-attempt.md',
        authorStaff: 'content_writer_primary',
        content: 'Attempting write with legacy allowWriteOverride flag',
        allowWriteOverride: true
      });
    },
    (err) => err.message.includes('[SharedMemory:READ_ONLY_VIOLATION]'),
    'Legacy allowWriteOverride must be completely ignored and fail closed'
  );
});

runTest('1.5 FORGED AUTHORIZATION: WRITE BLOCKED - Incomplete or invalid authorization rejected', () => {
  // Test case A: authorized: false
  assert.throws(
    () => {
      writeMemoryNote({
        category: '04-agent-handoffs',
        filename: 'forged-auth-1.md',
        authorStaff: 'content_writer_primary',
        content: 'Forged authorization test',
        authorization: {
          authorized: false,
          staff_id: 'content_writer_primary',
          reason: 'Unauthorized reason',
          approved_by: 'unauthorized_entity'
        }
      });
    },
    (err) => err.message.includes('[SharedMemory:FORGED_AUTHORIZATION_VIOLATION]'),
    'authorized: false must be rejected'
  );

  // Test case B: missing approved_by
  assert.throws(
    () => {
      writeMemoryNote({
        category: '04-agent-handoffs',
        filename: 'forged-auth-2.md',
        authorStaff: 'content_writer_primary',
        content: 'Forged authorization test missing approved_by',
        // @ts-ignore
        authorization: {
          authorized: true,
          staff_id: 'content_writer_primary',
          reason: 'Valid reason but missing approved_by'
        }
      });
    },
    (err) => err.message.includes('[SharedMemory:FORGED_AUTHORIZATION_VIOLATION]'),
    'Missing approved_by must be rejected'
  );

  // Test case C: reason too short or missing
  assert.throws(
    () => {
      writeMemoryNote({
        category: '04-agent-handoffs',
        filename: 'forged-auth-3.md',
        authorStaff: 'content_writer_primary',
        content: 'Forged authorization test reason too short',
        authorization: {
          authorized: true,
          staff_id: 'content_writer_primary',
          reason: 'no',
          approved_by: 'owner'
        }
      });
    },
    (err) => err.message.includes('[SharedMemory:FORGED_AUTHORIZATION_VIOLATION]'),
    'Reason shorter than 5 characters must be rejected'
  );
});

runTest('1.6 MISMATCHED STAFF AUTHORIZATION: WRITE BLOCKED - authorStaff must match authorization staff_id', () => {
  assert.throws(
    () => {
      writeMemoryNote({
        category: '04-agent-handoffs',
        filename: 'mismatched-staff.md',
        authorStaff: 'rina',
        content: 'Attempting to write note as Rina using Joko authorization',
        authorization: {
          authorized: true,
          staff_id: 'joko',
          reason: 'Testing staff ID mismatch',
          approved_by: 'owner_test_harness'
        }
      });
    },
    (err) => err.message.includes('[SharedMemory:MISMATCHED_STAFF_AUTHORIZATION_VIOLATION]'),
    'Mismatched staff_id between author and authorization must be blocked'
  );
});

// -------------------------------------------------------------
// 2. Second Brain Retrieval & onlyValidated Enforcement
// -------------------------------------------------------------
console.log('\n--- 2. Second Brain Retrieval & onlyValidated ---');

runTest('2.1 getStaffExperiences with onlyValidated: true excludes unverified records', () => {
  withIsolatedMemory((tempDir) => {
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
  });
});

// -------------------------------------------------------------
// 3. Editorial Curiosity Principle in Quality Gates (DoD Gate A.1b)
// -------------------------------------------------------------
console.log('\n--- 3. Editorial Curiosity Principle Gate Enforcement ---');

runTest('3.1 Non-compliant headline on new draft article is BLOCKED', () => {
  const evalResult = evaluateArticleDoD({
    id: 10040,
    title: 'Panduan Lengkap Memilih Seng Gelombang Anti Karat untuk Atap Rumah',
    slug: 'panduan-memilih-seng-gelombang',
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
    content_md: `
Pernahkah Anda terbangun di tengah malam karena suara hujan deras di atas atap seng gelombang terdengar seperti dentuman drum? Rasa penasaran pemilik rumah tentang peredaman suara ini sangat wajar.

Seng gelombang memang menghantarkan panas dan suara dengan cepat karena sifat fisiknya. Solusinya adalah insulasi aluminium foil dan glasswool yang terpasang rapat.

Pilihlah material insulasi yang tepat agar rumah tetap sejuk dan senyap.
    `.trim(),
    reading_time: 4,
    focus_keyword: 'seng gelombang',
    status: 'draft',
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
    title: 'Tips Memilih Cat Tembok Eksterior Tahan Cuaca',
    slug: 'tips-memilih-cat-tembok',
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
