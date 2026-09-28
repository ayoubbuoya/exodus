// Subscribe / Redeem, like the real fund's single action panel.
//
// Subscribe: pay USDC, get USYC at the current price, in one atomic ledger
// transaction. Example at price 1.0125: pay 500 USDC -> get 493.827160 USYC.
//
// Redeem: USYC back to USDC, in two steps (spec gap 13). Example: Alice
// redeems 100 USYC. Her USYC is burned at once and the request shows as
// "Pending". A few seconds later the fund pays her at the price of that
// moment: at 1.03 she gets 103 USDC. While it is pending she can cancel it.
import { useState, type FormEvent, type ReactNode } from 'react'
import { ArrowDownIcon, HourglassIcon, TriangleAlertIcon } from 'lucide-react'
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
import { AmountInput } from '@/components/finance/AmountInput'
import { FormError } from '@/components/FormError'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { FieldError } from '@/components/ui/field'
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
          <TabsContent value="redeem" className="grid gap-6">
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
    <form onSubmit={handleSubmit} className="grid gap-3">
      <AmountInput
        id="subscribe-amount"
        label="You pay"
        unit="USDC"
        value={usdcAmount}
        onChange={setUsdcAmount}
        balance={usdcBalance}
        onMax={() => setUsdcAmount(Number(usdcBalance) > 0 ? trimZeros(usdcBalance) : '')}
        invalid={amountError !== undefined}
      />
      {amountError !== undefined && <FieldError>{amountError}</FieldError>}
      <YouGet
        amount={preview === null ? null : `${formatAmount(preview)} USYC`}
        note={index === null ? 'USYC received = USDC paid ÷ USYC price' : `1 USYC = $${formatAmount(index, 4)}`}
      />
      <FormError error={subscribe.error} />
      {price.data !== undefined && !isPriceLive && <PausedNotice>Subscribing waits for a fresh price.</PausedNotice>}
      <Button
        type="submit"
        variant="bright"
        size="lg"
        disabled={!isPositiveAmount(usdcAmount) || !isPriceLive || subscribe.isPending}
      >
        {subscribe.isPending ? 'Subscribing…' : 'Subscribe'}
      </Button>
      <p className="text-xs leading-5 text-muted-foreground">
        One ledger transaction at the price when it runs, rounded down to 6 decimals.
      </p>
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
    <form onSubmit={handleSubmit} className="grid gap-3">
      <AmountInput
        id="redeem-amount"
        label="You redeem"
        unit="USYC"
        value={usycAmount}
        onChange={setUsycAmount}
        balance={usycBalance}
        onMax={() => setUsycAmount(Number(usycBalance) > 0 ? trimZeros(usycBalance) : '')}
        invalid={amountError !== undefined}
      />
      {amountError !== undefined && <FieldError>{amountError}</FieldError>}
      <YouGet
        amount={preview === null ? null : `${formatAmount(preview)} USDC`}
        note={index === null ? 'USDC received = USYC × USYC price' : `1 USYC = $${formatAmount(index, 4)}`}
      />
      <FormError error={redeem.error} />
      {price.data !== undefined && !isPriceLive && <PausedNotice>Your request will wait until it is back.</PausedNotice>}
      <Button type="submit" variant="bright" size="lg" disabled={!isUsycAmount(usycAmount) || redeem.isPending}>
        {redeem.isPending ? 'Requesting…' : 'Redeem'}
      </Button>
      <p className="text-xs leading-5 text-muted-foreground">
        Your USYC is burned now; the fund pays at its price a few seconds later, rounded down to 6 decimals.
      </p>
    </form>
  )
}

// "You get about 49.382716 USYC" under the amount box, with the price used.
function YouGet({ amount, note }: { amount: string | null; note: string }) {
  return (
    <div className="grid gap-1 px-1">
      <div className="flex items-center gap-2 text-sm">
        <ArrowDownIcon className="size-4 text-muted-foreground" aria-hidden />
        <span className="text-muted-foreground">You get about</span>
        <span className="num ml-auto font-medium">{amount ?? '—'}</span>
      </div>
      <p className="num pl-6 text-xs text-faint">{note}</p>
    </div>
  )
}

// The oracle bot is stopped, so the last price expired (30 s).
function PausedNotice({ children }: { children: ReactNode }) {
  return (
    <Alert variant="warning">
      <TriangleAlertIcon />
      <AlertDescription>The price feed is paused (the oracle bot is not running). {children}</AlertDescription>
    </Alert>
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
    <section aria-labelledby="pending-redeems" className="grid gap-2">
      <h3 id="pending-redeems" className="label-caps">
        Pending redeems
      </h3>
      <ul className="grid gap-2">
        {items.map((item) => (
          <li key={item.requestId} className="flex items-center gap-3 rounded-2xl bg-foreground/4 px-3 py-2.5">
            <span className="grid size-8 shrink-0 place-items-center rounded-full bg-info/15 text-info">
              <HourglassIcon className="size-4" aria-hidden />
            </span>
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
