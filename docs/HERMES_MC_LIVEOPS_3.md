# HERMES-MC-LIVEOPS-3: Controlled Human Intervention & Workstation Action Gate

## 1. Executive Summary

Milestone **MC-LIVEOPS-3** introduces the **Controlled Human Intervention & Workstation Action Gate** to RancangLoka Hermes Mission Control and Pixel Office. 

Following the completion of real system truth mapping (**MC-LIVEOPS-1**) and read-only inspection overlays (**MC-LIVEOPS-2**), this milestone enables an authenticated **HUMAN OPERATOR** to initiate narrowly scoped, low-risk operational workflow actions directly from the staff workstations in Pixel Office while upholding zero autonomous execution authority, optimistic concurrency protection, and immutable audit logging.

---

## 2. Core Authority & Governance Model

```
  ┌─────────────────────────────────────────────────────────────┐
  │                 AUTHENTICATED HUMAN OPERATOR                │
  │                  (Zero Autonomous Execution)                │
  └──────────────────────────────┬──────────────────────────────┘
                                 │
                                 ▼
                     1. Clicks Staff Workstation
                                 │
                                 ▼
                 ┌───────────────────────────────┐
                 │  Staff Inspector Modal (V2)   │
                 │   Exposes Allowed Actions     │
                 └───────────────┬───────────────┘
                                 │
                                 ▼
                     2. Selects Allowed Action
                                 │
                                 ▼
                 ┌───────────────────────────────┐
                 │ Action Preview Gate (POST API)│
                 │   - Evaluates Current State   │
                 │   - Previews Proposed Effect  │
                 │   - Displays Safety Boundary  │
                 │   - Zero Mutation at Preview  │
                 └───────────────┬───────────────┘
                                 │
                                 ▼
                     3. Explicit Human Confirmation
                                 │
                                 ▼
                 ┌───────────────────────────────┐
                 │ Authenticated Execution Gate  │
                 │ - Admin Session Verified (401)│
                 │ - Same-Origin CSRF Check (403)│
                 │ - Media Firewall Check (403)  │
                 │ - Stale-State Guard (409)     │
                 │ - JEV Zero Authority Guard    │
                 └───────────────┬───────────────┘
                                 │
                                 ▼
                 ┌───────────────────────────────┐
                 │   Canonical Domain Mutation   │
                 │  - Acknowledge Anomaly        │
                 │  - Escalate Blocked Task      │
                 │  - Request Human Review       │
                 │  - Request Evidence Follow-up │
                 └───────────────┬───────────────┘
                                 │
                                 ▼
                 ┌───────────────────────────────┐
                 │  Audit Trail & Telemetry Sync │
                 │ - D1 Operator Action Record   │
                 │ - Deterministic Audit Hash    │
                 │ - Staff Conversation Notice   │
                 │ - Canonical LiveOps Refresh   │
                 └───────────────────────────────┘
```

---

## 3. Action Allowlist & Safety Classification

Mission Control enforces a strict allowlist. Arbitrary, open-ended, or high-risk actions fail closed.

| Action Type | Label | Target Type | Safety Class | Reversible | Target Staff / Subsystem |
| :--- | :--- | :--- | :--- | :--- | :--- |
| `ACKNOWLEDGE_ANOMALY` | Akui Anomali | `ANOMALY` | `LOW_RISK_INTERNAL` | No | Engineering / Shared Alert Center |
| `ESCALATE_BLOCKED_TASK` | Eskalasi Tugas Terhambat | `TASK` | `LOW_RISK_INTERNAL` | No | Editorial / Research Lead |
| `REQUEST_HUMAN_REVIEW` | Minta Review Redaksi | `TASK` | `GOVERNANCE_REVIEW` | Yes | Content Writer / Editorial QA Lead |
| `REQUEST_EVIDENCE_FOLLOWUP`| Minta Tindak Lanjut Bukti| `TASK` | `LOW_RISK_INTERNAL` | Yes | Research & Evidence Lead (Irwan) |

---

## 4. Status Matrix: Implemented vs Deferred vs Blocked

