import assert from 'node:assert/strict';
import { getRelatedArticles } from '../src/lib/db.ts';

console.log('=== TEST SUITE: RELATED ARTICLES RECOMMENDATION & EDITORIAL QUALITY ENGINE ===\n');

// 1. Mock DB factory that supports single-query candidate retrieval and metadata lookup
function createMockDb(articleRows) {
  return {
    prepare(sql) {
      return {
        bind(...args) {
          return {
            async first() {
              if (sql.includes('WHERE id = ?')) {
                const targetId = args[0];
                const found = articleRows.find(a => a.id === targetId);
                return found || null;
              }
              return null;
            },
            async all() {
              const currentId = args[0];
              // All published articles excluding currentId
              const results = articleRows.filter(a => a.id !== currentId && a.status === 'published');
              return { results };
            }
          };
        }
      };
    }
  };
}

// Dataset: realistic articles
const mockPool = [
  { id: 101, slug: 'atap-metal-genteng-beton', title: 'Atap Metal vs Genteng Beton', category_id: 3, description: 'Komparasi atap rumah tinggal', status: 'published', published_at: '2026-10-20' },
  { id: 102, slug: 'sistem-shading-atap-overhang', title: 'Sistem Shading Luar Overhang Atap', category_id: 3, description: 'Shading pasif atap overhang', status: 'published', published_at: '2026-10-21' },
  { id: 103, slug: 'dinding-rembes-talang-bocor', title: 'Dinding Rembes dan Masalah Talang', category_id: 8, description: 'Diagnosis talang bocor', status: 'published', published_at: '2026-10-22' },
  { id: 104, slug: 'kusen-aluminium-upvc-biaya', title: 'Kusen Aluminium vs UPVC: Analisis Biaya', category_id: 4, description: 'Profil kusen jendela', status: 'published', published_at: '2026-10-23' },
  { id: 105, slug: 'artikel-105-draft', title: 'Draft Belum Terbit', category_id: 3, status: 'draft', published_at: '2026-10-24' },
  { id: 106, slug: 'mengapa-rumah-menghadap-barat-selalu-panas', title: 'Quarantined Prototype', category_id: 3, status: 'published', published_at: '2026-10-25' }
];

