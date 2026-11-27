/**
 * RancangLoka — Nadia: Audience & Language Editor Engine
 * Milestone: HERMES-NADIA-READER-VOICE
 *
 * Nadia's Canonical Role: Audience & Language Editor
 * Department: Editorial
 *
 * Canonical Principle:
 * "If the reader has to translate a RancangLoka sentence into everyday
 *  Indonesian inside their head, the sentence has failed."
 *
 * Technical sophistication must come from the quality of reasoning,
 * not from complicated vocabulary.
 *
 * RancangLoka should sound like an experienced Indonesian architecture/building
 * consultant calmly explaining a real problem to a homeowner across a table.
 *
 * NOT:
 * - academic journal
 * - translated English
 * - bureaucratic regulation
 * - marketing brochure
 * - generic AI explanatory prose
 *
 * Strict Invariants:
 * 1. AI Detector scores are ADVISORY ONLY (never decide PASS/REVISE).
 * 2. Nadia CANNOT publish, cannot approve publication, cannot invent facts,
 *    cannot mutate numbers or evidence claims.
 * 3. If simplification risks changing technical/factual meaning, FAIL CLOSED
 *    with READER_VOICE_BLOCKED.
 * 4. LANGUAGE_SIMPLIFICATION_MUST_PRESERVE_CLAIM_STRENGTH:
 *    Nadia must never strengthen a technical statement while simplifying it.
 */

import crypto from 'node:crypto';
import {
  getGoldenArticleReference,
  getVoiceAndToneGuide
} from './shared-memory-adapter.ts';
import { getStaffExperiences } from './olci-manager.ts';
import { evaluateEditorialCuriosityPrinciple } from './editorial-curiosity-principle.ts';
import { CANONICAL_SIGNATURE_EDITORIAL_VOICE } from '../article/editorial-knowledge.ts';
import type { EditorialLlmProvider } from './editorial-llm-provider.ts';

import {
  evaluateWarmAdvisoryTone,
  type EditorialWarmthChecklist,
  INVARIANT_WARM_ADVISORY_TONE,
  INVARIANT_COMPARISON_WARM_DECISION_HANDOFF,
  isComparisonContent,
  AGENCY_HANDOFF_INDICATORS
} from './warm-advisory-guard.ts';

import {
  evaluateLocalCulturalGrounding,
  type LocalCulturalChecklist,
  type LocalCulturalReviewQuestions,
  INVARIANT_LOCAL_CULTURAL_GROUNDING,
  INVARIANT_ANTI_CULTURAL_STEREOTYPE,
  INVARIANT_STANDARD_INDONESIAN_BASE
} from './local-cultural-guard.ts';

import {
  evaluatePremiumEditorialDepth,
  type PremiumEditorialDepthChecklist,
  INVARIANT_NO_UNVERIFIED_FIRST_HAND_AUTHORITY,
  INVARIANT_DECISION_DEPTH_7Q_NEXT,
  INVARIANT_FAILURE_ANATOMY,
  INVARIANT_MICRO_PERSONA_SCENARIOS,
  INVARIANT_EVIDENCE_METHOD_TRANSPARENCY,
  INVARIANT_VISUAL_STORYTELLING,
  INVARIANT_TESTED_BY_RANCANGLOKA_RESERVED
} from './premium-editorial-depth-guard.ts';

import {
  evaluateVoice3L4Assessment,
  type Voice3L4AssessmentResult,
  type L4EvaluationOptions,
  type L4DimensionResult
} from './nadia-voice-l4.ts';

import {
  CANONICAL_SHORT_PARAGRAPH_RULE,
  auditShortParagraphs,
  auditAllReaderFacingContent
} from '../article/editorial-knowledge.ts';

export {
  evaluateWarmAdvisoryTone,
  INVARIANT_WARM_ADVISORY_TONE,
  INVARIANT_COMPARISON_WARM_DECISION_HANDOFF,
  evaluateLocalCulturalGrounding,
  INVARIANT_LOCAL_CULTURAL_GROUNDING,
  INVARIANT_ANTI_CULTURAL_STEREOTYPE,
  INVARIANT_STANDARD_INDONESIAN_BASE,
  evaluatePremiumEditorialDepth,
  INVARIANT_NO_UNVERIFIED_FIRST_HAND_AUTHORITY,
  INVARIANT_DECISION_DEPTH_7Q_NEXT,
  INVARIANT_FAILURE_ANATOMY,
  INVARIANT_MICRO_PERSONA_SCENARIOS,
  INVARIANT_EVIDENCE_METHOD_TRANSPARENCY,
  INVARIANT_VISUAL_STORYTELLING,
  INVARIANT_TESTED_BY_RANCANGLOKA_RESERVED,
  evaluateVoice3L4Assessment
};
export type {
  EditorialWarmthChecklist,
  LocalCulturalChecklist,
  LocalCulturalReviewQuestions,
  PremiumEditorialDepthChecklist,
  Voice3L4AssessmentResult,
  L4EvaluationOptions,
  L4DimensionResult
};

export const INVARIANT_LANGUAGE_SIMPLIFICATION_MUST_PRESERVE_CLAIM_STRENGTH =
  'LANGUAGE_SIMPLIFICATION_MUST_PRESERVE_CLAIM_STRENGTH';

export type ContentFamily =
  | 'problem_solver'
  | 'system_decision'
  | 'comparison'
  | 'material_index'
  | 'reference'
  | 'explainer'
  | 'review';

export type ReaderVoiceWorkflowState =
  | 'READER_VOICE_REVIEW_REQUIRED'
  | 'READER_VOICE_PASS'
  | 'READER_VOICE_REVISION_REQUIRED'
  | 'READER_VOICE_BLOCKED';

export interface RubricDimensionResult {
  dimension: string;
  score: number;      // 0 - 100
  passed: boolean;
  notes: string[];
  flaggedPassages: Array<{
    passage: string;
    issue: string;
    suggestion?: string;
  }>;
}

export type SemanticEvaluatorType =
  | 'MODEL_SEMANTIC_EVALUATOR'
  | 'LOCAL_DETERMINISTIC_HEURISTICS'
  | 'TEST_SYNTHETIC_MOCK';

export const SECOND_BRAIN_SEMANTIC_CRITERIA = [
  'Natural Indonesian language',
  'Conversational sentence rhythm',
  'Ease of comprehension',
  'Reader-friendly opening',
  'Clear technical explanations',
  'Natural keyword integration',
  'Non-formulaic transitions',
  'Practical reader recommendations',
  'Consistency with Golden Article #9993'
] as const;

export interface SemanticVoiceFinding {
  criteria?: string;
  passage: string;
  issue: string;
  suggestion: string;
}

export interface SemanticVoiceEvaluatorOptions {
  manuscript: string;
  manuscriptSha256: string;
  goldenExemplar?: string;
  voiceGuide?: string;
  focusKeyword?: string;
}

export interface SemanticVoiceEvaluationResult {
  status: 'PASS' | 'REVISION_REQUIRED' | 'NOT_EVALUATED';
  score: number; // 0 - 100
  evaluatorType: SemanticEvaluatorType;
  cadenceAndRhythm: {
    score: number;
    notes: string[];
  };
  homeownerComprehension: {
    score: number;
    notes: string[];
  };
  organicKeywordIntegration: {
    score: number;
    notes: string[];
  };
  inspectedCriteria: string[];
  findings: SemanticVoiceFinding[];
  evaluationNote?: string;
  evaluatedAt: string;
  usage?: {
    promptTokens?: number;
    completionTokens?: number;
    totalTokens?: number;
  };
}

export type SemanticVoiceEvaluatorFn = (
  options: SemanticVoiceEvaluatorOptions
) => SemanticVoiceEvaluationResult | Promise<SemanticVoiceEvaluationResult>;

export interface ReaderVoiceEvaluationResult {
  decision: ReaderVoiceWorkflowState;
  overallScore: number;
  manuscript_sha256?: string;
  semanticStatus?: 'PASS' | 'REVISION_REQUIRED' | 'NOT_EVALUATED';
  semanticEvaluation?: SemanticVoiceEvaluationResult;
  dimensions: {
    problemFirstOpening: RubricDimensionResult;
    spokenIndonesian: RubricDimensionResult;
    translationese: RubricDimensionResult;
    jargonBudget: RubricDimensionResult;
    rawTechnicalSyntax: RubricDimensionResult;
    headingClarity: RubricDimensionResult;
    homeownerComprehension: RubricDimensionResult;
    humanRhythm: RubricDimensionResult;
    paragraphBreathing: RubricDimensionResult;
    warmAdvisoryTone: RubricDimensionResult;
    localCulturalGrounding: RubricDimensionResult;
  };
  warmthChecklist?: EditorialWarmthChecklist;
  localCulturalChecklist?: LocalCulturalChecklist;
  premiumDepthChecklist?: PremiumEditorialDepthChecklist;
  paragraphDensityWarnings?: string[];
  escapedMarkdownIssues?: string[];
  visualDensitySignals?: string[];
  authorityCheck: {
    attemptedPublishAction: boolean;
    attemptedEvidenceMutation: boolean;
    attemptedNumberAlteration: boolean;
    violationDetected: boolean;
  };
  aiDetectorAdvisory: {
    score: number | null;
    isAdvisoryOnly: true;
    usedForDecision: false;
    advisoryNote: string;
  };
  blockingIssues: Array<{
    passage: string;
    reason: string;
    technicalAmbiguityRisk: boolean;
  }>;
  revisionRequests: Array<{
    section: string;
    currentPhrasing: string;
    requestedImprovement: string;
  }>;
  voice3L4Assessment?: Voice3L4AssessmentResult;
  evaluatedAt: string;
}

// Banned generic opening phrases unless context genuinely requires them
export const BANNED_GENERIC_OPENING_PATTERNS = [
  /banyak pemilik rumah di indonesia/i,
  /dalam kehidupan modern/i,
  /seiring perkembangan/i,
  /pada dasarnya/i,
  /di era saat ini/i,
  /di zaman sekarang ini/i,
  /dalam era globalisasi/i,
  /seperti yang kita ketahui/i
];

// Common translationese terms and natural conversational Indonesian alternatives
export const TRANSLATIONESE_DICTIONARY: Record<string, string> = {
  'orientasi hadap': 'arah jendela atau arah hadap bangunan',
  'geometri peneduh': 'bentuk dan posisi peneduh',
  'intervensi': 'tindakan perbaikan / penanganan',
  'perolehan panas radiasi': 'panas radiasi matahari yang masuk',
  'bidang fenestrasi': 'bukaan jendela dan ventilasi',
  'titik kulminasi harian': 'posisi matahari tertinggi saat tengah hari',
  'akumulasi termal': 'penumpukan hawa panas',
  'selubung luar': 'dinding dan atap luar bangunan',
  'perangkat peneduh': 'peneduh atau kanopi pelindung',
  'leluasa membakar kaca': 'langsung mengenai kaca',
  'membedah perbandingan teknis': 'membandingkan',
  'membendung sinar matahari': 'menghalangi sinar matahari'
};

// Unnecessary heavy editorial/written constructions that feel unnatural when spoken
export const HEAVY_EDITORIAL_PATTERNS = [
  { pattern: /\bpanduan ini membedah\b/i, name: 'panduan ini membedah', suggestion: 'panduan ini membahas / membandingkan' },
  { pattern: /\bkarakter praktis\b/i, name: 'karakter praktis', suggestion: 'kelebihan dan kekurangan / sifat praktis' },
  { pattern: /\bkonsekuensi perawatan\b/i, name: 'konsekuensi perawatan', suggestion: 'perawatan yang perlu diperhatikan' },
  { pattern: /\bintervensi\b/i, name: 'intervensi', suggestion: 'tindakan perbaikan / penanganan' },
  { pattern: /\boptimalisasi\b/i, name: 'optimalisasi', suggestion: 'cara memaksimalkan / penyesuaian' },
  { pattern: /\bmekanisme\b/i, name: 'mekanisme', suggestion: 'cara kerja / sistem' },
  { pattern: /\bberdasarkan karakter masalah\b/i, name: 'berdasarkan karakter masalah', suggestion: 'sesuai masalah yang dihadapi' }
];

