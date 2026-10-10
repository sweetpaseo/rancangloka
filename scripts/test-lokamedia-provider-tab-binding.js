/**
 * RancangLoka — LokaMedia Provider Tab Binding-1 Regression Test Suite
 *
 * Verifies explicit and deterministic ChatGPT tab binding:
 * 1. Multiple ChatGPT tabs exist -> only explicitly bound tab receives prompt.
 * 2. No bound tab -> Run Once disabled with "Bind a ChatGPT tab first".
 * 3. Bound tab closes -> Fail closed, no fallback to other tabs ("Bound ChatGPT tab unavailable").
 * 4. Switching browser focus does NOT change bound provider target.
 * 5. Rebinding explicitly changes target.
 * 6. Article A completed job cannot be accidentally rerun.
 */

import assert from 'node:assert/strict';
import test from 'node:test';
import { ChatGptTabController } from '../extensions/lokamedia/src/providers/chatgpt/tab-controller.js';
import { ChatGptProviderAdapter } from '../extensions/lokamedia/src/providers/chatgpt/adapter.js';
import { ExtensionStorage } from '../extensions/lokamedia/src/storage.js';
import { LokaMediaController } from '../extensions/lokamedia/src/controller.js';
import { MemoryBlobStore } from '../extensions/lokamedia/src/blob-store.js';
import { evaluateRunOnceEligibility, normalizeProviderStatus, summarizeCurrentJob } from '../extensions/lokamedia/src/popup-core.js';
import { EXTENSION_VERSION } from '../extensions/lokamedia/src/constants.js';

class MockChromeApi {
  constructor(initialTabs = []) {
    this.tabsList = [...initialTabs];
    this.activeTabId = initialTabs[0]?.id ?? null;
    this.messages = [];
  }

  get tabs() {
    return {
      query: async (queryInfo = {}) => {
        if (queryInfo.active) {
          const activeTab = this.tabsList.find((t) => t.id === this.activeTabId);
          return activeTab ? [activeTab] : [];
        }
        if (queryInfo.url) {
          return this.tabsList.filter((t) => t.url && t.url.startsWith('https://chatgpt.com'));
        }
        return [...this.tabsList];
      },
      get: async (tabId) => {
        const match = this.tabsList.find((t) => t.id === tabId);
        if (!match) throw new Error(`Tab not found: ${tabId}`);
        return match;
      },
      sendMessage: async (tabId, message) => {
        this.messages.push({ tabId, message });
        if (message.type === 'CHATGPT_PROVIDER_CONTROLLED_SUBMIT') {
          return {
            ok: true,
            provider_conversation_id: `conv_${tabId}`,
            provider_response_id: `resp_${tabId}`,
            submitted_at: '2026-10-07T12:00:00.000Z',
            identified_at: '2026-10-07T12:00:01.000Z',
            source_fingerprint: `fp_${tabId}`,
            containerFingerprint: `cf_${tabId}`
          };
        }
        if (message.type === 'CHATGPT_PROVIDER_DIAGNOSTIC') {
          return {
            ok: true,
            session_id: `session_${tabId}`,
            capabilities: {
              auth_state: 'AUTHENTICATED',
              dom_status: 'SUPPORTED',
              capabilities: { COMPOSER_EDITABLE: true },
              image_candidate_count: 0
            }
          };
        }
        return { ok: true };
      }
    };
  }

  closeTab(tabId) {
    this.tabsList = this.tabsList.filter((t) => t.id !== tabId);
    if (this.activeTabId === tabId) {
      this.activeTabId = this.tabsList[0]?.id ?? null;
    }
  }

  focusTab(tabId) {
    this.activeTabId = tabId;
  }
}

test('1. Multiple ChatGPT tabs exist -> only explicitly bound tab receives prompt', async () => {
  const storage = ExtensionStorage.memory();
  await storage.initialize();

  const tab101UserChat = { id: 101, url: 'https://chatgpt.com/c/operator-chat', status: 'complete' };
  const tab202Dedicated = { id: 202, url: 'https://chatgpt.com/c/lokamedia-dedicated', status: 'complete' };

  const chromeMock = new MockChromeApi([tab101UserChat, tab202Dedicated]);
  const tabController = new ChatGptTabController({ chromeApi: chromeMock, storage });

  // Explicitly bind tab 202
  const bindResult = await tabController.bindActiveTab(202);
  assert.equal(bindResult.ok, true);
  assert.equal(bindResult.tab_id, 202);
  assert.equal(bindResult.target_state, 'LOCKED');

  const adapter = new ChatGptProviderAdapter({ tabController });
  const result = await adapter.submit({
    controlled_run_once: true,
    run_id: 'run_test_1',
    job_id: 'mjob_test_1',
    prompt: 'Desain kanopi minimalis',
    prompt_hash: 'phash_1',
    prompt_version: 1,
    slot_key: 'featured'
  });

  assert.equal(result.job_id, 'mjob_test_1');
  assert.equal(result.provider_conversation_id, 'conv_202');

  // Verify only Tab 202 received the submit message
  assert.equal(chromeMock.messages.length, 1);
  assert.equal(chromeMock.messages[0].tabId, 202);
  assert.equal(chromeMock.messages[0].message.type, 'CHATGPT_PROVIDER_CONTROLLED_SUBMIT');
});

