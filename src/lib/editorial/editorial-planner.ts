/**
 * RancangLoka Reader-Focused Editorial Planner
 * Milestone: JOKO-WINNING-PIPELINE-INTEGRATION
 *
 * Sits between the Research/Evidence stage and Joko's authoring stage.
 * Produces a concise, reader-focused Editorial Brief that structures:
 * - Search intent and primary reader needs
 * - Reader-focused editorial angle
 * - Section-by-section outline (where each section directly answers its heading in sentence 1)
 * - Traceable verified factual evidence (strictly separated from optional design heuristics)
 * - Clear distinction between structural engineering allowances and actual material scale weight
 * - Clear distinction between slope degrees (°) and slope percent (%)
 * - Clear labeling of decorative rules (e.g. 60-30-10) as optional heuristics, never dogma
 * - Winning Article Y tone guidance: "Dewasa dan santai, flow baca lebih enak nyambung ke title atau heading yang sedang dibahas"
 */

import crypto from 'node:crypto';

import {
  type EvidencePackInput,
  type AuthorSafeClaim,
  type ArticleIntentProfile,
  classifyClaimEditorialRelevance
} from '../article/human-quality.ts';

import type { JokoVisitorContextInput } from './joko-prompt-builder.ts';

export type EditorialArticleFamily =
  | 'INSPIRATION_DECOR'
  | 'MATERIAL_COMPARISON'
  | 'PROBLEM_SOLVER'
  | 'BUILDING_GUIDE';

export interface EditorialSectionObjective {
  heading: string;
  objective: string;
  key_points: string[];
  claim_ids?: string[];
  qualified_claim_ids?: string[];
}

export type ClaimSelectionStatus = 'SELECTED' | 'NOT_SELECTED' | 'REVIEW_REQUIRED';

export type ClaimRelevanceClass =
  | 'CORE_MECHANISM'
  | 'CORE_SOLUTION'
  | 'CORE_DIAGNOSIS'
  | 'SAFETY_CAVEAT'
  | 'PERIPHERAL_CONTEXT'
  | 'OUT_OF_SCOPE'
  | 'INSUFFICIENT_EVIDENCE';

export interface ClaimSelectionLedgerEntry {
  claim_id: string;
  qualified_claim_id?: string;
  evidence_pack_id?: string;
  statement: string;
  selection_status: ClaimSelectionStatus;
  article_topic: string;
  article_family: EditorialArticleFamily;
  related_section_ids: string[];
  selection_reason: string;
  relevance_class: ClaimRelevanceClass;
  source_id?: string;
  passage_id?: string;
  canonical_source_url?: string;
  exact_supporting_text_reference?: string;
  applicability_scope?: string;
  qualification_required?: string;
}

export interface ClaimSelectionLedger {
  evidence_pack_id?: string;
  article_topic: string;
  article_family: EditorialArticleFamily;
  total_claims_in_pack: number;
  authoring_eligible_count: number;
  selected_count: number;
  not_selected_count: number;
  review_required_count: number;
  entries: ClaimSelectionLedgerEntry[];
}

export interface VerifiedEvidenceItem {
  claim_id: string;
  qualified_claim_id?: string;
  evidence_pack_id?: string;
  fact: string;
  source_note: string;
  is_verified: boolean;
  distinction_notes?: string;
  relevance_class?: ClaimRelevanceClass;
  source_id?: string;
  passage_id?: string;
  canonical_source_url?: string;
  applicability_scope?: string;
  qualification_required?: string;
}

export interface EditorialBrief {
  brief_id: string;
  evidence_pack_id?: string;
  topic: string;
  requested_title: string;
  article_family: EditorialArticleFamily;
  search_intent: string;
  editorial_angle: string;
  tone_guidance: string;
  outline: EditorialSectionObjective[];
  verified_evidence: VerifiedEvidenceItem[];
  practical_guidelines: string[];
  optional_design_examples: string[];
  prohibited_traps: string[];
  word_count_target: {
    min: number;
    max: number;
  };
  claim_selection_ledger?: ClaimSelectionLedger;
}

/**
 * Resolves a stable, deterministic evidence pack identifier from metadata or content.
 */
export function resolveEvidencePackId(pack: EvidencePackInput | any): string {
  if (!pack) return 'pack_unspecified';
  if (typeof pack.evidence_pack_id === 'string' && pack.evidence_pack_id.trim()) {
    return pack.evidence_pack_id.trim();
  }
  if (typeof pack.pack_id === 'string' && pack.pack_id.trim()) {
    return pack.pack_id.trim();
  }
  if (typeof pack.id === 'string' && pack.id.trim()) {
    return pack.id.trim();
  }

  // Deterministic fallback for legacy packs without explicit identifier
  const contentSeed = [
    pack.article_topic || pack.topic || '',
    pack.target_keyword || '',
    Array.isArray(pack.claim_inventory) ? pack.claim_inventory.length : 0,
    Array.isArray(pack.sources) ? pack.sources.map((s: any) => s.canonical_url || s.source_id || '').sort().join('|') : ''
  ].join('::');

  if (contentSeed.trim() && contentSeed !== '::::0::') {
    const hash = crypto.createHash('sha256').update(contentSeed).digest('hex').substring(0, 16);
    return `pack_legacy_${hash}`;
  }
  return 'pack_unspecified';
}

/**
 * Builds a qualified claim identifier: <evidence_pack_id>::<claim_id>
 */
export function buildQualifiedClaimId(evidencePackId: string, claimId: string): string {
  const cleanPack = (evidencePackId || 'pack_unspecified').trim();
  const cleanClaim = (claimId || 'CLM-GEN').trim();
  return `${cleanPack}::${cleanClaim}`;
}

/**
 * Parses a qualified claim identifier into its components.
 */
export function parseQualifiedClaimId(qualifiedClaimId: string): { evidencePackId: string; claimId: string } {
  if (!qualifiedClaimId || !qualifiedClaimId.includes('::')) {
    return {
      evidencePackId: 'pack_unspecified',
      claimId: qualifiedClaimId || 'CLM-GEN'
    };
  }
  const parts = qualifiedClaimId.split('::');
  return {
    evidencePackId: parts[0] || 'pack_unspecified',
    claimId: parts.slice(1).join('::') || 'CLM-GEN'
  };
}

/**
 * Verifies cross-pack compatibility between claim references and evidence pack.
 * Enforces fail-closed: if pack IDs mismatch, or if either is missing/ambiguous, returns REVIEW_REQUIRED.
 */
export function verifyCrossPackCompatibility(
  qualifiedClaimId: string,
  targetPackId: string
): {
  isCompatible: boolean;
  status: 'COMPATIBLE' | 'REVIEW_REQUIRED';
  reason?: string;
} {
  const parsed = parseQualifiedClaimId(qualifiedClaimId);
  if (!parsed.evidencePackId || parsed.evidencePackId === 'pack_unspecified') {
    return {
      isCompatible: false,
      status: 'REVIEW_REQUIRED',
      reason: 'AMBIGUOUS_PACK_IDENTITY: Claim identifier lacks verifiable evidence_pack_id.'
    };
  }
  if (!targetPackId || targetPackId === 'pack_unspecified') {
    return {
      isCompatible: false,
      status: 'REVIEW_REQUIRED',
      reason: 'AMBIGUOUS_PACK_IDENTITY: Target evidence pack lacks verifiable evidence_pack_id.'
    };
  }
  if (parsed.evidencePackId !== targetPackId) {
    return {
      isCompatible: false,
      status: 'REVIEW_REQUIRED',
      reason: `CROSS_PACK_COLLISION: Claim origin pack '${parsed.evidencePackId}' does not match target pack '${targetPackId}'.`
    };
  }
  return {
    isCompatible: true,
    status: 'COMPATIBLE'
  };
}

export interface EditorialPlannerInput {
  topic: string;
  requestedTitle?: string;
  intentProfile?: ArticleIntentProfile;
  evidencePack: EvidencePackInput;
  authorSafeClaims?: AuthorSafeClaim[];
  visitorContext?: JokoVisitorContextInput;
}

/**
 * Detects the editorial article family from topic, title, and intent profile.
 */
