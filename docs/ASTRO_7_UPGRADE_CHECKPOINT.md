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

## Catatan

Build masih menampilkan warning non-fatal direct `eval` dari `src/lib/dr1/offsite/google-drive.ts`. Warning ini tidak terkait langsung dengan Astro 7 upgrade dan tidak memblokir build, tetapi sebaiknya dirapikan saat fase DR-1/backup berikutnya.

DR-1 infrastructure manifest metadata sudah diselaraskan ke Astro 7 (`astro_7_ssr`, compatibility date `2024-09-23`, entrypoint `@astrojs/cloudflare/entrypoints/server`, asset binding `ASSETS`). Test suite DR-1 masih memiliki kegagalan lama/terpisah pada bagian offsite Google Drive replication/retention; jalur build dan route editorial tidak terdampak.

Tidak ada deploy produksi, tidak ada mutasi D1 produksi, dan tidak ada publish artikel dalam checkpoint ini.
