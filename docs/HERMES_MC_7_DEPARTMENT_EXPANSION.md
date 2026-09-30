# HERMES-MC-7: Extensible Department Architecture & Organizational Expansion Framework

> **Status:** APPROVED & IMPLEMENTED  
> **Milestone:** `HERMES-MC-7`  
> **Date:** September 30, 2026  
> **Authoritative Baseline Branch:** `feat/jev-lokamedia-integration`

---

## 1. Executive Summary & Architectural Overview

Milestone `HERMES-MC-7` transitions RancangLoka Hermes Mission Control from a fixed six-department implementation into a contract-governed, registry-driven, extensible organizational architecture.

Prior to MC-7, Mission Control assumed a static organization of 6 departments and 6 staff members hardcoded across the codebase. With MC-7, the organization is generalized through three modular registries:
1. **Capability Registry Contract** (`MissionControlCapabilityDefinition`)
2. **Department Plugin Contract** (`MissionControlDepartmentDefinition`)
3. **Staff Role Contract** (`MissionControlStaffDefinition`)

Future subsystems (e.g., SEO / Search Intelligence, Commerce, Analytics, Partnerships, Infrastructure Operations, or Social) can onboard dynamically via registry contracts without modifying generic dashboard components, Pixel Office internals, chat routing, or anomaly engines.

---

## 2. Core Registry Contracts

### 2.1 Capability Registry (`src/lib/mission-control/capability-registry.ts`)
Capabilities represent granular machine-verifiable operational functions:

```typescript
export type CapabilityAvailability =
  | 'NOT_AVAILABLE'
  | 'AVAILABLE_READ_ONLY'
  | 'AVAILABLE_CONTROLLED'
  | 'AVAILABLE';

export interface MissionControlCapabilityDefinition {
  capability_id: string;
  display_name: string;
  description: string;
  owning_department_id: string;
  default_agent_id: string | null;
  operational_availability: CapabilityAvailability;
  source_systems: string[];
  command_families: string[];
  read_models: string[];
  anomaly_classes: string[];
}
```

Registered Canonical Baseline Capabilities:
- `ARTICLE_WRITING` (`content_writer_primary`, `editorial`)
- `EVIDENCE_RESEARCH` (`evidence_researcher_lead`, `research_evidence`)
- `EDITORIAL_QA` (`editorial_qa_primary`, `editorial`)
- `MEDIA_OPERATIONS` (`lokamedia_worker_primary`, `media`)
- `PUBLICATION_OPERATIONS` (`publication_dispatcher_core`, `publication_operations`)
- `SYSTEM_TELEMETRY` (`telemetry_observer_jev`, `engineering_telemetry`)
- `SOCIAL_DISTRIBUTION` (unassigned, `social`, strictly `NOT_AVAILABLE`)

### 2.2 Department Plugin Contract (`src/lib/mission-control/department-registry.ts`)
Departments represent organizational units grouping capabilities, rooms, and staff:

```typescript
export interface MissionControlDepartmentDefinition {
  department_id: DepartmentId;
  display_name: string;
  short_name?: string;
  description: string;
  availability: DepartmentAvailability;
  is_staffed: boolean;
  capabilities: string[];
  source_systems: string[];
  staff_roles?: string[];
  room_key: string;
  workstation_zone: string;
  display_order: number;
  health_adapter?: string | null;
  task_adapter?: string | null;
  activity_adapter?: string | null;
  anomaly_adapter?: string | null;
  conversation_enabled?: boolean;
  pixel_office_enabled?: boolean;
  feature_flags?: Record<string, boolean>;
}
```

Dynamic Registration Methods:
- `registerDepartment(definition)`: Registers a new department with unique ID validation.
- `unregisterDepartment(departmentId)`: Safely unregisters a department.
- `resetDepartmentRegistry()`: Restores canonical baseline.
- `getRegisteredDepartments()`: Returns sorted list of all registered departments.
- `getDepartmentDefinition(departmentId)`: Fast lookup of department by ID.

### 2.3 Staff Role Contract (`src/lib/mission-control/staff-registry.ts`)
Staff definitions represent human-friendly personas wrapping underlying machine execution identities:

```typescript
export interface MissionControlStaffDefinition {
  agent_id: string;
  display_name: string;
  role: string;
  department_id: DepartmentId;
  description: string;
  avatar_key: string;
  capabilities: string[];
  source_system: string;
  active: boolean;
  sort_order: number;
  source_systems?: string[];
  capability_ids?: string[];
  state_adapter?: string | null;
  task_adapter?: string | null;
  activity_adapter?: string | null;
  conversation_policy?: Record<string, any>;
  alert_policy?: Record<string, any>;
  room_policy?: Record<string, any>;
}
```

Dynamic Registration Methods:
- `registerStaffMember(definition)`: Adds staff member with unique machine `agent_id` validation.
- `unregisterStaffMember(agentId)`: Safely removes staff member.
- `resetStaffRegistry()`: Restores canonical 6 staff members.
- `getStaffDefinitions()`: Returns active staff with configured display name overrides.

---

## 3. Dynamic Subsystem Routing

### 3.1 Pixel Office Spatial Engine (`src/lib/mission-control/pixel-office.ts`)
- **Dynamic Rooms:** Pixel Office room configurations are derived dynamically from `getRegisteredDepartments()`.
- **Shared Infrastructure:** The shared `Executive Lounge` (`lounge`) is automatically inserted as neutral shared space.
- **Dynamic Sprites:** All active registered staff in `getStaffRoster()` automatically spawn with corresponding position coordinates and visual modes.
- **Unavailable Rooms:** Rendered gracefully as `COMING LATER • NOT AVAILABLE` without hardcoding specific department names.

