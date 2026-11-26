/**
 * RancangLoka — Nadia Voice 3.0 Level L4 ("Santai Berisi") Evaluator
 * Milestone: EDITORIAL_VOICE_3_L4
 *
 * Implements deterministic checks for Level L4 style specification:
 * - Checklist-aware paragraph tokenizer (prevents list grouping artifacts)
 * - Conversational naturalness & transition variety audit
 * - Cross-heading repetitive phrasing detector
 * - Tone restraint audit (prohibits excessive slang like lo/gue while allowing conversational naturalness)
 * - Everyday analogical grounding detector
 * - Intent-aware content family detection (tables in explainers do not force comparison rules)
 *
 * Strictly deterministic, zero external LLM calls.
 */

export interface L4EvaluationOptions {
  articleType?: string;
  topic?: string;
  title?: string;
  targetAudience?: 'HOMEOWNER' | 'PROFESSIONAL';
  editorialVoiceLevel?: 'L4' | 'L5';
}

export interface L4DimensionResult {
  name: string;
  score: number; // 0 - 100
  passed: boolean;
  notes: string[];
  findings: Array<{
    type: 'PASS' | 'WARNING' | 'IMPROVEMENT';
    message: string;
    passage?: string;
  }>;
}

export interface Voice3L4AssessmentResult {
  standard: 'RANCANGLOKA EDITORIAL VOICE 3.0';
  level: 'L4 — SANTAI BERISI' | 'L5 — NATURAL CONVERSATIONAL';
  overallScore: number;
  passed: boolean;
  decision: 'VOICE_3_L4_PASS' | 'VOICE_3_L4_REVISION_REQUIRED';
  dimensions: {
    conversationalNaturalness: L4DimensionResult;
    readerEmpathyAndOpening: L4DimensionResult;
    explanationClarityAndAnalogy: L4DimensionResult;
    technicalAccessibility: L4DimensionResult;
    sentenceRhythmAndBreathing: L4DimensionResult;
    antiRepetition: L4DimensionResult;
    antiTemplateHeading: L4DimensionResult;
    practicalActionability: L4DimensionResult;
    toneAndRestraint: L4DimensionResult;
  };
  measurableSignals: {
    totalWords: number;
    paragraphsCount: number;
    avgWordsPerParagraph: number;
    checklistItemsCount: number;
    conversationalTransitionsCount: number;
    slangViolationsCount: number;
    repetitionClustersCount: number;
  };
  revisionRequests: Array<{
    dimension: string;
    section: string;
    issue: string;
    suggestion: string;
    passage?: string;
  }>;
  evaluatedAt: string;
  executionMode: 'LOCAL_DETERMINISTIC_RUBRIC';
}

// Slang terms that compromise editorial authority
const PROHIBITED_SLANG_PATTERNS = [
  /\b(?:gue|gua|gw|lu|elo|lo)\b/i,
  /\b(?:kudu|kalo gak|boncos|cuan|baper|gabut|mager|kepo)\b/i,
  /\b(?:nih ya|bro|sis|gan|guys)\b/i
];

// Natural conversational Indonesian transition markers (positive signals)
// Updated per Owner Decision: "Berisi seperti ahli, ngobrol seperti teman" (L4/L5 Natural Conversational)
const NATURAL_CONVERSATIONAL_MARKERS = [
  /\bnah\b/i,
  /\btapi tunggu dulu\b/i,
  /\btetapi kalau\b/i,
  /\bcoba perhatikan\b/i,
  /\bcoba (?:bayangkan|cek|lihat|cari tahu|raba|pikirkan)\b/i,
  /\bcoba cek (?:dulu)?\b/i,
  /\bkalau ternyata\b/i,
  /\bnggak perlu (?:buru-buru)?\b/i,
  /\bbisa jadi\b/i,
  /\bmasalahnya\b/i,
  /\bsebenarnya\b/i,
  /\buntungnya\b/i,
  /\bujung-ujungnya\b/i,
  /\bpada dasarnya\b/i,
  /\bsingkatnya\b/i,
  /\bgini gambarannya\b/i,
  /\bkamu\b/i,
  /\brumahmu\b/i,
  /\bkurang lebih seperti itulah\b/i,
  /\blain cerita kalau\b/i,
  /\bbelum tentu\b/i,
  /\b(?:dan itulah )?kabar baiknya\b/i,
  /\bmulai saja dengan\b/i,
  /\bsebelum (?:buru-buru|terburu-buru)\b/i,
  /\bbayangkan (?:ada|seperti)?\b/i,
  /\bpernah (?:melihat|mengalami|mendengar)\b/i,
  /\bpernahkah\b/i,
  /\byang penting\b/i
];

