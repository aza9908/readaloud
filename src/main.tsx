import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import "./index.css";

// Follow the device appearance until the reader chooses a theme.
const appearance = window.matchMedia("(prefers-color-scheme: dark)");
function applyAppearance() {
  let saved: string | null = null;
  try { saved = localStorage.getItem("theme"); } catch { /* Private browsing may disable storage. */ }
  document.documentElement.classList.toggle("dark", saved === "dark" || (saved !== "light" && appearance.matches));
}
applyAppearance();
appearance.addEventListener("change", applyAppearance);
window.addEventListener("storage", event => {
  if (event.key === "theme" || event.key === null) applyAppearance();
});

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
