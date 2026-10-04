/**
 * RancangLoka Editorial System — Visitor Problem Context & Opening Diversity
 * Milestone: EDITORIAL-VISITOR-PAIN-ANGLE-1
 *
 * Core Principle:
 * "Do not vary the sentence. Vary the human reason for seeking the answer."
 *
 * Canonical Flow:
 * SEARCH INTENT -> VISITOR PROBLEM CONTEXT -> PAIN / DECISION STATE -> OPENING ANGLE -> FRESH OPENING PROSE -> ARTICLE NARRATIVE
 */

import type { ArticleIntent } from './human-quality.ts';

// ============================================================================
// 1. CANONICAL PAIN DIMENSIONS (Taxonomy)
// ============================================================================

export type PainDimension =
  | 'PHYSICAL_DISCOMFORT'
  | 'FAILED_SOLUTION'
  | 'DECISION_UNCERTAINTY'
  | 'FINANCIAL_RISK'
  | 'PERFORMANCE_GAP'
  | 'MAINTENANCE_BURDEN'
  | 'INSTALLATION_RISK'
  | 'COMPATIBILITY_UNCERTAINTY'
  | 'SAFETY_CONCERN'
  | 'DURABILITY_CONCERN'
  | 'ENERGY_COST'
  | 'CLIMATE_FIT'
  | 'RETROFIT_DIFFICULTY'
  | 'INFORMATION_CONFLICT'
  | 'DIAGNOSTIC_UNCERTAINTY'
  | 'DESIRED_OUTCOME_GAP';

export const CANONICAL_PAIN_DIMENSIONS: Record<PainDimension, { label: string; description: string }> = {
  PHYSICAL_DISCOMFORT: {
    label: 'Ketidaknyamanan Fisik',
    description: 'Hawa ruangan panas menyengat, silau berlebih, udara pengap, kebisingan, atau kelembapan tinggi.'
  },
  FAILED_SOLUTION: {
    label: 'Solusi yang Gagal / Belum Berhasil',
    description: 'Foil sudah dipasang namun ruangan tetap gerah; waterproofing sudah dilapis namun rembesan tetap muncul.'
  },
  DECISION_UNCERTAINTY: {
    label: 'Keraguan Keputusan / Komparasi',
    description: 'Bingung memilih antara dua material atau sistem yang berbeda (foil vs ventilasi, aluminium vs uPVC).'
  },
  FINANCIAL_RISK: {
    label: 'Risiko Biaya & Pemborosan Anggaran',
    description: 'Kekhawatiran membeli material yang salah atau pembengkakan biaya renovasi yang tidak menyelesaikan masalah.'
  },
  PERFORMANCE_GAP: {
    label: 'Kesenjangan Performa Nyata vs Harapan',
    description: 'Material tidak bekerja seefektif yang dijanjikan brosur marketing atau klaim toko bangunan.'
  },
  MAINTENANCE_BURDEN: {
    label: 'Beban Perawatan & Pembersihan',
    description: 'Kekhawatiran kesulitan merawat sistem dalam jangka panjang (debu pada foil, talang mampet).'
  },
  INSTALLATION_RISK: {
    label: 'Risiko Kesalahan Pasang Lapangan',
    description: 'Kekhawatiran tukang salah pasang (misal: foil dijepit rapat tanpa air gap).'
  },
  COMPATIBILITY_UNCERTAINTY: {
    label: 'Ketidakpastian Kompatibilitas Sistem',
    description: 'Ragu apakah insulasi cocok dengan rangka baja ringan lama atau material plafon gypsum yang ada.'
  },
  SAFETY_CONCERN: {
    label: 'Kekhawatiran Keamanan & Kebakaran',
    description: 'Interaksi material insulasi dengan instalasi kabel listrik plafon atau risiko tampias air hujan.'
  },
  DURABILITY_CONCERN: {
    label: 'Daya Tahan & Umur Pakai',
    description: 'Ketahanan terhadap korosi, gigitan hama tikus/serangga, atau pelapukan termal bertahun-tahun.'
  },
  ENERGY_COST: {
    label: 'Beban Biaya Listrik & Energi',
    description: 'AC atau kipas angin bekerja terlalu keras dan memicu lonjakan tagihan listrik bulanan.'
  },
  CLIMATE_FIT: {
    label: 'Kesesuaian Iklim Tropis Ekstrem',
    description: 'Tantangan iklim tropis lembap, terik matahari siang ekstrem yang disusul malam yang pengap.'
  },
  RETROFIT_DIFFICULTY: {
    label: 'Tingkat Kesulitan Renovasi Rumah Eksisting',
    description: 'Keterbatasan ruang loteng sempit atau kesulitan membongkar atap lama yang sudah terpasang.'
  },
  INFORMATION_CONFLICT: {
    label: 'Pertentangan Informasi di Lapangan',
    description: 'Tukang A menyarankan pasang foil tebal, kontraktor B menyarankan bikin ventilasi kubah/jalusi.'
  },
  DIAGNOSTIC_UNCERTAINTY: {
    label: 'Ketidakpastian Diagnosa Sumber Panas',
    description: 'Pemilik rumah merasakan gejala panas namun belum tahu apakah panas datang dari radiasi seng atau udara loteng.'
  },
  DESIRED_OUTCOME_GAP: {
    label: 'Target Hasil yang Belum Tercapai',
    description: 'Keinginan menurunkan suhu kamar atas tanpa harus menambah unit AC baru.'
  }
};

// ============================================================================
// 2. CANONICAL OPENING ANGLES (Repertoire)
// ============================================================================

export type OpeningAngle =
  | 'SENSORY_SCENE'
  | 'DIAGNOSTIC_MYSTERY'
  | 'DECISION_FORK'
  | 'COMMON_MISTAKE'
  | 'CONTRARIAN_INSIGHT'
  | 'QUESTION_FIRST'
  | 'CONSEQUENCE_FIRST'
  | 'OBJECT_FIRST'
  | 'EXPERT_OBSERVATION'
  | 'MYTH_CORRECTION'
  | 'COST_OF_WRONG_DECISION'
  | 'BEFORE_AFTER_CONTRAST'
  | 'MICRO_SCENARIO'
  | 'SYSTEM_EXPLANATION'
  | 'TRADE_OFF_FIRST'
  | 'LOCAL_CLIMATE_CONTEXT'
  | 'MATERIAL_BEHAVIOR'
  | 'FAILURE_AFTER_SOLUTION';

