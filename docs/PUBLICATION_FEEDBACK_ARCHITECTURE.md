# 🔭 PUBLICATION-3: Crawl & Index Feedback Subsystem Architecture

**Document Version:** 1.0.0  
**Milestone:** PUBLICATION-3 — Crawl / Index Feedback  
**Status:** **AUDIT & DESIGN ONLY (FROZEN)**  
**Safety Invariants:** `AUTO_PUBLISH = OFF` | `PRODUCTION_CRON_ENABLED = NO` | `MODEL_CALLS = 0` | `PRODUCTION_MUTATION = NONE`  
**Date:** 2026-09-07  

---

## 1. Executive Summary & Purpose

The **PUBLICATION-3 (Crawl / Index Feedback)** subsystem establishes a closed-loop observation and feedback pipeline that measures real-world search discovery, crawl health, and indexing velocity for published articles, and supplies normalized, auditable signals to the **PUBLICATION-1 (Adaptive Publication Planner)**.

```
┌─────────────────────────┐      ┌─────────────────────────┐      ┌─────────────────────────┐
│  PUBLISHED ARTICLES     │ ───> │  PUBLICATION-3          │ ───> │  PUBLICATION-1          │
│  (D1 + Receipts + Edge) │      │  Observation & Feedback │      │  Adaptive Planner Input │
└─────────────────────────┘      └─────────────────────────┘      └─────────────────────────┘
                                              │                                  │
                                              ▼                                  ▼
                                 [Deterministic Telemetry]          [Safe Capacity Modulation]
                                 • Edge HTTP 200 & Headers          • Quality Dominates Quota
                                 • XML Sitemap Verification         • Index Multiplier (mIndex)
                                 • Authoritative Search Index       • Crawl Multiplier (mCrawl)
                                 • Measured Index Latency           • Error Throttle (mError)
```

### Strict Non-Goals & Architectural Boundaries
1. **Zero Content Mutation:** Cannot edit article text, markdown, HTML, metadata, titles, or summaries.
2. **Zero Publishing Permission:** Cannot publish, unpublish, schedule, or transition article CMS status.
3. **Zero Planning Mutation:** Cannot insert, modify, or delete publication plans directly. Supplies normalized feedback metrics only.
4. **Zero AI / Model Calls:** Observation evaluation, scoring, aggregation, and recommendation are 100% deterministic code (`MODEL_CALLS = 0`).
5. **Zero Web Read-Path Coupling:** Fully isolated from public SSR rendering. Failures in feedback collection cannot impact website availability or performance.
6. **No Phantom Indexing Claims:** Under no circumstances is an HTTP 200 response or sitemap presence treated as proof that a search engine has indexed the page. `UNKNOWN` is a strict first-class citizen.
7. **Production Cron Stays Disabled:** `PRODUCTION_CRON_ENABLED = NO`. Feedback execution is triggered via controlled administrative endpoints or manual test fixtures.

---

## 2. Audit of Current Publication & Public Surface

| Surface Component | Existing Implementation / Behavior | Feedback Role & Implications |
|---|---|---|
| **Published Article Schema** | `articles` table: `id`, `slug`, `title`, `content_hash`, `status`, `published_at`, `canonical_url`, `updated_at`. | Target cohort for feedback observation. Only articles with `status = 'published'` are admitted. |
| **Publication Receipts** | `publication_execution_receipts` table: `receipt_id`, `execution_id`, `plan_id`, `article_id`, `slug`, `content_hash`, `canonical_url`, `actual_published_at`, `outcome = 'SUCCESS'`. | Authoritative publication anchor. Provides immutable `actual_published_at` timestamp required for index latency calculation. |
| **Canonical URL Format** | `https://rancangloka.com/{slug}` stored in receipts and emitted by SSR `<link rel="canonical" href="...">`. | Verified target URL for first-party edge and search console observations. |
| **XML Sitemap Index** | `src/pages/sitemap.xml.ts` yielding `sitemapindex` with child sitemaps: `post-sitemap.xml`, `sitemap-news.xml`, `category-sitemap.xml`, `page-sitemap.xml`. | Verifies primary discovery entry point. First-party observer crawls this to verify ingestion. |
| **Post Sitemaps** | `src/pages/sitemap-posts-[page].xml.ts` paginating published articles (1,000 per page) with `<loc>` and `<lastmod>`. | Validates whether published articles are correctly listed in standard XML sitemaps. |
| **Google News Sitemap** | `src/pages/sitemap-news.xml.ts` serving published articles $\le 48$h with `<news:news>` schema. | Validates rapid discovery surface for fresh editorial content. |
| **Public Article Route** | `src/pages/[slug].astro` SSR route. Returns HTTP 200 with complete rendered HTML if `status = 'published'`, or HTTP 404 if draft. | Target of first-party HTTP probe. Measures response status, server timing, and verifies `<meta name="robots">`. |
| **Category & Home Surface** | `getAllArticles(db, limit, offset, 'published')`. | Verifies published article discovery through internal navigational taxonomy. |
| **Existing Analytics / GSC** | Site settings key `google_search_console_code` (HTML meta verification tag). | **Zero existing backend GSC API client or OAuth credentials.** First-party observation must work provider-free. |
| **Planner Feedback Contract** | `IndexHealthSignals` interface in `src/lib/publication/planner-types.ts`. | Pre-existing contract in PUBLICATION-1. Fully compatible target for normalized feedback output. |
| **Planner Capacity Engine** | `calculateEffectiveCapacity` in `src/lib/publication/planner-engine.ts`. | Consumes `IndexHealthSignals`. Implements multipliers `mIndex`, `mCrawl`, `mError`, `mBacklog` clamped to `minCapacity` and `maxCeiling`. |

