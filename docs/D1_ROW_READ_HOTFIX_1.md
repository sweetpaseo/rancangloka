# D1 Row Read Hotfix 1: Mission Control Polling & Query Efficiency

**Milestone:** `D1-ROW-READ-HOTFIX-1`  
**Date:** 2026-10-05  
**Branch:** `feat/jev-lokamedia-integration`  
**Validation Status:** **`D1_HOTFIX_LOCAL_VALIDATED`**  
**Deployment Status:** **LOCAL DEVELOPMENT ONLY — STRICTLY ZERO REMOTE DEPLOYMENT — ZERO REMOTE MIGRATIONS**

---

## 1. Executive Summary & Root Cause Confirmation

A forensic audit of Cloudflare D1 row read amplification identified that a single active operator session in Mission Control / Pixel Office could exhaust the daily 5,000,000 row read quota within 5 to 7 hours.

### Confirmed Root Causes:
1. **Unconditional Full Snapshot Before Revision Check (`src/lib/mission-control/events.ts`):**
   The `/api/admin/mission-control/events` endpoint executed `getMissionControlSnapshot(db, {})` and `getOperatorActionsHistory(db, 20)` on **every single poll**, executing 9 separate subsystem queries (~50 to 80 rows read per poll), even when nothing had changed.
2. **Aggressive Client Polling Frequency (`src/pages/admin/mission-control/office.astro`):**
   The Pixel Office frontend polled `/api/admin/mission-control/events` every 2.5 seconds unconditionally, continuing while tab was in background, with no in-flight mutex, leading to query overlaps.
3. **Missing D1 Indexes on High-Frequency Ordering & Filtering Columns:**
   - `publication_cron_runs`: sorted by `started_at DESC` (full table scan + temp B-tree).
   - `media_job_events`: sorted by `created_at DESC` (full table scan + temp B-tree).
   - `article_editorial_approvals`: filtered by `approval_status` and sorted by `created_at DESC` (full scan).
   - `articles`: sorted by `updated_at DESC` (full table scan for pipeline board).
   - `media_jobs`: sorted by `created_at DESC` (full table scan).
   - `article_ingest_receipts`: sorted by `created_at DESC`.
   - `social_execution_receipts`: sorted by `created_at DESC` and filtered by `outcome`.
   - `mission_control_operator_actions`: sorted by `requested_at DESC`.
4. **Unbounded Article Query on Every Public Slug Visit (`src/pages/[slug].astro`):**
   Every visit to `/[slug]` called `getAllArticles(db, 1000, 0, 'published')` fetching the entire article table including `content_md` and `content_html` blobs just to pick 3 internal link candidates.
5. **Full Snapshot Invocation During Staff Chat (`src/pages/api/admin/mission-control/chat/[agent_id].ts`):**
   Every 10-second chat poll invoked `getMissionControlSnapshot()` simply to extract a single staff member's active status.
6. **Full Settings Scan for Single Key Lookup (`src/lib/social/providers/meta/connection-service.ts`):**
   `getMetaConnection()` called `getAllSiteSettings()`, scanning every key in the settings table.

---

## 2. Implemented Architecture & Optimizations

### A. Events Fast-Path First (`src/lib/mission-control/events.ts`)
- Implemented `getLightweightRevision(db)`:
  - Bounded read of $\le 4$ rows across core tables:
    1. `automation_control` (1 row: `SELECT updated_at, mode, kill_switch_engaged FROM automation_control WHERE id = 1`)
    2. `mission_control_operator_actions` (1 row: `SELECT action_id, requested_at, completed_at, action_type ... ORDER BY requested_at DESC LIMIT 1`)
    3. `publication_cron_runs` (1 row: `SELECT id, status, started_at, finished_at ... ORDER BY id DESC LIMIT 1`)
    4. `mission_control_anomalies` (1 row: `SELECT anomaly_id, state, severity, updated_at, detected_at ... ORDER BY last_seen_at DESC LIMIT 1`)
- Fast-Path check:
  - If `sinceRevision` matches the derived lightweight revision: immediately returns `{ changed: false, current_revision, server_timestamp, event_count: 0, events: [], telemetry_status: 'HEALTHY' }`.
  - **Zero calls** to `getMissionControlSnapshot()`, **zero calls** to `getOperatorActionsHistory()`.
  - D1 row reads for unchanged poll: **$\le 4$ rows** (down from ~65-80 rows).

### B. Pixel Office Polling Backoff & In-Flight Protection (`src/pages/admin/mission-control/office.astro`)
- **Cadence Adjustment:**
  - `minPollInterval`: increased from `2500ms` (2.5s) to `10000ms` (10s base active interval).
  - `maxPollInterval`: quiet backoff to `30000ms` (30s).
  - `backgroundPollInterval`: set to `60000ms` (60s) when tab is hidden.
- **Mutex & Mutability Guard:**
  - Added `isCheckingEvents` in-flight mutex preventing overlapping HTTP requests.
  - Tab visibility listener (`visibilitychange`): immediately wakes up when visible, backs off when hidden.
  - Client only requests full snapshot (`/api/admin/mission-control/snapshot`) when `data.changed === true`.

