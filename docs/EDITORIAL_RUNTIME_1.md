# EDITORIAL-RUNTIME-1 — Real Joko LLM Execution + Rina QA

## 1. Executive Summary & Runtime Reality Shift

Following the forensic audit in `EDITORIAL-RUNTIME-EXECUTION-AUDIT-1` which established the truth:
```
EDITORIAL_RUNTIME_NOT_PROVEN
```
this milestone (`EDITORIAL-RUNTIME-1`) establishes and proves the **first real editorial execution path** for RancangLoka.

Joko is no longer just a staff identity in the capability registry, a placeholder name on a task handoff, or a simulated artifact generator. With this implementation, an authorized human operator can trigger a real editorial job that invokes a server-side LLM provider, compiles canonical editorial knowledge and structured visitor problem context into Joko's prompt, generates an authentic article draft in native Bahasa Indonesia, executes deterministic QA evaluation through Rina, and stops at the human review gate without any automated publication authority.

---

## 2. Architectural Blueprint

The execution pipeline flows strictly as follows:

```
[ Human Operator (CHIEF_EDITOR) ]
             │
             ▼ Explicit Authorization
[ Editorial Runtime (executeEditorialDraftJob) ]
             │
             ├─► [ Joko Prompt Builder (joko-prompt-builder.ts) ]
             │         │ (Canonical Knowledge, Native Indonesian, Visitor Pain, Safe Claims)
             │         ▼
             ├─► [ Real Editorial LLM Provider (editorial-llm-provider.ts) ]
             │         │ (OpenRouter / SumoPod chat/completions transport)
             │         ▼
             ├─► [ Joko Draft Created (REAL_RUNTIME_EXECUTION) ]
             │         │
             │         ▼
             ├─► [ Rina Deterministic QA (evaluateHumanWritingQuality) ]
             │         │
             │         ├─► [ PASS (Score >= 85) ] ───┐
             │         │                             │
             │         ├─► [ REVISE / REWRITE ]      │
             │         │         │ (Max 2 Retries)   │
             │         │         ▼                   │
             │         │   [ Bounded Repair Loop ]   │
             │         │                             │
             │         └─► [ RESEARCH_REQUIRED ]     │
             │                   │ (Halts Safely)    │
             │                   ▼                   │
             │             [ BLOCKED ]               │
             │                                       │
             ▼                                       ▼
   [ HUMAN_REVIEW_REQUIRED / DRAFT (Stop Gate: publishingAuthority = 0) ]
```

---

## 3. Core Modules Created

### A. Real Editorial LLM Provider (`src/lib/editorial/editorial-llm-provider.ts`)
- **Isolation:** Completely separated from TypeSafe JEV decisions infrastructure (`/api/alpha/decisions`). Uses standard chat completions (`/v1/chat/completions`).
- **Security & Privacy:** Server-side execution only. Zero browser/client exposure. API keys are completely stripped and redacted from error strings and traces.
- **Transports Supported:** OpenRouter (`https://openrouter.ai/api/v1/chat/completions`) and SumoPod (`https://ai.sumopod.com/v1/chat/completions`).
- **Resilience:** Bounded timeout (default 60s, configurable), token limits (4,000 max), classified error categories (`CONFIG_MISSING`, `AUTH`, `RATE_LIMIT`, `TIMEOUT`, `NETWORK`, `SERVER_ERROR`, `MALFORMED`, `EMPTY_RESPONSE`), and exponential backoff retry.
- **Fail-Closed:** Missing API credentials halt execution with `CONFIG_MISSING` and refuse simulation.

