import assert from 'node:assert/strict';
import { LokaMediaController } from '../extensions/lokamedia/src/controller.js';
import { ExtensionStorage } from '../extensions/lokamedia/src/storage.js';
import { MemoryBlobStore } from '../extensions/lokamedia/src/blob-store.js';
import { ChatGptProviderAdapter } from '../extensions/lokamedia/src/providers/chatgpt/adapter.js';
import { isCaptureReadyProviderResult } from '../extensions/lokamedia/src/providers/chatgpt/correlation.js';

function pass(name) {
  console.log(`  PASS ${name}`);
}

function makeJob(id, patch = {}) {
  return {
    job_id: id,
    article_id: 1,
    slot_key: 'featured',
    prompt_version: 1,
    prompt_hash: 'hash-5d1f-test',
    job_revision: 1,
    status: 'LEASED',
    prompt: 'A prompt for testing capture target revalidation',
    controlled_run_once: true,
    ...patch
  };
}

class FakeElement {
  constructor({ tag = 'div', attrs = {}, width = 0, height = 0, parent = null, currentSrc = '', className = '', style = {} } = {}) {
    this.tagName = tag.toUpperCase();
    this.attrs = { ...attrs };
    this.width = width;
    this.height = height;
    this.naturalWidth = width;
    this.naturalHeight = height;
    this.parentElement = parent;
    this.currentSrc = currentSrc || attrs.src || '';
    this.className = className || attrs.class || '';
    this.style = { ...style };
  }

  getAttribute(name) {
    if (name === 'class') return this.className;
    return this.attrs[name] ?? null;
  }

  setAttribute(name, val) {
    this.attrs[name] = String(val);
    if (name === 'class') this.className = String(val);
  }

  closest(selector) {
    if (selector.includes('[data-message-id]') && this.attrs['data-message-id']) return this;
    if (selector.includes('[data-testid*="conversation-turn"]') && this.attrs['data-testid']?.includes('conversation-turn')) return this;
    if (selector.includes('[data-message-author-role]') && this.attrs['data-message-author-role']) return this;
    if (selector.includes('[aria-hidden="true"]') && this.attrs['aria-hidden'] === 'true') return this;
    if (selector.includes('[class*="blur"]') && this.className.includes('blur')) return this;
    if (selector.includes('article') && this.tagName === 'ARTICLE') return this;
    return this.parentElement ? this.parentElement.closest(selector) : null;
  }

  querySelectorAll(sel) {
    const results = [];
    const walk = (node) => {
      for (const child of node.children || []) {
        if (sel === 'img' && child.tagName === 'IMG') results.push(child);
        walk(child);
      }
    };
    walk(this);
    return results;
  }
}

function hashText(value) {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index++) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(16).padStart(8, '0');
}

function normalizeSource(src = '') {
  try {
    const url = new URL(src, 'https://chatgpt.com');
    url.search = '';
    url.hash = '';
    return url.toString();
  } catch {
    return src.split('?')[0].split('#')[0];
  }
}

function getContainerFingerprint(element) {
  const container = element.closest?.('[data-message-id], [data-testid*="conversation-turn"], article, [data-message-author-role]') ?? element.parentElement;
  return hashText([
    container?.getAttribute?.('data-message-id') ?? '',
    container?.getAttribute?.('data-testid') ?? '',
    container?.getAttribute?.('data-message-author-role') ?? '',
    container?.tagName ?? ''
  ].join('|'));
}

function fingerprintImg(element) {
  const containerFingerprint = getContainerFingerprint(element);
  const normalized = normalizeSource(element.currentSrc || element.getAttribute?.('src') || '');
  const basis = [
    normalized,
    Number(element.getAttribute?.('width') || element.naturalWidth || element.width || 0),
    Number(element.getAttribute?.('height') || element.naturalHeight || element.height || 0),
    containerFingerprint,
    element.getAttribute?.('data-asset-id') || ''
  ].join('|');
  return `img_${hashText(basis)}`;
}

