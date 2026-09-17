# 🛡️ SOAK-0 — End-to-End Safety & Activation Architecture

**Document Version:** 1.0.0  
**Milestone:** SOAK-0 — End-to-End Safety & Activation Readiness  
**Status:** ARCHITECTURE & SAFETY DESIGN FROZEN (Zero Activation / Zero Production Mutation)  
**Date:** 2026-09-07  

---

## 1. Executive Summary & Design Scope

The RancangLoka autonomous publishing platform has achieved verified, proven implementations across all constituent subsystems:
- **ORCH-0:** Editorial Orchestration state machine & pipeline checkpoints (Complete/Frozen).
- **MEDIA-0 & MEDIA-1:** Content-addressable R2 storage, D1 job queue, and LokaMedia Extension (Complete/Frozen).
- **PUBLICATION-0:** Publication Readiness Gate & 6-point editorial invariant validation (Complete/Frozen).
- **PUBLICATION-1:** Adaptive Publication Planner, category/topic spacing, Asia/Jakarta jitter (Complete/Frozen).
- **PUBLICATION-2:** Atomic Scheduled Publisher, exactly-once receipts, fail-closed concurrency (Complete/Frozen).
- **PUBLICATION-3:** Crawl/Index Telemetry Feedback, provider-free observer, normalized IndexHealthSignals (Complete/Frozen).

Before any component may operate unattended, **SOAK-0** defines the overarching safety architecture to answer the critical operational question:

> *"Can the complete automation survive restarts, duplicate runs, downtime, stale state, partial failures, and network recovery without creating duplicate articles, phantom plans, or unsafe publications?"*

### Primary Invariants:
1. **Zero Unattended Mutation Until Certified:** `AUTO_PUBLISH = OFF`, `PRODUCTION_CRON_ENABLED = NO`, `MODEL_CALLS = 0`.
2. **Crash & Restart Survival:** Every subsystem must recover deterministically to an auditable checkpoint without data corruption.
3. **No-Work Is Normal:** Zero inventory across any stage must evaluate cleanly as `NO_WORK` without alerts or retry storms.
4. **Defense in Depth:** Global kill switch, circuit breakers, staged activation gates, and downtime catch-up throttles prevent runaway automation.

---

## 2. Runtime Dependency & Supervision Audit

### 2.1. Component Boundary Map

