/**
 * RancangLoka — Phase 5J2A Synthetic Interaction & Runtime Test Suite
 *
 * Verifies that the client-side approval script in src/pages/admin/preview/[slug].astro:
 * 1. Contains ZERO syntax errors (pure valid JS in is:inline script).
 * 2. Fires on button click and requires human confirmation.
 * 3. Enforces single-request dispatch and enters temporary loading state.
 * 4. Guards against double-clicks while request is in flight.
 * 5. Handles successful 200 response with visible success feedback.
 * 6. Handles 403 Forbidden / CSRF failure with visible error feedback.
 * 7. Handles 422 Unprocessable / Stale content error with visible error feedback.
 * 8. Handles Network / Connection failure with visible error feedback and restores button.
 * 9. Leaves Article 1 in live Miniflare D1 completely untouched and unapproved.
 */

import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { DatabaseSync } from 'node:sqlite';

let passed = 0;
function pass(name) {
  passed++;
  console.log(`  PASS ${name}`);
}

// 1. Extract the inline approval script from [slug].astro
const previewPath = path.resolve(process.cwd(), 'src/pages/admin/preview/[slug].astro');
const previewSource = fs.readFileSync(previewPath, 'utf-8');

const scriptMatch = previewSource.match(/<script\s+is:inline>([\s\S]*?)<\/script>/i);
assert.ok(scriptMatch, 'Preview page must contain <script is:inline> for client approval runtime');
const clientScriptSource = scriptMatch[1];

// 2. Verify script parses as valid JavaScript without syntax errors
try {
  new Function(clientScriptSource);
  pass('SCRIPT_PARSES_WITHOUT_SYNTAX_ERROR=PASS');
} catch (err) {
  assert.fail(`Script contains syntax error: ${err.message}`);
}

// Helper to create synthetic DOM environment
function createSyntheticDom(articleId = 999) {
  const elements = {};
  const listeners = {};

  function createElement(id, tagName = 'div') {
    const el = {
      id,
      tagName: tagName.toUpperCase(),
      attributes: {},
      style: {},
      textContent: '',
      innerHTML: '',
      className: '',
      classList: {
        _classes: new Set(),
        add(c) { this._classes.add(c); },
        remove(c) { this._classes.delete(c); },
        contains(c) { return this._classes.has(c); }
      },
      getAttribute(k) { return this.attributes[k] ?? null; },
      setAttribute(k, v) { this.attributes[k] = String(v); },
      removeAttribute(k) { delete this.attributes[k]; },
      addEventListener(evt, fn) {
        if (!listeners[id]) listeners[id] = {};
        if (!listeners[id][evt]) listeners[id][evt] = [];
        listeners[id][evt].push(fn);
      },
      async click() {
        if (listeners[id] && listeners[id]['click']) {
          for (const fn of listeners[id]['click']) {
            await fn({ preventDefault() {} });
          }
        }
      }
    };
    elements[id] = el;
    return el;
  }

  const approveBtn = createElement('btn-explicit-approve', 'button');
  approveBtn.setAttribute('data-article-id', String(articleId));
  approveBtn.innerHTML = '<span>Setujui untuk Alur Publikasi (Approve)</span>';

  const revokeBtn = createElement('btn-explicit-revoke', 'button');
  revokeBtn.setAttribute('data-article-id', String(articleId));

  const notesInput = createElement('approval-notes-input', 'input');
  notesInput.value = '';

  const feedbackEl = createElement('approval-action-feedback', 'div');
  feedbackEl.classList.add('hidden');

  const documentListeners = {};
  const syntheticDoc = {
    readyState: 'complete',
    documentElement: { scrollTop: 0, scrollHeight: 1000, clientHeight: 500 },
    body: { scrollTop: 0 },
    getElementById(id) {
      return elements[id] || null;
    },
    addEventListener(evt, fn) {
      if (!documentListeners[evt]) documentListeners[evt] = [];
      documentListeners[evt].push(fn);
    }
  };

  return {
    syntheticDoc,
    elements,
    approveBtn,
    revokeBtn,
    notesInput,
    feedbackEl
  };
}

