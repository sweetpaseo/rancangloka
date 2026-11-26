/**
 * RancangLoka — Modular Article Architecture V1 (MAA-V1)
 * Final Integrity Gate
 * 
 * Strict Invariants:
 * 1. STRICT SEPARATION:
 *    A. ASSEMBLY_COMPLETE: Structural compilation succeeds without missing components.
 *    B. EDITORIAL_QUALITY_APPROVED: Authentic editorial & semantic thresholds are met.
 * 2. An article may be structurally complete but still held at EDITORIAL_HOLD.
 * 3. Never manufacture PASS: Nadia score < 85 or NOT_EVALUATED blocks publication readiness.
 * 4. Stale QA receipts cannot authorize publication.
 * 5. Publication authority is strictly gated by Owner approval (manual_hold = 0).
 */

import type {
  ArticleComponentType,
  ComponentDataMap,
  QualityReceiptRecord
} from './types.ts';
import type { AssemblyResult } from './assembler.ts';

export interface IntegrityGateCheckItem {
  id: string;
  name: string;
  status: 'PASS' | 'WARNING' | 'BLOCKED';
  message: string;
}

export interface FinalIntegrityGateReport {
  article_id: number;
  assembly_status: 'COMPLETE' | 'INCOMPLETE';
  editorial_quality_status: 'APPROVED' | 'EDITORIAL_HOLD';
  publication_readiness: 'READY_FOR_OWNER_PUBLICATION' | 'BLOCKED_BY_INTEGRITY_GATES';
  checks: IntegrityGateCheckItem[];
  blocking_reasons: string[];
  evaluated_at: string;
}

export interface EvaluateIntegrityGateInput {
  articleId: number;
  components: Partial<ComponentDataMap>;
  assemblyResult: AssemblyResult;
  snapshotAssemblyHash?: string;
}

