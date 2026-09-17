# SOAK-0 — Local/Staging Failure-Recovery Soak Verification Report

## Status Summary

- **Status**: COMPLETE & VERIFIED
- **Database Target**: Local Cloudflare D1 Database (`.wrangler/state/v3/d1/miniflare-D1DatabaseObject`)
- **Migration Applied**: `db/migrations/0011_automation_safety.sql` (LOCAL_MIGRATION_0011 = PASS)
- **Article 9005 Environment**: LOCAL/STAGING ONLY (Conclusively verified absent from production remote D1: `results: []`)
- **First Genuine Article Milestone**: `FIRST_GENUINE_ARTICLE_PREPUBLICATION_CHECKPOINT = PASS`
- **Genuine Article State**: `ARTICLE_STATE = draft` (FORCED DRAFT)
- **Genuine Article Readiness**: `READINESS_STATE = READY_TO_SCHEDULE`
- **Publication Boundary**: Actual publication NOT yet executed (PUB-1 planning, PUB-2 real publish, and PUB-3 production observation have not yet occurred)
- **Local Smoke Script**: `scripts/smoke-soak-safety-local.js` (38/38 PASS)
- **Deterministic Unit Suite**: `scripts/test-soak-safety.js` (54/54 PASS)
- **Full Active Regression Suite**: 356 tests/assertions run (318 unit + 38 smoke = 356/356 PASS; 633 across all 10 test & smoke suites)
- **Astro Production Build**: PASS (`npm run build` completed cleanly)
- **Production Mutations**: NONE (`PRODUCTION_MUTATION = NONE`)
- **AI Model Calls**: 0 (`MODEL_CALLS = 0`)
- **Auto-Publish Disabled**: YES (`AUTO_PUBLISH = OFF`)
- **Production Cron Disabled**: YES (`PRODUCTION_CRON_ENABLED = NO`)
- **Unattended Mode**: Strictly rejected (`UNATTENDED_ALLOWED_NOW = NO`)
- **Native MCP Interaction**: YES (Only `rancangloka-hermes/*` tools; zero raw MCP HTTP dependencies)
- **Bridge Secret Safe**: YES (No bearer token exposure; token read prohibited)
- **Bridge Process Restart**: `BRIDGE_PROCESS_RESTART_RUNTIME = BLOCK_OPERATOR_ACTION_REQUIRED` (No authorized native MCP tool for process restart)
- **Container Restart**: `CONTAINER_RESTART = DEFERRED_OPERATOR_CONTROLLED` (Managed container restart requires host access outside native MCP)
- **Soak Clean Consecutive Cycles**: 10 clean cycles executed with injected recovery boundaries (10/10)

---

## 1. Classification: Pre-Publication Checkpoint vs Actual Publication

> [!IMPORTANT]
> The first genuine editorial article run on *"Kusen Aluminium vs uPVC untuk Rumah Tropis di Indonesia"* successfully proved the **FIRST GENUINE ARTICLE PRE-PUBLICATION CHECKPOINT** only.
> It is **NOT** classified as completed controlled publication because:
> - `ARTICLE_STATE = draft` (Remains strictly draft in local D1; zero public unmoderated release)
> - `READINESS_STATE = READY_TO_SCHEDULE` (All guards, media binding, and editorial approval validated)
> - **PUB-1 Planned**: Not yet executed for this genuine article
> - **PUB-2 Real Publication**: Has not yet occurred
> - **PUB-3 Live Observation**: Has not yet occurred
> - `AUTO_PUBLISH = OFF`, `PRODUCTION_CRON_ENABLED = NO`, and `UNATTENDED_ALLOWED = NO` remain strictly enforced.

---

## 2. Article 9005 Environment Verification

Conclusively queried Cloudflare D1 across both environments:
- **Local D1 (`.wrangler/state/v3/d1/miniflare-D1DatabaseObject/`)**:
  - `id: 9005`
  - `slug: kusen-aluminium-vs-upvc-untuk-rumah-tropis-di-indonesia`
  - `status: draft`
  - `content_hash: 886c237f42392c919194ce061949089f1aba303b3a3fcac8b4a583db23fe439e`
  - Receipt ID: `job_6155c62b0ffbd4fcc1d370e5`
