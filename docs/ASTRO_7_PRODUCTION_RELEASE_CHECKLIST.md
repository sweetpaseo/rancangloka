# Astro 7 Production Release Checklist

Daftar periksa operasional (runbook checklist) peluncuran rilis Astro 7 untuk RancangLoka.

---

## 1. PRE-DEPLOY GATES

### Gerbang Otomatis & Baseline Aplikasi (Completed)
- [x] **Astro 7 Migration Completed:** Kompatibilitas Astro 7.3.3, @astrojs/cloudflare 14.3.2, TypeScript 5.9.2/5.9.3 terverifikasi (`b12d064`).
- [x] **Automated Build Gate:** `npm run build` menghasilkan bundle server dan client assets tanpa error fatal.
- [x] **CSS Regression Guard:** `npm run test:css-delivery` PASS (manifest terhubung ke `global.*.css`, 4 CSS assets, 72,392 bytes).
- [x] **CSS Delivery Configuration:** `build.inlineStylesheets = "never"` terpasang aktif di `astro.config.mjs`.
- [x] **Local Worker Boot:** Worker lokal boot sukses di port kanonikal 8788 via `npm run worker:local`.
- [x] **HTTP Route Matrix (Pre-browser):** 7 rute lokal (`/`, artikel, `/editorial-standards`, `/solusi`, `/komparasi`, `/api/search.json`, `/admin`) merespons HTTP status yang sesuai (200 / 302).
- [x] **Public CSS HTTP Delivery:** Asset `/assets/global.*.css` dan `/assets/BaseLayout.*.css` mengembalikan HTTP 200 OK (`text/css`).

### Gerbang Browser Real & UX (Completed)
- [x] **Browser Visual Gate:** Operator mengonfirmasi styling visual pulih sempurna, regresi giant search icon teratasi (`MANUAL_CSS_VISUAL_RETEST=PASS`).
- [x] **Browser Console Gate:** 0 uncaught console errors pada seluruh rute yang diuji di Antigravity real browser runtime.
- [x] **Browser Network Gate:** Seluruh resource kritis (HTML, CSS, JS, Images, Search API) berstatus HTTP 200 OK.
- [x] **Desktop Responsive Gate (1280x800):** Layout simetris, multi-column bento card presisi, `scrollWidth <= innerWidth`.
- [x] **Mobile Responsive Gate (390x844):** Zero horizontal overflow, touch targets ergonomis, fluid typography.
- [x] **Lighthouse Core Web Vitals (Local Worker):**
  - Homepage Mobile: Perf 99, A11y 95, BP 100, SEO 100 | LCP 236ms, CLS 0.000, TBT 0ms.
  - Homepage Desktop: Perf 99, A11y 95, BP 100, SEO 100 | LCP 316ms, CLS 0.000, TBT 0ms.
  - Article Mobile: Perf 98, A11y 92, BP 100, SEO 95 | LCP 264ms, CLS 0.000, TBT 0ms.
  - Article Desktop: Perf 99, A11y 92, BP 100, SEO 95 | LCP 252ms, LCP 252ms, CLS 0.000, TBT 0ms.
- [x] **Cache Policy Safety:** Search API `public, max-age=60, s-maxage=300`; Public HTML `no-cache, no-store`; Admin `302 Found` tanpa public cache.
- [x] **Zero Release Blockers:** `RELEASE_BLOCKERS = NONE`, `SHOULD_FIX_BEFORE_RELEASE = NONE`.
- [x] **Publication Safety Locked:** `AUTO_PUBLISH = OFF`, `MEDIA_CAN_PUBLISH = NO`, integritas artikel 6 terjaga.

### Syarat Gerbang Sebelum Eksekusi Rilis (Completed)
- [x] **Final Documentation Commit:** Seluruh dokumen rilis (`HISTORY.md`, `ASTRO_7_UPGRADE_CHECKPOINT.md`, Release Plan, Checklist) di-commit secara lokal (`e8954be`).
- [x] **Clean Worktree:** `git status --short` benar-benar bersih tanpa uncommitted changes saat rilis.
- [x] **Explicit Human Deploy Approval:** Operator memberikan persetujuan eksplisit untuk memulai deployment produksi (`PROCEED WITH PRODUCTION RELEASE`).

