/**
 * RancangLoka Editorial Human Quality Benchmark Corpus
 * Milestone: EDITORIAL-HUMAN-QUALITY-2
 *
 * Deterministic corpus of representative article drafts with editorial gold labels.
 * Used to empirically calibrate the Human Writing Quality engine, verify
 * decision thresholds (85/75/0), prevent false positives/negatives, and enforce
 * hard-fail integrity rules without altering editorial standards.
 *
 * NOTE: All product models, dimensions, and hardware specs in synthetic fixtures
 * are marked explicitly as [ILLUSTRATIVE_EXAMPLE_ONLY] and must never be treated
 * as factual engineering knowledge.
 */

import type { HumanWritingDecision, EvaluationOptions } from './human-quality.ts';

export type BenchmarkSplit = 'CALIBRATION' | 'HOLDOUT';
export type BenchmarkCategory = 'GENERAL_EDITORIAL' | 'PRODUCT_REVIEW';

export interface EditorialGoldLabel {
  expected_decision: HumanWritingDecision;
  expected_score_range: [number, number];
  expected_major_issues: string[];
  expected_integrity_violations: string[];
  expected_role_owner: 'content_writer_primary' | 'evidence_researcher_lead' | 'editorial_qa_primary' | 'publication_dispatcher_core';
  requires_evidence_recheck: boolean;
  hard_fail_expected: boolean;
  notes: string;
}

export interface BenchmarkFixture {
  id: string;
  title: string;
  category: BenchmarkCategory;
  split: BenchmarkSplit;
  content: string;
  gold_label: EditorialGoldLabel;
  options?: EvaluationOptions;
}

// ============================================================================
// FIXTURE A: Strong Human Editorial Article (General, Calibration)
// ============================================================================
const FIXTURE_A_CONTENT = `# Mengatasi Talang Air Dak Beton Bocor Saat Hujan Tropis Ekstrem

Bagi pemilik rumah di Indonesia, suara gemuruh hujan lebat di atas dak beton sering kali bukan membawa ketenangan, melainkan kecemasan. Kekhawatiran bahwa air hujan yang mengantong di sudut atap akan mulai merembes, meninggalkan bercak kekuningan di plafon kamar tidur, adalah kenyataan pahit yang dihadapi ribuan keluarga setiap musim penghujan.

Masalah kebocoran dak beton hampir tidak pernah disebabkan oleh satu faktor tunggal. Dari pengamatan teknis lapangan, sebagian besar kegagalan berakar pada kemiringan (*slope*) yang tidak memadai—kurang dari 1 hingga 2 persen ke arah corong pembuangan (*roof drain*). Air yang menggenang lebih dari 48 jam akan melunakkan lapisan waterproofing semen konvensional, memicu degradasi polimerik, dan mencari retak rambut sekecil apa pun untuk merembes masuk ke dalam struktur plat lantai.

## Diagnosis Akar Masalah: Genangan vs Pergerakan Termal

Langkah pertama sebelum membeli material pelapis apa pun adalah memeriksa kondisi fisik permukaan beton di pagi hari setelah hujan reda:

1. **Retak Rambut Akibat Muai-Susut:** Beton Indonesia terpapar panas matahari terik hingga 38 derajat Celsius di siang hari lalu tersiram hujan mendadak. Perbedaan suhu drastis ini menimbulkan tegangan tarik yang melampaui elastisitas plesteran standar.
2. **Kapasitas Lubang Pembuangan Kurang:** Pipa pembuangan berdiameter 2 inci sering kali tidak mampu menampung debit hujan tropis berintensitas di atas 70 mm/jam, menyebabkan air meluap melampaui bibir talang (*flashing*).

## Pilihan Perbaikan Berdasarkan Tingkat Kerusakan

Jika kebocoran masih berupa rembesan tipis tanpa keretakan struktural tembus, pembersihan lumut dengan sikat kawat dan aplikasi waterproofing fleksibel berbahan dasar semen dua komponen (kopolimer akrilik) setebal minimal 1,5 mm adalah langkah paling rasional. Formula ini memiliki ketahanan rendam yang jauh lebih unggul dibanding pelapis emulsi bitumen yang mudah menggelembung (*blistering*) bila terperangkap uap air dari bawah.

Namun jika dak beton Anda mengalami genangan permanen lebih dari 3 cm, melapisi ulang waterproofing saja hanya membuang biaya. Anda wajib membuat lapisan screed baru menggunakan campuran semen-pasir 1:3 yang diperkaya bonding agent sintetis untuk mengembalikan kemiringan minimal 1:50 langsung menuju pipa buang.

## Rekomendasi untuk Kondisi Rumah Anda

- **Pilih pelapis semen 2-komponen fleksibel:** Jika dak Anda berfungsi sebagai area jemur terbuka yang sesekali diinjak dan terkena panas langsung.
- **Pilih membran bakar berpasir:** Jika dak memiliki bentang luas di atas 50 m² dengan risiko pergerakan sambungan dilatasi yang dinamis.
- **Tahap berikutnya:** Sebelum memulai pelapisan, pastikan kadar kelembapan beton di bawah 5 persen menggunakan moisture meter, dan selalu buat sudut konus (*chamfer/fillet*) 5 cm pada pertemuan antara lantai dak dan dinding pembatas agar membran tidak tertekuk tajam.`;

