# LokaMedia Phase 3 Offline Checkpoint

Date: 2026-09-15

## Latest Local Checkpoint

Date: 2026-09-20

Latest clean checkpoint commit:

```text
182726593d11cc7971ad759190eaf18901bca753
```

Commit message:

```text
feat: add article media attachment
```

`LOKAMEDIA_PHASE_5H2=PASS_CONTROLLED_ARTICLE_MEDIA_ATTACHMENT`
`LOKAMEDIA_PHASE_5H1=PASS_ARTICLE_MEDIA_ATTACHMENT_FOUNDATION`
`LOKAMEDIA_PHASE_5G2=PASS_CONTROLLED_MEDIA_ASSETS_REGISTRATION`
`LOKAMEDIA_PHASE_5G1=PASS_MEDIA_ASSET_REGISTRATION_FOUNDATION`
`LOKAMEDIA_PHASE_5E2=PASS_CONTROLLED_LIVE_R2_UPLOAD`
`LOKAMEDIA_PHASE_5E1=PASS_DURABLE_DERIVATIVE_UPLOAD_QUEUE`
`LOKAMEDIA_PHASE_5D5B=PASS_CONTROLLED_LIVE_WATERMARK_DERIVATIVE`
`LOKAMEDIA_PHASE_5D5A=PASS_DURABLE_WATERMARK_DERIVATIVE_PIPELINE`
`LOKAMEDIA_PHASE_5D4B=PASS_WATERMARK_MASTER_ASSET_STORAGE`
`LOKAMEDIA_PHASE_5D4A=PASS_ADMIN_WATERMARK_SETTINGS`
`LOKAMEDIA_PHASE_5D3A=PASS_DETERMINISTIC_WATERMARK_TRANSFORM_CORE`
`MEDIA_PROCESSING_LANE_CLOSED=YES`
`UPLOAD_LANE_CLOSED=YES`
`MEDIA_ASSET_REGISTRATION_LANE_CLOSED=YES`
`ARTICLE_MEDIA_ATTACHMENT_LANE_CLOSED=YES`
`READY_FOR_READINESS_RECONCILIATION=YES`

Phase 5H2 (Controlled Article Media Attachment Execution):
- Controlled article fixture `article_id: 1`, `slot_key: 'featured'`.
- Registered media asset `ast_d230f3d834ae5f1a9f689d7c` attached via canonical endpoint `POST /api/internal/v1/media/article-media/attach`.
- Exactly one active relation created in `article_media` (`id: 1`, `article_id: 1`, `slot_key: 'featured'`, `asset_id: 'ast_d230f3d834ae5f1a9f689d7c'`, `role: 'featured'`, `is_active: 1`, `reused_existing: false`).
- Duplicate attachment idempotency verified (`reused_existing: true`, 0 duplicate inserts).
- Lost-response recovery and restart/reopen readback verified independently.
- Audit event recorded in `media_asset_audit` (`action: 'ATTACH'`).
- Invariant safety verified: article status remains `draft`, readiness remains `NONE`, updated_at unchanged. Zero R2 activity, zero binary transfer.

Phase 5H1 (Article Media Attachment Foundation):
- Commit `182726593d11cc7971ad759190eaf18901bca753` (`feat: add article media attachment`).
- Service: `src/lib/media/article-media.ts` (`attachArticleMedia`, `resolveEditorialRole`, `assertValidSlotKey`).
- Internal API: `src/pages/api/internal/v1/media/article-media/attach.ts`.
- Enforces existence, attachability, role compatibility, slot regex, provenance guard, active slot uniqueness (`idx_article_media_one_active_slot`), conflict guard (`FAIL_CLOSED_REPLACEMENT_REQUIRED`), idempotency, and audit.
- Deterministic test suite: `scripts/test-lokamedia-phase5h1-article-media-attachment.js` (39 tests all pass). Full regression clean (202 tests pass).

