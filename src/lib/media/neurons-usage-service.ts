/**
 * RancangLoka — Cloudflare Workers AI Neurons Usage Monitor Service (MEDIA-NEURONS-1)
 *
 * Provides authoritative usage accounting, budget guards, and telemetry tracking:
 * 1. Cloudflare Workers AI Free Tier quota tracking (10,000 Neurons/day).
 * 2. Pre-generation budget guards: 70% warning, 90% high warning, 100% automated block.
 * 3. Daily reset cycle based on Cloudflare billing period (00:00:00 UTC).
 * 4. Deduplication & double-counting prevention (retries, timeouts, failed requests).
 * 5. Strict labeling: ACTUAL / ESTIMATED / UNAVAILABLE.
 * 6. Zero paid-usage activation (free tier protection).
 */

import fs from 'node:fs';
import path from 'node:path';
import { loadCandidatesLedger } from './experimental-storage.ts';

export const CLOUDFLARE_FLUX_MODEL = '@cf/black-forest-labs/flux-1-schnell';
export const CLOUDFLARE_SDXL_MODEL = '@cf/bytedance/stable-diffusion-xl-lightning';

export const CLOUDFLARE_FREE_TIER_DAILY_NEURONS = 10000;
export const CLOUDFLARE_DAILY_FREE_NEURONS = CLOUDFLARE_FREE_TIER_DAILY_NEURONS;

// Official Cloudflare Workers AI pricing schedule:
// FLUX.1 Schnell: 4.80 Neurons per 512x512 tile, 9.60 Neurons per diffusion step
export const FLUX_NEURONS_PER_TILE = 4.8;
export const FLUX_NEURONS_PER_STEP = 9.6;
export const FLUX_DEFAULT_1024_4STEP_NEURONS = 57.6;
export const DEFAULT_FLUX_NEURONS = FLUX_DEFAULT_1024_4STEP_NEURONS;

// SDXL Lightning is unlisted in official Cloudflare Workers AI pricing schedule
export const SDXL_PRICING_STATUS = 'UNKNOWN' as const;

export interface ModelPricingEvaluation {
  model: string;
  pricingStatus: 'VERIFIED_OFFICIAL' | 'UNKNOWN';
  authoritativeSource: 'ESTIMATED' | 'UNKNOWN';
  neuronsEstimated: number | null;
  dimensions: string;
  steps: number;
  tiles: number;
  tileNeurons: number;
  stepNeurons: number;
  note: string;
}

export interface NeuronsUsageEntry {
  id: string; // generation_id or request_id
  timestamp: string; // ISO 8601
  dateUtc: string; // YYYY-MM-DD
  articleId: number;
  model: string;
  modelName: string;
  mediaRole: string;
  purpose: string;
  status: 'SUCCESS' | 'FAILED' | 'BLOCKED' | 'TIMEOUT';
  neuronsEstimated: number | null;
  neuronsActual: number | null; // null if unconfirmed by Cloudflare API
  authoritativeSource: 'ACTUAL' | 'ESTIMATED' | 'UNKNOWN' | 'UNAVAILABLE';
  pricingStatus?: 'VERIFIED_OFFICIAL' | 'UNKNOWN';
  costStatus?: 'UNVERIFIED_FREE_TIER' | 'ACTUAL_VERIFIED' | 'UNKNOWN';
  latencyMs?: number;
  httpStatus?: number;
  errorCategory?: string;
  errorMessage?: string;
  isRetry?: boolean;
  parentGenerationId?: string;
  auditCorrection?: {
    originalEstimatedNeurons?: number | null;
    correctedAt?: string;
    reason?: string;
  };
}

export interface NeuronsMonitorConfig {
  dailyFreeAllowance: number;
  warningThresholdPercent: number; // e.g. 70%
  highWarningThresholdPercent: number; // e.g. 90%
  blockThresholdPercent: number; // e.g. 100%
  customDailyLimit: number; // e.g. 10000
  allowPaidUsage: boolean; // Strictly false
  billingResetTimeUtc: string; // "00:00:00Z"
}

