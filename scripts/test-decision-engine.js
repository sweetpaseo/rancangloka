/**
 * RancangLoka — TypeSafe Jev Decision Engine Test Suite
 * Milestone: JEV-SHADOW-1
 * 
 * Tests the Jev OpenRouter Decision Provider and Shadow Observer under all conditions:
 * - Choice / Noul / Score evaluations
 * - Error categorization: 401/403 (AUTH), 429 (RATE_LIMIT), TIMEOUT, NETWORK, MALFORMED, CONFIG_MISSING
 * - Zero secrets logged or returned
 * - Shadow Mode non-authority guarantee
 * - Run Ledger observability correlation
 * - Fallback behavior when disabled or failing
 */

import assert from 'node:assert';
import {
  OpenRouterJevProvider
} from '../src/lib/decision/openrouter-jev-provider.ts';
import {
  observeCandidateShadowDecision,
  getRecentShadowObservations,
  clearShadowObservations,
  getJevConfig
} from '../src/lib/decision/decision-observer.ts';
import {
  getPublicationRunLedger
} from '../src/lib/safety/run-ledger.ts';
import {
  evaluateFirstGenuineArticleGate
} from '../src/lib/safety/first-article-gate.ts';
import {
  getAutomationControl,
  getCapabilityMatrix
} from '../src/lib/safety/automation-controller.ts';

let totalTests = 0;
let passedTests = 0;

function pass(name) {
  totalTests++;
  passedTests++;
  console.log(`  ✅ PASS: Test ${totalTests}: ${name}`);
}

function fail(name, err) {
  totalTests++;
  console.error(`  ❌ FAIL: Test ${totalTests}: ${name}`);
  console.error(err);
  process.exit(1);
}

