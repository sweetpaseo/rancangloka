/**
 * RancangLoka — LokaMedia native side panel tests.
 *
 * Synthetic extension UI tests only. No ChatGPT prompt, provider generation,
 * media job, D1, R2, article mutation, or deployment is performed.
 */

import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  normalizeProviderStatus,
  normalizeServerStatus,
  summarizeCurrentJob,
  summarizeTransfers,
  validateSidePanelElements,
  getJobWorkflowDetails
} from '../extensions/lokamedia/src/popup-core.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, '..');
const extensionRoot = path.join(repoRoot, 'extensions', 'lokamedia');
let passed = 0;

function pass(name) {
  passed++;
  console.log(`  PASS ${name}`);
}

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
    this.options = [];
    this.innerHTMLValue = '';
    this.className = '';
  }

  set innerHTML(value) {
    this.innerHTMLValue = value;
    this.children = [new FakeElement('label-span'), new FakeElement('label-strong'), new FakeElement('bar-span')];
    this.options = [];
  }

  get innerHTML() {
    return this.innerHTMLValue;
  }

  click() {
    this.clicked = true;
    return this.dispatch('click');
  }

  showPicker() {
    this.pickerShown = true;
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

  appendChild(child) {
    this.children.push(child);
    if (child.value !== undefined) {
      this.options.push(child);
    }
    return child;
  }

  querySelector(selector) {
    if (selector === 'span') return this.children[0] ?? null;
    if (selector === 'strong') return this.children[1] ?? null;
    if (selector === '.bar span') return this.children[2] ?? null;
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

function settle() {
  return new Promise((resolve) => setTimeout(resolve, 0));
}

const ids = [
  'extension-version',
  'connection-chatgpt',
  'connection-rancangloka',
  'current-article',
  'current-slot',
  'current-operation',
  'current-elapsed',
  'queue-total',
  'queue-active',
  'queue-waiting',
  'queue-complete',
  'transfers',
  'provider-tab',
  'provider-target',
  'provider-bound-tab',
  'provider-bound-url',
  'bind-tab',
  'provider-auth',
  'provider-dom',
  'provider-composer',
  'provider-images',
  'provider-lane',
  'system-server',
  'system-environment',
  'system-http-target',
  'system-backpressure',
  'system-error',
  'last-action',
  'server',
  'token',
  'environment-selector',
  'btn-switch-environment',
  'environment-badge',
  'enabled',
  'run-once',
  'run-once-reason',
  'runtime-version-display',
  'runtime-boot-id',
  'save',
  'diagnostic',
  'panel-status',
  'audit-filter',
  'audit-current-run',
  'audit-current-job',
  'audit-copy',
  'audit-export',
  'audit-clear',
  'audit-log',
  'workflow-stage',
  'workflow-guidance',
  'prompt-article-title',
  'prompt-slot',
  'prompt-dimensions',
  'prompt-text',
  'copy-prompt',
  'send-to-chatgpt',
  'capture-latest',
  'paste-image',
  'approve-upload',
  'reject-result',
  'result-preview-image',
  'preview-placeholder',
  'result-dimensions',
  'result-mime',
  'result-size',
  'result-sha256',
  'result-provenance',
  'assign-featured',
  'generating-card',
  'generating-job-id',
  'generating-run-id',
  'generating-provider-tab',
  'generating-elapsed',
  'result-preview-card',
  'manual-promotion-card',
  'manual-article-slug',
  'manual-btn-resolve',
  'manual-article-attestation',
  'manual-article-title',
  'manual-article-status',
  'manual-article-hash',
  'manual-current-featured',
  'manual-file-input',
  'manual-btn-select-file',
  'manual-candidate-preview-box',
  'manual-preview-image',
  'manual-candidate-filename',
  'manual-candidate-dimensions',
  'manual-candidate-mime',
  'manual-candidate-size',
  'manual-candidate-sha',
  'manual-status-banner',
  'manual-btn-approve',
  'manual-btn-check-status',
  'manual-btn-execute',
  'manual-btn-reset',
  'job-selector',
  'btn-copy-diagnostic-snapshot',
  'snapshot-status',
  'snapshot-fallback-container',
  'snapshot-fallback-text',
  'acquire-lease-container',
  'btn-acquire-lease'
];

function state(patch = {}) {
  return {
    status: { connection: 'online', transfers: [{ label: 'Article #79 Cover', percentage: 71 }], last_error: null },
    auditLog: { lastAction: 'Idle', events: [] },
    counters: { totalJobs: 17, active: 1, waiting: 12, complete: 4 },
    config: { serverBaseUrl: 'http://localhost:4321', deviceToken: 'saved-token', enabled: false },
    jobs: {
      active: {
        job_id: 'job-1',
        article_id: 81,
        slot_key: 'Bedroom image',
        local_state: 'GENERATING',
        submitted_at: new Date(Date.now() - 42000).toISOString()
      }
    },
    provider: {
      chatgpt: {
        provider_tab_id: 42,
        target_state: 'LOCKED',
        bound_tab_id: 42,
        bound_url: 'https://chatgpt.com/c/test',
        tab_status: 'connected',
        auth_state: 'AUTHENTICATED',
        dom_status: 'SUPPORTED',
        composer_status: 'ready',
        visible_image_candidates: 5,
        provider_lane: 'idle'
      }
    },
    ...patch
  };
}

function waitingState(patch = {}) {
  return state({
    status: { connection: 'online', transfers: [], last_error: null },
    config: { serverBaseUrl: 'http://localhost:4321', enabled: true },
    counters: { totalJobs: 1, active: 0, waiting: 1, complete: 0 },
    jobs: {
      waiting: {
        job_id: 'phase4b-job',
        article_id: 481,
        article_title: 'LokaMedia Phase 4B Controlled Generation Test',
        slot_key: 'featured',
        role: 'featured',
        local_state: 'QUEUED',
        status: 'QUEUED'
      }
    },
    ...patch
  });
}

async function installSidePanel({ failProvider = false, initialState = state(), diagnosticState = null } = {}) {
  const doc = new FakeDocument(ids);
  const messages = [];
  let currentState = initialState;
  const intervals = [];
  globalThis.document = doc;
  Object.defineProperty(globalThis, 'navigator', { value: { clipboard: { async writeText() {} } }, configurable: true });
  globalThis.setInterval = (handler) => {
    intervals.push(handler);
    return { unref() {} };
  };
  globalThis.clearInterval = () => {};
  globalThis.chrome = {
    runtime: {
      lastError: null,
      async sendMessage(message) {
        messages.push(message);
        if (message.type === 'STATUS') return { ok: true, state: currentState };
        if (message.type === 'SAVE_CONFIG') {
          currentState = { ...currentState, config: { ...currentState.config, ...message.config } };
          return { ok: true };
        }
        if (message.type === 'RUN_ONCE') {
          currentState = waitingState({
            phase4bSingleRun: { submission_consumed: true },
            auditLog: { lastAction: 'Run Once requested', events: [{ timestamp: new Date().toISOString(), level: 'INFO', event_code: 'RUN_REQUEST_ACCEPTED', message_safe: 'accepted' }] }
          });
          return { ok: true, state: currentState };
        }
        if (message.type === 'AUDIT_STATUS') return { ok: true, events: currentState.auditLog?.events ?? [], lastAction: currentState.auditLog?.lastAction ?? 'Idle' };
        if (message.type === 'AUDIT_COPY_TEXT') return { ok: true, text: 'LokaMedia Audit Log\nINFO RUN_REQUEST_ACCEPTED' };
        if (message.type === 'AUDIT_EXPORT_JSON') return { ok: true, payload: { events: currentState.auditLog?.events ?? [] } };
        if (message.type === 'AUDIT_CLEAR') {
          currentState = { ...currentState, auditLog: { events: [], lastAction: 'Idle' } };
          return { ok: true, state: currentState };
        }
        if (message.type === 'READ_ONLY_PROVIDER_DIAGNOSTIC') {
          if (failProvider) return { ok: false, error: 'CONTENT_SCRIPT_UNAVAILABLE' };
          return { ok: true, state: diagnosticState ?? state({ provider: { chatgpt: { ...state().provider.chatgpt, visible_image_candidates: 6 } } }) };
        }
        if (message.type === 'INGEST_MANUAL_CANDIDATE') {
          return { ok: true, state: currentState };
        }
        throw new Error(`unexpected message ${message.type}`);
      }
    }
  };
  globalThis.addEventListener = () => {};
  const mod = await import(`../extensions/lokamedia/src/side-panel.js?case=${Date.now()}-${Math.random()}`);
  await settle();
  return {
    doc,
    messages,
    mod,
    async tickRefresh() {
      for (const handler of intervals) {
        await handler();
        await settle();
      }
    }
  };
}

async function testManifestSidePanel() {
  const manifest = JSON.parse(fs.readFileSync(path.join(extensionRoot, 'manifest.json'), 'utf8'));
  assert(manifest.permissions.includes('sidePanel'));
  assert.equal(manifest.side_panel.default_path, 'src/side-panel.html');
  assert.equal(manifest.action.default_popup, undefined);
  assert(!JSON.stringify(manifest).includes('<all_urls>'));
  pass('manifest contains native side panel support and no canonical popup');
}

async function testCoreStateMapping() {
  assert.equal(validateSidePanelElements(new FakeDocument(ids)).ok, true);
  assert.equal(normalizeServerStatus(state()), 'online');
  assert.equal(normalizeProviderStatus(state().provider.chatgpt).auth, 'ready');
  assert.equal(summarizeCurrentJob(state()).article, 'Article #81');
  assert.equal(summarizeTransfers(state()).at(0).percentage, 71);
  pass('side panel core maps provider, server, current job, and transfer state');
}

async function testSidePanelInitializesAndRecovers() {
  const first = await installSidePanel();
  assert.equal(first.doc.querySelector('#connection-chatgpt').textContent, 'ready');
  assert.equal(first.doc.querySelector('#connection-rancangloka').textContent, 'online');
  const second = await installSidePanel();
  assert.equal(second.doc.querySelector('#provider-lane').textContent, 'idle');
  pass('side panel initializes and close/reopen recovers state from service worker');
}

async function testEnabledSaveProviderCheck() {
  const { doc, messages } = await installSidePanel();
  doc.querySelector('#enabled').checked = true;
  await doc.querySelector('#enabled').dispatch('change');
  assert.match(doc.querySelector('#panel-status').textContent, /save required/);
  doc.querySelector('#server').value = 'http://localhost:4321';
  doc.querySelector('#token').value = 'secret-token';
  await doc.querySelector('#save').dispatch('click');
  await settle();
  await doc.querySelector('#diagnostic').dispatch('click');
  await settle();
  await doc.querySelector('#diagnostic').dispatch('click');
  await settle();
  assert(messages.some((message) => message.type === 'SAVE_CONFIG'));
  assert.equal(messages.filter((message) => message.type === 'READ_ONLY_PROVIDER_DIAGNOSTIC').length, 2);
  assert.equal(doc.querySelector('#provider-images').textContent, '6');
  pass('Enabled toggle, Save, repeated Provider Check, and status refresh work');
}

async function testConfigDraftSurvivesRefreshAndPersists() {
  const { doc, messages, tickRefresh } = await installSidePanel();
  doc.querySelector('#enabled').checked = true;
  await doc.querySelector('#enabled').dispatch('change');
  doc.querySelector('#server').value = 'http://localhost:4321/custom';
  await doc.querySelector('#server').dispatch('input');
  doc.querySelector('#token').value = 'draft-token';
  await doc.querySelector('#token').dispatch('input');

  await tickRefresh();
  assert.equal(doc.querySelector('#enabled').checked, true);
  assert.equal(doc.querySelector('#server').value, 'http://localhost:4321/custom');
  assert.equal(doc.querySelector('#token').value, 'draft-token');

  await doc.querySelector('#save').dispatch('click');
  await settle();
  assert(messages.some((message) => message.type === 'SAVE_CONFIG' && message.config.enabled === true));
  assert.equal(doc.querySelector('#enabled').checked, true);
  assert.equal(doc.querySelector('#server').value, 'http://localhost:4321/custom');
  assert.equal(doc.querySelector('#token').value, 'draft-token');

  const reopened = await installSidePanel({
    initialState: state({ config: { serverBaseUrl: 'http://localhost:4321/custom', deviceToken: 'draft-token', enabled: true } })
  });
  assert.equal(reopened.doc.querySelector('#enabled').checked, true);
  assert.equal(reopened.doc.querySelector('#server').value, 'http://localhost:4321/custom');
  assert.equal(reopened.doc.querySelector('#token').value, 'draft-token');
  pass('config draft survives status refresh, Save persists, and reopen restores enabled state');
}

async function testRunOnceControl() {
  const { doc, messages } = await installSidePanel({ initialState: waitingState({ auditLog: { lastAction: 'Run Once requested', events: [{ timestamp: new Date().toISOString(), level: 'INFO', event_code: 'RUN_REQUEST_ACCEPTED', message_safe: 'accepted' }] } }) });
  assert.equal(doc.querySelector('#current-article').textContent, 'LokaMedia Phase 4B Controlled Generation Test');
  assert.equal(doc.querySelector('#current-slot').textContent, 'featured');
  assert.equal(doc.querySelector('#current-operation').textContent, 'Waiting');
  assert.equal(doc.querySelector('#run-once').disabled, false);
  await doc.querySelector('#run-once').dispatch('click');
  await settle();
  const runOnceMsg = messages.find((message) => message.type === 'RUN_ONCE');
  assert(runOnceMsg && typeof runOnceMsg.runId === 'string' && runOnceMsg.runId.startsWith('run_'), 'RUN_ONCE message must carry generated runId');
  assert(messages.some((message) => message.type === 'AUDIT_STATUS'));
  assert.equal(doc.querySelector('#run-once').disabled, true);
  assert.equal(doc.querySelector('#last-action').textContent, 'Run Once requested');
  assert.match(doc.querySelector('#run-once').textContent, /Running|Run consumed|Complete|Needs attention/);
  pass('Run Once appears for the waiting Phase 4B job and disables immediately after use');
}

async function testQueueVisibilityAndRunOnceArming() {
  const ready = waitingState();
  const { doc } = await installSidePanel({ initialState: ready, diagnosticState: ready });
  assert.equal(doc.querySelector('#queue-total').textContent, '1');
  assert.equal(doc.querySelector('#queue-active').textContent, '0');
  assert.equal(doc.querySelector('#queue-waiting').textContent, '1');
  assert.equal(doc.querySelector('#queue-complete').textContent, '0');
  assert.equal(doc.querySelector('#current-article').textContent, 'LokaMedia Phase 4B Controlled Generation Test');
  assert.equal(doc.querySelector('#current-slot').textContent, 'featured');
  assert.equal(doc.querySelector('#current-operation').textContent, 'Waiting');
  assert.equal(doc.querySelector('#run-once').disabled, false);

  const offline = await installSidePanel({ initialState: waitingState({ status: { ...waitingState().status, connection: 'offline' } }) });
  assert.equal(offline.doc.querySelector('#run-once').disabled, true);

  const disabled = await installSidePanel({ initialState: waitingState({ config: { ...waitingState().config, enabled: false } }) });
  assert.equal(disabled.doc.querySelector('#run-once').disabled, true);

  const providerUnavailable = await installSidePanel({
    initialState: waitingState({ provider: { chatgpt: { ...waitingState().provider.chatgpt, provider_lane: 'bound' } } })
  });
  assert.equal(providerUnavailable.doc.querySelector('#run-once').disabled, true);
  pass('existing queued job is visible and Run Once arms only when local prerequisites are ready');
}

async function testAuditControls() {
  const event = { timestamp: new Date().toISOString(), level: 'ERROR', event_code: 'RUN_FAILED', message_safe: 'Needs attention' };
  const { doc, messages } = await installSidePanel({ initialState: state({ auditLog: { lastAction: 'Needs attention - SUBMIT_FAILED', events: [event] } }) });
  await doc.querySelector('#audit-filter').dispatch('change');
  await settle();
  assert.equal(doc.querySelector('#last-action').textContent, 'Needs attention - SUBMIT_FAILED');
  assert.equal(doc.querySelector('#audit-log').children.length > 0, true);
  assert.match(doc.querySelector('#audit-log').children[0].children[0].textContent, /RUN_FAILED/);
  await doc.querySelector('#audit-filter').dispatch('change');
  await doc.querySelector('#audit-copy').dispatch('click');
  await doc.querySelector('#audit-clear').dispatch('click');
  await settle();
  assert(messages.some((message) => message.type === 'AUDIT_COPY_TEXT'));
  assert(messages.some((message) => message.type === 'AUDIT_CLEAR'));
  pass('audit log UI renders events and supports filter, copy, and isolated clear');
}

async function testErrorAndRunGuard() {
  const { doc, messages } = await installSidePanel({ failProvider: true });
  await doc.querySelector('#diagnostic').dispatch('click');
  await settle();
  assert.equal(doc.querySelector('#panel-status').dataset.state, 'error');
  assert.equal(doc.querySelector('#panel-status').textContent, 'CONTENT_SCRIPT_UNAVAILABLE');
  assert.equal(doc.querySelector('#run-once').disabled, true);
  assert(!messages.some((message) => message.type === 'TICK'));
  pass('provider errors are bounded and legacy TICK is not used');
}

async function testLayoutHasResponsiveRules() {
  const css = fs.readFileSync(path.join(extensionRoot, 'src', 'side-panel.css'), 'utf8');
  assert(css.includes('@media (max-width: 290px)'));
  assert(css.includes('minmax(0, 1fr)'));
  assert(!/width:\s*320px/.test(css));
  pass('side panel CSS avoids popup fixed width and has narrow-width behavior');
}

async function testDetectImageMime() {
  const { mod } = await installSidePanel();
  const { detectImageMime } = mod;

  // 1. Magic bytes
  const pngHeader = new Uint8Array([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A]);
  assert.equal(detectImageMime({ name: 'unknown', type: '' }, pngHeader), 'image/png');

  const jpgHeader = new Uint8Array([0xFF, 0xD8, 0xFF, 0xE0, 0x00, 0x10]);
  assert.equal(detectImageMime({ name: 'photo.jfif', type: '' }, jpgHeader), 'image/jpeg');

  const webpHeader = new Uint8Array([0x52, 0x49, 0x46, 0x46, 0x00, 0x00, 0x00, 0x00, 0x57, 0x45, 0x42, 0x50]);
  assert.equal(detectImageMime({ name: 'art', type: '' }, webpHeader), 'image/webp');

  // 2. Extension fallbacks
  assert.equal(detectImageMime({ name: 'diagram.jpg', type: '' }, new Uint8Array([])), 'image/jpeg');
  assert.equal(detectImageMime({ name: 'diagram.jpeg', type: '' }, new Uint8Array([])), 'image/jpeg');
  assert.equal(detectImageMime({ name: 'diagram.png', type: '' }, new Uint8Array([])), 'image/png');
  assert.equal(detectImageMime({ name: 'diagram.webp', type: '' }, new Uint8Array([])), 'image/webp');

  // 3. MIME normalization
  assert.equal(detectImageMime({ name: 'image', type: 'image/jpg' }, new Uint8Array([])), 'image/jpeg');
  assert.equal(detectImageMime({ name: 'image', type: 'image/pjpeg' }, new Uint8Array([])), 'image/jpeg');
  assert.equal(detectImageMime({ name: 'image', type: 'image/png' }, new Uint8Array([])), 'image/png');

  // 4. Rejection of invalid types
  assert.equal(detectImageMime({ name: 'doc.txt', type: 'text/plain' }, new Uint8Array([])), null);
  assert.equal(detectImageMime({ name: 'app.exe', type: 'application/octet-stream' }, new Uint8Array([])), null);
  assert.equal(detectImageMime({ name: 'anim.gif', type: 'image/gif' }, new Uint8Array([])), null);

  pass('detectImageMime accurately classifies PNG, JPEG, and WebP across magic bytes, extensions, and MIME aliases');
}

async function testImportFileRetiredAndActionRowClean() {
  const readyJobState = waitingState({
    jobs: {
      active: {
        job_id: 'mjob_art4_inline_thermal_dynamics',
        article_id: 4,
        slot_key: 'inline_concept_diagram_1',
        role: 'inline',
        local_state: 'LEASED',
        status: 'LEASED'
      }
    }
  });

  const { doc, mod } = await installSidePanel({ initialState: readyJobState });

  // Verify retired elements are not in DOM
  assert.equal(doc.querySelector('#import-file'), null, '#import-file button must not exist in DOM');
  assert.equal(doc.querySelector('#local-file-input'), null, '#local-file-input must not exist in DOM');
  assert.equal(doc.querySelector('#btn-select-file'), null, '#btn-select-file must not exist in DOM');

  // Verify action row contains ONLY capture-latest and paste-image
  assert(doc.querySelector('#capture-latest'), '#capture-latest must exist');
  assert(doc.querySelector('#paste-image'), '#paste-image must exist');

  // Verify workflow flags indicate import file is disabled/retired
  const wf = getJobWorkflowDetails(readyJobState);
  assert.equal(wf.can_import_file, false, 'can_import_file must be strictly false');
  assert.equal(wf.can_select_fallback_file, false, 'can_select_fallback_file must be strictly false');
  assert.equal(wf.can_paste_image, true, 'can_paste_image must remain true for active job');

  // Verify Reset Image button text in HTML
  const rawHtml = fs.readFileSync(path.resolve(__dirname, '../extensions/lokamedia/src/side-panel.html'), 'utf8');
  assert(rawHtml.includes('>Reset Image</button>'), 'Button label must be Reset Image');

  pass('testImportFileRetiredAndActionRowClean confirms Import File is removed from DOM, action row contains only Capture Latest and Paste Image, and Reject Result is renamed to Reset Image');
}

async function testExpiredLeaseAndCompletedJob() {
  // Expired lease
  const expiredState = waitingState({
    jobs: {
      active: {
        job_id: 'mjob_art4_inline_thermal_dynamics',
        article_id: 4,
        slot_key: 'inline_concept_diagram_1',
        role: 'inline',
        local_state: 'LEASED',
        status: 'LEASED',
        lease_expires_at: new Date(Date.now() - 60000).toISOString()
      }
    }
  });

  const { doc, mod } = await installSidePanel({ initialState: expiredState });
  const statusEl = doc.querySelector('#panel-status');

  const validPng = new Uint8Array([
    0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A,
    0x00, 0x00, 0x00, 0x0D,
    0x49, 0x48, 0x44, 0x52,
    0x00, 0x00, 0x05, 0x00, // width = 1280
    0x00, 0x00, 0x02, 0xD0, // height = 720
    0x08, 0x06, 0x00, 0x00, 0x00
  ]);
  const fakeBlob = new Blob([validPng], { type: 'image/png' });
  globalThis.navigator.clipboard.read = async () => [{
    types: ['image/png'],
    getType: async () => fakeBlob
  }];

  // In test harness, simulate backend rejecting with JOB_LEASE_EXPIRED
  globalThis.chrome.runtime.sendMessage = async (message) => {
    if (message.type === 'STATUS') return { ok: true, state: expiredState };
    if (message.type === 'INGEST_MANUAL_CANDIDATE') return { ok: false, error: 'JOB_LEASE_EXPIRED' };
    if (message.type === 'AUDIT_STATUS') return { ok: true, events: [] };
    return { ok: true };
  };

  await mod.handlePasteImage();
  await settle();

  assert(statusEl.textContent.includes('JOB_LEASE_EXPIRED'), 'Expired lease must surface actionable lease error');

  // Completed job check: can_paste_image should be disabled for COMPLETE job
  const completeState = waitingState({
    jobs: {
      completeJob: {
        job_id: 'mjob_art4_featured_hero',
        article_id: 4,
        slot_key: 'featured',
        role: 'featured',
        local_state: 'COMPLETE',
        status: 'COMPLETE'
      }
    }
  });
  const { doc: doc2 } = await installSidePanel({ initialState: completeState });
  const pasteBtn = doc2.querySelector('#paste-image');
  assert.equal(pasteBtn.disabled, true, 'Paste button must be disabled for completed job');

  pass('testExpiredLeaseAndCompletedJob verifies lease expiration error and complete job immutability');
}

async function testPasteImageRegression() {
  const readyJobState = waitingState({
    jobs: {
      active: {
        job_id: 'mjob_art4_inline_thermal_dynamics',
        article_id: 4,
        slot_key: 'inline_concept_diagram_1',
        role: 'inline',
        local_state: 'LEASED',
        status: 'LEASED'
      }
    }
  });

  const { doc, messages, mod } = await installSidePanel({ initialState: readyJobState });
  const validPng = new Uint8Array([
    0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A,
    0x00, 0x00, 0x00, 0x0D,
    0x49, 0x48, 0x44, 0x52,
    0x00, 0x00, 0x06, 0x40, // width = 1600
    0x00, 0x00, 0x03, 0x84, // height = 900
    0x08, 0x06, 0x00, 0x00, 0x00
  ]);
  const fakeBlob = new Blob([validPng], { type: 'image/png' });
  const clipboardItem = {
    types: ['image/png'],
    getType: async (type) => fakeBlob
  };
  globalThis.navigator.clipboard.read = async () => [clipboardItem];

  await mod.handlePasteImage();
  await settle();

  const pasteMsg = messages.find((m) => m.type === 'INGEST_MANUAL_CANDIDATE' && m.provenance === 'MANUAL_CLIPBOARD');
  assert(pasteMsg, 'handlePasteImage must dispatch INGEST_MANUAL_CANDIDATE with MANUAL_CLIPBOARD');
  assert.equal(pasteMsg.jobId, 'mjob_art4_inline_thermal_dynamics');
  assert.equal(pasteMsg.mime, 'image/png');
  assert.equal(pasteMsg.width, 1600, 'Paste image actual width must be preserved (1600)');
  assert.equal(pasteMsg.height, 900, 'Paste image actual height must be preserved (900)');
  pass('handlePasteImage regression passes cleanly without affecting Paste Image flow');
}

async function testStrictImageDimensionDecoding() {
  const { mod } = await installSidePanel();

  // 1. PNG: 1600x900
  const pngBytes = new Uint8Array([
    0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A,
    0x00, 0x00, 0x00, 0x0D,
    0x49, 0x48, 0x44, 0x52,
    0x00, 0x00, 0x06, 0x40, // 1600
    0x00, 0x00, 0x03, 0x84, // 900
    0x08, 0x06, 0x00, 0x00, 0x00
  ]);
  const pngDims = await mod.decodeImageDimensions(pngBytes.buffer, 'image/png');
  assert.equal(pngDims.width, 1600, 'PNG width must be accurately decoded from bytes');
  assert.equal(pngDims.height, 900, 'PNG height must be accurately decoded from bytes');

  // 2. JPEG: 1920x1080 (SOF0 marker)
  const jpegBytes = new Uint8Array([
    0xFF, 0xD8,                                     // SOI
    0xFF, 0xE0, 0x00, 0x10,                         // APP0 length 16
    0x4A, 0x46, 0x49, 0x46, 0x00, 0x01, 0x01, 0x00,
    0x00, 0x01, 0x00, 0x01, 0x00, 0x00,
    0xFF, 0xC0, 0x00, 0x11,                         // SOF0 length 17
    0x08,                                           // precision 8
    0x04, 0x38,                                     // height = 1080
    0x07, 0x80                                      // width = 1920
  ]);
  const jpegDims = await mod.decodeImageDimensions(jpegBytes.buffer, 'image/jpeg');
  assert.equal(jpegDims.width, 1920, 'JPEG width must be accurately decoded from SOF0');
  assert.equal(jpegDims.height, 1080, 'JPEG height must be accurately decoded from SOF0');

  // 3. WebP VP8X: 800x600
  // width: 800 - 1 = 799 (0x00031F -> 0x1F, 0x03, 0x00)
  // height: 600 - 1 = 599 (0x000257 -> 0x57, 0x02, 0x00)
  const webpBytes = new Uint8Array([
    0x52, 0x49, 0x46, 0x46, 0x20, 0x00, 0x00, 0x00, // "RIFF"
    0x57, 0x45, 0x42, 0x50,                         // "WEBP"
    0x56, 0x50, 0x38, 0x58,                         // "VP8X"
    0x0A, 0x00, 0x00, 0x00,
    0x00, 0x00, 0x00, 0x00,
    0x1F, 0x03, 0x00,                               // width 800
    0x57, 0x02, 0x00                                // height 600
  ]);
  const webpDims = await mod.decodeImageDimensions(webpBytes.buffer, 'image/webp');
  assert.equal(webpDims.width, 800, 'WebP VP8X width must be accurately decoded');
  assert.equal(webpDims.height, 600, 'WebP VP8X height must be accurately decoded');

  // 4. WebP VP8 (Lossy): 640x480
  const vp8LossyBytes = new Uint8Array([
    0x52, 0x49, 0x46, 0x46, 0x20, 0x00, 0x00, 0x00, // "RIFF"
    0x57, 0x45, 0x42, 0x50,                         // "WEBP"
    0x56, 0x50, 0x38, 0x20,                         // "VP8 "
    0x00, 0x00, 0x00, 0x00,
    0x00, 0x00, 0x00,
    0x9D, 0x01, 0x2A,                               // keyframe tag
    0x80, 0x02,                                     // width = 640
    0xE0, 0x01                                      // height = 480
  ]);
  const vp8Dims = await mod.decodeImageDimensions(vp8LossyBytes.buffer, 'image/webp');
  assert.equal(vp8Dims.width, 640, 'WebP VP8 lossy width must be accurately decoded');
  assert.equal(vp8Dims.height, 480, 'WebP VP8 lossy height must be accurately decoded');

  // 5. WebP VP8L (Lossless): 300x200
  // packed = (299) | (199 << 14)
  const packed = (299) | (199 << 14);
  const vp8LosslessBytes = new Uint8Array([
    0x52, 0x49, 0x46, 0x46, 0x20, 0x00, 0x00, 0x00,
    0x57, 0x45, 0x42, 0x50,
    0x56, 0x50, 0x38, 0x4C,                         // "VP8L"
    0x00, 0x00, 0x00, 0x00,
    0x2F,                                           // signature
    packed & 0xFF,
    (packed >> 8) & 0xFF,
    (packed >> 16) & 0xFF,
    (packed >> 24) & 0xFF
  ]);
  const vp8lDims = await mod.decodeImageDimensions(vp8LosslessBytes.buffer, 'image/webp');
  assert.equal(vp8lDims.width, 300, 'WebP VP8L lossless width must be accurately decoded');
  assert.equal(vp8lDims.height, 200, 'WebP VP8L lossless height must be accurately decoded');

  // 6. Corrupted / Truncated file fails closed (NEVER returns 1200x675 default)
  const corruptBytes = new Uint8Array([0x01, 0x02, 0x03, 0x04, 0x05, 0x06, 0x07, 0x08]);
  let decodeFailed = false;
  try {
    const badDims = await mod.decodeImageDimensions(corruptBytes.buffer, 'image/png');
    assert.fail(`Corrupted bytes must fail closed, instead returned: ${JSON.stringify(badDims)}`);
  } catch (err) {
    decodeFailed = true;
    assert(err.message.includes('IMAGE_DIMENSIONS_DECODE_FAILED'), 'Error must specify IMAGE_DIMENSIONS_DECODE_FAILED');
  }
  assert.equal(decodeFailed, true, 'Decoder must reject corrupt files and never fabricate default dimensions');

  // 7. ingestCandidatePipeline rejects invalid or unverified dimensions
  let pipelineFailed = false;
  try {
    await mod.ingestCandidatePipeline({
      targetJobId: 'job-1',
      arrayBuffer: new ArrayBuffer(10),
      mime: 'image/png',
      width: 0,
      height: 0,
      size: 10,
      provenance: 'MANUAL_FILE'
    });
  } catch (err) {
    pipelineFailed = true;
    assert(err.message.includes('INVALID_DIMENSIONS'), 'Pipeline must reject unverified/zero dimensions');
  }
  assert.equal(pipelineFailed, true, 'ingestCandidatePipeline must throw INVALID_DIMENSIONS when dimensions <= 0');

  pass('testStrictImageDimensionDecoding verifies PNG, JPEG, and WebP exact dimensions, and proves corrupt files fail closed with zero default substitution');
}

async function testCandidateDiscard() {
  const { doc, mod, messages } = await installSidePanel();
  const statusEl = doc.querySelector('#panel-status');
  const previewImg = doc.querySelector('#result-preview-image');
  const placeholderEl = doc.querySelector('#preview-placeholder');

  let activeState = waitingState({
    selectedJobId: 'mjob_art4_inline_thermal_dynamics',
    jobs: {
      active: {
        job_id: 'mjob_art4_inline_thermal_dynamics',
        article_id: 4,
        slot_key: 'inline_concept_diagram_1',
        role: 'inline',
        local_state: 'CAPTURED',
        status: 'LEASED',
        blob_key: 'blob_candidate_thermal_1',
        sha256: 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855',
        width: 1920,
        height: 1080,
        mime: 'image/png',
        size: 54321,
        provenance: 'MANUAL_FILE',
        source_provenance: 'MANUAL_FILE',
        lease_expires_at: new Date(Date.now() + 600000).toISOString()
      }
    },
    jobOperationalStates: {
      mjob_art4_inline_thermal_dynamics: {
        candidate: {
          job_id: 'mjob_art4_inline_thermal_dynamics',
          blob_key: 'blob_candidate_thermal_1',
          sha256: 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855',
          width: 1920,
          height: 1080,
          mime: 'image/png',
          size: 54321,
          provenance: 'MANUAL_FILE',
          source_provenance: 'MANUAL_FILE'
        }
      }
    }
  });

  globalThis.chrome.runtime.sendMessage = async (message) => {
    messages.push(message);
    if (message.type === 'STATUS') return { ok: true, state: activeState };
    if (message.type === 'AUDIT_STATUS') return { ok: true, events: [] };
    if (message.type === 'GET_BLOB_PREVIEW') {
      return { ok: true, dataUrl: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUg==' };
    }
    if (message.type === 'REJECT_RESULT') {
      activeState = waitingState({
        selectedJobId: 'mjob_art4_inline_thermal_dynamics',
        jobs: {
          active: {
            job_id: 'mjob_art4_inline_thermal_dynamics',
            article_id: 4,
            slot_key: 'inline_concept_diagram_1',
            role: 'inline',
            local_state: 'RESULT_REJECTED',
            status: 'LEASED',
            blob_key: null,
            sha256: null,
            lease_expires_at: new Date(Date.now() + 600000).toISOString()
          }
        },
        jobOperationalStates: {
          mjob_art4_inline_thermal_dynamics: {
            candidate: null
          }
        }
      });
      return { ok: true, status: 'RESULT_REJECTED', jobId: message.jobId, state: activeState };
    }
    return { ok: true };
  };

  await mod.refresh();
  await settle();

  // Verify initial candidate review display
  assert.equal(doc.querySelector('#result-dimensions').textContent, '1920 × 1080');
  assert.equal(doc.querySelector('#result-provenance').textContent, 'MANUAL_FILE');
  assert(doc.querySelector('#result-sha256').textContent.includes('e3b0c442'), 'Candidate short SHA must be displayed');
  assert.equal(doc.querySelector('#reject-result').disabled, false, 'Reset Image must be enabled when unapproved candidate exists');
  assert.equal(doc.querySelector('#reject-result').title, 'Reset this image (discard current unapproved candidate)');

  // Case 1: Operator cancels discard confirmation
  let confirmPromptSeen = '';
  globalThis.confirm = (msg) => {
    confirmPromptSeen = msg;
    return false;
  };

  messages.length = 0;
  await mod.rejectResult();
  await settle();

  assert.equal(confirmPromptSeen, 'Reset this image? The current unapproved candidate will be discarded. Your media job and previously uploaded assets will remain unchanged.', 'Confirmation prompt must match exact requested text');
  assert.equal(messages.filter((m) => m.type === 'REJECT_RESULT').length, 0, 'Zero messages must be dispatched when discard is cancelled');
  assert(statusEl.textContent.includes('Reset cancelled; existing candidate preserved'), 'Status must confirm reset was cancelled and candidate was preserved');
  assert.equal(doc.querySelector('#result-dimensions').textContent, '1920 × 1080', 'Dimensions must remain intact after cancelled discard');

  // Case 2: Operator confirms discard
  globalThis.confirm = () => true;
  await mod.rejectResult();
  await settle();

  const rejectMsg = messages.find((m) => m.type === 'REJECT_RESULT');
  assert(rejectMsg, 'REJECT_RESULT must be sent on confirmation');
  assert.equal(rejectMsg.jobId, 'mjob_art4_inline_thermal_dynamics', 'Explicit jobId must be sent with REJECT_RESULT');

  // Verify preview is completely discarded
  assert.equal(previewImg.style.display, 'none', 'Preview image must be hidden after discard');
  assert.equal(previewImg.src, '', 'Preview image src must be emptied');
  assert.equal(placeholderEl.style.display, 'block', 'Placeholder must be shown');
  assert.equal(placeholderEl.textContent, 'No image candidate captured', 'Placeholder must truthfully reflect zero candidate');
  assert.equal(doc.querySelector('#result-dimensions').textContent, '--');
  assert.equal(doc.querySelector('#result-sha256').textContent, '--');
  assert.equal(doc.querySelector('#result-provenance').textContent, '--');
  assert.equal(doc.querySelector('#reject-result').disabled, true, 'Reset Image must be disabled after discard');
  assert.equal(doc.querySelector('#reject-result').title, 'No unapproved candidate loaded to reset');
  assert(statusEl.textContent.includes('Image reset (candidate discarded, media job preserved)'), 'Truthful reset status message');

  // Case 3: Completed job cannot be discarded
  const completedState = waitingState({
    selectedJobId: 'mjob_art4_featured_hero',
    jobs: {
      active: {
        job_id: 'mjob_art4_featured_hero',
        article_id: 4,
        slot_key: 'featured',
        role: 'featured',
        local_state: 'COMPLETE',
        status: 'COMPLETE',
        blob_key: 'blob_hero_done',
        sha256: '1111222233334444555566667777888899990000111122223333444455556666'
      }
    }
  });
  globalThis.chrome.runtime.sendMessage = async (message) => {
    if (message.type === 'STATUS') return { ok: true, state: completedState };
    return { ok: true };
  };
  await mod.refresh();
  await settle();

  assert.equal(doc.querySelector('#reject-result').disabled, true, 'Reset Image must be disabled on completed job');
  assert.equal(doc.querySelector('#reject-result').title, 'Cannot reset an already uploaded or completed asset');

  await mod.rejectResult();
  await settle();
  assert(statusEl.textContent.includes('CANNOT_MUTATE_COMPLETED_JOB'), 'Attempting to discard completed asset must fail closed');

  pass('testCandidateDiscard verifies operator confirmation, cancellation preservation, explicit jobId discard, and complete asset protection');
}

async function testCandidateReplacementFlow() {
  const { doc, mod, messages } = await installSidePanel();
  const statusEl = doc.querySelector('#panel-status');

  const existingCandidateState = waitingState({
    selectedJobId: 'mjob_art4_inline_thermal_dynamics',
    jobs: {
      active: {
        job_id: 'mjob_art4_inline_thermal_dynamics',
        article_id: 4,
        slot_key: 'inline_concept_diagram_1',
        role: 'inline',
        local_state: 'CAPTURED',
        status: 'LEASED',
        blob_key: 'blob_candidate_thermal_old',
        sha256: '0000111122223333444455556666777788889999000011112222333344445555',
        width: 1280,
        height: 720,
        mime: 'image/png',
        size: 30000,
        provenance: 'MANUAL_FILE',
        source_provenance: 'MANUAL_FILE',
        lease_expires_at: new Date(Date.now() + 600000).toISOString()
      }
    },
    jobOperationalStates: {
      mjob_art4_inline_thermal_dynamics: {
        candidate: {
          job_id: 'mjob_art4_inline_thermal_dynamics',
          blob_key: 'blob_candidate_thermal_old',
          sha256: '0000111122223333444455556666777788889999000011112222333344445555',
          width: 1280,
          height: 720,
          mime: 'image/png',
          size: 30000,
          provenance: 'MANUAL_FILE',
          source_provenance: 'MANUAL_FILE'
        }
      }
    }
  });

  globalThis.chrome.runtime.sendMessage = async (message) => {
    messages.push(message);
    if (message.type === 'STATUS') return { ok: true, state: existingCandidateState };
    if (message.type === 'AUDIT_STATUS') return { ok: true, events: [] };
    if (message.type === 'GET_BLOB_PREVIEW') {
      return { ok: true, dataUrl: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUg==' };
    }
    if (message.type === 'INGEST_MANUAL_CANDIDATE') {
      return { ok: true };
    }
    return { ok: true };
  };

  await mod.refresh();
  await settle();

  // Case 1: Import File is retired; selectLocalFile is a safe no-op with status
  mod.selectLocalFile();
  assert(statusEl.textContent.includes('Import File retired by owner decision'), 'Status must confirm retirement');

  // Case 2: handlePasteImage with cancellation
  globalThis.confirm = () => false;
  let clipboardReadCalled = false;
  globalThis.navigator.clipboard.read = async () => {
    clipboardReadCalled = true;
    return [];
  };
  await mod.handlePasteImage();
  await settle();
  assert.equal(clipboardReadCalled, false, 'Clipboard must not be read when paste replacement is cancelled');
  assert(statusEl.textContent.includes('Paste cancelled; existing candidate preserved'), 'Status must confirm paste cancellation');

  // Case 3: captureLatestImage with cancellation
  globalThis.confirm = () => false;
  messages.length = 0;
  // Enable capture button artificially for test
  doc.querySelector('#capture-latest').disabled = false;
  // Trigger capture click
  doc.querySelector('#capture-latest').dispatch('click');
  await settle();
  assert.equal(messages.filter((m) => m.type === 'CAPTURE_LATEST_IMAGE').length, 0, 'CAPTURE_LATEST_IMAGE must not be sent when cancelled');
  assert(statusEl.textContent.includes('Capture cancelled; existing candidate preserved'), 'Status must confirm capture cancellation');

  // Case 4: Confirmed replacement via Paste Image
  globalThis.confirm = () => true;
  const newPngBytes = new Uint8Array([
    0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A,
    0x00, 0x00, 0x00, 0x0D,
    0x49, 0x48, 0x44, 0x52,
    0x00, 0x00, 0x07, 0x80, // width = 1920
    0x00, 0x00, 0x04, 0x38, // height = 1080
    0x08, 0x06, 0x00, 0x00, 0x00
  ]);
  const newBlob = new Blob([newPngBytes], { type: 'image/png' });
  globalThis.navigator.clipboard.read = async () => [{
    types: ['image/png'],
    getType: async () => newBlob
  }];

  messages.length = 0;
  await mod.handlePasteImage();
  await settle();

  const ingestMsg = messages.find((m) => m.type === 'INGEST_MANUAL_CANDIDATE');
  assert(ingestMsg, 'Confirmed replacement must dispatch INGEST_MANUAL_CANDIDATE');
  assert.equal(ingestMsg.provenance, 'MANUAL_CLIPBOARD');
  assert.equal(ingestMsg.width, 1920);
  assert.equal(ingestMsg.height, 1080);

  pass('testCandidateReplacementFlow verifies confirmation modal on active intake paths (Paste, Capture), cancellation preservation, and successful replacement dispatch');
}

await testManifestSidePanel();
await testCoreStateMapping();
await testSidePanelInitializesAndRecovers();
await testEnabledSaveProviderCheck();
await testConfigDraftSurvivesRefreshAndPersists();
await testRunOnceControl();
await testQueueVisibilityAndRunOnceArming();
await testAuditControls();
await testErrorAndRunGuard();
await testLayoutHasResponsiveRules();
await testDetectImageMime();
await testImportFileRetiredAndActionRowClean();
await testExpiredLeaseAndCompletedJob();
await testPasteImageRegression();
await testStrictImageDimensionDecoding();
await testCandidateDiscard();
await testCandidateReplacementFlow();

console.log(`Side panel tests passed: ${passed}`);
