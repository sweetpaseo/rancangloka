/**
 * Temporary Scratch / Benchmark Runner for EDITORIAL-HUMAN-QUALITY-2
 * Runs evaluateHumanWritingQuality against BENCHMARK_CORPUS to observe pre-calibration results.
 */

import { BENCHMARK_CORPUS } from '../src/lib/article/editorial-benchmark.ts';
import { evaluateHumanWritingQuality } from '../src/lib/article/human-quality.ts';

console.log('=== RUNNING PRE-CALIBRATION BENCHMARK ===\n');

for (const fixture of BENCHMARK_CORPUS) {
  const result = evaluateHumanWritingQuality(fixture.content, fixture.options || {});
  const gold = fixture.gold_label;
  const match = result.decision === gold.expected_decision;
  const scoreInRange = result.total_score >= gold.expected_score_range[0] && result.total_score <= gold.expected_score_range[1];
  
  console.log(`[${fixture.id}] (${fixture.split})`);
  console.log(`  Title: ${fixture.title}`);
  console.log(`  Score: ${result.total_score} (expected: ${gold.expected_score_range[0]}-${gold.expected_score_range[1]}) ${scoreInRange ? '🎯' : '⚠️'}`);
  console.log(`  Decision: ${result.decision} (expected: ${gold.expected_decision}) ${match ? '✅ MATCH' : '❌ MISMATCH'}`);
  console.log(`  Issues Detected: ${result.issues.map(i => i.code).join(', ') || 'None'}`);
  console.log(`  Expected Issues: ${gold.expected_major_issues.join(', ') || 'None'}`);
  console.log('---');
}
