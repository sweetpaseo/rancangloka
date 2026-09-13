import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const globalCss = readFileSync('src/styles/global.css', 'utf8');
const articlePage = readFileSync('src/pages/[slug].astro', 'utf8');
const relatedArticles = readFileSync('src/components/RelatedArticles.astro', 'utf8');
const footer = readFileSync('src/components/Footer.astro', 'utf8');

test('global responsive gutter token matches RancangLoka mobile standard', () => {
  assert.match(globalCss, /\.rl-mobile-grid/);
  assert.match(globalCss, /padding-inline:\s*clamp\(16px,\s*4\.8vw,\s*20px\)/);
  assert.match(globalCss, /overflow-x:\s*clip/);
});

test('article page aligns major sections to one mobile grid', () => {
  assert.match(articlePage, /<article class="rl-mobile-grid/);
  assert.match(articlePage, /<div class="rl-mobile-grid max-w-3xl/);
  assert.match(relatedArticles, /<div class="rl-mobile-grid mx-auto max-w-7xl/);
  assert.match(footer, /<div class="rl-mobile-grid mx-auto max-w-\[1280px\]/);
});

test('long titles and generated article content wrap safely', () => {
  assert.match(articlePage, /<h1 class="rl-safe-wrap/);
  assert.match(globalCss, /\.rl-safe-wrap/);
  assert.match(globalCss, /overflow-wrap:\s*anywhere/);
  assert.match(globalCss, /\.prose-magazine[\s\S]*overflow-wrap:\s*anywhere/);
});

test('cover, references, related cards, and CTA cannot exceed parent width', () => {
  assert.match(articlePage, /group relative my-8 max-w-full overflow-hidden/);
  assert.match(articlePage, /SUMBER & REFERENSI TEKNIS/);
  assert.match(articlePage, /rl-safe-wrap/);
  assert.match(relatedArticles, /max-w-full flex-col overflow-hidden/);
  assert.match(globalCss, /\.prose-magazine img,[\s\S]*max-width:\s*100%/);
});
