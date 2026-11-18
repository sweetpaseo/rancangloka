import { execSync } from 'node:child_process';
import { resolveVisualPlacements } from '../src/lib/media/anchor-resolver.ts';
import { renderArticleMarkdownSafely } from '../src/lib/article/renderer.ts';

const ARTICLE_ID = 10;
console.log('🔍 Mengambil data artikel & manifest aktual dari Cloudflare D1 Staging...');

const qArticle = `npx wrangler d1 execute rancangloka_staging_db --env staging --remote --json --command "SELECT id, title, slug, content_md FROM articles WHERE id = ${ARTICLE_ID}"`;
const resArticle = JSON.parse(execSync(qArticle, { encoding: 'utf8' }));
const article = resArticle[0]?.results?.[0];

const qManifest = `npx wrangler d1 execute rancangloka_staging_db --env staging --remote --json --command "SELECT value FROM settings WHERE key = 'visual_manifest:article:${ARTICLE_ID}'"`;
const resManifest = JSON.parse(execSync(qManifest, { encoding: 'utf8' }));
const manifest = JSON.parse(resManifest[0]?.results?.[0]?.value);

console.log(`✓ Artikel: "${article.title}"`);
console.log(`✓ Manifest Slug: ${manifest.article_slug}`);
console.log(`✓ Jumlah Item Visual: ${manifest.visual_items.length}`);

for (const item of manifest.visual_items) {
  console.log(`  - Visual ID: ${item.visual_id}`);
  console.log(`    Slot Key: ${item.slot_key}`);
  console.log(`    Target Heading: "${item.placement.target_heading_text}"`);
  console.log(`    Caption: "${item.caption}"`);
  console.log(`    Alt Text: "${item.alt_text}"`);
  console.log(`    Storage Key Prefix: ${item.storage_key.slice(0, 45)}... (Total: ${item.storage_key.length} chars)`);
}

const html = await renderArticleMarkdownSafely(article.content_md);
const resolved = resolveVisualPlacements(html, manifest, {
  allowUnapprovedInPreview: true
});

console.log('\n📊 HASIL RESOLUSI HTML PREVIEW:');
console.log(`- Resolusi Valid     : ${resolved.isValid ? 'YES' : 'NO'}`);
console.log(`- Visual Terpasang   : ${resolved.placedCount} / ${manifest.visual_items.length}`);
console.log(`- Warnings Count     : ${resolved.warnings.length}`);

const hasInternalBadge = resolved.html.includes('LOCAL TEST / NOT EDITORIALLY APPROVED') || resolved.html.includes('Fixture Media - Belum Disetujui');
console.log(`- Internal Test Badge: ${hasInternalBadge ? '❌ DITEMUKAN' : '✅ BERSIH (0 internal badge)'}`);

const hasSlot1 = resolved.html.includes('data-media-slot="inline_1_apa_bedanya_cara_kerja__1"');
const hasSlot2 = resolved.html.includes('data-media-slot="inline_2_kapan_masing_masing_sistem__2"');
console.log(`- Slot 1 Ditemukan   : ${hasSlot1 ? '✅ YA' : '❌ TIDAK'}`);
console.log(`- Slot 2 Ditemukan   : ${hasSlot2 ? '✅ YA' : '❌ TIDAK'}`);

if (!resolved.isValid || resolved.placedCount !== 2 || hasInternalBadge || !hasSlot1 || !hasSlot2) {
  console.error('❌ Verifikasi gagal!');
  process.exit(1);
}

console.log('\n🎉 VERIFIKASI D1 STAGING & HTML RENDER SUKSES 100%!');