### 3.2 Task Ownership Attribution (`attributeTaskOwnership`)
Tasks are attributed via a generalized flow:
$$\text{Task} \longrightarrow \text{Capability} \longrightarrow \text{Department} \longrightarrow \text{Responsible Staff}$$
- Fallback: Subsystem matches against registered department IDs.
- Low-confidence or unhandled stages safely evaluate to `UNASSIGNED`.

### 3.3 Anomaly Routing Engine (`routeAnomalyByCapability`)
Anomalies route deterministically to owning departments and staff based on declared capability metadata:
$$\text{Raw Anomaly} \longrightarrow \text{Anomaly Class} \longrightarrow \text{Registered Capability} \longrightarrow \text{Owning Department \& Staff}$$
- Ambiguous or infrastructure-wide anomalies remain unassigned (`responsible_agent_id = null`) to uphold the zero-hallucination invariant.

### 3.4 Chat Capability Discovery (`getAllowlistedCommandsForAgent`)
- Resolves command allowlists for each agent by uniting explicit command targets with `command_families` declared in the agent's registered capabilities.
- Prohibits arbitrary command execution. Strict validation and authority bounds are preserved.

---

## 4. Canonical Organization Read Model

A unified organization read-model is exposed via `getMissionControlOrganization(snapshot)` and API route `/api/admin/mission-control/organization`:

```json
{
  "generated_at": "2026-09-30T16:00:00.000Z",
  "departments": [...],
  "staff": [...],
  "capabilities": [...],
  "rooms": [...],
  "summary": {...},
  "availability": {
    "editorial": "AVAILABLE",
    "research_evidence": "AVAILABLE",
    "media": "AVAILABLE",
    "publication_operations": "AVAILABLE",
    "engineering_telemetry": "AVAILABLE",
    "social": "NOT_AVAILABLE"
  },
  "health": {
    "editorial": "ACTIVE",
    "publication_operations": "HEALTHY",
    "media": "OFFLINE",
    ...
  },
  "workload": {
    "active_tasks": 2,
    "blockers": 0
  },
  "alerts": {
    "active_anomalies": 1,
    "critical_count": 0,
    "error_count": 0
  }
}
```

---

## 5. Developer Guide: How to Onboard a Future Department

To onboard a new department (e.g., SEO, Analytics, Commerce) when real runtime capabilities exist:

1. **Define Capabilities** in `capability-registry.ts`:
   ```typescript
   registerCapability({
     capability_id: 'SEO_AUDIT',
     display_name: 'Audit SEO & Metadata',
     description: 'Analisis kata kunci dan verifikasi OpenGraph/JSON-LD.',
     owning_department_id: 'seo_intelligence',
     default_agent_id: 'seo_analyst_lead',
     operational_availability: 'AVAILABLE',
     source_systems: ['google_search_console'],
     command_families: ['SEO_AUDIT_QUERY'],
     read_models: ['articles.seo'],
     anomaly_classes: ['SEO_METADATA_MISSING']
   });
   ```

2. **Register Department** in `department-registry.ts`:
   ```typescript
   registerDepartment({
     department_id: 'seo_intelligence',
     display_name: 'SEO & Search Intelligence',
     description: 'Optimalisasi pencarian arsitektur dan hunian.',
     availability: 'AVAILABLE',
     is_staffed: true,
     capabilities: ['SEO_AUDIT'],
     source_systems: ['google_search_console'],
     room_key: 'seo_room',
     workstation_zone: 'Zone S2 - Search Intelligence Desks',
     display_order: 7
   });
   ```

3. **Register Staff Persona** in `staff-registry.ts`:
   ```typescript
   registerStaffMember({
     agent_id: 'seo_analyst_lead',
     display_name: 'Faisal',
     role: 'SEO & Search Intelligence Lead',
     department_id: 'seo_intelligence',
     description: 'Kurator metadata SEO RancangLoka.',
     avatar_key: 'seo_lead_01',
     capabilities: ['SEO_AUDIT'],
     source_system: 'google_search_console',
     active: true,
     sort_order: 7
   });
   ```

4. **Connect Real Telemetry / Task Sources**: Provide evidence in snapshot pipeline and telemetry feeds.
5. **No UI Changes Needed**: Pixel Office, Department Index, Staff Roster, Alert Center, and Chat pages render the new department automatically.

---

## 6. Social Department Preservation

- The Social department remains strictly `NOT_AVAILABLE`, `is_staffed: false`, with zero active persona agents.
- No Meta Graph API, simulated queues, or mock agents were created.
- The social track is reserved for milestone `SOCIAL-S0+`.

---

## 7. Verification & Test Suite

The test suite in `scripts/test-mission-control-expansion.js` passed all 12 test assertions:
- Dynamic department registration and duplicate rejection.
- Dynamic staff registration and duplicate machine agent ID rejection.
- Dynamic capability registration, ownership resolution, and fail-closed behavior.
- Task attribution by capability and department.
- Anomaly routing by capability class.
- Chat allowlist resolution through capability contracts.
- Dynamic Pixel Office room generation and staff sprite rendering.
- Machine identity vs display name separation.
- Social department unavailable and unstaffed invariant.
- Organization read model compilation.
- Unregistration and baseline reset integrity.

All prior test suites remain green:
- `test-mission-control-anomalies.js` (20/20 PASS)
- `test-mission-control-chat.js` (20/20 PASS)
- `test-mission-control-pixel-office.js` (20/20 PASS)
- `test-mission-control-departments.js` (18/18 PASS)
- `test-staff-registry.js` (16/16 PASS)
- `test-mission-control.js` (10/10 PASS)
- `test-soak-safety.js` (54/54 PASS)
- `npx tsc --noEmit` (0 errors)
- `npm run build` (Clean SSR production bundle)
