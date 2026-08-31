# RancangLoka V2 --- Visual Design Blueprint

**Design Direction:** Quiet Luxury × Architectural Precision × Digital
Editorial\
**Primary target:** Premium architecture/design publication\
**Reference canvases:** Desktop 1440px / Mobile 390px\
**Implementation context:** Astro + Cloudflare, static-first, minimal
JavaScript, Svelte islands only where interaction is needed.

------------------------------------------------------------------------

## 1. Design Principles

1.  **Editorial first** --- RancangLoka should feel like a premium
    digital architecture journal, not a generic blog or SaaS dashboard.
2.  **Quiet luxury** --- premium through typography, spacing, imagery,
    hierarchy, and restraint.
3.  **High-tech through precision** --- grids, thin rules, metadata,
    indexing, micro-interactions; avoid neon/glow-heavy UI.
4.  **Image-led storytelling** --- architectural photography is a
    primary visual element.
5.  **Less UI, more space** --- avoid unnecessary cards, shadows,
    rounded containers, and decorative effects.
6.  **Mobile is a dedicated composition** --- do not simply shrink the
    desktop layout.
7.  **Performance first** --- preserve Astro's static-first architecture
    and keep interactive behavior isolated.

------------------------------------------------------------------------

# 2. Master Canvas

## Desktop --- 1440px

-   Viewport: `1440px`
-   Maximum content width: `1280px`
-   Outer gutter: `80px`
-   Grid: `12 columns`
-   Column gap: `24px`

``` text
1440px
┌──────────────────────────────────────────────────────────────┐
│ 80px                                                    80px │
│    ┌────────────────────────────────────────────────────┐    │
│    │                                                    │    │
│    │                 1280px CONTENT                    │    │
│    │                                                    │    │
│    └────────────────────────────────────────────────────┘    │
└──────────────────────────────────────────────────────────────┘
```

## Mobile --- 390px

-   Viewport: `390px`
-   Left/right gutter: `20px`
-   Content width: `350px`

``` text
390px
┌──────────────────────────────────────┐
│ 20                                20 │
│    ┌────────────────────────────┐    │
│    │         350px              │    │
│    └────────────────────────────┘    │
└──────────────────────────────────────┘
```

## Breakpoints

  Breakpoint      Usage
  --------------- --------------------------
  `< 640px`       Mobile
  `640–767px`     Large mobile
  `768–1023px`    Tablet
  `1024–1279px`   Laptop
  `1280px+`       Desktop
  `1440px`        Primary design reference

------------------------------------------------------------------------

# 3. Color System

Use a warm architectural palette rather than a cold
pure-black/pure-white system.

  Token      Hex         Usage
  ---------- ----------- ------------------------------
  `ink`      `#11110F`   Primary text / dark sections
  `paper`    `#F6F5F1`   Main background
  `white`    `#FFFFFF`   Image/content surfaces
  `stone`    `#D9D7D0`   Borders/dividers
  `muted`    `#77766F`   Secondary text
  `soft`     `#EAE8E1`   Soft section backgrounds
  `accent`   `#6B705C`   Architectural olive accent

### Recommended visual ratio

-   Paper: \~70%
-   White: \~15%
-   Ink: \~10%
-   Stone: \~4%
-   Accent: \~1%

**Accent should remain subtle.** Never turn the site into a neon-tech
interface.

------------------------------------------------------------------------

# 4. Typography

## Sans --- UI and body

Recommended: **Geist**

  Element                 Desktop        Mobile
  -------------- ---------------- -------------
  Body                16px / 1.65    16px / 1.6
  Body Large          20px / 1.55   18px / 1.55
  Navigation       12--13px / 1.2          12px
  Metadata             11px / 1.3    10px / 1.3
  Button/Label           11--12px      10--11px

## Serif --- Editorial

Recommended: **Instrument Serif**

Use only for:

-   Hero headline
-   Featured editorial headline
-   Major editorial statements
-   Selected high-impact section headings

### Desktop scale

-   Display: `72px / 0.95`, tracking `-0.035em`
-   H1: `56px / 1.0`
-   H2: `42px / 1.05`
-   H3: `26px / 1.15`

### Mobile scale

-   Hero: `42px / 0.98`, tracking `-0.025em`
-   H2: `32px / 1.05`
-   H3: `22px / 1.15`

Use uppercase + letter spacing for technical metadata:

``` text
MATERIAL · SPATIAL STUDY · 06 MIN READ
```

------------------------------------------------------------------------

# 5. Spacing System

Use a consistent spacing scale instead of arbitrary values.

Suggested base scale:

``` text
4   8   12   16   20   24   32   40   48   56   64
80  96   120  144  160
```

## Desktop

  Relationship                     Spacing
  --------------------------- ------------
  Header → Hero                       40px
  Hero → next section                120px
  Major section → section       120--160px
  Section title → content         40--56px
  Grid/card gap                       24px
  Small metadata → headline       12--16px

## Mobile

  Relationship                 Spacing
  ------------------------- ----------
  Header → Hero                   24px
  Hero → next section             72px
  Major section → section     80--96px
  Section title → content         28px
  Grid/card gap                   20px

------------------------------------------------------------------------

# 6. Header

## Desktop

Height: `76px`

``` text
┌──────────────────────────────────────────────────────────────┐
│                                                              │
│  RANCANGLOKA       JOURNAL   EXPLORE   INTELLIGENCE   ABOUT ⌕│
│                                                              │
└──────────────────────────────────────────────────────────────┘
```

### Rules

-   No shadow
-   1px bottom border
-   Maximum content width: `1280px`
-   Navigation: `12–13px`
-   Logo: `16px`
-   Use whitespace aggressively
-   Search icon should be minimal

Suggested navigation:

``` text
JOURNAL
EXPLORE
INTELLIGENCE
ABOUT
⌕
```

Use a dropdown/mega menu for deeper categories:

``` text
DESIGN
  Interior
  Architecture
  Tropical Living

INTELLIGENCE
  Problem Solver
  Material Index
  Comparison Matrix

RESEARCH
  Spatial Studies
  Editorial Methodology
```

## Mobile

Height: `64px`

``` text
┌──────────────────────────────────────┐
│ R  RANCANGLOKA              ⌕   ☰  │
└──────────────────────────────────────┘
```

Do not compress the entire desktop navigation into mobile.

------------------------------------------------------------------------

# 7. Hero / Cover Story

This is the strongest visual component on the homepage.

## Desktop

Image target:

-   Width: `1280px`
-   Height: approximately `650px`
-   Aspect ratio: approximately `2:1`
-   Border radius: `0px`

Composition:

``` text
┌──────────────────────────────────────────────────────────────┐
│                                                              │
│                  HERO ARCHITECTURE IMAGE                     │
│                                                              │
│                                                              │
│                                                              │
└──────────────────────────────────────────────────────────────┘

ISSUE 04 · SPATIAL STUDY

Rumah Tropis yang
Tidak Takut Matahari

Rekayasa secondary skin dan cross ventilation...

READ STORY →                         06 MIN READ
```

### Preferred image treatment

-   Real architectural photography
-   Natural daylight
-   Realistic material texture
-   Balanced exposure
-   Restrained grading
-   No text baked into image
-   No graphic overlays
-   No fake CGI/3D aesthetic

Prefer:

**Image → whitespace → typography**

over heavy text overlays.

## Mobile

Image target:

-   Width: `350px`
-   Height: `300–360px`
-   Keep it visually dominant

``` text
┌──────────────────────────────────┐
│                                  │
│          HERO IMAGE              │
│                                  │
│                                  │
└──────────────────────────────────┘

ISSUE 04 · SPATIAL STUDY

Rumah Tropis yang
Tidak Takut Matahari

Rekayasa secondary skin...

READ STORY →       06 MIN
```

------------------------------------------------------------------------

# 8. Editorial Curation

Turn the existing editorial notes into an index rather than cards.

``` text
THE EDITOR'S CURATION
──────────────────────────────────────────────────────────────

01   MATERIAL OF THE WEEK

     Mengapa rumah menghadap barat selalu panas?
                                              04 MIN →

──────────────────────────────────────────────────────────────

02   ARCHITECTURAL DETAIL

     Efek cerobong pada void vertikal
                                              04 MIN →

──────────────────────────────────────────────────────────────

03   SPATIAL COMFORT

     Ketika cahaya menjadi bagian dari arsitektur
                                              05 MIN →

──────────────────────────────────────────────────────────────
```

### Rules

-   No card shadow
-   No heavy rounded corners
-   Thin dividers
-   Large whitespace
-   Metadata in uppercase
-   Strong numerical indexing

------------------------------------------------------------------------

# 9. Problem Discovery / Quick Search

