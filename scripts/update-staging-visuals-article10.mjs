/**
 * RancangLoka — Safe Visual Manifest Updater for Staging Article ID 10
 *
 * Updates visual manifest in Cloudflare D1 Staging via settings table:
 * - visual_manifest:article:10
 * - visual_manifest:slug:ventilasi-dapur-tanpa-jendela-solusi-cooker-hood-resirkulasi-vs-exhaust-fan-dinding-canary-10011
 *
 * Invariants:
 * 1. Zero manuscript modification: articles table is NOT altered.
 * 2. Zero duplicate creation: No new article is inserted.
 * 3. Pure 16:9 responsive technical SVGs (1200x675).
 * 4. Zero internal test badges ("LOCAL TEST / NOT EDITORIALLY APPROVED").
 * 5. Passes Visual Semantic Quality Gate with score 100.
 */

import { execSync } from 'node:child_process';
import {
  generateKitchenAirflowComparisonSvg,
  generateVentilationEffectivenessSvg
} from '../src/lib/editorial/kitchen-ventilation-diagrams.ts';
import { evaluateVisualSemanticGate } from '../src/lib/editorial/visual-semantic-gate.ts';

const ARTICLE_ID = 10;
const SLUG = 'ventilasi-dapur-tanpa-jendela-solusi-cooker-hood-resirkulasi-vs-exhaust-fan-dinding-canary-10011';

