#!/usr/bin/env node
/**
 * RancangLoka Irwan Real Research Proof Runner V3-Stabilized (Claim Entailment & Author-Safe Integrity)
 * Milestone: EDITORIAL-RUNTIME-3B-STABILIZE
 *
 * Performs ONE controlled, operator-triggered research runtime execution:
 * Topic: "Atap Metal Terasa Panas: Apakah Insulasi Foil Cukup atau Perlu Ventilasi Atap?"
 *
 * Upgrades in V3-Stabilized:
 * - REMOVE KNOWN INVALID LINKS: Stripped psg_SRC-OPEN-WIKI-RADBAR_4 (Walls) from CLM-001A, CLM-001B, CLM-007A.
 * - REASSESS CLM-001A: Conservative physical proposition without unproven "massa termal sangat rendah" claim.
 * - REASSESS CLM-001B: Conservative thickness conduction proposition without unproven "konduktivitas tinggi" claim.
 * - ATOMIC CLAIM SPLIT CLM-004: Split into CLM-004A (Radiant reflection vs bulk insulation) and CLM-004B (Air space requirement).
 * - CLEAN CLM-007A: Mapped strictly to authentic dust passages (psg_SRC-OPEN-WIKI-RADBAR_3 and psg_SRC-OPEN-DOE-RADBAR_4).
 * - TIGHTEN CLM-006: Attic ventilation exhaust without unverified "seimbang" ratios or "sopi-sopi" equivalences.
 * - RECOMPUTE CLM-008: Scenario-qualified recommendation derived exclusively from author-safe claims, banning unjustified absolutes.
 * - SEMANTIC SUPPORT CONTRACT: Constrained passage roles strictly matching claim consume allowances.
 * - Stops at: IRWAN_EVIDENCE_V3_STABILIZED_HUMAN_REVIEW_REQUIRED.
 * - Does NOT invoke Joko. Does NOT publish. Does NOT deploy.
 * - Saves artifacts to:
 *   scripts/runtime-proof/irwan-metal-roof-evidence-pack-v3-stabilized.json
 *   scripts/runtime-proof/irwan-metal-roof-runtime-v3-stabilized-meta.json
 */

import fs from 'node:fs';
import path from 'node:path';
import { executeEditorialResearchJob } from '../src/lib/editorial/irwan-research-runtime.ts';
import { auditEvidencePackProvenance } from '../src/lib/article/human-quality.ts';

