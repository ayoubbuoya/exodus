// One React Query hook per backend call the pages make.
//
// Queries (reads) are cached by key, so several components can ask for the
// profile and only one request is sent. Mutations (writes) refresh the queries
// they change, for example approving an application reloads the admin table.
import { keepPreviousData, useMutation, useQuery, useQueryClient, type QueryClient } from '@tanstack/react-query'
import { apiRequest, isUnauthorized } from './client.ts'
import type {
  ActivityRow,
  ApplicationForm,
  ApplicationForReview,
  ApplicationStatus,
  FaucetClaimResult,
  LatestPrice,
  OpenRedemption,
  Page,
  PricePoint,
  Profile,
  TransferRequest,
  WalletOverview,
} from './types.ts'

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

// Ends the session on the server. The caller then reloads the page (see useSignOut),
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

// ---------------------------------------------------------------------------
// Dashboard (/app): price, wallet, activity and the wallet commands
// ---------------------------------------------------------------------------

// Exported: the market hooks reload the wallet after a trade or a payout.
export const WALLET_KEY = ['wallet']
const ACTIVITY_KEY = ['wallet', 'activity']
const REDEMPTIONS_KEY = ['wallet', 'redemptions']

// How often the dashboard refreshes. The oracle bot publishes every 5 s by
// default, and a snapshot is valid for 30 s, so a few seconds keeps it "live".
const PRICE_POLL_MS = 3_000
const HISTORY_POLL_MS = 10_000
const WALLET_POLL_MS = 5_000

// While a redeem is pending, check every 2 s: the fund settles within a few seconds.
const PENDING_REDEEM_POLL_MS = 2_000

// Rows shown in the Activity card.
const ACTIVITY_ROWS = 10

export function useLatestPrice() {
  return useQuery({
    queryKey: ['prices', 'usyc', 'latest'],
    queryFn: () => apiRequest<LatestPrice>('GET', '/prices/usyc/latest'),
    refetchInterval: PRICE_POLL_MS,
  })
}

export function usePriceHistory() {
  return useQuery({
    queryKey: ['prices', 'usyc', 'history'],
    queryFn: () => apiRequest<{ instrument: string; points: PricePoint[] }>('GET', '/prices/usyc'),
    refetchInterval: HISTORY_POLL_MS,
  })
}

export function useWallet() {
  return useQuery({
    queryKey: WALLET_KEY,
    queryFn: () => apiRequest<WalletOverview>('GET', '/wallet'),
    refetchInterval: WALLET_POLL_MS,
  })
}

// Also polls, so tokens that another client sends show up by themselves.
// `limit`: the Wallet shows the last 10 rows; the Portfolio asks for more,
// because it keeps only the market rows.
export function useActivity(limit = ACTIVITY_ROWS) {
  return useQuery({
    queryKey: [...ACTIVITY_KEY, limit],
    queryFn: () => apiRequest<{ items: ActivityRow[] }>('GET', `/wallet/activity?limit=${limit}`),
    refetchInterval: WALLET_POLL_MS,
  })
}

// After any wallet command, balances and activity changed: reload them.
// (WALLET_KEY is a prefix of ACTIVITY_KEY and REDEMPTIONS_KEY, so one call covers all.)
function refreshWallet(queryClient: QueryClient): Promise<void> {
  return queryClient.invalidateQueries({ queryKey: WALLET_KEY })
}

export function useClaimFaucet() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: () => apiRequest<FaucetClaimResult>('POST', '/wallet/faucet-claims'),
    onSuccess: () => refreshWallet(queryClient),
  })
}

export function useSubscribe() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (usdcAmount: string) =>
      apiRequest<{ usdcAmount: string; retried: boolean }>('POST', '/wallet/subscriptions', { usdcAmount }),
    onSuccess: () => refreshWallet(queryClient),
  })
}

// The client's redeem requests the fund has not paid yet.
// Polls fast while one is open. When the list gets shorter, the fund has paid
// (or the request was cancelled), so we reload the balances and activity at
// once instead of waiting for their own 5 s poll.
export function useOpenRedemptions() {
  const queryClient = useQueryClient()
  return useQuery({
    queryKey: REDEMPTIONS_KEY,
    queryFn: async () => {
      const before = queryClient.getQueryData<{ items: OpenRedemption[] }>(REDEMPTIONS_KEY)
      const after = await apiRequest<{ items: OpenRedemption[] }>('GET', '/wallet/redemptions')
      if (before !== undefined && after.items.length < before.items.length) {
        // Only the balances and activity: reloading REDEMPTIONS_KEY here would loop.
        void queryClient.invalidateQueries({ queryKey: WALLET_KEY, exact: true })
        void queryClient.invalidateQueries({ queryKey: ACTIVITY_KEY })
      }
      return after
    },
    refetchInterval: (query) => {
      const openCount = query.state.data?.items.length ?? 0
      return openCount > 0 ? PENDING_REDEEM_POLL_MS : WALLET_POLL_MS
    },
  })
}

// Alice redeems 100 USYC: burned now, paid in USDC by the fund a few seconds later.
export function useRequestRedeem() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (usycAmount: string) =>
      apiRequest<{ usycAmount: string; retried: boolean }>('POST', '/wallet/redemptions', { usycAmount }),
    onSuccess: () => refreshWallet(queryClient),
  })
}

// Alice cancels an open redeem request and gets her USYC back.
export function useCancelRedeem() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (requestId: string) =>
      apiRequest<{ requestId: string }>('DELETE', `/wallet/redemptions/${encodeURIComponent(requestId)}`),
    onSuccess: () => refreshWallet(queryClient),
  })
}

export function useSendTokens() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (request: TransferRequest) => apiRequest<TransferRequest>('POST', '/wallet/transfers', request),
    onSuccess: () => refreshWallet(queryClient),
  })
}
