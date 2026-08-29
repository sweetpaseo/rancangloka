/**
 * Cloudflare D1 Database Client with Seamless Fallback for Local Dev
 */

export interface Article {
  id: number;
  slug: string;
  title: string;
  description: string;
  content_md: string;
  content_html: string;
  featured_image: string;
  image_alt: string;
  category_id: number;
  category_name?: string;
  category_slug?: string;
  category_color?: string;
  author_id: number;
  author_name?: string;
  author_avatar?: string;
  author_role?: string;
  status: 'published' | 'draft' | 'scheduled';
  views: number;
  reading_time_minutes: number;
  key_takeaways?: string;
  focus_keyword?: string;
  content_hash?: string;
  is_featured: number;
  is_trending: number;
  published_at: string;
  updated_at: string;
}

export interface Category {
  id: number;
  name: string;
  slug: string;
  color_badge: string;
  description: string;
}

export interface Author {
  id: number;
  name: string;
  slug: string;
  bio: string;
  avatar: string;
  role: string;
  social_links?: string;
}

// In-Memory Fallback Demo Data for Local Testing & Initial State
const MOCK_CATEGORIES: Category[] = [
  { id: 1, name: 'Teknologi & AI', slug: 'teknologi', color_badge: '#2563eb', description: 'Perkembangan AI, Cloudflare, Web3, dan Gadget' },
  { id: 2, name: 'Bisnis & Ekonomi', slug: 'bisnis', color_badge: '#059669', description: 'Pasar global, startup, strategi bisnis, dan investasi' },
  { id: 3, name: 'Gaya Hidup Modern', slug: 'gaya-hidup', color_badge: '#d97706', description: 'Produktivitas, kesehatan digital, dan tren gaya hidup' },
  { id: 4, name: 'Sains & Inovasi', slug: 'sains', color_badge: '#7c3aed', description: 'Penelitian ilmiah, masa depan ruang angkasa, dan bioteknologi' }
];

const MOCK_AUTHORS: Author[] = [
  {
    id: 1,
    name: 'Budi Darmawan',
    slug: 'budi-darmawan',
    bio: 'Lead Tech Journalist & Cloud Architect dengan pengalaman 10+ tahun di bidang infrastruktur modern.',
    avatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80',
    role: 'Senior Tech Editor',
    social_links: JSON.stringify({ twitter: 'https://x.com', linkedin: 'https://linkedin.com', github: 'https://github.com' })
  },
  {
    id: 2,
    name: 'Siti Rahma',
    slug: 'siti-rahma',
    bio: 'Analis Ekonomi Digital & Kolumnis Bisnis Internasional.',
    avatar: 'https://images.unsplash.com/photo-1580489944761-15a19d654956?w=150&auto=format&fit=crop&q=80',
    role: 'Business Columnist',
    social_links: JSON.stringify({ twitter: 'https://x.com', linkedin: 'https://linkedin.com' })
  }
];

const MOCK_SETTINGS: Record<string, string> = {
  site_title: 'METRO MAGAZINE',
  site_tagline: 'Wawasan Terdepan & Berita Masa Depan',
  site_description: 'Platform editorial berita modern dengan kecepatan edge Cloudflare, ulasan mendalam teknologi, bisnis, dan gaya hidup.',
  site_url: 'https://magazine.pages.dev',
  site_logo: '',
  site_favicon: '📰',
  theme_preset: 'editorial-blue',
  theme_primary_color: '#2563eb',
  theme_accent_color: '#f59e0b',
  theme_dark_mode_default: 'system',
  seo_default_og_image: 'https://images.unsplash.com/photo-1504711434969-e33886168f5c?w=1200&auto=format&fit=crop&q=80',
  google_analytics_id: '',
  google_search_console_code: '',
  allow_indexing: 'true',
  articles_per_sitemap: '1000'
};

