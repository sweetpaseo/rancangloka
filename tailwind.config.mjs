/** @type {import('tailwindcss').Config} */
export default {
  content: ['./src/**/*.{astro,html,js,jsx,md,mdx,svelte,ts,tsx,vue}'],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        primary: {
          DEFAULT: 'var(--color-primary, #0f1a15)',
          hover: 'var(--color-primary-hover, #1d3329)',
          light: 'var(--color-primary-light, #eef3f0)',
          dark: 'var(--color-primary-dark, #080d0b)'
        },
        accent: {
          DEFAULT: 'var(--color-accent, #c46849)',
          hover: 'var(--color-accent-hover, #a85336)',
          light: 'var(--color-accent-light, #faeee9)',
          dark: 'var(--color-accent-dark, #8c3e24)'
        },
        copper: {
          DEFAULT: '#c46849',
          hover: '#a85336',
          light: '#faeee9',
          dark: '#8c3e24'
        },
        forest: {
          DEFAULT: '#0f1a15',
          light: '#1d3329',
          pine: '#2d5a46',
          mist: '#3d6352'
        },
        washi: {
          DEFAULT: '#f9f7f2',
          muted: '#f0ede4',
          card: '#ffffff'
        },
        surface: {
          DEFAULT: 'var(--color-surface, #f9f7f2)',
          muted: 'var(--color-surface-muted, #f0ede4)',
          dark: 'var(--color-surface-dark, #080d0b)',
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
