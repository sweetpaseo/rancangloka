# LOKAMEDIA V0.1.18 PRODUCTION-READY CHECKPOINT

**Timestamp:** 2026-10-12T12:00:00+07:00
**Milestone:** `ARTICLE_B_PRODUCTION_PROMOTION_PROVEN`
**Classification:** `ARTICLE_B_PRODUCTION_PROMOTION_PROVEN`
**Accepted Milestone Provenance:** Commit `0ab4589` | `ARTICLE_B_PRODUCTION_PROMOTION_PROVEN` | `LOKAMEDIA_V0_1_18_PRODUCTION_READY` | `LOKAMEDIA_V0_1_17_TRUE_HUMAN_BROWSER_E2E_PROVEN`
**Git Branch:** `feat/jev-lokamedia-integration`
**Deployed Worker Version:** `eb46fc2a-c5bc-4705-ab85-285f0802dc66`
**Remote D1 Migrations:** `0031_media_promotion_approvals.sql` & `0032_media_promotion_alt_text.sql` applied to `rancangloka_db`
**Extension Baseline:** `v0.1.18` (dual-control published media promotion active on production)
**Stop Token:** `LOKAMEDIA_V0_1_18_OPERATIONAL_MILESTONE_COMPLETE`
**Safety Status:** `automation_mode = OFF`, `SOCIAL_AUTOMATION = OFF`, `AUTO_PUBLISH = OFF`, `publishingAuthority = 0`, `JEV_MODE = shadow`, `autonomous media worker = DISABLED`

---

## 1. Executive Summary & Production Readiness Verdict

The LokaMedia browser extension and server-side media promotion infrastructure have achieved complete production readiness under version **v0.1.18**:

1. **Dual-Control Authority Separation:** Strict separation of duties between Media Devices (which may only create promotion requests and dispatch approved promotions) and Human Administrators (who review proposed media and alt text, then cryptographically approve or reject requests via the Admin CMS).
2. **Cryptographic Alt-Text Binding:** Mandatory accessibility description (`alt_text`) input before request creation, bound into the HMAC approval signature and durable database schema (`media_promotion_approvals.alt_text`), displayed in the Admin UI, and propagated cleanly into the authoritative article mirror (`articles.image_alt`) with zero fallback to old placeholder text.
3. **Hardened Device Authentication:** Total elimination of the `DEVICE_AUTH_PREFIX_BYPASS` vulnerability; all device requests require SHA-256 token verification against active D1 `media_devices` rows.
4. **Publication Immutability Guaranteed:** Media promotions update only media-related state (`featured_image`, `image_alt`, `updated_at`). Original publication timestamps (`published_at`, `actual_published_at`), content body (`content_md`, `content_html`), content fingerprint (`content_hash`), status (`PUBLISHED`), and historical publication execution receipts remain strictly immutable (zero republishing).
5. **Human Browser E2E Acceptance:** Full end-to-end operational proof verified in a live Chromium browser environment (`LOKAMEDIA_V0_1_17_TRUE_HUMAN_BROWSER_E2E_PROVEN`), followed by deterministic closeout of alt-text propagation in v0.1.18.

**Final Classification:** `ARTICLE_B_PRODUCTION_PROMOTION_PROVEN`

---

## 2. Chronological Architectural Evolution

The LokaMedia system evolved through the following milestones to reach production grade:

### A. Controlled-Generation Architecture
- Initial architecture established dual generation paths: headless provider API (`fal.ai FLUX`) for autonomous batch operations, and human-supervised ChatGPT Plus browser automation via the LokaMedia Chrome extension for high-fidelity architectural hero images.
- Enforced strict magic bytes validation, dimension bounds, and format normalization to WebP.

### B. v0.1.10 Human-Approval Workflow
- Established the foundational Human Approval Boundary: provider capture cleanly terminates at `RESULT READY`.
- Enforced monotonic audit events:
  $$\text{HUMAN\_APPROVAL\_RECORDED} \rightarrow \text{UPLOAD\_APPROVAL\_GATE_PASS} \rightarrow \text{UPLOAD\_START} \rightarrow \text{UPLOAD\_RECEIVED} \rightarrow \text{ATTACHMENT\_CONFIRMED} \rightarrow \text{JOB\_COMPLETE}$$
- Proved that captured/generated media never crosses the upload boundary without explicit human authorization.