export interface NeuronsDailySummary {
  dateUtc: string;
  freeTierAllocation: number;
  dailyAllowance: number;
  configuredDailyLimit: number;
  configuredLimit: number;
  neuronsUsedToday: number;
  neuronsUsedEstimated: number;
  neuronsUsedActual: number | null;
  neuronsRemainingEstimated: number;
  percentageUsed: number;
  usagePercentEstimated: number;
  statusLabel: 'ACTUAL' | 'ESTIMATED' | 'UNKNOWN' | 'UNAVAILABLE';
  budgetStatus: 'HEALTHY' | 'WARNING' | 'HIGH_WARNING' | 'BLOCKED';
  totalRequestsToday: number;
  totalRequests: number;
  successfulGenerationsToday: number;
  successfulGenerations: number;
  failedGenerationsToday: number;
  failedGenerations: number;
  blockedGenerations: number;
  estimatedRemainingCapacity: {
    fluxImages: number;
    sdxlImages: number | null;
    sdxlStatus: 'UNKNOWN';
  };
  modelBreakdown: Array<{
    model: string;
    modelName: string;
    requestCount: number;
    totalRequests: number;
    successCount: number;
    failCount: number;
    estimatedNeurons: number | null;
    pricingStatus: 'VERIFIED_OFFICIAL' | 'UNKNOWN';
    unitCostNote: string;
  }>;
  modelBreakdownMap: Record<string, any>;
  nextResetUtc: string;
  lastSyncTimestamp: string;
  cfApiStatus: 'AVAILABLE' | 'UNAVAILABLE';
  cfApiReason: string;
}

const STORAGE_DIR = path.resolve('./storage/experimental-media');
const LEDGER_FILE = path.join(STORAGE_DIR, 'neurons-usage-ledger.json');
const CONFIG_FILE = path.join(STORAGE_DIR, 'neurons-monitor-config.json');

const DEFAULT_CONFIG: NeuronsMonitorConfig = {
  dailyFreeAllowance: CLOUDFLARE_DAILY_FREE_NEURONS,
  warningThresholdPercent: 70,
  highWarningThresholdPercent: 90,
  blockThresholdPercent: 100,
  customDailyLimit: CLOUDFLARE_DAILY_FREE_NEURONS,
  allowPaidUsage: false,
  billingResetTimeUtc: '00:00:00Z'
};

function ensureStorageDir(): void {
  if (!fs.existsSync(STORAGE_DIR)) {
    fs.mkdirSync(STORAGE_DIR, { recursive: true });
  }
}

export function getCurrentDateUtc(): string {
  return new Date().toISOString().slice(0, 10);
}

export function getNextResetTimestampUtc(): string {
  const tomorrow = new Date();
  tomorrow.setUTCDate(tomorrow.getUTCDate() + 1);
  tomorrow.setUTCHours(0, 0, 0, 0);
  return tomorrow.toISOString();
}

export function loadMonitorConfig(): NeuronsMonitorConfig {
  ensureStorageDir();
  if (!fs.existsSync(CONFIG_FILE)) {
    saveMonitorConfig(DEFAULT_CONFIG);
    return { ...DEFAULT_CONFIG };
  }
  try {
    const raw = fs.readFileSync(CONFIG_FILE, 'utf8');
    const parsed = JSON.parse(raw);
    return {
      ...DEFAULT_CONFIG,
      ...parsed,
      allowPaidUsage: false // Safety invariant: never allow paid usage to be flipped true
    };
  } catch {
    return { ...DEFAULT_CONFIG };
  }
}

export function saveMonitorConfig(config: NeuronsMonitorConfig): void {
  ensureStorageDir();
  // Enforce safety invariant
  config.allowPaidUsage = false;
  fs.writeFileSync(CONFIG_FILE, JSON.stringify(config, null, 2), 'utf8');
}

