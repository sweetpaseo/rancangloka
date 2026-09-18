# Astro 7 Performance Result

Baseline commit: `024034755e19106e539f8cc3bb56f666983893d9`

This pass applied one evidence-backed optimization: preserve explicit cache headers for non-HTML public responses while keeping HTML, admin, and admin API responses no-store.

## Changes

- `src/middleware.ts`: only forces no-store on HTML/admin/admin API responses, preserving route-defined cache headers for public JSON/XML.
- `src/pages/api/search.json.ts`: applies `Cache-Control: public, max-age=60, s-maxage=300` to both empty and queried search responses.

No D1 migration was created. No production resource was touched.

## Before / After Build

| Metric | Before | After | Delta |
|---|---:|---:|---:|
| Total `dist` bytes | 3,969,555 | 3,969,815 | +260 |
| Client JS bytes | 65,932 | 65,932 | 0 |
| Client CSS bytes | 0 | 0 | 0 |

The build-size delta is server middleware code only; public JS did not increase. The `0` client CSS result was later proven invalid as a release-health signal: the manual browser gate caught that no compiled application CSS was being delivered, even though HTTP smoke checks returned 200.

## Follow-Up Correction

The manual pre-production browser check failed because public pages rendered with Tailwind utility classes in HTML but without compiled application CSS. The repair changed Astro CSS delivery from forced inline styles to emitted stylesheet assets and added `npm run test:css-delivery` so future builds fail if the public HTML pipeline contains Tailwind classes but no compiled application stylesheet is emitted and referenced.

## Before / After Payload And Cache

| Route | Before bytes | After bytes | Cache result |
|---|---:|---:|---|
| `/` | 117,712 | 45,651 | HTML remains `no-cache, no-store, must-revalidate` |
| article | 140,656 | 68,595 | HTML remains `no-cache, no-store, must-revalidate` |
| `/solusi` | 128,276 | 56,215 | HTML remains `no-cache, no-store, must-revalidate` |
| `/komparasi` | 124,426 | 52,365 | HTML remains `no-cache, no-store, must-revalidate` |
| `/api/search.json` | 2 | 2 | changed to `public, max-age=60, s-maxage=300` |
| `/api/search.json?q=rumah` | not measured | 2 | `public, max-age=60, s-maxage=300` |
| `/sitemap.xml` | not measured | 701 | preserved `public, max-age=3600, s-maxage=86400` |
| `/rss.xml` | not measured | 486 | preserved `public, max-age=1800, s-maxage=7200` |

HTML byte reductions are from the second production build/runtime measurement and should be treated as observed local artifact output, not as a claimed direct effect of the cache-header change.

## Local Worker Timing

Method unchanged: local Worker, 1 warmup request, 10 measured requests.

| Route | Before P50 | After P50 | Before P95 | After P95 | Result |
|---|---:|---:|---:|---:|---|
| `/` | 20.92 | 14.80 | 24.29 | 16.34 | local improvement observed |
| article | 23.63 | 21.10 | 35.22 | 24.09 | local improvement observed |
| `/solusi` | 21.29 | 13.18 | 24.85 | 15.12 | local improvement observed |
| `/komparasi` | 17.58 | 14.29 | 23.88 | 18.64 | local improvement observed |
| `/api/search.json` | 6.33 | 8.16 | 8.38 | 11.34 | no significant improvement; cache behavior improved |

Do not overinterpret localhost timing variance. The retained optimization is justified by cache-policy correctness and safe edge/browser reuse for public search JSON.

## Regression

- Typecheck: PASS.
- Astro check: PASS, 0 errors, 0 warnings, 280 hints.
- Build: PASS.
- Local D1 zero-state bootstrap: PASS.
- Worker route smoke: PASS, no D1 schema warnings.
- Route smoke: PASS.
- Publisher unit: PASS, 48/48.
- Publisher local smoke: PASS, 71/71.
- Planner local smoke: PASS, 74/74.
- Soak safety local smoke: PASS, 38/38.
- SEO representative checks: PASS for title/meta description/canonical/OpenGraph/JSON-LD preservation on measured public pages.
- Admin redirect/auth shell: PASS for `/admin` 302.

## Remaining Opportunities

- Audit whether public page inline scripts can be deferred or consolidated without harming search, bookmarking, newsletter, lightbox, and mobile navigation.
- Consider replacing sitemap count logic with a direct `COUNT(*)` in a separate low-risk pass.
- Browser/Lighthouse testing remains manual because the sandbox did not provide reliable browser performance tooling against the local Worker.
