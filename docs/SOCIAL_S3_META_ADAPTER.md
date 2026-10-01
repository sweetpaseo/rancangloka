# 🌐 SOCIAL-S3: Meta Graph API Platform Adapter — Architectural & Operational Specification

> **Milestone:** SOCIAL-S3  
> **Status:** COMPLETE / DISABLED EXECUTION / MOCK TRANSPORT FIRST  
> **Target Platforms:** Meta Facebook Page (`facebook_page`) & Instagram Business (`instagram_business`)  
> **Safety Invariants:** `automation_mode = OFF`, `SOCIAL_AUTOMATION = OFF`, `JEV_MODE = shadow`, `Meta execution authority = 0`

---

## 1. Executive Summary & Objective

Milestone **SOCIAL-S3** establishes the first canonical external platform adapter boundary for **Meta Graph API** covering:
1. **Facebook Page** (`facebook_page`)
2. **Instagram Business** (`instagram_business`)

In strict accordance with system safety invariants, **SOCIAL-S3 IS NOT A GO-LIVE MILESTONE**. The adapter interface was developed and proven completely under **disabled execution** and **mock transport**, guaranteeing:
- **Zero real external network calls** to Meta Graph API.
- **Zero production credentials / access tokens stored or accepted**.
- **Zero real Facebook or Instagram publishing**.
- **Zero fake successful external receipts inserted into D1**.
- **Deterministic error classification and secret sanitization**.

*"We build the engine interface before connecting the fuel line."*

---

## 2. Provider-Neutral Architecture & Separation of Concerns

The adapter architecture strictly isolates domain rules from provider idiosyncrasies through four discrete layers:

```
┌────────────────────────────────────────────────────────┐
│                   SOCIAL DOMAIN LAYER                  │
│  (Campaigns, Post Variants, Approvals, Staging Outbox) │
└───────────────────────────┬────────────────────────────┘
                            │ depends on
                            ▼
┌────────────────────────────────────────────────────────┐
│               PROVIDER-NEUTRAL INTERFACE               │
│  (SocialPlatformAdapter, Registry, Normalized Results) │
└───────────────────────────┬────────────────────────────┘
                            │ implements
                            ▼
┌────────────────────────────────────────────────────────┐
│                  META PROVIDER ADAPTER                 │
│  (Facebook Page, Instagram Business, Builders, Errors) │
└───────────────────────────┬────────────────────────────┘
                            │ injectable
                            ▼
┌────────────────────────────────────────────────────────┐
│                  TRANSPORT ABSTRACTION                 │
│   (MockSocialProviderTransport / Inert Production)     │
└────────────────────────────────────────────────────────┘
```

### Neutral Adapter Interface (`src/lib/social/providers/types.ts`)

```typescript
export interface SocialPlatformAdapter {
  readonly providerId: SocialProviderId;
  readonly platformId: SocialPlatformId;

  capabilities(): SocialPlatformCapabilityMatrix;
  validateConfiguration(config: any): SocialValidationResult;
  validateVariant(
    variant: SocialPostVariantRecord,
    payload: { caption: string; mediaUrls?: string[]; canonicalUrl?: string }
  ): SocialValidationResult;
  buildPublishRequest(input: SocialPublishRequestInput): SocialBuiltRequest;
  executePublish(
    request: SocialBuiltRequest,
    transport: SocialProviderTransport,
    options?: { executionMode?: SocialProviderExecutionMode }
  ): Promise<SocialNormalizedPublishResult>;
  normalizeReceipt(response: SocialTransportResponse, request?: SocialBuiltRequest): SocialNormalizedPublishResult;
  classifyError(response: SocialTransportResponse | Error): SocialNormalizedError;
}
```

---

## 3. Platform Capabilities & Deterministic Fail-Closed Matrix