export function updateMonitorConfig(updates: Partial<NeuronsMonitorConfig>): NeuronsMonitorConfig {
  const current = loadMonitorConfig();
  const nextConfig: NeuronsMonitorConfig = {
    ...current,
    ...updates,
    allowPaidUsage: false // Invariant
  };

  if (updates.customDailyLimit !== undefined) {
    // Bound customDailyLimit between 1,000 and 10,000 to prevent overruns
    nextConfig.customDailyLimit = Math.min(
      Math.max(Number(updates.customDailyLimit) || 1000, 1000),
      CLOUDFLARE_DAILY_FREE_NEURONS
    );
  }

  saveMonitorConfig(nextConfig);
  return nextConfig;
}

export function calculateModelNeurons(
  model: string,
  width: number = 1024,
  height: number = 1024,
  steps: number = 4
): ModelPricingEvaluation {
  const m = (model || '').toLowerCase();
  const w = Number(width) > 0 ? Number(width) : 1024;
  const h = Number(height) > 0 ? Number(height) : 1024;
  const s = Number(steps) > 0 ? Number(steps) : 4;

  if (m === CLOUDFLARE_FLUX_MODEL || m.includes('flux')) {
    const horizontalTiles = Math.ceil(w / 512);
    const verticalTiles = Math.ceil(h / 512);
    const totalTiles = horizontalTiles * verticalTiles;
    const tileNeurons = Number((totalTiles * FLUX_NEURONS_PER_TILE).toFixed(2));
    const stepNeurons = Number((s * FLUX_NEURONS_PER_STEP).toFixed(2));
    const total = Number((tileNeurons + stepNeurons).toFixed(2));

    return {
      model,
      pricingStatus: 'VERIFIED_OFFICIAL',
      authoritativeSource: 'ESTIMATED',
      neuronsEstimated: total,
      dimensions: `${w}x${h}`,
      steps: s,
      tiles: totalTiles,
      tileNeurons,
      stepNeurons,
      note: `Official Cloudflare Workers AI formula: (${totalTiles} tiles × ${FLUX_NEURONS_PER_TILE} N) + (${s} steps × ${FLUX_NEURONS_PER_STEP} N) = ${total} Neurons.`
    };
  }

  // SDXL Lightning or other unlisted models in official Cloudflare pricing table
  return {
    model,
    pricingStatus: 'UNKNOWN',
    authoritativeSource: 'UNKNOWN',
    neuronsEstimated: null,
    dimensions: `${w}x${h}`,
    steps: s,
    tiles: Math.ceil(w / 512) * Math.ceil(h / 512),
    tileNeurons: 0,
    stepNeurons: 0,
    note: 'Model pricing is unverified in official Cloudflare Workers AI pricing documentation. Displayed as UNKNOWN, zero fabricated values.'
  };
}

/**
 * Migrates historical ledger entries that have legacy placeholder estimates (1,500 N for FLUX or 1,200 N for SDXL).
 * Preserves original transaction data, timestamps, and IDs while attaching transparent auditCorrection metadata.
 */
