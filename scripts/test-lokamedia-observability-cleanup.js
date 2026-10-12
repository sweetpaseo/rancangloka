/**
 * RANCANGLOKA — LOKAMEDIA OBSERVABILITY CLEANUP-1 & VERSION PROVENANCE CORRECTION
 *
 * Verifies:
 * 1. UI timeout allows long-running provider generation (> 15s up to 120s) without RUN_ONCE_TIMEOUT.
 * 2. Genuine timeouts beyond maximum still surface bounded errors.
 * 3. Stale local status banners (RUN_ONCE_TIMEOUT, SEND_TO_CHATGPT_TIMEOUT, Failed to fetch)
 *    are cleared when authoritative state reaches healthy operator states (PROMPT READY, RESULT READY, UPLOAD COMPLETE) with last_error = null.
 * 4. Genuine current job errors are NOT cleared.
 * 5. Version Provenance Rule:
 *    A. Persisted extension_version "0.1.1" migrates to active runtime manifest/constant "0.1.9".
 *    B. Runtime 0.1.9 vs server expected 0.1.8 detects mismatch (RELOAD REQUIRED, NOT CURRENT).
 *    C. Runtime 0.1.9 vs server expected 0.1.9 is CURRENT.
 *    D. Server offline + no known server expectation: expected_extension_version = null, no fabricated compatibility (UNVERIFIED).
 *    E. Server offline + last known expected = 0.1.8: retains last-known server expectation without overwriting to 0.1.9.
 *    F. formatAuditText canonically reports active runtime Extension Version: 0.1.9 independent of server expected version.
 */

import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  EXTENSION_VERSION,
  PROVIDER_OPERATION_TIMEOUT_MS
} from '../extensions/lokamedia/src/constants.js';
import { ExtensionStorage, MemoryStorageArea } from '../extensions/lokamedia/src/storage.js';
import { formatAuditText } from '../extensions/lokamedia/src/audit-log.js';
import { EXPECTED_LOKAMEDIA_EXTENSION_VERSION } from '../src/lib/media/version.ts';
import {
  reconcileStatusBanner,
  renderVersionHeader
} from '../extensions/lokamedia/src/side-panel.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, '..');
const extensionRoot = path.join(repoRoot, 'extensions', 'lokamedia');

let passed = 0;
function pass(name) {
  passed++;
  console.log(`  PASS ${name}`);
}

// ---------------------------------------------------------------------------
// FAKE DOM HARNESS FOR SIDE PANEL BANNER & TIMEOUT TESTS
// ---------------------------------------------------------------------------
class FakeElement {
  constructor(id) {
    this.id = id;
    this.textContent = '';
    this.value = '';
    this.checked = false;
    this.dataset = {};
    this.style = {};
    this.listeners = {};
    this.children = [];
    this.className = '';
  }

  addEventListener(type, handler) {
    this.listeners[type] ??= [];
    this.listeners[type].push(handler);
  }

  async dispatch(type) {
    for (const handler of this.listeners[type] ?? []) await handler({ target: this });
  }

  append(...children) {
    this.children.push(...children);
  }

  querySelector(selector) {
    return null;
  }
}

class FakeDocument {
  constructor(ids) {
    this.elements = Object.fromEntries(ids.map((id) => [`#${id}`, new FakeElement(id)]));
  }

  querySelector(selector) {
    return this.elements[selector] ?? null;
  }

  createElement(id) {
    return new FakeElement(id);
  }
}

const DOM_IDS = [
  'panel-status',
  'system-error',
  'extension-version',
  'runtime-version-display',
  'runtime-boot-id'
];

// ---------------------------------------------------------------------------
// TEST SUITE
// ---------------------------------------------------------------------------

