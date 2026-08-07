"use client";

import { useEffect } from "react";

/**
 * Registers the service worker that makes the site installable and gives it an
 * offline page. See public/sw.js for what it will and will not cache — the
 * short version is that no page and no API response is ever stored.
 *
 * Registration is skipped in development, where a fetch-intercepting worker
 * fights with Vite's module graph and HMR. Build and `npm run start` to
 * exercise it locally.
 */
export function ServiceWorkerRegistration() {
  useEffect(() => {
    if (process.env.NODE_ENV !== "production") return;
    if (!("serviceWorker" in navigator)) return;

    // Registering during load contends with the page's own requests for
    // bandwidth on exactly the connections that need them most.
    const register = () => {
      void navigator.serviceWorker.register("/sw.js", { scope: "/" }).catch(() => {
        // A failed registration costs the offline page and nothing else; the
        // site works the same way it did before there was a worker.
      });
    };

    if (document.readyState === "complete") {
      register();
      return;
    }
    window.addEventListener("load", register);
    return () => window.removeEventListener("load", register);
  }, []);

  return null;
}
