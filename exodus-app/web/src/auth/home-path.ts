import type { Profile } from '@/api/types'

// Where a logged-in person belongs:
//   admin                          -> /admin (review queue)
//   approved client (has a wallet) -> /app
//   everyone else                  -> /onboarding (form or "under review")
export function homePathFor(profile: Profile): string {
  if (profile.role === 'ADMIN') {
    return '/admin'
  }
  if (profile.wallet !== null) {
    return '/app'
  }
  return '/onboarding'
}
