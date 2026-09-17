# 🧩 LokaMedia Extension — Implementation Report (MEDIA-1)

**Document Version:** 1.1.0  
**Milestone:** MEDIA-1 — LokaMedia Extension Implementation  
**Status:** COMPLETE & PRODUCTION SMOKE VERIFIED (Zero Production Residue)  
**Date:** 2026-09-07  

---

## 1. Executive Summary

Milestone **MEDIA-1 (LokaMedia Extension)** delivers the first working implementation of the browser extension companion for RancangLoka's editorial visual pipeline. It bridges manual image generation workflows (ChatGPT, Midjourney, Ideogram, etc.) into the **LokaMedia Foundation (MEDIA-0)** without fragile DOM dependencies, automated publishing risks, or credential leakages.

### Key Milestones Delivered:
1. **Manifest V3 Extension:** Full unpacked Chrome/Edge/Brave extension located at `rancangloka-astro/extension/` with clean Apple-editorial dark UI.
2. **Universal Fallback:** 100% resilient image intake via Drag & Drop, native File Picker, and Clipboard Paste (`Ctrl+V`). Zero dependency on ChatGPT DOM.
3. **D1 Media Queue Schema (`0006_media_jobs_queue.sql`):** Relational queue tracking visual jobs (`job_id`, `article_id`, `role`, `prompt`, `alt_text`, `aspect_ratio`, `status`) and dedicated device tokens (`media_devices`). Applied to both Local and Production D1.
4. **Media Jobs REST API:** `GET /api/internal/v1/media/jobs`, `GET /api/internal/v1/media/jobs/[job_id]`, and `PATCH /api/internal/v1/media/jobs/[job_id]`.
5. **MEDIA-0 Reuse:** 100% reuse of the authoritative production upload engine (`POST /api/internal/v1/media/upload`) with atomic job attachment, SHA-256 deduplication, and editorial readiness recalculation.
6. **Zero-Trust Device Security:** Dedicated device credential scope (`media:device`, `media:write:draft`, `media:read`). Zero permission to publish, edit article body, delete articles, access backups, or deploy Cloudflare.
7. **Production Controlled Smoke:** Verified live end-to-end on `https://rancangloka.com` with internal draft article #3, followed by 100% clean baseline restoration and zero production residue.

---

## 2. Chrome Extension Architecture (Manifest V3)

The extension is organized in `rancangloka-astro/extension/`:

```text
rancangloka-astro/extension/
├── manifest.json         # Manifest V3 specification with storage permission & localhost/prod host matches
├── popup.html            # Minimal, ergonomic operator UI
├── popup.css             # Apple-minimalist styling with responsive dropzone & badges
├── popup.js              # Vanilla JS logic with Universal Fallback & idempotent upload
├── icons/
│   ├── icon16.png        # 16x16 PNG extension badge
│   ├── icon48.png        # 48x48 PNG extension icon
│   └── icon128.png       # 128x128 PNG extension store icon
└── README.md             # Operator installation guide
```

### 2.1. Manifest V3 Configuration
- Uses `action.default_popup` targeting `popup.html`.
- Requires only `storage` permission (to persist device pairing token and last active job).
- No intrusive permissions (no `webRequest`, no `debugger`, no background tabs monitoring).
- Zero remote script execution.

### 2.2. Universal Fallback Implementation
- **File Picker:** Hidden `<input type="file" accept="image/jpeg,image/png,image/webp">` triggered when clicking dropzone.
- **Drag & Drop:** `dragover`, `dragleave`, and `drop` handlers on the dropzone. Prevents default browser navigation and extracts `e.dataTransfer.files[0]`.
- **Clipboard Paste:** Global `window.addEventListener('paste', ...)` interceptor. Reads `e.clipboardData.items` for `image/*` MIME type and loads the pasted image immediately into memory.
- **Preflight Client Inspection:** Immediately inspects MIME, enforces 5 MB ceiling, verifies minimum resolution (600x338), and renders live client preview with resolution and size badges.

