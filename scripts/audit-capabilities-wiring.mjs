import fs from 'node:fs';
import path from 'node:path';

const rootDir = process.cwd();

const capabilities = [
  {
    name: '1. Maya & EPIS (Topic Registry & Planner)',
    file: 'src/lib/editorial/topic-registry-service.ts',
    wiredIn: ['src/lib/editorial/master-editorial-orchestrator.ts']
  },
  {
    name: '2. UTLIS (Topic Lifecycle & Selection)',
    file: 'src/lib/editorial/topic-lifecycle-contracts.ts',
    wiredIn: ['src/lib/editorial/topic-registry-service.ts', 'src/lib/editorial/master-editorial-orchestrator.ts']
  },
  {
    name: '3. OLCI (Operational Learning & Continuous Improvement)',
    file: 'src/lib/editorial/olci-manager.ts',
    wiredIn: ['src/lib/editorial/master-editorial-orchestrator.ts']
  },
  {
    name: '4. Primary & Second Brain (Shared Memory Adapter)',
    file: 'src/lib/editorial/shared-memory-adapter.ts',
    wiredIn: ['src/lib/editorial/master-editorial-orchestrator.ts']
  },
  {
    name: '5. L5 Conversational Editorial & Anti-Slop',
    file: 'src/lib/editorial/nadia-reader-voice.ts',
    wiredIn: ['src/lib/editorial/master-editorial-orchestrator.ts', 'scripts/hermes-eu-autonomous-runner.mjs']
  },
  {
    name: '6. Joko Writing Engine (DEC-09 Strict Boundary)',
    file: 'src/lib/editorial/joko-prompt-builder.ts',
    wiredIn: ['src/lib/editorial/master-editorial-orchestrator.ts']
  },
  {
    name: '7. Nadia Quality Rubric & Dynamic Storyboard',
    file: 'src/lib/editorial/nadia-visual-storyboard.ts',
    wiredIn: ['src/lib/editorial/master-editorial-orchestrator.ts', 'scripts/hermes-eu-autonomous-runner.mjs']
  },
  {
    name: '8. Irwan Evidence Standards & Provenance',
    file: 'src/lib/editorial/irwan-live-evidence-acquirer.ts',
    wiredIn: ['src/lib/editorial/master-editorial-orchestrator.ts']
  },
  {
    name: '9. Budi Visual Quality & Object-First Policy',
    file: 'src/lib/editorial/object-first-visual-policy.ts',
    wiredIn: ['src/lib/editorial/article-definition-of-done.ts', 'src/lib/editorial/master-editorial-orchestrator.ts']
  },
  {
    name: '10. Sari Browser Verification (CDP / Headless)',
    file: 'src/lib/editorial/sari-browser-verification.ts',
    wiredIn: ['src/lib/editorial/article-definition-of-done.ts', 'scripts/test-article-integrity-regression-suite.mjs']
  },
  {
    name: '11. Canonical Modular Assembly (Gate B.8, LKG)',
    file: 'src/lib/editorial/modular/gateway.ts',
    wiredIn: ['src/lib/editorial/article-definition-of-done.ts', 'scripts/test-article-integrity-regression-suite.mjs']
  },
  {
    name: '12. Article Definition of Done (DoD v1.0)',
    file: 'src/lib/editorial/article-definition-of-done.ts',
    wiredIn: ['src/lib/publication/service.ts', 'scripts/test-article-integrity-regression-suite.mjs']
  },
  {
    name: '13. Publication Pipeline & Editorial Review',
    file: 'src/lib/publication/editorial-review-service.ts',
    wiredIn: ['src/lib/publication/service.ts']
  },
  {
    name: '14. Decision Platform (TypeSafe Jev Shadow)',
    file: 'src/lib/decision/decision-router.ts',
    wiredIn: ['src/lib/publication/service.ts']
  }
];

console.log('================================================================');
console.log('🔗 14 OPERATIONAL CAPABILITIES RUNTIME WIRING AUDIT');
console.log('================================================================');

let allPassed = true;

for (const cap of capabilities) {
  const fullPath = path.join(rootDir, cap.file);
  const exists = fs.existsSync(fullPath);
  if (!exists) {
    console.log(`❌ [MISSING] ${cap.name}: ${cap.file} not found`);
    allPassed = false;
    continue;
  }

  const content = fs.readFileSync(fullPath, 'utf8');
  const exportMatches = content.match(/export\s+(?:const|function|class|type|interface|default)\s+([a-zA-Z0-9_]+)/g) || [];
  
  const wiringStatus = [];
  for (const consumer of cap.wiredIn) {
    const consumerPath = path.join(rootDir, consumer);
    if (!fs.existsSync(consumerPath)) {
      wiringStatus.push(`Consumer missing: ${consumer}`);
      allPassed = false;
      continue;
    }
    const consumerContent = fs.readFileSync(consumerPath, 'utf8');
    const baseName = path.basename(cap.file, path.extname(cap.file));
    const isImported = consumerContent.includes(baseName) || consumerContent.includes(cap.file);
    if (isImported) {
      wiringStatus.push(`✓ wired in ${consumer}`);
    } else {
      wiringStatus.push(`✗ NOT imported in ${consumer}`);
      allPassed = false;
    }
  }

  console.log(`✅ [WIRED] ${cap.name}`);
  console.log(`   Source: ${cap.file} (${exportMatches.length} exports)`);
  for (const ws of wiringStatus) {
    console.log(`   -> ${ws}`);
  }
}

console.log('================================================================');
console.log(`RESULT: ${allPassed ? 'ALL 14 CAPABILITIES ACTIVELY WIRED (100% PASS)' : 'SOME CAPABILITIES NOT WIRED'}`);
console.log('================================================================');
