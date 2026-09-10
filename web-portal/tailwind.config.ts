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
        background: "var(--background)",
        foreground: "var(--foreground)",
        brand: {
          gold: "#F5A941",
          honey: "#F8C146",
          slate: "#545454",
          dark: "#141414",
          darker: "#0d0d0d",
          light: "#FFFFFF",
        },
        primary: {
          50: "#fffbeb",
          100: "#fef3c7",
          500: "#F5A941",
          600: "#d97706",
          700: "#b45309",
          800: "#92400e",
        },
      },
    },
  },
  plugins: [],
};
export default config;
