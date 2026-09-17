# 🚀 PUBLICATION-2: Scheduled Publisher Architecture & System Design

**Document Version:** 1.0.0  
**Status:** DESIGN & AUDIT COMPLETED / APPROVED FOR IMPLEMENTATION  
**Milestone:** PUBLICATION-2 — Scheduled Publisher  
**Authors:** RancangLoka Core Architecture Team  
**Date:** 2026-09-07  

---

## 1. Executive Summary

Milestone **PUBLICATION-2 (Scheduled Publisher)** is the final, authoritative execution layer of the RancangLoka publishing pipeline. It bridges prioritized temporal plans in state **`PLANNED`** (from **PUBLICATION-1**) to active, publicly visible editorial content in state **`published`**.

$$\mathbf{READY\_TO\_SCHEDULE}\;(\text{PUB-0}) \xrightarrow{\text{Plan}} \mathbf{PLANNED}\;(\text{PUB-1}) \xrightarrow{\text{Schedule}} \mathbf{SCHEDULED} \xrightarrow{\text{Due}} \mathbf{CLAIMED} \xrightarrow[\text{Pre-publish Gate}]{\text{Revalidate}} \mathbf{PUBLISHED}\;(\text{PUB-2})$$

### Core Architectural Invariants
1. **PUBLICATION-2 is the Sole Execution Authority:** No other subsystem (Orchestrator, Outbox, Media, or Planner) is permitted to mutate `articles.status` to `published` or set `published_at`.
2. **Fail-Closed Double-Gate:** Immediately prior to atomic publication mutation, the publisher revalidates all **PUBLICATION-0** readiness invariants and **PUBLICATION-1** plan integrity. Any mismatch immediately aborts publication.
3. **Atomic State Transition:** The transition of `articles.status` from `'draft'` to `'published'` and the registration of the execution receipt occur in a single atomic database transaction. Partial publication is impossible.
4. **Exactly-Once Semantics:** Idempotent claim leases, database uniqueness constraints, and post-commit receipt reconciliation guarantee that no article can ever be published twice.
5. **Zero Model Provider Calls:** Candidate selection, claim leasing, revalidation, and publishing are 100% deterministic software logic (`MODEL_CALLS = 0`).
6. **Zero Article Body Mutation:** The publisher has zero write permissions to `content_md`, `content_html`, or `content_hash`.
7. **Production Cron Remains Disabled:** Unattended cron execution remains strictly disabled (`AUTO_PUBLISH = OFF`, `PRODUCTION_CRON_ENABLED = NO`) until full implementation and live verification are complete.

---

## 2. Production Model & Subsystem Audit

### 2.1 Articles Schema Audit (`articles` table in D1)
Inspection of the production schema (`rancangloka_db`) reveals the exact existing column structure:
```sql
CREATE TABLE articles (
  id INTEGER PRIMARY KEY,
  slug TEXT NOT NULL UNIQUE,
  title TEXT NOT NULL,
  description TEXT,
  content_md TEXT NOT NULL,
  content_html TEXT NOT NULL,
  featured_image TEXT,
  image_alt TEXT,
  category_id INTEGER,
  author_id INTEGER,
  status TEXT DEFAULT 'published', -- Values: 'draft', 'published', 'scheduled'
  views INTEGER DEFAULT 0,
  reading_time_minutes INTEGER DEFAULT 3,
  key_takeaways TEXT,
  focus_keyword TEXT,
  content_hash TEXT,
  is_featured INTEGER DEFAULT 0,
  is_trending INTEGER DEFAULT 0,
  is_sponsored INTEGER DEFAULT 0,
  disable_internal_links INTEGER DEFAULT 0,
  published_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
```

#### Key Schema Discoveries:
- **No `created_at` Column:** Only `published_at` and `updated_at` exist in `articles`.
- **No `scheduled_at` Column:** Article scheduling is decoupled from the `articles` table and managed exclusively through publication planning and execution tables.
- **`status` Column Values:** The CMS acknowledges `'draft'`, `'published'`, and legacy `'scheduled'`.
- **Foreign Keys:** `category_id` references `categories(id)`; `author_id` references `authors(id)`.

