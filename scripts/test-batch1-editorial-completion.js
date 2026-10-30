import { DatabaseSync } from 'node:sqlite';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  BATCH_1_CANONICAL_BRIEFS,
  BATCH_1_SUPPORTING_BRIEFS
} from '../src/lib/media/editorial-visual-intelligence.ts';
import { loadCandidatesLedger } from '../src/lib/media/experimental-storage.ts';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');

const dbPath = path.resolve(
  rootDir,
  '.wrangler/state/v3/d1/miniflare-D1DatabaseObject/37bd9da5950b040e71b09fbfd7ca57290acb451dcd5dc35acb02655fa75fa480.sqlite'
);

console.log('======================================================================');
console.log('TEST SUITE: RANCANGLOKA_BATCH_1_EDITORIAL_COMPLETION');
console.log('======================================================================\n');

let passed = 0;
let total = 0;

function assert(condition, message) {
  total++;
  if (condition) {
    passed++;
    console.log(`  ✓ PASS: ${message}`);
  } else {
    console.error(`  ❌ FAIL: ${message}`);
    throw new Error(`Assertion failed: ${message}`);
  }
}

// -----------------------------------------------------------------------------
// PHASE 1: VERIFY ARTICLE MAPPING (D1 Database & Editorial Documents)
// -----------------------------------------------------------------------------
console.log('--- Phase 1: Article Identity & Database Mapping ---');

if (!fs.existsSync(dbPath)) {
  console.error('❌ Database not found at:', dbPath);
  process.exit(1);
}

const db = new DatabaseSync(dbPath);

const expectedBatch1 = [
  {
    id: 9993,
    titleContains: 'Dinding Rembes dan Cat Menggelembung',
    slug: 'dinding-rembes-dan-cat-menggelembung-cara-membedakan-masalah-talang-plesteran-kelembapan-tanah'
  },
  {
    id: 9999,
    titleContains: '7 Ide Menata Balkon Rumah Kecil',
    slug: '7-ide-menata-balkon-rumah-kecil-agar-nyaman'
  },
  {
    id: 10000,
    titleContains: 'Menata Denah Rumah Lebar 5–6 Meter',
    slug: 'menata-denah-rumah-lebar-5-6-meter-solusi-sirkulasi-bukaan-ruang-tengah-tidak-pengap'
  }
];

for (const exp of expectedBatch1) {
  const row = db.prepare('SELECT id, slug, title, status, featured_image, image_alt, content_html FROM articles WHERE id = ?').get(exp.id);
  assert(row !== undefined, `Article ID ${exp.id} exists in authoritative D1 database`);
  assert(row.slug === exp.slug, `Article ID ${exp.id} has exact slug: ${exp.slug}`);
  assert(row.title.includes(exp.titleContains), `Article ID ${exp.id} title contains "${exp.titleContains}" (Found: "${row.title}")`);
  assert(row.status === 'draft', `Article ID ${exp.id} status is strictly "draft" (not prematurely published)`);
  assert(row.featured_image === null, `Article ID ${exp.id} featured_image is NULL (zero auto-assignment)`);
  assert(row.content_html && row.content_html.length > 500, `Article ID ${exp.id} has substantive drafted HTML body (${row.content_html.length} chars)`);
}

// Verify that the old erroneous names are NOT in the database
const checkMeja = db.prepare("SELECT COUNT(*) as count FROM articles WHERE id IN (9993, 9999, 10000) AND title LIKE '%Meja Makan%'").get();
assert(checkMeja.count === 0, 'Zero Batch 1 articles incorrectly titled with "Meja Makan"');

const checkTampakDepan = db.prepare("SELECT COUNT(*) as count FROM articles WHERE id IN (9993, 9999, 10000) AND title LIKE '%Model Rumah Minimalis Tampak Depan%'").get();
assert(checkTampakDepan.count === 0, 'Zero Batch 1 articles incorrectly titled with "Model Rumah Minimalis Tampak Depan"');


// -----------------------------------------------------------------------------
// PHASE 2: VERIFY HERO IMAGE SELECTION & PROVENANCE
// -----------------------------------------------------------------------------
console.log('\n--- Phase 2: Hero Image Selection & Provenance Verification ---');