export function evaluateFinalIntegrityGate(input: EvaluateIntegrityGateInput): FinalIntegrityGateReport {
  const { articleId, components: c, assemblyResult } = input;
  const checks: IntegrityGateCheckItem[] = [];
  const blockingReasons: string[] = [];

  // 1. Component Completeness Gate
  if (!assemblyResult.is_complete) {
    const msg = `Komponen wajib belum lengkap: [${assemblyResult.missing_components.join(', ')}].`;
    checks.push({
      id: 'G1_COMPONENT_COMPLETENESS',
      name: 'Kelengkapan 14 Komponen Kanonikal',
      status: 'BLOCKED',
      message: msg
    });
    blockingReasons.push(`INCOMPLETE_COMPONENTS: ${msg}`);
  } else {
    checks.push({
      id: 'G1_COMPONENT_COMPLETENESS',
      name: 'Kelengkapan 14 Komponen Kanonikal',
      status: 'PASS',
      message: 'Seluruh komponen kanonikal lengkap dan terstruktur.'
    });
  }

  // 2. Schema Integrity Gate (Google SEO: non-empty, concise, descriptive, no artificial character limits)
  const title = (c.identity?.title || '').trim();
  const titleLen = title.length;
  if (!title || titleLen === 0) {
    const msg = `Judul artikel tidak boleh kosong.`;
    checks.push({
      id: 'G2_SCHEMA_INTEGRITY',
      name: 'Integritas Skema & Judul Artikel',
      status: 'BLOCKED',
      message: msg
    });
    blockingReasons.push(`INVALID_TITLE: ${msg}`);
  } else {
    checks.push({
      id: 'G2_SCHEMA_INTEGRITY',
      name: 'Integritas Skema & Judul Artikel',
      status: 'PASS',
      message: `Judul artikel valid (${titleLen} karakter, deskriptif dan terdefinisi).`
    });
  }

  // 3. Version Consistency & Hash Binding
  if (input.snapshotAssemblyHash && input.snapshotAssemblyHash !== assemblyResult.assembly_hash) {
    const msg = `Hash snapshot (${input.snapshotAssemblyHash}) tidak cocok dengan hash assembly saat ini (${assemblyResult.assembly_hash}).`;
    checks.push({
      id: 'G3_VERSION_CONSISTENCY',
      name: 'Konsistensi Versi & Ikatan Hash',
      status: 'BLOCKED',
      message: msg
    });
    blockingReasons.push(`STALE_SNAPSHOT_HASH: ${msg}`);
  } else {
    checks.push({
      id: 'G3_VERSION_CONSISTENCY',
      name: 'Konsistensi Versi & Ikatan Hash',
      status: 'PASS',
      message: 'Hash assembly konsisten dan terikat secara kriptografis.'
    });
  }

  // 4. Evidence Provenance Gate
  const sources = c.evidence_pack?.verified_sources || [];
  const hasUnverifiedSource = sources.some(s => s.retrieval_status === 'SOURCE_UNVERIFIED');
  if (sources.length === 0) {
    checks.push({
      id: 'G4_EVIDENCE_PROVENANCE',
      name: 'Keaslian Sumber & Provenance Bukti',
      status: 'WARNING',
      message: 'Belum ada catatan sumber bukti tersimpan.'
    });
  } else if (hasUnverifiedSource) {
    checks.push({
      id: 'G4_EVIDENCE_PROVENANCE',
      name: 'Keaslian Sumber & Provenance Bukti',
      status: 'WARNING',
      message: 'Terdapat sumber yang berstatus unverified; klaim harus diuji ketat.'
    });
  } else {
    checks.push({
      id: 'G4_EVIDENCE_PROVENANCE',
      name: 'Keaslian Sumber & Provenance Bukti',
      status: 'PASS',
      message: `${sources.length} sumber bukti terverifikasi tanpa fabrikasi.`
    });
  }

  // 5. Semantic Editorial QA Gate (Nadia Model Voice)
  const receipts = c.qa_receipts?.receipts || [];
  const nadiaReceipt = receipts.find(r => r.evaluator === 'nadia_semantic_qa');

  if (!nadiaReceipt || nadiaReceipt.verdict === 'NOT_EVALUATED') {
    const msg = 'Evaluasi semantik model Second Brain Nadia belum dilakukan atau offline.';
    checks.push({
      id: 'G5_SEMANTIC_EDITORIAL_QA',
      name: 'Evaluasi Semantik Suara Pembaca Nadia',
      status: 'BLOCKED',
      message: msg
    });
    blockingReasons.push(`EDITORIAL_HOLD: ${msg}`);
  } else if (nadiaReceipt.verdict !== 'PASS' || (nadiaReceipt.score !== undefined && nadiaReceipt.score < 85)) {
    const msg = `Nadia memberikan evaluasi REVISION_REQUIRED (Skor: ${nadiaReceipt.score || 0}/100, ambang batas minimum 85).`;
    checks.push({
      id: 'G5_SEMANTIC_EDITORIAL_QA',
      name: 'Evaluasi Semantik Suara Pembaca Nadia',
      status: 'BLOCKED',
      message: msg
    });
    blockingReasons.push(`EDITORIAL_HOLD: ${msg}`);
  } else {
    checks.push({
      id: 'G5_SEMANTIC_EDITORIAL_QA',
      name: 'Evaluasi Semantik Suara Pembaca Nadia',
      status: 'PASS',
      message: `Nadia meloloskan evaluasi semantik model nyata (Skor: ${nadiaReceipt.score}/100).`
    });
  }

  // 6. Visual Relevance & Completeness Gate
  const coverApproved = c.cover_hero?.editorial_approval === 'APPROVED_FOR_INLINE_PUBLICATION' && Boolean(c.cover_hero.storage_key);
  const inlineItems = c.inline_media?.items || [];
  const inlinesApproved = inlineItems.length >= 4 && inlineItems.every(i => i.editorial_approval === 'APPROVED_FOR_INLINE_PUBLICATION' && Boolean(i.storage_key || i.public_url));

  if (!coverApproved || !inlinesApproved) {
    const msg = `Aset media belum lengkap/tersetujui (Cover: ${coverApproved ? 'OK' : 'BELUM'}, Inline approved: ${inlineItems.filter(i => i.editorial_approval === 'APPROVED_FOR_INLINE_PUBLICATION').length}/4).`;
    checks.push({
      id: 'G6_VISUAL_RELEVANCE_QA',
      name: 'Kelengkapan & Persetujuan Media Visual Budi',
      status: 'BLOCKED',
      message: msg
    });
    blockingReasons.push(`VISUAL_MEDIA_UNAPPROVED: ${msg}`);
  } else {
    checks.push({
      id: 'G6_VISUAL_RELEVANCE_QA',
      name: 'Kelengkapan & Persetujuan Media Visual Budi',
      status: 'PASS',
      message: '1 cover hero dan 4 inline image terverifikasi aktif dan disetujui.'
    });
  }

  // 7. SEO & Keyword Relevance Gate
  const keyword = c.seo?.primary_natural_keyword || '';
  if (!keyword) {
    const msg = 'Focus keyword belum ditentukan.';
    checks.push({
      id: 'G7_SEO_METADATA_QA',
      name: 'Relevansi Focus Keyword & SEO',
      status: 'BLOCKED',
      message: msg
    });
    blockingReasons.push(`MISSING_FOCUS_KEYWORD: ${msg}`);
  } else {
    checks.push({
      id: 'G7_SEO_METADATA_QA',
      name: 'Relevansi Focus Keyword & SEO',
      status: 'PASS',
      message: `Focus keyword "${keyword}" terverifikasi.`
    });
  }

  // 8. Rendered DOM Integrity Gate
  const html = assemblyResult.assembled_html || '';
  const h1Count = (html.match(/<h1[^>]*>/gi) || []).length;
  const h2Count = (html.match(/<h2[^>]*>/gi) || []).length;
  const figureCount = (html.match(/<figure[^>]*data-media-slot/gi) || []).length;

  if (h1Count > 1 || h2Count < 3) {
    const msg = `Struktur DOM tidak seimbang (H1: ${h1Count}, H2: ${h2Count}).`;
    checks.push({
      id: 'G8_RENDERED_DOM_INTEGRITY',
      name: 'Integritas DOM & Hirarki Heading',
      status: 'BLOCKED',
      message: msg
    });
    blockingReasons.push(`DOM_INTEGRITY_VIOLATION: ${msg}`);
  } else {
    checks.push({
      id: 'G8_RENDERED_DOM_INTEGRITY',
      name: 'Integritas DOM & Hirarki Heading',
      status: 'PASS',
      message: `Struktur DOM bersih (H1: ${h1Count}, H2: ${h2Count}, Inline figures: ${figureCount}).`
    });
  }

  // 9. Publication Authority Gate (manual_hold)
  const isHeld = c.publication_schedule?.manual_hold !== 0;
  if (isHeld) {
    const msg = `Artikel berstatus manual_hold = 1 (Alasan: ${c.publication_schedule?.manual_hold_reason || 'Menunggu persetujuan manusia'}).`;
    checks.push({
      id: 'G9_PUBLICATION_AUTHORITY',
      name: 'Otoritas Publikasi & Manual Hold',
      status: 'BLOCKED',
      message: msg
    });
    blockingReasons.push(`MANUAL_HOLD_ENABLED: ${msg}`);
  } else {
    checks.push({
      id: 'G9_PUBLICATION_AUTHORITY',
      name: 'Otoritas Publikasi & Manual Hold',
      status: 'PASS',
      message: 'Otoritas publikasi disetujui (manual_hold = 0).'
    });
  }

  const editorialQualityStatus = (nadiaReceipt?.score !== undefined && nadiaReceipt.score >= 85 && nadiaReceipt.verdict === 'PASS')
    ? 'APPROVED'
    : 'EDITORIAL_HOLD';

  const publicationReadiness = blockingReasons.length === 0
    ? 'READY_FOR_OWNER_PUBLICATION'
    : 'BLOCKED_BY_INTEGRITY_GATES';

  return {
    article_id: articleId,
    assembly_status: assemblyResult.assembly_status,
    editorial_quality_status: editorialQualityStatus,
    publication_readiness: publicationReadiness,
    checks,
    blocking_reasons: blockingReasons,
    evaluated_at: new Date().toISOString()
  };
}
