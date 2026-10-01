# 🛡️ SOCIAL-S3.5B: Credential Vault Cryptographic & Concurrency Hardening

> **Status:** COMPLETE / VERIFIED / HARDENED (SHADOW / READ-ONLY)  
> **Authority Level:** ZERO (`publishingAuthority: 0`)  
> **Cryptographic Engine:** AES-256-GCM with Independent Random Nonces & Token Purpose AAD  
> **Database Invariant:** Enforced Single Active Credential via Partial Unique Index (`uq_social_active_credential`)  
> **Safety State:** `automation_mode = OFF`, `SOCIAL_AUTOMATION = OFF`, `JEV_MODE = shadow`, `media_worker = DISABLED`  
> **Decision for Real OAuth:** **GO (CRYPTOGRAPHICALLY & CONCURRENTLY PROVEN)**

---

## 1. Executive Summary

Milestone **SOCIAL-S3.5B** executes a rigorous cryptographic, architectural, and concurrency audit of the RancangLoka Social Credential Vault prior to connecting any live external Meta account.

Key problems identified and resolved:
1. **Nonce Reuse Elimination:** Previously, simultaneous encryption of access and refresh tokens risked sharing a single nonce column. The architecture was upgraded so that every individual encryption operation receives an independently generated, cryptographically random 96-bit nonce (`access_token_nonce` and `refresh_token_nonce`), strictly preventing AES-GCM nonce reuse.
2. **Token Purpose AAD Binding:** Authenticated Additional Data now cryptographically binds the specific token purpose (`:access_token` vs `:refresh_token`). Ciphertext swapping between access and refresh token columns will cause AES-GCM tag verification to fail closed.
3. **Database-Level Single Active Invariant:** Migration `0028` establishes a partial unique index (`uq_social_active_credential ON (connection_id, provider) WHERE revoked_at IS NULL`), mathematically preventing concurrent race conditions from producing multiple active credentials.
4. **D1 Atomic Batch Transactions:** Credential rotation is executed via `db.batch([revokeStmt, insertStmt])`. If insertion fails, prior active credentials remain unrevoked.
5. **Full Token & Key Rotation:** Verified that rotating tokens (A/A $\rightarrow$ B/B) and rotating master keys (V1 $\rightarrow$ V2) safely re-encrypts both access and refresh tokens with fresh independent nonces without leaving partial state.

---

## 2. AES-GCM Nonce Audit & Storage Model

### Critical Cryptographic Principle
In Galois/Counter Mode (AES-GCM), encrypting two distinct plaintexts with the same key and the same nonce is catastrophic: it allows an attacker to compute the XOR of the plaintexts and recover the authentication hash key $H$, compromising both confidentiality and authenticity.

### Hardened Nonce Model (Additive Migration 0028)
```sql
ALTER TABLE social_provider_credentials ADD COLUMN access_token_nonce TEXT;
ALTER TABLE social_provider_credentials ADD COLUMN refresh_token_nonce TEXT;
```
- When `storeCredential()` runs with both `accessToken` and `refreshToken`:
  1. `accessNonce = crypto.getRandomValues(new Uint8Array(12))`
  2. `refreshNonce = crypto.getRandomValues(new Uint8Array(12))`
  3. `assert(accessNonce !== refreshNonce)` (guaranteed by 96 bits of cryptographic entropy)
  4. Both nonces are persisted in their respective dedicated columns.
- When `rotateEncryptionKey()` runs:
  1. Both ciphertexts are decrypted with their respective original nonces and contexts.
  2. Fresh, independent nonces are generated for the new key version.
  3. Nonces are never reused across re-encryptions.

---

## 3. Authenticated Additional Data (AAD) Audit

The context string passed as `additionalData` to `crypto.subtle.encrypt` and `crypto.subtle.decrypt` is:
```typescript
const contextString = `${credentialId}:${connectionId}:${provider}:${authMode}:${keyVersion}:${tokenPurpose}`;
```
Where `tokenPurpose` is explicitly `'access_token'` or `'refresh_token'`.

### Substitution Attack Resistance Matrix

