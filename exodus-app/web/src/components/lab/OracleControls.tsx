import { useState, type FormEvent } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { SkipForwardIcon } from 'lucide-react'
import { nextOracleStep, RateFeed, type OracleStep } from '@exodus/ledger'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Separator } from '@/components/ui/separator'
import { ErrorMessage } from '@/components/ErrorMessage'
import { ledger, useRateFeed } from '@/ledger'

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
    <Card>
      <CardHeader>
        <CardTitle>Oracle controls</CardTitle>
        <CardDescription>Index and date can only go up. The contract rejects anything lower.</CardDescription>
      </CardHeader>
      <CardContent className="grid gap-4">
        <Button
          variant="secondary"
          disabled={next === null || publish.isPending}
          onClick={() => next && publish.mutate(next)}
        >
          <SkipForwardIcon data-icon="inline-start" />
          {next === null
            ? 'At maturity'
            : `Next step: ${next.newSimTime.slice(0, 10)}, index ${Number(next.newIndex).toFixed(6)}`}
        </Button>

        <Separator />

        <form className="grid gap-3" onSubmit={handleSubmit}>
          <div className="grid gap-1.5">
            <Label htmlFor="oracle-index">New index</Label>
            <Input
              id="oracle-index"
              inputMode="decimal"
              placeholder="1.025"
              value={newIndex}
              onChange={(event) => setNewIndex(event.target.value)}
              required
            />
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="oracle-date">New demo date</Label>
            <Input
              id="oracle-date"
              type="date"
              value={newDate}
              onChange={(event) => setNewDate(event.target.value)}
              required
            />
          </div>
          <Button type="submit" disabled={publish.isPending}>
            Publish
          </Button>
        </form>
        {publish.isError && <ErrorMessage error={publish.error} />}
      </CardContent>
    </Card>
  )
}