async function run() {
  console.log('🚀 Initiating Operator-Triggered Real Irwan Research Proof V3-Stabilized (EDITORIAL-RUNTIME-3B-STABILIZE)...');

  // 1. Operator Authorization
  const jobInput = {
    taskId: 'task_runtime_proof_irwan_research_v3_stabilized_001',
    topic: 'Atap Metal Terasa Panas: Apakah Insulasi Foil Cukup atau Perlu Ventilasi Atap?',
    milestone: 'EDITORIAL-RUNTIME-3B-STABILIZE',
    expectedFinalGate: 'IRWAN_EVIDENCE_V3_STABILIZED_HUMAN_REVIEW_REQUIRED',
    operatorAuth: {
      authorizedBy: 'antigravity_operator',
      operatorRole: 'CHIEF_EDITOR',
      timestamp: new Date().toISOString()
    }
  };

  console.log(`📡 Topic: "${jobInput.topic}"`);
  console.log(`👤 Operator: ${jobInput.operatorAuth.authorizedBy} (${jobInput.operatorAuth.operatorRole})`);
  console.log('⏳ Executing Irwan research runtime V3-Stabilized (Entailment Boundary Enforcement)...');

  const startTime = Date.now();
  const result = await executeEditorialResearchJob(jobInput);
  const totalMs = Date.now() - startTime;

  // Run Provenance Audit on V3-Stabilized Pack
  const audit = auditEvidencePackProvenance(result.evidencePack);

  console.log(`\n⏱️ Research Completed in ${totalMs}ms`);
  console.log(`📊 Result Status: ${result.status}`);
  console.log(`🛑 Final Gate Status: ${result.finalGateStatus}`);
  console.log(`🔒 Human Review Status: ${result.humanReviewStatus}`);
  console.log(`🎯 Overall Confidence: ${result.evidencePack.confidence_overall}`);
  console.log(`🛡️ Provenance Audit Status: ${audit.requires_provenance_failure ? 'FAIL' : 'PASS (100% CLEAN)'}`);

  console.log('\n📈 Operational & Deduplication Statistics:');
  console.log(`   - Kueri Dijalankan: ${result.stats.queriesExecuted}`);
  console.log(`   - Sumber Ditemukan: ${result.stats.sourcesDiscovered}`);
  console.log(`   - Dokumen Diunduh & Terinspeksi: ${result.stats.sourcesRetrieved}`);
  console.log(`   - Dokumen Tertahan Akses (Paywall/Portal): ${result.stats.sourcesBlocked}`);
  console.log(`   - Objek Kutipan Awal (Sebelum Dedupe): ${result.stats.totalPassageObjects}`);
  console.log(`   - Kutipan Kanonikal Unik (Setelah Dedupe): ${result.stats.uniqueExcerptCount}`);
  console.log(`   - Duplikasi Objek Dieliminasi: ${result.stats.duplicatePassagesRemoved}`);
  console.log(`   - Total Klaim: ${result.stats.claimsTotal}`);
  console.log(`   - Klaim Terverifikasi (VERIFIED): ${result.stats.claimsVerified}`);
  console.log(`   - Klaim Didukung (SUPPORTED): ${result.stats.claimsSupported}`);
  console.log(`   - Klaim Konsensus Teknikal: ${result.stats.claimsConsensus}`);
  console.log(`   - Total Klaim Aman Penulis: ${result.stats.authorSafeClaimsTotal}`);
  console.log(`   - Klaim Diizinkan Masuk Naskah: ${result.stats.authorSafeClaimsAllowed}`);
  console.log(`   - Klaim Tidak Diizinkan (Unsourced / Research Required): ${result.stats.authorSafeClaimsTotal - (result.stats.authorSafeClaimsAllowed || 0)}`);

  console.log('\n📄 Retrieved & Verified Sources:');
  for (const doc of result.retrievedDocuments) {
    const isWiki = doc.source_id.includes('WIKI');
    console.log(`   • [${doc.source_id}] "${doc.title}"`);
    console.log(`     - Klasifikasi: ${doc.source_classification} (${doc.primary_vs_secondary})`);
    console.log(`     - Otoritas: ${doc.authority_level}`);
    console.log(`     - Independensi: ${isWiki ? 'PARTIALLY_DEPENDENT (saduran materi DOE/ORNL)' : 'INDEPENDENT'}`);
    console.log(`     - Canonical URL: ${doc.canonical_url || doc.url}`);
    console.log(`     - Hash SHA-256: ${doc.content_hash?.slice(0, 16)}...`);
    console.log(`     - Kutipan Diekstrak: ${doc.extracted_passages.length}`);
  }

  console.log('\n🔍 Semantic Claim Evidence Mappings (Bidirectional Proof):');
  for (const c of result.evidencePack.claim_inventory || []) {
    const isRec = c.claim_class === 'editorial_recommendation';
    console.log(`   • [${c.claim_id}] (${c.claim_class}) -> Status: ${c.evidence_status}, Tindakan: ${c.action}`);
    if (isRec) {
      console.log(`     - Diturunkan dari klaim (provenance chain): [${c.derived_from_claim_ids?.join(', ')}]`);
      console.log(`     - Passage langsung: none (rekomendasi terapan murni)`);
    } else {
      console.log(`     - Didukung ${c.evidence_passage_ids?.length || 0} passage: [${c.evidence_passage_ids?.join(', ') || 'NONE'}]`);
    }
    console.log(`     - Pernyataan: "${c.statement}"`);
  }

  // Persist Artifacts deterministically
  const targetDir = path.resolve(process.cwd(), 'scripts', 'runtime-proof');
  if (!fs.existsSync(targetDir)) {
    fs.mkdirSync(targetDir, { recursive: true });
  }

  const packPath = path.join(targetDir, 'irwan-metal-roof-evidence-pack-v3-stabilized.json');
  const metaPath = path.join(targetDir, 'irwan-metal-roof-runtime-v3-stabilized-meta.json');

  fs.writeFileSync(packPath, JSON.stringify(result.evidencePack, null, 2), 'utf8');
  console.log(`\n💾 Saved Evidence Pack Artifact: ${packPath}`);

  const metaContent = {
    jobId: result.jobId,
    taskId: result.taskId,
    milestone: jobInput.milestone,
    topic: result.topic,
    status: result.status,
    finalGateStatus: result.finalGateStatus,
    humanReviewStatus: result.humanReviewStatus,
    executionTimeMs: totalMs,
    confidenceOverall: result.evidencePack.confidence_overall,
    provenanceAudit: {
      clean: !audit.requires_provenance_failure,
      totalClaims: audit.total_claims,
      reasonsCount: audit.audit_reasons.length
    },
    stats: result.stats,
    generatedAt: new Date().toISOString()
  };
  fs.writeFileSync(metaPath, JSON.stringify(metaContent, null, 2), 'utf8');
  console.log(`💾 Saved Runtime Metadata Artifact: ${metaPath}`);

  console.log('\n🛑 MANDATORY STOP GATE REACHED:');
  console.log(`   Status: ${result.finalGateStatus}`);
  console.log('   Human Chief Editor approval required before Joko is permitted to consume this Evidence Pack.');
  console.log('   Zero publishing authority exercised. Auto-publish is OFF. System is safe.\n');
}

run().catch(err => {
  console.error('\n❌ Execution failed with error:', err);
  process.exit(1);
});