// ============================================================================
// FIXTURE B: AI-Like Mechanical Article (General, Calibration)
// ============================================================================
const FIXTURE_B_CONTENT = `# Memilih Material Rangka Atap Rumah

Di era modern saat ini, memilih material yang tepat merupakan hal yang sangat penting dalam membangun hunian idaman yang kokoh dan aman. Rumah adalah tempat perlindungan bagi setiap keluarga. Oleh karena itu, kita harus cermat dalam menentukan pilihan rangka atap.

Pada dasarnya, setiap material atap tentu memiliki kelebihan dan kekurangan masing-masing yang perlu dipahami secara mendalam.

## Memahami Rangka Atap Kayu

Rangka kayu memiliki kelebihan dan kekurangan yang perlu dipertimbangkan secara matang:
- Kayu memberikan tampilan alami yang hangat dan estetis.
- Kayu mudah dibentuk oleh tukang bangunan setempat.
- Kayu rentan terhadap serangan hama rayap yang merusak.

Selain itu, kayu membutuhkan perawatan berkala agar tetap awet dan tahan lama.

## Memahami Rangka Baja Ringan

Rangka baja ringan memiliki kelebihan dan kekurangan yang perlu dipertimbangkan secara matang:
- Baja ringan tahan terhadap karat dan serangan rayap.
- Baja ringan memiliki bobot yang ringan dan kuat.
- Pemasangan baja ringan membutuhkan sekrup khusus dan keahlian.

Di sisi lain, baja ringan dapat menjadi pilihan yang menarik untuk rumah masa kini.

## Memahami Rangka Atap Baja Berat

Rangka baja berat memiliki kelebihan dan kekurangan yang perlu dipertimbangkan secara matang:
- Baja berat sangat kokoh untuk bentang bangunan yang lebar.
- Baja berat tahan terhadap beban berat dan cuaca ekstrem.
- Biaya pemasangan baja berat membutuhkan alat berat dan modal besar.

Oleh karena itu, semua pilihan kembali pada kebutuhan masing-masing.

Secara keseluruhan artikel ini telah membahas berbagai macam rangka atap yang ada di pasaran saat ini.`;

// ============================================================================
// FIXTURE C: Borderline Article (General, Calibration)
// ============================================================================
const FIXTURE_C_CONTENT = `# Solusi Peredam Suara Dinding Kamar Tidur Rumah Dekat Jalan Raya

Tinggal di dekat jalan raya arteri sering kali membuat waktu istirahat malam terganggu oleh suara knalpot bising dan desing roda truk kontainer. Kebisingan di atas 65 desibel secara konsisten dapat meningkatkan stres dan menurunkan kualitas tidur keluarga.

Suara bising merambat melalui dua jalur utama yaitu rambatan udara (*airborne noise*) dan rambatan struktur (*structure-borne noise*). Dinding bata merah setengah bata plesteran standar dengan ketebalan 15 cm umumnya hanya memiliki insulasi suara sekitar 42 dB STC (*Sound Transmission Class*). Angka ini masih meloloskan frekuensi rendah dari mesin kendaraan berat.

Untuk meredam kebisingan ini secara efektif tanpa meruntuhkan dinding lama, Anda dapat memasang sistem dinding ganda (*drywall furring system*) pada sisi dalam kamar tidur. Sistem ini menggunakan rangka baja ringan hollow 4x4 cm yang diberi jeda udara 3 cm dari dinding bata eksisting.

Di dalam rongga rangka hollow tersebut, selipkan lembaran rockwool dengan densitas minimal 60 kg/m³ dan ketebalan 50 mm. Selanjutnya, tutup rangka menggunakan dua lapis papan gypsum akustik tebal 12,5 mm dengan sambungan bertingkat (*staggered joint*) yang direkatkan compound kedap suara.

Pemasangan peredam dinding ini membutuhkan perhatian khusus pada celah sambungan lantai dan plafon. Celah sekecil 2 mm di bawah dinding partisi dapat membocorkan suara hingga 30 persen dari efektivitas insulasi total. Gunakan sealant akustik non-hardening pada seluruh keliling perimeter partisi.

Kesimpulannya, meredam suara kamar tidur memerlukan pemasangan rockwool densitas 60 kg/m3 dan gypsum rangkap serta penutupan celah dengan sealant akustik sebagaimana telah dijelaskan di atas.`;

// ============================================================================
// FIXTURE D: Evidence-Strong but Emotionally Flat Article (General, Holdout)
// ============================================================================
const FIXTURE_D_CONTENT = `# Analisis Densitas dan Konduktivitas Termal Bata Ringan vs Bata Merah

Efisiensi energi termal pada selubung bangunan hunian tropis ditentukan oleh nilai hambatan panas (*thermal resistance* / R-value) dari material dinding pengisi. Standar Nasional Indonesia SNI 03-6861.1 menetapkan persyaratan spesifikasi bata merah bakar, sementara SNI 8640:2018 mengatur spesifikasi bata beton aerasi berautoklaf (Autoclaved Aerated Concrete / AAC).

Bata merah pejal memiliki massa jenis rata-rata 1.600 hingga 1.800 kg/m³ dengan konduktivitas termal ($\lambda$) sekitar 0,80 W/m·K. Sebaliknya, bata ringan AAC tipe standar memiliki massa jenis kering 550 hingga 650 kg/m³ dengan konduktivitas termal berkisar 0,14 hingga 0,16 W/m·K. Struktur gelembung udara mikro tertutup pada matriks AAC menghasilkan isolasi termal sekitar lima kali lebih tinggi dibandingkan bata lempung konvensional dengan ketebalan yang sama (100 mm).

Dalam kondisi radiasi matahari langsung pada dinding barat dengan intensitas puncak 800 W/m², perpindahan panas melalui dinding bata merah menghasilkan suhu permukaan dalam ruangan rata-rata 34,2 derajat Celsius pada pukul 16:30 WIB. Sebagai perbandingan, dinding bata ringan AAC 100 mm dengan plesteran semen instan setebal 10 mm menghasilkan suhu permukaan dalam 30,8 derajat Celsius dengan lag waktu penundaan panas (*time lag*) selama 5,5 jam.

Secara struktural, kuat tekan bata merah mutu III menurut SNI berada pada rentang 2,5 hingga 5,0 MPa, sedangkan bata ringan AAC mutu 4 memiliki kuat tekan rata-rata 4,0 MPa. Bobot dinding terpasang bata ringan (sekitar 110 kg/m² termasuk plesteran acian tipis) mengurangi beban gempa inersia struktur gedung hingga 50 persen jika dibandingkan dinding bata merah setengah bata (sekitar 230 kg/m²).

Pertimbangan teknis pemilihan:
- Prioritaskan bata ringan AAC jika beban pondasi tanah lunak terbatas dan pengurangan transfer panas sore hari menjadi target utama.
- Prioritaskan bata merah pada area basah lantai dasar atau dinding penahan tanah yang berhadapan langsung dengan kelembapan tanah kapiler tinggi tanpa lapisan waterproofing khusus.
- Pastikan penggunaan semen instan khusus (thin bed mortar) dengan ketebalan 3 mm pada pemasangan AAC untuk mencegah jembatan termal (*thermal bridging*).`;

