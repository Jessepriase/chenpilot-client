"use client";

import React, { useEffect } from "react";
import { useAppDispatch, useAppSelector } from "@/store";
import { applyTheme } from "@/store/slices/uiSlice";
import { readSavedTheme, resolveTheme } from "@/lib/theme";

/**
 * Keeps the store and the <html> class in sync with the theme preference (#296).
 * The first frame is already themed by THEME_INIT_SCRIPT in the root layout; this provider
 * only syncs Redux and follows system changes while no explicit choice is saved.
 */
export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const dispatch = useAppDispatch();
  const theme = useAppSelector((state) => (state as { ui?: { mode?: 'light' | 'dark' } })?.ui?.mode ?? 'light');

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (typeof window.matchMedia !== "function") {
      dispatch(applyTheme(resolveTheme(readSavedTheme(), false)));
      return;
    }

    const mediaQuery = window.matchMedia("(prefers-color-scheme: dark)");
    if (!mediaQuery) {
      dispatch(applyTheme(resolveTheme(readSavedTheme(), false)));
      return;
    }

    // Saved explicit choice wins; otherwise system preference (not persisted)
    dispatch(applyTheme(resolveTheme(readSavedTheme(), !!mediaQuery.matches)));

    const handleChange = (e: MediaQueryListEvent | { matches: boolean }) => {
      if (!readSavedTheme()) dispatch(applyTheme(e.matches ? "dark" : "light"));
    };

    if (typeof mediaQuery.addEventListener === "function") {
      mediaQuery.addEventListener("change", handleChange as (e: MediaQueryListEvent) => void);
      return () => mediaQuery.removeEventListener("change", handleChange as (e: MediaQueryListEvent) => void);
    } else if (typeof (mediaQuery as unknown as { addListener?: (fn: unknown) => void }).addListener === "function") {
      (mediaQuery as unknown as { addListener: (fn: unknown) => void }).addListener(handleChange);
      return () => (mediaQuery as unknown as { removeListener: (fn: unknown) => void }).removeListener(handleChange);
    }
  }, [dispatch]);

  useEffect(() => {
    if (typeof document === "undefined" || !document.documentElement) return;
    const html = document.documentElement;
    html.classList.toggle("dark", theme === "dark");
    html.style.colorScheme = theme;
  }, [theme]);

  return <>{children}</>;
}
