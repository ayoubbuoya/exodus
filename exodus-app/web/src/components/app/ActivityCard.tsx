// The client's latest token movements, newest first, rebuilt by the API from
// the ledger history. Shows tokens other clients sent too.
// Example rows:
//   ↓ Received     +100 USDC                       Sep 25, 14:02
//   ⇄ Subscribed   −40 USDC · +39.920159 USYC      Sep 25, 14:03
//   ↑ Sent         −10 USYC                        Sep 25, 14:05
//   ⌛ Redeem requested  −100 USYC   then   ⇄ Redeemed  +103 USDC
//
// Two uses (decision W3, Phase 7):
//   scope "wallet"  (/app)       every row, so the USYC balance is always
//                                explained; market rows get a "Markets" tag
//   scope "markets" (/portfolio) only the rows that moved PT or YT, or claimed yield
//
// Colours: what came in is bright, what went out is dimmed; yield that was
// claimed is the yield blue (it is yield).
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
import { cn } from 'cn'
import { formatAmount } from '@exodus/ledger'
import { useActivity } from '@/api/hooks'
import type { ActivityKind, ActivityRow } from '@/api/types'
import { FormError } from '@/components/FormError'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { formatSignedAmount } from '@/lib/format'
import { isMarketActivity } from '@/lib/markets'
import { shortSymbol } from '@/lib/tokens'

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
          <p className="rounded-2xl bg-foreground/3 px-6 py-8 text-center text-sm text-muted-foreground">
            {scope === 'wallet'
              ? 'Nothing yet. Claim test USDC from the faucet to get started.'
              : 'No market activity yet. Mint PT + YT or buy PT in a market.'}
          </p>
        )}
        {rows.length > 0 && (
          <ul className="-mx-2 grid">
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

// "Sep 25, 14:02": the real time of the ledger transaction (not the demo date).
function formatWhen(iso: string): string {
  return new Date(iso).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit', hour12: false })
}

function ActivityItem({ row, tagMarkets }: { row: ActivityRow; tagMarkets: boolean }) {
  const { label, Icon } = KIND_LABEL[row.kind]
  const changes = Object.entries(row.changes).sort(([a], [b]) => symbolRank(a) - symbolRank(b))
  return (
    <li className="flex items-center gap-3 rounded-2xl px-2 py-2.5 transition-colors hover:bg-foreground/3">
      <span
        className={cn(
          'grid size-9 shrink-0 place-items-center rounded-full bg-foreground/8',
          row.kind === 'CLAIMED' && 'bg-yt-tint text-yt',
          row.kind === 'REDEEM_REQUESTED' && 'bg-info/15 text-info',
        )}
      >
        <Icon className="size-4" />
      </span>
      <div className="flex min-w-0 flex-1 flex-col">
        <span className="flex items-center gap-2 text-sm font-medium">
          {label}
          {tagMarkets && isMarketActivity(row) && (
            <span className="rounded-full bg-foreground/8 px-2 py-0.5 text-[10px] font-medium text-muted-foreground">Markets</span>
          )}
        </span>
        <span className="num text-xs text-muted-foreground">{formatWhen(row.at)}</span>
      </div>
      <div className="num grid text-right text-sm">
        {changes.map(([symbol, amount]) => (
          <span
            key={symbol}
            title={symbol}
            className={cn(
              amount.startsWith('-') ? 'text-muted-foreground' : 'text-foreground',
              row.kind === 'CLAIMED' && !amount.startsWith('-') && 'text-yt',
            )}
          >
            {formatSignedAmount(amount, shortSymbol(symbol), (value) => formatAmount(value))}
          </span>
        ))}
      </div>
    </li>
  )
}
