# 🛰️ Hermes Mission Control & Visual Office Roadmap (HERMES-MC)

## 1. Executive Overview & Purpose

The **HERMES-MC** (Hermes Mission Control) track establishes the operational visibility, management, and interactive command layer above RancangLoka's background systems and autonomous editorial pipelines.

### Architectural Layering & Authority Boundaries

```
[ RancangLoka Systems ]
  (Edge Astro SSR, Cloudflare D1/R2, Publication Engine, Media Queue)
          │
          ▼
[ Hermes Orchestration & Daemon ]
  (AI Lab, Planner, Evidence Compiler, Writer, QA, Guards, State Ledger)
          │
          ▼
[ Hermes Mission Control Core ]
  (Status Registry, Agent Roles, Task Boards, Scheduling, Alerts, Auditing)
          │
          ▼
[ 2D Pixel Office / Visual Office ]
  (Spatial Operational Visualization, Room Positioning, Agent State Rendering)
```

### Core Invariants:
1. **Decoupled Supervisory Layer:** Mission Control is an operational visibility and command layer. It **MUST NOT** replace or duplicate Hermes core orchestration logic.
2. **Zero Fabricated State:** Mission Control and Pixel Office strictly render real, verified system state. If data is absent, pending, or disconnected, it is rendered explicitly as `UNKNOWN` or `NOT_AVAILABLE`. An agent is never animated as "working" without supporting operational task evidence.
3. **Canonical Command Routing:** Operator interactions and instructions directed to staff members in the UI must route through canonical Hermes task execution APIs. Visual representations have zero independent mutation authority.

---

## 2. Macro Roadmap: HERMES-MC-0 through HERMES-MC-8

### HERMES-MC-0 — Capability & Data Discovery
- **Objective:** Audit and map all discoverable operational state across Hermes container, Cloudflare D1 database, publication queues, media worker, and decision ledgers.
- **Scope:**
  - Enumerate data schemas and event sources for: agents, roles, active tasks, execution state, departments, activity streams, errors, anomalies, scheduler, connected channels, memory/knowledge, JEV shadow collector, publication dispatcher, media queue, and social pipelines.
  - Establish read-only discovery contracts without mutating running systems.
  - Non-discoverable states remain strictly classified as `UNKNOWN` / `NOT_AVAILABLE`.
- **Status:** **READY FOR EXECUTION**

### HERMES-MC-1 — Mission Control Core Architecture & Dashboard
- **Objective:** Construct the foundational functional management dashboard before visual spatial office rendering.
- **Target Modules:**
  - Executive Operations Dashboard
  - Agent & Worker Roster
  - Kanban / Task Execution Board
  - Unified Activity & Audit Stream
  - Calendar & Publication Scheduler
  - Memory & Knowledge Artifact Browser
  - System Health & Circuit Breaker Telemetry
- **Prerequisite:** Completed discovery from `HERMES-MC-0`.

### HERMES-MC-2 — Staff Identity & Role Registry
- **Objective:** Establish the human-friendly AI staff identity model with strict separation between machine identity and presentation identity.
- **Identity Model Contract:**
  - `agent_id`: Immutable machine identifier (e.g., `content_writer_primary`, `media_worker_canonical`, `editorial_chief_gate`).
  - `display_name`: Human-friendly presentation label (e.g., `Joko`, `Dewi`, `Budi`).
  - Required fields: `agent_id`, `display_name`, `role`, `department`, `avatar_identity`, `current_state`, `current_task`, `recent_activity`.
- **Invariant:** Presentation names must never be used as runtime foreign keys or execution identifiers.

### HERMES-MC-3 — Departments & Operational State Model
- **Objective:** Organize tasks, queues, and agents into structured, expandable operational departments.
- **Initial Departments:**
  1. *Editorial Department* (Ideation, Drafting, Review, Copyediting)
  2. *Research & Evidence Lab* (Fact-checking, Source Compiling, Regulatory Verification)
  3. *SEO & Distribution* (Sitemaps, Metadata, Internal Links, Canonical Tags)
  4. *Media Operations* (LokaMedia Image Generation, Watermarking, Asset Registration)
  5. *Publication Operations* (Dispatching, Circuit Breakers, Kill Switch, Safety Envelopes)
  6. *Engineering & Telemetry* (Database Health, Edge Runtime, JEV Shadow Collector)
  7. *Social Department* (Multi-channel adaptations, Carousels, Social Posts)
- **Features:** Task ownership mapping, blocker escalation, retry tracking, health states.

### HERMES-MC-4 — Pixel Office V1 (Spatial Operational Visualization)
- **Objective:** Implement the 2D retro pixel-art visual office layout driven 100% by real operational state from MC-0 through MC-3.
- **Initial Spatial Rooms:**
  - `Workspace / Main Office`: Active production desk clusters for operational staff.
  - `Lounge / Breakroom`: Designated area for idle or dormant staff.
- **State-to-Position Mappings:**
  - `Working / Generating` → Positioned at assigned desk with active work sprite.
  - `Reviewing / QA` → Positioned at review podium/station.
  - `Collaborating / Handoff` → Positioned in collaboration or meeting area.
  - `Idle` → Lounge / resting area.
  - `Offline / Dormant` → Dimmed or absent from floor.
  - `Unknown / Degraded` → Explicit neutral indicator.
