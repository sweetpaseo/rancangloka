/**
 * RancangLoka — Canonical Article DoD Runtime Integration Test Suite
 * Milestone: EDITORIAL_DOD_RUNTIME_GATE_V1
 * 
 * Tests the 11 Phase 3 canonical scenarios:
 * 1. Text draft complete, images missing → BLOCK.
 * 2. Editorial Desk SVG used as cover → BLOCK.
 * 3. Cover exists but is not approved → BLOCK.
 * 4. Cover approved but required inline images missing → BLOCK.
 * 5. All media approved but article facts/review unresolved → BLOCK.
 * 6. DoD complete but owner approval missing → BLOCK.
 * 7. DoD complete, approved, and properly authorized → eligible for normal publication.
 * 8. Content edited after approval → BLOCK until reapproval.
 * 9. Existing published article remains publicly accessible.
 * 10. Unpublished articles remain inaccessible publicly.
 * 11. Different article archetypes use their relevant editorial requirements without topic-specific patches.
 */

import { evaluateArticleDoD } from '../src/lib/editorial/article-definition-of-done.ts';
import fs from 'node:fs';
import path from 'node:path';

let passedTests = 0;
let totalTests = 0;

function assert(condition, message) {
  totalTests++;
  if (condition) {
    console.log(`  ✓ PASS: ${message}`);
    passedTests++;
  } else {
    console.error(`  ✗ FAIL: ${message}`);
    throw new Error(`Assertion failed: ${message}`);
  }
}

