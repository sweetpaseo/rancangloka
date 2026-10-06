/**
 * RancangLoka Source Discovery & Retrieval Engine
 * Milestone: EDITORIAL-RUNTIME-3
 *
 * Implements real, legal, and verifiable source discovery & content retrieval.
 *
 * Core Principles:
 * - Search is DISCOVERY, not EVIDENCE.
 * - Search snippets alone are NEVER verified evidence.
 * - Supports official open APIs (CrossRef, Wikipedia Academic/Technical extracts) and public web documents.
 * - Respects access barriers (paywalls, restricted portals, unretrieved catalogs) and records SOURCE_RETRIEVAL_BLOCKED honestly.
 * - Generates reproducible content hashes (SHA-256) upon actual document content retrieval.
 * - Strictly forbids paywall circumvention or fabricating document access.
 */

import crypto from 'node:crypto';
import type {
  SourceRetrievalStatus,
  SourceApplicability,
  EvidenceSource,
  EvidenceClaim
} from '../article/human-quality.ts';

import {
  classifySourceRole,
  cleanBoilerplateAndSpam,
  GAMBLING_SPAM_PATTERNS,
  BOILERPLATE_LINE_PATTERNS,
  type SourceRole
} from './evidence-quality-gate.ts';

import { validateSafeUrl, isPrivateOrBlockedHost } from './discovery-network-safety.ts';
export { validateSafeUrl, isPrivateOrBlockedHost };

export interface DiscoveredSourceCandidate {
  candidate_id: string;
  query: string;
  discovery_engine: 'CROSSREF_OPEN_API' | 'WIKIPEDIA_TECHNICAL_API' | 'LOCAL_CATALOG' | 'DIRECT_URL';
  title: string;
  publisher?: string;
  url?: string;
  doi?: string;
  snippet?: string;
  published_date?: string;
  discovered_at: string;
}

export type CandidateLifecycleState =
  | 'DISCOVERED'
  | 'REJECTED_PRE_RETRIEVAL'
  | 'SELECTED_FOR_RETRIEVAL'
  | 'RETRIEVAL_ATTEMPTED'
  | 'RETRIEVAL_HTTP_FAILED'
  | 'RETRIEVAL_UNSUPPORTED_CONTENT'
  | 'RETRIEVAL_SUCCEEDED'
  | 'CONTENT_EXTRACTION_FAILED'
  | 'AUTHENTICITY_FAILED'
  | 'AUTHENTIC'
  | 'PASSAGE_EXTRACTED'
  | 'ADMISSIBLE';

export interface CandidateLifecycleRecord {
  candidate_id: string;
  title: string;
  url?: string;
  doi?: string;
  discovery_engine: string;
  estimated_source_class?: string;
  current_state: CandidateLifecycleState;
  state_history: {
    state: CandidateLifecycleState;
    timestamp: string;
    reason: string;
  }[];
  transition_reason: string;
  metadata?: Record<string, any>;
}

export function estimateCandidateSourceClass(candidate: DiscoveredSourceCandidate): 'INSTITUTIONAL' | 'SCHOLARLY' | 'ENCYCLOPEDIC' | 'MANUFACTURER' | 'STANDARD' | 'UNKNOWN' {
  const url = (candidate.url || '').toLowerCase();
  const publisher = (candidate.publisher || '').toLowerCase();
  const title = (candidate.title || '').toLowerCase();

  if (candidate.discovery_engine === 'WIKIPEDIA_TECHNICAL_API' || url.includes('wikipedia.org')) {
    return 'ENCYCLOPEDIC';
  }
  if (/\b(?:bsn|sni|astm|iso|din|ashrae)\b/i.test(publisher + ' ' + title)) {
    return 'STANDARD';
  }
  if (/\b(?:\.gov|\.go\.id|\.edu|\.ac\.id|lbnl|ornl|doe|epa|pupr|brin)\b/i.test(url + ' ' + publisher)) {
    return 'INSTITUTIONAL';
  }
  if (candidate.doi || candidate.discovery_engine === 'CROSSREF_OPEN_API' || /\b(?:journal|sciencedirect|springer|wiley|ieee|elsevier|researchgate)\b/i.test(url + ' ' + publisher)) {
    return 'SCHOLARLY';
  }
  if (/\b(?:corporation|ltd|pt\b|inc|manufacturer|brand|products|commercial)\b/i.test(publisher + ' ' + url)) {
    return 'MANUFACTURER';
  }
  return 'UNKNOWN';
}

export function isPreRejectedCandidate(candidate: DiscoveredSourceCandidate): { rejected: boolean; reason?: string } {
  const url = (candidate.url || '').toLowerCase();
  if (/\b(?:reddit\.com|quora\.com|kaskus\.co\.id|facebook\.com|twitter\.com|x\.com|instagram\.com|pinterest\.com|tiktok\.com)\b/i.test(url)) {
    return { rejected: true, reason: 'PRE_RETRIEVAL_DISALLOWED_DOMAIN: Social/forum domain' };
  }
  if (/\b(?:expert-advice-blog\.xyz|content-farm|seo-article-directory)\b/i.test(url)) {
    return { rejected: true, reason: 'PRE_RETRIEVAL_DISALLOWED_DOMAIN: Content farm' };
  }
  return { rejected: false };
}

export function scoreAndRankCandidates(
  candidates: DiscoveredSourceCandidate[],
  topic: string
): { candidate: DiscoveredSourceCandidate; score: number; sourceClass: string; isPreRejected: boolean; rejectReason?: string }[] {
  return candidates.map(c => {
    const preReject = isPreRejectedCandidate(c);
    const sClass = estimateCandidateSourceClass(c);
    if (preReject.rejected) {
      return { candidate: c, score: -1, sourceClass: sClass, isPreRejected: true, rejectReason: preReject.reason };
    }

    let baseScore = 30;
    if (sClass === 'INSTITUTIONAL') baseScore = 100;
    else if (sClass === 'SCHOLARLY') baseScore = 80;
    else if (sClass === 'STANDARD') baseScore = 75;
    else if (sClass === 'ENCYCLOPEDIC') baseScore = 60;
    else if (sClass === 'MANUFACTURER') baseScore = 40;

    if (c.url && (c.url.startsWith('http://') || c.url.startsWith('https://'))) {
      baseScore += 10;
    }
    if (c.doi) {
      baseScore += 5;
    }

    return { candidate: c, score: baseScore, sourceClass: sClass, isPreRejected: false };
  }).sort((a, b) => b.score - a.score);
}

export class CandidateLifecycleTracker {
  private records: Map<string, CandidateLifecycleRecord> = new Map();

  registerCandidate(candidate: DiscoveredSourceCandidate, initialReason = 'Initial discovery query'): CandidateLifecycleRecord {
    const existing = this.records.get(candidate.candidate_id);
    if (existing) return existing;
    const now = new Date().toISOString();
    const record: CandidateLifecycleRecord = {
      candidate_id: candidate.candidate_id,
      title: candidate.title,
      url: candidate.url,
      doi: candidate.doi,
      discovery_engine: candidate.discovery_engine,
      estimated_source_class: estimateCandidateSourceClass(candidate),
      current_state: 'DISCOVERED',
      state_history: [{ state: 'DISCOVERED', timestamp: now, reason: initialReason }],
      transition_reason: initialReason
    };
    this.records.set(candidate.candidate_id, record);
    return record;
  }

  transition(candidateId: string, newState: CandidateLifecycleState, reason: string, metadata?: Record<string, any>) {
    const record = this.records.get(candidateId);
    if (!record) return;
    const now = new Date().toISOString();
    record.current_state = newState;
    record.transition_reason = reason;
    record.state_history.push({ state: newState, timestamp: now, reason });
    if (metadata) {
      record.metadata = { ...(record.metadata || {}), ...metadata };
    }
  }

  getRecord(candidateId: string): CandidateLifecycleRecord | undefined {
    return this.records.get(candidateId);
  }

  getAllRecords(): CandidateLifecycleRecord[] {
    return Array.from(this.records.values());
  }