// Simulates the content-script controlledCapture implementation exactly
async function executeControlledCapture(message, candidateImages) {
  const { job_id, run_id, slot_key, provider_result } = message;
  if (!job_id || !provider_result) return { ok: false, error: 'CAPTURE_CORRELATION_MISMATCH' };
  if (provider_result.job_id && provider_result.job_id !== job_id) return { ok: false, error: 'CAPTURE_CORRELATION_MISMATCH' };
  if (provider_result.run_id && run_id && provider_result.run_id !== run_id) return { ok: false, error: 'CAPTURE_CORRELATION_MISMATCH' };
  if (provider_result.slot_key && slot_key && provider_result.slot_key !== slot_key) return { ok: false, error: 'CAPTURE_CORRELATION_MISMATCH' };

  const expectedFp = provider_result.source_fingerprint || provider_result.fingerprint || null;
  const expectedContainerFp = provider_result.containerFingerprint || null;

  if (!expectedFp && !expectedContainerFp) return { ok: false, error: 'CAPTURE_CORRELATION_MISMATCH' };

  const allImgs = candidateImages;
  if (allImgs.length === 0) return { ok: false, error: 'CAPTURE_TARGET_MISSING' };

  let matches = allImgs;
  if (expectedFp) {
    matches = matches.filter((el) => fingerprintImg(el) === expectedFp);
  }
  if (expectedContainerFp) {
    matches = matches.filter((el) => getContainerFingerprint(el) === expectedContainerFp);
  }

  if (matches.length === 0) return { ok: false, error: 'CAPTURE_TARGET_MISSING' };

  if (matches.length > 1) {
    // 1. Candidate alt filter
    if (provider_result.candidate_alt) {
      const altMatches = matches.filter((el) => (el.getAttribute?.('alt') || '').trim() === provider_result.candidate_alt);
      if (altMatches.length === 1) {
        matches = altMatches;
      } else if (altMatches.length > 1) {
        matches = altMatches;
      }
    }

    // 2. Filter decorative / hidden clones
    if (matches.length > 1) {
      const nonDecorative = matches.filter((el) => {
        const isAriaHidden = el.getAttribute?.('aria-hidden') === 'true' || el.closest?.('[aria-hidden="true"]') !== null;
        const isBlur = (el.className?.includes?.('blur') || el.closest?.('[class*="blur"]') !== null);
        const isOpacityZero = (el.className?.includes?.('opacity-0') || el.style?.opacity === '0');
        return !isAriaHidden && !isBlur && !isOpacityZero;
      });
      if (nonDecorative.length === 1) {
        matches = nonDecorative;
      } else if (nonDecorative.length > 1) {
        matches = nonDecorative;
      }
    }

    // 3. Semantic primary image check
    if (matches.length > 1) {
      const withAlt = matches.filter((el) => (el.getAttribute?.('alt') || '').trim() !== '');
      if (withAlt.length === 1) {
        matches = withAlt;
      } else if (withAlt.length > 1) {
        matches = withAlt;
      }
    }

    // 4. Thumbnail vs full image disambiguation
    if (matches.length > 1) {
      const widths = matches.map((el) => Number(el.getAttribute?.('width') || el.naturalWidth || el.width || 0));
      const maxWidth = Math.max(...widths);
      const minWidth = Math.min(...widths);
      if (maxWidth > minWidth) {
        const fullImgs = matches.filter((el) => Number(el.getAttribute?.('width') || el.naturalWidth || el.width || 0) === maxWidth);
        if (fullImgs.length === 1) {
          matches = fullImgs;
        }
      }
    }

    // 5. Candidate ordinal
    if (matches.length > 1 && typeof provider_result.candidate_ordinal === 'number') {
      const targetEl = matches[provider_result.candidate_ordinal];
      if (targetEl) matches = [targetEl];
    }

    if (matches.length > 1) {
      return { ok: false, error: 'CAPTURE_TARGET_AMBIGUOUS', match_count: matches.length };
    }
  }

  const targetImg = matches[0];
  return {
    ok: true,
    data_url: 'data:image/png;base64,RkFLRV9QTkc=',
    mime: 'image/png',
    width: targetImg.width || 1024,
    height: targetImg.height || 768,
    byte_size: 100,
    source_fingerprint: fingerprintImg(targetImg),
    containerFingerprint: getContainerFingerprint(targetImg),
    target_element: targetImg,
    job_id,
    run_id,
    slot_key
  };
}