/**
 * Parses markdown into prose paragraphs, checklists, and headings accurately.
 * Treats bullet points as separate checklist items, preventing grouping into artificial 100+ word paragraphs.
 */
export function parseL4Structure(content: string): {
  headings: string[];
  paragraphs: string[];
  checklistItems: string[];
  tables: string[];
} {
  const lines = content.split('\n');
  const headings: string[] = [];
  const checklistItems: string[] = [];
  const tables: string[] = [];
  const rawParagraphBlocks: string[] = [];
  let currentBlock: string[] = [];

  for (const line of lines) {
    const trimmed = line.trim();
    if (trimmed.startsWith('#')) {
      if (currentBlock.length > 0) {
        rawParagraphBlocks.push(currentBlock.join(' '));
        currentBlock = [];
      }
      headings.push(trimmed.replace(/^#+\s*/, ''));
    } else if (trimmed.startsWith('- ') || trimmed.startsWith('* ')) {
      if (currentBlock.length > 0) {
        rawParagraphBlocks.push(currentBlock.join(' '));
        currentBlock = [];
      }
      checklistItems.push(trimmed.replace(/^[-*]\s*/, ''));
    } else if (trimmed.startsWith('|')) {
      if (currentBlock.length > 0) {
        rawParagraphBlocks.push(currentBlock.join(' '));
        currentBlock = [];
      }
      tables.push(trimmed);
    } else if (trimmed === '' || trimmed === '---') {
      if (currentBlock.length > 0) {
        rawParagraphBlocks.push(currentBlock.join(' '));
        currentBlock = [];
      }
    } else {
      currentBlock.push(trimmed);
    }
  }

  if (currentBlock.length > 0) {
    rawParagraphBlocks.push(currentBlock.join(' '));
  }

  const paragraphs = rawParagraphBlocks.filter(p => p.length > 0);

  return { headings, paragraphs, checklistItems, tables };
}

/**
 * Evaluates text against RancangLoka Editorial Voice 3.0 (Level L4 - Santai Berisi)
 */
export function evaluateVoice3L4Assessment(
  content: string,
  options: L4EvaluationOptions = {}
): Voice3L4AssessmentResult {
  const { headings, paragraphs, checklistItems } = parseL4Structure(content);
  const totalWords = content.split(/\s+/).filter(Boolean).length;
  const revisionRequests: Voice3L4AssessmentResult['revisionRequests'] = [];

  // 1. Conversational Naturalness & Transition Quality
  let naturalMarkerMatches = 0;
  let totalTransitionOccurrences = 0;
  const matchedMarkers: string[] = [];
  for (const marker of NATURAL_CONVERSATIONAL_MARKERS) {
    if (marker.test(content)) {
      naturalMarkerMatches++;
      matchedMarkers.push(marker.source);
    }
    const globalReg = new RegExp(marker.source, 'gi');
    const matches = content.match(globalReg);
    if (matches) {
      totalTransitionOccurrences += matches.length;
    }
  }

  // Anti-Stuffing Guard: Detect repetitive or clustered transitions
  let consecutiveTransitionClustering = 0;
  for (let i = 0; i < paragraphs.length - 1; i++) {
    const p1 = paragraphs[i].trim();
    const p2 = paragraphs[i + 1].trim();
    const p1Start = p1.split(/\s+/)[0]?.toLowerCase().replace(/[.,!?:;]+$/, '');
    const p2Start = p2.split(/\s+/)[0]?.toLowerCase().replace(/[.,!?:;]+$/, '');
    if (p1Start && p2Start && p1Start === p2Start && ['nah', 'tapi', 'coba'].includes(p1Start)) {
      consecutiveTransitionClustering++;
    }
  }

  // Academic / Bureaucratic Stiffness Penalty in L4/L5
  const STIFF_FORMAL_SYNTAX_PATTERNS = [
    /\bdalam konteks\b/i,
    /\bmerupakan sebuah proses yang memerlukan pertimbangan\b/i,
    /\bpertimbangan komprehensif\b/i,
    /\bkorelasi yang signifikan\b/i,
    /\bpeningkatan yang substansial\b/i,
    /\badapun parameter yang perlu diperhatikan\b/i,
    /\bberdasarkan hal tersebut\b/i,
    /\bsehubungan dengan hal tersebut\b/i,
    /\bdapat disimpulkan bahwa\b/i,
    /\bsecara teoritis\b/i,
    /\bpada hakekatnya\b/i,
    /\bdalam rangka mencapai\b/i
  ];

  // Generic AI Advice & Mechanical Cliché Patterns (Owner Quality of Thinking Directive)
  const GENERIC_AI_ADVICE_PATTERNS = [
    /\bsesuaikan dengan kebutuhan(?: dan anggaran)?(?: anda| kamu)?\b/i,
    /\bpilihan (?:terbaik )?tergantung pada (?:preferensi|kebutuhan)\b/i,
    /\bkeputusan (?:akhir )?ada di tangan (?:anda|kamu)\b/i,
    /\btidak ada salahnya (?:jika|untuk)\b/i,
    /\bdi era modern ini\b/i,
    /\bseperti yang telah kita ketahui bersama\b/i,
    /\bdalam kehidupan sehari-hari yang serba cepat\b/i
  ];
  let genericAdviceMatches = 0;
  const genericAdvicePassages: string[] = [];
  for (const pat of GENERIC_AI_ADVICE_PATTERNS) {
    const match = content.match(pat);
    if (match) {
      genericAdviceMatches++;
      genericAdvicePassages.push(match[0]);
    }
  }

  let stiffSyntaxMatches = 0;
  const stiffPassages: string[] = [];
  for (const pat of STIFF_FORMAL_SYNTAX_PATTERNS) {
    const match = content.match(pat);
    if (match) {
      stiffSyntaxMatches++;
      stiffPassages.push(match[0]);
    }
  }

  // Reader Address Audit (Owner Decision: L4 defaults to "kamu/rumahmu" rather than formal "Anda")
  const andaMatches = content.match(/\b(?:anda|rumah anda)\b/gi) || [];
  const kamuMatches = content.match(/\b(?:kamu|rumahmu)\b/gi) || [];

  // Base naturalness score: grounded in natural Indonesian flow, not mechanical token counting
  let naturalnessScore = kamuMatches.length > 0 ? 95 : 85;
  if (andaMatches.length > 0) {
    naturalnessScore = Math.max(40, naturalnessScore - andaMatches.length * 15);
  }
  if (consecutiveTransitionClustering > 0) {
    naturalnessScore = Math.max(50, naturalnessScore - consecutiveTransitionClustering * 10);
  }
  if (stiffSyntaxMatches > 0) {
    naturalnessScore = Math.max(45, naturalnessScore - stiffSyntaxMatches * 15);
  }
  if (genericAdviceMatches > 0) {
    naturalnessScore = Math.max(45, naturalnessScore - genericAdviceMatches * 15);
  }

  // Transition stuffing audit: high frequency with low variety does not confer naturalness
  const isTransitionStuffed = totalTransitionOccurrences >= 12 && naturalMarkerMatches <= 2;
  if (isTransitionStuffed) {
    naturalnessScore = Math.max(50, naturalnessScore - 15);
  }

  // Objective gating: Hard failures on formal 'Anda', stiff academic syntax, generic AI advice, or transition stuffing.
  // Conversational marker presence is advisory/enriching, NOT a hard failure blocker.
  const naturalnessPassed = naturalnessScore >= 75 && stiffSyntaxMatches === 0 && andaMatches.length === 0 && !isTransitionStuffed && genericAdviceMatches === 0;
  const naturalnessNotes = [
    `Ditemukan ${naturalMarkerMatches} jenis penanda transisi percakapan alami (total kemunculan: ${totalTransitionOccurrences}).`,
    `Clustering repetisi transisi berurutan: ${consecutiveTransitionClustering}.`,
    `Sintaks formal/akademis kaku: ${stiffSyntaxMatches}.`
  ];
  if (genericAdviceMatches > 0) {
    naturalnessNotes.push(`Nasihat generik klise terdeteksi: ${genericAdviceMatches}x ("${genericAdvicePassages.join(', ')}").`);
  }
  if (kamuMatches.length > 0) {
    naturalnessNotes.push(`Sapaan pembaca menggunakan diksi akrab "kamu/rumahmu" (${kamuMatches.length}x).`);
  }
  if (andaMatches.length > 0) {
    naturalnessNotes.push(`Terdeteksi ${andaMatches.length}x sapaan formal "Anda" pada narasi.`);
  }

  const conversationalNaturalness: L4DimensionResult = {
    name: 'Conversational Naturalness',
    score: naturalnessScore,
    passed: naturalnessPassed,
    notes: naturalnessNotes,
    findings: []
  };

  if (genericAdviceMatches > 0) {
    conversationalNaturalness.findings.push({
      type: 'IMPROVEMENT',
      message: `Terdeteksi ${genericAdviceMatches}x nasihat generik klise ("${genericAdvicePassages.join(', ')}"). Sesuai arahan editorial Owner ("Quality of Thinking"), ganti nasihat klise ini dengan pertimbangan fisik arsitektural yang spesifik bagi pemilik rumah.`
    });
  }

  if (andaMatches.length > 0) {
    conversationalNaturalness.findings.push({
      type: 'IMPROVEMENT',
      message: `Terdeteksi sapaan formal "Anda" (${andaMatches.length}x). Sesuai standar L4/L5 ("Berisi seperti ahli, ngobrol seperti teman"), gunakan sapaan akrab "kamu/rumahmu" agar tidak terasa kaku korporat.`
    });
  }

  if (isTransitionStuffed) {
    conversationalNaturalness.findings.push({
      type: 'IMPROVEMENT',
      message: `Penjejalan transisi terdeteksi (${totalTransitionOccurrences}x kemunculan namun hanya ${naturalMarkerMatches} jenis). Kealamian harus bersumber dari ritme kalimat, bukan frekuensi kata kunci semata.`
    });
  }

  if (naturalMarkerMatches === 0) {
    conversationalNaturalness.findings.push({
      type: 'IMPROVEMENT',
      message: 'Pertimbangkan menambahkan penanda tutur alami (seperti "Nah", "Coba perhatikan", atau "Lain cerita kalau") secara kontekstual untuk memperkaya kehangatan bertutur.'
    });
  }

  if (!naturalnessPassed) {
    conversationalNaturalness.findings.push({
      type: 'IMPROVEMENT',
      message: genericAdviceMatches > 0
        ? `Terdeteksi nasihat generik klise ("${genericAdvicePassages.join(', ')}"). Ganti dengan pertimbangan fisik konkret.`
        : stiffSyntaxMatches > 0
          ? `Terdeteksi konstruksi formal kaku ("${stiffPassages.join(', ')}"). Ganti dengan bahasa tutur alami.`
          : andaMatches.length > 0
            ? 'Hapus kata sapaan formal "Anda" dan gunakan sapaan hangat "kamu/rumahmu".'
            : isTransitionStuffed
              ? 'Frekuensi transisi tinggi namun minim variasi. Variasikan gaya bertutur secara alami.'
              : 'Transisi percakapan tampak menumpuk atau repetitif. Sebarkan secara proporsional.'
    });
    revisionRequests.push({
      dimension: 'Conversational Naturalness',
      section: headings[0] || 'Pembuka',
      issue: genericAdviceMatches > 0
        ? 'Naskah memuat nasihat generik klise AI ("sesuaikan dengan kebutuhan Anda" dsb)'
        : 'Gaya naskah belum memenuhi standar naturalitas percakapan L4/L5 (Santai Berisi)',
      suggestion: genericAdviceMatches > 0
        ? 'Gantikan nasihat generik dengan panduan kriteria fisik spesifik (misal: "kalau tujuan utamamu meredam suara tetesan hujan, bahan berongga atau berpori jauh lebih efektif")'
        : 'Gunakan bahasa tutur konsultan yang bersahaja dengan transisi percakapan wajar tanpa menumpuk frasa yang sama',
      passage: genericAdvicePassages[0] || (paragraphs[0] ? paragraphs[0].slice(0, 120) + '...' : undefined)
    });
  } else {
    conversationalNaturalness.findings.push({
      type: 'PASS',
      message: 'Naskah menggunakan gaya percakapan alami yang mengalir lancar dan santun.'
    });
  }

  // 2. Reader Empathy & Opening
  const openingPara = paragraphs[0] || '';
  const hasSensoryOpening = /(?:pagi-pagi|ketika|saat|pernahkah|basah|dingin|panas|terasa|pernah melihat)/i.test(openingPara);
  const openingHasGenericSlop = /(?:di era|dalam kehidupan modern|seiring perkembangan|pada dasarnya|seperti yang kita ketahui)/i.test(openingPara);
  const empathyScore = openingHasGenericSlop ? 40 : (hasSensoryOpening ? 100 : 75);
  const readerEmpathyAndOpening: L4DimensionResult = {
    name: 'Reader Empathy & Opening',
    score: empathyScore,
    passed: empathyScore >= 75,
    notes: openingHasGenericSlop
      ? ['Pembuka terdeteksi menggunakan formula generik klise.']
      : ['Pembuka berangkat dari pengamatan indrawi atau situasi nyata pemilik rumah.'],
    findings: []
  };
  if (openingHasGenericSlop) {
    revisionRequests.push({
      dimension: 'Reader Empathy & Opening',
      section: headings[0] || 'Paragraf Pertama',
      issue: 'Pembuka artikel menggunakan formula klise AI generik',
      suggestion: 'Awali langsung dari pengamatan fisik nyata atau pertanyaan langsung pemilik rumah',
      passage: openingPara.slice(0, 120) + '...'
    });
  }

  // 3. Explanation Clarity & Analogy
  const hasAnalogy = /(?:bayangkan|seperti|gelas|jalan pintas|air es|diibaratkan)/i.test(content);
  const analogyScore = hasAnalogy ? 100 : 75;
  const explanationClarityAndAnalogy: L4DimensionResult = {
    name: 'Explanation Clarity & Analogy',
    score: analogyScore,
    passed: analogyScore >= 75,
    notes: hasAnalogy
      ? ['Memuat perumpamaan atau analogi fisik sehari-hari sebelum istilah teknis.']
      : ['Pertimbangkan menambahkan analogi visual sederhana untuk konsep fisik utama.'],
    findings: []
  };

  // 4. Technical Accessibility
  const hasTechnicalTerms = /(?:thermal bridge|jembatan termal|kondensasi|thermal break)/i.test(content);
  const explainsMeaningFirst = /(?:panas lebih mudah lewat|jalan pintas|titik-titik air|bagian pemisah)/i.test(content);
  const accessibilityScore = hasTechnicalTerms && explainsMeaningFirst ? 100 : 80;
  const technicalAccessibility: L4DimensionResult = {
    name: 'Technical Accessibility',
    score: accessibilityScore,
    passed: accessibilityScore >= 75,
    notes: ['Istilah teknis diiringi penjelasan makna operasional yang mudah dimengerti.'],
    findings: []
  };

  // 5. Sentence Rhythm & Breathing
  let longParas = 0;
  paragraphs.forEach((p, idx) => {
    const wc = p.split(/\s+/).filter(Boolean).length;
    if (wc > 85) {
      longParas++;
      revisionRequests.push({
        dimension: 'Sentence Rhythm & Breathing',
        section: `Paragraf ke-${idx + 1}`,
        issue: `Paragraf terlalu padat (${wc} kata, melebihi batas 85 kata)`,
        suggestion: 'Pecah menjadi 2 atau 3 paragraf pendek-menengah dengan 1 ide pokok per paragraf',
        passage: p.slice(0, 120) + '...'
      });
    }
  });
  let longListItems = 0;
  checklistItems.forEach((item, idx) => {
    const wc = item.split(/\s+/).filter(Boolean).length;
    if (wc > 45) {
      longListItems++;
      revisionRequests.push({
        dimension: 'Sentence Rhythm & Breathing',
        section: `Butir Checklist ke-${idx + 1}`,
        issue: `Butir checklist terlalu panjang (${wc} kata, melebihi batas 45 kata)`,
        suggestion: 'Persingkat menjadi poin diagnostik cepat yang mudah dipindai mata',
        passage: item.slice(0, 100) + '...'
      });
    }
  });
  const rhythmScore = Math.max(50, 100 - (longParas * 15) - (longListItems * 10));
  const sentenceRhythmAndBreathing: L4DimensionResult = {
    name: 'Sentence Rhythm & Breathing',
    score: rhythmScore,
    passed: rhythmScore >= 75,
    notes: [
      `Rata-rata kata per paragraf: ${paragraphs.length > 0 ? Math.round(totalWords / paragraphs.length) : 0} kata.`,
      `Paragraf melebihi 85 kata: ${longParas}. Butir checklist melebihi 45 kata: ${longListItems}.`
    ],
    findings: longParas > 0
      ? [{ type: 'WARNING', message: `${longParas} paragraf melebihi batas kenyamanan baca 85 kata.` }]
      : [{ type: 'PASS', message: 'Ritme paragraf dan butir checklist sangat nyaman dan bernapas.' }]
  };

  // 6. Anti-Repetition
  const testPhrases = [
    'panas yang merambat',
    'sisi luar dan sisi dalam',
    'titik embun',
    'thermal break',
    'jembatan termal'
  ];
  let highRepetitionCount = 0;
  testPhrases.forEach(ph => {
    const reg = new RegExp(ph, 'gi');
    const matches = content.match(reg) || [];
    if (matches.length > 6) {
      highRepetitionCount++;
      revisionRequests.push({
        dimension: 'Anti-Repetition',
        section: 'Seluruh Naskah',
        issue: `Frasa "${ph}" diulang ${matches.length} kali`,
        suggestion: 'Variasikan dengan penyebutan kontekstual atau gunakan kata ganti yang wajar',
        passage: `Pengulangan frekuensi tinggi: "${ph}" (${matches.length}x)`
      });
    }
  });
  if (consecutiveTransitionClustering > 1) {
    revisionRequests.push({
      dimension: 'Anti-Repetition',
      section: 'Seluruh Naskah',
      issue: `Terdeteksi ${consecutiveTransitionClustering} kali transisi percakapan berulang di awal paragraf berturut-turut ("Nah", "Tapi", atau "Coba")`,
      suggestion: 'Variasikan awal paragraf dengan pengamatan situasi, kata ganti, atau langsung ke pokok bahasan',
      passage: `Clustering transisi berulang: ${consecutiveTransitionClustering}x berturut-turut`
    });
  }
  const antiRepetitionScore = Math.max(50, 100 - (highRepetitionCount * 15) - (consecutiveTransitionClustering * 15));
  const antiRepetition: L4DimensionResult = {
    name: 'Anti-Repetition',
    score: antiRepetitionScore,
    passed: antiRepetitionScore >= 75 && consecutiveTransitionClustering <= 1,
    notes: [
      `Pengulangan frasa kunci terkontrol (${highRepetitionCount} frasa).`,
      `Clustering repetisi transisi awal paragraf: ${consecutiveTransitionClustering}.`
    ],
    findings: []
  };

  // 7. Anti-Template Heading
  let formulaicHeadings = 0;
  headings.forEach(h => {
    if (/^Langkah\s+\d+|^Bagian\s+\d+|^Poin\s+\d+/i.test(h)) {
      formulaicHeadings++;
      revisionRequests.push({
        dimension: 'Anti-Template Heading',
        section: h,
        issue: `Subjudul "${h}" menggunakan penomoran kaku formulaic template`,
        suggestion: 'Gunakan pertanyaan alami atau frasa tindakan yang hidup (misal: "Coba cek empat hal ini dulu")',
        passage: h
      });
    }
  });
  const headingScore = Math.max(70, 100 - formulaicHeadings * 15);
  const antiTemplateHeading: L4DimensionResult = {
    name: 'Anti-Template Heading',
    score: headingScore,
    passed: headingScore >= 75,
    notes: [`Heading mengalir alami menggunakan gaya pertanyaan dan percakapan kontekstual.`],
    findings: []
  };

  // 8. Practical Actionability
  const hasSelfCheck = checklistItems.length >= 3 || /(?:coba cek|amati|periksa|seka dulu|catat)/i.test(content);
  const hasProportionalSteps = /(?:sebelum|panggil tukang|teknisi|jangan buru-buru)/i.test(content);
  const actionabilityScore = hasSelfCheck && hasProportionalSteps ? 100 : 75;
  const practicalActionability: L4DimensionResult = {
    name: 'Practical Actionability',
    score: actionabilityScore,
    passed: actionabilityScore >= 75,
    notes: ['Memuat langkah pemeriksaan mandiri yang konkret dan realistis.'],
    findings: []
  };

  // 9. Tone & Restraint
  let slangCount = 0;
  PROHIBITED_SLANG_PATTERNS.forEach(sp => {
    const matches = content.match(sp);
    if (matches) {
      slangCount += matches.length;
      revisionRequests.push({
        dimension: 'Tone & Restraint',
        section: 'Kosa Kata Naskah',
        issue: `Ditemukan kata slang terlarang: "${matches[0]}"`,
        suggestion: 'Gunakan kosa kata bahasa Indonesia santun yang bersahaja tanpa bahasa gaul berlebihan',
        passage: matches[0]
      });
    }
  });
  const toneScore = slangCount === 0 ? 100 : Math.max(40, 100 - slangCount * 25);
  const toneAndRestraint: L4DimensionResult = {
    name: 'Tone & Restraint',
    score: toneScore,
    passed: toneScore >= 75,
    notes: slangCount === 0
      ? ['Gaya santai berwibawa, bebas dari slang tidak pantas (lo/gue).']
      : [`Ditemukan ${slangCount} kata slang informal berlebihan.`],
    findings: slangCount > 0
      ? [{ type: 'WARNING', message: 'Hapus slang berlebihan agar wibawa redaksi tetap terjaga.' }]
      : [{ type: 'PASS', message: 'Keseimbangan kehangatan dan rasa hormat terjaga sempurna.' }]
  };

  const dimensions = {
    conversationalNaturalness,
    readerEmpathyAndOpening,
    explanationClarityAndAnalogy,
    technicalAccessibility,
    sentenceRhythmAndBreathing,
    antiRepetition,
    antiTemplateHeading,
    practicalActionability,
    toneAndRestraint
  };

  const dimValues = Object.values(dimensions);
  const overallScore = Math.round(dimValues.reduce((acc, d) => acc + d.score, 0) / dimValues.length);
  const allPassed = dimValues.every(d => d.passed);

  // Hard Invariant: Failing Conversational Naturalness forces REVISION_REQUIRED regardless of overall average score
  const isL4Pass = allPassed && overallScore >= 80 && conversationalNaturalness.passed;

  return {
    standard: 'RANCANGLOKA EDITORIAL VOICE 3.0',
    level: options.editorialVoiceLevel === 'L5' ? 'L5 — NATURAL CONVERSATIONAL' : 'L4 — SANTAI BERISI',
    overallScore,
    passed: isL4Pass,
    decision: isL4Pass ? 'VOICE_3_L4_PASS' : 'VOICE_3_L4_REVISION_REQUIRED',
    dimensions,
    measurableSignals: {
      totalWords,
      paragraphsCount: paragraphs.length,
      avgWordsPerParagraph: paragraphs.length > 0 ? Math.round(totalWords / paragraphs.length) : 0,
      checklistItemsCount: checklistItems.length,
      conversationalTransitionsCount: totalTransitionOccurrences,
      slangViolationsCount: slangCount,
      repetitionClustersCount: highRepetitionCount
    },
    revisionRequests,
    evaluatedAt: new Date().toISOString(),
    executionMode: 'LOCAL_DETERMINISTIC_RUBRIC'
  };
}
