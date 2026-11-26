/**
 * RancangLoka — Budi Smart Provider Router
 * 
 * Selects image generation provider dynamically PER SLOT:
 * - Kling: architectural spaces, interiors, exteriors, material textures, wide spatial contexts.
 * - Seedream: complex installation details, micro-technical objects, cutaways, application actions & interactions.
 * - Cloudflare AI: zero-cost fast mock / fallback provider.
 * 
 * Enforces evidence-based exceptions, cost controls, and fallback policies.
 */

export type VisualProviderType = 'kling' | 'seedream' | 'cloudflare';

export interface SlotProviderRecommendation {
  slot_key: string;
  recommended_provider: VisualProviderType;
  model_id: string;
  unit_cost_usd: number;
  reason: string;
  is_technical_action: boolean;
}

export const PROVIDER_UNIT_COSTS: Record<VisualProviderType, number> = {
  kling: 0.0140, // Kling Image 3.0 1K Native Default (4 units)
  seedream: 0.0675, // Seedream v5 Pro
  cloudflare: 0.0000 // Cloudflare Workers AI free tier
};

/**
 * Determines whether a slot intent represents technical action, micro-installation, or cutaway
 */
export function isTechnicalActionOrInstallation(text: string): boolean {
  const normalized = text.toLowerCase();
  const technicalKeywords = [
    'aplikasi', 'mengaplikasikan', 'pemasangan', 'memasang', 'lapisan', 'trowel', 
    'kuas', 'roller', 'slurry', 'mesh', 'fiberglass', 'pengeleman', 'las', 'torch',
    'bakar', 'potongan', 'detail sambungan', 'chamfer', 'fillet', 'screed', 'adukan',
    'close-up', 'makro', 'pengecatan', 'pelapisan', 'sealant', 'nat', 'tali air'
  ];
  return technicalKeywords.some(kw => normalized.includes(kw));
}

/**
 * Evaluates a visual slot and routes it to the optimal provider
 */
export function routeVisualSlotProvider(slot: {
  slot_key: string;
  role?: string;
  title?: string;
  prompt?: string;
  caption?: string;
  target_heading?: string | null;
}, options?: {
  budgetRemainingUsd?: number;
  forceProvider?: VisualProviderType;
}): SlotProviderRecommendation {
  if (options?.forceProvider) {
    return {
      slot_key: slot.slot_key,
      recommended_provider: options.forceProvider,
      model_id: options.forceProvider === 'seedream' ? 'bytedance/seedream/v5/pro/text-to-image' : 'kling-v3',
      unit_cost_usd: PROVIDER_UNIT_COSTS[options.forceProvider],
      reason: `Forced override to ${options.forceProvider}`,
      is_technical_action: false
    };
  }

  const combinedContext = [
    slot.slot_key,
    slot.title || '',
    slot.prompt || '',
    slot.caption || '',
    slot.target_heading || ''
  ].join(' ');

  const isTechnical = isTechnicalActionOrInstallation(combinedContext);
  const budgetRemaining = options?.budgetRemainingUsd ?? 0.30;

  // Cover Hero is almost always architectural space/exterior/interior => Kling
  if (slot.slot_key === 'cover_hero' || slot.role === 'featured') {
    return {
      slot_key: slot.slot_key,
      recommended_provider: 'kling',
      model_id: 'kling-v3',
      unit_cost_usd: PROVIDER_UNIT_COSTS.kling,
      reason: 'Hero cover architectural exterior/interior composition with superior spatial lighting (Kling)',
      is_technical_action: false
    };
  }

  // Pre-closing decision slot is typically finished architectural space => Kling
  if (slot.slot_key.includes('pre_closing') || combinedContext.includes('pre-closing') || combinedContext.includes('keputusan')) {
    return {
      slot_key: slot.slot_key,
      recommended_provider: 'kling',
      model_id: 'kling-v3',
      unit_cost_usd: PROVIDER_UNIT_COSTS.kling,
      reason: 'Pre-closing finished architectural space and human scale outcome (Kling)',
      is_technical_action: false
    };
  }

  // Technical installation action or micro details => Seedream (if budget allows)
  if (isTechnical) {
    if (budgetRemaining >= PROVIDER_UNIT_COSTS.seedream) {
      return {
        slot_key: slot.slot_key,
        recommended_provider: 'seedream',
        model_id: 'bytedance/seedream/v5/pro/text-to-image',
        unit_cost_usd: PROVIDER_UNIT_COSTS.seedream,
        reason: 'Complex installation detail, tool interaction, and material layering (Seedream)',
        is_technical_action: true
      };
    } else {
      // Fallback to Kling when budget is tight
      return {
        slot_key: slot.slot_key,
        recommended_provider: 'kling',
        model_id: 'kling-v3',
        unit_cost_usd: PROVIDER_UNIT_COSTS.kling,
        reason: 'Budget constraint fallback: routed to Kling for technical detail',
        is_technical_action: true
      };
    }
  }

  // Default architectural texture or space => Kling
  return {
    slot_key: slot.slot_key,
    recommended_provider: 'kling',
    model_id: 'kling-v3',
    unit_cost_usd: PROVIDER_UNIT_COSTS.kling,
    reason: 'Architectural space and macro material texture (Kling)',
    is_technical_action: false
  };
}

/**
 * Plans complete 5-slot provider allocation while enforcing budget hard cap
 */
export function planFiveSlotProviderAllocation(slots: Array<{
  slot_key: string;
  role?: string;
  title?: string;
  prompt?: string;
  caption?: string;
  target_heading?: string | null;
}>, maxBudgetUsd: number = 0.30): {
  allocations: SlotProviderRecommendation[];
  totalExpectedCostUsd: number;
  withinBudget: boolean;
} {
  let budgetRemaining = maxBudgetUsd;
  const allocations: SlotProviderRecommendation[] = [];
  let totalCost = 0;

  for (const slot of slots) {
    const recommendation = routeVisualSlotProvider(slot, { budgetRemainingUsd: budgetRemaining });
    allocations.push(recommendation);
    totalCost += recommendation.unit_cost_usd;
    budgetRemaining -= recommendation.unit_cost_usd;
  }

  return {
    allocations,
    totalExpectedCostUsd: Math.round(totalCost * 10000) / 10000,
    withinBudget: totalCost <= maxBudgetUsd
  };
}