### 2.2 Public Query & SSR Routing Behavior
- **Article Detail Route (`src/pages/[slug].astro`):**
  Uses `getPublishedArticleBySlug(db, slug)` which executes:
  ```sql
  SELECT a.*, c.name as category_name, c.slug as category_slug, ...
  FROM articles a
  WHERE a.slug = ? AND a.status = 'published'
  LIMIT 1;
  ```
  If an article is `draft` or `scheduled`, the route immediately returns HTTP 404.
- **Category & Home Routes (`src/pages/index.astro`, `src/pages/category/[category].astro`):**
  Uses `getAllArticles(db, limit, offset, 'published')` which filters strictly on `status = 'published'` and orders by `published_at DESC`.
- **Sitemaps & Feeds (`src/pages/sitemap-news.xml.ts`, `rss.xml.ts`):**
  Dynamically filters on `status = 'published'` and `published_at >= datetime('now', '-48 hours')` for Google News.
- **Edge Dynamic SSR:** RancangLoka runs on Cloudflare Workers using Astro SSR mode (`@astrojs/cloudflare`). Live queries execute against D1 on every incoming request. **No static build or deployment is required for a newly published article to become visible immediately across the website.**

### 2.3 Upstream Readiness & Planner Contracts
- **PUBLICATION-0:** Stores immutable human approvals in `article_editorial_approvals` and evaluations in `article_publication_readiness`. Exposes `getArticlesReadyToSchedule(db)` for articles satisfying all 6 vectors (`is_ready = 1`, `overall_status = 'READY_TO_SCHEDULE'`).
- **PUBLICATION-1:** Stores plans in `article_publication_plans` with partial unique index `uq_active_plan_per_article ON article_publication_plans(article_id) WHERE plan_status = 'PLANNED'`. Enforces `target_publish_at` (UTC ISO 8601) and `target_publish_local` (`YYYY-MM-DD HH:MM:SS WIB`). Exposes `validatePlanFreshness(db, planId)`.

---

## 3. State Ownership & Dedicated Execution Lifecycle

To prevent coupling and status overloading between planning and execution, state domains are strictly separated:

| Subsystem | State Domain | Owned Statuses | Notes |
| :--- | :--- | :--- | :--- |
| **CMS Core** | `articles.status` | `draft`, `published` | Public visibility flag |
| **MEDIA-0/1** | `media_assets.status` | `VALIDATED`, `REJECTED` | Storage & dimension verification |
| **PUBLICATION-0**| `readiness.overall_status` | `NOT_READY`, `READY_TO_SCHEDULE`, `BLOCKED` | Editorial gate verification |
| **PUBLICATION-1**| `plans.plan_status` | `UNPLANNED`, `PLANNED`, `SUPERSEDED`, `CANCELLED`, `BLOCKED` | Temporal scheduling & inventory order |
| **PUBLICATION-2**| `executions.execution_status` | `SCHEDULED`, `CLAIMED`, `PUBLISHING`, `PUBLISHED`, `RETRY_WAIT`, `FAILED`, `CANCELLED` | Active execution state machine |

```
   PUBLICATION-1                          PUBLICATION-2 Execution Lifecycle
 ┌───────────────┐
 │    PLANNED    │ ──(Schedule Plan)──> ┌──────────────┐
 └───────┬───────┘                      │  SCHEDULED   │
         │                              └──────┬───────┘
         │                                     │ (Due Time Reached)
         │                                     ▼
         │                              ┌──────────────┐
         │                              │   CLAIMED    │ (Worker Lease Acquired)
         │                              └──────┬───────┘
         │                                     │ (Final Gate Revalidation)
         │                              ┌──────┴───────┐
         │                        [Pass]│              │[Fail]
         │                              ▼              ▼
         │                      ┌──────────────┐ ┌──────────────┐
         │                      │  PUBLISHING  │ │ FAILED/BLOCK │
         │                      └──────┬───────┘ └──────────────┘
         │                             │ (Atomic D1 Commit)
         │                             ▼
         ▼                      ┌──────────────┐
 ┌───────────────┐              │  PUBLISHED   │ ──> articles.status = 'published'
 │  SUPERSEDED   │              └──────────────┘
 └───────────────┘
```