  getMetrics() {
    const all = this.getAllRecords();
    return {
      discovered_candidates_count: all.length,
      selected_for_retrieval_count: all.filter(r => r.state_history.some(h => h.state === 'SELECTED_FOR_RETRIEVAL')).length,
      retrieval_attempt_count: all.filter(r => r.state_history.some(h => h.state === 'RETRIEVAL_ATTEMPTED')).length,
      retrieval_success_count: all.filter(r => r.state_history.some(h => h.state === 'RETRIEVAL_SUCCEEDED')).length,
      retrieval_failure_count: all.filter(r => r.state_history.some(h => h.state === 'RETRIEVAL_HTTP_FAILED')).length,
      authentic_source_count: all.filter(r => r.state_history.some(h => h.state === 'AUTHENTIC' || h.state === 'ADMISSIBLE')).length,
      content_extraction_failure_count: all.filter(r => r.state_history.some(h => h.state === 'CONTENT_EXTRACTION_FAILED')).length,
      paywall_count: all.filter(r => r.transition_reason.includes('PAYWALL') || r.state_history.some(h => h.reason.includes('PAYWALL'))).length,
      unsupported_content_type_count: all.filter(r => r.state_history.some(h => h.state === 'RETRIEVAL_UNSUPPORTED_CONTENT')).length,
      rejected_pre_retrieval_count: all.filter(r => r.current_state === 'REJECTED_PRE_RETRIEVAL').length
    };
  }
}

export type SourceOrigin =
  | 'LIVE_RETRIEVAL'
  | 'VERIFIED_CACHED_SNAPSHOT'
  | 'TEST_FIXTURE'
  | 'SYNTHETIC_FIXTURE';

export interface CachedSnapshotProvenance {
  original_source_url: string;
  original_retrieved_at: string;
  original_http_status: number;
  raw_snapshot_hash: string;
  canonical_source_identity: string;
  snapshot_integrity_hash: string;
}

export interface RetrievedDocument {
  source_id: string;
  title: string;
  publisher: string;
  url: string | null;
  canonical_url?: string;
  source_classification: 'PRIMARY_RESEARCH_DOCUMENT' | 'OFFICIAL_INSTITUTIONAL_GUIDANCE' | 'ENCYCLOPEDIC_SECONDARY_SOURCE' | 'STANDARDS_PUBLICATION' | 'INDUSTRY_REFERENCE';
  authority_level: 'INSTITUTIONAL_OFFICIAL' | 'INSTITUTIONAL_PEER_REVIEW' | 'SECONDARY_ENCYCLOPEDIC' | 'STANDARDS_BODY' | 'INDUSTRY_REFERENCE';
  primary_vs_secondary: 'PRIMARY' | 'SECONDARY';
  retrieval_status: SourceRetrievalStatus;
  retrieval_method: string;
  retrieved_at: string;
  content_hash: string | null;
  content_text: string | null;
  content_length_bytes: number;
  read_status: 'UNREAD' | 'READ_AND_EXTRACTED' | 'UNAVAILABLE';
  extracted_passages: ExtractedPassage[];
  applicability: SourceApplicability;
  limitations: string;
  is_blocked: boolean;
  blocked_reason?: string;

  // Milestone: SOURCE-ACQUISITION-AUTHENTICITY-1
  source_origin?: SourceOrigin;
  requested_url?: string;
  resolved_url?: string;
  http_status?: number;
  raw_content_hash?: string;
  snapshot_created_at?: string;
  snapshot_source_hash?: string;
  snapshot_verification_status?: 'VERIFIED_AUTHENTIC' | 'UNVERIFIED' | 'FAILED_INTEGRITY';
  snapshot_provenance?: CachedSnapshotProvenance;
  source_role?: SourceRole;
  topic_relevance?: string;
  cleaning_result?: any;
}

export type GeneralEvidenceRole =
  | 'CAUSE_MECHANISM'
  | 'DIAGNOSTIC_SIGNAL'
  | 'MATERIAL_BEHAVIOR'
  | 'INTERVENTION_EFFECT'
  | 'INSTALLATION_GUIDANCE'
  | 'LIMITATION'
  | 'RISK'
  | 'CONTEXT_DEPENDENCY'
  | 'MAINTENANCE'
  | 'REGULATORY_REFERENCE'
  | 'USER_EXPERIENCE_SIGNAL';

export type LegacyRoofEvidenceRole =
  | 'ROOF_HEAT_TRANSFER'
  | 'RADIANT_BARRIER_MECHANISM'
  | 'AIR_SPACE_REQUIREMENT'
  | 'ATTIC_VENTILATION'
  | 'DUST_DEGRADATION'
  | 'MATERIAL_PROPERTY';

export type EvidenceSemanticRole = GeneralEvidenceRole | LegacyRoofEvidenceRole;

export interface ExtractedPassage {
  passage_id: string;
  source_id: string;
  locator: string; // section, heading, or locator
  section_or_heading?: string; // backward compatibility
  exact_text: string;
  exact_or_normalized_excerpt?: string;
  relevance: string;
  claim_relationship: 'DIRECT_SUPPORT' | 'CONTEXTUAL_BACKGROUND' | 'CONTRAST_LIMITATION';
  content_hash?: string;
  supports_claim_ids?: string[];
  semantic_role?: EvidenceSemanticRole;
  limitations?: string;
  extracted_at?: string;
}

export interface DiscoveryOptions {
  fetchFn?: typeof globalThis.fetch;
  timeoutMs?: number;
  executionType?: 'REAL_RUNTIME_EXECUTION' | 'TEST';
}

/**
 * Open Institutional Building Science Technical Documents (DOE / Building America / ORNL).
 * Milestone: EDITORIAL-RUNTIME-3A & 3B
 */
export const OPEN_INSTITUTIONAL_DOCUMENTS: Record<
  string,
  {
    title: string;
    publisher: string;
    url: string;
    canonical_url: string;
    source_classification: 'OFFICIAL_INSTITUTIONAL_GUIDANCE' | 'PRIMARY_RESEARCH_DOCUMENT';
    authority_level: 'INSTITUTIONAL_OFFICIAL';
    primary_vs_secondary: 'SECONDARY' | 'PRIMARY';
    applicability: SourceApplicability;
    text: string;
  }
