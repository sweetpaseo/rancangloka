# RancangLoka & Hermes — SOCIAL-S2: Mission Control Social Department & Staff Integration (Read-Only / Shadow)

> **Status:** COMPLETE / CANONICAL  
> **Milestone:** SOCIAL-S2  
> **Operational Mode:** SHADOW / READ-ONLY  
> **Authority Level:** ZERO EXECUTION AUTHORITY  
> **Target Branch:** `feat/jev-lokamedia-integration`

---

## 1. Executive Summary

Milestone **SOCIAL-S2** integrates the Social Media Automation domain (established in SOCIAL-S1) into Hermes Mission Control and Pixel Office as a strictly **Read-Only / Shadow** operational department.

Prior to SOCIAL-S2, the Social department was represented as unstaffed and unavailable (`NOT_AVAILABLE`, `is_staffed: false`) in Mission Control. SOCIAL-S2 transitions this department to an observable shadow state, registers its first canonical staff specialist (**Maya**), connects real domain telemetry from Cloudflare D1 tables (`social_campaigns`, `social_post_variants`, `social_staging_outbox`, `social_execution_receipts`), and visualizes genuine work inside Pixel Office (**Zone S — Social Operations & Distribution Hub**) without granting any execution or publishing authority.

---

## 2. Strict Safety Invariants

During and after SOCIAL-S2, all system-wide safety envelopes remain firmly locked:

| Invariant | State | Enforcement Mechanism |
| :--- | :--- | :--- |
| `automation_mode` | **`OFF`** | Hard-coded gate in `src/lib/safety/` |
| `media_worker` | **`DISABLED`** | Dual-gate in `src/lib/media/worker-runner.ts` |
| `JEV_MODE` | **`shadow`** | Zero-authority shadow decision log |
| `SOCIAL_AUTOMATION` | **`OFF`** | Hard gate in `src/lib/social/outbox.ts` (`eligible_count = 0`) |
| External Social API Calls | **`NONE`** | Zero network requests to Meta/Instagram/TikTok/X/etc. |
| Production Credentials | **`NONE`** | Zero OAuth tokens or API keys registered in environment |
| Fake Staff Work | **`FORBIDDEN`** | `NO REAL SOCIAL JOB = NO SOCIAL WORK ANIMATION` |
| Execution Authority | **`0`** | Department and capabilities are strictly `AVAILABLE_READ_ONLY` |

---

## 3. Department Activation Model

### 3.1 State Transition

The Social department was registered in MC-3/MC-7 with `NOT_AVAILABLE` status. In SOCIAL-S2, it transitions into an observable shadow department:

* **Department ID:** `social`
* **Display Name:** `Social & Distribution`
* **Operational Availability:** `AVAILABLE_READ_ONLY` (Shadow mode)
* **Staffed Status:** `is_staffed: true` (`staff_count: 1`)
* **Assigned Staff:** `['social_distribution_operator']`
* **Workstation Zone:** `Zone S - Social Operations & Distribution Hub`
* **Room Key:** `social_room`
* **Execution Authority:** `NONE` (Zero mutators, zero provider triggers)

### 3.2 Dynamic Activation & Deactivation Helpers

Mission Control provides dynamic lifecycle functions:
* `activateSocialDepartmentShadow()`: Registers Maya and maps canonical capabilities with `AVAILABLE_READ_ONLY`.
* `deactivateSocialDepartmentShadow()`: Restores baseline unstaffed state (`NOT_AVAILABLE`, `is_staffed: false`) cleanly for testing and maintenance.

---

## 4. Canonical Staff Identity: Maya

SOCIAL-S2 promotes the proposed identity from SOCIAL-S0 discovery into the canonical staff registry:

* **Machine ID (`agent_id`):** `social_distribution_operator`
* **Display Name:** `Maya`
* **Role:** `Social Content & Distribution Specialist`
* **Department:** `social`
* **Avatar Key:** `social_specialist_01`
* **Source System:** `social_staging_outbox`
* **Status:** `Active` (Shadow / Read-Only Specialist)

### 4.1 Canonical Capabilities