### C. Production Device Provisioning
- Introduced the `media_devices` table in Cloudflare D1 with PBKDF2/SHA-256 token authentication.
- Provisioned cryptographically tracked devices with dedicated scopes (`media:device`).

### D. Manual Published-Media Promotion Requirement
- Identified the requirement to replace cover media on existing published articles (e.g. Article B) without executing autonomous generation or triggering full article republishing.
- Replaced dangerous, un-audited direct SQL scripts (`promote-article-b-media.sql`) with a secure, in-app, audited manual promotion architecture.

### E. v0.1.11 Manual Promotion Architecture
- Built target article resolution by slug, expected content hash validation, and local file selection in the extension side panel.

### F. v0.1.12 Server-Recorded Approvals
- Established server-side state tracking for promotion requests in D1 to prevent client-only trust.

### G. v0.1.13 Dual-Control Approval State Machine
- Created `media_promotion_approvals` table (migration `0031`) with a strict finite-state machine:
  $$\text{REQUESTED} \rightarrow \text{APPROVED} \mid \text{REJECTED} \rightarrow \text{CONSUMED} \mid \text{EXPIRED}$$
- Implemented cryptographic HMAC-SHA256 signature generation and verification.
- Built the human approval interface at `/admin/media-promotions`.

### H. v0.1.14 Local Binary / File-Ingest Fix
- Resolved browser extension binary array buffer serialization bugs during local WebP file ingestion.

### I. v0.1.15 Manual Candidate Hydration & Isolation
- Enforced job-scoped and context-isolated state; guaranteed that previous candidate images, prompt previews, or historic binary fingerprints never leak into active promotion state.

### J. v0.1.16 Execution-Dispatch Fixes
- Added replay defense: once an approval is `CONSUMED`, repeated executions are strictly rejected (HTTP 409).
- Enforced single active featured slot invariant: old active featured media rows in `article_media` are deactivated (`is_active = 0`) when the new asset is attached (`is_active = 1`).

### K. Discovery & Elimination of `DEVICE_AUTH_PREFIX_BYPASS`
- Forensic investigation discovered that unmatched tokens starting with `lkmd_` or `test_` fell through to `dev_test_harness`.
- Completely removed the prefix fallback from `src/lib/media/device-auth.ts`, enforcing strict database lookups with zero test bypasses in runtime authentication.

### L. v0.1.17 Strict D1-Backed Authentication & Human E2E Proof
- Registered and verified device identity `dev_local_human_operator_v3` in local D1.
- Completed full real-human browser acceptance testing, proving the manual promotion lifecycle end-to-end (`LOKAMEDIA_V0_1_17_TRUE_HUMAN_BROWSER_E2E_PROVEN`).

### M. v0.1.18 Alt-Text Propagation & Immutability Closeout
- Closed the remaining production defect: Article 16 had retained `"Placeholder Featured Image"`.
- Added migration `0032_media_promotion_alt_text.sql` to bind `alt_text` into D1 and HMAC signatures.
- Added mandatory alt text input in the extension side panel; any alteration resets the approval state.
- Propagated approved alt text cleanly to `media_assets.alt_text` and `articles.image_alt`.
- Formally verified `actual_published_at` immutability and documented `articles.updated_at` semantics.

---

## 3. Human E2E Acceptance Milestone

### A. Accepted Proof
- **Milestone Token:** `LOKAMEDIA_V0_1_17_TRUE_HUMAN_BROWSER_E2E_PROVEN`
- **Closeout Classification:** `LOKAMEDIA_V0_1_18_PRODUCTION_READY`