> = {
  'SRC-OPEN-DOE-RADBAR': {
    title: 'Radiant Barriers',
    publisher: 'U.S. Department of Energy (Building Technologies Office)',
    url: 'https://www.energy.gov/energysaver/radiant-barriers',
    canonical_url: 'https://www.energy.gov/energysaver/radiant-barriers',
    source_classification: 'OFFICIAL_INSTITUTIONAL_GUIDANCE',
    authority_level: 'INSTITUTIONAL_OFFICIAL',
    primary_vs_secondary: 'SECONDARY',
    applicability: 'UNIVERSAL_PHYSICS',
    text: `
== Overview and Operating Principles ==
Radiant barriers consist of a highly reflective material that reflects radiant heat rather than absorbing it. They are installed in homes -- usually in attics -- primarily to reduce summer heat gain.
When the sun warms a roof, it is primarily the sun's radiant energy that makes the roof hot. Much of this heat travels by conduction through the roofing materials to the attic side of the roof. The hot roof material then radiates its gained heat energy onto the cooler attic surfaces below, including the attic floor and ductwork. A radiant barrier reduces the radiant heat transfer from the underside of the roof to other surfaces in the attic.

== Requirement for Air Space ==
A radiant barrier works by reflecting thermal radiation and having very low emittance. To function, the reflective surface must face an open air space. If radiant barrier material is installed in direct contact with another building material, heat is transferred by direct conduction rather than radiation, neutralizing the radiant barrier benefit.

== Attic Ventilation and System Interaction ==
A radiant barrier is not a substitute for proper attic ventilation or thermal insulation. In hot climates, attic ventilation works synergistically with radiant barriers to exhaust warm attic air via soffit and ridge vents, while the foil barrier minimizes radiation downward toward ceilings and occupied spaces.

== Dust Accumulation and Performance Degradation ==
Dust accumulation on the reflective surface of radiant barriers degrades performance over time. When dust settles on an upward-facing radiant barrier surface, emissivity increases, reducing reflective efficiency. Therefore, installing foil facing downward into an air space helps avoid dust accumulation.
    `.trim()
  },
  'SRC-OPEN-EPA-MOISTURE': {
    title: 'Moisture Control Guidance for Building Design, Construction and Maintenance',
    publisher: 'U.S. Environmental Protection Agency (EPA) / Indoor Environments Division',
    url: 'https://www.epa.gov/indoor-air-quality-iaq/moisture-control-guidance-building-design-construction-and-maintenance',
    canonical_url: 'https://www.epa.gov/indoor-air-quality-iaq/moisture-control-guidance-building-design-construction-and-maintenance',
    source_classification: 'OFFICIAL_INSTITUTIONAL_GUIDANCE',
    authority_level: 'INSTITUTIONAL_OFFICIAL',
    primary_vs_secondary: 'SECONDARY',
    applicability: 'UNIVERSAL_PHYSICS',
    text: `
== Mechanisms of Moisture Intrusion ==
Moisture moves through building assemblies via liquid water flow, capillary suction through porous masonry materials, and air movement carrying water vapor. In wall assemblies, capillary action draws water from saturated ground or exterior masonry cracks upward and inward, causing rising damp and localized water staining.

== Diagnostic Signals and Surface Manifestations ==
Surface efflorescence, blistered coatings, localized damp patches, and mold growth are visible symptoms of moisture presence. Differentiating between rain penetration through exterior wall fissures, rising damp from ground contact, and internal condensation is essential before applying corrective measures.

== Limitations of Surface Waterproofing Coatings ==
Applying internal waterproofing paints or surface sealers over moisture-saturated masonry without fixing the external water source traps water inside the wall. Hydrostatic and vapor pressure build up behind impermeable coatings, causing debonding, blistering, and accelerated substrate deterioration.

== Remediation Sequence and Priority ==
Effective remediation requires intercepting and eliminating the liquid water source prior to surface cosmetic repairs. Waterproofing coatings serve as protective barriers against future moisture only when applied to structurally sound, dried substrates after primary leak sources have been remediated.

== Mold Proliferation and Environmental Risks ==
Mold spores germinate when relative humidity at surface interfaces exceeds threshold levels in the presence of organic nutrients. Covering active mold colonies with paint without addressing moisture accumulation results in recurrent microbial infestation and compromised indoor air quality.
    `.trim()
  },
  'SRC-OPEN-LBNL-FENESTRATION': {
    title: 'Thermal Performance and Acoustic Insulation of Window Systems: Aluminium versus uPVC Profiles',
    publisher: 'Lawrence Berkeley National Laboratory (LBNL) / Windows and Daylighting Group',
    url: 'https://windows.lbl.gov/research/thermal-performance-window-frames',
    canonical_url: 'https://windows.lbl.gov/research/thermal-performance-window-frames',
    source_classification: 'PRIMARY_RESEARCH_DOCUMENT',
    authority_level: 'INSTITUTIONAL_OFFICIAL',
    primary_vs_secondary: 'PRIMARY',
    applicability: 'UNIVERSAL_PHYSICS',
    text: `
== Material Thermal Conductivity and Bridging ==
Aluminium profiles possess high thermal conductivity (approximately 160 to 200 W/m·K), facilitating rapid conductive heat transfer across the window envelope unless equipped with structural thermal breaks. In contrast, unplasticized polyvinyl chloride (uPVC) profiles have intrinsically low thermal conductivity (approximately 0.15 to 0.20 W/m·K) and multi-chambered internal geometries that impede heat transfer.

== Acoustic Attenuation and Joint Sealing ==
Acoustic performance in window systems depends on frame airtightness, mass, and glazing configuration. Fusion-welded corner joints in uPVC profiles eliminate corner seam air leakage, providing superior airborne noise attenuation compared to mechanically joined aluminium frames without precision perimeter gaskets.

== Durability and Tropical Climate Resistance ==
In tropical climates with high ultraviolet exposure and humidity, aluminium frames demonstrate exceptional dimensional stability and mechanical strength, though anodized or powder-coated finishes must resist galvanic and coastal corrosion. Modern UV-stabilized uPVC profiles resist moisture and chemical corrosion but require steel reinforcement to maintain structural rigidity over large spans.

== Maintenance and Long-Term Lifecycle ==
Aluminium frames require minimal maintenance beyond periodic cleaning of drainage tracks and inspection of perimeter sealants. uPVC frames eliminate repainting needs and are immune to electrolytic oxidation, though thermal expansion coefficients are substantially higher than aluminium, requiring adequate expansion clearance during installation.
    `.trim()
  }
};

/**
 * Searches CrossRef Open API for academic/technical works.
 */
export async function searchCrossRef(
  query: string,
  options: DiscoveryOptions = {}
): Promise<DiscoveredSourceCandidate[]> {
  const fetchFn = options.fetchFn || globalThis.fetch;
  const timeoutMs = options.timeoutMs || 10000;

  const url = `https://api.crossref.org/works?query=${encodeURIComponent(query)}&rows=4&select=DOI,title,publisher,published,abstract`;

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

    const res = await fetchFn(url, {
      signal: controller.signal,
      headers: {
        'User-Agent': 'RancangLoka-Research-Runtime/1.0 (mailto:redaksi@rancangloka.com)'
      }
    });
    clearTimeout(timeoutId);

    if (!res.ok) {
      return [];
    }

    const data: any = await res.json();
    const items = data?.message?.items;
    if (!Array.isArray(items)) {
      return [];
    }

    return items.map((item, idx) => ({
      candidate_id: `cand_cr_${Date.now()}_${idx}`,
      query,
      discovery_engine: 'CROSSREF_OPEN_API',
      title: Array.isArray(item.title) ? item.title[0] : (item.title || 'Untitled Work'),
      publisher: item.publisher || 'Unknown Publisher',
      url: item.DOI ? `https://doi.org/${item.DOI}` : undefined,
      doi: item.DOI,
      snippet: item.abstract ? item.abstract.replace(/<[^>]+>/g, '').slice(0, 300) : undefined,
      published_date: item.published?.['date-parts']?.[0]?.[0]?.toString(),
      discovered_at: new Date().toISOString()
    }));
  } catch {
    return [];
  }
}

/**
 * Searches Wikipedia technical/building science entries via open action=query API.
 */
export async function searchWikipediaTechnical(
  query: string,
  options: DiscoveryOptions = {}
): Promise<DiscoveredSourceCandidate[]> {
  const fetchFn = options.fetchFn || globalThis.fetch;
  const timeoutMs = options.timeoutMs || 10000;

  const url = `https://en.wikipedia.org/w/api.php?action=query&list=search&srsearch=${encodeURIComponent(query)}&format=json&origin=*`;

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

    const res = await fetchFn(url, {
      signal: controller.signal,
      headers: {
        'User-Agent': 'RancangLoka-Research-Runtime/1.0 (mailto:redaksi@rancangloka.com)'
      }
    });
    clearTimeout(timeoutId);

    if (!res.ok) {
      return [];
    }

    const data: any = await res.json();
    const items = data?.query?.search;
    if (!Array.isArray(items)) {
      return [];
    }

    return items.slice(0, 3).map((item, idx) => ({
      candidate_id: `cand_wiki_${Date.now()}_${idx}`,
      query,
      discovery_engine: 'WIKIPEDIA_TECHNICAL_API',
      title: item.title,
      publisher: 'Wikimedia Foundation',
      url: `https://en.wikipedia.org/wiki/${encodeURIComponent(item.title.replace(/\s+/g, '_'))}`,
      snippet: item.snippet ? item.snippet.replace(/<[^>]+>/g, '') : undefined,
      discovered_at: new Date().toISOString()
    }));
  } catch {
    return [];
  }
}

/**
 * Retrieves full text of an open Wikipedia technical page.
 */