test('2. No bound tab -> Run Once disabled with "Bind a ChatGPT tab first"', async () => {
  const storage = ExtensionStorage.memory();
  await storage.initialize();

  const state = await storage.readState();
  const provider = normalizeProviderStatus(state.provider?.chatgpt ?? {});

  assert.equal(provider.target, 'NOT BOUND');
  assert.equal(provider.target_bound, false);

  const eligibility = evaluateRunOnceEligibility({
    state: {
      ...state,
      config: { enabled: true },
      jobs: {
        job1: {
          job_id: 'job1',
          article_title: 'Test Article',
          slot_key: 'featured',
          status: 'QUEUED',
          local_state: 'QUEUED'
        }
      }
    },
    current: {
      job_id: 'job1',
      article: 'Test Article',
      slot: 'featured',
      operation: 'Waiting'
    },
    provider,
    server: 'online',
    runtimeVersion: EXTENSION_VERSION,
    expectedVersion: EXTENSION_VERSION
  });

  assert.equal(eligibility.eligible, false);
  assert.equal(eligibility.reason, 'Bind a ChatGPT tab first');

  // Verify locateTab returns PROVIDER_TARGET_UNAVAILABLE
  const chromeMock = new MockChromeApi([{ id: 101, url: 'https://chatgpt.com/', status: 'complete' }]);
  const tabController = new ChatGptTabController({ chromeApi: chromeMock, storage });
  const loc = await tabController.locateTab();
  assert.equal(loc.ok, false);
  assert.equal(loc.status, 'PROVIDER_TARGET_UNAVAILABLE');
  assert.equal(loc.reason, 'NOT_BOUND');
});

test('3. Bound tab closes -> fail closed, no fallback to other existing ChatGPT tabs', async () => {
  const storage = ExtensionStorage.memory();
  await storage.initialize();

  const tab101Other = { id: 101, url: 'https://chatgpt.com/c/other', status: 'complete' };
  const tab202Bound = { id: 202, url: 'https://chatgpt.com/c/bound', status: 'complete' };

  const chromeMock = new MockChromeApi([tab101Other, tab202Bound]);
  const tabController = new ChatGptTabController({ chromeApi: chromeMock, storage });

  await tabController.bindActiveTab(202);

  // Close the bound tab 202
  chromeMock.closeTab(202);
  await tabController.handleTabRemoved(202);

  await storage.update((st) => {
    st.config.enabled = true;
  });

  const updatedState = await storage.readState();
  assert.equal(updatedState.provider.chatgpt.provider_tab_id, null);
  assert.equal(updatedState.provider.chatgpt.target_state, 'CLOSED');
  assert.equal(updatedState.provider.chatgpt.tab_status, 'closed');
  // Audit metadata is strictly preserved
  assert.equal(updatedState.provider.chatgpt.bound_tab_id, 202);
  assert.equal(updatedState.provider.chatgpt.bound_url, 'https://chatgpt.com/c/bound');

  // locateTab must FAIL CLOSED and NOT fall back to tab 101
  const loc = await tabController.locateTab();
  assert.equal(loc.ok, false);
  assert.equal(loc.status, 'PROVIDER_TARGET_UNAVAILABLE');

  // Side-panel eligibility must show "Bound ChatGPT tab unavailable"
  const provider = normalizeProviderStatus(updatedState.provider?.chatgpt);
  const eligibility = evaluateRunOnceEligibility({
    state: updatedState,
    current: { operation: 'Waiting', slot: 'featured', article: 'Article X' },
    provider,
    server: 'online',
    runtimeVersion: EXTENSION_VERSION,
    expectedVersion: EXTENSION_VERSION
  });
  assert.equal(eligibility.eligible, false);
  assert.equal(eligibility.reason, 'Bound ChatGPT tab unavailable');
});

