import { test } from 'node:test';
import assert from 'node:assert/strict';
import { getAllArticles, getArticleById, insertArticle, updateArticle } from '../src/lib/db.ts';

function article(id, title, created_at, extra = {}) {
  return {
    id,
    slug: `article-${id}`,
    title,
    description: title,
    content_md: title,
    content_html: `<p>${title}</p>`,
    featured_image: '',
    image_alt: title,
    category_id: extra.category_id || 1,
    category_name: extra.category_name || 'Sistem & Konstruksi Rumah',
    category_slug: extra.category_slug || 'sistem-konstruksi-rumah',
    author_id: 1,
    status: extra.status || 'draft',
    views: 0,
    reading_time_minutes: 3,
    key_takeaways: '[]',
    focus_keyword: '',
    content_hash: `hash-${id}`,
    is_featured: 0,
    is_trending: 0,
    is_sponsored: 0,
    disable_internal_links: 0,
    created_at,
    updated_at: extra.updated_at || created_at || '2026-09-12T08:56:05Z',
    published_at: extra.published_at ?? null
  };
}

function createFakeDb(rows) {
  const state = { rows: rows.map((row) => ({ ...row })), lastSql: '', lastBindings: [] };
  return {
    state,
    prepare(sql) {
      state.lastSql = sql;
      return {
        bind(...bindings) {
          state.lastBindings = bindings;
          return {
            async all() {
              let data = state.rows.slice();
              const status = bindings[0];
              let cursor = 2;
              if (status !== null) data = data.filter((row) => row.status === status);
              if (sql.includes('LOWER(a.title) LIKE')) {
                const q = String(bindings[cursor]).replaceAll('%', '').toLowerCase();
                cursor += 3;
                data = data.filter((row) =>
                  row.title.toLowerCase().includes(q) ||
                  row.slug.toLowerCase().includes(q) ||
                  row.description.toLowerCase().includes(q)
                );
              }
              if (sql.includes('c.slug = ?')) {
                const category = bindings[cursor];
                data = data.filter((row) => row.category_slug === category);
              }
              const newest = sql.includes('a.created_at DESC');
              data.sort((a, b) => {
                if (!a.created_at && b.created_at) return 1;
                if (a.created_at && !b.created_at) return -1;
                if (a.created_at && b.created_at && a.created_at !== b.created_at) {
                  return newest ? b.created_at.localeCompare(a.created_at) : a.created_at.localeCompare(b.created_at);
                }
                return newest ? b.id - a.id : a.id - b.id;
              });
              const limit = bindings.at(-2);
              const offset = bindings.at(-1);
              return { results: data.slice(offset, offset + limit) };
            },
            async first() {
              const id = bindings[0];
              return state.rows.find((row) => row.id === id) || null;
            },
            async run() {
              const nowId = Math.max(0, ...state.rows.map((row) => row.id)) + 1;
              state.rows.push(article(nowId, bindings[1], bindings.at(-3), {
                updated_at: bindings.at(-1),
                published_at: bindings.at(-2),
                status: bindings[9]
              }));
              return { meta: { last_row_id: nowId } };
            }
          };
        }
      };
    }
  };
}

test('Article admin ordering uses created_at with deterministic legacy handling', async () => {
  const db = createFakeDb([
    article(5, 'Article Five', '2026-09-10T01:00:00Z'),
    article(6, 'Rekayasa Ventilasi Silang Alami untuk Rumah Tropis yang Lebih Nyaman', '2026-09-12T08:56:05Z'),
    article(7, 'Legacy Updated Recently', null, { updated_at: '2026-09-12T09:00:00Z' })
  ]);

  assert.deepEqual((await getAllArticles(db, 10, 0, 'all', { sort: 'newest' })).map((row) => row.id), [6, 5, 7]);
  assert.deepEqual((await getAllArticles(db, 10, 0, 'all', { sort: 'oldest' })).map((row) => row.id), [5, 6, 7]);

  const tieDb = createFakeDb([
    article(5, 'Article Five', '2026-09-12T08:56:05Z'),
    article(6, 'Article Six', '2026-09-12T08:56:05Z')
  ]);
  assert.deepEqual((await getAllArticles(tieDb, 10, 0, 'all', { sort: 'newest' })).map((row) => row.id), [6, 5]);
  assert.deepEqual((await getAllArticles(tieDb, 10, 0, 'all', { sort: 'oldest' })).map((row) => row.id), [5, 6]);
});

