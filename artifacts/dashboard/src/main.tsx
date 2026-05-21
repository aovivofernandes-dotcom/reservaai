import { createRoot } from "react-dom/client";
import App from "./App";
import "./index.css";

// ── Register Service Worker ────────────────────────────────────────────────
if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    // Derive the SW URL from BASE_URL so it works both at "/" and at sub-paths
    const swUrl = `${import.meta.env.BASE_URL}sw.js`.replace(/\/+/g, "/");
    navigator.serviceWorker
      .register(swUrl, {
        // Scope to the app root — must be at same level or above the SW file
        scope: import.meta.env.BASE_URL || "/",
        updateViaCache: "none",
      })
      .then((reg) => {
        // Check for updates when the user navigates to the page
        reg.update().catch(() => {});
      })
      .catch(() => {
        // SW registration failed silently — app still works without it
      });
  });
}

createRoot(document.getElementById("root")!).render(<App />);