---

## 3. Feedback Data Model & Schema Design

To ensure strict separation of concerns, all feedback state is isolated in dedicated tables. No feedback columns are added to `articles` or `article_publication_plans`.

```sql
-- ============================================================================
-- Migration: 0010_publication_feedback.sql (Design Specification)
-- Description: Post-Publication Crawl, Index & Telemetry Feedback Layer
-- ============================================================================

-- 1. Table: publication_observations
-- Immutable, append-only log of discrete observations from all sources
CREATE TABLE IF NOT EXISTS publication_observations (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    observation_id TEXT NOT NULL UNIQUE,                -- E.g. 'obs_k8f92j4n8d'
    article_id INTEGER NOT NULL REFERENCES articles(id) ON DELETE CASCADE,
    receipt_id TEXT REFERENCES publication_execution_receipts(receipt_id),
    canonical_url TEXT NOT NULL,
    
    -- Source Identification & Provenance
    source_class TEXT NOT NULL,                         -- 'FIRST_PARTY_RUNTIME' | 'SITEMAP_PARSER' | 'SEARCH_CONSOLE' | 'MANUAL_OPERATOR'
    source_name TEXT NOT NULL,                          -- E.g. 'edge_probe', 'gsc_inspection_api', 'sitemap_crawler'
    observation_type TEXT NOT NULL,                     -- 'EDGE_STATUS' | 'SITEMAP_PRESENT' | 'INDEX_STATUS' | 'SEARCH_IMPRESSIONS'
    
    -- Observed Data & State
    status_value TEXT NOT NULL,                         -- E.g. 'HTTP_200', 'PRESENT', 'INDEXED', 'NOT_INDEXED', 'UNKNOWN'
    metric_value REAL,                                  -- Numeric metric if applicable (e.g. latency ms, impressions)
    confidence_class TEXT NOT NULL,                     -- 'AUTHORITATIVE' | 'DIRECT_PROBE' | 'HEURISTIC'
    reason_code TEXT,                                   -- Reason code or error string
    raw_payload_json TEXT,                              -- Structured raw response for auditability
    
    -- Temporal Provenance
    observed_at DATETIME NOT NULL,                      -- Time observation occurred
    source_timestamp DATETIME,                          -- External timestamp from provider if provided
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CHECK (source_class IN ('FIRST_PARTY_RUNTIME', 'SITEMAP_PARSER', 'SEARCH_CONSOLE', 'ANALYTICS', 'MANUAL_OPERATOR', 'FUTURE_ADAPTER')),
    CHECK (confidence_class IN ('AUTHORITATIVE', 'DIRECT_PROBE', 'HEURISTIC'))
);

CREATE INDEX IF NOT EXISTS idx_obs_article_type ON publication_observations(article_id, observation_type);
CREATE INDEX IF NOT EXISTS idx_obs_observed_at ON publication_observations(observed_at DESC);
CREATE INDEX IF NOT EXISTS idx_obs_source ON publication_observations(source_class, observation_type);

-- 2. Table: publication_feedback_snapshots
-- Latest resolved point-in-time state per article based on deterministic precedence
CREATE TABLE IF NOT EXISTS publication_feedback_snapshots (
    article_id INTEGER PRIMARY KEY REFERENCES articles(id) ON DELETE CASCADE,
    receipt_id TEXT REFERENCES publication_execution_receipts(receipt_id),
    canonical_url TEXT NOT NULL,
    
    -- Discovery & Sitemap State
    in_sitemap INTEGER NOT NULL DEFAULT 0,              -- 0 = NO, 1 = YES
    in_news_sitemap INTEGER NOT NULL DEFAULT 0,         -- 0 = NO, 1 = YES
    last_sitemap_check_at DATETIME,
    
    -- Edge Response State
    edge_http_status INTEGER,                           -- 200, 404, 500, etc.
    canonical_matches INTEGER NOT NULL DEFAULT 0,       -- 0 = NO, 1 = YES
    robots_indexable INTEGER NOT NULL DEFAULT 1,        -- 0 = NO, 1 = YES
    last_edge_probe_at DATETIME,
    
    -- Authoritative Index State
    index_status TEXT NOT NULL DEFAULT 'UNKNOWN',       -- 'INDEXED' | 'NOT_INDEXED' | 'UNKNOWN'
    first_indexed_at DATETIME,                          -- First authoritative index observation
    index_latency_hours REAL,                           -- (first_indexed_at - published_at) / 3600
    index_source TEXT,                                  -- Provider asserting status
    last_index_check_at DATETIME,
    
    -- Resolution Metadata
    has_conflicts INTEGER NOT NULL DEFAULT 0,
    conflict_notes TEXT,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CHECK (index_status IN ('INDEXED', 'NOT_INDEXED', 'UNKNOWN'))
);

CREATE INDEX IF NOT EXISTS idx_snap_index_status ON publication_feedback_snapshots(index_status);
CREATE INDEX IF NOT EXISTS idx_snap_edge_status ON publication_feedback_snapshots(edge_http_status);

-- 3. Table: publication_feedback_aggregates
-- Rolling cohort health aggregates directly supplying IndexHealthSignals to PUBLICATION-1
CREATE TABLE IF NOT EXISTS publication_feedback_aggregates (
    aggregate_id TEXT PRIMARY KEY,                       -- E.g. 'agg_m87v32h1'
    window_start DATETIME NOT NULL,
    window_end DATETIME NOT NULL,
    evaluated_at DATETIME NOT NULL,
    
    -- Cohort Statistics
    cohort_sample_size INTEGER NOT NULL,                -- Articles evaluated in window
    observation_coverage_ratio REAL NOT NULL,           -- Ratio with fresh observations (0.0 - 1.0)
    
    -- Indexation Metrics
    articles_indexed_count INTEGER NOT NULL,
    articles_not_indexed_count INTEGER NOT NULL,
    articles_unknown_count INTEGER NOT NULL,
    indexing_success_ratio REAL,                        -- indexed / (indexed + not_indexed), null if no authoritative data
    median_index_latency_hours REAL,                    -- Median latency of indexed articles
    
    -- Crawl & Site Health Metrics
    sitemap_coverage_ratio REAL NOT NULL,               -- in_sitemap / cohort_sample_size
    sitemap_last_verified_at DATETIME,
    recent_5xx_rate REAL NOT NULL DEFAULT 0.0,
    canonical_mismatch_rate REAL NOT NULL DEFAULT 0.0,
    publication_error_rate REAL NOT NULL DEFAULT 0.0,
    
    -- Synthesized Signals & Recommendation
    health_regime TEXT NOT NULL,                        -- 'UNKNOWN' | 'STALE' | 'PARTIAL' | 'HEALTHY' | 'DEGRADED'
    planner_recommendation TEXT NOT NULL,               -- 'HOLD' | 'INCREASE_ONE_STEP' | 'DECREASE_ONE_STEP' | 'PAUSE_GROWTH'
    signals_payload_json TEXT NOT NULL,                 -- Serialized IndexHealthSignals matching PUBLICATION-1 contract
    
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CHECK (health_regime IN ('UNKNOWN', 'STALE', 'PARTIAL', 'HEALTHY', 'DEGRADED')),
    CHECK (planner_recommendation IN ('HOLD', 'INCREASE_ONE_STEP', 'DECREASE_ONE_STEP', 'PAUSE_GROWTH'))
);

CREATE INDEX IF NOT EXISTS idx_agg_evaluated_at ON publication_feedback_aggregates(evaluated_at DESC);

-- 4. Table: publication_feedback_runs
-- Concurrency locking and execution audit log
CREATE TABLE IF NOT EXISTS publication_feedback_runs (
    run_id TEXT PRIMARY KEY,                             -- E.g. 'fbrun_99v2'
    trigger_source TEXT NOT NULL,                       -- 'manual' | 'test' | 'cron'
    actor TEXT NOT NULL,
    locked_until DATETIME,                              -- Concurrency mutual exclusion lease
    run_status TEXT NOT NULL DEFAULT 'RUNNING',         -- 'RUNNING' | 'COMPLETED' | 'FAILED'
    
    articles_evaluated INTEGER NOT NULL DEFAULT 0,
    observations_recorded INTEGER NOT NULL DEFAULT 0,
    unchanged_count INTEGER NOT NULL DEFAULT 0,
    errors_count INTEGER NOT NULL DEFAULT 0,
    
    aggregate_id TEXT REFERENCES publication_feedback_aggregates(aggregate_id),
    started_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    completed_at DATETIME,
    details_json TEXT,

    CHECK (run_status IN ('RUNNING', 'COMPLETED', 'FAILED'))
);
```

