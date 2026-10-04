# Hermes Mission Control — Live Operations Layer (MC-LIVEOPS-4)

## Real-Time Operational Event Delivery & Adaptive Client Subscription

**Dokumen Arsitektur & Spesifikasi Teknis v1.0**  
**Milestone:** `MC-LIVEOPS-4`  
**Status:** Canonical & Implemented  
**Target Komponen:** `src/lib/mission-control/events.ts`, `src/pages/api/admin/mission-control/events.ts`, `src/pages/admin/mission-control/office.astro`, `scripts/test-mission-control-liveops-4.js`

---

## 1. Ringkasan Eksekutif & Tujuan Milestone

Tujuan dari milestone **MC-LIVEOPS-4** adalah menyediakan mekanisme pengiriman pembaruan status operasional Mission Control dan Pixel Office secara responsif, akurat, dan efisien tanpa memerlukan reload halaman penuh (*full-page refresh*) dan tanpa memperkenalkan beban infrastruktur yang tidak aman, mahal, atau rentan di lingkungan Cloudflare Workers/Pages SSR.

### Prinsip Utama Single Source of Truth
Transport pengiriman event **BUKAN** merupakan sumber kebenaran kedua (*second source of truth*). Alur arsitektur yang diterapkan:

```
Canonical Domain Event / State Mutation
         ↓
Deterministic Revision & Change Event Cursor
         ↓
Authenticated Read-Only Delivery (GET /api/admin/mission-control/events)
         ↓
Pixel Office Client Receives Change Notification ("Something changed: rev_xyz")
         ↓
Coalesced Refetch of Authoritative Snapshot (/api/admin/mission-control/office)
         ↓
Pixel Office Reconciles Rendering from Truthful Server Snapshot
```

Klien tidak pernah melakukan manipulasi status internal atau mutasi lokal spekulatif semata-mata berdasarkan muatan event ringkas. Snapshot kanonikal `/api/admin/mission-control/office` dan `/api/admin/mission-control/liveops` tetap menjadi satu-satunya otoritas kebenaran operasional.

---

## 2. Analisis Transport & Keputusan Arsitektur

### Evaluasi Opsi Transport

| Kriteria | Opsi A: Versioned Adaptive Polling (Dipilih) | Opsi B: Server-Sent Events (SSE) (Ditolak) | Opsi C: WebSockets / Durable Objects (Ditolak) |
|---|---|---|---|
| **Kesesuaian Cloudflare Edge Runtime** | Sangat Tinggi (stateless edge request standar) | Terbatas (koneksi persisten menahan worker runtime, batas CPU execution time, buffering proxy) | Kompleks (memerlukan Cloudflare Durable Objects berbayar, arsitektur stateful) |
| **Beban & Efisiensi Jaringan** | Sangat Ringan (payload fast-path `< 100 bytes`, `changed: false`, interval adaptif) | Sedang (heartbeat keepalive terus-menerus) | Tinggi (koneksi socket persisten) |
| **Model Autentikasi** | Alami (header cookie session admin standar di setiap HTTP GET) | Rawan (EventSource browser tidak mendukung custom auth header standar tanpa query param token) | Kompleks (handshake auth & token refresh terpisah) |
| **Fail-Closed & Reconnection** | Sederhana & Deterministik (otomatis coba lagi dengan backoff, cursor tidak pernah corrupt) | Rumit (penanganan Last-Event-ID edge proxy, reconnect stampede) | Rumit (reconnection storm, state synchronization) |
| **Kesesuaian Beban Newsroom** | Ideal untuk 1–5 operator editorial Jakarta aktif | Berlebihan (*over-engineering*) | Sangat Berlebihan |

