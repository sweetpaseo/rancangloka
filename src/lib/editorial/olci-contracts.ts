/**
 * RancangLoka — Organizational Learning & Continuous Improvement (OLCI) Data Contracts
 * File: src/lib/editorial/olci-contracts.ts
 *
 * Implements Section 5.2, Section 8, and Section 10 of RANCANGLOKA_OLCI_IMPLEMENTATION_BLUEPRINT.md
 * 
 * Strict Invariants:
 * 1. Knowledge-rich, instruction-light: Capture experience, context, and lessons, not endless rules.
 * 2. Immutable audit provenance: Keep source timestamps, staff role IDs, and article references.
 * 3. Minimal state & idempotency: Avoid duplicate records, support supersession.
 * 4. Cross-platform path safety: Zero path traversal.
 */

export type OlciExperienceKind = 
  | 'observation' 
  | 'problem' 
  | 'success' 
  | 'feedback' 
  | 'reflection' 
  | 'knowledge' 
  | 'collaboration';

export type OlciValidationStatus = 
  | 'observed' 
  | 'proposed' 
  | 'tested' 
  | 'verified' 
  | 'superseded';

export interface OlciCostTelemetry {
  prompt_tokens?: number;
  completion_tokens?: number;
  total_tokens?: number;
  cost_usd?: number;
  image_units?: number;
  duration_ms?: number;
  retry_count?: number;
  efficiency_note?: string;
}

export interface OlciExperienceRecord {
  experience_id: string;        // e.g. "EXP-BUDI-10030-01"
  staff_id: string;             // e.g. "media_director_primary" (Budi)
  article_ref: string;          // e.g. "10030"
  version_ref?: string;         // e.g. "v1_draft_snapshot"
  observed_at: string;          // ISO timestamp
  kind: OlciExperienceKind;
  observation: string;
  evidence_refs?: string[];
  context?: string;
  hypothesis?: string;
  action?: string;
  outcome?: string;
  lesson?: string;
  validation: OlciValidationStatus;
  related_experiences?: string[];
  supersedes?: string;
  cost_telemetry?: OlciCostTelemetry;
}

export type OlciProposalCategory = 
  | 'editorial_quality' 
  | 'tools' 
  | 'process_improvement' 
  | 'knowledge' 
  | 'cost_efficiency' 
  | 'website_feature';

export type OlciProposalStatus = 
  | 'submitted' 
  | 'under_review' 
  | 'reviewing' 
  | 'needs_evidence' 
  | 'decision' 
  | 'execution' 
  | 'evaluation' 
  | 'learning' 
  | 'approved' 
  | 'deferred' 
  | 'rejected' 
  | 'withdrawn' 
  | 'implementing' 
  | 'validated_closed';

export interface OlciInnovationProposal {
  proposal_id: string;          // e.g. "PROP-2026-11-001"
  proposer_role: string;        // e.g. "media_director_primary"
  submitted_at: string;         // ISO timestamp
  category: OlciProposalCategory;
  title: string;
  problem_or_opportunity: string;
  evidence_refs: string[];
  proposed_solution: string;
  alternatives_considered?: string[];
  expected_benefit: string;
  estimated_cost_or_risk: string;
  success_metrics: string;
  status: OlciProposalStatus;
  decision_reason?: string;
  lifecycle_stage?: string;
  review_notes?: string;
  decided_by?: string;          // 'coordinator_primary' | 'owner'
  decided_at?: string;
}

export interface OlciCollaborationMessage {
  message_id: string;
  sender_role: string;
  timestamp: string;
  content: string;
  evidence_refs?: string[];
}

export interface OlciCollaborationThread {
  thread_id: string;            // e.g. "COLLAB-10030-BUDI-IRWAN"
  initiated_by: string;         // e.g. "media_director_primary"
  participants: string[];       // e.g. ["media_director_primary", "researcher_primary"]
  trigger_event: string;        // e.g. "Owner feedback on Article #10030 visual realism"
  article_ref: string;          // e.g. "10030"
  created_at: string;
  status: 'open' | 'concluded';
  messages: OlciCollaborationMessage[];
  conclusion?: {
    summary: string;
    action_items: string[];
    agreed_lessons: string[];
    concluded_at: string;
  };
}

/**
 * Format an OlciExperienceRecord as Markdown with YAML frontmatter.
 */
