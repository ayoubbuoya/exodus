import { DEMO_MATURITY, daysToMaturity, formatAmount, isRateValid, type RateIndex } from '@exodus/ledger'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { ErrorMessage } from '@/components/ErrorMessage'
import { useRateIndex } from '@/ledger'
import { useNow } from '@/useNow'

type OracleCardProps = {
  party: string
  partyName: string
}

// The simulated USYC price and the demo clock, as seen by `party`.
export function OracleCard({ party, partyName }: OracleCardProps) {
  const rate = useRateIndex(party)

  return (
    <Card>
      <CardHeader>
        <CardTitle>USYC index (oracle)</CardTitle>
      </CardHeader>
      <CardContent>
        {rate.isPending && <Skeleton className="h-24" />}
        {rate.isError && <ErrorMessage error={rate.error} />}
        {rate.isSuccess && rate.data === null && (
          <p className="text-muted-foreground">
            {partyName} cannot see the price snapshot. Only the Oracle, the Operator and the fund (UsycIssuer) can.
            Clients never hold it: the app attaches it to their subscribe command (explicit disclosure), so no client
            learns who else is a client.
          </p>
        )}
        {rate.isSuccess && rate.data !== null && (
          <dl className="grid grid-cols-[auto_1fr] gap-x-6 gap-y-2">
            <dt className="text-muted-foreground">1 USYC</dt>
            <dd className="num text-xl font-semibold">{formatAmount(rate.data.payload.index, 6)} USD</dd>
            <dt className="text-muted-foreground">Demo date</dt>
            <dd className="num">{rate.data.payload.simTime.slice(0, 10)}</dd>
            <dt className="text-muted-foreground">Maturity</dt>
            <dd>
              <span className="num">{DEMO_MATURITY.slice(0, 10)}</span> (
              {daysToMaturity(rate.data.payload.simTime)} days left)
            </dd>
            <dt className="text-muted-foreground">Price snapshot</dt>
            <dd>
              <SnapshotStatus rate={rate.data.payload} />
            </dd>
          </dl>
        )}
      </CardContent>
    </Card>
  )
}

// "valid for 23 s", or a warning when the newest snapshot has expired.
function SnapshotStatus({ rate }: { rate: RateIndex }) {
  const now = useNow()
  if (!isRateValid(rate, 0, now)) {
    return (
      <Badge variant="destructive">expired: start `npm run oracle` or `npm run oracle:hold`</Badge>
    )
  }
  const secondsLeft = Math.floor((Date.parse(rate.validUntil) - now) / 1000)
  return (
    <Badge variant="outline" className="gap-1.5 border-success/40 text-success">
      {/* The pulsing dot says "this price is live". */}
      <span aria-hidden className="size-1.5 animate-pulse rounded-full bg-success" />
      valid for {secondsLeft} s
    </Badge>
  )
}
