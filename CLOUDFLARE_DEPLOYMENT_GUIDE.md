# ☁️ Cloudflare Deployment & Architecture Guide (Master Reference)

> **PENTING / PERHATIAN UNTUK AI & DEVELOPER:**
> Project **RancangLoka** di-hosting di **Cloudflare Workers (Workers Builds CI)** dengan fitur **Static Assets**, **BUKAN Cloudflare Pages**.
> Jangan pernah mengubah konfigurasi ini menjadi Cloudflare Pages command (`wrangler pages deploy`) karena akan menyebabkan error `Project not found [code: 8000007]`.

---

## 🏗️ 1. Arsitektur Infrastruktur

| Komponen | Spesifikasi Cloudflare | Konfigurasi Repository |
|---|---|---|
| **Hosting & Runtime** | **Cloudflare Workers** (Bukan Pages) | `wrangler.toml` (`main` + `assets`) |
| **SSR Entrypoint** | Astro Cloudflare SSR Output | `dist/_worker.js/index.js` |
| **Static Assets** | Workers Static Assets | `dist/` |
| **Database** | Cloudflare D1 (SQLite Edge) | Binding `DB` (`rancangloka_db`) |
| **Media Storage** | Cloudflare R2 Bucket | Binding `MEDIA_BUCKET` (`rancangloka-media`) |

---

## ⚙️ 2. Standar Konfigurasi `wrangler.toml` (JANGAN DIUBAH KE PAGES)

File [`wrangler.toml`](file:///wrangler.toml) wajib mengikuti format Workers dengan Assets berikut:

```toml
name = "rancangloka"
main = "dist/_worker.js/index.js"
assets = { directory = "dist" }
compatibility_date = "2024-09-01"
compatibility_flags = ["nodejs_compat"]

# Cloudflare D1 Database Binding
[[d1_databases]]
binding = "DB"
database_name = "rancangloka_db"
database_id = "3a86e9ad-410f-4440-884e-2eb813ec4cf7"

# Cloudflare R2 Object Storage Binding (for covers & media)
[[r2_buckets]]
binding = "MEDIA_BUCKET"
bucket_name = "rancangloka-media"
```

> ⚠️ **DILARANG:** Menambahkan `pages_build_output_dir = "dist"` ke dalam `wrangler.toml` karena akan membuat Wrangler salah mendeteksi project sebagai Pages dan memblokir `wrangler deploy`.

---

## 🖥️ 3. Pengaturan Wajib di Cloudflare Dashboard

Lokasi menu: **Cloudflare Dashboard ➔ Compute ➔ Workers & Pages ➔ rancangloka ➔ Settings ➔ Builds**

### A. Build Configuration
- **Build command:** `npm run build`
- **Deploy command:** `npx wrangler deploy`
- **Root directory:** `/`

### B. API Token Permissions (`rancangloka build token`)
Token yang digunakan untuk CI build harus memiliki hak akses minimal:
- `Account` ➔ `Workers Scripts` ➔ `Edit`
- `Account` ➔ `Workers R2 Storage` ➔ `Edit`
- `Account` ➔ `D1` ➔ `Edit`
- `Account` ➔ `Cloudflare Pages` ➔ `Edit` (untuk kompatibilitas)

---

## 🚀 4. Perintah Deployment Lokal & CI

```bash
# 1. Build project lokal
npm run build

# 2. Uji kesiapan deploy (Dry Run)
npx wrangler deploy --dry-run

# 3. Deploy langsung via terminal (jika login wrangler)
npm run deploy
# (Script npm run deploy menjalankan: astro build && wrangler deploy)
```

---

## 🔍 5. Troubleshooting & Root Cause History

1. **Error `✘ It looks like you've run a Workers-specific command in a Pages project`:**
   - **Penyebab:** Ada `pages_build_output_dir` di `wrangler.toml`.
   - **Solusi:** Ganti `pages_build_output_dir` dengan `main = "dist/_worker.js/index.js"` dan `assets = { directory = "dist" }`.

2. **Error `✘ Project not found [code: 8000007]` saat `wrangler pages deploy`:**
   - **Penyebab:** Menjalankan perintah Pages pada resource yang terdaftar sebagai Worker di Cloudflare.
   - **Solusi:** Gunakan `npx wrangler deploy`.