```text
┌─────────────────────────────────────────────────────────────────────────────┐
│                           SUMOPOD / EASYPANEL CONTAINER                     │
│  Path: /opt/data/rancangloka                                                │
│                                                                             │
│  ┌───────────────────────┐   Unix Domain Socket   ┌──────────────────────┐  │
│  │   Bridge Supervisor   │ ─────────────────────► │ Antigravity MCP Svc  │  │
│  │  (bridge-supervisor)  │ ◄───────────────────── │   (FastAPI/Uvicorn)  │  │
│  └───────────────────────┘                        └──────────────────────┘  │
│             │                                                │              │
│             ▼                                                ▼              │
│  ┌───────────────────────┐                        ┌──────────────────────┐  │
│  │   Hermes Pipeline     │ ─── Headless Exec ───► │  Chromium Inspector  │  │
│  │ (rl_orchestrator_core)│                        │  (Page Inspector)    │  │
│  └───────────────────────┘                        └──────────────────────┘  │
│             │                                                               │
│             ▼                                                               │
│  ┌───────────────────────┐                                                  │
│  │  Local Outbox Engine  │                                                  │
│  │  (outbox.db, SQLite)  │                                                  │
│  └───────────────────────┘                                                  │
└───────────────────┬─────────────────────────────────────────────────────────┘
                    │ Signed M2M HTTPS (/api/internal/v1/hermes-ingest)
                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                             CLOUDFLARE EDGE WORKER                          │
│                                                                             │
│  ┌───────────────────────────────────────────────────────────────────────┐  │
│  │                     RancangLoka Astro Core (SSR)                      │  │
│  │  - /api/internal/v1/hermes-ingest (Strict DRAFT persistence)          │  │
│  │  - /api/internal/v1/media/*       (LokaMedia asset ingest)            │  │
│  │  - /api/admin/publication/*       (PUB-0 Gate, PUB-1, PUB-2, PUB-3)   │  │
│  │  - Public Routes: /, /[slug], /post-sitemap.xml                       │  │
│  └───────────────────────────────────────────────────────────────────────┘  │
│             │                                           │                   │
│             ▼                                           ▼                   │
│  ┌───────────────────────┐                     ┌─────────────────────────┐  │
│  │     Cloudflare D1     │                     │      Cloudflare R2      │  │
│  │   (rancangloka_db)    │                     │   (rancangloka-media)   │  │
│  └───────────────────────┘                     └─────────────────────────┘  │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 2.2. Transience & Supervised Process Audit

| Subsystem | Current Process Model | Transience Vulnerability | Target Supervised Architecture |
| :--- | :--- | :--- | :--- |
| **Hermes MCP Bridge** | Manual `nohup uvicorn` command in terminal | Dies on container restart, shell exit, or OOM; leaves orphan PID files | Supervised container service (`bridge-supervisor.py`) launched by container entrypoint |
| **Hermes Orchestrator** | On-demand script invocation (`bin/rancangloka-orchestrator.py`) | Transient terminal dependent; failure mid-job requires manual inspection | Periodic runner supervised with single-instance lock file (`.worker.lock`) |
| **Browser Inspector** | Ephemeral subprocess invocation (`bin/rancangloka-browser-page-inspector.py`) | Zombie Chromium processes on sudden SIGKILL | Process group tracking with clean exit traps |
| **Cloudflare Edge** | Cloudflare Workers serverless runtime | Fully managed, zero maintenance, auto-recovering | Stateless edge compute; relies entirely on D1 transactional persistence |
| **Antigravity Client** | Operator desktop / IDE connection via MCP | Desktop can disconnect at any time without disrupting background tasks | Client decoupled from core pipelines; reads state via MCP on demand |

---

## 3. Hermes Bridge Restart-Safe Supervision

To eliminate reliance on temporary `nohup` sessions in managed container environments (such as SumoPod / Easypanel) without requiring host systemd access:

### 3.1. Supervision Architecture (`/opt/data/rancangloka/antigravity-bridge`)

1. **Dedicated Process Supervisor (`bridge-supervisor.py`):**
   - Implemented in standard Python 3 (zero external daemon dependencies).
   - Monitors the Uvicorn child process; immediately restarts it upon unexpected exit.
   - Implements bounded exponential backoff with jitter (1s, 2s, 5s, 10s, 30s max) if crashes occur repeatedly.
   - Halts after 10 consecutive crash loops within 5 minutes, transitioning to `BLOCKED` state to protect the host container.
2. **POSIX Mutual Exclusion Lock (`bridge.lock`):**
   - Enforces exactly one bridge instance using non-blocking `fcntl.flock(LOCK_EX | LOCK_NB)`.
   - If lock is held, startup aborts safely without corrupting the active instance.
   - Automatically releases lock on OS process termination.
3. **Secret Protection Invariants:**
   - Bridge bearer token stored in `/opt/data/rancangloka/antigravity-bridge/bridge.token` (`0600` permissions).
   - Token is **never passed in command-line arguments** (preventing exposure via `ps aux`).
   - Token is **never logged** to stdout, stderr, or rotating log files.
4. **Lightweight Health Endpoint:**
   - `GET /health` returns `{ "status": "ok", "uptime_seconds": 1240, "pid": 412, "version": "1.0.0" }`.
   - Accessible without bearer token for local container health probes.
5. **Graceful Shutdown & Drainage:**
   - Traps `SIGTERM` and `SIGINT`.
   - Allows up to 15 seconds for active MCP tool calls to drain before terminating.

---

## 4. Subsystem Recovery Matrices

### 4.1. Editorial Orchestrator Crash Recovery Matrix (ORCH-0)

| Stage Crash Point | Checkpoint Location | Recovery Action | Target State Upon Recovery | Safety Guarantees |
| :--- | :--- | :--- | :--- | :--- |
| **1. Topic Admittance** | `job.json` (QUEUED) | **RETRY** | `TOPIC_ADMITTED` | Re-evaluates cannibalization score against fresh inventory. |
| **2. Research Discovery** | `discovery-run-bundle.json` | **RETRY** | `DISCOVERY_ADMITTED` | Scans candidate sitemaps cleanly; no side-effects. |
| **3. Page Inspection** | `source-pack.json` | **RETRY** | `PAGE_INSPECTED` | Re-fetches web pages via headless Chromium. |
| **4. Evidence Pack** | `evidence-pack.json` | **RESUME / REUSE** | `EVIDENCE_READY` | Evidence pack verified by SHA-256; prevents redundant re-scraping. |
| **5. Article Drafting** | `article-raw.md` | **RETRY** | `WRITING` | Re-generates draft using existing Evidence Pack. |
| **6. Citation & Guards** | `article-resolved.md` | **RETRY** | `VALIDATING` | Re-evaluates citations, contract, and monetary rules deterministically. |
| **7. Outbox Enqueue** | `outbox.db` (`READY_FOR_INGEST`)| **RESUME** | `READY_FOR_INGEST` | Job row in `outbox.db` persists; atomic state transition. |
| **8. Ingest Transport** | HTTPS POST in progress | **RETRY** | `INGESTING` | Signed sender retries with identical `job_id` and `request_id`. |
| **9. Post-Commit Ack Loss**| D1 committed `hermes_receipt` | **RESUME / REUSE** | `DRAFT_CREATED` | CMS detects receipt idempotently; returns existing `d1_article_id`. |
| **10. Media Job Creation**| `media_jobs` in D1 | **RESUME** | `MEDIA_JOB_CREATED` | Enrolls media job or recovers existing `job_id`. |
| **11. WAITING_MEDIA** | D1 Draft + Media Job | **RESUME** | `WAITING_MEDIA` | Pipeline safely halts; awaits operator visual attachment. |

### 4.2. Publication Pipeline Recovery Matrix (PUB-0..PUB-2)

| Failure Scenario | Intercepting Subsystem | Resolution & Recovery Mechanism | Resulting State |
| :--- | :--- | :--- | :--- |
| **Repeated Readiness Eval** | PUBLICATION-0 | Idempotent execution against D1; persists new snapshot without state changes | Unchanged (`READY_TO_SCHEDULE` or blockers preserved) |
| **Duplicate Planner Run** | PUBLICATION-1 | Partial unique index `idx_plans_active_article` blocks duplicate active rows | Idempotent rejection; exactly one active plan per article |
| **Publisher Crash Pre-Claim** | PUBLICATION-2 | Plan remains in `PLANNED`; execution remains in `SCHEDULED` | Claimed on subsequent dispatch cycle |
| **Publisher Crash Mid-Claim** | PUBLICATION-2 | Concurrency lease (`locked_until`) expires after 5 minutes | Reclaimed safely by subsequent worker |
| **Publisher Crash Post-Commit**| PUBLICATION-2 | Atomic D1 transaction has committed article `published` and persisted receipt | Re-invocation discovers committed receipt and returns `PUBLISHED` idempotently |
| **Response Loss Post-Commit**| PUBLICATION-2 | Dispatcher queries receipt by `execution_id` | Recovers receipt, emits success telemetry, avoids duplicate publication |
| **Manual vs Scheduler Race**| PUBLICATION-2 | Atomic SQL guard: `UPDATE articles SET status = 'published' WHERE id = ? AND status = 'draft'` | Exactly one caller succeeds (1 row changed); other caller aborts cleanly |

### 4.3. Feedback Subsystem Recovery Matrix (PUB-3)

| Failure Scenario | Intercepting Subsystem | Resolution & Recovery Mechanism | Resulting State |
| :--- | :--- | :--- | :--- |
| **Empty Inventory (0 Pubs)**| PUBLICATION-3 | Aggregator handles 0 items; produces `REGIME_UNKNOWN` and `HOLD` | `NO_WORK` clean exit; zero fabricated signals |
| **Duplicate Observation** | PUBLICATION-3 | `idx_obs_dedup` unique hash blocks duplicate inserts for same article/day | Idempotent no-op (`created: false`, `isUnchanged: true`) |
| **Observer Mid-Run Crash** | PUBLICATION-3 | Concurrency lease on `publication_feedback_runs` expires in 5 minutes | Next runner recovers cleanly without data loss |
| **External Adapter Outage** | PUBLICATION-3 | `NullTelemetryAdapter` or caught 503 isolates error; preserves `UNKNOWN` | Operates in `REGIME_PARTIAL` with conservative baseline capacity |
| **Stale Telemetry (>72h)** | PUBLICATION-3 | Observation coverage drops below 20%; triggers `REGIME_STALE` | Forces `RECOMMENDATION_HOLD`; blocks capacity expansion |

---

## 5. Formal No-Work Semantics

Under unattended operation, `NO_WORK` is an **explicit, successful operational state**. It occurs when:
1. Orchestrator queue has 0 unfulfilled topics.
2. Discovery engine finds 0 admitted source candidates.
3. CMS has 0 articles in `READY_TO_SCHEDULE`.
4. Planner has 0 planned slots due for scheduling.
5. Publisher dispatcher finds 0 executions where `target_publish_at <= current_time`.
6. Feedback observer finds 0 published articles in the evaluation cohort.

### Operational Invariants for NO_WORK:
- **Zero Alert Generation:** Must not trigger warning or error notifications.
- **Zero Busy-Wait Loops:** Must immediately enter sleep/backoff cycle (minimum 60 seconds).
- **Zero Database Thrashing:** Must not execute mutating `INSERT` or `UPDATE` statements.
- **Zero Provider Cost:** Must not invoke LLMs, external APIs, or web scraping.

---

## 6. Global Automation Control & Kill Switch

### 6.1. Single Enum Control (`GLOBAL_AUTOMATION_MODE`)

Stored in the single-row D1 configuration table `automation_control`:

```sql
CREATE TABLE IF NOT EXISTS automation_control (
    id INTEGER PRIMARY KEY CHECK (id = 1),
    mode TEXT NOT NULL DEFAULT 'OFF',
    kill_switch_engaged INTEGER NOT NULL DEFAULT 0,
    kill_reason TEXT,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_by TEXT NOT NULL DEFAULT 'operator',
    CHECK (mode IN ('OFF', 'OBSERVE_ONLY', 'PLAN_ONLY', 'CONTROLLED', 'UNATTENDED'))
);
```

| Mode | Capability Matrix |
| :--- | :--- |
| `OFF` | **Default.** All automated workers, planners, publishers, and observers are halted. |
| `OBSERVE_ONLY` | Read-only health monitoring and PUBLICATION-3 first-party observations active. Zero planning, zero publishing. |
| `PLAN_ONLY` | Observer active; PUBLICATION-1 planning active. PUBLICATION-2 publisher cannot execute unattended. |
| `CONTROLLED` | Full scheduling active, but publication execution requires explicit operator trigger or manual gate pass. |
| `UNATTENDED` | Full end-to-end pipeline active within activation rate limits and circuit breaker boundaries. |

### 6.2. Global Emergency Kill Switch

- **Engagement:** Operator sets `kill_switch_engaged = 1` via Admin API (`POST /api/admin/system/kill-switch`) or Cloudflare D1 console.
- **Immediate Effect:** All running loops and dispatchers check the kill switch at every stage boundary and abort immediately.
- **Preservation Invariant:**
  - Public website, homepage, and existing published articles remain **100% online**.
  - In-flight claimed publisher execution releases its lease cleanly.
  - In-flight ingest request completes or rolls back atomically without corrupting D1.
  - Audit trail records `KILL_SWITCH_ENGAGED` with operator timestamp and reason.

---

## 7. Staged Activation Protocol

Unattended automation must progress through 6 strictly gated stages. Progressing to the next stage requires meeting deterministic exit criteria:

```text
[STAGE 0: OFF]
       │ (Code freeze, preflight pass)
       ▼