export function detectEditorialArticleFamily(
  topic: string,
  requestedTitle?: string,
  intentProfile?: ArticleIntentProfile
): EditorialArticleFamily {
  const combined = `${requestedTitle || ''} ${topic}`.toLowerCase();

  // 1. Comparison keywords
  if (
    combined.includes(' vs ') ||
    combined.includes(' versus ') ||
    combined.includes('banding') ||
    combined.includes('perbedaan ') ||
    intentProfile?.primary_intent === 'COMPARISON'
  ) {
    return 'MATERIAL_COMPARISON';
  }

  // 2. Problem solving keywords (check before generic room names like kamar/taman)
  if (
    combined.includes('mengapa') ||
    combined.includes('penyebab') ||
    combined.includes('bocor') ||
    combined.includes('rembes') ||
    combined.includes('retak') ||
    combined.includes('panas') ||
    combined.includes('kondensasi') ||
    combined.includes('solusi') ||
    combined.includes('masalah') ||
    combined.includes('mengelupas') ||
    intentProfile?.primary_intent === 'PROBLEM_SOLVING'
  ) {
    return 'PROBLEM_SOLVER';
  }

  // 3. Home & Living / Decor / Small Space keywords
  if (
    combined.includes('menata') ||
    combined.includes('dekorasi') ||
    combined.includes('balkon') ||
    combined.includes('japandi') ||
    combined.includes('skandinavia') ||
    combined.includes('interior') ||
    combined.includes('ruang minimalis') ||
    combined.includes('inspirasi') ||
    combined.includes('kamar tidur') ||
    combined.includes('ruang tamu')
  ) {
    return 'INSPIRATION_DECOR';
  }

  return 'BUILDING_GUIDE';
}

/**
 * Audits and categorizes claims into verified facts, practical guidelines, and optional heuristics.
 * Implements two-stage evidence selection (Milestone: EVIDENCE-PHASE2A-TOPIC-SELECTION):
 * STAGE A: Evaluates authoring eligibility (provenance, jurisdiction, stubs, unverified numbers).
 * STAGE B: Performs topic-specific selection against the active outline, reader problem, and editorial family.
 * Produces an auditable ClaimSelectionLedger preserving full provenance.
 */
