# 🌐 SOCIAL-S3.6: Meta Live Connection Readiness & Operator Boundary

> **Status:** CONNECTION READINESS ONLY (PREPARED & MOCK VERIFIED)  
> **Authority Level:** ZERO (`publishingAuthority: 0`)  
> **Safety State:** `automation_mode = OFF`, `SOCIAL_AUTOMATION = OFF`, `JEV_MODE = shadow`, `media_worker = DISABLED`  
> **Meta Publishing Authority:** 0 (Strictly Disabled)  
> **Production Transports:** BLOCKED (`ProductionSocialProviderTransport` & `ProductionMetaOAuthTransport`)  
> **Live Credentials:** ZERO Real Credentials / Production D1 Untouched

---

## 1. Executive Summary

Milestone **SOCIAL-S3.6** implements the complete technical connection readiness architecture for integrating RancangLoka with the Meta ecosystem (Facebook Pages and Instagram Professional accounts).

Because the human operator **has not yet created** the official RancangLoka Facebook Page or Instagram accounts, this milestone enforces a strict boundary:
- **Connection readiness is 100% prepared and tested using mock abstractions.**
- **Zero real Meta API calls were made.**
- **Zero live credentials or secrets were requested or stored.**
- **The system stops at the exact boundary where real external Facebook and Instagram accounts are required from the operator.**

---

## 2. Status Classification Matrix

| Layer / Component | Status | Details |
| :--- | :--- | :--- |
| **OAuth Connect Route (`/admin/social/meta/connect`)** | **IMPLEMENTED** | Admin auth protected; readiness gated; HMAC SHA-256 single-use state generation |
| **OAuth Callback Route (`/admin/social/meta/callback`)** | **IMPLEMENTED** | Admin auth protected; state validation; replay attack prevention; error normalization |
| **Meta OAuth Client & Transport Boundary** | **IMPLEMENTED** | Separates transport from OAuth business logic; `MockMetaOAuthTransport` for testing |
| **Read-Only Probe Model & Safety Enforcement** | **IMPLEMENTED** | Strict allowlist for GET discovery (`/me`, `/me/accounts`, etc.); publishing endpoints (`/feed`, `/photos`, `/media`, `/media_publish`) strictly blocked |
| **Explicit Account Selection Engine** | **IMPLEMENTED** | Strictly prevents auto-selecting the first Page when multiple Pages are discovered; enforces operator confirmation |
| **Vault Encryption Pipeline** | **IMPLEMENTED** | AES-256-GCM encryption with independent nonces and token purpose AAD; zero plaintext in D1 settings |
| **Admin Settings Section (`/admin/settings#social-meta-connection`)** | **IMPLEMENTED** | Shows honest status, readiness indicators, checklist, and gated connect button |
| **Mission Control & Maya Chat** | **IMPLEMENTED** | Maya truthfully answers "Belum terhubung" and provides deterministic 6-step checklist; Maya IDLE in Lounge |
| **Mock Token Exchange & Callback Flow** | **MOCK VERIFIED** | 100% verified via automated test suite `scripts/test-social-meta-live-readiness.js` |
| **Production Meta App Configuration** | **REQUIRES META APP** | `META_APP_ID` & `META_APP_SECRET` needed in production environment |
| **Cloudflare Secret KEK** | **REQUIRES KEK** | `META_CREDENTIAL_KEK_V1` needed in Cloudflare Worker Secrets |
| **Real Facebook Page** | **REQUIRES FB PAGE** | Operator must create official RancangLoka Facebook Page |
| **Real Instagram Professional Account** | **REQUIRES IG PRO** | Operator must create official RancangLoka Instagram Professional account |
| **Meta Business Suite Page-IG Linkage** | **REQUIRES LINKAGE** | Operator must link Instagram account to Facebook Page |
| **Interactive OAuth Grant** | **REQUIRES OPERATOR** | Operator clicks "Hubungkan Akun Meta" and completes Meta consent screen |
| **Live Publishing Execution** | **NOT YET LIVE** | Publishing authority remains 0; live publishing blocked |

---

## 3. Architecture & Security Invariants

### A. Dual Auth Mode Topology
1. **Primary Topology (`FACEBOOK_LOGIN`):**
   - Operator logs into Facebook -> System queries `/me/accounts` to discover managed Pages -> Discovers linked Instagram Professional account via `instagram_business_account`.
   - Single OAuth handshake establishes management for both Facebook and Instagram distribution channels.
2. **Alternative Topology (`INSTAGRAM_LOGIN`):**
   - Direct Instagram Professional login (`/me`) for independent Instagram setups.
   - Preserved and fully supported without requiring dummy Facebook Pages.

