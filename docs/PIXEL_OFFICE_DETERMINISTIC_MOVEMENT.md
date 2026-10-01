# 🗺️ Pixel Office V2.3 — Deterministic Staff Movement & Central-Hall Route Graph

> **Hermes Mission Control — Spatial Observability & Navigation Architecture**  
> **Status:** Canonical Release Candidate (V2.3)  
> **Base Commit:** `990df5d06927932394183266740e6bda2efebc10`

---

## 1. Prinsip Utama: Observabilitas Murni (Truth-First)

Movement layer di Pixel Office V2.3 dirancang dengan satu prinsip mutlak:
> **NO REAL STATE TRANSITION = NO STAFF MOVEMENT.**

Sistem ini **TIDAK PERNAH** memanufaktur aktivitas buatan:
- ❌ **Tidak ada random walking** (jalan acak tanpa tujuan).
- ❌ **Tidak ada ambient wandering** (berkeliaran di koridor untuk terlihat ramai).
- ❌ **Tidak ada fake office traffic** (lalu lintas boneka).
- ❌ **Tidak ada random delay** (jeda buatan untuk mensimulasikan kesibukan).

Pergerakan staf adalah **representasi visual deterministik** dari perubahan status operasional nyata di database Cloudflare D1.

---

## 2. Peta Topologi & Graf Rute (Route Graph)

Graf navigasi merefleksikan arsitektur kantor fisik RancangLoka dengan Koridor Sentral (*Central Hallway*) sebagai tulang punggung sirkulasi utama:

```text
┌───────────────────────────────────────────────────────────────┐
│                    RANCANGLOKA HEADQUARTERS                   │
│                                                               │
│   [ SAYAP KIRI ]              [ KORIDOR SENTRAL ]    [ SAYAP KANAN ]
│                                                               │
│   EDITORIAL                   HALL_LEVEL_1           RESEARCH LAB
│   - editorial_writer_desk (Joko)   │                 - research_main_desk (Irwan)
│   - editorial_review_desk (Rina)   │                 - research_door
│   - editorial_door ───────────────┼─────────────────┘
│                                    │
│   LOKAMEDIA STUDIO            HALL_LEVEL_2           OPERATIONS & JEV
│   - media_console (Budi)           │                 - operations_console (Dimas)
│   - media_door ───────────────────┼─────────────────┘
│                                    │
│   PUBLICATION OPS             HALL_LEVEL_3           EXECUTIVE LOUNGE
│   - publication_console (Sari)     │                 - lounge_seats (1-6)
│   - publication_door ─────────────┼─────────────────┘
│                                    │
│                               HALL_SOUTH
│                                    │
│                            ZONE_S_THRESHOLD
│                                    │
│                           [ SOUTHERN ANNEX ]
│                           social_door
│                           social_workstation (Maya)
└───────────────────────────────────────────────────────────────┘
```

### Simpul Graf Kanonikal (Canonical Nodes)

| Node ID | Lokasi Ruang | Level | Sayap | Koordinat (X%, Y%) | Keterangan |
| :--- | :--- | :---: | :---: | :---: | :--- |
| `hall_level_1` | Koridor Sentral | 1 | CENTER | (50%, 16%) | Simpul penghubung lantai atas |
| `hall_level_2` | Koridor Sentral | 2 | CENTER | (50%, 45%) | Simpul penghubung lantai tengah |
| `hall_level_3` | Koridor Sentral | 3 | CENTER | (50%, 72%) | Simpul penghubung lantai bawah |
| `hall_south` | Koridor Sentral | 4 | CENTER | (50%, 84%) | Ujung selatan koridor |
| `zone_s_threshold` | Koridor Sentral | 4 | CENTER | (50%, 89%) | Ambang pintu Zone S |
| `editorial_door` | Editorial Room | 1 | LEFT | (40%, 16%) | Pintu fisik timur Editorial |
| `editorial_writer_desk`| Editorial Room | 1 | LEFT | (16%, 16%) | Meja penulisan Joko |
| `editorial_review_desk`| Editorial Room | 1 | LEFT | (28%, 16%) | Meja review naskah Rina |
| `media_door` | LokaMedia Studio | 2 | LEFT | (40%, 45%) | Pintu fisik timur Media Studio |
| `media_console` | LokaMedia Studio | 2 | LEFT | (21%, 45%) | Konsol Canvas Pro Budi |
| `publication_door` | Publication Ops | 3 | LEFT | (40%, 72%) | Pintu fisik timur Publikasi |
| `publication_console` | Publication Ops | 3 | LEFT | (21%, 72%) | Konsol Dispatch Sari |
| `research_door` | Research Lab | 1 | RIGHT | (60%, 16%) | Pintu fisik barat Riset |
| `research_main_desk` | Research Lab | 1 | RIGHT | (77%, 16%) | Konsol Riset Irwan |
| `operations_door` | Operations & JEV| 2 | RIGHT | (60%, 45%) | Pintu fisik barat Operasi |
| `operations_console` | Operations & JEV| 2 | RIGHT | (77%, 45%) | Konsol Telemetri Dimas |
| `lounge_door` | Executive Lounge| 3 | RIGHT | (60%, 72%) | Pintu fisik barat Lounge |
| `lounge_seat_1..6` | Executive Lounge| 3 | RIGHT | (71-89%, 69-76%) | Kursi santai / siaga staf |
| `social_door` | Social Distribution| 4 | ANNEX | (50%, 91%) | Pintu masuk Zone S (Terkunci)|
| `social_workstation` | Social Distribution| 4 | ANNEX | (42%, 95%) | Meja kerja Maya (Standby) |

