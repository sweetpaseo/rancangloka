/**
 * RancangLoka Editorial Expert Consultation & Decision Depth Test Suite
 * Milestone: EDITORIAL-EXPERT-CONSULTATION-1
 *
 * Verifies:
 * 1. Strong explanatory article (PASS, score >= 85).
 * 2. Strong problem-solving article (PASS, score >= 85).
 * 3. Strong comparison article (PASS, score >= 85).
 * 4. Academic technical essay with no homeowner relevance (triggers ACADEMIC_DISTANCE_EXCESSIVE, REVISE).
 * 5. Product review with good decision support (PASS, score >= 85).
 * 6. Correct facts but immediate prescription without diagnosis (triggers DIAGNOSIS_MISSING).
 * 7. Good diagnosis but no next action (triggers NEXT_ACTION_MISSING).
 * 8. Trade-off-free universal recommendation (triggers SCENARIO_FIT_MISSING or TRADE_OFFS_INCOMPLETE).
 * 9. Short narrow article with adequate depth (PASS, score >= 85, no false penalty).
 * 10. Short broad article with scope-depth mismatch (triggers SCOPE_DEPTH_MISMATCH).
 * 11. Formal scientific prose with homeowner connection (PASS, no false penalty).
 * 12. Article 5 regression protection (Score = 100, PASS).
 * 13. Article 6 real-corpus behavior (REVISE, score = 84, triggers ACADEMIC_DISTANCE_EXCESSIVE).
 */

import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import {
  evaluateHumanWritingQuality,
  detectArticleIntent
} from '../src/lib/article/human-quality.ts';

let passed = 0;
async function test(name, fn) {
  await fn();
  console.log('  ✅ PASS: ' + name);
  passed++;
}