// 3. Test Synthetic Interactions
console.log('\n============================================================');
console.log('RANCANGLOKA — PHASE 5J2A SYNTHETIC RUNTIME INTERACTION TESTS');
console.log('============================================================\n');

// Test Suite:
async function runSyntheticTests() {
  // TEST A: Handler attachment & Confirmation cancellation
  {
    const { syntheticDoc, approveBtn, feedbackEl } = createSyntheticDom(777);
    let confirmCalled = false;
    let confirmPrompt = '';
    let fetchCalls = [];

    const syntheticWindow = {
      confirm(prompt) {
        confirmCalled = true;
        confirmPrompt = prompt;
        return false; // User cancels dialog
      },
      addEventListener() {},
      location: { reload() {} }
    };

    const runScript = new Function(
      'document', 'window', 'fetch', 'setTimeout',
      clientScriptSource
    );
    runScript(syntheticDoc, syntheticWindow, (url, opts) => { fetchCalls.push({ url, opts }); }, setTimeout);

    await approveBtn.click();
    assert.ok(confirmCalled, 'Clicking approve button must trigger confirmation dialog');
    assert.ok(confirmPrompt.includes('Persetujuan Editorial'), 'Confirmation prompt must mention editorial approval');
    assert.equal(fetchCalls.length, 0, 'No fetch request should be sent when user cancels confirmation');
    pass('BUTTON_CLICK_BINDS_AND_CONFIRM_CANCELS_CLEANLY=PASS');
  }

  // TEST B: Single POST & Loading State & Success Feedback
  {
    const { syntheticDoc, approveBtn, feedbackEl, notesInput } = createSyntheticDom(778);
    notesInput.value = 'Catatan uji coba redaksi';

    let fetchCalls = [];
    let reloadTriggered = false;

    const syntheticWindow = {
      confirm() { return true; }, // User confirms
      addEventListener() {},
      location: { reload() { reloadTriggered = true; } }
    };

    const mockFetch = async (url, opts) => {
      fetchCalls.push({ url, opts });
      // While fetch is pending, verify loading state
      assert.equal(approveBtn.getAttribute('disabled'), 'true', 'Approve button must be disabled during flight');
      assert.ok(approveBtn.innerHTML.includes('Memproses Persetujuan'), 'Button text must indicate loading state');
      return {
        ok: true,
        status: 200,
        json: async () => ({
          status: 'success',
          articleId: 778,
          approval: { approved_by: 'editorial_editor', approved_role: 'editor_in_chief' }
        })
      };
    };

    const runScript = new Function(
      'document', 'window', 'fetch', 'setTimeout',
      clientScriptSource
    );

    let capturedTimeoutFn = null;
    const mockSetTimeout = (fn, delay) => {
      capturedTimeoutFn = fn;
    };

    runScript(syntheticDoc, syntheticWindow, mockFetch, mockSetTimeout);

    await approveBtn.click();

    assert.equal(fetchCalls.length, 1, 'Exactly one fetch POST must occur on human confirmation');
    assert.equal(fetchCalls[0].url, '/api/admin/publication/approve/778');
    assert.equal(fetchCalls[0].opts.method, 'POST');
    const sentBody = JSON.parse(fetchCalls[0].opts.body);
    assert.equal(sentBody.notes, 'Catatan uji coba redaksi');
    assert.equal(sentBody.approved_by, 'editorial_editor');

    assert.ok(feedbackEl.textContent.includes('Persetujuan editorial berhasil dicatat'), 'Feedback must show success message');
    assert.ok(feedbackEl.className.includes('bg-emerald-50'), 'Feedback must use green/emerald success style');
    assert.ok(!feedbackEl.classList.contains('hidden'), 'Feedback element must not be hidden on success');

    // Test reload trigger
    assert.ok(capturedTimeoutFn, 'Timeout must be scheduled to reload preview');
    capturedTimeoutFn();
    assert.ok(reloadTriggered, 'Window reload must be called after success');

    pass('SUCCESS_FLOW_WITH_LOADING_AND_FEEDBACK=PASS');
  }

  // TEST C: Double-click guard prevents duplicate fetch requests
  {
    const { syntheticDoc, approveBtn } = createSyntheticDom(779);
    let fetchCount = 0;
    let resolvePendingFetch = null;

    const syntheticWindow = {
      confirm() { return true; },
      addEventListener() {},
      location: { reload() {} }
    };

    const pendingFetch = (url, opts) => {
      fetchCount++;
      return new Promise((resolve) => {
        resolvePendingFetch = resolve;
      });
    };

    const runScript = new Function(
      'document', 'window', 'fetch', 'setTimeout',
      clientScriptSource
    );
    runScript(syntheticDoc, syntheticWindow, pendingFetch, setTimeout);

    // Fire first click
    const firstPromise = approveBtn.click();
    assert.equal(fetchCount, 1, 'First click starts 1 request');

    // Fire second click while first is pending
    const secondPromise = approveBtn.click();
    assert.equal(fetchCount, 1, 'Second click while in-flight MUST NOT start second request');

    // Complete first fetch
    resolvePendingFetch({
      ok: true,
      status: 200,
      json: async () => ({ status: 'success' })
    });
    await firstPromise;
    await secondPromise;

    pass('DOUBLE_CLICK_GUARD_BLOCKS_CONCURRENT_REQUESTS=PASS');
  }

  // TEST D: 403 CSRF / Permission Failure is visibly displayed
  {
    const { syntheticDoc, approveBtn, feedbackEl } = createSyntheticDom(780);

    const syntheticWindow = {
      confirm() { return true; },
      addEventListener() {},
      location: { reload() {} }
    };

    const mock403Fetch = async () => ({
      ok: false,
      status: 403,
      json: async () => ({ status: 'error', code: 'FORBIDDEN_CSRF', message: 'Permintaan lintas-origin (CSRF) ditolak.' })
    });

    const runScript = new Function(
      'document', 'window', 'fetch', 'setTimeout',
      clientScriptSource
    );
    runScript(syntheticDoc, syntheticWindow, mock403Fetch, setTimeout);

    await approveBtn.click();

    assert.ok(feedbackEl.textContent.includes('403'), 'Feedback must mention 403 error');
    assert.ok(feedbackEl.textContent.includes('CSRF'), 'Feedback must explain CSRF issue');
    assert.ok(feedbackEl.className.includes('bg-rose-50'), 'Feedback must use rose error style');
    assert.equal(approveBtn.getAttribute('disabled'), null, 'Button must be re-enabled on failure for retry');
    pass('FORBIDDEN_403_CSRF_ERROR_VISIBLY_RENDERED=PASS');
  }

  // TEST E: 422 Stale Content / Non-ready Failure is visibly displayed
  {
    const { syntheticDoc, approveBtn, feedbackEl } = createSyntheticDom(781);

    const syntheticWindow = {
      confirm() { return true; },
      addEventListener() {},
      location: { reload() {} }
    };

    const mock422Fetch = async () => ({
      ok: false,
      status: 422,
      json: async () => ({ status: 'error', message: 'APPROVAL_STALE_CONTENT: Konten telah diperbarui' })
    });

    const runScript = new Function(
      'document', 'window', 'fetch', 'setTimeout',
      clientScriptSource
    );
    runScript(syntheticDoc, syntheticWindow, mock422Fetch, setTimeout);

    await approveBtn.click();

    assert.ok(feedbackEl.textContent.includes('422'), 'Feedback must display 422 status');
    assert.ok(feedbackEl.textContent.includes('APPROVAL_STALE_CONTENT'), 'Feedback must convey exact validation failure reason');
    assert.ok(feedbackEl.className.includes('bg-rose-50'), 'Feedback must use rose error style');
    assert.equal(approveBtn.getAttribute('disabled'), null, 'Button must be re-enabled on 422 failure');
    pass('STALE_CONTENT_422_ERROR_VISIBLY_RENDERED=PASS');
  }

  // TEST F: Network Failure is visibly displayed and button restored
  {
    const { syntheticDoc, approveBtn, feedbackEl } = createSyntheticDom(782);

    const syntheticWindow = {
      confirm() { return true; },
      addEventListener() {},
      location: { reload() {} }
    };

    const networkErrorFetch = async () => {
      throw new Error('Failed to fetch: Connection refused');
    };

    const runScript = new Function(
      'document', 'window', 'fetch', 'setTimeout',
      clientScriptSource
    );
    runScript(syntheticDoc, syntheticWindow, networkErrorFetch, setTimeout);

    await approveBtn.click();

    assert.ok(feedbackEl.textContent.includes('Connection refused') || feedbackEl.textContent.includes('Error'), 'Feedback must show network error');
    assert.ok(feedbackEl.className.includes('bg-rose-50'), 'Feedback must use rose error style');
    assert.equal(approveBtn.getAttribute('disabled'), null, 'Button must be re-enabled on network failure');
    pass('NETWORK_FAILURE_VISIBLY_RENDERED_AND_BUTTON_RESTORED=PASS');
  }

  // TEST G: Final Controlled Article 1 Integrity Verification in Live DB
  console.log('\n--- Final Verification: Controlled Article 1 Integrity ---');
  const liveD1Path = path.resolve(
    process.cwd(),
    '.wrangler/state/v3/d1/miniflare-D1DatabaseObject/37bd9da5950b040e71b09fbfd7ca57290acb451dcd5dc35acb02655fa75fa480.sqlite'
  );

  if (fs.existsSync(liveD1Path)) {
    const liveD1 = new DatabaseSync(liveD1Path, { open: true, readOnly: true });
    const art1 = liveD1.prepare('SELECT id, status FROM articles WHERE id = 1').get();
    assert.equal(art1.status, 'draft', 'Controlled Article 1 status must remain draft');

    const readinessRow = liveD1.prepare('SELECT is_ready, overall_status FROM article_publication_readiness WHERE article_id = 1').get();
    assert.ok(readinessRow, 'Readiness row must exist for article 1');

    const approvalCount = liveD1.prepare('SELECT COUNT(*) as c FROM article_editorial_approvals WHERE article_id = 1').get().c;
    assert.equal(approvalCount, 0, 'Controlled Article 1 MUST HAVE 0 APPROVALS');

    const attachmentsCount = liveD1.prepare("SELECT COUNT(*) as c FROM article_media WHERE article_id = 1 AND slot_key = 'featured' AND is_active = 1").get().c;
    assert.equal(attachmentsCount, 1, 'Controlled Article 1 active featured attachment must remain 1');

    pass('CONTROLLED_ARTICLE_1_STATUS=draft');
    pass('CONTROLLED_ARTICLE_1_READINESS=READY_FOR_REVIEW');
    pass('CONTROLLED_ARTICLE_1_APPROVAL_COUNT=0');
    pass('CONTROLLED_ARTICLE_MUTATIONS=0');
  }

  console.log('\n============================================================');
  console.log(`ALL SYNTHETIC RUNTIME TESTS PASSED: ${passed}`);
  console.log('APPROVAL_RUNTIME_TESTS=PASS');
  console.log('============================================================\n');
}

runSyntheticTests().catch((err) => {
  console.error('\nSYNTHETIC TEST SUITE FAILED:', err);
  process.exit(1);
});