---

## 4. Observation Taxonomy & Semantic Meaning

```
┌────────────────────────────────────────────────────────────────────────────────────────┐
│                        OBSERVATION SEMANTICS & BOUNDARIES                              │
├──────────────────────────┬─────────────────────────────────────┬───────────────────────┤
│ Observation Type         │ Allowed Values                      │ Meaning & Boundary    │
├──────────────────────────┼─────────────────────────────────────┼───────────────────────┤
│ EDGE_STATUS              │ HTTP_200, HTTP_404, HTTP_5XX        │ Probes edge SSR route.│
│                          │                                     │ DOES NOT MEAN INDEXED.│
├──────────────────────────┼─────────────────────────────────────┼───────────────────────┤
│ SITEMAP_PRESENT          │ PRESENT, MISSING                    │ In XML sitemap.       │
│                          │                                     │ DOES NOT MEAN INDEXED.│
├──────────────────────────┼─────────────────────────────────────┼───────────────────────┤
│ CANONICAL_MATCH          │ MATCH, MISMATCH                     │ <link rel="canonical">│
│                          │                                     │ matches receipt URL.  │
├──────────────────────────┼─────────────────────────────────────┼───────────────────────┤
│ ROBOTS_ALLOWED           │ ALLOWED, NOINDEX                    │ HTML meta robots tag. │
├──────────────────────────┼─────────────────────────────────────┼───────────────────────┤
│ INDEX_STATUS             │ INDEXED, NOT_INDEXED, UNKNOWN       │ ONLY authoritative   │
│                          │                                     │ source may set INDEXED│
├──────────────────────────┼─────────────────────────────────────┼───────────────────────┤
│ INDEX_LATENCY_HOURS      │ Number >= 0.0, NULL                 │ Time to indexation.   │
│                          │                                     │ NULL if unindexed.    │
└──────────────────────────┴─────────────────────────────────────┴───────────────────────┘
```

