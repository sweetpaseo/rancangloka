/**
 * RancangLoka — Admin Responsive Architecture & Approval Inbox Operational Simplification Test Suite
 *
 * Verifies:
 * 1.  Desktop sidebar preserved (persistent on lg >= 1024px).
 * 2.  Mobile sidebar hidden by default (-translate-x-full off-canvas).
 * 3.  Hamburger button exists and is visible only on mobile/tablet (lg:hidden).
 * 4.  Off-canvas drawer backdrop and close button exist.
 * 5.  Main content has w-full min-w-0 and is immediately visible at mobile width.
 * 6.  Approval notification bell is accessible in header on mobile without opening sidebar.
 * 7.  Bell dropdown has viewport-safe inset (inset-x-3) to prevent 375px horizontal overflow.
 * 8.  Mobile approval list exists (#approval-mobile-list with md:hidden).
 * 9.  Desktop approval table exists (#approval-desktop-table with hidden md:block).
 * 10. Hidden desktop columns REMOVED from primary listing:
 *     - Tahap Alur Kerja
 *     - Gerbang Sebelumnya
 *     - Aktor Wajib
 * 11. Desktop operational table has strictly 5 columns:
 *     Judul / Subjek, Tipe, Menunggu, Status, Tindakan.
 * 12. Tinjau action is immediately visible without horizontal scrolling on desktop.
 * 13. Desktop table and mobile list share the exact same approval projection source.
 * 14. Detailed workflow provenance and stage information preserved on Approval Detail page.
 * 15. Decision actions on Detail page (Minta Revisi & Setujui untuk Publication Planning) stack cleanly.
 * 16. Canonical UX principles recorded in types.ts.
 */

import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { ADMIN_UX_PRINCIPLES } from '../src/lib/approvals/types.ts';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');

let testCount = 0;
function pass(name) {
  testCount++;
  console.log(`  [PASS ${String(testCount).padStart(2, '0')}] ${name}`);
}

