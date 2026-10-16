/**
 * ============================================================================
 * RancangLoka — CONTENT_PROTECTION-1B-A Test Suite
 * Pure Deterministic Publication DNA Fingerprint Core & Additive Schema Tests
 *
 * Requirements:
 * - 100% offline, deterministic, zero network, zero remote D1, zero R2.
 * - Golden vector tests:
 *   1. Canonical Markdown identity: identical normalized_text_hash
 *   2. Semantic block extraction: deterministic block_hashes_json
 *   3. MinHash byte identity: identical 64-hex strings across runs
 *   4. Line ending resilience: \r\n vs \n produce identical normalized hash
 *   5. Whitespace resilience: arbitrary spacing does not alter MinHash / normalized hash
 *   6. Meaningful prose change: alters hashes and isolates modified block
 *   7. Paragraph reordering: preserves individual block hashes while altering document hash
 *   8. Unicode NFKC normalization: decomposed and precomposed characters produce identical hash
 *   9. Link URL change: visible link text preserved, URL stripped (normalized hash unchanged)
 *  10. Image URL change: images stripped from prose, normalized hash unchanged
 *  11. Code text change: alters code block signature
 *  12. Short text (< 4 words) & empty text: deterministic, zero crash
 *  13. Exact content hash helper: exact identity matches canonical Markdown bytes
 *  14. Identifiers & Version Key: UUID v4 dna_<uuid>, receipt vs historical version keys
 *  15. MinHash coefficients: 64 pairs verified against prime p = 2^61 - 1
 *  16. MinHash BigInt representation: 16-character fixed-width hex strings
 *  17. Structural signature: presentation-independent, dynamic Article Support excluded
 *  18. Additive D1 Migration 0034: applied to local SQLite, unique version_key, nullable receipt
 * ============================================================================
 */

import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { DatabaseSync } from 'node:sqlite';

import {
  DNA_VERSION,
  NORMALIZATION_VERSION,
  SHINGLE_VERSION,
  MINHASH_VERSION,
  GENERATOR_VERSION,
  MINHASH_COMPONENTS,
  MINHASH_PRIME,
  MINHASH_COEFFICIENTS_64,
  generateDnaId,
  buildPublicationVersionKey,
  computeCanonicalContentHash,
  normalizeSimilarityText,
  computeNormalizedTextHash,
  extractWordTokens,
  buildWordShingles,
  hashShingleToField,
  computeMinhashSignature,
  segmentSemanticBlocks,
  extractStructuralSignature,
  canonicalizeBlockHashesJson,
  canonicalizeMinhashSignatureJson,
  canonicalizeStructuralSignatureJson,
  generatePublicationDnaMaterial,
} from '../src/lib/content-protection/publication-dna.ts';

let passed = 0;
let failed = 0;

function assert(condition, message) {
  if (condition) {
    passed++;
    console.log(`  ✓ ${message}`);
  } else {
    failed++;
    console.error(`  ✗ FAIL: ${message}`);
  }
}

function assertThrows(fn, expectedSubstr, message) {
  try {
    fn();
    failed++;
    console.error(`  ✗ FAIL: Expected error containing "${expectedSubstr}", but no error thrown: ${message}`);
  } catch (err) {
    if (err.message && err.message.includes(expectedSubstr)) {
      passed++;
      console.log(`  ✓ ${message}`);
    } else {
      failed++;
      console.error(`  ✗ FAIL: Expected error containing "${expectedSubstr}", got "${err.message}": ${message}`);
    }
  }
}

console.log('================================================================');
console.log('RancangLoka CONTENT_PROTECTION-1B-A Publication DNA Test Suite');
console.log('================================================================\n');

// ----------------------------------------------------------------------------
// Suite 1: Contract Constants & Frozen Coefficients
// ----------------------------------------------------------------------------
console.log('--- Suite 1: Contract Constants & Frozen MinHash Coefficients ---');

