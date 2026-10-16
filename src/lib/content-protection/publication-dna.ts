/**
 * ============================================================================
 * RancangLoka Publication DNA Core (CONTENT_PROTECTION-1B-A)
 * Pure, deterministic article fingerprinting & provenance library.
 *
 * Invariants:
 * - Pure functions only: NO D1, NO network, NO R2, NO cache, NO Astro rendering.
 * - Editorial prose is NEVER modified (PUBLICATION_DNA_MUST_NOT_ALTER_EDITORIAL_PROSE).
 * - Exact identity = SHA-256 of canonical Markdown (articles.content_hash).
 * - Similarity identity = norm-v1 normalized text, semantic blocks, 64-MinHash.
 * - All MinHash arithmetic uses native BigInt (modulo 2^61 - 1); zero JS Number precision loss.
 * - Dynamic Article Support recommendation modules are strictly excluded from structural DNA.
 * ============================================================================
 */

import crypto from 'node:crypto';
import { marked, type Tokens } from 'marked';

// ============================================================================
// 1. Contract Constants
// ============================================================================

export const DNA_VERSION = 'v1.0';
export const NORMALIZATION_VERSION = 'norm-v1';
export const SHINGLE_VERSION = 'shingle-4w-v1';
export const MINHASH_VERSION = 'minhash-64h-v1';
export const GENERATOR_VERSION = 'dna-engine/1.0.0';

export const CONTENT_HASH_CONTRACT_LEGACY_V0 = 'legacy-normalized-sha256-v0';
export const CONTENT_HASH_CONTRACT_MARKDOWN_V1 = 'canonical-markdown-sha256-v1';

export type ContentHashContract =
  | typeof CONTENT_HASH_CONTRACT_LEGACY_V0
  | typeof CONTENT_HASH_CONTRACT_MARKDOWN_V1;

export const SOURCE_FIDELITY_BYTE_EXACT = 'BYTE_EXACT_HASH_VERIFIED';
export const SOURCE_FIDELITY_NORMALIZED = 'NORMALIZED_HASH_VERIFIED';

export type SourceFidelity =
  | typeof SOURCE_FIDELITY_BYTE_EXACT
  | typeof SOURCE_FIDELITY_NORMALIZED;

export const MINHASH_COMPONENTS = 64;
export const MINHASH_PRIME = 2305843009213693951n; // Mersenne prime 2^61 - 1

/**
 * 64 fixed, deterministic coefficient pairs (a_i, b_i) for minhash-64h-v1.
 * Generated from seed "rancangloka-minhash-seed-v1" and frozen into source.
 * Invariants: a_i != 0n, 0 < a_i < p, 0 <= b_i < p.
 */
