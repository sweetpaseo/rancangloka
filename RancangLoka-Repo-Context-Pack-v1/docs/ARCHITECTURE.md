# Production Architecture

```text
                    TOPIC QUEUE
                         |
                         v
                    LUNA PLANNER
                         |
                         v
                     RISK ROUTER
                 /        |        \
               LOW      MEDIUM      HIGH
                |          |          |
                |      selective     strict
                |       evidence    evidence
                |          |          + Qwen
                \__________|__________/
                         |
                         v
                    LUNA WRITER
                         |
                         v
                     LUNA QA
                         |
                         v
               DETERMINISTIC GATE
                         |
                         v
                   IMAGE DECISION
                         |
                         v
                   MARKDOWN / MDX
                         |
                         v
                        GIT
                         |
                         v
                       ASTRO
                         |
                         v
                    CLOUDFLARE
```

## Hermes boundary

Hermes should orchestrate:
- job state,
- topic queue,
- model calls,
- risk routing,
- optional evidence,
- writer/QA,
- handoff to deterministic validators,
- artifact status.

Hermes should NOT be trusted to decide whether generated output is technically valid when code can verify it.

## Suggested workspace

```text
/workspace
  /generated
  /approved
  /rejected
  /logs
```

## Publish safety progression

### Stage 1
Generate article file only. No Git write.

### Stage 2
Generate + validate + copy into Astro working tree. Manual review.

### Stage 3
Generate + validate + Git branch/commit. No automatic merge.

### Stage 4
Generate + validate + preview deploy.

### Stage 5
Automatic merge/publish only after stability is proven.

## Source of truth

- Repo actual structure = technical truth.
- `/docs` = product/editorial truth.
- Content DB/topic DB = publishing state truth.
- Git = publication history truth.
