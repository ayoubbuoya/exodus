// React Query hooks for the markets (the Pendle part): market cards, split /
// merge / claim / PT redeem, the portfolio, private PT trading (RFQ) and the
// admins' dealer desk. The fund wallet's hooks stay in hooks.ts.
//
// Refresh rules:
//   - after any market action, reload the portfolio AND the wallet (a split
//     spends USYC, a trade moves USDC, a payout adds USYC);
//   - while a payout request is open, or while waiting for a quote, poll fast
//     (the bots answer within about 2 seconds).
import { useMutation, useQuery, useQueryClient, type QueryClient } from '@tanstack/react-query'
import { apiRequest } from './client.ts'
import { WALLET_KEY } from './hooks.ts'
import type {
  DealerPosition,
  DealerRequestView,
  DealerSettings,
  MarketRequestKind,
  MarketView,
  Portfolio,
  QuoteRequestView,
  QuoteView,
  RfqSide,
} from './types.ts'

const MARKETS_KEY = ['markets']
const PORTFOLIO_KEY = ['portfolio']
const QUOTE_REQUESTS_KEY = ['quote-requests']
const QUOTES_KEY = ['quotes']
const DEALER_KEY = ['dealer']

const MARKETS_POLL_MS = 5_000 // the demo clock and the dealer's prices move with the oracle
const PORTFOLIO_POLL_MS = 5_000
const FAST_POLL_MS = 1_000 // while a bot is expected to answer
const DEALER_POLL_MS = 2_000

// Market actions change the market tokens AND the fund wallet.
function refreshHoldings(queryClient: QueryClient): Promise<void> {
  void queryClient.invalidateQueries({ queryKey: WALLET_KEY })
  return queryClient.invalidateQueries({ queryKey: PORTFOLIO_KEY })
}

// ---------------------------------------------------------------------------
// Markets
// ---------------------------------------------------------------------------

export function useMarkets() {
  return useQuery({
    queryKey: MARKETS_KEY,
    queryFn: () => apiRequest<{ items: MarketView[] }>('GET', '/markets'),
    refetchInterval: MARKETS_POLL_MS,
  })
}

export function useMarket(marketId: string) {
  return useQuery({
    queryKey: [...MARKETS_KEY, marketId],
    queryFn: () => apiRequest<MarketView>('GET', `/markets/${encodeURIComponent(marketId)}`),
    refetchInterval: MARKETS_POLL_MS,
  })
}

type MarketCommand = { marketId: string; amount: string | null; retried: boolean }

// Mint (split): USYC in, PT + YT out, in one ledger transaction.
export function useSplit(marketId: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (usycAmount: string) =>
      apiRequest<MarketCommand>('POST', `/markets/${encodeURIComponent(marketId)}/splits`, { usycAmount }),
    onSuccess: () => refreshHoldings(queryClient),
  })
}

// Redeem PT + YT (merge) before maturity: a request the Operator pays in seconds.
export function useMerge(marketId: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (amount: string) =>
      apiRequest<MarketCommand>('POST', `/markets/${encodeURIComponent(marketId)}/merges`, { amount }),
    onSuccess: () => refreshHoldings(queryClient),
  })
}

export function useClaimYield(marketId: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: () => apiRequest<MarketCommand>('POST', `/markets/${encodeURIComponent(marketId)}/claims`),
    onSuccess: () => refreshHoldings(queryClient),
  })
}

export function useRedeemPt(marketId: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: () => apiRequest<MarketCommand>('POST', `/markets/${encodeURIComponent(marketId)}/pt-redemptions`),
    onSuccess: () => refreshHoldings(queryClient),
  })
}

// ---------------------------------------------------------------------------
// Portfolio
// ---------------------------------------------------------------------------

// Polls fast while a payout request is open. When the list gets shorter, the
// Operator has paid (or the owner cancelled), so the wallet is reloaded at
// once too (a payout adds USYC there).
export function usePortfolio() {
  const queryClient = useQueryClient()
  return useQuery({
    queryKey: PORTFOLIO_KEY,
    queryFn: async () => {
      const before = queryClient.getQueryData<Portfolio>(PORTFOLIO_KEY)
      const after = await apiRequest<Portfolio>('GET', '/portfolio')
      if (before !== undefined && after.openRequests.length < before.openRequests.length) {
        void queryClient.invalidateQueries({ queryKey: WALLET_KEY })
      }
      return after
    },
    refetchInterval: (query) => ((query.state.data?.openRequests.length ?? 0) > 0 ? FAST_POLL_MS : PORTFOLIO_POLL_MS),
  })
}

