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
  ],
  vite: {
    build: {
      rollupOptions: {
        output: {
          entryFileNames: 'assets/rancangloka-app-[hash].js',
          chunkFileNames: 'assets/rancangloka-core-[hash].js',
          assetFileNames: 'assets/rancangloka-[name]-[hash].[ext]'
        }
      }
    }
  }
});