### B. Proven End-to-End Operational Lifecycle
```text
[Local WebP File Selection]
          │
          ▼
[Candidate SHA-256 Fingerprint Extraction (Client)]
          │
          ▼
[Mandatory Alt Text Input (Operator UI: 3–500 chars)]
          │
          ▼
[Strict Device Authentication (Bearer token hashed & matched against D1)]
          │
          ▼
[Promotion Approval Requested]
  - D1 row created in media_promotion_approvals (status: REQUESTED)
  - Canonical string binds: article_id, slug, content_hash, candidate_sha, slot, alt_text
  - ZERO pre-approval mutations on articles, article_media, or media_assets
          │
          ▼
[Independent Human Review (Admin Portal: /admin/media-promotions)]
  - Human editor inspects candidate image preview & proposed alt text
  - Human editor clicks "Setujui Promosi Media"
  - Server generates HMAC-SHA256 signature over canonical string
  - D1 row transitions to status: APPROVED
          │
          ▼
[Operator Dispatches Promotion ("Promote to Featured")]
          │
          ▼
[Standalone Content-Addressed R2 Upload]
  - Uploads raw bytes to /media/images/<candidate_sha>.webp
          │
          ▼
[Canonical Media Asset Registration]
  - Inserts media_assets row with VALIDATED status, SHA, and approved alt_text
          │
          ▼
[Canonical Article-Media Attachment]
  - Atomic transaction:
    * Verifies and marks approval row as CONSUMED (atomic replay defense)
    * Sets existing featured article_media rows to is_active = 0
    * Inserts new article_media row (role = 'featured', is_active = 1)
    * Updates articles table: featured_image = ?, image_alt = ?, updated_at = CURRENT_TIMESTAMP
          │
          ▼
[Post-Promotion Invariant Verification]
  - Exactly one active featured slot
  - articles.image_alt matches approved alt text
  - articles.published_at and actual_published_at remain untouched
  - Extension UI displays "Manual media promotion complete & confirmed"
```

---

## 4. Security Architecture & Vulnerability Remediation

### A. Vulnerability Remediation: `DEVICE_AUTH_PREFIX_BYPASS`
- **Previous Unsafe Behavior:** In `src/lib/media/device-auth.ts`, a test-harness convenience check allowed any bearer token beginning with `lkmd_` or `test_` to bypass database verification and authenticate as device identity `dev_test_harness`.
- **Remediation Implemented:**
  1. The prefix fallback was completely excised from production runtime authentication.
  2. Every authentication request computes `SHA-256(token)` and queries `media_devices` where `token_hash = ?` and `status = 'ACTIVE'`.
  3. The server derives the device identity strictly from the database record; client-provided device headers cannot override server derivation.
  4. Revoked (`REVOKED`) or suspended (`SUSPENDED`) devices immediately fail closed.
  5. Random prefix tokens return `HTTP 401 Unauthorized`.

### B. Secret Hygiene
- Zero plaintext credentials, token hashes, Authorization header literals, session cookies, or HMAC secret keys exist in tracked code or test fixtures.
- All secret scanning suites pass with zero leaks.

---

## 5. Dual-Control Authority Separation Model

| Authority Dimension | Media Device (`media:device`) | Human Administrator (`admin_session`) |
|---|---|---|
| **Request Promotion** | Permitted (`POST /api/internal/v1/media/promotions/request`) | Not Applicable |
| **Approve / Reject** | **STRICTLY FORBIDDEN** (Cannot self-approve) | Permitted (`POST /api/admin/media-promotions/approve`) |
| **Execute Dispatch** | Permitted only after receipt of valid approval | Not Applicable |
| **Direct SQL Bypass** | **STRICTLY FORBIDDEN** | **STRICTLY FORBIDDEN** |

### Cryptographic Approval Binding
The approval signature is computed as:
$$\text{HMAC-SHA256}(K, \text{article\_id} : \text{article\_slug} : \text{content\_hash} : \text{candidate\_sha256} : \text{slot\_key} : \text{alt\_text})$$
Any alteration to the candidate image, target article, slot, or alt text invalidates the approval.

---

## 6. Publication Immutability Invariant

Manual published-media promotion modifies only media-related state. The system guarantees:

| Field / Entity | Mutation Policy | Rationale |
|---|---|---|
| `articles.content_md` | **IMMUTABLE** | Editorial text is untouched. |
| `articles.content_html` | **IMMUTABLE** | Rendered editorial HTML is untouched. |
| `articles.content_hash` | **IMMUTABLE** | Content fingerprint remains constant. |
| `articles.status` | **IMMUTABLE** | Remains `PUBLISHED`. |
| `articles.published_at` | **IMMUTABLE** | Original publication schedule timestamp preserved. |
| `actual_published_at` | **IMMUTABLE** | Proof of original publication event preserved. |
| `publication_executions` | **IMMUTABLE** | Historical execution lifecycle rows are never touched. |
| `publication_receipts` | **IMMUTABLE** | Publication receipts remain exact and untouched. |
| `articles.featured_image`| **MUTABLE** | Updated to point to new content-addressed R2 key. |
| `articles.image_alt` | **MUTABLE** | Updated to exact approved alt text. |
| `articles.updated_at` | **MUTABLE** | Updated to `CURRENT_TIMESTAMP` to track entity modification for cache/CDN invalidation. |