// Dramatic or sensational colloquial patterns that oscillate register
export const DRAMATIC_REGISTER_PATTERNS = [
  { pattern: /\bseperti oven\b/i, name: 'seperti oven', suggestion: 'sangat panas / suhu ruangan meningkat drastis' },
  { pattern: /\bgelap gulita\b/i, name: 'gelap gulita', suggestion: 'ruangan menjadi gelap / minim cahaya alami' },
  { pattern: /\bsiang bolong\b/i, name: 'siang bolong', suggestion: 'tengah hari / siang hari terik' },
  { pattern: /\bpanas menyiksa\b/i, name: 'panas menyiksa', suggestion: 'membuat gerah / tidak nyaman' },
  { pattern: /\bterbakar habis\b/i, name: 'terbakar habis', suggestion: 'terkena paparan panas terus-menerus' }
];

// Literal escaped Markdown syntax patterns that leak into reader prose
export const ESCAPED_MARKDOWN_PATTERNS = [
  { pattern: /\*\\\*/, name: 'mixed escaped asterisk (*\\*)' },
  { pattern: /\\\*/, name: 'escaped asterisk (\\*)' },
  { pattern: /\\---/, name: 'escaped thematic break (\\---)' },
  { pattern: /\*\*\\\*\*/, name: 'quadruple mixed emphasis (**\\**)' },
  { pattern: /\\\(|\s\\\//, name: 'escaped parenthesis/path (\\()' },
  { pattern: /\\_/, name: 'escaped underscore (\\_)' }
];

export const DENSE_PARAGRAPH_WORD_THRESHOLD = CANONICAL_SHORT_PARAGRAPH_RULE.max_words_per_paragraph; // 60 kata kanonikal

// Forbidden raw technical syntax in reader-facing prose
export const RAW_TECHNICAL_SYNTAX_PATTERNS = [
  /\$[A-Za-z0-9_^{}\\]+\$/,         // LaTeX math inline e.g. $SC_{eff}$
  /\\(?:frac|text|mathrm|alpha)/i,   // LaTeX commands
  /\{"[a-zA-Z0-9_]+":\s*"/,          // JSON object string
  /CLM-[A-Z0-9_-]+/i,               // Internal claim IDs
  /\[(?:TODO|AGENT_NOTE|DEBUG|INTERNAL)[^\]]*\]/i // Agent internal debug markers
];

/**
 * Validates that language simplification preserves technical certainty.
 * Invariant: LANGUAGE_SIMPLIFICATION_MUST_PRESERVE_CLAIM_STRENGTH
 * Nadia must never strengthen a technical statement while simplifying it.
 */
export function validateClaimStrengthPreservation(
  originalContent: string,
  proposedContent: string
): {
  preservesClaimStrength: boolean;
  invariant: string;
  violation?: string;
  technicalCertaintyAltered: boolean;
} {
  const orig = String(originalContent || '').toLowerCase();
  const prop = String(proposedContent || '').toLowerCase();

  // Test pairs where a hedged or qualified claim is simplified into an absolute / strengthened claim
  const claimPairs = [
    {
      hedge: /can reduce|dapat mengurangi|bisa mengurangi|membantu mengurangi/i,
      absolute: /turun drastis|menurunkan drastis/i,
      desc: 'can reduce / dapat mengurangi -> turun drastis'
    },
    {
      hedge: /helps reduce heat transfer|membantu mengurangi perambatan panas|membantu meredam|mengurangi laju panas/i,
      absolute: /panas tidak bisa masuk|panas tidak sempat merambat|panas tidak mungkin masuk/i,
      desc: 'helps reduce heat transfer -> panas tidak bisa masuk'
    },
    {
      hedge: /may improve|dapat meningkatkan|berpotensi meningkatkan|bisa membantu/i,
      absolute: /pasti meningkatkan|pasti membuat|pasti menghasilkan/i,
      desc: 'may improve -> pasti meningkatkan'
    }
  ];

  for (const pair of claimPairs) {
    if (pair.hedge.test(orig) && pair.absolute.test(prop)) {
      return {
        preservesClaimStrength: false,
        invariant: INVARIANT_LANGUAGE_SIMPLIFICATION_MUST_PRESERVE_CLAIM_STRENGTH,
        violation: `[${INVARIANT_LANGUAGE_SIMPLIFICATION_MUST_PRESERVE_CLAIM_STRENGTH}] Penguatan kepastian klaim teknis terdeteksi (${pair.desc}). Nadia dilarang memperkuat klaim ilmiah saat menyederhanakan bahasa.`,
        technicalCertaintyAltered: true
      };
    }
  }

  // General check: if proposed text introduces absolute claim strengthening not in original
  if (!/pasti meningkatkan/i.test(orig) && /pasti meningkatkan/i.test(prop)) {
    return {
      preservesClaimStrength: false,
      invariant: INVARIANT_LANGUAGE_SIMPLIFICATION_MUST_PRESERVE_CLAIM_STRENGTH,
      violation: `[${INVARIANT_LANGUAGE_SIMPLIFICATION_MUST_PRESERVE_CLAIM_STRENGTH}] Penguatan klaim dengan kata 'pasti meningkatkan' tanpa otorisasi bukti.`,
      technicalCertaintyAltered: true
    };
  }
  if (!/panas tidak bisa masuk/i.test(orig) && /panas tidak bisa masuk/i.test(prop)) {
    return {
      preservesClaimStrength: false,
      invariant: INVARIANT_LANGUAGE_SIMPLIFICATION_MUST_PRESERVE_CLAIM_STRENGTH,
      violation: `[${INVARIANT_LANGUAGE_SIMPLIFICATION_MUST_PRESERVE_CLAIM_STRENGTH}] Penguatan klaim dengan frasa 'panas tidak bisa masuk' melanggar hukum termal.`,
      technicalCertaintyAltered: true
    };
  }
  if (!/turun drastis/i.test(orig) && /turun drastis/i.test(prop)) {
    return {
      preservesClaimStrength: false,
      invariant: INVARIANT_LANGUAGE_SIMPLIFICATION_MUST_PRESERVE_CLAIM_STRENGTH,
      violation: `[${INVARIANT_LANGUAGE_SIMPLIFICATION_MUST_PRESERVE_CLAIM_STRENGTH}] Penguatan klaim penghematan dengan 'turun drastis' tanpa dasar empiris.`,
      technicalCertaintyAltered: true
    };
  }

  return {
    preservesClaimStrength: true,
    invariant: INVARIANT_LANGUAGE_SIMPLIFICATION_MUST_PRESERVE_CLAIM_STRENGTH,
    technicalCertaintyAltered: false
  };
}

/**
 * Genuine deterministic & semantic evaluator powered by Second Brain principles
 * Evaluates sentence rhythm, directness, and focus keyword naturalness without external paid APIs.
 */
export function evaluateSecondBrainSemanticVoice(opts: SemanticVoiceEvaluatorOptions): SemanticVoiceEvaluationResult {
  const manuscript = opts.manuscript || '';
  const focusKeyword = (opts.focusKeyword || '').toLowerCase().trim();
  const findings: SemanticVoiceFinding[] = [];
  const evaluatedAt = new Date().toISOString();

  // 1. Extract first and last sentences
  const bodyText = manuscript.replace(/^---[\s\S]*?---\s*/, '').replace(/<!--[\s\S]*?-->/g, '').trim();
  const rawParagraphs = bodyText.split(/\n\s*\n/).map(p => p.trim()).filter(p => p.length > 0 && !p.startsWith('#'));
  const firstPara = rawParagraphs[0] || '';
  const lastPara = rawParagraphs[rawParagraphs.length - 1] || '';

  const firstSentences = firstPara.split(/(?<=[.?!])\s+/).filter(s => s.trim().length > 5);
  const firstSentence = firstSentences[0] || firstPara;

  const lastSentences = lastPara.split(/(?<=[.?!])\s+/).filter(s => s.trim().length > 5);
  const lastSentence = lastSentences[lastSentences.length - 1] || lastPara;

  // Check 1: Organic Keyword Integration & Keyword Stiffness
  if (focusKeyword) {
    // Check if the focus keyword contains prohibited concatenation (/ + & |)
    if (/[\/+\&|;,]/.test(focusKeyword)) {
      findings.push({
        passage: firstSentence.slice(0, 140),
        issue: `Focus keyword "${focusKeyword}" memuat karakter penggabung (/ + &). Mengakibatkan kalimat pembuka kaku dan terdengar seperti formula mesin pencari.`,
        suggestion: `Gunakan keyword alami 2–4 kata yang luwes dalam percakapan sehari-hari tanpa simbol penggabung.`
      });
    }

    // Check if first sentence is overly stiff, mechanical, or keyword-stuffed (> 28 words with mechanical keyword phrasing)
    const firstLower = firstSentence.toLowerCase();
    const wordsInFirstSentence = firstSentence.split(/\s+/).filter(Boolean).length;
    if (wordsInFirstSentence > 28 && (firstLower.includes('perbandingan') || firstLower.includes('evaluasi karakteristik') || firstLower.includes('vs'))) {
      findings.push({
        passage: firstSentence.slice(0, 140),
        issue: 'Kalimat pembuka terlalu padat dan bernada laporan teknis/birokrasi daripada percakapan ramah seorang konsultan.',
        suggestion: 'Mulai dengan pertanyaan pemantik rasa penasaran atau keluhan umum pemilik rumah (contoh: "Pernah melihat cat plafon..."), lalu perkenalkan perbandingan material secara mengalir.'
      });
    }
  }

  // Check 2: Cadence & Sentence Rhythm (Monotone cadence or zero short breathing sentences)
  const allSentences = bodyText
    .split(/(?<=[.?!])\s+/)
    .map(s => s.trim())
    .filter(s => s.length > 10 && !s.startsWith('#'));

  const longSentencesCount = allSentences.filter(s => s.split(/\s+/).length > 30).length;
  const shortBreathingCount = allSentences.filter(s => s.split(/\s+/).length <= 12).length;

  if (allSentences.length >= 10 && shortBreathingCount === 0 && longSentencesCount > 5) {
    findings.push({
      passage: allSentences.slice(0, 2).join(' ').slice(0, 140),
      issue: 'Ritme kalimat monoton (seluruh kalimat panjang tanpa jeda napas kalimat pendek 5–12 kata).',
      suggestion: 'Sisipkan kalimat penegas pendek untuk memberi jeda ritme (contoh: "Sayangnya, cara ini jarang berhasil.", "Lain cerita kalau...")'
    });
  }

  // Check 3: Conversational grounding ("kamu" or "rumahmu" presence)
  const hasKamu = /\b(?:kamu|rumahmu)\b/i.test(manuscript);
  if (!hasKamu) {
    findings.push({
      passage: firstPara.slice(0, 140),
      issue: 'Naskah tidak menggunakan sapaan hangat "kamu" atau "rumahmu" khas Conversational Editorial 2.1.',
      suggestion: 'Gunakan sapaan akrab "kamu" dan "rumahmu" secara konsisten di seluruh naskah.'
    });
  }

  const passed = findings.length === 0;
  const score = passed ? 95 : Math.max(50, 85 - findings.length * 15);

  return {
    status: passed ? 'PASS' : 'REVISION_REQUIRED',
    score,
    evaluatorType: 'LOCAL_DETERMINISTIC_HEURISTICS',
    cadenceAndRhythm: {
      score: passed ? 95 : 70,
      notes: passed ? ['Ritme kalimat mengalir dengan jeda napas yang baik.'] : ['Ritme kalimat perlu variasi panjang-pendek.']
    },
    homeownerComprehension: {
      score: passed ? 95 : 75,
      notes: passed ? ['Bahasa ramah konsultan arsitektur.'] : ['Beberapa kalimat terasa kaku/birokratis.']
    },
    organicKeywordIntegration: {
      score: passed ? 95 : 65,
      notes: passed ? ['Keyword terintegrasi secara alami.'] : ['Keyword terintegrasi secara kaku atau mengandung frasa majemuk.']
    },
    inspectedCriteria: [
      'Organic keyword integration heuristics',
      'Cadence & breathing heuristics',
      'Persona pronoun presence'
    ],
    findings,
    evaluationNote: passed
      ? 'Evaluasi heuristik lokal lolos (Catatan: Ini adalah heuristik deterministik pra-evaluasi, bukan evaluasi model semantik).'
      : `Evaluasi heuristik lokal memerlukan revisi (${findings.length} temuan).`,
    evaluatedAt
  };
}

/**
 * Builds prompt for genuine Model-based Second Brain semantic evaluation.
 * Incorporates Golden Article #9993 and Voice & Tone Guide against the 9 criteria.
 */
export function buildSecondBrainSemanticEvaluationPrompt(opts: {
  manuscript: string;
  focusKeyword?: string;
  goldenExemplar?: string;
  voiceGuide?: string;
}): {
  systemPrompt: string;
  userPrompt: string;
  retrievedExperiences?: Array<{ experience_id: string; article_ref: string; validation: string; lesson_excerpt: string }>;
} {
  const goldenRef = opts.goldenExemplar || getGoldenArticleReference();
  const voiceGuide = opts.voiceGuide || getVoiceAndToneGuide();

  let nadiaLessonsBlock = '';
  let retrievedExperiences: Array<{ experience_id: string; article_ref: string; validation: string; lesson_excerpt: string }> = [];
  try {
    const experiences = getStaffExperiences('audience_language_editor', {
      onlyValidated: true,
      context_ref: opts.focusKeyword
    });
    if (experiences && experiences.length > 0) {
      retrievedExperiences = experiences.slice(0, 3).map(e => ({
        experience_id: e.experience_id,
        article_ref: e.article_ref,
        validation: e.validation,
        lesson_excerpt: (e.lesson || '').slice(0, 100)
      }));
      const lessons = experiences
        .filter(e => typeof e.lesson === 'string' && e.lesson.trim().length > 0)
        .slice(0, 3)
        .map((e, idx) => `[Pelajaran Editor ${idx + 1} (${e.experience_id})]: ${e.lesson!.trim()}`);
      if (lessons.length > 0) {
        nadiaLessonsBlock = `\n\n### LESSONS FROM SECOND BRAIN (EDITOR MEMORY):\n${lessons.join('\n')}\n(Terapkan evaluasi masa lalu ini pada peninjauan draf).\n`;
      }
    }
  } catch {
    // Fail-safe: retrieval does not block prompt building
  }

  const systemPrompt = `You are Nadia, Senior Audience & Language Editor of RancangLoka.
Your mission is to evaluate whether an architectural/home improvement article sounds like an experienced, warm Indonesian building consultant speaking relaxed, natural Indonesian to a homeowner across a table.

You must compare the manuscript against RancangLoka's Golden Benchmark (Article #9993) and Voice Standard.

9 CRITICAL EVALUATION CRITERIA:
1. Natural Indonesian language: Conversational, fluid Indonesian without translationese or academic stiff jargon.
2. Conversational sentence rhythm: Varied sentence lengths (short breathing sentences 5-12 words mixed with medium sentences), no monotonic drone.
3. Ease of comprehension: Explanations are immediate, relatable, and easy to grasp for ordinary homeowners.
4. Editorial Curiosity Principle: Headline must be a genuine question ending with '?', opening arouses homeowner curiosity with focus keyword naturally in the first sentence, and closing weaves focus keyword into the final sentence.
5. Clear technical explanations: Physical causes explained using everyday analogies before introducing technical names.
6. Natural keyword integration: The primary keyword flows organically without feeling forced, concatenated, or stuffed.
7. Non-formulaic transitions: Smooth, varied transitions (e.g., "Nah,", "Coba perhatikan,", "Lain cerita kalau,").
8. Practical reader recommendations: Concrete, actionable trade-offs and next steps rather than generic bureaucratic advice.
9. Consistency with Golden Article #9993: Emulates the warm, authoritative, yet casual voice of Article #9993.

SIGNATURE EDITORIAL VOICE & AUTHORIAL PRESENCE PRESERVATION:
- Philosophy: "${CANONICAL_SIGNATURE_EDITORIAL_VOICE.philosophy}"
- Authorial Presence: ${CANONICAL_SIGNATURE_EDITORIAL_VOICE.five_capability_pillars.editorial_intelligence.authorial_presence.guideline}
- Measured use of first-person "saya" for professional editorial evaluation (e.g. "Saya justru lebih menyarankan...", "Saya kurang menyarankan membongkar pot...") is strictly legitimate and valued. DO NOT flag or penalize "saya" when used for editorial judgment.
- Stance & Insight: ${CANONICAL_SIGNATURE_EDITORIAL_VOICE.five_capability_pillars.editorial_intelligence.editorial_stance.nature} Protect Joko's original insights without diluting them into neutral chatbot tone.
- Editorial Restraint & Economy: ${CANONICAL_SIGNATURE_EDITORIAL_VOICE.five_capability_pillars.editorial_maturity.editorial_restraint.guidelines[0]}
- Reader Value: ${CANONICAL_SIGNATURE_EDITORIAL_VOICE.five_capability_pillars.reader_value.curiosity_satisfaction}
- Reference the Rose Article learning case ("${CANONICAL_SIGNATURE_EDITORIAL_VOICE.editorial_learning_case_rose_article.title}") for mature restraint, organic rhythm, and memorable takeaways.

OUTPUT FORMAT:
Return strict JSON with this exact schema:
{
  "status": "PASS" | "REVISION_REQUIRED",
  "score": <number 0-100>,
  "evaluatorType": "MODEL_SEMANTIC_EVALUATOR",
  "reasoning": "<concise summary of conversational naturalness>",
  "findings": [
    {
      "criteria": "<one of the 9 criteria>",
      "passage": "<exact quote from manuscript under 120 chars>",
      "issue": "<why this passage feels stiff or unnatural>",
      "suggestion": "<actionable recommendation to make it natural and warm>"
    }
  ]
}`;

  const userPrompt = `### BENCHMARK REFERENCE (Golden Article #9993):
${goldenRef.slice(0, 1800)}

### VOICE & TONE STANDARD:
${voiceGuide.slice(0, 1200)}

### FOCUS KEYWORD:
${opts.focusKeyword || 'Tidak ditentukan'}
${nadiaLessonsBlock}
### MANUSCRIPT TO EVALUATE:
${opts.manuscript}

Evaluate this manuscript rigorously against the 9 criteria. If it feels stiff, unnatural, formulaic, or fails to deliver the reading pleasure of Article #9993, provide up to 5 highest-priority actionable findings with exact quotes, and set status to "REVISION_REQUIRED".`;

  return { systemPrompt, userPrompt, retrievedExperiences };
}

export const buildSemanticVoiceEvaluationPrompt = buildSecondBrainSemanticEvaluationPrompt;

/**
 * Creates a Model-based Semantic Voice Evaluator using an EditorialLlmProvider.
 * Fails closed to NOT_EVALUATED if provider is missing, unconfigured, or offline.
 */
export function createModelSemanticVoiceEvaluator(
  provider?: EditorialLlmProvider | null,
  options: { model?: string; maxTokens?: number } = {}
): SemanticVoiceEvaluatorFn {
  return async (evalOpts: SemanticVoiceEvaluatorOptions): Promise<SemanticVoiceEvaluationResult> => {
    const evaluatedAt = new Date().toISOString();

    if (!provider) {
      return {
        status: 'NOT_EVALUATED',
        score: 0,
        evaluatorType: 'MODEL_SEMANTIC_EVALUATOR',
        cadenceAndRhythm: { score: 0, notes: ['Provider tidak tersedia'] },
        homeownerComprehension: { score: 0, notes: ['Provider tidak tersedia'] },
        organicKeywordIntegration: { score: 0, notes: ['Provider tidak tersedia'] },
        inspectedCriteria: [...SECOND_BRAIN_SEMANTIC_CRITERIA],
        findings: [],
        evaluationNote: 'Model Semantic Evaluator tidak tersedia atau belum dikonfigurasi. Status: NOT_EVALUATED.',
        evaluatedAt
      };
    }

    try {
      const { systemPrompt, userPrompt } = buildSecondBrainSemanticEvaluationPrompt({
        manuscript: evalOpts.manuscript,
        focusKeyword: evalOpts.focusKeyword,
        goldenExemplar: evalOpts.goldenExemplar,
        voiceGuide: evalOpts.voiceGuide
      });

      const response = await provider.generate({
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt }
        ],
        model: options.model,
        maxTokens: options.maxTokens || 3500,
        temperature: 0.2
      });

      if (!response.content) {
        return {
          status: 'NOT_EVALUATED',
          score: 0,
          evaluatorType: 'MODEL_SEMANTIC_EVALUATOR',
          cadenceAndRhythm: { score: 0, notes: ['Respons LLM kosong'] },
          homeownerComprehension: { score: 0, notes: ['Respons LLM kosong'] },
          organicKeywordIntegration: { score: 0, notes: ['Respons LLM kosong'] },
          inspectedCriteria: [...SECOND_BRAIN_SEMANTIC_CRITERIA],
          findings: [],
          evaluationNote: 'Respons model kosong saat evaluasi semantik. Status: NOT_EVALUATED.',
          evaluatedAt
        };
      }

      const jsonMatch = response.content.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        throw new Error('Gagal mem-parse format JSON dari hasil evaluasi semantik model');
      }

      const parsed = JSON.parse(jsonMatch[0]);
      const status: 'PASS' | 'REVISION_REQUIRED' = parsed.status === 'PASS' ? 'PASS' : 'REVISION_REQUIRED';
      const findings: SemanticVoiceFinding[] = Array.isArray(parsed.findings) ? parsed.findings.map((f: any) => ({
        criteria: f.criteria || 'Conversational naturalness',
        passage: String(f.passage || '').slice(0, 140),
        issue: String(f.issue || 'Frasa kaku atau bernada birokratis'),
        suggestion: String(f.suggestion || 'Gunakan kalimat percakapan hangat khas konsultan arsitektur')
      })) : [];
      // Calculate score objectively without arbitrary 92/65 fallbacks
      const score = typeof parsed.score === 'number'
        ? Math.max(0, Math.min(100, parsed.score))
        : (status === 'PASS' && findings.length === 0 ? 88 : Math.max(45, 80 - findings.length * 10));

      return {
        status,
        score,
        evaluatorType: 'MODEL_SEMANTIC_EVALUATOR',
        cadenceAndRhythm: {
          score: status === 'PASS' ? score : Math.min(score, 70),
          notes: [parsed.reasoning || 'Evaluasi ritme dan kadens kalimat oleh model.']
        },
        homeownerComprehension: {
          score: status === 'PASS' ? score : Math.min(score, 75),
          notes: [parsed.reasoning || 'Evaluasi keterpahaman pembaca oleh model.']
        },
        organicKeywordIntegration: {
          score: status === 'PASS' ? score : Math.min(score, 70),
          notes: ['Evaluasi integrasi keyword oleh model.']
        },
        inspectedCriteria: [...SECOND_BRAIN_SEMANTIC_CRITERIA],
        findings,
        evaluationNote: parsed.reasoning || `Model Semantic Evaluator: ${status} (Skor: ${score})`,
        evaluatedAt,
        usage: response.usage
      };
    } catch (err: any) {
      return {
        status: 'NOT_EVALUATED',
        score: 0,
        evaluatorType: 'MODEL_SEMANTIC_EVALUATOR',
        cadenceAndRhythm: { score: 0, notes: [err.message] },
        homeownerComprehension: { score: 0, notes: [err.message] },
        organicKeywordIntegration: { score: 0, notes: [err.message] },
        inspectedCriteria: [...SECOND_BRAIN_SEMANTIC_CRITERIA],
        findings: [],
        evaluationNote: `Kendala evaluasi semantik model: ${err.message}. Status: NOT_EVALUATED.`,
        evaluatedAt
      };
    }
  };
}