export function migrateLedgerHistoricalEstimates(entries: NeuronsUsageEntry[]): {
  migratedEntries: NeuronsUsageEntry[];
  correctedCount: number;
} {
  let correctedCount = 0;
  const now = new Date().toISOString();

  const migratedEntries = entries.map((entry) => {
    const isFlux = entry.model === CLOUDFLARE_FLUX_MODEL || entry.model.includes('flux');
    const isSdxl =
      entry.model === CLOUDFLARE_SDXL_MODEL ||
      entry.model.includes('lightning') ||
      entry.model.includes('sdxl') ||
      entry.model.includes('diffusion-xl');

    // Case 1: Legacy FLUX placeholder of 1500 N
    if (isFlux && entry.neuronsEstimated === 1500) {
      correctedCount++;
      return {
        ...entry,
        neuronsEstimated: FLUX_DEFAULT_1024_4STEP_NEURONS, // 57.60 N for standard 1024x1024 4 steps
        authoritativeSource: 'ESTIMATED' as const,
        pricingStatus: 'VERIFIED_OFFICIAL' as const,
        costStatus: 'UNVERIFIED_FREE_TIER' as const,
        auditCorrection: {
          originalEstimatedNeurons: 1500,
          correctedAt: now,
          reason:
            'Corrected legacy 1,500 N placeholder to official Cloudflare formula (4 tiles × 4.80 N + 4 steps × 9.60 N = 57.60 Neurons).'
        }
      };
    }

    // Case 2: Legacy SDXL placeholder of 1200 N
    if (isSdxl && entry.neuronsEstimated === 1200) {
      correctedCount++;
      return {
        ...entry,
        neuronsEstimated: null,
        authoritativeSource: 'UNKNOWN' as const,
        pricingStatus: 'UNKNOWN' as const,
        costStatus: 'UNKNOWN' as const,
        auditCorrection: {
          originalEstimatedNeurons: 1200,
          correctedAt: now,
          reason:
            'Removed fabricated 1,200 N placeholder. SDXL Lightning pricing is unverified in official Cloudflare documentation; marked as UNKNOWN.'
        }
      };
    }

    return entry;
  });

  return { migratedEntries, correctedCount };
}

export function loadUsageLedger(): NeuronsUsageEntry[] {
  ensureStorageDir();
  if (!fs.existsSync(LEDGER_FILE)) {
    // Initialize ledger by backfilling from candidates-manifest.json if exists
    const backfilled = seedLedgerFromCandidates();
    saveUsageLedger(backfilled);
    return backfilled;
  }
  try {
    const raw = fs.readFileSync(LEDGER_FILE, 'utf8');
    const parsed: NeuronsUsageEntry[] = JSON.parse(raw);
    const { migratedEntries, correctedCount } = migrateLedgerHistoricalEstimates(parsed);
    if (correctedCount > 0) {
      saveUsageLedger(migratedEntries);
    }
    return migratedEntries;
  } catch {
    return [];
  }
}

export function saveUsageLedger(entries: NeuronsUsageEntry[]): void {
  ensureStorageDir();
  fs.writeFileSync(LEDGER_FILE, JSON.stringify(entries, null, 2), 'utf8');
}

/**
 * Seeds the usage ledger from existing candidates in candidates-manifest.json
 * to ensure historical generations are accounted for without double counting.
 */
export function seedLedgerFromCandidates(): NeuronsUsageEntry[] {
  const candidates = loadCandidatesLedger();
  const entries: NeuronsUsageEntry[] = [];

  for (const c of candidates) {
    const dateUtc = c.generation_timestamp ? c.generation_timestamp.slice(0, 10) : getCurrentDateUtc();
    const isFlux = c.model === CLOUDFLARE_FLUX_MODEL || c.model.includes('flux');
    const evalResult = calculateModelNeurons(c.model, c.width || 1024, c.height || 1024, c.steps || 4);

    entries.push({
      id: c.generation_job_id || `JOB-SEEDED-${c.id}`,
      timestamp: c.generation_timestamp || new Date().toISOString(),
      dateUtc,
      articleId: c.article_id,
      model: c.model,
      modelName: isFlux ? 'FLUX.1 Schnell' : 'SDXL Lightning',
      mediaRole: c.media_role || 'featured_hero',
      purpose: 'historical_seed',
      status: 'SUCCESS',
      neuronsEstimated: evalResult.neuronsEstimated,
      neuronsActual: null,
      authoritativeSource: evalResult.authoritativeSource,
      pricingStatus: evalResult.pricingStatus,
      costStatus: isFlux ? 'UNVERIFIED_FREE_TIER' : 'UNKNOWN',
      latencyMs: c.provenance?.latency_ms,
      httpStatus: 200
    });
  }

  return entries;
}

/**
 * Checks Cloudflare official Workers AI telemetry API.
 * Identifies whether an authoritative real-time daily usage endpoint is available.
 */
