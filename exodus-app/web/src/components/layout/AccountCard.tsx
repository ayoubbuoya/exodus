// The bottom of the sidebar: who is signed in, with a menu to log out.
// Visitors get the two ways in instead: "Request access" and "Log in".
//
// Example: a round "C", then "Carol Dupont" over "carol@example.com".
// Before an application exists we only know the email, so it is shown alone.
import { Link } from 'react-router'
import { ChevronsUpDownIcon, LogOutIcon } from 'lucide-react'
import { useProfile } from '@/api/hooks'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { useSignOut } from './useSignOut.ts'

export function AccountCard() {
  const { data: profile } = useProfile()
  const { signOut } = useSignOut()

  // Also covers "API not reachable" (profile undefined): offer the ways in.
  if (profile === undefined || profile === null) {
    return (
      <div className="grid gap-2">
        <Button asChild variant="bright" className="w-full">
          <Link to="/signup">Request access</Link>
        </Button>
        <Button asChild variant="glass" className="w-full">
          <Link to="/login">Log in</Link>
        </Button>
      </div>
    )
  }

  const name = profile.role === 'ADMIN' ? 'Admin' : (profile.application?.fullName ?? null)
  const initial = (name ?? profile.email).charAt(0).toUpperCase()
  const role = profile.role === 'ADMIN' ? 'Admin · runs the house dealer' : profile.wallet !== null ? 'Approved client' : 'Waiting for approval'

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          aria-label="Account menu"
          className="flex w-full items-center gap-3 rounded-2xl bg-foreground/[0.04] p-2.5 text-left transition-colors hover:bg-foreground/[0.08]"
        >
          <span className="grid size-9 shrink-0 place-items-center rounded-full bg-foreground/12 text-sm font-semibold">
            {initial}
          </span>
          <span className="grid min-w-0 flex-1 leading-tight">
            <span className="truncate text-sm font-medium">{name ?? profile.email}</span>
            {name !== null && <span className="truncate text-[11px] text-muted-foreground">{profile.email}</span>}
          </span>
          <ChevronsUpDownIcon className="size-4 shrink-0 text-muted-foreground" aria-hidden />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent side="top" align="start" className="w-(--radix-dropdown-menu-trigger-width)">
        <DropdownMenuLabel className="text-xs font-normal text-muted-foreground">{role}</DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem onSelect={signOut}>
          <LogOutIcon />
          Log out
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