- **Strict Anti-Slop Rule:** Visual animation without backing state is forbidden.

### HERMES-MC-5 — Direct Staff Interaction & Command Dispatch
- **Objective:** Enable the human operator to select any staff member and issue instructions or task modifications.
- **Interaction Contract:**
  - Selecting an agent opens their detail panel: current task, historical events, active lease, error diagnostics.
  - Instruction input routes directly through canonical Hermes command APIs (`run_dev_task`, `write_handoff`, or internal job queues).
  - Pixel characters act strictly as visual proxies; no direct database mutations from UI.

### HERMES-MC-6 — Alert & Anomaly Escalation System
- **Objective:** Translate low-level infrastructure errors and pipeline blocks into actionable visual alerts tied to responsible departments and staff.
- **Mapped Error Classes:**
  - Media generation / retry exhaustion (`PROVIDER_AUTH_FAILED`, `WATERMARK_FAILED`).
  - Publication safety blocks (`AUTOMATION_MODE_OFF`, rate ceiling hits).
  - Evidence & source pack failures.
  - Scheduler / cron lease timeouts.
  - Social broadcast failures.
- **Visualization:** Staff avatar transitions to `WARNING` or `BLOCKED` with direct link to diagnostic payload, retry count, and safe operator resolution actions.

### HERMES-MC-7 — Dynamic Department Expansion
- **Objective:** Enable new operational capabilities to register as self-describing departments without refactoring the Mission Control core.
- **Registry Architecture:** Modular department manifest describing routes, queues, metrics, and staff roles.

### HERMES-MC-8 — Production Hardening & Operational Gate
- **Objective:** Production-grade security, resiliency, and performance audit before designating Mission Control as the primary operational surface.
- **Requirements:**
  - Operator authentication & RBAC session protection.
  - Strict secret redaction on all event and activity feeds.
  - Reconnection resilience and WebSocket / polling failover.
  - Sub-second UI responsiveness under event spikes.
- **Status:** **[COMPLETED]**

### HERMES-MC-9 — Role & Job Animation Layer
- **Objective:** Deterministic, presentation-only job animation layer for Pixel Office so staff visually reflect real executing tasks without fake work or random movement.
- **Requirements:**
  - Strict mapping: `REAL TASK → CAPABILITY → STAFF → JOB VISUAL STATE → ROLE-SPECIFIC ANIMATION`.
  - Zero fake work: Idle staff remain in Lounge (`IDLE_STANDBY`).
  - Command queue state distinction: `QUEUED` does not animate work; `RUNNING` activates role animation; `COMPLETED` halts animation.
  - Zero schema changes; full accessibility via `prefers-reduced-motion`.
- **Status:** **[COMPLETED]**

---

## 3. Relationship to Parallel Tracks

| Track | Canonical Scope | Interaction with Mission Control |
| :--- | :--- | :--- |
| **`MEDIA-A5.*`** | LokaMedia Engine (QA, Orchestrator, Retry Policy, Edge Worker) | Exposed to MC as the *Media Operations* department. Worker and queue state visualized in real-time. |
| **`JEV-*`** | TypeSafe Decision Platform (Shadow Mode, Calibration, Cost Routing) | Telemetry and disagreement classification streams fed into MC *Engineering & Telemetry* panel. |
| **`PUBLICATION`** | Safety & Execution Engine (Kill Switch, Circuit Breaker, Planner) | Governed via MC *Publication Operations* with direct emergency kill switch visibility. |
| **`SOCIAL-S0+`** | Social Media Automation Pipeline (Adaptation, Carousels, Broadcast) | Developed under its own specification; plugs into MC as the *Social Department* with dedicated staff identities. |

---

## 4. Master Milestone Sequencing

```
1. MEDIA-A5.7-CLOSEOUT   [COMPLETED]
2. HERMES-MC-0           [COMPLETED — Capability & Data Discovery]
3. HERMES-MC-1           [COMPLETED — Mission Control Core]
4. HERMES-MC-2           [COMPLETED — Staff Identity Registry]
5. HERMES-MC-3           [COMPLETED — Departments & Operational State]
6. HERMES-MC-4           [COMPLETED — Pixel Office V1]
7. HERMES-MC-5           [COMPLETED — Direct Staff Interaction & Safe Queue]
8. HERMES-MC-6           [COMPLETED — Alert & Anomaly Escalation]
9. HERMES-MC-7           [COMPLETED — Department Expansion Architecture]
10. HERMES-MC-8          [COMPLETED — Production Hardening & Go-Live]
11. HERMES-MC-9          [COMPLETED — Role & Job Animation Layer]
12. SOCIAL-S0            [COMPLETED — Architecture & Discovery (docs/SOCIAL_S0_ARCHITECTURE_DISCOVERY.md)]
13. SOCIAL-S1            [COMPLETED — Core Domain, Staging Outbox & D1 Schema (docs/SOCIAL_S1_CORE_DOMAIN.md)]
14. SOCIAL-S2            [READY — Mission Control Social Department & Staff Integration (Read-Only/Shadow)]
```
