# PUBLICATION-3 — Crawl & Index Feedback Implementation Report

## Status Summary

- **Status**: COMPLETE & LOCAL-TESTED
- **Migration**: `db/migrations/0010_publication_feedback.sql`
- **Core Types & Constants**: `src/lib/publication/feedback-types.ts`
- **Feedback Engine & Observer Service**: `src/lib/publication/feedback-service.ts`
- **Admin Control Endpoint**: `src/pages/api/admin/publication/feedback.ts`
- **Unit & Deterministic Test Suite**: `scripts/test-publication-feedback.js` (64/64 PASS)
- **Zero Production Mutation**: Yes (No remote D1 migrations applied, no Cloudflare Worker deployment)
- **Zero AI Model Calls**: Yes (`MODEL_CALLS = 0`)
- **Auto-Publish Disabled**: Yes (`AUTO_PUBLISH = OFF`)
- **Production Cron Disabled**: Yes (`PRODUCTION_CRON_ENABLED = NO`)

---

## Architecture & Subsystem Highlights

### 1. Dedicated Schema Persistence (`db/migrations/0010_publication_feedback.sql`)
Implements four append-oriented and snapshot tables:
- `publication_observations`: Immutable log of discrete facts (edge HTTP status, sitemap membership, robots indexability, canonical matching, authoritative search console inspection results, analytics heuristics). Supports deduplication hashing (`dedup_hash`) for identical observations within a calendar day.
- `publication_feedback_snapshots`: Point-in-time canonical state per published article resolving conflicts via source precedence and recording exact index latency.
- `publication_feedback_aggregates`: Deterministic rolling cohort aggregates across rolling windows (default 14 days, 30 articles) providing normalized `IndexHealthSignals` directly consumable by PUBLICATION-1.
- `publication_feedback_runs`: Lease-locked execution trail tracking observation collection batches, unchanged counts, error counts, and aggregate IDs.

### 2. Invariant: Non-Authoritative Sources Never Imply INDEXED
- **Critical Rule**: HTTP 200 $\ne$ INDEXED. Sitemap membership $\ne$ INDEXED.
- First-party edge probe and sitemap parser only verify edge reachability (`HTTP_200`, `PRESENT`, `CANONICAL_MATCH`, `ROBOTS_ALLOWED`).
- If no authoritative source (e.g. Google Search Console URL Inspection API) is available or configured, `index_status` strictly remains `UNKNOWN`.
- Only sources marked with `CONFIDENCE_AUTHORITATIVE` (`SEARCH_CONSOLE`, `MANUAL_OPERATOR`) can transition `index_status` to `INDEXED` or `NOT_INDEXED`.

### 3. Conflict Resolution & Source Precedence
- Conflicting observations (e.g. organic traffic heuristic claiming indexed vs. Google Search Console confirming not indexed) are **never deleted or overwritten** in raw observation logs.
- Snapshot resolver evaluates sources according to strict precedence:
  1. Authoritative provider (`SEARCH_CONSOLE`, `MANUAL_OPERATOR`)
  2. Direct probe (`FIRST_PARTY_RUNTIME`, `SITEMAP_PARSER`)
  3. Heuristic (`ANALYTICS`)
- When sources disagree, snapshot sets `has_conflicts = 1` and logs human-readable resolution notes (`conflict_notes`).

### 4. Index Latency Calculation
- `index_latency_hours` is calculated strictly when:
  1. `index_status === 'INDEXED'`
  2. Authoritative `first_indexed_at` timestamp is present
  3. Canonical `published_at` or receipt `actual_published_at` timestamp is present
- Elapsed hours are computed deterministically as `(first_indexed_at - published_at) / 3600000` rounded to 2 decimal places.
- For all other cases, `index_latency_hours` remains strictly `null` (`UNKNOWN`).

### 5. Freshness & Missing Data Handling
- Standard TTL is 72 hours (`FRESHNESS_TTL_HOURS = 72`).
- Observations older than 72 hours are classified as stale. If fresh observation coverage $< 20\%$, health regime transitions to `REGIME_STALE`, which conservatively forces `RECOMMENDATION_HOLD`.
- Missing external telemetry (e.g., Search Console unconfigured or failing) operates with `NullTelemetryAdapter`, maintaining `REGIME_PARTIAL` with safe baseline capacity (`RECOMMENDATION_HOLD`), avoiding any crashes or stalls.

### 6. Advisory Recommendation Model
- `RECOMMENDATION_INCREASE_ONE_STEP`: Requires `REGIME_HEALTHY`, sample size $\ge 10$, observation coverage $\ge 85\%$, indexing success ratio $\ge 85\%$, median latency $\le 48$h, 5xx rate $< 0.5\%$, sitemap coverage $\ge 95\%$.
- `RECOMMENDATION_HOLD`: Insufficient sample ($< 5$), stale data, partial coverage, or baseline operation.
- `RECOMMENDATION_DECREASE_ONE_STEP`: Degraded indexing ratio ($< 60\%$) or excessive latency ($> 120$h).
- `RECOMMENDATION_PAUSE_GROWTH`: Severe errors ($\ge 2\%$ 5xx rate or $\ge 2\%$ publication execution error rate).
- **Zero Planner Mutation**: Subsystem outputs advisory recommendation and telemetry signals only. Planner configuration and active publication plans remain untouched.

### 7. Isolation & Security
- **Read-Path Independence**: The entire feedback subsystem operates out-of-band. Complete failure of edge probes, adapters, or database writes has zero impact on public article SSR or sitemap generation.
- **Mutual Exclusion**: Concurrency lease on `publication_feedback_runs` prevents overlapping collection runs.
- **Zero Secrets**: All telemetry JSON payloads, logs, and database records are strictly audited to be secret-free.

---

## Test Verification Summary

- `scripts/test-publication-feedback.js`: **64/64 PASS** (covering all 50 specification requirements).
- `scripts/test-publication-publisher.js`: **48/48 PASS** (PUBLICATION-2 regression suite).
- `scripts/test-publication-planner.js`: **67/67 PASS** (PUBLICATION-1 regression suite).
- `scripts/test-publication-readiness.js`: **85/85 PASS** (PUBLICATION-0 regression suite).
- Total deterministic tests passed: **264/264 PASS**.
- `npm run build`: Clean Astro + Cloudflare build without errors.
