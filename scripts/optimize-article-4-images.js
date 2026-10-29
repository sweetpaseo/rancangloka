import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import sharp from 'sharp';

const img1Src = 'C:/Users/Fanto/.gemini/antigravity-ide/brain/52f042ce-8ae6-45be-824e-f261b10b3d71/art4_material_comparison_1793119361639.jpg';
const img2Src = 'C:/Users/Fanto/.gemini/antigravity-ide/brain/52f042ce-8ae6-45be-824e-f261b10b3d71/art4_thermal_concept_1793119386144.jpg';

const outDir = path.resolve('public/media/images');
if (!fs.existsSync(outDir)) {
  fs.mkdirSync(outDir, { recursive: true });
}

async function processImage(srcPath, baseName) {
  const targetWidth = 1200;
  const targetHeight = 675;

  const webpBuffer = await sharp(srcPath)
    .resize(targetWidth, targetHeight, {
      fit: 'cover',
      position: 'center'
    })
    .webp({ quality: 85, effort: 6 })
    .toBuffer();

  const sha256 = crypto.createHash('sha256').update(webpBuffer).digest('hex');
  const filename = `${sha256}.webp`;
  const destPath = path.join(outDir, filename);

  fs.writeFileSync(destPath, webpBuffer);

  // Also write named copy for convenient static linking if needed
  const namedDestPath = path.join(outDir, `${baseName}.webp`);
  fs.writeFileSync(namedDestPath, webpBuffer);

  const meta = await sharp(destPath).metadata();

  console.log(`[PROCESSED] ${baseName}:`);
  console.log(`  Source: ${srcPath}`);
  console.log(`  SHA-256: ${sha256}`);
  console.log(`  File: ${filename}`);
  console.log(`  Dimensions: ${meta.width}x${meta.height}`);
  console.log(`  Size: ${webpBuffer.length} bytes\n`);

  return {
    sha256,
    filename,
    namedFilename: `${baseName}.webp`,
    width: meta.width,
    height: meta.height,
    sizeBytes: webpBuffer.length,
    base64: `data:image/webp;base64,${webpBuffer.toString('base64')}`
  };
}

