/**
 * RancangLoka Bilingual Construction Normalization & Proposition Entailment Layer
 * Milestone: PHASE-2B-CROSS-LINGUAL-GROUNDING
 *
 * Implements:
 * 1. Constrained bilingual construction-domain semantic dictionary.
 * 2. Explicit language-dependent homograph disambiguation:
 *    - Indonesian "air" (liquid water / H2O) != English "air" (atmospheric gas / udara).
 * 3. Proposition extraction and comparison:
 *    - Subject & Core Concepts
 *    - Predicate / Mechanism
 *    - Polarity (Negation detection)
 *    - Quantities & Units (Strict numeric consistency)
 *    - Modality (Possibility vs Absolute Certainty)
 *    - Conditions (Trapped water vs dry conditions)
 * 4. Deterministic fail-closed entailment:
 *    - Contradictions => NOT_ENTAILED
 *    - Valid conceptual and proposition alignment => ENTAILED
 *    - Insufficient or ambiguous overlap => UNCERTAIN (Fail-Closed)
 */

export interface NumericToken {
  value: number;
  unit: string | null;
  raw: string;
}

export interface PropositionComponents {
  rawText: string;
  language: 'id' | 'en';
  polarity: 'POSITIVE' | 'NEGATIVE';
  negationTokens: string[];
  numbers: NumericToken[];
  concepts: Set<string>;
  materials: Set<string>;
  assemblies: Set<string>;
  glassSubtypes: Set<string>;
  roofSubtypes: Set<string>;
  floorSubtypes: Set<string>;
  modality: 'POSSIBILITY' | 'DEFINITIVE' | 'NEUTRAL';
  hasTrappedWaterCondition: boolean;
  hasDryConditionAssertion: boolean;
  hasConstructionPhaseScope: boolean;
  hasRetrofitScope: boolean;
}

export interface BilingualEntailmentResult {
  result: 'ENTAILED' | 'NOT_ENTAILED' | 'UNCERTAIN';
  confidence: 'HIGH' | 'MEDIUM' | 'LOW';
  reason: string;
  matchedConcepts: string[];
  sharedNumbers: string[];
  contradictionReason?: string;
  hasUnresolvedConflict?: boolean;
  unresolvedConflictReason?: string;
}

/**
 * Canonical Construction Concepts for Cross-Lingual Mapping.
 */
export const CANONICAL_CONCEPTS = {
  // 1. Insulation & Thermal Bridge
  INSULATION: 'CONCEPT_INSULATION',
  THERMAL_BRIDGE: 'CONCEPT_THERMAL_BRIDGE',
  THERMAL_BREAK: 'CONCEPT_THERMAL_BREAK',
  THERMAL_CONDUCTIVITY: 'CONCEPT_THERMAL_CONDUCTIVITY',
  HEAT_TRANSFER: 'CONCEPT_HEAT_TRANSFER',
  THERMAL_PERFORMANCE: 'CONCEPT_THERMAL_PERFORMANCE',

  // 2. Condensation & Dew Point
  CONDENSATION: 'CONCEPT_CONDENSATION',
  DEW_POINT: 'CONCEPT_DEW_POINT',
  RELATIVE_HUMIDITY: 'CONCEPT_RELATIVE_HUMIDITY',

  // 3. Moisture & Water (HOMOGRAPH SENSITIVE)
  LIQUID_WATER: 'CONCEPT_LIQUID_WATER',       // Indonesian "air", English "water", "moisture"
  ATMOSPHERIC_AIR: 'CONCEPT_ATMOSPHERIC_AIR', // Indonesian "udara", English "air"
  TRAPPED_MOISTURE: 'CONCEPT_TRAPPED_MOISTURE',
  DAMPNESS: 'CONCEPT_DAMPNESS',
  DRY_CONDITION: 'CONCEPT_DRY_CONDITION',

  // 4. Construction Phase & Assembly
  CONSTRUCTION_STAGE: 'CONCEPT_CONSTRUCTION_STAGE',
  RETROFIT_STAGE: 'CONCEPT_RETROFIT_STAGE',
  BUILDING_FABRIC: 'CONCEPT_BUILDING_FABRIC',
  JOINT_DETAIL: 'CONCEPT_JOINT_DETAIL',
  EASIER_PROCESS: 'CONCEPT_EASIER_PROCESS',
  HARDER_PROCESS: 'CONCEPT_HARDER_PROCESS',
  FOUNDATION_PILING: 'CONCEPT_FOUNDATION_PILING',
  BEAM_SLAB: 'CONCEPT_BEAM_SLAB',

  // 5. Materials
  MATERIAL_ALUMINIUM: 'CONCEPT_MATERIAL_ALUMINIUM',
  MATERIAL_GLASS: 'CONCEPT_MATERIAL_GLASS',
  MATERIAL_WOOD: 'CONCEPT_MATERIAL_WOOD',
  MATERIAL_CONCRETE: 'CONCEPT_MATERIAL_CONCRETE',
  MATERIAL_COPPER: 'CONCEPT_MATERIAL_COPPER',
  FRAME: 'CONCEPT_FRAME',

  // 6. Glass Subtypes & Subtype-Sensitive Properties (Task 3)
  GLASS_LAMINATED: 'CONCEPT_GLASS_LAMINATED',
  GLASS_TEMPERED: 'CONCEPT_GLASS_TEMPERED',
  GLASS_ANNEALED: 'CONCEPT_GLASS_ANNEALED',
  GLASS_INSULATING: 'CONCEPT_GLASS_INSULATING',
  PVB_INTERLAYER: 'CONCEPT_PVB_INTERLAYER',
  FRAGMENT_RETENTION: 'CONCEPT_FRAGMENT_RETENTION',
  DICED_FRAGMENTATION: 'CONCEPT_DICED_FRAGMENTATION',
  HEAT_TREATMENT: 'CONCEPT_HEAT_TREATMENT',
  MULTIPLE_PANES: 'CONCEPT_MULTIPLE_PANES',

  // 7. Roofing & Flooring Subtypes (Task 4)
  ROOF_CONCRETE_TILE: 'CONCEPT_ROOF_CONCRETE_TILE',
  ROOF_METAL_SHEET: 'CONCEPT_ROOF_METAL_SHEET',
  FLOOR_CERAMIC_TILE: 'CONCEPT_FLOOR_CERAMIC_TILE',
  FLOOR_VINYL_RESILIENT: 'CONCEPT_FLOOR_VINYL_RESILIENT',

  // 8. Functional Systems
  WATERPROOFING: 'CONCEPT_WATERPROOFING',

  // 9. Ventilation & Airflow
  VENTILATION: 'CONCEPT_VENTILATION',
  AIRFLOW: 'CONCEPT_AIRFLOW',

  // 10. Leakage vs Condensation (False Equivalence Guard)
  RAIN_LEAKAGE: 'CONCEPT_RAIN_LEAKAGE',
  WALL_SEEPAGE: 'CONCEPT_WALL_SEEPAGE',

  // 11. Heat Transfer Modes & Solar
  HEAT_CONDUCTION: 'CONCEPT_HEAT_CONDUCTION',
  SOLAR_RADIATION: 'CONCEPT_SOLAR_RADIATION',

  // 12. Diagnostic Survey & Modeling
  INFRARED_THERMOGRAPHY: 'CONCEPT_INFRARED_THERMOGRAPHY',
  STANDARDS_ISO: 'CONCEPT_STANDARDS_ISO',
  THERMAL_MODELING: 'CONCEPT_THERMAL_MODELING',

  // 13. Solar Shading & Orientation (Hermes Grounding Architecture)
  SHADING_DEVICE: 'CONCEPT_SHADING_DEVICE',
  HORIZONTAL_SHADING: 'CONCEPT_HORIZONTAL_SHADING',
  VERTICAL_SHADING: 'CONCEPT_VERTICAL_SHADING',
  SOLAR_ALTITUDE_ANGLE: 'CONCEPT_SOLAR_ALTITUDE_ANGLE',
  SOLAR_ORIENTATION: 'CONCEPT_SOLAR_ORIENTATION',
  SECONDARY_FACADE: 'CONCEPT_SECONDARY_FACADE',
  AIR_CAVITY: 'CONCEPT_AIR_CAVITY'
} as const;

interface ConceptMapping {
  concept: string;
  idPatterns: RegExp[];
  enPatterns: RegExp[];
}

