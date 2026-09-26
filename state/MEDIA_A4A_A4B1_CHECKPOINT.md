# 📸 RancangLoka — Checkpoint MEDIA-A4A & MEDIA-A4B.1
## Canonical Media Asset Registration, Nested Delivery Fix, and Article Media Detach/Deactivate Lifecycle

> **Checkpoint ID:** `MEDIA-A4A-A4B1-CHECKPOINT-20260926`  
> **Timestamp:** `2026-09-26T08:35:00+07:00`  
> **Branch:** `feat/jev-lokamedia-integration`  
> **Commits:**  
> - `d31c618` (`feat: add media asset registration payload builder and prep test suite`)
> - `67cdbe0` (`fix: support nested media storage keys`)
> - `12def9e` (`fix: preserve media source provenance semantics`)
> - `5e0d76b` (`test: add MEDIA-A4B preparation and dry-run test suite`)
> - `b5a4d18` (`feat: add canonical article media detach lifecycle`)
> **Status:** `MEDIA_A4A=PASS` (Production Registered), `MEDIA_A4B1=PASS_LOCAL` (Local Service Implemented & Verified)

---

## 1. Ringkasan Eksekutif

Milestone **MEDIA-A4A** dan **MEDIA-A4B.1** menyelesaikan dua fondasi krusial dalam siklus hidup aset media di ekosistem RancangLoka:
1. **MEDIA-A4A (Production Proven):** Registrasi objek R2 hasil watermark MEDIA-A3 ke tabel database D1 `media_assets`, perbaikan rute pengiriman media bersarang (`/media/[...key]`), dan pelestarian semantik asal media (`source_origin: 'local_fixture'`).
2. **MEDIA-A4B.1 (Local Verified):** Implementasi layanan pelepasan/deaktivasi kanonikal (`detachArticleMedia`) dan endpoint internal (`/api/internal/v1/media/article-media/detach`) yang bekerja secara soft-deactivation (`is_active = 0`) tanpa menyentuh kolom legasi `articles.featured_image`, menjamin ketersediaan *rollback* kanonikal sebelum eksekusi canary produksi MEDIA-A4B.

---

## 2. Rincian Milestone MEDIA-A4A & MEDIA-A4A.1

### A. Perbaikan Pengiriman Media Bersarang (`src/pages/media/[...key].ts`)
- **Masalah:** Rute awal `/media/[key].ts` hanya mendukung single segment URL. Kunci R2 bersarang seperti `media/canary/media-a3/...` gagal dikirimkan (HTTP 404 / route mismatch).
- **Solusi:** Diubah menjadi rest parameter `/media/[...key].ts`, dilengkapi normalisasi traversal path, decoding percent-encoding yang aman, pencegahan path traversal (`..`, `%2e%2e`), dan fallback subpath mounting.
- **Tes Regresi (`scripts/test-media-delivery-route.js`):** 16/16 pengujian lulus 100%.

### B. Preservasi Semantik Sumber Media (`src/lib/media/asset-registration.ts`)
- **Masalah:** Registrasi sebelumnya memaksakan nilai `source_type: 'lokamedia_extension'` secara seragam, mengaburkan asal mula artefak (`fal_api`, `chatgpt_browser_bridge`, atau `local_fixture`).
- **Solusi:** `buildMediaAssetRegistrationPayload` memetakan `source_origin` dengan akurat ke dalam `provenance_json` dan merefleksikan identitas sumber artefak secara transparan.

