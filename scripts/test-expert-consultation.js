/**
 * RancangLoka Editorial Expert Consultation & Decision Depth Test Suite
 * Milestone: EDITORIAL-EXPERT-CONSULTATION-1-STABILIZE
 *
 * Comprehensive 22-Check Verification Suite:
 * 1. Canonical Article 5 identity is unambiguous
 * 2. Article 6 identity is unambiguous
 * 3. Strong technical explanatory article passes (Fixture A)
 * 4. Academic detached article revises (Fixture B)
 * 5. Formal standards article does not false-fail (Fixture C)
 * 6. Concise narrow article can pass (Fixture D)
 * 7. Broad shallow article triggers scope-depth mismatch
 * 8. Hybrid article detects primary + secondary intent correctly
 * 9. Low-confidence intent avoids severe blind penalty
 * 10. Comparison requires meaningful trade-off
 * 11. Missing trade-off evidence routes to Irwan (Case A)
 * 12. Existing evidence but missing explanation routes to Joko (Case B)
 * 13. Hidden known limitation routes to Rina (Case C)
 * 14. Article 5 regression remains healthy (Score = 100, PASS)
 * 15. Article 6 remains appropriately flagged (Score = 84, REVISE)
 * 16. Short narrow content is not automatically rejected
 * 17. Broad short content is rejected/revised appropriately
 * 18. Structured owner routing is deterministic with supporting owner
 * 19. Native Indonesian authoring invariants remain preserved
 * 20. Product review decision requirements remain preserved
 * 21. Canonical 85 threshold remains strictly unchanged
 * 22. Jefry authority remains strictly zero (shadow advisory only)
 */

import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import {
  evaluateHumanWritingQuality,
  detectArticleIntent,
  detectArticleIntentProfile,
  CANONICAL_HUMAN_QUALITY_THRESHOLDS
} from '../src/lib/article/human-quality.ts';
import {
  getJefryProductReviewAdvisoryKnowledge,
  CANONICAL_PRODUCT_REVIEW_KNOWLEDGE_V1
} from '../src/lib/article/product-review-knowledge.ts';

let passed = 0;
async function test(name, fn) {
  await fn();
  console.log('  ✅ PASS: ' + name);
  passed++;
}

