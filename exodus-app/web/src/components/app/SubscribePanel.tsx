// Subscribe / Redeem, like the real fund's single action panel.
//
// Subscribe: pay USDC, get USYC at the current price, in one atomic ledger
// transaction. Example at price 1.0125: pay 500 USDC -> get 493.827160 USYC.
// Redeem (USYC back to USDC) is not built yet: spec gap 13 in docs/exodus.md.
import { useState, type FormEvent } from 'react'
import { formatAmount } from '@exodus/ledger'
import { toast } from 'sonner'
import { fieldErrorOf } from '@/api/client'
import { useLatestPrice, useSubscribe, useWallet } from '@/api/hooks'
import { FormError } from '@/components/FormError'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Field, FieldDescription, FieldError, FieldGroup, FieldLabel } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { isPositiveAmount, previewUsyc, trimZeros } from '@/lib/amount'

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
          <TabsContent value="redeem">
            <p className="text-sm text-muted-foreground">
              Redeeming USYC for USDC is not available yet. The fund contract has no redeem step so far (known gap 13
              in the design spec). You can still send USYC to another approved client.
            </p>
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
