/**
 * RancangLoka Category Taxonomy & Deterministic Alias Resolution
 * Phase 1A Foundation
 */

import { slugifyText } from './seo.ts';
import type { Category } from './db.ts';

export interface CategoryDefinition {
  id?: number;
  name: string;
  slug: string;
  status: 'OFFICIAL' | 'LEGACY';
  color_badge: string;
  description: string;
  show_on_home: number;
  display_order: number;
  layout_style: 'bento' | 'grid3' | 'list';
}

/**
 * The 6 Official RancangLoka Editorial Categories
 */
export const OFFICIAL_CATEGORIES: CategoryDefinition[] = [
  {
    id: 3,
    name: 'Arsitektur & Renovasi',
    slug: 'arsitektur-renovasi',
    status: 'OFFICIAL',
    color_badge: '#d97706',
    description: 'Panduan renovasi hemat bujet, denah rumah open-space, dan material bangunan ramah lingkungan.',
    show_on_home: 1,
    display_order: 1,
    layout_style: 'bento'
  },
  {
    id: 1,
    name: 'Interior & Tata Ruang',
    slug: 'interior-design', // PRESERVED SLUG: preserves URLs, sitemaps, and existing articles
    status: 'OFFICIAL',
    color_badge: '#059669',
    description: 'Inspirasi tata ruang, gaya arsitektural interior tropis, palet material, dan penataan ruang hunian proporsional.',
    show_on_home: 1,
    display_order: 2,
    layout_style: 'bento'
  },
  {
    id: 5,
    name: 'Material & Finishing',
    slug: 'material-finishing',
    status: 'OFFICIAL',
    color_badge: '#0891b2',
    description: 'Eksplorasi materialitas, spesifikasi teknis, durabilitas, dan finishing permukaan bangunan tropis.',
    show_on_home: 1,
    display_order: 3,
    layout_style: 'grid3'
  },
  {
    id: 6,
    name: 'Kenyamanan Rumah',
    slug: 'kenyamanan-rumah',
    status: 'OFFICIAL',
    color_badge: '#16a34a',
    description: 'Sains kenyamanan termal, ventilasi silang, isolasi akustik, dan kualitas udara dalam ruang hunian.',
    show_on_home: 1,
    display_order: 4,
    layout_style: 'bento'
  },
  {
    id: 7,
    name: 'Eksterior & Lanskap',
    slug: 'eksterior-lanskap',
    status: 'OFFICIAL',
    color_badge: '#84cc16',
    description: 'Desain fasad tropis, secondary skin, teras, kanopi, dan integrasi lanskap alami luar ruang.',
    show_on_home: 1,
    display_order: 5,
    layout_style: 'grid3'
  },
  {
    id: 8,
    name: 'Sistem & Konstruksi Rumah',
    slug: 'sistem-konstruksi-rumah',
    status: 'OFFICIAL',
    color_badge: '#ea580c',
    description: 'Rekayasa struktur, utilitas MEP, drainase, pondasi, dan proteksi kelembapan bangunan.',
    show_on_home: 1,
    display_order: 6,
    layout_style: 'bento'
  }
];

/**
 * Preserved Legacy Categories (DO NOT DELETE, URLs and relations remain intact)
 */
export const LEGACY_CATEGORIES: CategoryDefinition[] = [
  {
    id: 2,
    name: 'Smart Home & Otomasi',
    slug: 'smart-home',
    status: 'LEGACY',
    color_badge: '#2563eb',
    description: 'Teknologi IoT rumah tangga, efisiensi energi listrik, dan sistem keamanan pintar.',
    show_on_home: 0,
    display_order: 7,
    layout_style: 'grid3'
  },
  {
    id: 4,
    name: 'Gaya Hidup & Hunian',
    slug: 'lifestyle-hunian',
    status: 'LEGACY',
    color_badge: '#7c3aed',
    description: 'Home office ergonomis, tanaman indoor, dan tips menciptakan suasana rumah bebas stres.',
    show_on_home: 0,
    display_order: 8,
    layout_style: 'grid3'
  }
];

/**
 * Deterministic Category Alias Map
 * Normalizes user/AI variations to canonical category slugs.
 */
