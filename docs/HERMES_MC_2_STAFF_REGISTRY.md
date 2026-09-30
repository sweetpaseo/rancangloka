# 👥 HERMES-MC-2: Staff Identity & Capability Registry

> **Document Version:** 1.0.0  
> **Milestone:** HERMES-MC-2  
> **Status:** APPROVED / IMPLEMENTATION COMPLETE  
> **Execution Mode:** READ-ONLY PRESENTATION LAYER  
> **Date:** 2026-09-30  
> **Baseline Commit:** `30494c6`  
> **Active Branch:** `feat/jev-lokamedia-integration`  

---

## 1. Executive Summary

Milestone **HERMES-MC-2** introduces a human-friendly presentation-layer staff registry to RancangLoka Hermes Mission Control at `/admin/mission-control/staff` while strictly preserving canonical machine identities.

Human names (e.g. `Joko`, `Irwan`, `Rina`, `Budi`, `Sari`, `Dimas`) serve purely as presentation-layer personas for editorial and administrative clarity. Machine IDs (`content_writer_primary`, `evidence_researcher_lead`, etc.) remain authoritative for all internal routing, state derivation, and task evaluation.

### Core Invariants Preserved
1. **Machine Identity Invariant:** Machine IDs (`agent_id`) are immutable runtime keys. Human display names are presentation layer only and can be reconfigured centrally without altering system routing or execution logic.
2. **Zero Fabricated State:** Every staff status (`WORKING`, `IDLE`, `REVIEWING`, `BLOCKED`, `OFFLINE`, `UNKNOWN`) is derived deterministically from real Mission Control, Hermes, and RancangLoka signals. No fake activities or simulated progress bars.
3. **Current Task Invariant:** Current task derives strictly by canonical priority (`1. active/in-progress → 2. blocked → 3. reviewing → 4. latest relevant`). If no reliable task exists, `current_task` is strictly `null`. Never invent placeholder tasks.
4. **Media Worker Safety Invariant:** When `settings.media_worker_enabled` is `DISABLED`, Budi (`lokamedia_worker_primary`) is **never displayed as WORKING**, even if unassigned jobs exist.
5. **Publication Automation Mode Invariant:** When publication automation mode is `OFF`, Sari (`publication_dispatcher_core`) is marked `IDLE` (standby), not as an error or failure.
6. **JEV Zero Authority Invariant:** TypeSafe Jev operates strictly in shadow mode (`0 authority`). Dimas (`telemetry_observer_jev`) is presented strictly as a non-blocking decision and telemetry observer with zero publication authority.
7. **Read-Only Invariant:** MC-2 introduces **zero write or mutation paths**. No execution commands, no retry triggers, no automation toggles, no chat/message dispatch.
8. **Deterministic Activity Attribution:** Real events are associated with staff members only when confidence is high. Generic or low-confidence events default strictly to `System` or `Unassigned`.

---

## 2. Canonical Staff Roster

| Display Name | Authoritative Machine ID (`agent_id`) | Role | Department ID | Primary Capability | Avatar Key | Source System |
|---|---|---|---|---|---|---|
| **Joko** | `content_writer_primary` | Content Writer | `editorial` | `ARTICLE_WRITING` | `editorial_writer_01` | `hermes_pipeline` |
| **Irwan** | `evidence_researcher_lead` | Research & Evidence Specialist | `research_evidence` | `EVIDENCE_RESEARCH` | `research_evidence_01` | `hermes_research` |
| **Rina** | `editorial_qa_primary` | Editorial QA | `editorial` | `EDITORIAL_QA` | `editorial_qa_01` | `hermes_qa` |
| **Budi** | `lokamedia_worker_primary` | Media Operations | `media` | `MEDIA_OPERATIONS` | `media_ops_01` | `lokamedia_worker` |
| **Sari** | `publication_dispatcher_core` | Publication Operator | `publication_operations` | `PUBLICATION_OPERATIONS` | `publication_ops_01` | `publication_engine` |
| **Dimas** | `telemetry_observer_jev` | Decision & Telemetry Analyst | `engineering_telemetry` | `SYSTEM_TELEMETRY` | `telemetry_01` | `typesafe_jev` |

