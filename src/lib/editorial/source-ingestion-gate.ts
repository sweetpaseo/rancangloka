/**
 * Source Ingestion Quality Gate & Decision Contract
 * Milestone: IRWAN-ACQUISITION-HARDENING
 *
 * Enforces pre-extraction quality evaluation for retrieved scholarly,
 * institutional, and web documents before claim extraction or passage generation.
 *
 * Decisions:
 * - SOURCE_ACCEPTED: Authentic, topic-aligned, substantive building science evidence.
 * - SOURCE_REJECTED: Out-of-domain (biomedical, clinical, apparel, software repos, politics,
 *                    ancient history trivia, crawler navigation, scraper bylines, thin content).
 * - SOURCE_REVIEW_REQUIRED: Edge-case technical material requiring editorial review.
 * - RESEARCH_RETRY_REQUIRED: Pack-level status when accepted sources are insufficient.
 *
 * Invariant:
 * Claims and passages are NEVER extracted from SOURCE_REJECTED documents.
 */

import {
  generateEditorialResearchQuestions,
  type EditorialResearchQuestion,
  type ResearchQuestionCategory
} from './research-questions.ts';
import { classifyBuildingDomain, type BuildingDomain } from './topic-alignment.ts';
import { cleanBoilerplateAndSpam } from './evidence-quality-gate.ts';

export type SourceQualityDecisionType =
  | 'SOURCE_ACCEPTED'
  | 'SOURCE_REJECTED'
  | 'SOURCE_REVIEW_REQUIRED'
  | 'RESEARCH_RETRY_REQUIRED';

export interface SourceQualityDecision {
  decision: SourceQualityDecisionType;
  article_topic: string;
  research_question: string;
  source_id: string;
  canonical_url: string;
  document_title: string;
  evidence_excerpt: string;
  relevance_rationale: string;
  applicable_domain: string;
  confidence_basis: string;
  rejection_or_escalation_reason?: string;
  evaluated_at: string;
}

export interface ResearchQuestionCoverageTrace {
  research_question_id: string;
  category: ResearchQuestionCategory | string;
  question_text: string;
  accepted_source_ids: string[];
  supported_claim_ids: string[];
  coverage_decision: 'COVERED' | 'PARTIAL' | 'UNCOVERED';
  is_essential: boolean;
  notes?: string;
}

export interface ResearchReadinessEvaluation {
  readiness_status: 'READY_FOR_AUTHORING' | 'RESEARCH_RETRY_REQUIRED' | 'REVIEW_REQUIRED';
  topic: string;
  editorial_family?: string;
  accepted_sources_count: number;
  rejected_sources_count: number;
  review_required_sources_count: number;
  accepted_source_ids: string[];
  rejected_source_ids: string[];
  covered_categories_count: number;
  total_claims_count: number;
  is_authoring_eligible: boolean;
  block_reason?: string;
  question_traces?: ResearchQuestionCoverageTrace[];
  uncovered_essential_questions?: string[];
}

// =========================================================================
// OUT-OF-DOMAIN NEGATIVE PATTERNS (STRICT REJECTION)
// =========================================================================

export const STRICT_OUT_OF_DOMAIN_PATTERNS = [
  // Biomedical, clinical, neurological, orthopedic, surgical, infectious disease
  /\b(?:htlv|hiv|aids|spastic paraparesis|paralysis|skeletal atrophy|spondylodiscitis|spinal infection|osteomyelitis|rheumatoid arthritis|chemotherapy|oncology|pediatric|pediatrics|orthopedic surgery|clinical trial|clinical evaluation|patients?|hospital|disease|vaccine|pathology|therapeutic|pharmacology|pharmacokinetics)\b/i,
  // Medical electronic health records / clinical AI dissertations
  /\b(?:electronic health records|ehr|clinical workflows|maastricht university dissertation|clinical decision support)\b/i,
  // Behavioral / Sexual / Public Health
  /\b(?:risky sexual behaviour|sexual behavior|contraceptive|reproductive health)\b/i,
  // Apparel, tailoring, 19th-century garments, fashion history
  /\b(?:mensurations du corps|confection du vêtement|ajustements|fashion sizing|tailoring systems|garment industry)\b/i,
  // Software engineering repositories, LLM application frameworks
  /\b(?:software engineering repository|large language model-based applications|bounded agency primitives|ssrn\.6912758)\b/i,
  // Elementary education, child school feeding, school failure
  /\b(?:combating failure at school|elementary school lunch|childhood nutrition|pedagogy in schools)\b/i,
  // Politics, voting, elections
  /\b(?:pemilihan umum|pemilu|legislatif|parlemen|partai politik|election law)\b/i,
  // Ancient history trivia unrelated to modern building defect remediation
  /\b(?:ancient egyptian faience|babylonian glazed bricks|medieval heraldic tiles|roman mosaic pavements|fourth dynasty|assyrian palace)\b/i
];