// ============================================================================
// 3. SOURCE MODE & REASONING BASIS
// ============================================================================

export type SignalSourceMode =
  | 'INFERRED_EDITORIAL_CONTEXT'
  | 'OBSERVED_FIRST_PARTY_SIGNAL';

export type ReasoningBasis =
  | 'QUERY_LANGUAGE'
  | 'ARTICLE_TOPIC'
  | 'SEARCH_INTENT'
  | 'KNOWN_READER_SCENARIO'
  | 'FIRST_PARTY_SIGNAL';

// ============================================================================
// 4. VISITOR PROBLEM CONTEXT INTERFACE
// ============================================================================

export interface VisitorProblemContext {
  context_id: string;
  primary_problem: string;

  pain_dimension: PainDimension;
  secondary_pain_dimensions?: PainDimension[];

  pain_state: string;
  decision_state?: string;

  existing_condition?: string;
  failed_attempt?: string;

  timing_or_trigger?: string;
  property_context?: string;

  risk_or_concern?: string;
  desired_outcome?: string;

  knowledge_gap?: string;
  competing_options?: string[];

  confidence: 'LOW' | 'MEDIUM' | 'HIGH';

  basis: ReasoningBasis[];
  source_mode: SignalSourceMode;
}

// ============================================================================
// 5. CANDIDATE OPENING & SIGNATURE
// ============================================================================

export interface CandidateOpening {
  visitor_context_id: string;
  pain_angle: PainDimension;
  opening_angle: OpeningAngle;
  opening_signature: string;
  opening_text: string;
  why_this_angle_fits: string;
  narrative_structure: string[];
}

export interface RecentOpeningMemory {
  article_id: string;
  article_intent: ArticleIntent | string;
  visitor_pain_category: PainDimension;
  opening_angle: OpeningAngle;
  opening_signature: string;
  structure_traits: {
    question_first: boolean;
    scene_first: boolean;
    decision_first: boolean;
    material_first: boolean;
    consequence_first: boolean;
    failed_fix_first: boolean;
  };
  recorded_at: string;
}

export interface HumanVisitorPainSelectionPackage {
  status: 'HUMAN_VISITOR_PAIN_SELECTION_REQUIRED';
  topic: string;
  search_intent: ArticleIntent;
  source_mode: SignalSourceMode;
  candidate_contexts: VisitorProblemContext[];
  candidate_openings: CandidateOpening[];
  recent_opening_memory: RecentOpeningMemory[];
  selection_gate: {
    state: 'PENDING_HUMAN_SELECTION';
    requires_human_approval: true;
    allows_autonomous_article_mutation: false;
    selected_context_id: string | null;
    selected_opening_angle: OpeningAngle | null;
  };
  safety_governance: {
    automation_mode: 'OFF';
    social_automation: 'OFF';
    auto_publish: 'OFF';
    publishing_authority: 0;
    jev_mode: 'shadow';
    media_worker: 'DISABLED';
    jefry_execution_authority: 0;
  };
}

// ============================================================================
// 6. OPENING SIGNATURE DERIVATION
// ============================================================================

/**
 * Derives an approximate structural signature from an opening text.
 * Represents flow, e.g., 'SCENE > SYMPTOM > DIAGNOSIS', 'FAILED_FIX > CONTRADICTION > ROOT_CAUSE'.
 */
export function deriveOpeningSignature(openingText: string): string {
  const clean = openingText.trim();
  if (!clean) return 'EMPTY';

  const paragraphs = clean.split(/\n\s*\n/).filter((p) => p.trim().length > 0);
  const firstPara = paragraphs[0]?.trim() || '';
  const firstSentence = firstPara.split(/[.?!]\s+/)[0]?.trim() || '';

  const steps: string[] = [];

  // Step 1: Initial Hook Trait
  if (/^(?:apakah|mengapa|kapan|bagaimana|benarkah)\b/i.test(firstSentence) || firstSentence.endsWith('?')) {
    steps.push('QUESTION');
  } else if (/\b(?:sudah\s+dipasang|sudah\s+dibeli|sudah\s+beli|sudah\s+coba|pernah\s+mencoba|setelah\s+memasang)\b/i.test(firstSentence)) {
    steps.push('FAILED_FIX');
  } else if (/\b(?:bingung|memilih\s+antara|dilema|perdebatan|antara\s+.+\s+dan|saat\s+menghadapi)\b/i.test(firstSentence)) {
    steps.push('DECISION');
  } else if (/\b(?:siang\s+hari|malam\s+hari|musim\s+kemarau|terik|matahari|jam\s+\d+|pukul\s+\d+|hawa\s+panas|tepat\s+di\s+tengah|berjalan\s+dari)\b/i.test(firstSentence)) {
    steps.push('SCENE');
  } else if (/\b(?:lembaran\s+(?:seng|galvalum|spandek|metal)|seng|galvalum|spandek|zincalume|genteng)\b/i.test(firstSentence)) {
    steps.push('OBJECT');
  } else if (/\b(?:kekeliruan|kesalahan|keliru|sering\s+salah|salah\s+arah|kaprah)\b/i.test(firstSentence)) {
    steps.push('MISTAKE');
  } else if (/\b(?:menyetel\s+remote|tagihan|listrik|biaya|anggaran|kantong|juta)\b/i.test(firstSentence)) {
    steps.push('COST');
  } else {
    steps.push('CONTEXT');
  }

  // Step 2: Intermediate Tension / Elaboration
  if (/\b(?:namun|tetapi|padahal|kenyataannya|sayangnya|justru|sebaliknya)\b/i.test(clean)) {
    steps.push('CONTRADICTION');
  } else if (/\b(?:gerah|panas|membara|pengap|sulit\s+tidur|terasa)\b/i.test(clean)) {
    steps.push('SYMPTOM');
  } else if (/\b(?:kompromi|risiko|trade-off|pertimbangan|faktor)\b/i.test(clean)) {
    steps.push('TRADEOFF');
  } else {
    steps.push('ELABORATION');
  }

  // Step 3: Terminal Orientation
  if (/\b(?:jalur|perpindahan\s+panas|akar\s+masalah|penyebab|diagnosa|membedah)\b/i.test(clean)) {
    steps.push('DIAGNOSIS');
  } else if (/\b(?:solusi|langkah|sebelum|memeriksa|pilihan|jalan\s+pintas)\b/i.test(clean)) {
    steps.push('ACTION');
  } else if (clean.endsWith('?') || /\?\s*$/m.test(clean)) {
    steps.push('QUESTION');
  } else {
    steps.push('ROOT_CAUSE');
  }

  return steps.join(' > ');
}

