# 🧩 LokaMedia Extension — Architecture & Specification Document (MEDIA-1)

**Document Version:** 1.0.0  
**Status:** DESIGN ONLY — AUDIT & SPECIFICATION (No Implementation / No Production Mutation)  
**Milestone:** MEDIA-1 — LokaMedia Extension  
**Target Platform:** Chrome / Chromium-based Browsers (Manifest V3)  
**Canonical Naming:** `LokaMedia Extension` (Strict prohibition on legacy names `CoverBridge`, `Erihome Bridge`)

---

## 1. Executive Summary & Workflow Lifecycle

### 1.1. Core Objective
The **LokaMedia Extension** is an operator companion tool designed to bridge manual image generation workflows (e.g., ChatGPT DALL-E 3, Midjourney, Ideogram, FLUX web interfaces) directly into the **RancangLoka LokaMedia Foundation (MEDIA-0)**.

It eliminates friction in asset ingestion while guaranteeing strict zero-trust boundary controls:
1. Operator inspects draft article image jobs.
2. Operator copies pre-generated visual prompts with one click.
3. Operator generates visual media manually in an external tool.
4. LokaMedia Extension receives the image via either **Assisted Browser Mode** or **Universal Fallback** (Drag/Drop/Paste/Picker).
5. Extension performs client-side preflight inspection and preview.
6. Extension transmits binary asset and metadata to RancangLoka Edge Media API.
7. RancangLoka server authoritatively validates binary, stores to Cloudflare R2 (`media/images/<sha256>.<ext>`), inserts `media_assets`, establishes relational binding in `article_media`, recalculates editorial readiness to `READY_FOR_REVIEW`, and updates compatibility mirrors.
8. **Article remains strictly in `draft` status. Zero automatic publishing occurs.**

### 1.2. Primary Operator Workflow Diagram

```text
┌─────────────────────────────────────────────────────────────────────────────┐
│                            RANCANGLOKA ADMIN CMS                            │
│  Article Draft Created (Hermes Ingest or Manual Editor)                     │
│  Media Job Queued: role=featured, prompt="Modern tropical facade...",       │
│                    aspect_ratio="16:9", status=PENDING                      │
└──────────────────────────────────────┬──────────────────────────────────────┘
                                       │
                                       ▼ Launch via Deep Link or Job List
┌─────────────────────────────────────────────────────────────────────────────┐
│                           LOKAMEDIA EXTENSION                               │
│  1. Displays Article Title, Slug, Role, Slot                                │
│  2. [ Copy Prompt ] ──► Operator copies prompt to clipboard                 │
└──────────────────────────────────────┬──────────────────────────────────────┘
                                       │
                                       ▼ Manual Generation
┌─────────────────────────────────────────────────────────────────────────────┐
│                 EXTERNAL GENERATOR (ChatGPT / Web UI / Studio)              │
│  Operator pastes prompt, generates image, selects preferred candidate       │
└──────────────────────────────────────┬──────────────────────────────────────┘
                                       │
                    ┌──────────────────┴──────────────────┐
                    ▼                                     ▼
        [Assisted Browser Mode]                [Universal Fallback]
        - Right-click image                    - Drag & Drop file
        - One-click page grab                  - File picker browse
        (Optional DOM helper)                  - Clipboard Paste (Ctrl+V)
                    └──────────────────┬──────────────────┘
                                       │
                                       ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                           LOKAMEDIA EXTENSION                               │
│  3. Preflight Client Validation (MIME, Dimensions, Size < 5MB)              │
│  4. Visual Preview & Alt Text verification                                  │
│  5. [ Send to RancangLoka ] (Debounced, Idempotent)                         │
└──────────────────────────────────────┬──────────────────────────────────────┘
                                       │
                                       ▼ POST /api/internal/v1/media/upload
┌─────────────────────────────────────────────────────────────────────────────┐
│                      RANCANGLOKA MEDIA-0 RUNTIME ENGINE                     │
│  - Dedicated Device Auth verification (scope: media:write:draft)            │
│  - Authoritative Binary Magic Bytes Inspection (JPEG/PNG/WebP)              │
│  - Dimensions check (600x338 <= size <= 3840x2160)                          │
│  - SHA-256 Computation & Global Deduplication Check                         │
│  - Cloudflare R2 Put: media/images/<sha256>.<ext>                           │
│  - D1 Insert: media_assets (status = VALIDATED)                             │
│  - D1 Upsert: article_media (is_active = 1, prior featured -> 0)             │
│  - D1 Update: articles compatibility mirror (featured_image, image_alt)     │
│  - D1 Readiness: Transitions from WAITING_MEDIA -> READY_FOR_REVIEW         │
│  - ARTICLE STATUS REMAINS DRAFT (ZERO MUTATION TO PUBLISHED)                │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## 2. Extension Identity & Functional Scope

### 2.1. Identity Rules
- **Canonical Product Name:** `LokaMedia Extension`
- **Short Name / UI Header:** `LokaMedia`
- **Identifier / Bundle ID:** `com.rancangloka.lokamedia`
- **Forbidden Legacy Terms:** `CoverBridge`, `Erihome Bridge`, `Erihouse`, `Erihome`. Any appearance in code or documentation is strictly blocked.

### 2.2. Scope Demarcation (MEDIA-1 vs Future)
| Feature / Capability | MEDIA-1 Status | Future / Reserved |
| :--- | :--- | :--- |
| **Media Type** | **IMAGE ONLY** (JPEG, PNG, WebP) | VIDEO (`video/mp4`, `video/webm`) |
| **Generation Mode** | **100% Manual Operator Generation** | Automated Fal.ai / Serverless GPU |
| **Target Role** | `featured` (primary) and `inline` | Multi-image galleries, sidecar diagrams |
| **Target Destination** | Cloudflare R2 + D1 `media_assets` | Additional CDNs / offsite replicas |
| **Publishing Action** | **FORBIDDEN** (Status remains `draft`) | Review and Publish workflow in Admin CMS |
| **Article Body Mutation** | **FORBIDDEN** (`content_md` untouched) | Inline shortcode parser |

---

## 3. Resilience Architecture: Zero ChatGPT DOM Dependency

A foundational vulnerability of web automation is reliance on external web application DOM selectors. ChatGPT and other commercial AI web interfaces update layouts, CSS classes, and React fiber nodes weekly without notice.

### 3.1. Architectural Mandate
**LokaMedia Extension MUST NOT rely on ChatGPT DOM selectors as the primary or critical path.**

### 3.2. Two Operating Modes

```text
               ┌──────────────────────────────────────────────┐
               │         LokaMedia Extension Intake           │
               └──────────────────────┬───────────────────────┘
                                      │
            ┌─────────────────────────┴─────────────────────────┐
            ▼                                                   ▼