/**
 * Nadia evaluates a text draft according to the canonical 8-part Reader Voice Rubric.
 */
export function evaluateReaderVoice(
  content: string,
  options: {
    advisoryAiDetectorScore?: number | null;
    allowSyntaxException?: boolean;
    title?: string;
    contentFamily?: ContentFamily | string;
    originalContent?: string;
    editorialVoiceLevel?: 'L3' | 'L4' | 'L5';
    enableVoiceL4?: boolean;
    enableVoiceL5?: boolean;
    enforceAllBlockBreathing?: boolean;
    focusKeyword?: string;
    goldenExemplar?: string;
    semanticEvaluator?: SemanticVoiceEvaluatorFn | null;
    requireSemanticEvaluator?: boolean;
    requireModelSemanticEvaluator?: boolean;
    enableSecondBrainSemantic?: boolean;
  } = {}
): ReaderVoiceEvaluationResult {
  const evaluatedAt = new Date().toISOString();

  // Safety Boundary Guard: Nadia cannot execute actions that alter facts or publish
  const authorityCheck = {
    attemptedPublishAction: false,
    attemptedEvidenceMutation: false,
    attemptedNumberAlteration: false,
    violationDetected: false
  };

  const blockingIssues: ReaderVoiceEvaluationResult['blockingIssues'] = [];
  const revisionRequests: ReaderVoiceEvaluationResult['revisionRequests'] = [];

  const rawText = String(content || '').trim();
  // Strip frontmatter and FAQ comment metadata blocks before evaluating prose paragraphs
  const textWithoutFrontmatter = rawText.replace(/^---[\s\S]*?---\s*/, '');
  const text = textWithoutFrontmatter.replace(/<!--\s*FAQ_START\s*-->[\s\S]*?<!--\s*FAQ_END\s*-->/gi, '').trim();
  const bodyText = text.replace(/^#+.*$/gm, '').trim();
  const paragraphs = bodyText
    .split(/\n\s*\n/)
    .map((p) => p.trim())
    .filter((p) => p.length > 0);

  const firstParagraph = paragraphs[0] || '';

  // --------------------------------------------------------------------------
  // Check for Claim Strengthening Violations (Fail Closed -> BLOCKED)
  // Invariant: LANGUAGE_SIMPLIFICATION_MUST_PRESERVE_CLAIM_STRENGTH
  // --------------------------------------------------------------------------
  const unsupportedClaimStrengtheningPatterns = [
    { pattern: /\btagihan listrik (?:bulanan )?(?:bisa )?turun drastis\b/i, name: 'tagihan listrik turun drastis' },
    { pattern: /\bpanas tidak bisa masuk\b/i, name: 'panas tidak bisa masuk' },
    { pattern: /\bpasti meningkatkan\b/i, name: 'pasti meningkatkan' },
    { pattern: /\bpanas tidak sempat merambat\b/i, name: 'panas tidak sempat merambat' }
  ];

  for (const csp of unsupportedClaimStrengtheningPatterns) {
    const match = text.match(csp.pattern);
    if (match) {
      blockingIssues.push({
        passage: match[0],
        reason: `[${INVARIANT_LANGUAGE_SIMPLIFICATION_MUST_PRESERVE_CLAIM_STRENGTH}] Penguatan kepastian klaim teknis tanpa bukti empiris (${csp.name}). Nadia mewajibkan klaim mempertahankan tingkat kepastian aslinya.`,
        technicalAmbiguityRisk: true
      });
    }
  }

  if (options.originalContent) {
    const claimPreserve = validateClaimStrengthPreservation(options.originalContent, content);
    if (!claimPreserve.preservesClaimStrength && claimPreserve.violation) {
      blockingIssues.push({
        passage: content.slice(0, 100),
        reason: claimPreserve.violation,
        technicalAmbiguityRisk: true
      });
    }
  }

  // --------------------------------------------------------------------------
  // Rubric A: CONTENT-FAMILY-AWARE OPENING (Search Intent First)
  // Invariant: FIRST PARAGRAPH MUST IMMEDIATELY SERVE READER SEARCH INTENT
  // --------------------------------------------------------------------------
  const openingNotes: string[] = [];
  const openingFlags: RubricDimensionResult['flaggedPassages'] = [];
  let openingScore = 100;

  for (const pattern of BANNED_GENERIC_OPENING_PATTERNS) {
    if (pattern.test(firstParagraph)) {
      openingScore -= 50;
      openingNotes.push(`Pembuka terdeteksi menggunakan formula klise generic AI: '${firstParagraph.slice(0, 70)}...'`);
      openingFlags.push({
        passage: firstParagraph.slice(0, 100),
        issue: 'Formula pembuka klise generic AI. Seharusnya berorientasi masalah nyata pemilik rumah.',
        suggestion: 'Mulai dengan pertanyaan spesifik, keluhan nyata, atau konflik keputusan pemilik rumah.'
      });
      revisionRequests.push({
        section: 'Pembuka Artikel (Introduction)',
        currentPhrasing: firstParagraph.slice(0, 120),
        requestedImprovement: 'Ganti dengan keluhan konkret pemilik rumah (mis. kamar lantai dua terasa panas sore hari meski AC menyala).'
      });
      break;
    }
  }

  // Determine content family for search-intent opening
  let family = (options.contentFamily || '').toLowerCase() as ContentFamily;
  if (!family) {
    const t = (options.title || '').toLowerCase();
    if (/ vs | perbandingan | memilih antara | atau /i.test(t)) {
      family = 'comparison';
    } else if (/memilih | sistem /i.test(t)) {
      family = 'system_decision';
    } else if (/apa itu | mengenal | definisi | indeks | material /i.test(t)) {
      family = 'explainer';
    } else if (/review | ulasan | uji /i.test(t)) {
      family = 'review';
    } else {
      family = 'problem_solver';
    }
  }

  let hasIntentSignal = false;
  if (family === 'problem_solver' || family === 'system_decision') {
    hasIntentSignal =
      firstParagraph.includes('?') ||
      /panas|pengap|bocor|rusak|masalah|keluhan|bingung|memilih|biaya|sore|siang|kamar|tagihan|rembes|retak|akibat/i.test(firstParagraph);
    if (!hasIntentSignal && openingScore > 60) {
      openingScore -= 20;
      openingNotes.push(`Pembuka untuk tipe '${family}' belum secara tajam memaparkan masalah atau keluhan nyata homeowner.`);
    }
  } else if (family === 'comparison') {
    hasIntentSignal =
      firstParagraph.includes('?') ||
      /memilih|pilihan|bingung antara|dibandingkan|mana yang lebih|kelebihan|kekurangan|antara|pertimbangan|alternatif|vs|komparasi/i.test(firstParagraph);
    if (!hasIntentSignal && openingScore > 60) {
      openingScore -= 20;
      openingNotes.push(`Pembuka untuk artikel komparasi belum langsung menyajikan konflik pilihan atau trade-off.`);
    }
  } else if (family === 'material_index' || family === 'reference' || family === 'explainer') {
    // Direct definition / explanation of material or concept immediately serves search intent
    hasIntentSignal =
      /adalah|merupakan|berfungsi|diformulasikan|dirancang|material|komponen|standar|pengertian|karakteristik/i.test(firstParagraph);
    if (!hasIntentSignal && openingScore > 60) {
      openingScore -= 20;
      openingNotes.push(`Pembuka untuk panduan/material belum langsung mendefinisikan fungsi atau karakteristik yang dicari pembaca.`);
    }
  } else if (family === 'review') {
    hasIntentSignal =
      /penggunaan|aplikasi|setelah dipakai|cocok untuk|pengujian|kondisi lapangan|daya tahan|pengalaman|rekomendasi|keandalan/i.test(firstParagraph);
    if (!hasIntentSignal && openingScore > 60) {
      openingScore -= 20;
      openingNotes.push(`Pembuka ulasan belum menyajikan konteks penggunaan nyata atau keputusan pembaca.`);
    }
  } else {
    hasIntentSignal = true;
  }

  const problemFirstOpening: RubricDimensionResult = {
    dimension: 'Problem-First Opening',
    score: Math.max(0, openingScore),
    passed: openingScore >= 75,
    notes: openingNotes,
    flaggedPassages: openingFlags
  };

  // --------------------------------------------------------------------------
  // Rubric B: SPOKEN INDONESIAN TEST
  // --------------------------------------------------------------------------
  const spokenNotes: string[] = [];
  const spokenFlags: RubricDimensionResult['flaggedPassages'] = [];
  let spokenScore = 100;

  // Search for overly robotic / passive-stacked bureaucratic expressions
  const roboticPatterns = [
    { pattern: /dapat dipertimbangkan bahwasanya/i, name: 'bahwasanya / birokratis' },
    { pattern: /hal mana yang mana/i, name: 'yang mana repetitif' },
    { pattern: /merupakan sebuah bentuk representasi dari/i, name: 'abstrak bertumpuk' },
    { pattern: /sebagaimana mestinya telah diatur dalam/i, name: 'bahasa birokrasi kaku' }
  ];

  for (const p of paragraphs) {
    for (const rob of roboticPatterns) {
      if (rob.pattern.test(p)) {
        spokenScore -= 15;
        spokenFlags.push({
          passage: p.slice(0, 100),
          issue: `Kalimat tidak lazim diucapkan seorang konsultan saat berbicara santai: ${rob.name}`,
          suggestion: 'Gunakan kalimat percakapan profesional yang langsung ke inti.'
        });
      }
    }
  }

  // Check dramatic / sensational register patterns
  for (const dram of DRAMATIC_REGISTER_PATTERNS) {
    if (dram.pattern.test(text)) {
      spokenScore -= 15;
      spokenNotes.push(`Terdeteksi ungkapan drama/sensasional yang tidak sesuai tone konsultan: '${dram.name}'.`);
      spokenFlags.push({
        passage: dram.name,
        issue: `Ungkapan drama/sensasional yang berlebihan: '${dram.name}'. Konsultan RancangLoka berbicara lugas, tenang, dan objektif.`,
        suggestion: dram.suggestion
      });
      revisionRequests.push({
        section: 'Konsistensi Register Bahasa',
        currentPhrasing: dram.name,
        requestedImprovement: `Ganti frasa drama '${dram.name}' dengan '${dram.suggestion}'.`
      });
    }
  }

  // Check heavy editorial phrases that feel overly academic/written instead of relaxed conversational
  // Exclude technical reference/bibliography sections from conversational style checks
  const referenceHeadingRegex = /##\s*(?:\d+[\.\)]\s*)?(?:Catatan Teknis|Catatan Telaah Teknis|Rujukan Standar|Referensi|Daftar Pustaka|Dasar Rujukan)[\s\S]*$/i;
  const narrativeProseOnly = text.replace(referenceHeadingRegex, '').trim();

  for (const heavy of HEAVY_EDITORIAL_PATTERNS) {
    if (heavy.pattern.test(narrativeProseOnly)) {
      spokenScore -= 15;
      spokenNotes.push(`Terdeteksi konstruksi editorial kaku/tertulis: '${heavy.name}' -> disarankan '${heavy.suggestion}'.`);
      spokenFlags.push({
        passage: heavy.name,
        issue: `Konstruksi editorial '${heavy.name}' terasa kaku/tertulis (written/editorial) dan tidak wajar diucapkan langsung ke pemilik rumah.`,
        suggestion: heavy.suggestion
      });
      revisionRequests.push({
        section: 'Gaya Bahasa Sehari-hari (Everyday Language Pass)',
        currentPhrasing: heavy.name,
        requestedImprovement: `Ganti frasa kaku '${heavy.name}' dengan ungkapan yang lebih alami '${heavy.suggestion}'.`
      });
    }
  }

  const spokenIndonesian: RubricDimensionResult = {
    dimension: 'Spoken Indonesian Test',
    score: Math.max(0, spokenScore),
    passed: spokenScore >= 75,
    notes: spokenNotes,
    flaggedPassages: spokenFlags
  };

  // --------------------------------------------------------------------------
  // Rubric C: TRANSLATIONESE CHECK
  // --------------------------------------------------------------------------
  const transNotes: string[] = [];
  const transFlags: RubricDimensionResult['flaggedPassages'] = [];
  let transScore = 100;

  for (const [term, naturalAlternative] of Object.entries(TRANSLATIONESE_DICTIONARY)) {
    const regex = new RegExp(`\\b${term}\\b`, 'gi');
    if (regex.test(text)) {
      transScore -= 12;
      transNotes.push(`Terdeteksi konstruksi terjemahan kaku: '${term}' -> disarankan '${naturalAlternative}'.`);
      transFlags.push({
        passage: term,
        issue: `Frasa kaku bernuansa terjemahan literal bahasa Inggris: '${term}'.`,
        suggestion: naturalAlternative
      });
      revisionRequests.push({
        section: 'Pilihan Kata & Bahasa Alami',
        currentPhrasing: term,
        requestedImprovement: `Ganti frasa kaku '${term}' dengan ungkapan alami '${naturalAlternative}'.`
      });
    }
  }

  const translationese: RubricDimensionResult = {
    dimension: 'Translationese Check',
    score: Math.max(0, transScore),
    passed: transScore >= 75,
    notes: transNotes,
    flaggedPassages: transFlags
  };

  // --------------------------------------------------------------------------
  // Rubric D: JARGON BUDGET
  // --------------------------------------------------------------------------
  const jargonNotes: string[] = [];
  const jargonFlags: RubricDimensionResult['flaggedPassages'] = [];
  let jargonScore = 100;

  // Excessive untranslated English jargon or ungrounded acronyms
  const excessiveEnglishTerms = [
    /solar heat gain coefficient/i,
    /shading coefficient/i,
    /thermal comfort/i,
    /building envelope/i,
    /cross ventilation/i
  ];

  for (const pattern of excessiveEnglishTerms) {
    const globalPattern = new RegExp(pattern.source, 'gi');
    const matches = text.match(globalPattern);
    if (matches && matches.length >= 2) {
      jargonScore -= 15 * (matches.length - 1);
      jargonNotes.push(`Terminologi asing berulang tanpa penjelasan konsisten: '${matches[0]}' (${matches.length}x).`);
      jargonFlags.push({
        passage: matches[0],
        issue: `Terminologi asing '${matches[0]}' dipakai berulang kali (${matches.length}x) tanpa penjelasan sederhana.`,
        suggestion: 'Berikan penjelasan sederhana pada kemunculan pertama, lalu gunakan padanan bahasa Indonesia yang konsisten.'
      });
    }
  }

  const jargonBudget: RubricDimensionResult = {
    dimension: 'Jargon Budget',
    score: Math.max(0, jargonScore),
    passed: jargonScore >= 75,
    notes: jargonNotes,
    flaggedPassages: jargonFlags
  };

  // --------------------------------------------------------------------------
  // Rubric E: RAW TECHNICAL SYNTAX & MARKDOWN CLEANLINESS
  // --------------------------------------------------------------------------
  const syntaxNotes: string[] = [];
  const syntaxFlags: RubricDimensionResult['flaggedPassages'] = [];
  let syntaxScore = 100;
  const escapedMarkdownIssues: string[] = [];

  // Check for escaped markdown syntax leakage
  for (const esc of ESCAPED_MARKDOWN_PATTERNS) {
    if (esc.pattern.test(text)) {
      escapedMarkdownIssues.push(esc.name);
      syntaxScore -= 20;
      syntaxNotes.push(`Terdeteksi kebocoran sintaks markdown escape: ${esc.name}.`);
      syntaxFlags.push({
        passage: esc.name,
        issue: `Sintaks markdown ter-escape (${esc.name}) merusak tampilan naskah bagi pembaca.`,
        suggestion: 'Hapus backslash escape dan gunakan markdown kanonikal murni.'
      });
      revisionRequests.push({
        section: 'Kebersihan Format Markdown',
        currentPhrasing: esc.name,
        requestedImprovement: `Hapus backslash escape (${esc.name}) agar rendered output bersih.`
      });
    }
  }

  if (!options.allowSyntaxException) {
    for (const pat of RAW_TECHNICAL_SYNTAX_PATTERNS) {
      const match = text.match(pat);
      if (match) {
        syntaxScore = 0; // Strict fail closed for raw debug/syntax leakage
        syntaxNotes.push(`Terdeteksi sintaks teknis mentah dalam naskah pembaca: '${match[0]}'.`);
        syntaxFlags.push({
          passage: match[0],
          issue: 'Sintaks mentah (LaTeX math, JSON, debug tag, atau CLM ID) bocor ke naskah publik.',
          suggestion: 'Jelaskan variabel dalam kalimat bahasa Indonesia biasa.'
        });

        blockingIssues.push({
          passage: match[0],
          reason: 'Bocoran sintaks teknis mentah (LaTeX/debug/CLM) yang merusak keterbacaan publik.',
          technicalAmbiguityRisk: false
        });
      }
    }
  }

  const rawTechnicalSyntax: RubricDimensionResult = {
    dimension: 'Raw Technical Syntax',
    score: Math.max(0, syntaxScore),
    passed: syntaxScore >= 75 && blockingIssues.length === 0,
    notes: syntaxNotes,
    flaggedPassages: syntaxFlags
  };

  // --------------------------------------------------------------------------
  // Rubric F: HEADING TEST
  // --------------------------------------------------------------------------
  const headingNotes: string[] = [];
  const headingFlags: RubricDimensionResult['flaggedPassages'] = [];
  let headingScore = 100;

  const headings = text
    .split('\n')
    .filter((line) => line.startsWith('#'))
    .map((h) => h.replace(/^#+\s*/, '').trim());

  // Check for overly academic/abstract headings
  const academicHeadingPattern = /(?:analisis|evaluasi|optimasi|studi komparatif|akumulasi termal|metodologi|korelasi|persamaan)/i;
  for (const h of headings) {
    if (academicHeadingPattern.test(h)) {
      headingScore -= 30;
      headingNotes.push(`Tajuk bernuansa makalah akademis kaku: '${h}'.`);
      headingFlags.push({
        passage: h,
        issue: 'Tajuk terlalu akademis; tidak membantu pembaca yang sedang scanning mencari solusi masalah rumah.',
        suggestion: 'Ubah tajuk menjadi pertanyaan atau panduan masalah langsung pemilik rumah.'
      });
      revisionRequests.push({
        section: `Tajuk: ${h}`,
        currentPhrasing: h,
        requestedImprovement: 'Ubah ke bentuk pertanyaan konkret atau panduan problem solving (mis. Mengapa kamar barat tetap panas?).'
      });
    }
  }

  const headingClarity: RubricDimensionResult = {
    dimension: 'Heading Test',
    score: Math.max(0, headingScore),
    passed: headingScore >= 75,
    notes: headingNotes,
    flaggedPassages: headingFlags
  };

  // --------------------------------------------------------------------------
  // Rubric G: COMPREHENSION TEST
  // --------------------------------------------------------------------------
  let compScore = 100;
  const compNotes: string[] = [];
  const compFlags: RubricDimensionResult['flaggedPassages'] = [];

  // Homeowner needs: problem, cause, options, tradeoffs, next actions
  const hasTradeoffs = /kelebihan|kekurangan|kelemahan|konsekuensi|risiko|biaya|perawatan/i.test(text);
  const hasNextAction = /langkah|periksa|cek|konsultasi|pilihan|rekomendasi|sebelum/i.test(text);

  if (!hasTradeoffs) {
    compScore -= 20;
    compNotes.push('Naskah belum memaparkan perbandingan komparatif / konsekuensi pilihan secara gamblang.');
  }

  if (!hasNextAction) {
    compScore -= 20;
    compNotes.push('Naskah belum memberikan panduan langkah periksa atau tindakan selanjutnya bagi pemilik rumah.');
  }

  const homeownerComprehension: RubricDimensionResult = {
    dimension: 'Comprehension Test',
    score: Math.max(0, compScore),
    passed: compScore >= 75,
    notes: compNotes,
    flaggedPassages: compFlags
  };

  // --------------------------------------------------------------------------
  // Rubric H: HUMAN RHYTHM
  // --------------------------------------------------------------------------
  let rhythmScore = 100;
  const rhythmNotes: string[] = [];
  const rhythmFlags: RubricDimensionResult['flaggedPassages'] = [];

  // Check paragraph length diversity
  const pLengths = paragraphs.map((p) => p.split(/\s+/).length);
  if (pLengths.length >= 3) {
    const isUniform = pLengths.every((len) => Math.abs(len - pLengths[0]) < 8);
    if (isUniform) {
      rhythmScore -= 20;
      rhythmNotes.push('Panjang paragraf terlalu seragam, menciptakan ritme monoton khas teks sintetis generik.');
    }
  }

  // Check for excessive parenthetical citations or explanations
  const parenthesesCount = (text.match(/\([^)]+\)/g) || []).length;
  if (parenthesesCount > 25) {
    rhythmScore -= 20;
    rhythmNotes.push(`Terlalu banyak tanda kurung (${parenthesesCount}), mengganggu kenyamanan aliran membaca pembaca.`);
  }

  const humanRhythm: RubricDimensionResult = {
    dimension: 'Human Rhythm',
    score: Math.max(0, rhythmScore),
    passed: rhythmScore >= 75,
    notes: rhythmNotes,
    flaggedPassages: rhythmFlags
  };

  // --------------------------------------------------------------------------
  // Rubric I: PARAGRAPH BREATHING & DENSITY CHECK (ED-PARA-01)
  // --------------------------------------------------------------------------
  const paragraphDensityWarnings: string[] = [];
  const denseParagraphFlags: RubricDimensionResult['flaggedPassages'] = [];
  const denseParagraphNotes: string[] = [];
  let breathingScore = 100;

  const paraAudit = auditShortParagraphs(content);
  if (!paraAudit.passed) {
    for (const item of paraAudit.items.filter((i) => i.isViolation)) {
      const isHardViolation = item.wordCount > 90;
      if (isHardViolation) {
        breathingScore -= Math.min(30, Math.floor((item.wordCount - 80) / 10) * 10);
        const warningMsg = `PARAGRAPH_DENSITY_WARNING: Paragraf narasi ke-${item.index} (${item.wordCount} kata) melebihi batas kanonikal 90 kata. Pecah menjadi 1-3 kalimat dengan satu ide pokok.`;
        paragraphDensityWarnings.push(warningMsg);
        denseParagraphNotes.push(warningMsg);
        denseParagraphFlags.push({
          passage: item.text.slice(0, 100) + '...',
          issue: warningMsg,
          suggestion: `Pecah menjadi paragraf pendek-menengah (ideal ${CANONICAL_SHORT_PARAGRAPH_RULE.ideal_words_min}-${CANONICAL_SHORT_PARAGRAPH_RULE.ideal_words_max} kata, maks ${CANONICAL_SHORT_PARAGRAPH_RULE.max_words_per_paragraph} kata, maks ${CANONICAL_SHORT_PARAGRAPH_RULE.max_sentences_per_paragraph} kalimat).`
        });
        revisionRequests.push({
          section: `Paragraf narasi ke-${item.index}`,
          currentPhrasing: item.text.slice(0, 80) + '...',
          requestedImprovement: warningMsg
        });
      } else {
        // Soft advisory density signal (61-90 words)
        breathingScore -= 5;
        const advisoryMsg = `ADVISORY_PARAGRAPH_DENSITY: Paragraf narasi ke-${item.index} (${item.wordCount} kata) berada di zona transisi (61-90 kata). Disarankan di bawah 60 kata untuk kenyamanan baca mobile.`;
        denseParagraphNotes.push(advisoryMsg);
      }
    }
  }

  // Conversational 2.1: Audit all list items and reader blocks (opt-in or when enabled)
  if (options?.enforceAllBlockBreathing) {
    const fullBlockAudit = auditAllReaderFacingContent(content);
    if (!fullBlockAudit.passed) {
      for (const item of fullBlockAudit.items.filter((i) => i.isViolation)) {
        if (item.type !== 'narrative_paragraph') {
          const penalty = Math.min(20, 8 + (item.wordCount - CANONICAL_SHORT_PARAGRAPH_RULE.max_words_per_paragraph));
          breathingScore -= penalty;
          const warningMsg = `READER_BLOCK_DENSITY_WARNING: Butir ${item.type} ke-${item.index} (${item.wordCount} kata) melanggar batas kanonikal (maks ${CANONICAL_SHORT_PARAGRAPH_RULE.max_words_per_paragraph} kata). Pecah menjadi penjelasan ringkas mengalir.`;
          paragraphDensityWarnings.push(warningMsg);
          denseParagraphNotes.push(warningMsg);
          denseParagraphFlags.push({
            passage: item.text.slice(0, 100) + '...',
            issue: warningMsg,
            suggestion: 'Ringkas butir daftar atau pecah menjadi paragraf narasi pendek terpisah.'
          });
        }
      }
    }
  }

  // Visual Density Signal & Scannability for Tables / Comparison Matrices
  const visualDensitySignals: string[] = [];
  const tableLines = text.split('\n').filter((line) => line.trim().startsWith('|'));
  tableLines.forEach((line, idx) => {
    if (/^\|[\s\-:|]+\|$/.test(line.trim())) return;
    const cells = line.split('|').map((c) => c.trim()).filter(Boolean);
    cells.forEach((cell) => {
      const words = cell.split(/\s+/).filter(Boolean).length;
      if (words > 20) {
        const signal = `VISUAL_DENSITY_SIGNAL: Sel tabel baris ${idx + 1} (${words} kata) melebihi batas ringkas 20 kata: "${cell.slice(0, 50)}...". Buat ringkas agar mudah discan di mobile dan desktop.`;
        visualDensitySignals.push(signal);
      }
    });
  });

  if (visualDensitySignals.length > 0) {
    denseParagraphNotes.push(...visualDensitySignals);
  }

  const paragraphBreathing: RubricDimensionResult = {
    dimension: 'Paragraph Breathing',
    score: Math.max(0, breathingScore),
    passed: breathingScore >= 75 && paragraphDensityWarnings.length === 0,
    notes: denseParagraphNotes,
    flaggedPassages: denseParagraphFlags
  };

  // --------------------------------------------------------------------------
  // Rubric J: WARM ADVISORY TONE & DECISION HANDOFF (Dimas System Guard)
  // Invariant: INVARIANT_WARM_ADVISORY_TONE & INVARIANT_COMPARISON_WARM_DECISION_HANDOFF
  // Canonical review questions:
  // 1. Does this sound like a human expert speaking to a homeowner?
  // 2. Does the article remain approachable after technical sections?
  // 3. Are recommendations confident without sounding authoritarian?
  // 4. Does the reader feel guided rather than judged?
  // 5. Does the ending leave the reader with clarity and calm confidence?
  // 6. Could this sentence be spoken naturally in a real consultation?
  // --------------------------------------------------------------------------
  const warmthChecklist = evaluateWarmAdvisoryTone(content, {
    contentFamily: options.contentFamily,
    title: options.title
  });

  const warmthFlags: RubricDimensionResult['flaggedPassages'] = warmthChecklist.flags.map((f) => ({
    passage: f.passage || '',
    issue: f.description,
    suggestion: f.type === 'MISSING_COMPARISON_HANDOFF'
      ? 'Tambahkan serah-terima keputusan hangat di akhir artikel (COMPARISON_WARM_DECISION_HANDOFF) yang mengembalikan agensi ke kondisi nyata dan prioritas rumah pembaca.'
      : 'Gunakan nada bicara konsultan yang hangat, komunikatif, dan praktis. Hindari penutup kaku seperti laporan atau klise chatbot AI.'
  }));

  if (warmthChecklist.warm_advisory_tone !== 'PASS') {
    revisionRequests.push({
      section: 'Nada Konsultan & Serah-Terima Keputusan (Warm Advisory Tone)',
      currentPhrasing: warmthChecklist.closing_passage.slice(0, 120),
      requestedImprovement: warmthChecklist.is_comparison
        ? 'Tambahkan serah-terima keputusan hangat di akhir artikel (COMPARISON_WARM_DECISION_HANDOFF) yang mengembalikan agensi ke kondisi nyata dan prioritas rumah pembaca.'
        : 'Gunakan nada bicara konsultan yang hangat, komunikatif, dan praktis. Hindari penutup kaku seperti laporan atau klise chatbot AI.'
    });
  }

  const warmAdvisoryScore = warmthChecklist.warm_advisory_tone === 'PASS'
    ? 100
    : Math.max(50, 100 - warmthChecklist.flags.length * 25);

  const warmAdvisoryTone: RubricDimensionResult = {
    dimension: 'Warm Advisory Tone',
    score: warmAdvisoryScore,
    passed: warmthChecklist.warm_advisory_tone === 'PASS',
    notes: warmthChecklist.evaluation_notes,
    flaggedPassages: warmthFlags
  };

  // --------------------------------------------------------------------------
  // Rubric K: LOCAL CULTURAL GROUNDING (Dimas System Guard & Nadia Gate)
  // Milestone: RANCANGLOKA_LOCAL_CULTURAL_GROUNDING_1
  // Invariant: INVARIANT_LOCAL_CULTURAL_GROUNDING & INVARIANT_ANTI_CULTURAL_STEREOTYPE
  // Canonical review questions:
  // 1. Does this sound like an Indonesian expert speaking naturally to an Indonesian homeowner?
  // 2. Are examples recognizable within Indonesian housing reality?
  // 3. Does the article feel translated from an English source, even though the words are Indonesian?
  // 4. Are technical terms expressed using vocabulary familiar in Indonesian construction / homeowner conversations?
  // 5. Are local idioms natural rather than inserted performatively?
  // 6. Does the article avoid unsupported stereotypes about Indonesian people?
  // 7. Could this explanation plausibly occur in a real consultation between an Indonesian homeowner and an experienced building consultant?
  // --------------------------------------------------------------------------
  const localCulturalChecklist = evaluateLocalCulturalGrounding(content, {
    contentFamily: options.contentFamily,
    title: options.title
  });

  const localCulturalFlags: RubricDimensionResult['flaggedPassages'] = localCulturalChecklist.flags.map((f) => ({
    passage: f.passage || '',
    issue: f.description,
    suggestion: f.type === 'CULTURAL_STEREOTYPE_OVERREACH' || f.type === 'UNSUPPORTED_LOCAL_GENERALIZATION'
      ? 'Hapus generalisasi stereotip tentang orang/rumah Indonesia. Gunakan observasi berbasis konteks dan bukti.'
      : f.type === 'TRANSLATIONESE_RESIDUAL'
      ? 'Ganti struktur kalimat terjemahan kaku dengan ungkapan percakapan bahasa Indonesia yang alami.'
      : 'Bumikan penjelasan teknis ke realitas fisik hunian tropis dan kebiasaan perawatan rumah di Indonesia.'
  }));

  if (localCulturalChecklist.local_cultural_grounding !== 'PASS') {
    revisionRequests.push({
      section: 'Pijakan Realitas & Budaya Lokal (Local Cultural Grounding)',
      currentPhrasing: localCulturalChecklist.flags.map((f) => f.description).join('; ') || 'Pijakan konteks lokal perlu diperkuat',
      requestedImprovement: 'Sesuaikan naskah agar berbicara dari realitas fisik hunian, iklim, dan perawatan rumah Indonesia tanpa generalisasi stereotip atau struktur terjemahan kaku.'
    });
  }

  const localCulturalScore = localCulturalChecklist.local_cultural_grounding === 'PASS'
    ? 100
    : Math.max(50, 100 - localCulturalChecklist.flags.length * 25);

  const localCulturalGrounding: RubricDimensionResult = {
    dimension: 'Local Cultural Grounding',
    score: localCulturalScore,
    passed: localCulturalChecklist.local_cultural_grounding === 'PASS',
    notes: localCulturalChecklist.evaluation_notes,
    flaggedPassages: localCulturalFlags
  };

  // --------------------------------------------------------------------------
  // Aggregated Overall Score (Mean across 11 dimensions)
  // --------------------------------------------------------------------------
  const allDimensionScores = [
    problemFirstOpening.score,
    spokenIndonesian.score,
    translationese.score,
    jargonBudget.score,
    rawTechnicalSyntax.score,
    headingClarity.score,
    homeownerComprehension.score,
    humanRhythm.score,
    paragraphBreathing.score,
    warmAdvisoryTone.score,
    localCulturalGrounding.score
  ];

  const overallScore = Math.round(
    allDimensionScores.reduce((sum, s) => sum + s, 0) / allDimensionScores.length
  );

  // --------------------------------------------------------------------------
  // AI Detector Policy: Advisory Only
  // --------------------------------------------------------------------------
  const aiDetectorAdvisory: ReaderVoiceEvaluationResult['aiDetectorAdvisory'] = {
    score: options.advisoryAiDetectorScore ?? null,
    isAdvisoryOnly: true,
    usedForDecision: false,
    advisoryNote:
      'Skor AI detector adalah indikator pendukung informasi saja (advisory only). ' +
      'Nadia mengevaluasi kualitas berdasarkan pemahaman pembaca, bahasa Indonesia alami, ' +
      'ritme manusia, dan kejelasan keputusan — bukan persentase detektor eksternal.'
  };

  // --------------------------------------------------------------------------
  // Rubric L: PREMIUM EDITORIAL DEPTH (Dimas System Guard & Nadia Usefulness Gate)
  // Milestone: RANCANGLOKA_PREMIUM_EDITORIAL_DEPTH_1
  // Invariants:
  // - INVARIANT_NO_UNVERIFIED_FIRST_HAND_AUTHORITY
  // - INVARIANT_DECISION_DEPTH_7Q_NEXT
  // - INVARIANT_FAILURE_ANATOMY
  // - INVARIANT_MICRO_PERSONA_SCENARIOS
  // --------------------------------------------------------------------------
  const premiumDepthChecklist = evaluatePremiumEditorialDepth(content, {
    contentFamily: options.contentFamily,
    title: options.title
  });

  if (premiumDepthChecklist.first_hand_claim_safety === 'BLOCKED') {
    blockingIssues.push({
      reason: `[${INVARIANT_NO_UNVERIFIED_FIRST_HAND_AUTHORITY}] Klaim otoritas langsung/pengalaman lapangan fiktif atau testimoni rekaan terdeteksi tanpa bukti primer terverifikasi.`,
      passage: premiumDepthChecklist.flags.map((f) => f.description).join('; '),
      technicalAmbiguityRisk: true
    });
  }

  if (premiumDepthChecklist.failure_anatomy === 'REVISION_REQUIRED') {
    revisionRequests.push({
      section: 'Anatomi Kegagalan (Failure Anatomy)',
      currentPhrasing: 'Pembahasan belum mencakup bagaimana keputusan atau pemasangan dapat gagal',
      requestedImprovement: 'Jelaskan bagaimana pilihan atau aplikasi dapat gagal (akibat salah orientasi, salah urutan, atau kendala perawatan) agar pembaca paham risiko teknisnya.'
    });
  }

  if (premiumDepthChecklist.flags.some((f) => f.type === 'DECISION_DEPTH_GAP')) {
    revisionRequests.push({
      section: 'Kedalaman Keputusan (Decision Depth 7Q + Next)',
      currentPhrasing: 'Informasi teknis belum sepenuhnya mendukung agensi keputusan pembaca',
      requestedImprovement: 'Lengkapi dimensi kedalaman keputusan: untuk siapa relevan, skenario situasi hunian pembaca, dan langkah aksi nyata berikutnya.'
    });
  }

  // --------------------------------------------------------------------------
  // Decision Resolution (Strict Fail Closed Hierarchy & State Semantics Separation)
  // Invariant:
  // READER_VOICE_BLOCKED: ONLY for technical ambiguity / meaning-preservation risk / claim strengthening / raw syntax leakage
  // READER_VOICE_REVISION_REQUIRED: ONLY for language/readability problems
  // --------------------------------------------------------------------------
  let decision: ReaderVoiceWorkflowState = 'READER_VOICE_PASS';

  if (blockingIssues.length > 0) {
    decision = 'READER_VOICE_BLOCKED';
  } else if (
    !problemFirstOpening.passed ||
    !spokenIndonesian.passed ||
    !translationese.passed ||
    !jargonBudget.passed ||
    !rawTechnicalSyntax.passed ||
    !headingClarity.passed ||
    !homeownerComprehension.passed ||
    !humanRhythm.passed ||
    !paragraphBreathing.passed ||
    !warmAdvisoryTone.passed ||
    !localCulturalGrounding.passed ||
    premiumDepthChecklist.failure_anatomy === 'REVISION_REQUIRED' ||
    premiumDepthChecklist.micro_persona_scenario === 'REVISION_REQUIRED' ||
    overallScore < 80
  ) {
    decision = 'READER_VOICE_REVISION_REQUIRED';
  }

  const isVoiceL4OrL5 = (options.editorialVoiceLevel === 'L4' || options.editorialVoiceLevel === 'L5' || options.enableVoiceL4 === true || options.enableVoiceL5 === true) ||
    process.env.HERMES_EDITORIAL_VOICE_LEVEL === 'L4' ||
    process.env.HERMES_EDITORIAL_VOICE_LEVEL === 'L5' ||
    process.env.FEATURE_VOICE_3_L4 === 'true' ||
    process.env.FEATURE_VOICE_3_L5 === 'true';

  let voice3L4Assessment: Voice3L4AssessmentResult | undefined;
  if (isVoiceL4OrL5) {
    voice3L4Assessment = evaluateVoice3L4Assessment(content, {
      topic: options.title,
      title: options.title,
      articleType: options.contentFamily,
      editorialVoiceLevel: options.editorialVoiceLevel === 'L5' || options.enableVoiceL5 ? 'L5' : 'L4'
    });
    if (voice3L4Assessment.decision === 'VOICE_3_L4_REVISION_REQUIRED' && decision === 'READER_VOICE_PASS') {
      decision = 'READER_VOICE_REVISION_REQUIRED';
    }
  }

  // --------------------------------------------------------------------------
  // Cryptographic Hash & Genuine Second Brain Semantic Evaluation Gate
  // --------------------------------------------------------------------------
  const manuscript_sha256 = crypto.createHash('sha256').update(rawText, 'utf8').digest('hex');

  let semanticStatus: 'PASS' | 'REVISION_REQUIRED' | 'NOT_EVALUATED' = 'PASS';
  let semanticEvaluation: SemanticVoiceEvaluationResult | undefined;

  if (options.requireSemanticEvaluator === true && options.semanticEvaluator === null) {
    semanticStatus = 'NOT_EVALUATED';
    decision = 'READER_VOICE_BLOCKED';
    blockingIssues.push({
      passage: '',
      reason: 'SEMANTIC_VOICE_EVALUATION_OFFLINE: Evaluator semantik Second Brain offline/tidak tersedia. Naskah ditahan (EDITORIAL_HOLD) sesuai invarian keselamatan redaksi.',
      technicalAmbiguityRisk: false
    });
  } else {
    // If evaluator is passed or Second Brain semantic is explicitly enabled
    const semEvalFn = options.semanticEvaluator ?? (options.enableSecondBrainSemantic === true ? evaluateSecondBrainSemanticVoice : null);
    if (semEvalFn) {
      const res = semEvalFn({
        manuscript: rawText,
        manuscriptSha256: manuscript_sha256,
        focusKeyword: options.focusKeyword,
        goldenExemplar: options.goldenExemplar
      });
      semanticEvaluation = (res instanceof Promise) ? undefined : res;
      if (semanticEvaluation) {
        semanticStatus = semanticEvaluation.status;
        if (semanticEvaluation.status === 'REVISION_REQUIRED' && decision !== 'READER_VOICE_BLOCKED') {
          decision = 'READER_VOICE_REVISION_REQUIRED';
          for (const f of semanticEvaluation.findings) {
            revisionRequests.push({
              section: 'Pembuka / Ritme Naskah',
              currentPhrasing: f.passage,
              requestedImprovement: `${f.issue} Solusi: ${f.suggestion}`
            });
          }
        }
      }
    }
  }

  // Model-level semantic requirement enforcement
  if (options.requireModelSemanticEvaluator === true) {
    const isTestEnv = process.env.NODE_ENV === 'test' || Boolean((options as any)?.allowSyntheticMock);
    const isModelEvaluated = semanticEvaluation && (
      semanticEvaluation.evaluatorType === 'MODEL_SEMANTIC_EVALUATOR' ||
      (isTestEnv && semanticEvaluation.evaluatorType === 'TEST_SYNTHETIC_MOCK')
    );

    if (!isModelEvaluated || semanticStatus === 'NOT_EVALUATED') {
      semanticStatus = 'NOT_EVALUATED';
      decision = 'READER_VOICE_BLOCKED';
      blockingIssues.push({
        passage: '',
        reason: 'MODEL_SEMANTIC_EVALUATION_REQUIRED: Naskah wajib dievaluasi oleh evaluator semantik model Second Brain (bukan sekadar heuristik lokal deterministik atau synthetic mock). Naskah ditahan (EDITORIAL_HOLD).',
        technicalAmbiguityRisk: false
      });
    }
  }

  const finalOverallScore = semanticEvaluation ? Math.min(overallScore, semanticEvaluation.score) : overallScore;

  return {
    decision,
    overallScore: finalOverallScore,
    manuscript_sha256,
    semanticStatus,
    semanticEvaluation,
    dimensions: {
      problemFirstOpening,
      spokenIndonesian,
      translationese,
      jargonBudget,
      rawTechnicalSyntax,
      headingClarity,
      homeownerComprehension,
      humanRhythm,
      paragraphBreathing,
      warmAdvisoryTone,
      localCulturalGrounding
    },
    warmthChecklist,
    localCulturalChecklist,
    premiumDepthChecklist,
    paragraphDensityWarnings,
    escapedMarkdownIssues,
    visualDensitySignals,
    authorityCheck,
    aiDetectorAdvisory,
    blockingIssues,
    revisionRequests,
    voice3L4Assessment,
    evaluatedAt
  };
}

/**
 * Validates that an edit proposal by Nadia does NOT violate authority boundaries.
 * Nadia MAY simplify vocabulary, improve headings, restructure phrasing.
 * Nadia MAY NOT invent facts, alter numbers, or publish.
 * Nadia MUST preserve claim strength (LANGUAGE_SIMPLIFICATION_MUST_PRESERVE_CLAIM_STRENGTH).
 */
export function validateNadiaAuthorityBoundaries(proposal: {
  originalContent: string;
  proposedContent: string;
  originalNumbers?: number[];
  proposedNumbers?: number[];
}): { isAllowed: boolean; violations: string[] } {
  const violations: string[] = [];

  // 1. Check numbers alteration
  // Extract all numbers from both contents if not pre-extracted
  const extractNumbers = (t: string) => {
    const matches = t.match(/\b\d+(?:[.,]\d+)?\b/g) || [];
    return matches.map((m) => m.replace(',', '.')).sort();
  };

  const origNums = proposal.originalNumbers?.map(String) || extractNumbers(proposal.originalContent);
  const propNums = proposal.proposedNumbers?.map(String) || extractNumbers(proposal.proposedContent);

  // Check if any numbers were added or removed
  const addedNumbers = propNums.filter((n) => !origNums.includes(n));
  if (addedNumbers.length > 0) {
    violations.push(`Nadia tidak berwenang menambahkan angka atau besaran kuantitatif baru: ${addedNumbers.join(', ')}.`);
  }

  // 2. Check for publishing action marker
  if (/action:\s*(?:publish|deploy|approve_production)/i.test(proposal.proposedContent)) {
    violations.push('Nadia tidak memiliki otoritas publikasi atau deployment produksi.');
  }

  // 3. Check claim strength preservation (LANGUAGE_SIMPLIFICATION_MUST_PRESERVE_CLAIM_STRENGTH)
  const claimCheck = validateClaimStrengthPreservation(proposal.originalContent, proposal.proposedContent);
  if (!claimCheck.preservesClaimStrength && claimCheck.violation) {
    violations.push(claimCheck.violation);
  }

  return {
    isAllowed: violations.length === 0,
    violations
  };
}

export interface NadiaEditInput {
  draftMarkdown: string;
  topic: string;
  intent?: string;
  provider?: {
    generate: (args: {
      messages: Array<{ role: 'system' | 'user' | 'assistant'; content: string }>;
      jobId?: string;
      taskId?: string;
    }) => Promise<{
      success: boolean;
      content: string | null;
      latencyMs?: number;
      error?: string;
    }>;
  };
  taskId?: string;
  editorialVoiceLevel?: 'L3' | 'L4' | 'L5';
  enableVoiceL4?: boolean;
  enableVoiceL5?: boolean;
}

export interface NadiaEditResult {
  refinedMarkdown: string;
  changesApplied: string[];
  authorityCheck: {
    isAllowed: boolean;
    violations: string[];
  };
  readerVoiceEvaluation: ReaderVoiceEvaluationResult;
  voice3L4Assessment?: Voice3L4AssessmentResult;
  usedLlm: boolean;
  latencyMs?: number;
}

/**
 * Refines prose blocks into short paragraphs adhering to Conversational 2.1
 * (<= maxWordsPerBlock words per block, splitting cleanly at sentence boundaries).
 */
export function refineParagraphsToShortBlocks(content: string, maxWordsPerBlock = 55): string {
  const blocks = content.split(/\n\n+/);
  const refinedBlocks: string[] = [];

  for (const block of blocks) {
    const trimmed = block.trim();
    if (!trimmed || trimmed.startsWith('#') || trimmed.startsWith('---') || trimmed.startsWith('|') || trimmed.startsWith('```')) {
      refinedBlocks.push(block);
      continue;
    }

    const words = trimmed.split(/\s+/).filter(Boolean);
    if (words.length <= maxWordsPerBlock) {
      refinedBlocks.push(block);
      continue;
    }

    const sentences = trimmed.split(/(?<=[.!?][*\"”’']{0,3})\s+(?=[A-Z0-9\"“\(\[\*])/).map(s => s.trim()).filter(Boolean);
    if (sentences.length <= 1) {
      refinedBlocks.push(block);
      continue;
    }

    const chunks: string[] = [];
    let currentChunk: string[] = [];
    let currentWords = 0;

    for (const sent of sentences) {
      const sentWords = sent.split(/\s+/).filter(Boolean).length;
      if (currentWords + sentWords > maxWordsPerBlock && currentChunk.length > 0) {
        chunks.push(currentChunk.join(' '));
        currentChunk = [sent];
        currentWords = sentWords;
      } else {
        currentChunk.push(sent);
        currentWords += sentWords;
      }
    }
    if (currentChunk.length > 0) {
      chunks.push(currentChunk.join(' '));
    }

    refinedBlocks.push(chunks.join('\n\n'));
  }

  return refinedBlocks.join('\n\n');
}

/**
 * Deterministic language and formatting polish by Nadia.
 * Fixes literal translationese, awkward expressions, informal colloquialisms,
 * and escaped markdown syntax without mutating factual claims or numbers.
 */
export function applyNadiaDeterministicPolish(
  content: string,
  options?: {
    title?: string;
    focusKeyword?: string;
    isComparison?: boolean;
    maxWordsPerBlock?: number;
  }
): {
  polishedContent: string;
  changes: string[];
} {
  let text = String(content || '');
  const changes: string[] = [];

  // 1. Clean literal escaped markdown syntax
  for (const esc of ESCAPED_MARKDOWN_PATTERNS) {
    if (esc.pattern.test(text)) {
      if (esc.name.includes('escaped asterisk')) {
        text = text.replace(/\\\*/g, '*');
        changes.push('Pembersihan escaped asterisk (\\*)');
      } else if (esc.name.includes('thematic break')) {
        text = text.replace(/\\---/g, '---');
        changes.push('Pembersihan escaped thematic break (\\---)');
      } else if (esc.name.includes('underscore')) {
        text = text.replace(/\\_/g, '_');
        changes.push('Pembersihan escaped underscore (\\_)');
      }
    }
  }

  // 2. Replace informal colloquial words with polite standard Indonesian & enforce Conversational 2.1 sapaan
  const informalReplacements: Array<[RegExp, string, string]> = [
    [/\brumah Anda\b/gi, 'rumahmu', '"rumah Anda" -> "rumahmu"'],
    [/\bAnda\b/g, 'kamu', '"Anda" -> "kamu"'],
    [/\bnggak\b/gi, 'tidak', '"nggak" -> "tidak"'],
    [/\bndak\b/gi, 'tidak', '"ndak" -> "tidak"'],
    [/\budah\b/gi, 'sudah', '"udah" -> "sudah"'],
    [/\bpengen\b/gi, 'ingin', '"pengen" -> "ingin"'],
    [/\bkayak\b/gi, 'seperti', '"kayak" -> "seperti"'],
    [/\bsoalnya\b/gi, 'karena', '"soalnya" -> "karena"'],
    [/\btapi\b/g, 'tetapi', '"tapi" -> "tetapi"']
  ];

  for (const [regex, replacement, desc] of informalReplacements) {
    if (regex.test(text)) {
      text = text.replace(regex, replacement);
      changes.push(desc);
    }
  }

  // 3. Translationese & awkward phrase cleanup
  const awkwardPhrases: Array<[RegExp, string, string]> = [
    [/ruang kosong yang sulit digunakan/gi, 'ruangan yang terasa terlalu kosong atau kaku', 'penyederhanaan diksi ruang kosong'],
    [/pertemuannya menekankan/gi, 'perpaduan kedua gaya ini mengutamakan', 'penyederhanaan diksi pertemuan gaya'],
    [/diberikan melalui nada kayu/gi, 'menggunakan sentuhan kayu alami', 'penyederhanaan diksi nada kayu'],
    [/nada kayu alami/gi, 'warna kayu alami', 'koreksi istilah warna kayu'],
    [/memberi penegasan struktural/gi, 'memberi aksen kontras visual', 'koreksi penegasan struktural'],
    [/tekstur taktil asli/gi, 'tekstur alami yang terasa saat disentuh', 'penyederhanaan tekstur taktil'],
    [/mengurangi ketenangan visual/gi, 'membuat ruangan terasa penuh dan berantakan', 'penyederhanaan ketenangan visual'],
    [/sirkulasi pandangan dan kegiatan/gi, 'kelegaan pandangan dan kenyamanan berlalu-lalang', 'penyederhanaan sirkulasi pandangan'],
    [/menolak kekosongan steril/gi, 'menghindari kesan ruangan yang dingin dan kaku', 'penyederhanaan kekosongan steril'],
    [/elemen fungsional yang memiliki nilai guna/gi, 'perabot yang memang sering dipakai sehari-hari', 'penyederhanaan elemen fungsional'],
    [/memiliki ruang bernapas/gi, 'menyisakan jarak agar ruangan terasa plong', 'penyederhanaan ruang bernapas'],
    [/panduan ini membedah/gi, 'panduan ini membahas', 'penyederhanaan pembuka membedah']
  ];

  for (const [regex, replacement, desc] of awkwardPhrases) {
    if (regex.test(text)) {
      text = text.replace(regex, replacement);
      changes.push(desc);
    }
  }

  // 4. Translationese dictionary lookup
  for (const [key, replacement] of Object.entries(TRANSLATIONESE_DICTIONARY)) {
    const reg = new RegExp(`\\b${key}\\b`, 'gi');
    if (reg.test(text)) {
      text = text.replace(reg, replacement);
      changes.push(`Koreksi istilah terjemahan: "${key}" -> "${replacement}"`);
    }
  }

  // 5. Post-Substitution Grammar & Repetition Safeguard
  // Invariant: Do not allow blind word replacement to produce broken grammar or repetitive conjunctions
  const duplicateConjunctions = [
    { pattern: /\btetapi\b([^.!?\n]{1,60})\btetapi\b/gi, fix: 'tetapi$1namun', name: 'repetitive "tetapi"' },
    { pattern: /\bkarena\b([^.!?\n]{1,60})\bkarena\b/gi, fix: 'karena$1mengingat', name: 'repetitive "karena"' },
    { pattern: /\bnamun\b([^.!?\n]{1,60})\btetapi\b/gi, fix: 'namun$1', name: 'double adversative "namun... tetapi"' }
  ];

  for (const dup of duplicateConjunctions) {
    if (dup.pattern.test(text)) {
      text = text.replace(dup.pattern, dup.fix);
      changes.push(`Pencegahan repetisi/kerusakan tata bahasa akibat substitusi: ${dup.name}`);
    }
  }

  // 6. Automated Warm Decision Handoff for Comparison Articles
  const isComparison = options?.isComparison ?? isComparisonContent(text, { title: options?.title });
  if (isComparison) {
    const paras = text.split(/\n\s*\n/).map(p => p.trim()).filter(Boolean);
    const closingText = paras.slice(-2).join(' ');
    const hasHandoff = AGENCY_HANDOFF_INDICATORS.some(ind => ind.test(closingText));
    if (!hasHandoff && paras.length > 0) {
      const handoffSentence = 'Pilihan akhir tetap kembali kepada kamu untuk menyesuaikan dengan kondisi nyata rumah kamu, batas kelembapan ruang, dan kesiapan pemeliharaan berkala.';
      const lastIndex = paras.length - 1;
      const lastP = paras[lastIndex];
      if (options?.focusKeyword && lastP.toLowerCase().includes(options.focusKeyword.toLowerCase())) {
        paras[lastIndex] = `${handoffSentence}\n\n${lastP}`;
      } else {
        paras[lastIndex] = `${lastP}\n\n${handoffSentence}`;
      }
      text = paras.join('\n\n');
      changes.push('Otomasi penambahan serah-terima keputusan hangat (COMPARISON_WARM_DECISION_HANDOFF)');
    }
  }

  // 7. Automated Short Paragraph Reflow (Conversational 2.1 & JEV Paragraph Compliance)
  const reflowed = refineParagraphsToShortBlocks(text, options?.maxWordsPerBlock || 55);
  if (reflowed !== text) {
    text = reflowed;
    changes.push('Pemecahan otomatis paragraf padat menjadi paragraf pendek (<= 55 kata per blok) sesuai standar Conversational Editorial 2.1 & JEV');
  }

  return {
    polishedContent: text,
    changes
  };
}

/**
 * Builds the LLM prompt for Nadia's Language & Reader Voice editing pass.
 */
export function buildNadiaEditingPrompt(
  draftMarkdown: string,
  topic: string,
  options: { intent?: string } = {}
): {
  systemPrompt: string;
  userPrompt: string;
} {
  const systemPrompt = `Anda adalah Nadia, Audience & Language Editor di Dewan Redaksi RancangLoka.
Peran Anda: Menyunting draf naskah hunian dari Joko agar memiliki suara redaksi Dewan Redaksi RancangLoka V3: santun, jernih, membumi, dan enak dibaca mengalir seperti majalah hunian berkualitas (misal: HGTV / Real Simple), bukan seperti teks terjemahan atau khotbah AI.

PRINSIP PENYUNTINGAN NADIA (EDITORIAL VOICE V3):
1. ANSWER FIRST: Paragraf pertama (1–3 kalimat awal) WAJIB langsung menjawab pertanyaan inti topik atau menjelaskan topik dengan lugas dan ramah. Dilarang membuka dengan masalah fiktif ("Memilih X sering terasa rumit...") atau drama retoris ("Di sinilah dilema utamanya...").
2. NATURAL STORYTELLING: Setelah jawaban awal, bawa pembaca masuk ke situasi nyata, ruang nyata (ruang tamu, kamar tidur, dapur), benda nyata, dan kebiasaan harian dengan alur santai.
3. BAHASA INDONESIA ALAMI (ANTI-TRANSLATIONESE):
   - Hapus struktur kalimat bahasa Inggris kaku (misal: "pertemuannya menekankan", "ruang kosong yang sulit digunakan", "diberikan melalui nada kayu", "penegasan struktural").
   - Ganti dengan Bahasa Indonesia wajar yang hidup (misal: "perpaduan kedua gaya ini mengutamakan", "ruangan yang terlalu kosong", "warna kayu alami", "aksen kontras agar tidak monoton").
4. KATA BAKU SANTUN:
   - Gunakan "tidak", bukan "nggak" / "ndak".
   - Gunakan "sudah", bukan "udah".
   - Gunakan "ingin", bukan "pengen".
   - Gunakan "seperti", bukan "kayak".
   - Gunakan "karena", bukan "soalnya".
   - Gunakan "tetapi" atau "namun", bukan "tapi".
5. KENYAMANAN PARAGRAF (PARAGRAPH BREATHING):
   - Rata-rata 30–70 kata per paragraf (1–3 kalimat).
   - Jangan biarkan paragraf menumpuk lebih dari 90 kata.
6. BATAS OTORITAS KETAT (STRICT INVARIANTS):
   - DILARANG mengubah atau menambahkan angka, persentase, satuan, standar SNI, atau klaim teknis.
   - DILARANG memperkuat klaim ("bisa mengurangi" DILARANG diubah jadi "pasti menghilangkan").
   - DILARANG mengarang fakta baru.
   - Otoritas publikasi Anda adalah 0 (hanya menyunting bahasa).
7. PERLINDUNGAN SUARA PERSONAL JOKO & EDITORIAL STANCE:
   - ${CANONICAL_SIGNATURE_EDITORIAL_VOICE.five_capability_pillars.editorial_intelligence.authorial_presence.guideline}
   - DILARANG menetralkan atau menghapus kata "saya" yang digunakan Joko secara sah untuk menyampaikan pertimbangan atau rekomendasi editorial profesional.
   - DILARANG menetralkan pendirian editorial Joko yang didukung bukti kuat menjadi bahasa yang bimbang atau tanpa arah (${CANONICAL_SIGNATURE_EDITORIAL_VOICE.five_capability_pillars.editorial_intelligence.editorial_stance.nature}).
   - HINDARI OVERPOLISHING: Jangan menghaluskan kalimat sampai kehilangan karakter personal, intisari berharga (${CANONICAL_SIGNATURE_EDITORIAL_VOICE.five_capability_pillars.reader_value.memorable_editorial_takeaway.forms.join(', ')}), atau terdengar seperti teks chatbot netral.

OUTPUT: Kembalikan naskah lengkap hasil suntingan dalam format Markdown bersih, tanpa salam, tanpa obrolan meta, dan tanpa tag pembungkus selain naskah itu sendiri.`;

  const userPrompt = `Topik: "${topic}"

Naskah Draf Joko:
${draftMarkdown}

Silakan sunting naskah di atas sesuai standar Editorial Voice V3 Dewan Redaksi RancangLoka.`;

  return { systemPrompt, userPrompt };
}

/**
 * Executes a controlled language & reader voice edit by Nadia.
 * Canonical Workflow: Joko Draft -> Nadia Reader Voice Edit -> Rina Editorial QA -> Human Review.
 */
export async function executeNadiaReaderVoiceEdit(
  input: NadiaEditInput
): Promise<NadiaEditResult> {
  const startTime = Date.now();
  let candidateText = input.draftMarkdown;
  let usedLlm = false;
  const changesApplied: string[] = [];

  // 1. Attempt LLM Provider Edit if available
  if (input.provider && typeof input.provider.generate === 'function') {
    try {
      const prompts = buildNadiaEditingPrompt(input.draftMarkdown, input.topic, { intent: input.intent });
      const llmRes = await input.provider.generate({
        messages: [
          { role: 'system', content: prompts.systemPrompt },
          { role: 'user', content: prompts.userPrompt }
        ],
        jobId: input.taskId,
        taskId: input.taskId
      });

      if (llmRes.success && llmRes.content && llmRes.content.trim().length > 100) {
        // Strip markdown code fence if wrapped
        let cleanLlmText = llmRes.content.trim();
        if (cleanLlmText.startsWith('```markdown')) {
          cleanLlmText = cleanLlmText.replace(/^```markdown\s*/, '').replace(/```\s*$/, '').trim();
        } else if (cleanLlmText.startsWith('```')) {
          cleanLlmText = cleanLlmText.replace(/^```\s*/, '').replace(/```\s*$/, '').trim();
        }

        // Validate authority boundaries: Nadia cannot alter numbers or invent facts
        const authorityCheck = validateNadiaAuthorityBoundaries({
          originalContent: input.draftMarkdown,
          proposedContent: cleanLlmText
        });

        if (authorityCheck.isAllowed) {
          candidateText = cleanLlmText;
          usedLlm = true;
          changesApplied.push('Penyuntingan bahasa kontekstual LLM oleh Nadia selesai dan lolos verifikasi otoritas');
        } else {
          changesApplied.push(`Penyuntingan LLM dibatalkan karena pelanggaran otoritas: ${authorityCheck.violations.join('; ')}`);
        }
      }
    } catch (err: any) {
      changesApplied.push(`Penyuntingan LLM dilewati karena error provider: ${err?.message || err}`);
    }
  }

  // 2. Apply deterministic polish layer (escaped markdown, translationese, informal words)
  const polishRes = applyNadiaDeterministicPolish(candidateText);
  candidateText = polishRes.polishedContent;
  changesApplied.push(...polishRes.changes);

  // 3. Final Authority Boundaries Check
  const finalAuthorityCheck = validateNadiaAuthorityBoundaries({
    originalContent: input.draftMarkdown,
    proposedContent: candidateText
  });

  // If final text somehow violated authority, fail closed to original draft with deterministic polish only
  let finalMarkdown = candidateText;
  if (!finalAuthorityCheck.isAllowed) {
    const fallbackPolish = applyNadiaDeterministicPolish(input.draftMarkdown);
    finalMarkdown = fallbackPolish.polishedContent;
    changesApplied.push('Rollback aman ke draf asli dengan pemolesan deterministik saja demi menjaga batas otoritas');
  }

  // 4. Evaluate Reader Voice Rubric on the final result
  const evaluation = evaluateReaderVoice(finalMarkdown, {
    title: input.topic,
    contentFamily: input.intent || 'explainer',
    originalContent: input.draftMarkdown,
    editorialVoiceLevel: input.editorialVoiceLevel,
    enableVoiceL4: input.enableVoiceL4,
    enforceAllBlockBreathing: true
  });

  if (evaluation.voice3L4Assessment) {
    if (evaluation.voice3L4Assessment.decision === 'VOICE_3_L4_PASS') {
      changesApplied.push(`Evaluasi Suara Pembaca L4 lolos: Skor ${evaluation.voice3L4Assessment.overallScore}/100 (Naturalitas: ${evaluation.voice3L4Assessment.dimensions.conversationalNaturalness.score}/100)`);
    } else {
      changesApplied.push(`Peringatan Suara Pembaca L4: Naskah memerlukan revisi naturalitas percakapan (${evaluation.voice3L4Assessment.dimensions.conversationalNaturalness.score}/100)`);
    }
  }

  return {
    refinedMarkdown: finalMarkdown,
    changesApplied,
    authorityCheck: finalAuthorityCheck,
    readerVoiceEvaluation: evaluation,
    voice3L4Assessment: evaluation.voice3L4Assessment,
    usedLlm,
    latencyMs: Date.now() - startTime
  };
}