[STAGE 1: OBSERVER]
       │ (10 clean observation runs, 0 errors)
       ▼
[STAGE 2: PLANNER]
       │ (7 days deterministic planning, 0 rogue publishes)
       ▼
[STAGE 3: SCHEDULER SHADOW]
       │ (14 days shadow due selection, 0 false triggers)
       ▼
[STAGE 4: LIMITED UNATTENDED] (1 article/day, manual visual approval)
       │ (First genuine article published & observed cleanly)
       ▼
[STAGE 5: FULL ADAPTIVE UNATTENDED]
```

### Stage Gating Criteria

| Stage | Name | Operating Mode | Entry Precondition | Exit / Promotion Criteria |
| :--- | :--- | :--- | :--- | :--- |
| **0** | **OFF** | `OFF` | Initial deployment | Full test suite PASS (334 tests); schema installed. |
| **1** | **Observer** | `OBSERVE_ONLY` | Stage 0 verified | 10 consecutive clean feedback runs; zero DB corruption. |
| **2** | **Planner** | `PLAN_ONLY` | Stage 1 verified | 7 days of daily plan generation; spacing and jitter verified; zero publications. |
| **3** | **Scheduler Shadow** | `PLAN_ONLY` + Shadow Log | Stage 2 verified | Dispatcher identifies due items in shadow mode; zero unintended publishes. |
| **4** | **Limited Unattended** | `CONTROLLED` | Stage 3 verified | Exactly 1 genuine article published via canonical pipeline; PUB-3 live smoke verified. |
| **5** | **Full Unattended** | `UNATTENDED` | Stage 4 verified | Circuit breakers armed; soak criteria satisfied; executive sign-off. |

---

## 8. Activation Rate Limiting & Catch-Up Burst Protection

### 8.1. Activation Rate Limits (Stage 4 & Early Stage 5)
To safeguard search engine indexing and domain reputation during early automation:
- **Maximum Publishes per Day:** Strict cap of **2 articles / 24 hours** (overriding profile ceiling during activation).
- **Minimum Consecutive Spacing:** Strict minimum of **4.0 hours** between published articles.
- **Serialized Dispatch:** Maximum 1 execution claimed and published at any given moment.

### 8.2. Downtime Catch-Up & Anti-Burst Protection
If the scheduler or container is offline for hours or days, multiple executions will become overdue simultaneously.
**CRITICAL INVARIANT: The system must NEVER burst-publish overdue articles.**

#### Catch-Up Algorithm:
1. When scheduler wakes, it queries all overdue executions (`target_publish_at <= now`).
2. If overdue count $N > 1$:
   - **Pick exactly ONE** execution (FIFO by original target time).
   - Revalidate its readiness, content hash, approval, and media bindings.
   - If valid, execute atomic publication for this single article.
3. **Reschedule remaining $N-1$ executions:**
   - Remaining executions are NOT published immediately.
   - Plans older than 48 hours are transitioned to `SUPERSEDED` and returned to PUBLICATION-1 for clean replanning.
   - Valid executions are rescheduled with full spacing ($\ge 4$ hours apart), spreading backlog safely across future calendar days.

---

## 9. Automated Circuit Breakers

A deterministic circuit breaker pattern protects the production domain from escalating cascading failures:

```text
               ┌───────────────────────────────┐
               │         CLOSED (Normal)       │
               └───────────────────────────────┘
                               │
               Failure Threshold Exceeded (e.g. 3 consecutive 5xx)
                               │
                               ▼
               ┌───────────────────────────────┐
               │        TRIPPED (Halted)       │
               │  - Automation Mode -> OFF     │
               │  - Operator Alert Generated   │
               └───────────────────────────────┘
                               │
               Operator Reset / Diagnostic Pass
                               │
                               ▼
               ┌───────────────────────────────┐
               │     HALF-OPEN (Probe Mode)    │
               │  - Execute exactly 1 article  │
               └───────────────────────────────┘
                     │                   │
                 Probe Fails        Probe Passes
                     │                   │
                     ▼                   ▼
              [ TRIPPED ]          [ CLOSED ]
