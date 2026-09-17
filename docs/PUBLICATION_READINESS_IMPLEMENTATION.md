# 🏛️ RancangLoka Publication Readiness Gate — Implementation Report (PUBLICATION-0)

**Document Version:** 1.0.0  
**Milestone:** PUBLICATION-0 — Publication Readiness Gate Implementation  
**Status:** COMPLETE (Local / Staging Tested — Zero Production Mutation)  
**Date:** 2026-09-07  

---

## 1. Executive Summary

Milestone **PUBLICATION-0 (Publication Readiness Gate Implementation)** implements the deterministic, fail-closed quality gate that evaluates whether an ingested draft article has achieved absolute editorial, technical, visual, and human readiness to be scheduled:

$$\text{DRAFT} + \text{EDITORIAL GUARDS} + \text{EVIDENCE / CITATIONS} + \text{MEDIA READINESS} + \text{HUMAN APPROVAL} + \text{METADATA} \longrightarrow \mathbf{READY\_TO\_SCHEDULE}$$

### Core Operating Boundaries Maintained:
1. **Zero Publication Decision:** PUBLICATION-0 does NOT decide publication dates, times, pacing, or daily quotas (deferred strictly to PUBLICATION-1 Adaptive Planner).
2. **Zero Auto-Publish:** `AUTO_PUBLISH = OFF`. Articles strictly remain in `'draft'` status.
3. **Zero Content Generation:** `MODEL_CALLS = 0`. Pure deterministic regex and SQL evaluation.
4. **Zero Production Mutation:** `PRODUCTION_MUTATION = NONE`. Tested in isolated local SQLite / staging environment.
5. **Fail-Closed Guarantee:** Any corrupt, missing, or unknown guard state immediately yields `overall_status = 'BLOCKED'` or `'NOT_READY'`.

---

## 2. Persistence Model & Migration 0007

**Migration File:** `db/migrations/0007_publication_readiness_and_approvals.sql`

To maintain strict state decoupling, `articles.status` is **never** overloaded with intermediate workflow states. Two new relational tables are introduced:

### 2.1 `article_editorial_approvals`
Tracks explicit, auditable human editorial sign-offs cryptographically tied to the article body digest and the active featured image asset ID:

```sql
CREATE TABLE IF NOT EXISTS article_editorial_approvals (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    article_id INTEGER NOT NULL REFERENCES articles(id) ON DELETE CASCADE,
    approved_by TEXT NOT NULL,                        -- Operator username / authenticated email
    approved_role TEXT NOT NULL DEFAULT 'editor_in_chief', -- 'editor_in_chief' | 'managing_editor'
    approval_status TEXT NOT NULL DEFAULT 'APPROVED', -- 'APPROVED' | 'REJECTED' | 'REVOKED'
    approved_content_hash TEXT NOT NULL,              -- SHA-256 of article content_md at approval time
    approved_asset_id TEXT NOT NULL,                  -- asset_id of active featured media at approval time
    notes TEXT,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CHECK (approval_status IN ('APPROVED', 'REJECTED', 'REVOKED'))
);

CREATE INDEX IF NOT EXISTS idx_approvals_article_status 
ON article_editorial_approvals(article_id, approval_status);

CREATE INDEX IF NOT EXISTS idx_approvals_created_at 
ON article_editorial_approvals(created_at DESC);
```

### 2.2 `article_publication_readiness`
Stores immutable, point-in-time evaluation snapshots with machine-readable blocker codes:

```sql
CREATE TABLE IF NOT EXISTS article_publication_readiness (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    article_id INTEGER NOT NULL REFERENCES articles(id) ON DELETE CASCADE,
    is_ready INTEGER NOT NULL DEFAULT 0,              -- 1 = READY_TO_SCHEDULE, 0 = NOT_READY
    overall_status TEXT NOT NULL DEFAULT 'NOT_READY', -- 'READY_TO_SCHEDULE' | 'NOT_READY' | 'BLOCKED'
    content_hash TEXT NOT NULL,
    snapshot_json TEXT NOT NULL,                      -- Complete JSON payload of evaluation vectors & blockers
    evaluated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CHECK (is_ready IN (0, 1)),
    CHECK (overall_status IN ('READY_TO_SCHEDULE', 'NOT_READY', 'BLOCKED'))
);

CREATE INDEX IF NOT EXISTS idx_readiness_article 
ON article_publication_readiness(article_id, evaluated_at DESC);

CREATE INDEX IF NOT EXISTS idx_readiness_ready 
ON article_publication_readiness(is_ready, overall_status);
```

---

## 3. The 6 Readiness Verification Vectors

The core engine (`src/lib/publication/service.ts`) executes six deterministic verification vectors:

| Vector | Required Criteria | Blocker Code on Failure |
| :--- | :--- | :--- |
| **1. Article Core Integrity** | - `articles.status == 'draft'`<br>- `content_md` non-empty ($\ge 300$ words)<br>- Valid slug kebab-case<br>- Title $10 \le \text{len} \le 120$<br>- Description $10 \le \text{len} \le 200$<br>- Category is one of 6 official categories<br>- Canonical author (`dewan-redaksi-spasial` / `tim-riset-materialitas`) | `ARTICLE_NOT_DRAFT`<br>`ARTICLE_CONTENT_EMPTY`<br>`ARTICLE_CONTRACT_FAILED`<br>`SLUG_INVALID`<br>`TITLE_LENGTH_INVALID`<br>`DESCRIPTION_INVALID`<br>`CATEGORY_INVALID`<br>`CANONICAL_AUTHOR_REQUIRED` |
| **2. Editorial Guard Suite** | - Zero banned placeholders (`TODO`, `[EVIDENCE NEEDED]`, etc.)<br>- $\ge 2$ H2 headings (`## `)<br>- Monetary guard PASS (zero exact price points, `Rp`, `IDR`, unverified budget claims)<br>- Editorial QA PASS (no script tags or unescaped HTML) | `ARTICLE_CONTRACT_FAILED`<br>`MONETARY_GUARD_FAILED`<br>`EDITORIAL_QA_FAILED` |
| **3. Evidence & Citations** | - Ingest receipt contract version $\ge 1$<br>- Citation guard PASS (no links to untrusted/spam domains) | `EVIDENCE_FAILED` / `EVIDENCE_GATE_FAILED`<br>`CITATION_FAILED` / `CITATION_GUARD_FAILED` |
| **4. Visual Media Binding** | - Active featured binding in `article_media` (`role = 'featured'`, `is_active = 1`)<br>- Bound `media_assets.status == 'VALIDATED'`<br>- `media_type == 'image'`<br>- Dimensions $\ge 600\times338$<br>- Non-empty alt text | `FEATURED_MEDIA_MISSING`<br>`MEDIA_NOT_VALIDATED`<br>`MEDIA_TYPE_INVALID`<br>`MEDIA_DIMENSIONS_INVALID`<br>`ALT_TEXT_MISSING` |
| **5. Cryptographic Human Approval** | - Approval record exists in `article_editorial_approvals`<br>- `approval_status == 'APPROVED'`<br>- `approved_content_hash == articles.content_hash`<br>- `approved_asset_id == active_featured_binding.asset_id` | `APPROVAL_MISSING`<br>`APPROVAL_STATUS_REJECTED`<br>`APPROVAL_STATUS_REVOKED`<br>`APPROVAL_STALE_CONTENT`<br>`APPROVAL_STALE_MEDIA` |
| **6. Publication Metadata & Anti-Conflict** | - `key_takeaways` JSON array with $3 \le \text{items} \le 5$<br>- Zero slug/inventory collision with published articles<br>- Zero publication block flags | `TAKEAWAYS_INVALID`<br>`METADATA_INCOMPLETE`<br>`PUBLICATION_CONFLICT`<br>`INVENTORY_CONFLICT` |

---

## 4. Cryptographic Approval Invalidation

