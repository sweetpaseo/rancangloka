# SOAK-0: Production Safety Installation & Real Entry-Point Wiring Verification

**Date:** 2026-09-07  
**Milestone:** SOAK-0  
**Phase:** Production Safety Infrastructure Installation (Unattended Automation DISABLED)

---

## 1. Executive Summary

The SOAK-0 automation safety layer has been installed and verified in production without activating unattended automation. The safety infrastructure enforces an outer envelope around all automated publication, planning, and feedback entry points.

- **Automated Entry-Point Wiring:** Direct safety integration into `runPublisherDispatcher`, `executePublicationPlanner`, `runFeedbackCollection`, `processOverdueExecutions`, and `publishNow`.
- **Direct Bypass Audit:** Verified `UNATTENDED_SAFETY_BYPASS = NONE`. No background worker, cron trigger, or internal route can trigger unattended publishing without traversing the outer safety envelope.
- **Production Migrations:** Applied `0010_publication_feedback.sql` and `0011_automation_safety.sql` to Cloudflare remote D1 (`rancangloka_db`).
- **Initial Safe State:** Seeded single-row `automation_control` with `mode = 'OFF'` and `kill_switch_engaged = 0`. Seeded `circuit_breakers` (`global_publisher = CLOSED`, `d1_database = CLOSED`).
- **Runtime Deployment:** Cloudflare Worker deployed with version `eee39864-855b-47bb-acf5-1a360793d9d1`. Zero Cron triggers configured (`PRODUCTION_CRON_ENABLED = NO`).
- **Fail-Closed Verification:** `UNATTENDED_ALLOWED_NOW = NO`. Production activation gate strictly fails closed due to outstanding prerequisites (`BRIDGE_PROCESS_RESTART_RUNTIME_NOT_VERIFIED`, `PUB3_LIVE_OBSERVATION_PENDING`).
- **Zero Editorial / Publication Mutation:** Exactly 4 baseline articles in remote D1 verified unchanged (`ARTICLE_STATUS_UNCHANGED = YES`, `ARTICLE_BODY_UNCHANGED = YES`, `CONTENT_HASH_UNCHANGED = YES`, `PUBLISHED_AT_UNCHANGED = YES`). 0 plans, 0 executions, 0 receipts, 0 feedback snapshots.
- **Public Site Independence:** `https://rancangloka.com/`, `https://rancangloka.com/sitemap.xml`, and `https://rancangloka.com/rss.xml` verified 200 OK. Public read paths have zero dependency on automation safety state.

---

## 2. Real Entry-Point Wiring Audit

Each automated mutation pathway in the codebase was audited and wired to enforce safety before any operational logic executes:

| Entry Point | Target Function | Safety Controls Enforced | Fail-Closed Behavior |
| :--- | :--- | :--- | :--- |
| **Publisher Dispatcher** | `runPublisherDispatcher` | 1. Global Kill Switch<br>2. Capability `canPublishUnattended`<br>3. Breaker `global_publisher`<br>4. Catch-up burst protection<br>5. Rate limiter (`min_spacing_hours`, `daily_cap`) | Returns `skipped: true` with reason `AUTOMATION_MODE_BLOCKED: OFF` or breaker/kill reason. No queries for due executions. |
| **Publication Planner** | `executePublicationPlanner` | 1. Global Kill Switch<br>2. Capability `canPlan`<br>3. Effective capacity clamp (`computeEffectiveCapacity`) | Returns `plansCreated: 0, reason: 'AUTOMATION_OFF'`. Zero plans inserted. |
| **Feedback Collector** | `runFeedbackCollection` | 1. Global Kill Switch<br>2. Capability `canObserve` | Returns `snapshotsCreated: 0, reason: 'AUTOMATION_OFF'`. Zero snapshots collected. |
| **Overdue Catch-up** | `processOverdueExecutions` | Breaker check + Rate limiter check before processing recovered backlog | Spaced sequentially; burst batches strictly blocked. |
| **Controlled Publish** | `publishNow` | Emergency Kill Switch | Rejects immediate execution if kill switch engaged. |

