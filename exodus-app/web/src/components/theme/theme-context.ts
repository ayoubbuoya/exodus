import { createContext, useContext } from 'react'
import type { Theme } from '@/lib/theme'

// The shared appearance state. The provider lives in ThemeProvider.tsx.

type ThemeContextValue = {
  // What the user chose (the landing page shows dark anyway).
  theme: Theme
  setTheme: (theme: Theme) => void
}

export const ThemeContext = createContext<ThemeContextValue | null>(null)

// Read or change the appearance from any component, for example the account menu.
export function useTheme(): ThemeContextValue {
  const value = useContext(ThemeContext)
  if (value === null) {
    throw new Error('useTheme must be used inside <ThemeProvider>')
  }
  return value
}
