/**
 * RancangLoka — Generic Research Integrity Contract Test Suite
 * Milestone: EDITORIAL-RUNTIME-4B-STABILIZE
 *
 * Verifies all 9 non-negotiable stabilization criteria:
 * 1. Generic CLM-002 with claim role = CAUSE_MECHANISM, passage role = CAUSE_MECHANISM -> PASS
 * 2. Generic CLM-002 with claim role = CAUSE_MECHANISM, passage role = RISK -> FAIL GENERIC_SEMANTIC_ROLE_MISMATCH
 * 3. Same CLM-002 ID on two unrelated topics -> semantic behavior determined by role, not ID
 * 4. Historical metal-roof claim number (e.g. CLM-005) -> cannot force metal-roof role in generalized runtime
 * 5. Recommendation containing "wajib" -> FAIL by default (UNJUSTIFIED_ABSOLUTE_RECOMMENDATION)
 * 6. Recommendation containing "dapat dipertimbangkan" -> PASS when supported
 * 7. Weak/research-required claims -> allowed_for_authoring=false
 * 8. Mixed 49-claim pack -> author-safe set contains only eligible claims, metrics accurately exposed
 * 9. 2 retrieved documents with 49 claim relationships: unique_retrieved_sources_count = 2, relationships = 49
 */

import assert from 'node:assert/strict';

import {
  auditEvidencePackProvenance,
  generateAuthorSafeClaims,
  calculateAuthorSafeMetrics,
  isGeneralEvidenceRole,
  GENERAL_SEMANTIC_ROLE_COMPATIBILITY,
  CLAIM_ALLOWED_SEMANTIC_ROLES
} from '../src/lib/article/human-quality.ts';

import {
  executeGeneralizedResearchJob
} from '../src/lib/editorial/irwan-research-runtime.ts';

let passed = 0;
async function test(name, fn) {
  await fn();
  console.log('  ✅ PASS: ' + name);
  passed++;
}

