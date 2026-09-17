# 🧪 PUBLICATION-2: Local End-to-End Scheduled Publisher Smoke Verification

**Document Version:** 1.0.0  
**Status:** VERIFIED & PASS  
**Milestone:** PUBLICATION-2 — Scheduled Publisher Local End-to-End Smoke  
**Date:** 2026-09-07  
**Target Environment:** Local Cloudflare D1 Store (`.wrangler/state/v3/d1/miniflare-D1DatabaseObject/*.sqlite`)  
**Smoke Assertions:** 70 Passed, 0 Failed  
**Publisher Unit Tests:** 48 Passed, 0 Failed  
**Regression Suites:** PUBLICATION-0 (85 Passed), PUBLICATION-1 (67 Passed)  
**Build Status:** PASS (Astro 4.x SSR bundle built in 7.86s)  
**Production Mutation:** NONE (Local only)  

---

## 1. Executive Summary

Milestone **PUBLICATION-2 (Scheduled Publisher)** has undergone rigorous end-to-end local smoke verification on the real local Cloudflare D1 database. The validation proved that PUBLICATION-2 successfully executes publication tasks from PUBLICATION-1 plans, enforces pre-publish double-gate validation, maintains mutual-exclusion leases, executes atomic D1 batch mutations, persists cryptographic receipts, and handles crash recovery idempotently.

---

## 2. Verified Test Stages & Invariants

### Stage 1: Local Setup & Migration 0009 Application
- Applied `db/migrations/0009_publication_publisher.sql` to local D1 store.
- Verified existence of tables:
  - `article_publication_executions`
  - `publication_execution_receipts`
  - `publication_execution_attempts`
  - `publication_publisher_runs`
- Seeded baseline fixture Article 901 with verified PUBLICATION-0 readiness and active PUBLICATION-1 plan.
- Baseline article confirmed strictly `draft` with `published_at = NULL`.

### Stage 2: Future Execution Protection
- Target publish time set to 2 hours in the future (`2026-09-07T16:00:00.000Z`).
- At current trusted time (`14:00:00.000Z`), `getDueExecutions` returned `DUE = NO`.
- Article remained strictly `draft` with zero publication receipts created.

### Stage 3: Exact Target Time Selection
- At exact target publish time (`16:00:00.000Z`), `getDueExecutions` returned execution 901 as `DUE = YES`.

### Stage 4: Successful Publication & Atomic Mutation
- Canonical flow completed: `SCHEDULED -> CLAIMED -> PUBLISHING -> PUBLISHED`.
- Atomic D1 batch executed atomically:
  - `articles.status` updated to `'published'`.
  - `articles.published_at` set to canonical timestamp.
  - `article_publication_executions.execution_status` updated to `'PUBLISHED'`.
  - Cryptographic receipt persisted in `publication_execution_receipts` with canonical URL `https://rancangloka.com/panduan-arsitektur-minimalis-modern-901`.
- Article body (`content_md`), `content_hash`, featured media binding, approval, category, and author remained 100% byte-for-byte unchanged.

### Stage 5: Public Surface Verification
- `verifyPublicSurface` confirmed article is returned by published queries.
- Canonical URL format verified.
- Article confirmed sitemap-eligible (`isSitemapEligible = true`).
- Zero public surface verification errors.

### Stage 6: Exactly-Once Replay & Idempotency
- Repeated execution invocation on the same task returned `PUBLISHED` idempotently.
- Returned identical receipt ID.
- Database contains strictly 1 receipt; zero duplicate publication records.
- `published_at` timestamp remained immutable.

### Stage 7: Commit-Then-Response-Loss Crash Recovery
- Simulated caller crash where D1 committed successfully but caller retried.
- Subsequent invocation discovered existing committed receipt and returned idempotent completion without re-publishing.

### Stage 8: Concurrency & Lease Recovery
- Worker A acquired 5-minute compare-and-set lease.
- Worker B concurrent claim was safely rejected (`acquired = false`).
- After lease expiration (+6 minutes), Worker B successfully recovered the lease.

### Stage 9: Content Change Protection
- Article content hash altered after plan scheduling.
- Pre-publish gate immediately aborted publication with `CONTENT_HASH_MISMATCH`.
- Article remained `draft`. Associated plan transitioned to `BLOCKED`.

### Stage 10: Media Change Protection
- Featured media asset replaced after plan scheduling.
- Pre-publish gate aborted publication with `FEATURED_MEDIA_MISMATCH`.
- Article remained `draft`.

### Stage 11: Approval Revocation Protection
- Editorial approval revoked (`REJECTED`) after plan scheduling.
- Pre-publish gate aborted publication with `APPROVAL_REVOKED_OR_STALE`.
- Article remained `draft`.

### Stage 12: Plan Invalidation Protection
- Plans in `CANCELLED` and `SUPERSEDED` states were rejected by pre-publish gate (`PLAN_NOT_PLANNED`).
- Zero articles published.

### Stage 13: Article Integrity Validation
- Missing `author_id` and missing `category_id` both failed closed with `MISSING_AUTHOR_OR_CATEGORY`.

### Stage 14: Retryable Failure & Bounded Retries
- Transient failure simulated: execution entered `RETRY_WAIT`, attempts incremented, `next_retry_at` set with backoff.
- Upon reaching max attempts (3), execution transitioned to terminal `FAILED` (`MAX_RETRIES_EXCEEDED`).

### Stage 15: Operator Cancel / Unschedule
- Pending scheduled execution cancelled cleanly (`CANCELLED`).
- Attempt to cancel an already published execution was rejected safely (`CANNOT_CANCEL_PUBLISHED`).

### Stage 16: Manual Publish-Now (Zero Bypass)
- Valid fixture published successfully through canonical pre-publish gate.
- Unready fixture failed with `READINESS_STALE_OR_INVALID`. Proved zero bypass or force-publish capability exists.

### Stage 17: Scheduler Boundary & Telemetry
- Dispatcher ran via trigger source `'cron'`, executed due tasks, and persisted run metrics into `publication_publisher_runs`.
- Verified zero credentials or secrets in telemetry JSON.

### Stage 18: Safety & Mutation Boundaries
- `PRODUCTION_CRON_ENABLED = NO` in `wrangler.toml`.
- `AUTO_PUBLISH = OFF`.
- `MODEL_CALLS = 0` (100% deterministic software logic).

### Stage 19: Teardown & Local Cleanup
- All smoke fixtures (`id >= 900`, `ast_smoke_p2_%`) cleanly purged.
- Confirmed zero residual smoke records in local D1.

---

## 3. Test & Verification Matrix

| Verification Suite | Assertions / Tests | Status |
|---|---|---|
| PUBLICATION-2 Local End-to-End Smoke | 70 Assertions | ✅ PASS |
| PUBLICATION-2 Unit Test Suite | 48 Assertions | ✅ PASS |
| PUBLICATION-1 Adaptive Planner Test Suite | 67 Assertions | ✅ PASS |
| PUBLICATION-0 Readiness Gate Test Suite | 85 Assertions | ✅ PASS |
| Astro Cloudflare SSR Production Build | Complete in 7.86s | ✅ PASS |

**Production Mutation:** NONE. Local/Staging only.
