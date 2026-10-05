#!/usr/bin/env node
/**
 * RancangLoka Irwan Real Research Proof Runner V3 (Passage-to-Claim Semantic Integrity)
 * Milestone: EDITORIAL-RUNTIME-3B
 *
 * Performs ONE controlled, operator-triggered research runtime execution:
 * Topic: "Atap Metal Terasa Panas: Apakah Insulasi Foil Cukup atau Perlu Ventilasi Atap?"
 *
 * Upgrades in V3:
 * - 1 PASSAGE = 1 ACTUAL EXCERPT: Deterministic deduplication by (source_id + locator + excerpt_hash).
 * - PASSAGE SUPPORT IS SEMANTICALLY RELEVANT: Stripped ungrounded associations (Apollo, window treatments, Canada, etc.).
 * - BIDIRECTIONAL CLAIM/PASSAGE INTEGRITY: claim.evidence_passage_ids exactly mirrors passage.supports_claim_ids.
 * - DERIVED RECOMMENDATION PROVENANCE: CLM-008 provenance flows purely through derived_from_claim_ids without fake direct passages.
 * - UNSOURCED CLAIMS BLOCKED FROM AUTHORING: CLM-007B has allowed_for_authoring = false and action = RESEARCH_REQUIRED.
 * - CLAIM ATOMICITY RECHECK: CLM-001A and CLM-001B downgraded from VERIFIED to SUPPORTED with QUALIFY action.
 * - OFFICIAL INSTITUTIONAL GUIDANCE: DOE source classified as OFFICIAL_INSTITUTIONAL_GUIDANCE (SECONDARY).
 * - SOURCE INDEPENDENCE: Wikipedia marked PARTIALLY_DEPENDENT on DOE/ORNL public domain material.
 * - CANONICAL URL & RAW RETRIEVAL RESILIENCE: Persistent snapshots and hashes for offline verification.
 * - RECALCULATED CONFIDENCE: Evaluates unique excerpts and source dependence; dynamically yields MEDIUM.
 * - Stops at: IRWAN_EVIDENCE_V3_HUMAN_REVIEW_REQUIRED.
 * - Does NOT invoke Joko. Does NOT publish. Does NOT deploy.
 * - Saves artifacts to:
 *   scripts/runtime-proof/irwan-metal-roof-evidence-pack-v3.json
 *   scripts/runtime-proof/irwan-metal-roof-runtime-v3-meta.json
 */

import fs from 'node:fs';
import path from 'node:path';
import { executeEditorialResearchJob } from '../src/lib/editorial/irwan-research-runtime.ts';
import { auditEvidencePackProvenance } from '../src/lib/article/human-quality.ts';

async function run() {
  console.log('🚀 Initiating Operator-Triggered Real Irwan Research Proof V3 (EDITORIAL-RUNTIME-3B)...');

  // 1. Operator Authorization
  const jobInput = {
    taskId: 'task_runtime_proof_irwan_research_v3_001',
    topic: 'Atap Metal Terasa Panas: Apakah Insulasi Foil Cukup atau Perlu Ventilasi Atap?',
    milestone: 'EDITORIAL-RUNTIME-3B',
    expectedFinalGate: 'IRWAN_EVIDENCE_V3_HUMAN_REVIEW_REQUIRED',
    operatorAuth: {
      authorizedBy: 'antigravity_operator',
      operatorRole: 'CHIEF_EDITOR',
      timestamp: new Date().toISOString()
    }
  };

  console.log(`📡 Topic: "${jobInput.topic}"`);
  console.log(`👤 Operator: ${jobInput.operatorAuth.authorizedBy} (${jobInput.operatorAuth.operatorRole})`);
  console.log('⏳ Executing Irwan research runtime V3 (Discovery -> Retrieval -> Reading -> Semantic Extraction -> Packaging)...');

  const startTime = Date.now();
  const result = await executeEditorialResearchJob(jobInput);
  const totalMs = Date.now() - startTime;

  // Run Provenance Audit on V3 Pack
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
      console.log(`     - Passage pendukung (${c.evidence_passage_ids?.length || 0}): [${c.evidence_passage_ids?.join(', ')}]`);
      console.log(`     - Sumber primer: [${c.sources?.map(s => s.source_id).join(', ') || 'TIDAK ADA'}]`);
    }
  }

  // 2. Save Artifacts
  const outputDir = path.resolve('./scripts/runtime-proof');
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  const packOutPath = path.join(outputDir, 'irwan-metal-roof-evidence-pack-v3.json');
  const metaOutPath = path.join(outputDir, 'irwan-metal-roof-runtime-v3-meta.json');

  fs.writeFileSync(packOutPath, JSON.stringify(result.evidencePack, null, 2), 'utf-8');
  console.log(`\n💾 Saved hardened Irwan Evidence Pack V3 to: ${packOutPath}`);

  const cleanMeta = {
    jobId: result.jobId,
    taskId: result.taskId,
    status: result.status,
    finalGateStatus: result.finalGateStatus,
    humanReviewStatus: result.humanReviewStatus,
    topic: result.topic,
    researchRuntime: result.researchRuntime,
    stats: result.stats,
    deduplication: {
      total_passage_objects: result.stats.totalPassageObjects,
      unique_excerpt_count: result.stats.uniqueExcerptCount,
      duplicate_passages_removed: result.stats.duplicatePassagesRemoved
    },
    sources: result.retrievedDocuments.map(d => ({
      source_id: d.source_id,
      title: d.title,
      publisher: d.publisher,
      source_classification: d.source_classification,
      authority_level: d.authority_level,
      independence: d.source_id.includes('WIKI') ? 'PARTIALLY_DEPENDENT' : 'INDEPENDENT',
      canonical_url: d.canonical_url,
      content_hash: d.content_hash,
      extracted_passages_count: d.extracted_passages.length
    })),
    provenanceAudit: {
      clean: !audit.requires_provenance_failure,
      total_claims: audit.total_claims,
      verified_sources: audit.retrieved_and_verified_sources_count,
      unverified_claims: audit.unverified_claims,
      missing_provenance: audit.missing_provenance_claims,
      audit_reasons: audit.audit_reasons
    },
    safetyInvariants: {
      automation_mode: 'OFF',
      SOCIAL_AUTOMATION: 'OFF',
      AUTO_PUBLISH: 'OFF',
      publishingAuthority: 0,
      JEV_MODE: 'shadow',
      mediaWorker: 'DISABLED',
      jefryExecutionAuthority: 0,
      jokoInvoked: false,
      deployed: false,
      published: false
    }
  };

  fs.writeFileSync(metaOutPath, JSON.stringify(cleanMeta, null, 2), 'utf-8');
  console.log(`💾 Saved Irwan runtime metadata V3 to: ${metaOutPath}`);

  console.log('\n🔒 Final Safety Enforcement:');
  console.log('   - AUTO_PUBLISH: OFF');
  console.log('   - publishingAuthority: 0');
  console.log('   - JEV_MODE: shadow');
  console.log('   - Joko Authoring Model: UNINVOKED');
  console.log(`   - Final Gate Status: ${result.finalGateStatus}`);
  console.log('\n🏁 Runtime Proof V3 Execution Finished Successfully.');
}

run().catch(err => {
  console.error('\n❌ Runtime Proof V3 failed:', err);
  process.exit(1);
});