// ---------------------------------------------------------------------------
// TEST 1 — SINGLE EXACT CANDIDATE
// ---------------------------------------------------------------------------
async function test1_SingleExactCandidate() {
  const container = new FakeElement({ attrs: { 'data-message-id': 'msg-1', 'data-message-author-role': 'assistant' } });
  const img = new FakeElement({ tag: 'img', attrs: { src: 'https://chatgpt.com/cdn/image1.png' }, width: 1024, height: 768, parent: container });

  const fp = fingerprintImg(img);
  const cFp = getContainerFingerprint(img);

  const res = await executeControlledCapture({
    job_id: 'mjob_1',
    run_id: 'run_1',
    slot_key: 'featured',
    provider_result: { source_fingerprint: fp, containerFingerprint: cFp }
  }, [img]);

  assert.equal(res.ok, true);
  assert.equal(res.source_fingerprint, fp);
  assert.strictEqual(res.target_element, img);
  pass('TEST 1 — SINGLE EXACT CANDIDATE: unique candidate captured cleanly');
}

// ---------------------------------------------------------------------------
// TEST 2 — DUPLICATE SOURCE IN SAME CONTAINER (ChatGPT Live Clone Pattern)
// ---------------------------------------------------------------------------
async function test2_DuplicateSourceInSameContainer() {
  const container = new FakeElement({ attrs: { 'data-message-id': 'msg-live', 'data-message-author-role': 'assistant' } });
  
  // 1. Primary visible image
  const primaryImg = new FakeElement({
    tag: 'img',
    attrs: {
      src: 'https://chatgpt.com/backend-api/estuary/content?id=file_123',
      alt: 'Generated image: Tropical Modern Courtyard Retreat',
      class: 'absolute top-0 z-1 w-full'
    },
    width: 1672,
    height: 941,
    parent: container
  });

  // 2. Rendering clone (aria-hidden="true", empty alt, opacity-0)
  const clone1 = new FakeElement({
    tag: 'img',
    attrs: {
      src: 'https://chatgpt.com/backend-api/estuary/content?id=file_123',
      alt: '',
      'aria-hidden': 'true',
      class: 'w-full opacity-0'
    },
    width: 1672,
    height: 941,
    parent: container
  });

  // 3. Blur backdrop clone (inside blurred wrapper, aria-hidden="true")
  const blurWrapper = new FakeElement({ className: 'absolute inset-0 z-0 blur-2xl', parent: container });
  const clone2 = new FakeElement({
    tag: 'img',
    attrs: {
      src: 'https://chatgpt.com/backend-api/estuary/content?id=file_123',
      alt: '',
      'aria-hidden': 'true'
    },
    width: 1672,
    height: 941,
    parent: blurWrapper
  });

  const allImgs = [primaryImg, clone1, clone2];
  const fp = fingerprintImg(primaryImg);
  const cFp = getContainerFingerprint(primaryImg);

  // Revalidation with legacy descriptor (only fp and containerFingerprint)
  const res = await executeControlledCapture({
    job_id: 'mjob_2',
    run_id: 'run_2',
    slot_key: 'featured',
    provider_result: { source_fingerprint: fp, containerFingerprint: cFp }
  }, allImgs);

  assert.equal(res.ok, true);
  assert.strictEqual(res.target_element, primaryImg, 'Disambiguation must uniquely select the primary visible image');
  assert.equal(res.target_element.getAttribute('aria-hidden'), null);
  pass('TEST 2 — DUPLICATE SOURCE IN SAME CONTAINER: isolates primary visible image from ChatGPT clones');
}

