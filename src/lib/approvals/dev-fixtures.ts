/**
 * RancangLoka — DEV Visual Approval Fixtures
 * Milestone: APPROVAL-INBOX-V1 & BATCH-1-LOCAL-PREVIEW
 *
 * Isolated DEV-only fixtures for local visual reviews and Batch 1 manuscript inspection.
 *
 * Invariants:
 * 1. ZERO PRODUCTION LEAK: Strictly guarded by import.meta.env.DEV check.
 * 2. ZERO D1 WRITES: In-memory and local filesystem only; zero database mutations.
 * 3. NO ACCIDENTAL APPROVAL: Fixtures carry synthetic IDs and are prohibited from production approval routes.
 * 4. PURE PROJECTION TRUTH: Canonical production projection never emits fixtures.
 */

import type { ApprovalInboxItem } from './types.ts';

export interface DevLocalBatch1Article {
  id: string;
  rawId: string;
  slug: string;
  title: string;
  description: string;
  content_md: string;
  content_html?: string;
  category_id: number;
  category_name: string;
  category_slug: string;
  category_color: string;
  author_id: number;
  author_name: string;
  author_avatar: string;
  author_role: string;
  status: 'draft';
  is_local_fixture: true;
  fixture_batch: 'BATCH_1';
  job_id: string;
  canonical_id?: number;
  qa_score: number;
  qa_status: string;
  local_source_path: string;
  key_takeaways: string;
  reading_time_minutes: number;
  created_at: string;
  updated_at: string;
  focus_keyword?: string;
  visual_manifest?: any;
}

