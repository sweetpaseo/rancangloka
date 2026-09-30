# 🛰️ HERMES-MC-0: Hermes Mission Control — Capability & Data Discovery

> **Document Version:** 1.0.0  
> **Milestone:** HERMES-MC-0  
> **Status:** APPROVED / DISCOVERY COMPLETE  
> **Execution Mode:** READ-ONLY DISCOVERY & ARCHITECTURE MAPPING  
> **Date:** 2026-09-30  
> **Baseline Commit:** `785fccb8d522d29954c49ab3ae662b74bbd92ad9`  
> **Active Branch:** `feat/jev-lokamedia-integration`  

---

## 1. Executive Summary

Milestone **HERMES-MC-0** establishes the factual inventory and structural mapping of all real operational data, control surfaces, event streams, tasks, schedulers, and agent concepts across:
1. **RancangLoka Production Edge** (`rancangloka-astro/` on Cloudflare Workers, D1 SQLite, and R2 Storage)
2. **Hermes AI Editorial Container** (`/opt/data/rancangloka` on SumoPod daemon, running Python 3 and Node.js)
3. **TypeSafe Jev Decision Engine** (`src/lib/decision/` in shadow mode via OpenRouter API)
4. **Safety & Publication Engine** (`src/lib/publication/` and `src/lib/safety/`)
5. **LokaMedia Engine** (`src/lib/media/`, media worker gate, device auth lifecycle)
6. **Background Schedulers & Daemons** (Cloudflare Cron Triggers + Hermes Host Polling Daemon)

This discovery explicitly prohibits fabricated state, premature UI implementation, or unverified claims. All findings herein derive from active codebase audit, live database schema inspection, and container environment interrogation.

---

## 2. Workspace & System Architecture

```
┌────────────────────────────────────────────────────────────────────────┐
│                        RANCANGLOKA SYSTEMS                             │
│  Astro SSR (Edge Workers) • D1 SQLite Database • Cloudflare R2 Bucket  │
│  Publication Safety Envelopes • Kill Switch • Circuit Breakers         │
└───────────────────────────────────┬────────────────────────────────────┘
                                    │
                       HTTPS Ingest │ HMAC Signed Payloads
                       M2M APIs     │ Device Tokens (Bearer)
                                    ▼
┌────────────────────────────────────────────────────────────────────────┐
│                      HERMES CONTAINER ENVIRONMENT                      │
│  Path: /opt/data/rancangloka (SumoPod Host, s6-overlay init)           │
│  Runtime: Python 3.11 virtualenv + Node.js v26.5.1                     │
│  Model Engine: /opt/hermes/bin/hermes invoking GPT-5.6 Luna           │
│  Scheduler Daemon: bin/rancangloka-scheduler.py (120s cycle)           │
│  Durable Outbox: outbox/outbox.db (SQLite) + receipts/                 │
└───────────────────────────────────┬────────────────────────────────────┘
                                    │
                         MCP Bridge │ rancangloka-hermes
                         (JSON-RPC) │ Token-authenticated loopback
                                    ▼
┌────────────────────────────────────────────────────────────────────────┐
│                  ANTIGRAVITY IDE / OPERATOR WORKSPACE                  │
│  Master Workspace: c:\Users\Fanto\Desktop\antigravity\rancangloka       │
│  Primary Active Repo: rancangloka-astro/                               │
│  Mission Control Target: /admin/mission-control (Admin Edge Surface)   │
└────────────────────────────────────────────────────────────────────────┘
```

### 2.1. System Inventory
* **RancangLoka Web & Edge:**
  * Location: `rancangloka-astro/`
  * Stack: Astro v7.3.3 SSR, Cloudflare Workers runtime (`@astrojs/cloudflare`), Tailwind CSS, Lucide Icons (`@lucide/astro`).
  * Edge Database: Cloudflare D1 (23 formal migrations covering articles, ingest receipts, media jobs/devices/assets, publication plans/executions, automation audit, and decision telemetry).