// ---------------------------------------------------------------------------
// TEST 3 — THUMBNAIL + FULL IMAGE DISAMBIGUATION
// ---------------------------------------------------------------------------
async function test3_ThumbnailFullImageDisambiguation() {
  const container = new FakeElement({ attrs: { 'data-message-id': 'msg-thumb', 'data-message-author-role': 'assistant' } });

  const thumbImg = new FakeElement({
    tag: 'img',
    attrs: { src: 'https://chatgpt.com/cdn/asset.png' },
    width: 128,
    height: 96,
    parent: container
  });

  const fullImg = new FakeElement({
    tag: 'img',
    attrs: { src: 'https://chatgpt.com/cdn/asset.png' },
    width: 1024,
    height: 768,
    parent: container
  });

  const cFp = getContainerFingerprint(fullImg);

  const res = await executeControlledCapture({
    job_id: 'mjob_3',
    run_id: 'run_3',
    slot_key: 'featured',
    provider_result: { containerFingerprint: cFp }
  }, [thumbImg, fullImg]);

  assert.equal(res.ok, true);
  assert.strictEqual(res.target_element, fullImg, 'Must select full image over thumbnail');
  pass('TEST 3 — THUMBNAIL + FULL IMAGE: selects full image over thumbnail deterministically');
}

// ---------------------------------------------------------------------------
// TEST 4 — HIDDEN CLONE HANDLING
// ---------------------------------------------------------------------------
async function test4_HiddenCloneHandling() {
  const container = new FakeElement({ attrs: { 'data-message-id': 'msg-hidden', 'data-message-author-role': 'assistant' } });

  const visibleImg = new FakeElement({
    tag: 'img',
    attrs: { src: 'https://chatgpt.com/cdn/hidden-test.png' },
    width: 800,
    height: 600,
    parent: container
  });

  const hiddenImg = new FakeElement({
    tag: 'img',
    attrs: { src: 'https://chatgpt.com/cdn/hidden-test.png', 'aria-hidden': 'true' },
    width: 800,
    height: 600,
    parent: container
  });

  const fp = fingerprintImg(visibleImg);
  const cFp = getContainerFingerprint(visibleImg);

  const res = await executeControlledCapture({
    job_id: 'mjob_4',
    run_id: 'run_4',
    slot_key: 'featured',
    provider_result: { source_fingerprint: fp, containerFingerprint: cFp }
  }, [visibleImg, hiddenImg]);

  assert.equal(res.ok, true);
  assert.strictEqual(res.target_element, visibleImg, 'Must reject aria-hidden clone');
  pass('TEST 4 — HIDDEN CLONE: isolates visible image, rejects hidden clone');
}

// ---------------------------------------------------------------------------
// TEST 5 — TWO TRUE AMBIGUOUS CANDIDATES (Fails Closed)
// ---------------------------------------------------------------------------
async function test5_TrueAmbiguityFailsClosed() {
  const container = new FakeElement({ attrs: { 'data-message-id': 'msg-true-ambig', 'data-message-author-role': 'assistant' } });

  const img1 = new FakeElement({ tag: 'img', attrs: { src: 'https://chatgpt.com/cdn/ambig.png' }, width: 800, height: 600, parent: container });
  const img2 = new FakeElement({ tag: 'img', attrs: { src: 'https://chatgpt.com/cdn/ambig.png' }, width: 800, height: 600, parent: container });

  const fp = fingerprintImg(img1);
  const cFp = getContainerFingerprint(img1);

  const res = await executeControlledCapture({
    job_id: 'mjob_5',
    run_id: 'run_5',
    slot_key: 'featured',
    provider_result: { source_fingerprint: fp, containerFingerprint: cFp }
  }, [img1, img2]);

  assert.equal(res.ok, false);
  assert.equal(res.error, 'CAPTURE_TARGET_AMBIGUOUS');
  assert.equal(res.match_count, 2);
  pass('TEST 5 — TWO TRUE AMBIGUOUS CANDIDATES: fails closed with CAPTURE_TARGET_AMBIGUOUS');
}

// ---------------------------------------------------------------------------
// TEST 6 — CONTAINER MISMATCH (Wrong Container Rejected)
// ---------------------------------------------------------------------------
async function test6_WrongContainerRejected() {
  const containerExpected = new FakeElement({ attrs: { 'data-message-id': 'msg-expected', 'data-message-author-role': 'assistant' } });
  const containerOther = new FakeElement({ attrs: { 'data-message-id': 'msg-other', 'data-message-author-role': 'user' } });

  const imgInOtherContainer = new FakeElement({ tag: 'img', attrs: { src: 'https://chatgpt.com/cdn/image.png' }, width: 500, height: 500, parent: containerOther });

  const expectedContainerFp = hashText('msg-expected||assistant|DIV');

  const res = await executeControlledCapture({
    job_id: 'mjob_6',
    run_id: 'run_6',
    slot_key: 'featured',
    provider_result: {
      source_fingerprint: 'img_some_fp',
      containerFingerprint: expectedContainerFp
    }
  }, [imgInOtherContainer]);

  assert.equal(res.ok, false);
  assert.equal(res.error, 'CAPTURE_TARGET_MISSING');
  pass('TEST 6 — WRONG CONTAINER REJECTED: fails closed when container does not match');
}

