/**
 * SEO & In-Article Parsing Utilities (2026 Ready)
 */

export interface TableOfContentItem {
  id: string;
  text: string;
  level: number;
}

export function slugifyText(text: string): string {
  return text
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, '')
    .replace(/[\s_-]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

/**
 * Calculates reading time in minutes based on 200 WPM
 */
export function calculateReadingTime(content: string): number {
  const words = content.trim().split(/\s+/).length;
  const minutes = Math.ceil(words / 200);
  return Math.max(1, minutes);
}

/**
 * Extracts Table of Contents from HTML / Markdown headings
 */
export function extractTableOfContents(htmlOrMd: string): TableOfContentItem[] {
  const toc: TableOfContentItem[] = [];
  // Regex to match H2 and H3 tags
  const headingRegex = /<h([23])[^>]*id=["']([^"']+)["'][^>]*>(.*?)<\/h\1>|<h([23])[^>]*>(.*?)<\/h\4>/gi;
  let match;

  while ((match = headingRegex.exec(htmlOrMd)) !== null) {
    const level = parseInt(match[1] || match[4], 10);
    const rawText = match[3] || match[5] || '';
    const cleanText = rawText.replace(/<[^>]+>/g, '').trim();
    const id = match[2] || slugifyText(cleanText);

    if (cleanText) {
      toc.push({ id, text: cleanText, level });
    }
  }

  return toc;
}

/**
 * Adds IDs to H2 and H3 tags in HTML string for smooth anchor jump scrolling
 */
export function injectHeadingIds(html: string): string {
  return html.replace(/<h([23])(.*?)>(.*?)<\/h\1>/gi, (match, level, attrs, content) => {
    // Check if id already exists
    if (/id=["'][^"']+["']/i.test(attrs)) {
      return match;
    }
    const cleanText = content.replace(/<[^>]+>/g, '').trim();
    const id = slugifyText(cleanText);
    return `<h${level} id="${id}" class="scroll-mt-24"${attrs}>${content}</h${level}>`;
  });
}

/**
 * Generates JSON-LD Structured Data Schema for NewsArticle / BlogPosting
 */
export function generateArticleSchema(article: any, siteUrl: string, author: any, siteSettings: Record<string, string>) {
  const articleUrl = `${siteUrl}/${article.slug}`;
  const publisherName = siteSettings.site_title || 'RancangLoka';
  const logoUrl = siteSettings.site_logo || `${siteUrl}/favicon.svg`;

  return {
    '@context': 'https://schema.org',
    '@type': 'NewsArticle',
    mainEntityOfPage: {
      '@type': 'WebPage',
      '@id': articleUrl
    },
    headline: article.title,
    description: article.description || article.title,
    image: [article.featured_image || siteSettings.seo_default_og_image],
    datePublished: new Date(article.published_at || Date.now()).toISOString(),
    dateModified: new Date(article.updated_at || article.published_at || Date.now()).toISOString(),
    author: {
      '@type': 'Person',
      name: author?.name || 'Redaksi',
      url: author?.slug ? `${siteUrl}/author/${author.slug}` : siteUrl,
      jobTitle: author?.role || 'Author'
    },
    publisher: {
      '@type': 'Organization',
      name: publisherName,
      logo: {
        '@type': 'ImageObject',
        url: logoUrl
      }
    }
  };
}

/**
 * Generates BreadcrumbList Schema
 */
export function generateBreadcrumbSchema(items: { name: string; url: string }[]) {
  return {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: items.map((item, index) => ({
      '@type': 'ListItem',
      position: index + 1,
      name: item.name,
      item: item.url
    }))
  };
}

/**
 * Generates SHA-256 hash for content duplicate detection
 */
export async function generateContentHash(content: string): Promise<string> {
  const normalized = content.replace(/\s+/g, ' ').trim().toLowerCase();
  const encoder = new TextEncoder();
  const data = encoder.encode(normalized);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

// ============================================================================
// 🔗 AUTOMATED INTERNAL LINKING & EDITORIAL SYNDICATION ENGINE (SEO 2026)
// ============================================================================

/**
 * 1. Injects Dateline Source Branding (e.g. RANCANGLOKA.COM – ) at the beginning of the first paragraph.
 * Protects content from scrapers and generates automatic source backlinks when syndicated.
 */
export function injectEditorialDateline(html: string, siteUrl: string = 'https://rancangloka.com', brandName: string = 'RANCANGLOKA.COM'): string {
  const firstPRegex = /(<p[^>]*>)([\s\S]*?)(<\/p>)/i;
  const match = html.match(firstPRegex);
  if (!match) return html;

  const innerText = match[2].trim();
  // If dateline already exists, do not duplicate
  if (/rancangloka\.com/i.test(innerText.slice(0, 50)) || /^[A-Z\s]+–/i.test(innerText.slice(0, 30))) {
    return html;
  }

  const datelineHtml = `<strong><a href="${siteUrl}" class="font-bold text-slate-900 dark:text-white hover:text-primary transition">${brandName}</a></strong> &ndash; `;
  const updatedP = `${match[1]}${datelineHtml}${match[2]}${match[3]}`;

  return html.replace(firstPRegex, updatedP);
}

/**
 * 2. Injects In-Article Table of Contents (TOC) before the FIRST H2 heading.
 * Ensures the opening paragraphs flow naturally before any navigation box appears.
 */
export function injectTableOfContents(html: string, toc: TableOfContentItem[]): string {
  if (!toc || toc.length < 2) return html;

  let h2Index = 0;
  const listItems = toc
    .map((item) => {
      if (item.level === 2) {
        h2Index++;
        const num = h2Index.toString().padStart(2, '0');
        return `<li class="flex items-start gap-3 group/item py-0.5">
          <span class="font-mono text-[11px] font-extrabold text-[#0071e3] bg-[#0071e3]/10 px-1.5 py-0.5 rounded-md mt-0.5">${num}</span>
          <a href="#${item.id}" class="text-slate-700 dark:text-slate-300 font-semibold group-hover/item:text-[#0071e3] group-hover/item:translate-x-1 transition-all line-clamp-1">${item.text}</a>
        </li>`;
      } else {
        return `<li class="ml-9 flex items-center gap-2 group/item text-xs text-slate-500 dark:text-slate-400 py-0.5">
          <span class="h-1.5 w-1.5 rounded-full bg-slate-300 dark:bg-slate-600"></span>
          <a href="#${item.id}" class="hover:text-[#0071e3] transition line-clamp-1">${item.text}</a>
        </li>`;
      }
    })
    .join('\n');

  const tocHtml = `
<div class="my-10 overflow-hidden rounded-[1.75rem] border border-black/[0.06] bg-slate-50/70 dark:border-white/[0.08] dark:bg-slate-900/60 p-5 sm:p-6 backdrop-blur-md shadow-2xs">
  <details class="group" open>
    <summary class="flex cursor-pointer items-center justify-between font-bold text-slate-900 dark:text-slate-100 text-xs sm:text-sm list-none">
      <span class="flex items-center gap-2.5">
        <span class="flex h-6 w-6 items-center justify-center rounded-lg bg-[#0071e3]/10 text-[#0071e3] text-xs">📑</span>
        <span class="tracking-tight">Daftar Isi & Navigasi Bab</span>
      </span>
      <span class="text-xs text-slate-400 font-medium group-open:hidden">Buka +</span>
      <span class="text-xs text-slate-400 font-medium hidden group-open:inline">Tutup −</span>
    </summary>
    <nav class="mt-4 border-t border-black/[0.04] dark:border-white/[0.06] pt-3">
      <ul class="space-y-1.5 text-xs sm:text-sm">
        ${listItems}
      </ul>
    </nav>
  </details>
</div>
`;

  // Insert before the 1st <h2>
  if (/<h2/i.test(html)) {
    return html.replace(/<h2/i, `${tocHtml}<h2`);
  }

  return `${tocHtml}${html}`;
}

/**
 * 3. Injects In-Article "BACA JUGA" Related Article Box in the middle of the article.
 * Spaced out naturally (before 2nd or 3rd H2).
 */
export function injectInArticleRelated(html: string, relatedArticle?: any): string {
  if (!relatedArticle || !relatedArticle.slug || !relatedArticle.title) {
    return html;
  }

  const calloutHtml = `
<div class="my-8 overflow-hidden rounded-2xl border border-slate-200/90 dark:border-slate-800 bg-slate-50/80 dark:bg-slate-900/60 p-4 transition hover:border-primary/50 shadow-2xs">
  <div class="flex items-center gap-2 text-[11px] font-bold uppercase tracking-wider text-primary mb-1">
    <span>📖</span>
    <span>BACA JUGA:</span>
  </div>
  <a href="/${relatedArticle.slug}" class="text-sm sm:text-base font-bold text-slate-900 dark:text-white hover:text-primary transition line-clamp-2">
    ${relatedArticle.title}
  </a>
</div>
`;

  // Count total <h2>
  const totalH2 = (html.match(/<h2/gi) || []).length;
  const targetH2Index = totalH2 >= 3 ? 3 : 2;

  let h2Count = 0;
  const withH2 = html.replace(/<h2/gi, (match) => {
    h2Count++;
    if (h2Count === targetH2Index) {
      return `${calloutHtml}${match}`;
    }
    return match;
  });

  if (h2Count >= targetH2Index) return withH2;

  // Fallback: after 4th </p>
  let pCount = 0;
  return html.replace(/<\/p>/gi, (match) => {
    pCount++;
    if (pCount === 4) {
      return `${match}${calloutHtml}`;
    }
    return match;
  });
}

/**
 * 4. Smart Contextual Auto-Keyword Linker
 * Finds focus keywords of other published articles and creates internal anchor links in text.
 * Max 2-3 links per article, first match only, ignoring existing <a>, <h1-h6>, <code> tags.
 */
export function injectAutoKeywordLinks(
  html: string,
  currentArticleId: number,
  allArticles: any[] = [],
  maxLinks: number = 2
): string {
  if (!allArticles || allArticles.length === 0) return html;

  // Filter candidate articles that have focus_keyword or clean title
  const candidates: { keyword: string; slug: string }[] = [];

  for (const art of allArticles) {
    if (art.id === currentArticleId || art.status !== 'published') continue;

    if (art.focus_keyword && art.focus_keyword.trim().length >= 4) {
      candidates.push({ keyword: art.focus_keyword.trim(), slug: art.slug });
    }
  }

  // Sort keywords by length descending so longer phrases match first
  candidates.sort((a, b) => b.keyword.length - a.keyword.length);

  let linkCount = 0;
  let resultHtml = html;

  for (const { keyword, slug } of candidates) {
    if (linkCount >= maxLinks) break;

    // Escape regex special chars
    const escaped = keyword.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    // Regex that matches keyword only inside text (not inside HTML tags or attributes)
    const regex = new RegExp(`(?<!<[^>]*)(\\b${escaped}\\b)(?![^<]*>)(?![^<]*<\\/a>)`, 'i');

    if (regex.test(resultHtml)) {
      resultHtml = resultHtml.replace(regex, (matched) => {
        linkCount++;
        return `<a href="/${slug}" class="text-primary font-semibold underline underline-offset-2 hover:text-primary-hover transition">${matched}</a>`;
      });
    }
  }

  return resultHtml;
}

/**
 * 5. Master Content Processor
 * Combines Heading IDs, Dateline, In-Article TOC, Auto-Keywords, and In-Article BACA JUGA.
 * For Sponsored Articles (is_sponsored === 1): TOC, BACA JUGA, and Auto-Keywords are cleanly disabled!
 */
export function processArticleContent(
  rawHtml: string,
  article: any,
  allArticles: any[] = [],
  relatedArticle?: any,
  siteSettings: Record<string, string> = {},
  toc: TableOfContentItem[] = []
): string {
  // Step 1: Inject Heading IDs for smooth TOC scrolling
  let html = injectHeadingIds(rawHtml);

  // Step 2: Inject Dateline Source Branding
  const siteUrl = siteSettings.site_url || 'https://rancangloka.com';
  const siteTitle = (siteSettings.site_title || 'RANCANGLOKA.COM').toUpperCase();
  html = injectEditorialDateline(html, siteUrl, siteTitle);

  // Step 3: Check if article is Sponsored / Paid Review or Internal Links are Disabled
  const isSponsoredOrDisabled = article.is_sponsored === 1 || article.disable_internal_links === 1;

  if (isSponsoredOrDisabled) {
    // Return early: Clean text without in-article TOC, BACA JUGA, or auto-keyword links
    return html;
  }

  // Step 4: Inject Table of Contents before the FIRST H2 (after opening paragraphs)
  if (toc && toc.length >= 2) {
    html = injectTableOfContents(html, toc);
  }

  // Step 5: Inject In-Article BACA JUGA Box in mid-article
  if (relatedArticle) {
    html = injectInArticleRelated(html, relatedArticle);
  }

  // Step 6: Inject Auto-Keyword Contextual Internal Links
  html = injectAutoKeywordLinks(html, article.id, allArticles, 2);

  return html;
}

