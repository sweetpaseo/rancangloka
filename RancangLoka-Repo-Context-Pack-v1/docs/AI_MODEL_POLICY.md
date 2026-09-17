# AI Model Policy

## Core principle

> One orchestrator, one primary editorial brain, code for deterministic work.

## Primary model

**GPT-5.6 Luna via SumoPod**

Default roles:
- topic ideation,
- planner,
- writer,
- QA,
- targeted repair,
- research question generation,
- evidence interpretation when needed.

## Independent critic

**Qwen 3.8 Flash**

Gunakan hanya bila independence memberi nilai:
- high-risk evidence,
- semantic evidence verification,
- occasional sampling/audit.

Jangan call Qwen pada setiap artikel secara default.

## Search

Search adalah capability terpisah dari model intelligence.

Production:
- low-risk evergreen: no search by default,
- medium-risk: selective search,
- current: fresh search required,
- high-risk: strict search required.

## Model sprawl rule

Sebelum menambah model:
1. Apa role yang Luna belum bisa tangani?
2. Apakah sebenarnya deterministic?
3. Apakah tambahan model sepadan dengan latency/complexity/reliability cost?

Jika tidak jelas, jangan ditambah.
