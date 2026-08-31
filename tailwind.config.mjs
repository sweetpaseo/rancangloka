/** @type {import('tailwindcss').Config} */
export default {
  content: ['./src/**/*.{astro,html,js,jsx,md,mdx,svelte,ts,tsx,vue}'],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        paper: {
          DEFAULT: '#F6F5F1',
          50: '#FAF9F6',
          100: '#F6F5F1',
          200: '#EAE8E1',
          300: '#D9D7D0'
        },
        ink: {
          DEFAULT: '#11110F',
          light: '#222220',
          muted: '#77766F'
        },
        stone: {
          DEFAULT: '#D9D7D0',
          light: '#E8E6DF',
          dark: '#B8B5AB'
        },
        soft: '#EAE8E1',
        olive: '#6B705C',
        accent: {
          DEFAULT: '#6B705C',
          hover: '#585C4B',
          light: '#EAE8E1',
          dark: '#11110F'
        },
        primary: {
          DEFAULT: '#11110F',
          hover: '#0066ee',
          light: '#F6F5F1',
          dark: '#080807'
        }
      },
      fontFamily: {
        sans: ['"Geist"', '"Plus Jakarta Sans"', '-apple-system', 'BlinkMacSystemFont', 'system-ui', 'sans-serif'],
        serif: ['"Instrument Serif"', 'Georgia', 'serif'],
        display: ['"Instrument Serif"', 'Georgia', 'serif'],
        mono: ['"JetBrains Mono"', 'ui-monospace', 'SFMono-Regular', 'Menlo', 'monospace']
      },
      aspectRatio: {
        '2/1': '2 / 1',
        '16/9': '16 / 9',
        '4/3': '4 / 3',
        '21/9': '21 / 9'
      }
    }
  },
  plugins: []
};