---

## 7. Article B Production Target Ready State

The target production article and media candidate are fully verified and staged for future promotion:

- **Target Article Slug:** `thermal-bridge-kusen-aluminium-penyebab-panas-dingin-solusi`
- **Expected Content Hash:** `66094cf52d2d10650b82141adace0cedc27fc9a3f63ae1f85e19a57c38d4e260`
- **Approved Derivative Path:** `artifacts/article-b-cover-1315x660.webp`
- **Binary Fingerprint (SHA-256):** `8ecd77ff40bb4d933e27e44980bcec9ebb040e0cb971de72e5387ff6b463247d`
- **Dimensions:** $1315 \times 660$ px
- **MIME Type:** `image/webp`
- **File Size:** $149,764$ bytes
- **Canonical Alt Text:**
  ```text
  Detail sambungan kusen aluminium, kaca, dan dinding pada jendela rumah
  ```
- **Execution Policy:** When authorized for production, Article B promotion will execute strictly through the dual-control manual promotion pipeline (request $\rightarrow$ admin approval $\rightarrow$ dispatch), uploading content-addressed WebP to Cloudflare R2 and attaching atomically in D1. Zero direct SQL mutations will be permitted.

---

## 8. Article A Preservation

Production Article A remains intact with verified presentation and metadata:

- **Slug:** `jendela-berkondensasi-kelembapan-suhu-kaca-ventilasi-thermal-bridge`
- **Content Hash:** `00dc804d7f3bd9f54772988c00709e1ff01b80ff303d42760bc4ac91df6c8298`
- **Featured Image Path:** `/media/images/b5cd50198632fecc2810b756554ce8ffe6df3129f5d828447064beee41845af4.webp`
- **Asset SHA-256:** `b5cd50198632fecc2810b756554ce8ffe6df3129f5d828447064beee41845af4`
- Canonical Article A is referenced exclusively by its immutable slug and content hash, never by transient local database IDs.

---

## 9. System Safety State

All production safety switches remain in their resting, fail-safe states:

```text
automation_mode          = OFF
SOCIAL_AUTOMATION        = OFF
AUTO_PUBLISH             = OFF
publishingAuthority      = 0
JEV_MODE                 = shadow
autonomous media worker  = DISABLED
```

Manual controlled media promotion is completely decoupled from autonomous pipeline execution.

---

## 10. Verification & Test Attestation

1. **Closeout Regression Suite (`scripts/test-lokamedia-alt-text-closeout.js`):** 15/15 closeout cases PASSED (Cases A through O).
   - Test A: Alt text required (empty/whitespace rejected).
   - Test B: Cryptographic signature binds exact alt text into receipt.
   - Test C: Changing alt text after request invalidates state.
   - Test D: Admin approval UI displays proposed alt text.
   - Test E: Final article `image_alt` mirror updated to exact approved alt.
   - Test F: Old `image_alt` cannot leak forward into new promotion.
   - Test G: `actual_published_at` remains immutable.
   - Test H: `published_at` remains immutable.
   - Test I: `content_hash` and editorial body remain immutable.
   - Test J: Exactly-one active featured slot preserved.
   - Test K: Hardened device auth rejects prefix bypass.
   - Test L: Execution dispatch replay rejected (exactly-once).
   - Test M: Local canary regression proof verified.
   - Test N: Article B dry-run verified.
   - Test O: Version alignment at v0.1.18 verified.
2. **All LokaMedia Test Suites:** 15+ suites, 200+ test assertions passing 100%.
3. **TypeScript & Astro Build:**
   - `npx tsc --noEmit` $\rightarrow$ 0 errors.
   - `npm run build` $\rightarrow$ Clean build in 7.37s.
4. **Local Canary Cleanup:** Disposable canary articles, media records, approval requests, and miniflare R2 objects purged cleanly from local storage.

---

## 11. Production Enablement & Live Edge Verification (Version eb46fc2a)

### A. Pre-Deploy Attestation
- **Committed Commit:** `0ab4589` (`feat(lokamedia): add dual-control published media promotion`)
- **Git Branch:** `feat/jev-lokamedia-integration`
- **Scope Verified:** Exactly 11 committed files (migration `0032`, extension UI/constants/manifest/background, admin UI, backend endpoints, test suite). Zero untracked scratch/bootstrap files committed.

