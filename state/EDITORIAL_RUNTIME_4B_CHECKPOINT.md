# 📋 RancangLoka — Checkpoint EDITORIAL-RUNTIME-4B Final Clean Proof & Provider Resilience
## Generalization Architecture, Provider Reliability & Grounding Gate

> **Checkpoint ID:** `EDITORIAL-RUNTIME-4B-FINAL-CHECKPOINT-20261005`  
> **Timestamp:** `2026-10-05T16:25:00+07:00`  
> **Branch:** `feat/jev-lokamedia-integration`  
> **Baseline Commit:** `5fc5171` (`fix(editorial): harden editorial provider reliability`)  
> **Milestones Covered:** `EDITORIAL-RUNTIME-3B`, `EDITORIAL-RUNTIME-4A`, `EDITORIAL-RUNTIME-4B-STABILIZE`, `EDITORIAL-PROVIDER-RESILIENCE-1`, `EDITORIAL-RUNTIME-4B FINAL CLEAN PROOF`  
> **Final Classification:** **`RUNTIME4B_FINAL_GROUNDING_BLOCKED`**  
> **Stop Gate:** **`EDITORIAL_RUNTIME4B_FINAL_HUMAN_REVIEW_REQUIRED`**  
> **Safety State:** `automation_mode = OFF`, `SOCIAL_AUTOMATION = OFF`, `AUTO_PUBLISH = OFF`, `publishingAuthority = 0`, `JEV_MODE = shadow`, `mediaWorker = DISABLED`, `Jefry execution authority = 0`

---

## 1. Ringkasan Eksekutif

Rangkaian milestone ini membuktikan generalisasi menyeluruh (*end-to-end generalization*) pertama arsitektur editorial RancangLoka di luar domain historis atap metal, menyelesaikan blokade keandalan provider LLM (*Editorial LLM Provider Resilience*), serta membuktikan keandalan deterministik gerbang ketercakupan bukti (*Grounding Gate*).

### Status Terbukti (Proven Invariants):
1. **Dynamic Visitor Pain = PROVEN:** Generasi konteks masalah pengunjung dinamis tanpa asumsi hardcoded atap metal.
2. **Dynamic Research Questions = PROVEN:** 6 kategori investigasi jurnalistik dibangkitkan dinamis per topik.
3. **Generalized Irwan Research Runtime = PROVEN:** Penelusuran, pengunduhan dokumen primer terbuka, pembacaan teks, ekstraksi passage, dan penyusunan Evidence Pack topik baru (*dinding lembap*) secara autentik.
4. **Topic/Evidence Alignment Gate = PROVEN:** Gerbang penolakan adversarially teruji menolak bukti atap metal untuk dinding lembap.
5. **Research Question Coverage Gate = PROVEN:** Rasio cakupan $1.0$ (6 dari 6 kategori terjawab oleh paket bukti).
6. **Generic Research Integrity & Claim Semantic Decoupling = PROVEN:** ID klaim (`CLM-002`, `CLM-005`, dll.) didecoupling dari domain atap metal; validasi peran semantik berbasis peran (`semantic_role`), bukan nomor ID.
7. **Editorial LLM Provider Resilience = PROVEN:** Masalah kegagalan draf kosong Joko terselesaikan tuntas melalui konfigurasi `max_tokens: 8000`, `timeoutMs: 120000`, 9 klasifikasi error granular, bounded transient retry, dan telemetri prompt.
8. **Real Joko Draft Generation = PROVEN:** Joko berhasil menghasilkan naskah lengkap 10.813 karakter dalam 24,5 detik dengan 4.592 completion tokens via SumoPod (`gpt-5.6-luna`).
9. **Deterministic Grounding Gate = PROVEN:** Gerbang ketercakupan bukti mendeteksi 3 kandidat klaim di luar bukti aman penulis yang dideklarasikan Joko pada amplop JSON (terkait insulasi foil/ventilasi atap dari instruksi template pembuka lama) dan secara deterministik menghentikan naskah (*fail-closed*) pada status `EVIDENCE_GROUNDING_REVIEW_REQUIRED`.
10. **Generalization Leak = ZERO:** Nol kebocoran istilah historis terlarang (*radiant barrier*, *DOE radiant barrier*, *metal roof*, *CLM-001A*, *CLM-001B*, dll.) pada seluruh artefak `runtime4b-final-*`.

