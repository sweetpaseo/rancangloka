/**
 * Test Suite for Phase 1.5 Production Handoff CLI
 * Tests both Positive and all Negative handoff cases.
 */

import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';

const tempDir = path.resolve(process.cwd(), 'scripts/__temp_test__');
fs.mkdirSync(tempDir, { recursive: true });

function runCli(args, expectFail = false) {
  try {
    const output = execSync(`node scripts/import-article.js ${args}`, {
      cwd: process.cwd(),
      encoding: 'utf-8',
      stdio: ['ignore', 'pipe', 'pipe']
    });
    return { success: true, output, exitCode: 0 };
  } catch (err) {
    if (expectFail) {
      return { success: false, output: err.stdout + '\n' + err.stderr, exitCode: err.status };
    }
    throw err;
  }
}

console.log('=== PHASE 1.5 HANDOFF CLI AUTOMATED TEST SUITE ===\n');

// 1. POSITIVE IMPORT TEST
console.log('1. Positive Import Test (samples/safe-sample-article.md)...');
const pos = runCli('samples/safe-sample-article.md --strategy=overwrite');
console.log(pos.output.trim());
if (!pos.output.includes('VALIDATION: PASS') || !pos.output.includes('IMPORT: PASS') || !pos.output.includes('STATUS: draft')) {
  console.error('❌ Positive test failed!');
  process.exit(1);
}
console.log('✅ Positive test passed.\n');

const validSample = fs.readFileSync('samples/safe-sample-article.md', 'utf-8');

// 2. NEGATIVE TEST: DUPLICATE ARTICLE (with --strategy=skip)
console.log('2. Negative Test: Duplicate Article (strategy=skip)...');
const dupSample = validSample.replace(
  'title: "Dasar Pencahayaan Alami untuk Rumah Tropis: Prinsip Desain Bukaan dan Kenyamanan Ruang"',
  'title: "Rumah Tropis yang Tidak Takut Matahari"\nslug: "rumah-tropis-yang-tidak-takut-matahari"'
);
const dupFile = path.join(tempDir, 'dup-test.md');
fs.writeFileSync(dupFile, dupSample, 'utf-8');
const dup = runCli(`"${dupFile}" --strategy=skip`);
fs.unlinkSync(dupFile);
console.log(dup.output.trim());
if (!dup.output.includes('IMPORT: DUPLICATE_SKIPPED')) {
  console.error('❌ Duplicate protection test failed!');
  process.exit(1);
}
console.log('✅ Duplicate protection test passed.\n');

// Helper to test negative cases with temporary files
function testNegative(testName, badContent, expectedKeyword) {
  console.log(`${testName}...`);
  const tempFile = path.join(tempDir, 'temp-test.md');
  fs.writeFileSync(tempFile, badContent, 'utf-8');

  const res = runCli(`"${tempFile}"`, true);
  fs.unlinkSync(tempFile);

  if (res.exitCode === 0) {
    console.error(`❌ Expected non-zero exit code for ${testName}, but got 0.`);
    process.exit(1);
  }

  if (!res.output.includes(expectedKeyword)) {
    console.error(`❌ Expected error to contain "${expectedKeyword}", but got:\n${res.output}`);
    process.exit(1);
  }

  console.log(`  Exit code: ${res.exitCode}`);
  console.log(`  Output matches "${expectedKeyword}"`);
  console.log(`✅ ${testName} passed.\n`);
}


// 3. NEGATIVE TEST: INVALID CATEGORY
testNegative(
  '3. Negative Test: Invalid Category',
  validSample.replace('category: "Arsitektur & Renovasi"', 'category: "Kategori Antariksa Fiktif"'),
  'Kategori "Kategori Antariksa Fiktif" tidak valid'
);

// 4. NEGATIVE TEST: INVALID AUTHOR
testNegative(
  '4. Negative Test: Invalid Author',
  validSample.replace('author: "RancangLoka Editorial Desk"', 'author: "Blogger Misterius"'),
  'Penulis "Blogger Misterius" tidak valid'
);

// 5. NEGATIVE TEST: MISSING TITLE
testNegative(
  '5. Negative Test: Missing Title',
  validSample.replace(/title: ".*"/, 'title: ""'),
  'Field frontmatter "title" wajib diisi'
);

// 6. NEGATIVE TEST: MISSING / TOO FEW KEY_TAKEAWAYS (<3)
testNegative(
  '6. Negative Test: Too Few Key Takeaways',
  validSample.replace(/key_takeaways:[\s\S]*?---/, 'key_takeaways:\n  - "Hanya satu butir ringkasan"\n---'),
  'Field "key_takeaways" harus memiliki 3-5 butir'
);

// 7. NEGATIVE TEST: BANNED PLACEHOLDER
testNegative(
  '7. Negative Test: Banned Placeholder [EVIDENCE NEEDED]',
  validSample.replace('Pencahayaan alami merupakan', '[EVIDENCE NEEDED] Pencahayaan alami merupakan'),
  'token/placeholder terlarang'
);

// 8. NEGATIVE TEST: MALFORMED FRONTMATTER
testNegative(
  '8. Negative Test: Malformed Frontmatter (no closing triple-dash)',
  validSample.replace(/^---\r?\n/m, ''),
  'Frontmatter tidak ditemukan atau tidak diawali dan diakhiri'
);

// Clean up
try { fs.rmdirSync(tempDir); } catch {}

console.log('🎉 ALL 8 POSITIVE AND NEGATIVE HANDOFF CLI TESTS PASSED 100%!');