export function auditFactualClaimsTaxonomy(
  authorSafeClaims: AuthorSafeClaim[] = [],
  evidencePack: EvidencePackInput,
  family: EditorialArticleFamily,
  outline?: EditorialSectionObjective[],
  activeTopic?: string
): {
  verifiedEvidence: VerifiedEvidenceItem[];
  practicalGuidelines: string[];
  optionalExamples: string[];
  prohibitedTraps: string[];
  selectionLedger: ClaimSelectionLedger;
} {
  const verifiedEvidence: VerifiedEvidenceItem[] = [];
  const practicalGuidelines: string[] = [];
  const optionalExamples: string[] = [];
  const prohibitedTraps: string[] = [
    'DILARANG membuat drama penderitaan atau dilema retoris buatan di paragraf pembuka.',
    'DILARANG mengarang angka biaya atau perkiraan harga rupiah tanpa riset empiris (Monetary Silence).',
    'DILARANG menyalin kutipan buku, nama jurnal, atau nomor standar yang tidak tercantum dalam bukti riset resmi.'
  ];

  const topicStr = String(activeTopic || evidencePack.article_topic || evidencePack.topic || '').trim();
  const topicLower = topicStr.toLowerCase();
  const evidencePackId = resolveEvidencePackId(evidencePack);

  const isFenestrationTopic = /\b(?:kusen|aluminium|jendela|pintu|window|frame|glazing|thermal break|cold bridge|kaca|laminated|tempered)\b/i.test(topicLower);
  const isRoofTopic = /\b(?:atap|genteng|seng|roof|metal|insulasi atap)\b/i.test(topicLower);
  const isFlooringTopic = /\b(?:keramik|lantai|ubin|granit|tile|mortar|movement joint|expansion joint|popping|perekat)\b/i.test(topicLower);
  const isDecorTopic = family === 'INSPIRATION_DECOR' || /\b(?:balkon|dekorasi|penataan|japandi|living room|kamar|ruang minimalis)\b/i.test(topicLower);

  // Map raw claims and passages for provenance resolution
  const rawClaimsList = Array.isArray(evidencePack.claim_inventory) && evidencePack.claim_inventory.length > 0
    ? evidencePack.claim_inventory
    : authorSafeClaims;

  const passagesMap = new Map<string, any>();
  if (Array.isArray(evidencePack.evidence_passages)) {
    for (const p of evidencePack.evidence_passages) {
      if (p && p.passage_id) passagesMap.set(p.passage_id, p);
    }
  }

  const safeClaimsMap = new Map<string, AuthorSafeClaim>();
  for (const sc of authorSafeClaims) {
    if (sc && sc.claim_id) safeClaimsMap.set(sc.claim_id, sc);
  }

  const ledgerEntries: ClaimSelectionLedgerEntry[] = [];
  const seenQualifiedClaimIds = new Set<string>();

  for (const rawClaim of rawClaimsList) {
    const id = rawClaim.claim_id || (rawClaim as any).id || 'CLM-GEN';
    const qualifiedClaimId = buildQualifiedClaimId(evidencePackId, id);
    const text = (rawClaim as any).statement || (rawClaim as any).claim_text || (rawClaim as any).text || '';
    const lower = text.toLowerCase();
    const safeClaim = safeClaimsMap.get(id);

    const sourceObj = (rawClaim as any).sources?.[0];
    const passageId = Array.isArray((rawClaim as any).evidence_passage_ids) ? (rawClaim as any).evidence_passage_ids[0] : undefined;
    const passageObj = passageId ? passagesMap.get(passageId) : undefined;
    const supportingText = passageObj?.exact_or_normalized_excerpt || passageObj?.exact_text || text;

    // Detect duplicate / colliding identities within the same evidence pack
    if (seenQualifiedClaimIds.has(qualifiedClaimId)) {
      ledgerEntries.push({
        claim_id: id,
        qualified_claim_id: qualifiedClaimId,
        evidence_pack_id: evidencePackId,
        statement: text,
        selection_status: 'REVIEW_REQUIRED',
        article_topic: topicStr,
        article_family: family,
        related_section_ids: [],
        selection_reason: `DUPLICATE_CLAIM_IDENTITY: Qualified claim identifier '${qualifiedClaimId}' is already registered in this evidence pack.`,
        relevance_class: 'INSUFFICIENT_EVIDENCE',
        source_id: sourceObj?.source_id,
        passage_id: passageId,
        canonical_source_url: sourceObj?.canonical_url,
        exact_supporting_text_reference: supportingText,
        applicability_scope: safeClaim?.applicability || 'UNKNOWN_SCOPE',
        qualification_required: 'Duplicate claim ID requires deduplication or human resolution.'
      });
      continue;
    }
    seenQualifiedClaimIds.add(qualifiedClaimId);

    // Filter A1: Web crawler garbage, repository navigation, and byline metadata
    const isCrawlerMetadataOrByline =
      /^(?:Saltar para|Skip to main content|Select context to search|in this series|in this repository|Theses & Dissertations|Conferences - Open Access|Author Resources|Graduate School tags|DOI:\s*Palavras-chave|Artigos\s+Skeletal|A atrofia esquelética)/i.test(text) ||
      /^(?:Rangineni,\s+Jyothi|Don Brothwell|Clemson University Department of Biological)/i.test(text);

    if (isCrawlerMetadataOrByline) {
      ledgerEntries.push({
        claim_id: id,
        qualified_claim_id: qualifiedClaimId,
        evidence_pack_id: evidencePackId,
        statement: text,
        selection_status: 'NOT_SELECTED',
        article_topic: topicStr,
        article_family: family,
        related_section_ids: [],
        selection_reason: 'CRAWLER_METADATA_OR_BYLINE: Metadata repositori, navigasi crawler, atau atribusi pengarang tanpa substansi teknis.',
        relevance_class: 'INSUFFICIENT_EVIDENCE',
        source_id: sourceObj?.source_id,
        passage_id: passageId,
        canonical_source_url: sourceObj?.canonical_url,
        exact_supporting_text_reference: supportingText,
        applicability_scope: safeClaim?.applicability || 'UNKNOWN_SCOPE',
        qualification_required: safeClaim?.qualification_required
      });
      continue;
    }

    // Filter A2: Ancient historical trivia and chronology
    const isAncientHistoryTrivia =
      /^\b\d{3,4}:\s*["'“]?[A-Z]/i.test(text) ||
      /\b(?:Elamite Temple|Achaemenid Empire|Darius the Great|Timurid Empire|Safavid Iran|Shah Mosque|Turco-Iranian|Kashi tile|zellige tradition|Medieval Europe|Delftware wall tiles|Samuel Stephens Kistle)/i.test(text);

    if (isAncientHistoryTrivia) {
      ledgerEntries.push({
        claim_id: id,
        qualified_claim_id: qualifiedClaimId,
        evidence_pack_id: evidencePackId,
        statement: text,
        selection_status: 'NOT_SELECTED',
        article_topic: topicStr,
        article_family: family,
        related_section_ids: [],
        selection_reason: 'HISTORICAL_TRIVIA: Catatan sejarah purba atau kronologi penemuan masa lalu di luar panduan bangunan kontemporer.',
        relevance_class: 'OUT_OF_SCOPE',
        source_id: sourceObj?.source_id,
        passage_id: passageId,
        canonical_source_url: sourceObj?.canonical_url,
        exact_supporting_text_reference: supportingText,
        applicability_scope: safeClaim?.applicability || 'UNKNOWN_SCOPE',
        qualification_required: safeClaim?.qualification_required
      });
      continue;
    }

    // Filter A3: Foreign statutory building codes non-applicable to Indonesian residential guidelines
    const isForeignStatutoryCode =
      /\b(?:ASHRAE\s+90\.1|Bouwbesluit|EnEV\b|Approved Documents?\s+[A-Z]|Clause\s+H1|Title\s+24\s+California|IECC\b|Soviet\s+SNiP|Building Code of Australia|National Construction Code|NCC\b|GB\s+50176|Wärmeschutzverordnung)\b/i.test(text);

    if (isForeignStatutoryCode) {
      ledgerEntries.push({
        claim_id: id,
        qualified_claim_id: qualifiedClaimId,
        evidence_pack_id: evidencePackId,
        statement: text,
        selection_status: 'NOT_SELECTED',
        article_topic: topicStr,
        article_family: family,
        related_section_ids: [],
        selection_reason: 'FOREIGN_STATUTORY_REGULATION: Foreign statutory building code or regional regulation not applicable to Indonesian residential guidelines.',
        relevance_class: 'OUT_OF_SCOPE',
        source_id: sourceObj?.source_id,
        passage_id: passageId,
        canonical_source_url: sourceObj?.canonical_url,
        exact_supporting_text_reference: supportingText,
        applicability_scope: safeClaim?.applicability || 'JURISDICTION_SPECIFIC',
        qualification_required: safeClaim?.qualification_required
      });
      continue;
    }

    // Filter A4: Reference stubs or insufficient proposition length (< 50 chars)
    if (text.length < 50 || /^See\s+.*?\s+for discussion of/i.test(text) || /^Main article:/i.test(text)) {
      ledgerEntries.push({
        claim_id: id,
        qualified_claim_id: qualifiedClaimId,
        evidence_pack_id: evidencePackId,
        statement: text,
        selection_status: 'NOT_SELECTED',
        article_topic: topicStr,
        article_family: family,
        related_section_ids: [],
        selection_reason: 'INSUFFICIENT_EVIDENCE: Cuplikan rujukan tidak lengkap atau terlalu pendek (< 50 karakter).',
        relevance_class: 'INSUFFICIENT_EVIDENCE',
        source_id: sourceObj?.source_id,
        passage_id: passageId,
        canonical_source_url: sourceObj?.canonical_url,
        exact_supporting_text_reference: supportingText,
        applicability_scope: safeClaim?.applicability || 'UNKNOWN_SCOPE',
        qualification_required: safeClaim?.qualification_required
      });
      continue;
    }

    // Stage A: Authoring Eligibility (Provenance and primary evidence standards)
    const topicContext = { topic: topicStr, articleFamily: family };
    const relevanceCheck = classifyClaimEditorialRelevance(rawClaim, topicContext);
    const isStageAEligible = Boolean(safeClaim) && safeClaim!.allowed_for_authoring !== false &&
      relevanceCheck.relevance !== 'OUT_OF_SCOPE' &&
      relevanceCheck.relevance !== 'INSUFFICIENT_EVIDENCE';

    if (!isStageAEligible) {
      const relClass: ClaimRelevanceClass = relevanceCheck.relevance === 'OUT_OF_SCOPE'
        ? 'OUT_OF_SCOPE'
        : (relevanceCheck.relevance === 'INSUFFICIENT_EVIDENCE' ? 'INSUFFICIENT_EVIDENCE' : 'PERIPHERAL_CONTEXT');

      ledgerEntries.push({
        claim_id: id,
        qualified_claim_id: qualifiedClaimId,
        evidence_pack_id: evidencePackId,
        statement: text,
        selection_status: 'NOT_SELECTED',
        article_topic: topicStr,
        article_family: family,
        related_section_ids: [],
        selection_reason: relevanceCheck.reason || safeClaim?.qualification_required || 'STAGE_A_INELIGIBLE: Klaim belum memenuhi kualifikasi bukti primer.',
        relevance_class: relClass,
        source_id: sourceObj?.source_id,
        passage_id: passageId,
        canonical_source_url: sourceObj?.canonical_url,
        exact_supporting_text_reference: supportingText,
        applicability_scope: safeClaim?.applicability || 'UNKNOWN_SCOPE',
        qualification_required: safeClaim?.qualification_required
      });
      continue;
    }

    // Stage B: Architectural Domain Boundary Filtering
    if (isFenestrationTopic) {
      const isWallStudAssembly = /\b(?:studs and joists|wood, steel or concrete members|staggered wall|structural insulated panels|sips\b)\b/i.test(lower);
      const isMasonryCavityTie = /\b(?:masonry cavity walls|metal ties in masonry|masonry walls experience)\b/i.test(lower);
      const isAtticRoofFoil = /\b(?:radiant (?:heat )?barriers?|reflective insulation|thermal emissivity values probably best reflect)\b/i.test(lower);
      const isBulkFiberMaterial = /\b(?:fibrous materials are made|cellular insulation is composed|bulk insulators block conductive|two types of building insulation - bulk|most thermal insulation we use is one of the three)\b/i.test(lower);
      const isColdClimateVIP = /\b(?:vacuum insulation panels|vacuum panels and aerogel wall surface|vips are noted for their ultra-high)\b/i.test(lower);
      const isRegionalForeignClimate = /\b(?:egypt and africa|in cold conditions, the main aim is to reduce heat flow out)\b/i.test(lower);
      const isGenericTautology = /\b(?:building insulation is material used in a building \(specifically|thermal insulation usually refers to the use of appropriate|how much insulation a house should have depends on building design|reducing unwanted heating or cooling energy input\. thermal insulation|thermal insulation can play a significant role in buildings, great dem|eco-friendly insulation is a term|the thermal envelope defines the conditioned)\b/i.test(lower);

      if (isWallStudAssembly || isMasonryCavityTie || isAtticRoofFoil || isBulkFiberMaterial || isColdClimateVIP || isRegionalForeignClimate || isGenericTautology) {
        ledgerEntries.push({
          claim_id: id,
          qualified_claim_id: qualifiedClaimId,
          evidence_pack_id: evidencePackId,
          statement: text,
          selection_status: 'NOT_SELECTED',
          article_topic: topicStr,
          article_family: family,
          related_section_ids: [],
          selection_reason: isWallStudAssembly
            ? 'PERIPHERAL_BUILDING_ENVELOPE: Stud dan rangka dinding eksterior kayu/baja di luar sistem fenestration kusen.'
            : (isMasonryCavityTie
              ? 'PERIPHERAL_BUILDING_ENVELOPE: Dinding rongga bata dan tie metal di luar sistem kusen aluminium.'
              : (isAtticRoofFoil
                ? 'PERIPHERAL_BUILDING_ENVELOPE: Radiant barrier foil atap loteng di luar lingkup kusen aluminium.'
                : (isBulkFiberMaterial
                  ? 'PERIPHERAL_BUILDING_ENVELOPE: Mikrostruktur serat glasswool/cellular insulasi massa dinding di luar profil kusen.'
                  : (isColdClimateVIP || isRegionalForeignClimate
                    ? 'PERIPHERAL_BUILDING_ENVELOPE: Teknologi iklim dingin atau referensi geografi Afrika di luar hunian tropis Indonesia.'
                    : 'PERIPHERAL_BUILDING_ENVELOPE: Definisi umum tautologis insulasi bangunan tanpa substansi teknis kusen.')))),
          relevance_class: 'PERIPHERAL_CONTEXT',
          source_id: sourceObj?.source_id,
          passage_id: passageId,
          canonical_source_url: sourceObj?.canonical_url,
          exact_supporting_text_reference: supportingText,
          applicability_scope: safeClaim?.applicability || 'UNIVERSAL_PHYSICS',
          qualification_required: safeClaim?.qualification_required
        });
        continue;
      }
    } else if (isRoofTopic) {
      const isFenestrationSpecific = /\b(?:thermally broken|polyamide|break|window-to-wall|door-to-wall|kusen|jendela|pintu)\b/i.test(lower);
      const isInteriorDecorSpecific = /\b(?:sirkulasi|60 cm|kursi kompak|meja lipat|balcon)\b/i.test(lower);
      if (isFenestrationSpecific || isInteriorDecorSpecific) {
        ledgerEntries.push({
          claim_id: id,
          qualified_claim_id: qualifiedClaimId,
          evidence_pack_id: evidencePackId,
          statement: text,
          selection_status: 'NOT_SELECTED',
          article_topic: topicStr,
          article_family: family,
          related_section_ids: [],
          selection_reason: 'PERIPHERAL_CONTEXT: Spesifikasi kusen/dekorasi interior di luar komparasi penutup atap.',
          relevance_class: 'PERIPHERAL_CONTEXT',
          source_id: sourceObj?.source_id,
          passage_id: passageId,
          canonical_source_url: sourceObj?.canonical_url,
          exact_supporting_text_reference: supportingText,
          applicability_scope: safeClaim?.applicability || 'UNIVERSAL_PHYSICS',
          qualification_required: safeClaim?.qualification_required
        });
        continue;
      }
    } else if (isFlooringTopic) {
      const isAlienToFloor = /\b(?:window|door|glazing|kusen|jendela|roof|atap|genteng|curtain wall|attic|radiant barrier|sips\b)\b/i.test(lower);
      if (isAlienToFloor) {
        ledgerEntries.push({
          claim_id: id,
          qualified_claim_id: qualifiedClaimId,
          evidence_pack_id: evidencePackId,
          statement: text,
          selection_status: 'NOT_SELECTED',
          article_topic: topicStr,
          article_family: family,
          related_section_ids: [],
          selection_reason: 'SYSTEM_DOMAIN_MISMATCH: Subjek klaim berada di luar batas sistem lantai dan ubin keramik.',
          relevance_class: 'PERIPHERAL_CONTEXT',
          source_id: sourceObj?.source_id,
          passage_id: passageId,
          canonical_source_url: sourceObj?.canonical_url,
          exact_supporting_text_reference: supportingText,
          applicability_scope: safeClaim?.applicability || 'UNIVERSAL_PHYSICS',
          qualification_required: safeClaim?.qualification_required
        });
        continue;
      }
    } else if (isDecorTopic) {
      const isHeavyEngineering = /\b(?:sni 1727|beban mati|kn\/m²|linear thermal transmittance|psi-value|thermal break|polyamide|thermal bridge|jembatan termal|conduction|u-value|r-value)\b/i.test(lower);
      if (isHeavyEngineering) {
        ledgerEntries.push({
          claim_id: id,
          qualified_claim_id: qualifiedClaimId,
          evidence_pack_id: evidencePackId,
          statement: text,
          selection_status: 'NOT_SELECTED',
          article_topic: topicStr,
          article_family: family,
          related_section_ids: [],
          selection_reason: 'PERIPHERAL_CONTEXT: Kalkulasi rekayasa struktural dan fisika termal di luar artikel inspirasi penataan ruang.',
          relevance_class: 'PERIPHERAL_CONTEXT',
          source_id: sourceObj?.source_id,
          passage_id: passageId,
          canonical_source_url: sourceObj?.canonical_url,
          exact_supporting_text_reference: supportingText,
          applicability_scope: safeClaim?.applicability || 'UNIVERSAL_PHYSICS',
          qualification_required: safeClaim?.qualification_required
        });
        continue;
      }
    }

    // Critical Technical & Safety Caveats Guard
    const isSafetyCaveat =
      /\b(?:humidity|kelembapan|wet|damp|condensation|kondensasi|titik embun|dew point|jamur|mold|sni 1727|beban mati|kn\/m²|pemuaian|movement joint|expansion joint|popping|terangkat|retak rambut|debonding|shatter|spontaneous breakage|pecah butiran|pecah serpihan|pvb interlayer|galvanic corrosion|retrofitting|deconstructed|kemiringan|derajat|slope)\b/i.test(lower);

    // Map related outline sections
    const relatedSectionIds: string[] = [];
    if (Array.isArray(outline) && outline.length > 0) {
      outline.forEach((sec, idx) => {
        const secId = `sec_${idx + 1}`;
        const secText = `${sec.heading} ${sec.objective} ${(sec.key_points || []).join(' ')}`.toLowerCase();
        if (
          (secText.includes('gejala') || secText.includes('penyebab') || secText.includes('panas') || secText.includes('dingin') || secText.includes('mekanisme') || secText.includes('fisik') || secText.includes('beban')) &&
          (lower.includes('conduction') || lower.includes('transfer') || lower.includes('resistance') || lower.includes('temperature') || lower.includes('psi') || lower.includes('konduksi') || lower.includes('pemuaian') || lower.includes('expansion') || lower.includes('impak') || lower.includes('benturan') || lower.includes('kekuatan'))
        ) {
          relatedSectionIds.push(secId);
        } else if (
          (secText.includes('solusi') || secText.includes('desain') || secText.includes('break') || secText.includes('kusen') || secText.includes('pilihan') || secText.includes('material') || secText.includes('keamanan') || secText.includes('penerapan')) &&
          (lower.includes('thermally broken') || lower.includes('polyamide') || lower.includes('thermal break') || lower.includes('glazing') || lower.includes('profil kusen') || lower.includes('laminated') || lower.includes('tempered') || lower.includes('pvb') || lower.includes('adhesive') || lower.includes('perekat') || lower.includes('movement joint') || lower.includes('spesi'))
        ) {
          relatedSectionIds.push(secId);
        } else if (
          (secText.includes('penanganan') || secText.includes('perawatan') || secText.includes('inspeksi') || secText.includes('pemeriksaan') || secText.includes('survei') || secText.includes('diagnosis') || secText.includes('praktis')) &&
          (lower.includes('surveying') || lower.includes('thermography') || lower.includes('infrared') || lower.includes('anomali') || lower.includes('hollow') || lower.includes('ketuk') || lower.includes('retrofitting') || lower.includes('identification'))
        ) {
          relatedSectionIds.push(secId);
        } else if (
          (secText.includes('perawatan') || secText.includes('keputusan') || secText.includes('panduan') || secText.includes('risiko') || secText.includes('akustik') || secText.includes('suara')) &&
          (lower.includes('sound') || lower.includes('akustik') || lower.includes('stc') || lower.includes('db\b') || lower.includes('noise') || lower.includes('humidity') || lower.includes('retrofitting') || lower.includes('perawatan') || lower.includes('cuaca'))
        ) {
          relatedSectionIds.push(secId);
        }
      });
    }

    if (isSafetyCaveat) {
      const caveatReason = 'CRITICAL_SAFETY_CAVEAT: Batasan teknis, risiko kegagalan fisik, atau kualifikasi keamanan yang wajib dipahami pemilik rumah.';
      const assignedSections = relatedSectionIds.length > 0 ? relatedSectionIds : ['sec_1'];

      ledgerEntries.push({
        claim_id: id,
        qualified_claim_id: qualifiedClaimId,
        evidence_pack_id: evidencePackId,
        statement: text,
        selection_status: 'SELECTED',
        article_topic: topicStr,
        article_family: family,
        related_section_ids: assignedSections,
        selection_reason: caveatReason,
        relevance_class: 'SAFETY_CAVEAT',
        source_id: sourceObj?.source_id,
        passage_id: passageId,
        canonical_source_url: sourceObj?.canonical_url,
        exact_supporting_text_reference: supportingText,
        applicability_scope: safeClaim?.applicability || 'UNIVERSAL_PHYSICS',
        qualification_required: safeClaim?.qualification_required
      });

      let sourceNote = 'Paket Bukti Riset Terverifikasi';
      if (sourceObj?.document_title) {
        sourceNote = sourceObj.document_title;
        if (sourceObj.publisher_or_author && !sourceNote.includes(sourceObj.publisher_or_author)) {
          sourceNote += ` (${sourceObj.publisher_or_author})`;
        }
      }
      let distinctionNotes: string | undefined = undefined;

      if (lower.includes('sni 1727') || lower.includes('beban mati') || lower.includes('kn/m²')) {
        sourceNote = 'SNI 1727:2020 Tabel C3.1-1 (Badan Standardisasi Nasional)';
        distinctionNotes = 'CATATAN INTEGRITAS: Angka 0,77 kN/m² (~78,5 kg/m²) pada SNI 1727:2020 adalah batas desain beban mati struktural minimum untuk perhitungan kekuatan rangka bangunan, BUKAN timbangan keping genteng polos di toko (keping genteng beton pasaran berkisar 40–50 kg/m²). Jelaskan perbedaan ini secara jernih.';
      } else if ((topicLower.includes('atap') || topicLower.includes('genteng') || topicLower.includes('seng')) && (lower.includes('kemiringan') || lower.includes('derajat') || lower.includes('slope'))) {
        sourceNote = 'Pedoman Teknis Pemasangan Pabrikan & Standar Kemiringan Atap';
        distinctionNotes = 'CATATAN INTEGRITAS: Bedakan dengan tegas antara derajat sudut (°) dan persen kemiringan (%). Atap metal lembaran berprofil tinggi dipasang pada sudut landai 3°–5° (bukan 5%). Genteng beton membutuhkan sudut curam minimal 25°–30° agar air mengalir deras dan tidak terjadi aliran balik di sambungan.';
      }

      verifiedEvidence.push({
        claim_id: id,
        qualified_claim_id: qualifiedClaimId,
        evidence_pack_id: evidencePackId,
        fact: text,
        source_note: sourceNote,
        is_verified: true,
        distinction_notes: distinctionNotes,
        relevance_class: 'SAFETY_CAVEAT',
        source_id: sourceObj?.source_id,
        passage_id: passageId,
        canonical_source_url: sourceObj?.canonical_url,
        applicability_scope: safeClaim?.applicability || 'UNIVERSAL_PHYSICS',
        qualification_required: safeClaim?.qualification_required
      });
      continue;
    }

    if (relatedSectionIds.length > 0) {
      let relClass: ClaimRelevanceClass = 'CORE_MECHANISM';
      let reason = 'SECTION_ALIGNED: Klaim mendukung sasaran subbab outline aktif (mekanisme inti).';
      if (/\b(?:thermally broken|polyamide|break|thermal break|profil kusen|laminated|tempered|pvb|adhesive|perekat|spesi|movement joint)\b/i.test(lower)) {
        relClass = 'CORE_SOLUTION';
        reason = 'SECTION_ALIGNED: Solusi komponen, spesifikasi perbaikan, atau material komparasi yang relevan.';
      } else if (/\b(?:surveying|thermography|infrared|hollow sound|anomali termal|ketuk)\b/i.test(lower)) {
        relClass = 'CORE_DIAGNOSIS';
        reason = 'SECTION_ALIGNED: Metode diagnostik inspeksi fisik yang mendukung subbab penanganan.';
      }

      ledgerEntries.push({
        claim_id: id,
        qualified_claim_id: qualifiedClaimId,
        evidence_pack_id: evidencePackId,
        statement: text,
        selection_status: 'SELECTED',
        article_topic: topicStr,
        article_family: family,
        related_section_ids: relatedSectionIds,
        selection_reason: reason,
        relevance_class: relClass,
        source_id: sourceObj?.source_id,
        passage_id: passageId,
        canonical_source_url: sourceObj?.canonical_url,
        exact_supporting_text_reference: supportingText,
        applicability_scope: safeClaim?.applicability || 'UNIVERSAL_PHYSICS',
        qualification_required: safeClaim?.qualification_required
      });

      let sourceNote = 'Paket Bukti Riset Terverifikasi';
      if (sourceObj?.document_title) {
        sourceNote = sourceObj.document_title;
        if (sourceObj.publisher_or_author && !sourceNote.includes(sourceObj.publisher_or_author)) {
          sourceNote += ` (${sourceObj.publisher_or_author})`;
        }
      }

      verifiedEvidence.push({
        claim_id: id,
        qualified_claim_id: qualifiedClaimId,
        evidence_pack_id: evidencePackId,
        fact: text,
        source_note: sourceNote,
        is_verified: true,
        relevance_class: relClass,
        source_id: sourceObj?.source_id,
        passage_id: passageId,
        canonical_source_url: sourceObj?.canonical_url,
        applicability_scope: safeClaim?.applicability || 'UNIVERSAL_PHYSICS',
        qualification_required: safeClaim?.qualification_required
      });
      continue;
    }

    // Borderline / Uncertain: fail-closed to REVIEW_REQUIRED
    ledgerEntries.push({
      claim_id: id,
      qualified_claim_id: qualifiedClaimId,
      evidence_pack_id: evidencePackId,
      statement: text,
      selection_status: 'REVIEW_REQUIRED',
      article_topic: topicStr,
      article_family: family,
      related_section_ids: [],
      selection_reason: 'AMBIGUOUS_RELEVANCE: Klaim memiliki relevansi umum tetapi tidak terikat langsung pada sasaran subbab outline aktif. Memerlukan peninjauan Chief Editor.',
      relevance_class: 'PERIPHERAL_CONTEXT',
      source_id: sourceObj?.source_id,
      passage_id: passageId,
      canonical_source_url: sourceObj?.canonical_url,
      exact_supporting_text_reference: supportingText,
      applicability_scope: safeClaim?.applicability || 'UNIVERSAL_PHYSICS',
      qualification_required: safeClaim?.qualification_required
    });
  }

  // Handle color guidelines and practical ergonomics
  for (const rawClaim of rawClaimsList) {
    const text = (rawClaim as any).statement || (rawClaim as any).claim_text || (rawClaim as any).text || '';
    const lower = text.toLowerCase();
    if (lower.includes('60-30-10') || lower.includes('palet warna') || lower.includes('warna netral')) {
      optionalExamples.push(
        'Formula palet warna 60-30-10 (60% netral hangat, 30% warna kayu alami sekunder, 10% aksen gelap): Wajib dijelaskan sebagai panduan visual opsional / heuristik dekorasi, BUKAN hukum mutlak atau aturan sejarah desain Jepang yang kaku.'
      );
    }
    if (lower.includes('sirkulasi') || lower.includes('60 cm') || lower.includes('jalur') || lower.includes('pintu')) {
      if (!practicalGuidelines.includes(text)) {
        practicalGuidelines.push(text);
      }
    }
  }

  // Family-specific practical guidelines and traps
  if (family === 'MATERIAL_COMPARISON') {
    if (topicLower.includes('atap') || topicLower.includes('genteng') || topicLower.includes('seng')) {
      practicalGuidelines.push(
        'Atap metal lembaran wajib diberi lapisan insulasi termal dan peredam suara (seperti aluminium foil berbusa XPE atau glasswool) di bawah lembaran untuk menahan radiasi panas siang dan meredam denting hujan.',
        'Genteng beton memerlukan rangka atap yang lebih kokoh dan rapat untuk menopang beban tumpukan puluhan kilogram per meter persegi.',
        'Kedua jenis atap memerlukan ventilasi rongga atap yang baik (kisi-kisi angin pada sopi-sopi atau nok ventilasi) agar hawa panas tidak terperangkap di atas plafon kamar.'
      );
      prohibitedTraps.push(
        'DILARANG mendeklarasikan satu material sebagai "pemenang mutlak" atau solusi terbaik universal. Keduanya memiliki trade-off fisika dan biaya sistem yang berbeda.',
        'DILARANG tertukar antara lambang persen (%) dan lambang derajat (°) saat membahas kemiringan atap metal (tulis 3° hingga 5°, bukan 5%).'
      );
    } else {
      practicalGuidelines.push(
        'Bandingkan karakteristik fisik, kepraktisan pemasangan, dan konsekuensi perawatan kedua opsi secara berimbang.',
        'Jelaskan trade-off nyata bagi kenyamanan dan efisiensi biaya pemilik rumah di iklim tropis.'
      );
      prohibitedTraps.push(
        'DILARANG mendeklarasikan satu opsi sebagai pemenang mutlak untuk semua skenario rumah.',
        'DILARANG membuat kesimpulan sepihak tanpa mempertimbangkan kondisi fisik bangunan dan prioritas pemilik rumah.'
      );
    }
  } else if (family === 'INSPIRATION_DECOR') {
    if (topicLower.includes('balkon')) {
      practicalGuidelines.push(
        'Sediakan jalur pijak dan sirkulasi minimal 60 sentimeter agar pintu dan lalu lintas tetap leluasa.',
        'Pilih furnitur kompak dengan kedalaman 45–50 cm atau model lipat/gantung untuk menjaga kelegaan lantai.',
        'Jangan pernah menutup lubang pembuangan air (floor drain) dengan pot atau ubin lantai.'
      );
      prohibitedTraps.push(
        'DILARANG menumpuk terlalu banyak pernak-pernik dekorasi yang memakan area lantai balkon sempit.',
        'DILARANG menyarankan tanaman besar yang akarnya berisiko merusak lapisan kedap air (waterproofing) balkon.'
      );
    } else {
      practicalGuidelines.push(
        'Utamakan sirkulasi ruang yang lega dan perabot fungsional berkaki ramping.',
        'Padukan warna dasar netral hangat dengan tekstur alami yang ramah disentuh.'
      );
      prohibitedTraps.push(
        'DILARANG membuat ruangan sesak dengan aksesori yang tidak memiliki fungsi nyata.',
        'DILARANG mengabaikan kemudahan perawatan menghadapi debu dan kelembapan tropis.'
      );
    }
  } else {
    practicalGuidelines.push(
      'Fokuskan diagnosis pada akar penyebab fisik (gejala vs sumber masalah) sebelum menentukan tindakan renovasi.',
      'Sajikan rekomendasi berdasarkan kondisi lapangan nyata (skenario terarah), bukan klaim satu solusi untuk semua.'
    );
    prohibitedTraps.push(
      'DILARANG langsung menyarankan pembongkaran besar sebelum pemeriksaan gejala awal selesai.',
      'DILARANG mengabaikan faktor kelembapan udara dan ventilasi pasif dalam menangani jembatan termal atau rembesan.'
    );
  }

  const selectionLedger: ClaimSelectionLedger = {
    evidence_pack_id: evidencePackId,
    article_topic: topicStr,
    article_family: family,
    total_claims_in_pack: ledgerEntries.length,
    authoring_eligible_count: ledgerEntries.filter(e => e.relevance_class !== 'OUT_OF_SCOPE' && e.relevance_class !== 'INSUFFICIENT_EVIDENCE').length,
    selected_count: ledgerEntries.filter(e => e.selection_status === 'SELECTED').length,
    not_selected_count: ledgerEntries.filter(e => e.selection_status === 'NOT_SELECTED').length,
    review_required_count: ledgerEntries.filter(e => e.selection_status === 'REVIEW_REQUIRED').length,
    entries: ledgerEntries
  };

  return {
    verifiedEvidence,
    practicalGuidelines,
    optionalExamples,
    prohibitedTraps,
    selectionLedger
  };
}

/**
 * Compiles a reader-focused section outline where each section is designed
 * to answer its heading directly in sentence 1 with strong continuity.
 */
export function compileReaderFocusedOutline(
  family: EditorialArticleFamily,
  topic: string,
  requestedTitle: string
): EditorialSectionObjective[] {
  const topicLower = `${requestedTitle || ''} ${topic}`.toLowerCase();

  if (family === 'MATERIAL_COMPARISON') {
    const isRoof = topicLower.includes('atap') || topicLower.includes('genteng') || topicLower.includes('seng');
    if (isRoof) {
      return [
        {
          heading: 'Bobot Ringan vs Massa yang Kokoh',
          objective: 'Membandingkan bobot lembaran metal dan genteng beton secara jujur serta dampaknya pada struktur rangka dan fondasi rumah.',
          key_points: [
            'Langsung jawab perbedaan berat di kalimat pembuka: lembaran metal berkisar 3,5–4,5 kg/m² (desain 7–14 kg/m²), sedangkan genteng beton di pasaran berbobot 40–50 kg/m².',
            'Jelaskan konteks SNI 1727:2020 beban mati 0,77 kN/m² (~78,5 kg/m²) sebagai acuan perhitungan kekuatan struktur bangunan.',
            'Jelaskan keuntungan atap metal pada rumah baru atau renovasi rumah lama tanpa memperberat struktur, serta kebutuhan rangka yang lebih kuat untuk genteng beton.'
          ]
        },
        {
          heading: 'Respons Termal: Panas Sore dan Pelepasan Kalor',
          objective: 'Menjelaskan perilaku fisika panas kedua material tanpa jargon yang membingungkan.',
          key_points: [
            'Langsung buka dengan perbedaan perilaku: metal cepat panas di siang hari namun cepat mendingin begitu matahari terbenam (kapasitas kalor rendah).',
            'Genteng beton menyerap panas lebih lambat, tetapi menyimpan panas dan melepaskannya perlahan ke rongga atap hingga malam hari.',
            'Tegaskan bahwa kedua material membutuhkan ventilasi rongga atap yang baik agar panas tidak menembus plafon kamar tidur.'
          ]
        },
        {
          heading: 'Kenyamanan Suara Saat Hujan Lebat',
          objective: 'Membahas perbedaan akustik saat hujan deras dan solusi praktisnya.',
          key_points: [
            'Akui secara jujur bahwa tetesan hujan pada atap metal lebih nyaring daripada genteng beton.',
            'Berikan solusi praktis: memasang insulasi foil berbusa atau glasswool di bawah atap metal serta plafon yang rapat.'
          ]
        },
        {
          heading: 'Kemiringan dan Fleksibilitas Bentuk Atap',
          objective: 'Menjelaskan batas sudut kemiringan atap agar tidak terjadi kebocoran atau tampias air.',
          key_points: [
            'Atap metal lembaran berprofil tinggi dapat dipasang pada sudut landai mulai 3° hingga 5° berkat lembaran panjang minim sambungan horizontal.',
            'Genteng beton membutuhkan kemiringan curam minimal 25° hingga 30° agar air mengalir deras tanpa risiko aliran balik di sela tumpukan.',
            'Kaitkan dengan bentuk arsitektur: atap landai cocok untuk desain minimalis modern, atap curam cocok untuk gaya klasik/mediterania.'
          ]
        },
        {
          heading: 'Perawatan dan Daya Tahan Menghadapi Cuaca Tropis',
          objective: 'Menguraikan titik kritis perawatan berkala untuk masing-masing material di iklim Indonesia.',
          key_points: [
            'Atap metal: periksa karat pada sekrup pengikat, paking karet, dan sambungan flashing di lingkungan lembap.',
            'Genteng beton: periksa lumut pada area teduh, risiko keping retak, serta sambungan semen pada wuwungan yang rentan retak rambut.'
          ]
        },
        {
          heading: 'Panduan Memilih Sesuai Kondisi Rumah',
          objective: 'Menyajikan kriteria ringkas kapan sebaiknya memilih metal dan kapan memilih genteng beton.',
          key_points: [
            'Daftar situasi yang tepat untuk memilih atap metal (atap landai, beban ringan, renovasi cepat, anggaran struktur efisien).',
            'Daftar situasi yang tepat untuk memilih genteng beton (atap curam, karakter visual kokoh, peredaman suara alami, struktur siap).',
            'Tekankan konsep biaya sistem (biaya atap + rangka + insulasi) alih-alih harga material kepingan semata.'
          ]
        },
        {
          heading: 'Penutup Bersahaja',
          objective: 'Menyerahkan kembali keputusan kepada kondisi nyata dan prioritas rumah pembaca (Warm Decision Handoff).',
          key_points: [
            'Tegaskan tidak ada pemenang tunggal untuk semua rumah.',
            'Ajak pembaca mempertimbangkan penutup atap, rangka, insulasi, dan ventilasi sebagai satu kesatuan sistem yang padu.'
          ]
        }
      ];
    }

    // Generic comparison outline (materials, equipment, solutions)
    return [
      {
        heading: 'Karakter Fisik dan Cara Kerja Sistem',
        objective: 'Membandingkan sifat fisik, mekanisme kerja, dan efektivitas kedua opsi secara objektif.',
        key_points: [
          'Jelaskan perbedaan mendasar cara kerja masing-masing opsi di lapangan.',
          'Uraikan bagaimana masing-masing opsi merespons beban kerja dan kondisi operasional harian.'
        ]
      },
      {
        heading: 'Kinerja dan Batasan Operasional di Lapangan',
        objective: 'Menjelaskan batas kemampuan dan apa yang bisa maupun tidak bisa diselesaikan oleh masing-masing opsi.',
        key_points: [
          'Paparkan batasan fisik dan situasi di mana opsi tertentu tidak efektif bekerja.',
          'Jelaskan aspek keselamatan, kenyamanan penghuni, dan keandalan fungsi.'
        ]
      },
      {
        heading: 'Persyaratan Pemasangan dan Dukungan Ruang',
        objective: 'Menjelaskan kebutuhan teknis instalasi, jalur sirkulasi, dan kepraktisan pengerjaan di lapangan.',
        key_points: [
          'Uraikan kebutuhan bukaan, saluran, ruang dudukan, atau pasokan udara/daya yang memadai.',
          'Jelaskan toleransi dan ketepatan pemasangan agar sistem tidak bekerja dalam kondisi tertekan.'
        ]
      },
      {
        heading: 'Daya Tahan dan Perawatan di Iklim Tropis',
        objective: 'Membahas ketahanan terhadap kelembapan tropis, akumulasi kotoran, dan pemeliharaan berkala.',
        key_points: [
          'Paparkan titik kritis perawatan berkala yang wajib diketahui pemilik rumah.',
          'Berikan panduan pembersihan dan pemeriksaan mandiri yang realistis.'
        ]
      },
      {
        heading: 'Panduan Memilih Sesuai Kondisi dan Prioritas Rumah',
        objective: 'Menyajikan rekomendasi praktis kapan memilih opsi pertama vs opsi kedua.',
        key_points: [
          'Daftar skenario hunian yang paling tepat untuk opsi pertama vs opsi kedua.',
          'Pertimbangkan aspek kepraktisan renovasi, efisiensi biaya, dan kebutuhan nyata penghuni.'
        ]
      },
      {
        heading: 'Penutup Bersahaja: Mengambil Keputusan Sesuai Prioritas',
        objective: 'Menyerahkan kembali keputusan kepada kondisi nyata dan prioritas rumah pembaca (Warm Decision Handoff).',
        key_points: [
          'Tegaskan tidak ada opsi yang unggul mutlak di segala situasi.',
          'Bantu pembaca menimbang antara kepraktisan, anggaran, dan kenyamanan jangka panjang.'
        ]
      }
    ];
  }

  if (family === 'INSPIRATION_DECOR') {
    return [
      {
        heading: 'Karakter Khas Desain dan Penataan Ruang',
        objective: 'Menguraikan ciri visual utama yang langsung dapat dikenali dan dirasakan kenyamanannya.',
        key_points: [
          'Langsung buka dengan gambaran visual ruang yang lapang, rapi, dan tidak menyesakkan mata.',
          'Jelaskan bahwa keindahan bukan berasal dari menumpuk banyak pernak-pernik, melainkan memilih setiap elemen yang fungsional dan bertekstur hangat.',
          'Bahas konsep jeda ruang (memberi ruang bernapas) agar mata bisa beristirahat.'
        ]
      },
      {
        heading: 'Paduan Warna yang Menenangkan Mata',
        objective: 'Memberikan panduan warna praktis yang membuat ruangan terasa terang dan rileks.',
        key_points: [
          'Buka dengan warna dasar netral hangat (off-white, krem, beige, abu-abu muda) yang memantulkan cahaya.',
          'Padukan dengan sentuhan serat kayu alami dan aksen kontras gelap secukupnya agar tidak pudar.',
          'Sebutkan rumus 60-30-10 sebagai panduan visual opsional, bukan aturan mutlak.',
          'Beri tips mengamati pengaruh cahaya matahari tropis terhadap warna cat di pagi, siang, dan sore hari.'
        ]
      },
      {
        heading: 'Memilih Furnitur Kompak dan Tekstur Alami',
        objective: 'Memandu pemilihan perabot yang tidak memakan tempat dan kaya tekstur sentuhan.',
        key_points: [
          'Pilih furnitur berprofil rendah atau berkaki ramping agar dinding dan plafon terlihat lebih tinggi dan lega.',
          'Ingatkan pertimbangan kenyamanan ergonomis nyata bagi seluruh keluarga, termasuk lansia.',
          'Tonjolkan kekayaan tekstur alami: kayu berpori terbuka, kain linen/katun bertekstur, anyaman rotan, atau gerabah matte alih-alih plastik berkilap licin.'
        ]
      },
      {
        heading: 'Pencahayaan Hangat dan Bukaan Alami',
        objective: 'Mengatur pencahayaan siang dan malam agar suasana rumah selalu menyenangkan.',
        key_points: [
          'Manfaatkan cahaya alami siang hari dengan tirai tipis tembus pandang (sheer curtain) untuk menyaring panas terik.',
          'Gunakan pencahayaan kuning hangat (2700K–3000K Warm White) di malam hari agar suasananya rileks dan menentramkan.',
          'Hindari lampu sorot putih tajam yang menyilaukan mata.'
        ]
      },
      {
        heading: 'Dekorasi Sederhana yang Bernyawa',
        objective: 'Menata aksesori secara bijak tanpa membuat ruangan penuh debu.',
        key_points: [
          'Pilih satu atau dua dekorasi yang bermakna (misal satu vas keramik sederhana atau tanaman hijau favorit).',
          'Sisakan bidang kosong pada rak atau meja agar ruangan tidak terlihat sesak.'
        ]
      },
      {
        heading: 'Perawatan Praktis di Rumah Tropis',
        objective: 'Memberikan kompromi perawatan nyata menghadapi kelembapan udara Indonesia.',
        key_points: [
          'Kayu berpori alami peka tumpahan cairan; segera lap dengan kain lembut lembap.',
          'Beri jarak perabot dari dinding yang lembap dan pastikan sirkulasi udara baik agar bebas jamur saat musim hujan.',
          'Gunakan alas gelas/piring untuk melindungi permukaan meja.'
        ]
      },
      {
        heading: 'Sudut Rumah yang Nyaman untuk Pulang',
        objective: 'Menutup artikel dengan dorongan hangat untuk memulai penataan secara bertahap.',
        key_points: [
          'Rumah terbaik bukan yang paling mirip foto katalog, melainkan yang paling nyaman dan mendukung rutinitas keluarga setiap hari.',
          'Ajak pembaca memulai dari langkah sederhana akhir pekan ini.'
        ]
      }
    ];
  }

  // 3. Shading / Peneduh Specific Outline
  if (topicLower.includes('shading') || topicLower.includes('peneduh') || topicLower.includes('overhang') || topicLower.includes('louver') || topicLower.includes('awning')) {
    return [
      {
        heading: 'Mengapa Shading Luar Lebih Efektif Menangkal Panas Tropis',
        objective: 'Menjelaskan mekanisme fisika dasar mengapa peneduh eksterior jauh lebih unggul daripada tirai dalam ruangan.',
        key_points: [
          'Langsung jawab di kalimat pertama: peneduh luar menghentikan radiasi panas matahari sebelum menyentuh kaca jendela dan menembus ke dalam rumah.',
          'Bahas kelemahan gorden/tirai dalam ruangan yang hanya menahan silau namun panasnya sudah terlanjur terperangkap di dalam ruangan.',
          'Kaitkan dengan penghematan beban pendinginan AC dan kenyamanan alami penghuni.'
        ]
      },
      {
        heading: 'Overhang dan Tritisan Atap: Perlindungan Pasif Paling Bersahaja',
        objective: 'Membahas kelebihan dan keterbatasan tritisan lebar sebagai peneduh pasif alami.',
        key_points: [
          'Bahas keunggulan tritisan atap: tanpa mekanik, melindungi dari panas dan tempias hujan sekaligus.',
          'Jelaskan dimensi ideal untuk iklim Indonesia (lebar teritisan 80–120 cm).',
          'Sebutkan keterbatasan pada rumah perkotaan dengan garis sempadan bangunan sempit.'
        ]
      },
      {
        heading: 'Louver dan Kisi-kisi: Menghalau Silau Tanpa Menutup Aliran Angin',
        objective: 'Menguraikan fleksibilitas bilah kisi-kisi dan orientasi hadap bukaan.',
        key_points: [
          'Jelaskan cara kerja louver: menghalau sudut jatuh sinar matahari langsung namun tetap meloloskan ventilasi udara alami.',
          'Bahas orientasi: louver horizontal cocok untuk bukaan hadap utara/selatan, sedangkan louver vertikal lebih efektif untuk matahari rendah hadap timur/barat.',
          'Sebutkan pilihan material bilah (aluminium, kayu komposit, atau beton aerasi).'
        ]
      },
      {
        heading: 'Awning dan Kanopi: Solusi Tambahan yang Cepat dan Fleksibel',
        objective: 'Membahas kanopi kain/polycarbonate untuk bukaan yang membutuhkan perlindungan instan.',
        key_points: [
          'Bahas kepraktisan pemasangan awning lipat atau kanopi gantung pada rumah yang sudah dihuni.',
          'Jelaskan titik kritis: sudut kemiringan agar air hujan dan debu tidak mengendap di permukaan kain/atap.',
          'Bahas ketahanan material terhadap paparan terik dan jamur lumut tropis.'
        ]
      },
      {
        heading: 'Secondary Facade: Tameng Ganda untuk Dinding Hadap Panas Sore',
        objective: 'Membahas aplikasi fasad lapis kedua pada dinding atau bukaan yang terkena matahari barat.',
        key_points: [
          'Bahas konsep rongga udara (air cavity) di antara dinding utama dan fasad luar yang membuang panas lewat efek cerobong alami.',
          'Jelaskan aplikasi realistis (bata roster, expanded metal mesh, atau kisi kayu).',
          'Ingatkan akses perawatan di balik kisi-kisi agar tidak menjadi sarang debu atau sarang burung.'
        ]
      },
      {
        heading: 'Panduan Memilih yang Paling Masuk Akal untuk Rumahmu',
        objective: 'Menyajikan skenario konkret pemilihan berbasis bukaan, anggaran, dan kemudahan perawatan.',
        key_points: [
          'Buat ringkasan perbandingan: kapan memilih overhang, louver, awning, atau secondary skin.',
          'Tutup dengan pesan kehangatan konsultan RancangLoka: pilihan terbaik adalah yang sesuai orientasi matahari dan mudah dirawat oleh pemilik rumah.'
        ]
      }
    ];
  }

  // Fallback / General Building Guide Outline
  return [
    {
      heading: 'Memahami Masalah Pokok di Lapangan',
      objective: 'Menjelaskan akar penyebab fisik dan konteks keputusan yang dihadapi pemilik rumah.',
      key_points: [
        'Langsung jawab inti masalah di kalimat pertama.',
        'Jelaskan mengapa gejala permukaan sering mengecoh sebelum akar masalah diperiksa.'
      ]
    },
    {
      heading: 'Pertimbangan Teknis dan Pilihan Solusi',
      objective: 'Membandingkan alternatif solusi dengan trade-off yang jelas.',
      key_points: [
        'Uraikan opsi solusi dengan kelebihan dan kekurangannya.',
        'Bahas dampak praktis pada kenyamanan dan anggaran penghuni.'
      ]
    },
    {
      heading: 'Langkah Penanganan Praktis dan Perawatan',
      objective: 'Memberikan panduan pelaksanaan bertahap yang realistis.',
      key_points: [
        'Rincikan urutan pengerjaan yang benar.',
        'Sertakan tips perawatan rutin untuk iklim tropis.'
      ]
    },
    {
      heading: 'Keputusan yang Tepat untuk Rumahmu',
      objective: 'Menyerahkan kembali agensi keputusan kepada pemilik rumah secara percaya diri.',
      key_points: [
        'Rangkum kesimpulan utama.',
        'Tutup dengan kehangatan konsultan bersahaja.'
      ]
    }
  ];
}

/**
 * Main Editorial Planner entrypoint.
 * Compiles a reader-focused, verified Editorial Brief for Joko.
 */
export function compileEditorialBrief(input: EditorialPlannerInput): EditorialBrief {
  const family = detectEditorialArticleFamily(input.topic, input.requestedTitle, input.intentProfile);
  const title = input.requestedTitle || input.topic;
  const topicLower = `${title} ${input.topic}`.toLowerCase();

  const outline = compileReaderFocusedOutline(family, input.topic, title);
  const taxonomy = auditFactualClaimsTaxonomy(input.authorSafeClaims, input.evidencePack, family, outline, input.topic);

  // Distribute selected claims to outline sections based on related_section_ids
  for (let idx = 0; idx < outline.length; idx++) {
    const secId = `sec_${idx + 1}`;
    const claimsForSec = taxonomy.selectionLedger.entries
      .filter(e => e.selection_status === 'SELECTED' && e.related_section_ids.includes(secId))
      .map(e => e.claim_id);
    const qualifiedClaimsForSec = taxonomy.selectionLedger.entries
      .filter(e => e.selection_status === 'SELECTED' && e.related_section_ids.includes(secId))
      .map(e => e.qualified_claim_id || (e.evidence_pack_id ? `${e.evidence_pack_id}::${e.claim_id}` : e.claim_id));
    if (claimsForSec.length > 0) {
      outline[idx].claim_ids = claimsForSec;
      outline[idx].qualified_claim_ids = qualifiedClaimsForSec;
    }
  }

  const isRoofTopic = topicLower.includes('atap') || topicLower.includes('genteng') || topicLower.includes('seng');

  const searchIntent =
    family === 'MATERIAL_COMPARISON'
      ? (isRoofTopic
          ? 'Pemilik rumah ingin memahami perbedaan nyata, beban struktur, dan kenyamanan termal/akustik antara pilihan penutup atap agar bisa memilih sesuai bentuk atap dan anggaran tanpa salah beli.'
          : 'Pemilik rumah ingin memahami perbedaan nyata, efektivitas fungsi, dan konsekuensi praktis antara opsi yang dibandingkan agar dapat mengambil keputusan yang paling tepat sesuai kebutuhan hunian.')
      : family === 'INSPIRATION_DECOR'
      ? 'Pemilik rumah ingin ide penataan yang nyata, praktis, dan terjangkau agar ruang hunian terasa lebih lega, rapi, dan nyaman untuk bersantai tanpa renovasi besar.'
      : 'Pemilik rumah mencari solusi praktis dan diagnosis fisik yang dapat diandalkan untuk masalah hunian mereka.';

  const editorialAngle =
    family === 'MATERIAL_COMPARISON'
      ? (isRoofTopic
          ? 'Tidak ada pemenang mutlak untuk semua rumah. Setiap opsi memiliki keunggulan fisik, beban struktur, dan kenyamanan sistem tersendiri. Pilihan terbaik ditentukan oleh struktur rangka, kemiringan atap, dan kebutuhan hunian.'
          : 'Tidak ada pemenang mutlak untuk semua rumah. Setiap opsi memiliki keunggulan karakteristik fisik, efektivitas fungsi, dan konsekuensi perawatan tersendiri. Pilihan terbaik ditentukan oleh kondisi fisik lapangan dan prioritas kebutuhan hunian.')
      : family === 'INSPIRATION_DECOR'
      ? 'Keindahan dan kenyamanan bukan tentang membeli banyak perabot baru atau menghafal teori arsitektur rumit, melainkan tentang memilih elemen fungsional yang ramping, tekstur alami, dan sirkulasi yang lega.'
      : 'Pendekatan konsultan bangunan yang mendiagnosis penyebab mendasar sebelum memutuskan tindakan perbaikan.';

  const toneGuidance =
    'Suara konsultan bangunan dan arsitektur Indonesia yang dewasa, santai, jernih, dan bersahaja ("Dewasa dan santai"). ' +
    'Pastikan alur baca mengalir mulus dengan setiap subbab LANGSUNG MENJAWAB JUDULNYA di kalimat pertama ("flow baca lebih enak nyambung ke title atau heading yang sedang dibahas"). ' +
    'Hindari drama retoris, hindari dilema buatan yang dibuat-buat, dan gunakan bahasa Indonesia sehari-hari yang santun (tidak, sudah, ingin, seperti).';

  return {
    brief_id: `brief_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
    evidence_pack_id: taxonomy.selectionLedger.evidence_pack_id,
    topic: input.topic,
    requested_title: title,
    article_family: family,
    search_intent: searchIntent,
    editorial_angle: editorialAngle,
    tone_guidance: toneGuidance,
    outline,
    verified_evidence: taxonomy.verifiedEvidence,
    claim_selection_ledger: taxonomy.selectionLedger,
    practical_guidelines: taxonomy.practicalGuidelines,
    optional_design_examples: taxonomy.optionalExamples,
    prohibited_traps: taxonomy.prohibitedTraps,
    word_count_target: {
      min: 1200,
      max: 1500
    }
  };
}