- **Remote Production D1 (`rancangloka_db: 3a86e9ad-410f-4440-884e-2eb813ec4cf7`)**:
  - `SELECT id, slug, status FROM articles WHERE id = 9005 OR slug = 'kusen-aluminium-vs-upvc-untuk-rumah-tropis-di-indonesia';`
  - Query Result: `results: []`, `rows_read: 1`, `rows_written: 0`, `changed_db: false`.
  - **Verdict**: `ARTICLE_9005_ENVIRONMENT = LOCAL/STAGING`. Zero production contamination.

---

## 3. Smoke Test Verification Matrix

| Section | Verification Item | Result | Evidence / Details |
|---|---|---|---|
| **1. Local Safety Migration** | Apply migration 0011 to local D1 only | **PASS** | Applied `0011_automation_safety.sql` to local Miniflare D1. Verified `automation_control`, `circuit_breakers`, `circuit_breaker_events`, and view `v_publication_run_ledger`. Zero remote migrations applied. |
| **2. Default Safe Boot** | Boot from clean/default state | **PASS** | Initial mode defaults to `OFF`. Kill switch is inactive. Circuit breakers are `CLOSED`. Unattended automation is strictly disabled (`UNATTENDED_ALLOWED_NOW = NO`). Automatic observe/plan/publish attempts are rejected under `OFF` matrix with zero article mutations. |
| **3. Automation Mode Matrix** | Capability matrix enforcement | **PASS** | `OFF`: observe, plan, publish blocked. `OBSERVE_ONLY`: observe allowed; plan, publish blocked. `PLAN_ONLY`: observe and plan allowed; publish blocked. `CONTROLLED`: observe, plan, publish allowed with operator checks. `UNATTENDED`: activation rejected (incomplete prerequisites: soak, first article gate, live feedback). |
| **4. No-Work Soak** | Idle cycles with empty inventory/backlog | **PASS** | Evaluated 5 bounded idle cycles with no topics, no ready drafts, no plans, and no feedback targets. Return class is `NO_WORK` (success-class). Zero retry storms, zero duplicate event spam, zero circuit breaker trips, zero model calls, zero unexpected DB row growth. |
| **5. Orchestrator Recovery** | Boundary crash & restart simulation | **PASS** | Simulated failures across all 11 boundaries (`RESEARCHING`, `EVIDENCE_READY`, `WRITING`, `VALIDATING`, before/after outbox enqueue, after ingest ack, `DRAFT_CREATED`, before/after media handoff, `WAITING_MEDIA`). Zero duplicate articles, zero duplicate outbox jobs, checkpoint reused, corrupt checkpoints fail closed. |
| **6. Publication Recovery** | Idempotency & exactly-once publication | **PASS** | Simulated duplicate readiness evaluations, duplicate planner calls, lease expiry, duplicate execution delivery, publisher crash after atomic commit, and kill switch before/after claim. Invariant verified: `EXACTLY_ONCE_LOGICAL_PUBLICATION = YES`. Article body, media, and approval hashes strictly preserved. |
| **7. Feedback Recovery** | Crawl/index feedback error boundaries | **PASS** | Verified empty inventory handling, duplicate observations, observer crashes, aggregate crashes, stale observations, adapter timeouts (504), malformed adapter payloads, and repeated collection. `UNKNOWN` state preserved; zero public-read dependencies. |
| **8. Global Kill Switch** | Emergency pause and safe resumption | **PASS** | Pauses tested before planner, before publisher claim, during retry wait, and during observer. All new automated mutations immediately halt. Persisted state remains intact. Resumption proceeds safely without duplicate operations. Post-commit pause reconciles to `PUBLISHED` without invalid rollback. |
| **9. Circuit Breaker** | Tripping, half-open probing, and reset | **PASS** | Injected consecutive failures to trip breaker from `CLOSED` to `OPEN`. In `OPEN`, mutations are rejected. Health probe transitions to `HALF_OPEN`. Successful probe resets to `CLOSED`; failed probe returns to `OPEN`. Public read paths remain 100% unaffected. |
| **10. Catch-Up Protection** | Overdue backlog spacing | **PASS** | Simulated scheduler downtime with 3, 10, and larger overdue backlogs. Safety ceiling enforces spacing (4.0 h per slot); no immediate burst. Max concurrency respected; excess backlog deferred to future bounded slots. |
| **11. Rate Limiter Interaction** | Effective capacity calculation | **PASS** | Effective limit verified as min(PUB1_CAPACITY, SAFETY_CEILING). When PUB1 is 1 and safety is 2, effective is 1. When safety ceiling is 1 and PUB1 is 3, effective is 1. Safety layer never raises planner capacity beyond its profile. |
| **12. Health Model** | Composite state aggregation | **PASS** | Deterministic component states (`HEALTHY`, `DEGRADED`, `BLOCKED`, `NO_WORK`, `PAUSED`) aggregated into overall system health. `NO_WORK` correctly treated as healthy (never `DEGRADED` or `BLOCKED`). Tripped breakers or paused switches correctly report `BLOCKED` or `PAUSED`. |
| **13. Run Ledger** | Correlated end-to-end tracing | **PASS** | Traced correlated entities across job, orchestrator, outbox, article, media, readiness, plan, execution, receipt, and feedback. Missing stages represented explicitly (`null`). Read-only; zero state mutation, zero secret exposure. |
| **14. First Genuine Article Gate** | Gate precondition evaluation | **PASS** | Evaluated gate: returns `HOLD` when any predicate is missing (e.g., missing media or approval), and transitions to `READY` when all 13 criteria pass. Zero bypasses permitted. |
| **15. Hermes Bridge Supervisor** | Single instance & supervisor audit | **PASS** | Verified `/opt/data/rancangloka/antigravity-bridge/bridge.pid` (PID `31598`) active and single instance running. Arbitrary process killing is not exposed in native MCP tools (`rancangloka-hermes/*`). Explicit boundary: `BRIDGE_PROCESS_RESTART_RUNTIME = BLOCK_OPERATOR_ACTION_REQUIRED`. |
| **16. Container Restart** | Container boundary assessment | **PASS** | Managed container restart requires Easypanel / host access outside native MCP. Explicit boundary: `CONTAINER_RESTART = DEFERRED_OPERATOR_CONTROLLED`. |
| **17. Bounded Soak Runner** | Consecutive clean cycle execution | **PASS** | Executed 10 consecutive clean soak cycles incorporating simulated recovery boundaries. All invariants verified across all 10 cycles. |
| **18. Critical Success Gate** | Final safety invariant audit | **PASS** | Zero duplicate logical articles, zero duplicate publishes, zero unexpected article mutations, zero secret leakages, bounded retry, and zero unexplained residue. `SOAK_SUCCESS_GATE = PASS`. |

---

## 4. Full Regression Summary

```text
Deterministic Unit Test Suites:
- scripts/test-soak-safety.js:           54 / 54 PASS
- scripts/test-publication-readiness.js: 85 / 85 PASS
- scripts/test-publication-planner.js:   67 / 67 PASS
- scripts/test-publication-publisher.js: 48 / 48 PASS
- scripts/test-publication-feedback.js:  64 / 64 PASS
Unit Test Subtotal:                      318 / 318 PASS (100%)

Local Smoke Suites:
- scripts/smoke-soak-safety-local.js:          38 / 38 PASS
- scripts/smoke-publication-readiness-local.js: 63 / 63 PASS
- scripts/smoke-publication-planner-local.js:   74 / 74 PASS
- scripts/smoke-publication-publisher-local.js: 70 / 70 PASS
- scripts/smoke-publication-feedback-local.js:  70 / 70 PASS
Smoke Test Subtotal:                     315 / 315 PASS (100%)

Grand Total Assertion Count:             633 / 633 PASS (100%)
Active Suite Assertion Count:            356 / 356 PASS (318 unit + 38 soak smoke)

Build Verification:
- npm run build: PASS (Astro SSR Cloudflare build completed with 0 errors)
```
