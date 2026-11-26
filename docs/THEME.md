# Theme Preference (#296)

**Precedence:** an explicit choice saved by the theme toggle (`localStorage["theme"]` = `light` | `dark`) wins. Otherwise the system `prefers-color-scheme` applies. A system-derived theme is never saved, so it keeps following the OS until the user picks one.

**No flash:** `THEME_INIT_SCRIPT` (`src/lib/theme.ts`) is inlined in `<head>` by `src/app/layout.tsx`. It sets the `dark` class and `color-scheme` on `<html>` before hydration, so the first painted frame already uses the right theme. `<html>` has `suppressHydrationWarning` because the class is set before React hydrates.

**Storage denied:** reads and writes go through `readSavedTheme`/`saveTheme`, which never throw. If storage is blocked, the system preference is used and the toggle still works for the session.

- `setTheme` / `toggleTheme` (theme toggle): explicit choice, persisted.
- `applyTheme` (`ThemeProvider`): system-derived, not persisted.

# Server Rendering & Hydration (#305)

- **SSR Safety:** `ThemeProvider` renders without `window`, `document`, or `localStorage` during server rendering (`renderToString`) without hydration mismatches.
- **Unavailable APIs:** Handles missing `window.matchMedia`, null query results, legacy `addListener` / `removeListener` interfaces, and storage access denials (`SecurityError`) gracefully without throwing.
