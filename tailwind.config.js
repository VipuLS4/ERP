/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        brand: {
          50: '#fffdf7',
          100: '#fff8e8',
          200: '#f5e6c0',
          300: '#e8b44a',
          400: '#d49a2a',
          500: '#b8821e',
          600: '#9a6a18',
          700: '#7a5214',
          800: '#5a3c0f',
          900: '#3a2608',
        },
        forest: {
          50: '#f0f7f1',
          100: '#dcecdf',
          200: '#b9d6bf',
          300: '#8fbb98',
          400: '#5e9c6c',
          500: '#3d8050',
          600: '#2d6a3e',
          700: '#1f542d',
          800: '#163d21',
          900: '#102b1b',
        },
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'Avenir', 'Helvetica', 'Arial', 'sans-serif'],
      },
    },
  },
  plugins: [],
};
