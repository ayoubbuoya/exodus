// The client's payout requests the Operator has not paid yet (claim, PT
// redeem, merge), each with a Cancel button. The Operator's bot usually pays
// within 2 seconds, so this list is mostly empty; it matters when the oracle
// is paused (no price to pay a claim or a redeem with).
//
// Example row: "Merge · 10 PT + 10 YT · about 10 USYC · waiting for the Operator"
import { formatAmount } from '@exodus/ledger'
import { toast } from 'sonner'
import { useCancelMarketRequest, usePortfolio } from '@/api/market-hooks'
import type { OpenMarketRequest } from '@/api/types'
import { FormError } from '@/components/FormError'
import { Button } from '@/components/ui/button'

const KIND_LABEL: Record<OpenMarketRequest['kind'], string> = {
  CLAIM: 'Yield claim',
  PT_REDEEM: 'PT redeem',
  MERGE: 'Redeem PT + YT (merge)',
}

// "10 PT + 10 YT" for a merge, "500 PT" for a redeem, "1,000 YT" for a claim.
function describeAmount(request: OpenMarketRequest): string {
  const amount = formatAmount(request.amount)
  if (request.kind === 'MERGE') {
    return `${amount} PT + ${amount} YT`
  }
  return `${amount} ${request.kind === 'CLAIM' ? 'YT' : 'PT'}`
}

// `marketId`: only this market's requests (market page); all of them when left out (portfolio).
export function OpenRequests({ marketId }: { marketId?: string }) {
  const portfolio = usePortfolio()
  const cancel = useCancelMarketRequest()
  const requests = (portfolio.data?.openRequests ?? []).filter(
    (request) => marketId === undefined || request.marketId === marketId,
  )
  if (requests.length === 0 && cancel.error === null) {
    return null
  }

  function handleCancel(request: OpenMarketRequest) {
    cancel.mutate(request.requestId, {
      onSuccess: () => toast.success(`${KIND_LABEL[request.kind]} cancelled. Your tokens are back.`),
    })
  }

  return (
    <section aria-labelledby="open-market-requests" className="flex flex-col gap-2">
      <h3 id="open-market-requests" className="text-sm font-medium">
        Waiting for the Operator
      </h3>
      <ul className="flex flex-col divide-y rounded-md border">
        {requests.map((request) => (
          <li key={request.requestId} className="flex items-center gap-3 px-3 py-2">
            <div className="flex min-w-0 flex-1 flex-col">
              <span className="text-sm">
                {KIND_LABEL[request.kind]} · <span className="num">{describeAmount(request)}</span>
              </span>
              <span className="text-xs text-muted-foreground">
                About <span className="num">{formatAmount(request.estimatedUsyc)} USYC</span> ·{' '}
                {new Date(request.requestedAt).toLocaleTimeString()}
              </span>
            </div>
            <Button type="button" variant="outline" size="sm" disabled={cancel.isPending} onClick={() => handleCancel(request)}>
              Cancel
            </Button>
          </li>
        ))}
      </ul>
      <FormError error={cancel.error} />
    </section>
  )
}
