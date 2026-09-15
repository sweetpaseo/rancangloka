# LokaMedia MV3 Extension Core

Phase 3 implements the durable Chrome MV3 extension foundation only. It does not implement a ChatGPT/provider DOM adapter and does not call any model.

Loadable unpacked extension root:

```text
extensions/lokamedia
```

Core constants:

- `EXTENSION_VERSION=0.1.0`
- `LOKAMEDIA_PROTOCOL_VERSION=1`
- `STORAGE_SCHEMA_VERSION=1`
- provider generation concurrency: `1`
- image capture concurrency: `1`
- upload concurrency: `2`
- pending captured asset limit: `4`
- pending captured byte limit: `20971520`

Durability model:

- small state in `chrome.storage.local`
- captured blobs in IndexedDB
- server remains authoritative for job state, receipts, attachment confirmation, and completion
- startup recovery reconciles local work before retrying side effects

Provider status:

- `MockProviderAdapter` is test-only/local-core plumbing.
- Real ChatGPT automation is intentionally absent until Phase 4.
