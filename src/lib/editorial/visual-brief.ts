/**
 * RancangLoka — Visual Brief Contract & Budi Visual Storytelling Engine
 * Milestone: RANCANGLOKA_PREMIUM_EDITORIAL_DEPTH_1 (Staff Orchestration Completion)
 *
 * Canonical Invariants:
 * 1. BUDI_VISUAL_STORYTELLING_OWNER:
 *    Budi (lokamedia_worker_primary / Media Operations) owns execution of editorial visual briefs
 *    when visual_storytelling_need = REQUIRED or when explicitly requested by editorial staff / Chief Editor.
 * 2. NO_FACTUAL_AUTONOMY:
 *    Budi does NOT decide factual truth independently. Input must come from:
 *    - Irwan evidence
 *    - Joko narrative context
 *    - Dimas semantic visual need
 *    - Nadia/Rina editorial constraints
 * 3. CONCEPTUAL_VISUAL_TRUTH:
 *    AI-generated visuals must NEVER be labeled or implied as:
 *    - REAL_PHOTOGRAPH
 *    - REAL_PROJECT
 *    - FIELD_INSPECTION
 *    - MEASURED_SIMULATION
 *    - ENGINEERING_TEST_RESULT
 *    unless actual provenance exists. For AI explanatory visuals, EDITORIAL_CONCEPT_VISUAL is mandatory.
 * 4. ZERO_DECORATION_QUOTAS:
 *    No rule that "every article needs N images". Visual production occurs only when it materially
 *    improves understanding, spatial reasoning, comparison, failure explanation, or decision-making.
 * 5. EDITORIAL_REVIEW_LOOP:
 *    Canonical flow: Dimas detects visual need -> Budi prepares visual / visual brief
 *    -> Nadia checks reader comprehensibility -> Rina checks factual / representational truth
 *    -> Human Approval where required -> publication workflow (Sari).
 *    Budi must NOT bypass editorial approval.
 * 6. ZERO_PUBLISHING_AUTHORITY:
 *    Budi has publishing authority = 0. Budi cannot publish, cannot override Nadia, and cannot override Rina.
 */

import {
  type VisualStorytellingClass,
  type VisualTruthType,
  type PremiumEditorialDepthChecklist,
  INVARIANT_CONCEPTUAL_VISUAL_TRUTH
} from './premium-editorial-depth-guard.ts';

export const INVARIANT_BUDI_VISUAL_STORYTELLING_OWNER = 'BUDI_VISUAL_STORYTELLING_OWNER';
export const INVARIANT_ZERO_DECORATION_QUOTAS = 'ZERO_DECORATION_QUOTAS';
export const INVARIANT_VISUAL_EDITORIAL_REVIEW_LOOP = 'VISUAL_EDITORIAL_REVIEW_LOOP';
export const BUDI_PUBLISHING_AUTHORITY = 0;

export const PROHIBITED_AI_PROVENANCE_LABELS = [
  'REAL_PHOTOGRAPH',
  'REAL_PROJECT',
  'FIELD_INSPECTION',
  'MEASURED_SIMULATION',
  'ENGINEERING_TEST_RESULT'
] as const;

export type ProhibitedAiProvenanceLabel = (typeof PROHIBITED_AI_PROVENANCE_LABELS)[number];

export const ALLOWED_AI_EXPLANATORY_LABEL: VisualTruthType = 'EDITORIAL_CONCEPT_VISUAL';

export interface VisualBrief {
  brief_id: string;
  article_slug: string;
  content_section: string;
  reader_problem: string;
  visual_goal: string;
  visual_class: VisualStorytellingClass;
  technical_truth_to_preserve: string;
  misrepresentation_risks: string[];
  source_references: string[];
  evidence_references?: string[];
  caption_intent: string;
  alt_text_intent: string;
  assigned_operator: 'lokamedia_worker_primary';
  visual_truth_label: VisualTruthType;
  requires_editorial_qa: boolean;
  requires_human_approval: boolean;
  created_at: string;
}

export interface VisualTruthValidationResult {
  valid: boolean;
  assigned_label: VisualTruthType | string;
  error?: string;
  provenance_note?: string;
}

/**
 * Validates visual truth classification for media assets.
 * Preserves CONCEPTUAL_VISUAL_TRUTH.
 */