// ============================================================================
// 7. ANTI-TEMPLATE CORPUS ANALYSIS
// ============================================================================

export interface OpeningRepetitionReport {
  has_template_dependency: boolean;
  repeated_patterns: Array<{
    pattern: string;
    occurrences: number;
    matching_indices: number[];
  }>;
  total_openings_analyzed: number;
  recommendation: string;
}

/**
 * Evaluates semantic and structural repetition across an article corpus.
 * Detects patterns like "Banyak pemilik rumah...", "X populer karena...", without
 * penalizing legitimate natural phrasing in a single standalone draft.
 */
export function detectOpeningTemplateRepetition(
  corpusOpenings: string[],
  options: { threshold?: number } = {}
): OpeningRepetitionReport {
  const threshold = options.threshold ?? 3;
  const repeatedPatterns: OpeningRepetitionReport['repeated_patterns'] = [];

  const SUSPECT_PATTERNS = [
    { name: 'BANYAK_PEMILIK_RUMAH', regex: /^\s*banyak\s+(?:pemilik\s+rumah|orang|penghuni|masyarakat)\b/i },
    { name: 'X_POPULER_NAMUN', regex: /\b(?:populer|banyak\s+dipilih|semakin\s+diminati)\b.+\b(?:namun|tetapi|sayangnya)\b/is },
    { name: 'DI_ERA_MODERN', regex: /^\s*di\s+era\s+(?:modern|sekarang|saat\s+ini)\b/i },
    { name: 'DALAM_DUNIA', regex: /^\s*dalam\s+dunia\s+(?:konstruksi|arsitektur|bangunan)\b/i }
  ];

  for (const pat of SUSPECT_PATTERNS) {
    const matchingIndices: number[] = [];
    corpusOpenings.forEach((opening, idx) => {
      if (pat.regex.test(opening)) {
        matchingIndices.push(idx);
      }
    });

    if (matchingIndices.length >= threshold) {
      repeatedPatterns.push({
        pattern: pat.name,
        occurrences: matchingIndices.length,
        matching_indices: matchingIndices
      });
    }
  }

  const hasDependency = repeatedPatterns.length > 0;
  return {
    has_template_dependency: hasDependency,
    repeated_patterns: repeatedPatterns,
    total_openings_analyzed: corpusOpenings.length,
    recommendation: hasDependency
      ? `Terdeteksi ${repeatedPatterns.length} pola template berulang pada ${repeatedPatterns.map((p) => p.pattern).join(', ')}. Variasikan sudut pandang pembuka (scene, failed fix, decision fork).`
      : 'Pola pembuka sehat dan bervariasi secara struktural lintas korpus.'
  };
}

// ============================================================================
// 8. RINA EDITORIAL ALIGNMENT CHECK
// ============================================================================

export interface OpeningAlignmentCheck {
  valid: boolean;
  issues: string[];
  quality_notes: string[];
}

/**
 * Checks observable editorial qualities of a candidate opening against RancangLoka standards:
 * - Relevance to article promise and topic
 * - Accurate representation of declared pain context
 * - Anti-emotional manipulation / anti-clickbait
 * - Anti-fabricated experience and fake quotes
 */
export function evaluateOpeningAgainstPromise(
  openingText: string,
  context: VisitorProblemContext,
  topic: string
): OpeningAlignmentCheck {
  const issues: string[] = [];
  const notes: string[] = [];

  const clean = openingText.trim();

  // 1. Check Anti-emotional manipulation / fake urgency
  const emotionalPatterns = [
    /\b(?:apakah\s+anda\s+(?:lelah|frustrasi|stress))\b/i,
    /\b(?:jangan\s+biarkan\s+(?:bahaya|kematian|kehancuran))\b/i,
    /\b(?:sangat\s+mengerikan|mimpi\s+buruk|terjebak\s+neraka)\b/i
  ];
  for (const pat of emotionalPatterns) {
    if (pat.test(clean)) {
      issues.push('EMOTIONAL_MANIPULATION_DETECTED: Menggunakan copywriting manipulasi emosi / fake urgency.');
    }
  }

  // 2. Check Anti-fabricated quotes / fake persona experience
  const fakeQuotePatterns = [
    /\b(?:kata\s+pak\s+\w+|ujar\s+ibu\s+\w+|tutur\s+\w+)\b/i,
    /\b(?:kami\s+mengunjungi\s+rumah\s+bapak|kami\s+menguji\s+di\s+laboratorium\s+kami)\b/i,
    /\b(?:seorang\s+pemilik\s+rumah\s+bernama)\b/i
  ];
  for (const pat of fakeQuotePatterns) {
    if (pat.test(clean)) {
      issues.push('FABRICATED_QUOTE_OR_EXPERIENCE: Mengarang kutipan narasumber fiktif atau kunjungan lapangan palsu.');
    }
  }

  // 3. Check Topic relevance
  const topicKeywords = topic.toLowerCase().split(/\s+/).filter((w) => w.length > 3);
  const matchedKeywords = topicKeywords.filter((kw) => clean.toLowerCase().includes(kw));
  if (matchedKeywords.length === 0) {
    issues.push('OPENING_CONTEXT_MISMATCH: Pembuka tidak memuat relevansi inti dengan topik artikel.');
  } else {
    notes.push(`Relevansi topik terverifikasi (${matchedKeywords.join(', ')}).`);
  }

  // 4. Check Pain Dimension alignment
  if (context.pain_dimension === 'FAILED_SOLUTION') {
    if (!/\b(?:sudah|pernah|setelah|memasang|lapisan|namun\s+tetap)\b/i.test(clean)) {
      issues.push('PAIN_STATE_UNREFLECTED: Pembuka FAILED_SOLUTION tidak mencerminkan solusi yang sudah dicoba namun gagal.');
    }
  } else if (context.pain_dimension === 'ENERGY_COST') {
    if (!/\b(?:listrik|daya|ac|kipas|tagihan|watt)\b/i.test(clean)) {
      issues.push('PAIN_STATE_UNREFLECTED: Pembuka ENERGY_COST tidak mencerminkan beban pendinginan/energi.');
    }
  }

  return {
    valid: issues.length === 0,
    issues,
    quality_notes: notes
  };
}

// ============================================================================
// 9. CANONICAL METAL ROOF PROBLEM CONTEXTS (10 Candidates)
// ============================================================================