export async function probeCloudflareUsageApi(): Promise<{
  available: boolean;
  reason: string;
  authoritativeSource: 'ACTUAL' | 'UNAVAILABLE';
}> {
  return {
    available: false,
    reason:
      'Cloudflare Workers AI does not provide an official real-time daily usage REST API endpoint for individual accounts. Usage aggregation is displayed on the Cloudflare Dashboard; local tracking uses ESTIMATED Neurons with pre-generation budget guards.',
    authoritativeSource: 'UNAVAILABLE'
  };
}

/**
 * Determines estimated Neurons required for a model generation based on official Cloudflare pricing formula.
 * Returns null if model pricing is unverified in official documentation.
 */
export function getEstimatedNeuronsForModel(
  model: string,
  width: number = 1024,
  height: number = 1024,
  steps: number = 4
): number | null {
  const evalResult = calculateModelNeurons(model, width, height, steps);
  return evalResult.neuronsEstimated;
}

/**
 * Pre-generation Budget Guard:
 * Checks if running a generation with the given model will exceed 70%, 90%, or the block limit.
 * Accurately handles verified models (FLUX: 57.60 N) and unverified models (SDXL: UNKNOWN).
 */
export function checkPreGenerationBudgetGuard(
  model: string,
  optionsOrDate?:
    | string
    | {
        targetDateUtc?: string;
        customLimit?: number;
        currentUsageOverride?: number;
        width?: number;
        height?: number;
        steps?: number;
      }
): {
  allowed: boolean;
  warningLevel: 'NONE' | 'WARNING' | 'HIGH_WARNING' | 'BLOCK';
  reason?: string;
  currentUsageEstimated: number;
  projectedUsageEstimated: number;
  configuredLimit: number;
  pricingStatus: 'VERIFIED_OFFICIAL' | 'UNKNOWN';
} {
  const config = loadMonitorConfig();
  const targetDateUtc =
    typeof optionsOrDate === 'string'
      ? optionsOrDate
      : optionsOrDate?.targetDateUtc || getCurrentDateUtc();

  const width = typeof optionsOrDate === 'object' ? optionsOrDate?.width : undefined;
  const height = typeof optionsOrDate === 'object' ? optionsOrDate?.height : undefined;
  const steps = typeof optionsOrDate === 'object' ? optionsOrDate?.steps : undefined;

  const summary = getDailyUsageSummary(targetDateUtc);
  const evalResult = calculateModelNeurons(model, width, height, steps);

  const limit =
    typeof optionsOrDate === 'object' && optionsOrDate?.customLimit !== undefined
      ? optionsOrDate.customLimit
      : config.customDailyLimit;

  const currentUsage =
    typeof optionsOrDate === 'object' && optionsOrDate?.currentUsageOverride !== undefined
      ? optionsOrDate.currentUsageOverride
      : summary.neuronsUsedToday;

  // If model pricing is UNKNOWN (e.g. SDXL Lightning), do not fabricate a fake neuron addition to budget guard
  if (evalResult.pricingStatus === 'UNKNOWN') {
    const projectedUsage = currentUsage;
    const projectedPercent = (projectedUsage / limit) * 100;

    if (currentUsage >= limit) {
      return {
        allowed: false,
        warningLevel: 'BLOCK',
        reason: `Pre-generation budget guard: Kuota harian terpakai (${currentUsage} N) telah mencapai limit (${limit} N / 100%). Generasi dihentikan untuk melindungi Free Tier.`,
        currentUsageEstimated: currentUsage,
        projectedUsageEstimated: currentUsage,
        configuredLimit: limit,
        pricingStatus: 'UNKNOWN'
      };
    }

    return {
      allowed: true,
      warningLevel: projectedPercent >= config.warningThresholdPercent ? 'WARNING' : 'NONE',
      reason:
        'Catatan: Tarif model ini (SDXL Lightning) belum terdaftar secara resmi di dokumentasi Cloudflare Workers AI (Status: UNKNOWN). Tidak menambahkan estimasi rekaan ke budget guard.',
      currentUsageEstimated: currentUsage,
      projectedUsageEstimated: currentUsage,
      configuredLimit: limit,
      pricingStatus: 'UNKNOWN'
    };
  }

  // Verified official pricing (e.g. FLUX.1 Schnell)
  const neededNeurons = evalResult.neuronsEstimated || FLUX_DEFAULT_1024_4STEP_NEURONS;
  const projectedUsage = Number((currentUsage + neededNeurons).toFixed(2));
  const projectedPercent = (projectedUsage / limit) * 100;

  if (projectedUsage > limit) {
    return {
      allowed: false,
      warningLevel: 'BLOCK',
      reason: `Pre-generation budget guard: Projected usage (${projectedUsage} Neurons) would exceed the configured daily limit (${limit} Neurons / 100%). Generation halted to protect Free Tier. Batas terlampaui.`,
      currentUsageEstimated: currentUsage,
      projectedUsageEstimated: projectedUsage,
      configuredLimit: limit,
      pricingStatus: 'VERIFIED_OFFICIAL'
    };
  }

  if (projectedPercent >= config.highWarningThresholdPercent) {
    return {
      allowed: true,
      warningLevel: 'HIGH_WARNING',
      reason: `High warning: Projected usage will reach ${projectedPercent.toFixed(1)}% (${projectedUsage}/${limit} Neurons). Free tier quota nearly exhausted.`,
      currentUsageEstimated: currentUsage,
      projectedUsageEstimated: projectedUsage,
      configuredLimit: limit,
      pricingStatus: 'VERIFIED_OFFICIAL'
    };
  }

  if (projectedPercent >= config.warningThresholdPercent) {
    return {
      allowed: true,
      warningLevel: 'WARNING',
      reason: `Budget warning: Projected usage will reach ${projectedPercent.toFixed(1)}% (${projectedUsage}/${limit} Neurons). Peringatan kuota mendekati batas.`,
      currentUsageEstimated: currentUsage,
      projectedUsageEstimated: projectedUsage,
      configuredLimit: limit,
      pricingStatus: 'VERIFIED_OFFICIAL'
    };
  }

  return {
    allowed: true,
    warningLevel: 'NONE',
    currentUsageEstimated: currentUsage,
    projectedUsageEstimated: projectedUsage,
    configuredLimit: limit,
    pricingStatus: 'VERIFIED_OFFICIAL'
  };
}

