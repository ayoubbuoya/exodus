import { useState, type FormEvent } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { decimalToUnits, divideRoundDown6, formatAmount, subscribeUsyc } from '@exodus/ledger'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { ErrorMessage } from '@/components/ErrorMessage'
import { ledger, useRateIndex } from '@/ledger'

type SubscribeCardProps = {
  party: string
}

// A preview of how much USYC `usdcAmount` buys at `index`, or null if the
// input is not a valid positive amount yet (for example while typing "5.").
function previewUsyc(usdcAmount: string, index: string): string | null {
  try {
    if (decimalToUnits(usdcAmount) === 0n) {
      return null
    }
    return divideRoundDown6(usdcAmount, index)
  } catch {
    return null
  }
}

// Pay USDC to the simulated USYC fund and get USYC back, in one atomic step.
// Example at index 1.025: pay 500 USDC, get 487.804878 USYC.
export function SubscribeCard({ party }: SubscribeCardProps) {
  const rate = useRateIndex(party)
  const [usdcAmount, setUsdcAmount] = useState('')
  const queryClient = useQueryClient()

  const subscribe = useMutation({
    mutationFn: (amount: string) => subscribeUsyc(ledger, { subscriber: party, usdcAmount: amount }),
    onSuccess: (outcome, amount) => {
      const retryNote = outcome.retried ? ' The index changed while sending, so it retried once.' : ''
      toast.success(`Subscribed ${amount} USDC.${retryNote}`)
      setUsdcAmount('')
      void queryClient.invalidateQueries()
    },
  })

  function handleSubmit(event: FormEvent) {
    event.preventDefault()
    subscribe.mutate(usdcAmount)
  }

  const index = rate.data ? rate.data.payload.index : null
  const preview = index === null ? null : previewUsyc(usdcAmount, index)

  return (
    <Card>
      <CardHeader>
        <CardTitle>Get USYC</CardTitle>
        <CardDescription>Subscribe with USDC. Payment and minting happen in one atomic transaction.</CardDescription>
      </CardHeader>
      <CardContent>
        <form className="grid gap-3" onSubmit={handleSubmit}>
          <div className="grid gap-1.5">
            <Label htmlFor="subscribe-amount">Pay (USDC)</Label>
            <Input
              id="subscribe-amount"
              className="num"
              inputMode="decimal"
              placeholder="500"
              value={usdcAmount}
              onChange={(event) => setUsdcAmount(event.target.value)}
              required
            />
          </div>
          <p className="text-sm text-muted-foreground">
            {preview !== null && index !== null ? (
              <>
                You get about <span className="num text-foreground">{formatAmount(preview)} USYC</span> at index{' '}
                <span className="num">{formatAmount(index)}</span>. The contract uses the index at the moment it runs.
              </>
            ) : (
              'The fund pays USDC ÷ index in USYC, rounded down to 6 decimals.'
            )}
          </p>
          <Button type="submit" disabled={subscribe.isPending}>
            {subscribe.isPending ? 'Subscribing…' : 'Subscribe'}
          </Button>
        </form>
        {subscribe.isError && <ErrorMessage error={subscribe.error} />}
      </CardContent>
    </Card>
  )
}
