// Subscribe / Redeem, like the real fund's single action panel.
//
// Subscribe: pay USDC, get USYC at the current price, in one atomic ledger
// transaction. Example at price 1.0125: pay 500 USDC -> get 493.827160 USYC.
//
// Redeem: USYC back to USDC, in two steps (spec gap 13). Example: Alice
// redeems 100 USYC. Her USYC is burned at once and the request shows as
// "Pending". A few seconds later the fund pays her at the price of that
// moment: at 1.03 she gets 103 USDC. While it is pending she can cancel it.
import { useState, type FormEvent } from 'react'
import { formatAmount } from '@exodus/ledger'
import { toast } from 'sonner'
import { fieldErrorOf } from '@/api/client'
import {
  useCancelRedeem,
  useLatestPrice,
  useOpenRedemptions,
  useRequestRedeem,
  useSubscribe,
  useWallet,
} from '@/api/hooks'
import { FormError } from '@/components/FormError'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Field, FieldDescription, FieldError, FieldGroup, FieldLabel } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { isPositiveAmount, isUsycAmount, previewUsdc, previewUsyc, trimZeros } from '@/lib/amount'

export function SubscribePanel() {
  return (
    <Card>
      <Tabs defaultValue="subscribe">
        <CardHeader>
          <CardTitle className="sr-only">Subscribe or redeem</CardTitle>
          <TabsList className="w-full">
            <TabsTrigger value="subscribe">Subscribe</TabsTrigger>
            <TabsTrigger value="redeem">Redeem</TabsTrigger>
          </TabsList>
        </CardHeader>
        <CardContent>
          <TabsContent value="subscribe">
            <SubscribeForm />
          </TabsContent>
          <TabsContent value="redeem" className="flex flex-col gap-6">
            <RedeemForm />
            <PendingRedemptions />
          </TabsContent>
        </CardContent>
      </Tabs>
    </Card>
  )
}

function SubscribeForm() {
  const [usdcAmount, setUsdcAmount] = useState('')
  const price = useLatestPrice()
  const wallet = useWallet()
  const subscribe = useSubscribe()

  const usdcBalance = wallet.data?.balances.USDC ?? '0'
  const index = price.data?.index ?? null
  const preview = index === null ? null : previewUsyc(usdcAmount, index)
  // The fund refuses expired prices, so do not even try while the feed is paused.
  const isPriceLive = price.data?.isLive === true
  const amountError = fieldErrorOf(subscribe.error, 'usdcAmount')

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    subscribe.mutate(usdcAmount, {
      onSuccess: () => {
        toast.success(`Subscribed ${formatAmount(usdcAmount)} USDC to USYC.`)
        setUsdcAmount('')
      },
    })
  }

  return (
    <form onSubmit={handleSubmit}>
      <FieldGroup>
        <Field data-invalid={amountError !== undefined}>
          <div className="flex items-center justify-between">
            <FieldLabel htmlFor="subscribe-amount">You pay (USDC)</FieldLabel>
            <button
              type="button"
              className="text-xs text-primary hover:underline"
              onClick={() => setUsdcAmount(Number(usdcBalance) > 0 ? trimZeros(usdcBalance) : '')}
            >
              Max: <span className="num">{formatAmount(usdcBalance)}</span>
            </button>
          </div>
          <Input
            id="subscribe-amount"
            className="num text-lg"
            inputMode="decimal"
            placeholder="0.00"
            autoComplete="off"
            value={usdcAmount}
            onChange={(event) => setUsdcAmount(event.target.value.trim())}
            aria-invalid={amountError !== undefined}
          />
          <FieldDescription>
            {preview !== null && index !== null ? (
              <>
                You get about <span className="num text-foreground">{formatAmount(preview)} USYC</span> at{' '}
                <span className="num">${formatAmount(index, 4)}</span>. The exact amount uses the price when the
                ledger runs your order, rounded down to 6 decimals.
              </>
            ) : (
              'USYC received = USDC paid ÷ USYC price.'
            )}
          </FieldDescription>
          {amountError !== undefined && <FieldError>{amountError}</FieldError>}
        </Field>

        <FormError error={subscribe.error} />
        {price.data !== undefined && !isPriceLive && (
          <p className="text-sm text-warning">The price feed is paused (the oracle bot is not running). Try again soon.</p>
        )}

        <Button type="submit" size="lg" disabled={!isPositiveAmount(usdcAmount) || !isPriceLive || subscribe.isPending}>
          {subscribe.isPending ? 'Subscribing…' : 'Subscribe'}
        </Button>
      </FieldGroup>
    </form>
  )
}

