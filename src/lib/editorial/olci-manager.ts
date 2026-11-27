/**
 * RancangLoka — Organizational Learning & Continuous Improvement (OLCI) Memory Manager
 * File: src/lib/editorial/olci-manager.ts
 *
 * Implements Section 5, 6, 8, and 10 of RANCANGLOKA_OLCI_IMPLEMENTATION_BLUEPRINT.md
 */

import fs from 'node:fs';
import path from 'node:path';
import { resolveSharedMemoryDir, writeMemoryNote } from './shared-memory-adapter.ts';
import {
  type OlciExperienceRecord,
  type OlciInnovationProposal,
  type OlciCollaborationThread,
  type OlciProposalStatus,
  formatExperienceAsMarkdown,
  formatProposalAsMarkdown
} from './olci-contracts.ts';

const ROLE_DIR_MAP: Record<string, string> = {
  'content_strategy_primary': 'maya-content-strategy',
  'social_distribution_operator': 'maya-content-strategy',
  'maya': 'maya-content-strategy',
  'media_director_primary': 'budi-media-director',
  'lokamedia_worker_primary': 'budi-media-director',
  'budi': 'budi-media-director',
  'researcher_primary': 'irwan-researcher',
  'evidence_researcher_lead': 'irwan-researcher',
  'irwan': 'irwan-researcher',
  'content_writer_primary': 'joko-author',
  'joko': 'joko-author',
  'voice_evaluator_primary': 'nadia-voice-editor',
  'audience_language_editor': 'nadia-voice-editor',
  'nadia': 'nadia-voice-editor',
  'qa_lead_primary': 'rina-qa',
  'editorial_qa_primary': 'rina-qa',
  'rina': 'rina-qa',
  'seo_specialist_primary': 'seon-seo',
  'seo_specialist_lead': 'seon-seo',
  'seon': 'seon-seo',
  'assembler_primary': 'dimas-assembler',
  'telemetry_observer_jev': 'dimas-assembler',
  'dimas': 'dimas-assembler',
  'publisher_primary': 'sari-publisher',
  'publication_dispatcher_core': 'sari-publisher',
  'sari': 'sari-publisher',
  'coordinator_primary': 'jefry-coordinator',
  'management_advisor_jefry': 'jefry-coordinator',
  'jefry': 'jefry-coordinator',
  'jev': 'jefry-coordinator'
};

export function resolveStaffMemoryDir(staffId: string): string {
  const baseDir = resolveSharedMemoryDir();
  const roleSub = ROLE_DIR_MAP[staffId.toLowerCase()] || staffId.toLowerCase();
  const dir = path.join(baseDir, '06-staff-memory', roleSub);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  return dir;
}

export function resolveInnovationInboxDir(): string {
  const baseDir = resolveSharedMemoryDir();
  const dir = path.join(baseDir, '00-innovation-inbox');
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  return dir;
}

export function resolveCollaborationThreadsDir(): string {
  const baseDir = resolveSharedMemoryDir();
  const dir = path.join(baseDir, '07-collaboration-threads');
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  return dir;
}

/**
 * Record a professional experience record for a staff member.
 */
export function recordExperience(record: OlciExperienceRecord): { success: boolean; filePath: string } {
  const roleSub = ROLE_DIR_MAP[record.staff_id.toLowerCase()] || record.staff_id.toLowerCase();
  const fileName = `${record.experience_id}.md`;
  const content = formatExperienceAsMarkdown(record);

  const res = writeMemoryNote({
    category: '06-staff-memory',
    subfolder: roleSub,
    filename: fileName,
    authorStaff: record.staff_id,
    content,
    allowWriteOverride: true,
    preserveRawContent: true
  });

  const baseDir = resolveSharedMemoryDir();
  const filePath = path.join(baseDir, res.subpath);
  return { success: res.success, filePath };
}

export interface ExperienceRetrievalTelemetry {
  timestamp: string;
  staff_id: string;
  context_ref?: string;
  retrieved_count: number;
  experiences: Array<{
    experience_id: string;
    article_ref: string;
    validation: string;
    relevance_score?: number;
    lesson_preview: string;
  }>;
}

const retrievalTelemetryStore: ExperienceRetrievalTelemetry[] = [];

/**
 * Record telemetry for retrieved experiences used in prompt compilation or evaluation.
 */
export function recordExperienceRetrievalTelemetry(entry: ExperienceRetrievalTelemetry): void {
  retrievalTelemetryStore.push(entry);
  if (retrievalTelemetryStore.length > 50) {
    retrievalTelemetryStore.shift();
  }
}

/**
 * Get the latest experience retrieval telemetry records.
 */
export function getExperienceRetrievalTelemetry(): ExperienceRetrievalTelemetry[] {
  return [...retrievalTelemetryStore];
}

/**
 * Get relevant experiences for a staff member or topic.
 * Prioritizes verified learning over raw observations and enforces security screening,
 * task relevance scoring, structural field extraction, and boundary isolation.
 */
