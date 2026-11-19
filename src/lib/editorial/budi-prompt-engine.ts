/**
 * RancangLoka — Budi: Visual Prompt Engineering Engine (HERMES-VISUAL-EDITORIAL-V1)
 *
 * Budi (Media Operations / Primary Visual Worker) consumes Nadia's Visual Storyboard
 * and translates editorial narrative & Irwan's physical construction constraints
 * into high-fidelity image generation prompts.
 *
 * TWO DISTINCT OPERATIONAL MODES:
 * 1. BENCHMARK MODE:
 *    Generates neutral, standardized prompts across models to objectively
 *    evaluate raw architectural comprehension, material rendering, and lighting physics.
 * 2. PRODUCTION MODE:
 *    Tailors prompt tokens, aspect ratios, and negative constraints to the exact
 *    strengths and idiosyncrasies of specific model engines (e.g. FLUX vs Nano Banana vs Seedream).
 */

import type { VisualStoryboard, StoryboardInlineSlot, StoryboardCoverSpec, VisualIntentContract } from './nadia-visual-storyboard.ts';
import {
  compileHumanCastingPromptTokens,
  CANONICAL_HUMAN_CASTING_NEGATIVES,
  type HumanCastingSpec
} from './local-human-casting-policy.ts';

export const SEEDREAM_PRO_MODEL_ID = 'bytedance/seedream/v5/pro/text-to-image';
export const NANO_BANANA_PRO_MODEL_ID = 'fal-ai/nano-banana-pro';
export const SEEDREAM_PRICE_USD = 0.0675;
export const NANO_BANANA_PRO_PRICE_USD = 0.1500;

// Kling AI Image Models (Experimental Provider)
// Official Kling rates: 2K = 8 units ($0.0280 list, $0.0196 trial prepaid)
// 4K = 16 units ($0.0560 list, $0.0392 trial prepaid)
export const KLING_V3_MODEL_ID = 'kling-v3';
export const KLING_V3_OMNI_MODEL_ID = 'kling-v3-omni';
export const KLING_V3_PRICE_USD = 0.0280; // 8 units 2K list price
export const KLING_V3_OMNI_PRICE_USD = 0.0280; // 8 units 2K list price
export const KLING_V3_4K_PRICE_USD = 0.0560; // 16 units 4K list price
export const KLING_TRIAL_PREPAID_RATE_PER_UNIT_USD = 0.00245;
export const KLING_2K_EFFECTIVE_PREPAID_USD = 0.0196; // 8 units * $0.00245
export const KLING_4K_EFFECTIVE_PREPAID_USD = 0.0392; // 16 units * $0.00245

export interface DeepPromptStructure {
  editorial_objective: string;
  primary_subject: string;
  spatial_relationships: string;
  buildable_architecture: string;
  camera_composition: string;
  lighting: string;
  material_realism: string;
  human_scale_lived_in: string;
  required_visual_evidence: string[];
  negative_constraints: string[];
}

export interface DeepPromptSpecification {
  slot_key: string;
  article_slug: string;
  target_model: string;
  mode: 'DEEP_V2';
  structure: DeepPromptStructure;
  compiled_prompt: string;
  negative_prompt: string;
  aspect_ratio: string;
  width: number;
  height: number;
  estimated_cost_usd: number;
  is_seedream_default: boolean;
  fallback_model: string;
  fallback_cost_usd: number;
  provenance: {
    crafted_by: 'Budi (Media Operations)';
    timestamp: string;
    version: 'V2_DEEP_EDITORIAL';
  };
}

export interface PromptSpecification {
  slot_key: string;
  article_slug: string;
  target_model: string;
  mode: 'BENCHMARK' | 'PRODUCTION' | 'DEEP_V2';
  aspect_ratio: string;
  width: number;
  height: number;
  positive_prompt: string;
  negative_prompt: string;
  recommended_steps?: number;
  guidance_scale?: number;
  estimated_cost_usd: number;
  irwan_constraints_enforced: string[];
  provenance: {
    storyboard_hash: string;
    crafted_by: 'Budi (Media Operations)';
    timestamp: string;
  };
}

