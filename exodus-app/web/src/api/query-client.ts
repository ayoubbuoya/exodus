// The one React Query client of the app, with a global rule for expired sessions.
import { MutationCache, QueryCache, QueryClient } from '@tanstack/react-query'
import { isUnauthorized } from './client.ts'
import { PROFILE_QUERY_KEY } from './hooks.ts'

// If ANY API call answers 401 (the session expired, or the admin logged out in
// another tab), forget the profile. The route guards see "not logged in" and
// send the user to /login. Ledger calls from /lab never throw 401, so they are not affected.
function forgetProfileOn401(error: unknown): void {
  if (isUnauthorized(error)) {
    queryClient.setQueryData(PROFILE_QUERY_KEY, null)
  }
}

export const queryClient = new QueryClient({
  queryCache: new QueryCache({ onError: forgetProfileOn401 }),
  mutationCache: new MutationCache({ onError: forgetProfileOn401 }),
})
