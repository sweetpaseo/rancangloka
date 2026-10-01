# 🌐 SOCIAL-S1: Social Media Automation Core Domain, Staging Outbox & Persistence

> **Milestone:** `SOCIAL-S1`  
> **Status:** `COMPLETE / PRODUCTION_READY_FOUNDATION`  
> **Scope:** Internal Domain Foundation, D1 Persistence Schema, Cryptographic Approval Gate & Staging Outbox  
> **Precondition:** `SOCIAL-S0` COMPLETE (`docs/SOCIAL_S0_ARCHITECTURE_DISCOVERY.md`)  
> **Safety State:** `SOCIAL_AUTOMATION = OFF`, `media_worker = DISABLED`, `JEV = shadow`, `department_availability = NOT_AVAILABLE`  
> **Date:** 1 Oktober 2026  

---

## 1. Ikhtisar & Ruang Lingkup

Milestone **SOCIAL-S1** membangun fondasi model domain internal, skema persistensi basis data D1, gerbang persetujuan kriptografis (*Cryptographic Approval Gate*), dan antrean keluar (*Staging Outbox*) untuk pipeline distribusi media sosial RancangLoka.

### Batasan Mutlak S1 (Strict Invariants):
1. **Zero External Provider Calls:** Tidak ada integrasi aktif atau panggilan jaringan ke Meta, Facebook, Instagram, TikTok, YouTube, LinkedIn, atau X.
2. **Zero Automated Dispatch:** `SOCIAL_AUTOMATION = OFF` dipertahankan secara absolut. Seluruh varian yang telah dijadwalkan (`SCHEDULED`) dalam outbox memiliki jumlah kelayakan eksekusi nol (`eligible_count = 0`).
3. **Department Remains Inactive:** Departemen `Social & Distribution` pada Mission Control tetap berstatus `availability: 'NOT_AVAILABLE'` dan `is_staffed: false`.
4. **No Fake Staff Activity:** Tidak ada pendaftaran agen baru (`Maya` belum didaftarkan), tidak ada pergerakan acak atau animasi kerja fiktif di Pixel Office.
5. **No Automatic Production Scanning:** Tidak ada pemindaian otomatis terhadap kuitansi historis atau pembuatan kampanye massal untuk artikel yang sudah terbit di produksi.

---

## 2. Entitas Domain Kanonik (Canonical Domain Entities)

Model domain sosial didefinisikan pada `src/lib/social/types.ts` dan diimplementasikan pada `src/lib/social/service.ts`:

### 2.1. `SocialCampaign`
Representasi tingkat tinggi dari seluruh upaya distribusi sosial untuk **satu** artikel web RancangLoka yang telah terbit resmi.
- **Kunci Primer:** `campaign_id` (format: `scamp_[hex16]`).
- **Keterikatan Provenans:** `source_receipt_id` merujuk langsung ke `publication_execution_receipts(receipt_id)` dengan batasan `UNIQUE` (1 artikel terbit = maksimal 1 kampanye sosial).
- **Integritas:** Menyimpan snapshot `content_hash`, `slug`, dan `canonical_url` dari kuitansi publikasi web.

### 2.2. `SocialPostVariant`
Representasi format dan naskah yang disesuaikan untuk target platform tertentu.
- **Kunci Primer:** `variant_id` (format: `spvar_[hex16]`).
- **Target Platform:** `platform_id` (`facebook_page`, `instagram_business`, `tiktok`, `youtube_shorts`, `linkedin`, `x`).
- **Tipe Varian:** `variant_type` (`FEED_POST`, `CAROUSEL`, `REEL_SHORT`, `THREAD`).
- **Rasio Media:** `media_aspect_ratio` (`1:1`, `4:5`, `9:16`, `16:9`).
- **Pencegahan Duplikasi:** Partial unique index `uq_active_variant_per_campaign_platform` menjamin hanya ada 1 varian aktif per platform dalam satu kampanye.

### 2.3. `SocialVariantApproval`
Catatan persetujuan manusia yang dapat diaudit secara hukum dan kriptografis.
- **Kunci Primer:** `approval_id` (format: `sappr_[hex16]`).
- **Pengikatan Kriptografis:** Menyimpan `approved_payload_hash` yang wajib identik dengan `payload_hash` varian saat persetujuan ditandatangani.

### 2.4. `SocialStagingOutbox`
Antrean rilis terjadwal dengan kesiapan kontrol konkurensi atomik (*compare-and-set leasing*).
- **Kunci Primer:** `outbox_id` (format: `sout_[hex16]`).
- **Kesiapan Eksekusi:** Menampung `claimed_by_worker`, `lease_expires_at`, `attempts_count`, `max_attempts`, dan `last_error_class`.

### 2.5. `SocialExecutionReceipt`
Kuitansi imutabel yang mencatat bukti hasil eksekusi publikasi eksternal setelah postingan berhasil atau gagal di platform pihak ketiga.
- **Kunci Primer:** `receipt_id` (format: `srec_[hex16]`).
- **Bukti Normalisasi:** Menyimpan `platform_post_id`, `platform_permalink`, `actual_published_at`, dan `payload_hash`.

---

## 3. Mesin Status Deterministik (Deterministic State Machines)

Didefinisikan secara sentral pada `src/lib/social/state-machine.ts`:

### 3.1. Siklus Hidup Kampanye (`SocialCampaignStatus`)
```
DRAFT
  ├──> PREPARING ──> READY_FOR_QA ──> QA_REVIEW ──> PENDING_APPROVAL ──> APPROVED ──> SCHEDULED ──> PROCESSING ──> COMPLETED
  └──> (Dapat beralih ke BLOCKED atau CANCELLED dari tahap mana pun sebelum COMPLETED)
```
- Transisi tidak valid (misal `DRAFT -> COMPLETED`) ditolak seketika (*fail-closed*).
- Status terminal: `COMPLETED` dan `CANCELLED` bersifat imutabel.
- Status `UNKNOWN` hanya dapat diatur ulang ke `DRAFT` melalui tindakan eksplisit operator.