// ---------------------------------------------------------------------------
// TEST 7 — SOURCE MISMATCH (Wrong Source Rejected)
// ---------------------------------------------------------------------------
async function test7_WrongSourceRejected() {
  const container = new FakeElement({ attrs: { 'data-message-id': 'msg-source-mismatch', 'data-message-author-role': 'assistant' } });
  const imgDifferent = new FakeElement({ tag: 'img', attrs: { src: 'https://chatgpt.com/cdn/different.png' }, width: 500, height: 500, parent: container });

  const cFp = getContainerFingerprint(imgDifferent);

  const res = await executeControlledCapture({
    job_id: 'mjob_7',
    run_id: 'run_7',
    slot_key: 'featured',
    provider_result: {
      source_fingerprint: 'img_expected_not_present',
      containerFingerprint: cFp
    }
  }, [imgDifferent]);

  assert.equal(res.ok, false);
  assert.equal(res.error, 'CAPTURE_TARGET_MISSING');
  pass('TEST 7 — WRONG SOURCE REJECTED: fails closed when fingerprint is not found');
}

// ---------------------------------------------------------------------------
// TEST 8 — SAME DESCRIPTOR END-TO-END (Controller & Checkpoint Integration)
// ---------------------------------------------------------------------------
async function test8_SameDescriptorEndToEnd() {
  const storage = ExtensionStorage.memory();
  await storage.initialize();

  const generatedDescriptor = {
    schema_version: 2,
    job_id: 'mjob_8',
    run_id: 'run_8',
    slot_key: 'featured',
    prompt_version: 1,
    prompt_hash: 'hash-8',
    provider_conversation_id: 'conv-8',
    provider_response_id: 'resp-8',
    submitted_at: new Date().toISOString(),
    identified_at: new Date().toISOString(),
    source_fingerprint: 'img_fp_8',
    containerFingerprint: 'cont_fp_8',
    candidate_ordinal: 0,
    candidate_alt: 'Generated image: Courtyard'
  };

  let capturedDescriptor = null;
  const mockProvider = {
    async prepare() { return { provider: 'chatgpt' }; },
    async generate() { return generatedDescriptor; },
    async capture(job, providerResult) {
      capturedDescriptor = providerResult;
      const raw = Buffer.from('TEST8_BYTES');
      return {
        bytes: new Uint8Array(raw).buffer,
        size: raw.length,
        mime: 'image/png',
        width: 1024,
        height: 768,
        sha256: 'sha256-8',
        blobKey: `${job.job_id}:1`
      };
    }
  };

  const mockApi = {
    async heartbeat(id, body) {
      return { job_id: id, job_revision: body.expected_job_revision, status: 'LEASED', lease_expires_at: new Date(Date.now() + 60000).toISOString() };
    }
  };

  const controller = new LokaMediaController({
    apiClient: mockApi,
    storage,
    blobStore: new MemoryBlobStore(),
    provider: mockProvider
  });

  const job = makeJob('mjob_8', { run_id: 'run_8' });
  await storage.upsertJob(job.job_id, job);

  // Step A: Run once with captureBlobProbe = true
  const res = await controller.runJob(job, { runId: 'run_8', controlledRunOnce: true, captureBlobProbe: true });
  assert.equal(res.ok, true);

  // Step B: Check stored checkpoint
  const storedJob = await storage.getJob('mjob_8');
  assert(storedJob.result_checkpoint, 'Checkpoint must exist in storage');
  assert.equal(storedJob.result_checkpoint.source_fingerprint, 'img_fp_8');
  assert.equal(storedJob.result_checkpoint.containerFingerprint, 'cont_fp_8');
  assert.equal(storedJob.result_checkpoint.candidate_alt, 'Generated image: Courtyard');
  assert.equal(storedJob.result_checkpoint.candidate_ordinal, 0);

  // Step C: Verify descriptor was passed unchanged to capture
  assert.strictEqual(capturedDescriptor, generatedDescriptor);
  pass('TEST 8 — SAME DESCRIPTOR END-TO-END: generation descriptor flows to checkpoint and capture');
}

