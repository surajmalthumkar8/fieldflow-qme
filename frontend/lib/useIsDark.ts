"use client";

import { useEffect, useState } from "react";

// Tracks whether the app is in dark mode (the `dark` class on <html>), and updates
// live when the user toggles the theme — so client charts can re-color themselves.
export function useIsDark(): boolean {
  const [dark, setDark] = useState(false);

  useEffect(() => {
    const el = document.documentElement;
    const update = () => setDark(el.classList.contains("dark"));
    update();
    const obs = new MutationObserver(update);
    obs.observe(el, { attributes: true, attributeFilter: ["class"] });
    return () => obs.disconnect();
  }, []);

  return dark;
}

// Resolved chart palette for the current theme — gridlines that actually show on
// a white background in light mode, plus readable axes and tooltips.
export function chartTheme(dark: boolean) {
  return {
    grid: dark ? "#334155" : "#cbd5e1", // slate-700 / slate-300
    axis: dark ? "#94a3b8" : "#64748b", // slate-400 / slate-500
    tooltip: dark
      ? { background: "#1e293b", border: "1px solid #334155", color: "#e2e8f0" }
      : { background: "#ffffff", border: "1px solid #e2e8f0", color: "#0f172a" },
    cursor: dark ? "#ffffff14" : "#6366f114",
  };
}
