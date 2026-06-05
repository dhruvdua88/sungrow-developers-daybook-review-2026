/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Inter', 'ui-sans-serif', 'system-ui', 'sans-serif'],
        display: ['"Plus Jakarta Sans"', 'Inter', 'sans-serif'],
      },
      colors: {
        ink: '#0f172a',
        slatex: '#64748b',
        brand: {
          DEFAULT: '#1e4e8c',
          50: '#eef4fb',
          100: '#d7e6f6',
          500: '#1e4e8c',
          600: '#173d70',
          700: '#102c52',
          900: '#0a1c36',
        },
        ok: '#15803d',
        review: '#b45309',
        risk: '#be123c',
        manual: '#6d28d9',
      },
      boxShadow: {
        card: '0 1px 2px rgba(15,23,42,.04), 0 8px 24px -12px rgba(15,23,42,.12)',
        lift: '0 8px 30px -8px rgba(30,78,140,.25)',
        glow: '0 0 0 1px rgba(30,78,140,.08), 0 10px 40px -12px rgba(30,78,140,.30)',
      },
      backgroundImage: {
        'brand-grad': 'linear-gradient(135deg,#1e4e8c 0%,#2563a8 45%,#0ea5e9 100%)',
        'mesh':
          'radial-gradient(1200px 600px at 100% -10%, rgba(14,165,233,.10), transparent 60%), radial-gradient(900px 500px at -10% 10%, rgba(30,78,140,.10), transparent 55%)',
      },
      keyframes: {
        'fade-up': {
          '0%': { opacity: '0', transform: 'translateY(8px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        shimmer: {
          '0%': { backgroundPosition: '-400px 0' },
          '100%': { backgroundPosition: '400px 0' },
        },
      },
      animation: {
        'fade-up': 'fade-up .4s cubic-bezier(.21,1.02,.73,1) both',
        shimmer: 'shimmer 1.4s linear infinite',
      },
    },
  },
  plugins: [],
}
