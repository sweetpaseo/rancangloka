-- ============================================================================
-- Migration: 0001_category_taxonomy_expansion.sql
-- Description: Expand RancangLoka Category Taxonomy to the 6 Official Editorial Categories
-- Safety: Preserves existing Category IDs, slugs, URLs, and article relations.
-- ============================================================================

-- 1. Update Category ID 1 display name to 'Interior & Tata Ruang' while strictly preserving slug 'interior-design'
UPDATE categories 
SET name = 'Interior & Tata Ruang',
    description = 'Inspirasi tata ruang, gaya arsitektural interior tropis, palet material, dan penataan ruang hunian proporsional.'
WHERE id = 1 AND slug = 'interior-design';

-- 2. Insert Missing Official Categories (IDs 5 to 8)
INSERT OR IGNORE INTO categories (id, name, slug, color_badge, description, show_on_home, display_order, layout_style) VALUES
(5, 'Material & Finishing', 'material-finishing', '#0891b2', 'Eksplorasi materialitas, spesifikasi teknis, durabilitas, dan finishing permukaan bangunan tropis.', 1, 3, 'grid3'),
(6, 'Kenyamanan Rumah', 'kenyamanan-rumah', '#16a34a', 'Sains kenyamanan termal, ventilasi silang, isolasi akustik, dan kualitas udara dalam ruang hunian.', 1, 4, 'bento'),
(7, 'Eksterior & Lanskap', 'eksterior-lanskap', '#84cc16', 'Desain fasad tropis, secondary skin, teras, kanopi, dan integrasi lanskap alami luar ruang.', 1, 5, 'grid3'),
(8, 'Sistem & Konstruksi Rumah', 'sistem-konstruksi-rumah', '#ea580c', 'Rekayasa struktur, utilitas MEP, drainase, pondasi, dan proteksi kelembapan bangunan.', 1, 6, 'bento');