let inMemoryArticles: Article[] = [
  {
    id: 1,
    slug: 'revolusi-serverless-cloudflare-edge-2026',
    title: 'Revolusi Serverless 2026: Mengapa Cloudflare Edge Mengubah Lanskap Web Modern',
    description: 'Evolusi arsitektur serverless global dengan Cloudflare Workers, D1 Database, dan R2 Storage membawa kecepatan TTFB di bawah 50ms ke seluruh dunia.',
    content_md: `Perkembangan arsitektur web di tahun 2026 telah mencapai titik balik yang revolusioner. Kebutuhan akan kecepatan akses instan, efisiensi energi, dan biaya server yang terjangkau telah mendorong migrasi besar-besaran dari server terpusat menuju komputasi **Edge Serverless**.\n\n## Mengapa Edge Computing Sangat Penting?\n\nEdge computing memindahkan logika backend dan database tepat di pintu gerbang jaringan terdekat dengan pengguna. Hal ini memangkas latensi jaringan secara dramatis dari hitungan ratusan milidetik menjadi hitungan satu digit milidetik.\n\n### Keunggulan Cloudflare D1 & R2\n\n1. **Zero Egress Fee**: Tidak ada lagi tagihan bandwidth membengkak saat gambar diunduh jutaan kali.\n2. **SQLite di Edge Global**: Eksekusi query instan tanpa koneksi pooling lambat.\n3. **Islands Architecture**: Mengirimkan konten murni tanpa bundle JavaScript yang memberatkan smartphone pembaca.\n\n## Dampak Terhadap SEO & AI Search 2026\n\nGoogle dan mesin pencari AI masa kini menuntut skor *Core Web Vitals* yang sempurna. Situs yang lambat di perangkat mobile langsung tereliminasi dari peringkat utama. Dengan infrastruktur Edge, skor 100/100 menjadi standar default.\n\n## Kesimpulan\n\nEra server konvensional yang mahal dan rentan pemeliharaan perlahan digantikan oleh serverless edge yang tangguh, aman, dan hemat biaya.`,
    content_html: `<p>Perkembangan arsitektur web di tahun 2026 telah mencapai titik balik yang revolusioner. Kebutuhan akan kecepatan akses instan, efisiensi energi, dan biaya server yang terjangkau telah mendorong migrasi besar-besaran dari server terpusat menuju komputasi <strong>Edge Serverless</strong>.</p><h2 id="mengapa-edge-computing-sangat-penting">Mengapa Edge Computing Sangat Penting?</h2><p>Edge computing memindahkan logika backend dan database tepat di pintu gerbang jaringan terdekat dengan pengguna. Hal ini memangkas latensi jaringan secara dramatis dari hitungan ratusan milidetik menjadi hitungan satu digit milidetik.</p><h3 id="keunggulan-cloudflare-d1-r2">Keunggulan Cloudflare D1 &amp; R2</h3><ol><li><strong>Zero Egress Fee</strong>: Tidak ada lagi tagihan bandwidth membengkak saat gambar diunduh jutaan kali.</li><li><strong>SQLite di Edge Global</strong>: Eksekusi query instan tanpa koneksi pooling lambat.</li><li><strong>Islands Architecture</strong>: Mengirimkan konten murni tanpa bundle JavaScript yang memberatkan smartphone pembaca.</li></ol><h2 id="dampak-terhadap-seo-ai-search-2026">Dampak Terhadap SEO &amp; AI Search 2026</h2><p>Google dan mesin pencari AI masa kini menuntut skor <em>Core Web Vitals</em> yang sempurna. Situs yang lambat di perangkat mobile langsung tereliminasi dari peringkat utama. Dengan infrastruktur Edge, skor 100/100 menjadi standar default.</p><h2 id="kesimpulan">Kesimpulan</h2><p>Era server konvensional yang mahal dan rentan pemeliharaan perlahan digantikan oleh serverless edge yang tangguh, aman, dan hemat biaya.</p>`,
    featured_image: 'https://images.unsplash.com/photo-1518770660439-4636190af475?w=1200&auto=format&fit=crop&q=80',
    image_alt: 'Visualisasi jaringan serverless global dan edge computing modern',
    category_id: 1,
    category_name: 'Teknologi & AI',
    category_slug: 'teknologi',
    category_color: '#2563eb',
    author_id: 1,
    author_name: 'Budi Darmawan',
    author_avatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80',
    author_role: 'Senior Tech Editor',
    status: 'published',
    views: 1240,
    reading_time_minutes: 4,
    key_takeaways: JSON.stringify([
      'Edge computing memangkas TTFB hingga di bawah 50ms di seluruh dunia.',
      'Cloudflare R2 menghilangkan biaya egress bandwidth untuk media & gambar.',
      'Arsitektur Zero-JS menjamin skor Google PageSpeed 100/100 di perangkat mobile.'
    ]),
    focus_keyword: 'serverless cloudflare 2026',
    content_hash: 'mockhash1',
    is_featured: 1,
    is_trending: 1,
    published_at: new Date(Date.now() - 3600000 * 2).toISOString(),
    updated_at: new Date(Date.now() - 3600000 * 2).toISOString()
  },
  {
    id: 2,
    slug: 'strategi-finansial-startup-ai-masa-depan',
    title: 'Navigasi Finansial Startup 2026: Efisiensi Unit Ekonomi di Era AI Generatif',
    description: 'Bagaimana startup teknologi mengelola cash-flow dan komputasi cloud secara efisien untuk mencapai profitabilitas berkelanjutan.',
    content_md: `Era bakar uang (*burn rate*) tanpa kejelasan unit ekonomi telah resmi berakhir. Tahun 2026 menandai fokus ketat pada efisiensi modal dan profitabilitas nyata.\n\n## Pergeseran Paradigma Finansial\n\nPerusahaan rintisan kini memprioritaskan efisiensi infrastruktur cloud hingga 70% dengan mengadopsi teknologi serverless edge.\n\n## Strategi Utama Bertahan & Berkembang\n\n- Otomatisasi proses berulang dengan AI lokal.\n- Menghindari vendor-lockin komputasi mahal.\n- Monetisasi berbasis nilai nyata, bukan sekadar jumlah traffic.`,
    content_html: `<p>Era bakar uang (<em>burn rate</em>) tanpa kejelasan unit ekonomi telah resmi berakhir. Tahun 2026 menandai fokus ketat pada efisiensi modal dan profitabilitas nyata.</p><h2 id="pergeseran-paradigma-finansial">Pergeseran Paradigma Finansial</h2><p>Perusahaan rintisan kini memprioritaskan efisiensi infrastruktur cloud hingga 70% dengan mengadopsi teknologi serverless edge.</p><h2 id="strategi-utama-bertahan-berkembang">Strategi Utama Bertahan &amp; Berkembang</h2><ul><li>Otomatisasi proses berulang dengan AI lokal.</li><li>Menghindari vendor-lockin komputasi mahal.</li><li>Monetisasi berbasis nilai nyata, bukan sekadar jumlah traffic.</li></ul>`,
    featured_image: 'https://images.unsplash.com/photo-1460925895917-afdab827c52f?w=800&auto=format&fit=crop&q=80',
    image_alt: 'Analisis grafik pertumbuhan bisnis dan finansial startup teknologi',
    category_id: 2,
    category_name: 'Bisnis & Ekonomi',
    category_slug: 'bisnis',
    category_color: '#059669',
    author_id: 2,
    author_name: 'Siti Rahma',
    author_avatar: 'https://images.unsplash.com/photo-1580489944761-15a19d654956?w=150&auto=format&fit=crop&q=80',
    author_role: 'Business Columnist',
    status: 'published',
    views: 890,
    reading_time_minutes: 3,
    key_takeaways: JSON.stringify([
      'Profitabilitas unit ekonomi menjadi tolok ukur utama investor di 2026.',
      'Infrastruktur hemat biaya mampu memangkas beban operasional hingga 70%.'
    ]),
    focus_keyword: 'finansial startup 2026',
    content_hash: 'mockhash2',
    is_featured: 0,
    is_trending: 1,
    published_at: new Date(Date.now() - 3600000 * 8).toISOString(),
    updated_at: new Date(Date.now() - 3600000 * 8).toISOString()
  },
  {
    id: 3,
    slug: 'kebiasaan-digital-detox-produktivitas-modern',
    title: 'Seni Digital Detox 2026: Mengembalikan Fokus di Tengah Banjir Informasi',
    description: 'Panduan praktis menjaga kesehatan mental dan meningkatkan kreativitas mendalam dengan ritual detoksifikasi digital berkala.',
    content_md: `Di tengah gempuran notifikasi instan dan algoritma media sosial, kemampuan untuk fokus tanpa gangguan (*deep work*) menjadi aset paling berharga.\n\n## Menata Ulang Hubungan dengan Teknologi\n\nBukan berarti anti-teknologi, melainkan menggunakannya dengan penuh kesadaran dan batasan yang tegas.`,
    content_html: `<p>Di tengah gempuran notifikasi instan dan algoritma media sosial, kemampuan untuk fokus tanpa gangguan (<em>deep work</em>) menjadi aset paling berharga.</p><h2 id="menata-ulang-hubungan-dengan-teknologi">Menata Ulang Hubungan dengan Teknologi</h2><p>Bukan berarti anti-teknologi, melainkan menggunakannya dengan penuh kesadaran dan batasan yang tegas.</p>`,
    featured_image: 'https://images.unsplash.com/photo-1499750310107-5fef28a66643?w=800&auto=format&fit=crop&q=80',
    image_alt: 'Ruang kerja minimalis dan suasana tenang untuk fokus',
    category_id: 3,
    category_name: 'Gaya Hidup Modern',
    category_slug: 'gaya-hidup',
    category_color: '#d97706',
    author_id: 2,
    author_name: 'Siti Rahma',
    author_avatar: 'https://images.unsplash.com/photo-1580489944761-15a19d654956?w=150&auto=format&fit=crop&q=80',
    author_role: 'Business Columnist',
    status: 'published',
    views: 640,
    reading_time_minutes: 3,
    key_takeaways: JSON.stringify([
      'Fokus mendalam (deep work) adalah keahlian paling dicari di era otomatisasi.',
      'Detox digital 2 jam sebelum tidur terbukti meningkatkan kualitas istirahat.'
    ]),
    focus_keyword: 'digital detox produktivitas',
    content_hash: 'mockhash3',
    is_featured: 0,
    is_trending: 0,
    published_at: new Date(Date.now() - 3600000 * 16).toISOString(),
    updated_at: new Date(Date.now() - 3600000 * 16).toISOString()
  },
  {
    id: 4,
    slug: 'teleskop-ruang-angkasa-generasi-baru-2026',
    title: 'Penemuan Eksoplanet Baru: Menyingkap Rahasia Atmosfer di Tata Surya Jauh',
    description: 'Data spektroskopi terbaru mengonfirmasi adanya molekul air dan tanda atmosfer layak huni pada sistem bintang terdekat.',
    content_md: `Penelitian astronomi modern kembali mencatatkan sejarah baru dengan terdeteksinya molekul penting kehidupan di eksoplanet berjarak 40 tahun cahaya.\n\n## Analisis Spektroskopi Mendalam\n\nInstrumen optik canggih berhasil membaca komposisi gas atmosferik secara detail.`,
    content_html: `<p>Penelitian astronomi modern kembali mencatatkan sejarah baru dengan terdeteksinya molekul penting kehidupan di eksoplanet berjarak 40 tahun cahaya.</p><h2 id="analisis-spektroskopi-mendalam">Analisis Spektroskopi Mendalam</h2><p>Instrumen optik canggih berhasil membaca komposisi gas atmosferik secara detail.</p>`,
    featured_image: 'https://images.unsplash.com/photo-1451187580459-43490279c0fa?w=800&auto=format&fit=crop&q=80',
    image_alt: 'Galaksi dan bintang di luar angkasa dengan pencahayaan kosmik',
    category_id: 4,
    category_name: 'Sains & Inovasi',
    category_slug: 'sains',
    category_color: '#7c3aed',
    author_id: 1,
    author_name: 'Budi Darmawan',
    author_avatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80',
    author_role: 'Senior Tech Editor',
    status: 'published',
    views: 1580,
    reading_time_minutes: 4,
    key_takeaways: JSON.stringify([
      'Deteksi spektroskopi menunjukkan tanda atmosfer stabil di eksoplanet kandidat.',
      'Misi lanjutan direncanakan untuk pemetaan iklim permukaan.'
    ]),
    focus_keyword: 'penemuan eksoplanet sains 2026',
    content_hash: 'mockhash4',
    is_featured: 0,
    is_trending: 1,
    published_at: new Date(Date.now() - 3600000 * 24).toISOString(),
    updated_at: new Date(Date.now() - 3600000 * 24).toISOString()
  }
];

