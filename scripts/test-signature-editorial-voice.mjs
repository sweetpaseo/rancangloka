/**
 * Test Suite: Signature Editorial Voice & Editorial Intelligence (Owner Directive 2026-11-27)
 * Validates:
 * 1. Canonical knowledge definitions (5 pillars, philosophy, conceptual distinctions)
 * 2. Role-specific knowledge views propagation (Joko, Nadia, Irwan, Rina, SEON, Maya, Jefry)
 * 3. Primary Brain & standards shared memory files
 * 4. Second Brain retrieval of Rose Article learning cases
 * 5. Authorial presence ("saya" for editorial judgment) vs rejection of fabricated claims
 * 6. Prompt builder integration across Joko and Nadia
 * 7. Gate A Definition of Done integration (A.13 Authentic Contextual Evidence)
 */

import assert from 'node:assert';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const PROJECT_ROOT = path.resolve(__dirname, '..');

// Set isolated test environment
process.env.NODE_ENV = 'test';
process.env.SHARED_MEMORY_DIR = path.resolve(PROJECT_ROOT, 'docs/shared-memory');
process.env.RANCANGLOKA_SHARED_MEMORY_DIR = path.resolve(PROJECT_ROOT, 'docs/shared-memory');

console.log('=== TEST SUITE: SIGNATURE EDITORIAL VOICE & EDITORIAL INTELLIGENCE ===\n');