// Redeem: burn USYC now, get USDC when the fund settles (a few seconds).
function RedeemForm() {
  const [usycAmount, setUsycAmount] = useState('')
  const price = useLatestPrice()
  const wallet = useWallet()
  const redeem = useRequestRedeem()

  const usycBalance = wallet.data?.balances.USYC ?? '0'
  const index = price.data?.index ?? null
  const preview = index === null ? null : previewUsdc(usycAmount, index)
  // The request itself needs no price, but the fund cannot settle without one.
  // We still allow the request: it simply waits until the oracle is back.
  const isPriceLive = price.data?.isLive === true
  const amountError = fieldErrorOf(redeem.error, 'usycAmount')

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    redeem.mutate(usycAmount, {
      onSuccess: () => {
        toast.success(`Redeem of ${formatAmount(usycAmount)} USYC requested. The USDC arrives in a few seconds.`)
        setUsycAmount('')
      },
    })
  }

  return (
    <form onSubmit={handleSubmit}>
      <FieldGroup>
        <Field data-invalid={amountError !== undefined}>
          <div className="flex items-center justify-between">
            <FieldLabel htmlFor="redeem-amount">You redeem (USYC)</FieldLabel>
            <button
              type="button"
              className="text-xs text-primary hover:underline"
              onClick={() => setUsycAmount(Number(usycBalance) > 0 ? trimZeros(usycBalance) : '')}
            >
              Max: <span className="num">{formatAmount(usycBalance)}</span>
            </button>
          </div>
          <Input
            id="redeem-amount"
            className="num text-lg"
            inputMode="decimal"
            placeholder="0.00"
            autoComplete="off"
            value={usycAmount}
            onChange={(event) => setUsycAmount(event.target.value.trim())}
            aria-invalid={amountError !== undefined}
          />
          <FieldDescription>
            {preview !== null && index !== null ? (
              <>
                You get about <span className="num text-foreground">{formatAmount(preview)} USDC</span> at{' '}
                <span className="num">${formatAmount(index, 4)}</span>. Your USYC is burned now; the fund pays at the
                price when it settles your request (a few seconds later), rounded down to 6 decimals.
              </>
            ) : (
              'USDC received = USYC redeemed × USYC price. At most 6 decimals.'
            )}
          </FieldDescription>
          {amountError !== undefined && <FieldError>{amountError}</FieldError>}
        </Field>

        <FormError error={redeem.error} />
        {price.data !== undefined && !isPriceLive && (
          <p className="text-sm text-warning">
            The price feed is paused (the oracle bot is not running). Your request will wait until it is back.
          </p>
        )}

        <Button type="submit" size="lg" disabled={!isUsycAmount(usycAmount) || redeem.isPending}>
          {redeem.isPending ? 'Requesting…' : 'Redeem'}
        </Button>
      </FieldGroup>
    </form>
  )
}

// The client's redeem requests the fund has not paid yet, each with a Cancel
// button. Hidden when there are none (the usual case: the fund pays in seconds).
function PendingRedemptions() {
  const redemptions = useOpenRedemptions()
  const cancel = useCancelRedeem()
  const items = redemptions.data?.items ?? []
  if (items.length === 0 && cancel.error === null) {
    return null
  }

  function handleCancel(requestId: string, usycAmount: string) {
    cancel.mutate(requestId, {
      onSuccess: () => toast.success(`Redeem cancelled. ${formatAmount(usycAmount)} USYC is back in your wallet.`),
    })
  }

  return (
    <section aria-labelledby="pending-redeems" className="flex flex-col gap-2">
      <h3 id="pending-redeems" className="text-sm font-medium">
        Pending redeems
      </h3>
      <ul className="flex flex-col divide-y rounded-md border">
        {items.map((item) => (
          <li key={item.requestId} className="flex items-center gap-3 px-3 py-2">
            <div className="flex min-w-0 flex-1 flex-col">
              <span className="num text-sm">{formatAmount(item.usycAmount)} USYC</span>
              <span className="text-xs text-muted-foreground">
                Waiting for the fund · {new Date(item.requestedAt).toLocaleTimeString()}
              </span>
            </div>
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={cancel.isPending}
              onClick={() => handleCancel(item.requestId, item.usycAmount)}
            >
              Cancel
            </Button>
          </li>
        ))}
      </ul>
      <FormError error={cancel.error} />
    </section>
  )
}
