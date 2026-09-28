// RFQs waiting for the house dealer. With auto-quote on, the bot answers
// them within about a second, so this list is usually empty; with auto-quote
// off (or for a size the bot declines), an admin quotes or declines here.
//
// The price box starts at the bot's suggestion (Pendle's formula from the
// dealer settings), for example 0.975503 for a buyer on Oct 1.
import { useState } from 'react'
import { formatAmount, partyName } from '@exodus/ledger'
import { toast } from 'sonner'
import { useDealerDecline, useDealerQuote, useDealerRequests } from '@/api/market-hooks'
import type { DealerRequestView } from '@/api/types'
import { FormError } from '@/components/FormError'
import { StatusChip } from '@/components/StatusChip'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Skeleton } from '@/components/ui/skeleton'
import { formatPercent } from '@/lib/format'

export function DealerRequestsCard() {
  const requests = useDealerRequests()
  const items = requests.data?.items ?? []

  return (
    <Card>
      <CardHeader>
        <CardTitle>Open requests</CardTitle>
        <CardDescription>Private RFQs sent to Bank. Nobody else, not even the Operator, sees them.</CardDescription>
      </CardHeader>
      <CardContent className="grid gap-3">
        {requests.isPending && <Skeleton className="h-20 w-full" />}
        {requests.isError && <FormError error={requests.error} />}
        {requests.data !== undefined && items.length === 0 && (
          <p className="rounded-2xl bg-foreground/3 px-4 py-6 text-center text-sm text-muted-foreground">
            No open request. With auto-quote on, the bot answers within seconds.
          </p>
        )}
        {items.map((request) => (
          <RequestRow key={request.requestId} request={request} />
        ))}
      </CardContent>
    </Card>
  )
}

function RequestRow({ request }: { request: DealerRequestView }) {
  const [price, setPrice] = useState(request.suggestedPrice ?? '')
  const quote = useDealerQuote()
  const decline = useDealerDecline()
  const busy = quote.isPending || decline.isPending
  // From the client's side: "BuyPt" means the client buys and Bank sells.
  const clientBuys = request.side === 'BuyPt'

  return (
    <div className="grid gap-3 rounded-2xl bg-foreground/4 p-4">
      <div className="flex flex-wrap items-center gap-2 text-sm">
        <StatusChip tone={clientBuys ? 'success' : 'info'}>{clientBuys ? 'Client buys' : 'Client sells'}</StatusChip>
        <span>
          <span className="font-medium">{partyName(request.requester)}</span> ·{' '}
          <span className="num font-medium">{formatAmount(request.ptAmount)} PT</span>
        </span>
        <span className="ident text-xs text-muted-foreground">{request.marketId}</span>
      </div>
      <p className="num text-xs text-muted-foreground">
        Bot's price: <span className="text-foreground">{request.suggestedPrice ?? '—'}</span> (
        {formatPercent(request.suggestedFixedApyPercent)} fixed)
      </p>
      <div className="flex flex-wrap items-center gap-2">
        <Input
          aria-label="Price in USDC per PT"
          className="num w-36"
          inputMode="decimal"
          value={price}
          onChange={(event) => setPrice(event.target.value.trim())}
        />
        <Button
          size="sm"
          variant="bright"
          disabled={busy || price === ''}
          onClick={() => quote.mutate({ requestId: request.requestId, price }, { onSuccess: () => toast.success('Quote sent.') })}
        >
          Quote
        </Button>
        <Button
          size="sm"
          variant="outline"
          disabled={busy}
          onClick={() => decline.mutate(request.requestId, { onSuccess: () => toast.success('Request declined.') })}
        >
          Decline
        </Button>
      </div>
      <FormError error={quote.error ?? decline.error} />
    </div>
  )
}