export const MINHASH_COEFFICIENTS_64: ReadonlyArray<readonly [bigint, bigint]> = Object.freeze([
  [179958641811050843n, 422843010632191338n],
  [1944640612324223214n, 721955888191461730n],
  [1055569655105877982n, 2041149719503953364n],
  [2127449327459556998n, 78429216884586176n],
  [309303073556261063n, 147107681282167164n],
  [1704747428133548991n, 1419709075670700059n],
  [558717665781942657n, 930016679408277028n],
  [1153622275944051899n, 1337750019570091956n],
  [1401009579174897154n, 367131715839815097n],
  [1891738814924601495n, 1584123584441723347n],
  [1945151065802023730n, 1692823764066692222n],
  [1337386155346522157n, 467763215018504928n],
  [1110597561048609114n, 1549553030246098843n],
  [1615045331933464715n, 1562180505569063892n],
  [2123305746950576918n, 905003061892864985n],
  [1553157459697285233n, 477146113893225390n],
  [2220191352266038722n, 1729856858193697693n],
  [1246940755921712688n, 1682625465807154037n],
  [1138660200432025682n, 2060048556385125089n],
  [783768690288192998n, 2186726701754749139n],
  [2097895873952908702n, 509797585916671939n],
  [2239166838601492711n, 337813256084498986n],
  [1292268961401165375n, 1393498999891372191n],
  [2261439228278543519n, 1480480967279194361n],
  [503664712582907661n, 2253709058445526780n],
  [133463449466493742n, 341126589404073557n],
  [1708431686379997965n, 999369915829096126n],
  [614191808268957214n, 494411407997664740n],
  [1228857400948400963n, 2009088311280086635n],
  [1355645895775211209n, 374811024044130824n],
  [474592988895661295n, 704285364704367554n],
  [1751958196309752303n, 2068191241718633149n],
  [961911296965538873n, 1983755689615490187n],
  [325119512701573730n, 2088728544119171011n],
  [426345571880792102n, 1731148930772136085n],
  [162311501455779985n, 2282527984548135864n],
  [2289888050557330239n, 1551714904838996036n],
  [602277276991492596n, 31478238935067857n],
  [185540420234163583n, 458968247841191271n],
  [308521586178758974n, 1239097349064679051n],
  [1452301018939900212n, 1013998773196943324n],
  [2181762521282183018n, 2128466840768715837n],
  [538338048889002441n, 1793408408201121292n],
  [1592514893178456996n, 140724172903395268n],
  [130032438287558926n, 2233407234487121926n],
  [2108019375301478529n, 1468243672679963703n],
  [1565494078238405852n, 1900088114946345029n],
  [2063200112875358265n, 932848399561236499n],
  [155663990986653689n, 1638169773457480565n],
  [1714849278772285913n, 412966700885806891n],
  [1738531371800432779n, 1326710764174833940n],
  [247164593295097702n, 1047625693170097102n],
  [1859962883886844372n, 1518714375993722060n],
  [2290134219120267002n, 1810215481554391506n],
  [2086442762646295681n, 1101739384611451135n],
  [241119953134763040n, 1106458126055679791n],
  [185573893139326668n, 1317442667961602476n],
  [996819608513712345n, 2223237024595907304n],
  [961699255385777754n, 1055072640304018503n],
  [1594233676858049201n, 828510576959883578n],
  [2043770555077149860n, 679222200613688050n],
  [493879253052834214n, 2069327985043306057n],
  [287624300843473453n, 1987920716724284755n],
  [269274227275045835n, 2219966670540931311n],
]);

/**
 * Invariant: EMPTY_MINHASH_IS_SENTINEL
 * Empty token sets (or text producing < 4 words) evaluate deterministically to 64 zero-filled hex strings.
 * Future similarity comparison engines MUST detect this sentinel explicitly and MUST NOT
 * interpret two zero-vector signatures as 100% textual similarity.
 */
export const EMPTY_MINHASH_SENTINEL_ELEMENT = '0000000000000000';
export const EMPTY_MINHASH_IS_SENTINEL = true;

// ============================================================================
// 2. Types & Interfaces
// ============================================================================

export type ProvenanceClass = 'FULL_PROVENANCE' | 'PARTIAL_HISTORICAL_PROVENANCE';

export interface VersionKeyParams {
  provenanceClass: ProvenanceClass;
  publicationReceiptId?: string | null;
  articleId: number;
  publishedContentHash: string;
}

export type SemanticBlockType = 'heading' | 'paragraph' | 'list' | 'table' | 'quote' | 'code';

export interface SemanticBlockSignature {
  index: number;
  block_type: SemanticBlockType;
  hash: string; // SHA-256 hex (64 chars) of normalized block text
  token_count: number;
}

export interface StructuralSignature {
  heading_hierarchy: string[]; // e.g. ["H1", "H2", "H3", "H2"]
  block_counts: {
    code: number;
    heading: number;
    list: number;
    paragraph: number;
    quote: number;
    table: number;
  };
  image_count: number;
  link_count: number;
}

export interface PublicationDnaMaterial {
  dnaVersion: string;
  normalizationVersion: string;
  shingleVersion: string;
  minhashVersion: string;
  generatorVersion: string;
  contentHashContract: ContentHashContract;
  publishedContentHash: string;
  normalizedTextHash: string;
  blockHashesJson: string;
  minhashSignatureJson: string;
  structuralSignatureJson: string;
  rawBlocks: SemanticBlockSignature[];
  rawMinhash: string[];
  rawStructure: StructuralSignature;
}

// ============================================================================
// 3. Identifiers & Version Key Helpers
// ============================================================================

/**
 * Generates a collision-resistant Publication DNA record identifier.
 * Uses UUID v4 / 128-bit UUID (~122 random bits after UUID version/variant fields)
 * prefixed with 'dna_'.
 */
export function generateDnaId(): string {
  return `dna_${crypto.randomUUID()}`;
}

/**
 * Builds the canonical, deterministic publication-version key.
 * - FULL_PROVENANCE: receipt:<publication_receipt_id>
 * - PARTIAL_HISTORICAL_PROVENANCE: historical:<article_id>:<published_content_hash>
 */
