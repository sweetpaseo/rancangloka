/**
 * ============================================================================
 * RancangLoka Publication DNA Store & Materializer (CONTENT_PROTECTION-1B-B / 1B-C)
 *
 * Authoritative storage and materialization layer for publication DNA signatures.
 * Binds immutable fingerprinting and provenance directly to publication receipts.
 *
 * Invariants:
 * - Append-only table: NO UPDATE, NO DELETE on article_dna_signatures.
 * - Idempotent on identical version_key (DNA_ALREADY_EXISTS).
 * - Conflict-detecting on modified content/versions for same key (DNA_VERSION_CONFLICT).
 * - All new publications strictly enforce CONTENT_HASH_CONTRACT_MARKDOWN_V1 and BYTE_EXACT_HASH_VERIFIED.
 * - Historical backfill records use NORMALIZED_HASH_VERIFIED with legacy-normalized-sha256-v0.
 * - DNA failure NEVER rolls back publication (PUBLICATION_SUCCEEDS_DNA_PENDING).
 * ============================================================================
 */

import {
  DNA_VERSION,
  NORMALIZATION_VERSION,
  SHINGLE_VERSION,
  MINHASH_VERSION,
  GENERATOR_VERSION,
  CONTENT_HASH_CONTRACT_LEGACY_V0,
  CONTENT_HASH_CONTRACT_MARKDOWN_V1,
  SOURCE_FIDELITY_BYTE_EXACT,
  SOURCE_FIDELITY_NORMALIZED,
  type ContentHashContract,
  type ProvenanceClass,
  type SourceFidelity,
  generateDnaId,
  buildPublicationVersionKey,
  computeCanonicalContentHash,
  computeLegacyContentHashV0,
  generatePublicationDnaMaterial
} from './publication-dna.ts';

export interface PublicationDnaSourceSnapshot {
  articleId: number;
  contentMarkdown: string;
  contentHash: string;
  slug: string;
  canonicalUrl: string;
  approvedContentHash?: string | null;
  approvedRecordedAt?: string | null;
  featuredAssetId?: string | null;
  featuredAssetSha256?: string | null;
  executionId?: string | null;
  receiptId?: string | null;
  actualPublishedAt?: string | null;
  historicalPublishedAt?: string | null;
  provenanceClass?: ProvenanceClass;
  contentHashContract?: ContentHashContract;
  sourceFidelity?: SourceFidelity;
}

export type MaterializeDnaStatus =
  | 'DNA_GENERATED'
  | 'DNA_ALREADY_EXISTS'
  | 'DNA_SOURCE_HASH_MISMATCH'
  | 'DNA_PROVENANCE_SOURCE_MISMATCH'
  | 'DNA_VERSION_CONFLICT'
  | 'DNA_GENERATION_FAILED';

export interface MaterializePublicationDnaResult {
  status: MaterializeDnaStatus;
  dnaId?: string;
  versionKey: string;
  articleId: number;
  publishedContentHash: string;
  contentHashContract: ContentHashContract;
  sourceFidelity?: SourceFidelity;
  error?: string;
  details?: Record<string, any>;
}

/**
 * Structured logging for DNA operational events and failures.
 */
function logDnaOperationalEvent(
  result: MaterializePublicationDnaResult,
  snapshot: PublicationDnaSourceSnapshot
): void {
  const isFailure = result.status !== 'DNA_GENERATED' && result.status !== 'DNA_ALREADY_EXISTS';
  const logPayload = {
    event: result.status,
    article_id: snapshot.articleId,
    receipt_id: snapshot.receiptId || null,
    execution_id: snapshot.executionId || null,
    version_key: result.versionKey,
    published_content_hash: snapshot.contentHash,
    content_hash_contract: result.contentHashContract,
    source_fidelity: result.sourceFidelity || snapshot.sourceFidelity || null,
    dna_version: DNA_VERSION,
    generator_version: GENERATOR_VERSION,
    error_class: result.status,
    error_details: result.error,
    timestamp: new Date().toISOString()
  };

  if (isFailure) {
    console.error(JSON.stringify(logPayload));
  }
}

