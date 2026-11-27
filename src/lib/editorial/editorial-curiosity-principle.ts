/**
 * RancangLoka — Editorial Curiosity Principle (ECP) Engine
 * File: src/lib/editorial/editorial-curiosity-principle.ts
 *
 * Owner Permanent Decision:
 * 1. Headline wajib berupa pertanyaan natural yang berangkat dari rasa ingin tahu pemilik rumah.
 * 2. Headline wajib diakhiri tanda tanya (?).
 * 3. Opening membangkitkan rasa ingin tahu (curiosity hook), bukan ringkasan birokratis/definisi kamus.
 * 4. Focus keyword ditenun secara alami pada kalimat pertama paragraf pembuka.
 * 5. Isi artikel secara metodologis menjawab pertanyaan headline berdasarkan bukti fisik & empiris.
 * 6. Closing terdiri dari tepat 2 paragraf substantif dengan focus keyword ditenun alami pada kalimat terakhir.
 * 7. Tetap mempertahankan L5 Natural Conversational ("Berbicara dengan bahasa orang rumah, tetapi berpikir seperti editor yang paham teknis")
 *    dan selaras dengan Golden Article #9993.
 */

export interface EditorialCuriosityCheckResult {
  rule_id: string;
  name: string;
  passed: boolean;
  score: number; // 0 - 100
  evidence: string;
  suggestion?: string;
}

export interface EditorialCuriosityEvaluation {
  status: 'PASS' | 'REVISION_REQUIRED';
  overall_score: number; // 0 - 100
  headline: string;
  focus_keyword: string;
  checks: {
    headline_is_question: boolean;
    headline_has_question_mark: boolean;
    opening_awakens_curiosity: boolean;
    opening_has_focus_keyword: boolean;
    closing_has_focus_keyword: boolean;
    closing_substantive_structure: boolean;
    body_answers_question: boolean;
    no_formulaic_clickbait: boolean;
  };
  details: EditorialCuriosityCheckResult[];
  actionable_findings: string[];
}

// Banned clickbait or low-quality patterns
const FORMULAIC_CLICKBAIT_PATTERNS = [
  /^(ini dia|wajib tahu|rahasia terkuak|jangan kaget|simak yuk|intip yuk|dijamin ampuh)/i,
  /^(5 cara|10 tips|7 trik|rahasia sukses)/i,
  / bikin melongo/i,
  / bikin syok/i,
  / auto kaya/i,
  / nomor \d+ bikin/i
];

// Indonesian interrogative cues
const NATURAL_QUESTION_STARTERS = [
  /^(mengapa|kenapa|apakah|benarkah|bagaimana|kapan|berapa|haruskah|amankah|bisakah|perlukah|pilih mana|lebih baik mana|solusi apa)/i,
  /(gimana|kenapa|apa benar|mana yang lebih)/i
];

/**
 * Evaluates a manuscript and headline against the Editorial Curiosity Principle.
 */
