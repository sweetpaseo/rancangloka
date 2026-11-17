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
}

export type VisualMediaType = 'PHOTO_REALISTIC' | 'TECHNICAL_DIAGRAM_SVG' | 'SECTION_CUT_DIAGRAM' | 'MATERIAL_COMPARISON';

export interface StoryboardInlineSlot {
  slot_key: string;
  section_title: string;
  section_anchor: string;
  educational_purpose: string;
  reader_takeaway: string;
  visual_media_type: VisualMediaType;
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
export function generateVisualStoryboard(article: {
  id?: number | string;
  slug: string;
  title: string;
  markdown: string;
}): VisualStoryboard {
  const { id, slug, title, markdown } = article;
  const wordCount = markdown.split(/\s+/).filter(Boolean).length;

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

  // A. COVER DEFINITION
  const isDenahTownhouse = slug.includes('denah') || title.toLowerCase().includes('denah');
  const cover: StoryboardCoverSpec = isDenahTownhouse ? {
    slot_key: 'cover_hero',
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
    recommended_aspect_ratio: '1312x672',
    suggested_alt_text: 'Interior rumah tropis lebar 5 meter dengan pencahayaan alami dari bukaan taman dalam dan sirkulasi udara terbuka.',
    educational_goal: 'Membuktikan secara visual bahwa rumah sempit 5-6 meter bisa terasa luas dan sejuk jika sirkulasi udara dan cahaya ditata terintegrasi.'
  } : {
    slot_key: 'cover_hero',
    title: title,
    main_idea: `Visualisasi arsitektur dan interior autentik Indonesia untuk topik "${title}".`,
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
    recommended_aspect_ratio: '1312x672',
    suggested_alt_text: `Foto arsitektur dan interior rumah tropis Indonesia membahas ${title}.`,
    educational_goal: `Memberikan gambaran visual nyata solusi arsitektural dan penataan yang dibahas dalam ${title}.`
  };

  // B. INLINE SLOTS DEFINITION (Content-Grounded, Non-Quota)
  const inlineSlots: StoryboardInlineSlot[] = [];

  // Slot 1: Inner Court (bound to Solusi 1 section if present)
  const innerCourtSec = sections.find(s => s.title.toLowerCase().includes('inner court'));
  if (innerCourtSec) {
    inlineSlots.push({
      slot_key: 'inline_inner_court_ventilation',
      section_title: innerCourtSec.title,
      section_anchor: innerCourtSec.anchor,
      educational_purpose: 'Menjelaskan mekanisme cross-ventilation horizontal antara jendela depan dan bukaan taman dalam 1,5 x 2 meter.',
      reader_takeaway: 'Pemilik rumah memahami bahwa inner court kecil berukuran 1,5 x 2 meter sudah cukup sebagai outlet pembuangan udara panas dan sumber cahaya.',
      visual_media_type: 'PHOTO_REALISTIC',
      justification: 'Konsep taman dalam sulit dibayangkan pembaca tanpa contoh visual proporsi nyata 1,5 x 2 meter pada kaveling 5 meter.',
      must_include: [
        'Taman kering dalam rumah (gravel/koral putih, tanaman tropis berdaun kokoh)',
        'Bukaan langit terlindung dengan kisi teralis pengaman',
        'Pintu geser kaca (sliding glass doors) menghubungkan ruang makan ke inner court',
        'Lantai dengan kemiringan menuju floor drain perimeter'
      ],
      must_avoid: [
        'Kolam renang mewah atau taman raksasa yang tidak masuk akal di lebar 5 meter',
        'Tanaman rontok lebat yang berpotensi menyumbat drainase',
        'Ruang tanpa atap yang bocor ke mana-mana tanpa talang'
      ],
      caption_intent: 'Taman dalam 1,5 × 2 meter di tengah kaveling berfungsi ganda sebagai penyuplai cahaya dan corong pembuangan udara panas.',
      draft_alt_text: 'Taman dalam rumah minimalis dengan bukaan cahaya atas, tanaman tropis, dan pintu geser kaca di samping ruang makan.',
      irwan_structural_constraints: [
        'Drainase perimeter wajib dengan kemiringan lantai 1-2% ke floor drain',
        'Perhatikan talang atap di sekeliling bukaan agar tidak terjadi tampias ke ruang dalam',
        'Balok pengikat kolom praktis di sekeliling bukaan taman tidak boleh dipotong'
      ]
    });
  }

  // Slot 2: Void Tangga Cerobong (bound to Stack Effect / Cerobong section if present)
  const voidTanggaSec = sections.find(s => 
    s.title.toLowerCase().includes('void') || 
    s.title.toLowerCase().includes('cerobong') ||
    s.title.toLowerCase().includes('stack effect')
  );
  if (voidTanggaSec) {
    inlineSlots.push({
      slot_key: 'inline_void_tangga_stack_effect',
      section_title: voidTanggaSec.title,
      section_anchor: voidTanggaSec.anchor,
      educational_purpose: 'Memvisualisasikan prinsip thermal buoyancy (efek cerobong): udara panas naik ke atas bordes tangga dan keluar lewat kisi jalusi atas.',
      reader_takeaway: 'Pembaca menyadari bahwa skylight kaca mati justru memerangkap panas, sementara kisi jalusi samping atas melepaskan udara panas.',
      visual_media_type: 'TECHNICAL_DIAGRAM_SVG',
      justification: 'Aliran udara termal (udara panas naik, udara sejuk masuk) bersifat tak kasat mata; diagram teknis panah aliran jauh lebih efektif daripada foto.',
      must_include: [
        'Potongan vertikal 2 lantai memperlihatkan tangga',
        'Panah merah aliran udara panas naik ke titik tertinggi void',
        'Panah biru udara sejuk masuk dari bukaan lantai bawah',
        'Kisi ventilasi jalusi (clerestory) di dinding atas tangga',
        'Catatan bahaya kaca mati tanpa ventilasi'
      ],
      must_avoid: [
        'Foto tangga gelap tanpa penanda aliran',
        'Skema fisika yang melanggar hukum termodinamika (panas bergerak ke bawah)'
      ],
      caption_intent: 'Diagram efek cerobong pada void tangga: udara panas plafon terdorong keluar melalui kisi atas dan menarik udara segar dari lantai bawah.',
      draft_alt_text: 'Diagram sirkulasi efek cerobong void tangga dua lantai dengan panah aliran udara hangat ke atas dan kisi ventilasi sopi-sopi.',
      irwan_structural_constraints: [
        'Pelat dak beton di sekeliling lubang void tangga wajib diperkuat balok anak/balok tepi',
        'Dilarang melubangi dak beton tanpa penulangan ekstra di sudut bukaan'
      ]
    });
  }

  // Slot 3: Sekat Roster & Kisi Clerestory (bound to bukaan / sekat / clerestory section if present)
  const sekatSec = sections.find(s => 
    s.title.toLowerCase().includes('sekat') || 
    s.title.toLowerCase().includes('denah terbuka') ||
    s.title.toLowerCase().includes('clerestory') ||
    s.title.toLowerCase().includes('kisi')
  );
  if (sekatSec) {
    inlineSlots.push({
      slot_key: 'inline_sekat_bernapas_roster',
      section_title: sekatSec.title,
      section_anchor: sekatSec.anchor,
      educational_purpose: 'Menunjukkan penerapan partisi roster bata tanah liat / bilah kisi kayu yang membatasi privasi visual ruang keluarga tanpa menghambat angin.',
      reader_takeaway: 'Rumah selebar 5-6 meter tidak butuh tembok bata masif di setiap ruang; sekat bernapas memberi privasi sekaligus mempertahankan ventilasi silang.',
      visual_media_type: 'PHOTO_REALISTIC',
      justification: 'Membantu pemilik rumah melihat estetika modern partisi berlubang yang rapi dan elegan, bukan sekadar bata ventilasi gudang.',
      must_include: [
        'Dinding partisi roster geometris terra-cotta atau semen ekspos rapi',
        'Pemandangan tembus sebagian ke area ruang keluarga di baliknya',
        'Cahaya alami menembus lubang partisi menciptakan bayangan estetik',
        'Tata letak furnitur ruang tamu kompak proporsional'
      ],
      must_avoid: [
        'Tembok bata kasar yang belum diaci atau berantakan',
        'Ruang sempit yang sesak penuh tumpukan barang'
      ],
      caption_intent: 'Partisi roster semen berlubang menyaring pandangan dari pintu masuk sembari membiarkan hembusan angin tetap mengalir bebas.',
      draft_alt_text: 'Partisi roster geometris modern pembatas ruang tamu dan ruang keluarga dengan pencahayaan alami tembus pandang.',
      irwan_structural_constraints: [
        'Dinding roster non-struktural harus diikat kolom praktis atau frame baja siku agar tidak roboh saat terdorong',
        'Ketinggian partisi roster melebihi 2 meter wajib memiliki pengaku balok praktis di atasnya'
      ]
    });
  }

  // DYNAMIC INLINE DISCOVERY FOR ANY ARTICLE:
  // If specific slots did not match (e.g. topic is balkon, japandi, atap, plafon, etc.),
  // dynamically discover 1-2 prime informative sections from the article's actual H2 headings!
  if (inlineSlots.length === 0 && sections.length > 0) {
    const ignoredPatterns = /kesimpulan|faq|tanya-jawab|penutup|catatan|referensi/i;
    const eligibleSections = sections.filter(s => !ignoredPatterns.test(s.title) && s.body.trim().length > 100);
    
    // Select up to 2 high-value sections for visual storytelling
    const targetSections = eligibleSections.slice(0, 2);

    targetSections.forEach((sec, idx) => {
      const isDiagram = /diagram|potongan|skema|aliran|jalur|perbandingan|komparasi|vektor/i.test(sec.title + ' ' + sec.body);
      const cleanSlotKey = `inline_${sec.anchor.replace(/^#/, '').replace(/[^a-z0-9_]/gi, '_').toLowerCase().slice(0, 25)}_${idx + 1}`;
      
      inlineSlots.push({
        slot_key: cleanSlotKey,
        section_title: sec.title,
        section_anchor: sec.anchor,
        educational_purpose: `Menyajikan visualisasi konkret untuk membantu pemahaman pembaca mengenai ${sec.title}.`,
        reader_takeaway: `Pembaca dapat melihat secara langsung detail implementasi dan solusi pada bagian ${sec.title}.`,
        visual_media_type: isDiagram ? 'TECHNICAL_DIAGRAM_SVG' : 'PHOTO_REALISTIC',
        justification: `Penjelasan pada bagian "${sec.title}" membutuhkan dukungan visual agar pembaca tidak salah menafsirkan detail teknis.`,
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
        caption_intent: `Detail visualisasi solusi praktis untuk ${sec.title}.`,
        draft_alt_text: `Foto detail pelaksanaan dan penataan ruang terkait ${sec.title}.`,
        irwan_structural_constraints: [
          'Pemasangan atau renovasi harus memperhatikan kekuatan struktur dan jalur air',
          'Gunakan material dengan spesifikasi tahan cuaca tropis'
        ]
      });
    });
  }

  const generatedAt = new Date().toISOString();
  const provHash = simpleHash(slug + title + inlineSlots.length + generatedAt);

  // C. VISUAL INTENT CONTRACTS (HERMES-VISUAL-EDITORIAL-V2)
  const visualIntentContracts: Record<string, VisualIntentContract> = {
    cover_hero: {
      slot_key: 'cover_hero',
      main_problem: 'Penataan denah memanjang rumah lebar 5–6 meter yang rentan gelap dan pengap di bagian tengah akibat minimnya bukaan samping.',
      visual_solution_idea: 'Ruang keluarga dan ruang makan yang bermandikan cahaya alami vertikal dari bukaan inner court tengah terbuka ke langit, memperlihatkan kontinuitas visual dan sirkulasi udara tanpa sekat masif.',
      reader_takeaway: 'Memahami secara instan bahwa kaveling 5-6 meter tetap dapat terasa lapang, terang benderang, dan sejuk jika ruang tengah dirancang dengan bukaan vertikal yang fungsional.',
      primary_elements_and_relations: 'Area duduk ruang keluarga (foreground/midground) dengan pemandangan langsung ke inner court (midground) dan area dining / tangga (background), terkoneksi secara visual.',
      camera_and_context: 'Eye-level perspective 35mm natural, pencahayaan alami tropis Jakarta yang seimbang dan lembut, material lokal Indonesia, suasana rumah tinggal yang lived-in dan hangat.',
      errors_to_avoid: [
        'Empty corridor trap (lorong kosong tanpa fungsi)',
        'Plafon tertutup kanopi kaca mati tanpa ventilasi',
        'Furnitur showroom steril tak berpenghuni',
        'Tanaman artifisial repetitif',
        'Struktur mustahil tanpa balok/kolom praktis'
      ],
      required_visual_evidence: [
        'Proporsi lebar ruang 5-6 meter dengan ketinggian plafon proporsional',
        'Cahaya vertikal alami dari inner court menyinari ruang tengah',
        'Area duduk keluarga aktif (kursi santai, meja kopi, karpet)',
        'Bukaan kaca geser transparan ke taman dalam',
        'Balok pengikat beton ekspos / lintel struktural di atas bukaan'
      ],
      visual_media_type: 'PHOTO_REALISTIC',
      caption_intent: 'Interior rumah tropis 5 meter dengan taman tengah terbuka ke langit yang memasukkan cahaya alami dan sirkulasi udara ke ruang keluarga.',
      draft_alt_text: 'Interior ruang keluarga rumah lebar 5 meter menghadap taman tengah terbuka dengan pencahayaan alami dan sirkulasi udara terpadu.',
      non_duplicate_justification: 'Cover menampilkan lanskap ruang luas (living-to-dining lifestyle & spatial flow) untuk memberi inspirasi solusi tata ruang holistik.'
    }
  };

  // Populate contracts for inline slots
  for (const slot of inlineSlots) {
    if (slot.slot_key.includes('inner_court')) {
      visualIntentContracts[slot.slot_key] = {
        slot_key: slot.slot_key,
        main_problem: 'Kekhawatiran pemilik rumah bahwa inner court mungil akan menimbulkan banjir, rembesan, atau tampias air hujan ke ruang makan.',
        visual_solution_idea: 'Rasio bukaan 1.5 x 2 meter dengan void terbuka ke langit, bedeng kerikil resapan tepi lantai (perimeter sunken gravel), drop level 5-10cm, dan pintu geser aluminium operasional.',
        reader_takeaway: 'Melihat bukti fisik konkret bagaimana batas basah dan kering dikelola sehingga inner court kecil aman dari tampias saat hujan lebat tropis.',
        primary_elements_and_relations: 'Bukaan void terbuka ke langit (atas), bedeng kerikil resapan di sekeliling lantai (bawah), dan pintu geser aluminium hitam membatasi ruang makan (samping).',
        camera_and_context: 'Eye-level detail perspective 35-50mm, pencahayaan zenith daylight langsung dari langit tropis, material kerikil sungai abu-abu dan lantai beton poles.',
        errors_to_avoid: [
          'Skylight kaca mati tertutup yang memerangkap panas',
          'Lantai rata tanpa drop level atau talang perimeter',
          'Taman raksasa yang tidak realistis untuk kaveling 5 meter',
          'Tanaman plastik atau daun berulang sintetik'
        ],
        section_anchor: slot.section_anchor,
        concept_explained: 'Detail teknis pengelolaan air hujan dan pembuangan panas pada inner court 1.5 x 2 meter dengan drop level lantai dan bedeng drainase kerikil.',
        why_needed_at_this_point: 'Pembaca perlu melihat langsung detail fisik bagaimana air hujan dialirkan dan bagaimana pintu geser melindungi ruang dalam.',
        required_visual_evidence: [
          'Void benar-benar terbuka ke langit (open-to-sky) tanpa kaca penutup',
          'Bedeng kerikil resapan tepi (sunken gravel drainage) mengelilingi lantai taman',
          'Perbedaan level lantai (drop level) 5-10cm antara taman dan ruang makan',
          'Pintu geser kaca frame aluminium hitam operasional'
        ],
        visual_media_type: 'PHOTO_REALISTIC',
        caption_intent: slot.caption_intent,
        draft_alt_text: slot.draft_alt_text,
        non_duplicate_justification: 'Berbeda dari Cover yang menampilkan lanskap living-room luas, visual ini adalah bidikan detail teknis arsitektur pada zona bukaan dan transisi basah/kering.'
      };
    } else if (slot.slot_key.includes('void_tangga')) {
      visualIntentContracts[slot.slot_key] = {
        slot_key: slot.slot_key,
        main_problem: 'Udara panas terjebak di bawah plafon lantai dua dan tidak bisa keluar.',
        visual_solution_idea: 'Potongan vertikal skematis efek cerobong void tangga dengan panah aliran termal.',
        reader_takeaway: 'Memahami arah gerak udara panas yang naik secara termal dan membutuhkan kisi pembuangan atas.',
        primary_elements_and_relations: 'Tangga dua lantai, inlet udara bawah, outlet kisi clerestory atas, dan panah aliran termal.',
        camera_and_context: 'Orthographic architectural cross-section SVG.',
        errors_to_avoid: ['Foto gelap tanpa panah penjelasan', 'Panah panas bergerak ke bawah'],
        section_anchor: slot.section_anchor,
        concept_explained: 'Prinsip thermal buoyancy / stack effect pada void tangga.',
        why_needed_at_this_point: 'Sirkulasi termal tidak kasat mata sehingga diagram teknis jauh lebih efektif dari foto.',
        required_visual_evidence: ['Panah biru inlet', 'Panah merah outlet', 'Kisi clerestory atas'],
        visual_media_type: 'TECHNICAL_DIAGRAM_SVG',
        caption_intent: slot.caption_intent,
        draft_alt_text: slot.draft_alt_text,
        non_duplicate_justification: 'Diagram teknis deterministik satu-satunya yang memvisualisasikan dinamika fluida termal tak kasat mata.'
      };
    } else if (slot.slot_key.includes('sekat')) {
      visualIntentContracts[slot.slot_key] = {
        slot_key: slot.slot_key,
        main_problem: 'Privasi ruang tamu dan ruang keluarga tanpa mematikan hembusan angin alami.',
        visual_solution_idea: 'Partisi roster semen atau terra-cotta geometris modern yang tembus pandang parsial.',
        reader_takeaway: 'Partisi berlubang memberi privasi visual elegan tanpa menghalangi sirkulasi silang.',
        primary_elements_and_relations: 'Dinding partisi roster berlubang (foreground), siluet ruang keluarga di baliknya (background).',
        camera_and_context: 'Perspective interior detail 50mm, pencahayaan alami samping.',
        errors_to_avoid: ['Tembok masif gelap', 'Bata gudang kasar berantakan'],
        section_anchor: slot.section_anchor,
        concept_explained: 'Penerapan partisi bernapas (breathable divider) untuk ventilasi silang.',
        why_needed_at_this_point: 'Menghilangkan keraguan bahwa rumah sempit harus disekat tembok padat.',
        required_visual_evidence: ['Lubang roster geometris', 'Bayangan pola roster di lantai', 'Tembus pandang parsial'],
        visual_media_type: 'PHOTO_REALISTIC',
        caption_intent: slot.caption_intent,
        draft_alt_text: slot.draft_alt_text,
        non_duplicate_justification: 'Fokus pada materialitas elemen interior mikro pemisah ruang (breathable divider).'
      };
    } else {
      visualIntentContracts[slot.slot_key] = {
        slot_key: slot.slot_key,
        main_problem: slot.educational_purpose,
        visual_solution_idea: slot.caption_intent,
        reader_takeaway: slot.reader_takeaway,
        primary_elements_and_relations: `Elemen utama arsitektur dan material hunian terkait ${slot.section_title}`,
        camera_and_context: 'Eye-level realistic 35-50mm architectural perspective, pencahayaan alami tropis seimbang, lived-in context.',
        errors_to_avoid: slot.must_avoid,
        section_anchor: slot.section_anchor,
        concept_explained: slot.educational_purpose,
        why_needed_at_this_point: slot.justification,
        required_visual_evidence: slot.must_include,
        visual_media_type: slot.visual_media_type,
        caption_intent: slot.caption_intent,
        draft_alt_text: slot.draft_alt_text,
        non_duplicate_justification: `Fokus pada penjelasan visual detail untuk bagian ${slot.section_title}.`
      };
    }
  }

  if (!isDenahTownhouse) {
    visualIntentContracts['cover_hero'] = {
      slot_key: 'cover_hero',
      main_problem: cover.main_idea,
      visual_solution_idea: cover.representative_scene,
      reader_takeaway: cover.reader_impression,
      primary_elements_and_relations: `Konteks hunian nyata untuk topik ${title}`,
      camera_and_context: 'Eye-level perspective 35mm natural, pencahayaan alami tropis seimbang, suasana rumah tinggal yang hangat.',
      errors_to_avoid: cover.must_avoid,
      required_visual_evidence: cover.must_include,
      visual_media_type: 'PHOTO_REALISTIC',
      caption_intent: cover.title,
      draft_alt_text: cover.suggested_alt_text,
      non_duplicate_justification: 'Cover menampilkan lanskap utama solusi arsitektural terpadu.'
    };
  }

  return {
    article_id: id || 10000,
    article_slug: slug,
    article_title: title,
    word_count: wordCount,
    total_visual_slots: 1 + inlineSlots.length,
    cover,
    inline_slots: inlineSlots,
    visual_intent_contracts: visualIntentContracts,
    generated_at: generatedAt,
    editor: 'Nadia (Audience & Language Editor)',
    provenance_hash: provHash
  };
}