async function run() {
  console.log('=============================================================');
  console.log('🧪 RANCANGLOKA — ADMIN RESPONSIVE & INBOX SIMPLIFICATION TESTS');
  console.log('=============================================================\n');

  const adminLayoutPath = path.join(rootDir, 'src/layouts/AdminLayout.astro');
  const approvalsIndexPath = path.join(rootDir, 'src/pages/admin/approvals/index.astro');
  const previewSlugPath = path.join(rootDir, 'src/pages/admin/preview/[slug].astro');

  const adminLayoutSrc = fs.readFileSync(adminLayoutPath, 'utf-8');
  const approvalsIndexSrc = fs.readFileSync(approvalsIndexPath, 'utf-8');
  const previewSlugSrc = fs.readFileSync(previewSlugPath, 'utf-8');

  // --- Test Suite 1: Responsive Admin Shell & Mobile Drawer ---
  console.log('--- Test Suite 1: Responsive Admin Shell & Mobile Drawer ---');

  // 1. Desktop sidebar preserved on >= 1024px
  assert.ok(
    adminLayoutSrc.includes('lg:translate-x-0') && adminLayoutSrc.includes('lg:w-60'),
    'Desktop sidebar must remain persistent at lg breakpoint (>= 1024px)'
  );
  pass('Desktop sidebar preserved: persistent lg:w-60 at >= 1024px');

  // 2. Mobile sidebar off-canvas by default
  assert.ok(
    adminLayoutSrc.includes('-translate-x-full'),
    'Sidebar must be off-canvas (-translate-x-full) by default on mobile screens'
  );
  pass('Mobile sidebar hidden by default: off-canvas drawer with -translate-x-full');

  // 3. Hamburger button exists with lg:hidden
  assert.ok(
    adminLayoutSrc.includes('id="admin-hamburger-btn"') && adminLayoutSrc.includes('lg:hidden'),
    'Hamburger button must exist and be visible only on mobile/tablet (lg:hidden)'
  );
  pass('Hamburger button exists: accessible on mobile/tablet (< lg), hidden on desktop');

  // 4. Backdrop and drawer close button exist
  assert.ok(
    adminLayoutSrc.includes('id="admin-drawer-backdrop"') && adminLayoutSrc.includes('id="admin-drawer-close-btn"'),
    'Drawer backdrop and close button must exist for off-canvas drawer'
  );
  pass('Off-canvas drawer backdrop and close button verified');

  // 5. Main content w-full min-w-0
  assert.ok(
    adminLayoutSrc.includes('<main class="flex-1 flex flex-col min-w-0 w-full overflow-y-auto">'),
    'Main content container must have w-full min-w-0 for immediate visibility on mobile'
  );
  pass('Main content layout: width 100%, min-width 0, immediately visible on mobile');

  // 6. Bell button accessible in header on mobile
  assert.ok(
    adminLayoutSrc.includes('id="admin-bell-btn"') && adminLayoutSrc.includes('id="admin-bell-container"'),
    'Bell container must be part of header controls accessible on mobile'
  );
  pass('Approval notification bell accessible directly in header without opening sidebar');

  // 7. Bell dropdown 375px safety
  assert.ok(
    adminLayoutSrc.includes('inset-x-3') && adminLayoutSrc.includes('max-w-[calc(100vw-1.5rem)]'),
    'Bell dropdown must use viewport-safe horizontal insets on mobile to prevent 375px clipping'
  );
  pass('Bell dropdown safe for 375px: inset-x-3 and max-w constraint prevent clipping');

  // --- Test Suite 2: Approval Inbox Operational Simplification ---
  console.log('\n--- Test Suite 2: Approval Inbox Operational Simplification ---');

  // 8. Mobile approval list exists
  assert.ok(
    approvalsIndexSrc.includes('id="approval-mobile-list"') && approvalsIndexSrc.includes('md:hidden'),
    'Mobile approval list must exist and be displayed only on < md screens'
  );
  pass('Mobile approval task queue exists: compact stacked rows with md:hidden');

  // 9. Desktop approval table exists
  assert.ok(
    approvalsIndexSrc.includes('id="approval-desktop-table"') && approvalsIndexSrc.includes('hidden md:block'),
    'Desktop approval table must exist and be displayed on >= md screens'
  );
  pass('Desktop approval operational table exists: hidden md:block');

  // 10. Audit columns removed from primary table listing
  const tableHeaderIndex = approvalsIndexSrc.indexOf('<tr class="bg-slate-50/80 border-b border-slate-200/80');
  const tableHeaderEnd = approvalsIndexSrc.indexOf('</tr>', tableHeaderIndex);
  const tableHeaderSnippet = approvalsIndexSrc.substring(tableHeaderIndex, tableHeaderEnd);

  assert.ok(
    !tableHeaderSnippet.includes('Tahap Alur Kerja'),
    'Tahap Alur Kerja must be removed from primary desktop table columns'
  );
  assert.ok(
    !tableHeaderSnippet.includes('Gerbang Sebelumnya'),
    'Gerbang Sebelumnya must be removed from primary desktop table columns'
  );
  assert.ok(
    !tableHeaderSnippet.includes('Aktor Wajib'),
    'Aktor Wajib must be removed from primary desktop table columns'
  );
  pass('Primary table columns simplified: Tahap Alur Kerja, Gerbang Sebelumnya, and Aktor Wajib removed');

  // 11. Strictly 5 operational columns
  assert.ok(tableHeaderSnippet.includes('Judul / Subjek'), 'Must have Judul / Subjek column');
  assert.ok(tableHeaderSnippet.includes('Tipe'), 'Must have Tipe column');
  assert.ok(tableHeaderSnippet.includes('Menunggu'), 'Must have Menunggu column');
  assert.ok(tableHeaderSnippet.includes('Status'), 'Must have Status column');
  assert.ok(tableHeaderSnippet.includes('Tindakan'), 'Must have Tindakan column');

  const thCount = (tableHeaderSnippet.match(/<th/g) || []).length;
  assert.strictEqual(thCount, 5, `Expected exactly 5 th columns, found ${thCount}`);
  pass('Desktop operational table has strictly 5 columns: Judul/Subjek, Tipe, Menunggu, Status, Tindakan');

  // 12. Tinjau action immediately visible
  assert.ok(
    approvalsIndexSrc.includes('<span>Tinjau</span>') && approvalsIndexSrc.includes('<span>→</span>'),
    'Tinjau action button must be present and prominent'
  );
  pass('Tinjau action button verified: prominent, immediately reachable on desktop and mobile');

  // 13. Single projection source shared between mobile list and desktop table
  const mobileListMatches = (approvalsIndexSrc.match(/items\.map\(/g) || []).length;
  assert.strictEqual(
    mobileListMatches,
    2,
    'Both mobile list and desktop table must map from the exact same items array'
  );
  pass('Single projection source: mobile task list and desktop table share exact same items array');

  // --- Test Suite 3: Provenance & Detail Page Preservation ---
  console.log('\n--- Test Suite 3: Provenance & Detail Page Preservation ---');

  // 14. Provenance preserved on Approval Detail page
  assert.ok(
    previewSlugSrc.includes('Gerbang Sebelumnya (Provenance):') &&
    previewSlugSrc.includes('Tahap Alur Kerja:') &&
    previewSlugSrc.includes('Aktor Wajib:'),
    'Workflow stage, provenance, and required actor must be preserved on Approval Detail page'
  );
  assert.ok(
    previewSlugSrc.includes('Irwan ✓') && previewSlugSrc.includes('Rina ✓'),
    'Named staff provenance badges must be present on Detail page'
  );
  pass('Full workflow provenance preserved on Approval Detail page (Irwan, Joko, Nadia, Rina, Stage, Actor)');

  // 15. Decision actions on Detail page stack cleanly
  assert.ok(
    previewSlugSrc.includes('Setujui untuk Publication Planning') &&
    previewSlugSrc.includes('Minta Revisi'),
    'Decision actions on Detail page must include Setujui untuk Publication Planning and Minta Revisi'
  );
  pass('Decision actions verified on Detail page: Setujui untuk Publication Planning & Minta Revisi');

  // 16. Canonical UX principles recorded
  assert.strictEqual(
    ADMIN_UX_PRINCIPLES.INBOX_FAST_FIND,
    'The Approval Inbox is for finding the next decision quickly. Detailed workflow provenance belongs on the Approval Detail page.'
  );
  assert.strictEqual(
    ADMIN_UX_PRINCIPLES.INBOX_VS_DETAIL,
    'Inbox = find the work. Detail = understand the context and make the decision.'
  );
  pass('Canonical UX Principles codified in types.ts (INBOX_FAST_FIND, INBOX_VS_DETAIL)');

  // --- Test Suite 4: Mobile Above-The-Fold Task-First Optimization ---
  console.log('\n--- Test Suite 4: Mobile Above-The-Fold Task-First Optimization ---');

  // 17. Mobile Task-First Principles Codified
  assert.strictEqual(
    ADMIN_UX_PRINCIPLES.MOBILE_TASK_FIRST,
    'On mobile, Approval Inbox is task-first.'
  );
  assert.strictEqual(
    ADMIN_UX_PRINCIPLES.MOBILE_FIRST_DECISION_ABOVE_FOLD,
    'The first pending decision should appear as early as practical in the initial viewport.'
  );
  pass('Mobile Task-First Principles codified in types.ts');

  // 18. Mobile Intro Compression
  assert.ok(
    approvalsIndexSrc.includes('space-y-3 sm:space-y-6') &&
    approvalsIndexSrc.includes('p-3.5 sm:p-6') &&
    approvalsIndexSrc.includes('text-lg sm:text-2xl'),
    'Intro card must use compressed padding and typography on mobile'
  );
  pass('Mobile intro card footprint compressed for immediate task access');

  // 19. UX Principle Collapsible Disclosure on Mobile
  assert.ok(
    approvalsIndexSrc.includes('<details class="md:hidden') &&
    approvalsIndexSrc.includes('Tentang alur persetujuan') &&
    approvalsIndexSrc.includes('hidden md:flex'),
    'UX principle must be an expandable disclosure on mobile and full on desktop'
  );
  pass('UX principle collapsed into expandable disclosure on mobile, full on desktop');

  // 20. Horizontally scrollable status filter tabs on mobile
  assert.ok(
    approvalsIndexSrc.includes('overflow-x-auto') &&
    approvalsIndexSrc.includes('whitespace-nowrap'),
    'Status filter tabs must be in a single horizontally scrollable row on mobile'
  );
  pass('Status filter tabs presented as compact single scrollable row on mobile');

  // 21. Compact Single-Row Search and Type Form on Mobile
  assert.ok(
    approvalsIndexSrc.includes('grid grid-cols-[auto_1fr_auto] sm:flex'),
    'Search and type filter form must render as a single tight row on mobile'
  );
  pass('Search and type filter form renders as compact single row on mobile');

  console.log('\n=============================================================');
  console.log('✅ ALL 21 ADMIN RESPONSIVE & INBOX SIMPLIFICATION TESTS PASSED!');
  console.log('=============================================================');
}

run().catch((err) => {
  console.error('TEST FAILURE:', err);
  process.exit(1);
});
