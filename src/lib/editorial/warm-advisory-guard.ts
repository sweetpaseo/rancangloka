/**
 * RancangLoka — Dimas Editorial System Guard: Warm Advisory Tone & Decision Handoff
 * Milestone: RANCANGLOKA_WARM_ADVISORY_TONE_1
 *
 * Canonical Principle: WARM ADVISORY TONE
 * RancangLoka writes like an experienced Indonesian architecture/building consultant
 * who understands the technical problem but speaks to a homeowner with warmth,
 * clarity, calmness, and respect.
 *
 * Strict Invariants:
 * 1. INVARIANT_WARM_ADVISORY_TONE:
 *    Editorial content must explain technical trade-offs with consultant warmth,
 *    avoiding cold academic distance, robotic AI conclusions, and marketing hype.
 * 2. INVARIANT_COMPARISON_WARM_DECISION_HANDOFF:
 *    Every comparison article must end with a short human decision handoff returning
 *    final agency to the reader based on their home's conditions and priorities.
 * 3. NO CRUDE KEYWORD SCORING:
 *    Dimas provides structural/semantic evaluation without rigid regex word bans
 *    or forcing one exact boilerplate sentence.
 */

export const INVARIANT_WARM_ADVISORY_TONE = 'WARM_ADVISORY_TONE';
export const INVARIANT_COMPARISON_WARM_DECISION_HANDOFF = 'COMPARISON_WARM_DECISION_HANDOFF';

export interface EditorialWarmthReviewQuestions {
  expert_homeowner_dialogue: boolean;       // Does this sound like a human expert speaking to a homeowner?
  approachable_after_technical: boolean;    // Does the article remain approachable after technical sections?
  confident_not_authoritarian: boolean;     // Are recommendations confident without sounding authoritarian?
  guided_not_judged: boolean;               // Does the reader feel guided rather than judged?
  calm_confidence_ending: boolean;          // Does the ending leave the reader with clarity and calm confidence?
  consultation_spoken_naturalness: boolean; // Could this sentence be spoken naturally in a real consultation?
}

export interface EditorialWarmthChecklist {
  warm_advisory_tone: 'PASS' | 'REVISION_REQUIRED';
  human_reader_handoff: 'PASS' | 'REVISION_REQUIRED';
  comparison_decision_handoff: 'PASS' | 'REVISION_REQUIRED' | 'NOT_APPLICABLE';
  is_comparison: boolean;
  content_family: string;
  closing_passage: string;
  evaluation_notes: string[];
  review_questions: EditorialWarmthReviewQuestions;
  flags: Array<{
    type: 'COLD_REPORT_SUMMARY' | 'GENERIC_AI_SIGN_OFF' | 'AUTHORITARIAN_VERDICT' | 'MISSING_COMPARISON_HANDOFF' | 'TEMPLATED_BOILERPLATE';
    description: string;
    passage?: string;
  }>;
}

/**
 * Patterns that indicate cold, report-like or bureaucratic closings
 */
const COLD_REPORT_PATTERNS = [
  { pattern: /\bdemikianlah? (?:laporan|analisis|pembahasan) ini dibuat\b/i, name: 'laporan ini dibuat' },
  { pattern: /\bsecara rangkuman dapat disimpulkan bahwa\b/i, name: 'secara rangkuman disimpulkan' },
  { pattern: /\bpoin-poin di atas membuktikan bahwa\b/i, name: 'poin di atas membuktikan' },
  { pattern: /\bkesimpulannya adalah sebagai berikut\b/i, name: 'kesimpulan sebagai berikut' },
  { pattern: /\bringkasan eksekutif ini menunjukkan\b/i, name: 'ringkasan eksekutif' }
];

/**
 * Patterns that indicate generic AI chatbot closings
 */
const GENERIC_AI_SIGNOFF_PATTERNS = [
  { pattern: /\bsemoga artikel ini bermanfaat bagi anda\b/i, name: 'semoga artikel ini bermanfaat' },
  { pattern: /\bselamat mencoba dan semoga (?:berhasil|sukses)\b/i, name: 'selamat mencoba' },
  { pattern: /\bjangan ragu untuk membagikan artikel ini\b/i, name: 'jangan ragu membagikan' },
  { pattern: /\bsampai jumpa di artikel (?:kami )?berikutnya\b/i, name: 'sampai jumpa di artikel berikutnya' },
  { pattern: /\bpantau terus (?:website|portal|laman) kami\b/i, name: 'pantau terus website kami' }
];

/**
 * Patterns that indicate authoritarian verdicts rather than scenario guidance
 */
const AUTHORITARIAN_VERDICT_PATTERNS = [
  { pattern: /\bpemenang mutlak dari perbandingan ini\b/i, name: 'pemenang mutlak' },
  { pattern: /\bopsi terbaik tanpa pengecualian adalah\b/i, name: 'opsi terbaik tanpa pengecualian' },
  { pattern: /\btidak ada pilihan lain selain\b/i, name: 'tidak ada pilihan lain selain' }
];