---

## 4. Database Schema Design (Migration `0009_scheduled_publisher.sql`)

Migration 0009 introduces dedicated tables to manage execution state, lease concurrency, and audit receipts without mutating upstream tables:

```sql
-- ============================================================================
-- 1. Publication Executions Table
-- Manages the active dispatch lifecycle of scheduled publication tasks.
-- ============================================================================
CREATE TABLE IF NOT EXISTS article_publication_executions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  execution_id TEXT NOT NULL UNIQUE,       -- e.g. pexec_8f3a9b1c2d3e
  plan_id TEXT NOT NULL UNIQUE,            -- Strictly 1 execution per plan
  article_id INTEGER NOT NULL,
  content_hash TEXT NOT NULL,
  featured_asset_id TEXT NOT NULL,
  target_publish_at DATETIME NOT NULL,     -- Target time in UTC ISO 8601
  execution_status TEXT NOT NULL DEFAULT 'SCHEDULED', 
  -- Statuses: SCHEDULED, CLAIMED, PUBLISHING, PUBLISHED, RETRY_WAIT, FAILED, CANCELLED
  claimed_by_worker TEXT,                  -- Worker instance / lease owner identifier
  lease_expires_at DATETIME,               -- Lease expiration timestamp (UTC)
  attempts_count INTEGER NOT NULL DEFAULT 0,
  max_attempts INTEGER NOT NULL DEFAULT 3,
  next_retry_at DATETIME,
  last_error_reason TEXT,
  actual_published_at DATETIME,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (plan_id) REFERENCES article_publication_plans(plan_id),
  FOREIGN KEY (article_id) REFERENCES articles(id)
);

-- Index for due execution selection
CREATE INDEX IF NOT EXISTS idx_pub_executions_due 
ON article_publication_executions(execution_status, target_publish_at)
WHERE execution_status IN ('SCHEDULED', 'RETRY_WAIT');

-- Partial index for active executions per article
CREATE UNIQUE INDEX IF NOT EXISTS uq_active_execution_per_article
ON article_publication_executions(article_id)
WHERE execution_status IN ('SCHEDULED', 'CLAIMED', 'PUBLISHING', 'RETRY_WAIT');

-- ============================================================================
-- 2. Publication Execution Receipts Table
-- Immutable cryptographic audit trail of completed publications.
-- ============================================================================
CREATE TABLE IF NOT EXISTS publication_execution_receipts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  receipt_id TEXT NOT NULL UNIQUE,         -- e.g. rcpt_7a8b9c0d1e2f
  execution_id TEXT NOT NULL UNIQUE,
  plan_id TEXT NOT NULL,
  article_id INTEGER NOT NULL,
  slug TEXT NOT NULL,
  content_hash TEXT NOT NULL,
  featured_asset_id TEXT NOT NULL,
  canonical_url TEXT NOT NULL,
  target_publish_at DATETIME NOT NULL,
  actual_published_at DATETIME NOT NULL,
  publisher_version TEXT NOT NULL,
  planner_version TEXT NOT NULL,
  attempts_count INTEGER NOT NULL,
  outcome TEXT NOT NULL,                   -- SUCCESS, FAILED, ABORTED
  details_json TEXT NOT NULL,              -- Telemetry, timing, verification metrics
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (execution_id) REFERENCES article_publication_executions(execution_id),
  FOREIGN KEY (article_id) REFERENCES articles(id)
);

-- ============================================================================
-- 3. Publisher Run Telemetry Table
-- High-level batch run metrics for monitoring and observability.
-- ============================================================================
CREATE TABLE IF NOT EXISTS publication_publisher_runs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  publisher_run_id TEXT NOT NULL UNIQUE,   -- e.g. prun_pub2_0a1b2c3d
  trigger_source TEXT NOT NULL,            -- 'cron', 'manual', 'api'
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

## 5. End-to-End Publication Execution Pipeline

### 5.1 Stage 1: Schedule Eligibility & Registration
Transitioning an active plan from `PLANNED` to `SCHEDULED` requires passing preliminary validation:
```typescript
async function schedulePlanForExecution(db: D1Database, planId: string, actor: string): Promise<PublicationExecutionRecord>
```
1. Fetch plan where `plan_id = ? AND plan_status = 'PLANNED'`. Fail closed if not found.
2. Confirm no active execution already exists for this `article_id` via `uq_active_execution_per_article`.
3. Verify plan freshness using `validatePlanFreshness(db, planId)`.
4. Verify article `status = 'draft'`.
5. Insert new record into `article_publication_executions` with `execution_status = 'SCHEDULED'`.

### 5.2 Stage 2: Due Selection & Atomic Lease Claim (Concurrency Protection)
When the dispatcher executes (either via manual trigger or cron wake-up), it queries for due tasks using trusted UTC server time:
```sql
SELECT * FROM article_publication_executions
WHERE execution_status IN ('SCHEDULED', 'RETRY_WAIT')
  AND target_publish_at <= datetime('now')
  AND (next_retry_at IS NULL OR next_retry_at <= datetime('now'))
  AND (lease_expires_at IS NULL OR lease_expires_at < datetime('now'))
