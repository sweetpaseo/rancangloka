# 🛰️ HERMES-MC-1: RancangLoka Hermes Mission Control Core

> **Document Version:** 1.0.0  
> **Milestone:** HERMES-MC-1  
> **Status:** APPROVED / IMPLEMENTATION COMPLETE  
> **Execution Mode:** READ-ONLY OPERATIONAL COCKPIT  
> **Date:** 2026-09-30  
> **Baseline Commit:** `f2b6d9c`  
> **Active Branch:** `feat/jev-lokamedia-integration`  

---

## 1. Executive Summary

Milestone **HERMES-MC-1** implements the first functional, read-only operational cockpit for RancangLoka and Hermes at `/admin/mission-control`. 

Mission Control aggregates genuine operational signals across the Cloudflare Edge runtime (Astro SSR, Cloudflare D1 SQLite), publication safety engines, media workers, background schedulers, and the TypeSafe Jev shadow decision pipeline into a single information-dense executive dashboard.

### Core Safety Invariants Preserved
* **Read-Only Supervisory Layer:** Mission Control introduces **zero write or mutation paths**. It does not modify database state, execute publication actions, or mutate system configurations.
* **Zero Production Mutation:** `automation_control.mode` remains locked at `OFF`. The emergency kill switch remains in its canonical operational state (`NORMAL`).
* **Media Worker Invariant:** `settings.media_worker_enabled` remains `DISABLED`. Zero jobs are created, claimed, or processed.
* **JEV Zero Authority:** TypeSafe Jev remains in `shadow` mode with zero execution authority.
* **No Fabricated Data:** Zero fake personas, zero synthetic jobs, and zero simulated telemetry. Legitimate zero values (e.g. 0 active devices, 0 pending jobs) are faithfully displayed. Missing or unreachable telemetry is explicitly marked `UNKNOWN` or `NOT_AVAILABLE`.
* **Zero Secret Exposure:** Automatic token and session redaction protects `lkmd_...` bearer tokens, PBKDF2 hashes, session cookies, and private cryptographic material across all views and API payloads.

---

## 2. Architecture & Data Flow

```
┌────────────────────────────────────────────────────────────────────────┐
│                   RANCANGLOKA EDGE CLIENT (BROWSER)                    │
│  Route: /admin/mission-control                                         │
│  UI: Astro SSR + Tailwind CSS + Lucide Icons                           │
│  Security: Authenticated admin_session Cookie                          │
│  Auto-Refresh: Polling interval 30s (Client JS) + Manual Refresh       │
└───────────────────────────────────┬────────────────────────────────────┘
                                    │
                       GET /api/admin/mission-control/state
                                    │
                                    ▼
┌────────────────────────────────────────────────────────────────────────┐
│                     MISSION CONTROL DATA LAYER                         │
│  Path: src/lib/mission-control/                                        │
│  • types.ts      - Unified TypeScript schema and data contracts        │
│  • redact.ts     - Sensitive token & credential sanitizer              │
│  • health.ts     - System health strip & circuit breaker status        │
│  • tasks.ts      - Unified pipeline/task board state aggregator        │
│  • activity.ts   - Chronological multi-source audit event stream       │
│  • scheduler.ts  - Hermes & Cloudflare Cron heartbeat evaluator        │
│  • summaries.ts  - Outbox, Article, Media, and JEV telemetry           │
│  • index.ts      - Master read-only snapshot assembler                 │
└───────────────────────────────────┬────────────────────────────────────┘
                                    │
                    SELECT queries only (Zero INSERT/UPDATE)
                                    │
                                    ▼
┌────────────────────────────────────────────────────────────────────────┐
│                      STORAGE & TELEMETRY SOURCES                       │
│  Cloudflare D1:                                                        │
│  - automation_control & automation_control_audit                       │
│  - circuit_breakers & circuit_breaker_events                           │
│  - settings & media_devices & media_jobs & media_job_events            │
│  - articles & article_editorial_approvals & publication_cron_runs      │
│  - decision_observations                                               │
│  Hermes Host / Environment:                                            │
│  - Environment heartbeat fallback & outbox ingest receipts             │
└────────────────────────────────────────────────────────────────────────┘
```

---

## 3. Component Details & Data Sources

### 3.1. System Health Strip
Located prominently at the top of the interface, providing an instantaneous high-level overview:
* **Publication Automation:** Directly queries `automation_control.mode` (`OFF`, `OBSERVE_ONLY`, `PLAN_ONLY`, `CONTROLLED`, `UNATTENDED`).
* **Emergency Kill Switch:** Reflects `automation_control.kill_switch_engaged`. When engaged, transitions the overall system status to `PAUSED`.
* **Media Worker Gate:** Evaluates runtime environment settings and `settings.media_worker_enabled`. Reports effective status as `DISABLED`.
* **JEV Shadow Mode:** Reads configuration and recent decision observations. Clarifies `shadow` status with prominent `ZERO AUTHORITY` badges.
* **Subsystem Circuit Breakers:** Queries `circuit_breakers` table for `publication`, `media`, and `ingest`. Reports states: `CLOSED` (Healthy), `HALF_OPEN` (Probing), or `OPEN` (Tripped).

