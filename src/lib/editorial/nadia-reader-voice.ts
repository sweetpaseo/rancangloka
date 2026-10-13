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

export interface ReaderVoiceEvaluationResult {
  decision: ReaderVoiceWorkflowState;
  overallScore: number;
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
  };
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

export const DENSE_PARAGRAPH_WORD_THRESHOLD = 90;

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

  const text = String(content || '').trim();
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
  for (const heavy of HEAVY_EDITORIAL_PATTERNS) {
    if (heavy.pattern.test(text)) {
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
  // Rubric I: PARAGRAPH BREATHING & DENSITY CHECK
  // --------------------------------------------------------------------------
  const paragraphDensityWarnings: string[] = [];
  const denseParagraphFlags: RubricDimensionResult['flaggedPassages'] = [];
  const denseParagraphNotes: string[] = [];
  let breathingScore = 100;

  paragraphs.forEach((p, idx) => {
    // Skip headings, tables, or divider lines
    if (p.startsWith('#') || p.startsWith('|') || p.startsWith('---')) return;

    const words = p.split(/\s+/).filter(Boolean).length;
    if (words >= DENSE_PARAGRAPH_WORD_THRESHOLD) {
      breathingScore -= Math.min(30, Math.floor((words - 80) / 10) * 10);
      const warningMsg = `PARAGRAPH_DENSITY_WARNING: Paragraf ke-${idx + 1} (${words} kata) melebihi batas kenyamanan baca 90 kata. Pecah menjadi 1-3 kalimat dengan satu ide pokok.`;
      paragraphDensityWarnings.push(warningMsg);
      denseParagraphNotes.push(warningMsg);
      denseParagraphFlags.push({
        passage: p.slice(0, 100) + '...',
        issue: warningMsg,
        suggestion: 'Pecah menjadi 2 atau 3 paragraf pendek-menengah (30-70 kata).'
      });
      revisionRequests.push({
        section: `Paragraf ke-${idx + 1}`,
        currentPhrasing: p.slice(0, 80) + '...',
        requestedImprovement: warningMsg
      });
    }
  });

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
  // Aggregated Overall Score (Mean across 9 dimensions)
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
    paragraphBreathing.score
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
    overallScore < 80
  ) {
    decision = 'READER_VOICE_REVISION_REQUIRED';
  }

  return {
    decision,
    overallScore,
    dimensions: {
      problemFirstOpening,
      spokenIndonesian,
      translationese,
      jargonBudget,
      rawTechnicalSyntax,
      headingClarity,
      homeownerComprehension,
      humanRhythm,
      paragraphBreathing
    },
    paragraphDensityWarnings,
    escapedMarkdownIssues,
    visualDensitySignals,
    authorityCheck,
    aiDetectorAdvisory,
    blockingIssues,
    revisionRequests,
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
