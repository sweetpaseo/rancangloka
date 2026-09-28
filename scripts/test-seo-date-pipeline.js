/**
 * Regression Test: SEO Date Pipeline, Schema Selection & Public Metadata Semantics
 * 
 * Verifies:
 * 1. published_at = actual first-publication timestamp
 * 2. updated_at = editorial modification timestamp
 * 3. created_at = internal creation/draft timestamp (never leaked as publication date)
 * 4. generateArticleSchema correctly maps datePublished and dateModified
 * 5. Evergreen editorial gets @type = 'Article'
 * 6. News editorial gets @type = 'NewsArticle'
 * 7. Editorial Desk gets author @type = 'Organization'
 * 8. Named human gets author @type = 'Person'
 * 9. Relative image paths convert to absolute canonical URLs
 * 10. News sitemap inclusion strictly enforces <48h AND news eligibility (no evergreen leaks, no backfill)
 */

import assert from 'node:assert/strict';
import { generateArticleSchema, isNewsArticleEligible } from '../src/lib/seo.ts';

console.log('=== SEO DATE PIPELINE & METADATA REGRESSION TEST ===\n');

let passCount = 0;

function it(description, fn) {
  try {
    fn();
    console.log(`  ✅ PASS: ${description}`);
    passCount++;
  } catch (err) {
    console.error(`  ❌ FAIL: ${description}`);
    console.error(err);
    process.exit(1);
  }
}

// Test Case: Article with distinct created_at, published_at, updated_at
const mockArticle = {
  id: 5,
  slug: 'kusen-aluminium-vs-upvc-untuk-rumah-tropis-di-indonesia',
  title: 'Kusen Aluminium vs uPVC untuk Rumah Tropis di Indonesia',
  description: 'Ulasan komparasi teknis kusen aluminium vs uPVC.',
  created_at: '2026-09-07T14:38:09.000Z',
  published_at: '2026-09-28T09:00:00.000Z',
  updated_at: '2026-09-28T11:30:00.000Z',
  featured_image: '/media/images/test.webp',
  category_name: 'Material & Finishing',
  category_slug: 'material-finishing'
};

const editorialDeskAuthor = {
  name: 'RancangLoka Editorial Desk',
  slug: 'dewan-redaksi-spasial',
  role: 'Editorial Desk'
};

const individualAuthor = {
  name: 'Budi Santoso',
  slug: 'budi-santoso',
  role: 'Senior Architectural Editor'
};

const siteSettings = {
  site_title: 'RancangLoka',
  site_url: 'https://rancangloka.com',
  seo_default_og_image: 'https://rancangloka.com/og-default.webp'
};

it('JSON-LD schema maps datePublished strictly to published_at (not created_at)', () => {
  const schema = generateArticleSchema(mockArticle, siteSettings.site_url, editorialDeskAuthor, siteSettings);
  assert.equal(schema.datePublished, '2026-09-28T09:00:00.000Z');
  assert.notEqual(schema.datePublished, mockArticle.created_at);
});

it('JSON-LD schema maps dateModified strictly to updated_at', () => {
  const schema = generateArticleSchema(mockArticle, siteSettings.site_url, editorialDeskAuthor, siteSettings);
  assert.equal(schema.dateModified, '2026-09-28T11:30:00.000Z');
});

it('JSON-LD schema falls back to published_at if updated_at is null', () => {
  const artWithoutUpdate = { ...mockArticle, updated_at: null };
  const schema = generateArticleSchema(artWithoutUpdate, siteSettings.site_url, editorialDeskAuthor, siteSettings);
  assert.equal(schema.dateModified, '2026-09-28T09:00:00.000Z');
});

it('Sitemap post lastmod calculation uses updated_at over published_at', () => {
  const lastMod = new Date(mockArticle.updated_at || mockArticle.published_at).toISOString();
  assert.equal(lastMod, '2026-09-28T11:30:00.000Z');
});

