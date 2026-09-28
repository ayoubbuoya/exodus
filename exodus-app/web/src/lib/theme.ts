// The appearance rules, in one place (no React, easy to test):
//   - Dark ("Glacier") is the default for everyone.
//   - Light ("Frost", frosted blue glass) only when the user picked it in the
//     account menu. The choice is saved in the browser under THEME_STORAGE_KEY.
//   - The landing page (/) is always dark, whatever the choice.
//
// index.html repeats these rules in a tiny inline script, so the right theme
// is painted before the page shows (no flash). Keep both in sync.

export type Theme = 'dark' | 'light'

// "-v2": a new key resets every browser to dark once. Before 2026-09-25 the app
// saved its choice under "exodus-theme", and some browsers were stuck on the
// old, flat light theme without their owner remembering why.
export const THEME_STORAGE_KEY = 'exodus-theme-v2'
export const LEGACY_THEME_STORAGE_KEY = 'exodus-theme'

// The saved value -> a theme. Anything but "light" (nothing saved, a typo, an
// old value) means dark.
export function themeFromSaved(saved: string | null): Theme {
  return saved === 'light' ? 'light' : 'dark'
}

// The theme a page actually shows. Example: Carol picked light; on /app she
// sees light, on / (the landing page) she still sees dark.
export function themeForPage(chosen: Theme, pathname: string): Theme {
  return pathname === '/' ? 'dark' : chosen
}

// The browser bar colour (<meta name="theme-color">) for each theme: the page
// background, so the bar blends into the page on phones.
export const THEME_BAR_COLOR: Record<Theme, string> = {
  dark: '#060A13',
  light: '#EEF2F8',
}