### Keputusan: Versioned Adaptive Polling
Dipilih **Versioned Adaptive Polling dengan Deterministic Event Revision Cursor**.  
Alasan:
1. **Zero Stateful Overhead:** Berjalan mulus di runtime Cloudflare Workers tanpa risiko timeout koneksi persisten atau limit concurrency worker edge.
2. **Deterministic Revision Token:** Server menghitung hash SHA-256 ringkas dari status terkini (tindakan operator terbaru, anomali aktif terbaru, pesan chat terbaru, dan transisi task artikel pipeline).
3. **Bandwidth Efisien:** Saat tidak ada perubahan, endpoint mengembalikan `{"changed": false, "revision": "rev_...", "events": []}` dengan ukuran payload `< 100 bytes`.
4. **Adaptive Cadence:** Frekuensi pengecekan menyesuaikan aktivitas:
   - Sesi aktif / baru ada mutasi: 2.500 ms (2,5 detik).
   - Kantor tenang (*quiet office*): mundur bertahap ke 12.000 ms (12 detik).
   - Tab disembunyikan/latar belakang (*hidden tab*): melambat ke 45.000 ms (45 detik).
   - Tindakan operator baru saja dikonfirmasi atau tab kembali aktif: sinkronisasi seketika (*immediate tick*).

---

## 3. Kontrak Data & Derivasi Revisi Kanonikal

### Tipe Data Event Envelope

```typescript
export interface OperationalEventEnvelope {
  event_id: string;        // ID unik deterministik (misal: "evt_act_uuid" atau "evt_anom_uuid")
  event_type: string;      // Tipe event kanonikal: "OPERATOR_ACTION", "ANOMALY_STATUS", "CHAT_MESSAGE", "PIPELINE_TRANSITION"
  occurred_at: string;     // ISO timestamp kanonikal
  scope: string;           // Lingkup: "operator_actions", "anomalies", "staff_chat", "pipeline"
  target_id?: string;      // ID target terkait (action_id, anomaly_id, message_id, task_id)
  revision: string;        // Hash revisi kanonikal saat event dipancarkan
}

export interface OperationalEventsResponse {
  changed: boolean;
  revision: string;
  server_timestamp: string;
  events: OperationalEventEnvelope[];
}
```

### Logika Derivasi Token Revisi (`deriveCanonicalRevision`)
Token revisi dihitung secara murni deterministik menggunakan SHA-256 dari kompilasi:
- ID dan status tindakan operator terakhir dari audit log (`lastAction?.action_id`, `lastAction?.target_id`, `lastAction?.status`).
- Anomali aktif paling baru atau open anomaly count (`latestAnomaly?.id`, `latestAnomaly?.status`).
- ID pesan staff chat terbaru (`latestMessage?.id`).
- ID dan stage task pipeline aktif saat ini (`activeTask?.task_id`, `activeTask?.stage`).

Jika semua parameter di atas identik, token revisi yang dihasilkan dijamin 100% identik (`rev_<16_char_hash>`). Tidak ada penggunaan angka acak, UUID spekulatif, atau timestamp floating yang dapat menyebabkan *false-positive cache invalidation*.

---

## 4. Keamanan & Kebijakan Akses Endpoint

Endpoint: `GET /api/admin/mission-control/events`

1. **Autentikasi Ketat:** Memvalidasi cookie sesi admin via `isValidAdminSession(request)`. Jika tidak valid, langsung mengembalikan status `401 Unauthorized` dengan payload JSON aman.
2. **Media-Device Firewall:** Permintaan dari media device dengan peran `device_ingest` atau sejenisnya ditolak dengan status `403 Forbidden` (`MC-V2-SEC-1`).
3. **Metode Terbatas (Read-Only):** Hanya mendukung `GET`. Permintaan `POST`, `PUT`, `DELETE` ditolak dengan status `405 Method Not Allowed`.
4. **Zero Mutation Authority:** Endpoint ini bersifat *pure query* dan tidak menjalankan mutasi basis data apa pun.

---

## 5. Implementasi Klien Pixel Office & Adaptive Subscriber

Di halaman `src/pages/admin/mission-control/office.astro`:

1. **Telemetry Status Badge:** Ditambahkan indikator visual non-intrusif di header Pixel Office:
   - `● LIVE`: Terhubung, revisi terbaru tersinkronisasi.
   - `⟳ SYNCING`: Sedang memeriksa event atau mengambil snapshot terbaru.
   - `⚠ STALE`: Terjadi kegagalan jaringan atau keterlambatan respon, mempertahankan status terakhir yang valid.
   - `○ OFFLINE`: Sesi terputus atau jaringan lokal tidak terhubung.
2. **Event Coalescing & Debouncing:**
   - Ketika notifikasi perubahan diterima, klien tidak langsung membanjiri server dengan permintaan snapshot ganda.
   - Fungsi `triggerSnapshotRefetch()` menggunakan debounce 120 ms. Jika terdapat 5 event perubahan dalam interval 300 ms, klien hanya mengeksekusi 1 kali pembaruan snapshot kanonikal.
3. **Siklus Hidup Tab (Page Visibility API):**
   - Event listener `visibilitychange` mendeteksi kapan tab berada di latar belakang.
   - Saat disembunyikan: interval polling diperpanjang ke 45 detik untuk menghemat sumber daya CPU browser dan kuota Cloudflare.
   - Saat tab kembali dibuka (*visible*): interval direset ke 2,5 detik dan seketika memicu pemeriksaan event terbaru.
4. **Integrasi Tindakan Operator (MC-LIVEOPS-3):**
   - Setelah operator mengonfirmasi tindakan pada modal workstation, klien memanggil `checkOperationalEvents(true)` untuk sinkronisasi instan tanpa menunggu siklus interval berikutnya.

---

## 6. Safety Invariants & Persona Boundaries

Sesuai aturan operasional RancangLoka dan Hermes Mission Control:

| Parameter Keselamatan | Nilai Wajib | Keterangan |
|---|---|---|
| `automation_mode` | `OFF` | Dilarang memicu eksekusi otonom melalui saluran event delivery |
| `SOCIAL_AUTOMATION` | `OFF` | Departemen Social tetap unstaffed dan nonaktif |
| `publishingAuthority` | `0` | Tidak ada otoritas publikasi otomatis yang diberikan kepada subscriber |
| `JEV_MODE` | `shadow` | TypeSafe Jev tetap beroperasi secara bayangan (non-blocking) |
| `mediaWorker` | `DISABLED` | Media worker tetap dinonaktifkan tanpa izin mutasi live |
| `Jefry Authority` | `NONE` (0 Otoritas Eksekusi) | Jefry hanya entitas penasihat keputusan; dilarang menerima kapabilitas eksekusi |

---

## 7. Hasil Pengujian & Verifikasi

Suite pengujian khusus `scripts/test-mission-control-liveops-4.js` mencakup 15 pengujian terarah:

1. **Deterministic Revision Derivation:**
   - Identical system state menghasilkan 100% revision token yang identik.
   - Empty/initial snapshot menghasilkan token fallback aman yang valid.
2. **Revision Cursor & Change Detection:**
   - Permintaan awal tanpa parameter `since_revision` mengembalikan `changed: true` beserta envelopes.
   - Permintaan berikutnya dengan `since_revision` yang sama persis mengembalikan `changed: false` dan 0 envelopes.
3. **Observable Mutations Change Revision:**
   - Eksekusi tindakan operator memperbarui revision token kanonikal.
   - Perubahan status/pembuatan anomali memperbarui revision token kanonikal.
   - Transisi task pipeline memperbarui revision token kanonikal.
4. **Read-Only Invariants & Coalescing:**
   - Endpoint dan helper event delivery strictly mengeksekusi zero database writes.
   - Hash komputasi bebas dari random drift / Math.random.
5. **Safety Invariants:**
   - Semua boundary keselamatan (`automation_mode = OFF`, `SOCIAL_AUTOMATION = OFF`, `publishingAuthority = 0`, `JEV_MODE = shadow`, `mediaWorker = DISABLED`, Jefry authority = NONE) terverifikasi valid dan tidak terpengaruh.

---

*Dokumen ini diterbitkan pada 4 Oktober 2026 sebagai bukti verifikasi penyelesaian milestone MC-LIVEOPS-4.*