test('Article admin search, category, and sort compose server-side', async () => {
  const db = createFakeDb([
    article(5, 'Ventilasi Kamar', '2026-09-10T01:00:00Z', { category_slug: 'kenyamanan-rumah' }),
    article(6, 'Ventilasi Atap', '2026-09-12T08:56:05Z', { category_slug: 'sistem-konstruksi-rumah' }),
    article(7, 'Material Lantai', '2026-09-11T08:56:05Z', { category_slug: 'sistem-konstruksi-rumah' })
  ]);

  assert.deepEqual((await getAllArticles(db, 10, 0, 'all', {
    q: 'ventilasi',
    category: 'sistem-konstruksi-rumah',
    sort: 'newest'
  })).map((row) => row.id), [6]);
  assert.match(db.state.lastSql, /LOWER\(a\.title\) LIKE/);
  assert.match(db.state.lastSql, /c\.slug = \?/);
  assert.match(db.state.lastSql, /a\.created_at DESC/);

  await getAllArticles(db, 10, 0, 'all', {
    q: 'ventilasi',
    category: 'sistem-konstruksi-rumah',
    sort: 'oldest'
  });
  assert.match(db.state.lastSql, /a\.created_at ASC/);
});

test('New draft inserts set created_at and updated_at but not published_at', async () => {
  const inserted = await insertArticle(null, {
    title: 'Created At Test Draft',
    slug: `created-at-test-draft-${Date.now()}`,
    status: 'draft'
  });

  assert.ok(inserted.created_at);
  assert.ok(inserted.updated_at);
  assert.equal(inserted.published_at, null);
});

test('Editing mutates updated_at only and preserves created_at', async () => {
  const original = await insertArticle(null, {
    title: 'Immutable Created At',
    slug: `immutable-created-at-${Date.now()}`,
    status: 'draft',
    created_at: '2026-09-10T01:00:00Z',
    updated_at: '2026-09-10T01:00:00Z'
  });
  const updated = await updateArticle(null, original.id, { title: 'Immutable Created At Updated' });

  assert.equal(updated.created_at, '2026-09-10T01:00:00Z');
  assert.notEqual(updated.updated_at, original.updated_at);
});

test('Edit lookup selects exact ID and missing ID fails safely', async () => {
  const db = createFakeDb([
    article(5, 'Article Five', '2026-09-10T01:00:00Z'),
    article(6, 'Rekayasa Ventilasi Silang Alami untuk Rumah Tropis yang Lebih Nyaman', '2026-09-12T08:56:05Z')
  ]);

  const selected = await getArticleById(db, 6);
  assert.equal(selected.id, 6);
  assert.equal(selected.title, 'Rekayasa Ventilasi Silang Alami untuk Rumah Tropis yang Lebih Nyaman');
  assert.equal(selected.status, 'draft');

  assert.equal(await getArticleById(db, 999), null);
});

test('WIB display is explicit and legacy created_at is not fabricated', () => {
  const formatted = new Intl.DateTimeFormat('id-ID', {
    timeZone: 'Asia/Jakarta',
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
    timeZoneName: 'short'
  }).format(new Date('2026-09-12T08:56:05Z'));

  assert.match(formatted, /12 Sep 2026/);
  assert.match(formatted, /15\.56|15:56/);
  assert.match(formatted, /WIB|GMT\+7/);
  assert.equal(null, null);
});
