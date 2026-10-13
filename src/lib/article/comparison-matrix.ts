/**
 * RancangLoka Reusable Zero-JS Responsive Comparison Matrix Enhancer
 * Milestone: ARTICLE-C-COMPARISON-FINAL-VISUAL-CALIBRATION
 *
 * Reader Experience Principle:
 * "A comparison component should reduce the reader's thinking effort,
 * not merely display the same information in a grid.
 * The reader should be able to identify a likely option within several seconds."
 *
 * Transforms semantic comparison markdown tables into a dual-view responsive presentation:
 * - Desktop (>= 1024px / lg): High-clarity editorial decision matrix with generous column breathing room,
 *   subtle visual hierarchy for key decision criteria, and desktop container breakout (1000–1150px).
 * - Tablet (768px - 1023px / md): 2-column responsive decision cards grid for comfortable readability.
 * - Mobile (< 768px): 1-column stacked decision cards grid (one card per option) preventing horizontal page overflow.
 *
 * Strict Invariants:
 * 1. SINGLE SOURCE OF TRUTH: Both desktop table and mobile/tablet cards are derived purely from the single semantic table.
 * 2. ZERO CLIENT JAVASCRIPT: 100% server-side HTML + Tailwind responsive classes. No runtime JS required.
 * 3. ACCESSIBILITY: Semantic table headers (scope="col", scope="row"), card headings (h4), visible attribute labels.
 * 4. INTENTIONAL IDENTIFICATION: Only tables with >= 3 columns whose first header matches comparison/aspect keywords
 *    (or has class comparison-matrix) are enhanced. Standard 2-column tables and generic data tables remain untouched.
 * 5. SANITIZER INTEGRITY: Generates only tags and attributes present in ARTICLE_HTML_WHITELIST.
 */

export interface ComparisonMatrixRow {
  aspect: string;
  values: string[];
}

export interface ComparisonMatrixData {
  aspectHeader: string;
  options: string[];
  rows: ComparisonMatrixRow[];
}

/**
 * Canonical patterns for key decision rows that deserve subtle visual prioritization.
 * Prioritizes fundamental architectural & practical fit:
 * 1. Cocok untuk arah (primary solar/orientation fit)
 * 2. Matahari sore (critical low-angle west sun factor)
 * 3. Pemasangan rumah jadi (retrofit / installation feasibility)
 * 4. Perawatan (maintenance effort & lifecycle upkeep)
 */
const KEY_DECISION_PATTERNS = [
  /cocok\s+(?:untuk\s+)?arah/i,
  /matahari\s+sore/i,
  /pemasangan/i,
  /perawatan/i,
];

/**
 * Checks whether an aspect row represents a primary decision factor.
 */
export function isKeyDecisionRow(aspectText: string): boolean {
  if (!aspectText || typeof aspectText !== 'string') return false;
  const clean = aspectText.toLowerCase().replace(/<[^>]+>/g, '').trim();
  return KEY_DECISION_PATTERNS.some((p) => p.test(clean));
}

/**
 * Checks whether an HTML table represents a comparison matrix rather than a standard data table.
 */
export function isComparisonMatrixTable(tableHtml: string): boolean {
  if (!tableHtml || typeof tableHtml !== 'string') return false;

  // Explicit marker or class
  if (/class="[^"]*comparison-matrix[^"]*"/i.test(tableHtml) || /data-comparison-matrix/i.test(tableHtml)) {
    return true;
  }

  const theadMatch = tableHtml.match(/<thead>[\s\S]*?<\/thead>/i);
  if (!theadMatch) return false;

  const thMatches = Array.from(theadMatch[0].matchAll(/<th[^>]*>([\s\S]*?)<\/th>/gi)).map((m) => m[1].trim());
  if (thMatches.length < 3) return false; // Need at least 3 columns (1 aspect + at least 2 options)

  const rawFirstTh = thMatches[0].replace(/<[^>]+>/g, '').trim();
  const isAspectHeader = /^(?:aspek|kriteria|parameter|fitur|perbandingan|komparasi|pertimbangan)(?:\s+[\w\s]+)?$/i.test(
    rawFirstTh
  );

  return isAspectHeader;
}

/**
 * Parses a semantic HTML table into structured ComparisonMatrixData.
 */
