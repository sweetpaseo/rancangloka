import { defineConfig } from 'astro/config';
import cloudflare from '@astrojs/cloudflare';
import tailwind from '@astrojs/tailwind';

// https://astro.build/config
export default defineConfig({
  output: 'server',
  build: {
    assets: 'assets'
  },
  compressHTML: true,
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
