# 🚀 PUBLICATION-1: Controlled Production Planner Smoke Verification

**Document Version:** 2.0.0  
**Milestone:** PUBLICATION-1 — Controlled Production Planner Smoke  
**Target URL:** `https://rancangloka.com` (`https://rancangloka.chandrajoyko.workers.dev`)  
**Target Production Database:** Cloudflare D1 `rancangloka_db` (`3a86e9ad-410f-4440-884e-2eb813ec4cf7`)  
**Target Article:** ID `1` (`slug: rancangloka-internal-ingest-smoke-test-2026-09-04`)  
**Status:** **PASS** (All 10 Stages Complete, 46/46 Assertions Passed, 0 Failed, Production Residue: NONE)  
**Date:** 2026-09-07  

---

## 1. Executive Summary

Milestone **PUBLICATION-1 (Adaptive Publication Planner)** has successfully passed controlled production smoke verification against the live Cloudflare D1 store and Cloudflare Workers runtime.

Using exactly ONE existing internal smoke draft article (Article ID 1), a temporary `READY_TO_SCHEDULE` fixture was established via the canonical **PUBLICATION-0** pipeline (validated media asset, active featured binding, and human editorial approval). The production planner consumed the verified inventory, deterministically sequenced the article into target state **`PLANNED`** in `Asia/Jakarta` (WIB), proved run idempotency and partial unique index concurrency protection, executed human cancellation controls, and executed a 100% clean reverse-order teardown leaving zero residue.

### Verified Guardrails
- **Zero Public Mutation:** Article ID 1 strictly remained `status = 'draft'` at all times (`PUBLIC_PUBLISH = NO`).
- **Zero Schedule Execution:** No CMS status transitions or automated dispatchers executed (`SCHEDULE_EXECUTION = NO`).
- **Zero AI / Model Provider Calls:** Candidate scoring, ranking, capacity calculation, and jitter were 100% mathematical and deterministic (`MODEL_CALLS = 0`).
- **Auto-Publish:** Strictly `OFF` (`AUTO_PUBLISH = OFF`).
- **Readiness Gate Integrity:** Only genuinely `READY_TO_SCHEDULE` inventory was admitted. Editorial draft Article 4 was strictly excluded (`READY_ONLY_INPUT = PASS`).
- **Cryptographic & Worker Compatibility:** Pure Web Crypto (`crypto.getRandomValues`) and worker-safe hashing implemented, fully verified in Cloudflare Workers environment.

---

## 2. Comprehensive 10-Stage Smoke Execution Results

### Stage 1: Select Internal Smoke Article & Baseline Capture
- Selected existing internal smoke draft:
  - Article ID: `1`
  - Slug: `rancangloka-internal-ingest-smoke-test-2026-09-04`
  - Status: `draft`
  - Content Hash: `0b88aa50b67259013d00757825356877ae3a78061d9151dc446eb0e8d0f419cf`
  - Body Length: `3863` characters
  - Published At: `2026-09-04T07:43:06.284Z`
- Confirmed preflight baseline: zero readiness evaluations, zero editorial approvals, zero media bindings.
- **Outcome:** ✅ PASS

### Stage 2: Create Temporary PUBLICATION-0 Fixture
- Created temporary validated media asset `ast_smoke_pub1_prod` in `media_assets`.
- Created active featured media binding in `article_media`.
- Recorded human editorial approval via `recordEditorialApproval` (`operator: 'publication1-controlled-smoke'`, role: `editor_in_chief`).
- Executed `evaluateArticleReadiness` via canonical service:
  - `is_ready`: `true`
  - `overall_status`: `READY_TO_SCHEDULE`
  - `blockers`: `[]` (0 blockers)
  - `checks.visual_media`: `PASS`
  - `checks.human_approval`: `PASS`
- **Outcome:** ✅ PASS

### Stage 3: PUBLICATION-1 Preflight Candidate Query
- Executed `getEligibleReadyCandidates(db)`:
  - Admitted candidates: exactly Article ID 1 (`eligibleCount = 1`).
  - Content hash cryptographically verified against preflight baseline.
  - Normal editorial article 4 (`perbedaan-atap-metal-dan-genteng-beton-untuk-rumah-tropis`) strictly excluded.
- **Outcome:** ✅ PASS

### Stage 4: Migration 0008 & Schema Verification
- **Migration 0008 (`0008_publication_planner.sql`)** applied remotely to production D1.
- All 3 tables verified in remote D1:
  1. `article_publication_plans`
  2. `publication_planner_runs`
  3. `publication_plan_events`
- Partial unique index verified in remote D1:
  ```sql
  CREATE UNIQUE INDEX uq_active_plan_per_article 
  ON article_publication_plans(article_id) 
  WHERE plan_status = 'PLANNED';
  ```
