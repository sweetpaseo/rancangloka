import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import assert from 'node:assert/strict';

import { AssertionReconciliationEngine } from '../src/lib/editorial/assertion-reconciliation.ts';
import { evaluateHumanWritingQuality } from '../src/lib/article/human-quality.ts';

test('CONTENT-EDITORIAL-RESTORE-1: Markdown formatting & reconciliation integrity', async (t) => {
  const dirA = path.resolve('scripts/content-bootstrap/restore-1/artA');
  const dirB = path.resolve('scripts/content-bootstrap/restore-1/artB');

  const mdA = fs.readFileSync(path.join(dirA, 'final-article.md'), 'utf8');
  const packA = JSON.parse(fs.readFileSync(path.join(dirA, 'evidence-pack.json'), 'utf8'));
  const ledgerA = JSON.parse(fs.readFileSync(path.join(dirA, 'assertion-ledger.json'), 'utf8'));
  const rinaA = JSON.parse(fs.readFileSync(path.join(dirA, 'rina-qa.json'), 'utf8'));

  const mdB = fs.readFileSync(path.join(dirB, 'final-article.md'), 'utf8');
  const packB = JSON.parse(fs.readFileSync(path.join(dirB, 'evidence-pack.json'), 'utf8'));
  const ledgerB = JSON.parse(fs.readFileSync(path.join(dirB, 'assertion-ledger.json'), 'utf8'));
  const rinaB = JSON.parse(fs.readFileSync(path.join(dirB, 'rina-qa.json'), 'utf8'));

  await t.test('Article A: Markdown structure preservation', () => {
    // 1. No collapsed whitespace bug (no "\\s{2,}" collapsing lines into a single run)
    assert.match(mdA, /\n\n/, 'Paragraphs must be separated by blank lines (\\n\\n)');

    // 2. Headings must exist, be non-empty, and precede actual content
    const headingMatches = mdA.match(/^#{1,6}\s+.+$/gm) || [];
    assert.ok(headingMatches.length >= 6, `Expected at least 6 headings, got ${headingMatches.length}`);
    assert.doesNotMatch(mdA, /^#{1,6}\s*$/m, 'Headings must not be empty');

    // 3. No collapsed list markers like "1. 2." or "3. 4."
    assert.doesNotMatch(mdA, /\b1\.\s+2\./, 'List items must not be collapsed ("1. 2.")');
    assert.doesNotMatch(mdA, /\b3\.\s+4\./, 'List items must not be collapsed ("3. 4.")');
    assert.doesNotMatch(mdA, /\b6\.\s+7\./, 'List items must not be collapsed ("6. 7.")');

    // 4. Ordered list sequence 1 through 7 must be intact
    for (let i = 1; i <= 7; i++) {
      assert.match(mdA, new RegExp(`^${i}\\.\\s+`, 'm'), `Missing ordered list item ${i}.`);
    }

    // 5. No raw claim markers in public text
    assert.doesNotMatch(mdA, /\[CLM-[A-Za-z0-9-]+\]/, 'No raw [CLM-xxx] markers allowed in article body');

    // 6. Only verified public internal link
    assert.match(mdA, /\/rekayasa-ventilasi-silang-alami-untuk-rumah-tropis-yang-lebih-nyaman/, 'Must include valid public internal link');
    assert.doesNotMatch(mdA, /\/kusen-aluminium-vs-upvc-untuk-rumah-tropis-di-indonesia/, 'Must not link unverified/draft routes');
    assert.doesNotMatch(mdA, /\/material\/kaca-insulasi/, 'Must not link hypothetical routes');
  });

  await t.test('Article A: Assertion accountability & Rina score', () => {
    assert.equal(ledgerA.metrics.unresolved_assertion_count, 0, 'Unresolved assertions must be exactly 0');
    assert.equal(ledgerA.unresolved_spans.length, 0, 'Unresolved spans array must be empty');
    assert.ok(ledgerA.metrics.evidence_backed_count >= 20, 'Must have at least 20 evidence-backed assertions');
    assert.ok(rinaA.total_score >= 80, `Rina score must be >= 80, got ${rinaA.total_score}`);
    assert.equal(rinaA.decision, 'HUMAN_WRITING_PASS', 'Rina decision must be HUMAN_WRITING_PASS');
  });

  await t.test('Article B: Markdown structure preservation', () => {
    assert.match(mdB, /\n\n/, 'Paragraphs must be separated by blank lines (\\n\\n)');

    const headingMatches = mdB.match(/^#{1,6}\s+.+$/gm) || [];
    assert.ok(headingMatches.length >= 6, `Expected at least 6 headings, got ${headingMatches.length}`);
    assert.doesNotMatch(mdB, /^#{1,6}\s*$/m, 'Headings must not be empty');

    assert.doesNotMatch(mdB, /\b1\.\s+2\./, 'List items must not be collapsed ("1. 2.")');
    assert.doesNotMatch(mdB, /\b3\.\s+4\./, 'List items must not be collapsed ("3. 4.")');
    assert.doesNotMatch(mdB, /\b6\.\s+7\./, 'List items must not be collapsed ("6. 7.")');

    for (let i = 1; i <= 7; i++) {
      assert.match(mdB, new RegExp(`^${i}\\.\\s+`, 'm'), `Missing ordered list item ${i}.`);
    }

    assert.doesNotMatch(mdB, /\[CLM-[A-Za-z0-9-]+\]/, 'No raw [CLM-xxx] markers allowed in article body');

    assert.match(mdB, /\/rekayasa-ventilasi-silang-alami-untuk-rumah-tropis-yang-lebih-nyaman/, 'Must include valid public internal link');
    assert.doesNotMatch(mdB, /\/kusen-aluminium-vs-upvc-untuk-rumah-tropis-di-indonesia/, 'Must not link unverified/draft routes');
  });

  await t.test('Article B: Assertion accountability & Rina score', () => {
    assert.equal(ledgerB.metrics.unresolved_assertion_count, 0, 'Unresolved assertions must be exactly 0');
    assert.equal(ledgerB.unresolved_spans.length, 0, 'Unresolved spans array must be empty');
    assert.ok(ledgerB.metrics.evidence_backed_count >= 20, 'Must have at least 20 evidence-backed assertions');
    assert.ok(rinaB.total_score >= 80, `Rina score must be >= 80, got ${rinaB.total_score}`);
    assert.equal(rinaB.decision, 'HUMAN_WRITING_PASS', 'Rina decision must be HUMAN_WRITING_PASS');
  });

  await t.test('Word count policy (natural 1,100 - 1,800 range)', () => {
    const wordsA = mdA.trim().split(/\s+/).length;
    const wordsB = mdB.trim().split(/\s+/).length;

    console.log(`Audited Word Counts: Article A = ${wordsA}, Article B = ${wordsB}`);
    assert.ok(wordsA >= 1100 && wordsA <= 1800, `Article A words (${wordsA}) should be within 1,100 - 1,800`);
    assert.ok(wordsB >= 1100 && wordsB <= 1800, `Article B words (${wordsB}) should be within 1,100 - 1,800`);
  });
});
