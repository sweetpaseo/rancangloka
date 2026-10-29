/**
 * RancangLoka — Article-Aware Editorial Visual Segmentation Engine (EVIS-1B)
 *
 * Architecture & Non-Negotiable Editorial Invariants:
 * 1. ZERO_DECORATION_QUOTAS:
 *    Image counts arise strictly from demonstrated reader cognitive need.
 *    No arbitrary rule that "every article needs N images" or "every heading needs an image".
 * 2. EDITORIAL_MEANING_DETERMINES_COMPOSITION:
 *    Images exist to explain physical morphology, spatial assemblies, failure mechanisms,
 *    or technical trade-offs that prose alone cannot convey efficiently.
 * 3. PROVISIONAL_SEO_SEPARATION:
 *    Provisional alt text generated during segmentation is NEVER marked as image-verified.
 *    Final alt text requires human review of the actual generated asset.
 * 4. CRYPTOGRAPHIC_INTEGRITY:
 *    Placement manifests are bound to the exact SHA-256 content_hash of the manuscript.
 * 5. ANTI_REPETITION_GUARD:
 *    Cross-article comparisons reject superficial variations (e.g. merely changing lighting
 *    or wall colors for the same technical concept).
 */

import { computeContentHash, type VisualPlacementManifest, type VisualManifestItem } from '../media/anchor-resolver.ts';
import {
  type VisualIdentityProfile,
  type AntiRepetitionDimensions,
  type SimilarityCheckResult,
  evaluateAntiRepetitionSignals,
  validateVisualIdentityProfile
} from './visual-intelligence.ts';

export type VisualNecessityLevel = 'ESSENTIAL' | 'RECOMMENDED' | 'OPTIONAL' | 'NOT_NEEDED';

export type SemanticExplanationDensity =
  | 'SUFFICIENT_TEXT_ONLY'
  | 'HAS_COMPREHENSIVE_TABLE'
  | 'EXPLANATION_GAP_NEEDS_VISUAL';

export interface ArticleSemanticSegment {
  segment_id: string;
  heading_text: string;
  heading_level: number;
  heading_id: string;
  paragraphs: string[];
  tables: string[];
  has_table: boolean;

  // Editorial Semantic Analysis
  topic_transition: string;
  reader_question: string;
  technical_concepts: string[];
  spatial_material_relations: string[];
  explanation_density: SemanticExplanationDensity;
  visual_necessity: VisualNecessityLevel;
  necessity_rationale: string;

  // Visual Planning (Populated if ESSENTIAL or RECOMMENDED)
  recommended_slot_key?: string;
  recommended_media_type?: 'photograph' | 'technical_diagram' | 'comparison' | 'detail_close_up' | 'annotated_illustration';
  visual_purpose?: string;
  required_visual_evidence?: string[];
  accuracy_risks?: string[];
  target_anchor_phrase?: string;
}

export interface ArticleSemanticSegmentationResult {
  article_id: number;
  article_slug: string;
  article_title: string;
  content_hash: string;
  total_headings: number;
  total_segments: number;
  segments: ArticleSemanticSegment[];

  // Dynamic Image Quota Breakdown
  counts: {
    essential: number;
    recommended: number;
    optional: number;
    not_needed: number;
    total_proposed: number;
  };

  editorial_summary: string;
}

export interface ContextualImageSeoDraft {
  slot_key: string;
  provisional_alt_text: string;
  caption: string;
  recommended_filename: string;
  target_anchor_heading: string;
  target_paragraph_phrase?: string;
  is_image_verified: false; // Invariant: Provisional alt text must not be marked as verified
  verification_requirement: string;
}

export interface CrossArticleAntiRepetitionComparison {
  article_a_id: number;
  article_a_slug: string;
  article_b_id: number;
  article_b_slug: string;
  slot_a_key: string;
  slot_b_key: string;
  evaluation: SimilarityCheckResult;
  verdict: 'DISTINCT_EDITORIAL_PURPOSE' | 'REPETITION_WARNING' | 'SUPERFICIAL_VARIATION_REJECTED';
  rationale: string;
}

