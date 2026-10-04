/**
 * RancangLoka Editorial Human Writing Quality Gate
 * Milestone: EDITORIAL-HUMAN-QUALITY-1
 *
 * Strict Invariants:
 * 1. ZERO FAKE "AI DETECTORS":
 *    - Absolutely NO GPTZero-style scoring, arbitrary "AI probability", or hidden third-party detector APIs.
 *    - Evaluates authentic editorial characteristics: sentence rhythm, concrete detail, contextual relevance,
 *      editorial voice, non-template structure, evidence integration, reader usefulness, and conclusion originality.
 * 2. CANONICAL OWNERSHIP:
 *    - Joko (content_writer_primary): Owns HUMAN-FIRST AUTHORING and prose rewrites. Never invents personal testing or fake anecdotes.
 *    - Rina (editorial_qa_primary): Owns HUMAN-WRITING QUALITY GATE & EDITORIAL_NATURALNESS_REVIEW.
 *    - Irwan (evidence_researcher_lead): Owns facts, evidence, and citations. Stylistic rewrites must never corrupt verified facts.
 *    - Jefry (management_advisor_jefry): Advisory/shadow observer only. Zero execution or publishing authority.
 * 3. DETERMINISTIC 100-POINT RUBRIC & THRESHOLDS:
 *    - Natural sentence rhythm: 20 pts
 *    - Specificity / concrete detail: 15 pts
 *    - Contextual relevance (Indonesian climate/reality): 15 pts
 *    - Editorial voice: 15 pts
 *    - Non-template structure: 10 pts
 *    - Evidence integration: 10 pts
 *    - Useful reader perspective: 10 pts
 *    - Conclusion originality: 5 pts
 *    - Thresholds: 85-100 = PASS, 75-84 = REVISE, 0-74 = REWRITE.
 * 4. REWRITE LOOP & RETRY CAP:
 *    - Maximum 2 rewrite attempts.
 *    - If retry count exceeds cap (>= 2 retries failed), escalates deterministically to HUMAN_REVIEW_REQUIRED.
 *    - Never lowers the threshold to force a pass.
 * 5. EVIDENCE PRESERVATION:
 *    - Stylistic rewrites must strictly preserve technical specifications, citations, and evidence markers.
 */

export type HumanWritingDecision =
  | 'HUMAN_WRITING_PASS'
  | 'HUMAN_WRITING_REVISE'
  | 'HUMAN_WRITING_REWRITE'
  | 'HUMAN_REVIEW_REQUIRED';

export interface HumanWritingDimensions {
  sentence_rhythm: number;         // Max 20
  specificity_detail: number;      // Max 15
  contextual_relevance: number;    // Max 15
  editorial_voice: number;         // Max 15
  non_template_structure: number;  // Max 10
  evidence_integration: number;    // Max 10
  reader_perspective: number;      // Max 10
  conclusion_originality: number;  // Max 5
}

export const DEFAULT_HUMAN_QUALITY_RUBRIC: Record<keyof HumanWritingDimensions, number> = {
  sentence_rhythm: 20,
  specificity_detail: 15,
  contextual_relevance: 15,
  editorial_voice: 15,
  non_template_structure: 10,
  evidence_integration: 10,
  reader_perspective: 10,
  conclusion_originality: 5
};


export interface EditorialPatternIssue {
  code: string;
  category:
    | 'GENERIC_OPENING'
    | 'STRUCTURAL_SYMMETRY'
    | 'REPETITIVE_TRANSITIONS'
    | 'EMPTY_GENERALIZATION'
    | 'EXCESSIVE_HEDGING'
    | 'ARTIFICIAL_CONCLUSION'
    | 'KEYWORD_FORCING'
    | 'PARAGRAPH_UNIFORMITY'
    | 'LACK_OF_LOCAL_CONTEXT';
  severity: 'WARNING' | 'CRITICAL';
  description: string;
  penalty: number;
  occurrences?: string[];
}

import { RANCANGLOKA_EDITORIAL_KNOWLEDGE_VERSION } from './editorial-knowledge.ts';

