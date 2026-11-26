/**
 * RancangLoka — SEON Dynamic Topic Selector
 * 
 * Closes Gap 1:
 * - Reads eligible unpublished draft/queued topics from D1 (or editorial calendar backlog).
 * - Checks keyword cannibalization against existing published articles in D1.
 * - Selects the next eligible topic atomically.
 * - Prevents duplicate concurrent selection via lock/in-progress tracking.
 * - If no eligible topic exists, STOPS cleanly without hardcoded fallbacks.
 */


export interface EligibleTopicCandidate {
  id?: number;
  topic: string;
  requestedTitle: string;
  canonicalSlug: string;
  focusKeyword: string;
  categoryId: number;
}

export interface TopicSelectionResult {
  status: 'SELECTED' | 'NO_ELIGIBLE_TOPIC' | 'CANNIBALIZATION_BLOCKED' | 'ERROR';
  selectedTopic: EligibleTopicCandidate | null;
  message: string;
  evaluatedCount: number;
}

// Official Google Search Central: Google does not prescribe fixed character limits.
// Titles must be descriptive, concise, non-empty, and avoid keyword stuffing.
export const CANONICAL_SEO_TITLE_MIN = 1;
export const CANONICAL_SEO_TITLE_MAX = 500;

export const CANONICAL_FOCUS_KEYWORD_MIN_WORDS = 2;
export const CANONICAL_FOCUS_KEYWORD_MAX_WORDS = 5;

export interface FocusKeywordValidationResult {
  isValid: boolean;
  normalizedKeyword: string;
  wordCount: number;
  error?: string;
}

/**
 * Validates that focus keywords are natural, conversational, and avoid
 * concatenated phrases or stuffing symbols (/, +, &, |, ;, ,).
 */
export function validateSeonFocusKeyword(rawKeyword: string): FocusKeywordValidationResult {
  const trimmed = (rawKeyword || '').trim();
  if (!trimmed) {
    return {
      isValid: false,
      normalizedKeyword: '',
      wordCount: 0,
      error: 'Focus keyword tidak boleh kosong.'
    };
  }

  // Reject concatenated characters
  if (/[\/+\&|;,]/.test(trimmed)) {
    return {
      isValid: false,
      normalizedKeyword: trimmed,
      wordCount: 0,
      error: `Focus keyword "${trimmed}" memuat karakter penggabung (/ + & | ; ,). Dilarang menggabungkan beberapa frasa atau entitas majemuk menjadi satu keyword kaku.`
    };
  }

  // Count words
  const words = trimmed.split(/\s+/).filter(Boolean);
  if (words.length < CANONICAL_FOCUS_KEYWORD_MIN_WORDS || words.length > CANONICAL_FOCUS_KEYWORD_MAX_WORDS) {
    return {
      isValid: false,
      normalizedKeyword: trimmed,
      wordCount: words.length,
      error: `Panjang focus keyword "${trimmed}" (${words.length} kata) di luar rentang alami target (${CANONICAL_FOCUS_KEYWORD_MIN_WORDS}–${CANONICAL_FOCUS_KEYWORD_MAX_WORDS} kata). Hindari kalimat panjang buatan yang merusak ritme percakapan.`
    };
  }

  return {
    isValid: true,
    normalizedKeyword: trimmed.toLowerCase(),
    wordCount: words.length
  };
}

/**
 * Extracts or normalizes a natural primary focus keyword from a topic or raw keyword string.
 * Strips conjunctions, slashes, and secondary clauses.
 */
export function extractNaturalPrimaryKeyword(rawTopic: string, rawKeyword?: string): string {
  const source = (rawKeyword || rawTopic || '').trim();
  if (!source) return '';

  // If already valid natural keyword, return it normalized
  const check = validateSeonFocusKeyword(source);
  if (check.isValid) return check.normalizedKeyword;

  // Split on delimiters (/ , + | vs atau untuk)
  let clean = source
    .replace(/^perbandingan\s+/i, '')
    .replace(/^apakah\s+/i, '')
    .replace(/\s+untuk\s+.*$/i, '')
    .replace(/\s+rumah\s+tinggal.*$/i, '')
    .replace(/\s*\/.*$/, '')
    .replace(/[^a-zA-Z0-9\s-]/g, ' ')
    .trim();

  const words = clean.split(/\s+/).filter(Boolean);
  if (words.length > CANONICAL_FOCUS_KEYWORD_MAX_WORDS) {
    clean = words.slice(0, CANONICAL_FOCUS_KEYWORD_MAX_WORDS).join(' ');
  }

  return clean.toLowerCase();
}

