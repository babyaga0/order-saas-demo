/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        primary: {
          50: '#FFF5E6',
          100: '#FFE6B8',
          200: '#FFD78A',
          300: '#FFC85C',
          400: '#FFB92E',
          500: '#E78826', // Main orange from logo
          600: '#CC7520',
          700: '#B2621A',
          800: '#994F14',
          900: '#7F3C0E',
        },
        secondary: {
          50: '#F5F5F5',
          100: '#E6E6E6',
          200: '#CCCCCC',
          300: '#B3B3B3',
          400: '#999999',
          500: '#808080',
          600: '#666666',
          700: '#4D4D4D',
          800: '#333333',
          900: '#1A1A1A',
        },
      },
    },
  },
  plugins: [],
}
