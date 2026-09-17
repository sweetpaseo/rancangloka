# 🧪 RancangLoka Publication Planner Local Smoke Report (PUBLICATION-1)

**Document Version:** 1.0.0  
**Milestone:** PUBLICATION-1 — Adaptive Publication Planner Local Smoke  
**Execution Environment:** Local Cloudflare D1 SQLite (`.wrangler/state/v3/d1/miniflare-D1DatabaseObject/*.sqlite`)  
**Status:** PASS / VERIFIED (All 15 Stages Verified, 74/74 Smoke Assertions Passed, 67 Unit Tests Passed, Build Succeeded)  
**Date:** 2026-09-07  

---

## 1. Executive Summary

Milestone **PUBLICATION-1 (Adaptive Publication Planner)** has successfully passed isolated local end-to-end smoke verification against the real local Cloudflare D1 store.

The planner strictly functions as an adaptive, deterministic temporal sequencer and inventory prioritizer. It consumes verified `READY_TO_SCHEDULE` inventory from **PUBLICATION-0**, calculates capacity using the bounded mathematical controller, applies deterministic pseudo-random jitter seeded by content and date, enforces spacing rules across categories and topics in `Asia/Jakarta` (WIB), and persists auditable publication plans in status **`PLANNED`**.

### Verified Guardrails
- **Zero Production Mutation:** Local D1 only. No remote migrations applied, no remote Cloudflare deployment.
- **Zero Public Mutation / Schedule Execution:** All articles remain strictly `status = 'draft'`. No CMS scheduling or dispatch executed (`SCHEDULE_EXECUTION = NO`, `PUBLIC_PUBLISH = NO`).
- **Zero AI / Model Calls:** Ranking, scoring, capacity adjustment, and jitter are 100% mathematical and deterministic (`MODEL_CALLS = 0`).
- **Strict Readiness Gate Requirement:** Unready articles (`NOT_READY`) are strictly invisible to the planner; human overrides cannot bypass readiness (`READINESS_BYPASS = NO`).
- **Quality Dominates Quota:** Quotas are never filled with artificial or unready articles. 20/day is NOT a universal quota.
- **Single Active Plan Invariant:** Guaranteed at the database level via SQLite partial unique index `uq_active_plan_per_article`.

---

## 2. Comprehensive 15-Stage Smoke Execution Results

### Stage 1: Isolated Local Setup & Migration 0008 Verification
- **Migration 0008 (`db/migrations/0008_publication_planner.sql`)** verified in local D1 table `d1_migrations`.
- All 3 relational planning tables verified:
  1. `article_publication_plans`
  2. `publication_planner_runs`
  3. `publication_plan_events`
- Database-level partial unique index verified:
  ```sql
  CREATE UNIQUE INDEX uq_active_plan_per_article 
  ON article_publication_plans(article_id) 
  WHERE plan_status = 'PLANNED';
  ```
- **Readiness Gate Admittance Verification:**
  - `NOT_READY` fixture (Article 900) strictly excluded from eligible inventory.
  - `READY_TO_SCHEDULE` fixtures (Articles 901, 902, 903) successfully admitted.
- **Outcome:** ✅ PASS

### Stage 2: Small Inventory — 3 Articles
- Ran planner with conservative `NEW` profile on 3 eligible ready articles.
- Verified:
  - Exactly 3 articles planned (`plannedCount = 3`).
  - Zero articles deferred (`deferredCount = 0`).
  - Effective capacity dynamically capped at eligible inventory count (`effectiveCapacity = 3`).
  - All target publication timestamps assigned in `Asia/Jakarta` (`target_publish_local` formatted with `WIB`).
  - Reason codes fully populated for all planned slots.
  - Repeated execution on the same date/inventory produced identical active plans with zero duplicate records created.
- **Outcome:** ✅ PASS

### Stage 3: Medium Inventory — 8 Articles
- Seeded inventory to 8 `READY_TO_SCHEDULE` articles with mixed operator priorities (e.g., Article 904 priority 90) and category spread.
- Ran planner with `GROWING` profile:
  - All 8 admitted candidates processed.
  - High-priority candidate (Article 904) deterministically selected for Slot #1 (`slotIndex = 0`).
  - Verified no article received more than one active plan.