export function parseComparisonMatrixTable(tableHtml: string): ComparisonMatrixData | null {
  const theadMatch = tableHtml.match(/<thead>[\s\S]*?<\/thead>/i);
  if (!theadMatch) return null;

  const thMatches = Array.from(theadMatch[0].matchAll(/<th[^>]*>([\s\S]*?)<\/th>/gi)).map((m) => m[1].trim());
  if (thMatches.length < 3) return null;

  const aspectHeader = thMatches[0].replace(/<[^>]+>/g, '').trim();
  const options = thMatches.slice(1);

  const tbodyMatch = tableHtml.match(/<tbody>([\s\S]*?)<\/tbody>/i);
  if (!tbodyMatch) return null;

  const rows: ComparisonMatrixRow[] = [];
  const trMatches = Array.from(tbodyMatch[1].matchAll(/<tr[^>]*>([\s\S]*?)<\/tr>/gi));

  for (const tr of trMatches) {
    const tdMatches = Array.from(tr[1].matchAll(/<td[^>]*>([\s\S]*?)<\/td>/gi)).map((m) => m[1].trim());
    if (tdMatches.length >= 2) {
      const rawAspect = tdMatches[0];
      const values = tdMatches.slice(1);
      // Clean up bold tags inside aspect if present
      const cleanAspect = rawAspect.replace(/^<strong>(.*)<\/strong>$/i, '$1').trim();
      rows.push({ aspect: cleanAspect, values });
    }
  }

  if (rows.length < 2) return null;

  return { aspectHeader, options, rows };
}

/**
 * Renders the Desktop comparison table (>= 1024px / hidden lg:block).
 * Enhanced with:
 * - Generous column breathing room and cell padding (py-4 px-5)
 * - Clear editorial header with Option pills
 * - Subtle visual prioritization on key decision rows (font weight, warm tint, accent border, dot indicator)
 * - Accessible scope="col" and scope="row"
 */
export function renderDesktopComparisonTable(data: ComparisonMatrixData): string {
  const { aspectHeader, options, rows } = data;

  const headerCells = options
    .map((opt, optIdx) => {
      const cleanTitle = opt.replace(/<[^>]+>/g, '').replace(/^\d+\.\s*/, '').trim();
      return `<th scope="col" class="py-4 px-5 text-left border-l border-slate-200/70 dark:border-slate-800/80 align-top w-1/5 bg-slate-50/60 dark:bg-slate-800/40">
  <div class="space-y-1">
    <span class="inline-flex items-center text-[10px] font-mono font-bold px-2 py-0.5 rounded-md bg-primary/10 text-primary border border-primary/20 uppercase tracking-wider">
      Pilihan #${optIdx + 1}
    </span>
    <div class="font-display font-bold text-sm text-slate-900 dark:text-white leading-snug">
      ${cleanTitle}
    </div>
  </div>
</th>`;
    })
    .join('\n');

  const bodyRows = rows
    .map((r) => {
      const isKey = isKeyDecisionRow(r.aspect);

      const valueCells = r.values
        .map((val) => {
          if (isKey) {
            return `<td class="py-4 px-5 text-[13px] font-medium text-slate-800 dark:text-slate-100 border-l border-slate-200/50 dark:border-slate-800/60 leading-relaxed align-top">
  ${val}
</td>`;
          }
          return `<td class="py-3.5 px-5 text-xs text-slate-600 dark:text-slate-300 border-l border-slate-100 dark:border-slate-800/40 leading-relaxed align-top">
  ${val}
</td>`;
        })
        .join('\n');

      if (isKey) {
        return `<tr class="bg-amber-500/[0.035] dark:bg-amber-500/[0.06] hover:bg-amber-500/[0.07] dark:hover:bg-amber-500/[0.09] transition-colors border-l-2 border-primary/80">
  <th scope="row" class="py-4 px-5 align-top bg-amber-500/[0.06] dark:bg-amber-500/[0.09] text-left">
    <div class="flex items-start gap-2">
      <span class="mt-1.5 w-1.5 h-1.5 rounded-full bg-primary shrink-0"></span>
      <div>
        <span class="font-bold text-[13px] text-slate-900 dark:text-white block leading-snug">${r.aspect}</span>
        <span class="text-[10px] font-mono font-semibold text-primary dark:text-primary-light tracking-wide block mt-0.5 uppercase">Kriteria Kunci</span>
      </div>
    </div>
  </th>
  ${valueCells}
</tr>`;
      }

      return `<tr class="hover:bg-slate-50/60 dark:hover:bg-slate-800/30 transition-colors">
  <th scope="row" class="py-3.5 px-5 align-top bg-slate-50/30 dark:bg-slate-800/20 text-left font-medium text-xs text-slate-600 dark:text-slate-400 leading-snug">
    <span class="block pl-3.5">${r.aspect}</span>
  </th>
  ${valueCells}
</tr>`;
    })
    .join('\n');

  return `<div class="comparison-desktop hidden lg:block rounded-2xl border border-slate-200/90 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm overflow-hidden">
  <div class="overflow-x-auto">
    <table class="w-full text-left border-collapse table-fixed min-w-[960px]" role="table">
      <thead>
        <tr class="border-b-2 border-slate-200 dark:border-slate-800 bg-slate-50/90 dark:bg-slate-800/80">
          <th scope="col" class="py-4 px-5 font-mono text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 w-1/5 align-bottom">
            <span class="block text-[10px] text-primary dark:text-primary-light font-mono font-bold uppercase tracking-wider mb-0.5">Parameter</span>
            <span class="text-xs font-bold text-slate-800 dark:text-slate-200 font-display">${aspectHeader}</span>
          </th>
          ${headerCells}
        </tr>
      </thead>
      <tbody class="divide-y divide-slate-100 dark:divide-slate-800/60">
        ${bodyRows}
      </tbody>
    </table>
  </div>
</div>`;
}

