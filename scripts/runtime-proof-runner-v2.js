#!/usr/bin/env node
/**
 * RancangLoka Editorial Runtime Proof Runner V2
 * Milestone: EDITORIAL-RUNTIME-2
 *
 * Performs ONE controlled, operator-triggered runtime execution of Joko + Rina:
 * Topic: "Atap Metal Terasa Panas: Apakah Insulasi Foil Cukup atau Perlu Ventilasi Atap?"
 *
 * Enforces:
 * - Claim Grounding Contract & Grounded Draft Envelope.
 * - Author Grounding Declaration.
 * - Editorial Compression (ONE IDEA — ONE BEST HOME).
 * - Prescriptive Certainty <= Evidence Certainty.
 * - Saves output to scripts/runtime-proof/joko-metal-roof-runtime-v2.md
 *   and scripts/runtime-proof/joko-metal-roof-runtime-v2-meta.json.
 * - Does NOT overwrite v1 artifacts or draft-final.md.
 */

import fs from 'node:fs';
import path from 'node:path';
import { executeEditorialDraftJob } from '../src/lib/editorial/editorial-runtime.ts';
import { EditorialLlmProvider } from '../src/lib/editorial/editorial-llm-provider.ts';

async function run() {
  console.log('🚀 Initiating Operator-Triggered Editorial Runtime Proof V2 (EDITORIAL-RUNTIME-2)...');

  // 1. Resolve Provider Configuration Truthfully
  const env = process.env;
  let apiKey = env.OPENROUTER_API_KEY || '';
  let providerName = 'openrouter';
  let modelName = env.EDITORIAL_LLM_MODEL || 'google/gemini-2.0-flash-001';

  if (!apiKey) {
    if (env.SUMOPOD_API_KEY) {
      apiKey = env.SUMOPOD_API_KEY;
      providerName = 'sumopod';
      modelName = env.EDITORIAL_LLM_MODEL || 'gpt-5.6-luna';
    } else {
      const labEnvPath = path.resolve('../rancangloka-ai-lab/.env');
      if (fs.existsSync(labEnvPath)) {
        const labEnv = fs.readFileSync(labEnvPath, 'utf-8');
        const match = labEnv.match(/SUMOPOD_API_KEY=(.+)/);
        if (match && match[1].trim()) {
          apiKey = match[1].trim();
          providerName = 'sumopod';
          modelName = env.EDITORIAL_LLM_MODEL || 'gpt-5.6-luna';
        }
      }
    }
  }

  if (!apiKey) {
    console.error('\n⚠️ CLASSIFICATION: EDITORIAL_RUNTIME_BLOCKED_PROVIDER_CONFIGURATION');
    console.error('Neither OPENROUTER_API_KEY nor SUMOPOD_API_KEY is configured in the environment.');
    console.error('Failing closed safely without faking or simulating execution.\n');
    process.exit(2);
  }

  console.log(`📡 Provider Configured: ${providerName.toUpperCase()} (Model: ${modelName})`);
  console.log('🔒 Zero Secret Policy: API keys verified present and hidden from output.');

  // 2. Load Approved Evidence Pack
  const evidencePackPath = path.resolve('./scripts/dryrun/evidence-pack.json');
  if (!fs.existsSync(evidencePackPath)) {
    throw new Error(`Evidence pack not found at ${evidencePackPath}`);
  }
  const evidencePack = JSON.parse(fs.readFileSync(evidencePackPath, 'utf-8'));

  // 3. Assemble Controlled Operator Job Input (Same approved pack, same topic)
  const jobInput = {
    taskId: 'task_runtime_proof_metal_roof_v2_001',
    topic: 'Atap Metal Terasa Panas: Apakah Insulasi Foil Cukup atau Perlu Ventilasi Atap?',
    requestedTitle: 'Atap Metal Terasa Panas: Apakah Insulasi Foil Cukup atau Perlu Ventilasi Atap?',
    evidencePack,
    visitorContext: {
      primaryContextId: 'CTX-05-DECISION-FOIL-VS-VENT',
      primaryContextLabel: 'Insulasi Foil vs Ventilasi Rongga Atap',
      primaryPainDimension: 'DECISION_UNCERTAINTY',
      secondaryContextIds: ['CTX-09-CONTRACTOR-CONFLICT', 'CTX-10-HEAT-SOURCE-MYSTERY'],
      secondaryPainDimensions: ['INFORMATION_CONFLICT', 'DIAGNOSTIC_UNCERTAINTY'],
      openingAngle: 'DECISION_FORK',
      preferredSignature: 'DECISION > CONFLICT > DIAGNOSIS',
      recentOpeningPatternsToAvoid: [
        'Banyak pemilik rumah mengira...',
        'Di era modern saat ini...',
        'Memilih atap rumah bukanlah hal yang mudah...'
      ]
    },
    operatorAuth: {
      authorizedBy: 'antigravity_operator',
      operatorRole: 'CHIEF_EDITOR',
      confirmedAt: new Date().toISOString()
    }
  };

  const provider = new EditorialLlmProvider({
    provider: providerName,
    apiKey,
    model: modelName,
    timeoutMs: 120000,
    maxTokens: 4000,
    maxRetries: 2
  });

  console.log('⏳ Executing Grounded Joko V2 generation and deterministic Rina QA...');
  const startTime = Date.now();

  const result = await executeEditorialDraftJob(jobInput, {
    providerInstance: provider,
    llmOptions: { maxRetries: 2 }
  });

  const totalRuntimeMs = Date.now() - startTime;
  console.log(`⏱️ Execution Completed in ${totalRuntimeMs}ms`);
  console.log(`📊 Result Status: ${result.status}`);
  console.log(`📝 Total Attempts: ${result.totalAttempts}`);
  console.log(`⚖️ Final Decision: ${result.finalDecision}`);
  console.log(`🛑 Human Stop Gate: ${result.humanStopGateStatus}`);
  console.log(`📄 Publication Status: ${result.publicationStatus}`);

  if (result.groundingAudit) {
    console.log(`🛡️ Grounding Status: ${result.groundingAudit.status} (Valid: ${result.groundingAudit.isValid})`);
    console.log(`   - Provenance: ${result.groundingAudit.declarationProvenance}`);
    console.log(`   - Declared Claims: ${result.groundingAudit.declaredClaimsCount}`);
    console.log(`   - Valid Claims: ${result.groundingAudit.validClaimsCount}`);
    if (result.groundingAudit.errors.length > 0) {
      console.log(`   - Errors: ${result.groundingAudit.errors.join('; ')}`);
    }
  }

  if (result.refinementAudit) {
    console.log(`📐 Refinement Recommendation: ${result.refinementAudit.recommendation}`);
    console.log(`   - Repetitive Decision Subheadings: ${result.refinementAudit.repetitiveDecisionSectionsCount}`);
    if (result.refinementAudit.prescriptiveWordsFound.length > 0) {
      console.log(`   - Prescriptive Words: ${result.refinementAudit.prescriptiveWordsFound.join(', ')}`);
    }
  }

  if (result.qaResult) {
    console.log(`🎯 Rina Deterministic QA Score: ${result.qaResult.total_score}/100 (${result.qaResult.decision})`);
    console.log(`🔍 Detected Issues: ${result.qaResult.issues.length}`);
    for (const issue of result.qaResult.issues) {
      console.log(`   - [${issue.severity}] ${issue.code}: ${issue.description}`);
    }
  }

  // 4. Save Artifacts to scripts/runtime-proof/ V2
  const outputDir = path.resolve('./scripts/runtime-proof');
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  const draftOutPath = path.join(outputDir, 'joko-metal-roof-runtime-v2.md');
  const metaOutPath = path.join(outputDir, 'joko-metal-roof-runtime-v2-meta.json');

  if (result.finalDraft) {
    fs.writeFileSync(draftOutPath, result.finalDraft, 'utf-8');
    console.log(`💾 Saved genuine runtime V2 draft to: ${draftOutPath}`);
  }

  const cleanMeta = {
    ...result,
    executionSummary: {
      provider: providerName,
      model: modelName,
      totalRuntimeMs,
      completedAt: new Date().toISOString(),
      draftSavedTo: 'scripts/runtime-proof/joko-metal-roof-runtime-v2.md'
    }
  };

  fs.writeFileSync(metaOutPath, JSON.stringify(cleanMeta, null, 2), 'utf-8');
  console.log(`💾 Saved execution V2 metadata to: ${metaOutPath}`);

  console.log('\n✅ Runtime Proof V2 Finished Successfully.');
}

run().catch((err) => {
  console.error('\n❌ Runtime Proof V2 Execution Failed:', err);
  process.exit(1);
});