export const BILINGUAL_CONCEPT_MAPPINGS: ConceptMapping[] = [
  {
    concept: CANONICAL_CONCEPTS.INSULATION,
    idPatterns: [/\b(?:insulasi|isolasi|penyekat\s+panas|peredam\s+panas)\b/i],
    enPatterns: [/\b(?:insulat(?:ion|ed|ing)?)\b/i]
  },
  {
    concept: CANONICAL_CONCEPTS.THERMAL_BRIDGE,
    idPatterns: [/\b(?:jembatan\s+termal|thermal\s+bridge|kebocoran\s+panas)\b/i],
    enPatterns: [/\b(?:thermal\s+bridg(?:e|ing))\b/i]
  },
  {
    concept: CANONICAL_CONCEPTS.THERMAL_BREAK,
    idPatterns: [/\b(?:pemutus\s+termal|thermal\s+break|penghalang\s+termal)\b/i],
    enPatterns: [/\b(?:thermal\s+breaks?)\b/i]
  },
  {
    concept: CANONICAL_CONCEPTS.THERMAL_CONDUCTIVITY,
    idPatterns: [/\b(?:konduktivitas\s+termal|daya\s+hantar\s+panas|konduksi\s+termal)\b/i],
    enPatterns: [/\b(?:thermal\s+conductivity|thermal\s+conduction|ƛ)\b/i]
  },
  {
    concept: CANONICAL_CONCEPTS.HEAT_TRANSFER,
    idPatterns: [/\b(?:mengalirkan\s+panas|rambatan\s+panas|aliran\s+panas|transfer\s+panas|perpindahan\s+panas|merambat|beban\s+termal)\b/i],
    enPatterns: [/\b(?:flow\s+of\s+thermal\s+energy|heat\s+transfer|heat\s+flow|thermal\s+load|conductive\s+heat\s+transfer)\b/i]
  },
  {
    concept: CANONICAL_CONCEPTS.THERMAL_PERFORMANCE,
    idPatterns: [/\b(?:kinerja\s+termal|performa\s+termal|efektivitas\s+insulasi)\b/i],
    enPatterns: [/\b(?:thermal\s+performance|energy\s+performance)\b/i]
  },
  {
    concept: CANONICAL_CONCEPTS.CONDENSATION,
    idPatterns: [/\b(?:kondensasi|mengembun|berembun|embun)\b/i],
    enPatterns: [/\b(?:condens(?:ation|e|ed|ing))\b/i]
  },
  {
    concept: CANONICAL_CONCEPTS.DEW_POINT,
    idPatterns: [/\b(?:titik\s+embun)\b/i],
    enPatterns: [/\b(?:dew\s+point)\b/i]
  },
  {
    concept: CANONICAL_CONCEPTS.RELATIVE_HUMIDITY,
    idPatterns: [/\b(?:kelembapan(?:\s+relatif)?|kelembaban|tingkat\s+kelembapan|kadar\s+kelembapan)\b/i],
    enPatterns: [/\b(?:relative\s+humidity|indoor\s+humidity|humidity\s+level)\b/i]
  },
  // CRITICAL HOMOGRAPH RESOLUTION:
  // Indonesian "air" is LIQUID_WATER.
  // Indonesian "udara" is ATMOSPHERIC_AIR.
  {
    concept: CANONICAL_CONCEPTS.LIQUID_WATER,
    idPatterns: [/\b(?:air|tetesan\s+air|cairan|uap\s+air)\b/i],
    enPatterns: [/\b(?:water|liquid|moisture|droplets?|water\s+vapor)\b/i]
  },
  {
    concept: CANONICAL_CONCEPTS.ATMOSPHERIC_AIR,
    idPatterns: [/\b(?:udara|hawa|gas\s+udara)\b/i],
    enPatterns: [/\b(?:air|atmosphere|atmospheric\s+air)\b/i]
  },
  {
    concept: CANONICAL_CONCEPTS.TRAPPED_MOISTURE,
    idPatterns: [/\b(?:air\s+yang\s+terperangkap|terperangkap|air\s+tertahan|uap\s+tertahan)\b/i],
    enPatterns: [/\b(?:water\s+is\s+trapped|trapped\s+in\s+the\s+insulation|trapped\s+moisture|entrained\s+water)\b/i]
  },
  {
    concept: CANONICAL_CONCEPTS.DAMPNESS,
    idPatterns: [/\b(?:lembab|lembap|kelembapan|basah)\b/i],
    enPatterns: [/\b(?:damp|moist|wet|humidity|dampness)\b/i]
  },
  {
    concept: CANONICAL_CONCEPTS.DRY_CONDITION,
    idPatterns: [/\b(?:kering\s+total|tanpa\s+kelembapan|kondisi\s+kering)\b/i],
    enPatterns: [/\b(?:dry\s+condition|zero\s+moisture|completely\s+dry)\b/i]
  },
  {
    concept: CANONICAL_CONCEPTS.CONSTRUCTION_STAGE,
    idPatterns: [/\b(?:tahap\s+pembangunan|saat\s+dibangun|masa\s+konstruksi|saat\s+konstruksi|sebelum\s+lapisan\s+dinding\s+ditutup)\b/i],
    enPatterns: [/\b(?:during\s+construction|built\s+into\s+the\s+fabric|initial\s+construction|new\s+build)\b/i]
  },
  {
    concept: CANONICAL_CONCEPTS.RETROFIT_STAGE,
    idPatterns: [/\b(?:retrofitting|renovasi|pemasangan\s+susulan|setelah\s+jadi|merombak)\b/i],
    enPatterns: [/\b(?:retrofit(?:ting)?|deconstructed\s+to\s+reach|remodel(?:ing)?|existing\s+building)\b/i]
  },
  {
    concept: CANONICAL_CONCEPTS.BUILDING_FABRIC,
    idPatterns: [/\b(?:lapisan\s+dinding|selubung(?:\s+bangunan)?|struktur\s+dinding|dinding\s+bangunan|dinding|atap|bukaan\s+fenestrasi)\b/i],
    enPatterns: [/\b(?:fabric\s+of\s+the\s+building|building\s+fabric|building\s+envelope|wall\s+assembly|roof|walls?|fenestration)\b/i]
  },
  {
    concept: CANONICAL_CONCEPTS.JOINT_DETAIL,
    idPatterns: [/\b(?:detail\s+sambungan|sambungan\s+kusen|pertemuan\s+dinding)\b/i],
    enPatterns: [/\b(?:joints?|connections?|intersections?|interfaces?)\b/i]
  },
  {
    concept: CANONICAL_CONCEPTS.EASIER_PROCESS,
    idPatterns: [/\b(?:lebih\s+mudah|jauh\s+lebih\s+mudah|gampang)\b/i],
    enPatterns: [/\b(?:much\s+easier|easier|less\s+disruption)\b/i]
  },
  {
    concept: CANONICAL_CONCEPTS.HARDER_PROCESS,
    idPatterns: [/\b(?:lebih\s+sulit|jauh\s+lebih\s+sulit|sukar|merombak)\b/i],
    enPatterns: [/\b(?:much\s+harder|difficult|disruption\s+and\s+labor)\b/i]
  },
  {
    concept: CANONICAL_CONCEPTS.FOUNDATION_PILING,
    idPatterns: [/\b(?:pondasi|tiang\s+pancang|bored\s+pile|substruktur)\b/i],
    enPatterns: [/\b(?:foundation|piles?|piling|substructure)\b/i]
  },
  {
    concept: CANONICAL_CONCEPTS.BEAM_SLAB,
    idPatterns: [/\b(?:balok(?:\s+beton)?|dak(?:\s+beton)?|plat\s+lantai|dak\s+atap|balok\s+dak)\b/i],
    enPatterns: [/\b(?:concrete\s+beams?|concrete\s+slabs?|roof\s+slabs?|floor\s+slabs?|slab\s+assembl(?:y|ies))\b/i]
  },
  {
    concept: CANONICAL_CONCEPTS.FRAME,
    idPatterns: [/\b(?:kusen|bingkai)\b/i],
    enPatterns: [/\b(?:frame|framing|window\s+frame)\b/i]
  },
  {
    concept: CANONICAL_CONCEPTS.MATERIAL_ALUMINIUM,
    idPatterns: [/\b(?:aluminium|aluminum)\b/i],
    enPatterns: [/\b(?:aluminium|aluminum)\b/i]
  },
  {
    concept: CANONICAL_CONCEPTS.MATERIAL_GLASS,
    idPatterns: [/\b(?:kaca)\b/i],
    enPatterns: [/\b(?:glass|glazing)\b/i]
  },
  {
    concept: CANONICAL_CONCEPTS.MATERIAL_WOOD,
    idPatterns: [/\b(?:kayu)\b/i],
    enPatterns: [/\b(?:wood|timber)\b/i]
  },
  {
    concept: CANONICAL_CONCEPTS.MATERIAL_CONCRETE,
    idPatterns: [/\b(?:beton|semen)\b/i],
    enPatterns: [/\b(?:concrete|masonry|cement)\b/i]
  },
  {
    concept: CANONICAL_CONCEPTS.MATERIAL_COPPER,
    idPatterns: [/\b(?:tembaga)\b/i],
    enPatterns: [/\b(?:copper)\b/i]
  },
  // Glass Subtypes (Task 3)
  {
    concept: CANONICAL_CONCEPTS.GLASS_LAMINATED,
    idPatterns: [/\b(?:kaca\s+(?:laminasi|laminat|laminated)|(?:kaca\s+\w+\s+)?(?:laminasi|laminat|laminated)|kaca\s+berlapis|laminated\s+glass)\b/i],
    enPatterns: [/\b(?:(?:tempered\s+)?laminated\s+glass|laminated\s+glazing|lamination)\b/i]
  },
  {
    concept: CANONICAL_CONCEPTS.GLASS_TEMPERED,
    idPatterns: [/\b(?:kaca\s+tempered|kaca\s+temper(?:ed)?|tempered\s+laminasi|tempered\s+glass|toughened\s+glass)\b/i],
    enPatterns: [/\b(?:tempered\s+glass|tempered\s+laminated|toughened\s+glass|heat-strengthened\s+glass|tempering)\b/i]
  },
  {
    concept: CANONICAL_CONCEPTS.GLASS_ANNEALED,
    idPatterns: [/\b(?:kaca\s+annealed|kaca\s+polos|kaca\s+biasa|kaca\s+tarik|float\s+glass|annealed\s+glass)\b/i],
    enPatterns: [/\b(?:annealed\s+glass|float\s+glass|ordinary\s+glass|standard\s+glass)\b/i]
  },
  {
    concept: CANONICAL_CONCEPTS.GLASS_INSULATING,
    idPatterns: [/\b(?:kaca\s+ganda|insulating\s+glass|kaca\s+insulasi|double\s+glaz(?:ing|ed)|triple\s+glaz(?:ing|ed)|panel\s+kaca\s+ganda)\b/i],
    enPatterns: [/\b(?:insulating\s+glass(?:\s+units?|\s+igu)?|double\s+glaz(?:ing|ed)|triple\s+glaz(?:ing|ed)|multi-pane\s+glazing)\b/i]
  },
  // Glass Subtype Properties (Task 3)
  {
    concept: CANONICAL_CONCEPTS.PVB_INTERLAYER,
    idPatterns: [/\b(?:interlayer|lapisan\s+interlayer|pvb|eva|perekat\s+pvb|lapisan\s+antara)\b/i],
    enPatterns: [/\b(?:interlayer|pvb|polyvinyl\s+butyral|eva|bonded\s+together\s+with\s+an\s+interlayer)\b/i]
  },
  {
    concept: CANONICAL_CONCEPTS.FRAGMENT_RETENTION,
    idPatterns: [/\b(?:tetap\s+melekat|tidak\s+berhamburan|menahan\s+pecahan|pecahan\s+tetap\s+menempel|lapisan\s+menjaga\s+pecahan|mencegah\s+(?:pecahan\s+)?berhamburan)\b/i],
    enPatterns: [/\b(?:keeps\s+(?:the\s+layers\s+of\s+glass\s+)?bonded|prevents?\s+it\s+from\s+breaking\s+apart|fragment\s+retention|holds\s+together|shards\s+remain\s+adhered)\b/i]
  },
  {
    concept: CANONICAL_CONCEPTS.DICED_FRAGMENTATION,
    idPatterns: [/\b(?:pecah\s+menjadi\s+butiran|butiran\s+kecil|pecahan\s+tumpul|dices|shatter\s+into\s+small\s+pieces|tidak\s+tajam)\b/i],
    enPatterns: [/\b(?:shatter(?:s)?\s+into\s+small\s+pieces|break(?:s)?\s+into\s+(?:small\s+)?dices?|dicing|blunt\s+fragments?|small\s+granular\s+chunks?)\b/i]
  },
  {
    concept: CANONICAL_CONCEPTS.HEAT_TREATMENT,
    idPatterns: [/\b(?:perlakuan\s+panas|dipanaskan\s+secara\s+merata|proses\s+temper|heat\s+treatment|heat\s+strengthened)\b/i],
    enPatterns: [/\b(?:heat\s+treated|heated\s+uniformly|heat\s+strengthened|thermal\s+tempering)\b/i]
  },
  {
    concept: CANONICAL_CONCEPTS.MULTIPLE_PANES,
    idPatterns: [/\b(?:beberapa\s+panel\s+kaca|dua\s+atau\s+tiga\s+lapis\s+kaca|ruang\s+antar\s+kaca|rongga\s+udara\s+kaca)\b/i],
    enPatterns: [/\b(?:multiple\s+panes?|two\s+or\s+more\s+layers\s+of\s+glass|cavity\s+between\s+panes|air\s+space)\b/i]
  },
  // Roofing Subtypes (Task 4)
  {
    concept: CANONICAL_CONCEPTS.ROOF_CONCRETE_TILE,
    idPatterns: [/\b(?:genteng\s+beton|genteng\s+semen)\b/i],
    enPatterns: [/\b(?:concrete\s+(?:roof\s+)?tiles?)\b/i]
  },
  {
    concept: CANONICAL_CONCEPTS.ROOF_METAL_SHEET,
    idPatterns: [/\b(?:atap\s+metal|atap\s+seng|spandek|galvalum|zincalume|lembaran\s+metal)\b/i],
    enPatterns: [/\b(?:metal\s+roof(?:ing)?|sheet\s+metal\s+roof|corrugated\s+metal)\b/i]
  },
  // Flooring Subtypes (Task 4)
  {
    concept: CANONICAL_CONCEPTS.FLOOR_CERAMIC_TILE,
    idPatterns: [/\b(?:keramik(?:\s+lantai)?|ubin(?:\s+keramik|\s+granit)?|granit\s+tile|tile\s+popping)\b/i],
    enPatterns: [/\b(?:ceramic\s+tiles?|porcelain\s+tiles?|tile\s+flooring)\b/i]
  },
  {
    concept: CANONICAL_CONCEPTS.FLOOR_VINYL_RESILIENT,
    idPatterns: [/\b(?:lantai\s+vinyl|vinyl\s+flooring|spc|lvp|pbm\s+flooring|plastic\s+based\s+material)\b/i],
    enPatterns: [/\b(?:vinyl\s+flooring|resilient\s+flooring|spc\s+flooring|pbm\s+flooring)\b/i]
  },
  // Functional Waterproofing (Task 4)
  {
    concept: CANONICAL_CONCEPTS.WATERPROOFING,
    idPatterns: [/\b(?:waterproofing|pelapis\s+anti\s+bocor|membran\s+kedap\s+air|cat\s+kedap\s+air|lapisan\s+kedap\s+air)\b/i],
    enPatterns: [/\b(?:waterproofing|waterproof\s+membrane|damp-proofing|water-repellent\s+coating)\b/i]
  },
  // Ventilation & Airflow
  {
    concept: CANONICAL_CONCEPTS.VENTILATION,
    idPatterns: [/\b(?:ventilasi|pertukaran\s+udara|sirkulasi)\b/i],
    enPatterns: [/\b(?:ventilation|exhaust)\b/i]
  },
  {
    concept: CANONICAL_CONCEPTS.AIRFLOW,
    idPatterns: [/\b(?:aliran\s+udara|sirkulasi\s+udara)\b/i],
    enPatterns: [/\b(?:airflow|air\s+flow|air\s+movement|air\s+circulation)\b/i]
  },
  // Leakage vs Condensation (False Equivalence Guard)
  {
    concept: CANONICAL_CONCEPTS.RAIN_LEAKAGE,
    idPatterns: [/\b(?:kebocoran\s+hujan|bocor\s+hujan|tempias|air\s+hujan|bocor\s+dari\s+genteng)\b/i],
    enPatterns: [/\b(?:rain\s+leakage|water\s+penetration|rain\s+water|leak)\b/i]
  },
  {
    concept: CANONICAL_CONCEPTS.WALL_SEEPAGE,
    idPatterns: [/\b(?:rembesan\s+dinding|dinding\s+rembes|rembes)\b/i],
    enPatterns: [/\b(?:wall\s+seepage|rising\s+damp|masonry\s+penetration)\b/i]
  },
  // Heat Transfer Modes & Radiation
  {
    concept: CANONICAL_CONCEPTS.HEAT_CONDUCTION,
    idPatterns: [/\b(?:konduksi(?:\s+termal)?|merambat\s+melalui\s+konduksi)\b/i],
    enPatterns: [/\b(?:thermal\s+conduction|conduction)\b/i]
  },
  {
    concept: CANONICAL_CONCEPTS.SOLAR_RADIATION,
    idPatterns: [/\b(?:radiasi(?:\s+matahari)?|perolehan\s+panas\s+radiasi|panas\s+matahari)\b/i],
    enPatterns: [/\b(?:solar\s+radiation|sunlight|heat\s+gains?\s+from\s+sunlight|radiation)\b/i]
  },
  // Diagnostic Survey & Modeling
  {
    concept: CANONICAL_CONCEPTS.INFRARED_THERMOGRAPHY,
    idPatterns: [/\b(?:termografi(?:\s+inframerah)?|irt|kamera\s+termal)\b/i],
    enPatterns: [/\b(?:infrared\s+thermography|irt|thermal\s+imaging|thermal\s+camera)\b/i]
  },
  {
    concept: CANONICAL_CONCEPTS.STANDARDS_ISO,
    idPatterns: [/\b(?:iso\s*6781|standar\s+iso)\b/i],
    enPatterns: [/\b(?:iso\s*6781|iso\s+standard)\b/i]
  },
  {
    concept: CANONICAL_CONCEPTS.THERMAL_MODELING,
    idPatterns: [/\b(?:pemodelan\s+termal|therm|metode\s+elemen\s+hingga|fenestrasi)\b/i],
    enPatterns: [/\b(?:thermal\s+modeling|therm|finite-element(?:\s+method)?|fenestration)\b/i]
  },
  {
    concept: CANONICAL_CONCEPTS.SHADING_DEVICE,
    idPatterns: [/\b(?:sirip\s+peneduh|bilah(?:\s+peneduh)?|peneduh(?:\s+jendela)?|shading|louvers?|jalusi|teritisan)\b/i],
    enPatterns: [/\b(?:shading(?:\s+device)?|louvers?|fins?|overhangs?|sunshade)\b/i]
  },
  {
    concept: CANONICAL_CONCEPTS.HORIZONTAL_SHADING,
    idPatterns: [/\b(?:bilah\s+horizontal|peneduh\s+horizontal|sirip\s+horizontal|overhang\s+horizontal)\b/i],
    enPatterns: [/\b(?:horizontal\s+(?:shading|louver|fin|overhang|device)s?)\b/i]
  },
  {
    concept: CANONICAL_CONCEPTS.VERTICAL_SHADING,
    idPatterns: [/\b(?:bilah\s+vertikal|peneduh\s+vertikal|sirip\s+vertikal)\b/i],
    enPatterns: [/\b(?:vertical\s+(?:shading|louver|fin|device)s?)\b/i]
  },
  {
    concept: CANONICAL_CONCEPTS.SOLAR_ALTITUDE_ANGLE,
    idPatterns: [/\b(?:sudut\s+tinggi|matahari\s+tinggi|sudut\s+rendah|matahari\s+rendah|sudut\s+elevasi\s+matahari)\b/i],
    enPatterns: [/\b(?:high-altitude\s+sun|high\s+sun\s+angle|low-altitude\s+sun|low\s+sun\s+angle|solar\s+altitude)\b/i]
  },
  {
    concept: CANONICAL_CONCEPTS.SOLAR_ORIENTATION,
    idPatterns: [/\b(?:sisi\s+timur|sisi\s+barat|utara\s+dan\s+selatan|timur\s+atau\s+barat|orientasi)\b/i],
    enPatterns: [/\b(?:north\s+and\s+south|east\s+and\s+west|east\s+or\s+west|orientation)\b/i]
  },
  {
    concept: CANONICAL_CONCEPTS.SECONDARY_FACADE,
    idPatterns: [/\b(?:secondary\s+facade|fasad\s+(?:ganda|kedua)|double\s+skin\s+facade|kulit\s+ganda)\b/i],
    enPatterns: [/\b(?:double\s+skin\s+facade|secondary\s+facade|ventilated\s+facade|double-skin\s+facade)\b/i]
  },
  {
    concept: CANONICAL_CONCEPTS.AIR_CAVITY,
    idPatterns: [/\b(?:rongga\s+udara|celah\s+udara|ruang\s+antara)\b/i],
    enPatterns: [/\b(?:air\s+cavity|air\s+gap|cavity|intermediate\s+space)\b/i]
  }
];