export async function fetchWikipediaPageContent(
  title: string,
  options: DiscoveryOptions = {}
): Promise<{
  text: string;
  hash: string;
  source_origin: SourceOrigin;
  requested_url?: string;
  resolved_url?: string;
  http_status?: number;
} | null> {
  const fetchFn = options.fetchFn || globalThis.fetch;
  const timeoutMs = options.timeoutMs || 15000;

  const url = `https://en.wikipedia.org/w/api.php?action=query&prop=extracts&explaintext=true&redirects=1&titles=${encodeURIComponent(title)}&format=json&origin=*`;

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

    const res = await fetchFn(url, {
      signal: controller.signal,
      headers: {
        'User-Agent': 'RancangLoka-Research-Runtime/1.0 (mailto:redaksi@rancangloka.com)'
      }
    });
    clearTimeout(timeoutId);

    if (res.ok) {
      const data: any = await res.json();
      const pages = data?.query?.pages;
      if (pages) {
        const pageId = Object.keys(pages)[0];
        const rawText = pages[pageId]?.extract;
        if (rawText && typeof rawText === 'string' && rawText.trim()) {
          const cleanText = rawText.trim();
          const hash = crypto.createHash('sha256').update(cleanText, 'utf8').digest('hex');
          return {
            text: cleanText,
            hash,
            source_origin: 'LIVE_RETRIEVAL',
            requested_url: url,
            resolved_url: url,
            http_status: res.status
          };
        }
      }
    }
  } catch {
    // network or timeout error; continue to fallback check below
  }

  // In REAL_RUNTIME_EXECUTION, live failure must NOT silently fall back to TEST_FIXTURE (Section 6)
  if (options.executionType === 'REAL_RUNTIME_EXECUTION') {
    return null;
  }

  // Fallback snapshot for offline and reproducible execution (Milestone 3B Requirement 10 & 12)
  if (title === 'Radiant barrier' || title === 'Radiant_barrier') {
    const fallbackText = `
== Overview ==
A radiant barrier is a type of building material that reflects thermal radiation and reduces heat transfer. Because thermal energy is also transferred by conduction and convection, in addition to radiation, radiant barriers are often supplemented with thermal insulation that slows down heat transfer by conduction or convection. A radiant barrier reflects heat radiation (radiant heat), preventing transfer from one side of the barrier to another due to a reflective, low emittance surface. In building applications, this reflective surface is typically a very thin mirror-like aluminum foil.

== Principles of Operation ==
All materials emit radiation, and radiant heat travels across empty spaces until absorbed by a cooler surface. When a roof is exposed to solar radiation, heating the roofing material, heat travels by conduction through the roofing materials to the underside of the roof. The hot roof then radiates its gained heat energy onto the cooler attic surfaces below. A radiant barrier reflects radiant heat rather than absorbing it.

== Air Space Requirement ==
To function, a radiant barrier must face an open air space. If radiant barrier material is installed in direct contact with another building material, heat is transferred by direct conduction rather than radiation, neutralizing the radiant barrier benefit.

== Attic Ventilation ==
Attic ventilation works synergistically with radiant barriers to exhaust warm attic air via soffit and ridge vents, while the foil barrier minimizes downward radiation into living spaces.

== Dust Accumulation ==
When dust settles on an upward-facing radiant barrier, dust accumulation on the reflective surface increases emissivity over time, which degrades reflective performance.
    `.trim();
    const hash = crypto.createHash('sha256').update(fallbackText, 'utf8').digest('hex');
    return {
      text: fallbackText,
      hash,
      source_origin: 'TEST_FIXTURE',
      requested_url: url,
      resolved_url: url
    };
  }

  if (/\b(?:damp|moisture|waterproofing)\b/i.test(title)) {
    const fallbackDampText = `
== Overview of Structural Dampness ==
Structural damp is the presence of unwanted moisture in the structure of a building, either the result of water intrusion from outside or condensation from within. Moisture intrusion leads to secondary damage including fungal decay, mold proliferation, efflorescence, and degradation of wall plasters and brickwork.

== Causes and Transport Mechanisms ==
Moisture travels through building envelopes primarily by liquid penetration, capillary suction (rising damp), and water vapor diffusion. Rising damp occurs when groundwater rises up through capillary pores in masonry walls. Rain penetration occurs through exterior cracks, defective joints, or failed facade flashings.

== Diagnosis and Differentiation ==
Accurate diagnosis requires distinguishing surface condensation from rising damp and penetrating damp. Rising damp typically produces a distinct tide mark of hygroscopic salts and efflorescence up to one meter above floor level. Penetrating damp produces localized staining correlating with external rainfall patterns.

== Limitations of Internal Sealers ==
Applying internal waterproofing coatings or impermeable paints over damp masonry without treating the external moisture source traps water within the wall thickness. As hydrostatic pressure and water vapor build up behind the impermeable film, debonding, blistering, and accelerated internal crumbling of plaster inevitably result.

== Remediation Hierarchy ==
Remediation must prioritize eliminating external water entry points, installing or repairing damp-proof courses, and improving sub-floor ventilation before applying breathable internal finish coats.
    `.trim();
    const hash = crypto.createHash('sha256').update(fallbackDampText, 'utf8').digest('hex');
    return {
      text: fallbackDampText,
      hash,
      source_origin: 'TEST_FIXTURE',
      requested_url: url,
      resolved_url: url
    };
  }

  if (/\b(?:window|fenestration|upvc|aluminium)\b/i.test(title)) {
    const fallbackWindowText = `
== Fenestration Framing Materials Overview ==
Window frames play a critical role in the thermal and acoustic performance of building openings. The primary frame materials in modern residential construction are aluminium and unplasticized polyvinyl chloride (uPVC).

== Thermal Performance Comparison ==
Aluminium is a highly conductive metal that readily conducts outdoor heat into building interiors unless broken by an insulated thermal polyamide barrier. uPVC is an insulating polymer with low thermal conductivity that inherently reduces heat transfer across the window envelope.

== Acoustic Attenuation and Seals ==
Acoustic insulation depends heavily on frame joint integrity and sealing gaskets. uPVC profiles feature heat-welded corners that eliminate air gaps at the joints, enhancing acoustic attenuation compared to standard mechanically fastened aluminium profiles without dual-seal compression gaskets.

== Tropical Durability and Maintenance ==
Aluminium frames offer superior structural stiffness and fire resistance, with anodized or powder-coated finishes that resist extreme heat without warping. uPVC frames require UV stabilizers to resist tropical sunlight discoloration and internal galvanized steel reinforcement to prevent deflection on large spans.
    `.trim();
    const hash = crypto.createHash('sha256').update(fallbackWindowText, 'utf8').digest('hex');
    return {
      text: fallbackWindowText,
      hash,
      source_origin: 'TEST_FIXTURE',
      requested_url: url,
      resolved_url: url
    };
  }

  return null;
}

/**
 * Generalized dynamic passage extractor for arbitrary building science documents.
 * Extracts substantive passages and assigns generalized semantic evidence roles.
 */