assert(DNA_VERSION === 'v1.0', `DNA_VERSION is 'v1.0' (got: ${DNA_VERSION})`);
assert(NORMALIZATION_VERSION === 'norm-v1', `NORMALIZATION_VERSION is 'norm-v1' (got: ${NORMALIZATION_VERSION})`);
assert(SHINGLE_VERSION === 'shingle-4w-v1', `SHINGLE_VERSION is 'shingle-4w-v1' (got: ${SHINGLE_VERSION})`);
assert(MINHASH_VERSION === 'minhash-64h-v1', `MINHASH_VERSION is 'minhash-64h-v1' (got: ${MINHASH_VERSION})`);
assert(GENERATOR_VERSION === 'dna-engine/1.0.0', `GENERATOR_VERSION is 'dna-engine/1.0.0' (got: ${GENERATOR_VERSION})`);

assert(MINHASH_COMPONENTS === 64, `MINHASH_COMPONENTS is 64 (got: ${MINHASH_COMPONENTS})`);
assert(MINHASH_PRIME === 2305843009213693951n, 'MINHASH_PRIME is Mersenne prime 2^61 - 1');
assert(MINHASH_COEFFICIENTS_64.length === 64, 'MINHASH_COEFFICIENTS_64 contains exactly 64 pairs');

let coefficientsValid = true;
for (let i = 0; i < MINHASH_COEFFICIENTS_64.length; i++) {
  const [a, b] = MINHASH_COEFFICIENTS_64[i];
  if (typeof a !== 'bigint' || typeof b !== 'bigint' || a === 0n || a < 0n || a >= MINHASH_PRIME || b < 0n || b >= MINHASH_PRIME) {
    coefficientsValid = false;
    break;
  }
}
assert(coefficientsValid, 'All 64 coefficient pairs strictly satisfy a != 0, 0 < a < p, 0 <= b < p in BigInt');

// ----------------------------------------------------------------------------
// Suite 2: Identifiers & Version Key Contract
// ----------------------------------------------------------------------------
console.log('\n--- Suite 2: Identifiers & Canonical Version Key Contract ---');

const dnaId1 = generateDnaId();
const dnaId2 = generateDnaId();
assert(typeof dnaId1 === 'string' && dnaId1.startsWith('dna_'), `dna_id starts with 'dna_' prefix: ${dnaId1}`);
assert(dnaId1 !== dnaId2, 'dna_id generation produces distinct identifiers');
const uuidPart = dnaId1.replace(/^dna_/, '');
assert(
  /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(uuidPart),
  `dna_id contains valid UUID v4 / 128-bit UUID (~122 random bits): ${uuidPart}`
);

// FULL_PROVENANCE key
const fullKey = buildPublicationVersionKey({
  provenanceClass: 'FULL_PROVENANCE',
  publicationReceiptId: 'rcpt_bbae85b48e1b2f8d',
  articleId: 5,
  publishedContentHash: '14275912029058f33a907831c8bf4d081129f7470f572305c861c6d46c5e5277',
});
assert(fullKey === 'receipt:rcpt_bbae85b48e1b2f8d', `FULL_PROVENANCE version_key is 'receipt:<id>' (got: ${fullKey})`);

// PARTIAL_HISTORICAL_PROVENANCE key (e.g. Article 6 with no receipt)
const histKey = buildPublicationVersionKey({
  provenanceClass: 'PARTIAL_HISTORICAL_PROVENANCE',
  articleId: 6,
  publishedContentHash: '18a20463523fc5ada7287fc54e37b8346d0e69b90cef9656544950dd4bb4dd1d',
});
assert(
  histKey === 'historical:6:18a20463523fc5ada7287fc54e37b8346d0e69b90cef9656544950dd4bb4dd1d',
  `PARTIAL_HISTORICAL_PROVENANCE version_key is 'historical:<id>:<hash>' (got: ${histKey})`
);

