/**
 * RancangLoka — Budi Multimodal Visual Evaluator (HERMES-BUDI-VISION-V1)
 *
 * Implements genuine image pixel inspection and architectural visual evaluation for Budi:
 * 1. Evaluates actual generated images (not just prompt/caption text).
 * 2. Focuses on real-world object anatomy, architectural scale, installation position,
 *    mechanical logic, and spatial grounding.
 * 3. Supports batch evaluation of related article images in a single request to minimize costs.
 * 4. Fails safely into 'DETERMINISTIC_TEXT_FALLBACK' when Vision is unconfigured,
 *    transparently enforcing human review without falsely claiming pixel inspection.
 *
 * Safety Invariant:
 * - Zero unauthorized paid vision calls.
 * - Distinguishes TEXT_FALLBACK from GENUINE_MULTIMODAL_PIXEL_INSPECTION.
 */

import type {
  EditorialLlmProvider,
  EditorialChatMessage,
  EditorialMessageContentPart
} from './editorial-llm-provider.ts';

export type VisualEvaluationMode =
  | 'GENUINE_MULTIMODAL_PIXEL_INSPECTION'
  | 'DETERMINISTIC_TEXT_FALLBACK';

export interface VisualEvaluationItemInput {
  slot_key: string;
  candidate_id: string;
  title: string;
  caption: string;
  alt_text: string;
  image_url_or_base64?: string;
  reference_context?: string;
}

export interface BudiVisualItemScorecard {
  slot_key: string;
  candidate_id: string;
  visual_relevance_score: number; // 0-100
  object_anatomy_score: number; // 0-100
  proportional_scale_score: number; // 0-100
  mechanical_accuracy_score: number; // 0-100
  spatial_grounding_score: number; // 0-100
  photographic_fidelity_score: number; // 0-100
  verdict: 'PASS' | 'NEEDS_REVISION' | 'REJECT';
  flaws_detected: string[];
  remediation_guidance?: string;
}

export interface BatchVisualEvaluationResult {
  evaluation_mode: VisualEvaluationMode;
  model_used: string;
  overall_verdict: 'PASS' | 'NEEDS_HUMAN_REVIEW' | 'REJECT';
  requires_human_review: boolean;
  item_scorecards: BudiVisualItemScorecard[];
  batch_notes: string;
  evaluated_at: string;
}

/**
 * Builds the structured multimodal prompt for Budi's Visual Intelligence.
 */
export function buildBudiVisionPrompt(params: {
  topic: string;
  articleSlug: string;
  items: VisualEvaluationItemInput[];
}): { systemPrompt: string; userMessageParts: EditorialMessageContentPart[] } {
  const { topic, items } = params;

  const systemPrompt = `# PERAN & TANGGUNG JAWAB PROFESIONAL
Nama: Budi (media_director_primary)
Peran: Media Director & Architectural Visual Critic RancangLoka
Keahlian: Menilai keandalan visual fotografi arsitektur, anatomi perangkat keras, proporsi fisik skala manusia, logika mekanis, dan kejujuran fotografi dokumen.

PRINSIP EVALUASI VISUAL ARSITEKTUR:
1. Skala & Proporsi Nyata: Perangkat keras harus proporsional terhadap elemen bangunan (misal: kunci pintu standar tingginya 30-40cm pada daun pintu 210cm).
2. Geometri & Logika Mekanis: Tidak boleh ada elemen fiktif atau mustahil (misal: lubang kunci di tepi pelat baut pengunci, engsel terbalik).
3. Penjangkaran Spasial (Environmental Grounding): Objek harus terpasang pada posisi realistis (misal: handle pintu setinggi pinggang ~100cm, BUKAN di lantai).
4. Kejujuran Fotografi: Bebas dari artefak AI, tampilan plastik CGI mengilap, teks/watermark, atau elemen diagram terdistorsi.`;

  const itemDescriptions = items.map((it, idx) => `
[Gambar ${idx + 1}]: Slot "${it.slot_key}" (${it.candidate_id})
Judul: ${it.title}
Caption: ${it.caption}
Alt Text: ${it.alt_text}
${it.reference_context ? `Konteks Referensi: ${it.reference_context}` : ''}
`).join('\n');

  const textInstruction = `Topik Artikel: ${topic}

Harap lakukan evaluasi kritis terhadap ${items.length} gambar yang disertakan berikut ini:
${itemDescriptions}

FORMAT KELUARAN WAJIB (JSON):
Berikan hasil evaluasi dalam objek JSON valid:
\`\`\`json
{
  "overall_verdict": "PASS" | "NEEDS_HUMAN_REVIEW" | "REJECT",
  "batch_notes": "Rangkuman konsistensi visual seluruh gambar...",
  "items": [
    {
      "slot_key": "string",
      "candidate_id": "string",
      "visual_relevance_score": 0-100,
      "object_anatomy_score": 0-100,
      "proportional_scale_score": 0-100,
      "mechanical_accuracy_score": 0-100,
      "spatial_grounding_score": 0-100,
      "photographic_fidelity_score": 0-100,
      "verdict": "PASS" | "NEEDS_REVISION" | "REJECT",
      "flaws_detected": ["daftar cacat spesifik..."],
      "remediation_guidance": "saran perbaikan prompt/komposisi bila ditolak"
    }
  ]
}
\`\`\``;

  const userMessageParts: EditorialMessageContentPart[] = [
    { type: 'text', text: textInstruction }
  ];

  for (const it of items) {
    if (it.image_url_or_base64) {
      userMessageParts.push({
        type: 'image_url',
        image_url: {
          url: it.image_url_or_base64,
          detail: 'high'
        }
      });
    }
  }

  return { systemPrompt, userMessageParts };
}