---

## 3. Database Schema: Migration 0006 (`media_jobs_queue.sql`)

Created in `db/migrations/0006_media_jobs_queue.sql`:

### 3.1. `media_jobs` Table
```sql
CREATE TABLE IF NOT EXISTS media_jobs (
    job_id TEXT PRIMARY KEY,
    article_id INTEGER NOT NULL REFERENCES articles(id) ON DELETE CASCADE,
    article_slug TEXT NOT NULL,
    article_title TEXT NOT NULL,
    role TEXT NOT NULL DEFAULT 'featured',
    slot_key TEXT NOT NULL DEFAULT 'primary',
    media_type TEXT NOT NULL DEFAULT 'image',
    prompt TEXT NOT NULL,
    alt_text TEXT NOT NULL,
    aspect_ratio TEXT NOT NULL DEFAULT '16:9',
    target_width INTEGER NOT NULL DEFAULT 1200,
    target_height INTEGER NOT NULL DEFAULT 675,
    status TEXT NOT NULL DEFAULT 'PENDING',
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CHECK (role IN ('featured', 'inline')),
    CHECK (media_type IN ('image', 'video')),
    CHECK (status IN ('PENDING', 'IN_PROGRESS', 'READY_TO_UPLOAD', 'UPLOADING', 'ATTACHED', 'FAILED', 'SKIPPED'))
);
```

### 3.2. `media_devices` Table
```sql
CREATE TABLE IF NOT EXISTS media_devices (
    device_id TEXT PRIMARY KEY,
    device_name TEXT NOT NULL,
    token_hash TEXT NOT NULL,
    scope TEXT NOT NULL DEFAULT 'media:device',
    status TEXT NOT NULL DEFAULT 'ACTIVE',
    last_used_at DATETIME,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CHECK (status IN ('ACTIVE', 'REVOKED'))
);
```

---

## 4. API Endpoints & Production Ingestion Reuse

| Endpoint | Method | Security | Functionality |
| :--- | :--- | :--- | :--- |
| `/api/internal/v1/media/jobs` | `GET` | Device Auth | Lists pending/active jobs with status and article filtering. |
| `/api/internal/v1/media/jobs` | `POST` | Device Auth | Queue helper to create new media jobs for testing/staging. |
| `/api/internal/v1/media/jobs/[job_id]` | `GET` | Device Auth | Fetches full job specifications (prompt, aspect ratio, alt text). |
| `/api/internal/v1/media/jobs/[job_id]` | `PATCH` | Device Auth | Transitions job state (`IN_PROGRESS`, `SKIPPED`, `FAILED`). |
| `/api/internal/v1/media/upload` | `POST` | Device Auth / Media Key | **MEDIA-0 Reuse:** Binary inspection, R2 write, D1 attachment, atomic job transition to `ATTACHED`. |

---

## 5. Security Model & Invariants

1. **Zero Publication Capability:** Device tokens are restricted to `media:device` / `media:write:draft`. Any request claiming `publish` or `article:edit` is rejected with `403 FORBIDDEN_SCOPE`.
2. **Article Status Remains DRAFT:** Media ingestion and job completion strictly maintain `articles.status = 'draft'`. Articles are never automatically published.
3. **No Credential Leakage:** No admin passwords, Hermes ingest keys, or Cloudflare API tokens exist in the extension. Pairing is managed via an isolated device token saved in `chrome.storage.local`.
4. **Authoritative Server Validation:** Magic bytes inspection (JPEG `FF D8 FF`, PNG `89 50 4E 47`, WebP `RIFF...WEBP`) and true pixel dimensions remain enforced server-side.
5. **Idempotency & Safe Retries:** Double-click protection locks the submit button. Resending the same image SHA reuses the existing asset record (`deduplicated: true`) and avoids duplicate active attachments. Network failures can be retried safely.