### C. Additive Performance Index Migration (`db/migrations/0029_d1_performance_indexes.sql`)
Created local additive migration with 9 targeted indexes:
```sql
CREATE INDEX IF NOT EXISTS idx_cron_runs_started ON publication_cron_runs(started_at DESC);
CREATE INDEX IF NOT EXISTS idx_media_job_events_created ON media_job_events(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_approvals_status_created ON article_editorial_approvals(approval_status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_articles_updated ON articles(updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_media_jobs_created ON media_jobs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_ingest_receipts_created ON article_ingest_receipts(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_social_receipts_created ON social_execution_receipts(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_social_receipts_outcome_created ON social_execution_receipts(outcome, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_mc_action_requested ON mission_control_operator_actions(requested_at DESC);
```

### D. Article Queries & Internal Links Optimization (`src/lib/db.ts`, `src/pages/[slug].astro`, `src/pages/admin/preview/[slug].astro`)
1. **Lightweight Column Selection in `getAllArticles`:**
   - Excludes large text blobs (`content_md`, `content_html`) from database query when listing articles (`'' as content_md, '' as content_html` returned to preserve interface contracts without payload bloat).
   - Applies SQL-level `LIMIT ? OFFSET ?` directly in database query rather than in-memory array slicing.
   - Distinct SQL queries for filtered vs unfiltered (`WHERE a.status = ?` vs no status filter) allowing SQLite query optimizer to use `idx_articles_status_published`.
   - Database-level quarantine exclusion (`AND a.slug NOT IN (...)`).
2. **Bounded Internal Link Candidate Function (`getInternalLinkCandidates`):**
   - Loads only `id, slug, title, focus_keyword, status, is_featured, published_at` bounded to `LIMIT 50`.
   - `/[slug].astro` and `/admin/preview/[slug].astro` use `getInternalLinkCandidates(db, 50)` instead of `getAllArticles(db, 1000)`.
3. **Database-Level Count (`getTotalArticlesCount`):**
   - Replaced table scan with `SELECT COUNT(*) as count FROM articles WHERE status = ?`.

### E. Staff Chat Decoupling (`src/lib/mission-control/staff-registry.ts`, `src/pages/api/admin/mission-control/chat/[agent_id].ts`)
- Added `getLightweightStaffState(db, agentId)`:
  - Directly queries active task/draft assigned to the specific agent (1-2 rows).
  - Chat polling (`GET /api/admin/mission-control/chat/[agent_id]`) no longer invokes `getMissionControlSnapshot()`.

### F. Settings Lookup Optimization (`src/lib/db.ts`, `src/lib/social/providers/meta/connection-service.ts`)
- Added `getSiteSettingByKey(db, key)`: executes single indexed primary key lookup (`SELECT value FROM settings WHERE key = ? LIMIT 1`).
- `getMetaConnection(db)` uses `getSiteSettingByKey` instead of scanning entire settings table.

---

## 3. EXPLAIN QUERY PLAN Verification (Before vs After)

| Query Pattern | Before Index | After Index |
|---|---|---|
| `publication_cron_runs ORDER BY started_at DESC LIMIT ?` | `SCAN publication_cron_runs` + `USE TEMP B-TREE FOR ORDER BY` | `SCAN publication_cron_runs USING INDEX idx_cron_runs_started` (Zero Temp B-Tree) |
| `media_job_events ORDER BY created_at DESC LIMIT ?` | `SCAN media_job_events` + `USE TEMP B-TREE FOR ORDER BY` | `SCAN media_job_events USING INDEX idx_media_job_events_created` (Zero Temp B-Tree) |
| `article_editorial_approvals WHERE approval_status = ? ORDER BY created_at DESC LIMIT ?` | `SCAN article_editorial_approvals` + `USE TEMP B-TREE FOR ORDER BY` | `SEARCH article_editorial_approvals USING INDEX idx_approvals_status_created` (Zero Temp B-Tree) |
| `articles ORDER BY updated_at DESC LIMIT ?` | `SCAN articles` + `USE TEMP B-TREE FOR ORDER BY` | `SCAN articles USING INDEX idx_articles_updated` (Zero Temp B-Tree) |
| `media_jobs ORDER BY created_at DESC LIMIT ?` | `SCAN media_jobs` + `USE TEMP B-TREE FOR ORDER BY` | `SCAN media_jobs USING INDEX idx_media_jobs_created` (Zero Temp B-Tree) |
| `article_ingest_receipts ORDER BY created_at DESC LIMIT ?` | `SCAN article_ingest_receipts` + `USE TEMP B-TREE FOR ORDER BY` | `SCAN article_ingest_receipts USING INDEX idx_ingest_receipts_created` (Zero Temp B-Tree) |
| `social_execution_receipts ORDER BY created_at DESC LIMIT ?` | `SCAN social_execution_receipts` + `USE TEMP B-TREE FOR ORDER BY` | `SCAN social_execution_receipts USING INDEX idx_social_receipts_created` (Zero Temp B-Tree) |
| `social_execution_receipts WHERE outcome = 'SUCCESS' AND created_at >= ?` | `SCAN social_execution_receipts` | `SEARCH social_execution_receipts USING INDEX idx_social_receipts_outcome_created` |
| `articles WHERE status = 'published' ORDER BY published_at DESC LIMIT ? OFFSET ?` | Multi-column fallback scan | `SEARCH articles USING INDEX idx_articles_status_published` (Zero Temp B-Tree) |

