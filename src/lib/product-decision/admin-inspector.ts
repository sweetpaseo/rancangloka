/**
 * ============================================================================
 * RancangLoka Product Decision Engine (PRODUCT_DECISION_ENGINE-1C)
 * Admin & Editorial Decision Inspection Helper
 *
 * Invariants:
 * 1. SCENARIO_PRESET_IS_CONTEXT_ONLY (Presets populate context; never inject oracle answer).
 * 2. THE_READER_DECISION_IS_PRIMARY (Inspects problem context over product catalogs).
 * 3. NO_COMMERCE_FIELDS (Zero affiliate, commission, price, or merchant fields).
 * 4. NO_FAKE_NUMERIC_PRECISION (Qualitative fit taxonomy only; zero numeric scoring).
 * 5. PURE_EVALUATOR_CONSUMPTION (Calls evaluateDecision directly; no duplicate recommendation logic).
 * 6. EVALUATOR_CRITICAL_CONTEXT_MUST_USE_CONTROLLED_TAXONOMY (All 6 CORE dimensions must use controlled taxonomy).
 * 7. ADMIN_METADATA_MUST_RENDER_MODEL_SOURCE_TRUTH (Metadata strictly reflects model source truth).
 * ============================================================================
 */

import type {
  DecisionContext,
  DecisionModelDefinition,
  BuildingContextId,
  ClimateExposureId,
  ApplicationLocationId,
  BudgetClassId,
  MaintenanceToleranceId,
  ComfortPriorityId,
  BuildPhaseId,
  FitTaxonomy,
  CanonicalClaimClass,
  EvaluationResult,
  EvaluatorOptions
} from './types.ts';
import {
  DECISION_MODEL_PILOT_KUSEN,
  SCENARIOS_PILOT,
  ARTICLE_5_EVIDENCE_BASE
} from './pilot-kusen.ts';
import { evaluateDecision } from './evaluator.ts';
import { scanForForbiddenFields } from './contracts.ts';

export type EvidenceInspectionMode = 'current' | 'drift' | 'unavailable';

export interface ScenarioPresetSummary {
  scenario_id: string;
  title: string;
  expected_solution_id: string;
  expected_fit: FitTaxonomy;
}

/**
 * Human-readable Indonesian labels for qualitative fit taxonomy.
 * Strictly qualitative; no numeric scores or winner badges.
 */
export const FIT_LABELS_ID: Record<FitTaxonomy, { label: string; badgeClass: string; description: string }> = {
  STRONG_FIT: {
    label: 'Sangat Cocok',
    badgeClass: 'bg-emerald-100 text-emerald-800 border-emerald-300',
    description: 'Solusi optimal yang memenuhi seluruh parameter konteks tanpa kompromi signifikan.'
  },
  GOOD_FIT_WITH_TRADEOFF: {
    label: 'Cocok dengan Kompromi',
    badgeClass: 'bg-blue-100 text-blue-800 border-blue-300',
    description: 'Solusi bekerja baik namun menuntut penerimaan trade-off fisik/biaya yang terdefinisi.'
  },
  CONDITIONAL_FIT: {
    label: 'Cocok dengan Syarat',
    badgeClass: 'bg-amber-100 text-amber-800 border-amber-300',
    description: 'Hanya dianjurkan bila syarat mitigasi spesifik terpenuhi di lapangan.'
  },
  POOR_FIT: {
    label: 'Kurang Cocok',
    badgeClass: 'bg-rose-100 text-rose-800 border-rose-300',
    description: 'Tidak dianjurkan karena bertentangan dengan batasan fisik atau tujuan ruang.'
  }
};

/**
 * Indonesian labels for claim classes.
 */
export const CLAIM_CLASS_LABELS_ID: Record<CanonicalClaimClass, { label: string; badgeClass: string }> = {
  VERIFIED_FACT: {
    label: 'Fakta Terverifikasi',
    badgeClass: 'bg-emerald-50 text-emerald-700 border-emerald-200'
  },
  TECHNICAL_CONSENSUS: {
    label: 'Konsensus Teknis',
    badgeClass: 'bg-indigo-50 text-indigo-700 border-indigo-200'
  },
  USER_EXPERIENCE_SIGNAL: {
    label: 'Pengalaman Lapangan',
    badgeClass: 'bg-cyan-50 text-cyan-700 border-cyan-200'
  },
  EDITORIAL_INFERENCE: {
    label: 'Inferensi Editorial',
    badgeClass: 'bg-purple-50 text-purple-700 border-purple-200'
  },
  EDITORIAL_RECOMMENDATION: {
    label: 'Rekomendasi Redaksi',
    badgeClass: 'bg-blue-50 text-blue-700 border-blue-200'
  }
};