```

### Circuit Breaker Triggers:
1. **Consecutive Publication Failures:** $\ge 3$ consecutive executions transition to `FAILED`.
2. **Consecutive D1 Database Errors:** $\ge 2$ unhandled database write rejections.
3. **Severe Edge Degradation:** Public 5xx error rate $\ge 2.0\%$ over a rolling 1-hour window.
4. **Canonical URL Collision:** Any duplicate slug or canonical mismatch detected.
5. **Bridge Unavailability:** Hermes MCP bridge fails health checks for $\ge 3$ consecutive polls.
6. **Stale Backlog Surge:** Overdue unexecuted plans exceed 5 items.

---

## 10. Subsystem Health Model

A centralized machine-readable health contract (`GET /api/admin/system/health`):

```json
{
  "timestamp": "2026-09-07T15:00:00.000Z",
  "overall_status": "HEALTHY",
  "automation_mode": "CONTROLLED",
  "kill_switch_engaged": false,
  "circuit_breaker": {
    "state": "CLOSED",
    "failures_recorded": 0
  },
  "subsystems": {
    "hermes_bridge": { "status": "HEALTHY", "latency_ms": 12 },
    "browser_inspector": { "status": "HEALTHY", "instances_active": 0 },
    "outbox_sender": { "status": "NO_WORK", "pending_jobs": 0 },
    "readiness_gate": { "status": "HEALTHY", "evaluated_count": 4 },
    "planner": { "status": "NO_WORK", "active_plans": 0 },
    "publisher": { "status": "NO_WORK", "due_executions": 0 },
    "feedback_observer": { "status": "NO_WORK", "published_articles": 0 }
  }
}
```

*States:* `HEALTHY`, `DEGRADED`, `BLOCKED`, `NO_WORK`, `PAUSED`. (`NO_WORK` evaluates to overall `HEALTHY`).

---

## 11. Consolidated Run Ledger

To provide end-to-end tracing without rewriting underlying subsystem tables, a consolidated read-model view (`v_publication_run_ledger`) correlates entities across all 5 operational phases:

```text
[Topic Input]
    │
    ▼ (orch_job_id)