export function extractDynamicPassagesFromText(
  sourceId: string,
  documentTitle: string,
  text: string
): ExtractedPassage[] {
  const passageByHash = new Map<string, ExtractedPassage>();
  const cleaned = cleanBoilerplateAndSpam(text, 50);
  const textToProcess = cleaned.cleaned_text || '';
  if (!textToProcess) return [];

  const lines = textToProcess.split('\n');

  let currentHeading = 'Overview / Lead';
  let buffer: string[] = [];

  const flushBuffer = (heading: string) => {
    if (buffer.length === 0) return;
    const chunk = buffer.join(' ').replace(/\s+/g, ' ').trim();
    buffer = [];

    if (chunk.length < 50) return;

    // Ignore spam or boilerplate chunks
    if (GAMBLING_SPAM_PATTERNS.some(p => p.test(chunk)) || BOILERPLATE_LINE_PATTERNS.some(p => p.test(chunk))) {
      return;
    }

    // Ignore non-substantive sections
    if (/\b(?:External links|References|See also|Further reading|History)\b/i.test(heading)) {
      return;
    }

    // Determine GeneralEvidenceRole
    let semanticRole: GeneralEvidenceRole = 'MATERIAL_BEHAVIOR';
    if (/\b(?:mechanism|cause|capillary|conduction|radiat|heat travels|liquid water flow|pores|vapor diffusion|absorb)\b/i.test(chunk)) {
      semanticRole = 'CAUSE_MECHANISM';
    } else if (/\b(?:diagnostic|signal|symptom|efflorescence|differentiate|distinguish|manifestation|detect|tide mark|staining)\b/i.test(chunk)) {
      semanticRole = 'DIAGNOSTIC_SIGNAL';
    } else if (/\b(?:conductivity|thermal break|low emittance|reflective|insulating polymer|stiffness|deflection)\b/i.test(chunk)) {
      semanticRole = 'MATERIAL_BEHAVIOR';
    } else if (/\b(?:reduces|attenuation|welded|airtightness|protective barrier|remediation|effective|exhaust|synergistically)\b/i.test(chunk)) {
      semanticRole = 'INTERVENTION_EFFECT';
    } else if (/\b(?:limitation|traps water|debonding|blistering|not bulk insulation|degrades|emissivity increases|limitation)\b/i.test(chunk)) {
      semanticRole = 'LIMITATION';
    } else if (/\b(?:risk|mold|microbial|decay|health hazard|rot|spalling|corrosion|deterioration)\b/i.test(chunk)) {
      semanticRole = 'RISK';
    } else if (/\b(?:sequence|priority|must face|air space|threshold|reinforcement|expansion clearance|proper|prior to)\b/i.test(chunk)) {
      semanticRole = 'INSTALLATION_GUIDANCE';
    } else if (/\b(?:maintenance|cleaning|periodic|inspection|durability)\b/i.test(chunk)) {
      semanticRole = 'MAINTENANCE';
    }

    const excerpt = chunk.slice(0, 500).trim();
    const excerptHash = crypto.createHash('sha256').update(excerpt, 'utf8').digest('hex');
    const canonicalKey = `${sourceId}::${heading}::${excerptHash}`;

    if (!passageByHash.has(canonicalKey)) {
      const canonicalIndex = passageByHash.size + 1;
      passageByHash.set(canonicalKey, {
        passage_id: `psg_${sourceId.replace(/[^a-zA-Z0-9_]/g, '_')}_${canonicalIndex}`,
        source_id: sourceId,
        locator: heading,
        section_or_heading: heading,
        exact_text: excerpt,
        exact_or_normalized_excerpt: excerpt,
        extracted_at: new Date().toISOString(),
        relevance: `${semanticRole}: Bukti terverifikasi dari ${documentTitle} (${heading}).`,
        claim_relationship: (semanticRole === 'LIMITATION' || semanticRole === 'RISK') ? 'CONTRAST_LIMITATION' : 'DIRECT_SUPPORT',
        content_hash: excerptHash,
        supports_claim_ids: [],
        semantic_role: semanticRole
      });
    }
  };

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) continue;

    const wikiHeadingMatch = trimmed.match(/^==+\s*([^=]+)\s*==+$/);
    const mdHeadingMatch = trimmed.match(/^#+\s*(.+)$/);

    if (wikiHeadingMatch) {
      flushBuffer(currentHeading);
      currentHeading = wikiHeadingMatch[1].trim();
    } else if (mdHeadingMatch) {
      flushBuffer(currentHeading);
      currentHeading = mdHeadingMatch[1].trim();
    } else {
      buffer.push(trimmed);
      if (buffer.length >= 3) {
        flushBuffer(currentHeading);
      }
    }
  }
  flushBuffer(currentHeading);

  return Array.from(passageByHash.values());
}

function derivePassageRelevance(claimIds: string[]): string {
  if (claimIds.includes('CLM-007A')) {
    return 'Penurunan kinerja foil akibat akumulasi debu pada permukaan pemantul (radiant barrier).';
  }
  if (claimIds.includes('CLM-005') || claimIds.includes('CLM-006')) {
    return 'Ventilasi loteng mengalirkan dan membuang akumulasi udara panas dari rongga atap.';
  }
  if (claimIds.includes('CLM-003') || claimIds.includes('CLM-004B')) {
    return 'Syarat mutlak rongga udara berhadapan agar foil (radiant barrier) tidak menghantarkan panas lewat konduksi langsung.';
  }
  if (claimIds.includes('CLM-004A') || claimIds.includes('CLM-004')) {
    return 'Karakteristik aluminium foil sebagai pemantul radiasi dan bukan insulasi massa (bulk insulation).';
  }
  if (claimIds.includes('CLM-001A') || claimIds.includes('CLM-001B') || claimIds.includes('CLM-002')) {
    return 'Mekanisme pemanasan atap dan transmisi radiasi termal (radiant barrier) ke rongga atap di bawahnya.';
  }
  return 'Prinsip fisika bangunan terkait insulasi dan penghalang radiasi (radiant barrier).';
}

/**
 * Inspects retrieved text and extracts passages relevant to heat pathways, radiant barriers, air gaps, and ventilation.
 * Enforces Milestone 3B & 3B-STABILIZE Semantic Invariants:
 * 1. ONE PASSAGE = ONE ACTUAL EXCERPT (deterministic deduplication by source_id + locator + excerpt_hash).
 * 2. Strict semantic claim relevance (bans ungrounded associations from Apollo/space, window treatments, Canada, walls, etc.).
 * 3. Deterministic semantic role assignment per passage (ROOF_HEAT_TRANSFER, RADIANT_BARRIER_MECHANISM, AIR_SPACE_REQUIREMENT, ATTIC_VENTILATION, DUST_DEGRADATION).
 */
