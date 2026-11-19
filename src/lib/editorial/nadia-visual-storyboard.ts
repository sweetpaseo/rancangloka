/**
 * RancangLoka — Nadia Visual Storyboard Engine (HERMES-VISUAL-EDITORIAL-V1)
 *
 * Implements the VISUAL STORY EDITOR role for Nadia while preserving her
 * core Audience & Language Editor (READER_VOICE) authority.
 *
 * CANONICAL PRINCIPLES:
 * 1. ZERO_DECORATIVE_SLOP:
 *    Images must exist ONLY to aid reader comprehension, spatial reasoning,
 *    material comparison, or structural risk awareness. No decorative filler.
 * 2. CONTENT_GROUNDED_ANCHORS:
 *    Every inline image MUST be bound to a stable heading slug / section anchor
 *    derived directly from the article AST/content, never fragile paragraph indices.
 * 3. EXPLICIT_EDUCATIONAL_TAKEAWAY:
 *    Each visual slot must declare what the homeowner will understand AFTER
 *    viewing the visual that words alone could not convey.
 * 4. FACTUAL_HONESTY & IRWAN_ALIGNMENT:
 *    Visuals must reflect real Indonesian construction physics (SNI, humidity,
 *    drainage, load-bearing walls) provided by Irwan.
 */

import type { HouseIdentityProfile } from './house-identity.ts';
import { getKitchenVentilationHouseProfile } from './house-identity.ts';

export type InlinePhotoRole = 'context' | 'problem_condition' | 'relevant_detail' | 'realistic_solution_example';
export type VisualEditorialPolicy = 'PHOTO_FIRST' | 'DIAGRAM_HYBRID' | 'LEGACY';

export interface StoryboardCoverSpec {
  slot_key: 'cover_hero';
  title: string;
  main_idea: string;
  representative_scene: string;
  reader_impression: string;
  must_include: string[];
  must_avoid: string[];
  recommended_aspect_ratio: '1.99:1' | '16:9' | '1312x672';
  suggested_alt_text: string;
  educational_goal: string;
  photo_role?: 'context';
  house_identity?: HouseIdentityProfile;
}

export type VisualMediaType = 'PHOTO_REALISTIC' | 'TECHNICAL_DIAGRAM_SVG' | 'SECTION_CUT_DIAGRAM' | 'MATERIAL_COMPARISON';

export interface StoryboardInlineSlot {
  slot_key: string;
  section_title: string;
  section_anchor: string;
  educational_purpose: string;
  reader_takeaway: string;
  visual_media_type: VisualMediaType;
  photo_role?: InlinePhotoRole;
  house_identity?: HouseIdentityProfile;
  justification: string;
  must_include: string[];
  must_avoid: string[];
  caption_intent: string;
  draft_alt_text: string;
  irwan_structural_constraints: string[];
}

export interface VisualIntentContract {
  slot_key: string;
  main_problem: string;
  visual_solution_idea: string;
  reader_takeaway: string;
  primary_elements_and_relations: string;
  camera_and_context: string;
  errors_to_avoid: string[];
  section_anchor?: string;
  concept_explained?: string;
  why_needed_at_this_point?: string;
  required_visual_evidence: string[];
  visual_media_type: VisualMediaType;
  caption_intent: string;
  draft_alt_text: string;
  non_duplicate_justification: string;
}

export interface VisualStoryboard {
  article_id?: number | string;
  article_slug: string;
  article_title: string;
  word_count: number;
  total_visual_slots: number;
  visual_policy?: VisualEditorialPolicy;
  house_identity?: HouseIdentityProfile;
  cover: StoryboardCoverSpec;
  inline_slots: StoryboardInlineSlot[];
  visual_intent_contracts?: Record<string, VisualIntentContract>;
  generated_at: string;
  editor: 'Nadia (Audience & Language Editor)';
  provenance_hash: string;
}

/**
 * Computes deterministic hash for the storyboard.
 */
function simpleHash(str: string): string {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash |= 0;
  }
  return Math.abs(hash).toString(16).padStart(8, '0');
}

/**
 * Nadia reads the complete article text and parses sections into a structured Visual Storyboard.
 */
