# 📖 EDITORIAL-HUMAN-QUALITY-1 — Human Writing Quality Gate

## Ringkasan Eksekutif & Tujuan

Milestone **`EDITORIAL-HUMAN-QUALITY-1`** mengimplementasikan gerbang mutu penulisan redaksional alami (*Human Writing Quality Gate*) pada pipeline editorial RancangLoka dan Hermes Mission Control. 

Tujuan utama dari milestone ini adalah memastikan bahwa seluruh naskah artikel yang disetujui secara redaksional (*editorial approval*) dan diterbitkan memiliki kualitas prosa yang terasa ditulis secara wajar, mengalir, dan bernas oleh editor/penulis manusia Indonesia kompeten, serta **bebas dari pola klise mekanis kecerdasan buatan (AI slop / machine-generated patterns)**.

---

## 1. Prinsip Fundamental: Anti-Detector Eksternal

Sistem ini **TIDAK** menggunakan dan **TIDAK PERNAH** mengklaim integrasi alat deteksi AI eksternal seperti:
- GPTZero atau skor probabilitas AI acak ("teks ini 87% manusia").
- API detektor pihak ketiga yang tidak dapat diandalkan (*opaque / black-box heuristic*).
- Klaim palsu berbasis probabilitas statistik tanpa dasar editorial.

Sebaliknya, sistem ini menilai karakteristik redaksional nyata yang menjadi standar editorial RancangLoka:
1. Variasi dan kelancaran irama kalimat (*sentence rhythm*).
2. Spesifisitas teknis terukur (*concrete details*).
3. Relevansi kontekstual iklim dan realitas hunian tropis Indonesia (*tropical heat, heavy rain, local building reality*).
4. Karakter dan suara redaksi yang lugas, tidak kaku (*editorial voice*).
5. Struktur artikel yang organik dan tidak simetris secara kaku (*non-template structure*).
6. Integrasi bukti empiris dan standar konstruksi (SNI/ASTM) secara alami (*evidence integration*).
7. Nilai manfaat sudut pandang pembaca pemilik rumah (*reader perspective*).
8. Kesimpulan orisinal yang berorientasi keputusan (*decision-oriented conclusion*).

---

## 2. Model Rubrik & Pembobotan (100 Poin)

| Dimensi Penilaian | Bobot Maksimal | Karakteristik yang Diukur |
| :--- | :---: | :--- |
| **Natural sentence rhythm** | 20 | Variasi panjang kalimat, dinamika alur, bebas dari kemonotonan kalimat seragam. |
| **Specificity / concrete detail** | 15 | Penggunaan angka spesifikasi teknis, ketebalan material, dimensi nyata. |
| **Contextual relevance** | 15 | Mengakar pada iklim tropis, curah hujan tinggi, panas sore, kelembapan, kondisi tukang/material lokal. |
| **Editorial voice** | 15 | Bahasa lugas, percaya diri, bebas dari formula klise kamus dan hedging defensif berlebihan. |
| **Non-template structure** | 10 | Variasi panjang subjudul dan jumlah butir penjelasan antar-bagian (menghindari simetri kaku). |
| **Evidence integration** | 10 | Bukti dan standar (SNI/ASTM) teranyam dalam penalaran, bukan ditempelkan sebagai daftar kering. |
| **Useful reader perspective** | 10 | Pemaparan yang berfokus pada pemecahan dilema pemilik rumah nyata. |
| **Conclusion originality** | 5 | Bagian akhir memberikan panduan aksi dan trade-off keputusan, bukan sekadar ringkasan artikel. |
| **TOTAL** | **100** | Ambang kelulusan deterministik. |

