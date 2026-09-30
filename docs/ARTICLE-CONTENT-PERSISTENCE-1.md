# 🛡️ ARTICLE-CONTENT-PERSISTENCE-1 — Engineering Report & Architecture Specification

## 1. Executive Summary

Milestone `ARTICLE-CONTENT-PERSISTENCE-1` resolves the root cause of `content_html` serialization errors in RancangLoka's database layer, establishes strict persistence invariants across all write paths, and safely repairs the derived HTML of Article 5 in production Cloudflare D1 without mutating its approved canonical markdown, content hash, approval, receipt, or metadata.

---

## 2. Root Cause Analysis (Tracing `articles.content_html`)

### The Symptom
Article 5 in production Cloudflare D1 had its `content_html` column stored as literal string `"[object Object]"` (15 characters) instead of the rendered HTML corresponding to its 2,117-word canonical `content_md` (15,942 characters).

### The Ingestion & Write Path Trace
1. **Database Layer (`src/lib/db.ts`):**
   - `insertArticle` previously executed:
     ```ts
     const content_html = article.content_html || '';
     ...
     insertArticleStmt.bind(..., content_html, ...);
     ```
   - `updateArticle` previously executed:
     ```ts
     content_html: article.content_html !== undefined ? article.content_html : existing.content_html
     ```
   - `insertHermesArticleAndReceipt` previously bound `articleData.content_html` directly.
2. **Missing Type and Promise Guards:**
   - `renderArticleMarkdownSafely` in `src/lib/article/renderer.ts` is an `async` function returning `Promise<string>`.
   - If any caller or migration script passed `renderArticleMarkdownSafely(...)` without `await`, or if an AST/object was passed from an external parser (e.g. `{ type: 'root', children: [...] }`), or if an ingest payload contained `{ content_html: { ... } }`:
   - SQLite client drivers and Cloudflare D1 parameter binding coerce non-primitives using `String(value)` or `.toString()`, converting objects to literal `"[object Object]"` and unawaited promises to `"[object Promise]"` or `"[object Object]"`.
   - No runtime assertions existed to verify that `content_html` was a valid HTML string, nor to reject literal `"[object Object]"`.

---

## 3. Architectural Role: Canonical Source vs. Derived Render Cache

To prevent authority ambiguity, RancangLoka enforces a strict architectural division:

| Field | Role | Authority | Immutability |
| :--- | :--- | :--- | :--- |
| `content_md` | **Canonical Editorial Source of Truth** | Absolute Authority | Immutable post-editorial approval. Source of `content_hash`. |
| `content_html` | **Deterministic Derivative / Render Cache** | Derived Cache | Deterministically reproducible at any time from `content_md` via `renderArticleMarkdownSafely`. |

### Key Guarantees:
1. `content_html` is **never** more authoritative than `content_md`.
2. Content hash and cryptographic receipts are calculated solely against canonical `content_md` (normalized text).
3. If `content_html` is absent, empty, or malformed, the system deterministically regenerates it from `content_md`.
4. The runtime fallback in `src/pages/[slug].astro` and `src/pages/admin/preview/[slug].astro` remains active as defense-in-depth: if `content_html` is missing or malformed (`length < 50` or `[object Object]`), it falls back to rendering `content_md`.

---

## 4. Writer Hardening (`src/lib/db.ts` & `src/lib/article/pipeline.ts`)

### `resolveAndValidateContentHtml` Implementation
All write operations (`insertArticle`, `updateArticle`, `insertHermesArticleAndReceipt`) now route through `resolveAndValidateContentHtml`:
1. **Promise Awaiting:** If passed an unawaited Promise, it is awaited before validation.
2. **Type Enforcement:** Strictly rejects non-string objects, arrays, numbers, booleans, and AST nodes with `DatabaseConstraintError`.
3. **Literal Pattern Rejection:** Strictly rejects `"[object Object]"` or `"[object Promise]"` with `DatabaseConstraintError`.
4. **Deterministic Derivation:** If `content_html` is omitted or empty but `content_md` is present, it auto-derives the safe HTML from `content_md` using `renderArticleMarkdownSafely(content_md)`.
5. **Strict Sanitization:** Passes derived/provided HTML through `sanitizeArticleHtml` to enforce the strict article tag allowlist and strip malicious scripts/handlers.

---

## 5. Article 5 Derivative Repair Verification

Article 5 in production Cloudflare D1 was repaired via `scripts/repair-article5-content-html.js`:
- **Target Article:** ID 5 (`kusen-aluminium-vs-upvc-untuk-rumah-tropis-di-indonesia`)
- **Action:** Regenerated `content_html` (17,940 characters) from canonical `content_md`.
- **Invariants Verified Post-Repair:**
  - `articles.content_html`: 17,940 characters, valid HTML string, zero `[object Object]`.
  - `articles.content_md`: 15,942 characters (100% UNCHANGED).
  - `articles.content_hash`: `14275912029058f33a907831c8bf4d081129f7470f572305c861c6d46c5e5277` (100% UNCHANGED).
  - `article_editorial_approvals`: ID 9 remains valid for hash `14275912029058f33a907831c8bf4d081129f7470f572305c861c6d46c5e5277` (100% UNCHANGED).
  - `publication_execution_receipts`: Receipt `rcpt_bbae85b48e1b2f8d` remains valid (100% UNCHANGED).
  - `articles.published_at`: `2026-09-28T06:10:39.816Z` (100% UNCHANGED).
  - `article_state_transitions`: Recorded audit log with `transition_type = 'DERIVED_CONTENT_REPAIR'` (`ast_5_derived_repair_1790590005246`).

---

## 6. Regression Test Suite (`scripts/test-article-persistence.js`)

A dedicated regression test suite was created and executes 7 deterministic tests:
1. `Promise/object renderer output cannot be stored directly without resolving to a valid string` (PASS).
2. `content_html writer requires string and rejects non-strings (numbers, arrays, AST nodes)` (PASS).
3. `Markdown renderer is awaited when content_html is omitted or derived from content_md` (PASS).
4. `"[object Object]" and AST stringification persistence is rejected` (PASS).
5. `Malformed content_html triggers frontend fallback to canonical content_md` (PASS).
6. `Valid generated content_html renders normally without fallback re-render` (PASS).
7. `Article 5 content_hash and Approval ID 9 remain 100% unchanged after derivative repair` (PASS).
