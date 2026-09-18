# Astro 7 Upgrade Checkpoint

Tanggal: 2026-09-17 (Asia/Bangkok)

## Ringkasan

RancangLoka berhasil dimigrasikan dari Astro 4 ke Astro 7 secara lokal tanpa deploy produksi. Upgrade ini mempertahankan target hosting Cloudflare Workers with Static Assets, bukan Cloudflare Pages.

## Versi Setelah Upgrade

- `astro`: `^7.3.3`
- `@astrojs/cloudflare`: `^14.3.2`
- `@lucide/astro`: `^1.46.0`
- `wrangler`: `^4.133.0`
- `typescript`: `^5.9.2`
- `@types/node`: `^24.5.2`
- `tailwindcss`: `^3.4.19`

## Keputusan Teknis

- `@astrojs/tailwind` dihapus karena peer dependency resminya tidak mendukung Astro 7.
- Tailwind dijalankan via PostCSS standar melalui `postcss.config.mjs`.
- `wrangler.toml` memakai entrypoint adapter baru:
  ```toml
  main = "@astrojs/cloudflare/entrypoints/server"
  assets = { directory = "dist", binding = "ASSETS" }
  compatibility_date = "2024-09-23"
  compatibility_flags = ["nodejs_compat"]
  ```
- Akses binding Cloudflare tidak lagi memakai `Astro.locals.runtime.env`.
- Helper baru `getRuntimeEnv()` di `src/lib/db.ts` membaca env dari `cloudflare:workers` dengan fallback lokal/test.

## File Penting Yang Berubah

- `package.json`
- `package-lock.json`
- `astro.config.mjs`
- `postcss.config.mjs`
- `wrangler.toml`
- `src/lib/db.ts`
- `src/env.d.ts`
- `src/middleware.ts`
- Endpoint admin/internal yang sebelumnya memakai `locals.runtime.env`
- `src/pages/[slug].astro`
- `src/components/MobileBottomNav.astro`
- `scripts/test-route-smoke.js`
- `src/lib/dr1/backup.ts`
- `AGENTS.md`
- `CLOUDFLARE_DEPLOYMENT_GUIDE.md`
- `docs/DR1_ARCHITECTURE.md`
- `HISTORY.md`

## Validasi

PASS:

- `npx tsc --noEmit`
- `npm run build`
- `node scripts/test-schema-compatibility.js`
- `node scripts/test-article-admin-fix.js`
- `node scripts/test-route-smoke.js`
- `npm audit --audit-level=moderate`

## Status GitHub / Cloudflare Upload

- Commit lokal sudah dibuat: `f34683e feat: upgrade Astro 7 and publication systems`.
- Branch lokal `main` bersih dan berada `4` commit di depan `origin/main`.
- Push ke GitHub belum berhasil karena masalah autentikasi lokal, bukan karena kode:
  - GitHub CLI global masih memakai token lama/invalid.
  - Device login di browser menampilkan sukses, tetapi token tidak tersimpan ke konfigurasi GitHub CLI karena akses tulis folder user tidak tersedia dari sesi Codex.
  - Git HTTPS sempat gagal pada backend Windows Schannel dengan `SEC_E_NO_CREDENTIALS`.
  - Koneksi Git ke GitHub berhasil jika memakai `http.sslBackend=openssl`, tetapi proses push tetap tertahan saat meminta kredensial.
  - Konfigurasi global Git mengarahkan kredensial GitHub ke GitHub CLI, dan proses `git-remote-https.exe` sempat crash saat push.
  - Jalur SSH belum bisa dipakai karena GitHub menolak public key (`Permission denied (publickey)`).
- Langkah lanjut yang disarankan:
  ```powershell
  cd C:\Users\Fanto\Desktop\antigravity\rancangloka\rancangloka-astro
  git -c http.sslBackend=openssl push origin main
  ```