export const CANONICAL_IRWAN_ARCHITECTURAL_CONSTRAINTS = [
  'Pencahayaan alami tropis seimbang tanpa overexposure atau specular glare berlebih',
  'Material bangunan autentik Indonesia: acian semen halus, bata ekspos terra-cotta rapi, kayu jati/bengkirai matte, lantai teraso/beton poles',
  'Skala ruang proporsional manusia (lebar 5-6 meter, tinggi plafon 3.0-3.5 meter)',
  'Struktur konstruksi masuk akal: ada kolom praktis, balok pengikat, tidak ada kantilever melayang tanpa tumpuan',
  'Elemen ventilasi berfungsi: kisi jalusi, lubang roster tembus udara, talang perimeter pada inner court'
];

export const CANONICAL_NEGATIVE_CONSTRAINTS = [
  'oversaturated',
  'glossy 3D CGI render',
  'cartoon',
  'anime',
  'illustration',
  'distorted architecture',
  'impossible structural geometry',
  'floating columns',
  'broken staircases',
  'blurry textures',
  'watermark',
  'text overlay',
  'brand logos',
  'warped furniture',
  'disfigured human figures',
  'closed ceiling without light',
  ...CANONICAL_HUMAN_CASTING_NEGATIVES
].join(', ');

/**
 * Budi compiles prompts for all slots in a Visual Storyboard.
 */
