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
  cover_scene_lock?: CoverObservedSceneLock;
  provenance: {
    created_at: string;
    engine_version: 'HOUSE_IDENTITY_V1.1' | 'HOUSE_IDENTITY_V1.2';
    policy: 'PHOTO_FIRST';
  };
}

/**
 * Detailed architectural landmarks and equipment locked from the actual accepted Cover photograph.
 */
export interface CoverObservedSceneLock {
  cover_image_id: string;
  cover_image_path?: string;
  cover_image_sha256?: string;
  observed_kitchen_topology: 'U_SHAPE' | 'L_SHAPE' | 'GALLEY' | 'SINGLE_WALL' | 'OPEN_PENINSULA';
  topology_divergence_from_initial: boolean;
  topology_notes: string;
  observed_fixed_appliances: {
    cooktop_type: 'FLAT_GLASS_INDUCTION' | 'FLAT_GLASS_CERAMIC' | 'GAS_TWO_BURNER' | 'GAS_MULTI_BURNER' | 'UNSPECIFIED';
    cooktop_description: string;
    cooktop_location_relative: string;
    hood_type: 'SLIM_STAINLESS_UNDER_CABINET' | 'CHIMNEY_CANOPY' | 'INTEGRATED_HIDDEN';
    hood_description: string;
    hood_location_relative: string;
  };
  observed_cabinetry: {
    lower_cabinets: string;
    upper_cabinets: string;
    countertop: string;
    backsplash: string;
  };
  observed_flooring: string;
  observed_wall_finish: string;
  observed_visible_openings: string;
  unseen_or_unverifiable_areas: string[];
  locked_at: string;
}

/**
 * Synchronizes and locks the initial House Identity Profile with the actual accepted Cover image.
 * Invariant: Never silently pretend an initial profile matches; explicitly record divergence and lock truth.
 */
export function lockHouseIdentityFromCover(
  initialProfile: HouseIdentityProfile,
  coverLock: CoverObservedSceneLock
): HouseIdentityProfile {
  const updatedLandmarks = [
    `Kompor: ${coverLock.observed_fixed_appliances.cooktop_description} (${coverLock.observed_fixed_appliances.cooktop_location_relative})`,
    `Cooker hood: ${coverLock.observed_fixed_appliances.hood_description} (${coverLock.observed_fixed_appliances.hood_location_relative})`,
    `Kabinet: ${coverLock.observed_cabinetry.lower_cabinets} (bawah) dan ${coverLock.observed_cabinetry.upper_cabinets} (atas)`,
    `Meja & Backsplash: ${coverLock.observed_cabinetry.countertop} dan ${coverLock.observed_cabinetry.backsplash}`,
    `Lantai: ${coverLock.observed_flooring}`,
    `Bukaan/Relasi Spasial: ${coverLock.observed_visible_openings}`
  ];

  return {
    ...initialProfile,
    profile_id: `${initialProfile.profile_id}_locked_${coverLock.cover_image_id.slice(-6)}`,
    room_topology: coverLock.topology_notes || `Dapur bentuk ${coverLock.observed_kitchen_topology} sesuai citra cover anchor ${coverLock.cover_image_id}.`,
    wall_colors: coverLock.observed_wall_finish,
    fixed_spatial_landmarks: updatedLandmarks,
    material_palette: [
      coverLock.observed_cabinetry.lower_cabinets,
      coverLock.observed_cabinetry.upper_cabinets,
      coverLock.observed_cabinetry.countertop,
      coverLock.observed_cabinetry.backsplash,
      coverLock.observed_flooring
    ],
    reference_image_id: coverLock.cover_image_id,
    reference_image_url: coverLock.cover_image_path || null,
    cover_scene_lock: coverLock,
    provenance: {
      ...initialProfile.provenance,
      engine_version: 'HOUSE_IDENTITY_V1.2'
    }
  };
}

/**
 * Builds a deterministic House Identity Profile for Article #10011 (Ventilasi Dapur Tanpa Jendela).
 */