export const BATCH_1_DEFINITIONS = [
  {
    jobId: 'JOB-01-ARTICLE-4-REHAB',
    canonicalId: 4,
    slug: 'perbedaan-atap-metal-dan-genteng-beton-untuk-rumah-tropis',
    title: 'Atap Metal vs Genteng Beton: Mana yang Cocok untuk Rumah Tropis?',
    description: 'Panduan teknis arsitektur komparasi mendalam antara atap metal dan genteng beton untuk rumah tropis Indonesia.',
    filePath: 'scripts/content-bootstrap/article-4-rehab/article-4-editorial-candidate-v3.md',
    qaScore: 89.0,
    qaStatus: 'PASS',
    categoryId: 3,
    categoryName: 'Arsitektur & Renovasi',
    categorySlug: 'arsitektur-renovasi',
    categoryColor: '#d97706',
    authorId: 1,
    authorName: 'RancangLoka Editorial Desk',
    authorRole: 'Dewan Redaksi Spasial',
    authorAvatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80',
    waitingHours: 6,
    focusKeyword: 'atap metal vs genteng beton',
    manifestPath: 'scripts/content-bootstrap/manifests/article-4-visual-manifest.json',
    keyTakeaways: [
      'Material atap metal memiliki bobot sangat ringan (±5 kg/m²), memangkas beban struktur rangka atap secara signifikan.',
      'Genteng beton memiliki massa jenis tinggi yang unggul meredam kebisingan hujan lebat dan menahan panas radiasi matahari siang.',
      'Ventilasi rongga loteng dan celah insulasi di bawah penutup atap jauh lebih krusial menentukan kenyamanan termal daripada jenis penutup semata.'
    ]
  },
  {
    jobId: 'JOB-02-MOISTURE-WALL',
    canonicalId: undefined,
    slug: 'dinding-rembes-dan-cat-menggelembung-cara-membedakan-masalah-talang-plesteran-kelembapan-tanah',
    title: 'Dinding Rembes dan Cat Menggelembung: Cara Membedakan Masalah Talang, Plesteran, dan Kelembapan Tanah',
    description: 'Panduan diagnosis sistematis 6 tahap membedakan masalah talang, rembesan plesteran, dan kapilaritas air tanah (rising damp) pada rumah tinggal.',
    filePath: 'scripts/content-bootstrap/batch-1/job-02-moisture-wall/job-02-moisture-wall-draft.md',
    qaScore: 89.5,
    qaStatus: 'PASS',
    categoryId: 8,
    categoryName: 'Sistem & Konstruksi Rumah',
    categorySlug: 'sistem-konstruksi-rumah',
    categoryColor: '#ea580c',
    authorId: 2,
    authorName: 'RancangLoka Research Desk',
    authorRole: 'Editor Spesifikasi & Material',
    authorAvatar: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150&auto=format&fit=crop&q=80',
    waitingHours: 4,
    focusKeyword: 'dinding rembes cat menggelembung',
    manifestPath: 'scripts/content-bootstrap/manifests/job-02-visual-manifest.json',
    keyTakeaways: [
      'Cat menggelembung adalah gejala visual tekanan uap air di dalam pori plesteran, bukan sekadar kerusakan permukaan cat.',
      'Rising damp membutuhkan diagnosis komparatif kelembapan tanah vs instalasi pipa air kotor/bersih yang bocor.',
      'Perbaikan kosmetik tanpa menangani sumber kelembapan utama dipastikan akan rusak kembali dalam hitungan bulan.'
    ]
  },
  {
    jobId: 'JOB-03-INTERIOR-SPATIAL',
    canonicalId: undefined,
    slug: 'menata-denah-rumah-lebar-5-6-meter-solusi-sirkulasi-bukaan-ruang-tengah-tidak-pengap',
    title: 'Menata Denah Rumah Lebar 5–6 Meter: Solusi Sirkulasi dan Bukaan agar Ruang Tengah Tidak Pengap',
    description: 'Solusi arsitektur menata sirkulasi udara, pencahayaan alami, dan bukaan ventilasi SNI pada kaveling rumah lebar 5–6 meter tanpa membahayakan struktur.',
    filePath: 'scripts/content-bootstrap/batch-1/job-03-interior-spatial/job-03-interior-spatial-draft.md',
    qaScore: 90.5,
    qaStatus: 'PASS',
    categoryId: 6,
    categoryName: 'Kenyamanan Rumah',
    categorySlug: 'kenyamanan-rumah',
    categoryColor: '#16a34a',
    authorId: 1,
    authorName: 'RancangLoka Editorial Desk',
    authorRole: 'Dewan Redaksi Spasial',
    authorAvatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80',
    waitingHours: 2,
    focusKeyword: 'denah rumah lebar 5 meter ventilasi',
    manifestPath: 'scripts/content-bootstrap/manifests/job-03-visual-manifest.json',
    keyTakeaways: [
      'Menutup total pekarangan belakang memicu fenomena tunnel effect yang mematikan aliran ventilasi silang ruang tengah.',
      'SNI 03-6572-2001 mensyaratkan bukaan ventilasi alami minimal 5% dari luas lantai ruangan yang dihuni.',
      'Inner court atau void vertikal dengan bukaan buang atas menciptakan perbedaan tekanan udara yang menarik udara segar masuk secara pasif.'
    ]
  },
  {
    jobId: 'JOB-ARTICLE-C-APPROVED',
    canonicalId: 9,
    slug: 'memilih-sistem-shading-luar-rumah-tropis',
    title: 'Memilih Peneduh Luar untuk Rumah Tropis: Overhang, Louver, Awning, atau Secondary Facade?',
    description: 'Panduan memilih peneduh luar rumah tropis: komparasi overhang, louver, awning, dan secondary facade berdasarkan arah matahari, ventilasi, beban struktur, dan perawatan.',
    filePath: 'scripts/content-bootstrap/trials/article-c-mobile-formatted-candidate.md',
    qaScore: 98.0,
    qaStatus: 'PASS',
    categoryId: 3,
    categoryName: 'Arsitektur & Renovasi',
    categorySlug: 'arsitektur-renovasi',
    categoryColor: '#d97706',
    authorId: 1,
    authorName: 'RancangLoka Editorial Desk',
    authorRole: 'Dewan Redaksi Spasial',
    authorAvatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80',
    waitingHours: 1,
    focusKeyword: 'peneduh luar rumah tropis',
    manifestPath: 'scripts/content-bootstrap/manifests/article-c-visual-manifest.json',
    keyTakeaways: [
      'Peneduh luar bekerja mencegat radiasi matahari sebelum menyentuh kaca atau dinding, jauh lebih efektif daripada tirai atau gorden di sisi dalam.',
      'Bentuk dan orientasi peneduh wajib disesuaikan dengan posisi matahari: overhang untuk matahari sudut tinggi, sedangkan louver vertikal krusial untuk matahari sudut rendah di sisi barat dan timur.',
      'Secondary facade dan peneduh berat di lantai atas membutuhkan perhitungan beban struktur dan akses perawatan berkala, bukan sekadar tempelan dekoratif.'
    ]
  }
];