// ============================================================================
// FIXTURE E: Human-Sounding but Evidence-Weak Article (General, Calibration)
// ============================================================================
const FIXTURE_E_CONTENT = `# Kehangatan Nuansa Kayu di Dapur Terbuka Rumah Idaman

Menghirup aroma kopi di pagi hari sambil memandang dapur terbuka beraksen kayu adalah impian banyak pemilik rumah. Suasana hangat serat kayu alami memberikan kedamaian tersendiri yang tidak bisa digantikan oleh kilau dingin keramik atau logam pabrikan. Dapur bukan lagi sekadar tempat memasak, melainkan jantung kebahagiaan seluruh anggota keluarga.

Namun merawat kayu di area dapur belakang memerlukan perhatian penuh cinta. Minyak goreng yang memercik, uap masakan sambal yang mengepul, dan tempias air hujan saat angin kencang berhembus bisa menjadi tantangan berat bagi keindahan lemari dapur Anda. Banyak orang merasa takut kayunya akan cepat kusam atau dimakan rayap.

Kunci utamanya adalah memilih kayu yang bagus dan kuat. Anda sebaiknya memilih kayu solid yang bermutu tinggi agar tidak mudah melengkung. Jangan memakai kayu sembarangan yang dijual murah di pinggir jalan karena kualitasnya sangat meragukan. Pastikan juga tukang kayu yang mengerjakan dapur Anda adalah tukang yang sudah sangat ahli dan berpengalaman.

Untuk melindunginya, oleskan cairan pelindung kayu secukupnya secara rutin setiap beberapa waktu sekali. Bersihkan tumpahan air dengan lap kering secepat mungkin agar air tidak meresap ke dalam pori-pori kayu. Bila Anda merawatnya dengan sepenuh hati, dapur kayu Anda akan selalu terlihat menawan dan membuat setiap tamu yang datang berdecak kagum.

Jagalah selalu kebersihan dapur Anda, dan nikmati setiap momen memasak bersama keluarga tercinta dalam kehangatan suasana rumah yang tenang.`;

// ============================================================================
// FIXTURE F: Lexically Inconsistent Article (General, Calibration)
// ============================================================================
const FIXTURE_F_CONTENT = `# Panduan Memilih Kusen Pintu dan Jendela Rumah Modern

Memilih bukaan rumah membutuhkan pertimbangan cermat antara daya tahan terhadap cuaca tropis dan kerapian arsitektur fasad. Banyak pemilik rumah merasa ragu saat harus memutuskan material terbaik untuk kusen aluminium mereka.

Kusen aluminium memiliki keunggulan utama dalam ketahanan terhadap serangan rayap tanah dan kelapukan akibat tempias hujan. Namun, saat memasang frame aluminium di lapangan, presisi siku bukaan dinding bata harus benar-benar terjaga. Jika lubang plesteran miring lebih dari 3 mm, bingkai aluminium akan tertekan dan kaca mati rentan pecah saat pemuaian siang hari.

Banyak kontraktor memilih sistem bingkai logam karena bobotnya yang ringan dan kecepatan instalasi. Tetapi jika Anda memutuskan memakai frame aluminium untuk pintu utama, perhatikan ketebalan profil ekstrusinya. Frame aluminium dengan ketebalan dinding di bawah 1,1 mm mudah melintir saat dipasangi engsel daun pintu kayu solid yang berat.

Selain itu, pemilihan aksesoris sekrup pada bingkai aluminium wajib menggunakan baja nirkarat (stainless steel) 304. Sekrup besi biasa yang bersentuhan langsung dengan kusen aluminium akan memicu korosi galvanik dalam waktu kurang dari dua tahun akibat kelembapan udara tropis.

Rekomendasi untuk rumah Anda:
- Gunakan kusen aluminium anodized tebal minimal 1,35 mm jika berada di kawasan pesisir dengan salinitas udara tinggi.
- Pastikan sealant pengisi antara kusen aluminium dan dinding menggunakan tipe neutral silicone agar tidak meninggalkan noda asam pada acian semen.`;

// ============================================================================
// FIXTURE G: Expert-Consultation Article (General, Calibration)
// ============================================================================
const FIXTURE_G_CONTENT = `# Solusi Mengatasi Rembesan Dinding Tetangga Tanpa Membongkar Total

Dinding rumah yang berbatasan langsung dengan tembok tetangga (*dinding bersama / party wall*) sering kali menjadi sumber masalah paling menguras emosi. Saat dinding kamar Anda mulai lembap, cat mengelupas, dan muncul bercak jamur hitam, Anda berada dalam posisi serba salah: dinding tersebut tidak bisa diplester dari luar karena terhalang bangunan tetangga, sementara membongkar total bukanlah opsi yang realistis.

## Mengidentifikasi Sumber Rembesan: Kapiler Bawah vs Retak Flashing

Sebelum memutuskan penanganan, kita harus mendiagnosis dari mana air masuk ke dalam pasangan bata:

1. **Rembesan dari Puncak Tembok (Bong-bongan):** Jika noda jamur muncul dari plafon turun ke bawah, air dipastikan masuk dari celah ban-banan atau seng flashing penutup sambungan atap kedua rumah yang retak termal.
2. **Kenaikan Kapiler Tanah (Rising Damp):** Jika cat melepuh hanya pada ketinggian 0 hingga 80 cm dari lantai, air berasal dari kelembapan tanah yang naik karena lapisan trasram semen kedap air rusak atau tidak terpasang saat konstruksi awal.

## Menimbang Pilihan dan Kompromi Perbaikan

Jika masalahnya adalah retak pada ban-banan atas, meminta izin baik-baik kepada tetangga untuk memasang flashing pelat seng aluminium selebar 40 cm dengan sealant poliuretan adalah solusi permanen termurah.

Namun jika rembesan terjadi merata pada badan dinding karena dinding tetangga tidak diplester (bata telanjang), perbaikan dari dalam adalah satu-satunya jalan keluar yang realistis:
- **Metode Injeksi Kristalisasi:** Menyuntikkan cairan waterproofing kristalisasi kimia ke dalam lubang bor bata setiap jarak 15 cm. Metode ini mengkristal saat kontak dengan air dan menyumbat pori kapiler bata dari dalam, dengan trade-off biaya alat injeksi yang cukup tinggi.
- **Metode False Wall Berventilasi:** Membuat dinding partisi kalsium silikat tipis berjarak 4 cm di depan dinding lembap, lengkap dengan kisi ventilasi silang kecil di bawah dan atas. Dinding lembap dibiarkan bernapas tanpa merusak estetika kamar tidur Anda.

## Rekomendasi untuk Kondisi Anda

- **Jika rembesan bersifat musiman saat hujan lebat:** Perbaiki flashing sambungan atap di lantai atas menggunakan membran berperekat aspal dengan lapisan aluminium foil.
- **Jika dinding lembap sepanjang tahun:** Buat sistem false wall kalsium silikat tahan air dengan isolasi sirkulasi udara agar kamar tidur tetap sehat dan bebas spora jamur berbahaya.
- **Langkah segera:** Kelupas cat lama yang berjamur hingga tampak plesteran asli, lalu semprotkan cairan fungisida anti-lumut sebelum memulai pekerjaan insulasi interior.`;

