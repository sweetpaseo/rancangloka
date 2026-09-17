# Antigravity — First Audit Prompt

Copy-paste prompt berikut ke Antigravity:

Read `AGENTS.md` and every Markdown file inside `/docs` first.

Then inspect the entire current RancangLoka Astro project.

Do not modify, create, delete, rename, or format any project file yet.

Produce a technical audit that maps:

1. Astro version and project structure.
2. Current content source and content collection configuration.
3. Current article/blog schema and frontmatter fields.
4. Article routes and dynamic route generation.
5. Markdown/MDX rendering pipeline.
6. Image storage, optimization, remote image rules, WebP/AVIF handling.
7. SEO metadata, canonical URLs, Open Graph, structured data, sitemap, robots.
8. Internal linking and related-content implementation.
9. Existing Material Index / Problem Solver / Comparison integration if present.
10. Git/build scripts and Cloudflare deployment configuration.
11. Validation already present in the project.
12. Exact files that would need to change to support Hermes-generated articles.
13. Differences between the actual repository and `/docs/ARTICLE_CONTRACT.md`.

Then propose the smallest implementation plan for Phase 1: Astro Article Contract.

Constraints:
- Keep Astro + Cloudflare.
- Preserve performance and zero/minimal client JavaScript.
- Do not introduce a CMS.
- Do not add dependencies unless necessary.
- Do not implement Hermes yet.
- Do not modify files during this audit.
- Prefer existing project patterns over inventing a second content architecture.

End with:
A. Current architecture map.
B. Gap list.
C. Proposed final Article Contract.
D. Exact implementation steps.
E. Risks.
F. Files you would change only after approval.
