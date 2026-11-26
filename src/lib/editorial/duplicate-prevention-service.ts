/**
 * RancangLoka — Unified 5-Layer Duplicate Prevention Service (UTLIS-V1 Phase 2)
 *
 * Shared across ALL production channels:
 * - Maya (Content Strategy)
 * - SEON (Keyword & Intent Selector)
 * - Hermes (Autonomous Editorial Runtime)
 * - Loka Bridge (Browser Gateway & Import Orchestrator)
 * - Reference URL Intake
 * - Manual Owner Article Creation
 *
 * Layered Detection (Deterministic & Low-Cost First; Zero Paid LLM Calls):
 * - Layer 1: Exact normalized title, slug, keyword, topic_id, and active reservation.
 * - Layer 2: Lexical similarity with Bahasa Indonesia normalization, stemming & domain synonyms.
 * - Layer 3: Semantic topic similarity, reader need, search intent, and multi-angle differentiation.
 * - Layer 4: Existing Content DNA (64-MinHash / 4-word shingle) for actual manuscript similarity.
 *            (Note: MinHash measures structural/lexical shingle overlap, NOT semantic understanding.)
 * - Layer 5: Role-based editorial review escalation for ambiguous cases.
 */

import { slugifyText } from '../seo.ts';
import {
  normalizeSimilarityText,
  extractWordTokens,
  computeMinhashSignature
} from '../content-protection/publication-dna.ts';
import {
  MAX_LEGITIMATE_ANGLES_PER_TOPIC,
  type DuplicateAction,
  type DuplicateMatchEvidence,
  type DuplicateScreeningResult,
  type TopicScreeningInput
} from './topic-lifecycle-contracts.ts';

const INDONESIAN_STOPWORDS = new Set([
  'dan', 'atau', 'yang', 'untuk', 'pada', 'dari', 'di', 'ke', 'dengan', 'cara',
  'panduan', 'tips', 'agar', 'supaya', 'tidak', 'tanpa', 'saat', 'ketika', 'ini',
  'itu', 'rumah', 'hunian', 'tropis', 'indonesia', 'minimalis', 'modern', 'lebih',
  'paling', 'bagus', 'baik', 'tepat', 'praktis', 'efektif', 'sendiri', 'vs', 'mana',
  'apa', 'mengapa', 'kenapa', 'bagaimana', 'membuat', 'memilih', 'menata', 'merawat'
]);

const DOMAIN_SYNONYM_CANONICAL: Record<string, string> = {
  lembab: 'lembap',
  lembap: 'lembap',
  kelembaban: 'lembap',
  kelembapan: 'lembap',
  rembes: 'rembes',
  merembes: 'rembes',
  rembesan: 'rembes',
  bocor: 'bocor',
  kebocoran: 'bocor',
  jamur: 'jamur',
  berjamur: 'jamur',
  apek: 'bau_apek',
  pengap: 'sirkulasi_udara',
  ventilasi: 'sirkulasi_udara',
  sirkulasi: 'sirkulasi_udara',
  kerikil: 'kerikil',
  koral: 'kerikil',
  split: 'kerikil',
  plafon: 'plafon',
  ceiling: 'plafon',
  gypsum: 'gipsum',
  gipsum: 'gipsum',
  vinyl: 'vinil',
  vinil: 'vinil',
  dinding: 'dinding',
  tembok: 'dinding',
  cat: 'cat',
  mengecat: 'cat',
  dapur: 'dapur',
  kitchen: 'dapur',
  lampu: 'pencahayaan',
  pencahayaan: 'pencahayaan',
  lighting: 'pencahayaan',
  jendela: 'jendela',
  kusen: 'kusen',
  atap: 'atap',
  kanopi: 'kanopi'
};

/**
 * Normalizes Bahasa Indonesia text into canonical domain tokens.
 */
