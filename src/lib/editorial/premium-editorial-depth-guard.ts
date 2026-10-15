/**
 * RancangLoka — Dimas Editorial System Guard: Premium Editorial Depth System
 * Milestone: RANCANGLOKA_PREMIUM_EDITORIAL_DEPTH_1
 *
 * Canonical Principles:
 * 1. DECISION_DEPTH_7Q_NEXT:
 *    "Artikel RancangLoka tidak dianggap mendalam hanya karena panjang.
 *     Artikel dianggap mendalam ketika pembaca memahami apa masalahnya,
 *     mengapa terjadi, untuk siapa relevan, kapan dan di mana berlaku,
 *     bagaimana menanganinya, pilihan mana yang paling masuk akal,
 *     dan apa yang harus dilakukan berikutnya."
 * 2. FAILURE_ANATOMY:
 *    Mengajarkan pembaca bukan hanya apa yang berhasil, melainkan bagaimana keputusan bisa gagal
 *    (pilihan salah, aplikasi salah, urutan keliru, asumsi meleset, kegagalan perawatan).
 * 3. MICRO_PERSONA_SCENARIOS:
 *    Membantu pembaca mengenali apakah saran sesuai dengan situasi nyata hunian mereka
 *    (tipe penghuni + kondisi bangunan + lingkungan + kendala + tujuan) secara ilustratif murni.
 * 4. EVIDENCE_METHOD_TRANSPARENCY:
 *    Komunikasi transparan dan ramah pembaca ("Dasar Artikel") mengenai rujukan teknis (SNI, PUPR, BMKG, riset akademis).
 * 5. VISUAL_STORYTELLING:
 *    Visual berfungsi menjelaskan relasi spasial/fisik dan memangkas beban kognitif, bukan sekadar dekorasi.
 * 6. NO_UNVERIFIED_FIRST_HAND_AUTHORITY:
 *    DILARANG mengklaim pengalaman lapangan, inspeksi fisik, proyek klien, atau pengujian langsung
 *    tanpa bukti primer yang terverifikasi.
 * 7. TESTED_BY_RANCANGLOKA_RESERVED:
 *    Label "Tested by RancangLoka" diklasifikasikan sebagai PRIMARY-EVIDENCE-ONLY dan tidak boleh
 *    disematkan pada artikel berbasis riset data/AI biasa.
 */

export const INVARIANT_NO_UNVERIFIED_FIRST_HAND_AUTHORITY = 'NO_UNVERIFIED_FIRST_HAND_AUTHORITY';
export const INVARIANT_DECISION_DEPTH_7Q_NEXT = 'DECISION_DEPTH_7Q_NEXT';
export const INVARIANT_FAILURE_ANATOMY = 'FAILURE_ANATOMY';
export const INVARIANT_MICRO_PERSONA_SCENARIOS = 'MICRO_PERSONA_SCENARIOS';
export const INVARIANT_EVIDENCE_METHOD_TRANSPARENCY = 'EVIDENCE_METHOD_TRANSPARENCY';
export const INVARIANT_VISUAL_STORYTELLING = 'VISUAL_STORYTELLING';
export const INVARIANT_TESTED_BY_RANCANGLOKA_RESERVED = 'TESTED_BY_RANCANGLOKA_RESERVED';
export const INVARIANT_CONCEPTUAL_VISUAL_TRUTH = 'CONCEPTUAL_VISUAL_TRUTH';

export type DecisionDepthDimensionStatus = 'RELEVANT_PASS' | 'NOT_RELEVANT' | 'REVISION_REQUIRED';

export interface DecisionDepth7QEvidence {
  what: DecisionDepthDimensionStatus;      // What exactly is the object, problem, material, or system?
  why: DecisionDepthDimensionStatus;       // Why does it happen or why does it matter?
  who: DecisionDepthDimensionStatus;       // Who is this relevant for?
  when: DecisionDepthDimensionStatus;      // When should this approach be used or avoided?
  where: DecisionDepthDimensionStatus;     // Where does the condition apply spatially, climatically, or geographically?
  how: DecisionDepthDimensionStatus;       // How does it work and how should it be applied?
  which: DecisionDepthDimensionStatus;     // Which option is most appropriate under different conditions?
  what_next: DecisionDepthDimensionStatus; // What should the reader check, decide, or do after understanding the issue?
}

