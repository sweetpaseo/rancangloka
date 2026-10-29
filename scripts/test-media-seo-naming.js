/**
 * Test Suite: SEO-Friendly Image Filenames & Provenance (TASK B)
 * MISSION: RANCANGLOKA_MEDIA_SEO_NAMING_1
 * 
 * Verifies:
 * 1. Descriptive filename generation: [topic]-[desc]-[shortid](-[width])?.[ext]
 * 2. Unsafe characters, spaces, and punctuation stripped into safe lowercase ASCII.
 * 3. Unicode and Indonesian text normalization (e.g. diacritics decomposed).
 * 4. Maximum filename length clamping without collision.
 * 5. Short ID uniqueness / deterministic SHA-256 binding.
 * 6. Responsive derivative generation (-480, -640, -960, -1200).
 * 7. Legacy hash filename compatibility: old SHA-256 URLs remain 100% valid.
 * 8. Image Provenance normalization across manual & multi-provider workflows.
 * 9. getResponsiveImageAttrs integration for both legacy and SEO filenames.
 */

import assert from 'node:assert';
import {
  buildSeoImageFilename,
  buildResponsiveDerivativeFilename,
  parseSeoImageFilename,
  slugifyDescriptor,
  computeShortId,
  normalizeImageProvenance
} from '../src/lib/media/seo-naming.ts';
import { getResponsiveImageAttrs, KNOWN_LOCAL_RESPONSIVE_HASHES } from '../src/lib/image.ts';

console.log('=== TEST SUITE: SEO-Friendly Image Filenames (RANCANGLOKA_MEDIA_SEO_NAMING_1) ===\n');

let passedTests = 0;

function runTest(name, fn) {
  try {
    fn();
    console.log(`✅ [PASS] ${name}`);
    passedTests++;
  } catch (err) {
    console.error(`❌ [FAIL] ${name}`);
    console.error(err);
    process.exit(1);
  }
}

// 1. Standard descriptive filename generation
runTest('Generate standard SEO-friendly descriptive image filename', () => {
  const filename = buildSeoImageFilename({
    topic: 'Kusen Aluminium vs UPVC',
    description: 'Jendela Ruang Tamu',
    sha256: 'a83f2c9e4b7d1a2c3d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0c1d2e3f4a5b6c',
    width: 1200,
    extension: 'webp'
  });

  assert.strictEqual(
    filename,
    'kusen-aluminium-vs-upvc-jendela-ruang-tamu-a83f2c-1200.webp',
    `Expected exact slug format, got: ${filename}`
  );
});

// 2. Unsafe characters, punctuation, and spaces
runTest('Sanitize unsafe characters, symbols, and irregular spaces', () => {
  const filename = buildSeoImageFilename({
    topic: 'Desain Dapur: Minimalis & Modern (2026)!?',
    description: 'Island Table / Meja Bar #1 @ Home',
    sha256: 'b47e812fa4c5d6e7f8a9b0c1d2e3f4a5b6c7d8e9f0a1b2c3d4e5f6a7b8c9d0e1',
    extension: 'webp'
  });

  // Must contain only lowercase letters, numbers, hyphens, dot
  assert.ok(/^[a-z0-9\-\.]+\.webp$/.test(filename), `Filename contains illegal characters: ${filename}`);
  assert.ok(filename.includes('desain-dapur-minimalis-modern-2026'));
  assert.ok(filename.includes('island-table-meja-bar-1-home'));
  assert.ok(filename.includes('b47e81'));
});

// 3. Unicode and Indonesian text normalization
runTest('Normalize Indonesian and Unicode text with accents and symbols', () => {
  const filename = buildSeoImageFilename({
    topic: 'Renovasi Façade Rumah Tropis Café',
    description: 'Plafon Kayu Bengkirai Résumé',
    sha256: 'c92a15f0123456789abcdef0123456789abcdef0123456789abcdef012345678',
    extension: 'webp'
  });

  assert.ok(!filename.includes('ç'), 'Should decompose ç to c');
  assert.ok(!filename.includes('é'), 'Should decompose é to e');
  assert.ok(filename.includes('facade'));
  assert.ok(filename.includes('resume'));
  assert.ok(filename.includes('c92a15'));
});

