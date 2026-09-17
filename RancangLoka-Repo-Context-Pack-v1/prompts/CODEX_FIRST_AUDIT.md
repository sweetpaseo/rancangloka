# Codex — First Audit Prompt

Read `AGENTS.md` and all files under `/docs`.

Audit the current Astro repository in read-only mode.

Do not edit any files yet.

Identify the actual content architecture, article schema, Markdown/MDX flow, routes, images, SEO, validation, Git/build scripts, and Cloudflare configuration.

Compare the real implementation against `/docs/ARTICLE_CONTRACT.md`.

Return:
1. architecture map,
2. current article contract,
3. missing fields/validation needed for Hermes-generated content,
4. smallest safe implementation plan,
5. exact files you would modify after approval,
6. build/test commands to verify Phase 1.

Do not implement Hermes, n8n, QwenPaw, CMS, database, or new framework in this step.