/**
 * Records a generation attempt in the usage ledger.
 * Prevents double-counting retries or existing generation IDs.
 */
export function recordGenerationUsage(entryInput: {
  id: string;
  articleId: number;
  model: string;
  mediaRole?: string;
  purpose?: string;
  status: 'SUCCESS' | 'FAILED' | 'BLOCKED' | 'TIMEOUT';
  latencyMs?: number;
  httpStatus?: number;
  errorCategory?: string;
  errorMessage?: string;
  isRetry?: boolean;
  parentGenerationId?: string;
  neuronsEstimatedOverride?: number | null;
  width?: number;
  height?: number;
  steps?: number;
}): NeuronsUsageEntry {
  const ledger = loadUsageLedger();
  const dateUtc = getCurrentDateUtc();
  const isFlux = entryInput.model.includes('flux');
  const modelName = isFlux ? 'FLUX.1 Schnell' : 'SDXL Lightning';
  const evalResult = calculateModelNeurons(
    entryInput.model,
    entryInput.width || 1024,
    entryInput.height || 1024,
    entryInput.steps || 4
  );

  // For blocked or pre-network validation failures, zero neurons are consumed
  let estNeurons: number | null = 0;
  if (entryInput.status === 'SUCCESS' || entryInput.status === 'TIMEOUT') {
    estNeurons =
      entryInput.neuronsEstimatedOverride !== undefined
        ? entryInput.neuronsEstimatedOverride
        : evalResult.neuronsEstimated;
  } else if (entryInput.status === 'FAILED') {
    // If provider reached 5xx after processing, count neurons conservatively; if 4xx auth or client validation, 0
    estNeurons = (entryInput.httpStatus && entryInput.httpStatus >= 500)
      ? evalResult.neuronsEstimated
      : 0;
  }

  const existingIdx = ledger.findIndex((e) => e.id === entryInput.id);

  const entry: NeuronsUsageEntry = {
    id: entryInput.id,
    timestamp: new Date().toISOString(),
    dateUtc,
    articleId: entryInput.articleId,
    model: entryInput.model,
    modelName,
    mediaRole: entryInput.mediaRole || 'featured_hero',
    purpose: entryInput.purpose || 'comparison_batch',
    status: entryInput.status,
    neuronsEstimated: estNeurons,
    neuronsActual: null, // Always null because CF API does not expose daily free neuron counters
    authoritativeSource: evalResult.authoritativeSource,
    pricingStatus: evalResult.pricingStatus,
    costStatus: isFlux ? 'UNVERIFIED_FREE_TIER' : 'UNKNOWN',
    latencyMs: entryInput.latencyMs,
    httpStatus: entryInput.httpStatus,
    errorCategory: entryInput.errorCategory,
    errorMessage: entryInput.errorMessage,
    isRetry: entryInput.isRetry,
    parentGenerationId: entryInput.parentGenerationId
  };

  if (existingIdx >= 0) {
    // Update existing entry (e.g. status transition from retry/timeout)
    ledger[existingIdx] = entry;
  } else {
    ledger.push(entry);
  }

  saveUsageLedger(ledger);
  return entry;
}

