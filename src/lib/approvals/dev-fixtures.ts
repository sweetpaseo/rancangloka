/**
 * RancangLoka — DEV Visual Approval Fixtures
 * Milestone: APPROVAL-INBOX-V1
 *
 * Isolated DEV-only mock fixtures for local visual reviews.
 *
 * Invariants:
 * 1. ZERO PRODUCTION LEAK: Strictly guarded by import.meta.env.DEV check.
 * 2. ZERO D1 WRITES: In-memory only; no database mutations.
 * 3. STEP ASIDE: If real pending approvals exist, DEV fixtures step aside completely.
 * 4. PURE PROJECTION TRUTH: Canonical production projection never emits fixtures.
 */

import type { ApprovalInboxItem } from './types.ts';

/**
 * Returns 5 realistic visual approval fixtures for local dev testing.
 * Strictly in-memory, zero D1 writes.
 */
export function getDevApprovalFixtures(nowMs: number = Date.now()): ApprovalInboxItem[] {
  return [
    {
      id: 'media:dev-med-3',
      rawId: 'dev-med-3',
      type: 'media',
      typeLabel: 'Promosi Media',
      title: 'Infografis Drainase Dinding Penahan Tanah',
      slug: 'rumah-tropis-yang-tidak-takut-matahari',
      workflowStage: 'Media Dual-Control Review',
      previousGates: 'Device Budi ✓',
      waitingSince: new Date(nowMs - 48 * 3600 * 1000).toISOString(),
      waitingAgeFormatted: '2 hari',
      requiredActor: 'Chief Editor / Admin',
      status: 'PENDING',
      statusLabel: 'Menunggu',
      notes: null,
      detailUrl: '/admin/preview/rumah-tropis-yang-tidak-takut-matahari?review_media=dev-med-3',
      metadata: { slot_key: 'infographic', device_id: 'budi-macbook' }
    },
    {
      id: 'media:dev-med-2',
      rawId: 'dev-med-2',
      type: 'media',
      typeLabel: 'Promosi Media',
      title: 'Diagram Teknis Insulasi Atap Ruang Tidur',
      slug: 'rumah-tropis-yang-tidak-takut-matahari',
      workflowStage: 'Media Dual-Control Review',
      previousGates: 'Device Budi ✓',
      waitingSince: new Date(nowMs - 24 * 3600 * 1000).toISOString(),
      waitingAgeFormatted: '1 hari',
      requiredActor: 'Chief Editor / Admin',
      status: 'PENDING',
      statusLabel: 'Menunggu',
      notes: null,
      detailUrl: '/admin/preview/rumah-tropis-yang-tidak-takut-matahari?review_media=dev-med-2',
      metadata: { slot_key: 'technical_diagram', device_id: 'budi-macbook' }
    },
    {
      id: 'article:dev-art-2',
      rawId: 'dev-art-2',
      type: 'article',
      typeLabel: 'Artikel',
      title: 'Roster Tanah Liat vs Beton Cetak: Komparasi Termal & Biaya',
      slug: 'rumah-tropis-yang-tidak-takut-matahari',
      workflowStage: 'Editorial Approval',
      previousGates: 'Evidence ✓ Authoring ✓ Reader Voice ✓ Editorial QA ✓',
      waitingSince: new Date(nowMs - 5 * 3600 * 1000).toISOString(),
      waitingAgeFormatted: '5 jam',
      requiredActor: 'Chief Editor',
      status: 'PENDING',
      statusLabel: 'Menunggu',
      notes: null,
      detailUrl: '/admin/preview/rumah-tropis-yang-tidak-takut-matahari',
      metadata: { is_generic_provenance: true }
    },
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
    },
    {
      id: 'article:dev-art-1',
      rawId: 'dev-art-1',
      type: 'article',
      typeLabel: 'Artikel',
      title: 'Ventilasi Silang Alami pada Rumah Tropis Modern',
      slug: 'rumah-tropis-yang-tidak-takut-matahari',
      workflowStage: 'Editorial Approval',
      previousGates: 'Irwan ✓ Joko ✓ Nadia ✓ Rina ✓',
      waitingSince: new Date(nowMs - 2 * 3600 * 1000).toISOString(),
      waitingAgeFormatted: '2 jam',
      requiredActor: 'Chief Editor',
      status: 'PENDING',
      statusLabel: 'Menunggu',
      notes: null,
      detailUrl: '/admin/preview/rumah-tropis-yang-tidak-takut-matahari',
      metadata: { has_named_staff_provenance: true }
    }
  ];
}

/**
 * Attaches DEV visual fixtures ONLY in local development when:
 * 1. Environment is strictly DEV (import.meta.env.DEV === true)
 * 2. Real pending actions count is exactly zero (steps aside when real pending items exist)
 * 3. Never active in production builds.
 */
export function injectDevVisualFixturesIfEligible(items: ApprovalInboxItem[], nowMs?: number): ApprovalInboxItem[] {
  const isDev = typeof import.meta !== 'undefined' && Boolean((import.meta as any).env?.DEV);
  if (!isDev) {
    return items;
  }
  const hasRealPending = items.some((i) => i.status === 'PENDING');
  if (hasRealPending) {
    return items;
  }
  const devNow = nowMs || Date.now();
  return [...items, ...getDevApprovalFixtures(devNow)];
}
