// /portfolio: the client's market tokens, like Pendle's portfolio page.
//
//   total USD value of PT + YT (+ claimable yield)
//   one row per market: PT (free / locked), YT, claimable yield, value
//   payout requests waiting for the Operator (Cancel)
//   market activity (split, trades, payouts)
//
// USD value follows Pendle: 1 PT = the dealer's mid price (1 after
// maturity), 1 YT = 1 − that price, plus the yield the YT can claim.
// The simulated USYC/USDC themselves are on the Wallet page.
import { Link } from 'react-router'
import { formatAmount, formatUsd } from '@exodus/ledger'
import { usePortfolio } from '@/api/market-hooks'
import type { PortfolioPosition } from '@/api/types'
import { ActivityCard } from '@/components/app/ActivityCard'
import { FormError } from '@/components/FormError'
import { OpenRequests } from '@/components/markets/OpenRequests'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'

export function PortfolioPage() {
  const portfolio = usePortfolio()

  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-6 px-4 py-8">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Portfolio</h1>
        <p className="text-sm text-muted-foreground">Your PT and YT in every market. Your USYC and USDC are on the Wallet page.</p>
      </div>

      {portfolio.isPending && <Skeleton className="h-48 w-full" />}
      {portfolio.isError && <FormError error={portfolio.error} />}
      {portfolio.data !== undefined && (
        <Card>
          <CardHeader>
            <CardDescription>Total value of your market tokens</CardDescription>
            <CardTitle className="num text-3xl">${formatUsd(portfolio.data.totalUsd)}</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-6">
            {portfolio.data.positions.length === 0 ? (
              <div className="flex flex-col items-start gap-3 text-sm text-muted-foreground">
                No PT or YT yet. Open a market to buy PT at a fixed rate, or mint PT + YT from USYC.
                <Button asChild size="sm">
                  <Link to="/markets">See markets</Link>
                </Button>
              </div>
            ) : (
              <PositionsTable positions={portfolio.data.positions} />
            )}
            <OpenRequests />
          </CardContent>
        </Card>
      )}

      <ActivityCard scope="markets" />
    </div>
  )
}

function PositionsTable({ positions }: { positions: PortfolioPosition[] }) {
  return (
    // A wide table: on a phone it scrolls sideways inside the card.
    <div className="overflow-x-auto">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Market</TableHead>
            <TableHead className="text-right">PT</TableHead>
            <TableHead className="text-right">YT</TableHead>
            <TableHead className="text-right">Claimable</TableHead>
            <TableHead className="text-right">Value</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {positions.map((position) => (
            <TableRow key={position.marketId}>
              <TableCell>
                <Link to={`/markets/${encodeURIComponent(position.marketId)}`} className="num hover:underline">
                  {position.marketId}
                </Link>
                {position.matured && (
                  <Badge variant="secondary" className="ml-2">
                    Matured
                  </Badge>
                )}
              </TableCell>
              <TableCell className="num text-right">
                {formatAmount(position.ptTotal)}
                {Number(position.ptLocked) > 0 && (
                  <div className="text-xs text-muted-foreground">{formatAmount(position.ptLocked)} locked</div>
                )}
              </TableCell>
              <TableCell className="num text-right">{formatAmount(position.ytTotal)}</TableCell>
              <TableCell className="num text-right text-yt">{formatAmount(position.claimableUsyc)} USYC</TableCell>
              <TableCell className="num text-right">
                ${formatUsd(position.value.totalUsd)}
                <div className="text-xs text-muted-foreground">
                  PT ${formatUsd(position.value.ptUsd)} · YT ${formatUsd(position.value.ytUsd + position.value.claimableUsd)}
                </div>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  )
}
