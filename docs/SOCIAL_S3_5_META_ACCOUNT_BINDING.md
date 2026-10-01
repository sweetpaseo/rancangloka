# 🔐 SOCIAL-S3.5: Meta Credential & Account Binding Readiness
**Operator-Gated Connection / Zero Live Publishing**

> **Status:** COMPLETED & VERIFIED (SHADOW / READ-ONLY)  
> **Authority Level:** ZERO (`publishingAuthority: 0`)  
> **Safety State:** `automation_mode = OFF`, `SOCIAL_AUTOMATION = OFF`, `JEV_MODE = shadow`, `media_worker = DISABLED`  
> **Transport:** `ProductionSocialProviderTransport` BLOCKED (Execution Disabled)

---

## 1. Executive Summary

Milestone **SOCIAL-S3.5** implements the secure account and credential binding architecture necessary to prepare RancangLoka for integration with the Meta ecosystem (Facebook Pages and Instagram Professional accounts) without conferring any external publishing authority.

This implementation provides:
1. **Verification of Dual Meta Auth Modes**: Distinguishing `FACEBOOK_LOGIN` (Facebook User -> Pages -> linked IG) from `INSTAGRAM_LOGIN` (direct Instagram Professional OAuth).
2. **Cryptographic OAuth Preparation**: HMAC SHA-256 state generation with short TTL (10 minutes), nonces, redirect URI allowlists, and strict callback validation.
3. **Provider-Neutral Account Discovery**: Normalization models for Facebook Pages, permissions, and Instagram accounts without persisting raw OAuth tokens.
4. **Deterministic Permission & Connection Health**: Distinct permission requirements per auth mode, detecting `CONNECTED`, `PERMISSION_INCOMPLETE`, `LINK_MISSING`, and `REAUTH_REQUIRED`.
5. **Strict Secret Boundary**: All credentials remain outside D1 database tables, Mission Control snapshots, Pixel Office, chat outputs, and application logs. Only non-secret references (`credential_binding_name`) are stored in D1.
6. **Mission Control Read-Only Telemetry**: Maya answers inquiries regarding connection status truthfully from the read model, strictly rejecting live publish execution.

---

## 2. Meta Authentication Modes & Topologies

### Verified Provider Behaviors

Meta supports two distinct OAuth and Graph API access topologies for Instagram:

| Feature / Dimension | Mode A: `FACEBOOK_LOGIN` | Mode B: `INSTAGRAM_LOGIN` |
| :--- | :--- | :--- |
| **Identity Entity** | Facebook User Account | Instagram Professional (Business/Creator) |
| **Primary Resource** | Managed Facebook Pages (`/me/accounts`) | Direct Instagram Profile (`/me`) |
| **Instagram Discovery** | Linked to FB Page via `connected_instagram_account` | Direct account identity |
| **Facebook Page Required?** | **YES** (Must be an Admin/Editor of the Page) | **NO** (Instagram Professional stands alone) |
| **Core Permission Family** | `pages_show_list`, `pages_read_engagement`, `pages_manage_posts` (+ optional `instagram_basic`, `instagram_content_publish`) | `instagram_business_basic`, `instagram_business_content_publish` |
| **Token Type** | User Token exchanged for Page Access Token | Instagram User Access Token |
| **API Base Endpoint** | `https://graph.facebook.com/v21.0` | `https://graph.instagram.com/v21.0` |

### Selected Topology for RancangLoka

RancangLoka's architectural goal is to publish architectural editorial content to **both a Facebook Page and an Instagram Business account**.

1. **Primary Supported Strategy: `FACEBOOK_LOGIN` with Linked Instagram**
   - **Rationale**: An established Facebook Page managing an Instagram Professional account allows a single OAuth handshake to discover and manage both distribution endpoints.
   - **Requirement**: The operator must explicitly link their Instagram Professional account to the target Facebook Page in Meta Business Suite.
   - **Honest Missing Linkage Handling**: If a Page has no linked Instagram account, the system records `selectedInstagramAccount: null` and evaluates Instagram status as `LINK_MISSING`. It **never** fabricates or guesses an account.

2. **Alternative Supported Strategy: `INSTAGRAM_LOGIN` (Direct Instagram)**
   - **Rationale**: For setups where Instagram operates independently or Facebook Page integration is disconnected/unwanted.
   - **Decoupling**: The Social domain models `INSTAGRAM_LOGIN` without requiring any dummy Facebook Page.

Both auth modes produce the same normalized `MetaConnectionRecord` structure, keeping downstream campaign, variant, and QA business logic completely decoupled from OAuth mechanisms.

---

