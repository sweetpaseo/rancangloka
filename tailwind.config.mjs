/** @type {import('tailwindcss').Config} */
export default {
  content: ['./src/**/*.{astro,html,js,jsx,md,mdx,svelte,ts,tsx,vue}'],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        primary: {
          DEFAULT: 'var(--color-primary, #2563eb)',
          hover: 'var(--color-primary-hover, #1d4ed8)',
          light: 'var(--color-primary-light, #eff6ff)',
          dark: 'var(--color-primary-dark, #1e40af)'
        },
        accent: {
          DEFAULT: 'var(--color-accent, #f59e0b)',
          hover: 'var(--color-accent-hover, #d97706)',
          light: 'var(--color-accent-light, #fef3c7)'
        },
        surface: {
          DEFAULT: 'var(--color-surface, #ffffff)',
          muted: 'var(--color-surface-muted, #f8fafc)',
          dark: 'var(--color-surface-dark, #0f172a)',
          card: 'var(--color-surface-card, #1e293b)'
        }
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', '-apple-system', 'sans-serif'],
        serif: ['Merriweather', 'Georgia', 'serif'],
        display: ['Outfit', 'Inter', 'sans-serif']
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
