/**
 * RancangLoka — LokaMedia Phase 4A ChatGPT provider foundation tests.
 *
 * Synthetic fixtures only. No ChatGPT tab, prompt submission, model call, image
 * generation, download, or production service is touched.
 */

import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  CHATGPT_DOM_ADAPTER_VERSION,
  CHATGPT_ERROR_CODES,
  PROMPT_SUBMISSION_ENABLED
} from '../extensions/lokamedia/src/providers/chatgpt/constants.js';
import { ChatGptProviderAdapter } from '../extensions/lokamedia/src/providers/chatgpt/adapter.js';
import { detectChatGptCapabilities } from '../extensions/lokamedia/src/providers/chatgpt/capability-detector.js';
import { discoverCapturePaths } from '../extensions/lokamedia/src/providers/chatgpt/capture-discovery.js';
import { createCorrelationBaseline, correlateImageCandidates } from '../extensions/lokamedia/src/providers/chatgpt/correlation.js';
import { ChatGptHandshakeManager } from '../extensions/lokamedia/src/providers/chatgpt/handshake.js';
import { ChatGptTabController } from '../extensions/lokamedia/src/providers/chatgpt/tab-controller.js';
import { ExtensionStorage } from '../extensions/lokamedia/src/storage.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, '..');
const extensionRoot = path.join(repoRoot, 'extensions', 'lokamedia');
let passed = 0;

function pass(name) {
  passed++;
  console.log(`  PASS ${name}`);
}

class FakeElement {
  constructor({ tag = 'div', attrs = {}, width = 0, height = 0, parent = null } = {}) {
    this.tagName = tag.toUpperCase();
    this.attrs = attrs;
    this.width = width;
    this.height = height;
    this.naturalWidth = width;
    this.naturalHeight = height;
    this.parentElement = parent;
  }

  getAttribute(name) {
    return this.attrs[name] ?? null;
  }

  hasAttribute(name) {
    return this.attrs[name] !== undefined;
  }

  matches(selector) {
    return selector === 'textarea' && this.tagName === 'TEXTAREA';
  }

  closest(selector) {
    if (selector.includes('[data-message-id]') && this.attrs['data-message-id']) return this;
    if (selector.includes('[data-message-author-role]') && this.attrs['data-message-author-role']) return this;
    return this.parentElement;
  }
}

class FakeRoot {
  constructor(map) {
    this.map = map;
  }

  querySelector(selector) {
    return this.querySelectorAll(selector)[0] ?? null;
  }

  querySelectorAll(selector) {
    return this.map[selector] ?? [];
  }
}

function image(src, id = 'message-1') {
  const parent = new FakeElement({ attrs: { 'data-message-id': id, 'data-message-author-role': 'assistant' } });
  return new FakeElement({ tag: 'img', attrs: { src, width: '1024', height: '1024' }, width: 1024, height: 1024, parent });
}

function fixture(name) {
  const main = new FakeElement({ tag: 'main' });
  const composer = new FakeElement({ tag: 'textarea', attrs: { 'data-testid': 'prompt-textarea' } });
  const send = new FakeElement({ tag: 'button', attrs: { 'data-testid': 'send-button' } });
  const assistant = new FakeElement({ attrs: { 'data-message-author-role': 'assistant', 'data-message-id': 'assistant-1' } });
  const login = new FakeElement({ tag: 'a', attrs: { href: '/auth/login' } });
  const imgA = image('https://chatgpt.com/cdn/a.png?token=secret', 'assistant-1');
  const imgB = image('https://chatgpt.com/cdn/b.png?token=secret', 'assistant-2');
  const base = {
    main: [main],
    '[role="main"]': [],
    'div[contenteditable="true"][data-testid*="prompt"]': [],
    'textarea[data-testid*="prompt"]': [composer],
    'form textarea': [composer],
    'main form div[contenteditable="true"]': [],
    'button[data-testid="send-button"]': [send],
    'button[aria-label*="Send"]': [],
    'form button[type="submit"]': [send],
    '[data-message-author-role="assistant"]': [assistant],
    'article:has([data-message-author-role="assistant"])': [],
    '[data-testid*="conversation-turn"]': [],
    '[data-message-author-role="assistant"] img': [],
    'main img[src]': [],
    'main picture img[src]': [],
    'a[download]': [],
    'a[href*="download"]': [],
    'button[aria-label*="Download"]': [],
    'a[href*="/auth/login"]': [],
    'button[data-testid="login-button"]': [],
    '[data-testid="login-button"]': []
  };
  if (name === 'auth-required') base['a[href*="/auth/login"]'] = [login];
  if (name === 'loading') {
    base.main = [];
    base['textarea[data-testid*="prompt"]'] = [];
    base['form textarea'] = [];
    base['button[data-testid="send-button"]'] = [];
    base['form button[type="submit"]'] = [];
    base['[data-message-author-role="assistant"]'] = [];
  }
  if (name === 'composer-missing') {
    base['textarea[data-testid*="prompt"]'] = [];
    base['form textarea'] = [];
  }
  if (name === 'send-missing') {
    base['button[data-testid="send-button"]'] = [];
    base['form button[type="submit"]'] = [];
  }
  if (name === 'historical-images') base['[data-message-author-role="assistant"] img'] = [imgA, imgB];
  if (name === 'reordered-images') base['[data-message-author-role="assistant"] img'] = [imgB, imgA];
  if (name === 'download') base['a[download]'] = [new FakeElement({ tag: 'a', attrs: { download: 'image.png' } })];
  if (name === 'unsupported') {
    base.main = [];
    base['textarea[data-testid*="prompt"]'] = [];
    base['form textarea'] = [];
    base['[data-message-author-role="assistant"]'] = [];
  }
  return new FakeRoot(base);
}