// ============================================================================
// FIXTURE H: Generic SEO Article (General, Holdout)
// ============================================================================
const FIXTURE_H_CONTENT = `# Jasa Renovasi Rumah Murah Terbaik di Jakarta

Di era modern saat ini, mencari jasa renovasi rumah murah terbaik di Jakarta merupakan impian bagi semua pemilik rumah yang ingin memperbaiki hunian mereka. Memilih jasa renovasi rumah murah terbaik di Jakarta yang tepat sangatlah krusial untuk menghemat anggaran pembangunan Anda.

Bagi Anda yang sedang mencari jasa renovasi rumah murah terbaik di Jakarta, ada beberapa tips penting yang perlu Anda perhatikan secara seksama:

## Tips Memilih Jasa Renovasi Rumah Murah Terbaik di Jakarta

1. Pastikan kontraktor memiliki portofolio proyek yang jelas dan terpercaya di wilayah Jakarta.
2. Bandingkan penawaran harga dari beberapa vendor jasa renovasi rumah murah terbaik di Jakarta.
3. Buat kontrak kerja yang jelas mencakup batas waktu dan rincian pekerjaan renovasi rumah.

Selain itu, Anda juga harus selalu memantau jalannya pekerjaan renovasi agar tidak terjadi pembengkakan biaya di kemudian hari. Di sisi lain, menggunakan tukang berpengalaman akan membuat hasil renovasi lebih rapi dan memuaskan.

Oleh karena itu, pilihlah jasa renovasi rumah murah terbaik di Jakarta yang benar-benar berkomitmen melayani kebutuhan Anda dengan sepenuh hati.

Kesimpulannya, merenovasi rumah idaman di Jakarta dapat berjalan lancar jika Anda memilih kontraktor yang profesional dan terpercaya.`;

// ============================================================================
// FIXTURE I: Strong Analytical Review (Product Review, Calibration)
// ============================================================================
const FIXTURE_I_CONTENT = `# [ILLUSTRATIVE_EXAMPLE_ONLY] Tinjauan Spesifikasi Smart Lock Seri-K500 Varian Mortise 5050

*Tinjauan Spesifikasi & Analisis Produk — Berdasarkan dokumentasi resmi pabrikan, sertifikasi standar pengujian, dan agregasi sinyal pengguna nyata. Redaksi tidak melakukan pengujian fisik langsung untuk artikel ini.*

Memasang kunci pintu digital sering kali menimbulkan keraguan teknis bagi pemilik rumah: apakah bodi kuncinya muat di pintu kayu lama, dan apakah sensor sidik jarinya tetap dapat diandalkan saat jari anak-anak agak basah setelah mencuci tangan? Tinjauan analitis ini mengevaluasi model Smart Lock Seri-K500 varian Mortise 5050 resmi Indonesia dengan firmware BLE versi 2.1.

## Terjemahan Spesifikasi Teknis ke Konsekuensi Rumah

- **Bodi Kunci Mortise 5050 Stainless Steel 304:** Standar mortise 5050 berarti kedalaman backset lubang kunci adalah 50 mm dengan jarak antar-lubang 50 mm. Material baja SUS304 pada lidah pengunci (*deadbolt*) memberikan ketahanan fisik tinggi terhadap upaya congkel paksa, namun menuntut ketebalan daun pintu kayu minimal 38 mm hingga 50 mm agar struktur kayu di sekitar lubang bobokan tidak pecah.
- **Sensor Sidik Jari Semikonduktor 508 DPI:** Resolusi optik 508 DPI mampu membaca guratan sidik jari dengan waktu identifikasi nominal di bawah 0,5 detik. Namun, teknologi semikonduktor kapasitif ini sangat sensitif terhadap sisa minyak atau air pada permukaan sensor, sehingga jari yang basah kuyup memerlukan pengeringan terlebih dahulu sebelum verifikasi berhasil.
- **Konektivitas Bluetooth Rendah Daya (BLE 5.0):** Penggunaan Bluetooth lokal menghemat konsumsi 4 baterai alkaline AA hingga 8–10 bulan pemakaian normal keluarga. Konsekuensinya, fitur buka kunci jarak jauh tidak dapat dioperasikan secara mandiri tanpa membeli unit Wi-Fi gateway bridge tambahan.

## Evaluasi Dimensi Kompatibilitas Fisik

Sebelum memesan perangkat ini, periksa tiga batasan arsitektur pintu Anda:
1. **Lebar Stile Kusen:** Membutuhkan lebar profil tegak pintu minimal 90 mm untuk menampung pelat muka kunci selebar 22 mm dan rumah gagang pintu.
2. **Material Pintu:** Sangat ideal untuk kayu solid (kamper, jati, merbau) atau engineered wood solid-core; tidak cocok untuk pintu hollow berongga sarang lebah (*honeycomb*) tanpa balok penguat tambahan di area mortise.

## Sinyal Kinerja Nyata & Pola Keluhan Pengguna

Agregasi sinyal dari puluhan pembeli terverifikasi menunjukkan kepuasan tinggi terhadap kecepatan sensor sidik jari dan kualitas pelapisan cat matte yang tidak mudah tergores kunci motor. Namun, terdapat satu pola keluhan berulang yang konsisten dilaporkan: proses pairing awal pada aplikasi Android versi tertentu kerap membutuhkan restart Bluetooth ponsel sebanyak dua hingga tiga kali sebelum sinkronisasi kunci berhasil.

## Keterbatasan & Trade-Off yang Wajib Diterima

- **Ketiadaan Wi-Fi Bawaan:** Anda tidak mendapatkan notifikasi pembukaan pintu saat berada di luar rumah kecuali menambah gateway bridge seharga sekitar sepertiga harga perangkat.
- **Ketergantungan Baterai Manual:** Saat indikator baterai menipis berbunyi, Anda wajib segera mengganti baterai dalam kurun 7 hari sebelum kunci beralih ke port darurat USB mikro di bagian bawah.

## Penilaian RancangLoka & Rekomendasi Akhir

- **Cocok untuk:** Pemilik rumah dengan pintu kayu solid tebal 40 mm yang memprioritaskan keamanan fisik bodi baja 304 dan kemudahan akses sidik jari tanpa kerepotan langganan cloud.
- **Kurang cocok untuk:** Pintu aluminium tipis ramping di bawah 80 mm, atau penghuni yang mewajibkan fitur remote monitoring dari luar kota tanpa membeli aksesoris jembatan tambahan.
- **Pertimbangan sebelum membeli:** Ukur jarak backset lubang kunci lama Anda dari tepi daun pintu; jika pintu lama menggunakan mortise 6068, Anda memerlukan penambalan lubang kayu sebelum memasang varian 5050 ini.`;