Maya is endowed with 5 presentation and observation capabilities, all marked `AVAILABLE_READ_ONLY`:

1. `SOCIAL_DISTRIBUTION`: Multi-channel syndication monitoring and telemetry review.
2. `SOCIAL_COPY_WRITING`: Social caption and hook authoring observation based on Jakarta Editorial Human Voice Layer.
3. `CAROUSEL_CURATION`: Carousel layout curation and authentic architectural image sequencing observation.
4. `SOCIAL_QA_SUPPORT`: Social hashtag, link attribution, and editorial compliance verification.
5. `SOCIAL_SCHEDULING_OBSERVATION`: Observation of staged outbox items held by safety gates.

---

## 5. Telemetry Adapter & Read-Model Aggregation

The Social domain telemetry from SOCIAL-S1 is normalized into Mission Control via `getSocialOperationsSummary(db, env)` and embedded into `MissionControlSnapshot.social`:

```ts
export interface SocialOperationsSummary {
  departmentAvailability: 'AVAILABLE_READ_ONLY' | 'NOT_AVAILABLE';
  mode: 'SHADOW' | 'OFF';
  staffCount: number;
  totalCampaigns: number;
  activeCampaigns: number;
  draftCampaigns: number;
  approvedCampaigns: number;
  scheduledCampaigns: number;
  completedCampaigns: number;
  blockedCampaigns: number;
  totalVariants: number;
  variantsAwaitingQa: number;
  variantsAwaitingApproval: number;
  variantsApproved: number;
  variantsScheduledHeld: number;
  publishedExternallyCount: number;
  outboxStagedCount: number;
  outboxEligibleCount: number;
  providerExecutionAvailable: boolean;
  latestCampaign: {
    campaignId: string;
    title: string;
    status: string;
    articleSlug: string;
    platformCount: number;
    createdAt: string;
  } | null;
}
```

* Zero provider credentials or external tokens are exposed.
* All metrics derive from real D1 queries (`social_campaigns`, `social_post_variants`, `social_staging_outbox`, `social_execution_receipts`).

---

## 6. Staff State Derivation Rules

Maya's operational state is derived deterministically from genuine telemetry:

| Domain Telemetry State | Derived Staff State | Spatial Location | Animation Key | Actively Working |
| :--- | :--- | :--- | :--- | :--- |
| No active social tasks / campaigns | `IDLE` | Lounge (`lounge`) | `IDLE_STANDBY` | `false` |
| Campaign preparing / variant drafting | `WORKING` | `social_workstation` | `ARTICLE_TYPING` | `true` |
| Carousel / visual curation task | `WORKING` | `social_workstation` | `MEDIA_REVIEW` | `true` |
| QA review stage (`READY_FOR_QA`) | `REVIEWING` | `social_workstation` | `QA_REVIEW` | `true` |
| **`PENDING_APPROVAL`** (Awaiting Chief Editor) | **`IDLE`** | **Lounge (`lounge`)** | **`IDLE_STANDBY`** | **`false`** |
| **`SCHEDULED`** (`SOCIAL_AUTOMATION=OFF`) | **`IDLE`** | **Lounge (`lounge`)** | **`IDLE_STANDBY`** | **`false`** |
| Task failed / campaign blocked | `BLOCKED` | `social_workstation` | `BLOCKED_WARNING` | `false` |
| Campaign completed | `IDLE` | Lounge (`lounge`) | `IDLE_STANDBY` | `false` |
| Telemetry absent / unreadable | `UNKNOWN` | Lounge (`lounge`) | `UNKNOWN_NEUTRAL` | `false` |

### Critical Invariants:
1. **Pending Approval is NOT working:** A campaign waiting for editorial approval does not cause Maya to show typing or active work.
2. **Scheduled with Automation OFF is NOT dispatch:** When automation is OFF, scheduled variants remain staged in outbox; Maya stays in the Lounge and no dispatch animation is ever triggered.

---

## 7. Pixel Office — Zone S Integration

Pixel Office room mapping is promoted from future capacity to active staffed room:

* **Room Key:** `social_room`
* **Room Title:** `Social & Distribution`
* **Room Subtitle:** `Social Operations & Distribution Hub`
* **Zone:** `Zone S - Social Operations & Distribution Hub`
* **Workstation Position:** `social_workstation` (coordinates: `x: 50, y: 55` within room)
* **Home Room:** `social_room`
* **Idle Location:** Executive Lounge (`lounge`)

---

## 8. Direct Staff Chat (MC-5 Integration)

Maya is accessible via the MC-5 Direct Staff Chat interface with strict command allowlists:

### Permitted Read-Only Operational Queries
* `SOCIAL_STATUS_QUERY`: Queries active campaigns, draft variants, approval queue, and outbox hold counts.
* `SOCIAL_CAMPAIGN_REVIEW`: Displays details of the latest active social campaign.
* `SOCIAL_OUTBOX_REVIEW`: Displays staged outbox counts and confirms hold state under `SOCIAL_AUTOMATION=OFF`.
* `CURRENT_TASK_QUERY`: Inquires about Maya's current genuine task.
* `ACTIVITY_SUMMARY_QUERY`: Inquires about Maya's recent activity telemetry.

### Prohibited / Rejected Commands
* Any publishing command (`PUBLISH_NOW`, `force publish`) is rejected with `DANGEROUS_ACTION_FORBIDDEN`.
* Administrative mutators (`ENABLE_AUTOMATION`, `kill switch`) are rejected with `ADMIN_APPROVAL_REQUIRED`.
* Commands outside Maya's allowlist are rejected with `COMMAND_NOT_ALLOWED`.

---

## 9. Anomaly Detection & Staff Escalation (MC-6 Integration)

The MC-6 Anomaly engine automatically monitors the Social domain:

1. **`SOCIAL_AUTOMATION_OFF`**:
   * Condition: Social automation is OFF by design.
   * Classification: `INFO` severity, `EXPECTED` condition, `expected_condition: true`.
   * Invariant: Never alarms, never escalates to staff chat.
2. **`SOCIAL_CAMPAIGN_BLOCKED`**:
   * Condition: Blocked campaigns or failed variant creation tasks.
   * Classification: `WARNING` severity, `OPEN` state.
   * Staff Assignment: Deterministically assigned to `social_distribution_operator` (Maya).
   * Capability Routing: Routed via `SOCIAL_DISTRIBUTION` capability.

---

## 10. Verification & Test Evidence

All 11 verification test suites run cleanly:

1. `test-social-mission-control.js` (15/15 PASSED) — SOCIAL-S2 canonical suite.
2. `test-social-domain.js` (22/22 PASSED) — SOCIAL-S1 core domain suite.
3. `test-mission-control.js` (10/10 PASSED) — MC-1 baseline telemetry suite.
4. `test-staff-registry.js` (16/16 PASSED) — MC-2 staff registry suite.
5. `test-mission-control-departments.js` (18/18 PASSED) — MC-3 department operations suite.
6. `test-mission-control-chat.js` (20/20 PASSED) — MC-5 staff chat & command queue suite.
7. `test-mission-control-anomalies.js` (20/20 PASSED) — MC-6 anomaly escalation suite.
8. `test-mission-control-pixel-office.js` (20/20 PASSED) — MC-4 pixel office spatial suite.
9. `test-mission-control-expansion.js` (12/12 PASSED) — MC-7 dynamic expansion suite.
10. `test-mission-control-job-animation.js` (21/21 PASSED) — MC-9 real job animation suite.
11. `test-soak-safety.js` (54/54 PASSED) — Core production safety envelope suite.

TypeScript check (`npx tsc --noEmit`) and production SSR build (`npm run build`) completed with 0 errors.

---

## 11. Handoff to SOCIAL-S3

The Social domain model, D1 staging schema, and Mission Control observability plane are complete. The system is ready for **SOCIAL-S3**:
* Implementation of the **First Platform Adapter** (`Meta Graph API: Facebook Page + Instagram Business`).
* Integration must run in **sandbox / disabled execution mode first**.
* Zero production publication and zero real token exposure remain mandatory.