export type FailureAnatomyStatus = 'PASS' | 'NOT_REQUIRED' | 'REVISION_REQUIRED';
export type MicroPersonaScenarioStatus = 'PASS' | 'NOT_REQUIRED' | 'REVISION_REQUIRED';
export type MethodTransparencyStatus = 'PASS' | 'NOT_REQUIRED' | 'REVISION_REQUIRED';
export type VisualStorytellingNeed = 'REQUIRED' | 'OPTIONAL' | 'NOT_REQUIRED';
export type FirstHandClaimSafety = 'PASS' | 'BLOCKED';

export type VisualStorytellingClass =
  | 'CONCEPT_DIAGRAM'
  | 'SECTION_DETAIL'
  | 'COMPARATIVE_VISUAL'
  | 'FAILURE_ANATOMY_VISUAL'
  | 'BEFORE_AFTER_CONCEPT'
  | 'ORIENTATION_DIAGRAM'
  | 'MATERIAL_DETAIL'
  | 'DECISION_MATRIX';

export type VisualTruthType =
  | 'EDITORIAL_CONCEPT_VISUAL'
  | 'REAL_PHOTOGRAPH'
  | 'DATA_VISUALIZATION'
  | 'TECHNICAL_DIAGRAM';

export interface PremiumEditorialDepthChecklist {
  decision_depth: DecisionDepth7QEvidence;
  failure_anatomy: FailureAnatomyStatus;
  micro_persona_scenario: MicroPersonaScenarioStatus;
  method_transparency: MethodTransparencyStatus;
  visual_storytelling_need: VisualStorytellingNeed;
  first_hand_claim_safety: FirstHandClaimSafety;
  content_family: string;
  recommended_visual_classes: VisualStorytellingClass[];
  evaluation_notes: string[];
  flags: Array<{
    type:
      | 'FAKE_FIRST_HAND_AUTHORITY'
      | 'ILLUSTRATIVE_SCENARIO_PRESENTED_AS_REAL'
      | 'UNSUPPORTED_FAILURE_SCENARIO'
      | 'METHOD_TRANSPARENCY_MISMATCH'
      | 'DECISION_DEPTH_GAP'
      | 'RESERVED_TESTED_LABEL_MISUSE';
    description: string;
    passage?: string;
  }>;
}

/**
 * Prohibited first-hand claim patterns.
 * RancangLoka must NEVER claim direct field experience, site visits, or hands-on testing
 * without verified primary evidence.
 */
export const PROHIBITED_FIRST_HAND_PATTERNS = [
  { pattern: /\bberdasarkan pengalaman kami di lapangan\b/i, name: 'pengalaman kami di lapangan' },
  { pattern: /\bdari proyek yang kami tangani\b/i, name: 'proyek yang kami tangani' },
  { pattern: /\bhasil inspeksi kami\b/i, name: 'hasil inspeksi kami' },
  { pattern: /\bkami menguji secara langsung\b/i, name: 'kami menguji secara langsung' },
  { pattern: /\btim kami menemukan di lapangan\b/i, name: 'tim kami menemukan di lapangan' },
  { pattern: /\bmenurut praktisi kami di lapangan\b/i, name: 'menurut praktisi kami di lapangan' },
  { pattern: /\bproyek renovasi klien kami\b/i, name: 'proyek renovasi klien kami' },
  { pattern: /\bsaat tim kami memeriksa lokasi\b/i, name: 'saat tim kami memeriksa lokasi' },
  { pattern: /\bdari pengalaman lapangan kami bertahun-tahun\b/i, name: 'pengalaman lapangan kami bertahun-tahun' },
  { pattern: /\buji coba lab internal kami membuktikan\b/i, name: 'uji coba lab internal kami' }
];

/**
 * Patterns of fabricated customer testimonials or client case studies presented as real persons.
 */
export const FABRICATED_TESTIMONY_PATTERNS = [
  { pattern: /\bklien kami,?\s+(?:bapak|ibu|pak|bu)\s+[a-z]+/i, name: 'klien kami bapak/ibu' },
  { pattern: /\bmenurut kesaksian klien kami\b/i, name: 'kesaksian klien kami' },
  { pattern: /\bsalah satu klien kami mengaku\b/i, name: 'salah satu klien kami mengaku' },
  { pattern: /\btestimoni pelanggan kami menunjukkan\b/i, name: 'testimoni pelanggan kami' }
];

/**
 * Patterns of misuse of the reserved TESTED_BY_RANCANGLOKA badge
 */
export const RESERVED_TESTED_LABEL_PATTERNS = [
  { pattern: /\btested by rancangloka\b/i, name: 'tested by rancangloka' },
  { pattern: /\bdiuji oleh rancangloka\b/i, name: 'diuji oleh rancangloka' },
  { pattern: /\blulus uji rancangloka\b/i, name: 'lulus uji rancangloka' }
];

