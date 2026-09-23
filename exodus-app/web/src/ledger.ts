// The ledger client for the browser, plus one React Query hook per thing the UI shows.
//
// The hooks poll every 2 seconds. This is the simplest way to see the oracle
// bot's changes appear live. (Later: stream /v2/updates over a WebSocket instead.)
import { useQuery } from '@tanstack/react-query'
import {
  createLedgerClient,
  findDemoParties,
  getOwnedHoldings,
  getRateFeed,
  getRateIndex,
  getVisibleContracts,
} from '@exodus/ledger'

// Same origin as the page: Vite forwards /v2/* to the sandbox (see vite.config.ts).
export const ledger = createLedgerClient({ baseUrl: window.location.origin })

const POLL_MS = 2000

export function useDemoParties() {
  return useQuery({
    queryKey: ['demoParties'],
    queryFn: () => findDemoParties(ledger),
    refetchInterval: 5000,
  })
}

export function useRateIndex(party: string) {
  return useQuery({
    queryKey: ['rateIndex', party],
    queryFn: () => getRateIndex(ledger, party),
    refetchInterval: POLL_MS,
  })
}

export function useOwnedHoldings(party: string) {
  return useQuery({
    queryKey: ['ownedHoldings', party],
    queryFn: () => getOwnedHoldings(ledger, party),
    refetchInterval: POLL_MS,
  })
}

export function useVisibleContracts(party: string) {
  return useQuery({
    queryKey: ['visibleContracts', party],
    queryFn: () => getVisibleContracts(ledger, party),
    refetchInterval: POLL_MS,
  })
}

// The oracle's private feed. Only works for the Oracle party.
export function useRateFeed(oracle: string) {
  return useQuery({
    queryKey: ['rateFeed', oracle],
    queryFn: () => getRateFeed(ledger, oracle),
    refetchInterval: POLL_MS,
  })
}