- Setelah push GitHub berhasil, Cloudflare Workers Builds CI dapat mengambil perubahan dari repository dan menjalankan build/deploy sesuai `CLOUDFLARE_DEPLOYMENT_GUIDE.md`.

## Post-Upgrade Transition Audit

Audit transisi Astro 7 dijalankan pada 2026-09-17 setelah commit dokumentasi `42c32cb`.

Hasil utama:

- Dependency resolved tetap konsisten: Astro `7.3.3`, `@astrojs/cloudflare` `14.3.2`, Vite `8.3.0`, TypeScript `5.9.3`, Wrangler `4.133.0`, Node lokal `24.16.0`.
- `npm ls` tidak menunjukkan invalid peer dependency untuk integrasi Astro/Cloudflare.
- `npm audit --json` mengembalikan 0 critical, 0 high, 0 moderate, 0 low.
- `tsc --noEmit` PASS.
- `astro build` PASS.
- Build warning tersisa tetap 3 warning direct `eval` dari `src/lib/dr1/offsite/google-drive.ts`.
- `astro check` belum menjadi sinyal validasi karena `@astrojs/check` belum terpasang; Astro meminta instalasi interaktif.
- Smoke berikut PASS: schema compatibility, admin article fix, route smoke, LokaMedia unit suite, publication readiness/planner/feedback/publisher unit, dan SOAK safety.

Temuan blocker sebelum deployment:

- Local production-like runtime via Wrangler/Cloudflare belum PASS. `wrangler dev --local` memakai redirected config `dist/server/wrangler.json`, lalu gagal dengan:
  - `Cannot read directory "../../../.." / "../../../../../..": Access is denied.`
  - `Could not resolve "...\\dist\\server\\entry.mjs"` walaupun file `dist/server/entry.mjs` ada.
- Karena local Worker runtime tidak start, browser/runtime console smoke dan local R2 live smoke tidak bisa diselesaikan secara valid.
- `scripts/smoke-publication-publisher-local.js` gagal pada Stage 17 dispatcher telemetry setelah banyak invariant publisher lulus. Unit publisher (`scripts/test-publication-publisher.js`) tetap PASS 48/48, sehingga perlu audit lanjut pada smoke end-to-end dispatcher lokal.

Gate hasil audit:

- `ASTRO_7_TRANSITION_STABLE = NO` sampai Wrangler local runtime dan Stage 17 publisher smoke diselesaikan atau dibuktikan sebagai isu lingkungan lokal non-produksi.
- `READY_FOR_GITHUB_PUSH = NO`.
- `READY_FOR_CLOUDFLARE_DEPLOY = NO`.
- Tidak ada push GitHub, tidak ada deploy Cloudflare, tidak ada mutasi D1/R2 produksi, dan tidak ada publish artikel.

## Cloudflare Local Worker Runtime Bootstrap Repair

Repair dijalankan pada 2026-09-17 setelah checkpoint `1c4dd8426782d76db1783fe670d4a63a499f0341`.

Hasil utama:

- Failure canonical berhasil direproduksi sebelum patch: `wrangler dev --local --config dist/server/wrangler.json` gagal dengan `Cannot read directory "../../../.." / "../../../../../.."` dan `Could not resolve "...\\dist\\server\\entry.mjs"`.
- `dist/server/entry.mjs` dan `dist/server/wrangler.json` valid; kegagalan berasal dari resolver esbuild/Wrangler pada path Windows repo yang dalam, bukan dari output Astro 7.
- Repair minimal ditambahkan melalui `scripts/dev-worker-local.mjs` dan script package `worker:local`.
- Script membuat drive mapping pendek via `subst` (default `R:`), menjalankan Wrangler dengan `--cwd R:\`, memakai config Astro 7 asli di `R:\dist\server\wrangler.json`, dan memaksa `XDG_CONFIG_HOME` ke `.tmp/xdg`.
- Tidak ada perubahan pada Stage 17, `@astrojs/check`, direct `eval` Google Drive warning, konten artikel, D1 produksi, R2 produksi, atau deployment.

Validasi repair:

- `worker:local`/script runtime lokal berhasil start dengan `Ready on http://127.0.0.1:8814`.
- Wrangler mendeteksi binding lokal: `SESSION` KV, `DB` D1, `MEDIA_BUCKET` R2, dan `ASSETS`.
- Runtime route smoke PASS:
  - `/` -> 200
  - `/tren-desain-interior-japandi-2026-hunian-minimalis` -> 200
  - `/api/search.json` -> 200
  - `/robots.txt` -> 200
  - `/media/nonexistent-a71` -> 404 expected
  - `/definitely-missing-a71` -> 404 expected