export function validateVisualTruthClassification(params: {
  label: string;
  isAiGenerated: boolean;
  hasPhysicalProvenance?: boolean;
}): VisualTruthValidationResult {
  const { label, isAiGenerated, hasPhysicalProvenance } = params;

  if (isAiGenerated && !hasPhysicalProvenance) {
    const isProhibited = PROHIBITED_AI_PROVENANCE_LABELS.some(
      (prohibited) => prohibited.toUpperCase() === label.toUpperCase()
    );

    if (isProhibited) {
      return {
        valid: false,
        assigned_label: ALLOWED_AI_EXPLANATORY_LABEL,
        error: `Visual AI explanatory tidak boleh dilabeli sebagai '${label}'. Label terlarang: ${PROHIBITED_AI_PROVENANCE_LABELS.join(', ')}. Gunakan '${ALLOWED_AI_EXPLANATORY_LABEL}' untuk menjaga CONCEPTUAL_VISUAL_TRUTH.`
      };
    }
  }

  // If label matches valid known types
  if (label === 'EDITORIAL_CONCEPT_VISUAL' || label === 'DATA_VISUALIZATION' || label === 'TECHNICAL_DIAGRAM') {
    return {
      valid: true,
      assigned_label: label,
      provenance_note: 'Verified conceptual visual label.'
    };
  }

  if (label === 'REAL_PHOTOGRAPH') {
    if (!hasPhysicalProvenance) {
      return {
        valid: false,
        assigned_label: ALLOWED_AI_EXPLANATORY_LABEL,
        error: 'Label REAL_PHOTOGRAPH dilarang tanpa bukti fisik riil yang terverifikasi.'
      };
    }
    return {
      valid: true,
      assigned_label: 'REAL_PHOTOGRAPH',
      provenance_note: 'Verified real photograph with physical provenance.'
    };
  }

  return {
    valid: true,
    assigned_label: label
  };
}

/**
 * Generates structured visual briefs when Dimas emits visual_storytelling_need = REQUIRED
 * or when explicitly requested by editorial staff / Chief Editor.
 *
 * Enforces:
 * - REQUIRED: Produces Budi-addressable visual brief(s).
 * - OPTIONAL: Does NOT force media production (returns empty array unless isExplicitlyRequested).
 * - NOT_REQUIRED: Produces empty array (zero visual task).
 * - Zero arbitrary image quotas.
 */