---

## 2. Penyelesaian Provider Resilience (EDITORIAL-PROVIDER-RESILIENCE-1)

### Akar Masalah Kegagalan Joko pada Rerun-2 & Rerun-3:
- Model `gpt-5.6-luna` di SumoPod merupakan reasoning model.
- Pada prompt envelope berukuran ~29.179 karakter, model membutuhkan token penalaran internal (*reasoning tokens*) serta token pembuatan teks.
- Kuota lama `max_tokens = 4000` habis terpotong saat penulisan draf penuh (output aktual membutuhkan **4.592 completion tokens**).
- Hal ini menyebabkan upstream provider mengembalikan string kosong `content: ""` dengan HTTP status 200, yang pada kode lama diinterpretasikan sebagai error generik tanpa diagnostik dan tanpa retry.
- Timeout lama 60.000 ms juga berada di batas tipis durasi generasi artikel besar.

### Solusi yang Diimplementasikan (`src/lib/editorial/editorial-llm-provider.ts`):
1. **Peningkatan Kuota Output Token:** `DEFAULT_EDITORIAL_MAX_TOKENS = 8000` (memberikan ruang penuh untuk reasoning + artikel bodi panjang).
2. **Peningkatan Batas Waktu Permintaan:** `DEFAULT_EDITORIAL_TIMEOUT_MS = 120000` (120 detik).
3. **9 Klasifikasi Error Granular:**
   - `PROVIDER_TIMEOUT`
   - `PROVIDER_RATE_LIMIT` (HTTP 429)
   - `PROVIDER_AUTH_ERROR` (HTTP 401/403)
   - `PROVIDER_HTTP_ERROR`
   - `PROVIDER_INVALID_JSON`
   - `PROVIDER_EMPTY_RESPONSE` (HTTP 200 dengan konten string kosong/whitespace)
   - `PROVIDER_MISSING_CONTENT` (HTTP 200 tanpa choices atau message content null)
   - `PROVIDER_CONTEXT_LIMIT` (Melebihi jendela konteks)
   - `PROVIDER_TRANSPORT_ERROR` (Network/DNS/Connection reset)
4. **Kebijakan Bounded Retry Otomatis:**
   - Maksimum 2 percobaan ulang (total 3 attempts).
   - Exponential backoff: $1000 \text{ ms} \times 2^{(\text{attempt} - 1)}$.
   - Retry hanya untuk kegagalan transien (429, timeout, network, invalid JSON, empty response, 5xx).
   - Dilarang retry untuk auth error (401/403), client error (400), atau context limit.
5. **Telemetri Anggaran Prompt:**
   - Pencatatan karakter sistem, pengguna, total, estimasi token, serta byte ukuran request body secara aman tanpa mencatat API key atau Authorization header.
6. **Hasil Probe Terkendali:**
   - **SMALL (130 char):** 1.862 ms, 45 output tokens, HTTP 200, SUCCESS.
   - **MEDIUM (711 char):** 6.402 ms, 853 output tokens, HTTP 200, SUCCESS.
   - **FULL (29.179 char):** 29.754 ms, 4.609 output tokens, 16.565 char text, HTTP 200, SUCCESS.

---

## 3. Hasil Eksekusi Live Pipeline Final (EDITORIAL-RUNTIME-4B FINAL CLEAN PROOF)

- **Topik:** *"Dinding Rumah Lembap dan Berjamur: Cat Waterproofing Cukup atau Sumber Air Harus Diperbaiki?"*
- **Content Family:** `PROBLEM_SOLVER`
- **Runner Hash Integrity:**
  - `SHA256_BEFORE`: `26aa1a3d93e241938d934a7521aeb4c00dc3196331d16aaa4603b9219ee10169`
  - `SHA256_AFTER`:  `26aa1a3d93e241938d934a7521aeb4c00dc3196331d16aaa4603b9219ee10169` (Identik, zero modification).
- **Statistik Riset Irwan:**
  - 10 sumber ditemukan, 2 dokumen primer berhasil diunduh (`SRC-OPEN-WIKI-DAMP`, `SRC-OPEN-EPA-MOISTURE`), 2 paywall tercatat jujur.
  - 49 klaim disusun, 48 passages diekstrak, 49 klaim aman penulis dihasilkan.