### B. Cloudflare D1 Remote Database Migrations
Applied directly to remote production D1 `rancangloka_db` (`3a86e9ad-410f-4440-884e-2eb813ec4cf7`):
1. `migrations/0031_media_promotion_approvals.sql`: Created `media_promotion_approvals` table with dual-control status constraints (`REQUESTED`, `APPROVED`, `REJECTED`, `CONSUMED`, `EXPIRED`).
2. `migrations/0032_media_promotion_alt_text.sql`: Added `alt_text TEXT` column for cryptographic alt text binding.
- **Verification:** Schema query confirmed 22 columns including `alt_text`. Remote table row count = 0 (clean baseline).

### C. Cloudflare Workers Production Deployment
- **Account ID:** `a8e6d11d45dc2d14fe49fe3b84958ee8`
- **Worker Target:** `rancangloka`
- **Version ID:** `eb46fc2a-c5bc-4705-ab85-285f0802dc66`
- **Edge Performance:** 13ms startup latency.
- **Active Cron Triggers:** 4 (`0 1 * * *`, `0 2 * * *`, `0 5 * * *`, `0 10 * * *`).

### D. Live Edge Smoke & Security Attestation
1. **Admin Promotion Interface:** `GET /admin/media-promotions` $\rightarrow$ HTTP 302 Redirect to `/admin/login` (Auth gate operational; zero Worker 1101 crashes).
2. **Unauthenticated API Gate:**
   - `GET /api/internal/v1/media/articles/resolve?slug=...` $\rightarrow$ HTTP 401 `AUTHENTICATION_REQUIRED`.
   - `POST /api/internal/v1/media/promotions/request` $\rightarrow$ HTTP 401 `AUTHENTICATION_REQUIRED`.
3. **Negative Security Proof (`DEVICE_AUTH_PREFIX_BYPASS` Elimination):**
   - Probe with fake prefix token (`Authorization: Bearer lkmd_randomfake12345`) $\rightarrow$ HTTP 401 `AUTHENTICATION_REQUIRED`.
   - Proves live elimination of prefix fallthrough on the production edge; zero unhashed bypasses permitted.

### E. Production Entity Baseline Preservation
- **Article A (`jendela-berkondensasi-...`, ID 7):**
  - Cover: `/media/images/b5cd50198632fecc2810b756554ce8ffe6df3129f5d828447064beee41845af4.webp`
  - Alt: `Kondensasi pada permukaan kaca jendela rumah dengan kusen aluminium`
  - Content Hash: `00dc804d7f3bd9f54772988c00709e1ff01b80ff303d42760bc4ac91df6c8298`
  - Original Publication Receipt: `actual_published_at = '2026-10-07 01:24:49'` (Untouched).
- **Article B (`thermal-bridge-kusen-...`, ID 8):**
  - Cover: `/media/images/631baf7a25e9986b9f0d01073633cb434ae162b3df1241ddac56b977026276e9.webp`
  - Alt: `Detail penampang kusen jendela aluminium pada fasad arsitektur modern`
  - Content Hash: `66094cf52d2d10650b82141adace0cedc27fc9a3f63ae1f85e19a57c38d4e260`
  - Original Publication Receipt: `actual_published_at = '2026-10-07 01:28:26'` (Untouched).
- **Media Devices:** `lokamedia-prod-operator-01` (`ACTIVE`), `media-a57-p3a-probe-20260930` (`REVOKED`).
- **Target Derivative:** `artifacts/article-b-cover-1315x660.webp` (149,764 bytes, SHA `8ecd77ff40bb4d933e27e44980bcec9ebb040e0cb971de72e5387ff6b463247d`) ready for controlled human execution.
- **Production Safety:** Zero direct SQL mutation, zero premature Article B promotion.

### F. Human Operator Handshake & Execution Lifecycle
1. Unpacked Chrome Extension reloaded at `v0.1.18 CURRENT` on production domain `https://rancangloka.com`.
2. Replacement production operator device `lokamedia-prod-operator-02` provisioned with secure standard input clipboard delivery.
3. Dual-control promotion lifecycle completed end-to-end on real published Article B.

---

## 12. Article B Production Promotion Provenance & Final Attestation