export async function getDb(locals?: any) {
  return locals?.runtime?.env?.DB || null;
}

export async function getAllArticles(db: any, limit = 50, offset = 0, status = 'published'): Promise<Article[]> {
  if (db) {
    try {
      const { results } = await db
        .prepare(`
          SELECT a.*, c.name as category_name, c.slug as category_slug, c.color_badge as category_color,
                 au.name as author_name, au.avatar as author_avatar, au.role as author_role
          FROM articles a
          LEFT JOIN categories c ON a.category_id = c.id
          LEFT JOIN authors au ON a.author_id = au.id
          WHERE (? IS NULL OR a.status = ?)
          ORDER BY a.published_at DESC
          LIMIT ? OFFSET ?
        `)
        .bind(status === 'all' ? null : status, status === 'all' ? null : status, limit, offset)
        .all();
      if (results && results.length > 0) return results as Article[];
    } catch (e) {
      console.warn('D1 Query fallback to mock:', e);
    }
  }
  return inMemoryArticles.filter(a => status === 'all' || a.status === status).slice(offset, offset + limit);
}

export async function getArticleBySlug(db: any, slug: string): Promise<Article | null> {
  if (db) {
    try {
      const result = await db
        .prepare(`
          SELECT a.*, c.name as category_name, c.slug as category_slug, c.color_badge as category_color,
                 au.name as author_name, au.avatar as author_avatar, au.role as author_role
          FROM articles a
          LEFT JOIN categories c ON a.category_id = c.id
          LEFT JOIN authors au ON a.author_id = au.id
          WHERE a.slug = ?
          LIMIT 1
        `)
        .bind(slug)
        .first();
      if (result) return result as Article;
    } catch (e) {
      console.warn('D1 Query fallback to mock:', e);
    }
  }
  return inMemoryArticles.find(a => a.slug === slug) || null;
}

