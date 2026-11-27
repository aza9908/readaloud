import type { Config } from "tailwindcss";

export default {
  darkMode: "class",
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        // Enamel, cloth and brass used throughout the reading room
        brand: {
          50: "#f0f6f3",
          100: "#ddebe6",
          200: "#bad8d1",
          300: "#93bfb5",
          400: "#70a79c",
          500: "#2e6768", // primary
          600: "#235454",
          700: "#1d4749",
          800: "#193a3d",
          900: "#152f32",
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
          ink: "#192e36",
          muted: "#56686a",
        },
        ink: {
          DEFAULT: "var(--ink)",
          soft: "var(--muted)",
          faint: "var(--muted)",
        },
      },
      fontFamily: {
        display: ["var(--font-system)"],
        sans: ["var(--font-system)"],
      },
      borderRadius: {
        xl: "1rem",
        "2xl": "1.25rem",
        "3xl": "1.75rem",
      },
      boxShadow: {
        soft: "0 2px 8px -2px rgba(42,37,64,0.08), 0 4px 16px -4px rgba(42,37,64,0.06)",
        card: "0 4px 20px -6px rgba(42,37,64,0.12)",
        lift: "0 12px 32px -10px rgba(35,73,71,0.24)",
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