### Safety Order of Operations
The automated publication pipeline strictly follows the canonical sequence:
```
automation mode 
  → kill switch 
  → health model 
  → circuit breaker 
  → activation gate 
  → rate/catch-up limiter 
  → existing PUB-2 eligibility / final prepublish gate 
  → two-phase claim 
  → atomic publish
```
PUB-2 business invariants and prepublish gates remain the canonical publication authority; the SOAK layer provides outer envelope protection.

---

## 3. Production Verification & Integrity

### D1 Migration Application
- `0010_publication_feedback.sql`: Feedback snapshots and metric tracking tables created.
- `0011_automation_safety.sql`: `automation_control`, `circuit_breakers`, `circuit_breaker_events`, and view `v_publication_run_ledger` created.

### Production Safety State
- `SELECT id, mode, kill_switch_engaged, kill_reason, updated_by FROM automation_control;`
  - Result: `id = 1, mode = 'OFF', kill_switch_engaged = 0, kill_reason = null, updated_by = 'system_init'`
- `SELECT id, state, failure_count, failure_threshold FROM circuit_breakers;`
  - Result:
    - `global_publisher`: `CLOSED`, `failure_count: 0`, `failure_threshold: 3`
    - `d1_database`: `CLOSED`, `failure_count: 0`, `failure_threshold: 2`

### Preflight vs Post-Install Baseline Comparison
| Metric | Preflight Baseline | Post-Install State | Delta |
| :--- | :--- | :--- | :--- |
| `articles` count | 4 | 4 | 0 |
| Article status | All `draft` | All `draft` | 0 |
| Article content hashes | Unchanged | Unchanged | 0 |
| `article_publication_plans` | 0 | 0 | 0 |
| `article_publication_executions` | 0 | 0 | 0 |
| `publication_execution_receipts` | 0 | 0 | 0 |
| `publication_feedback_snapshots` | 0 | 0 | 0 |
| Public HTTP status | 200 OK | 200 OK | Unchanged |

---

## 4. Activation Gate Fail-Closed Proof

Evaluation of the activation gate against current production realities:
```json
{
  "unattended_allowed": false,
  "failing_predicates": [
    "restart_safe_bridge_pass",
    "pub3_first_genuine_live_observation_pass"
  ],
  "reason": "Failing predicates: restart_safe_bridge_pass, pub3_first_genuine_live_observation_pass"
}
```
- `BRIDGE_PROCESS_RESTART_RUNTIME = BLOCK_OPERATOR_ACTION_REQUIRED`: Native MCP integration cannot safely restart the host bridge process without operator action.
- `CONTAINER_RESTART = DEFERRED_OPERATOR_CONTROLLED`: Container-level daemon supervision is deferred to host operations.
- `PUB3_LIVE_OBSERVATION_PENDING`: First genuine article has not yet been published in production; live feedback observation remains pending.

---

## 5. Test Regressions

All 10 unit test and local smoke suites passed cleanly:
- `test-soak-safety.js`: 54 assertions passed
- `smoke-soak-safety-local.js`: 38 assertions passed
- `test-publication-readiness.js`: 85 assertions passed
- `smoke-publication-readiness-local.js`: 63 assertions passed
- `test-publication-planner.js`: 67 assertions passed
- `smoke-publication-planner-local.js`: 74 assertions passed
- `test-publication-publisher.js`: 48 assertions passed
- `smoke-publication-publisher-local.js`: 70 assertions passed
- `test-publication-feedback.js`: 64 assertions passed
- `smoke-publication-feedback-local.js`: 70 assertions passed

**Total Tests Run:** 633 passed, 0 failed.  
**Production Build:** Astro build succeeded in 8.82s.
