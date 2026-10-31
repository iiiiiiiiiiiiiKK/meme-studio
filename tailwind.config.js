/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        ink: {
          950: '#08090c',
          900: '#0c0e13',
          850: '#101218',
          800: '#14171f',
          750: '#181c26',
          700: '#1e222d',
          600: '#2a2f3d',
          500: '#3a4152',
        },
        accent: {
          DEFAULT: '#c6f24e',
          soft: '#dcff8a',
          dim: '#8fae2e',
        },
      },
      fontFamily: {
        sans: ['Inter', 'SF Pro Display', 'Segoe UI', 'PingFang SC', 'Microsoft YaHei', 'sans-serif'],
        mono: ['JetBrains Mono', 'SFMono-Regular', 'Consolas', 'monospace'],
      },
      screens: {
        xs: '380px',
      },
    },
  },
  plugins: [],
};