/**
 * Indonesian display labels for solution classes.
 */
export const SOLUTION_LABELS_ID: Record<string, string> = {
  sol_aluminium_standar: 'Kusen Aluminium Arsitektural',
  sol_upvc_multi_chamber: 'Kusen uPVC Multi-Chamber'
};

/**
 * Controlled taxonomy for problem_goal dimension.
 * Invariant: EVALUATOR_CRITICAL_CONTEXT_MUST_USE_CONTROLLED_TAXONOMY.
 * Derived directly from authoritative model scenarios.
 */
export const PROBLEM_GOAL_OPTIONS: Array<{ value: string; label: string }> = DECISION_MODEL_PILOT_KUSEN.scenarios.map(sc => ({
  value: sc.context.problem_goal,
  label: sc.context.problem_goal
}));

export const ALLOWED_PROBLEM_GOALS = new Set<string>(
  PROBLEM_GOAL_OPTIONS.map(opt => opt.value)
);

/**
 * Indonesian options for the remaining 5 CORE dimensions taxonomy.
 */
export const BUILDING_CONTEXT_OPTIONS: Array<{ value: BuildingContextId; label: string; description: string }> = [
  { value: 'SINGLE_STORY_HOUSE', label: 'Rumah Tapak 1 Lantai', description: 'Paparan angin standar, akses mudah' },
  { value: 'MULTI_STORY_HOUSE', label: 'Rumah Bertingkat (2+ Lantai)', description: 'Beban angin lantai atas lebih tinggi' },
  { value: 'CORNER_HOUSE_HOOK', label: 'Rumah Sudut / Hook', description: 'Paparan cuaca dua sisi terbuka' },
  { value: 'ATTACHED_CLUSTER_TOWNHOUSE', label: 'Cluster / Townhouse Dempet', description: 'Bukaan fasad depan dan belakang' }
];

export const ALLOWED_BUILDING_CONTEXTS = new Set<string>(
  BUILDING_CONTEXT_OPTIONS.map(opt => opt.value)
);

export const CLIMATE_EXPOSURE_OPTIONS: Array<{ value: ClimateExposureId; label: string; description: string }> = [
  { value: 'WEST_AFTERNOON_HEAT', label: 'Panas Sore Matahari Barat', description: 'Beban radiasi dan konduksi termal tinggi' },
  { value: 'WIND_DRIVEN_RAIN', label: 'Tempias Hujan Angin Kencang', description: 'Tekanan air tinggi pada sudut sambungan' },
  { value: 'COASTAL_SALT_HUMID', label: 'Pesisir / Udara Lembap Berkadar Garam', description: 'Risiko korosi logam dan erosi sealant' },
  { value: 'STANDARD_TROPICAL_SHELTERED', label: 'Tropis Terlindung (Kanopi / Tritisan)', description: 'Bukaan ternaungi peneduh arsitektural' }
];

export const ALLOWED_CLIMATE_EXPOSURES = new Set<string>(
  CLIMATE_EXPOSURE_OPTIONS.map(opt => opt.value)
);

export const APPLICATION_LOCATION_OPTIONS: Array<{ value: ApplicationLocationId; label: string; description: string }> = [
  { value: 'MASTER_BEDROOM', label: 'Kamar Tidur Utama', description: 'Ruang privat ber-AC, butuh insulasi suhu dan senyap' },
  { value: 'LIVING_COMMON_AREA', label: 'Ruang Keluarga / Area Bersama', description: 'Bukaan berdimensi lebar, interaksi ke taman' },
  { value: 'KITCHEN_OR_BATHROOM', label: 'Dapur atau Kamar Mandi', description: 'Kelembapan tinggi, uap air berkala' },
  { value: 'OUTDOOR_SERVICE_AREA', label: 'Area Servis Luar / Balkon', description: 'Paparan cuaca terbuka' }
];

export const ALLOWED_APPLICATION_LOCATIONS = new Set<string>(
  APPLICATION_LOCATION_OPTIONS.map(opt => opt.value)
);

