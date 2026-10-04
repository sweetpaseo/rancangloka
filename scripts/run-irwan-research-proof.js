#!/usr/bin/env node
/**
 * RancangLoka Irwan Real Research Proof Runner
 * Milestone: EDITORIAL-RUNTIME-3
 *
 * Performs ONE controlled, operator-triggered research runtime execution:
 * Topic: "Atap Metal Terasa Panas: Apakah Insulasi Foil Cukup atau Perlu Ventilasi Atap?"
 *
 * Invariants:
 * - Real source discovery via CrossRef Open API & Wikipedia Technical API.
 * - Real source retrieval, SHA-256 hash generation, and passage extraction.
 * - Truthful barrier classification (paywalls, portal restrictions).
 * - Exact numbers policy: unsupported numbers removed from author-safe claims.
 * - Stops at RESEARCH_HUMAN_REVIEW_REQUIRED.
 * - Does NOT invoke Joko. Does NOT overwrite previous dry-run Evidence Pack.
 * - Saves artifacts to:
 *   scripts/runtime-proof/irwan-metal-roof-evidence-pack.json
 *   scripts/runtime-proof/irwan-metal-roof-runtime-meta.json
 */

import fs from 'node:fs';
import path from 'node:path';
import { executeEditorialResearchJob } from '../src/lib/editorial/irwan-research-runtime.ts';

async function run() {
  console.log('🚀 Initiating Operator-Triggered Real Irwan Research Proof (EDITORIAL-RUNTIME-3)...');

  // 1. Operator Authorization
  const jobInput = {
    taskId: 'task_runtime_proof_irwan_research_001',
    topic: 'Atap Metal Terasa Panas: Apakah Insulasi Foil Cukup atau Perlu Ventilasi Atap?',
    operatorAuth: {
      authorizedBy: 'antigravity_operator',
      operatorRole: 'CHIEF_EDITOR',
      timestamp: new Date().toISOString()
    }
  };

  console.log(`📡 Topic: "${jobInput.topic}"`);
  console.log(`👤 Operator: ${jobInput.operatorAuth.authorizedBy} (${jobInput.operatorAuth.operatorRole})`);
  console.log('⏳ Executing Irwan research runtime (Discovery -> Retrieval -> Reading -> Extraction -> Packaging)...');

  const startTime = Date.now();
  const result = await executeEditorialResearchJob(jobInput);
  const totalMs = Date.now() - startTime;

  console.log(`⏱️ Research Completed in ${totalMs}ms`);
  console.log(`📊 Result Status: ${result.status}`);
  console.log(`🛑 Final Gate Status: ${result.finalGateStatus}`);
  console.log('\n📈 Operational Statistics:');
  console.log(`   - Kueri Dijalankan: ${result.stats.queriesExecuted}`);
  console.log(`   - Sumber Ditemukan: ${result.stats.sourcesDiscovered}`);
  console.log(`   - Dokumen Diunduh & Terinspeksi: ${result.stats.sourcesRetrieved}`);
  console.log(`   - Dokumen Tertahan Akses (Paywall/Portal): ${result.stats.sourcesBlocked}`);
  console.log(`   - Bukti/Kutipan Diekstrak: ${result.stats.passagesExtracted}`);
  console.log(`   - Total Klaim: ${result.stats.claimsTotal}`);
  console.log(`   - Klaim Terverifikasi: ${result.stats.claimsVerified}`);
  console.log(`   - Klaim Aman Penulis: ${result.stats.authorSafeClaimsTotal}`);

  if (result.retrievedDocuments.length > 0) {
    const doc = result.retrievedDocuments[0];
    console.log(`\n📄 Sample Retrieved Document: "${doc.title}"`);
    console.log(`   - Publisher: ${doc.publisher}`);
    console.log(`   - URL: ${doc.url}`);
    console.log(`   - Hash (SHA-256): ${doc.content_hash}`);
    console.log(`   - Ukuran: ${doc.content_length_bytes} bytes`);
    console.log(`   - Kutipan Diekstrak: ${doc.extracted_passages.length}`);
  }

  // 2. Save Artifacts
  const outputDir = path.resolve('./scripts/runtime-proof');
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  const packOutPath = path.join(outputDir, 'irwan-metal-roof-evidence-pack.json');
  const metaOutPath = path.join(outputDir, 'irwan-metal-roof-runtime-meta.json');

  fs.writeFileSync(packOutPath, JSON.stringify(result.evidencePack, null, 2), 'utf-8');
  console.log(`\n💾 Saved genuine Irwan Evidence Pack to: ${packOutPath}`);

  const cleanMeta = {
    jobId: result.jobId,
    taskId: result.taskId,
    status: result.status,
    finalGateStatus: result.finalGateStatus,
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
      packSavedTo: 'scripts/runtime-proof/irwan-metal-roof-evidence-pack.json'
    }
  };

  fs.writeFileSync(metaOutPath, JSON.stringify(cleanMeta, null, 2), 'utf-8');
  console.log(`💾 Saved genuine Irwan runtime metadata to: ${metaOutPath}`);

  console.log('\n✅ Irwan Research Proof Finished Successfully.');
  console.log('🛑 Halted safely at: RESEARCH_HUMAN_REVIEW_REQUIRED. Joko has NOT been invoked.');
}

run().catch(err => {
  console.error('\n❌ Irwan Research Proof Failed:', err);
  process.exit(1);
});
