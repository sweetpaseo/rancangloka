# 🛠️ RancangLoka Engineering Standard Operating Procedure (SOP)
## Systematic Debugging & Root Cause Investigation Protocol

> **STATUS:** CANONICAL ENGINEERING SOP
> **OWNER:** Dimas (`telemetry_observer_jev`) — Telemetry & JEV Systems Operator
> **DEPARTMENT:** Engineering & Telemetry (`engineering_telemetry`)
> **AUTHORITY:** Strictly Observational & Diagnostic (`publishingAuthority = 0`, Zero Publication Authority)
> **INVARIANT:** **NO FIX BEFORE ROOT CAUSE INVESTIGATION**

---

## 1. Overview & Core Philosophy

Speculative patching, symptom-masking, and guessing under pressure waste time and introduce cascading regressions.
In RancangLoka and Hermes, all engineering troubleshooting for Worker runtime stalls, Cloudflare D1 discrepancies, SSR failures, Mission Control anomalies, LokaMedia runtime errors, and deployment regressions must strictly follow this **4-Phase Systematic Debugging Protocol**.

```
┌────────────────────────────────────────────────────────────────────────┐
│                               THE IRON LAW                             │
│               NO FIX BEFORE ROOT CAUSE INVESTIGATION FIRST             │
└────────────────────────────────────────────────────────────────────────┘
```

Any code mutation attempted prior to completing Phase 1 and establishing a deterministic feedback loop is a direct violation of engineering invariants.

---

## 2. The Four Canonical Phases

### Phase 1: Reproduce / Root Cause Investigation
1. **Read Error Messages Completely:** Do not skip stack traces, line numbers, error classes, or HTTP status codes.
2. **Build a Tight Feedback Loop:** Construct a deterministic, single-command reproduction (e.g. failing test case, standalone reproduction script, curl command, or trace replay). The reproduction must fail on the symptom and turn green only when the true root cause is eliminated.
3. **Gather Evidence Across System Boundaries:** For edge runtime, D1, or queue issues, inspect what data enters and exits the component boundary without guessing.
4. **Inspect Recent Changes:** Check `git log -10 --oneline` and uncommitted working tree diffs.

### Phase 2: Pattern Analysis
1. Trace the execution path and data flow backwards from the failure site to where the invalid state was first created.
2. Categorize the failure mode: schema drift, race condition, clock skew, null dereference, unhandled network rejection, or configuration divergence.
3. Formulate candidate root causes based on concrete telemetry evidence, not speculation.

### Phase 3: Hypothesis + Minimal Test
1. Select the most probable candidate cause and state a falsifiable hypothesis.
2. Run a minimal experiment or targeted test assertion to prove or disprove the hypothesis.
3. If the test disproves the hypothesis, return to Phase 2. Do not proceed to code patching.

### Phase 4: Targeted Fix + Verification
1. Implement the minimal, non-speculative fix addressing the confirmed root cause.
2. Run the tight reproduction loop created in Phase 1 to verify that the failure is resolved.
3. Run the full regression test suite (`node scripts/...`, `npx tsc --noEmit`, `npm run build`).
4. Document the completed investigation record.

---

## 3. Investigation Record Artifact Schema

When Dimas detects or receives an anomaly (Worker stall, D1 error, Mission Control anomaly, etc.), he generates a structured investigation record:

```typescript
export interface SystematicInvestigationRecord {
  investigation_id: string;               // Unique deterministic identifier (e.g., INV-ANOM-20261013-001)
  anomaly_id?: string | null;             // Related Mission Control anomaly ID
  created_at: string;                     // ISO timestamp
  updated_at: string;                     // ISO timestamp
  investigator_agent_id: string;          // Strictly 'telemetry_observer_jev' (Dimas)
  subsystem: string;                      // Subsystem name ('engineering', 'media', 'publication', 'editorial')
  problem: string;                        // Clear description of observed symptom
  reproduction: {
    command_or_script: string;            // Exact command executed
    is_deterministic: boolean;            // Whether symptom repros 100% deterministically
    failure_observed: string;             // Exact error message / exit code observed
  };
  observed_evidence: string[];            // Log excerpts, stack traces, telemetry points
  candidate_cause: string;                // Hypothesized root cause
  tested_hypothesis: {
    test_description: string;             // Minimal test performed
    result: 'CONFIRMED' | 'DISPROVED';    // Outcome
    notes: string;
  };
  confirmed_root_cause: string | null;    // Proved root cause (null if still investigating)
  minimal_fix: {
    target_files: string[];               // Files to modify
    rationale: string;                    // Why this fix is minimal and sufficient
    status: 'NOT_STARTED' | 'PROPOSED' | 'IMPLEMENTED' | 'VERIFIED';
  };
  regression_verification: {
    repro_passed: boolean;                // Whether the Phase 1 repro now exits 0 / passes
    typecheck_passed: boolean;            // npx tsc --noEmit exit code
    build_passed: boolean;                // npm run build result
    suites_verified: string[];            // List of regression script names executed
  };
  status: 'ROOT_CAUSE_INVESTIGATION' | 'HYPOTHESIS_TESTING' | 'FIX_VERIFICATION' | 'RESOLVED';
  publishing_authority: 0;                // Invariant: ALWAYS 0 (Dimas cannot publish)
}
```

---

## 4. Role Separation & Handoff Protocols

1. **Dimas Ownership:** Dimas monitors system telemetry, detects anomalies, conducts root-cause investigations, and drafts the structured investigation record.
2. **Zero Direct Publication:** Dimas has `publishingAuthority = 0`. Diagnostic tasks must never grant autonomous production publishing or automated deploy rights.
3. **Engineering Handoff:**
   - Dimas creates the investigation record and sets status to `ROOT_CAUSE_INVESTIGATION` or `HYPOTHESIS_TESTING`.
   - Once the root cause is confirmed, the minimal fix proposal is handed off to the developer agent or operator for code editing.
   - Post-implementation, Dimas executes the verification protocol to transition status to `RESOLVED`.
