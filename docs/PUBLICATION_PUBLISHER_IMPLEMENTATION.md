# 🚀 PUBLICATION-2: Scheduled Publisher Implementation & System Documentation

**Document Version:** 1.0.0  
**Status:** IMPLEMENTED & LOCALLY VALIDATED  
**Milestone:** PUBLICATION-2 — Scheduled Publisher Implementation  
**Date:** 2026-09-07  
**Build Status:** PASS (Astro 4.x Cloudflare SSR)  
**Test Suite:** 48/48 Passing Assertions  

---

## 1. Architectural Baseline & Overview

Milestone **PUBLICATION-2 (Scheduled Publisher)** implements the authoritative, fail-closed publication execution engine for RancangLoka. It bridges temporal publication plans in status **`PLANNED`** (from **PUBLICATION-1**) to active, publicly rendered editorial content in status **`published`**.

$$\mathbf{READY\_TO\_SCHEDULE}\;(\text{PUB-0}) \xrightarrow{\text{Plan}} \mathbf{PLANNED}\;(\text{PUB-1}) \xrightarrow{\text{Schedule}} \mathbf{SCHEDULED} \xrightarrow{\text{Due}} \mathbf{CLAIMED} \xrightarrow[\text{Pre-publish Gate}]{\text{Revalidate}} \mathbf{PUBLISHED}\;(\text{PUB-2})$$

### Core Guarantees Verified:
1. **Sole Publication Execution Authority:** PUBLICATION-2 is the only subsystem allowed to mutate `articles.status` to `'published'` and set `published_at`.
2. **Fail-Closed Double-Gate:** Immediately prior to mutation, 100% of upstream invariants (PUBLICATION-0 readiness, human approval, featured media binding, PUBLICATION-1 plan status, and article metadata integrity) are revalidated. Any mismatch aborts publication.
3. **Atomic State Transition:** The transition of `articles.status` from `'draft'` to `'published'`, the transition of `article_publication_executions` to `'PUBLISHED'`, and the insertion of immutable cryptographic publication receipts occur in a single atomic D1 batch transaction.
4. **Exactly-Once Semantics:** Multi-worker concurrency lease acquisition via atomic compare-and-set, database uniqueness constraints, and post-commit crash reconciliation prevent duplicate publication.
5. **Zero Model Provider Calls:** Candidate scheduling, leasing, revalidation, and publishing execute with `MODEL_CALLS = 0`.
6. **Zero Article Body Mutation:** The publisher has zero write permissions to article markdown, HTML, or content hash.
7. **Production Cron Disabled:** `PRODUCTION_CRON_ENABLED = NO` and `AUTO_PUBLISH = OFF`.

---

## 2. Database Schema (Migration `0009_publication_publisher.sql`)

Migration `0009_publication_publisher.sql` provides dedicated tables to manage execution state, lease concurrency, and audit receipts without mutating upstream tables:

```sql
-- 1. Table: article_publication_executions
CREATE TABLE IF NOT EXISTS article_publication_executions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    execution_id TEXT NOT NULL UNIQUE,
    plan_id TEXT NOT NULL UNIQUE,
    article_id INTEGER NOT NULL REFERENCES articles(id) ON DELETE CASCADE,
    content_hash TEXT NOT NULL,
    featured_asset_id TEXT NOT NULL,
    target_publish_at DATETIME NOT NULL,
    execution_status TEXT NOT NULL DEFAULT 'SCHEDULED',
    claimed_by_worker TEXT,
    lease_expires_at DATETIME,
    attempts_count INTEGER NOT NULL DEFAULT 0,
    max_attempts INTEGER NOT NULL DEFAULT 3,
    next_retry_at DATETIME,
    last_error_class TEXT,
    last_error_reason TEXT,
    publisher_version TEXT NOT NULL DEFAULT '1.0.0',
    actual_published_at DATETIME,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (plan_id) REFERENCES article_publication_plans(plan_id) ON DELETE CASCADE,
    CHECK (execution_status IN ('SCHEDULED', 'CLAIMED', 'PUBLISHING', 'PUBLISHED', 'RETRY_WAIT', 'FAILED', 'CANCELLED', 'BLOCKED'))
);

CREATE INDEX IF NOT EXISTS idx_pub_executions_due 
ON article_publication_executions(execution_status, target_publish_at)
WHERE execution_status IN ('SCHEDULED', 'RETRY_WAIT');

CREATE UNIQUE INDEX IF NOT EXISTS uq_active_execution_per_article 
ON article_publication_executions(article_id) 
WHERE execution_status IN ('SCHEDULED', 'CLAIMED', 'PUBLISHING', 'RETRY_WAIT');

-- 2. Table: publication_execution_receipts
CREATE TABLE IF NOT EXISTS publication_execution_receipts (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    receipt_id TEXT NOT NULL UNIQUE,
    execution_id TEXT NOT NULL UNIQUE REFERENCES article_publication_executions(execution_id) ON DELETE CASCADE,
    plan_id TEXT NOT NULL,
    article_id INTEGER NOT NULL REFERENCES articles(id) ON DELETE CASCADE,
    slug TEXT NOT NULL,
    content_hash TEXT NOT NULL,
    featured_asset_id TEXT NOT NULL,
    canonical_url TEXT NOT NULL,
    target_publish_at DATETIME NOT NULL,
    actual_published_at DATETIME NOT NULL,
    publisher_version TEXT NOT NULL DEFAULT '1.0.0',
    planner_version TEXT NOT NULL DEFAULT '1.0.0',
    attempts_count INTEGER NOT NULL DEFAULT 1,
    outcome TEXT NOT NULL DEFAULT 'SUCCESS',
    details_json TEXT NOT NULL DEFAULT '{}',
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CHECK (outcome IN ('SUCCESS', 'FAILED', 'ABORTED'))
);

-- 3. Table: publication_execution_attempts
CREATE TABLE IF NOT EXISTS publication_execution_attempts (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    execution_id TEXT NOT NULL REFERENCES article_publication_executions(execution_id) ON DELETE CASCADE,
    attempt_number INTEGER NOT NULL,
    claimed_by_worker TEXT,
    outcome TEXT NOT NULL,
    error_class TEXT,
    reason_code TEXT,
    duration_ms INTEGER NOT NULL DEFAULT 0,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CHECK (outcome IN ('SUCCESS', 'RETRYABLE_ERROR', 'TERMINAL_ERROR', 'BLOCKED'))
);

-- 4. Table: publication_publisher_runs
CREATE TABLE IF NOT EXISTS publication_publisher_runs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    publisher_run_id TEXT NOT NULL UNIQUE,
    trigger_source TEXT NOT NULL,
    due_count INTEGER NOT NULL DEFAULT 0,
    claimed_count INTEGER NOT NULL DEFAULT 0,
    published_count INTEGER NOT NULL DEFAULT 0,
    retry_count INTEGER NOT NULL DEFAULT 0,
    blocked_count INTEGER NOT NULL DEFAULT 0,
    failed_count INTEGER NOT NULL DEFAULT 0,
    duration_ms INTEGER NOT NULL DEFAULT 0,
    executions_json TEXT NOT NULL DEFAULT '[]',
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);
```

---

## 3. Implementation Components

### 3.1 Core Publisher Engine (`src/lib/publication/publisher-service.ts`)
- **`schedulePlanForExecution(db, planId, actor)`**: Validates plan freshness and inserts a new execution in state `SCHEDULED`. Blocks if an active execution already exists for the article.
- **`getDueExecutions(db, options)`**: Queries executions in `SCHEDULED` or `RETRY_WAIT` where `target_publish_at <= now` and unexpired lease.
- **`claimExecutionLease(db, executionId, workerId, duration, nowUtc)`**: Atomic compare-and-set query. Returns `{ acquired: true }` if exactly 1 row was updated. Supports lease expiry recovery.
- **`validatePrepublishInvariants(db, execution)`**: Pre-publish double-gate verifying article draft status, content hash, featured media binding, approval validity, plan status, category/author foreign keys, and slug conflict.
- **`executeAtomicPublication(db, execution, articleSlug, attemptNumber)`**: Prepares and runs atomic D1 batch updating `articles`, marking `article_publication_executions` published, and writing `publication_execution_receipts`.
- **`processSingleExecution(db, execution, workerId, nowUtc)`**: Coordinates leasing, validation, mutation, and failure recovery.
- **`runPublisherDispatcher(db, options)`**: Batch runner coordinating all due items, recording telemetry into `publication_publisher_runs`.
- **`publishNow(db, planOrExecutionId, actor)`**: Operator endpoint running 100% of the exact same pre-publish gate.
- **`cancelExecution(db, executionId, actor, reason)`**: Operator cancellation. Fails safely if article is already published.
- **`retryExecution(db, executionId, actor)`**: Resets retries for failed/blocked executions.
- **`inspectExecution(db, executionId)`**: Full audit inspection of execution, receipt, and attempt history.
- **`verifyPublicSurface(db, slug)`**: Post-publish verification for SSR queries, canonical URL derivation, and sitemap eligibility.

### 3.2 Types & Constants (`src/lib/publication/publisher-types.ts`)
- Canonical statuses: `SCHEDULED`, `CLAIMED`, `PUBLISHING`, `PUBLISHED`, `RETRY_WAIT`, `FAILED`, `CANCELLED`, `BLOCKED`.
- Failure classes: `RETRYABLE`, `TERMINAL`, `SAFETY_BLOCK`.
- Versions: `PUBLISHER_VERSION = '1.0.0'`.

