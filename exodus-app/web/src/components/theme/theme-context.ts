import { createContext, useContext } from 'react'

// The shared theme state. The provider lives in ThemeProvider.tsx.

export type Theme = 'dark' | 'light'

type ThemeContextValue = {
  theme: Theme
  setTheme: (theme: Theme) => void
}

export const ThemeContext = createContext<ThemeContextValue | null>(null)

// Read or change the theme from any component, for example the toggle in the top bar.
export function useTheme(): ThemeContextValue {
  const value = useContext(ThemeContext)
  if (value === null) {
    throw new Error('useTheme must be used inside <ThemeProvider>')
  }
  return value
}
