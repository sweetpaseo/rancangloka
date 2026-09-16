/**
 * RancangLoka — LokaMedia popup control tests.
 *
 * Exercises popup DOM binding and runtime message behavior without Chrome,
 * ChatGPT, provider generation, media jobs, D1, R2, or article mutation.
 */

import assert from 'node:assert/strict';

import {
  normalizeProviderStatus,
  phase4bNotArmedResponse,
  validatePopupElements
} from '../extensions/lokamedia/src/popup-core.js';

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
    this.listeners = {};
  }

  addEventListener(type, handler) {
    this.listeners[type] ??= [];
    this.listeners[type].push(handler);
  }

  async dispatch(type) {
    for (const handler of this.listeners[type] ?? []) await handler({ target: this });
  }
}

class FakeDocument {
  constructor(ids) {
    this.elements = Object.fromEntries(ids.map((id) => [`#${id}`, new FakeElement(id)]));
  }

  querySelector(selector) {
    return this.elements[selector] ?? null;
  }
}

function settle() {
  return new Promise((resolve) => setTimeout(resolve, 0));
}

const ids = [
  'connection',
  'total',
  'active',
  'waiting',
  'complete',
  'server',
  'token',
  'enabled',
  'save',
  'tick',
  'diagnostic',
  'provider-tab',
  'provider-auth',
  'provider-dom',
  'provider-composer',
  'provider-images',
  'provider-lane',
  'popup-status'
];

function state(patch = {}) {
  return {
    status: { connection: 'offline' },
    counters: { totalJobs: 0, active: 0, waiting: 0, complete: 0 },
    config: { serverBaseUrl: 'http://localhost:4321', enabled: false },
    provider: {
      chatgpt: {
        tab_status: 'connected',
        auth_state: 'AUTHENTICATED',
        dom_status: 'SUPPORTED',
        composer_status: 'ready',
        visible_image_candidates: 2,
        provider_lane: 'idle',
        ...patch
      }
    }
  };
}

async function installPopup({ failProvider = false } = {}) {
  const doc = new FakeDocument(ids);
  const messages = [];
  globalThis.document = doc;
  globalThis.chrome = {
    runtime: {
      lastError: null,
      async sendMessage(message) {
        messages.push(message);
        if (message.type === 'STATUS') return { ok: true, state: state() };
        if (message.type === 'SAVE_CONFIG') return { ok: true };
        if (message.type === 'READ_ONLY_PROVIDER_DIAGNOSTIC') {
          if (failProvider) return { ok: false, error: 'CONTENT_SCRIPT_UNAVAILABLE' };
          return { ok: true, state: state({ visible_image_candidates: 3 }) };
        }
        throw new Error(`unexpected message ${message.type}`);
      }
    }
  };
  await import(`../extensions/lokamedia/src/popup.js?case=${Date.now()}-${Math.random()}`);
  await new Promise((resolve) => setTimeout(resolve, 0));
  return { doc, messages };
}

async function testCoreMapping() {
  assert.equal(validatePopupElements(new FakeDocument(ids)).ok, true);
  assert.deepEqual(normalizeProviderStatus(state().provider.chatgpt), {
    tab: 'connected',
    auth: 'ready',
    dom: 'supported',
    composer: 'ready',
    images: 2,
    lane: 'idle'
  });
  assert.equal(phase4bNotArmedResponse().error, 'PHASE_4B_NOT_ARMED');
  pass('popup core validates elements, maps provider status, and blocks Phase 4B run');
}

async function testPopupInitializesAndBinds() {
  const { doc } = await installPopup();
  assert.equal(doc.querySelector('#provider-tab').textContent, 'connected');
  assert.match(doc.querySelector('#popup-status').textContent, /Ready:/);
  pass('popup initializes and binds DOM controls');
}

async function testCheckboxAndSaveClick() {
  const { doc, messages } = await installPopup();
  doc.querySelector('#enabled').checked = true;
  await doc.querySelector('#enabled').dispatch('change');
  assert.match(doc.querySelector('#popup-status').textContent, /save required/);
  doc.querySelector('#server').value = 'http://localhost:4321';
  doc.querySelector('#token').value = 'local-token';
  await doc.querySelector('#save').dispatch('click');
  await settle();
  assert(messages.some((message) => message.type === 'SAVE_CONFIG'));
  assert.equal(doc.querySelector('#popup-status').textContent, 'Saved');
  pass('checkbox and Save button are interactive');
}

async function testProviderCheckSuccessAndRepeat() {
  const { doc, messages } = await installPopup();
  await doc.querySelector('#diagnostic').dispatch('click');
  await doc.querySelector('#diagnostic').dispatch('click');
  await settle();
  assert.equal(messages.filter((message) => message.type === 'READ_ONLY_PROVIDER_DIAGNOSTIC').length, 2);
  assert.equal(doc.querySelector('#provider-images').textContent, '3');
  assert.equal(doc.querySelector('#popup-status').textContent, 'Provider check complete');
  pass('Provider check succeeds and can be repeated');
}

async function testProviderCheckFailureFeedback() {
  const { doc } = await installPopup({ failProvider: true });
  await doc.querySelector('#diagnostic').dispatch('click');
  await settle();
  assert.equal(doc.querySelector('#popup-status').dataset.state, 'error');
  assert.equal(doc.querySelector('#popup-status').textContent, 'CONTENT_SCRIPT_UNAVAILABLE');
  pass('Provider check failure is visible and bounded');
}

async function testRunRemainsBlocked() {
  const { doc, messages } = await installPopup();
  await doc.querySelector('#tick').dispatch('click');
  await settle();
  assert(!messages.some((message) => message.type === 'TICK'));
  assert.equal(doc.querySelector('#popup-status').textContent, 'PHASE_4B_NOT_ARMED');
  pass('Run remains generation-safe and does not message TICK');
}

await testCoreMapping();
await testPopupInitializesAndBinds();
await testCheckboxAndSaveClick();
await testProviderCheckSuccessAndRepeat();
await testProviderCheckFailureFeedback();
await testRunRemainsBlocked();

console.log(`Popup control tests passed: ${passed}`);
