#!/usr/bin/env node
/**
 * ============================================================================
 * RancangLoka Product Decision Engine — Controlled Pilot Activation Utility
 * Milestone: PRODUCT_DECISION_ENGINE-1D
 *
 * Invariants:
 * 1. DEFAULT_MODE_IS_DRY_RUN (Zero mutation without explicit flags).
 * 2. EXPLICIT_PRODUCTION_GATES (Requires --remote, --apply, --confirm-production-pde-activation, --actor <name>).
 * 3. PRE_WRITE_REVALIDATION (Validates model, contracts, commerce firewall, and evidence freshness).
 * 4. IDEMPOTENT_ACTIVATION (Returns ALREADY_ACTIVE if model version is already active).
 * 5. EVIDENCE_IDENTITY_LOCK (Guarantees canonical Article 5 hash 142759... and snapshot eed64da...).
 * ============================================================================
 */

import fs from 'node:fs';
import path from 'node:path';
import { execSync } from 'node:child_process';
import { DECISION_MODEL_PILOT_KUSEN } from '../src/lib/product-decision/pilot-kusen.ts';
import {
  computeModelVersionKey,
  computeModelPayloadHash,
  serializeDecisionModel,
  insertDecisionModelVersion,
  activateDecisionModelVersion,
  getActiveDecisionModel,
  getDecisionModelByVersionKey
} from '../src/lib/product-decision/store.ts';
import {
  validateDecisionModel,
  extractAllModelBindings,
  deriveEvidenceFreshness,
  scanForForbiddenFields
} from '../src/lib/product-decision/contracts.ts';

const EXPECTED_SNAPSHOT_HASH = 'eed64da134be1b158d0a2985e3b43196f486eb4b86dd1fd9e95a5580655b3eed';
const EXPECTED_PAYLOAD_HASH = '1b7c9a2024cbc422015e3612a04077d47922f5dcf8a4d2dced5a309e89bfe9a0';
const CANONICAL_ARTICLE_5_HASH = '14275912029058f33a907831c8bf4d081129f7470f572305c861c6d46c5e5277';
const DATABASE_BINDING = 'rancangloka_db';

function parseWranglerJson(raw) {
  const jsonStart = raw.indexOf('[');
  const jsonEnd = raw.lastIndexOf(']');
  if (jsonStart !== -1 && jsonEnd !== -1 && jsonEnd > jsonStart) {
    return JSON.parse(raw.substring(jsonStart, jsonEnd + 1));
  }
  const objStart = raw.indexOf('{');
  const objEnd = raw.lastIndexOf('}');
  if (objStart !== -1 && objEnd !== -1 && objEnd > objStart) {
    return JSON.parse(raw.substring(objStart, objEnd + 1));
  }
  return JSON.parse(raw);
}

function formatSqlWithParams(sql, boundParams) {
  if (!boundParams || boundParams.length === 0) return sql;
  const parts = sql.split('?');
  if (parts.length - 1 !== boundParams.length) {
    throw new Error(`Parameter count mismatch: SQL has ${parts.length - 1} placeholders, but ${boundParams.length} params were passed.`);
  }
  let result = parts[0];
  for (let i = 0; i < boundParams.length; i++) {
    const param = boundParams[i];
    let valStr;
    if (param === null || param === undefined) {
      valStr = 'NULL';
    } else if (typeof param === 'number') {
      valStr = String(param);
    } else {
      valStr = `'${String(param).replace(/'/g, "''")}'`;
    }
    result += valStr + parts[i + 1];
  }
  return result;
}