async function main() {
  console.log('🧪 Starting EDITORIAL-EXPERT-CONSULTATION-1 Test Suite...\n');

  // Load SQLite DB & Fixtures
  const dbPath = path.resolve('.wrangler/state/v3/d1/miniflare-D1DatabaseObject/37bd9da5950b040e71b09fbfd7ca57290acb451dcd5dc35acb02655fa75fa480.sqlite');
  assert.ok(fs.existsSync(dbPath), 'Local D1 SQLite database must exist');
  const d1 = new DatabaseSync(dbPath);

  const a5Path = path.resolve('scripts/fixtures/article5_canonical.json');
  assert.ok(fs.existsSync(a5Path), 'Article 5 canonical fixture must exist');
  const a5Canonical = JSON.parse(fs.readFileSync(a5Path, 'utf8'));

  // 1. Strong Explanatory Article
  await test('1. Strong explanatory article achieves PASS (score >= 85)', () => {
    const md = `
# Prinsip Kerja Teritisan Atap dalam Menahan Tampias Hujan Tropis

Curah hujan tinggi di iklim tropis Indonesia sering kali menimbulkan masalah rembesan air pada kusen jendela dan dinding luar rumah. Teritisan atap atau overstek adalah perisai fisik pertama bangunan untuk menahan air hujan sebelum menyentuh bidang dinding.

Secara teknis, sudut jatuh air hujan saat angin kencang berkisar antara 30 hingga 45 derajat. Dengan lebar overstek minimal 100 cm hingga 120 cm dari as dinding, bidang bukaan jendela kamar tidur dan ruang keluarga terlindung dari terpaan langsung air tampias.

Konsekuensi praktis bagi pemilik rumah sangat jelas: dinding luar terhindar dari rembesan air dan jamur dinding yang merusak plesteran acian. Namun, overstek lebar membutuhkan rangka baja ringan atau struktur kantilever yang kokoh agar mampu menahan gaya angkat angin saat badai.

Sebelum memasang atap, mintalah tukang atau aplikator memeriksa kemiringan dan kekuatan pengikat reng ke kuda-kuda agar struktur overstek stabil.
`;
    const res = evaluateHumanWritingQuality(md);
    assert.strictEqual(res.decision, 'HUMAN_WRITING_PASS');
    assert.ok(res.total_score >= 85);
    assert.strictEqual(detectArticleIntent(md), 'EXPLANATORY');
  });

  // 2. Strong Problem-Solving Article
  await test('2. Strong problem-solving article achieves PASS with diagnosis and scenario guidance', () => {
    const md = `
# Mengapa Dinding Kamar Tidur Lantai 2 Terasa Memanggang di Malam Hari?

Banyak pemilik rumah mengeluhkan suhu kamar tidur lantai 2 yang tetap terasa panas menyengat meski hari sudah berganti malam dan pendingin udara dinyalakan.

Masalah ini berakar pada fenomena inersia termal material bata pada dinding yang menghadap barat. Sepanjang siang hingga sore hari setelah pukul 14.00, radiasi matahari memanaskan dinding bata merah atau bata ringan. Material dinding menyerap energi panas tersebut dan meradiasikannya perlahan ke dalam ruang tidur saat suhu udara luar mulai turun.

Solusi pertama adalah menambahkan lapisan insulasi sekunder (secondary skin) berupa kisi-kisi atau tanaman rambat berjarak 30 cm dari dinding untuk memutus paparan radiasi langsung. Solusi kedua adalah memaksimalkan ventilasi silang agar udara panas yang naik terbuang keluar sebelum terjebak di bawah plafon.

Untuk langkah awal, periksa orientasi dinding kamar tidur Anda dengan kompas ponsel dan ukur ketebalan plesteran dinding sebelum merencanakan pemasangan kisi peneduh luar.
`;
    const res = evaluateHumanWritingQuality(md);
    assert.strictEqual(res.decision, 'HUMAN_WRITING_PASS');
    assert.ok(res.total_score >= 85);
    assert.strictEqual(detectArticleIntent(md), 'PROBLEM_SOLVING');
  });

  // 3. Strong Comparison Article
  await test('3. Strong comparison article achieves PASS with trade-offs and scenario branching', () => {
    const md = `
# Kusen Kayu Kamper vs Kusen Aluminium untuk Rumah Tinggal Tropis

Memilih material kusen jendela dan pintu menghadapkan pemilik rumah pada dilema antara estetika alami dan ketahanan cuaca tropis lembap.

Kusen kayu kamper samarinda oven memberikan kehangatan visual dan redaman akustik alami yang sangat baik bagi ruang interior. Namun, kayu memiliki kerentanan biologis terhadap kelembapan dan rayap, serta membutuhkan perawatan pernis berkala setiap 2 hingga 3 tahun sekali agar tidak melengkung.

Sebaliknya, profil kusen aluminium arsitektural dengan finishing powder coating sepenuhnya tahan rayap dan tidak lapuk terpapar curah hujan deras. Trade-off yang harus diterima adalah sifat konduktivitas logam yang tinggi sehingga kusen dapat terasa hangat saat terpapar panas matahari sore, serta tampilan visual yang cenderung modern kaku.

Jika ruangan yang Anda bangun adalah ruang tamu formal yang terlindung dari tampias hujan, kayu kamper memberikan nilai estetika tinggi. Namun jika bukaan berada di area luar yang terpapar hujan lebat atau kamar mandi basah, kusen aluminium adalah pilihan yang jauh lebih rasional.

Langkah berikutnya, periksa sertifikasi kadar air kayu oven ke toko material atau mintalah contoh potongan profil aluminium untuk memverifikasi ketebalan dinding minimal 1.2 mm.
`;
    const res = evaluateHumanWritingQuality(md);
    assert.strictEqual(res.decision, 'HUMAN_WRITING_PASS');
    assert.ok(res.total_score >= 85);
    assert.strictEqual(detectArticleIntent(md), 'COMPARISON');
    assert.ok(res.issues.every((i) => i.code !== 'TRADE_OFFS_INCOMPLETE'));
  });

  // 4. Academic Technical Essay (Triggers ACADEMIC_DISTANCE_EXCESSIVE)
  await test('4. Academic technical essay with no homeowner relevance triggers ACADEMIC_DISTANCE_EXCESSIVE', () => {
    const md = `
## Pendekatan Desain Termal Pasif pada Arsitektur Tropis

Konstruksi fasad pada bangunan tropis kontemporer menuntut integrasi yang cermat antara sains kenyamanan termal dan rekayasa amplop bangunan. Di kawasan iklim tropis lembap dengan radiasi matahari tinggi sepanjang tahun, dinding masif konvensional cenderung menyerap energi panas dalam jumlah signifikan pada siang hari dan meradiasikannya kembali ke ruang dalam pada malam hari. Fenomena beban pendinginan pasif ini dapat diminimalisasi secara terukur dengan memanfaatkan sistem selubung adaptif ganda atau secondary skin yang responsif terhadap sudut datang sinar matahari.

Penerapan bilah penangkal surya yang dapat disesuaikan orientasinya memungkinkan pengendalian intensitas pencahayaan alami tanpa memicu pemanasan ruang berlebih. Penataan orientasi kisi-kisi vertikal terbukti efektif mereduksi silau dan panas pada fasad timur dan barat, sementara bidang peneduh horizontal lebih optimal diaplikasikan pada bukaan yang menghadap ke arah utara dan selatan.

## Dinamika Ventilasi Silang dan Reduksi Kelembapan

Selain pembiasan radiasi langsung, efektivitas fasad adaptif terletak pada kemampuannya mengarahkan aliran angin alami ke dalam interior hunian. Ventilasi silang yang direncanakan dengan memperhitungkan tekanan angin mikro menciptakan sirkulasi udara kontinu yang mempercepat proses evaporasi keringat pada kulit penghuni, sehingga menciptakan sensasi sejuk tanpa bergantung penuh pada sistem pengondisian udara buatan.

Ruang antara kulit luar dan dinding utama bangunan juga berfungsi sebagai cerobong termal (*thermal chimney*). Udara panas yang terperangkap di celah fasad akan bergerak naik secara alami karena massa jenisnya yang lebih ringan, kemudian dibuang melalui ventilasi di bagian atas bangunan sambil menarik udara yang lebih sejuk dari permukaan tanah.

## Pemilihan Material dan Keberlanjutan Konstruksi

Durabilitas material eksterior menjadi parameter penentu keberhasilan sistem fasad adaptif di lingkungan tropis yang terpapar kelembapan tinggi dan curah hujan deras. Penggunaan aluminium komposit bermutu tinggi dengan lapisan pelindung tahan ultraviolet atau kayu komposit rekayasa ramah lingkungan mampu menjamin ketahanan struktural jangka panjang dengan kebutuhan pemeliharaan yang minimal. Integrasi teknologi fasad ini memperkuat karakter arsitektural tropis modern yang ramah lingkungan dan hemat energi.
`;
    const res = evaluateHumanWritingQuality(md);
    assert.strictEqual(res.decision, 'HUMAN_WRITING_REVISE');
    assert.ok(res.total_score < 85, 'Must drop below 85 due to academic distance');
    assert.ok(res.issues.some((i) => i.code === 'ACADEMIC_DISTANCE_EXCESSIVE'));
  });

  // 5. Product Review with Good Decision Support
  await test('5. Product review with good decision support passes cleanly', () => {
    const md = `
# Panduan Pembelian Smart Door Lock untuk Pintu Utama Kayu Solid

Memilih kunci pintu digital (smart lock) untuk pintu utama rumah tropis membutuhkan pertimbangan cermat pada ketahanan perangkat keras dan kesesuaian fisik daun pintu.

Perangkat dengan mortise standar 6068 memerlukan ketebalan daun pintu kayu solid minimal 40 mm hingga 50 mm. Jika dipasang pada daun pintu tripleks kopong, sekrup pengikat bodi kunci mudah goyang dan mengorbankan keamanan hunian. Fitur pemindai sidik jari semikonduktor bekerja lebih akurat daripada sensor optik konvensional saat jari penghuni sedikit berkeringat di udara tropis yang lembap.

Trade-off utama perangkat ini ada pada kebutuhan penggantian baterai alkaline berkala setiap 6 hingga 10 bulan, serta kerentanan sensor jika terkena tampias air hujan langsung tanpa kanopi pelindung di teras depan.

Jika pintu utama Anda terlindung kanopi teras minimal 1.5 meter dan memiliki daun pintu kayu tebal, smart lock tipe ini sangat layak dipertimbangkan. Namun jika pintu utama terpapar hujan langsung, prioritaskan model dengan sertifikasi ketahanan air minimal IP65.

Sebelum membeli, ukur ketebalan daun pintu dan lebar kedalaman mortise kunci eksisting Anda agar tidak perlu membongkar kusen secara berlebihan.
`;
    const res = evaluateHumanWritingQuality(md, { isProductReview: true });
    assert.strictEqual(res.decision, 'HUMAN_WRITING_PASS');
    assert.ok(res.total_score >= 85);
  });

  // 6. Correct Facts but Immediate Prescription Without Diagnosis
  await test('6. Correct facts but immediate prescription without diagnosis triggers DIAGNOSIS_MISSING', () => {
    const md = `
# Solusi Menghilangkan Dinding Lembap dan Berjamur

Dinding rumah yang basah di musim hujan sangat mengganggu kenyamanan. Untuk mengatasi masalah dinding basah ini, solusinya adalah dengan membeli cat pelapis anti-bocor merek ternama dan langsung pasang pelapis semen tebal di seluruh ruangan.

Pemilik rumah harus dipasang lapisan semen tebal setebal 5 mm agar rembesan air tidak keluar lagi ke permukaan plesteran.`;

    const res = evaluateHumanWritingQuality(md, { articleIntent: 'PROBLEM_SOLVING' });
    assert.ok(res.issues.some((i) => i.code === 'DIAGNOSIS_MISSING'));
  });

  // 7. Good Diagnosis but No Next Action
  await test('7. Good diagnosis but no next action triggers NEXT_ACTION_MISSING', () => {
    const md = `
# Mengapa Plafon Gipsum Rumah Sering Melengkung di Musim Hujan?

Keluhan plafon gipsum yang melengkung dan bernoda kuning sering dialami pemilik rumah setelah hujan lebat berlangsung beberapa hari berturut-turut.

Masalah ini terjadi bukan karena mutu lembaran gipsum semata, melainkan akibat kelembapan tinggi di rongga atap yang minim ventilasi udara. Saat dak beton atau genteng mengalami rembesan mikro, uap air terperangkap di atas plafon dan membuat kertas pelindung gipsum melunak dan kehilangan daya topang terhadap rangka hollow.

Perbedaan kelembapan udara tropis siang dan malam mempercepat proses pelemahan serat gipsum tersebut sehingga permukaan plafon terlihat cekung di antara jarak penggantung.`;

    const res = evaluateHumanWritingQuality(md);
    assert.ok(res.issues.some((i) => i.code === 'NEXT_ACTION_MISSING'));
  });

  // 8. Trade-Off-Free Universal Recommendation
  await test('8. Trade-off-free universal recommendation triggers SCENARIO_FIT_MISSING or TRADE_OFFS_INCOMPLETE', () => {
    const md = `
# Kusen Baja Ringan vs Kusen Kayu untuk Hunian

Dalam memilih antara kusen baja ringan versus kusen kayu, banyak pemilik rumah bingung menentukan pilihan. Kusen kayu memiliki serat indah dan mudah dibentuk oleh tukang kayu di workshop lokal.

Namun baja ringan adalah produk terbaik untuk semua hunian tanpa tanding dan selalu lebih unggul dalam segala hal. Kusen baja ringan wajib dipilih oleh siapa pun karena praktis dan tidak perlu memikirkan kekurangan apa pun.`;

    const res = evaluateHumanWritingQuality(md);
    assert.ok(res.issues.some((i) => i.code === 'SCENARIO_FIT_MISSING' || i.code === 'TRADE_OFFS_INCOMPLETE'));
  });

  // 9. Short Narrow Article with Adequate Depth
  await test('9. Short narrow article with adequate depth PASSes without penalty', () => {
    const md = `
# Fungsi Lubang Drainase Weep Holes pada Kusen Jendela Aluminium

Pernahkah Anda memperhatikan celah kecil berpenutup plastik di bagian bawah kusen aluminium rumah Anda? Celah ini dinamakan *weep holes* atau lubang drainase.

Saat hujan deras disertai angin kencang, air tampias yang membentur kaca akan mengalir turun ke rel bawah bingkai kusen. Fungsi utama weep holes adalah mengalirkan genangan air tersebut keluar sebelum ketinggian air meluap melewati bibir rel dan merembes ke dinding plesteran kamar tidur.

Pastikan lubang drainase ini tidak tersumbat oleh debu pekat atau tertutup oleh acian semen saat renovasi berlangsung. Cukup periksa kelancarannya dengan menuangkan sedikit air ke rel jendela setiap 6 bulan sekali.
`;
    const res = evaluateHumanWritingQuality(md);
    assert.strictEqual(res.decision, 'HUMAN_WRITING_PASS');
    assert.ok(res.total_score >= 85);
    assert.ok(!res.issues.some((i) => i.code === 'SCOPE_DEPTH_MISMATCH'));
  });

  // 10. Short Broad Article with Scope-Depth Mismatch
  await test('10. Short broad article with scope-depth mismatch triggers SCOPE_DEPTH_MISMATCH', () => {
    const md = `
# Panduan Lengkap Desain Rumah Tropis Modern Hemat Energi

Desain rumah tropis yang ideal membutuhkan pertimbangan matang pada sirkulasi udara, pencahayaan alami, dan orientasi bangunan terhadap panas matahari.

Gunakan ventilasi silang yang teratur di seluruh ruangan dan pasang panel surya di atap rumah untuk menghemat tagihan listrik bulanan hunian Anda.`;

    const res = evaluateHumanWritingQuality(md);
    assert.ok(res.issues.some((i) => i.code === 'SCOPE_DEPTH_MISMATCH'));
  });

  // 11. Formal Scientific Prose with Homeowner Connection (No False Penalty)
  await test('11. Formal scientific prose with homeowner connection achieves PASS without false penalty', () => {
    const md = `
# Analisis Koefisien Transmisi Termal U-Value Kaca Ganda pada Hunian Tropis

Paparan radiasi surya pada bukaan fenestrasi merupakan penyumbang utama beban pendinginan ruang di wilayah perkotaan tropis lembap Indonesia.

Berdasarkan kalkulasi standar ISO 10077, kaca tunggal bening berketebalan 5 mm memiliki nilai transmisi termal (U-value) sekitar 5.8 W/m²K. Dengan menggantinya menjadi kaca ganda berpembatas udara (*insulated glass unit*) berlapis *low-e*, nilai U-value dapat ditekan hingga di bawah 2.0 W/m²K, yang secara langsung mengurangi transfer radiasi panas ke ruang keluarga.

Konsekuensi praktis bagi pemilik rumah adalah penurunan beban kerja kompresor pendingin udara (AC) hingga suhu ruang terasa lebih stabil. Namun, sistem kaca ganda memiliki bobot 2 kali lebih berat sehingga membutuhkan profil kusen yang lebih kaku dan engsel tugas berat.

Sebelum memesan, pastikan aplikator kusen Anda memverifikasi kapasitas beban engsel dan kualitas desiccant penyerap kelembapan di dalam rongga kaca ganda.
`;
    const res = evaluateHumanWritingQuality(md);
    assert.strictEqual(res.decision, 'HUMAN_WRITING_PASS');
    assert.ok(res.total_score >= 85);
    assert.ok(!res.issues.some((i) => i.code === 'ACADEMIC_DISTANCE_EXCESSIVE'));
  });

  // 12. Article 5 Regression Protection
  await test('12. Article 5 Canonical regression protection (Score = 100, PASS)', () => {
    const res = evaluateHumanWritingQuality(a5Canonical.content_md);
    assert.strictEqual(res.decision, 'HUMAN_WRITING_PASS');
    assert.strictEqual(res.total_score, 100);
    assert.strictEqual(res.issues.length, 0);
  });

  // 13. Article 6 Real-Corpus Behavior (Drops to REVISE, score = 84)
  await test('13. Article 6 real-corpus behavior drops to REVISE (score = 84, triggers ACADEMIC_DISTANCE_EXCESSIVE)', () => {
    const a6Row = d1.prepare('SELECT content_md FROM articles WHERE id = 6').get();
    assert.ok(a6Row);
    const res = evaluateHumanWritingQuality(a6Row.content_md);
    assert.strictEqual(res.decision, 'HUMAN_WRITING_REVISE');
    assert.strictEqual(res.total_score, 84);
    assert.ok(res.issues.some((i) => i.code === 'ACADEMIC_DISTANCE_EXCESSIVE'));
    assert.strictEqual(res.rewrite_brief.target_agent_id, 'content_writer_primary');
  });

  console.log(`\n🎉 All ${passed} tests in EDITORIAL-EXPERT-CONSULTATION-1 passed successfully!`);
}

main().catch((err) => {
  console.error('❌ Test failed:', err);
  process.exit(1);
});