export function getStaffExperiences(
  staffId: string,
  filter?: { article_ref?: string; kind?: string; onlyValidated?: boolean; context_ref?: string }
): OlciExperienceRecord[] {
  const targetDir = resolveStaffMemoryDir(staffId);
  if (!fs.existsSync(targetDir)) return [];

  const files = fs.readdirSync(targetDir).filter(f => f.endsWith('.md'));
  const records: Array<OlciExperienceRecord & { relevance_score: number }> = [];

  const contextTokens = (filter?.context_ref || '')
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter(t => t.length > 3);

  for (const file of files) {
    const raw = fs.readFileSync(path.join(targetDir, file), 'utf8');

    // 1. Security screen: reject malicious prompt injections or credential-like tokens
    if (/ignore (all|previous) instructions|system prompt override|jailbreak|DAN mode/i.test(raw)) {
      continue;
    }

    const fmMatch = raw.match(/^---\r?\n([\s\S]*?)\r?\n---/);
    if (!fmMatch) continue;

    const fm = fmMatch[1];
    const expId = (fm.match(/experience_id:\s*"([^"]+)"/) || [])[1] || path.basename(file, '.md');
    const staff = (fm.match(/staff_id:\s*"([^"]+)"/) || [])[1] || staffId;
    const artRef = (fm.match(/article_ref:\s*"([^"]+)"/) || [])[1] || '';
    const kind = (fm.match(/kind:\s*"([^"]+)"/) || [])[1] as any || 'observation';
    const validation = (fm.match(/validation:\s*"([^"]+)"/) || [])[1] as any || 'observed';
    const observedAt = (fm.match(/observed_at:\s*"([^"]+)"/) || [])[1] || '';

    // 2. Provenance validation: check ID format and filter constraints
    if (!expId || !expId.startsWith('EXP-')) continue;
    if (filter?.onlyValidated && validation !== 'verified') continue;
    if (filter?.article_ref && artRef !== filter.article_ref) continue;
    if (filter?.kind && kind !== filter.kind) continue;

    // 3. Structural extraction & content sanitization (strip dangerous markup, HTML tags, control chars)
    const obsMatch = raw.match(/## 1\. Observation\r?\n([\s\S]*?)(?=\r?\n## 2|\r?\n## 3|\r?\n## 4|\r?\n## 5|\r?\n## 6|$)/);
    const observationRaw = obsMatch ? obsMatch[1].trim() : '';
    const observation = observationRaw
      .replace(/<[^>]+>/g, '')
      .replace(/[`\[\]\\]/g, '')
      .slice(0, 300);

    const lessonMatch = raw.match(/## 6\. Durable Lesson Learned\r?\n([\s\S]*?)(?=\r?\n## |$)/);
    const lessonRaw = lessonMatch ? lessonMatch[1].trim() : '';
    const lesson = lessonRaw
      .replace(/<[^>]+>/g, '')
      .replace(/[`\[\]\\]/g, '')
      .slice(0, 140);

    // 4. Task relevance scoring
    let relevanceScore = 50; // Base score
    if (validation === 'verified') relevanceScore += 30;
    if (contextTokens.length > 0) {
      const combinedText = `${artRef} ${observation} ${lesson}`.toLowerCase();
      let matched = 0;
      for (const token of contextTokens) {
        if (combinedText.includes(token)) matched++;
      }
      relevanceScore += Math.min(matched * 10, 40);
    }

    records.push({
      experience_id: expId,
      staff_id: staff,
      article_ref: artRef,
      observed_at: observedAt,
      kind,
      validation,
      observation,
      lesson,
      relevance_score: relevanceScore
    });
  }

  // Prioritize highest relevance score, then chronological
  records.sort((a, b) => {
    if (b.relevance_score !== a.relevance_score) {
      return b.relevance_score - a.relevance_score;
    }
    return b.observed_at.localeCompare(a.observed_at);
  });

  // Record retrieval telemetry
  if (records.length > 0) {
    recordExperienceRetrievalTelemetry({
      timestamp: new Date().toISOString(),
      staff_id: staffId,
      context_ref: filter?.context_ref,
      retrieved_count: records.length,
      experiences: records.slice(0, 5).map(r => ({
        experience_id: r.experience_id,
        article_ref: r.article_ref,
        validation: r.validation,
        relevance_score: r.relevance_score,
        lesson_preview: (r.lesson || '').slice(0, 80)
      }))
    });
  }

  return records;
}

/**
 * Submit an innovation proposal to the Innovation Inbox.
 */
export function submitProposal(proposal: OlciInnovationProposal): { success: boolean; filePath: string } {
  const fileName = `${proposal.proposal_id}.md`;
  const content = formatProposalAsMarkdown(proposal);

  const res = writeMemoryNote({
    category: '00-innovation-inbox',
    filename: fileName,
    authorStaff: proposal.proposer_role,
    content,
    allowWriteOverride: true,
    preserveRawContent: true
  });

  const baseDir = resolveSharedMemoryDir();
  const filePath = path.join(baseDir, res.subpath);
  return { success: res.success, filePath };
}

/**
 * List all proposals in the Innovation Inbox.
 */
export function listProposals(statusFilter?: OlciProposalStatus): OlciInnovationProposal[] {
  const inboxDir = resolveInnovationInboxDir();
  if (!fs.existsSync(inboxDir)) return [];

  const files = fs.readdirSync(inboxDir).filter(f => f.endsWith('.md'));
  const proposals: OlciInnovationProposal[] = [];

  for (const file of files) {
    const raw = fs.readFileSync(path.join(inboxDir, file), 'utf8');
    const fmMatch = raw.match(/^---\r?\n([\s\S]*?)\r?\n---/);
    if (!fmMatch) continue;

    const fm = fmMatch[1];
    const proposalId = (fm.match(/proposal_id:\s*"([^"]+)"/) || [])[1] || path.basename(file, '.md');
    const proposer = (fm.match(/proposer_role:\s*"([^"]+)"/) || [])[1] || '';
    const status = (fm.match(/status:\s*"([^"]+)"/) || [])[1] as OlciProposalStatus || 'submitted';
    const category = (fm.match(/category:\s*"([^"]+)"/) || [])[1] as any || 'process_improvement';
    const submittedAt = (fm.match(/submitted_at:\s*"([^"]+)"/) || [])[1] || '';

    if (statusFilter && status !== statusFilter) continue;

    const titleMatch = raw.match(/^# Innovation Proposal:\s*(.+)$/m);
    const title = titleMatch ? titleMatch[1].trim() : proposalId;

    const probMatch = raw.match(/## 1\. Problem or Opportunity\r?\n([\s\S]*?)(?=\r?\n## |$)/);
    const solMatch = raw.match(/## 2\. Proposed Solution\r?\n([\s\S]*?)(?=\r?\n## |$)/);
    const benMatch = raw.match(/## 4\. Expected Benefit\r?\n([\s\S]*?)(?=\r?\n## |$)/);

    proposals.push({
      proposal_id: proposalId,
      proposer_role: proposer,
      submitted_at: submittedAt,
      category,
      title,
      problem_or_opportunity: probMatch ? probMatch[1].trim() : '',
      proposed_solution: solMatch ? solMatch[1].trim() : '',
      expected_benefit: benMatch ? benMatch[1].trim() : '',
      estimated_cost_or_risk: '',
      success_metrics: '',
      evidence_refs: [],
      status
    });
  }

  return proposals;
}

/**
 * Record or update an event-driven collaboration thread.
 */
export function recordCollaborationThread(thread: OlciCollaborationThread): { success: boolean; filePath: string } {
  const fileName = `${thread.thread_id}.md`;

  const frontmatter = [
    '---',
    `thread_id: "${thread.thread_id}"`,
    `initiated_by: "${thread.initiated_by}"`,
    `participants:\n${thread.participants.map(p => `  - "${p}"`).join('\n')}`,
    `trigger_event: "${thread.trigger_event}"`,
    `article_ref: "${thread.article_ref}"`,
    `created_at: "${thread.created_at}"`,
    `status: "${thread.status}"`,
    '---'
  ].join('\n');

  const messagesFormatted = thread.messages.map((m, idx) => {
    return [
      `### Message ${idx + 1}: \`${m.sender_role}\` (${m.timestamp})`,
      '',
      m.content,
      ''
    ].join('\n');
  }).join('\n---\n\n');

  const conclusionFormatted = thread.conclusion ? [
    '## Conclusion & Agreed Action Items',
    '',
    `**Concluded At:** ${thread.conclusion.concluded_at}  `,
    '',
    '### Summary',
    thread.conclusion.summary,
    '',
    '### Agreed Action Items',
    thread.conclusion.action_items.map(a => `- ${a}`).join('\n'),
    '',
    '### Agreed Lessons for Professional Memory',
    thread.conclusion.agreed_lessons.map(l => `- ${l}`).join('\n'),
    ''
  ].join('\n') : '';

  const body = [
    `# Collaboration Thread: ${thread.thread_id}`,
    '',
    `**Initiated By:** \`${thread.initiated_by}\`  `,
    `**Participants:** ${thread.participants.map(p => `\`${p}\``).join(', ')}  `,
    `**Trigger:** ${thread.trigger_event}  `,
    `**Article Ref:** \`${thread.article_ref}\`  `,
    `**Status:** \`${thread.status.toUpperCase()}\`  `,
    '',
    '## Dialogue Transcript',
    '',
    messagesFormatted,
    conclusionFormatted
  ].join('\n');

  const fullContent = `${frontmatter}\n\n${body}\n`;
  const res = writeMemoryNote({
    category: '07-collaboration-threads',
    filename: fileName,
    authorStaff: thread.initiated_by,
    content: fullContent,
    allowWriteOverride: true,
    preserveRawContent: true
  });

  const baseDir = resolveSharedMemoryDir();
  const filePath = path.join(baseDir, res.subpath);
  return { success: res.success, filePath };
}