export interface HumanWritingQualityResult {
  knowledge_version: string;
  total_score: number;
  decision: HumanWritingDecision;
  passed: boolean;
  dimensions: HumanWritingDimensions;
  issues: EditorialPatternIssue[];
  strong_areas: string[];
  evaluated_by: string; // 'editorial_qa_primary' (Rina)
  evaluated_at: string;
  attempt_count: number;
  max_attempts: number;
  rewrite_brief: StructuredRewriteBrief | null;
}

export interface StructuredRewriteBrief {
  target_agent_id: string; // 'content_writer_primary' (Joko)
  reason: 'HUMAN_WRITING_QUALITY';
  attempt: number;
  required_actions: string[];
  preserved_invariants: string[];
  failing_sections: string[];
}

// ============================================================================
// Deterministic Pattern Heuristics & Signals
// ============================================================================

/**
 * Weak generic openings that signal dictionary definitions or robotic introductions
 * rather than reader problems / architectural context.
 */
export const GENERIC_OPENING_PATTERNS = [
  /^di era modern (?:saat ini|sekarang|ini)/i,
  /^dalam dunia (?:konstruksi|arsitektur|desain|properti|bangunan)/i,
  /^memilih material yang tepat merupakan hal(?: yang sangat)? penting/i,
  /^rumah adalah (?:tempat|kebutuhan|istana)/i,
  /^pada dasarnya,/i,
  /^seiring dengan perkembangan zaman/i,
  /^tidak dapat dipungkiri bahwa/i,
  /^sebagaimana kita ketahui/i
];

/**
 * Common robotic transitional phrases that become monotonous when overused.
 */
export const REPETITIVE_TRANSITION_MARKERS = [
  'selain itu',
  'di sisi lain',
  'dengan demikian',
  'oleh karena itu',
  'pada akhirnya',
  'secara keseluruhan',
  'penting untuk diingat',
  'perlu diperhatikan',
  'dalam hal ini',
  'tidak hanya itu',
  'di samping itu'
];

/**
 * Empty generalizations that sound informative but provide no actionable technical insight.
 */
export const EMPTY_GENERALIZATION_PATTERNS = [
  /setiap pilihan memiliki kelebihan dan kekurangan/i,
  /pilihan terbaik tergantung kebutuhan masing-masing/i,
  /ada banyak faktor yang perlu dipertimbangkan/i,
  /semua kembali kepada selera dan anggaran/i,
  /masing-masing memiliki karakteristik tersendiri/i
];

/**
 * Excessive hedging phrases that weaken editorial conviction.
 */
export const EXCESSIVE_HEDGING_PATTERNS = [
  /\bdapat menjadi pilihan\b/gi,
  /\bbisa dipertimbangkan\b/gi,
  /\bumumnya\b/gi,
  /\bcenderung\b/gi,
  /\bmungkin saja\b/gi,
  /\btergantung kebutuhan\b/gi
];

/**
 * Prohibited fabricated personal experience phrases (Layer 5: Trust & Integrity).
 * Strictly bans invented first-person claims ("kami menguji", "berdasarkan pengalaman kami", "kami mengunjungi").
 */
export const FABRICATED_EXPERIENCE_PATTERNS = [
  /kami (?:sudah )?(?:menguji|mencoba|meneliti|mengunjungi|mengamati langsung)/i,
  /berdasarkan pengalaman kami/i,
  /klien kami di (?:jakarta|surabaya|bandung)/i,
  /kami telah membuktikan sendiri/i
];


/**
 * Indonesian tropical climate & local reality vocabulary.
 * Rewards contextual grounding in local weather, moisture, heat, or installation reality.
 */
export const INDONESIAN_LOCAL_REALITY_MARKERS = [
  'tropis',
  'curah hujan',
  'kelembapan',
  'tampias',
  'panas sore',
  'matahari barat',
  'terik',
  'ventilasi silang',
  'rembesan',
  'karat',
  'lapuk',
  'lumut',
  'tukang',
  'plesteran',
  'acian',
  'dak beton',
  'baja ringan',
  'genteng',
  'kemiringan atap',
  'overstek',
  'talang air',
  'drainase',
  'dinding bata',
  'bata ringan'
];

