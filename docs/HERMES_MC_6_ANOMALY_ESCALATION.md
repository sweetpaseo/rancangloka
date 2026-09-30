# HERMES-MC-6: Mission Control Anomaly Detection & Staff Escalation

## 1. Executive Summary & Mission
Milestone `HERMES-MC-6` establishes the canonical anomaly normalization, deduplication, and staff escalation infrastructure for RancangLoka Hermes Mission Control.

The primary mission is to transform raw, distributed operational telemetry signals into normalized, auditable anomalies assigned deterministically to responsible staff and departments, while strictly filtering out planned dormancy (e.g. `media_worker = DISABLED`, `automation_mode = OFF`) so that the system never fabricates false alarms.

---

## 2. Invariants & Principles

1. **Zero Hallucination / Zero Fabricated Faults:** Normalization operates strictly on real signals from Cloudflare D1, runner receipts, breaker registries, scheduler heartbeats, and pipeline task records.
2. **Expected Dormancy Isolation:**
   - `media_worker = DISABLED` $\rightarrow$ `severity: 'INFO'`, `state: 'EXPECTED'`, `expected_condition: true`.
   - `automation_mode = OFF` $\rightarrow$ `severity: 'INFO'`, `state: 'EXPECTED'`, `expected_condition: true`.
   - Planned dormancy states do NOT increment urgent badge counters, trigger red alarm icons in Pixel Office, or spam staff conversation threads.
3. **Deterministic Staff Assignment:** Blame/assignment to staff personas requires verifiable evidence. Generic infrastructure anomalies (e.g. dead-letter outbox without clear sender, unreadable telemetry) remain unassigned (`responsible_agent_id = null`).
4. **Informational Staff Escalation Only:** Automated escalation messages in staff chat threads are strictly informational. They do NOT execute commands or bypass the MC-5 authority and allowlist framework.
5. **Zero Remediation Mutators:** The Alert Center and anomaly engines are strictly observational (`READ_ONLY`). They provide zero dangerous mutation controls (no retry triggers, no direct publication, no worker force-enable, no breaker resets).
6. **No Production Operational Mutation:** Migration `0025_mission_control_anomalies.sql` is prepared and tested locally; it is NOT automatically applied to production.

---

## 3. Normalized Anomaly Schema

Backed by Cloudflare D1 (`db/migrations/0025_mission_control_anomalies.sql`) with dual-store in-memory fallback for local development and testing:

### `mission_control_anomalies`
- `anomaly_id` (`TEXT PRIMARY KEY`): Unique anomaly identifier (e.g. `anom_fp_...`).
- `detected_at` / `updated_at` (`TEXT NOT NULL`): ISO timestamps.
- `source_system` (`TEXT NOT NULL`): `media`, `publication`, `jev`, `hermes`, `editorial`, `research`, or `mission_control`.
- `source_event_id` (`TEXT`): Trace pointer to originating log or receipt.
- `department_id` (`TEXT NOT NULL`): Owning department.
- `responsible_agent_id` (`TEXT`): Canonical machine agent ID, or `NULL` for unassigned infrastructure issues.
- `task_id` (`TEXT`): Related pipeline task ID.
- `entity_type` / `entity_id` (`TEXT`): Target entity (e.g. `article:5`, `media_job:mjob_12`).
- `severity` (`TEXT NOT NULL CHECK(severity IN ('INFO', 'WARNING', 'ERROR', 'CRITICAL'))`):
  - `INFO`: Operational condition worth recording but not a problem (e.g. intentional dormancy).
  - `WARNING`: Degraded condition (e.g. provider fallback, stale heartbeat, retry in progress).
  - `ERROR`: Subsystem/task failure requiring operator attention (e.g. retry exhausted, offline heartbeat).
  - `CRITICAL`: Safety/availability threat (e.g. kill switch active, breaker open).