export function getCanonicalMetalRoofProblemContexts(): VisitorProblemContext[] {
  return [
    {
      context_id: 'CTX-01-MIDDAY-PEAK',
      primary_problem: 'Ruangan di bawah atap metal terasa membara saat tengah hari.',
      pain_dimension: 'PHYSICAL_DISCOMFORT',
      secondary_pain_dimensions: ['PERFORMANCE_GAP'],
      pain_state: 'Hawa panas ekstrem langsung terasa di bawah seng saat terik siang.',
      decision_state: 'Mencari cara meredam radiasi langsung matahari siang.',
      existing_condition: 'Atap spandek/galvalum terpapar matahari langsung.',
      failed_attempt: 'Menyalakan kipas angin di siang hari hanya memutar udara panas.',
      timing_or_trigger: 'Pukul 11.00 - 14.00 saat matahari tepat di atas atap.',
      property_context: 'Ruang keluarga atau area mezzanine beratap metal tipis.',
      risk_or_concern: 'Ruangan tidak bisa dihuni dengan nyaman pada jam siang.',
      desired_outcome: 'Menurunkan sengatan panas seketika dari atas kepala.',
      confidence: 'HIGH',
      basis: ['ARTICLE_TOPIC', 'QUERY_LANGUAGE', 'KNOWN_READER_SCENARIO'],
      source_mode: 'INFERRED_EDITORIAL_CONTEXT'
    },
    {
      context_id: 'CTX-02-NIGHT-HEAT-TRAP',
      primary_problem: 'Kamar tidur tetap gerah hingga larut malam berjam-jam setelah matahari terbenam.',
      pain_dimension: 'CLIMATE_FIT',
      secondary_pain_dimensions: ['PHYSICAL_DISCOMFORT'],
      pain_state: 'Panas terperangkap di rongga loteng dan terus memancar ke kamar di malam hari.',
      decision_state: 'Mempertimbangkan apakah butuh ventilasi atap untuk membuang kantong panas.',
      existing_condition: 'Atap metal dengan plafon gantung tertutup tanpa ventilasi kisi.',
      failed_attempt: 'Membuka jendela kamar tidak membantu karena panas memancar dari plafon atas.',
      timing_or_trigger: 'Malam hari pukul 20.00 hingga dini hari saat mau tidur.',
      property_context: 'Kamar tidur rumah 1 lantai atau lantai atas.',
      risk_or_concern: 'Tidur tidak nyenyak dan gerah terus menerus.',
      desired_outcome: 'Rongga atap cepat dingin begitu matahari terbenam.',
      confidence: 'HIGH',
      basis: ['ARTICLE_TOPIC', 'KNOWN_READER_SCENARIO'],
      source_mode: 'INFERRED_EDITORIAL_CONTEXT'
    },
    {
      context_id: 'CTX-03-FAILED-FOIL-INSTALL',
      primary_problem: 'Sudah memasang aluminium foil di bawah atap, tetapi ruangan tetap terasa panas.',
      pain_dimension: 'FAILED_SOLUTION',
      secondary_pain_dimensions: ['INSTALLATION_RISK', 'PERFORMANCE_GAP'],
      pain_state: 'Kecewa karena renovasi pasang foil tidak memberikan hasil sejuk yang diharapkan.',
      decision_state: 'Bingung apakah harus ganti foil lebih tebal atau menambah ventilasi buang.',
      existing_condition: 'Foil terpasang terjepit rapat tanpa celah udara (air gap) atau loteng kedap.',
      failed_attempt: 'Sudah keluar biaya beli lembaran foil dan ongkos tukang pasang.',
      timing_or_trigger: 'Setelah renovasi pemasangan foil selesai namun ruangan masih gerah.',
      property_context: 'Rumah renovasi atap metal.',
      risk_or_concern: 'Mengeluarkan uang sia-sia untuk lapisan peredam kedua.',
      desired_outcome: 'Mengetahui kenapa foil yang terpasang belum bekerja dan langkah perbaikannya.',
      confidence: 'HIGH',
      basis: ['ARTICLE_TOPIC', 'KNOWN_READER_SCENARIO'],
      source_mode: 'INFERRED_EDITORIAL_CONTEXT'
    },
    {
      context_id: 'CTX-04-ENERGY-AC-BURDEN',
      primary_problem: 'AC kamar lantai atas bekerja ekstra berat dan tagihan listrik melonjak tajam.',
      pain_dimension: 'ENERGY_COST',
      secondary_pain_dimensions: ['FINANCIAL_RISK'],
      pain_state: 'Beban pendinginan tinggi karena plafon terus menghangatkan kamar dingin.',
      decision_state: 'Mencari cara menahan beban panas atap agar kompresor AC tidak menyala non-stop.',
      existing_condition: 'Kamar tidur ber-AC tepat di bawah rongga atap spandek.',
      failed_attempt: 'Menyetel suhu AC ke 16°C namun hembusan tetap kalah oleh panas dari plafon.',
      timing_or_trigger: 'Melihat lonjakan tagihan listrik bulanan di musim kemarau.',
      property_context: 'Rumah tinggal bertingkat dengan kamar utama di lantai atas.',
      risk_or_concern: 'Kerusakan unit AC dan biaya operasional bulanan yang boros.',
      desired_outcome: 'Kamar cepat dingin dan beban kompresor AC berkurang secara stabil.',
      confidence: 'HIGH',
      basis: ['ARTICLE_TOPIC', 'KNOWN_READER_SCENARIO'],
      source_mode: 'INFERRED_EDITORIAL_CONTEXT'
    },
    {
      context_id: 'CTX-05-DECISION-FOIL-VS-VENT',
      primary_problem: 'Bingung memilih antara belanja insulasi foil atau membobol sopi-sopi untuk ventilasi.',
      pain_dimension: 'DECISION_UNCERTAINTY',
      secondary_pain_dimensions: ['FINANCIAL_RISK'],
      pain_state: 'Dilema alokasi anggaran renovasi mana yang lebih mendesak dan efektif.',
      decision_state: 'Membandingkan fungsi teknis foil vs ventilasi atap untuk kasus rumahnya.',
      existing_condition: 'Atap metal polos yang baru dibangun atau sedang direncanakan renovasi.',
      failed_attempt: 'Mencari informasi di forum online tapi penjelasannya saling tumpang tindih.',
      timing_or_trigger: 'Saat menyusun anggaran belanja renovasi atap bersama tukang.',
      property_context: 'Rumah tinggal baru renovasi ganti atap baja ringan.',
      risk_or_concern: 'Membeli salah satu sistem yang ternyata tidak menyelesaikan akar masalah.',
      desired_outcome: 'Keputusan jernih mana yang wajib didahulukan atau apakah perlu kombinasi keduanya.',
      confidence: 'HIGH',
      basis: ['ARTICLE_TOPIC', 'QUERY_LANGUAGE'],
      source_mode: 'INFERRED_EDITORIAL_CONTEXT'
    },
    {
      context_id: 'CTX-06-FINANCIAL-WASTE-FEAR',
      primary_problem: 'Takut membuang jutaan rupiah untuk material peredam yang ternyata tidak berguna.',
      pain_dimension: 'FINANCIAL_RISK',
      secondary_pain_dimensions: ['DECISION_UNCERTAINTY'],
      pain_state: 'Khawatir ditipu tawaran toko material yang menjanjikan peredam mahal serba ajaib.',
      decision_state: 'Mencari panduan verifikasi independen sebelum mengeluarkan uang di toko bangunan.',
      existing_condition: 'Rencana renovasi atap metal dengan anggaran terbatas.',
      failed_attempt: 'Pernah kecewa membeli cat peredam panas yang tidak terasa efeknya.',
      timing_or_trigger: 'Menerima estimasi biaya renovasi dari tukang yang terasa mahal.',
      property_context: 'Rumah subsidi atau rumah menengah dengan plafon gantung.',
      risk_or_concern: 'Anggaran renovasi habis tetapi rumah tetap seperti oven.',
      desired_outcome: 'Belanja tepat sasaran sesuai kaidah fisik tanpa pemborosan.',
      confidence: 'HIGH',
      basis: ['ARTICLE_TOPIC', 'KNOWN_READER_SCENARIO'],
      source_mode: 'INFERRED_EDITORIAL_CONTEXT'
    },
    {
      context_id: 'CTX-07-UPPER-FLOOR-DISPARITY',
      primary_problem: 'Lantai atas terasa seperti sauna sementara lantai bawah cukup sejuk.',
      pain_dimension: 'RETROFIT_DIFFICULTY',
      secondary_pain_dimensions: ['PHYSICAL_DISCOMFORT'],
      pain_state: 'Perbedaan suhu drastis antara lantai bawah dan lantai atas rumah 2 lantai.',
      decision_state: 'Menilai apakah peredam atap bisa menyeimbangkan suhu kedua lantai.',
      existing_condition: 'Rumah tingkat dua dengan atap metal langsung di atas lantai dua.',
      failed_attempt: 'Membuka semua pintu lantai atas malah memasukkan hawa luar yang kering.',
      timing_or_trigger: 'Setiap kali menaiki tangga ke lantai atas pada siang hingga sore hari.',
      property_context: 'Rumah 2 lantai kavling sempit perkotaan.',
      risk_or_concern: 'Lantai atas menjadi area mati yang dihindari anggota keluarga.',
      desired_outcome: 'Lantai atas bisa dihuni dengan nyaman sepanjang hari.',
      confidence: 'HIGH',
      basis: ['ARTICLE_TOPIC', 'KNOWN_READER_SCENARIO'],
      source_mode: 'INFERRED_EDITORIAL_CONTEXT'
    },
    {
      context_id: 'CTX-08-EXPOSED-METAL-NO-CEILING',
      primary_problem: 'Atap metal diekspos tanpa plafon (area dapur/belakang/garasi), radiasi menyengat kepala.',
      pain_dimension: 'PERFORMANCE_GAP',
      secondary_pain_dimensions: ['PHYSICAL_DISCOMFORT'],
      pain_state: 'Radiasi inframerah langsung dari lembaran seng membakar siapapun yang berdiri di bawahnya.',
      decision_state: 'Mempertimbangkan apakah foil tanpa plafon bisa menolong tanpa harus bikin plafon penuh.',
      existing_condition: 'Atap metal kanopi, dapur belakang terbuka, atau garasi tanpa plafon.',
      failed_attempt: 'Memasang kipas angin gantung tapi anginnya terasa menyembur hawa panas.',
      timing_or_trigger: 'Saat beraktivitas memasak di dapur siang hari atau berada di garasi.',
      property_context: 'Area servis atau ruang komunal tanpa plafon gantung.',
      risk_or_concern: 'Biaya bikin plafon mahal, ingin peredaman praktis di bawah reng.',
      desired_outcome: 'Pancaran radiasi ke kepala terpotong tanpa harus menutup plafon.',
      confidence: 'HIGH',
      basis: ['ARTICLE_TOPIC', 'KNOWN_READER_SCENARIO'],
      source_mode: 'INFERRED_EDITORIAL_CONTEXT'
    },
    {
      context_id: 'CTX-09-CONTRACTOR-CONFLICT',
      primary_problem: 'Tukang dan mandor memberi saran berbeda yang saling bertentangan.',
      pain_dimension: 'INFORMATION_CONFLICT',
      secondary_pain_dimensions: ['DECISION_UNCERTAINTY'],
      pain_state: 'Bingung karena satu tukang bilang cukup foil gelembung, mandor lain bilang wajib bobok dinding gevel.',
      decision_state: 'Membutuhkan rujukan teknis netral yang tidak membela kepentingan jualan jasa.',
      existing_condition: 'Sedang dalam negosiasi pengerjaan renovasi atap.',
      failed_attempt: 'Bertanya ke tetangga tapi jawabannya tidak konsisten.',
      timing_or_trigger: 'Sebelum tanda tangan SPK renovasi atau beli material.',
      property_context: 'Pemilik rumah yang mengawasi tukang harian.',
      risk_or_concern: 'Mengikuti saran tukang yang keliru dan harus bongkar pasang ulang.',
      desired_outcome: 'Memahami prinsip fisika dasar sehingga bisa mengarahkan tukang dengan benar.',
      confidence: 'HIGH',
      basis: ['ARTICLE_TOPIC', 'KNOWN_READER_SCENARIO'],
      source_mode: 'INFERRED_EDITORIAL_CONTEXT'
    },
    {
      context_id: 'CTX-10-HEAT-SOURCE-MYSTERY',
      primary_problem: 'Tahu rumah terasa gerah, tetapi tidak tahu apakah panasnya dari seng, plafon, atau jendela.',
      pain_dimension: 'DIAGNOSTIC_UNCERTAINTY',
      secondary_pain_dimensions: ['DESIRED_OUTCOME_GAP'],
      pain_state: 'Meraba-raba mencari sumber masalah tanpa alat ukur termal profesional.',
      decision_state: 'Memerlukan langkah diagnosa mandiri sederhana sebelum memutuskan beli peredam.',
      existing_condition: 'Rumah dengan atap metal dan plafon gypsum biasa.',
      failed_attempt: 'Membeli gorden tebal tapi kamar tetap panas.',
      timing_or_trigger: 'Merasa rumah semakin tidak nyaman saat musim panas bertambah panjang.',
      property_context: 'Rumah tinggal keluarga.',
      risk_or_concern: 'Mengobati gejala yang salah sementara sumber radiasi atap dibiarkan.',
      desired_outcome: 'Bisa mendiagnosa secara mandiri jalur masuk panas terbesar di rumahnya.',
      confidence: 'HIGH',
      basis: ['ARTICLE_TOPIC', 'KNOWN_READER_SCENARIO'],
      source_mode: 'INFERRED_EDITORIAL_CONTEXT'
    }
  ];
}