Rename the visual concept to:

## WHAT ARE YOU TRYING TO SOLVE?

Purpose: make RancangLoka feel like a design intelligence platform.

Desktop:

``` text
┌──────────────────────────────────────────────────────────────┐
│                                                              │
│  WHAT ARE YOU TRYING TO SOLVE?                               │
│                                                              │
│  ┌──────────────────┐ ┌──────────────────┐ ┌──────────────┐ │
│  │ RUMAH TERLALU    │ │ RUANG TERLALU    │ │ LAHAN        │ │
│  │ PANAS            │ │ GELAP            │ │ SEMPIT       │ │
│  └──────────────────┘ └──────────────────┘ └──────────────┘ │
│                                                              │
└──────────────────────────────────────────────────────────────┘
```

Suggested topics:

-   Rumah terlalu panas
-   Ruang terlalu gelap
-   Lahan sempit
-   Bising jalan raya
-   Material
-   Ventilasi

### Interaction

Default:

``` text
background: transparent
border: 1px solid #D9D7D0
```

Hover:

``` text
background: #11110F
text: #FFFFFF
```

Transition:

`180–220ms`

No glow.

------------------------------------------------------------------------

# 10. Latest Journal

Do not use a generic 3-column blog card grid.

Use an editorial `1 + 2` layout.

``` text
┌──────────────────────────────────┬────────────────────┐
│                                  │                    │
│                                  │   ARTICLE 02       │
│        FEATURED                  │                    │
│        ARTICLE                   │────────────────────│
│                                  │                    │
│                                  │   ARTICLE 03       │
│                                  │                    │
└──────────────────────────────────┴────────────────────┘
```

Recommended proportion:

-   Featured: `~66.67%`
-   Secondary: `~33.33%`
-   Grid gap: `24px`

Featured image:

`~840 × 520px`

Secondary image:

`~400 × 240px`

------------------------------------------------------------------------

# 11. Article Card

Structure:

``` text
[ IMAGE ]

MATERIAL · 05 MIN

Judul artikel yang
kuat dan editorial

Deskripsi singkat...
```

Avoid:

-   Large shadows
-   Giant rounded cards
-   Gradient backgrounds
-   Excessive colored badges
-   Too many borders

### Hover

-   Image: `scale(1.015)`
-   Headline: subtle underline
-   Transition: `400–500ms`

------------------------------------------------------------------------

# 12. Mobile Article Layout

Featured article:

``` text
┌──────────────────────────────────┐
│                                  │
│             IMAGE                │
│                                  │
└──────────────────────────────────┘

MATERIAL · 05 MIN

Judul artikel yang kuat
dan editorial

Deskripsi singkat...
```

Image:

`350 × 230–260px`

For secondary articles, image can be reduced or omitted:

``` text
MATERIAL
──────────────

Mengapa Aluminium
Cocok untuk Iklim
Tropis?

05 MIN →
```

Goal: avoid an endless image feed on mobile.

------------------------------------------------------------------------

# 13. Visual Study

Use this as a dark editorial interruption.

Background:

`#11110F`

Text:

`#F6F5F1`

``` text
┌──────────────────────────────────────────────────────────────┐
│                                                              │
│  VISUAL STUDY                                                │
│                                                              │
│  How Architecture                                            │
│  Responds to Climate                                         │
│                                                              │
│  ┌────────────────────────────────────────────────────────┐  │
│  │                                                        │  │
│  │                  ARCHITECTURE IMAGE                    │  │
│  │                                                        │  │
│  └────────────────────────────────────────────────────────┘  │
│                                                              │
└──────────────────────────────────────────────────────────────┘
```

This provides visual rhythm so the homepage does not become one
continuous white surface.

------------------------------------------------------------------------

# 14. Material Index

Make this a signature RancangLoka feature.

Desktop:

``` text
MATERIAL INDEX

01
KAYU ULIN
12 STUDIES

02
ANDESIT
08 STUDIES

03
EXPOSED CONCRETE
15 STUDIES

04
LOW-E GLASS
09 STUDIES
```

Recommended typography:

-   Section title: `42px`
-   Material name: `32–40px`
-   Metadata: `11px`

### Desktop interaction

On hover:

-   Material name remains dominant
-   Small contextual thumbnail may appear
-   Keep animation subtle

If interaction needs JavaScript, implement it as a small **Svelte
island**, not a full SPA.

