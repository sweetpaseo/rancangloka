# RancangLoka Repo Context Pack v1

Tempatkan isi pack ini di root project Astro RancangLoka.

Tujuan:
- memberi Codex / Antigravity / coding agent konteks proyek yang sama,
- mengunci arah produksi sebelum integrasi Hermes,
- mencegah agent mengubah arsitektur tanpa memahami keputusan editorial dan biaya,
- menjadikan repo sebagai source of truth, bukan riwayat chat.

## Urutan penggunaan

1. Copy file/folder pack ini ke root repo Astro.
2. Buka project Astro di Codex atau Antigravity.
3. Suruh agent membaca `AGENTS.md` dan seluruh `/docs`.
4. Jalankan prompt `/prompts/ANTIGRAVITY_FIRST_AUDIT.md` atau `/prompts/CODEX_FIRST_AUDIT.md`.
5. Jangan izinkan perubahan file pada audit pertama.
6. Setelah audit struktur aktual selesai, sesuaikan `docs/ARTICLE_CONTRACT.md`.
7. Setelah Article Contract terkunci dan `astro build` lolos, baru setup Hermes.

## Prinsip utama

> RancangLoka adalah media arsitektur dan hunian yang berbicara dengan bahasa orang rumah, tetapi berpikir seperti editor yang paham teknis.

Production harus sederhana, murah, dapat dilacak, tidak bergantung pada banyak model, memakai code untuk pekerjaan deterministic, memakai AI untuk reasoning/editorial, dan memakai evidence secara risk-based.
