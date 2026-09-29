/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        // ink = foreground, paper = backgrounds (night sky)
        ink: { DEFAULT: '#eef0f3', 2: '#a3abb8', 3: '#6b7482' },
        paper: { DEFAULT: '#05070b', 2: '#0c1017', 3: '#1a202b' },
        fault: { DEFAULT: '#ff5b6b', soft: 'rgba(255,91,107,0.14)' },
        weather: { DEFAULT: '#2dd4ef', soft: 'rgba(45,212,239,0.14)' },
        ok: { DEFAULT: '#34d399', soft: 'rgba(52,211,153,0.14)' },
        violet: { DEFAULT: '#8b7cff' },
      },
      fontFamily: {
        sans: ['Inter', 'ui-sans-serif', 'system-ui', 'sans-serif'],
        serif: ['"Instrument Serif"', 'ui-serif', 'Georgia', 'serif'],
        mono: ['"JetBrains Mono"', 'ui-monospace', 'Menlo', 'monospace'],
      },
      boxShadow: {
        lift: 'inset 0 1px 0 rgba(255,255,255,0.05), 0 30px 80px -40px rgba(0,0,0,0.9)',
        pill: '0 0 0 1px rgba(255,255,255,0.12), 0 10px 40px -8px rgba(45,212,239,0.55)',
        glow: '0 0 24px -4px rgba(45,212,239,0.6)',
      },
    },
  },
  plugins: [],
};