* **Hermes Autonomous Container:**
  * Location: `/opt/data/rancangloka` on remote host.
  * Entry CLI: `/opt/hermes/bin/hermes`
  * Tool Bridge: `antigravity-bridge/rancangloka_mcp.py` exposing MCP tools over authenticated HTTP transport.
* **OpenCode:**
  * Result: **NOT FOUND** in workspace. No OpenCode daemons, configs, or adapters exist.
* **External Channels (Telegram/Slack/Discord):**
  * Result: **NOT FOUND / NOT CONNECTED**. Social share bars exist in web UI, and Telegram was documented in exploratory notes (`facebook auto post`), but no active bots or webhook bridges currently exist.

---

## 3. Hermes Capability Matrix

| Capability Domain | Status | Source Evidence | Architectural Classification & Notes |
| :--- | :--- | :--- | :--- |
| **Agent / Role Model** | `EXISTS_PARTIAL` | `bin/rancangloka-fasttrack-sprint4.py`, `context/EDITORIAL_DNA.md` | Hermes executes as a deterministic procedural pipeline with specialized functional roles (`Planner`, `Evidence Compiler`, `Writer`, `QA Evaluator`, `Outbox Dispatcher`), rather than long-running autonomous agent daemons. |
| **Task / Job Model** | `EXISTS_AND_USABLE` | `state/ORCHESTRATOR_ARCHITECTURE.md`, `outbox/outbox.db`, `receipts/` | Formal task entity model exists with stable IDs (`orch_*`, `art_*`, `job_*`, `req_*`, `d1_article_id`, `mjob_*`). Checkpoint states are atomically written to `state.json`. |
| **Activity & Events** | `EXISTS_AND_USABLE` | `work/orch/<job_id>/events.jsonl`, `logs/scheduler-heartbeat.json`, `rancangloka-astro` D1 tables | Transition journals exist per job (`events.jsonl`) with ISO timestamps, stage names, hashes, and retry counts. D1 provides transactional event logs (`media_job_events`, `circuit_breaker_events`, `automation_control_audit`). |
| **Session Model** | `EXISTS_PARTIAL` | `work/test-hermes-usage.json` (`session_id`) | Hermes CLI issues execution-scoped session IDs (e.g. `20260908_010343_0f872d`) for token accounting. Persistent interactive conversational sessions per agent do NOT exist. |
| **Background Scheduler** | `EXISTS_AND_USABLE` | `bin/rancangloka-scheduler.py`, `logs/scheduler-heartbeat.json` | Active background daemon runs in container on a 120s polling loop with 15s initial delay, logging heartbeats with schema version, status, and due jobs. Cloudflare crons log to `publication_cron_runs`. |
| **Memory & Knowledge** | `EXISTS_AND_USABLE` | `context/CORE_CONTEXT.md`, `context/EDITORIAL_DNA.md`, `context/trusted-sources.json`, `state/publication-inventory.json` | Persistent knowledge resides in markdown context specs and local JSON registries. Transient state resides in `work/` and `backups/`. |
| **Tool Execution Gate** | `EXISTS_AND_USABLE` | `antigravity-bridge/rancangloka_mcp.py` (`DEV_TASKS`, `GUARDS`) | Allowlisted execution gate restricts commands to predefined routines (`fasttrack_writer`, `phase_b_browser_smoke`, etc.). Protected files (`rl_outbox_core.py`, `rancangloka-sender.py`, etc.) are strictly immutable over bridge. |
| **OpenCode Integration** | `NOT_FOUND` | Full workspace grep | No OpenCode runtime, configuration, or API hooks exist. |
| **External Chat Channel** | `NOT_FOUND` | Full workspace grep | No Telegram, Discord, or Slack bot daemons are connected. |

---

## 4. RancangLoka Operational Signals Inventory

The following real operational signals are available today directly from Cloudflare D1, R2, and edge APIs:

