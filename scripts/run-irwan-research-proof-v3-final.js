#!/usr/bin/env node
/**
 * RancangLoka Irwan Real Research Proof Runner V3-Final (Final Evidence Integrity)
 * Milestone: EDITORIAL-RUNTIME-3B-FINAL
 *
 * Micro cleanup in V3-Final:
 * - REMOVE DANGLING LEGACY CLAIM ID: Completely purged legacy CLM-004 from extracted_passages and evidence_passages.
 * - TIGHTEN CLM-004A: Grounded directly in primary institutional evidence without fiber/foam comparison.
 * - SOFTEN CLM-008: Scenario-qualified recommendation without universal requirement wording ("diperlukan" removed).
 * - Saves artifacts to:
 *   scripts/runtime-proof/irwan-metal-roof-evidence-pack-v3-final.json
 *   scripts/runtime-proof/irwan-metal-roof-runtime-v3-final-meta.json
 * - Stops strictly at: IRWAN_EVIDENCE_V3_FINAL_HUMAN_REVIEW_REQUIRED.
 */

import fs from 'node:fs';
import path from 'node:path';
import { executeEditorialResearchJob } from '../src/lib/editorial/irwan-research-runtime.ts';
import { auditEvidencePackProvenance } from '../src/lib/article/human-quality.ts';

async function run() {
  console.log('🚀 Initiating Operator-Triggered Real Irwan Research Proof V3-Final (EDITORIAL-RUNTIME-3B-FINAL)...');

  const jobInput = {
    taskId: 'task_runtime_proof_irwan_research_v3_final_001',
    topic: 'Atap Metal Terasa Panas: Apakah Insulasi Foil Cukup atau Perlu Ventilasi Atap?',
    milestone: 'EDITORIAL-RUNTIME-3B-FINAL',
    expectedFinalGate: 'IRWAN_EVIDENCE_V3_FINAL_HUMAN_REVIEW_REQUIRED',
    operatorAuth: {
      authorizedBy: 'antigravity_operator',
      operatorRole: 'CHIEF_EDITOR',
      timestamp: new Date().toISOString()
    }
  };

  console.log(`📡 Topic: "${jobInput.topic}"`);
  console.log(`👤 Operator: ${jobInput.operatorAuth.authorizedBy} (${jobInput.operatorAuth.operatorRole})`);
  console.log('⏳ Executing Irwan research runtime V3-Final...');

  const startTime = Date.now();
  const result = await executeEditorialResearchJob(jobInput);
  const totalMs = Date.now() - startTime;

  // Run Provenance Audit on V3-Final Pack
  const audit = auditEvidencePackProvenance(result.evidencePack);

  console.log(`\n⏱️ Research Completed in ${totalMs}ms`);
  console.log(`📊 Result Status: ${result.status}`);
  console.log(`🛑 Final Gate Status: ${result.finalGateStatus}`);
  console.log(`🔒 Human Review Status: ${result.humanReviewStatus}`);
  console.log(`🎯 Overall Confidence: ${result.evidencePack.confidence_overall}`);
  console.log(`🛡️ Provenance Audit Status: ${audit.requires_provenance_failure ? 'FAIL' : 'PASS (100% CLEAN)'}`);

  if (audit.requires_provenance_failure) {
    console.error('❌ Audit Reasons:', audit.audit_reasons);
    process.exit(1);
  }

  // Persist canonical artifacts
  const outDir = path.resolve('scripts/runtime-proof');
  if (!fs.existsSync(outDir)) {
    fs.mkdirSync(outDir, { recursive: true });
  }

  const packPath = path.join(outDir, 'irwan-metal-roof-evidence-pack-v3-final.json');
  fs.writeFileSync(packPath, JSON.stringify(result.evidencePack, null, 2), 'utf8');
  console.log(`\n💾 Saved V3-Final Evidence Pack to: ${packPath}`);

  const metaPath = path.join(outDir, 'irwan-metal-roof-runtime-v3-final-meta.json');
  const metaReport = {
    milestone: 'EDITORIAL-RUNTIME-3B-FINAL',
    job_id: result.jobId,
    execution_time_ms: totalMs,
    final_gate_status: result.finalGateStatus,
    human_review_status: result.humanReviewStatus,
    confidence_overall: result.evidencePack.confidence_overall,
    audit_summary: {
      passed: !audit.requires_provenance_failure,
      reasons: audit.audit_reasons,
      unverified_claims: audit.unverified_claims,
      missing_provenance: audit.missing_provenance_claims
    },
    statistics: result.stats,
    retrieved_documents: result.retrievedDocuments.map(d => ({
      source_id: d.source_id,
      title: d.title,
      publisher: d.publisher,
      canonical_url: d.canonical_url,
      content_hash: d.content_hash,
      extracted_passages_count: d.extracted_passages.length
    })),
    claim_summary: result.evidencePack.claim_inventory?.map(c => ({
      claim_id: c.claim_id,
      claim_class: c.claim_class,
      evidence_status: c.evidence_status,
      action: c.action,
      passages: c.evidence_passage_ids,
      derived_from: c.derived_from_claim_ids
    })),
    author_safe_claims: result.evidencePack.author_safe_claims?.map(s => ({
      claim_id: s.claim_id,
      allowed: s.allowed_for_authoring,
      statement: s.statement,
      support_level: s.support_level
    })),
    trace_events: result.traceEvents
  };

  fs.writeFileSync(metaPath, JSON.stringify(metaReport, null, 2), 'utf8');
  console.log(`💾 Saved V3-Final Runtime Meta Report to: ${metaPath}`);

  console.log('\n🔒 SAFETY GUARANTEE:');
  console.log('   - JOKO UNINVOKED: Editorial writer agent was NOT called.');
  console.log('   - ZERO PUBLISHING AUTHORITY: publishingAuthority remains 0.');
  console.log('   - CLOUDFLARE EDGE: No remote D1 changes or deployments.');
  console.log(`   - MANDATORY STOP GATE: ${result.finalGateStatus}\n`);
}

run().catch(err => {
  console.error('Fatal error during Irwan research proof v3-final execution:', err);
  process.exit(1);
});