async function main() {
  console.log('--- Processing Budi Visual Candidates for Article 4 ---');
  const img1 = await processImage(img1Src, 'article4_inline_material_comparison_1200x675');
  const img2 = await processImage(img2Src, 'article4_inline_thermal_concept_1200x675');

  // Update visual manifest
  const manifestPath = path.resolve('scripts/content-bootstrap/manifests/article-4-visual-manifest.json');
  const manifest = {
    manifest_version: '2.0.0',
    article_id: 4,
    article_slug: 'perbedaan-atap-metal-dan-genteng-beton-untuk-rumah-tropis',
    approved_manuscript_sha256: '849251221a986701da4cf681e3f8ff2d08b04833115c7f6a661f59699808e257',
    editorial_status: 'LOCKED_AND_APPROVED',
    visual_production_status: 'BUDI_LOCAL_MEDIA_PREPARED',
    owner_visual_approval: 'PENDING_OWNER_REVIEW',
    visual_items: [
      {
        visual_id: 'vis-art4-01-metal-vs-beton-comparison',
        slot_key: 'inline_material_comparison_1',
        asset_id: `ast_${img1.sha256.substring(0, 24)}`,
        media_type: 'photograph',
        storytelling_class: 'COMPARATIVE_VISUAL',
        priority: 'essential',
        placement: {
          target_heading_text: '1. Perbedaan Mendasar Bentuk Fisik dan Pemasangannya',
          position: 'after_paragraph_containing',
          paragraph_anchor_phrase: 'Perbedaan bentuk fisik ini—kepingan modular yang bertumpuk versus lembaran panjang menerus'
        },
        visual_purpose: 'Perbandingan visual nyata antara kepingan genteng beton modular tebal dan lembaran atap metal berprofil gelombang pada meja kerja bahan bangunan untuk memperjelas perbedaan fisik dan profil di bawah cahaya alami tropis.',
        caption: 'Perbandingan fisik material penutup atap: kepingan genteng beton modular tebal (kiri) versus lembaran atap metal berprofil gelombang tipis (kanan) berdampingan di bawah cahaya alami tropis.',
        alt_text: 'Perbandingan material kepingan genteng beton tebal modular dan lembaran atap metal bergelombang berdampingan di atas meja kerja kayu',
        content_sha256: img1.sha256,
        filename: img1.filename,
        local_path: `public/media/images/${img1.filename}`,
        aspect_ratio: '16:9',
        width: img1.width,
        height: img1.height,
        mime_type: 'image/webp',
        size_bytes: img1.sizeBytes,
        review_status: 'PENDING_OWNER_REVIEW',
        editorial_approval: 'APPROVED'
      },
      {
        visual_id: 'vis-art4-02-thermal-dynamics',
        slot_key: 'inline_concept_diagram_1',
        asset_id: `ast_${img2.sha256.substring(0, 24)}`,
        media_type: 'annotated_illustration',
        storytelling_class: 'COMPARATIVE_VISUAL',
        priority: 'essential',
        placement: {
          target_heading_text: '2. Kinerja Termal: Sifat Bahan vs Kenyamanan Nyata di Rumah',
          position: 'after_heading'
        },
        visual_purpose: 'Ilustrasi potongan arsitektur menjelaskan dinamika termal rakitan atap tropis: perbedaan kapasitas simpan panas (thermal lag) genteng beton versus aliran pembuangan panas konveksi celah berventilasi atap metal.',
        caption: 'Karakter termal rakitan atap tropis: Genteng beton menyerap radiasi siang bertahap dan menahan panas di dalam massa genteng (thermal lag), sedangkan atap metal lekas melepas panas permukaan namun mengandalkan celah ventilasi udara untuk membuang hawa panas sebelum menyentuh plafon.',
        alt_text: 'Ilustrasi potongan arsitektur perbandingan dinamika perpindahan panas rakitan atap genteng beton dengan massa termal tebal versus atap metal tipis dengan celah udara berventilasi',
        content_sha256: img2.sha256,
        filename: img2.filename,
        local_path: `public/media/images/${img2.filename}`,
        aspect_ratio: '16:9',
        width: img2.width,
        height: img2.height,
        mime_type: 'image/webp',
        size_bytes: img2.sizeBytes,
        review_status: 'PENDING_OWNER_REVIEW',
        editorial_approval: 'APPROVED'
      }
    ]
  };

  fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2), 'utf8');
  console.log(`[MANIFEST] Updated ${manifestPath}`);

  // Create durable editorial approval record
  const approvalRecordPath = path.resolve('scripts/content-bootstrap/article-4-rehab/editorial-approval-record.json');
  const approvalRecord = {
    article_id: 4,
    canonical_slug: 'perbedaan-atap-metal-dan-genteng-beton-untuk-rumah-tropis',
    approved_manuscript_file: 'scripts/content-bootstrap/article-4-rehab/article-4-editorial-candidate-v3.md',
    approved_manuscript_sha256: '849251221a986701da4cf681e3f8ff2d08b04833115c7f6a661f59699808e257',
    editorial_content_status: 'LOCKED_AND_APPROVED',
    owner_explicit_statement: 'Saya setujui naskah editorial final Article 4 V3 dengan SHA-256 849251221a986701da4cf681e3f8ff2d08b04833115c7f6a661f59699808e257. Kunci naskah dan siapkan produksi dua gambar Budi. Belum ada izin publikasi live.',
    approved_by: 'owner_chief_editor',
    approved_at: new Date().toISOString(),
    visual_media_status: 'PENDING_OWNER_REVIEW',
    live_publication_authorized: false,
    media_assets: [
      {
        slot_key: 'inline_material_comparison_1',
        filename: img1.filename,
        sha256: img1.sha256,
        dimensions: `${img1.width}x${img1.height}`
      },
      {
        slot_key: 'inline_concept_diagram_1',
        filename: img2.filename,
        sha256: img2.sha256,
        dimensions: `${img2.width}x${img2.height}`
      }
    ]
  };
  fs.writeFileSync(approvalRecordPath, JSON.stringify(approvalRecord, null, 2), 'utf8');
  console.log(`[APPROVAL RECORD] Written ${approvalRecordPath}`);
}

main().catch(console.error);
