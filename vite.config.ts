import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "path";

const BUILD_ID = new Date().toISOString().slice(0, 16).replace("T", " ");

export default defineConfig({
  define: { __BUILD_ID__: JSON.stringify(BUILD_ID) },
  plugins: [react()],
  resolve: { alias: { "@": path.resolve(__dirname, "src") } },
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          firebase: ["firebase/app", "firebase/auth", "firebase/firestore"],
          react: ["react", "react-dom", "wouter"],
        },
      },
    },
  },
});