- **Outcome:** ✅ PASS

### Stage 4: Large Inventory — 20 Articles
- Expanded inventory to 20 verified `READY_TO_SCHEDULE` articles across multiple categories.
- **Proof that 20/day is NOT automatically selected:**
  - `GROWING` profile (base capacity 8, ceiling 20) under baseline telemetry planned exactly 8 articles, cleanly deferring 12 articles (`plannedCount = 8`, `deferredCount = 12`).
  - `NEW` profile (base capacity 4, ceiling 8) planned strictly 4 articles, cleanly deferring 16 articles (`plannedCount = 4`, `deferredCount = 16`).
  - Proves safe profile capacity controls throughput rather than forcing universal 20/day quotas.
- **Outcome:** ✅ PASS

### Stage 5: Deterministic Jitter & Reproducibility
- Repeated execution with identical date, profile, and inventory:
  - Ranks, selected candidates, and target publication timestamps matched 100% across repeated runs.
  - Jitter formula $\text{SHA-256}(\text{dateStr} + \text{articleId} + \text{contentHash} + \text{version})$ produced identical jitter offsets down to the second (`-419s === -419s`).
- Modifying target date shifted target windows predictably while preserving deterministic ordering.
- **Outcome:** ✅ PASS

### Stage 6: Adaptive Capacity — Missing/No Feedback
- Evaluated `calculateEffectiveCapacity` with `signals = undefined`.
- Verified:
  - Engine safely defaults to conservative profile baseline (`baseCapacity = 8`).
  - Multipliers remain neutral (1.0).
  - Reason codes indicate `BASELINE_PROFILE_CAPACITY_NO_TELEMETRY`.
- **Outcome:** ✅ PASS

### Stage 7: Adaptive Capacity — Healthy Feedback
- Provided healthy telemetry fixture:
  - $\text{Indexing Ratio} = 0.95$ ($\ge 0.85 \implies M_{\text{index}} = 1.15$).
  - $\text{Median Crawl Latency} = 24\text{h}$ ($\le 48\text{h} \implies M_{\text{crawl}} = 1.10$).
  - $\text{Error Rate} = 0.001$ ($< 0.005 \implies M_{\text{error}} = 1.0$).
- Verified:
  - Effective capacity elevated conservatively from 8 to 10.
  - Hard safety ceiling strictly respected ($10 \le 20$).
  - Reason codes persist telemetry boost rationale.
- **Outcome:** ✅ PASS

### Stage 8: Adaptive Capacity — Degraded Feedback
- Provided degraded telemetry fixture:
  - $\text{Indexing Ratio} = 0.40$ ($< 0.60 \implies M_{\text{index}} = 0.70$).
  - $\text{Median Crawl Latency} = 180\text{h}$ ($> 120\text{h} \implies M_{\text{crawl}} = 0.80$).
  - $\text{Error Rate} = 0.05$ ($\ge 0.02 \implies M_{\text{error}} = 0.40$).
- Verified:
  - Capacity throttled down to safety floor ($C_{\min} = 2$).
  - Planner remains fully functional without errors; public site unaffected.
  - Throttle reasons recorded in run telemetry.
- **Outcome:** ✅ PASS

### Stage 9: Spacing Rules Enforcement
- Evaluated window assignment across daily operating hours (07:00 to 22:00 WIB):
  - Verified monotonic progression of target publication timestamps.
  - Zero timestamp collisions across all planned slots.
  - Minimum spacing respected between all consecutive articles.
  - All timestamps strictly in `Asia/Jakarta` timezone.
- **Outcome:** ✅ PASS

### Stage 10: Stale Plan Invalidation Protection
- Planned valid `READY_TO_SCHEDULE` articles, then verified fail-closed invalidation against 3 mutation vectors:
  - **Vector A (Content Mutation):** Altered `content_md` / `content_hash` $\implies$ Plan flagged `CONTENT_CHANGED`, transitioned to `BLOCKED`.
  - **Vector B (Media Swap):** Swapped active featured media asset $\implies$ Plan flagged `MEDIA_CHANGED`, transitioned to `BLOCKED`.
  - **Vector C (Readiness Revocation):** Revoked readiness to `NOT_READY` $\implies$ Plan flagged `READINESS_INVALID`, transitioned to `BLOCKED`.
