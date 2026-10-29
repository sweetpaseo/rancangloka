import fs from 'node:fs';
import path from 'node:path';
import sharp from 'sharp';

const DIR = 'public/media/images';
const TARGET_WIDTHS = [480, 640, 960];

async function generateVariants() {
  console.log('====================================================');
  console.log('  Generating Responsive WebP Image Variants');
  console.log('====================================================\n');

  const files = fs.readdirSync(DIR).filter(f => f.endsWith('.webp') && !f.includes('-480') && !f.includes('-640') && !f.includes('-960'));
  
  const report = [];

  for (const file of files) {
    const inputPath = path.join(DIR, file);
    const inputBuffer = fs.readFileSync(inputPath);
    const meta = await sharp(inputBuffer).metadata();
    const origSize = inputBuffer.length;
    const baseName = file.replace(/\.webp$/i, '');

    console.log(`Processing: ${file} (${meta.width}x${meta.height}, ${(origSize / 1024).toFixed(1)} KB)`);

    const fileReport = {
      file,
      origWidth: meta.width,
      origHeight: meta.height,
      origSize,
      variants: {}
    };

    for (const w of TARGET_WIDTHS) {
      if (w >= meta.width) continue; // Do not upscale

      const outName = `${baseName}-${w}.webp`;
      const outPath = path.join(DIR, outName);

      // Maintain exact aspect ratio, high-quality Lanczos3 resample, WebP q82 (crisp, zero visible artifacts)
      const variantBuffer = await sharp(inputBuffer)
        .resize({ width: w, withoutEnlargement: true })
        .webp({ quality: 82, effort: 5 })
        .toBuffer();

      fs.writeFileSync(outPath, variantBuffer);
      const varSize = variantBuffer.length;
      const savingPct = (((origSize - varSize) / origSize) * 100).toFixed(1);

      fileReport.variants[w] = {
        name: outName,
        size: varSize,
        savingPct
      };

      console.log(`  -> ${outName}: ${(varSize / 1024).toFixed(1)} KB (Saved ${savingPct}%)`);
    }

    report.push(fileReport);
  }

  console.log('\n====================================================');
  console.log('  RESPONSIVE GENERATION COMPLETE');
  console.log('====================================================');

  fs.writeFileSync('scratch/responsive_variants_report.json', JSON.stringify(report, null, 2));
  console.log('Report saved to scratch/responsive_variants_report.json');
}

generateVariants().catch(err => {
  console.error('Fatal error generating variants:', err);
  process.exit(1);
});
