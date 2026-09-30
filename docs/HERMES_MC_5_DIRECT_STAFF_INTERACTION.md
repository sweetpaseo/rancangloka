# HERMES-MC-5: Direct Staff Interaction & Safe Operator Command Queue

## 1. Executive Summary & Mission
Milestone `HERMES-MC-5` implements conversational operator interaction with named Mission Control staff while strictly preserving canonical Hermes authority and system safety boundaries.

Human-facing staff personas (**Joko**, **Irwan**, **Rina**, **Budi**, **Sari**, and **Dimas**) serve purely as presentation identities. They are **not** autonomous daemons, do **not** possess shell access, and cannot execute arbitrary code or SQL. Every operator interaction flows through structured intent normalization, capability boundaries, authority verification, and an auditable Operator Command Queue linked directly to canonical Hermes task routing.

---

## 2. Invariants & Safety Guarantees

1. **Presentation Personas Only:** Human staff names map directly to canonical machine agent IDs (`content_writer_primary`, `evidence_researcher_lead`, `editorial_qa_primary`, `lokamedia_worker_primary`, `publication_dispatcher_core`, `telemetry_observer_jev`). Renaming a presentation persona never modifies underlying routing or security boundaries.
2. **Zero Arbitrary Execution:** Free-form operator text is treated as untrusted input. It is never interpolated into raw SQL, shell commands, or arbitrary MCP tools.
3. **Fail-Closed on Uncertainty:** If an entity reference is ambiguous or unresolvable, if a command falls outside the staff capability allowlist, or if an action requires elevated authority, the command is blocked or rejected immediately with an explanatory prompt.
4. **Authority Escalation Prevention:**
   - `READ_ONLY`: Safe queries run immediately against read-models with zero mutations.
   - `OPERATOR_COMMAND`: Allowlisted domain commands enter the structured command queue for canonical execution.
   - `ADMIN_CONTROL`: System control actions (enabling media worker, resetting circuit breakers, changing automation mode) are blocked with `ADMIN_APPROVAL_REQUIRED`.
   - `DANGEROUS_PRODUCTION_ACTION`: Production mutations (direct article publish, credential changes) are strictly forbidden (`DANGEROUS_ACTION_FORBIDDEN`).
5. **No Theatrical Realism / No Fake Typing:** No simulated typing delays, artificial "thinking..." loops, or fake read receipts. Operational truth is reflected strictly from actual job lifecycle states (`QUEUED`, `RUNNING`, `COMPLETED`, `FAILED`, `BLOCKED`, `REJECTED`).
6. **No Production Operational Mutations:** Development and tests are executed locally. Migration `0024_mission_control_chat_and_commands.sql` is prepared without running unapproved production DDL mutations.

---

## 3. Data & Conversation Model

The conversation and command persistence layer is backed by Cloudflare D1 tables (`db/migrations/0024_mission_control_chat_and_commands.sql`) with seamless in-memory fallback for local mock environments:

### `mission_control_conversations`
- `conversation_id` (`TEXT PRIMARY KEY`): Unique conversation identifier (e.g. `conv_content_writer_primary`).
- `staff_agent_id` (`TEXT NOT NULL`): Foreign key to the canonical machine agent.
- `created_by` (`TEXT NOT NULL`): Operator identifier.
- `status` (`TEXT NOT NULL`): `ACTIVE` or `ARCHIVED`.
- `created_at` / `updated_at` (`TEXT NOT NULL`).

### `mission_control_messages`
- `message_id` (`TEXT PRIMARY KEY`): Unique message ID.
- `conversation_id` (`TEXT NOT NULL`): Parent thread identifier.
- `sender_type` (`TEXT NOT NULL`): `OPERATOR`, `STAFF`, or `SYSTEM`.
- `sender_id` (`TEXT NOT NULL`): Agent ID or operator name.
- `message_type` (`TEXT NOT NULL`): `TEXT`, `COMMAND_REQUEST`, `COMMAND_STATUS`, `TASK_RESULT`, `SYSTEM_NOTICE`, or `ERROR`.
- `content` (`TEXT NOT NULL`): Message body text with secret redaction.
- `related_command_id` (`TEXT`): Pointer to associated operator command.
- `related_task_id` (`TEXT`): Pointer to canonical pipeline task/job.
- `created_at` (`TEXT NOT NULL`).

### `mission_control_commands`
- `command_id` (`TEXT PRIMARY KEY`): Unique queued command ID.
- `conversation_id` (`TEXT NOT NULL`): Originating conversation.
- `target_agent_id` (`TEXT NOT NULL`): Assigned machine agent.
- `target_department_id` (`TEXT NOT NULL`): Department owning execution.
- `operator_message` (`TEXT NOT NULL`): Sanitized raw input.
- `normalized_intent` (`TEXT NOT NULL`): Parsed structured intent.
- `command_type` (`TEXT NOT NULL`): Canonical command from allowlist.
- `parameters` (`TEXT NOT NULL`): JSON-encoded structured parameters.
- `status` (`TEXT NOT NULL`): `QUEUED`, `ACCEPTED`, `RUNNING`, `COMPLETED`, `REJECTED`, `BLOCKED`, `FAILED`, `CANCELLED`.
- `authority_level` (`TEXT NOT NULL`): `READ_ONLY`, `OPERATOR_COMMAND`, `ADMIN_CONTROL`, `DANGEROUS_PRODUCTION_ACTION`.
- `result_summary` (`TEXT`): Structured output from task execution.
- `task_reference` (`TEXT`): Canonical task ID or receipt token.
- `error_class` (`TEXT`): Standardized error category.
- `created_at`, `accepted_at`, `started_at`, `completed_at`, `failed_at` (`TEXT`).

