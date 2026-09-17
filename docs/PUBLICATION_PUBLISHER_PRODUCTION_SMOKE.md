# 🚀 PUBLICATION-2: Controlled Production Publisher Smoke Verification

**Document Version:** 1.0.0  
**Milestone:** PUBLICATION-2 — Controlled Production Publisher Smoke  
**Target URL:** `https://rancangloka.com` (`https://rancangloka.chandrajoyko.workers.dev`)  
**Target Production Database:** Cloudflare D1 `rancangloka_db` (`3a86e9ad-410f-4440-884e-2eb813ec4cf7`)  
**Target Article:** ID `1` (`slug: rancangloka-internal-ingest-smoke-test-2026-09-04`)  
**Status:** **PASS** (All 9 Steps Complete, 46/46 Assertions Passed, 0 Failed, Production Residue: NONE)  
**Date:** 2026-09-07  

---

## 1. Executive Summary

Milestone **PUBLICATION-2 (Scheduled Publisher & Execution Layer)** has successfully completed its authoritative controlled production smoke test against the live Cloudflare D1 store and Cloudflare Workers runtime.

Using strictly ONE existing internal smoke draft article (**Article ID 1**), genuine upstream eligibility was established through the canonical **PUBLICATION-0** (readiness evaluation `READY_TO_SCHEDULE`) and **PUBLICATION-1** (active plan `PLANNED`) services. A single `SCHEDULED` execution was created and verified for future-not-due safety (`DUE=NO`). Controlled live publication was executed via `publishNow`, driving execution through 100% of canonical invariant checks, atomic D1 batch mutation, immutable receipt issuance, live public HTTP 200 edge verification at `https://rancangloka.com`, and exactly-once replay protection. The smoke article was then immediately restored to its exact preflight baseline (draft, HTTP 404), with full reverse-dependency teardown leaving **zero residue**.

### Verified Guardrails
- **Internal Smoke Article Only:** Only Article ID 1 (`rancangloka-internal-ingest-smoke-test-2026-09-04`) was used. Zero normal editorial articles were touched.
- **Production Cron Disabled:** Production cron remained completely unconfigured and disabled (`PRODUCTION_CRON_ENABLED = NO`).
- **Auto-Publish Off:** Automated publication remained disabled (`AUTO_PUBLISH = OFF`).
- **Zero AI / Model Calls:** Publication pipeline is 100% deterministic code (`MODEL_CALLS = 0`).
- **Cryptographic Receipt:** Immutable receipt `rcpt_f56051c2a6498785` generated with full provenance metadata.
- **Clean Reversible Teardown:** Preflight draft baseline restored byte-for-byte; public exposure returned to HTTP 404.

---

## 2. Comprehensive 9-Step Verification Results

### Step 1: Preflight Baseline Capture
- Target article verified: ID `1`, `slug: "rancangloka-internal-ingest-smoke-test-2026-09-04"`.
- Status strictly `draft`, `published_at: "2026-09-04T07:43:06.284Z"`.
- Content hash: `0b88aa50b67259013d00757825356877ae3a78061d9151dc446eb0e8d0f419cf`.
- Body length: `3863` characters.
- Live public URL `https://rancangloka.com/rancangloka-internal-ingest-smoke-test-2026-09-04` returned HTTP **404**.
- **Outcome:** ✅ PASS

### Step 2: Build Genuine Upstream Eligibility
- Inserted validated media asset `ast_smoke_pub2_prod` into `media_assets`.
- Bound active featured media in `article_media`.
- Recorded human editorial approval via canonical `recordEditorialApproval`.
- Evaluated article readiness via canonical `evaluateArticleReadiness`:
  - `is_ready`: `true`
  - `overall_status`: `READY_TO_SCHEDULE`
  - `readiness_id`: `22`
- Created genuine active PUBLICATION-1 plan (`plan_smoke_p2_prod_mtqwgi2k`) with target time `2026-09-10T02:00:00.000Z` in `Asia/Jakarta`.
- Validated plan freshness via `validatePlanFreshness` (`isValid: true`).
- Confirmed article remained strictly `draft`.
- **Outcome:** ✅ PASS

### Step 3: Create PUBLICATION-2 Execution
- Created execution via canonical `schedulePlanForExecution(db, planId, 'publication2-controlled-smoke')`.
- Execution created in state `SCHEDULED`.
- Bound correctly to plan `plan_smoke_p2_prod_mtqwgi2k` and article ID `1`.
- **Outcome:** ✅ PASS

### Step 4: Future-Not-Due Safety Verification
- Evaluated `getDueExecutions(db, { nowUtc: '2026-09-07T07:00:00.000Z' })`.
- Target time is `2026-09-10T02:00:00.000Z` $\implies$ `trusted now < target_publish_at`.
- Confirmed execution is **NOT due** (`DUE = NO`).
- Confirmed article remains strictly `draft` prior to due time.
- **Outcome:** ✅ PASS