### C. Eksekusi Registrasi Aset Produksi (MEDIA-A4A.2)
- **Deployment Pekerja:** Berhasil dideploy ke Cloudflare Edge (`d35528c0-7695-4c85-9a9d-ee39e6097c2a`).
- **Aset Terdaftar di D1 Produksi:**
  - `asset_id`: `ast_8321f8f3eb7b039c59c222ba`
  - `storage_key`: `media/canary/media-a3/7b30ab30e36c781674cbf3f2108b37619ddfb352c236a9621db79b02ec945967.png`
  - `sha256`: `7b30ab30e36c781674cbf3f2108b37619ddfb352c236a9621db79b02ec945967`
  - `mime_type`: `image/png`
  - `width`: 169, `height`: 512, `file_size`: 66377
  - `status`: `VALIDATED`
  - `role`: `ARTICLE_PUBLIC_DERIVATIVE`
  - `source_type`: `lokamedia_extension`
  - `provenance.source_origin`: `local_fixture`
- **Verifikasi Live Delivery:**
  - HTTP GET `https://rancangloka.com/media/media/canary/media-a3/7b30ab30e36c781674cbf3f2108b37619ddfb352c236a9621db79b02ec945967.png`
  - Status: HTTP 200 OK, Content-Type: `image/png`, Content-Length: 66377, Hash match 100%.

---

## 3. Rincian Milestone MEDIA-A4B.1: Canonical Detach / Deactivate Service

### A. Akar Masalah & Audit Jalur Legasi
- **Evaluasi `unbindFeaturedMedia` (`src/lib/media/service.ts`):**
  - Jalur legasi memutasi `articles.featured_image = ''` dan `articles.image_alt = ''`.
  - Hal ini melanggar invarian arsitektur modern karena source-of-truth gambar artikel adalah tabel relasi `article_media WHERE role = 'featured' AND is_active = 1`.
  - Jalur legasi dinyatakan **TIDAK AMAN** untuk MEDIA-A4B (`LEGACY_UNBIND_SAFE_FOR_A4B=NO`).

### B. Implementasi Layanan Kanonikal (`src/lib/media/article-media.ts`)
- **Fungsi:** `detachArticleMedia(params: ArticleMediaDetachParams, db: any): Promise<ArticleMediaDetachResult>`
- **Kontrak Input:**
  ```typescript
  interface ArticleMediaDetachParams {
    article_id: number;
    asset_id: string;
    slot_key?: string | null;
    role?: string | null;
    binding_id?: number | null;
    actor_id?: string | null;
  }
  ```
- **Invarian & Semantik:**
  1. **Scoping Ketat:** Wajib mencakup `article_id` dan `asset_id` (serta opsional `slot_key` dan `binding_id`). Menolak operasi tanpa pembatasan identitas.
  2. **Soft-Deactivation:** Menjalankan `UPDATE article_media SET is_active = 0, updated_at = CURRENT_TIMESTAMP WHERE id = ? AND is_active = 1`. Tidak menghapus baris (DELETE) agar riwayat relasi tetap terjaga.
  3. **Pembebasan Slot Aktif:** Indeks parsial SQLite `idx_article_media_one_active_slot` pada `(article_id, slot_key) WHERE is_active = 1` langsung terbebaskan saat `is_active` menjadi 0, memungkinkan slot dipakai oleh aset lain.
  4. **Imutabilitas Kolom Legasi:** Tabel `articles` (termasuk `articles.featured_image`) tidak disentuh sama sekali (0 field mutation).
  5. **Isolasi Mutasi:** Tabel `media_assets`, tabel publikasi, dan objek R2 tidak mengalami mutasi apapun.
  6. **Idempotensi:** Pemanggilan ulang untuk binding yang sudah tidak aktif mengembalikan `already_inactive: true` dan `detached: false` dengan status HTTP 200 aman.
  7. **Concurrency Safety (OCC):** Scoped ke primary key `id` dan `is_active = 1`.
  8. **Audit Trail:** Mencatat entri tindakan `'DETACH'` ke dalam tabel `media_asset_audit`.

### C. Endpoint Internal API (`src/pages/api/internal/v1/media/article-media/detach.ts`)
- **Metode & Rute:** `POST /api/internal/v1/media/article-media/detach`
- **Otentikasi:** Menggunakan otentikasi device media berpasangan HMAC (`authenticateDeviceRequest`), setara dengan endpoint attach.
- **Firewall Payload:** Menolak biner/multipart (`BINARY_PAYLOAD_NOT_ACCEPTED`, HTTP 415).
- **Validasi Schema:** Memvalidasi `article_id`, `asset_id`, format `slot_key`, dan mengembalikan error terstruktur.

