// Right side of the top bar: "Log in / Sign up" for visitors, or the user's
// email with a menu (log out) once logged in.
import { Link } from 'react-router'
import { LogOutIcon, UserIcon } from 'lucide-react'
import { toast } from 'sonner'
import { useLogout, useProfile } from '@/api/hooks'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'

export function UserMenu() {
  const { data: profile } = useProfile()
  const logout = useLogout()

  // Also covers "API not reachable" (profile undefined): offer to log in.
  if (profile === undefined || profile === null) {
    return (
      <div className="flex items-center gap-1">
        <Button asChild variant="ghost" size="sm">
          <Link to="/login">Log in</Link>
        </Button>
        <Button asChild size="sm">
          <Link to="/signup">Sign up</Link>
        </Button>
      </div>
    )
  }

  // After logging out we load the home page from scratch (not a React Router
  // navigate). Why: a router navigation is a low-priority React update, so the
  // guard of the page we are on (for example /app) would first see "logged out"
  // and jump to /login. A full load also clears every cached query of this user.
  function handleLogout() {
    logout.mutate(undefined, {
      onSuccess: () => window.location.assign('/'),
      onError: () => toast.error('Logging out failed. Please try again.'),
    })
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="sm" aria-label="Account menu">
          <UserIcon data-icon="inline-start" />
          {/* Phones show only the icon, to keep the header on one line. */}
          <span className="hidden max-w-40 truncate sm:inline">{profile.email}</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuLabel className="text-xs text-muted-foreground">
          {profile.role === 'ADMIN' ? 'Admin' : 'Client'}
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem onSelect={handleLogout}>
          <LogOutIcon />
          Log out
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
