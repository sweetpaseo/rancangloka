import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import sharp from 'sharp';

const brainDir = 'C:\\Users\\Fanto\\.gemini\\antigravity-ide\\brain\\e3ccebfd-211e-4582-b4dc-bb97605b744f';
const targetDir = path.resolve('public/media/images');

const images = [
  {
    key: 'inline_overhang_1',
    src: path.join(brainDir, 'article_c_overhang_shading_1793088537007.jpg'),
    targetName: 'article_c_overhang_tritisan',
    slotHeading: '1. Overhang (Tritisan Atap): Peneduh Tetap yang Bebas Perawatan Mekanis',
    altText: 'Tritisan atap beton lebar menjorok di atas deretan jendela kaca rumah tropis modern menghasilkan bidang bayangan teduh.',
    caption: 'Tritisan atap beton menaungi jendela lantai atas dari matahari bersudut tinggi di siang hari sekaligus melindungi kusen dari tempias hujan.'
  },
  {
    key: 'inline_louver_1',
    src: path.join(brainDir, 'article_c_louver_comparison_1793088561923.jpg'),
    targetName: 'article_c_louver_kisi_kisi',
    slotHeading: '2. Louver (Kisi-Kisi): Menyaring Silau Tanpa Mematikan Aliran Udara',
    altText: 'Komposisi kisi-kisi bilah horizontal di atas dan bilah vertikal di bawah menyaring sudut datang matahari tropis.',
    caption: 'Kisi-kisi bilah horizontal efektif meredam matahari tengah hari dari atas, sementara bilah vertikal memotong sudut datang matahari condong miring dari samping.'
  },
  {
    key: 'inline_awning_1',
    src: path.join(brainDir, 'article_c_awning_canopy_1793088583263.jpg'),
    targetName: 'article_c_awning_kanopi',
    slotHeading: '3. Awning atau Kanopi: Solusi Praktis untuk Rumah yang Sudah Dihuni',
    altText: 'Kanopi awning eksterior terpasang rapi dengan kemiringan talang air di atas jendela kamar lantai dua rumah tinggal.',
    caption: 'Awning atau kanopi bukaan menjadi solusi peneduh tambahan yang praktis untuk rumah yang sudah dihuni tanpa merombak atap utama.'
  },
  {
    key: 'inline_secondary_facade_1',
    src: path.join(brainDir, 'article_c_secondary_facade_1793088605921.jpg'),
    targetName: 'article_c_secondary_facade_roster',
    slotHeading: '4. Secondary Facade (Fasad Lapis Kedua): Pelindung untuk Bidang Dinding yang Luas',
    altText: 'Fasad lapis kedua bata roster semen putih dengan rongga udara berventilasi di depan dinding kaca rumah tropis.',
    caption: 'Fasad lapis kedua berbahan bata roster menciptakan kantong udara berventilasi di depan dinding utama, melindungi ruangan dari panas radiasi matahari sore.'
  }
];

async function main() {
  console.log('Optimizing Article C 4 inline images to 16:9 WebP...');
  const results = [];

  for (const img of images) {
    if (!fs.existsSync(img.src)) {
      throw new Error(`Source image not found: ${img.src}`);
    }

    // Process with sharp: resize to 1200x675 (16:9), webp quality 82
    const buffer = await sharp(img.src)
      .resize(1200, 675, { fit: 'cover' })
      .webp({ quality: 82, effort: 4 })
      .toBuffer();

    const sha256 = crypto.createHash('sha256').update(buffer).digest('hex');
    const assetId = `ast_${sha256.substring(0, 24)}`;
    const filename = `${sha256}.webp`;
    const destPath = path.join(targetDir, filename);

    fs.writeFileSync(destPath, buffer);
    console.log(`Saved: ${filename} (${buffer.length} bytes, SHA: ${sha256.substring(0, 16)}...)`);

    results.push({
      slot_key: img.key,
      asset_id: assetId,
      filename,
      public_url: `/media/images/${filename}`,
      storage_key: `media/images/${filename}`,
      sha256,
      dimensions: '1200x675',
      width: 1200,
      height: 675,
      alt_text: img.altText,
      caption: img.caption,
      slot_heading: img.slotHeading
    });
  }

  // Update visual manifest
  const manifestPath = path.resolve('scripts/content-bootstrap/manifests/article-c-visual-manifest.json');
  const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));

  manifest.content_hash = '885b998073acecf5371d2b9dc3f7f65ba273bb59389b97473118bc49f924af78';

  for (const res of results) {
    const item = manifest.visual_items.find(v => v.slot_key === res.slot_key);
    if (item) {
      item.asset_id = res.asset_id;
      item.storage_key = res.storage_key;
      item.public_url = res.public_url;
      item.sha256 = res.sha256;
      item.review_status = 'AVAILABLE_LOCAL_CANDIDATE';
      item.alt_text = res.alt_text;
      item.caption = res.caption;
      item.dimensions = res.dimensions;
    }
  }

  fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2), 'utf8');
  console.log('Updated manifest at:', manifestPath);

  // Save results JSON for reference
  const outJson = path.resolve('scripts/content-bootstrap/manifests/article-c-prepared-images.json');
  fs.writeFileSync(outJson, JSON.stringify(results, null, 2), 'utf8');
  console.log('Saved prepared images summary at:', outJson);
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
