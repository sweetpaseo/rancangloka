import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const read = (path) => readFileSync(path, 'utf8');

const layout = read('src/layouts/AdminLayout.astro');
const postsIndex = read('src/pages/admin/posts/index.astro');
const newPost = read('src/pages/admin/posts/new.astro');
const categories = read('src/pages/admin/categories/index.astro');
const authors = read('src/pages/admin/authors/index.astro');
const settings = read('src/pages/admin/settings.astro');
const media = read('src/pages/admin/media.astro');
const overview = read('src/pages/admin/index.astro');
const analytics = read('src/pages/admin/analytics.astro');
const seoAudit = read('src/pages/admin/seo-audit.astro');

test('sidebar uses approved information architecture and labels', () => {
  for (const label of ['RINGKASAN', 'KONTEN', 'TOOLS', 'INSIGHT & AUDIT', 'AUDIENCE', 'SYSTEM']) {
    assert.match(layout, new RegExp(label.replace('&', '&')));
  }
  for (const label of [
    'Ringkasan',
    'Artikel & Jurnal',
    'Halaman Situs',
    'Kategori Topik',
    'Penulis & Editor',
    'Import Markdown',
    'Media Library',
    'Audit SEO Konten',
    'Kesehatan Sistem',
    'Pelanggan Newsletter',
    'Pengaturan Situs'
  ]) {
    assert.match(layout, new RegExp(label));
  }
  assert.doesNotMatch(layout, /Tulis Artikel Baru/);
  assert.doesNotMatch(layout, /Server & Traffic Telemetry|SEO & CWV Auditor|Dewan Penulis E-E-A-T|Media Vault \(R2\)|Subscribers \(CSV\)|Halaman Statis/);
});

test('global create article action remains the only persistent create entry', () => {
  assert.match(layout, /href="\/admin\/posts\/new"/);
  assert.match(layout, /\+ Buat Artikel/);
});

test('article delete false-success behavior is hidden until safe', () => {
  assert.doesNotMatch(postsIndex, /delete-post-btn/);
  assert.doesNotMatch(postsIndex, /Artikel berhasil dihapus!/);
  assert.doesNotMatch(postsIndex, /row\.remove\(\)/);
});

test('new article SEO scorecard reads actual focus keyword and takeaways fields', () => {
  assert.match(newPost, /id="post-keyword"/);
  assert.match(newPost, /id="post-key-takeaways"/);
  assert.match(newPost, /document\.getElementById\('post-keyword'\)/);
  assert.match(newPost, /document\.getElementById\('post-key-takeaways'\)/);
  assert.doesNotMatch(newPost, /document\.getElementById\('focus-keyword'\)/);
  assert.doesNotMatch(newPost, /document\.getElementById\('key-takeaways'\)/);
});

test('category, author, and settings success feedback waits for server success', () => {
  for (const source of [categories, authors, settings]) {
    assert.match(source, /res\.ok && data\.status !== 'error'/);
    assert.match(source, /Gagal/);
  }
  assert.doesNotMatch(categories, /btn\.closest\('tr'\)\?\.remove\(\)/);
  assert.doesNotMatch(authors, /btn\.closest\('tr'\)\?\.remove\(\)/);
});

test('media delete is only rendered for verified R2 objects', () => {
  assert.match(media, /item\.source === 'r2'/);
  assert.match(media, /delete-media-btn/);
  assert.match(media, /Tertaut/);
});

test('breadcrumbs, active nav, and aria labels are present', () => {
  assert.match(layout, /aria-label="Breadcrumb"/);
  assert.match(layout, /aria-current=\{isActive\(item\.href\) \? 'page' : undefined\}/);
  assert.match(media, /aria-label=\{`Hapus \$\{item\.key\} dari Cloudflare R2`\}/);
});

test('static or estimated operational data is labelled honestly', () => {
  assert.match(overview, /Bukan data CWV live/);
  assert.match(overview, /Bukan analytics live/);
  assert.match(analytics, /Estimasi, bukan telemetry live/);
  assert.match(analytics, /Data live terbatas \+ estimasi kapasitas/);
  assert.match(seoAudit, /Tidak memakai data CWV\/PageSpeed live/);
});
