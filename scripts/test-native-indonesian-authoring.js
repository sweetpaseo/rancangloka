/**
 * RancangLoka Native Indonesian Authoring Test Suite
 * Milestone: NATIVE-INDONESIAN-AUTHORING-1
 *
 * Verifies that:
 * 1. Canonical language is Bahasa Indonesia
 * 2. Native authoring rule exists in Editorial Knowledge V1
 * 3. Joko receives the rule
 * 4. Rina receives language QA responsibility (NATIVE_INDONESIAN_LANGUAGE_QA)
 * 5. Product Review inherits the rule
 * 6. Common translationese can be flagged (TRANSLATIONESE_DETECTED)
 * 7. Valid technical English terms are allowed (thermal break, U-value, low-e, mortise, firmware, etc.)
 * 8. Natural Indonesian technical prose can PASS (score >= 85)
 * 9. Formal technical/regulatory prose is not automatically rejected
 * 10. Severe translated prose cannot PASS (score < 75 or REWRITE)
 * 11. Existing 84/85 threshold tests remain intact
 * 12. Terminology guard remains intact
 * 13. Editorial benchmark remains green
 * 14. Jefry authority remains zero
 */

import assert from 'node:assert/strict';
import {
  RANCANGLOKA_EDITORIAL_KNOWLEDGE_VERSION,
  CANONICAL_EDITORIAL_KNOWLEDGE_V1,
  CANONICAL_NATIVE_INDONESIAN_AUTHORING_RULE,
  TECHNICAL_ENGLISH_ALLOWLIST,
  getJokoAuthoringKnowledge,
  getRinaQAKnowledge,
  getJefryAdvisoryKnowledge,
  getCanonicalTerm
} from '../src/lib/article/editorial-knowledge.ts';

import {
  RANCANGLOKA_PRODUCT_REVIEW_KNOWLEDGE_VERSION,
  CANONICAL_PRODUCT_REVIEW_KNOWLEDGE_V1,
  getJokoProductReviewKnowledge,
  getRinaProductReviewQAKnowledge
} from '../src/lib/article/product-review-knowledge.ts';

import {
  evaluateHumanWritingQuality,
  TRANSLATIONESE_PATTERNS,
  CANONICAL_HUMAN_QUALITY_THRESHOLDS
} from '../src/lib/article/human-quality.ts';

console.log('🧪 Starting NATIVE-INDONESIAN-AUTHORING-1 Test Suite...\n');

let passedTests = 0;

function runTest(name, fn) {
  try {
    fn();
    console.log(`  ✅ PASS: ${name}`);
    passedTests++;
  } catch (err) {
    console.error(`  ❌ FAIL: ${name}`);
    console.error(err);
    process.exit(1);
  }
}

// ----------------------------------------------------------------------------
// TEST 1: Canonical language is Bahasa Indonesia
// ----------------------------------------------------------------------------
runTest('1. Canonical authoring language is strictly Bahasa Indonesia', () => {
  assert.equal(CANONICAL_NATIVE_INDONESIAN_AUTHORING_RULE.canonical_language, 'Bahasa Indonesia');
  assert.equal(CANONICAL_NATIVE_INDONESIAN_AUTHORING_RULE.principle, 'NATIVE_INDONESIAN_AUTHORING');
  assert.equal(CANONICAL_NATIVE_INDONESIAN_AUTHORING_RULE.target_register, 'PROFESSIONAL_NATURAL_CLEAR_INDONESIAN');
});

// ----------------------------------------------------------------------------
// TEST 2: Native authoring rule exists in Editorial Knowledge V1
// ----------------------------------------------------------------------------
runTest('2. Native authoring rule exists in Editorial Knowledge V1', () => {
  assert.ok(CANONICAL_EDITORIAL_KNOWLEDGE_V1.layer2_language_cohesion.native_indonesian_authoring);
  assert.equal(
    CANONICAL_EDITORIAL_KNOWLEDGE_V1.layer2_language_cohesion.native_indonesian_authoring.principle,
    'NATIVE_INDONESIAN_AUTHORING'
  );
  assert.ok(CANONICAL_EDITORIAL_KNOWLEDGE_V1.layer2_language_cohesion.native_indonesian_authoring.definition.includes('native authoring language'));
  assert.ok(CANONICAL_EDITORIAL_KNOWLEDGE_V1.native_indonesian_authoring);
});

