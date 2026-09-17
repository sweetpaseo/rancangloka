# PUBLICATION-0: Controlled Production Smoke Verification

## Executive Summary

- **Milestone**: PUBLICATION-0 — Publication Readiness Gate Production Verification
- **Target URL**: `https://rancangloka.com` (Cloudflare Workers Version `e80393b5-3b08-4fe2-8fa2-5b97f59b772b`)
- **Target Article**: ID `1` (`slug: rancangloka-internal-ingest-smoke-test-2026-09-04`)
- **Result**: **PASS** across all 9 stages (56/56 assertions passed, 0 failed).
- **Production Residue**: **NONE** (All temporary smoke approvals, readiness snapshots, media bindings, assets, jobs, device enrollments, and R2 objects fully cleaned up; article fields restored to exact preflight baseline).
- **Article Safety**: Strictly remained `draft` throughout; content_hash and Markdown content body untouched; public route returns HTTP 404 at all times.
- **AI/Model Calls**: **0** (`MODEL_CALLS = 0`).
- **Auto-Publish**: **OFF** (`AUTO_PUBLISH = OFF`).

---

## 1. Verified Deployment State

- **Migration 0007 (`0007_publication_readiness.sql`)**:
  - `article_editorial_approvals` table verified in production D1.
  - `article_publication_readiness` table verified in production D1.
  - Recorded in `d1_migrations`.
- **Runtime Deployment**:
  - `/api/admin/publication/readiness/[id]` live on production.
  - Protected by admin middleware guard: unauthenticated request returns HTTP 401 (`UNAUTHORIZED`).
- **Preflight Baseline Verification**:
  - Target Article ID: `1`
  - Slug: `rancangloka-internal-ingest-smoke-test-2026-09-04`
  - Status: `draft`
  - Content Hash: `0b88aa50b67259013d00757825356877ae3a78061d9151dc446eb0e8d0f419cf`
  - Content MD Length: `3863` bytes
  - Category ID: `3` (Arsitektur & Renovasi)
  - Author ID: `3` (RancangLoka Editorial Desk)
  - Preflight `article_media` bindings: `0`
  - Preflight `article_editorial_approvals`: `0`

---

## 2. Initial Readiness Evaluation (As-Is)

- **Execution**: Evaluated draft article 1 as-is with no visual media and no human approval.
- **Result**:
  - `is_ready`: `false`
  - `overall_status`: `NOT_READY`
  - `blockers`: `['FEATURED_MEDIA_MISSING', 'APPROVAL_MISSING']`
  - `checks.article_integrity`: `PASS`
  - `checks.editorial_guards`: `PASS`
  - `checks.evidence_and_citations`: `PASS`
  - `checks.visual_media`: `FAIL`
  - `checks.human_approval`: `FAIL`

---

## 3. Media Readiness via Proven LokaMedia Path

- **Execution**:
  - Device enrolled temporarily in `media_devices`: `dev_prod_smoke_pub0` (`scope: 'media:device'`).
  - Job initialized in `media_jobs`: `mjob_prod_smoke_pub0_art1_featured` (`status: 'PENDING'`).
  - Transitioned via `PATCH /api/internal/v1/media/jobs/:id` to `IN_PROGRESS` (HTTP 200).
  - Uploaded deterministic smoke image (1200x675 WebP, 0 AI calls) via `POST /api/internal/v1/media/upload` (HTTP 200).
  - Upload response: asset ID `ast_uWs0UCTnzFbHssziQPpCDtc3`, storage key `media/images/e65c333f60867f40e777fb13b14929cee478dc44d8b86ae6143b3acfff9d6857.webp`.
- **Database Verification**:
  - `media_assets` record confirmed: `status = VALIDATED`, `media_type = image`, `alt_text` non-empty.
  - `article_media` binding confirmed: exactly 1 active featured binding pointing to uploaded asset.
- **Readiness Re-Evaluation**:
  - `checks.visual_media`: `PASS`
  - `FEATURED_MEDIA_MISSING` blocker cleared.
  - `is_ready`: `false` (blocker: `APPROVAL_MISSING`).

---

## 4. Human Editorial Approval Verification

- **Execution**:
  - Created approval via `recordEditorialApproval` with operator `publication0-controlled-smoke`, role `editor_in_chief`.
  - Bound to exact `content_hash: 0b88aa50b67259013d00757825356877ae3a78061d9151dc446eb0e8d0f419cf` and `asset_id: ast_uWs0UCTnzFbHssziQPpCDtc3`.