---

## 2. DEPLOY (Completed)

- [x] **Push Final Release Branch:** Eksekusi `git push origin main` ke GitHub remote (`bc15be5..e8954be`).
- [x] **Record Pushed Commit:** Commit SHA `e8954beeee215c3e95084aceb9ce9c976ef403e9`.
- [x] **Run Canonical Production Deploy:** Jalankan `npm run deploy` (`astro build && wrangler deploy`) -> Exit Code `0`.
- [x] **Record Cloudflare Version:** Version ID baru: `dfbd3ae4-2341-4776-90e4-080949f8d56a`.
- [x] **Verify Deployment Success:** Proses deployment Cloudflare Worker `rancangloka` sukses 100%.

---

## 3. POST-DEPLOY (Completed)

- [x] **Homepage Verification:** Akses `https://rancangloka.com/` (HTTP 200, visual styling utuh).
- [x] **Representative Article Verification:** Akses `https://rancangloka.com/rumah-tropis-yang-tidak-takut-matahari` (HTTP 200, layout artikel presisi).
- [x] **CSS Critical Verification:**
  - [x] Tag `<link rel="stylesheet">` mengarah ke `/assets/global.*.css`.
  - [x] Asset CSS merespons HTTP 200 dengan `Content-Type: text/css`.
  - [x] Ukuran asset CSS > 70 KB (71,952 bytes).
  - [x] Tidak ada tampilan raw HTML.
  - [x] Ikon pencarian dan navigasi berukuran normal (bukan giant SVG).
- [x] **Console & Network Gate:** Diuji via browser subagent pada domain produksi: 0 error pada konsol dan seluruh network requests vital 200 OK.
- [x] **Search API Smoke:** Periksa `https://rancangloka.com/api/search.json` (HTTP 200, format valid, `public, max-age=60, s-maxage=300`).
- [x] **Cache Policy Verification:** Header `Cache-Control` pada halaman publik adalah `no-cache, no-store, must-revalidate`.
- [x] **Sitemap Verification:** Akses `https://rancangloka.com/sitemap.xml` (HTTP 200, format XML valid).
- [x] **Robots Verification:** Akses `https://rancangloka.com/robots.txt` (HTTP 200, aturan perayapan sesuai).
- [x] **Admin Auth Protection:** Akses `https://rancangloka.com/admin` (HTTP 302 redirect ke login, proteksi OTP Cloudflare aktif).
- [x] **Publication Invariant Check:** Konfirmasi `AUTO_PUBLISH=OFF` dan `MEDIA_CAN_PUBLISH=NO` tetap terkunci di produksi.
- [x] **Production Observation Window:** Observasi pasca-rilis selesai dengan 0 runtime/HTTP errors.

---

## 4. ROLLBACK (Not Triggered - Unchecked)

- [ ] **Rollback Trigger Identified:** Deteksi insiden kritis (widespread 5xx, CSS missing, database failure, dsb.).
- [ ] **Rollback Decision Confirmed:** Keputusan rollback disetujui oleh operator.
- [ ] **Rollback Command Requires Operator Confirmation:**
  - [ ] Rollback via Cloudflare Dashboard ke Version ID `1322e6ff-2c98-4c2e-8850-4af14bb40f9f`, ATAU
  - [ ] Rollback via Wrangler CLI setelah konfirmasi perintah oleh operator, ATAU
  - [ ] Fallback deploy dari commit `c13b0f505195ca0c34751f5c681012b08830134f`.
- [ ] **Post-Rollback Smoke Test:** Verifikasi pemulihan rute `https://rancangloka.com/` dan fungsi kritis.
- [ ] **Incident Post-Mortem:** Catat penyebab insiden dan anomali ke `HISTORY.md`.