### Strict Axioms
1. **`HTTP_200 != INDEXED`**: A page returning HTTP 200 merely means the Cloudflare Worker served the article. It conveys zero information about whether Googlebot has crawled or indexed it.
2. **`SITEMAP_PRESENT != INDEXED`**: Presence in XML sitemap confirms publication discovery eligibility, not search engine indexation.
3. **`UNKNOWN` is an Active State**: In the absence of direct Search Console API verification, `INDEX_STATUS` must strictly evaluate to `UNKNOWN`.

---

## 5. Source Provenance & Deterministic Precedence

When multiple telemetry sources report on the same article, conflicting values are resolved deterministically using clear precedence:

```
┌────────────────────────────────────────────────────────────────────────────────┐
│                          DETERMINISTIC PRECEDENCE HIERARCHY                    │
├──────────────────────────────────────────────────┬─────────────────────────────┤
│ Observation Dimension                            │ Authority Ranking           │
├──────────────────────────────────────────────────┼─────────────────────────────┤
│ INDEX_STATUS / INDEX_TIMESTAMP                   │ 1. SEARCH_CONSOLE (Highest) │
│                                                  │ 2. MANUAL_OPERATOR          │
│                                                  │ 3. ANALYTICS                │
│                                                  │ 4. FIRST_PARTY_RUNTIME (No) │
├──────────────────────────────────────────────────┼─────────────────────────────┤
│ EDGE_STATUS / HTTP RESPONSE                      │ 1. FIRST_PARTY_RUNTIME      │
│                                                  │ 2. MANUAL_OPERATOR          │
├──────────────────────────────────────────────────┼─────────────────────────────┤
│ SITEMAP PRESENCE                                 │ 1. SITEMAP_PARSER           │
│                                                  │ 2. FIRST_PARTY_RUNTIME      │
└──────────────────────────────────────────────────┴─────────────────────────────┘
```

### Non-Destructive Conflict Preservation
If `SEARCH_CONSOLE` reports `NOT_INDEXED` while a heuristic source (e.g. traffic) suggests user access:
1. Both raw observation rows are stored in `publication_observations`.
2. `publication_feedback_snapshots` sets `index_status = 'NOT_INDEXED'`.
3. `has_conflicts` is set to `1` with diagnostic notes explaining the discrepancy.
4. Data is never discarded or silently overwritten.

---

## 6. Index Latency Measurement Model

Index latency measures the elapsed time from publication commitment to authoritative search indexation:

$$\text{Index Latency (Hours)} = \frac{T_{\text{first\_authoritative\_index}} - T_{\text{actual\_published\_at}}}{3600\text{ seconds}}$$