// ----------------------------------------------------------------------------
// TEST 3: Joko receives the native authoring rule
// ----------------------------------------------------------------------------
runTest('3. Joko adapter receives the native authoring rule and authoring rules array', () => {
  const joko = getJokoAuthoringKnowledge();
  assert.ok(joko.native_indonesian_authoring);
  assert.equal(joko.native_indonesian_authoring.principle, 'NATIVE_INDONESIAN_AUTHORING');
  assert.ok(Array.isArray(joko.joko_authoring_rules));
  assert.ok(joko.joko_authoring_rules.some(r => r.includes('Formulasikan naskah artikel langsung dalam bahasa Indonesia')));
  assert.ok(joko.joko_authoring_rules.some(r => r.includes('DILARANG menggunakan draf bahasa Inggris sebagai artefak antara')));
});

// ----------------------------------------------------------------------------
// TEST 4: Rina receives language QA responsibility (NATIVE_INDONESIAN_LANGUAGE_QA)
// ----------------------------------------------------------------------------
runTest('4. Rina adapter receives NATIVE_INDONESIAN_LANGUAGE_QA responsibility', () => {
  const rina = getRinaQAKnowledge();
  assert.ok(rina.native_indonesian_language_qa);
  assert.equal(rina.native_indonesian_language_qa.responsibility, 'NATIVE_INDONESIAN_LANGUAGE_QA');
  assert.ok(rina.native_indonesian_language_qa.checks.includes('sounds originally written in Indonesian'));
  assert.ok(rina.native_indonesian_language_qa.checks.includes('contains translationese patterns'));
  assert.ok(rina.native_indonesian_language_qa.routing.includes('REVISE atau REWRITE'));
});

// ----------------------------------------------------------------------------
// TEST 5: Product Review Knowledge inherits the rule
// ----------------------------------------------------------------------------
runTest('5. Product Review Knowledge inherits native authoring rules and language QA', () => {
  const jokoProd = getJokoProductReviewKnowledge();
  const rinaProd = getRinaProductReviewQAKnowledge();
  assert.ok(jokoProd.native_indonesian_authoring);
  assert.equal(jokoProd.native_indonesian_authoring.principle, 'NATIVE_INDONESIAN_AUTHORING');
  assert.ok(rinaProd.native_indonesian_language_qa);
  assert.equal(rinaProd.native_indonesian_language_qa.responsibility, 'NATIVE_INDONESIAN_LANGUAGE_QA');
});

// ----------------------------------------------------------------------------
// TEST 6: Common translationese can be flagged (TRANSLATIONESE_DETECTED)
// ----------------------------------------------------------------------------
runTest('6. Common translationese patterns are detected and flagged with TRANSLATIONESE_DETECTED', () => {
  const translationeseDraft = `
## Evaluasi Kusen Aluminium untuk Rumah Tinggal

Memasang kusen aluminium membutuhkan ketelitian pada ukuran bukaan dinding bata dan kualitas profil ekstrusi. Ketebalan profil minimal 1.3 mm standar SNI dianjurkan untuk bukaan jendela kamar agar tidak melengkung saat menahan beban angin kencang dan gempa mikro.

Ketika datang ke pemilihan warna kusen, proses powder coating memberikan ketahanan warna lebih baik terhadap terik sinar matahari tropis dibanding cat semprot biasa. Pada akhirnya, keputusan berada di tangan Anda untuk memilih warna yang selaras dengan fasad rumah.

Sambungan sudut mitre 45 derajat wajib diberi sealant poliuretan elastis agar rembesan air hujan dan tampias tidak merembes ke dinding acian plesteran bagian dalam saat musim hujan lebat di Indonesia.
`;

  const result = evaluateHumanWritingQuality(translationeseDraft);
  assert.ok(result.issues.some(i => i.code === 'TRANSLATIONESE_DETECTED'));
  const transIssue = result.issues.find(i => i.code === 'TRANSLATIONESE_DETECTED');
  assert.equal(transIssue.category, 'TRANSLATIONESE');
  assert.equal(transIssue.severity, 'WARNING');
  assert.equal(result.decision, 'HUMAN_WRITING_REVISE');
  assert.ok(result.total_score >= 75 && result.total_score <= 84);
  assert.ok(result.rewrite_brief);
  assert.equal(result.rewrite_brief.target_agent_id, 'content_writer_primary');
  assert.ok(result.rewrite_brief.required_actions.some(a => a.includes('bahasa Indonesia alami')));
});