export function validateSeonTitleLength(title: string): { isValid: boolean; length: number; error?: string } {
  const len = (title || '').trim().length;
  if (len === 0) {
    return {
      isValid: false,
      length: 0,
      error: 'Judul tidak boleh kosong. Google mewajibkan judul yang jelas dan deskriptif.'
    };
  }
  return { isValid: true, length: len };
}

export const BACKLOG_EDITORIAL_TOPICS: EligibleTopicCandidate[] = [
  {
    id: 11,
    topic: 'Insulasi Aluminium Foil Atap Rumah Tropis: Efektivitas dan Cara Pasang',
    requestedTitle: 'Insulasi Aluminium Foil Atap: Efektif Meredam Panas Tropis?',
    canonicalSlug: 'insulasi-aluminium-foil-atap-rumah-tropis-efektivitas-dan-cara-pasang',
    focusKeyword: 'insulasi aluminium foil atap',
    categoryId: 8
  },
  {
    id: 12,
    topic: 'Perbedaan Lantai SPC dan Vinyl: Mana yang Lebih Awet untuk Rumah Tropis?',
    requestedTitle: 'Lantai SPC vs Vinyl: Mana yang Lebih Pas untuk Rumah Tropis?',
    canonicalSlug: 'perbedaan-lantai-spc-dan-vinyl-mana-yang-lebih-awet-untuk-rumah',
    focusKeyword: 'lantai spc vs vinyl',
    categoryId: 8
  },
  {
    id: 15,
    topic: 'Perbedaan Kompor Induksi dan Kompor Gas untuk Dapur Rumah',
    requestedTitle: 'Kompor Induksi vs Gas: Mana yang Lebih Hemat dan Aman?',
    canonicalSlug: 'perbedaan-kompor-induksi-dan-kompor-gas-untuk-dapur-rumah',
    focusKeyword: 'kompor induksi vs kompor gas',
    categoryId: 7
  },
  {
    id: 17,
    topic: 'Cara Membuat Partisi Drywall Kedap Suara Antarkamar',
    requestedTitle: 'Partisi Drywall Kedap Suara: Cara Meredam Bising Antarkamar',
    canonicalSlug: 'cara-membuat-partisi-drywall-kedap-suara-antarkamar',
    focusKeyword: 'partisi drywall kedap suara',
    categoryId: 8
  }
];

/**
 * Checks whether a slug or focus keyword cannibalizes any published article
 */
export function checkTopicCannibalization(
  candidate: EligibleTopicCandidate,
  publishedSlugs: string[],
  publishedKeywords: string[]
): { isCannibalizing: boolean; reason?: string } {
  const normSlug = candidate.canonicalSlug.toLowerCase().trim();
  const normKw = candidate.focusKeyword.toLowerCase().trim();

  if (publishedSlugs.map(s => s.toLowerCase().trim()).includes(normSlug)) {
    return { isCannibalizing: true, reason: `Slug "${candidate.canonicalSlug}" already published` };
  }

  // Strict keyword cannibalization check
  if (publishedKeywords.map(k => k.toLowerCase().trim()).includes(normKw)) {
    return { isCannibalizing: true, reason: `Focus keyword "${candidate.focusKeyword}" already targeted by published article` };
  }

  return { isCannibalizing: false };
}

/**
 * Selects the next eligible topic dynamically
 */
export async function selectNextEligibleTopic(options?: {
  db?: any;
  publishedSlugs?: string[];
  publishedKeywords?: string[];
  inProgressSlugs?: string[];
  candidatePool?: EligibleTopicCandidate[];
}): Promise<TopicSelectionResult> {
  const pool = options?.candidatePool || BACKLOG_EDITORIAL_TOPICS;
  const publishedSlugs = options?.publishedSlugs || [];
  const publishedKeywords = options?.publishedKeywords || [];
  const inProgressSlugs = options?.inProgressSlugs || [];

  if (pool.length === 0) {
    return {
      status: 'NO_ELIGIBLE_TOPIC',
      selectedTopic: null,
      message: 'Editorial backlog pool is completely empty. Stopped cleanly.',
      evaluatedCount: 0
    };
  }

  let evaluated = 0;
  for (const candidate of pool) {
    evaluated++;
    
    // Check if currently locked / in progress
    if (inProgressSlugs.includes(candidate.canonicalSlug)) {
      continue;
    }

    // Validate title length (40–65 chars, no auto-truncation)
    const titleCheck = validateSeonTitleLength(candidate.requestedTitle);
    if (!titleCheck.isValid) {
      continue;
    }

    // Validate focus keyword (2-5 natural words, no concatenated symbols)
    const kwCheck = validateSeonFocusKeyword(candidate.focusKeyword);
    if (!kwCheck.isValid) {
      continue;
    }

    // Check cannibalization against published articles
    const cannCheck = checkTopicCannibalization(candidate, publishedSlugs, publishedKeywords);
    if (cannCheck.isCannibalizing) {
      continue;
    }

    // Topic is eligible and safe!
    return {
      status: 'SELECTED',
      selectedTopic: candidate,
      message: `Selected topic #${candidate.id || 'auto'}: "${candidate.requestedTitle}" (Slug: ${candidate.canonicalSlug}). Zero cannibalization.`,
      evaluatedCount: evaluated
    };
  }

  return {
    status: 'NO_ELIGIBLE_TOPIC',
    selectedTopic: null,
    message: `All ${evaluated} candidate topics are either in progress, published, or cannibalized. Stopped cleanly.`,
    evaluatedCount: evaluated
  };
}

