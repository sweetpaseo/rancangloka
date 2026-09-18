import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

const assetsDir = 'dist/client/assets';
const chunksDir = 'dist/server/chunks';

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

function listCssFiles(dir) {
  return readdirSync(dir)
    .filter((name) => name.endsWith('.css'))
    .map((name) => ({
      name,
      path: join(dir, name),
      bytes: statSync(join(dir, name)).size
    }));
}

function hasExpectedUtilityRules(css) {
  return [
    /\.max-w-7xl\{/,
    /\.bg-white\{/,
    /\.grid\{/,
    /\.h-4\{/,
    /\.w-4\{/
  ].every((pattern) => pattern.test(css));
}

const cssFiles = listCssFiles(assetsDir);
const globalCss = cssFiles.find((file) => /^global\..+\.css$/.test(file.name));

assert(cssFiles.length > 0, 'No CSS assets were emitted in dist/client/assets.');
assert(globalCss, `No compiled global stylesheet was emitted. CSS assets: ${cssFiles.map((file) => file.name).join(', ')}`);

const css = readFileSync(globalCss.path, 'utf8');
assert(hasExpectedUtilityRules(css), `${globalCss.name} does not contain representative Tailwind utility rules.`);

const manifestFile = readdirSync(chunksDir).find((name) => /^entrypoints_.+\.mjs$/.test(name));
assert(manifestFile, 'Built Astro server manifest chunk was not found.');

const manifest = readFileSync(join(chunksDir, manifestFile), 'utf8');
assert(manifest.includes(`assets/${globalCss.name}`), `${globalCss.name} is not referenced by the built Astro server manifest.`);
assert(manifest.includes('"route":"/"'), 'Built Astro server manifest does not include the public homepage route.');

const totalBytes = cssFiles.reduce((sum, file) => sum + file.bytes, 0);
console.log(`CSS delivery smoke passed: ${cssFiles.length} CSS assets, ${totalBytes} bytes, ${globalCss.name} referenced by server manifest.`);