### B. Canonical Joko Prompt Builder (`src/lib/editorial/joko-prompt-builder.ts`)
- **No Hardcoded Duplication:** Reuses `CANONICAL_EDITORIAL_KNOWLEDGE_V1`, `JOKO_HUMAN_AUTHORING_GUIDELINES`, `CANONICAL_TERMINOLOGY_MAP`, and `CANONICAL_PAIN_DIMENSIONS`.
- **Native Indonesian Contract:** Enforces `authoring_language = id-ID`, `translation_mode = prohibited_by_default`. Joko composes directly in natural Indonesian without English-to-Indonesian translation.
- **Visitor Problem Context Consumption:** Injects primary visitor context (`CTX-05`), primary pain dimension (`DECISION_UNCERTAINTY`), secondary contexts (`CTX-09`, `CTX-10`), opening angle (`DECISION_FORK`), and opening signature (`DECISION > CONFLICT > DIAGNOSIS`).
- **Evidence Honesty:** Injects strictly `author_safe_claims`. Prohibits unverified numbers and enforces Monetary Silence.
- **Originality Guarantee:** Does **not** include the existing human-approved draft (`draft-final.md`) in initial generation.

### C. Editorial Runtime Orchestrator (`src/lib/editorial/editorial-runtime.ts`)
- **Entrypoint:** `executeEditorialDraftJob(input, options)`.
- **Authorization Enforcement:** Requires explicit `operatorAuth` (`CHIEF_EDITOR` / `MANAGING_EDITOR`).
- **Trace Observability:** Emits genuine operational events: `EDITORIAL_JOB_STARTED`, `JOKO_PROMPT_BUILT`, `JOKO_LLM_REQUEST_STARTED`, `JOKO_LLM_RESPONSE_RECEIVED`, `JOKO_DRAFT_CREATED`, `RINA_QA_STARTED`, `RINA_QA_COMPLETED`, `HUMAN_REVIEW_REQUIRED`.
- **Bounded Repair:** Supports up to 2 retry attempts using Rina's `StructuredRewriteBrief`. Halts immediately on `RESEARCH_REQUIRED` or `EDITORIAL_INTEGRITY_REVIEW` to prevent Joko from inventing facts.
- **Human Gate:** Output is permanently constrained to `DRAFT` and `HUMAN_REVIEW_REQUIRED`.

---

## 4. Controlled Runtime Proof Execution (Metal-Roof Article)

On October 4, 2026, an operator-triggered runtime execution was conducted on the metal roof problem-solving topic:
`"Atap Metal Terasa Panas: Apakah Insulasi Foil Cukup atau Perlu Ventilasi Atap?"`

### Live Operational Telemetry
- **Job ID:** `task_runtime_proof_metal_roof_001`
- **Triggered By:** `antigravity_operator` (`CHIEF_EDITOR`)
- **Provider:** SumoPod (`sumopod`)
- **Configured Model:** `gpt-5.6-luna`
- **Latency:** 23,204 ms (23.2 seconds)
- **Token Usage:** 2,350 prompt tokens, 3,595 completion tokens (5,945 total tokens)
- **Attempts Required:** 1 attempt (Zero retries needed)
- **Draft Length:** 14,046 characters (230 lines of rich, original Markdown prose)

### Rina Deterministic QA Results
- **Knowledge Version:** `RANCANGLOKA_EDITORIAL_KNOWLEDGE_V1`
- **Total Score:** **90 / 100**
- **Decision:** **`HUMAN_WRITING_PASS`**
- **Dimension Breakdown:**
  - Sentence Rhythm: 20 / 20
  - Specificity & Detail: 15 / 15
  - Contextual Relevance: 15 / 15
  - Editorial Voice: 15 / 15
  - Non-template Structure: 10 / 10
  - Evidence Integration: 10 / 10
  - Reader Perspective: 4 / 5
  - Conclusion Originality: 1 / 5
- **Issues Detected:** 1 minor warning (`NEXT_ACTION_MISSING`, -10 pts penalty).
- **Strong Areas Observed:**
  - Natural, unforced Native Indonesian opening based on `CTX-05` and `DECISION_FORK`.
  - Precise architectural diagnosis: 3 heat transfer pathways (Radiation, Convection, Conduction).
  - Explicit explanation of air gap necessity for foil radiant barriers.
  - Transparent trade-offs (rain spray/tampias, dust degradation, attic condensation).
  - Practical decision matrix by roof type.

