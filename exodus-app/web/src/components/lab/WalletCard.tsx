import { decimalToUnits, formatAmount, formatUsd, unitsToDecimal, type Contract, type HoldingView } from '@exodus/ledger'
import { BadgeCheckIcon } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Card, CardAction, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { Table, TableBody, TableCell, TableFooter, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { ErrorMessage } from '@/components/ErrorMessage'
import { useClientAccess, useOwnedHoldings, useRateIndex } from '@/ledger'

type WalletCardProps = {
  party: string
  partyName: string
  // A party that can read the USYC price, used only to show USD values.
  // Clients cannot see the price themselves, so the lab reads it as the fund
  // (UsycIssuer). The real app will get it from the backend.
  priceReader: string
}

// One row per instrument, for example:
//   USYC  1,000  (1 holding)  = 1,025.00 USD at index 1.025
type BalanceRow = {
  instrument: string
  amount: string // exact Daml decimal
  holdingCount: number
}

// Adds up the holdings of each instrument with exact bigint math.
function sumByInstrument(holdings: Contract<HoldingView>[]): BalanceRow[] {
  const totals = new Map<string, { units: bigint; count: number }>()
  for (const holding of holdings) {
    const instrument = holding.payload.instrumentId.id
    const current = totals.get(instrument) ?? { units: 0n, count: 0 }
    totals.set(instrument, {
      units: current.units + decimalToUnits(holding.payload.amount),
      count: current.count + 1,
    })
  }

  const rows: BalanceRow[] = []
  for (const [instrument, total] of totals) {
    rows.push({ instrument, amount: unitsToDecimal(total.units), holdingCount: total.count })
  }
  rows.sort((a, b) => a.instrument.localeCompare(b.instrument))
  return rows
}

// USD price of one token, or null if we don't know it.
// USDC is cash (1 USD). USYC is worth the oracle index.
function usdPrice(instrument: string, usycIndex: string | null): number | null {
  if (instrument === 'USDC') {
    return 1
  }
  if (instrument === 'USYC' && usycIndex !== null) {
    return Number(usycIndex)
  }
  return null
}

// The party's balances, read ONLY through the CIP-56 Holding interface
// (the way any Canton wallet would see them).
export function WalletCard({ party, partyName, priceReader }: WalletCardProps) {
  const holdings = useOwnedHoldings(party)
  const rate = useRateIndex(priceReader)
  const access = useClientAccess(party)
  const usycIndex = rate.data ? rate.data.payload.index : null

  return (
    <Card>
      <CardHeader>
        <CardTitle>{partyName}'s wallet</CardTitle>
        <CardDescription>Read only through the CIP-56 Holding interface, as any Canton wallet would.</CardDescription>
        {/* The on-ledger whitelist: an access pass from the Operator means "approved client". */}
        {access.data && (
          <CardAction>
            <Badge variant="outline" className="gap-1 border-success/40 text-success">
              <BadgeCheckIcon aria-hidden />
              Approved client
            </Badge>
          </CardAction>
        )}
      </CardHeader>
      <CardContent>
        {holdings.isPending && <Skeleton className="h-24" />}
        {holdings.isError && <ErrorMessage error={holdings.error} />}
        {holdings.isSuccess && holdings.data.length === 0 && (
          <p className="text-muted-foreground">{partyName} owns no holdings.</p>
        )}
        {holdings.isSuccess && holdings.data.length > 0 && (
          <WalletTable rows={sumByInstrument(holdings.data)} usycIndex={usycIndex} />
        )}
      </CardContent>
    </Card>
  )
}

type WalletTableProps = {
  rows: BalanceRow[]
  usycIndex: string | null
}

function WalletTable({ rows, usycIndex }: WalletTableProps) {
  // Display only: converting to number here is fine, we never send these values back.
  let totalUsd = 0
  let totalKnown = true
  for (const row of rows) {
    const price = usdPrice(row.instrument, usycIndex)
    if (price === null) {
      totalKnown = false
    } else {
      totalUsd += Number(row.amount) * price
    }
  }

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Asset</TableHead>
          <TableHead className="text-right">Amount</TableHead>
          <TableHead className="text-right">Holdings</TableHead>
          <TableHead className="text-right">Value (USD)</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {rows.map((row) => {
          const price = usdPrice(row.instrument, usycIndex)
          return (
            <TableRow key={row.instrument}>
              <TableCell className="font-medium">{row.instrument}</TableCell>
              <TableCell className="num text-right">{formatAmount(row.amount)}</TableCell>
              <TableCell className="num text-right">{row.holdingCount}</TableCell>
              <TableCell className="num text-right">
                {price === null ? '—' : formatUsd(Number(row.amount) * price)}
              </TableCell>
            </TableRow>
          )
        })}
      </TableBody>
      <TableFooter>
        <TableRow>
          <TableCell colSpan={3}>Total</TableCell>
          <TableCell className="num text-right">{totalKnown ? formatUsd(totalUsd) : '—'}</TableCell>
        </TableRow>
      </TableFooter>
    </Table>
  )
}
