# 🧩 LokaMedia Extension — Operator Guide (MEDIA-1)

LokaMedia Extension adalah ekstensi browser (Manifest V3) untuk menghubungkan proses generate gambar manual (di ChatGPT DALL-E, Midjourney, Ideogram, dll.) langsung ke media queue **RancangLoka LokaMedia Foundation (MEDIA-0)**.

---

## 🚀 Panduan Pemasangan di Browser (Chrome, Edge, Brave)

1. Buka halaman ekstensi di browser:
   - **Chrome / Brave:** Buka `chrome://extensions/`
   - **Microsoft Edge:** Buka `edge://extensions/`
2. Aktifkan **Developer mode** (toggle di pojok kanan atas).
3. Klik tombol **Load unpacked** (Muat yang belum dibongkar).
4. Pilih folder:
   ```text
   rancangloka-astro/extension
   ```
5. Ikon **LokaMedia** (badge hijau `RL`) akan muncul di toolbar browser Anda. Sematkan (pin) ikon untuk kemudahan akses.

---

## 🛠️ Alur Kerja Operator (Workflow)

1. **Buka LokaMedia Extension:**
   - Klik ikon LokaMedia di toolbar.
   - Pastikan status menunjukkan `● Terhubung`. Jika server berjalan di port lain, klik ⚙️ untuk menyesuaikan Server URL (default: `http://localhost:4321`).
2. **Pilih Antrean Pekerjaan (Media Job):**
   - Pilih artikel yang ingin diberi gambar dari dropdown.
   - Judul, slug artikel, slot gambar (misal: *Featured 16:9*), dan prompt visual otomatis ditampilkan.
3. **Salin Prompt:**
   - Klik tombol **`📋 Salin Prompt`**.
   - Buka ChatGPT atau image generator pilihan Anda, tempel prompt, dan hasilkan gambar.
4. **Intake Gambar (Universal Fallback):**
   - **Tempel Langsung (Ctrl+V):** Klik kanan gambar hasil generate di ChatGPT -> *Copy Image*, lalu fokus ke LokaMedia dan tekan `Ctrl+V`.
   - **Tarik & Lepas (Drag & Drop):** Tarik file gambar dari bar unduhan atau folder ke area dropzone.
   - **Browse:** Klik area dropzone untuk memilih file via file explorer.
5. **Pratinjau & Validasi:**
   - Ekstensi menampilkan resolusi, ukuran (maks. 5 MB), dan format (JPEG, PNG, WebP).
   - Pastikan Alt Text telah terisi dengan deskripsi visual yang sesuai.
6. **Kirim ke RancangLoka:**
   - Klik **`🚀 Kirim ke RancangLoka`**.
   - Sistem akan mengunggah gambar ke Cloudflare R2, mendaftarkan aset di D1 `media_assets`, mengaitkannya ke `article_media`, memperbarui status job menjadi `ATTACHED`, dan mengubah kesiapan editorial menjadi `READY_FOR_REVIEW`.
   - **Status artikel tetap `draft` (tidak pernah dipublikasikan otomatis).**

---

## 🔒 Keamanan & Hak Akses (Zero-Trust)

- Ekstensi ini **TIDAK PERNAH** memiliki password admin, token Cloudflare, secret Hermes Ingest, atau izin deploy.
- Menggunakan token perangkat dedicated dengan scope `media:write:draft` dan `media:device`.
- Server RancangLoka melakukan validasi otoritatif (magic bytes, dimensi riil, SHA-256 hash).