ORDER BY target_publish_at ASC
LIMIT 10;
```
For each selected candidate, the worker attempts an **atomic compare-and-set lease claim**:
```sql
UPDATE article_publication_executions
SET execution_status = 'CLAIMED',
    claimed_by_worker = ?,
    lease_expires_at = datetime('now', '+5 minutes'),
    updated_at = CURRENT_TIMESTAMP
WHERE execution_id = ?
  AND execution_status IN ('SCHEDULED', 'RETRY_WAIT')
  AND (lease_expires_at IS NULL OR lease_expires_at < datetime('now'));
```
If `changes === 0`, another worker claimed the lease concurrently; this worker skips the task immediately.

### 5.3 Stage 3: Final Pre-Publish Double-Gate Revalidation
Immediately after acquiring the lease, before any data mutation, the worker performs exhaustive revalidation:

```typescript
async function validatePrepublishInvariants(
  db: D1Database, 
  execution: PublicationExecutionRecord
): Promise<PrepublishValidationResult>
```

#### Verification Matrix:
1. **PUBLICATION-0 Revalidation:**
   - Evaluates `article_publication_readiness`: must have `is_ready = 1` and `overall_status = 'READY_TO_SCHEDULE'`.
   - Evaluates `article_editorial_approvals`: latest approval must have `approval_status = 'APPROVED'`.
   - Evaluates active featured media: `article_media` must point to valid `media_assets` with `status = 'VALIDATED'`.
2. **PUBLICATION-1 Revalidation:**
   - Evaluates `article_publication_plans`: plan status must still be `PLANNED`.
   - Cryptographic check: `article.content_hash === plan.content_hash === approval.approved_content_hash`.
   - Media identity check: `activeMedia.asset_id === plan.featured_asset_id === approval.approved_asset_id`.
3. **CMS Article Integrity Revalidation:**
   - `article.status === 'draft'`.
   - Category check: `category_id` exists in `categories` table.
   - Author check: `author_id` exists in `authors` table.
   - Title, slug, description, content_md, and content_html non-empty.
   - **Slug Collision Guard:**
     ```sql
     SELECT id FROM articles 
     WHERE slug = ? AND id != ? AND status = 'published'
     LIMIT 1;
     ```
     Must return 0 rows.

**Fail-Closed Rule:** If any check fails, the publication is aborted. The execution is transitioned to `FAILED` (if terminal) or `RETRY_WAIT` (if transient), with detailed error reasons logged.

### 5.4 Stage 4: Atomic Publication Mutation
If all pre-publish checks pass, the worker transitions state to `PUBLISHING` and executes a single atomic D1 batch:

```typescript
const actualPublishedAt = new Date().toISOString();
const receiptId = `rcpt_${getRandomHex(8)}`;

