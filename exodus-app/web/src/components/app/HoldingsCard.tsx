// What the client owns in the fund wallet: one row per token with its balance,
// its value in USD and a Send button, plus the party id to receive tokens.
// USD value: USYC x current price (1 USYC = $1.0125 at index 1.0125); USDC counts as $1.
// PT and YT are market tokens: they live on the Portfolio page.
import { useState } from 'react'
import { Link } from 'react-router'
import { ArrowRightIcon, SendIcon } from 'lucide-react'
import { formatAmount, formatUsd } from '@exodus/ledger'
import { useLatestPrice, useWallet } from '@/api/hooks'
import type { Instrument } from '@/api/types'
import { TokenIcon } from '@/components/finance/TokenIcon'
import { FormError } from '@/components/FormError'
import { Button } from '@/components/ui/button'
import { Card, CardAction, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { PartyId } from './PartyId.tsx'
import { SendDialog } from './SendDialog.tsx'

// Always show both tokens, even at 0, in this order.
const TOKENS: { instrument: Instrument; kind: 'usyc' | 'usdc'; description: string }[] = [
  { instrument: 'USYC', kind: 'usyc', description: 'Simulated T-bill fund share' },
  { instrument: 'USDC', kind: 'usdc', description: 'Simulated cash' },
]

export function HoldingsCard() {
  const wallet = useWallet()
  const price = useLatestPrice()
  // Which token the Send dialog is open for (null = closed).
  const [sending, setSending] = useState<Instrument | null>(null)
  const usycPrice = price.data?.index ?? null

  return (
    <Card>
      <CardHeader>
        <CardTitle>Holdings</CardTitle>
        <CardDescription>Your custodial Canton wallet.</CardDescription>
        <CardAction>
          <Button asChild variant="ghost" size="sm" className="text-muted-foreground">
            <Link to="/portfolio">
              PT and YT
              <ArrowRightIcon data-icon="inline-end" />
            </Link>
          </Button>
        </CardAction>
      </CardHeader>
      <CardContent className="grid gap-5">
        {wallet.isPending && <Skeleton className="h-28 w-full" />}
        {wallet.isError && <FormError error={wallet.error} />}
        {wallet.data !== undefined && (
          <ul className="grid">
            {TOKENS.map((token) => {
              const amount = wallet.data.balances[token.instrument] ?? '0'
              const usd = usdValueOf(token.instrument, amount, usycPrice)
              return (
                <li key={token.instrument} className="flex items-center gap-3 border-t border-foreground/6 py-3 first:border-t-0">
                  <TokenIcon kind={token.kind} />
                  <div className="grid min-w-0 flex-1">
                    <span className="font-medium">{token.instrument}</span>
                    <span className="truncate text-xs text-muted-foreground">{token.description}</span>
                  </div>
                  <div className="num grid text-right">
                    <span className="font-medium">{formatAmount(amount)}</span>
                    <span className="text-xs text-muted-foreground">{usd === null ? '—' : `$${formatUsd(usd)}`}</span>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={Number(amount) <= 0}
                    onClick={() => setSending(token.instrument)}
                    aria-label={`Send ${token.instrument}`}
                  >
                    <SendIcon data-icon="inline-start" />
                    <span className="max-sm:sr-only">Send</span>
                  </Button>
                </li>
              )
            })}
          </ul>
        )}
        {wallet.data !== undefined && (
          <div className="grid gap-2">
            <span className="text-xs text-muted-foreground">Your party id (share it to receive tokens)</span>
            <PartyId partyId={wallet.data.partyId} />
          </div>
        )}
      </CardContent>
      <SendDialog instrument={sending} onClose={() => setSending(null)} />
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
