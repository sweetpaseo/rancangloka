#!/usr/bin/env node
/**
 * RancangLoka Irwan Real Research Proof Runner V2 (Hardened Evidence Provenance)
 * Milestone: EDITORIAL-RUNTIME-3A
 *
 * Performs ONE controlled, operator-triggered research runtime execution:
 * Topic: "Atap Metal Terasa Panas: Apakah Insulasi Foil Cukup atau Perlu Ventilasi Atap?"
 *
 * Upgrades in V2:
 * - Truthful Wikipedia metadata (Radiant barrier, Wikimedia Foundation, ENCYCLOPEDIC_SECONDARY_SOURCE).
 * - Upgraded primary source: U.S. Department of Energy (DOE / Building Technologies Office).
 * - Persistent top-level evidence_passages with SHA-256 hashes and claim links.
 * - Strict NO_SOURCE = NO_VERIFIED_STATUS (CLM-007B is PARTIALLY_SUPPORTED).
 * - Split atomic claims: CLM-001A (low thermal mass), CLM-001B (conductivity), CLM-007A (dust), CLM-007B (ventilation mesh).
 * - Conservative radiation wording for CLM-002 ("salah satu jalur utama").
 * - Editorial recommendation CLM-008 derived from physical claims, not labeled VERIFIED_FACT.
 * - Dynamic overall confidence calculation based on source quality & passage coverage.
 * - Stops at: IRWAN_EVIDENCE_V2_HUMAN_REVIEW_REQUIRED.
 * - Does NOT invoke Joko. Does NOT publish. Does NOT deploy.
 * - Saves artifacts to:
 *   scripts/runtime-proof/irwan-metal-roof-evidence-pack-v2.json
 *   scripts/runtime-proof/irwan-metal-roof-runtime-v2-meta.json
 */

import fs from 'node:fs';
import path from 'node:path';
import { executeEditorialResearchJob } from '../src/lib/editorial/irwan-research-runtime.ts';

async function run() {
  console.log('🚀 Initiating Operator-Triggered Real Irwan Research Proof V2 (EDITORIAL-RUNTIME-3A)...');

  // 1. Operator Authorization
  const jobInput = {
    taskId: 'task_runtime_proof_irwan_research_v2_001',
    topic: 'Atap Metal Terasa Panas: Apakah Insulasi Foil Cukup atau Perlu Ventilasi Atap?',
    milestone: 'EDITORIAL-RUNTIME-3A',
    expectedFinalGate: 'IRWAN_EVIDENCE_V2_HUMAN_REVIEW_REQUIRED',
    operatorAuth: {
      authorizedBy: 'antigravity_operator',
      operatorRole: 'CHIEF_EDITOR',
      timestamp: new Date().toISOString()
    }
  };

  console.log(`📡 Topic: "${jobInput.topic}"`);
  console.log(`👤 Operator: ${jobInput.operatorAuth.authorizedBy} (${jobInput.operatorAuth.operatorRole})`);
  console.log('⏳ Executing Irwan research runtime V2 (Discovery -> Retrieval -> Reading -> Extraction -> Packaging)...');

  const startTime = Date.now();
  const result = await executeEditorialResearchJob(jobInput);
  const totalMs = Date.now() - startTime;

  console.log(`⏱️ Research Completed in ${totalMs}ms`);
  console.log(`📊 Result Status: ${result.status}`);
  console.log(`🛑 Final Gate Status: ${result.finalGateStatus}`);
  console.log(`🔒 Human Review Status: ${result.humanReviewStatus}`);
  console.log(`🎯 Overall Confidence: ${result.evidencePack.confidence_overall}`);
  console.log('\n📈 Operational Statistics:');
  console.log(`   - Kueri Dijalankan: ${result.stats.queriesExecuted}`);
  console.log(`   - Sumber Ditemukan: ${result.stats.sourcesDiscovered}`);
  console.log(`   - Dokumen Diunduh & Terinspeksi: ${result.stats.sourcesRetrieved}`);
  console.log(`   - Dokumen Tertahan Akses (Paywall/Portal): ${result.stats.sourcesBlocked}`);
  console.log(`   - Bukti/Kutipan Diekstrak: ${result.stats.passagesExtracted}`);
  console.log(`   - Total Klaim: ${result.stats.claimsTotal}`);
  console.log(`   - Klaim Terverifikasi: ${result.stats.claimsVerified}`);
  console.log(`   - Klaim Konsensus Teknikal: ${result.stats.claimsConsensus}`);
  console.log(`   - Klaim Aman Penulis: ${result.stats.authorSafeClaimsTotal}`);

  console.log('\n📄 Retrieved & Verified Sources:');
  for (const doc of result.retrievedDocuments) {
    console.log(`   • [${doc.source_id}] "${doc.title}"`);
    console.log(`     - Klasifikasi: ${doc.source_classification} (${doc.primary_vs_secondary})`);
    console.log(`     - Otoritas: ${doc.authority_level}`);
    console.log(`     - Publisher: ${doc.publisher}`);
    console.log(`     - Canonical URL: ${doc.canonical_url || doc.url}`);
    console.log(`     - Hash SHA-256: ${doc.content_hash?.slice(0, 16)}...`);
    console.log(`     - Kutipan Diekstrak: ${doc.extracted_passages.length}`);
  }

  // 2. Save Artifacts
  const outputDir = path.resolve('./scripts/runtime-proof');
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  const packOutPath = path.join(outputDir, 'irwan-metal-roof-evidence-pack-v2.json');
  const metaOutPath = path.join(outputDir, 'irwan-metal-roof-runtime-v2-meta.json');

  fs.writeFileSync(packOutPath, JSON.stringify(result.evidencePack, null, 2), 'utf-8');
  console.log(`\n💾 Saved hardened Irwan Evidence Pack V2 to: ${packOutPath}`);

  const cleanMeta = {
    jobId: result.jobId,
    taskId: result.taskId,
    status: result.status,
    finalGateStatus: result.finalGateStatus,
    humanReviewStatus: result.humanReviewStatus,
    topic: result.topic,
    researchRuntime: result.researchRuntime,
    stats: result.stats,
    discoveredSourcesCount: result.discoveredSources.length,
    retrievedDocumentsCount: result.retrievedDocuments.length,
    blockedSourcesCount: result.blockedSources.length,
    traceEvents: result.traceEvents,
    executionSummary: {
      totalMs,
      completedAt: new Date().toISOString(),
      packSavedTo: 'scripts/runtime-proof/irwan-metal-roof-evidence-pack-v2.json'
    }
  };

  fs.writeFileSync(metaOutPath, JSON.stringify(cleanMeta, null, 2), 'utf-8');
  console.log(`💾 Saved genuine Irwan runtime V2 metadata to: ${metaOutPath}`);

  console.log('\n✅ Irwan Research Proof V2 Finished Successfully.');
  console.log('🛑 Halted safely at: IRWAN_EVIDENCE_V2_HUMAN_REVIEW_REQUIRED.');
  console.log('🔒 Publication authority: 0. AUTO_PUBLISH: OFF. Joko has NOT been invoked.');
}

run().catch(err => {
  console.error('\n❌ Irwan Research Proof V2 Failed:', err);
  process.exit(1);
});