export function buildPromptMatrix(
  storyboard: VisualStoryboard,
  mode: 'BENCHMARK' | 'PRODUCTION' = 'BENCHMARK',
  selectedModels: string[] = ['fal-ai/flux/schnell', 'fal-ai/nano-banana-pro', 'bytedance/seedream/v5/pro/text-to-image']
): PromptSpecification[] {
  const specs: PromptSpecification[] = [];
  const now = new Date().toISOString();

  // Price lookup for estimated costs (Verified fal.ai registry)
  const priceMap: Record<string, number> = {
    'fal-ai/flux/schnell': 0.0035,
    'fal-ai/nano-banana': 0.0400,
    'fal-ai/nano-banana-pro': 0.1500,
    'bytedance/seedream/v5/lite/text-to-image': 0.0350,
    'bytedance/seedream/v5/pro/text-to-image': 0.0675,
    'fal-ai/z-image/turbo': 0.0050,
    'fal-ai/recraft/v3/text-to-image': 0.0400,
    'kling-v3': KLING_V3_PRICE_USD,
    'kling-v3-omni': KLING_V3_OMNI_PRICE_USD
  };

  // 1. COVER HERO PROMPT
  for (const model of selectedModels) {
    const cost = priceMap[model] || 0.02;

    let positivePrompt = '';
    if (mode === 'BENCHMARK') {
      positivePrompt = [
        'Photorealistic architectural photograph of a contemporary Indonesian narrow townhouse interior, 5 meters width.',
        'View looking from front living area toward a central open-air inner courtyard lightwell bringing diffused vertical daylight.',
        'Polished concrete floor, warm teak timber louver partitions, neat white painted walls, lush tropical potted plants (monstera, fiddle leaf fig).',
        'Realistic eye-level perspective, natural daylight exposure, soft shadows, sharp architectural geometry, authentic Jakarta residential context.',
        'No people, no text, no watermarks, no CGI glossy plastic look.'
      ].join(' ');
    } else {
      // PRODUCTION MODE (Optimized per model)
      if (model.includes('banana-pro')) {
        positivePrompt = [
          'High-end architectural editorial photography for an Indonesian design magazine.',
          'Interior of an urban 5-meter wide rowhouse in Jakarta featuring an open-concept living and dining space connected to a central landscaped lightwell.',
          'Diffuse overhead tropical sunlight cascading through vertical airwell, natural material textures including matte cement plaster, hand-crafted teak timber screens, and porous terracotta breeze blocks.',
          'Balanced natural lighting, natural chromatic fidelity, clean spatial depth, straight vertical lines, 35mm architectural lens photography.'
        ].join(' ');
      } else if (model.includes('flux')) {
        positivePrompt = [
          'Architectural photograph of a modern 5-meter wide tropical Indonesian home interior.',
          'Living room seamlessly flowing into a bright central lightwell with indoor garden.',
          'Teak wood louvers, exposed brick accent, smooth concrete floor, tropical indoor greenery.',
          'Bright daylighting from above, crisp geometric shadows, authentic architectural proportion, clean realism.'
        ].join(' ');
      } else {
        positivePrompt = [
          'High-resolution architectural photography of Indonesian narrow residential interior, 5 meters width.',
          'Central courtyard garden with skylight, connecting living room and dining room.',
          'Natural teak timber, off-white plastered walls, tropical greenery, warm diffuse natural lighting, professional photography.'
        ].join(' ');
      }
    }

    specs.push({
      slot_key: storyboard.cover.slot_key,
      article_slug: storyboard.article_slug,
      target_model: model,
      mode,
      aspect_ratio: '1312:672',
      width: 1312,
      height: 672,
      positive_prompt: positivePrompt,
      negative_prompt: CANONICAL_NEGATIVE_CONSTRAINTS,
      estimated_cost_usd: cost,
      irwan_constraints_enforced: CANONICAL_IRWAN_ARCHITECTURAL_CONSTRAINTS,
      provenance: {
        storyboard_hash: storyboard.provenance_hash,
        crafted_by: 'Budi (Media Operations)',
        timestamp: now
      }
    });
  }

  // 2. INLINE SLOTS PROMPTS
  for (const slot of storyboard.inline_slots) {
    // If it's a technical SVG diagram (like void tangga stack effect), Budi notes that SVG generator is preferred
    if (slot.visual_media_type === 'TECHNICAL_DIAGRAM_SVG') {
      for (const model of selectedModels) {
        specs.push({
          slot_key: slot.slot_key,
          article_slug: storyboard.article_slug,
          target_model: 'deterministic/svg-diagram-engine', // Deterministic fallback
          mode,
          aspect_ratio: '1200:800',
          width: 1200,
          height: 800,
          positive_prompt: `DETERMINISTIC_SVG: Architectural cross-section of two-story stair void illustrating stack-effect thermal airflow with blue inlet arrows at ground level and red outlet arrows exiting through clerestory louvers.`,
          negative_prompt: 'NONE_DETERMINISTIC_SVG',
          estimated_cost_usd: 0.0,
          irwan_constraints_enforced: slot.irwan_structural_constraints,
          provenance: {
            storyboard_hash: storyboard.provenance_hash,
            crafted_by: 'Budi (Media Operations)',
            timestamp: now
          }
        });
      }
      continue;
    }

    // Photo-realistic slots (e.g. inner court, sekat roster)
    for (const model of selectedModels) {
      const cost = priceMap[model] || 0.02;

      let prompt = '';
      if (slot.slot_key.includes('inner_court')) {
        prompt = [
          'Detailed architectural photo of a compact 1.5 x 2 meter indoor dry garden (inner court) in a narrow Jakarta townhouse.',
          'Pebble floor with perimeter drainage grating, architectural sliding glass doors, white plastered walls reflecting zenith daylight.',
          'A single lush fiddle leaf fig tree in modern ceramic pot, vertical metal security grille above.',
          'Eye-level shot, sharp textures, natural daylight, professional architectural interior photography.'
        ].join(' ');
      } else if (slot.slot_key.includes('sekat')) {
        prompt = [
          'Architectural detail photo of a decorative terracotta breeze block (roster) partition wall dividing living area and foyer.',
          'Geometric lattice pattern casting subtle geometric daylight shadows across a polished concrete floor.',
          'View looking through the perforations toward a softly blurred contemporary dining room in the background.',
          'Warm tropical daylight, authentic Indonesian artisanal masonry, clean mortar joints, true material texture.'
        ].join(' ');
      } else {
        prompt = `Architectural photograph illustrating ${slot.educational_purpose} in an Indonesian residential context with natural daylight and realistic materials.`;
      }

      specs.push({
        slot_key: slot.slot_key,
        article_slug: storyboard.article_slug,
        target_model: model,
        mode,
        aspect_ratio: '1024:768',
        width: 1024,
        height: 768,
        positive_prompt: prompt,
        negative_prompt: CANONICAL_NEGATIVE_CONSTRAINTS,
        estimated_cost_usd: cost,
        irwan_constraints_enforced: slot.irwan_structural_constraints,
        provenance: {
          storyboard_hash: storyboard.provenance_hash,
          crafted_by: 'Budi (Media Operations)',
          timestamp: now
        }
      });
    }
  }

  return specs;
}