- `node_modules/.bin/tsc.cmd --noEmit` PASS.
- `astro build` PASS; warning tersisa tetap 3 direct `eval` warning lama dari `src/lib/dr1/offsite/google-drive.ts`.
- `node scripts/test-route-smoke.js` PASS 100%.

Gate setelah repair:

- `LOCAL_WORKER_RUNTIME_BOOTSTRAP = PASS`.
- `ASTRO_7_TRANSITION_STABLE = NO`, karena Stage 17 publisher smoke masih blocker terpisah.
- `READY_FOR_GITHUB_PUSH = NO`.
- `READY_FOR_CLOUDFLARE_DEPLOY = NO`.
- Tidak ada push GitHub, tidak ada deploy Cloudflare, tidak ada mutasi D1/R2 produksi, dan tidak ada publish artikel.

## Stage 17 Publisher Telemetry Repair

Repair Phase B dijalankan pada 2026-09-17 setelah Phase A local Worker bootstrap fix.

Hasil isolasi:

- Failure canonical berhasil direproduksi di `scripts/smoke-publication-publisher-local.js` Stage 17.
- Expected: dispatcher cron menerbitkan due task, `triggerSource = "cron"`, row `publication_publisher_runs` tersimpan, dan `executions_json` secret-free.
- Actual sebelum fix: `triggerSource = "cron"` PASS, tetapi `publishedCount = 0`, row telemetry tidak ada, lalu smoke crash membaca `runRow.executions_json`.

Root cause:

- Smoke harness menerapkan migration `0009` tetapi belum menerapkan migration `0011_automation_safety.sql`, sementara dispatcher otomatis sekarang membaca `automation_control` dan `circuit_breakers`.
- Fixture Stage 17 memakai tanggal statis `2026-09-08T12:00:00.000Z`; pada audit 2026-09-17, catch-up protection menganggapnya stale overdue.
- Stage sebelumnya menghasilkan receipt lokal dalam window 24 jam, sehingga activation rate limiter memblokir dispatcher otomatis sebelum telemetry run ditulis.
- Ini adalah `FIXTURE_BUG` dengan unsur `LOCAL_SCHEMA_BUG`, bukan regresi Astro 7 dan bukan bug implementasi publisher.

Fix:

- `scripts/smoke-publication-publisher-local.js` sekarang menerapkan migration `0011` bersama `0009`.
- Stage 17 memakai timestamp runtime tunggal `stage17NowUtc` untuk target dan `nowUtc` dispatcher.
- Stage 17 mengisolasi telemetry dispatcher dari receipt smoke sebelumnya dengan menghapus receipt fixture lokal `article_id >= 900 AND article_id <> 913` sebelum menjalankan cron dispatcher.

Validasi:

- Stage 17 isolated PASS: `publishedCount = 1`, `triggerSource = "cron"`, telemetry row ada, secret scan PASS.
- `scripts/smoke-publication-publisher-local.js` PASS 71/71.
- `scripts/test-publication-publisher.js` PASS 48/48.
- `scripts/smoke-publication-planner-local.js` PASS 74/74.
- `scripts/smoke-soak-safety-local.js` PASS 38/38.
- `node_modules/.bin/tsc.cmd --noEmit` PASS.
- `astro build` PASS dengan 3 warning direct `eval` lama dari `src/lib/dr1/offsite/google-drive.ts`.
- Phase A Worker wrapper masih boot PASS: mencapai `Ready on http://127.0.0.1:8816`.

