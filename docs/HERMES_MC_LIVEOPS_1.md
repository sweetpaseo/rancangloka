# 🛰️ RancangLoka Hermes Mission Control — Live Operations Layer (MC-LIVEOPS-1)

> **Milestone Status:** `IMPLEMENTED`  
> **Target Subsystems:** Hermes Mission Control Core, Staff Registry, Spatial Registry, Pixel Office 2D Engine, Telemetry Router.  
> **Authoritative Route:** `/admin/mission-control/office`, `/api/admin/mission-control/liveops`  
> **Safety Baseline:** `automation_mode = OFF`, `SOCIAL_AUTOMATION = OFF`, `publishingAuthority = 0`, `JEV_MODE = shadow`, `mediaWorker = DISABLED`.

---

## 1. Executive Summary & Intent

The **Live Operations Layer (`MC-LIVEOPS-1`)** bridges canonical system truth from Cloudflare D1 tables, the pipeline task board, and real telemetry into the Pixel Office 2D workplace visualization. 

Prior to this milestone, Pixel Office presented static or scenario-driven positions and animations. `MC-LIVEOPS-1` establishes an uncompromising contract:
> **Pixel Office is a VIEW of system truth, not a simulation of work.**
> It must never invent fake activity just to make the office look busy.

### Core Data Flow:
```
REAL JOB STATE (D1 articles / pipeline cards / heartbeats)
  │
  ▼
TASK OWNERSHIP & PROVENANCE (Machine capability & agent attribution)
  │
  ▼
STAFF OPERATIONAL STATE (WORKING | REVIEWING | RESEARCHING | WAITING | IDLE | BLOCKED | OFFLINE)
  │
  ▼
SPATIAL LOCATION & ROOM (Workstation console vs. Executive Lounge)
  │
  ▼
JOB-SPECIFIC ANIMATION (Typing | Reading | Browsing | Standby | Warning)
  │
  ▼
CANONICAL HANDOFF & TRANSITION (Monotonic progression through pipeline)
  │
  ▼
COMPLETION / STANDBY RETURN (Automatic return to Lounge upon task completion)
```

---

## 2. Canonical Staff & Operational Mapping

The system supports **7 canonical personas** mapped strictly to their real tasks:

| Staff Member | Machine Agent ID | Canonical Role | Department | Active Workstation | Lounge Standby Seat | Active Animation | Baseline / Idle Behavior |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **Joko** | `content_writer_primary` | Editorial / Writer | Editorial (`editorial`) | `editorial_writer_desk` | `lounge_seat_1` | `ARTICLE_TYPING` / `ARTICLE_REWRITE` | Standby in Lounge (`IDLE_STANDBY`) |
| **Rina** | `editorial_qa_primary` | Editorial QA / Editor | Editorial (`editorial`) | `editorial_review_desk` | `lounge_seat_3` | `QA_REVIEW` / `QA_CHECKLIST` | Standby in Lounge (`IDLE_STANDBY`) |
| **Irwan** | `evidence_researcher_lead` | Research & Evidence Lead | Research & Evidence (`research_evidence`) | `research_main_desk` | `lounge_seat_4` | `RESEARCH_BROWSING` / `EVIDENCE_READING` | Standby in Lounge (`IDLE_STANDBY`) |
| **Budi** | `lokamedia_worker_primary` | Media Operations Lead | Media (`media`) | `media_console` | `media_console` (holding) | `MEDIA_PROCESSING` (only if enabled) | Strictly `OFFLINE_DISABLED` (dimmed) |
| **Sari** | `publication_dispatcher_core` | Publication Operations | Publication (`publication_operations`) | `publication_console` | `lounge_seat_5` | `PUBLICATION_DISPATCH` (active ingest) | Standby in Lounge (`live_status: WAITING`) |
| **Dimas** | `telemetry_observer_jev` | Engineering & Telemetry | Engineering (`engineering_telemetry`) | `operations_console` | `lounge_seat_2` | `SYSTEM_DIAGNOSTIC` / `INCIDENT_ALERT` | Standby in Lounge (`IDLE_STANDBY`) |
| **Jefry** | `management_advisor_jefry` | Management Decision Advisor | Management (`management`) | `management_decision_console` | Stationary at console | `ADVISOR_RECOMMEND_YES / NO / HUMAN_REVIEW` | Stationary at console (0 execution authority) |

---

