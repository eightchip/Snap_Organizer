/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      keyframes: {
        'fade-in-down': {
          '0%': { opacity: '0', transform: 'translateY(-20px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        'grow-line': {
          '0%': { width: '0%' },
          '100%': { width: '100%' },
        },
        flash: {
          '0%': { backgroundColor: '#fff' },
          '50%': { backgroundColor: '#ffe066' },
          '100%': { backgroundColor: '#fff' },
        },
      },
      animation: {
        'fade-in-down': 'fade-in-down 0.7s cubic-bezier(0.4,0,0.2,1)',
        'grow-line': 'grow-line 1.2s cubic-bezier(0.4,0,0.2,1) forwards',
        flash: 'flash 0.4s',
      },
    },
  },
  plugins: [],
};
