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
 * Indonesian options for the 6 CORE dimensions taxonomy.
 */
export const BUILDING_CONTEXT_OPTIONS: Array<{ value: BuildingContextId; label: string; description: string }> = [
  { value: 'SINGLE_STORY_HOUSE', label: 'Rumah Tapak 1 Lantai', description: 'Paparan angin standar, akses mudah' },
  { value: 'MULTI_STORY_HOUSE', label: 'Rumah Bertingkat (2+ Lantai)', description: 'Beban angin lantai atas lebih tinggi' },
  { value: 'CORNER_HOUSE_HOOK', label: 'Rumah Sudut / Hook', description: 'Paparan cuaca dua sisi terbuka' },
  { value: 'ATTACHED_CLUSTER_TOWNHOUSE', label: 'Cluster / Townhouse Dempet', description: 'Bukaan fasad depan dan belakang' }
];

export const CLIMATE_EXPOSURE_OPTIONS: Array<{ value: ClimateExposureId; label: string; description: string }> = [
  { value: 'WEST_AFTERNOON_HEAT', label: 'Panas Sore Matahari Barat', description: 'Beban radiasi dan konduksi termal tinggi' },
  { value: 'WIND_DRIVEN_RAIN', label: 'Tempias Hujan Angin Kencang', description: 'Tekanan air tinggi pada sudut sambungan' },
  { value: 'COASTAL_SALT_HUMID', label: 'Pesisir / Udara Lembap Berkadar Garam', description: 'Risiko korosi logam dan erosi sealant' },
  { value: 'STANDARD_TROPICAL_SHELTERED', label: 'Tropis Terlindung (Kanopi / Tritisan)', description: 'Bukaan ternaungi peneduh arsitektural' }
];

export const APPLICATION_LOCATION_OPTIONS: Array<{ value: ApplicationLocationId; label: string; description: string }> = [
  { value: 'MASTER_BEDROOM', label: 'Kamar Tidur Utama', description: 'Ruang privat ber-AC, butuh insulasi suhu dan senyap' },
  { value: 'LIVING_COMMON_AREA', label: 'Ruang Keluarga / Area Bersama', description: 'Bukaan berdimensi lebar, interaksi ke taman' },
  { value: 'KITCHEN_OR_BATHROOM', label: 'Dapur atau Kamar Mandi', description: 'Kelembapan tinggi, uap air berkala' },
  { value: 'OUTDOOR_SERVICE_AREA', label: 'Area Servis Luar / Balkon', description: 'Paparan cuaca terbuka' }
];

export const BUDGET_CLASS_OPTIONS: Array<{ value: BudgetClassId; label: string; description: string }> = [
  { value: 'TIGHT_CONSTRAINED', label: 'Anggaran Terbatas / Renovasi Bertahap', description: 'Prioritas biaya awal ekonomis dan anti-rayap' },
  { value: 'BALANCED_MID', label: 'Menengah Seimbang (Value-for-Money)', description: 'Keseimbangan biaya awal dan daya tahan' },
  { value: 'LONG_TERM_INVESTMENT', label: 'Investasi Jangka Panjang', description: 'Fokus durabilitas 15-20+ tahun dan estetika' }
];

export const MAINTENANCE_TOLERANCE_OPTIONS: Array<{ value: MaintenanceToleranceId; label: string; description: string }> = [
  { value: 'FIT_AND_FORGET', label: 'Bebas Perawatan (Fit & Forget)', description: 'Tanpa rutinitas pengecatan atau servis berkala' },
  { value: 'PERIODIC_LIGHT_MAINTENANCE', label: 'Toleran Perawatan Ringan Berkala', description: 'Bersedia inspeksi sealant dan pelumasan' }
];

export const COMFORT_PRIORITY_OPTIONS: Array<{ value: ComfortPriorityId; label: string }> = [
  { value: 'THERMAL_HEAT_REDUCTION', label: 'Peredaman Panas Suhu (Termal)' },
  { value: 'ACOUSTIC_NOISE_REDUCTION', label: 'Peredaman Kebisingan Suara (Akustik)' },
  { value: 'BALANCED_COMFORT', label: 'Kenyamanan Seimbang' }
];

export const BUILD_PHASE_OPTIONS: Array<{ value: BuildPhaseId; label: string }> = [
  { value: 'RENOVATION_OCCUPIED_HOME', label: 'Renovasi Rumah Sedang Dihuni' },
  { value: 'NEW_CONSTRUCTION_VACANT', label: 'Bangun Baru (Rumah Kosong)' }
];

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

/**
 * Extracts and sanitizes DecisionContext from URL searchParams or form data.
 * Falls back to canonical scenario 1 context if no parameters provided.
 */
export function parseDecisionContextFromParams(
  searchParams: URLSearchParams
): { context: DecisionContext; selectedScenarioId: string; evidenceMode: EvidenceInspectionMode } {
  const scenarioParam = searchParams.get('scenario') || '';
  const evidenceModeParam = (searchParams.get('evidence_mode') || 'current') as EvidenceInspectionMode;
  const evidenceMode: EvidenceInspectionMode = ['current', 'drift', 'unavailable'].includes(evidenceModeParam)
    ? evidenceModeParam
    : 'current';

  // If a preset was requested and no individual form override is set, load preset context
  if (scenarioParam && !searchParams.has('problem_goal')) {
    const preset = getPresetContext(scenarioParam);
    if (preset) {
      return { context: preset, selectedScenarioId: scenarioParam, evidenceMode };
    }
  }

  // Check if explicit query/form params are provided
  const problemGoal = searchParams.get('problem_goal');
  const buildingContext = searchParams.get('building_context') as BuildingContextId;
  const climateExposure = searchParams.get('climate_exposure') as ClimateExposureId;
  const applicationLocation = searchParams.get('application_location') as ApplicationLocationId;
  const budgetClass = searchParams.get('budget_class') as BudgetClassId;
  const maintenanceTolerance = searchParams.get('maintenance_tolerance') as MaintenanceToleranceId;
  const comfortPriority = searchParams.get('comfort_priority') as ComfortPriorityId | null;
  const buildPhase = searchParams.get('build_phase') as BuildPhaseId | null;

  if (problemGoal && buildingContext && climateExposure && applicationLocation && budgetClass && maintenanceTolerance) {
    const customContext: DecisionContext = {
      problem_goal: problemGoal.trim(),
      building_context: buildingContext,
      climate_exposure: climateExposure,
      application_location: applicationLocation,
      budget_class: budgetClass,
      maintenance_tolerance: maintenanceTolerance
    };

    if (comfortPriority) {
      customContext.comfort_priority = comfortPriority;
    }
    if (buildPhase) {
      customContext.build_phase = buildPhase;
    }

    return { context: customContext, selectedScenarioId: scenarioParam, evidenceMode };
  }

  // Default to canonical scenario 1 context on initial load
  const defaultContext = getPresetContext('scen_west_facing_master_bedroom')!;
  return {
    context: defaultContext,
    selectedScenarioId: 'scen_west_facing_master_bedroom',
    evidenceMode
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
 * Evaluates raw context directly using evaluateDecision().
 */
export function runDecisionInspection(
  context: DecisionContext,
  mode: EvidenceInspectionMode = 'current',
  model: DecisionModelDefinition = DECISION_MODEL_PILOT_KUSEN
): EvaluationResult {
  const evidenceMap = createInspectionEvidenceMap(mode);
  const options: EvaluatorOptions = {
    authoritativeEvidenceMap: evidenceMap
  };

  return evaluateDecision(model, context, options);
}