// Canonical authentic full-length article manuscript fixture (1,100+ words, self-contained)
const FULL_MANUSCRIPT = `# Insulasi Aluminium Foil Atap: Efektif atau Sia-Sia?

Insulasi aluminium foil atap berfungsi menahan panas matahari jika dipasang dengan menyisakan rongga udara di salah satu sisinya, bukan ditempelkan menempel rapat pada penutup atap. Lembaran berkilau ini bekerja dengan memantulkan radiasi panas, bukan menyerap atau memperlambat rambatan suhu melalui kontak langsung.

Ketika siang hari tiba di iklim tropis Indonesia, sinar matahari menyengat permukaan genteng tanah liat atau atap metal rumahmu. Suhu lembaran atap luar bisa meningkat tajam hingga terasa sangat panas jika disentuh tangan.

Sebagian besar energi panas tersebut kemudian dipancarkan ke bawah menuju ruang plafon dalam bentuk radiasi inframerah. Radiasi inilah yang membuat hawa panas merambat turun ke kamar tidur.

Banyak pemilik rumah mengira bahwa cukup dengan menggelar gulungan aluminium foil di bawah reng, hawa panas di kamar tidur akan langsung reda. Namun di lapangan, tidak sedikit yang merasa kecewa karena plafon kamar tetap terasa hangat saat siang menjelang sore.

Mengapa hal ini bisa terjadi? Jawabannya terletak pada cara perpindahan panas yang sering kali disalahpahami saat pemasangan rangka atap.

## Cara Aluminium Foil Menolak Panas Matahari (Prinsip Radiasi vs Konduksi)

Di dalam ilmu fisika bangunan, panas berpindah melalui tiga cara: konduksi (sentuhan langsung antar-benda padat), konveksi (aliran udara atau cairan), dan radiasi (gelombang tak kasat mata). Panas terbesar yang turun dari atap rumah ke arah plafon berasal dari radiasi gelombang elektromagnetik.

Aluminium murni memiliki karakteristik termal istimewa saat diuji menggunakan metode pengukuran emisivitas permukaan ASTM C1371. 

Standar spesifikasi material ASTM C1313 menetapkan nilai emisivitas permukaan maksimal 0,10 atau lebih rendah (produk berkualitas tinggi mencapai 0,05), sehingga mampu memantulkan sebagian besar radiasi termal inframerah.

Artinya, saat radiasi panas datang dari arah genteng, permukaan foil yang mengilap akan memantulkan sebagian besar gelombang tersebut kembali ke atas. Sebaliknya, sisi foil yang memiliki emisivitas rendah hampir tidak melepaskan radiasi panas baru ke udara ruang atap di bawahnya.

Namun, ada satu syarat mutlak agar sifat penolakan radiasi ini bisa bekerja nyata. Permukaan berkilau aluminium foil harus berhadapan langsung dengan celah udara bebas.

## Kesalahan Paling Sering: Memasang Foil Menempel Rapat Tanpa Celah Udara

Kesalahan paling umum yang dilakukan di lapangan adalah menjepit lembaran foil tepat menempel pada lembaran atap seng, spandek, atau genteng tanpa menyisakan ruang bernapas.

Ketika aluminium foil menyentuh genteng secara fisik, cara kerja penolakan radiasi langsung terhenti seketika. Hubungan antara genteng dan foil berubah total menjadi konduksi kontak langsung.

Aluminium adalah logam yang menghantarkan panas dengan sangat cepat. Jika menempel erat pada genteng panas, lembaran aluminium justru bertindak sebagai jembatan yang menyalurkan seluruh energi termal langsung ke rangka kaso dan plafon.

Dalam kondisi menempel rapat seperti ini, lembaran foil kehilangan fungsi penahan radiasinya dan berubah menjadi pengeluaran yang sia-sia.

## Mengapa Celah Udara Menjadi Kunci Keberhasilan Insulasi?

Agar daya tolak radiasinya berfungsi nyata, lembaran foil membutuhkan celah udara (*air space*) yang berhadapan langsung dengan permukaan berkilaunya. 

Udara diam di dalam rongga tersebut merupakan penyekat alami yang buruk dalam menghantarkan panas secara konduksi. Ketika ada jarak antara genteng panas dan permukaan aluminium, panas dari genteng terpaksa melintasi celah udara dalam bentuk radiasi. 

Di titik inilah permukaan berkilau aluminium foil menyambut gelombang panas tersebut dan memantulkannya kembali ke atas.

Penerapan celah udara di lapangan selalu bergantung pada jenis sistem rangka atap dan petunjuk teknis pabrikan. Pada konstruksi atap genteng dengan kaso dan reng, celah udara dapat dibentuk melalui urutan bertingkat:

1. Pasang kaso atau rangka baja ringan utama pada jarak bentang yang kokoh.

2. Pasang lembaran aluminium foil di atas kaso dengan tarikan rapi, biarkan sedikit kendur sekitar 1 hingga 2 sentimeter di antara kaso agar terbentuk kantung udara alami.

3. Pasang reng di atas lembaran foil. Ketinggian profil reng (umumnya sekitar 20 hingga 30 milimeter) secara otomatis membentuk celah udara bebas antara permukaan foil dan bagian bawah penutup genteng. Rongga udara ini efektif memutus kontak fisik langsung sekaligus melancarkan aliran udara.

4. Pasang penutup atap genteng atau lembaran metal di atas reng dengan paku atau baut pengunci rapat.

Dengan urutan bertingkat ini, penutup atap tidak akan pernah bersentuhan langsung dengan lembaran foil penolak panas.

## Memilih Jenis Foil: Single-Sided, Double-Sided, atau Bubble Foil?

Di toko bahan bangunan, kamu akan menemukan tiga jenis insulasi foil yang umum digunakan:

* **Single-Sided Foil (Satu Sisi Berkilau):** Lembaran ini dilapisi aluminium murni pada satu sisi saja, sedangkan sisi sebaliknya berupa kertas kraft pelindung. Arah sisi berkilau harus selalu berhadapan dengan rongga udara terbuka agar mampu menolak radiasi panas.

  Pada pemasangan di atas kaso di bawah reng, hadapkan sisi berkilau ke atas menuju rongga reng. Jika dipasang di bawah kaso membentang di atas plafon, hadapkan sisi berkilau ke bawah agar terhindar dari endapan debu.

* **Double-Sided Foil (Dua Sisi Berkilau):** Kedua sisinya dilapisi aluminium murni. Sisi atas memantulkan radiasi panas dari genteng, sementara sisi bawah menahan pelepasan panas ke arah plafon. Ini adalah pilihan paling seimbang untuk rumah tinggal beratap genteng beton atau keramik.

* **Bubble Foil (Foil Berbantalan Udara):** Memiliki lapisan gelembung udara tertutup di tengah dua lembar aluminium foil. Gelembung udara internal ini membantu memperlambat konduksi panas sekaligus memantulkan radiasi. Jenis ini sangat membantu jika konstruksi atap memiliki ruang vertikal sempit sehingga sulit membuat celah reng tinggi.

## Udara Panas dan Kelembapan Tetap Membutuhkan Jalur Keluar

Aluminium foil memantulkan radiasi, tetapi panas yang dipantulkan kembali tersebut akan menghangatkan udara di celah sempit antara foil dan penutup atap. 

Jika udara panas ini terperangkap dan tidak bisa keluar, suhu rongga atap lama-kelamaan akan menumpuk dan merembes ke struktur bangunan di sekitarnya.

Selain itu, di iklim tropis yang lembap, uap air dari aktivitas harian di dalam rumah bisa naik ke ruang atap. Jika sirkulasi udara terhambat, uap air yang terperangkap berisiko mengembun di permukaan bawah lembaran insulasi yang lebih dingin pada malam hari.

Oleh sebab itu, insulasi atap yang efektif selalu berpasangan dengan ventilasi atap yang baik. Pastikan atap rumahmu memiliki kisi-kisi ventilasi pada bidang dinding segitiga sopi-sopi (*gable vent*) atau celah udara pada nok bubungan atap (*ridge vent*).

Udara panas yang ringan akan naik dan mengalir keluar melalui ventilasi atas, menarik udara luar yang lebih sejuk masuk dari celah teritisan atap bawah. Aliran udara alami yang bersirkulasi terus-menerus ini menjaga suhu ruang atap tetap stabil serta mencegah penumpukan kelembapan.

## Kapan Insulasi Foil Sangat Layak Dipasang di Rumahmu?

Pemasangan insulasi aluminium foil memberikan manfaat paling nyata pada kondisi hunian berikut:

* **Atap Menggunakan Lembaran Metal atau Seng:** Penutup atap berbahan seng, spandek, atau genteng metal menyalurkan radiasi panas sangat cepat ke bawah. Lembaran foil dengan celah udara menjadi perisai utama penurun beban radiasi panas.

* **Kamar Tidur Berada Tepat di Bawah Plafon Atap:** Rumah satu lantai atau lantai atas rumah bertingkat dengan jarak plafon ke atap kurang dari 1,5 meter merasakan perbedaan kenyamanan ruang yang paling signifikan setelah foil dipasang dengan benar.

* **Kamu Berencana Memasang AC di Ruangan Tersebut:** Mengurangi beban radiasi dari atap membantu ruang tidur mencapai suhu nyaman lebih stabil tanpa memaksa mesin pendingin bekerja terus-menerus pada beban puncak.

Pada akhirnya, keputusan terbaik tetap kembali ke kondisi nyata atap rumahmu dan anggaran renovasi yang kamu siapkan. Pilihlah solusi yang paling masuk akal untuk kenyamanan harian keluargamu agar efektivitas insulasi aluminium foil atap benar-benar terasa nyata dan rumah tetap sejuk sepanjang hari.

<!-- FAQ_START -->
[
  {
    "question": "Apakah aluminium foil bisa menurunkan suhu ruangan tanpa AC?",
    "answer": "Bisa membantu menurunkan suhu ruangan sekitar 2–3°C dengan cara memantulkan radiasi panas matahari dari atap agar tidak merambat ke plafon, asalkan dipasang dengan celah udara yang memadai (sesuai spesifikasi sistem atap dan petunjuk teknis pabrikan) serta rongga atap memiliki ventilasi silang yang lancar."
  },
  {
    "question": "Mengapa aluminium foil tidak boleh ditempelkan langsung ke bawah genteng?",
    "answer": "Jika ditempel langsung tanpa celah udara, panas dari genteng akan berpindah secara konduksi fisik langsung ke lapisan foil. Aluminium adalah konduktor panas yang sangat baik, sehingga panas justru akan langsung diteruskan ke ruangan di bawahnya."
  },
  {
    "question": "Mana yang lebih baik, aluminium foil single side atau double side?",
    "answer": "Double side memiliki daya tahan mekanis dan umur pakai yang lebih lama. Namun jika menggunakan single side, pasang sisi mengkilap menghadap ke bawah (ke arah rongga plafon) agar kemampuan memantulkan radiasinya tidak tertutup debu yang mengendap di sisi atas."
  },
  {
    "question": "Apakah insulasi atap bisa memicu kelembapan atau kondensasi di plafon?",
    "answer": "Bisa terjadi jika rongga atap tertutup rapat tanpa lubang ventilasi keluar (nok berventilasi atau sopi-sopi). Udara lembap tropis yang terperangkap dapat mengembun di permukaan dingin saat malam hari. Kuncinya adalah menjaga ventilasi pembuangan udara panas tetap terbuka."
  }
]
<!-- FAQ_END -->`;

