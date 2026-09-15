const MEDIA_ANCHOR_PATTERN = /\{\{media:([a-z][a-z0-9_]{1,63})\}\}/g;

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export function hasMediaAnchors(html: string): boolean {
  return MEDIA_ANCHOR_PATTERN.test(html);
}

export async function renderMediaSlotAnchors(db: any, articleId: number, html: string): Promise<string> {
  const slotKeys = Array.from(new Set(Array.from(html.matchAll(MEDIA_ANCHOR_PATTERN)).map((m) => m[1])));
  if (slotKeys.length === 0 || !db) return html.replace(MEDIA_ANCHOR_PATTERN, '');

  const rendered = new Map<string, string>();
  for (const slotKey of slotKeys) {
    try {
      const row = await db
        .prepare(
          `
          SELECT ma.public_url, ma.alt_text, am.caption
          FROM article_media am
          JOIN media_assets ma ON am.asset_id = ma.asset_id
          WHERE am.article_id = ?
            AND am.slot_key = ?
            AND am.is_active = 1
            AND ma.status = 'VALIDATED'
            AND ma.media_type = 'image'
          LIMIT 1
        `
        )
        .bind(articleId, slotKey)
        .first();
      if (!row?.public_url) {
        rendered.set(slotKey, '');
        continue;
      }
      const alt = escapeHtml(String(row.alt_text || 'Media artikel RancangLoka'));
      const caption = row.caption ? `<figcaption>${escapeHtml(String(row.caption))}</figcaption>` : '';
      rendered.set(
        slotKey,
        `<figure class="rl-media-slot my-8" data-media-slot="${escapeHtml(slotKey)}"><img src="${escapeHtml(String(row.public_url))}" alt="${alt}" loading="lazy" decoding="async" />${caption}</figure>`
      );
    } catch (_) {
      rendered.set(slotKey, '');
    }
  }

  return html.replace(MEDIA_ANCHOR_PATTERN, (_match, slotKey) => rendered.get(slotKey) || '');
}