## 3. Strict Safety Invariants Enforced

1. **`automation_mode = OFF`:** All pipeline tasks stop at `DRAFT` or `scheduled` queue. Sari does **NOT** dispatch articles automatically. When tasks sit in the scheduled queue under automation OFF, Sari's operational state is `IDLE` (live status `WAITING`) resting in the Executive Lounge.
2. **`publishingAuthority = 0`:** Pixel Office and Mission Control APIs have zero authority to publish articles or trigger mutations.
3. **`mediaWorker = DISABLED`:** Budi is strictly locked to `OFFLINE_DISABLED`. The system is forbidden from simulating image generation or visual asset processing when the media worker is disabled.
4. **`JEV_MODE = shadow`:** Jefry / TypeSafe JEV operates purely as a shadow decision advisor. Jefry is stationary at the `management_decision_console` in the Executive Management Chamber (Zone X), providing visual advisory indicators with **ZERO execution authority**.
5. **`SOCIAL_AUTOMATION = OFF`:** Zone S (Social & Distribution Bay) remains unstaffed and physically secured. Maya is unstaffed, and no social jobs or variants are manufactured.
6. **No Random / Ambient Wandering:** Staff movement only occurs upon genuine state transitions or verified handoffs. If no jobs are active, personnel remain stationary at their assigned seats in the Executive Lounge.

---

## 4. End-to-End Workflow Lifecycle Example

Consider the creation and publication lifecycle of article `art-bambu-01` (*"Standar Konstruksi Rangka Bambu Petung SNI 7973"*):

### Phase 1: Research & Evidence Compiling (Irwan)
- **Real Task State:** `stage: researching`, `subsystem: research`.
- **Irwan:** Moves from Lounge to `research_main_desk`.
- **Pixel Office Visualization:** Irwan seated at research console, animation `RESEARCH_BROWSING`, icon 🔍, badge `WORKING`.
- **Other Staff:** Joko, Rina, Sari, Dimas resting in Executive Lounge. Budi dimmed/offline. Jefry observing.

### Phase 2: Handoff to Drafting (Irwan → Joko)
- **Real Task Transition:** `hnd_01: researching → writing`.
- **Irwan:** Task completed. Returns deterministically along Central Hallway to `lounge_seat_4` (`IDLE_STANDBY`).
- **Joko:** Receives task handoff. Walks along Central Hallway to `editorial_writer_desk`.
- **Pixel Office Visualization:** Joko actively typing (`ARTICLE_TYPING`), icon ✍️, badge `WORKING`. Provenance displays Article Title and Task ID.

### Phase 3: Editorial QA Review (Joko → Rina)
- **Real Task Transition:** `hnd_02: writing → editorial_qa`.
- **Joko:** Returns to Lounge (`lounge_seat_1`).
- **Rina:** Walks to `editorial_review_desk` in the Editorial Room.
- **Pixel Office Visualization:** Rina reading manuscript (`QA_REVIEW`), badge `REVIEWING`, evaluating tone of voice and checklist items.
- **Rollback Branch (if rejected):** If Rina rejects the draft, task transitions back to `writing` with `retryCount > 0`. Joko returns to his desk with animation `ARTICLE_REWRITE` (amber indicator), while Rina returns to Lounge.

### Phase 4: Publication Scheduling (Rina → Sari)
- **Real Task Transition:** `hnd_03: editorial_qa → scheduled`.
- **Rina:** Returns to Lounge (`lounge_seat_3`).
- **Sari:** Under `automation_mode = OFF`, the scheduled article enters the target queue without automated publication. Sari's live status transitions to `WAITING`, but she **remains seated in the Executive Lounge** (`lounge_seat_5`). No fake dispatching is animated.
- **Human Approval Dispatch:** Only when an operator issues an authorized manual release does Sari move to `publication_console` with animation `PUBLICATION_DISPATCH` for Cloudflare D1/R2 ingest.

---

## 5. Architectural Additions

### A. Data Layer: `src/lib/mission-control/live-operations.ts`
- `LiveExecutionStatus`: Canonical normalized status (`IDLE`, `ASSIGNED`, `WORKING`, `REVIEWING`, `RESEARCHING`, `WAITING`, `HANDOFF`, `BLOCKED`, `ERROR`, `COMPLETED`, `OFFLINE`).
- `LiveTaskProvenance`: Auditable record connecting task ID, stage, status, department, responsible agent, start timestamp, evidence source, and blocking conditions.
- `LiveStaffOperation`: Full per-agent view model including spatial location, active animation, current task provenance, active handoffs, and active anomalies.
- `deriveLiveStaffOperation`: Deterministic pure function deriving staff operation from snapshot telemetry.
- `getLiveOperationsSnapshot`: Aggregates the 7 canonical personas, summary metrics, and safety invariant validations.