### Ambang Keputusan (Decision Thresholds)
- **`85 – 100` = `HUMAN_WRITING_PASS`**: Naskah memenuhi standar kelancaran redaksi manusia dan dapat melanjutkan ke tahap pipeline berikutnya.
- **`75 – 84` = `HUMAN_WRITING_REVISE`**: Naskah memiliki bukti yang baik namun struktur atau frasa transisi terasa mekanis; dikembalikan ke Joko dengan *structured rewrite brief*.
- **`0 – 74` = `HUMAN_WRITING_REWRITE`**: Naskah menunjukkan pola formulaik generik (misal pembuka klise kamus, simetri kaku di seluruh bagian); wajib ditulis ulang secara menyeluruh.

---

## 3. Matriks Kepemilikan Personel Kanonikal

```
Irwan (evidence_researcher_lead)
  └── Otoritas: EVIDENCE_RESEARCH (Fakta, standar SNI/ASTM, evidence packs)
        │
        ▼ (Handoff Naskah Riset)
Joko (content_writer_primary)
  └── Otoritas: ARTICLE_WRITING & HUMAN_WRITING_AUTHORING (Penyusunan prosa human-first)
        │
        ▼ (Handoff Draf Naskah)
Rina (editorial_qa_primary)
  └── Otoritas: EDITORIAL_QA, HUMAN_WRITING_QA, EDITORIAL_NATURALNESS_REVIEW
        │
        ├── [PASS >= 85] ──► Tahap editorial signoff / jadwal tayang
        └── [FAIL < 85]  ──► Handoff REWRITE / REVISE kembali ke Joko
```

- **Joko (Writer / Editorial Desk)**:
  - Bertanggung jawab atas gaya bahasa alami (*human-first authoring*).
  - Wajib mempertahankan seluruh fakta teknis dan bukti riset Irwan saat melakukan penulisan ulang (*stylistic rewrite*).
  - **MUTLAK**: Dilarang mengarang testimoni, pengujian fisik palsu ("kami sudah menguji"), atau pengalaman lapangan fiktif jika tidak ada bukti primer.
- **Rina (Editor / Editorial QA Desk)**:
  - Memegang otoritas gerbang mutu penulisan alami (*Human Writing QA Gate*).
  - Menilai draf secara deterministik, menghasilkan rincian skor dimensi, daftar kelemahan terdeteksi, dan *structured rewrite brief*.
  - Tidak menulis ulang naskah secara sepihak; mengembalikan draf ke Joko dengan panduan revisi terarah.
- **Irwan (Research & Evidence Desk)**:
  - Memegang otoritas kebenaran data teknis dan standar bangunan.
  - Tidak memiliki wewenang atas alur prosa santai/lugas.
- **Jefry (TypeSafe JEV / Management Advisor)**:
  - Mode bayangan (*shadow mode only*).
  - **Nol (0) otoritas eksekusi redaksional atau penerbitan publikasi**.

---

## 4. Deteksi Pola Mesin / AI-Slop Deterministik

Rina mendeteksi dan memberi penalti terhadap pola-pola mekanis umum:

1. **Generic Opening**:
   - Pola: *"Di era modern saat ini..."*, *"Dalam dunia konstruksi..."*, *"Memilih material yang tepat merupakan hal yang penting..."*.
   - Target: Langsung membuka dari dilema konkret pembaca (misal: kebocoran dak beton di musim hujan lebat).
2. **Excessive Structural Symmetry**:
   - Pola: Setiap subjudul memiliki jumlah butir yang sama persis (misal 3 butir di setiap H2) atau panjang paragraf yang seragam.
   - Target: Pola penyajian organik yang proporsional sesuai kedalaman materi.
3. **Repetitive Transitions**:
   - Pola: Penggunaan berulang frasa mekanis (*"Selain itu"*, *"Di sisi lain"*, *"Dengan demikian"*, *"Oleh karena itu"*, *"Pada akhirnya"*).
   - Target: Alur gagasan bergerak melalui relasi logis alami kalimat, bukan kata sambung template.