In architectural publishing, changing body content or replacing a cover image materially alters the visual and technical assertions of the article.

1. **Content Mutation Invalidation:**
   - Evaluates: `articles.content_hash == approval.approved_content_hash`.
   - If unequal, immediately flags `APPROVAL_STALE_CONTENT` and `CONTENT_CHANGED_AFTER_APPROVAL`.
2. **Media Replacement Invalidation:**
   - Evaluates: `active_featured_asset.asset_id == approval.approved_asset_id`.
   - If unequal, immediately flags `APPROVAL_STALE_MEDIA` and `MEDIA_CHANGED_AFTER_APPROVAL`.
3. **Revocation Support:**
   - When an editor revokes approval, an audit record is stored with `approval_status = 'REVOKED'`, immediately dropping the article from `READY_TO_SCHEDULE`.

---

## 5. API Endpoints & Planner Handoff

The following least-privilege endpoints are implemented under `/api/admin/publication/*`:

1. **`GET /api/admin/publication/readiness/[id]`**:
   - Inspects latest readiness snapshot or evaluation history (`?history=true`).
2. **`POST /api/admin/publication/readiness/[id]`**:
   - Triggers fresh, synchronous readiness gate evaluation.
3. **`GET /api/admin/publication/approve/[id]`**:
   - Retrieves approval history for an article.
4. **`POST /api/admin/publication/approve/[id]`**:
   - Records human editorial sign-off, binds content hash & asset ID, and automatically evaluates readiness.
5. **`DELETE /api/admin/publication/approve/[id]`**:
   - Revokes human approval.
6. **`GET /api/admin/publication/ready-to-schedule`** *(Planner Handoff)*:
   - Clean read-only query returning all draft articles with verified `is_ready = 1` matching current content hashes.
   - Bounded cleanly: zero scheduling, zero quota logic, zero article mutation.

---

## 6. Automated Test Matrix & Verification

**Test Suite:** `scripts/test-publication-readiness.js`  
**Total Assertions:** 85 PASSED / 0 FAILED across 28 required test vectors:

1. Draft with missing guards = NOT_READY (`MONETARY_GUARD_FAILED`)
2. Editorial guards PASS but no media = NOT_READY (`FEATURED_MEDIA_MISSING`)
3. Media valid but no approval = NOT_READY (`APPROVAL_MISSING`)
4. Approval created correctly (cryptographic binding verified)
5. All checks PASS = READY_TO_SCHEDULE (all 6 vectors PASS)
6. Repeated evaluation is idempotent
7. Article content change invalidates approval (`APPROVAL_STALE_CONTENT`)
8. Featured media change invalidates approval (`APPROVAL_STALE_MEDIA`)
9. Invalid / non-validated media blocks (`MEDIA_NOT_VALIDATED`)
10. Missing alt text blocks (`ALT_TEXT_MISSING`)
11. Non-draft article blocks (`ARTICLE_NOT_DRAFT`)
12. Invalid category blocks (`CATEGORY_INVALID`)
13. Invalid author blocks (`CANONICAL_AUTHOR_REQUIRED`)
14. Metadata incomplete blocks (`TAKEAWAYS_INVALID`, `METADATA_INCOMPLETE`)
15. Publication conflict blocks (`PUBLICATION_CONFLICT`, `INVENTORY_CONFLICT`)
16. Unknown guard state fails closed (`GUARD_STATE_UNKNOWN`, `FAIL_CLOSED`)
17. Approval revoke works (`APPROVAL_STATUS_REVOKED`)
18. Stale approval cannot become READY_TO_SCHEDULE
19. Readiness snapshot persisted in database
20. Individual blocker codes persisted in JSON
21. Article body remains strictly unchanged
22. `articles.status` remains strictly `'draft'`
23. Zero publish permission
24. Zero scheduler permission
25. Zero AI/model calls (`MODEL_CALLS = 0`)
26. `READY_TO_SCHEDULE` query returns only eligible articles
27. Readiness history is auditable
28. Secrets absent from snapshots / logs