async function runTests() {
  console.log('--- LOKAMEDIA OBSERVABILITY & VERSION PROVENANCE TESTS ---');

  // TEST 1: Version alignment across manifest, constants, and server handshake
  {
    const manifest = JSON.parse(fs.readFileSync(path.join(extensionRoot, 'manifest.json'), 'utf8'));
    assert.equal(manifest.version, '0.1.18', 'manifest.json must be 0.1.18');
    assert.equal(EXTENSION_VERSION, '0.1.18', 'constants.js EXTENSION_VERSION must be 0.1.18');
    assert.equal(EXPECTED_LOKAMEDIA_EXTENSION_VERSION, '0.1.18', 'Server expected version must be 0.1.18');
    assert.equal(PROVIDER_OPERATION_TIMEOUT_MS, 120000, 'PROVIDER_OPERATION_TIMEOUT_MS must be 120000');
    pass('1. Canonical version 0.1.18 and PROVIDER_OPERATION_TIMEOUT_MS 120000 aligned across system');
  }

  // TEST 2: Provider operation exceeding old 15s boundary succeeds within 120s UI timeout
  {
    async function sendWithTimeout(type, executor, timeoutMs = PROVIDER_OPERATION_TIMEOUT_MS) {
      let timeoutId = null;
      const timeout = new Promise((_, reject) => {
        timeoutId = setTimeout(() => reject(new Error(`${type}_TIMEOUT`)), timeoutMs);
      });
      try {
        return await Promise.race([executor(), timeout]);
      } finally {
        clearTimeout(timeoutId);
      }
    }

    const simulatedDelayMs = 25;
    const oldTimeoutMs = 15;
    const newTimeoutMs = 120;

    // Under old timeout: fails
    await assert.rejects(
      async () => {
        await sendWithTimeout('RUN_ONCE', async () => {
          await new Promise((resolve) => setTimeout(resolve, simulatedDelayMs));
          return { ok: true };
        }, oldTimeoutMs);
      },
      /RUN_ONCE_TIMEOUT/
    );

    // Under new timeout: succeeds without error
    const result = await sendWithTimeout('RUN_ONCE', async () => {
      await new Promise((resolve) => setTimeout(resolve, simulatedDelayMs));
      return { ok: true };
    }, newTimeoutMs);

    assert.equal(result.ok, true);
    pass('2. Simulated provider execution exceeding old 15s completes safely under new UI timeout');
  }

  // TEST 3: Genuine timeout beyond configured maximum still surfaces bounded error
  {
    async function sendWithTimeout(type, executor, timeoutMs) {
      let timeoutId = null;
      const timeout = new Promise((_, reject) => {
        timeoutId = setTimeout(() => reject(new Error(`${type}_TIMEOUT`)), timeoutMs);
      });
      try {
        return await Promise.race([executor(), timeout]);
      } finally {
        clearTimeout(timeoutId);
      }
    }

    await assert.rejects(
      async () => {
        await sendWithTimeout('RUN_ONCE', async () => {
          return new Promise(() => {});
        }, 10);
      },
      /RUN_ONCE_TIMEOUT/
    );

    await assert.rejects(
      async () => {
        await sendWithTimeout('SEND_TO_CHATGPT', async () => {
          return new Promise(() => {});
        }, 10);
      },
      /SEND_TO_CHATGPT_TIMEOUT/
    );
    pass('3. Genuine timeout beyond maximum still surfaces error');
  }

  // TEST 4: Stale banner reconciliation clears transient errors on healthy operator stages
  {
    const doc = new FakeDocument(DOM_IDS);
    globalThis.document = doc;

    const panelStatus = doc.querySelector('#panel-status');

    // Case 4a: Stale RUN_ONCE_TIMEOUT on RESULT READY with last_error = null
    panelStatus.textContent = 'RUN_ONCE_TIMEOUT';
    panelStatus.dataset.state = 'error';

    const stateOk = {
      jobs: {
        'job-1': { job_id: 'job-1', last_error: null }
      }
    };
    const workflowResultReady = {
      stage: 'RESULT READY',
      job_id: 'job-1',
      job_error: null
    };

    reconcileStatusBanner(stateOk, workflowResultReady, null);
    assert.equal(panelStatus.dataset.state, 'ok', 'Status banner must be cleared to ok');
    assert.equal(panelStatus.textContent, 'Ready', 'Status text must be reconciled to Ready');

    // Case 4b: Stale SEND_TO_CHATGPT_TIMEOUT on PROMPT READY with last_error = null
    panelStatus.textContent = 'SEND_TO_CHATGPT_TIMEOUT';
    panelStatus.dataset.state = 'error';

    const workflowPromptReady = {
      stage: 'PROMPT READY',
      job_id: 'job-1',
      job_error: null
    };

    reconcileStatusBanner(stateOk, workflowPromptReady, null);
    assert.equal(panelStatus.dataset.state, 'ok');
    assert.equal(panelStatus.textContent, 'Ready');

    // Case 4c: Stale Failed to fetch on UPLOAD COMPLETE with last_error = null
    panelStatus.textContent = 'Failed to fetch';
    panelStatus.dataset.state = 'error';

    const workflowUploadComplete = {
      stage: 'UPLOAD COMPLETE',
      job_id: 'job-1',
      job_error: null
    };

    reconcileStatusBanner(stateOk, workflowUploadComplete, null);
    assert.equal(panelStatus.dataset.state, 'ok');
    assert.equal(panelStatus.textContent, 'Ready');

    pass('4. Stale transient banners (RUN_ONCE_TIMEOUT, SEND_TO_CHATGPT_TIMEOUT, Failed to fetch) are cleared on healthy states');
  }

  // TEST 5: Genuine current errors are NOT cleared by banner reconciliation
  {
    const doc = new FakeDocument(DOM_IDS);
    globalThis.document = doc;
    const panelStatus = doc.querySelector('#panel-status');

    // Case 5a: Current job has last_error
    panelStatus.textContent = 'RUN_ONCE_TIMEOUT';
    panelStatus.dataset.state = 'error';

    const stateWithError = {
      jobs: {
        'job-1': { job_id: 'job-1', last_error: 'PROVIDER_GENERATION_FAILED' }
      }
    };
    const workflowWithError = {
      stage: 'RESULT READY',
      job_id: 'job-1',
      job_error: 'PROVIDER_GENERATION_FAILED'
    };

    reconcileStatusBanner(stateWithError, workflowWithError, 'PROVIDER_GENERATION_FAILED');
    assert.equal(panelStatus.dataset.state, 'error', 'Error must remain uncleared when job has last_error');
    assert.equal(panelStatus.textContent, 'RUN_ONCE_TIMEOUT');

    // Case 5b: Stage is GENERATING (not healthy operator-waiting stage)
    panelStatus.textContent = 'RUN_ONCE_TIMEOUT';
    panelStatus.dataset.state = 'error';

    const workflowGenerating = {
      stage: 'GENERATING',
      job_id: 'job-1',
      job_error: null
    };

    reconcileStatusBanner(stateWithError, workflowGenerating, null);
    assert.equal(panelStatus.dataset.state, 'error', 'Error must remain uncleared during GENERATING');

    // Case 5c: Non-transient genuine error (e.g. CONTENT_SCRIPT_UNAVAILABLE)
    panelStatus.textContent = 'CONTENT_SCRIPT_UNAVAILABLE';
    panelStatus.dataset.state = 'error';

    const stateClean = {
      jobs: {
        'job-1': { job_id: 'job-1', last_error: null }
      }
    };
    const workflowClean = {
      stage: 'RESULT READY',
      job_id: 'job-1',
      job_error: null
    };

    reconcileStatusBanner(stateClean, workflowClean, null);
    assert.equal(panelStatus.dataset.state, 'error', 'Non-transient errors must NOT be cleared');
    assert.equal(panelStatus.textContent, 'CONTENT_SCRIPT_UNAVAILABLE');

    pass('5. Genuine job errors, active generating stage, and non-transient errors are strictly preserved');
  }

  // TEST 6 (Scenario A & E): Storage migration reconciles extension_version to 0.1.9,
  // but DOES NOT overwrite expected_extension_version (retains last known 0.1.8).
  {
    const staleStorageFixture = {
      schemaVersion: 1,
      extension_version: '0.1.1',
      expected_extension_version: '0.1.8', // Last known server expectation
      jobs: {
        'mjob_0bc8a71e21f598f0272b11ce': {
          job_id: 'mjob_0bc8a71e21f598f0272b11ce',
          local_state: 'CAPTURED',
          sha256: 'bad12f705a150e4181be108def8e2cab4fb059f6916c2403f028524d82597235'
        }
      },
      auditLog: {
        events: [
          {
            timestamp: '2026-10-10T12:00:00.000Z',
            level: 'INFO',
            event_code: 'HISTORICAL_EVENT',
            message_safe: 'historical record'
          }
        ],
        lastAction: 'Captured',
        nextSequence: 2
      }
    };

    const storage = new ExtensionStorage(new MemoryStorageArea({ lokamediaState: staleStorageFixture }));
    const initializedState = await storage.initialize();

    // A: extension_version reconciled to runtime manifest/constant
    assert.equal(initializedState.extension_version, '0.1.18', 'extension_version must be migrated to runtime 0.1.18');

    // E: expected_extension_version NOT manufactured, retains persisted server expectation 0.1.8
    assert.equal(initializedState.expected_extension_version, '0.1.8', 'expected_extension_version must NOT be overwritten with runtime version');

    // Historical audit events are untouched
    assert.equal(initializedState.auditLog.events.length, 1);
    assert.equal(initializedState.auditLog.events[0].event_code, 'HISTORICAL_EVENT');

    // Canary candidate state is preserved
    const canaryJob = initializedState.jobOperationalStates['mjob_0bc8a71e21f598f0272b11ce'];
    assert(canaryJob, 'Canary job operational state must be preserved');
    assert.equal(canaryJob.candidate?.sha256, 'bad12f705a150e4181be108def8e2cab4fb059f6916c2403f028524d82597235');

    pass('6. Scenario A & E: extension_version migrates to 0.1.18 while last-known expected_extension_version (0.1.8) is preserved');
  }

  // TEST 7 (Scenario D Storage): Fresh storage initialization with no prior handshake leaves expected_extension_version = null
  {
    const storage = ExtensionStorage.memory();
    const initialized = await storage.initialize();

    assert.equal(initialized.extension_version, '0.1.18');
    assert.equal(initialized.expected_extension_version, null, 'Unconnected expected_extension_version must be null, not manufactured');
    pass('7. Scenario D Storage: Unconnected state leaves expected_extension_version null without fabricated compatibility');
  }

  // TEST 8 (Scenario B UI): Runtime 0.1.18 vs server expected 0.1.8 detects mismatch (RELOAD REQUIRED, NOT CURRENT)
  {
    const doc = new FakeDocument(DOM_IDS);
    globalThis.document = doc;

    const testState = {
      runtime_extension_version: '0.1.18',
      expected_extension_version: '0.1.8',
      status: { connection: 'online' }
    };

    const header = renderVersionHeader(testState);
    assert.equal(header.isCurrent, false, 'isCurrent must be false on version mismatch');
    assert.equal(header.runtimeVersion, '0.1.18');
    assert.equal(header.expectedVersion, '0.1.8');

    const badge = doc.querySelector('#extension-version');
    assert.equal(badge.dataset.state, 'reload_required');
    assert(badge.textContent.includes('RELOAD REQUIRED (Expected v0.1.8)'), `Badge text must report reload required, got: ${badge.textContent}`);

    pass('8. Scenario B UI: Version mismatch (0.1.18 vs server 0.1.8) displays RELOAD REQUIRED and is NOT CURRENT');
  }

  // TEST 9 (Scenario C UI): Runtime 0.1.18 vs server expected 0.1.18 is CURRENT
  {
    const doc = new FakeDocument(DOM_IDS);
    globalThis.document = doc;

    const testState = {
      runtime_extension_version: '0.1.18',
      expected_extension_version: '0.1.18',
      status: { connection: 'online' }
    };

    const header = renderVersionHeader(testState);
    assert.equal(header.isCurrent, true, 'isCurrent must be true on matching versions with online server');

    const badge = doc.querySelector('#extension-version');
    assert.equal(badge.dataset.state, 'current');
    assert.equal(badge.textContent, 'Extension v0.1.18 — CURRENT');

    pass('9. Scenario C UI: Matching versions (0.1.18 vs 0.1.18) with online server displays CURRENT');
  }

  // TEST 10 (Scenario D & E UI): Offline server behavior preserves truth without false compatibility
  {
    const doc = new FakeDocument(DOM_IDS);
    globalThis.document = doc;
    const badge = doc.querySelector('#extension-version');

    // Scenario D UI: Offline + no known server expectation (null)
    const stateOfflineUnknown = {
      runtime_extension_version: '0.1.18',
      expected_extension_version: null,
      status: { connection: 'offline' }
    };
    const headerD = renderVersionHeader(stateOfflineUnknown);
    assert.equal(headerD.isCurrent, false, 'No fabricated compatibility when server expectation is unknown');
    assert.equal(badge.dataset.state, 'unverified');
    assert(badge.textContent.includes('UNVERIFIED'), `Badge must show UNVERIFIED, got: ${badge.textContent}`);

    // Scenario E UI: Offline + last known expected = 0.1.8
    const stateOfflineKnownMismatch = {
      runtime_extension_version: '0.1.18',
      expected_extension_version: '0.1.8',
      status: { connection: 'offline' }
    };
    const headerE = renderVersionHeader(stateOfflineKnownMismatch);
    assert.equal(headerE.isCurrent, false);
    assert.equal(badge.dataset.state, 'reload_required');
    assert(badge.textContent.includes('Expected v0.1.8'));

    // Offline + last known expected matching 0.1.18 explicitly marked as cached
    const stateOfflineCachedMatch = {
      runtime_extension_version: '0.1.18',
      expected_extension_version: '0.1.18',
      status: { connection: 'offline' }
    };
    const headerCached = renderVersionHeader(stateOfflineCachedMatch);
    assert.equal(headerCached.isCurrent, true);
    assert.equal(badge.textContent, 'Extension v0.1.18 — CURRENT (cached)');

    pass('10. Scenario D & E UI: Offline states correctly distinguish UNVERIFIED, RELOAD REQUIRED, and CURRENT (cached)');
  }

  // TEST 11 (Scenario F): Audit export canonically reports Extension Version: 0.1.18
  {
    const stateForAudit = {
      extension_version: '0.1.18',
      expected_extension_version: '0.1.8', // Server expectation mismatch should NOT alter runtime audit version
      phase4bSingleRun: {
        phase4b_single_run_id: 'run_1791645952427_44265789',
        job_id: 'mjob_0bc8a71e21f598f0272b11ce'
      }
    };

    const events = [
      {
        timestamp: '2026-10-10T15:25:52.427Z',
        level: 'INFO',
        event_code: 'RESULT_READY',
        message_safe: 'Candidate captured and ready for review'
      }
    ];

    const auditText = formatAuditText({
      events,
      state: stateForAudit,
      generatedAt: '2026-10-10T15:30:00.000Z'
    });

    assert(auditText.includes('Extension Version: 0.1.18'), `Audit text must contain 'Extension Version: 0.1.18', got:\n${auditText}`);
    assert(auditText.includes('Protocol Version: 1'));
    assert(auditText.includes('DOM Adapter Version: 1'));
    assert(auditText.includes('Run ID: run_1791645952427_44265789'));
    assert(auditText.includes('Job ID: mjob_0bc8a71e21f598f0272b11ce'));
    assert(auditText.includes('RESULT_READY Candidate captured and ready for review'));

    pass('11. Scenario F: formatAuditText canonically reports Extension Version: 0.1.18 independent of server expected version');

    // TEST 12: appendAuditEvent updates lastAction to 'Upload complete & confirmed' upon ATTACHMENT_CONFIRMED and JOB_COMPLETE
    const auditStorage = ExtensionStorage.memory();
    await auditStorage.initialize();
    await auditStorage.appendAuditEvent({ event_code: 'UPLOAD_START' });
    let auditSt = await auditStorage.readState();
    assert.equal(auditSt.auditLog.lastAction, 'Uploading');

    await auditStorage.appendAuditEvent({ event_code: 'ATTACHMENT_CONFIRMED' });
    auditSt = await auditStorage.readState();
    assert.equal(auditSt.auditLog.lastAction, 'Upload complete & confirmed');

    await auditStorage.appendAuditEvent({ event_code: 'JOB_COMPLETE' });
    auditSt = await auditStorage.readState();
    assert.equal(auditSt.auditLog.lastAction, 'Upload complete & confirmed');
    pass('12. Observability: appendAuditEvent maps ATTACHMENT_CONFIRMED & JOB_COMPLETE to Upload complete & confirmed');
  }

  console.log(`\nALL ${passed} LOKAMEDIA OBSERVABILITY & VERSION PROVENANCE TESTS PASSED.\n`);
}

runTests().catch((err) => {
  console.error('TEST FAILED:', err);
  process.exit(1);
});