## Mobile

Use rows:

``` text
MATERIAL INDEX

01  KAYU ULIN                         12 →
02  ANDESIT                            08 →
03  EXPOSED CONCRETE                   15 →
04  LOW-E GLASS                        09 →
05  ALUMINIUM                          11 →
```

Row height:

`64px`

Border:

`1px solid #D9D7D0`

No hover thumbnail on touch devices.

------------------------------------------------------------------------

# 15. Design Intelligence

Combine the Problem Solver and Comparison Matrix into one ecosystem.

``` text
DESIGN INTELLIGENCE

┌──────────────────────────────┬──────────────────────────────┐
│                              │                              │
│ PROBLEM SOLVER               │ MATERIAL MATRIX              │
│                              │                              │
│ Rumah terlalu panas?         │ Aluminium vs UPVC            │
│ Ruang gelap?                 │ Ulin vs Jati                 │
│ Lahan sempit?                │ Low-E vs Clear Glass          │
│                              │                              │
│ DIAGNOSE →                   │ COMPARE →                    │
│                              │                              │
└──────────────────────────────┴──────────────────────────────┘
```

Background:

`#EAE8E1`

Do not make these look like generic CTA cards.

------------------------------------------------------------------------

# 16. Newsletter

Position it as an editorial product.

``` text
RANCANGLOKA WEEKLY

Satu email.
Beberapa ide bagus.
Tanpa noise.

Architecture · Design · Materials · Spatial Intelligence

[ Email address                         ] [ → ]
```

Mobile:

``` text
RANCANGLOKA WEEKLY

Satu email.
Beberapa ide bagus.
Tanpa noise.

[ Email address               ]

[ SUBSCRIBE → ]
```

------------------------------------------------------------------------

# 17. Footer

## Desktop

Dark background:

`#11110F`

``` text
┌──────────────────────────────────────────────────────────────┐
│                                                              │
│  RANCANGLOKA                         EXPLORE                 │
│                                      Journal                 │
│  Architecture                        Material Index          │
│  Design                              Problem Solver           │
│  Spatial Intelligence                Comparison              │
│                                                              │
│                                                              │
│  © 2026 RancangLoka                  Editorial Methodology  │
│                                      Privacy                 │
│                                      Contact                 │
│                                                              │
└──────────────────────────────────────────────────────────────┘
```

Text:

`#F6F5F1`

Keep footer relatively compact.

## Mobile

``` text
RANCANGLOKA

Architecture.
Design.
Spatial Intelligence.

────────────────────

EXPLORE

Journal
Material Index
Problem Solver
Comparison

────────────────────

ABOUT

Editorial Methodology
Contact
Privacy

────────────────────

© 2026 RancangLoka
```

------------------------------------------------------------------------

# 18. Border Radius

Architectural editorial style should stay mostly square.

  Component              Radius
  ------------------- ---------
  Image                   `0px`
  Article card            `0px`
  Section container     `0–4px`
  Search/input          `2–4px`
  Button                `2–4px`
  Special UI              `4px`

Avoid using large `rounded-xl`, `rounded-2xl`, or pill-shaped components
unless there is a specific UX reason.

------------------------------------------------------------------------

# 19. Iconography

Use a minimal icon set such as Lucide.

-   Stroke: `1.5px`
-   Keep icons monochrome
-   Prefer simple symbols

Examples:

``` text
→
↗
⌕
+
−
```

No decorative icon clusters.

------------------------------------------------------------------------

# 20. Motion

Motion should be restrained.

## Image hover

``` text
transform: scale(1.015)
duration: 500ms
```

## Links

Subtle underline animation:

`180ms`

## Page entrance

``` text
opacity: 0 → 1
translateY: 8px → 0
duration: 450ms
```

Respect:

``` css
@media (prefers-reduced-motion: reduce) {
  /* Disable non-essential motion */
}
```

Do not animate every section on scroll.

------------------------------------------------------------------------

# 21. Mobile Navigation Decision

Do **not** add a permanent bottom navigation by default.

Reason:

RancangLoka should remain a **premium publication**, not feel like a
mobile SaaS/app dashboard.

Preferred mobile header:

``` text
RANCANGLOKA        ⌕ ☰
```

------------------------------------------------------------------------

# 22. High-Tech Without Looking Like a Sci-Fi Dashboard

Use:

-   precise grid
-   thin 1px borders
-   technical metadata
-   indexing
-   measured whitespace
-   restrained motion
-   typography contrast
-   numerical labels
-   structured information

Avoid:

-   neon cyan
-   purple gradients
-   glowing borders
-   excessive glassmorphism
-   animated blobs
-   excessive shadows
-   giant rounded cards

**Definition of high-tech for RancangLoka: precision, not decoration.**

------------------------------------------------------------------------

# 23. Full Homepage Architecture

``` text
HEADER
│
├── HERO / COVER STORY
│
├── EDITOR'S CURATION
│
├── WHAT ARE YOU TRYING TO SOLVE?
│
├── LATEST JOURNAL
│
├── FEATURED VISUAL STUDY
│
├── MATERIAL & DESIGN INDEX
│
├── DESIGN INTELLIGENCE
│   ├── Problem Solver
│   └── Comparison Matrix
│
├── RANCANGLOKA WEEKLY
│
└── FOOTER
```

------------------------------------------------------------------------

# 24. Desktop Homepage Blueprint

``` text
1440px × ∞

┌────────────────────────────────────────────────────────────┐
│ HEADER                                                     │
│ RANCANGLOKA   JOURNAL  EXPLORE  INTELLIGENCE  ABOUT   ⌕   │
├────────────────────────────────────────────────────────────┤
│                                                            │
│ HERO IMAGE                                                 │
│                                                            │
│ ISSUE 04                                                   │
│ Rumah Tropis yang Tidak Takut Matahari                    │
│                                                            │
├────────────────────────────────────────────────────────────┤
│ EDITOR'S CURATION                                          │
│ 01 ...                                                     │
│ 02 ...                                                     │
│ 03 ...                                                     │
├────────────────────────────────────────────────────────────┤
│ WHAT ARE YOU TRYING TO SOLVE?                              │
│ [ Rumah Panas ] [ Ruang Gelap ] [ Lahan Sempit ]          │
├────────────────────────────────────────────────────────────┤
│ LATEST JOURNAL                                             │
│ ┌───────────────────────┐ ┌────────────────────────────┐   │
│ │ FEATURED              │ │ ARTICLE                    │   │
│ │                       │ ├────────────────────────────┤   │
│ │                       │ │ ARTICLE                    │   │
│ └───────────────────────┘ └────────────────────────────┘   │
├────────────────────────────────────────────────────────────┤
│ VISUAL STUDY                                               │
│                 [ LARGE IMAGE ]                            │
├────────────────────────────────────────────────────────────┤
│ MATERIAL INDEX                                             │
│ 01 KAYU ULIN                                               │
│ 02 ANDESIT                                                  │
│ 03 CONCRETE                                                 │
│ 04 LOW-E GLASS                                              │
├────────────────────────────────────────────────────────────┤
│ DESIGN INTELLIGENCE                                        │
│ PROBLEM SOLVER       MATERIAL MATRIX                       │
├────────────────────────────────────────────────────────────┤
│ RANCANGLOKA WEEKLY                                         │
├────────────────────────────────────────────────────────────┤
│ FOOTER                                                     │
└────────────────────────────────────────────────────────────┘
```

------------------------------------------------------------------------

# 25. Mobile Homepage Blueprint

Reference: `390 × 844px`

``` text
┌──────────────────────────────────┐
│ R RANCANGLOKA             ⌕ ☰   │
├──────────────────────────────────┤
│          HERO IMAGE              │
├──────────────────────────────────┤
│ ISSUE 04                         │
│                                  │
│ Rumah Tropis yang                │
│ Tidak Takut Matahari             │
│                                  │
│ Rekayasa secondary skin...       │
│                                  │
│ READ STORY →       06 MIN        │
├──────────────────────────────────┤
│ EDITOR'S CURATION                │
│                                  │
│ 01 MATERIAL                      │
│ Mengapa rumah menghadap          │
│ barat selalu panas?              │
│                                  │
│ ───────────────────────────────  │
│ 02 DETAIL                        │
│ Efek cerobong pada void...       │
├──────────────────────────────────┤
│ WHAT ARE YOU TRYING TO SOLVE?    │
│                                  │
│ [ Rumah terlalu panas ]          │
│ [ Ruang terlalu gelap ]          │
│ [ Lahan sempit ]                 │
│ [ Bising ]                       │
├──────────────────────────────────┤
│ LATEST JOURNAL                   │
│                                  │
│            [ IMAGE ]             │
│                                  │
│ MATERIAL · 05 MIN                │
│ Judul artikel yang kuat...       │
├──────────────────────────────────┤
│ VISUAL STUDY                     │
│            [ IMAGE ]             │
├──────────────────────────────────┤
│ MATERIAL INDEX                   │
│ 01  KAYU ULIN              12 → │
│ 02  ANDESIT                 08 → │
│ 03  CONCRETE                15 → │
│ 04  LOW-E GLASS             09 → │
├──────────────────────────────────┤
│ DESIGN INTELLIGENCE              │
│ PROBLEM SOLVER                  →│
│ MATERIAL MATRIX                 →│
├──────────────────────────────────┤
│ RANCANGLOKA WEEKLY               │
├──────────────────────────────────┤
│ FOOTER                           │
└──────────────────────────────────┘
```

