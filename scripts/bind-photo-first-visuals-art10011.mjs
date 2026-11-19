/**
 * RANCANGLOKA — PHOTO-FIRST VISUAL BINDING FOR STAGING ARTICLE #10011
 *
 * Binds the approved Kling Omni Photo-First public WebP watermarked derivatives
 * to Article ID 10 in Cloudflare D1 Staging via:
 * 1. articles table: featured_image & image_alt (status STRICTLY PRESERVED AS 'draft').
 * 2. settings table: visual_manifest:article:10 & visual_manifest:slug:...
 *
 * INVARIANTS:
 * - articles.status remains strictly 'draft' (zero auto-publish, zero publication).
 * - Only watermarked public derivatives are bound (zero raw master leakage).
 * - Resolves cleanly through resolveVisualPlacements.
 */

import fs from 'node:fs';
import path from 'node:path';
import { execSync } from 'node:child_process';
import { resolveVisualPlacements } from '../src/lib/media/anchor-resolver.ts';
import { renderArticleMarkdownSafely } from '../src/lib/article/renderer.ts';

const ARTICLE_ID = 10;
const SLUG = 'ventilasi-dapur-tanpa-jendela-solusi-cooker-hood-resirkulasi-vs-exhaust-fan-dinding-canary-10011';

const COVER_WEBP_URL = '/media/articles/10011/derivatives/art10011_cover_kling_omni_watermarked.webp';
const INLINE_V2_WEBP_URL = '/media/articles/10011/derivatives/art10011_inline1_v2_kling_omni_watermarked.webp';

