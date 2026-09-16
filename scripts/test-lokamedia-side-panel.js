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
  validateSidePanelElements
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
    this.innerHTMLValue = '';
    this.className = '';
  }

  set innerHTML(value) {
    this.innerHTMLValue = value;
    this.children = [new FakeElement('label-span'), new FakeElement('label-strong'), new FakeElement('bar-span')];
  }

  get innerHTML() {
    return this.innerHTMLValue;
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
  'provider-auth',
  'provider-dom',
  'provider-composer',
  'provider-images',
  'provider-lane',
  'system-server',
  'system-backpressure',
  'system-error',
  'last-action',
  'server',
  'token',
  'enabled',
  'run-once',
  'save',
  'diagnostic',
  'panel-status',
  'audit-filter',
  'audit-current-run',
  'audit-current-job',
  'audit-copy',
  'audit-export',
  'audit-clear',
  'audit-log'
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
        throw new Error(`unexpected message ${message.type}`);
      }
    }
  };
  globalThis.addEventListener = () => {};
  await import(`../extensions/lokamedia/src/side-panel.js?case=${Date.now()}-${Math.random()}`);
  await settle();
  return {
    doc,
    messages,
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
  assert(messages.some((message) => message.type === 'RUN_ONCE'));
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

console.log(`Side panel tests passed: ${passed}`);
