# 🚀 RancangLoka & Hermes — Master Engineering & System Context

> **PANDUAN UTAMA / FIRST-READ INSTRUCTION UNTUK AI AGENT (ANTIGRAVITY / GEMINI)**
> **PERINGATAN:** Wajib membaca dokumen ini di awal setiap sesi sebelum menganalisis atau mengubah kode di workspace ini!

---

## 1. Identitas & Visi Proyek RancangLoka

* **Apa itu RancangLoka?**
  Media digital Indonesia independen yang fokus pada arsitektur, hunian, material bangunan, renovasi, dan problem solving desain rumah.
* **Prinsip Editorial:**
  *"Media arsitektur dan hunian yang berbicara dengan bahasa orang rumah, tetapi berpikir seperti editor yang paham teknis."*
* **Tone of Voice (*Human Voice Layer v2 / Jakarta Editorial*):**
  Bahasa Indonesia sehari-hari yang alami, jelas, lugas, dan tidak kaku. Hindari jargon akademis berlebih, bahasa brosur marketing, dan teks klise AI generik (*anti-slop*).
* **Kebijakan Bukti (*Evidence-First* & *Monetary Silence*):**
  * Dilarang mengarang klaim teknis, statistik, hasil uji lab, atau sumber fiktif.
  * **Monetary Silence:** Dilarang melempar estimasi harga/biaya tanpa riset empiris akurat.

---

## 2. Peta Arsitektur & Teknologi Lengkap

Proyek ini terdiri dari 4 lapisan teknologi yang saling terhubung:

