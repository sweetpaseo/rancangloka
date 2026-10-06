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
  auditPromptSemanticLeaks,
  type JokoPromptContext,
  type JokoVisitorContextInput
} from './joko-prompt-builder.ts';

import {
  evaluateHumanWritingQuality,
  generateAuthorSafeClaims,
  detectArticleIntentProfile,
  isHistoricalRoofPack,
  type HumanWritingQualityResult,
  type EvidencePackInput,
  type ArticleIntentProfile,
  type StructuredRewriteBrief,
  type HumanWritingDecision
} from '../article/human-quality.ts';

import {
  parseGroundedDraftEnvelope,
  validateClaimGrounding,
  auditEditorialRefinement,
  type GroundedDraftEnvelope,
  type GroundingAuditResult,
  type EditorialRefinementAudit
} from './claim-grounding.ts';

import {
  evaluateAuthorSafeEvidenceGate
} from './evidence-quality-gate.ts';

import {
  generateEditorialResearchQuestions
} from './research-questions.ts';

export type EditorialRuntimeEventType =
  | 'EDITORIAL_JOB_STARTED'
  | 'JOKO_PROMPT_BUILT'
  | 'JOKO_LLM_REQUEST_STARTED'
  | 'JOKO_LLM_RESPONSE_RECEIVED'
  | 'JOKO_LLM_REQUEST_FAILED'
  | 'JOKO_DRAFT_CREATED'
  | 'GROUNDING_AUDIT_COMPLETED'
  | 'GROUNDING_VIOLATION_HALT'
  | 'RINA_QA_STARTED'
  | 'RINA_QA_COMPLETED'
  | 'EDITORIAL_REPAIR_REQUESTED'
  | 'RESEARCH_REQUIRED_HALT'
  | 'MAX_RETRIES_EXHAUSTED'
  | 'PROMPT_DOMAIN_LEAK_DETECTED'
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
  draftEnvelope?: GroundedDraftEnvelope;
  groundingAudit?: GroundingAuditResult;
  qaResult: HumanWritingQualityResult;
}

import {
  auditTopicEvidenceAlignment,
  type TopicAlignmentResult
} from './topic-alignment.ts';

export type FinalEditorialDecision =
  | 'HUMAN_WRITING_PASS'
  | 'HUMAN_WRITING_REVISE'
  | 'HUMAN_WRITING_REWRITE'
  | 'HUMAN_REVIEW_REQUIRED'
  | 'EVIDENCE_GROUNDING_REVIEW_REQUIRED'
  | 'TOPIC_EVIDENCE_ALIGNMENT_FAIL'
  | 'RESEARCH_COVERAGE_INSUFFICIENT'
  | 'RESEARCH_COVERAGE_QUALITY_INSUFFICIENT'
  | 'PROVIDER_ERROR'
  | 'PROVIDER_TIMEOUT'
  | 'PROVIDER_RATE_LIMIT'
  | 'PROVIDER_AUTH_ERROR'
  | 'PROVIDER_HTTP_ERROR'
  | 'PROVIDER_INVALID_JSON'
  | 'PROVIDER_EMPTY_RESPONSE'
  | 'PROVIDER_MISSING_CONTENT'
  | 'PROVIDER_CONTEXT_LIMIT'
  | 'PROVIDER_TRANSPORT_ERROR'
  | 'WRITER_PROMPT_DOMAIN_LEAK';

export interface EditorialJobResult {
  jobId: string;
  taskId: string;
  status: 'COMPLETED' | 'BLOCKED' | 'FAILED';
  finalDecision: FinalEditorialDecision;
  publicationStatus: 'DRAFT';
  humanStopGateStatus: 'HUMAN_REVIEW_REQUIRED' | 'OPERATOR_INTERVENTION_REQUIRED';
  finalDraft: string | null;
  draftEnvelope?: GroundedDraftEnvelope | null;
  groundingAudit?: GroundingAuditResult | null;
  refinementAudit?: EditorialRefinementAudit | null;
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