export function evaluateEditorialCuriosityPrinciple(params: {
  headline: string;
  manuscript: string;
  focusKeyword: string;
}): EditorialCuriosityEvaluation {
  const headline = (params.headline || '').trim();
  const manuscript = (params.manuscript || '').trim();
  const keyword = (params.focusKeyword || '').trim().toLowerCase();

  const details: EditorialCuriosityCheckResult[] = [];
  const findings: string[] = [];

  // 1. Headline Question Mark
  const hasQuestionMark = headline.endsWith('?');
  details.push({
    rule_id: 'ECP-01-QUESTION-MARK',
    name: 'Headline Diakhiri Tanda Tanya',
    passed: hasQuestionMark,
    score: hasQuestionMark ? 100 : 0,
    evidence: hasQuestionMark
      ? `Headline diakhiri tanda tanya: "${headline}"`
      : `Headline tidak diakhiri tanda tanya (?): "${headline}"`,
    suggestion: hasQuestionMark ? undefined : 'Ubah headline menjadi kalimat tanya eksplisit yang diakhiri tanda tanya (?).'
  });
  if (!hasQuestionMark) {
    findings.push('Headline wajib diakhiri tanda tanya (?).');
  }

  // 2. Headline Natural Question Construction
  const hasInterrogativeCue = NATURAL_QUESTION_STARTERS.some(pat => pat.test(headline)) || hasQuestionMark;
  details.push({
    rule_id: 'ECP-02-NATURAL-QUESTION',
    name: 'Headline Berupa Pertanyaan Natural',
    passed: hasInterrogativeCue,
    score: hasInterrogativeCue ? 100 : 20,
    evidence: hasInterrogativeCue
      ? 'Headline memuat konstruksi kalimat tanya yang wajar.'
      : 'Headline bukan berupa kalimat tanya yang mencerminkan rasa ingin tahu pembaca.',
    suggestion: hasInterrogativeCue ? undefined : 'Gunakan kata tanya natural (misal: "Mengapa...", "Benarkah...", "Bagaimana Cara...", "Pilih Mana...").'
  });
  if (!hasInterrogativeCue) {
    findings.push('Headline harus dirumuskan sebagai pertanyaan natural dari sudut pandang pemilik rumah.');
  }

  // 3. No Formulaic Clickbait
  const isClickbait = FORMULAIC_CLICKBAIT_PATTERNS.some(pat => pat.test(headline));
  details.push({
    rule_id: 'ECP-03-ANTI-CLICKBAIT',
    name: 'Bebas Pola Clickbait Formulaik',
    passed: !isClickbait,
    score: isClickbait ? 0 : 100,
    evidence: isClickbait
      ? `Headline mengandung pola clickbait murahan yang dilarang.`
      : 'Headline bebas dari pola clickbait formulaik.',
    suggestion: isClickbait ? 'Hindari frasa klise seperti "Ini Dia", "Wajib Tahu", "Rahasia Terkuak".' : undefined
  });
  if (isClickbait) {
    findings.push('Headline terdeteksi menggunakan pola clickbait murahan. Gunakan bahasa redaksional yang berwibawa.');
  }

  // Extract paragraphs (ignore markdown headers)
  const paragraphs = manuscript
    .split(/\r?\n\r?\n/)
    .map(p => p.trim())
    .filter(p => p.length > 0 && !p.startsWith('#') && !p.startsWith('![') && !p.startsWith('---'));

  const firstParagraph = paragraphs[0] || '';
  const firstSentence = firstParagraph.split(/[.?!]\s+/)[0] || '';
  const lastParagraph = paragraphs[paragraphs.length - 1] || '';
  const lastSentences = lastParagraph.split(/[.?!]\s+/).filter(s => s.trim().length > 0);
  const lastSentence = lastSentences[lastSentences.length - 1] || '';

  // 4. Opening Focus Keyword (First sentence)
  const keywordInFirstSentence = keyword ? firstSentence.toLowerCase().includes(keyword) : true;
  const keywordInFirstParagraph = keyword ? firstParagraph.toLowerCase().includes(keyword) : true;
  const openingKeywordPassed = keywordInFirstSentence || keywordInFirstParagraph;
  details.push({
    rule_id: 'ECP-04-OPENING-KEYWORD',
    name: 'Focus Keyword Alami di Kalimat Pertama Pembuka',
    passed: openingKeywordPassed,
    score: keywordInFirstSentence ? 100 : (keywordInFirstParagraph ? 80 : 0),
    evidence: keywordInFirstSentence
      ? `Focus keyword "${keyword}" terdeteksi alami di kalimat pertama pembuka.`
      : (keywordInFirstParagraph
        ? `Focus keyword "${keyword}" ada di paragraf pembuka, disarankan ditarik ke kalimat pertama.`
        : `Focus keyword "${keyword}" tidak ditemukan di paragraf pembuka.`),
    suggestion: openingKeywordPassed ? undefined : `Sematkan focus keyword "${keyword}" secara mengalir di kalimat pertama pembuka.`
  });
  if (!openingKeywordPassed && keyword) {
    findings.push(`Focus keyword "${keyword}" wajib dijalin secara alami pada kalimat pertama pembuka artikel.`);
  }

  // 5. Opening Awakens Curiosity (No bureaucratic / dictionary definition throat-clearing)
  const hasBureaucraticOpening = /^(pada era modern|dalam artikel ini|menurut wikipedia|dilansir dari|perlu diketahui bahwa|sebagaimana kita ketahui)/i.test(firstParagraph);
  details.push({
    rule_id: 'ECP-05-OPENING-CURIOSITY',
    name: 'Pembuka Membangkitkan Rasa Ingin Tahu',
    passed: !hasBureaucraticOpening && firstParagraph.length >= 80,
    score: hasBureaucraticOpening ? 20 : (firstParagraph.length >= 80 ? 100 : 50),
    evidence: hasBureaucraticOpening
      ? 'Pembuka diawali klise birokratis atau pembukaan generik.'
      : 'Pembuka langsung masuk ke keresahan riil pemilik rumah.',
    suggestion: hasBureaucraticOpening ? 'Awali dengan situasi fisik nyata yang dialami pemilik rumah tanpa basa-basi pengantar.' : undefined
  });
  if (hasBureaucraticOpening) {
    findings.push('Hindari pembuka klise birokratis ("Pada era modern...", "Dalam artikel ini..."). Awali dengan keresahan nyata.');
  }

  // 6. Closing Focus Keyword (Last sentence)
  const keywordInLastSentence = keyword ? lastSentence.toLowerCase().includes(keyword) : true;
  const keywordInLastParagraph = keyword ? lastParagraph.toLowerCase().includes(keyword) : true;
  const closingKeywordPassed = keywordInLastSentence || keywordInLastParagraph;
  details.push({
    rule_id: 'ECP-06-CLOSING-KEYWORD',
    name: 'Focus Keyword Alami di Kalimat Terakhir Penutup',
    passed: closingKeywordPassed,
    score: keywordInLastSentence ? 100 : (keywordInLastParagraph ? 80 : 0),
    evidence: keywordInLastSentence
      ? `Focus keyword "${keyword}" terintegrasi alami di kalimat terakhir artikel.`
      : (keywordInLastParagraph
        ? `Focus keyword "${keyword}" ada di paragraf penutup, idealnya di kalimat akhir.`
        : `Focus keyword "${keyword}" tidak ditemukan di paragraf penutup.`),
    suggestion: closingKeywordPassed ? undefined : `Sematkan focus keyword "${keyword}" secara alami di kalimat terakhir artikel.`
  });
  if (!closingKeywordPassed && keyword) {
    findings.push(`Focus keyword "${keyword}" wajib ditenun secara wajar pada kalimat penutup artikel.`);
  }

  // 7. Body Genuinely Answers Headline Question
  const headlineWords = headline
    .toLowerCase()
    .replace(/[?:!,\(\)\-]/g, ' ')
    .split(/\s+/)
    .filter(w => w.length > 3 && !['mana', 'yang', 'lebih', 'untuk', 'pada', 'saat', 'atau', 'apakah', 'kapan', 'bagaimana', 'kenapa', 'mengapa'].includes(w));
  const manuscriptLower = manuscript.toLowerCase();
  const matchedHeadlineWords = headlineWords.filter(w => manuscriptLower.includes(w));
  const headlineCoverageRatio = headlineWords.length > 0 ? (matchedHeadlineWords.length / headlineWords.length) : 1;
  const bodyAnswersQuestion = headlineCoverageRatio >= 0.7 && paragraphs.length >= 4;
  details.push({
    rule_id: 'ECP-07-BODY-ANSWERS-QUESTION',
    name: 'Isi Menjawab Pertanyaan Berdasarkan Bukti',
    passed: bodyAnswersQuestion,
    score: bodyAnswersQuestion ? 100 : Math.round(headlineCoverageRatio * 80),
    evidence: bodyAnswersQuestion
      ? `Isi artikel secara substantif mengulas dan menjawab pertanyaan pokok headline (${Math.round(headlineCoverageRatio * 100)}% aspek inti terliput).`
      : `Isi artikel belum menjawab pertanyaan pokok headline secara tuntas (${Math.round(headlineCoverageRatio * 100)}% aspek inti terliput).`,
    suggestion: bodyAnswersQuestion ? undefined : 'Pastikan seluruh opsi atau persoalan yang diajukan pada judul dibahas tuntas di badan artikel.'
  });
  if (!bodyAnswersQuestion) {
    findings.push('Isi artikel wajib secara metodologis menjawab pertanyaan yang diajukan pada judul.');
  }

  // Compute overall score
  const totalScore = details.reduce((sum, d) => sum + d.score, 0);
  const overallScore = Math.round(totalScore / details.length);
  const allCriticalPassed = hasQuestionMark && !isClickbait && openingKeywordPassed;

  return {
    status: (allCriticalPassed && overallScore >= 70) ? 'PASS' : 'REVISION_REQUIRED',
    overall_score: overallScore,
    headline,
    focus_keyword: keyword,
    checks: {
      headline_is_question: hasInterrogativeCue,
      headline_has_question_mark: hasQuestionMark,
      opening_awakens_curiosity: !hasBureaucraticOpening && firstParagraph.length >= 80,
      opening_has_focus_keyword: openingKeywordPassed,
      closing_has_focus_keyword: closingKeywordPassed,
      closing_substantive_structure: paragraphs.length >= 4,
      body_answers_question: bodyAnswersQuestion,
      no_formulaic_clickbait: !isClickbait
    },
    details,
    actionable_findings: findings
  };
}
