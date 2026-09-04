/**
 * RancangLoka — Migration 0003 Local Matrix Tests
 *
 * Validates:
 * SCENARIO 1: legacy authors IDs 1 and 2 exist, canonical author absent -> added with new generated ID
 * SCENARIO 2: canonical author already exists correctly -> idempotent, no duplicate
 * SCENARIO 3: canonical slug occupied by different name -> rollout precondition detects conflict & BLOCKS
 * SCENARIO 4: canonical name exists under different slug -> rollout precondition detects conflict & BLOCKS
 */

import { DatabaseSync } from 'node:sqlite';
import fs from 'fs';

const migrationSql = fs.readFileSync('db/migrations/0003_canonical_editorial_author.sql', 'utf8');

let passed = 0;
let failed = 0;

function assert(condition, message) {
  if (condition) {
    console.log(`  ✅ PASS: ${message}`);
    passed++;
  } else {
    console.error(`  ❌ FAIL: ${message}`);
    failed++;
  }
}

function checkRolloutPrecondition(db) {
  // Precondition logic:
  // Case A: neither canonical name nor canonical slug exists -> OK to insert
  // Case B: both name + slug already exist on the same row -> OK (already applied/idempotent)
  // Case C: canonical name exists with another slug -> CONFLICT BLOCK
  // Case D: canonical slug exists with another name -> CONFLICT BLOCK

  const rows = db.prepare(`
    SELECT id, name, slug, role
    FROM authors
    WHERE lower(trim(name)) = lower('RancangLoka Editorial Desk')
       OR slug = 'dewan-redaksi-spasial'
  `).all();

  if (rows.length === 0) {
    return { status: 'SAFE_TO_INSERT', rows };
  }
  if (rows.length === 1) {
    const r = rows[0];
    if (r.name.trim().toLowerCase() === 'rancangloka editorial desk' && r.slug === 'dewan-redaksi-spasial') {
      return { status: 'ALREADY_EXISTS_CORRECTLY', rows };
    }
    if (r.name.trim().toLowerCase() === 'rancangloka editorial desk') {
      return { status: 'BLOCK_CONFLICT_NAME_DIFFERENT_SLUG', rows };
    }
    if (r.slug === 'dewan-redaksi-spasial') {
      return { status: 'BLOCK_CONFLICT_SLUG_DIFFERENT_NAME', rows };
    }
  }
  return { status: 'BLOCK_MULTIPLE_INCONSISTENT_ROWS', rows };
}

function createBaseTable(db) {
  db.exec(`
    CREATE TABLE authors (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      slug TEXT NOT NULL UNIQUE,
      bio TEXT,
      avatar TEXT,
      role TEXT DEFAULT 'Editor',
      social_links TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
  `);
}

function testScenario1() {
  const db = new DatabaseSync(':memory:');
  createBaseTable(db);
  db.exec(`
    INSERT INTO authors (id, name, slug, role) VALUES
      (1, 'Dimas Prasetyo, IAI', 'dimas-prasetyo', 'Chief Architectural Editor'),
      (2, 'Clarissa Amanda', 'clarissa-amanda', 'Interior Stylist & Columnist');
  `);

  const precheck = checkRolloutPrecondition(db);
  assert(precheck.status === 'SAFE_TO_INSERT', 'Scenario 1: Precondition confirms safe to insert');

  db.exec(migrationSql);

  const authors = db.prepare('SELECT * FROM authors ORDER BY id ASC').all();
  assert(authors.length === 3, 'Scenario 1: Table now has 3 authors');
  assert(authors[0].id === 1 && authors[0].name === 'Dimas Prasetyo, IAI', 'Scenario 1: Legacy ID 1 preserved');
  assert(authors[1].id === 2 && authors[1].name === 'Clarissa Amanda', 'Scenario 1: Legacy ID 2 preserved');
  assert(authors[2].id === 3 && authors[2].name === 'RancangLoka Editorial Desk' && authors[2].slug === 'dewan-redaksi-spasial', 'Scenario 1: Canonical author added with autoincrement ID 3');
}

function testScenario2() {
  const db = new DatabaseSync(':memory:');
  createBaseTable(db);
  db.exec(`
    INSERT INTO authors (id, name, slug, role) VALUES
      (1, 'Dimas Prasetyo, IAI', 'dimas-prasetyo', 'Chief Architectural Editor'),
      (2, 'Clarissa Amanda', 'clarissa-amanda', 'Interior Stylist & Columnist'),
      (3, 'RancangLoka Editorial Desk', 'dewan-redaksi-spasial', 'Editorial Desk');
  `);

  const precheck = checkRolloutPrecondition(db);
  assert(precheck.status === 'ALREADY_EXISTS_CORRECTLY', 'Scenario 2: Precondition detects existing canonical author');

  db.exec(migrationSql);

  const authors = db.prepare('SELECT * FROM authors ORDER BY id ASC').all();
  assert(authors.length === 3, 'Scenario 2: Idempotent - no duplicate created');
}

function testScenario3() {
  const db = new DatabaseSync(':memory:');
  createBaseTable(db);
  db.exec(`
    INSERT INTO authors (id, name, slug, role) VALUES
      (1, 'Different Person', 'dewan-redaksi-spasial', 'Editor');
  `);

  const precheck = checkRolloutPrecondition(db);
  assert(precheck.status === 'BLOCK_CONFLICT_SLUG_DIFFERENT_NAME', 'Scenario 3: Precondition BLOCKS rollout on conflicting slug');
}

function testScenario4() {
  const db = new DatabaseSync(':memory:');
  createBaseTable(db);
  db.exec(`
    INSERT INTO authors (id, name, slug, role) VALUES
      (1, 'RancangLoka Editorial Desk', 'different-slug', 'Editor');
  `);

  const precheck = checkRolloutPrecondition(db);
  assert(precheck.status === 'BLOCK_CONFLICT_NAME_DIFFERENT_SLUG', 'Scenario 4: Precondition BLOCKS rollout on conflicting name');
}

console.log('--- Running Migration 0003 Local Matrix Tests ---');
testScenario1();
testScenario2();
testScenario3();
testScenario4();

console.log(`\nResults: ${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
