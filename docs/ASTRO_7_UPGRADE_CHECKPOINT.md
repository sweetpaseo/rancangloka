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

## Catatan

Build masih menampilkan warning non-fatal direct `eval` dari `src/lib/dr1/offsite/google-drive.ts`. Warning ini tidak terkait langsung dengan Astro 7 upgrade dan tidak memblokir build, tetapi sebaiknya dirapikan saat fase DR-1/backup berikutnya.

DR-1 infrastructure manifest metadata sudah diselaraskan ke Astro 7 (`astro_7_ssr`, compatibility date `2024-09-23`, entrypoint `@astrojs/cloudflare/entrypoints/server`, asset binding `ASSETS`). Test suite DR-1 masih memiliki kegagalan lama/terpisah pada bagian offsite Google Drive replication/retention; jalur build dan route editorial tidak terdampak.

Tidak ada deploy produksi, tidak ada mutasi D1 produksi, dan tidak ada publish artikel dalam checkpoint ini.
