async function test() {
  const targets = [
    { name: 'Article 4', url: 'http://127.0.0.1:8788/perbedaan-atap-metal-dan-genteng-beton-untuk-rumah-tropis' },
    { name: 'Article C', url: 'http://127.0.0.1:8788/memilih-sistem-shading-luar-rumah-tropis' },
    { name: 'Article 5', url: 'http://127.0.0.1:8788/kusen-aluminium-vs-upvc-untuk-rumah-tropis-di-indonesia' }
  ];

  console.log('=== VERIFYING RELATED ARTICLES ON KEY ROUTES ===\n');

  for (const t of targets) {
    try {
      const res = await fetch(t.url);
      const html = await res.text();
      const hasHeading = html.includes('Baca Juga di RancangLoka');
      const hasSubheading = html.includes('Artikel pilihan untuk melanjutkan eksplorasi rumahmu.');
      const hasRecommendationEyebrow = html.includes('Rekomendasi Editor');

      // Extract card titles inside the related section
      const relatedIndex = html.indexOf('aria-labelledby="related-articles-heading"');
      let cardCount = 0;
      let cardTitles = [];

      if (relatedIndex !== -1) {
        const sectionEnd = html.indexOf('</section>', relatedIndex);
        const relatedSnippet = html.slice(relatedIndex, sectionEnd !== -1 ? sectionEnd : relatedIndex + 30000);
        const matches = [...relatedSnippet.matchAll(/<h3[^>]*>[\s\S]*?<a[^>]*>([\s\S]*?)<\/a>[\s\S]*?<\/h3>/g)];
        cardCount = matches.length;
        cardTitles = matches.map(m => m[1].trim());
      }

      console.log(`[${t.name}] Status: ${res.status}`);
      console.log(`  Heading Found: ${hasHeading}`);
      console.log(`  Subheading Found: ${hasSubheading}`);
      console.log(`  Cards Rendered: ${cardCount}`);
      cardTitles.forEach((title, i) => console.log(`    ${i + 1}. ${title}`));
      console.log('--------------------------------------------------');
    } catch (err) {
      console.error(`[${t.name}] Error:`, err.message);
    }
  }
}

test();