Phase 5G2 (Controlled Media Assets Registration Execution):
- Verified R2 derivative `media/articles/derivatives/458a8367c669185e25e284d88bcedce01a0afa85745b94a357e923a784a9deff.png` (3847117 bytes) registered into `media_assets` as `ast_d230f3d834ae5f1a9f689d7c`.
- Provenance stored in `provenance_json`. Audit event recorded in `media_asset_audit`. Idempotency verified.

Phase 5G1 (Media Asset Registration Foundation):
- Commit `861baa58bc90a4dae2a9f6c5f8cd01cf9d562730` (`feat: add media asset registration`).
- Migration `db/migrations/0016_media_assets_derivative_registration.sql`.
- Service `src/lib/media/asset-registration.ts` and endpoint `src/pages/api/internal/v1/media/assets/register.ts`.
- Deterministic test suite: `scripts/test-lokamedia-phase5g1-asset-registration.js` (40 tests all pass).

Phase 5E2 (Controlled Live R2 Upload Execution):
- Public derivative candidate uploaded to local Miniflare R2 bucket (`rancangloka-media`).
- Upload receipt stored in IndexedDB `media-uploads`: `upl_34381ae9e9996a2d4b4e0d93d29da49849e38fce7160e3e675a4d2c656f82d45` (`state: UPLOADED`).
- Second batch idempotency verified (0 second uploads).

Phase 5E1 (Durable Derivative Upload Queue Foundation):
- Commit `1c30da7a0ab0118608836ea200c5cd4689679340` (`feat: add durable derivative upload queue`).
- IndexedDB schema v3 -> v4 (`media-uploads` store). Modules: `src/upload-queue.ts`, `src/lib/media/derivative-upload.ts`.
- Deterministic test suite: `scripts/test-lokamedia-phase5e1-upload-queue.js` (19 tests all pass).

Phase 5D5B (Controlled Live Watermark Derivative Execution):
- Watermark derivative produced from immutable original: `der_882fdc3c59e650718a83a38c5fa0db0f8b422a504946772c0f3af0fde9a0a662` (transform `f886f5d7b3278ebb6da84e9551df0c26b20795608eca26b05007f20ba48f155c`, SHA: `458a8367c669185e25e284d88bcedce01a0afa85745b94a357e923a784a9deff`).
- Stored in IndexedDB `media-derivatives` with role `PUBLIC_DERIVATIVE_CANDIDATE`.

Phase 5D5A (Durable Watermark Derivative Pipeline):
- Commit `d5b67948bbdd73f4038af9dc395d65768247146c` (`feat: add durable watermark derivative pipeline`).
- IndexedDB schema v2 -> v3 (`media-derivatives` store). Client-side pipeline in `src/derivative-pipeline.js`.
- Deterministic test suite: `scripts/test-lokamedia-phase5d5a-watermark-derivative-pipeline.js` (24 tests all pass).

Phase 5D4B (Watermark Master Asset Storage):
- Commit `a13e2532cb19e59d2a6a1aa5e4f20ec6179e8c45` (`feat: add watermark master asset storage`).
- Migration `0015_site_watermark_assets.sql`. Service `src/lib/watermark/assets.ts`.

Phase 5D4A (Admin Watermark Settings):
- Commit `50b41416ef35245a49fc51205fe2df4973ee7e5f` (`feat: add admin watermark settings`).

Phase 5D3A (Deterministic Watermark Transform Core):
- Commit `1a40ab480d1964fb49e3cf41865c3bbcb3d1ffad` (`feat: add deterministic watermark transform core`).
- Client module `src/watermark-engine.js`.