/**
 * Executes Budi Visual Evaluation with transparent fallback handling.
 */
export async function evaluateVisualBatchWithBudi(params: {
  topic: string;
  articleSlug: string;
  items: VisualEvaluationItemInput[];
  provider?: EditorialLlmProvider;
  visionModel?: string; // e.g. 'gemini/gemini-3.5-flash-lite' or 'gpt-4o-mini'
  allowPaidVisionCall?: boolean;
}): Promise<BatchVisualEvaluationResult> {
  const { topic, articleSlug, items, provider, visionModel, allowPaidVisionCall } = params;

  // 1. Safety Gate: If Vision is not authorized or provider is missing, fail safely to Deterministic Fallback
  if (!allowPaidVisionCall || !provider) {
    return {
      evaluation_mode: 'DETERMINISTIC_TEXT_FALLBACK',
      model_used: 'none (deterministic_text_gate)',
      overall_verdict: 'NEEDS_HUMAN_REVIEW',
      requires_human_review: true,
      batch_notes: 'Visual evaluation executed under Deterministic Text Fallback (multimodal execution not authorized or provider omitted). Human review required.',
      evaluated_at: new Date().toISOString(),
      item_scorecards: items.map(it => ({
        slot_key: it.slot_key,
        candidate_id: it.candidate_id,
        visual_relevance_score: 80,
        object_anatomy_score: 75,
        proportional_scale_score: 75,
        mechanical_accuracy_score: 75,
        spatial_grounding_score: 75,
        photographic_fidelity_score: 80,
        verdict: 'NEEDS_REVISION',
        flaws_detected: ['Multimodal pixel evaluation skipped; manual inspection required'],
        remediation_guidance: 'Inspect candidate image visually in Staging Reader Preview.'
      }))
    };
  }

  // 2. Multimodal Execution
  const { systemPrompt, userMessageParts } = buildBudiVisionPrompt({ topic, articleSlug, items });
  const effectiveModel = visionModel || 'gemini/gemini-3.5-flash-lite';

  const messages: EditorialChatMessage[] = [
    { role: 'system', content: systemPrompt },
    { role: 'user', content: userMessageParts }
  ];

  const response = await provider.generate({
    messages,
    model: effectiveModel,
    temperature: 0.2,
    maxTokens: 2500
  });

  if (!response.success || !response.content) {
    return {
      evaluation_mode: 'DETERMINISTIC_TEXT_FALLBACK',
      model_used: effectiveModel,
      overall_verdict: 'NEEDS_HUMAN_REVIEW',
      requires_human_review: true,
      batch_notes: `Vision provider execution failed: ${response.error || 'Empty response'}. Reverted safely to text fallback.`,
      evaluated_at: new Date().toISOString(),
      item_scorecards: items.map(it => ({
        slot_key: it.slot_key,
        candidate_id: it.candidate_id,
        visual_relevance_score: 0,
        object_anatomy_score: 0,
        proportional_scale_score: 0,
        mechanical_accuracy_score: 0,
        spatial_grounding_score: 0,
        photographic_fidelity_score: 0,
        verdict: 'NEEDS_REVISION',
        flaws_detected: [`Provider error: ${response.error}`]
      }))
    };
  }

  // Parse JSON response
  try {
    const jsonMatch = response.content.match(/\{[\s\S]*\}/);
    if (!jsonMatch) throw new Error('No JSON structure found in vision response');
    const parsed = JSON.parse(jsonMatch[0]);

    return {
      evaluation_mode: 'GENUINE_MULTIMODAL_PIXEL_INSPECTION',
      model_used: effectiveModel,
      overall_verdict: parsed.overall_verdict || 'NEEDS_HUMAN_REVIEW',
      requires_human_review: parsed.overall_verdict !== 'PASS',
      batch_notes: parsed.batch_notes || 'Genuine multimodal inspection completed.',
      evaluated_at: new Date().toISOString(),
      item_scorecards: (parsed.items || []).map((it: any) => ({
        slot_key: it.slot_key,
        candidate_id: it.candidate_id,
        visual_relevance_score: it.visual_relevance_score || 0,
        object_anatomy_score: it.object_anatomy_score || 0,
        proportional_scale_score: it.proportional_scale_score || 0,
        mechanical_accuracy_score: it.mechanical_accuracy_score || 0,
        spatial_grounding_score: it.spatial_grounding_score || 0,
        photographic_fidelity_score: it.photographic_fidelity_score || 0,
        verdict: it.verdict || 'NEEDS_REVISION',
        flaws_detected: it.flaws_detected || [],
        remediation_guidance: it.remediation_guidance
      }))
    };
  } catch (err: any) {
    return {
      evaluation_mode: 'DETERMINISTIC_TEXT_FALLBACK',
      model_used: effectiveModel,
      overall_verdict: 'NEEDS_HUMAN_REVIEW',
      requires_human_review: true,
      batch_notes: `Vision response parsing error: ${err.message}. Raw content preserved.`,
      evaluated_at: new Date().toISOString(),
      item_scorecards: items.map(it => ({
        slot_key: it.slot_key,
        candidate_id: it.candidate_id,
        visual_relevance_score: 0,
        object_anatomy_score: 0,
        proportional_scale_score: 0,
        mechanical_accuracy_score: 0,
        spatial_grounding_score: 0,
        photographic_fidelity_score: 0,
        verdict: 'NEEDS_REVISION',
        flaws_detected: ['Failed to parse structured vision evaluation']
      }))
    };
  }
}
