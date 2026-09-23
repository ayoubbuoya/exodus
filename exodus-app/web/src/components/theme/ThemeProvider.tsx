import { useEffect, useState, type ReactNode } from 'react'
import { ThemeContext, type Theme } from './theme-context.ts'

// Light or dark look for the whole app (decision G in docs/client-app.md: dark is the default).
//
// Why our own provider instead of the `next-themes` package: next-themes renders
// an inline <script> (made for server rendering), and React 19 logs an error for
// that on every page. We render in the browser only, so 30 plain lines are enough.
//
// How it works: we put the class "dark" on <html> or remove it. Tailwind's
// `dark:` classes and the colour variables in index.css react to that class.
// index.html sets the class before React starts, so the page never flashes white.

// Also read by the small script in index.html. Keep both in sync.
const STORAGE_KEY = 'exodus-theme'

// The saved theme, or dark if nothing is saved (or storage is blocked, for example in a private window).
function readSavedTheme(): Theme {
  try {
    return localStorage.getItem(STORAGE_KEY) === 'light' ? 'light' : 'dark'
  } catch {
    return 'dark'
  }
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setTheme] = useState<Theme>(readSavedTheme)

  // Apply the theme to <html> and remember it for the next visit.
  useEffect(() => {
    document.documentElement.classList.toggle('dark', theme === 'dark')
    try {
      localStorage.setItem(STORAGE_KEY, theme)
    } catch {
      // Storage blocked: the theme still works, it just won't be remembered.
    }
  }, [theme])

  return <ThemeContext.Provider value={{ theme, setTheme }}>{children}</ThemeContext.Provider>
}