/**
 * Returns visual approval fixtures for local dev testing, prioritizing Batch 1 drafts.
 * Strictly in-memory, zero D1 writes.
 */
export function getDevApprovalFixtures(nowMs: number = Date.now()): ApprovalInboxItem[] {
  const batch1Items: ApprovalInboxItem[] = BATCH_1_DEFINITIONS.map((def) => {
    const rawId = `fixture-batch1-${def.jobId.toLowerCase()}`;
    const waitingSince = new Date(nowMs - def.waitingHours * 3600 * 1000).toISOString();
    return {
      id: `article:${rawId}`,
      rawId,
      type: 'article',
      typeLabel: 'Artikel (Batch 1)',
      title: def.title,
      slug: def.slug,
      workflowStage: `Editorial Approval (${def.jobId})`,
      previousGates: `Irwan ✓ Joko ✓ Nadia ✓ Rina ✓ (QA ${def.qaScore.toFixed(1)})`,
      waitingSince,
      waitingAgeFormatted: `${def.waitingHours} jam`,
      requiredActor: 'Chief Editor',
      status: 'PENDING',
      statusLabel: 'Menunggu Review',
      notes: `Batch 1 local benchmark draft (${def.jobId}). Preserved locally without regeneration.`,
      detailUrl: `/admin/preview/${def.slug}`,
      metadata: {
        is_local_fixture: true,
        fixture_batch: 'BATCH_1',
        job_id: def.jobId,
        canonical_id: def.canonicalId,
        canonical_slug: def.slug,
        qa_score: def.qaScore,
        qa_status: def.qaStatus
      }
    };
  });

  return [
    ...batch1Items,
    {
      id: 'media:dev-med-1',
      rawId: 'dev-med-1',
      type: 'media',
      typeLabel: 'Promosi Media',
      title: 'Foto Utama Shading Kanopi Beton Fasad Barat',
      slug: 'rumah-tropis-yang-tidak-takut-matahari',
      workflowStage: 'Media Dual-Control Review',
      previousGates: 'Device Budi ✓',
      waitingSince: new Date(nowMs - 3 * 3600 * 1000).toISOString(),
      waitingAgeFormatted: '3 jam',
      requiredActor: 'Chief Editor / Admin',
      status: 'PENDING',
      statusLabel: 'Menunggu',
      notes: null,
      detailUrl: '/admin/preview/rumah-tropis-yang-tidak-takut-matahari?review_media=dev-med-1',
      metadata: { slot_key: 'featured', device_id: 'budi-macbook' }
    }
  ];
}

/**
 * Evaluates whether current runtime is local development.
 * In Vite/Astro builds, import.meta.env.DEV is statically inlined.
 * In standalone Node/test runner, falls back to NODE_ENV !== 'production'.
 */
function isDevEnvironment(): boolean {
  if (typeof import.meta !== 'undefined' && (import.meta as any).env?.DEV !== undefined) {
    return Boolean((import.meta as any).env.DEV);
  }
  return typeof process !== 'undefined' && process.env?.NODE_ENV !== 'production';
}

/**
 * Attaches DEV visual fixtures ONLY in local development.
 * Automatically deduplicates against any real items already in the projection.
 */