- **Hasil Gerbang Integritas Riset:**
  - Topic Alignment: `PASS` (`aligned: true`)
  - Research Coverage: `PASS` (`coverage_ratio: 1.0`)
  - Research Integrity: `PASS` (`requires_provenance_failure: false`, 49 hubungan klaim-sumber terverifikasi)
- **Eksekusi Joko:**
  - Waktu eksekusi: 24.540 ms (1 percobaan via SumoPod `gpt-5.6-luna`).
  - Tokens: 6.627 prompt tokens, 4.592 completion tokens (total 11.219 tokens).
  - Naskah mentah diproduksi: 10.813 karakter.
- **Audit Gerbang Ketercakupan Bukti (Grounding Gate):**
  - Joko memetakan 24 klaim ke `author_safe_claims` dengan valid.
  - Joko secara jujur mendeklarasikan 3 `unsupported_claim_candidates` di dalam amplop JSON (terkait saran insulasi foil vs ventilasi atap dari template pembuka lama).
  - Gerbang Grounding deterministik memblokir naskah dengan kode `EVIDENCE_GROUNDING_REVIEW_REQUIRED`.
  - Rina QA dihentikan secara aman sesuai invarian (*Rina hanya mengevaluasi draf yang lolos grounding*).
- **Klasifikasi Akhir:** **`RUNTIME4B_FINAL_GROUNDING_BLOCKED`**.

---

## 4. Artefak Pembuktian Resmi (`scripts/runtime-proof/`)

1. `runtime4b-final-visitor-pain.json` (Konteks masalah pengunjung dinamis)
2. `runtime4b-final-research-questions.json` (6 pertanyaan riset dinamis)
3. `runtime4b-final-evidence-pack.json` (Paket bukti autentik 49 klaim dinding lembap)
4. `runtime4b-final-author-safe-claims.json` (49 klaim aman penulis)
5. `runtime4b-final-joko-prompt-envelope.json` (Amplop prompt Joko lengkap)
6. `runtime4b-final-raw-draft.md` (Draf mentah pertama Joko, 10.813 karakter)
7. `runtime4b-final-draft-envelope.json` (Amplop JSON draf Joko beserta deklarasi klaim)
8. `runtime4b-final-grounded-draft.md` (Naskah bodi hasil amplop draf)
9. `runtime4b-final-grounding-audit.json` (Hasil audit grounding deterministik)
10. `runtime4b-final-execution-trace.json` (Trace kronologis 16 langkah eksekusi)
11. `runtime4b-final-meta.json` (Metadata komprehensif telemetri dan hasil)

---

## 5. Ringkasan Pengujian Regresi

- `scripts/test-editorial-provider-resilience.js`: **11/11 PASS** (Suite unit keandalan provider).
- `scripts/test-editorial-runtime-4b-stabilize.js`: **11/11 PASS** (Suite integritas riset generik & decoupling peran).
- `scripts/test-editorial-runtime-4a-generalization.js`: **12/12 PASS** (Suite generalisasi arsitektur & matriks topik).
- `scripts/test-editorial-runtime-3b-stabilize.js`: **18/18 PASS** (Suite integritas semantik passage-ke-klaim).
- `scripts/test-editorial-runtime-2.js`: **13/13 PASS** (Suite draf grounded Joko & kompresi).
- `scripts/test-editorial-runtime-1.js`: **18/18 PASS** (Suite eksekusi Joko + Rina deterministik).
- `npx tsc --noEmit`: **0 error (bersih)**.

---

## 6. Status Keselamatan & Stop Gate

- Seluruh invarian keselamatan editorial dan publikasi tetap aktif:
  - `automation_mode = OFF`
  - `SOCIAL_AUTOMATION = OFF`
  - `AUTO_PUBLISH = OFF`
  - `publishingAuthority = 0`
  - `JEV_MODE = shadow`
  - `media worker effective execution = DISABLED`
  - `Jefry execution authority = 0`
- Zero deploy, zero publikasi, zero mutasi remote D1.
- Berhenti aman pada: **`EDITORIAL_RUNTIME4B_FINAL_HUMAN_REVIEW_REQUIRED`**.
