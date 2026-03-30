/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./src/renderer/**/*.{js,ts,jsx,tsx,html}'],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        surface: {
          0: 'var(--surface-0)',
          1: 'var(--surface-1)',
          2: 'var(--surface-2)',
          3: 'var(--surface-3)'
        },
        accent: {
          DEFAULT: 'var(--accent)',
          hover: 'var(--accent-hover)'
        },
        twitch: '#9147ff',
        youtube: '#ff0000',
        kick: '#53fc18'
      },
      fontFamily: {
        chat: ['Inter', 'system-ui', 'sans-serif']
      }
    }
  },
  plugins: []
}