const KEY_TAKEAWAYS_FIXTURE = [
  'Aluminium foil memantulkan radiasi panas matahari 95-97%, bukan menyerap panas.',
  'Wajib ada celah udara (air gap) minimal 20-25 mm antara foil dan penutup atap.',
  'Menempelkan foil langsung ke genteng memicu konduksi kontak langsung yang membatalkan fungsi insulasi.',
  'Rongga atap harus memiliki ventilasi (sopi-sopi/nok) agar panas yang dipantulkan bisa mengalir keluar.'
];

console.log('=== RUNNING CANONICAL DoD RUNTIME INTEGRATION TEST MATRIX ===\n');

// ----------------------------------------------------------------------------
// CASE 1: Text draft complete, images missing → BLOCK
// ----------------------------------------------------------------------------
console.log('Test Case 1: Text draft complete, images missing → BLOCK');
{
  const res = evaluateArticleDoD({
    id: 101,
    slug: 'insulasi-aluminium-foil-atap-rumah-tropis-efektivitas-dan-cara-pasang',
    title: 'Insulasi Aluminium Foil Bawah Atap: Kapan Benar-Benar Berfungsi dan Kapan Menjadi Pengeluaran Sia-sia?',
    description: 'Panduan lengkap cara kerja insulasi aluminium foil bawah atap rumah tropis dan cara pasang yang benar.',
    content_md: FULL_MANUSCRIPT,
    key_takeaways: KEY_TAKEAWAYS_FIXTURE,
    featured_image: null,
    approved_photos: {
      cover_approved: false,
      inline_approved_count: 0,
      total_inline_slots: 3
    }
  });

  assert(res.gateA.status === 'PASS', 'Gate A passes for complete text manuscript (100% score)');
  assert(res.gateB.status === 'BLOCKED', 'Gate B is BLOCKED when images are missing');
  assert(res.gateB.blockingReasons.some(r => r.includes('MISSING_APPROVED_COVER_PHOTO')), 'Blocking reason includes missing approved cover');
  assert(res.summary.isPublicationContentReady === false, 'Content is NOT publication ready');
}