// 4. Long titles and length limits
runTest('Clamp long article titles within safe filesystem and R2 limits', () => {
  const longTopic = 'Perbandingan Lengkap Material Kusen Pintu dan Jendela Aluminium Ekstrusi vs UPVC Multi-Chamber untuk Rumah Menghadap Barat';
  const longDesc = 'Tampak Depan Pemasangan Profil Kaca Double Glass Berperedam Suara Tinggi di Perumahan Jakarta Selatan';

  const filename = buildSeoImageFilename({
    topic: longTopic,
    description: longDesc,
    sha256: 'd1e2f3a4b5c6d7e8f9a0b1c2d3e4f5a6b7c8d9e0f1a2b3c4d5e6f7a8b9c0d1e2',
    width: 1200,
    extension: 'webp'
  });

  assert.ok(filename.length <= 120, `Filename too long (${filename.length} chars): ${filename}`);
  assert.ok(filename.endsWith('-d1e2f3-1200.webp'), `Must preserve shortId and width: ${filename}`);
  assert.ok(/^[a-z0-9\-]+\.webp$/.test(filename), 'Must remain valid safe slug');
});

// 5. Short ID and collision prevention
runTest('Prevent filename collisions across identical topic/descriptions using deterministic shortId', () => {
  const img1 = buildSeoImageFilename({
    topic: 'Atap Baja Ringan',
    description: 'Rangka Kuda Kuda',
    sha256: '111111aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa'
  });

  const img2 = buildSeoImageFilename({
    topic: 'Atap Baja Ringan',
    description: 'Rangka Kuda Kuda',
    sha256: '222222bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb'
  });

  assert.notStrictEqual(img1, img2, 'Filenames with different SHA-256 must not collide');
  assert.ok(img1.includes('111111'));
  assert.ok(img2.includes('222222'));
});

// 6. Responsive derivative generation
runTest('Generate responsive derivatives (-480, -640, -960, -1200) from base SEO filename', () => {
  const base = 'kusen-aluminium-vs-upvc-jendela-ruang-tamu-a83f2c.webp';

  const w480 = buildResponsiveDerivativeFilename(base, 480);
  const w640 = buildResponsiveDerivativeFilename(base, 640);
  const w960 = buildResponsiveDerivativeFilename(base, 960);
  const w1200 = buildResponsiveDerivativeFilename(base, 1200);

  assert.strictEqual(w480, 'kusen-aluminium-vs-upvc-jendela-ruang-tamu-a83f2c-480.webp');
  assert.strictEqual(w640, 'kusen-aluminium-vs-upvc-jendela-ruang-tamu-a83f2c-640.webp');
  assert.strictEqual(w960, 'kusen-aluminium-vs-upvc-jendela-ruang-tamu-a83f2c-960.webp');
  assert.strictEqual(w1200, 'kusen-aluminium-vs-upvc-jendela-ruang-tamu-a83f2c-1200.webp');

  // Also verify deriving from already width-suffixed filename
  const baseWithWidth = 'kusen-aluminium-vs-upvc-jendela-ruang-tamu-a83f2c-1200.webp';
  const derivedFromWidth = buildResponsiveDerivativeFilename(baseWithWidth, 480);
  assert.strictEqual(derivedFromWidth, 'kusen-aluminium-vs-upvc-jendela-ruang-tamu-a83f2c-480.webp');
});

// 7. Legacy hash filename compatibility
runTest('Preserve legacy SHA-256 hash filenames and KNOWN_LOCAL_RESPONSIVE_HASHES', () => {
  const legacyHash = 'ef702415bb6c84ebc26d9647a282385d241e161f45074287d46db6648bc1af79';
  const legacyUrl = `/media/images/${legacyHash}.webp`;

  assert.ok(KNOWN_LOCAL_RESPONSIVE_HASHES.has(legacyHash));

  const attrs = getResponsiveImageAttrs(legacyUrl, 'Article 4 Cover', { slotType: 'article-cover' });
  assert.ok(attrs !== null);
  assert.strictEqual(attrs.src, legacyUrl);
  assert.ok(attrs.srcset.includes(`${legacyHash}-480.webp 480w`));
  assert.ok(attrs.srcset.includes(`${legacyHash}.webp 1200w`));
});

