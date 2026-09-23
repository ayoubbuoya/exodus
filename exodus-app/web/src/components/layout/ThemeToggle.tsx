import { MoonIcon, SunIcon } from 'lucide-react'
import { useTheme } from '@/components/theme/theme-context'
import { Button } from '@/components/ui/button'

// Switches between the dark (default) and light theme.
// The ThemeProvider saves the choice, so it survives a page reload.
export function ThemeToggle() {
  const { theme, setTheme } = useTheme()
  const isDark = theme === 'dark'

  return (
    <Button
      variant="ghost"
      size="icon"
      aria-label={isDark ? 'Switch to light theme' : 'Switch to dark theme'}
      onClick={() => setTheme(isDark ? 'light' : 'dark')}
    >
      {isDark ? <SunIcon /> : <MoonIcon />}
    </Button>
  )
}
