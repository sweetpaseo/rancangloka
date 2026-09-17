# 🗓️ RancangLoka Adaptive Publication Planner — Implementation Report (PUBLICATION-1)

**Document Version:** 1.0.0  
**Milestone:** PUBLICATION-1 — Adaptive Publication Planner Implementation  
**Status:** LOCAL PASS / VERIFIED (All 36 Criteria Tested, 67/67 Assertions Passed, Build Complete)  
**Date:** 2026-09-07  

---

## 1. Executive Summary

Milestone **PUBLICATION-1 (Adaptive Publication Planner)** has been implemented and locally verified. It introduces a capacity-aware, deterministic, and fail-closed publication sequencing engine that bridges verified `READY_TO_SCHEDULE` inventory from **PUBLICATION-0** to active, auditable plans in state **`PLANNED`**.

$$\mathbf{READY\_TO\_SCHEDULE}\;(\text{PUBLICATION-0}) \longrightarrow \text{Adaptive Capacity \& Spacing Planner} \longrightarrow \mathbf{PLANNED}\;(\text{PUBLICATION-1})$$

### Invariant Enforcements
- **Zero Production Mutation:** Local/staging verification only. No remote D1 changes, no Cloudflare deployment.
- **Separate State Domains:** Articles remain strictly `draft`. No scheduling or publishing in CMS (`articles.status` untouched).
- **Zero Model Calls:** Ranking, capacity scaling, jitter, and window assignment are 100% mathematical and deterministic (`MODEL_CALLS = 0`).
- **No Fixed 20/Day Quota:** 20/day is confirmed as a configurable ceiling for `GROWING`, not universal law.
- **Quality Dominates Quota:** If only $N$ articles are ready, exactly $N$ articles are planned. No artificial quotas are filled.
- **Operational Timezone:** Standardized on `Asia/Jakarta` (WIB, UTC+7).

---

## 2. Implemented Components

### 2.1 Persistence Layer (`db/migrations/0008_publication_planner.sql`)
Introduced dedicated relational tables to isolate planning state:
1. **`article_publication_plans`**:
   - `plan_id` (Unique text identifier, e.g. `plan_ecd58d5aac033631`)
   - `article_id`, `readiness_id`, `content_hash`, `featured_asset_id`
   - `target_publish_at` (UTC ISO 8601), `target_publish_local` (`YYYY-MM-DD HH:MM:SS WIB`), `timezone` (`Asia/Jakarta`)
   - `plan_status` (`PLANNED`, `SUPERSEDED`, `CANCELLED`, `BLOCKED`)
   - `planner_profile`, `planner_version`, `priority_score`, `slot_index`, `jitter_seconds`, `reason_codes`
   - `supersedes_plan_id`
   - **Partial Unique Index**: `uq_active_plan_per_article` on `(article_id) WHERE plan_status = 'PLANNED'`. Guarantees exactly one active plan per article.
2. **`publication_planner_runs`**:
   - Stores complete run-level telemetry, effective capacity, eligible/planned/deferred counts, signal multipliers, and candidate decision logs.
3. **`publication_plan_events`**:
   - Immutable audit trail recording events: `CREATED`, `SUPERSEDED`, `RESCHEDULED`, `PRIORITIZED`, `CANCELLED`, `BLOCKED`.

### 2.2 Core Types & Contracts (`src/lib/publication/planner-types.ts`)
- Configurable profiles: `NEW`, `GROWING`, `ESTABLISHED`, `HIGH_AUTHORITY`.
- Planning lifecycle states: `UNPLANNED`, `PLANNED`, `SUPERSEDED`, `CANCELLED`, `BLOCKED`.
- Normalized `IndexHealthSignals` interface for future PUBLICATION-3 search/indexing telemetry.
- Strongly-typed candidate models, scoring weight interfaces, and execution result schemas.

### 2.3 Mathematical & Temporal Engine (`src/lib/publication/planner-engine.ts`)
- **Adaptive Capacity Controller (`calculateEffectiveCapacity`):**
  - Combines bounded multipliers ($M_{\text{index}}$, $M_{\text{crawl}}$, $M_{\text{error}}$, $M_{\text{backlog}}$).
  - Defaults to conservative baseline when telemetry is absent.
  - Clamps output strictly between $C_{\min}$ and $C_{\max}$.
  - Enforces "Quality Dominates Quota": $C_{\text{effective}} = \min(C_{\text{clamped}}, N_{\text{ready}})$.
- **Deterministic Pseudo-Random Jitter (`computeDeterministicJitter`):**
  - Seed: $\text{SHA-256}(\text{dateStr} + \text{articleId} + \text{contentHash} + \text{plannerVersion})$.
  - Bounded within $\pm \text{maxJitterMinutes}$.
  - Same inputs strictly produce the exact same timestamp down to the second.
- **Deterministic Non-LLM Ranking (`scoreAndRankCandidates`):**
  - Weighted combination of FIFO wait time ($S_{\text{age}}$), operator priority ($S_{\text{op}}$), category diversity boost ($S_{\text{balance}}$), and topic cannibalization penalty ($P_{\text{cannibalism}}$).
- **Temporal Window Sequencing (`assignPublicationWindows`):**
  - Spreads articles across the active daily window (07:00 to 22:00 WIB).
  - Enforces minimum spacing between consecutive articles.
  - Enforces category anti-clustering ($\ge 120$m in GROWING profile).

### 2.4 Service Layer & Human Overrides (`src/lib/publication/planner-service.ts`)
- **Eligible Candidate Query (`getEligibleReadyCandidates`):**
  - Ingests strictly `articles.status = 'draft'` where latest `article_publication_readiness` is `is_ready = 1` (`READY_TO_SCHEDULE`), matching `content_hash`, validated active featured media, and approved human sign-off.
