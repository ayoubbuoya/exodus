import { useState, type FormEvent } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { decimalToUnits, divideRoundDown6, formatAmount, subscribeUsyc } from '@exodus/ledger'
import { ledger, useRateIndex } from '../ledger.ts'
import { ErrorMessage } from './ErrorMessage.tsx'

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
  const [lastResult, setLastResult] = useState<string | null>(null)
  const queryClient = useQueryClient()

  const subscribe = useMutation({
    mutationFn: (amount: string) => subscribeUsyc(ledger, { subscriber: party, usdcAmount: amount }),
    onSuccess: (outcome, amount) => {
      const retryNote = outcome.retried ? ' (the index changed while sending, so it retried once)' : ''
      setLastResult(`Subscribed ${amount} USDC${retryNote}.`)
      setUsdcAmount('')
      void queryClient.invalidateQueries()
    },
    onError: () => setLastResult(null),
  })

  function handleSubmit(event: FormEvent) {
    event.preventDefault()
    subscribe.mutate(usdcAmount)
  }

  const index = rate.data ? rate.data.payload.index : null
  const preview = index === null ? null : previewUsyc(usdcAmount, index)

  return (
    <section className="card">
      <h2>Get USYC (subscribe with USDC)</h2>
      <form className="form" onSubmit={handleSubmit}>
        <label>
          Pay (USDC)
          <input
            inputMode="decimal"
            placeholder="500"
            value={usdcAmount}
            onChange={(event) => setUsdcAmount(event.target.value)}
            required
          />
        </label>
        <p className="muted">
          {preview !== null && index !== null
            ? `You get about ${formatAmount(preview)} USYC at index ${formatAmount(index)}. The contract uses the index at the moment it runs.`
            : 'The fund pays USDC ÷ index in USYC, rounded down to 6 decimals.'}
        </p>
        <button type="submit" disabled={subscribe.isPending}>
          {subscribe.isPending ? 'Subscribing…' : 'Subscribe'}
        </button>
      </form>
      {lastResult !== null && <p className="ok">{lastResult}</p>}
      {subscribe.isError && <ErrorMessage error={subscribe.error} />}
    </section>
  )
}