[Orchestrator Manifest] ──► [Evidence Pack (evidence_hash)]
    │
    ▼ (source_article_id)
[Outbox Job]
    │
    ▼ (request_id, receipt_id)
[Cloudflare D1 Article] (d1_article_id) ──► [LokaMedia Job (mjob_id)]
    │                                              │ (asset_id)
    ▼ (content_hash)                               ▼
[Readiness Snapshot] ◄────────────────── [Editorial Approval]
    │
    ▼ (readiness_id, plan_id)
[Publication Plan]
    │
    ▼ (execution_id)
[Publication Execution]
    │
    ▼ (pub_receipt_id, actual_published_at)
[Publication Receipt]
    │
    ▼ (article_id, canonical_url)
[Feedback Snapshot & Observations] (obs_id)
```

---

## 12. First Genuine Editorial Article Execution Plan

Because production currently holds 0 published articles, the final step of milestone validation (`PUBLICATION3_CONTROLLED_LIVE_OBSERVATION`) was safely deferred.
The first genuine editorial article run will be executed under **supervised human control**:

### Preflight Verification:
1. Editorial topic selected from authentic architectural roadmap.
2. Evidence Pack certified with verifiable Indonesian citations.
3. Content passed all editorial guards: Monetary guard (0 price claims), Contract guard (Takeaways, H1/H2), Citation guard (100% resolved).
4. Article ingested to Cloudflare D1 as `status = 'draft'`.
5. Visual asset generated and bound via LokaMedia Extension (`VALIDATED`).
6. Editor-in-Chief approval recorded in `article_editorial_approvals`.
7. Readiness Gate confirms `READY_TO_SCHEDULE`.
8. Planner creates single `PLANNED` slot.
9. Publisher executes supervised atomic publication $\to$ Article transitions to `published` and receives immutable receipt.
10. **PUBLICATION-3 Live Observation executes against live URL:**
    - Verifies edge HTTP 200.
    - Verifies sitemap membership.
    - Confirms `HTTP200_IS_INDEXED = NO` and `SITEMAP_IS_INDEXED = NO`.
    - Confirms `INDEX_STATE = UNKNOWN`.
    - Resolves and closes `PUBLICATION3_CONTROLLED_LIVE_OBSERVATION = PASS`.

---

## 13. Failure-Injection Soak Verification Matrix

Before unattended automation is authorized, the following controlled failure-injection tests must be executed in local/staging environments:

| Test ID | Injection Description | Expected Resilient Behavior |
| :--- | :--- | :--- |
| **SOAK-T1** | Kill Uvicorn process during active MCP call | Supervisor restarts bridge in $<2$s; in-flight request times out cleanly; client retries safely. |
| **SOAK-T2** | Disconnect network during outbox send | Sender catches error; outbox remains `QUEUED`; retried with same idempotency key. |
| **SOAK-T3** | Simulate crash after D1 publish commit | Publisher re-reads receipt table; returns `PUBLISHED` idempotently; 0 duplicate receipts. |
| **SOAK-T4** | Concurrent duplicate publisher claim | Lease lock denies second worker; first worker completes publication. |
| **SOAK-T5** | Mutate article body after plan created | Publisher preflight detects `content_hash` mismatch; halts with `BLOCKED`; 0 publications. |
| **SOAK-T6** | Disconnect Search Console telemetry | Feedback engine operates on first-party data; preserves `UNKNOWN`; planner stays conservative. |
| **SOAK-T7** | Simulate 72h scheduler downtime with 5 overdue items | Dispatcher publishes exactly 1 item; remaining 4 rescheduled $\ge 4$h apart; 0 burst publishes. |
| **SOAK-T8** | Engage Kill Switch mid-pipeline | All executing loops halt at next stage boundary; public site remains 100% operational. |
| **SOAK-T9** | Inject 3 consecutive 500 errors | Circuit breaker trips to `TRIPPED`; automation mode reverts to `OFF`; alerts generated. |
| **SOAK-T10**| Empty inventory test | Full cycle runs with 0 articles; exits with `NO_WORK`; 0 DB writes, 0 errors. |

### Soak Certification Success Criteria:
- **10 consecutive clean automated test cycles** passing all 10 failure-injection tests.
- **Zero duplicate logical records** created across all runs.
- **Zero secret leaks** detected in process arguments, logs, or JSON telemetry payloads.
- **Zero unexpected production mutations**.

---

## 14. Cron Activation Precondition Gate

Production Cloudflare Cron (`triggers.crons`) and unattended scheduler activation remain **physically and architecturally blocked** until:

```text
[X] ORCH-0 Orchestrator Design Complete
[X] PUBLICATION-0 Readiness Gate Complete & Frozen
[X] PUBLICATION-1 Adaptive Planner Complete & Frozen
[X] PUBLICATION-2 Scheduled Publisher Complete & Frozen
[X] PUBLICATION-3 Implementation & Production Installation Complete
[ ] SOAK-0 Architecture Approved (Current Step)
[ ] Hermes Bridge Supervisor Deployed & Restart-Tested
[ ] Failure-Injection Soak Test Suite Passed (10/10 tests)
[ ] First Genuine Editorial Article Published via Supervised Pipeline
[ ] PUBLICATION-3 Live Observation Verified on Live Article
[ ] Global Kill Switch & Circuit Breakers Operational in Production
[ ] Explicit Executive Sign-Off for Stage 4 Activation
```

Until all preconditions are satisfied:
`AUTO_PUBLISH = OFF`  
`PRODUCTION_CRON_ENABLED = NO`  
`MODEL_CALLS = 0`  
