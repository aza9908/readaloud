import type { Config } from "tailwindcss";

export default {
  darkMode: "class",
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        primary: { DEFAULT: "#7c3aed", light: "#a78bfa", soft: "#ede9fe" },
      },
      fontFamily: { sans: ["Nunito", "system-ui", "sans-serif"] },
    },
  },
  plugins: [],
} satisfies Config;