async function main() {
  console.log(`🔍 [1/5] Membaca artikel ID ${ARTICLE_ID} dari Cloudflare D1 Staging...`);
  const queryCmd = `npx wrangler d1 execute rancangloka_staging_db --env staging --remote --json --command "SELECT id, title, slug, status, content_md FROM articles WHERE id = ${ARTICLE_ID}"`;
  const rawOutput = execSync(queryCmd, { encoding: 'utf8' });
  const parsed = JSON.parse(rawOutput);
  const article = parsed[0]?.results?.[0];

  if (!article) {
    console.error(`❌ Artikel ID ${ARTICLE_ID} tidak ditemukan di D1 Staging.`);
    process.exit(1);
  }

  console.log(`   ✓ Ditemukan: "${article.title}" (${article.slug}) - Status: ${article.status}`);

  console.log('📐 [2/5] Menyintesis 2 diagram teknis arsitektur 16:9 responsif...');
  const svg1 = generateKitchenAirflowComparisonSvg();
  const svg2 = generateVentilationEffectivenessSvg();

  const dataUri1 = `data:image/svg+xml;base64,${Buffer.from(svg1, 'utf8').toString('base64')}`;
  const dataUri2 = `data:image/svg+xml;base64,${Buffer.from(svg2, 'utf8').toString('base64')}`;

  console.log(`   ✓ Inline 1 Base64 SVG: ${dataUri1.length} karakter (Potongan Aliran Udara Dapur)`);
  console.log(`   ✓ Inline 2 Base64 SVG: ${dataUri2.length} karakter (Efektivitas & Hambatan Ventilasi)`);

  const manifest = {
    manifest_version: '2.0.0',
    article_id: String(ARTICLE_ID),
    article_slug: SLUG,
    featured: {
      src: 'https://images.unsplash.com/photo-1556911220-e15b29be8c8f?w=1200&auto=format&fit=crop&q=80',
      alt: `Visual editorial untuk ${article.title}`,
      caption: `Tampilan visual panduan arsitektural ${article.title}`
    },
    visual_items: [
      {
        visual_id: 'ast_10011_s1_diagram',
        slot_key: 'inline_1_apa_bedanya_cara_kerja__1',
        media_type: 'technical_diagram',
        priority: 'essential',
        placement: {
          target_heading_text: '1. Apa bedanya cara kerja kedua sistem?',
          position: 'after_heading'
        },
        visual_purpose: 'Menjelaskan perbedaan fisik dan arah aliran udara antara cooker hood resirkulasi tertutup dan exhaust fan pembuangan luar.',
        visual_brief: {
          prompt_indonesian: 'Diagram potongan arsitektur dapur yang memperlihatkan perbedaan aliran udara antara cooker hood resirkulasi dan exhaust fan dinding',
          storytelling_class: 'ENGINEERING_DIAGRAM',
          aspect_ratio: '16:9',
          intended_width: 1200,
          intended_height: 675
        },
        caption: 'Diagram Potongan Dapur: Perbedaan Aliran Udara Cooker Hood Resirkulasi vs Exhaust Fan Dinding',
        alt_text: 'Diagram potongan dapur yang memperlihatkan perbedaan aliran udara antara cooker hood resirkulasi dan exhaust fan dinding yang membuang udara keluar.',
        asset_id: 'ast_10011_s1',
        storage_key: dataUri1,
        review_status: 'PENDING',
        editorial_approval: 'PENDING'
      },
      {
        visual_id: 'ast_10011_s2_diagram',
        slot_key: 'inline_2_kapan_masing_masing_sistem__2',
        media_type: 'technical_diagram',
        priority: 'essential',
        placement: {
          target_heading_text: '2. Kapan masing-masing sistem terasa kurang efektif?',
          position: 'after_heading'
        },
        visual_purpose: 'Menganalisis kegagalan ventilasi akibat ruang terisolasi vakum (tanpa make-up air) dibandingkan sistem seimbang berkeseimbangan aliran udara.',
        visual_brief: {
          prompt_indonesian: 'Diagram kondisi efektivitas ventilasi dapur: ruang terisolasi vakum tanpa udara pengganti vs aliran udara berimbang dengan make-up air',
          storytelling_class: 'ENGINEERING_DIAGRAM',
          aspect_ratio: '16:9',
          intended_width: 1200,
          intended_height: 675
        },
        caption: 'Diagram Kondisi Efektivitas Ventilasi: Ruang Terisolasi vs Aliran Udara Berimbang',
        alt_text: 'Diagram kondisi ventilasi kurang efektif: tanpa udara pengganti, hambatan aliran, dan kondisi sistem dengan jalur udara masuk serta pembuangan yang memadai.',
        asset_id: 'ast_10011_s2',
        storage_key: dataUri2,
        review_status: 'PENDING',
        editorial_approval: 'PENDING'
      }
    ]
  };

  console.log('🛡️ [3/5] Menjalankan VISUAL SEMANTIC QUALITY GATE...');
  const gateResult = evaluateVisualSemanticGate(manifest, article.content_md);
  console.log(`   - Status Gate    : ${gateResult.passed ? '✅ PASS' : '❌ FAIL'} (Skor: ${gateResult.score}/100)`);
  console.log(`   - Heading Match  : ${gateResult.checks.heading_alignment.passed ? '✓' : '✗'} ${gateResult.checks.heading_alignment.message}`);
  console.log(`   - Object Fidelity: ${gateResult.checks.object_alignment.passed ? '✓' : '✗'} ${gateResult.checks.object_alignment.message}`);
  console.log(`   - Clipping Guard : ${gateResult.checks.clipping_defense.passed ? '✓' : '✗'} ${gateResult.checks.clipping_defense.message}`);
  console.log(`   - Editorial Purity: ${gateResult.checks.editorial_purity.passed ? '✓' : '✗'} ${gateResult.checks.editorial_purity.message}`);
  console.log(`   - Monetary Silence: ${gateResult.checks.monetary_silence.passed ? '✓' : '✗'} ${gateResult.checks.monetary_silence.message}`);

  if (!gateResult.passed) {
    console.error('❌ Gagal lolos Visual Semantic Quality Gate:', gateResult.violations);
    process.exit(1);
  }

  console.log('💾 [4/5] Memperbarui visual_manifest di Cloudflare D1 Staging (settings table)...');
  const manifestJson = JSON.stringify(manifest);

  // Escaping single quotes for SQL string literal
  const escapedJson = manifestJson.replace(/'/g, "''");

  const updateArticleSql = `INSERT INTO settings (key, value, updated_at) VALUES ('visual_manifest:article:${ARTICLE_ID}', '${escapedJson}', CURRENT_TIMESTAMP) ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = CURRENT_TIMESTAMP;`;
  const updateSlugSql = `INSERT INTO settings (key, value, updated_at) VALUES ('visual_manifest:slug:${SLUG}', '${escapedJson}', CURRENT_TIMESTAMP) ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = CURRENT_TIMESTAMP;`;

  // Write temporary SQL file to prevent command line length issues
  const fs = await import('node:fs');
  const path = await import('node:path');
  const tempSqlPath = path.resolve('temp_update_visuals.sql');
  fs.writeFileSync(tempSqlPath, `${updateArticleSql}\n${updateSlugSql}`, 'utf8');

  try {
    const applyCmd = `npx wrangler d1 execute rancangloka_staging_db --env staging --remote --file="${tempSqlPath}"`;
    const applyOutput = execSync(applyCmd, { encoding: 'utf8' });
    console.log('   ✓ D1 Staging settings table berhasil diperbarui.');
  } finally {
    if (fs.existsSync(tempSqlPath)) {
      fs.unlinkSync(tempSqlPath);
    }
  }

  console.log('🌐 [5/5] Memvalidasi hasil manifest yang tersimpan di remote D1...');
  const verifyCmd = `npx wrangler d1 execute rancangloka_staging_db --env staging --remote --json --command "SELECT key, substr(value, 1, 120) as val_sample, updated_at FROM settings WHERE key = 'visual_manifest:article:${ARTICLE_ID}'"`;
  const verifyOutput = execSync(verifyCmd, { encoding: 'utf8' });
  const verifyJson = JSON.parse(verifyOutput);
  console.log('   ✓ Remote Verified:', verifyJson[0]?.results?.[0]);

  console.log('\n================================================================');
  console.log('🎉 VISUAL SEMANTIC FIX SELESAI & DIPERBARUI KE CLOUDFLARE STAGING!');
  console.log('================================================================');
  console.log(`Article ID    : ${ARTICLE_ID}`);
  console.log(`Slug          : ${SLUG}`);
  console.log(`Preview URL   : https://rancangloka-staging.chandrajoyko.workers.dev/admin/preview/${SLUG}?mode=reader`);
}

main().catch(err => {
  console.error('❌ Gagal memperbarui visual:', err);
  process.exit(1);
});