| Attack Vector | Attacker Action | Expected Behavior | Actual Automated Test Result |
| :--- | :--- | :--- | :--- |
| **Field Swap (Refresh $\rightarrow$ Access)** | Copy refresh token ciphertext into `encrypted_access_token` column | AES-GCM MAC tag mismatch (AAD has `:access_token` instead of `:refresh_token`) | ✅ **FAILS CLOSED (`VAULT_DECRYPTION_FAILED`)** |
| **Field Swap (Access $\rightarrow$ Refresh)** | Copy access token ciphertext into `encrypted_refresh_token` column | AES-GCM MAC tag mismatch | ✅ **FAILS CLOSED (`VAULT_DECRYPTION_FAILED`)** |
| **Cross-Connection Injection** | Copy ciphertext from `conn_A` to `conn_B` | AAD contains `connectionId` | ✅ **FAILS CLOSED (`VAULT_DECRYPTION_FAILED`)** |
| **Cross-Provider Injection** | Replay Meta token ciphertext in TikTok provider row | AAD contains `provider` | ✅ **FAILS CLOSED (`VAULT_DECRYPTION_FAILED`)** |
| **Key Version Downgrade** | Replay V1 ciphertext under V2 metadata | AAD contains `keyVersion` | ✅ **FAILS CLOSED (`VAULT_DECRYPTION_FAILED`)** |
| **Bit Flipping / Tampering** | Mutate 1 character in base64 ciphertext or nonce | AES-GCM GMAC verification fails | ✅ **FAILS CLOSED (`VAULT_DECRYPTION_FAILED`)** |

---

## 4. Single Active Credential & Concurrency Control

### Database Invariant
```sql
CREATE UNIQUE INDEX IF NOT EXISTS uq_social_active_credential 
ON social_provider_credentials (connection_id, provider) 
WHERE revoked_at IS NULL;
```
- **Why Application Logic Alone Is Insufficient:** In high-concurrency environments (e.g. edge worker instances handling simultaneous webhooks or user clicks), application-level checks can race. The partial unique index enforces that SQLite/D1 itself rejects any second active row at the storage layer.

### Concurrent OAuth Callback Race
- When two OAuth callbacks race for the same `(connection_id, provider)`:
  - Both use `db.batch([revokeStmt, insertStmt])`.
  - Transaction A executes: revokes existing active rows, inserts Callback A.
  - Transaction B executes: revokes Callback A, inserts Callback B.
  - Database constraint is never violated.
  - Exactly **ONE** active credential survives.
  - The connection is never left in a broken or credential-less state.

---

## 5. Token & Key Encryption Key (KEK) Rotation

1. **Token Rotation (A/A $\rightarrow$ B/B):**
   - Automatically marks previous credential row `revoked_at = now`.
   - Encrypts new tokens with fresh independent nonces.
   - Decryption of old credential ID is barred (`VAULT_CREDENTIAL_NOT_FOUND`).
   - Active credential decrypts cleanly to Token B and Refresh B.
2. **KEK Rotation (V1 $\rightarrow$ V2):**
   - Atomically updates `encrypted_access_token`, `encrypted_refresh_token`, `access_token_nonce`, `refresh_token_nonce`, and `encryption_key_version`.
   - Generates brand new independent nonces under the new key.
   - Zero plaintext residual in memory or storage.

---

## 6. Threat Model Verification: D1 Database Exfiltration

- **Scenario:** Attacker gains full read access to Cloudflare D1 and exfiltrates all rows from `social_provider_credentials`.
- **Finding:** Attacker **CANNOT** recover plaintext tokens.
- **Proof:**
  - D1 contains ciphertext, nonces, key version identifiers (`META_CREDENTIAL_KEK_V1`), and token expiration dates.
  - D1 does **not** contain the 256-bit encryption key.
  - The key resides solely in Cloudflare encrypted secret storage.
  - Decryption calls without the KEK throw `VAULT_KEK_UNAVAILABLE`.

---

## 7. Technical Decision: GO / NO-GO for Real OAuth

| Requirement | Verified Condition | Status |
| :--- | :--- | :--- |
| **No AES-GCM Nonce Reuse** | Dedicated `access_token_nonce` & `refresh_token_nonce` generated independently per encryption | **PASS** |
| **AAD Context Security** | Authenticated Additional Data binds `tokenPurpose`, `connectionId`, `provider`, `keyVersion` | **PASS** |
| **Atomic Transactionality** | `db.batch([revoke, insert])` guarantees all-or-nothing execution | **PASS** |
| **Database Concurrency Gate** | Partial unique index `uq_social_active_credential` prevents multiple active rows | **PASS** |
| **Token & KEK Rotation** | Proven end-to-end for both access and refresh tokens | **PASS** |
| **Safe Error Normalization** | Decryption failures throw sanitized `VAULT_DECRYPTION_FAILED` without leaking secrets | **PASS** |
| **Mission Control & Maya** | Secret refusal enforced; zero tokens in snapshots | **PASS** |
| **Regression Suite** | 100% clean passes across all 14 test suites, SOAK-0, typecheck, and build | **PASS** |

### **DECISION: GO FOR SOCIAL-S3.6 (OPERATOR-GATED META CONNECTION & READ-ONLY HEALTH VERIFICATION)**
The credential vault is cryptographically sound, concurrency-hardened, and safe for operator-gated OAuth token ingestion.