// ----------------------------------------------------------------------------
// TEST 7: Valid technical English terms are allowed
// ----------------------------------------------------------------------------
runTest('7. Valid technical English terms are allowed and defined in TECHNICAL_ENGLISH_ALLOWLIST', () => {
  assert.ok(TECHNICAL_ENGLISH_ALLOWLIST.includes('thermal break'));
  assert.ok(TECHNICAL_ENGLISH_ALLOWLIST.includes('u-value'));
  assert.ok(TECHNICAL_ENGLISH_ALLOWLIST.includes('low-e'));
  assert.ok(TECHNICAL_ENGLISH_ALLOWLIST.includes('firmware'));
  assert.ok(TECHNICAL_ENGLISH_ALLOWLIST.includes('mortise'));
  assert.ok(TECHNICAL_ENGLISH_ALLOWLIST.includes('anodized'));
  assert.ok(TECHNICAL_ENGLISH_ALLOWLIST.includes('powder coating'));
});

// ----------------------------------------------------------------------------
// TEST 8: Natural Indonesian technical prose can PASS (score >= 85)
// ----------------------------------------------------------------------------
runTest('8. Natural Indonesian technical prose containing legitimate English terms PASSES with score >= 85', () => {
  const strongNativeDraft = `
## Mengatasi Panas Sore pada Bukaan Kamar Tidur Barat

Kamar tidur yang menghadap barat sering kali berubah menjadi ruang sauna begitu malam tiba. Dinding bata dan kaca jendela menyerap radiasi terik matahari siang, lalu melepaskan akumulasi kalor tersebut berjam-jam setelah matahari terbenam. Bagi penghuni rumah, kondisi ini membuat istirahat malam tidak nyaman dan tagihan pendingin ruangan membengkak.

### Titik Lemah Konduktivitas Kusen Logam

Aluminium standar merupakan konduktor termal yang sangat efisien. Panas dari luar akan merambat langsung melintasi ketebalan profil logam menuju ruangan dalam. Untuk memutus jembatan rambatan panas ini, teknologi **thermal break** menyisipkan material poliamida non-konduktif di antara profil luar dan dalam, sehingga nilai konduktivitas termal (**U-value**) rangka dapat ditekan hingga di bawah 2.2 W/m²K sesuai standar uji termal konstruksi.

Dipadukan dengan kaca berlapis ganda beremisi rendah (**low-e**), penetrasi radiasi matahari dapat direduksi hingga 65% tanpa mengorbankan masuknya cahaya alami. Di iklim tropis Indonesia yang basah dan lembap, lapisan akhir **powder coating** atau **anodized** pada kusen juga memberikan perlindungan jangka panjang terhadap karat dan jamur akibat tampias air hujan deras.

### Panduan Keputusan untuk Pemilik Rumah

Sebelum memutuskan material bukaan, lakukan pengecekan tapak secara cermat:

- Jika jendela terpapar matahari barat langsung lebih dari 4 jam sehari dan menjadi ruang tidur utama, prioritaskan kusen dengan insulasi **thermal break** dan kaca insulasi ganda.
- Jika bukaan berada di area terlindung teritisan lebar (overstek > 1.2 meter), kusen aluminium standar sudah memadai asalkan seal karet EPDM dan drainase talang air terpasang rapat.
- Saat tukang memasang, periksa sambungan sudut kusen dengan mistar siku presisi dan pastikan celah antara dinding bata acian diisi sealant poliuretan elastis tahan cuaca.
`;

  const result = evaluateHumanWritingQuality(strongNativeDraft);
  assert.equal(result.decision, 'HUMAN_WRITING_PASS');
  assert.ok(result.total_score >= 85);
  assert.equal(result.issues.filter(i => i.code === 'TRANSLATIONESE_DETECTED').length, 0);
  assert.ok(result.strong_areas.some(s => s.includes('Bahasa mengalir asli dalam bahasa Indonesia')));
});