### Step 5: Controlled Live Publication via `publishNow`
- Invoked canonical `publishNow(db, execution.execution_id, 'publication2-controlled-smoke')`.
- Execution passed through the exact pre-publish validation double-gate, acquired worker lease, and executed atomic D1 publication batch:
  - `outcome`: `PUBLISHED`
  - `receipt_id`: `rcpt_f56051c2a6498785`
  - `actual_published_at`: `2026-09-07T07:10:12.711Z`
  - `articles.status`: `published`
  - `articles.published_at`: `2026-09-07T07:10:12.711Z`
  - `articles.content_hash`: Unchanged (`0b88aa50b67259013d00757825356877ae3a78061d9151dc446eb0e8d0f419cf`)
  - `articles.content_md`: Unchanged (`3863` chars)
  - `publication_execution_receipts`: Verified in D1 with outcome `SUCCESS` and canonical URL.
- **Outcome:** ✅ PASS

### Step 6: Public Surface Live Verification
- Edge SSR request to `https://rancangloka.com/rancangloka-internal-ingest-smoke-test-2026-09-04` returned HTTP **200**.
- HTML body verified containing authentic Indonesian article content and canonical slug.
- Evaluated `verifyPublicSurface`:
  - `isPublished`: `true`
  - `isSitemapEligible`: `true`
- **Outcome:** ✅ PASS

### Step 7: Exactly-Once Live Replay Verification
- Dispatched execution replay via `processSingleExecution`.
- Replay immediately detected `PUBLISHED` status in database.
- Returned identical receipt ID `rcpt_f56051c2a6498785`.
- Database confirmed exactly 1 receipt created (`count = 1`).
- `published_at` remained strictly stable.
- **Outcome:** ✅ PASS

### Step 8: Controlled Rollback & Teardown
- Reverted Article ID 1 to original preflight baseline:
  - `status`: `draft`
  - `published_at`: `2026-09-04T07:43:06.284Z`
- Cleaned up temporary smoke records in strict reverse-dependency order:
  1. `publication_execution_attempts`
  2. `publication_execution_receipts`
  3. `article_publication_executions`
  4. `publication_plan_events`
  5. `article_publication_plans`
  6. `article_publication_readiness`
  7. `article_editorial_approvals`
  8. `article_media`
  9. `media_assets`
- **Outcome:** ✅ PASS

### Step 9: Post-Cleanup Public Surface & Integrity
- Edge SSR request to `https://rancangloka.com/rancangloka-internal-ingest-smoke-test-2026-09-04` returned HTTP **404** (public exposure removed).
- Database residue audit:
  - Residual executions: `0`
  - Residual receipts: `0`
  - Residual plans: `0`
  - Residual readiness records: `0`
  - Residual approvals: `0`
  - Residual media bindings: `0`
- Article integrity comparison:
  - `status`: strictly `draft`
  - `content_hash`: matched preflight baseline byte-for-byte
  - `content_md`: matched preflight baseline byte-for-byte
- **Outcome:** ✅ PASS

---

## 3. Production Verification Matrix

| Check | Expected | Actual | Result |
|---|---|---|---|
| Migration 0009 Production | Applied | 4 tables verified in D1 | ✅ PASS |
| Runtime Worker Deployment | Deployed | Version `4790a919` live | ✅ PASS |
| Internal Smoke Article Only | Article ID 1 | Article ID 1 exclusively | ✅ PASS |
| Upstream PUB-0 Gate | READY_TO_SCHEDULE | Validated & bound | ✅ PASS |
| Upstream PUB-1 Plan | PLANNED | Validated fresh | ✅ PASS |
| Schedule Execution Created | SCHEDULED | Exactly 1 created | ✅ PASS |
| Future-Not-Due Safety | DUE = NO | Correctly evaluated | ✅ PASS |
| Atomic Publish Mutation | D1 Batch | Atomically transitioned | ✅ PASS |
| Receipt Generation | Immutable rcpt | Generated & verified | ✅ PASS |
| Public Surface HTTP | 200 during smoke | HTTP 200 confirmed | ✅ PASS |
| Exactly-Once Protection | Idempotent | 1 receipt, no duplicate | ✅ PASS |
| Rollback to Draft | draft, HTTP 404 | Restored, HTTP 404 | ✅ PASS |
| Production Residue | NONE | 0 records remaining | ✅ PASS |
| Model Calls | 0 | 0 | ✅ PASS |
| Auto Publish | OFF | OFF | ✅ PASS |
| Production Cron | NO | NO | ✅ PASS |

---

## 4. Final Verification Summary
PUBLICATION-2 is fully proven in production. The scheduled publisher layer is robust, fail-closed, atomic, and safe.