### A. Dual-Control Promotion Request & Lifecycle
- **Approval Request ID:** `prom_req_mv4rw7jk_83635f64e45283fb`
- **Requesting Device:** `lokamedia-prod-operator-02` (`ACTIVE`)
- **Status Lifecycle:** `REQUESTED` (`2026-10-12T04:49:39.632Z`) $\rightarrow$ `APPROVED` (`2026-10-12T04:59:56.257Z` by `admin_operator`) $\rightarrow$ `CONSUMED` (`2026-10-12 05:01:01` via upload `upl_standalone_8ecd77ff40bb4d93`).
- **Cryptographic Binding Invariants:**
  - Target Article ID: `8` | Slug: `thermal-bridge-kusen-aluminium-penyebab-panas-dingin-solusi`
  - Content Hash: `66094cf52d2d10650b82141adace0cedc27fc9a3f63ae1f85e19a57c38d4e260`
  - Candidate SHA-256: `8ecd77ff40bb4d933e27e44980bcec9ebb040e0cb971de72e5387ff6b463247d`
  - Slot Key: `featured`
  - Dimensions: `1315 × 660` | MIME: `image/webp` | Byte Size: `149764` bytes
  - Alt Text: `Detail sambungan kusen aluminium, kaca, dan dinding pada jendela rumah`

### B. Object Storage & Database Media Parity
- **Cloudflare R2:** Stored at `media/images/8ecd77ff40bb4d933e27e44980bcec9ebb040e0cb971de72e5387ff6b463247d.webp` (149,764 bytes, `HTTP 200 OK`). Exactly 1 object (zero duplicate content-addressed blobs).
- **Cloudflare D1 `media_assets`:** Asset `ast_8e3c7059293ada90787ac4ab` (`VALIDATED`, 149,764 bytes, 1315×660, WebP).
- **Cloudflare D1 `article_media`:**
  - Historical featured relation (`id = 14`, `ast_mfUpgVe99C_bq_p2d_O4Ge4L`): Deactivated (`is_active = 0`).
  - New featured relation (`id = 16`, `ast_8e3c7059293ada90787ac4ab`): Activated (`is_active = 1`).
  - Active Featured Slot Invariant: Exactly 1 active relation.
- **Authoritative Mirror (`articles`):**
  - `featured_image`: `/media/images/8ecd77ff40bb4d933e27e44980bcec9ebb040e0cb971de72e5387ff6b463247d.webp`
  - `image_alt`: `Detail sambungan kusen aluminium, kaca, dan dinding pada jendela rumah`
  - `updated_at`: `2026-10-12 05:01:04`

### C. Publication Immutability Guaranteed
- `content_hash`: `66094cf52d2d10650b82141adace0cedc27fc9a3f63ae1f85e19a57c38d4e260` (100% UNCHANGED).
- `content_md`: 8,706 bytes | `content_html`: 9,094 bytes (100% UNCHANGED).
- `status`: `published` (100% UNCHANGED).
- `published_at`: `2026-10-07 01:28:26` (100% UNCHANGED).
- `actual_published_at`: `2026-10-07 01:28:26` (in `article_publication_executions`, execution ID `pexec_artB_f2d4f24e01e0`) (100% UNCHANGED).
- Execution & Receipt Counts: Exactly 1 (zero republishing events, zero duplicate publication receipts).

### D. Live Edge Rendering Verification
- `GET https://rancangloka.com/media/images/8ecd77ff...webp` $\rightarrow$ `HTTP 200 OK` (149,764 bytes).
- `GET https://rancangloka.com/thermal-bridge-kusen-aluminium-penyebab-panas-dingin-solusi` $\rightarrow$ `HTTP 200 OK`.
- SSR HTML confirmed rendering the new cover image and alt text cleanly.

### E. Baseline Preservation
- **Article A (`jendela-berkondensasi-...`, ID 7):** Cover `/media/images/b5cd5019...webp`, alt `"Kondensasi pada permukaan kaca jendela rumah dengan kusen aluminium"`, `actual_published_at = '2026-10-07 01:24:49'`, content hash `00dc804d...` 100% untouched.
- **Media Devices:** `lokamedia-prod-operator-02` (`ACTIVE`), `lokamedia-prod-operator-01` (`ACTIVE`), `media-a57-p3a-probe-20260930` (`REVOKED`).
