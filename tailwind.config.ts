import type { Config } from "tailwindcss";

export default {
  darkMode: "class",
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        // Brand — disciplined violet with a warm amber reward accent
        brand: {
          50: "#f2efff",
          100: "#e7e0ff",
          200: "#d0c2ff",
          300: "#b09bff",
          400: "#8f6dff",
          500: "#6d4aff", // primary
          600: "#5a35e6",
          700: "#4a29bf",
          800: "#3d2499",
          900: "#2f1d70",
        },
        amber: {
          400: "#ffc24b",
          500: "#f5a623",
          600: "#e08a0b",
        },
        // Warm paper canvas — the "book" feeling
        paper: {
          DEFAULT: "#fbf9f4",
          card: "#ffffff",
          ink: "#2a2540",
          muted: "#6b6580",
        },
        ink: {
          DEFAULT: "#2a2540",
          soft: "#57516e",
          faint: "#8a84a0",
        },
      },
      fontFamily: {
        display: ["'Baloo 2'", "system-ui", "sans-serif"],
        sans: ["Nunito", "system-ui", "sans-serif"],
      },
      borderRadius: {
        xl: "1rem",
        "2xl": "1.25rem",
        "3xl": "1.75rem",
      },
      boxShadow: {
        soft: "0 2px 8px -2px rgba(42,37,64,0.08), 0 4px 16px -4px rgba(42,37,64,0.06)",
        card: "0 4px 20px -6px rgba(42,37,64,0.12)",
        lift: "0 12px 32px -10px rgba(109,74,255,0.28)",
        page: "0 1px 0 rgba(0,0,0,0.03), 0 8px 28px -12px rgba(42,37,64,0.18)",
      },
      keyframes: {
        "toast-in": {
          from: { opacity: "0", transform: "translateY(-14px) scale(0.96)" },
          to: { opacity: "1", transform: "translateY(0) scale(1)" },
        },
        "fade-up": {
          from: { opacity: "0", transform: "translateY(10px)" },
          to: { opacity: "1", transform: "translateY(0)" },
        },
        "pop": {
          "0%": { transform: "scale(0.9)" },
          "60%": { transform: "scale(1.03)" },
          "100%": { transform: "scale(1)" },
        },
        "float": {
          "0%,100%": { transform: "translateY(0)" },
          "50%": { transform: "translateY(-6px)" },
        },
      },
      animation: {
        "toast-in": "toast-in 300ms cubic-bezier(0.16,1,0.3,1)",
        "fade-up": "fade-up 500ms cubic-bezier(0.16,1,0.3,1) both",
        pop: "pop 350ms cubic-bezier(0.16,1,0.3,1)",
        float: "float 4s ease-in-out infinite",
      },
    },
  },
  plugins: [],
} satisfies Config;