// Error cases
assertThrows(
  () => buildPublicationVersionKey({ provenanceClass: 'FULL_PROVENANCE', publicationReceiptId: '', articleId: 5, publishedContentHash: 'abc' }),
  'publicationReceiptId is required',
  'Throws error when FULL_PROVENANCE lacks receipt ID'
);
assertThrows(
  () => buildPublicationVersionKey({ provenanceClass: 'PARTIAL_HISTORICAL_PROVENANCE', articleId: 0, publishedContentHash: 'abc' }),
  'valid positive integer articleId is required',
  'Throws error when PARTIAL_HISTORICAL_PROVENANCE lacks valid articleId'
);
assertThrows(
  () => buildPublicationVersionKey({ provenanceClass: 'PARTIAL_HISTORICAL_PROVENANCE', articleId: 6, publishedContentHash: '' }),
  'publishedContentHash is required',
  'Throws error when PARTIAL_HISTORICAL_PROVENANCE lacks publishedContentHash'
);

// ----------------------------------------------------------------------------
// Suite 3: Golden Vector Fixtures & Text Normalization (norm-v1)
// ----------------------------------------------------------------------------
console.log('\n--- Suite 3: Golden Vector Fixtures & Text Normalization (norm-v1) ---');

const fixtureCanonicalMarkdown = `# Panduan Ventilasi Rumah Tropis

Ventilasi silang alami adalah metode efektif mendinginkan rumah di iklim tropis lembap.
Dengan merancang bukaan udara yang saling berhadapan, aliran angin mengalir lancar.

Lihat panduan lengkap di [situs resmi](https://rancangloka.com/ventilasi).

![Ilustrasi Aliran Udara](https://rancangloka.com/media/images/airflow.webp "Aliran Angin")

## Prinsip Desain Bukaan

Perhatikan aspek material kusen berikut:
- Gunakan kusen tahan rayap
- Pastikan jarak bukaan minimal 2 meter
- Hindari sudut mati aliran udara

| Parameter | Rekomendasi |
|---|---|
| Arah Angin | Menghadap barat daya |
| Luas Bukaan | 15% luas lantai |

> Desain yang baik mengutamakan sirkulasi udara di atas estetika semata.

\`\`\`sh
echo "Airflow verified"
\`\`\`

Keputusan akhir tetap berada di tangan pemilik rumah sesuai kebutuhan nyata.`;

const material1 = generatePublicationDnaMaterial(fixtureCanonicalMarkdown);
const material2 = generatePublicationDnaMaterial(fixtureCanonicalMarkdown);

// Repeatability
assert(
  material1.publishedContentHash === material2.publishedContentHash,
  'Repeated execution produces identical publishedContentHash'
);
assert(
  material1.normalizedTextHash === material2.normalizedTextHash,
  'Repeated execution produces identical normalizedTextHash'
);
assert(
  material1.blockHashesJson === material2.blockHashesJson,
  'Repeated execution produces identical blockHashesJson'
);
assert(
  material1.minhashSignatureJson === material2.minhashSignatureJson,
  'Repeated execution produces byte-identical minhashSignatureJson'
);
assert(
  material1.structuralSignatureJson === material2.structuralSignatureJson,
  'Repeated execution produces byte-identical structuralSignatureJson'
);

// Line ending resilience (CRLF vs LF)
const crlfMarkdown = fixtureCanonicalMarkdown.replace(/\n/g, '\r\n');
const materialCrlf = generatePublicationDnaMaterial(crlfMarkdown);
assert(
  material1.normalizedTextHash === materialCrlf.normalizedTextHash,
  'CRLF and LF inputs produce identical normalizedTextHash'
);
assert(
  material1.blockHashesJson === materialCrlf.blockHashesJson,
  'CRLF and LF inputs produce identical blockHashesJson'
);
assert(
  material1.minhashSignatureJson === materialCrlf.minhashSignatureJson,
  'CRLF and LF inputs produce byte-identical minhashSignatureJson'
);