// ============================================================================
// 10. CANONICAL CANDIDATE OPENINGS (10 Distinct Angles)
// ============================================================================

export function getCanonicalMetalRoofCandidateOpenings(): CandidateOpening[] {
  return [
    {
      visitor_context_id: 'CTX-01-MIDDAY-PEAK',
      pain_angle: 'PHYSICAL_DISCOMFORT',
      opening_angle: 'SENSORY_SCENE',
      opening_signature: 'SCENE > SYMPTOM > DIAGNOSIS',
      opening_text: `Tepat di tengah hari saat matahari berada di titik puncaknya, berdiri di bawah atap metal tipis memberi sensasi seperti berada di bawah pemanggang roti raksasa. Hembusan kipas angin di dalam ruangan tidak banyak menolong; angin yang berputar justru terasa seperti tiupan udara kering yang mengantarkan hawa gerah langsung ke kulit.

Bagi banyak orang, reaksi pertamanya adalah segera membentangkan lembaran aluminium foil di bawah reng atau berencana membuat kisi-kisi angin di dinding samping.

Namun sebelum memutuskan material mana yang akan dibeli, penting untuk memahami bagaimana lembaran metal tipis mengalirkan sengatan panas tersebut ke tubuh Anda.`,
      why_this_angle_fits: 'Mengangkat pengalaman fisik nyata saat puncak terik siang hari, langsung menghubungkan sensasi gerah kipas angin dengan radiasi atap.',
      narrative_structure: ['Sensory description of midday peak heat', 'Impulsive reader reaction', 'Transition to heat pathway diagnosis']
    },
    {
      visitor_context_id: 'CTX-02-NIGHT-HEAT-TRAP',
      pain_angle: 'CLIMATE_FIT',
      opening_angle: 'CONSEQUENCE_FIRST',
      opening_signature: 'SCENE > CONTRADICTION > ROOT_CAUSE',
      opening_text: `Matahari sudah lama terbenam, tetapi kamar tidur di bawah atap metal masih terasa seperti menyimpan sisa bara api siang tadi. Saat jendela dibuka lebar-lebar dengan harapan memasukkan angin malam yang sejuk, hawa gerah justru tetap terasa menekan dari arah atas kepala.

Kondisi ini biasanya bukan pertanda bahwa atap metal Anda gagal memantulkan panas di siang hari. Masalah yang lebih besar sering kali terjadi di dalam ruang gelap di atas plafon Anda: kantong udara panas yang terperangkap tanpa jalur keluar.

Ketika loteng berubah menjadi perangkap panas, plafon rumah bertindak layaknya lempeng pemanas yang terus memancarkan kalor berjam-jam setelah malam tiba.`,
      why_this_angle_fits: 'Membedah dilema panas malam hari yang sering disalahartikan sebagai kegagalan bahan atap, mengarahkan perhatian langsung ke fenomena perangkap panas loteng.',
      narrative_structure: ['Night heat symptom despite open window', 'Reframing to roof cavity heat trap', 'Ceiling as nocturnal radiator']
    },
    {
      visitor_context_id: 'CTX-03-FAILED-FOIL-INSTALL',
      pain_angle: 'FAILED_SOLUTION',
      opening_angle: 'FAILURE_AFTER_SOLUTION',
      opening_signature: 'FAILED_FIX > CONTRADICTION > ROOT_CAUSE',
      opening_text: `Gulungan aluminium foil sudah dibeli, tukang sudah dipanggil, dan lembaran peredam perak itu kini terpasang rapi di bawah atap metal Anda. Namun beberapa minggu setelah pemasangan, rasa gerah yang mengendap di kamar tidur ternyata tidak banyak berubah.

Di sinilah renovasi atap sering kali menemui jalan buntu. Banyak pemilik rumah mengira foil yang sudah menempel pasti akan otomatis mendinginkan rumah, tanpa menyadari bahwa peredam radiasi memiliki satu syarat fisik mutlak agar bisa bekerja: rongga udara bebas (air gap).

Jika lembaran foil dipasang terjepit rapat tanpa celah, atau jika panas konveksi di loteng dibiarkan terkunci tanpa ventilasi buang, investasi insulasi Anda hanya akan bekerja separuh jalan.`,
      why_this_angle_fits: 'Membuka langsung dari realitas solusi yang sudah dipasang namun gagal, memvalidasi kekecewaan pemilik rumah lalu memberikan diagnosa teknis air gap.',
      narrative_structure: ['Post-renovation disappointment', 'Core physical condition (air gap)', 'Consequence of locked cavity heat']
    },
    {
      visitor_context_id: 'CTX-04-ENERGY-AC-BURDEN',
      pain_angle: 'ENERGY_COST',
      opening_angle: 'COST_OF_WRONG_DECISION',
      opening_signature: 'COST > SYMPTOM > ACTION',
      opening_text: `Menyetel remote AC kamar tidur ke angka 18 derajat Celsius di musim kemarau sering kali hanya menghasilkan dua hal: hembusan angin dingin yang cepat buyar dan lonjakan tagihan listrik bulanan yang mengejutkan. Kompresor AC luar terus menderu tanpa jeda karena termostat di dalam kamar tak kunjung membaca suhu ideal.

Penyebab utamanya kerap bukan karena unit pendingin udara Anda kekurangan freon atau kapasitas PK-nya terlalu kecil. Masalah sesungguhnya berada beberapa sentimeter di atas kepala Anda: plafon gypsum yang terus-menerus disuplai panas oleh rongga atap metal.

Alih-alih buru-buru menambah kapasitas pendingin ruangan, menahan beban panas atap sebelum menembus plafon biasanya menjadi langkah yang jauh lebih hemat jangka panjang.`,
      why_this_angle_fits: 'Menghubungkan masalah panas atap dengan lonjakan tagihan listrik AC, memberikan sudut pandang efisiensi energi yang sangat praktis bagi pemilik rumah bertingkat.',
      narrative_structure: ['AC struggling behavior & power bill shock', 'Identifying ceiling conduction as real culprit', 'Long-term financial remedy orientation']
    },
    {
      visitor_context_id: 'CTX-05-DECISION-FOIL-VS-VENT',
      pain_angle: 'DECISION_UNCERTAINTY',
      opening_angle: 'DECISION_FORK',
      opening_signature: 'DECISION > TRADEOFF > QUESTION',
      opening_text: `Saat menghadapi atap metal yang terasa memanggang rumah, pemilik hunian umumnya dihadapkan pada dua tawaran solusi yang terdengar sama-sama meyakinkan: membeli gulungan aluminium foil untuk dipasang di bawah reng, atau melubangi dinding samping untuk membuat jalur ventilasi atap.

Masalahnya, anggaran renovasi sering kali terbatas dan kita tidak bisa sembarangan memilih keduanya sekaligus tanpa perhitungan. Memasang foil membutuhkan biaya material lembaran, sementara membuat ventilasi atap menuntut keahlian pertukangan agar tidak bocor diterpa hujan.

Pertanyaannya: apakah memasang insulasi foil saja sudah cukup untuk memutus hawa gerah, ataukah ventilasi loteng adalah pelengkap yang wajib ada sejak awal?`,
      why_this_angle_fits: 'Merangkum dilema keputusan belanja renovasi antara dua opsi fisik yang berbeda fungsi, menuntun pembaca ke pemahaman komparasi yang jernih.',
      narrative_structure: ['Direct choice between foil vs vent', 'Budget and practical trade-off constraints', 'Clarifying question framing the article']
    },
    {
      visitor_context_id: 'CTX-06-FINANCIAL-WASTE-FEAR',
      pain_angle: 'FINANCIAL_RISK',
      opening_angle: 'COMMON_MISTAKE',
      opening_signature: 'MISTAKE > COST > DIAGNOSIS',
      opening_text: `Kekeliruan paling mahal dalam meredam panas atap metal bukanlah memilih material yang berkualitas rendah, melainkan membeli material yang tepat untuk masalah yang keliru. Di toko bangunan, mudah sekali tergiur membeli insulasi peredam berlapis tebal dengan janji rumah seketika sejuk layaknya villa pegunungan.

Namun ketika material mahal itu terpasang dan suhu ruangan hanya turun sedikit, uang jutaan rupiah yang sudah keluar tidak bisa ditarik kembali. 

Agar anggaran renovasi Anda tidak terbuang sia-sia, keputusan penanganan harus dimulai dari diagnosa jalur panas: apakah Anda sedang melawan pancaran radiasi langsung, ataukah sedang menghadapi kantong udara panas yang terkunci di dalam loteng?`,
      why_this_angle_fits: 'Menyasar kekhawatiran finansial pembaca secara etis tanpa manipulasi emosi, menekankan prinsip diagnosa sebelum belanja material.',
      narrative_structure: ['Costly mistake of buying wrong remedy', 'Irreversible renovation expenditure', 'Diagnostic dichotomy of radiation vs air trap']
    },
    {
      visitor_context_id: 'CTX-07-UPPER-FLOOR-DISPARITY',
      pain_angle: 'RETROFIT_DIFFICULTY',
      opening_angle: 'BEFORE_AFTER_CONTRAST',
      opening_signature: 'SCENE > CONTRADICTION > DIAGNOSIS',
      opening_text: `Berjalan dari lantai bawah menuju lantai atas di siang hari sering kali terasa seperti berpindah ke zona iklim yang berbeda. Lantai bawah masih terasa nyaman untuk bersantai, tetapi begitu menaiki anak tangga terakhir, hawa panas seketika menyambut dan membuat kamar tidur atas jarang disentuh sebelum malam larut.

Perbedaan suhu yang mencolok ini wajar terjadi pada rumah bertingkat dengan penutup atap metal. Lembaran atap yang tipis menyerap dan menyalurkan panas matahari langsung ke rongga di atas lantai dua, sementara jarak antara atap dan plafon kamar atas relatif sangat dekat.

Menyeimbangkan kembali kenyamanan lantai atas bukan soal memperbesar hembusan angin, melainkan memotong rantai perpindahan kalor tepat di sistem atapnya.`,
      why_this_angle_fits: 'Menggambarkan disparitas suhu lantai 1 vs lantai 2 yang sangat khas pada rumah perkotaan, mengarahkan pembaca pada peredaman sistemik.',
      narrative_structure: ['Micro-scenario of climbing stairs to upper floor', 'Physical explanation of upper-floor heat exposure', 'Target of breaking thermal transfer chain']
    },
    {
      visitor_context_id: 'CTX-08-EXPOSED-METAL-NO-CEILING',
      pain_angle: 'PERFORMANCE_GAP',
      opening_angle: 'OBJECT_FIRST',
      opening_signature: 'OBJECT > SYMPTOM > ACTION',
      opening_text: `Lembaran seng atau galvalum yang dipasang tanpa plafon—seperti pada area dapur belakang, mezanin, atau garasi samping—memiliki satu perilaku fisik yang sangat agresif: permukaan bawahnya memancarkan kembali energi radiasi matahari langsung ke area kepala penghuni di bawahnya.

Pada kondisi atap terbuka tanpa plafon seperti ini, tidak ada lapisan penyangga yang menahan rambatan kalor. Berdiri beberapa menit saja saat memasak atau beraktivitas sudah cukup membuat kepala terasa pening akibat paparan inframerah langsung.

Kabar baiknya, Anda tidak selalu harus membangun rangka plafon penuh yang memakan biaya besar untuk meredam sengatan ini. Memasang penghalang radiasi yang tepat di bawah reng sering kali menjadi jalan pintas yang paling masuk akal.`,
      why_this_angle_fits: 'Fokus spesifik pada skenario atap metal telanjang tanpa plafon, langsung memberikan harapan realistis tanpa harus bikin plafon gipsum penuh.',
      narrative_structure: ['Aggressive radiant behavior of exposed metal', 'Immediate human symptom under open roof', 'Practical shortcut of radiant barrier without ceiling']
    },
    {
      visitor_context_id: 'CTX-09-CONTRACTOR-CONFLICT',
      pain_angle: 'INFORMATION_CONFLICT',
      opening_angle: 'DIAGNOSTIC_MYSTERY',
      opening_signature: 'CONTEXT > CONTRADICTION > ROOT_CAUSE',
      opening_text: `Tanyakan kepada tiga tukang bangunan yang berbeda tentang cara mengatasi atap metal yang panas, dan Anda kemungkinan besar akan memperoleh tiga jawaban yang saling bertolak belakang. Tukang pertama menyarankan memasang foil gelembung tebal, mandor kedua bersikeras harus menjebol dinding samping untuk memasang jalusi, sementara aplikator atap mengklaim cukup menambahkan insulasi serat selimut.

Perbedaan saran ini sering kali membuat pemilik rumah bingung menentukan siapa yang benar dan siapa yang sekadar menawarkan apa yang biasa mereka kerjakan.

Kenyataannya, tidak ada satu pun dari saran tersebut yang sepenuhnya salah—tetapi juga belum tentu benar untuk kondisi atap Anda. Setiap solusi menyasar jalur fisika yang berbeda, dan kekeliruan baru terjadi ketika Anda memasang obat yang tidak cocok dengan jenis penyakitnya.`,
      why_this_angle_fits: 'Memvalidasi kebingungan pemilik rumah akibat simpang-siur saran lapangan, lalu memposisikan editorial sebagai rujukan fisika netral yang objektif.',
      narrative_structure: ['Three conflicting contractor opinions', 'Reader confusion and skepticism', 'Neutral building-physics synthesis']
    },
    {
      visitor_context_id: 'CTX-10-HEAT-SOURCE-MYSTERY',
      pain_angle: 'DIAGNOSTIC_UNCERTAINTY',
      opening_angle: 'QUESTION_FIRST',
      opening_signature: 'QUESTION > SYMPTOM > DIAGNOSIS',
      opening_text: `Apakah rasa gerah yang mengendap di rumah Anda benar-benar berasal dari sengatan langsung atap metal, ataukah karena udara panas yang terjebak di dalam rongga loteng dan tidak bisa keluar?

Pertanyaan ini terdengar sepele, tetapi justru di sinilah letak batas antara renovasi yang berhasil dan renovasi yang membuang uang. Banyak pemilik rumah langsung memasang peredam tanpa tahu pasti apakah masalah utamanya ada pada pancaran radiasi lembaran seng atau pada ventilasi atap yang tersumbat.

Sebelum memutuskan belanja material atau memanggil tukang, ada beberapa langkah diagnosa fisik sederhana yang bisa Anda lakukan sendiri untuk melacak dari mana sebenarnya sumber panas terbesar di rumah Anda berasal.`,
      why_this_angle_fits: 'Menggunakan pertanyaan diagnosa terbuka di awal untuk mengajak pembaca berpikir sistemik sebelum membeli material renovasi.',
      narrative_structure: ['Diagnostic fork question opening', 'Significance of diagnosing heat mechanism', 'Promise of simple physical self-check steps']
    }
  ];
}

