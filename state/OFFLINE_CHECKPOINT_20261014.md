# 🛑 RancangLoka & Hermes — Offline Master Checkpoint
**Tanggal / Waktu:** 2026-10-14T11:00:00+07:00  
**Branch:** `feat/jev-lokamedia-integration`  
**Git HEAD:** `04d48fb` (`feat(admin): add scalable human approval inbox`)  
**Commit Milestones:**
- `9f1395e` `feat(editorial): establish RancangLoka house voice and reader UX` (13 permanent files)
- `f26685d` `fix(mission-control): avoid duplicate client declarations` (1 file)
- `1d718bc` `docs(checkpoint): record House Voice and Reader UX milestone in HISTORY.md and offline checkpoint`
- `04d48fb` `feat(admin): add scalable human approval inbox` (9 files)
**Status Operasional:** `READY_FOR_OFFLINE` / `APPROVAL_INBOX_V1_COMPLETE`

---

## 1. Status Ringkasan Ekosistem (Executive Summary)

Hari ini (14 Oktober 2026), seluruh target teknis arsitektur antarmuka persetujuan redaksi (*Approval Inbox V1*), shell admin responsif mobile, isolasi fixture pengujian DEV, dan pemindahan provenans kerja ke halaman detail telah diselesaikan dan disahkan dengan status hijau (100% pass) tanpa pelanggaran invarian keselamatan produksi:

1. **Prinsip Arsitektur Kanonikal:**
   - *"If the system needs a human decision, the system surfaces that decision to the human."*
   - *"The bell tells the administrator that work exists. The Approval Inbox organizes the work. The Approval Detail is where the decision happens."*
   - *"Inbox = find the work. Detail = understand the context and make the decision."*
   - *"Human approval queues may scale; human decisions remain deliberate and individual."*

2. **Arsitektur Shell Admin Responsif & Off-Canvas Drawer (`AdminLayout.astro`):**
   - **Desktop (>= 1024px):** Sidebar navigasi permanen `lg:w-60` dipertahankan.
   - **Mobile (< 1024px):** Off-canvas drawer (`-translate-x-full` ke `translate-x-0`) dengan backdrop, hamburger button, close button, serta auto-close pada navigasi link atau penekanan tombol `Escape`.
   - **Header Mobile:** Format bersih `[ hamburger ] [ page identity ] [ approval bell ]`.
   - **Dropdown Lonceng Notifikasi:** Posisi adaptif `fixed sm:absolute inset-x-3 sm:inset-x-auto top-16 sm:top-auto sm:right-0 mt-2 sm:w-96 max-w-[calc(100vw-1.5rem)]` aman dari clipping pada layar sempit 375px.

3. **Penyederhanaan Operasional Antrean Persetujuan Desktop (`/admin/approvals`):**
   - **Tabel 5 Kolom Esensial:** `Judul / Subjek`, `Tipe`, `Menunggu`, `Status`, `Tindakan`.
   - **Pelepasan Kolom Audit Berat:** Kolom `Tahap Alur Kerja`, `Gerbang Sebelumnya`, dan `Aktor Wajib` dipindahkan sepenuhnya ke halaman Detail (`/admin/preview/[slug]`).
   - **Aksi Langsung Tanpa Scroll:** Tombol `[Tinjau →]` langsung terlihat tanpa perlu scroll horizontal pada desktop 1024px maupun 1440px.

4. **Pengalaman Tugas Utama (Task-First) Mobile (< 768px):**
   - Antrean mobile berbasis kartu tugas kompak (`#approval-mobile-list`, `md:hidden`) dari sumber data proyeksi kanonikal yang sama dengan desktop.
   - Header dan statistik dipadatkan; catatan prinsip UX dikompresi menjadi disclosure `<details class="md:hidden">` ("Tentang alur persetujuan"), menghemat ~60px ruang vertikal.
   - Keputusan persetujuan pertama tampak 100% *above-the-fold* pada viewport sempit (375x812px) pada ketinggian ~258px.
   - Tab filter status horisontal dilengkapi `.no-scrollbar` untuk menyembunyikan bilah gulir visual tanpa mengganggu swipe sentuh.

5. **Isolasi Modular Fixture DEV (`src/lib/approvals/dev-fixtures.ts`):**
   - Memindahkan 5 objek mock visual review ke modul fixture terisolasi (`dev-fixtures.ts`).
   - Proyeksi kanonikal basis data (`projectRawApprovalItems`) 100% murni merefleksikan catatan SQLite/D1 riil tanpa kebocoran data demo ke produksi.
   - Fixture hanya aktif secara eksplisit pada pengujian lokal DEV (`import.meta.env.DEV`), bersifat in-memory (zero D1 writes), dan secara otomatis mundur (*step aside*) saat ada catatan persetujuan riil.

