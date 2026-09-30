# 🏢 HERMES-MC-3: Department Operations & Organizational State

> **Document Version:** 1.0.0  
> **Milestone:** HERMES-MC-3  
> **Status:** APPROVED / IMPLEMENTATION COMPLETE  
> **Execution Mode:** READ-ONLY ORGANIZATIONAL PRESENTATION LAYER  
> **Date:** 2026-09-30  
> **Baseline Commit:** `ffa482e`  
> **Active Branch:** `feat/jev-lokamedia-integration`  

---

## 1. Executive Summary

Milestone **HERMES-MC-3** transforms the staff identity model of MC-2 into a complete, deterministic organizational model for RancangLoka Hermes Mission Control at `/admin/mission-control/departments` and `/admin/mission-control/departments/[department_id]`.

The system aggregates operational health, genuine task ownership, structural blockers, real-time activity streams, and cross-department workflow handoffs across 6 canonical departments.

### Core Invariants Preserved
1. **Machine vs Presentation Separation:** Canonical department IDs (`editorial`, `research_evidence`, `media`, `publication_operations`, `engineering_telemetry`, `social`) are immutable keys. Display names and descriptions remain configurable presentation labels.
2. **Deterministic Department Health Precedence:**
   $$\text{NOT\_AVAILABLE} \succ \text{UNKNOWN} \succ \text{BLOCKED} \succ \text{OFFLINE} \succ \text{DEGRADED} \succ \text{ACTIVE} \succ \text{HEALTHY}$$
   Departments are never marked `HEALTHY` merely because active counts are zero. E.g., disabled media workers evaluate to `OFFLINE`.
3. **Unstaffed Social Department Invariant:** Social & Distribution (`social`) is strictly `NOT_AVAILABLE` and `UNSTAFFED`. Zero synthetic staff or fake distribution tasks are created.
4. **Task Ownership Invariant:** Tasks are attributed with explicit confidence levels (`EXACT`, `DERIVED`, `UNASSIGNED`). Ambiguous system tasks remain unassigned without forced attribution.
5. **Real Handoff Invariant:** Handoffs are derived strictly from genuine cross-department state transitions (e.g. editorial draft awaiting media $\rightarrow$ Media Operations, or media attached $\rightarrow$ Editorial QA). No synthetic handoffs are fabricated.
6. **Read-Only Invariant:** MC-3 introduces zero write paths, zero execution controls, zero chat/command dispatch, and zero production mutations.
7. **Pixel Office Metadata Preparation:** Departments and staff include room keys (`room_key`, `workstation_zone`, `STAFF_ROOM_MAP`) strictly as metadata for MC-4. No canvas rendering or sprite movement is implemented in MC-3.

---

## 2. Canonical Department Registry

| Department ID | Display Name | Staff Members | Health | Availability | Pixel Office Room | Workstation Zone |
|---|---|---|---|---|---|---|
| `editorial` | **Editorial** | Joko, Rina | ACTIVE / HEALTHY / DEGRADED | `AVAILABLE` | `editorial_room` | Zone E - Writing & QA Desks |
| `research_evidence` | **Research & Evidence** | Irwan | HEALTHY / ACTIVE | `AVAILABLE` | `research_lab` | Zone R - Fact Checking & Lab |
| `media` | **Media Operations** | Budi | OFFLINE / ACTIVE / BLOCKED | `AVAILABLE` | `media_room` | Zone M - Visual Processing Queue |
| `publication_operations` | **Publication Operations** | Sari | HEALTHY / ACTIVE / BLOCKED | `AVAILABLE` | `publication_room` | Zone P - Dispatch & Safety Gates |
| `engineering_telemetry` | **Engineering & Telemetry** | Dimas | HEALTHY / DEGRADED | `AVAILABLE` | `operations_room` | Zone O - Telemetry Monolith |
| `social` | **Social & Distribution** | *(None)* | `NOT_AVAILABLE` | `NOT_AVAILABLE` | `social_room` | Zone S - Unstaffed Bay |

---

## 3. Department Health Model & Evaluation Precedence

Department health is evaluated deterministically via `deriveDepartmentHealth(...)`:

```
┌─────────────────────────────────────────────────────────────┐
│               CANONICAL HEALTH PRECEDENCE                   │
│                                                             │
│   1. NOT_AVAILABLE  (Dept availability === 'NOT_AVAILABLE') │
│   2. UNKNOWN        (Snapshot null or telemetry missing)    │
│   3. BLOCKED        (Critical blocker, open breaker, kill)  │
│   4. OFFLINE        (Subsystem disabled or daemon dead)     │
│   5. DEGRADED       (Retries > 0, stale scheduler, warning) │
│   6. ACTIVE         (Staff WORKING/REVIEWING, tasks > 0)    │
│   7. HEALTHY        (Subsystem ok, 0 blockers, fresh pulse) │
└─────────────────────────────────────────────────────────────┘
```

### Specific Operational Health Rules
- **Media Department:** When `settings.media_worker_enabled` is `DISABLED`, health is strictly `OFFLINE` (evidence: *"Pekerja media nonaktif (DISABLED)"*). It transitions to `BLOCKED` only if a media circuit breaker is `OPEN`.
- **Publication Department:** When `automation_control.mode` is `OFF`, publication operates in safe manual/draft-only mode and is classified as `HEALTHY` (standby), NOT an error. It transitions to `BLOCKED` only if the emergency kill switch is engaged or `global_publisher` breaker is `OPEN`.
- **Engineering Department:** Operates strictly with TypeSafe JEV in shadow mode (`0 authority`). Evaluates to `HEALTHY` or `ACTIVE` when OpenRouter provider status is `SUCCESS`, and `DEGRADED` on provider fallback.

---

## 4. Task Ownership & Attribution Model

Tasks from `PipelineBoardData` are mapped to departments and staff with explicit confidence classifications via `attributeTaskOwnership(task)`:

| Task Condition | Attributed Department | Attributed Agent | Confidence |
|---|---|---|---|
| Stage: `writing` | `editorial` | `content_writer_primary` (Joko) | `EXACT` |
| Stage: `researching` | `research_evidence` | `evidence_researcher_lead` (Irwan) | `EXACT` |
| Stage: `validating` / `editorial_qa` | `editorial` | `editorial_qa_primary` (Rina) | `EXACT` |
| Stage: `ready_for_review` | `editorial` | `editorial_qa_primary` (Rina) | `DERIVED` |
| Stage: `waiting_media` / Subsystem: `media` | `media` | `lokamedia_worker_primary` (Budi) | `EXACT` |
| Stage: `ingesting` / `scheduled` / `published` | `publication_operations` | `publication_dispatcher_core` (Sari) | `DERIVED` |
| Stage: `draft` (subsystem: `editorial`) | `editorial` | `content_writer_primary` (Joko) | `DERIVED` |
| Generic / System / Unclassified | `null` | `null` | `UNASSIGNED` |

---

## 5. Organizational Workflow & Handoff Model

The handoff model (`deriveDepartmentHandoffs`) tracks transitions between departments strictly when supported by live D1 relational state:

1. **Editorial $\rightarrow$ Media Operations:**
   - Triggered when an article is in `waiting_media` with an associated `relatedMediaJobId`.
   - State: `READY` (or `BLOCKED` if media job failed).
2. **Media Operations $\rightarrow$ Editorial:**
   - Triggered when media assets are attached (`editorial_qa` stage) awaiting First Article Gate sign-off.
   - State: `READY`.
3. **Editorial $\rightarrow$ Publication Operations:**
   - Triggered when an article receives Chief Editor approval and enters `scheduled` stage.
   - State: `READY` (or `BLOCKED` if publication circuit breaker is tripped).
4. **Research & Evidence $\rightarrow$ Editorial:**
   - Triggered when an article is in `researching` stage preparing evidence packs for authoring.
   - State: `PENDING`.

If no active transition evidence exists, `handoffs` is an empty array (`[]`). Synthetic or assumed handoffs are forbidden.

---

## 6. Structural Blocker Model

Department blockers are represented via structured objects (`DepartmentBlocker`):
- `blocker_id`: Unique identifier (e.g. `blocker_kill_switch`, `blocker_breaker_global_publisher`).
- `department_id`: Associated department.
- `severity`: `'CRITICAL'` | `'WARNING'`.
- `error_class`: Standardized error classification.
- `summary`: Factual explanatory statement.
- `retryable`: Boolean indicating if automatic retry is permitted.
- `operator_action_required`: Boolean indicating if human chief editor / ops action is mandatory.
- `evidence_reference`: Traceable database table or circuit breaker ID.

