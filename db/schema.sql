-- Cloudflare D1 Database Schema for Erihouse Magazine Platform (Home & Living Ecosystem)

-- 1. Table: Categories
CREATE TABLE IF NOT EXISTS categories (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  color_badge TEXT DEFAULT '#059669',
  description TEXT,
  show_on_home INTEGER DEFAULT 1,
  display_order INTEGER DEFAULT 1,
  layout_style TEXT DEFAULT 'bento',
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- 2. Table: Authors (E-E-A-T Signal)
CREATE TABLE IF NOT EXISTS authors (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  bio TEXT,
  avatar TEXT,
  role TEXT DEFAULT 'Editor',
  social_links TEXT, -- JSON format: {"twitter": "...", "linkedin": "..."}
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- 3. Table: Articles (Posts)
CREATE TABLE IF NOT EXISTS articles (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  slug TEXT NOT NULL UNIQUE,
  title TEXT NOT NULL,
  description TEXT,
  content_md TEXT NOT NULL,
  content_html TEXT NOT NULL,
  featured_image TEXT,
  image_alt TEXT,
  category_id INTEGER REFERENCES categories(id) ON DELETE SET NULL,
  author_id INTEGER REFERENCES authors(id) ON DELETE SET NULL,
  status TEXT DEFAULT 'published' CHECK(status IN ('draft', 'published', 'scheduled')),
  views INTEGER DEFAULT 0,
  reading_time_minutes INTEGER DEFAULT 3,
  key_takeaways TEXT, -- JSON Array format: ["Point 1", "Point 2", "Point 3"]
  focus_keyword TEXT,
  content_hash TEXT, -- SHA-256 for duplicate detection
  is_featured INTEGER DEFAULT 0, -- 1 for Featured Hero Story
  is_trending INTEGER DEFAULT 0, -- 1 for Trending Bar
  is_sponsored INTEGER DEFAULT 0, -- 1 for Sponsored Post / Paid Review
  disable_internal_links INTEGER DEFAULT 0, -- 1 to disable auto-keyword & in-article related links
  published_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- 4. Table: Pages (WordPress-style Static Pages: About, Contact, Privacy, etc.)
CREATE TABLE IF NOT EXISTS pages (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  slug TEXT NOT NULL UNIQUE,
  title TEXT NOT NULL,
  description TEXT,
  content_md TEXT NOT NULL,
  content_html TEXT NOT NULL,
  featured_image TEXT,
  template TEXT DEFAULT 'default', -- 'default' | 'contact' | 'fullwidth'
  status TEXT DEFAULT 'published' CHECK(status IN ('draft', 'published')),
  views INTEGER DEFAULT 0,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- 5. Table: Site Settings (Theme, SEO, Webmaster, Identity)
CREATE TABLE IF NOT EXISTS settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- 5. Table: Users / Admin Auth
CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  username TEXT NOT NULL UNIQUE,
  email TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  role TEXT DEFAULT 'admin',
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- 6. Table: Sessions
CREATE TABLE IF NOT EXISTS sessions (
  id TEXT PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  expires_at DATETIME NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Indices for Fast Querying
CREATE INDEX IF NOT EXISTS idx_articles_slug ON articles(slug);
CREATE INDEX IF NOT EXISTS idx_articles_status_published ON articles(status, published_at DESC);
CREATE INDEX IF NOT EXISTS idx_articles_category ON articles(category_id);
CREATE INDEX IF NOT EXISTS idx_articles_content_hash ON articles(content_hash);
CREATE INDEX IF NOT EXISTS idx_categories_slug ON categories(slug);
CREATE INDEX IF NOT EXISTS idx_pages_slug ON pages(slug);

-- Initial Seed Data (Erihome Home & Living Context)
INSERT OR IGNORE INTO categories (id, name, slug, color_badge, description, show_on_home, display_order, layout_style) VALUES
(1, 'Desain Interior & Estetika', 'interior-design', '#059669', 'Inspirasi tata ruang, gaya Japandi, palet warna, dan dekorasi estetik untuk hunian nyaman.', 1, 1, 'bento'),
(2, 'Smart Home & Otomasi', 'smart-home', '#2563eb', 'Teknologi IoT rumah tangga, efisiensi energi listrik, dan sistem keamanan pintar.', 1, 2, 'grid3'),
(3, 'Arsitektur & Renovasi', 'arsitektur-renovasi', '#d97706', 'Panduan renovasi hemat bujet, denah rumah open-space, dan material bangunan ramah lingkungan.', 1, 3, 'bento'),
(4, 'Gaya Hidup & Hunian', 'lifestyle-hunian', '#7c3aed', 'Home office ergonomis, tanaman indoor, dan tips menciptakan suasana rumah bebas stres.', 1, 4, 'grid3');

INSERT OR IGNORE INTO authors (id, name, slug, bio, avatar, role, social_links) VALUES
(1, 'Dimas Prasetyo, IAI', 'dimas-prasetyo', 'Principal Architect & Konsultan Tata Ruang Berkelanjutan dengan fokus pada efisiensi energi hunian tropis modern.', 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80', 'Chief Architectural Editor', '{"twitter":"https://x.com","linkedin":"https://linkedin.com"}'),
(2, 'Clarissa Amanda', 'clarissa-amanda', 'Desainer Interior & Penulis Niche Home Decor dengan keahlian konsep Japandi, Scandinavian, dan Minimalis Fungsional.', 'https://images.unsplash.com/photo-1580489944761-15a19d654956?w=150&auto=format&fit=crop&q=80', 'Interior Stylist & Columnist', '{"twitter":"https://x.com","linkedin":"https://linkedin.com"}');

-- Initial Seed Data: Static Pages (About, Contact, Privacy, Guidelines)
INSERT OR IGNORE INTO pages (id, slug, title, description, content_md, content_html, featured_image, template, status) VALUES
(1, 'tentang-kami', 'Tentang RancangLoka', 'Mengenal visi RancangLoka sebagai platform media kurasi arsitektur, desain interior estetik, dan solusi hunian modern Indonesia.', '## Visi Kami\n\n**RancangLoka** adalah media editorial independen yang didedikasikan untuk menginspirasi masyarakat Indonesia dalam mewujudkan hunian impian yang fungsional, bernilai estetika tinggi, dan selaras dengan alam.\n\n## Pendekatan Editorial\n\nKami mengkurasi tren arsitektur tropis, filosofi desain Japandi, inovasi rumah pintar (*smart home*), dan panduan renovasi terukur melalui kolaborasi dengan arsitek berlisensi serta desainer interior profesional.\n\n## Komitmen Kualitas (E-E-A-T)\n\nSetiap artikel yang kami terbitkan melalui riset mendalam, verifikasi data teknis material, dan penulisan berbasis pengalaman (*hands-on expertise*) untuk memberikan nilai guna nyata bagi para pemilik rumah.', '<h2>Visi Kami</h2><p><strong>RancangLoka</strong> adalah media editorial independen yang didedikasikan untuk menginspirasi masyarakat Indonesia dalam mewujudkan hunian impian yang fungsional, bernilai estetika tinggi, dan selaras dengan alam.</p><h2>Pendekatan Editorial</h2><p>Kami mengkurasi tren arsitektur tropis, filosofi desain Japandi, inovasi rumah pintar (<em>smart home</em>), dan panduan renovasi terukur melalui kolaborasi dengan arsitek berlisensi serta desainer interior profesional.</p><h2>Komitmen Kualitas (E-E-A-T)</h2><p>Setiap artikel yang kami terbitkan melalui riset mendalam, verifikasi data teknis material, dan penulisan berbasis pengalaman (<em>hands-on expertise</em>) untuk memberikan nilai guna nyata bagi para pemilik rumah.</p>', 'https://images.unsplash.com/photo-1600585154340-be6161a56a0c?w=720&auto=format&fit=crop&q=75', 'default', 'published'),
(2, 'kontak', 'Hubungi Redaksi RancangLoka', 'Saluran komunikasi resmi redaksi RancangLoka untuk pertanyaan editorial, kolaborasi, pengiriman karya arsitektur, dan kemitraan media.', '## Hubungi Tim Redaksi\n\nKami selalu terbuka untuk kolaborasi editorial, liputan karya arsitektur/interior, rilis pers, dan kerja sama kemitraan.\n\n### Alamat Kantor Editorial\n**RancangLoka Media Network**  \nCyber 2 Tower, Kuningan, Jakarta Selatan, Indonesia  \nEmail: **redaksi@rancangloka.com**  \nKerja Sama & Iklan: **partner@rancangloka.com**\n\n---\n\nSilakan kirimkan pesan Anda melalui formulir di bawah ini:', '<h2>Hubungi Tim Redaksi</h2><p>Kami selalu terbuka untuk kolaborasi editorial, liputan karya arsitektur/interior, rilis pers, dan kerja sama kemitraan.</p><h3>Alamat Kantor Editorial</h3><p><strong>RancangLoka Media Network</strong><br>Cyber 2 Tower, Kuningan, Jakarta Selatan, Indonesia<br>Email: <strong>redaksi@rancangloka.com</strong><br>Kerja Sama &amp; Iklan: <strong>partner@rancangloka.com</strong></p><hr><p>Silakan kirimkan pesan Anda melalui formulir di bawah ini:</p>', '', 'contact', 'published'),
(3, 'pedoman-media-siber', 'Pedoman Pemberitaan Media Siber', 'Komitmen kepatuhan standar kode etik jurnalistik dan pedoman pemberitaan media siber RancangLoka.', 'Kemerdekaan berpendapat, kemerdekaan berekspresi, dan kemerdekaan pers adalah hak asasi manusia yang dilindungi Pancasila, Undang-Undang Dasar 1945, dan Deklarasi Universal Hak Asasi Manusia PBB.\n\n**RancangLoka** menjunjung tinggi Kode Etik Jurnalistik dan Pedoman Pemberitaan Media Siber dalam menyajikan seluruh informasi arsitektur, properti, dan hunian secara akurat, berimbang, dan bertanggung jawab.', '<p>Kemerdekaan berpendapat, kemerdekaan berekspresi, dan kemerdekaan pers adalah hak asasi manusia yang dilindungi Pancasila, Undang-Undang Dasar 1945, dan Deklarasi Universal Hak Asasi Manusia PBB.</p><p><strong>RancangLoka</strong> menjunjung tinggi Kode Etik Jurnalistik dan Pedoman Pemberitaan Media Siber dalam menyajikan seluruh informasi arsitektur, properti, dan hunian secara akurat, berimbang, dan bertanggung jawab.</p>', '', 'default', 'published'),
(4, 'kebijakan-privasi', 'Kebijakan Privasi (Privacy Policy)', 'Kebijakan perlindungan data dan privasi pengguna di platform RancangLoka.', 'Di **RancangLoka**, privasi pengunjung kami adalah hal yang sangat penting. Dokumen Kebijakan Privasi ini menguraikan jenis informasi pribadi yang diterima dan dikumpulkan oleh RancangLoka serta bagaimana informasi tersebut digunakan secara aman.', '<p>Di <strong>RancangLoka</strong>, privasi pengunjung kami adalah hal yang sangat penting. Dokumen Kebijakan Privasi ini menguraikan jenis informasi pribadi yang diterima dan dikumpulkan oleh RancangLoka serta bagaimana informasi tersebut digunakan secara aman.</p>', '', 'default', 'published');

INSERT OR IGNORE INTO settings (key, value) VALUES
('site_title', 'RancangLoka'),
('site_tagline', 'Inspirasi Desain Interior, Arsitektur & Smart Living'),
('site_description', 'Platform editorial terdepan untuk inspirasi arsitektur modern, desain interior estetik, smart home, dan solusi hunian impian di rancangloka.com.'),
('site_url', 'https://rancangloka.com'),
('site_logo', ''),
('site_favicon', '🏡'),
('theme_preset', 'elegant-white'),
('theme_primary_color', '#1e3a8a'),
('theme_accent_color', '#d97706'),
('theme_dark_mode_default', 'light'),
('seo_default_og_image', 'https://images.unsplash.com/photo-1600585154340-be6161a56a0c?w=1200&auto=format&fit=crop&q=80'),
('google_analytics_id', ''),
('google_search_console_code', ''),
('allow_indexing', 'true'),
('articles_per_sitemap', '1000');