---

## 6. Automated Test Results

Executed via `node scripts/test-lokamedia-extension.js`:

```text
====================================================
🧪 RANCANGLOKA MEDIA-1 AUTOMATED TEST SUITE
====================================================

[Test 1: Pending Jobs List Endpoint]
  ✅ PASS: Jobs list returns 200 OK
  ✅ PASS: Response status is success
  ✅ PASS: Response contains jobs array
  ✅ PASS: Contains at least 1 pending job
  ✅ PASS: First job ID matches expected fixture
  ✅ PASS: Job role is featured
  ✅ PASS: Media type is image

[Test 2: Get Single Job by ID]
  ✅ PASS: Single job retrieval returns 200 OK
  ✅ PASS: Returns correct target article_id
  ✅ PASS: Returns correct prompt text
  ✅ PASS: Job status is initially PENDING

[Test 3: Non-Existent Job 404 Rejection]
  ✅ PASS: Non-existent job ID returns 404 Not Found

[Test 4: Universal Fallback & Image Preflight]
  ✅ PASS: Inspects true pixel dimensions (800x450)
  ✅ PASS: Detects PNG magic bytes correctly
  ✅ PASS: Rejects undersized image (< 600x338)
  ✅ PASS: Throws exception on undersized dimensions
  ✅ PASS: Rejects non-image magic bytes with INVALID_MIME_TYPE
  ✅ PASS: Throws exception on non-image binary
  ✅ PASS: Rejects payload < 16 bytes with CORRUPT_IMAGE_PAYLOAD
  ✅ PASS: Throws exception on truncated payload

[Test 5: Reused MEDIA-0 Upload API & ATTACHED Transition]
  ✅ PASS: Upload succeeds with 200 OK
  ✅ PASS: Response status is success
  ✅ PASS: First upload is not deduplicated (new R2 write)
  ✅ PASS: Response references job_id
  ✅ PASS: Job status transitioned to ATTACHED
  ✅ PASS: Editorial readiness updated to READY_FOR_REVIEW
  ✅ PASS: Job record status in D1 is ATTACHED

[Test 6: Double Send Idempotency]
  ✅ PASS: Second upload returns 200 OK idempotently
  ✅ PASS: Existing SHA-256 asset is deduplicated (zero redundant R2 write)
  ✅ PASS: Reuses identical asset_id
  ✅ PASS: Exactly one active featured binding exists
  ✅ PASS: No duplicate rows added to article_media

[Test 7: Safe Upload Retry]
  ✅ PASS: Retry upload succeeds with 200 OK
  ✅ PASS: Retry response is successful

[Test 8: Failed State Transition]
  ✅ PASS: Status update to FAILED returns 200 OK
  ✅ PASS: Job status transitioned to FAILED

[Test 9: Skipped State Transition]
  ✅ PASS: Status update to SKIPPED returns 200 OK
  ✅ PASS: Job status transitioned to SKIPPED

[Test 10: Zero-Trust Security Scope Guardrails]
  ✅ PASS: Device request claiming publish scope is denied
  ✅ PASS: Returns 403 Forbidden on forbidden scope
  ✅ PASS: Device request claiming article:edit scope is denied
  ✅ PASS: Device request with media:device scope is authenticated

[Test 11: State Preservation Across Extension Restart]
  ✅ PASS: Reopening extension preserves ATTACHED state from D1

[Test 12: Invariant: Article Remains Strictly 'draft']
  ✅ PASS: Target article #42 status is strictly 'draft'
  ✅ PASS: Target article #42 was NEVER mutated to published
  ✅ PASS: Target article featured_image compatibility mirror was populated
  ✅ PASS: Target article image_alt compatibility mirror was populated
  ✅ PASS: Uploading media to published articles is strictly barred (ARTICLE_NOT_DRAFT 409)

====================================================
Test Results: 48 Passed, 0 Failed
====================================================
```