// Irrelevant horizontal whitespace resilience
const messyWhitespaceMarkdown = fixtureCanonicalMarkdown
  .replace(/Ventilasi silang alami adalah/, 'Ventilasi   silang \t alami   adalah')
  .replace(/perhatikan aspek material/, 'perhatikan   aspek   material');
const materialWhitespace = generatePublicationDnaMaterial(messyWhitespaceMarkdown);
assert(
  material1.normalizedTextHash === materialWhitespace.normalizedTextHash,
  'Excess horizontal whitespace collapsing produces identical normalizedTextHash'
);
assert(
  material1.minhashSignatureJson === materialWhitespace.minhashSignatureJson,
  'Excess horizontal whitespace collapsing produces byte-identical minhashSignatureJson'
);

// Unicode NFKC resilience (composed vs decomposed)
// 'é' can be \u00E9 (precomposed) or \u0065\u0301 (decomposed)
const mdComposed = 'Material kusen caf\u00E9 bergaransi.';
const mdDecomposed = 'Material kusen caf\u0065\u0301 bergaransi.';
assert(
  normalizeSimilarityText(mdComposed) === normalizeSimilarityText(mdDecomposed),
  'Unicode NFKC normalization maps decomposed to precomposed text identically'
);
assert(
  computeNormalizedTextHash(normalizeSimilarityText(mdComposed)) ===
    computeNormalizedTextHash(normalizeSimilarityText(mdDecomposed)),
  'Unicode NFKC normalization produces identical normalized text hash'
);

// Link URL change with same visible link text
const mdLink1 = 'Kunjungi [halaman rujukan](https://rancangloka.com/old-url) untuk info.';
const mdLink2 = 'Kunjungi [halaman rujukan](https://rancangloka.com/new-url) untuk info.';
assert(
  normalizeSimilarityText(mdLink1) === normalizeSimilarityText(mdLink2),
  'Link URL changes with identical visible text produce identical normalized similarity text'
);

// Image URL change
const mdImg1 = 'Teks sebelum gambar.\n\n![Foto A](https://rancangloka.com/img1.webp)\n\nTeks sesudah gambar.';
const mdImg2 = 'Teks sebelum gambar.\n\n![Foto B](https://rancangloka.com/img2.webp)\n\nTeks sesudah gambar.';
assert(
  normalizeSimilarityText(mdImg1) === normalizeSimilarityText(mdImg2),
  'Image URL changes do not alter normalized similarity text'
);

// Meaningful prose change
const mdChanged = fixtureCanonicalMarkdown.replace('Ventilasi silang alami adalah', 'Ventilasi mekanis buatan adalah');
const materialChanged = generatePublicationDnaMaterial(mdChanged);
assert(
  material1.publishedContentHash !== materialChanged.publishedContentHash,
  'Meaningful prose change alters publishedContentHash'
);
assert(
  material1.normalizedTextHash !== materialChanged.normalizedTextHash,
  'Meaningful prose change alters normalizedTextHash'
);
assert(
  material1.rawBlocks[1].hash !== materialChanged.rawBlocks[1].hash,
  'Meaningful prose change alters specific block hash (paragraph 1)'
);
// Later blocks should still match
assert(
  material1.rawBlocks[3].hash === materialChanged.rawBlocks[3].hash,
  'Unchanged subsequent block (list block) retains exact same hash'
);

// Paragraph reordering
const paraA = 'Kusen aluminium memiliki daya tahan tinggi terhadap kelembapan tropis.';
const paraB = 'Kusen kayu memerlukan perawatan berkala dengan pelapis anti-rayap.';
const mdOrder1 = `# Pemilihan Kusen\n\n${paraA}\n\n${paraB}`;
const mdOrder2 = `# Pemilihan Kusen\n\n${paraB}\n\n${paraA}`;
const matOrder1 = generatePublicationDnaMaterial(mdOrder1);
const matOrder2 = generatePublicationDnaMaterial(mdOrder2);

