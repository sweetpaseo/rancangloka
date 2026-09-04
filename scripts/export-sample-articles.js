/**
 * Export Sample Articles Data Script
 * Dumps all 20 initial mock/sample articles from rancangloka-astro into data-sample-articles folder
 */

import fs from 'fs';
import path from 'path';
import { getDb, getAllArticles } from '../src/lib/db.ts';

async function exportSampleArticles() {
  const targetDir = path.resolve(process.cwd(), '../data-sample-articles');
  fs.mkdirSync(targetDir, { recursive: true });

  const db = await getDb({});
  const articles = await getAllArticles(db, 100, 0, 'all');

  console.log(`Found ${articles.length} sample articles.`);

  // 1. JSON Data Dump
  const jsonPath = path.join(targetDir, 'sample-articles.json');
  fs.writeFileSync(jsonPath, JSON.stringify(articles, null, 2), 'utf-8');
  console.log(`Wrote JSON dump: ${jsonPath}`);

  // 2. Markdown Catalog
  const mdLines = [
    '# 📋 Daftar Artikel Sample / Mock Website RancangLoka.com',
    '',
    '> Dokumen ini memuat daftar 20 artikel sample/demo awal yang tersimpan di sistem sebelum digantikan oleh artikel berkualitas tinggi hasil kurasi Agent Hermes.',
    '',
    `**Total Artikel Sample:** ${articles.length} artikel  `,
    `**Tanggal Pencatatan:** ${new Date().toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })}  `,
    `**Tujuan:** Disiapkan untuk penghapusan massal setelah produksi konten Hermes aktif.`,
    '',
    '---',
    '',
    '## 📑 Ringkasan Tabel Artikel Sample',
    '',
    '| No | ID | Slug | Judul Artikel | Kategori | Penulis | Status |',
    '| :---: | :---: | :--- | :--- | :--- | :--- | :---: |'
  ];

  articles.forEach((a, idx) => {
    mdLines.push(`| ${idx + 1} | \`${a.id}\` | \`${a.slug}\` | [${a.title}](https://rancangloka.com/${a.slug}) | ${a.category_name || '-'} | ${a.author_name || '-'} | \`${a.status}\` |`);
  });

  mdLines.push('');
  mdLines.push('---');
  mdLines.push('');
  mdLines.push('## 🔍 Detail Setiap Artikel Sample');
  mdLines.push('');

  articles.forEach((a, idx) => {
    let takeaways = [];
    try { takeaways = JSON.parse(a.key_takeaways || '[]'); } catch {}

    mdLines.push(`### ${idx + 1}. ${a.title}`);
    mdLines.push(`- **ID:** \`${a.id}\``);
    mdLines.push(`- **Slug:** \`${a.slug}\``);
    mdLines.push(`- **URL Publik:** \`https://rancangloka.com/${a.slug}\``);
    mdLines.push(`- **Kategori:** ${a.category_name} (ID: ${a.category_id})`);
    mdLines.push(`- **Penulis:** ${a.author_name} (ID: ${a.author_id})`);
    mdLines.push(`- **Focus Keyword:** \`${a.focus_keyword || '-'}\``);
    mdLines.push(`- **Estimasi Waktu Baca:** ${a.reading_time_minutes} menit`);
    mdLines.push(`- **Deskripsi:** ${a.description}`);
    mdLines.push(`- **Key Takeaways:**`);
    takeaways.forEach(t => mdLines.push(`  - ${t}`));
    mdLines.push('');
  });

  const mdPath = path.join(targetDir, 'sample-articles.md');
  fs.writeFileSync(mdPath, mdLines.join('\n'), 'utf-8');
  console.log(`Wrote Markdown catalog: ${mdPath}`);

  // 3. Cloudflare D1 Cleanup SQL Script
  const sqlSlugs = articles.map(a => `  '${a.slug}'`).join(',\n');
  const sqlContent = [
    '-- ====================================================================',
    '-- SQL SCRIPT PENGHAPUSAN ARTIKEL SAMPLE DARI CLOUDFLARE D1 DATABASE',
    '-- Database: rancangloka_db (3a86e9ad-410f-4440-884e-2eb813ec4cf7)',
    `-- Total Artikel: ${articles.length} entri`,
    `-- Diekspor pada: ${new Date().toISOString()}`,
    '-- ====================================================================',
    '',
    '-- 1. Hapus 20 artikel sample berdasarkan slug',
    'DELETE FROM articles WHERE slug IN (',
    sqlSlugs,
    ');',
    '',
    '-- 2. Verifikasi sisa artikel di database setelah penghapusan',
    'SELECT id, slug, title, status FROM articles ORDER BY id ASC;',
    ''
  ].join('\n');

  const sqlPath = path.join(targetDir, 'cleanup-sample-articles.sql');
  fs.writeFileSync(sqlPath, sqlContent, 'utf-8');
  console.log(`Wrote SQL cleanup script: ${sqlPath}`);

  // 4. Automated Cleanup Runner (Node.js)
  const runnerContent = [
    '/**',
    ' * Automated Purge Runner for Cloudflare D1',
    ' * Menjalankan penghapusan 20 artikel sample dari D1 melalui Wrangler CLI',
    ' * ',
    ' * Cara Menjalankan:',
    ' *   node data-sample-articles/execute-cleanup.js [--execute]',
    ' */',
    '',
    'import { execSync } from \'child_process\';',
    'import fs from \'fs\';',
    'import path from \'path\';',
    '',
    'const executeFlag = process.argv.includes(\'--execute\');',
    'const sqlFile = path.resolve(process.cwd(), \'data-sample-articles/cleanup-sample-articles.sql\');',
    '',
    'console.log(\'=== RANCANGLOKA D1 SAMPLE ARTICLES CLEANUP TOOL ===\\n\');',
    '',
    'if (!fs.existsSync(sqlFile)) {',
    '  console.error(\'❌ File SQL tidak ditemukan:\', sqlFile);',
    '  process.exit(1);',
    '}',
    '',
    'console.log(\'Target database: Cloudflare D1 (rancangloka_db)\');',
    'console.log(\'File SQL:\', sqlFile);',
    '',
    'if (!executeFlag) {',
    '  console.log(\'\\n[DRY RUN] Perintah berikut siap dieksekusi ke Cloudflare D1:\');',
    '  console.log(\'  npx wrangler d1 execute rancangloka_db --file=data-sample-articles/cleanup-sample-articles.sql --remote\\n\');',
    '  console.log(\'Untuk mengeksekusi langsung ke server Cloudflare D1 live, jalankan:\');',
    '  console.log(\'  node data-sample-articles/execute-cleanup.js --execute\');',
    '  process.exit(0);',
    '}',
    '',
    'console.log(\'Menjalankan query penghapusan ke Cloudflare D1 Remote...\\n\');',
    'try {',
    '  const output = execSync(\'npx wrangler d1 execute rancangloka_db --file=data-sample-articles/cleanup-sample-articles.sql --remote\', {',
    '    cwd: path.resolve(process.cwd(), \'rancangloka-astro\'),',
    '    encoding: \'utf-8\'',
    '  });',
    '  console.log(output);',
    '  console.log(\'✅ 20 Artikel sample berhasil dihapus dari Cloudflare D1!\');',
    '} catch (err) {',
    '  console.error(\'❌ Gagal mengeksekusi penghapusan D1:\', err.message);',
    '  process.exit(1);',
    '}'
  ].join('\n');

  const runnerPath = path.join(targetDir, 'execute-cleanup.js');
  fs.writeFileSync(runnerPath, runnerContent, 'utf-8');
  console.log(`Wrote Cleanup runner: ${runnerPath}`);

  // 5. README Documentation
  const readmeContent = [
    '# 📦 Data Sample Articles & Panduan Penghapusan',
    '',
    'Folder ini berisi rekaman data lengkap dari **20 artikel sample/mock** awal di website RancangLoka.',
    '',
    '## 📁 Isi Folder',
    '',
    '1. **`sample-articles.md`**: Katalog lengkap 20 artikel sample dengan link URL, kategori, penulis, dan deskripsinya.',
    '2. **`sample-articles.json`**: Data mentah terstruktur (JSON) dari seluruh artikel sample.',
    '3. **`cleanup-sample-articles.sql`**: Script SQL siap pakai untuk menghapus 20 artikel sample dari Cloudflare D1.',
    '4. **`execute-cleanup.js`**: Skrip otomatisasi Node.js untuk mengeksekusi query penghapusan via Wrangler CLI.',
    '',
    '## 🚀 Cara Menghapus Artikel Sample (Saat Hermes Sudah Siap)',
    '',
    'Setelah agent Hermes selesai memproduksi artikel baru berbobot tinggi, jalankan salah satu opsi berikut:',
    '',
    '### Opsi A: Menggunakan Wrangler CLI (Rekomendasi)',
    '```bash',
    'cd rancangloka-astro',
    'npx wrangler d1 execute rancangloka_db --file=../data-sample-articles/cleanup-sample-articles.sql --remote',
    '```',
    '',
    '### Opsi B: Menggunakan Skrip Otomatis',
    '```bash',
    'node data-sample-articles/execute-cleanup.js --execute',
    '```',
    '',
    '### Opsi C: Melalui Cloudflare Dashboard (Web UI)',
    '1. Buka [Cloudflare Dashboard](https://dash.cloudflare.com) > **Workers & Pages** > **D1 SQL Database**.',
    '2. Pilih database `rancangloka_db`.',
    '3. Buka tab **Console**, salin isi query dari file `cleanup-sample-articles.sql`, lalu klik **Execute**.',
    '',
    '### Opsi D: Menghapus Mock Fallback Lokal (di kode sumber)',
    'Kosongkan array `inMemoryArticles` di file `rancangloka-astro/src/lib/db.ts`:',
    '```typescript',
    'const inMemoryArticles: Article[] = [];',
    '```',
    '',
    '---',
    '© 2026 RancangLoka. Data siap pakai untuk pembersihan database.'
  ].join('\n');

  const readmePath = path.join(targetDir, 'README.md');
  fs.writeFileSync(readmePath, readmeContent, 'utf-8');
  console.log(`Wrote README: ${readmePath}`);
}

exportSampleArticles().catch(console.error);