### 3.2. Pipeline / Task Board
A structured operational board categorizing canonical entities across valid lifecycle stages:
* **Stages Supported:** `Draft`, `Waiting Media`, `Ready for Review`, `Scheduled`, `Published`, and `Failed`.
* **Data Sources:** Left-joins `articles`, `media_jobs`, and `article_editorial_approvals`.
* **Entity Detail Cards:** Each card displays canonical entity ID, slug/title, subsystem, current stage, retry counts, blocker descriptions, and cross-references (article ID ↔ media job ID).

### 3.3. Activity / Audit Stream
A consolidated chronological feed of recent operational events:
* **Aggregated Tables:**
  - `automation_control_audit` (Mode changes, kill switch activations)
  - `circuit_breaker_events` (Trip, probe, and reset events)
  - `media_job_events` (Worker dispatch attempts, retries, and errors)
  - `publication_cron_runs` (Automated dispatch and soak executions)
  - `decision_observations` (Jev shadow advice and risk scores)
* **Metadata Normalized:** Timestamp, subsystem, event type, severity/status (`info`, `warning`, `error`, `success`), summary message, and entity reference.

### 3.4. Scheduler & Heartbeat Panel
Tracks background automation runners and monitors staleness:
* **Hermes Daemon Heartbeat:** Evaluates interval against canonical thresholds:
  - `HEALTHY`: Heartbeat age $\le 300\text{s}$ (compatible with Hermes 120s polling cycle)
  - `STALE`: Heartbeat age between $301\text{s}$ and $600\text{s}$
  - `OFFLINE`: Heartbeat age $> 600\text{s}$
  - `UNKNOWN`: No heartbeat telemetry available
* **Cloudflare Cron Triggers:** Observes `publication_cron_runs` for scheduled job dispatches, completion status, and execution duration.

### 3.5. Outbox Status
Summarizes durable transport queues from D1 receipts and Hermes outbox telemetry:
* **Metrics:** Counts of `QUEUED`, `SENDING`, `ACKNOWLEDGED`, and `DEAD_LETTER`.
* **Zero State Integrity:** Displays healthy zero counts explicitly without hiding empty queues.

### 3.6. Article Operations Summary
Summarizes CMS lifecycle counts from `articles` and `article_editorial_approvals`:
* Breakdown of articles by status: `Draft`, `Awaiting Review`, `Approved`, `Published`, and `Quarantined`.
* Displays metadata for latest published article and latest editorial approval.

### 3.7. Media Operations Summary
Tracks media subsystem metrics:
* Worker gate status (`DISABLED`).
* Counts for `Pending`, `In Progress`, and `Failed` media jobs.
* Registered active media devices (currently 0 following ephemeral probe revocation in P3A).
* Total managed media assets in Cloudflare R2 / D1 metadata.

### 3.8. JEV Observability Panel
Inspects TypeSafe Jev shadow performance without granting execution rights:
* Latest observation ID, candidate article slug, and timestamp.
* Recommended action (`continue`, `revise`, `human_review`, `stop`).
* Evaluated publication risk (`very_low`, `low`, `medium`, `high`, `critical`).
* Human review recommendation probability (`noul`).
* Evaluator latency in milliseconds.
* Prominent banner affirming: **JEV Shadow Advice != Canonical Authority**.

---

## 4. Refresh Model & Performance

* **Server-Side Rendering (SSR):** Initial navigation to `/admin/mission-control` executes read-only SQL queries on Cloudflare D1 via the Cloudflare Worker runtime.
* **Client-Side Polling:** To respect Cloudflare Worker CPU limits and D1 read quotas, client polling is set to **30 seconds** (adjustable via UI refresh button).
* **Manual Refresh Trigger:** Operators can immediately trigger data re-fetching using the interactive "Perbarui Data" button.
* **Data Freshness Indicators:** Every panel indicates data freshness status (`FRESH`, `STALE`, or `UNKNOWN`) alongside ISO timestamps.

---

## 5. Security & Redaction Boundary

1. **Authentication Enforcement:**
   * Both `/admin/mission-control` and `/api/admin/mission-control/state` require an active, validated `admin_session` cookie verified through `validateAdminSession`.
   * Unauthenticated requests are immediately redirected to `/admin/login` or rejected with HTTP 401 Unauthorized.
2. **Strict Redaction Pipeline (`src/lib/mission-control/redact.ts`):**
   * Device tokens (`lkmd_...`) are masked as `lkmd_...[REDACTED]`.
   * Authorization bearer headers are sanitized to `Bearer [REDACTED]`.
   * Session tokens and cookie parameters are stripped of plaintext values.
   * Private cryptographic keys, secret seeds, and token hashes are excluded from API payloads.

---

## 6. Known Limitations in MC-1

* **Read-Only by Design:** No interactive controls exist for triggering jobs, toggling breakers, or editing articles. All mutations must occur via authorized operator workflows.
* **No Pixel Office:** 2D interactive canvas and spatial agent representations are reserved for MC-4.
* **No Direct Staff Chat:** Agent conversation threads and prompt interfaces are reserved for MC-5.
* **No OpenCode Dependency:** Built entirely using native Astro SSR, Tailwind CSS, Lucide icons, and Cloudflare D1 edge bindings.

---

## 7. Future MC-2 Integration Points

1. **Named Staff Identities:** Mapping functional roles (Planner, Evidence Compiler, Writer, QA Evaluator, Outbox Dispatcher) to consistent editorial personas.
2. **Persistent Handoff Traces:** Exposing agent-to-agent artifact passing and evidence pack hashes directly in task cards.
3. **Interactive Supervisory Gates:** Adding audited approval buttons for chief editor intervention while preserving fail-closed defaults.