async function testManifestPermissions() {
  const manifest = JSON.parse(fs.readFileSync(path.join(extensionRoot, 'manifest.json'), 'utf8'));
  assert(!JSON.stringify(manifest).includes('<all_urls>'));
  assert.deepEqual(manifest.host_permissions, ['http://localhost/*', 'https://rancangloka.com/*', 'https://chatgpt.com/*']);
  assert(manifest.content_scripts.some((entry) => entry.matches.includes('https://chatgpt.com/*')));
  pass('minimal ChatGPT host permission and no all_urls');
}

async function testCapabilityFixtures() {
  const ready = detectChatGptCapabilities(fixture('ready'));
  assert.equal(ready.adapter_version, CHATGPT_DOM_ADAPTER_VERSION);
  assert.equal(ready.auth_state, 'AUTHENTICATED');
  assert.equal(ready.capabilities.COMPOSER_PRESENT, true);
  assert.equal(ready.capabilities.COMPOSER_EDITABLE, true);
  assert.equal(ready.capabilities.SEND_CONTROL_PRESENT, true);
  assert.equal(ready.prompt_submission_enabled, false);
  assert.equal(detectChatGptCapabilities(fixture('auth-required')).auth_state, 'AUTH_REQUIRED');
  assert.equal(detectChatGptCapabilities(fixture('loading')).dom_status, 'UNSUPPORTED');
  assert.equal(detectChatGptCapabilities(fixture('composer-missing')).error_code, CHATGPT_ERROR_CODES.DOM_CONTRACT_UNSUPPORTED);
  assert.equal(detectChatGptCapabilities(fixture('send-missing')).capabilities.SEND_CONTROL_PRESENT, false);
  assert.equal(detectChatGptCapabilities(fixture('unsupported')).dom_status, 'UNSUPPORTED');
  pass('provider DOM fixtures and fail-closed capability discovery');
}

async function testBaselineAndCorrelation() {
  const baseline = createCorrelationBaseline({ job: { job_id: 'job-1', prompt_version: 1, prompt_hash: 'hash-1' }, providerTabId: 9, root: fixture('historical-images') });
  assert.equal(baseline.baseline_fingerprints.length, 2);
  assert.equal(correlateImageCandidates(baseline, fixture('reordered-images')).status, CHATGPT_ERROR_CODES.NO_NEW_IMAGE);
  const oneNew = new FakeRoot({ ...fixture('historical-images').map });
  oneNew.map['[data-message-author-role="assistant"] img'] = [
    ...oneNew.map['[data-message-author-role="assistant"] img'],
    image('https://chatgpt.com/cdn/new.png', 'assistant-3')
  ];
  assert.equal(correlateImageCandidates(baseline, oneNew).status, 'ONE_NEW_IMAGE');
  const twoNew = new FakeRoot({ ...fixture('historical-images').map });
  twoNew.map['[data-message-author-role="assistant"] img'] = [
    ...twoNew.map['[data-message-author-role="assistant"] img'],
    image('https://chatgpt.com/cdn/new-1.png', 'assistant-3'),
    image('https://chatgpt.com/cdn/new-2.png', 'assistant-4')
  ];
  assert.equal(correlateImageCandidates(baseline, twoNew).status, CHATGPT_ERROR_CODES.AMBIGUOUS_IMAGE_CANDIDATE);
  pass('baseline inventory, DOM reorder safety, and deterministic correlation');
}