*Note: Social Media & Distribution (`social`) department metadata is registered but intentionally marked `is_available: false` and `is_staffed: false` as no runtime capability exists yet.*

---

## 3. Machine vs Display Identity Separation

The registry enforces an architectural seam between presentation display names and authoritative machine IDs:

```
┌─────────────────────────────────────────────────────────────┐
│                    PRESENTATION LAYER                       │
│  Display Names: "Joko", "Irwan", "Rina", "Budi", "Sari",    │
│                 "Dimas"                                     │
│  Editable centrally via: configureStaffDisplayNames(...)    │
└──────────────────────────────┬──────────────────────────────┘
                               │ (Presentation map only)
                               ▼
┌─────────────────────────────────────────────────────────────┐
│                 AUTHORITATIVE MACHINE LAYER                 │
│  agent_id:                                                  │
│  • content_writer_primary                                   │
│  • evidence_researcher_lead                                 │
│  • editorial_qa_primary                                     │
│  • lokamedia_worker_primary                                 │
│  • publication_dispatcher_core                              │
│  • telemetry_observer_jev                                   │
│  Routing, Telemetry, Task Attribution, Capability Checking  │
└─────────────────────────────────────────────────────────────┘
```

Changing a display name from `Joko` to another human name causes zero side effects on pipeline task routing, event attribution, or D1 table records.

---

## 4. Deterministic State Derivation

Staff states are calculated via `deriveStaffState(agentId, snapshot)` using the following state model:

| State | Derivation Criteria | Example Evidence |
|---|---|---|
| **WORKING** | Role has an active, in-progress task or telemetry actively generating. | *"Sedang menulis naskah artikel untuk [Cara Pasang Dak Beton]."* |
| **IDLE** | Role's subsystem is healthy and operational with no active task in flight. | *"Pipeline penulisan sehat dan siaga; tidak ada draf yang sedang dalam fase penulisan aktif."* |
| **REVIEWING** | Role is actively inspecting drafts, evaluating scheduled publications, or reviewing quality. | *"Sedang meninjau kepatuhan editorial (3 artikel draf menunggu persetujuan review)."* |
| **BLOCKED** | Role's pipeline has an unhandled failure, retry exhaustion, open circuit breaker, or active kill switch. | *"Emergency Kill Switch aktif: Manual operator freeze."* |
| **OFFLINE** | Daemon container is unresponsive (`hermes.status === 'offline'`) or worker is explicitly disabled. | *"Pekerja media nonaktif (DISABLED) - 0 perangkat terhubung aktif."* |
| **UNKNOWN** | Telemetry is missing, database is disconnected, or signals are insufficient. | *"Data snapshot telemetri tidak tersedia atau belum diinisialisasi."* |

---

## 5. Current Task Derivation Rules

The function `deriveStaffCurrentTask(agentId, snapshot)` extracts current assignment according to strict priority:
1. **Active / In-Progress:** Task actively executing in the role's domain.
2. **Blocked / Failed:** Task stuck on error or tripped circuit breaker.
3. **Reviewing:** Task awaiting editorial review or scheduled.
4. **Latest Relevant Task:** Most recent task associated with the role.

If no reliable task meets the criteria:
`current_task = null`  
*(Fabricating placeholder tasks like "Menunggu ide baru" is strictly forbidden).*

---

## 6. Deterministic Activity Attribution

