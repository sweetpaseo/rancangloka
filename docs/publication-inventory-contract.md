# 📜 RancangLoka Publication Inventory Contract (Phase 3B-5B)

**Endpoint:** `GET /api/internal/v1/publication-inventory`  
**Protocol Version:** `v1`  
**Classification:** Internal Machine-to-Machine (M2M) Read-Only Inventory  
**Consumers:** Downstream Hermes Topic Hunter / Planner (Anti-Duplicate & Anti-Cannibalization Engine)

---

## 1. Purpose & Architectural Scope

The Publication Inventory API serves as a high-performance, authenticated, read-only window into the existing publication corpus in Cloudflare D1.

Downstream systems (Hermes Topic Hunter & Editorial Planner) query this endpoint prior to queuing or producing any new article topic to perform:
1. **Anti-Duplication:** Ensure identical topics, focus keywords, slugs, or titles are not duplicated.
2. **Anti-Cannibalization:** Detect overlapping spatial and architectural intents across existing articles.
3. **Corpus Refresh / State Sync:** Maintain a fresh local index of published and draft articles.

> **CRITICAL BOUNDARY:**  
> This endpoint **only delivers metadata**. It does **NOT** decide whether a topic is similar, merged, or dropped (that is the exclusive responsibility of Phase 3B-5C).  
> It is **NOT** a public content API, **NOT** an admin CMS API, and contains **ZERO** mutation capability.

---

## 2. Read-Only & Zero-Mutation Promise

- **SQL Guarantee:** Uses strictly parameterized SQLite `SELECT` statements via Cloudflare D1 `.prepare().bind().all()`.
- **Zero Ingestion Impact:** No `INSERT`, `UPDATE`, `DELETE`, or table creations occur during any inventory request.
- **Replay Policy:** Because the endpoint is purely read-only, nonce persistence in D1 is unnecessary and deliberately omitted. A timestamp replay tolerance window of **±300 seconds** is enforced at the edge. Replays within this window grant no write or modification capability.

---

## 3. Dedicated Read-Only Security Model (Model B)

To uphold the principle of least privilege, **Publication Inventory uses dedicated read-only credentials completely separated from the Hermes Ingestion secret**.

If inventory read credentials are ever exposed, an attacker gains **no ability** to inject, edit, or publish articles into the system.

### Environment Variable Names
| Variable Name | Type | Purpose |
| :--- | :--- | :--- |
| `RANCANGLOKA_INVENTORY_READ_KEY_CURRENT_ID` | String (Public ID) | Identifier for active read key (e.g. `key_read_2026_01`) |
| `RANCANGLOKA_INVENTORY_READ_KEY_CURRENT` | Secret String | HMAC-SHA256 secret for active read key |
| `RANCANGLOKA_INVENTORY_READ_KEY_PREVIOUS_ID` | String (Optional) | Identifier for previous read key during rotation |
| `RANCANGLOKA_INVENTORY_READ_KEY_PREVIOUS` | Secret String (Optional) | HMAC-SHA256 secret for previous read key during rotation |

*Fail-Closed Semantics:* If `CURRENT_ID` or `CURRENT` secret is unset in Cloudflare runtime environment, the endpoint immediately halts with `503 INVENTORY_NOT_CONFIGURED`. Unknown key IDs return `401 KEY_NOT_ACCEPTED`.

---

## 4. Transport Headers & Canonical HMAC Specification

### Required Request Headers
All requests must include the following transport headers:

| Header Name | Format / Constraint | Example |
| :--- | :--- | :--- |
| `X-RL-Signature-Version` | Strict `v1` | `v1` |
| `X-RL-Timestamp` | Unix epoch in seconds (±300s window) | `1772683200` |
| `X-RL-Request-ID` | Opaque identifier: `req_[A-Za-z0-9_-]{16,80}` | `req_2026_inventory_reader_9999_xyz` |
| `X-RL-Key-ID` | Opaque key identifier: `[A-Za-z0-9_.-]{1,64}` | `key_test_reader_2026_current` |
| `X-RL-Signature` | `sha256=<64 lowercase hex characters>` | `sha256=d3b07384d113edec49eaa6238ad5ff00...` |

*(Note: `X-RL-Job-ID` belongs to article-ingest semantics and is strictly NOT required here).*

### Canonical HMAC String Format
The HMAC-SHA256 signature is calculated over a deterministic canonical string constructed as:

```text
v1
GET
/api/internal/v1/publication-inventory
<TIMESTAMP>
<REQUEST_ID>
<CANONICAL_QUERY_STRING>
```

Joined by single literal newline characters (`\n`), with no trailing newline.

### Canonical Query String Rules
1. Include only supported query parameters: `after_id`, `limit`, `status`.
2. Keys are sorted lexicographically (`after_id`, `limit`, `status`).
3. Values are URL-encoded (`encodeURIComponent`).
4. Parameter ordering in the incoming URL does **not** alter the canonical query string.
   - Example: `?status=all&limit=50&after_id=12` produces `after_id=12&limit=50&status=all`.
5. If no query parameters are sent, `<CANONICAL_QUERY_STRING>` is an empty string (`""`).

---

## 5. Query Parameters & Cursor Pagination

| Parameter | Type | Default | Constraints | Description |
| :--- | :--- | :--- | :--- | :--- |
| `limit` | Integer | `50` | Min `1`, Max `100` | Number of articles to return per page. Malformed input (e.g. `limit=abc`, `1.5`, `-1`, `101`) returns `400 INVALID_LIMIT`. |
| `after_id` | Integer | `null` | Must be `integer >= 0` | Stable ascending cursor for pagination (`WHERE a.id > ?`). Malformed input returns `400 INVALID_AFTER_ID`. |
| `status` | String | `'all'` | Strictly `['all', 'draft', 'published']` | Publication filter. Anything outside whitelist returns `400 INVALID_STATUS`. |