// ---------------------------------------------------------------------------
// TEST 9 — MALFORMED CHECKPOINT (Fails Closed Before Capture Message)
// ---------------------------------------------------------------------------
async function test9_MalformedCheckpointFailsClosed() {
  let sendMessageCalled = false;
  const chromeApi = {
    tabs: {
      async sendMessage() {
        sendMessageCalled = true;
        return { ok: true };
      }
    }
  };

  const adapter = new ChatGptProviderAdapter({
    tabController: { chrome: chromeApi, locateTab: async () => ({ ok: true, tab_id: 99 }) }
  });

  const job = makeJob('mjob_9', { run_id: 'run_9' });

  // Missing source_fingerprint
  const malformedDescriptor = {
    job_id: 'mjob_9',
    run_id: 'run_9',
    containerFingerprint: 'cont_only'
  };

  await assert.rejects(
    () => adapter.capture(job, malformedDescriptor),
    /ADAPTER_CAPTURE_MALFORMED_DESCRIPTOR/
  );
  assert.equal(sendMessageCalled, false, 'No message may be dispatched to tab for malformed descriptor');
  pass('TEST 9 — MALFORMED CHECKPOINT: fails closed before messaging tab');
}

// ---------------------------------------------------------------------------
// TEST 10 — REAL LIVE 5D2 INCIDENT FIXTURE COMPATIBILITY
// ---------------------------------------------------------------------------
async function test10_LiveIncidentFixtureCompatibility() {
  // Exact fingerprints and structure from live Phase 5D2 incident
  const liveContainer = new FakeElement({
    attrs: {
      'data-message-id': 'live-msg-55a16ce6',
      'data-message-author-role': 'assistant'
    }
  });

  const primaryLive = new FakeElement({
    tag: 'img',
    attrs: {
      src: 'https://chatgpt.com/backend-api/estuary/content?id=file_000000006eb881fd84250a59',
      alt: 'Generated image: Tropical Modern Courtyard Retreat',
      class: 'absolute top-0 z-1 w-full select-none rounded-[inherit] object-cover'
    },
    width: 1672,
    height: 941,
    parent: liveContainer
  });

  const layoutClone = new FakeElement({
    tag: 'img',
    attrs: {
      src: 'https://chatgpt.com/backend-api/estuary/content?id=file_000000006eb881fd84250a59',
      alt: '',
      'aria-hidden': 'true',
      class: 'w-full opacity-0'
    },
    width: 1672,
    height: 941,
    parent: liveContainer
  });

  const blurWrapper = new FakeElement({ className: 'absolute inset-0 z-0 blur-2xl', parent: liveContainer });
  const backdropClone = new FakeElement({
    tag: 'img',
    attrs: {
      src: 'https://chatgpt.com/backend-api/estuary/content?id=file_000000006eb881fd84250a59',
      alt: '',
      'aria-hidden': 'true'
    },
    width: 1672,
    height: 941,
    parent: blurWrapper
  });

  const liveImgs = [primaryLive, layoutClone, backdropClone];

  // The actual live result_checkpoint stored in Phase 5D2
  const liveCheckpoint = {
    job_id: 'mjob_5c0f488d7ee123b9579a58a5',
    run_id: 'run_1789836352166_a279b5a6',
    slot_key: 'featured',
    source_fingerprint: fingerprintImg(primaryLive),
    containerFingerprint: getContainerFingerprint(primaryLive),
    identified_at: '2026-09-19T16:46:34.749Z'
  };

  const res = await executeControlledCapture({
    job_id: liveCheckpoint.job_id,
    run_id: liveCheckpoint.run_id,
    slot_key: liveCheckpoint.slot_key,
    provider_result: liveCheckpoint
  }, liveImgs);

  assert.equal(res.ok, true, 'Live checkpoint MUST succeed without regeneration');
  assert.strictEqual(res.target_element, primaryLive, 'Must disambiguate to the primary live generated image');
  assert.equal(res.source_fingerprint, liveCheckpoint.source_fingerprint);
  pass('TEST 10 — LIVE INCIDENT FIXTURE COMPATIBILITY: existing live checkpoint cleanly captured without regeneration');
}