Events from `activity.ts` (aggregating D1 audit tables) are attributed via `attributeActivityEvent(event)`:
- `MEDIA_STAGE_EVENT` / `media_job_events` → **Budi** (`lokamedia_worker_primary`)
- `JEV_SHADOW_OBSERVATION` → **Dimas** (`telemetry_observer_jev`)
- `PUBLICATION_CRON_EXECUTION`, `AUTOMATION_CONTROL_CHANGE`, `publisher` breaker events → **Sari** (`publication_dispatcher_core`)
- `ARTICLE_DRAFT_INGEST`, writer events → **Joko** (`content_writer_primary`)
- `EVIDENCE_PACK_READY`, research events → **Irwan** (`evidence_researcher_lead`)
- `EDITORIAL_QA_PASSED`, First Article Gate events → **Rina** (`editorial_qa_primary`)
- Generic system configuration, unclassified events → **System** / **Unassigned** (`attributedAgentId: null`)

---

## 7. Pixel Office Preparation

Each staff identity specifies a stable `avatar_key` for future visual rendering in Pixel Office (MC-4+):
- Joko: `editorial_writer_01`
- Irwan: `research_evidence_01`
- Rina: `editorial_qa_01`
- Budi: `media_ops_01`
- Sari: `publication_ops_01`
- Dimas: `telemetry_01`

*Note: In accordance with MC-2 specifications, no pixel art assets or canvas renders were introduced in this milestone.*

---

## 8. User Interface Implementation

### Routes
- **UI:** `/admin/mission-control/staff`
- **JSON API:** `/api/admin/mission-control/staff`

### Features
1. **Summary Bar:** Real derived counts for `Total`, `Working`, `Idle`, `Reviewing`, `Blocked`, `Offline`, and `Unknown`.
2. **Sub-Nav Bar:** Fast switching between Cockpit (`/admin/mission-control`) and Staff Registry (`/admin/mission-control/staff`).
3. **Staff Roster Cards:**
   - Avatar badge with initials, sort order, and stable `avatar_key`.
   - Display name and canonical machine ID.
   - Real-time operational state badge with animated status dot.
   - Current task snippet with real status.
   - Capability pills and last activity timestamp.
4. **Read-Only Inspector Panel:**
   - Side-by-side display of Human Name vs Authoritative Machine ID.
   - Detailed factual evidence explaining the derived state.
   - Full current task details.
   - Real attributed event history.
   - Organization department & source system info.
   - Zero command or chat buttons.

---

## 9. Verification & Test Suite

The test suite in `scripts/test-staff-registry.js` validates 16 comprehensive invariant checks:
- [x] Machine vs display identity separation.
- [x] Stable machine IDs and canonical initial roster.
- [x] Capability ownership mappings.
- [x] Task attribution priority.
- [x] Deterministic activity attribution & fallback.
- [x] WORKING state derivation.
- [x] IDLE state derivation & automation OFF safety.
- [x] REVIEWING state derivation.
- [x] BLOCKED state derivation.
- [x] OFFLINE state derivation.
- [x] UNKNOWN state derivation.
- [x] Disabled media worker safety invariant.
- [x] JEV shadow & zero publication authority representation.
- [x] Strict null current task fallback.
- [x] Department registry metadata & Social unstaffed invariant.
- [x] Strict read-only invariant (zero mutations).

Test execution results:
- `node scripts/test-staff-registry.js`: **16/16 PASSED**
- `node scripts/test-mission-control.js`: **10/10 PASSED**
- `npx tsc --noEmit`: **0 ERRORS**
- `npm run build`: **SUCCESS** (Server built in 5.02s)
- `node scripts/test-soak-safety.js`: **54/54 PASSED**

---

## 10. Integration with Next Milestones

- **HERMES-MC-3 (Department Operations Dashboards):** Will build drill-down department views leveraging `DEPARTMENTS_METADATA` and staff capability mappings.
- **HERMES-MC-4 (Pixel Office Rendering):** Will utilize the stable `avatar_key` identifiers and derived states (`WORKING`, `IDLE`, `REVIEWING`, `BLOCKED`, `OFFLINE`) for 2D visual representation.