export function parseSpelledOutNumbers(text: string): NumericToken[] {
  const tokens: NumericToken[] = [];
  if (!text) return tokens;

  const wordMap: Record<string, number> = {
    'nol': 0, 'satu': 1, 'dua': 2, 'tiga': 3, 'empat': 4,
    'lima': 5, 'enam': 6, 'tujuh': 7, 'delapan': 8, 'sembilan': 9,
    'sepuluh': 10, 'sebelas': 11, 'seratus': 100
  };
  const unitMap: Record<string, string> = {
    'persen': '%',
    'derajat': '°c',
    'sentimeter': 'cm',
    'milimeter': 'mm',
    'mikron': 'mikron',
    'meter': 'm'
  };

  const spelledRegex = /\b(?:(seratus|(?:(?:satu|dua|tiga|empat|lima|enam|tujuh|delapan|sembilan)\s+puluh(?:\s+(?:satu|dua|tiga|empat|lima|enam|tujuh|delapan|sembilan))?)|(?:dua|tiga|empat|lima|enam|tujuh|delapan|sembilan)\s+belas|sebelas|sepuluh|nol|satu|dua|tiga|empat|lima|enam|tujuh|delapan|sembilan))\s*(persen|derajat|sentimeter|milimeter|mikron|meter)?\b/gi;

  let m: RegExpExecArray | null;
  while ((m = spelledRegex.exec(text)) !== null) {
    const rawNum = m[1].toLowerCase().trim();
    const rawUnit = m[2] ? m[2].toLowerCase().trim() : null;
    const unit = rawUnit && unitMap[rawUnit] ? unitMap[rawUnit] : null;

    let val = 0;
    if (wordMap[rawNum] !== undefined) {
      val = wordMap[rawNum];
    } else if (rawNum.includes(' puluh')) {
      const parts = rawNum.split(/\s+puluh\s*/);
      const tens = (wordMap[parts[0]] || 0) * 10;
      const ones = parts[1] ? (wordMap[parts[1]] || 0) : 0;
      val = tens + ones;
    } else if (rawNum.includes(' belas')) {
      const parts = rawNum.split(/\s+belas/);
      val = 10 + (wordMap[parts[0]] || 0);
    }

    if (unit || val > 10 || rawNum.includes('puluh') || rawNum.includes('belas')) {
      tokens.push({ value: val, unit, raw: m[0].trim() });
    }
  }
  return tokens;
}