6. **Kepatuhan Invarian Gerbang Manusia (Human Gate Invariant):**
   - Artikel hanya dapat memasuki antrean pending Chief Editor jika seluruh gerbang sebelumnya terbukti lulus: Irwan (Evidence) `PASS`, Joko (Authoring) `PASS`, Nadia (Reader Voice) `PASS`, dan Rina (Editorial QA) positif eksplisit `PASS`.
   - Nilai `undefined`, `NOT_RUN`, `PENDING`, atau ketiadaan kegagalan dilarang keras dianggap lulus.
   - Keputusan persetujuan manusia bersifat deliberate dan per-item (*NO BULK APPROVAL*).

7. **Integritas Draf & Data Artikel C:**
   - Draf lokal terverifikasi di `scripts/content-bootstrap/artC-research-reset/article-c-clean-draft.md`.
   - **SHA-256 Hash:** `85270eb8534331da54efe4bb2dbe471a25ec532bf75d55270758d18c375f15c5` (100% stabil & immutable).
   - 13/13 klaim terbukti terikat pada `article-c-claim-usage.json` dan `source-verification-ledger.json`.
   - Status Publikasi: **`UNPUBLISHED`** menunggu persetujuan akhir konten manusia (`ARTICLE_C_FINAL_CONTENT_APPROVAL_REQUIRED`).

---

## 2. Invarian Keselamatan Produksi Wajib (Safety State)

| Parameter | Nilai Aktif | Keterangan |
|---|---|---|
| `automation_mode` | `OFF` | Otomasi editorial nonaktif |
| `SOCIAL_AUTOMATION` | `OFF` | Distribusi sosial nonaktif |
| `AUTO_PUBLISH` | `OFF` | Seluruh draf wajib berhenti di persetujuan manusia |
| `publishingAuthority` (Nadia & staf AI) | `0` | Nol otoritas publikasi otomatis |
| `JEV_MODE` | `shadow` | Decision engine bayangan (non-mutating, zero authority) |
| `autonomous media worker` | `DISABLED` | Pekerja media otonom nonaktif |
| `kill_switch_engaged` | `0` | Berjalan normal tanpa intervensi darurat |
| Mutasi Basis Data D1 Produksi | `0` | Nol mutasi database pada sesi ini |
| Mutasi Naskah Artikel Terbit | `0` | Artikel A & B 100% terlindungi (immutable) |
| Status Publikasi Artikel C | `UNPUBLISHED` | Tersimpan lokal, belum dipublikasikan |
| Deployment Cloudflare Produksi | `0` | Nol deployment pada sesi ini |
| Git Push Remote | `0` | Nol push ke remote repository |

---

## 3. Hasil Pengujian & Verifikasi Kualitas

Seluruh pengujian dijalankan dan diverifikasi lulus 100%:

| Test Suite | Hasil | Deskripsi |
|---|---|---|
| `scripts/test-scalable-approval-inbox.js` | **14/14 PASSED** | Skala antrean persetujuan, capping lonceng 5 item, invariant NO BULK APPROVAL, Rina PASS gate |
| `scripts/test-admin-responsive-ux.js` | **21/21 PASSED** | Shell drawer, bell mobile, kolom esensial, dan optimasi above-the-fold |
| `npx tsc --noEmit` | **0 ERRORS** | Validasi tipe statis TypeScript bersih |
| `npm run build` | **BUILD OK** | Kompilasi bundle Astro SSR Cloudflare adapter (7.14s) |

---

## 4. Alur Kerja Editorial Kanonikal (Production Workflow)

```text
[Irwan] (Riset & Source Evidence Pack)
   ↓
[Joko] (Penulisan Naskah Bahasa Alami Indonesia)
   ↓
[Nadia] (Audience & Language Gate: READER_VOICE_QA)
   ↓
[Rina] (Editorial Fact QA & Technical Gate)
   ↓
[Human Approval] (Chief Editor / Operator Manusia di /admin/approvals & /admin/preview/[slug])
   ↓
[Sari] (Publication Operations & Safe Atomic Dispatch)
```

---

## 5. Rencana Kerja Sesi Berikutnya (Next Steps)

1. **Review Akhir Artikel C oleh Chief Editor:** Pemeriksaan naskah final pada antarmuka admin preview untuk pemberian `ARTICLE_C_FINAL_CONTENT_APPROVAL`.
2. **Penerbitan Artikel C (Jika Disetujui):** Menjalankan alur publikasi manusia terkontrol untuk artikel C setelah approval eksplisit.
