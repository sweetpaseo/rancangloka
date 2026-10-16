#!/usr/bin/env node
/**
 * ============================================================================
 * RancangLoka Publication DNA Backfill Utility (CONTENT_PROTECTION-1B-C)
 *
 * Implements authoritative historical Publication DNA backfill for Articles 5–9.
 *
 * Invariants:
 * - Scope is STRICTLY: article_id IN (5, 6, 7, 8, 9).
 * - SOURCE TABLES ARE STRICTLY READ-ONLY (no mutation on articles, receipts, etc).
 * - The ONLY future write target is article_dna_signatures.
 * - Idempotent materialization: ALREADY_EXISTS_IDENTICAL, BLOCKED_VERSION_CONFLICT.
 * - Write mode requires DUAL confirmation: --apply AND --confirm-production-dna-backfill.
 * - DEFAULT MODE IS ALWAYS DRY-RUN.
 * ============================================================================
 */

import { execSync } from 'node:child_process';
import { DatabaseSync } from 'node:sqlite';

import {
  CONTENT_HASH_CONTRACT_LEGACY_V0,
  CONTENT_HASH_CONTRACT_MARKDOWN_V1,
  SOURCE_FIDELITY_BYTE_EXACT,
  SOURCE_FIDELITY_NORMALIZED,
  buildPublicationVersionKey,
  computeCanonicalContentHash,
  computeLegacyContentHashV0
} from '../src/lib/content-protection/publication-dna.ts';

import {
  materializePublicationDna
} from '../src/lib/content-protection/publication-dna-store.ts';

export const TARGET_BACKFILL_ARTICLE_IDS = Object.freeze([5, 6, 7, 8, 9]);

/**
 * Executes a query against the given DB interface.
 * Handles both local SQLite (or mock) and remote Wrangler D1 query executions.
 */
export async function executeD1Query(db, sql, params = []) {
  if (db && typeof db.prepare === 'function') {
    const stmt = db.prepare(sql);
    if (params.length > 0) {
      stmt.bind(...params);
    }
    if (typeof stmt.all === 'function') {
      const res = await stmt.all();
      return Array.isArray(res) ? res : res?.results || [];
    }
    if (typeof stmt.run === 'function') {
      const res = await stmt.run();
      return Array.isArray(res) ? res : res?.results || [];
    }
  }

  throw new Error('Unsupported database interface for query execution');
}

/**
 * Creates a remote Wrangler D1 read-only adapter.
 */