export function getKitchenVentilationHouseProfile(
  slug: string = 'ventilasi-dapur-tanpa-jendela',
  title: string = 'Ventilasi Dapur Tanpa Jendela: Solusi Cooker Hood Resirkulasi vs Exhaust Fan Dinding'
): HouseIdentityProfile {
  return {
    profile_id: `hip_kitchen_compact_${(slug || 'default').slice(0, 20)}`,
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

export interface StructuredInlinePromptResult {
  prompt_text: string;
  immutable_tokens: string;
  mutable_tokens: string;
  negative_prompt: string;
  breakdown: {
    immutable: {
      kitchen_topology: string;
      fixed_appliances: string;
      cabinetry_and_countertop: string;
      backsplash_and_walls: string;
      flooring: string;
    };
    mutable: {
      camera_angle: string;
      camera_distance: string;
      lighting_condition: string;
      scene_activity_and_utensils: string;
      temporary_conditions: string;
    };
  };
}

/**
 * Builds a revised Budi prompt with strict separation of IMMUTABLE and MUTABLE elements (POLICY v1.2).
 *
 * IMMUTABLE: Kitchen topology, fixed appliances and their type, cabinet configuration, hood position, materials.
 * MUTABLE: Camera angle, camera distance, focal length, realistic lighting, cooking activity, utensils, steam.
 *
 * Rule: An inline photograph must portray the same physical house, preserving fixed architecture and equipment.
 * Only camera perspective and temporary scene conditions may change.
 */
export function buildStructuredInlinePrompt(
  profile: HouseIdentityProfile,
  options: {
    slot_key: string;
    photo_role: 'problem_condition' | 'relevant_detail' | 'realistic_solution_example';
    camera_angle: string;
    camera_distance: string;
    focal_length?: string;
    scene_activity?: string;
    cooking_utensils?: string;
    temporary_conditions?: string;
    focal_element?: string;
  }
): StructuredInlinePromptResult {
  const lock = profile.cover_scene_lock;

  // 1. IMMUTABLE ELEMENTS
  const topology = lock
    ? `Kitchen topology is strictly ${lock.observed_kitchen_topology}: ${lock.topology_notes}`
    : `Kitchen topology: ${profile.room_topology}`;

  const fixedAppliances = lock
    ? `FIXED APPLIANCES (MUST NOT CHANGE): Cooktop is strictly ${lock.observed_fixed_appliances.cooktop_description} (${lock.observed_fixed_appliances.cooktop_location_relative}). Do NOT replace with gas burner rings or protruding gas grates. Cooker hood is ${lock.observed_fixed_appliances.hood_description} (${lock.observed_fixed_appliances.hood_location_relative}).`
    : `FIXED APPLIANCES: Flat black glass cooktop flush with countertop, slim stainless steel under-cabinet cooker hood.`;

  const cabinetryAndCounter = lock
    ? `CABINETRY & COUNTERTOP (MUST NOT CHANGE): Lower cabinets: ${lock.observed_cabinetry.lower_cabinets}; Upper cabinets: ${lock.observed_cabinetry.upper_cabinets}; Countertop: ${lock.observed_cabinetry.countertop}.`
    : `CABINETRY: Warm teak grain laminate (HPL jati muda) lower cabinets, off-white matte solid surface countertop.`;

  const backsplashAndWalls = lock
    ? `WALLS & BACKSPLASH (MUST NOT CHANGE): Backsplash: ${lock.observed_cabinetry.backsplash}; Wall color: ${lock.observed_wall_finish}.`
    : `WALLS & BACKSPLASH: Vertical cream-white subway tiles, warm greige matte wall paint.`;

  const flooring = lock
    ? `FLOORING: ${lock.observed_flooring}.`
    : `FLOORING: Honed light grey terrazzo tile 60x60cm.`;

  const immutableTokens = [
    `[IMMUTABLE ARCHITECTURE & EQUIPMENT]`,
    topology,
    fixedAppliances,
    cabinetryAndCounter,
    backsplashAndWalls,
    flooring
  ].join('\n');

  // 2. MUTABLE ELEMENTS
  const camAngle = options.camera_angle || 'eye-level architectural view';
  const camDistance = options.camera_distance || 'medium shot';
  const focalLength = options.focal_length || '50mm rectilinear lens, f/5.6';
  const lighting = 'Consistent soft warm diffused tropical residential interior lighting (3000K indirect LED + natural bounce), realistic natural shadows.';
  const activity = options.scene_activity || 'gentle cooking preparation';
  const utensils = options.cooking_utensils || 'single stainless steel pot on cooktop';
  const temporaryConditions = options.temporary_conditions || 'realistic soft cooking steam gently rising from pot into the cooker hood intake';

  const mutableTokens = [
    `[MUTABLE PERSPECTIVE & SCENE CONDITIONS]`,
    `CAMERA ANGLE: ${camAngle}.`,
    `CAMERA DISTANCE & FOCUS: ${camDistance}, ${focalLength}.`,
    `LIGHTING: ${lighting}.`,
    `ACTIVITY & UTENSILS: ${activity}, using ${utensils}.`,
    `TEMPORARY CONDITION: ${temporaryConditions}.`
  ].join('\n');

  // 3. Combined prompt text with explicit reference tag <<<image_1>>>
  const promptParts: string[] = [
    `In the exact same architectural room and cabinetry setting as <<<image_1>>>, maintaining 100% identical fixed appliances and materials.`,
    `${camDistance} ${camAngle} showing ${options.focal_element || 'the cooking and ventilation zone'}.`,
    fixedAppliances,
    cabinetryAndCounter,
    backsplashAndWalls,
    `SCENE DETAILS: ${activity} with ${utensils}, ${temporaryConditions}.`,
    `PHOTOGRAPHIC QUALITY: Hasselblad natural color science, photorealistic architectural editorial photography, crisp woodgrain and stainless steel textures, zero CGI gloss, zero text, zero diagrammatic overlays.`
  ];

  const promptText = promptParts.join(' ');

  // 4. Anti-Drift Negative Prompt
  const antiDriftNegatives = [
    ...compileNegativeTokensFromHouseIdentity(profile),
    'different cooktop type',
    'gas burner rings and grates',
    'protruding gas knobs on cooktop',
    'cast iron pan supports',
    'gas flame',
    'different cooker hood',
    'chimney hood',
    'different cabinet doors',
    'white cabinets',
    'glossy finish',
    'marble countertops',
    'western luxury kitchen',
    'technical diagram',
    'arrows',
    'schematic callouts',
    'labels',
    'watermark',
    'logo'
  ];

  return {
    prompt_text: promptText,
    immutable_tokens: immutableTokens,
    mutable_tokens: mutableTokens,
    negative_prompt: antiDriftNegatives.join(', '),
    breakdown: {
      immutable: {
        kitchen_topology: topology,
        fixed_appliances: fixedAppliances,
        cabinetry_and_countertop: cabinetryAndCounter,
        backsplash_and_walls: backsplashAndWalls,
        flooring
      },
      mutable: {
        camera_angle: camAngle,
        camera_distance: camDistance,
        lighting_condition: lighting,
        scene_activity_and_utensils: `${activity} with ${utensils}`,
        temporary_conditions: temporaryConditions
      }
    }
  };
}

export interface StructuredSeriesPromptResult {
  prompt_text: string;
  negative_prompt: string;
  series_amount: number;
  shot_specifications: Array<{
    shot_number: number;
    shot_role: string;
    description: string;
    camera_angle: string;
    camera_distance: string;
  }>;
}

/**
 * Builds a single coherent prompt for Kling Omni Image Series Mode (3 shots).
 * Enforces strict house identity lock while requiring distinct camera angles.
 */
export function buildStructuredSeriesPrompt(
  profile: HouseIdentityProfile,
  options?: {
    article_title?: string;
  }
): StructuredSeriesPromptResult {
  const coverLock = profile.cover_scene_lock;
  const topology = coverLock?.observed_kitchen_topology || 'U_SHAPE';
  const cooktopDesc = coverLock?.observed_fixed_appliances.cooktop_description || 'Kompor tanam flat flush kaca induksi hitam tanpa tungku gas';
  const hoodDesc = coverLock?.observed_fixed_appliances.hood_description || 'Cooker hood slim stainless steel di bawah kabinet atas';
  const lowerCab = coverLock?.observed_cabinetry.lower_cabinets || 'HPL jati muda matte dengan grain horizontal';
  const upperCab = coverLock?.observed_cabinetry.upper_cabinets || 'Kabinet atas dan rak terbuka putih minimalis';
  const countertop = coverLock?.observed_cabinetry.countertop || 'Solid surface light cream matte';
  const backsplash = coverLock?.observed_cabinetry.backsplash || 'Keramik subway tile putih krem vertikal';
  const flooring = coverLock?.observed_flooring || 'Semen ekspos / teraso honed abu-abu muda';

  const shots = [
    {
      shot_number: 1,
      shot_role: 'cooking_perspective',
      description: 'Side perspective showing cooking conditions. Wide 45-degree angled view looking from dining entrance toward cooking zone. Shows U-shaped counter relation, teak lower cabinets, one stainless steel stock pot on the flat flush black glass induction cooktop with soft gentle steam rising straight up toward the cooker hood intake.',
      camera_angle: 'WIDE_45_DEGREE_ANGLED_PERSPECTIVE',
      camera_distance: 'MEDIUM_WIDE_SHOT'
    },
    {
      shot_number: 2,
      shot_role: 'appliance_detail',
      description: 'Close-up architectural detail of cooker hood and cooktop. Focused tightly on the filtration and cooktop zone: sleek profile of the slim stainless steel under-cabinet cooker hood with aluminum mesh grease filters, mounted directly above the flat flush black induction glass surface. Sharp tactile texture on brushed stainless steel, teak woodgrain, and subway tile grout lines.',
      camera_angle: 'SLIGHT_LOW_ANGLE_UPWARD_DETAIL',
      camera_distance: 'CLOSE_ARCHITECTURAL_DETAIL'
    },
    {
      shot_number: 3,
      shot_role: 'ventilation_solution',
      description: 'Room ventilation perspective showing solution implementation in windowless space. Looking across the preparation counter toward the upper ventilation path and high louvered air-transfer grill. Demonstrates complete airflow and capture solution in compact windowless kitchen, calm balanced residential lighting, spacious architectural dignity.',
      camera_angle: 'BROAD_CONTEXTUAL_PERSPECTIVE',
      camera_distance: 'FULL_SPACE_PERSPECTIVE'
    }
  ];

  const seriesPrompt = [
    `A coherent 3-shot architectural editorial photography series of the exact same compact modern tropical Indonesian home kitchen from <<<image_1>>>, maintaining 100% architectural and material continuity across all panels:`,
    `[IMMUTABLE ARCHITECTURE & EQUIPMENT - ALL 3 SHOTS]`,
    `- Kitchen Layout: Compact ${topology} layout strictly identical to <<<image_1>>>.`,
    `- Fixed Appliances: Cooktop is strictly ${cooktopDesc} flush with countertop (STRICTLY NO gas burners, NO burner rings, NO grates, NO knobs). Cooker hood is ${hoodDesc} mounted under teak cabinet.`,
    `- Materials: Lower cabinets in ${lowerCab}, upper cabinets in ${upperCab}, countertop in ${countertop}, backsplash in ${backsplash}, flooring in ${flooring}.`,
    `- Lighting: Natural warm diffused tropical residential interior lighting (3000K warm-neutral balance), authentic lived-in Indonesian home atmosphere, zero CGI gloss, zero text overlays.`,
    `[PANEL SEQUENCE SPECIFICATIONS]`,
    `SHOT 1 (${shots[0].shot_role}): ${shots[0].description}`,
    `SHOT 2 (${shots[1].shot_role}): ${shots[1].description}`,
    `SHOT 3 (${shots[2].shot_role}): ${shots[2].description}`,
    `PHOTOGRAPHIC STANDARD: Hasselblad medium-format camera, architectural magazine editorial standard, crisp natural textures, authentic depth of field.`
  ].join('\n');

  const negativePrompt = [
    ...compileNegativeTokensFromHouseIdentity(profile),
    'different cooktop type',
    'gas burner rings and grates',
    'protruding gas knobs on cooktop',
    'cast iron pan supports',
    'gas flame',
    'open fire',
    'different cooker hood',
    'chimney hood',
    'white glossy cabinets',
    'marble countertops',
    'western luxury mansion',
    'huge island',
    'random exterior window with bright daylight',
    'duplicate angle',
    'identical cropped zoom without variation',
    'cartoon',
    '3d render',
    'illustration',
    'CGI',
    'technical diagram',
    'arrows',
    'flow lines',
    'schematic callouts',
    'labels',
    'watermark',
    'logo',
    'text overlays'
  ].join(', ');

  return {
    prompt_text: seriesPrompt,
    negative_prompt: negativePrompt,
    series_amount: 3,
    shot_specifications: shots
  };
}