---

## 4. Staff Capabilities & Command Allowlist

| Staff Identity | Machine Agent ID | Department | Allowed Command Types | Authority Level |
|---|---|---|---|---|
| **Joko** | `content_writer_primary` | Editorial | `ARTICLE_DRAFT_REQUEST`<br>`ARTICLE_REWRITE_REQUEST`<br>`ARTICLE_STRUCTURE_REVIEW`<br>`EDITORIAL_COPY_REVIEW` | `OPERATOR_COMMAND` |
| **Irwan** | `evidence_researcher_lead` | Research | `EVIDENCE_RESEARCH_REQUEST`<br>`SOURCE_REVIEW_REQUEST`<br>`CITATION_CHECK_REQUEST`<br>`EVIDENCE_GAP_ANALYSIS` | `OPERATOR_COMMAND` |
| **Rina** | `editorial_qa_primary` | Editorial | `EDITORIAL_QA_REQUEST`<br>`REVIEW_READINESS_CHECK`<br>`ARTICLE_VALIDATION_REQUEST` | `OPERATOR_COMMAND` |
| **Budi** | `lokamedia_worker_primary` | Media | `MEDIA_STATUS_QUERY`<br>`MEDIA_DIAGNOSTIC_REQUEST`<br>`MEDIA_TASK_REVIEW` | `READ_ONLY` |
| **Sari** | `publication_dispatcher_core` | Publication | `PUBLICATION_STATUS_QUERY`<br>`PUBLICATION_PLAN_REVIEW`<br>`SCHEDULER_DIAGNOSTIC` | `READ_ONLY` |
| **Dimas** | `telemetry_observer_jev` | Engineering | `SYSTEM_HEALTH_QUERY`<br>`JEV_OBSERVATION_REVIEW`<br>`TELEMETRY_DIAGNOSTIC`<br>`CIRCUIT_BREAKER_STATUS_QUERY` | `READ_ONLY` |
| **All Staff** | (Any) | (Any) | `CURRENT_TASK_QUERY`<br>`ACTIVITY_SUMMARY_QUERY` | `READ_ONLY` |

---

## 5. Intent Normalization & Entity Resolution

Operator text is normalized through a deterministic parser (`normalizeOperatorIntent`):
1. **Sanitization:** Input is stripped of control characters and dangerous SQL/shell patterns.
2. **Authority Screening:** Keywords attempting administrative escalations (`publish`, `terbitkan`, `aktifkan worker`, `enable worker`, `kill switch`, `circuit breaker`) are caught immediately and rejected before command generation.
3. **Entity Resolution (`resolveEntityReference`):**
   - Explicit article IDs (e.g. `Article 8`, `#5`) or verified slugs/titles resolve deterministically.
   - Ambiguous phrases (`tadi`, `terakhir`, `barusan`, `artikel itu`, `draf yang tadi`) trigger `AMBIGUOUS_ENTITY_REFERENCE`. The system rejects automated assumption and returns a clarification prompt in-thread.
4. **Capability Matching:** If an agent receives a command outside their registered capabilities (e.g., Dimas asked to draft an article), it returns `CAPABILITY_MISMATCH` fail-closed.

---

## 6. User Interface & Pixel Office Integration

- **Dedicated Staff Chat Interface:** Available at `/admin/mission-control/staff/[agent_id]/chat`.
  - Displays real-time operational status (IDLE, WORKING, REVIEWING, BLOCKED, OFFLINE).
  - Renders chronological message stream with distinct visual cards for Command Requests, Queued Status, Running State, Completed Results, and Clarification Notices.
  - Form validation with submit disablement during network requests and automatic input reset.
- **Pixel Office Integration:** The spatial office inspector modal (`/admin/mission-control/office`) includes a direct action button: `💬 Percakapan & Tugas ([Nama])` linking to `/admin/mission-control/staff/[agent_id]/chat`.
- **Staff Registry Integration:** The staff detail panel (`/admin/mission-control/staff`) features a direct `💬 Buka Percakapan Langsung` button.

---

## 7. Auditability & Telemetry

- All commands, transitions, and responses redact sensitive tokens (API keys, session cookies, passwords) via `redactSensitiveString`.
- Responses clearly state whether a message is an immediate informational query, a queued command, a running task, or a completion summary.
- The command lifecycle (`QUEUED` → `ACCEPTED` → `RUNNING` → `COMPLETED` / `FAILED` / `BLOCKED`) maintains explicit timestamps and references to canonical pipeline tasks.

---

## 8. Limitations & Preparation for MC-6

- **Cross-Staff Collaboration:** MC-5 provides direct 1:1 interaction threads between the operator and individual staff members. Multi-staff group discussions and automated inter-staff handoffs will be introduced in subsequent milestones.
- **External Hermes Dispatcher:** In local development, the executor simulates canonical Hermes task progression deterministically. Production integration with remote container daemons will hook into the Hermes Outbox and task bridge.
