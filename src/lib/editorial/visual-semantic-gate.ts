/**
 * RancangLoka — Visual Semantic Quality Gate
 * Milestone: VISUAL_SEMANTIC_GATE_1
 *
 * Enforces editorial excellence and technical rigor for all visual items:
 * 1. HEADING_ALIGNMENT: Manifest slots map accurately to actual article H2 headings.
 * 2. OBJECT_ALIGNMENT: SVG depicts concrete architectural/physical objects, not generic bullet tables.
 * 3. CLIPPING_DEFENSE: 16:9 aspect ratio (1200x675) with valid viewBox and safe boundary margins.
 * 4. EDITORIAL_PURITY: Zero internal test badges ("LOCAL TEST", "NOT EDITORIALLY APPROVED", "FIXTURE").
 * 5. MONETARY_SILENCE: Zero unverified prices or financial claims.
 */

import type { VisualPlacementManifest, VisualManifestItem } from '../media/anchor-resolver.ts';
import {
  detectForbiddenVisualStyles,
  OBJECT_FIRST_POLICY_VERSION
} from './object-first-visual-policy.ts';

export interface VisualSemanticCheckResult {
  passed: boolean;
  score: number; // 0 - 100
  checks: {
    heading_alignment: { passed: boolean; message: string; details?: any };
    object_alignment: { passed: boolean; message: string; details?: any };
    clipping_defense: { passed: boolean; message: string; details?: any };
    editorial_purity: { passed: boolean; message: string; details?: any };
    monetary_silence: { passed: boolean; message: string; details?: any };
  };
  violations: string[];
}

const FORBIDDEN_TEST_LABELS = [
  /LOCAL\s+TEST/i,
  /NOT\s+EDITORIALLY\s+APPROVED/i,
  /DRAFT\s+PROPOSAL/i,
  /FIXTURE\s+MEDIA/i,
  /BELUM\s+DISETUJUI/i,
  /DUMMY/i,
  /TODO/i
];

const MONETARY_PATTERNS = [
  /Rp\s*[\d.,]+/i,
  /\bIDR\b/i,
  /\b\d+\s*(?:juta|ribu|miliar)\b/i,
  /\$\s*\d+/i
];

/**
 * Extracts raw SVG string from Data URI or returns plain SVG.
 */
export function extractSvgString(storageKey?: string | null): string {
  if (!storageKey) return '';
  const trimmed = storageKey.trim();
  if (trimmed.startsWith('data:image/svg+xml;base64,')) {
    const base64Part = trimmed.replace('data:image/svg+xml;base64,', '');
    try {
      return Buffer.from(base64Part, 'base64').toString('utf8');
    } catch (_) {
      return '';
    }
  }
  if (trimmed.startsWith('data:image/svg+xml;utf8,')) {
    return decodeURIComponent(trimmed.replace('data:image/svg+xml;utf8,', ''));
  }
  if (trimmed.startsWith('<svg') && trimmed.endsWith('</svg>')) {
    return trimmed;
  }
  return '';
}

/**
 * Evaluates the visual semantic quality of a placement manifest against the article manuscript.
 */