| Subsystem | Signal Name | Source (Table / API / File) | Nature | Mission Control Use |
| :--- | :--- | :--- | :--- | :--- |
| **Publication** | `automation_mode` | D1 `automation_control.mode` | Real-time | Displays global capability mode (`OFF`, `OBSERVE_ONLY`, `PLAN_ONLY`, `CONTROLLED`, `UNATTENDED`). |
| **Publication** | `kill_switch_engaged` | D1 `automation_control.kill_switch_engaged` | Real-time | Emergency banner and master state indicator in MC Header. |
| **Publication** | `circuit_breaker_state` | D1 `circuit_breakers.state` | Real-time | Operational status badge (`CLOSED`, `OPEN`, `HALF_OPEN`) per subsystem. |
| **Publication** | `publication_plans` | D1 `article_publication_plans` | Real-time / Historical | Kanban calendar of planned vs executed publication windows. |
| **Publication** | `execution_receipts` | D1 `publication_execution_receipts` | Historical / Audit | Verifiable proof of atomic article release with signature hashes. |
| **Publication** | `cron_observability` | D1 `publication_cron_runs` | Historical | Telemetry graph of scheduler invocations, errors, and runtimes. |
| **JEV Decision** | `observation_id` | D1 `decision_observations.observation_id` | Real-time / Stream | Unique identifier for each shadow decision request. |
| **JEV Decision** | `provider_status` | D1 `decision_observations.provider_status` | Real-time | Health of OpenRouter upstream connection (`SUCCESS`, `FALLBACK`). |
| **JEV Decision** | `authoritative_vs_jev` | D1 `decision_outcomes` | Historical | Disagreement matrix between deterministic rules and Jev advice. |
| **JEV Decision** | `decision_latency_ms` | D1 `decision_observations.latency_ms` | Real-time metric | Upstream API performance and timeout telemetry. |
| **Media Engine** | `worker_effective_state`| Edge API `/api/internal/v1/media/jobs/run-next` | Real-time | Returns `MEDIA_WORKER_DISABLED` or active execution state. |
| **Media Engine** | `media_jobs_queue` | D1 `media_jobs` | Real-time | Task board of image generation requests (`PENDING`, `IN_PROGRESS`, `ATTACHED`). |
| **Media Engine** | `stage_retries` | D1 `media_jobs.attempt_count`, `retry_budget` | Real-time | Visual retry count and health indicator on Media department cards. |
| **Media Engine** | `device_lifecycle` | D1 `media_devices` | Real-time | Enrolled machine credentials and last active timestamp (`last_used_at`). |
| **Media Engine** | `media_job_events` | D1 `media_job_events` | Real-time feed | Live activity stream of asset generation lifecycle. |
| **Articles** | `article_workflow_state`| D1 `articles.status` | Real-time | Canonical state (`draft`, `scheduled`, `published`, `archived`). |
| **Articles** | `human_approvals` | D1 `article_editorial_approvals` | Real-time | Chief Editor signoff status, approver identity, and approved content hash. |
| **Articles** | `ingest_receipts` | D1 `article_ingest_receipts` | Historical | Ingestion lineage linking Hermes `source_article_id` to D1 `article_id`. |
| **Hermes Daemon** | `scheduler_heartbeat` | File `logs/scheduler-heartbeat.json` | Real-time (<120s) | Proves container daemon liveness (`sender_status`, `idle` vs `due_job_detected`). |
| **Hermes Daemon** | `outbox_queue_depth` | MCP `outbox_status` / SQLite `outbox/outbox.db`| Real-time | Pending payload count (`QUEUED`, `SENDING`, `DEAD_LETTER`, `ACKNOWLEDGED`). |

---

## 5. Named Staff Feasibility Analysis

The canonical roadmap defines a human-friendly AI staff model to elevate machine processes into approachable virtual team members for the operator (e.g. `Joko`, `Dewi`, `Budi`).

### 5.1. Core Invariants & Separation of Identity
1. **Stable Machine Identity:** The underlying execution engine, databases, and logs strictly use immutable machine identifiers:
   * `content_writer_primary`
   * `evidence_researcher_lead`
   * `editorial_chief_gate`
   * `lokamedia_worker_primary`
   * `publication_dispatcher_core`
   * `telemetry_observer_jev`
