# Hermes Integration Plan

## Timing

Hermes diset setelah Astro Article Contract dikunci.

Urutan:
1. audit Astro,
2. lock contract,
3. setup Hermes,
4. generate article file,
5. validate against Astro,
6. Git integration,
7. scheduler/autopublish terakhir.

## Phase H1 — Local dry run

Input: topic manual.

```text
topic
→ Luna Planner
→ risk router
→ optional evidence
→ Luna Writer
→ Luna QA
→ deterministic validator
→ output article.md
```

Output awal:
```text
/workspace/generated/
```

Tidak ada Git write.

## Phase H2 — Astro validation

Generated file
→ validate frontmatter
→ validate Markdown/MDX
→ staging content path
→ run Astro build

Goal:
> Generated article can enter Astro without manual technical edits.

## Phase H3 — Git branch

Setelah H2 stabil:
- create branch,
- write article,
- run tests/build,
- show diff,
- commit.

No automatic merge initially.

## Phase H4 — Preview deploy

Optional:
- Cloudflare preview/deploy,
- verify response,
- verify canonical/meta/schema/image.

## Phase H5 — Autonomous publishing

Setelah repeated stable runs:
- scheduler,
- topic queue,
- budget rules,
- publish cadence,
- automatic merge/publish jika diinginkan.

## Secrets

API keys harus environment variables.
Never commit:
- SumoPod API key,
- Gemini key,
- Git token,
- Cloudflare token.

## Initial Hermes permissions

Allow:
- read repo,
- write only workspace/generated,
- execute safe validation/build commands.

Do NOT initially allow:
- destructive Git,
- production deploy,
- branch deletion,
- unrestricted shell,
- secrets output.