export function extractPassagesFromText(
  sourceId: string,
  documentTitle: string,
  text: string
): ExtractedPassage[] {
  const passageByHash = new Map<string, ExtractedPassage>();
  const lines = text.split('\n');

  let currentHeading = 'Overview / Lead';
  let buffer: string[] = [];

  const flushBuffer = (heading: string) => {
    if (buffer.length === 0) return;
    const chunk = buffer.join(' ').replace(/\s+/g, ' ').trim();
    buffer = [];

    if (chunk.length < 50) return;

    // Ignore non-substantive / external / historical / off-roof sections that do not apply to roof building claims
    if (/\b(?:External links|References|See also|Further reading|Space exploration|Apollo|History|Window treatments|Canada|Walls|Wall)\b/i.test(heading)) {
      return;
    }

    // Determine deterministic semantic role
    let semanticRole: EvidenceSemanticRole | undefined;
    if (/\b(?:dust accumulation on the reflective surface|when dust settles on an upward-facing radiant barrier|dust particle size, dust composition and the amount of ventilation in the attic affect how dust accumulates)\b/i.test(chunk)) {
      semanticRole = 'DUST_DEGRADATION';
    } else if (/\b(?:attic ventilation works synergistically with radiant barriers to exhaust warm attic air|proper attic ventilation|exhaust warm attic air via soffit and ridge vents|soffit and ridge vents)\b/i.test(chunk)) {
      semanticRole = 'ATTIC_VENTILATION';
    } else if (/\b(?:must face an open air space|facing an open air space|open space or adjacent air space|air gap|adjacent air space|direct contact with another building material, heat is transferred by direct conduction|dual air spaces are created|facing into various air spaces|facing air spaces)\b/i.test(chunk)) {
      semanticRole = 'AIR_SPACE_REQUIREMENT';
    } else if (/\b(?:heating the roofing material|travels by conduction through the roofing|conduction through the roofing materials)\b/i.test(chunk)) {
      semanticRole = 'ROOF_HEAT_TRANSFER';
    } else if (/\b(?:reflects radiant heat rather than absorbing it|radiates its gained heat energy onto the cooler attic surfaces|radiate heat downward through the roof space|heat radiated from the hot roof is reflected|reflects thermal radiation and reduces heat transfer|supplemented with thermal insulation that slows down heat transfer by conduction or convection|not bulk insulation)\b/i.test(chunk)) {
      semanticRole = 'RADIANT_BARRIER_MECHANISM';
    }

    if (!semanticRole) return;

    const matchedClaims: string[] = [];

    // Map claims strictly according to semantic role and specific evidence content
    if (semanticRole === 'ROOF_HEAT_TRANSFER') {
      if (/\b(?:heating the roofing material|travels by conduction through the roofing|conduction through the roofing materials)\b/i.test(chunk)) {
        matchedClaims.push('CLM-001A', 'CLM-001B');
      }
      if (/\b(?:radiates its gained heat energy onto the cooler attic surfaces|radiate heat downward through the roof space|heat radiated from the hot roof is reflected|reflects radiant heat rather than absorbing it)\b/i.test(chunk)) {
        matchedClaims.push('CLM-002');
      }
    } else if (semanticRole === 'RADIANT_BARRIER_MECHANISM') {
      if (/\b(?:reflects radiant heat rather than absorbing it|radiates its gained heat energy onto the cooler attic surfaces|radiate heat downward through the roof space|heat radiated from the hot roof is reflected|reflects thermal radiation and reduces heat transfer)\b/i.test(chunk)) {
        matchedClaims.push('CLM-002');
      }
      if (/\b(?:supplemented with thermal insulation that slows down heat transfer by conduction or convection|not bulk insulation)\b/i.test(chunk)) {
        matchedClaims.push('CLM-004A');
      }
    } else if (semanticRole === 'AIR_SPACE_REQUIREMENT') {
      matchedClaims.push('CLM-003', 'CLM-004B');
    } else if (semanticRole === 'ATTIC_VENTILATION') {
      matchedClaims.push('CLM-005');
      if (/\b(?:soffit and ridge vents|exhaust warm attic air via soffit and ridge vents)\b/i.test(chunk)) {
        matchedClaims.push('CLM-006');
      }
    } else if (semanticRole === 'DUST_DEGRADATION') {
      matchedClaims.push('CLM-007A');
    }

    if (matchedClaims.length === 0) return;

    const excerpt = chunk.slice(0, 500).trim();
    const excerptHash = crypto.createHash('sha256').update(excerpt, 'utf8').digest('hex');
    const canonicalKey = `${sourceId}::${heading}::${excerptHash}`;

    if (passageByHash.has(canonicalKey)) {
      const existing = passageByHash.get(canonicalKey)!;
      for (const cid of matchedClaims) {
        if (!existing.supports_claim_ids!.includes(cid)) {
          existing.supports_claim_ids!.push(cid);
        }
      }
      if (!existing.semantic_role) {
        existing.semantic_role = semanticRole;
      }
    } else {
      const canonicalIndex = passageByHash.size + 1;
      passageByHash.set(canonicalKey, {
        passage_id: `psg_${sourceId}_${canonicalIndex}`,
        source_id: sourceId,
        locator: heading,
        section_or_heading: heading,
        exact_text: excerpt,
        exact_or_normalized_excerpt: excerpt,
        extracted_at: new Date().toISOString(),
        relevance: derivePassageRelevance(matchedClaims),
        claim_relationship: matchedClaims.includes('CLM-007A') ? 'CONTRAST_LIMITATION' : 'DIRECT_SUPPORT',
        content_hash: excerptHash,
        supports_claim_ids: matchedClaims,
        semantic_role: semanticRole
      });
    }
  };

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) continue;

    // Detect section headings (== Section == or ### Section)
    const wikiHeadingMatch = trimmed.match(/^==+\s*([^=]+)\s*==+$/);
    const mdHeadingMatch = trimmed.match(/^#+\s*(.+)$/);

    if (wikiHeadingMatch) {
      flushBuffer(currentHeading);
      currentHeading = wikiHeadingMatch[1].trim();
    } else if (mdHeadingMatch) {
      flushBuffer(currentHeading);
      currentHeading = mdHeadingMatch[1].trim();
    } else {
      buffer.push(trimmed);
      if (buffer.length >= 4) {
        flushBuffer(currentHeading);
      }
    }
  }
  flushBuffer(currentHeading);

  return Array.from(passageByHash.values());
}

/**
 * Retrieves full text of an open institutional technical document (e.g. DOE / Building America).
 * Milestone: EDITORIAL-RUNTIME-3A
 */
export async function fetchOpenTechnicalDocument(
  sourceId: string,
  options: DiscoveryOptions = {}
): Promise<{
  title: string;
  publisher: string;
  url: string;
  canonical_url: string;
  source_classification?: 'OFFICIAL_INSTITUTIONAL_GUIDANCE' | 'PRIMARY_RESEARCH_DOCUMENT';
  authority_level?: 'INSTITUTIONAL_OFFICIAL';
  primary_vs_secondary?: 'SECONDARY' | 'PRIMARY';
  text: string;
  hash: string;
  source_origin: SourceOrigin;
  requested_url: string;
  resolved_url: string;
} | null> {
  const doc = OPEN_INSTITUTIONAL_DOCUMENTS[sourceId];
  if (!doc) return null;

  try {
    const cleanText = doc.text.trim();
    const hash = crypto.createHash('sha256').update(cleanText, 'utf8').digest('hex');
    return {
      title: doc.title,
      publisher: doc.publisher,
      url: doc.url,
      canonical_url: doc.canonical_url,
      source_classification: doc.source_classification,
      authority_level: doc.authority_level,
      primary_vs_secondary: doc.primary_vs_secondary,
      text: cleanText,
      hash,
      source_origin: 'SYNTHETIC_FIXTURE',
      requested_url: doc.url,
      resolved_url: doc.canonical_url
    };
  } catch {
    return null;
  }
}

/**
 * Verifies the integrity and authenticity of a cached snapshot against its stored text.
 * Milestone: SOURCE-ACQUISITION-AUTHENTICITY-1
 */
export function verifyCachedSnapshotProvenance(
  snapshot: CachedSnapshotProvenance | undefined,
  actualText?: string | null
): { isValid: boolean; reason?: string } {
  if (!snapshot) {
    return { isValid: false, reason: 'Snapshot provenance object is missing' };
  }
  if (!snapshot.original_source_url || !snapshot.original_retrieved_at) {
    return { isValid: false, reason: 'Snapshot missing original_source_url or original_retrieved_at' };
  }
  if (snapshot.original_http_status !== 200) {
    return { isValid: false, reason: `Original HTTP status must be 200, got ${snapshot.original_http_status}` };
  }
  if (!snapshot.raw_snapshot_hash || !snapshot.canonical_source_identity || !snapshot.snapshot_integrity_hash) {
    return { isValid: false, reason: 'Snapshot missing raw_snapshot_hash, canonical_source_identity, or snapshot_integrity_hash' };
  }
  if (actualText !== null && actualText !== undefined) {
    const textHash = crypto.createHash('sha256').update(actualText.trim(), 'utf8').digest('hex');
    if (textHash !== snapshot.raw_snapshot_hash) {
      return { isValid: false, reason: `Snapshot content hash mismatch: expected ${snapshot.raw_snapshot_hash}, got ${textHash}` };
    }
  }
  const expectedIntegrity = crypto
    .createHash('sha256')
    .update(`${snapshot.canonical_source_identity}::${snapshot.original_source_url}::${snapshot.raw_snapshot_hash}::${snapshot.original_retrieved_at}`, 'utf8')
    .digest('hex');
  if (snapshot.snapshot_integrity_hash !== expectedIntegrity) {
    return { isValid: false, reason: 'Snapshot integrity hash validation failed' };
  }
  return { isValid: true };
}

/**
 * Creates an authentic CachedSnapshotProvenance token for previously retrieved documents.
 * Milestone: SOURCE-ACQUISITION-AUTHENTICITY-1
 */
export function createCachedSnapshotProvenance(params: {
  canonical_source_identity: string;
  original_source_url: string;
  original_retrieved_at: string;
  original_http_status: number;
  text: string;
}): CachedSnapshotProvenance {
  const cleanText = params.text.trim();
  const raw_snapshot_hash = crypto.createHash('sha256').update(cleanText, 'utf8').digest('hex');
  const snapshot_integrity_hash = crypto
    .createHash('sha256')
    .update(`${params.canonical_source_identity}::${params.original_source_url}::${raw_snapshot_hash}::${params.original_retrieved_at}`, 'utf8')
    .digest('hex');

  return {
    canonical_source_identity: params.canonical_source_identity,
    original_source_url: params.original_source_url,
    original_retrieved_at: params.original_retrieved_at,
    original_http_status: params.original_http_status,
    raw_snapshot_hash,
    snapshot_integrity_hash
  };
}

/**
 * Sanitizes raw HTML into readable, plain building science text.
 * Milestone: RESEARCH-SOURCE-COVERAGE-1 (Section 7)
 */