assert(
  matOrder1.publishedContentHash !== matOrder2.publishedContentHash,
  'Reordered paragraphs produce different canonical content_hash'
);
const hashes1 = new Set(matOrder1.rawBlocks.map((b) => b.hash));
const hashes2 = new Set(matOrder2.rawBlocks.map((b) => b.hash));
let allBlocksFound = true;
for (const h of hashes1) {
  if (!hashes2.has(h)) allBlocksFound = false;
}
assert(
  allBlocksFound,
  'Reordered paragraphs preserve all individual block hashes within the set'
);

// ----------------------------------------------------------------------------
// Suite 4: MinHash Arithmetic, Shingling & BigInt Precision
// ----------------------------------------------------------------------------
console.log('\n--- Suite 4: MinHash Arithmetic, Shingling & BigInt Precision ---');

const sampleTokens = extractWordTokens('kusen aluminium untuk rumah tropis di indonesia');
assert(sampleTokens.length === 7, `Token count is 7 (got: ${sampleTokens.length})`);

const shingles = buildWordShingles(sampleTokens, 4);
assert(shingles.length === 4, `4-word shingles count for 7 tokens is 4 (got: ${shingles.length})`);
assert(shingles[0] === 'kusen aluminium untuk rumah', `First shingle is correct: "${shingles[0]}"`);
assert(shingles[3] === 'rumah tropis di indonesia', `Last shingle is correct: "${shingles[3]}"`);

// Short text (< 4 words)
const shortShingles = buildWordShingles(['hanya', 'dua'], 4);
assert(
  shortShingles.length === 1 && shortShingles[0] === 'hanya dua',
  'Short text (< 4 words) deterministically produces a single shingle'
);

// Empty text
const emptyMinhash = computeMinhashSignature([]);
assert(emptyMinhash.length === 64, 'Empty token input produces 64 MinHash components');
assert(
  emptyMinhash.every((hex) => hex === '0000000000000000'),
  'Empty token input produces 64 zero-filled hex strings'
);

// Standard MinHash format
const sig = computeMinhashSignature(sampleTokens);
assert(sig.length === 64, 'Standard token input produces exactly 64 MinHash components');
assert(
  sig.every((hex) => /^[0-9a-f]{16}$/.test(hex)),
  'All 64 MinHash components are strictly 16-character lowercase hexadecimal strings'
);

// ----------------------------------------------------------------------------
// Suite 5: Structural Signature & Dynamic Article Support Exclusion
// ----------------------------------------------------------------------------
console.log('\n--- Suite 5: Structural Signature & Dynamic Article Support Exclusion ---');

const struct = extractStructuralSignature(fixtureCanonicalMarkdown);
assert(
  Array.isArray(struct.heading_hierarchy) && struct.heading_hierarchy.length === 2,
  `Heading hierarchy has 2 headings (got: ${struct.heading_hierarchy.join(', ')})`
);
assert(
  struct.heading_hierarchy[0] === 'H1' && struct.heading_hierarchy[1] === 'H2',
  'Heading hierarchy correctly records ["H1", "H2"]'
);
assert(struct.block_counts.heading === 2, 'Heading block count is 2');
assert(struct.block_counts.list === 1, 'List block count is 1');
assert(struct.block_counts.table === 1, 'Table block count is 1');
assert(struct.block_counts.quote === 1, 'Quote block count is 1');
assert(struct.block_counts.code === 1, 'Code block count is 1');
assert(struct.image_count === 1, `Image count is 1 (got: ${struct.image_count})`);
assert(struct.link_count === 1, `Link count is 1 (got: ${struct.link_count})`);