---

## 7. Pixel Office Preparation (Metadata Only)

To prepare for MC-4 Pixel Office 2D rendering without premature implementation:
- **Room Keys:** Canonical rooms assigned (`editorial_room`, `research_lab`, `media_room`, `publication_room`, `operations_room`, `social_room`).
- **Workstation Zones:** Human-readable spatial zones defined for future character placement.
- **Staff Logical Room Map (`STAFF_ROOM_MAP`):**
  - Joko $\rightarrow$ `editorial_room`
  - Rina $\rightarrow$ `editorial_room`
  - Irwan $\rightarrow$ `research_lab`
  - Budi $\rightarrow$ `media_room`
  - Sari $\rightarrow$ `publication_room`
  - Dimas $\rightarrow$ `operations_room`
- **Invariants:** Zero pixel sprites, zero canvas elements, and zero character movement scripts were introduced in MC-3.

---

## 8. User Interface Implementation

### Routes
- **Overview:** `/admin/mission-control/departments`
- **Detail:** `/admin/mission-control/departments/[department_id]`
- **JSON API (List):** `/api/admin/mission-control/departments`
- **JSON API (Detail):** `/api/admin/mission-control/departments/[department_id]`

### UI Highlights
1. **Overview Page:**
   - Summary strip for all 7 health states + staff totals.
   - Conceptual workflow sequence strip: *Research $\rightarrow$ Editorial $\rightarrow$ Media $\rightarrow$ Publication*.
   - Responsive cards with animated health dots, staff member pills, active/blocked task counts, and room tags.
2. **Detail Page:**
   - Executive header with large health badge and breadcrumbs.
   - Workload metric cards (staff count, active tasks, review queue, blockers, room key).
   - Factual health evidence banner.
   - Split layout: Staff list & attributed tasks on the left; structural blockers, handoffs, and capability tags on the right.
   - Strictly supervisory read-only without execution controls.

---

## 9. Verification & Test Suite

The test suite in `scripts/test-mission-control-departments.js` validates 18 invariant checks:
- [x] Department registry validity & unique department IDs.
- [x] Deterministic staff membership per department.
- [x] Unstaffed Social department invariant (`NOT_AVAILABLE` / 0 staff).
- [x] HEALTHY health derivation.
- [x] ACTIVE health derivation.
- [x] DEGRADED health derivation.
- [x] BLOCKED health derivation.
- [x] OFFLINE health derivation.
- [x] UNKNOWN health derivation.
- [x] Deterministic task ownership attribution (EXACT, DERIVED, UNASSIGNED).
- [x] Department event attribution with confidence classification.
- [x] Genuine cross-department handoff derivation.
- [x] Zero fake handoffs invariant.
- [x] Structural blocker model mapping and operator action classification.
- [x] Pixel Office room metadata preparation.
- [x] Staff logical room mapping preparation.
- [x] Organization snapshot aggregation & workload metrics.
- [x] Strict read-only invariant (zero mutations).

### Validation Run Results
- `node scripts/test-mission-control-departments.js`: **18/18 PASSED**
- `node scripts/test-staff-registry.js`: **16/16 PASSED**
- `node scripts/test-mission-control.js`: **10/10 PASSED**
- `npx tsc --noEmit`: **0 ERRORS**
- `npm run build`: **SUCCESS** (Cloudflare Worker server built in 6.72s)
- `node scripts/test-soak-safety.js`: **54/54 PASSED**

---

## 10. MC-4 Readiness Assessment

- **Readiness Status:** READY for `HERMES-MC-4` (Pixel Office & Visual Canvas).
- **Prerequisites Satisfied:**
  - Stable staff identities and avatar keys (`HERMES-MC-2`).
  - Canonical departments and room keys (`HERMES-MC-3`).
  - Deterministic staff operational states (`WORKING`, `IDLE`, `REVIEWING`, `BLOCKED`, `OFFLINE`).
  - Cross-department handoff representations.
- **Recommended MC-4 Scope:**
  - Lightweight 2D canvas / isometric office floor plan representing the 6 rooms.
  - Pixel sprites positioned according to logical room mapping and dynamic state (e.g. workstation when `WORKING`, lounge when `IDLE`, warning beacon when `BLOCKED`).
  - Read-only visual animation without chat or direct execution controls.
