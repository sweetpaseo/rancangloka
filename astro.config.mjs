import { defineConfig } from 'astro/config';
import cloudflare from '@astrojs/cloudflare';

// https://astro.build/config
export default defineConfig({
  site: 'https://rancangloka.com',
  output: 'server',
  compressHTML: true,
  build: {
    assets: 'assets',
    inlineStylesheets: 'always'
  },
  adapter: cloudflare({
    imageService: 'passthrough',
    mode: 'advanced'
  }),
  server: {
    host: true,
    port: 4321
  },
  vite: {
    ssr: {
      external: ['node:fs', 'node:path', 'node:os']
    }
  },
  integrations: []
});