export const BUDGET_CLASS_OPTIONS: Array<{ value: BudgetClassId; label: string; description: string }> = [
  { value: 'TIGHT_CONSTRAINED', label: 'Anggaran Terbatas / Renovasi Bertahap', description: 'Prioritas biaya awal ekonomis dan anti-rayap' },
  { value: 'BALANCED_MID', label: 'Menengah Seimbang (Value-for-Money)', description: 'Keseimbangan biaya awal dan daya tahan' },
  { value: 'LONG_TERM_INVESTMENT', label: 'Investasi Jangka Panjang', description: 'Fokus durabilitas 15-20+ tahun dan estetika' }
];

export const ALLOWED_BUDGET_CLASSES = new Set<string>(
  BUDGET_CLASS_OPTIONS.map(opt => opt.value)
);

export const MAINTENANCE_TOLERANCE_OPTIONS: Array<{ value: MaintenanceToleranceId; label: string; description: string }> = [
  { value: 'FIT_AND_FORGET', label: 'Bebas Perawatan (Fit & Forget)', description: 'Tanpa rutinitas pengecatan atau servis berkala' },
  { value: 'PERIODIC_LIGHT_MAINTENANCE', label: 'Toleran Perawatan Ringan Berkala', description: 'Bersedia inspeksi sealant dan pelumasan' }
];

export const ALLOWED_MAINTENANCE_TOLERANCES = new Set<string>(
  MAINTENANCE_TOLERANCE_OPTIONS.map(opt => opt.value)
);

export const COMFORT_PRIORITY_OPTIONS: Array<{ value: ComfortPriorityId; label: string }> = [
  { value: 'THERMAL_HEAT_REDUCTION', label: 'Peredaman Panas Suhu (Termal)' },
  { value: 'ACOUSTIC_NOISE_REDUCTION', label: 'Peredaman Kebisingan Suara (Akustik)' },
  { value: 'BALANCED_COMFORT', label: 'Kenyamanan Seimbang' }
];

export const ALLOWED_COMFORT_PRIORITIES = new Set<string>(
  COMFORT_PRIORITY_OPTIONS.map(opt => opt.value)
);

export const BUILD_PHASE_OPTIONS: Array<{ value: BuildPhaseId; label: string }> = [
  { value: 'RENOVATION_OCCUPIED_HOME', label: 'Renovasi Rumah Sedang Dihuni' },
  { value: 'NEW_CONSTRUCTION_VACANT', label: 'Bangun Baru (Rumah Kosong)' }
];

export const ALLOWED_BUILD_PHASES = new Set<string>(
  BUILD_PHASE_OPTIONS.map(opt => opt.value)
);

/**
 * Return list of the 5 canonical pilot scenarios for quick selection.
 */
export function getCanonicalScenarioPresets(): ScenarioPresetSummary[] {
  return SCENARIOS_PILOT.map(sc => ({
    scenario_id: sc.scenario_id,
    title: sc.title,
    expected_solution_id: sc.expected_recommendation.recommended_solution_id,
    expected_fit: sc.expected_recommendation.recommended_fit
  }));
}

/**
 * Invariant: SCENARIO_PRESET_IS_CONTEXT_ONLY.
 *
 * Extracts ONLY context fields from a scenario preset.
 * Strictly guarantees that scenario_id, expected_recommendation, and expected_fit
 * are NEVER returned as part of the context or passed to the evaluator.
 */
export function getPresetContext(scenarioId: string): DecisionContext | null {
  const matched = SCENARIOS_PILOT.find(s => s.scenario_id === scenarioId);
  if (!matched) {
    return null;
  }

  // Clone pure context dimensions only
  const ctx = matched.context;
  const pureContext: DecisionContext = {
    problem_goal: ctx.problem_goal,
    building_context: ctx.building_context,
    climate_exposure: ctx.climate_exposure,
    application_location: ctx.application_location,
    budget_class: ctx.budget_class,
    maintenance_tolerance: ctx.maintenance_tolerance
  };

  if (ctx.comfort_priority) {
    pureContext.comfort_priority = ctx.comfort_priority;
  }
  if (ctx.build_phase) {
    pureContext.build_phase = ctx.build_phase;
  }

  // Security check: verify no forbidden fields or expectation leaks
  const issues = scanForForbiddenFields(pureContext);
  if (issues.length > 0) {
    throw new Error(`Security violation in preset context: ${JSON.stringify(issues)}`);
  }

  // Extra safety assertion: ensure expected_recommendation is NOT present
  if ('expected_recommendation' in (pureContext as any) || 'expected_fit' in (pureContext as any)) {
    throw new Error('Invariant violation: preset context contains oracle expectation!');
  }

  return pureContext;
}