---

## 4. Hasil Verifikasi & Uji Rangkaian Lengkap (MEDIA-A4B.1 Test Suite)

Eksekusi `scripts/test-media-a4b1-detach.js`:
1. `LEGACY_FEATURED_IMAGE_IMMUTABILITY_TEST_PASS`: Kolom `articles.featured_image` terbukti identik sebelum, saat, dan sesudah detach.
2. `CANONICAL_STATE_ROUNDTRIP_PASS`: Pre-attachment hash sama persis 100% dengan post-detach hash (`h_29741012`).
3. `ACTIVE_SLOT_REUSE_PASS`: Slot `'featured'` yang telah dinonaktifkan dari Asset A sukses ditempati oleh Asset B.
4. `DETACH_IDEMPOTENCY_PASS`: Detach ganda tidak menghasilkan mutasi tambahan (`already_inactive: true`).
5. `DETACH_CONFLICT_HANDLING_PASS`: Fail-closed terverifikasi untuk artikel tidak ada (404), aset tidak ada (404), binding tidak cocok (404), role mismatch (422), dan format slot tidak valid (400).
6. `DETACH_MUTATION_SCOPE_PASS`: Tabel `articles` dan `media_assets` terbukti 0 mutasi sampingan.
7. `DETACH_LEDGER_DECOUPLING_PASS`: Trajectory ledger (`article_state_snapshots`, `article_state_transitions`, `decision_outcomes`) tetap 0 baris (terisolasi).
8. `LOCAL_FULL_ROUNDTRIP_PASS`: Simulasi alur canary A4B lokal (baseline → attach → verify active → compute hash → detach → verify inactive → compare baseline hash) terbukti 100% identik.

Rangkaian regresi sistem:
- `test-media-a4b-prep.js` (9/9 PASS)
- `test-media-a4a-prep.js` (10/10 PASS)
- `test-media-delivery-route.js` (16/16 PASS)
- `test-publication-preflight-canonical-state.js` (7/7 PASS)
- `test-editorial-trajectory-ledger.js` (47/47 PASS)
- `npx tsc --noEmit` (Lulus tanpa error tipe)
- `npm run build` (Build Astro Cloudflare Server & Client sukses)

---

## 5. Status Produksi & Prosedur Canary Mendatang

```text
PRODUCTION_D1_MUTATIONS=0
PRODUCTION_R2_MUTATIONS=0
ARTICLE_MUTATIONS=0
PUBLICATION_MUTATIONS=0
PRODUCTION_DEPLOYED=NO

MEDIA_A4B1=PASS_LOCAL
READY_FOR_MEDIA_A4B1_DEPLOYMENT=YES
READY_FOR_MEDIA_A4B_PRODUCTION_CANARY=NO
```

**Rencana Canary MEDIA-A4B Mendatang:**
1. **Deploy MEDIA-A4B.1:** Lakukan `wrangler deploy` setelah otorisasi eksplisit operator untuk mempublikasikan endpoint `/api/internal/v1/media/article-media/detach` ke production edge.
2. **Attach Canary:** Attach `ast_8321f8f3eb7b039c59c222ba` ke Artikel 1 (role: `featured`, slot: `featured`).
3. **Verifikasi Publikasi & Hash:** Verifikasi hash preflight kanonikal berubah dan readiness gate tetap fail-closed (`manualHold: 0, status: 'draft'`).
4. **Rollback Kanonikal:** Jalankan `detachArticleMedia` yang menargetkan binding ID yang baru dibuat.
5. **Verifikasi Restorasi:** Pastikan status publikasi kembali persis ke baseline hash awal (`h_29741012`) tanpa meninggalkan mutasi pada tabel `articles`.