- `anomaly_type` (`TEXT NOT NULL`): Canonical anomaly type (e.g. `MEDIA_RETRY_EXHAUSTED`, `CIRCUIT_BREAKER_OPEN`).
- `error_class` (`TEXT`): Standardized error category.
- `title` / `summary` (`TEXT NOT NULL`): Clear Indonesian editorial summaries with secret redaction applied.
- `technical_detail` (`TEXT`): Low-level trace detail with secret redaction.
- `state` (`TEXT NOT NULL CHECK(state IN ('OPEN', 'ACKNOWLEDGED', 'RESOLVED', 'SUPPRESSED', 'EXPECTED'))`).
- `retryable` (`INTEGER NOT NULL DEFAULT 0`): Boolean flag.
- `operator_action_required` (`INTEGER NOT NULL DEFAULT 0`): Boolean flag.
- `expected_condition` (`INTEGER NOT NULL DEFAULT 0`): Boolean flag (true for planned dormancy).
- `evidence_reference` (`TEXT`): Relational evidence pointer.
- `fingerprint` (`TEXT NOT NULL`): Deterministic deduplication key.
- `occurrence_count` (`INTEGER NOT NULL DEFAULT 1`): Count of repeated detections.
- `first_seen_at` / `last_seen_at` (`TEXT NOT NULL`).
- `resolved_at` (`TEXT`): Timestamp when condition cleared.

### `mission_control_anomaly_events`
Audit log tracking anomaly lifecycle transitions (`DETECTED`, `UPDATED`, `ESCALATED`, `ACKNOWLEDGED`, `RESOLVED`, `SUPPRESSED`).

---

## 4. Deterministic Staff & Department Assignment Matrix

| Telemetry Condition | Canonical Anomaly Type | Severity | Department | Responsible Staff | Operator Action Required |
|---|---|---|---|---|---|
| Media retry exhausted ($\ge 3$ attempts) | `MEDIA_RETRY_EXHAUSTED` | `ERROR` | `media` | Budi (`lokamedia_worker_primary`) | Yes |
| Media stage failure ($< 3$ attempts) | `MEDIA_STAGE_FAILURE` | `WARNING` | `media` | Budi (`lokamedia_worker_primary`) | No (Auto-retryable) |
| Media circuit breaker open | `CIRCUIT_BREAKER_OPEN` | `CRITICAL` | `media` | Budi (`lokamedia_worker_primary`) | Yes |
| Media worker intentionally disabled | `MEDIA_WORKER_DISABLED` | `INFO` | `media` | Budi (`lokamedia_worker_primary`) | No (Expected Dormancy) |
| Publication automation OFF by design | `AUTOMATION_MODE_OFF` | `INFO` | `publication_operations` | Sari (`publication_dispatcher_core`) | No (Expected Dormancy) |
| Publication circuit breaker open | `CIRCUIT_BREAKER_OPEN` | `CRITICAL` | `publication_operations` | Sari (`publication_dispatcher_core`) | Yes |
| Emergency kill switch engaged | `EMERGENCY_KILL_SWITCH_ACTIVE` | `CRITICAL` | `publication_operations` | Sari (`publication_dispatcher_core`) | Yes |
| Publication cron runner failed | `CRON_JOB_FAILED` | `WARNING` | `publication_operations` | Sari (`publication_dispatcher_core`) | No |
| JEV provider fallback (timeout/degradation) | `JEV_PROVIDER_FALLBACK` | `WARNING` | `engineering_telemetry` | Dimas (`telemetry_observer_jev`) | No (Zero Jev Authority) |
| JEV provider communication error | `JEV_PROVIDER_ERROR` | `WARNING` | `engineering_telemetry` | Dimas (`telemetry_observer_jev`) | No (Zero Jev Authority) |
| Hermes scheduler heartbeat stale ($>300$s) | `HERMES_HEARTBEAT_STALE` | `WARNING` | `engineering_telemetry` | Dimas (`telemetry_observer_jev`) | No |
| Hermes scheduler heartbeat offline ($>600$s) | `HERMES_HEARTBEAT_OFFLINE` | `ERROR` | `engineering_telemetry` | Dimas (`telemetry_observer_jev`) | Yes |
| Dead-letter outbox accumulation | `OUTBOX_DEAD_LETTER` | `ERROR` | `engineering_telemetry` | *(Unassigned - Infrastructure)* | Yes |
| Editorial authoring validation failure | `EDITORIAL_VALIDATION_FAILED` | `WARNING` | `editorial` | Joko (`content_writer_primary`) | Yes |
| Editorial First Article Gate QA failure | `EDITORIAL_QA_FAILED` | `WARNING` | `editorial` | Rina (`editorial_qa_primary`) | Yes |
| Research evidence pack / citation failure | `RESEARCH_PACK_FAILED` | `WARNING` | `research_evidence` | Irwan (`evidence_researcher_lead`) | No |

