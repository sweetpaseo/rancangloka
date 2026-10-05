#!/usr/bin/env node
/**
 * RancangLoka Editorial Provider Resilience & Diagnostic Test Suite
 * Milestone: EDITORIAL-PROVIDER-RESILIENCE-1
 *
 * Tests all deterministic provider edge cases using mock HTTP responses:
 * 1. 200 + valid content -> SUCCESS
 * 2. 200 + empty content -> PROVIDER_EMPTY_RESPONSE
 * 3. 200 + missing choices -> PROVIDER_MISSING_CONTENT
 * 4. 429 -> transient retry
 * 5. 500/502/503 -> bounded retry
 * 6. 401/403 -> no retry
 * 7. timeout -> PROVIDER_TIMEOUT + bounded retry
 * 8. context-length error -> PROVIDER_CONTEXT_LIMIT + no blind retry
 * 9. invalid JSON -> PROVIDER_INVALID_JSON
 * 10. retry exhausted -> final fail-closed status
 *
 * No real production provider calls are made in this test suite.
 */

import assert from 'node:assert';
import {
  EditorialLlmProvider,
  isRetryableProviderError
} from '../src/lib/editorial/editorial-llm-provider.ts';

async function runTests() {
  console.log('🧪 Starting Editorial Provider Resilience & Diagnostic Suite (EDITORIAL-PROVIDER-RESILIENCE-1)...\n');

  let passed = 0;
  async function test(name, fn) {
    try {
      await fn();
      console.log(`  ✅ PASS: ${name}`);
      passed++;
    } catch (err) {
      console.error(`  ❌ FAIL: ${name}`);
      console.error(err);
      process.exit(1);
    }
  }

  // 1. 200 + valid content -> SUCCESS
  await test('1. 200 + valid content -> SUCCESS with telemetry and diagnostics', async () => {
    const mockFetch = async () => new Response(JSON.stringify({
      id: 'chatcmpl-test-01',
      model: 'gpt-5.6-luna',
      choices: [{
        finish_reason: 'stop',
        message: { role: 'assistant', content: 'Artikel draf lengkap yang valid.' }
      }],
      usage: {
        prompt_tokens: 150,
        completion_tokens: 50,
        total_tokens: 200
      }
    }), { status: 200, headers: { 'Content-Type': 'application/json' } });

    const provider = new EditorialLlmProvider({
      apiKey: 'test-key',
      fetchFn: mockFetch,
      maxRetries: 1
    });

    const res = await provider.generate({
      messages: [
        { role: 'system', content: 'System instruction' },
        { role: 'user', content: 'Tulis artikel' }
      ]
    });

    assert.strictEqual(res.success, true);
    assert.strictEqual(res.content, 'Artikel draf lengkap yang valid.');
    assert.strictEqual(res.attempts, 1);
    assert.strictEqual(res.finishReason, 'stop');
    assert.strictEqual(res.httpStatus, 200);
    assert.ok(res.usage && res.usage.totalTokens === 200);
    assert.ok(res.promptTelemetry && res.promptTelemetry.total_prompt_characters > 0);
    assert.ok(Array.isArray(res.attemptsDiagnostics) && res.attemptsDiagnostics.length === 1);
  });

  // 2. 200 + empty content -> PROVIDER_EMPTY_RESPONSE
  await test('2. 200 + empty content -> PROVIDER_EMPTY_RESPONSE', async () => {
    let callCount = 0;
    const mockFetch = async () => {
      callCount++;
      return new Response(JSON.stringify({
        choices: [{
          finish_reason: 'stop',
          message: { role: 'assistant', content: '   \n  \t ' }
        }]
      }), { status: 200, headers: { 'Content-Type': 'application/json' } });
    };

    const provider = new EditorialLlmProvider({
      apiKey: 'test-key',
      fetchFn: mockFetch,
      maxRetries: 1
    });

    const res = await provider.generate({
      messages: [{ role: 'user', content: 'Tulis artikel' }]
    });

    assert.strictEqual(res.success, false);
    assert.strictEqual(res.errorCategory, 'PROVIDER_EMPTY_RESPONSE');
    assert.strictEqual(res.canonicalCategory, 'PROVIDER_EMPTY_RESPONSE');
    assert.strictEqual(res.httpStatus, 200);
    assert.strictEqual(res.content, null);
    assert.strictEqual(callCount, 2, 'Empty response must be retried under bounded retry policy');
    assert.strictEqual(res.attempts, 2);
  });

  // 3. 200 + missing choices -> PROVIDER_MISSING_CONTENT
  await test('3. 200 + missing choices -> PROVIDER_MISSING_CONTENT', async () => {
    let callCount = 0;
    const mockFetch = async () => {
      callCount++;
      return new Response(JSON.stringify({
        choices: []
      }), { status: 200, headers: { 'Content-Type': 'application/json' } });
    };

    const provider = new EditorialLlmProvider({
      apiKey: 'test-key',
      fetchFn: mockFetch,
      maxRetries: 1
    });

    const res = await provider.generate({
      messages: [{ role: 'user', content: 'Tulis artikel' }]
    });

    assert.strictEqual(res.success, false);
    assert.strictEqual(res.errorCategory, 'PROVIDER_MISSING_CONTENT');
    assert.strictEqual(res.canonicalCategory, 'PROVIDER_MISSING_CONTENT');
    assert.strictEqual(callCount, 2, 'Missing choices must be retried under bounded retry policy');
  });

  // 3b. 200 + null content in message -> PROVIDER_MISSING_CONTENT
  await test('3b. 200 + null content in message -> PROVIDER_MISSING_CONTENT', async () => {
    const mockFetch = async () => new Response(JSON.stringify({
      choices: [{
        finish_reason: 'stop',
        message: { role: 'assistant', content: null }
      }]
    }), { status: 200, headers: { 'Content-Type': 'application/json' } });

    const provider = new EditorialLlmProvider({
      apiKey: 'test-key',
      fetchFn: mockFetch,
      maxRetries: 0
    });

    const res = await provider.generate({
      messages: [{ role: 'user', content: 'Tulis' }]
    });

    assert.strictEqual(res.success, false);
    assert.strictEqual(res.errorCategory, 'PROVIDER_MISSING_CONTENT');
    assert.strictEqual(res.canonicalCategory, 'PROVIDER_MISSING_CONTENT');
  });

  // 4. 429 -> transient retry
  await test('4. 429 -> transient retry', async () => {
    let callCount = 0;
    const mockFetch = async () => {
      callCount++;
      if (callCount === 1) {
        return new Response('Rate limit reached', { status: 429 });
      }
      return new Response(JSON.stringify({
        choices: [{
          message: { role: 'assistant', content: 'Berhasil setelah retry 429.' }
        }]
      }), { status: 200, headers: { 'Content-Type': 'application/json' } });
    };

    const provider = new EditorialLlmProvider({
      apiKey: 'test-key',
      fetchFn: mockFetch,
      maxRetries: 2
    });

    const res = await provider.generate({
      messages: [{ role: 'user', content: 'Tulis' }]
    });

    assert.strictEqual(res.success, true);
    assert.strictEqual(res.content, 'Berhasil setelah retry 429.');
    assert.strictEqual(callCount, 2, 'Must have retried attempt 2 successfully after 429');
    assert.strictEqual(res.attempts, 2);
    assert.strictEqual(res.attemptsDiagnostics[0].errorCategory, 'PROVIDER_RATE_LIMIT');
  });

  // 5. 500/502/503/504 -> bounded retry
  await test('5. 500/502/503 -> bounded retry succeeding on attempt 2', async () => {
    let callCount = 0;
    const mockFetch = async () => {
      callCount++;
      if (callCount === 1) {
        return new Response('Bad Gateway', { status: 502 });
      }
      return new Response(JSON.stringify({
        choices: [{
          message: { role: 'assistant', content: 'Berhasil setelah 502.' }
        }]
      }), { status: 200, headers: { 'Content-Type': 'application/json' } });
    };

    const provider = new EditorialLlmProvider({
      apiKey: 'test-key',
      fetchFn: mockFetch,
      maxRetries: 2
    });

    const res = await provider.generate({
      messages: [{ role: 'user', content: 'Tulis' }]
    });

    assert.strictEqual(res.success, true);
    assert.strictEqual(res.content, 'Berhasil setelah 502.');
    assert.strictEqual(callCount, 2);
    assert.strictEqual(res.attemptsDiagnostics[0].httpStatus, 502);
    assert.strictEqual(res.attemptsDiagnostics[0].errorCategory, 'PROVIDER_HTTP_ERROR');
  });

  // 6. 401/403 -> no retry
  await test('6. 401/403 -> no retry (fail fast)', async () => {
    let callCount = 0;
    const mockFetch = async () => {
      callCount++;
      return new Response('Invalid API Key', { status: 401 });
    };

    const provider = new EditorialLlmProvider({
      apiKey: 'test-key',
      fetchFn: mockFetch,
      maxRetries: 2
    });

    const res = await provider.generate({
      messages: [{ role: 'user', content: 'Tulis' }]
    });

    assert.strictEqual(res.success, false);
    assert.strictEqual(res.errorCategory, 'PROVIDER_AUTH_ERROR');
    assert.strictEqual(res.canonicalCategory, 'PROVIDER_AUTH_ERROR');
    assert.strictEqual(callCount, 1, 'Must NOT retry on 401 auth error');
    assert.strictEqual(res.attempts, 1);
  });

  // 7. timeout -> PROVIDER_TIMEOUT + bounded retry
  await test('7. timeout -> PROVIDER_TIMEOUT + bounded retry', async () => {
    let callCount = 0;
    const mockFetch = async () => {
      callCount++;
      const abortErr = new Error('The operation was aborted');
      abortErr.name = 'AbortError';
      throw abortErr;
    };

    const provider = new EditorialLlmProvider({
      apiKey: 'test-key',
      fetchFn: mockFetch,
      maxRetries: 1,
      timeoutMs: 50
    });

    const res = await provider.generate({
      messages: [{ role: 'user', content: 'Tulis' }]
    });

    assert.strictEqual(res.success, false);
    assert.strictEqual(res.errorCategory, 'PROVIDER_TIMEOUT');
    assert.strictEqual(res.canonicalCategory, 'PROVIDER_TIMEOUT');
    assert.strictEqual(callCount, 2, 'Must retry on timeout');
    assert.strictEqual(res.attempts, 2);
  });

  // 8. context-length error -> PROVIDER_CONTEXT_LIMIT + no blind retry
  await test('8. context-length error -> PROVIDER_CONTEXT_LIMIT + no blind retry', async () => {
    let callCount = 0;
    const mockFetch = async () => {
      callCount++;
      return new Response(JSON.stringify({
        error: {
          message: "This model's maximum context length is 16385 tokens. However, your messages resulted in 18000 tokens.",
          type: 'invalid_request_error',
          code: 'context_length_exceeded'
        }
      }), { status: 400, headers: { 'Content-Type': 'application/json' } });
    };

    const provider = new EditorialLlmProvider({
      apiKey: 'test-key',
      fetchFn: mockFetch,
      maxRetries: 2
    });

    const res = await provider.generate({
      messages: [{ role: 'user', content: 'Tulis' }]
    });

    assert.strictEqual(res.success, false);
    assert.strictEqual(res.errorCategory, 'PROVIDER_CONTEXT_LIMIT');
    assert.strictEqual(res.canonicalCategory, 'PROVIDER_CONTEXT_LIMIT');
    assert.strictEqual(callCount, 1, 'Must NOT retry when prompt exceeds context limit');
    assert.strictEqual(res.attempts, 1);
  });

  // 9. invalid JSON -> PROVIDER_INVALID_JSON
  await test('9. invalid JSON -> PROVIDER_INVALID_JSON with bounded retry', async () => {
    let callCount = 0;
    const mockFetch = async () => {
      callCount++;
      return new Response('<html>502 Bad Gateway Proxy Error</html>', {
        status: 200,
        headers: { 'Content-Type': 'text/html' }
      });
    };

    const provider = new EditorialLlmProvider({
      apiKey: 'test-key',
      fetchFn: mockFetch,
      maxRetries: 1
    });

    const res = await provider.generate({
      messages: [{ role: 'user', content: 'Tulis' }]
    });

    assert.strictEqual(res.success, false);
    assert.strictEqual(res.errorCategory, 'PROVIDER_INVALID_JSON');
    assert.strictEqual(res.canonicalCategory, 'PROVIDER_INVALID_JSON');
    assert.strictEqual(callCount, 2);
  });

  // 10. retry exhausted -> final fail-closed status
  await test('10. retry exhausted -> final fail-closed status', async () => {
    let callCount = 0;
    const mockFetch = async () => {
      callCount++;
      return new Response('Server Error', { status: 500 });
    };

    const provider = new EditorialLlmProvider({
      apiKey: 'test-key',
      fetchFn: mockFetch,
      maxRetries: 2
    });

    const res = await provider.generate({
      messages: [{ role: 'user', content: 'Tulis' }]
    });

    assert.strictEqual(res.success, false);
    assert.strictEqual(res.errorCategory, 'PROVIDER_HTTP_ERROR');
    assert.strictEqual(res.canonicalCategory, 'PROVIDER_HTTP_ERROR');
    assert.strictEqual(callCount, 3, 'Must stop exactly after maxRetries (3 attempts total)');
    assert.strictEqual(res.attempts, 3);
    assert.strictEqual(res.attemptsDiagnostics.length, 3);
  });

  console.log(`\n🎉 All ${passed} tests in Editorial Provider Resilience Suite passed successfully!`);
}

runTests().catch(err => {
  console.error('Test suite failed:', err);
  process.exit(1);
});
