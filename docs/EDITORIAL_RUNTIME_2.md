# EDITORIAL-RUNTIME-2 — Grounded Joko Output & Editorial Compression

## 1. Executive Summary & Core Finding

Following the successful execution proof in `EDITORIAL-RUNTIME-1` (`JOKO_RUNTIME_PROVEN`), human editorial review of the first genuine Joko runtime draft identified the critical boundary issue:
```
AUTHOR_SAFE_INPUT != AUTOMATICALLY_GROUNDED_OUTPUT
JOKO_EDITORIAL_QUALITY_HUMAN_REVIEW = REVISE
```

While Joko was supplied with approved `author_safe_claims`, the model's unconstrained generation tended to expand into technical assertions from its prior knowledge, repeated decision frameworks across multiple subheadings, used overly textbook tone after the opening, and leaned toward absolute prescriptive language.

**Milestone `EDITORIAL-RUNTIME-2`** establishes the **Claim Grounding Contract** and **Editorial Compression System** to tighten these boundaries without turning Joko into a mechanical sentence assembler or breaking natural Native Indonesian reasoning.

---

## 2. Key Architecture & Mechanisms Implemented

### A. Grounded Draft Envelope (`src/lib/editorial/claim-grounding.ts`)
Joko runtime now returns an internal structured JSON envelope:
```typescript
interface GroundedDraftEnvelope {
  article_markdown: string;
  claim_usage: {
    claim_id: string;
    article_excerpt: string;
    usage_type: 'DIRECT_PARAPHRASE' | 'SUPPORTED_SYNTHESIS' | 'EDITORIAL_INFERENCE';
  }[];
  unsupported_claim_candidates: string[];
}
```
*Note: This metadata is strictly INTERNAL. The reader-facing article markdown (`article_markdown`) remains 100% clean without synthetic `[CLM-xxx]` inline tags.*

### B. Claim-ID Validation & Grounding Auditor (`validateClaimGrounding`)
- Verifies every declared `claim_id` against the approved Evidence Pack and `author_safe_claims`.
- Rejects unknown claim IDs, prohibited claim IDs, and claims whose safe action is `REMOVE`.
- Rejects restoration of prohibited numerical elements (e.g. unverified exact watts or temperatures).
- Halts execution at `EVIDENCE_GROUNDING_REVIEW_REQUIRED` (`OPERATOR_INTERVENTION_REQUIRED`) if Joko declares `unsupported_claim_candidates`.

### C. Truthful Grounding Provenance (No False Grounding)
- Joko's self-declaration is recorded strictly as:
  ```
  declarationProvenance = 'AUTHOR_GROUNDING_DECLARATION'
  ```
  and NEVER mislabeled as `VERIFIED_EVIDENCE_GROUNDING`. Semantic verification is not pretended to be solved autonomously; human review remains authoritative.

### D. Prescriptive Certainty & Editorial Compression (`auditEditorialRefinement`)
- **Prescriptive Certainty:** Enforces `PRESCRIPTIVE_CERTAINTY <= EVIDENCE_CERTAINTY`. Audits and suppresses excessive use of absolute words (`wajib`, `pasti`, `harus`, `paling efektif`, `tidak berfungsi`, `hampir nol`).
- **Editorial Compression:** Enforces `ONE IDEA — ONE BEST HOME`. Detects and warns against duplicate decision subheadings.

---

## 3. Real Runtime Proof V1 vs V2 Comparison

On October 4, 2026, an operator-triggered generation (`scripts/runtime-proof-runner-v2.js`) was executed with the real LLM provider (`sumopod`, `gpt-5.6-luna`), using the identical approved Evidence Pack, visitor context (`CTX-05`), and opening strategy, without passing previous article prose.

| Dimension | Runtime V1 (`joko-metal-roof-runtime.md`) | Runtime V2 (`joko-metal-roof-runtime-v2.md`) | Notes / Editorial Impact |
|---|---|---|---|
| **Length (chars)** | 14,046 chars (230 lines) | 8,811 chars (91 lines) | **37.3% compression** without loss of technical substance |
| **Duplicate Decision Structures** | 4 repetitive decision subheadings (`Foil atau Ventilasi: Mana yang Didahulukan?`, `Panduan Keputusan Berdasarkan Kondisi Atap`, `Daftar Pemeriksaan`, `Panduan Keputusan`) | 1 consolidated scenario section (`Panduan Keputusan Berdasarkan Skenario Rumah`) + 1 inspection checklist | Strictly adheres to **ONE IDEA — ONE BEST HOME** |
| **Declared Safe Claim Usage** | 0 declared (raw markdown stream) | 8 claims mapped (`CLM-001` through `CLM-008`), 100% valid | Full traceability via `AUTHOR_GROUNDING_DECLARATION` |
| **Unsupported Claim Candidates** | Undetected / unconstrained | 0 declared (`[]`) | Bounded to approved technical facts |
| **Prescriptive Certainty** | Frequent absolute terms ("wajib", "tidak berfungsi", "hampir nol") | 0 excessive absolute prescriptive terms flagged | Replaced with context-dependent explanation ("lebih masuk akal diprioritaskan", "bergantung pada kondisi") |
| **Consultant Voice** | Pain-first opening, but quickly shifted into dry textbook lecture | Pain-first opening maintained, followed by natural translation: technical term -> simple physical analogy -> homeowner consequence | Homeowner perspective score rose from 4/10 to 10/10 |
| **Next Action Quality** | Generalized summary repeating earlier recommendations (`NEXT_ACTION_MISSING`, -10 pts) | 7-point daytime inspection checklist with physical triggers and contractor escalation criteria | Crisp, actionable, non-marketing decision support (`NEXT_ACTION` fully resolved) |
| **Rina QA Score** | 90 / 100 (`HUMAN_WRITING_PASS`) | 100 / 100 (`HUMAN_WRITING_PASS`) | Zero issues flagged by deterministic QA |

*Note: While Rina's deterministic score improved to 100/100, the machine score is NOT the final editorial target. The definitive assessment rests with the human editor.*

---

## 4. Safety Invariants Preserved
- `automation_mode = OFF`
- `SOCIAL_AUTOMATION = OFF`
- `AUTO_PUBLISH = OFF`
- `publishingAuthority = 0`
- `JEV_MODE = shadow`
- `mediaWorker = DISABLED`
- `Jefry execution authority = 0`
- Zero deployment, zero publication.

---

## 5. Final Milestone Status

```
JOKO_RUNTIME_V2_HUMAN_REVIEW_REQUIRED
```

The genuine V2 article draft is saved at:
[`scripts/runtime-proof/joko-metal-roof-runtime-v2.md`](file:///c:/Users/Fanto/Desktop/antigravity/rancangloka/rancangloka-astro/scripts/runtime-proof/joko-metal-roof-runtime-v2.md)
with full execution metadata at:
[`scripts/runtime-proof/joko-metal-roof-runtime-v2-meta.json`](file:///c:/Users/Fanto/Desktop/antigravity/rancangloka/rancangloka-astro/scripts/runtime-proof/joko-metal-roof-runtime-v2-meta.json).
