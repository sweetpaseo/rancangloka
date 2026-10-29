/** @type {import('tailwindcss').Config} */
export default {
  content: ['./src/**/*.{astro,html,js,jsx,md,mdx,svelte,ts,tsx,vue}'],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        canvas: '#FFFFFF',
        surface: '#FFFFFF',
        'section-alt': '#FAF9F6',
        'neutral-soft': '#F5F5F0',
        ink: {
          DEFAULT: '#3F4030',
          light: '#525442',
          muted: '#676957'
        },
        muted: '#676957',
        primary: {
          DEFAULT: '#73641E',
          hover: '#584A18',
          deep: '#584A18',
          light: '#FFF9E4',
          dark: '#453A10'
        },
        lemon: {
          DEFAULT: '#F5D95B',
          soft: '#FFF9E4',
          wash: '#FFF9E4',
          warm: '#FAF9F6',
          accent: '#E6C638'
        },
        meta: '#73641E',
        line: {
          DEFAULT: '#E8E7E1',
          dark: '#D5D4CC'
        },
        footer: {
          DEFAULT: '#574D28',
          ink: '#FFFCF0',
          line: '#817644'
        },
        stone: {
          DEFAULT: '#E8E7E1',
          light: '#FAF9F6',
          dark: '#D5D4CC'
        },
        accent: {
          DEFAULT: '#73641E',
          hover: '#584A18',
          light: '#FFF9E4',
          dark: '#3F4030'
        }
      },
      fontFamily: {
        sans: ['"Plus Jakarta Sans"', 'Inter', '-apple-system', 'BlinkMacSystemFont', 'system-ui', 'sans-serif'],
        display: ['"Plus Jakarta Sans"', 'Inter', '-apple-system', 'BlinkMacSystemFont', 'system-ui', 'sans-serif'],
        heading: ['"Plus Jakarta Sans"', 'Inter', '-apple-system', 'BlinkMacSystemFont', 'system-ui', 'sans-serif'],
        serif: ['"Plus Jakarta Sans"', 'Inter', '-apple-system', 'BlinkMacSystemFont', 'system-ui', 'sans-serif'],
        brand: ['Georgia', 'serif'],
        mono: ['"JetBrains Mono"', 'ui-monospace', 'SFMono-Regular', 'Menlo', 'monospace']
      },
      maxWidth: {
        editorial: '1180px',
        prose: '740px'
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