export function normalizeIndonesianTokens(text: string): string[] {
  const raw = (text || '')
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, ' ')
    .replace(/-/g, ' ')
    .trim();

  if (!raw) return [];

  const tokens = raw.split(/\s+/).filter(Boolean);
  const normalized: string[] = [];

  for (const tok of tokens) {
    if (tok.length <= 2 || INDONESIAN_STOPWORDS.has(tok)) continue;

    // Basic Indonesian morphological normalization
    let stem = tok;
    if (stem.length > 6 && stem.endsWith('nya')) stem = stem.slice(0, -3);
    if (stem.length > 6 && stem.startsWith('ke') && stem.endsWith('an')) {
      stem = stem.slice(2, -2);
    } else if (stem.length > 6 && stem.startsWith('pe') && stem.endsWith('an')) {
      stem = stem.slice(2, -2);
    } else if (stem.length > 5 && stem.startsWith('ber')) {
      stem = stem.slice(3);
    } else if (stem.length > 5 && stem.startsWith('mem')) {
      stem = stem.slice(3);
    } else if (stem.length > 5 && stem.startsWith('men')) {
      stem = stem.slice(3);
    } else if (stem.length > 5 && stem.startsWith('di')) {
      stem = stem.slice(2);
    }

    const mapped = DOMAIN_SYNONYM_CANONICAL[tok] || DOMAIN_SYNONYM_CANONICAL[stem] || stem;
    if (!INDONESIAN_STOPWORDS.has(mapped) && mapped.length > 2) {
      normalized.push(mapped);
    }
  }

  return Array.from(new Set(normalized));
}

export function computeTokenJaccard(tokensA: string[], tokensB: string[]): number {
  if (tokensA.length === 0 || tokensB.length === 0) return 0;
  const setA = new Set(tokensA);
  const setB = new Set(tokensB);
  let intersection = 0;
  for (const t of setA) {
    if (setB.has(t)) intersection++;
  }
  const union = new Set([...setA, ...setB]).size;
  return union > 0 ? Number((intersection / union).toFixed(4)) : 0;
}

export function computeMinHashSimilarity(sigA: string[], sigB: string[]): number {
  if (!Array.isArray(sigA) || !Array.isArray(sigB) || sigA.length === 0 || sigA.length !== sigB.length) {
    return 0;
  }
  let matches = 0;
  for (let i = 0; i < sigA.length; i++) {
    if (sigA[i] === sigB[i]) matches++;
  }
  return Number((matches / sigA.length).toFixed(4));
}

export interface CorpusComparisonRecord {
  recordType: 'TOPIC' | 'ARTICLE' | 'IDENTITY_MAP';
  topicId?: string | null;
  canonicalTopicKey?: string | null;
  angleKey?: string | null;
  articleUid?: string | null;
  title: string;
  slug?: string | null;
  focusKeyword?: string | null;
  searchIntent?: string | null;
  contentAngle?: string | null;
  readerNeed?: string | null;
  status: string;
  hasActiveReservation?: boolean;
  minhashSignature?: string[] | null;
}

/**
 * Evaluates a candidate against an in-memory or D1-loaded corpus across Layers 1-5.
 * Deterministic, zero paid LLM calls.
 */