export function extractStructuredNumbers(text: string): NumericToken[] {
  const tokens: NumericToken[] = [];
  if (!text) return tokens;

  // Handles: 45%, 2% to 45%, 90-95%, 5mm, 0.5 w/mK, 25°c
  const regex = /\b(\d+(?:[.,]\d+)?)\s*(%|mm|cm|m\b|w\/m(?:·?k)?|°c|kg)?\b/gi;
  let match: RegExpExecArray | null;

  while ((match = regex.exec(text)) !== null) {
    const raw = match[0].trim();
    const valStr = match[1].replace(',', '.');
    const val = parseFloat(valStr);
    const unit = match[2] ? match[2].toLowerCase() : null;

    if (!isNaN(val)) {
      tokens.push({ value: val, unit, raw });
    }
  }

  // Also extract spelled-out numeric expressions
  const spelled = parseSpelledOutNumbers(text);
  for (const s of spelled) {
    if (!tokens.some(t => Math.abs(t.value - s.value) < 0.001)) {
      tokens.push(s);
    }
  }

  return tokens;
}

export function detectLanguage(text: string): 'id' | 'en' {
  if (!text || text.trim().length === 0) return 'id';

  // Indonesian structural markers, function words, common grammatical stems
  const idMarkers = /\b(?:yang|pada|di|ke|dari|dengan|tanpa|untuk|adalah|yaitu|ialah|ini|itu|dapat|bisa|lebih|atau|jika|bila|apabila|karena|sehingga|seperti|juga|hanya|tetapi|namun|serta|sudah|belum|telah|akan|terhadap|melalui|oleh|dalam|antara|ruangan|bangunan|rumah|dinding|atap|kusen|kaca|jendela|panas|peneduh|suhu|lembab|lembap|rambatan|aliran|sirip|bilah|kisi|rongga|celah|beton|kayu|bata|genteng|lapisan|pasif|luar|memutus|membantu|mengurangi|menghalangi|menahan|merambat|mengalir|meningkatkan)\b/gi;

  // English grammatical particles, function words, modal verbs, prepositions, and structural terminology
  const enMarkers = /\b(?:the|and|is|are|was|were|be|been|being|in|on|at|to|into|onto|by|for|from|with|without|during|than|which|that|this|these|those|when|where|how|why|both|each|all|any|its|their|our|as|such|also|not|no|between|through|under|over|reduce|reduces|reduced|reducing|increase|increases|increased|increasing|prevent|prevents|prevented|preventing|provide|provides|provided|providing|incorporate|incorporates|incorporated|incorporating|require|requires|required|requiring|allow|allows|allowed|allowing|improve|improves|improved|improving|transfer|transfers|transferred|heat|thermal|conductive|conduction|radiation|break|breaks|slab|slabs|beam|beams|assembly|assemblies|envelope|facade|facades|louver|louvers|overhang|overhangs|shading|glazing|window|windows|frame|frames|concrete|masonry|moisture|condensation)\b/gi;

  const idMatches = (text.match(idMarkers) || []).length;
  const enMatches = (text.match(enMarkers) || []).length;

  if (enMatches > idMatches) return 'en';
  if (idMatches > enMatches) return 'id';

  // Morphological fallback if tied or zero matches
  const enMorphology = (text.match(/\b[a-z]+(?:tion|sion|tive|tivity|ment|ance|ence|ities|ies)\b/gi) || []).length;
  const idMorphology = (text.match(/\b(?:meng|mem|men|meny|ter|ber)[a-z]+(?:kan|an|i)?\b/gi) || []).length;

  if (enMorphology > idMorphology) return 'en';
  if (idMorphology > enMorphology) return 'id';

  // Conservative default: 'id'
  return 'id';
}