2. **Mission Control Presentation Profile:** Human display names exist **STRICTLY** as a presentation-layer overlay inside Mission Control.
   ```typescript
   interface StaffPresentationProfile {
     agent_id: string;          // Immutable machine key (e.g. "content_writer_primary")
     display_name: string;      // Human label (e.g. "Joko")
     role_title: string;        // Editorial title (e.g. "Lead Architectural Writer")
     department_id: string;     // Department key (e.g. "editorial")
     avatar_sprite: string;     // Pixel art sprite identifier (e.g. "sprite_writer_joko")
     bio_summary: string;       // Contextual persona description
   }
   ```
3. **Answers to Architectural Feasibility Questions:**
   * **Can display names exist safely only in Mission Control?** **YES.** Display names are purely visual descriptors and must never be written into D1 foreign keys, ingest signatures, or outbox jobs.
   * **Where should this registry live?** In the Mission Control configuration layer (`rancangloka-astro/src/lib/mission-control/staff-registry.ts`) or seeded as a read-only metadata table `mc_staff_roster`.
   * **Should names ever become execution IDs?** **NO.** Under no circumstances should `Joko` become a foreign key or process parameter.
   * **Can multiple named staff map to one underlying capability?** **YES.** For example, `Budi` (Senior Drafter) and `Dewi` (Technical Fact-Checker) can both invoke the Hermes editorial engine with distinct prompt templates or guard configurations.
   * **Can one underlying agent represent multiple roles safely?** **YES**, provided that task assignment and audit events record both the `agent_id` and the specific `role_context`.

---

## 6. Department Ownership Model

To prevent sprawling unstructured task lists, Mission Control organizes capabilities into 7 structured departments:

```
┌────────────────────────────────────────────────────────────────────────┐
│                        MISSION CONTROL DEPARTMENTS                     │
├───────────────────┬───────────────────┬────────────────────────────────┤
│ 1. Editorial      │ 2. Research & Lab │ 3. SEO & Evidence              │
│    (Drafting/QA)  │    (Fact-checking)│    (Sitemaps/Citations)        │
├───────────────────┼───────────────────┼────────────────────────────────┤
│ 4. Media Ops      │ 5. Publication    │ 6. Engineering & Telemetry     │
│    (LokaMedia/R2) │    (Safety Gates) │    (JEV Shadow / D1 Health)    │
├───────────────────┴───────────────────┴────────────────────────────────┤
│ 7. Social Distribution (External Syndication / Parallel Track)         │
└────────────────────────────────────────────────────────────────────────┘
```

### 6.1. Deterministic Assignment Strategy
* **Recommendation:** **Explicit Registry Metadata + Task Type Mapping**.
* **Rule:** An activity or task belongs to a department based on its canonical entity prefix and task type:
  * `orch_*` & `art_*` (stages `PLANNING`, `WRITING`, `QA`) → **Editorial Department**
  * `rqp_*` & browser discovery stages → **Research & Lab**
  * `citation_*` & sitemap scans → **SEO & Evidence**
  * `mjob_*` & `ast_*` → **Media Operations Department**
  * `publication_plans`, `execution_receipts`, `circuit_breakers` → **Publication Operations**
  * `decision_observations`, `d1_metrics`, `scheduler_heartbeat` → **Engineering & Telemetry**
  * `social_*` → **Social Distribution Department**

---

## 7. Pixel Office Visual State Feasibility

The Pixel Office visual simulation requires mapping real operational signals to retro 2D pixel-art character states without fabricating activity.

### 7.1. State Machine & Signal Derivation