- In all 3 vectors:
  - Blocked plans are strictly non-executable by downstream publishers.
  - Immutable audit trail preserved in `publication_plan_events`.
  - Re-planning verified: new plan created only after restoring valid readiness.
- **Outcome:** ✅ PASS

### Stage 11: Idempotency & Concurrency Protections
- Verified:
  - Repeated execution on identical parameters produces zero duplicate active plans (`plannedCount = 0` new plans).
  - Attempted direct concurrent insertion of a second active plan for the same article failed immediately with SQLite `UNIQUE constraint failed: article_publication_plans.article_id`.
  - Verified across entire database: exactly one active plan per article.
- **Outcome:** ✅ PASS

### Stage 12: Human Editorial Override System
- Verified full spectrum of editorial overrides:
  1. `prioritizeArticle`: Persisted operator priority, reflected in subsequent candidate scoring.
  2. `movePlanEarlier`: Shifted target window earlier within safety constraints; logged `RESCHEDULED` event.
  3. `movePlanLater`: Shifted target window later; logged `RESCHEDULED` event.
  4. `cancelPlan`: Cleanly transitioned plan to `CANCELLED`; logged `CANCELLED` event.
  5. `setPlannerPause`: Global pause flag blocked all automated planning runs until explicitly resumed.
  6. `overrideDailyCapacity`: Safely adjusted daily volume within clamped profile boundaries.
- **Critical Invariant Verification (`READINESS_BYPASS = NO`):**
  - Attempting human reschedule on unready or invalid plans threw `CANNOT_RESCHEDULE`.
  - Attempting to prioritize an unready article (Article 971) resulted in zero plans created.
  - Proved human overrides cannot bypass the **PUBLICATION-0** Readiness Gate.
- **Outcome:** ✅ PASS

### Stage 13: Plan State Integrity & Dispatch Isolation
- Audited database state across all runs:
  - Statuses created: strictly `PLANNED`, `SUPERSEDED`, `CANCELLED`, `BLOCKED`.
  - Zero plans ever created in `SCHEDULED`, `PUBLISHING`, or `PUBLISHED` status.
  - Zero articles transitioned to CMS `scheduled` or `published` status (`SCHEDULE_EXECUTION = NO`, `PUBLIC_PUBLISH = NO`).
- **Outcome:** ✅ PASS

### Stage 14: Security & Model Invariants
- Verified:
  - Zero AI or LLM provider calls made (`MODEL_CALLS = 0`).
  - Run telemetry (`signals_json`, `explanations_json`) scanned and confirmed 100% free of API tokens, bearer keys, and secrets.
  - Original article content and content hashes remained completely unchanged (`ARTICLE_BODY_UNCHANGED = YES`).
- **Outcome:** ✅ PASS

### Stage 15: Deterministic Local Cleanup
- Purged all temporary test fixtures (`id >= 900`, `ast_smoke_p1_%`, `prun_%`).
- Confirmed zero residual test records in `articles`, `media_assets`, `article_publication_readiness`, `article_publication_plans`, and `publication_plan_events`.
- Migration 0008, production code, unit tests, and documentation preserved intact.
- **Outcome:** ✅ PASS

---

## 3. Test Suite Summary

| Test Suite | Assertions Passed | Assertions Failed | Status |
| :--- | :---: | :---: | :---: |
| **`scripts/test-publication-planner.js` (Unit)** | 67 | 0 | **PASS** |
| **`scripts/smoke-publication-planner-local.js` (Local D1 Smoke)** | 74 | 0 | **PASS** |
| **Cloudflare Astro Build (`npm run build`)** | Built in 9.47s | 0 | **PASS** |

---

## 4. Operational Sign-off

Milestone **PUBLICATION-1 (Adaptive Publication Planner)** is locally complete, fully verified, and ready for promotion to **Controlled Production Readiness Smoke (PUBLICATION-1 Live Smoke)**.