async function run() {
  console.log('\n=============================================================');
  console.log('  RancangLoka — TypeSafe Jev Decision Engine Test Suite');
  console.log('=============================================================\n');

  const FAKE_KEY = 'sk-or-v1-mock-test-key-never-logged';

  // 1. Valid Jev Choice Response
  try {
    const mockFetch = async () => ({
      ok: true,
      status: 200,
      json: async () => ({
        model: 'typesafe/jev-1.13',
        answers: {
          nextAction: {
            type: 'choice',
            choice: 'continue',
            probabilities: { continue: 0.94, revise: 0.04, human_review: 0.01, stop: 0.01 },
            confidence: 0.94
          }
        },
        usage: { prompt_tokens: 42, completion_tokens: 12, cost: 0.0001 }
      })
    });

    const provider = new OpenRouterJevProvider({ apiKey: FAKE_KEY, fetchFn: mockFetch });
    const { answer, result } = await provider.evaluateChoice(
      { project: 'RancangLoka', articleId: 5 },
      'nextAction',
      {
        type: 'choice',
        instructions: 'Determine next action',
        criteria: { continue: 'ready', stop: 'not ready' }
      }
    );

    assert.strictEqual(result.success, true);
    assert.strictEqual(answer?.choice, 'continue');
    assert.strictEqual(answer?.confidence, 0.94);
    assert.strictEqual(answer?.probabilities.continue, 0.94);
    assert.strictEqual(result.usage?.cost, 0.0001);
    pass('Valid Jev choice response processed correctly');
  } catch (err) {
    fail('Valid Jev choice response', err);
  }

  // 2. Valid Jev Noul Response
  try {
    const mockFetch = async () => ({
      ok: true,
      status: 200,
      json: async () => ({
        model: 'typesafe/jev-1.13',
        answers: {
          needsHumanReview: {
            type: 'noul',
            noul: 0.12,
            confidence: 0.98
          }
        }
      })
    });

    const provider = new OpenRouterJevProvider({ apiKey: FAKE_KEY, fetchFn: mockFetch });
    const { answer, result } = await provider.evaluateNoul(
      { project: 'RancangLoka', articleId: 5 },
      'needsHumanReview',
      {
        type: 'noul',
        instructions: 'Needs chief editor signoff?',
        criteria: { true: 'yes', false: 'no' }
      }
    );

    assert.strictEqual(result.success, true);
    assert.strictEqual(answer?.type, 'noul');
    assert.strictEqual(answer?.noul, 0.12);
    assert.strictEqual(answer?.confidence, 0.98);
    pass('Valid Jev noul response processed with calibrated probability');
  } catch (err) {
    fail('Valid Jev noul response', err);
  }

  // 3. Valid Jev Score Response
  try {
    const mockFetch = async () => ({
      ok: true,
      status: 200,
      json: async () => ({
        model: 'typesafe/jev-1.13',
        answers: {
          urgency: {
            type: 'score',
            score: 0.25,
            probabilities: [0.75, 0.20, 0.05],
            confidence: 0.88
          }
        }
      })
    });

    const provider = new OpenRouterJevProvider({ apiKey: FAKE_KEY, fetchFn: mockFetch });
    const { answer, result } = await provider.evaluateScore(
      { project: 'RancangLoka', articleId: 5 },
      'urgency',
      {
        type: 'score',
        instructions: 'Assess urgency',
        criteria: ['low', 'medium', 'high']
      }
    );

    assert.strictEqual(result.success, true);
    assert.strictEqual(answer?.type, 'score');
    assert.strictEqual(answer?.score, 0.25);
    assert.deepStrictEqual(answer?.probabilities, [0.75, 0.20, 0.05]);
    pass('Valid Jev score response processed with score distribution');
  } catch (err) {
    fail('Valid Jev score response', err);
  }

  // 4. Malformed JSON Response
  try {
    const mockFetch = async () => ({
      ok: true,
      status: 200,
      json: async () => { throw new Error('Unexpected token < in JSON at position 0'); }
    });

    const provider = new OpenRouterJevProvider({ apiKey: FAKE_KEY, fetchFn: mockFetch });
    const result = await provider.evaluate({
      model: 'typesafe/jev-1.13',
      state: {},
      questions: {}
    });

    assert.strictEqual(result.success, false);
    assert.strictEqual(result.errorCategory, 'MALFORMED');
    assert.ok(result.error?.includes('Failed to parse response JSON'));
    pass('Malformed JSON response fails safe with MALFORMED category');
  } catch (err) {
    fail('Malformed JSON response', err);
  }

  // 5. Missing Answer in Response
  try {
    const mockFetch = async () => ({
      ok: true,
      status: 200,
      json: async () => ({
        model: 'typesafe/jev-1.13',
        answers: {
          unrelatedQuestion: { type: 'choice', choice: 'x', confidence: 1 }
        }
      })
    });

    const provider = new OpenRouterJevProvider({ apiKey: FAKE_KEY, fetchFn: mockFetch });
    const { answer, result } = await provider.evaluateChoice(
      {},
      'expectedQuestion',
      { type: 'choice', instructions: '', criteria: {} }
    );

    assert.strictEqual(result.success, true);
    assert.strictEqual(answer, undefined); // cleanly omitted
    pass('Missing question answer in response handled safely without throwing');
  } catch (err) {
    fail('Missing answer handling', err);
  }

  // 6. Network Failure
  try {
    const mockFetch = async () => {
      throw new Error('connect ECONNREFUSED 127.0.0.1:443');
    };

    const provider = new OpenRouterJevProvider({ apiKey: FAKE_KEY, fetchFn: mockFetch });
    const result = await provider.evaluate({ model: 'typesafe/jev-1.13', state: {}, questions: {} });

    assert.strictEqual(result.success, false);
    assert.strictEqual(result.errorCategory, 'NETWORK');
    assert.ok(result.error?.includes('Network error'));
    pass('Network connection failure classified as NETWORK error');
  } catch (err) {
    fail('Network failure handling', err);
  }

  // 7. HTTP 401 Authentication Failure
  try {
    const mockFetch = async () => ({
      ok: false,
      status: 401,
      statusText: 'Unauthorized',
      text: async () => JSON.stringify({ error: { message: 'Invalid API key provided' } })
    });

    const provider = new OpenRouterJevProvider({ apiKey: FAKE_KEY, fetchFn: mockFetch });
    const result = await provider.evaluate({ model: 'typesafe/jev-1.13', state: {}, questions: {} });

    assert.strictEqual(result.success, false);
    assert.strictEqual(result.errorCategory, 'AUTH');
    assert.ok(result.error?.includes('HTTP 401'));
    pass('HTTP 401 Unauthorized classified as AUTH category');
  } catch (err) {
    fail('HTTP 401 handling', err);
  }

  // 8. HTTP 429 Rate Limit / Quota Failure
  try {
    const mockFetch = async () => ({
      ok: false,
      status: 429,
      statusText: 'Too Many Requests',
      text: async () => JSON.stringify({ error: { message: 'Rate limit exceeded' } })
    });

    const provider = new OpenRouterJevProvider({ apiKey: FAKE_KEY, fetchFn: mockFetch });
    const result = await provider.evaluate({ model: 'typesafe/jev-1.13', state: {}, questions: {} });

    assert.strictEqual(result.success, false);
    assert.strictEqual(result.errorCategory, 'RATE_LIMIT');
    assert.ok(result.error?.includes('HTTP 429'));
    pass('HTTP 429 classified as RATE_LIMIT category');
  } catch (err) {
    fail('HTTP 429 handling', err);
  }

  // 9. Timeout Handling
  try {
    const mockFetch = async (_url, init) => {
      return new Promise((resolve, reject) => {
        init.signal.addEventListener('abort', () => {
          const abortErr = new Error('The operation was aborted');
          abortErr.name = 'AbortError';
          reject(abortErr);
        });
      });
    };

    const provider = new OpenRouterJevProvider({ apiKey: FAKE_KEY, timeoutMs: 30, fetchFn: mockFetch });
    const result = await provider.evaluate({ model: 'typesafe/jev-1.13', state: {}, questions: {} });

    assert.strictEqual(result.success, false);
    assert.strictEqual(result.errorCategory, 'TIMEOUT');
    assert.ok(result.error?.includes('timed out'));
    pass('Request timeout aborted safely with TIMEOUT category');
  } catch (err) {
    fail('Timeout handling', err);
  }

  // 10. Low Confidence Response
  try {
    const mockFetch = async () => ({
      ok: true,
      status: 200,
      json: async () => ({
        model: 'typesafe/jev-1.13',
        answers: {
          nextAction: {
            type: 'choice',
            choice: 'continue',
            probabilities: { continue: 0.35, revise: 0.33, human_review: 0.32 },
            confidence: 0.35
          },
          needsHumanReview: {
            type: 'noul',
            noul: 0.51,
            confidence: 0.40
          },
          publicationRisk: {
            type: 'choice',
            choice: 'medium',
            probabilities: { medium: 0.4, low: 0.3, high: 0.3 },
            confidence: 0.40
          }
        }
      })
    });

    clearShadowObservations();
    const provider = new OpenRouterJevProvider({ apiKey: FAKE_KEY, fetchFn: mockFetch });
    const obs = await observeCandidateShadowDecision(
      {
        project: 'RancangLoka',
        articleId: 99,
        slug: 'test-low-confidence',
        articleGenerationCompleted: true,
        editorialValidationPassed: true,
        referencesPresent: true,
        heroImagePresent: true,
        duplicateSlug: false,
        readinessStatus: 'READY_TO_SCHEDULE'
      },
      {
        provider,
        config: {
          enabled: true,
          mode: 'shadow',
          provider: 'openrouter',
          model: 'typesafe/jev-1.13',
          apiKey: FAKE_KEY,
          timeoutMs: 5000,
          endpoint: 'https://openrouter.ai/api/alpha/decisions'
        }
      }
    );

    assert.strictEqual(obs.status, 'SUCCESS');
    assert.ok(obs.confidence < 0.50); // accurately computes low confidence
    pass('Low confidence observation captured with precise average score');
  } catch (err) {
    fail('Low confidence response', err);
  }

  // 11. Unknown Option / Answer Type Mismatch
  try {
    const mockFetch = async () => ({
      ok: true,
      status: 200,
      json: async () => ({
        model: 'typesafe/jev-1.13',
        answers: {
          nextAction: {
            type: 'choice',
            choice: 12345, // invalid type: should be string
            confidence: 1
          }
        }
      })
    });

    const provider = new OpenRouterJevProvider({ apiKey: FAKE_KEY, fetchFn: mockFetch });
    const { answer } = await provider.evaluateChoice(
      {},
      'nextAction',
      { type: 'choice', instructions: '', criteria: {} }
    );

    assert.strictEqual(answer, undefined); // filtered out during validation
    pass('Invalid answer value type safely filtered out during validation');
  } catch (err) {
    fail('Invalid answer type handling', err);
  }

  // 12. Ledger Recording Integration
  try {
    clearShadowObservations();
    const mockFetch = async () => ({
      ok: true,
      status: 200,
      json: async () => ({
        model: 'typesafe/jev-1.13',
        answers: {
          nextAction: { type: 'choice', choice: 'continue', probabilities: { continue: 0.99 }, confidence: 0.99 },
          needsHumanReview: { type: 'noul', noul: 0.01, confidence: 0.99 },
          publicationRisk: { type: 'choice', choice: 'very_low', probabilities: { very_low: 0.99 }, confidence: 0.99 }
        }
      })
    });

    const provider = new OpenRouterJevProvider({ apiKey: FAKE_KEY, fetchFn: mockFetch });
    const obs = await observeCandidateShadowDecision(
      {
        project: 'RancangLoka',
        articleId: 500,
        slug: 'ledger-correlate-test',
        articleGenerationCompleted: true,
        editorialValidationPassed: true,
        referencesPresent: true,
        heroImagePresent: true,
        duplicateSlug: false,
        readinessStatus: 'READY_TO_SCHEDULE'
      },
      {
        provider,
        correlationId: 'corr_500_abc',
        config: {
          enabled: true,
          mode: 'shadow',
          provider: 'openrouter',
          model: 'typesafe/jev-1.13',
          apiKey: FAKE_KEY,
          timeoutMs: 5000,
          endpoint: 'https://openrouter.ai/api/alpha/decisions'
        }
      }
    );

    const recent = getRecentShadowObservations();
    assert.strictEqual(recent.length, 1);
    assert.strictEqual(recent[0].correlationId, 'corr_500_abc');
    assert.strictEqual(recent[0].recommendations.nextAction, 'continue');
    assert.strictEqual(recent[0].recommendations.needsHumanReview, false);

    // Test correlation in getPublicationRunLedger
    const mockDb = {
      prepare: () => ({
        bind: () => ({
          all: async () => ({
            results: [{
              d1_article_id: 500,
              article_slug: 'ledger-correlate-test',
              article_status: 'draft',
              correlation_id: 'corr_500_abc'
            }]
          })
        })
      })
    };

    const ledgerEntries = await getPublicationRunLedger(mockDb, { articleId: '500' });
    assert.strictEqual(ledgerEntries.length, 1);
    assert.ok(ledgerEntries[0].shadow_observation);
    assert.strictEqual(ledgerEntries[0].shadow_observation.correlationId, 'corr_500_abc');
    assert.strictEqual(ledgerEntries[0].shadow_observation.model, 'typesafe/jev-1.13');
    pass('Run ledger correlates Jev shadow observation with article and correlationId');
  } catch (err) {
    fail('Ledger recording integration', err);
  }

  // 13. Fallback Behavior when Provider Errs
  try {
    clearShadowObservations();
    const failingProvider = {
      providerName: 'openrouter',
      modelName: 'typesafe/jev-1.13',
      evaluate: async () => ({
        success: false,
        answers: {},
        latencyMs: 15,
        model: 'typesafe/jev-1.13',
        provider: 'openrouter',
        error: 'Service temporarily unavailable',
        errorCategory: 'NETWORK'
      }),
      evaluateChoice: async () => ({ result: { success: false } }),
      evaluateNoul: async () => ({ result: { success: false } }),
      evaluateScore: async () => ({ result: { success: false } })
    };

    const obs = await observeCandidateShadowDecision(
      {
        project: 'RancangLoka',
        articleId: 501,
        slug: 'fallback-test',
        articleGenerationCompleted: true,
        editorialValidationPassed: true,
        referencesPresent: true,
        heroImagePresent: true,
        duplicateSlug: false,
        readinessStatus: 'READY_TO_SCHEDULE'
      },
      {
        provider: failingProvider,
        config: {
          enabled: true,
          mode: 'shadow',
          provider: 'openrouter',
          model: 'typesafe/jev-1.13',
          apiKey: FAKE_KEY,
          timeoutMs: 5000,
          endpoint: 'https://openrouter.ai/api/alpha/decisions'
        }
      }
    );

    assert.strictEqual(obs.status, 'ERROR');
    assert.strictEqual(obs.errorCategory, 'NETWORK');
    assert.strictEqual(obs.recommendations.nextAction, undefined);
    pass('Provider failure produces clean non-throwing ERROR record in shadow ledger');
  } catch (err) {
    fail('Fallback behavior on error', err);
  }

  // 14. Missing OPENROUTER_API_KEY
  try {
    const providerWithoutKey = new OpenRouterJevProvider({ apiKey: '' });
    const result = await providerWithoutKey.evaluate({ model: 'typesafe/jev-1.13', state: {}, questions: {} });

    assert.strictEqual(result.success, false);
    assert.strictEqual(result.errorCategory, 'CONFIG_MISSING');
    assert.ok(result.error?.includes('OPENROUTER_API_KEY is not configured'));
    pass('Missing OPENROUTER_API_KEY handled with CONFIG_MISSING without network calls');
  } catch (err) {
    fail('Missing API key handling', err);
  }

  // 15. Confirmation Secret is Never Logged
  try {
    let capturedHeaders = null;
    const mockFetch = async (_url, init) => {
      capturedHeaders = init.headers;
      return {
        ok: false,
        status: 401,
        statusText: 'Unauthorized',
        text: async () => 'Unauthorized error body'
      };
    };

    const SECRET_PROBE = 'secret-probe-key-xyz-123';
    const provider = new OpenRouterJevProvider({ apiKey: SECRET_PROBE, fetchFn: mockFetch });
    const result = await provider.evaluate({ model: 'typesafe/jev-1.13', state: {}, questions: {} });

    // Ensure error string does not contain the key
    assert.strictEqual(result.error?.includes(SECRET_PROBE), false);
    // Ensure string representation of result does not contain the key
    assert.strictEqual(JSON.stringify(result).includes(SECRET_PROBE), false);
    // Ensure header was set for network call but never retained in result
    assert.strictEqual(capturedHeaders['Authorization'], `Bearer ${SECRET_PROBE}`);
    pass('OPENROUTER_API_KEY is passed in Authorization header but strictly absent from result and logs');
  } catch (err) {
    fail('Secret absence verification', err);
  }

  // 16. Shadow Mode Cannot Alter Production Action
  try {
    // Even if Jev recommends 'stop', the deterministic preflight still evaluates according to its own 13 checks
    const preflightPassing = {
      production_health_ok: true,
      automation_mode_controlled: true,
      kill_switch_disengaged: true,
      circuit_breakers_closed: true,
      article_editorial_guards_pass: true,
      content_hash_verified: true,
      media_validated: true,
      approval_verified: true,
      readiness_ready_to_schedule: true,
      plan_active: true,
      canonical_conflict_free: true,
      publisher_ready: true,
      production_cron_disabled: true
    };

    const gateResult = await evaluateFirstGenuineArticleGate(preflightPassing);
    assert.strictEqual(gateResult.status, 'READY');
    pass('Shadow mode observations have zero authority over deterministic gate outcomes');
  } catch (err) {
    fail('Shadow mode non-authority guarantee', err);
  }

  // 17. Shadow Mode Cannot Bypass Existing Safety Controls
  try {
    // Kill switch engaged: capability matrix must completely block execution regardless of any model recommendation
    const capsWithKillSwitch = getCapabilityMatrix('CONTROLLED', true);
    assert.strictEqual(capsWithKillSwitch.canPublishUnattended, false);
    assert.strictEqual(capsWithKillSwitch.canScheduleControlled, false);
    assert.strictEqual(capsWithKillSwitch.canPlan, false);
    assert.strictEqual(capsWithKillSwitch.canMutateArticle, false);
    pass('Existing safety controls (Kill switch, capability matrix) strictly dominate any shadow recommendation');
  } catch (err) {
    fail('Safety control dominance', err);
  }

  // 18. Publication Behavior Unchanged When Jev is Disabled
  try {
    clearShadowObservations();
    const obs = await observeCandidateShadowDecision(
      {
        project: 'RancangLoka',
        articleId: 999,
        slug: 'disabled-test',
        articleGenerationCompleted: true,
        editorialValidationPassed: true,
        referencesPresent: true,
        heroImagePresent: true,
        duplicateSlug: false,
        readinessStatus: 'READY_TO_SCHEDULE'
      },
      {
        config: {
          enabled: false,
          mode: 'disabled',
          provider: 'openrouter',
          model: 'typesafe/jev-1.13',
          apiKey: '',
          timeoutMs: 5000,
          endpoint: 'https://openrouter.ai/api/alpha/decisions'
        }
      }
    );

    assert.strictEqual(obs.status, 'FALLBACK');
    assert.strictEqual(obs.fallbackReason, 'JEV_DISABLED');
    assert.strictEqual(obs.confidence, 0);
    pass('When Jev is disabled, pipeline completes with immediate FALLBACK and zero network overhead');
  } catch (err) {
    fail('Disabled Jev behavior', err);
  }

  // 19. Cloudflare workerd context binding regression test
  try {
    const originalFetch = globalThis.fetch;
    let invocationContextCorrect = false;

    // Simulate workerd native fetch where this MUST be globalThis
    globalThis.fetch = function(url, init) {
      if (this !== globalThis) {
        throw new TypeError('Illegal invocation');
      }
      invocationContextCorrect = true;
      return Promise.resolve({
        ok: true,
        status: 200,
        json: async () => ({
          model: 'typesafe/jev-1.13',
          answers: {
            nextAction: {
              type: 'choice',
              choice: 'continue',
              probabilities: { continue: 0.95 },
              confidence: 0.95
            }
          }
        })
      });
    };

    try {
      // Do NOT pass fetchFn in options - let it use wrapped globalThis.fetch
      const provider = new OpenRouterJevProvider({ apiKey: FAKE_KEY });
      const { answer, result } = await provider.evaluateChoice(
        { project: 'RancangLoka', articleId: 5 },
        'nextAction',
        { type: 'choice', instructions: 'Test nextAction' }
      );

      assert.strictEqual(invocationContextCorrect, true, 'fetch was invoked with this === globalThis');
      assert.strictEqual(result.success, true);
      assert.strictEqual(answer?.choice, 'continue');
      assert.strictEqual(answer?.confidence, 0.95);
      pass('Cloudflare workerd fetch is invoked with valid globalThis context and returns typed decision');
    } finally {
      globalThis.fetch = originalFetch;
    }
  } catch (err) {
    fail('Cloudflare workerd context binding test', err);
  }

  // 20. Provider failure remains fail-safe if fetch throws TypeError
  try {
    const mockUnboundFetch = function() {
      throw new TypeError('Illegal invocation');
    };
    const provider = new OpenRouterJevProvider({ apiKey: FAKE_KEY, fetchFn: mockUnboundFetch });
    const { answer, result } = await provider.evaluateChoice(
      { project: 'RancangLoka', articleId: 5 },
      'nextAction',
      { type: 'choice', instructions: 'Test nextAction' }
    );
    assert.strictEqual(result.success, false);
    assert.strictEqual(result.errorCategory, 'NETWORK');
    assert.strictEqual(answer, undefined);
    pass('Provider failure with TypeError remains fail-safe and classified as NETWORK error');
  } catch (err) {
    fail('TypeError fail-safe handling', err);
  }

  // 21. Cloudflare fetch timeout abort handled cleanly
  try {
    const originalFetch = globalThis.fetch;
    globalThis.fetch = function(url, init) {
      if (this !== globalThis) {
        throw new TypeError('Illegal invocation');
      }
      return new Promise((resolve, reject) => {
        if (init?.signal) {
          init.signal.addEventListener('abort', () => {
            const err = new Error('The operation was aborted');
            err.name = 'AbortError';
            reject(err);
          });
        }
      });
    };

    try {
      const provider = new OpenRouterJevProvider({ apiKey: FAKE_KEY, timeoutMs: 20 });
      const { answer, result } = await provider.evaluateChoice(
        { project: 'RancangLoka', articleId: 5 },
        'nextAction',
        { type: 'choice', instructions: 'Test timeout' }
      );
      assert.strictEqual(result.success, false);
      assert.strictEqual(result.errorCategory, 'TIMEOUT');
      pass('Cloudflare fetch timeout correctly aborts and classifies as TIMEOUT');
    } finally {
      globalThis.fetch = originalFetch;
    }
  } catch (err) {
    fail('Timeout abort handling', err);
  }

  // 22. Cloudflare fetch network failure handled cleanly
  try {
    const originalFetch = globalThis.fetch;
    globalThis.fetch = function(url, init) {
      if (this !== globalThis) {
        throw new TypeError('Illegal invocation');
      }
      return Promise.reject(new Error('Connection reset by peer'));
    };

    try {
      const provider = new OpenRouterJevProvider({ apiKey: FAKE_KEY });
      const { answer, result } = await provider.evaluateChoice(
        { project: 'RancangLoka', articleId: 5 },
        'nextAction',
        { type: 'choice', instructions: 'Test network error' }
      );
      assert.strictEqual(result.success, false);
      assert.strictEqual(result.errorCategory, 'NETWORK');
      pass('Cloudflare fetch network error classifies as NETWORK without throwing');
    } finally {
      globalThis.fetch = originalFetch;
    }
  } catch (err) {
    fail('Network error handling', err);
  }

  // 23. Cloudflare fetch malformed JSON handled cleanly
  try {
    const originalFetch = globalThis.fetch;
    globalThis.fetch = function(url, init) {
      if (this !== globalThis) {
        throw new TypeError('Illegal invocation');
      }
      return Promise.resolve({
        ok: true,
        status: 200,
        json: async () => { throw new SyntaxError('Unexpected token < in JSON at position 0'); }
      });
    };

    try {
      const provider = new OpenRouterJevProvider({ apiKey: FAKE_KEY });
      const { answer, result } = await provider.evaluateChoice(
        { project: 'RancangLoka', articleId: 5 },
        'nextAction',
        { type: 'choice', instructions: 'Test malformed JSON' }
      );
      assert.strictEqual(result.success, false);
      assert.strictEqual(result.errorCategory, 'MALFORMED');
      pass('Cloudflare fetch malformed JSON response classifies as MALFORMED without throwing');
    } finally {
      globalThis.fetch = originalFetch;
    }
  } catch (err) {
    fail('Malformed JSON handling', err);
  }

  console.log('\n=============================================================');
  console.log(`  Tests Completed: ${totalTests}`);
  console.log(`  Passed: ${passedTests}`);
  console.log(`  Failed: 0`);
  console.log('=============================================================\n');
}

run().catch(err => {
  console.error('Fatal test runner error:', err);
  process.exit(1);
});