async function testCaptureAndAdapterHardStop() {
  assert.equal(discoverCapturePaths(fixture('download')).screenshot_primary_capture, false);
  const adapter = new ChatGptProviderAdapter({ root: fixture('ready') });
  await assert.rejects(() => adapter.submit(), /PROMPT_SUBMISSION_DISABLED_PHASE_4A/);
  await assert.rejects(() => adapter.capture(), /CAPTURE_DISABLED_PHASE_4A/);
  assert.equal((await adapter.diagnostic({ job_id: 'job-1' })).prompt_submission_enabled, false);
  assert.equal(PROMPT_SUBMISSION_ENABLED, false);
  pass('read-only diagnostic, capture discovery, and hard no-submission guard');
}

async function testControlledRunOnceSubmitPath() {
  const messages = [];
  const chromeApi = {
    tabs: {
      async sendMessage(tabId, message) {
        messages.push({ tabId, message });
        if (message.type === 'CHATGPT_PROVIDER_DIAGNOSTIC') {
          return {
            ok: true,
            session_id: 'session-1',
            capabilities: detectChatGptCapabilities(fixture('ready'))
          };
        }
        if (message.type === 'CHATGPT_PROVIDER_CONTROLLED_SUBMIT') {
          return {
            ok: true,
            session_id: 'session-1',
            submitted_at: '2026-09-16T00:00:00.000Z'
          };
        }
        return { ok: false, error: 'UNEXPECTED_MESSAGE' };
      }
    }
  };
  const adapter = new ChatGptProviderAdapter({
    tabController: {
      chrome: chromeApi,
      async locateTab() {
        return { ok: true, tab_id: 42 };
      }
    }
  });
  const result = await adapter.generate({
    controlled_run_once: true,
    run_id: 'run-1',
    job_id: 'mjob_1',
    prompt: 'synthetic prompt',
    prompt_hash: 'hash-1',
    prompt_version: 1
  });
  const submitMessage = messages.find((entry) => entry.message.type === 'CHATGPT_PROVIDER_CONTROLLED_SUBMIT');
  assert.equal(messages.filter((entry) => entry.message.type === 'CHATGPT_PROVIDER_CONTROLLED_SUBMIT').length, 1);
  assert.equal(submitMessage.tabId, 42);
  assert.equal(submitMessage.message.controlled_run_once, true);
  assert.equal(submitMessage.message.job_id, 'mjob_1');
  assert.equal(submitMessage.message.prompt_hash, 'hash-1');
  assert.equal(result.provider_conversation_id, 'session-1');
  assert.equal(result.submitted_at, '2026-09-16T00:00:00.000Z');
  pass('controlled Run Once submit path is separate from general automatic submission');
}

async function testHandshakeAndTabRecovery() {
  const storage = ExtensionStorage.memory();
  await storage.initialize();
  const chromeApi = {
    tabs: {
      async query() {
        return [{ id: 42, url: 'https://chatgpt.com/', status: 'complete' }];
      }
    }
  };
  const tabs = new ChatGptTabController({ chromeApi, storage });
  assert.equal((await tabs.locateTab()).tab_id, 42);
  const handshake = new ChatGptHandshakeManager({ storage, tabController: tabs });
  const message = {
    provider: 'chatgpt',
    type: 'CHATGPT_PROVIDER_HELLO',
    version: CHATGPT_DOM_ADAPTER_VERSION,
    session_id: 'session-1',
    capabilities: detectChatGptCapabilities(fixture('ready'))
  };
  assert.equal((await handshake.handle(message, { tab: { id: 42, url: 'https://chatgpt.com/' } })).ok, true);
  assert.equal((await handshake.handle(message, { tab: { id: 42, url: 'https://chatgpt.com/' } })).ok, true);
  assert.equal((await storage.readState()).provider.chatgpt.handshake_status, 'duplicate_ready');
  assert.equal((await handshake.handle({ ...message, session_id: 'bad', version: 0 }, { tab: { id: 42, url: 'https://chatgpt.com/' } })).ok, false);
  assert.equal((await handshake.handle({ ...message, session_id: 'wrong-tab' }, { tab: { id: 7, url: 'https://chatgpt.com/' } })).error, 'WRONG_TAB_SENDER');
  await tabs.handleTabUpdated(42, { status: 'loading' }, { url: 'https://chatgpt.com/' });
  assert.equal((await storage.readState()).provider.chatgpt.tab_status, 'reloading');
  await tabs.handleTabRemoved(42);
  assert.equal((await storage.readState()).provider.chatgpt.tab_status, 'closed');
  pass('handshake duplicate, stale, wrong-tab, reload, and tab-closed handling');
}

await testManifestPermissions();
await testCapabilityFixtures();
await testBaselineAndCorrelation();
await testCaptureAndAdapterHardStop();
await testControlledRunOnceSubmitPath();
await testHandshakeAndTabRecovery();

console.log(`Phase 4A ChatGPT provider foundation tests passed: ${passed}`);
