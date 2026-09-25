// The USYC price over the demo calendar (one series: the index, in USD per USYC).
//
// Chart choices: change over time -> a line with a soft area under it; one
// series, so no legend (the title names it); a thin silver line (the price is
// the asset, not yield); a recessive horizontal grid; a crosshair tooltip on
// hover; and a screen-reader table with the same numbers.
// The header shows the latest price and how much it grew since the first
// point, in the yield blue: that growth IS the fund's yield.
// Example: $1.0250, +2.50% since Oct 1, 2026.
import { formatAmount } from '@exodus/ledger'
import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { usePriceHistory } from '@/api/hooks'
import { FormError } from '@/components/FormError'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { formatDemoDate, formatDemoDay } from '@/lib/format'

// Recharts needs numbers: time in ms, index as a JS number (display only).
type ChartPoint = { time: number; index: number; simTime: string; indexText: string }

const CHART_HEIGHT = 240

export function PriceChart() {
  const history = usePriceHistory()
  const points = history.data === undefined ? [] : toChartPoints(history.data.points)
  const first = points.at(0)
  const last = points.at(-1)

  return (
    <Card>
      <CardHeader>
        <CardTitle>USYC price</CardTitle>
        <CardDescription>
          {first !== undefined && last !== undefined && points.length >= 2 ? (
            <span className="num">
              <span className="text-foreground">${formatAmount(last.indexText, 4)}</span>
              <span className="text-yt"> {formatGrowth(first.index, last.index)}</span> since {formatDemoDate(first.simTime)}
            </span>
          ) : (
            'USD per USYC, by demo date.'
          )}
        </CardDescription>
      </CardHeader>
      <CardContent>
        {history.isPending && <Skeleton style={{ height: CHART_HEIGHT }} />}
        {history.isError && <FormError error={history.error} />}
        {history.data !== undefined && <PriceChartBody points={points} />}
      </CardContent>
    </Card>
  )
}

// +2.50% (the fund's growth over the chart's range). Display only.
function formatGrowth(firstIndex: number, lastIndex: number): string {
  const percent = (lastIndex / firstIndex - 1) * 100
  return `${percent >= 0 ? '+' : '−'}${Math.abs(percent).toFixed(2)}%`
}

function toChartPoints(points: { index: string; simTime: string }[]): ChartPoint[] {
  return points.map((point) => ({
    time: Date.parse(point.simTime),
    index: Number(point.index),
    simTime: point.simTime,
    indexText: point.index,
  }))
}

function PriceChartBody({ points }: { points: ChartPoint[] }) {
  if (points.length < 2) {
    return (
      <p
        className="flex items-center justify-center rounded-2xl bg-foreground/3 px-6 text-center text-sm text-muted-foreground"
        style={{ height: CHART_HEIGHT }}
      >
        The chart fills in as the demo clock moves and the oracle publishes prices.
      </p>
    )
  }
  return (
    <>
      <div style={{ height: CHART_HEIGHT }} aria-hidden>
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={points} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
            <defs>
              {/* Soft fill under the line: 16% silver at the top fading to nothing. */}
              <linearGradient id="usyc-price-fill" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="var(--color-foreground)" stopOpacity={0.16} />
                <stop offset="100%" stopColor="var(--color-foreground)" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid vertical={false} stroke="var(--color-foreground)" strokeOpacity={0.06} />
            <XAxis
              dataKey="time"
              type="number"
              scale="time"
              domain={['dataMin', 'dataMax']}
              tickFormatter={formatDemoDay}
              tick={{ fill: 'var(--color-faint)', fontSize: 12 }}
              tickLine={false}
              axisLine={false}
              minTickGap={24}
            />
            <YAxis
              domain={['auto', 'auto']}
              tickFormatter={(value: number) => value.toFixed(3)}
              tick={{ fill: 'var(--color-faint)', fontSize: 12 }}
              tickLine={false}
              axisLine={false}
              width={48}
            />
            <Tooltip
              content={({ active, payload }) => <ChartTooltip active={active} point={payload?.[0]?.payload as ChartPoint | undefined} />}
              cursor={{ stroke: 'var(--color-foreground)', strokeOpacity: 0.3, strokeDasharray: '3 3' }}
            />
            <Area
              type="linear"
              dataKey="index"
              stroke="var(--color-foreground)"
              strokeWidth={1.75}
              fill="url(#usyc-price-fill)"
              // A ring in the page colour keeps the hover dot readable on top of the line.
              activeDot={{ r: 4, stroke: 'var(--color-background)', strokeWidth: 2, fill: 'var(--color-foreground)' }}
              // The data refreshes every 10 s; re-animating each time would be distracting.
              isAnimationActive={false}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
      <PriceTable points={points} />
    </>
  )
}

function ChartTooltip({ active, point }: { active?: boolean; point?: ChartPoint }) {
  if (active !== true || point === undefined) {
    return null
  }
  return (
    <div className="glass-strong rounded-xl px-3 py-2 text-xs">
      <div className="text-muted-foreground">{formatDemoDate(point.simTime)}</div>
      <div className="num font-medium">${formatAmount(point.indexText, 6)}</div>
    </div>
  )
}

// The same data for screen readers (the SVG chart is hidden from them).
function PriceTable({ points }: { points: ChartPoint[] }) {
  return (
    <table className="sr-only">
      <caption>USYC price by demo date</caption>
      <thead>
        <tr>
          <th>Demo date</th>
          <th>Price (USD)</th>
        </tr>
      </thead>
      <tbody>
        {points.map((point) => (
          <tr key={point.time}>
            <td>{formatDemoDate(point.simTime)}</td>
            <td>{formatAmount(point.indexText, 6)}</td>
          </tr>
        ))}
      </tbody>
    </table>
  )
}