function createRemoteD1Client() {
  return {
    prepare(sql) {
      let boundParams = [];
      return {
        bind(...args) {
          boundParams = args.map(v => v === undefined ? null : v);
          return this;
        },
        async all() {
          const formattedSql = formatSqlWithParams(sql, boundParams);
          const cleanSql = formattedSql.replace(/\s+/g, ' ').trim();
          const escapedCommand = cleanSql.replace(/"/g, '\\"');
          const cmd = `npx wrangler d1 execute ${DATABASE_BINDING} --remote --json --command "${escapedCommand}"`;
          const raw = execSync(cmd, { encoding: 'utf8', maxBuffer: 25 * 1024 * 1024 });
          const parsed = parseWranglerJson(raw);
          if (parsed.error) {
            throw new Error(parsed.error.text || JSON.stringify(parsed.error));
          }
          if (parsed[0] && Array.isArray(parsed[0].results)) {
            return parsed[0].results;
          }
          if (Array.isArray(parsed.results)) {
            return parsed.results;
          }
          return [];
        },
        async first() {
          const results = await this.all();
          return results[0] || null;
        },
        async run() {
          const formattedSql = formatSqlWithParams(sql, boundParams);
          const tempFile = path.resolve(process.cwd(), `.temp_d1_run_${Date.now()}_${Math.random().toString(36).substring(2, 8)}.sql`);
          try {
            fs.writeFileSync(tempFile, formattedSql, 'utf8');
            const cmd = `npx wrangler d1 execute ${DATABASE_BINDING} --remote --file="${tempFile}"`;
            execSync(cmd, { encoding: 'utf8', maxBuffer: 25 * 1024 * 1024 });
            return {
              success: true,
              meta: {
                changes: 1,
                last_row_id: 1
              }
            };
          } finally {
            if (fs.existsSync(tempFile)) {
              fs.unlinkSync(tempFile);
            }
          }
        }
      };
    }
  };
}

async function main() {
  const args = process.argv.slice(2);
  const isRemote = args.includes('--remote');
  const isApply = args.includes('--apply');
  const isConfirm = args.includes('--confirm-production-pde-activation');
  const actorIdx = args.indexOf('--actor');
  const actor = actorIdx !== -1 && args[actorIdx + 1] ? args[actorIdx + 1] : null;

  console.log('================================================================');
  console.log('RancangLoka Product Decision Engine Pilot Activation Utility');
  console.log('Milestone: PRODUCT_DECISION_ENGINE-1D');
  console.log('================================================================');

  // Hard safety gates for production mutation
  if (isApply) {
    if (!isRemote) {
      console.error('\n[BLOCKED] --apply currently only supported with explicit --remote target.');
      process.exit(1);
    }
    if (!isConfirm) {
      console.error('\n[BLOCKED] Remote production activation requires explicit --confirm-production-pde-activation flag.');
      process.exit(1);
    }
    if (!actor || actor.trim() === '') {
      console.error('\n[BLOCKED] Remote production activation requires explicit --actor <name> flag (e.g. --actor chief_editor).');
      process.exit(1);
    }
  }

  const model = DECISION_MODEL_PILOT_KUSEN;
  const versionKey = computeModelVersionKey(model.model_id, model.model_version, model.criteria_version);
  const payloadHash = computeModelPayloadHash(model);
  const bindings = extractAllModelBindings(model);

  console.log(`\nModel Identifier : ${model.model_id}`);
  console.log(`Model Version    : ${model.model_version}`);
  console.log(`Criteria Version : ${model.criteria_version}`);
  console.log(`Canonical Key    : ${versionKey}`);
  console.log(`Problem ID       : ${model.problem.problem_id}`);
  console.log(`Problem Title    : ${model.problem.title}`);
  console.log(`Primary Article  : ID ${model.problem.primary_article_id} (/${model.problem.canonical_slug})`);
  console.log(`Snapshot Hash    : ${model.evidence_snapshot_hash}`);
  console.log(`Payload Hash     : ${payloadHash}`);
  console.log(`Evidence Bindings: ${bindings.length} canonical references`);

  // 1. Validation Check
  const validation = validateDecisionModel(model);
  if (!validation.valid) {
    console.error('\nStatus: BLOCKED_VALIDATION_FAILED');
    for (const issue of validation.issues) {
      console.error(` - [${issue.code}] ${issue.field}: ${issue.message}`);
    }
    process.exit(1);
  }

  // 2. Hash integrity check
  if (model.evidence_snapshot_hash !== EXPECTED_SNAPSHOT_HASH) {
    console.error(`\n[BLOCKED_HASH_MISMATCH] Evidence snapshot hash mismatch: declared=${model.evidence_snapshot_hash}, expected=${EXPECTED_SNAPSHOT_HASH}`);
    process.exit(1);
  }
  if (payloadHash !== EXPECTED_PAYLOAD_HASH) {
    console.error(`\n[BLOCKED_PAYLOAD_MISMATCH] Model payload hash mismatch: computed=${payloadHash}, expected=${EXPECTED_PAYLOAD_HASH}`);
    process.exit(1);
  }

  // 3. Article 5 evidence binding check
  for (const b of bindings) {
    if (b.article_id === 5) {
      if (b.published_content_hash !== CANONICAL_ARTICLE_5_HASH) {
        console.error(`\n[BLOCKED_ARTICLE_5_HASH] Binding hash ${b.published_content_hash} does not match canonical ${CANONICAL_ARTICLE_5_HASH}`);
        process.exit(1);
      }
      if (b.published_content_hash.includes('23d1')) {
        console.error('\n[BLOCKED_CORRUPT_HASH] Corrupt hash 23d1 detected in evidence bindings.');
        process.exit(1);
      }
    }
  }

  // 4. Commerce Firewall Check
  const serialized = serializeDecisionModel(model);
  const commerceViolations = scanForForbiddenFields(serialized);
  if (commerceViolations.length > 0) {
    console.error('\n[BLOCKED_COMMERCE_FIREWALL] Forbidden commercial attributes found in serialized row:');
    for (const cv of commerceViolations) {
      console.error(` - ${cv.field}: ${cv.message}`);
    }
    process.exit(1);
  }

  // If not applying, output dry-run report
  if (!isApply) {
    console.log('\n----------------------------------------------------------------');
    console.log('EXECUTION MODE: DRY RUN (NO_MUTATION)');
    console.log('Status        : WOULD_INSERT');
    console.log('Next Action   : Ready for controlled remote activation.');
    console.log('----------------------------------------------------------------\n');
    return;
  }

  // ==========================================================================
  // PRODUCTION REMOTE ACTIVATION
  // ==========================================================================
  console.log('\n----------------------------------------------------------------');
  console.log('EXECUTION MODE: REMOTE PRODUCTION MUTATION');
  console.log(`Database      : ${DATABASE_BINDING}`);
  console.log(`Actor         : ${actor}`);
  console.log('----------------------------------------------------------------');

  const remoteDb = createRemoteD1Client();

  // Freshness check against remote production D1
  console.log('\n[Phase 1] Querying authoritative Article 5 DNA from production D1...');
  const dnaRows = await remoteDb.prepare(`
    SELECT article_id, version_key, published_content_hash, source_fidelity
    FROM article_dna_signatures
    WHERE article_id = ?
  `).bind(5).all();

  console.log(`Found ${dnaRows.length} Article 5 Publication DNA record(s) in production D1.`);
  if (!dnaRows || dnaRows.length === 0) {
    console.error('[BLOCKED_EVIDENCE_UNAVAILABLE] Article 5 Publication DNA row not found in production D1.');
    process.exit(1);
  }

  const authoritativeMap = new Map();
  for (const r of dnaRows) {
    authoritativeMap.set(r.version_key, { published_content_hash: r.published_content_hash });
  }

  const freshness = deriveEvidenceFreshness(bindings, authoritativeMap);
  console.log(`Evidence Freshness State: ${freshness}`);
  if (freshness !== 'CURRENT') {
    console.error(`[BLOCKED_EVIDENCE_NOT_FRESH] Production evidence state is '${freshness}'. Expected 'CURRENT'.`);
    process.exit(1);
  }

  // Check if target model version already exists and is already ACTIVE (Idempotency)
  console.log('\n[Phase 2] Checking existing model versions in production D1...');
  const existingActive = await getActiveDecisionModel(remoteDb, model.model_id);
  if (existingActive && existingActive.row.version_key === versionKey) {
    console.log(`\n================================================================`);
    console.log(`IDEMPOTENCY CONFIRMED: Version ${versionKey} is ALREADY_ACTIVE in production.`);
    console.log(`Activated at: ${existingActive.row.activated_at} by ${existingActive.row.activated_by}`);
    console.log(`Zero duplicate mutation performed.`);
    console.log(`================================================================\n`);
    return;
  }

  // Check if model row exists
  const existingRow = await remoteDb.prepare(`
    SELECT version_key, status, model_payload_hash FROM decision_models WHERE version_key = ?
  `).bind(versionKey).first();

  if (!existingRow) {
    console.log(`\n[Phase 3] Inserting decision model version ${versionKey}...`);
    const insertRes = await insertDecisionModelVersion(remoteDb, model, 'VALIDATED');
    console.log(`Insert result: ${insertRes.status} (key: ${insertRes.version_key})`);
  } else {
    console.log(`Model version row ${versionKey} already exists with status: ${existingRow.status}`);
  }

  // Activate model version
  console.log(`\n[Phase 4] Activating decision model version ${versionKey} by ${actor}...`);
  const activateRes = await activateDecisionModelVersion(remoteDb, {
    version_key: versionKey,
    actor,
    rationale: 'Chief Editor authorized production activation (PDE-1D)',
    authoritativeEvidenceMap: authoritativeMap
  });

  if (!activateRes.ok) {
    console.error(`\n[ACTIVATION_FAILED] Activation failed with status: ${activateRes.status}`);
    if (activateRes.error) console.error(`Error: ${activateRes.error}`);
    process.exit(1);
  }

  console.log(`\n================================================================`);
  console.log(`SUCCESS: Model version ${versionKey} is now ACTIVE in production!`);
  console.log(`Activation status : ${activateRes.status}`);
  console.log(`Prior version key : ${activateRes.prior_version_key || 'NONE (Initial Activation)'}`);
  console.log(`Actor             : ${actor}`);
  console.log(`================================================================\n`);
}

main().catch(err => {
  console.error('[FATAL_ERROR]', err);
  process.exit(1);
});