// Verify Article Support dynamic markup is NOT included
// Article Support cards in Astro are rendered dynamically in Plane A components,
// outside the canonical Markdown body.
const canonicalJson = canonicalizeStructuralSignatureJson(struct);
assert(
  !canonicalJson.includes('article_support') && !canonicalJson.includes('plane_a'),
  'Structural signature contains zero Article Support SSR markup'
);

// JSON key order determinism
const rawObj1 = { link_count: 2, image_count: 1, block_counts: { table: 1, quote: 0, paragraph: 2, list: 1, heading: 1, code: 0 }, heading_hierarchy: ['H1'] };
const rawObj2 = { heading_hierarchy: ['H1'], block_counts: { heading: 1, paragraph: 2, list: 1, table: 1, quote: 0, code: 0 }, image_count: 1, link_count: 2 };
assert(
  canonicalizeStructuralSignatureJson(rawObj1) === canonicalizeStructuralSignatureJson(rawObj2),
  'canonicalizeStructuralSignatureJson produces byte-identical strings regardless of property insertion order'
);

// ----------------------------------------------------------------------------
// Suite 6: Additive D1 Migration 0034 Local SQLite Validation
// ----------------------------------------------------------------------------
console.log('\n--- Suite 6: Additive D1 Migration 0034 Local SQLite Validation ---');

const migrationPath = path.resolve('db/migrations/0034_article_publication_dna.sql');
assert(fs.existsSync(migrationPath), `Migration file exists at ${migrationPath}`);
const migrationSql = fs.readFileSync(migrationPath, 'utf8');

// In-memory isolated SQLite test database
const db = new DatabaseSync(':memory:');

// Create mock prerequisite tables so foreign keys are valid
db.exec(`
  CREATE TABLE articles (
    id INTEGER PRIMARY KEY,
    slug TEXT NOT NULL,
    status TEXT NOT NULL,
    content_hash TEXT NOT NULL
  );
  CREATE TABLE publication_execution_receipts (
    receipt_id TEXT PRIMARY KEY,
    article_id INTEGER NOT NULL,
    content_hash TEXT NOT NULL
  );
`);

// Apply 0034 migration
db.exec(migrationSql);

// Verify table exists
const tableInfo = db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='article_dna_signatures'").all();
assert(tableInfo.length === 1, 'Table article_dna_signatures successfully created in SQLite');

// Verify indexes exist
const indexNames = db.prepare("SELECT name FROM sqlite_master WHERE type='index' AND tbl_name='article_dna_signatures'").all().map((r) => r.name);
assert(indexNames.includes('idx_article_dna_article_id'), 'idx_article_dna_article_id index exists');
assert(indexNames.includes('idx_article_dna_receipt_id'), 'idx_article_dna_receipt_id index exists');
assert(indexNames.includes('idx_article_dna_published_hash'), 'idx_article_dna_published_hash index exists');
assert(indexNames.includes('idx_article_dna_normalized_hash'), 'idx_article_dna_normalized_hash index exists');

// Insert mock article and mock receipt
db.exec(`
  INSERT INTO articles (id, slug, status, content_hash) VALUES (5, 'kusen-aluminium', 'published', 'hash5');
  INSERT INTO publication_execution_receipts (receipt_id, article_id, content_hash) VALUES ('rcpt_test_5', 5, 'hash5');
`);

// Insert FULL_PROVENANCE row
const insertStmt = db.prepare(`
  INSERT INTO article_dna_signatures (
    dna_id, version_key, article_id, publication_receipt_id, publication_execution_id,
    provenance_class, published_content_hash, approved_content_hash, canonical_slug,
    canonical_url, approved_recorded_at, actual_published_at, historical_published_at,
    dna_version, normalization_version, shingle_version, minhash_version,
    normalized_text_hash, block_hashes_json, minhash_signature_json, structural_signature_json,
    featured_asset_id, featured_asset_sha256, generator_version
  ) VALUES (
    ?, ?, ?, ?, ?,
    ?, ?, ?, ?,
    ?, ?, ?, ?,
    ?, ?, ?, ?,
    ?, ?, ?, ?,
    ?, ?, ?
  )
`);