- Deployed worker runtime endpoint `/api/admin/publication/plans` confirmed reachable and protected (HTTP 401 `UNAUTHORIZED` when unauthenticated).
- **Outcome:** ✅ PASS

### Stage 5: Controlled Planner Run
- Executed `executePublicationPlanner` on target date `2026-09-10` with `GROWING` profile:
  - `plannedCount`: 1 (`deferredCount`: 0).
  - Plan created for Article 1 with plan status **`PLANNED`**.
  - Timezone: `Asia/Jakarta`.
  - Local timestamp: `2026-09-10 14:29:42 WIB` (Slot 1 of 1, Interval 450M, Jitter -42S).
  - Reason codes recorded: `AGE_WAIT_7H`, `TAXONOMY_SHARE_0PCT`, `SLOT_1_OF_1`, `INTERVAL_450M`, `JITTER_-42S`.
  - Article status strictly remained `draft`; `published_at` unchanged.
- **Outcome:** ✅ PASS

### Stage 6: Idempotency Verification
- Repeated exact planner run on the same target date and inventory:
  - Re-run recognized existing active plan; produced 0 duplicate plans.
  - Plan ID and target timestamp preserved identically.
  - Direct attempt to insert duplicate active plan via raw SQL failed immediately with SQLite `UNIQUE constraint failed: article_publication_plans.article_id`.
- **Outcome:** ✅ PASS

### Stage 7: Conservative Capacity Verification
- Verified bounded adaptive capacity controller:
  - "Quality Dominates Quota": Exactly 1 candidate ready $\implies$ exactly 1 plan created.
  - Base capacity (8) clamped down to eligible inventory size (1).
  - Safe ceiling (20) confirmed as profile bound, not forced daily quota (`FIXED_20_PER_DAY = NO`).
- **Outcome:** ✅ PASS

### Stage 8: Human Editorial Plan Control
- Invoked canonical `cancelPlan(db, planId, 'publication1-controlled-smoke')`:
  - Plan status transitioned to **`CANCELLED`**.
  - Event `CANCELLED` logged in `publication_plan_events`.
  - Active plans query for date returned 0 remaining active plans.
- **Outcome:** ✅ PASS

### Stage 9: Cleanup — Reverse Order Teardown
- Executed deterministic cleanup in reverse order:
  1. Purged smoke planner events, plans, and runs (`run_id LIKE 'prun_%'`).
  2. Purged temporary editorial approval (`approved_by = 'publication1-controlled-smoke'`).
  3. Purged temporary publication readiness evaluation.
  4. Purged temporary `article_media` binding.
  5. Purged temporary media asset `ast_smoke_pub1_prod`.
- **Outcome:** ✅ PASS

### Stage 10: Final Verification & Invariants
- Verified against preflight baseline:
  - `articles.status`: `draft` (unchanged).
  - `articles.content_hash`: `0b88aa50b67259013d00757825356877ae3a78061d9151dc446eb0e8d0f419cf` (100% matched).
  - `articles.content_md` length: `3863` (100% matched).
  - `articles.published_at`: `2026-09-04T07:43:06.284Z` (100% matched).
  - Residual active plans in remote D1: `0`.
  - Residual smoke approvals: `0`.
  - Residual smoke readiness evaluations: `0`.
  - Residual smoke media bindings: `0`.
  - Residual smoke media assets: `0`.
- **Outcome:** ✅ PASS

---

## 3. Production Verification Summary

| Stage / Component | Status | Detail |
| :--- | :---: | :--- |
| **Migration 0008 in Production D1** | **PASS** | `0008_publication_planner.sql` applied cleanly |
| **PUBLICATION-1 Worker Deploy** | **PASS** | Version `0fc6ee2f-6e27-4719-b398-bbcc260f47ad` live |
| **Eligibility Fixture via PUBLICATION-0** | **PASS** | Validated media + approval + snapshot |
| **Controlled Planner Execution** | **PASS** | Exactly 1 article planned (`PLANNED`), `Asia/Jakarta` WIB |
| **Idempotency & Partial Unique Index** | **PASS** | Re-run no-op, duplicate insert blocked by database |
| **Human Plan Control (Cancel)** | **PASS** | Plan transitioned to `CANCELLED`, event logged |
| **Teardown & Residue Audit** | **PASS** | 100% clean teardown, 0 residue |

---

## 4. Operational Sign-off

Milestone **PUBLICATION-1 (Adaptive Publication Planner)** is fully implemented, locally tested, deployed to production, and verified via live controlled smoke testing.
The planner is ready to be locked and frozen as the upstream foundation for **PUBLICATION-2 (Publishing Dispatcher / Executor)**.