export function buildPublicationVersionKey(params: VersionKeyParams): string {
  if (!params || !params.provenanceClass) {
    throw new Error('VERSION_KEY_ERROR: provenanceClass is required');
  }

  if (params.provenanceClass === 'FULL_PROVENANCE') {
    if (
      !params.publicationReceiptId ||
      typeof params.publicationReceiptId !== 'string' ||
      !params.publicationReceiptId.trim()
    ) {
      throw new Error('VERSION_KEY_ERROR: publicationReceiptId is required for FULL_PROVENANCE');
    }
    return `receipt:${params.publicationReceiptId.trim()}`;
  }

  if (params.provenanceClass === 'PARTIAL_HISTORICAL_PROVENANCE') {
    if (typeof params.articleId !== 'number' || !Number.isInteger(params.articleId) || params.articleId <= 0) {
      throw new Error('VERSION_KEY_ERROR: valid positive integer articleId is required for PARTIAL_HISTORICAL_PROVENANCE');
    }
    if (
      !params.publishedContentHash ||
      typeof params.publishedContentHash !== 'string' ||
      !params.publishedContentHash.trim()
    ) {
      throw new Error('VERSION_KEY_ERROR: publishedContentHash is required for PARTIAL_HISTORICAL_PROVENANCE');
    }
    return `historical:${params.articleId}:${params.publishedContentHash.trim()}`;
  }

  throw new Error(`VERSION_KEY_ERROR: Unsupported provenance class '${String((params as any).provenanceClass)}'`);
}

// ============================================================================
// 4. Content Hash Contracts & Computation
// ============================================================================

/**
 * Historical Phase-1 content hashing contract used by Articles 5 and 6:
 * SHA-256 of content_md with collapsed whitespace and lowercased.
 */
export function computeLegacyContentHashV0(markdown: string): string {
  const normalized = (markdown || '').replace(/\s+/g, ' ').trim().toLowerCase();
  return crypto.createHash('sha256').update(normalized, 'utf8').digest('hex');
}

/**
 * Modern canonical content hash contract (V1):
 * SHA-256 of raw canonical Markdown UTF-8 bytes exactly as persisted.
 * This is the mandatory invariant for all new publication versions.
 */
export function computeCanonicalContentHash(canonicalMarkdown: string): string {
  return crypto.createHash('sha256').update(canonicalMarkdown || '', 'utf8').digest('hex');
}

/**
 * Explicit dispatcher to compute content hash for a specific hash contract.
 * Does NOT perform heuristic guessing; selection must be explicit.
 */
export function computeContentHashForContract(markdown: string, contract: ContentHashContract): string {
  if (contract === CONTENT_HASH_CONTRACT_MARKDOWN_V1) {
    return computeCanonicalContentHash(markdown);
  }
  if (contract === CONTENT_HASH_CONTRACT_LEGACY_V0) {
    return computeLegacyContentHashV0(markdown);
  }
  throw new Error(`UNKNOWN_CONTENT_HASH_CONTRACT: '${String(contract)}'`);
}

// ============================================================================
// 5. Deterministic Text Normalization (norm-v1)
// ============================================================================

/**
 * Normalizes Markdown text for similarity analysis under the norm-v1 contract.
 *
 * Deterministic pipeline:
 * 1. Unicode NFKC normalization
 * 2. CRLF/CR to LF standardization
 * 3. Strip Markdown images ![alt](url)
 * 4. Convert Markdown links [text](url) -> text
 * 5. Strip HTML tags <...>
 * 6. Strip text formatting (*, **, _, __, ~~) keeping visible content
 * 7. Strip code fences (```lang ... ```) keeping code text
 * 8. Strip inline code backticks (`code` -> code)
 * 9. Strip blockquote prefix (>)
 * 10. Strip table separator lines (|---|)
 * 11. Strip table boundary and cell pipes (|)
 * 12. Strip heading hashes (#) at start of lines
 * 13. Strip list markers (-, *, +, 1.) at start of lines
 * 14. Standardize quotes and dashes
 * 15. Collapse horizontal whitespace
 * 16. Trim lines, filter empty lines, join with single newline
 * 17. Lowercase for similarity token matching
 */