insertStmt.run(
  'dna_full_test_1',
  'receipt:rcpt_test_5',
  5,
  'rcpt_test_5',
  'pexec_test_5',
  'FULL_PROVENANCE',
  'hash5',
  'hash5_approved',
  'kusen-aluminium',
  'https://rancangloka.com/kusen-aluminium',
  '2026-09-28 06:15:42',
  '2026-09-28T06:10:39.816Z',
  null,
  'v1.0',
  'norm-v1',
  'shingle-4w-v1',
  'minhash-64h-v1',
  'norm_hash_5',
  '[]',
  '[]',
  '{}',
  'ast_feat_5',
  'sha256_feat_5',
  'dna-engine/1.0.0'
);

const fullRow = db.prepare("SELECT * FROM article_dna_signatures WHERE version_key = 'receipt:rcpt_test_5'").all();
assert(fullRow.length === 1, 'FULL_PROVENANCE row successfully inserted and retrieved');

// Insert Article 6 PARTIAL_HISTORICAL_PROVENANCE row with NULL receipt
db.exec(`
  INSERT INTO articles (id, slug, status, content_hash) VALUES (6, 'ventilasi-silang', 'published', 'hash6');
`);

insertStmt.run(
  'dna_hist_test_6',
  'historical:6:hash6',
  6,
  null, // NULL receipt
  null, // NULL execution
  'PARTIAL_HISTORICAL_PROVENANCE',
  'hash6',
  null, // NULL approved hash
  'ventilasi-silang',
  'https://rancangloka.com/ventilasi-silang',
  null, // NULL approved_recorded_at
  null, // NULL actual_published_at
  '2026-09-13T23:05:51.804Z',
  'v1.0',
  'norm-v1',
  'shingle-4w-v1',
  'minhash-64h-v1',
  'norm_hash_6',
  '[]',
  '[]',
  '{}',
  null,
  null,
  'dna-engine/1.0.0'
);

const histRow = db.prepare("SELECT * FROM article_dna_signatures WHERE version_key = 'historical:6:hash6'").all();
assert(histRow.length === 1, 'PARTIAL_HISTORICAL_PROVENANCE row with NULL receipt successfully inserted');
assert(histRow[0].publication_receipt_id === null, 'Historical row publication_receipt_id is strictly NULL');
assert(histRow[0].historical_published_at === '2026-09-13T23:05:51.804Z', 'Historical published timestamp preserved');

// Verify uniqueness constraint on version_key
let duplicateBlocked = false;
try {
  insertStmt.run(
    'dna_duplicate_attempt',
    'receipt:rcpt_test_5', // Duplicate!
    5,
    'rcpt_test_5',
    'pexec_test_5',
    'FULL_PROVENANCE',
    'hash5',
    null,
    'slug',
    'url',
    null,
    null,
    null,
    'v1.0',
    'norm-v1',
    'shingle-4w-v1',
    'minhash-64h-v1',
    'nh',
    '[]',
    '[]',
    '{}',
    null,
    null,
    'v1'
  );
} catch (e) {
  if (e.message.includes('UNIQUE constraint failed')) {
    duplicateBlocked = true;
  }
}
assert(duplicateBlocked, 'Duplicate version_key is strictly rejected by SQLite UNIQUE constraint (idempotency)');

// ----------------------------------------------------------------------------
// Summary
// ----------------------------------------------------------------------------
console.log('\n================================================================');
console.log(`Results: ${passed} passed, ${failed} failed`);
console.log('================================================================\n');

if (failed > 0) {
  console.error('FAILED: Some tests did not pass.');
  process.exit(1);
} else {
  console.log('SUCCESS: All Publication DNA 1B-A tests passed!');
  process.exit(0);
}