/**
 * Materializes immutable Publication DNA record in D1 from an authoritative source snapshot.
 * Guarantees idempotency and conflict detection without mutating publication state.
 */
export async function materializePublicationDna(
  db: any,
  snapshot: PublicationDnaSourceSnapshot
): Promise<MaterializePublicationDnaResult> {
  const provenanceClass: ProvenanceClass = snapshot.provenanceClass || 'FULL_PROVENANCE';
  const contract: ContentHashContract = snapshot.contentHashContract || CONTENT_HASH_CONTRACT_MARKDOWN_V1;

  // 1. Enforce Source Fidelity Contract
  let sourceFidelity: SourceFidelity;
  if (contract === CONTENT_HASH_CONTRACT_MARKDOWN_V1) {
    if (snapshot.sourceFidelity && snapshot.sourceFidelity !== SOURCE_FIDELITY_BYTE_EXACT) {
      const fidFailRes: MaterializePublicationDnaResult = {
        status: 'DNA_GENERATION_FAILED',
        versionKey: `invalid-fidelity:${snapshot.articleId}`,
        articleId: snapshot.articleId,
        publishedContentHash: snapshot.contentHash,
        contentHashContract: contract,
        error: `Canonical publisher contract '${CONTENT_HASH_CONTRACT_MARKDOWN_V1}' cannot emit '${snapshot.sourceFidelity}'. Must be '${SOURCE_FIDELITY_BYTE_EXACT}'.`
      };
      logDnaOperationalEvent(fidFailRes, snapshot);
      return fidFailRes;
    }
    sourceFidelity = SOURCE_FIDELITY_BYTE_EXACT;
  } else if (contract === CONTENT_HASH_CONTRACT_LEGACY_V0) {
    if (snapshot.sourceFidelity && snapshot.sourceFidelity !== SOURCE_FIDELITY_NORMALIZED) {
      const fidFailRes: MaterializePublicationDnaResult = {
        status: 'DNA_GENERATION_FAILED',
        versionKey: `invalid-fidelity:${snapshot.articleId}`,
        articleId: snapshot.articleId,
        publishedContentHash: snapshot.contentHash,
        contentHashContract: contract,
        error: `Historical legacy V0 content hash cannot claim '${snapshot.sourceFidelity}'. Must be '${SOURCE_FIDELITY_NORMALIZED}'.`
      };
      logDnaOperationalEvent(fidFailRes, snapshot);
      return fidFailRes;
    }
    sourceFidelity = SOURCE_FIDELITY_NORMALIZED;
  } else {
    sourceFidelity = SOURCE_FIDELITY_BYTE_EXACT;
  }

  let versionKey: string;
  try {
    versionKey = buildPublicationVersionKey({
      provenanceClass,
      publicationReceiptId: snapshot.receiptId,
      articleId: snapshot.articleId,
      publishedContentHash: snapshot.contentHash
    });
  } catch (keyErr: any) {
    const res: MaterializePublicationDnaResult = {
      status: 'DNA_GENERATION_FAILED',
      versionKey: `unknown:${snapshot.articleId}:${snapshot.receiptId || 'no-receipt'}`,
      articleId: snapshot.articleId,
      publishedContentHash: snapshot.contentHash,
      contentHashContract: contract,
      sourceFidelity,
      error: `Failed to construct version_key: ${keyErr?.message || String(keyErr)}`
    };
    logDnaOperationalEvent(res, snapshot);
    return res;
  }

  // 2. Idempotency & Conflict Check against existing record
  try {
    const existing = await db
      .prepare('SELECT * FROM article_dna_signatures WHERE version_key = ? LIMIT 1')
      .bind(versionKey)
      .first();

    if (existing) {
      // Check whether existing record matches all immutable critical fields
      const isIdentical =
        existing.article_id === snapshot.articleId &&
        existing.published_content_hash === snapshot.contentHash &&
        existing.content_hash_contract === contract &&
        existing.source_fidelity === sourceFidelity &&
        existing.publication_receipt_id === (snapshot.receiptId || null) &&
        existing.dna_version === DNA_VERSION &&
        existing.normalization_version === NORMALIZATION_VERSION &&
        existing.shingle_version === SHINGLE_VERSION &&
        existing.minhash_version === MINHASH_VERSION &&
        existing.generator_version === GENERATOR_VERSION;

      if (isIdentical) {
        return {
          status: 'DNA_ALREADY_EXISTS',
          dnaId: existing.dna_id,
          versionKey,
          articleId: snapshot.articleId,
          publishedContentHash: snapshot.contentHash,
          contentHashContract: existing.content_hash_contract as ContentHashContract,
          sourceFidelity: existing.source_fidelity as SourceFidelity
        };
      }

      // Conflict: existing record has same version_key but mismatched critical fields
      const conflictRes: MaterializePublicationDnaResult = {
        status: 'DNA_VERSION_CONFLICT',
        dnaId: existing.dna_id,
        versionKey,
        articleId: snapshot.articleId,
        publishedContentHash: snapshot.contentHash,
        contentHashContract: existing.content_hash_contract as ContentHashContract,
        sourceFidelity: existing.source_fidelity as SourceFidelity,
        error: `Existing DNA record '${existing.dna_id}' with version_key '${versionKey}' conflicts with snapshot fields`
      };
      logDnaOperationalEvent(conflictRes, snapshot);
      return conflictRes;
    }
  } catch (checkErr: any) {
    // If the check fails because table does not exist, fall through to insertion attempt which will fail gracefully
    const msg = checkErr?.message || String(checkErr);
    if (!msg.includes('no such table')) {
      console.warn('[PublicationDnaStore] Pre-insert existing check warning:', msg);
    }
  }

  // 3. Content Hash Verification
  if (contract === CONTENT_HASH_CONTRACT_MARKDOWN_V1) {
    const computedModernHash = computeCanonicalContentHash(snapshot.contentMarkdown || '');
    if (computedModernHash !== snapshot.contentHash) {
      const mismatchRes: MaterializePublicationDnaResult = {
        status: 'DNA_SOURCE_HASH_MISMATCH',
        versionKey,
        articleId: snapshot.articleId,
        publishedContentHash: snapshot.contentHash,
        contentHashContract: contract,
        sourceFidelity,
        error: `Source hash mismatch: computed ${computedModernHash} !== expected ${snapshot.contentHash}`
      };
      logDnaOperationalEvent(mismatchRes, snapshot);
      return mismatchRes;
    }
  } else if (contract === CONTENT_HASH_CONTRACT_LEGACY_V0) {
    const computedLegacyHash = computeLegacyContentHashV0(snapshot.contentMarkdown || '');
    if (computedLegacyHash !== snapshot.contentHash) {
      const mismatchRes: MaterializePublicationDnaResult = {
        status: 'DNA_SOURCE_HASH_MISMATCH',
        versionKey,
        articleId: snapshot.articleId,
        publishedContentHash: snapshot.contentHash,
        contentHashContract: contract,
        sourceFidelity,
        error: `Legacy source hash mismatch: computed ${computedLegacyHash} !== expected ${snapshot.contentHash}`
      };
      logDnaOperationalEvent(mismatchRes, snapshot);
      return mismatchRes;
    }
  }

  // 4. Approval Provenance Validation
  if (provenanceClass === 'FULL_PROVENANCE') {
    if (!snapshot.approvedContentHash || snapshot.approvedContentHash !== snapshot.contentHash) {
      const provMismatchRes: MaterializePublicationDnaResult = {
        status: 'DNA_PROVENANCE_SOURCE_MISMATCH',
        versionKey,
        articleId: snapshot.articleId,
        publishedContentHash: snapshot.contentHash,
        contentHashContract: contract,
        sourceFidelity,
        error: !snapshot.approvedContentHash
          ? 'Missing approved_content_hash for FULL_PROVENANCE publication'
          : `Approval provenance hash mismatch: approved ${snapshot.approvedContentHash} !== published ${snapshot.contentHash}`
      };
      logDnaOperationalEvent(provMismatchRes, snapshot);
      return provMismatchRes;
    }
  }

  // 5. Generate Pure Deterministic DNA Material
  let dnaMaterial;
  try {
    dnaMaterial = generatePublicationDnaMaterial(snapshot.contentMarkdown, contract);
  } catch (genErr: any) {
    const genFailRes: MaterializePublicationDnaResult = {
      status: 'DNA_GENERATION_FAILED',
      versionKey,
      articleId: snapshot.articleId,
      publishedContentHash: snapshot.contentHash,
      contentHashContract: contract,
      sourceFidelity,
      error: `Failed to compute DNA material: ${genErr?.message || String(genErr)}`
    };
    logDnaOperationalEvent(genFailRes, snapshot);
    return genFailRes;
  }

  const dnaId = generateDnaId();

  // 6. Append-only Immutable INSERT
  try {
    await db
      .prepare(`
        INSERT INTO article_dna_signatures (
          dna_id, version_key, article_id, publication_receipt_id, publication_execution_id,
          provenance_class, content_hash_contract, source_fidelity, published_content_hash, approved_content_hash,
          canonical_slug, canonical_url, approved_recorded_at, actual_published_at, historical_published_at,
          dna_version, normalization_version, shingle_version, minhash_version,
          normalized_text_hash, block_hashes_json, minhash_signature_json, structural_signature_json,
          featured_asset_id, featured_asset_sha256, generator_version, created_at
        ) VALUES (
          ?, ?, ?, ?, ?,
          ?, ?, ?, ?, ?,
          ?, ?, ?, ?, ?,
          ?, ?, ?, ?,
          ?, ?, ?, ?,
          ?, ?, ?, CURRENT_TIMESTAMP
        )
      `)
      .bind(
        dnaId,
        versionKey,
        snapshot.articleId,
        snapshot.receiptId || null,
        snapshot.executionId || null,
        provenanceClass,
        contract,
        sourceFidelity,
        snapshot.contentHash,
        snapshot.approvedContentHash || null,
        snapshot.slug,
        snapshot.canonicalUrl,
        snapshot.approvedRecordedAt || null,
        snapshot.actualPublishedAt || null,
        snapshot.historicalPublishedAt || null,
        dnaMaterial.dnaVersion,
        dnaMaterial.normalizationVersion,
        dnaMaterial.shingleVersion,
        dnaMaterial.minhashVersion,
        dnaMaterial.normalizedTextHash,
        dnaMaterial.blockHashesJson,
        dnaMaterial.minhashSignatureJson,
        dnaMaterial.structuralSignatureJson,
        snapshot.featuredAssetId || null,
        snapshot.featuredAssetSha256 || null,
        dnaMaterial.generatorVersion
      )
      .run();

    return {
      status: 'DNA_GENERATED',
      dnaId,
      versionKey,
      articleId: snapshot.articleId,
      publishedContentHash: snapshot.contentHash,
      contentHashContract: contract,
      sourceFidelity
    };
  } catch (insertErr: any) {
    const errMsg = insertErr?.message || String(insertErr);

    // If race condition: another concurrent execution inserted the exact same version_key
    if (errMsg.includes('UNIQUE constraint failed') && errMsg.includes('version_key')) {
      try {
        const existingAfter = await db
          .prepare('SELECT * FROM article_dna_signatures WHERE version_key = ? LIMIT 1')
          .bind(versionKey)
          .first();

        if (existingAfter && existingAfter.published_content_hash === snapshot.contentHash) {
          return {
            status: 'DNA_ALREADY_EXISTS',
            dnaId: existingAfter.dna_id,
            versionKey,
            articleId: snapshot.articleId,
            publishedContentHash: snapshot.contentHash,
            contentHashContract: existingAfter.content_hash_contract as ContentHashContract,
            sourceFidelity: existingAfter.source_fidelity as SourceFidelity
          };
        }
      } catch {
        // Fall through to failure
      }
    }

    const failRes: MaterializePublicationDnaResult = {
      status: 'DNA_GENERATION_FAILED',
      versionKey,
      articleId: snapshot.articleId,
      publishedContentHash: snapshot.contentHash,
      contentHashContract: contract,
      sourceFidelity,
      error: errMsg
    };
    logDnaOperationalEvent(failRes, snapshot);
    return failRes;
  }
}
