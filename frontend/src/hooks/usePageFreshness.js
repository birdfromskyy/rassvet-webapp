import { useEffect, useState } from "react";
import api from "../services/api";

// A tab left open in the background (phone locked / app switched) freezes its
// JS state and data. When the user comes back, the page shows stale data (e.g.
// "Не удалось загрузить новости" frozen from an old load).
//
// On every return from the background we first wait for the phone's connection
// to recover, then verify the API is reachable. After a long absence a healthy
// ordinary page reloads; an admin page or a filled form gets a manual-refresh
// banner. If the API check fails, every page gets the banner instead of using a
// potentially frozen tab.
const STALE_MS = 20 * 60 * 1000;
const NETWORK_RECOVERY_DELAY_MS = 5 * 1000;
const HEALTH_TIMEOUT_MS = 5 * 1000;

export default function usePageFreshness() {
  const [stale, setStale] = useState(false);

  useEffect(() => {
    let hiddenAt = null;
    let recoveryTimer = null;
    let isMounted = true;

    const hasFilledForm = () => {
      const els = document.querySelectorAll("input, textarea");
      for (const el of els) {
        const type = (el.type || "").toLowerCase();
        if (["hidden", "search", "checkbox", "radio", "submit", "button"].includes(type)) {
          continue;
        }
        if (el.value && el.value.trim()) return true;
      }
      return false;
    };

    const onVisibility = () => {
      if (document.visibilityState === "hidden") {
        hiddenAt = Date.now();
        if (recoveryTimer) {
          window.clearTimeout(recoveryTimer);
          recoveryTimer = null;
        }
        return;
      }
      if (!hiddenAt) return;
      const away = Date.now() - hiddenAt;
      hiddenAt = null;

      // Mobile browsers often restore JS before Wi-Fi/mobile data is ready.
      // Give the network a moment, then distinguish a recoverable tab from a
      // page that should ask the user to refresh manually.
      recoveryTimer = window.setTimeout(async () => {
        try {
          await api.get("/health", { timeout: HEALTH_TIMEOUT_MS });
          if (!isMounted) return;

          const isAdmin = window.location.pathname.startsWith("/admin");
          if (away >= STALE_MS && (isAdmin || hasFilledForm())) {
            setStale(true); // do not discard possible unsaved work
          } else if (away >= STALE_MS) {
            window.location.reload();
          }
        } catch {
          if (isMounted) setStale(true);
        }
      }, NETWORK_RECOVERY_DELAY_MS);
    };

    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      isMounted = false;
      document.removeEventListener("visibilitychange", onVisibility);
      if (recoveryTimer) window.clearTimeout(recoveryTimer);
    };
  }, []);

  return stale;
}
