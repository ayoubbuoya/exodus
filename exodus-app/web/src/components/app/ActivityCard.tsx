// The client's latest token movements, newest first, rebuilt by the API from
// the ledger history. Shows tokens other clients sent too.
// Example rows:
//   ↓ Received     +100 USDC                       2 min ago
//   ⇄ Subscribed   −40 USDC · +39.920159 USYC      1 min ago
//   ↑ Sent         −10 USYC                        just now
import type { ComponentType } from 'react'
import { ArrowDownLeftIcon, ArrowLeftRightIcon, ArrowUpRightIcon, CircleDotIcon } from 'lucide-react'
import { formatAmount } from '@exodus/ledger'
import { useActivity } from '@/api/hooks'
import type { ActivityRow } from '@/api/types'
import { FormError } from '@/components/FormError'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { formatSignedAmount } from '@/lib/format'

const KIND_LABEL: Record<ActivityRow['kind'], { label: string; Icon: ComponentType<{ className?: string }> }> = {
  RECEIVED: { label: 'Received', Icon: ArrowDownLeftIcon },
  SENT: { label: 'Sent', Icon: ArrowUpRightIcon },
  SUBSCRIBED: { label: 'Subscribed', Icon: ArrowLeftRightIcon },
  OTHER: { label: 'Changed', Icon: CircleDotIcon },
}

export function ActivityCard() {
  const activity = useActivity()

  return (
    <Card>
      <CardHeader>
        <CardTitle>Activity</CardTitle>
        <CardDescription>Read from the Canton ledger. Only you (and the token issuers) can see it.</CardDescription>
      </CardHeader>
      <CardContent>
        {activity.isPending && <Skeleton className="h-32 w-full" />}
        {activity.isError && <FormError error={activity.error} />}
        {activity.data !== undefined && activity.data.items.length === 0 && (
          <p className="py-6 text-center text-sm text-muted-foreground">
            Nothing yet. Claim test USDC from the faucet to get started.
          </p>
        )}
        {activity.data !== undefined && activity.data.items.length > 0 && (
          <ul className="flex flex-col divide-y">
            {activity.data.items.map((row) => (
              <ActivityItem key={row.updateId} row={row} />
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  )
}

function ActivityItem({ row }: { row: ActivityRow }) {
  const { label, Icon } = KIND_LABEL[row.kind]
  // USDC first, then USYC, so a subscription reads "−40 USDC · +39.92 USYC" (pay, then get).
  const changes = Object.entries(row.changes).sort(([a], [b]) => a.localeCompare(b))
  return (
    <li className="flex items-center gap-3 py-2.5">
      <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-muted">
        <Icon className="size-4 text-muted-foreground" />
      </span>
      <div className="flex min-w-0 flex-1 flex-col">
        <span className="text-sm font-medium">{label}</span>
        <span className="text-xs text-muted-foreground">{new Date(row.at).toLocaleString()}</span>
      </div>
      <div className="num text-right text-sm">
        {changes.map(([instrument, amount]) => (
          <div key={instrument}>{formatSignedAmount(amount, instrument, (value) => formatAmount(value))}</div>
        ))}
      </div>
    </li>
  )
}
