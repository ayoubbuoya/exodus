// The browser side of the appearance: read and save the choice, and paint it
// on <html>. The rules themselves are in lib/theme.ts.
import { LEGACY_THEME_STORAGE_KEY, THEME_BAR_COLOR, THEME_STORAGE_KEY, themeForPage, themeFromSaved, type Theme } from '@/lib/theme'

// The saved choice, or dark when nothing is saved or storage is blocked
// (for example in some private windows).
export function readSavedTheme(): Theme {
  try {
    return themeFromSaved(localStorage.getItem(THEME_STORAGE_KEY))
  } catch {
    return 'dark'
  }
}

export function saveTheme(theme: Theme): void {
  try {
    localStorage.setItem(THEME_STORAGE_KEY, theme)
    // The old key is not read any more; tidy it away.
    localStorage.removeItem(LEGACY_THEME_STORAGE_KEY)
  } catch {
    // Storage blocked: the theme still works for this visit, it just won't be remembered.
  }
}

// Shows `chosen` on the current page: the `dark` class on <html> (tokens.css
// keys every colour off it) and the browser bar colour. The landing page stays
// dark whatever the choice.
export function paintTheme(chosen: Theme): void {
  const theme = themeForPage(chosen, window.location.pathname)
  document.documentElement.classList.toggle('dark', theme === 'dark')
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', THEME_BAR_COLOR[theme])
}

// Switching theme should be instant: without this, every element that has a
// colour transition (buttons, links, rows) would fade on its own schedule and
// the page would shimmer for a moment. We switch transitions off, let the
// browser apply the new colours, then switch them back on.
export function withoutTransitions(change: () => void): void {
  const style = document.createElement('style')
  style.textContent = '*, *::before, *::after { transition: none !important; }'
  document.head.appendChild(style)
  change()
  // Reading a computed style forces the browser to apply the new colours now.
  window.getComputedStyle(document.body).getPropertyValue('color')
  requestAnimationFrame(() => style.remove())
}