## 3. OAuth State Security & Tamper Resistance

To protect the operator-gated OAuth flow against CSRF and replay attacks:

1. **HMAC SHA-256 State Signatures**:
   - Payload: `{ stateId, nonce, timestamp, authMode, redirectUri }`
   - Generated with a platform secret (`META_STATE_SECRET` or fallback HMAC seed).
   - Tampered payloads or modified URLs immediately fail signature verification.
2. **Short TTL (10 Minutes)**:
   - Expired states are rejected with `OAUTH_STATE_EXPIRED`.
3. **Redirect URI Allowlist Validation**:
   - Only predefined canonical callback paths (`https://rancangloka.com/api/internal/v1/social/meta/callback`, `http://localhost:4321/...`) are permitted.
   - External redirects fail with `REDIRECT_URI_MISMATCH`.
4. **Zero Token in State or URLs**:
   - No sensitive data or credentials are embedded in the state string.

---

## 4. Secret Boundary & D1 Storage Policy

A core architectural invariant of RancangLoka is **Zero Secret Persistence** in application databases:

```
[ Operator Browser ]
        │ (OAuth Handshake)
        ▼
[ Cloudflare Worker Edge ]
   ├── Secret Material: Cloudflare Worker Secret Binding (e.g. env.META_PAGE_ACCESS_TOKEN)
   │     └── Exists ONLY in Worker memory / Cloudflare encrypted environment
   │
   └── Non-Secret Metadata: Stored in D1 `settings` table (key: `social_meta_connection_json`)
         ├── connectionId
         ├── authMode ('FACEBOOK_LOGIN' | 'INSTAGRAM_LOGIN')
         ├── credentialBindingName ('META_PAGE_ACCESS_TOKEN')  <-- REFERENCE ONLY
         ├── selectedFacebookPage { pageId, name }
         ├── selectedInstagramAccount { instagramId, username }
         ├── grantedPermissions [...]
         ├── missingPermissions [...]
         └── publishingAuthority = 0
```

### Programmatic Security Guardrail
In `src/lib/social/providers/meta/connection-service.ts`, the `saveMetaConnection()` function performs strict runtime key inspection:
- If `accessToken`, `access_token`, `clientSecret`, `client_secret`, `appSecret`, `app_secret`, `refreshToken`, or `rawAuthorizationCode` are detected anywhere in the payload:
- **An immediate `CRITICAL_SECURITY_VIOLATION` error is thrown** and the transaction is aborted.

---

## 5. Account Discovery & Target Selection

### Facebook Page Discovery (`normalizeFacebookPagesDiscovery`)
- Processes `/me/accounts` response.
- Extracts `pageId`, `name`, `category`, and verifies tasks (`CREATE_CONTENT` / `MANAGE`).
- Extracts linked Instagram account ID (`connected_instagram_account.id`) if present.
- Discovered accounts are presented to the operator; **no automatic selection of the first account is made**.

### Direct Instagram Discovery (`normalizeInstagramLoginDiscovery`)
- Processes `/me` response with `fields=id,username,name,account_type`.
- Validates account type is `BUSINESS` or `MEDIA_CREATOR`.
- Does not demand Facebook Page linkage.

---

## 6. Connection & Permission Health Evaluation

The connection health evaluation (`evaluateConnectionHealth`) deterministically evaluates:

| Condition | `overallStatus` | `facebookPageStatus` | `instagramStatus` | `permissionsStatus` |
| :--- | :--- | :--- | :--- | :--- |
| **No connection record** | `NOT_CONNECTED` | `NOT_CONFIGURED` | `NOT_CONFIGURED` | `MISSING` |
| **Facebook Login + Page + linked IG + all perms** | `CONNECTED` | `CONNECTED` | `CONNECTED` | `OK` |
| **Facebook Login + Page selected, NO linked IG** | `CONNECTED` | `CONNECTED` | `LINK_MISSING` | `OK` |
| **Missing required permissions** | `PERMISSION_INCOMPLETE` | `CONNECTED` | `CONNECTED` | `MISSING` |
| **Token invalid / revoked / expired** | `REAUTH_REQUIRED` | `REAUTH_REQUIRED` | `REAUTH_REQUIRED` | `UNKNOWN` |

**Invariant:** In all states, `publishingAuthority` remains `0` and `socialAutomationMode` remains `OFF`.

---

## 7. Mission Control & Maya Integration

