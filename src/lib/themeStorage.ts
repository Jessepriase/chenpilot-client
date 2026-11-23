/**
 * Validated access to the saved theme (#297). Only "light" or "dark" are accepted; anything
 * else (stale, manually edited, or unreadable storage) counts as "no saved theme", so callers
 * fall back to the system preference.
 */
export type ThemeMode = "light" | "dark";

export function parseThemeValue(value: unknown): ThemeMode | null {
  return value === "light" || value === "dark" ? value : null;
}

export function readStoredTheme(): ThemeMode | null {
  try {
    return parseThemeValue(window.localStorage.getItem("theme"));
  } catch {
    return null;
  }
}

export function writeStoredTheme(mode: ThemeMode): void {
  try {
    window.localStorage.setItem("theme", mode);
  } catch {
    // Storage denied: keep the in-memory theme only
  }
}