// ============================================================================
// 11. VISITOR PAIN SELECTION PACKAGE BUILDER
// ============================================================================

export function buildHumanVisitorPainSelectionPackage(): HumanVisitorPainSelectionPackage {
  const candidateContexts = getCanonicalMetalRoofProblemContexts();
  const candidateOpenings = getCanonicalMetalRoofCandidateOpenings();

  // Baseline memory of recent opening structure signatures to avoid repetitive rhythm
  const recentMemory: RecentOpeningMemory[] = [
    {
      article_id: 'art_past_01_genteng_beton',
      article_intent: 'COMPARISON',
      visitor_pain_category: 'DECISION_UNCERTAINTY',
      opening_angle: 'DECISION_FORK',
      opening_signature: 'DECISION > TRADEOFF > QUESTION',
      structure_traits: {
        question_first: false,
        scene_first: false,
        decision_first: true,
        material_first: false,
        consequence_first: false,
        failed_fix_first: false
      },
      recorded_at: '2026-10-01T08:00:00.000Z'
    },
    {
      article_id: 'art_past_02_dak_bocor',
      article_intent: 'PROBLEM_SOLVING',
      visitor_pain_category: 'PHYSICAL_DISCOMFORT',
      opening_angle: 'SENSORY_SCENE',
      opening_signature: 'SCENE > SYMPTOM > DIAGNOSIS',
      structure_traits: {
        question_first: false,
        scene_first: true,
        decision_first: false,
        material_first: false,
        consequence_first: false,
        failed_fix_first: false
      },
      recorded_at: '2026-10-02T10:00:00.000Z'
    },
    {
      article_id: 'art_past_03_waterproofing',
      article_intent: 'PROBLEM_SOLVING',
      visitor_pain_category: 'FAILED_SOLUTION',
      opening_angle: 'FAILURE_AFTER_SOLUTION',
      opening_signature: 'FAILED_FIX > CONTRADICTION > ROOT_CAUSE',
      structure_traits: {
        question_first: false,
        scene_first: false,
        decision_first: false,
        material_first: false,
        consequence_first: false,
        failed_fix_first: true
      },
      recorded_at: '2026-10-03T11:00:00.000Z'
    }
  ];

  return {
    status: 'HUMAN_VISITOR_PAIN_SELECTION_REQUIRED',
    topic: 'Atap Metal Terasa Panas: Apakah Insulasi Foil Cukup atau Perlu Ventilasi Atap?',
    search_intent: 'PROBLEM_SOLVING',
    source_mode: 'INFERRED_EDITORIAL_CONTEXT',
    candidate_contexts: candidateContexts,
    candidate_openings: candidateOpenings,
    recent_opening_memory: recentMemory,
    selection_gate: {
      state: 'PENDING_HUMAN_SELECTION',
      requires_human_approval: true,
      allows_autonomous_article_mutation: false,
      selected_context_id: null,
      selected_opening_angle: null
    },
    safety_governance: {
      automation_mode: 'OFF',
      social_automation: 'OFF',
      auto_publish: 'OFF',
      publishing_authority: 0,
      jev_mode: 'shadow',
      media_worker: 'DISABLED',
      jefry_execution_authority: 0
    }
  };
}
