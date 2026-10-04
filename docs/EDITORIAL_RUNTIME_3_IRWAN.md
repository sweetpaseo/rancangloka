# EDITORIAL-RUNTIME-3 — Real Irwan Research & Evidence Acquisition

## 1. Previous Research Reality

Prior to this milestone, Irwan (`evidence_researcher_lead`) was a conceptual staff identity and a placeholder in the staff registry. While Rina deterministically audited Evidence Packs and Joko consumed them at runtime, the Evidence Pack itself was either a pre-compiled fixture (`scripts/dryrun/evidence-pack.json`) or produced by developer assistants. Irwan did not execute real live web discovery, content extraction, or source verification.

The forensic audit previously concluded:
```
SOURCE_ACQUISITION_BLOCKED
EDITORIAL_RUNTIME_NOT_PROVEN (for Irwan)
```

**Milestone `EDITORIAL-RUNTIME-3`** builds and proves the **first real research runtime** for Irwan, transitioning evidence acquisition from static data to an operator-triggered, verifiable process.

---

## 2. Irwan Runtime Architecture

The execution pipeline flows strictly as follows:

```
[ Human Operator (CHIEF_EDITOR) ]
             │
             ▼ Explicit Authorization
[ Irwan Runtime Engine (executeEditorialResearchJob) ]
             │
             ├─► [ Query Planning (Focused Building Science Queries) ]
             │
             ├─► [ Real Search / Source Discovery (CrossRef & Wikipedia Open APIs) ]
             │         │ (SEARCH_IS_DISCOVERY: Snippets != Evidence)
             │         ▼
             ├─► [ Real Document Retrieval (fetchWikipediaPageContent) ]
             │         │ (Content Hash SHA-256 Generated)
             │         ▼
             ├─► [ Document Reading & Extraction (extractPassagesFromText) ]
             │         │ (Locator, exact text, relevance, claim relationship)
             │         ▼
             ├─► [ Barrier Classification (Restricted Portals & Paywalls) ]
             │         │ (SOURCE_RETRIEVAL_BLOCKED: Truthfully recorded)
             │         ▼
             ├─► [ Claim Inventory Classification (VERIFIED, SUPPORTED, PARTIAL) ]
             │         │ (Exact Numbers Policy: Unsupported numbers stripped)
             │         ▼
             ├─► [ Author-Safe Claims Generation (author_safe_claims) ]
             │         │ (Inherits uncertainty, Monetary Silence, Prohibited elements)
             │         ▼
             ├─► [ Genuine Evidence Pack Assembled ]
             │
             ▼
[ RESEARCH_HUMAN_REVIEW_REQUIRED (Stop Gate: Joko NOT invoked, publishingAuthority = 0) ]
```

---

## 3. Search / Retrieval Mechanism

- **Discovery Engines:**
  - `CrossRef Open API` (`https://api.crossref.org/works`): Queries peer-reviewed literature, publishers, DOIs, and abstracts without commercial scraping.
  - `Wikipedia Technical API` (`https://en.wikipedia.org/w/api.php`): Discovers and indexes authoritative open building-science entries.
- **Search vs Evidence Principle:**
  ```
  SEARCH_IS_DISCOVERY != EVIDENCE
  ```
  Search result snippets alone are strictly treated as candidate pointers and **never** produce `VERIFIED` evidence status without actual retrieval and reading.

---

## 4. Source State Model

Irwan implements the project's canonical source verification taxonomy without creating duplicate or conflicting terms:
- `SOURCE_RETRIEVED_AND_VERIFIED`: Document physically retrieved, SHA-256 hash verified, content read, and supporting passages extracted.
- `SOURCE_METADATA_ONLY`: Bibliographic record or DOI known, but full text unretrieved.
- `SOURCE_REFERENCE_KNOWN_NOT_RETRIEVED`: Standard or regulation known by reference, but text unretrieved.
- `SOURCE_UNAVAILABLE` / `SOURCE_RETRIEVAL_BLOCKED`: Document legally restricted or paywalled.
- `SOURCE_PROVENANCE_UNKNOWN`: Unverified provenance.

---

## 5. Source Reading & Evidence Extraction

When an open document is retrieved, Irwan inspects its full text and extracts supporting passages:
- `source_id`: Unique identifier (e.g. `SRC-OPEN-WIKI-RADBAR`).
- `section_or_heading`: Truthful heading (e.g. `Overview / Lead`, `Requirements`). Page numbers are never invented for HTML documents.
- `exact_text`: Normalized excerpt.
- `content_hash`: Cryptographic SHA-256 digest of the entire document.
- `claim_relationship`: `DIRECT_SUPPORT` | `CONTEXTUAL_BACKGROUND` | `CONTRAST_LIMITATION`.

---

## 6. Claim Inventory & Exact Number Policy

- **Claim Support Rules:** A claim cannot be marked `VERIFIED` solely because the model knows it, search snippets repeat it, or metadata exists.
- **Exact Numbers Policy:**
  - Unsupported exact numerical values (such as `60°C hingga 75°C`, `800-1000 W/m²`, `50-60 W/m·K`, `20-25 mm`, `1:300 hingga 1:150`) are **strictly prohibited** from author-safe claims.
  - Qualitative principles (e.g. low thermal mass, air gap requirement, balanced soffit-to-ridge airflow) are preserved.
  - Words like "sekitar" or "biasanya" are never used to rescue an unverified exact number.

---

## 7. Author-Safe Claims Generation

Irwan generates `author_safe_claims` where:
- Each safe claim preserves its original claim ID (`CLM-001` through `CLM-008`).
- Prohibited numerical elements and Monetary Silence (`Rp`, `rupiah`, `harga`) are explicitly enforced.
- Partially supported claims inherit mandatory qualification (`qualification_required`).

