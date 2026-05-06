import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/app/**/*.{ts,tsx}",
    "./src/components/**/*.{ts,tsx}",
    "./src/lib/**/*.{ts,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        brand: {
          DEFAULT: "#ff7a00",
          50: "#fff4e6",
          100: "#ffe0b8",
          200: "#ffc680",
          500: "#ff7a00",
          600: "#e56a00",
          700: "#b35200",
        },
        roof: {
          selected: "#1d4ed8",
          unselected: "#94a3b8",
          hover: "#60a5fa",
        },
        module: "#0a0a0a",
        building: "#9ca3af",
      },
      fontFamily: {
        sans: [
          "system-ui",
          "-apple-system",
          "Segoe UI",
          "Roboto",
          "Helvetica",
          "Arial",
          "sans-serif",
        ],
      },
      boxShadow: {
        card: "0 1px 2px rgba(0,0,0,0.04), 0 4px 12px rgba(0,0,0,0.06)",
      },
    },
  },
  plugins: [],
};

export default config;
