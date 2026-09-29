/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        ink: { DEFAULT: '#16130f', 2: '#4f4942', 3: '#857e75' },
        paper: { DEFAULT: '#ffffff', 2: '#f7f5f0', 3: '#efece5' },
        fault: { DEFAULT: '#d93a45', soft: '#fbe2e4' },
        weather: { DEFAULT: '#0891b2', soft: '#d5f1f7' },
        ok: { DEFAULT: '#2f7d4f', soft: '#dff1e5' },
      },
      fontFamily: {
        sans: ['Inter', 'ui-sans-serif', 'system-ui', 'sans-serif'],
        serif: ['"Instrument Serif"', 'ui-serif', 'Georgia', 'serif'],
        mono: ['"JetBrains Mono"', 'ui-monospace', 'Menlo', 'monospace'],
      },
      boxShadow: {
        lift: '0 1px 2px rgba(40,28,16,0.04), 0 24px 60px -32px rgba(40,28,16,0.22)',
        pill: 'inset 0 1px 0 rgba(255,255,255,0.12), 0 14px 30px -14px rgba(40,28,16,0.75)',
      },
    },
  },
  plugins: [],
};
