// The client's latest token movements, newest first, rebuilt by the API from
// the ledger history. Shows tokens other clients sent too.
// Example rows:
//   ↓ Received     +100 USDC                       2 min ago
//   ⇄ Subscribed   −40 USDC · +39.920159 USYC      1 min ago
//   ↑ Sent         −10 USYC                        just now
//   ⌛ Redeem requested  −100 USYC   then   ⇄ Redeemed  +103 USDC
//
// Two uses (decision 3A, Phase 7):
//   scope "wallet"  (/app)       every row, so the USYC balance is always
//                                explained; market rows get a "Markets" tag
//   scope "markets" (/portfolio) only the rows that moved PT or YT, or claimed yield
import type { ComponentType } from 'react'
import {
  ArrowDownLeftIcon,
  ArrowLeftRightIcon,
  ArrowUpRightIcon,
  BadgeCheckIcon,
  CircleDotIcon,
  CoinsIcon,
  HourglassIcon,
  MergeIcon,
  SplitIcon,
  Undo2Icon,
} from 'lucide-react'
import { formatAmount } from '@exodus/ledger'
import { useActivity } from '@/api/hooks'
import type { ActivityKind, ActivityRow } from '@/api/types'
import { FormError } from '@/components/FormError'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { formatSignedAmount } from '@/lib/format'
import { isMarketActivity } from '@/lib/markets'

const KIND_LABEL: Record<ActivityKind, { label: string; Icon: ComponentType<{ className?: string }> }> = {
  RECEIVED: { label: 'Received', Icon: ArrowDownLeftIcon },
  SENT: { label: 'Sent', Icon: ArrowUpRightIcon },
  SUBSCRIBED: { label: 'Subscribed', Icon: ArrowLeftRightIcon },
  // A redeem is two ledger transactions: the USYC is burned, then the fund pays USDC.
  REDEEM_REQUESTED: { label: 'Redeem requested', Icon: HourglassIcon },
  REDEEMED: { label: 'Redeemed', Icon: ArrowLeftRightIcon },
  REDEEM_CANCELLED: { label: 'Redeem cancelled', Icon: Undo2Icon },
  // Markets (Pendle's words). Payouts show once the Operator has paid them.
  SPLIT: { label: 'Minted PT + YT', Icon: SplitIcon },
  BOUGHT_PT: { label: 'Bought PT', Icon: ArrowDownLeftIcon },
  SOLD_PT: { label: 'Sold PT', Icon: ArrowUpRightIcon },
  CLAIMED: { label: 'Claimed yield', Icon: CoinsIcon },
  REDEEMED_PT: { label: 'Redeemed PT', Icon: BadgeCheckIcon },
  MERGED: { label: 'Redeemed PT + YT', Icon: MergeIcon },
  OTHER: { label: 'Changed', Icon: CircleDotIcon },
}

// Rows shown; the Portfolio reads more, because it keeps only the market rows.
const WALLET_ROWS = 10
const MARKET_SCAN_ROWS = 50

type ActivityCardProps = {
  scope?: 'wallet' | 'markets'
}

export function ActivityCard({ scope = 'wallet' }: ActivityCardProps) {
  const activity = useActivity(scope === 'wallet' ? WALLET_ROWS : MARKET_SCAN_ROWS)
  const rows = (activity.data?.items ?? []).filter((row) => scope === 'wallet' || isMarketActivity(row))

  return (
    <Card>
      <CardHeader>
        <CardTitle>{scope === 'wallet' ? 'Activity' : 'Market activity'}</CardTitle>
        <CardDescription>Read from the Canton ledger. Only you (and the token issuers) can see it.</CardDescription>
      </CardHeader>
      <CardContent>
        {activity.isPending && <Skeleton className="h-32 w-full" />}
        {activity.isError && <FormError error={activity.error} />}
        {activity.data !== undefined && rows.length === 0 && (
          <p className="py-6 text-center text-sm text-muted-foreground">
            {scope === 'wallet'
              ? 'Nothing yet. Claim test USDC from the faucet to get started.'
              : 'No market activity yet. Mint PT + YT or buy PT in a market.'}
          </p>
        )}
        {rows.length > 0 && (
          <ul className="flex flex-col divide-y">
            {rows.map((row) => (
              <ActivityItem key={row.updateId} row={row} tagMarkets={scope === 'wallet'} />
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  )
}

// Pay first, then get: USDC, USYC, then PT and YT.
// A split reads "−30 USYC · +30 PT · +30 YT".
function symbolRank(symbol: string): number {
  if (symbol === 'USDC') return 0
  if (symbol === 'USYC') return 1
  if (symbol.startsWith('PT-')) return 2
  return 3
}

// "PT-USYC-APR2027" is long for a phone: show "PT" and keep the full name as a tooltip.
function shortSymbol(symbol: string): string {
  return symbol.startsWith('PT-') || symbol.startsWith('YT-') ? symbol.slice(0, 2) : symbol
}

function ActivityItem({ row, tagMarkets }: { row: ActivityRow; tagMarkets: boolean }) {
  const { label, Icon } = KIND_LABEL[row.kind]
  const changes = Object.entries(row.changes).sort(([a], [b]) => symbolRank(a) - symbolRank(b))
  return (
    <li className="flex items-center gap-3 py-2.5">
      <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-muted">
        <Icon className="size-4 text-muted-foreground" />
      </span>
      <div className="flex min-w-0 flex-1 flex-col">
        <span className="flex items-center gap-2 text-sm font-medium">
          {label}
          {tagMarkets && isMarketActivity(row) && <Badge variant="outline">Markets</Badge>}
        </span>
        <span className="text-xs text-muted-foreground">{new Date(row.at).toLocaleString()}</span>
      </div>
      <div className="num text-right text-sm">
        {changes.map(([symbol, amount]) => (
          <div key={symbol} title={symbol}>
            {formatSignedAmount(amount, shortSymbol(symbol), (value) => formatAmount(value))}
          </div>
        ))}
      </div>
    </li>
  )
}