export async function getRelatedArticles(db: any, currentId: number, categoryId: number, limit = 4): Promise<Article[]> {
  if (db) {
    try {
      const { results } = await db
        .prepare(`
          SELECT a.*, c.name as category_name, c.slug as category_slug, c.color_badge as category_color,
                 au.name as author_name, au.avatar as author_avatar, au.role as author_role
          FROM articles a
          LEFT JOIN categories c ON a.category_id = c.id
          LEFT JOIN authors au ON a.author_id = au.id
          WHERE a.id != ? AND a.category_id = ? AND a.status = 'published'
          ORDER BY a.published_at DESC
          LIMIT ?
        `)
        .bind(currentId, categoryId, limit)
        .all();
      if (results && results.length > 0) return results as Article[];
    } catch (e) {
      console.warn('D1 Query fallback:', e);
    }
  }
  const related = inMemoryArticles.filter(a => a.id !== currentId && a.category_id === categoryId && a.status === 'published');
  if (related.length < limit) {
    const others = inMemoryArticles.filter(a => a.id !== currentId && a.category_id !== categoryId && a.status === 'published');
    return [...related, ...others].slice(0, limit);
  }
  return related.slice(0, limit);
}

export async function getAllCategories(db: any): Promise<Category[]> {
  if (db) {
    try {
      const { results } = await db.prepare('SELECT * FROM categories ORDER BY id ASC').all();
      if (results && results.length > 0) return results as Category[];
    } catch (e) {
      console.warn('D1 Query fallback:', e);
    }
  }
  return MOCK_CATEGORIES;
}

