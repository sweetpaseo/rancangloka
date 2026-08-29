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
  published_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- 4. Table: Site Settings (Theme, SEO, Webmaster, Identity)
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

-- Initial Seed Data (Erihome Home & Living Context)
INSERT OR IGNORE INTO categories (id, name, slug, color_badge, description, show_on_home, display_order, layout_style) VALUES
(1, 'Desain Interior & Estetika', 'interior-design', '#059669', 'Inspirasi tata ruang, gaya Japandi, palet warna, dan dekorasi estetik untuk hunian nyaman.', 1, 1, 'bento'),
(2, 'Smart Home & Otomasi', 'smart-home', '#2563eb', 'Teknologi IoT rumah tangga, efisiensi energi listrik, dan sistem keamanan pintar.', 1, 2, 'grid3'),
(3, 'Arsitektur & Renovasi', 'arsitektur-renovasi', '#d97706', 'Panduan renovasi hemat bujet, denah rumah open-space, dan material bangunan ramah lingkungan.', 1, 3, 'bento'),
(4, 'Gaya Hidup & Hunian', 'lifestyle-hunian', '#7c3aed', 'Home office ergonomis, tanaman indoor, dan tips menciptakan suasana rumah bebas stres.', 1, 4, 'grid3');

INSERT OR IGNORE INTO authors (id, name, slug, bio, avatar, role, social_links) VALUES
(1, 'Dimas Prasetyo, IAI', 'dimas-prasetyo', 'Principal Architect & Konsultan Tata Ruang Berkelanjutan dengan fokus pada efisiensi energi hunian tropis modern.', 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80', 'Chief Architectural Editor', '{"twitter":"https://x.com","linkedin":"https://linkedin.com"}'),
(2, 'Clarissa Amanda', 'clarissa-amanda', 'Desainer Interior & Penulis Niche Home Decor dengan keahlian konsep Japandi, Scandinavian, dan Minimalis Fungsional.', 'https://images.unsplash.com/photo-1580489944761-15a19d654956?w=150&auto=format&fit=crop&q=80', 'Interior Stylist & Columnist', '{"twitter":"https://x.com","linkedin":"https://linkedin.com"}');

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