export function normalizeSimilarityText(canonicalMarkdown: string): string {
  if (!canonicalMarkdown) return '';

  // 1. Unicode NFKC
  let s = canonicalMarkdown.normalize('NFKC');

  // 2. CRLF / CR -> LF
  s = s.replace(/\r\n|\r/g, '\n');

  // 3. Strip Markdown images: ![alt](url "title")
  s = s.replace(/!\[[^\]]*\]\([^)]*\)/g, '');

  // 4. Convert Markdown links: [text](url) -> text
  s = s.replace(/\[([^\]]+)\]\([^)]*\)/g, '$1');

  // 5. Strip HTML tags
  s = s.replace(/<[^>]+>/g, '');

  // 6. Strip bold, italics, strikethrough
  s = s.replace(/(\*\*|__)(.*?)\1/g, '$2');
  s = s.replace(/(\*|_)(.*?)\1/g, '$2');
  s = s.replace(/~~(.*?)~~/g, '$1');

  // 7. Strip code fences while preserving code body: ```lang\ncode\n``` -> code
  s = s.replace(/```[^\n]*\n([\s\S]*?)```/g, '$1');

  // 8. Strip inline code backticks: `code` -> code
  s = s.replace(/`([^`]+)`/g, '$1');

  // 9. Strip blockquotes: > quote
  s = s.replace(/^[ \t]*>[ \t]?/gm, '');

  // 10. Strip table separator rows: |---|---| or |:---:|
  s = s.replace(/^[ \t]*\|?[-:| ]+\|[ \t]*$/gm, '');

  // 11. Strip table cell pipes
  s = s.replace(/^[ \t]*\|/gm, '');
  s = s.replace(/\|[ \t]*$/gm, '');
  s = s.replace(/\|/g, ' ');

  // 12. Strip heading hashes: # Title
  s = s.replace(/^[ \t]*#{1,6}[ \t]+/gm, '');

  // 13. Strip list markers: - item, * item, 1. item
  s = s.replace(/^[ \t]*([-*+]|\d+\.)[ \t]+/gm, '');

  // 14. Standardize punctuation quotes & dashes
  s = s.replace(/[\u201C\u201D]/g, '"');
  s = s.replace(/[\u2018\u2019]/g, "'");
  s = s.replace(/[\u2014\u2013]/g, '-');

  // 15. Collapse horizontal whitespace
  s = s.replace(/[ \t]+/g, ' ');

  // 16. Trim lines, filter empty lines, join with single newline
  const lines = s
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean);

  // 17. Lowercase
  return lines.join('\n').toLowerCase();
}

/**
 * Computes SHA-256 of the normalized similarity text.
 */
export function computeNormalizedTextHash(normalizedSimilarityText: string): string {
  return crypto.createHash('sha256').update(normalizedSimilarityText || '', 'utf8').digest('hex');
}

// ============================================================================
// 6. Semantic Block Segmentation
// ============================================================================

/**
 * Segments canonical Markdown into semantic blocks (heading, paragraph, list, table, quote, code)
 * and generates deterministic SHA-256 signatures for each block.
 */
export function segmentSemanticBlocks(canonicalMarkdown: string): SemanticBlockSignature[] {
  if (!canonicalMarkdown || !canonicalMarkdown.trim()) {
    return [];
  }

  // Normalize line endings before parsing
  const cleanMd = canonicalMarkdown.normalize('NFKC').replace(/\r\n|\r/g, '\n');
  const tokens = marked.lexer(cleanMd);
  const signatures: SemanticBlockSignature[] = [];

  for (const token of tokens) {
    if (token.type === 'space') continue;

    let blockType: SemanticBlockType;
    let blockRawText = '';

    switch (token.type) {
      case 'heading':
        blockType = 'heading';
        blockRawText = token.text;
        break;
      case 'paragraph':
        blockType = 'paragraph';
        blockRawText = token.text;
        break;
      case 'list':
        blockType = 'list';
        blockRawText = (token as Tokens.List).items.map((i) => i.text).join('\n');
        break;
      case 'table':
        blockType = 'table';
        const tableToken = token as Tokens.Table;
        const headerText = tableToken.header.map((h) => h.text).join(' ');
        const rowsText = tableToken.rows.map((row) => row.map((cell) => cell.text).join(' ')).join('\n');
        blockRawText = `${headerText}\n${rowsText}`;
        break;
      case 'blockquote':
        blockType = 'quote';
        blockRawText = (token as Tokens.Blockquote).text;
        break;
      case 'code':
        blockType = 'code';
        blockRawText = (token as Tokens.Code).text;
        break;
      default:
        // Generic fallback for any other block types
        blockType = 'paragraph';
        blockRawText = (token as any).text || (token as any).raw || '';
        break;
    }

    const normBlock = normalizeSimilarityText(blockRawText);
    const wordTokens = extractWordTokens(normBlock);

    // If block is empty after normalization (e.g. paragraph was only an image), skip it
    if (wordTokens.length === 0 && !normBlock.trim()) {
      continue;
    }

    const hash = crypto.createHash('sha256').update(normBlock, 'utf8').digest('hex');

    signatures.push({
      index: signatures.length,
      block_type: blockType,
      hash,
      token_count: wordTokens.length,
    });
  }

  return signatures;
}

// ============================================================================
// 7. Structural Signature
// ============================================================================

/**
 * Extracts presentation-independent semantic structure from canonical Markdown.
 * Note: Dynamic recommendation modules (e.g. Article Support) are strictly excluded.
 */
export function extractStructuralSignature(canonicalMarkdown: string): StructuralSignature {
  if (!canonicalMarkdown || !canonicalMarkdown.trim()) {
    return {
      heading_hierarchy: [],
      block_counts: {
        code: 0,
        heading: 0,
        list: 0,
        paragraph: 0,
        quote: 0,
        table: 0,
      },
      image_count: 0,
      link_count: 0,
    };
  }

  const cleanMd = canonicalMarkdown.normalize('NFKC').replace(/\r\n|\r/g, '\n');
  const tokens = marked.lexer(cleanMd);

  const headingHierarchy: string[] = [];
  const blockCounts = {
    code: 0,
    heading: 0,
    list: 0,
    paragraph: 0,
    quote: 0,
    table: 0,
  };

  for (const token of tokens) {
    if (token.type === 'space') continue;

    switch (token.type) {
      case 'heading':
        blockCounts.heading += 1;
        headingHierarchy.push(`H${(token as Tokens.Heading).depth}`);
        break;
      case 'paragraph':
        blockCounts.paragraph += 1;
        break;
      case 'list':
        blockCounts.list += 1;
        break;
      case 'table':
        blockCounts.table += 1;
        break;
      case 'blockquote':
        blockCounts.quote += 1;
        break;
      case 'code':
        blockCounts.code += 1;
        break;
      default:
        blockCounts.paragraph += 1;
        break;
    }
  }

  // Count images: ![alt](url)
  const imageMatches = cleanMd.match(/!\[[^\]]*\]\([^)]*\)/g);
  const imageCount = imageMatches ? imageMatches.length : 0;

  // Count links (excluding images): (?<!!)\[text\]\(url\)
  const linkMatches = cleanMd.match(/(?<!\!)\[[^\]]+\]\([^)]*\)/g);
  const linkCount = linkMatches ? linkMatches.length : 0;

  return {
    heading_hierarchy: headingHierarchy,
    block_counts: blockCounts,
    image_count: imageCount,
    link_count: linkCount,
  };
}

// ============================================================================
// 8. MinHash (minhash-64h-v1) with BigInt Arithmetic
// ============================================================================

/**
 * Extracts word tokens for similarity analysis.
 */
export function extractWordTokens(text: string): string[] {
  if (!text) return [];
  return text.match(/[a-z0-9_\u00C0-\u024F\u1E00-\u1EFF]+/g) || [];
}

/**
 * Constructs 4-word shingles from word tokens.
 * Handles short texts deterministically (< 4 words produces a single shingle).
 */
export function buildWordShingles(tokens: string[], k: number = 4): string[] {
  if (!tokens || tokens.length === 0) return [];
  if (tokens.length < k) {
    return [tokens.join(' ')];
  }
  const shingles: string[] = [];
  for (let i = 0; i <= tokens.length - k; i++) {
    shingles.push(tokens.slice(i, i + k).join(' '));
  }
  return shingles;
}

/**
 * Maps a single string shingle deterministically to a BigInt field element in [0, p-1].
 * Method:
 * 1. Compute SHA-256 of the shingle string (UTF-8).
 * 2. Read the first 8 bytes as a big-endian unsigned 64-bit integer (BigUInt64BE).
 * 3. Reduce modulo Mersenne prime p = 2^61 - 1.
 */
export function hashShingleToField(shingle: string): bigint {
  const hashBuf = crypto.createHash('sha256').update(shingle, 'utf8').digest();
  const raw64 = hashBuf.readBigUInt64BE(0);
  return raw64 % MINHASH_PRIME;
}

/**
 * Computes 64-component MinHash signature using 64 fixed linear hash functions.
 * All arithmetic is performed in BigInt:
 *   h_i(x) = (a_i * x + b_i) mod (2^61 - 1)
 *
 * Persisted output:
 * Array of 64 fixed-width 16-character lowercase hexadecimal strings.
 * Zero JS Number precision loss.
 */
export function computeMinhashSignature(tokens: string[]): string[] {
  const shingles = buildWordShingles(tokens, 4);

  // If text produces zero shingles (e.g. empty string), return 64 zero-filled hex strings
  if (shingles.length === 0) {
    return Array.from({ length: MINHASH_COMPONENTS }, () => '0000000000000000');
  }

  // Pre-compute field element values for each unique shingle
  const uniqueShingles = Array.from(new Set(shingles));
  const fieldValues = uniqueShingles.map(hashShingleToField);

  const signature: string[] = [];

  for (let i = 0; i < MINHASH_COMPONENTS; i++) {
    const [a, b] = MINHASH_COEFFICIENTS_64[i];
    let minVal = MINHASH_PRIME; // Upper bound sentinel

    for (let j = 0; j < fieldValues.length; j++) {
      const x = fieldValues[j];
      const h = (a * x + b) % MINHASH_PRIME;
      if (h < minVal) {
        minVal = h;
      }
    }

    // Format as 16-character lowercase hexadecimal string with leading zeros
    const hex = minVal.toString(16).padStart(16, '0');
    signature.push(hex);
  }

  return signature;
}

// ============================================================================
// 9. Deterministic JSON Canonicalization
// ============================================================================

export function canonicalizeBlockHashesJson(blocks: SemanticBlockSignature[]): string {
  // Ensure array order is preserved and keys are deterministic
  return JSON.stringify(blocks);
}

export function canonicalizeMinhashSignatureJson(minhash: string[]): string {
  return JSON.stringify(minhash);
}

export function canonicalizeStructuralSignatureJson(struct: StructuralSignature): string {
  // Order keys strictly alphabetically to ensure byte-deterministic serialization
  const ordered = {
    block_counts: {
      code: struct.block_counts.code,
      heading: struct.block_counts.heading,
      list: struct.block_counts.list,
      paragraph: struct.block_counts.paragraph,
      quote: struct.block_counts.quote,
      table: struct.block_counts.table,
    },
    heading_hierarchy: struct.heading_hierarchy,
    image_count: struct.image_count,
    link_count: struct.link_count,
  };
  return JSON.stringify(ordered);
}

// ============================================================================
// 10. High-Level Materialization Pipeline
// ============================================================================

/**
 * Pure generator creating complete Publication DNA fingerprint material from canonical Markdown.
 * Defaults to modern CANONICAL_MARKDOWN_HASH_V1 contract.
 * Explicit historical callers (e.g. backfill for Articles 5 & 6) may pass contract = CONTENT_HASH_CONTRACT_LEGACY_V0.
 */
export function generatePublicationDnaMaterial(
  canonicalMarkdown: string,
  contract: ContentHashContract = CONTENT_HASH_CONTRACT_MARKDOWN_V1
): PublicationDnaMaterial {
  const publishedContentHash = computeContentHashForContract(canonicalMarkdown, contract);
  const normalizedText = normalizeSimilarityText(canonicalMarkdown);
  const normalizedTextHash = computeNormalizedTextHash(normalizedText);

  const rawBlocks = segmentSemanticBlocks(canonicalMarkdown);
  const blockHashesJson = canonicalizeBlockHashesJson(rawBlocks);

  const wordTokens = extractWordTokens(normalizedText);
  const rawMinhash = computeMinhashSignature(wordTokens);
  const minhashSignatureJson = canonicalizeMinhashSignatureJson(rawMinhash);

  const rawStructure = extractStructuralSignature(canonicalMarkdown);
  const structuralSignatureJson = canonicalizeStructuralSignatureJson(rawStructure);

  return {
    dnaVersion: DNA_VERSION,
    normalizationVersion: NORMALIZATION_VERSION,
    shingleVersion: SHINGLE_VERSION,
    minhashVersion: MINHASH_VERSION,
    generatorVersion: GENERATOR_VERSION,
    contentHashContract: contract,
    publishedContentHash,
    normalizedTextHash,
    blockHashesJson,
    minhashSignatureJson,
    structuralSignatureJson,
    rawBlocks,
    rawMinhash,
    rawStructure,
  };
}