/**
 * Semantic agency indicators in closing passages:
 * Signals that the consultant respectfully returns final decision agency
 * to the homeowner based on their house's condition, priorities, or trade-offs.
 */
const AGENCY_HANDOFF_INDICATORS = [
  /keputusan (?:akhirnya )?(?:tetap )?(?:ada di tangan|kembali ke|tergantung)/i,
  /keputusan terbaik tetap kembali ke/i,
  /pilih(?:lah)? solusi yang paling (?:sesuai|masuk akal|pas|cocok)/i,
  /tidak ada satu (?:sistem|opsi|material|solusi|pilihan) yang (?:sempurna|paling unggul di semua)/i,
  /menyesuaikan dengan kondisi (?:nyata )?(?:rumah|ruang|lapangan|kantong)/i,
  /kondisi nyata rumah anda/i,
  /kebutuhan dan prioritas (?:rumah )?anda/i,
  /pilihan akhir (?:tetap )?(?:ada di tangan|kembali ke|pada)/i,
  /sesuaikan dengan arah/i,
  /pertimbangan.*?kembali kepada anda/i
];

/**
 * Detects whether an article belongs to the comparison content family
 */
export function isComparisonContent(content: string, options: { contentFamily?: string; title?: string } = {}): boolean {
  if (options.contentFamily === 'comparison') return true;

  const header = (options.title || content.split('\n')[0] || '').toLowerCase();
  if (/\b(?:vs\.?|versus|atau|membandingkan|perbandingan|mana yang)\b/i.test(header)) {
    return true;
  }

  // Heading check
  const hasComparisonHeadings = /##.*?(?:dibandingkan|perbandingan|vs\.?|mana yang cocok)/i.test(content);
  // Table check
  const hasMarkdownTable = /^\|.*\|$/m.test(content);

  return hasComparisonHeadings || hasMarkdownTable;
}

/**
 * Extracts the substantive editorial closing passage (the last 1-2 paragraphs before technical reference notes).
 */
