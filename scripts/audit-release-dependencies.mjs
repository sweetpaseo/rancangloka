import fs from 'node:fs';
import path from 'node:path';
import { execSync } from 'node:child_process';

const rootDir = process.cwd();

// Get all files tracked in HEAD and staged in index
const headFiles = execSync('git ls-tree -r HEAD --name-only', { encoding: 'utf8', cwd: rootDir })
  .split('\n')
  .map(s => s.trim().replace(/\\/g, '/'))
  .filter(Boolean);

const stagedFiles = execSync('git diff --cached --name-only', { encoding: 'utf8', cwd: rootDir })
  .split('\n')
  .map(s => s.trim().replace(/\\/g, '/'))
  .filter(Boolean);

const trackedFiles = new Set([...headFiles, ...stagedFiles]);

const visited = new Set();
const missing = new Map();
const unresolved = [];

function resolveImport(importPath, fromFile) {
  if (!importPath.startsWith('.')) return null; // node module or external
  const dir = path.dirname(fromFile);
  let resolved = path.normalize(path.join(dir, importPath)).replace(/\\/g, '/');
  
  const extensions = ['', '.ts', '.tsx', '.js', '.mjs', '.astro', '/index.ts', '/index.js'];
  for (const ext of extensions) {
    const candidate = resolved + ext;
    if (fs.existsSync(candidate) && fs.statSync(candidate).isFile()) {
      return candidate;
    }
  }
  return null;
}

function scanFile(file) {
  file = file.replace(/\\/g, '/');
  if (file.startsWith('dist/') || file.includes('/dist/')) return;
  if (visited.has(file)) return;
  visited.add(file);

  if (!fs.existsSync(file)) {
    console.log('ENTRY FILE NOT FOUND:', file);
    return;
  }

  const content = fs.readFileSync(file, 'utf8');
  // Match import and export ... from statements
  const importRegex = /(?:import|export)\s+(?:[\w*\s{},]*\s+from\s+)?['"]([^'"]+)['"]|import\s*\(\s*['"]([^'"]+)['"]\s*\)/g;
  let match;
  while ((match = importRegex.exec(content)) !== null) {
    const importPath = match[1] || match[2];
    if (importPath && importPath.startsWith('.')) {
      if (importPath.includes('dist/') || importPath.includes('/dist/')) continue;
      const resolved = resolveImport(importPath, file);
      if (resolved) {
        const normalizedResolved = resolved.replace(/\\/g, '/');
        if (!trackedFiles.has(normalizedResolved)) {
          if (!missing.has(normalizedResolved)) {
            missing.set(normalizedResolved, new Set());
          }
          missing.get(normalizedResolved).add(file);
        }
        scanFile(normalizedResolved);
      } else {
        unresolved.push({ importPath, fromFile: file });
      }
    }
  }
}

// All files tracked in HEAD under src/ and scripts/ (excluding dist/)
const allTrackedEditorial = Array.from(trackedFiles).filter(f => 
  (f.startsWith('src/') || f.startsWith('scripts/')) && !f.startsWith('dist/')
);

for (const f of allTrackedEditorial) {
  scanFile(f);
}

console.log('================================================================');
console.log('🔍 TRANSITIVE DEPENDENCY CLOSURE AUDIT');
console.log('================================================================');
console.log('Total tracked files scanned:', visited.size);
console.log('Total missing untracked files:', missing.size);
console.log('Total unresolved import paths:', unresolved.length);

if (unresolved.length > 0) {
  console.log('\n--- UNRESOLVED IMPORTS ---');
  for (const u of unresolved) {
    console.log(`  ✗ ${u.importPath} imported by ${u.fromFile}`);
  }
}

if (missing.size > 0) {
  console.log('\n--- MISSING UNTRACKED FILES ---');
  for (const [miss, sources] of missing.entries()) {
    console.log(`  ✗ ${miss}`);
    for (const src of sources) {
      console.log(`      ↳ imported by: ${src}`);
    }
  }
} else {
  console.log('\n✓ ZERO missing untracked files!');
}