export function sanitizeHtmlToPlainText(html: string): string {
  let text = html;
  // Remove script, style, noscript, svg, head
  text = text.replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, ' ');
  text = text.replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, ' ');
  text = text.replace(/<noscript\b[^<]*(?:(?!<\/noscript>)<[^<]*)*<\/noscript>/gi, ' ');
  text = text.replace(/<svg\b[^<]*(?:(?!<\/svg>)<[^<]*)*<\/svg>/gi, ' ');
  text = text.replace(/<head\b[^<]*(?:(?!<\/head>)<[^<]*)*<\/head>/gi, ' ');

  // Headings to Markdown format for passage extractor
  text = text.replace(/<h[1-6][^>]*>(.*?)<\/h[1-6]>/gi, '\n\n## $1\n\n');
  text = text.replace(/<p[^>]*>(.*?)<\/p>/gi, '\n\n$1\n\n');
  text = text.replace(/<br\s*\/?>/gi, '\n');
  text = text.replace(/<li[^>]*>(.*?)<\/li>/gi, '\n- $1');

  // Strip remaining tags
  text = text.replace(/<[^>]+>/g, ' ');

  // Decode common HTML entities
  text = text.replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&mdash;/g, '—')
    .replace(/&ndash;/g, '–');

  // Normalize whitespace
  text = text.split('\n')
    .map(line => line.replace(/\s+/g, ' ').trim())
    .filter(Boolean)
    .join('\n\n');

  return text;
}

export interface HttpDocumentRetrievalResult {
  requested_url: string;
  resolved_url: string;
  http_status: number;
  content_type: string;
  retrieved_at: string;
  raw_content_hash: string;
  clean_text?: string;
  source_origin: SourceOrigin;
  retrieval_status: SourceRetrievalStatus | 'CONTENT_TYPE_NOT_SUPPORTED' | 'PAYWALL_OR_LOGIN_PAGE' | 'CONTENT_TOO_THIN' | 'CONTENT_EXTRACTION_EMPTY';
  is_blocked: boolean;
  blocked_reason?: string;
}

/**
 * Controlled generic HTTP document retrieval layer for candidate URLs.
 * Milestone: RESEARCH-SOURCE-COVERAGE-1 (Section 7)
 */
export async function fetchHttpDocument(
  url: string,
  options: DiscoveryOptions = {}
): Promise<HttpDocumentRetrievalResult> {
  const fetchFn = options.fetchFn || globalThis.fetch;
  const timeoutMs = options.timeoutMs || 15000;
  const requested_url = url;
  const retrieved_at = new Date().toISOString();

  const safeCheck = validateSafeUrl(url);
  if (!safeCheck.isSafe) {
    return {
      requested_url,
      resolved_url: requested_url,
      http_status: 0,
      content_type: '',
      retrieved_at,
      raw_content_hash: '',
      source_origin: 'LIVE_RETRIEVAL',
      retrieval_status: 'SOURCE_RETRIEVAL_FAILED',
      is_blocked: true,
      blocked_reason: `SSRF_BLOCKED: ${safeCheck.reason}`
    };
  }

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

    const res = await fetchFn(url, {
      signal: controller.signal,
      headers: {
        'User-Agent': 'RancangLoka-Research-Runtime/1.0 (mailto:redaksi@rancangloka.com)',
        'Accept': 'text/html,text/plain,application/xhtml+xml;q=0.9,*/*;q=0.8'
      },
      redirect: 'follow'
    });
    clearTimeout(timeoutId);

    const resolved_url = res.url || url;
    if (resolved_url !== url) {
      const resolvedCheck = validateSafeUrl(resolved_url);
      if (!resolvedCheck.isSafe) {
        return {
          requested_url,
          resolved_url,
          http_status: res.status,
          content_type: '',
          retrieved_at,
          raw_content_hash: '',
          source_origin: 'LIVE_RETRIEVAL',
          retrieval_status: 'SOURCE_RETRIEVAL_FAILED',
          is_blocked: true,
          blocked_reason: `SSRF_BLOCKED: Redirected to unsafe destination (${resolvedCheck.reason})`
        };
      }
    }

    const http_status = res.status;
    const contentType = (res.headers.get('content-type') || '').toLowerCase();

    if (!res.ok) {
      return {
        requested_url,
        resolved_url,
        http_status,
        content_type: contentType,
        retrieved_at,
        raw_content_hash: '',
        source_origin: 'LIVE_RETRIEVAL',
        retrieval_status: 'SOURCE_RETRIEVAL_FAILED',
        is_blocked: true,
        blocked_reason: `HTTP_ERROR_${http_status}`
      };
    }

    // Check supported content types
    if (contentType.includes('application/pdf')) {
      return {
        requested_url,
        resolved_url,
        http_status,
        content_type: contentType,
        retrieved_at,
        raw_content_hash: '',
        source_origin: 'LIVE_RETRIEVAL',
        retrieval_status: 'CONTENT_TYPE_NOT_SUPPORTED',
        is_blocked: true,
        blocked_reason: 'CONTENT_TYPE_NOT_SUPPORTED: application/pdf'
      };
    }

    if (!contentType.includes('text/html') && !contentType.includes('text/plain') && !contentType.includes('application/xhtml+xml')) {
      return {
        requested_url,
        resolved_url,
        http_status,
        content_type: contentType,
        retrieved_at,
        raw_content_hash: '',
        source_origin: 'LIVE_RETRIEVAL',
        retrieval_status: 'CONTENT_TYPE_NOT_SUPPORTED',
        is_blocked: true,
        blocked_reason: `CONTENT_TYPE_NOT_SUPPORTED: ${contentType}`
      };
    }

    const rawBody = await res.text();
    const raw_content_hash = crypto.createHash('sha256').update(rawBody, 'utf8').digest('hex');

    let cleanText = rawBody;
    if (contentType.includes('html') || contentType.includes('xhtml')) {
      cleanText = sanitizeHtmlToPlainText(rawBody);
    }

    const trimmedText = cleanText.trim();
    if (!trimmedText) {
      return {
        requested_url,
        resolved_url,
        http_status,
        content_type: contentType,
        retrieved_at,
        raw_content_hash,
        clean_text: '',
        source_origin: 'LIVE_RETRIEVAL',
        retrieval_status: 'CONTENT_EXTRACTION_EMPTY',
        is_blocked: true,
        blocked_reason: 'CONTENT_EXTRACTION_EMPTY'
      };
    }

    const lowerCombined = (rawBody + ' ' + trimmedText).toLowerCase();
    const isPaywallOrLogin = /\b(?:sign in to access|log in to your account|subscribe to continue reading|purchase this article|institutional login required|access restricted|subscription required|access to this page has been denied)\b/i.test(lowerCombined);
    if (isPaywallOrLogin) {
      return {
        requested_url,
        resolved_url,
        http_status,
        content_type: contentType,
        retrieved_at,
        raw_content_hash,
        clean_text: trimmedText,
        source_origin: 'LIVE_RETRIEVAL',
        retrieval_status: 'PAYWALL_OR_LOGIN_PAGE',
        is_blocked: true,
        blocked_reason: 'PAYWALL_OR_LOGIN_PAGE'
      };
    }

    const isJsRequired = /\b(?:enable javascript to run this app|javascript is required|please enable javascript to view this page)\b/i.test(lowerCombined);
    if (isJsRequired && trimmedText.length < 250) {
      return {
        requested_url,
        resolved_url,
        http_status,
        content_type: contentType,
        retrieved_at,
        raw_content_hash,
        clean_text: trimmedText,
        source_origin: 'LIVE_RETRIEVAL',
        retrieval_status: 'CONTENT_EXTRACTION_EMPTY',
        is_blocked: true,
        blocked_reason: 'CONTENT_EXTRACTION_EMPTY'
      };
    }

    if (trimmedText.length < 150) {
      return {
        requested_url,
        resolved_url,
        http_status,
        content_type: contentType,
        retrieved_at,
        raw_content_hash,
        clean_text: trimmedText,
        source_origin: 'LIVE_RETRIEVAL',
        retrieval_status: 'CONTENT_TOO_THIN',
        is_blocked: true,
        blocked_reason: 'CONTENT_TOO_THIN'
      };
    }

    return {
      requested_url,
      resolved_url,
      http_status,
      content_type: contentType,
      retrieved_at,
      raw_content_hash,
      clean_text: trimmedText,
      source_origin: 'LIVE_RETRIEVAL',
      retrieval_status: 'SOURCE_RETRIEVED_AND_VERIFIED',
      is_blocked: false
    };
  } catch (err: any) {
    return {
      requested_url,
      resolved_url: requested_url,
      http_status: 0,
      content_type: '',
      retrieved_at,
      raw_content_hash: '',
      source_origin: 'LIVE_RETRIEVAL',
      retrieval_status: 'SOURCE_RETRIEVAL_FAILED',
      is_blocked: true,
      blocked_reason: `NETWORK_ERROR: ${err.message || String(err)}`
    };
  }
}