// ============================================================================
// FIXTURE J: Specification Dump (Product Review, Calibration)
// ============================================================================
const FIXTURE_J_CONTENT = `# [ILLUSTRATIVE_EXAMPLE_ONLY] Ulasan Teknis CCTV Outdoor 4MP Seri Pro-X

CCTV Outdoor Seri Pro-X adalah perangkat kamera pengawas yang memiliki banyak keunggulan spesifikasi untuk rumah Anda.

Spesifikasi perangkat ini meliputi:
- Resolusi sensor 4 Megapixel 2560x1440 piksel
- Ukuran sensor optik 1/3 inci CMOS progressive scan
- Lensa fixed focal length 2.8mm dengan sudut pandang 104 derajat horizontal
- Kompresi video format H.265 / H.264 dual stream
- Kecepatan frame rate 25 fps pada resolusi penuh
- Jarak jangkauan infra merah malam 30 meter dengan Smart IR
- Slot kartu memori micro SD kapasitas maksimal 256 GB
- Protokol jaringan TCP/IP, ICMP, HTTP, HTTPS, DHCP, DNS, DDNS, RTP, RTSP
- Port ethernet RJ-45 10/100 Mbps auto negotiation
- Konsumsi daya maksimum 6.5 Watt dengan tegangan DC 12 Volt atau PoE 802.3af
- Suhu operasional -30 derajat sampai 60 derajat Celsius dengan kelembapan 95 persen
- Sertifikasi ketahanan air dan debu rating IP67
- Dimensi fisik 70 mm x 150 mm dengan berat bersih 400 gram

Produk ini sangat lengkap dan memiliki performa yang sangat bagus untuk keamanan rumah Anda.`;

// ============================================================================
// FIXTURE K: Affiliate-Biased Review (Product Review, Holdout)
// ============================================================================
const FIXTURE_K_CONTENT = `# [ILLUSTRATIVE_EXAMPLE_ONLY] Rekomendasi Pompa Air Pendorong Terbaik untuk Rumah

Apakah air shower kamar mandi Anda mengalir kecil dan lambat? Jangan khawatir! Pompa Air Booster Seri Jet-900 adalah pompa pendorong terbaik nomor satu di Indonesia yang wajib Anda miliki sekarang juga.

[>> KLIK DI SINI UNTUK BELI SEKARANG DI TOKOPEDIA DISKON 50% <<]
[>> BELI SEKARANG DI SHOPEE MUMPUNG PROMO GRATIS ONGKIR <<]

Pompa ini sangat sempurna tanpa ada kekurangan sedikit pun. Suaranya sangat hening seperti bisikan dan semprotannya sangat dahsyat. Semua orang yang memakai pompa ini pasti sangat puas dan tidak pernah mengeluh sama sekali. 

Spesifikasi pompa ini memiliki daya dorong 30 meter dan kapasitas air 60 liter per menit dengan daya listrik hanya 125 watt. Bahan bodinya terbuat dari material komposit super canggih yang anti karat selamanya.

Keunggulan Pompa Jet-900:
- Harga sangat murah dan terjangkau
- Kualitas bintang lima terbaik di kelasnya
- Pemasangan sangat mudah tanpa tukang
- Garansi resmi sangat panjang

Jangan tunda lagi, segera checkout produk terbaik ini sebelum kehabisan stok promosi terbatas!

[>> KLIK BELI SEKARANG DI OFFICIAL STORE DENGAN VOUCHER CASHBACK <<]`;

// ============================================================================
// FIXTURE L: Fake Hands-On Review (Product Review, Calibration)
// ============================================================================
const FIXTURE_L_CONTENT = `# [ILLUSTRATIVE_EXAMPLE_ONLY] Ulasan Kunci Pintu Digital Seri-Z200

*Ulasan pengujian komprehensif kunci pintu digital untuk hunian modern.*

Dalam pengujian kami selama tiga minggu terakhir di kantor redaksi, kami sudah mencoba memasang kunci pintu digital Seri-Z200 ini pada pintu kayu jati setebal 45 mm. Hasil tes kami membuktikan bahwa sensor sidik jarinya bereaksi sangat cepat.

Saat kami pasang di laboratorium kami, unit uji kami menunjukkan daya tahan baterai yang sangat mengesankan setelah digunakan selama 21 hari berturut-turut dengan frekuensi buka tutup lebih dari 100 kali per hari. Kami merasakannya sendiri betapa mulusnya putaran gagang pintunya.

Kunci ini memiliki spesifikasi mortise stainless steel dengan silinder kunci mekanis Grade B. Konektivitas menggunakan Bluetooth dengan dukungan aplikasi mobile.

Rekomendasi RancangLoka:
Kunci ini sangat cocok untuk Anda yang menginginkan kemudahan akses harian tanpa anak kunci manual.`;

