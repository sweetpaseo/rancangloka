/**
 * RancangLoka LokaMedia — Unified Multi-Provider Orchestrator
 * Phases 3, 4 & 5 Implementation
 *
 * Invariants:
 * 1. MULTI-PROVIDER PARITY: Dynamically coordinates ChatGPT and Google Gemini.
 * 2. BOUNDED RETRIES: Strict ceiling of 3 retries; zero infinite loops.
 * 3. NO CREDENTIAL ACCESS: Zero token/cookie sniffing or scraping.
 * 4. DETERMINISTIC ROUTING: Photorealistic images use browser providers; technical diagrams flag SVG/CAD need.
 * 5. STRICT HUMAN APPROVAL: Output remains strictly in candidate state pending human approval.
 */

import {
  BrowserProviderDetector,
  PROVIDER_CHATGPT,
  PROVIDER_GEMINI,
  DETECTOR_STATUS
} from './detector.js';
import { ChatGptProviderAdapter } from './chatgpt/adapter.js';
import { ChatGptTabController } from './chatgpt/tab-controller.js';
import { GeminiProviderAdapter } from './gemini/adapter.js';
import { GeminiTabController } from './gemini/tab-controller.js';

export const MAX_PROVIDER_RETRIES = 3;

export class MultiProviderOrchestrator {
  constructor({ chromeApi = globalThis.chrome, storage = null, logger = console } = {}) {
    this.chrome = chromeApi;
    this.storage = storage;
    this.logger = logger;

    this.detector = new BrowserProviderDetector({ chromeApi, storage });
    this.chatGptTabs = new ChatGptTabController({ chromeApi, storage });
    this.geminiTabs = new GeminiTabController({ chromeApi, storage });

    this.chatGptAdapter = new ChatGptProviderAdapter({ tabController: this.chatGptTabs });
    this.geminiAdapter = new GeminiProviderAdapter({ tabController: this.geminiTabs });
  }

  getAdapter(providerId) {
    if (providerId === PROVIDER_CHATGPT) return this.chatGptAdapter;
    if (providerId === PROVIDER_GEMINI) return this.geminiAdapter;
    throw new Error(`Unsupported provider ID: ${providerId}`);
  }

  getTabController(providerId) {
    if (providerId === PROVIDER_CHATGPT) return this.chatGptTabs;
    if (providerId === PROVIDER_GEMINI) return this.geminiTabs;
    throw new Error(`Unsupported provider ID: ${providerId}`);
  }

  /**
   * Discovers active sessions, applies selection rules, and binds the appropriate tab.
   */
  async resolveAndBindProvider(options = {}) {
    const selection = await this.detector.detectAndSelectProvider(options);

    if (selection.status === DETECTOR_STATUS.SELECTED) {
      const tabCtrl = this.getTabController(selection.provider);
      await tabCtrl.bindActiveTab(selection.tab.id);

      if (this.storage?.update) {
        await this.storage.update((state) => {
          state.provider ??= {};
          state.provider.active_provider_id = selection.provider;
          state.provider.active_tab_id = selection.tab.id;
          state.provider.selection_rule = selection.ruleApplied;
        });
      }
    }

    return selection;
  }

  /**
   * Prepares and locks provider for a media job.
   */
  async prepareJob(job, options = {}) {
    // 1. Check if job already has a locked provider
    const existingLock = await this.detector.verifyJobLock(job.job_id, options.forcedProvider);
    let providerId = existingLock ? existingLock.providerId : null;
    let tabId = existingLock ? existingLock.tabId : null;

    if (!providerId) {
      const selection = await this.resolveAndBindProvider(options);
      if (selection.status !== DETECTOR_STATUS.SELECTED) {
        const err = new Error(selection.message || 'No suitable provider available');
        err.code = selection.status;
        err.selection = selection;
        throw err;
      }
      providerId = selection.provider;
      tabId = selection.tab.id;
      await this.detector.lockProviderForJob(job.job_id, providerId, tabId);
    }

    // 2. Technical Diagram Check
    const isTechnicalDiagram =
      job.visual_brief?.storytelling_class === 'SECTION_DETAIL' ||
      job.visual_brief?.storytelling_class === 'CONCEPT_DIAGRAM';

    const adapter = this.getAdapter(providerId);
    const diagnostic = await adapter.diagnostic(job);

    if (diagnostic.auth_state === 'AUTH_REQUIRED') {
      const err = new Error(`Provider ${providerId} requires authentication. Please log in.`);
      err.code = DETECTOR_STATUS.AUTH_REQUIRED;
      throw err;
    }

    return {
      ok: true,
      providerId,
      tabId,
      diagnostic,
      isTechnicalDiagram,
      recommendation: isTechnicalDiagram
        ? 'DETERMINISTIC_SVG_OR_CAD_PREFERRED'
        : 'PHOTOREALISTIC_BROWSER_APPROVED'
    };
  }

  /**
   * Executes controlled run once with failure boundaries and retry accounting.
   */
  async executeJob(job, options = {}) {
    const prep = await this.prepareJob(job, options);
    const adapter = this.getAdapter(prep.providerId);

    let attempts = 0;
    let lastError = null;

    while (attempts < MAX_PROVIDER_RETRIES) {
      attempts++;
      try {
        // Re-verify locked tab is still reachable before attempt
        await this.detector.verifyJobLock(job.job_id, prep.providerId);

        const result = await adapter.submit({
          ...job,
          attempt_number: attempts,
          provider_id: prep.providerId
        });

        return {
          ok: true,
          providerResult: {
            ...result,
            provider_id: prep.providerId,
            attempts_used: attempts
          }
        };
      } catch (err) {
        lastError = err;
        this.logger.warn?.(`Attempt ${attempts} failed for job ${job.job_id}: ${err.message}`);

        // If provider switched or disconnected, fail immediately
        if (
          err.code === DETECTOR_STATUS.SWITCH_LOCKED ||
          err.code === DETECTOR_STATUS.BROWSER_DISCONNECTED ||
          err.code === DETECTOR_STATUS.AUTH_REQUIRED
        ) {
          throw err;
        }

        // Bounded retry backoff
        if (attempts >= MAX_PROVIDER_RETRIES) {
          break;
        }
      }
    }

    const fatalErr = new Error(`Job execution failed after ${MAX_PROVIDER_RETRIES} attempts. Last error: ${lastError?.message}`);
    fatalErr.code = 'RETRY_CEILING_REACHED';
    fatalErr.attempts = attempts;
    fatalErr.lastError = lastError;
    throw fatalErr;
  }

  async releaseJob(jobId) {
    await this.detector.releaseJobLock(jobId);
  }
}
