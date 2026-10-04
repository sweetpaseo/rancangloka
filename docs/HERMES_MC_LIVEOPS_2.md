# 📋 Hermes Mission Control — Live Operator Interactivity & Inspection Overlays (MC-LIVEOPS-2)

> **Status:** COMPLETED & VERIFIED  
> **Milestone:** `MC-LIVEOPS-2`  
> **Safety Invariants:** Read-Only Observability • Zero Mutation Authority • Strict Fail-Closed  
> **Repository:** `rancangloka-astro/`  
> **Reference File:** [live-operations.ts](file:///c:/Users/Fanto/Desktop/antigravity/rancangloka/rancangloka-astro/src/lib/mission-control/live-operations.ts), [office.astro](file:///c:/Users/Fanto/Desktop/antigravity/rancangloka/rancangloka-astro/src/pages/admin/mission-control/office.astro)

---

## 1. Executive Summary

Milestone **MC-LIVEOPS-2** introduces rich contextual operator inspection directly over the Pixel Office workspace and staff sprites. It bridges visual representation (sprites, animations, workstations) directly to canonical backing operational truth without introducing mutation authority, write permissions, or execution triggers.

When an operator clicks on any staff member or workstation in Pixel Office, the Inspector modal now displays:
1. **Real Backing Operational State:** Verified operational state (`WORKING`, `REVIEWING`, `WAITING`, `BLOCKED`, `OFFLINE`, `IDLE`).
2. **Backing Task Provenance:** Canonical Task ID, title, current stage, execution capability, start/update timestamps, and deterministic evidence reference.
3. **Safe Read-Only Deep Links:** Deterministic navigation links to existing internal admin pages:
   - Edit / Draft Post: `/admin/posts/[id]`
   - Public Draft Preview: `/admin/preview/[slug]`
   - Canonical Job Trace: Modal trigger `#job-trace-modal` via `[data-open-job-trace="[task_id]"]`
   - Publication Operations: `/admin/publication/operations`
   - Alert Center: `/admin/mission-control/alerts`
   - Staff Registry & Chat: `/admin/mission-control/staff` & `/admin/mission-control/staff/[agentId]/chat`
4. **Diagnostic & Blocker Visibility:** High-contrast callout for open anomalies, circuit breaker trips, or First Article Gate validation failures with specific root causes.
5. **Persona Safety Constraints:** Explicit enforcement that:
   - **Jefry (TypeSafe JEV):** Exclusively advisory (`SHADOW ADVISORY`) with **0 Otoritas Eksekusi**.
   - **Budi (Media Operations):** Strictly **OFFLINE / DISABLED** while media worker is disabled by policy.
   - **Sari (Publication Operations):** Scheduled tasks wait in Lounge with **AUTO_PUBLISH = OFF**, explicitly preventing autonomous release.

---

## 2. Architecture & Data Model

### A. Extended `LiveTaskProvenance`
The canonical task provenance model in `src/lib/mission-control/live-operations.ts` has been extended to include verified article context:

```typescript
export interface LiveTaskProvenance {
  task_id: string;
  task_title: string;
  stage: string;
  status: string;
  department_id: string;
  responsible_agent_id: string;
  capability_id: string | null;
  started_at: string | null;
  last_updated_at: string | null;
  evidence_source: string;
  evidence_id: string;
  blocking_condition: string | null;
  related_article_id?: number | null;
  slug?: string | null;
  approval_state?: string | null;
  receipt_id?: string | null;
}
```

### B. Deterministic Field Mapping
The mapping helper `taskCardToProvenance` deterministically maps observable D1 article task data without heuristic guessing:
- `related_article_id` is populated directly from `task.relatedArticleId`.
- `slug` is populated from `task.slug`.
- `approval_state` is set to `'APPROVED'` if `task.approvalEvidence` is verified.
- `receipt_id` is linked to D1 Ingestion receipt when matching the current task ID.

### C. Client Inspector Layer (`office.astro`)
The existing `#inspect-modal` was enhanced to render a modern, accessible, zero-mutation card layout:
- **No Form Submissions or Mutation Buttons:** There are no "Retry", "Approve", "Publish", "Override", or "Restart" buttons.
- **Fail-Closed on Idle:** When a staff member is idle in Lounge, the inspector explicitly states: *"Tidak ada tugas pipeline aktif yang diemban. Personel siaga di Lounge untuk mencegah beban kerja fiktif (Zero fake workload)."*
- **Validated Deep Links Only:** Deep links are rendered conditionally only when genuine backing IDs (`related_article_id` or `slug`) exist in the canonical task provenance.

---

## 3. Supported Safe Deep Links

| Link Target | Route Pattern | Availability Condition | Purpose |
| :--- | :--- | :--- | :--- |
| **Article Edit / Detail** | `/admin/posts/[id]` | `task.related_article_id` is present | Direct view of the article draft in admin panel |
| **Public Draft Preview** | `/admin/preview/[slug]` | `task.slug` is present | Read-only preview of article formatting |
| **Canonical Job Trace** | In-page modal (`[data-open-job-trace]`) | `task.task_id` is present | Timeline of all historical handoffs and state transitions |
| **Publication Operations** | `/admin/publication/operations` | Sari (`publication_dispatcher_core`) | View scheduled queue and manual publication controls |
| **Alert Center** | `/admin/mission-control/alerts` | Active anomaly present | Review open system anomalies and telemetry incidents |
| **Staff Registry** | `/admin/mission-control/staff?staff=[id]` | Always | View staff machine specifications & capability matrix |
| **Direct Chat** | `/admin/mission-control/staff/[id]/chat` | Always | Send operator queries or view command queue |

---

## 4. Safety Verification & Non-Negotiable Invariants

All core safety invariants remain unaltered and actively verified:
1. `automation_mode = OFF`: No automated publication dispatch without human operator approval.
2. `SOCIAL_AUTOMATION = OFF`: Social department remains in unstaffed holding.
3. `publishing_authority = 0`: Zero automated publication rights given to AI models or daemons.
4. `JEV_MODE = shadow`: TypeSafe JEV runs strictly in shadow evaluation mode.
5. `media_worker = DISABLED`: LokaMedia Studio Worker remains disabled; Budi is strictly OFFLINE.
6. `Jefry execution authority = 0`: Advisory only; zero command execution affordances.

---

## 5. Test Suite & Validation

The implementation is verified by `scripts/test-mission-control-liveops-2.js` and all existing regression suites:

```bash
# 1. Typecheck & Build
npx tsc --noEmit                                   # 0 errors
npm run build                                      # 0 errors

# 2. Live Operations Suites
node scripts/test-mission-control-liveops-2.js     # 10/10 PASS
node scripts/test-mission-control-liveops.js       # 78/78 PASS

# 3. Mission Control Regression Suites
node scripts/test-staff-registry.js                # 16/16 PASS
node scripts/test-mission-control-departments.js   # 18/18 PASS
node scripts/test-mission-control-expansion.js     # 12/12 PASS
node scripts/test-mission-control-pixel-office.js   # 20/20 PASS
node scripts/test-mission-control-job-animation.js # 21/21 PASS
node scripts/test-mission-control-chat.js          # 20/20 PASS
node scripts/test-pixel-office-movement.js         # 33/33 PASS
node scripts/test-pixel-office-handoff.js          # 26/26 PASS
node scripts/test-pixel-office-job-trace.js        # 24/24 PASS
node scripts/test-soak-safety.js                   # 54/54 PASS
```
