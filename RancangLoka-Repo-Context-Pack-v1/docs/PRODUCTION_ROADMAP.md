# Production Roadmap

## Phase 1 — Astro Contract
Status: NEXT

Tasks:
- audit current repo structure,
- identify content collections,
- identify article route,
- identify SEO implementation,
- identify image handling,
- identify Cloudflare/build flow,
- define final Article Contract,
- create one dummy article,
- `astro build` must pass.

Exit criteria:
> We know exactly what file Hermes must produce.

## Phase 2 — Hermes Setup
Status: AFTER PHASE 1

Tasks:
- install/config Hermes,
- connect SumoPod,
- configure Luna,
- set workspace,
- set permissions,
- set budget caps,
- no Git permissions yet.

Exit criteria:
> Hermes can generate a valid article file locally.

## Phase 3 — Production Dry Run

- manual topic,
- planner,
- risk router,
- optional evidence,
- writer,
- QA,
- validator,
- article output.

Exit:
> File can be copied into Astro and build passes.

## Phase 4 — Repo Integration

- staging branch/worktree,
- validators,
- Astro build,
- inspect diff,
- commit.

Exit:
> Topic → Git commit reliable.

## Phase 5 — Images

- image decision router,
- manual vs AI,
- image budget,
- SEO filenames,
- alt text,
- WebP/AVIF,
- optional diagrams.

## Phase 6 — Cloudflare

- preview deploy,
- build validation,
- production deploy rules,
- rollback.

## Phase 7 — Scheduler / Autonomous Mode

Only after previous phases stable.

- topic queue,
- publishing cadence,
- duplicate/cannibalization checks,
- budget/day,
- retries,
- failure notifications,
- content DB state.
