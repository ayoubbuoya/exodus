import { DEMO_MATURITY, daysToMaturity, formatAmount, isRateValid, type RateIndex } from '@exodus/ledger'
import { useRateIndex } from '../ledger.ts'
import { useNow } from '../useNow.ts'
import { ErrorMessage } from './ErrorMessage.tsx'

type OracleCardProps = {
  party: string
  partyName: string
}

// The simulated USYC price and the demo clock, as seen by `party`.
export function OracleCard({ party, partyName }: OracleCardProps) {
  const rate = useRateIndex(party)

  return (
    <section className="card">
      <h2>USYC index (oracle)</h2>
      {rate.isPending && <p className="muted">Loading…</p>}
      {rate.isError && <ErrorMessage error={rate.error} />}
      {rate.isSuccess && rate.data === null && (
        <p className="muted">
          {partyName} cannot see the RateIndex. Only the Oracle, the Operator and the readers (Alice, Bank) can.
        </p>
      )}
      {rate.isSuccess && rate.data !== null && (
        <dl className="facts">
          <dt>1 USYC</dt>
          <dd className="big">{formatAmount(rate.data.payload.index, 6)} USD</dd>
          <dt>Demo date</dt>
          <dd>{rate.data.payload.simTime.slice(0, 10)}</dd>
          <dt>Maturity</dt>
          <dd>
            {DEMO_MATURITY.slice(0, 10)} ({daysToMaturity(rate.data.payload.simTime)} days left)
          </dd>
          <dt>Price snapshot</dt>
          <dd>
            <SnapshotStatus rate={rate.data.payload} />
          </dd>
        </dl>
      )}
    </section>
  )
}

// "valid for 23 more seconds", or a warning when the newest snapshot has expired.
function SnapshotStatus({ rate }: { rate: RateIndex }) {
  const now = useNow()
  if (!isRateValid(rate, 0, now)) {
    return <span className="warn">expired: start `npm run oracle` or `npm run oracle:hold`</span>
  }
  const secondsLeft = Math.floor((Date.parse(rate.validUntil) - now) / 1000)
  return <span>valid for {secondsLeft} more seconds</span>
}
