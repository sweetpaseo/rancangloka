# Astro 7 Manual Release Check

This checklist is for the final manual gate before any production push or Cloudflare deployment. Keep `AUTO_PUBLISH=OFF` and `MEDIA_CAN_PUBLISH=NO` throughout the review.

## Scope

- Validate the built Astro 7 site in a real browser.
- Confirm public pages, admin redirects, API safety, SEO tags, and cache headers.
- Record Lighthouse results separately before production deployment.
- Do not publish articles, mutate production D1/R2, change secrets, or deploy Cloudflare during this checklist.

## Local Setup

From the canonical repository:

```powershell
cd C:\Users\Fanto\Desktop\antigravity\rancangloka\rancangloka-astro
npm run build
node scripts\bootstrap-worker-local-d1.mjs
node scripts\dev-worker-local.mjs --ip 127.0.0.1 --port 8814 --log-level info
```

Open:

```text
http://127.0.0.1:8814/
```

## Browser Route Matrix

Check these routes in Chrome:

| Route | Expected |
| --- | --- |
| `/` | 200, public homepage renders |
| `/tren-desain-interior-japandi-2026-hunian-minimalis` | 200, article renders |
| `/editorial-standards` | 200 |
| `/solusi` | 200 |
| `/komparasi` | 200 |
| `/metodologi` | 200 |
| `/api/search.json` | 200 JSON |
| `/api/search.json?q=rumah` | 200 JSON |
| `/robots.txt` | 200 text |
| `/sitemap.xml` | 200 XML |
| `/rss.xml` | 200 XML |
| `/admin` | 302 to login |
| `/admin/posts` | 302 to login |
| `/api/admin/categories` | 401 JSON |
| `/api/internal/v1/publication-inventory` | 401 JSON |
| `/media/nonexistent-release-check` | 404 |
| `/invalid-release-slug` | 404 |
| `/definitely-missing-release-review` | 404 |

## Console Gate

For public pages, the Chrome console should have:

- No uncaught runtime exceptions.
- No hydration mismatch errors.
- No repeated D1 fallback warnings.
- No missing critical asset errors.

Known build-time direct-eval warnings from the Google Drive helper are not a browser-console release blocker unless they surface as runtime failures.

## Network Cache Gate

Use the Chrome Network panel with cache disabled for the first pass, then enabled for a second pass.

Expected cache behavior:

| Resource | Expected Cache-Control |
| --- | --- |
| Public HTML | `no-cache, no-store, must-revalidate` |
| Admin/API private responses | `no-store, private` or no public cache |
| `/api/search.json` | `public, max-age=60, s-maxage=300` |
| `/robots.txt` | `public, max-age=0, must-revalidate` |
| `/sitemap.xml` | `public, max-age=3600, s-maxage=86400` |
| Hashed assets | `public, max-age=31536000, immutable` |
| Successful media responses | `public, max-age=31536000, immutable` |

## Visual Gate

Check desktop and mobile responsive views:

| Page | Desktop | Mobile | Notes |
| --- | --- | --- | --- |
| Homepage |  |  |  |
| Representative article |  |  |  |
| Editorial standards |  |  |  |
| Solusi |  |  |  |
| Komparasi |  |  |  |
| Admin login redirect |  |  |  |

Look for layout shifts, overlapping text, broken images, unreadable controls, and missing SEO-visible content.

## Lighthouse Matrix

Run Lighthouse in Chrome for the following pages and record results:

| Route | Performance | Accessibility | Best Practices | SEO | Notes |
| --- | ---: | ---: | ---: | ---: | --- |
| `/` |  |  |  |  |  |
| Representative article |  |  |  |  |  |
| `/editorial-standards` |  |  |  |  |  |
| `/solusi` |  |  |  |  |  |
| `/komparasi` |  |  |  |  |  |

## Release Decision

Production deployment remains blocked until the manual browser and Lighthouse gate is complete. If the manual gate passes, the next action is a separate operator-approved production push/deploy flow.
