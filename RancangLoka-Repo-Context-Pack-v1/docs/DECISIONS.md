# Architecture Decision Log

## ADR-001 — Keep Astro + Cloudflare
Status: Accepted

RancangLoka adalah content-first publication yang membutuhkan performa tinggi, SEO kuat, dan JavaScript minimal.

## ADR-002 — Hermes-first orchestration
Status: Planned

User memilih satu orchestrator demi cost/complexity. Hindari n8n + Hermes + QwenPaw sekaligus.

## ADR-003 — GPT-5.6 Luna as primary editorial model
Status: Accepted

Internal benchmark menunjukkan Topic/Planner/Writer/QA capability yang kuat dengan cost/performance yang baik.

## ADR-004 — Evidence is risk-based
Status: Accepted

Full evidence untuk setiap artikel tidak perlu. High-risk/current claims tetap membutuhkan evidence yang kuat.

## ADR-005 — Hybrid manual + AI images
Status: Accepted

Tidak semua artikel membutuhkan banyak generated image.

## ADR-006 — Deterministic tasks belong in code
Status: Accepted

Slug, validation, duplicate checks, word count, Markdown/frontmatter, links, Git/build, retry/budget caps.

## ADR-007 — Repo files are agent context source of truth
Status: Accepted

Codex/Antigravity tidak otomatis mewarisi percakapan ChatGPT.
