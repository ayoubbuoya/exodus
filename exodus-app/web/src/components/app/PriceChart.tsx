// The USYC price over the demo calendar (one series: the index, in USD per USYC).
//
// Chart choices (see the dataviz rules): change over time -> a line with a soft
// area under it; one series, so no legend (the title names it); thin 2px line in
// the brand teal; a recessive horizontal grid; a crosshair tooltip on hover; and
// a screen-reader table with the same numbers.
import { formatAmount } from '@exodus/ledger'
import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { usePriceHistory } from '@/api/hooks'
import { FormError } from '@/components/FormError'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { formatDemoDate, formatDemoDay } from '@/lib/format'

// Recharts needs numbers: time in ms, index as a JS number (display only).
type ChartPoint = { time: number; index: number; simTime: string; indexText: string }

const CHART_HEIGHT = 260

export function PriceChart() {
  const history = usePriceHistory()

  return (
    <Card>
      <CardHeader>
        <CardTitle>USYC price</CardTitle>
        <CardDescription>USD per USYC by demo date. It grows as the fund earns T-bill yield.</CardDescription>
      </CardHeader>
      <CardContent>
        {history.isPending && <Skeleton style={{ height: CHART_HEIGHT }} />}
        {history.isError && <FormError error={history.error} />}
        {history.data !== undefined && <PriceChartBody points={toChartPoints(history.data.points)} />}
      </CardContent>
    </Card>
  )
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
      <p className="flex items-center justify-center text-sm text-muted-foreground" style={{ height: CHART_HEIGHT }}>
        The chart fills in as the oracle publishes new prices (run <code className="mx-1">npm run oracle</code>).
      </p>
    )
  }
  return (
    <>
      <div style={{ height: CHART_HEIGHT }} aria-hidden>
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={points} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
            <defs>
              {/* Soft fill under the line: 20% teal at the top fading to nothing. */}
              <linearGradient id="usyc-price-fill" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="var(--color-primary)" stopOpacity={0.2} />
                <stop offset="100%" stopColor="var(--color-primary)" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid vertical={false} stroke="var(--color-border)" />
            <XAxis
              dataKey="time"
              type="number"
              scale="time"
              domain={['dataMin', 'dataMax']}
              tickFormatter={formatDemoDay}
              tick={{ fill: 'var(--color-muted-foreground)', fontSize: 12 }}
              tickLine={false}
              axisLine={false}
              minTickGap={24}
            />
            <YAxis
              domain={['auto', 'auto']}
              tickFormatter={(value: number) => value.toFixed(3)}
              tick={{ fill: 'var(--color-muted-foreground)', fontSize: 12 }}
              tickLine={false}
              axisLine={false}
              width={48}
            />
            <Tooltip
              content={({ active, payload }) => <ChartTooltip active={active} point={payload?.[0]?.payload as ChartPoint | undefined} />}
              cursor={{ stroke: 'var(--color-muted-foreground)', strokeDasharray: '3 3' }}
            />
            <Area
              type="linear"
              dataKey="index"
              stroke="var(--color-primary)"
              strokeWidth={2}
              fill="url(#usyc-price-fill)"
              // A ring in the card colour keeps the hover dot readable on top of the line.
              activeDot={{ r: 4, stroke: 'var(--color-card)', strokeWidth: 2, fill: 'var(--color-primary)' }}
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
    <div className="rounded-md border bg-popover px-3 py-2 text-xs text-popover-foreground shadow-md">
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
