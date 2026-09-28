# CONTENT-QUARANTINE-1 — recovery and surface audit

Baseline: `feaf2bd7cb8153792d8e93dd27aae06aa46249b9`, production version
`ee370157-12ab-4e1c-abcf-931b931de0f4`. Audit date: 2026-09-28.

## Recovered work

The initial worktree contained five modified files and the untracked quarantine
registry. No reset, checkout, stash, or content replacement was used.

| File | Recovered intent | Assessment and completion |
|---|---|---|
| `src/lib/quarantine.ts` | One slug registry, visibility/indexing helpers, robots and redirect policy | Reusable and within scope. Guard own-property lookup so unknown slugs such as `constructor` are not quarantined. Indexability shares the discovery predicate. |
| `src/lib/db.ts` | Filter public lists and related articles; preserve direct lookup and admin inventory | Compatible with SSR/D1 plus fallback corpus. Related results must be filtered before limiting; remove pre-filter SQL limit. Retain existing admin query options. |
| `src/lib/seo.ts` | Exclude quarantine from automatic keyword links and in-article related cards | Retained. Does not rewrite stored article bodies. |
| `src/pages/[slug].astro` | Early 301 for consolidation; robots meta and response header | Retained. Published direct lookup remains independent of discovery filtering. |
| `src/layouts/BaseLayout.astro` | Per-article robots override | Preserve global/page noindex precedence and existing canonical behavior. |
| `src/pages/index.astro` | Suppress an empty feed section | Retained; Article 5 remains in the hero collection. |

None of these changes edits Article 5 or Article 6 storage, approval, receipt,
publication execution, media, safety controls, or decision authority.

## Policy and exact actions

`src/lib/quarantine.ts` is the sole production registry. The regression test
independently verifies its exact 20 prototype slugs against the source array.
Nineteen entries are `PROTOTYPE`: preserve source/slug and direct 200 responses,
send `noindex, follow` in meta and `X-Robots-Tag`, exclude discovery.

`panduan-kusen-aluminium-ekstrusi-daerah-lembap` is `REDIRECT`, with one 301 hop
to `kusen-aluminium-vs-upvc-untuk-rumah-tropis-di-indonesia`. The source is retained.
Overlap was rechecked against Article 5's D1 body: aluminium window/door systems,
humidity/rain resistance, seals, and material selection for tropical housing.
The target is not quarantined and must return 200.

Article 6 (`rekayasa-ventilasi-silang-alami-untuk-rumah-tropis-yang-lebih-nyaman`)
is `EVIDENCE_REVIEW`. Its D1 status stays published and its body/hash stay intact;
direct access returns 200 with noindex/follow, while discovery excludes it.

Registry timestamps describe the authored policy entries, not a D1 mutation or
deployment timestamp. To release a reusable slug after editorial review, remove
its registry entry and deploy: the same URL becomes eligible again. Existing
source/D1 precedence is unchanged; this milestone does not implement content replacement.

## Discovery surface audit

| Surface | Policy path |
|---|---|
| Homepage hero, feed, popular sidebar | `getAllArticles(..., 'published')` filters before pagination |
| `/explore`, `/category/[category]` | Same loader; categories further filter the public collection |
| 404 suggestions and missing-slug suggestions | Same loader |
| Related cards and inline related callout | `getRelatedArticles` plus `injectInArticleRelated` |
| Existing automatic keyword candidate pool | `injectAutoKeywordLinks` rejects quarantine directly |
| `/api/search.json`, SearchModal | Public loader before search/result limiting |
| `/rss.xml` | Public loader |
| `/post-sitemap.xml`, `/sitemap-posts-[page].xml` | Public loader before pagination |
| `/sitemap-news.xml`, `/news-sitemap.xml` | Public loader followed by news/date eligibility |
| `/sitemap.xml`, `/sitemap_index.xml` | Count derives from filtered public loader |
| Page/category sitemap aliases | Emit static-page/category URLs, not article URLs |
| Admin inventory/backup/editing | Explicit `status='all'` retains access to the full corpus |
| Internal/admin APIs | Authenticated operational surfaces; not public discovery feeds |
| Saved browser bookmarks | User-managed saved URLs, not a recommendation feed; direct URLs intentionally preserved |

Repository searches covered article loaders, direct SQL reads, recommendations,
search, feeds, RSS, sitemap aliases, and literal prototype references. Static
topic/navigation modules link to solution/comparison/search pages; they do not
provide an alternate article feed. No new internal-link engine is introduced.
`public/robots.txt` is unchanged: crawlers may fetch quarantine pages and see noindex.

## Integrity and documentation

Article 5's expected hash is
`14275912029058f33a907831c8bf4d081129f7470f572305c861c6d46c5e5277`.
Approval 9 remains APPROVED, receipt is `rcpt_bbae85b48e1b2f8d`, featured asset is
`ast_mfUpgVe99C_bq_p2d_O4Ge4L`. The policy matches slugs, never overlapping
in-memory/D1 numeric IDs. No article data migration is needed.

Read-only D1 verification confirmed execution row ID **2**,
`pexec_2b27683bb528397e`. HISTORY's ID 1 was corrected; historical records and
clock-skew provenance timestamps were not changed.

## Validation

- `node scripts/test-content-quarantine.js`: 19 checks, real TS endpoint handlers
  and read-only loader adapter over isolated SQLite fixtures; exact corpus,
  Article 5 protection, robots, redirect, pagination, search/feed/sitemap exclusion,
  future release, link candidates, and immutable Article 5/6 fixtures.
- Existing suites: Phase 1C 58/58, SEO date 14/14, publication clock skew PASS,
  publisher 48/48, planner 67/67, SOAK safety 54/54.
- TypeScript `--noEmit` and Astro production build pass.
- Local HTTP: three normal prototype pages return 200 with meta/header
  noindex/follow; the kusen URL returns the expected 301 Location.
- Planner fixtures emit non-fatal missing `decision_observations` table warnings;
  all 67 assertions pass. Local dev dependency scanning reported access/resolution
  errors and an unhandled rejection; the actual HTTP probes and production build
  passed. No dependency or environment repair is included in this milestone.

The release procedure requires a reviewed clean commit, deployment from that
commit, production HTTP checks, and read-only comparison of the pre-release D1
snapshot. Production observations and deployment identifiers are reported in
the release conversation rather than asserted ahead of deployment here.