- **Capability**: Registered `SOCIAL_CONNECTION_QUERY` in `capability-registry.ts` under `SOCIAL_DISTRIBUTION` department.
- **Direct Staff Chat**: Maya (`social_distribution_operator`) answers operator queries such as *"Apakah Instagram sudah terhubung?"*, *"Facebook Page mana yang dipilih?"*, or *"Apakah publishing sudah aktif?"* accurately using the read model snapshot.
- **Zero Fabrication**: Maya truthfully reports `Otoritas Penerbitan: 0 (TIDAK AKTIF)` and `Otomasi Sosial: OFF`.
- **Zero Work Faking**: Maya remains `IDLE` in the Lounge when no active health check or editorial campaign drafting task is being executed.
- **Anomalies**: Detects `SOCIAL_AUTH_REAUTH_REQUIRED` and `SOCIAL_PERMISSION_INCOMPLETE` as manageable department anomalies.

---

## 8. Admin Connection Surface

Implemented in `/admin/settings` (Section 6: *Distribusi Sosial & Koneksi Meta*):
- Displays current connection status (`CONNECTED`, `NOT_CONNECTED`, `PERMISSION_INCOMPLETE`).
- Shows configured targets: Facebook Page Name and Instagram `@username`.
- Outlines granted vs missing permissions.
- Emphasizes the **Safety Invariant**: *Publikasi otomatis dinonaktifkan (`publishingAuthority: 0`). Koneksi akun hanya untuk kesiapan pembacaan data.*
- Provides operator-gated action buttons: `[ Hubungkan Akun Meta ]`, `[ Verifikasi Ulang Izin ]`, and `[ Putuskan Sambungan ]` (disabled with clear tooltip).

---

## 9. Verification & Test Evidence

### Test Suites Executed

1. `scripts/test-social-meta-binding.js` (11/11 tests pass):
   - Facebook Login discovery (Pages, permissions, linked IG).
   - Direct Instagram Login discovery without Page linkage.
   - Distinct permission family enforcement.
   - HMAC SHA-256 OAuth state generation & validation.
   - Tampered/expired state fail-closed validation.
   - Connection health evaluation (`CONNECTED`, `PERMISSION_INCOMPLETE`, `LINK_MISSING`).
   - Secret boundary enforcement throwing `CRITICAL_SECURITY_VIOLATION`.
   - Disconnect unbinding without mutating campaigns.
   - Maya read-only query truthful reporting without token leakage.
   - Chat interaction safety invariants.
   - Production transport blocking execution.
2. `scripts/test-social-meta-adapter.js` (23/23 tests pass).
3. `scripts/test-social-mission-control.js` (15/15 tests pass).
4. `scripts/test-social-domain.js` (22/22 tests pass).
5. Mission Control Regression Suites (MC-1 through MC-9 + SOAK-0 54 tests pass).
6. TypeScript Typecheck: `npx tsc --noEmit` (0 errors).
7. Production Build: `npm run build` (Clean completion in 5.62s).

---

## 10. Operator Action Required Boundary

> [!IMPORTANT]
> **OPERATOR ACTION REQUIRED — CONNECT META ACCOUNT**
>
> In accordance with safety invariants, Antigravity has prepared all account discovery and binding readiness architecture, but has **NOT** initiated any live OAuth handshake or connected any real Meta credentials.
>
> When the human operator decides to bind a real Meta account in a future authorized session:
>
> 1. **URL / Interface to Use**:
>    - Access `/admin/settings#social-meta-connection` in the RancangLoka Admin panel.
>    - Click **"Hubungkan Akun Meta"**.
> 2. **Account Requirements**:
>    - A Meta account with **Administrator / Editor** role on the official RancangLoka Facebook Page.
>    - The Facebook Page must be linked to an **Instagram Professional (Business or Creator)** account via Meta Business Suite.
> 3. **Expected Permission Consent Screen**:
>    - `pages_show_list` (Melihat daftar Page yang Anda kelola).
>    - `pages_read_engagement` (Membaca keterlibatan Page).
>    - `pages_manage_posts` (Mengelola postingan Page).
>    - `instagram_basic` & `instagram_content_publish` (Akses ke akun Instagram Business).
> 4. **Information Stored in D1**:
>    - Selected Page ID and Name.
>    - Selected Instagram Account ID and Username.
>    - Granted permission list and verification timestamp.
> 5. **Information STRICTLY NOT Stored in D1**:
>    - Access tokens (`access_token`, `page_access_token`).
>    - App Secret (`client_secret`).
>    - Raw OAuth exchange payloads.
>    *(Tokens will reside exclusively in Cloudflare Worker encrypted secret environment bindings).*
> 6. **Post-Callback Verification**:
>    - Health verification evaluates target selection and permission presence.
>    - **Publishing authority remains 0**. No automatic publishing will occur.