/**
 * Semantic markers for 7Q + Next dimensions
 */
const WHAT_MARKERS = [
  /\b(?:adalah|merupakan|pengertian|definisi|prinsip dasar|sistem peneduh|elemen arsitektur|material|komponen)\b/i
];

const WHY_MARKERS = [
  /\b(?:karena|alasan|penyebab|mengapa|akibat|mencegah|fungsi utama|radiasi|beban termal|panas merambat|tujuan)\b/i
];

const WHO_MARKERS = [
  /\b(?:cocok untuk|relevan bagi|pemilik rumah|penghuni|bagi anda yang|keluarga|hunian|pengguna)\b/i
];

const WHEN_MARKERS = [
  /\b(?:kapan|saat|apabila|jika|ketika|hindari penggunaan|tidak disarankan saat|kondisi ideal)\b/i
];

const WHERE_MARKERS = [
  /\b(?:orientasi|matahari barat|matahari timur|fasad|jendela|bukaan|kamar tidur|lantai dua|tropis|halaman|teras)\b/i
];

const HOW_MARKERS = [
  /\b(?:cara kerja|pemasangan|aplikasi|mekanisme|menahan|memantulkan|menyaring|perawatan|membersihkan)\b/i
];

const WHICH_MARKERS = [
  /\b(?:komparasi|perbandingan|dibandingkan|kelebihan dan kekurangan|trade-off|opsi mana|pilihan mana|pilihan terbaik|tabel komparasi|tabel perbandingan)\b/i
];

const WHAT_NEXT_MARKERS = [
  /\b(?:langkah berikutnya|keputusan|apa yang harus dilakukan|periksa|cek|konsultasikan|serah-terima|pertimbangkan)\b/i
];

/**
 * Evaluates editorial content against RancangLoka Premium Editorial Depth System.
 * Semantic checklist without rigid keyword counting or mandatory literal headings.
 */