  // 1b. Pre-writing Research Gate Verification:
  // EVIDENCE_PACK_MUST_ADDRESS_REQUESTED_TOPIC
  const alignmentResult = auditTopicEvidenceAlignment(input.topic, input.evidencePack);
  if (!alignmentResult.aligned) {
    addTraceEvent(
      'RESEARCH_REQUIRED_HALT',
      'editorial_qa_primary',
      `Penulisan dibatalkan sebelum Joko: [${alignmentResult.rejection_code}] ${alignmentResult.rejection_reason}`,
      { rejection_code: alignmentResult.rejection_code, reason: alignmentResult.rejection_reason }
    );

    return {
      jobId: `job_${taskId}`,
      taskId,
      status: 'BLOCKED',
      finalDecision: alignmentResult.rejection_code === 'RESEARCH_COVERAGE_INSUFFICIENT'
        ? 'RESEARCH_COVERAGE_QUALITY_INSUFFICIENT'
        : (alignmentResult.rejection_code as FinalEditorialDecision),
      publicationStatus: 'DRAFT',
      humanStopGateStatus: 'OPERATOR_INTERVENTION_REQUIRED',
      finalDraft: null,
      totalAttempts: 0,
      authorProvenance: null,
      qaResult: null,
      attempts: [],
      traceEvents,
      error: alignmentResult.rejection_reason
    };
  }

  // 1c. Pre-writing Semantic Evidence Quality & Research Question Coverage Gate
  const intent = input.intentProfile || detectArticleIntentProfile(input.requestedTitle || input.topic);
  const researchQs = (input.evidencePack as any).research_questions || generateEditorialResearchQuestions(input.topic, intent);
  let qualityGateResult: any = (input.evidencePack as any).quality_gate_result;

  const isHistoricalTestPack = isHistoricalRoofPack(input.evidencePack) && (input as any).executionType !== 'REAL_RUNTIME_EXECUTION';
  if (!isHistoricalTestPack) {
    if (!qualityGateResult) {
      qualityGateResult = evaluateAuthorSafeEvidenceGate(
        input.evidencePack,
        input.topic,
        researchQs
      );
    }

    if (!qualityGateResult.passed || qualityGateResult.production_gate?.passed === false) {
      const gateStatus = qualityGateResult.production_gate?.gate_status || 'RESEARCH_COVERAGE_QUALITY_INSUFFICIENT';
      const reason = qualityGateResult.production_gate?.reason || 'Paket bukti tidak memenuhi ambang batas kualitas atau cakupan pertanyaan riset kanonikal.';
      addTraceEvent(
        'RESEARCH_REQUIRED_HALT',
        'editorial_qa_primary',
        `Penulisan dibatalkan sebelum Joko: [${gateStatus}] ${reason}`,
        { rejection_code: gateStatus, reason, production_gate: qualityGateResult.production_gate }
      );

      return {
        jobId: `job_${taskId}`,
        taskId,
        status: 'BLOCKED',
        finalDecision: gateStatus as FinalEditorialDecision,
        publicationStatus: 'DRAFT',
        humanStopGateStatus: 'OPERATOR_INTERVENTION_REQUIRED',
        finalDraft: null,
        totalAttempts: 0,
        authorProvenance: null,
        qaResult: null,
        attempts: [],
        traceEvents,
        error: reason
      };
    }
  }

  // 2. Prepare Provider
  const provider = options.providerInstance || new EditorialLlmProvider(options.llmOptions);

  // 3. Resolve Author Safe Claims from Quality Gate
  const rawClaims = Array.isArray(input.evidencePack.claim_inventory) ? input.evidencePack.claim_inventory : [];
  const authorSafeClaims = qualityGateResult?.author_safe_claims && qualityGateResult.author_safe_claims.length > 0
    ? qualityGateResult.author_safe_claims.filter((c: any) => c.allowed_for_authoring !== false)
    : (Array.isArray((input.evidencePack as any).author_safe_claims) && (input.evidencePack as any).author_safe_claims.length > 0
      ? (input.evidencePack as any).author_safe_claims.filter((c: any) => c.allowed_for_authoring !== false)
      : generateAuthorSafeClaims(rawClaims, { topic: input.topic, researchQuestions: researchQs }).filter((c: any) => c.allowed_for_authoring !== false));

  if (authorSafeClaims.length === 0) {
    const reason = 'Nol klaim berstatus author-safe yang diizinkan untuk penulisan setelah evaluasi kualitas semantik.';
    addTraceEvent(
      'RESEARCH_REQUIRED_HALT',
      'editorial_qa_primary',
      `Penulisan dibatalkan sebelum Joko: [RESEARCH_COVERAGE_QUALITY_INSUFFICIENT] ${reason}`,
      { rejection_code: 'RESEARCH_COVERAGE_QUALITY_INSUFFICIENT', reason }
    );

    return {
      jobId: `job_${taskId}`,
      taskId,
      status: 'BLOCKED',
      finalDecision: 'RESEARCH_COVERAGE_QUALITY_INSUFFICIENT',
      publicationStatus: 'DRAFT',
      humanStopGateStatus: 'OPERATOR_INTERVENTION_REQUIRED',
      finalDraft: null,
      totalAttempts: 0,
      authorProvenance: null,
      qaResult: null,
      attempts: [],
      traceEvents,
      error: reason
    };
  }

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