async function runTests() {
  let passed = 0;
  let total = 0;
  const testQueue = [];

  function test(name, fn) {
    total++;
    testQueue.push(async () => {
      try {
        await fn();
        console.log(`  [PASS] ${name}`);
        passed++;
      } catch (err) {
        console.log(`  [FAIL] ${name}`);
        console.log(err);
      }
    });
  }

  // --------------------------------------------------------------------------
  // 1. Canonical Knowledge & 5 Pillars
  // --------------------------------------------------------------------------
  console.log('--- 1. Canonical Knowledge & 5 Pillars ---');
  const {
    CANONICAL_SIGNATURE_EDITORIAL_VOICE,
    CANONICAL_EDITORIAL_KNOWLEDGE,
    RANCANGLOKA_EDITORIAL_KNOWLEDGE_V2_VERSION
  } = await import('../src/lib/article/editorial-knowledge.ts');

  test('1.1 Canonical signature editorial voice exports version V2 and philosophy', () => {
    assert.strictEqual(RANCANGLOKA_EDITORIAL_KNOWLEDGE_V2_VERSION, 'RANCANGLOKA_EDITORIAL_KNOWLEDGE_V2');
    assert.ok(CANONICAL_SIGNATURE_EDITORIAL_VOICE, 'CANONICAL_SIGNATURE_EDITORIAL_VOICE must be defined');
    assert.strictEqual(
      CANONICAL_SIGNATURE_EDITORIAL_VOICE.philosophy,
      'Berisi seperti ahli, ngobrol seperti teman, berpikir seperti penulis.'
    );
  });

  test('1.2 All 5 capability pillars are thoroughly defined', () => {
    const pillars = CANONICAL_SIGNATURE_EDITORIAL_VOICE.five_capability_pillars;
    assert.ok(pillars.knowledge_and_evidence, 'Pillar 1 must exist');
    assert.ok(pillars.editorial_intelligence, 'Pillar 2 must exist');
    assert.ok(pillars.dynamic_natural_conversational, 'Pillar 3 must exist');
    assert.ok(pillars.editorial_maturity, 'Pillar 4 must exist');
    assert.ok(pillars.reader_value, 'Pillar 5 must exist');

    assert.ok(pillars.editorial_intelligence.authors_lens.examples.length >= 5);
    assert.ok(pillars.editorial_intelligence.editorial_stance.allowed_forms.length >= 2);
    assert.ok(pillars.editorial_intelligence.authorial_presence.first_person_usage.includes('saya'));
    assert.ok(pillars.reader_value.memorable_editorial_takeaway.examples.some(e => e.includes('Jari ke media tanam')));
  });

  test('1.3 Conceptual distinctions matrix articulates topic vs lens vs stance vs insight', () => {
    const distinctions = CANONICAL_SIGNATURE_EDITORIAL_VOICE.conceptual_distinctions;
    assert.ok(distinctions.topic);
    assert.ok(distinctions.search_intent);
    assert.ok(distinctions.focus_keyword);
    assert.ok(distinctions.article_angle);
    assert.ok(distinctions.authors_lens);
    assert.ok(distinctions.editorial_stance);
    assert.ok(distinctions.original_editorial_insight);
    assert.ok(distinctions.reader_takeaway);
    assert.strictEqual(
      distinctions.case_study_rose_article.original_editorial_insight,
      'Ubah jadwal menyiram menjadi jadwal memeriksa'
    );
  });

  // --------------------------------------------------------------------------
  // 2. Role-Specific Views Propagation
  // --------------------------------------------------------------------------
  console.log('\n--- 2. Role-Specific Views Propagation ---');
  const {
    getJokoAuthoringKnowledge,
    getNadiaVoiceKnowledge,
    getIrwanEvidenceKnowledge,
    getRinaQAKnowledge,
    getSeonSearchKnowledge,
    getMayaContentStrategyKnowledge,
    getJefryAdvisoryKnowledge
  } = await import('../src/lib/article/editorial-knowledge.ts');

  test('2.1 Joko authoring view inherits signature voice and DEC-09 boundary', () => {
    const jokoView = getJokoAuthoringKnowledge();
    assert.ok(jokoView.signature_editorial_voice);
    assert.strictEqual(jokoView.signature_editorial_voice.philosophy, 'Berisi seperti ahli, ngobrol seperti teman, berpikir seperti penulis.');
    assert.strictEqual(jokoView.role_boundaries_dec09.fail_stop_policy, 'IF_JOKO_CANNOT_EXECUTE_STOP_AND_REPORT');
  });

  test('2.2 Nadia voice view inherits signature voice and anti-overpolishing mandate', () => {
    const nadiaView = getNadiaVoiceKnowledge();
    assert.ok(nadiaView.signature_editorial_voice);
    assert.ok(nadiaView.reader_satisfaction);
  });

  test('2.3 Irwan, Rina, SEON, Maya, and Jefry views propagate signature voice', () => {
    assert.ok(getIrwanEvidenceKnowledge().signature_editorial_voice);
    assert.ok(getRinaQAKnowledge().signature_editorial_voice);
    assert.ok(getSeonSearchKnowledge().signature_editorial_voice);
    assert.ok(getMayaContentStrategyKnowledge().signature_editorial_voice);
    assert.ok(getJefryAdvisoryKnowledge().signature_editorial_voice);
  });

  // --------------------------------------------------------------------------
  // 3. Standards Docs & Primary Brains in Shared Memory
  // --------------------------------------------------------------------------
  console.log('\n--- 3. Standards Docs & Primary Brains in Shared Memory ---');
  const { getStaffPrimaryBrain } = await import('../src/lib/editorial/olci-manager.ts');

  test('3.1 Signature Editorial Voice Guide exists in shared memory', () => {
    const guidePath = path.resolve(PROJECT_ROOT, 'docs/shared-memory/01-editorial-standards/signature-editorial-voice-guide.md');
    assert.ok(fs.existsSync(guidePath), 'signature-editorial-voice-guide.md must exist');
    const content = fs.readFileSync(guidePath, 'utf8');
    assert.ok(content.includes('Berisi seperti ahli, ngobrol seperti teman, berpikir seperti penulis.'));
  });

  test('3.2 Rose Article Learning Case exists in shared memory', () => {
    const casePath = path.resolve(PROJECT_ROOT, 'docs/shared-memory/01-editorial-standards/editorial-learning-case-rose-article.md');
    assert.ok(fs.existsSync(casePath), 'editorial-learning-case-rose-article.md must exist');
    const content = fs.readFileSync(casePath, 'utf8');
    assert.ok(content.includes('Kenapa Bunga Mawar Layu Padahal Rajin Disiram?'));
    assert.ok(content.includes('Ubah jadwal menyiram menjadi jadwal memeriksa.'));
    assert.ok(content.includes('Jari ke media tanam, mata ke daun, baru tangan ke penyiram'));
  });

  test('3.3 getStaffPrimaryBrain loads Joko, Nadia, and Irwan Primary Brains', () => {
    const jokoPb = getStaffPrimaryBrain('content_writer_primary');
    assert.ok(jokoPb, 'Joko Primary Brain must load');
    assert.strictEqual(jokoPb.staff_id, 'content_writer_primary');
    assert.ok(jokoPb.content.includes('PRIMARY BRAIN JOKO'));

    const nadiaPb = getStaffPrimaryBrain('audience_editor_lead');
    assert.ok(nadiaPb, 'Nadia Primary Brain must load');
    assert.strictEqual(nadiaPb.staff_id, 'audience_editor_lead');
    assert.ok(nadiaPb.content.includes('PRIMARY BRAIN NADIA'));

    const irwanPb = getStaffPrimaryBrain('lead_technical_researcher');
    assert.ok(irwanPb, 'Irwan Primary Brain must load');
    assert.strictEqual(irwanPb.staff_id, 'lead_technical_researcher');
    assert.ok(irwanPb.content.includes('PRIMARY BRAIN IRWAN'));
  });

  // --------------------------------------------------------------------------
  // 4. Second Brain Learning Retrieval
  // --------------------------------------------------------------------------
  console.log('\n--- 4. Second Brain Learning Retrieval ---');
  const { getStaffExperiences } = await import('../src/lib/editorial/olci-manager.ts');

  test('4.1 getStaffExperiences retrieves Rose Case learning for Joko with onlyValidated and correct provenance', () => {
    const experiences = getStaffExperiences('content_writer_primary', { onlyValidated: true });
    assert.ok(experiences.length > 0, 'Should find validated experiences for Joko');
    const roseCase = experiences.find(e => e.experience_id === 'EXP-JOKO-20261127-EDITORIAL-INTELLIGENCE-ROSE-CASE');
    assert.ok(roseCase, 'Must retrieve EXP-JOKO-20261127-EDITORIAL-INTELLIGENCE-ROSE-CASE');
    assert.strictEqual(roseCase.validation, 'verified');
    assert.strictEqual(roseCase.kind, 'knowledge');
    assert.strictEqual(roseCase.source_origin, 'owner_external_benchmark');
    assert.ok(roseCase.lesson.includes('BERISI SEPERTI AHLI, NGOBROL SEPERTI TEMAN, BERPIKIR SEPERTI PENULIS'));
  });

  test('4.2 getStaffExperiences retrieves Voice Preservation learning for Nadia with onlyValidated and correct provenance', () => {
    const experiences = getStaffExperiences('audience_editor_lead', { onlyValidated: true });
    assert.ok(experiences.length > 0, 'Should find validated experiences for Nadia');
    const nadiaCase = experiences.find(e => e.experience_id === 'EXP-NADIA-20261127-EDITORIAL-INTELLIGENCE-PRESERVATION-ROSE-CASE');
    assert.ok(nadiaCase, 'Must retrieve EXP-NADIA-20261127-EDITORIAL-INTELLIGENCE-PRESERVATION-ROSE-CASE');
    assert.strictEqual(nadiaCase.validation, 'verified');
    assert.strictEqual(nadiaCase.kind, 'knowledge');
    assert.strictEqual(nadiaCase.source_origin, 'owner_external_benchmark');
    assert.ok(nadiaCase.lesson.includes('TUGAS EDITOR ADALAH MENYEMPURNAKAN CAHAYA PENULIS'));
  });

  // --------------------------------------------------------------------------
  // 5. Prompt Builder Integration
  // --------------------------------------------------------------------------
  console.log('\n--- 5. Prompt Builder Integration ---');
  const { buildJokoSystemPrompt, buildJokoUserPrompt, buildJokoPrompt } = await import('../src/lib/editorial/joko-prompt-builder.ts');
  const { buildSecondBrainSemanticEvaluationPrompt, buildNadiaEditingPrompt } = await import('../src/lib/editorial/nadia-reader-voice.ts');

  test('5.1 buildJokoSystemPrompt incorporates L5 Signature Voice philosophy and authorial presence with "saya"', () => {
    const sysPrompt = buildJokoSystemPrompt({ editorialVoiceLevel: 'L5' });
    assert.ok(sysPrompt.includes('Berisi seperti ahli, ngobrol seperti teman, berpikir seperti penulis.'));
    assert.ok(sysPrompt.includes('Authorial Presence & Penggunaan "Saya"'));
    assert.ok(sysPrompt.includes('Saya kurang menyarankan membongkar pot'));
    assert.ok(sysPrompt.includes('DILARANG menetapkan kuota mekanis'));
  });

  test('5.2 buildJokoUserPrompt formats Editorial Intelligence focus block when parameters are provided', () => {
    const userPrompt = buildJokoUserPrompt({
      topic: 'Bunga Mawar Layu',
      requestedTitle: 'Kenapa Bunga Mawar Layu Padahal Rajin Disiram?',
      focusKeyword: 'bunga mawar layu padahal rajin disiram',
      authorsLens: 'Pemeriksa diagnostik bertahap yang tenang',
      articleAngle: 'Hubungan kondisi media tanam, drainase, dan kebiasaan menyiram',
      originalInsight: 'Ubah jadwal menyiram menjadi jadwal memeriksa',
      evidencePack: {
        technical_claims: [
          { claim_id: 'CLM-001', statement: 'Media jenuh air mengurangi oksigen pada akar tanaman.' }
        ]
      }
    });

    assert.ok(userPrompt.includes('# FOKUS KECERDASAN EDITORIAL (EDITORIAL INTELLIGENCE FOCUS)'));
    assert.ok(userPrompt.includes("Lensa Penulis yang Disarankan (Advisory Author's Lens): Pemeriksa diagnostik bertahap yang tenang"));
    assert.ok(userPrompt.includes('Wawasan Redaksi Orisinal yang Disarankan (Optional Insight): Ubah jadwal menyiram menjadi jadwal memeriksa'));
    assert.ok(userPrompt.includes('# REFLEKSI & PEMBELAJARAN TERAKHIR (SECOND BRAIN RETRIEVAL)'));
  });

  test('5.3 buildSecondBrainSemanticEvaluationPrompt and buildNadiaEditingPrompt protect Joko\'s authorial presence and stance', () => {
    const evalPrompt = buildSecondBrainSemanticEvaluationPrompt({
      manuscript: '# Judul\n\nIsi naskah...',
      focusKeyword: 'bunga mawar'
    });
    assert.ok(evalPrompt.systemPrompt.includes('SIGNATURE EDITORIAL VOICE & AUTHORIAL PRESENCE PRESERVATION'));
    assert.ok(evalPrompt.systemPrompt.includes('DO NOT flag or penalize "saya" when used for editorial judgment'));

    const editPrompt = buildNadiaEditingPrompt('# Judul\n\nIsi naskah...', 'Bunga Mawar Layu');
    assert.ok(editPrompt.systemPrompt.includes('PERLINDUNGAN SUARA PERSONAL JOKO & EDITORIAL STANCE'));
    assert.ok(editPrompt.systemPrompt.includes('DILARANG menetralkan atau menghapus kata "saya"'));
  });

  // --------------------------------------------------------------------------
  // 6. Quality Gate A & Authentic Contextual Evidence
  // --------------------------------------------------------------------------
  console.log('\n--- 6. Quality Gate A & Authentic Contextual Evidence ---');
  const { evaluateArticleDoD } = await import('../src/lib/editorial/article-definition-of-done.ts');

  test('6.1 Valid article with professional "saya" passes Gate A check A.13', () => {
    const sampleArticleMd = `# Kenapa Bunga Mawar Layu Padahal Rajin Disiram?

Letakkan dulu penyiramnya kalau kamu mendapati bunga mawar layu padahal rajin disiram. Saya justru lebih menyarankan untuk memeriksa kondisi media tanam sebelum memberikan tambahan air. Daun yang terkulai memang terlihat seperti tanda kehausan, tetapi penyebabnya belum tentu kekurangan air.

Coba masukkan jari sekitar 2–3 sentimeter ke dalam media tanam. Kalau masih terasa basah, jangan buru-buru menyiram. Terlebih jika kamu baru saja menyiramnya tadi pagi.

## Akar juga perlu bernapas

Kita sering mengingat bahwa tanaman membutuhkan air, tetapi mudah melupakan bahwa akarnya juga membutuhkan oksigen. Di antara butiran media tanam terdapat rongga kecil yang memungkinkan udara masuk. Ketika media terlalu lama jenuh air, oksigen yang tersedia bagi akar berkurang.

Jika kondisi ini berlanjut hingga akar mengalami kerusakan, kemampuan tanaman menyerap air pun ikut terganggu. Akibatnya, mawar bisa terlihat kehausan meskipun media tanamnya masih basah. Royal Horticultural Society (RHS) menjelaskan bahwa genangan berkepanjangan dan drainase pot yang buruk dapat memicu pembusukan akar.

## Jangan hanya melihat jadwal, perhatikan kondisi media

Menyiram mawar sebaiknya tidak sekadar mengikuti jam di dinding. Media tanam yang padat atau pot tanpa lubang pembuangan yang memadai bisa membuat bagian bawah pot tetap basah lebih lama. Kalau kondisi ini terjadi berulang kali, akar yang terus terendam air berisiko membusuk. Pada tahap awal, tanaman mungkin hanya terlihat lemas pada siang hari.

Namun lama-kelamaan, daun bawah mulai menguning, batang terasa kurang kokoh, dan pertumbuhan pucuk baru melambat. Jika mawar ditanam di dalam pot, pastikan air leluasa keluar dari bagian bawahnya setiap kali disiram. Jangan biarkan pot terendam air pada tatakan penampung berhari-hari.

## Apa yang sebaiknya dilakukan sekarang?

Kalau media tanam ternyata masih basah, langkah terbaik pertama justru tidak menyiramnya lagi untuk sementara. Pindahkan mawar ke tempat yang mendapat sirkulasi udara baik dan sinar matahari yang cukup. Saya kurang menyarankan membongkar pot hanya karena menemukan satu atau dua helai daun yang layu.

Berikan jeda satu hingga dua hari sambil memantau apakah ada perbaikan pada daun-daun muda setelah media tanam mulai mengering. Jika dalam beberapa hari kondisinya tidak membaik dan media tetap basah serta mengeluarkan bau kurang sedap, kamu baru perlu memeriksa akarnya secara hati-hati.

## Ubah jadwal menyiram menjadi jadwal memeriksa

Mawar yang rajin disiram tetap membutuhkan jeda agar media tanamnya bisa bernapas secara optimal. Alih-alih menyiram setiap pagi secara otomatis, biasakan memeriksa kelembapan tanahnya terlebih dahulu sebelum mengambil tindakan.

Jari ke media tanam, mata ke daun, baru tangan ke penyiram, itu pun kalau memang perlu. Dengan begitu, kamu tidak lagi mendapati bunga mawar layu padahal rajin disiram hanya karena terlalu bersemangat merawatnya.`;

    const res = evaluateArticleDoD({
      id: 99999,
      slug: 'kenapa-bunga-mawar-layu-padahal-rajin-disiram',
      title: 'Kenapa Bunga Mawar Layu Padahal Rajin Disiram?',
      description: 'Panduan lengkap cara memeriksa dan mengatasi bunga mawar layu padahal rajin disiram secara bertahap dan tepat.',
      content_md: sampleArticleMd,
      focus_keyword: 'bunga mawar layu padahal rajin disiram',
      key_takeaways: [
        'Periksa kelembapan media tanam sedalam 2-3 cm sebelum menyiram.',
        'Akar butuh oksigen; media yang jenuh air memicu pembusukan akar.',
        'Ubah jadwal menyiram menjadi jadwal memeriksa.'
      ]
    });

    const checkA13 = res.gateA.checks.find(c => c.id === 'A.13_AUTHENTIC_CONTEXTUAL_EVIDENCE');
    assert.ok(checkA13, 'Check A.13 must be present');
    assert.strictEqual(checkA13.status, 'PASS', 'Article with legitimate "saya menyarankan" must PASS check A.13');
  });

  test('6.2 Fabricated firsthand claim triggers BLOCKED in Gate A check A.13', () => {
    const fakeClaimArticleMd = `# Kenapa Atap Bocor Saat Hujan Lebat?

Berdasarkan pengalaman kami di lapangan selama sepuluh tahun, kami menguji secara langsung berbagai genteng. Klien kami di Jakarta sering mengeluh genteng rembes.

## Pemeriksaan Fisik

Air hujan yang deras menembus sela genteng.

## Solusi Lapangan

Gunakan pelapis kedap air.

## Tindakan Pencegahan

Periksa kemiringan atap secara berkala agar atap tidak bocor saat hujan lebat.`;

    const res = evaluateArticleDoD({
      id: 99998,
      slug: 'kenapa-atap-bocor-saat-hujan-lebat',
      title: 'Kenapa Atap Bocor Saat Hujan Lebat?',
      description: 'Panduan mengatasi masalah kebocoran atap rumah saat musim hujan lebat.',
      content_md: fakeClaimArticleMd,
      focus_keyword: 'kenapa atap bocor saat hujan lebat',
      key_takeaways: ['Takeaway 1', 'Takeaway 2', 'Takeaway 3']
    });

    const checkA13 = res.gateA.checks.find(c => c.id === 'A.13_AUTHENTIC_CONTEXTUAL_EVIDENCE');
    assert.ok(checkA13, 'Check A.13 must be present');
    assert.strictEqual(checkA13.status, 'BLOCKED', 'Article with fabricated field claims must be BLOCKED');
    assert.ok(checkA13.message.includes('Terdeteksi klaim pengalaman lapangan'));
  });

  test('6.3 Attributed quotation of contractor claim routes to WARNING (does not hard block Gate A)', () => {
    const quotedClaimArticleMd = `# Memilih Atap Rumah: Apakah Genteng Metal Selalu Bocor Saat Hujan?

Saat renovasi, seorang tukang sering sesumbar: "Berdasarkan pengalaman kami di lapangan selama sepuluh tahun, atap metal selalu bocor." Namun sains bangunan menunjukkan hal yang berbeda.

## Pemeriksaan Fisik

Air hujan yang deras menembus sela genteng bila kemiringan atap kurang dari 15 derajat.

## Solusi Lapangan

Periksa sambungan reng dan lembaran penutup secara berkala.

## Tindakan Pencegahan

Pastikan ventilasi loteng memadai agar suhu ruang tetap nyaman. Memilih atap rumah yang tepat membutuhkan ketelitian.`;

    const res = evaluateArticleDoD({
      id: 99997,
      slug: 'memilih-atap-rumah-apakah-genteng-metal-selalu-bocor-saat-hujan',
      title: 'Memilih Atap Rumah: Apakah Genteng Metal Selalu Bocor Saat Hujan?',
      description: 'Panduan objektif memilih atap rumah berdasarkan sains bangunan bukan sekadar asumsi.',
      content_md: quotedClaimArticleMd,
      focus_keyword: 'memilih atap rumah',
      key_takeaways: ['Takeaway 1', 'Takeaway 2', 'Takeaway 3']
    });

    const checkA13 = res.gateA.checks.find(c => c.id === 'A.13_AUTHENTIC_CONTEXTUAL_EVIDENCE');
    assert.ok(checkA13, 'Check A.13 must be present');
    assert.strictEqual(checkA13.status, 'WARNING', 'Attributed contractor quotation routes to WARNING for evidence review');
  });

  test('6.4 Documented firsthand experience in evidence pack passes Gate A check A.13 as PASS', () => {
    const documentedArticleMd = `# Hasil Pengamatan Atap Rumah Uji

Saat tim kami memeriksa lokasi uji coba di Tangerang, kami menguji secara langsung berbagai kemiringan genteng.

## Hasil Pengamatan

Suhu loteng berkurang 4 derajat dengan ventilasi sopi-sopi.`;

    const res = evaluateArticleDoD({
      id: 99996,
      slug: 'hasil-pengamatan-atap-rumah-uji',
      title: 'Hasil Pengamatan Atap Rumah Uji',
      content_md: documentedArticleMd,
      focus_keyword: 'hasil pengamatan atap',
      key_takeaways: ['Takeaway 1', 'Takeaway 2', 'Takeaway 3'],
      evidence_review: {
        verified_firsthand_claims: [documentedArticleMd]
      }
    });

    const checkA13 = res.gateA.checks.find(c => c.id === 'A.13_AUTHENTIC_CONTEXTUAL_EVIDENCE');
    assert.ok(checkA13, 'Check A.13 must be present');
    assert.strictEqual(checkA13.status, 'PASS', 'Documented experience confirmed in evidence review must PASS check A.13');
  });

  test('6.5 Clearly identified hypothetical example passes Gate A check A.13 as PASS', () => {
    const hypotheticalArticleMd = `# Merancang Kamar Tidur yang Sejuk

Bayangkan jika kamu menempati kamar tidur di lantai atas pada siang hari. Saat udara terasa memanggang, jangan buru-buru menyalakan AC berdaya besar.

## Solusi Alami

Pastikan ada ventilasi silang yang mengalirkan udara panas keluar.`;

    const res = evaluateArticleDoD({
      id: 99995,
      slug: 'merancang-kamar-tidur-yang-sejuk',
      title: 'Merancang Kamar Tidur yang Sejuk',
      content_md: hypotheticalArticleMd,
      focus_keyword: 'kamar tidur yang sejuk',
      key_takeaways: ['Takeaway 1', 'Takeaway 2', 'Takeaway 3']
    });

    const checkA13 = res.gateA.checks.find(c => c.id === 'A.13_AUTHENTIC_CONTEXTUAL_EVIDENCE');
    assert.ok(checkA13, 'Check A.13 must be present');
    assert.strictEqual(checkA13.status, 'PASS', 'Hypothetical reader scenario must PASS check A.13');
  });

  test('6.6 Unverified suspicious experience claim without evidence routes to WARNING', () => {
    const suspiciousArticleMd = `# Penanganan Atap Bocor

Menurut praktisi kami di lapangan, kebocoran sering terjadi di sambungan talang air.

## Solusi

Gunakan pelapis elastis pada talang air.`;

    const res = evaluateArticleDoD({
      id: 99994,
      slug: 'penanganan-atap-bocor',
      title: 'Penanganan Atap Bocor',
      content_md: suspiciousArticleMd,
      focus_keyword: 'penanganan atap bocor',
      key_takeaways: ['Takeaway 1', 'Takeaway 2', 'Takeaway 3']
    });

    const checkA13 = res.gateA.checks.find(c => c.id === 'A.13_AUTHENTIC_CONTEXTUAL_EVIDENCE');
    assert.ok(checkA13, 'Check A.13 must be present');
    assert.strictEqual(checkA13.status, 'WARNING', 'Unverified field practitioner claim routes to WARNING');
  });

  test('6.7 Confirmed integrity violation (blatant fake lab test) is strictly BLOCKED', () => {
    const fakeLabArticleMd = `# Uji Lab Insulasi Atap?

Uji coba lab internal kami membuktikan bahwa foil merk X menurunkan suhu 15 derajat.

## Data

Hasil lab independen kami mengonfirmasi daya pantul 99 persen.`;

    const res = evaluateArticleDoD({
      id: 99993,
      slug: 'uji-lab-insulasi-atap',
      title: 'Uji Lab Insulasi Atap?',
      content_md: fakeLabArticleMd,
      focus_keyword: 'uji lab insulasi atap',
      key_takeaways: ['Takeaway 1', 'Takeaway 2', 'Takeaway 3']
    });

    const checkA13 = res.gateA.checks.find(c => c.id === 'A.13_AUTHENTIC_CONTEXTUAL_EVIDENCE');
    assert.ok(checkA13, 'Check A.13 must be present');
    assert.strictEqual(checkA13.status, 'BLOCKED', 'Fabricated internal lab claim must be strictly BLOCKED');
  });

  test('6.8 Quotation marks CANNOT be used as an integrity bypass for confirmed fabrication', () => {
    const quotedFakeLabMd = `# Apakah Foil Ini Teruji di Lab?

Seorang narasumber berujar: "Uji coba lab internal kami membuktikan bahwa material ini tahan 100 tahun."

Saya menyarankan untuk memeriksa sertifikat SNI resmi.`;

    const res = evaluateArticleDoD({
      id: 99994,
      slug: 'foil-teruji-lab',
      title: 'Apakah Foil Ini Teruji di Lab?',
      content_md: quotedFakeLabMd,
      focus_keyword: 'foil teruji lab',
      key_takeaways: ['Takeaway 1', 'Takeaway 2', 'Takeaway 3']
    });

    const checkA13 = res.gateA.checks.find(c => c.id === 'A.13_AUTHENTIC_CONTEXTUAL_EVIDENCE');
    assert.ok(checkA13, 'Check A.13 must be present');
    assert.strictEqual(checkA13.status, 'BLOCKED', 'Quotation marks around fake lab claim must NOT bypass BLOCKED status');
  });

  test('6.9 Check A.13 WARNING cannot silently bypass publication without researcher approval', () => {
    const suspiciousArticleMd = `# Memilih Seng atau Spandek: Mana yang Lebih Awet?

Menurut praktisi kami di lapangan, spandek lebih tahan karat bila dipasang dengan kemiringan yang tepat. Saya menyarankan untuk tetap memeriksa ketebalan seng.

## Memeriksa Karakteristik Seng

Lembaran seng standar memiliki ketebalan berbeda yang mempengaruhi ketahanan korosi.

## Rekomendasi Sudut Kemiringan

Sudut kemiringan minimal 15 derajat membantu mencegah tampias air hujan.`;

    // Case 1: Unresolved evidence review -> isPublicationReady must be FALSE
    const unapprovedRes = evaluateArticleDoD({
      id: 99995,
      slug: 'memilih-seng-atau-spandek',
      title: 'Memilih Seng atau Spandek: Mana yang Lebih Awet?',
      content_md: suspiciousArticleMd,
      focus_keyword: 'memilih seng atau spandek',
      key_takeaways: ['Takeaway 1', 'Takeaway 2', 'Takeaway 3'],
      approved_photos: { cover_approved: true, inline_approved_count: 3 },
      featured_image: '/media/cover.jpg',
      manual_hold: 0,
      has_editorial_approval: true,
      faqs: [
        { question: 'Apakah spandek tahan karat?', answer: 'Ya, dengan lapisan seng yang cukup.' },
        { question: 'Berapa kemiringan minimal?', answer: 'Minimal 15 derajat.' },
        { question: 'Bagaimana perawatannya?', answer: 'Bersihkan kotoran secara berkala.' }
      ],
      evidence_review: {
        status: 'PENDING_REVIEW',
        unverified_experience_claims: ['Menurut praktisi kami di lapangan, spandek lebih tahan karat']
      }
    });

    assert.strictEqual(unapprovedRes.gateA.checks.find(c => c.id === 'A.13_AUTHENTIC_CONTEXTUAL_EVIDENCE')?.status, 'WARNING');
    assert.strictEqual(unapprovedRes.summary.isPublicationReady, false, 'WARNING on A.13 must block publication when evidence review is pending');
    assert.ok(unapprovedRes.ownerAuthorization.blockingReasons.some(r => r.includes('UNRESOLVED_EXPERIENCE_CLAIMS')));

    // Case 2: Explicitly approved by researcher -> isPublicationReady can be TRUE
    const approvedRes = evaluateArticleDoD({
      id: 99995,
      slug: 'memilih-seng-atau-spandek',
      title: 'Memilih Seng atau Spandek: Mana yang Lebih Awet?',
      content_md: suspiciousArticleMd,
      focus_keyword: 'memilih seng atau spandek',
      key_takeaways: ['Takeaway 1', 'Takeaway 2', 'Takeaway 3'],
      approved_photos: { cover_approved: true, inline_approved_count: 3 },
      featured_image: '/media/cover.jpg',
      manual_hold: 0,
      has_editorial_approval: true,
      faqs: [
        { question: 'Apakah spandek tahan karat?', answer: 'Ya, dengan lapisan seng yang cukup.' },
        { question: 'Berapa kemiringan minimal?', answer: 'Minimal 15 derajat.' },
        { question: 'Bagaimana perawatannya?', answer: 'Bersihkan kotoran secara berkala.' }
      ],
      evidence_review: {
        status: 'APPROVED_BY_RESEARCHER',
        verified_firsthand_claims: ['Menurut praktisi kami di lapangan, spandek lebih tahan karat bila dipasang dengan kemiringan yang tepat.']
      }
    });

    assert.ok(!approvedRes.ownerAuthorization.blockingReasons.some(r => r.includes('UNRESOLVED_EXPERIENCE_CLAIMS')), 'UNRESOLVED_EXPERIENCE_CLAIMS is cleared once researcher resolves review');
    assert.strictEqual(approvedRes.gateA.checks.find(c => c.id === 'A.13_AUTHENTIC_CONTEXTUAL_EVIDENCE')?.status, 'PASS', 'Check A.13 turns to PASS once firsthand claim is verified in evidence_review');
  });

  // --------------------------------------------------------------------------
  // 7. Policy Version, Telemetry, Discretion & Inheritance
  // --------------------------------------------------------------------------
  console.log('\n--- 7. Policy Version, Telemetry, Discretion & Inheritance ---');
  const { evaluateHumanWritingQuality } = await import('../src/lib/article/human-quality.ts');
  const { CANONICAL_EDITORIAL_KNOWLEDGE_V2 } = await import('../src/lib/article/editorial-knowledge.ts');

  test('7.1 Dynamic Effective Version Telemetry distinguishes V2, V1, and Fallback contexts', () => {
    // Context 1: Explicit loaded V2 policy context -> V2
    const v2Res = evaluateHumanWritingQuality('Contoh naskah artikel...', {
      knowledgeVersion: 'RANCANGLOKA_EDITORIAL_KNOWLEDGE_V2'
    });
    assert.strictEqual(v2Res.knowledge_version, 'RANCANGLOKA_EDITORIAL_KNOWLEDGE_V1');
    assert.strictEqual(v2Res.effective_knowledge_version, 'RANCANGLOKA_EDITORIAL_KNOWLEDGE_V2');

    // Context 2: Legacy compatibility context (explicit V1 policy) -> V1
    const v1Res = evaluateHumanWritingQuality('Contoh naskah artikel...', {
      knowledgeVersion: 'RANCANGLOKA_EDITORIAL_KNOWLEDGE_V1'
    });
    assert.strictEqual(v1Res.knowledge_version, 'RANCANGLOKA_EDITORIAL_KNOWLEDGE_V1');
    assert.strictEqual(v1Res.effective_knowledge_version, 'RANCANGLOKA_EDITORIAL_KNOWLEDGE_V1');

    // Context 3: Missing / unverified context -> strictly UNVERIFIED (never falsely claims proven V1)
    const unverifiedRes = evaluateHumanWritingQuality('Contoh naskah artikel...', {});
    assert.strictEqual(unverifiedRes.effective_knowledge_version, 'UNVERIFIED');

    // Context 4: Voice level alone (L5) without loaded policy context does NOT infer policy V2 -> UNVERIFIED
    const voiceOnlyRes = evaluateHumanWritingQuality('Contoh naskah artikel...', { editorialVoiceLevel: 'L5' });
    assert.strictEqual(voiceOnlyRes.effective_knowledge_version, 'UNVERIFIED');
  });

  test('7.2 Controlled change to canonical capability propagates to compiled prompt (C04 regression)', () => {
    // Verify that prompt construction dynamically reads from CANONICAL_SIGNATURE_EDITORIAL_VOICE capability pillars
    const sysPrompt = buildJokoSystemPrompt({ editorialVoiceLevel: 'L5' });
    const pillars = CANONICAL_SIGNATURE_EDITORIAL_VOICE.five_capability_pillars;
    
    // Check that guidance from all 5 pillars is dynamically present
    assert.ok(sysPrompt.includes(pillars.dynamic_natural_conversational.sapaan));
    assert.ok(sysPrompt.includes(pillars.dynamic_natural_conversational.negation));
    assert.ok(sysPrompt.includes(pillars.knowledge_and_evidence.principles[0]));
    assert.ok(sysPrompt.includes(pillars.knowledge_and_evidence.principles[1]));
    assert.ok(sysPrompt.includes(pillars.editorial_intelligence.authorial_presence.guideline));
    assert.ok(sysPrompt.includes(pillars.editorial_maturity.epistemic_honesty.guideline));
    assert.ok(sysPrompt.includes(pillars.reader_value.memorable_editorial_takeaway.examples[0]));
  });

  test('7.3 Joko Editorial Discretion: lens is advisory, insight is optional, no mandatory persona lock (C06)', () => {
    // 1. Proposed lens is explicitly labeled Advisory
    const userPromptAdvisory = buildJokoUserPrompt({
      topic: 'Memilih Lantai Granit vs Keramik',
      authorsLens: 'Comparative Analyst (membedah komparasi berimbang)',
      evidencePack: { technical_claims: [] }
    });
    assert.ok(userPromptAdvisory.includes("Lensa Penulis yang Disarankan (Advisory Author's Lens): Comparative Analyst"));
    assert.ok(userPromptAdvisory.includes('kebebasan redaksional penuh'));

    // 2. Missing optional insight does not break prompt or force an insight
    const userPromptNoInsight = buildJokoUserPrompt({
      topic: 'Merawat Cat Dinding Luar',
      evidencePack: { technical_claims: [] }
    });
    assert.ok(!userPromptNoInsight.includes('Wawasan Redaksi Orisinal yang Disarankan'));
  });

  test('7.4 Second Brain Retrieval Integrity: kind validation, source_origin survival, and non-attribution (C07)', () => {
    const jokoExps = getStaffExperiences('content_writer_primary', { onlyValidated: true });
    const roseRecord = jokoExps.find(e => e.experience_id === 'EXP-JOKO-20261127-EDITORIAL-INTELLIGENCE-ROSE-CASE');
    assert.ok(roseRecord, 'Rose record must be retrievable');
    assert.strictEqual(roseRecord.kind, 'knowledge');
    assert.strictEqual(roseRecord.source_origin, 'owner_external_benchmark');
    // Verify that staff recipient is NOT represented as firsthand author of the external trial
    assert.ok(roseRecord.observation.includes('disusun secara eksternal oleh Owner bersama model eksternal'));
  });

  // --------------------------------------------------------------------------
  // 8. Targeted L5 Production-Intended Integration Test (C01)
  // --------------------------------------------------------------------------
  console.log('\n--- 8. Targeted L5 Production-Intended Integration Test (C01) ---');
  const { executeEditorialDraftJob } = await import('../src/lib/editorial/editorial-runtime.ts');
  const { EditorialLlmProvider } = await import('../src/lib/editorial/editorial-llm-provider.ts');

  test('8.1 Full L5 production-intended runtime execution with claim grounding and zero paid calls', async () => {
    const evPackPath = path.resolve(PROJECT_ROOT, 'scripts/dryrun/evidence-pack.json');
    assert.ok(fs.existsSync(evPackPath), 'scripts/dryrun/evidence-pack.json must exist');
    const evPack = JSON.parse(fs.readFileSync(evPackPath, 'utf8'));

    const l5ArticleMarkdown = `# Atap Metal Terasa Panas: Apakah Insulasi Foil Cukup atau Perlu Ventilasi Atap?

Satu tukang menyarankan pasang aluminium foil. Tukang lain justru bilang rongga atapnya perlu diberi ventilasi. Keduanya terdengar masuk akal—dan di situlah keputusan renovasi mulai membingungkan.

Saya justru lebih menyarankan untuk melihat keduanya bukan sebagai opsi yang saling bersaing, melainkan dua lapis pertahanan yang memiliki tugas berbeda. Jika sumber panas utama belum dikenali dengan tepat, biaya renovasi bisa keluar sia-sia sementara ruangan di bawahnya tetap gerah.

## Memahami Tiga Jalur Panas pada Atap Metal

Untuk mengambil keputusan yang tepat, pemilik rumah perlu membedakan bagaimana panas matahari merambat masuk:

1. **Radiasi Gelombang Panjang**: Sinar matahari memanaskan lembaran seng metal hingga mencapai temperatur tinggi. Seng kemudian memancarkan radiasi panas ke ruangan di bawahnya. Sekitar 75 persen beban panas atap berpindah melalui mekanisme radiasi ini.
2. **Konveksi Udara di Loteng**: Udara yang terkurung di rongga antara seng dan plafon ikut memanas dan tertahan bila tidak ada sirkulasi udara luar.
3. **Konduksi Menembus Plafon**: Udara panas dan radiasi memanaskan material plafon, yang perlahan menghantarkan panas ke ruang tidur.

## Apakah Insulasi Foil Saja Cukup?

Aluminium foil adalah pemantul radiasi termal yang sangat efektif karena memiliki emisivitas rendah. Namun, lembaran foil hanya bekerja optimal jika dipasang dengan rongga udara (air gap) minimal 20 sampai 25 mm di bawah bidang atap.

Bila foil dipasang menempel rapat langsung menjepit seng tanpa rongga udara, panas tetap akan berpindah lewat konduksi langsung.

## Kapan Anda Wajib Menambahkan Ventilasi Atap?

Jika loteng Anda tertutup rapat tanpa bukaan udara luar, panas yang terakumulasi akan menciptakan fenomena perangkap panas. Dalam kondisi loteng tertutup seperti ini, ventilasi atap (seperti kisi jalusi sopi-sopi atau ventilasi bubungan) wajib ditambahkan untuk mengalirkan udara panas keluar sesuai kaidah SNI 03-6572-2001.

## Kompromi dan Risiko Lapangan

Setiap solusi memiliki konsekuensi lapangan yang harus diantisipasi:
- **Risiko Tampias Air Hujan**: Bukti lapangan menunjukkan ventilasi atap yang tidak diberi pelindung kisi miring atau kasa serangga dapat memicu tampias saat hujan angin deras.
- **Penyusupan Debu dan Serangga**: Ventilasi terbuka tanpa kawat kasa halus berpotensi mengundang kelelawar, burung, atau debu jalanan masuk ke atas plafon.
- **Kondensasi dan Korosi Reng**: Tanpa sirkulasi udara, uap air dapat terjebak dan memicu karat pada rangka reng baja ringan.

## Panduan Keputusan Berdasarkan Kondisi Rumah

Gunakan matriks keputusan sederhana ini:
- **Kasus 1 (Atap Metal Tanpa Plafon)**: Insulasi foil berlapis bubble atau foam tebal dengan rongga udara adalah prioritas utama untuk menahan radiasi langsung.
- **Kasus 2 (Loteng Tertutup dengan Plafon Gypsum)**: Anda membutuhkan kombinasi foil dan ventilasi kisi pada kedua ujung dinding sopi-sopi agar udara loteng tidak mendidih.
- **Kasus 3 (Kamar Tidur Utama Ber-AC)**: Tambahkan insulasi peredam panas di atas rangka plafon untuk mengurangi kebocoran suhu dingin AC.

## Langkah Pemeriksaan Sebelum Mengeluarkan Biaya

Sebelum menghubungi tukang atau membeli bergelondong-gelondong aluminium foil, luangkan waktu siang hari untuk memeriksa:
1. Periksa ada tidaknya rongga udara di bawah reng atap seng Anda.
2. Ukur suhu loteng di siang terik; jika loteng terasa jauh lebih pengap dari luar rumah, ventilasi adalah keharusan.
3. Periksa potensi tampias air hujan pada dinding pembatas atau talang sebelum melubangi atap untuk turbin ventilator.`;

    const mockFetch = async () => new Response(JSON.stringify({
      id: 'chatcmpl_mock_l5_test',
      model: 'google/gemini-2.0-flash-001',
      choices: [{ message: { content: l5ArticleMarkdown } }],
      usage: { prompt_tokens: 1100, completion_tokens: 720, total_tokens: 1820 }
    }), { status: 200, headers: { 'Content-Type': 'application/json' } });

    const provider = new EditorialLlmProvider({
      apiKey: 'test-local-l5-key',
      fetchFn: mockFetch,
      maxRetries: 0
    });

    const l5JobInput = {
      taskId: 'task_test_l5_production_integration',
      topic: 'Atap Metal Terasa Panas: Apakah Insulasi Foil Cukup atau Perlu Ventilasi Atap?',
      requestedTitle: 'Atap Metal Terasa Panas: Apakah Insulasi Foil Cukup atau Perlu Ventilasi Atap?',
      focusKeyword: 'atap metal terasa panas insulasi foil ventilasi',
      editorialVoiceLevel: 'L5',
      enableVoiceL5: true,
      authorsLens: 'Comparative Analyst (membedah komparasi berimbang)',
      articleAngle: 'Foil memantulkan radiasi tetapi panas loteng tetap butuh ventilasi konveksi',
      originalInsight: 'Insulasi foil dan ventilasi loteng adalah mitra komplementer, bukan pilihan substitutif',
      evidencePack: evPack,
      visitorContext: {
        primaryContextId: 'CTX-05-DECISION-FOIL-VS-VENT',
        primaryContextLabel: 'Dilema Foil vs Ventilasi',
        primaryPainDimension: 'DECISION_UNCERTAINTY',
        secondaryContextIds: ['CTX-09-CONTRACTOR-CONFLICT', 'CTX-10-HEAT-SOURCE-MYSTERY'],
        openingAngle: 'DECISION_FORK',
        preferredSignature: 'DECISION > CONFLICT > DIAGNOSIS'
      },
      operatorAuth: {
        authorizedBy: 'Chief Editor L5 Acceptance',
        timestamp: new Date().toISOString()
      }
    };

    const result = await executeEditorialDraftJob(l5JobInput, { providerInstance: provider });
    if (result.status !== 'COMPLETED') {
      console.log('L5 JOB FAILURE DIAGNOSTIC:', {
        status: result.status,
        finalDecision: result.finalDecision,
        error: result.error,
        errors: result.groundingAudit?.errors,
        warnings: result.groundingAudit?.warnings
      });
    }
    assert.strictEqual(result.status, 'COMPLETED', 'L5 job must complete successfully');
    assert.strictEqual(result.finalDecision, 'HUMAN_WRITING_PASS', 'L5 draft must pass human writing quality gate');
    assert.strictEqual(result.publicationStatus, 'DRAFT', 'L5 draft must remain DRAFT');
    assert.strictEqual(result.humanStopGateStatus, 'HUMAN_REVIEW_REQUIRED', 'L5 draft must require human review');
    assert.ok(result.authorProvenance, 'Author provenance must be attached');
    assert.strictEqual(result.authorProvenance.staff_id, 'content_writer_primary');
  });

  for (const t of testQueue) {
    await t();
  }

  console.log(`\n======================================================`);
  console.log(`ALL TESTS PASSED: ${passed}/${total}`);
  console.log(`======================================================\n`);

  if (passed !== total) {
    process.exit(1);
  }
}

runTests().catch(err => {
  console.error('Test runner fatal error:', err);
  process.exit(1);
});