export function formatExperienceAsMarkdown(record: OlciExperienceRecord): string {
  const frontmatter = [
    '---',
    `experience_id: "${record.experience_id}"`,
    `staff_id: "${record.staff_id}"`,
    `article_ref: "${record.article_ref}"`,
    record.version_ref ? `version_ref: "${record.version_ref}"` : null,
    `observed_at: "${record.observed_at}"`,
    `kind: "${record.kind}"`,
    `validation: "${record.validation}"`,
    record.supersedes ? `supersedes: "${record.supersedes}"` : null,
    record.related_experiences && record.related_experiences.length > 0
      ? `related_experiences:\n${record.related_experiences.map(id => `  - "${id}"`).join('\n')}`
      : null,
    record.evidence_refs && record.evidence_refs.length > 0
      ? `evidence_refs:\n${record.evidence_refs.map(r => `  - "${r}"`).join('\n')}`
      : null,
    '---'
  ].filter(Boolean).join('\n');

  const body = [
    `# Experience: ${record.experience_id} (${record.kind.toUpperCase()})`,
    '',
    `**Staff Role:** \`${record.staff_id}\`  `,
    `**Article Reference:** \`${record.article_ref}\`  `,
    `**Observed At:** ${record.observed_at}  `,
    `**Validation Status:** \`${record.validation}\`  `,
    '',
    '## 1. Observation',
    record.observation,
    '',
    record.context ? ['## 2. Context & Conditions', record.context, ''].join('\n') : null,
    record.hypothesis ? ['## 3. Hypothesis & Root Cause', record.hypothesis, ''].join('\n') : null,
    record.action ? ['## 4. Action / Solution Tested', record.action, ''].join('\n') : null,
    record.outcome ? ['## 5. Outcome & Results', record.outcome, ''].join('\n') : null,
    record.lesson ? ['## 6. Durable Lesson Learned', record.lesson, ''].join('\n') : null
  ].filter(Boolean).join('\n');

  return `${frontmatter}\n\n${body}\n`;
}

/**
 * Format an OlciInnovationProposal as Markdown with YAML frontmatter.
 */
export function formatProposalAsMarkdown(proposal: OlciInnovationProposal): string {
  const frontmatter = [
    '---',
    `proposal_id: "${proposal.proposal_id}"`,
    `proposer_role: "${proposal.proposer_role}"`,
    `submitted_at: "${proposal.submitted_at}"`,
    `category: "${proposal.category}"`,
    `status: "${proposal.status}"`,
    proposal.decided_by ? `decided_by: "${proposal.decided_by}"` : null,
    proposal.decided_at ? `decided_at: "${proposal.decided_at}"` : null,
    proposal.evidence_refs && proposal.evidence_refs.length > 0
      ? `evidence_refs:\n${proposal.evidence_refs.map(r => `  - "${r}"`).join('\n')}`
      : null,
    '---'
  ].filter(Boolean).join('\n');

  const body = [
    `# Innovation Proposal: ${proposal.title}`,
    '',
    `**Proposal ID:** \`${proposal.proposal_id}\`  `,
    `**Proposer:** \`${proposal.proposer_role}\`  `,
    `**Category:** \`${proposal.category}\`  `,
    `**Status:** \`${proposal.status}\`  `,
    `**Submitted At:** ${proposal.submitted_at}  `,
    '',
    '## 1. Problem or Opportunity',
    proposal.problem_or_opportunity,
    '',
    '## 2. Proposed Solution',
    proposal.proposed_solution,
    '',
    proposal.alternatives_considered && proposal.alternatives_considered.length > 0
      ? [
          '## 3. Alternatives Considered',
          proposal.alternatives_considered.map(a => `- ${a}`).join('\n'),
          ''
        ].join('\n')
      : null,
    '## 4. Expected Benefit',
    proposal.expected_benefit,
    '',
    '## 5. Estimated Cost, Risk & Dependencies',
    proposal.estimated_cost_or_risk,
    '',
    '## 6. Success Metrics',
    proposal.success_metrics,
    '',
    proposal.review_notes
      ? ['## 7. Review & Decision Notes', proposal.review_notes, ''].join('\n')
      : null
  ].filter(Boolean).join('\n');

  return `${frontmatter}\n\n${body}\n`;
}