---

## 8. Actual Runtime Proof Execution

On October 4, 2026, an operator-triggered live research run (`scripts/run-irwan-research-proof.js`) was executed for the topic:  
*"Atap Metal Terasa Panas: Apakah Insulasi Foil Cukup atau Perlu Ventilasi Atap?"*

### Operational Telemetry
- **Job ID:** `job_research_task_runtime_proof_irwan_research_001`
- **Operator:** `antigravity_operator` (`CHIEF_EDITOR`)
- **Runtime Duration:** 3,709 ms (3.7 seconds)
- **Queries Executed:** 4
- **Sources Discovered:** 19 candidates across CrossRef and Wikipedia Open API
- **Documents Retrieved & Inspected:** 1 full document (17,629 bytes, SHA-256: `c31f273c848cfd43d91a35e8aec864ac1921bd8060f5ebf51fcc7d9bb37b6401`)
- **Passages Extracted:** 32 verified excerpts
- **Blocked / Paywalled Sources:** 3 (SNI 03-6572-2001, ASHRAE Fundamentals, ASTM C1371)
- **Claims Formulated:** 8
- **Author-Safe Claims Produced:** 8
- **Final Stop Gate:** `RESEARCH_HUMAN_REVIEW_REQUIRED` (Joko was NOT invoked)

### Provenance Artifacts Saved
- **Fresh Evidence Pack:** [`scripts/runtime-proof/irwan-metal-roof-evidence-pack.json`](file:///c:/Users/Fanto/Desktop/antigravity/rancangloka/rancangloka-astro/scripts/runtime-proof/irwan-metal-roof-evidence-pack.json)
- **Runtime Metadata & Trace:** [`scripts/runtime-proof/irwan-metal-roof-runtime-meta.json`](file:///c:/Users/Fanto/Desktop/antigravity/rancangloka/rancangloka-astro/scripts/runtime-proof/irwan-metal-roof-runtime-meta.json)
- *Integrity Guarantee:* Previous dry-run Evidence Pack (`scripts/dryrun/evidence-pack.json`) was **not** overwritten.

---

## 9. Blocked Sources Truthfulness

Sources requiring commercial subscription or closed government portals are recorded with complete legal honesty without simulation:
1. `SRC-SNI-6572`: `RESTRICTED_PORTAL` (BSN official portal).
2. `SRC-ASHRAE-FUND`: `COMMERCIAL_PAYWALL` (ASHRAE Handbook, $250+).
3. `SRC-ASTM-C1371`: `COMMERCIAL_PAYWALL` (ASTM International, $80+).

---

## 10. Pixel Office Runtime Hooks

Irwan runtime emits real operational trace events to enable truthful Pixel Office animation binding:
- `IRWAN_QUERY_PLANNED` -> Irwan workstation state -> `SEARCHING`
- `SOURCE_RETRIEVAL_STARTED` -> Irwan workstation state -> `FETCHING_DOCUMENTS`
- `SOURCE_READ` / `EVIDENCE_EXTRACTED` -> Irwan workstation state -> `ANALYZING_EVIDENCE`
- `EVIDENCE_PACK_CREATED` -> Irwan animation completes -> `WAITING_REVIEW`
- `RESEARCH_HUMAN_REVIEW_REQUIRED` -> Central Hall inspection badge

*No animations or UI layers were faked in this milestone.*

---

## 11. Test Verification

The 18-test suite in [`scripts/test-editorial-runtime-3.js`](file:///c:/Users/Fanto/Desktop/antigravity/rancangloka/rancangloka-astro/scripts/test-editorial-runtime-3.js) passed with 100% success:
- Search snippets rejected as evidence (PASS)
- Metadata-only source cannot produce verified claim (PASS)
- Unretrieved source cannot contain locators (PASS)
- Retrieved source requires reading and extraction (PASS)
- Exact numbers stripped from author-safe claims (PASS)
- Prior knowledge rejected as evidence (PASS)
- Blocked sources recorded truthfully (PASS)
- SHA-256 hash stored (PASS)
- Foreign references not mislabeled as local regulations (PASS)
- Safe claims inherit uncertainty (PASS)
- Fresh Evidence Pack generated without copying fixtures (PASS)
- Runtime trace reflects actual operational sequence (PASS)
- Joko not invoked and publication remains impossible (PASS)
- Stop gate at `RESEARCH_HUMAN_REVIEW_REQUIRED` enforced (PASS)

---

## 12. Safety Invariants

- `automation_mode = OFF`
- `SOCIAL_AUTOMATION = OFF`
- `AUTO_PUBLISH = OFF`
- `publishingAuthority = 0`
- `JEV_MODE = shadow`
- `mediaWorker = DISABLED`
- `Jefry execution authority = 0`
- Zero deployment, zero publication.

---

## 13. Remaining Gaps & Next Steps

1. **Commercial Standards Intake:** Official Indonesian standards (SNI) remain in closed portal status. Future phases may integrate licensed organizational repository access.
2. **Autonomous Retrieval Coverage:** Expansion to institutional repositories (e.g. Kemendikbud SINTA, Neliti open access, PUPR digital library).
3. **Pipeline Chaining:** In subsequent milestones, Irwan's genuine Evidence Pack can be formally handed off to Joko V2 runtime under Chief Editor approval.

---

## 14. Final Milestone Classification

```
IRWAN_RUNTIME_PROVEN
```
Empirical evidence proves that Irwan actually executes real source discovery, retrieves and inspects real documents, calculates SHA-256 hashes, extracts evidence passages, validates claim support, generates author-safe claims without unsupported exact numbers, and stops at `RESEARCH_HUMAN_REVIEW_REQUIRED`.