// ============================================================================
// FIXTURE M: Single-Complaint Overgeneralization (Product Review, Calibration)
// ============================================================================
const FIXTURE_M_CONTENT = `# [ILLUSTRATIVE_EXAMPLE_ONLY] Tinjauan Cat Dinding Eksterior WeatherShield Pro 5L

*Tinjauan Spesifikasi & Analisis Produk*

Cat eksterior memegang peranan krusial dalam melindungi acian plesteran dinding luar rumah dari rembesan hujan tropis dan sengatan sinar ultraviolet di Indonesia. Cat WeatherShield Pro berbasis emulsi akrilik 100% dengan klaim daya tahan cuaca hingga 8 tahun.

## Spesifikasi Teknis & Karakteristik Kimiawi

Cat ini memiliki kandungan *volatile organic compound* (VOC) rendah di bawah 50 g/L dengan daya sebar teoritis 10 hingga 12 m² per liter per lapis. Waktu kering sentuh tercatat 30 menit pada suhu 30 derajat Celsius, dengan jeda waktu pelapisan ulang minimal 2 jam.

Namun demikian, ada satu ulasan pembeli di marketplace yang mengeluhkan bahwa cat ini menggelembung dan rontok setelah tiga minggu diaplikasikan pada dinding pagar rumahnya. Oleh karena itu, kita dapat menyimpulkan bahwa produk ini memiliki cacat formulasi parah dan seluruh batch produksinya tidak layak dibeli oleh masyarakat karena kualitas adhesinya yang buruk.

## Rekomendasi Akhir

Sebaiknya pembaca menghindari cat ini dan mencari alternatif merek lain karena adanya ulasan komplain pembeli yang membuktikan kegagalan produk secara fatal di lapangan.`;

// ============================================================================
// FIXTURE N: Compatibility-Blind Review (Product Review, Holdout)
// ============================================================================
const FIXTURE_N_CONTENT = `# [ILLUSTRATIVE_EXAMPLE_ONLY] Panduan Pembelian Paket Panel Surya Rumah 1000W On-Grid

*Tinjauan Analitis Paket Panel Surya Hunian*

Meningkatnya tarif listrik PLN mendorong banyak pemilik rumah untuk melirik pemanfaatan energi surya melalui sistem fotovoltaik atap. Paket Panel Surya 1000W On-Grid hadir sebagai solusi populer bagi penghematan tagihan listrik siang hari.

Sistem ini terdiri dari empat modul panel surya monokristalin 250 Watt-peak (Wp) dengan efisiensi sel 20,4 persen, dilengkapi inverter grid-tie berefisiensi konversi 97,5 persen dengan rentang tegangan MPPT 80–300 Volt DC. Pada kondisi radiasi sinar matahari puncak selama rata-rata 4 jam di Indonesia, paket ini mampu menghasilkan energi listrik sekitar 3,5 hingga 4,0 kWh per hari.

Paket ini sangat kami rekomendasikan untuk segera dipasang oleh semua pemilik rumah di perkotaan karena dapat memangkas tagihan listrik hingga 30 persen setiap bulan. Sistem on-grid ini langsung mengalirkan listrik ke peralatan rumah tanpa memerlukan baterai penyimpan yang mahal.

## Rekomendasi Akhir

Jika Anda ingin menghemat listrik bulanan, paket 1000W ini adalah opsi yang sangat menarik dan hemat biaya untuk dibeli sekarang juga.`;

// ============================================================================
// Master Benchmark Corpus Collection
// ============================================================================

