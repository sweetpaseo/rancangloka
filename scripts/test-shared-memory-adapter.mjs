import assert from 'node:assert';
import path from 'node:path';
import {
  getSharedMemoryStatus,
  readMemoryDoc,
  listMemoryDocs,
  getGoldenArticleReference,
  getVoiceAndToneGuide,
  getVisualPolicySummary,
  getMaterialBenchmarks,
  getOwnerDirectives,
  querySharedMemory,
  writeMemoryNote,
  isSharedMemoryWriteEnabled
} from '../src/lib/editorial/shared-memory-adapter.ts';
import {
  buildJokoUserPrompt,
  buildJokoPrompt,
  auditPromptSemanticLeaks
} from '../src/lib/editorial/joko-prompt-builder.ts';
import {
  executeMasterAutonomousEditorialPipeline
} from '../src/lib/editorial/master-editorial-orchestrator.ts';

console.log('===============================================================');
console.log('  TEST SUITE: HERMES SHARED MEMORY ADAPTER & SAFETY GATES');
console.log('===============================================================');

let passCount = 0;
let totalTests = 0;

function it(desc, fn) {
  totalTests++;
  try {
    fn();
    console.log(`  ✅ PASS: ${desc}`);
    passCount++;
  } catch (err) {
    console.error(`  ❌ FAIL: ${desc}`);
    console.error(`     Error: ${err.message}`);
  }
}

// T01: Status inspection
it('T01: Shared memory status detects active directory and read-only mode', () => {
  const status = getSharedMemoryStatus();
  assert.strictEqual(status.available, true, 'Shared memory directory must be available');
  assert.strictEqual(status.is_read_only, true, 'Default mode must be strictly read-only');
  assert(status.total_files >= 6, `Expected at least 6 files, found ${status.total_files}`);
  assert(status.categories.includes('01-editorial-standards'), 'Must include 01-editorial-standards');
  assert(status.categories.includes('02-verified-knowledge'), 'Must include 02-verified-knowledge');
  assert(status.categories.includes('03-owner-preferences'), 'Must include 03-owner-preferences');
  assert(status.categories.includes('04-agent-handoffs'), 'Must include 04-agent-handoffs');
  assert(status.categories.includes('05-checkpoints'), 'Must include 05-checkpoints');
});

// T02: Golden Article reference
it('T02: getGoldenArticleReference returns Article #9993 Dinding Rembes benchmark', () => {
  const golden = getGoldenArticleReference();
  assert(golden.includes('#9993'), 'Must contain Golden Article ID #9993');
  assert(golden.includes('Dinding Rembes dan Cat Menggelembung'), 'Must contain canonical title');
  assert(golden.includes('Jakarta Editorial'), 'Must reference Jakarta Editorial voice');
  assert(golden.includes('kamu'), 'Must mention conversational sapaan kamu');
});

// T03: Voice & Tone guide
it('T03: getVoiceAndToneGuide returns Conversational 2.1 standards', () => {
  const voice = getVoiceAndToneGuide();
  assert(voice.includes('Conversational Editorial 2.1'), 'Must reference Conversational 2.1');
  assert(voice.includes('60 kata'), 'Must enforce max 60 words per block');
  assert(voice.includes('Anda'), 'Must enforce zero Anda constraint');
});

// T04: Visual Policy summary
it('T04: getVisualPolicySummary returns Object-First 5-image rules', () => {
  const visual = getVisualPolicySummary();
  assert(visual.includes('Tepat 5 Visual'), 'Must mandate exactly 5 visuals');
  assert(visual.includes('1 Cover Hero'), 'Must include 1 Cover Hero');
  assert(visual.includes('1 Pre-Closing Inline'), 'Must include 1 Pre-Closing Inline');
  assert(visual.includes('before_heading'), 'Must specify before_heading placement');
});

// T05: Material benchmarks
it('T05: getMaterialBenchmarks returns verified slope and dead load specs', () => {
  const material = getMaterialBenchmarks();
  assert(material.includes('10 derajat'), 'Must contain UPVC minimum 10 deg slope');
  assert(material.includes('25–30 kg/m²'), 'Must contain laminated glass dead load spec');
  assert(material.includes('PUIL 2011/SNI'), 'Must reference PUIL 2011/SNI electrical standards');
});

