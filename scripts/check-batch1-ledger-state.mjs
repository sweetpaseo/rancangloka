import fs from 'node:fs';
import path from 'node:path';

const manifestPath = path.resolve('storage/experimental-media/candidates-manifest.json');
const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));

const targets = [
  // Heroes
  { type: 'hero', articleId: 9993, expectedId: 'candidate-9993-flux-1-schnell-v3' },
  { type: 'hero', articleId: 9999, expectedId: 'candidate-9999-flux-1-schnell' },
  { type: 'hero', articleId: 10000, expectedId: 'candidate-10000-sdxl-lightning' },
  // Supporting
  { type: 'supporting', articleId: 9993, slot: 'S1', expectedId: 'candidate-9993-s1-jalur-rembesan-svg' },
  { type: 'supporting', articleId: 9993, slot: 'S2', expectedId: 'candidate-9993-s2-detail-cat-menggelembung-flux-v2' },
  { type: 'supporting', articleId: 9999, slot: 'S1', expectedId: 'candidate-9999-s1-meja-gantung-railing-flux-v2' },
  { type: 'supporting', articleId: 9999, slot: 'S2', expectedId: 'candidate-9999-s2-sudut-santai-tanaman-vertikal-flux' },
  { type: 'supporting', articleId: 10000, slot: 'S1', expectedId: 'candidate-10000-s1-denah-konseptual-inner-court-svg' },
  { type: 'supporting', articleId: 10000, slot: 'S2', expectedId: 'candidate-10000-s2-potongan-void-stack-ventilation-svg' }
];

console.log('=== ACTUAL CANDIDATE LEDGER AUDIT ===\n');
let allApproved = true;
const pendingOrRejected = [];

targets.forEach((t, i) => {
  const cand = manifest.find(c => (c.id || c.candidate_id) === t.expectedId);
  const status = cand ? cand.approval_status : 'MISSING';
  const reviewer = cand?.reviewed_by || '-';
  const at = cand?.reviewed_at || '-';
  const isApp = status === 'APPROVED';
  if (!isApp) {
    allApproved = false;
    pendingOrRejected.push({ ...t, status, reviewer, at });
  }
  console.log(`${i + 1}. [Article #${t.articleId}] ${t.type.toUpperCase()} ${t.slot || ''} (${t.expectedId}) -> Status: ${status} | Reviewer: ${reviewer} | At: ${at}`);
});

console.log('\n--- SUMMARY ---');
console.log('Total Targets:', targets.length);
console.log('Total Approved:', targets.length - pendingOrRejected.length);
console.log('Total Not Approved:', pendingOrRejected.length);
console.log('All 9 Approved?', allApproved);

if (!allApproved) {
  console.log('\nCandidates NOT approved yet:');
  pendingOrRejected.forEach(p => {
    console.log(`- [Article #${p.articleId}] ${p.expectedId}: status=${p.status}`);
  });
}
