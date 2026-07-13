/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      fontFamily: { sans: ['Inter', 'system-ui', 'sans-serif'] },
      colors: {
        galaxy: {
          900: '#0a0a1a',
          800: '#0d0d2b',
          700: '#141432',
          600: '#1a1a40',
          500: '#252552',
        },
        cosmic: {
          blue: '#4facfe',
          purple: '#a855f7',
          pink: '#ec4899',
          gold: '#fbbf24',
        }
      },
      animation: {
        'float': 'float 6s ease-in-out infinite',
        'glow': 'glow 2s ease-in-out infinite alternate',
        'twinkle': 'twinkle 3s ease-in-out infinite',
      },
      keyframes: {
        float: {
          '0%, 100%': { transform: 'translateY(0px)' },
          '50%': { transform: 'translateY(-20px)' },
        },
        glow: {
          '0%': { boxShadow: '0 0 5px rgba(79, 172, 254, 0.5)' },
          '100%': { boxShadow: '0 0 20px rgba(79, 172, 254, 0.8), 0 0 40px rgba(168, 85, 247, 0.4)' },
        },
        twinkle: {
          '0%, 100%': { opacity: '1' },
          '50%': { opacity: '0.3' },
        },
      },
    },
  },
  plugins: [],
};