// T06: Owner directives
it('T06: getOwnerDirectives enforces AUTO_PUBLISH=OFF and Monetary Silence', () => {
  const directives = getOwnerDirectives();
  assert(directives.includes('AUTO_PUBLISH = OFF'), 'Must state AUTO_PUBLISH=OFF');
  assert(directives.includes('Monetary Silence'), 'Must enforce Monetary Silence');
  assert(directives.includes('40 Kling Units'), 'Must specify budget cap');
});

// T07: Query knowledge across markdown
it('T07: querySharedMemory finds relevant snippets for topic keywords', () => {
  const slopeMatches = querySharedMemory(['kemiringan', '10 derajat']);
  assert(slopeMatches.length > 0, 'Should find 10 degree slope rule');
  assert.strictEqual(slopeMatches[0].category, '02-verified-knowledge');

  const goldenMatches = querySharedMemory(['9993']);
  assert(goldenMatches.length > 0, 'Should find Golden Article reference');
  assert.strictEqual(goldenMatches[0].category, '01-editorial-standards');
});

// T08: Path traversal defense
it('T08: readMemoryDoc blocks path traversal attacks', () => {
  assert.throws(() => {
    readMemoryDoc('../../../package.json');
  }, /Path traversal denied|Document not found/);
});

// T09: Read-Only Safety Gate
it('T09: writeMemoryNote blocks autonomous writes when isSharedMemoryWriteEnabled is false', () => {
  assert.strictEqual(isSharedMemoryWriteEnabled(), false, 'Write must be disabled by default');
  assert.throws(() => {
    writeMemoryNote({
      category: '04-agent-handoffs',
      filename: 'unauthorized-note.md',
      authorStaff: 'Joko',
      content: 'Unauthorized automated note'
    });
  }, /SharedMemory:READ_ONLY_VIOLATION/);
});

// T10: Secret leakage defense
it('T10: writeMemoryNote rejects content containing secret signatures even with override', () => {
  assert.throws(() => {
    writeMemoryNote({
      category: '04-agent-handoffs',
      filename: 'test-secret.md',
      authorStaff: 'Sari',
      content: 'Here is the key: bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...',
      allowWriteOverride: true
    });
  }, /SharedMemory:SECURITY_VIOLATION/);
});

// T11: Joko Prompt Context Injection
it('T11: buildJokoUserPrompt automatically injects Golden Article #9993 reference from shared memory', () => {
  const prompt = buildJokoUserPrompt({
    topic: 'Memilih Kanopi Teras: Alderon UPVC, Polikarbonat Solid, atau Kaca Tempered Laminated?',
    requestedTitle: 'Memilih Kanopi Teras: Alderon UPVC, Polikarbonat Solid, atau Kaca Tempered Laminated?',
    intentProfile: { primary_intent: 'COMPARISON' },
    evidencePack: {
      claim_inventory: [{ claim_id: 'CLM-001', statement: 'Kemiringan atap kanopi Alderon minimal 10 derajat.' }]
    },
    authorSafeClaims: [{ claim_id: 'CLM-001', statement: 'Kemiringan atap kanopi Alderon minimal 10 derajat.' }]
  });

  assert(prompt.includes('# REFERENSI MEMORI REDAKSI BERSAMA'), 'Must contain shared memory section');
  assert(prompt.includes('Golden Article #9993'), 'Must contain Golden Article #9993 reference');
  assert(prompt.includes('Dinding Rembes dan Cat Menggelembung'), 'Must contain benchmark title');
  assert(prompt.includes('10 derajat'), 'Must contain matched verified benchmark');
});