export function generateEditorialVisualBriefs(params: {
  article_slug: string;
  content: string;
  title?: string;
  checklist?: PremiumEditorialDepthChecklist;
  evidenceReferences?: string[];
  isExplicitlyRequested?: boolean;
}): VisualBrief[] {
  const {
    article_slug,
    content,
    title = '',
    checklist,
    evidenceReferences = [],
    isExplicitlyRequested = false
  } = params;

  const visualNeed = checklist?.visual_storytelling_need || 'OPTIONAL';

  // Invariant: OPTIONAL or NOT_REQUIRED does not force media creation unless explicitly requested
  if (visualNeed === 'NOT_REQUIRED' && !isExplicitlyRequested) {
    return [];
  }

  if (visualNeed === 'OPTIONAL' && !isExplicitlyRequested) {
    return [];
  }

  const briefs: VisualBrief[] = [];
  const recommendedClasses = checklist?.recommended_visual_classes || [];
  const text = content || '';
  const now = new Date().toISOString();

  // Reference sources (combine evidence references and standard standards if mentioned)
  const defaultSources: string[] = [...evidenceReferences];
  if (/\bsni\b/i.test(text) && !defaultSources.some((s) => /sni/i.test(s))) {
    defaultSources.push('SNI 6389:2020 (Konservasi Energi Selubung Bangunan)');
  }
  if (/\bpupr\b/i.test(text) && !defaultSources.some((s) => /pupr/i.test(s))) {
    defaultSources.push('Peraturan Menteri PUPR No. 02/PRT/M/2015');
  }

  // 1. Decision Matrix / Comparative Visual
  if (
    recommendedClasses.includes('DECISION_MATRIX') ||
    recommendedClasses.includes('COMPARATIVE_VISUAL') ||
    /komparasi|perbandingan|versus|vs/i.test(title)
  ) {
    briefs.push({
      brief_id: `vb-${article_slug}-decision-matrix-01`,
      article_slug,
      content_section: 'Tabel Komparasi & Pertimbangan Trade-Off',
      reader_problem: 'Pembaca kesulitan membandingkan kelebihan, kelemahan, dan kebutuhan perawatan dari beberapa alternatif sistem secara simultan.',
      visual_goal: 'Menyajikan matriks perbandingan responsif yang merangkum parameter teknis utama (daya tahan cuaca, kemudahan perawatan, fleksibilitas) guna mengurangi beban kognitif membaca teks panjang.',
      visual_class: 'DECISION_MATRIX',
      technical_truth_to_preserve: 'Setiap sistem memiliki trade-off yang seimbang; tidak ada sistem yang unggul mutlak tanpa kelemahan perawatan atau keterbatasan orientasi hadap.',
      misrepresentation_risks: [
        'Dilarang memberi rating subjektif tanpa parameter jelas',
        'Dilarang menampilkan visual produk komersial tertentu seolah didukung oleh RancangLoka'
      ],
      source_references: defaultSources.length > 0 ? defaultSources : ['Standar Teknis Arsitektur Tropis & Riset Redaksional'],
      evidence_references: defaultSources,
      caption_intent: 'Matriks komparasi ringkas parameter teknis dan trade-off operasional untuk hunian tropis.',
      alt_text_intent: 'Tabel komparasi karakteristik teknis, durabilitas, dan perawatan sistem bangunan tropis.',
      assigned_operator: 'lokamedia_worker_primary',
      visual_truth_label: 'EDITORIAL_CONCEPT_VISUAL',
      requires_editorial_qa: true,
      requires_human_approval: true,
      created_at: now
    });
  }

  // 2. Orientation Diagram / Section Detail
  if (
    recommendedClasses.includes('ORIENTATION_DIAGRAM') ||
    recommendedClasses.includes('SECTION_DETAIL') ||
    /\b(?:sudut matahari|lintasan matahari|orientasi|fasad barat)\b/i.test(text)
  ) {
    briefs.push({
      brief_id: `vb-${article_slug}-orientation-diagram-02`,
      article_slug,
      content_section: 'Orientasi Fasad & Sudut Datang Sinar Matahari',
      reader_problem: 'Pemilik rumah sulit membayangkan perbedaan sudut jatuh sinar matahari vertikal (Utara-Selatan) dan sudut rendah matahari sore (Barat).',
      visual_goal: 'Menggambarkan geometri lintasan matahari tropis terhadap bukaan vertikal untuk membuktikan mengapa naungan horizontal gagal menahan panas sore.',
      visual_class: 'ORIENTATION_DIAGRAM',
      technical_truth_to_preserve: 'Sudut datang matahari sore di wilayah khatulistiwa miring tajam (20-40 derajat), menembus di bawah overhang horizontal biasa.',
      misrepresentation_risks: [
        'Dilarang menyajikan diagram sebagai simulasi CFD atau hasil ukur sensor lab jika hanya merupakan diagram prinsip geometris'
      ],
      source_references: defaultSources.length > 0 ? defaultSources : ['Data Klimatologi Tropis & Geometri Matahari BMKG'],
      evidence_references: defaultSources,
      caption_intent: 'Diagram prinsip geometri sudut jatuh sinar matahari khatulistiwa pada fasad barat.',
      alt_text_intent: 'Ilustrasi konseptual sudut datang sinar matahari sore yang menembus di bawah naungan atap datar.',
      assigned_operator: 'lokamedia_worker_primary',
      visual_truth_label: 'EDITORIAL_CONCEPT_VISUAL',
      requires_editorial_qa: true,
      requires_human_approval: true,
      created_at: now
    });
  }

  // 3. Failure Anatomy Visual
  if (
    recommendedClasses.includes('FAILURE_ANATOMY_VISUAL') ||
    /\b(?:tampias|tempias|bocor|debu menumpuk|karat|korosi)\b/i.test(text)
  ) {
    briefs.push({
      brief_id: `vb-${article_slug}-failure-anatomy-03`,
      article_slug,
      content_section: 'Anatomi Titik Rawan & Kegagalan Lapangan',
      reader_problem: 'Pembaca tidak menyadari bagaimana detail sambungan atau ketiadaan perawatan dapat merusak elemen pelindung dalam kurun 1-2 musim hujan.',
      visual_goal: 'Menunjukkan titik akumulasi air tempias, titik penumpukan debu, atau risiko korosi engsel pada iklim tropis lembap.',
      visual_class: 'FAILURE_ANATOMY_VISUAL',
      technical_truth_to_preserve: 'Kegagalan terjadi karena kelembapan persisten dan kelemahan material spesifik, bukan karena bencana tak terduga.',
      misrepresentation_risks: [
        'Dilarang menggambarkan kerusakan sensasional yang menakut-nakuti pembaca',
        'Dilarang menampilkan foto rumah orang lain tanpa izin dan menyebutnya sebagai kegagalan fatal'
      ],
      source_references: defaultSources.length > 0 ? defaultSources : ['Konsensus Fisika Bangunan Tropis & Dokumentasi Redaksi'],
      evidence_references: defaultSources,
      caption_intent: 'Diagram anatomi titik akumulasi debu dan titik rawan tempias pada sambungan bilah peneduh.',
      alt_text_intent: 'Diagram konsep visual titik rawan rembesan air dan debu pada sambungan rangka louver.',
      assigned_operator: 'lokamedia_worker_primary',
      visual_truth_label: 'EDITORIAL_CONCEPT_VISUAL',
      requires_editorial_qa: true,
      requires_human_approval: true,
      created_at: now
    });
  }

  return briefs;
}