/**
 * Renders the Mobile & Tablet comparison cards grid (< 1024px / grid grid-cols-1 md:grid-cols-2 lg:hidden).
 * Enhanced with:
 * - Clear option header with title and index pill
 * - Dedicated "Pertimbangan Kunci" highlighted section for rapid scanning
 * - Clean "Karakteristik Lainnya" section for secondary attributes
 * - Zero pseudo-table feeling; fully readable in seconds without tracking columns
 */
export function renderMobileComparisonCards(data: ComparisonMatrixData): string {
  const { options, rows } = data;

  const cards = options
    .map((opt, optIdx) => {
      const cleanTitle = opt.replace(/<[^>]+>/g, '').replace(/^\d+\.\s*/, '').trim();

      // Separate rows into key decision criteria and secondary details
      const keyItems: { aspect: string; val: string }[] = [];
      const secondaryItems: { aspect: string; val: string }[] = [];

      for (const r of rows) {
        const val = r.values[optIdx] || '-';
        if (isKeyDecisionRow(r.aspect)) {
          keyItems.push({ aspect: r.aspect.replace(/<[^>]+>/g, ''), val });
        } else {
          secondaryItems.push({ aspect: r.aspect.replace(/<[^>]+>/g, ''), val });
        }
      }

      const keyFieldsHtml = keyItems
        .map(
          (item) => `<div class="rounded-xl bg-amber-500/[0.05] dark:bg-amber-500/[0.08] p-3 border border-amber-500/15 dark:border-amber-500/20 space-y-1">
  <div class="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300">
    <span class="w-1.5 h-1.5 rounded-full bg-primary shrink-0"></span>
    <span>${item.aspect}</span>
  </div>
  <div class="text-xs font-semibold text-slate-900 dark:text-white leading-relaxed pl-3">
    ${item.val}
  </div>
</div>`
        )
        .join('\n');

      const secondaryFieldsHtml = secondaryItems
        .map(
          (item) => `<div class="space-y-0.5">
  <span class="block text-[11px] font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider">${item.aspect}</span>
  <span class="block text-xs text-slate-700 dark:text-slate-300 leading-relaxed">${item.val}</span>
</div>`
        )
        .join('\n');

      return `<div class="comparison-card rounded-2xl border border-slate-200/90 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 shadow-sm space-y-4">
  <div class="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3 gap-2">
    <h4 class="font-display font-bold text-base text-slate-900 dark:text-white leading-snug">${cleanTitle}</h4>
    <span class="text-[10px] font-mono font-bold px-2.5 py-0.5 rounded-full bg-primary/10 text-primary border border-primary/20 shrink-0 uppercase tracking-wider">Pilihan #${optIdx + 1}</span>
  </div>

  <div class="space-y-2">
    <div class="flex items-center gap-1.5 text-[10px] font-mono font-bold uppercase tracking-wider text-primary dark:text-primary-light">
      <span class="w-1.5 h-1.5 rounded-full bg-primary shrink-0"></span>
      <span>Pertimbangan Kunci</span>
    </div>
    <div class="space-y-2">
      ${keyFieldsHtml}
    </div>
  </div>

  <div class="pt-3 border-t border-slate-100 dark:border-slate-800 space-y-2">
    <div class="text-[10px] font-mono font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500">
      Karakteristik Lainnya
    </div>
    <div class="space-y-2.5">
      ${secondaryFieldsHtml}
    </div>
  </div>
</div>`;
    })
    .join('\n');

  return `<div class="comparison-cards grid grid-cols-1 md:grid-cols-2 lg:hidden gap-4">
  ${cards}
</div>`;
}

/**
 * Transforms comparison tables in rendered article HTML into responsive Zero-JS comparison presentation.
 * Standard tables remain untouched.
 */
export function enhanceComparisonMatrices(html: string): string {
  if (!html || typeof html !== 'string') return '';

  const tableRegex = /<table[\s\S]*?<\/table>/gi;

  return html.replace(tableRegex, (fullTableHtml) => {
    if (!isComparisonMatrixTable(fullTableHtml)) {
      return fullTableHtml;
    }

    const data = parseComparisonMatrixTable(fullTableHtml);
    if (!data) {
      return fullTableHtml;
    }

    const desktopHtml = renderDesktopComparisonTable(data);
    const mobileHtml = renderMobileComparisonCards(data);

    return `<div class="article-comparison-matrix not-prose my-10" data-comparison-matrix="true">
${desktopHtml}
${mobileHtml}
</div>`;
  });
}

