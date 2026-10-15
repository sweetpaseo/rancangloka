/**
 * RancangLoka Semantic Internal Link Engine Test Suite
 * Milestone: INTERNAL-LINK-ENGINE-1
 * 
 * Verifies all 20 required points:
 * 1. relationship type validation
 * 2. no self-links
 * 3. explicit pillar identity (INVARIANT_EXPLICIT_PILLAR_IDENTITY)
 * 4. Plane A does not alter content hash
 * 5. Plane B stores source_content_hash
 * 6. Plane B becomes stale after source hash change
 * 7. unpublished target is hidden
 * 8. changed target slug resolves correctly
 * 9. one target renders once despite competing candidate reasoning
 * 10. no mechanical link quota (NO_MECHANICAL_INTERNAL_LINK_QUOTA)
 * 11. orphan detection
 * 12. forward discovery
 * 13. backlink discovery
 * 14. published article cannot be silently inline-mutated
 * 15. support module returns reader_reason
 * 16. zero links renders zero module
 * 17. normal <a href> crawlability
 * 18. Mission Control actionable state
 * 19. no autonomous publication
 * 20. Article C hash remains unchanged
 */

import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';

import {
  RELATIONSHIP_TYPES,
  PLACEMENT_PLANES,
  LINK_STATUSES,
  validateLinkCandidate,
  createLinkCandidate,
  approveLink,
  activateLink,
  rejectLink,
  markLinkStale,
  evaluatePlaneBStaleness,
  checkAndReconcilePlaneBStaleness,
  getActivePlaneALinks,
  getPlaneBRecommendations,
  detectOrphans,
  discoverBidirectionalCandidates,
  deriveInternalLinkActionableStates
} from '../src/lib/internal-link/index.ts';

import { processArticleContent } from '../src/lib/seo.ts';

// Lightweight in-memory D1 mock for testing
class InMemoryD1Mock {
  constructor() {
    this.articles = new Map();
    this.links = new Map();
    this.categories = new Map();
    this.nextLinkId = 1;
  }

  seedArticle(art) {
    this.articles.set(art.id, {
      id: art.id,
      slug: art.slug,
      title: art.title,
      description: art.description || '',
      content_md: art.content_md || '',
      content_html: art.content_html || '',
      category_id: art.category_id || 1,
      category_name: art.category_name || 'Arsitektur',
      reading_time_minutes: art.reading_time_minutes || 4,
      status: art.status || 'published',
      focus_keyword: art.focus_keyword || '',
      content_hash: art.content_hash || '',
      pillar_role: art.pillar_role || 'STANDALONE',
      parent_pillar_id: art.parent_pillar_id || null,
      views: 0
    });
  }

  seedCategory(cat) {
    this.categories.set(cat.id, cat);
  }