- **Stale Plan Protection (`validatePlanFreshness`):**
  - Detects if content, media, or approval was modified after plan creation.
  - Automatically transitions stale plans to `BLOCKED`.
  - Ensures downstream dispatchers (PUBLICATION-2) never publish stale content.
- **Human Controls:**
  - `prioritizeArticle`: Editor priority override.
  - `reschedulePlan`: Move publication window (refuses stale/unready articles).
  - `movePlanEarlier` / `movePlanLater`: Relative window shifting.
  - `cancelPlan`: Transitions plan to `CANCELLED` and logs event.
  - `setPlannerPause`: Emergency pause toggle in `settings`.
  - `overrideDailyCapacity`: Temporary capacity adjustment within safety bounds.

---

## 3. Verification & Test Results

The test suite (`scripts/test-publication-planner.js`) was executed locally against an in-memory SQLite database matching production D1 with all migrations (0001 through 0008).

### Test Matrix Summary (36/36 Requirements, 67/67 Assertions Passed)

| # | Test Requirement | Result | Verification Details |
| :---: | :--- | :---: | :--- |
| **1** | NOT_READY article excluded | **PASS** | Article with `is_ready = 0` excluded from eligible candidate pool. |
| **2** | READY_TO_SCHEDULE article eligible | **PASS** | Fully approved draft with matching `content_hash` successfully admitted. |
| **3** | Deterministic ranking stable | **PASS** | Identical ranking order produced across multiple runs; FIFO aging verified. |
| **4** | Repeated same run idempotent | **PASS** | Re-executing planner on same inventory creates zero duplicate plans. |
| **5** | One active plan per article | **PASS** | Partial unique index strictly enforces single `PLANNED` row per article. |
| **6** | Deterministic jitter stable | **PASS** | Jitter calculation reproducible (`259s === 259s`) and bounded within window. |
| **7** | Asia/Jakarta applied | **PASS** | All plans assigned `timezone = 'Asia/Jakarta'` with local `'... WIB'` strings. |
| **8** | Minimum spacing enforced | **PASS** | Spacing between consecutive plans strictly $\ge 60$ minutes. |
| **9** | Category spacing enforced | **PASS** | Same-category articles separated by $\ge 120$ minutes. |
| **10** | Topic spacing enforced | **PASS** | Keyword conflict with recent articles applies 50-point cannibalism penalty. |
| **11** | Daily capacity enforced | **PASS** | Output strictly clamped at profile ceiling. |
| **12** | Low inventory does not fill artificial quota | **PASS** | 3 ready articles results in exactly 3 planned (quality dominates quota). |
| **13** | NEW profile conservative | **PASS** | Base 4/day, ceiling 8/day, spacing 150 min verified. |
| **14** | GROWING profile configurable | **PASS** | Base 8/day, ceiling 20/day verified. |
| **15** | Fixed 20/day not universal | **PASS** | Verified 20/day is not universal law across profiles. |
| **16** | Missing feedback uses baseline | **PASS** | Defaults to `baseCapacity` with reason `BASELINE_PROFILE_CAPACITY_NO_TELEMETRY`. |
| **17** | Healthy feedback raises capacity | **PASS** | High indexing ratio and fast crawl elevate capacity gradually within ceiling. |
| **18** | Degraded feedback lowers capacity | **PASS** | High error rate and slow crawl throttle capacity safely. |
| **19** | Invalid feedback fails safe | **PASS** | NaN / Infinity values clamp to safe baseline. |
| **20** | Content change invalidates plan | **PASS** | Modifying `content_md` causes `validatePlanFreshness` to mark plan `BLOCKED`. |
| **21** | Media change invalidates plan | **PASS** | Swapping featured media causes `validatePlanFreshness` to mark plan `BLOCKED`. |
| **22** | Readiness change invalidates plan | **PASS** | Readiness snapshot failure causes `validatePlanFreshness` to mark plan `BLOCKED`. |
| **23** | Stale plan not executable | **PASS** | Blocked plans excluded from active `PLANNED` state. |
| **24** | Duplicate concurrency prevented | **PASS** | Database unique constraint blocks concurrent duplicate active plans. |
| **25** | Operator priority changes rank | **PASS** | Setting priority 95 immediately advances article to rank #1. |
| **26** | Cancel plan works | **PASS** | Transitions plan to `CANCELLED` and emits audit event. |
| **27** | Move earlier works safely | **PASS** | Shifts target window earlier by 30 min and logs event. |
| **28** | Move later works | **PASS** | Shifts target window later by 45 min and logs event. |
| **29** | Pause planning works | **PASS** | Setting `planner_paused = 1` halts automated execution fail-closed. |
| **30** | Human override cannot bypass readiness | **PASS** | Rescheduling an unready or stale plan throws `CANNOT_RESCHEDULE`. |
| **31** | History preserved across replan | **PASS** | Old plan marked `SUPERSEDED`, new plan references it, full event trail intact. |
| **32** | Article body unchanged | **PASS** | All article Markdown bodies and `content_hash` values strictly unaltered. |
| **33** | No publish permission | **PASS** | Zero articles transitioned to `published`. |
| **34** | No schedule execution | **PASS** | `articles.status` remains `draft` throughout. |
| **35** | No AI/model calls | **PASS** | `MODEL_CALLS = 0`. |
| **36** | Secret-free logs/events | **PASS** | Verified no API keys, tokens, or credentials in run logs or event payloads. |

---

## 4. Local Build Status

- Command: `npm run build`
- Output: Server built in 7.64s (`@astrojs/cloudflare` SSR bundle complete, client assets generated, zero TypeScript compilation errors).