---

## 3. Batasan Fisik Bangunan (No Wall Crossing)

Graf jalur dirancang secara topologis sehingga karakter **TIDAK MUNGKIN MENEMBUS DINDING**:
1. Ruangan sayap kiri (Editorial, Media, Publikasi) tidak memiliki jalur langsung ke sayap kanan.
2. Seluruh perjalanan lintas ruangan **wajib** melalui:
   `Meja Asal → Pintu Ruangan → Koridor Sentral (Level N) → Pintu Tujuan → Meja Tujuan`.
3. Contoh rute dari Lounge ke Editorial:
   `lounge_seat_1` → `lounge_door` → `hall_level_3` → `hall_level_2` → `hall_level_1` → `editorial_door` → `editorial_writer_desk`.
4. Contoh rute dari Riset ke Publikasi:
   `research_main_desk` → `research_door` → `hall_level_1` → `hall_level_2` → `hall_level_3` → `publication_door` → `publication_console`.

---

## 4. Algoritma Pencarian Jalur (Deterministic Pathfinding)

Pencarian rute menggunakan algoritma **Breadth-First Search (BFS)** murni dengan aturan pemecah seri leksikografis (*lexicographical tie-breaking*).

- **Zero Randomness:** Dua simpul yang sama akan selalu menghasilkan rute yang 100% identik di setiap eksekusi.
- **Kompleksitas:** $\mathcal{O}(V + E)$ di mana graf sangat ringkas ($V \approx 20, E \approx 24$), dieksekusi dalam sub-milidetik (< 0.1 ms).

---

## 5. Kebijakan Transisi Status & Perilaku Staf

| Transisi Status Operasional | Tindakan Pergerakan | Mode Visual | Penjelasan |
| :--- | :---: | :---: | :--- |
| **Initial Page Load / Refresh** | `NONE` | `STATIONARY` | Karakter langsung ditempatkan di workstation / Lounge sesuai status kanonikal saat ini. **Tidak ada replay perjalanan fiktif**. |
| **IDLE → WORKING (RUNNING)** | `START_JOURNEY` | `WALKING_TO_WORK` | Staf bangkit dari Lounge, berjalan melalui Koridor Sentral menuju meja kerjanya. Animasi kerja dimulai setelah tiba. |
| **WORKING → IDLE (COMPLETED)**| `START_JOURNEY` | `WALKING_TO_LOUNGE`| Pekerjaan selesai, staf meninggalkan meja kerja, melewati koridor, dan kembali siaga di Lounge. |
| **QUEUED Task Arrives** | `NONE` | `STATIONARY` | Tugas yang masih dalam antrean (`QUEUED`) **TIDAK** memicu pergerakan. Staf tetap di Lounge sampai tugas benar-benar `RUNNING`. |
| **WORKING → BLOCKED** | `NONE` | `STATIONARY` | Jika tugas terhambat saat staf sedang di workstation, staf tetap berada di meja kerjanya dengan tanda peringatan kritis. Tidak dipulangkan ke Lounge secara fiktif. |
| **Perubahan Status Saat di Jalan**| `REROUTE` | `REROUTING` | Jika tugas baru datang saat staf sedang jalan pulang ke Lounge, rute langsung dihitung ulang dari simpul tempat staf berada saat itu (*no teleportation*). |
| **Media Worker DISABLED** | `NONE` | `STATIONARY` | Budi berstatus *Intentional Disabled*, tetap offline di posisinya tanpa animasi jalan. |
| **Social Distribution HOLDING** | `NONE` | `STATIONARY` | Zone S terkunci (*Account Required*), Maya tetap siaga di Zone S tanpa pergerakan. |

---

## 6. Jalur Koridor Dua Arah (Hallway Lane Model)

Untuk mencegah karakter bertubrukan langsung saat berpapasan di Koridor Sentral:
- **Northbound (Menuju Utara):** Berjalan di lajur kiri koridor ($x = 48.2\%$).
- **Southbound (Menuju Selatan):** Berjalan di lajur kanan koridor ($x = 51.8\%$).
- **Micro-staggering:** Setiap staf memiliki offset horizontal kecil deterministik berdasarkan `staffIndex % 3`.

---

## 7. Aksesibilitas (`prefers-reduced-motion`)

Sistem sepenuhnya menghormati preferensi pengguna untuk pengurangan gerakan:
- Jika `prefers-reduced-motion: reduce` aktif, perpindahan antar-simpul dilakukan secara instan tanpa transisi lerp/bob.
- Seluruh informasi status, tujuan, dan telemetri tetap 100% terbaca melalui teks dan panel inspektor.