> **Security Note:** Any unknown or unexpected query parameters (e.g. `?hack=1`) are rejected with `400 INVALID_PARAMETER`. Arbitrary SQL injection or ordering is impossible.

### Cursor Pagination Contract (No OFFSET)
- The database executes: `ORDER BY a.id ASC LIMIT limit + 1`.
- If `limit + 1` rows are returned:
  - `has_more` = `true`.
  - The response returns the first `limit` items.
  - `next_after_id` = `id` of the last item in the returned slice.
- If fewer than or equal to `limit` rows are returned:
  - `has_more` = `false`.
  - `next_after_id` = `null`.

---

## 6. Authoritative Fields & Database Caveats

### Status as Sole Authoritative State
`articles.status` is the **only** source of truth for publication state (`published` vs `draft`).

> **CRITICAL CAVEAT ON `published_at`:**  
> In RancangLoka D1, draft articles inserted via ingestion pipelines also have a populated `published_at` timestamp (initialized to ingestion time).  
> **DO NOT** infer that an article is published merely because `published_at` is non-null. Always check `status === 'published'`.

### `content_hash` Semantics
- The endpoint returns the pre-computed SHA-256 fingerprint stored in `articles.content_hash`.
- It does **not** recompute hashes on the fly.
- If legacy rows have a `null` hash, `null` is returned without failing the request.

---

## 7. Response Contract

### Success Response (`200 OK`)
```json
{
  "schema_version": 1,
  "generated_at": "2026-09-05T12:00:00.000Z",
  "query": {
    "status": "all",
    "limit": 50,
    "after_id": null
  },
  "articles": [
    {
      "id": 1,
      "slug": "rekayasa-sirkulasi-alami-pada-void-hunian-tropis",
      "title": "Rekayasa Sirkulasi Alami pada Void Hunian Tropis",
      "description": "Analisis empiris sistem ventilasi silang bertingkat...",
      "category": "Arsitektur & Renovasi",
      "author": "RancangLoka Editorial Desk",
      "focus_keyword": "sirkulasi alami void",
      "status": "draft",
      "content_hash": "0b88aa50b67259013d00757825356877ae3a78061d9151dc446eb0e8d0f419cf",
      "published_at": "2026-09-04T07:43:06.284Z",
      "updated_at": "2026-09-04T07:43:06.284Z",
      "canonical_url": "https://rancangloka.com/rekayasa-sirkulasi-alami-pada-void-hunian-tropis"
    }
  ],
  "page": {
    "count": 1,
    "has_more": false,
    "next_after_id": null
  }
}
```

### Excluded Fields (Data Minimization)
To guarantee lightweight transfer and high edge caching efficiency, the following fields are **strictly excluded**:
- `content_md`
- `content_html`
- `key_takeaways`
- User, session, or internal database metadata

### Error Response Schema
```json
{
  "status": "error",
  "code": "INVALID_STATUS",
  "message": "Nilai status \"trash\" tidak valid. Hanya ['all', 'draft', 'published'] yang didukung."
}
```

---

## 8. Client Usage Example (Node.js / Web Crypto)

```javascript
import crypto from 'node:crypto';

// FAKE CREDENTIALS FOR ILLUSTRATION ONLY
const KEY_ID = 'key_fake_reader_2026_demo';
const SECRET = 'fake_secret_never_commit_real_values_12345';
const BASE_URL = 'https://rancangloka.chandrajoyko.workers.dev';

async function fetchInventory({ status = 'all', limit = 50, after_id = null }) {
  const params = new URLSearchParams();
  if (after_id !== null) params.set('after_id', String(after_id));
  params.set('limit', String(limit));
  params.set('status', status);

  // 1. Build canonical query string (lexicographical order)
  const canonicalQuery = Array.from(params.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([k, v]) => `${k}=${encodeURIComponent(v)}`)
    .join('&');

  const timestamp = Math.floor(Date.now() / 1000);
  const requestId = `req_client_${crypto.randomBytes(12).toString('hex')}`;

  // 2. Build canonical string
  const canonicalString = `v1\nGET\n/api/internal/v1/publication-inventory\n${timestamp}\n${requestId}\n${canonicalQuery}`;

  // 3. Compute HMAC-SHA256 signature
  const signature = crypto
    .createHmac('sha256', SECRET)
    .update(canonicalString)
    .digest('hex');

  // 4. Send HTTP request
  const url = `${BASE_URL}/api/internal/v1/publication-inventory?${params.toString()}`;
  const response = await fetch(url, {
    method: 'GET',
    headers: {
      'x-rl-signature-version': 'v1',
      'x-rl-timestamp': String(timestamp),
      'x-rl-request-id': requestId,
      'x-rl-key-id': KEY_ID,
      'x-rl-signature': `sha256=${signature}`
    }
  });

  return await response.json();
}
```

---

## 9. Deployment & Production Verification Checklist

1. [ ] Configure Cloudflare Workers Secrets for `RANCANGLOKA_INVENTORY_READ_KEY_CURRENT_ID` and `RANCANGLOKA_INVENTORY_READ_KEY_CURRENT`.
2. [ ] Execute `npx wrangler deploy`.
3. [ ] Verify unauthenticated request returns `401`.
4. [ ] Verify authenticated request with `status=all` returns `200` with existing draft rows.
5. [ ] Verify ingest route (`POST /api/internal/v1/hermes-ingest`) behavior remains 100% untouched and functional.