- **Readiness Verification**:
  - `is_ready`: `true`
  - `overall_status`: `READY_TO_SCHEDULE`
  - `blockers`: `[]` (zero blockers remaining)
  - `checks.human_approval`: `PASS`
  - `getArticlesReadyToSchedule`: confirms article 1 is included in the downstream scheduler query list.
- **Safety Invariants**:
  - `articles.status`: strictly `draft`
  - `published_at`: null / unchanged
  - Public route `https://rancangloka.com/rancangloka-internal-ingest-smoke-test-2026-09-04`: HTTP 404

---

## 5. Idempotency Verification

- **Execution**: Re-evaluated readiness without changing any state.
- **Result**:
  - `is_ready`: `true`
  - `overall_status`: `READY_TO_SCHEDULE`
  - `blockers`: `[]`
  - `article_editorial_approvals` count: `1` (no duplicate approvals created)
  - `article_media` active featured bindings count: `1` (no duplicate bindings)
  - `content_hash`: strictly untouched

---

## 6. Media Invalidation Rule Verification

- **Execution**:
  - Created second temporary validated smoke asset: `ast_prod_smoke_pub0_swap2` (`source_type: 'manual_upload'`).
  - Switched active featured binding to `ast_prod_smoke_pub0_swap2`.
  - Re-evaluated readiness.
- **Result**:
  - `is_ready`: `false`
  - `overall_status`: `NOT_READY`
  - `blockers`: `['APPROVAL_STALE', 'APPROVAL_STALE_MEDIA', 'MEDIA_CHANGED_AFTER_APPROVAL']`
  - Proves approval invalidation when active featured media identity diverges from the approved media asset ID.
- **Restoration**:
  - Restored active featured binding to `ast_uWs0UCTnzFbHssziQPpCDtc3`.
  - Re-evaluated readiness: `is_ready` restored to `true`, `overall_status` restored to `READY_TO_SCHEDULE`.

---

## 7. Revoke Approval Verification

- **Execution**:
  - Revoked editorial approval via `revokeEditorialApproval`.
  - Operator: `publication0-controlled-smoke`.
- **Result**:
  - `revoked`: `true`
  - `is_ready`: `false`
  - `overall_status`: `NOT_READY`
  - `blockers`: `['APPROVAL_STATUS_REVOKED']`
  - `getArticlesReadyToSchedule`: confirms article 1 is immediately excluded from the scheduler query list.
  - No scheduling jobs created; no public publishing triggered.

---

## 8. Cleanup of Smoke Artifacts

- **Approvals**: Removed temporary approvals from `article_editorial_approvals` for article 1.
- **Readiness Snapshots**: Removed temporary snapshots from `article_publication_readiness` for article 1.
- **Article Media**: Removed temporary bindings from `article_media` for article 1.
- **Media Assets**: Deleted `ast_uWs0UCTnzFbHssziQPpCDtc3` and `ast_prod_smoke_pub0_swap2` from `media_assets`.
- **Media Jobs**: Deleted `mjob_prod_smoke_pub0_art1_featured` from `media_jobs`.
- **Media Devices**: Deleted `dev_prod_smoke_pub0` from `media_devices`.
- **R2 Storage**: Deleted `media/images/e65c333f60867f40e777fb13b14929cee478dc44d8b86ae6143b3acfff9d6857.webp` from `rancangloka-media` bucket.
- **Article Fields**: Restored `featured_image` and `image_alt` to exact preflight baseline.

---

## 9. Final Verification

- `articles.status`: `draft`
- `articles.content_hash`: `0b88aa50b67259013d00757825356877ae3a78061d9151dc446eb0e8d0f419cf` (unchanged)
- `articles.content_md` length: `3863` bytes (unchanged)
- `articles.published_at`: null / unchanged
- `articles.featured_image`: restored to baseline
- `articles.image_alt`: restored to baseline
- Lingering approvals: `0`
- Lingering readiness records: `0`
- Lingering article_media bindings: `0`
- Lingering smoke media assets: `0`
- Lingering smoke devices: `0`
- Public route HTTP status: `404` (`PUBLIC_PUBLISH = NO`)
- Scheduler permission: `NO`
- Model calls: `0`
- Auto publish: `OFF`
