import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const globalCss = readFileSync('src/styles/global.css', 'utf8');

test('CSS restores semantic disc markers for unordered lists in article prose container', () => {
  assert.match(globalCss, /\.prose-magazine ul[\s\S]*?list-style-type:\s*disc;/);
  assert.match(globalCss, /\.prose-magazine ul[\s\S]*?padding-left:\s*1\.5rem;/);
});

test('CSS restores semantic decimal markers for ordered lists in article prose container', () => {
  assert.match(globalCss, /\.prose-magazine ol[\s\S]*?list-style-type:\s*decimal;/);
  assert.match(globalCss, /\.prose-magazine ol[\s\S]*?padding-left:\s*1\.5rem;/);
});

test('CSS sets readable line-height and block margins for list items in article prose container', () => {
  assert.match(globalCss, /\.prose-magazine li[\s\S]*?margin-block:\s*0\.5rem;/);
  assert.match(globalCss, /\.prose-magazine li[\s\S]*?line-height:\s*1\.75;/);
});

test('CSS defines distinct nested list hierarchy without breaking parent layout', () => {
  assert.match(globalCss, /\.prose-magazine ul ul[\s\S]*?list-style-type:\s*circle;/);
  assert.match(globalCss, /\.prose-magazine ul ol[\s\S]*?list-style-type:\s*lower-alpha;/);
});

test('Decorative faux-bullet character (✦) is purged from prose lists', () => {
  // Ensure "✦" is not used as a list bullet pseudo-element
  const listSection = globalCss.match(/\/\* 3\. Editorial Article Lists[\s\S]*?\/\* 4\./);
  assert.ok(listSection, 'List section comment block must be present');
  assert.doesNotMatch(listSection[0], /content:\s*["']✦["']/);
  assert.doesNotMatch(listSection[0], /list-style-type:\s*none/);
});

test('Article prose list styles are strictly scoped and do not leak into global UI', () => {
  // Ensure list-style-type: disc/decimal are not globally set on bare `ul` or `ol`
  assert.doesNotMatch(globalCss, /(?<!\.prose-magazine\s+|\.article-content\s+)\bul\s*\{[^}]*list-style-type:\s*disc/);
  assert.doesNotMatch(globalCss, /(?<!\.prose-magazine\s+|\.article-content\s+)\bol\s*\{[^}]*list-style-type:\s*decimal/);
});