const candidates = loadCandidatesLedger();

// Article 9993: FLUX.1 Schnell v3 preferred
const candidate9993 = candidates.find(c => c.id === 'candidate-9993-flux-1-schnell-v3');
assert(candidate9993 !== undefined, 'Article #9993 FLUX v3 candidate exists in manifest');
assert(candidate9993.editorial_verdict === 'APPROVED_PREFERRED', 'Article #9993 FLUX v3 verdict is APPROVED_PREFERRED');
assert(candidate9993.approval_status === 'PENDING_REVIEW', 'Article #9993 FLUX v3 approval status is strictly PENDING_REVIEW');
assert(candidate9993.model.includes('flux') || candidate9993.provenance?.model_name === 'FLUX.1 Schnell', 'Article #9993 model is FLUX.1 Schnell');
assert(candidate9993.sha256 && candidate9993.sha256.length === 64, 'Article #9993 has valid SHA-256 binary hash');

// Article 9999: FLUX.1 Schnell preferred
const candidate9999 = candidates.find(c => c.id === 'candidate-9999-flux-1-schnell');
assert(candidate9999 !== undefined, 'Article #9999 FLUX candidate exists in manifest');
assert(candidate9999.editorial_verdict === 'APPROVED_PREFERRED', 'Article #9999 FLUX verdict is APPROVED_PREFERRED');
assert(candidate9999.approval_status === 'PENDING_REVIEW', 'Article #9999 FLUX approval status is strictly PENDING_REVIEW');
assert(candidate9999.model.includes('flux') || candidate9999.provenance?.model_name === 'FLUX.1 Schnell', 'Article #9999 model is FLUX.1 Schnell');

// Article 10000: SDXL Lightning owner choice
const candidate10000 = candidates.find(c => c.id === 'candidate-10000-sdxl-lightning');
assert(candidate10000 !== undefined, 'Article #10000 SDXL candidate exists in manifest');
assert(candidate10000.editorial_verdict === 'APPROVED_PREFERRED', 'Article #10000 SDXL verdict is APPROVED_PREFERRED');
assert(candidate10000.approval_status === 'PENDING_REVIEW', 'Article #10000 SDXL approval status is strictly PENDING_REVIEW');
assert(candidate10000.model.includes('sdxl') || candidate10000.provenance?.model_name === 'SDXL Lightning', 'Article #10000 model is SDXL Lightning');


// -----------------------------------------------------------------------------
// PHASE 3: SUPPORTING IMAGE PLAN (6 BRIEFS AUDIT)
// -----------------------------------------------------------------------------
console.log('\n--- Phase 3: Supporting Visual Plan Audit (6 Briefs) ---');

const expectedSlots = ['9993-S1', '9993-S2', '9999-S1', '9999-S2', '10000-S1', '10000-S2'];

for (const slotId of expectedSlots) {
  const brief = BATCH_1_SUPPORTING_BRIEFS[slotId];
  assert(brief !== undefined, `Slot ${slotId} is registered in BATCH_1_SUPPORTING_BRIEFS`);
  assert(brief.slotId === slotId, `Slot ${slotId} has matching slotId`);
  assert(brief.purpose === 'supporting', `Slot ${slotId} purpose is "supporting"`);
  assert(brief.articleSection && brief.articleSection.length > 5, `Slot ${slotId} maps to specific article section: "${brief.articleSection.slice(0, 35)}..."`);
  assert(brief.mainSubject && brief.mainSubject.length > 10, `Slot ${slotId} has comprehensive mainSubject`);
  assert(Array.isArray(brief.visualEvidence) && brief.visualEvidence.length >= 3, `Slot ${slotId} has >= 3 mandatory visual evidence points`);
  assert(brief.caption && brief.caption.length > 20, `Slot ${slotId} has complete editorial caption`);
  assert(brief.altText && brief.altText.length > 10, `Slot ${slotId} has accessible altText`);
  assert(brief.relevanceCheck && brief.relevanceCheck.length > 10, `Slot ${slotId} has relevance check`);
  assert(brief.geometryCheckPlan && brief.geometryCheckPlan.length > 10, `Slot ${slotId} has geometry check plan`);
  assert(brief.generationPromptOrInstructions && brief.generationPromptOrInstructions.length > 20, `Slot ${slotId} has prompt/instructions`);
}