### Strict Rules:
1. **Requires Proof:** $T_{\text{first\_authoritative\_index}}$ must originate from a verified `SEARCH_CONSOLE` or authoritative search engine observation.
2. **First Observation Only:** Once computed and recorded in `publication_feedback_snapshots`, `first_indexed_at` and `index_latency_hours` are immutable for that publication cycle. Subsequent observations update verification timestamps without shifting initial discovery latency.
3. **Fallback to UNKNOWN:** If an article is unverified or reported `NOT_INDEXED`, $\text{Index Latency} = \text{NULL}$ (`UNKNOWN`). Under no circumstances is latency estimated or extrapolated from sitemap crawl dates.

---

## 7. Normalized Planner Feedback Contract

PUBLICATION-3 maps rolling health aggregates into the canonical `IndexHealthSignals` interface consumed by `calculateEffectiveCapacity`:

```typescript
export interface IndexHealthSignals {
  domain?: string;                      // 'rancangloka.com'
  evaluatedPeriodDays?: number;         // E.g. 14
  
  // Indexation Performance (Authoritative)
  articlesSubmittedCount?: number;      // Total published articles evaluated
  articlesIndexedCount?: number;        // Total confirmed indexed
  indexingSuccessRatio?: number;        // articlesIndexedCount / (articlesIndexedCount + articlesNotIndexedCount)
  medianIndexLatencyHours?: number;     // Median index latency across cohort
  
  // Crawl Health (First-Party Runtime)
  sitemapLastCrawledAt?: string | null; // Latest verified sitemap timestamp
  crawlErrorRate?: number;              // Ratio of missing/broken sitemap URLs
  
  // Publish & Execution Stability
  publicationErrorRate?: number;        // Failed publication execution ratio
  recent5xxRate?: number;               // 5xx rate on public article route
  duplicateRate?: number;               // Canonical conflict ratio
  qualityFailureRate?: number;          // Post-publish check failure ratio
  
  // Visibility Trend
  searchVisibilityTrend?: 'GROWING' | 'STABLE' | 'DECLINING';
  observedAt?: string;                  // ISO 8601 evaluation timestamp
}
```

---

## 8. Missing Data Safety & Health Regimes

To ensure safe operation before external Search Console APIs are connected, five health regimes are strictly enforced:

```
┌──────────────┬─────────────────────────────┬──────────────────────────┬────────────────────────┐
│ Regime       │ Condition                   │ Health Multipliers       │ Planner Behavior       │
├──────────────┼─────────────────────────────┼──────────────────────────┼────────────────────────┤
│ UNKNOWN      │ Zero observations available │ All multipliers = 1.0    │ BASELINE PROFILE ONLY  │
│              │ (new deployment)            │                          │ No capacity scaling    │
├──────────────┼─────────────────────────────┼──────────────────────────┼────────────────────────┤
│ STALE        │ Latest aggregate > 72h old  │ All multipliers = 1.0    │ Fallback to BASELINE   │
│              │                             │                          │ Ignores stale boosts   │
├──────────────┼─────────────────────────────┼──────────────────────────┼────────────────────────┤
│ PARTIAL      │ Edge + Sitemap OK,          │ mIndex = 1.0 (neutral)   │ Safe baseline operation│
│              │ GSC data missing            │ mError = based on 5xx    │ Evaluates crawl health │
├──────────────┼─────────────────────────────┼──────────────────────────┼────────────────────────┤
│ HEALTHY      │ GSC index ratio >= 85%,     │ mIndex = 1.15,           │ Gradual capacity boost │
│              │ latency <= 48h, 0% 5xx      │ mCrawl = 1.10            │ Clamped to maxCeiling  │
├──────────────┼─────────────────────────────┼──────────────────────────┼────────────────────────┤
│ DEGRADED     │ Index ratio < 60% OR        │ mIndex = 0.70,           │ Immediate restriction  │
│              │ latency > 120h OR 5xx >= 2% │ mError = 0.40            │ Throttles down to min  │
└──────────────┴─────────────────────────────┴──────────────────────────┴────────────────────────┘
```

> [!IMPORTANT]
> **Safety Invariant:** Missing Search Console data evaluates to `PARTIAL`, NOT `HEALTHY`. The planner never increases daily capacity based on assumed indexation. It safely maintains baseline profile capacity (`baseCapacity`).

---

## 9. Aggregation Window & Statistical Robustness

1. **Cohort Definition:** Rolling window of the most recent $N$ published articles (default: 30 articles) OR all articles published within the last 14 days, whichever is smaller.
2. **Minimum Sample Size:** Minimum cohort size is **5 articles**. If cohort $< 5$, aggregate status is marked `INSUFFICIENT_SAMPLE`, and all feedback multipliers default strictly to `1.0`.
3. **Median vs. Average:** Index latency uses `MEDIAN` rather than arithmetic mean. This prevents a single delayed article (e.g. temporary crawler stall) from penalizing the entire publishing pipeline.
4. **Outlier Filtering:** Individual transient HTTP timeouts ($< 1$ failure per article with successful retry) are filtered from the aggregate 5xx rate.