┌───────────────────────────────┐           ┌───────────────────────────────────────┐
│    MODE A: ASSISTED BROWSER   │           │       MODE B: UNIVERSAL FALLBACK      │
│         (Convenience)         │           │          (Authoritative Core)         │
├───────────────────────────────┤           ├───────────────────────────────────────┤
│ • Context Menu on Images:     │           │ • Native Drag & Drop Zone             │
│   "Send Image to LokaMedia"   │           │ • Standard File Picker (<input type>) │
│ • Content Script Image Sniffer│           │ • Clipboard Paste Listener (Ctrl+V)   │
│   (inspects <img> elements)   │           │ • Always functions regardless of page │
│ • Non-blocking if DOM changes │           │ • Works with any web app or desktop   │
└───────────────────────────────┘           └───────────────────────────────────────┘
```

#### Mode A: Assisted Browser Mode (Convenience Layer)
- Injects a lightweight content script on supported domains (`chatgpt.com`, `chat.openai.com`, etc.) strictly to provide:
  1. A Context Menu item via `chrome.contextMenus`: *"Send Image to LokaMedia"*. When right-clicking any `<img>` element or canvas, the background service worker fetches the image blob directly via `fetch()` and loads it into the active job slot.
  2. An optional floating "Send to LokaMedia" button overlay on hover over rendered image containers.
- **Fault-Tolerant Rule:** If OpenAI or any generator updates their DOM structure, class names, or DOM nesting, Mode A silently degrades. **No error dialog is shown, and the operator is never blocked.**

#### Mode B: Universal Fallback Mode (Authoritative Resilient Core)
- The core extension UI (Side Panel / Action Popup) contains a universal dropzone and paste receiver that functions in 100% of scenarios:
  1. **Clipboard Paste (`Ctrl+V` / `Cmd+V`):** Operator right-clicks an image anywhere on the web or desktop, selects "Copy Image", focuses LokaMedia, and presses paste. The extension reads `clipboardData.items` and extracts the `image/*` file.
  2. **Drag & Drop:** Operator drags any image file from browser download bar, desktop, file explorer, or another tab directly onto the dropzone.
  3. **Standard File Picker:** Clicking the dropzone opens the native OS file picker (`<input type="file" accept="image/jpeg,image/png,image/webp">`).
- **Resilience Guarantee:** Even if ChatGPT disables right-clicking, renders via WebGL/Canvas, or implements shadow DOM, the operator can simply copy image or drag the downloaded file into Universal Fallback in 2 seconds.

---

## 4. Pending Media Queue Contract & D1 Schema Design

To ensure loose coupling between article creation and media production, RancangLoka requires a persistent queue of pending media jobs.

### 4.1. Media Job D1 Schema (`media_jobs`)

```sql
-- Migration: 0006_media_jobs_queue.sql (Spec Draft)
CREATE TABLE IF NOT EXISTS media_jobs (
    job_id TEXT PRIMARY KEY,                         -- Canonical: mjob_<24-char base64url>
    article_id INTEGER NOT NULL REFERENCES articles(id) ON DELETE CASCADE,
    article_slug TEXT NOT NULL,
    article_title TEXT NOT NULL,
    role TEXT NOT NULL DEFAULT 'featured',           -- 'featured' | 'inline'
    slot_key TEXT NOT NULL DEFAULT 'primary',        -- 'primary' | 'inline_1' | 'inline_2'
    media_type TEXT NOT NULL DEFAULT 'image',        -- 'image' (video reserved)
    prompt TEXT NOT NULL,                            -- Exact visual prompt generated for operator
    alt_text TEXT NOT NULL,                          -- Pre-calculated SEO alt text
    aspect_ratio TEXT NOT NULL DEFAULT '16:9',       -- '16:9' (featured) | '4:3' | '1:1'
    target_width INTEGER NOT NULL DEFAULT 1200,
    target_height INTEGER NOT NULL DEFAULT 675,
    status TEXT NOT NULL DEFAULT 'PENDING',          -- Lifecycle state
    claimed_by TEXT,                                 -- Device ID of operator extension
    claimed_at DATETIME,
    completed_at DATETIME,
    error_message TEXT,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,

    -- Role validation
    CHECK (role IN ('featured', 'inline')),

    -- Media Type validation (Image only for Media-1)
    CHECK (media_type IN ('image', 'video')),

    -- Job Lifecycle Statuses
    CHECK (status IN (
        'PENDING',           -- Queued, awaiting operator pickup
        'IN_PROGRESS',       -- Claimed by operator in extension
        'READY_TO_UPLOAD',   -- Image selected and validated in extension
        'UPLOADING',         -- Transmission to R2 in flight
        'ATTACHED',          -- Uploaded, verified, attached to article
        'FAILED',            -- Unrecoverable error (logged with error_message)
        'SKIPPED'            -- Operator intentionally skipped this job
    ))
);

-- Indices for rapid queue polling and lookups
CREATE INDEX IF NOT EXISTS idx_media_jobs_status ON media_jobs(status, created_at ASC);
CREATE INDEX IF NOT EXISTS idx_media_jobs_article_id ON media_jobs(article_id);
CREATE INDEX IF NOT EXISTS idx_media_jobs_article_slug ON media_jobs(article_slug);
```

### 4.2. Job State Machine & Transition Rules

```text
 ┌─────────┐
 │ PENDING │ ◄── Initial state upon Hermes Ingest or Admin Draft creation
 └────┬────┘
      │ Operator opens job in Extension
      ▼
┌─────────────┐        Operator cancels / skips
│ IN_PROGRESS ├─────────────────────────────────────────┐
└─────┬───────┘                                         │
      │ Image dropped/pasted & passes preflight         │
      ▼                                                 │
┌─────────────────┐                                     ▼
│ READY_TO_UPLOAD │                               ┌───────────┐
└─────┬───────────┘                               │  SKIPPED  │
      │ Operator clicks [ Send to RancangLoka ]   └───────────┘
      ▼                                                 ▲
 ┌───────────┐                                          │
 │ UPLOADING │                                          │
 └────┬──────┴────────────────────────┐                 │
      │ Server 200 OK                 │ Server 4xx/5xx  │
      ▼                               ▼                 │
 ┌──────────┐                   ┌──────────┐            │
 │ ATTACHED │                   │  FAILED  ├────────────┘
 └──────────┘                   └────┬─────┘
                                     │ Retry
                                     ▼
                              ┌─────────────┐
                              │ IN_PROGRESS │
                              └─────────────┘
```

#### Critical Invariants:
1. **Status Isolation:** Transitions of `media_jobs.status` **NEVER** alter `articles.status`. Articles remain in `'draft'`.
2. **Readiness Recalculation:** When `media_jobs.status` transitions to `'ATTACHED'`, the MEDIA-0 engine automatically calculates whether the article's `editorialReadiness` qualifies as `READY_FOR_REVIEW`.
3. **Idempotent Completion:** If an upload succeeds but the network times out on the receipt response, re-submitting the same SHA-256 binary yields an idempotent `'ATTACHED'` transition without creating duplicate database records.

---

## 5. Extension User Experience (UX) & Layout

### 5.1. UI Surfaces in Manifest V3
1. **Chrome Side Panel API (`chrome.sidePanel`):** Primary recommended surface. Sits persistently alongside ChatGPT or any tab without closing when clicking outside.
2. **Action Popup (`chrome.action`):** Fallback compact view accessible from browser toolbar.

### 5.2. Minimal Operator UI Wireframe

```text
+-------------------------------------------------------------+
| [rl] LokaMedia Extension                       [● Connected] |
+-------------------------------------------------------------+
| ARTICLE DRAFT                                               |
| Perbedaan Atap Metal Pasir dan Genteng Beton                |
| Slug: perbedaan-atap-metal-pasir-genteng-beton              |
| ID: #42  |  Category: Sistem & Konstruksi Rumah             |
+-------------------------------------------------------------+
| SLOT & ROLE                                                 |
| [ Featured Image (Hero 16:9)                              v]|
+-------------------------------------------------------------+
| PROMPT                                                      |
| +---------------------------------------------------------+ |
| | Modern Indonesian minimalist residential house with a   | |
| | dark charcoal matte sand-coated metal roof, clean roof  | |
| | ridges, warm afternoon architectural photography,       | |
| | photorealistic 8k, eye level angle, lush tropical garden| |
| +---------------------------------------------------------+ |
| [📋 Copy Prompt to Clipboard]            [Aspect Ratio: 16:9]|
+-------------------------------------------------------------+
| IMAGE INTAKE (Universal Fallback)                           |
| + - - - - - - - - - - - - - - - - - - - - - - - - - - - - + |
| |                                                         | |
| |         📁 Drag & Drop Image Here                       | |
| |            or Paste (Ctrl+V)                            | |
| |            or Click to Browse                           | |
| |                                                         | |
| + - - - - - - - - - - - - - - - - - - - - - - - - - - - - + |
|                                                             |
| [ Preview: 1792x1024 (16:9) | 1.84 MB | WebP | OK: Valid  ] |
+-------------------------------------------------------------+
| ALT TEXT (SEO)                                              |
| [Atap metal pasir warna arang terpasang rapi pada rumah...] |
+-------------------------------------------------------------+
| STATUS: READY_TO_UPLOAD                                     |
| [  🚀 Send to RancangLoka  ]               [ Skip Job ]     |
+-------------------------------------------------------------+
```

### 5.3. Launching Without Manual Entry
Operators must **never** manually copy and paste numeric Article IDs:
1. **Admin CMS Deep Launch:** Each draft post in `/admin/posts` displays a *"Generate Media with LokaMedia"* button. Clicking it dispatches a custom protocol link `lokamedia://job?id=mjob_xyz` or sets an active job cookie/localStorage item, automatically loading the job in the extension.
2. **Extension Job Dropdown:** If opened cold, the extension queries `GET /api/internal/v1/media/jobs?status=PENDING` and presents a clean list of articles awaiting imagery. Selecting an article populates the prompt, slot, and alt text instantly.

---

## 6. Zero-Trust Security & Device Credential Model

### 6.1. Credential Boundary & Prohibitions
To preserve system integrity, the extension is strictly isolated from core system credentials.

**The LokaMedia Extension MUST NEVER possess, receive, or store:**
- Admin login credentials (email, PBKDF2 password hashes, session cookies).
- Hermes Ingestion HMAC secrets (`RANCANGLOKA_INGEST_KEY_*`).
- Publication Inventory read keys (`RANCANGLOKA_INVENTORY_READ_KEY_*`).
- Cloudflare API tokens, Global Keys, or Account IDs.
- Database backup / restore authorization secrets (`DR1_*`).
- Cloudflare Workers deployment credentials.

### 6.2. Permitted Capability Scope
The extension holds a single, dedicated, least-privilege device credential restricted to:

```text
media:read:jobs      (Permission to read pending media jobs and job details)
media:write:draft    (Permission to upload binary assets and attach to DRAFT articles)
```

**Explicitly Denied Capabilities:**
- `article:publish` — **BLOCKED** (Cannot publish or schedule articles).
- `article:update_body` — **BLOCKED** (Cannot alter `content_md` or `content_html`).
- `article:delete` — **BLOCKED** (Cannot delete articles).
- `backup:read` / `backup:restore` — **BLOCKED**.
- `settings:write` — **BLOCKED**.

### 6.3. Device Enrollment & Token Architecture
Credentials must **never** be hardcoded into the extension's `manifest.json` or source code.

```text
┌────────────────────────┐                   ┌────────────────────────┐
│  RancangLoka Admin UI  │                   │  LokaMedia Extension   │
│  /admin/settings/media │                   │      Setup Screen      │
└───────────┬────────────┘                   └───────────┬────────────┘
            │                                            │
            │ 1. Admin generates Device Token            │
            │    "Operator MacBook (Chrome)"             │
            ▼                                            │
   Generates Pair:                                       │
   - Device ID: dev_chr_8f2e91...                        │
   - Token Secret: lkmd_sec_99a34b...                    │
            │                                            │
            │ 2. One-time display / QR code              │
            ├───────────────────────────────────────────►│
            │                                            │ 3. Operator pastes
            │                                            │    Token into Setup
            │                                            │
            │                                            ▼
            │                                  Stored securely in:
            │                                  chrome.storage.local
            │                                  (Isolated to extension)
            │                                            │
            │ 4. Authenticated Request                   │
            │    X-RL-Device-ID: dev_chr_8f2e91...       │
            │    Authorization: Bearer lkmd_sec_99a34b.. │
            │◄───────────────────────────────────────────┤
            │                                            │
```

#### D1 Device Tokens Table (`media_devices`):
```sql
CREATE TABLE IF NOT EXISTS media_devices (
    device_id TEXT PRIMARY KEY,                      -- dev_chr_<16-chars>
    device_name TEXT NOT NULL,                       -- e.g. "Editor Laptop Chrome"
    token_hash TEXT NOT NULL,                        -- SHA-256 of token secret
    scope TEXT NOT NULL DEFAULT 'media:device',      -- Enforces media:read:jobs + media:write:draft
    status TEXT NOT NULL DEFAULT 'ACTIVE',           -- 'ACTIVE' | 'REVOKED'
    last_used_at DATETIME,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CHECK (status IN ('ACTIVE', 'REVOKED'))
);
```

---

## 7. API Contract & Production MEDIA-0 Reuse

### 7.1. Reusing Production MEDIA-0 Upload API
The existing production endpoint `POST /api/internal/v1/media/upload` (implemented in MEDIA-0) **already handles 100% of binary ingestion, R2 storage, D1 `media_assets` registration, `article_media` relational binding, compatibility mirroring, and editorial readiness calculation.**

**Decision:** We reuse `POST /api/internal/v1/media/upload` directly. No separate binary upload endpoint will be created.

### 7.2. Minimally Required Additional APIs
To support the complete extension lifecycle, only three lightweight endpoints are needed:

| Endpoint | Method | Purpose | Existing / New |
| :--- | :--- | :--- | :--- |
| `/api/internal/v1/media/upload` | `POST` | Upload binary image, save to R2, attach to draft article | **REUSE (Existing MEDIA-0)** |
| `/api/internal/v1/media/jobs` | `GET` | List pending media jobs for operator queue | **NEW (Phase MEDIA-1 API)** |
| `/api/internal/v1/media/jobs/[job_id]` | `GET` | Retrieve metadata, prompt, and target specs for a single job | **NEW (Phase MEDIA-1 API)** |
| `/api/internal/v1/media/jobs/[job_id]` | `PATCH` | Update job state (`IN_PROGRESS`, `SKIPPED`, `FAILED`, `ATTACHED`) | **NEW (Phase MEDIA-1 API)** |

### 7.3. Endpoint Contracts

#### A. `GET /api/internal/v1/media/jobs`
- **Auth:** `Authorization: Bearer <device_token>` + `X-RL-Device-ID: <device_id>`
- **Query Params:** `status=PENDING` (optional, default `PENDING`), `limit=20`
- **Response 200 OK:**
  ```json
  {
    "status": "success",
    "jobs": [
      {
        "job_id": "mjob_3fa85f64-5717-4562-b3fc-2c963f66afa6",
        "article_id": 42,
        "article_slug": "perbedaan-atap-metal-pasir-genteng-beton",
        "article_title": "Perbedaan Atap Metal Pasir dan Genteng Beton untuk Rumah Tropis",
        "role": "featured",
        "slot_key": "primary",
        "media_type": "image",
        "prompt": "Modern Indonesian minimalist residential house with dark charcoal matte sand-coated metal roof...",
        "alt_text": "Atap metal pasir warna arang terpasang rapi pada rumah minimalis tropis",
        "aspect_ratio": "16:9",
        "target_width": 1200,
        "target_height": 675,
        "status": "PENDING",
        "created_at": "2026-09-07T08:30:00Z"
      }
    ]
  }
  ```

#### B. `PATCH /api/internal/v1/media/jobs/[job_id]`
- **Auth:** `Authorization: Bearer <device_token>`
- **Request Body:**
  ```json
  {
    "status": "IN_PROGRESS",  // or "SKIPPED", "FAILED"
    "error_message": null
  }
  ```
- **Response 200 OK:** Returns updated job object.

#### C. `POST /api/internal/v1/media/upload` (MEDIA-0 Existing Contract)
- **Parameters (Multipart or Binary Stream):**
  - `file`: Raw binary image payload.
  - `article_id`: Target draft article integer ID.
  - `role`: `'featured'` | `'inline'`
  - `alt_text`: Pre-calculated alt text.
  - `job_id`: *(Optional new query/form param)* When supplied, server transitions `media_jobs(job_id)` to `'ATTACHED'` atomically upon successful media upload.

---

## 8. Dual-Layer Image Validation

### 8.1. Client-Side Preflight (Extension Convenience Layer)
Provides immediate, friendly feedback before consuming network bandwidth:
- **MIME Check:** Validates file extension and client MIME (`image/jpeg`, `image/png`, `image/webp`). Flags unsupported types like GIF, SVG, BMP, AVIF.
- **File Size Ceiling:** Rejects files > 5 MiB (`5,242,880 bytes`) with message: *"Ukuran gambar melebihi batas 5 MB. Harap kompres terlebih dahulu."*
- **Dimension Check:** Reads image element `naturalWidth` and `naturalHeight`:
  - Enforces minimum dimensions: `>= 600px` width, `>= 338px` height.
  - Warns if aspect ratio deviates significantly (> 10%) from requested ratio (e.g. 16:9).
- **Alt Text Check:** Enforces non-empty alt text string before enabling submit button.

### 8.2. Server-Side Authoritative Verification (MEDIA-0 Engine)
Client-side checks can be bypassed or manipulated. Therefore, **the server remains 100% authoritative**:
1. **Magic Bytes Parsing:** Inspects exact initial bytes (JPEG `FF D8 FF`, PNG `89 50 4E 47`, WebP `RIFF...WEBP`). Rejects forged headers with `415 INVALID_MIME_TYPE`.
2. **Binary Header Decoding:** Decodes Start of Frame (SOF) for JPEG, IHDR for PNG, VP8/VP8L/VP8X for WebP to read true pixel dimensions. Rejects corrupt files with `422 CORRUPT_IMAGE_PAYLOAD`.
3. **Hard Size Limit:** Enforces strict 5 MiB ceiling via Content-Length and buffer length (`413 FILE_TOO_LARGE`).
4. **Draft Article State:** Re-checks that `articles.status == 'draft'`. If the article was published or archived, rejects upload with `409 ARTICLE_NOT_DRAFT`.

---

## 9. Idempotency & Failure Recovery

| Potential Failure Scenario | Extension Mitigation | Server-Side Mitigation |
| :--- | :--- | :--- |
| **Operator double-clicks "Send"** | Button immediately disabled upon click; displays loading spinner. | `processMediaUpload` checks if an active binding (`is_active = 1`) with the same `asset_id` exists for that article and role. Returns 200 OK idempotently without duplicate records. |
| **Network disconnects mid-upload** | Extension catches `fetch` error, retains the dropped/pasted image in memory, changes state to `FAILED`, and displays a prominent `[ Retry ]` button. | Cloudflare Worker terminates cleanly; if R2 write did not finish, zero D1 records are written. Fail-closed architecture. |
| **Identical image uploaded twice** | Extension proceeds normally. | Server computes SHA-256 hash. If hash matches an existing asset in `media_assets` with status `VALIDATED`, the R2 upload is skipped, existing `asset_id` is reused (`deduplicated: true`), and `article_media` is bound. |
| **Browser closed during generation** | When reopened, extension fetches `media_jobs` from D1. If job was marked `IN_PROGRESS`, operator can resume without losing draft context. | Completed jobs remain `ATTACHED` in D1. Refreshing does not overwrite or lose historical attachments. |

---

## 10. Future Extensibility (Decoupled Design)

The architecture deliberately decouples the **operator interface** from the **underlying generation engine**:

```text
                        ┌───────────────────────────────┐
                        │      LokaMedia Extension      │
                        │       Intake Interface        │
                        └───────────────┬───────────────┘
                                        │
             ┌──────────────────────────┼──────────────────────────┐
             ▼                          ▼                          ▼
┌─────────────────────────┐ ┌─────────────────────────┐ ┌─────────────────────────┐
│     PHASE MEDIA-1       │ │       PHASE MEDIA-2     │ │      FUTURE MEDIA-3     │
│   (Current Milestone)   │ │       (Future Work)     │ │       (Future Work)     │
├─────────────────────────┤ ├─────────────────────────┤ ├─────────────────────────┤
│ • ChatGPT Manual Web UI │ │ • Automatic Fal.ai API  │ │ • Video Support         │
│ • Universal Fallback    │ │   (AUTO_FAL = OFF now)  │ │   (MIME video/mp4)      │
│ • IMAGE ONLY            │ │ • Direct Serverless GPU │ │ • Motion clips          │
│ • Zero External API Cost│ │ • Retains Draft Gate    │ │ • Retains Draft Gate    │
└─────────────────────────┘ └─────────────────────────┘ └─────────────────────────┘
```

- **Fal.ai Readiness:** D1 schema and `media_assets.source_type` already include `'fal_generated'` in their `CHECK` constraints. When Fal is enabled in the future, the backend simply deposits images directly into R2 and updates `media_jobs` without altering the extension contract.
- **Video Readiness:** `media_assets.media_type` and `media_jobs.media_type` already support `'video'`. Code paths in MEDIA-1 enforce `media_type === 'image'`.
- **Zero Premature Complexity:** Zero code for Fal or Video is implemented in MEDIA-1.

---

## 11. Verification Checklist for MEDIA-1 Design

- [x] **Primary Workflow:** Fully mapped from article draft -> prompt copy -> manual generator -> extension intake -> preflight -> MEDIA-0 API -> R2 -> D1 -> Draft maintained -> Editorial readiness `READY_FOR_REVIEW`.
- [x] **Extension Identity:** Canonical name established as `LokaMedia Extension`. Legacy naming strictly forbidden.
- [x] **DOM Independence:** Two distinct tiers designed. Mode B (Universal Fallback: Drag/Drop/Paste/Picker) is 100% independent of ChatGPT DOM.
- [x] **Media Queue Contract:** Persistent `media_jobs` table specified with all required fields, state machine, and D1 indexes.
- [x] **Minimal UX:** Clean, ergonomic operator wireframe designed with 1-click prompt copy, image preview, alt text display, and progress states.
- [x] **Security Model:** Dedicated `media:device` token model designed. Zero permission to publish, edit article body, delete articles, or access Cloudflare.
- [x] **API Reuse:** 100% reuse of production `POST /api/internal/v1/media/upload`. Minimal additional endpoints specified for job queue management (`GET/PATCH /api/internal/v1/media/jobs`).
- [x] **Dual Validation:** Client preflight specified for UX; server validation remains authoritative via magic bytes and true dimension headers.
- [x] **Idempotency:** Double-click protection, SHA-256 deduplication, and safe network retry mechanisms detailed.
- [x] **Safe Guardrails Maintained:** `AUTO_FAL = OFF`, `AUTO_PUBLISH = OFF`, `IMAGE_ONLY = YES`, `VIDEO = RESERVED`, `PRODUCTION_MUTATION = NONE`.
