import { useState, type FormEvent } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { nextOracleStep, RateIndex, type OracleStep } from '@exodus/ledger'
import { ledger, useRateIndex } from '../ledger.ts'
import { ErrorMessage } from './ErrorMessage.tsx'

type OracleControlsProps = {
  oracle: string
}

const STEP_DAYS = 7

// Manual controls for the Oracle party. Useful to:
// - move the demo by hand when the bot is not running,
// - trigger the stale-RateIndex race on purpose: run the bot with a short tick
//   and click "Publish" here. The contract id we hold may be archived already.
export function OracleControls({ oracle }: OracleControlsProps) {
  const rate = useRateIndex(oracle)
  const [newIndex, setNewIndex] = useState('')
  const [newDate, setNewDate] = useState('') // "2027-01-01"
  const queryClient = useQueryClient()

  const publish = useMutation({
    mutationFn: (step: OracleStep) => {
      if (!rate.data) {
        throw new Error('No RateIndex to publish from')
      }
      // Uses the contract id from the last poll (up to 2 seconds old) on purpose.
      return ledger.exercise(oracle, RateIndex.Publish, rate.data.contractId, step)
    },
    onSuccess: () => void queryClient.invalidateQueries(),
  })

  if (!rate.data) {
    return null
  }
  const current = rate.data.payload
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