// =========================================================================
// SCRAPER / CRAWLER NAVIGATION PATTERNS (MULTILINGUAL)
// =========================================================================

export const CRAWLER_NAVIGATION_PATTERNS = [
  // Portuguese Open Journal Systems (OJS) & portal crawler navigation
  /\b(?:saltar para (?:o )?conteúdo principal|saltar para (?:o )?menu(?: de navegação)?|saltar para rodapé do site|sobre a revista|submissões|equipa editorial|código de ética|declaração privacidade|antropologia portuguesa|impactum-journals|volumes antigos|para leitores|para autores|para bibliotecários)\b/i,
  // English web crawler boilerplate
  /\b(?:skip to main content|skip to navigation|skip to footer|toggle navigation menu)\b/i,
  // Indonesian crawler strings
  /\b(?:loncat ke konten utama|menuju menu navigasi)\b/i
];

// =========================================================================
// LEGITIMATE INTERDISCIPLINARY MATERIALS SCIENCE & THERMAL PHYSICS
// =========================================================================

export const LEGITIMATE_PHYSICS_AND_MATERIALS_PATTERNS = [
  // Interlayer polymers & safety glass mechanics
  /\b(?:pvb|polyvinyl butyral|eva|ethylene-vinyl acetate|interlayer|laminated glass|toughened glass|tempered glass|fracture mechanics|impact resistance|acoustic transmission stc|four-point bending|thermal stress fracture|spontaneous breakage|nickel sulfide|post-breakage|astm c1048|astm c1172|sni 15-0047|sni 15-1311)\b/i,
  // Fenestration, thermal breaks & condensation
  /\b(?:polyamide|thermal break|thermal bridge|heat transfer|thermal conductivity|u-factor|u-value|psi|linear thermal transmittance|dew point|surface condensation|relative humidity|condensation resistance|cr rating|psychrometric|therm|finite element|infrared thermography|warm-edge spacer|argon gas filling|low-e coating|shgc)\b/i,
  // Flooring adhesion, screed mechanics & movement joints
  /\b(?:thinset mortar|cementitious adhesive|c2te|polymer-modified mortar|movement joint|expansion joint|perimeter joint|debonding|tenting|buckling|shear stress|concrete drying shrinkage|substrate deflection|moisture vapor emission|astm f2170|astm c627|tcna handbook|iso 13007|sni 03-3987)\b/i,
  // Wall moisture, capillary dynamics & waterproofing
  /\b(?:capillary suction|rising damp|liquid water transport|vapor permeability|breathability|efflorescence|crystallization pressure|waterproofing membrane|hydrostatic pressure|elastomeric coating|astm d1059|astm c836|sni 03-6861)\b/i,
  // Roof radiant barriers & attic physics
  /\b(?:radiant barrier|reflective foil|emittance|emissivity|thermal radiation|air space requirement|attic ventilation|soffit vent|ridge vent|stack effect|astm c1313|astm c1371)\b/i
];

/**
 * Evaluates whether a chunk or document consists of crawler navigation or scraper boilerplate.
 */
export function isCrawlerOrScraperContamination(text: string): { isContaminated: boolean; patternMatch?: string } {
  const sample = text.slice(0, 3000);
  for (const pat of CRAWLER_NAVIGATION_PATTERNS) {
    if (pat.test(sample)) {
      return { isContaminated: true, patternMatch: pat.source };
    }
  }
  return { isContaminated: false };
}

/**
 * Checks whether an excerpt from an encyclopedic source is ancient history trivia
 * unrelated to modern architectural engineering or construction problem solving.
 */
export function isAncientHistoryTrivia(text: string, articleTopic: string): boolean {
  const isModernBuildingTopic = /\b(?:popping|meledak|terangkat|retak|bocor|rembes|kondensasi|thermal|break|pemasangan|nat|mortar)\b/i.test(articleTopic);
  if (!isModernBuildingTopic) return false;

  const ancientKeywords = /\b(?:ancient|antiquity|millennium bc|century bc|faience|mesopotamia|babylon|assyria|pharaoh|dynasty|medieval heraldry|roman empire|archaeological excavations)\b/i;
  const modernEngineeringKeywords = /\b(?:mortar|adhesive|movement joint|expansion joint|screed|tensile|shrinkage|shear|popping|thermal stress|installation|grout|flexible)\b/i;

  return ancientKeywords.test(text) && !modernEngineeringKeywords.test(text);
}

/**
 * Evaluates the ingestion quality of a retrieved candidate or document.
 * Returns an auditable SourceQualityDecision.
 */
