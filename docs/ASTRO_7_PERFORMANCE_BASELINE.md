# Astro 7 Performance Baseline

Baseline commit: `024034755e19106e539f8cc3bb56f666983893d9`

This baseline was captured after the Phase E local D1 bootstrap checkpoint. Measurements are local Worker/runtime regression baselines only; they are not production Lighthouse or Cloudflare edge latency claims.

## Versions

| Package | Version |
|---|---:|
| Astro | 7.3.3 |
| @astrojs/cloudflare | 14.3.2 |
| @astrojs/check | 0.9.10 |
| Vite | 8.3.0 |
| TypeScript | 5.9.3 |
| Wrangler | 4.133.0 |
| Node | 24.16.0 |

## Validation

- Typecheck: PASS.
- Astro check: PASS, 0 errors, 0 warnings, 280 hints.
- Build: PASS.
- Known build warning: direct `eval` warning in `src/lib/dr1/offsite/google-drive.ts`.

## Build Inventory

| Metric | Bytes / Count |
|---|---:|
| Total `dist` bytes | 3,969,555 |
| Server output bytes | 3,746,123 |
| Client output bytes | 223,432 |
| Client JS files | 6 |
| Client JS total bytes | 65,932 |
| Client CSS files | 0 |
| Client CSS total bytes | 0 |

Largest client JS assets:

| Asset | Raw | Gzip | Brotli |
|---|---:|---:|---:|
| `assets/marked.esm.CzNbZOuE.js` | 35,246 | 10,786 | 9,905 |
| `assets/new.astro_astro_type_script_index_0_lang.CDlLT8l0.js` | 9,146 | 2,927 | 2,527 |
| `assets/_id_.astro_astro_type_script_index_0_lang._JXq2MIG.js` | 8,290 | 2,610 | 2,224 |
| `assets/new.astro_astro_type_script_index_0_lang.CrsXuuBj.js` | 4,492 | 1,731 | 1,496 |
| `assets/settings.astro_astro_type_script_index_0_lang.7LJ1p73S.js` | 4,408 | 1,388 | 1,138 |
| `assets/_id_.astro_astro_type_script_index_0_lang.BJ-NfR1g.js` | 4,350 | 1,665 | 1,432 |

The built public reader pages did not require emitted client JS bundles. The JS assets above are admin/editor functionality.

## Hydration And Scripts

- Hydrated Astro island directives: 0.
- Public source scripts found in shared/public reader surface: header, search modal, bookmark drawer, mobile bottom nav, newsletter widgets, social share, lightbox, article page helper, solution page helper.
- Public external script count in measured local pages: 0 unless Google Analytics is configured at runtime.
- Admin-only inline scripts are present under `/admin/**` and generated admin JS chunks, but were not linked from measured public reader pages.

## Representative Payloads

| Route | Status | HTML bytes | Scripts | External scripts | Images | Cache-Control |
|---|---:|---:|---:|---:|---:|---|
| `/` | 200 | 117,712 | 8 | 0 | 8 | `no-cache, no-store, must-revalidate` |
| `/tren-desain-interior-japandi-2026-hunian-minimalis` | 200 | 140,656 | 10 | 0 | 9 | `no-cache, no-store, must-revalidate` |
| `/editorial-standards` | 200 | 111,719 | 6 | 0 | 3 | `no-cache, no-store, must-revalidate` |
| `/solusi` | 200 | 128,276 | 7 | 0 | 3 | `no-cache, no-store, must-revalidate` |
| `/komparasi` | 200 | 124,426 | 6 | 0 | 3 | `no-cache, no-store, must-revalidate` |
| `/api/search.json` | 200 | 2 | 0 | 0 | 0 | `no-cache, no-store, must-revalidate` |

## Local Worker Timings

Method: local Worker, 1 warmup request, 10 measured requests. These are regression baselines only.

| Route | Min ms | P50 ms | P95 ms | Max ms |
|---|---:|---:|---:|---:|
| `/` | 17.69 | 20.92 | 24.29 | 24.29 |
| article | 20.46 | 23.63 | 35.22 | 35.22 |
| `/solusi` | 19.58 | 21.29 | 24.85 | 24.85 |
| `/komparasi` | 16.80 | 17.58 | 23.88 | 23.88 |
| `/api/search.json` | 5.88 | 6.33 | 8.38 | 8.38 |

## Findings

- `P0`: Public JSON cache headers were overwritten by middleware. `/api/search.json` defined short public cache only for queried responses, but middleware forced the measured empty response to no-store.
- `P1`: Public HTML payloads are relatively large because CSS and shared public interaction scripts are inlined per page. No emitted reader-page JS bundle was found, so there was no accidental hydration to remove.
- `P1`: Article page performs multiple D1 reads: article/page lookup, categories, settings, then related articles and a larger published article list. Queries are bounded and indexed enough for the current corpus, but the article route is the main server-work watch point.
- `P2`: `getTotalArticlesCount` uses `getAllArticles(..., 1000)` for sitemap counting rather than `COUNT(*)`; this is not on the measured reader path.
- `NO_ACTION`: R2 media route sets `Cache-Control: public, max-age=31536000, immutable`, content type, and ETag.
- `NO_ACTION`: Static hashed `/assets/*` are marked immutable by the Cloudflare adapter `_headers`.
- `NO_ACTION`: Fonts are system/Tailwind class based in the app surface; no public route font file downloads were measured.

## Limitations

Browser DevTools, Lighthouse, and real Core Web Vitals were not measured in this sandbox. No production edge latency or Lighthouse score is claimed here.
