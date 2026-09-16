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

  append(child) {
    this.children.push(child);
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
  'server',
  'token',
  'enabled',
  'run-once',
  'save',
  'diagnostic',
  'panel-status'
];

function state(patch = {}) {
  return {
    status: { connection: 'online', transfers: [{ label: 'Article #79 Cover', percentage: 71 }], last_error: null },
    counters: { totalJobs: 17, active: 1, waiting: 12, complete: 4 },
    config: { serverBaseUrl: 'http://localhost:4321', enabled: false },
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

async function installSidePanel({ failProvider = false, initialState = state() } = {}) {
  const doc = new FakeDocument(ids);
  const messages = [];
  let currentState = initialState;
  globalThis.document = doc;
  globalThis.chrome = {
    runtime: {
      lastError: null,
      async sendMessage(message) {
        messages.push(message);
        if (message.type === 'STATUS') return { ok: true, state: currentState };
        if (message.type === 'SAVE_CONFIG') return { ok: true };
        if (message.type === 'RUN_ONCE') {
          currentState = waitingState({ phase4bSingleRun: { submission_consumed: true } });
          return { ok: true, state: currentState };
        }
        if (message.type === 'READ_ONLY_PROVIDER_DIAGNOSTIC') {
          if (failProvider) return { ok: false, error: 'CONTENT_SCRIPT_UNAVAILABLE' };
          return { ok: true, state: state({ provider: { chatgpt: { ...state().provider.chatgpt, visible_image_candidates: 6 } } }) };
        }
        throw new Error(`unexpected message ${message.type}`);
      }
    }
  };
  globalThis.addEventListener = () => {};
  await import(`../extensions/lokamedia/src/side-panel.js?case=${Date.now()}-${Math.random()}`);
  await settle();
  return { doc, messages };
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

async function testRunOnceControl() {
  const { doc, messages } = await installSidePanel({ initialState: waitingState() });
  assert.equal(doc.querySelector('#current-article').textContent, 'LokaMedia Phase 4B Controlled Generation Test');
  assert.equal(doc.querySelector('#current-slot').textContent, 'featured');
  assert.equal(doc.querySelector('#current-operation').textContent, 'Waiting');
  assert.equal(doc.querySelector('#run-once').disabled, false);
  await doc.querySelector('#run-once').dispatch('click');
  await settle();
  assert(messages.some((message) => message.type === 'RUN_ONCE'));
  assert.equal(doc.querySelector('#run-once').disabled, true);
  assert.match(doc.querySelector('#run-once').textContent, /Running|Run consumed|Complete|Needs attention/);
  pass('Run Once appears for the waiting Phase 4B job and disables immediately after use');
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
await testRunOnceControl();
await testErrorAndRunGuard();
await testLayoutHasResponsiveRules();

console.log(`Side panel tests passed: ${passed}`);