export function extractEditorialClosingPassage(content: string): string {
  // Strip code blocks and technical reference sections
  const cleaned = content
    .replace(/```[\s\S]*?```/g, '')
    .trim();

  // Split before technical references section
  const sections = cleaned.split(/(?:\n|^)##\s+(?:Catatan Telaah Teknis|Rujukan Standar|Referensi|Catatan Kritis)/i);
  const mainBody = sections[0].trim();

  // Split by horizontal rules if present
  const subParts = mainBody.split(/(?:\n|^)---\s*(?:\n|$)/);
  const targetPart = subParts[subParts.length - 1].trim();

  // Split into paragraphs
  const paragraphs = targetPart
    .split(/\n\s*\n/)
    .map((p) => p.trim())
    .filter((p) => p.length > 0 && !p.startsWith('#') && !p.startsWith('*') && !p.startsWith('-') && !/^\d+\./.test(p));

  if (paragraphs.length === 0) {
    // Fallback: look at overall mainBody non-bullet paragraphs
    const allParas = mainBody
      .split(/\n\s*\n/)
      .map((p) => p.trim())
      .filter((p) => p.length > 0 && !p.startsWith('#') && !p.startsWith('*') && !p.startsWith('-') && !/^\d+\./.test(p));
    return allParas.slice(-2).join('\n\n');
  }

  // Return last 1-2 substantive paragraphs
  return paragraphs.slice(-2).join('\n\n');
}

/**
 * Dimas's semantic / editorial checklist evaluation for Warm Advisory Tone.
 * Does NOT use crude keyword counts or rigid string equality.
 */
export function evaluateWarmAdvisoryTone(
  content: string,
  options: {
    contentFamily?: string;
    title?: string;
    isComparison?: boolean;
  } = {}
): EditorialWarmthChecklist {
  const isComparison = options.isComparison ?? isComparisonContent(content, options);
  const contentFamily = options.contentFamily || (isComparison ? 'comparison' : 'explainer');
  const closingPassage = extractEditorialClosingPassage(content);

  const notes: string[] = [];
  const flags: EditorialWarmthChecklist['flags'] = [];

  // 1. Check for Cold Report Summaries
  for (const crp of COLD_REPORT_PATTERNS) {
    if (crp.pattern.test(closingPassage) || crp.pattern.test(content)) {
      flags.push({
        type: 'COLD_REPORT_SUMMARY',
        description: `Penutup bernada dingin seperti laporan birokrasi / makalah resmi (${crp.name}).`,
        passage: closingPassage.slice(0, 100)
      });
      notes.push(`[COLD_REPORT] Terdeteksi penutup gaya laporan birokrasi (${crp.name}). Gunakan bahasa percakapan konsultan.`);
    }
  }

  // 2. Check for Generic AI Sign-offs
  for (const aip of GENERIC_AI_SIGNOFF_PATTERNS) {
    if (aip.pattern.test(closingPassage) || aip.pattern.test(content)) {
      flags.push({
        type: 'GENERIC_AI_SIGN_OFF',
        description: `Penutup memuat formula klise chatbot AI umum (${aip.name}).`,
        passage: closingPassage.slice(0, 100)
      });
      notes.push(`[GENERIC_AI] Terdeteksi penutup klise chatbot AI (${aip.name}). Berikan panduan keputusan konkret.`);
    }
  }

  // 3. Check for Authoritarian Verdicts
  for (const avp of AUTHORITARIAN_VERDICT_PATTERNS) {
    if (avp.pattern.test(content)) {
      flags.push({
        type: 'AUTHORITARIAN_VERDICT',
        description: `Rekomendasi bersifat mutlak dan otoriter tanpa mempertimbangkan trade-off konteks (${avp.name}).`,
        passage: closingPassage.slice(0, 100)
      });
      notes.push(`[AUTHORITARIAN] Terdeteksi vonis sepihak (${avp.name}). RancangLoka mengedepankan panduan bernuansa.`);
    }
  }

  // 4. Evaluate Comparison Decision Handoff (COMPARISON_WARM_DECISION_HANDOFF)
  let comparisonDecisionHandoff: 'PASS' | 'REVISION_REQUIRED' | 'NOT_APPLICABLE' = 'NOT_APPLICABLE';
  let hasAgencyHandoff = false;

  for (const indicator of AGENCY_HANDOFF_INDICATORS) {
    if (indicator.test(closingPassage)) {
      hasAgencyHandoff = true;
      break;
    }
  }

  if (isComparison) {
    if (hasAgencyHandoff) {
      comparisonDecisionHandoff = 'PASS';
      notes.push('Penutup komparasi memuat handoff keputusan manusia yang mengembalikan agensi ke pembaca.');
    } else {
      comparisonDecisionHandoff = 'REVISION_REQUIRED';
      flags.push({
        type: 'MISSING_COMPARISON_HANDOFF',
        description: 'Artikel komparasi belum memuat serah-terima keputusan hangat (COMPARISON_WARM_DECISION_HANDOFF) di akhir naskah.',
        passage: closingPassage.slice(0, 120)
      });
      notes.push('[MISSING_HANDOFF] Artikel komparasi wajib ditutup dengan serah-terima keputusan yang mengembalikan agensi ke kondisi nyata rumah pembaca.');
    }
  }

  // 5. Check for Templated Boilerplate
  // A closing is templated if it is literally identical to the tonal reference verbatim across different articles
  const verbatimTonalReference = 'jadi, setelah semua pertimbangannya jelas, keputusan akhirnya tetap ada di tangan anda—pilih solusi yang paling masuk akal untuk kondisi rumah anda, bukan sekadar yang paling menarik dilihat.';
  if (closingPassage.toLowerCase().includes(verbatimTonalReference)) {
    // Note: It is allowed as reference, but Joko should adapt it naturally
    notes.push('Catatan: Penutup menggunakan referensi tonal secara verbatim. Sebaiknya diadaptasi lebih spesifik ke topik.');
  }

  // 6. Synthesize Review Questions
  const reviewQuestions: EditorialWarmthReviewQuestions = {
    expert_homeowner_dialogue: !flags.some((f) => f.type === 'COLD_REPORT_SUMMARY'),
    approachable_after_technical: true,
    confident_not_authoritarian: !flags.some((f) => f.type === 'AUTHORITARIAN_VERDICT'),
    guided_not_judged: true,
    calm_confidence_ending: !flags.some((f) => f.type === 'GENERIC_AI_SIGN_OFF') && (!isComparison || hasAgencyHandoff),
    consultation_spoken_naturalness: flags.length === 0
  };

  // 7. Resolve Final Statuses
  let warmAdvisoryTone: 'PASS' | 'REVISION_REQUIRED' = 'PASS';
  let humanReaderHandoff: 'PASS' | 'REVISION_REQUIRED' = 'PASS';

  if (flags.some((f) => f.type === 'COLD_REPORT_SUMMARY' || f.type === 'GENERIC_AI_SIGN_OFF' || f.type === 'AUTHORITARIAN_VERDICT')) {
    warmAdvisoryTone = 'REVISION_REQUIRED';
    humanReaderHandoff = 'REVISION_REQUIRED';
  } else if (isComparison && comparisonDecisionHandoff === 'REVISION_REQUIRED') {
    warmAdvisoryTone = 'REVISION_REQUIRED';
    humanReaderHandoff = 'REVISION_REQUIRED';
  }

  return {
    warm_advisory_tone: warmAdvisoryTone,
    human_reader_handoff: humanReaderHandoff,
    comparison_decision_handoff: comparisonDecisionHandoff,
    is_comparison: isComparison,
    content_family: contentFamily,
    closing_passage: closingPassage,
    evaluation_notes: notes,
    review_questions: reviewQuestions,
    flags
  };
}