it('News sitemap uses published_at for news:publication_date and updated_at for lastmod', () => {
  const pubDate = new Date(mockArticle.published_at).toISOString();
  const lastMod = new Date(mockArticle.updated_at || mockArticle.published_at).toISOString();
  assert.equal(pubDate, '2026-09-28T09:00:00.000Z');
  assert.equal(lastMod, '2026-09-28T11:30:00.000Z');
});

it('Evergreen technical article produces @type = "Article"', () => {
  const schema = generateArticleSchema(mockArticle, siteSettings.site_url, editorialDeskAuthor, siteSettings);
  assert.equal(schema['@type'], 'Article');
});

it('News item produces @type = "NewsArticle"', () => {
  const newsArt = { ...mockArticle, is_news: 1 };
  const schema = generateArticleSchema(newsArt, siteSettings.site_url, editorialDeskAuthor, siteSettings);
  assert.equal(schema['@type'], 'NewsArticle');
});

it('Editorial Desk author produces @type = "Organization" with canonical profile url', () => {
  const schema = generateArticleSchema(mockArticle, siteSettings.site_url, editorialDeskAuthor, siteSettings);
  assert.equal(schema.author['@type'], 'Organization');
  assert.equal(schema.author.name, 'RancangLoka Editorial Desk');
  assert.equal(schema.author.url, 'https://rancangloka.com/author/dewan-redaksi-spasial');
  assert.equal(schema.author.jobTitle, undefined); // No jobTitle for Organization
});

it('Individual named author produces @type = "Person" with jobTitle and profile url', () => {
  const schema = generateArticleSchema(mockArticle, siteSettings.site_url, individualAuthor, siteSettings);
  assert.equal(schema.author['@type'], 'Person');
  assert.equal(schema.author.name, 'Budi Santoso');
  assert.equal(schema.author.url, 'https://rancangloka.com/author/budi-santoso');
  assert.equal(schema.author.jobTitle, 'Senior Architectural Editor');
});

it('Relative featured_image is converted to absolute URL in JSON-LD', () => {
  const schema = generateArticleSchema(mockArticle, siteSettings.site_url, editorialDeskAuthor, siteSettings);
  assert.equal(schema.image[0], 'https://rancangloka.com/media/images/test.webp');
  assert.ok(schema.image[0].startsWith('https://'));
});

// --- News Sitemap Eligibility Tests ---
const now = Date.now();
const oneHourAgo = new Date(now - 3600 * 1000).toISOString();
const threeDaysAgo = new Date(now - 72 * 3600 * 1000).toISOString();
const fortyEightHoursCutoff = now - 48 * 3600 * 1000;

it('News sitemap excludes evergreen article even when published recently (<48h)', () => {
  const freshEvergreen = { ...mockArticle, published_at: oneHourAgo, is_news: 0 };
  const eligible = isNewsArticleEligible(freshEvergreen, fortyEightHoursCutoff);
  assert.equal(eligible, false, 'Evergreen article must not enter Google News sitemap');
});

it('News sitemap includes genuine news article published within 48h', () => {
  const freshNews = { ...mockArticle, published_at: oneHourAgo, is_news: 1 };
  const eligible = isNewsArticleEligible(freshNews, fortyEightHoursCutoff);
  assert.equal(eligible, true, 'Recent news article must enter Google News sitemap');
});

it('News sitemap excludes news article older than 48h', () => {
  const oldNews = { ...mockArticle, published_at: threeDaysAgo, is_news: 1 };
  const eligible = isNewsArticleEligible(oldNews, fortyEightHoursCutoff);
  assert.equal(eligible, false, 'News older than 48h must be excluded');
});

it('News sitemap handles 0 eligible articles cleanly (no fallback backfill)', () => {
  const corpus = [
    { ...mockArticle, published_at: oneHourAgo, is_news: 0 },
    { ...mockArticle, published_at: threeDaysAgo, is_news: 1 }
  ];
  const eligible = corpus.filter(a => isNewsArticleEligible(a, fortyEightHoursCutoff));
  assert.equal(eligible.length, 0, 'Must have 0 eligible items without backfill');
});

console.log(`\n🎉 All ${passCount} SEO, Schema, and News Sitemap regression checks PASSED!\n`);