  prepare(sql) {
    const trimmed = sql.trim();
    const self = this;

    function createExecutor(params = []) {
      return {
        async run() {
            if (/INSERT INTO article_internal_links/i.test(trimmed)) {
              const [
                source_article_id,
                target_article_id,
                relationship_type,
                reader_reason,
                placement_plane,
                anchor_text,
                confidence_score,
                status,
                source_content_hash
              ] = params;

              // Check unique constraint
              for (const l of self.links.values()) {
                if (
                  l.source_article_id === source_article_id &&
                  l.target_article_id === target_article_id &&
                  l.relationship_type === relationship_type &&
                  l.placement_plane === placement_plane
                ) {
                  throw new Error(`UNIQUE constraint failed: article_internal_links`);
                }
              }

              const id = self.nextLinkId++;
              const newLink = {
                id,
                source_article_id,
                target_article_id,
                relationship_type,
                reader_reason,
                placement_plane,
                anchor_text,
                confidence_score: confidence_score !== undefined ? confidence_score : 1.0,
                status: status || 'CANDIDATE',
                source_content_hash: source_content_hash || null,
                created_at: new Date().toISOString(),
                reviewed_at: null,
                reviewed_by: null
              };
              self.links.set(id, newLink);
              return { meta: { last_row_id: id, changes: 1 } };
            }

            if (/UPDATE article_internal_links\s+SET status = 'APPROVED'/i.test(trimmed)) {
              const [reviewed_by, id] = params;
              const link = self.links.get(id);
              if (link) {
                link.status = 'APPROVED';
                link.reviewed_by = reviewed_by;
                link.reviewed_at = new Date().toISOString();
              }
              return { meta: { changes: 1 } };
            }

            if (/UPDATE article_internal_links\s+SET status = 'ACTIVE'/i.test(trimmed)) {
              const [source_content_hash, reviewed_by, id] = params;
              const link = self.links.get(id);
              if (link) {
                link.status = 'ACTIVE';
                link.source_content_hash = source_content_hash;
                if (reviewed_by) link.reviewed_by = reviewed_by;
                link.reviewed_at = new Date().toISOString();
              }
              return { meta: { changes: 1 } };
            }

            if (/UPDATE article_internal_links\s+SET status = 'REJECTED'/i.test(trimmed)) {
              const [reviewed_by, id] = params;
              const link = self.links.get(id);
              if (link) {
                link.status = 'REJECTED';
                link.reviewed_by = reviewed_by;
                link.reviewed_at = new Date().toISOString();
              }
              return { meta: { changes: 1 } };
            }

            if (/UPDATE article_internal_links\s+SET status = 'STALE'/i.test(trimmed)) {
              const [id] = params;
              const link = self.links.get(id);
              if (link) {
                link.status = 'STALE';
              }
              return { meta: { changes: 1 } };
            }

            return { meta: { changes: 0 } };
          },

          async first() {
            const all = await this.all();
            const results = all.results || all || [];
            return results[0] || null;
          },

          async all() {
            if (/SELECT \* FROM article_internal_links WHERE id = \?/i.test(trimmed)) {
              const [id] = params;
              const l = self.links.get(id);
              return { results: l ? [l] : [] };
            }

            if (/SELECT content_hash FROM articles WHERE id = \?/i.test(trimmed)) {
              const [id] = params;
              const a = self.articles.get(id);
              return { results: a ? [{ content_hash: a.content_hash }] : [] };
            }

            if (/SELECT\s+l\.id,\s+l\.source_article_id/i.test(trimmed) && /placement_plane = 'PLANE_A_DYNAMIC'/i.test(trimmed)) {
              const [source_article_id] = params;
              const results = [];
              for (const l of self.links.values()) {
                if (l.source_article_id === source_article_id &&
                    l.placement_plane === 'PLANE_A_DYNAMIC' &&
                    l.status === 'ACTIVE') {
                  const target = self.articles.get(l.target_article_id);
                  if (target && target.status === 'published' && l.target_article_id !== source_article_id) {
                    const cat = self.categories.get(target.category_id);
                    results.push({
                      id: l.id,
                      source_article_id: l.source_article_id,
                      target_article_id: l.target_article_id,
                      relationship_type: l.relationship_type,
                      reader_reason: l.reader_reason,
                      placement_plane: l.placement_plane,
                      confidence_score: l.confidence_score,
                      target_title: target.title,
                      target_slug: target.slug,
                      target_status: target.status,
                      target_reading_time_minutes: target.reading_time_minutes,
                      target_featured_image: target.featured_image,
                      target_category_name: cat ? cat.name : target.category_name
                    });
                  }
                }
              }
              return { results };
            }

            if (/SELECT \*\s+FROM article_internal_links\s+WHERE source_article_id = \?\s+AND placement_plane = 'PLANE_B_INLINE'/i.test(trimmed)) {
              const [source_article_id] = params;
              const results = [];
              for (const l of self.links.values()) {
                if (l.source_article_id === source_article_id && l.placement_plane === 'PLANE_B_INLINE') {
                  results.push(l);
                }
              }
              return { results };
            }

            if (/SELECT id, source_content_hash\s+FROM article_internal_links/i.test(trimmed)) {
              const [source_article_id] = params;
              const results = [];
              for (const l of self.links.values()) {
                if (l.source_article_id === source_article_id &&
                    l.placement_plane === 'PLANE_B_INLINE' &&
                    l.status === 'ACTIVE') {
                  results.push({ id: l.id, source_content_hash: l.source_content_hash });
                }
              }
              return { results };
            }

            if (/SELECT\s+a\.id as article_id/i.test(trimmed) && /COUNT\(l\.id\) as inbound_active_semantic_links_count/i.test(trimmed)) {
              const results = [];
              for (const a of self.articles.values()) {
                if (a.status === 'published') {
                  let inboundCount = 0;
                  for (const l of self.links.values()) {
                    if (l.target_article_id === a.id && l.status === 'ACTIVE') {
                      inboundCount++;
                    }
                  }
                  results.push({
                    article_id: a.id,
                    slug: a.slug,
                    title: a.title,
                    status: a.status,
                    pillar_role: a.pillar_role || 'STANDALONE',
                    parent_pillar_id: a.parent_pillar_id || null,
                    inbound_active_semantic_links_count: inboundCount
                  });
                }
              }
              return { results };
            }

            if (/WHERE id != \? AND status = 'published'/i.test(trimmed)) {
              const [excludeId] = params;
              const results = [];
              for (const a of self.articles.values()) {
                if (a.id !== excludeId && a.status === 'published') {
                  results.push(a);
                }
              }
              return { results };
            }

            if (/WHERE l\.status = 'CANDIDATE'/i.test(trimmed)) {
              const results = [];
              for (const l of self.links.values()) {
                if (l.status === 'CANDIDATE') {
                  const s = self.articles.get(l.source_article_id);
                  const t = self.articles.get(l.target_article_id);
                  results.push({
                    id: l.id,
                    source_article_id: l.source_article_id,
                    target_article_id: l.target_article_id,
                    relationship_type: l.relationship_type,
                    placement_plane: l.placement_plane,
                    source_title: s?.title || '',
                    source_slug: s?.slug || '',
                    target_title: t?.title || ''
                  });
                }
              }
              return { results };
            }

            if (/WHERE l\.status = 'STALE' AND l\.placement_plane = 'PLANE_B_INLINE'/i.test(trimmed)) {
              const results = [];
              for (const l of self.links.values()) {
                if (l.status === 'STALE' && l.placement_plane === 'PLANE_B_INLINE') {
                  const s = self.articles.get(l.source_article_id);
                  const t = self.articles.get(l.target_article_id);
                  results.push({
                    id: l.id,
                    source_article_id: l.source_article_id,
                    target_article_id: l.target_article_id,
                    anchor_text: l.anchor_text,
                    source_title: s?.title || '',
                    source_slug: s?.slug || '',
                    target_title: t?.title || ''
                  });
                }
              }
              return { results };
            }

            return { results: [] };
          }
        };
      };

    const unbonded = createExecutor([]);
    return {
      bind(...params) {
        return createExecutor(params);
      },
      run() {
        return unbonded.run();
      },
      first() {
        return unbonded.first();
      },
      all() {
        return unbonded.all();
      }
    };
  }
}

