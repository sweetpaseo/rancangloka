/** @type {import('tailwindcss').Config} */
export default {
  content: ['./src/**/*.{astro,html,js,jsx,md,mdx,svelte,ts,tsx,vue}'],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        primary: {
          DEFAULT: 'var(--color-primary, #111215)',
          hover: 'var(--color-primary-hover, #0066ee)',
          light: 'var(--color-primary-light, #eff6ff)',
          dark: 'var(--color-primary-dark, #08090c)'
        },
        accent: {
          DEFAULT: 'var(--color-accent, #0066ee)',
          hover: 'var(--color-accent-hover, #0052cc)',
          light: 'var(--color-accent-light, #eff6ff)',
          dark: 'var(--color-accent-dark, #003d99)'
        },
        sapphire: {
          DEFAULT: '#0066ee',
          hover: '#0052cc',
          light: '#eff6ff',
          dark: '#003d99'
        },
        titanium: {
          DEFAULT: '#111215',
          light: '#1f232b',
          fog: '#f3f4f6',
          mist: '#5b616e'
        },
        porcelain: {
          DEFAULT: '#fbfbfd',
          muted: '#f3f4f6',
          card: '#ffffff'
        },
        surface: {
          DEFAULT: 'var(--color-surface, #fbfbfd)',
          muted: 'var(--color-surface-muted, #f3f4f6)',
          dark: 'var(--color-surface-dark, #08090c)',
          card: 'var(--color-surface-card, #ffffff)'
        }
      },
      fontFamily: {
        sans: ['"Plus Jakarta Sans"', '-apple-system', 'BlinkMacSystemFont', 'system-ui', 'sans-serif'],
        display: ['"Plus Jakarta Sans"', '-apple-system', 'BlinkMacSystemFont', 'sans-serif'],
        serif: ['"Plus Jakarta Sans"', 'sans-serif'],
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
