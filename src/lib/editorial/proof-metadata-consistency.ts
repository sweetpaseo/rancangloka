/**
 * RancangLoka Editorial Proof Metadata Consistency Invariant
 * Milestone: EDITORIAL-EVIDENCE-GROUNDING-HARDENING-1
 *
 * Enforces:
 * 1. PROOF_CLASSIFICATION_INCONSISTENCY:
 *    meta.primary_classification, manifest.final_machine_classification, and final report classification must agree.
 * 2. NO FALSE POSITIVE LEAK DETECTION:
 *    A prompt leak must derive strictly from detected_static_domain_leaks or active content leakage,
 *    NOT from the fact that an audit artifact or test file contains the dictionary of search terms.
 */

export interface ProofMetadataInput {
  meta?: {
    primary_classification?: string;
    stage_reached?: string;
    blocked_at?: string | null;
  };
  manifest?: {
    final_machine_classification?: string;
    status?: string;
  };
  reportClassification?: string;
  promptLeakAudit?: {
    passed?: boolean;
    detected_static_domain_leaks?: Array<{ file: string; term: string }>;
    static_prompt_domain_terms?: string[];
  };
  activeContentFiles?: Record<string, string>; // filename -> content
}

export interface ProofConsistencyResult {
  passed: boolean;
  agreed_classification: string;
  detected_leaks: Array<{ file: string; term: string }>;
  errors: string[];
}

export const FORBIDDEN_HISTORICAL_DOMAIN_TERMS = [
  'radiant barrier',
  'doe radiant barrier',
  'metal roof',
  'atap metal',
  'insulasi foil',
  'aluminium foil',
  'ventilasi atap',
  'ventilasi loteng',
  'rongga atap',
  'karat atap',
  'kondensasi atap',
  'clm-001a',
  'clm-001b',
  'clm-004a',
  'clm-004b',
  'clm-007a'
];

/**
 * Scans active content files for domain leaks, deliberately excluding audit/dictionary files.
 */
export function scanActiveContentForLeaks(
  files: Record<string, string>,
  forbiddenTerms: string[] = FORBIDDEN_HISTORICAL_DOMAIN_TERMS
): Array<{ file: string; term: string }> {
  const leaks: Array<{ file: string; term: string }> = [];

  for (const [filename, content] of Object.entries(files)) {
    // CRITICAL: Exclude files that define or store the audit dictionary of terms
    if (
      /prompt-leak-audit|leak-audit|audit-dictionary|test-joko-prompt|proof-metadata/i.test(filename)
    ) {
      continue;
    }

    const lower = (content || '').toLowerCase();
    for (const term of forbiddenTerms) {
      if (lower.includes(term.toLowerCase())) {
        leaks.push({ file: filename, term });
      }
    }
  }

  return leaks;
}

/**
 * Validates consistency between metadata, manifest, and report classifications.
 */
export function validateProofMetadataConsistency(
  input: ProofMetadataInput
): ProofConsistencyResult {
  const errors: string[] = [];

  const metaClass = input.meta?.primary_classification;
  const manifestClass = input.manifest?.final_machine_classification;
  const reportClass = input.reportClassification;

  // 1. Check prompt leak audit integrity
  const detectedLeaks: Array<{ file: string; term: string }> = [];
  if (Array.isArray(input.promptLeakAudit?.detected_static_domain_leaks)) {
    detectedLeaks.push(...input.promptLeakAudit.detected_static_domain_leaks);
  }

  if (input.activeContentFiles) {
    const activeLeaks = scanActiveContentForLeaks(input.activeContentFiles);
    for (const al of activeLeaks) {
      if (!detectedLeaks.some(d => d.file === al.file && d.term === al.term)) {
        detectedLeaks.push(al);
      }
    }
  }

  // 2. Classifications must agree
  const classifications = [
    { source: 'meta.primary_classification', value: metaClass },
    { source: 'manifest.final_machine_classification', value: manifestClass },
    { source: 'reportClassification', value: reportClass }
  ].filter(c => Boolean(c.value));

  if (classifications.length >= 2) {
    const firstVal = classifications[0].value;
    for (let i = 1; i < classifications.length; i++) {
      if (classifications[i].value !== firstVal) {
        errors.push(
          `PROOF_CLASSIFICATION_INCONSISTENCY: Ketidaksesuaian klasifikasi antara '${classifications[0].source}' (${firstVal}) dan '${classifications[i].source}' (${classifications[i].value}).`
        );
      }
    }
  }

  const agreed_classification = metaClass || manifestClass || reportClass || 'UNKNOWN';

  return {
    passed: errors.length === 0 && detectedLeaks.length === 0,
    agreed_classification,
    detected_leaks: detectedLeaks,
    errors
  };
}