Phase 4B1A.5D2P (Fresh Provider Preflight):
- Reloaded extension with commit `0d04af48d3b946b4484b5c5b1d95fdc31b1dfa13`.
- Refreshed same authenticated ChatGPT tab to reconnect fresh content script (`session_id` regenerated, composer present, no login prompt).
- Dispatched canonical `READ_ONLY_PROVIDER_DIAGNOSTIC` message from Side Panel.
- Provider state converged cleanly: `tab=connected`, `auth=ready`, `dom=supported`, `composer=ready`, `lane=idle`.
- Runtime 5D1E features verified in loaded service worker and content script:
  - `getAllImages` and baseline diffing snapshot.
  - Bounded result polling (90000ms / message `timeout_ms`).
  - Strict capture-ready requirement (`source_fingerprint`, `containerFingerprint`, context matching).
  - Controller and adapter fail-closed guards before capture.
  - Durable `result_checkpoint` stored in local job state.
- Side Panel verified: `Run Once` button present, enabled, text `Run Once`.
- Fixture clean: server job `QUEUED`, `lease_owner=null`, `attempt=0`, `job_revision=15`. Local job `QUEUED`, `phase4bSingleRun=null`, all probes false, blob count 0.

Phase 4B1A.5D2R-2 (Canonical Recovery):
- Resolved blocked incident from earlier live run where generation resolved before result identification.
- Executed canonical lease release via `POST /api/internal/v1/media/jobs/mjob_5c0f488d7ee123b9579a58a5/release` with `intent: 'SAFE_REQUEUE'`, `reason_code: 'EXPIRED_LEASE_RECOVERY'`, `expected_job_revision: 14`. Server returned `QUEUED`, `lease_owner=null`, `attempt=0`, `job_revision=15`.
- Synchronized local extension state with server jobs list (`status=QUEUED`, `local_state=QUEUED`).
- Verified zero stale `result_checkpoint` and retired stale `phase4bSingleRun` latch safely.
- Zero mutations to media assets, zero R2 uploads, zero live generation or capture.

Phase 4B1A.5D1E (Provider Result Completion & Correlation Hardening):
- Hardened ChatGPT provider generation contract: `provider.generate()` does not resolve merely upon prompt submission.
- Pre-submit baseline candidate diffing captures existing images before clicking send.
- Bounded asynchronous polling loop awaits correlated image result to emerge.
- Emits structured error `PROVIDER_RESULT_TIMEOUT` on timeout (90000ms) or `PROVIDER_RESULT_AMBIGUOUS` on ambiguous multiple candidates.
- Generates complete descriptor with `source_fingerprint`, `containerFingerprint`, `job_id`, `run_id`, `slot_key`, `prompt_version`, `prompt_hash`, `submitted_at`, and `identified_at`.
- Durable `result_checkpoint` persisted in extension storage before capture handoff.
- Fail-closed guards added in both `controller.js` and `adapter.js` checking `isCaptureReadyProviderResult()` before dispatching `CHATGPT_PROVIDER_CAPTURE` to content script.
- Deterministic test suite: `scripts/test-lokamedia-phase4b1a-5d1e-result-await.js` (Tests 13-22 all pass).

Phase 4B1A.5D1C (IndexedDB Schema Migration):
- Bumped extension IndexedDB schema version from 1 to 2.
- Created required `captured-blobs` object store with `keyPath: 'blobKey'` and secondary indexes (`by_job_id`, `by_run_id`, `by_status`, `by_created_at`).
- Preserved legacy data in existing stores and ensured forward-only idempotent migration.
- Deterministic test suite: `scripts/test-lokamedia-phase4b1a-5d1c-schema-migration.js` (Tests A through H all pass).