// 8. Integration: getResponsiveImageAttrs with SEO descriptive filename
runTest('getResponsiveImageAttrs resolves responsive srcset for new SEO filenames', () => {
  const seoUrl = '/media/images/kusen-aluminium-vs-upvc-jendela-ruang-tamu-a83f2c-1200.webp';
  const attrs = getResponsiveImageAttrs(seoUrl, 'Kusen Aluminium vs UPVC', { slotType: 'article-cover' });

  assert.ok(attrs !== null);
  assert.strictEqual(attrs.src, seoUrl);
  assert.ok(attrs.srcset.includes('kusen-aluminium-vs-upvc-jendela-ruang-tamu-a83f2c-480.webp 480w'));
  assert.ok(attrs.srcset.includes('kusen-aluminium-vs-upvc-jendela-ruang-tamu-a83f2c-640.webp 640w'));
  assert.ok(attrs.srcset.includes('kusen-aluminium-vs-upvc-jendela-ruang-tamu-a83f2c-960.webp 960w'));
  assert.ok(attrs.srcset.includes('kusen-aluminium-vs-upvc-jendela-ruang-tamu-a83f2c.webp 1200w'));
});

// 9. Image Provenance metadata integrity
runTest('Normalize and protect image provenance metadata across providers', () => {
  // Case A: ChatGPT / DALL-E
  const provChatGPT = normalizeImageProvenance({
    platform: 'chatgpt',
    model_name: 'DALL-E 3 (GPT-4o)',
    prompt: 'Interior living room with UPVC white window frame in tropical climate',
    prompt_reference: 'PROMPT-ART4-COVER-V1',
    generation_date: '2026-10-29T10:00:00Z',
    reviewed_by_human: true,
    reviewer: 'Chief Editor'
  });
  assert.strictEqual(provChatGPT.platform, 'chatgpt');
  assert.strictEqual(provChatGPT.platform_display_name, 'ChatGPT (OpenAI)');
  assert.strictEqual(provChatGPT.model_name, 'DALL-E 3 (GPT-4o)');
  assert.strictEqual(provChatGPT.reviewed_by_human, true);

  // Case B: Gemini / Nano Banana
  const provGemini = normalizeImageProvenance({
    platform: 'gemini',
    model_name: 'Nano Banana (Gemini 2.5 Flash)',
    prompt: 'Modern kitchen island with quartz countertop'
  });
  assert.strictEqual(provGemini.platform, 'gemini');
  assert.strictEqual(provGemini.platform_display_name, 'Gemini (Google)');

  // Case C: Seedream
  const provSeedream = normalizeImageProvenance({
    platform: 'seedream',
    model_name: 'Seedream 3.0'
  });
  assert.strictEqual(provSeedream.platform, 'seedream');

  // Case D: Qwen
  const provQwen = normalizeImageProvenance({
    platform: 'qwen',
    model_name: 'Wan 2.1'
  });
  assert.strictEqual(provQwen.platform, 'qwen');

  // Case E: Leonardo
  const provLeonardo = normalizeImageProvenance({
    platform: 'leonardo',
    model_name: 'Phoenix'
  });
  assert.strictEqual(provLeonardo.platform, 'leonardo');

  // Case F: Digen.ai
  const provDigen = normalizeImageProvenance({
    platform: 'digen',
    model_name: 'Digen Vision'
  });
  assert.strictEqual(provDigen.platform, 'digen');

  // Case G: Manual upload with unknown platform - does NOT invent provider
  const provManual = normalizeImageProvenance({
    reviewed_by_human: true,
    notes: 'Photo taken directly by homeowner'
  });
  assert.strictEqual(provManual.platform, 'manual');
  assert.strictEqual(provManual.platform_display_name, 'Manual Editorial Upload');
  assert.strictEqual(provManual.model_name, undefined); // Uninvented
});

console.log(`\n🎉 All ${passedTests} SEO-Friendly Image Naming tests PASSED!`);