| Pixel State | Backing Real Signal | Freshness / Timeout Rule | Confidence | Fallback on Uncertainty |
| :--- | :--- | :--- | :--- | :--- |
| **Working** | Active task running: `mjob.status = 'IN_PROGRESS'` with unexpired lease, OR `work/orch/<job_id>/job.lock` held. | Lease expiry timestamp or task update within <120s. | High | If lease expires without update, transition to `Unknown` or `Blocked`. |
| **Idle** | Daemon/Worker online, zero active tasks: `outbox_queue_depth = 0`, `logs/scheduler-heartbeat.json` recent. | Heartbeat timestamp < 300s old. | High | If heartbeat > 300s old, transition to `Offline`. |
| **Reviewing** | Article in `READY_FOR_REVIEW`, or D1 `article_editorial_approvals` pending Chief Editor signoff. | Verified against D1 table `article_editorial_approvals`. | High | Immediate transition upon approval completion. |
| **Collaborating** | Cross-boundary handoff active: Outbox sender dispatching signed payload to Cloudflare Ingest (`status = 'SENDING'`). | Ingestion window (<60s). | High | Reverts to `Idle` or `Working` upon HTTP receipt. |
| **Blocked / Warning**| System circuit breaker `OPEN`, task in `FAILED`, retry exhausted (`attempt_count >= retry_budget`), or kill switch `ON`. | Real-time flag in D1 / orchestrator state. | High | Stays in `Blocked` until explicit retry or operator resolution. |
| **Offline** | Heartbeat timestamp > 600s old, or subsystem explicitly disabled (`automation_mode = 'OFF'` or `media_worker = 'DISABLED'`). | Verified against D1 `settings` or heartbeat age. | High | Character sprite dims or rests in breakroom. |
| **Unknown** | Disconnected sensor, corrupted state file, or missing telemetry. | Signal age > timeout and no heartbeat. | High | **First-class state.** Render neutral diagnostic badge; never fake activity. |

---

## 8. Direct Staff Chat Feasibility (HERMES-MC-5 Preview)

* **Evaluation:** Can an operator select a staff member (e.g. `Joko`) and send an instruction (e.g. *"Review Article 8 focusing on thermal claims"* )?
* **Verdict:**
  $$\mathbf{CAN\_OPERATOR\_CHAT\_WITH\_NAMED\_STAFF\_TODAY} = \mathbf{PARTIAL}$$
* **Technical Explanation:**
  1. **What Works Today:** The MCP bridge supports allowlisted task execution (`run_dev_task`, `fasttrack_writer_preflight`) and parameter injection via structured JSON STDIN.
  2. **What Is Missing:** Hermes is currently a command-line pipeline execution engine, not an open-ended conversational WebSocket server with session memory per agent persona.
  3. **Safe Future Architecture for MC-5:**
     $$\text{Operator Chat in MC} \longrightarrow \text{Operator Instruction Queue in D1} \longrightarrow \text{Hermes Task Dispatcher} \longrightarrow \text{Target Pipeline Run}$$
     This treats operator prompts as structured command inputs to canonical pipeline scripts (`--prompt`, `--focus`), preserving complete traceability and fail-safe boundaries.

---

## 9. Anomaly & Staff Escalation Feasibility (HERMES-MC-6 Preview)

Operational failures can be automatically attributed to specific departments and staff personas using existing error classes.

### 9.1. Canonical Normalized Anomaly Schema
```typescript
interface NormalizedAnomaly {
  event_id: string;               // Unique anomaly UUID (e.g. "anom_9a8b7c...")
  timestamp: string;              // ISO-8601 UTC timestamp
  severity: "INFO" | "WARNING" | "CRITICAL" | "FATAL";
  source_system: "HERMES_CONTAINER" | "RANCANGLOKA_EDGE" | "D1_DATABASE" | "OPENROUTER_JEV";
  department: "editorial" | "research" | "seo" | "media" | "publication" | "engineering";
  agent_id: string;               // Responsible machine agent (e.g. "lokamedia_worker_primary")
  task_id: string | null;         // Associated job or article ID
  error_class: string;            // Machine error code (e.g. "RETRY_BUDGET_EXHAUSTED", "CIRCUIT_BREAKER_OPEN")
  summary: string;                // Concise Indonesian / English explanation
  retryable: boolean;             // Whether system can retry automatically
  operator_action_required: boolean; // Requires human intervention
  diagnostic_reference: string;  // Path to log file, D1 table, or receipt ID
}
```