export function evaluateSourceIngestionQuality(params: {
  topic: string;
  sourceId: string;
  title: string;
  publisher?: string;
  url?: string;
  canonicalUrl?: string;
  doi?: string;
  abstractOrSnippet?: string;
  fullText?: string;
  researchQuestion?: string;
  intendedRole?: string;
}): SourceQualityDecision {
  const now = new Date().toISOString();
  const rq = params.researchQuestion || 'RQ-GENERAL-EVIDENCE';
  const url = params.canonicalUrl || params.url || '';
  const textSample = params.fullText || params.abstractOrSnippet || '';
  const combinedMeta = `${params.title} ${params.publisher || ''} ${url} ${params.doi || ''} ${textSample.slice(0, 4000)}`.toLowerCase();

  const topicClass = classifyBuildingDomain(params.topic);
  const topicDomain = topicClass.domain;

  // 1. Strict Out-of-Domain Filter (Biomedical, Tailoring, Clinical AI, Elections)
  for (const pat of STRICT_OUT_OF_DOMAIN_PATTERNS) {
    if (pat.test(combinedMeta)) {
      return {
        decision: 'SOURCE_REJECTED',
        article_topic: params.topic,
        research_question: rq,
        source_id: params.sourceId,
        canonical_url: url,
        document_title: params.title,
        evidence_excerpt: textSample.slice(0, 200),
        relevance_rationale: 'OUT_OF_DOMAIN_STRICT_REJECTION: Dokumen terbukti berada di luar domain sains bangunan (medis, klinis, pengukuran busana, politik, atau software).',
        applicable_domain: 'NON_ARCHITECTURAL_OUT_OF_DOMAIN',
        confidence_basis: `Pattern match: ${pat.source}`,
        rejection_or_escalation_reason: `OUT_OF_DOMAIN_REJECTION: Matched pattern ${pat.source}`,
        evaluated_at: now
      };
    }
  }

  // 2. Scraper / Crawler Navigation Detection
  const crawlerCheck = isCrawlerOrScraperContamination(textSample);
  if (crawlerCheck.isContaminated) {
    const searchCorpus = (params.title + ' ' + (params.publisher || '') + ' ' + url + ' ' + textSample.slice(0, 50000)).toLowerCase();
    const isLegitimatePhysics = LEGITIMATE_PHYSICS_AND_MATERIALS_PATTERNS.some(pat => pat.test(searchCorpus));
    const isGovernmentOrInstitutional = /\.(?:gov|edu|ac\.[a-z]{2}|org)\b/i.test(url) ||
      /\b(?:epa|doe|lbnl|nist|ornl|university|kementerian|badan standardisasi)\b/i.test(params.title + ' ' + (params.publisher || ''));
    const isSubstantiveTechnicalDoc = textSample.length >= 400 && (isLegitimatePhysics || isGovernmentOrInstitutional);

    if (!isSubstantiveTechnicalDoc) {
      return {
        decision: 'SOURCE_REJECTED',
        article_topic: params.topic,
        research_question: rq,
        source_id: params.sourceId,
        canonical_url: url,
        document_title: params.title,
        evidence_excerpt: textSample.slice(0, 200),
        relevance_rationale: 'SCRAPER_NAVIGATION_REJECTION: Teks mengandung string navigasi crawler/scraper atau menu administratif repositori.',
        applicable_domain: 'SCRAPER_METADATA',
        confidence_basis: `Crawler pattern detected: ${crawlerCheck.patternMatch}`,
        rejection_or_escalation_reason: `SCRAPER_NAVIGATION_DETECTED: Matched ${crawlerCheck.patternMatch}`,
        evaluated_at: now
      };
    }
  }

  // 3. Substantive Text Length Check
  const cleaned = cleanBoilerplateAndSpam(textSample, 100);
  if (!cleaned.is_content_quality_sufficient || cleaned.clean_content_length < 150) {
    return {
      decision: 'SOURCE_REJECTED',
      article_topic: params.topic,
      research_question: rq,
      source_id: params.sourceId,
      canonical_url: url,
      document_title: params.title,
      evidence_excerpt: textSample.slice(0, 200),
      relevance_rationale: 'CONTENT_TOO_THIN: Konten tidak memadai atau terlalu tipis setelah pembersihan boilerplate/spam.',
      applicable_domain: 'INSUFFICIENT_TEXT',
      confidence_basis: `Clean text length: ${cleaned.clean_content_length} bytes (< 150)`,
      rejection_or_escalation_reason: `CONTENT_TOO_THIN: ${cleaned.rejection_reason || 'Length < 150 chars'}`,
      evaluated_at: now
    };
  }

  // 4. Topic Domain Specific Checks

  // Case A: Laminated vs Tempered Glass
  if (/\b(?:kaca|glass|tempered|laminated)\b/i.test(params.topic) && !/(?:ber)?kondensasi|embun|dew point/i.test(params.topic)) {
    const isFenestrationOrGlass = /\b(?:kaca|glass|glazing|tempered|laminated|toughened|pvb|interlayer|fenestration|window|curtain wall|thermal stress|benturan|shatter|pecah|acoustic|stc)\b/i.test(combinedMeta);
    if (!isFenestrationOrGlass) {
      return {
        decision: 'SOURCE_REJECTED',
        article_topic: params.topic,
        research_question: rq,
        source_id: params.sourceId,
        canonical_url: url,
        document_title: params.title,
        evidence_excerpt: textSample.slice(0, 200),
        relevance_rationale: 'TOPIC_MISMATCH: Dokumen tidak membahas kaca arsitektur, laminated, tempered, atau glazing fenestration.',
        applicable_domain: 'NON_FENESTRATION',
        confidence_basis: 'Absence of architectural glass and glazing terminology',
        rejection_or_escalation_reason: 'TOPIC_MISMATCH: No architectural glass concepts found',
        evaluated_at: now
      };
    }
  }

  // Case B: Ceramic Floor Popping (Tile debonding, buckling, movement joints)
  if (/\b(?:popping|meledak|keramik|tile|lantai)\b/i.test(params.topic)) {
    // Specifically check for Clemson vinyl plank / PBM resilient flooring mold study
    if (/\b(?:plastic-based material|pbm|vinyl plank|resilient flooring|clemson university|mold growth resistance)\b/i.test(combinedMeta) && !/\b(?:debonding|tenting|movement joint|expansion joint|screed|adhesion failure)\b/i.test(combinedMeta)) {
      return {
        decision: 'SOURCE_REJECTED',
        article_topic: params.topic,
        research_question: rq,
        source_id: params.sourceId,
        canonical_url: url,
        document_title: params.title,
        evidence_excerpt: textSample.slice(0, 200),
        relevance_rationale: 'MATERIAL_MISMATCH: Dokumen mengevaluasi ketahanan jamur lantai vinyl/plastik (PBM) atau material lentur, bukan mekanisme popping/tenting ubin keramik dan dilatasi nat.',
        applicable_domain: 'RESILIENT_PLASTIC_FLOORING',
        confidence_basis: 'Resilient vinyl flooring testing is not applicable to ceramic tile debonding physics',
        rejection_or_escalation_reason: 'MATERIAL_MISMATCH: PBM vinyl flooring study rejected for ceramic tile topic',
        evaluated_at: now
      };
    }

    const isTileOrFlooring = /\b(?:tile|keramik|granit|flooring|subfloor|screed|mortar|grout|expansion joint|movement joint|tenting|popping|debonding|adhesion|pemuaian|dilatasi)\b/i.test(combinedMeta);
    if (!isTileOrFlooring) {
      return {
        decision: 'SOURCE_REJECTED',
        article_topic: params.topic,
        research_question: rq,
        source_id: params.sourceId,
        canonical_url: url,
        document_title: params.title,
        evidence_excerpt: textSample.slice(0, 200),
        relevance_rationale: 'TOPIC_MISMATCH: Dokumen tidak membahas ubin keramik, adukan semen, atau pergerakan lantai.',
        applicable_domain: 'NON_FLOORING',
        confidence_basis: 'Absence of tile and flooring adhesion concepts',
        rejection_or_escalation_reason: 'TOPIC_MISMATCH: No tile/flooring concepts found',
        evaluated_at: now
      };
    }
  }

  // Case C: Window Condensation & Thermal Breaks
  if (/(?:ber)?kondensasi|embun|dew point|thermal break/i.test(params.topic)) {
    // Check for automotive spark plug silicone grease
    if (/\b(?:spark plug|battery terminal|automotive electrical|dielectric grease)\b/i.test(combinedMeta) && !/\b(?:glazing|window|fenestration|architectural sealant)\b/i.test(combinedMeta)) {
      return {
        decision: 'SOURCE_REJECTED',
        article_topic: params.topic,
        research_question: rq,
        source_id: params.sourceId,
        canonical_url: url,
        document_title: params.title,
        evidence_excerpt: textSample.slice(0, 200),
        relevance_rationale: 'APPLICATION_MISMATCH: Gemuk dielektrik silikon busi otomotif tidak relevan untuk sains kondensasi jendela hunian.',
        applicable_domain: 'AUTOMOTIVE_ELECTRICAL',
        confidence_basis: 'Automotive grease application detected without fenestration relevance',
        rejection_or_escalation_reason: 'APPLICATION_MISMATCH: Automotive grease rejected for fenestration topic',
        evaluated_at: now
      };
    }

    const isCondensationOrEnvelope = /\b(?:kondensasi|embun|dew point|thermal break|u-factor|conductivity|glazing|window|frame|kusen|aluminium|upvc|air space|relative humidity|psychrometric|insulation|mold|moisture|jamur|indoor air|ventilation|iaq)\b/i.test(combinedMeta);
    if (!isCondensationOrEnvelope) {
      return {
        decision: 'SOURCE_REJECTED',
        article_topic: params.topic,
        research_question: rq,
        source_id: params.sourceId,
        canonical_url: url,
        document_title: params.title,
        evidence_excerpt: textSample.slice(0, 200),
        relevance_rationale: 'TOPIC_MISMATCH: Dokumen tidak membahas termal bukaan, profil jendela, atau kondensasi.',
        applicable_domain: 'NON_FENESTRATION_THERMAL',
        confidence_basis: 'Absence of thermal envelope and condensation physics',
        rejection_or_escalation_reason: 'TOPIC_MISMATCH: No condensation or fenestration thermal concepts found',
        evaluated_at: now
      };
    }
  }

  // 5. Positive Interdisciplinary Materials Science & Thermal Physics Match
  const fullSearchCorpus = (params.title + ' ' + (params.publisher || '') + ' ' + url + ' ' + textSample.slice(0, 50000)).toLowerCase();
  const hasLegitPhysics = LEGITIMATE_PHYSICS_AND_MATERIALS_PATTERNS.some(p => p.test(fullSearchCorpus));
  if (hasLegitPhysics) {
    return {
      decision: 'SOURCE_ACCEPTED',
      article_topic: params.topic,
      research_question: rq,
      source_id: params.sourceId,
      canonical_url: url,
      document_title: params.title,
      evidence_excerpt: cleaned.cleaned_text.slice(0, 250),
      relevance_rationale: 'SOURCE_ACCEPTED: Dokumen memuat prinsip fisika sains bangunan atau sains material interdisipliner yang sah.',
      applicable_domain: topicDomain,
      confidence_basis: 'Verified materials science or building physics match',
      evaluated_at: now
    };
  }

  // 6. Generic Building Science Fallback
  const buildingCheck = classifyBuildingDomain(combinedMeta);
  if (buildingCheck.domain !== 'GENERAL_BUILDING' && buildingCheck.score >= 2) {
    return {
      decision: 'SOURCE_ACCEPTED',
      article_topic: params.topic,
      research_question: rq,
      source_id: params.sourceId,
      canonical_url: url,
      document_title: params.title,
      evidence_excerpt: cleaned.cleaned_text.slice(0, 250),
      relevance_rationale: `SOURCE_ACCEPTED: Tervalidasi pada ranah sains bangunan [${buildingCheck.domain}] dengan skor relevansi ${buildingCheck.score}.`,
      applicable_domain: buildingCheck.domain,
      confidence_basis: `Domain vocabulary score: ${buildingCheck.score}`,
      evaluated_at: now
    };
  }

  // 7. Edge Cases $\rightarrow$ SOURCE_REVIEW_REQUIRED
  return {
    decision: 'SOURCE_REVIEW_REQUIRED',
    article_topic: params.topic,
    research_question: rq,
    source_id: params.sourceId,
    canonical_url: url,
    document_title: params.title,
    evidence_excerpt: cleaned.cleaned_text.slice(0, 200),
    relevance_rationale: 'SOURCE_REVIEW_REQUIRED: Relevansi dokumen berada di ambang batas batas netral; memerlukan verifikasi editor ahli.',
    applicable_domain: 'UNCERTAIN_BUILDING_CONTEXT',
    confidence_basis: 'Marginal domain overlap without explicit negative match',
    rejection_or_escalation_reason: 'UNCERTAIN_RELEVANCE: Marginal domain signals require human editorial review',
    evaluated_at: now
  };
}