async function runTests() {
  // Test 1: Self-exclusion
  console.log('Test 1: Excludes current article (no self-recommendation)');
  const db1 = createMockDb(mockPool);
  const res1 = await getRelatedArticles(db1, 101, 3, 3, { title: 'Atap Metal vs Genteng Beton' });
  assert.ok(!res1.some(a => a.id === 101), 'Current article must not appear in recommendations');
  console.log('  ✅ PASS: Self-recommendation prevented');

  // Test 2: Draft exclusion
  console.log('Test 2: Excludes drafts and non-published articles');
  const res2 = await getRelatedArticles(db1, 101, 3, 5, { title: 'Atap Metal vs Genteng Beton' });
  assert.ok(!res2.some(a => a.status === 'draft'), 'Drafts must be strictly excluded');
  assert.ok(!res2.some(a => a.id === 105), 'Article 105 (draft) excluded');
  console.log('  ✅ PASS: Drafts strictly excluded');

  // Test 3: Quarantined content exclusion
  console.log('Test 3: Excludes quarantined content');
  const res3 = await getRelatedArticles(db1, 101, 3, 5, { title: 'Atap Metal vs Genteng Beton' });
  assert.ok(!res3.some(a => a.slug === 'mengapa-rumah-menghadap-barat-selalu-panas'), 'Quarantined prototype excluded');
  console.log('  ✅ PASS: Quarantined articles strictly excluded');

  // Test 4: Realistic dataset — 0 eligible articles
  console.log('Test 4: Dataset with 0 eligible articles');
  const emptyDb = createMockDb([{ id: 99, slug: 'solo', title: 'Solo', category_id: 1, status: 'published' }]);
  const res0 = await getRelatedArticles(emptyDb, 99, 1, 3);
  assert.equal(res0.length, 0, 'Should return empty array when no other articles exist');
  console.log('  ✅ PASS: 0 eligible articles returns []');

  // Test 5: Realistic dataset — 1 eligible article
  console.log('Test 5: Dataset with 1 eligible article');
  const dbSingle = createMockDb([
    { id: 201, slug: 'art-201', title: 'First', category_id: 1, status: 'published', published_at: '2026-10-01' },
    { id: 202, slug: 'art-202', title: 'Second', category_id: 2, status: 'published', published_at: '2026-10-02' }
  ]);
  const resSingle = await getRelatedArticles(dbSingle, 201, 1, 3);
  assert.equal(resSingle.length, 1, 'Should return exactly 1 article');
  assert.equal(resSingle[0].id, 202);
  console.log('  ✅ PASS: 1 eligible article returns 1 item');

  // Test 6: Realistic dataset — 2 eligible articles
  console.log('Test 6: Dataset with 2 eligible articles');
  const dbDouble = createMockDb([
    { id: 301, slug: 'art-301', title: 'Main', category_id: 1, status: 'published', published_at: '2026-10-01' },
    { id: 302, slug: 'art-302', title: 'Second', category_id: 1, status: 'published', published_at: '2026-10-02' },
    { id: 303, slug: 'art-303', title: 'Third', category_id: 2, status: 'published', published_at: '2026-10-03' }
  ]);
  const resDouble = await getRelatedArticles(dbDouble, 301, 1, 3);
  assert.equal(resDouble.length, 2, 'Should return exactly 2 articles');
  console.log('  ✅ PASS: 2 eligible articles returns 2 items');

  // Test 7: Realistic dataset — 3 or more eligible articles
  console.log('Test 7: Dataset with 3 or more eligible articles');
  const resMany = await getRelatedArticles(db1, 101, 3, 3, { title: 'Atap Metal vs Genteng Beton' });
  assert.equal(resMany.length, 3, 'Should return exactly 3 articles when limit is 3');
  console.log('  ✅ PASS: 3 eligible articles returns exactly 3 items');

  // Test 8: Relevance priority (Same category and material overlap preferred)
  console.log('Test 8: Priority ranking (Same category & topic first)');
  const firstItem = resMany[0];
  assert.equal(firstItem.id, 102, 'Shading/overhang article (id 102) must be ranked first due to category & topic overlap');
  console.log('  ✅ PASS: Highest relevance article prioritized');

  // Test 9: Deduplication across candidate IDs
  console.log('Test 9: Deduplication (Zero duplicate IDs)');
  const ids = resMany.map(a => a.id);
  const uniqueIds = new Set(ids);
  assert.equal(ids.length, uniqueIds.size, 'No duplicates in results');
  console.log('  ✅ PASS: Results are deduplicated');

  // Test 10: excludeIds option
  console.log('Test 10: excludeIds option (e.g. for BACA JUGA deduplication)');
  const resExclude = await getRelatedArticles(db1, 101, 3, 3, { title: 'Atap Metal vs Genteng Beton', excludeIds: [102] });
  assert.ok(!resExclude.some(a => a.id === 102), 'Excluded ID 102 must not appear');
  console.log('  ✅ PASS: excludeIds respected');

  // Test 11: Near-Duplicate Topic Suppression across Candidates (Diversity Check)
  console.log('Test 11: Near-duplicate topic suppression across recommendations (Diversity)');
  const dbDuplicateTopics = createMockDb([
    { id: 401, slug: 'art-401', title: 'Atap Metal vs Genteng Beton', category_id: 3, status: 'published', published_at: '2026-10-15' },
    { id: 402, slug: 'art-402', title: 'Kusen Aluminium vs UPVC: Analisis Daya Tahan dan Biaya', category_id: 4, status: 'published', published_at: '2026-10-20' },
    { id: 403, slug: 'art-403', title: 'Kusen Aluminium vs uPVC untuk Rumah Tropis di Indonesia', category_id: 4, status: 'published', published_at: '2026-10-14' },
    { id: 404, slug: 'art-404', title: 'Penyebab Lantai Keramik Terangkat (Popping)', category_id: 4, status: 'published', published_at: '2026-10-10' },
    { id: 405, slug: 'art-405', title: 'Dasar Pencahayaan Alami untuk Rumah Tropis', category_id: 6, status: 'published', published_at: '2026-10-13' }
  ]);
  const resDiversity = await getRelatedArticles(dbDuplicateTopics, 401, 3, 3, { title: 'Atap Metal vs Genteng Beton' });
  const kusenCount = resDiversity.filter(a => a.title.toLowerCase().includes('kusen aluminium')).length;
  assert.equal(kusenCount, 1, 'Only ONE kusen aluminium article should be recommended, suppressing near-duplicate');
  console.log('  ✅ PASS: Near-duplicate kusen recommendations suppressed to exactly 1');

  // Test 12: Source Topic Near-Duplicate Exclusion
  console.log('Test 12: Source topic near-duplicate exclusion (Reader already on this topic)');
  // Reader is reading about Kusen Aluminium vs uPVC (id 403). Candidate id 402 is another Kusen Aluminium article.
  const resSourceDup = await getRelatedArticles(dbDuplicateTopics, 403, 4, 3, { title: 'Kusen Aluminium vs uPVC untuk Rumah Tropis di Indonesia' });
  assert.ok(!resSourceDup.some(a => a.id === 402), 'Candidate with identical topic signature to source article must be excluded from primary recommendations');
  console.log('  ✅ PASS: Source near-duplicate excluded; reader offered complementary topics');

  // Test 13: Architectural Domain Semantic Association
  console.log('Test 13: Architectural domain semantic association (Weather Envelope)');
  // Article about roof (id 101) should rank talang/rembes (id 103) higher than generic flooring/plumbing
  const resDomain = await getRelatedArticles(db1, 101, 3, 3, { title: 'Atap Metal vs Genteng Beton' });
  const idsInOrder = resDomain.map(a => a.id);
  assert.ok(idsInOrder.indexOf(103) < idsInOrder.indexOf(104), 'Talang rembes (id 103) must rank ahead of Kusen (id 104) for roof article');
  console.log('  ✅ PASS: Domain weather-envelope association correctly prioritizes related systems');

  console.log('\n==================================================');
  console.log('ALL 13 RELATED ARTICLES QUALITY TESTS PASSED!');
  console.log('==================================================\n');
}

runTests().catch(err => {
  console.error('Test failure:', err);
  process.exit(1);
});
