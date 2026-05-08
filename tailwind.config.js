/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        background: 'hsl(0 0% 100%)',
        foreground: 'hsl(222 47% 11%)',
        muted: 'hsl(210 40% 96%)',
        'muted-foreground': 'hsl(215 16% 47%)',
        border: 'hsl(214 32% 91%)',
        input: 'hsl(214 32% 91%)',
        primary: 'hsl(222 47% 11%)',
        'primary-foreground': 'hsl(0 0% 100%)',
        accent: 'hsl(210 40% 96%)',
        'accent-foreground': 'hsl(222 47% 11%)',
        success: 'hsl(142 71% 45%)',
        warning: 'hsl(38 92% 50%)',
        danger: 'hsl(0 72% 51%)',
      },
      fontFamily: {
        sans: ['system-ui', '-apple-system', 'BlinkMacSystemFont', 'Segoe UI', 'sans-serif'],
      },
    },
  },
  plugins: [],
};
