import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const source = readFileSync('src/pages/admin/posts/index.astro', 'utf8');

test('dashboard preserves existing query contract and server-side controls', () => {
  assert.match(source, /Astro\.url\.searchParams\.get\('q'\)/);
  assert.match(source, /Astro\.url\.searchParams\.get\('category'\)/);
  assert.match(source, /Astro\.url\.searchParams\.get\('sort'\)/);
  assert.match(source, /getAllArticles\(db, 200, 0, 'all', \{ q, category, sort \}\)/);
  assert.match(source, /name="q"/);
  assert.match(source, /name="category"/);
  assert.match(source, /name="sort"/);
});

test('thumbnail fallback avoids broken browser image icon', () => {
  assert.match(source, /cover-fallback/);
  assert.match(source, /Belum ada cover/);
  assert.match(source, /article-cover/);
  assert.match(source, /addEventListener\('error'/);
  assert.match(source, /img\.classList\.add\('hidden'\)/);
  assert.match(source, /fallback\?\.classList\.remove\('hidden'\)/);
});

test('article title and status presentation are scannable', () => {
  assert.match(source, /line-clamp-2/);
  assert.doesNotMatch(source, /line-clamp-1 text-sm/);
  assert.match(source, /formatStatusLabel/);
  assert.match(source, /Published/);
  assert.match(source, /Draft/);
});

test('created_at remains canonical with legacy null fallback', () => {
  assert.match(source, /formatCreatedAtWib\(article\.created_at\)/);
  assert.match(source, /if \(!value\) return 'Belum diketahui'/);
  assert.doesNotMatch(source, /formatCreatedAtWib\(article\.updated_at\)/);
  assert.doesNotMatch(source, /formatCreatedAtWib\(article\.published_at\)/);
});

test('sort UI and empty state match product brief', () => {
  assert.match(source, /Urutkan: Terbaru/);
  assert.match(source, /Urutkan: Terlama/);
  assert.match(source, /Tidak ada artikel ditemukan/);
  assert.match(source, /Terapkan/);
});

test('actions keep edit as primary and preserve exact ID route', () => {
  assert.match(source, /href=\{`\/admin\/posts\/\$\{article\.id\}`\}/);
  assert.doesNotMatch(source, /delete-post-btn/);
  assert.doesNotMatch(source, /Artikel berhasil dihapus!/);
  assert.match(source, /href=\{`\/admin\/preview\/\$\{article\.slug\}`\}/);
});
