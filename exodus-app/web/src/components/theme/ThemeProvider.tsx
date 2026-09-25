import { useEffect, useState, type ReactNode } from 'react'
import { THEME_STORAGE_KEY, themeFromSaved, type Theme } from '@/lib/theme'
import { ThemeContext } from './theme-context.ts'
import { paintTheme, readSavedTheme, saveTheme, withoutTransitions } from './theme-dom.ts'

// The app's appearance: dark ("Glacier", the default) or light ("Frost", frosted
// blue glass), chosen in the account menu (decision G in docs/client-app.md).
// The rules (dark by default, the landing page always dark) are in lib/theme.ts.
//
// Why our own provider instead of the `next-themes` package: next-themes renders
// an inline <script> (made for server rendering), and React 19 logs an error for
// that on every page. We render in the browser only, so a few lines are enough.
// index.html already painted the saved choice before React started, so the
// page never flashes.
export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setThemeState] = useState<Theme>(readSavedTheme)

  // A choice made in another tab of the same browser applies here too.
  useEffect(() => {
    function onStorage(event: StorageEvent) {
      if (event.key === THEME_STORAGE_KEY) {
        const next = themeFromSaved(event.newValue)
        setThemeState(next)
        withoutTransitions(() => paintTheme(next))
      }
    }
    window.addEventListener('storage', onStorage)
    return () => window.removeEventListener('storage', onStorage)
  }, [])

  function setTheme(next: Theme) {
    setThemeState(next)
    saveTheme(next)
    withoutTransitions(() => paintTheme(next))
  }

  return <ThemeContext.Provider value={{ theme, setTheme }}>{children}</ThemeContext.Provider>
}
