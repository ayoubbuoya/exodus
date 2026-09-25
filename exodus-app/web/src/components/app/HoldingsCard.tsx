// What the client owns: each token's balance and its value in USD, plus the
// party id to receive tokens.
// USD value: USYC x current price (1 USYC = $1.0125 at index 1.0125); USDC counts as $1.
import { formatAmount, formatUsd } from '@exodus/ledger'
import { useLatestPrice, useWallet } from '@/api/hooks'
import type { WalletOverview } from '@/api/types'
import { FormError } from '@/components/FormError'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { PartyId } from './PartyId.tsx'

// Always show both tokens, even at 0, in this order.
const TOKENS = [
  { instrument: 'USYC', description: 'Simulated T-bill fund share' },
  { instrument: 'USDC', description: 'Simulated cash' },
] as const

export function HoldingsCard() {
  const wallet = useWallet()
  const price = useLatestPrice()

  return (
    <Card>
      <CardHeader>
        <CardTitle>Holdings</CardTitle>
        <CardDescription>Your custodial Canton wallet.</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        {wallet.isPending && <Skeleton className="h-28 w-full" />}
        {wallet.isError && <FormError error={wallet.error} />}
        {wallet.data !== undefined && <Balances wallet={wallet.data} usycPrice={price.data?.index ?? null} />}
        {wallet.data !== undefined && (
          <div className="flex flex-col gap-1.5">
            <span className="text-xs text-muted-foreground">Your party id (share it to receive tokens)</span>
            <PartyId partyId={wallet.data.partyId} />
          </div>
        )}
      </CardContent>
    </Card>
  )
}

// Value in USD, for display. null when the USYC price is not loaded yet
// (show "—" rather than a wrong $0).
function usdValueOf(instrument: string, amount: string, usycPrice: string | null): number | null {
  if (instrument === 'USDC') {
    return Number(amount)
  }
  if (usycPrice === null) {
    return null
  }
  return Number(amount) * Number(usycPrice)
}

function Balances({ wallet, usycPrice }: { wallet: WalletOverview; usycPrice: string | null }) {
  const rows = TOKENS.map((token) => {
    const amount = wallet.balances[token.instrument] ?? '0'
    return { ...token, amount, usdValue: usdValueOf(token.instrument, amount, usycPrice) }
  })
  const total = rows.every((row) => row.usdValue !== null)
    ? rows.reduce((sum, row) => sum + (row.usdValue ?? 0), 0)
    : null

  return (
    <div className="flex flex-col divide-y">
      {rows.map((row) => (
        <div key={row.instrument} className="flex items-center justify-between py-2">
          <div>
            <div className="font-medium">{row.instrument}</div>
            <div className="text-xs text-muted-foreground">{row.description}</div>
          </div>
          <div className="text-right">
            <div className="num font-medium">{formatAmount(row.amount)}</div>
            <div className="num text-xs text-muted-foreground">{row.usdValue === null ? '—' : `$${formatUsd(row.usdValue)}`}</div>
          </div>
        </div>
      ))}
      <div className="flex items-center justify-between py-2 text-sm">
        <span className="text-muted-foreground">Total value</span>
        <span className="num font-semibold">{total === null ? '—' : `$${formatUsd(total)}`}</span>
      </div>
    </div>
  )
}