/**
 * Editorial Visual Review Flow Gate
 *
 * Verifies that visual assets follow the canonical review loop:
 * Dimas (need detected) -> Budi (brief/visual prep) -> Nadia (comprehensibility)
 * -> Rina (truth verification) -> Human Approval -> Sari (publication workflow).
 *
 * Invariants:
 * - Budi publishing authority = 0.
 * - Budi cannot publish directly.
 * - Budi cannot override Nadia or Rina.
 * - Budi cannot bypass editorial approval.
 */
export function validateEditorialVisualReviewFlow(step: {
  from_stage: 'DIMAS_NEED' | 'BUDI_PREP' | 'NADIA_REVIEW' | 'RINA_REVIEW' | 'HUMAN_APPROVAL';
  to_stage: 'BUDI_PREP' | 'NADIA_REVIEW' | 'RINA_REVIEW' | 'HUMAN_APPROVAL' | 'PUBLICATION_DISPATCH';
  acting_agent_id: string;
  has_nadia_approval?: boolean;
  has_rina_approval?: boolean;
  has_human_approval?: boolean;
}): { allowed: boolean; reason?: string } {
  const {
    from_stage,
    to_stage,
    acting_agent_id,
    has_nadia_approval = false,
    has_rina_approval = false,
    has_human_approval = false
  } = step;

  // Invariant 1: Budi cannot publish (publishingAuthority = 0)
  if (acting_agent_id === 'lokamedia_worker_primary' && to_stage === 'PUBLICATION_DISPATCH') {
    return {
      allowed: false,
      reason: 'Budi (lokamedia_worker_primary) memiliki otoritas publikasi = 0. Dilarang menerbitkan media langsung ke publikasi.'
    };
  }

  // Invariant 2: Direct leap from BUDI_PREP to PUBLICATION_DISPATCH without editorial review
  if (from_stage === 'BUDI_PREP' && to_stage === 'PUBLICATION_DISPATCH') {
    return {
      allowed: false,
      reason: 'Bypass editorial terdeteksi: visual dari Budi dilarang langsung meloncat ke publikasi tanpa melewati Nadia, Rina, dan Human Approval.'
    };
  }

  // Invariant 3: Nadia comprehensibility check cannot be overridden
  if (to_stage === 'RINA_REVIEW' && !has_nadia_approval) {
    return {
      allowed: false,
      reason: 'Visual brief belum disetujui oleh Nadia (Audience & Language Editor) untuk kelayakan keterbacaan pembaca.'
    };
  }

  // Invariant 4: Rina factual/representational truth cannot be overridden
  if (to_stage === 'HUMAN_APPROVAL' && !has_rina_approval) {
    return {
      allowed: false,
      reason: 'Visual belum diverifikasi oleh Rina (Editorial QA) untuk kebenaran representasi dan CONCEPTUAL_VISUAL_TRUTH.'
    };
  }

  // Invariant 5: Human approval is mandatory before publication dispatch
  if (to_stage === 'PUBLICATION_DISPATCH' && !has_human_approval) {
    return {
      allowed: false,
      reason: 'Visual memerlukan persetujuan manual manusia (Chief Editor Human Approval) sebelum dispatch publikasi.'
    };
  }

  // Allowed valid transitions
  if (
    (from_stage === 'DIMAS_NEED' && to_stage === 'BUDI_PREP') ||
    (from_stage === 'BUDI_PREP' && to_stage === 'NADIA_REVIEW') ||
    (from_stage === 'NADIA_REVIEW' && to_stage === 'RINA_REVIEW' && has_nadia_approval) ||
    (from_stage === 'RINA_REVIEW' && to_stage === 'HUMAN_APPROVAL' && has_rina_approval) ||
    (from_stage === 'HUMAN_APPROVAL' && to_stage === 'PUBLICATION_DISPATCH' && has_human_approval)
  ) {
    return { allowed: true };
  }

  return {
    allowed: false,
    reason: `Transisi alur kerja tidak valid: dari ${from_stage} ke ${to_stage} oleh ${acting_agent_id}.`
  };
}

/**
 * Returns Budi's publishing authority (strictly 0).
 */
export function getBudiPublishingAuthority(): number {
  return BUDI_PUBLISHING_AUTHORITY;
}

/**
 * Checks if Budi can publish directly. Strictly false.
 */
export function canBudiPublish(): boolean {
  return false;
}

/**
 * Checks if Budi can override Nadia or Rina. Strictly false.
 */
export function canBudiOverrideReviewers(): boolean {
  return false;
}
