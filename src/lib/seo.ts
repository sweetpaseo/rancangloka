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