### A. IMPLEMENTED (Milestone Scope)
* **Safe Action Preview (`POST /api/admin/mission-control/actions?preview=true`)**: Exposes target details, current owner, proposed effect, subsystem affected, external system affected (`NONE_INTERNAL_ONLY`), and safety boundaries without state mutation.
* **Optimistic Concurrency & Stale-State Guard**: Compares client-submitted `expected_current_state` (stage, status, anomaly state) against real server truth. Mismatches return HTTP `409 STATE_CONFLICT` immediately.
* **Explicit Human Confirmation Gate (`#action-confirm-modal`)**: Disallows any direct action on sprite click. Operator must review preview, optionally input reason, and click explicit confirmation button.
* **Security & Auth Verification**: Enforces `admin_session` cookie authentication, same-origin CSRF verification, and Media Device Firewall (`403 FORBIDDEN_MEDIA_DEVICE`).
* **Canonical Audit Logging**: Records `action_id`, `requested_by`, `requested_at`, `expected_state`, `before_state`, `after_state`, and deterministic `audit_hash` (`aud_...`).
* **Staff Conversation Integration**: Appends formal notice into the responsible staff member's conversation thread (e.g. Joko, Irwan, Rina) so the team history truthfully reflects operator intervention.
* **Truth-Based UI Refresh**: On execution, Pixel Office refreshes `officeData` from canonical server state via `/api/admin/mission-control/office` rather than manipulating client DOM sprites optimistically.

### B. DEFERRED (Future Governance Milestones)
* **Manual Article Publication / Dispatch**: Direct publication bypass remains deferred to ensure publication safety gates and editorial review checklists cannot be skipped.
* **Task Reassignment between Staff**: Reassigning tasks across personnel roles requires capability-matching verification and handoff transaction logging.
* **Batch Multi-Task Escalation**: Operations are currently atomic and 1-to-1 to guarantee clean trace attribution.

### C. BLOCKED / FORBIDDEN (Permanent Safety Invariants)
* **Autonomous Publication**: `AUTO_PUBLISH = OFF`. No operator action can toggle autonomous background publication.
* **Jefry Execution Authority**: `management_advisor_jefry` has **0 execution authority**. Rejects all mutation attempts with `SAFETY_POLICY_VIOLATION`.
* **Media Worker Activation**: `mediaWorker = DISABLED`. Operator actions cannot force worker execution or invoke remote media generation.
* **Social Automation / External OAuth Mutation**: `SOCIAL_AUTOMATION = OFF`. Zero external Meta/Instagram posting capabilities.

---

## 5. Security & Invariant Verification

| Invariant | Setting | Verification Status |
| :--- | :--- | :--- |
| `automation_mode` | `OFF` | **Verified Unchanged** |
| `SOCIAL_AUTOMATION` | `OFF` | **Verified Unchanged** |
| `publishingAuthority` | `0` | **Verified Unchanged** |
| `JEV_MODE` | `shadow` | **Verified Unchanged** |
| `mediaWorker` | `DISABLED` | **Verified Unchanged** |
| `Jefry Execution Authority` | `NONE (0)` | **Verified Fail-Closed** |
| `Media Device Firewall` | `ACTIVE` | **Verified (403 Block)** |
| `Same-Origin CSRF Guard` | `ACTIVE` | **Verified (403 Block)** |

---

## 6. Test Suite & Validation Results

The test suite (`scripts/test-mission-control-liveops-3.js`) executes 15 targeted tests covering allowlist enforcement, preview truth, concurrency conflict handling, domain mutations, audit hash generation, idempotency, and safety boundaries:

```bash
node scripts/test-mission-control-liveops-3.js
```
* **Output:** `15 Passed, 0 Failed`.

Full regression validation across 13 test suites:
* `npx tsc --noEmit`: 0 errors (PASSED)
* `npm run build`: built in 6.77s (PASSED)
* `scripts/test-mission-control-liveops-3.js`: 15/15 PASSED
* `scripts/test-mission-control-liveops-2.js`: 10/10 PASSED
* `scripts/test-mission-control-liveops.js`: 78/78 PASSED
* `scripts/test-staff-registry.js`: 16/16 PASSED
* `scripts/test-mission-control-departments.js`: 18/18 PASSED
* `scripts/test-mission-control-expansion.js`: 12/12 PASSED
* `scripts/test-mission-control-pixel-office.js`: 20/20 PASSED
* `scripts/test-mission-control-job-animation.js`: 21/21 PASSED
* `scripts/test-mission-control-chat.js`: 20/20 PASSED
* `scripts/test-pixel-office-movement.js`: 33/33 PASSED
* `scripts/test-pixel-office-handoff.js`: 26/26 PASSED
* `scripts/test-pixel-office-job-trace.js`: 24/24 PASSED
* `scripts/test-soak-safety.js`: 54/54 PASSED