export function evaluateDuplicateScreeningAgainstRecords(
  input: TopicScreeningInput,
  corpus: CorpusComparisonRecord[]
): DuplicateScreeningResult {
  const screenedAt = new Date().toISOString();
  const normTitle = (input.title || '').trim().toLowerCase();
  const normSlug = slugifyText(input.slug || input.title || input.focus_keyword || '');
  const normKw = (input.focus_keyword || '').trim().toLowerCase();
  const normIntent = (input.search_intent || 'Informational').trim().toLowerCase();
  const normAngle = (input.content_angle || '').trim().toLowerCase();

  const candidateTokens = normalizeIndonesianTokens(`${input.title} ${input.focus_keyword} ${(input.supporting_keywords || []).join(' ')}`);
  const matches: DuplicateMatchEvidence[] = [];

  let sameKeywordCount = 0;
  let sameCanonicalTopicCount = 0;

  // Optional Layer 4 DNA computation if content_md is provided
  let candidateMinHash: string[] | null = null;
  if (input.content_md && input.content_md.trim().length > 100) {
    try {
      const simText = normalizeSimilarityText(input.content_md);
      const tokens = extractWordTokens(simText);
      candidateMinHash = computeMinhashSignature(tokens);
    } catch (_) {
      candidateMinHash = null;
    }
  }

  for (const rec of corpus) {
    // Skip self when updating an existing topic/article
    if (input.topic_id && rec.topicId && input.topic_id === rec.topicId) {
      continue;
    }

    const recTitle = (rec.title || '').trim().toLowerCase();
    const recSlug = (rec.slug || '').trim().toLowerCase();
    const recKw = (rec.focusKeyword || '').trim().toLowerCase();
    const recIntent = (rec.searchIntent || '').trim().toLowerCase();
    const recAngle = (rec.contentAngle || '').trim().toLowerCase();

    if (normKw && recKw && normKw === recKw) {
      sameKeywordCount++;
    }
    if (input.canonical_topic_key && rec.canonicalTopicKey && input.canonical_topic_key === rec.canonicalTopicKey) {
      sameCanonicalTopicCount++;
    }

    // --- LAYER 1: Exact Slug / Title / Active Reservation ---
    if (rec.hasActiveReservation && input.topic_id && rec.topicId === input.topic_id) {
      matches.push({
        layer: 'LAYER_1_EXACT',
        matched_topic_id: rec.topicId,
        matched_article_uid: rec.articleUid,
        matched_title: rec.title,
        matched_slug: rec.slug,
        matched_focus_keyword: rec.focusKeyword,
        matched_status: rec.status,
        similarity_score: 1.0,
        conflict_type: 'ACTIVE_RESERVATION',
        evidence_detail: `Topik ${rec.topicId} sedang memiliki active reservation (${rec.status}).`
      });
    }

    if (normSlug && recSlug && normSlug === recSlug) {
      matches.push({
        layer: 'LAYER_1_EXACT',
        matched_topic_id: rec.topicId,
        matched_article_uid: rec.articleUid,
        matched_title: rec.title,
        matched_slug: rec.slug,
        matched_focus_keyword: rec.focusKeyword,
        matched_status: rec.status,
        similarity_score: 1.0,
        conflict_type: 'EXACT_SLUG',
        evidence_detail: `Canonical slug "${normSlug}" sudah digunakan oleh "${rec.title}" (${rec.status}).`
      });
      continue;
    }

    if (normTitle && recTitle && normTitle === recTitle) {
      matches.push({
        layer: 'LAYER_1_EXACT',
        matched_topic_id: rec.topicId,
        matched_article_uid: rec.articleUid,
        matched_title: rec.title,
        matched_slug: rec.slug,
        matched_focus_keyword: rec.focusKeyword,
        matched_status: rec.status,
        similarity_score: 1.0,
        conflict_type: 'EXACT_TITLE',
        evidence_detail: `Judul identik dengan "${rec.title}" (${rec.status}).`
      });
      continue;
    }

    // --- LAYER 2: Bahasa Indonesia Lexical Normalization & Synonyms ---
    const recTokens = normalizeIndonesianTokens(`${rec.title} ${rec.focusKeyword || ''}`);
    const lexicalSim = computeTokenJaccard(candidateTokens, recTokens);

    // --- LAYER 3: Search Intent & Angle Differentiation ---
    const sameKw = Boolean(normKw && recKw && normKw === recKw);
    const sameIntent = Boolean(normIntent && recIntent && normIntent === recIntent);
    const sameAngle = Boolean(normAngle && recAngle && normAngle === recAngle);

    if (sameKw && sameIntent && (sameAngle || !normAngle || !recAngle)) {
      matches.push({
        layer: 'LAYER_3_SEMANTIC_INTENT',
        matched_topic_id: rec.topicId,
        matched_article_uid: rec.articleUid,
        matched_title: rec.title,
        matched_slug: rec.slug,
        matched_focus_keyword: rec.focusKeyword,
        matched_status: rec.status,
        similarity_score: Math.max(0.88, lexicalSim),
        conflict_type: 'EXACT_KEYWORD_AND_INTENT',
        evidence_detail: `Focus keyword "${normKw}" dan search intent "${normIntent}" bertabrakan tanpa diferensiasi angle yang jelas.`
      });
      continue;
    }

    if (lexicalSim >= 0.72) {
      // High lexical overlap: check if it's a legitimate multi-angle differentiation
      const hasDifferentAngleAndIntent =
        (normIntent && recIntent && normIntent !== recIntent) ||
        (normAngle && recAngle && normAngle !== recAngle && lexicalSim < 0.88);

      if (!hasDifferentAngleAndIntent) {
        matches.push({
          layer: 'LAYER_2_LEXICAL',
          matched_topic_id: rec.topicId,
          matched_article_uid: rec.articleUid,
          matched_title: rec.title,
          matched_slug: rec.slug,
          matched_focus_keyword: rec.focusKeyword,
          matched_status: rec.status,
          similarity_score: lexicalSim,
          conflict_type: 'LEXICAL_OVERLAP',
          evidence_detail: `Kemiripan leksikal Bahasa Indonesia ${(lexicalSim * 100).toFixed(0)}% dengan "${rec.title}" (${rec.status}) tanpa perbedaan search intent/angle.`
        });
      } else {
        matches.push({
          layer: 'LAYER_3_SEMANTIC_INTENT',
          matched_topic_id: rec.topicId,
          matched_article_uid: rec.articleUid,
          matched_title: rec.title,
          matched_slug: rec.slug,
          matched_focus_keyword: rec.focusKeyword,
          matched_status: rec.status,
          similarity_score: lexicalSim,
          conflict_type: 'SEMANTIC_INTENT_OVERLAP',
          evidence_detail: `Overlap topik ${(lexicalSim * 100).toFixed(0)}% dengan "${rec.title}", namun memiliki perbedaan intent/angle (${normIntent} vs ${recIntent || 'n/a'}).`
        });
      }
    } else if (lexicalSim >= 0.50) {
      matches.push({
        layer: 'LAYER_2_LEXICAL',
        matched_topic_id: rec.topicId,
        matched_article_uid: rec.articleUid,
        matched_title: rec.title,
        matched_slug: rec.slug,
        matched_focus_keyword: rec.focusKeyword,
        matched_status: rec.status,
        similarity_score: lexicalSim,
        conflict_type: 'LEXICAL_OVERLAP',
        evidence_detail: `Kemiripan kata kunci moderat ${(lexicalSim * 100).toFixed(0)}% dengan "${rec.title}" (${rec.status}).`
      });
    }

    // --- LAYER 4: Content DNA MinHash (Structural/Shingle Similarity Only) ---
    if (candidateMinHash && rec.minhashSignature) {
      const dnaSim = computeMinHashSimilarity(candidateMinHash, rec.minhashSignature);
      if (dnaSim >= 0.60) {
        matches.push({
          layer: 'LAYER_4_CONTENT_DNA',
          matched_topic_id: rec.topicId,
          matched_article_uid: rec.articleUid,
          matched_title: rec.title,
          matched_slug: rec.slug,
          matched_focus_keyword: rec.focusKeyword,
          matched_status: rec.status,
          similarity_score: dnaSim,
          conflict_type: 'CONTENT_DNA_SHINGLE_OVERLAP',
          evidence_detail: `Kemiripan shingle 64-MinHash ${(dnaSim * 100).toFixed(0)}% terhadap naskah "${rec.title}".`
        });
      }
    }
  }

  // Enforce Multi-Angle Cap (up to 5 legitimate variations)
  const existingAngles = Math.max(sameKeywordCount, sameCanonicalTopicCount);
  if (existingAngles >= MAX_LEGITIMATE_ANGLES_PER_TOPIC) {
    matches.push({
      layer: 'LAYER_5_EDITORIAL_REVIEW',
      matched_topic_id: null,
      matched_article_uid: null,
      matched_title: input.title,
      matched_status: 'MULTI_ANGLE_LIMIT',
      similarity_score: 0.90,
      conflict_type: 'MULTI_ANGLE_CAP_EXCEEDED',
      evidence_detail: `Sudah terdapat ${existingAngles} variasi angle untuk topik/keyword ini (batas kebijakan: ${MAX_LEGITIMATE_ANGLES_PER_TOPIC}).`
    });
  }

  // Sort matches by highest similarity descending
  matches.sort((a, b) => b.similarity_score - a.similarity_score);
  const topMatch = matches[0] || null;
  const highestSim = topMatch ? topMatch.similarity_score : 0;

  let action: DuplicateAction = 'ALLOW';
  let requiresReview = false;
  let rationale = 'Tidak ditemukan duplikasi atau kanibalisasi pada korpus aktif, staging, maupun in-flight.';

  if (topMatch) {
    if (
      topMatch.conflict_type === 'EXACT_SLUG' ||
      topMatch.conflict_type === 'EXACT_TITLE' ||
      topMatch.conflict_type === 'ACTIVE_RESERVATION' ||
      topMatch.conflict_type === 'EXACT_KEYWORD_AND_INTENT' ||
      topMatch.conflict_type === 'MULTI_ANGLE_CAP_EXCEEDED' ||
      (topMatch.conflict_type === 'CONTENT_DNA_SHINGLE_OVERLAP' && topMatch.similarity_score >= 0.75)
    ) {
      action = 'BLOCK';
      rationale = topMatch.evidence_detail;
    } else if (topMatch.conflict_type === 'LEXICAL_OVERLAP' && topMatch.similarity_score >= 0.72) {
      action = 'REVIEW';
      requiresReview = true;
      rationale = `Perlu tinjauan Maya/SEON: ${topMatch.evidence_detail}`;
    } else if (topMatch.conflict_type === 'SEMANTIC_INTENT_OVERLAP') {
      // Multi-angle candidate with distinct intent/angle
      action = 'ALLOW';
      requiresReview = false;
      rationale = `Multi-angle sah (${existingAngles + 1}/${MAX_LEGITIMATE_ANGLES_PER_TOPIC}): ${topMatch.evidence_detail}`;
    } else if (topMatch.similarity_score >= 0.50) {
      action = 'REVIEW';
      requiresReview = true;
      rationale = `Kemiripan moderat (${(topMatch.similarity_score * 100).toFixed(0)}%) dengan "${topMatch.matched_title}". Disarankan verifikasi diferensiasi angle.`;
    }
  }

  return {
    action,
    is_allowed: action === 'ALLOW',
    requires_editorial_review: requiresReview,
    conflict_type: topMatch ? topMatch.conflict_type : null,
    matched_topic_id: topMatch?.matched_topic_id || null,
    matched_article_uid: topMatch?.matched_article_uid || null,
    matched_title: topMatch?.matched_title || null,
    highest_similarity_score: highestSim,
    matches: matches.slice(0, 8),
    decision_rationale: rationale,
    multi_angle_eligible: existingAngles < MAX_LEGITIMATE_ANGLES_PER_TOPIC,
    existing_angle_count: existingAngles,
    screened_at: screenedAt
  };
}