### Provenance Artifacts
- **Runtime Draft Saved:** [`scripts/runtime-proof/joko-metal-roof-runtime.md`](file:///c:/Users/Fanto/Desktop/antigravity/rancangloka/rancangloka-astro/scripts/runtime-proof/joko-metal-roof-runtime.md)
- **Runtime Metadata & Trace Saved:** [`scripts/runtime-proof/joko-metal-roof-runtime-meta.json`](file:///c:/Users/Fanto/Desktop/antigravity/rancangloka/rancangloka-astro/scripts/runtime-proof/joko-metal-roof-runtime-meta.json)
- **Integrity Guarantee:** The human-edited benchmark [`scripts/dryrun/draft-final.md`](file:///c:/Users/Fanto/Desktop/antigravity/rancangloka/rancangloka-astro/scripts/dryrun/draft-final.md) was **not** overwritten.

---

## 5. Pixel Office Integration Point

In the current architecture, runtime job state provides the required truthful primitives for Pixel Office animation binding:

| Runtime Phase | True Underlying Event | Pixel Office Target Binding |
|---|---|---|
| Request Dispatched | `JOKO_LLM_REQUEST_STARTED` | Joko (`content_writer_primary`) workstation state -> `WRITING` |
| Text Received | `JOKO_LLM_RESPONSE_RECEIVED` | Joko animation completes -> idle / transit |
| QA Dispatched | `RINA_QA_STARTED` | Rina (`editorial_qa_primary`) workstation state -> `REVIEWING` |
| QA Completed | `RINA_QA_COMPLETED` | Rina animation completes -> inspection badge |
| Revision Loop | `EDITORIAL_REPAIR_REQUESTED` | Real handoff event -> Joko `ARTICLE_REWRITE` animation |

*Note: In accordance with milestone instructions, no animation or UI layer was faked. These state hooks are exported deterministically for the next Mission Control visualization phase.*

---

## 6. Truthful Boundary: Remaining Irwan Limitation

This milestone explicitly resolves Joko's runtime execution. The boundary remains truthful regarding Irwan:
- **Research Source:** `EXISTING_APPROVED_EVIDENCE_PACK` (from `scripts/dryrun/evidence-pack.json`).
- **Irwan Status:** Autonomous web search and live document retrieval by Irwan are **not yet implemented** (`SOURCE_ACQUISITION_BLOCKED`).
- **Claim Provenance:** Only verified, author-safe claims were provided to Joko.

---

## 7. Safety Invariants & Zero Authority Verification

All system invariants remain strictly verified:
- `automation_mode = OFF`
- `SOCIAL_AUTOMATION = OFF`
- `AUTO_PUBLISH = OFF`
- `publishingAuthority = 0`
- `JEV_MODE = shadow`
- `mediaWorker = DISABLED`
- `Jefry execution authority = 0`
- No live publication endpoint was called. No deployment was executed.

---

## 8. Verification & Test Summary

1. `scripts/test-editorial-runtime-1.js`: **18/18 PASS** (Full runtime unit and safety suite).
2. `scripts/runtime-proof-runner.js`: **PASS** (Real execution: 23s latency, 5,945 tokens, score 90/100).
3. `scripts/test-editorial-production-dryrun.js`: **13/13 PASS** (Dry-run regression intact).
4. `scripts/test-visitor-pain-angle.js`: **14/14 PASS** (Visitor pain context regression intact).
5. `scripts/test-editorial-source-acquisition.js`: **14/14 PASS** (Source acquisition regression intact).
6. `scripts/test-editorial-human-quality.js`: **22/22 PASS** (Deterministic QA suite intact).
7. `npx tsc --noEmit`: Clean (0 errors).
8. `npm run build`: Clean (SSR production server bundle built in 6.18s).
