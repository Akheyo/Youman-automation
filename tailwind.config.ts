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
        // A&B-Solarenergy-Stil: kräftiges Royal-Blau auf reinem Weiß.
        // DEFAULT = die Hauptaktionsfarbe (Buttons, Icons), 50/100/200 sind
        // sehr helle Surfaces für Hover/Akzente, 600/700 sind dunklere
        // Hover-/Active-States.
        brand: {
          DEFAULT: "#1e50e0",
          50: "#eef4ff",
          100: "#dbe7ff",
          200: "#b8caff",
          500: "#1e50e0",
          600: "#1840c4",
          700: "#0f2e96",
        },
        roof: {
          selected: "#1e50e0",
          unselected: "#94a3b8",
          hover: "#60a5fa",
        },
        module: "#0a0a0a",
        building: "#9ca3af",
      },
      fontFamily: {
        sans: [
          "var(--font-inter)",
          "Inter",
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