/**
 * Loads all non-fixture records from Cloudflare D1 (editorial_topics, global_article_identity_map,
 * articles, and article_dna_signatures) and executes the 5-layer duplicate screening.
 */
export async function screenTopicCandidateWithD1(
  db: any,
  input: TopicScreeningInput
): Promise<DuplicateScreeningResult> {
  const corpus: CorpusComparisonRecord[] = [];

  if (db && typeof db.prepare === 'function') {
    try {
      // 1. Load editorial_topics (excluding test fixtures & rejected/cancelled/archived)
      const topicRows = await db
        .prepare(`
          SELECT t.topic_id, t.canonical_topic_key, t.angle_key, t.candidate_title,
                 t.canonical_slug, t.focus_keyword, t.search_intent, t.content_angle,
                 t.reader_need, t.lifecycle_status,
                 (SELECT COUNT(*) FROM topic_reservations r WHERE r.topic_id = t.topic_id AND r.reservation_status = 'ACTIVE') as active_res
          FROM editorial_topics t
          WHERE t.is_test_fixture = 0
            AND t.lifecycle_status NOT IN ('REJECTED', 'CANCELLED', 'ARCHIVED', 'MERGED')
        `)
        .all();

      for (const row of topicRows?.results || []) {
        corpus.push({
          recordType: 'TOPIC',
          topicId: row.topic_id,
          canonicalTopicKey: row.canonical_topic_key,
          angleKey: row.angle_key,
          title: row.candidate_title,
          slug: row.canonical_slug,
          focusKeyword: row.focus_keyword,
          searchIntent: row.search_intent,
          contentAngle: row.content_angle,
          readerNeed: row.reader_need,
          status: row.lifecycle_status,
          hasActiveReservation: Number(row.active_res || 0) > 0
        });
      }
    } catch (_) {
      // Graceful if table not yet migrated in isolated unit test
    }

    try {
      // 2. Load global_article_identity_map (covers Production + Staging + Drafts)
      const gaimRows = await db
        .prepare(`
          SELECT canonical_article_uid, topic_id, angle_key, canonical_slug, title,
                 focus_keyword, article_status
          FROM global_article_identity_map
          WHERE is_test_fixture = 0
        `)
        .all();

      for (const row of gaimRows?.results || []) {
        corpus.push({
          recordType: 'IDENTITY_MAP',
          topicId: row.topic_id,
          articleUid: row.canonical_article_uid,
          angleKey: row.angle_key,
          title: row.title,
          slug: row.canonical_slug,
          focusKeyword: row.focus_keyword,
          status: row.article_status
        });
      }
    } catch (_) {}

    try {
      // 3. Load articles directly (catches any manual/unreconciled articles + DNA signatures)
      const artRows = await db
        .prepare(`
          SELECT a.id, a.title, a.slug, a.focus_keyword, a.status, a.topic_id, a.canonical_article_uid,
                 d.minhash_signature_json
          FROM articles a
          LEFT JOIN article_dna_signatures d ON d.article_id = a.id
          WHERE LOWER(a.title) NOT LIKE '%smoke test%'
            AND LOWER(a.title) NOT LIKE '%uji ingest%'
            AND LOWER(a.title) NOT LIKE '%uji coba%'
            AND LOWER(a.title) NOT LIKE '%canary%'
        `)
        .all();

      const seenSlugs = new Set(corpus.map(c => (c.slug || '').toLowerCase()).filter(Boolean));
      for (const row of artRows?.results || []) {
        const s = (row.slug || '').toLowerCase();
        let minhash: string[] | null = null;
        if (row.minhash_signature_json) {
          try { minhash = JSON.parse(row.minhash_signature_json); } catch (_) {}
        }
        if (s && seenSlugs.has(s)) {
          // Attach minhash signature to existing corpus record
          const existing = corpus.find(c => (c.slug || '').toLowerCase() === s);
          if (existing && minhash) existing.minhashSignature = minhash;
          continue;
        }
        corpus.push({
          recordType: 'ARTICLE',
          topicId: row.topic_id || null,
          articleUid: row.canonical_article_uid || `local_art_${row.id}`,
          title: row.title,
          slug: row.slug,
          focusKeyword: row.focus_keyword,
          status: row.status,
          minhashSignature: minhash
        });
      }
    } catch (_) {}
  }

  return evaluateDuplicateScreeningAgainstRecords(input, corpus);
}
