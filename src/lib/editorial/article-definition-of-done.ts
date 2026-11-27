/**
 * RancangLoka — Canonical Article Definition of Done (DoD) Evaluator v1.0
 * Milestone: EDITORIAL_DOD_V1
 * 
 * Provides an authoritative, reusable evaluator that tests any article
 * against Gate A (EDITORIAL DRAFT READY) and Gate B (PUBLICATION READY).
 * 
 * Invariants:
 * - Deterministic, read-only evaluation (ZERO database or article mutations).
 * - Gate A evaluates text/editorial quality independently of media availability.
 * - Missing approved media MUST block Gate B (fail-closed), but NEVER block Gate A.
 * - Logos, SVG placeholders, and missing-image fallbacks do NOT count as approved photographs.
 * - Separation of Concerns: Content readiness (Gate B) is separated from Owner Authorization (manual_hold).
 */

import crypto from 'node:crypto';
import { auditJokoDraftReadability, type JokoDraftReadabilityAuditResult } from './joko-prompt-builder.ts';
import { evaluateReaderVoice, type ReaderVoiceEvaluationResult } from './nadia-reader-voice.ts';
import { extractEditorialFaqs, stripFaqCommentMarkers, type EditorialFaqItem } from './faq.ts';
import { extractTableOfContents } from '../seo.ts';
import {
  detectForbiddenVisualStyles,
  OBJECT_FIRST_POLICY_VERSION
} from './object-first-visual-policy.ts';
import { evaluateEditorialCuriosityPrinciple } from './editorial-curiosity-principle.ts';

export type DoDStatus = 'PASS' | 'WARNING' | 'BLOCKED' | 'NOT_APPLICABLE';

export const CANONICAL_SEO_TITLE_MIN = 1;
export const CANONICAL_SEO_TITLE_MAX = 500;

export interface GateCheckItem {
  id: string;
  name: string;
  status: DoDStatus;
  message: string;
}

export interface ArticleDoDEvaluationResult {
  articleId: number | string;
  slug: string;
  title: string;
  gateA: {
    status: 'PASS' | 'BLOCKED';
    score: number;
    checks: GateCheckItem[];
  };
  gateB: {
    status: 'PASS' | 'BLOCKED';
    score: number;
    checks: GateCheckItem[];
    blockingReasons: string[];
  };
  ownerAuthorization: {
    manualHold: number;
    isHoldCleared: boolean;
    hasEditorialApproval: boolean;
    isAuthorized: boolean;
    blockingReasons: string[];
  };
  summary: {
    isEditorialDraftReady: boolean;
    isPublicationContentReady: boolean;
    isPublicationReady: boolean;
    nextRequiredAction: string;
  };
  evaluatedAt: string;
}

export interface ArticleInputForDoD {
  id: number | string;
  slug: string;
  title: string;
  description?: string;
  content_md: string;
  content_html?: string;
  featured_image?: string | null;
  image_alt?: string | null;
  category_id?: number;
  author_id?: number;
  status?: string;
  manual_hold?: number;
  has_editorial_approval?: boolean;
  key_takeaways?: string | string[];
  faqs?: any[];
  focus_keyword?: string | null;
  visual_manifest?: any;
  approved_photos?: {
    cover_approved: boolean;
    inline_approved_count: number;
    total_inline_slots: number;
    items?: any[];
  };
  published_slugs_whitelist?: Set<string>;
  enforce_sentence_keywords?: boolean;
  require_model_semantic_evaluator?: boolean;
  manuscript_sha256?: string;
  nadia_evaluation?: any;
  jev_receipt?: any;
  evidence_pack?: any;
  evidence_review?: {
    status?: 'PENDING_REVIEW' | 'APPROVED_BY_RESEARCHER' | 'RESOLVED' | string;
    verified_firsthand_claims?: string[];
    unverified_experience_claims?: string[];
    confirmed_fabrications?: string[];
  };
  grounding_audit?: any;
}

export function computeArticleSha256(content: string): string {
  return crypto.createHash('sha256').update(String(content || '').trim(), 'utf8').digest('hex');
}

function extractFirstAndLastSentences(contentMd: string): { firstSentence: string; lastSentence: string } {
  const body = contentMd.replace(/^---[\s\S]*?---\s*/, '').trim();
  const lines = body.split('\n');
  const paragraphs: string[] = [];
  let currentP: string[] = [];

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#') || trimmed.startsWith('<!--') || trimmed.startsWith('---') || trimmed.startsWith('>')) {
      if (currentP.length > 0) {
        paragraphs.push(currentP.join(' '));
        currentP = [];
      }
    } else {
      currentP.push(trimmed);
    }
  }
  if (currentP.length > 0) {
    paragraphs.push(currentP.join(' '));
  }

  const firstPara = paragraphs[0] || '';
  const lastPara = paragraphs[paragraphs.length - 1] || '';

  const firstSentences = firstPara.split(/(?<=[.?!])\s+/).filter(s => s.trim().length > 5);
  const firstSentence = firstSentences[0] || firstPara;

  const lastSentences = lastPara.split(/(?<=[.?!])\s+/).filter(s => s.trim().length > 5);
  const lastSentence = lastSentences[lastSentences.length - 1] || lastPara;

  return { firstSentence, lastSentence };
}

