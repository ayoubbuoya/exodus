import { toast } from 'sonner'
import { useLogout } from '@/api/hooks'

// Log out, then load the home page from scratch.
//
// Why a full page load (window.location.assign) and not a React Router
// navigate: a router navigation is a low-priority React update, so the guard
// of the page we are on (for example /app) would first see "logged out" and
// jump to /login. A full load also clears every cached query of this user.
export function useSignOut() {
  const logout = useLogout()

  function signOut() {
    logout.mutate(undefined, {
      onSuccess: () => window.location.assign('/'),
      onError: () => toast.error('Logging out failed. Please try again.'),
    })
  }

  return { signOut, isSigningOut: logout.isPending }
}
