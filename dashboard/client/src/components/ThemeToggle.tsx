/**
 * @file ThemeToggle.tsx
 * @description Light/dark theme switch for the sidebar. Reads the persisted
 * preference from localStorage on mount (defaulting to light when unset),
 * toggles the `dark` class on <html>, and persists the choice under the
 * `podium-theme` key. Styled to match the sidebar's collapse toggle so it
 * reads as part of the same control cluster in both collapsed and expanded
 * states.
 * @author WP Media
 */

import { useCallback, useEffect, useState } from "react";
import { Sun, Moon } from "lucide-react";

const THEME_STORAGE_KEY = "podium-theme";

function readInitialDark(): boolean {
  try {
    return localStorage.getItem(THEME_STORAGE_KEY) === "dark";
  } catch {
    return false;
  }
}

interface ThemeToggleProps {
  /** When true, render icon-only (sidebar collapsed). */
  collapsed: boolean;
}

export function ThemeToggle({ collapsed }: ThemeToggleProps) {
  // The anti-flicker script in index.html has already applied the class before
  // React mounts; sync our state from the DOM/localStorage so the icon matches.
  const [isDark, setIsDark] = useState<boolean>(() => readInitialDark());

  // Keep the <html> class authoritative on mount in case the inline script
  // didn't run (e.g. SSR/dev edge cases).
  useEffect(() => {
    const root = document.documentElement;
    if (isDark) root.classList.add("dark");
    else root.classList.remove("dark");
  }, [isDark]);

  const toggle = useCallback(() => {
    setIsDark((prev) => {
      const next = !prev;
      try {
        localStorage.setItem(THEME_STORAGE_KEY, next ? "dark" : "light");
      } catch {
        /* ignore disabled storage */
      }
      return next;
    });
  }, []);

  const label = isDark ? "Switch to light theme" : "Switch to dark theme";

  return (
    <button
      onClick={toggle}
      style={{ boxShadow: "var(--card-shadow)" }}
      className={`w-full h-10 rounded-lg bg-surface-2 transition-all duration-150 hover:-translate-y-0.5 active:translate-y-0 text-gray-600 hover:text-gray-900 dark:text-gray-300 dark:hover:text-gray-100 ${
        collapsed
          ? "flex items-center justify-center"
          : "flex items-center gap-2.5 px-3"
      }`}
      title={label}
      aria-label={label}
    >
      {isDark ? (
        <Sun className="w-4 h-4 flex-shrink-0" />
      ) : (
        <Moon className="w-4 h-4 flex-shrink-0" />
      )}
      {!collapsed && (
        <span className="text-[11px] font-semibold uppercase tracking-wide">Theme</span>
      )}
    </button>
  );
}