export async function getAllAuthors(db: any): Promise<Author[]> {
  if (db) {
    try {
      const { results } = await db.prepare('SELECT * FROM authors ORDER BY id ASC').all();
      if (results && results.length > 0) return results as Author[];
    } catch (e) {
      console.warn('D1 Query fallback:', e);
    }
  }
  return MOCK_AUTHORS;
}

export async function getSiteSettings(db: any): Promise<Record<string, string>> {
  if (db) {
    try {
      const { results } = await db.prepare('SELECT key, value FROM settings').all();
      if (results && results.length > 0) {
        const settings: Record<string, string> = {};
        for (const row of results as { key: string; value: string }[]) {
          settings[row.key] = row.value;
        }
        return { ...MOCK_SETTINGS, ...settings };
      }
    } catch (e) {
      console.warn('D1 Query fallback:', e);
    }
  }
  return MOCK_SETTINGS;
}

export async function checkDuplicateArticle(db: any, slug: string, contentHash?: string): Promise<{ isDuplicate: boolean; existingArticle?: Article; reason?: string }> {
  if (db) {
    try {
      // 1. Check Slug match
      const bySlug = await db.prepare('SELECT * FROM articles WHERE slug = ? LIMIT 1').bind(slug).first();
      if (bySlug) {
        return { isDuplicate: true, existingArticle: bySlug as Article, reason: 'Slug / Judul sudah ada di database' };
      }
      // 2. Check Content Hash match
      if (contentHash) {
        const byHash = await db.prepare('SELECT * FROM articles WHERE content_hash = ? LIMIT 1').bind(contentHash).first();
        if (byHash) {
          return { isDuplicate: true, existingArticle: byHash as Article, reason: 'Konten sama persis dengan artikel yang sudah ada' };
        }
      }
    } catch (e) {
      console.warn('D1 Check Duplicate fallback:', e);
    }
  }

  const foundBySlug = inMemoryArticles.find(a => a.slug === slug);
  if (foundBySlug) return { isDuplicate: true, existingArticle: foundBySlug, reason: 'Slug / Judul sudah ada di database' };

  if (contentHash) {
    const foundByHash = inMemoryArticles.find(a => a.content_hash === contentHash);
    if (foundByHash) return { isDuplicate: true, existingArticle: foundByHash, reason: 'Konten sama persis dengan artikel yang sudah ada' };
  }

  return { isDuplicate: false };
}