Capabilities are defined explicitly in [capabilities.ts](file:///c:/Users/Fanto/Desktop/antigravity/rancangloka/rancangloka-astro/src/lib/social/providers/meta/capabilities.ts). Any `UNVERIFIED` or `UNSUPPORTED` format fails closed during validation before request construction or transport dispatch.

| Platform | Format / Variant | Status | Technical Publishing Workflow |
| :--- | :--- | :--- | :--- |
| **Facebook Page** | `FEED_POST` | `SUPPORTED` | `POST /{page-id}/photos` (if media present) or `POST /{page-id}/feed` (text/link) |
| **Facebook Page** | `CAROUSEL` | `UNVERIFIED` | Facebook multi-photo requires `attached_media` list; fails closed for safety |
| **Facebook Page** | `REEL_SHORT` | `UNVERIFIED` | Video chunk upload requires video container session; fails closed |
| **Facebook Page** | `THREAD` | `UNSUPPORTED` | Platform mismatch |
| **Instagram Business** | `FEED_POST` | `SUPPORTED` | 2-stage: `POST /{ig-user-id}/media` -> `POST /{ig-user-id}/media_publish` |
| **Instagram Business** | `CAROUSEL` | `SUPPORTED` | Multi-stage: item containers (`is_carousel_item=true`) -> container (`media_type=CAROUSEL`) -> publish |
| **Instagram Business** | `REEL_SHORT` | `UNVERIFIED` | Requires video container flow; fails closed |
| **Instagram Business** | `THREAD` | `UNSUPPORTED` | Platform mismatch |

### Constraints Enforced:
- **Aspect Ratios:** Facebook (`1:1`, `4:5`, `16:9`), Instagram (`1:1`, `4:5`, `16:9` within Meta's 4:5 to 1.91:1 requirement).
- **Caption Length:** Facebook (max 63,206 chars), Instagram (max 2,200 chars).
- **Media Requirement:** Facebook allows text/link only posts; Instagram strictly requires at least 1 image.
- **Carousel Bounds:** Instagram Carousel requires 2 to 10 items.

---

## 4. Multi-Stage Instagram Business Publishing Workflow

Unlike Facebook where photo/feed can publish in a single call, Instagram Business uses a containerized multi-stage publishing architecture:

### Single Image Post Flow:
1. **Stage 1 (`instagram_media_container`):**  
   `POST https://graph.facebook.com/{version}/{ig_user_id}/media`  
   Body: `{ image_url, caption }`  
   Returns: `{ id: "<container_creation_id>" }`
2. **Stage 2 (`instagram_media_publish`):**  
   `POST https://graph.facebook.com/{version}/{ig_user_id}/media_publish`  
   Body: `{ creation_id: "<container_creation_id>" }`  
   Returns: `{ id: "<published_media_id>" }`

### Carousel Post Flow:
1. **Stages 1..N (`instagram_carousel_item_i`):**  
   `POST /{ig_user_id}/media` with `{ image_url, is_carousel_item: true }`
2. **Stage N+1 (`instagram_carousel_container`):**  
   `POST /{ig_user_id}/media` with `{ media_type: "CAROUSEL", caption, children: [item1_id, item2_id, ...] }`
3. **Stage N+2 (`instagram_media_publish`):**  
   `POST /{ig_user_id}/media_publish` with `{ creation_id: "<carousel_container_id>" }`

The adapter dynamically chains output IDs from Stage 1 into subsequent stages while recording exact execution progress.

---

## 5. Transport Abstraction & Disabled Execution Gate

Adapter logic is completely decoupled from `globalThis.fetch`:
- **`MockSocialProviderTransport`:** Records all outbound requests into `recordedRequests` and returns deterministic fixtures.
- **`ProductionSocialProviderTransport`:** Strict inert implementation that throws `PRODUCTION_TRANSPORT_BLOCKED` when instantiated or invoked without authorized flags.
- **Execution Gate:** When `adapter.executePublish()` is called while `executionMode === 'DISABLED'` (the canonical baseline), it returns `{ success: false, error: { errorClass: 'EXECUTION_DISABLED', message: 'PROVIDER_EXECUTION_DISABLED' } }` immediately without touching transport.

---

## 6. Secret Sanitization & Credential Boundary

### Zero Secret Exposure Rules:
1. **Config Validation:** `validateConfiguration()` immediately rejects any object containing keys such as `accessToken`, `access_token`, `appSecret`, or `app_secret`.
2. **Configuration Model:** `MetaProviderConfig` stores only non-secret references:
   - `provider`: `'meta'`
   - `graphApiVersion`: configurable (defaults to `'v21.0'`, never hardcoded)
   - `facebookPageId`: numeric Page ID reference
   - `instagramAccountId`: numeric Instagram Business ID reference
   - `credentialBindingName`: environment variable / Cloudflare secret binding name (e.g. `'META_PAGE_ACCESS_TOKEN'`)
3. **Payload Sanitization (`sanitizeMetaPayload`):** Automatically redacts any fields matching `*token*`, `*secret*`, `*authorization*`, or `*cookie*` from raw diagnostic outputs.
4. **Database Policy:** Zero D1 migrations. Tokens are never stored in SQLite/D1.

---

## 7. Deterministic Error Classification

Meta error payloads are parsed deterministically into canonical `SocialNormalizedError` objects:

| Meta Error Code | Meta Error Subcode / Condition | Normalized Error Class | Retryable | Suggested Action |
| :---: | :---: | :---: | :---: | :--- |
| `190`, `102` | Any | `AUTHENTICATION` | No | Refresh Page / User access token |
| `10`, `200..299`| Missing permissions | `AUTHORIZATION` | No | Grant `pages_manage_posts`, `instagram_content_publish` |
| `4`, `17`, `32`, `613` | Rate limits | `RATE_LIMIT` | Yes | Back off and wait for rate limit window to reset |
| `36003`, `36004` | Aspect ratio / invalid image | `MEDIA_INVALID` | No | Verify image aspect ratio, resolution (<8MB, JPEG/PNG) |
| `368` | Policy / spam | `CONTENT_REJECTED` | No | Inspect flagged content |
| `506` | Duplicate post | `DUPLICATE` | No | Content was already published recently |
| `1`, `2` | Meta internal server error | `PROVIDER_UNAVAILABLE` | Yes | Retry with exponential backoff |
| Caught Network Err | `ECONNRESET`, `ETIMEDOUT` | `TRANSIENT_NETWORK` | Yes | Retry with backoff |
| Unknown / vendor | Any other | `UNKNOWN_PROVIDER_ERROR` | No | Inspect raw details (unfabricated) |

---

## 8. Mission Control & Staff Chat Integration

Maya (`social_distribution_operator`) supports read-only diagnostic queries:
- **`SOCIAL_ADAPTER_QUERY`:** Returns truthful status of Meta adapters (Meta Provider: Available under Disabled Execution / Mock Transport; Platforms: Facebook Page & Instagram Business; Execution: Disabled).
- **Prohibited Mutators Blocked:** Any attempts to run `publish`, `kirim sekarang`, or inject `access token` via chat are rejected with `DANGEROUS_ACTION_FORBIDDEN` and never queue a command.
- **Pixel Office Truthfulness:** Maya remains in `IDLE_STANDBY` in the Lounge while adapter execution is disabled. No synthetic posting animations are triggered.

---

## 9. Verification & Test Evidence

Full test suite in [test-social-meta-adapter.js](file:///c:/Users/Fanto/Desktop/antigravity/rancangloka/rancangloka-astro/scripts/test-social-meta-adapter.js):
- **23/23 tests passed** covering registry, platform identity, capability matrices, validation failures, request builders, multi-stage flows, disabled execution gates, mock successes, error classifications, secret sanitization, and staff chat safety.
- **Regression Suites Passed (100%):**
  - `test-social-domain.js` (22/22 tests passed)
  - `test-social-mission-control.js` (15/15 tests passed)
  - `test-mission-control.js` (10/10 tests passed)
  - `test-staff-registry.js` (16/16 tests passed)
  - `test-mission-control-departments.js` (18/18 tests passed)
  - `test-mission-control-chat.js` (20/20 tests passed)
  - `test-mission-control-anomalies.js` (20/20 tests passed)
  - `test-mission-control-pixel-office.js` (20/20 tests passed)
  - `test-mission-control-expansion.js` (12/12 tests passed)
  - `test-mission-control-job-animation.js` (21/21 tests passed)
  - `test-soak-safety.js` (54/54 tests passed)
  - `npx tsc --noEmit` & `npm run build`: 0 type errors, production bundle successfully compiled.

---

## 10. Next Milestone Recommendation

**Milestone: SOCIAL-S3.5 — Meta Credential & Account Binding Readiness / Operator-Gated Connection**
- Define secret binding injection via Cloudflare Workers / Wrangler secrets.
- Implement non-interactive credential validation probe with strict operator confirmation gate.
- Continue to keep `SOCIAL_AUTOMATION = OFF` until end-to-end sandbox testing is authorized.
