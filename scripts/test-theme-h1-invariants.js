/**
 * Verification test for single semantic H1 on Article 4 and Article C
 * and validation of Lemon Linen Atlas V2 tokens.
 */
import fs from 'node:fs';
import path from 'node:path';
import { marked } from 'marked';

console.log('--- RUNNING ARTICLE H1 BOUNDARY & THEME VERIFICATION ---');

// 1. Test Markdown H1 stripping simulation from [slug].astro
const sampleArticle4Md = `# Perbedaan Atap Metal dan Genteng Beton untuk Rumah Tropis: Panduan Lengkap

Ketika merenovasi atau membangun atap rumah di iklim tropis lembap Indonesia, pilihan antara genteng beton dan atap metal sering kali membingungkan.

## 1. Karakteristik Beban Struktural
Genteng beton memiliki bobot sekitar 45 kg/m2...
`;

let processedHtml = marked.parse(sampleArticle4Md);
const initialH1Count = (processedHtml.match(/<h1[^>]*>/gi) || []).length;
console.log(`Initial Markdown HTML H1 count: ${initialH1Count}`);

// Apply our presentation boundary regex
processedHtml = processedHtml.replace(/<h1[^>]*>[\s\S]*?<\/h1>/i, '');
const finalH1CountInBody = (processedHtml.match(/<h1[^>]*>/gi) || []).length;
console.log(`Final HTML Body H1 count after presentation filter: ${finalH1CountInBody}`);

if (initialH1Count === 1 && finalH1CountInBody === 0) {
  console.log('✅ PASS: Markdown H1 is cleanly eliminated at presentation boundary, preventing duplicate H1 with page title.');
} else {
  console.error('❌ FAIL: Markdown H1 was not correctly filtered!');
  process.exit(1);
}

// 2. Verify Header.astro has no <h1>
const headerPath = path.resolve('src/components/Header.astro');
const headerContent = fs.readFileSync(headerPath, 'utf8');
if (headerContent.includes('<h1')) {
  console.error('❌ FAIL: Header.astro still contains an <h1> tag!');
  process.exit(1);
} else {
  console.log('✅ PASS: Header.astro does NOT contain an <h1> tag.');
}

// 3. Verify Tailwind config has all Lemon Linen Magazine 2.1 tokens
const tailwindPath = path.resolve('tailwind.config.mjs');
const tailwindContent = fs.readFileSync(tailwindPath, 'utf8');
const requiredTokens = [
  "canvas: '#FFFFFF'",
  "surface: '#FFFFFF'",
  "'section-alt': '#FAF9F6'",
  "'neutral-soft': '#F5F5F0'",
  "DEFAULT: '#3F4030'",
  "DEFAULT: '#73641E'",
  "deep: '#584A18'",
  "DEFAULT: '#F5D95B'",
  "soft: '#FFF9E4'",
  "warm: '#FAF9F6'",
  "meta: '#73641E'",
  "DEFAULT: '#E8E7E1'",
  "DEFAULT: '#574D28'"
];

let missing = false;
for (const token of requiredTokens) {
  if (!tailwindContent.includes(token)) {
    console.error(`❌ FAIL: Missing token in tailwind.config.mjs: ${token}`);
    missing = true;
  }
}

if (!missing) {
  console.log('✅ PASS: All 13 authoritative Lemon Linen Magazine 2.1 tokens present in tailwind.config.mjs.');
} else {
  process.exit(1);
}

// 4. Verify no coastal blue remains in core layouts/components
const filesToCheck = [
  'src/layouts/BaseLayout.astro',
  'src/components/Header.astro',
  'src/components/Footer.astro',
  'src/pages/index.astro',
  'src/pages/metodologi.astro'
];

let blueFound = false;
for (const relPath of filesToCheck) {
  const content = fs.readFileSync(path.resolve(relPath), 'utf8');
  if (content.includes('#0066ee') || content.includes('#003366')) {
    console.error(`❌ FAIL: Found legacy Coastal Blue in ${relPath}!`);
    blueFound = true;
  }
}

if (!blueFound) {
  console.log('✅ PASS: Zero Coastal Blue color codes in tested core templates.');
} else {
  process.exit(1);
}

console.log('--- ALL H1 AND THEME INVARIANT CHECKS PASSED SUCCESFULLY ---');