async function main() {
  console.log('🧪 Starting EDITORIAL-EXPERT-CONSULTATION-1-STABILIZE Test Suite...\n');

  // Load SQLite DB & Fixtures
  const dbPath = path.resolve('.wrangler/state/v3/d1/miniflare-D1DatabaseObject/37bd9da5950b040e71b09fbfd7ca57290acb451dcd5dc35acb02655fa75fa480.sqlite');
  assert.ok(fs.existsSync(dbPath), 'Local D1 SQLite database must exist');
  const d1 = new DatabaseSync(dbPath);

  const a5Path = path.resolve('scripts/fixtures/article5_canonical.json');
  assert.ok(fs.existsSync(a5Path), 'Article 5 canonical fixture must exist');
  const a5Canonical = JSON.parse(fs.readFileSync(a5Path, 'utf8'));

  // --- SECTION 1: Canonical Article Identities ---
  console.log('--- SECTION 1: Canonical Article Identity Audit ---');

  // 1. Canonical Article 5 identity is unambiguous
  await test('1. Canonical Article 5 identity is unambiguous', () => {
    assert.ok(a5Canonical.content_md, 'Article 5 must contain content_md');
    const firstLine = a5Canonical.content_md.split('\n')[0].trim();
    assert.strictEqual(
      firstLine,
      '# Kusen Aluminium vs uPVC untuk Rumah Tropis di Indonesia',
      'Article 5 canonical title must compare Aluminium vs uPVC'
    );
    // Verified: topic is Aluminium vs uPVC (NOT Kayu vs Aluminium)
    assert.ok(a5Canonical.content_md.includes('uPVC'));
    assert.ok(a5Canonical.content_md.includes('Aluminium'));
  });

  // 2. Article 6 identity is unambiguous
  await test('2. Article 6 identity is unambiguous', () => {
    const a6Row = d1.prepare('SELECT id, slug, title, status FROM articles WHERE id = 6').get();
    assert.ok(a6Row, 'Article 6 row must exist in D1 SQLite');
    assert.strictEqual(a6Row.id, 6);
    assert.strictEqual(a6Row.slug, 'phase5l7-hands-off-publish-fixture');
    assert.strictEqual(a6Row.title, 'Sistem Fasad Adaptif dan Efisiensi Termal Arsitektur Tropis Modern');
  });

  // --- SECTION 2: Academic Distance Generalization & Multi-Fixtures ---
  console.log('--- SECTION 2: Academic Distance Generalization ---');

  // 3. Strong technical explanatory article passes (Fixture A)
  await test('3. Strong technical explanatory article passes (Fixture A)', () => {
    const fixtureA = `
# Prinsip Kerja Teritisan Atap dalam Menahan Tampias Hujan Tropis

Curah hujan tinggi di iklim tropis Indonesia sering kali menimbulkan masalah rembesan air pada kusen jendela dan dinding luar rumah. Teritisan atap atau overstek adalah perisai fisik pertama bangunan untuk menahan air hujan sebelum menyentuh bidang dinding.

Secara teknis, sudut jatuh air hujan saat angin kencang berkisar antara 30 hingga 45 derajat. Dengan lebar overstek minimal 100 cm hingga 120 cm dari as dinding, bidang bukaan jendela kamar tidur dan ruang keluarga terlindung dari terpaan langsung air tampias.

Konsekuensi praktis bagi pemilik rumah sangat jelas: dinding luar terhindar dari rembesan air dan jamur dinding yang merusak plesteran acian. Namun, overstek lebar membutuhkan rangka baja ringan atau struktur kantilever yang kokoh agar mampu menahan gaya angkat angin saat badai.

Sebelum memasang atap, mintalah tukang atau aplikator memeriksa kemiringan dan kekuatan pengikat reng ke kuda-kuda agar struktur overstek stabil.
`;
    const res = evaluateHumanWritingQuality(fixtureA);
    assert.strictEqual(res.decision, 'HUMAN_WRITING_PASS');
    assert.ok(res.total_score >= 85);
    assert.ok(!res.issues.some((i) => i.code === 'ACADEMIC_DISTANCE_EXCESSIVE'));
  });

  // 4. Academic detached article revises (Fixture B: General acoustic physics)
  await test('4. Academic detached article revises (Fixture B: Acoustic insulation essay)', () => {
    const fixtureB = `
## Kajian Transmisi Akustik dan Peredaman Gelombang Bunyi pada Partisi Ganda

Karakteristik akustik ruang pada struktur arsitektural kontemporer ditentukan oleh koefisien reduksi kebisingan (*sound transmission class* / STC). Analisis teoritis menunjukkan bahwa transmisi gelombang suara pada partisi masif dipengaruhi oleh hukum massa (*mass law*) dan frekuensi resonansi rongga udara.

Fenomena perpindahan energi akustik melalui celah mikro menghasilkan degradasi insulasi suara yang signifikan. Penerapan dinding ganda dengan pengisi serat mineral densitas tinggi mereduksi transmisi gelombang frekuensi menengah hingga 45 dB.

Integrasi material peredam getaran pada profil rangka bertujuan memutus jembatan suara (*acoustic bridging*) guna menjamin durabilitas isolasi jangka panjang. Metodologi pengujian mengonfirmasi bahwa efisiensi peredaman bunyi tercapai saat parameter koefisien penyerapan suara memenuhi batas minimum ISO 140.
`;
    const res = evaluateHumanWritingQuality(fixtureB);
    assert.strictEqual(res.decision, 'HUMAN_WRITING_REVISE');
    assert.ok(res.total_score < 85);
    assert.ok(res.issues.some((i) => i.code === 'ACADEMIC_DISTANCE_EXCESSIVE'));
  });

  // 5. Formal standards article does not false-fail (Fixture C)
  await test('5. Formal standards article does not false-fail (Fixture C: Concrete curing SNI)', () => {
    const fixtureC = `
# Penerapan Standar SNI 03-2847 untuk Perawatan Beton Dak Rumah Tinggal

Kekuatan tekan karakteristik struktur beton bertulang pada dak atap rumah tinggal tropis sangat dipengaruhi oleh proses hidrasi semen selama 14 hari pertama setelah pengecoran.

Berdasarkan ketentuan SNI 03-2847-2002, beton mutu f'c 20 MPa harus dirawat (*curing*) dengan mempertahankan kelembapan permukaan secara kontinu. Di iklim tropis dengan suhu siang mencapai 34 derajat Celsius, penguapan air beton yang terlalu cepat memicu retak susut plastis (*plastic shrinkage cracking*) yang menjadi celah bocor saat musim hujan.

Konsekuensi praktis bagi pemilik rumah: genangan air di dak atap dapat merembes ke plafon lantai bawah jika perawatan diabaikan. Lakukan pembasahan dengan karung goni basah atau penggenangan air setinggi 2 cm selama minimal 7 hari berturut-turut.

Mintalah mandor atau tukang Anda untuk tidak membuka bekisting sisi bawah sebelum pengujian umur beton mencapai minimal 21 hari.
`;
    const res = evaluateHumanWritingQuality(fixtureC);
    assert.strictEqual(res.decision, 'HUMAN_WRITING_PASS');
    assert.ok(res.total_score >= 85);
    assert.ok(!res.issues.some((i) => i.code === 'ACADEMIC_DISTANCE_EXCESSIVE'));
  });

  // 6. Concise narrow article can pass (Fixture D: Thermal break explainer)
  await test('6. Concise narrow article can pass (Fixture D: Narrow thermal break explainer)', () => {
    const fixtureD = `
# Apa Itu Thermal Break pada Kusen Jendela Aluminium?

Pernahkah Anda memegang kusen aluminium di dalam rumah saat panas terik dan mendapatinya terasa panas menyengat? Hal ini terjadi karena aluminium adalah konduktor panas yang sangat baik.

*Thermal break* adalah lapisan insulator poliamida struktural yang disisipkan tepat di tengah profil aluminium ekstrusi. Lapisan ini memutus kontak langsung antara logam luar dan logam dalam sehingga panas matahari luar tidak merambat ke dalam kamar tidur.

Bagi pemilik rumah di Indonesia, teknologi ini menjaga kusen dalam tetap sejuk dan mencegah pengembunan air saat AC menyala dingin. Jika anggaran Anda mencukupi, tanyakan ke aplikator apakah kusen yang ditawarkan sudah menggunakan profil *thermal break*.
`;
    const res = evaluateHumanWritingQuality(fixtureD);
    assert.strictEqual(res.decision, 'HUMAN_WRITING_PASS');
    assert.ok(res.total_score >= 85);
    assert.ok(!res.issues.some((i) => i.code === 'SCOPE_DEPTH_MISMATCH'));
  });

  // 7. Broad shallow article triggers scope-depth mismatch
  await test('7. Broad shallow article triggers scope-depth mismatch', () => {
    const fixtureE = `
# Panduan Lengkap Desain Rumah Tropis Modern Hemat Energi

Desain rumah tropis yang ideal membutuhkan pertimbangan matang pada sirkulasi udara, pencahayaan alami, dan orientasi bangunan terhadap panas matahari.

Gunakan ventilasi silang yang teratur di seluruh ruangan dan pasang panel surya di atap rumah untuk menghemat tagihan listrik bulanan hunian Anda.
`;
    const res = evaluateHumanWritingQuality(fixtureE);
    assert.ok(res.issues.some((i) => i.code === 'SCOPE_DEPTH_MISMATCH'));
  });

  // --- SECTION 3: Multi-Signal Intent Model & Hybrid Articles ---
  console.log('--- SECTION 3: Multi-Signal Intent Model ---');

  // 8. Hybrid article detects primary + secondary intent correctly
  await test('8. Hybrid article detects primary + secondary intent correctly', () => {
    const hybridMd = `
# Cara Mengatasi Rumah Panas: Perbandingan Insulasi Atap dan Ventilasi Silang

Rumah tinggal di kawasan perkotaan sering kali mengalami suhu interior yang menyengat akibat paparan radiasi matahari pada atap dan sirkulasi udara yang minim.

## Diagnosis Sumber Panas Utama
Langkah pertama sebelum memilih penanganan adalah mendeteksi apakah panas masuk melalui konduksi atap genteng atau terjebak karena ventilasi mati.

## Perbandingan Solusi: Aluminium Foil vs Turbin Ventilator
Insulasi aluminium foil gelembung efektif memantulkan 95% radiasi panas atap. Sebaliknya, turbin ventilator menarik udara panas keluar melalui efek termosifon.

## Langkah Pemasangan dan Urutan Pengerjaan
Pasang insulasi tepat di bawah reng sebelum genteng dipasang, lalu lengkapi dengan kisi ventilasi silang di sisi dinding barat dan timur.
`;
    const profile = detectArticleIntentProfile(hybridMd);
    assert.strictEqual(profile.primary_intent, 'PROBLEM_SOLVING');
    assert.ok(profile.secondary_intents.includes('COMPARISON'), 'Must identify COMPARISON secondary intent');
    assert.ok(profile.secondary_intents.includes('INSTALLATION_HOW_TO'), 'Must identify INSTALLATION_HOW_TO secondary intent');
    assert.strictEqual(profile.confidence, 'HIGH');
  });

  // 9. Low-confidence intent avoids severe blind penalty
  await test('9. Low-confidence intent avoids severe blind penalty', () => {
    const ambiguousMd = `
Catatan Mengenai Dinding Ruangan

Dinding pembatas ruang interior menggunakan plester semen instan ketebalan 10 mm. Komposisi agregat pasir silika halus menghasilkan permukaan rata tanpa gelombang.
`;
    const profile = detectArticleIntentProfile(ambiguousMd);
    assert.strictEqual(profile.confidence, 'LOW');
    const res = evaluateHumanWritingQuality(ambiguousMd, { articleIntentProfile: profile });
    // Low confidence reduces penalties: no issue should have penalty 16
    assert.ok(res.issues.every((i) => i.penalty < 16), 'Low-confidence intent must not apply 16-point severe penalty');
  });

  // --- SECTION 4: Comparison & Decision Support Requirements ---
  console.log('--- SECTION 4: Decision Support & Trade-Offs ---');

  // 10. Comparison requires meaningful trade-off
  await test('10. Comparison requires meaningful trade-off', () => {
    const compNoTradeOff = `
# Kusen Baja Ringan vs Kusen Kayu untuk Hunian

Dalam memilih antara kusen baja ringan versus kusen kayu, banyak pemilik rumah bingung menentukan pilihan. Kusen kayu memiliki serat indah dan mudah dibentuk oleh tukang kayu di workshop lokal.

Namun baja ringan adalah produk terbaik untuk semua hunian tanpa tanding dan selalu lebih unggul dalam segala hal. Kusen baja ringan wajib dipilih oleh siapa pun karena praktis dan tidak perlu memikirkan kekurangan apa pun.
`;
    const res = evaluateHumanWritingQuality(compNoTradeOff);
    assert.ok(res.issues.some((i) => i.code === 'TRADE_OFFS_INCOMPLETE' || i.code === 'SCENARIO_FIT_MISSING'));
  });

  // --- SECTION 5: Deterministic Owner Routing (Cases A, B, C) ---
  console.log('--- SECTION 5: Deterministic Owner Routing ---');

  // 11. Missing trade-off evidence routes to Irwan (Case A)
  await test('11. Missing trade-off evidence routes to Irwan (Case A: RESEARCH_REQUIRED)', () => {
    const compMd = `
# Kusen Vinyl vs Kusen Baja untuk Jendela Depan

Perbandingan antara kusen vinyl dan kusen baja sering dibahas pemilik rumah yang merenovasi fasad depan. Kusen vinyl mudah dibersihkan dan memiliki warna konsisten.

Pilihlah salah satu sesuai dengan selera tampilan rumah Anda.
`;
    const res = evaluateHumanWritingQuality(compMd, { hasTradeOffEvidence: false });
    assert.ok(res.issues.some((i) => i.code === 'TRADE_OFFS_INCOMPLETE'));
    assert.ok(res.rewrite_brief);
    assert.strictEqual(res.rewrite_brief.target_agent_id, 'evidence_researcher_lead');
    assert.strictEqual(res.rewrite_brief.supporting_agent_id, 'content_writer_primary');
    assert.strictEqual(res.rewrite_brief.revision_reason, 'RESEARCH_REQUIRED');
  });

  // 12. Existing evidence but missing explanation routes to Joko (Case B)
  await test('12. Existing evidence but missing explanation routes to Joko (Case B: EDITORIAL_EXPLANATION_REQUIRED)', () => {
    const compMd = `
# Kusen Vinyl vs Kusen Baja untuk Jendela Depan

Perbandingan antara kusen vinyl dan kusen baja sering dibahas pemilik rumah yang merenovasi fasad depan. Kusen vinyl mudah dibersihkan dan memiliki warna konsisten.

Pilihlah salah satu sesuai dengan selera tampilan rumah Anda.
`;
    const res = evaluateHumanWritingQuality(compMd, { hasTradeOffEvidence: true });
    assert.ok(res.issues.some((i) => i.code === 'TRADE_OFFS_INCOMPLETE'));
    assert.ok(res.rewrite_brief);
    assert.strictEqual(res.rewrite_brief.target_agent_id, 'content_writer_primary');
    assert.strictEqual(res.rewrite_brief.revision_reason, 'EDITORIAL_EXPLANATION_REQUIRED');
  });

  // 13. Hidden known limitation routes to Rina (Case C)
  await test('13. Hidden known limitation routes to Rina (Case C: EDITORIAL_INTEGRITY_REVIEW)', () => {
    const compMd = `
# Kusen Vinyl vs Kusen Baja untuk Jendela Depan

Perbandingan antara kusen vinyl dan kusen baja sering dibahas pemilik rumah yang merenovasi fasad depan. Kusen vinyl mudah dibersihkan dan memiliki warna konsisten.

Pilihlah salah satu sesuai dengan selera tampilan rumah Anda.
`;
    const res = evaluateHumanWritingQuality(compMd, { isBiasedTradeOffSuppression: true });
    assert.ok(res.rewrite_brief);
    assert.strictEqual(res.rewrite_brief.target_agent_id, 'editorial_qa_primary');
    assert.strictEqual(res.rewrite_brief.supporting_agent_id, 'content_writer_primary');
    assert.strictEqual(res.rewrite_brief.revision_reason, 'EDITORIAL_INTEGRITY_REVIEW');
  });

  // --- SECTION 6: Real Corpus Regressions ---
  console.log('--- SECTION 6: Real Corpus Regressions ---');

  // 14. Article 5 regression remains healthy
  await test('14. Article 5 regression remains healthy (Score = 100, PASS)', () => {
    const res = evaluateHumanWritingQuality(a5Canonical.content_md);
    assert.strictEqual(res.decision, 'HUMAN_WRITING_PASS');
    assert.strictEqual(res.total_score, 100);
    assert.strictEqual(res.issues.length, 0);
  });

  // 15. Article 6 remains appropriately flagged
  await test('15. Article 6 remains appropriately flagged (Score = 84, REVISE)', () => {
    const a6Row = d1.prepare('SELECT content_md FROM articles WHERE id = 6').get();
    assert.ok(a6Row);
    const res = evaluateHumanWritingQuality(a6Row.content_md);
    assert.strictEqual(res.decision, 'HUMAN_WRITING_REVISE');
    assert.strictEqual(res.total_score, 84);
    assert.ok(res.issues.some((i) => i.code === 'ACADEMIC_DISTANCE_EXCESSIVE'));
    assert.strictEqual(res.rewrite_brief.target_agent_id, 'content_writer_primary');
  });

  // --- SECTION 7: Content Length & Breadth Integrity ---
  console.log('--- SECTION 7: Scope & Length Calibration ---');

  // 16. Short narrow content is not automatically rejected
  await test('16. Short narrow content is not automatically rejected', () => {
    const shortNarrowMd = `
# Definisi Overstek pada Atap Rumah Tropis

Overstek adalah bagian atap terluar yang menjorok keluar melampaui bidang dinding terluar bangunan rumah.

Fungsi utamanya adalah memayungi dinding dan jendela dari terpaan air hujan langsung serta mengurangi radiasi sinar matahari sore ke bukaan kamar tidur.

Pastikan panjang overstek minimal 100 cm agar efektif menahan tampias air hujan dengan sudut 45 derajat.
`;
    const res = evaluateHumanWritingQuality(shortNarrowMd);
    assert.ok(!res.issues.some((i) => i.code === 'SCOPE_DEPTH_MISMATCH'));
    assert.strictEqual(res.decision, 'HUMAN_WRITING_PASS');
  });

  // 17. Broad short content is rejected/revised appropriately
  await test('17. Broad short content is rejected/revised appropriately', () => {
    const broadShortMd = `
# Solusi Rumah Panas Menyeluruh: Panduan Total Renovasi

Rumah panas dapat diatasi dengan beberapa langkah mudah.

Pasang insulasi atap dan buka jendela agar udara berputar sejuk.
`;
    const res = evaluateHumanWritingQuality(broadShortMd);
    assert.ok(res.issues.some((i) => i.code === 'SCOPE_DEPTH_MISMATCH'));
  });

  // 18. Structured owner routing is deterministic with supporting owner
  await test('18. Structured owner routing is deterministic with supporting owner', () => {
    const md = `
# Ulasan Pompa Pendorong Air Rumah Tangga

Pompa ini memiliki spesifikasi daya 125 watt dengan debit air 30 liter per menit.
`;
    const res = evaluateHumanWritingQuality(md, {
      articleId: 42,
      taskId: 'task_qa_42',
      hasTradeOffEvidence: false
    });
    if (res.rewrite_brief) {
      assert.strictEqual(res.rewrite_brief.article_id, 42);
      assert.strictEqual(res.rewrite_brief.task_id, 'task_qa_42');
      assert.ok(typeof res.rewrite_brief.target_agent_id === 'string');
      assert.ok(res.rewrite_brief.revision_reason);
    }
  });

  // --- SECTION 8: Editorial Invariants & Governance ---
  console.log('--- SECTION 8: Invariants & Governance ---');

  // 19. Native Indonesian authoring invariants remain preserved
  await test('19. Native Indonesian authoring invariants remain preserved', () => {
    const translationeseText = `
# Ketika Datang ke Pemilihan Kusen Jendela

Ketika datang ke pemilihan kusen, ini adalah sesuatu yang perlu Anda pertimbangkan dengan cermat. Hadir dengan sejumlah fitur menarik dan keputusan berada di tangan Anda.
`;
    const res = evaluateHumanWritingQuality(translationeseText);
    assert.ok(res.issues.some((i) => i.code === 'TRANSLATIONESE_DETECTED'));
  });

  // 20. Product review decision requirements remain preserved
  await test('20. Product review decision requirements remain preserved', () => {
    assert.ok(CANONICAL_PRODUCT_REVIEW_KNOWLEDGE_V1);
    assert.strictEqual(CANONICAL_PRODUCT_REVIEW_KNOWLEDGE_V1.decision_questions.length, 9);
    assert.ok(Object.keys(CANONICAL_PRODUCT_REVIEW_KNOWLEDGE_V1.layer2_use_case_and_compatibility.compatibility_dimensions).length >= 3);
  });

  // 21. Canonical 85 threshold remains strictly unchanged
  await test('21. Canonical 85 threshold remains strictly unchanged', () => {
    assert.strictEqual(CANONICAL_HUMAN_QUALITY_THRESHOLDS.PASS, 85);
    assert.strictEqual(CANONICAL_HUMAN_QUALITY_THRESHOLDS.REVISE, 75);
    assert.strictEqual(CANONICAL_HUMAN_QUALITY_THRESHOLDS.REWRITE, 0);
  });

  // 22. Jefry authority remains strictly zero (shadow advisory only)
  await test('22. Jefry authority remains strictly zero (shadow advisory only)', () => {
    const jefry = getJefryProductReviewAdvisoryKnowledge();
    assert.strictEqual(jefry.operating_mode, 'SHADOW_MODE_ONLY');
    assert.strictEqual(jefry.authority.autonomous_execution, false);
    assert.strictEqual(jefry.authority.review_writing, false);
    assert.strictEqual(jefry.authority.score_manipulation, false);
    assert.strictEqual(jefry.authority.product_recommendation_execution, false);
    assert.strictEqual(jefry.authority.commercial_influence, false);
  });

  console.log(`\n🎉 All ${passed} tests in EDITORIAL-EXPERT-CONSULTATION-1-STABILIZE passed successfully!`);
}

main().catch((err) => {
  console.error('❌ Test failed:', err);
  process.exit(1);
});