export function generateVisualStoryboard(
  article: {
    id?: number | string;
    slug: string;
    title: string;
    markdown: string;
  },
  options?: {
    visual_policy?: VisualEditorialPolicy;
    house_profile?: HouseIdentityProfile;
  }
): VisualStoryboard {
  const { id, slug, title, markdown } = article;
  const wordCount = markdown.split(/\s+/).filter(Boolean).length;
  const policy: VisualEditorialPolicy = options?.visual_policy || 'PHOTO_FIRST';

  // Extract sections by markdown headings (H2: ##)
  const lines = markdown.split('\n');
  const sections: { title: string; anchor: string; body: string }[] = [];
  let currentSection: { title: string; anchor: string; body: string } | null = null;

  for (const line of lines) {
    const h2Match = line.match(/^##\s+(.+)$/);
    if (h2Match) {
      if (currentSection) {
        sections.push(currentSection);
      }
      const secTitle = h2Match[1].trim();
      const anchor = '#' + secTitle.toLowerCase()
        .replace(/[^\w\s-]/g, '')
        .replace(/\s+/g, '-');
      currentSection = { title: secTitle, anchor, body: '' };
    } else if (currentSection) {
      currentSection.body += line + '\n';
    }
  }
  if (currentSection) {
    sections.push(currentSection);
  }

  // 1. Resolve House Identity Profile
  const isKitchenVentilation = slug.includes('ventilasi-dapur') || slug.includes('cooker-hood') || title.toLowerCase().includes('ventilasi dapur');
  const houseProfile: HouseIdentityProfile = options?.house_profile || (
    isKitchenVentilation
      ? getKitchenVentilationHouseProfile(slug, title)
      : {
          profile_id: `hip_default_${slug.slice(0, 20)}`,
          article_slug: slug,
          article_title: title,
          architectural_style: 'Modern Tropical Indonesian Urban Residence',
          room_topology: 'Interior hunian kontemporer Indonesia dengan pencahayaan alami dan sirkulasi udara terencana.',
          material_palette: ['Kayu alami matte', 'Acian semen halus', 'Dinding bata ringan rapi', 'Lantai teraso / semen poles'],
          wall_colors: 'Warm greige / broken white lembut (#F2EFE9)',
          frame_window_identity: 'Kusen aluminium anodized dark bronze dengan bukaan ventilasi silang',
          fixed_spatial_landmarks: ['Elemen struktural balok praktis rapi', 'Pencahayaan alami terpadu'],
          lighting_mood: 'Cahaya alami tropis seimbang 3000K-4000K tanpa glare berlebih',
          reference_image_id: `${slug}_cover_anchor`,
          reference_image_url: null,
          tropical_climate_features: ['Material tahan kelembapan tropis', 'Ventilasi silang efektif'],
          camera_language: {
            lens_character: '35mm - 50mm architectural lens, rectilinear',
            film_sim_or_color_science: 'Natural editorial photography, soft contrast',
            perspective: 'Eye-level architectural perspective'
          },
          provenance: {
            created_at: new Date().toISOString(),
            engine_version: 'HOUSE_IDENTITY_V1.1',
            policy: 'PHOTO_FIRST'
          }
        }
  );

  // 2. A. COVER DEFINITION (Photo-First)
  let cover: StoryboardCoverSpec;
  if (isKitchenVentilation) {
    cover = {
      slot_key: 'cover_hero',
      photo_role: 'context',
      house_identity: houseProfile,
      title: title,
      main_idea: 'Foto arsitektur interior dapur kompak modern Indonesia tanpa jendela dengan pencahayaan hangat terencana dan tata letak ventilasi mekanis terpadu.',
      representative_scene: 'Establishing wide shot dapur kompak modern (2.4m x 3.0m) di rumah tinggal urban Indonesia: kabinet bawah HPL jati muda matte, countertop solid surface cream, backsplash keramik subway putih, kompor induksi tanam, slim cooker hood, dan cahaya alami lembut merembes dari bukaan ruang makan di sampingnya.',
      reader_impression: 'Hangat, bersih, tertata rapi, fungsional, dan membuktikan bahwa dapur tanpa jendela tetap bisa nyaman jika dirancang dengan benar.',
      must_include: [
        'Material konsisten: kabinet jati muda matte, countertop solid surface cream, keramik subway putih',
        'Pencahayaan warm white 3000K alami tanpa overexposure',
        'Skala ruang proporsional dapur kompak 2.4x3.0 meter',
        'Suasana lived-in rapi keluarga Indonesia'
      ],
      must_avoid: [
        'Diagram garis, teks, atau tabel',
        'CGI rendering glossy yang tidak realistis',
        'Jendela luar fiktif yang tiba-tiba muncul di dinding bata masif',
        'Watermark, label harga, atau teks promosi'
      ],
      recommended_aspect_ratio: '16:9',
      suggested_alt_text: 'Foto arsitektur interior dapur kompak kontemporer Indonesia tanpa jendela dengan pencahayaan hangat dan tata letak ventilasi terencana.',
      educational_goal: 'Menghadirkan bukti visual konkret solusi tata ruang dan pencahayaan dapur tanpa jendela yang estetis dan fungsional.'
    };
  } else {
    const isDenahTownhouse = slug.includes('denah') || title.toLowerCase().includes('denah');
    cover = isDenahTownhouse ? {
      slot_key: 'cover_hero',
      photo_role: 'context',
      house_identity: houseProfile,
      title: title,
      main_idea: 'Penataan denah rumah memanjang lebar 5–6 meter dengan jalur sirkulasi alami terpadu (inlet fasad, void tengah, outlet belakang).',
      representative_scene: 'Interior rumah tinggal kontemporer Indonesia selebar 5–6 meter dengan pencahayaan alami melimpah dari inner court / void tengah, memperlihatkan kontinuitas ruang tamu dan ruang keluarga tanpa sekat gelap.',
      reader_impression: 'Lega, sejuk, tenang, terang alami, dan membumi (bukan rumah sempit yang pengap atau gelap gulita).',
      must_include: [
        'Pencahayaan alami hangat dari atas (skylight/inner court lightwell)',
        'Material alami tropis: lantai semen poles / teraso, kisi kayu jati / merbau, dinding bata ringan rapi',
        'Proporsi ruang selebar 5–6 meter realistis',
        'Tanaman hijau tropis dalam ruangan (monstera / pakis sarang burung / ketapang biola mini)'
      ],
      must_avoid: [
        'CGI rendering glossy yang tidak realistis',
        'Figur manusia close-up atau menghadap kamera yang mendistraksi arsitektur',
        'Dekorasi gaya Eropa/Amerika (perapian, moulding klasik berlebih, karpet tebal salju)',
        'Watermark, teks logo, overlay banner promosi',
        'Geometri ruang mustahil atau kolom melayang'
      ],
      recommended_aspect_ratio: '16:9',
      suggested_alt_text: 'Interior rumah tropis lebar 5 meter dengan pencahayaan alami dari bukaan taman dalam dan sirkulasi udara terbuka.',
      educational_goal: 'Membuktikan secara visual bahwa rumah sempit 5-6 meter bisa terasa luas dan sejuk jika sirkulasi udara dan cahaya ditata terintegrasi.'
    } : {
      slot_key: 'cover_hero',
      photo_role: 'context',
      house_identity: houseProfile,
      title: title,
      main_idea: `Visualisasi fotografi arsitektur dan interior autentik Indonesia untuk topik "${title}".`,
      representative_scene: `Suasana hunian tropis Indonesia yang nyaman, terang alami, dan realistis terkait penanganan ${title}.`,
      reader_impression: 'Hangat, solutif, nyata, membumi, dan tidak terasa seperti brosur CGI komersial.',
      must_include: [
        'Pencahayaan alami tropis seimbang tanpa glare berlebih',
        'Material bangunan nyata: kayu alami matte, acian semen rapi, dinding bata bersih',
        'Skala ruang proporsional hunian keluarga Indonesia',
        'Konteks ruangan lived-in yang rapi dan fungsional'
      ],
      must_avoid: [
        'CGI rendering glossy yang tidak realistis',
        'Figur manusia close-up mendistraksi arsitektur',
        'Elemen arsitektur asing non-tropis (perapian salju, moulding eropa tebal)',
        'Watermark, teks logo, atau overlay banner promosi',
        'Struktur mustahil tanpa tumpuan balok/kolom'
      ],
      recommended_aspect_ratio: '16:9',
      suggested_alt_text: `Foto arsitektur dan interior rumah tropis Indonesia membahas ${title}.`,
      educational_goal: `Memberikan gambaran visual nyata solusi arsitektural dan penataan yang dibahas dalam ${title}.`
    };
  }

  // 3. B. INLINE SLOTS DEFINITION (Photo-First: 0 Diagrams in Standard Flow)
  const inlineSlots: StoryboardInlineSlot[] = [];

  if (policy === 'PHOTO_FIRST' && isKitchenVentilation) {
    // Exact 3 editorial photo slots for Kitchen Ventilation (#10011)
    const sec1 = sections[0] || { title: '1. Apa bedanya cara kerja kedua sistem?', anchor: '#1-apa-bedanya-cara-kerja-kedua-sistem' };
    const sec2 = sections[1] || { title: '2. Kapan masing-masing sistem terasa kurang efektif?', anchor: '#2-kapan-masing-masing-sistem-terasa-kurang-efektif' };
    const sec3 = sections[2] || { title: '3. Apa yang perlu disiapkan sebelum pemasangan?', anchor: '#3-apa-yang-perlu-disiapkan-sebelum-pemasangan' };

    // Slot 1: Problem Condition
    inlineSlots.push({
      slot_key: 'inline_1_problem_trapped_steam',
      section_title: sec1.title,
      section_anchor: sec1.anchor,
      photo_role: 'problem_condition',
      house_identity: houseProfile,
      visual_media_type: 'PHOTO_REALISTIC',
      educational_purpose: 'Memperlihatkan kondisi masalah: kepulan uap memasak dan kelembapan yang terkonsentrasi di area kompor saat ventilasi mekanis belum aktif.',
      reader_takeaway: 'Pembaca memahami secara visual bagaimana uap air dan partikel minyak naik langsung menuju kabinet atas dan membutuhkan penangkapan di sumbernya.',
      justification: 'Foto realistis kepulan uap di atas kompor memperlihatkan tantangan fisik nyata dapur tanpa bukaan jendela.',
      must_include: [
        'Kompor induksi 2 tungku menyala dengan wajan/panci dan kepulan uap masakan tipis realistis',
        'Kabinet atas kayu jati muda matte tepat di atas kompor dengan pencahayaan LED warm white bawah kabinet',
        'Backsplash keramik subway putih dan countertop cream identik dengan Cover',
        'Sudut pengambilan gambar medium-close shot setinggi dada (eye-level cooktop perspective)'
      ],
      must_avoid: [
        'Diagram vektor panah atau label teks',
        'Api gas raksasa yang tidak realistis',
        'Material kabinet atau dinding yang berbeda dari Cover',
        'Watermark atau teks grafis'
      ],
      caption_intent: 'Kondisi masalah: kepulan uap memasak dan kelembapan yang terkonsentrasi di atas kompor pada dapur tanpa jendela.',
      draft_alt_text: 'Foto kondisi memasak di dapur kompak memperlihatkan kepulan uap air naik menuju kabinet atas sebelum diserap ventilasi.',
      irwan_structural_constraints: [
        'Jarak vertikal antara permukaan kompor dan dasar cooker hood minimal 65cm untuk keselamatan',
        'Gunakan material kabinet tahan uap panas dan kelembapan'
      ]
    });

    // Slot 2: Relevant Detail
    inlineSlots.push({
      slot_key: 'inline_2_detail_cooker_hood_filter',
      section_title: sec2.title,
      section_anchor: sec2.anchor,
      photo_role: 'relevant_detail',
      house_identity: houseProfile,
      visual_media_type: 'PHOTO_REALISTIC',
      educational_purpose: 'Menampilkan detail komponen filtrasi: unit cooker hood slimline stainless steel dengan filter grease aluminium dan kaset filter karbon aktif di bawah kabinet atas.',
      reader_takeaway: 'Pemilik rumah melihat wujud fisik filter grease dan karbon aktif yang perlu dirawat rutin agar penyerapan bau dan minyak tetap optimal.',
      justification: 'Detail close-up membantu pembaca mengenali fisik filter karbon aktif dan penangkap lemak secara jelas.',
      must_include: [
        'Bidikan detail close-up (macro/detail shot) di bawah kabinet atas',
        'Unit cooker hood slimline stainless steel terpasang rapi rata dengan kabinet jati muda',
        'Kisi filter aluminium mesh penangkap lemak bersih dan modul kaset karbon aktif',
        'Tekstur material metal brushed dan pencahayaan LED strip linier'
      ],
      must_avoid: [
        'Diagram potongan teknis atau skema sketsa',
        'Bidikan luas seluruh ruangan yang kehilangan fokus komponen',
        'Material kabinet berubah warna'
      ],
      caption_intent: 'Detail komponen: unit cooker hood resirkulasi dengan filter aluminium penangkap lemak dan kaset karbon aktif penyerap aroma.',
      draft_alt_text: 'Foto detail bagian bawah cooker hood resirkulasi memperlihatkan filter aluminium mesh dan kaset karbon aktif di bawah kabinet dapur.',
      irwan_structural_constraints: [
        'Filter karbon aktif harus dapat dilepas-pasang dengan mudah tanpa membongkar rangka kabinet',
        'Sambungan kabel listrik hood wajib tersembunyi rapi di dalam void kabinet'
      ]
    });

    // Slot 3: Realistic Solution Example
    inlineSlots.push({
      slot_key: 'inline_3_solution_balanced_exhaust',
      section_title: sec3.title,
      section_anchor: sec3.anchor,
      photo_role: 'realistic_solution_example',
      house_identity: houseProfile,
      visual_media_type: 'PHOTO_REALISTIC',
      educational_purpose: 'Memperlihatkan solusi menyeluruh yang terpasang rapi: lubang exhaust fan dinding dengan kisi backdraft damper dan celah udara pengganti di bawah pintu dapur.',
      reader_takeaway: 'Melihat implementasi nyata jalur buangan dinding luar yang rapi serta pentingnya celah bawah pintu agar hisapan udara berlangsung lancar tanpa vakum.',
      justification: 'Solusi terpadu membuktikan bahwa exhaust fan dinding dan pasokan udara pengganti dapat dipasang secara estetis dan terintegrasi.',
      must_include: [
        'Unit exhaust fan dinding 10 inci dengan housing rapi terpasang di dinding samping greige',
        'Pintu kayu dengan celah undercut 3cm di lantai teraso abu-abu yang menyediakan pasokan udara pengganti',
        'Sudut pandang perspektif tiga perempat memperlihatkan keterhubungan antara kompor, exhaust, dan pintu',
        'Pencahayaan alami dan interior bersih fungsional'
      ],
      must_avoid: [
        'Diagram aliran fluida atau panah digital',
        'Kabel berantakan atau lubang dinding jebol tanpa finishing',
        'Denah atau warna dinding yang melenceng dari Cover'
      ],
      caption_intent: 'Solusi arsitektural: exhaust fan dinding dengan kisi penutup otomatis dipadukan celah pasokan udara masuk di bawah pintu dapur.',
      draft_alt_text: 'Foto penerapan ventilasi dapur terencana dengan exhaust fan dinding dan celah pasokan udara masuk di bawah pintu.',
      irwan_structural_constraints: [
        'Penembusan dinding bata untuk exhaust fan wajib menggunakan sleeve pipa PVC dan waterproofing perimeter',
        'Celah bawah pintu minimal 2-3cm untuk menjamin kontinuitas pasokan udara masuk'
      ]
    });
  } else {
    // Dynamic discovery for other topics or legacy modes
    const ignoredPatterns = /kesimpulan|faq|tanya-jawab|penutup|catatan|referensi/i;
    const eligibleSections = sections.filter(s => !ignoredPatterns.test(s.title) && s.body.trim().length > 100);
    const maxSlots = policy === 'PHOTO_FIRST' ? Math.min(3, Math.max(2, eligibleSections.length)) : 2;
    const targetSections = eligibleSections.slice(0, maxSlots);

    const roles: InlinePhotoRole[] = ['problem_condition', 'relevant_detail', 'realistic_solution_example', 'context'];

    targetSections.forEach((sec, idx) => {
      const isDiagram = policy !== 'PHOTO_FIRST' && /diagram|potongan|skema|aliran|jalur|perbandingan|komparasi|vektor/i.test(sec.title + ' ' + sec.body);
      const cleanSlotKey = `inline_${sec.anchor.replace(/^#/, '').replace(/[^a-z0-9_]/gi, '_').toLowerCase().slice(0, 25)}_${idx + 1}`;
      
      inlineSlots.push({
        slot_key: cleanSlotKey,
        section_title: sec.title,
        section_anchor: sec.anchor,
        photo_role: roles[idx % roles.length],
        house_identity: houseProfile,
        educational_purpose: `Menyajikan foto editorial konkret untuk membantu pemahaman pembaca mengenai ${sec.title}.`,
        reader_takeaway: `Pembaca dapat melihat secara langsung detail implementasi dan solusi pada bagian ${sec.title}.`,
        visual_media_type: isDiagram ? 'TECHNICAL_DIAGRAM_SVG' : 'PHOTO_REALISTIC',
        justification: `Penjelasan pada bagian "${sec.title}" membutuhkan dukungan visual fotografi nyata agar pembaca memahami konteks fisik.`,
        must_include: [
          'Material konstruksi atau interior autentik iklim tropis',
          'Proporsi realistis sesuai skala hunian Indonesia',
          'Pencahayaan alami dan detail rapi'
        ],
        must_avoid: [
          'CGI rendering glossy yang artifisial',
          'Watermark, teks logo, atau overlay banner',
          'Skala ruang yang tidak masuk akal'
        ],
        caption_intent: `Foto detail pelaksanaan dan penataan ruang terkait ${sec.title}.`,
        draft_alt_text: `Foto arsitektur dan interior realistis terkait ${sec.title}.`,
        irwan_structural_constraints: [
          'Pemasangan atau renovasi harus memperhatikan kekuatan struktur dan jalur air',
          'Gunakan material dengan spesifikasi tahan cuaca tropis'
        ]
      });
    });
  }

  const generatedAt = new Date().toISOString();
  const provHash = simpleHash(slug + title + inlineSlots.length + generatedAt);

  // 4. C. VISUAL INTENT CONTRACTS (Photo-First)
  const visualIntentContracts: Record<string, VisualIntentContract> = {};

  // Cover contract
  visualIntentContracts['cover_hero'] = {
    slot_key: 'cover_hero',
    main_problem: cover.main_idea,
    visual_solution_idea: cover.representative_scene,
    reader_takeaway: cover.reader_impression,
    primary_elements_and_relations: `Konteks arsitektur dan interior hunian nyata untuk topik ${title}`,
    camera_and_context: 'Eye-level perspective 35mm natural, pencahayaan alami tropis seimbang, suasana rumah tinggal yang hangat.',
    errors_to_avoid: cover.must_avoid,
    required_visual_evidence: cover.must_include,
    visual_media_type: 'PHOTO_REALISTIC',
    caption_intent: cover.title,
    draft_alt_text: cover.suggested_alt_text,
    non_duplicate_justification: 'Cover menampilkan bidikan establishing lanskap ruang terpadu.'
  };

  // Populate contracts for inline slots
  for (const slot of inlineSlots) {
    visualIntentContracts[slot.slot_key] = {
      slot_key: slot.slot_key,
      main_problem: slot.educational_purpose,
      visual_solution_idea: slot.caption_intent,
      reader_takeaway: slot.reader_takeaway,
      primary_elements_and_relations: `Elemen utama arsitektur dan material hunian terkait ${slot.section_title} (${slot.photo_role || 'photo'})`,
      camera_and_context: slot.photo_role === 'relevant_detail'
        ? 'Close-up architectural detail perspective 50mm, sharp focus on components, warm linear LED lighting.'
        : 'Eye-level realistic 35mm architectural perspective, natural daylight, lived-in context.',
      errors_to_avoid: slot.must_avoid,
      section_anchor: slot.section_anchor,
      concept_explained: slot.educational_purpose,
      why_needed_at_this_point: slot.justification,
      required_visual_evidence: slot.must_include,
      visual_media_type: slot.visual_media_type,
      caption_intent: slot.caption_intent,
      draft_alt_text: slot.draft_alt_text,
      non_duplicate_justification: `Fokus pada ${slot.photo_role}: sudut dan skop visual berbeda dari cover dan slot lainnya.`
    };
  }

  return {
    article_id: id || 10000,
    article_slug: slug,
    article_title: title,
    word_count: wordCount,
    total_visual_slots: 1 + inlineSlots.length,
    visual_policy: policy,
    house_identity: houseProfile,
    cover,
    inline_slots: inlineSlots,
    visual_intent_contracts: visualIntentContracts,
    generated_at: generatedAt,
    editor: 'Nadia (Audience & Language Editor)',
    provenance_hash: provHash
  };
}