test('4. Switching browser focus does NOT change bound provider target', async () => {
  const storage = ExtensionStorage.memory();
  await storage.initialize();

  const tab101Work = { id: 101, url: 'https://chatgpt.com/c/work', status: 'complete' };
  const tab202Dedicated = { id: 202, url: 'https://chatgpt.com/c/dedicated', status: 'complete' };

  const chromeMock = new MockChromeApi([tab101Work, tab202Dedicated]);
  chromeMock.focusTab(202);

  const tabController = new ChatGptTabController({ chromeApi: chromeMock, storage });
  await tabController.bindActiveTab(202);

  // Operator switches focus to tab 101 (or any other tab)
  chromeMock.focusTab(101);

  // locateTab MUST still resolve to tab 202, NEVER tab 101
  const loc = await tabController.locateTab();
  assert.equal(loc.ok, true);
  assert.equal(loc.tab_id, 202);

  const state = await storage.readState();
  assert.equal(state.provider.chatgpt.bound_tab_id, 202);
  assert.equal(state.provider.chatgpt.provider_tab_id, 202);
  assert.equal(state.provider.chatgpt.target_state, 'LOCKED');
});

test('5. Rebinding explicitly changes target', async () => {
  const storage = ExtensionStorage.memory();
  await storage.initialize();

  const tab101Old = { id: 101, url: 'https://chatgpt.com/c/old', status: 'complete' };
  const tab303New = { id: 303, url: 'https://chatgpt.com/c/new-dedicated?query=ignored#hash', status: 'complete' };

  const chromeMock = new MockChromeApi([tab101Old, tab303New]);
  const tabController = new ChatGptTabController({ chromeApi: chromeMock, storage });

  // Initial binding to 101
  await tabController.bindActiveTab(101);
  let loc = await tabController.locateTab();
  assert.equal(loc.tab_id, 101);

  // Operator explicitly rebinds to 303
  chromeMock.focusTab(303);
  const rebind = await tabController.bindActiveTab(303);
  assert.equal(rebind.ok, true);
  assert.equal(rebind.tab_id, 303);
  assert.equal(rebind.bound_url, 'https://chatgpt.com/c/new-dedicated'); // query params stripped

  loc = await tabController.locateTab();
  assert.equal(loc.ok, true);
  assert.equal(loc.tab_id, 303);

  const state = await storage.readState();
  assert.equal(state.provider.chatgpt.bound_tab_id, 303);
  assert.equal(state.provider.chatgpt.provider_tab_id, 303);
});

test('6. Article A completed job cannot be accidentally rerun', async () => {
  const storage = ExtensionStorage.memory();
  await storage.initialize();

  const jobA = {
    job_id: 'mjob_9654a1ff6c242ce49711a664',
    article_id: 88,
    article_title: 'Kelebihan Genteng Keramik untuk Rumah Tropis',
    slot_key: 'featured',
    status: 'COMPLETE',
    local_state: 'COMPLETE',
    blob_key: 'blob_article_a_key',
    sha256: 'cb5c343af17ef91b13e63c23a818604040512ad6a79282ffd3d1c2520c956144',
    mime: 'image/png',
    width: 1770,
    height: 889
  };

  await storage.update((st) => {
    st.config.enabled = true;
    st.status.connection = 'online';
    st.jobs[jobA.job_id] = jobA;
    st.phase4bSingleRun = {
      phase4b_single_run_id: 'run_1791380727041_abddb752',
      job_id: jobA.job_id,
      submission_consumed: true,
      generation_consumed: true,
      completed_at: '2026-10-07T12:00:00.000Z',
      outcome: 'complete'
    };
  });

  const state = await storage.readState();
  const current = summarizeCurrentJob(state);
  const provider = {
    tab: 'connected',
    target: 'LOCKED',
    target_bound: true,
    auth: 'ready',
    dom: 'supported',
    composer: 'ready',
    lane: 'idle'
  };

  const eligibility = evaluateRunOnceEligibility({
    state,
    current,
    provider,
    server: 'online',
    runtimeVersion: EXTENSION_VERSION,
    expectedVersion: EXTENSION_VERSION
  });

  assert.equal(eligibility.eligible, false);
  assert.equal(eligibility.consumed, true);
  assert.equal(eligibility.reason, 'Job already consumed');

  // Verify LokaMediaController runOnce rejects rerun
  let providerCalls = 0;
  const mockApi = {
    listJobs: async () => ({ jobs: [jobA] }),
    nextJob: async () => ({ job: null })
  };
  const mockProvider = {
    submit: async () => { providerCalls++; }
  };
  const controller = new LokaMediaController({
    apiClient: mockApi,
    storage,
    blobStore: new MemoryBlobStore(),
    provider: mockProvider
  });

  const res = await controller.runOnce({ runId: 'run_accidental_retry' });
  assert.equal(res.ok, false);
  assert.equal(res.error, 'PHASE_4B_RUN_CONSUMED');
  assert.equal(providerCalls, 0, 'Zero provider calls must occur for completed Article A');
});