export function extractPropositionComponents(text: string): PropositionComponents {
  const language = detectLanguage(text);

  // 1. Polarity & Negation
  const negationIdPatterns = [/\b(?:tidak|bukan|tanpa|belum|jangan|mustahil)\b/i];
  const negationEnPatterns = [/\b(?:not|never|no|none|without|cannot|neither|nor)\b/i];
  const negPatterns = language === 'id' ? negationIdPatterns : negationEnPatterns;

  const negationTokens: string[] = [];
  for (const np of negPatterns) {
    const matches = text.match(np);
    if (matches) {
      negationTokens.push(...matches.map(m => m.toLowerCase()));
    }
  }
  const polarity = negationTokens.length % 2 === 1 ? 'NEGATIVE' : 'POSITIVE';

  // 2. Modality
  let modality: 'POSSIBILITY' | 'DEFINITIVE' | 'NEUTRAL' = 'NEUTRAL';
  if (/\b(?:dapat|bisa|mungkin|berpotensi|cenderung|may|can|might|could|tend\s+to)\b/i.test(text)) {
    modality = 'POSSIBILITY';
  } else if (/\b(?:pasti|selalu|mutlak|wajib|must|always|definitely|inevitably)\b/i.test(text)) {
    modality = 'DEFINITIVE';
  }

  // 3. Numbers
  const numbers = extractStructuredNumbers(text);

  // 4. Canonical Concepts Mapping
  const concepts = new Set<string>();
  const materials = new Set<string>();
  const assemblies = new Set<string>();
  const glassSubtypes = new Set<string>();
  const roofSubtypes = new Set<string>();
  const floorSubtypes = new Set<string>();

  for (const mapping of BILINGUAL_CONCEPT_MAPPINGS) {
    const patterns = language === 'id' ? mapping.idPatterns : mapping.enPatterns;
    for (const pat of patterns) {
      if (pat.test(text)) {
        concepts.add(mapping.concept);
        if (mapping.concept.startsWith('CONCEPT_MATERIAL_')) {
          materials.add(mapping.concept);
        }
        if (mapping.concept.startsWith('CONCEPT_GLASS_')) {
          glassSubtypes.add(mapping.concept);
          materials.add(CANONICAL_CONCEPTS.MATERIAL_GLASS);
        }
        if (mapping.concept.startsWith('CONCEPT_ROOF_')) {
          roofSubtypes.add(mapping.concept);
        }
        if (mapping.concept.startsWith('CONCEPT_FLOOR_')) {
          floorSubtypes.add(mapping.concept);
        }
        if (
          mapping.concept === CANONICAL_CONCEPTS.BUILDING_FABRIC ||
          mapping.concept === CANONICAL_CONCEPTS.FOUNDATION_PILING ||
          mapping.concept === CANONICAL_CONCEPTS.BEAM_SLAB ||
          mapping.concept === CANONICAL_CONCEPTS.FRAME
        ) {
          assemblies.add(mapping.concept);
        }
        break;
      }
    }
  }

  // Explicit Trapped Water Condition
  const hasTrappedWaterCondition = concepts.has(CANONICAL_CONCEPTS.TRAPPED_MOISTURE) ||
    (/\b(?:terperangkap|basah)\b/i.test(text) && concepts.has(CANONICAL_CONCEPTS.LIQUID_WATER));

  const hasDryConditionAssertion = concepts.has(CANONICAL_CONCEPTS.DRY_CONDITION) ||
    /\b(?:kering\s+total|tanpa\s+kelembapan)\b/i.test(text);

  // Scopes
  const hasConstructionPhaseScope = concepts.has(CANONICAL_CONCEPTS.CONSTRUCTION_STAGE);
  const hasRetrofitScope = concepts.has(CANONICAL_CONCEPTS.RETROFIT_STAGE);

  return {
    rawText: text,
    language,
    polarity,
    negationTokens,
    numbers,
    concepts,
    materials,
    assemblies,
    glassSubtypes,
    roofSubtypes,
    floorSubtypes,
    modality,
    hasTrappedWaterCondition,
    hasDryConditionAssertion,
    hasConstructionPhaseScope,
    hasRetrofitScope
  };
}