const batchStatements = [
  // 1. Atomic Article Publish
  db.prepare(`
    UPDATE articles 
    SET status = 'published',
        published_at = ?,
        updated_at = CURRENT_TIMESTAMP
    WHERE id = ? AND status = 'draft'
  `).bind(actualPublishedAt, articleId),

  // 2. Execution Completion
  db.prepare(`
    UPDATE article_publication_executions
    SET execution_status = 'PUBLISHED',
        actual_published_at = ?,
        updated_at = CURRENT_TIMESTAMP
    WHERE execution_id = ? AND execution_status = 'CLAIMED'
  `).bind(actualPublishedAt, executionId),

  // 3. Immutable Cryptographic Publication Receipt
  db.prepare(`
    INSERT INTO publication_execution_receipts (
      receipt_id, execution_id, plan_id, article_id, slug,
      content_hash, featured_asset_id, canonical_url,
      target_publish_at, actual_published_at, publisher_version,
      planner_version, attempts_count, outcome, details_json, created_at
    ) VALUES (
      ?, ?, ?, ?, ?,
      ?, ?, ?,
      ?, ?, ?,
      ?, ?, 'SUCCESS', ?, CURRENT_TIMESTAMP
    )
  `).bind(
    receiptId, executionId, planId, articleId, article.slug,
    article.content_hash, featuredAssetId, `https://rancangloka.com/${article.slug}`,
    targetPublishAt, actualPublishedAt, PUBLISHER_VERSION,
    PLANNER_VERSION, attemptsCount, JSON.stringify(telemetryDetails)
  ),

  // 4. Audit Trail Event
  db.prepare(`
    INSERT INTO publication_plan_events (
      plan_id, article_id, event_type, actor_type, actor_id, details_json
    ) VALUES (?, ?, 'PUBLISHED', 'publisher', 'publication2-dispatcher', ?)
  `).bind(planId, articleId, JSON.stringify({ receiptId, actualPublishedAt }))
];

await db.batch(batchStatements);
```

#### Failure Atomicity Guarantee:
If the database batch fails or the article was modified by a race condition (`changes === 0`), D1 rolls back all statements. The article remains strictly `draft`, and no receipt is created.

---

## 6. Exactly-Once Delivery & Failure Recovery Semantics

### 6.1 Worker Crash After D1 Commit
If the worker process crashes after the D1 batch commits but before logging output or sending network responses:
1. On the subsequent run, the dispatcher encounters the task.
2. It detects `articles.status = 'published'` and queries `publication_execution_receipts` for `execution_id`.
3. Finding an existing receipt, it reconciles `execution_status = 'PUBLISHED'` without re-executing any publish mutations.

### 6.2 Bounded Retry Model for Transient Errors
Failures during execution are classified into two deterministic categories:

```
                      Failure Encountered
                               │
            ┌──────────────────┴──────────────────┐
            ▼                                     ▼
     Transient Error                       Terminal / Safety Error
(D1 lock, network glitch)           (Hash mismatch, stale readiness,
            │                         approval revoked, slug conflict)
            │                                     │
   attempts < maxAttempts                         │
     ┌──────┴──────┐                              ▼
[Yes]│             │[No]                   FAIL-CLOSED IMMEDIATELY
     ▼             ▼                        execution_status = 'FAILED'