### 3.3 Admin REST API Endpoints
- **`src/pages/api/admin/publication/publish/due.ts`**:
  - `GET`: Lists currently due executions.
  - `POST`: Wakes dispatcher to process due executions (Dumb Cron wake-up trigger).
- **`src/pages/api/admin/publication/publish/control.ts`**:
  - `GET`: Inspects execution by `execution_id`.
  - `POST`: Operator actions (`schedule`, `publish_now`, `cancel`, `retry`).

---

## 4. Test Suite Verification (`scripts/test-publication-publisher.js`)

The test suite thoroughly verifies all 47 required validation dimensions against an in-memory SQLite database matching production D1 with migrations 0001 through 0009 applied:

| # | Test Group & Description | Result |
|---|---|---|
| 1 | PLANNED valid plan can create execution in SCHEDULED state | ✅ PASS |
| 2 | NOT_READY article excluded from scheduling | ✅ PASS |
| 3 | Stale readiness snapshot cannot schedule | ✅ PASS |
| 4 | Stale content hash mismatch cannot schedule | ✅ PASS |
| 5 | Stale media asset mismatch cannot schedule | ✅ PASS |
| 6 | Revoked approval cannot schedule | ✅ PASS |
| 7 | Cancelled plan excluded from scheduling | ✅ PASS |
| 8 | Superseded plan excluded from scheduling | ✅ PASS |
| 9 | Future execution is not due at current time | ✅ PASS |
| 10 | Exact target time execution is due | ✅ PASS |
| 11 | Overdue execution is due | ✅ PASS |
| 12 | Due execution lease successfully claimed by worker | ✅ PASS |
| 13 | Concurrent claim rejected while worker holds valid lease | ✅ PASS |
| 14 | Expired lease recovered by another worker | ✅ PASS |
| 15 | Final pre-publish gate rejects stale readiness | ✅ PASS |
| 16 | Content change after claim blocks publication | ✅ PASS |
| 17 | Media change after claim blocks publication | ✅ PASS |
| 18 | Approval revoke after claim blocks publication | ✅ PASS |
| 19 | Plan superseded after claim blocks publication | ✅ PASS |
| 20 | Missing/invalid author blocked at final gate | ✅ PASS |
| 21 | Missing/invalid category blocked at final gate | ✅ PASS |
| 22 | Incomplete metadata blocked at final gate | ✅ PASS |
| 23 | Duplicate slug collision blocked at final gate | ✅ PASS |
| 24 | Atomic publish succeeds returning receipt and canonical URL | ✅ PASS |
| 25 | Article status transitioned to published | ✅ PASS |
| 26 | published_at timestamp is set and stable | ✅ PASS |
| 27 | Immutable publication receipt persisted in database | ✅ PASS |
| 28 | Repeated execution returns existing receipt idempotently | ✅ PASS |
| 29 | Subsequent process invocation recognizes already published state | ✅ PASS |
| 30 | Clean process execution publishes safely | ✅ PASS |
| 31 | Exhausted retries transition execution to FAILED | ✅ PASS |
| 32 | Terminal validation failure transitions to FAILED without auto-retry | ✅ PASS |
| 33 | Operator cancel transitions execution to CANCELLED | ✅ PASS |
| 34 | Cancelling an already published execution safely rejected | ✅ PASS |
| 35 | publishNow successfully completes via canonical gate | ✅ PASS |
| 36 | publishNow cannot force publish article with invalid readiness | ✅ PASS |
| 37 | verifyPublicSurface confirms status is published | ✅ PASS |
| 38 | Canonical URL format verified (`https://rancangloka.com/{slug}`) | ✅ PASS |
| 39 | Article is sitemap eligible with valid published_at | ✅ PASS |
| 40 | Article markdown, HTML, and content_hash remain strictly unchanged | ✅ PASS |
| 41 | Featured media asset binding remains strictly unchanged | ✅ PASS |
| 42 | Editorial approval records remain strictly unchanged | ✅ PASS |
| 43 | Exactly one publication receipt exists per published article | ✅ PASS |
| 44 | Production Cron remains strictly disabled in wrangler config | ✅ PASS |
| 45 | AUTO_PUBLISH remains strictly OFF | ✅ PASS |
| 46 | MODEL_CALLS = 0 (100% deterministic software execution) | ✅ PASS |
| 47 | Run telemetry and plan events are completely free of credentials | ✅ PASS |

**Test Summary:** 48 Passed, 0 Failed.
**Regression Status:**
- PUBLICATION-0 test suite (`scripts/test-publication-readiness.js`): 85/85 Passing.
- PUBLICATION-1 test suite (`scripts/test-publication-planner.js`): 67/67 Passing.
- Astro Production Build: Succeeded in 8.16s with zero errors.
