/**
 * RancangLoka — Editorial Visual Manifest Loader
 * Milestone: EVIS-P0-MANIFEST-RENDER-INTEGRATION
 *
 * Provides safe, deterministic loading of active visual placement manifests.
 * Invariants:
 * 1. ZERO SIDE-EFFECTS: Read-only; zero database mutations.
 * 2. MULTI-SOURCE RESOLUTION: Resolves by slug, canonical ID, or DB storage.
 * 3. GRACEFUL FALLBACK: Fails closed (returns null) on missing, unreadable, or malformed manifests.
 */

export type { VisualPlacementManifest, VisualManifestItem } from './anchor-resolver.ts';
import type { VisualPlacementManifest } from './anchor-resolver.ts';

export interface ManifestLookupParams {
  articleId?: number | string;
  slug?: string;
  db?: any;
}

export async function loadArticleVisualManifest(
  params: ManifestLookupParams
): Promise<VisualPlacementManifest | null> {
  const { articleId, slug, db } = params;

  // 1. Try DB-persisted manifest in settings table (if db is available)
  if (db) {
    try {
      const keys: string[] = [];
      if (articleId) keys.push(`visual_manifest:article:${articleId}`);
      if (slug) keys.push(`visual_manifest:slug:${slug}`);

      for (const key of keys) {
        const row = await db
          .prepare('SELECT value FROM settings WHERE key = ? LIMIT 1')
          .bind(key)
          .first();
        if (row?.value) {
          const parsed = JSON.parse(row.value);
          if (parsed && Array.isArray(parsed.visual_items)) {
            return parsed as VisualPlacementManifest;
          }
        }
      }
    } catch (_) {
      // Fall through to filesystem resolution
    }
  }

  // 2. Try Node filesystem resolution (for dev, local testing, and content-bootstrap manifests)
  if (typeof process !== 'undefined' && process.versions?.node) {
    try {
      const fsMod = 'node' + ':fs';
      const pathMod = 'node' + ':path';
      const fs = await import(/* @vite-ignore */ fsMod);
      const path = await import(/* @vite-ignore */ pathMod);

      // Known manifest paths by canonical slug / ID
      const candidatePaths: string[] = [];

      // Check dev fixtures mapping if available
      try {
        const { getBatch1ManifestPath } = await import('../approvals/dev-fixtures.ts');
        if (getBatch1ManifestPath) {
          const mapped = getBatch1ManifestPath(slug || articleId || '');
          if (mapped) candidatePaths.push(mapped);
        }
      } catch (_) {}

      // Common bootstrap paths
      if (articleId) {
        candidatePaths.push(`scripts/content-bootstrap/manifests/article-${articleId}-visual-manifest.json`);
      }
      if (slug) {
        candidatePaths.push(`scripts/content-bootstrap/manifests/${slug}-visual-manifest.json`);
        if (slug.includes('atap-metal')) {
          candidatePaths.push('scripts/content-bootstrap/manifests/article-4-visual-manifest.json');
        } else if (slug.includes('dinding-rembes')) {
          candidatePaths.push('scripts/content-bootstrap/manifests/job-02-visual-manifest.json');
        } else if (slug.includes('menata-denah')) {
          candidatePaths.push('scripts/content-bootstrap/manifests/job-03-visual-manifest.json');
        } else if (slug.includes('balkon')) {
          candidatePaths.push('scripts/content-bootstrap/manifests/job-04-balkon-visual-manifest.json');
          candidatePaths.push('scripts/content-bootstrap/manifests/article-9999-visual-manifest.json');
        } else if (slug.includes('japandi')) {
          candidatePaths.push('scripts/content-bootstrap/manifests/article-9992-visual-manifest.json');
        }
      }

      for (const relPath of candidatePaths) {
        const fullPath = path.resolve(process.cwd(), relPath);
        if (fs.existsSync(fullPath)) {
          const raw = fs.readFileSync(fullPath, 'utf8');
          const parsed = JSON.parse(raw);
          if (parsed && Array.isArray(parsed.visual_items)) {
            return parsed as VisualPlacementManifest;
          }
        }
      }
    } catch (err) {
      console.warn('[ManifestLoader] Could not load manifest from disk:', err);
    }
  }

  return null;
}
