import dns from 'node:dns';
dns.setServers(['1.1.1.1', '8.8.8.8']);

import { generateDynamicVisitorPain } from '../src/lib/article/visitor-pain.ts';
import { generateEditorialResearchQuestions } from '../src/lib/editorial/research-questions.ts';
import { executeGeneralizedResearchJob } from '../src/lib/editorial/irwan-research-runtime.ts';

async function main() {
  const topic = 'Kaca Laminated vs Tempered untuk Hunian: Perbandingan Karakteristik Keamanan, Kekuatan Benturan, dan Isolasi Suara';
  const family = 'comparison';

  console.log('--- STARTING BOUNDED LIVE RESEARCH VALIDATION ---');
  console.log(`Topic: "${topic}"`);
  console.log('Brave Search: OFF (request_count = 0)');
  console.log('NO Joko. Research-only validation.\n');

  const visitorPain = generateDynamicVisitorPain(topic, family);
  const researchQuestions = generateEditorialResearchQuestions(topic, visitorPain.intent_profile);

  console.log(`Generated ${researchQuestions.length} research questions.`);

  const startTime = Date.now();
  const researchResult = await executeGeneralizedResearchJob(
    {
      topic,
      editorialRequirements: [
        'Harus menyajikan data teknis perbandingan kaca laminated vs tempered',
        'Fokus pada karakteristik benturan, keamanan pecah, dan isolasi akustik STC'
      ],
      intentProfile: visitorPain.intent_profile,
      execution_type: 'REAL_RUNTIME_EXECUTION',
      taskId: 'TASK-RECOVERY-VAL-1'
    },
    {
      executionType: 'REAL_RUNTIME_EXECUTION',
      discoveryConfig: {
        enabled: false,
        apiKey: undefined,
        provider: 'BRAVE'
      }
    }
  );
  const elapsedMs = Date.now() - startTime;

  console.log(`\nResearch finished in ${(elapsedMs / 1000).toFixed(1)}s.`);
  console.log(`Status: ${researchResult.status}`);
  console.log(`Final Gate Status: ${researchResult.finalGateStatus}`);
  console.log(`Discovered Candidates: ${researchResult.discoveredSources?.length || 0}`);
  console.log(`Retrieved Documents: ${researchResult.retrievedDocuments?.length || 0}`);

  console.log('\n--- DISCOVERED SOURCES BREAKDOWN ---');
  for (const s of (researchResult.discoveredSources || [])) {
    console.log(`- [${s.discovery_engine}] "${s.title}" (${s.publisher || 'Unknown'})`);
    console.log(`  URL: ${s.url || 'none'} | DOI: ${s.doi || 'none'}`);
  }

  console.log('\n--- RETRIEVED DOCUMENTS BREAKDOWN ---');
  for (const doc of (researchResult.retrievedDocuments || [])) {
    console.log(`- [${doc.source_classification}] "${doc.title}" (${doc.publisher})`);
    console.log(`  Status: ${doc.retrieval_status} | Origin: ${doc.source_origin} | Blocked: ${doc.is_blocked}`);
    if (doc.is_blocked) {
      console.log(`  Blocked Reason: ${doc.blocked_reason}`);
    } else {
      console.log(`  Passages: ${doc.extracted_passages?.length || 0} | Topic Relevance: ${doc.topic_relevance || 'N/A'}`);
    }
  }

  console.log('\n--- BLOCKED / PAYWALLED SOURCES ---');
  for (const b of (researchResult.blockedSources || [])) {
    console.log(`- [${b.legal_status}] "${b.title}": ${b.reason}`);
  }

  console.log('\n==================================================');
  console.log('LIVE VALIDATION RUN COMPLETE');
  console.log('==================================================');
}

main().catch(err => {
  console.error('Fatal live validation error:', err);
  process.exit(1);
});