Phase 4B1A.5D1B wired the real ChatGPT capture path, removing the `CAPTURE_DISABLED_PHASE_4A` stub:
- `controller.js` explicitly passes the already-correlated `providerResult` descriptor into `provider.capture(job, providerResult)`.
- `ChatGptProviderAdapter.capture(job, providerResult)` locates the active ChatGPT tab, dispatches `CHATGPT_PROVIDER_CAPTURE`, converts received base64 data URL into binary `ArrayBuffer`, and returns normalized capture record (`bytes`, `mime`, `width`, `height`, `size`, `sha256`, `blobKey`).
- Content script `CHATGPT_PROVIDER_CAPTURE` handler executes `controlledCapture(message)`:
  - Validates request shape (`job_id`, `run_id`, `slot_key`, `provider_result`).
  - Re-locates candidate image strictly matching `source_fingerprint` or `containerFingerprint`.
  - Prohibits all global heuristics (no `newest <img>`, no global ungrounded re-discovery).
  - Fails closed on missing (`CAPTURE_TARGET_MISSING`), ambiguous (`CAPTURE_TARGET_AMBIGUOUS`), or mismatched (`CAPTURE_CORRELATION_MISMATCH`) target.
  - Binary acquisition: Canvas `toDataURL` fallback to direct `fetch(src)` with chunked base64 data URL transport across Chrome extension messaging (`CAPTURE_MESSAGE_BINARY_TRANSPORT=BASE64_DATA_URL`).
  - Byte-identical roundtrip transport verified (`BINARY_ROUNDTRIP_IDENTICAL=YES`).
  - Reconnection fail-closed: surfaces `CONTENT_SCRIPT_UNAVAILABLE` cleanly without silent duplicate attempts.
- Controller binary validation authoritative gate preserved (non-empty bytes, valid MIME, dimensions) before durable IndexedDB persistence.
- Deterministic test suite: `scripts/test-lokamedia-phase4b1a-5d1b-chatgpt-capture.js` (Tests A through J all pass).
- Full regression suite clean: 76 tests pass across all 7 test suites, zero failures.
- Controlled fixture `mjob_5c0f488d7ee123b9579a58a5` status remains `QUEUED`, `lease_owner=null`, `attempt=0`, `job_revision=11` (unmutated).
- Probes reset to default: `acquisitionProbe=false`, `providerResultProbe=false`, `captureBlobProbe=false`.

`LOKAMEDIA_PHASE_4B1A5D1=PASS_CAPTURE_CORRELATION_AND_DURABLE_BLOB_SAFETY_BOUNDARY`

Phase 4B1A.5D1 proved the generic capture correlation and durable persistence architecture:
- Exact candidate correlation via baseline diffing (`correlateImageCandidates`), prohibiting `newest <img>` heuristic.
- Durable IndexedDB persistence (`MemoryBlobStore` / `IndexedDbBlobStore`).
- Backpressure contract: max 4 assets, max 20 MiB.
- Capture Blob Probe boundary: `captureBlobProbe=true` stops immediately after blob persistence before R2 upload, media asset creation, or article attachment.

`LOKAMEDIA_PHASE_4B1A5C2=PASS_CONTROLLED_LIVE_PROVIDER_GENERATION_PROBE`

Phase 4B1A.5C2 proved the live provider generation path:
- Repaired heartbeat contract (`expected_job_revision`, authoritative revision propagation).
- Repaired ChatGPT ProseMirror composer detection and dynamic send control.
- Handled content-script lifecycle and reconnection on extension reload.
- Executed exactly one real ChatGPT generation live and stopped cleanly at `PROVIDER_RESULT_PROBE_STOP` with safe requeue.

`LOKAMEDIA_PHASE_4B1A5C1=PASS_PROVIDER_RESULT_STOP_BOUNDARY`

Phase 4B1A.5C1 added the provider-result stop boundary (`providerResultProbe`, default `false`) for controlled live generation:
- Stops execution immediately after `provider.generate` returns and `GENERATION_IMAGE_DETECTED` is recorded, prior to `provider.capture`.
- Emits structured `PROVIDER_RESULT_PROBE_STOP` audit event with non-sensitive provider result metadata.
- Canonical job lease cleanup: uses `ApiClient.releaseJob` with `intent: 'SAFE_REQUEUE'` (`POST /api/internal/v1/media/jobs/[job_id]/release`) to release server lease safely.
- Duplicate generation risk controlled by Phase 4B single-run submission latch (`phase4bSingleRun.submission_consumed`), `providerLane` exclusivity, and `activeRun` lock release in `finally`.
- Deterministic test coverage added for default flow preservation, probe stop before capture, run_id and job_id correlation, single provider call enforcement, zero capture calls, canonical cleanup, and active-run lock release.