export function createRemoteWranglerAdapter(databaseBinding = 'DB') {
  return {
    isRemote: true,
    prepare(sql) {
      let boundParams = [];
      return {
        bind(...args) {
          boundParams = args;
          return this;
        },
        async all() {
          // Replace params safely for read-only queries
          let formattedSql = sql;
          if (boundParams.length > 0) {
            for (const param of boundParams) {
              const val = typeof param === 'number' ? param : `'${String(param).replace(/'/g, "''")}'`;
              formattedSql = formattedSql.replace('?', String(val));
            }
          }
          const escapedCommand = formattedSql.replace(/"/g, '\\"');
          const cmd = `npx wrangler d1 execute ${databaseBinding} --remote --json --command "${escapedCommand}"`;
          const raw = execSync(cmd, { encoding: 'utf8', maxBuffer: 25 * 1024 * 1024 });
          const parsed = JSON.parse(raw);
          if (parsed.error) {
            throw new Error(parsed.error.text || JSON.stringify(parsed.error));
          }
          if (parsed[0] && Array.isArray(parsed[0].results)) {
            return parsed[0].results;
          }
          return [];
        },
        async first() {
          const results = await this.all();
          return results[0] || null;
        },
        async run() {
          throw new Error('DIRECT_REMOTE_RUN_BLOCKED: Remote mutations are strictly forbidden during 1B-C preparation');
        }
      };
    }
  };
}

/**
 * Builds the authoritative backfill plan for Articles 5–9 from source tables.
 */
export async function buildBackfillPlans(db) {
  // 1. Fetch articles
  const articles = await executeD1Query(
    db,
    'SELECT id, slug, status, content_hash, content_md, published_at FROM articles WHERE id IN (5, 6, 7, 8, 9) ORDER BY id'
  );

  // 2. Fetch editorial approvals
  let approvals = [];
  try {
    approvals = await executeD1Query(
      db,
      "SELECT id, article_id, approval_status, approved_content_hash, approved_asset_id, created_at FROM article_editorial_approvals WHERE article_id IN (5, 6, 7, 8, 9) AND approval_status = 'APPROVED' ORDER BY created_at DESC, id DESC"
    );
  } catch {
    // Non-fatal if table not yet populated in mock
  }

  // 3. Fetch receipts
  let receipts = [];
  try {
    receipts = await executeD1Query(
      db,
      'SELECT receipt_id, execution_id, article_id, content_hash, actual_published_at, featured_asset_id FROM publication_execution_receipts WHERE article_id IN (5, 6, 7, 8, 9) ORDER BY actual_published_at DESC'
    );
  } catch {
    // Non-fatal if table not yet populated
  }

  // 4. Fetch media assets
  let mediaAssets = [];
  try {
    mediaAssets = await executeD1Query(db, 'SELECT asset_id, sha256 FROM media_assets');
  } catch {
    // Non-fatal
  }
  const mediaAssetMap = new Map();
  for (const ma of mediaAssets) {
    if (ma.asset_id && ma.sha256) {
      mediaAssetMap.set(ma.asset_id, ma.sha256);
    }
  }

  // 5. Fetch article_media active featured relations
  let activeMedia = [];
  try {
    activeMedia = await executeD1Query(
      db,
      "SELECT article_id, asset_id, role, is_active FROM article_media WHERE article_id IN (5, 6, 7, 8, 9) AND role = 'featured' AND is_active = 1"
    );
  } catch {
    // Non-fatal
  }
  const activeMediaMap = new Map();
  for (const am of activeMedia) {
    if (am.article_id && am.asset_id) {
      activeMediaMap.set(am.article_id, am.asset_id);
    }
  }

  // 6. Check existing DNA signatures (if table exists)
  let existingDnaMap = new Map();
  try {
    const existingRows = await executeD1Query(db, 'SELECT * FROM article_dna_signatures WHERE article_id IN (5, 6, 7, 8, 9)');
    for (const r of existingRows) {
      if (r.version_key) {
        existingDnaMap.set(r.version_key, r);
      }
    }
  } catch {
    // Table may not exist yet; treated as 0 existing rows
  }

  const plans = [];

  for (const articleId of TARGET_BACKFILL_ARTICLE_IDS) {
    const art = articles.find(a => a.id === articleId);
    if (!art) {
      plans.push({
        article_id: articleId,
        slug: 'UNKNOWN',
        version_key: 'UNKNOWN',
        provenance_class: 'FULL_PROVENANCE',
        content_hash_contract: CONTENT_HASH_CONTRACT_MARKDOWN_V1,
        source_fidelity: SOURCE_FIDELITY_BYTE_EXACT,
        hash_verification: 'FAILED_ARTICLE_NOT_FOUND',
        approval_state: 'NONE',
        receipt_state: 'NONE',
        featured_asset_state: 'NONE',
        planned_action: 'BLOCKED_SOURCE_MISMATCH',
        block_reason: `Article ID ${articleId} not found in articles table`
      });
      continue;
    }

    const approval = approvals.find(ap => ap.article_id === articleId);
    const receipt = receipts.find(rc => rc.article_id === articleId);

    // Classification per article
    let provenanceClass;
    let contract;
    let sourceFidelity;

    if (articleId === 5) {
      provenanceClass = 'FULL_PROVENANCE';
      contract = CONTENT_HASH_CONTRACT_LEGACY_V0;
      sourceFidelity = SOURCE_FIDELITY_NORMALIZED;
    } else if (articleId === 6) {
      provenanceClass = 'PARTIAL_HISTORICAL_PROVENANCE';
      contract = CONTENT_HASH_CONTRACT_LEGACY_V0;
      sourceFidelity = SOURCE_FIDELITY_NORMALIZED;
    } else {
      provenanceClass = 'FULL_PROVENANCE';
      contract = CONTENT_HASH_CONTRACT_MARKDOWN_V1;
      sourceFidelity = SOURCE_FIDELITY_BYTE_EXACT;
    }

    // 1. Hash verification
    let hashVerification;
    let hashMatch = false;
    if (contract === CONTENT_HASH_CONTRACT_LEGACY_V0) {
      const computedLegacy = computeLegacyContentHashV0(art.content_md || '');
      if (computedLegacy === art.content_hash) {
        hashVerification = 'PASS_NORMALIZED_MATCH';
        hashMatch = true;
      } else {
        hashVerification = `FAIL_LEGACY_MISMATCH (computed: ${computedLegacy.substring(0, 8)}... !== stored: ${art.content_hash.substring(0, 8)}...)`;
      }
    } else {
      const computedModern = computeCanonicalContentHash(art.content_md || '');
      if (computedModern === art.content_hash) {
        hashVerification = 'PASS_BYTE_EXACT_MATCH';
        hashMatch = true;
      } else {
        hashVerification = `FAIL_MODERN_MISMATCH (computed: ${computedModern.substring(0, 8)}... !== stored: ${art.content_hash.substring(0, 8)}...)`;
      }
    }

    // 2. Approval verification
    let approvalState;
    let approvalMatch = false;
    if (provenanceClass === 'FULL_PROVENANCE') {
      if (approval && approval.approved_content_hash === art.content_hash) {
        approvalState = `FULL_MATCH (id:${approval.id})`;
        approvalMatch = true;
      } else if (!approval) {
        approvalState = 'MISSING_APPROVAL_RECORD';
      } else {
        approvalState = `HASH_MISMATCH (approved:${approval.approved_content_hash.substring(0, 8)}... !== art:${art.content_hash.substring(0, 8)}...)`;
      }
    } else {
      approvalState = 'NONE_PARTIAL_PROVENANCE';
      approvalMatch = true; // Not required for PARTIAL
    }

    // 3. Receipt verification
    let receiptState;
    let receiptMatch = false;
    if (provenanceClass === 'FULL_PROVENANCE') {
      if (receipt && receipt.content_hash === art.content_hash) {
        receiptState = `FULL_MATCH (${receipt.receipt_id})`;
        receiptMatch = true;
      } else if (!receipt) {
        receiptState = 'MISSING_RECEIPT';
      } else {
        receiptState = `HASH_MISMATCH (receipt:${receipt.content_hash.substring(0, 8)}... !== art:${art.content_hash.substring(0, 8)}...)`;
      }
    } else {
      receiptState = 'NONE_PARTIAL_PROVENANCE';
      receiptMatch = true; // Not required for PARTIAL
    }

    // 4. Version key
    const versionKey = buildPublicationVersionKey({
      provenanceClass,
      publicationReceiptId: receipt?.receipt_id || null,
      articleId,
      publishedContentHash: art.content_hash
    });

    // 5. Featured asset resolution
    const candidateAssetId = receipt?.featured_asset_id || activeMediaMap.get(articleId) || null;
    let candidateAssetSha = null;
    let featuredAssetState;
    if (candidateAssetId) {
      candidateAssetSha = mediaAssetMap.get(candidateAssetId) || null;
      featuredAssetState = candidateAssetSha ? `RESOLVED (${candidateAssetId})` : `SHA_UNRESOLVED (${candidateAssetId})`;
    } else {
      featuredAssetState = 'NONE_NULL';
    }

    // Snapshot construction
    const snapshot = {
      articleId,
      contentMarkdown: art.content_md || '',
      contentHash: art.content_hash,
      slug: art.slug,
      canonicalUrl: `https://rancangloka.com/${art.slug}`,
      approvedContentHash: approval?.approved_content_hash || null,
      approvedRecordedAt: approval?.created_at || null,
      featuredAssetId: candidateAssetId,
      featuredAssetSha256: candidateAssetSha,
      executionId: receipt?.execution_id || null,
      receiptId: receipt?.receipt_id || null,
      actualPublishedAt: receipt?.actual_published_at || null,
      historicalPublishedAt: provenanceClass === 'PARTIAL_HISTORICAL_PROVENANCE' ? art.published_at : null,
      provenanceClass,
      contentHashContract: contract,
      sourceFidelity
    };

    // Determine planned_action
    let plannedAction;
    let blockReason;

    if (!hashMatch) {
      plannedAction = 'BLOCKED_SOURCE_MISMATCH';
      blockReason = `Article ${articleId} content_md hash does not match stored content_hash`;
    } else if (!approvalMatch) {
      plannedAction = 'BLOCKED_PROVENANCE_MISMATCH';
      blockReason = `Article ${articleId} approval evidence is missing or mismatched for FULL_PROVENANCE`;
    } else if (!receiptMatch) {
      plannedAction = 'BLOCKED_PROVENANCE_MISMATCH';
      blockReason = `Article ${articleId} publication receipt is missing or mismatched for FULL_PROVENANCE`;
    } else {
      // Check existing row
      const existing = existingDnaMap.get(versionKey);
      if (existing) {
        const isIdentical =
          existing.article_id === articleId &&
          existing.published_content_hash === art.content_hash &&
          existing.content_hash_contract === contract &&
          existing.source_fidelity === sourceFidelity &&
          existing.publication_receipt_id === (snapshot.receiptId || null);

        if (isIdentical) {
          plannedAction = 'ALREADY_EXISTS_IDENTICAL';
        } else {
          plannedAction = 'BLOCKED_VERSION_CONFLICT';
          blockReason = `Existing DNA row '${existing.dna_id}' conflicts with snapshot fields`;
        }
      } else {
        plannedAction = 'WOULD_INSERT';
      }
    }

    plans.push({
      article_id: articleId,
      slug: art.slug,
      version_key: versionKey,
      provenance_class: provenanceClass,
      content_hash_contract: contract,
      source_fidelity: sourceFidelity,
      hash_verification: hashVerification,
      approval_state: approvalState,
      receipt_state: receiptState,
      featured_asset_state: featuredAssetState,
      planned_action: plannedAction,
      snapshot,
      block_reason: blockReason
    });
  }

  return plans;
}

/**
 * Runs the backfill utility with dry-run or dual-confirmed apply.
 */
export async function runPublicationDnaBackfill(options = {}) {
  const isApplyRequested = Boolean(options.apply);
  const isConfirmProvided = Boolean(options.confirm);

  // Write mode strictly requires BOTH --apply AND confirmation flag
  const isWriteMode = isApplyRequested && isConfirmProvided;

  const plans = await buildBackfillPlans(options.db);

  const allValid = plans.every(
    p => p.planned_action === 'WOULD_INSERT' || p.planned_action === 'ALREADY_EXISTS_IDENTICAL'
  );

  let insertedCount = 0;
  let alreadyExistsCount = 0;
  let blockedCount = 0;

  for (const p of plans) {
    if (p.planned_action === 'WOULD_INSERT') {
      if (isWriteMode && p.snapshot) {
        const insertRes = await materializePublicationDna(options.db, p.snapshot);
        if (insertRes.status === 'DNA_GENERATED') {
          insertedCount++;
        } else if (insertRes.status === 'DNA_ALREADY_EXISTS') {
          alreadyExistsCount++;
        } else {
          blockedCount++;
        }
      }
    } else if (p.planned_action === 'ALREADY_EXISTS_IDENTICAL') {
      alreadyExistsCount++;
    } else {
      blockedCount++;
    }
  }

  return {
    mode: isWriteMode ? 'APPLY' : 'DRY_RUN',
    plans,
    allValid,
    insertedCount,
    alreadyExistsCount,
    blockedCount
  };
}

/**
 * Formats dry-run output as a clean, concise ASCII table.
 */
export function formatDryRunTable(plans) {
  const headers = [
    'ArtID',
    'Slug',
    'VersionKey',
    'ProvClass',
    'Contract',
    'Fidelity',
    'HashVerify',
    'Approval',
    'Receipt',
    'FeaturedAsset',
    'PlannedAction'
  ];

  const rows = plans.map(p => [
    String(p.article_id),
    p.slug.length > 24 ? p.slug.substring(0, 21) + '...' : p.slug,
    p.version_key.length > 26 ? p.version_key.substring(0, 23) + '...' : p.version_key,
    p.provenance_class === 'FULL_PROVENANCE' ? 'FULL' : 'PARTIAL',
    p.content_hash_contract === 'canonical-markdown-sha256-v1' ? 'v1-markdown' : 'v0-legacy',
    p.source_fidelity === 'BYTE_EXACT_HASH_VERIFIED' ? 'BYTE_EXACT' : 'NORMALIZED',
    p.hash_verification.startsWith('PASS') ? 'PASS' : 'FAIL',
    p.approval_state.startsWith('FULL') ? 'VALID' : p.approval_state.startsWith('NONE') ? 'PARTIAL_OK' : 'MISMATCH',
    p.receipt_state.startsWith('FULL') ? 'VALID' : p.receipt_state.startsWith('NONE') ? 'PARTIAL_OK' : 'MISMATCH',
    p.featured_asset_state.startsWith('RESOLVED') ? 'RESOLVED' : p.featured_asset_state.startsWith('NONE') ? 'NONE' : 'UNRESOLVED',
    p.planned_action
  ]);

  // Calculate widths
  const widths = headers.map((h, i) => Math.max(h.length, ...rows.map(r => r[i].length)));

  const sep = '+-' + widths.map(w => '-'.repeat(w)).join('-+-') + '-+';
  const formatRow = (cols) =>
    '| ' + cols.map((c, i) => c.padEnd(widths[i])).join(' | ') + ' |';

  const output = [
    sep,
    formatRow(headers),
    sep,
    ...rows.map(r => formatRow(r)),
    sep
  ];

  return output.join('\n');
}

import { fileURLToPath } from 'node:url';
import path from 'node:path';

// CLI entry point
if (process.argv[1] && path.resolve(fileURLToPath(import.meta.url)) === path.resolve(process.argv[1])) {
  const args = process.argv.slice(2);
  const isRemote = args.includes('--remote');
  const isApply = args.includes('--apply');
  const isConfirm = args.includes('--confirm-production-dna-backfill');
  const dbFileArg = args.find(a => a.startsWith('--db-file='));
  const dbFilePath = dbFileArg ? dbFileArg.split('=')[1] : null;

  console.log('================================================================');
  console.log('RancangLoka Publication DNA Backfill (CONTENT_PROTECTION-1B-C)');
  console.log(`Execution Mode: ${isApply && isConfirm ? 'APPLY (WRITE)' : 'DRY RUN (READ-ONLY)'}`);
  console.log(`Target Scope:   article_id IN (5, 6, 7, 8, 9)`);
  console.log('================================================================\n');

  if (isRemote && isApply) {
    console.error('FATAL SAFETY VIOLATION: Production writes are strictly forbidden in this task.');
    console.error('Allowed production operations: SELECT, PRAGMA. Exiting.');
    process.exit(1);
  }

  let db;
  if (isRemote) {
    db = createRemoteWranglerAdapter('DB');
  } else if (dbFilePath) {
    const rawSqlite = new DatabaseSync(dbFilePath);
    db = {
      prepare(sql) {
        return {
          _sql: sql,
          _params: [],
          bind(...b) {
            this._params = b;
            return this;
          },
          all() {
            const stmt = rawSqlite.prepare(this._sql);
            return stmt.all(...this._params);
          },
          run() {
            const stmt = rawSqlite.prepare(this._sql);
            return stmt.run(...this._params);
          }
        };
      }
    };
  } else {
    // Default to remote read-only dry-run when executed directly from CLI without db-file
    console.log('[Backfill] Defaulting to Cloudflare D1 production read-only dry-run...');
    db = createRemoteWranglerAdapter('DB');
  }

  runPublicationDnaBackfill({ db, apply: isApply, confirm: isConfirm })
    .then(result => {
      console.log(formatDryRunTable(result.plans));
      console.log('\n--- Backfill Summary ---');
      console.log(`Mode:                   ${result.mode}`);
      console.log(`All Valid:              ${result.allValid ? 'YES (5 x WOULD_INSERT / ALREADY_EXISTS)' : 'NO (Blocked items detected)'}`);
      console.log(`Planned WOULD_INSERT:   ${result.plans.filter(p => p.planned_action === 'WOULD_INSERT').length}`);
      console.log(`Already Exists:         ${result.alreadyExistsCount}`);
      console.log(`Blocked Count:          ${result.blockedCount}`);

      if (!result.allValid) {
        console.error('\nBackfill dry-run detected blocked articles:');
        for (const p of result.plans.filter(p => p.planned_action.startsWith('BLOCKED'))) {
          console.error(`  - Article ${p.article_id}: ${p.planned_action} (${p.block_reason})`);
        }
        process.exit(1);
      }
    })
    .catch(err => {
      console.error('\nBackfill utility fatal error:', err);
      process.exit(1);
    });
}