export interface AdminContextParseResult {
  valid: boolean;
  context: DecisionContext;
  selectedScenarioId: string;
  evidenceMode: EvidenceInspectionMode;
  validationErrors: Array<{ field: string; message: string }>;
}

/**
 * Extracts and strictly sanitizes DecisionContext from URL searchParams or form data.
 * Validates ALL incoming values against controlled taxonomy sets.
 * Invariant: EVALUATOR_CRITICAL_CONTEXT_MUST_USE_CONTROLLED_TAXONOMY.
 */
export function parseDecisionContextFromParams(
  searchParams: URLSearchParams
): AdminContextParseResult {
  const scenarioParam = searchParams.get('scenario') || '';
  const evidenceModeParam = (searchParams.get('evidence_mode') || 'current') as EvidenceInspectionMode;
  const evidenceMode: EvidenceInspectionMode = ['current', 'drift', 'unavailable'].includes(evidenceModeParam)
    ? evidenceModeParam
    : 'current';

  const defaultContext = getPresetContext('scen_west_facing_master_bedroom')!;

  // 1. If scenario preset was requested and no explicit field overrides exist
  const hasExplicitField = searchParams.has('problem_goal') ||
    searchParams.has('building_context') ||
    searchParams.has('climate_exposure') ||
    searchParams.has('application_location') ||
    searchParams.has('budget_class') ||
    searchParams.has('maintenance_tolerance');

  if (scenarioParam && !hasExplicitField) {
    const preset = getPresetContext(scenarioParam);
    if (preset) {
      return {
        valid: true,
        context: preset,
        selectedScenarioId: scenarioParam,
        evidenceMode,
        validationErrors: []
      };
    }
    return {
      valid: false,
      context: defaultContext,
      selectedScenarioId: scenarioParam,
      evidenceMode,
      validationErrors: [
        { field: 'scenario', message: `Skenario '${scenarioParam}' tidak dikenal dalam model.` }
      ]
    };
  }

  // 2. If explicit query parameters are provided, perform strict taxonomy validation
  if (hasExplicitField) {
    const validationErrors: Array<{ field: string; message: string }> = [];

    const rawProblemGoal = searchParams.get('problem_goal');
    const rawBuildingContext = searchParams.get('building_context');
    const rawClimateExposure = searchParams.get('climate_exposure');
    const rawApplicationLocation = searchParams.get('application_location');
    const rawBudgetClass = searchParams.get('budget_class');
    const rawMaintenanceTolerance = searchParams.get('maintenance_tolerance');
    const rawComfortPriority = searchParams.get('comfort_priority');
    const rawBuildPhase = searchParams.get('build_phase');

    // Validate 1: problem_goal
    if (!rawProblemGoal || rawProblemGoal.trim() === '') {
      validationErrors.push({ field: 'problem_goal', message: 'Dimensi wajib problem_goal harus dipilih.' });
    } else if (!ALLOWED_PROBLEM_GOALS.has(rawProblemGoal)) {
      validationErrors.push({
        field: 'problem_goal',
        message: `Nilai problem_goal '${rawProblemGoal}' di luar taksonomi terkendali (EVALUATOR_CRITICAL_CONTEXT_MUST_USE_CONTROLLED_TAXONOMY).`
      });
    }

    // Validate 2: building_context
    if (!rawBuildingContext || rawBuildingContext.trim() === '') {
      validationErrors.push({ field: 'building_context', message: 'Dimensi wajib building_context harus dipilih.' });
    } else if (!ALLOWED_BUILDING_CONTEXTS.has(rawBuildingContext)) {
      validationErrors.push({
        field: 'building_context',
        message: `Nilai building_context '${rawBuildingContext}' di luar taksonomi terkendali.`
      });
    }

    // Validate 3: climate_exposure
    if (!rawClimateExposure || rawClimateExposure.trim() === '') {
      validationErrors.push({ field: 'climate_exposure', message: 'Dimensi wajib climate_exposure harus dipilih.' });
    } else if (!ALLOWED_CLIMATE_EXPOSURES.has(rawClimateExposure)) {
      validationErrors.push({
        field: 'climate_exposure',
        message: `Nilai climate_exposure '${rawClimateExposure}' di luar taksonomi terkendali.`
      });
    }

    // Validate 4: application_location
    if (!rawApplicationLocation || rawApplicationLocation.trim() === '') {
      validationErrors.push({ field: 'application_location', message: 'Dimensi wajib application_location harus dipilih.' });
    } else if (!ALLOWED_APPLICATION_LOCATIONS.has(rawApplicationLocation)) {
      validationErrors.push({
        field: 'application_location',
        message: `Nilai application_location '${rawApplicationLocation}' di luar taksonomi terkendali.`
      });
    }

    // Validate 5: budget_class
    if (!rawBudgetClass || rawBudgetClass.trim() === '') {
      validationErrors.push({ field: 'budget_class', message: 'Dimensi wajib budget_class harus dipilih.' });
    } else if (!ALLOWED_BUDGET_CLASSES.has(rawBudgetClass)) {
      validationErrors.push({
        field: 'budget_class',
        message: `Nilai budget_class '${rawBudgetClass}' di luar taksonomi terkendali.`
      });
    }

    // Validate 6: maintenance_tolerance
    if (!rawMaintenanceTolerance || rawMaintenanceTolerance.trim() === '') {
      validationErrors.push({ field: 'maintenance_tolerance', message: 'Dimensi wajib maintenance_tolerance harus dipilih.' });
    } else if (!ALLOWED_MAINTENANCE_TOLERANCES.has(rawMaintenanceTolerance)) {
      validationErrors.push({
        field: 'maintenance_tolerance',
        message: `Nilai maintenance_tolerance '${rawMaintenanceTolerance}' di luar taksonomi terkendali.`
      });
    }

    // Validate optional dimensions if provided
    if (rawComfortPriority && rawComfortPriority.trim() !== '' && !ALLOWED_COMFORT_PRIORITIES.has(rawComfortPriority)) {
      validationErrors.push({
        field: 'comfort_priority',
        message: `Nilai comfort_priority '${rawComfortPriority}' di luar taksonomi terkendali.`
      });
    }

    if (rawBuildPhase && rawBuildPhase.trim() !== '' && !ALLOWED_BUILD_PHASES.has(rawBuildPhase)) {
      validationErrors.push({
        field: 'build_phase',
        message: `Nilai build_phase '${rawBuildPhase}' di luar taksonomi terkendali.`
      });
    }

    if (validationErrors.length > 0) {
      // Invariant: Forged/invalid input must not be cast into DecisionContext
      return {
        valid: false,
        context: defaultContext,
        selectedScenarioId: scenarioParam,
        evidenceMode,
        validationErrors
      };
    }

    // Construct sanitized DecisionContext safely
    const customContext: DecisionContext = {
      problem_goal: rawProblemGoal!,
      building_context: rawBuildingContext as BuildingContextId,
      climate_exposure: rawClimateExposure as ClimateExposureId,
      application_location: rawApplicationLocation as ApplicationLocationId,
      budget_class: rawBudgetClass as BudgetClassId,
      maintenance_tolerance: rawMaintenanceTolerance as MaintenanceToleranceId
    };

    if (rawComfortPriority && rawComfortPriority.trim() !== '') {
      customContext.comfort_priority = rawComfortPriority as ComfortPriorityId;
    }
    if (rawBuildPhase && rawBuildPhase.trim() !== '') {
      customContext.build_phase = rawBuildPhase as BuildPhaseId;
    }

    return {
      valid: true,
      context: customContext,
      selectedScenarioId: scenarioParam,
      evidenceMode,
      validationErrors: []
    };
  }

  // 3. Default to canonical scenario 1 context on initial load
  return {
    valid: true,
    context: defaultContext,
    selectedScenarioId: 'scen_west_facing_master_bedroom',
    evidenceMode,
    validationErrors: []
  };
}

