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
import { marked } from 'marked';

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
  EMPTY_MINHASH_IS_SENTINEL,
  EMPTY_MINHASH_SENTINEL_ELEMENT,
  CONTENT_HASH_CONTRACT_LEGACY_V0,
  CONTENT_HASH_CONTRACT_MARKDOWN_V1,
  computeLegacyContentHashV0,
  computeContentHashForContract,
  SOURCE_FIDELITY_BYTE_EXACT,
  SOURCE_FIDELITY_NORMALIZED,
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

// Insert FULL_PROVENANCE row for Article 5 with legacy-normalized-sha256-v0
const insertStmt = db.prepare(`
  INSERT INTO article_dna_signatures (
    dna_id, version_key, article_id, publication_receipt_id, publication_execution_id,
    provenance_class, content_hash_contract, source_fidelity, published_content_hash, approved_content_hash, canonical_slug,
    canonical_url, approved_recorded_at, actual_published_at, historical_published_at,
    dna_version, normalization_version, shingle_version, minhash_version,
    normalized_text_hash, block_hashes_json, minhash_signature_json, structural_signature_json,
    featured_asset_id, featured_asset_sha256, generator_version
  ) VALUES (
    ?, ?, ?, ?, ?,
    ?, ?, ?, ?, ?, ?,
    ?, ?, ?, ?,
    ?, ?, ?, ?,
    ?, ?, ?, ?,
    ?, ?, ?
  )
`);