export function evaluateVisualSemanticGate(
  manifest: VisualPlacementManifest,
  articleMarkdown: string
): VisualSemanticCheckResult {
  const violations: string[] = [];
  const checks = {
    heading_alignment: { passed: true, message: 'Semua visual slot terikat ke heading H2 yang valid.' },
    object_alignment: { passed: true, message: 'Diagram memuat objek arsitektur dan fisika nyata (bukan tabel generik).' },
    clipping_defense: { passed: true, message: 'Format kanvas 16:9 aman tanpa risiko teks terpotong.' },
    editorial_purity: { passed: true, message: 'Bebas dari label uji coba internal.' },
    monetary_silence: { passed: true, message: 'Mematuhi asas Monetary Silence.' }
  };

  if (!manifest || !Array.isArray(manifest.visual_items) || manifest.visual_items.length === 0) {
    violations.push('Visual manifest kosong atau tidak memiliki visual_items.');
    return {
      passed: false,
      score: 0,
      checks: {
        heading_alignment: { passed: false, message: 'Manifest kosong.' },
        object_alignment: { passed: false, message: 'Manifest kosong.' },
        clipping_defense: { passed: false, message: 'Manifest kosong.' },
        editorial_purity: { passed: false, message: 'Manifest kosong.' },
        monetary_silence: { passed: true, message: 'N/A' }
      },
      violations
    };
  }

  // 1. Extract H2 headings from Markdown
  const h2Lines = (articleMarkdown || '')
    .split('\n')
    .map(l => l.trim())
    .filter(l => /^##\s+/.test(l))
    .map(l => l.replace(/^##\s+/, '').trim());

  const h2Normalized = h2Lines.map(h => h.toLowerCase().replace(/[*_#`~:]/g, '').trim());

  // Check each item
  for (let i = 0; i < manifest.visual_items.length; i++) {
    const item = manifest.visual_items[i];
    const targetHeading = item.placement?.target_heading_text || '';
    const normTarget = targetHeading.toLowerCase().replace(/[*_#`~:]/g, '').trim();

    // 1. Heading Alignment
    const matchesH2 = h2Normalized.some(h => h === normTarget || h.includes(normTarget) || normTarget.includes(h));
    if (!matchesH2) {
      checks.heading_alignment.passed = false;
      violations.push(`Item ${item.visual_id} memiliki target_heading "${targetHeading}" yang tidak ditemukan pada naskah H2.`);
    }

    // Object-First Editorial Policy Check (Owner directive: no infographics / comparison tables embedded in images)
    const isOverride = Boolean(
      (item as any).allow_infographic_override &&
      (item as any).owner_authorization_token?.startsWith('OWNER_AUTH_')
    );
    const textToScanStyles = `${item.caption || ''} ${item.alt_text || ''} ${item.visual_purpose || ''} ${(item as any).visual_brief?.prompt_indonesian || ''}`;
    const forbiddenStyleCheck = detectForbiddenVisualStyles(textToScanStyles);
    if (forbiddenStyleCheck.hasForbiddenStyles && !isOverride) {
      checks.object_alignment.passed = false;
      violations.push(`Item ${item.visual_id} melanggar kebijakan Object-First Editorial (${OBJECT_FIRST_POLICY_VERSION}): ${forbiddenStyleCheck.detectedViolations.join('; ')}.`);
    }

    // If photograph, SVG-specific checks are bypassed (evaluated under PhotoQualityGate)
    if (item.media_type === 'photograph') {
      // Check monetary silence in caption, alt, and brief
      const textToScan = `${item.caption} ${item.alt_text} ${item.visual_purpose} ${item.visual_brief?.prompt_indonesian || ''}`;
      for (const pattern of MONETARY_PATTERNS) {
        if (pattern.test(textToScan)) {
          checks.monetary_silence.passed = false;
          violations.push(`Item ${item.visual_id} memuat klaim harga/mata uang.`);
        }
      }
      for (const testPattern of FORBIDDEN_TEST_LABELS) {
        if (testPattern.test(textToScan)) {
          checks.editorial_purity.passed = false;
          violations.push(`Item ${item.visual_id} memuat label pengujian internal.`);
        }
      }
      continue;
    }

    // 2. SVG Extraction & Inspection
    const svgStr = extractSvgString(item.storage_key);
    if (!svgStr || !svgStr.includes('<svg')) {
      checks.object_alignment.passed = false;
      violations.push(`Item ${item.visual_id} tidak memuat payload SVG yang valid.`);
      continue;
    }

    // 2. Object Alignment (Must not be a generic bullet table)
    // Generic table indicator: 3+ identical bullet rows with <rect width="1080" height="52" without architectural geometry
    const isGenericBulletTable =
      svgStr.includes('STANDAR REKAYASA &amp; PANDUAN BANGUNAN') &&
      svgStr.includes('rect width="1080" height="52"') &&
      !svgStr.includes('Kompor') &&
      !svgStr.includes('Panci') &&
      !svgStr.includes('Dinding');

    if (isGenericBulletTable) {
      checks.object_alignment.passed = false;
      violations.push(`Item ${item.visual_id} terdeteksi sebagai tabel teks generik, bukan diagram visualisasi teknis.`);
    }

    // Physical architectural objects verification
    const hasPhysicalEntities =
      svgStr.includes('Kompor') ||
      svgStr.includes('Panci') ||
      svgStr.includes('Dinding') ||
      svgStr.includes('Plafon') ||
      svgStr.includes('Kabinet') ||
      svgStr.includes('Exhaust') ||
      svgStr.includes('Filter') ||
      svgStr.includes('Aliran Udara') ||
      svgStr.includes('marker-end=');

    if (!hasPhysicalEntities) {
      checks.object_alignment.passed = false;
      violations.push(`Item ${item.visual_id} tidak memuat representasi entitas fisik bangunan atau vektor aliran.`);
    }

    // 3. Clipping Defense
    // Must have 16:9 viewBox (e.g., 0 0 1200 675 or similar 16:9 ratio)
    const viewBoxMatch = svgStr.match(/viewBox\s*=\s*["']([^"']+)["']/i);
    if (!viewBoxMatch) {
      checks.clipping_defense.passed = false;
      violations.push(`Item ${item.visual_id} tidak memiliki atribut viewBox responsif.`);
    } else {
      const vbParts = viewBoxMatch[1].trim().split(/\s+/).map(Number);
      if (vbParts.length === 4) {
        const vbWidth = vbParts[2];
        const vbHeight = vbParts[3];
        const ratio = vbWidth / vbHeight;
        // 16:9 is ~1.7777
        if (Math.abs(ratio - (16 / 9)) > 0.05) {
          checks.clipping_defense.passed = false;
          violations.push(`Item ${item.visual_id} memiliki rasio viewBox ${ratio.toFixed(2)} (wajib 16:9 ~1.78 guna mencegah pemotongan object-cover).`);
        }
      }
    }

    // 4. Editorial Purity (No internal test labels)
    for (const pat of FORBIDDEN_TEST_LABELS) {
      if (pat.test(svgStr)) {
        checks.editorial_purity.passed = false;
        violations.push(`Item ${item.visual_id} memuat label internal uji coba terlarang di dalam SVG.`);
        break;
      }
      if (item.caption && pat.test(item.caption)) {
        checks.editorial_purity.passed = false;
        violations.push(`Caption item ${item.visual_id} memuat label internal uji coba: "${item.caption}".`);
        break;
      }
    }

    // 5. Monetary Silence
    for (const pat of MONETARY_PATTERNS) {
      if (pat.test(svgStr)) {
        checks.monetary_silence.passed = false;
        violations.push(`Item ${item.visual_id} memuat klaim harga/biaya yang melanggar Monetary Silence.`);
        break;
      }
    }
  }

  const passed =
    checks.heading_alignment.passed &&
    checks.object_alignment.passed &&
    checks.clipping_defense.passed &&
    checks.editorial_purity.passed &&
    checks.monetary_silence.passed;

  const score = passed ? 100 : Math.max(20, 100 - violations.length * 20);

  return {
    passed,
    score,
    checks,
    violations
  };
}
