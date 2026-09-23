import { useState, type FormEvent } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { nextOracleStep, RateFeed, type OracleStep } from '@exodus/ledger'
import { ledger, useRateFeed } from '../ledger.ts'
import { ErrorMessage } from './ErrorMessage.tsx'

type OracleControlsProps = {
  oracle: string
}

const STEP_DAYS = 7

// Manual controls for the Oracle party. They publish through the oracle's
// private RateFeed. Useful to move the demo clock by hand: run the bot with
// `npm run oracle:hold` (heartbeats only) and click "Next step" here.
//
// If the bot is ALSO advancing the clock, both write to the same RateFeed and
// one of them can get a stale-contract error. That is expected: there should
// be one writer at a time. Readers (Alice, Bank) are not affected.
export function OracleControls({ oracle }: OracleControlsProps) {
  const feed = useRateFeed(oracle)
  const [newIndex, setNewIndex] = useState('')
  const [newDate, setNewDate] = useState('') // "2027-01-01"
  const queryClient = useQueryClient()

  const publish = useMutation({
    mutationFn: (step: OracleStep) => {
      if (!feed.data) {
        throw new Error('No RateFeed to publish from. Run `npm run bootstrap`.')
      }
      return ledger.exercise(oracle, RateFeed.Publish, feed.data.contractId, step)
    },
    onSuccess: () => void queryClient.invalidateQueries(),
  })

  if (!feed.data) {
    return null
  }
  const current = feed.data.payload
  const next = nextOracleStep(current.index, current.simTime, STEP_DAYS)

  function handleSubmit(event: FormEvent) {
    event.preventDefault()
    publish.mutate({ newIndex, newSimTime: `${newDate}T00:00:00Z` })
  }

  return (
    <section className="card">
      <h2>Oracle controls</h2>
      <p>
        <button type="button" disabled={next === null || publish.isPending} onClick={() => next && publish.mutate(next)}>
          {next === null
            ? 'At maturity'
            : `Next step: ${next.newSimTime.slice(0, 10)}, index ${Number(next.newIndex).toFixed(6)}`}
        </button>
      </p>
      <form className="form" onSubmit={handleSubmit}>
        <label>
          New index
          <input
            inputMode="decimal"
            placeholder="1.025"
            value={newIndex}
            onChange={(event) => setNewIndex(event.target.value)}
            required
          />
        </label>
        <label>
          New demo date
          <input type="date" value={newDate} onChange={(event) => setNewDate(event.target.value)} required />
        </label>
        <button type="submit" disabled={publish.isPending}>
          Publish
        </button>
      </form>
      <p className="muted">Index and date can only go up. The contract rejects anything lower.</p>
      {publish.isError && <ErrorMessage error={publish.error} />}
    </section>
  )
}
