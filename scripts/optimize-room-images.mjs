import fs from 'node:fs';
import path from 'node:path';
import sharp from 'sharp';

const ROOM_DIR = 'public/media/rooms';
if (!fs.existsSync(ROOM_DIR)) {
  fs.mkdirSync(ROOM_DIR, { recursive: true });
}

const ROOMS = [
  { name: 'ruang-tamu.webp', url: 'https://images.unsplash.com/photo-1600585154340-be6161a56a0c?w=600&auto=format&fit=crop&q=80' },
  { name: 'dapur.webp', url: 'https://images.unsplash.com/photo-1556911220-e15b29be8c8f?w=600&auto=format&fit=crop&q=80' },
  { name: 'kamar-tidur.webp', url: 'https://images.unsplash.com/photo-1616594039964-ae9021a400a0?w=600&auto=format&fit=crop&q=80' },
  { name: 'teras-balkon.webp', url: 'https://images.unsplash.com/photo-1598928506311-c55ded91a20c?w=600&auto=format&fit=crop&q=80' }
];

async function optimizeRooms() {
  console.log('Optimizing room category images into local WebP...');
  for (const r of ROOMS) {
    const outPath = path.join(ROOM_DIR, r.name);
    console.log(`Fetching ${r.url}...`);
    const res = await fetch(r.url);
    const buf = Buffer.from(await res.arrayBuffer());
    console.log(`Original fetched size: ${(buf.length / 1024).toFixed(1)} KB`);

    // Resize to 480x320 at q80
    const optimized = await sharp(buf)
      .resize({ width: 480, height: 320, fit: 'cover' })
      .webp({ quality: 80 })
      .toBuffer();

    fs.writeFileSync(outPath, optimized);
    console.log(`Saved ${outPath}: ${(optimized.length / 1024).toFixed(1)} KB`);
  }
}

optimizeRooms().catch(err => {
  console.error('Error optimizing rooms:', err);
  process.exit(1);
});
