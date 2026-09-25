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
      <CardContent className="flex flex-col gap-3">
        {requests.isPending && <Skeleton className="h-20 w-full" />}
        {requests.isError && <FormError error={requests.error} />}
        {requests.data !== undefined && items.length === 0 && (
          <p className="text-sm text-muted-foreground">No open request. With auto-quote on, the bot answers within seconds.</p>
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
  const what = request.side === 'BuyPt' ? 'wants to buy' : 'wants to sell'

  return (
    <div className="flex flex-col gap-2 rounded-md border p-3">
      <p className="text-sm">
        <span className="font-medium">{partyName(request.requester)}</span> {what}{' '}
        <span className="num">{formatAmount(request.ptAmount)} PT</span> of {request.marketId}
      </p>
      <p className="text-xs text-muted-foreground">
        Bot's price: <span className="num">{request.suggestedPrice ?? '—'}</span> (
        {formatPercent(request.suggestedFixedApyPercent)} fixed)
      </p>
      <div className="flex flex-wrap items-center gap-2">
        <Input
          aria-label="Price in USDC per PT"
          className="num w-32"
          inputMode="decimal"
          value={price}
          onChange={(event) => setPrice(event.target.value.trim())}
        />
        <Button
          size="sm"
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
