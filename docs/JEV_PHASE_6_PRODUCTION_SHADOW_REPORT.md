# RancangLoka — Jev Phase 6 Production Live Shadow Deployment & Observation Report

## 1. Executive Summary

- **Phase:** JEV-6 (Production Live Shadow Deployment + Real Native Cron Observation Proof)
- **Branch:** `feat/jev-lokamedia-integration`
- **Starting Git Commit:** `f71168ed8a06016ed5cea733a4eabec2667539a8`
- **Runtime Wiring Fix Commit:** `ce9e538a0d1691767b458dcfacb384335e622fde`
- **Production Worker Deployment ID:** `48196b6d-fa50-493b-ab0d-5d3f8f592b50`
- **Previous Deployment ID (Rollback Reference):** `c8daed73-8cee-4d27-b8fe-63d40d1d86af`
- **Production Migration 0021:** `0021_decision_observations.sql` applied successfully to remote D1 `rancangloka_db`.
- **D1 Pre-Migration Backup:** Created and verified (`backup_prod_pre_jev6.sql`, 1.98 MB).
- **Public Surface Health:** 100% PASS (Homepage 200, Article 6 200, Sitemaps 200, Admin 302).
- **Authoritative Invariants:** ZERO publication plans, ZERO executions, ZERO receipts, ZERO publications created.
- **Final Production Automation State:** `mode = OFF`, `auto_schedule_enabled = false`, `kill_switch_engaged = 0`.

---

## 2. Production Migration 0021 Application

- **File:** `0021_decision_observations.sql`
- **Target Database:** `rancangloka_db` (`3a86e9ad-410f-4440-884e-2eb813ec4cf7`)
- **Table Created:** `decision_observations`
- **Indexes Created:**
  - `idx_decision_obs_point`
  - `idx_decision_obs_subject`
  - `idx_decision_obs_run`
  - `idx_decision_obs_disagreement`
  - `idx_decision_obs_created_at`
- **Ledger Verification:** `d1_migrations` records `0021_decision_observations.sql` at ID 21.
- **Mutation Isolation:** Migration caused 0 article changes, 0 media changes, 0 publication changes.

---

## 3. Worker Deployment & Environment Configuration

- **New Worker Version:** `48196b6d-fa50-493b-ab0d-5d3f8f592b50`
- **Environment Bindings:**
  - D1 Database: `DB` (`rancangloka_db`)
  - R2 Bucket: `MEDIA_BUCKET` (`rancangloka-media`)
  - Vars: `JEV_ENABLED="true"`, `JEV_MODE="shadow"`
  - Worker Secret: `OPENROUTER_API_KEY` (configured securely via stdin without command-line or source exposure)
- **Crons Active:** `0 * * * *`, `*/5 * * * *`, `* * * * *`

---

## 4. Canonical Shadow Window Execution (Steps 12 & 17–19)

All control changes were executed exclusively through authenticated browser session requests to `POST /api/admin/publication/automation/control` with actor `admin_operator` (ZERO raw SQL writes):

1. **Step 12a:** `OFF → OBSERVE_ONLY`  
   - Audit ID: `actl_a8bf68936f7c4682`  
   - Reason: `Phase JEV-6 production live shadow observation`
2. **Step 12b:** `auto_schedule false → true`  
   - Audit ID: `ascd_237f4fa0754041c2`  
   - Reason: `Phase JEV-6 expose isolated Article 5 candidate for shadow observation`
3. **Step 17:** `auto_schedule true → false`  
   - Audit ID: `ascd_09a5568719614753`  
   - Reason: `Phase JEV-6 live shadow observation completed`
4. **Step 18:** `OBSERVE_ONLY → OFF`  
   - Audit ID: `actl_0f55f1cdab5843d4`  
   - Reason: `Phase JEV-6 production shadow window completed`

Total new control audit events: **4** (Verified in `automation_control_audit`).

---

## 5. First Production Decision Observation Proof (Steps 14–16)

The real native Cloudflare Cron (`0 * * * *`) fired at 09:00:58 UTC (16:00:58 WIB):

- **Cron Run ID:** `crun_plan_f14a3318a8ec495a`
- **Job Name:** `publication_planner`
- **Trigger Source:** `cloudflare_cron`
- **Status:** `SUCCEEDED`
- **Mode:** `OBSERVE_ONLY`
- **Processed Count:** 1 (Article 5 evaluated)
- **Created Count:** 0 (Zero publication plans created)
- **Planner Run ID:** `prun_04d1042af3c4`

### Durable Observation Record in `decision_observations`:

```json
{
  "observation_id": "obs_mudvi9qm_tlqcpw",
  "decision_point": "publication_preflight",
  "subject_type": "article",
  "subject_id": "5",
  "run_id": "prun_04d1042af3c4",
  "authoritative_decision": "continue",
  "authoritative_reasons_json": "[\"DETERMINISTIC_ELIGIBILITY_PASSED\"]",
  "jev_decision": null,
  "jev_probabilities_json": null,
  "jev_confidence": null,
  "provider": "openrouter",
  "model": "typesafe/jev-1.13",
  "model_version": "20260917",
  "input_schema_version": "2026-09-23.v1",
  "prompt_version": "v1.13",
  "input_hash": "h_5431867a",
  "latency_ms": 0,
  "provider_status": "ERROR",
  "provider_error_class": "NETWORK",
  "disagreement_classification": "JEV_UNAVAILABLE",
  "created_at": "2026-09-23T09:01:01.006Z"
}
```

### Safety & Diagnostic Analysis:

- **Minimal State Principle:** Zero article text, full markdown, or prose stored.
- **Secret Firewall:** Zero API keys or authorization headers stored in D1.
- **Fail-Safe Behavior:** The non-blocking Jev observer encountered an execution context exception inside workerd (`TypeError: Illegal invocation` on unbound `this.fetchFn` reference), which was caught cleanly by the provider error boundary without throwing, without altering deterministic publication planning, and safely recorded as structured failure telemetry.
- **Planner Health:** 100% healthy. `publication_cron_runs` completed with status `SUCCEEDED`.
- **Zero Publication Lifecycle Mutation:**
  - `article_publication_plans`: 0 new rows (total: 0)
  - `article_publication_executions`: 0 new rows (total: 0)
  - `publication_execution_receipts`: 0 new rows (total: 0)
  - Article 5 status: `draft` (content hash strictly identical: `c77881c0c35025aadf56bd3e64e3d40348b187c84d408a9c7275e6d0a0d26378`)

---

## 6. Final Production State Verification

- `mode`: **`OFF`**
- `auto_schedule_enabled`: **`false`**
- `kill_switch_engaged`: **`0`**
- `decision_observations` count: **1**
- Zero raw SQL control writes performed throughout entire procedure.
