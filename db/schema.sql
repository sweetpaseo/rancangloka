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

-- 7. Table: Newsletter Subscribers
CREATE TABLE IF NOT EXISTS subscribers (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  email TEXT NOT NULL UNIQUE,
  status TEXT DEFAULT 'active' CHECK(status IN ('active', 'unsubscribed')),
  source TEXT DEFAULT 'website',
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Indices for Fast Querying
CREATE INDEX IF NOT EXISTS idx_articles_slug ON articles(slug);
CREATE INDEX IF NOT EXISTS idx_articles_status_published ON articles(status, published_at DESC);
CREATE INDEX IF NOT EXISTS idx_articles_category ON articles(category_id);
CREATE INDEX IF NOT EXISTS idx_articles_content_hash ON articles(content_hash);
CREATE INDEX IF NOT EXISTS idx_categories_slug ON categories(slug);
CREATE INDEX IF NOT EXISTS idx_pages_slug ON pages(slug);

-- Initial Seed Data: Categories
INSERT OR IGNORE INTO categories (id, name, slug, color_badge, description, show_on_home, display_order, layout_style) VALUES
(1, 'Desain Interior & Estetika', 'interior-design', '#059669', 'Inspirasi tata ruang, gaya Japandi, palet warna, dan dekorasi estetik untuk hunian nyaman.', 1, 1, 'bento'),
(2, 'Smart Home & Otomasi', 'smart-home', '#2563eb', 'Teknologi IoT rumah tangga, efisiensi energi listrik, dan sistem keamanan pintar.', 1, 2, 'grid3'),
(3, 'Arsitektur & Renovasi', 'arsitektur-renovasi', '#d97706', 'Panduan renovasi hemat bujet, denah rumah open-space, dan material bangunan ramah lingkungan.', 1, 3, 'bento'),
(4, 'Gaya Hidup & Hunian', 'lifestyle-hunian', '#7c3aed', 'Home office ergonomis, tanaman indoor, dan tips menciptakan suasana rumah bebas stres.', 1, 4, 'grid3');

-- Initial Seed Data: Authors
INSERT OR IGNORE INTO authors (id, name, slug, bio, avatar, role, social_links) VALUES
(1, 'Dewan Redaksi Spasial RancangLoka', 'dewan-redaksi-spasial', 'Tim kurasi independen RancangLoka yang fokus pada analisis sirkulasi udara, pencahayaan alami, dan efisiensi spasial hunian tropis kontemporer.', 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80', 'Kurator Utama Tata Ruang Tropis', '{"email":"redaksi@rancangloka.com"}'),
(2, 'Tim Riset Materialitas RancangLoka', 'tim-riset-materialitas', 'Kolektif riset spesifikasi material bangunan ramah lingkungan, isolasi termal pasif, dan pengujian durabilitas iklim tropis lembap.', 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150&auto=format&fit=crop&q=80', 'Editor Spesifikasi & Material', '{"email":"redaksi@rancangloka.com"}');

-- Initial Seed Data: Static Pages (About, Contact, Privacy, Guidelines)
INSERT OR IGNORE INTO pages (id, slug, title, description, content_md, content_html, featured_image, template, status) VALUES
(1, 'tentang-kami', 'Tentang RancangLoka', 'Mengenal visi RancangLoka sebagai jurnal kurasi independen arsitektur, desain interior estetik, dan solusi hunian modern Indonesia.', '## Mengapa RancangLoka Ada?\n\nTerlalu banyak konten desain di internet hanya menunjukkan apa yang terlihat indah di layar, tanpa menjelaskan **MENGAPA** dan **BAGAIMANA** keputusan ruang tersebut bekerja.\n\n**RancangLoka** hadir sebagai jurnal kurasi independen yang menjembatani bahasa arsitektural profesional dengan kebutuhan nyata para pemilik rumah di Indonesia.\n\n## Pendekatan Editorial Kami\n\n1. **Bukti & Presisi di Atas Hype**: Kami menguji setiap gagasan desain berdasarkan orientasi matahari tropis, ventilasi alami, dan durabilitas material.\n2. **Pemisahan Tegas Karya Nyata & Konseptual**: Setiap foto proyek nyata dan visualisasi studi 3D selalu diberi label transparan.\n3. **Independensi Tanpa Bias Sponsor**: Rekomendasi materialitas murni dinilai berdasarkan performa fungsional dan estetika spasial.', '<h2>Mengapa RancangLoka Ada?</h2><p>Terlalu banyak konten desain di internet hanya menunjukkan apa yang terlihat indah di layar, tanpa menjelaskan <strong>MENGAPA</strong> dan <strong>BAGAIMANA</strong> keputusan ruang tersebut bekerja.</p><p><strong>RancangLoka</strong> hadir sebagai jurnal kurasi independen yang menjembatani bahasa arsitektural profesional dengan kebutuhan nyata para pemilik rumah di Indonesia.</p><h2>Pendekatan Editorial Kami</h2><ol><li><strong>Bukti &amp; Presisi di Atas Hype</strong>: Kami menguji setiap gagasan desain berdasarkan orientasi matahari tropis, ventilasi alami, dan durabilitas material.</li><li><strong>Pemisahan Tegas Karya Nyata &amp; Konseptual</strong>: Setiap foto proyek nyata dan visualisasi studi 3D selalu diberi label transparan.</li><li><strong>Independensi Tanpa Bias Sponsor</strong>: Rekomendasi materialitas murni dinilai berdasarkan performa fungsional dan estetika spasial.</li></ol>', 'https://images.unsplash.com/photo-1600585154340-be6161a56a0c?w=1200&auto=format&fit=crop&q=80', 'default', 'published'),
(2, 'kontak', 'Hubungi Redaksi RancangLoka', 'Saluran komunikasi resmi redaksi RancangLoka untuk pertanyaan editorial, liputan karya arsitektur, dan kemitraan independen.', '## Hubungi Tim Redaksi\n\nKami selalu terbuka untuk saran editorial, liputan proyek arsitektur/interior nyata, dan dialog independen seputar ruang hunian.\n\n### Operasional Redaksi\n**RancangLoka Editorial Collective**  \nBeroperasi secara independen dan terdistribusi dari Indonesia.  \nEmail Redaksi: **redaksi@rancangloka.com**  \nKemitraan & Liputan: **partner@rancangloka.com**\n\n---\n\nSilakan kirimkan pesan Anda melalui formulir di bawah ini:', '<h2>Hubungi Tim Redaksi</h2><p>Kami selalu terbuka untuk saran editorial, liputan proyek arsitektur/interior nyata, dan dialog independen seputar ruang hunian.</p><h3>Operasional Redaksi</h3><p><strong>RancangLoka Editorial Collective</strong><br>Beroperasi secara independen dan terdistribusi dari Indonesia.<br>Email Redaksi: <strong>redaksi@rancangloka.com</strong><br>Kemitraan &amp; Liputan: <strong>partner@rancangloka.com</strong></p><hr><p>Silakan kirimkan pesan Anda melalui formulir di bawah ini:</p>', '', 'contact', 'published'),
(3, 'pedoman-media-siber', 'Pedoman Pemberitaan Media Siber & Kode Integritas', 'Komitmen kepatuhan standar kode etik jurnalistik, kebijakan koreksi terbuka, dan transparansi editorial RancangLoka.', 'Kemerdekaan berpendapat dan integritas jurnalisme adalah komitmen utama kami.\n\n**RancangLoka** menjunjung tinggi Kode Etik Jurnalistik dan Pedoman Pemberitaan Media Siber dalam menyajikan seluruh dokumentasi arsitektur, analisis spasial, dan spesifikasi materialitas secara akurat, berimbang, dan bertanggung jawab.\n\n### Kebijakan Koreksi & Hak Jawab\nJika terdapat kekeliruan data teknis, atribusi nama arsitek/fotografer, atau kutipan yang memerlukan revisi, pembaca dan pihak terkait berhak mengajukan koreksi terbuka melalui **redaksi@rancangloka.com**. Tim redaksi akan memverifikasi dan mencatat pembaruan secara transparan pada artikel terkait.', '<p>Kemerdekaan berpendapat dan integritas jurnalisme adalah komitmen utama kami.</p><p><strong>RancangLoka</strong> menjunjung tinggi Kode Etik Jurnalistik dan Pedoman Pemberitaan Media Siber dalam menyajikan seluruh dokumentasi arsitektur, analisis spasial, dan spesifikasi materialitas secara akurat, berimbang, dan bertanggung jawab.</p><h3>Kebijakan Koreksi &amp; Hak Jawab</h3><p>Jika terdapat kekeliruan data teknis, atribusi nama arsitek/fotografer, atau kutipan yang memerlukan revisi, pembaca dan pihak terkait berhak mengajukan koreksi terbuka melalui <strong>redaksi@rancangloka.com</strong>. Tim redaksi akan memverifikasi dan mencatat pembaruan secara transparan pada artikel terkait.</p>', '', 'default', 'published'),
(4, 'kebijakan-privasi', 'Kebijakan Privasi (Privacy Policy)', 'Kebijakan perlindungan data dan privasi pengguna di platform RancangLoka.', 'Di **RancangLoka**, privasi pengunjung kami adalah hal yang sangat penting. Dokumen Kebijakan Privasi ini menguraikan jenis informasi pribadi yang diterima dan dikumpulkan oleh RancangLoka serta bagaimana informasi tersebut digunakan secara aman.', '<p>Di <strong>RancangLoka</strong>, privasi pengunjung kami adalah hal yang sangat penting. Dokumen Kebijakan Privasi ini menguraikan jenis informasi pribadi yang diterima dan dikumpulkan oleh RancangLoka serta bagaimana informasi tersebut digunakan secara aman.</p>', '', 'default', 'published');

-- Initial Seed Data: Settings
INSERT OR IGNORE INTO settings (key, value) VALUES
('site_title', 'RancangLoka'),
('site_tagline', 'Jurnal Kurasi Arsitektur, Desain Interior & Spasial Tropis'),
('site_description', 'Platform editorial independen untuk kurasi arsitektur tropis, desain interior estetik, dan rekayasa spasial hunian di Indonesia.'),
('site_url', 'https://rancangloka.com'),
('site_logo', ''),
('site_favicon', '🏛️'),
('theme_preset', 'elegant-white'),
('theme_primary_color', '#1e3a8a'),
('theme_accent_color', '#d97706'),
('theme_dark_mode_default', 'light'),
('seo_default_og_image', 'https://images.unsplash.com/photo-1600585154340-be6161a56a0c?w=1200&auto=format&fit=crop&q=80'),
('google_analytics_id', ''),
('google_search_console_code', ''),
('allow_indexing', 'true'),
('articles_per_sitemap', '1000'),
('share_bar_enabled', 'true'),
('share_enable_wa', 'true'),
('share_enable_x', 'true'),
('share_enable_facebook', 'true'),
('share_enable_linkedin', 'true'),
('share_enable_telegram', 'true'),
('share_enable_copy', 'true'),
('share_twitter_handle', '@RancangLoka'),
('footer_description', 'Jurnal kurasi independen seputar arsitektur tropis modern, sains pencahayaan alami, dan materialitas berkelanjutan.'),
('social_instagram', 'https://instagram.com/rancangloka'),
('social_tiktok', 'https://tiktok.com/@rancangloka'),
('social_x', 'https://x.com/rancangloka'),
('social_youtube', ''),
('social_pinterest', ''),
('social_linkedin', ''),
('footer_copyright', '© 2026 RancangLoka. All rights reserved. Kurasi editorial independen seputar dunia desain dan hunian modern.');
