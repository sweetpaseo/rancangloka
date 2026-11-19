# 👥 RancangLoka — Local Human Casting Policy v1.0
**Milestone:** `RANCANGLOKA_LOCAL_HUMAN_CASTING_POLICY_V1`  
**Otoritas:** Owner Editorial Decision  
**Status:** Canonical Editorial Standard  
**Ruang Lingkup:** Seluruh materi visual AI editorial RancangLoka (Cover, Inline Images, Kling Image Series, Thumbnail, dan Turunan Media Sosial).

---

## 1. Latar Belakang & Prinsip Dasar

RancangLoka adalah media digital independen Indonesia yang berfokus pada arsitektur, hunian, dan renovasi rumah. Seluruh representasi visual AI yang menyertai artikel editorial harus berakar pada **realitas hidup masyarakat Indonesia (*Indonesian lived reality*)**.

Ketika visual memerlukan kehadiran sosok manusia untuk memberikan skala arsitektural (*scale reference*), memperlihatkan aktivitas hunian (*domestic routine*), atau mendemonstrasikan penyelesaian masalah desain, model manusia wajib mencerminkan audiens pembaca Indonesia secara autentik.

---

## 2. Sepuluh Aturan Utama (*The 10 Core Rules*)

### Rule 1 — Prioritas Representasi Indonesia / Asia Tenggara
Jika visual memerlukan manusia, prioritaskan penampilan khas masyarakat Indonesia / Asia Tenggara (kulit sawo matang / *warm olive*, rambut gelap alami, postur tubuh wajar).

### Rule 2 — Cakupan Demografis Lengkap
Berlaku menyeluruh untuk seluruh kategori demografi:
- Pria dewasa (*Adult Male*)
- Wanita dewasa (*Adult Female*)
- Anak-anak (*Children*)
- Orang tua / lansia (*Elderly / Grandparents*)
- Pasangan dan keluarga (*Couples & Multi-generational Families*)

### Rule 3 — Larangan Mutlak Model Default Western / Caucasian
Dilarang keras menggunakan model default bergaya Western, European, atau Caucasian dalam generasi foto editorial RancangLoka. Seluruh prompt AI wajib menyertakan pembatasan negatif (*negative constraints*):
```text
caucasian model, western features, european default model, blonde hair, blue eyes, western fashion catalog pose, artificial studio model styling
```

### Rule 4 — Busana, Gestur, & Aktivitas Domestik Autentik
Pakaian, gestur, aktivitas, dan lingkungan harus autentik dengan kehidupan sehari-hari orang Indonesia:
- Busana rumah tangga santai: kaos katun, celana pendek/santai, daster katun santai, sandal rumah, pakaian polo rapi tanpa pose model katalog glamor.
- Gestur alami: aktivitas memasak nyata, membersihkan rumah, bersantai di ruang keluarga, menyiram tanaman di inner court, membaca di dekat bukaan jendela. Hindari pose kaku menatap kamera atau pose majalah mode buatan.

### Rule 5 — Anatomi Alami & Ekspresi Wajar
Proporsi tubuh, anatomi fisik (termasuk kelengkapan 5 jari tangan), dan ekspresi wajah harus alami, tanpa deformasi AI (*uncanny valley*, jari ganda, wajah meleleh, atau distorsi perspektif).

### Rule 6 — Prioritas Arsitektur (Anti-Forced Human Presence)
Jangan memaksakan figur manusia pada komposisi arsitektur yang tidak memerlukannya. Arsitektur, material, tata letak ruang, dan pencahayaan alami tetap merupakan subjek utama. Ketika kehadiran manusia berstatus `NONE`, komposisi difokuskan 100% pada ruang hunian yang bersih (*unpopulated architectural interior*).

### Rule 7 — Kontinuitas Model dalam Image Series
Pada generasi foto bertahap atau *Kling Image Series Mode*, model manusia yang sama wajib mempertahankan konsistensi identitas (wajah, postur, usia, gaya rambut, dan pakaian) di seluruh sudut pandang (*shot*). Perubahan identitas model antar-shot dilarang.

### Rule 8 — Integrasi Budi Prompt Engine & Storyboard Nadia
- **Nadia (Visual Storyboard):** Menentukan kebutuhan figur manusia secara eksplisit per slot (`NONE`, `BACKGROUND_SCALE`, `DOMESTIC_ACTIVITY`) serta demografi target.
- **Budi (Prompt Engine):** Mengompilasi token casting positif dan negatif ke dalam `DeepPromptV2`, `buildStructuredInlinePrompt`, dan `buildStructuredSeriesPrompt`.

### Rule 9 — Evaluasi Relevansi Audiens Rina (Anti-Esensialisasi Wajah)
Rina mengevaluasi relevansi visual terhadap target pembaca Indonesia secara objektif:
- Evaluasi dilakukan berdasarkan konteks pakaian, setting ruangan, kewajaran aktivitas, dan ketiadaan tropa katalog Barat.
- **Batasan Penting:** Rina dilarang mengklaim bahwa asal etnis seseorang dapat dipastikan hanya dari fitur wajah semata. Evaluasi berfokus pada relevansi kontekstual dan kepatuhan terhadap aturan casting.

### Rule 10 — Nol Mutasi Aset Eksisting & Nol Biaya Tambahan
Kebijakan ini berlaku untuk generasi baru di masa depan. Seluruh foto yang sudah lolos validasi sebelumnya tetap dipertahankan (*immutable*), dan tidak ada panggilan API berbayar atau regenerasi yang dijalankan secara otomatis tanpa otorisasi Owner.

---

## 3. Peta Integrasi Sistem

```
┌────────────────────────────────────────────────────────┐
│               Nadia Visual Storyboard                  │
│  - human_presence: NONE | SCALE | DOMESTIC_ACTIVITY    │
│  - demographic: ADULT_MALE | ADULT_FEMALE | FAMILY... │
└──────────────────────────┬─────────────────────────────┘
                           │
                           ▼
┌────────────────────────────────────────────────────────┐
│             Budi Prompt Engine & House Lock            │
│  - compileHumanCastingPromptTokens(spec)               │
│  - Positive Tokens: Authentic Indonesian Resident...   │
│  - Negative Tokens: Anti-Caucasian / Western Drift     │
│  - Series Lock: Model ID Continuity across shots       │
└──────────────────────────┬─────────────────────────────┘
                           │
                           ▼
┌────────────────────────────────────────────────────────┐
│             Rina Visual Quality Reviewer               │
│  - evaluateRinaHumanCastingCompliance(auditInput)      │
│  - Contextual Evaluation (Clothing, Activity, Scale)   │
│  - Anti-Stereotype & Zero Facial Racial Essentialism   │
│  - Hard Reject on Western Drift / AI Deformity         │
└────────────────────────────────────────────────────────┘
```

---

## 4. Invarian Keselamatan yang Dipertahankan

1. **Watermark Engine:** Tetap wajib tersemat pada derivatif WebP publik (`rancangloka.com` di sudut kanan bawah).
2. **Master Private Storage:** Master original biner terisolasi di storage privat lokal & R2 (`storage/masters/`).
3. **House Identity Lock v1.2:** Topologi dan peralatan tetap tidak boleh berubah antar-shot.
4. **Photo-First Policy:** Fotografi editorial realistis standar majalah arsitektur tanpa CGI glossy.
5. **Auto Publish: OFF:** Seluruh draf artikel tetap berstatus DRAFT tanpa publikasi otomatis.
