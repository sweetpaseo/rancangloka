# 🛡️ SOCIAL-S3.5A: Secure OAuth Credential Vault & Token Persistence Hardening

> **Status:** COMPLETED & VERIFIED (SHADOW / READ-ONLY)  
> **Authority Level:** ZERO (`publishingAuthority: 0`)  
> **Encryption Engine:** AES-256-GCM (Authenticated Encryption with Associated Data - AEAD)  
> **Master Key Storage:** Cloudflare Secrets / Secrets Store (`META_CREDENTIAL_KEK_V1`)  
> **Safety State:** `automation_mode = OFF`, `SOCIAL_AUTOMATION = OFF`, `JEV_MODE = shadow`, `media_worker = DISABLED`  
> **Transport:** `ProductionSocialProviderTransport` BLOCKED (Execution Disabled)

---

## 1. Executive Summary & Problem Statement

In **SOCIAL-S3.5**, Meta credential binding was modeled using a static reference:
```
credential_binding_name -> env.META_PAGE_ACCESS_TOKEN
```
While suitable for manually provisioned, static credentials, this model is **architecturally insufficient for production OAuth workflows**:
1. **Dynamic Token Lifecycle:** Real OAuth handshakes produce tokens dynamically that are issued after callback, have finite lifetimes, rotate periodically, and require replacement upon re-authentication.
2. **Cloudflare Runtime Immutability:** Cloudflare Worker environment variables and Secrets Store bindings (`env`) are strictly **read-only at runtime**. A Worker cannot write or update its own environment bindings dynamically without calling the Cloudflare Management API (`PUT /accounts/{id}/workers/scripts/.../secrets`).
3. **Privilege Boundary Invariant:** Providing the public/admin web application with a broad Cloudflare Account Management API token would introduce a severe privilege escalation risk. If an application compromise occurred, an attacker could alter Worker scripts, read other account secrets, or manipulate DNS/zone configurations.

**Milestone SOCIAL-S3.5A solves this gap** by creating an application-level, authenticated **Credential Vault**:
- Dynamic tokens are encrypted server-side using **AES-256-GCM** before being written to D1.
- Ciphertext is bound cryptographically to identity context using **Authenticated Additional Data (AAD)**.
- The 256-bit Key Encryption Key (KEK) resides exclusively in Cloudflare Secrets (`META_CREDENTIAL_KEK_V1`).
- Plaintext tokens are decrypted **just-in-time** inside authorized provider boundaries and immediately discarded.
- Neither D1 nor Mission Control nor Maya nor application logs ever hold or expose plaintext credentials.

---

## 2. Cloudflare Platform Capabilities & Findings

| Mechanism | Runtime Mutation Capability | Privilege Requirement | Assessment for Dynamic OAuth |
| :--- | :--- | :--- | :--- |
| **Worker Secret (`env.KEY`)** | ❌ Read-Only in isolate | Cloudflare Management API Token (`Worker Scripts:Edit`) | **Rejected for dynamic writes.** Requires embedding dangerous management credentials in the app. Safe ONLY for static KEK. |
| **Secrets Store Binding** | ❌ Read-Only via binding | Cloudflare Management API Token (`Secrets Store:Edit`) | **Rejected for dynamic writes.** Same privilege escalation risk. |
| **Encrypted D1 Vault (AES-256-GCM + External KEK)** | ✅ Fully read/write via standard D1 queries | Standard D1 Worker binding (zero Cloudflare account tokens) | **ADOPTED AS CANONICAL ARCHITECTURE.** Complies with least-privilege principles and zero-secret database storage. |

---

## 3. Dedicated Credential Vault Schema (D1)

