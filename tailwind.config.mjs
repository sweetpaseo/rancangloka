/** @type {import('tailwindcss').Config} */
export default {
  content: ['./src/**/*.{astro,html,js,jsx,md,mdx,svelte,ts,tsx,vue}'],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        primary: {
          DEFAULT: 'var(--color-primary, #0066ee)',
          hover: 'var(--color-primary-hover, #0052cc)',
          light: 'var(--color-primary-light, #f0f6ff)',
          dark: 'var(--color-primary-dark, #003d99)'
        },
        accent: {
          DEFAULT: 'var(--color-accent, #c89d68)',
          hover: 'var(--color-accent-hover, #b3854e)',
          light: 'var(--color-accent-light, #fdf8f2)'
        },
        surface: {
          DEFAULT: 'var(--color-surface, #faf8f5)',
          muted: 'var(--color-surface-muted, #f3efe8)',
          dark: 'var(--color-surface-dark, #0a0d14)',
          card: 'var(--color-surface-card, #ffffff)'
        }
      },
      fontFamily: {
        sans: ['"Plus Jakarta Sans"', 'system-ui', '-apple-system', 'sans-serif'],
        serif: ['"Playfair Display"', '"Cormorant Garamond"', 'Georgia', 'serif'],
        display: ['"Playfair Display"', '"Plus Jakarta Sans"', 'serif'],
        mono: ['"JetBrains Mono"', 'ui-monospace', 'SFMono-Regular', 'Menlo', 'monospace']
      },
      aspectRatio: {
        '16/9': '16 / 9',
        '4/3': '4 / 3',
        '21/9': '21 / 9'
      }
    }
  },
  plugins: []
};