------------------------------------------------------------------------

# 26. Design Tokens for Astro/Tailwind

Recommended core tokens:

``` text
max-width: 1280px

desktop-gutter: 80px
mobile-gutter: 20px

grid-gap: 24px

section-gap-desktop: 120–160px
section-gap-mobile: 80–96px

border-width: 1px

radius-default: 0–4px

body-size: 16px
body-line-height: 1.65

hero-size-desktop: 72px
hero-size-mobile: 42px
```

Do not let individual components invent unrelated spacing values.

The whole site should feel like one architectural grid.

------------------------------------------------------------------------

# 27. Implementation Architecture

Keep the existing Astro architecture.

Recommended component structure:

``` text
src/
├── components/
│   ├── Header.astro
│   ├── HeroStory.astro
│   ├── EditorialCuration.astro
│   ├── ProblemDiscovery.astro
│   ├── ArticleGrid.astro
│   ├── ArticleCard.astro
│   ├── VisualStudy.astro
│   ├── MaterialIndex.astro
│   ├── DesignIntelligence.astro
│   ├── Newsletter.astro
│   └── Footer.astro
│
├── islands/
│   ├── SearchExplorer.svelte
│   ├── MaterialHover.svelte
│   └── ComparisonMatrix.svelte
│
└── layouts/
    └── BaseLayout.astro
```

### Principle

**Astro renders the publication. Svelte enhances interaction.**

Do not turn the whole homepage into a client-side application.

------------------------------------------------------------------------

# 28. Performance Rules

The visual redesign must not sacrifice performance.

### Images

-   Prefer AVIF/WebP
-   Responsive `srcset`
-   Explicit `width`/`height`
-   `loading="lazy"` for below-fold images
-   Hero image can use eager loading
-   Use appropriate `fetchpriority` for LCP image
-   Avoid oversized source images

### JavaScript

-   No global animation framework
-   No unnecessary client hydration
-   Use Svelte only for interactive components
-   Prefer CSS transitions for simple motion

### CSS

-   Keep design tokens centralized
-   Avoid excessive utility duplication
-   Avoid unnecessary animation libraries

------------------------------------------------------------------------

# 29. Priority Roadmap

## P0 --- Essential

1.  Redesign header
2.  Redesign hero
3.  Typography hierarchy
4.  Increase whitespace
5.  Replace generic cards with editorial layouts
6.  Dedicated mobile composition
7.  Material Index visual redesign
8.  Problem Solver / Matrix integration

## P1 --- Strongly Recommended

9.  Visual Study dark section
10. Micro-interactions
11. Editorial indexing
12. Technical metadata system
13. Improved search/problem discovery
14. Responsive image art direction

## P2 --- Polish

15. Reading progress
16. Saved articles
17. Subtle page transitions
18. Advanced Material Index hover previews
19. Editorial recommendation logic

------------------------------------------------------------------------

# 30. Final Design Target

RancangLoka V2 should communicate three messages in sequence:

### Within 3 seconds

> **This is not a normal architecture blog.**

### Within 10 seconds

> **This feels like a premium digital architecture magazine.**

### After exploration

> **This is also a design intelligence platform with material research,
> problem solving, comparisons, and spatial studies.**

The desired visual equation:

``` text
RancangLoka V2

Premium Editorial
        +
Architectural Precision
        +
Spatial Intelligence
        +
Quiet Technology
        =
Distinctive Digital Architecture Publication
```

The goal is not to make RancangLoka look "more futuristic."

The goal is to make it look **more intentional, more authoritative, and
more expensive** while remaining fast and easy to read.