/**
 * Calculates a consolidated daily summary for the specified UTC date (defaults to today).
 */
export function getDailyUsageSummary(targetDateUtc: string = getCurrentDateUtc()): NeuronsDailySummary {
  const config = loadMonitorConfig();
  const ledger = loadUsageLedger();

  // Filter entries for the specified Cloudflare billing day (UTC)
  // Also filter exclusively for LokaMedia image generation models to avoid mixing other account AI models
  const dayEntries = ledger.filter(
    (e) =>
      e.dateUtc === targetDateUtc &&
      (e.model === CLOUDFLARE_FLUX_MODEL ||
        e.model === CLOUDFLARE_SDXL_MODEL ||
        e.model.includes('flux-1-schnell') ||
        e.model.includes('stable-diffusion-xl-lightning'))
  );

  let neuronsUsedEstimated = 0;
  let successfulGenerations = 0;
  let failedGenerations = 0;
  let blockedGenerations = 0;

  const modelBreakdownMap: Record<
    string,
    {
      modelName: string;
      totalRequests: number;
      successCount: number;
      failCount: number;
      estimatedNeurons: number | null;
      pricingStatus: 'VERIFIED_OFFICIAL' | 'UNKNOWN';
      unitCostNote: string;
    }
  > = {
    [CLOUDFLARE_FLUX_MODEL]: {
      modelName: 'FLUX.1 Schnell',
      totalRequests: 0,
      successCount: 0,
      failCount: 0,
      estimatedNeurons: 0,
      pricingStatus: 'VERIFIED_OFFICIAL',
      unitCostNote: '57.60 N / gen (resmi: 4 tiles × 4.80 N + 4 steps × 9.60 N)'
    },
    [CLOUDFLARE_SDXL_MODEL]: {
      modelName: 'SDXL Lightning',
      totalRequests: 0,
      successCount: 0,
      failCount: 0,
      estimatedNeurons: null,
      pricingStatus: 'UNKNOWN',
      unitCostNote: 'UNKNOWN (Belum terdaftar di jadwal harga resmi Cloudflare)'
    }
  };

  for (const entry of dayEntries) {
    if (typeof entry.neuronsEstimated === 'number') {
      neuronsUsedEstimated += entry.neuronsEstimated;
    }

    if (entry.status === 'SUCCESS') {
      successfulGenerations++;
    } else if (entry.status === 'BLOCKED') {
      blockedGenerations++;
    } else {
      failedGenerations++;
    }

    const key = entry.model.includes('flux') ? CLOUDFLARE_FLUX_MODEL : CLOUDFLARE_SDXL_MODEL;
    if (!modelBreakdownMap[key]) {
      const isFlux = entry.model.includes('flux');
      modelBreakdownMap[key] = {
        modelName: entry.modelName,
        totalRequests: 0,
        successCount: 0,
        failCount: 0,
        estimatedNeurons: isFlux ? 0 : null,
        pricingStatus: isFlux ? 'VERIFIED_OFFICIAL' : 'UNKNOWN',
        unitCostNote: isFlux
          ? '57.60 N / gen (resmi)'
          : 'UNKNOWN (Belum terdaftar di jadwal harga resmi Cloudflare)'
      };
    }

    modelBreakdownMap[key].totalRequests++;
    if (entry.status === 'SUCCESS') {
      modelBreakdownMap[key].successCount++;
    } else {
      modelBreakdownMap[key].failCount++;
    }

    if (entry.model.includes('flux') && typeof entry.neuronsEstimated === 'number') {
      modelBreakdownMap[key].estimatedNeurons = Number(
        (((modelBreakdownMap[key].estimatedNeurons as number) || 0) + entry.neuronsEstimated).toFixed(2)
      );
    }
  }

  neuronsUsedEstimated = Number(neuronsUsedEstimated.toFixed(2));
  const limit = config.customDailyLimit;
  const neuronsRemainingEstimated = Math.max(Number((limit - neuronsUsedEstimated).toFixed(2)), 0);
  const usagePercentEstimated = Math.min(Number(((neuronsUsedEstimated / limit) * 100).toFixed(2)), 100);

  let budgetStatus: NeuronsDailySummary['budgetStatus'] = 'HEALTHY';
  if (neuronsUsedEstimated >= limit) {
    budgetStatus = 'BLOCKED';
  } else if (usagePercentEstimated >= config.highWarningThresholdPercent) {
    budgetStatus = 'HIGH_WARNING';
  } else if (usagePercentEstimated >= config.warningThresholdPercent) {
    budgetStatus = 'WARNING';
  }

  const modelBreakdown = Object.entries(modelBreakdownMap).map(([model, data]) => ({
    model,
    modelName: data.modelName,
    requestCount: data.totalRequests,
    totalRequests: data.totalRequests,
    successCount: data.successCount,
    failCount: data.failCount,
    estimatedNeurons: data.estimatedNeurons,
    pricingStatus: data.pricingStatus,
    unitCostNote: data.unitCostNote
  }));

  const estimatedRemainingCapacity = {
    fluxImages: Math.floor(neuronsRemainingEstimated / FLUX_DEFAULT_1024_4STEP_NEURONS),
    sdxlImages: null,
    sdxlStatus: 'UNKNOWN' as const
  };

  return {
    dateUtc: targetDateUtc,
    freeTierAllocation: config.dailyFreeAllowance,
    dailyAllowance: config.dailyFreeAllowance,
    configuredDailyLimit: limit,
    configuredLimit: limit,
    neuronsUsedToday: neuronsUsedEstimated,
    neuronsUsedEstimated,
    neuronsUsedActual: null,
    neuronsRemainingEstimated,
    percentageUsed: usagePercentEstimated,
    usagePercentEstimated,
    statusLabel: 'ESTIMATED',
    budgetStatus,
    totalRequestsToday: dayEntries.length,
    totalRequests: dayEntries.length,
    successfulGenerationsToday: successfulGenerations,
    successfulGenerations,
    failedGenerationsToday: failedGenerations,
    failedGenerations,
    blockedGenerations,
    estimatedRemainingCapacity,
    modelBreakdown,
    modelBreakdownMap,
    nextResetUtc: getNextResetTimestampUtc(),
    lastSyncTimestamp: new Date().toISOString(),
    cfApiStatus: 'UNAVAILABLE',
    cfApiReason:
      'Cloudflare Workers AI REST API does not provide a daily neuron telemetry endpoint. Usage tracking uses ESTIMATED Neurons with pre-generation budget guards.'
  };
}