RETRY_WAIT      FAILED                     reason = <FailureCode>
Backoff:        Operator Alert             NO AUTOMATIC RETRY
15s, 60s, 300s
```

- **Transient Errors:** Retryable up to 3 attempts with exponential backoff.
- **Terminal Errors:** Immediate transition to `FAILED`. Never automatically retried.

---

## 7. Public Surface Verification Contract

After an article is published, the publisher service provides automated verification across all public consumption surfaces:

1. **HTTP Resolution:** `GET https://rancangloka.com/${slug}` must return HTTP 200 with non-empty content body and `status = 'published'`.
2. **Schema.org Structured Data:** The public HTML must include valid JSON-LD `Article` schema with `datePublished` and `dateModified` matching `actual_published_at`.
3. **Sitemap Integration:** `sitemap-news.xml.ts` dynamically includes the new article if published within 48 hours.
4. **RSS Feed:** `rss.xml.ts` immediately serves the new article in its feed.
5. **No Duplicate Slugs:** Confirmed singular canonical URL representation.

---

## 8. Scheduler / Cron Boundary Separation

To maintain architectural purity, the cron trigger and publisher execution are strictly isolated:

```
[Cloudflare Cron Trigger / Webhook Wakeup]
               │
               ▼ (Calls Trigger Endpoint)
[POST /api/admin/publication/publish/due]
               │
               ▼ (Invokes Core Engine)
[runPublisherDispatcher(db, options)]
   ├── 1. Query Due Executions
   ├── 2. Atomic Lease Claim
   ├── 3. Pre-Publish Double-Gate Revalidation
   ├── 4. Atomic D1 Batch Mutation
   └── 5. Public Surface Verification
```

- **Cron Handlers are Dumb:** The cron trigger contains zero business logic, zero SQL queries, and zero state management. It simply wakes the dispatcher service.
- **Independent Testability:** The dispatcher service can be invoked programmatically in tests or through protected admin APIs without waiting for a cron interval.

---

## 9. Operator Controls (Human-in-the-Loop)

Authorized editorial operators are provided with explicit, auditable controls:
1. **`schedulePlan(planId)`:** Schedules an approved, fresh plan for execution.
2. **`unschedulePlan(planId)`:** Removes a plan from the execution schedule before lease claim.
3. **`publishNow(planId)`:** Triggers immediate publication, forcing execution through **100% of the exact same pre-publish validation double-gate**. *Cannot bypass readiness or approvals.*
4. **`cancelExecution(executionId)`:** Manually cancels an active or queued execution.
5. **`retryExecution(executionId)`:** Resets a failed or retrying execution for another attempt.

---

## 10. Security & Permission Boundary

The publisher operates under strict principle-of-least-privilege boundaries:
- **Authorized Actions:**
  - Read active publication plans and readiness records.
  - Read and claim due execution records.
  - Update `articles.status` to `'published'` and set `published_at`.
  - Insert publication execution receipts and plan events.
- **Strictly Forbidden Actions:**
  - Modifying article body (`content_md`, `content_html`).
  - Modifying or granting editorial approvals (`article_editorial_approvals`).
  - Modifying or uploading media assets (`media_assets`, `article_media`).
  - Calling AI/LLM model providers (`MODEL_CALLS = 0`).
  - Mutating site settings or deploying code.

---

## 11. Implementation & Verification Plan (Next Steps)

1. **Step 1: Database Migration (`0009_scheduled_publisher.sql`):**
   Create schema for executions, receipts, and publisher runs with partial indexes.
2. **Step 2: Publisher Service & Engine:**
   Implement `src/lib/publication/publisher-service.ts` and `src/lib/publication/publisher-types.ts`.
3. **Step 3: Admin & Dispatcher API Endpoints:**
   Implement `src/pages/api/admin/publication/publish/due.ts` and `control.ts`.
4. **Step 4: Unit Test Suite (`scripts/test-publication-publisher.js`):**
   Test all 24 required dimensions locally (concurrency, idempotency, failure classification, stale protection).
5. **Step 5: Local D1 Smoke (`scripts/smoke-publication-publisher-local.js`):**
   Full end-to-end publishing test on local Miniflare D1 store.
6. **Step 6: Controlled Production Smoke:**
   Live non-publishing & publishing test on single internal smoke draft article.
