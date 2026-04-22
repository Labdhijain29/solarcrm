/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      fontFamily: {
        sans: ['Inter', 'sans-serif'],
        display: ['Syne', 'sans-serif'],
      },
      colors: {
        solar: {
          50:  '#fffbeb',
          100: '#fef3c7',
          400: '#fbbf24',
          500: '#f59e0b',
          600: '#d97706',
          700: '#b45309',
        },
        brand: {
          bg:    '#0A0E1A',
          bg2:   '#0F1629',
          bg3:   '#141C35',
          card:  '#1A2340',
          card2: '#1E2A47',
          border:'#2A3A5E',
        }
      },
      animation: {
        'fade-in':    'fadeIn 0.4s ease forwards',
        'slide-in':   'slideIn 0.3s ease forwards',
        'float':      'float 3s ease-in-out infinite',
        'glow':       'glow 3s ease-in-out infinite',
        'pulse-slow': 'pulse 2s cubic-bezier(0.4,0,0.6,1) infinite',
      },
      keyframes: {
        fadeIn:  { from: { opacity: '0', transform: 'translateY(12px)' }, to: { opacity: '1', transform: 'none' } },
        slideIn: { from: { opacity: '0', transform: 'translateX(-16px)' }, to: { opacity: '1', transform: 'none' } },
        float:   { '0%,100%': { transform: 'translateY(0)' }, '50%': { transform: 'translateY(-8px)' } },
        glow:    { '0%,100%': { boxShadow: '0 0 20px rgba(245,158,11,.2)' }, '50%': { boxShadow: '0 0 40px rgba(245,158,11,.5)' } },
      },
      backdropBlur: { xs: '2px' },
    }
  },
  plugins: [],
}