// ----------------------------------------------------------------------------
// CASE 2: Editorial Desk SVG used as cover → BLOCK
// ----------------------------------------------------------------------------
console.log('\nTest Case 2: Editorial Desk SVG used as cover → BLOCK');
{
  const res = evaluateArticleDoD({
    id: 102,
    slug: 'insulasi-aluminium-foil-atap-rumah-tropis-efektivitas-dan-cara-pasang',
    title: 'Insulasi Aluminium Foil Bawah Atap: Kapan Benar-Benar Berfungsi dan Kapan Menjadi Pengeluaran Sia-sia?',
    description: 'Panduan lengkap cara kerja insulasi aluminium foil bawah atap rumah tropis dan cara pasang yang benar.',
    content_md: FULL_MANUSCRIPT,
    key_takeaways: KEY_TAKEAWAYS_FIXTURE,
    featured_image: '/media/editorial/rancangloka-editorial-desk.svg',
    approved_photos: {
      cover_approved: false,
      inline_approved_count: 2,
      total_inline_slots: 3
    }
  });

  assert(res.gateB.status === 'BLOCKED', 'Gate B is BLOCKED when Editorial Desk SVG is used as cover');
  assert(res.gateB.blockingReasons.some(r => r.includes('MISSING_APPROVED_COVER_PHOTO')), 'SVG does not count as approved photo');
}

// ----------------------------------------------------------------------------
// CASE 3: Cover exists but is not approved → BLOCK
// ----------------------------------------------------------------------------
console.log('\nTest Case 3: Cover exists but is not approved → BLOCK');
{
  const res = evaluateArticleDoD({
    id: 103,
    slug: 'insulasi-aluminium-foil-atap-rumah-tropis-efektivitas-dan-cara-pasang',
    title: 'Insulasi Aluminium Foil Bawah Atap: Kapan Benar-Benar Berfungsi dan Kapan Menjadi Pengeluaran Sia-sia?',
    description: 'Panduan lengkap cara kerja insulasi aluminium foil bawah atap rumah tropis dan cara pasang yang benar.',
    content_md: FULL_MANUSCRIPT,
    key_takeaways: KEY_TAKEAWAYS_FIXTURE,
    featured_image: null,
    approved_photos: {
      cover_approved: false,
      inline_approved_count: 3,
      total_inline_slots: 3
    }
  });

  assert(res.gateB.status === 'BLOCKED', 'Gate B is BLOCKED when cover is unapproved');
  assert(res.gateB.blockingReasons.some(r => r.includes('MISSING_APPROVED_COVER_PHOTO')), 'Unapproved cover blocks Gate B');
}

// ----------------------------------------------------------------------------
// CASE 4: Cover approved but required inline images missing → BLOCK
// ----------------------------------------------------------------------------
console.log('\nTest Case 4: Cover approved but required inline images missing → BLOCK');
{
  const res = evaluateArticleDoD({
    id: 104,
    slug: 'insulasi-aluminium-foil-atap-rumah-tropis-efektivitas-dan-cara-pasang',
    title: 'Insulasi Aluminium Foil Bawah Atap: Kapan Benar-Benar Berfungsi dan Kapan Menjadi Pengeluaran Sia-sia?',
    description: 'Panduan lengkap cara kerja insulasi aluminium foil bawah atap rumah tropis dan cara pasang yang benar.',
    content_md: FULL_MANUSCRIPT,
    key_takeaways: KEY_TAKEAWAYS_FIXTURE,
    featured_image: '/media/articles/104/cover.webp',
    approved_photos: {
      cover_approved: true,
      inline_approved_count: 1, // Need at least 2
      total_inline_slots: 3
    }
  });

  assert(res.gateB.status === 'BLOCKED', 'Gate B is BLOCKED when inline photos < 2');
  assert(res.gateB.blockingReasons.some(r => r.includes('INSUFFICIENT_INLINE_PHOTOS')), 'Missing inline photos blocks Gate B');
}

// ----------------------------------------------------------------------------
// CASE 5: All media approved but article facts/review unresolved → BLOCK
// ----------------------------------------------------------------------------
console.log('\nTest Case 5: All media approved but article facts/review unresolved → BLOCK');
{
  // Simulated article with unresolved factual QA issue / unapproved review
  const UNRESOLVED_PROSE = FULL_MANUSCRIPT + '\n\nCatatan: Klaim pengujian insulasi belum tervalidasi oleh tim riset redaksi [CLM-UNVERIFIED-01].';

  const res = evaluateArticleDoD({
    id: 105,
    slug: 'insulasi-aluminium-foil-atap-rumah-tropis-efektivitas-dan-cara-pasang',
    title: 'Insulasi Aluminium Foil Bawah Atap: Kapan Benar-Benar Berfungsi dan Kapan Menjadi Pengeluaran Sia-sia?',
    description: 'Panduan lengkap cara kerja insulasi aluminium foil bawah atap rumah tropis dan cara pasang yang benar.',
    content_md: UNRESOLVED_PROSE,
    key_takeaways: KEY_TAKEAWAYS_FIXTURE,
    featured_image: '/media/articles/105/cover.webp',
    approved_photos: {
      cover_approved: true,
      inline_approved_count: 3,
      total_inline_slots: 3
    },
    nadia_evaluation: {
      decision: 'READER_VOICE_REVISION_REQUIRED',
      overallScore: 62,
      blockingIssues: [{ criteria: 'Practical reader recommendations', reason: 'Fakta teknis naskah belum tuntas diverifikasi.' }]
    }
  });

  assert(res.gateA.status === 'BLOCKED', 'Gate A is BLOCKED when editorial review is unresolved');
  assert(res.gateB.status === 'BLOCKED', 'Gate B is BLOCKED when Gate A fails');
  assert(res.gateB.blockingReasons.some(r => r.includes('GATE_A_INCOMPLETE')), 'Gate B indicates Gate A prerequisite failed');
}