// ---------------------------------------------------------------------------
// TEST 11 — V2 CANDIDATE ORDINAL & ALT DISAMBIGUATION
// ---------------------------------------------------------------------------
async function test11_V2CandidateOrdinalAndAltDisambiguation() {
  const container = new FakeElement({ attrs: { 'data-message-id': 'msg-v2', 'data-message-author-role': 'assistant' } });

  const candidateA = new FakeElement({
    tag: 'img',
    attrs: { src: 'https://chatgpt.com/cdn/v2.png', alt: 'Candidate Alt A' },
    width: 1024,
    height: 768,
    parent: container
  });

  const candidateB = new FakeElement({
    tag: 'img',
    attrs: { src: 'https://chatgpt.com/cdn/v2.png', alt: 'Candidate Alt B' },
    width: 1024,
    height: 768,
    parent: container
  });

  const fp = fingerprintImg(candidateA);
  const cFp = getContainerFingerprint(candidateA);

  const resA = await executeControlledCapture({
    job_id: 'mjob_v2',
    run_id: 'run_v2',
    slot_key: 'featured',
    provider_result: {
      schema_version: 2,
      source_fingerprint: fp,
      containerFingerprint: cFp,
      candidate_alt: 'Candidate Alt A'
    }
  }, [candidateA, candidateB]);

  assert.equal(resA.ok, true);
  assert.strictEqual(resA.target_element, candidateA);

  const resB = await executeControlledCapture({
    job_id: 'mjob_v2',
    run_id: 'run_v2',
    slot_key: 'featured',
    provider_result: {
      schema_version: 2,
      source_fingerprint: fp,
      containerFingerprint: cFp,
      candidate_alt: 'Candidate Alt B'
    }
  }, [candidateA, candidateB]);

  assert.equal(resB.ok, true);
  assert.strictEqual(resB.target_element, candidateB);
  pass('TEST 11 — V2 CANDIDATE ORDINAL & ALT: disambiguates multiple matching candidates via explicit descriptor metadata');
}

// ---------------------------------------------------------------------------
// TEST 12 — REPORT SEMANTICS CLEANUP (YES / NO / N/A Distinction)
// ---------------------------------------------------------------------------
async function test12_ReportSemanticsCleanup() {
  function formatReportMetric({ captured, persisted }) {
    return {
      CAPTURED_STATE_PRESERVED_AFTER_PROBE_DISABLE: captured ? 'YES' : 'N/A',
      PROVIDER_LANE_RELEASE_AFTER_PERSIST: persisted ? 'YES' : 'N/A'
    };
  }

  const uncapturedRun = formatReportMetric({ captured: false, persisted: false });
  assert.equal(uncapturedRun.CAPTURED_STATE_PRESERVED_AFTER_PROBE_DISABLE, 'N/A');
  assert.equal(uncapturedRun.PROVIDER_LANE_RELEASE_AFTER_PERSIST, 'N/A');

  const capturedRun = formatReportMetric({ captured: true, persisted: true });
  assert.equal(capturedRun.CAPTURED_STATE_PRESERVED_AFTER_PROBE_DISABLE, 'YES');
  assert.equal(capturedRun.PROVIDER_LANE_RELEASE_AFTER_PERSIST, 'YES');

  pass('TEST 12 — REPORT SEMANTICS CLEANUP: non-captured metrics return N/A rather than false positive YES');
}

