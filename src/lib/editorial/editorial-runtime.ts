/**
 * RancangLoka Editorial Runtime Engine
 * Milestone: EDITORIAL-RUNTIME-1
 *
 * Implements the first real editorial execution path:
 * Human Operator -> Editorial Runtime -> Joko Prompt Builder -> Real LLM Provider -> Joko Draft -> Rina Deterministic QA -> Human Review Gate.
 *
 * Strict Invariants:
 * - REAL_RUNTIME_EXECUTION is attributed ONLY when a real LLM request actually occurred.
 * - Supervised Execution Boundary: Setiap eksekusi dipicu secara terkontrol (operator-initiated atau scheduler-governed). Memiliki kapabilitas alur otomatis antartahap teknis (autonomous workflow capability), namun tidak ada kreasi konten tanpa izin (zero unprompted autonomous creation), dan kewenangan publikasi mandiri adalah nol (zero autonomous publishing authority, AUTO_PUBLISH = OFF).
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
  crossLingualStemMatch,
  type GroundedDraftEnvelope,
  type GroundingAuditResult,
  type EditorialRefinementAudit,
  type AuthorClaimUsageDeclaration
} from './claim-grounding.ts';

import {
  AssertionReconciliationEngine,
  tokenizeText,
  type AssertionReconciliationResult
} from './assertion-reconciliation.ts';

import {
  evaluateAuthorSafeEvidenceGate
} from './evidence-quality-gate.ts';

import {
  generateEditorialResearchQuestions
} from './research-questions.ts';

import {
  evaluatePremiumEditorialDepth,
  type PremiumEditorialDepthChecklist
} from './premium-editorial-depth-guard.ts';

import {
  generateEditorialVisualBriefs,
  dispatchEditorialVisualBriefs,
  type VisualBrief
} from './visual-brief.ts';

import {
  executeNadiaReaderVoiceEdit,
  type NadiaEditResult,
  type Voice3L4AssessmentResult
} from './nadia-reader-voice.ts';

import {
  runJevQualitySupervision,
  type JevSupervisionAuditReceipt
} from './jev-quality-supervision.ts';

import {
  compileEditorialBrief,
  type EditorialBrief
} from './editorial-planner.ts';

import {
  verifySourceContentIntegrity,
  auditAssertionCoverage,
  computeArticleContentHash,
  type AssertionCoverageAuditResult
} from './source-provenance-verifier.ts';

import type { MediaJobRecord } from '../media/jobs-service.ts';

export type EditorialRuntimeEventType =
  | 'EDITORIAL_JOB_STARTED'
  | 'EDITORIAL_PLAN_COMPILED'
  | 'JOKO_PROMPT_BUILT'
  | 'JOKO_LLM_REQUEST_STARTED'
  | 'JOKO_LLM_RESPONSE_RECEIVED'
  | 'JOKO_LLM_REQUEST_FAILED'
  | 'JOKO_DRAFT_CREATED'
  | 'ASSERTION_RECONCILIATION_COMPLETED'
  | 'GROUNDING_AUDIT_COMPLETED'
  | 'GROUNDING_VIOLATION_HALT'
  | 'SOURCE_PROVENANCE_INTEGRITY_FAILED'
  | 'NADIA_EDIT_STARTED'
  | 'NADIA_EDIT_COMPLETED'
  | 'NADIA_EDIT_SKIPPED'
  | 'JEV_SUPERVISION_COMPLETED'
  | 'RINA_QA_STARTED'
  | 'RINA_QA_COMPLETED'
  | 'EDITORIAL_REPAIR_REQUESTED'
  | 'RESEARCH_REQUIRED_HALT'
  | 'MAX_RETRIES_EXHAUSTED'
  | 'PROMPT_DOMAIN_LEAK_DETECTED'
  | 'VISUAL_BRIEFS_GENERATED'
  | 'VISUAL_BRIEFS_DISPATCHED'
  | 'AUTHORING_EXECUTION_REQUIRES_AUTHORIZATION'
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
  focusKeyword?: string;
  intentProfile?: ArticleIntentProfile;
  evidencePack: EvidencePackInput;
  visitorContext?: JokoVisitorContextInput;
  editorialBrief?: EditorialBrief;
  maxRetries?: number;
  operatorAuth: {
    authorizedBy: string;
    timestamp?: string;
  };
  db?: any;
  editorialVoiceLevel?: 'L3' | 'L4' | 'L5';
  enableVoiceL4?: boolean;
  enableVoiceL5?: boolean;
  expectedContentHash?: string;
  revisionContext?: {
    attempt: number;
    previousDraft: string;
    rewriteBrief: StructuredRewriteBrief;
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
  rawEnvelope?: GroundedDraftEnvelope;
  draftEnvelope?: GroundedDraftEnvelope;
  groundingAudit?: GroundingAuditResult;
  assertionReconciliation?: AssertionReconciliationResult;
  nadiaResult?: NadiaEditResult;
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
  | 'EVIDENCE_PROVENANCE_INTEGRITY_REJECTED'
  | 'HUMAN_OR_AUTHORIZED_SEMANTIC_REVIEW_REQUIRED'
  | 'AUTHORING_EXECUTION_REQUIRES_AUTHORIZATION'
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
  rawEnvelope?: GroundedDraftEnvelope | null;
  draftEnvelope?: GroundedDraftEnvelope | null;
  groundingAudit?: GroundingAuditResult | null;
  assertionReconciliation?: AssertionReconciliationResult | null;
  refinementAudit?: EditorialRefinementAudit | null;
  editorialBrief?: EditorialBrief | null;
  totalAttempts: number;
  authorProvenance: EditorialAuthorRuntimeProvenance | null;
  qaResult: HumanWritingQualityResult | null;
  attempts: EditorialAttemptRecord[];
  traceEvents: EditorialRuntimeEvent[];
  premiumDepthCheck?: PremiumEditorialDepthChecklist | null;
  visualBriefs?: VisualBrief[];
  dispatchedMediaJobs?: MediaJobRecord[];
  voice3L4Assessment?: Voice3L4AssessmentResult | null;
  editorialVoiceLevel?: 'L3' | 'L4' | 'L5';
  error?: string;
  errorCategory?: string;
}

export interface EditorialRuntimeOptions {
  llmOptions?: EditorialLlmOptions;
  providerInstance?: EditorialLlmProvider;
  nadiaProviderInstance?: EditorialLlmProvider;
  enableNadiaLlmEdit?: boolean;
  editorialVoiceLevel?: 'L3' | 'L4' | 'L5';
  enableVoiceL4?: boolean;
  enableVoiceL5?: boolean;
  allowPaidExecution?: boolean;
  expectedContentHash?: string;
  allowTestAdapter?: boolean;
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

  // 1a. Source Provenance & Content Integrity Verification (Task B & D)
  const sourcesToVerify = Array.isArray(input.evidencePack.sources) && input.evidencePack.sources.length > 0
    ? input.evidencePack.sources
    : Array.isArray(input.evidencePack.retrieved_documents) && input.evidencePack.retrieved_documents.length > 0
      ? input.evidencePack.retrieved_documents
      : [];

  if (sourcesToVerify.length > 0) {
    for (const src of sourcesToVerify) {
      const integrity = verifySourceContentIntegrity({
        sourceId: src.source_id,
        sourceText: (src as any).full_text || (src as any).source_text || (src as any).content_text || (src as any).text || (src as any).passage_text,
        expectedChecksum: (src as any).content_hash || (src as any).sha256 || (src as any).expected_checksum,
        sourceAuthenticity: (src as any).source_authenticity || ((src as any).is_local_fixture ? 'LOCAL_FIXTURE_ONLY' : 'AUTHENTIC_EXTERNAL_PRIMARY'),
        sourceTextAccessibility: (src as any).source_text_accessibility,
        isLocalFixtureOnly: Boolean((src as any).is_local_fixture_only || (src as any).is_local_fixture),
        ingestionReceipt: (src as any).ingestion_receipt || (src as any).ingestionReceipt,
        allowTestAdapter: options.allowTestAdapter
      });
      if (!integrity.valid) {
        addTraceEvent(
          'SOURCE_PROVENANCE_INTEGRITY_FAILED',
          'evidence_researcher_lead',
          `Sumber rujukan '${src.source_id}' gagal verifikasi integritas: [${integrity.status}] ${integrity.reason}`,
          { sourceId: src.source_id, status: integrity.status, reason: integrity.reason }
        );
        return {
          jobId: `job_${taskId}`,
          taskId,
          status: 'BLOCKED',
          finalDecision: 'EVIDENCE_PROVENANCE_INTEGRITY_REJECTED',
          publicationStatus: 'DRAFT',
          humanStopGateStatus: 'OPERATOR_INTERVENTION_REQUIRED',
          finalDraft: null,
          totalAttempts: 0,
          authorProvenance: null,
          qaResult: null,
          attempts: [],
          traceEvents,
          error: `SOURCE_PROVENANCE_INTEGRITY_FAILED: ${src.source_id} (${integrity.status}: ${integrity.reason})`
        };
      }
    }
  }

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

  const editorialVoiceLevel: 'L3' | 'L4' | 'L5' =
    input.editorialVoiceLevel ||
    options.editorialVoiceLevel ||
    (process.env.HERMES_EDITORIAL_VOICE_LEVEL as 'L3' | 'L4' | 'L5') ||
    (input.enableVoiceL5 || options.enableVoiceL5 ? 'L5' : (input.enableVoiceL4 || options.enableVoiceL4 ? 'L4' : 'L4'));
  const enableVoiceL4 = editorialVoiceLevel === 'L4';
  const enableVoiceL5 = editorialVoiceLevel === 'L5';

  const basePromptContext: JokoPromptContext = {
    topic: input.topic,
    requestedTitle: input.requestedTitle || input.topic,
    focusKeyword: input.focusKeyword,
    intentProfile: intent,
    evidencePack: input.evidencePack,
    authorSafeClaims,
    visitorContext: input.visitorContext,
    editorialVoiceLevel,
    enableVoiceL4,
    enableVoiceL5
  };

  // 3b. Editorial Planner: Compile Reader-Focused Editorial Brief
  const editorialBrief = input.editorialBrief || compileEditorialBrief(basePromptContext);
  basePromptContext.editorialBrief = editorialBrief;

  addTraceEvent(
    'EDITORIAL_PLAN_COMPILED',
    'editorial_planner',
    `Editorial Planner menyusun brief terfokus-pembaca (${editorialBrief.outline.length} bab, tipe: ${editorialBrief.article_family}).`,
    {
      articleFamily: editorialBrief.article_family,
      sectionsCount: editorialBrief.outline.length,
      verifiedEvidenceCount: editorialBrief.verified_evidence.length,
      practicalGuidelinesCount: editorialBrief.practical_guidelines.length,
      optionalExamplesCount: editorialBrief.optional_design_examples.length
    }
  );

  let currentDraft: string | null = input.revisionContext?.previousDraft || null;
  let lastQaResult: HumanWritingQualityResult | null = null;
  let lastLlmResult: EditorialGenerationResult | null = null;
  let currentRewriteBrief: StructuredRewriteBrief | null = input.revisionContext?.rewriteBrief || null;
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
      `Prompt Joko berhasil dikompilasi (Percobaan ${attempt}, ${compiledPrompt.metadata.safeClaimsCount} klaim aman, intensi ${compiledPrompt.metadata.intent}, voice: ${compiledPrompt.metadata.editorialVoiceLevel || editorialVoiceLevel}).`,
      {
        attempt,
        hasRevisionContext: compiledPrompt.metadata.hasRevisionContext,
        safeClaimsCount: compiledPrompt.metadata.safeClaimsCount,
        editorialVoiceLevel: compiledPrompt.metadata.editorialVoiceLevel || editorialVoiceLevel
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
    // Invariant: External/paid LLM calls require explicit operator authorization
    const isCustomMock = Boolean((provider as any).hasCustomFetchFn);
    const isLiveExternalProvider = (provider.providerName === 'sumopod' || provider.providerName === 'openrouter') && !isCustomMock;
    const hasPaidAuth = Boolean(options.allowPaidExecution || process.env.AUTHORIZE_PAID_EDITORIAL_LLM === 'true');
    if (isLiveExternalProvider && !hasPaidAuth) {
      addTraceEvent(
        'AUTHORING_EXECUTION_REQUIRES_AUTHORIZATION',
        'pipeline_supervisor',
        `Panggilan LLM eksternal/berbayar (${provider.providerName}) membutuhkan otorisasi eksplisit operator. Eksekusi ditangguhkan.`,
        { provider: provider.providerName, model: provider.modelName, attempt }
      );
      finalStatus = 'BLOCKED';
      finalDecision = 'AUTHORING_EXECUTION_REQUIRES_AUTHORIZATION';
      stopGateStatus = 'OPERATOR_INTERVENTION_REQUIRED';
      shouldContinue = false;
      break;
    }

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

    // 5. Nadia Reader Voice Language Edit
    // Canonical Sequence: Joko Draft -> Nadia Reader Voice Edit -> Rina Editorial QA -> Human Review
    addTraceEvent(
      'NADIA_EDIT_STARTED',
      'audience_language_editor',
      `Nadia memulai penyuntingan bahasa dan kenyamanan membaca draf Joko (Percobaan ${attempt}, voice: ${editorialVoiceLevel}).`,
      { attempt, originalLength: currentDraft.length, editorialVoiceLevel }
    );

    const nadiaProvider = options.nadiaProviderInstance || (options.enableNadiaLlmEdit ? provider : undefined);

    const nadiaResult = await executeNadiaReaderVoiceEdit({
      draftMarkdown: currentDraft,
      topic: input.topic,
      intent: intent.primary_intent,
      provider: nadiaProvider,
      taskId,
      editorialVoiceLevel,
      enableVoiceL4
    });

    if (nadiaResult.authorityCheck.isAllowed) {
      currentDraft = nadiaResult.refinedMarkdown;
      addTraceEvent(
        'NADIA_EDIT_COMPLETED',
        'audience_language_editor',
        `Nadia menyelesaikan penyuntingan: ${nadiaResult.changesApplied.length} perbaikan bahasa diterapkan (${currentDraft.length} karakter).`,
        {
          attempt,
          changesApplied: nadiaResult.changesApplied,
          readerVoiceScore: nadiaResult.readerVoiceEvaluation.overallScore,
          readerVoiceDecision: nadiaResult.readerVoiceEvaluation.decision,
          usedLlm: nadiaResult.usedLlm,
          editorialVoiceLevel,
          voice3L4Decision: nadiaResult.voice3L4Assessment?.decision
        }
      );
    } else {
      addTraceEvent(
        'NADIA_EDIT_SKIPPED',
        'audience_language_editor',
        `Penyuntingan bahasa Nadia dibatalkan karena terdeteksi potensi pelanggaran batas otoritas: ${nadiaResult.authorityCheck.violations.join('; ')}. Menggunakan draf asli Joko.`,
        { violations: nadiaResult.authorityCheck.violations }
      );
    }

    // 5B. Jefry (TypeSafe JEV) Quality Supervision
    // Canonical: After actual READER_VOICE_PASS, Jefry performs independent shadow audit
    let jevSupervisionReceipt: JevSupervisionAuditReceipt | undefined;
    if (nadiaResult.readerVoiceEvaluation.decision === 'READER_VOICE_PASS') {
      try {
        const articleSlug = input.topic
          ? input.topic.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
          : 'untitled-article';
        jevSupervisionReceipt = await runJevQualitySupervision({
          articleId: typeof input.articleId === 'number' ? input.articleId : 0,
          slug: articleSlug,
          candidateContent: currentDraft,
          focusKeyword: input.topic || editorialBrief?.topic || '',
          nadiaResult: {
            decision: nadiaResult.readerVoiceEvaluation.decision,
            overallScore: nadiaResult.readerVoiceEvaluation.overallScore
          }
        });

        addTraceEvent(
          'JEV_SUPERVISION_COMPLETED',
          'management_advisor_jefry',
          jevSupervisionReceipt.advisory_summary,
          {
            auditId: jevSupervisionReceipt.audit_id,
            supervisionDecision: jevSupervisionReceipt.supervision_decision,
            discrepancyDetected: jevSupervisionReceipt.discrepancy_detected,
            violationsCount: jevSupervisionReceipt.violations.length,
            revisionHash: jevSupervisionReceipt.revision_hash
          }
        );
      } catch (err: any) {
        addTraceEvent(
          'JEV_SUPERVISION_COMPLETED',
          'management_advisor_jefry',
          `[Advisori Jefry]: Audit supervisi independen mengalami error: ${err?.message || err}`,
          { error: err?.message || String(err), supervisionDecision: 'AUDIT_FAILED' }
        );
      }
    }

    // 6. Rina Deterministic QA & Factual Grounding
    addTraceEvent(
      'RINA_QA_STARTED',
      'editorial_qa_primary',
      `Rina memulai evaluasi kualitas tulisan manusia dan ketercakupan bukti secara deterministik (Percobaan ${attempt}).`,
      { attempt }
    );

    // Reconcile Article Assertions across 5-tier taxonomy:
    // VERIFIED_FACT | SUPPORTED_PRACTICAL_GUIDANCE | OPTIONAL_DESIGN_EXAMPLE | EDITORIAL_INTERPRETATION | UNSUPPORTED_CLAIM
    const reconciliationEngine = new AssertionReconciliationEngine();
    const reconciliation = reconciliationEngine.reconcile({
      article_markdown: currentDraft,
      claim_usage: envelope.claim_usage,
      authorSafeClaims,
      evidencePack: input.evidencePack,
      editorialBrief
    });

    // Reconcile and repair claim_usage declarations where genuine source support exists
    // (preserving original raw envelope in attempt history)
    const reconciledUsages: AuthorClaimUsageDeclaration[] = [];
    let repairedCount = 0;

    // A. Reconcile existing declarations: repair mismatched claim IDs or excerpts where deterministic reconciliation proved valid support
    for (const usage of envelope.claim_usage) {
      const cleanUsage = (usage.article_excerpt || '').replace(/[.…]+$/, '').trim();
      const normUsage = cleanUsage.toLowerCase();
      const matchingEntry = reconciliation.entries.find(e => {
        const normSpan = e.article_span.toLowerCase();
        if (normSpan.includes(normUsage) || normUsage.includes(normSpan)) return true;
        // Token overlap check for slight paraphrasing or prefix truncations
        const uTokens = tokenizeText(cleanUsage);
        const sTokens = tokenizeText(e.article_span);
        if (uTokens.length >= 3 && sTokens.length >= 3) {
          const shared = uTokens.filter(t => sTokens.includes(t) || crossLingualStemMatch(t, sTokens[0]));
          return shared.length / uTokens.length >= 0.6;
        }
        return false;
      });

      if (
        matchingEntry &&
        matchingEntry.classification === 'EVIDENCE_BACKED' &&
        matchingEntry.supporting_claim_ids &&
        matchingEntry.supporting_claim_ids.length > 0
      ) {
        reconciledUsages.push({
          ...usage,
          claim_id: matchingEntry.supporting_claim_ids[0],
          article_excerpt: matchingEntry.article_span
        });
        if (matchingEntry.supporting_claim_ids[0] !== usage.claim_id) {
          repairedCount++;
        }
      } else if (
        matchingEntry &&
        matchingEntry.classification === 'EDITORIAL_INFERENCE' &&
        matchingEntry.supporting_claim_ids &&
        matchingEntry.supporting_claim_ids.length > 0
      ) {
        reconciledUsages.push({
          ...usage,
          claim_id: matchingEntry.supporting_claim_ids[0],
          article_excerpt: matchingEntry.article_span,
          usage_type: 'EDITORIAL_INFERENCE'
        });
      } else if (
        matchingEntry &&
        (matchingEntry.classification === 'SUPPORTED_PRACTICAL_GUIDANCE' ||
         matchingEntry.classification === 'OPTIONAL_DESIGN_EXAMPLE' ||
         matchingEntry.classification === 'NON_CLAIM_PROSE')
      ) {
        // Spurious declaration on non-claim craft guidance or design prose: omit from claim_usage
        // (the sentence is legitimately governed by practical guidance / design policies and does not require claim declarations)
      } else {
        // Keep unknown / unrecognized / unresolved declarations so grounding audit catches invalid claims
        reconciledUsages.push({ ...usage });
      }
    }

    // B. Reconcile missing claims: for any EVIDENCE_BACKED span with verified claim support not yet declared
    for (const entry of reconciliation.entries) {
      if (
        entry.classification === 'EVIDENCE_BACKED' &&
        entry.supporting_claim_ids &&
        entry.supporting_claim_ids.length > 0
      ) {
        for (const cid of entry.supporting_claim_ids) {
          const alreadyDeclared = reconciledUsages.some(
            u => u.claim_id === cid && u.article_excerpt === entry.article_span
          );
          if (!alreadyDeclared) {
            reconciledUsages.push({
              claim_id: cid,
              article_excerpt: entry.article_span,
              usage_type: 'DIRECT_PARAPHRASE'
            });
            repairedCount++;
          }
        }
      }
    }

    const reconciledEnvelope: GroundedDraftEnvelope = {
      ...envelope,
      claim_usage: reconciledUsages
    };

    addTraceEvent(
      'ASSERTION_RECONCILIATION_COMPLETED',
      'content_writer_primary',
      `Rekonsiliasi asersi selesai: ${reconciliation.metrics.total_article_spans} asersi dianalisis (${reconciliation.metrics.evidence_backed_count} fakta terverifikasi, ${reconciliation.metrics.practical_guidance_count} panduan praktis, ${reconciliation.metrics.optional_design_example_count} contoh desain, ${reconciliation.metrics.editorial_inference_count} interpretasi redaksi, ${reconciliation.unresolved_spans.length} belum terselesaikan).`,
      {
        attempt,
        metrics: reconciliation.metrics,
        repairedClaimUsages: repairedCount,
        unresolvedCount: reconciliation.unresolved_spans.length,
        taxonomyBreakdown: {
          verifiedFacts: reconciliation.metrics.evidence_backed_count,
          practicalGuidance: reconciliation.metrics.practical_guidance_count,
          optionalDesignExamples: reconciliation.metrics.optional_design_example_count,
          editorialInterpretations: reconciliation.metrics.editorial_inference_count,
          nonClaimProse: reconciliation.metrics.non_claim_prose_count,
          unsupportedClaims: reconciliation.unresolved_spans.length
        }
      }
    );

    const effectiveEnvelope = enableVoiceL4 ? reconciledEnvelope : envelope;

    // Validate Claim Grounding against Evidence Pack & Safe Claims
    const groundingAudit = validateClaimGrounding(effectiveEnvelope, input.evidencePack, authorSafeClaims, {
      editorialBrief,
      isHistoricalRoof: isHistoricalRoofPack(input.evidencePack),
      enableVoiceL4,
      expectedContentHash: input.expectedContentHash || options.expectedContentHash,
      allowTestAdapter: options.allowTestAdapter
    });
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
      const hasUncertain = groundingAudit.errors.some(e => e.includes('UNCERTAIN')) ||
        Boolean(groundingAudit.assertionLedger && (groundingAudit.assertionLedger.uncertain_count || 0) > 0);
      const uncertainClaimsFromUsages = (reconciledEnvelope?.claim_usage || [])
        .filter(u => u.entailment_status === 'CLAIM_USAGE_ENTAILMENT_MISMATCH')
        .map(u => u.claim_id);
      const uncertainClaimsFromErrors = groundingAudit.errors
        .filter(e => e.includes('UNCERTAIN'))
        .map(e => {
          const match = e.match(/'(CLM-\d+)'/) || e.match(/\b(CLM-\d+)\b/);
          return match ? match[1] : null;
        })
        .filter((c): c is string => Boolean(c));
      const uncertainClaims = Array.from(new Set([...uncertainClaimsFromUsages, ...uncertainClaimsFromErrors]));

      addTraceEvent(
        'GROUNDING_VIOLATION_HALT',
        'editorial_qa_primary',
        `Pelanggaran ketercakupan bukti terdeteksi (${groundingAudit.errors.join('; ')}). Naskah dihentikan untuk review operator.`,
        {
          errors: groundingAudit.errors,
          status: groundingAudit.status,
          hasUncertain,
          uncertainClaims
        }
      );
      finalStatus = 'BLOCKED';
      finalDecision = hasUncertain
        ? 'HUMAN_OR_AUTHORIZED_SEMANTIC_REVIEW_REQUIRED'
        : 'EVIDENCE_GROUNDING_REVIEW_REQUIRED';
      stopGateStatus = 'OPERATOR_INTERVENTION_REQUIRED';
      shouldContinue = false;

      const blockedQa = evaluateHumanWritingQuality(currentDraft, {
        articleId,
        taskId,
        evidencePack: input.evidencePack
      });
      lastQaResult = blockedQa;

      attempts.push({
        attemptNumber: attempt,
        startedAt: attemptStartTime,
        completedAt: new Date().toISOString(),
        llmLatencyMs: llmResult.latencyMs,
        tokenUsage: llmResult.usage,
        draftText: currentDraft,
        rawEnvelope: envelope,
        draftEnvelope: effectiveEnvelope,
        groundingAudit,
        assertionReconciliation: reconciliation,
        nadiaResult,
        qaResult: blockedQa
      });
      break;
    }

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
      rawEnvelope: envelope,
      draftEnvelope: effectiveEnvelope,
      groundingAudit,
      assertionReconciliation: reconciliation,
      nadiaResult,
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

  // 7b. Premium Editorial Depth Evaluation & Budi Visual Storytelling Dispatch Bridge
  let premiumDepthCheck: PremiumEditorialDepthChecklist | null = null;
  let visualBriefs: VisualBrief[] = [];
  let dispatchedMediaJobs: MediaJobRecord[] = [];

  if (currentDraft) {
    const contentFamily = intent?.primary_intent === 'COMPARISON' ? 'comparison' : 'explainer';
    premiumDepthCheck = evaluatePremiumEditorialDepth(currentDraft, {
      contentFamily,
      title: input.requestedTitle || input.topic,
      hasGenuineHandsOnEvidence: Boolean((input.evidencePack as any)?.hasGenuineHandsOnEvidence),
      hasVerifiedPrimaryEvidence: Boolean((input.evidencePack as any)?.hasVerifiedPrimaryEvidence)
    });

    if (premiumDepthCheck.visual_storytelling_need === 'REQUIRED') {
      const slug = (input.evidencePack as any)?.article_slug || input.topic.toLowerCase().replace(/[^a-z0-9]+/g, '-');
      visualBriefs = generateEditorialVisualBriefs({
        article_slug: slug,
        content: currentDraft,
        title: input.requestedTitle || input.topic,
        checklist: premiumDepthCheck,
        evidenceReferences: (input.evidencePack as any)?.primary_sources?.map((s: any) => s.name || s.title) || []
      });

      if (input.db && visualBriefs.length > 0) {
        const rawId = input.articleId ? Number(String(input.articleId).replace(/\D/g, '')) : null;
        if (rawId && !isNaN(rawId) && rawId > 0) {
          const dispatchRes = await dispatchEditorialVisualBriefs(input.db, {
            articleId: rawId,
            articleSlug: slug,
            articleTitle: input.requestedTitle || input.topic,
            briefs: visualBriefs,
            draftContentHash: (input.evidencePack as any)?.content_hash
          });
          dispatchedMediaJobs = dispatchRes.dispatched_jobs;
          addTraceEvent(
            'VISUAL_BRIEFS_DISPATCHED',
            'content_writer_primary',
            `Dimas menetapkan visual REQUIRED: ${visualBriefs.length} visual brief dikirim ke antrean Budi (lokamedia_worker_primary). Dispatched: ${dispatchRes.dispatched_jobs.length}, Existing: ${dispatchRes.existing_jobs.length}.`,
            {
              visualNeed: 'REQUIRED',
              briefCount: visualBriefs.length,
              dispatchedCount: dispatchRes.dispatched_jobs.length,
              existingCount: dispatchRes.existing_jobs.length
            }
          );
        }
      } else if (visualBriefs.length > 0) {
        addTraceEvent(
          'VISUAL_BRIEFS_GENERATED',
          'content_writer_primary',
          `Dimas menetapkan visual REQUIRED: ${visualBriefs.length} visual brief disiapkan untuk operator Budi.`,
          {
            visualNeed: 'REQUIRED',
            briefCount: visualBriefs.length
          }
        );
      }
    }
  }

  return {
    jobId: `job_${taskId}`,
    taskId,
    status: finalStatus,
    finalDecision,
    publicationStatus: 'DRAFT',
    humanStopGateStatus: stopGateStatus,
    finalDraft: currentDraft || lastAttempt?.draftText || lastAttempt?.draftEnvelope?.article_markdown || null,
    rawEnvelope: lastAttempt?.rawEnvelope || null,
    draftEnvelope: lastAttempt?.draftEnvelope || null,
    groundingAudit: lastAttempt?.groundingAudit || null,
    assertionReconciliation: lastAttempt?.assertionReconciliation || null,
    refinementAudit,
    editorialBrief,
    premiumDepthCheck,
    visualBriefs,
    dispatchedMediaJobs,
    totalAttempts: attempts.length,
    authorProvenance,
    qaResult: lastQaResult || lastAttempt?.qaResult || null,
    attempts,
    traceEvents,
    voice3L4Assessment: lastAttempt?.nadiaResult?.voice3L4Assessment || null,
    editorialVoiceLevel,
    error: lastLlmResult?.error,
    errorCategory: lastLlmResult?.errorCategory
  };
}