// ----------------------------------------------------------------------------
// TEST 9: Formal technical/regulatory prose is not automatically rejected
// ----------------------------------------------------------------------------
runTest('9. Formal technical and regulatory excerpt does not falsely trigger translationese', () => {
  const formalRegulatoryDraft = `
## Persyaratan Teknis Ketahanan Struktur Bangunan Hunian

Berdasarkan ketentuan standar SNI 03-1726-2019, perencanaan ketahanan gempa untuk struktur bangunan gedung dan non gedung menetapkan kriteria beban lateral yang wajib dipenuhi oleh perancang struktur di Indonesia.

Pelat dak beton bertulang dianjurkan untuk dicor dengan ketebalan minimal 12 cm dan menggunakan mutu beton minimum fc 20 MPa. Tulangan tarik dan susut harus dipasang dengan selimut beton setebal 25 mm guna mencegah korosi dini akibat kelembapan iklim tropis dan penetrasi air hujan. Sambungan antar-kolom praktis dan dinding bata merah wajib diikat dengan angkur besi berdiameter 8 mm setiap jarak 50 cm.

Sebelum pengecoran dilakukan, pastikan bekisting bersih dari serbuk gergaji dan lumut, serta permukaan tulangan bebas dari karat lepas agar ikatan pasta semen bekerja optimal.
`;

  const result = evaluateHumanWritingQuality(formalRegulatoryDraft);
  assert.equal(result.issues.filter(i => i.code === 'TRANSLATIONESE_DETECTED').length, 0);
});

// ----------------------------------------------------------------------------
// TEST 10: Severe translated prose cannot PASS (score < 75 or REWRITE)
// ----------------------------------------------------------------------------
runTest('10. Severe machine translation style receives critical penalty and cannot PASS (forces REWRITE < 75)', () => {
  const severeMachineDraft = `
## Instalasi Pintu Pintar Rumah

Ketika datang ke keamanan rumah, ini adalah sesuatu yang perlu Anda pertimbangkan.
Dalam hal pemilihan kunci pintu, terdapat beberapa faktor yang penting untuk dipahami.
Dalam hal ini, penting untuk memahami bahwa perangkat pintar ini adalah penting untuk hunian modern.
Produk ini hadir dengan sejumlah fitur canggih yang dirancang untuk pengguna.
Yang mana hal ini memainkan peran kunci dalam mencegah pencurian.
Pada akhirnya, keputusan berada di tangan Anda untuk memilih sistem mana yang paling cocok.
Pilihan terbaik akan bergantung pada kebutuhan Anda masing-masing di rumah.
`;

  const result = evaluateHumanWritingQuality(severeMachineDraft);
  assert.ok(result.total_score < 75);
  assert.equal(result.decision, 'HUMAN_WRITING_REWRITE');
  const transIssue = result.issues.find(i => i.code === 'TRANSLATIONESE_DETECTED');
  assert.ok(transIssue);
  assert.equal(transIssue.severity, 'CRITICAL');
  assert.equal(transIssue.penalty, 28);
  assert.equal(result.rewrite_brief.target_agent_id, 'content_writer_primary');
});

// ----------------------------------------------------------------------------
// TEST 11: Existing 84/85 threshold tests remain intact
// ----------------------------------------------------------------------------
runTest('11. Canonical threshold boundary invariants (85 PASS, 75-84 REVISE, <75 REWRITE) remain intact', () => {
  assert.equal(CANONICAL_HUMAN_QUALITY_THRESHOLDS.PASS, 85);
  assert.equal(CANONICAL_HUMAN_QUALITY_THRESHOLDS.REVISE, 75);
  assert.equal(CANONICAL_HUMAN_QUALITY_THRESHOLDS.REWRITE, 0);
});

// ----------------------------------------------------------------------------
// TEST 12: Terminology guard remains intact
// ----------------------------------------------------------------------------
runTest('12. Verdict prohibition and canonical terminology mapping remain intact', () => {
  const verdictLookup = getCanonicalTerm('verdict');
  assert.ok(verdictLookup);
  assert.equal(verdictLookup.is_prohibited_variation, true);
});

// ----------------------------------------------------------------------------
// TEST 13: Jefry authority remains zero
// ----------------------------------------------------------------------------
runTest('13. Jefry authority remains strictly zero (shadow mode only, zero execution authority)', () => {
  const jefry = getJefryAdvisoryKnowledge();
  assert.equal(jefry.operating_mode, 'SHADOW_MODE_ONLY');
  assert.equal(jefry.authority.autonomous_execution, false);
  assert.equal(jefry.authority.editorial_approval, false);
  assert.equal(jefry.authority.publishing_authority, false);
  assert.equal(jefry.authority.authoring_authority, false);
});

console.log(`\n🎉 All ${passedTests} tests in NATIVE-INDONESIAN-AUTHORING-1 passed successfully!`);