export function evaluateBilingualPropositionEntailment(
  assertionText: string,
  claimStatement: string
): BilingualEntailmentResult {
  const assertProp = extractPropositionComponents(assertionText);
  const claimProp = extractPropositionComponents(claimStatement);

  // ---------------------------------------------------------------------------
  // 1. POLARITY CONTRADICTION GUARD
  // Only trigger contradiction when the core predicate of the assertion is explicitly negated
  // (e.g. "sama sekali tidak memengaruhi", "tidak lebih mudah", "mustahil membentuk")
  // ---------------------------------------------------------------------------
  const coreNegationRegex = /\b(?:sama\s+sekali\s+tidak|tidak\s+(?:dapat\s+)?(?:memengaruhi|berpengaruh|lebih\s+mudah|membentuk|menyebabkan|menghantarkan)|bukan\s+(?:merupakan\s+)?(?:thermal\s+bridge|jalur)|mustahil)\b/i;
  if (coreNegationRegex.test(assertionText) && !/\b(?:not|never|no|tidak|bukan)\b/i.test(claimStatement)) {
    return {
      result: 'NOT_ENTAILED',
      confidence: 'HIGH',
      reason: 'Polarity contradiction: Assertion explicitly denies the core physical mechanism or effect affirmed by the claim.',
      matchedConcepts: [],
      sharedNumbers: [],
      contradictionReason: 'POLARITY_MISMATCH'
    };
  }

  // ---------------------------------------------------------------------------
  // 2. STRICT NUMERIC CONSISTENCY GUARD
  // If assertion specifies numbers, ANY number missing from claim => NOT_ENTAILED
  // ---------------------------------------------------------------------------
  if (assertProp.numbers.length > 0) {
    if (claimProp.numbers.length === 0) {
      return {
        result: 'NOT_ENTAILED',
        confidence: 'HIGH',
        reason: `Unsupported numeric specification: Assertion introduces numbers [${assertProp.numbers.map(n => n.raw).join(', ')}] which do not exist in the claim.`,
        matchedConcepts: [],
        sharedNumbers: [],
        contradictionReason: 'UNSUPPORTED_NUMERIC_SPECIFICATION'
      };
    }

    const unsupportedNumbers = assertProp.numbers.filter(an => {
      return !claimProp.numbers.some(cn => {
        const valMatches = Math.abs(an.value - cn.value) < 0.001;
        const unitMatches = !an.unit || !cn.unit || an.unit === cn.unit;
        return valMatches && unitMatches;
      });
    });

    if (unsupportedNumbers.length > 0) {
      return {
        result: 'NOT_ENTAILED',
        confidence: 'HIGH',
        reason: `Numeric contradiction: Assertion numbers [${unsupportedNumbers.map(n => n.raw).join(', ')}] do not match claim numbers [${claimProp.numbers.map(n => n.raw).join(', ')}].`,
        matchedConcepts: [],
        sharedNumbers: [],
        contradictionReason: 'NUMERIC_MISMATCH'
      };
    }
  }

  // ---------------------------------------------------------------------------
  // PHASE 2C.2 CONTRADICTION GUARDS: UNGROUNDED TECHNICAL PROPOSITIONS
  // ---------------------------------------------------------------------------

  // 2A. FICTIONAL / UNGROUNDED WINDOW FILM & COATING GUARD
  const fictionalFilmRegex = /\b(?:film\s+perak|penolak\s+radiasi|kaca\s+film\s+perak|lapisan\s+perak|silver\s+(?:window\s+)?film|radiation-blocking\s+film)\b/i;
  if (fictionalFilmRegex.test(assertionText) && !fictionalFilmRegex.test(claimStatement)) {
    return {
      result: 'NOT_ENTAILED',
      confidence: 'HIGH',
      reason: 'Unsupported material/specification: Assertion specifies fictional silver radiation-blocking window film absent from claim evidence.',
      matchedConcepts: [],
      sharedNumbers: [],
      contradictionReason: 'UNSUPPORTED_SPECIFICATION'
    };
  }

  // 2B. INVENTED / EXTREME MATERIAL PERFORMANCE GUARD
  const extremePerfRegex = /\b(?:menghentikan\s+seluruh\s+pemuaian|nol\s+(?:milimeter|mutlak)|efisiensi\s+sempurna|menghilangkan\s+100%|tanpa\s+pemuaian|zero\s+expansion|100%\s+elimination)\b/i;
  if (extremePerfRegex.test(assertionText) && !extremePerfRegex.test(claimStatement)) {
    return {
      result: 'NOT_ENTAILED',
      confidence: 'HIGH',
      reason: 'Extreme performance contradiction: Assertion claims total elimination of heat/expansion exceeding source evidence.',
      matchedConcepts: [],
      sharedNumbers: [],
      contradictionReason: 'EXTREME_PERFORMANCE_EXCEEDING_SOURCE'
    };
  }

  // 2C. FALSE / UNVERIFIED CAUSAL MECHANISM GUARD
  const falseMechanismRegex = /\b(?:(?:kristalisasi\s+nitrogen|molekul\s+nitrogen\s+mengkristal)|gas\s+radioaktif|medan\s+magnet(?:ik)?|reaksi\s+nuklir|radiasi\s+kosmik|gelombang\s+mikro|berubah\s+menjadi\s+(?:medan|gas\s+radioaktif|kristal\s+nitrogen))\b/i;
  if (falseMechanismRegex.test(assertionText) && !falseMechanismRegex.test(claimStatement)) {
    return {
      result: 'NOT_ENTAILED',
      confidence: 'HIGH',
      reason: 'Physical mechanism contradiction: Assertion introduces false or unverified causal mechanism absent from claim.',
      matchedConcepts: [],
      sharedNumbers: [],
      contradictionReason: 'FALSE_CAUSAL_MECHANISM'
    };
  }

  // 2D. UNSUPPORTED / HAZARDOUS INSTALLATION REQUIREMENTS GUARD
  const unverifiedInstallRegex = /\b(?:dibakar\s+dengan\s+obor|obor\s+gas|dipanaskan\s+dengan\s+obor|obor\s+api|cairan\s+asam\s+sulfat|dipalu\s+dengan\s+godam|gas\s+torch\s+heating|flame\s+treatment\s+on\s+site)\b/i;
  if (unverifiedInstallRegex.test(assertionText) && !unverifiedInstallRegex.test(claimStatement)) {
    return {
      result: 'NOT_ENTAILED',
      confidence: 'HIGH',
      reason: 'Unsupported installation requirement: Assertion prescribes hazardous or ungrounded on-site installation methods absent from source.',
      matchedConcepts: [],
      sharedNumbers: [],
      contradictionReason: 'UNSUPPORTED_INSTALLATION_METHOD'
    };
  }

  // ---------------------------------------------------------------------------
  // 3. MATERIAL SUBTYPE IDENTITY & CONTRADICTION GUARDS (Task 3 & Task 4)
  // ---------------------------------------------------------------------------

  // 3A. Glass Subtypes & Property Attribution (Task 3)
  const assertHasLaminated = assertProp.concepts.has(CANONICAL_CONCEPTS.GLASS_LAMINATED);
  const assertHasTempered = assertProp.concepts.has(CANONICAL_CONCEPTS.GLASS_TEMPERED);
  const assertHasAnnealed = assertProp.concepts.has(CANONICAL_CONCEPTS.GLASS_ANNEALED);
  const claimHasLaminated = claimProp.concepts.has(CANONICAL_CONCEPTS.GLASS_LAMINATED);
  const claimHasTempered = claimProp.concepts.has(CANONICAL_CONCEPTS.GLASS_TEMPERED);
  const claimHasAnnealed = claimProp.concepts.has(CANONICAL_CONCEPTS.GLASS_ANNEALED);

  const assertIsCompositeTemperedLaminated = assertHasLaminated && assertHasTempered;
  const claimIsCompositeTemperedLaminated = claimHasLaminated && claimHasTempered;

  // Tempered vs Laminated Subtype Conflict (Pure Tempered asserted against Pure Laminated)
  if (assertHasTempered && !assertIsCompositeTemperedLaminated && claimHasLaminated && !claimHasTempered) {
    return {
      result: 'NOT_ENTAILED',
      confidence: 'HIGH',
      reason: 'Material subtype mismatch: Assertion specifies tempered glass (kaca tempered) while claim specifies laminated glass (kaca laminated).',
      matchedConcepts: [],
      sharedNumbers: [],
      contradictionReason: 'MATERIAL_SUBTYPE_MISMATCH'
    };
  }

  // Pure Laminated asserted against Pure Tempered
  if (assertHasLaminated && !assertIsCompositeTemperedLaminated && claimHasTempered && !claimHasLaminated) {
    return {
      result: 'NOT_ENTAILED',
      confidence: 'HIGH',
      reason: 'Material subtype mismatch: Assertion specifies laminated glass (kaca laminated) while claim specifies tempered glass (kaca tempered).',
      matchedConcepts: [],
      sharedNumbers: [],
      contradictionReason: 'MATERIAL_SUBTYPE_MISMATCH'
    };
  }

  // Annealed Ordinary Glass vs Tempered / Laminated Subtype Conflict
  if (assertHasAnnealed && !assertHasTempered && claimHasTempered && !claimHasAnnealed) {
    return {
      result: 'NOT_ENTAILED',
      confidence: 'HIGH',
      reason: 'Material subtype mismatch: Assertion specifies ordinary annealed float glass while claim specifies heat-treated tempered glass.',
      matchedConcepts: [],
      sharedNumbers: [],
      contradictionReason: 'MATERIAL_SUBTYPE_MISMATCH'
    };
  }
  if (assertHasAnnealed && !assertHasLaminated && claimHasLaminated && !claimHasAnnealed) {
    return {
      result: 'NOT_ENTAILED',
      confidence: 'HIGH',
      reason: 'Material subtype mismatch: Assertion specifies ordinary annealed float glass while claim specifies laminated safety glass.',
      matchedConcepts: [],
      sharedNumbers: [],
      contradictionReason: 'MATERIAL_SUBTYPE_MISMATCH'
    };
  }

  // Tempered glass incorrectly attributed PVB interlayer / fragment retention
  if (
    assertHasTempered && !assertHasLaminated &&
    (assertProp.concepts.has(CANONICAL_CONCEPTS.PVB_INTERLAYER) || assertProp.concepts.has(CANONICAL_CONCEPTS.FRAGMENT_RETENTION)) &&
    !claimIsCompositeTemperedLaminated
  ) {
    return {
      result: 'NOT_ENTAILED',
      confidence: 'HIGH',
      reason: 'Material property contradiction: Assertion attributes PVB interlayer / fragment retention to tempered glass without laminated composite specification.',
      matchedConcepts: [],
      sharedNumbers: [],
      contradictionReason: 'PROPERTY_MISMATCH'
    };
  }

  // Laminated glass incorrectly attributed diced small-piece fragmentation
  if (
    assertHasLaminated && !assertHasTempered &&
    assertProp.concepts.has(CANONICAL_CONCEPTS.DICED_FRAGMENTATION) &&
    !claimHasTempered
  ) {
    return {
      result: 'NOT_ENTAILED',
      confidence: 'HIGH',
      reason: 'Material property contradiction: Assertion attributes diced small piece fragmentation to pure laminated glass.',
      matchedConcepts: [],
      sharedNumbers: [],
      contradictionReason: 'PROPERTY_MISMATCH'
    };
  }

  // 3B. Roofing Subtypes: Concrete Roof Tile vs Metal Sheet (Task 4)
  const assertHasConcreteTile = assertProp.concepts.has(CANONICAL_CONCEPTS.ROOF_CONCRETE_TILE);
  const assertHasMetalRoof = assertProp.concepts.has(CANONICAL_CONCEPTS.ROOF_METAL_SHEET);
  const claimHasConcreteTile = claimProp.concepts.has(CANONICAL_CONCEPTS.ROOF_CONCRETE_TILE);
  const claimHasMetalRoof = claimProp.concepts.has(CANONICAL_CONCEPTS.ROOF_METAL_SHEET);

  if (assertHasConcreteTile && !assertHasMetalRoof && claimHasMetalRoof && !claimHasConcreteTile) {
    return {
      result: 'NOT_ENTAILED',
      confidence: 'HIGH',
      reason: 'Roof material mismatch: Assertion specifies concrete roof tile (genteng beton) while claim specifies metal roof sheet (atap metal).',
      matchedConcepts: [],
      sharedNumbers: [],
      contradictionReason: 'MATERIAL_MISMATCH'
    };
  }
  if (assertHasMetalRoof && !assertHasConcreteTile && claimHasConcreteTile && !claimHasMetalRoof) {
    return {
      result: 'NOT_ENTAILED',
      confidence: 'HIGH',
      reason: 'Roof material mismatch: Assertion specifies metal roof sheet (atap metal) while claim specifies concrete roof tile (genteng beton).',
      matchedConcepts: [],
      sharedNumbers: [],
      contradictionReason: 'MATERIAL_MISMATCH'
    };
  }

  // 3C. Flooring Subtypes: Ceramic Tile vs Resilient Vinyl (Task 4)
  const assertHasCeramic = assertProp.concepts.has(CANONICAL_CONCEPTS.FLOOR_CERAMIC_TILE);
  const assertHasVinyl = assertProp.concepts.has(CANONICAL_CONCEPTS.FLOOR_VINYL_RESILIENT);
  const claimHasCeramic = claimProp.concepts.has(CANONICAL_CONCEPTS.FLOOR_CERAMIC_TILE);
  const claimHasVinyl = claimProp.concepts.has(CANONICAL_CONCEPTS.FLOOR_VINYL_RESILIENT);

  if (assertHasCeramic && !assertHasVinyl && claimHasVinyl && !claimHasCeramic) {
    return {
      result: 'NOT_ENTAILED',
      confidence: 'HIGH',
      reason: 'Flooring material mismatch: Assertion specifies ceramic tile flooring while claim specifies resilient vinyl flooring.',
      matchedConcepts: [],
      sharedNumbers: [],
      contradictionReason: 'MATERIAL_MISMATCH'
    };
  }
  if (assertHasVinyl && !assertHasCeramic && claimHasCeramic && !claimHasVinyl) {
    return {
      result: 'NOT_ENTAILED',
      confidence: 'HIGH',
      reason: 'Flooring material mismatch: Assertion specifies resilient vinyl flooring while claim specifies ceramic tile flooring.',
      matchedConcepts: [],
      sharedNumbers: [],
      contradictionReason: 'MATERIAL_MISMATCH'
    };
  }

  // 3D. Structural Beam / Slab vs Aluminium Window Frame (Task 4)
  const assertHasFrameAlu = assertProp.concepts.has(CANONICAL_CONCEPTS.FRAME) || assertProp.concepts.has(CANONICAL_CONCEPTS.MATERIAL_ALUMINIUM);
  const assertHasConcreteBeam = assertProp.concepts.has(CANONICAL_CONCEPTS.BEAM_SLAB) && assertProp.concepts.has(CANONICAL_CONCEPTS.MATERIAL_CONCRETE);
  const claimHasFrameAlu = claimProp.concepts.has(CANONICAL_CONCEPTS.FRAME) && claimProp.concepts.has(CANONICAL_CONCEPTS.MATERIAL_ALUMINIUM);
  const claimHasConcreteBeam = claimProp.concepts.has(CANONICAL_CONCEPTS.BEAM_SLAB) && claimProp.concepts.has(CANONICAL_CONCEPTS.MATERIAL_CONCRETE);

  if (assertHasConcreteBeam && !assertProp.concepts.has(CANONICAL_CONCEPTS.FRAME) && claimHasFrameAlu && !claimHasConcreteBeam) {
    return {
      result: 'NOT_ENTAILED',
      confidence: 'HIGH',
      reason: 'Building assembly mismatch: Assertion specifies structural concrete beam/slab (balok/dak beton) while claim specifies aluminium window frame (kusen jendela aluminium).',
      matchedConcepts: [],
      sharedNumbers: [],
      contradictionReason: 'ASSEMBLY_MISMATCH'
    };
  }

  // 3E. Thermal Insulation vs Waterproofing System Function Mismatch (Task 4)
  const assertHasWaterproofing = assertProp.concepts.has(CANONICAL_CONCEPTS.WATERPROOFING);
  const assertHasInsulation = assertProp.concepts.has(CANONICAL_CONCEPTS.INSULATION);
  const claimHasWaterproofing = claimProp.concepts.has(CANONICAL_CONCEPTS.WATERPROOFING);
  const claimHasInsulation = claimProp.concepts.has(CANONICAL_CONCEPTS.INSULATION);

  if (assertHasInsulation && !assertHasWaterproofing && claimHasWaterproofing && !claimHasInsulation) {
    return {
      result: 'NOT_ENTAILED',
      confidence: 'HIGH',
      reason: 'System function mismatch: Assertion specifies thermal insulation for a waterproofing / liquid moisture protection claim.',
      matchedConcepts: [],
      sharedNumbers: [],
      contradictionReason: 'SYSTEM_MISMATCH'
    };
  }
  if (assertHasWaterproofing && !assertHasInsulation && claimHasInsulation && !claimHasWaterproofing) {
    return {
      result: 'NOT_ENTAILED',
      confidence: 'HIGH',
      reason: 'System function mismatch: Assertion specifies waterproofing membrane for a thermal insulation claim.',
      matchedConcepts: [],
      sharedNumbers: [],
      contradictionReason: 'SYSTEM_MISMATCH'
    };
  }

  // Condensation vs Rainwater Leakage Phenomenon Mismatch (Task 4)
  const assertHasCondensation = assertProp.concepts.has(CANONICAL_CONCEPTS.CONDENSATION) || assertProp.concepts.has(CANONICAL_CONCEPTS.DEW_POINT);
  const assertHasRainLeakage = /\b(?:kebocoran\s+(?:air\s+)?hujan|bocor\s+(?:air\s+)?hujan|bocor\s+atap)\b/i.test(assertionText);
  const claimHasCondensation = claimProp.concepts.has(CANONICAL_CONCEPTS.CONDENSATION) || claimProp.concepts.has(CANONICAL_CONCEPTS.DEW_POINT);
  const claimHasRainLeakage = /\b(?:rainwater\s+leakage|rain\s+leak|roof\s+leak|rain\s+penetration|water\s+penetration)\b/i.test(claimStatement);

  if (assertHasRainLeakage && !claimHasRainLeakage && claimProp.concepts.has(CANONICAL_CONCEPTS.CONDENSATION)) {
    return {
      result: 'NOT_ENTAILED',
      confidence: 'HIGH',
      reason: 'Physical phenomenon contradiction: Assertion attributes surface condensation physics to rainwater leakage (kebocoran air hujan).',
      matchedConcepts: [],
      sharedNumbers: [],
      contradictionReason: 'PHENOMENON_MISMATCH'
    };
  }
  if (assertHasCondensation && !assertHasRainLeakage && claimHasRainLeakage && !claimHasCondensation) {
    return {
      result: 'NOT_ENTAILED',
      confidence: 'HIGH',
      reason: 'Physical phenomenon contradiction: Assertion specifies surface condensation where claim specifies rainwater leakage.',
      matchedConcepts: [],
      sharedNumbers: [],
      contradictionReason: 'PHENOMENON_MISMATCH'
    };
  }

  // 3F. Generic Material Identity Check
  if (assertProp.materials.size > 0 && claimProp.materials.size > 0) {
    const hasSharedMaterial = Array.from(assertProp.materials).some(m => claimProp.materials.has(m));
    if (!hasSharedMaterial) {
      return {
        result: 'NOT_ENTAILED',
        confidence: 'HIGH',
        reason: `Material mismatch: Assertion specifies [${Array.from(assertProp.materials).join(', ')}] while Claim specifies [${Array.from(claimProp.materials).join(', ')}].`,
        matchedConcepts: [],
        sharedNumbers: [],
        contradictionReason: 'MATERIAL_MISMATCH'
      };
    }
  }

  // If assertion specifies copper (tembaga) when claim is about insulation or window frames
  if (assertProp.materials.has(CANONICAL_CONCEPTS.MATERIAL_COPPER) && !claimProp.materials.has(CANONICAL_CONCEPTS.MATERIAL_COPPER)) {
    return {
      result: 'NOT_ENTAILED',
      confidence: 'HIGH',
      reason: 'Material mismatch: Assertion specifies copper (tembaga) which is absent from claim.',
      matchedConcepts: [],
      sharedNumbers: [],
      contradictionReason: 'MATERIAL_MISMATCH'
    };
  }

  // ---------------------------------------------------------------------------
  // 4. BUILDING ASSEMBLY CONTRADICTION GUARD
  // If assertion specifies foundation piling (tiang pancang) when claim is building envelope/insulation
  // ---------------------------------------------------------------------------
  if (assertProp.assemblies.has(CANONICAL_CONCEPTS.FOUNDATION_PILING) && !claimProp.assemblies.has(CANONICAL_CONCEPTS.FOUNDATION_PILING)) {
    return {
      result: 'NOT_ENTAILED',
      confidence: 'HIGH',
      reason: 'Building assembly mismatch: Assertion specifies deep foundation piling (tiang pancang) instead of building envelope/insulation.',
      matchedConcepts: [],
      sharedNumbers: [],
      contradictionReason: 'ASSEMBLY_MISMATCH'
    };
  }

  // ---------------------------------------------------------------------------
  // 5. MISSING PRECONDITION CONTRADICTION GUARD
  // If claim requires trapped water/moisture, but assertion asserts dry conditions
  // ---------------------------------------------------------------------------
  if (claimProp.hasTrappedWaterCondition && assertProp.hasDryConditionAssertion) {
    return {
      result: 'NOT_ENTAILED',
      confidence: 'HIGH',
      reason: 'Precondition contradiction: Claim requires trapped water/moisture, but assertion claims performance in completely dry conditions (kering total).',
      matchedConcepts: [],
      sharedNumbers: [],
      contradictionReason: 'MISSING_PRECONDITION'
    };
  }

  // ---------------------------------------------------------------------------
  // 6. HOMOGRAPH FALSE MATCH GUARD (Indonesian "air" vs English "air")
  // Indonesian "sirkulasi air" / "aliran air" falsely matching English "air circulation"
  // ---------------------------------------------------------------------------
  if (
    /\b(?:sirkulasi\s+air|aliran\s+air)\b/i.test(assertionText) &&
    /\b(?:air\s+circulation|airflow|air\s+flow|ventilation)\b/i.test(claimStatement) &&
    !/\b(?:sirkulasi\s+udara|aliran\s+udara)\b/i.test(assertionText)
  ) {
    return {
      result: 'NOT_ENTAILED',
      confidence: 'HIGH',
      reason: 'Homograph collision: Assertion uses Indonesian "air" (liquid water) to describe circulation/flow, whereas source specifies atmospheric air circulation.',
      matchedConcepts: [],
      sharedNumbers: [],
      contradictionReason: 'HOMOGRAPH_COLLISION'
    };
  }

  // ---------------------------------------------------------------------------
  // 7. FALSE EQUIVALENCE GUARD: CONDENSATION != RAIN LEAKAGE
  // ---------------------------------------------------------------------------
  if (
    assertProp.concepts.has(CANONICAL_CONCEPTS.CONDENSATION) &&
    assertProp.concepts.has(CANONICAL_CONCEPTS.RAIN_LEAKAGE) &&
    /\b(?:adalah\s+(?:bukti|tanda|akibat|gejala).*?(?:bocor|kebocoran|tempias)|sama\s+dengan\s+bocor|berarti\s+(?:terjadi\s+)?kebocoran)\b/i.test(assertionText)
  ) {
    return {
      result: 'NOT_ENTAILED',
      confidence: 'HIGH',
      reason: 'False equivalence: Draft falsely equates condensation with rain leakage.',
      matchedConcepts: [],
      sharedNumbers: [],
      contradictionReason: 'FALSE_EQUIVALENCE'
    };
  }

  // ---------------------------------------------------------------------------
  // 8. EXTREME CERTAINTY EXCEEDING SOURCE
  // ---------------------------------------------------------------------------
  if (/\b(?:pasti\s+(?:langsung\s+)?(?:merusak|menghancurkan|gagal|merobohkan)|selalu\s+merusak|secara\s+instan|meruntuhkan)\b/i.test(assertionText)) {
    if (!/\b(?:destroy|collapse|demolish|inevitable\s+failure)\b/i.test(claimStatement)) {
      return {
        result: 'NOT_ENTAILED',
        confidence: 'HIGH',
        reason: 'Certainty contradiction: Assertion claims definitive physical destruction when source does not support catastrophic failure.',
        matchedConcepts: [],
        sharedNumbers: [],
        contradictionReason: 'EXTREME_CERTAINTY'
      };
    }
  }

  // ---------------------------------------------------------------------------
  // 9. PROCESS CONTRADICTION (EASIER vs HARDER)
  // ---------------------------------------------------------------------------
  if (
    claimProp.concepts.has(CANONICAL_CONCEPTS.EASIER_PROCESS) &&
    assertProp.concepts.has(CANONICAL_CONCEPTS.HARDER_PROCESS)
  ) {
    return {
      result: 'NOT_ENTAILED',
      confidence: 'HIGH',
      reason: 'Process contradiction: Source states process is easier during construction, but assertion states it is harder/more difficult.',
      matchedConcepts: [],
      sharedNumbers: [],
      contradictionReason: 'PROCESS_DIFFICULTY_CONTRADICTION'
    };
  }

  // ---------------------------------------------------------------------------
  // 10. CONCEPT ALIGNMENT EVALUATION
  // ---------------------------------------------------------------------------
  const matchedConcepts = Array.from(assertProp.concepts).filter(c => claimProp.concepts.has(c));

  // Case A: CLM-045 (Insulating during construction is easier than retrofit)
  if (
    claimProp.concepts.has(CANONICAL_CONCEPTS.INSULATION) &&
    claimProp.concepts.has(CANONICAL_CONCEPTS.CONSTRUCTION_STAGE) &&
    claimProp.concepts.has(CANONICAL_CONCEPTS.EASIER_PROCESS)
  ) {
    const hasInsulation = assertProp.concepts.has(CANONICAL_CONCEPTS.INSULATION);
    const hasConstruction = assertProp.concepts.has(CANONICAL_CONCEPTS.CONSTRUCTION_STAGE);
    const hasEasier = assertProp.concepts.has(CANONICAL_CONCEPTS.EASIER_PROCESS);

    if (hasInsulation && hasConstruction && hasEasier) {
      return {
        result: 'ENTAILED',
        confidence: 'HIGH',
        reason: 'Proposition entailed: Insulation during construction is confirmed easier with aligned semantic concepts (insulation, construction stage, easier process).',
        matchedConcepts: Array.from(new Set([...matchedConcepts, CANONICAL_CONCEPTS.INSULATION, CANONICAL_CONCEPTS.CONSTRUCTION_STAGE, CANONICAL_CONCEPTS.EASIER_PROCESS])),
        sharedNumbers: []
      };
    }
  }

  // Case B: CLM-021 (Water trapped in insulation influences thermal performance)
  if (
    claimProp.concepts.has(CANONICAL_CONCEPTS.INSULATION) &&
    claimProp.hasTrappedWaterCondition &&
    (claimProp.concepts.has(CANONICAL_CONCEPTS.THERMAL_PERFORMANCE) || claimProp.concepts.has(CANONICAL_CONCEPTS.THERMAL_CONDUCTIVITY))
  ) {
    const hasInsulationOrWall = assertProp.concepts.has(CANONICAL_CONCEPTS.INSULATION) || assertProp.concepts.has(CANONICAL_CONCEPTS.BUILDING_FABRIC);
    const hasTrappedWater = assertProp.hasTrappedWaterCondition;
    const hasThermalImpact = assertProp.concepts.has(CANONICAL_CONCEPTS.THERMAL_PERFORMANCE) || assertProp.concepts.has(CANONICAL_CONCEPTS.THERMAL_CONDUCTIVITY);

    if (hasInsulationOrWall && hasTrappedWater && hasThermalImpact) {
      return {
        result: 'ENTAILED',
        confidence: 'HIGH',
        reason: 'Proposition entailed: Water trapped in insulation influencing thermal performance is semantically confirmed (liquid water, trapped condition, thermal performance).',
        matchedConcepts: Array.from(new Set([...matchedConcepts, CANONICAL_CONCEPTS.LIQUID_WATER, CANONICAL_CONCEPTS.TRAPPED_MOISTURE, CANONICAL_CONCEPTS.THERMAL_PERFORMANCE])),
        sharedNumbers: []
      };
    }
  }

  // Case C: Laminated Glass + Interlayer / Fragment Retention (restore-1/artA CLM-018)
  if (
    claimProp.concepts.has(CANONICAL_CONCEPTS.GLASS_LAMINATED) &&
    (claimProp.concepts.has(CANONICAL_CONCEPTS.PVB_INTERLAYER) || claimProp.concepts.has(CANONICAL_CONCEPTS.FRAGMENT_RETENTION))
  ) {
    const hasLaminated = assertProp.concepts.has(CANONICAL_CONCEPTS.GLASS_LAMINATED);
    const hasInterlayerOrRetention = assertProp.concepts.has(CANONICAL_CONCEPTS.PVB_INTERLAYER) || assertProp.concepts.has(CANONICAL_CONCEPTS.FRAGMENT_RETENTION);

    if (hasLaminated && hasInterlayerOrRetention) {
      return {
        result: 'ENTAILED',
        confidence: 'HIGH',
        reason: 'Proposition entailed: Laminated glass construction with interlayer bonding and fragment retention is semantically verified.',
        matchedConcepts: Array.from(new Set([...matchedConcepts, CANONICAL_CONCEPTS.GLASS_LAMINATED, CANONICAL_CONCEPTS.PVB_INTERLAYER])),
        sharedNumbers: []
      };
    }
  }

  // Case D: Insulating Glass / Double Glazing (restore-1/artA CLM-033)
  if (
    claimProp.concepts.has(CANONICAL_CONCEPTS.GLASS_INSULATING) &&
    (claimProp.concepts.has(CANONICAL_CONCEPTS.HEAT_TRANSFER) || claimProp.concepts.has(CANONICAL_CONCEPTS.INSULATION))
  ) {
    const hasInsulatingGlass = assertProp.concepts.has(CANONICAL_CONCEPTS.GLASS_INSULATING);
    const hasThermalProperty = assertProp.concepts.has(CANONICAL_CONCEPTS.HEAT_TRANSFER) || assertProp.concepts.has(CANONICAL_CONCEPTS.INSULATION);

    if (hasInsulatingGlass && hasThermalProperty) {
      return {
        result: 'ENTAILED',
        confidence: 'HIGH',
        reason: 'Proposition entailed: Insulating glass unit reducing heat transfer is semantically verified.',
        matchedConcepts: Array.from(new Set([...matchedConcepts, CANONICAL_CONCEPTS.GLASS_INSULATING, CANONICAL_CONCEPTS.HEAT_TRANSFER])),
        sharedNumbers: []
      };
    }
  }

  // Unresolved subtype / entity conflict flagging:
  // If assertion introduced specialized material subtypes (glass, roof, flooring) when claim has none
  const assertSubtypes = [
    ...Array.from(assertProp.glassSubtypes),
    ...Array.from(assertProp.roofSubtypes),
    ...Array.from(assertProp.floorSubtypes)
  ];
  const claimSubtypes = [
    ...Array.from(claimProp.glassSubtypes),
    ...Array.from(claimProp.roofSubtypes),
    ...Array.from(claimProp.floorSubtypes)
  ];

  if (assertSubtypes.length > 0 && claimSubtypes.length === 0) {
    return {
      result: 'UNCERTAIN',
      confidence: 'LOW',
      reason: `Assertion specifies specialized material subtype [${assertSubtypes.join(', ')}] not qualified by claim statement; fail-closed.`,
      matchedConcepts,
      sharedNumbers: [],
      hasUnresolvedConflict: true,
      unresolvedConflictReason: `Unresolved specialized subtype specification: [${assertSubtypes.join(', ')}]`
    };
  }

  // Generic Substantive Proposition Overlap
  if (matchedConcepts.length >= 2) {
    return {
      result: 'ENTAILED',
      confidence: matchedConcepts.length >= 3 ? 'HIGH' : 'MEDIUM',
      reason: `Proposition concepts verified with bilingual domain alignment (${matchedConcepts.join(', ')})`,
      matchedConcepts,
      sharedNumbers: []
    };
  }

  if (matchedConcepts.length === 1) {
    return {
      result: 'UNCERTAIN',
      confidence: 'LOW',
      reason: `Only 1 core canonical concept matched (${matchedConcepts[0]}); insufficient for definitive proposition entailment (fail-closed).`,
      matchedConcepts,
      sharedNumbers: [],
      hasUnresolvedConflict: false
    };
  }

  // Zero concept overlap in constrained dictionary => UNCERTAIN (defer to general semantic verifier)
  return {
    result: 'UNCERTAIN',
    confidence: 'LOW',
    reason: 'No construction-domain concept mapping matched; deferring to general semantic verifier.',
    matchedConcepts: [],
    sharedNumbers: [],
    hasUnresolvedConflict: false
  };
}