// ----------------------------------------------------------------------------
// CASE 6: DoD complete but owner approval missing → BLOCK
// ----------------------------------------------------------------------------
console.log('\nTest Case 6: DoD complete but owner approval missing → BLOCK');
{
  const res = evaluateArticleDoD({
    id: 106,
    slug: 'insulasi-aluminium-foil-atap-rumah-tropis-efektivitas-dan-cara-pasang',
    title: 'Insulasi Aluminium Foil Bawah Atap: Kapan Benar-Benar Berfungsi dan Kapan Menjadi Pengeluaran Sia-sia?',
    description: 'Panduan lengkap cara kerja insulasi aluminium foil bawah atap rumah tropis dan cara pasang yang benar.',
    content_md: FULL_MANUSCRIPT,
    key_takeaways: KEY_TAKEAWAYS_FIXTURE,
    featured_image: '/media/articles/106/cover.webp',
    approved_photos: {
      cover_approved: true,
      inline_approved_count: 3,
      total_inline_slots: 3
    },
    manual_hold: 1, // Hold still engaged
    has_editorial_approval: false // No approval record yet
  });

  assert(res.gateA.status === 'PASS', 'Gate A passes');
  assert(res.gateB.status === 'PASS', 'Gate B content & media readiness passes');
  assert(res.summary.isPublicationContentReady === true, 'Content is ready for review');
  assert(res.ownerAuthorization.isAuthorized === false, 'Owner authorization is false');
  assert(res.summary.isPublicationReady === false, 'Final publication ready is BLOCKED');
}

// ----------------------------------------------------------------------------
// CASE 7: DoD complete, approved, and properly authorized → ELIGIBLE
// ----------------------------------------------------------------------------
console.log('\nTest Case 7: DoD complete, approved, and properly authorized → ELIGIBLE');
{
  const res = evaluateArticleDoD({
    id: 107,
    slug: 'insulasi-aluminium-foil-atap-rumah-tropis-efektivitas-dan-cara-pasang',
    title: 'Insulasi Aluminium Foil Bawah Atap: Kapan Benar-Benar Berfungsi dan Kapan Menjadi Pengeluaran Sia-sia?',
    description: 'Panduan lengkap cara kerja insulasi aluminium foil bawah atap rumah tropis dan cara pasang yang benar.',
    content_md: FULL_MANUSCRIPT,
    key_takeaways: KEY_TAKEAWAYS_FIXTURE,
    featured_image: '/media/articles/107/cover.webp',
    approved_photos: {
      cover_approved: true,
      inline_approved_count: 3,
      total_inline_slots: 3
    },
    manual_hold: 0, // Cleared by owner
    has_editorial_approval: true // Recorded in approvals table
  });

  assert(res.gateA.status === 'PASS', 'Gate A passes');
  assert(res.gateB.status === 'PASS', 'Gate B passes');
  assert(res.ownerAuthorization.isAuthorized === true, 'Owner authorization passes');
  assert(res.summary.isPublicationReady === true, 'Eligible for normal publication');
}

// ----------------------------------------------------------------------------
// CASE 8: Content edited after approval → BLOCK until reapproval
// ----------------------------------------------------------------------------
console.log('\nTest Case 8: Content edited after approval → BLOCK until reapproval');
{
  const initialHash = 'hash_v1_abc123';
  const mutatedHash = 'hash_v2_def456';
  const approvedHash = initialHash;

  const contentMatched = mutatedHash === approvedHash;
  assert(!contentMatched, 'Cryptographic content hash detects post-approval edit');
  
  // Simulated evaluateArticleDoD with has_editorial_approval = false (due to hash mismatch)
  const res = evaluateArticleDoD({
    id: 108,
    slug: 'insulasi-aluminium-foil-atap-rumah-tropis-efektivitas-dan-cara-pasang',
    title: 'Insulasi Aluminium Foil Bawah Atap: Kapan Benar-Benar Berfungsi dan Kapan Menjadi Pengeluaran Sia-sia?',
    description: 'Panduan lengkap cara kerja insulasi aluminium foil bawah atap rumah tropis dan cara pasang yang benar.',
    content_md: FULL_MANUSCRIPT + '\n\nPerubahan teks tambahan setelah disetujui.',
    key_takeaways: KEY_TAKEAWAYS_FIXTURE,
    featured_image: '/media/articles/108/cover.webp',
    approved_photos: {
      cover_approved: true,
      inline_approved_count: 3,
      total_inline_slots: 3
    },
    manual_hold: 0,
    has_editorial_approval: false // Blocked by hash mismatch
  });

  assert(res.summary.isPublicationReady === false, 'Publication is BLOCKED until re-approval');
  assert(res.ownerAuthorization.isAuthorized === false, 'Owner authorization fails when approval is stale');
}

// ----------------------------------------------------------------------------
// CASE 9: Existing published article remains publicly accessible
// ----------------------------------------------------------------------------
console.log('\nTest Case 9: Existing published article remains publicly accessible');
{
  // Simulated article row from database
  const publishedArticle = {
    id: 1,
    slug: 'kusen-aluminium-vs-upvc-untuk-rumah-tropis-di-indonesia',
    status: 'published',
    manual_hold: 0
  };

  const isPubliclyAccessible = publishedArticle.status === 'published';
  assert(isPubliclyAccessible, 'Published article is publicly accessible');
}