// T12: Pre-provider prompt semantic leak audit
it('T12: Compiled Joko prompt passes auditPromptSemanticLeaks with zero leaks', () => {
  const compiled = buildJokoPrompt({
    topic: 'Memilih Kanopi Teras: Alderon UPVC, Polikarbonat Solid, atau Kaca Tempered Laminated?',
    requestedTitle: 'Memilih Kanopi Teras: Alderon UPVC, Polikarbonat Solid, atau Kaca Tempered Laminated?',
    intentProfile: { primary_intent: 'COMPARISON' },
    evidencePack: {
      claim_inventory: [{ claim_id: 'CLM-001', statement: 'Kemiringan atap kanopi Alderon minimal 10 derajat.' }]
    },
    authorSafeClaims: [{ claim_id: 'CLM-001', statement: 'Kemiringan atap kanopi Alderon minimal 10 derajat.' }]
  });

  const leakAudit = auditPromptSemanticLeaks(compiled, {
    topic: 'Memilih Kanopi Teras: Alderon UPVC, Polikarbonat Solid, atau Kaca Tempered Laminated?',
    requestedTitle: 'Memilih Kanopi Teras: Alderon UPVC, Polikarbonat Solid, atau Kaca Tempered Laminated?',
    authorSafeClaims: [{ claim_id: 'CLM-001', statement: 'Kemiringan atap kanopi Alderon minimal 10 derajat.' }]
  });

  assert.strictEqual(leakAudit.passed, true, `Prompt should not leak static terms: ${leakAudit.rejectionReason}`);
  assert.strictEqual(leakAudit.leaks.length, 0);
});

// T13: Master Orchestrator Step Logs contain Shared Memory Context
await (async () => {
  totalTests++;
  try {
    const fs = await import('node:fs');
    const manuscriptPath = path.resolve(process.cwd(), 'storage/masters/art10016/manuscript_art10016_revised.md');
    const manuscriptMd = fs.existsSync(manuscriptPath) ? fs.readFileSync(manuscriptPath, 'utf8') : '# Memilih Kanopi Teras\n\nMemilih kanopi alderon vs polikarbonat vs kaca tempered memerlukan perhitungan matang.';

    const res = await executeMasterAutonomousEditorialPipeline({
      jobId: 'job_test_shared_mem_staging',
      articleNumber: 10016,
      stagingArticleId: 16,
      topic: 'Memilih Kanopi Teras: Alderon UPVC, Polikarbonat Solid, atau Kaca Tempered Laminated?',
      requestedTitle: 'Memilih Kanopi Teras: Alderon UPVC, Polikarbonat Solid, atau Kaca Tempered Laminated?',
      canonicalSlug: 'perbandingan-kanopi-alderon-polikarbonat-dan-kaca-tempered',
      focusKeyword: 'kanopi alderon vs polikarbonat vs kaca tempered',
      manuscriptMd,
      options: {
        dryRun: true,
        maxBudgetUsd: 0.30
      }
    });

    assert(res.stepLogs.some(s => s.step === 'IRWAN_SHARED_MEMORY_CONTEXT'), 'Must record Irwan shared memory step');
    assert(res.stepLogs.some(s => s.step === 'JOKO_SHARED_MEMORY_CONTEXT'), 'Must record Joko shared memory step');
    assert(res.stepLogs.some(s => s.step === 'NADIA_SHARED_MEMORY_CONTEXT'), 'Must record Nadia shared memory step');
    assert(res.stepLogs.some(s => s.step === 'RINA_SHARED_MEMORY_DIRECTIVES'), 'Must record Rina shared memory step');

    console.log('  ✅ PASS: T13: executeMasterAutonomousEditorialPipeline logs all shared memory steps');
    passCount++;
  } catch (err) {
    console.error('  ❌ FAIL: T13: executeMasterAutonomousEditorialPipeline logs all shared memory steps');
    console.error(`     Error: ${err.message}`);
  }
})();

// T14: Graceful degradation when shared memory is inaccessible
it('T14: buildJokoUserPrompt gracefully falls back without crashing when shared memory directory is missing', () => {
  const origEnv = process.env.RANCANGLOKA_SHARED_MEMORY_DIR;
  try {
    process.env.RANCANGLOKA_SHARED_MEMORY_DIR = '/nonexistent/path/xyz';
    const prompt = buildJokoUserPrompt({
      topic: 'Memilih Cat Tembok Eksterior Tropis',
      intentProfile: { primary_intent: 'PROBLEM_SOLVING' },
      evidencePack: {},
      authorSafeClaims: []
    });
    assert(prompt.includes('# TUGAS PENULISAN DRAF ARTIKEL'), 'Prompt must still compile cleanly');
  } finally {
    process.env.RANCANGLOKA_SHARED_MEMORY_DIR = origEnv;
  }
});

console.log('===============================================================');
console.log(`  SUMMARY: ${passCount} / ${totalTests} TESTS PASSED (${Math.round((passCount/totalTests)*100)}%)`);
console.log('===============================================================');

if (passCount !== totalTests) {
  process.exit(1);
}