// ============================================================================
// Evaluation Engine
// ============================================================================

export interface EvaluationOptions {
  attemptCount?: number;
  maxAttempts?: number;
  focusKeyword?: string;
  evaluatedAt?: string;
}

/**
 * Deterministically evaluates an article's Markdown body against RancangLoka's Human Writing Quality rubric.
 */
export function evaluateHumanWritingQuality(
  contentMd: string,
  options: EvaluationOptions = {}
): HumanWritingQualityResult {
  const attemptCount = options.attemptCount ?? 0;
  const maxAttempts = options.maxAttempts ?? 2;
  const evaluatedAt = options.evaluatedAt ?? new Date().toISOString();
  const evaluatedBy = 'editorial_qa_primary'; // Rina canonical owner

  if (!contentMd || typeof contentMd !== 'string' || !contentMd.trim()) {
    return {
      knowledge_version: RANCANGLOKA_EDITORIAL_KNOWLEDGE_VERSION,
      total_score: 0,
      decision: 'HUMAN_WRITING_REWRITE',
      passed: false,
      dimensions: {
        sentence_rhythm: 0,
        specificity_detail: 0,
        contextual_relevance: 0,
        editorial_voice: 0,
        non_template_structure: 0,
        evidence_integration: 0,
        reader_perspective: 0,
        conclusion_originality: 0
      },
      issues: [
        {
          code: 'EMPTY_CONTENT',
          category: 'EMPTY_GENERALIZATION',
          severity: 'CRITICAL',
          description: 'Naskah artikel kosong.',
          penalty: 100
        }
      ],
      strong_areas: [],
      evaluated_by: evaluatedBy,
      evaluated_at: evaluatedAt,
      attempt_count: attemptCount,
      max_attempts: maxAttempts,
      rewrite_brief: {
        target_agent_id: 'content_writer_primary',
        reason: 'HUMAN_WRITING_QUALITY',
        attempt: attemptCount + 1,
        required_actions: ['Tulis naskah lengkap dari awal.'],
        preserved_invariants: ['Fakta riset teknis dan SNI harus dipertahankan.'],
        failing_sections: ['Seluruh naskah']
      }
    };
  }

  const cleanMd = contentMd.trim();
  const paragraphs = cleanMd.split(/\n\s*\n/).map((p) => p.trim()).filter(Boolean);
  const headings = cleanMd.match(/^##\s+.+$/gm) || [];
  const h3Headings = cleanMd.match(/^###\s+.+$/gm) || [];
  const words = cleanMd.split(/\s+/).filter(Boolean);

  const issues: EditorialPatternIssue[] = [];
  const strongAreas: string[] = [];

  // Default dimension baseline (100 total potential)
  let dimRhythm = 20;
  let dimSpecificity = 15;
  let dimContext = 15;
  let dimVoice = 15;
  let dimStructure = 10;
  let dimEvidence = 10;
  let dimReader = 10;
  let dimConclusion = 5;

  // --------------------------------------------------------------------------
  // 1. Generic Opening Check (Impacts: Editorial Voice & Reader Perspective)
  // --------------------------------------------------------------------------
  const firstParagraph = paragraphs.find((p) => !p.startsWith('#')) || '';
  let openingGeneric = false;

  for (const pattern of GENERIC_OPENING_PATTERNS) {
    if (pattern.test(firstParagraph)) {
      openingGeneric = true;
      issues.push({
        code: 'GENERIC_OPENING_DETECTED',
        category: 'GENERIC_OPENING',
        severity: 'CRITICAL',
        description: 'Paragraf pembuka menggunakan formula klise/generik ("Di era modern...", "Dalam dunia..."), bukan mengangkat masalah nyata pembaca.',
        penalty: 8,
        occurrences: [firstParagraph.slice(0, 80) + '...']
      });
      dimVoice = Math.max(0, dimVoice - 5);
      dimReader = Math.max(0, dimReader - 3);
      break;
    }
  }

  if (!openingGeneric && firstParagraph.length > 50) {
    strongAreas.push('Pembuka langsung menyentuh konteks spesifik pembaca rumah');
  }

  // --------------------------------------------------------------------------
  // 2. Repetitive Transitional Phrases (Impacts: Sentence Rhythm & Editorial Voice)
  // --------------------------------------------------------------------------
  const transitionOccurrences: Record<string, number> = {};
  let totalTransitions = 0;
  const lowerContent = cleanMd.toLowerCase();

  for (const marker of REPETITIVE_TRANSITION_MARKERS) {
    const escaped = marker.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const regex = new RegExp(`\\b${escaped}\\b`, 'gi');
    const count = (lowerContent.match(regex) || []).length;
    if (count > 0) {
      transitionOccurrences[marker] = count;
      totalTransitions += count;
    }
  }

  // Flag individual phrase overuse (>= 3 times of same phrase) or high overall transition density
  const overusedTransitions = Object.entries(transitionOccurrences).filter(([_, count]) => count >= 3);
  if (overusedTransitions.length > 0 || totalTransitions >= 7) {
    const penalty = Math.min(8, overusedTransitions.length * 3 + (totalTransitions >= 7 ? 2 : 0));
    issues.push({
      code: 'REPETITIVE_TRANSITIONS_OVERUSED',
      category: 'REPETITIVE_TRANSITIONS',
      severity: 'WARNING',
      description: `Penggunaan frasa transisi mekanis berulang secara monoton (${overusedTransitions.map(([k, v]) => `"${k}": ${v}x`).join(', ')}).`,
      penalty,
      occurrences: overusedTransitions.map(([k, v]) => `${k} (${v}x)`)
    });
    dimRhythm = Math.max(0, dimRhythm - penalty);
    dimVoice = Math.max(0, dimVoice - 2);
  } else if (totalTransitions <= 3) {
    strongAreas.push('Alur antar-paragraf mengalir alami tanpa ketergantungan frasa transisi klise');
  }

  // --------------------------------------------------------------------------
  // 3. Sentence Length Rhythm & Monotony (Impacts: Sentence Rhythm)
  // --------------------------------------------------------------------------
  // Break into sentences (simple Indonesian punctuation splitter)
  const sentences = cleanMd
    .replace(/^#+.*$/gm, '') // Remove heading lines
    .split(/[.!?]+/)
    .map((s) => s.trim())
    .filter((s) => s.length > 10);

  const sentenceWordCounts = sentences.map((s) => s.split(/\s+/).filter(Boolean).length);
  if (sentenceWordCounts.length >= 8) {
    const avgLen = sentenceWordCounts.reduce((a, b) => a + b, 0) / sentenceWordCounts.length;
    const variance =
      sentenceWordCounts.reduce((sum, len) => sum + Math.pow(len - avgLen, 2), 0) / sentenceWordCounts.length;
    const stdDev = Math.sqrt(variance);

    // If standard deviation is very low (< 3.0), writing is mechanically rigid and uniform
    if (stdDev < 3.2 && sentenceWordCounts.length >= 10) {
      issues.push({
        code: 'RIGID_SENTENCE_RHYTHM',
        category: 'PARAGRAPH_UNIFORMITY',
        severity: 'WARNING',
        description: `Panjang kalimat terlalu seragam (rata-rata ~${Math.round(avgLen)} kata per kalimat, variasi sangat rendah). Ritme terasa kaku seperti hasil generasi otomatis.`,
        penalty: 5
      });
      dimRhythm = Math.max(0, dimRhythm - 5);
    } else if (stdDev >= 6.0) {
      strongAreas.push('Variasi panjang kalimat dinamis dan berirama hidup');
    }
  }

  // --------------------------------------------------------------------------
  // 4. Excessive Structural Symmetry (Impacts: Non-Template Structure)
  // --------------------------------------------------------------------------
  // Check section structures under H2 headings
  const sectionChunks = cleanMd.split(/^##\s+/m).slice(1);
  if (sectionChunks.length >= 3) {
    const bulletCounts = sectionChunks.map((chunk) => (chunk.match(/^\s*[-*]\s+/gm) || []).length);
    const paraCounts = sectionChunks.map((chunk) => chunk.split(/\n\s*\n/).filter((p) => !p.startsWith('#')).length);

    // Identical bullet pattern across all sections (e.g. exactly 3 bullets in every single section)
    const nonZeroBullets = bulletCounts.filter((c) => c > 0);
    const allSameBullets =
      nonZeroBullets.length >= 3 && nonZeroBullets.every((count) => count === nonZeroBullets[0]);

    // Identical paragraph count in each section
    const allSameParas = paraCounts.length >= 3 && paraCounts.every((count) => count === paraCounts[0]);

    if (allSameBullets || (allSameParas && bulletCounts.every((c) => c === 0))) {
      issues.push({
        code: 'STRUCTURAL_SYMMETRY_DETECTED',
        category: 'STRUCTURAL_SYMMETRY',
        severity: 'WARNING',
        description: 'Simetri struktur artikel terlalu kaku dan terulang di setiap bagian (jumlah butir/paragraf identik antar-subjudul).',
        penalty: 6
      });
      dimStructure = Math.max(0, dimStructure - 6);
    } else {
      strongAreas.push('Struktur bagian bervariasi secara proporsional sesuai kebutuhan penjelasan');
    }
  }

  // --------------------------------------------------------------------------
  // 5. Empty Generalizations (Impacts: Specificity / Concrete Detail & Editorial Voice)
  // --------------------------------------------------------------------------
  const emptyMatches: string[] = [];
  for (const pattern of EMPTY_GENERALIZATION_PATTERNS) {
    const match = cleanMd.match(pattern);
    if (match) {
      emptyMatches.push(match[0]);
    }
  }

  if (emptyMatches.length > 0) {
    const penalty = Math.min(8, emptyMatches.length * 4);
    issues.push({
      code: 'EMPTY_GENERALIZATIONS_FOUND',
      category: 'EMPTY_GENERALIZATION',
      severity: 'WARNING',
      description: `Mengandung generalisasi kosong tanpa penjelasan teknis spesifik ("${emptyMatches.join('", "')}").`,
      penalty,
      occurrences: emptyMatches
    });
    dimSpecificity = Math.max(0, dimSpecificity - penalty);
    dimVoice = Math.max(0, dimVoice - 2);
  }

  // --------------------------------------------------------------------------
  // 6. Excessive Hedging (Impacts: Specificity & Editorial Voice)
  // --------------------------------------------------------------------------
  let totalHedgingCount = 0;
  for (const pattern of EXCESSIVE_HEDGING_PATTERNS) {
    const matches = cleanMd.match(pattern) || [];
    totalHedgingCount += matches.length;
  }

  // Ratio of hedging phrases to 500 words
  const hedgingDensity = (totalHedgingCount / Math.max(1, words.length)) * 500;
  if (hedgingDensity >= 5.0) {
    issues.push({
      code: 'EXCESSIVE_HEDGING_DETECTED',
      category: 'EXCESSIVE_HEDGING',
      severity: 'WARNING',
      description: `Frekuensi kata lindung nilai / hedging terlalu tinggi (~${Math.round(hedgingDensity)} per 500 kata). Tulisan terdengar ragu-ragu dan defensif.`,
      penalty: 5
    });
    dimVoice = Math.max(0, dimVoice - 4);
    dimSpecificity = Math.max(0, dimSpecificity - 2);
  }

  // --------------------------------------------------------------------------
  // Fabricated Experience & Unverified Anecdotes (Layer 5 Integrity Violation)
  // --------------------------------------------------------------------------
  const fabricatedMatches: string[] = [];
  for (const pattern of FABRICATED_EXPERIENCE_PATTERNS) {
    const match = cleanMd.match(pattern);
    if (match) {
      fabricatedMatches.push(match[0]);
    }
  }

  if (fabricatedMatches.length > 0) {
    issues.push({
      code: 'FABRICATED_EXPERIENCE_OR_SLOP',
      category: 'EMPTY_GENERALIZATION',
      severity: 'CRITICAL',
      description: `Ditemukan klaim pengalaman atau pengujian personal fiktif ("${fabricatedMatches.join('", "')}") yang melanggar Layer 5 Trust & Editorial Integrity.`,
      penalty: 35,
      occurrences: fabricatedMatches
    });
    dimVoice = Math.max(0, dimVoice - 10);
    dimEvidence = Math.max(0, dimEvidence - 10);
    dimReader = Math.max(0, dimReader - 10);
  }

  // --------------------------------------------------------------------------
  // 7. Local Indonesian Context & Climate Reality (Impacts: Contextual Relevance)
  // --------------------------------------------------------------------------
  let localContextMatches = 0;
  const foundLocalMarkers: string[] = [];
  for (const marker of INDONESIAN_LOCAL_REALITY_MARKERS) {
    if (lowerContent.includes(marker)) {
      localContextMatches++;
      foundLocalMarkers.push(marker);
    }
  }

  if (localContextMatches < 2) {
    issues.push({
      code: 'LACK_OF_LOCAL_CONTEXT',
      category: 'LACK_OF_LOCAL_CONTEXT',
      severity: 'CRITICAL',
      description: 'Kurang mengakar pada konteks iklim dan realitas hunian Indonesia (hujan tropis, panas sore, kelembapan, kondisi tukang/material lokal).',
      penalty: 7
    });
    dimContext = Math.max(0, dimContext - 7);
  } else if (localContextMatches >= 4) {
    strongAreas.push(`Kontekstual kuat terhadap kondisi tropis Indonesia (${foundLocalMarkers.slice(0, 4).join(', ')})`);
  }

  // --------------------------------------------------------------------------
  // 8. Keyword Forcing / Stuffing in Headings & Body (Impacts: Editorial Voice & Rhythm)
  // --------------------------------------------------------------------------
  if (options.focusKeyword && options.focusKeyword.trim()) {
    const kw = options.focusKeyword.trim().toLowerCase();
    const kwEscaped = kw.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const kwRegex = new RegExp(`\\b${kwEscaped}\\b`, 'gi');
    const kwMatches = (lowerContent.match(kwRegex) || []).length;
    const kwDensity = (kwMatches / Math.max(1, words.length)) * 100;

    // Check heading stuffing
    const kwInHeadings = headings.filter((h) => h.toLowerCase().includes(kw)).length;

    if (kwDensity > 3.0 || (kwInHeadings >= 3 && headings.length <= 4)) {
      issues.push({
        code: 'KEYWORD_FORCING_DETECTED',
        category: 'KEYWORD_FORCING',
        severity: 'WARNING',
        description: `Kata kunci fokus "${options.focusKeyword}" dipaksakan secara berlebihan (kepadatan: ${kwDensity.toFixed(1)}%, muncul di ${kwInHeadings} subjudul).`,
        penalty: 6
      });
      dimVoice = Math.max(0, dimVoice - 4);
      dimRhythm = Math.max(0, dimRhythm - 2);
    }
  }

  // --------------------------------------------------------------------------
  // 9. Conclusion Originality vs Summary Repeat (Impacts: Conclusion Originality)
  // --------------------------------------------------------------------------
  const lastSection = sectionChunks[sectionChunks.length - 1] || paragraphs[paragraphs.length - 1] || '';
  const lastHeading = headings[headings.length - 1] || '';
  const isConclusionSection = /kesimpulan|penutup|rangkuman|akhir kata/i.test(lastHeading) ||
    /kesimpulannya|pada intinya|sebagai penutup/i.test(lastSection.slice(0, 100));

  if (isConclusionSection) {
    // Check if conclusion is purely summarizing or gives concrete trade-offs / actionable checklist
    const hasDecisionWords = /pilih|prioritaskan|periksa|pastikan|cek|pertimbangkan jika|tahap berikutnya/i.test(lastSection);
    const merelySummarizes = /seperti yang telah dijelaskan di atas|sebagaimana dibahas sebelumnya|secara keseluruhan artikel ini/i.test(lastSection);

    if (merelySummarizes && !hasDecisionWords) {
      issues.push({
        code: 'ARTIFICIAL_CONCLUSION_SUMMARY_ONLY',
        category: 'ARTIFICIAL_CONCLUSION',
        severity: 'WARNING',
        description: 'Bagian akhir hanya merangkum ulang poin-poin sebelumnya tanpa membantu pembaca mengambil keputusan praktis.',
        penalty: 3
      });
      dimConclusion = Math.max(0, dimConclusion - 3);
    } else if (hasDecisionWords) {
      strongAreas.push('Penutup berorientasi pada keputusan dan panduan aksi bagi pembaca');
    }
  }

  // --------------------------------------------------------------------------
  // 10. Evidence Integration (Impacts: Evidence Integration)
  // --------------------------------------------------------------------------
  // Check for presence of numbers, measurements, standards (SNI/ASTM), or citation markers
  const hasMeasurements = /\b\d+(?:[.,]\d+)?\s*(?:cm|mm|m2|m²|kg|watt|derajat|persen|%|tahun|bulan)\b/i.test(cleanMd);
  const hasEvidenceOrStandards = /SNI|ASTM|standar|uji lab|penelitian|spesifikasi|litbang|referensi|\[EVIDENCE:/i.test(cleanMd);

  if (!hasMeasurements && !hasEvidenceOrStandards) {
    issues.push({
      code: 'WEAK_EVIDENCE_SPECIFICITY',
      category: 'EMPTY_GENERALIZATION',
      severity: 'WARNING',
      description: 'Naskah minim angka spesifikasi terukur atau rujukan standar teknis konstruksi.',
      penalty: 5
    });
    dimEvidence = Math.max(0, dimEvidence - 5);
  } else if (hasMeasurements && hasEvidenceOrStandards) {
    strongAreas.push('Integrasi angka teknis dan rujukan standar terukur terjalin rapi');
  }

  // --------------------------------------------------------------------------
  // Score Aggregation & Decision Logic
  // --------------------------------------------------------------------------
  const dimensions: HumanWritingDimensions = {
    sentence_rhythm: Math.round(dimRhythm),
    specificity_detail: Math.round(dimSpecificity),
    contextual_relevance: Math.round(dimContext),
    editorial_voice: Math.round(dimVoice),
    non_template_structure: Math.round(dimStructure),
    evidence_integration: Math.round(dimEvidence),
    reader_perspective: Math.round(dimReader),
    conclusion_originality: Math.round(dimConclusion)
  };

  const totalScore = Math.max(
    0,
    Math.min(
      100,
      dimensions.sentence_rhythm +
        dimensions.specificity_detail +
        dimensions.contextual_relevance +
        dimensions.editorial_voice +
        dimensions.non_template_structure +
        dimensions.evidence_integration +
        dimensions.reader_perspective +
        dimensions.conclusion_originality
    )
  );

  let decision: HumanWritingDecision;
  let passed = false;

  if (totalScore >= 85) {
    decision = 'HUMAN_WRITING_PASS';
    passed = true;
  } else if (totalScore >= 75) {
    decision = 'HUMAN_WRITING_REVISE';
    passed = false;
  } else {
    decision = 'HUMAN_WRITING_REWRITE';
    passed = false;
  }

  // Safeguard: Retry Cap Escalation (Phase 8)
  // If rewrite/revise attempts exhausted (>= maxAttempts), escalate to HUMAN_REVIEW_REQUIRED.
  // Never lower standards automatically!
  if (!passed && attemptCount >= maxAttempts) {
    decision = 'HUMAN_REVIEW_REQUIRED';
  }

  // Generate Structured Rewrite Brief if revise/rewrite is required
  let rewriteBrief: StructuredRewriteBrief | null = null;
  if (!passed && decision !== 'HUMAN_REVIEW_REQUIRED') {
    const requiredActions: string[] = [];
    const failingSections: string[] = [];

    for (const issue of issues) {
      if (issue.category === 'GENERIC_OPENING') {
        requiredActions.push('Ganti pembuka generik dengan situasi atau masalah riil yang dihadapi pemilik rumah.');
        failingSections.push('Paragraf Pembuka');
      } else if (issue.category === 'REPETITIVE_TRANSITIONS') {
        requiredActions.push('Kurangi frasa transisi berulang ("Selain itu", "Di sisi lain"); biarkan alur bergerak melalui hubungan logika ide.');
      } else if (issue.category === 'STRUCTURAL_SYMMETRY') {
        requiredActions.push('Variasikan pola subjudul; jangan gunakan jumlah butir atau pola paragraf yang sama persis di setiap bagian.');
      } else if (issue.category === 'EMPTY_GENERALIZATION') {
        requiredActions.push('Jelaskan trade-off material secara konkret; jangan berhenti di kalimat umum seperti "semua ada kelebihan dan kekurangan".');
      } else if (issue.category === 'EXCESSIVE_HEDGING') {
        requiredActions.push('Gunakan bahasa yang tegas dan presisi; kurangi kata pelindung ("dapat menjadi pilihan", "cenderung").');
      } else if (issue.category === 'LACK_OF_LOCAL_CONTEXT') {
        requiredActions.push('Kaitkan material/desain dengan iklim tropis Indonesia, kelembapan, curah hujan tinggi, atau realitas pemasangan lokal.');
      } else if (issue.category === 'ARTIFICIAL_CONCLUSION') {
        requiredActions.push('Tulis ulang kesimpulan sebagai panduan keputusan praktis: kapan harus memilih opsi A vs B, dan apa yang harus dicek pembaca.');
        failingSections.push('Bagian Kesimpulan / Penutup');
      }
    }

    if (requiredActions.length === 0) {
      requiredActions.push('Perbaiki kelancaran kalimat dan perdalam detail aplikatif untuk pembaca.');
    }

    rewriteBrief = {
      target_agent_id: 'content_writer_primary',
      reason: 'HUMAN_WRITING_QUALITY',
      attempt: attemptCount + 1,
      required_actions: requiredActions,
      preserved_invariants: [
        'Fakta riset teknis, angka spesifikasi, dan rujukan standar konstruksi (SNI/ASTM) tidak boleh diubah.',
        'Dilarang mengarang testimoni personal palsu ("kami sudah menguji", "berdasarkan pengalaman kami") jika tidak ada bukti primer.',
        'Kepatuhan Monetary Silence tetap berlaku mutlak (dilarang menebak harga tanpa riset terverifikasi).'
      ],
      failing_sections: failingSections.length > 0 ? failingSections : ['Revisi umum pada alur dan variasi bahasa']
    };
  }

  return {
    knowledge_version: RANCANGLOKA_EDITORIAL_KNOWLEDGE_VERSION,
    total_score: totalScore,
    decision,
    passed,
    dimensions,
    issues,
    strong_areas: strongAreas,
    evaluated_by: evaluatedBy,
    evaluated_at: evaluatedAt,
    attempt_count: attemptCount,
    max_attempts: maxAttempts,
    rewrite_brief: rewriteBrief
  };
}

/**
 * Joko Authoring Canonical Guidelines (Reference & Prompt Guidance)
 */
export const JOKO_HUMAN_AUTHORING_GUIDELINES = {
  persona: 'Joko — Writer / Editorial Desk',
  capabilities: ['ARTICLE_WRITING', 'HUMAN_WRITING_AUTHORING'],
  editorial_rules: [
    'Tulis untuk pemilik rumah Indonesia dengan bahasa wajar, lugas, dan enak dibaca.',
    'Buka tulisan dari dilema atau masalah nyata pembaca, bukan definisi kamus atau pembuka brosur.',
    'Variasikan panjang kalimat: padukan kalimat pendek yang tegas dengan penjelasan runtut.',
    'Hindari struktur template kaku (jumlah butir identik di setiap subjudul).',
    'Integrasikan bukti dan angka teknis ke dalam alur pemikiran, bukan menumpuk fakta kering.',
    'Jelaskan istilah arsitektur teknis dengan perumpamaan fisik yang mudah dibayangkan.',
    'Pahami iklim tropis lembap Indonesia: tampias, panas sore, lumut, dan ventilasi silang.',
    'Jaga kerendahan hati editorial: jika bukti memiliki batas, nyatakan secara presisi tanpa hedging berlebihan.',
    'Tutup artikel dengan panduan aksi atau trade-off yang jelas bagi pembaca.',
    'MUTLAK: Dilarang mengarang klaim uji coba mandiri ("kami telah menguji") jika tidak ada bukti tangan pertama.'
  ]
};