4. **Empty Generalizations**:
   - Pola: *"Setiap pilihan memiliki kelebihan dan kekurangan"*, *"Pilihan terbaik tergantung kebutuhan masing-masing"*.
   - Target: Trade-off spesifik (misal: baja ringan lebih stabil terhadap rayap namun memerlukan sekrup anti-karat kelas 3).
5. **Excessive Hedging**:
   - Pola over-defensive: *"dapat menjadi pilihan"*, *"cenderung"*, *"mungkin saja"*, *"umumnya"*.
   - Target: Ketegasan analisis yang presisi; jika ada batas bukti, nyatakan secara eksplisit.
6. **Artificial Conclusion**:
   - Pola: Penutup yang hanya mengulang ringkasan isi tanpa panduan keputusan.
   - Target: Rekomendasi aksi nyata (kapan memilih A vs B, dan apa yang harus dicek pembaca ke tukang/toko).
7. **Keyword Forcing / Stuffing**:
   - Pola: Pemaksaan kata kunci SEO di setiap subjudul dan perulangan canggung dalam teks.
   - Target: Bahasa yang mudah dan nyaman dibaca manusia mengalahkan pengulangan kata kunci kaku.

---

## 5. Siklus Penulisan Ulang & Batas Percobaan (Retry Cap)

Untuk mencegah perulangan tanpa akhir (*infinite loops*):
1. Jumlah percobaan penulisan ulang dibatasi **maksimal 2 kali (`maxAttempts = 2`)**.
2. Jika naskah gagal pada percobaan ke-2 (percobaan ke-3 berikutnya), sistem secara deterministik mengeksekusi transisi status ke **`HUMAN_REVIEW_REQUIRED`**.
3. Naskah dialihkan ke peninjauan operator redaksi manusia secara langsung.
4. Sistem **DILARANG KERAS** menurunkan ambang kelulusan secara otomatis hanya agar naskah lulus.

---

## 6. Integrasi Mission Control, Job Trace & Pixel Office

- **Job Trace Events**:
  - `HUMAN_WRITING_QA_STARTED`
  - `HUMAN_WRITING_REVISE_REQUESTED`
  - `ARTICLE_REWRITE_STARTED`
  - `HUMAN_WRITING_QA_PASSED`
  - `HUMAN_REVIEW_REQUIRED`
- **Pixel Office & Live Operations**:
  - Joko berpindah ke workstation `editorial_writer_desk` dengan animasi `ARTICLE_TYPING` saat drafting baru.
  - Joko menampilkan animasi `ARTICLE_REWRITE` (`✍️`) secara otomatis jika naskah berstatus penulisan ulang (`retryCount > 0`).
  - Rina beroperasi di `editorial_review_desk` dengan animasi `QA_REVIEW` (`📝`).
- **Endpoint Inspeksi Terlindungi**:
  - `GET /api/admin/mission-control/quality?article_id=:id`
  - Dilindungi sesi admin `isValidAdminSession` dan `Media Device Firewall` (token pekerja media dilarang mengakses, HTTP 403).
  - Mutasi dilarang mutlak (`POST/PUT/DELETE` mengembalikan HTTP 405).

---

## 7. Verifikasi & Pengujian

Suite pengujian komprehensif dijalankan pada:
```bash
node scripts/test-editorial-human-quality.js
```
Hasil: **20 pengujian lulus (100% PASS, 0 FAIL)** meliputi:
- Evaluasi naskah machine-like (REWRITE).
- Evaluasi naskah borderline (REVISE + structured brief).
- Evaluasi naskah human editorial berkarakter kuat (PASS).
- Penegakan retry cap & eskalasi `HUMAN_REVIEW_REQUIRED`.
- Pencegahan pemalsuan testimoni personal Joko.
- Integritas bukti teknis & SNI selama penulisan ulang.
- Otoritas publikasi tetap nol (`publishingAuthority = 0`).
- Sifat deterministik (input identik menghasilkan skor identik).
- Jefry nol otoritas eksekusi.