async function main() {
  console.log('================================================================');
  console.log('📸 RANCANGLOKA — BINDING PHOTO-FIRST VISUALS TO STAGING ARTICLE #10');
  console.log('================================================================\n');

  // 1. Fetch current article from D1 Staging
  console.log('🔍 [1/4] Memeriksa artikel ID 10 di Cloudflare D1 Staging...');
  const qArticle = `npx wrangler d1 execute rancangloka_staging_db --env staging --remote --json --command "SELECT id, title, slug, status, content_md FROM articles WHERE id = ${ARTICLE_ID}"`;
  const resArticle = JSON.parse(execSync(qArticle, { encoding: 'utf8' }));
  const article = resArticle[0]?.results?.[0];

  if (!article) {
    throw new Error(`Artikel ID ${ARTICLE_ID} tidak ditemukan di D1 Staging!`);
  }

  console.log(`   ✓ Ditemukan: "${article.title}"`);
  console.log(`   ✓ Status saat ini: ${article.status} (Wajib tetap 'draft')`);

  if (article.status !== 'draft') {
    throw new Error(`Invarian keselamatan dilanggar: artikel berstatus ${article.status}, harus 'draft'!`);
  }

  // 2. Build Photo-First Visual Manifest
  console.log('\n📝 [2/4] Menyusun Visual Manifest Photo-First (Cover + Inline v2 WebP Watermarked)...');
  const manifest = {
    manifest_version: '3.0.0_photo_first',
    article_id: String(ARTICLE_ID),
    article_slug: SLUG,
    featured: {
      src: COVER_WEBP_URL,
      alt: 'Dapur kompak modern tropis tanpa jendela dengan cooker hood ramping stainless steel dan kabinet jati muda',
      caption: 'Pencahayaan ambien hangat dan ventilasi mekanis pada dapur kompak tanpa bukaan jendela luar.'
    },
    visual_items: [
      {
        visual_id: 'art10011_inline1_v2_kling_omni',
        slot_key: 'inline_1_apa_bedanya_cara_kerja__1',
        media_type: 'editorial_photo',
        priority: 'essential',
        placement: {
          target_heading_text: '1. Apa bedanya cara kerja kedua sistem?',
          position: 'after_heading'
        },
        visual_purpose: 'Menampilkan titik hisap cooker hood slim di bawah kabinet gantung jati muda dan kompor induksi kaca datar dalam sudut medium shot editorial.',
        caption: 'Titik hisap cooker hood slim di bawah kabinet dapur kompak tanpa bukaan jendela luar.',
        alt_text: 'Zona memasak dapur dengan kompor induksi tanam dan cooker hood slim stainless steel di bawah kabinet gantung jati muda.',
        storage_key: INLINE_V2_WEBP_URL,
        review_status: 'NEEDS_REVIEW',
        editorial_approval: 'PENDING'
      }
    ]
  };

  const manifestJsonStr = JSON.stringify(manifest).replace(/'/g, "''");

  // 3. Update D1 Staging via temporary SQL file (bulletproof against shell escaping)
  console.log('\n💾 [3/4] Memutakhirkan database D1 Staging...');

  const tempSqlPath = path.resolve('storage/masters/art10011/temp_bind_manifest.sql');
  const coverAltEscaped = "Dapur kompak modern tropis tanpa jendela dengan cooker hood ramping stainless steel dan kabinet jati muda".replace(/'/g, "''");

  const sqlStatements = [
    `INSERT OR REPLACE INTO settings (key, value) VALUES ('visual_manifest:article:${ARTICLE_ID}', '${manifestJsonStr}');`,
    `INSERT OR REPLACE INTO settings (key, value) VALUES ('visual_manifest:slug:${SLUG}', '${manifestJsonStr}');`,
    `UPDATE articles SET featured_image = '${COVER_WEBP_URL}', image_alt = '${coverAltEscaped}' WHERE id = ${ARTICLE_ID} AND status = 'draft';`
  ].join('\n');

  fs.writeFileSync(tempSqlPath, sqlStatements, 'utf8');

  try {
    const cmdExecute = `npx wrangler d1 execute rancangloka_staging_db --env staging --remote --file "${tempSqlPath}"`;
    execSync(cmdExecute, { stdio: 'inherit' });
    console.log('   ✓ D1 Staging manifest dan artikel berhasil diperbarui via SQL file.');
  } finally {
    if (fs.existsSync(tempSqlPath)) {
      fs.unlinkSync(tempSqlPath);
    }
  }

  // 4. Verify resolution & invariants
  console.log('\n🔍 [4/4] Memverifikasi resolusi HTML render & invarian keselamatan...');

  const qVerify = `npx wrangler d1 execute rancangloka_staging_db --env staging --remote --json --command "SELECT id, title, slug, status, featured_image, image_alt FROM articles WHERE id = ${ARTICLE_ID}"`;
  const resVerify = JSON.parse(execSync(qVerify, { encoding: 'utf8' }));
  const verifiedArticle = resVerify[0]?.results?.[0];

  console.log(`   ✓ Status Artikel : ${verifiedArticle.status} (100% DRAFT)`);
  console.log(`   ✓ Featured Image : ${verifiedArticle.featured_image}`);
  console.log(`   ✓ Image Alt      : ${verifiedArticle.image_alt}`);

  if (verifiedArticle.status !== 'draft') {
    throw new Error('FATAL: Status artikel berubah dari draft!');
  }
  if (!verifiedArticle.featured_image.includes('watermarked.webp')) {
    throw new Error('FATAL: Featured image bukan watermarked WebP!');
  }

  // Verify HTML placement
  const html = await renderArticleMarkdownSafely(article.content_md);
  const resolved = resolveVisualPlacements(html, manifest, { allowUnapprovedInPreview: true });

  console.log(`   ✓ HTML Resolution Valid : ${resolved.isValid ? 'YES' : 'NO'}`);
  console.log(`   ✓ Visual Items Placed   : ${resolved.placedCount} / ${manifest.visual_items.length}`);
  console.log(`   ✓ Inline Image Placed   : ${resolved.html.includes(INLINE_V2_WEBP_URL) ? 'YES' : 'NO'}`);

  if (!resolved.isValid || resolved.placedCount !== 1 || !resolved.html.includes(INLINE_V2_WEBP_URL)) {
    throw new Error('Resolusi penempatan visual Photo-First gagal!');
  }

  console.log('\n================================================================');
  console.log('🎉 PENGISIAN MEDIA CMS ARTICLE #10011 SUKSES LENGKAP!');
  console.log('================================================================\n');
}

main().catch((err) => {
  console.error('❌ Error:', err);
  process.exit(1);
});