---

## 4. D1 Rows Read Comparison & Efficiency Projection

| Operational Path | Before Hotfix | After Hotfix | Reduction Ratio |
|---|---|---|---|
| **Mission Control Events Heartbeat (Unchanged)** | ~65 - 80 rows / 2.5s | $\le 4$ rows / 10s - 30s | **95% - 98.7% reduction** |
| **Pixel Office 1-Hour Active Session (Quiet)** | ~100,800 rows / hour | ~960 - 1,440 rows / hour | **~98.5% reduction** |
| **Pixel Office 1-Hour Background Tab** | ~100,800 rows / hour | ~240 rows / hour | **~99.7% reduction** |
| **Public `/[slug]` Internal Link Resolution** | Full table scan (1,000 rows + content blobs) | 50 rows (metadata only) | **95% reduction** |
| **Staff Chat 10s Poll** | ~65 - 80 rows / 10s | 1 - 2 rows / 10s | **97.5% reduction** |
| **Settings Key Lookup (`getMetaConnection`)** | Full scan of `settings` table | 1 targeted row (`LIMIT 1`) | **90% reduction** |

**Daily Projections (1 Operator, 8-Hour Active MC + Public Traffic):**
- **Before:** ~1,000,000 to 1,500,000+ rows/day from MC alone (causing 5M limit exhaustion with background workers).
- **After:** ~15,000 to 25,000 rows/day from MC. Total footprint well below 1% of the 5M daily free tier.

---

## 5. Verification Test Suites

All tests executed locally against in-memory SQLite and production build outputs:

1. **`node scripts/test-d1-read-hotfix.js`:** **24/24 PASS**
   - Bounded revision read ($\le 4$ rows).
   - Unchanged events poll does not invoke `getMissionControlSnapshot`.
   - Changed revision triggers snapshot.
   - Frontend polling constants verified (`minPollInterval >= 10s`, `maxPollInterval >= 30s`).
   - In-flight mutex `isCheckingEvents` verified.
   - SQL `LIMIT/OFFSET`, lightweight columns, and status branch verified.
   - `getTotalArticlesCount` SQL COUNT(*) verified.
   - `getInternalLinkCandidates` bounded query verified.
   - Staff chat decoupling verified.
   - 9 EXPLAIN QUERY PLAN index usages verified without temp B-trees.
   - Safety invariants verified.
2. **`node scripts/test-soak-safety.js`:** **54/54 PASS**
3. **`node scripts/test-mission-control-liveops.js`:** **78/78 PASS**
4. **`node scripts/test-mission-control-liveops-4.js`:** **15/15 PASS**
5. **`node scripts/test-mission-control-chat.js`:** **20/20 PASS**
6. **`node scripts/test-content-quarantine.js`:** **19/19 PASS**
7. **`node scripts/test-article-render-integrity.js`:** **6/6 PASS**
8. **`node scripts/test-article-persistence.js`:** **7/7 PASS**
9. **`npx tsc --noEmit`:** **Clean (Exit code 0, zero diagnostic errors)**
10. **`npm run build`:** **Clean (Exit code 0, Cloudflare server bundle and client assets built successfully)**

---

## 6. Safety & Operational Invariants

The following safety invariants remain strictly preserved:
- `automation_mode = OFF`
- `SOCIAL_AUTOMATION = OFF`
- `AUTO_PUBLISH = OFF`
- `publishingAuthority = 0`
- `JEV_MODE = shadow`
- `mediaWorker = DISABLED`
- `Jefry execution authority = 0`
- **Zero remote production D1 writes or mutations executed.**
- **Zero remote D1 migrations applied.**
- **Zero Cloudflare deployments executed.**

---

## 7. Migration & Deployment Plan for Operator Review

1. **Local Migration Prepared:**
   - File: `db/migrations/0029_d1_performance_indexes.sql`
   - Nature: **100% Additive (`CREATE INDEX IF NOT EXISTS`)**. No table drops, no column mutations, zero risk of data loss.
2. **Remote Migration Instruction (Manual Operator Step):**
   - When ready for staging/production deployment, operator applies:
     ```bash
     wrangler d1 migrations apply rancangloka-db --remote
     ```
3. **Deployment Instruction (Manual Operator Step):**
   - When ready, operator deploys:
     ```bash
     npm run deploy
     ```

---

D1_HOTFIX_LOCAL_VALIDATED