### B. Visual Spatial Layer: Executive Management Chamber (Zone X) in `office.astro`
- Added the Northern Annex (`management_room`) connecting directly down into the North Terminus of the Central Hallway (`hall_north`).
- Placed Jefry at `management_decision_console` with TypeSafe JEV advisory monitor (`SHADOW ADVISORY`), advisory indicators (`ADVISOR_RECOMMEND_YES`, `ADVISOR_RECOMMEND_NO`, `ADVISOR_HUMAN_REVIEW`), and explicit badges confirming zero execution authority.

### C. API Endpoint: `src/pages/api/admin/mission-control/liveops.ts`
- Strictly read-only (`GET` only; non-GET returns `405 Method Not Allowed`).
- Protected by `admin_session` middleware.
- Supports querying full fleet (`/api/admin/mission-control/liveops`) or specific personnel (`?agent_id=content_writer_primary`).

---

## 6. Implementation Status Matrix

| Capability | Status | Notes |
| :--- | :--- | :--- |
| Canonical 7 Staff Live Ops Contract | `IMPLEMENTED` | Joko, Rina, Irwan, Budi, Sari, Dimas, Jefry. |
| Zero Hallucinated Work Invariant | `IMPLEMENTED` | Idle staff default to Lounge; disabled worker stays offline. |
| Scheduled Queue Standby under Automation OFF | `IMPLEMENTED` | Sari evaluates to WAITING in Lounge; no fake publication. |
| Executive Management Chamber (Zone X) | `IMPLEMENTED` | Jefry positioned at console with shadow advisory markers. |
| Job Provenance & Evidence Attribution | `IMPLEMENTED` | Task ID, stage, and blocker reasons explicitly tracked. |
| Blocked & Anomaly Signal Projection | `IMPLEMENTED` | Visual warning markers and blocker conditions visible on desk. |
| Dedicated Read-Only API (`/api/.../liveops`) | `IMPLEMENTED` | GET-only, returns JSON contract with safety invariants. |
| Full Deterministic Test Suite (`test-mission-control-liveops.js`) | `IMPLEMENTED` | 78/78 tests passing (100% clean). |
| Multi-Agent Concurrent Handoff Visualization | `IMPLEMENTED` | Handoffs trigger deterministic sprite journeys across Central Hall. |
| Automated Social Posting | `BLOCKED` | Strictly `OFF`; Meta provider and account configuration deferred. |
| Autonomous JEV Mutating Authority | `BLOCKED` | Strictly forbidden; TypeSafe JEV operates in shadow mode only. |
| Autonomous Production Publishing | `BLOCKED` | Strictly `OFF`; all publishing requires operator approval. |
| Real-time WebSocket Stream for Live Ops | `DEFERRED` | Current 30s polling + manual refresh meets edge SSR requirements. |

---

## 7. Verification Results

All test suites and compilers executed locally with zero errors:

```bash
# 1. Live Operations Layer Test Suite (78 tests)
node scripts/test-mission-control-liveops.js          # 78/78 PASSED

# 2. Complete Mission Control Test Suite (236 tests)
node scripts/test-staff-registry.js                  # 16/16 PASSED
node scripts/test-mission-control-departments.js      # 18/18 PASSED
node scripts/test-mission-control-expansion.js        # 12/12 PASSED
node scripts/test-mission-control-pixel-office.js     # 20/20 PASSED
node scripts/test-mission-control-job-animation.js     # 21/21 PASSED
node scripts/test-mission-control-chat.js             # 20/20 PASSED
node scripts/test-pixel-office-movement.js            # 33/33 PASSED
node scripts/test-pixel-office-handoff.js             # 26/26 PASSED
node scripts/test-pixel-office-job-trace.js           # 24/24 PASSED
node scripts/test-soak-safety.js                      # 54/54 PASSED

# 3. Astro TypeScript Compilation & Cloudflare SSR Build
npx tsc --noEmit                                      # 0 ERRORS
npm run build                                         # Complete in 5.31s
```
