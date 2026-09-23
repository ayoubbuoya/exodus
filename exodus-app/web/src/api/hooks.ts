// One React Query hook per backend call the pages make.
//
// Queries (reads) are cached by key, so several components can ask for the
// profile and only one request is sent. Mutations (writes) refresh the queries
// they change, for example approving an application reloads the admin table.
import { keepPreviousData, useMutation, useQuery, useQueryClient, type QueryClient } from '@tanstack/react-query'
import { apiRequest, isUnauthorized } from './client.ts'
import type { ApplicationForm, ApplicationForReview, ApplicationStatus, Page, Profile } from './types.ts'

export const PROFILE_QUERY_KEY = ['profile']
const ADMIN_APPLICATIONS_KEY = ['admin', 'applications']

// Rows per page in the admin table.
export const ADMIN_PAGE_SIZE = 20

// ---------------------------------------------------------------------------
// Profile and session
// ---------------------------------------------------------------------------

// The logged-in user, or null when nobody is logged in.
// "Not logged in" is a normal state here, not an error, so a 401 becomes null.
async function fetchProfile(): Promise<Profile | null> {
  try {
    return await apiRequest<Profile>('GET', '/auth/me')
  } catch (error) {
    if (isUnauthorized(error)) {
      return null
    }
    throw error
  }
}

// How often a pending applicant's page asks "am I approved yet?".
const PENDING_POLL_MS = 10_000

// Option `pollWhilePending`: while the application is PENDING, check again
// every 10 s, so Alice sees her approval on /onboarding without reloading.
// Polling stops by itself once the status changes.
export function useProfile(options: { pollWhilePending?: boolean } = {}) {
  return useQuery({
    queryKey: PROFILE_QUERY_KEY,
    queryFn: fetchProfile,
    staleTime: 30_000,
    retry: false,
    refetchInterval: (query) => {
      const isPending = query.state.data?.application?.status === 'PENDING'
      return options.pollWhilePending === true && isPending ? PENDING_POLL_MS : false
    },
  })
}

// After login or sign-up, load the fresh profile right away and return it,
// so the page can decide where to go (admin -> /admin, approved -> /app, ...).
async function reloadProfile(queryClient: QueryClient): Promise<Profile | null> {
  return queryClient.fetchQuery({ queryKey: PROFILE_QUERY_KEY, queryFn: fetchProfile, staleTime: 0 })
}

export type Credentials = { email: string; password: string }

export function useLogin() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (credentials: Credentials) => {
      await apiRequest('POST', '/auth/login', credentials)
      return reloadProfile(queryClient)
    },
  })
}

export function useSignup() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (credentials: Credentials) => {
      await apiRequest('POST', '/auth/signup', credentials)
      return reloadProfile(queryClient)
    },
  })
}

// Ends the session on the server. The caller then reloads the page (see UserMenu),
// which also throws away everything cached for this user.
export function useLogout() {
  return useMutation({
    mutationFn: () => apiRequest<void>('POST', '/auth/logout'),
  })
}

// ---------------------------------------------------------------------------
// The client's access application
// ---------------------------------------------------------------------------

export function useSubmitApplication() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (form: ApplicationForm) => apiRequest('PUT', '/applications/me', form),
    // The profile carries the application status, so reload it.
    onSuccess: () => queryClient.invalidateQueries({ queryKey: PROFILE_QUERY_KEY }),
  })
}

// ---------------------------------------------------------------------------
// Admin review
// ---------------------------------------------------------------------------

// `status` undefined = all statuses.
export function useAdminApplications(status: ApplicationStatus | undefined, page: number) {
  return useQuery({
    queryKey: [...ADMIN_APPLICATIONS_KEY, status ?? 'ALL', page],
    queryFn: () => {
      const query = new URLSearchParams({ page: String(page), limit: String(ADMIN_PAGE_SIZE) })
      if (status !== undefined) {
        query.set('status', status)
      }
      return apiRequest<Page<ApplicationForReview>>('GET', `/admin/applications?${query.toString()}`)
    },
    // Keep showing the old page while the next one loads (no flicker when paging).
    placeholderData: keepPreviousData,
    // New applications show up without a reload.
    refetchInterval: 15_000,
  })
}

export function useApproveApplication() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (applicationId: string) =>
      apiRequest<ApplicationForReview>('POST', `/admin/applications/${applicationId}/approval`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ADMIN_APPLICATIONS_KEY }),
  })
}

export function useRejectApplication() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (input: { applicationId: string; reason: string }) =>
      apiRequest<ApplicationForReview>('POST', `/admin/applications/${input.applicationId}/rejection`, {
        // An empty reason is sent as "no reason" rather than "".
        reason: input.reason.trim() === '' ? undefined : input.reason,
      }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ADMIN_APPLICATIONS_KEY }),
  })
}