### 9.2. Existing Error Signals Ready for Normalization
* Media Worker: `MEDIA_WORKER_DISABLED`, `TOKEN_REVOKED`, `STAGE_RETRY_EXHAUSTED`.
* Publication Engine: `AUTOMATION_MODE_OFF`, `CIRCUIT_BREAKER_TRIPPED`, `FIRST_ARTICLE_GATE_FAILED`.
* Decision Engine: `OPENROUTER_AUTH_FAILED`, `JEV_FALLBACK_ENGAGED`, `LATENCY_THRESHOLD_EXCEEDED`.
* Outbox Sender: `HMAC_SIGNATURE_MISMATCH`, `DEAD_LETTER_JOB`, `TIMEOUT_DURING_INGEST`.

---

## 10. Mission Control Access & Hosting Architecture

We evaluated four possible hosting topologies for Mission Control:
* **Option A: Inside RancangLoka `/admin/mission-control`** (Edge SSR on Cloudflare).
* **Option B: Separate Web Application / Repository**.
* **Option C: Hermes Container Local Dashboard** (Local HTTP server in `/opt/data`).
* **Option D: Hybrid Edge-Container Architecture**.

### 10.1. Recommendation: Option A (Edge Admin Integration with Container Telemetry Adapter)
* **Rationale:**
  1. **Unified Authentication:** Utilizes RancangLoka's existing PBKDF2 operator session authentication (`admin_session` cookie). No new auth silos or exposed ports.
  2. **Zero-Latency D1 Access:** Direct native binding to Cloudflare D1 for real-time reads of articles, media jobs, publication plans, and audit trails.
  3. **Resilience When Hermes Host is Offline:** The operator dashboard remains fully accessible even if the remote Sumopod container or network bridge experiences downtime.
  4. **Strict Control Plane Decoupling:** Mission Control queries read-models from D1; command dispatches to Hermes route through authenticated, rate-limited edge endpoints.

---

## 11. Data Transport Architecture

* **Observability Plane (Read-Only):**
  * Polling or Server-Sent Events (SSE) from edge endpoints (`GET /api/admin/mc/stream` or standard 5-second HTTP polling).
  * Direct D1 queries return aggregated health, active jobs, and recent audit records in <50ms.
  * **No raw WebSocket required:** WebSocket introduces unnecessary connection management complexity on serverless edge runtimes without delivering tangible user-facing value over SSE / fast HTTP polling.
* **Control Plane (Mutations & Instructions):**
  * Standard authenticated HTTP `POST` endpoints with CSRF protection and audit logging into D1 `automation_control_audit`.

---

## 12. Authority Boundaries & RBAC Model

| Authority Level | Permitted Actions | Existing Mapped Controls |
| :--- | :--- | :--- |
| **`READ_ONLY`** | View dashboards, inspect agent cards, monitor tasks, view logs. | Viewing `/admin/mission-control`, reading D1 telemetry, checking outbox status. |
| **`OPERATOR_COMMAND`** | Request article revision, re-run preflight validation, attach media prompt. | Running `fasttrack_writer_preflight`, creating media jobs, queueing draft review. |
| **`ADMIN_CONTROL`** | Register/revoke media devices, reset circuit breakers, toggle shadow mode. | `DELETE /api/internal/v1/media/devices/[id]`, updating circuit breaker state in D1. |
| **`DANGEROUS_PRODUCTION`** | Enable unattended auto-publish, bypass first-article gate, engage/disengage kill switch. | Modifying `automation_control.mode`, toggling `kill_switch_engaged`. Requires confirmation modal. |

---

## 13. Canonical Data Contract Draft

Below are the canonical Mission Control data structures, classified by current availability:

### 13.1. Agent Entity
* `agent_id`: `AVAILABLE_NOW` (from machine role mappings)
* `display_name`: `REQUIRES_IMPLEMENTATION` (presentation registry)
* `role_title`: `REQUIRES_IMPLEMENTATION` (presentation registry)
* `department_id`: `DERIVABLE` (from functional domain)
* `current_state`: `DERIVABLE` (from active task status + daemon heartbeat)
* `current_task_id`: `DERIVABLE` (from D1 `media_jobs` / outbox active job)
* `last_active_at`: `AVAILABLE_NOW` (from heartbeat or D1 timestamp)

### 13.2. Department Entity
* `department_id`: `DERIVABLE` (from 7-department model)
* `name`: `REQUIRES_IMPLEMENTATION` (metadata string)
* `health_status`: `DERIVABLE` (from circuit breaker + active anomalies)
* `active_task_count`: `AVAILABLE_NOW` (from D1 query counts)
* `assigned_staff_ids`: `REQUIRES_IMPLEMENTATION` (staff registry)

### 13.3. Task Entity
* `task_id`: `AVAILABLE_NOW` (`orch_*`, `mjob_*`, `art_*`)
* `title`: `AVAILABLE_NOW` (article title, media prompt)
* `department_id`: `DERIVABLE` (from task type)
* `owner_agent_id`: `DERIVABLE` (from task stage)
* `status`: `AVAILABLE_NOW` (from D1 status columns)
* `created_at`: `AVAILABLE_NOW` (ISO timestamp)
* `started_at`: `AVAILABLE_NOW` (ISO timestamp)
* `completed_at`: `AVAILABLE_NOW` (ISO timestamp)
* `retry_count`: `AVAILABLE_NOW` (attempt count column)
* `error_code`: `AVAILABLE_NOW` (failure code column)

### 13.4. ActivityEvent Entity
* `event_id`: `AVAILABLE_NOW` (from event tables or UUID)
* `timestamp`: `AVAILABLE_NOW` (ISO-8601 UTC)
* `actor_agent_id`: `DERIVABLE` (from system/user signature)
* `department_id`: `DERIVABLE` (from source system)
* `event_type`: `AVAILABLE_NOW` (e.g. `INGEST_CREATED`, `CIRCUIT_BREAKER_TRIPPED`)
* `severity`: `DERIVABLE` (mapped from error class)
* `summary`: `AVAILABLE_NOW` (human-readable log message)

### 13.5. SystemHealth Entity
* `automation_mode`: `AVAILABLE_NOW` (D1 `automation_control.mode`)
* `kill_switch`: `AVAILABLE_NOW` (D1 `automation_control.kill_switch_engaged`)
* `media_worker_gate`: `AVAILABLE_NOW` (API returns `MEDIA_WORKER_DISABLED`)
* `jev_mode`: `AVAILABLE_NOW` (`shadow`)
* `hermes_daemon_liveness`: `AVAILABLE_NOW` (Heartbeat file <120s old)
* `circuit_breakers`: `AVAILABLE_NOW` (D1 `circuit_breakers` table)

---

## 14. HERMES-MC-1 Readiness Assessment

* **Status:** **`MC1_READINESS = READY`**
* **Prerequisites:** Completed and verified by `HERMES-MC-0` (this audit).
* **Recommended MVP Scope for HERMES-MC-1:**
  1. Route `/admin/mission-control` protected by existing operator session auth.
  2. **System Health Strip:** Live status of Kill Switch, Automation Mode, Media Worker Gate, Jev Shadow Collector, and Circuit Breakers.
  3. **Task & Pipeline Board:** Consolidated view of pending articles, media jobs, and outbox state.
  4. **Activity Feed:** Chronological audit log of recent system events.
  5. **Scheduler Observability Panel:** Next run times, last run outcomes, and daemon heartbeat status.
  6. **Read-Only Invariant:** Strictly observe and display existing state; zero autonomous publishing or production mutations.

---

## 15. Architectural Conclusion

The RancangLoka and Hermes systems possess rich, verifiable operational state across databases, journals, outbox tables, and device registries. No fabrication of state is required to build a truthful, high-fidelity Mission Control dashboard. 

The path to `HERMES-MC-1` is clear, structurally grounded, and fully aligned with the master engineering principles of RancangLoka.