---

## 5. Deduplication, Fingerprinting & Automatic Resolution

- **Stable Fingerprint:** Generated via `createAnomalyFingerprint(sourceSystem, departmentId, anomalyType, entityOrTaskId, errorClass)`.
- **Deduplication:** When an active anomaly is re-detected on subsequent scans, the system increments `occurrence_count` and updates `last_seen_at` without duplicating database rows.
- **Severity Escalation:** If an existing anomaly escalates (e.g. from `WARNING` to `ERROR` due to retry exhaustion), the record's severity is updated and an `UPDATED` event is recorded.
- **Deterministic Resolution:** When a scan reveals that an underlying condition has cleared (e.g. heartbeat returns to `healthy`, circuit breaker returns to `CLOSED`, or a failed task completes), the anomaly transitions to `RESOLVED` with `resolved_at = now()`.
- **Auditability:** Resolved anomalies are preserved in storage for historical audit trail.

---

## 6. Staff Conversation Integration ("Staff Reports to Operator")

When an actionable anomaly (`WARNING`, `ERROR`, or `CRITICAL`) is first detected and is assigned to a named staff member:
1. `dispatchStaffAnomalyEscalation` sends an informational message to the staff member's conversation thread in `mission_control_messages`.
2. The message clearly displays severity, problem summary, and technical detail.
3. Linkage is maintained via `metadata: { anomaly_id, fingerprint, severity }`.
4. Subsequent scans for the same active fingerprint do NOT spam duplicate chat messages.
5. Invariant: Escalation messages do not execute commands or grant elevated authority to the operator.

---

## 7. Pixel Office & Spatial Integration

In `/admin/mission-control/office`:
- **Staff Warning Overlays:** Staff sprites visually display `warning_level = 'CRITICAL'` (red pulsing indicator) or `warning_level = 'WARNING'` (amber indicator) when assigned an active actionable anomaly.
- **Room Badges:** Department rooms display an active anomaly count badge (`active_anomalies_count`).
- **Expected Dormancy Isolation:** Planned dormancy (e.g. Budi when `media_worker = DISABLED`) retains `warning_level = 'NONE'`, avoiding false red alarms.
- **Resolution:** As soon as an anomaly resolves, active visual warning badges clear immediately.

---

## 8. Alert Center UI & API

- **Web Route:** `/admin/mission-control/alerts`
- **API Endpoint:** `GET /api/admin/mission-control/alerts` (JSON payload of active, expected, and resolved anomalies with KPI counts).
- **Sub-Navigation Tabs:** Integrated across Cockpit, Staff Registry, Departemen, Pixel Office, and Alert Center.
- **KPI Metrics:** Total Active Actionable, Critical, Warning, Expected Dormancy, and Resolved History.
- **Safe Operator Controls:** Provides direct navigation to staff chat (`💬 Chat [Nama]`) and department detail without offering dangerous direct remediation buttons.

---

## 9. Preparation for Future Milestones (MC-7+)

- The normalized anomaly model is transport-neutral, preparing for future outbound notification webhooks (Telegram, email, Slack) without requiring runtime modifications to the anomaly detector.