export function useCancelMarketRequest() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (requestId: string) =>
      apiRequest<{ requestId: string; kind: MarketRequestKind }>('DELETE', `/portfolio/requests/${encodeURIComponent(requestId)}`),
    onSuccess: () => refreshHoldings(queryClient),
  })
}

// ---------------------------------------------------------------------------
// Private PT trading (RFQ)
// ---------------------------------------------------------------------------

// `watching`: true while a quote is expected, to poll every second.
export function useQuoteRequests(watching: boolean) {
  return useQuery({
    queryKey: QUOTE_REQUESTS_KEY,
    queryFn: () => apiRequest<{ items: QuoteRequestView[] }>('GET', '/quote-requests'),
    refetchInterval: watching ? FAST_POLL_MS : PORTFOLIO_POLL_MS,
  })
}

export function useQuotes(watching: boolean) {
  return useQuery({
    queryKey: QUOTES_KEY,
    queryFn: () => apiRequest<{ items: QuoteView[] }>('GET', '/quotes'),
    refetchInterval: watching ? FAST_POLL_MS : PORTFOLIO_POLL_MS,
  })
}

export type QuoteRequestInput = { marketId: string; side: RfqSide; ptAmount: string }

export function useRequestQuote() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (input: QuoteRequestInput) => apiRequest<QuoteRequestInput>('POST', '/quote-requests', input),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: QUOTE_REQUESTS_KEY })
      return queryClient.invalidateQueries({ queryKey: QUOTES_KEY })
    },
  })
}

// Atomic DvP: USDC and PT change hands in one ledger transaction.
export function useAcceptQuote() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (quoteId: string) =>
      apiRequest<{ quoteId: string; retried: boolean }>('POST', `/quotes/${encodeURIComponent(quoteId)}/acceptance`),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: QUOTES_KEY })
      return refreshHoldings(queryClient)
    },
  })
}

export function useRejectQuote() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (quoteId: string) =>
      apiRequest<{ quoteId: string }>('POST', `/quotes/${encodeURIComponent(quoteId)}/rejection`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: QUOTES_KEY }),
  })
}

// ---------------------------------------------------------------------------
// Dealer desk (admins run the house dealer, Bank)
// ---------------------------------------------------------------------------

export function useDealerRequests() {
  return useQuery({
    queryKey: [...DEALER_KEY, 'requests'],
    queryFn: () => apiRequest<{ items: DealerRequestView[] }>('GET', '/dealer/quote-requests'),
    refetchInterval: DEALER_POLL_MS,
  })
}

export function useDealerPosition() {
  return useQuery({
    queryKey: [...DEALER_KEY, 'position'],
    queryFn: () => apiRequest<DealerPosition>('GET', '/dealer/position'),
    refetchInterval: DEALER_POLL_MS,
  })
}

export function useDealerSettings() {
  return useQuery({
    queryKey: [...DEALER_KEY, 'settings'],
    queryFn: () => apiRequest<DealerSettings>('GET', '/dealer/settings'),
  })
}

export function useSaveDealerSettings() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (settings: DealerSettings) => apiRequest<DealerSettings>('PUT', '/dealer/settings', settings),
    onSuccess: () => {
      // The market cards show the dealer's prices, which come from these settings.
      void queryClient.invalidateQueries({ queryKey: MARKETS_KEY })
      return queryClient.invalidateQueries({ queryKey: DEALER_KEY })
    },
  })
}

export function useDealerQuote() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (input: { requestId: string; price: string }) =>
      apiRequest('POST', `/dealer/quote-requests/${encodeURIComponent(input.requestId)}/quotes`, { price: input.price }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: DEALER_KEY }),
  })
}

export function useDealerDecline() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (requestId: string) =>
      apiRequest('POST', `/dealer/quote-requests/${encodeURIComponent(requestId)}/declines`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: DEALER_KEY }),
  })
}

// Bank's own payouts: claim its YT yield, or redeem its PT after maturity.
export function useDealerPayout() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (input: { marketId: string; kind: 'claims' | 'pt-redemptions' }) =>
      apiRequest('POST', `/dealer/markets/${encodeURIComponent(input.marketId)}/${input.kind}`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: DEALER_KEY }),
  })
}
