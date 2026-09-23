# RancangLoka — Jev Phase 5: Local Durable Shadow Soak & Cost Routing Simulation

**Date:** 2026-09-23  
**Branch:** `feat/jev-lokamedia-integration`  
**Base Checkpoint:** `8eefc45aa535098e84b34af38384f7a525b059cb`  
**Execution Environment:** Local Only (Zero production impact)

---

## 1. Overview & Objective

Phase JEV-5 validates the durability, reliability, and analytical telemetry of TypeSafe Jev running as a shadow decision observer integrated into RancangLoka's publication baseline.

### Core Safety Invariants Maintained:
- **Zero Production Mutations:** Local SQLite (`.wrangler/state`) only; zero migrations applied to production D1/R2; zero production deployments.
- **Zero Decision Authority:** Jev recommendations are purely analytical and fire-and-forget; deterministic software guards remain the sole authoritative gatekeeper.
- **Minimal State Principle:** Jev inputs and serialized telemetry contain strictly structured signals (counts, booleans, enums, sha256 input hashes); zero prose, zero article body text, and zero credentials or API keys.

---

## 2. Telemetry Schema & Durability Proof

- **Migration Applied:** `0021_decision_observations.sql` applied locally to the Miniflare D1 database.
- **Table:** `decision_observations` with indexes:
  - `idx_decision_obs_point`
  - `idx_decision_obs_subject`
  - `idx_decision_obs_run`
  - `idx_decision_obs_disagreement`
  - `idx_decision_obs_created_at`
- **Durability Verification:**
  - Observations before runtime connection close: **240**
  - Observations after full connection reinitialization: **240**
  - **DURABLE_TELEMETRY_VERIFIED = YES**

---

## 3. Synthetic Editorial Batch & Agreement Analytics

A deterministic batch of **240 scenarios** was executed across 5 core decision points:
1. `publication_preflight` (48 scenarios)
2. `research_sufficiency` (48 scenarios)
3. `model_routing` (48 scenarios)
4. `rewrite_routing` (48 scenarios)
5. `retry_routing` (48 scenarios)

### Agreement Distribution:
- **Total Observations:** 240
- **AGREE_CONTINUE:** 146
- **AGREE_STOP:** 35
- **JEV_MORE_CONSERVATIVE:** 6
- **JEV_MORE_PERMISSIVE:** 1
- **JEV_HUMAN_REVIEW:** 22
- **JEV_UNAVAILABLE:** 30 (deterministic failure soak cases)

### Key Rates:
- **Agreement Rate:** 75.42%
- **Disagreement Rate:** 12.08%
- **Unavailable Rate:** 12.50%

*(Note: In accordance with Jev-5 guidelines, agreement rate measures behavioral correlation, not absolute model accuracy.)*

---

## 4. Confidence Distribution

| Confidence Bucket | Total Observations | Disagreements |
| :--- | :--- | :--- |
| **0.00–0.49** | 0 | 0 |
| **0.50–0.69** | 12 | 12 |
| **0.70–0.84** | 26 | 4 |
| **0.85–0.94** | 107 | 12 |
| **0.95–1.00** | 65 | 1 |

- **High-Confidence Disagreements (>= 0.85):** 13 (primarily conservative human review triggers on ambiguous/complex topics).

---

## 5. Cost Routing Simulation (Shadow Only)

Comparing baseline strategy (`ALWAYS_STRONG_MODEL`) vs proposed `JEV_ROUTED_MODEL` across editorial model routing tasks:

- **Baseline Strong Model Calls:** 48
- **Jev Routed Strong Model Calls:** 10
- **Jev Routed Standard Model Calls:** 14
- **Jev Routed Cheap Model Calls:** 14
- **Jev Routed Skipped LLM Calls:** 4
- **Jev Additional Decision Calls:** 42
- **Potential Strong Call Reduction:** **79.17%**

*(Disclaimer: This is simulation only. No automated provider switching is enabled, and no monetary savings are claimed at this stage.)*

---

## 6. Quality Routing Analysis

### Rewrite Routing:
- `accept`: 16
- `targeted_revision`: 14
- `full_regeneration`: 8
- `human_review`: 4

### Research Sufficiency:
- `continue_to_writer`: 19
- `research_more`: 13
- `human_review`: 10

---

## 7. Failure Soak & Telemetry Sizing

- **Failure Scenarios Tested:** `CONFIG_MISSING`, `HTTP_401_UNAUTHORIZED`, `HTTP_429_RATE_LIMIT`, `TIMEOUT`, `NETWORK_ERROR`, `MALFORMED_OUTPUT`, `UNKNOWN_PROVIDER_ERROR`.
- **Failure Behavior:** 100% non-blocking; zero pipeline aborts; observations persisted with `provider_status = ERROR` and exact `provider_error_class`.
- **Average Row Size:** 995 Bytes
- **Batch Size (240 rows):** 238,819 Bytes (~233 KB)
- **Projected 10,000 Observations Size:** ~9.49 MB (well within Cloudflare D1 storage limits).

---

## 8. Publication Regression Summary

All existing publication and safety test suites were executed on the integration branch with 100% pass rates:
- `test-soak-safety.js`: 54/54 PASS
- `test-publication-planner.js`: 67/67 PASS
- `test-publication-publisher.js`: 48/48 PASS
- `test-phase5l2-auto-policy.js`: 11/11 PASS
- `test-phase5l6-dual-authorization.js`: 23/23 PASS
- `test-phase5l12b-canonical-operator-control.js`: 15/15 PASS
- `test-decision-engine.js`: 18/18 PASS
- `test-decision-router.js`: 14/14 PASS
- `test-decision-telemetry.js`: 8/8 PASS
- `test-jev-lokamedia-integration.js`: 5/5 PASS
- `test-phase5-durable-soak.js`: 5/5 PASS
- `tsc --noEmit`: PASS (0 errors)
- `astro build`: PASS (complete)