/**
 * Normalizes heading text for matching and id derivation.
 */
function slugifyHeading(text: string): string {
  return text
    .toLowerCase()
    .replace(/<[^>]+>/g, '')
    .replace(/[^a-z0-9\s-]/g, '')
    .trim()
    .replace(/\s+/g, '-');
}

/**
 * Parses article markdown into raw section blocks based on headings (#, ##, ###).
 */
export function parseMarkdownSections(markdown: string): Array<{
  heading_text: string;
  heading_level: number;
  heading_id: string;
  paragraphs: string[];
  tables: string[];
}> {
  if (!markdown || typeof markdown !== 'string') return [];

  const lines = markdown.split(/\r?\n/);
  const sections: Array<{
    heading_text: string;
    heading_level: number;
    heading_id: string;
    paragraphs: string[];
    tables: string[];
  }> = [];

  let currentHeading = 'Pendahuluan (Opening)';
  let currentLevel = 1;
  let currentParagraphs: string[] = [];
  let currentTables: string[] = [];
  let inTable = false;
  let tableAccumulator: string[] = [];
  let paragraphAccumulator: string[] = [];

  function flushParagraph() {
    if (paragraphAccumulator.length > 0) {
      const p = paragraphAccumulator.join(' ').trim();
      if (p.length > 0) currentParagraphs.push(p);
      paragraphAccumulator = [];
    }
  }

  function flushTable() {
    if (tableAccumulator.length > 0) {
      currentTables.push(tableAccumulator.join('\n'));
      tableAccumulator = [];
    }
    inTable = false;
  }

  function flushSection() {
    flushParagraph();
    flushTable();
    sections.push({
      heading_text: currentHeading,
      heading_level: currentLevel,
      heading_id: slugifyHeading(currentHeading),
      paragraphs: [...currentParagraphs],
      tables: [...currentTables]
    });
    currentParagraphs = [];
    currentTables = [];
  }

  for (const line of lines) {
    const trimmed = line.trim();

    // Check heading
    const headingMatch = /^(#{1,3})\s+(.*)$/.exec(trimmed);
    if (headingMatch) {
      flushSection();
      currentLevel = headingMatch[1].length;
      currentHeading = headingMatch[2].trim();
      continue;
    }

    // Check table
    if (trimmed.startsWith('|')) {
      flushParagraph();
      inTable = true;
      tableAccumulator.push(trimmed);
      continue;
    } else if (inTable) {
      flushTable();
    }

    // Normal text
    if (trimmed.length > 0) {
      paragraphAccumulator.push(trimmed);
    } else {
      flushParagraph();
    }
  }

  flushSection();
  return sections;
}

/**
 * Extracts a clean, distinctive prose snippet from a raw markdown paragraph
 * stripped of markdown formatting so that it cleanly matches HTML paragraph text.
 */
export function extractCleanAnchorPhrase(raw: string): string {
  if (!raw) return '';
  const cleaned = raw
    .replace(/[*_`#]/g, '')
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
    .replace(/&[a-z]+;/gi, ' ')
    .trim();
  const firstSentence = cleaned.split(/[:.!?]/)[0]?.trim() || cleaned;
  const candidate = firstSentence.length >= 20 ? firstSentence : cleaned;
  return candidate.slice(0, 45).trim();
}

/**
 * Analyzes semantic segments of an article and determines visual necessity.
 * Enforces dynamic image counts based on demonstrated reader needs rather than word counts.
 */
export function analyzeArticleSemanticSegments(params: {
  id: number;
  slug: string;
  title: string;
  content_md: string;
}): ArticleSemanticSegmentationResult {
  const { id, slug, title, content_md } = params;
  const content_hash = computeContentHash(content_md);
  const rawSections = parseMarkdownSections(content_md);

  const segments: ArticleSemanticSegment[] = [];
  const assignedSlotKeys = new Set<string>();

  for (let idx = 0; idx < rawSections.length; idx++) {
    const sec = rawSections[idx];
    const segmentId = `seg-${id}-${idx + 1}`;
    const hTextLower = sec.heading_text.toLowerCase();
    const fullText = sec.paragraphs.join(' ');
    const hasTable = sec.tables.length > 0;

    let topic_transition = '';
    let reader_question = '';
    const technical_concepts: string[] = [];
    const spatial_material_relations: string[] = [];
    let explanation_density: SemanticExplanationDensity = 'SUFFICIENT_TEXT_ONLY';
    let visual_necessity: VisualNecessityLevel = 'NOT_NEEDED';
    let necessity_rationale = '';

    let recommended_slot_key: string | undefined;
    let recommended_media_type: ArticleSemanticSegment['recommended_media_type'];
    let visual_purpose: string | undefined;
    let required_visual_evidence: string[] | undefined;
    let accuracy_risks: string[] | undefined;
    let target_anchor_phrase: string | undefined;

    // Domain Pattern Matching for Construction / Architectural Content:

    // 1. Opening / Problem Framing / Meta Sections / H1 Title -> NOT_NEEDED
    if (
      idx === 0 ||
      sec.heading_level <= 1 ||
      hTextLower.includes('pendahuluan') ||
      hTextLower.includes('rujukan') ||
      hTextLower.includes('catatan akhir') ||
      hTextLower.includes('daftar periksa') ||
      hTextLower.includes('pertanyaan praktis')
    ) {
      topic_transition = 'Pengantar masalah, verifikasi pertanyaan pembaca, atau rujukan administratif.';
      reader_question = 'Apa inti masalah yang akan dibahas dan apa kerangka rujukannya?';
      visual_necessity = 'NOT_NEEDED';
      explanation_density = 'SUFFICIENT_TEXT_ONLY';
      necessity_rationale = 'Bagian framing, checklist keputusan, atau sitasi akademis/standar. Gambar di sini bersifat dekoratif dan membuang perhatian pembaca.';
    }

    // 2. Sections equipped with structured Markdown tables -> NOT_NEEDED
    else if (hasTable || hTextLower.includes('matriks') || hTextLower.includes('tabel')) {
      topic_transition = 'Rekapitulasi data komparasi dalam format matriks terstruktur.';
      reader_question = 'Bagaimana perbandingan angka dan spesifikasi teknis kedua opsi?';
      visual_necessity = 'NOT_NEEDED';
      explanation_density = 'HAS_COMPREHENSIVE_TABLE';
      necessity_rationale = 'Bagian ini telah memiliki tabel matriks terperinci. Menambahkan gambar grafik tabel redundan dengan data teks.';
    }

    // 3. Physical Morphology / Material Assembly / Cross-Section Comparison -> ESSENTIAL
    else if (
      (hTextLower.includes('perbedaan mendasar') && (hTextLower.includes('material') || hTextLower.includes('bentuk'))) ||
      hTextLower.includes('sambungan jendela-dinding') ||
      hTextLower.includes('lokasi embun') ||
      hTextLower.includes('tiga arah')
    ) {
      topic_transition = 'Analisis morfologi fisik, detail penampang sambungan, atau lokasi fisik fenomena.';
      reader_question = 'Secara fisik nyata, bagaimana bentuk detail sambungan dan perbedaan material saat terpasang?';
      technical_concepts.push('Morfologi profil', 'Sambungan mekanis', 'Batas material');
      spatial_material_relations.push('Penampang potongan melintang', 'Perbatasan antar-elemen');
      explanation_density = 'EXPLANATION_GAP_NEEDS_VISUAL';
      visual_necessity = 'ESSENTIAL';
      necessity_rationale = 'Morfologi fisik material bertumpuk vs lembaran (atau detail penampang sambungan kusen-dinding) membebani imajinasi pembaca jika hanya dijelaskan dengan kata-kata. Gambar teknis autentik mutlak diperlukan.';

      const baseKey = slug.includes('atap-metal')
        ? 'inline_material_comparison_1'
        : slug.includes('kondensasi')
        ? 'inline_condensation_location_1'
        : 'inline_thermal_joint_detail_1';

      let candidateKey = baseKey;
      let counter = 1;
      while (assignedSlotKeys.has(candidateKey)) {
        counter++;
        candidateKey = `${baseKey.replace(/_\d+$/, '')}_${counter}`;
      }
      recommended_slot_key = candidateKey;
      assignedSlotKeys.add(candidateKey);

      recommended_media_type = slug.includes('atap-metal') ? 'comparison' : 'detail_close_up';
      visual_purpose = `Memperjelas bentuk fisik material dan sambungan rakitan secara nyata pada ${title}.`;
      required_visual_evidence = [
        'Proporsi ketebalan material yang akurat',
        'Profil permukaan dan tekstur autentik',
        'Tanpa render fiksi 3D berlebihan'
      ];
      accuracy_risks = [
        'Profil penampang fiktif yang tidak beredar di pasar Indonesia',
        'Ketiadaan elemen pengikat esensial (sekrup karet / sealant)'
      ];

      // Identify first distinctive paragraph phrase for anchoring
      if (sec.paragraphs.length > 0) {
        target_anchor_phrase = extractCleanAnchorPhrase(sec.paragraphs[0]);
      }
    }

    // 4. Subheadings under previously visualized concepts -> NOT_NEEDED (Prevents visual saturation)
    else if (
      sec.heading_level >= 3 &&
      (hTextLower.includes('kelembapan') ||
        hTextLower.includes('suhu') ||
        hTextLower.includes('thermal bridge') ||
        hTextLower.includes('ventilasi') ||
        hTextLower.includes('radiasi') ||
        hTextLower.includes('konduksi') ||
        hTextLower.includes('sifat bawaan'))
    ) {
      topic_transition = 'Sub-poin penjelasan turunan di bawah bagian konsep utama.';
      reader_question = 'Bagaimana rincian turunan dari parameter teknis ini?';
      visual_necessity = 'NOT_NEEDED';
      explanation_density = 'SUFFICIENT_TEXT_ONLY';
      necessity_rationale = 'Sub-poin penjelasan turunan; materi konseptual telah terwadahi pada diagram utama bagian induk untuk menghindari saturasi visual berlebihan.';
    }

    // 5. Physical Dynamics / Thermal Transfer / Failure Mechanics -> RECOMMENDED
    else if (
      hTextLower.includes('kinerja termal') ||
      hTextLower.includes('thermal bridge') ||
      hTextLower.includes('pemicu utama') ||
      hTextLower.includes('kondensasi') ||
      hTextLower.includes('radiasi matahari vs konduksi')
    ) {
      topic_transition = 'Analisis perpindahan panas (radiasi/konduksi/konveksi) atau dinamika embun.';
      reader_question = 'Bagaimana panas atau uap air bergerak menembus komponen bangunan ini?';
      technical_concepts.push('Dinamika termal', 'U-value / R-value', 'Titik embun (dew point)');
      spatial_material_relations.push('Arah aliran kalor', 'Lapisan pembatas udara');
      explanation_density = 'EXPLANATION_GAP_NEEDS_VISUAL';
      visual_necessity = 'RECOMMENDED';
      necessity_rationale = 'Vektor perpindahan panas atau perambatan embun sangat terbantu oleh diagram alur konseptual, mencegah miskonsepsi pembaca mengenai thermal lag vs insulasi.';

      const baseKey = slug.includes('atap-metal')
        ? 'inline_concept_diagram_1'
        : slug.includes('kondensasi')
        ? 'inline_dew_point_diagram_1'
        : 'inline_thermal_break_diagram_1';

      let candidateKey = baseKey;
      let counter = 1;
      while (assignedSlotKeys.has(candidateKey)) {
        counter++;
        candidateKey = `${baseKey.replace(/_\d+$/, '')}_${counter}`;
      }
      recommended_slot_key = candidateKey;
      assignedSlotKeys.add(candidateKey);

      recommended_media_type = 'annotated_illustration';
      visual_purpose = `Diagram alur dinamika fisik penyerapan dan pelepasan energi pada sistem ${title}.`;
      required_visual_evidence = [
        'Arah panah perambatan kalor yang benar sesuai termodinamika',
        'Identifikasi material konduktor vs isolator'
      ];
      accuracy_risks = [
        'Arah konveksi terbalik',
        'Mencampuradukkan radiasi langsung dengan konduksi profil'
      ];

      if (sec.paragraphs.length > 0) {
        target_anchor_phrase = extractCleanAnchorPhrase(sec.paragraphs[0]);
      }
    }

    // 5. Engineering Calculations / Structural Dead Loads -> OPTIONAL or NOT_NEEDED
    else if (hTextLower.includes('beban mati') || hTextLower.includes('kemiringan atap')) {
      topic_transition = 'Kalkulasi beban struktural dan standar sudut kemiringan.';
      reader_question = 'Berapa beban kilogram per meter persegi dan sudut minimum yang aman?';
      technical_concepts.push('Beban mati (DL)', 'SNI 1727:2020', 'Sudut kemiringan');
      explanation_density = 'SUFFICIENT_TEXT_ONLY';
      visual_necessity = 'OPTIONAL';
      necessity_rationale = 'Penjelasan matematis beban angka SNI (5 kg/m² vs 45 kg/m²) cukup jelas dipahami melalui narasi teks. Gambar hanya opsional jika ada infografis penampang reng.';
    }

    // 6. Generic Decision Scenarios / Synthesized Advice -> NOT_NEEDED
    else {
      topic_transition = 'Panduan penerapan lapangan dan skenario kompromi praktis.';
      reader_question = 'Apa langkah berikutnya yang harus saya putuskan untuk rumah saya?';
      explanation_density = 'SUFFICIENT_TEXT_ONLY';
      visual_necessity = 'NOT_NEEDED';
      necessity_rationale = 'Rangkuman keputusan praktis; teks narasi lebih efektif mengarahkan tindakan pemilik rumah tanpa distraksi gambar.';
    }

    segments.push({
      segment_id: segmentId,
      heading_text: sec.heading_text,
      heading_level: sec.heading_level,
      heading_id: sec.heading_id,
      paragraphs: sec.paragraphs,
      tables: sec.tables,
      has_table: hasTable,
      topic_transition,
      reader_question,
      technical_concepts,
      spatial_material_relations,
      explanation_density,
      visual_necessity,
      necessity_rationale,
      recommended_slot_key,
      recommended_media_type,
      visual_purpose,
      required_visual_evidence,
      accuracy_risks,
      target_anchor_phrase
    });
  }

  const counts = {
    essential: segments.filter((s) => s.visual_necessity === 'ESSENTIAL').length,
    recommended: segments.filter((s) => s.visual_necessity === 'RECOMMENDED').length,
    optional: segments.filter((s) => s.visual_necessity === 'OPTIONAL').length,
    not_needed: segments.filter((s) => s.visual_necessity === 'NOT_NEEDED').length,
    total_proposed: segments.filter((s) => s.visual_necessity === 'ESSENTIAL' || s.visual_necessity === 'RECOMMENDED').length
  };

  const editorial_summary = `Artikel memiliki ${segments.length} segmen editorial. Ditemukan ${counts.essential} slot visual ESSENTIAL dan ${counts.recommended} slot RECOMMENDED. Sebanyak ${counts.not_needed} segmen diklasifikasikan NOT_NEEDED untuk mencegah gambar dekoratif berlebihan.`;

  return {
    article_id: id,
    article_slug: slug,
    article_title: title,
    content_hash,
    total_headings: rawSections.length,
    total_segments: segments.length,
    segments,
    counts,
    editorial_summary
  };
}

/**
 * Builds a deterministic VisualPlacementManifest from the semantic segmentation analysis.
 */
export function buildPlacementManifestFromSegmentation(
  analysis: ArticleSemanticSegmentationResult
): VisualPlacementManifest {
  const visual_items: VisualManifestItem[] = [];

  const eligibleSegments = analysis.segments.filter(
    (s) => (s.visual_necessity === 'ESSENTIAL' || s.visual_necessity === 'RECOMMENDED') && s.recommended_slot_key
  );

  for (let i = 0; i < eligibleSegments.length; i++) {
    const seg = eligibleSegments[i];
    const slotKey = seg.recommended_slot_key!;
    const visualId = `vis-${analysis.article_id}-${String(i + 1).padStart(2, '0')}-${slotKey.replace(/_/g, '-')}`;

    visual_items.push({
      visual_id: visualId,
      slot_key: slotKey,
      media_type: seg.recommended_media_type || 'technical_diagram',
      priority: seg.visual_necessity === 'ESSENTIAL' ? 'essential' : 'helpful',
      placement: {
        target_heading_text: seg.heading_text,
        target_heading_id: seg.heading_id,
        position: seg.target_anchor_phrase ? 'after_paragraph_containing' : 'after_heading',
        paragraph_anchor_phrase: seg.target_anchor_phrase
      },
      visual_purpose: seg.visual_purpose || `Visual penjelas segmen ${seg.heading_text}`,
      visual_brief: {
        prompt_indonesian: `Visual konsep editorial RancangLoka untuk ${seg.heading_text}. Menunjukkan ${seg.visual_purpose}. Akurasi material tinggi, tanpa teks dekoratif buatan.`,
        storytelling_class: seg.recommended_media_type === 'comparison' ? 'COMPARATIVE_VISUAL' : 'CONCEPT_DIAGRAM',
        aspect_ratio: '16:9',
        intended_width: 1200,
        intended_height: 675
      },
      caption: `Penjelasan visual: ${seg.visual_purpose}`,
      alt_text: `Ilustrasi teknis arsitektur: ${seg.heading_text}`,
      asset_id: null,
      storage_key: null,
      review_status: 'PENDING',
      editorial_approval: 'PENDING'
    });
  }

  return {
    manifest_version: '1.0.0',
    article_id: String(analysis.article_id),
    article_slug: analysis.article_slug,
    content_hash: analysis.content_hash,
    visual_items
  };
}

/**
 * Generates EVIS-1 Visual Identity Profiles for each proposed visual slot.
 */
export function generateVisualIdentityProfiles(
  analysis: ArticleSemanticSegmentationResult
): VisualIdentityProfile[] {
  const profiles: VisualIdentityProfile[] = [];

  const eligibleSegments = analysis.segments.filter(
    (s) => (s.visual_necessity === 'ESSENTIAL' || s.visual_necessity === 'RECOMMENDED') && s.recommended_slot_key
  );

  for (const seg of eligibleSegments) {
    const profile: VisualIdentityProfile = {
      article_id: analysis.article_id,
      article_slug: analysis.article_slug,
      editorial_angle: `Investigasi teknis arsitektur hunian tropis berimbang (${analysis.article_title})`,
      reader_question: seg.reader_question,
      primary_subject: `${seg.heading_text} - ${seg.technical_concepts.join(', ')}`,
      visual_story: seg.visual_purpose || 'Menjelaskan interaksi material secara nyata',
      environment_context: 'Hunian rumah tinggal di iklim tropis lembap Indonesia',
      required_visual_evidence: seg.required_visual_evidence || ['Komponen konstruksi nyata'],
      excluded_visual_elements: [
        'CGI mengkilap berlebihan',
        'Teks tipografi AI di dalam gambar',
        'Label merek dagang komersial'
      ],
      visual_distinctiveness_notes: `Fokus eksklusif pada fenomena ${seg.technical_concepts[0] || 'konstruksi'} untuk menghindari repetisi dengan artikel lain.`
    };

    // Validate completeness
    const validation = validateVisualIdentityProfile(profile);
    if (validation.ok) {
      profiles.push(profile);
    }
  }

  return profiles;
}

/**
 * Prepares Contextual Image SEO metadata drafts.
 * Invariant: Provisional alt text must NOT be marked as image-verified.
 */
export function generateContextualImageSeoDrafts(
  analysis: ArticleSemanticSegmentationResult
): ContextualImageSeoDraft[] {
  const drafts: ContextualImageSeoDraft[] = [];

  const eligibleSegments = analysis.segments.filter(
    (s) => (s.visual_necessity === 'ESSENTIAL' || s.visual_necessity === 'RECOMMENDED') && s.recommended_slot_key
  );

  for (const seg of eligibleSegments) {
    const slugBase = analysis.article_slug.replace(/^perbedaan-|^jendela-|^thermal-bridge-/, '');
    const cleanSlot = seg.recommended_slot_key!.replace(/_/g, '-');
    const recommended_filename = `${slugBase}-${cleanSlot}.webp`;

    drafts.push({
      slot_key: seg.recommended_slot_key!,
      provisional_alt_text: `Ilustrasi teknis penjelas ${seg.heading_text.toLowerCase()} memperlihatkan ${seg.technical_concepts.slice(0, 2).join(' dan ')} pada hunian tropis`,
      caption: `${seg.visual_purpose} (Ilustrasi konsep editorial RancangLoka).`,
      recommended_filename,
      target_anchor_heading: seg.heading_text,
      target_paragraph_phrase: seg.target_anchor_phrase,
      is_image_verified: false,
      verification_requirement: 'Wajib diverifikasi kesesuaiannya dengan hasil visual nyata oleh Chief Editor saat peninjauan pra-publikasi.'
    });
  }

  return drafts;
}

/**
 * Compares two articles' visual briefs to ensure anti-repetition integrity.
 */
export function compareArticleAntiRepetition(
  profileA: VisualIdentityProfile,
  profileB: VisualIdentityProfile
): CrossArticleAntiRepetitionComparison {
  const dimA: AntiRepetitionDimensions = {
    main_object_and_characteristics: profileA.primary_subject,
    camera_angle_and_framing: 'Eye-level architectural cross-section detail',
    setting_and_architectural_environment: profileA.environment_context,
    arrangement_of_materials: profileA.visual_story,
    lighting_and_visual_treatment: 'Natural diffused tropical daylight',
    editorial_meaning_and_purpose: profileA.reader_question
  };

  const dimB: AntiRepetitionDimensions = {
    main_object_and_characteristics: profileB.primary_subject,
    camera_angle_and_framing: 'Eye-level architectural cross-section detail',
    setting_and_architectural_environment: profileB.environment_context,
    arrangement_of_materials: profileB.visual_story,
    lighting_and_visual_treatment: 'Natural diffused tropical daylight',
    editorial_meaning_and_purpose: profileB.reader_question
  };

  // Compute semantic similarity based on subject and purpose overlap
  const wordsA = new Set(profileA.primary_subject.toLowerCase().split(/\s+/));
  const wordsB = new Set(profileB.primary_subject.toLowerCase().split(/\s+/));
  let overlap = 0;
  for (const w of wordsA) {
    if (wordsB.has(w) && w.length > 3) overlap++;
  }
  const semanticScore = overlap / Math.max(wordsA.size, wordsB.size);

  const evaluation = evaluateAntiRepetitionSignals({
    dimensions: dimA,
    comparisonDimensions: dimB,
    semanticSimilarityScore: semanticScore
  });

  let verdict: CrossArticleAntiRepetitionComparison['verdict'] = 'DISTINCT_EDITORIAL_PURPOSE';
  let rationale = 'Kedua profil visual memiliki fokus fenomena fisik dan tujuan editorial yang berbeda nyata.';

  if (evaluation.is_flagged_for_editorial_review) {
    verdict = 'REPETITION_WARNING';
    rationale = `Terdapat sinyal kemiripan (${(semanticScore * 100).toFixed(1)}%). Wajib ditinjau agar komposisi tidak tampak serupa.`;
  }

  return {
    article_a_id: profileA.article_id,
    article_a_slug: profileA.article_slug,
    article_b_id: profileB.article_id,
    article_b_slug: profileB.article_slug,
    slot_a_key: 'slot_a',
    slot_b_key: 'slot_b',
    evaluation,
    verdict,
    rationale
  };
}
