# RancangLoka Mobile Responsive Checkpoint

Timestamp: 2026-09-13 20:07:31 +07:00

Scope:
- Apply the RancangLoka mobile responsive standard to public article pages.
- Primary visual reference: 414 x 896 px.
- Mandatory fail-safe: 360 x 800 px.
- Keep the work local only; no production deployment was requested in this mobile QA prompt.

Files changed:
- `src/styles/global.css`
- `src/pages/[slug].astro`
- `src/components/RelatedArticles.astro`
- `src/components/Footer.astro`
- `scripts/test-mobile-responsive-standard.js`
- `state/MOBILE_RESPONSIVE_CHECKPOINT.md`
- `HISTORY.md`

Implementation notes:
- Added `.rl-mobile-grid` with `padding-inline: clamp(16px, 4.8vw, 20px)`.
- Added `.rl-safe-wrap` for long title and URL wrapping.
- Added global `overflow-x: clip` and prose media/table/pre max-width guards.
- Applied consistent grid gutters to article pages, static pages, related articles, and footer.
- Tightened mobile prose, blockquote, editorial cards, references, and CTA spacing.
- Kept business logic, data fetching, publication flow, media flow, and schema untouched.

Automated checks:
- `node --test scripts/test-mobile-responsive-standard.js`: PASS
- `tsc --noEmit`: PASS
- `astro build`: PASS

Browser viewport QA:

| Viewport | Scroll Width | Gutter | Main Grid | Result |
|---|---:|---|---|---|
| 360 x 800 | 345 | equal, ~17.28px | cover/body inside grid | PASS |
| 375 x 812 | 360 | equal, ~18.01px | cover/body inside grid | PASS |
| 390 x 844 | 375 | equal, ~18.74px | cover/body inside grid | PASS |
| 414 x 896 | 399 | equal, ~19.89px | cover/body inside grid | PASS |
| 430 x 932 | 415 | equal, 20px | cover/body inside grid | PASS |
| 768 x 1024 | 753 | equal, 24px | cover/body inside grid | PASS |
| 1280 x 800 | 1265 | equal, 32px | cover/body inside grid | PASS |
| 1440 x 900 | 1425 | equal, 32px | cover/body inside grid | PASS |

Pass conditions:
- `VIEWPORT_360=PASS`
- `VIEWPORT_375=PASS`
- `VIEWPORT_390=PASS`
- `VIEWPORT_414=PASS`
- `VIEWPORT_430=PASS`
- `GUTTERS_EQUAL=PASS`
- `NO_HORIZONTAL_OVERFLOW=PASS`
- `MOBILE_GRID_ALIGNMENT=PASS`
- `COVER_ALIGNMENT=PASS`
- `BODY_ALIGNMENT=PASS`
- `REFERENCES_ALIGNMENT=PASS`
- `FOOTER_ALIGNMENT=PASS`

QA target:
- Local article page: `/rumah-tropis-yang-tidak-takut-matahari`
- Local QA server: `http://127.0.0.1:4322`

Notes:
- Browser bounding-box scans included hidden/off-canvas elements with large transformed coordinates, so the authoritative overflow signal used here is `document.documentElement.scrollWidth <= viewport width` plus visible section containment.
- The sample article used for local QA does not render a dynamic external references block, but the template-level references section and wrapping guards were covered by static responsive tests.