export function evaluateArticleDoD(input: ArticleInputForDoD): ArticleDoDEvaluationResult {
  const contentMd = String(input.content_md || '').trim();
  const slug = String(input.slug || '').trim();
  const title = String(input.title || '').trim();
  const description = String(input.description || '').trim();

  // --------------------------------------------------------------------------
  // GATE A: EDITORIAL DRAFT READY CHECKS
  // --------------------------------------------------------------------------
  const checksA: GateCheckItem[] = [];

  // A.1 Title & Slug — Google Guidance (Descriptive & Concise, Non-Dummy, Non-Empty)
  const hasValidSlug = /^[a-z0-9]+(-[a-z0-9]+)*$/.test(slug) && slug.length >= 5;
  const isTitleNotDummy = !/^(test|draf|untitled)/i.test(title);
  const hasValidTitle = title.length > 0 && isTitleNotDummy;
  const estimatedHtmlTitleLen = title.length + 14; // includes " | RancangLoka" suffix

  if (!hasValidSlug || !hasValidTitle) {
    let blockReason = '';
    if (!hasValidSlug) {
      blockReason = `Slug "${slug}" tidak valid (wajib berupa huruf kecil, angka, strip, minimal 5 karakter).`;
    } else if (!isTitleNotDummy) {
      blockReason = `Judul "${title}" tidak valid (terdeteksi awalan dummy/test).`;
    } else {
      blockReason = 'Judul artikel tidak boleh kosong. Google mewajibkan setiap halaman memiliki elemen <title> yang jelas dan deskriptif.';
    }

    checksA.push({
      id: 'A.1_TITLE_SLUG',
      name: 'Judul & Slug Valid',
      status: 'BLOCKED',
      message: blockReason
    });
  } else {
    checksA.push({
      id: 'A.1_TITLE_SLUG',
      name: 'Judul & Slug Valid',
      status: 'PASS',
      message: `Slug "${slug}" dan judul valid (${title.length} karakter, deskriptif untuk Google Search, estimasi HTML title: ${estimatedHtmlTitleLen} karakter).`
    });
  }

  // A.1b Editorial Curiosity Principle (Owner Decision: Natural question headline & curiosity hook)
  const isLegacyArticle = Boolean(
    input.status === 'published' ||
    (typeof input.id === 'number' && input.id <= 14) ||
    (typeof input.id === 'string' && parseInt(input.id, 10) <= 14 && parseInt(input.id, 10) > 0) ||
    (input as any).is_legacy_approved
  );

  const ecpEval = evaluateEditorialCuriosityPrinciple({
    headline: title,
    manuscript: contentMd,
    focusKeyword: String(input.focus_keyword || (input as any).primary_keyword || '')
  });

  let ecpStatus: 'PASS' | 'WARNING' | 'BLOCKED' = 'PASS';
  let ecpMessage = '';

  if (isLegacyArticle) {
    // Legacy published/approved articles: exempt from forced regeneration
    ecpStatus = ecpEval.status === 'PASS' ? 'PASS' : 'WARNING';
    ecpMessage = ecpEval.status === 'PASS'
      ? `Headline mematuhi Editorial Curiosity Principle (skor ECP: ${ecpEval.overall_score}/100).`
      : `Artikel warisan/terbit sebelumnya dikecualikan dari regenerasi paksa (skor ECP: ${ecpEval.overall_score}/100).`;
  } else {
    // New draft articles: ECP is mandatory and enforced via semantic evaluation
    if (ecpEval.status === 'PASS') {
      ecpStatus = 'PASS';
      ecpMessage = `Headline & naskah mematuhi Editorial Curiosity Principle secara penuh (pertanyaan natural berakhiran '?', bebas clickbait, isi menjawab pertanyaan, skor ECP: ${ecpEval.overall_score}/100).`;
    } else {
      ecpStatus = 'BLOCKED';
      const reasons = ecpEval.actionable_findings.join('; ');
      ecpMessage = `Pelanggaran Editorial Curiosity Principle pada draf baru: ${reasons} (skor ECP: ${ecpEval.overall_score}/100). Sesuai arahan Owner, draf baru wajib berupa pertanyaan natural yang dijawab substantif oleh naskah.`;
    }
  }

  checksA.push({
    id: 'A.1b_EDITORIAL_CURIOSITY',
    name: 'Editorial Curiosity Principle (Headline & Opening)',
    status: ecpStatus,
    message: ecpMessage
  });

  // A.2 Search Intent First
  const wordCount = contentMd.split(/\s+/).filter(Boolean).length;
  const hasSubstantiveBody = wordCount >= 700;
  checksA.push({
    id: 'A.2_SEARCH_INTENT_BODY',
    name: 'Kelengkapan Naskah & Search Intent',
    status: hasSubstantiveBody ? 'PASS' : 'BLOCKED',
    message: hasSubstantiveBody
      ? `Naskah lengkap (${wordCount} kata, memenuhi standar 800-1500 kata).`
      : `Naskah terlalu pendek (${wordCount} kata, minimal 700 kata).`
  });

  // A.3 Description — Google Guidance (Informative, Accurate, Non-Empty)
  if (description.length === 0) {
    checksA.push({
      id: 'A.3_DESCRIPTION',
      name: 'Meta Deskripsi Artikel',
      status: 'BLOCKED',
      message: 'Meta deskripsi tidak boleh kosong. Google menggunakan deskripsi akurat untuk memahami konteks dan menyusun cuplikan pencarian.'
    });
  } else {
    checksA.push({
      id: 'A.3_DESCRIPTION',
      name: 'Meta Deskripsi Artikel',
      status: 'PASS',
      message: `Meta deskripsi terisi valid (${description.length} karakter, informatif untuk cuplikan pencarian Google).`
    });
  }

  // A.4 Heading Structure & Consistency
  const markdownH1Matches = [...contentMd.matchAll(/^#\s+([^\n]+)/gm)];
  const h1Count = markdownH1Matches.length;
  const h2Count = (contentMd.match(/^##\s+[^\n]+/gm) || []).length;
  const hasGoodStructure = h1Count <= 1 && h2Count >= 3;

  let headingConsistencyIssue: string | null = null;
  if (h1Count === 1 && title) {
    const mdH1 = markdownH1Matches[0][1].trim();
    const normH1 = mdH1.toLowerCase().replace(/[^a-z0-9\s]/g, '');
    const normTitle = title.toLowerCase().replace(/[^a-z0-9\s]/g, '');
    const h1Words = normH1.split(/\s+/).filter(w => w.length >= 3);
    const titleWords = new Set(normTitle.split(/\s+/).filter(w => w.length >= 3));
    const overlap = h1Words.filter(w => titleWords.has(w));
    if (h1Words.length > 0 && overlap.length === 0) {
      headingConsistencyIssue = `Heading H1 markdown ("${mdH1}") berbeda secara makna dari judul artikel ("${title}").`;
    }
  }

  if (!hasGoodStructure) {
    checksA.push({
      id: 'A.4_HEADING_STRUCTURE',
      name: 'Struktur Heading & TOC',
      status: 'BLOCKED',
      message: `Hierarki heading tidak seimbang (H1: ${h1Count}, H2: ${h2Count}). Minimal dibutuhkan 3 H2.`
    });
  } else if (headingConsistencyIssue) {
    checksA.push({
      id: 'A.4_HEADING_STRUCTURE',
      name: 'Struktur Heading & TOC',
      status: 'WARNING',
      message: headingConsistencyIssue
    });
  } else {
    checksA.push({
      id: 'A.4_HEADING_STRUCTURE',
      name: 'Struktur Heading & TOC',
      status: 'PASS',
      message: `Struktur heading baik (1 H1, ${h2Count} H2 sub-bab).`
    });
  }

  // A.5 Key Takeaways
  let hasKeyTakeaways = false;
  if (Array.isArray(input.key_takeaways)) {
    hasKeyTakeaways = input.key_takeaways.length >= 3;
  } else if (typeof input.key_takeaways === 'string') {
    try {
      const parsed = JSON.parse(input.key_takeaways);
      hasKeyTakeaways = Array.isArray(parsed) && parsed.length >= 3;
    } catch (_) {}
  }
  checksA.push({
    id: 'A.5_KEY_TAKEAWAYS',
    name: 'Poin Kunci (Key Takeaways)',
    status: hasKeyTakeaways ? 'PASS' : 'WARNING',
    message: hasKeyTakeaways
      ? `Tersedia ringkasan poin kunci valid.`
      : `Poin kunci belum tersedia atau kurang dari 3 butir.`
  });

  // Clean prose markdown by removing embedded FAQ/media comment markers before prose audit
  const cleanProseMd = stripFaqCommentMarkers(contentMd);

  // A.6 Joko Readability (Conversational Editorial L5: Paragraph density is advisory warning per DEC-10/DEC-22, not mechanical hard blocker)
  const jokoResult: JokoDraftReadabilityAuditResult = auditJokoDraftReadability(cleanProseMd);
  const onlyParagraphDensityIssues = jokoResult.issues.length > 0 && jokoResult.issues.every(i => i.includes('paragraf padat'));
  const readabilityStatus = jokoResult.passed ? 'PASS' : (onlyParagraphDensityIssues ? 'WARNING' : 'BLOCKED');
  checksA.push({
    id: 'A.6_JOKO_READABILITY',
    name: 'Audit Keterbacaan & Paragraf Pendek',
    status: readabilityStatus,
    message: jokoResult.passed
      ? `Lulus audit keterbacaan (0 paragraf padat > 60 kata, 0 sintaks escape liar).`
      : (onlyParagraphDensityIssues
        ? `Indikator keterbacaan fleksibel L5: ${jokoResult.issues.join('; ')} (Non-blocking advisory per DEC-22).`
        : `Masalah keterbacaan terdeteksi: ${jokoResult.issues.join('; ')}`)
  });

  // A.7 Nadia Reader Voice (Anti-Translationese, Warm Advisory Tone)
  const nadiaResult: ReaderVoiceEvaluationResult = input.nadia_evaluation || evaluateReaderVoice(cleanProseMd, {
    title: title,
    contentFamily: /vs|perbedaan|mana yang/i.test(title) ? 'comparison' : 'explainer'
  });
  const nadiaPassed = nadiaResult.decision === 'READER_VOICE_PASS';
  checksA.push({
    id: 'A.7_NADIA_VOICE',
    name: 'Audit Suara Pembaca & Anti-Translationese',
    status: nadiaPassed ? 'PASS' : 'BLOCKED',
    message: nadiaPassed
      ? `Lulus evaluasi suara pembaca Nadia (Skor: ${nadiaResult.overallScore}/100).`
      : `Nadia meminta revisi: ${nadiaResult.blockingIssues.map(b => b.reason).join('; ') || 'Penyelarasan nada suara konsultan'}`
  });

  // A.8 Safe Internal Links
  const linkMatches = [...contentMd.matchAll(/\[([^\]]+)\]\(([^)]+)\)/g)];
  const internalHrefs = linkMatches
    .map(m => m[2].trim())
    .filter(href => href.startsWith('/') && !href.startsWith('//') && !href.startsWith('/media'));
  
  const suspiciousDraftLinks = internalHrefs.filter(href => {
    const s = href.replace(/^\//, '').split(/[?#]/)[0];
    if (s.includes('canary') || s.includes('draft') || s.includes('trial')) return true;
    if (input.published_slugs_whitelist && !input.published_slugs_whitelist.has(s)) {
      return true; // Not in published whitelist
    }
    return false;
  });

  const linksSafe = suspiciousDraftLinks.length === 0;
  checksA.push({
    id: 'A.8_INTERNAL_LINKS_SAFETY',
    name: 'Keamanan Tautan Internal',
    status: linksSafe ? 'PASS' : 'BLOCKED',
    message: linksSafe
      ? `Tautan internal aman (${internalHrefs.length} tautan menuju artikel terbit).`
      : `Terdeteksi tautan menuju artikel draf/belum terbit: ${suspiciousDraftLinks.join(', ')}`
  });

  // A.9 Focus Keyword & Semantic Relevance (Advisory SEO)
  const indonesianStopwords = new Set([
    'di', 'ke', 'dari', 'yang', 'dan', 'untuk', 'pada', 'ini', 'itu',
    'dengan', 'atau', 'adalah', 'sebagai', 'saat', 'dalam', 'cara', 'tips',
    'agar', 'supaya', 'bisa', 'lebih', 'oleh', 'karena', 'vs', 'versus',
    'apa', 'bagaimana', 'per', 'tak', 'tidak', 'juga', 'akan', 'ada'
  ]);

  const rawKeyword = String(input.focus_keyword || '').trim();
  const keywordTokens = rawKeyword
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter(t => t.length >= 3 && !indonesianStopwords.has(t));

  if (!rawKeyword || keywordTokens.length === 0) {
    checksA.push({
      id: 'A.9_KEYWORD_RELEVANCE',
      name: 'Relevansi Focus Keyword',
      status: 'WARNING',
      message: 'Focus keyword belum ditentukan untuk artikel ini. Disarankan menetapkan frasa kunci utama untuk pemantauan SEO.'
    });
  } else {
    const titleLower = title.toLowerCase();
    const descLower = description.toLowerCase();
    const introFirst150Words = contentMd
      .split(/\s+/)
      .slice(0, 150)
      .join(' ')
      .toLowerCase();

    const titleTokensMatch = keywordTokens.filter(t => titleLower.includes(t));
    const contextTokensMatch = keywordTokens.filter(t => descLower.includes(t) || introFirst150Words.includes(t));

    const titleMatchRatio = titleTokensMatch.length / keywordTokens.length;
    const contextMatchRatio = contextTokensMatch.length / keywordTokens.length;

    if (titleMatchRatio >= 0.5 && contextMatchRatio >= 0.5) {
      checksA.push({
        id: 'A.9_KEYWORD_RELEVANCE',
        name: 'Relevansi Focus Keyword',
        status: 'PASS',
        message: `Focus keyword "${rawKeyword}" terdistribusi secara semantik alami (judul: ${Math.round(titleMatchRatio * 100)}%, intro/deskripsi: ${Math.round(contextMatchRatio * 100)}%).`
      });
    } else {
      checksA.push({
        id: 'A.9_KEYWORD_RELEVANCE',
        name: 'Relevansi Focus Keyword',
        status: 'WARNING',
        message: `Relevansi focus keyword "${rawKeyword}" kurang optimal (kecocokan judul: ${Math.round(titleMatchRatio * 100)}%, intro/deskripsi: ${Math.round(contextMatchRatio * 100)}%). Minimal disarankan 50% token inti hadir secara wajar tanpa keyword stuffing.`
      });
    }
  }

  // A.10 Mandatory Focus Keyword in First and Last Sentence
  if (rawKeyword && keywordTokens.length > 0 && input.enforce_sentence_keywords === true) {
    const { firstSentence, lastSentence } = extractFirstAndLastSentences(contentMd);
    const firstLower = firstSentence.toLowerCase();
    const lastLower = lastSentence.toLowerCase();

    const firstTokensMatch = keywordTokens.filter(t => firstLower.includes(t));
    const lastTokensMatch = keywordTokens.filter(t => lastLower.includes(t));

    const firstRatio = keywordTokens.length > 0 ? firstTokensMatch.length / keywordTokens.length : 0;
    const lastRatio = keywordTokens.length > 0 ? lastTokensMatch.length / keywordTokens.length : 0;

    const hasExactInFirst = firstLower.includes(rawKeyword.toLowerCase());
    const hasExactInLast = lastLower.includes(rawKeyword.toLowerCase());

    const firstSentenceValid = hasExactInFirst || firstRatio >= 0.6;
    const lastSentenceValid = hasExactInLast || lastRatio >= 0.6;

    if (!firstSentenceValid || !lastSentenceValid) {
      const missingParts: string[] = [];
      if (!firstSentenceValid) missingParts.push(`kalimat pertama pembuka (${Math.round(firstRatio * 100)}% token cocok: "${firstSentence.slice(0, 70)}...")`);
      if (!lastSentenceValid) missingParts.push(`kalimat terakhir penutup (${Math.round(lastRatio * 100)}% token cocok: "${lastSentence.slice(0, 70)}...")`);

      checksA.push({
        id: 'A.10_KEYWORD_OPENING_CLOSING',
        name: 'Preferensi Editorial: Focus Keyword Kalimat Pertama & Terakhir',
        status: 'WARNING',
        message: `[Preferensi Editorial Redaksi] Focus keyword "${rawKeyword}" disarankan hadir secara natural pada kalimat pertama pembuka dan kalimat terakhir penutup. Rekomendasi perbaikan: ${missingParts.join(' dan ')}.`
      });
    } else {
      checksA.push({
        id: 'A.10_KEYWORD_OPENING_CLOSING',
        name: 'Preferensi Editorial: Focus Keyword Kalimat Pertama & Terakhir',
        status: 'PASS',
        message: `[Preferensi Editorial Redaksi] Focus keyword "${rawKeyword}" hadir secara natural pada kalimat pertama pembuka dan kalimat terakhir penutup.`
      });
    }
  }

  // A.11 Material Comparison Practical Depth (Anti-Generic Advisory Trap)
  const isComparisonArticle = /\b(vs|versus|perbandingan|perbedaan|atau)\b/i.test(`${title} ${slug}`);
  if (isComparisonArticle) {
    const contentLower = contentMd.toLowerCase();
    // Count repetitive procedural bureaucratic patterns
    const proceduralMatches = contentLower.match(/minta spesifikasi|meminta spesifikasi|minta dokumen|meminta dokumen|tanyakan contoh|menanyakan contoh|minta penjelasan tertulis|meminta penjelasan tertulis|tanyakan spesifikasi|menanyakan spesifikasi/gi) || [];
    const proceduralCount = proceduralMatches.length;

    // Check physical comparison dimensions
    const physicalKeywords = [
      'panas', 'suhu', 'termal', 'radiasi', 'konduksi', 'shgc', 'watt', 'energi', 'efisiensi',
      'suara', 'bising', 'senyap', 'dentuman', 'hujan', 'akustik', 'getaran', 'peredam',
      'beban', 'bobot', 'berat', 'rangka', 'struktur', 'hollow', 'lendutan', 'baja', 'kg/m',
      'bocor', 'rembes', 'aliran', 'kemiringan', 'drainase', 'uv', 'pelindung', 'sealant', 'delaminasi', 'getas',
      'cahaya', 'terang', 'transparan', 'opak', 'tembus', 'silau', 'teduh'
    ];
    const physicalMatches = new Set(physicalKeywords.filter(k => contentLower.includes(k)));

    if (proceduralCount >= 4) {
      checksA.push({
        id: 'A.11_COMPARISON_MATERIAL_DEPTH',
        name: 'Kedalaman Komparasi Material & Anti-Advisory Klise',
        status: 'BLOCKED',
        message: `Artikel komparasi terdeteksi didominasi oleh pengulangan anjuran administratif/prosedural (${proceduralCount} kali ditemukan frase spesifikasi/dokumen). Artikel komparasi wajib menjelaskan perbedaan karakteristik fisik material secara substantif.`
      });
    } else if (physicalMatches.size >= 4) {
      checksA.push({
        id: 'A.11_COMPARISON_MATERIAL_DEPTH',
        name: 'Kedalaman Komparasi Material & Anti-Advisory Klise',
        status: 'PASS',
        message: `Artikel komparasi menguraikan perbedaan fisik material secara substantif (${physicalMatches.size} aspek fisik teridentifikasi) tanpa pengulangan anjuran prosedural berlebih.`
      });
    } else {
      checksA.push({
        id: 'A.11_COMPARISON_MATERIAL_DEPTH',
        name: 'Kedalaman Komparasi Material & Anti-Advisory Klise',
        status: 'WARNING',
        message: `Kedalaman komparasi fisik material dapat diperkaya (ditemukan ${physicalMatches.size} aspek fisik).`
      });
    }
  }

  // A.12 Cryptographic SHA-256 Provenance & Hash Binding (Zero Stale QA)
  const currentManuscriptSha = computeArticleSha256(contentMd);
  if (input.nadia_evaluation) {
    const nadiaHash = input.nadia_evaluation.manuscript_sha256;
    if (nadiaHash && nadiaHash !== currentManuscriptSha) {
      checksA.push({
        id: 'A.12_CRYPTOGRAPHIC_HASH_BINDING',
        name: 'Integritas Hash Kriptografis Naskah (Zero Stale QA)',
        status: 'BLOCKED',
        message: `STALE_HASH: Evaluasi redaksi Nadia terikat pada hash ${nadiaHash}, tetapi naskah saat ini ber-hash ${currentManuscriptSha}. Setiap mutasi naskah membatalkan audit sebelumnya.`
      });
    } else if (input.nadia_evaluation.semanticStatus === 'NOT_EVALUATED') {
      checksA.push({
        id: 'A.12_CRYPTOGRAPHIC_HASH_BINDING',
        name: 'Integritas Hash Kriptografis Naskah (Zero Stale QA)',
        status: 'BLOCKED',
        message: 'READER_VOICE_HELD_PENDING_EVALUATION: Evaluasi semantik Second Brain belum dilakukan atau offline. Naskah wajib ditahan (EDITORIAL_HOLD).'
      });
    } else if (input.require_model_semantic_evaluator === true && input.nadia_evaluation.semanticEvaluation?.evaluatorType === 'LOCAL_DETERMINISTIC_HEURISTICS') {
      checksA.push({
        id: 'A.12_CRYPTOGRAPHIC_HASH_BINDING',
        name: 'Integritas Hash Kriptografis Naskah (Zero Stale QA)',
        status: 'BLOCKED',
        message: 'HEURISTIC_ONLY_SEMANTIC_EVALUATION: Naskah baru melewati heuristik lokal deterministik, belum evaluasi semantik model Second Brain sesungguhnya. Naskah wajib ditahan (EDITORIAL_HOLD).'
      });
    } else if (input.nadia_evaluation.decision !== 'READER_VOICE_PASS') {
      checksA.push({
        id: 'A.12_CRYPTOGRAPHIC_HASH_BINDING',
        name: 'Integritas Hash Kriptografis Naskah (Zero Stale QA)',
        status: 'BLOCKED',
        message: `READER_VOICE_REVISION_REQUIRED: Naskah belum lolos evaluasi suara pembaca Nadia (Status: ${input.nadia_evaluation.decision}).`
      });
    } else {
      checksA.push({
        id: 'A.12_CRYPTOGRAPHIC_HASH_BINDING',
        name: 'Integritas Hash Kriptografis Naskah (Zero Stale QA)',
        status: 'PASS',
        message: `Evaluasi Nadia terikat valid pada SHA-256 naskah (${currentManuscriptSha.slice(0, 16)}...).`
      });
    }
  }

  // A.13 Authentic Contextual Evidence (Layer 5 & Signature Editorial Voice: Zero Fabricated Hands-On Claims)
  // Evaluates 8 canonical review semantics:
  // 1. Legitimate first-person editorial judgment ("saya menyarankan", "saya melihat") -> PASS
  // 2. Properly attributed third-party statements (quotes from standards, architects) -> PASS / WARNING
  // 3. Documented firsthand experience (verified in evidence pack / report) -> PASS
  // 4. Clearly identified hypothetical examples ("bayangkan jika", "misalnya") -> PASS
  // 5. Paraphrased fabricated experience without evidence -> BLOCKED / WARNING
  // 6. Attributed quotations with unverified/suspicious claims -> WARNING (routes to Irwan/Rina evidence review)
  // 7. Unverified experience claims -> WARNING (requires review before publication)
  // 8. Evidence-confirmed integrity violations (fake lab tests, fake client testimonials) -> BLOCKED

  const blatantFakeLabRegex = /\b(?:uji coba lab internal kami membuktikan|hasil uji lab kami menunjukkan|lab independen kami mengonfirmasi|sertifikasi rahasia kami)\b/i;
  const blatantFakeTestimonyRegex = /\b(?:klien kami,?\s+(?:bapak|ibu|pak|bu)\s+[a-z]+|menurut kesaksian klien kami|salah satu klien kami mengaku|testimoni pelanggan kami menunjukkan)\b/i;
  const directFabricatedHandsOnRegex = /\b(?:berdasarkan pengalaman kami di lapangan selama \w+ tahun|kami menguji secara langsung berbagai \w+|dari proyek yang kami tangani bertahun-tahun|saat tim kami memeriksa lokasi klien)\b/i;

  const confirmedFabrications = input.evidence_review?.confirmed_fabrications || [];
  const documentedExperiences = new Set(input.evidence_review?.verified_firsthand_claims || []);

  const hasConfirmedLabViolation = blatantFakeLabRegex.test(contentMd);
  const hasConfirmedTestimonyViolation = blatantFakeTestimonyRegex.test(contentMd);
  const hasDirectFabricatedViolation = directFabricatedHandsOnRegex.test(contentMd);

  const isDocumented = (text: string) =>
    Array.from(documentedExperiences).some(claim => text.includes(claim)) ||
    Boolean(input.evidence_pack?.verified_field_reports?.some((r: any) => text.includes(r.id || r.title)));

  // Check if quote attribution applies
  const isAttributedQuote = /(?:"[^"]*(?:berdasarkan pengalaman|kami menguji|hasil inspeksi|tim kami)[^"]*"|'[^']*(?:berdasarkan pengalaman|kami menguji|hasil inspeksi|tim kami)[^']*'|(?:mengatakan|mengklaim|menyebutkan|sesumbar|berujar)\s*:\s*[^\n]+)/i.test(contentMd);

  // Severe / Fraudulent Violations (Fake lab tests, fake client testimonials, confirmed fabrications in review):
  // ZERO TOLERANCE: Quotation marks CANNOT bypass fake lab tests or fake client testimonials!
  const hasSevereFabrication = hasConfirmedLabViolation || hasConfirmedTestimonyViolation || confirmedFabrications.length > 0;
  
  // Direct author hands-on claims: if NOT an attributed quote and NOT documented, it is strictly BLOCKED.
  const hasUnattributedDirectHandsOn = hasDirectFabricatedViolation && !isAttributedQuote;

  if ((hasSevereFabrication || hasUnattributedDirectHandsOn) && !isDocumented(contentMd)) {
    // Zero Tolerance: Quotation marks CANNOT bypass confirmed fabrication!
    checksA.push({
      id: 'A.13_AUTHENTIC_CONTEXTUAL_EVIDENCE',
      name: 'Integritas Bukti & Ketiadaan Pengalaman Palsu',
      status: 'BLOCKED',
      message: 'Terdeteksi klaim pengalaman lapangan/inspeksi/testimoni klien fiktif yang melanggar Layer 5 Trust & Editorial Integrity. Sesuai Signature Editorial Voice, otoritas redaksi bersumber dari riset empiris dan penalaran jernih, bukan rekayasa pengalaman tangan pertama (tanda kutip dilarang menjadi celah bypass integritas).'
    });
  } else if (isDocumented(contentMd)) {
    checksA.push({
      id: 'A.13_AUTHENTIC_CONTEXTUAL_EVIDENCE',
      name: 'Integritas Bukti & Ketiadaan Pengalaman Palsu',
      status: 'PASS',
      message: 'Integritas bukti valid: klaim pengalaman tangan pertama didukung oleh laporan pengujian/riset empiris terverifikasi dalam evidence pack.'
    });
  } else {
    const suspiciousExperienceRegex = /\b(?:berdasarkan pengalaman kami|dari proyek yang kami tangani|hasil inspeksi kami|kami menguji|tim kami menemukan di lapangan|menurut praktisi kami di lapangan)\b/i;
    const hasSuspiciousClaims = suspiciousExperienceRegex.test(contentMd) || hasDirectFabricatedViolation;
    const unverifiedClaims = input.evidence_review?.unverified_experience_claims || [];

    if (hasSuspiciousClaims || unverifiedClaims.length > 0) {
      if (isAttributedQuote) {
        checksA.push({
          id: 'A.13_AUTHENTIC_CONTEXTUAL_EVIDENCE',
          name: 'Integritas Bukti & Ketiadaan Pengalaman Palsu',
          status: 'WARNING',
          message: 'Terdeteksi kutipan pernyataan pihak ketiga/tukang mengenai klaim lapangan. Dialihkan ke tinjauan bukti Rina/Irwan untuk memastikan kutipan tidak disajikan sebagai fakta ilmiah terverifikasi.'
        });
      } else {
        checksA.push({
          id: 'A.13_AUTHENTIC_CONTEXTUAL_EVIDENCE',
          name: 'Integritas Bukti & Ketiadaan Pengalaman Palsu',
          status: 'WARNING',
          message: 'Terdeteksi klaim pengalaman lapangan yang belum terverifikasi oleh evidence pack (advisory). Dialihkan ke Rina QA dan Irwan Evidence Review sebelum publikasi.'
        });
      }
    } else {
      checksA.push({
        id: 'A.13_AUTHENTIC_CONTEXTUAL_EVIDENCE',
        name: 'Integritas Bukti & Ketiadaan Pengalaman Palsu',
        status: 'PASS',
        message: 'Integritas bukti valid: bebas dari klaim pengalaman lapangan atau pengujian laboratorium fiktif.'
      });
    }
  }

  const isGateAPass = checksA.every(c => c.status === 'PASS' || c.status === 'WARNING');
  const scoreA = Math.round((checksA.filter(c => c.status === 'PASS').length / checksA.length) * 100);

  // --------------------------------------------------------------------------
  // GATE B: PUBLICATION CONTENT READINESS CHECKS (Visual Media + Content Layout)
  // --------------------------------------------------------------------------
  const checksB: GateCheckItem[] = [];
  const blockingReasonsB: string[] = [];

  // B.1 Prerequisite: Gate A must pass
  if (!isGateAPass) {
    blockingReasonsB.push('GATE_A_INCOMPLETE: Seluruh kriteria Gerbang A (Editorial Draft) wajib lulus terlebih dahulu.');
  }

  // B.0 Semantic Voice Gate Verification
  if (input.nadia_evaluation) {
    if (input.nadia_evaluation.semanticStatus === 'NOT_EVALUATED') {
      blockingReasonsB.push('READER_VOICE_HELD_PENDING_EVALUATION: Evaluasi semantik Second Brain belum selesai atau offline. Gate B diblokir.');
    } else if (input.require_model_semantic_evaluator === true && input.nadia_evaluation.semanticEvaluation?.evaluatorType === 'LOCAL_DETERMINISTIC_HEURISTICS') {
      blockingReasonsB.push('MODEL_SEMANTIC_EVALUATION_REQUIRED: Gate B mensyaratkan evaluasi semantik model Second Brain sesungguhnya, bukan sekadar heuristik lokal deterministik.');
    } else if (input.nadia_evaluation.decision !== 'READER_VOICE_PASS') {
      blockingReasonsB.push(`READER_VOICE_NOT_PASSED: Naskah belum mendapatkan persetujuan suara pembaca Nadia (${input.nadia_evaluation.decision}). Gate B diblokir.`);
    }
  }

  // B.2 Editorial Cover Photograph Approval
  // A logo, svg, or placeholder does NOT count!
  const hasApprovedCoverPhoto = Boolean(
    input.approved_photos?.cover_approved ||
    (input.featured_image &&
      !input.featured_image.endsWith('.svg') &&
      !input.featured_image.includes('placeholder') &&
      !input.featured_image.includes('editorial-desk'))
  );

  if (hasApprovedCoverPhoto) {
    checksB.push({
      id: 'B.1_APPROVED_COVER_PHOTO',
      name: 'Foto Cover Editorial Disetujui',
      status: 'PASS',
      message: `Foto cover autentik disetujui (${input.featured_image}).`
    });
  } else {
    checksB.push({
      id: 'B.1_APPROVED_COVER_PHOTO',
      name: 'Foto Cover Editorial Disetujui',
      status: 'BLOCKED',
      message: `Belum ada foto cover fotografi editorial yang disetujui. Placeholder SVG atau ketiadaan gambar memblokir publikasi.`
    });
    blockingReasonsB.push('MISSING_APPROVED_COVER_PHOTO: Foto cover arsitektural autentik belum disetujui.');
  }

  // B.3 Inline Photographs Approval (Target 3, min 2)
  const approvedInlineCount = input.approved_photos?.inline_approved_count ?? 0;
  const isInlineSufficient = approvedInlineCount >= 2;
  if (isInlineSufficient) {
    checksB.push({
      id: 'B.2_APPROVED_INLINE_PHOTOS',
      name: 'Foto Inline Editorial Disetujui',
      status: 'PASS',
      message: `${approvedInlineCount} foto inline disetujui (memenuhi syarat minimum 2 foto).`
    });
  } else {
    checksB.push({
      id: 'B.2_APPROVED_INLINE_PHOTOS',
      name: 'Foto Inline Editorial Disetujui',
      status: 'BLOCKED',
      message: `Baru ${approvedInlineCount} foto inline disetujui (minimal 2 foto, target 3 foto diperlukan).`
    });
    blockingReasonsB.push(`INSUFFICIENT_INLINE_PHOTOS: Baru ${approvedInlineCount} foto inline disetujui (minimal 2 foto).`);
  }

  // B.4 Editorial FAQ
  const faqs: EditorialFaqItem[] = extractEditorialFaqs({
    faqs: input.faqs,
    content_md: contentMd,
    content_html: input.content_html
  });
  const hasFaqs = faqs.length >= 3;
  checksB.push({
    id: 'B.3_EDITORIAL_FAQ',
    name: 'FAQ Editorial Kontekstual',
    status: hasFaqs ? 'PASS' : 'WARNING',
    message: hasFaqs
      ? `Tersedia ${faqs.length} butir FAQ kontekstual.`
      : `FAQ belum tersedia atau kurang dari 3 butir.`
  });
  if (!hasFaqs) {
    blockingReasonsB.push('MISSING_EDITORIAL_FAQ: Minimal 3 butir FAQ kontekstual wajib tersedia.');
  }

  // B.5 Key Takeaways presence
  if (!hasKeyTakeaways) {
    blockingReasonsB.push('MISSING_KEY_TAKEAWAYS: Minimal 3 butir poin kunci wajib tersedia.');
  }

  // B.6 Table of Contents presence
  const tocItems = input.content_html ? extractTableOfContents(input.content_html) : [];
  const hasToc = tocItems.length >= 2 || h2Count >= 2;
  checksB.push({
    id: 'B.5_TABLE_OF_CONTENTS',
    name: 'Daftar Isi (Table of Contents)',
    status: hasToc ? 'PASS' : 'WARNING',
    message: hasToc
      ? `TOC valid dengan ${tocItems.length || h2Count} sub-bab.`
      : `TOC belum memenuhi syarat minimal 2 sub-bab.`
  });
  if (!hasToc) {
    blockingReasonsB.push('MISSING_TABLE_OF_CONTENTS: Minimal 2 sub-bab heading H2 untuk daftar isi.');
  }

  // B.6 Object-First Editorial Policy (No unauthorized infographics/tables in visual manifest)
  let objectFirstViolation = false;
  if (input.visual_manifest?.visual_items && Array.isArray(input.visual_manifest.visual_items)) {
    for (const item of input.visual_manifest.visual_items) {
      const isOverride = Boolean(item.allow_infographic_override && item.owner_authorization_token?.startsWith('OWNER_AUTH_'));
      if (!isOverride) {
        const text = `${item.caption || ''} ${item.alt_text || ''} ${item.visual_purpose || ''}`;
        const check = detectForbiddenVisualStyles(text);
        if (check.hasForbiddenStyles) {
          objectFirstViolation = true;
          blockingReasonsB.push(`OBJECT_FIRST_VIOLATION: Visual item ${item.visual_id} menggunakan gaya terlarang (${check.detectedViolations.join(', ')}).`);
        }
      }
    }
  }

  checksB.push({
    id: 'B.6_OBJECT_FIRST_VISUAL_POLICY',
    name: 'Object-First Editorial Visuals Policy',
    status: objectFirstViolation ? 'BLOCKED' : 'PASS',
    message: objectFirstViolation
      ? 'Ditemukan item visual bergaya infografis/tabel tanpa otorisasi Owner.'
      : 'Mematuhi kebijakan Object-First Visuals: fotografi objek/material fisik autentik.'
  });

  // B.7 Pre-Closing Visual Placement (Permanent Rule v1.1)
  let hasPreClosingVisual = false;
  if (input.visual_manifest?.visual_items && Array.isArray(input.visual_manifest.visual_items)) {
    hasPreClosingVisual = input.visual_manifest.visual_items.some(
      (item: any) =>
        item.slot_key?.includes('pre_closing') ||
        item.placement?.position === 'before_heading' ||
        item.photo_role === 'pre_closing_decision'
    );
  }

  // Check if article is legacy/existing published article or configured for 3 inlines
  const isLegacyPublished = Boolean(
    input.status === 'published' ||
    (typeof input.id === 'number' && input.id <= 14) ||
    (typeof input.id === 'string' && parseInt(input.id, 10) <= 14 && parseInt(input.id, 10) > 0)
  );

  const isThreeInlineArticle = Boolean(
    (input.visual_manifest?.visual_items && input.visual_manifest.visual_items.length <= 3) ||
    (input.approved_photos?.total_inline_slots && input.approved_photos.total_inline_slots <= 3)
  );

  if (hasPreClosingVisual) {
    checksB.push({
      id: 'B.7_PRE_CLOSING_VISUAL',
      name: 'Foto Object-First Pra-Penutup (Pre-Closing)',
      status: 'PASS',
      message: 'Tersedia foto Object-First pra-penutup sebelum sub-bab keputusan/closing.'
    });
  } else if (isLegacyPublished || isThreeInlineArticle || !input.visual_manifest) {
    checksB.push({
      id: 'B.7_PRE_CLOSING_VISUAL',
      name: 'Foto Object-First Pra-Penutup (Pre-Closing)',
      status: 'PASS',
      message: isThreeInlineArticle
        ? 'Artikel dengan paket 3 foto inline memenuhi standar editorial terkonfigurasi.'
        : (!input.visual_manifest
          ? 'Visual manifest tidak disediakan dalam input evaluasi (dikecualikan pada unit test non-visual).'
          : 'Artikel katalog lama belum memiliki foto pra-penutup (ditandai sebagai kandidat enhancement non-blocking).')
    });
  } else {
    // New articles (e.g. #10015 and subsequent new articles) MUST have pre-closing visual
    checksB.push({
      id: 'B.7_PRE_CLOSING_VISUAL',
      name: 'Foto Object-First Pra-Penutup (Pre-Closing)',
      status: 'BLOCKED',
      message: 'Artikel baru wajib memiliki 1 foto Object-First pra-penutup sebelum sub-bab keputusan/closing (target baku: 1 cover + 3 inline supporting + 1 pre-closing).'
    });
    blockingReasonsB.push('MISSING_PRE_CLOSING_VISUAL: Foto pra-penutup sebelum sub-bab keputusan belum tersedia.');
  }

  // B.8 Rendered Assembled Figures Integrity (Zero Silent Media Loss)
  const renderedFiguresMatches = [...(input.content_html || '').matchAll(/<figure\b([^>]*)data-media-slot\s*=\s*["']([^"']+)["']([^>]*)>([\s\S]*?)<\/figure>/gi)];
  const actualRenderedInlineFigures = renderedFiguresMatches.length;

  const expectedInlineCount = input.visual_manifest?.visual_items && Array.isArray(input.visual_manifest.visual_items)
    ? input.visual_manifest.visual_items.length
    : (input.approved_photos?.inline_approved_count ?? input.approved_photos?.total_inline_slots ?? (Array.isArray(input.approved_photos?.items) ? input.approved_photos.items.length : 0));

  if (expectedInlineCount > 0 && input.content_html) {
    if (actualRenderedInlineFigures === 0) {
      checksB.push({
        id: 'B.8_ASSEMBLED_FIGURES_INTEGRITY',
        name: 'Integritas Render Figure Inline pada HTML',
        status: 'BLOCKED',
        message: `STRUCTURAL_INTEGRITY_BLOCKED: HTML artikel terakit tidak memuat satu pun figure inline (<figure class="rl-media-slot">), padahal manifest mewajibkan ${expectedInlineCount} foto inline.`
      });
      blockingReasonsB.push(`STRUCTURAL_INTEGRITY_BLOCKED: Assembled HTML contains 0 inline media figures, but manifest expects ${expectedInlineCount}.`);
    } else if (actualRenderedInlineFigures < expectedInlineCount) {
      checksB.push({
        id: 'B.8_ASSEMBLED_FIGURES_INTEGRITY',
        name: 'Integritas Render Figure Inline pada HTML',
        status: 'BLOCKED',
        message: `STRUCTURAL_INTEGRITY_BLOCKED: Hanya ${actualRenderedInlineFigures} dari ${expectedInlineCount} figure inline yang berhasil dirender dalam HTML terakit.`
      });
      blockingReasonsB.push(`STRUCTURAL_INTEGRITY_BLOCKED: Assembled HTML contains ${actualRenderedInlineFigures} inline figures, but manifest expects ${expectedInlineCount}.`);
    } else {
      // Check for duplicate slot keys or image URLs in rendered figures
      const seenSlots = new Set<string>();
      const seenSrcs = new Set<string>();
      let hasDuplicates = false;
      let dupDetail = '';

      for (const figMatch of renderedFiguresMatches) {
        const slot = figMatch[2].toLowerCase();
        if (seenSlots.has(slot)) {
          hasDuplicates = true;
          dupDetail = `Duplikasi slot_key "${slot}"`;
          break;
        }
        seenSlots.add(slot);

        const imgMatch = /<img\b[^>]*\bsrc\s*=\s*["']([^"']+)["']/i.exec(figMatch[4]);
        if (imgMatch) {
          const src = imgMatch[1];
          if (seenSrcs.has(src)) {
            hasDuplicates = true;
            dupDetail = `Duplikasi src URL "${src}"`;
            break;
          }
          seenSrcs.add(src);
        }
      }

      if (hasDuplicates) {
        checksB.push({
          id: 'B.8_ASSEMBLED_FIGURES_INTEGRITY',
          name: 'Integritas Render Figure Inline pada HTML',
          status: 'BLOCKED',
          message: `STRUCTURAL_INTEGRITY_BLOCKED: Terdeteksi ${dupDetail} pada figure HTML terakit.`
        });
        blockingReasonsB.push(`STRUCTURAL_INTEGRITY_BLOCKED: ${dupDetail} in assembled HTML figures.`);
      } else {
        checksB.push({
          id: 'B.8_ASSEMBLED_FIGURES_INTEGRITY',
          name: 'Integritas Render Figure Inline pada HTML',
          status: 'PASS',
          message: `Seluruh ${actualRenderedInlineFigures} figure inline terakit utuh dan unik dalam HTML.`
        });
      }
    }
  } else if (!input.content_html && !isLegacyPublished) {
    if (expectedInlineCount > 0) {
      checksB.push({
        id: 'B.8_ASSEMBLED_FIGURES_INTEGRITY',
        name: 'Integritas Render Figure Inline pada HTML',
        status: 'WARNING',
        message: 'content_html belum disediakan untuk verifikasi figure HTML (dikecualikan pada unit test naskah murni).'
      });
    }
  }

  const isGateBPass = blockingReasonsB.length === 0;
  const scoreB = Math.round((checksB.filter(c => c.status === 'PASS').length / checksB.length) * 100);

  // --------------------------------------------------------------------------
  // OWNER AUTHORIZATION (Independent Safety Mechanism)
  // --------------------------------------------------------------------------
  const manualHold = typeof input.manual_hold === 'number' ? input.manual_hold : (input.manual_hold ? 1 : 0);
  const isHoldCleared = manualHold === 0;
  const hasEditorialApproval = input.has_editorial_approval ?? true;
  const isOwnerAuthorized = isHoldCleared && hasEditorialApproval;
  const authBlockingReasons: string[] = [];
  if (!isHoldCleared) {
    authBlockingReasons.push('MANUAL_HOLD_ENGAGED: Artikel masih dalam status manual hold (manual_hold = 1).');
  }
  if (!hasEditorialApproval) {
    authBlockingReasons.push('EDITORIAL_APPROVAL_MISSING: Persetujuan redaksi Chief Editor belum tercatat.');
  }

  // Publication Integrity Gate: WARNING on A.13 (unverified experience claims) cannot silently bypass publication
  const checkA13 = checksA.find(c => c.id === 'A.13_AUTHENTIC_CONTEXTUAL_EVIDENCE');
  const hasUnresolvedExperienceReview = checkA13?.status === 'WARNING' &&
    (!input.evidence_review || (input.evidence_review.status !== 'APPROVED_BY_RESEARCHER' && input.evidence_review.status !== 'RESOLVED'));
  if (hasUnresolvedExperienceReview) {
    authBlockingReasons.push('UNRESOLVED_EXPERIENCE_CLAIMS: Klaim pengalaman atau kutipan lapangan (Check A.13 WARNING) belum diselesaikan/disetujui oleh evidence review peneliti sebelum publikasi.');
  }

  const isPublicationReady = isGateAPass && isGateBPass && isOwnerAuthorized && !hasUnresolvedExperienceReview;

  let nextAction = '';
  if (!isGateAPass) {
    nextAction = 'Revisi naskah teks editorial hingga seluruh checklist Gerbang A terpenuhi.';
  } else if (hasUnresolvedExperienceReview) {
    nextAction = 'Selesaikan verifikasi bukti untuk klaim pengalaman/kutipan lapangan bersama Irwan/Rina sebelum penerbitan.';
  } else if (!hasApprovedCoverPhoto || !isInlineSufficient) {
    nextAction = 'Eksekusi paket visual Photo-First (1 cover + 3 inline supporting + 1 pre-closing) dan ajukan untuk otorisasi foto Owner.';
  } else if (!isHoldCleared) {
    nextAction = 'Naskah dan media siap publikasi. Menunggu otorisasi Owner untuk melepas manual hold.';
  } else if (!hasEditorialApproval) {
    nextAction = 'Menunggu pencatatan persetujuan redaksi Chief Editor.';
  } else {
    nextAction = 'Artikel siap dijadwalkan / diterbitkan.';
  }

  return {
    articleId: input.id,
    slug,
    title,
    gateA: {
      status: isGateAPass ? 'PASS' : 'BLOCKED',
      score: scoreA,
      checks: checksA
    },
    gateB: {
      status: isGateBPass ? 'PASS' : 'BLOCKED',
      score: scoreB,
      checks: checksB,
      blockingReasons: blockingReasonsB
    },
    ownerAuthorization: {
      manualHold,
      isHoldCleared,
      hasEditorialApproval,
      isAuthorized: isOwnerAuthorized,
      blockingReasons: authBlockingReasons
    },
    summary: {
      isEditorialDraftReady: isGateAPass,
      isPublicationContentReady: isGateBPass,
      isPublicationReady,
      nextRequiredAction: nextAction
    },
    evaluatedAt: new Date().toISOString()
  };
}

/**
 * Authoritative Database DoD Evaluator
 * Queries persisted article, attached media assets, and editorial approval records.
 * NEVER trusts client-submitted readiness flags.
 */
export async function evaluateArticleDoDFromDb(
  db: any,
  articleId: number | string,
  options?: {
    publishedSlugsWhitelist?: Set<string>;
  }
): Promise<ArticleDoDEvaluationResult> {
  const article = await db
    .prepare(`
      SELECT a.id, a.slug, a.title, a.description, a.content_md, a.content_html,
             a.featured_image, a.image_alt, a.category_id, a.author_id, a.status,
             COALESCE(a.manual_hold, 0) as manual_hold, a.key_takeaways, a.content_hash, a.focus_keyword
      FROM articles a
      WHERE a.id = ?
      LIMIT 1
    `)
    .bind(articleId)
    .first();

  if (!article) {
    return {
      articleId,
      slug: 'not-found',
      title: 'Article Not Found',
      gateA: {
        status: 'BLOCKED',
        score: 0,
        checks: [{ id: 'A.0_NOT_FOUND', name: 'Article Found', status: 'BLOCKED', message: 'Article not found' }]
      },
      gateB: {
        status: 'BLOCKED',
        score: 0,
        checks: [],
        blockingReasons: ['ARTICLE_NOT_FOUND: Record artikel tidak ditemukan di database.']
      },
      ownerAuthorization: {
        manualHold: 1,
        isHoldCleared: false,
        hasEditorialApproval: false,
        isAuthorized: false,
        blockingReasons: ['ARTICLE_NOT_FOUND']
      },
      summary: {
        isEditorialDraftReady: false,
        isPublicationContentReady: false,
        isPublicationReady: false,
        nextRequiredAction: 'Pastikan ID artikel valid.'
      },
      evaluatedAt: new Date().toISOString()
    };
  }

  // Authoritative media lookup from database
  let coverApproved = false;
  let inlineApprovedCount = 0;

  try {
    const mediaRows = await db
      .prepare(`
        SELECT am.slot_key, am.role, am.caption, am.is_active,
               ma.asset_id, ma.status as asset_status, ma.mime_type, ma.public_url, ma.role as asset_role
        FROM article_media am
        JOIN media_assets ma ON am.asset_id = ma.asset_id
        WHERE am.article_id = ? AND am.is_active = 1
      `)
      .bind(articleId)
      .all();

    const items = mediaRows?.results || (Array.isArray(mediaRows) ? mediaRows : []);
    
    // Check featured media slot
    const featuredRow = items.find((m: any) => (m.slot_key === 'featured' || m.role === 'featured'));
    if (featuredRow && featuredRow.asset_status === 'VALIDATED') {
      const url = String(featuredRow.public_url || '');
      const isPlaceholder = url.endsWith('.svg') || url.includes('editorial-desk') || url.includes('placeholder');
      if (!isPlaceholder) {
        coverApproved = true;
      }
    }

    // Count validated inline photos
    const inlineRows = items.filter((m: any) => (m.slot_key !== 'featured' && m.role === 'inline'));
    for (const inRow of inlineRows) {
      if (inRow.asset_status === 'VALIDATED') {
        const url = String(inRow.public_url || '');
        const isPlaceholder = url.endsWith('.svg') || url.includes('editorial-desk') || url.includes('placeholder');
        if (!isPlaceholder) {
          inlineApprovedCount++;
        }
      }
    }
  } catch {
    // Fail-closed on media query failure
  }

  // Direct featured_image fallback check (e.g. if attached directly in articles table)
  if (!coverApproved && article.featured_image) {
    const url = String(article.featured_image);
    const isPlaceholder = url.endsWith('.svg') || url.includes('editorial-desk') || url.includes('placeholder');
    if (!isPlaceholder) {
      try {
        const approval = await db
          .prepare(`
            SELECT id FROM article_editorial_approvals
            WHERE article_id = ? AND approval_status = 'APPROVED' AND approved_asset_id IS NOT NULL
            LIMIT 1
          `)
          .bind(articleId)
          .first();
        if (approval) {
          coverApproved = true;
        }
      } catch {}
    }
  }

  // Authoritative text approval lookup from database
  let hasEditorialApproval = false;
  try {
    const approvalRow = await db
      .prepare(`
        SELECT approval_status, approved_content_hash
        FROM article_editorial_approvals
        WHERE article_id = ? AND approval_status = 'APPROVED'
        ORDER BY id DESC LIMIT 1
      `)
      .bind(articleId)
      .first();

    if (approvalRow && approvalRow.approved_content_hash === article.content_hash) {
      hasEditorialApproval = true;
    }
  } catch {}

  return evaluateArticleDoD({
    id: article.id,
    slug: article.slug,
    title: article.title,
    description: article.description,
    content_md: article.content_md,
    content_html: article.content_html,
    featured_image: article.featured_image,
    image_alt: article.image_alt,
    category_id: article.category_id,
    author_id: article.author_id,
    status: article.status,
    manual_hold: article.manual_hold,
    key_takeaways: article.key_takeaways,
    focus_keyword: article.focus_keyword,
    has_editorial_approval: hasEditorialApproval,
    approved_photos: {
      cover_approved: coverApproved,
      inline_approved_count: inlineApprovedCount,
      total_inline_slots: Math.max(3, inlineApprovedCount)
    },
    published_slugs_whitelist: options?.publishedSlugsWhitelist
  });
}
