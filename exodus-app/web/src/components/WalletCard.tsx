import { decimalToUnits, formatAmount, formatUsd, unitsToDecimal, type Contract, type HoldingView } from '@exodus/ledger'
import { useOwnedHoldings, useRateIndex } from '../ledger.ts'
import { ErrorMessage } from './ErrorMessage.tsx'

type WalletCardProps = {
  party: string
  partyName: string
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
export function WalletCard({ party, partyName }: WalletCardProps) {
  const holdings = useOwnedHoldings(party)
  const rate = useRateIndex(party)
  const usycIndex = rate.data ? rate.data.payload.index : null

  return (
    <section className="card">
      <h2>{partyName}'s wallet (CIP-56 view)</h2>
      {holdings.isPending && <p className="muted">Loading…</p>}
      {holdings.isError && <ErrorMessage error={holdings.error} />}
      {holdings.isSuccess && holdings.data.length === 0 && <p className="muted">{partyName} owns no holdings.</p>}
      {holdings.isSuccess && holdings.data.length > 0 && (
        <WalletTable rows={sumByInstrument(holdings.data)} usycIndex={usycIndex} />
      )}
    </section>
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
    <table className="table">
      <thead>
        <tr>
          <th>Asset</th>
          <th className="num">Amount</th>
          <th className="num">Holdings</th>
          <th className="num">Value (USD)</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((row) => {
          const price = usdPrice(row.instrument, usycIndex)
          return (
            <tr key={row.instrument}>
              <td>{row.instrument}</td>
              <td className="num">{formatAmount(row.amount)}</td>
              <td className="num">{row.holdingCount}</td>
              <td className="num">{price === null ? '—' : formatUsd(Number(row.amount) * price)}</td>
            </tr>
          )
        })}
      </tbody>
      <tfoot>
        <tr>
          <td colSpan={3}>Total</td>
          <td className="num">{totalKnown ? formatUsd(totalUsd) : '—'}</td>
        </tr>
      </tfoot>
    </table>
  )
}
