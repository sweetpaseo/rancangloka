/**
 * RancangLoka — House Identity Profile Engine (PHOTO-FIRST v1.1)
 *
 * Enforces visual consistency across an article's photography set by defining
 * a unified architectural and spatial identity profile for the featured home.
 *
 * CANONICAL INVARIANTS:
 * 1. SINGLE_HOUSE_ANCHOR: All editorial photos in an article must depict the same home or main room.
 * 2. BUILDABLE_INDONESIAN_REALISM: Realistic materials, proportions, and tropical climate adaptations.
 * 3. NO_RANDOM_MORPHING: Cabinets, wall colors, window frames, and floorings must not arbitrarily change between shots.
 * 4. MONETARY_SILENCE: Profiles never prescribe vendor brands, prices, or speculative cost estimates.
 */

export interface HouseIdentityProfile {
  profile_id: string;
  article_slug: string;
  article_title: string;
  architectural_style: string;
  room_topology: string;
  material_palette: string[];
  wall_colors: string;
  frame_window_identity: string;
  fixed_spatial_landmarks: string[];
  lighting_mood: string;
  reference_image_id: string | null;
  reference_image_url: string | null;
  tropical_climate_features: string[];
  camera_language: {
    lens_character: string;
    film_sim_or_color_science: string;
    perspective: string;
  };
  provenance: {
    created_at: string;
    engine_version: 'HOUSE_IDENTITY_V1.1';
    policy: 'PHOTO_FIRST';
  };
}

/**
 * Builds a deterministic House Identity Profile for Article #10011 (Ventilasi Dapur Tanpa Jendela).
 */
export function getKitchenVentilationHouseProfile(slug: string, title: string): HouseIdentityProfile {
  return {
    profile_id: `hip_kitchen_compact_${slug.slice(0, 20)}`,
    article_slug: slug,
    article_title: title,
    architectural_style: 'Modern Contemporary Indonesian Compact Urban Home (Apartemen / Rumah Tinggal Kompak Tropis)',
    room_topology: 'Dapur kompak bentuk L (2.4m x 3.0m), tinggi plafon 2.8m, dinding perimeter bata/plester masif tanpa bukaan jendela luar, terkoneksi melalui bukaan tanpa pintu selebar 90cm ke ruang makan terbuka.',
    material_palette: [
      'HPL motif kayu jati muda matte (warm teak grain) pada kabinet bawah',
      'Countertop solid surface off-white / light cream matte ketebalan 4cm',
      'Backsplash keramik subway putih krem vertikal (7.5x15cm) dengan nat semen tipis rapi',
      'Lantai teraso abu-abu muda doff (honed light grey terrazzo 60x60cm)',
      'Profil handle dan lis kabinet aluminium warna dark bronze anodized'
    ],
    wall_colors: 'Cat dinding interior emulsi matte warna warm greige / broken white lembut (#F2EFE9)',
    frame_window_identity: 'Zona dapur interior tanpa jendela luar; kusen bukaan ke ruang makan berupa kayu solid simpel; pintu servis dengan kisi jalusi udara di bagian bawah (undercut make-up air slot 3cm)',
    fixed_spatial_landmarks: [
      'Kompor induksi tanam 2 tungku warna hitam flat flush dengan meja dapur',
      'Deretan kabinet gantung atas warna putih matte (kedalaman 35cm, tinggi 70cm) dengan lampu LED strip warm white tersembunyi',
      'Unit cooker hood resirkulasi slimline stainless steel terpasang 65cm tepat di atas kompor',
      'Lubang exhaust fan dinding sirkular 10 inci pada dinding bata masif sebelah kiri dengan kisi louver penutup otomatis (backdraft damper)',
      'Celah udara pengganti (make-up air undercut) 3cm di bagian bawah pintu akses'
    ],
    lighting_mood: 'Pencahayaan arsitektural tropis hangat (3000K warm white LED indirect di bawah kabinet + recessed downlight plafon lembut), dipadukan cahaya alami tidak langsung yang merembes dari void ruang makan di sampingnya. Bebas dari glare tajam atau efek CGI neon.',
    reference_image_id: 'art10011_cover_anchor',
    reference_image_url: null,
    tropical_climate_features: [
      'Substrat kabinet multipleks tahan lembap (MR grade plywood) standar iklim tropis',
      'Cat dinding anti-jamur dengan ketahanan scrub tinggi terhadap uap masakan',
      'Kisi exhaust eksterior dilengkapi kawat kasa anti-serangga untuk iklim lembap Indonesia'
    ],
    camera_language: {
      lens_character: '35mm to 50mm architectural lens, rectilinear, f/5.6 - f/8 sharp across frame, zero fisheye distortion',
      film_sim_or_color_science: 'Natural editorial photography, soft contrast, warm highlights, deep natural shadows, neutral color science',
      perspective: 'Eye-level straight-on architectural interior perspective with subtle 30-degree angles to reveal spatial depth'
    },
    provenance: {
      created_at: new Date().toISOString(),
      engine_version: 'HOUSE_IDENTITY_V1.1',
      policy: 'PHOTO_FIRST'
    }
  };
}

/**
 * Compiles a House Identity Profile into positive prompt injection tokens for Budi.
 */
export function compileHouseIdentityToPromptTokens(profile: HouseIdentityProfile): string {
  const parts: string[] = [
    `ARCHITECTURAL STYLE: ${profile.architectural_style}.`,
    `SPATIAL CONTEXT: ${profile.room_topology}.`,
    `MATERIAL PALETTE: ${profile.material_palette.join('; ')}.`,
    `WALL FINISH & COLOR: ${profile.wall_colors}.`,
    `DOOR / FRAME DETAILS: ${profile.frame_window_identity}.`,
    `KEY SPATIAL FIXTURES: ${profile.fixed_spatial_landmarks.join('; ')}.`,
    `LIGHTING: ${profile.lighting_mood}.`,
    `TROPICAL BUILDING REALISM: ${profile.tropical_climate_features.join('; ')}.`,
    `CAMERA SPECIFICATION: ${profile.camera_language.lens_character}, ${profile.camera_language.perspective}, ${profile.camera_language.film_sim_or_color_science}.`
  ];

  if (profile.reference_image_id) {
    parts.push(`SAME HOUSE CONTINUITY: Must precisely match reference scene ${profile.reference_image_id} in cabinetry, wall finish, countertop stone, and room geometry.`);
  }

  return parts.join('\n');
}

/**
 * Compiles negative constraints enforced by the House Identity Profile.
 */
export function compileNegativeTokensFromHouseIdentity(profile: HouseIdentityProfile): string[] {
  return [
    'different kitchen cabinetry',
    'changing wall colors',
    'different countertop material',
    'inconsistent kitchen layout',
    'random window appearing on interior wall',
    'western farmhouse style kitchen',
    'luxury mansion scale',
    'cgi gloss rendering',
    'oversaturated colors',
    'floating cabinets without support',
    'text',
    'watermark',
    'price tags',
    'currency symbols',
    'before and after split screen text'
  ];
}