export interface SourceIdentity {
  publisher: string;
  source_classification: 'PRIMARY_RESEARCH_DOCUMENT' | 'OFFICIAL_INSTITUTIONAL_GUIDANCE' | 'ENCYCLOPEDIC_SECONDARY_SOURCE' | 'STANDARDS_PUBLICATION' | 'INDUSTRY_REFERENCE';
  authority_level: 'INSTITUTIONAL_OFFICIAL' | 'INSTITUTIONAL_PEER_REVIEW' | 'SECONDARY_ENCYCLOPEDIC' | 'STANDARDS_BODY' | 'INDUSTRY_REFERENCE';
  primary_vs_secondary: 'PRIMARY' | 'SECONDARY';
  applicability: SourceApplicability;
  source_role?: SourceRole;
}

/**
 * Establishes publisher, classification, and authority level from URL and metadata.
 * Milestone: RESEARCH-SOURCE-COVERAGE-1 & EVIDENCE-QUALITY-GATE-1
 */
export function establishSourceIdentity(resolvedUrl: string, candidatePublisher?: string): SourceIdentity {
  let hostname = '';
  try {
    hostname = new URL(resolvedUrl).hostname.toLowerCase();
  } catch {
    hostname = resolvedUrl.toLowerCase();
  }

  const roleClass = classifySourceRole({
    publisher: candidatePublisher,
    resolvedUrl,
    url: resolvedUrl
  });

  // Standards Body
  if (roleClass.source_role === 'TECHNICAL_STANDARD') {
    return {
      publisher: candidatePublisher || 'Standards Body',
      source_classification: 'STANDARDS_PUBLICATION',
      authority_level: 'STANDARDS_BODY',
      primary_vs_secondary: 'PRIMARY',
      applicability: 'UNIVERSAL_PHYSICS',
      source_role: roleClass.source_role
    };
  }

  // Institutional Government Guidelines & National Laboratories (LBNL, EPA, DOE, PUPR, BRIN)
  if (roleClass.source_role === 'OFFICIAL_GOVERNMENT_GUIDANCE' || roleClass.source_role === 'OFFICIAL_INSTITUTIONAL_GUIDANCE') {
    return {
      publisher: candidatePublisher || (hostname.includes('lbl.gov') ? 'Lawrence Berkeley National Laboratory (LBNL)' : hostname.includes('epa.gov') ? 'U.S. EPA' : hostname.includes('energy.gov') ? 'U.S. Department of Energy' : 'Government/Academic Institution'),
      source_classification: 'OFFICIAL_INSTITUTIONAL_GUIDANCE',
      authority_level: 'INSTITUTIONAL_OFFICIAL',
      primary_vs_secondary: 'SECONDARY',
      applicability: 'UNIVERSAL_PHYSICS',
      source_role: roleClass.source_role
    };
  }

  // Scholarly Journals & Academic Papers (including university OJS journals on .ac.id / .edu)
  if (roleClass.source_role === 'SCHOLARLY_JOURNAL_ARTICLE') {
    return {
      publisher: candidatePublisher || 'Peer-Reviewed Academic Publisher',
      source_classification: 'PRIMARY_RESEARCH_DOCUMENT',
      authority_level: 'INSTITUTIONAL_PEER_REVIEW',
      primary_vs_secondary: 'PRIMARY',
      applicability: 'UNIVERSAL_PHYSICS',
      source_role: roleClass.source_role
    };
  }

  // Encyclopedic / Wikipedia
  if (hostname.includes('wikipedia.org') || hostname.includes('wikimedia.org') || (candidatePublisher && candidatePublisher.toLowerCase().includes('wikimedia'))) {
    return {
      publisher: 'Wikimedia Foundation',
      source_classification: 'ENCYCLOPEDIC_SECONDARY_SOURCE',
      authority_level: 'SECONDARY_ENCYCLOPEDIC',
      primary_vs_secondary: 'SECONDARY',
      applicability: 'UNIVERSAL_PHYSICS',
      source_role: 'SCHOLARLY_RESEARCH'
    };
  }

  // Other university/academic research without explicit OJS markers
  if (hostname.endsWith('.edu') || hostname.endsWith('.ac.id')) {
    return {
      publisher: candidatePublisher || 'University Academic Institution',
      source_classification: 'PRIMARY_RESEARCH_DOCUMENT',
      authority_level: 'INSTITUTIONAL_PEER_REVIEW',
      primary_vs_secondary: 'PRIMARY',
      applicability: 'UNIVERSAL_PHYSICS',
      source_role: 'SCHOLARLY_JOURNAL_ARTICLE'
    };
  }

  // Default Industry / Technical Reference / General Media
  return {
    publisher: candidatePublisher || hostname || 'Technical Reference Publisher',
    source_classification: 'INDUSTRY_REFERENCE',
    authority_level: 'INDUSTRY_REFERENCE',
    primary_vs_secondary: 'SECONDARY',
    applicability: 'UNIVERSAL_PHYSICS',
    source_role: roleClass.source_role
  };
}

export interface SourceDiversityMetrics {
  authentic_source_count: number;
  independent_source_count: number;
  source_class_count: number;
  claim_source_relationship_count: number;
  concentration_risk: 'LOW' | 'MODERATE' | 'HIGH' | 'CRITICAL';
  unique_publishers: string[];
  unique_classes: string[];
}

/**
 * Computes source diversity metrics, distinguishing distinct authentic sources from claim-source relationships.
 * Milestone: RESEARCH-SOURCE-COVERAGE-1 (Section 11)
 */
export function calculateSourceDiversity(
  sources: (RetrievedDocument | EvidenceSource)[],
  claims?: EvidenceClaim[]
): SourceDiversityMetrics {
  const authenticSources = sources.filter(s => {
    const isAuthentic = s.source_origin === 'LIVE_RETRIEVAL' || s.source_origin === 'VERIFIED_CACHED_SNAPSHOT';
    const isVerified = s.retrieval_status === 'SOURCE_RETRIEVED_AND_VERIFIED';
    const notBlocked = !(s as any).is_blocked;
    return isAuthentic && isVerified && notBlocked;
  });

  const uniqueSourceIds = Array.from(new Set(authenticSources.map(s => s.source_id)));
  const uniquePublishers = Array.from(new Set(authenticSources.map(s => (s as any).publisher || (s as any).publisher_or_author).filter((p): p is string => Boolean(p))));
  const uniqueClasses = Array.from(new Set(authenticSources.map(s => String(s.source_classification || '')).filter(Boolean)));

  const relCount = claims
    ? claims.reduce((acc, c) => acc + (c.sources ? c.sources.filter((s: any) => s.retrieval_status === 'SOURCE_RETRIEVED_AND_VERIFIED' && (s.source_origin === 'LIVE_RETRIEVAL' || s.source_origin === 'VERIFIED_CACHED_SNAPSHOT')).length : 0), 0)
    : uniqueSourceIds.length;

  let concentration_risk: 'LOW' | 'MODERATE' | 'HIGH' | 'CRITICAL' = 'LOW';
  if (uniqueSourceIds.length === 0) {
    concentration_risk = 'CRITICAL';
  } else if (uniqueSourceIds.length === 1) {
    concentration_risk = 'HIGH';
  } else if (uniqueClasses.length === 1) {
    concentration_risk = 'MODERATE';
  } else {
    concentration_risk = 'LOW';
  }

  return {
    authentic_source_count: uniqueSourceIds.length,
    independent_source_count: uniquePublishers.length,
    source_class_count: uniqueClasses.length,
    claim_source_relationship_count: relCount,
    concentration_risk,
    unique_publishers: uniquePublishers,
    unique_classes: uniqueClasses
  };
}