export function injectDevVisualFixturesIfEligible(items: ApprovalInboxItem[], nowMs?: number): ApprovalInboxItem[] {
  if (!isDevEnvironment()) {
    return items;
  }
  const devNow = nowMs || Date.now();
  const existingSlugs = new Set(items.map((i) => i.slug));
  const fixturesToAdd = getDevApprovalFixtures(devNow).filter(
    (fixture) => !existingSlugs.has(fixture.slug)
  );
  return [...items, ...fixturesToAdd];
}

/**
 * Loads a Batch 1 local markdown manuscript directly from disk for preview in dev mode.
 * Returns null if not in DEV or if slug does not match Batch 1.
 */
export async function getDevLocalBatch1Article(slug: string): Promise<DevLocalBatch1Article | null> {
  if (!isDevEnvironment() || !slug) {
    return null;
  }

  const def = BATCH_1_DEFINITIONS.find((d) => d.slug === slug);
  if (!def) {
    return null;
  }

  let contentMd = '';
  try {
    if (typeof process !== 'undefined' && process.versions?.node) {
      const fsModName = 'node' + ':fs';
      const pathModName = 'node' + ':path';
      const fs = await import(/* @vite-ignore */ fsModName);
      const path = await import(/* @vite-ignore */ pathModName);
      const fullPath = path.resolve(process.cwd(), def.filePath);
      if (fs.existsSync(fullPath)) {
        contentMd = fs.readFileSync(fullPath, 'utf8');
      }
    }
  } catch (err) {
    console.warn(`[DevFixtures] Could not read Batch 1 draft at ${def.filePath}:`, err);
  }

  if (!contentMd) {
    return null;
  }

  const words = contentMd.trim().split(/\s+/).length;
  const readingTime = Math.max(3, Math.ceil(words / 200));
  const nowIso = new Date().toISOString();

  let visualManifest: any = null;
  try {
    if (def.manifestPath && typeof process !== 'undefined' && process.versions?.node) {
      const fsModName = 'node' + ':fs';
      const pathModName = 'node' + ':path';
      const fs = await import(/* @vite-ignore */ fsModName);
      const path = await import(/* @vite-ignore */ pathModName);
      const fullManifestPath = path.resolve(process.cwd(), def.manifestPath);
      if (fs.existsSync(fullManifestPath)) {
        visualManifest = JSON.parse(fs.readFileSync(fullManifestPath, 'utf8'));
      }
    }
  } catch (err) {
    console.warn(`[DevFixtures] Could not read visual manifest at ${def.manifestPath}:`, err);
  }

  return {
    id: `fixture-batch1-${def.jobId.toLowerCase()}`,
    rawId: `fixture-batch1-${def.jobId.toLowerCase()}`,
    slug: def.slug,
    title: def.title,
    description: def.description,
    content_md: contentMd,
    category_id: def.categoryId,
    category_name: def.categoryName,
    category_slug: def.categorySlug,
    category_color: def.categoryColor,
    author_id: def.authorId,
    author_name: def.authorName,
    author_avatar: def.authorAvatar,
    author_role: def.authorRole,
    status: 'draft',
    is_local_fixture: true,
    fixture_batch: 'BATCH_1',
    job_id: def.jobId,
    canonical_id: def.canonicalId,
    qa_score: def.qaScore,
    qa_status: def.qaStatus,
    local_source_path: def.filePath,
    key_takeaways: JSON.stringify(def.keyTakeaways),
    reading_time_minutes: readingTime,
    created_at: nowIso,
    updated_at: nowIso,
    focus_keyword: def.focusKeyword,
    visual_manifest: visualManifest
  };
}

export function getBatch1ManifestPath(slugOrId: string | number): string | null {
  const match = BATCH_1_DEFINITIONS.find(
    (d) => d.slug === slugOrId || d.canonicalId === Number(slugOrId) || d.jobId === slugOrId
  );
  return match?.manifestPath || null;
}

