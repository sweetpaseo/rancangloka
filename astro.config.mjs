import { defineConfig } from 'astro/config';
import cloudflare from '@astrojs/cloudflare';
import tailwind from '@astrojs/tailwind';

// https://astro.build/config
export default defineConfig({
  site: 'https://rancangloka.com',
  output: 'server',
  compressHTML: true,
  build: {
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
  integrations: [
    tailwind({
      applyBaseStyles: false
    })
  ]
});
