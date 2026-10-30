import { createAdminSessionToken } from '../src/lib/auth.ts';

const slugs = [
  'dinding-rembes-dan-cat-menggelembung-cara-membedakan-masalah-talang-plesteran-kelembapan-tanah',
  '7-ide-menata-balkon-rumah-kecil-agar-nyaman',
  'menata-denah-rumah-lebar-5-6-meter-solusi-sirkulasi-bukaan-ruang-tengah-tidak-pengap'
];

async function testPreviews() {
  const token = await createAdminSessionToken();

  for (const s of slugs) {
    const res = await fetch('http://localhost:4321/admin/preview/' + s, {
      headers: { Cookie: `admin_session=${token}` }
    });
    const html = await res.text();
    console.log(`\n=== SLUG: ${s} (HTTP ${res.status}) ===`);

    // Check Hero Image
    const heroMatch = html.match(/<!-- Featured Image Hero or Editorial Placeholder -->\s*<figure[^>]*>[\s\S]*?<img[^>]*src="([^"]+)"[^>]*alt="([^"]+)"/);
    if (heroMatch) {
      console.log('  [HERO PRESENT]:', heroMatch[1]);
      console.log('  [HERO ALT]:    ', heroMatch[2]);
    } else {
      console.log('  [HERO MISSING!]');
    }

    // Check Inline Figures
    const inlineFigures = Array.from(
      html.matchAll(/<figure class="rl-media-slot[^"]*" data-media-slot="([^"]+)"[^>]*>([\s\S]*?)<\/figure>/g)
    );
    console.log('  [INLINE FIGURES COUNT]:', inlineFigures.length);
    for (const fig of inlineFigures) {
      const slot = fig[1];
      const imgMatch = fig[2].match(/<img[^>]*src="([^"]+)"[^>]*alt="([^"]+)"/);
      const isPlaceholder = fig[2].includes('PROPOSAL VISUAL EDITORIAL');
      if (imgMatch) {
        console.log(`    Slot "${slot}" -> IMG: ${imgMatch[1]}`);
        console.log(`      ALT: ${imgMatch[2]}`);
      } else if (isPlaceholder) {
        console.log(`    Slot "${slot}" -> WARNING: PLACEHOLDER DETECTED`);
      } else {
        console.log(`    Slot "${slot}" -> unknown markup`);
      }
    }
  }
}

testPreviews().catch(console.error);