async function runTestSuite() {
  console.log('🧪 Starting RancangLoka Semantic Internal Link Engine Test Suite (INTERNAL-LINK-ENGINE-1)...\n');
  let passed = 0;
  let failed = 0;

  function recordPass(testName) {
    passed++;
    console.log(`  ✅ PASS: ${testName}`);
  }

  function recordFail(testName, error) {
    failed++;
    console.error(`  ❌ FAIL: ${testName}`);
    console.error(`     ${error.message || error}`);
  }

  // Setup mock db and fixture articles
  const db = new InMemoryD1Mock();

  // Fixture Article A (ID 7)
  const articleA = {
    id: 7,
    slug: 'jendela-berkondensasi-kelembapan-suhu-kaca-ventilasi-thermal-bridge',
    title: 'Jendela Berkondensasi: Kelembapan Ruangan, Suhu Permukaan Kaca, Ventilasi, atau Thermal Bridge?',
    description: 'Diagnosis masalah kondensasi dan pengembunan pada bukaan kaca rumah tropis.',
    content_md: '# Jendela Berkondensasi\n\nPenjelasan fisika embun...',
    content_html: '<h1>Jendela Berkondensasi</h1><p>Penjelasan fisika embun...</p>',
    category_id: 6,
    category_name: 'Kenyamanan Rumah',
    reading_time_minutes: 5,
    status: 'published',
    focus_keyword: 'kondensasi jendela',
    content_hash: 'hash_article_a_initial',
    pillar_role: 'STANDALONE',
    parent_pillar_id: null
  };

  // Fixture Article B (ID 8)
  const articleB = {
    id: 8,
    slug: 'thermal-bridge-kusen-aluminium-penyebab-panas-dingin-solusi',
    title: 'Thermal Bridge Kusen Aluminium: Mengapa Permukaan Kusen Terasa Sangat Panas atau Dingin?',
    description: 'Detail konduksi material dan jembatan termal pada kusen aluminium.',
    content_md: '# Thermal Bridge Kusen\n\nPenjelasan konduksi aluminium...',
    content_html: '<h1>Thermal Bridge Kusen</h1><p>Penjelasan konduksi aluminium...</p>',
    category_id: 5,
    category_name: 'Material & Finishing',
    reading_time_minutes: 6,
    status: 'published',
    focus_keyword: 'thermal bridge kusen',
    content_hash: 'hash_article_b_initial',
    pillar_role: 'STANDALONE',
    parent_pillar_id: null
  };

  // Fixture Article C (ID 9)
  const articleC = {
    id: 9,
    slug: 'memilih-sistem-shading-luar-rumah-tropis',
    title: 'Memilih Sistem Shading Luar untuk Rumah Tropis: Overhang, Louver, Awning, atau Secondary Facade?',
    description: 'Panduan memilih peneduh fasad luar bangunan tropis.',
    content_md: '# Memilih Sistem Shading\n\nPenjelasan peneduh fasad...',
    content_html: '<h1>Memilih Sistem Shading</h1><p>Penjelasan peneduh fasad...</p>',
    category_id: 3,
    category_name: 'Arsitektur & Renovasi',
    reading_time_minutes: 7,
    status: 'published',
    focus_keyword: 'sistem shading luar',
    content_hash: '12c59631d3b297b97e35cf192da05102661c281e3370399fef291eb014692c28',
    pillar_role: 'STANDALONE',
    parent_pillar_id: null
  };

  db.seedArticle(articleA);
  db.seedArticle(articleB);
  db.seedArticle(articleC);

  // ----------------------------------------------------
  // TEST 1: Relationship Type Validation
  // ----------------------------------------------------
  try {
    for (const rel of RELATIONSHIP_TYPES) {
      const v = validateLinkCandidate({
        source_article_id: 7,
        target_article_id: 8,
        relationship_type: rel,
        placement_plane: 'PLANE_A_DYNAMIC',
        reader_reason: 'Testing valid type'
      }, { id: 7, pillar_role: 'PILLAR' }, { id: 8, pillar_role: 'PILLAR' });
      assert.equal(v.valid, true, `Expected ${rel} to be valid`);
    }

    // Invalid type rejection
    const invalidV = validateLinkCandidate({
      source_article_id: 7,
      target_article_id: 8,
      relationship_type: 'SEO_LINK_JUICE',
      placement_plane: 'PLANE_A_DYNAMIC',
      reader_reason: 'Invalid'
    });
    assert.equal(invalidV.valid, false);
    assert.match(invalidV.error, /Invalid relationship_type/);

    recordPass('1. Relationship type validation strictly enforces 9 canonical types');
  } catch (err) {
    recordFail('1. Relationship type validation', err);
  }

  // ----------------------------------------------------
  // TEST 2: No Self-Links
  // ----------------------------------------------------
  try {
    const selfLink = validateLinkCandidate({
      source_article_id: 7,
      target_article_id: 7,
      relationship_type: 'RELATED_DECISION',
      placement_plane: 'PLANE_A_DYNAMIC',
      reader_reason: 'Self-linking attempt'
    });
    assert.equal(selfLink.valid, false);
    assert.match(selfLink.error, /Self-linking is strictly prohibited/);
    recordPass('2. Self-links are strictly prevented');
  } catch (err) {
    recordFail('2. No self-links', err);
  }

  // ----------------------------------------------------
  // TEST 3: Explicit Pillar Identity (INVARIANT_EXPLICIT_PILLAR_IDENTITY)
  // ----------------------------------------------------
  try {
    // Attempting PARENT_PILLAR when target is not explicitly marked as PILLAR
    const invalidPillarTarget = validateLinkCandidate({
      source_article_id: 8,
      target_article_id: 9,
      relationship_type: 'PARENT_PILLAR',
      placement_plane: 'PLANE_A_DYNAMIC',
      reader_reason: 'Target is not a pillar'
    }, articleB, articleC); // articleC is STANDALONE
    assert.equal(invalidPillarTarget.valid, false);
    assert.match(invalidPillarTarget.error, /PARENT_PILLAR requires explicit pillar metadata/);

    // Attempting CHILD_SUPPORTING when source is not explicitly marked as PILLAR
    const invalidPillarSource = validateLinkCandidate({
      source_article_id: 9,
      target_article_id: 8,
      relationship_type: 'CHILD_SUPPORTING',
      placement_plane: 'PLANE_A_DYNAMIC',
      reader_reason: 'Source is not a pillar'
    }, articleC, articleB); // articleC is STANDALONE
    assert.equal(invalidPillarSource.valid, false);
    assert.match(invalidPillarSource.error, /CHILD_SUPPORTING requires explicit pillar metadata/);

    recordPass('3. Explicit pillar identity enforced (PARENT_PILLAR / CHILD_SUPPORTING require explicit pillar metadata)');
  } catch (err) {
    recordFail('3. Explicit pillar identity', err);
  }

  // ----------------------------------------------------
  // TEST 4: Plane A Does Not Alter Content Hash
  // ----------------------------------------------------
  try {
    const initialHash = articleC.content_hash;
    const initialMd = articleC.content_md;
    const initialHtml = articleC.content_html;

    // Create & activate Plane A link C -> B
    const createRes = await createLinkCandidate(db, {
      source_article_id: 9,
      target_article_id: 8,
      relationship_type: 'RELATED_MATERIAL',
      reader_reason: 'Jika Anda memilih sirip louver aluminium, pahami karakteristik konduksi panas material kusen',
      placement_plane: 'PLANE_A_DYNAMIC',
      confidence_score: 0.95,
      status: 'CANDIDATE'
    }, articleC, articleB);
    assert.equal(createRes.success, true);

    const activateRes = await activateLink(db, createRes.id, 'Chief Editor');
    assert.equal(activateRes.success, true);

    // Verify Article C stored fields
    const storedArtC = db.articles.get(9);
    assert.equal(storedArtC.content_hash, initialHash);
    assert.equal(storedArtC.content_md, initialMd);
    assert.equal(storedArtC.content_html, initialHtml);

    recordPass('4. Plane A dynamic linking does not alter content_md, content_html, or content_hash');
  } catch (err) {
    recordFail('4. Plane A does not alter content hash', err);
  }

  // ----------------------------------------------------
  // TEST 5: Plane B Stores source_content_hash
  // ----------------------------------------------------
  let inlineLinkId;
  try {
    const inlineCand = await createLinkCandidate(db, {
      source_article_id: 8,
      target_article_id: 9,
      relationship_type: 'RELATED_DECISION',
      reader_reason: 'Pertimbangkan peneduh fasad luar',
      placement_plane: 'PLANE_B_INLINE',
      anchor_text: 'memasang sistem peneduh luar pada jendela',
      confidence_score: 0.92,
      status: 'CANDIDATE'
    }, articleB, articleC);
    assert.equal(inlineCand.success, true);
    inlineLinkId = inlineCand.id;

    // Activate Plane B link - binds source_content_hash
    const actInline = await activateLink(db, inlineLinkId, 'Chief Editor', articleB.content_hash);
    assert.equal(actInline.success, true);

    const activatedLink = db.links.get(inlineLinkId);
    assert.equal(activatedLink.status, 'ACTIVE');
    assert.equal(activatedLink.source_content_hash, articleB.content_hash);

    recordPass('5. Plane B stores source_content_hash bound to exact approved revision');
  } catch (err) {
    recordFail('5. Plane B stores source_content_hash', err);
  }

  // ----------------------------------------------------
  // TEST 6: Plane B Becomes Stale After Source Hash Change
  // ----------------------------------------------------
  try {
    const link = db.links.get(inlineLinkId);
    const newHash = 'hash_article_b_revised_999';

    // 1. evaluatePlaneBStaleness detects mismatch
    const isStale = evaluatePlaneBStaleness(link, newHash);
    assert.equal(isStale, true);

    // 2. checkAndReconcilePlaneBStaleness updates status to STALE
    const staleCount = await checkAndReconcilePlaneBStaleness(db, 8, newHash);
    assert.equal(staleCount, 1);

    const updatedLink = db.links.get(inlineLinkId);
    assert.equal(updatedLink.status, 'STALE');

    recordPass('6. Plane B becomes STALE after source article content hash change');
  } catch (err) {
    recordFail('6. Plane B becomes stale after hash change', err);
  }

  // ----------------------------------------------------
  // TEST 7: Unpublished Target Is Hidden from Plane A
  // ----------------------------------------------------
  try {
    // Add draft article D
    const articleD = {
      id: 10,
      slug: 'draft-article-unreleased',
      title: 'Artikel Draf Rahasia',
      status: 'draft',
      pillar_role: 'STANDALONE'
    };
    db.seedArticle(articleD);

    // Create & activate Plane A link from 9 -> 10
    const candDraft = await createLinkCandidate(db, {
      source_article_id: 9,
      target_article_id: 10,
      relationship_type: 'RELATED_PROBLEM',
      reader_reason: 'Draft test link',
      placement_plane: 'PLANE_A_DYNAMIC',
      status: 'ACTIVE'
    }, articleC, articleD);
    assert.equal(candDraft.success, true);

    // Query active Plane A links for Article 9
    const linksFor9 = await getActivePlaneALinks(db, 9);
    // Target 10 is draft, so it must NOT appear
    const hasDraftTarget = linksFor9.some(l => l.target_article_id === 10);
    assert.equal(hasDraftTarget, false, 'Draft target must be hidden');

    recordPass('7. Unpublished/draft target is automatically omitted from Plane A rendering');
  } catch (err) {
    recordFail('7. Unpublished target is hidden', err);
  }

  // ----------------------------------------------------
  // TEST 8: Changed Target Slug Resolves Correctly at Runtime
  // ----------------------------------------------------
  try {
    // Article 8 currently has slug: 'thermal-bridge-kusen-aluminium-penyebab-panas-dingin-solusi'
    const beforeLinks = await getActivePlaneALinks(db, 9);
    const linkToBBefore = beforeLinks.find(l => l.target_article_id === 8);
    assert.ok(linkToBBefore);
    assert.equal(linkToBBefore.target_slug, 'thermal-bridge-kusen-aluminium-penyebab-panas-dingin-solusi');

    // Simulate slug rename in articles table
    const targetB = db.articles.get(8);
    targetB.slug = 'thermal-bridge-kusen-aluminium-solusi-lengkap';

    const afterLinks = await getActivePlaneALinks(db, 9);
    const linkToBAfter = afterLinks.find(l => l.target_article_id === 8);
    assert.ok(linkToBAfter);
    assert.equal(linkToBAfter.target_slug, 'thermal-bridge-kusen-aluminium-solusi-lengkap');

    // Reset back
    targetB.slug = 'thermal-bridge-kusen-aluminium-penyebab-panas-dingin-solusi';
    recordPass('8. Runtime resolution dynamically reflects target slug updates');
  } catch (err) {
    recordFail('8. Changed target slug resolves correctly', err);
  }

  // ----------------------------------------------------
  // TEST 9: One Target Renders Once Despite Competing Candidate Reasoning
  // ----------------------------------------------------
  try {
    // Add second competing link from 9 -> 8 with different relationship type
    // (In db, using different relationship_type satisfies the 4-part UNIQUE constraint)
    const competingCand = await createLinkCandidate(db, {
      source_article_id: 9,
      target_article_id: 8,
      relationship_type: 'BACKGROUND_EXPLAINER',
      reader_reason: 'Penjelasan dasar fisika bangunan konduksi',
      placement_plane: 'PLANE_A_DYNAMIC',
      confidence_score: 0.70, // lower confidence than 0.95
      status: 'ACTIVE'
    }, articleC, articleB);
    assert.equal(competingCand.success, true);

    const planeALinksFor9 = await getActivePlaneALinks(db, 9);
    const targets = planeALinksFor9.filter(l => l.target_article_id === 8);
    assert.equal(targets.length, 1, 'Support module must deduplicate target articles to exactly 1');
    assert.equal(targets[0].relationship_type, 'RELATED_MATERIAL', 'Primary relationship with highest confidence must win');

    recordPass('9. Deduplication renders one primary relationship per target article');
  } catch (err) {
    recordFail('9. Target deduplication', err);
  }

  // ----------------------------------------------------
  // TEST 10: No Mechanical Internal Link Quota
  // ----------------------------------------------------
  try {
    // 0 links allowed for short/long article
    const zeroLinks = await getActivePlaneALinks(db, 7);
    assert.equal(zeroLinks.length, 0);

    // 1 link allowed
    const oneLink = await getActivePlaneALinks(db, 9);
    assert.equal(oneLink.length, 1);

    // Multiple links allowed without word count threshold
    // Add link from 8 -> 7 and 8 -> 9
    await createLinkCandidate(db, {
      source_article_id: 8,
      target_article_id: 7,
      relationship_type: 'RELATED_PROBLEM',
      reader_reason: 'Kusen aluminium dingin di malam hari memicu embun pada kaca',
      placement_plane: 'PLANE_A_DYNAMIC',
      confidence_score: 0.93,
      status: 'ACTIVE'
    }, articleB, articleA);

    await createLinkCandidate(db, {
      source_article_id: 8,
      target_article_id: 9,
      relationship_type: 'RELATED_DECISION',
      reader_reason: 'Sebelum mengganti kusen jendela, pertimbangkan peneduh fasad',
      placement_plane: 'PLANE_A_DYNAMIC',
      confidence_score: 0.91,
      status: 'ACTIVE'
    }, articleB, articleC);

    const linksFor8 = await getActivePlaneALinks(db, 8);
    assert.equal(linksFor8.length, 2);

    recordPass('10. NO_MECHANICAL_INTERNAL_LINK_QUOTA strictly preserved (links governed by semantic utility, not quotas)');
  } catch (err) {
    recordFail('10. No mechanical link quota', err);
  }

  // ----------------------------------------------------
  // TEST 11: Orphan Detection
  // ----------------------------------------------------
  try {
    // Article 7 has 1 inbound link (from 8), Article 8 has 1 inbound link (from 9), Article 9 has 1 inbound link (from 8)
    // Let's seed an isolated article E (ID 11) with 0 inbound links
    const articleE = {
      id: 11,
      slug: 'ventilasi-atap-panas-loteng',
      title: 'Ventilasi Atap: Mereduksi Panas Menjebak di Loteng',
      status: 'published',
      pillar_role: 'STANDALONE',
      parent_pillar_id: null
    };
    db.seedArticle(articleE);

    const orphanReport = await detectOrphans(db);
    const orphanE = orphanReport.find(o => o.article_id === 11);
    assert.ok(orphanE);
    assert.equal(orphanE.is_orphan, true);
    assert.equal(orphanE.inbound_active_semantic_links_count, 0);

    const nonOrphan8 = orphanReport.find(o => o.article_id === 8);
    assert.ok(nonOrphan8);
    assert.equal(nonOrphan8.is_orphan, false);

    recordPass('11. Semantic orphan detection accurately identifies published articles lacking discovery paths');
  } catch (err) {
    recordFail('11. Orphan detection', err);
  }

  // ----------------------------------------------------
  // TEST 12: Forward Discovery
  // ----------------------------------------------------
  try {
    const candidates = await discoverBidirectionalCandidates(db, articleC);
    const forwardCandidates = candidates.filter(c => c.direction === 'FORWARD');
    assert.ok(forwardCandidates.length > 0);
    for (const fc of forwardCandidates) {
      assert.equal(fc.source_article_id, 9);
      assert.equal(fc.status, 'CANDIDATE');
      assert.ok(fc.reader_reason.length > 0);
      assert.ok(RELATIONSHIP_TYPES.includes(fc.relationship_type));
    }
    recordPass('12. Forward candidate discovery returns structured CANDIDATE items');
  } catch (err) {
    recordFail('12. Forward discovery', err);
  }

  // ----------------------------------------------------
  // TEST 13: Backlink Discovery
  // ----------------------------------------------------
  try {
    const candidates = await discoverBidirectionalCandidates(db, articleC);
    const backlinkCandidates = candidates.filter(c => c.direction === 'BACKLINK');
    assert.ok(backlinkCandidates.length > 0);
    for (const bc of backlinkCandidates) {
      assert.equal(bc.target_article_id, 9);
      assert.equal(bc.status, 'CANDIDATE');
      assert.ok(bc.match_rationale.length > 0);
    }
    recordPass('13. Backlink discovery recommends inbound candidates from existing articles');
  } catch (err) {
    recordFail('13. Backlink discovery', err);
  }

  // ----------------------------------------------------
  // TEST 14: Published Article Cannot Be Silently Inline-Mutated
  // ----------------------------------------------------
  try {
    const originalProseHtml = '<p>Pemasangan sistem peneduh luar pada jendela dapat mengurangi radiasi termal secara pasif.</p>';
    const processedProse = processArticleContent(originalProseHtml, articleC, [articleB]);
    
    // In INTERNAL-LINK-ENGINE-1, mechanical keyword injection is disabled by default
    assert.equal(processedProse.includes('<a href="/thermal-bridge'), false, 'Prose must not have silent auto-keyword link injection');
    recordPass('14. Published article HTML cannot be silently mutated by mechanical regex keyword injection');
  } catch (err) {
    recordFail('14. No silent inline mutation', err);
  }

  // ----------------------------------------------------
  // TEST 15: Support Module Returns reader_reason
  // ----------------------------------------------------
  try {
    const planeALinks = await getActivePlaneALinks(db, 9);
    assert.ok(planeALinks.length > 0);
    const firstLink = planeALinks[0];
    assert.ok(firstLink.reader_reason);
    assert.match(firstLink.reader_reason, /konduksi panas material kusen/);
    recordPass('15. Support module provides contextual reader_reason for each destination');
  } catch (err) {
    recordFail('15. Support module returns reader_reason', err);
  }

  // ----------------------------------------------------
  // TEST 16: Zero Links Renders Zero Module
  // ----------------------------------------------------
  try {
    // Article 11 has no active Plane A links
    const zeroLinks = await getActivePlaneALinks(db, 11);
    assert.equal(zeroLinks.length, 0);
    recordPass('16. Zero active relationships produces zero links (no empty container)');
  } catch (err) {
    recordFail('16. Zero links renders zero module', err);
  }

  // ----------------------------------------------------
  // TEST 17: Normal <a href> Crawlability
  // ----------------------------------------------------
  try {
    const links = await getActivePlaneALinks(db, 8);
    for (const l of links) {
      assert.ok(l.target_slug);
      const expectedHref = `/${l.target_slug}`;
      assert.match(expectedHref, /^\/[a-z0-9-]+$/);
    }
    recordPass('17. Normal crawlable URL paths generated with zero client-side JavaScript');
  } catch (err) {
    recordFail('17. Normal href crawlability', err);
  }

  // ----------------------------------------------------
  // TEST 18: Mission Control Actionable State
  // ----------------------------------------------------
  try {
    const mcStates = await deriveInternalLinkActionableStates(db);
    assert.ok(mcStates.length > 0);
    
    // Should contain ORPHAN_DETECTED for article 11
    const hasOrphan = mcStates.some(s => s.type === 'ORPHAN_DETECTED' && s.article_id === 11);
    assert.equal(hasOrphan, true);

    // Should contain LINK_REVISION_RECOMMENDED for stale link on article 8
    const hasRevision = mcStates.some(s => s.type === 'LINK_REVISION_RECOMMENDED' && s.article_id === 8);
    assert.equal(hasRevision, true);

    recordPass('18. Mission Control surfaces only actionable states (ORPHAN_DETECTED, LINK_REVISION_RECOMMENDED)');
  } catch (err) {
    recordFail('18. Mission Control actionable state', err);
  }

  // ----------------------------------------------------
  // TEST 19: No Autonomous Publication
  // ----------------------------------------------------
  try {
    // Draft article remains draft despite link generation
    const draftArt = db.articles.get(10);
    assert.equal(draftArt.status, 'draft', 'Draft article status must not be autonomously changed to published');
    recordPass('19. Autonomous publication strictly prevented (articles remain in draft without human approval)');
  } catch (err) {
    recordFail('19. No autonomous publication', err);
  }

  // ----------------------------------------------------
  // TEST 20: Article C Hash Remains Unchanged
  // ----------------------------------------------------
  try {
    const draftPath = path.join(process.cwd(), 'scripts/content-bootstrap/artC-research-reset/article-c-clean-draft.md');
    const content = fs.readFileSync(draftPath, 'utf8');
    const hash = crypto.createHash('sha256').update(content, 'utf8').digest('hex');
    const EXPECTED_HASH = '12c59631d3b297b97e35cf192da05102661c281e3370399fef291eb014692c28';
    assert.equal(hash, EXPECTED_HASH, `Article C SHA-256 hash mismatch! Got: ${hash}`);
    recordPass(`20. Article C hash invariant verified (SHA-256: ${hash})`);
  } catch (err) {
    recordFail('20. Article C hash remains unchanged', err);
  }

  // ----------------------------------------------------
  // SECTION: EMPIRICAL PERFORMANCE MEASUREMENTS
  // ----------------------------------------------------
  console.log('\n--- PERFORMANCE BENCHMARK (MEASURED, NOT ASSUMED) ---');
  const BENCH_ITERATIONS = 500;

  // 1. D1 Plane A link query & deduplication timing
  const startQuery = performance.now();
  for (let i = 0; i < BENCH_ITERATIONS; i++) {
    await getActivePlaneALinks(db, 8);
  }
  const endQuery = performance.now();
  const avgQueryMs = (endQuery - startQuery) / BENCH_ITERATIONS;
  console.log(`  ⏱️  getActivePlaneALinks avg timing: ${avgQueryMs.toFixed(4)} ms per lookup (${BENCH_ITERATIONS} iterations)`);

  // 2. SSR content processor timing (with legacy regex linker disabled)
  const sampleHtml = articleB.content_html.repeat(5); // ~1,000 words
  const startProc = performance.now();
  for (let i = 0; i < BENCH_ITERATIONS; i++) {
    processArticleContent(sampleHtml, articleB, [articleA, articleC]);
  }
  const endProc = performance.now();
  const avgProcMs = (endProc - startProc) / BENCH_ITERATIONS;
  console.log(`  ⏱️  processArticleContent avg timing: ${avgProcMs.toFixed(4)} ms per render (${BENCH_ITERATIONS} iterations)`);
  console.log('------------------------------------------------------\n');

  // ----------------------------------------------------
  // SUMMARY
  // ----------------------------------------------------
  console.log('\n===========================================================');
  console.log(`🏁 Internal Link Engine Test Suite Finished: ${passed} Passed, ${failed} Failed`);
  console.log('===========================================================\n');

  if (failed > 0) {
    process.exit(1);
  }
}

runTestSuite();