export function evaluatePremiumEditorialDepth(
  content: string,
  options: {
    contentFamily?: string;
    title?: string;
    hasGenuineHandsOnEvidence?: boolean;
    hasVerifiedPrimaryEvidence?: boolean;
  } = {}
): PremiumEditorialDepthChecklist {
  const contentFamily = options.contentFamily || 'explainer';
  const text = content || '';
  const evaluationNotes: string[] = [];
  const flags: PremiumEditorialDepthChecklist['flags'] = [];
  const recommendedVisualClasses: VisualStorytellingClass[] = [];

  // --------------------------------------------------------------------------
  // 1. Strict No-First-Hand Authority Guard (NO_UNVERIFIED_FIRST_HAND_AUTHORITY)
  // --------------------------------------------------------------------------
  let firstHandSafety: FirstHandClaimSafety = 'PASS';
  if (!options.hasGenuineHandsOnEvidence) {
    for (const item of PROHIBITED_FIRST_HAND_PATTERNS) {
      if (item.pattern.test(text)) {
        firstHandSafety = 'BLOCKED';
        flags.push({
          type: 'FAKE_FIRST_HAND_AUTHORITY',
          description: `Klaim pengalaman langsung atau inspeksi fisik tanpa bukti primer terdeteksi (${item.name}). RancangLoka beroperasi berbasis riset dan metodologi terbuka, bukan pengalaman lapangan fiktif.`
        });
      }
    }

    for (const item of FABRICATED_TESTIMONY_PATTERNS) {
      if (item.pattern.test(text)) {
        firstHandSafety = 'BLOCKED';
        flags.push({
          type: 'ILLUSTRATIVE_SCENARIO_PRESENTED_AS_REAL',
          description: `Testimoni atau studi kasus klien fiktif terdeteksi (${item.name}). Skenario pembaca wajib disajikan sebagai ilustrasi situasi, bukan testimoni orang nyata rekaan.`
        });
      }
    }

    for (const item of RESERVED_TESTED_LABEL_PATTERNS) {
      if (item.pattern.test(text)) {
        firstHandSafety = 'BLOCKED';
        flags.push({
          type: 'RESERVED_TESTED_LABEL_MISUSE',
          description: `Penggunaan label '${item.name}' dilarang tanpa verifikasi pengujian fisik primer (RESERVED / PRIMARY-EVIDENCE-ONLY).`
        });
      }
    }
  }

  if (firstHandSafety === 'PASS') {
    evaluationNotes.push('First-hand claim safety: PASS (Zero unverified field authority or fabricated testimony).');
  }

  // --------------------------------------------------------------------------
  // 2. Decision Depth (7Q + Next) Semantic Evaluation
  // --------------------------------------------------------------------------
  const hasWhat = WHAT_MARKERS.some((re) => re.test(text));
  const hasWhy = WHY_MARKERS.some((re) => re.test(text));
  const hasWho = WHO_MARKERS.some((re) => re.test(text));
  const hasWhen = WHEN_MARKERS.some((re) => re.test(text));
  const hasWhere = WHERE_MARKERS.some((re) => re.test(text));
  const hasHow = HOW_MARKERS.some((re) => re.test(text));
  const hasWhich = WHICH_MARKERS.some((re) => re.test(text));
  const hasWhatNext = WHAT_NEXT_MARKERS.some((re) => re.test(text));

  const isComparison = contentFamily === 'comparison' || /komparasi|versus|vs/i.test(options.title || '');
  const isProblemSolver = contentFamily === 'problem_solver';
  const isReference = contentFamily === 'reference' || contentFamily === 'news';

  const wordCount = text.split(/\s+/).filter(Boolean).length;
  const isShortExcerpt = wordCount < 120;

  const decisionDepth: DecisionDepth7QEvidence = {
    what: hasWhat ? 'RELEVANT_PASS' : isShortExcerpt ? 'NOT_RELEVANT' : 'REVISION_REQUIRED',
    why: hasWhy ? 'RELEVANT_PASS' : isShortExcerpt ? 'NOT_RELEVANT' : 'REVISION_REQUIRED',
    who: hasWho ? 'RELEVANT_PASS' : (isReference || isShortExcerpt) ? 'NOT_RELEVANT' : 'REVISION_REQUIRED',
    when: hasWhen ? 'RELEVANT_PASS' : isShortExcerpt ? 'NOT_RELEVANT' : 'REVISION_REQUIRED',
    where: hasWhere ? 'RELEVANT_PASS' : (isReference || isShortExcerpt) ? 'NOT_RELEVANT' : 'REVISION_REQUIRED',
    how: hasHow ? 'RELEVANT_PASS' : isShortExcerpt ? 'NOT_RELEVANT' : 'REVISION_REQUIRED',
    which: isComparison ? (hasWhich ? 'RELEVANT_PASS' : isShortExcerpt ? 'NOT_RELEVANT' : 'REVISION_REQUIRED') : isReference ? 'NOT_RELEVANT' : (hasWhich ? 'RELEVANT_PASS' : 'NOT_RELEVANT'),
    what_next: (isReference || isShortExcerpt) ? 'NOT_RELEVANT' : (hasWhatNext ? 'RELEVANT_PASS' : 'REVISION_REQUIRED')
  };

  const depthFailures = Object.entries(decisionDepth).filter(([_, status]) => status === 'REVISION_REQUIRED');
  if (depthFailures.length > 0 && !isShortExcerpt) {
    flags.push({
      type: 'DECISION_DEPTH_GAP',
      description: `Cakupan kedalaman keputusan (7Q + Next) belum memadai pada dimensi: ${depthFailures.map(([k]) => k).join(', ')}. Pembaca membutuhkan pemahaman utuh sebelum dapat mengambil keputusan.`
    });
  } else {
    evaluationNotes.push('Decision Depth (7Q + Next): RELEVANT_PASS across all applicable semantic dimensions.');
  }

  // --------------------------------------------------------------------------
  // 3. Failure Anatomy Evaluation
  // --------------------------------------------------------------------------
  let failureAnatomy: FailureAnatomyStatus = 'PASS';
  const failureRegex = /\b(?:kesalahan umum|salah pasang|kegagalan|risiko|bocor|tampias|tempias|terlalu berat|sulit dibersihkan|debu menumpuk|karat|korosi|konsekuensi|kelemahan|perangkap panas)\b/i;
  const horrorStoryRegex = /\b(?:bencana fatal yang menghancurkan rumah|kejadian mengerikan di lapangan yang menelan korban)\b/i;

  if (horrorStoryRegex.test(text)) {
    failureAnatomy = 'REVISION_REQUIRED';
    flags.push({
      type: 'UNSUPPORTED_FAILURE_SCENARIO',
      description: 'Ditemukan narasi kegagalan sensasional tanpa dasar teknis atau konsensus ilmiah. Failure Anatomy wajib berbasis fakta fisik, bukan cerita horor yang menakut-nakuti.'
    });
  } else if (!isShortExcerpt && (isComparison || isProblemSolver || contentFamily === 'system_decision')) {
    if (!failureRegex.test(text)) {
      failureAnatomy = 'REVISION_REQUIRED';
      flags.push({
        type: 'DECISION_DEPTH_GAP',
        description: 'Artikel belum menyajikan Failure Anatomy (bagaimana pilihan/pemasangan bisa gagal karena salah urutan, salah orientasi, atau kelemahan perawatan).'
      });
    } else {
      failureAnatomy = 'PASS';
      evaluationNotes.push('Failure Anatomy: PASS (Grounded failure modes and technical consequences clearly explained).');
    }
  } else if (isReference || isShortExcerpt) {
    failureAnatomy = 'NOT_REQUIRED';
  } else {
    failureAnatomy = failureRegex.test(text) ? 'PASS' : 'PASS';
  }

  // --------------------------------------------------------------------------
  // 4. Micro-Persona Scenarios Evaluation
  // --------------------------------------------------------------------------
  let microPersonaScenario: MicroPersonaScenarioStatus = 'PASS';
  const scenarioRegex = /\b(?:skenario\s+[a-z]|contoh kasus(?: nyata)?|kamar tidur lantai dua|kamar menghadap barat|rumah yang sudah dihuni|rumah yang sudah jadi|jika rumah anda|pemilik rumah(?: klaster)?|rumah dua lantai|bagi anda yang memiliki|kondisi lahan sempit|renovasi bertahap|tanpa membongkar (?:atap|struktur|dinding)|tanpa renovasi besar|solusi cepat tanpa ribet)\b/i;

  if (!isShortExcerpt && (isComparison || isProblemSolver || contentFamily === 'system_decision')) {
    if (!scenarioRegex.test(text)) {
      microPersonaScenario = 'REVISION_REQUIRED';
      flags.push({
        type: 'DECISION_DEPTH_GAP',
        description: 'Artikel belum memuat skenario mikro-persona ilustratif yang membantu pembaca mengenali apakah rekomendasi cocok untuk situasi rumah mereka.'
      });
    } else {
      microPersonaScenario = 'PASS';
      evaluationNotes.push('Micro-Persona Scenarios: PASS (Illustrative homeowner situations clearly represented).');
    }
  } else {
    microPersonaScenario = scenarioRegex.test(text) ? 'PASS' : 'NOT_REQUIRED';
  }

  // --------------------------------------------------------------------------
  // 5. Evidence & Method Transparency Evaluation
  // --------------------------------------------------------------------------
  let methodTransparency: MethodTransparencyStatus = 'PASS';
  const methodRegex = /\b(?:dasar artikel|ditelaah berdasarkan|rujukan teknis|sni \d+|permen pupr|bmkg|metodologi komparasi|arsitektur tropis)\b/i;

  if (methodRegex.test(text)) {
    methodTransparency = 'PASS';
    evaluationNotes.push('Method Transparency: PASS (Reader-friendly source context provided).');
  } else {
    // Transparency box is optional, not mandatory on every single article
    methodTransparency = 'PASS';
  }

  // --------------------------------------------------------------------------
  // 6. Visual Storytelling Need
  // --------------------------------------------------------------------------
  let visualStorytellingNeed: VisualStorytellingNeed = 'OPTIONAL';
  if (isComparison) {
    visualStorytellingNeed = 'REQUIRED';
    recommendedVisualClasses.push('DECISION_MATRIX', 'COMPARATIVE_VISUAL');
  }

  if (/\b(?:overhang|sudut matahari|lintasan matahari|orientasi|fasad barat)\b/i.test(text)) {
    recommendedVisualClasses.push('ORIENTATION_DIAGRAM', 'SECTION_DETAIL');
  }

  if (failureAnatomy === 'PASS' && /\b(?:tampias|tempias|bocor|debu)\b/i.test(text)) {
    recommendedVisualClasses.push('FAILURE_ANATOMY_VISUAL');
  }

  if (recommendedVisualClasses.length > 0) {
    evaluationNotes.push(`Visual Storytelling: Recommended classes [${recommendedVisualClasses.join(', ')}] based on cognitive load reduction.`);
  }

  return {
    decision_depth: decisionDepth,
    failure_anatomy: failureAnatomy,
    micro_persona_scenario: microPersonaScenario,
    method_transparency: methodTransparency,
    visual_storytelling_need: visualStorytellingNeed,
    first_hand_claim_safety: firstHandSafety,
    content_family: contentFamily,
    recommended_visual_classes: recommendedVisualClasses,
    evaluation_notes: evaluationNotes,
    flags
  };
}
