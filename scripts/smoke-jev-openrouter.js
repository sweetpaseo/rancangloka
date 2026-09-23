#!/usr/bin/env node
/**
 * RancangLoka — TypeSafe Jev OpenRouter Isolated Smoke Test
 * Milestone: JEV-SHADOW-1
 * 
 * Safely tests the OpenRouter Decisions API with model typesafe/jev-1.13
 * using a minimal synthetic publication state.
 * 
 * Invariants:
 * - Reads OPENROUTER_API_KEY from process.env ONLY.
 * - Never prints the API key or authorization headers.
 * - Maximum economical request.
 */

const API_KEY = process.env.OPENROUTER_API_KEY;

if (!API_KEY) {
  console.error('\n❌ ERROR: OPENROUTER_API_KEY is missing from environment.');
  console.error('Please configure OPENROUTER_API_KEY in the process environment before running this live smoke test.\n');
  process.exit(1);
}

const ENDPOINT = 'https://openrouter.ai/api/alpha/decisions';
const MODEL = 'typesafe/jev-1.13';

const SYNTHETIC_STATE = {
  project: 'RancangLoka',
  articleGenerationCompleted: true,
  editorialValidationPassed: true,
  referencesPresent: true,
  heroImagePresent: true,
  duplicateSlug: false,
  topic: 'Kusen Aluminium vs uPVC untuk Rumah Tropis',
  category: 'Material & Finishing'
};

const QUESTIONS = {
  nextAction: {
    type: 'choice',
    instructions: 'What is the appropriate next pipeline action for this publication candidate?',
    criteria: {
      continue: 'Article passes editorial validations, references and media are present, and candidate is ready to schedule.',
      revise: 'Validation passed but minor editorial improvements are needed before publication.',
      human_review: 'Editorial approval is pending, or high-risk claims require human editor verification.',
      stop: 'Candidate failed contract guards, has duplicate slug, or missing essential prerequisites.'
    }
  },
  needsHumanReview: {
    type: 'noul',
    instructions: 'Does this candidate require explicit Chief Editor human review before publication dispatch?',
    criteria: {
      true: 'Human approval is pending or high-risk claims/sponsored content require human sign-off.',
      false: 'Candidate satisfies standard verified criteria and all editorial gates.'
    }
  },
  publicationRisk: {
    type: 'choice',
    instructions: 'What is the publication risk level for this candidate?',
    criteria: {
      very_low: 'All validations passed, genuine authentic article, verified references and validated media.',
      low: 'Standard article with verified evidence and clean editorial checks.',
      medium: 'Article has time-sensitive claims or pending secondary verifications.',
      high: 'High-risk topic, missing primary evidence, or unvalidated media assets.',
      critical: 'Guard violations, monetary policy breach, or duplicate slug conflict.'
    }
  }
};

async function runSmokeTest() {
  console.log('\n=============================================================');
  console.log('  RancangLoka — Jev OpenRouter Decisions API Smoke Test');
  console.log('=============================================================');
  console.log(`Endpoint: ${ENDPOINT}`);
  console.log(`Target Model: ${MODEL}`);
  console.log('State: Synthetic RancangLoka Candidate (Minimal State Principle)');
  console.log('Auth: OPENROUTER_API_KEY [REDACTED/VERIFIED]');

  const payload = {
    model: MODEL,
    state: SYNTHETIC_STATE,
    questions: QUESTIONS
  };

  const startTime = Date.now();
  let response;
  try {
    response = await fetch(ENDPOINT, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${API_KEY}`,
        'HTTP-Referer': 'https://rancangloka.com',
        'X-Title': 'RancangLoka Jev Smoke Test'
      },
      body: JSON.stringify(payload)
    });
  } catch (netErr) {
    const latencyMs = Date.now() - startTime;
    console.error(`\n❌ Network error after ${latencyMs}ms:`, netErr.message);
    process.exit(1);
  }

  const latencyMs = Date.now() - startTime;
  console.log(`\nHTTP Status: ${response.status} ${response.statusText}`);
  console.log(`Latency: ${latencyMs}ms`);

  if (!response.ok) {
    const errorBody = await response.text().catch(() => '');
    console.error('\n❌ API Error Response:', errorBody.slice(0, 500));
    process.exit(1);
  }

  const data = await response.json();

  console.log('\n--- Decision Answers ---');
  if (data.answers) {
    for (const [qid, ans] of Object.entries(data.answers)) {
      if (ans.type === 'choice') {
        console.log(`  [Choice] ${qid}:`);
        console.log(`    Selected: ${ans.choice}`);
        console.log(`    Confidence: ${(ans.confidence * 100).toFixed(1)}%`);
        console.log(`    Probabilities:`, ans.probabilities);
      } else if (ans.type === 'noul') {
        console.log(`  [Noul] ${qid}:`);
        console.log(`    P(true): ${(ans.noul * 100).toFixed(1)}%`);
        console.log(`    Confidence: ${(ans.confidence * 100).toFixed(1)}%`);
      } else if (ans.type === 'score') {
        console.log(`  [Score] ${qid}:`);
        console.log(`    Score: ${ans.score}`);
        console.log(`    Confidence: ${(ans.confidence * 100).toFixed(1)}%`);
      }
    }
  } else {
    console.log('No answers map returned in payload:', data);
  }

  console.log('\n--- Telemetry & Usage ---');
  console.log(`Model: ${data.model || MODEL}`);
  console.log(`Provider: OpenRouter / TypeSafe`);
  if (data.usage) {
    console.log(`Prompt Tokens: ${data.usage.prompt_tokens ?? 'N/A'}`);
    console.log(`Completion Tokens: ${data.usage.completion_tokens ?? 'N/A'}`);
    console.log(`Total Tokens: ${data.usage.total_tokens ?? 'N/A'}`);
    if (data.usage.cost !== undefined) {
      console.log(`Monetary Cost: $${data.usage.cost}`);
    }
  }

  console.log('\n=============================================================');
  console.log('  Smoke Test Result: SUCCESS');
  console.log('=============================================================\n');
}

runSmokeTest().catch(err => {
  console.error('\n❌ Uncaught error during smoke test:', err);
  process.exit(1);
});