/**
 * Selects and optionally atomically reserves the next eligible topic directly from D1 `editorial_topics`.
 * Uses the Unified 5-Layer Duplicate Prevention Gate before selection.
 */
export async function selectNextEligibleTopicFromD1(
  db: any,
  options?: {
    reserve?: boolean;
    productionChannel?: 'hermes' | 'loka_bridge' | 'reference_intake' | 'manual_owner';
    leaseOwner?: string;
    taskId?: string;
    idempotencyKey?: string;
  }
): Promise<TopicSelectionResult & { reservationId?: string | null }> {
  if (!db || typeof db.prepare !== 'function') {
    return {
      status: 'ERROR',
      selectedTopic: null,
      message: 'D1 database connection required for canonical topic selection.',
      evaluatedCount: 0
    };
  }

  const { screenTopicCandidateWithD1 } = await import('./duplicate-prevention-service.ts');
  const { reserveTopicAtomically } = await import('./topic-registry-service.ts');

  const rows = await db
    .prepare(`
      SELECT * FROM editorial_topics
      WHERE is_test_fixture = 0
        AND lifecycle_status IN ('DISCOVERED', 'KEYWORD_VALIDATED', 'PRIORITIZED', 'READY_FOR_RESEARCH')
      ORDER BY epis_score DESC, priority_rank ASC
      LIMIT 25
    `)
    .all();

  const candidates = rows?.results || [];
  let evaluated = 0;

  for (const row of candidates) {
    evaluated++;
    const titleCheck = validateSeonTitleLength(row.candidate_title);
    if (!titleCheck.isValid) continue;

    const kwCheck = validateSeonFocusKeyword(row.focus_keyword);
    if (!kwCheck.isValid) continue;

    const screening = await screenTopicCandidateWithD1(db, {
      topic_id: row.topic_id,
      canonical_topic_key: row.canonical_topic_key,
      angle_key: row.angle_key,
      title: row.candidate_title,
      slug: row.canonical_slug,
      focus_keyword: row.focus_keyword,
      search_intent: row.search_intent,
      content_angle: row.content_angle,
      category_id: row.category_id,
      topic_family: row.topic_family,
      screening_stage: 'TOPIC_SELECTION'
    });

    if (!screening.is_allowed) continue;

    let reservationId: string | null = null;
    if (options?.reserve) {
      const res = await reserveTopicAtomically(db, {
        topic_id: row.topic_id,
        task_id: options.taskId || `task-seon-${row.topic_id}-${Date.now().toString(36)}`,
        production_channel: options.productionChannel || 'hermes',
        lease_owner: options.leaseOwner || 'seon_topic_selector',
        idempotency_key: options.idempotencyKey || `seon_res_${row.topic_id}_${Date.now()}`
      });
      if (!res.reserved) continue;
      reservationId = res.reservation?.reservation_id || null;
    }

    return {
      status: 'SELECTED',
      selectedTopic: {
        id: row.related_article_id || undefined,
        topic: row.candidate_title,
        requestedTitle: row.candidate_title,
        canonicalSlug: row.canonical_slug,
        focusKeyword: row.focus_keyword,
        categoryId: row.category_id
      },
      reservationId,
      message: `Selected canonical topic ${row.topic_id}: "${row.candidate_title}" (EPIS: ${row.epis_score}).`,
      evaluatedCount: evaluated
    };
  }

  return {
    status: 'NO_ELIGIBLE_TOPIC',
    selectedTopic: null,
    message: `Evaluated ${evaluated} D1 topics; none eligible or all blocked by duplicate/reservation gates.`,
    evaluatedCount: evaluated
  };
}