// Technical specificity checks:
// 1. Article 9993-S1 must use DETERMINISTIC_SVG for water path cross-section
assert(
  BATCH_1_SUPPORTING_BRIEFS['9993-S1'].recommendedMethod === 'DETERMINISTIC_SVG',
  '9993-S1 (Water path diagram) uses DETERMINISTIC_SVG (not AI hallucinated)'
);

// 2. Article 9993-S2 must use AI_GENERATION for macro texture realism
assert(
  BATCH_1_SUPPORTING_BRIEFS['9993-S2'].recommendedMethod === 'AI_GENERATION',
  '9993-S2 (Macro blistering paint) uses AI_GENERATION (FLUX.1 Schnell)'
);

// 3. Article 9999-S1 & S2 must use AI_GENERATION for balcony photo realism
assert(
  BATCH_1_SUPPORTING_BRIEFS['9999-S1'].recommendedMethod === 'AI_GENERATION',
  '9999-S1 (Railing bar table) uses AI_GENERATION'
);
assert(
  BATCH_1_SUPPORTING_BRIEFS['9999-S2'].recommendedMethod === 'AI_GENERATION',
  '9999-S2 (Bistro chair corner & vertical planter) uses AI_GENERATION'
);

// 4. Article 10000-S1 & S2 must use DETERMINISTIC_SVG for technical floorplans and stack effect sections
assert(
  BATCH_1_SUPPORTING_BRIEFS['10000-S1'].recommendedMethod === 'DETERMINISTIC_SVG',
  '10000-S1 (Floorplan 6x15m) uses DETERMINISTIC_SVG (zero fake AI blueprints)'
);
assert(
  BATCH_1_SUPPORTING_BRIEFS['10000-S2'].recommendedMethod === 'DETERMINISTIC_SVG',
  '10000-S2 (Stack effect vertical section) uses DETERMINISTIC_SVG'
);


// -----------------------------------------------------------------------------
// PHASE 4: IMPLEMENTATION BOUNDARY (PRE-GENERATION REVIEW LOCK)
// -----------------------------------------------------------------------------
console.log('\n--- Phase 4: Implementation Boundary Verification ---');

for (const slotId of expectedSlots) {
  const brief = BATCH_1_SUPPORTING_BRIEFS[slotId];
  assert(brief.reviewStatus === 'PENDING_REVIEW', `Slot ${slotId} is locked to PENDING_REVIEW (pre-approval)`);
}

// Verify that no images have been generated prematurely for these slots
const storageDir = path.resolve(rootDir, 'storage/experimental-media');
const allStorageFiles = fs.readdirSync(storageDir);
const prematureFiles = allStorageFiles.filter(f => expectedSlots.some(s => f.includes(s.toLowerCase())));
assert(prematureFiles.length === 0, `Zero premature image files found in storage for supporting slots (Found: ${prematureFiles.length})`);


// -----------------------------------------------------------------------------
// PHASE 5: COMPARISON & ADMIN UI RENDERING
// -----------------------------------------------------------------------------
console.log('\n--- Phase 5: UI & Admin Rendering Invariants ---');

const comparisonPageCode = fs.readFileSync(path.resolve(rootDir, 'src/pages/admin/media/comparison-batch1.astro'), 'utf8');
assert(comparisonPageCode.includes('BATCH_1_SUPPORTING_BRIEFS'), 'Comparison page imports BATCH_1_SUPPORTING_BRIEFS');
assert(comparisonPageCode.includes('Rencana Gambar Pendamping (Editorial Visual Briefs)'), 'Comparison page renders Supporting Visuals Plan section');
assert(comparisonPageCode.includes('DETERMINISTIC_SVG'), 'Comparison page renders SVG badges');
assert(comparisonPageCode.includes('AI DIFFUSION (FLUX)'), 'Comparison page renders FLUX badges');

console.log('\n======================================================================');
console.log(`TOTAL TESTS: ${total}`);
console.log(`PASSED: ${passed}`);
console.log(`FAILED: ${total - passed}`);
console.log('======================================================================');
console.log('>>> ALL BATCH 1 EDITORIAL COMPLETION INVARIANTS PASS! <<<');
