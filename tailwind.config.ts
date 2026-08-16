import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        ink: {
          50: "#f4f6f5",
          100: "#e4e9e7",
          200: "#c9d4cf",
          300: "#a3b5ad",
          400: "#789389",
          500: "#5c776e",
          600: "#485f58",
          700: "#3c4e48",
          800: "#33403c",
          900: "#2c3734",
          950: "#161e1c",
        },
        tide: {
          400: "#4a9aa3",
          500: "#2f838c",
          600: "#1f6f7a",
        },
      },
      fontFamily: {
        display: ["var(--font-display)", "Georgia", "serif"],
        sans: ["var(--font-sans)", "system-ui", "sans-serif"],
        mono: ["var(--font-mono)", "ui-monospace", "monospace"],
      },
    },
  },
  plugins: [],
};

export default config;
