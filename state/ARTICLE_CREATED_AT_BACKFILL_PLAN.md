# ARTICLE_CREATED_AT_BACKFILL_PLAN

This patch does not execute a historical backfill. Existing `articles.created_at`
values may remain `NULL` because the original creation time was not previously
stored on the article row.

## Possible Timestamp Sources

### article_ingest_receipts.created_at

Coverage: Articles created through Hermes ingestion where a receipt row exists
and links deterministically by `article_ingest_receipts.article_id`.

Semantics: Time the ingestion receipt was written, which should be close to the
article row creation event for atomic Hermes inserts.

Confidence: High when `article_id` exists and exactly one receipt maps to the
article. Lower for articles imported before receipts existed.

Deterministic linkage: Yes, by `article_id`.

### Hermes/local ACK receipts

Coverage: Articles produced by local or canonical Hermes workflows with saved
acknowledgement metadata.

Semantics: Time the workflow acknowledged delivery, not necessarily the exact D1
row insertion time.

Confidence: Medium when the ACK contains article ID or stable content hash.

Deterministic linkage: Depends on stored `article_id`, `job_id`, or exact
content hash.

### publication_execution_receipts.actual_published_at

Coverage: Articles published through the publication system.

Semantics: Publication time, not creation time.

Confidence: High for publication timing; low as a creation-time source.

Deterministic linkage: Yes, by `article_id`, but unsuitable for direct
`created_at` backfill unless no better source exists and the record was created
at publish time.

### article_publication_executions.created_at

Coverage: Articles that entered the publication planner/execution flow.

Semantics: Publication execution planning/run creation time, not article row
creation time.

Confidence: Low for article creation.

Deterministic linkage: Yes, by `article_id`.

### Import Markdown flow

Coverage: Articles created through `/api/admin/import-md` or import scripts.

Semantics: Current runtime only persisted `published_at`/`updated_at`; older
imports may need external logs or receipts to distinguish creation from publish.

Confidence: Unknown without a separate audit trail.

Deterministic linkage: Possible through slug/content hash/import response logs
if retained.

## Recommendation

Backfill only where a deterministic, article-specific source exists. Leave
remaining legacy rows as `NULL` and display "Belum diketahui" in admin surfaces.