async function main() {
  console.log('🧪 Starting Generic Research Integrity Contract Suite (EDITORIAL-RUNTIME-4B-STABILIZE)...\n');

  // --- SECTION 1: Claim ID Semantic Decoupling & Role Compatibility ---
  console.log('--- TEST SECTION 1: Claim ID Semantic Decoupling & Role Compatibility ---');

  const baseDampPassage = {
    passage_id: 'psg_cm_01',
    source_id: 'SRC-DAMP-01',
    locator: 'Section 2.1: Capillary Action',
    exact_or_normalized_excerpt: 'Rembesan kapiler air tanah dari pondasi menyebabkan kelembapan naik pada pasangan dinding bata.',
    supports_claim_ids: ['CLM-002'],
    semantic_role: 'CAUSE_MECHANISM'
  };

  const baseDoc = {
    source_id: 'SRC-DAMP-01',
    title: 'Moisture Control in Buildings',
    retrieval_status: 'SOURCE_RETRIEVED_AND_VERIFIED',
    content_text: 'Rembesan kapiler air tanah dari pondasi menyebabkan kelembapan naik pada pasangan dinding bata.'
  };

  await test('1. Generic CLM-002 with claim role = CAUSE_MECHANISM, passage role = CAUSE_MECHANISM -> PASS', () => {
    const pack = {
      evidence_pack_id: 'pack_test_cm_pass',
      topic: 'Dinding Rumah Lembap dan Berjamur: Cat Waterproofing Cukup atau Sumber Air Harus Diperbaiki?',
      retrieved_documents: [baseDoc],
      claim_inventory: [
        {
          claim_id: 'CLM-002',
          statement: 'Rembesan kapiler air tanah dari pondasi menyebabkan kelembapan naik pada pasangan dinding bata.',
          claim_class: 'technical_consensus',
          evidence_status: 'VERIFIED',
          provenance_retrieval_status: 'SOURCE_RETRIEVED_AND_VERIFIED',
          sources: [{ source_id: 'SRC-DAMP-01', retrieval_status: 'SOURCE_RETRIEVED_AND_VERIFIED' }],
          evidence_passage_ids: ['psg_cm_01'],
          action: 'KEEP',
          semantic_role: 'CAUSE_MECHANISM'
        }
      ],
      evidence_passages: [baseDampPassage]
    };

    const audit = auditEvidencePackProvenance(pack);
    assert.strictEqual(audit.requires_provenance_failure, false, 'Generic CLM-002 with matching CAUSE_MECHANISM must pass');
    assert.strictEqual(audit.unverified_claims.length, 0);
  });

  await test('2. Generic CLM-002 with claim role = CAUSE_MECHANISM, passage role = RISK -> FAIL GENERIC_SEMANTIC_ROLE_MISMATCH', () => {
    const pack = {
      evidence_pack_id: 'pack_test_cm_fail',
      topic: 'Dinding Rumah Lembap dan Berjamur: Cat Waterproofing Cukup atau Sumber Air Harus Diperbaiki?',
      retrieved_documents: [baseDoc],
      claim_inventory: [
        {
          claim_id: 'CLM-002',
          statement: 'Rembesan kapiler air tanah dari pondasi menyebabkan kelembapan naik pada pasangan dinding bata.',
          claim_class: 'technical_consensus',
          evidence_status: 'VERIFIED',
          provenance_retrieval_status: 'SOURCE_RETRIEVED_AND_VERIFIED',
          sources: [{ source_id: 'SRC-DAMP-01', retrieval_status: 'SOURCE_RETRIEVED_AND_VERIFIED' }],
          evidence_passage_ids: ['psg_cm_01'],
          action: 'KEEP',
          semantic_role: 'CAUSE_MECHANISM'
        }
      ],
      evidence_passages: [
        {
          ...baseDampPassage,
          semantic_role: 'RISK'
        }
      ]
    };

    const audit = auditEvidencePackProvenance(pack);
    assert.strictEqual(audit.requires_provenance_failure, true, 'RISK passage supporting CAUSE_MECHANISM must fail audit');
    assert.ok(
      audit.unverified_claims.some(c => c.includes('GENERIC_SEMANTIC_ROLE_MISMATCH')),
      'unverified_claims must contain GENERIC_SEMANTIC_ROLE_MISMATCH'
    );
    assert.ok(
      audit.audit_reasons.some(r => r.includes('GENERIC_SEMANTIC_ROLE_MISMATCH')),
      'audit_reasons must contain GENERIC_SEMANTIC_ROLE_MISMATCH'
    );
  });

  await test('3. Same CLM-002 ID on two unrelated topics -> semantic behavior determined by role, not ID', () => {
    // Topic A: Damp Wall (CAUSE_MECHANISM)
    const packDamp = {
      evidence_pack_id: 'pack_topic_damp',
      topic: 'Dinding Rumah Lembap dan Berjamur',
      retrieved_documents: [baseDoc],
      claim_inventory: [
        {
          claim_id: 'CLM-002',
          statement: 'Rembesan kapiler air tanah dari pondasi menyebabkan kelembapan naik pada pasangan dinding bata.',
          claim_class: 'technical_consensus',
          evidence_status: 'VERIFIED',
          provenance_retrieval_status: 'SOURCE_RETRIEVED_AND_VERIFIED',
          sources: [{ source_id: 'SRC-DAMP-01', retrieval_status: 'SOURCE_RETRIEVED_AND_VERIFIED' }],
          evidence_passage_ids: ['psg_cm_01'],
          action: 'KEEP',
          semantic_role: 'CAUSE_MECHANISM'
        }
      ],
      evidence_passages: [baseDampPassage]
    };

    // Topic B: Acoustic Insulation (INTERVENTION_EFFECT)
    const acousticDoc = {
      source_id: 'SRC-ACOUSTIC-01',
      title: 'Architectural Acoustics Standard',
      retrieval_status: 'SOURCE_RETRIEVED_AND_VERIFIED',
      content_text: 'Penggunaan double glass dengan air gap berbeda ketebalan meredam kebisingan frekuensi rendah.'
    };
    const acousticPassage = {
      passage_id: 'psg_ac_01',
      source_id: 'SRC-ACOUSTIC-01',
      locator: 'Section 4: Acoustic Glazing',
      exact_or_normalized_excerpt: 'Penggunaan double glass dengan air gap berbeda ketebalan meredam kebisingan frekuensi rendah.',
      supports_claim_ids: ['CLM-002'],
      semantic_role: 'INTERVENTION_EFFECT'
    };
    const packAcoustic = {
      evidence_pack_id: 'pack_topic_acoustic',
      topic: 'Akustik Ruang dan Reduksi Kebisingan Jendela',
      retrieved_documents: [acousticDoc],
      claim_inventory: [
        {
          claim_id: 'CLM-002',
          statement: 'Penggunaan double glass dengan air gap berbeda ketebalan meredam kebisingan frekuensi rendah.',
          claim_class: 'technical_consensus',
          evidence_status: 'VERIFIED',
          provenance_retrieval_status: 'SOURCE_RETRIEVED_AND_VERIFIED',
          sources: [{ source_id: 'SRC-ACOUSTIC-01', retrieval_status: 'SOURCE_RETRIEVED_AND_VERIFIED' }],
          evidence_passage_ids: ['psg_ac_01'],
          action: 'KEEP',
          semantic_role: 'INTERVENTION_EFFECT'
        }
      ],
      evidence_passages: [acousticPassage]
    };

    const auditA = auditEvidencePackProvenance(packDamp);
    const auditB = auditEvidencePackProvenance(packAcoustic);

    assert.strictEqual(auditA.requires_provenance_failure, false, 'Topic A must pass based on CAUSE_MECHANISM role');
    assert.strictEqual(auditB.requires_provenance_failure, false, 'Topic B must pass based on INTERVENTION_EFFECT role');
    // Verify neither was constrained to historical metal roof roles (ROOF_HEAT_TRANSFER, RADIANT_BARRIER_MECHANISM)
    assert.strictEqual(auditA.unverified_claims.length, 0);
    assert.strictEqual(auditB.unverified_claims.length, 0);
  });

  await test('4. Historical metal-roof claim number (CLM-005) -> cannot force metal-roof role in generalized runtime', () => {
    // In historical metal roof, CLM-005 was strictly ATTIC_VENTILATION.
    // In generalized runtime on window frames, CLM-005 is INSTALLATION_GUIDANCE.
    const windowDoc = {
      source_id: 'SRC-WINDOW-01',
      title: 'Window Frame Thermal Performance and Installation',
      retrieval_status: 'SOURCE_RETRIEVED_AND_VERIFIED',
      content_text: 'Pemasangan thermal break gasket dipasang rapat tanpa celah pada sambungan sudut kusen.'
    };
    const windowPassage = {
      passage_id: 'psg_win_05',
      source_id: 'SRC-WINDOW-01',
      locator: 'Section 3.2: Perimeter Gasket Detailing',
      exact_or_normalized_excerpt: 'Pemasangan thermal break gasket dipasang rapat tanpa celah pada sambungan sudut kusen.',
      supports_claim_ids: ['CLM-005'],
      semantic_role: 'INSTALLATION_GUIDANCE'
    };
    const packWindow = {
      evidence_pack_id: 'pack_test_window_clm5',
      topic: 'Kusen Aluminium vs uPVC: Mana yang Lebih Tahan Cuaca Tropis dan Kedap Suara?',
      retrieved_documents: [windowDoc],
      claim_inventory: [
        {
          claim_id: 'CLM-005',
          statement: 'Pemasangan thermal break gasket dipasang rapat tanpa celah pada sambungan sudut kusen.',
          claim_class: 'technical_consensus',
          evidence_status: 'VERIFIED',
          provenance_retrieval_status: 'SOURCE_RETRIEVED_AND_VERIFIED',
          sources: [{ source_id: 'SRC-WINDOW-01', retrieval_status: 'SOURCE_RETRIEVED_AND_VERIFIED' }],
          evidence_passage_ids: ['psg_win_05'],
          action: 'KEEP',
          semantic_role: 'INSTALLATION_GUIDANCE'
        }
      ],
      evidence_passages: [windowPassage]
    };

    const audit = auditEvidencePackProvenance(packWindow);
    assert.strictEqual(audit.requires_provenance_failure, false, 'CLM-005 in generalized runtime must NOT be forced to ATTIC_VENTILATION');
    assert.strictEqual(audit.unverified_claims.length, 0);
  });

  // --- SECTION 2: Recommendation Absolute-Language Policy ---
  console.log('\n--- TEST SECTION 2: Recommendation Absolute-Language Policy ---');

  const dampDerivedPassage = {
    passage_id: 'psg_cm_01',
    source_id: 'SRC-DAMP-01',
    locator: 'Section 2.1: Capillary Action',
    exact_or_normalized_excerpt: 'Rembesan kapiler air tanah dari pondasi menyebabkan kelembapan naik pada pasangan dinding bata.',
    supports_claim_ids: ['CLM-001'],
    semantic_role: 'CAUSE_MECHANISM'
  };

  const baseDerivedClaims = [
    {
      claim_id: 'CLM-001',
      statement: 'Rembesan kapiler air tanah dari pondasi menyebabkan kelembapan naik pada pasangan dinding bata.',
      claim_class: 'technical_consensus',
      evidence_status: 'VERIFIED',
      provenance_retrieval_status: 'SOURCE_RETRIEVED_AND_VERIFIED',
      sources: [{ source_id: 'SRC-DAMP-01', retrieval_status: 'SOURCE_RETRIEVED_AND_VERIFIED' }],
      evidence_passage_ids: ['psg_cm_01'],
      action: 'KEEP',
      semantic_role: 'CAUSE_MECHANISM'
    }
  ];

  await test('5. Recommendation containing "wajib" -> FAIL by default (UNJUSTIFIED_ABSOLUTE_RECOMMENDATION)', () => {
    const recClaim = {
      claim_id: 'CLM-010',
      statement: 'Penanganan dinding lembap wajib mendahulukan perbaikan sumber air.',
      claim_class: 'editorial_recommendation',
      evidence_status: 'SUPPORTED',
      provenance_retrieval_status: 'SOURCE_RETRIEVED_AND_VERIFIED',
      sources: [{ source_id: 'SRC-DAMP-01', retrieval_status: 'SOURCE_RETRIEVED_AND_VERIFIED' }],
      derived_from_claim_ids: ['CLM-001'],
      action: 'KEEP',
      semantic_role: 'INTERVENTION_EFFECT',
      absolute_language_allowed: false
    };

    const safeClaims = generateAuthorSafeClaims([...baseDerivedClaims, recClaim], { evidencePassages: [dampDerivedPassage] });
    const recSafe = safeClaims.find(s => s.claim_id === 'CLM-010');
    assert.ok(recSafe, 'Safe claim for recommendation must exist');
    assert.strictEqual(recSafe.allowed_for_authoring, false, 'Recommendation with "wajib" must NOT be allowed for authoring');

    const pack = {
      evidence_pack_id: 'pack_rec_wajib',
      topic: 'Dinding Rumah Lembap dan Berjamur',
      retrieved_documents: [baseDoc],
      claim_inventory: [...baseDerivedClaims, recClaim],
      author_safe_claims: safeClaims,
      evidence_passages: [dampDerivedPassage]
    };

    const audit = auditEvidencePackProvenance(pack);
    assert.strictEqual(audit.requires_provenance_failure, true, 'Audit must fail on unjustified absolute word "wajib"');
    assert.ok(
      audit.unverified_claims.some(c => c.includes('UNJUSTIFIED_ABSOLUTE_RECOMMENDATION') && c.includes('wajib')),
      'Must flag UNJUSTIFIED_ABSOLUTE_RECOMMENDATION for "wajib"'
    );
  });

  await test('5b. All default-prohibited absolute words (harus, wajib, selalu, mutlak, pasti, diperlukan, prioritas utama) FAIL audit', () => {
    const prohibitedWords = ['harus', 'wajib', 'selalu', 'mutlak', 'pasti', 'diperlukan', 'prioritas utama'];

    for (const word of prohibitedWords) {
      const recClaim = {
        claim_id: 'CLM-010',
        statement: `Penanganan dinding lembap ${word} mendahulukan perbaikan sumber air.`,
        claim_class: 'editorial_recommendation',
        evidence_status: 'SUPPORTED',
        provenance_retrieval_status: 'SOURCE_RETRIEVED_AND_VERIFIED',
        sources: [{ source_id: 'SRC-DAMP-01', retrieval_status: 'SOURCE_RETRIEVED_AND_VERIFIED' }],
        derived_from_claim_ids: ['CLM-001'],
        action: 'KEEP',
        semantic_role: 'INTERVENTION_EFFECT'
      };

      const safeClaims = generateAuthorSafeClaims([...baseDerivedClaims, recClaim], { evidencePassages: [dampDerivedPassage] });
      const pack = {
        evidence_pack_id: `pack_rec_${word}`,
        topic: 'Dinding Rumah Lembap dan Berjamur',
        retrieved_documents: [baseDoc],
        claim_inventory: [...baseDerivedClaims, recClaim],
        author_safe_claims: safeClaims,
        evidence_passages: [dampDerivedPassage]
      };

      const audit = auditEvidencePackProvenance(pack);
      assert.strictEqual(audit.requires_provenance_failure, true, `Audit must fail on prohibited word: '${word}'`);
      assert.ok(
        audit.unverified_claims.some(c => c.includes('UNJUSTIFIED_ABSOLUTE_RECOMMENDATION') && c.includes(word)),
        `Must flag UNJUSTIFIED_ABSOLUTE_RECOMMENDATION for '${word}'`
      );
    }
  });

  await test('6. Recommendation containing "dapat dipertimbangkan" -> PASS when supported', () => {
    const recClaim = {
      claim_id: 'CLM-010',
      statement: 'Penanganan dinding lembap dapat dipertimbangkan setelah sumber masalah dikonfirmasi, dengan mendahulukan pelacakan sumber air.',
      claim_class: 'editorial_recommendation',
      evidence_status: 'SUPPORTED',
      provenance_retrieval_status: 'SOURCE_RETRIEVED_AND_VERIFIED',
      sources: [{ source_id: 'SRC-DAMP-01', retrieval_status: 'SOURCE_RETRIEVED_AND_VERIFIED' }],
      derived_from_claim_ids: ['CLM-001'],
      action: 'KEEP',
      semantic_role: 'INTERVENTION_EFFECT',
      absolute_language_allowed: false
    };

    const safeClaims = generateAuthorSafeClaims([...baseDerivedClaims, recClaim], { evidencePassages: [dampDerivedPassage] });
    const recSafe = safeClaims.find(s => s.claim_id === 'CLM-010');
    assert.ok(recSafe);
    assert.strictEqual(recSafe.allowed_for_authoring, true, 'Scenario-qualified recommendation must be allowed for authoring');

    const pack = {
      evidence_pack_id: 'pack_rec_qualified',
      topic: 'Dinding Rumah Lembap dan Berjamur',
      retrieved_documents: [baseDoc],
      claim_inventory: [...baseDerivedClaims, recClaim],
      author_safe_claims: safeClaims,
      evidence_passages: [dampDerivedPassage]
    };

    const audit = auditEvidencePackProvenance(pack);
    assert.strictEqual(audit.requires_provenance_failure, false, 'Qualified recommendation must pass audit cleanly');
  });

  // --- SECTION 3: Author-Safe Filtering & Metrics Audit ---
  console.log('\n--- TEST SECTION 3: Author-Safe Filtering & Metrics Audit ---');

  await test('7. Weak/research-required claims -> allowed_for_authoring=false', () => {
    const weakClaim1 = {
      claim_id: 'CLM-WEAK-01',
      statement: 'Biaya perbaikan dinding berkisar Rp 500.000 per meter persegi.',
      claim_class: 'editorial_inference',
      evidence_status: 'UNVERIFIED',
      sources: [],
      action: 'RESEARCH_REQUIRED',
      semantic_role: 'INTERVENTION_EFFECT'
    };

    const weakClaim2 = {
      claim_id: 'CLM-WEAK-02',
      statement: 'Injeksi kimia selalu berhasil 100% pada semua jenis bata.',
      claim_class: 'technical_consensus',
      evidence_status: 'PARTIALLY_SUPPORTED',
      sources: [{ source_id: 'SRC-UNRETRIEVED', retrieval_status: 'SOURCE_REFERENCE_KNOWN_NOT_RETRIEVED' }],
      action: 'REMOVE',
      semantic_role: 'INTERVENTION_EFFECT'
    };

    const safeClaims = generateAuthorSafeClaims([weakClaim1, weakClaim2]);
    assert.strictEqual(safeClaims.length, 2);
    assert.strictEqual(safeClaims[0].allowed_for_authoring, false, 'RESEARCH_REQUIRED claim must not be allowed for authoring');
    assert.strictEqual(safeClaims[1].allowed_for_authoring, false, 'REMOVE claim must not be allowed for authoring');
  });

  await test('8. Mixed 49-claim pack -> author-safe set contains only eligible claims and exposes breakdown metrics', () => {
    const mixedClaims = [];
    const mixedPassages = [];

    // 40 fully verified claims
    for (let i = 1; i <= 40; i++) {
      const cid = `CLM-${i.toString().padStart(3, '0')}`;
      const pid = `psg_${i}`;
      mixedPassages.push({
        passage_id: pid,
        source_id: 'SRC-DAMP-01',
        locator: `Section ${i}`,
        exact_or_normalized_excerpt: `Bukti terverifikasi poin ${i} mengenai sifat kelembapan.`,
        supports_claim_ids: [cid],
        semantic_role: 'CAUSE_MECHANISM'
      });
      mixedClaims.push({
        claim_id: cid,
        statement: `Bukti terverifikasi poin ${i} mengenai sifat kelembapan.`,
        claim_class: 'technical_consensus',
        evidence_status: 'VERIFIED',
        provenance_retrieval_status: 'SOURCE_RETRIEVED_AND_VERIFIED',
        sources: [{ source_id: 'SRC-DAMP-01', retrieval_status: 'SOURCE_RETRIEVED_AND_VERIFIED' }],
        evidence_passage_ids: [pid],
        action: 'KEEP',
        semantic_role: 'CAUSE_MECHANISM'
      });
    }

    // 5 research-required claims
    for (let i = 41; i <= 45; i++) {
      const cid = `CLM-${i.toString().padStart(3, '0')}`;
      mixedClaims.push({
        claim_id: cid,
        statement: `Klaim belum terverifikasi nomor ${i}.`,
        claim_class: 'technical_consensus',
        evidence_status: 'RESEARCH_REQUIRED',
        sources: [],
        action: 'RESEARCH_REQUIRED',
        semantic_role: 'LIMITATION'
      });
    }

    // 3 blocked claims (REMOVE)
    for (let i = 46; i <= 48; i++) {
      const cid = `CLM-${i.toString().padStart(3, '0')}`;
      mixedClaims.push({
        claim_id: cid,
        statement: `Klaim diblokir nomor ${i}.`,
        claim_class: 'technical_consensus',
        evidence_status: 'UNVERIFIED',
        sources: [],
        action: 'REMOVE',
        semantic_role: 'RISK'
      });
    }

    // 1 recommendation derived from first 3 verified claims
    mixedClaims.push({
      claim_id: 'CLM-049',
      statement: 'Penanganan kelembapan dapat dipertimbangkan setelah sumber masalah dikonfirmasi.',
      claim_class: 'editorial_recommendation',
      evidence_status: 'SUPPORTED',
      provenance_retrieval_status: 'SOURCE_RETRIEVED_AND_VERIFIED',
      sources: [{ source_id: 'SRC-DAMP-01', retrieval_status: 'SOURCE_RETRIEVED_AND_VERIFIED' }],
      evidence_passage_ids: [],
      derived_from_claim_ids: ['CLM-001', 'CLM-002', 'CLM-003'],
      action: 'KEEP',
      semantic_role: 'INTERVENTION_EFFECT',
      absolute_language_allowed: false
    });

    assert.strictEqual(mixedClaims.length, 49, 'Mixed claims count must be exactly 49');

    const authorSafe = generateAuthorSafeClaims(mixedClaims, { evidencePassages: mixedPassages });
    const metrics = calculateAuthorSafeMetrics(mixedClaims, authorSafe);

    assert.strictEqual(metrics.total_claims, 49);
    assert.strictEqual(metrics.allowed_for_authoring_count, 41, 'Only 40 verified + 1 valid recommendation should be allowed');
    assert.strictEqual(metrics.blocked_count, 8, '5 research_required + 3 remove must be blocked');
    assert.strictEqual(metrics.research_required_count, 5);
    assert.strictEqual(metrics.recommendation_count, 1);

    // Verify attached metrics on result
    assert.deepStrictEqual(authorSafe.metrics, metrics);
  });

  // --- SECTION 4: Source Metrics Disambiguation ---
  console.log('\n--- TEST SECTION 4: Source Metrics Disambiguation ---');

  await test('9. 2 retrieved documents with 49 claim relationships: unique_retrieved_sources_count = 2, relationship_count = 49', () => {
    const docs = [
      {
        source_id: 'SRC-DOC-A',
        title: 'Document A',
        retrieval_status: 'SOURCE_RETRIEVED_AND_VERIFIED',
        read_status: 'READ_AND_EXTRACTED',
        content_text: 'Teks dokumen A'
      },
      {
        source_id: 'SRC-DOC-B',
        title: 'Document B',
        retrieval_status: 'SOURCE_RETRIEVED_AND_VERIFIED',
        read_status: 'READ_AND_EXTRACTED',
        content_text: 'Teks dokumen B'
      }
    ];

    const claims = [];
    for (let i = 1; i <= 49; i++) {
      const srcId = i % 2 === 0 ? 'SRC-DOC-A' : 'SRC-DOC-B';
      claims.push({
        claim_id: `CLM-${i.toString().padStart(3, '0')}`,
        statement: `Klaim nomor ${i}`,
        claim_class: 'technical_consensus',
        evidence_status: 'VERIFIED',
        provenance_retrieval_status: 'SOURCE_RETRIEVED_AND_VERIFIED',
        sources: [{ source_id: srcId, retrieval_status: 'SOURCE_RETRIEVED_AND_VERIFIED' }],
        evidence_passage_ids: [`psg_${i}`],
        action: 'KEEP',
        semantic_role: 'CAUSE_MECHANISM'
      });
    }

    const passages = claims.map((c, idx) => ({
      passage_id: `psg_${idx + 1}`,
      source_id: c.sources[0].source_id,
      locator: `Section ${idx + 1}`,
      exact_or_normalized_excerpt: c.statement,
      supports_claim_ids: [c.claim_id],
      semantic_role: 'CAUSE_MECHANISM'
    }));

    const pack = {
      evidence_pack_id: 'pack_test_source_metrics',
      topic: 'Topik Uji Metrik Sumber',
      retrieved_documents: docs,
      claim_inventory: claims,
      evidence_passages: passages
    };

    const audit = auditEvidencePackProvenance(pack);

    // Verify exact disambiguated source metrics:
    assert.strictEqual(audit.unique_retrieved_sources_count, 2, 'Unique retrieved sources count must be 2');
    assert.strictEqual(audit.retrieved_documents_count, 2, 'Retrieved documents count must be 2');
    assert.strictEqual(audit.claim_source_relationship_count, 49, 'Claim-source relationship count must be 49');
    assert.deepStrictEqual(audit.unique_verified_source_ids.sort(), ['SRC-DOC-A', 'SRC-DOC-B']);
    // Deprecated field maintains backward compatibility:
    assert.strictEqual(audit.retrieved_and_verified_sources_count, 49);
  });

  // --- SECTION 5: executeGeneralizedResearchJob Integration Check ---
  console.log('\n--- TEST SECTION 5: executeGeneralizedResearchJob Integration Check ---');

  await test('10. executeGeneralizedResearchJob produces evidence-bounded recommendation and precise source metrics', async () => {
    const jobResult = await executeGeneralizedResearchJob({
      taskId: 'task_test_gen_damp_001',
      topic: 'Dinding Rumah Lembap dan Berjamur: Cat Waterproofing Cukup atau Sumber Air Harus Diperbaiki?',
      operatorAuth: {
        authorizedBy: 'Chief Editor Reviewer',
        operatorRole: 'CHIEF_EDITOR',
        timestamp: new Date().toISOString()
      }
    });

    const pack = jobResult.evidencePack;
    const claims = pack.claim_inventory;
    const recClaim = claims.find(c => c.claim_class === 'editorial_recommendation');

    assert.ok(recClaim, 'Recommendation claim must exist in generated pack');
    assert.ok(!recClaim.statement.includes('wajib'), 'Recommendation must NOT contain "wajib"');
    assert.ok(!recClaim.statement.includes('harus'), 'Recommendation must NOT contain "harus"');
    assert.ok(!recClaim.statement.includes('mutlak'), 'Recommendation must NOT contain "mutlak"');
    assert.ok(!recClaim.statement.includes('selalu'), 'Recommendation must NOT contain "selalu"');
    assert.ok(!recClaim.statement.includes('pasti'), 'Recommendation must NOT contain "pasti"');
    assert.ok(
      recClaim.statement.includes('dapat dipertimbangkan') || recClaim.statement.includes('lebih relevan ketika') || recClaim.statement.includes('dapat membantu'),
      'Recommendation must use scenario-qualified language'
    );

    // Check stats on pack and result
    assert.ok(typeof pack.stats.unique_retrieved_sources_count === 'number');
    assert.ok(typeof pack.stats.claim_source_relationship_count === 'number');
    assert.ok(Array.isArray(pack.stats.unique_verified_source_ids));
    assert.ok(pack.stats.author_safe_metrics);
    assert.strictEqual(pack.stats.author_safe_metrics.total_claims, claims.length);

    // Run audit on the generated pack
    const audit = auditEvidencePackProvenance(pack);
    assert.strictEqual(audit.requires_provenance_failure, false, 'Generated generalized pack must pass provenance audit cleanly');
    assert.ok(audit.unique_retrieved_sources_count > 0);
    assert.ok(audit.claim_source_relationship_count >= audit.unique_retrieved_sources_count);
  });

  console.log(`\n🎉 All ${passed} tests in EDITORIAL-RUNTIME-4B-STABILIZE passed successfully!`);
}

main().catch(err => {
  console.error('\n❌ Test failed with error:', err);
  process.exit(1);
});