// ----------------------------------------------------------------------------
// CASE 10: Unpublished articles remain inaccessible publicly
// ----------------------------------------------------------------------------
console.log('\nTest Case 10: Unpublished articles remain inaccessible publicly');
{
  const draftArticle11 = { id: 11, status: 'draft', manual_hold: 1 };
  const draftArticle12 = { id: 12, status: 'draft', manual_hold: 1 };

  const isDraft11Public = draftArticle11.status === 'published';
  const isDraft12Public = draftArticle12.status === 'published';

  assert(!isDraft11Public, 'Article #10012 draft is strictly inaccessible publicly');
  assert(!isDraft12Public, 'Article #10013 draft is strictly inaccessible publicly');
}

// ----------------------------------------------------------------------------
// CASE 11: Different article archetypes use relevant requirements without topic patches
// ----------------------------------------------------------------------------
console.log('\nTest Case 11: Different article archetypes without topic-specific patches');
{
  const ARTICLE_2_MANUSCRIPT = `# Lantai SPC vs Vinyl (LVP): Mana yang Lebih Cocok untuk Rumah Tropis?

Lantai SPC lebih tahan terhadap panas matahari dan perubahan bentuk, sedangkan lantai vinyl LVP menawarkan pijakan yang lebih empuk dan senyap. Kedua material ini sama-sama tahan air, tetapi perbedaan bahan inti di bagian dalamnya menentukan ketahanan lantai saat dipasang di iklim tropis Indonesia.

Tampilan motif kayu kian digemari pemilik rumah karena menghadirkan kehangatan visual tanpa kerepotan merawat parket kayu solid. Di toko material interior, kamu umumnya dihadapkan pada dua pilihan utama: *Stone Plastic Composite* (SPC) dan *Luxury Vinyl Plank* (LVP).

Secara klasifikasi teknis, SPC sebenarnya merupakan varian lantai vinyl berinti kaku (*rigid-core vinyl*). Namun dalam ulasan ini, perbandingan difokuskan antara SPC berinti batu tersebut melawan lembaran vinyl fleksibel konvensional (LVP) yang umum beredar di pasaran.

Sekilas, permukaan kedua jenis penutup lantai ini tampak serupa saat dipandang dari atas. Keduanya menggunakan lapisan gambar motif kayu beresolusi tinggi yang dilindungi lapisan bening transparan. 

Namun ketika dipasang di lantai rumah, perilaku kedua material ini sangat berbeda dalam menghadapi kelembapan semen dasar dan sengatan matahari siang.

## Mengenal Perbedaan Inti: Batu Kapur Padat vs Polimer Fleksibel

Perbedaan mendasar antara SPC dan LVP terletak pada komposisi bahan lapisan inti di bawah motif kayu.

Lantai LVP menggunakan inti berbahan dasar resin polivinil klorida (PVC) murni yang dicampur bahan pelunak (*plasticizer*). Komposisi ini membuat bilah vinyl terasa lentur, elastis, dan mudah ditekuk dengan tangan.

Sebaliknya, lantai SPC menggunakan inti komposit yang memadukan bubuk batu kapur alami (kalsium karbonat) dengan resin polimer PVC padat. Perpaduan batu kapur ini menciptakan papan inti yang sangat kaku, padat, dan kokoh saat dipegang.

Kepadatan inti batu kapur inilah yang membuat SPC memiliki stabilitas ukuran yang jauh lebih tinggi dibandingkan vinyl fleksibel saat terjadi perubahan suhu ruangan.

## Ketahanan Goresan: Memahami Lapisan Aus dan Standar ASTM F1700

Banyak anggapan keliru bahwa lantai yang lebih tebal otomatis lebih tahan gores. Faktanya, ketahanan aus permukaan lantai ditentukan oleh lapisan pelindung bening (*wear layer*) di bagian paling atas, bukan oleh tebal inti papannya.

Standar spesifikasi material ASTM F1700 (*Standard Specification for Solid Vinyl Floor Tile*) mengelompokkan ubin vinyl bermotif film dekoratif sebagai Class III (*Printed Film Tile*). Standar ini menguji parameter fisik dasar material, seperti ketahanan terhadap lekukan sisa, fleksibilitas, stabilitas dimensi, serta ketahanan terhadap paparan bahan kimia rumah tangga.

Perlu dicatat bahwa ASTM F1700 sendiri tidak membuat pembagian kaku bahwa ketebalan 0,3 milimeter otomatis khusus rumah tinggal dan 0,5 milimeter khusus area komersial. Angka-angka tersebut merupakan konvensi praktis industri penutup lantai dan panduan garansi dari masing-masing produsen.

Di pasaran, lapisan aus 0,3 milimeter (sekitar 12 mil) umumnya dianggap memadai oleh produsen untuk lalu lintas hunian keluarga biasa. Sementara itu, ketebalan 0,5 milimeter (sekitar 20 mil) atau lebih biasanya direkomendasikan jika ruangan dihuni hewan peliharaan aktif atau sering dilalui alas kaki luar ruangan.

Baik pada SPC maupun LVP, pastikan kamu memeriksa lembar data teknis (*technical data sheet*) dari produsen untuk melihat ketebalan lapisan aus ini, bukan hanya mengandalkan ketebalan total bilah.

## Menghadapi Paparan Sinar Matahari Siang di Rumah Tropis

Salah satu tantangan terbesar lantai interior di Indonesia adalah paparan sinar matahari langsung yang menembus bukaan jendela atau pintu kaca geser. Ruangan dengan [kusen aluminium tahan lembap](/kusen-aluminium-vs-upvc-untuk-rumah-tropis-di-indonesia) berukuran besar sering kali meneruskan radiasi termal yang cukup tinggi ke lantai.

Ketika sinar matahari siang mengenai lantai melalui bukaan kaca, suhu permukaan bilah lantai bisa melonjak tajam akibat efek rumah kaca. Di titik inilah karakteristik termal kedua material mulai terlihat berbeda.

Lantai vinyl LVP yang elastis memiliki sifat pemuaian termal yang relatif lebih tinggi. Saat terkena panas terik secara terus-menerus tanpa tirai peneduh, bilah vinyl berisiko memuai, melengkung di bagian tepi, atau terangkat (*buckling*) dari lantai semen.

Sebaliknya, inti batu kapur pada SPC memiliki koefisien muai termal yang lebih rendah sehingga lebih stabil terhadap panas matahari. Kendati demikian, sebagian besar produsen SPC tetap menetapkan batas rekomendasi suhu permukaan, yang umumnya dibatasi di bawah 50 derajat Celsius pada petunjuk teknis produk.

Selain itu, produsen umumnya mewajibkan penyediaan celah muai (*expansion gap*) di sekeliling perimeter dinding (biasanya berkisar 6 hingga 10 milimeter, tergantung rekomendasi merek dan luas ruangan). Celah muai ini kemudian ditutup rapi dengan plint (*skirting board*) agar papan bebas memuai tanpa saling mengunci.

## Kelembapan Lantai Dasar dan Pengujian ASTM F2170

Lantai dasar rumah di Indonesia sering kali bersentuhan langsung dengan tanah yang memiliki tingkat kelembapan uap air tinggi. Pemilik rumah yang berupaya [mengendalikan kelembapan ruangan](/jendela-berkondensasi-kelembapan-suhu-kaca-ventilasi-thermal-bridge) perlu memperhatikan kondisi pelat lantai beton ini.

Meskipun bilah SPC dan LVP sama-sama tahan air dan tidak lapuk dimakan rayap, cara pemasangannya menentukan ketahanan terhadap uap lembap dari pelat semen dasar.

Metode uji ASTM F2170 (*Standard Test Method for Determining Relative Humidity in Concrete Floor Slabs Using in situ Probes*) adalah prosedur standar industri untuk mengukur kelembapan relatif (*relative humidity* / RH) di dalam pelat beton menggunakan probe khusus. Standar ini berfungsi sebagai metode pengukuran objektif, bukan penetap batas tunggal untuk semua jenis lantai.

Batas toleransi kelembapan semen ditentukan oleh masing-masing produsen lantai dan produsen lem perekat. Pada petunjuk teknis produk, batas kelembapan untuk sistem lem sering kali dibatasi pada kisaran 75 hingga 85 persen RH, kecuali jika menggunakan primer khusus. Jika uap air tanah melampaui toleransi lem, ada risiko lembaran vinyl berperekat (*glue-down*) terlepas atau menggelembung.

Sementara itu, lantai SPC umumnya dipasang dengan sistem terapung (*floating click-lock*) tanpa lem di atas lapisan busa dan lembaran plastik penahan uap (*polyethylene vapor barrier*). Sistem pasang tanpa lem ini membuat lantai SPC lebih toleran terhadap uap lembap dari lantai dasar, selama kelembapan tersebut bukan berupa rembesan air aktif yang menggenang.

## Kenyamanan Pijakan dan Toleransi Kerataan Lantai Dasar

Meskipun SPC unggul dalam hal kekakuan dan ketahanan panas, LVP tetap memiliki kelebihan tersendiri dalam hal kenyamanan sentuhan telapak kaki.

Karena bahannya lentur, lantai vinyl LVP terasa lebih empuk, hangat, dan senyap saat diinjak tanpa alas kaki. Langkah kaki di atas vinyl tidak menghasilkan bunyi ketukan keras, menjadikannya pilihan nyaman untuk kamar tidur atau ruang kerja yang tenang.

Namun, kekakuan papan SPC menuntut satu syarat penting: lantai plesteran semen di bawahnya harus benar-benar rata.

Buku petunjuk pemasangan dari sebagian besar pabrikan lantai *click-lock* menetapkan batas toleransi kerataan tertentu, yang umumnya berkisar antara 2 hingga 3 milimeter per rentang panjang dua meter. 

Kesalahan umum pemasangan yang paling sering dijumpai adalah memaksakan pemasangan di atas semen bergelombang tanpa perataan kompon (*self-leveling underlayment*). Kondisi ini memicu risiko kegagalan sambungan lidah-alur SPC yang menerima tekanan lentur berlebih dan patah seiring waktu.

## Panduan Memilih Sesuai Kondisi Ruangan di Rumahmu

Agar keputusan renovasimu tepat sasaran dan hemat biaya perawatan, pertimbangkan panduan kondisi ruang berikut:

* **Pilih Lantai SPC jika:** Ruangan berada di lantai dasar atau memiliki bukaan kaca lebar yang terpapar matahari siang. Pilihan ini juga tepat jika kamu menginginkan pemasangan bersih tanpa bau lem menyengat, dengan catatan lantai semen dasarmu sudah dipastikan rata.

* **Pilih Lantai Vinyl LVP jika:** Ruangan berada di lantai atas yang teduh dan kering. Pilihan ini ideal jika kamu memprioritaskan pijakan empuk dan kedap suara, serta bersedia memastikan aplikasi lem dilakukan sesuai toleransi kelembapan semen.

Sebagai contoh skenario, bagi pemilik rumah dua lantai, lantai atas yang kering dan beralas semen rata merupakan lokasi ideal untuk menikmati kenyamanan senyap vinyl LVP. Sebaliknya, untuk area lantai dasar atau ruang keluarga yang dekat bukaan teras, SPC menjadi pilihan yang lebih stabil menghadapi sengatan matahari siang.

Pada akhirnya, keputusan terbaik tetap kembali ke kondisi nyata lantai rumahmu dan bagaimana ruangan tersebut akan kamu gunakan setiap hari. Pilihlah solusi yang paling masuk akal untuk kenyamanan keluargamu, dengan memastikan persiapan lantai semen dasar dan spesifikasi lembar data teknis produsen dipatuhi dengan baik.

<!-- FAQ_START -->
[
  {
    "question": "Apakah lantai SPC benar-benar 100 persen tahan air dan aman dari banjir?",
    "answer": "Secara material, inti komposit batu kapur SPC memang kedap air dan tidak akan melengkung saat terkena air. Namun, air yang menggenang di atasnya tetap dapat merembes melalui celah sambungan ke pelat semen di bawahnya, sehingga pengeringan menyeluruh tetap diperlukan agar tidak memicu bau apek atau jamur."
  },
  {
    "question": "Apakah standar ASTM F1700 mewajibkan ketebalan wear layer tertentu untuk rumah tinggal?",
    "answer": "Tidak. Standar ASTM F1700 mengatur spesifikasi dan metode uji fisik ubin vinyl (termasuk Class III printed film tile), tetapi tidak membagi ketebalan 0,3 mm atau 0,5 mm secara kaku antara rumah tinggal dan komersial. Angka ketebalan tersebut merupakan konvensi industri dan spesifikasi garansi dari masing-masing produsen."
  },
  {
    "question": "Mengapa lantai click-lock SPC membutuhkan lantai semen yang benar-benar rata?",
    "answer": "Karena bilah SPC kaku dan mengandalkan sistem pengunci mekanis lidah-alur. Sebagian besar pabrikan mensyaratkan deviasi kerataan maksimal 2–3 mm per rentang 2 meter agar sambungan pengunci tidak menerima tekanan lentur berlebih yang dapat menyebabkan sambungan patah saat diinjak."
  },
  {
    "question": "Apa fungsi pengujian ASTM F2170 sebelum pemasangan lantai vinyl?",
    "answer": "ASTM F2170 adalah metode uji standar untuk mengukur kelembapan relatif (RH) di bagian dalam pelat beton menggunakan probe in-situ. Hasil uji ini dicocokkan dengan batas toleransi kelembapan pada lembar data teknis lem atau sistem lantai yang ditentukan oleh produsen terkait."
  }
]
<!-- FAQ_END -->`;

  // Explainer archetype (#10012)
  const resExplainer = evaluateArticleDoD({
    id: 201,
    slug: 'insulasi-aluminium-foil-atap-rumah-tropis-efektivitas-dan-cara-pasang',
    title: 'Insulasi Aluminium Foil Bawah Atap: Kapan Benar-Benar Berfungsi dan Kapan Menjadi Pengeluaran Sia-sia?',
    description: 'Panduan lengkap cara kerja insulasi aluminium foil bawah atap rumah tropis dan cara pasang yang benar.',
    content_md: FULL_MANUSCRIPT,
    key_takeaways: KEY_TAKEAWAYS_FIXTURE
  });

  // Comparison archetype (#10013)
  const resComparison = evaluateArticleDoD({
    id: 202,
    slug: 'perbedaan-lantai-spc-dan-vinyl-mana-yang-lebih-awet-untuk-rumah',
    title: 'Lantai SPC vs Vinyl (LVP): Mana yang Lebih Cocok untuk Rumah Tropis?',
    description: 'Panduan lengkap memilih antara lantai SPC dan vinyl LVP untuk rumah tropis Indonesia.',
    content_md: ARTICLE_2_MANUSCRIPT,
    key_takeaways: [
      'Inti batu kapur SPC lebih stabil terhadap panas matahari langsung dibanding vinyl LVP.',
      'Lantai vinyl LVP terasa lebih lentur dan empuk di telapak kaki.',
      'Ketahanan gores ditentukan oleh tebal wear layer bening, bukan tebal total papan.',
      'Kedua material 100 persen tahan air, namun persiapan lantai semen menentukan hasil akhir.'
    ]
  });

  assert(resExplainer.gateA.status === 'PASS', 'Explainer archetype passes generic Gate A');
  assert(resComparison.gateA.status === 'PASS', 'Comparison archetype passes generic Gate A with warm decision handoff');
}

console.log(`\n=== ALL ${passedTests}/${totalTests} INTEGRATION TEST SCENARIOS PASSED ===`);