### B. Read-Only Probe Model & Allowlist
The probe architecture allows only non-mutating discovery endpoints:
- `GET /v21.0/me`
- `GET /v21.0/me/accounts`
- `GET /v21.0/me/permissions`
- `GET /v21.0/{page-id}`
- `GET /v21.0/{page-id}/picture`
- `GET /v21.0/{ig-user-id}`
- `GET /v21.0/debug_token`

Any attempt to call publishing or mutating endpoints (`POST /feed`, `POST /photos`, `POST /media`, `POST /media_publish`) throws `CRITICAL_SECURITY_VIOLATION` fail-closed.

### C. Explicit Multi-Page Selection
If the operator's Facebook account manages multiple Facebook Pages:
- The system **never auto-selects** the first page.
- Evaluates to `requiresOperatorSelection: true`.
- Requires the operator to specify the exact `page_id` and confirm the target binding.

### D. Single-Use OAuth State & Replay Protection
- OAuth state payloads are signed with HMAC SHA-256 and include random nonces and 10-minute TTL.
- Atomic state consumption (`consumeOAuthState`) tracks consumed state IDs in memory, strictly rejecting replay attempts.

### E. Secret Boundary & D1 Storage Policy
- **No secrets in D1 settings:** `settings.social_meta_connection_json` contains only non-secret metadata (`connectionId`, `selectedFacebookPage`, `selectedInstagramAccount`, `publishingAuthority: 0`).
- **Tokens encrypted into Vault:** Stored solely in `social_provider_credentials` via AES-256-GCM using `META_CREDENTIAL_KEK_V1`.
- **App Secret never stored:** `META_APP_SECRET` is only read from runtime environment variables; never persisted to database or rendered in HTML.

---

## 4. Operator Action Required Checklist

To enable live Meta connectivity in a future session, the operator must complete the following external steps:

### Step 1: Create RancangLoka Facebook Page
- URL: `https://www.facebook.com/pages/create`
- Page Name: `RancangLoka`
- Category: `Media / Berita` atau `Arsitektur & Desain`
- Hak Akses: Pastikan operator memiliki peran Admin/Manager penuh pada Page tersebut.

### Step 2: Create RancangLoka Instagram Professional Account
- Username: `@rancangloka` (atau varian resmi yang tersedia)
- Account Type: **Professional** (Business atau Creator, bukan Personal)
- Kategori: Media / Arsitektur

### Step 3: Link Instagram to Facebook Page
- Buka **Meta Business Suite** atau Pengaturan Facebook Page.
- Masuk ke menu **Akun Tertaut (Linked Accounts)** -> **Instagram**.
- Hubungkan akun Instagram RancangLoka ke Facebook Page RancangLoka.
- Pastikan opsi sinkronisasi dan izin akses diaktifkan.

### Step 4: Configure Meta Developer App
- Buka **Meta for Developers** (`https://developers.facebook.com`).
- Buat atau buka App bertipe **Business**.
- Tambahkan produk **Facebook Login for Business**.
- Daftarkan Redirect URI: `https://rancangloka.com/admin/social/meta/callback`.
- Catat `META_APP_ID` dan `META_APP_SECRET`.

### Step 5: Provision Cloudflare Worker Secrets
Setel rahasia berikut pada Cloudflare Worker:
```bash
npx wrangler secret put META_APP_ID
npx wrangler secret put META_APP_SECRET
npx wrangler secret put META_CREDENTIAL_KEK_V1
```

### Step 6: Execute Operator-Gated OAuth Handshake
1. Masuk ke CMS Admin: `https://rancangloka.com/admin/settings#social-meta-connection`.
2. Pastikan badge status menampilkan `READY TO CONNECT`.
3. Klik tombol **Hubungkan Akun Meta**.
4. Selesaikan dialog persetujuan izin Meta di browser.
5. Sistem akan menyimpan token terenkripsi ke Vault dan mencatat binding akun secara aman.

---

## 5. Verification & Testing Evidence

All tests pass 100% without network calls:
- `scripts/test-social-meta-live-readiness.js`: 17/17 tests passing.
- `scripts/test-social-credential-vault.js`: 12/12 tests passing.
- `scripts/test-social-meta-binding.js`: 11/11 tests passing.
- `scripts/test-social-meta-adapter.js`: 23/23 tests passing.
- `scripts/test-social-mission-control.js`: 15/15 tests passing.
- `scripts/test-social-domain.js`: 22/22 tests passing.
- Full Mission Control regression suite: 100% clean passes.