### 3.2. Siklus Hidup Varian Postingan (`SocialVariantStatus`)
```
DRAFT ──> READY_FOR_QA ──> QA_REVIEW ──> PENDING_APPROVAL ──> APPROVED ──> SCHEDULED ──> PUBLISHING ──> PUBLISHED
                                                                                                    ├──> RETRY_WAIT ──> FAILED
                                                                                                    └──> BLOCKED
```

### 3.3. Siklus Hidup Outbox Penjadwalan (`SocialOutboxStatus`)
```
STAGED ──> CLAIMED ──> PUBLISHING ──> PUBLISHED
                                 ├──> RETRY_WAIT ──> FAILED
                                 └──> BLOCKED
```

---

## 4. Gerbang Persetujuan Kriptografis (Cryptographic Approval Boundary)

Implementasi pada `src/lib/social/approval.ts`:

### 4.1. Algoritma Payload Hash
```typescript
canonicalString = [
  platform_id.trim().toLowerCase(),
  sha256(normalizeCaptionText(caption_text)),
  [...media_asset_ids].sort().join(','),
  media_aspect_ratio.trim()
].join('::');

payload_hash = sha256(canonicalString);
```

### 4.2. Invarian Invalidation Mutasi Material
* **Persetujuan Terikat ke Hash:** Operator menyetujui versi spesifik naskah dan aset media.
* **Mutasi Membatalkan Persetujuan:** Setiap perubahan pada `caption_text` atau `media_asset_ids` menghasilkan `payload_hash` baru.
* **Penurunan Status Otomatis:** Memodifikasi varian yang berstatus `APPROVED` secara otomatis mendemosikan statusnya kembali ke `READY_FOR_QA` dan membatalkan keabsahan catatan persetujuan sebelumnya (`PAYLOAD_MUTATED_SINCE_APPROVAL`).
* **Jadwal Tanpa Persetujuan Ditolak:** Fungsi `scheduleVariantToOutbox()` menolak varian tanpa persetujuan valid yang cocok dengan payload hash terkini.

---

## 5. Skema D1 & Migrasi (`0026_social_domain_and_outbox.sql`)

Diterapkan secara 100% aditif pada basis data SQLite Cloudflare D1:

1. **`social_campaigns`:** Relasi kampanye dengan batasan unik `source_receipt_id`.
2. **`social_post_variants`:** Varian platform dengan indeks parsial unik `uq_active_variant_per_campaign_platform`.
3. **`social_variant_approvals`:** Log persetujuan operator dengan referensi hash payload.
4. **`social_staging_outbox`:** Antrean outbox dengan indeks komposit `(outbox_status, target_publish_at)`.
5. **`social_execution_receipts`:** Kuitansi publikasi imutabel dengan referensi unik `outbox_id`.

---

## 6. Staging Outbox & Invarian Keselamatan Otomatisasi

Pada fungsi `getSocialOutboxSnapshot()`:
```typescript
if (automationMode === 'OFF') {
  return {
    automation_mode: 'OFF',
    eligible_count: 0,
    staged_count: items.length,
    due_items: [],
    safety_block_reason: 'SOCIAL_AUTOMATION = OFF enforces zero executable dispatch.'
  };
}
```
Meskipun terdapat item yang dijadwalkan pada waktu lampau (*due items*), item tersebut **TIDAK PERNAH** dapat diambil atau diproses selama saklar global berada pada mode `OFF`.

---

## 7. Hasil Pengujian & Verifikasi

Seluruh pengujian unit dan integrasi lulus 100% pada suite uji mandiri:
- `scripts/test-social-domain.js` (22/22 skenario uji PASS):
  - Uji provenans kuitansi web (`SUCCESS` diterima, non-existent/`FAILED` ditolak).
  - Uji pencegahan duplikasi kampanye dan varian aktif.
  - Uji transisi status deterministik dan penolakan transisi ilegal.
  - Uji penolakan penjadwalan tanpa persetujuan operator.
  - Uji pembatalan persetujuan akibat mutasi teks caption atau aset media.
  - Uji kesiapan antrean outbox terjadwal dan pencegahan duplikasi outbox.
  - Uji saklar keselamatan `SOCIAL_AUTOMATION = OFF` (`eligible_count = 0`).
  - Uji penanganan anomali `BLOCKED` dan pembatalan `CANCELLED`.
  - Uji penerbitan kuitansi eksternal dan transisi penyelesaian kampanye (`COMPLETED`).
  - Uji bentuk telemetri read-only untuk Mission Control (`department_availability = 'NOT_AVAILABLE'`).
- Seluruh suite regresi Mission Control (MC-1 s.d. MC-9, soak safety 54/54 uji) lulus 100%.
- TypeScript check (`npx tsc --noEmit`) lulus 0 kesalahan.
- Astro production build (`npm run build`) lulus 100%.

---

## 8. Kebutuhan Handoff untuk SOCIAL-S2

Milestone berikutnya (**`SOCIAL-S2`**) akan menangani:
1. Registrasi kapabilitas observasi read-only pada `capability-registry.ts`.
2. Pengaktifan mode observasi bayangan (*Shadow Read Model*) pada `department-registry.ts` untuk departemen `social`.
3. Integrasi status pembacaan kampanye dan varian ke dalam snapshot telemetri Mission Control.
4. Pemetaan penempatan staf sosial di Pixel Office secara aman tanpa fake work.