export const CATEGORY_ALIAS_MAP: Record<string, string> = {
  // Category 1: Interior (Both new name and legacy name map to interior-design)
  'desain interior & estetika': 'interior-design',
  'desain interior dan estetika': 'interior-design',
  'interior & tata ruang': 'interior-design',
  'interior dan tata ruang': 'interior-design',
  'interior-tata-ruang': 'interior-design',
  'interior-design': 'interior-design',
  'interior': 'interior-design',

  // Category 3: Arsitektur
  'arsitektur & renovasi': 'arsitektur-renovasi',
  'arsitektur dan renovasi': 'arsitektur-renovasi',
  'arsitektur-renovasi': 'arsitektur-renovasi',
  'arsitektur': 'arsitektur-renovasi',

  // Category 5: Material & Finishing
  'material & finishing': 'material-finishing',
  'material dan finishing': 'material-finishing',
  'material-finishing': 'material-finishing',
  'material': 'material-finishing',

  // Category 6: Kenyamanan Rumah
  'kenyamanan rumah': 'kenyamanan-rumah',
  'kenyamanan-rumah': 'kenyamanan-rumah',

  // Category 7: Eksterior & Lanskap
  'eksterior & lanskap': 'eksterior-lanskap',
  'eksterior dan lanskap': 'eksterior-lanskap',
  'eksterior-lanskap': 'eksterior-lanskap',
  'eksterior': 'eksterior-lanskap',

  // Category 8: Sistem & Konstruksi Rumah
  'sistem & konstruksi rumah': 'sistem-konstruksi-rumah',
  'sistem dan konstruksi rumah': 'sistem-konstruksi-rumah',
  'sistem-konstruksi-rumah': 'sistem-konstruksi-rumah',
  'konstruksi rumah': 'sistem-konstruksi-rumah',

  // Legacy Category 2: Smart Home & Otomasi
  'smart home & otomasi': 'smart-home',
  'smart home dan otomasi': 'smart-home',
  'smart-home': 'smart-home',

  // Legacy Category 4: Gaya Hidup & Hunian
  'gaya hidup & hunian': 'lifestyle-hunian',
  'gaya hidup dan hunian': 'lifestyle-hunian',
  'lifestyle-hunian': 'lifestyle-hunian'
};

export interface CategoryResolutionResult {
  category: Category;
  isCanonical: boolean;
  resolvedVia: 'id' | 'alias' | 'exact_name' | 'slug';
}

/**
 * Resolves a raw category input (name, alias, slug, or ID) deterministically
 * against the provided category list.
 */
export function resolveCategory(
  rawInput: string | number | null | undefined,
  availableCategories: Category[]
): CategoryResolutionResult | null {
  if (rawInput === null || rawInput === undefined) return null;

  const trimmed = String(rawInput).trim();
  if (!trimmed) return null;

  // 1. Numeric ID Resolution
  if (!isNaN(Number(trimmed))) {
    const numId = Number(trimmed);
    const byId = availableCategories.find((c) => c.id === numId);
    if (byId) {
      return { category: byId, isCanonical: true, resolvedVia: 'id' };
    }
  }

  const normalizedKey = trimmed.toLowerCase();
  const slugified = slugifyText(trimmed).toLowerCase();

  // 2. Alias Mapping
  const aliasTargetSlug = CATEGORY_ALIAS_MAP[normalizedKey] || CATEGORY_ALIAS_MAP[slugified];
  if (aliasTargetSlug) {
    const byAlias = availableCategories.find((c) => c.slug.toLowerCase() === aliasTargetSlug.toLowerCase());
    if (byAlias) {
      return { category: byAlias, isCanonical: true, resolvedVia: 'alias' };
    }
  }

  // 3. Exact Name Match (Case-Insensitive)
  const byName = availableCategories.find((c) => c.name.toLowerCase().trim() === normalizedKey);
  if (byName) {
    return { category: byName, isCanonical: true, resolvedVia: 'exact_name' };
  }

  // 4. Slug Match
  const bySlug = availableCategories.find((c) => c.slug.toLowerCase().trim() === slugified);
  if (bySlug) {
    return { category: bySlug, isCanonical: true, resolvedVia: 'slug' };
  }

  return null;
}