export async function insertArticle(db: any, article: Partial<Article>): Promise<Article> {
  const newId = inMemoryArticles.length > 0 ? Math.max(...inMemoryArticles.map(a => a.id)) + 1 : 1;
  const fullArticle: Article = {
    id: newId,
    slug: article.slug || `article-${newId}`,
    title: article.title || 'Untitled',
    description: article.description || '',
    content_md: article.content_md || '',
    content_html: article.content_html || '',
    featured_image: article.featured_image || MOCK_SETTINGS.seo_default_og_image,
    image_alt: article.image_alt || article.title || '',
    category_id: article.category_id || 1,
    author_id: article.author_id || 1,
    status: article.status || 'published',
    views: 0,
    reading_time_minutes: article.reading_time_minutes || 3,
    key_takeaways: article.key_takeaways || '[]',
    focus_keyword: article.focus_keyword || '',
    content_hash: article.content_hash || '',
    is_featured: article.is_featured || 0,
    is_trending: article.is_trending || 0,
    published_at: article.published_at || new Date().toISOString(),
    updated_at: new Date().toISOString()
  };

  if (db) {
    try {
      await db
        .prepare(`
          INSERT INTO articles (slug, title, description, content_md, content_html, featured_image, image_alt, category_id, author_id, status, reading_time_minutes, key_takeaways, focus_keyword, content_hash, is_featured, is_trending, published_at, updated_at)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `)
        .bind(
          fullArticle.slug,
          fullArticle.title,
          fullArticle.description,
          fullArticle.content_md,
          fullArticle.content_html,
          fullArticle.featured_image,
          fullArticle.image_alt,
          fullArticle.category_id,
          fullArticle.author_id,
          fullArticle.status,
          fullArticle.reading_time_minutes,
          fullArticle.key_takeaways,
          fullArticle.focus_keyword,
          fullArticle.content_hash,
          fullArticle.is_featured,
          fullArticle.is_trending,
          fullArticle.published_at,
          fullArticle.updated_at
        )
        .run();
    } catch (e) {
      console.warn('D1 insert failed, adding to memory:', e);
    }
  }

  inMemoryArticles.unshift(fullArticle);
  return fullArticle;
}