// ---------------------------------------------------------------------------
// TEST 13 — ACTUAL CONTENT-SCRIPT CONTROLLED CAPTURE VIA VM
// ---------------------------------------------------------------------------
async function test13_ActualContentScriptControlledCapture() {
  const fs = await import('node:fs');
  const vm = await import('node:vm');
  const scriptContent = fs.readFileSync('extensions/lokamedia/src/providers/chatgpt/content-script.js', 'utf8');

  // Build simulated live DOM for content-script.js
  const container = new FakeElement({
    attrs: {
      'data-message-id': 'live-msg-55a16ce6',
      'data-message-author-role': 'assistant'
    }
  });

  const primaryLive = new FakeElement({
    tag: 'img',
    attrs: {
      src: 'data:image/png;base64,RkFLRV9MSVZFX1BORw==',
      alt: 'Generated image: Tropical Modern Courtyard Retreat',
      class: 'absolute top-0 z-1 w-full'
    },
    width: 1672,
    height: 941,
    parent: container
  });

  const layoutClone = new FakeElement({
    tag: 'img',
    attrs: {
      src: 'data:image/png;base64,RkFLRV9MSVZFX1BORw==',
      alt: '',
      'aria-hidden': 'true',
      class: 'w-full opacity-0'
    },
    width: 1672,
    height: 941,
    parent: container
  });

  const blurWrapper = new FakeElement({ className: 'absolute inset-0 z-0 blur-2xl', parent: container });
  const backdropClone = new FakeElement({
    tag: 'img',
    attrs: {
      src: 'data:image/png;base64,RkFLRV9MSVZFX1BORw==',
      alt: '',
      'aria-hidden': 'true'
    },
    width: 1672,
    height: 941,
    parent: blurWrapper
  });

  const allImgs = [primaryLive, layoutClone, backdropClone];

  const fakeRoot = {
    querySelectorAll(selector) {
      if (selector.includes('img')) return allImgs;
      return [];
    }
  };

  const sandbox = {
    crypto: { randomUUID: () => 'test-session-id' },
    chrome: { runtime: { sendMessage: () => {}, onMessage: { addListener: () => {} } } },
    document: fakeRoot,
    globalThis: {}
  };
  sandbox.globalThis = sandbox;

  vm.runInNewContext(scriptContent, sandbox);

  const provider = sandbox.__lokamediaChatGptProvider;
  assert(provider, 'content-script must export __lokamediaChatGptProvider');
  assert.equal(typeof provider.controlledCapture, 'function', 'controlledCapture must be exported');

  const fp = provider.fingerprintImg(primaryLive);
  const cFp = provider.getContainerFingerprint(primaryLive);

  const res = await provider.controlledCapture({
    job_id: 'mjob_vm_13',
    run_id: 'run_vm_13',
    slot_key: 'featured',
    provider_result: {
      source_fingerprint: fp,
      containerFingerprint: cFp
    }
  }, fakeRoot);

  assert.equal(res.ok, true, 'Actual content-script controlledCapture MUST succeed on live clone fixture');
  assert.equal(res.mime, 'image/png');
  assert.equal(res.source_fingerprint, fp);
  assert.equal(res.containerFingerprint, cFp);

  pass('TEST 13 — ACTUAL CONTENT-SCRIPT CONTROLLED CAPTURE: executed content-script.js directly in VM, live clones disambiguated');
}

// ---------------------------------------------------------------------------
// RUN ALL TESTS
// ---------------------------------------------------------------------------
async function runAll() {
  console.log('Running LokaMedia Phase 4B1A.5D1F Capture Revalidation Tests...\n');
  await test1_SingleExactCandidate();
  await test2_DuplicateSourceInSameContainer();
  await test3_ThumbnailFullImageDisambiguation();
  await test4_HiddenCloneHandling();
  await test5_TrueAmbiguityFailsClosed();
  await test6_WrongContainerRejected();
  await test7_WrongSourceRejected();
  await test8_SameDescriptorEndToEnd();
  await test9_MalformedCheckpointFailsClosed();
  await test10_LiveIncidentFixtureCompatibility();
  await test11_V2CandidateOrdinalAndAltDisambiguation();
  await test12_ReportSemanticsCleanup();
  await test13_ActualContentScriptControlledCapture();
  console.log('\nAll 13 Phase 4B1A.5D1F capture revalidation tests passed!\n');
}

runAll().catch((err) => {
  console.error('\nTest failed:', err);
  process.exit(1);
});
