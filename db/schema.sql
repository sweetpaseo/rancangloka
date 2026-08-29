-- Cloudflare D1 Database Schema for Magazine Blog Platform

-- 1. Table: Categories
CREATE TABLE IF NOT EXISTS categories (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  color_badge TEXT DEFAULT '#2563eb',
  description TEXT,
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

-- Initial Seed Data
INSERT OR IGNORE INTO categories (id, name, slug, color_badge, description) VALUES
(1, 'Teknologi', 'teknologi', '#2563eb', 'Berita dan ulasan teknologi terbaru, AI, cloud, dan gadget.'),
(2, 'Bisnis & Finansial', 'bisnis', '#059669', 'Kabar pasar, startup, ekonomi digital, dan strategi bisnis.'),
(3, 'Gaya Hidup', 'gaya-hidup', '#d97706', 'Tren gaya hidup modern, produktivitas, dan kesehatan.'),
(4, 'Sains & Masa Depan', 'sains', '#7c3aed', 'Eksplorasi penemuan ilmiah dan inovasi masa depan.');

INSERT OR IGNORE INTO authors (id, name, slug, bio, avatar, role, social_links) VALUES
(1, 'Redaksi Utama', 'redaksi-utama', 'Tim jurnalis dan analis konten editorial magazine.', 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80', 'Senior Editor', '{"twitter":"https://x.com","linkedin":"https://linkedin.com"}');

INSERT OR IGNORE INTO settings (key, value) VALUES
('site_title', 'METRO MAGAZINE'),
('site_tagline', 'Portal Berita & Wawasan Masa Depan'),
('site_description', 'Platform magazine berita modern dengan liputan mendalam teknologi, bisnis, gaya hidup, dan sains.'),
('site_url', 'https://magazine.pages.dev'),
('site_logo', ''),
('site_favicon', '📰'),
('theme_preset', 'editorial-blue'),
('theme_primary_color', '#2563eb'),
('theme_accent_color', '#f59e0b'),
('theme_dark_mode_default', 'system'),
('seo_default_og_image', 'https://images.unsplash.com/photo-1504711434969-e33886168f5c?w=1200&auto=format&fit=crop&q=80'),
('google_analytics_id', ''),
('google_search_console_code', ''),
('allow_indexing', 'true'),
('articles_per_sitemap', '1000');
