import { useActivity, useWallet } from '@/api/hooks'

// True while the wallet is "new": no USYC, and nothing in the history but
// incoming tokens (the faucet shows as "Received"). The Wallet page then shows
// the "Get started" checklist instead of the faucet card. Once Carol
// subscribes, splits or trades, the checklist is gone for good.
// null while the wallet or the history is still loading (show neither yet).
export function useIsNewWallet(): boolean | null {
  const wallet = useWallet()
  const activity = useActivity()
  if (wallet.data === undefined || activity.data === undefined) {
    return null
  }
  const hasUsyc = Number(wallet.data.balances.USYC ?? '0') > 0
  const onlyReceived = activity.data.items.every((row) => row.kind === 'RECEIVED')
  return !hasUsyc && onlyReceived
}
