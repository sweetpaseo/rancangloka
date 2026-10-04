/**
 * RancangLoka Editorial Runtime Engine
 * Milestone: EDITORIAL-RUNTIME-1
 *
 * Implements the first real editorial execution path:
 * Human Operator -> Editorial Runtime -> Joko Prompt Builder -> Real LLM Provider -> Joko Draft -> Rina Deterministic QA -> Human Review Gate.
 *
 * Strict Invariants:
 * - REAL_RUNTIME_EXECUTION is attributed ONLY when a real LLM request actually occurred.
 * - Operator-triggered only. Zero autonomous content creation. Zero publication authority.
 * - Final state is ALWAYS 'DRAFT' and stops at 'HUMAN_REVIEW_REQUIRED'.
 * - Bounded retries (max 2). Critical research gaps stop immediately (fail-closed, no fabrication).
 * - Secrets are strictly redacted from trace events and metadata.
 */

import {
  EditorialLlmProvider,
  type EditorialGenerationResult,
  type EditorialLlmOptions,
  type EditorialLlmProviderName
} from './editorial-llm-provider.ts';

import {
  buildJokoPrompt,
  buildJokoRepairPrompt,
  type JokoPromptContext,
  type JokoVisitorContextInput
} from './joko-prompt-builder.ts';

import {
  evaluateHumanWritingQuality,
  generateAuthorSafeClaims,
  detectArticleIntentProfile,
  type HumanWritingQualityResult,
  type EvidencePackInput,
  type ArticleIntentProfile,
  type StructuredRewriteBrief,
  type HumanWritingDecision
} from '../article/human-quality.ts';

export type EditorialRuntimeEventType =
  | 'EDITORIAL_JOB_STARTED'
  | 'JOKO_PROMPT_BUILT'
  | 'JOKO_LLM_REQUEST_STARTED'
  | 'JOKO_LLM_RESPONSE_RECEIVED'
  | 'JOKO_LLM_REQUEST_FAILED'
  | 'JOKO_DRAFT_CREATED'
  | 'RINA_QA_STARTED'
  | 'RINA_QA_COMPLETED'
  | 'EDITORIAL_REPAIR_REQUESTED'
  | 'RESEARCH_REQUIRED_HALT'
  | 'MAX_RETRIES_EXHAUSTED'
  | 'HUMAN_REVIEW_REQUIRED';

export interface EditorialRuntimeEvent {
  event_id: string;
  type: EditorialRuntimeEventType;
  timestamp: string;
  task_id: string;
  staff_id: string;
  summary: string;
  metadata?: Record<string, any>;
}

export interface EditorialAuthorRuntimeProvenance {
  staff_id: 'content_writer_primary';
  staff_name: 'Joko';
  execution_type: 'REAL_RUNTIME_EXECUTION';
  provider: EditorialLlmProviderName;
  model: string;
  generated_at: string;
  job_id: string;
  attempt_count: number;
}

export interface EditorialJobInput {
  taskId: string;
  articleId?: string;
  topic: string;
  requestedTitle?: string;
  intentProfile?: ArticleIntentProfile;
  evidencePack: EvidencePackInput;
  visitorContext?: JokoVisitorContextInput;
  maxRetries?: number;
  operatorAuth: {
    authorizedBy: string;
    timestamp?: string;
  };
}

export interface EditorialAttemptRecord {
  attemptNumber: number;
  startedAt: string;
  completedAt: string;
  llmLatencyMs: number;
  tokenUsage?: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
  draftText: string;
  qaResult: HumanWritingQualityResult;
}

export type FinalEditorialDecision =
  | 'HUMAN_WRITING_PASS'
  | 'HUMAN_WRITING_REVISE'
  | 'HUMAN_WRITING_REWRITE'
  | 'HUMAN_REVIEW_REQUIRED'
  | 'PROVIDER_ERROR';