export const BENCHMARK_CORPUS: BenchmarkFixture[] = [
  // --- GENERAL EDITORIAL FIXTURES (Calibration: A, B, C, E, F, G | Holdout: D, H) ---
  {
    id: 'A_STRONG_HUMAN_EDITORIAL',
    title: 'Mengatasi Talang Air Dak Beton Bocor Saat Hujan Tropis Ekstrem',
    category: 'GENERAL_EDITORIAL',
    split: 'CALIBRATION',
    content: FIXTURE_A_CONTENT,
    gold_label: {
      expected_decision: 'HUMAN_WRITING_PASS',
      expected_score_range: [85, 100],
      expected_major_issues: [],
      expected_integrity_violations: [],
      expected_role_owner: 'content_writer_primary',
      requires_evidence_recheck: false,
      hard_fail_expected: false,
      notes: 'Artikel rujukan mutu editorial: ritme kalimat alami, kohesi leksikal kuat, konsultasi ahli ke klien, diagnosa sebelum preskripsi, rekomendasi bersyarat.'
    }
  },
  {
    id: 'B_AI_MECHANICAL',
    title: 'Memilih Material Rangka Atap Rumah',
    category: 'GENERAL_EDITORIAL',
    split: 'CALIBRATION',
    content: FIXTURE_B_CONTENT,
    gold_label: {
      expected_decision: 'HUMAN_WRITING_REWRITE',
      expected_score_range: [0, 74],
      expected_major_issues: [
        'GENERIC_OPENING_DETECTED',
        'REPETITIVE_TRANSITIONS_OVERUSED',
        'STRUCTURAL_SYMMETRY_DETECTED',
        'EMPTY_GENERALIZATIONS_FOUND'
      ],
      expected_integrity_violations: [],
      expected_role_owner: 'content_writer_primary',
      requires_evidence_recheck: false,
      hard_fail_expected: false,
      notes: 'Naskah mekanis formulaik AI: pembuka klise, transisi repetitif, simetri butir 3x3x3, generalisasi kosong, penutup merangkum diri sendiri.'
    }
  },
  {
    id: 'C_BORDERLINE_DRAFT',
    title: 'Solusi Peredam Suara Dinding Kamar Tidur Rumah Dekat Jalan Raya',
    category: 'GENERAL_EDITORIAL',
    split: 'CALIBRATION',
    content: FIXTURE_C_CONTENT,
    gold_label: {
      expected_decision: 'HUMAN_WRITING_REVISE',
      expected_score_range: [75, 84],
      expected_major_issues: ['ARTIFICIAL_CONCLUSION_SUMMARY_ONLY'],
      expected_integrity_violations: [],
      expected_role_owner: 'content_writer_primary',
      requires_evidence_recheck: false,
      hard_fail_expected: false,
      notes: 'Informasi teknis sangat solid, namun penutup hanya merangkum isi dan membutuhkan penyempurnaan alur keputusan.'
    }
  },
  {
    id: 'D_EVIDENCE_STRONG_EMOTION_FLAT',
    title: 'Analisis Densitas dan Konduktivitas Termal Bata Ringan vs Bata Merah',
    category: 'GENERAL_EDITORIAL',
    split: 'HOLDOUT',
    content: FIXTURE_D_CONTENT,
    gold_label: {
      expected_decision: 'HUMAN_WRITING_PASS',
      expected_score_range: [85, 100],
      expected_major_issues: [],
      expected_integrity_violations: [],
      expected_role_owner: 'content_writer_primary',
      requires_evidence_recheck: false,
      hard_fail_expected: false,
      notes: 'Naskah teknis padat standar SNI. Nada emosional terkontrol dan profesional (tenang), tidak boleh dipaksa melodramatis.'
    }
  },
  {
    id: 'E_NATURAL_PROSE_EVIDENCE_WEAK',
    title: 'Kehangatan Nuansa Kayu di Dapur Terbuka Rumah Idaman',
    category: 'GENERAL_EDITORIAL',
    split: 'CALIBRATION',
    content: FIXTURE_E_CONTENT,
    gold_label: {
      expected_decision: 'HUMAN_WRITING_REWRITE',
      expected_score_range: [0, 74],
      expected_major_issues: ['WEAK_EVIDENCE_SPECIFICITY', 'EMPTY_GENERALIZATIONS_FOUND'],
      expected_integrity_violations: [],
      expected_role_owner: 'evidence_researcher_lead',
      requires_evidence_recheck: true,
      hard_fail_expected: false,
      notes: 'Gaya bahasa mengalir dan hangat, tetapi minim bukti teknis, nol angka spesifikasi, dan nasihat tidak aplikatif. Gagal integritas bukti.'
    }
  },
  {
    id: 'F_LEXICALLY_INCONSISTENT',
    title: 'Panduan Memilih Kusen Pintu dan Jendela Rumah Modern',
    category: 'GENERAL_EDITORIAL',
    split: 'CALIBRATION',
    content: FIXTURE_F_CONTENT,
    gold_label: {
      expected_decision: 'HUMAN_WRITING_REVISE',
      expected_score_range: [75, 84],
      expected_major_issues: ['TERMINOLOGY_INCONSISTENCY_DETECTED'],
      expected_integrity_violations: [],
      expected_role_owner: 'content_writer_primary',
      requires_evidence_recheck: false,
      hard_fail_expected: false,
      notes: 'Variasi sinonim semu (kusen aluminium -> bingkai aluminium -> frame aluminium -> sistem bingkai logam) yang melanggar aturan same referent.'
    }
  },
  {
    id: 'G_EXPERT_CONSULTATION',
    title: 'Solusi Mengatasi Rembesan Dinding Tetangga Tanpa Membongkar Total',
    category: 'GENERAL_EDITORIAL',
    split: 'CALIBRATION',
    content: FIXTURE_G_CONTENT,
    gold_label: {
      expected_decision: 'HUMAN_WRITING_PASS',
      expected_score_range: [85, 100],
      expected_major_issues: [],
      expected_integrity_violations: [],
      expected_role_owner: 'content_writer_primary',
      requires_evidence_recheck: false,
      hard_fail_expected: false,
      notes: 'Model konsultasi ahli sempurna: empati situasi sulit, pemisahan akar masalah vs gejala, pertimbangan kompromi praktis, panduan aksi.'
    }
  },
  {
    id: 'H_GENERIC_SEO',
    title: 'Jasa Renovasi Rumah Murah Terbaik di Jakarta',
    category: 'GENERAL_EDITORIAL',
    split: 'HOLDOUT',
    content: FIXTURE_H_CONTENT,
    options: { focusKeyword: 'jasa renovasi rumah murah terbaik di Jakarta' },
    gold_label: {
      expected_decision: 'HUMAN_WRITING_REWRITE',
      expected_score_range: [0, 74],
      expected_major_issues: ['KEYWORD_FORCING_DETECTED', 'GENERIC_OPENING_DETECTED'],
      expected_integrity_violations: [],
      expected_role_owner: 'content_writer_primary',
      requires_evidence_recheck: false,
      hard_fail_expected: false,
      notes: 'Artikel SEO generik dengan keyword stuffing padat, nihil kedalaman substansi arsitektur.'
    }
  },

  // --- PRODUCT REVIEW FIXTURES (Calibration: I, J, L, M | Holdout: K, N) ---
  {
    id: 'I_STRONG_ANALYTICAL_REVIEW',
    title: '[ILLUSTRATIVE_EXAMPLE_ONLY] Tinjauan Spesifikasi Smart Lock Seri-K500 Varian Mortise 5050',
    category: 'PRODUCT_REVIEW',
    split: 'CALIBRATION',
    content: FIXTURE_I_CONTENT,
    options: {
      reviewType: 'ANALYTICAL_REVIEW',
      isProductReview: true,
      hasFirstPartyEvidence: false,
      affiliateCTAPosition: 'NONE'
    },
    gold_label: {
      expected_decision: 'HUMAN_WRITING_PASS',
      expected_score_range: [85, 100],
      expected_major_issues: [],
      expected_integrity_violations: [],
      expected_role_owner: 'content_writer_primary',
      requires_evidence_recheck: false,
      hard_fail_expected: false,
      notes: 'Ulasan analitis teladan: deklarasi transparan tanpa klaim fisik, translasi fitur-ke-konsekuensi, evaluasi kompatibilitas, keterbukaan keluhan, rekomendasi bersyarat.'
    }
  },
  {
    id: 'J_SPECIFICATION_DUMP',
    title: '[ILLUSTRATIVE_EXAMPLE_ONLY] Ulasan Teknis CCTV Outdoor 4MP Seri Pro-X',
    category: 'PRODUCT_REVIEW',
    split: 'CALIBRATION',
    content: FIXTURE_J_CONTENT,
    options: {
      reviewType: 'ANALYTICAL_REVIEW',
      isProductReview: true
    },
    gold_label: {
      expected_decision: 'HUMAN_WRITING_REWRITE',
      expected_score_range: [0, 74],
      expected_major_issues: ['SPEC_DUMP_WITHOUT_INTERPRETATION'],
      expected_integrity_violations: [],
      expected_role_owner: 'content_writer_primary',
      requires_evidence_recheck: false,
      hard_fail_expected: false,
      notes: 'Penumpukan spesifikasi pabrik tanpa terjemahan konsekuensi praktis bagi pemilik rumah.'
    }
  },
  {
    id: 'K_AFFILIATE_BIASED_REVIEW',
    title: '[ILLUSTRATIVE_EXAMPLE_ONLY] Rekomendasi Pompa Air Pendorong Terbaik untuk Rumah',
    category: 'PRODUCT_REVIEW',
    split: 'HOLDOUT',
    content: FIXTURE_K_CONTENT,
    options: {
      reviewType: 'ANALYTICAL_REVIEW',
      isProductReview: true,
      affiliateCTAPosition: 'BEFORE_RECOMMENDATION'
    },
    gold_label: {
      expected_decision: 'HUMAN_WRITING_REWRITE',
      expected_score_range: [0, 74],
      expected_major_issues: ['COMMERCIAL_BIAS_RISK', 'UNSUPPORTED_SUPERLATIVE'],
      expected_integrity_violations: ['COMMERCIAL_BIAS_RISK'],
      expected_role_owner: 'editorial_qa_primary',
      requires_evidence_recheck: false,
      hard_fail_expected: true,
      notes: 'Tautan afiliasi diletakkan di awal sebelum analisis, superlatif tidak berdasar, bias penjualan agresif. Pelanggaran keras integritas komersial.'
    }
  },
  {
    id: 'L_FAKE_HANDS_ON_REVIEW',
    title: '[ILLUSTRATIVE_EXAMPLE_ONLY] Ulasan Kunci Pintu Digital Seri-Z200',
    category: 'PRODUCT_REVIEW',
    split: 'CALIBRATION',
    content: FIXTURE_L_CONTENT,
    options: {
      reviewType: 'ANALYTICAL_REVIEW',
      isProductReview: true,
      hasFirstPartyEvidence: false
    },
    gold_label: {
      expected_decision: 'HUMAN_WRITING_REWRITE',
      expected_score_range: [0, 74],
      expected_major_issues: ['FABRICATED_HANDS_ON_TEST', 'FABRICATED_EXPERIENCE_OR_SLOP'],
      expected_integrity_violations: ['FABRICATED_HANDS_ON_TEST'],
      expected_role_owner: 'editorial_qa_primary',
      requires_evidence_recheck: true,
      hard_fail_expected: true,
      notes: 'Mengklaim pengujian fisik 3 minggu di kantor redaksi padahal artikel berstatus analitis tanpa bukti primer. Hard fail integritas Layer 5.'
    }
  },
  {
    id: 'M_SINGLE_COMPLAINT_OVERGENERALIZATION',
    title: '[ILLUSTRATIVE_EXAMPLE_ONLY] Tinjauan Cat Dinding Eksterior WeatherShield Pro 5L',
    category: 'PRODUCT_REVIEW',
    split: 'CALIBRATION',
    content: FIXTURE_M_CONTENT,
    options: {
      reviewType: 'ANALYTICAL_REVIEW',
      isProductReview: true
    },
    gold_label: {
      expected_decision: 'HUMAN_WRITING_REVISE',
      expected_score_range: [75, 84],
      expected_major_issues: ['SINGLE_REVIEW_OVERGENERALIZATION'],
      expected_integrity_violations: [],
      expected_role_owner: 'content_writer_primary',
      requires_evidence_recheck: false,
      hard_fail_expected: false,
      notes: 'Keluhan pembeli tunggal di marketplace digeneralisasikan menjadi vonis cacat total batch produk.'
    }
  },
  {
    id: 'N_COMPATIBILITY_BLIND_REVIEW',
    title: '[ILLUSTRATIVE_EXAMPLE_ONLY] Panduan Pembelian Paket Panel Surya Rumah 1000W On-Grid',
    category: 'PRODUCT_REVIEW',
    split: 'HOLDOUT',
    content: FIXTURE_N_CONTENT,
    options: {
      reviewType: 'ANALYTICAL_REVIEW',
      isProductReview: true
    },
    gold_label: {
      expected_decision: 'HUMAN_WRITING_REVISE',
      expected_score_range: [75, 84],
      expected_major_issues: ['COMPATIBILITY_NOT_EVALUATED'],
      expected_integrity_violations: [],
      expected_role_owner: 'content_writer_primary',
      requires_evidence_recheck: false,
      hard_fail_expected: false,
      notes: 'Merekomendasikan sistem on-grid tanpa memeriksa kendala kompatibilitas daya meteran PLN (daya langganan minimal) atau izin net-metering.'
    }
  }
];

// ============================================================================
// Benchmark Execution & Metric Aggregation
// ============================================================================

export interface BenchmarkEvaluationRecord {
  fixture_id: string;
  category: BenchmarkCategory;
  split: BenchmarkSplit;
  actual_score: number;
  expected_score_range: [number, number];
  actual_decision: HumanWritingDecision;
  expected_decision: HumanWritingDecision;
  decision_match: boolean;
  detected_issues: string[];
  expected_issues: string[];
  issues_covered: boolean;
  integrity_violations_caught: boolean;
  hard_fail_matched: boolean;
  assigned_role_owner: string;
  expected_role_owner: string;
}

export interface BenchmarkSummaryReport {
  timestamp: string;
  total_fixtures: number;
  calibration_fixtures_count: number;
  holdout_fixtures_count: number;
  decision_accuracy: number;
  calibration_accuracy: number;
  holdout_accuracy: number;
  pass_false_positive_rate: number;
  rewrite_false_negative_rate: number;
  integrity_violation_recall: number;
  role_routing_accuracy: number;
  records: BenchmarkEvaluationRecord[];
}