`LOKAMEDIA_PHASE_4B1A5B1=PASS_LOCAL_ACQUISITION_PROBE_BOUNDARY`

Phase 4B1A.5B1 added an explicit local-only acquisition probe boundary to enable safe live acquisition proof:
- `acquisitionProbe` flag (default `false`) stops execution immediately after `JOB_ACQUIRED` and before single-run arming or `runJob`.
- Emits structured `ACQUISITION_PROBE_STOP` audit event.
- Canonical job lease cleanup: uses `ApiClient.releaseJob` with `intent: 'SAFE_REQUEUE'` (`POST /api/internal/v1/media/jobs/[job_id]/release`) to return the job safely to `QUEUED`.
- Releases active-run lock via `try/finally` cleanup.
- Deterministic test coverage added for normal flow parity, probe stop, run_id correlation, lock release, and zero provider calls.

`LOKAMEDIA_PHASE_4B1A5A=PASS_DETERMINISTIC_EXECUTION_START`

Phase 4B1A.5A repaired the execution start and locking path for the LokaMedia Chrome extension:
- `side-panel.js` generates a single `run_id` and propagates it via `RUN_ONCE` message payload.
- `background.js` verifies mutual exclusion using `acquireActiveRunLock({ runId })`, logs `RUN_REENTRY_REJECTED` if already active, logs `RUN_REQUEST_ACCEPTED`, and invokes `controller.runOnce({ runId, acceptedLogged: true })`.
- `controller.js` directly enters `RUN_GATE_CHECK_START` under a guaranteed `try/finally` block that releases the active-run lock upon completion, gate failure, or error.
- Deterministic test coverage added for execution start, single run_id propagation, concurrent re-entry blocking, lock release on success, and lock release on failure.

Important safety boundary:
- General automatic ChatGPT submission remains disabled.
- No real ChatGPT prompt submission, no image generation, no production mutation, and no deployment.

Date: 2026-09-16

Latest clean checkpoint commit:

```text
028a73ee45db8edb32c1537c33dab72e1732ec6b
```

Commit message:

```text
fix(lokamedia): repair run-once path and add audit logging
```

`LOKAMEDIA_PHASE_4B1A5=PASS_WITH_CAPTURE_STILL_DISABLED`

Phase 4B1A.5 repaired the local Run Once control path and added durable structured audit logging for the LokaMedia Chrome extension. The extension now records Side Panel click, background dispatch, controller gate checks, job acquisition, provider lane ownership, submission-gate arming, controlled provider submit, capture/upload/attachment stages, terminal success, and failure/needs-attention outcomes.

Important safety boundary:

- General automatic ChatGPT submission remains disabled.
- Controlled submission is enabled only for the explicit Phase 4B Run Once path after local prerequisites pass.
- Capture remains Phase 4A-disabled, so this checkpoint is ready for audit-visible operator diagnosis, not full end-to-end unattended media completion.
- No real ChatGPT prompt was submitted, no image was generated, no new fixture was created, no production mutation was performed, and no deployment was made.

New durable audit surfaces:

- `extensions/lokamedia/src/audit-log.js`
- `lokamediaState.auditLog` in `chrome.storage.local`
- Side Panel `Last action`
- Side Panel `Audit Log`
- audit filters for level, current run, and current job
- `Copy Log`
- `Export JSON`
- isolated `Clear Log`

Phase 4B1A.5 verification passed locally:

```text
node --test scripts\test-lokamedia-side-panel.js scripts\test-lokamedia-popup-controls.js scripts\test-lokamedia-phase3-extension.js scripts\test-lokamedia-phase4a-chatgpt-provider.js
node_modules\.bin\tsc.cmd --noEmit
node --check extensions\lokamedia\src\*.js and recursive source check
ASTRO_TELEMETRY_DISABLED=1 astro build
```