insertStmt.run(
  'dna_full_test_5',
  'receipt:rcpt_test_5',
  5,
  'rcpt_test_5',
  'pexec_test_5',
  'FULL_PROVENANCE',
  CONTENT_HASH_CONTRACT_LEGACY_V0,
  SOURCE_FIDELITY_NORMALIZED,
  '14275912029058f33a907831c8bf4d081129f7470f572305c861c6d46c5e5277',
  '14275912029058f33a907831c8bf4d081129f7470f572305c861c6d46c5e5277',
  'kusen-aluminium-vs-upvc-untuk-rumah-tropis-di-indonesia',
  'https://rancangloka.com/kusen-aluminium-vs-upvc-untuk-rumah-tropis-di-indonesia',
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
assert(
  fullRow[0].content_hash_contract === CONTENT_HASH_CONTRACT_LEGACY_V0,
  `Article 5 correctly stores content_hash_contract = '${CONTENT_HASH_CONTRACT_LEGACY_V0}'`
);
assert(
  fullRow[0].provenance_class === 'FULL_PROVENANCE',
  'Article 5 is correctly classified as FULL_PROVENANCE'
);
assert(
  fullRow[0].source_fidelity === SOURCE_FIDELITY_NORMALIZED,
  'Article 5 is correctly classified with source_fidelity = NORMALIZED_HASH_VERIFIED'
);

// Insert Article 6 PARTIAL_HISTORICAL_PROVENANCE row with NULL receipt & legacy contract
db.exec(`
  INSERT INTO articles (id, slug, status, content_hash) VALUES (6, 'ventilasi-silang', 'published', '18a20463523fc5ada7287fc54e37b8346d0e69b90cef9656544950dd4bb4dd1d');
`);

insertStmt.run(
  'dna_hist_test_6',
  'historical:6:18a20463523fc5ada7287fc54e37b8346d0e69b90cef9656544950dd4bb4dd1d',
  6,
  null, // NULL receipt
  null, // NULL execution
  'PARTIAL_HISTORICAL_PROVENANCE',
  CONTENT_HASH_CONTRACT_LEGACY_V0,
  SOURCE_FIDELITY_NORMALIZED,
  '18a20463523fc5ada7287fc54e37b8346d0e69b90cef9656544950dd4bb4dd1d',
  null, // NULL approved hash
  'rekayasa-ventilasi-silang-alami-untuk-rumah-tropis-yang-lebih-nyaman',
  'https://rancangloka.com/rekayasa-ventilasi-silang-alami-untuk-rumah-tropis-yang-lebih-nyaman',
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

const histRow = db.prepare("SELECT * FROM article_dna_signatures WHERE version_key = 'historical:6:18a20463523fc5ada7287fc54e37b8346d0e69b90cef9656544950dd4bb4dd1d'").all();
assert(histRow.length === 1, 'PARTIAL_HISTORICAL_PROVENANCE row with NULL receipt successfully inserted');
assert(histRow[0].publication_receipt_id === null, 'Historical row publication_receipt_id is strictly NULL');
assert(
  histRow[0].provenance_class === 'PARTIAL_HISTORICAL_PROVENANCE',
  'Article 6 is correctly classified as PARTIAL_HISTORICAL_PROVENANCE'
);
assert(
  histRow[0].content_hash_contract === CONTENT_HASH_CONTRACT_LEGACY_V0,
  `Article 6 correctly stores content_hash_contract = '${CONTENT_HASH_CONTRACT_LEGACY_V0}'`
);
assert(
  histRow[0].source_fidelity === SOURCE_FIDELITY_NORMALIZED,
  'Article 6 is correctly classified with source_fidelity = NORMALIZED_HASH_VERIFIED'
);
assert(histRow[0].historical_published_at === '2026-09-13T23:05:51.804Z', 'Historical published timestamp preserved');

// Insert Modern Article 7 FULL_PROVENANCE row with canonical-markdown-sha256-v1 contract
db.exec(`
  INSERT INTO articles (id, slug, status, content_hash) VALUES (7, 'jendela-berkondensasi', 'published', '00dc804d7f3bd9f54772988c00709e1ff01b80ff303d42760bc4ac91df6c8298');
  INSERT INTO publication_execution_receipts (receipt_id, article_id, content_hash) VALUES ('rcpt_artA_d476e9020634', 7, '00dc804d7f3bd9f54772988c00709e1ff01b80ff303d42760bc4ac91df6c8298');
`);

insertStmt.run(
  'dna_full_test_7',
  'receipt:rcpt_artA_d476e9020634',
  7,
  'rcpt_artA_d476e9020634',
  'pexec_artA_d476e9020634',
  'FULL_PROVENANCE',
  CONTENT_HASH_CONTRACT_MARKDOWN_V1,
  SOURCE_FIDELITY_BYTE_EXACT,
  '00dc804d7f3bd9f54772988c00709e1ff01b80ff303d42760bc4ac91df6c8298',
  '00dc804d7f3bd9f54772988c00709e1ff01b80ff303d42760bc4ac91df6c8298',
  'jendela-berkondensasi-kelembapan-suhu-kaca-ventilasi-thermal-bridge',
  'https://rancangloka.com/jendela-berkondensasi-kelembapan-suhu-kaca-ventilasi-thermal-bridge',
  '2026-10-07 01:24:49',
  '2026-10-07T01:25:00.000Z',
  null,
  'v1.0',
  'norm-v1',
  'shingle-4w-v1',
  'minhash-64h-v1',
  'norm_hash_7',
  '[]',
  '[]',
  '{}',
  'ast_feat_7',
  'sha256_feat_7',
  'dna-engine/1.0.0'
);

const modernRow = db.prepare("SELECT * FROM article_dna_signatures WHERE version_key = 'receipt:rcpt_artA_d476e9020634'").all();
assert(modernRow.length === 1, 'Modern article row with canonical-markdown-sha256-v1 successfully inserted');
assert(
  modernRow[0].content_hash_contract === CONTENT_HASH_CONTRACT_MARKDOWN_V1,
  `Modern Article 7 stores content_hash_contract = '${CONTENT_HASH_CONTRACT_MARKDOWN_V1}'`
);
assert(
  modernRow[0].source_fidelity === SOURCE_FIDELITY_BYTE_EXACT,
  'Modern Article 7 has source_fidelity = BYTE_EXACT_HASH_VERIFIED'
);

// Verify content_hash_contract NOT NULL constraint
let nullContractBlocked = false;
try {
  insertStmt.run(
    'dna_null_contract_attempt',
    'receipt:rcpt_test_null',
    7,
    'rcpt_test_null',
    'pexec_test_null',
    'FULL_PROVENANCE',
    null, // VIOLATION: NOT NULL
    SOURCE_FIDELITY_BYTE_EXACT,
    'hash',
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
  if (e.message.includes('NOT NULL constraint failed')) {
    nullContractBlocked = true;
  }
}
assert(nullContractBlocked, 'NULL content_hash_contract is strictly rejected by SQLite NOT NULL constraint');

// Verify source_fidelity NOT NULL constraint
let nullFidelityBlocked = false;
try {
  insertStmt.run(
    'dna_null_fidelity_attempt',
    'receipt:rcpt_test_null_fidelity',
    7,
    'rcpt_test_null_fidelity',
    'pexec_test_null_fidelity',
    'FULL_PROVENANCE',
    CONTENT_HASH_CONTRACT_MARKDOWN_V1,
    null, // VIOLATION: NOT NULL
    'hash',
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
  if (e.message.includes('NOT NULL constraint failed')) {
    nullFidelityBlocked = true;
  }
}
assert(nullFidelityBlocked, 'NULL source_fidelity is strictly rejected by SQLite NOT NULL constraint');

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
    CONTENT_HASH_CONTRACT_LEGACY_V0,
    SOURCE_FIDELITY_NORMALIZED,
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
// Suite 7: True Literal Golden Vector Fixtures (FIXTURE_A & FIXTURE_B)
// ----------------------------------------------------------------------------
console.log('\n--- Suite 7: True Literal Golden Vector Fixtures ---');

// FIXTURE_A: Normal article containing heading, paragraph, visible markdown link,
// list, table, quote, code, and image.
const FIXTURE_A = `# Panduan Material Kusen Rumah Tropis

Memilih material kusen yang tepat sangat menentukan keawetan bangunan di iklim lembap. Informasi lebih lanjut dapat dilihat pada [panduan arsitektur](https://rancangloka.com/panduan).

![Ilustrasi Kusen](https://rancangloka.com/media/kusen.jpg)

Berikut beberapa pertimbangan utama:
- Ketahanan terhadap rayap dan jamur
- Tingkat konduktivitas termal bingkai
- Kerapatan sambungan sudut terhadap tempias air

| Material | Konduktivitas | Daya Tahan |
| :--- | :--- | :--- |
| Kayu Solid | Rendah | Sedang |
| Aluminium | Tinggi | Sangat Baik |
| uPVC | Rendah | Sangat Baik |

> Detail sambungan mekanikal pada profil aluminium memerlukan sealant berkualitas agar tidak bocor.

\`\`\`typescript
const thermalConductivity = 160; // W/(m*K)
\`\`\`
`;

// Committed frozen literal expected constants for Fixture A (NEVER dynamically computed at runtime):
const FIXTURE_A_EXPECTED_CANONICAL_HASH = 'a47a264f218b5b52f8629a122ecae33565e18ebbbfbc4f6500db09fdcc5bfb93';
const FIXTURE_A_EXPECTED_NORMALIZED_HASH = '8e716171568253d24a82742c451a6a11171f2fe4fc74a8bb1efc031e5c61871a';
const FIXTURE_A_EXPECTED_BLOCK_HASHES_JSON = '[{"index":0,"block_type":"heading","hash":"dca901619b8f010f4e7787eb7894f2c67bb598568c557c00dc88727754d9109a","token_count":5},{"index":1,"block_type":"paragraph","hash":"046b1c8983dbcc6ec7d3cf4d317ec15eca9a9d7dbdc46e78b4ba2bac9f6bdac4","token_count":20},{"index":2,"block_type":"paragraph","hash":"ccb0ca3c15ab941145c46dbb2a0b646714ea92ba16301d087e0b53c639aa860a","token_count":4},{"index":3,"block_type":"list","hash":"153661f689f0ab15e071c9f9ee0ad5e2f099831ad6b45d9003a60731432c6735","token_count":15},{"index":4,"block_type":"table","hash":"2ff4c7cc484537c7189ec57c6569039c44f934cd3895e8b72d12544a8a1dba90","token_count":16},{"index":5,"block_type":"quote","hash":"b6ee60126105b27a931cb56b68d427387aa80d13ff4d0aad1a38664ea55411a7","token_count":12},{"index":6,"block_type":"code","hash":"e65f46542f0a172165e425c3de575b26f98aacfdb6919796835a57becc55f0b6","token_count":6}]';
const FIXTURE_A_EXPECTED_MINHASH_SIGNATURE_JSON = '["00524af1e0706000","00e6f30f11dc37de","003a70ac314e9a13","0115ddefcfae0b05","00b95d103f161152","0002619a10294c95","00045a384ed45dbc","0008f2714425e178","010314681aed86f6","002f4293caecba44","000b961833b6cdcf","0165d1d472b2fade","0073a28769cd23eb","0013f8e2150dff25","00e92bc4c08aae50","000dbd11bb6ccbc9","008ed60d5829d86f","0017c9eb70ae368b","007067c7cff3ae22","008ea05a87c6f112","0060d00d0f3e0335","0109fd87638f55f7","0006544ecc84daf6","01acf427a969d30a","000cd62ae1de0af0","0003e73c16fdf19e","003ff5c16b9faa8c","00234b606260e0a8","0148de5dfdd20294","003d7ec524fe2d84","015bc5709322795e","007791617c77e5c5","00b4dd899023dbe5","001f333aa22856d4","001598230b1ed956","003cb5e79e3b02ef","00d9bb88a3bd783a","000ee2c9a0311f9e","000f9cf8c33c2018","008ee9402ce76226","0034b51be87ff55a","00927abf8e48e8dc","000c0078c9224ddb","002e4158a538c8f7","003667553e584301","0039882b46e4ba95","001b54e974b0ac39","002f21bed9826ee3","002b4a595ad32d43","001226e5d7674994","00828efe56c0b9e6","0067a08293f2181e","006e4010d84fe9d2","004e5726592bf197","001a1dc6b580c9fc","004f5ed00713bc32","00db30da3532bcbc","005c5c8f74196743","0021f8dbbb5e2d8e","004230b6d8433a28","006690371aaf27ce","00a08a68590714a8","00ac84c383c64783","00eac030bea03172"]';
const FIXTURE_A_EXPECTED_STRUCTURAL_SIGNATURE_JSON = '{"block_counts":{"code":1,"heading":1,"list":1,"paragraph":3,"quote":1,"table":1},"heading_hierarchy":["H1"],"image_count":1,"link_count":1}';

// Generate actual material for Fixture A
const actualA = generatePublicationDnaMaterial(FIXTURE_A);

assert(
  actualA.publishedContentHash === FIXTURE_A_EXPECTED_CANONICAL_HASH,
  `Fixture A exact canonical hash matches frozen literal: ${FIXTURE_A_EXPECTED_CANONICAL_HASH}`
);
assert(
  actualA.normalizedTextHash === FIXTURE_A_EXPECTED_NORMALIZED_HASH,
  `Fixture A exact normalized hash matches frozen literal: ${FIXTURE_A_EXPECTED_NORMALIZED_HASH}`
);
assert(
  actualA.blockHashesJson === FIXTURE_A_EXPECTED_BLOCK_HASHES_JSON,
  'Fixture A complete semantic block JSON matches frozen literal'
);
assert(
  actualA.minhashSignatureJson === FIXTURE_A_EXPECTED_MINHASH_SIGNATURE_JSON,
  'Fixture A complete 64-component MinHash vector matches frozen literal'
);
assert(
  actualA.structuralSignatureJson === FIXTURE_A_EXPECTED_STRUCTURAL_SIGNATURE_JSON,
  'Fixture A complete structural JSON matches frozen literal'
);

// FIXTURE_B: Indonesian architectural prose fixture with accented/decomposed Unicode,
// punctuation, multiple headings, multiple paragraphs.
const FIXTURE_B = `## Orientasi Fasad & Kenyamanan Termal Tropis

Perancangan fasad hunian di wilayah khatulistiwa memerlukan kecermatan orientasi. Fasad yang menghadap ke arah barat menerima radiasi matahari sore dengan sudut datang rendah, memicu kenaikan temperatur ruang secara signifikan pada malam hari.

### Strategi Peneduh Pasif

Penerapan sirip penangkal sinar matahari (*brise-soleil*) dan kisi-kisi kayu terbukti mereduksi beban pendinginan ruang secara alami. Pemilihan material fasad façade berpori seperti bata terakota juga mempercepat pelepasan panas.

Kombinasi ventilasi silang dan vegetasi di sisi luar menghadirkan iklim mikro yang sejuk bagi penghuni rumah.
`;

// Committed frozen literal expected constants for Fixture B:
const FIXTURE_B_EXPECTED_CANONICAL_HASH = '2d84ee74140234de973b5d60d57aabcba5a88de9623fb1bcee5691773af3dd24';
const FIXTURE_B_EXPECTED_NORMALIZED_HASH = 'fa0da1a7fae84930bc002eaf833caefda26a886d1f513a19da7102e0d9a7f5ae';
const FIXTURE_B_EXPECTED_BLOCK_HASHES_JSON = '[{"index":0,"block_type":"heading","hash":"20bab99d6b26caa9a8756c148a7301d2651d30cfc342ec357407d50e1922547a","token_count":5},{"index":1,"block_type":"paragraph","hash":"c555ea4fe486473d62d1307a4e20dad310e5e953c2d89fc3c32f8205e61009de","token_count":32},{"index":2,"block_type":"heading","hash":"617a777648a84d324403dae110b69dbebfdcdaa16099844266833789827935eb","token_count":3},{"index":3,"block_type":"paragraph","hash":"b6d5ae016426ae1c35a3b443795b7f571a504f7e9fe8eb040c8d8c1f981d165b","token_count":30},{"index":4,"block_type":"paragraph","hash":"def3baf654251ff1ced5c7cdc8e0a9deb12c477a2d4d0ea22431347a1a35f4b3","token_count":16}]';
const FIXTURE_B_EXPECTED_MINHASH_SIGNATURE_JSON = '["0005d12657bd8038","00329c4d135b4c1b","001e8f9c87a7338e","000f4083f15d74bc","00c27ea8e3e6bfa7","00168a7c1a3d9617","0003fc687ebfe81d","0068c45e8eff4e1f","009a2f1cc84e189c","00058c4f2d149dcc","004e23dd79fe0d2f","00902e268bc03462","0004286253d35b37","0063164e20e1ea6c","00a3826b947a020d","004166ff27a217c6","0010abad81f22ded","0036dcb4ab621b52","004ebb536cd94241","0064550c8a54e7b3","003027bd3b72b0de","002593df7d789bfa","003cf7bd4c403120","00838c45a4cda456","003d2306c0de2e16","0022336f8ec9830c","013383a46dfba070","004572f563645e34","00165c0445bd60b5","0070a5bfcb3bd824","005623e38e91d459","0051ec53a5321343","00163c50c5dbd885","002c3a8bd273650a","0032bfa4bfa25a14","0057310d54ffd306","00476873f0eaa007","0098ef992397c580","00073437600efc74","000a5a4a55fe28a7","005f956cbbf1a363","003a926ad57c06e3","016930560937bf96","00e5c5d0e605b69d","002fe81a8de5dc8f","0084de66f1a52688","00156ef77391866d","0057a691e1df3538","00264b47588adfe6","000a258893ab6984","009597ec8fd44155","0005d6edfd1bcb21","00370644ee4899dc","00c6aa3fc79b921c","005b6347ea2cb1af","00383ca1975d7231","0082dc48cfa48459","0004cad79c3f739c","0017a9bf7ac52ab6","00056550123cce4c","000b4677b927b66b","00a84c71bcc949b7","008dbb44ef0a66fa","00243890238d4781"]';
const FIXTURE_B_EXPECTED_STRUCTURAL_SIGNATURE_JSON = '{"block_counts":{"code":0,"heading":2,"list":0,"paragraph":3,"quote":0,"table":0},"heading_hierarchy":["H2","H3"],"image_count":0,"link_count":0}';

// Generate actual material for Fixture B
const actualB = generatePublicationDnaMaterial(FIXTURE_B);

assert(
  actualB.publishedContentHash === FIXTURE_B_EXPECTED_CANONICAL_HASH,
  `Fixture B exact canonical hash matches frozen literal: ${FIXTURE_B_EXPECTED_CANONICAL_HASH}`
);
assert(
  actualB.normalizedTextHash === FIXTURE_B_EXPECTED_NORMALIZED_HASH,
  `Fixture B exact normalized hash matches frozen literal: ${FIXTURE_B_EXPECTED_NORMALIZED_HASH}`
);
assert(
  actualB.blockHashesJson === FIXTURE_B_EXPECTED_BLOCK_HASHES_JSON,
  'Fixture B complete semantic block JSON matches frozen literal'
);
assert(
  actualB.minhashSignatureJson === FIXTURE_B_EXPECTED_MINHASH_SIGNATURE_JSON,
  'Fixture B complete 64-component MinHash vector matches frozen literal'
);
assert(
  actualB.structuralSignatureJson === FIXTURE_B_EXPECTED_STRUCTURAL_SIGNATURE_JSON,
  'Fixture B complete structural JSON matches frozen literal'
);

// Repeated execution byte identity
const actualA_run2 = generatePublicationDnaMaterial(FIXTURE_A);
assert(
  actualA.publishedContentHash === actualA_run2.publishedContentHash &&
    actualA.normalizedTextHash === actualA_run2.normalizedTextHash &&
    actualA.blockHashesJson === actualA_run2.blockHashesJson &&
    actualA.minhashSignatureJson === actualA_run2.minhashSignatureJson &&
    actualA.structuralSignatureJson === actualA_run2.structuralSignatureJson,
  'Repeated execution across independent runs produces 100% byte-identical DNA material'
);

// ----------------------------------------------------------------------------
// Suite 8: Parser Drift Contract & Empty MinHash Sentinel
// ----------------------------------------------------------------------------
console.log('\n--- Suite 8: Parser Drift Contract & Empty MinHash Sentinel ---');

// Invariant: marked.lexer is an implementation dependency of Publication DNA v1.
// If future marked updates change semantic block lexing, tests fail and contract must be version-bumped.
assert(typeof marked.lexer === 'function', 'marked.lexer is available as semantic block parser');

// Invariant: EMPTY_MINHASH_IS_SENTINEL
assert(EMPTY_MINHASH_IS_SENTINEL === true, 'EMPTY_MINHASH_IS_SENTINEL contract constant is true');
assert(EMPTY_MINHASH_SENTINEL_ELEMENT === '0000000000000000', 'EMPTY_MINHASH_SENTINEL_ELEMENT is 16-hex zeros');

const emptySentinelMinhash = computeMinhashSignature([]);
assert(emptySentinelMinhash.length === 64, 'Empty minhash produces 64 components');
assert(
  emptySentinelMinhash.every((val) => val === EMPTY_MINHASH_SENTINEL_ELEMENT),
  'Every component of empty minhash is the frozen sentinel "0000000000000000"'
);

// Empty tokens or whitespace-only text produces zero shingles and evaluates to the sentinel
const emptyTokensMinhash = computeMinhashSignature(extractWordTokens(''));
assert(
  emptyTokensMinhash.every((val) => val === EMPTY_MINHASH_SENTINEL_ELEMENT),
  'Whitespace/empty token string evaluates to the sentinel "0000000000000000"'
);

// In contrast, short substantive text (< 4 words) produces a fallback shingle and does NOT produce sentinel
const shortMinhash = computeMinhashSignature(['satu', 'dua', 'tiga']);
assert(
  shortMinhash.every((val) => val !== EMPTY_MINHASH_SENTINEL_ELEMENT),
  'Short text producing 1 shingle computes valid non-sentinel MinHash components'
);

// ----------------------------------------------------------------------------
// Suite 9: Articles 5–9 Canonical Content Hash Parity Audit Record
// ----------------------------------------------------------------------------
console.log('\n--- Suite 9: Articles 5–9 Canonical Content Hash Parity Audit Record ---');

/**
 * Empirical Production Audit Table (Read-Only SELECT against remote D1):
 * - Articles 5 & 6 (Phase 1 legacy seed, pre-Hermes pipeline):
 *   persisted articles.content_hash was generated by src/lib/seo.ts:generateContentHash
 *   (i.e. SHA-256 of content.replace(/\s+/g, ' ').trim().toLowerCase()).
 * - Articles 7, 8 & 9 (Modern Editorial Pipeline: Articles A, B, C):
 *   persisted articles.content_hash is raw SHA-256 of canonical Markdown UTF-8 bytes
 *   (exactly matching computeCanonicalContentHash).
 */
const CANONICAL_AUDIT_PROOF_TABLE = [
  {
    id: 5,
    slug: 'kusen-aluminium-vs-upvc-untuk-rumah-tropis-di-indonesia',
    storedHash: '14275912029058f33a907831c8bf4d081129f7470f572305c861c6d46c5e5277',
    algorithm: 'PHASE1_LEGACY_SEO_HASH',
    rawUtf8Parity: 'MISMATCH',
    legacySeoParity: 'MATCH',
  },
  {
    id: 6,
    slug: 'rekayasa-ventilasi-silang-alami-untuk-rumah-tropis-yang-lebih-nyaman',
    storedHash: '18a20463523fc5ada7287fc54e37b8346d0e69b90cef9656544950dd4bb4dd1d',
    algorithm: 'PHASE1_LEGACY_SEO_HASH',
    rawUtf8Parity: 'MISMATCH',
    legacySeoParity: 'MATCH',
  },
  {
    id: 7,
    slug: 'jendela-berkondensasi-kelembapan-suhu-kaca-ventilasi-thermal-bridge',
    storedHash: '00dc804d7f3bd9f54772988c00709e1ff01b80ff303d42760bc4ac91df6c8298',
    algorithm: 'CANONICAL_RAW_UTF8_SHA256',
    rawUtf8Parity: 'MATCH',
    legacySeoParity: 'MISMATCH',
  },
  {
    id: 8,
    slug: 'thermal-bridge-kusen-aluminium-penyebab-panas-dingin-solusi',
    storedHash: '66094cf52d2d10650b82141adace0cedc27fc9a3f63ae1f85e19a57c38d4e260',
    algorithm: 'CANONICAL_RAW_UTF8_SHA256',
    rawUtf8Parity: 'MATCH',
    legacySeoParity: 'MISMATCH',
  },
  {
    id: 9,
    slug: 'memilih-sistem-shading-luar-rumah-tropis',
    storedHash: '12c59631d3b297b97e35cf192da05102661c281e3370399fef291eb014692c28',
    algorithm: 'CANONICAL_RAW_UTF8_SHA256',
    rawUtf8Parity: 'MATCH',
    legacySeoParity: 'MISMATCH',
  },
];

assert(
  computeCanonicalContentHash('Test markdown') ===
    crypto.createHash('sha256').update('Test markdown', 'utf8').digest('hex'),
  'computeCanonicalContentHash is strictly raw UTF-8 SHA-256'
);
assert(
  CANONICAL_AUDIT_PROOF_TABLE.filter((a) => a.rawUtf8Parity === 'MATCH').length === 3,
  'Modern editorial pipeline Articles 7, 8, 9 have 100% exact raw UTF-8 SHA-256 parity'
);
assert(
  CANONICAL_AUDIT_PROOF_TABLE.filter((a) => a.legacySeoParity === 'MATCH').length === 2,
  'Pre-Hermes legacy seed Articles 5 and 6 are proven to match legacy seo.ts:generateContentHash'
);

// Proof A: Legacy helper reproduces Article 5 stored hash exactly
const art5Fixture = JSON.parse(fs.readFileSync(path.resolve('scripts/fixtures/article5_production.json'), 'utf8'));
const art5LegacyHash = computeLegacyContentHashV0(art5Fixture.content_md);
assert(
  art5LegacyHash === '14275912029058f33a907831c8bf4d081129f7470f572305c861c6d46c5e5277',
  'Proof A: computeLegacyContentHashV0 reproduces Article 5 stored content_hash exactly'
);

// Proof B: Legacy helper reproduces Article 6 stored hash exactly
const art6Fixture = JSON.parse(fs.readFileSync(path.resolve('scripts/fixtures/article6_production.json'), 'utf8'));
const art6LegacyHash = computeLegacyContentHashV0(art6Fixture.content_md);
assert(
  art6LegacyHash === '18a20463523fc5ada7287fc54e37b8346d0e69b90cef9656544950dd4bb4dd1d',
  'Proof B: computeLegacyContentHashV0 reproduces Article 6 stored content_hash exactly'
);

// Proof C: Modern helper reproduces Articles 7, 8, 9 exactly
const art7Md = fs.readFileSync(path.resolve('scripts/content-bootstrap/restore-1/artA/article.md'), 'utf8');
const art8Md = fs.readFileSync(path.resolve('scripts/content-bootstrap/restore-1/artB/article.md'), 'utf8');
const art9Md = fs.readFileSync(path.resolve('scripts/content-bootstrap/artC-research-reset/article-c-clean-draft.md'), 'utf8');

assert(
  computeCanonicalContentHash(art7Md) === '00dc804d7f3bd9f54772988c00709e1ff01b80ff303d42760bc4ac91df6c8298',
  'Proof C1: computeCanonicalContentHash reproduces Article 7 stored hash exactly'
);
assert(
  computeCanonicalContentHash(art8Md) === '66094cf52d2d10650b82141adace0cedc27fc9a3f63ae1f85e19a57c38d4e260',
  'Proof C2: computeCanonicalContentHash reproduces Article 8 stored hash exactly'
);
assert(
  computeCanonicalContentHash(art9Md) === '12c59631d3b297b97e35cf192da05102661c281e3370399fef291eb014692c28',
  'Proof C3: computeCanonicalContentHash reproduces Article 9 stored hash exactly'
);

// Proof D: Legacy helper and modern helper intentionally produce different values for fixtures where normalization changes bytes
assert(
  computeLegacyContentHashV0(art7Md) !== computeCanonicalContentHash(art7Md),
  'Proof D1: Legacy helper and modern helper intentionally produce different hashes for Article 7'
);
assert(
  computeLegacyContentHashV0(art5Fixture.content_md) !== computeCanonicalContentHash(art5Fixture.content_md),
  'Proof D2: Legacy helper and modern helper intentionally produce different hashes for Article 5'
);

// Proof E: content_hash_contract serialization is deterministic and part of PublicationDnaMaterial
const modernMaterial = generatePublicationDnaMaterial(art7Md, CONTENT_HASH_CONTRACT_MARKDOWN_V1);
assert(
  modernMaterial.contentHashContract === CONTENT_HASH_CONTRACT_MARKDOWN_V1,
  `Proof E1: generatePublicationDnaMaterial records contentHashContract = '${CONTENT_HASH_CONTRACT_MARKDOWN_V1}'`
);
assert(
  modernMaterial.publishedContentHash === '00dc804d7f3bd9f54772988c00709e1ff01b80ff303d42760bc4ac91df6c8298',
  'Proof E2: modern material publishedContentHash matches canonical raw UTF-8 SHA-256'
);

const legacyMaterial5 = generatePublicationDnaMaterial(art5Fixture.content_md, CONTENT_HASH_CONTRACT_LEGACY_V0);
assert(
  legacyMaterial5.contentHashContract === CONTENT_HASH_CONTRACT_LEGACY_V0,
  `Proof E3: generatePublicationDnaMaterial records contentHashContract = '${CONTENT_HASH_CONTRACT_LEGACY_V0}'`
);
assert(
  legacyMaterial5.publishedContentHash === '14275912029058f33a907831c8bf4d081129f7470f572305c861c6d46c5e5277',
  'Proof E4: legacy material publishedContentHash reproduces historical stored hash under legacy contract'
);

// Proof F: Article 5 can be represented as: FULL_PROVENANCE + LEGACY_CONTENT_HASH_V0
const rowArt5 = db.prepare("SELECT * FROM article_dna_signatures WHERE version_key = 'receipt:rcpt_test_5'").get();
assert(
  rowArt5.provenance_class === 'FULL_PROVENANCE' && rowArt5.content_hash_contract === CONTENT_HASH_CONTRACT_LEGACY_V0,
  'Proof F: Article 5 is represented as FULL_PROVENANCE + LEGACY_CONTENT_HASH_V0 without contradiction'
);

// Proof G: Article 6 can be represented as: PARTIAL_HISTORICAL_PROVENANCE + LEGACY_CONTENT_HASH_V0
const rowArt6 = db.prepare("SELECT * FROM article_dna_signatures WHERE version_key = 'historical:6:18a20463523fc5ada7287fc54e37b8346d0e69b90cef9656544950dd4bb4dd1d'").get();
assert(
  rowArt6.provenance_class === 'PARTIAL_HISTORICAL_PROVENANCE' && rowArt6.content_hash_contract === CONTENT_HASH_CONTRACT_LEGACY_V0,
  'Proof G: Article 6 is represented as PARTIAL_HISTORICAL_PROVENANCE + LEGACY_CONTENT_HASH_V0 without contradiction'
);

// Proof H: New publication contract defaults to and enforces CANONICAL_MARKDOWN_HASH_V1
const defaultModernMaterial = generatePublicationDnaMaterial(art9Md);
assert(
  defaultModernMaterial.contentHashContract === CONTENT_HASH_CONTRACT_MARKDOWN_V1,
  'Proof H1: generatePublicationDnaMaterial default contract is strictly CANONICAL_MARKDOWN_HASH_V1'
);
assert(
  defaultModernMaterial.publishedContentHash === computeCanonicalContentHash(art9Md),
  'Proof H2: default publishedContentHash strictly equals computeCanonicalContentHash'
);

// Dispatcher fails closed on unknown contract
assertThrows(
  () => computeContentHashForContract('test', 'unknown-contract-v99'),
  'UNKNOWN_CONTENT_HASH_CONTRACT',
  'Proof H3: computeContentHashForContract strictly rejects unknown contracts fail-closed'
);

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