### A. Web Application & Production Edge (`rancangloka-astro/`)
* **Framework:** [Astro](file:///c:/Users/Fanto/Desktop/antigravity/rancangloka/rancangloka-astro/package.json) (v7.3.3, Mode SSR) + Tailwind CSS + Lucide Icons (`@lucide/astro`).
* **Cloudflare Workers Edge Runtime:** Menggunakan adapter `@astrojs/cloudflare`.
* **Database (Cloudflare D1):** SQLite di edge untuk tabel artikel, kategori, tags, metadata, audit log, dan ingest receipts.
* **Storage (Cloudflare R2):** Penyimpanan aset media gambar/foto autentik.
* **Fitur Utama:**
  * Halaman publik: Beranda, artikel dinamis (`/[slug]`), komparasi, solusi, RSS feed (`/rss.xml`), SEO sitemap news/pages.
  * Panel Admin (`/admin`, `/admin/posts`): Manajemen artikel, server-side filtering & sorting, edit route, login & auth.
  * Ingestion API (`/api/internal/v1/hermes-ingest.ts`): Webhook berautentikasi HMAC untuk menerima draf artikel otomatis dari pipeline.

### B. Safety & Publication Engine (`rancangloka-astro/src/lib/safety/` & `src/lib/publication/`)
* **Automation Controller:** Mengelola capability matrix (`OFF`, `OBSERVE_ONLY`, `PLAN_ONLY`, `CONTROLLED`, `UNATTENDED`).
* **Emergency Kill Switch:** Saklar darurat global untuk menghentikan seluruh mutasi publikasi otomatis.
* **Circuit Breaker:** Pelindung kegagalan sistemik dengan siklus status `CLOSED`, `OPEN`, dan `HALF_OPEN`.
* **Rate Limiter & Safety Envelopes:** Pembatas kapasitas harian dan jeda publikasi antar-artikel.
* **First Article Gate:** Checklist pra-penerbitan 13 kriteria ketat untuk verifikasi artikel autentik.
* **Run Ledger:** Read-model terkonsolidasi untuk observabilitas siklus hidup artikel.
* **Publisher & Planner Services:** Penjadwalan cerdas berbasis kuota dinamis, mitigasi kanibalisasi topik, dan jaminan *atomic dispatch*.

### C. Decision Engine: TypeSafe Jev (`rancangloka-astro/src/lib/decision/`)
* **Model:** `typesafe/jev-1.13` (versi snapshot server: `20260917`).
* **Transport:** OpenRouter Decisions API (`POST https://openrouter.ai/api/alpha/decisions`).
* **Status:** **SHADOW MODE ONLY (`JEV_MODE=shadow`)**.
* **Fungsi:** Menilai kandidat artikel secara asinkron (*non-blocking*) berdasarkan 3 pertanyaan terstruktur:
  1. `nextAction` (*choice*): Rekomendasi tindakan (`continue`, `revise`, `human_review`, `stop`).
  2. `needsHumanReview` (*noul*): Probabilitas perlunya verifikasi Chief Editor.
  3. `publicationRisk` (*choice*): Tingkat risiko (`very_low`, `low`, `medium`, `high`, `critical`).
* **Aturan Khusus (*Minimal State Principle*):** Jev HANYA menerima sinyal metadata faktual ringkas (status validasi, ada/tidaknya referensi, gambar, slug unik), **BUKAN naskah artikel utuh**.
* **Zero Authority:** Rekomendasi Jev tidak boleh mengubah, menahan, atau menerbitkan artikel. Logika deterministik RancangLoka tetap menjadi otoritas tunggal (100% *fail-safe*).

### D. AI Editorial Lab & Remote Hermes Container (`/opt/hermes` di Sumopod)
* **Model Editorial:** GPT-5.6 Luna via SumoPod API (`SUMOPOD_API_KEY`).
* **Pipeline Alur:** *Topic/Ideation → Editorial Planner → Source & Evidence Pack Compiler → Writer → Blind QA (Stateless) → Targeted Repair → Deterministic Guards*.
* **Remote Container Hermes:**
  * Menjalankan daemon agent dengan init process `s6-overlay`.
  * Node.js v26.5.1 + Python 3 virtual environment (`/opt/hermes/.venv/`).
  * Workspace data berada di `/opt/data/rancangloka`.
  * MCP Bridge `rancangloka-hermes` menghubungkan Antigravity IDE ke container Hermes.

---

## 3. Aturan Keselamatan Produksi Wajib (Safety Invariants)

1. **`AUTO_PUBLISH = OFF`:** Semua artikel dari pipeline AI berhenti di status **`DRAFT`**. Penerbitan ke publik wajib melalui persetujuan manual manusia (*Human Approval*).
2. **`JEV_MODE = shadow`:** Dilarang mengaktifkan `active` mode untuk Jev sebelum pengujian evaluasi jangka panjang disetujui operator.
3. **Kerahasiaan Kunci (*Zero Secret Leaks*):**
   * Dilarang mencetak, menampilkan, mencatat (*log*), atau me-commit API Key (`OPENROUTER_API_KEY`, `SUMOPOD_API_KEY`, token bridge).
   * File `.env` bersifat lokal dan dilarang masuk ke Git (*strictly gitignored*).
4. **Target Repository yang Otoritatif:**
   * Repository pengembangan utama adalah: `rancangloka-astro/`.
   * Branch aktif untuk integrasi keputusan: `feat/jev-lokamedia-integration`.
5. **Obsidian Knowledge Hub & Long-Term Memory Invariant:**
   * Vault resmi memori jangka panjang dan basis pengetahuan redaksi berlokasi di `rancangloka-astro/docs/` (Indeks utama: `docs/HOME.md` dan arsip artikel terbit: `docs/articles/`).
   * Setiap kali ada keputusan redaksi penting, pembaruan pedoman arsitektur, riset baru, atau artikel yang resmi diterbitkan, AI agent wajib memutakhirkan/menyinkronkan catatan di vault Obsidian.
   * Sebelum meriset atau menulis artikel baru, AI agent wajib membaca dan merujuk ingatan di vault Obsidian guna mencegah duplikasi riset, menghemat kuota token, serta menjaga konsistensi suara redaksi.
6. **Batas Peran Redaksi Ketat & Larangan Peniruan Penulis (DEC-09):**
   * **Larangan Menulis bagi Gravy:** Gravy (Antigravity AI Assistant) DILARANG KERAS menulis atau merumuskan prosa naskah artikel atas nama Joko. Tanggung jawab Gravy terbatas pada rekayasa perangkat lunak (engineering), integrasi, orkestrasi pipeline, dan troubleshooting teknis.
   * **Joko Penulis Tunggal:** Joko (`content_writer_primary`) adalah satu-satunya juru tulis resmi artikel RancangLoka yang wajib dieksekusi melalui runtime Hermes dan model LLM terkonfigurasi (SumoPod GPT-6 Luna).
   * **Larangan Rekayasa & Fabrikasi:** Dilarang meng-hardcode teks prosa artikel ke dalam skrip, menggantikan output Joko dengan output Gravy, mensimulasikan eksekusi penulisan Joko, memalsukan skor evaluasi semantik Nadia, atau memalsukan receipt eksekusi staf.
   * **Evaluasi Semantik Nyata Nadia:** Nadia wajib mengevaluasi naskah Joko secara semantik nyata. Revisi naskah wajib dilakukan oleh Joko.
   * **Pembelajaran Berkelanjutan:** Umpan balik editorial dan pelajaran yang dipetik wajib disimpan ke Primary & Second Brain agar performa Joko meningkat di masa depan.
   * **Invarian Fail-Stop:** Jika Joko tidak dapat mengeksekusi penulisan, sistem wajib **BERHENTI DAN MELAPOR (FAIL-STOP & REPORT)** kepada Owner. Dilarang menggantikan Joko dengan penulis tiruan.
   * **Otorisasi Biaya API:** Seluruh pemanggilan model LLM berbayar wajib mendapatkan persetujuan pagu anggaran eksplisit dari Owner.
7. **Konsolidasi Final Editorial, Dua Benchmark & Kedaulatan Pembaca (DEC-10):**
   * **Dua Benchmark Editorial Saling Melengkapi:** Golden Article #9993 (*Troubleshooting Guide*) dan Supplementary Benchmark #10019 (*Material Comparison & Decision Guide*, L4 Santai Berisi: *"Berisi seperti ahli, ngobrol seperti teman"*).
   * **Kedaulatan Evaluasi Pembaca Manusia:** Skor evaluator AI internal (Nadia/Rina) bersifat penasihat (*advisory*). Skor evaluator TIDAK BOLEH mengesampingkan evaluasi keterbacaan riil dari Owner / Chief Editor. Naskah revisi dengan skor 72/100 dikonfirmasi Owner lebih ringan, mengalir, dan nyaman dibaca dibanding draf sebelumnya. Dilarang menjadikan benchmark sebagai templat kaku atau menambah aturan penulisan mekanis baru.
   * **Invarian Media Visual MAA-V1 & Zero Broken Images:** MAA-V1 adalah otoritas tunggal penempatan media visual artikel (`components.inline_media.items`). Seluruh sintaks gambar Markdown mentah (`![...](slot_...)`) dari output Joko wajib dibersihkan secara otomatis oleh assembler agar tidak memicu broken image di browser. Naskah mentah model disimpan terpisah secara abadi (*immutable*) dari proyeksi naskah bersih hasil rakitan modular. Seluruh gambar wajib valid, decode sukses, dan 200 OK.
8. **Invarian Sinkronisasi Tiga Lapisan & Cegah Silent Drift (DEC-23):**
   * **`LOCAL_VERIFIED != STAGING_VERIFIED != HOSTED_RUNTIME_VERIFIED`**.
   * Pekerjaan pengembangan (development task) yang memengaruhi operasional hosted Hermes TIDAK BOLEH dinyatakan selesai secara operasional (*operationally complete*) apabila runtime target di SumoPod masih menggunakan versi lama.
   * Setiap perubahan yang memengaruhi operasional hosted Hermes wajib memiliki status pelacakan sinkronisasi dan verifikasi runtime terpisah:
     - `LOCAL_VERIFIED`: Lulus typecheck, unit test, dan uji coba lokal.
     - `STAGING_VERIFIED`: Berhasil dideploy dan tervalidasi pada Cloudflare Staging edge (`rancangloka-staging`).
     - `HOSTED_RUNTIME_VERIFIED`: Kode sumber telah disinkronkan ke runner hosted Hermes (`/opt/data/rancangloka-runner`) dan diverifikasi lulus regression test di lingkungan SumoPod.
   * **Observabilitas Dimas & Supervisi JEV:** Dimas (`telemetry_observer_jev`) memantau divergensi versi runtime hosted terhadap baseline staging/origin untuk memastikan JEV dan Owner mendapatkan sinyal telemetri peringatan dini jika runtime operasional tertinggal (*silent version drift prevention*).

---

## 4. Perintah Validasi & Testing Cepat

Semua pengujian dijalankan dari direktori `rancangloka-astro/`:

```bash
# 1. Jalankan pengujian keselamatan SOAK-0 (54 tes)
node scripts/test-soak-safety.js

# 2. Jalankan pengujian publication planner (67 tes)
node scripts/test-publication-planner.js

# 3. Jalankan pengujian publication publisher (48 tes)
node scripts/test-publication-publisher.js

# 4. Jalankan pengujian decision engine TypeSafe Jev (18 tes)
node scripts/test-decision-engine.js

# 5. Jalankan pengujian decision router & cost simulation (14 tes)
node scripts/test-decision-router.js

# 6. Jalankan pengujian decision telemetry (8 tes)
node scripts/test-decision-telemetry.js

# 7. Jalankan pengujian generic media planning decision point (16 tes)
node scripts/test-decision-media-planning.js

# 8. Uji live konektivitas Jev OpenRouter (membutuhkan OPENROUTER_API_KEY)
node scripts/smoke-jev-openrouter.js

# 9. Jalankan pengujian LokaMedia Pipeline & Retry Architecture (MEDIA-A5):
node scripts/test-media-a5-orchestrator.js    # Orchestrator & minimal stage resume (18 tes)
node scripts/test-media-a5-durable-retry.js   # Durable retry accounting & OCC (17 tes)
node scripts/test-media-a5-retry-policy.js    # Retry classification policy (25 tes)
node scripts/test-media-a5-technical-qa.js    # Deterministic technical QA (39 tes)
node scripts/test-media-a5-soak.js            # Deterministic multi-scenario soak runner (12 siklus)
node scripts/test-media-a5-worker-runner.js   # Media worker dual-gate & handoff (21 tes)
node scripts/test-media-a5-7-canonical-canary.js # Canonical canary mutation tests (27 tes)
node scripts/test-media-device-lifecycle.js   # Device auth lifecycle & management API (28 tes)
node scripts/test-publication-clock-skew.js   # Publication clock skew & provenance test
node scripts/test-seo-date-pipeline.js        # SEO date & news sitemap pipeline test (14 tes)
node scripts/test-content-quarantine.js       # Content quarantine & prototype isolation (19 tes)
node scripts/test-article-render-integrity.js # Article render integrity & canonical body (6 tes)
node scripts/test-article-persistence.js      # Article content persistence & HTML validation (7 tes)

# 10. Jalankan pengujian Hermes Mission Control & Pixel Office (HERMES-MC):
node scripts/test-mission-control.js               # MC-1: Mission Control core & read-only invariants (10 tes)
node scripts/test-staff-registry.js                # MC-2: Staff identity & operational state registry (16 tes)
node scripts/test-mission-control-departments.js   # MC-3: Department operations & activity attribution (18 tes)
node scripts/test-mission-control-pixel-office.js   # MC-4: Pixel Office spatial & coordinate registry (20 tes)
node scripts/test-mission-control-chat.js           # MC-5: Direct staff chat & operator command queue (20 tes)
node scripts/test-mission-control-anomalies.js      # MC-6: Anomaly detection & staff escalation (18 tes)
node scripts/test-mission-control-expansion.js      # MC-7: Extensible department architecture (18 tes)
node scripts/test-mission-control-job-animation.js  # MC-9: Role & job-specific animation layer (21 tes)
node scripts/test-pixel-office-movement.js        # MC-V2.3: Deterministic staff movement & Central Hall navigation (33 tes)
node scripts/test-pixel-office-handoff.js         # MC-V2.4: Real task handoff visualization & state transitions (18 tes)
node scripts/test-pixel-office-job-trace.js       # MC-V2.5: Canonical job trace & activity timeline (24 tes)
node scripts/test-mission-control-liveops.js      # MC-LIVEOPS-1: Real Job State to Staff Operational State & Pixel Office Behavior (78 tes)
node scripts/test-mission-control-liveops-2.js    # MC-LIVEOPS-2: Live Operator Interactivity & Inspection Overlays (10 tes)
node scripts/test-mission-control-liveops-3.js    # MC-LIVEOPS-3: Controlled Human Intervention & Workstation Action Gate (15 tes)
node scripts/test-mission-control-liveops-4.js    # MC-LIVEOPS-4: Real-Time Operational Event Delivery & Adaptive Subscription (15 tes)
node scripts/test-mission-control-anomaly-intel.js # MC-INTEL-1: Anomaly Intelligence Layer (22 tes)
node scripts/test-editorial-human-quality.js      # EDITORIAL-HUMAN-QUALITY-1: Human Writing Quality Gate (22 tes)
node scripts/test-editorial-knowledge.js          # RANCANGLOKA_EDITORIAL_KNOWLEDGE_V1: Master Knowledge Foundation (16 tes)
node scripts/test-verdict-guard.js                # EDITORIAL-VERDICT-GUARD-1: Verdict Prohibition & Canonical Product Review Terminology (11 tes)
node scripts/test-product-review-knowledge.js     # RANCANGLOKA_PRODUCT_REVIEW_KNOWLEDGE_V1: Canonical Product Review Knowledge (24 tes)
node scripts/test-editorial-calibration.js        # EDITORIAL-HUMAN-QUALITY-2: Calibration & Benchmark Suite (18 tes)
node scripts/test-real-corpus-shadow.js           # EDITORIAL-REAL-CORPUS-1: Real Article Shadow Validation (10 tes)
node scripts/test-native-indonesian-authoring.js  # NATIVE-INDONESIAN-AUTHORING-1: Native Indonesian Authoring & Anti-Translationese (13 tes)
node scripts/test-expert-consultation.js          # EDITORIAL-EXPERT-CONSULTATION-1-STABILIZE: Expert Consultation & Practical Decision Depth (22 tes)
node scripts/test-editorial-pipeline-integrity.js # EDITORIAL-PIPELINE-INTEGRITY-1: Quality Pipeline Integrity & Plumbing Audit (14 tes)
node scripts/test-editorial-production-dryrun.js  # EDITORIAL-PRODUCTION-DRYRUN-1: First Full Irwan -> Joko -> Rina Workflow Dry Run (13 tes)
node scripts/test-editorial-evidence-provenance.js # EDITORIAL-EVIDENCE-PROVENANCE-1: Claim-to-Source Traceability & Multi-Issue Propagation (15 tes)
node scripts/test-editorial-evidence-source-verification.js # EDITORIAL-EVIDENCE-SOURCE-VERIFICATION-1: Actual Source Retrieval & Automatic Provenance Gate (16 tes)
node scripts/test-editorial-source-acquisition.js # EDITORIAL-SOURCE-ACQUISITION-1: Verified Source Intake & Evidence Pack Hardening (14 tes)
node scripts/test-visitor-pain-angle.js           # EDITORIAL-VISITOR-PAIN-ANGLE-1: Visitor Problem Context & Opening Diversity (14 tes)
node scripts/test-editorial-runtime-1.js          # EDITORIAL-RUNTIME-1: Real Joko LLM Execution + Rina Deterministic QA (18 tes)
node scripts/test-editorial-runtime-2.js          # EDITORIAL-RUNTIME-2: Grounded Joko Output & Editorial Compression (13 tes)
node scripts/test-editorial-runtime-3.js          # EDITORIAL-RUNTIME-3: Real Irwan Research & Evidence Acquisition (18 tes)
node scripts/test-editorial-runtime-3a.js         # EDITORIAL-RUNTIME-3A: Evidence Quality Hardening & Source Upgrade (16 tes)
node scripts/test-editorial-runtime-3b.js         # EDITORIAL-RUNTIME-3B: Passage-to-Claim Semantic Integrity (14 tes)
node scripts/test-editorial-runtime-4a-generalization.js # EDITORIAL-RUNTIME-4A: Generalization Architecture Unblock & Matrix (12 tes)
node scripts/test-editorial-runtime-4b-stabilize.js   # EDITORIAL-RUNTIME-4B-STABILIZE: Generic research integrity contracts & claim role decoupling (11 tes)
node scripts/test-editorial-provider-resilience.js    # EDITORIAL-PROVIDER-RESILIENCE-1: Editorial LLM Provider resilience, retries & contracts (11 tes)
node scripts/test-joko-prompt-generalization.js      # JOKO-PROMPT-GENERALIZATION-1: Purging legacy topic semantics & prompt leak audit (6 tes)
node scripts/test-editorial-evidence-grounding-hardening.js # EDITORIAL-EVIDENCE-GROUNDING-HARDENING-1: Evidence Grounding & Provenance Hardening (11 tes)
node scripts/test-source-acquisition-authenticity.js # SOURCE-ACQUISITION-AUTHENTICITY-1: Real Source vs Fixture Provenance (10 tes)
node scripts/test-research-source-coverage.js        # RESEARCH-SOURCE-COVERAGE-1: Authentic Multi-Source & Admissible Coverage (12 tes)
node scripts/test-research-acquisition-orchestration.js # RESEARCH-ACQUISITION-ORCHESTRATION-1: Candidate-to-Document Pipeline (12 tes)
node scripts/test-d1-read-hotfix.js               # D1-ROW-READ-HOTFIX-1: D1 polling & query efficiency (24 tes)
node scripts/test-evidence-quality-gate.js          # EVIDENCE-QUALITY-GATE-1: Semantic evidence quality gates & relevance enforcement (15 tes)
node scripts/test-evidence-quality-runtime-integration.js # EVIDENCE-QUALITY-RUNTIME-INTEGRATION-1: Real runtime evidence filtering & proposition gate (14 tes)
node scripts/test-research-discovery-capability.js   # RESEARCH-DISCOVERY-CAPABILITY-1: Bounded multi-provider discovery architecture (14 tes)
node scripts/test-research-discovery-runtime-readiness.js # RESEARCH-DISCOVERY-RUNTIME-READINESS-1: Discovery readiness & DNS safety (14 tes)
node scripts/test-open-web-discovery.js             # OPEN-WEB-DISCOVERY-ACTIVATION-1: Open-web provider activation & network safety (15 tes)
node scripts/test-admin-brave-search-settings.js    # ADMIN-BRAVE-SEARCH-SETTINGS-1: Admin Brave Search toggle & encrypted key storage (17 tes)
node scripts/test-content-bootstrap-discovery-recovery.js # CONTENT-BOOTSTRAP-RECOVERY-1: Discovery precision & Hermes browser free web fallback (17 tes)
node scripts/test-lokamedia-dom-contract-recovery.js # LOKAMEDIA-DOM-CONTRACT-RECOVERY-1: DOM recovery, version 0.1.2 & retry invariants (9 tes)
node scripts/test-lokamedia-operator-ux-2.js        # LOKAMEDIA-OPERATOR-UX-2: Visible prompt and result review (12 tes)
node scripts/test-lokamedia-provider-tab-binding.js # LOKAMEDIA-PROVIDER-TAB-BINDING-1: Explicit ChatGPT provider tab binding (6 tes)
node scripts/test-lokamedia-runonce-recovery.js     # LOKAMEDIA-RUNONCE-RECOVERY: Run Once recovery & version handshake (11 tes)
node scripts/test-lokamedia-side-panel.js          # LOKAMEDIA-SIDE-PANEL: Native side panel core & controls (10 tes)
node scripts/test-lokamedia-job-scoped-gate.js      # LOKAMEDIA-JOB-SCOPED-RUN-GATE-FIX-1: Job-scoped run gate & isolation (4 tes)
node scripts/test-lokamedia-job-scoped-ui-state.js  # LOKAMEDIA-JOB-SCOPED-RESULT-UI-FIX-1: Job-scoped prompt, result & workflow state isolation (4 tes)
node scripts/test-lokamedia-human-approval-boundary.js # LOKAMEDIA-HUMAN-APPROVAL-BOUNDARY-1: Human approval boundary & server upload defense (8 tes)
node scripts/test-lokamedia-observability-cleanup.js # LOKAMEDIA-OBSERVABILITY-CLEANUP-1: Timeout fix, stale banner reconciliation & version provenance (12 tes)
node scripts/test-lokamedia-alt-text-closeout.js    # LOKAMEDIA-ALT-TEXT-CLOSEOUT-1: Alt text binding, publication immutability & Article B dry-run (15 kasus A-O)
node scripts/test-lokamedia-device-auth-hardening.js # LOKAMEDIA-DEVICE-AUTH-HARDENING: Device auth hardening & prefix bypass elimination (8 tes)
node scripts/test-lokamedia-dual-control-security.js # LOKAMEDIA-DUAL-CONTROL: Dual-control security & role separation (12 tes)
node scripts/test-lokamedia-manual-promotion-execution-dispatch.js # LOKAMEDIA-EXECUTION-DISPATCH: Execution dispatch & single featured slot (7 tes)
node scripts/test-lokamedia-manual-published-media-promotion.js # LOKAMEDIA-MANUAL-PROMOTION: Manual published media promotion pipeline (22 tes)
node scripts/test-nadia-reader-voice.js # HERMES-NADIA-READER-VOICE: Nadia Audience & Language Editor gate & rubric (14 tes)
node scripts/test-warm-advisory-tone.js # WARM-ADVISORY-TONE: Warm Advisory Tone & decision handoff (13 tes)
node scripts/test-local-cultural-grounding.js # LOCAL-CULTURAL-GROUNDING: Local Cultural Grounding & lived reality integrity
node scripts/test-premium-editorial-depth.js # PREMIUM-EDITORIAL-DEPTH: Premium Editorial Depth System (13 tes)
node scripts/test-dimas-budi-visual-handoff-e2e.js # DIMAS-BUDI-E2E-HANDOFF-1: Editorial-to-Media Dispatch Bridge (14 tes)
node scripts/test-internal-link-engine.js # INTERNAL-LINK-ENGINE-1: Semantic Internal Link Engine V1 (26 tes)
node scripts/test-product-decision-engine-contract.js # PDE-1A: Product Decision Engine data contracts & pilot model (14 tes)
node scripts/test-product-decision-engine-evaluator.js # PDE-1B: Deterministic decision evaluator runtime (22 tes)
node scripts/test-product-decision-admin.js           # PDE-1C: Editorial decision inspector & controlled taxonomy (13 tes)
node scripts/test-product-decision-persistence.js     # PDE-1D-A: D1 schema, model persistence & round-trip integrity (27 tes)
node scripts/test-lokamedia-environment-routing.js       # LOKAMEDIA-ENV-ROUTING: Safe backend profile routing & in-flight lock (9 tes)
node scripts/test-lokamedia-environment-url-atomicity.js # LOKAMEDIA-ENV-ATOMICITY: Atomicity, URL consistency, token isolation & mismatch blocker (8 tes)
node scripts/test-article-media-revision-ux.js          # CMS-REVISION-UX: Decoupled text & media approvals, revision requests & candidate state (8 tes)
node scripts/test-publish-now-ux.mjs                     # PUBLISH-NOW-UX: Manual publish modal, gate verification & preflight execution (23 tes)
node scripts/production-staging-art10000.mjs             # ART-10000-STAGING: Production staging dry-run & asset checksum validation
node scripts/test-visual-semantic-quality-gate.mjs      # VISUAL-SEMANTIC-GATE: Visual semantic quality gate & 16:9 responsive schematics (7 tes)
node scripts/verify-real-browser-preview-article10.mjs  # REAL-CHROME-CDP: Real headless Chrome browser verification on desktop & mobile

# 12. Typecheck dan Build proyek Astro
npx tsc --noEmit
npm run build
```

---

*Invarian Durabel LokaMedia (2026-10-10): Seluruh eksekusi LokaMedia, prompt preview, hasil kandidat, fingerprint binary, tahapan alur kerja (workflow stage), dan state antarmuka wajib dimiliki secara eksklusif oleh identitas media job (`job_id`). State historis pekerjaan masa lalu dilarang keras menjadi active state bagi pekerjaan lain.*

*Invarian Durabel LokaMedia Human Approval Boundary (2026-10-10): No generated/captured media may cross the upload boundary without an explicit human approval bound to the current media job and exact candidate fingerprint. Captured/Generated != Approved != Uploaded.*

*Invarian Durabel LokaMedia Version Provenance & Observability (2026-10-10): Identitas versi perangkat lunak runtime ekstensi wajib bersumber dari manifest/konstanta aktif dan tidak boleh ditimpa oleh histori chrome.storage lawas. Banner status transien wajib dibersihkan secara deterministik saat rekonsiliasi membuktikan state operator yang sehat tanpa error. Pemetaan event ATTACHMENT_CONFIRMED & JOB_COMPLETE wajib memutakhirkan lastAction menjadi 'Upload complete & confirmed'.*

*Invarian Durabel LokaMedia Real-Browser Proof (2026-10-10): Human Approval Boundary dan alur upload telah dibuktikan secara end-to-end pada browser nyata (Real Browser Proof, Not Simulation-Only) dengan sekuens audit monotonik: HUMAN_APPROVAL_RECORDED < UPLOAD_APPROVAL_GATE_PASS < UPLOAD_START < UPLOAD_RECEIVED < ATTACHMENT_CONFIRMED < JOB_COMPLETE, serta penegakan exactly-once receipts dan zero duplicate upload.*

*Invarian Durabel LokaMedia Dual-Control & Cryptographic Alt-Text Binding (2026-10-12): Promosi media manual pada artikel terbit wajib mengikuti model kontrol ganda: perangkat media hanya dapat mengajukan permohonan promosi, sementara Chief Editor / admin menyetujui permohonan tersebut secara kriptografis via antarmuka admin. Teks alt wajib diisi dan terikat secara kriptografis ke dalam tanda tangan HMAC dan skema database, memutakhirkan cermin articles.image_alt tanpa kebocoran teks placeholder lama. Tanggal penerbitan (published_at, actual_published_at), naskah, content_hash, dan tanda terima penerbitan asli bersifat abadi (immutable).*

*Invarian Durabel Nadia Audience & Language Editor (2026-10-12): Nadia adalah anggota staf tetap redaksi RancangLoka dengan peran Audience & Language Editor dan kapabilitas READER_VOICE_QA. Alur kerja redaksional permanen adalah Irwan -> Joko -> Nadia -> Rina -> Human Approval -> Sari. Setiap draf baru dilarang langsung melompat dari Joko ke Rina tanpa melewati gerbang evaluasi suara pembaca Nadia (READER_VOICE_REVIEW_REQUIRED). Otoritas publikasi Nadia adalah 0, dilarang mengubah fakta atau angka, dan skor AI detector bersifat strictly advisory only.*

*Invarian Durabel House Voice & Reader UX (2026-10-13): Milestone RANCANGLOKA_HOUSE_VOICE_AND_READER_UX_COMPLETE telah tercapai dan dikomit secara permanen (commit 9f1395e). Prinsip suara redaksi RancangLoka adalah konsultan bangunan/arsitektur yang ramah dan bersahaja (one idea per paragraph, common words first, anti-slop, zero jargon tanpa penjelasan). Prinsip pembaca long-form: 'On long-form editorial pages, navigation must not compete with or obscure the content being read' (dock mobile bawah disupresi penuh pada halaman artikel). Prinsip komparasi: 'A comparison component should reduce the reader's thinking effort, not merely display the same information in a grid' (breakout desktop 1000–1150px, kartu responsif 2 kolom pada tablet, 1 kolom pada mobile, zero client JS). Alur editorial kanonikal: Irwan -> Joko -> Nadia -> Rina -> Human Approval -> Sari. Naskah Article C berstatus UNPUBLISHED menunggu persetujuan akhir konten manusia (ARTICLE_C_FINAL_CONTENT_APPROVAL_REQUIRED).*

*Invarian Durabel Warm Advisory Tone (2026-10-14): Milestone RANCANGLOKA_WARM_ADVISORY_TONE_1 menetapkan prinsip suara redaksi kanonikal RancangLoka sebagai konsultan arsitektur dan bangunan Indonesia berpengalaman yang memahami masalah teknis namun berbicara kepada pemilik rumah dengan kehangatan, kejelasan, ketenangan, dan rasa hormat ("RancangLoka tidak menulis untuk membuat pembaca merasa penulisnya pintar; RancangLoka menulis supaya pembaca merasa dirinya sekarang mengerti; RancangLoka menjelaskan dengan kehangatan seorang konsultan yang membantu, bukan dengan jarak seorang penguji yang menghakimi; Setelah memahami fakta dan trade-off, RancangLoka membantu pembaca percaya diri mengambil keputusan sendiri"). Aturan COMPARISON_WARM_DECISION_HANDOFF mewajibkan setiap artikel komparasi ditutup dengan serah-terima keputusan manusia yang mengembalikan agensi pilihan kepada kondisi nyata dan prioritas rumah pembaca (tonal reference adaptif, anti-boilerplate). Evaluasi kehangatan diawasi secara independen oleh Nadia (Reader Voice Gate) dan diverifikasi kebenarannya oleh Rina (Editorial Truth & Consistency), dengan dukungan checklist semantik Dimas (zero crude keyword scoring) dan Jefry berstatus strictly shadow/advisory only.*

*Invarian Durabel Local Cultural Grounding (2026-10-14): Milestone RANCANGLOKA_LOCAL_CULTURAL_GROUNDING_1 menetapkan identitas redaksi permanen bahwa RancangLoka tidak hanya menerjemahkan pengetahuan arsitektur ke Bahasa Indonesia, melainkan menjelaskan arsitektur dari realitas hidup orang Indonesia (iklim tropis lembap, tempias hujan, panas sore matahari barat, rumah tumbuh, renovasi bertahap, tukang lokal, ketersediaan material, dan kendala perawatan). Prinsip ini melengkapi Warm Advisory Tone (Warm Advisory Tone = bagaimana RancangLoka berbicara; Local Cultural Grounding = dari realitas mana RancangLoka berbicara). Penjagaan ketat (anti-stereotype guard) melarang generalisasi sosiologis tanpa bukti ("Orang Indonesia selalu...", "Rumah Indonesia biasanya...", "Masyarakat kita pasti..."). Bahasa Indonesia standar adalah basis kanonikal (bukan dialek daerah atau bahasa gaul). Idiom alami dianjurkan namun kehadirannya tidak wajib dan dilarang menjadi boilerplate monoton. Alur evaluasi editorial kanonikal (Irwan -> Joko -> Nadia -> Rina -> Human Approval -> Sari) ditegakkan dengan pembagian peran: Irwan memverifikasi fakta konteks lokal vs generalisasi; Joko menulis prosa kontekstual alami; Nadia mengawasi Dimensi K (Local Cultural Grounding) melalui 7 pertanyaan kunci; Rina memverifikasi konsistensi kebenaran (mencegah overreach stereotip dan residual translationese); Dimas mencatat bukti semantik terstruktur (local_cultural_grounding, indonesian_context_fit, translationese_risk, cultural_generalization_safety; zero crude keyword scoring); serta Jefry berstatus strictly shadow/advisory only.*

*Invarian Durabel Premium Editorial Depth System (2026-10-15): Milestone RANCANGLOKA_PREMIUM_EDITORIAL_DEPTH_1 menetapkan lapisan kedalaman operasional permanen RancangLoka: DECISION_DEPTH_7Q_NEXT (cakupan semantik 7Q+Next terintegrasi mengalir tanpa subjudul mekanis), FAILURE_ANATOMY (menjelaskan bagaimana pilihan/pemasangan/perawatan gagal berbasis konsensus teknis, anti-cerita horor), MICRO_PERSONA_SCENARIOS (skenario hunian ilustratif teridentifikasi tanpa testimoni fiktif), EVIDENCE_METHOD_TRANSPARENCY (transparansi rujukan SNI/PUPR/BMKG ramah pembaca), VISUAL_STORYTELLING (visual bertugas menjelaskan dan memangkas beban kognitif tanpa kuota gambar arbitrer), STRICT NO-FIRST-HAND CLAIM POLICY (INVARIANT_NO_UNVERIFIED_FIRST_HAND_AUTHORITY: dilarang mengklaim inspeksi/pengalaman lapangan fiktif; otoritas bersumber dari bukti primer dan metodologi terbuka), dan TESTED_BY_RANCANGLOKA (status strictly RESERVED / PRIMARY-EVIDENCE-ONLY). Alur kanonikal Irwan -> Joko -> Nadia -> Rina -> Human Approval -> Sari ditegakkan penuh.*

*Invarian Durabel Budi Visual Storytelling Ownership & Review Loop (2026-10-15): Budi (lokamedia_worker_primary, media_operations) adalah pemilik kanonikal eksekusi brief visual editorial ketika Dimas mendeteksi visual_storytelling_need = REQUIRED atau diminta eksplisit oleh Chief Editor. Budi wajib menjaga CONCEPTUAL_VISUAL_TRUTH (visual AI explanatory wajib EDITORIAL_CONCEPT_VISUAL dan dilarang dilabeli REAL_PHOTOGRAPH/REAL_PROJECT/FIELD_INSPECTION/MEASURED_SIMULATION/ENGINEERING_TEST_RESULT tanpa bukti fisik riil). Zero kuota dekorasi (dilarang memaksakan kuota gambar N per artikel). Alur peninjauan visual kanonikal: Dimas (kebutuhan visual) -> Budi (brief/persiapan visual) -> Nadia (keterbacaan pembaca) -> Rina (kebenaran faktual/representasi) -> Human Approval -> Sari (publikasi). Budi memiliki otoritas publikasi = 0, dilarang mempublikasi mandiri, dan dilarang melompati atau memveto Nadia/Rina.*

*Invarian Durabel Dimas -> Budi Visual Handoff (2026-10-15): Eksekusi runtime Dimas -> Budi visual storytelling handoff mengotomatisasi pengiriman visual brief terstruktur (VisualBrief) ke dalam antrean media_jobs (role: inline, slot_key: inline_<visual_class>_<seq>, status: QUEUED, required_for_readiness: 1) segera setelah draft Joko dievaluasi oleh Dimas dengan status visual_storytelling_need = REQUIRED. Idempotensi deterministik ditegakkan: evaluasi ulang draft yang sama tidak menciptakan duplikasi media job; perubahan materiil draft memicu supersesi job lama secara aman. Pekerjaan visual Budi wajib visible di Mission Control (department_id: 'media', responsible_agent_id: 'lokamedia_worker_primary', stage: 'waiting_media') dan Pixel Office secara faktual tanpa aktivitas dekoratif semu. Pembuatan work item Budi TIDAK mengotorisasi pembangkitan gambar otonom (media execution safety tetap berada di bawah kendali manusia/dual-gate). Jika visual_storytelling_need = REQUIRED, publikasi artikel diblokir hingga pekerjaan visual mencapai status approved, menjaga agar status REQUIRED bermakna operasional nyata. Alur peninjauan visual tetap linear: Dimas -> Budi -> Nadia -> Rina -> Human Approval -> Sari, dengan BUDI_PUBLISHING_AUTHORITY = 0.*

*Invarian Durabel Semantic Internal Link Engine (2026-10-15): Milestone RANCANGLOKA_INTERNAL_LINK_ENGINE_1 menetapkan prinsip kanonikal permanen: "Internal link RancangLoka harus melanjutkan perjalanan berpikir pembaca, bukan sekadar memindahkan PageRank." Kepadatan tautan internal murni ditentukan oleh kebutuhan kognitif perjalanan pembaca (NO_MECHANICAL_INTERNAL_LINK_QUOTA: zero arbitrary link quotas). Arsitektur Dua-Bidang (Two-Plane Architecture) memisahkan tautan dinamis di luar naskah (Plane A: SSR zero-JS modul "Artikel Pendukung untuk Keputusan Ini", zero content hash mutation) dengan tautan editorial di dalam naskah (Plane B: kandidat draf baru Joko diuji oleh Dimas, Nadia, Rina, disetujui Chief Editor; pada artikel terbit hanya menerbitkan rekomendasi LINK_REVISION_RECOMMENDED tanpa mutasi naskah diam-diam). Invarian Identitas Pilar Eksplisit (INVARIANT_EXPLICIT_PILLAR_IDENTITY) melarang penggunaan relasi PARENT_PILLAR dan CHILD_SUPPORTING tanpa metadata pilar eksplisit (pillar_role = 'PILLAR'). Provenans Hash Revisi mewajibkan relasi aktif Plane B mengikat source_content_hash naskah yang disetujui; jika hash berubah di kemudian hari, relasi otomatis ditandai STALE. Aturan One-Primary-Relationship-Per-Placement mencegah duplikasi rekomendasi ke target yang sama. Injeksi regex keyword mekanis di processArticleContent dinonaktifkan secara default untuk melindungi naskah terbit dari mutasi liar runtime.*

*Invarian Durabel Semantic Internal Link Pre-Production Hardening (2026-10-15): Pre-Production Hardening & E2E Acceptance Audit untuk INTERNAL-LINK-ENGINE-1 menegakkan: (1) Invarian Hubungan Utama Basis Data: UNIQUE(source_article_id, target_article_id, placement_plane) di skema D1 (0033_internal_link_engine.sql & schema.sql); (2) Penemuan Semantik Generik: discoverBidirectionalCandidates beroperasi berbasis taksonomi arsitektural generik tanpa overfit atau hardcoded A/B/C; (3) Integrasi E2E Mission Control: deriveInternalLinkActionableStates tersambung langsung ke summaries dan antrean review Chief Editor (stage: 'ready_for_review') untuk ORPHAN_DETECTED, LINK_REVIEW_REQUIRED, BACKLINK_RECOMMENDED, dan LINK_REVISION_RECOMMENDED dengan zero clutter (link aktif sehat tidak membanjiri antrean tugas); (4) Konsistensi Metadata Pilar: validasi tegas PILLAR/STANDALONE (parent_pillar_id null), SUPPORTING (parent_pillar_id menunjuk PILLAR valid), pelarangan relasi mandiri/lingkaran referensi; (5) Deduplikasi Permukaan Publik: Plane A memiliki prioritas tertinggi, sementara in-article BACA JUGA dan footer RelatedArticles mengecualikan target duplikat; (6) Klasifikasi Performa Akurat: membedakan tegas LOCAL MICROBENCHMARK dan LOCAL SSR BENCHMARK dari pengukuran produksi D1/Lighthouse pasca-deployment.*

*Invarian Durabel Article Support Thumbnail Optimization (2026-10-15): Milestone ARTICLE_SUPPORT_THUMBNAIL_PAYLOAD_OPTIMIZED menetapkan standar derivatif thumbnail kanonikal 160x160 px WebP (compactThumb, 1:1 square crop, quality=85) untuk modul dukungan artikel ('Artikel Pendukung untuk Keputusan Ini'). Seluruh derivatif berlokasi di path R2 kanonikal thumbnails/<filename> dan diakses via /media/thumbnails/<filename> melalui resolver getCanonicalThumbnailUrl. Endpoint media edge (src/pages/media/[...key].ts) wajib menegakkan fallback otomatis ke gambar asli jika berkas derivatif belum tersedia di R2, menjamin zero broken images saat transisi atau proses backfill. Modul UI wajib mempertahankan layout invariant: 80x80 px desktop, 56x56 px mobile, loading="lazy", decoding="async", explicit width/height, aspect-ratio: 1/1 (CLS = 0), alt="" dan aria-hidden="true" untuk thumbnail dekoratif, serta zero client JS.*

*Invarian Durabel Content Protection & Safe Workers Cache (2026-10-16): Milestone CONTENT_PROTECTION_1A_IMPLEMENTATION_PASS (commit 18573a8) menetapkan fondasi perlindungan konten dan efisiensi edge caching Cloudflare Workers ([cache] enabled = true via Wrangler v4.151.0). Seluruh permukaan privat (/admin/*, /api/admin/*, /api/internal/*, authenticated session cookie admin_session, non-GET/HEAD mutation requests, dan status error >= 400) secara mutlak menerima Cache-Control: no-store, private dan header CDN dihapus (zero cache leakage/poisoning). Permukaan publik memisahkan kebijakan browser (Cache-Control: public, max-age=<browser_ttl>) dan edge Cloudflare (Cloudflare-CDN-Cache-Control: public, max-age=<edge_ttl>, stale-while-revalidate=<window>), menghindari kombinasi s-maxage dan stale-while-revalidate yang menonaktifkan SWR pada Workers Cache. Invalidasi cache berbasis tag kanonikal (Cache-Tag dan selector cache.purge({ tags: [...] })), mencakup reverse invalidation otomatis untuk modul dukungan artikel (support-target-<target_article_id>) melalui kueri D1 deterministik (placement_plane = 'PLANE_A_DYNAMIC' AND status = 'ACTIVE'). Endpoint /api/search.json dipangkas hanya menyajikan 5 field publik (mengurangi ukuran transfer 63.6% dan menutup kebocoran metadata internal). Kebijakan public/robots.txt menerapkan SELECTIVE_AI_ACCESS (mengizinkan crawler sitasi/pencarian seperti OAI-SearchBot dan PerplexityBot, menolak crawler penelan korpus massal).*

*Invarian Durabel Product Decision Engine Runtime & Evidence Integrity (2026-10-17): Milestone PRODUCT_DECISION_ENGINE_1B menetapkan prinsip evaluasi murni: D1_STORES_DECISION_MODEL & EVALUATOR_COMPUTES_DECISION (D1 sebagai penyimpan terstruktur, runtime evaluator deterministik sebagai mesin komputasi, zero SQL decision maker). Invarian GOLDEN_EXPECTATIONS_MUST_NOT_DRIVE_RUNTIME_DECISIONS menegaskan field expected_recommendation skenario bersifat oracle untuk pengujian editorial semata dan dilarang menentukan rekomendasi runtime. Evaluasi dilakukan secara murni multi-faktor (dimensi konteks fisik, diskualifikasi batasan HARD, penalti batasan SOFT, tradeoff kontekstual, keunggulan kualitatif kriteria relevan) dengan taksonomi kualitatif murni (STRONG_FIT, GOOD_FIT_WITH_TRADEOFF, CONDITIONAL_FIT, POOR_FIT; zero skor angka semu/ranking). Firewall komersial mutlak (NO_COMMERCE_FIELDS: zero affiliate, commission, merchant). Snapshot bukti otoritatif Article 5 terkunci pada eed64da134be1b158d0a2985e3b43196f486eb4b86dd1fd9e95a5580655b3eed dengan source fidelity NORMALIZED_HASH_VERIFIED.*

*Invarian Durabel Admin Inspector & Controlled Context Taxonomy (2026-10-17): Milestone PRODUCT_DECISION_ENGINE_1C menetapkan antarmuka inspeksi editorial internal (/admin/decisions). Invarian ADMIN_METADATA_MUST_RENDER_MODEL_SOURCE_TRUTH mewajibkan metadata model (model_id, model_version, criteria_version = 'crit_kusen_v1', snapshot hash) dirender langsung dari sumber model otoritatif tanpa hardcoding. Invarian EVALUATOR_CRITICAL_CONTEXT_MUST_USE_CONTROLLED_TAXONOMY mewajibkan seluruh 6 dimensi konteks wajib (CORE) menggunakan kontrol semantik terkendali (<select>) yang divalidasi ketat di sisi server (zero free-text). Presets skenario bersifat murni pengisi konteks (SCENARIO_PRESET_IS_CONTEXT_ONLY) tanpa membocorkan ekspektasi oracle ke evaluator.*

*Invarian Durabel LokaMedia Environment URL Atomicity (2026-10-19): Milestone LOKAMEDIA_ENVIRONMENT_URL_ATOMICITY_FIX menetapkan invarian mutlak: Environment LOCAL dilarang keras menyimpan atau menggunakan URL backend PRODUKSI. Pergantian environment (switchEnvironment) wajib atomik: menyinkronkan activeEnvironment, config.serverBaseUrl, credentials (deviceId, deviceToken), dan partisi job store (jobs, approvals, selectedJobId) secara serentak. ApiClient dan background controller menegakkan prinsip fail-closed (ENVIRONMENT_URL_MISMATCH blocker) sebelum ada panggilan jaringan jika URL backend dan environment aktif tidak konsisten. Jika token device pada environment aktif belum dikonfigurasi, polling antrean backend otomatis dijeda (PAUSED_MISSING_DEVICE_TOKEN) tanpa memicu request ke production.*

*Invarian Durabel Living Lemon Magazine 2.1 Theme (2026-10-28): Milestone THEME-RL-LIVING-LEMON-MAGAZINE-2.1-FINAL menetapkan standar visual majalah editorial arsitektur RancangLoka: dominasi putih bersih (70% canvas & cards), netral hangat (20% section-alt), dan aksen lemon terukur (10% highlights & tags). Hero masthead adalah single-column editorial kompak (Newsreader serif clamp ~54px) dengan elevasi 3-story mosaic fotografi tampil di first viewport (above-the-fold pada 1440x900). Seluruh fallback gambar media ditangani di sisi server (zero client-side onerror JS; media valid merender <img>, media hilang merender anggun sebagai kartu teks editorial). Navigasi desktop disederhanakan ke 6 pilar editorial tanpa bar sekunder redundan. Footer mobile mengadopsi Two-Column CSS Grid seimbang dengan kelompok Redaksi & Standar membentang 2 kolom (col-span-2) berisi 2 sub-kolom link, memangkas tinggi vertikal ~185px sembari menjaga layout 4-kolom desktop (lg:grid-cols-12) 100% utuh. Setiap halaman wajib memiliki tepat 1 semantic <h1>.*

*Invarian Durabel Decoupled Approval & Manual Release Gate (2026-11-16): Milestone RANCANGLOKA_ARTICLE_10000_RELEASE_PREP_SAFE_CHECKPOINT menetapkan pemisahan mutlak antara persetujuan naskah teks (berbasis content_hash) dan persetujuan media per-slot (berbasis slot_id dan approved_asset_id). Memilih gambar kandidat (Gunakan Gambar Kandidat Ini) TIDAK otomatis menyetujui media; persetujuan media wajib berupa tindakan manusia yang eksplisit dan independen. Tombol "Publikasikan Sekarang" di antarmuka preview admin dilindungi modal konfirmasi dan hanya aktif ketika artikel berstatus draft dan seluruh 4 syarat evaluasi persetujuan (naskah dan seluruh slot media wajib) valid tanpa blocker. Endpoint /api/admin/publication/publish/control (publish_now) dan authorization-resolver menegakkan re-evaluasi readiness langsung (skipCache: true) dengan penolakan fail-closed terhadap ketidaksesuaian content hash, naskah/media belum disetujui, auto_policy tanpa persetujuan manusia, atau emergency kill switch aktif, serta menjamin pencatatan receipt audit immutable di Publication Engine.*

*Invarian Durabel Visual Semantic Quality Gate & Real Browser Verification (2026-11-19): Milestone RANCANGLOKA_CANARY_10011_INLINE_VISUALS_VERIFIED_SAFE menetapkan standar bahwa seluruh visual teknis inline wajib mematuhi 5 pilar Visual Semantic Quality Gate (Heading Alignment, Architectural Object Fidelity, 16:9 Clipping Defense, Editorial Purity, dan Monetary Silence mutlak). Diagram dilarang berupa tabel teks generik; wajib menggambarkan potongan arsitektural dan vektor aliran fisika nyata. Dilarang mengklaim hasil absolut (misal "100% uap terbuang", "Laminar cross-flow", atau persentase RH tanpa konteks pengukuran). Verifikasi visual wajib dibuktikan menggunakan peramban nyata (Real Chrome Browser via CDP) pada resolusi desktop (1280x800) dan mobile (375x812), membuktikan zero clipping dan zero horizontal overflow. Jangan pernah mengklaim verifikasi peramban lulus tanpa eksekusi browser nyata.*

*Invarian Durabel Photo-First Visual Editorial Policy v1.1 (2026-11-19): Milestone RANCANGLOKA_PHOTO_FIRST_V1_1_INTEGRATION_VERIFIED_SAFE menetapkan fotografi editorial arsitektur/interior sebagai visual standar artikel RancangLoka (1 cover + 2–4 inline). Generator diagram SVG dinonaktifkan sebagai default dan dialihkan ke opsi legacy (--legacy-diagrams). Setiap artikel memiliki House Identity Profile unik (house-identity.ts) yang mengunci gaya arsitektur, palet material, warna cat, profil kusen, dan landmark spasial untuk menjamin konsistensi lintas visual. Setiap foto inline wajib memiliki peran fungsional spesifik (context, problem_condition, relevant_detail, realistic_solution_example). Alur generasi foto referensial memanfaatkan model Kling AI 3.0 Omni (kling-v3-omni via POST /v1/images/omni-image) dengan payload terverifikasi image_list dan tag <<<image_1>>>; parameter image_fidelity dilarang keras dikirim ke endpoint Omni. Seluruh kandidat foto wajib dievaluasi melalui 7 Photo Quality Gates (photo-quality-gate.ts); dilarang mengklaim SAME_HOUSE_PASS hanya dari kesamaan prompt teks atau warna tanpa bukti geometri ruang dan material yang konsisten. Panggilan API generasi berbayar mutlak dilarang sebelum ada otorisasi eksplisit dari Owner ($0.00 current spend).*

*Invarian Durabel House Identity Lock v1.2 & Visual Continuity QA (2026-11-19): Milestone RANCANGLOKA_HOUSE_IDENTITY_LOCK_V1_2 menetapkan protokol Cover-Driven House Lock dan pemisahan ketat Budi Prompt Engine antara elemen IMMUTABLE (topologi ruang, jenis kompor & cooker hood, geometri kabinet, palet material, warna cat) dan elemen MUTABLE (sudut pandang kamera, jarak, pencahayaan, aktivitas, peralatan masak bergerak). Setelah citra cover disetujui, metadata House Identity Profile disinkronkan secara permanen dengan realitas visual cover yang diterima, bukan dengan ekspektasi awal spekulatif (divergensi dicatat secara eksplisit). Tag referensi conditioning (<<<image_1>>>) wajib disertai prompt negatif eksplisit yang melarang perubahan peralatan (e.g. larangan kompor gas, burner rings, grates, dan knobs untuk dapur dengan kompor induksi). Seluruh evaluasi Nadia Visual Continuity Gate (photo-quality-gate.ts) menerapkan 9 gerbang deterministik (photo_realism, fixed_appliance_consistency, kitchen_layout_continuity, cabinet_geometry_consistency, material_and_color_consistency, architectural_landmark_match, editorial_photo_variation, no_misleading_architecture, monetary_silence). Pelanggaran peralatan tetap atau morphing denah memicu vonis deterministik REJECTED. Elemen di luar bingkai kamera wajib berstatus NEEDS_REVIEW / UNVERIFIABLE dan dilarang keras menerima status PASS semu. Skenario regresi membuktikan pasangan Kling Omni #10011 (Cover induksi vs Inline kompor gas 2-tungku) tertolak deterministik dengan skor 20/100 pada FIXED_APPLIANCE_CONSISTENCY (Overall REJECTED).*

*Invarian Durabel Kling Omni Image Series & Coherent Multi-Angle Generation (2026-11-19): Milestone RANCANGLOKA_KLING_OMNI_IMAGE_SERIES_V1 menetapkan dukungan mode Image Series asli (result_type: 'series', series_amount: 2..9 via POST /v1/images/omni-image) pada adapter Kling Image 3.0 Omni (kling-image-adapter.ts) dan runner Hermes EU, menghasilkan beberapa sudut pandang foto editorial dari satu rumah yang sama dalam satu eksekusi terpadu. Perhitungan unit Kling strictly berbasis jumlah output gambar yang dihasilkan (OUTPUT_IMAGES_COUNT * 8 units pada 2K resolution = 24 units untuk 3 gambar). Anchor visual cover asli dilewatkan melalui image_list dan ditautkan dalam prompt dengan tag conditioning <<<image_1>>>. Mesin prompt terstruktur Budi (buildStructuredSeriesPrompt) membagi spesifikasi menjadi [IMMUTABLE ARCHITECTURE & EQUIPMENT - ALL 3 SHOTS] (topologi U-shape, kompor induksi tanam kaca datar, slim stainless hood, kabinet jati matte, countertop cream) dan [PANEL SEQUENCE SPECIFICATIONS] (Shot 1: Cooking perspective, Shot 2: Appliance & filtration detail, Shot 3: Windowless room ventilation perspective) disertai negative prompt tegas anti-perubahan peralatan. Nadia Series QA Gate (evaluateImageSeriesQualityGate) memverifikasi 6 dimensi mutlak: SAME_HOUSE_CONSISTENCY, FIXED_APPLIANCE_CONSISTENCY, SPATIAL_CONTINUITY, DISTINCT_CAMERA_ANGLES (menolak sudut pandang duplikat/redundant), ARTICLE_RELEVANCE, dan PHOTO_REALISM. Dilarang mengklaim kelulusan series dari metadata semata; seluruh panggilan API berbayar diblokir hingga otorisasi eksplisit Owner ($0.00 current spend).*

*Invarian Durabel Permanent Pre-Closing Visual Placement Rule v1.1 (2026-11-22): Milestone RANCANGLOKA_PERMANENT_PRE_CLOSING_VISUAL_RULE_ESTABLISHED menetapkan bahwa setiap artikel editorial RancangLoka wajib memiliki 1 visual khusus Object-First pra-penutup yang ditempatkan sebelum section closing/pertimbangan keputusan akhir (posisi before_heading pada sub-bab penutup). Visual ini wajib relevan dengan rangkuman pilihan, rekomendasi praktis, atau keputusan akhir hunian, dan dilarang menggunakan gambar dekoratif generik, diagram, tabel, atau infografis. Target minimum baku artikel baru: 1 cover hero + 3 inline pendukung + 1 pre-closing visual (total 5 visual per artikel). Kebijakan ini aktif secara default pada pipeline Budi, storyboard Nadia, anchor resolver, binding media, dan evaluasi Definition of Done Gate B.*

*Dokumen ini diperbarui pada 22 November 2026 setelah penetapan RANCANGLOKA_PERMANENT_PRE_CLOSING_VISUAL_RULE_ESTABLISHED.*

## 5. Aturan Operasional Sinkronisasi & Handoff (2026-11-14)

Sebelum mengubah kode atau menjalankan operasi yang dapat mengubah state:

1. Pastikan direktori kerja dan `git rev-parse --show-toplevel` menunjuk ke repository yang secara eksplisit diizinkan oleh pengguna. Jangan berpindah ke sibling project/worktree atau menyelidikinya tanpa permintaan yang jelas.
2. Periksa `git branch --show-current`, `git rev-parse HEAD`, dan `git status --short`. Baca `state/ANTIGRAVITY_HANDOFF.md` untuk checkpoint terbaru. Jangan menganggap branch atau status bersih dari catatan lama.
3. Perlakukan perubahan tracked, untracked, ignored, dan data lokal yang sudah ada sebagai milik pengguna. Jangan reset, clean, checkout paksa, overwrite, stash, commit, atau menghapusnya kecuali pengguna secara eksplisit mengizinkan tindakan tersebut. Hindari menulis ke file yang sudah berubah lokal tanpa memahami dampaknya.
4. Hub pengembangan yang dicatat pada checkpoint 2026-11-14 adalah `E:\antigravity\rancangloka\rancangloka-astro`, branch `feat/jev-lokamedia-integration`, HEAD `da8578b`. Direktori `E:\antigravity\rancangloka-article-admin-release` dan `E:\antigravity\rancangloka-production-release` adalah worktree release terpisah; jangan mengubah atau menyatukannya tanpa instruksi eksplisit.
5. Jangan deploy, mem-publish, mengubah remote/production D1 atau R2, atau mengaktifkan otomasi publikasi tanpa otorisasi eksplisit. Pertahankan `AUTO_PUBLISH = OFF`, `JEV_MODE = shadow`, dan zero production authority kecuali operator menyetujui perubahan secara eksplisit.
6. Setelah pekerjaan, laporkan branch/HEAD, file yang diubah, validasi yang dijalankan beserta hasilnya, serta setiap pemeriksaan yang belum selesai. Perbarui `HISTORY.md` dan `state/ANTIGRAVITY_HANDOFF.md` bila perubahan mengubah status/checkpoint penting; jangan mengklaim verifikasi yang tidak terjadi.

Checkpoint faktual 2026-11-14: sinkronisasi integrasi dicatat pada commit `da8578b` (`feat(integration): reconcile article lifecycle and inventory`). Hub memiliki perubahan lokal yang belum dikomit; jumlah terakhir yang tercatat adalah 644 entri porcelain dan angka ini harus diverifikasi ulang sebelum tindakan berikutnya. Build pada hub terhenti setelah tidak menghasilkan output baru selama beberapa menit; jangan laporkan build hub sebagai lulus. Build di worktree integrasi bersih berhasil. Tes Internal Link Engine memiliki 3 kegagalan fixture yang tercatat pada checkpoint; jangan menyamarkannya sebagai kelulusan penuh.