/**
 * Budi Deep Prompt Engineering V2 (HERMES-VISUAL-EDITORIAL-V2)
 *
 * Implements the full 10-section prompt structure (A through J):
 * A. EDITORIAL OBJECTIVE
 * B. PRIMARY SUBJECT
 * C. SPATIAL RELATIONSHIPS
 * D. BUILDABLE ARCHITECTURE
 * E. CAMERA & COMPOSITION
 * F. LIGHTING
 * G. MATERIAL REALISM
 * H. HUMAN SCALE & LIVED-IN QUALITY
 * I. REQUIRED VISUAL EVIDENCE
 * J. NEGATIVE CONSTRAINTS
 *
 * Defaults to Seedream 5.0 Pro ($0.0675) with Nano Banana Pro ($0.1500) as premium fallback.
 */
export function buildDeepPromptV2(
  contract: VisualIntentContract,
  options?: {
    article_slug?: string;
    target_model?: string;
    width?: number;
    height?: number;
    aspect_ratio?: string;
    human_casting?: HumanCastingSpec;
  }
): DeepPromptSpecification {
  const model = options?.target_model || SEEDREAM_PRO_MODEL_ID;
  const isCover = contract.slot_key === 'cover_hero';
  const width = options?.width || (isCover ? 1312 : 1312);
  const height = options?.height || (isCover ? 672 : 672);
  const aspectRatio = options?.aspect_ratio || (isCover ? '1312:672' : '1312:672');
  const slug = options?.article_slug || 'menata-denah-rumah-lebar-5-6-meter';

  let structure: DeepPromptStructure;

  if (isCover && (slug.includes('denah') || contract.main_problem?.includes('5–6 meter'))) {
    structure = {
      editorial_objective:
        'Demonstrate how a narrow 5-meter Indonesian townhouse achieves a bright, breezy, and open atmosphere through an unroofed central inner court connecting living and dining areas without dark solid partitions.',
      primary_subject:
        'Eye-level architectural photograph from the foreground living seating area looking across an open-air central landscaped courtyard toward a softly visible dining area in the background. The 5-meter wide layout feels continuous and expansive with no corridor effect.',
      spatial_relationships:
        'Living area with comfortable modern sofa and coffee table in foreground, expansive floor-to-ceiling glass sliding doors opening to a central lightwell courtyard in midground, clean dining area and stair void softly visible in background.',
      buildable_architecture:
        'True constructible residential architecture: visible structural reinforced concrete lintel beam above openings, black powder-coated aluminum sliding glass panels partially open, polished concrete floor, matte off-white plaster walls, compact indoor gravel garden bed.',
      camera_composition:
        'Realistic eye-level perspective, 35mm architectural lens, sharp straight vertical lines, balanced composition emphasizing spatial depth and horizontal connectivity across the 5-meter width.',
      lighting:
        'Zenith diffuse tropical daylight cascading vertically from the open sky down into the living core, soft ambient fill light, realistic subtle shadows, natural daytime illumination of Jakarta without harsh artificial flares.',
      material_realism:
        'Authentic Indonesian interior materials: warm natural teak wood furniture, indoor potted monstera and fiddle-leaf fig, clean mortar lines, natural plaster roughness, lived-in warmth without commercial showroom staging.',
      human_scale_lived_in:
        'Human-scale furniture proportion for a 5-meter wide home: sofa, books on low table, ceramic planter, feeling genuinely lived-in and comfortable rather than sterile or empty.',
      required_visual_evidence: [
        '5-meter wide spatial proportion with 3.2m ceiling',
        'Vertical lightwell with real open sky daylight spill',
        'Living room seating in foreground connecting to central court',
        'Operable sliding glass connection on black aluminum frame',
        'Visible concrete lintel beam providing structural plausibility'
      ],
      negative_constraints: [
        'narrow empty corridor',
        'hotel hallway trap',
        'closed glass skylight ceiling',
        'sealed roof greenhouse',
        'commercial showroom staging',
        'impossible structural spans',
        'floating columns',
        'oversaturated CGI render',
        'watermark',
        'text overlay',
        'distorted furniture',
        'repeated synthetic plants'
      ]
    };
  } else if (isCover) {
    structure = {
      editorial_objective: contract.reader_takeaway || contract.main_problem,
      primary_subject: contract.visual_solution_idea || contract.primary_elements_and_relations,
      spatial_relationships: contract.primary_elements_and_relations || 'Authentic Indonesian residential atmosphere with natural lighting and lived-in context.',
      buildable_architecture: 'Standard constructible Indonesian residential architecture with realistic structural proportions.',
      camera_composition: contract.camera_and_context || 'Eye-level 35mm architectural lens, straight verticals, balanced composition.',
      lighting: 'Zenith diffuse tropical daylight, soft ambient fill light, subtle shadows, authentic natural lighting.',
      material_realism: 'Authentic Indonesian interior/exterior materials: matte plaster, natural timber, authentic textures without CGI glossiness.',
      human_scale_lived_in: 'Realistic human scale, comfortably furnished, warm and inviting atmosphere.',
      required_visual_evidence: contract.required_visual_evidence || ['Real constructible proportions', 'Natural lighting', 'Authentic materials'],
      negative_constraints: contract.errors_to_avoid || CANONICAL_NEGATIVE_CONSTRAINTS
    };
  } else if (contract.slot_key.includes('inner_court')) {
    structure = {
      editorial_objective:
        'Visually explain the technical cross-section and floor transition of a compact 1.5 x 2 meter unroofed inner court, demonstrating how rainwater drainage and air ventilation work simultaneously without splashing indoors.',
      primary_subject:
        'Eye-level detailed architectural perspective focused on the physical boundary between an indoor dining room and an unroofed 1.5 x 2 meter central courtyard lightwell.',
      spatial_relationships:
        'Indoor polished floor in immediate foreground stepping down 5-10cm to an unroofed central gravel garden bed, with black aluminum sliding glass doors pushed aside along the boundary.',
      buildable_architecture:
        'True open-to-sky void without any glass roof or closed ceiling. A 5-10cm floor level drop from the polished terrazzo dining floor down to a perimeter sunken gravel trench with grey river pebbles for rainwater absorption and floor drain grating. Black aluminum sliding glass doors resting on a concrete curb sill.',
      camera_composition:
        'Medium architectural perspective (35mm-50mm), eye-level framing capturing both the sunken pebble bed, the operable door track on raised curb, and the vertical void walls opening to the sky.',
      lighting:
        'Direct overhead tropical daylight from the clear zenith sky, natural outdoor exposure, authentic humid tropical Jakarta ambience, soft diffused reflections on damp river pebbles.',
      material_realism:
        'Rough textured grey river pebbles, matte water-resistant plaster walls, robust tropical foliage (alocasia, ferns in planters), functional hardware and weather seals on sliding door track.',
      human_scale_lived_in:
        'Realistic residential scale of 1.5 x 2 meter court: dining chair edge visible in dry zone, clean drainage curb, operable glass doors showing realistic architectural utility.',
      required_visual_evidence: [
        'True open sky above without glass canopy or glazing',
        'Sunken perimeter gravel drainage bed catching rain runoff',
        '5-10cm step-down level transition between dry interior and wet court',
        'Operable sliding glass door on raised concrete sill'
      ],
      negative_constraints: [
        'closed glass ceiling',
        'greenhouse glass roof',
        'flat floor without drainage curb',
        'water splashing on wooden floor',
        'oversized luxury garden',
        'swimming pool',
        'impossible cantilever',
        'glossy 3D CGI render',
        'watermark',
        'text overlay',
        'distorted door frame'
      ]
    };
  } else {
    structure = {
      editorial_objective: contract.reader_takeaway,
      primary_subject: contract.primary_elements_and_relations,
      spatial_relationships: contract.primary_elements_and_relations,
      buildable_architecture: 'Standard constructible Indonesian residential masonry with practical columns and concrete lintels.',
      camera_composition: contract.camera_and_context,
      lighting: 'Natural tropical daylighting, soft ambient exposure.',
      material_realism: 'Matte plastered masonry, authentic Indonesian timber and polished flooring.',
      human_scale_lived_in: 'Domestic lived-in Indonesian townhouse atmosphere.',
      required_visual_evidence: contract.required_visual_evidence,
      negative_constraints: contract.errors_to_avoid
    };
  }

  // Local Human Casting Policy v1.0 Injection
  const castingSpec = options?.human_casting || contract.human_casting;
  const castingTokens = compileHumanCastingPromptTokens(castingSpec);

  if (castingTokens.is_active) {
    structure.human_scale_lived_in = `${structure.human_scale_lived_in} [LOCAL HUMAN CASTING v1.0] ${castingTokens.positive_tokens}`;
  } else {
    structure.human_scale_lived_in = `${structure.human_scale_lived_in} (Unpopulated architectural interior, pure space without human figures)`;
  }

  structure.negative_constraints = Array.from(
    new Set([...structure.negative_constraints, ...castingTokens.negative_tokens])
  );

  // Synthesize compiled prompt for Seedream / target model
  const compiledPrompt = [
    `Photorealistic architectural photograph for RancangLoka editorial magazine.`,
    `[EDITORIAL OBJECTIVE] ${structure.editorial_objective}`,
    `[PRIMARY SUBJECT & SPATIAL FLOW] ${structure.primary_subject} ${structure.spatial_relationships}`,
    `[BUILDABLE ARCHITECTURE & DETAILS] ${structure.buildable_architecture}`,
    `[CAMERA & COMPOSITION] ${structure.camera_composition}`,
    `[LIGHTING & ATMOSPHERE] ${structure.lighting}`,
    `[MATERIAL REALISM & LIVED-IN] ${structure.material_realism} ${structure.human_scale_lived_in}`,
    `[REQUIRED VISUAL EVIDENCE] Must clearly show: ${structure.required_visual_evidence.join(', ')}.`
  ].join(' ');

  const negativePrompt = structure.negative_constraints.join(', ');

  return {
    slot_key: contract.slot_key,
    article_slug: slug,
    target_model: model,
    mode: 'DEEP_V2',
    structure,
    compiled_prompt: compiledPrompt,
    negative_prompt: negativePrompt,
    aspect_ratio: aspectRatio,
    width,
    height,
    estimated_cost_usd: model === SEEDREAM_PRO_MODEL_ID ? SEEDREAM_PRICE_USD : NANO_BANANA_PRO_PRICE_USD,
    is_seedream_default: model === SEEDREAM_PRO_MODEL_ID,
    fallback_model: NANO_BANANA_PRO_MODEL_ID,
    fallback_cost_usd: NANO_BANANA_PRO_PRICE_USD,
    provenance: {
      crafted_by: 'Budi (Media Operations)',
      timestamp: new Date().toISOString(),
      version: 'V2_DEEP_EDITORIAL'
    }
  };
}