Operator requirement after this checkpoint:

```text
EXTENSION_RELOAD_REQUIRED=YES
READY_FOR_OPERATOR_SINGLE_RUN=NO_CAPTURE_STILL_PHASE_4A_DISABLED
```

## Current Canonical Worktree

Use this worktree for the next LokaMedia phase:

```text
C:\Users\Fanto\Desktop\antigravity\rancangloka\lokamedia-phase-2ab-checkpoint
```

Branch:

```text
lokamedia-phase-2ab-checkpoint
```

Current clean checkpoint commit:

```text
712bc5fdf23ac1e8beeafce8db6202a1c07b44c1
```

Commit message:

```text
feat(lokamedia): add durable MV3 extension core
```

## Phase 3 Status

`LOKAMEDIA_PHASE_3=PASS`

Phase 3 added the local Chrome MV3 extension core at:

```text
extensions/lokamedia
```

Extension constants:

- `EXTENSION_VERSION=0.1.0`
- `STORAGE_SCHEMA_VERSION=1`
- `LOKAMEDIA_PROTOCOL_VERSION=1`
- `PROVIDER_GENERATION_CONCURRENCY=1`
- `IMAGE_CAPTURE_CONCURRENCY=1`
- `UPLOAD_CONCURRENCY=2`
- `MAX_PENDING_CAPTURED_ASSETS=4`
- `MAX_PENDING_CAPTURED_BYTES=20971520`

Implemented:

- MV3 manifest
- background service worker
- `chrome.storage.local` state abstraction
- IndexedDB blob store
- API client
- scheduler/controller
- heartbeat manager
- reconciliation manager
- upload worker pool
- backpressure controller
- duplicate-safe message protocol
- minimal popup/status UI
- deterministic mock provider
- Phase 3 regression suite

Intentionally not implemented:

- ChatGPT provider adapter
- ChatGPT DOM automation
- OpenAI/ChatGPT host permission
- model calls
- production deploy
- production D1/R2/article mutation
- automatic publishing

## Verification Already Passed

```text
node --test scripts\test-lokamedia-phase3-extension.js
node --test scripts\test-lokamedia-phase2a-schema.js scripts\test-lokamedia-phase2b-control-plane.js scripts\test-lokamedia-phase2c-upload.js scripts\test-lokamedia-extension.js
node --test scripts\test-publication-readiness.js scripts\test-soak-safety.js
node --test scripts\test-import-pipeline.js scripts\test-author-regression.js scripts\test-validator.js
node_modules\.bin\tsc.cmd --noEmit
ASTRO_TELEMETRY_DISABLED=1 astro build
```

All passed locally before checkpoint.

## Safety State

- `AUTO_PUBLISH=OFF`
- `MEDIA_CAN_PUBLISH=NO`
- `MODEL_CALLS=0`
- `PRODUCTION_MUTATIONS=0`
- `DEPLOYMENTS=0`
- final worktree was clean after the Phase 3 commit

## Next Recommended Phase

`READY_FOR_PHASE_4B1A_5D2_CONTROLLED_LIVE_CAPTURE_PROBE=YES`

Phase 4B1A.5D1B successfully wired the real ChatGPT capture adapter with 76 passing deterministic tests and zero regressions.
When resuming, execute Phase 4B1A.5D2 (Controlled Live ChatGPT Capture + Durable Blob Probe):
- Exactly one Run Once on existing controlled fixture `mjob_5c0f488d7ee123b9579a58a5`.
- Exactly one generation, exact result correlation, exactly one capture.
- Durable persistence into IndexedDB (`local_state=CAPTURED`).
- Stop at `CAPTURE_BLOB_PROBE_STOP`.
- Zero R2 upload, zero media assets, zero article attachments.