Gate setelah Phase B:

- `STAGE17_BLOCKER_CLEARED = YES`.
- `READY_FOR_ASTRO_CHECK_SETUP = YES`.
- `READY_FOR_FULL_TRANSITION_RETEST = YES`.
- `READY_FOR_GITHUB_PUSH = NO` sesuai prompt/no-push dan karena commit masih terblokir ACL `.git`.
- `READY_FOR_CLOUDFLARE_DEPLOY = NO` sesuai prompt/no-deploy.
- Tidak ada push GitHub, tidak ada deploy Cloudflare, tidak ada mutasi D1/R2 produksi, dan tidak ada publish artikel.

## Astro 7 Phase C Full Transition Retest

Phase C dijalankan pada 2026-09-17 setelah Phase A local Worker bootstrap repair dan Phase B Stage 17 publisher repair.

Scope:

- Memasang `@astrojs/check` sebagai dependency validasi lokal.
- Menjalankan real `astro check`.
- Memperbaiki hanya error typed yang memblokir `astro check`.
- Mengulang build, Worker runtime, route smoke, package health, audit dependency, dan publication safety suite.
- Tidak melakukan push GitHub, deploy Cloudflare, mutasi D1/R2 produksi, atau publish artikel.

Dependency state:

- `astro`: `7.3.3`.
- `@astrojs/cloudflare`: `14.3.2`.
- `@astrojs/check`: `0.9.10`.
- `typescript`: `5.9.3`.
- `wrangler`: `4.133.0`.
- Node lokal: `24.16.0`.
- `npm audit --json`: 0 critical, 0 high, 0 moderate, 0 low.

Fix typed Astro check:

- `src/pages/[slug].astro`: `article.published_at` nullable diberi fallback sebelum dipakai oleh `new Date(...)`.
- `src/pages/admin/preview/[slug].astro`: `article.published_at` nullable diberi fallback sebelum dipakai oleh `new Date(...)`.
- `src/pages/admin/preview/[slug].astro`: `<TableOfContents items={toc} />` diganti menjadi `<TableOfContents toc={toc} />`.
- `src/pages/admin/preview/[slug].astro`: `<AuthorCard>` memakai prop typed `authorName`, `authorRole`, dan `authorAvatar`.
- `src/pages/admin/media.astro`: `getAllPages(db, 'all')` diganti menjadi `getAllPages(db)`.

Validasi:

- `astro check` PASS: 0 errors, 0 warnings, 280 hints.
- `node_modules/.bin/tsc.cmd --noEmit` PASS.
- `astro build` PASS dengan 3 warning direct `eval` lama dari `src/lib/dr1/offsite/google-drive.ts`.
- Local Worker route inventory PASS:
  - `/` -> 200
  - `/tren-desain-interior-japandi-2026-hunian-minimalis` -> 200
  - `/editorial-standards` -> 200
  - `/solusi` -> 200
  - `/komparasi` -> 200
  - `/metodologi` -> 200
  - `/api/search.json` -> 200
  - `/robots.txt` -> 200
  - `/admin` -> 302 expected
  - `/admin/posts` -> 302 expected
  - `/media/nonexistent-a71` -> 404 expected
  - bad slug -> 404 expected
- `node scripts/test-route-smoke.js` PASS 100%.
- `node scripts/test-publication-publisher.js` PASS 48/48.
- `node scripts/smoke-publication-publisher-local.js` PASS 71/71.
- `node scripts/smoke-publication-planner-local.js` PASS 74/74.
- `node scripts/smoke-soak-safety-local.js` PASS 38/38.

Browser/runtime console note:

- Browser plugin tersedia dan skill dibaca.
- Browser console smoke terhadap localhost Worker tidak dapat dijalankan valid karena background Worker job tidak bertahan melewati boundary tool browser pada sandbox ini (`ERR_CONNECTION_REFUSED` saat browser membuka port yang sebelumnya sehat via HTTP probe).
- HTTP Worker inventory dan route smoke tetap PASS dan tidak menemukan runtime 500.