/**
 * Builds authoritative evidence map for the evaluator based on inspection mode.
 */
export function createInspectionEvidenceMap(
  mode: EvidenceInspectionMode
): Map<string, { published_content_hash: string }> {
  const map = new Map<string, { published_content_hash: string }>();

  if (mode === 'current') {
    map.set(ARTICLE_5_EVIDENCE_BASE.publication_version_key, {
      published_content_hash: ARTICLE_5_EVIDENCE_BASE.published_content_hash
    });
  } else if (mode === 'drift') {
    // Simulate drifted article publication hash
    map.set(ARTICLE_5_EVIDENCE_BASE.publication_version_key, {
      published_content_hash: '9999999999999999999999999999999999999999999999999999999999999999'
    });
  }
  // If 'unavailable', map remains empty, triggering EVIDENCE_UNAVAILABLE

  return map;
}

/**
 * Executes inspection evaluation with given context and mode.
 * Invariant: EVALUATOR_CRITICAL_CONTEXT_MUST_USE_CONTROLLED_TAXONOMY.
 * Validates context taxonomy before calling evaluateDecision().
 */
export function runDecisionInspection(
  contextOrParseResult: DecisionContext | AdminContextParseResult,
  mode: EvidenceInspectionMode = 'current',
  model: DecisionModelDefinition = DECISION_MODEL_PILOT_KUSEN
): EvaluationResult {
  // 1. If an AdminContextParseResult is passed directly and failed validation
  if ('valid' in contextOrParseResult) {
    if (!contextOrParseResult.valid) {
      return {
        ok: false,
        status: 'INVALID_CONTEXT',
        error: 'Parameter konteks melanggar taksonomi terkendali (EVALUATOR_CRITICAL_CONTEXT_MUST_USE_CONTROLLED_TAXONOMY).',
        issues: contextOrParseResult.validationErrors.map(err => ({
          code: 'INVALID_TAXONOMY_VALUE',
          field: err.field,
          message: err.message
        }))
      };
    }
    return runDecisionInspection(contextOrParseResult.context, contextOrParseResult.evidenceMode, model);
  }

  const context = contextOrParseResult;

  // 2. Validate context dimensions against controlled taxonomy sets
  const taxonomyIssues: Array<{ code: string; field: string; message: string }> = [];

  if (!ALLOWED_PROBLEM_GOALS.has(context.problem_goal)) {
    taxonomyIssues.push({
      code: 'INVALID_TAXONOMY_VALUE',
      field: 'problem_goal',
      message: `Nilai problem_goal '${context.problem_goal}' di luar taksonomi terkendali.`
    });
  }
  if (!ALLOWED_BUILDING_CONTEXTS.has(context.building_context)) {
    taxonomyIssues.push({
      code: 'INVALID_TAXONOMY_VALUE',
      field: 'building_context',
      message: `Nilai building_context '${context.building_context}' di luar taksonomi terkendali.`
    });
  }
  if (!ALLOWED_CLIMATE_EXPOSURES.has(context.climate_exposure)) {
    taxonomyIssues.push({
      code: 'INVALID_TAXONOMY_VALUE',
      field: 'climate_exposure',
      message: `Nilai climate_exposure '${context.climate_exposure}' di luar taksonomi terkendali.`
    });
  }
  if (!ALLOWED_APPLICATION_LOCATIONS.has(context.application_location)) {
    taxonomyIssues.push({
      code: 'INVALID_TAXONOMY_VALUE',
      field: 'application_location',
      message: `Nilai application_location '${context.application_location}' di luar taksonomi terkendali.`
    });
  }
  if (!ALLOWED_BUDGET_CLASSES.has(context.budget_class)) {
    taxonomyIssues.push({
      code: 'INVALID_TAXONOMY_VALUE',
      field: 'budget_class',
      message: `Nilai budget_class '${context.budget_class}' di luar taksonomi terkendali.`
    });
  }
  if (!ALLOWED_MAINTENANCE_TOLERANCES.has(context.maintenance_tolerance)) {
    taxonomyIssues.push({
      code: 'INVALID_TAXONOMY_VALUE',
      field: 'maintenance_tolerance',
      message: `Nilai maintenance_tolerance '${context.maintenance_tolerance}' di luar taksonomi terkendali.`
    });
  }
  if (context.comfort_priority && !ALLOWED_COMFORT_PRIORITIES.has(context.comfort_priority)) {
    taxonomyIssues.push({
      code: 'INVALID_TAXONOMY_VALUE',
      field: 'comfort_priority',
      message: `Nilai comfort_priority '${context.comfort_priority}' di luar taksonomi terkendali.`
    });
  }
  if (context.build_phase && !ALLOWED_BUILD_PHASES.has(context.build_phase)) {
    taxonomyIssues.push({
      code: 'INVALID_TAXONOMY_VALUE',
      field: 'build_phase',
      message: `Nilai build_phase '${context.build_phase}' di luar taksonomi terkendali.`
    });
  }

  if (taxonomyIssues.length > 0) {
    return {
      ok: false,
      status: 'INVALID_CONTEXT',
      error: 'Parameter konteks melanggar taksonomi terkendali (EVALUATOR_CRITICAL_CONTEXT_MUST_USE_CONTROLLED_TAXONOMY).',
      issues: taxonomyIssues
    };
  }

  // 3. Evaluate raw context directly using evaluateDecision()
  const evidenceMap = createInspectionEvidenceMap(mode);
  const options: EvaluatorOptions = {
    authoritativeEvidenceMap: evidenceMap
  };

  return evaluateDecision(model, context, options);
}