/**
 * Detects the editorial family locally if not supplied.
 */
function detectFamilyFromTopic(topic: string): 'PROBLEM_SOLVER' | 'MATERIAL_COMPARISON' | 'BUILDING_GUIDE' | 'INSPIRATION_DECOR' {
  const lower = topic.toLowerCase();
  if (lower.includes(' vs ') || lower.includes(' versus ') || lower.includes('perbandingan') || lower.includes('komparasi') || lower.includes('banding')) {
    return 'MATERIAL_COMPARISON';
  }
  if (lower.includes('mengapa') || lower.includes('penyebab') || lower.includes('bocor') || lower.includes('rembes') || lower.includes('retak') || lower.includes('popping') || lower.includes('meledak') || lower.includes('kondensasi') || lower.includes('solusi') || lower.includes('masalah') || lower.includes('thermal bridge')) {
    return 'PROBLEM_SOLVER';
  }
  if (lower.includes('menata') || lower.includes('dekorasi') || lower.includes('balkon') || lower.includes('japandi') || lower.includes('interior') || lower.includes('ruang minimalis') || lower.includes('inspirasi')) {
    return 'INSPIRATION_DECOR';
  }
  return 'BUILDING_GUIDE';
}

/**
 * Evaluates overall research readiness of a pack before authoring.
 * Enforces question coverage traceability across the article's essential questions.
 */