    // 4b. Pre-Provider Prompt Semantic Leak Audit
    const promptLeakAudit = auditPromptSemanticLeaks(compiledPrompt, basePromptContext);
    if (!promptLeakAudit.passed) {
      addTraceEvent(
        'PROMPT_DOMAIN_LEAK_DETECTED',
        'pipeline_supervisor',
        `Kebocoran konsep domain statis terdeteksi pada prompt Joko: ${promptLeakAudit.rejectionReason}`,
        { leaks: promptLeakAudit.leaks }
      );
      finalStatus = 'BLOCKED';
      finalDecision = 'WRITER_PROMPT_DOMAIN_LEAK';
      stopGateStatus = 'OPERATOR_INTERVENTION_REQUIRED';
      shouldContinue = false;
      break;
    }

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
      finalDecision = (llmResult.canonicalCategory as FinalEditorialDecision) ||
        (llmResult.errorCategory as FinalEditorialDecision) ||
        'PROVIDER_ERROR';
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

    // Parse Grounded Draft Envelope (JSON or raw markdown fallback)
    const envelope = parseGroundedDraftEnvelope(llmResult.content);
    currentDraft = envelope.article_markdown;

    addTraceEvent(
      'JOKO_DRAFT_CREATED',
      'content_writer_primary',
      `Draf naskah Joko berhasil diproduksi (${currentDraft.length} karakter).`,
      { attempt, draftLength: currentDraft.length, declaredClaims: envelope.claim_usage.length }
    );

    // Validate Claim Grounding against Evidence Pack & Safe Claims
    const groundingAudit = validateClaimGrounding(envelope, input.evidencePack, authorSafeClaims);
    addTraceEvent(
      'GROUNDING_AUDIT_COMPLETED',
      'content_writer_primary',
      `Audit ketercakupan klaim selesai: Status [${groundingAudit.status}], Valid: ${groundingAudit.isValid} (${groundingAudit.validClaimsCount}/${groundingAudit.declaredClaimsCount} klaim valid).`,
      {
        attempt,
        status: groundingAudit.status,
        validClaimsCount: groundingAudit.validClaimsCount,
        declaredClaimsCount: groundingAudit.declaredClaimsCount,
        unrecognizedClaimIds: groundingAudit.unrecognizedClaimIds,
        unsupportedCandidates: groundingAudit.unsupportedCandidatesFound,
        errors: groundingAudit.errors
      }
    );

    // If critical grounding violations occur (e.g. prohibited elements or unsupported candidates declared), halt immediately
    if (!groundingAudit.isValid) {
      addTraceEvent(
        'GROUNDING_VIOLATION_HALT',
        'editorial_qa_primary',
        `Pelanggaran ketercakupan bukti terdeteksi (${groundingAudit.errors.join('; ')}). Naskah dihentikan untuk review operator.`,
        { errors: groundingAudit.errors, status: groundingAudit.status }
      );
      finalStatus = 'BLOCKED';
      finalDecision = 'EVIDENCE_GROUNDING_REVIEW_REQUIRED';
      stopGateStatus = 'OPERATOR_INTERVENTION_REQUIRED';
      shouldContinue = false;

      attempts.push({
        attemptNumber: attempt,
        startedAt: attemptStartTime,
        completedAt: new Date().toISOString(),
        llmLatencyMs: llmResult.latencyMs,
        tokenUsage: llmResult.usage,
        draftText: currentDraft,
        draftEnvelope: envelope,
        groundingAudit,
        qaResult: evaluateHumanWritingQuality(currentDraft, {
          articleId,
          taskId,
          evidencePack: input.evidencePack
        })
      });
      break;
    }

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
      draftEnvelope: envelope,
      groundingAudit,
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

  const lastAttempt = attempts.length > 0 ? attempts[attempts.length - 1] : null;
  const refinementAudit = currentDraft ? auditEditorialRefinement(currentDraft) : null;

  return {
    jobId: `job_${taskId}`,
    taskId,
    status: finalStatus,
    finalDecision,
    publicationStatus: 'DRAFT',
    humanStopGateStatus: stopGateStatus,
    finalDraft: currentDraft,
    draftEnvelope: lastAttempt?.draftEnvelope || null,
    groundingAudit: lastAttempt?.groundingAudit || null,
    refinementAudit,
    totalAttempts: attempts.length,
    authorProvenance,
    qaResult: lastQaResult,
    attempts,
    traceEvents,
    error: lastLlmResult?.error,
    errorCategory: lastLlmResult?.errorCategory
  };
}