Gate setelah Phase C:

- `ASTRO_CHECK = PASS`.
- `ASTRO_7_TRANSITION_STABLE = YES` untuk local code/runtime/test surface.
- `READY_FOR_GITHUB_PUSH = NO` sesuai prompt/no-push dan tidak ada commit dibuat.
- `READY_FOR_CLOUDFLARE_DEPLOY = NO` sesuai prompt/no-deploy.
- `AUTO_PUBLISH = OFF`.
- Tidak ada push GitHub, tidak ada deploy Cloudflare, tidak ada mutasi D1/R2 produksi, dan tidak ada publish artikel.

## Catatan

Build masih menampilkan warning non-fatal direct `eval` dari `src/lib/dr1/offsite/google-drive.ts`. Warning ini tidak terkait langsung dengan Astro 7 upgrade dan tidak memblokir build, tetapi sebaiknya dirapikan saat fase DR-1/backup berikutnya.

DR-1 infrastructure manifest metadata sudah diselaraskan ke Astro 7 (`astro_7_ssr`, compatibility date `2024-09-23`, entrypoint `@astrojs/cloudflare/entrypoints/server`, asset binding `ASSETS`). Test suite DR-1 masih memiliki kegagalan lama/terpisah pada bagian offsite Google Drive replication/retention; jalur build dan route editorial tidak terdampak.

## Phase D Local D1 Categories Audit

Audit lokal setelah checkpoint Astro 7 menemukan bahwa warning `no such table: categories` berasal dari state D1 lokal yang dipakai `dist/server/wrangler.json`, bukan dari query kategori stale. Runtime Worker Astro 7 memakai generated config melalui short-drive wrapper, sementara perintah migrasi lokal umum (`wrangler d1 migrations ... --config wrangler.toml`) membaca state Miniflare berbeda.

Perbaikan lokal yang divalidasi:

- `db/schema.sql` diterapkan ke D1 lokal milik generated Worker config.
- `npm run worker:local` boot PASS.
- Route `/`, artikel representatif, `/solusi`, `/komparasi`, `/api/search.json`, dan 404 expected PASS tanpa warning `no such table`.
- Helper `npm run worker:local:bootstrap` ditambahkan agar state D1 Worker lokal dapat diinisialisasi eksplisit setelah build/fresh state.

Catatan bootstrap: migration chain historis tidak berdiri sendiri dari zero-state karena `0001_category_taxonomy_expansion.sql` mengasumsikan tabel dasar sudah ada. Base runtime schema tetap `db/schema.sql`; migrasi forward-only tetap dipakai untuk state D1 yang sudah memiliki baseline schema.

## Phase E Fresh D1 Bootstrap Normalization

Phase E menormalkan kontrak bootstrap D1 lokal tanpa mengubah migrasi historis dan tanpa mutasi produksi.

Keputusan kontrak:

- `db/schema.sql` adalah baseline schema snapshot untuk tabel runtime awal dan seed dasar.
- `db/migrations/*` tetap menjadi riwayat evolusi forward-only yang tidak diubah.
- Bootstrap fresh local D1 dilakukan lewat `npm run db:local:bootstrap`.
- Bootstrap Worker lokal dilakukan lewat `npm run worker:local:bootstrap`.
- Bootstrap menerapkan `db/schema.sql`, lalu hanya migrasi historis non-overlap yang dibutuhkan subsystem saat ini, lalu mengisi `d1_migrations` sampai `0012` agar Wrangler tidak memutar ulang migrasi overlap seperti `0004` dan `0012`.

Validasi Phase E:

- Disposable zero-state local D1 bootstrap PASS.
- Wrangler second migration apply melaporkan `No migrations to apply`.
- Bootstrap rerun pada local D1 yang sudah current PASS.
- Fresh Worker runtime dengan disposable D1 PASS untuk `/`, artikel representatif, `/editorial-standards`, `/solusi`, `/komparasi`, `/api/search.json`, `/admin` redirect, dan expected 404.
- Tidak ada warning `no such table`, `no such column`, atau fallback schema selama Worker fresh runtime.
- Automation safety default tetap `OFF`, circuit breakers seeded `CLOSED`, dan tidak ada mutasi produksi.

Tidak ada deploy produksi, tidak ada mutasi D1 produksi, dan tidak ada publish artikel dalam checkpoint ini.

## Phase F Astro 7 Performance Program

Phase F dijalankan setelah Phase E dikomit sebagai baseline bersih:

- Phase E checkpoint commit: `024034755e19106e539f8cc3bb56f666983893d9`.
- Performance checkpoint commit: `16f204e0f00b48b9a153daef5c6d2a389d4bdbd6`.
- Baseline/result docs:
  - `docs/ASTRO_7_PERFORMANCE_BASELINE.md`
  - `docs/ASTRO_7_PERFORMANCE_RESULT.md`

Baseline ringkas:

- Astro `7.3.3`, `@astrojs/cloudflare` `14.3.2`, Vite `8.3.0`, TypeScript `5.9.3`, Wrangler `4.133.0`, Node `24.16.0`.
- Total build before: `3,969,555` bytes.
- Client JS before: `65,932` bytes across 6 files.
- Client CSS before: `0` emitted files / `0` bytes.
- Public reader pages showed no hydrated Astro islands and no measured external scripts in local Worker output.

Optimasi yang diterapkan:

- `src/middleware.ts` tidak lagi menimpa cache header eksplisit untuk route publik non-HTML.
- HTML/admin/admin API tetap `no-cache, no-store, must-revalidate`.
- `/api/search.json` sekarang memberi `Cache-Control: public, max-age=60, s-maxage=300` untuk response kosong maupun query.

Hasil terukur:

- Client JS after: `65,932` bytes (`0` delta).
- Client CSS after: `0` bytes (`0` delta).
- Total build after: `3,969,815` bytes (`+260` bytes server-side middleware/output).
- `/api/search.json` verified memakai short public cache.
- `/sitemap.xml` dan `/rss.xml` mempertahankan public cache header masing-masing.
- Timing Worker lokal dicatat sebagai baseline regresi saja, bukan klaim latency produksi.

Validasi Phase F:

- `node_modules/.bin/tsc.cmd --noEmit` PASS.
- `astro check` PASS: 0 errors, 0 warnings, 280 hints.
- `astro build` PASS dengan warning direct `eval` lama dari `src/lib/dr1/offsite/google-drive.ts`.
- Disposable local D1 bootstrap PASS.
- Local Worker route smoke PASS tanpa D1 schema warnings.
- Route smoke PASS.
- Publisher unit PASS 48/48.
- Publisher local smoke PASS 71/71.
- Planner local smoke PASS 74/74.
- Soak safety local smoke PASS 38/38.
- SEO representative checks PASS untuk title, meta description, canonical, OpenGraph, dan JSON-LD pada page yang relevan.
- Admin regression PASS untuk redirect/auth shell `/admin`.

Batasan:

- Browser/Lighthouse tidak diuji di sandbox; tidak ada klaim Lighthouse atau Core Web Vitals produksi.
- Tidak ada push GitHub, tidak ada deploy Cloudflare, tidak ada mutasi D1/R2 produksi, dan tidak ada publish artikel.
- `AUTO_PUBLISH=OFF` dan `MEDIA_CAN_PUBLISH=NO` tetap dipertahankan.

Gate setelah Phase F:

- `ASTRO7_BASELINE_STILL_STABLE = YES`.
- `READY_FOR_PRODUCTION_RELEASE_REVIEW = YES`, dengan syarat review release terpisah menjalankan browser/Lighthouse nyata dan operator menyetujui push/deploy.