export function checkResearchReadiness(params: {
  topic: string;
  sourceDecisions: SourceQualityDecision[];
  acceptedDocuments: any[];
  claimInventory: any[];
  researchQuestions?: EditorialResearchQuestion[];
  editorialFamily?: string;
  passages?: any[];
}): ResearchReadinessEvaluation {
  const accepted = params.sourceDecisions.filter(d => d.decision === 'SOURCE_ACCEPTED');
  const rejected = params.sourceDecisions.filter(d => d.decision === 'SOURCE_REJECTED');
  const reviewRequired = params.sourceDecisions.filter(d => d.decision === 'SOURCE_REVIEW_REQUIRED');

  const acceptedIds = Array.from(new Set(accepted.map(d => d.source_id)));
  const rejectedIds = Array.from(new Set(rejected.map(d => d.source_id)));

  // Determine active editorial family
  const family = (params.editorialFamily as any) || detectFamilyFromTopic(params.topic);

  // Obtain active research questions
  let questions = params.researchQuestions;
  if (!questions || questions.length === 0) {
    questions = generateEditorialResearchQuestions(params.topic);
  }

  // Minimum threshold: at least 2 independent accepted sources (or 1 authoritative institutional source)
  const hasInstitutionalAuthority = accepted.some(d =>
    /\b(?:lbnl|doe|epa|bsn|ornl|nist|astm|iso)\b/i.test(d.canonical_url + ' ' + d.document_title)
  );

  const hasAdequateSources = acceptedIds.length >= 2 || (acceptedIds.length >= 1 && hasInstitutionalAuthority);
  const hasAdequateClaims = params.claimInventory.length >= 5;

  if (acceptedIds.length === 0) {
    return {
      readiness_status: 'RESEARCH_RETRY_REQUIRED',
      topic: params.topic,
      editorial_family: family,
      accepted_sources_count: 0,
      rejected_sources_count: rejectedIds.length,
      review_required_sources_count: reviewRequired.length,
      accepted_source_ids: [],
      rejected_source_ids: rejectedIds,
      covered_categories_count: 0,
      total_claims_count: params.claimInventory.length,
      is_authoring_eligible: false,
      block_reason: 'ZERO_ACCEPTED_SOURCES: Seluruh dokumen sumber yang ditemukan ditolak karena tidak relevan atau terkontaminasi.'
    };
  }

  // Define family-specific essential and secondary required categories
  const essentialCategories: string[] = [];
  const secondaryCategories: string[] = [];

  if (family === 'PROBLEM_SOLVER') {
    essentialCategories.push('PLAUSIBLE_CAUSES', 'INTERVENTION_MAPPING');
    secondaryCategories.push('DIFFERENTIAL_DIAGNOSIS', 'LIMITATIONS_AND_FALSE_FIXES', 'ESCALATION_CONDITIONS');
  } else if (family === 'MATERIAL_COMPARISON') {
    essentialCategories.push('DIFFERENTIAL_DIAGNOSIS', 'LIMITATIONS_AND_FALSE_FIXES');
    secondaryCategories.push('INTERVENTION_MAPPING', 'EMPIRICAL_RECOMMENDATION_SUPPORT');
  } else if (family === 'BUILDING_GUIDE') {
    essentialCategories.push('INTERVENTION_MAPPING', 'LIMITATIONS_AND_FALSE_FIXES');
    secondaryCategories.push('PLAUSIBLE_CAUSES', 'ESCALATION_CONDITIONS', 'EMPIRICAL_RECOMMENDATION_SUPPORT');
  } else {
    // INSPIRATION_DECOR
    essentialCategories.push('LIMITATIONS_AND_FALSE_FIXES');
    secondaryCategories.push('INTERVENTION_MAPPING', 'EMPIRICAL_RECOMMENDATION_SUPPORT');
  }

  // Build explicit traceability: research_question_id -> required evidence category -> accepted source ID -> supported claim IDs -> coverage decision
  const questionTraces: ResearchQuestionCoverageTrace[] = [];
  const coveredCategories = new Set<string>();

  for (const rq of questions) {
    const isEssential = essentialCategories.includes(rq.category);
    const rqCat = rq.category;

    // Find claims that:
    // 1. Have verified provenance from accepted sources
    // 2. Address this category
    const supportedClaimIds: string[] = [];
    const supportingAcceptedSources = new Set<string>();

    for (const c of params.claimInventory) {
      // Check provenance
      let hasAcceptedSource = false;
      if (Array.isArray(c.sources)) {
        for (const s of c.sources) {
          if (acceptedIds.includes(s.source_id)) {
            hasAcceptedSource = true;
            supportingAcceptedSources.add(s.source_id);
          }
        }
      }
      if (c.source_id && acceptedIds.includes(c.source_id)) {
        hasAcceptedSource = true;
        supportingAcceptedSources.add(c.source_id);
      }
      // If single-pack legacy claim without explicit source_id in claim object,
      // but acceptedDocuments exist and claim is in author_safe_claims/claim_inventory
      if (!hasAcceptedSource && (!c.sources || c.sources.length === 0) && !c.source_id && acceptedIds.length > 0) {
        if (Array.isArray(params.passages) && Array.isArray(c.evidence_passage_ids)) {
          for (const pid of c.evidence_passage_ids) {
            const passage = params.passages.find(p => p.passage_id === pid);
            if (passage && acceptedIds.includes(passage.source_id)) {
              hasAcceptedSource = true;
              supportingAcceptedSources.add(passage.source_id);
            }
          }
        }
      }

      if (!hasAcceptedSource) {
        continue; // Unverified or rejected source provenance cannot count
      }

      // Check category match
      const claimCat = c.semantic_role || c.research_question_category || (c as any).category || '';
      const claimRqId = (c as any).research_question_id || (c as any).question_id || '';
      const statement = String(c.statement || (c as any).fact || (c as any).claim_text || '').toLowerCase();

      let isCategoryMatch = (claimCat === rqCat) || (claimRqId === rq.question_id);

      // Semantic role to research question category mapping
      if (!isCategoryMatch && claimCat) {
        if (rqCat === 'PLAUSIBLE_CAUSES' && (claimCat === 'CAUSE_MECHANISM' || claimCat === 'MATERIAL_BEHAVIOR')) {
          isCategoryMatch = true;
        } else if (rqCat === 'DIFFERENTIAL_DIAGNOSIS' && (claimCat === 'DIAGNOSTIC_SIGNAL' || claimCat === 'MATERIAL_BEHAVIOR')) {
          isCategoryMatch = true;
        } else if (rqCat === 'INTERVENTION_MAPPING' && (claimCat === 'INTERVENTION_EFFECT' || claimCat === 'INSTALLATION_GUIDANCE')) {
          isCategoryMatch = true;
        } else if (rqCat === 'LIMITATIONS_AND_FALSE_FIXES' && (claimCat === 'LIMITATION' || claimCat === 'RISK')) {
          isCategoryMatch = true;
        } else if (rqCat === 'ESCALATION_CONDITIONS' && (claimCat === 'RISK' || claimCat === 'LIMITATION' || claimCat === 'SAFETY_REGULATORY' || claimCat === 'INSTALLATION_GUIDANCE')) {
          isCategoryMatch = true;
        } else if (rqCat === 'EMPIRICAL_RECOMMENDATION_SUPPORT' && (claimCat === 'REGULATORY_REFERENCE' || claimCat === 'MATERIAL_BEHAVIOR')) {
          isCategoryMatch = true;
        }
      }

      // Semantic concept fallback
      if (!isCategoryMatch) {
        if (rqCat === 'PLAUSIBLE_CAUSES' && /\b(?:penyebab|karena|mekanisme|konduksi|pemuaian|geser|beban|tekanan|titik embun|embun|kondensasi|suhu|kelembapan|kapiler|thermal bridge|difusi|panas|faktor)\b/i.test(statement)) {
          isCategoryMatch = true;
        } else if (rqCat === 'DIFFERENTIAL_DIAGNOSIS' && /\b(?:perbedaan|beda|vs|versus|dibanding|karakteristik|pola pecah|benturan|stc|akustik|kekuatan|keamanan)\b/i.test(statement)) {
          isCategoryMatch = true;
        } else if (rqCat === 'INTERVENTION_MAPPING' && /\b(?:solusi|perbaikan|mitigasi|pemasangan|pasang|ganti|sealant|thermal break|exhaust|ventilasi|nat|movement joint|spesi|lapisan|perekat)\b/i.test(statement)) {
          isCategoryMatch = true;
        } else if (rqCat === 'LIMITATIONS_AND_FALSE_FIXES' && /\b(?:batasan|tidak boleh|jangan|risiko|bukan|keterbatasan|garansi|kesalahan|cacat|kelemahan)\b/i.test(statement)) {
          isCategoryMatch = true;
        } else if (rqCat === 'ESCALATION_CONDITIONS' && /\b(?:eskalasi|ahli|teknisi|inspeksi|profesional|bahaya|keamanan|mcb|korslet|tegangan|arus bocor|ghost glow|flicker|bantuan)\b/i.test(statement)) {
          isCategoryMatch = true;
        } else if (rqCat === 'EMPIRICAL_RECOMMENDATION_SUPPORT' && /\b(?:standar|sni|astm|ashrae|pedoman|hvi|iso|pupr|spesifikasi|pengujian|konsensus)\b/i.test(statement)) {
          isCategoryMatch = true;
        }
      }

      if (isCategoryMatch) {
        supportedClaimIds.push(c.claim_id || (c as any).id);
      }
    }

    const isCovered = supportedClaimIds.length >= 1 && supportingAcceptedSources.size >= 1;
    if (isCovered) {
      coveredCategories.add(rqCat);
    }

    questionTraces.push({
      research_question_id: rq.question_id,
      category: rqCat,
      question_text: rq.question_text,
      accepted_source_ids: Array.from(supportingAcceptedSources),
      supported_claim_ids: supportedClaimIds,
      coverage_decision: isCovered ? 'COVERED' : 'UNCOVERED',
      is_essential: isEssential,
      notes: isCovered
        ? `Supported by ${supportedClaimIds.length} claim(s) from accepted source(s) [${Array.from(supportingAcceptedSources).join(', ')}]`
        : `Uncovered: No claims from accepted sources found for category ${rqCat}`
    });
  }

  // Determine uncovered essential questions
  const uncoveredEssential = questionTraces
    .filter(t => t.is_essential && t.coverage_decision === 'UNCOVERED')
    .map(t => `${t.research_question_id} (${t.category})`);

  // General source and claim count checks
  if (!hasAdequateSources || !hasAdequateClaims) {
    return {
      readiness_status: 'RESEARCH_RETRY_REQUIRED',
      topic: params.topic,
      editorial_family: family,
      accepted_sources_count: acceptedIds.length,
      rejected_sources_count: rejectedIds.length,
      review_required_sources_count: reviewRequired.length,
      accepted_source_ids: acceptedIds,
      rejected_source_ids: rejectedIds,
      covered_categories_count: coveredCategories.size,
      total_claims_count: params.claimInventory.length,
      is_authoring_eligible: false,
      block_reason: `INSUFFICIENT_EVIDENCE_COVERAGE: Ditemukan ${acceptedIds.length} sumber valid dan ${params.claimInventory.length} klaim, belum memenuhi batas minimum (>= 2 sumber, >= 5 klaim).`,
      question_traces: questionTraces,
      uncovered_essential_questions: uncoveredEssential
    };
  }

  // Fail-closed on uncovered essential questions
  if (uncoveredEssential.length > 0) {
    return {
      readiness_status: 'RESEARCH_RETRY_REQUIRED',
      topic: params.topic,
      editorial_family: family,
      accepted_sources_count: acceptedIds.length,
      rejected_sources_count: rejectedIds.length,
      review_required_sources_count: reviewRequired.length,
      accepted_source_ids: acceptedIds,
      rejected_source_ids: rejectedIds,
      covered_categories_count: coveredCategories.size,
      total_claims_count: params.claimInventory.length,
      is_authoring_eligible: false,
      block_reason: `INSUFFICIENT_QUESTION_COVERAGE: Research pack lacks verified evidence from accepted sources for essential ${family} question(s): ${uncoveredEssential.join(', ')}.`,
      question_traces: questionTraces,
      uncovered_essential_questions: uncoveredEssential
    };
  }

  // Check review-required uncertainty
  if (reviewRequired.length > acceptedIds.length) {
    return {
      readiness_status: 'REVIEW_REQUIRED',
      topic: params.topic,
      editorial_family: family,
      accepted_sources_count: acceptedIds.length,
      rejected_sources_count: rejectedIds.length,
      review_required_sources_count: reviewRequired.length,
      accepted_source_ids: acceptedIds,
      rejected_source_ids: rejectedIds,
      covered_categories_count: coveredCategories.size,
      total_claims_count: params.claimInventory.length,
      is_authoring_eligible: false,
      block_reason: `HIGH_UNCERTAINTY: Jumlah sumber berstatus REVIEW_REQUIRED (${reviewRequired.length}) melebihi sumber terverifikasi (${acceptedIds.length}).`,
      question_traces: questionTraces,
      uncovered_essential_questions: []
    };
  }

  return {
    readiness_status: 'READY_FOR_AUTHORING',
    topic: params.topic,
    editorial_family: family,
    accepted_sources_count: acceptedIds.length,
    rejected_sources_count: rejectedIds.length,
    review_required_sources_count: reviewRequired.length,
    accepted_source_ids: acceptedIds,
    rejected_source_ids: rejectedIds,
    covered_categories_count: coveredCategories.size,
    total_claims_count: params.claimInventory.length,
    is_authoring_eligible: true,
    question_traces: questionTraces,
    uncovered_essential_questions: []
  };
}
