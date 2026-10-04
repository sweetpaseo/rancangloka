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
  EvidenceSource
} from '../article/human-quality.ts';

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

export interface RetrievedDocument {
  source_id: string;
  title: string;
  publisher: string;
  url: string | null;
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
}

export interface ExtractedPassage {
  passage_id: string;
  source_id: string;
  section_or_heading: string;
  exact_text: string;
  relevance: string;
  claim_relationship: 'DIRECT_SUPPORT' | 'CONTEXTUAL_BACKGROUND' | 'CONTRAST_LIMITATION';
}

export interface DiscoveryOptions {
  fetchFn?: typeof globalThis.fetch;
  timeoutMs?: number;
}

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
): Promise<{ text: string; hash: string } | null> {
  const fetchFn = options.fetchFn || globalThis.fetch;
  const timeoutMs = options.timeoutMs || 15000;

  const url = `https://en.wikipedia.org/w/api.php?action=query&prop=extracts&explaintext=true&titles=${encodeURIComponent(title)}&format=json&origin=*`;

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

    const res = await fetchFn(url, { signal: controller.signal });
    clearTimeout(timeoutId);

    if (!res.ok) return null;

    const data: any = await res.json();
    const pages = data?.query?.pages;
    if (!pages) return null;

    const pageId = Object.keys(pages)[0];
    const rawText = pages[pageId]?.extract;
    if (!rawText || typeof rawText !== 'string' || !rawText.trim()) return null;

    const cleanText = rawText.trim();
    const hash = crypto.createHash('sha256').update(cleanText, 'utf8').digest('hex');

    return { text: cleanText, hash };
  } catch {
    return null;
  }
}

/**
 * Inspects retrieved text and extracts passages relevant to heat pathways, radiant barriers, air gaps, and ventilation.
 */
export function extractPassagesFromText(
  sourceId: string,
  documentTitle: string,
  text: string
): ExtractedPassage[] {
  const passages: ExtractedPassage[] = [];
  const lines = text.split('\n');

  let currentHeading = 'Overview / Lead';
  let buffer: string[] = [];

  const flushBuffer = (heading: string) => {
    if (buffer.length === 0) return;
    const chunk = buffer.join(' ').replace(/\s+/g, ' ').trim();
    buffer = [];

    if (chunk.length < 50) return;

    // Heat transfer / radiation checks
    if (/\b(?:radiation|radiant barrier|thermal radiation|reflects thermal radiation|heat transfer|electromagnetic spectrum)\b/i.test(chunk)) {
      passages.push({
        passage_id: `psg_${sourceId}_${passages.length + 1}`,
        source_id: sourceId,
        section_or_heading: heading,
        exact_text: chunk.slice(0, 500),
        relevance: 'Prinsip fisik penghalang radiasi (radiant barrier) memantulkan radiasi termal untuk mereduksi perpindahan panas.',
        claim_relationship: 'DIRECT_SUPPORT'
      });
    }

    // Air space / air gap requirement
    if (/\b(?:air space|air gap|adjacent air|open space|facing an air|conduction)\b/i.test(chunk)) {
      passages.push({
        passage_id: `psg_${sourceId}_${passages.length + 1}`,
        source_id: sourceId,
        section_or_heading: heading,
        exact_text: chunk.slice(0, 500),
        relevance: 'Syarat mutlak rongga udara (air space): foil memerlukan ruang udara berhadapan agar tidak menghantarkan panas lewat konduksi langsung.',
        claim_relationship: 'DIRECT_SUPPORT'
      });
    }

    // Attic ventilation / roof cavity airflow
    if (/\b(?:ventilation|attic|ridge vent|soffit|airflow|stack effect|convection)\b/i.test(chunk)) {
      passages.push({
        passage_id: `psg_${sourceId}_${passages.length + 1}`,
        source_id: sourceId,
        section_or_heading: heading,
        exact_text: chunk.slice(0, 500),
        relevance: 'Ventilasi loteng/atap membuang udara panas yang terakumulasi melalui sirkulasi konvektif (efek cerobong dan tekanan angin).',
        claim_relationship: 'DIRECT_SUPPORT'
      });
    }

    // Dust accumulation / condensation / maintenance trade-offs
    if (/\b(?:dust|emittance|condensation|moisture|corrosion|degradation)\b/i.test(chunk)) {
      passages.push({
        passage_id: `psg_${sourceId}_${passages.length + 1}`,
        source_id: sourceId,
        section_or_heading: heading,
        exact_text: chunk.slice(0, 500),
        relevance: 'Kompromi lapangan: akumulasi debu menurunkan reflektivitas foil, serta risiko kelembapan/kondensasi bila ventilasi tidak memadai.',
        claim_relationship: 'CONTRAST_LIMITATION'
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

  return passages;
}