export interface EditorialJobResult {
  jobId: string;
  taskId: string;
  status: 'COMPLETED' | 'BLOCKED' | 'FAILED';
  finalDecision: FinalEditorialDecision;
  publicationStatus: 'DRAFT';
  humanStopGateStatus: 'HUMAN_REVIEW_REQUIRED' | 'OPERATOR_INTERVENTION_REQUIRED';
  finalDraft: string | null;
  totalAttempts: number;
  authorProvenance: EditorialAuthorRuntimeProvenance | null;
  qaResult: HumanWritingQualityResult | null;
  attempts: EditorialAttemptRecord[];
  traceEvents: EditorialRuntimeEvent[];
  error?: string;
  errorCategory?: string;
}

export interface EditorialRuntimeOptions {
  llmOptions?: EditorialLlmOptions;
  providerInstance?: EditorialLlmProvider;
}

/**
 * Executes a controlled, operator-triggered editorial drafting job through Joko and Rina.
 */
export async function executeEditorialDraftJob(
  input: EditorialJobInput,
  options: EditorialRuntimeOptions = {}
): Promise<EditorialJobResult> {
  const startTime = new Date().toISOString();
  const taskId = input.taskId;
  const articleId = input.articleId || `art_${taskId}`;
  const maxRetries = input.maxRetries ?? 2;
  const traceEvents: EditorialRuntimeEvent[] = [];
  const attempts: EditorialAttemptRecord[] = [];

  function addTraceEvent(
    type: EditorialRuntimeEventType,
    staffId: string,
    summary: string,
    metadata?: Record<string, any>
  ): void {
    traceEvents.push({
      event_id: `evt_ed_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      type,
      timestamp: new Date().toISOString(),
      task_id: taskId,
      staff_id: staffId,
      summary,
      metadata: metadata ? JSON.parse(JSON.stringify(metadata)) : undefined
    });
  }

  // 1. Invariant: Operator authorization is mandatory
  if (!input.operatorAuth || !input.operatorAuth.authorizedBy) {
    throw new Error('EDITORIAL_RUNTIME_SECURITY_VIOLATION: Operator authorization is mandatory to trigger an editorial draft job.');
  }

  addTraceEvent(
    'EDITORIAL_JOB_STARTED',
    'operator',
    `Operator ${input.operatorAuth.authorizedBy} memulai tugas penulisan editorial '${input.topic}'.`,
    { authorizedBy: input.operatorAuth.authorizedBy }
  );

  // 2. Prepare Provider
  const provider = options.providerInstance || new EditorialLlmProvider(options.llmOptions);

  // 3. Resolve Intent and Author Safe Claims
  const intent = input.intentProfile || detectArticleIntentProfile(input.requestedTitle || input.topic);
  const rawClaims = Array.isArray(input.evidencePack.claim_inventory) ? input.evidencePack.claim_inventory : [];
  const authorSafeClaims = generateAuthorSafeClaims(rawClaims);

  const basePromptContext: JokoPromptContext = {
    topic: input.topic,
    requestedTitle: input.requestedTitle || input.topic,
    intentProfile: intent,
    evidencePack: input.evidencePack,
    authorSafeClaims,
    visitorContext: input.visitorContext
  };

  let currentDraft: string | null = null;
  let lastQaResult: HumanWritingQualityResult | null = null;
  let lastLlmResult: EditorialGenerationResult | null = null;
  let currentRewriteBrief: StructuredRewriteBrief | null = null;
  let shouldContinue = true;
  let finalStatus: EditorialJobResult['status'] = 'COMPLETED';
  let finalDecision: FinalEditorialDecision = 'HUMAN_WRITING_PASS';
  let stopGateStatus: EditorialJobResult['humanStopGateStatus'] = 'HUMAN_REVIEW_REQUIRED';

  for (let attempt = 1; attempt <= maxRetries + 1 && shouldContinue; attempt++) {
    const attemptStartTime = new Date().toISOString();

    // 4. Build Joko Prompt (Initial or Repair)
    let compiledPrompt = currentRewriteBrief && currentDraft
      ? buildJokoRepairPrompt(basePromptContext, currentDraft, currentRewriteBrief, attempt)
      : buildJokoPrompt(basePromptContext);

    addTraceEvent(
      'JOKO_PROMPT_BUILT',
      'content_writer_primary',
      `Prompt Joko berhasil dikompilasi (Percobaan ${attempt}, ${compiledPrompt.metadata.safeClaimsCount} klaim aman, intensi ${compiledPrompt.metadata.intent}).`,
      {
        attempt,
        hasRevisionContext: compiledPrompt.metadata.hasRevisionContext,
        safeClaimsCount: compiledPrompt.metadata.safeClaimsCount
      }
    );

    // 5. Request Generation from LLM Provider
    addTraceEvent(
      'JOKO_LLM_REQUEST_STARTED',
      'content_writer_primary',
      `Joko mengirimkan permintaan pembuatan draf ke provider ${provider.providerName} (model: ${provider.modelName}).`,
      { attempt, provider: provider.providerName, model: provider.modelName }
    );

    const llmResult = await provider.generate({
      messages: compiledPrompt.messages,
      jobId: taskId,
      taskId
    });

    lastLlmResult = llmResult;

    if (!llmResult.success || !llmResult.content) {
      addTraceEvent(
        'JOKO_LLM_REQUEST_FAILED',
        'content_writer_primary',
        `Panggilan LLM Joko gagal: [${llmResult.errorCategory || 'UNKNOWN'}] ${llmResult.error || 'Nol konten'}.`,
        { attempt, errorCategory: llmResult.errorCategory, error: llmResult.error }
      );

      finalStatus = 'FAILED';
      finalDecision = 'PROVIDER_ERROR';
      stopGateStatus = 'OPERATOR_INTERVENTION_REQUIRED';
      shouldContinue = false;
      break;
    }

    addTraceEvent(
      'JOKO_LLM_RESPONSE_RECEIVED',
      'content_writer_primary',
      `Joko menerima respons dari ${llmResult.provider} dalam ${llmResult.latencyMs}ms.`,
      {
        attempt,
        latencyMs: llmResult.latencyMs,
        tokens: llmResult.usage?.totalTokens
      }
    );

    currentDraft = llmResult.content;

    addTraceEvent(
      'JOKO_DRAFT_CREATED',
      'content_writer_primary',
      `Draf naskah Joko berhasil diproduksi (${currentDraft.length} karakter).`,
      { attempt, draftLength: currentDraft.length }
    );

    // 6. Execute Rina Deterministic QA
    addTraceEvent(
      'RINA_QA_STARTED',
      'editorial_qa_primary',
      `Rina memulai evaluasi kualitas tulisan manusia secara deterministik (Percobaan ${attempt}).`,
      { attempt }
    );

    const qaResult = evaluateHumanWritingQuality(currentDraft, {
      articleId,
      taskId,
      evidencePack: input.evidencePack,
      hasTradeOffEvidence: (input.evidencePack as any)?.has_trade_off_evidence ?? (input.evidencePack as any)?.hasTradeOffEvidence,
      hasMissingClaimProvenance: (input.evidencePack as any)?.has_missing_claim_provenance ?? (input.evidencePack as any)?.hasMissingClaimProvenance
    });

    lastQaResult = qaResult;

    addTraceEvent(
      'RINA_QA_COMPLETED',
      'editorial_qa_primary',
      `Rina menyelesaikan QA: Skor ${qaResult.total_score}/100, Keputusan: ${qaResult.decision} (${qaResult.issues.length} isu terdeteksi).`,
      {
        attempt,
        totalScore: qaResult.total_score,
        decision: qaResult.decision,
        issueCodes: qaResult.issues.map(i => i.code)
      }
    );

    attempts.push({
      attemptNumber: attempt,
      startedAt: attemptStartTime,
      completedAt: new Date().toISOString(),
      llmLatencyMs: llmResult.latencyMs,
      tokenUsage: llmResult.usage,
      draftText: currentDraft,
      qaResult
    });

    // 7. Decision Evaluation & Bounded Retry
    if (qaResult.decision === 'HUMAN_WRITING_PASS') {
      finalDecision = 'HUMAN_WRITING_PASS';
      shouldContinue = false;
    } else {
      // Check for Research Required / Critical Evidence or Integrity Gaps
      const brief = qaResult.rewrite_brief;
      const isResearchOrIntegrityHalt =
        brief?.revision_reason === 'RESEARCH_REQUIRED' ||
        brief?.target_agent_id === 'evidence_researcher_lead' ||
        brief?.revision_reason === 'EDITORIAL_INTEGRITY_REVIEW';

      if (isResearchOrIntegrityHalt) {
        addTraceEvent(
          'RESEARCH_REQUIRED_HALT',
          brief?.target_agent_id || 'editorial_qa_primary',
          'Isu riset atau integritas kritis terdeteksi; penghentian aman diberlakukan untuk mencegah halusinasi/fabrikasi Joko.',
          { issueCodes: qaResult.issues.map(i => i.code), targetAgent: brief?.target_agent_id, revisionReason: brief?.revision_reason }
        );
        finalStatus = 'BLOCKED';
        finalDecision = qaResult.decision as FinalEditorialDecision;
        stopGateStatus = 'OPERATOR_INTERVENTION_REQUIRED';
        shouldContinue = false;
        break;
      }

      if (attempt <= maxRetries) {
        currentRewriteBrief = qaResult.rewrite_brief;
        addTraceEvent(
          'EDITORIAL_REPAIR_REQUESTED',
          'editorial_qa_primary',
          `Rina menerbitkan StructuredRewriteBrief untuk perbaikan Joko (Percobaan ${attempt + 1}).`,
          {
            nextAttempt: attempt + 1,
            issue: qaResult.rewrite_brief?.quality_issue
          }
        );
      } else {
        addTraceEvent(
          'MAX_RETRIES_EXHAUSTED',
          'editorial_qa_primary',
          `Batas maksimal ${maxRetries} percobaan revisi tercapai; naskah dieskalasi ke redaktur manusia.`,
          { totalAttempts: attempt }
        );
        finalDecision = qaResult.decision as FinalEditorialDecision;
        shouldContinue = false;
      }
    }
  }

  // 8. Always enforce Human Review Stop Gate
  addTraceEvent(
    'HUMAN_REVIEW_REQUIRED',
    'mission_control_guard',
    'Naskah berhenti aman pada status DRAFT untuk peninjauan manusia sebelum publikasi.',
    { finalDecision, autoPublish: 'OFF' }
  );

  let authorProvenance: EditorialAuthorRuntimeProvenance | null = null;
  if (lastLlmResult && lastLlmResult.success && currentDraft) {
    authorProvenance = {
      staff_id: 'content_writer_primary',
      staff_name: 'Joko',
      execution_type: 'REAL_RUNTIME_EXECUTION',
      provider: provider.providerName,
      model: provider.modelName,
      generated_at: new Date().toISOString(),
      job_id: taskId,
      attempt_count: attempts.length
    };
  }

  return {
    jobId: `job_${taskId}`,
    taskId,
    status: finalStatus,
    finalDecision,
    publicationStatus: 'DRAFT',
    humanStopGateStatus: stopGateStatus,
    finalDraft: currentDraft,
    totalAttempts: attempts.length,
    authorProvenance,
    qaResult: lastQaResult,
    attempts,
    traceEvents,
    error: lastLlmResult?.error,
    errorCategory: lastLlmResult?.errorCategory
  };
}