Migration: [`db/migrations/0027_social_credential_vault.sql`](file:///c:/Users/Fanto/Desktop/antigravity/rancangloka/rancangloka-astro/db/migrations/0027_social_credential_vault.sql)

```sql
CREATE TABLE IF NOT EXISTS social_provider_credentials (
    credential_id TEXT PRIMARY KEY,
    connection_id TEXT NOT NULL,
    provider TEXT NOT NULL,
    auth_mode TEXT NOT NULL,
    encrypted_access_token TEXT NOT NULL,
    encrypted_refresh_token TEXT,
    encryption_nonce TEXT NOT NULL,
    encryption_key_version TEXT NOT NULL,
    token_type TEXT NOT NULL DEFAULT 'BEARER',
    expires_at TEXT,
    scope_snapshot TEXT,
    provider_user_id TEXT,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    revoked_at TEXT
);

CREATE INDEX IF NOT EXISTS idx_social_provider_credentials_conn 
ON social_provider_credentials (connection_id, provider, revoked_at);

CREATE INDEX IF NOT EXISTS idx_social_provider_credentials_prov_user 
ON social_provider_credentials (provider, provider_user_id);
```

### Critical Database Invariants
- **ZERO PLAINTEXT COLUMNS:** There is no `access_token`, `refresh_token`, or `token` column.
- `encrypted_*` columns store authenticated base64 ciphertext and 16-byte MAC authentication tags.
- Nonces (`encryption_nonce`) are unique 96-bit random vectors per encryption.
- Separate table from generic `settings`, ensuring strict access scoping and auditability.

---

## 4. Cryptographic Model & Authenticated Additional Data (AAD)

Implemented in [`src/lib/social/vault/crypto.ts`](file:///c:/Users/Fanto/Desktop/antigravity/rancangloka/rancangloka-astro/src/lib/social/vault/crypto.ts):

- **Algorithm:** AES-256-GCM (`AES-GCM` with 256-bit key length and 128-bit authentication tag).
- **Web Crypto Standard:** Uses native `globalThis.crypto.subtle` available in Cloudflare Workers and Node.js.
- **Nonce Generation:** 12 random bytes via `crypto.getRandomValues(new Uint8Array(12))`.
- **Deterministic AAD Binding:**
  ```typescript
  const contextString = `${credentialId}:${connectionId}:${provider}:${authMode}:${keyVersion}`;
  const aad = new TextEncoder().encode(contextString);
  ```
- **Replay / Substitution Immunity:** If an attacker copies ciphertext from `connection_id = 'A'` into `connection_id = 'B'`, or modifies the `auth_mode` or `credential_id`, AES-GCM MAC validation fails immediately with `VAULT_DECRYPTION_FAILED`.

---

## 5. Threat Model Analysis & Automated Verification

### Scenario 1: Attacker Obtains Full D1 Database Dump
- **Question:** Can the attacker recover valid Meta tokens from the database alone?
- **Finding / Result:** **NO.**
- **Proof:** D1 contains only ciphertext, nonces, and the key version string (`META_CREDENTIAL_KEK_V1`). The 32-byte raw key material exists exclusively in Cloudflare encrypted secret storage. Decryption attempts without the KEK throw `VAULT_KEK_UNAVAILABLE`.

### Scenario 2: Ciphertext Cross-Connection Injection
- **Question:** Can an attacker replay or swap tokens across accounts?
- **Finding / Result:** **NO.**
- **Proof:** Cryptographic AAD verification binds the ciphertext to the exact `credential_id`, `connection_id`, `provider`, `auth_mode`, and `key_version`. Tampering with any field causes AES-GCM tag mismatch.

### Scenario 3: Memory & Leak Redaction
- **Finding / Result:** Plaintext tokens are passed only to the provider transport during execution and immediately released. `sanitizeVaultError` strips any potential token patterns (`EAAB...`, `Bearer ...`) from errors and diagnostics.

---

## 6. Key Rotation & Token Rotation Architecture

### Token Rotation (OAuth Re-Authorization / Refresh)
- Handled in `storeCredential()`:
  - Updates prior active records with `revoked_at = now`.
  - Encrypts new token with a fresh nonce and current KEK version.
  - Inserts new record atomically.

### Key Encryption Key (KEK) Rotation
- Handled in `rotateEncryptionKey()`:
  - Takes `targetKeyVersion` (e.g., `META_CREDENTIAL_KEK_V2`).
  - Decrypts ciphertext using old version KEK + old AAD.
  - Re-encrypts token using new version KEK + new AAD with a fresh nonce.
  - Updates ciphertext, nonce, and `encryption_key_version` in place.
  - Discards decrypted plaintext immediately.

---

## 7. Mission Control & Maya Integration

- **Truthful Telemetry:** Maya answers `SOCIAL_CONNECTION_QUERY` with safe vault metadata:
  ```
  Status Koneksi Meta & Akun:
  • Status Keseluruhan: CONNECTED
  • Facebook Page: RancangLoka Indonesia
  • Instagram Business: @rancangloka.id
  • Izin / Permission: Lengkap (OK)
  • Vault Kredensial: TERSIMPAN (Terkunci AES-256-GCM)
  • Masa Berlaku Token: 01/11/2026
  • Otoritas Penerbitan: 0 (TIDAK AKTIF)
  • Otomasi Sosial: OFF (Hanya persiapan / read-only).
  ```
- **Secret Refusal Invariant:** If an operator asks Maya for the raw access token in chat, the request is intercepted by `DANGEROUS_PRODUCTION_ACTION` filtering and rejected with `DANGEROUS_ACTION_FORBIDDEN`.
- **Zero Token in Snapshots:** `MissionControlSnapshot` only carries `vaultCredential: { status: 'VALID', expiresAt: '...' }`.

---

## 8. Requirements for SOCIAL-S3.6 (Next Milestone)

With the credential vault foundation hardened, **SOCIAL-S3.6** can safely implement the operator-gated OAuth callback:
1. Operator triggers Meta consent in browser.
2. Callback receives `code` and verifies `state` (HMAC SHA-256).
3. Server-side exchange retrieves short/long-lived token.
4. Token is immediately encrypted via `storeCredential()` and stored in `social_provider_credentials`.
5. Plaintext token is purged from memory.
6. Safe non-secret metadata is registered in `settings` (`social_meta_connection_json`).
7. Read-only health check runs against `/me` and `/me/accounts`.
8. Publishing authority remains **0**; `SOCIAL_AUTOMATION` remains **OFF**.