---

## 10. Capacity Feedback Recommendations

PUBLICATION-3 calculates an advisory recommendation stored in `publication_feedback_aggregates.planner_recommendation`:

- **`HOLD`**: Current publication cadence matches site crawl velocity and indexation.
- **`INCREASE_ONE_STEP`**: Sustained `HEALTHY` regime across $\ge 2$ consecutive aggregation cycles with $> 85\%$ index ratio and zero 5xx errors.
- **`DECREASE_ONE_STEP`**: Sustained `DEGRADED` regime with index ratio $< 60\%$ or crawl error rate $> 5\%$.
- **`PAUSE_GROWTH`**: Critical failure: 5xx rate $\ge 2\%$ or consecutive sitemap generation failures.

> [!NOTE]
> **Strict Advisory Boundary:** PUBLICATION-3 writes recommendations into the database. PUBLICATION-1 reads these records during capacity calculation. PUBLICATION-3 has **zero permission** to mutate planner profile configurations or active plan records.

---

## 11. Negative & Positive Signal Response Matrix

```
┌───────────────────────────────────────────────┬─────────────────────────┬──────────────────────┐
│ Observed Signal Condition                     │ Multiplier Impact       │ System Action        │
├───────────────────────────────────────────────┼─────────────────────────┼──────────────────────┤
│ 5xx Rate >= 2.0%                              │ mError = 0.40           │ Throttles capacity   │
├───────────────────────────────────────────────┼─────────────────────────┼──────────────────────┤
│ 5xx Rate >= 0.5%                              │ mError = 0.70           │ Restricts capacity   │
├───────────────────────────────────────────────┼─────────────────────────┼──────────────────────┤
│ Indexing Success Ratio < 60%                  │ mIndex = 0.70           │ Throttles capacity   │
├───────────────────────────────────────────────┼─────────────────────────┼──────────────────────┤
│ Median Index Latency > 120 Hours              │ mCrawl = 0.80           │ Throttles capacity   │
├───────────────────────────────────────────────┼─────────────────────────┼──────────────────────┤
│ Canonical Tag Mismatch Detected               │ Duplicate Penalty Flag  │ Blocks expansion     │
├───────────────────────────────────────────────┼─────────────────────────┼──────────────────────┤
│ Indexing Success Ratio >= 85%                 │ mIndex = 1.15           │ Safe gradual boost   │
├───────────────────────────────────────────────┼─────────────────────────┼──────────────────────┤
│ Median Index Latency <= 48 Hours              │ mCrawl = 1.10           │ Safe gradual boost   │
├───────────────────────────────────────────────┼─────────────────────────┼──────────────────────┤
│ Large Inventory Backlog (>= 3x baseCapacity)  │ mBacklog = 1.25         │ Backlog relief boost │
└───────────────────────────────────────────────┴─────────────────────────┴──────────────────────┘
```

**Non-Destructive Constraint:** Under no circumstances does a negative signal cause articles to be unpublished, revoked, or deleted. Negative signals purely apply downward pressure on future planning capacity.

---

## 12. First-Party Observer Specification

The first-party observer runs provider-independent diagnostics using Cloudflare Workers runtime and D1 store:

```
┌────────────────────────────────────────────────────────────────────────┐
│                     FIRST-PARTY OBSERVER FLOW                          │
└────────────────────────────────────────────────────────────────────────┘
                                    │
       ┌────────────────────────────┼────────────────────────────┐
       ▼                            ▼                            ▼
 [1. Sitemap Crawl]          [2. Edge Probe]            [3. Meta Inspector]
 • Fetch /sitemap.xml        • Probe canonical URL      • Parse <head> HTML
 • Check <loc> presence      • Assert HTTP 200          • Verify canonical tag
 • Check <lastmod> date      • Measure latency (ms)     • Verify noindex absence
       │                            │                            │
       └────────────────────────────┼────────────────────────────┘
                                    │
                                    ▼
                     [Persist Clean Observations]
                     • SITEMAP_PRESENT = PRESENT
                     • EDGE_STATUS = HTTP_200
                     • CANONICAL_MATCH = MATCH
                     • INDEX_STATUS = UNKNOWN (Strict)
```

---

## 13. External Adapter Boundary

Future external telemetry providers (Google Search Console, Cloudflare Analytics, Bing Webmaster) implement a clean, decoupled adapter interface:

```typescript
export interface ExternalTelemetryAdapter {
  providerName: string;
  isConfigured(): boolean;
  inspectUrls(urls: string[]): Promise<UrlInspectionResult[]>;
  fetchSearchPerformance(startDate: string, endDate: string): Promise<SearchPerformanceMetrics>;
}
```

### Isolation & Resilience Guarantees
- **No Direct Dependency:** The core feedback engine calls adapters through an abstract interface.
- **Fail-Safe Fallback:** If an external API returns 401 Unauthorized, 429 Rate Limit, or 500 Error, the adapter catches the error and records an error entry in `publication_feedback_runs`. The feedback engine gracefully falls back to `PARTIAL` health regime.
- **No Leaked Credentials:** API keys, service account JSON, and OAuth tokens are never logged or stored in database tables.

---

## 14. Rate Limit, Cost & Execution Safety

1. **Strict Batch Sizing:** Observer processes a maximum of **25 articles** per run.
2. **Execution Frequency:** Maximum once every 6 to 24 hours. High-frequency polling is forbidden.
3. **Search Console Quota Protection:** Free Google Search Console API permits 2,000 inspection requests per day. A daily cohort of 25 URLs consumes $\approx 1.25\%$ of available quota.
4. **Zero Web Scraping:** Search engine scraping, headless browsers against Google SERPs, and unauthorized crawler manipulation are strictly prohibited.

---

## 15. Idempotency & Deduplication Design

To prevent database bloat from repeated observation runs:
1. **Deduplication Hash:**
   $$\text{dedup\_key} = \text{SHA256}(\text{article\_id} + \text{source\_name} + \text{observation\_type} + \text{status\_value} + \text{date(observed\_at)})$$
2. **Unchanged Records:** If an observation produces identical status to the latest recorded observation on the same day, `unchanged_count` is incremented in `publication_feedback_runs` and no duplicate row is inserted into `publication_observations`.
3. **State Transitions Recorded:** Whenever status genuinely changes (e.g. `UNKNOWN` $\to$ `INDEXED`, or `HTTP_200` $\to$ `HTTP_500`), a new immutable row is appended.

---

## 16. Concurrency & Run Mutual Exclusion

1. **Lease Locking:** Each feedback run acquires a deterministic lock in `publication_feedback_runs` with a 5-minute expiration lease:
   ```sql
   UPDATE publication_feedback_runs
   SET locked_until = datetime('now', '+5 minutes')
   WHERE run_id = ?;
   ```
2. **Mutual Exclusion:** If another observer process attempts to run while a valid lease is active, it immediately exits with `SKIPPED_RUN_IN_PROGRESS`.
3. **Crash Recovery:** If a worker process crashes, expired leases ($> 5$ minutes old) can be safely reclaimed.

---

## 17. Security Boundary & Least Privilege

| Capability / Action | Permitted in PUBLICATION-3? | Enforcement Mechanism |
|---|---|---|
| Read published articles & receipts | ✅ YES | Direct SELECT query on D1 |
| Write feedback tables | ✅ YES | Dedicated D1 tables only |
| Edit article body / markdown | ❌ NO | Read-only service boundary |
| Publish / unpublish articles | ❌ NO | Zero CMS status write operations |
| Approve / revoke articles | ❌ NO | Zero approval write operations |
| Create / edit publication plans | ❌ NO | Zero plan write operations |
| Modify media assets | ❌ NO | Zero media write operations |
| Invoke AI models / LLMs | ❌ NO | 100% deterministic code |
| Modify production cron | ❌ NO | `PRODUCTION_CRON_ENABLED = NO` |
| Manage secrets / deploy code | ❌ NO | No Cloudflare config permissions |

---

## 18. Website Availability & Independence

The feedback subsystem is strictly **off the public request path**:
- Public visitors requesting `https://rancangloka.com` or `https://rancangloka.com/[slug]` execute zero feedback code.
- Feedback collection runs in background worker triggers or secure admin endpoints (`/api/admin/publication/feedback/...`).
- If Cloudflare D1 feedback tables or external search APIs experience an outage, public page delivery is 100% unaffected.

---

## 19. Administrative Visibility & Operator Dashboard

The future operator UI provides clear, unpolluted telemetry:

```
┌────────────────────────────────────────────────────────────────────────────────────────┐
│                        PUBLICATION FEEDBACK HEALTH DASHBOARD                           │
├────────────────────────────────────────────────────────────────────────────────────────┤
│ Overall Health Regime:  [ HEALTHY ]           Feedback Freshness:  [ 2.4 Hours Ago ]   │
│ Active Planner Impact:  mIndex: 1.15 | mCrawl: 1.10 | mError: 1.00                    │
│ Recommendation:         INCREASE_ONE_STEP (Advisory)                                   │
├────────────────────────────────────────────────────────────────────────────────────────┤
│ Recent Published Cohort (Last 30 Articles):                                            │
│ Article Title / Slug             Published At   Edge    Sitemap   Index State  Latency │
│ ───────────────────────────────  ────────────   ────    ───────   ───────────  ─────── │
│ rancangloka-internal-ingest...   2026-09-04     [200]   [YES]     [UNKNOWN]    --      │
│ panduan-memilih-lantai-kayu...   2026-09-03     [200]   [YES]     [INDEXED]    28.4h   │
│ tips-pencahayaan-ruang-tamu...   2026-09-02     [200]   [YES]     [INDEXED]    36.1h   │
│ inspirasi-dapur-minimalis...     2026-09-01     [200]   [YES]     [NOT_INDEX]  --      │
└────────────────────────────────────────────────────────────────────────────────────────┘
```

**Visual Disambiguation Invariant:**
- `UNKNOWN`: Rendered as neutral gray badge (`Pending External Verification`).
- `NOT_INDEXED`: Rendered as amber badge.
- `INDEXED`: Rendered as emerald green badge.
- `UNKNOWN` is never visually or logically collapsed into `NOT_INDEXED`.

---

## 20. Comprehensive 28-Point Test Plan

Before promotion or execution, the test suite must prove the following invariants:

1. **HTTP 200 is Not Indexed:** Probing a public URL returning HTTP 200 yields `EDGE_STATUS = 'HTTP_200'` and `INDEX_STATUS = 'UNKNOWN'`.
2. **Sitemap Presence is Not Indexed:** Verifying a URL in XML sitemap yields `SITEMAP_PRESENT = 'PRESENT'` and `INDEX_STATUS = 'UNKNOWN'`.
3. **Authoritative Index Accepted:** Search console signal sets `INDEX_STATUS = 'INDEXED'` with valid provider provenance.
4. **Unknown State Preserved:** Missing external provider leaves `INDEX_STATUS` strictly `UNKNOWN`.
5. **Conflicting Sources Preserved:** Conflicting signals from different sources store both observation records.
6. **Deterministic Precedence:** Snapshot resolves `SEARCH_CONSOLE` over heuristic indicators.
7. **Idempotent Identical Observations:** Repeated runs with unchanged data create zero duplicate rows.
8. **Changed Observation Appended:** Genuine state transition appends new record with timestamp.
9. **Index Latency Calculation:** Measured accurately from `receipt.actual_published_at` to `first_indexed_at`.
10. **Absent Index Latency Null:** Unindexed or unknown articles have `index_latency_hours = null`.
11. **Stale Feedback Detection:** Feedback $> 72$h old transitions regime to `STALE`.
12. **Insufficient Sample Conservative:** Cohort $< 5$ articles evaluates to `INSUFFICIENT_SAMPLE` with `multipliers = 1.0`.
13. **Missing Data Conservative:** Empty observation database evaluates to `UNKNOWN` with `multipliers = 1.0`.
14. **Healthy Multiplier Boost:** Index ratio $\ge 85\%$ and latency $\le 48$h yields `mIndex = 1.15`, `mCrawl = 1.10`.
15. **Degraded Multiplier Throttle:** Index ratio $< 60\%$ yields `mIndex = 0.70`.
16. **High 5xx Restricts:** 5xx rate $\ge 2\%$ yields `mError = 0.40`.
17. **Sitemap Failure Restricts:** Missing sitemap entries increase `crawlErrorRate`.
18. **Canonical Mismatch Restricts:** Tag divergence flags duplicate conflict.
19. **Outlier Latency Immunity:** Single extreme latency spike does not skew median calculation.
20. **First-Party Observer Standalone:** Runs completely without external API credentials.
21. **Adapter Failure Isolation:** External API timeout/failure does not throw or crash engine.
22. **Normalized Planner Contract:** Emits schema matching `IndexHealthSignals` exactly.
23. **No Direct Plan Mutation:** Verifies zero UPDATE/INSERT on `article_publication_plans`.
24. **No Article Mutation:** Verifies zero UPDATE on `articles`.
25. **No Publishing Capability:** Verifies zero status transitions to `published`.
26. **Zero Model Calls:** Verifies `MODEL_CALLS = 0` across all observer and aggregate routines.
27. **Zero Secrets in Logs:** Verifies telemetry records contain no credentials or tokens.
28. **Public SSR Path Decoupled:** Simulating feedback crash leaves public route response intact.

---

## 21. Auto-Publish & Production Cron Safety

- **`AUTO_PUBLISH = OFF`**: The feedback subsystem does not enable autonomous publishing.
- **`PRODUCTION_CRON_ENABLED = NO`**: No unattended Cloudflare cron trigger is configured.
- Any future automated observer trigger must be explicitly authorized following a comprehensive soak and staging verification phase.
