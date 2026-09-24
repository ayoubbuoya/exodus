import { useEffect, useRef, useState } from 'react'
import { PauseIcon, PlayIcon } from 'lucide-react'
import { cn } from 'cn'
import { Button } from '@/components/ui/button'
import { useElementWidth } from '@/hooks/useElementWidth'
import { usePrefersReducedMotion } from '@/hooks/usePrefersReducedMotion'
import { FIXED_APY_LABEL, MATURITY_DATE, TERM_DAYS } from '@/landing/demo-numbers'
import { JAN_1, claimableOn1000, dateLabel, ptPrice, usycIndex, ytValue } from '@/landing/maturity-model'

// "Two instruments. One date." The maturity idea as a chart you can move.
//
// Two panels share one time axis and are cut by one vertical line: the
// maturity, 01 Apr 2027. The upper panel is PT (the text colour), pulling up
// to par. The lower panel is YT (the yield blue), falling to zero. Past the current
// sim date the lines are faint; before it they are solid, so you can see time
// passing. The slider, the play button and the three shortcuts move the date.
// All numbers come from landing/maturity-model.ts.

const MONTHS = [
  { day: 0, label: 'Oct 2026' },
  { day: 31, label: 'Nov' },
  { day: 61, label: 'Dec' },
  { day: 92, label: 'Jan 2027' },
  { day: 123, label: 'Feb' },
  { day: 151, label: 'Mar' },
]

const SHORTCUTS = [
  { day: 0, label: 'Split' },
  { day: JAN_1, label: '01 Jan' },
  { day: TERM_DAYS, label: 'Maturity' },
]

export function MaturitySection() {
  const [day, setDay] = useState(JAN_1)
  const [playing, setPlaying] = useState(false)
  const reduceMotion = usePrefersReducedMotion()
  // Playback stops by itself at maturity: "running" is derived, not stored.
  const running = playing && day < TERM_DAYS

  // "Play": walk from the current day to maturity in about 4 seconds.
  useEffect(() => {
    if (!running) return
    const timer = window.setInterval(() => setDay((current) => Math.min(TERM_DAYS, current + 2)), 45)
    return () => window.clearInterval(timer)
  }, [running])

  function togglePlay() {
    if (running) {
      setPlaying(false)
      return
    }
    // With reduced motion, "play" jumps straight to maturity.
    if (reduceMotion) {
      setDay(TERM_DAYS)
      return
    }
    if (day >= TERM_DAYS) setDay(0)
    setPlaying(true)
  }

  return (
    <section id="maturity" aria-labelledby="maturity-title" className="scroll-mt-[72px] border-t border-border">
      <div className="mx-auto max-w-[1280px] px-4 py-20 sm:px-6 lg:px-10 lg:py-28">
        <div className="reveal grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,420px)] lg:items-end">
          <h2
            id="maturity-title"
            className="text-chrome font-display text-[32px] leading-[1.02] sm:text-[40px] xl:text-[52px]"
          >
            Two instruments. <span className="block">One date.</span>
          </h2>
          <p className="text-[15px] leading-6 text-muted-foreground">
            Principal pulls toward par. Yield runs down to zero. On {MATURITY_DATE} they meet the meridian and the
            market settles: PT redeems, and YT has paid out everything it was owed.
          </p>
        </div>

        <div className="glass glass-glow mt-12 grid gap-10 rounded-2xl p-4 sm:p-8 xl:grid-cols-[minmax(0,1fr)_240px]">
          <div className="min-w-0">
            <MaturityChart day={day} />
            <div className="mt-6 flex flex-wrap items-center gap-x-5 gap-y-3">
              <Button variant="outline" size="sm" onClick={togglePlay} aria-pressed={running}>
                {running ? <PauseIcon /> : <PlayIcon />}
                {running ? 'Pause' : 'Play to maturity'}
              </Button>
              <label htmlFor="sim-date" className="sr-only">
                Sim date
              </label>
              <input
                id="sim-date"
                type="range"
                min={0}
                max={TERM_DAYS}
                step={1}
                value={day}
                aria-valuetext={dateLabel(day)}
                onChange={(event) => {
                  setPlaying(false)
                  setDay(Number(event.target.value))
                }}
                className="min-w-[180px] flex-1 accent-foreground"
              />
              <div className="flex gap-1" role="group" aria-label="Jump to">
                {SHORTCUTS.map((shortcut) => (
                  <Button
                    key={shortcut.day}
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      setPlaying(false)
                      setDay(shortcut.day)
                    }}
                    className={cn(day === shortcut.day && 'bg-muted')}
                  >
                    {shortcut.label}
                  </Button>
                ))}
              </div>
            </div>
          </div>
          <Readouts day={day} announce={!running} />
        </div>

        <p className="mt-8 max-w-[90ch] text-xs leading-5 text-faint">
          Illustration. The PT line assumes a constant {FIXED_APY_LABEL} implied rate (the example quote); on Exodus,
          real PT prices exist only inside private quotes. The index follows the demo schedule: 1.00 on 01 Oct 2026,
          1.025 on 01 Jan 2027, 1.05 at maturity.
        </p>
      </div>
    </section>
  )
}

// The numbers at the current sim date. A live region, so screen readers hear a
// change, but silent while playing (20 updates a second would be noise).
function Readouts({ day, announce }: { day: number; announce: boolean }) {
  const rows = [
    { label: 'Sim date', value: dateLabel(day), tone: '' },
    { label: 'To maturity', value: `${TERM_DAYS - day} d`, tone: '' },
    { label: 'USYC index', value: usycIndex(day).toFixed(6), tone: '' },
    { label: 'PT price', value: ptPrice(day).toFixed(4), tone: 'text-pt' },
    { label: 'YT value (1 − PT)', value: ytValue(day).toFixed(4), tone: 'text-yt' },
    { label: 'Claimable on 1,000 YT', value: `${claimableOn1000(day)} USYC`, tone: 'text-yt' },
  ]
  return (
    <dl aria-live={announce ? 'polite' : 'off'} className="grid content-start gap-0 border-t border-input sm:grid-cols-2 xl:grid-cols-1">
      {rows.map((row) => (
        <div key={row.label} className="border-b border-border py-3">
          <dt className="label-caps">{row.label}</dt>
          <dd className={cn('num mt-1 text-xl font-medium tracking-[-0.01em]', row.tone)}>{row.value}</dd>
        </div>
      ))}
    </dl>
  )
}

// ----------------------------------------------------------------------------
// The chart, drawn in real pixels from the measured width.

const PT_DOMAIN = [0.97, 1.0] as const
const YT_DOMAIN = [0, 0.03] as const

function MaturityChart({ day }: { day: number }) {
  const boxRef = useRef<HTMLDivElement>(null)
  const width = useElementWidth(boxRef)
  const phone = width > 0 && width < 560

  // Layout (px). Right margin holds the labels next to the meridian.
  const left = phone ? 40 : 56
  const right = phone ? 56 : 104
  const ptTop = 34
  const ptHeight = phone ? 170 : 230
  const gap = 34
  const ytTop = ptTop + ptHeight + gap
  const ytHeight = phone ? 110 : 150
  const axisY = ytTop + ytHeight
  const height = axisY + 34
  const plotRight = width - right

  const x = (d: number) => left + (d / TERM_DAYS) * (plotRight - left)
  const yPt = (v: number) => ptTop + ((PT_DOMAIN[1] - v) / (PT_DOMAIN[1] - PT_DOMAIN[0])) * ptHeight
  const yYt = (v: number) => ytTop + ((YT_DOMAIN[1] - v) / (YT_DOMAIN[1] - YT_DOMAIN[0])) * ytHeight

  function line(from: number, to: number, y: (d: number) => number): string {
    let path = ''
    for (let d = from; d <= to; d++) path += `${d === from ? 'M' : 'L'}${x(d).toFixed(1)} ${y(d).toFixed(1)} `
    return path
  }
  const ptY = (d: number) => yPt(ptPrice(d))
  const ytY = (d: number) => yYt(ytValue(d))

  return (
    <div ref={boxRef} className="h-[378px] sm:h-[458px]" style={width > 0 ? { height } : undefined}>
      {width > 0 && (
        <svg
          width={width}
          height={height}
          viewBox={`0 0 ${width} ${height}`}
          className="block overflow-visible"
          role="img"
          aria-label={`PT price and YT value from the split to maturity. On ${dateLabel(day)} PT is ${ptPrice(day).toFixed(4)} and YT is ${ytValue(day).toFixed(4)}. At maturity, ${MATURITY_DATE}, PT reaches par (1.0000) and YT reaches zero.`}
        >
          {/* Panel labels. */}
          <text x={left} y={ptTop - 14} className="fill-foreground text-[13px] font-semibold">
            PT price <tspan className="fill-muted-foreground font-normal">· principal</tspan>
          </text>
          <text x={left} y={ytTop - 12} className="fill-yt text-[13px] font-semibold">
            YT value <tspan className="fill-muted-foreground font-normal">· yield</tspan>
          </text>

          {/* Horizontal grid and y labels. */}
          {[0.97, 0.98, 0.99].map((v) => (
            <g key={v}>
              <line x1={left} x2={plotRight} y1={yPt(v)} y2={yPt(v)} className="stroke-border" />
              <text x={left - 10} y={yPt(v) + 4} textAnchor="end" className="num fill-faint text-[11px]">
                {v.toFixed(2)}
              </text>
            </g>
          ))}
          {[0.01, 0.02, 0.03].map((v) => (
            <g key={v}>
              <line x1={left} x2={plotRight} y1={yYt(v)} y2={yYt(v)} className="stroke-border" />
              <text x={left - 10} y={yYt(v) + 4} textAnchor="end" className="num fill-faint text-[11px]">
                {v.toFixed(2)}
              </text>
            </g>
          ))}

          {/* Par (1.00) and zero: where PT and YT end. */}
          <line x1={left} x2={plotRight} y1={yPt(1)} y2={yPt(1)} className="stroke-muted-foreground" strokeDasharray="3 5" />
          <text x={plotRight + 14} y={yPt(1) + 4} className="num fill-foreground text-[12px] font-semibold">
            Par 1.00
          </text>
          <line x1={left} x2={plotRight} y1={yYt(0)} y2={yYt(0)} className="stroke-muted-foreground" />
          <text x={plotRight + 14} y={yYt(0) + 4} className="num fill-yt text-[12px] font-semibold">
            Zero
          </text>

          {/* Month ticks on the shared axis. */}
          {MONTHS.map((month) => (
            <g key={month.day}>
              <line x1={x(month.day)} x2={x(month.day)} y1={ptTop} y2={axisY} className="stroke-border" strokeDasharray="1 4" />
              {(!phone || month.day % 92 === 0) && (
                <text x={x(month.day)} y={axisY + 22} textAnchor="middle" className="num fill-faint text-[11px]">
                  {month.label}
                </text>
              )}
            </g>
          ))}

          {/* The future (faint) and the past (solid). */}
          <path d={line(0, TERM_DAYS, ptY)} className="fill-none stroke-pt opacity-25" strokeWidth={2} />
          <path d={line(0, TERM_DAYS, ytY)} className="fill-none stroke-yt opacity-30" strokeWidth={2} />
          {day > 0 && <path d={line(0, day, ptY)} className="fill-none stroke-pt" strokeWidth={2.5} strokeLinejoin="round" />}
          {day > 0 && <path d={line(0, day, ytY)} className="fill-none stroke-yt" strokeWidth={2.5} strokeLinejoin="round" />}

          {/* The meridian: maturity, through both panels. The strongest line on the page. */}
          <line x1={x(TERM_DAYS)} x2={x(TERM_DAYS)} y1={ptTop - 26} y2={axisY + 6} className="stroke-foreground" strokeWidth={2} />
          <text x={x(TERM_DAYS)} y={axisY + 22} textAnchor={phone ? 'end' : 'middle'} className="num fill-foreground text-[12px] font-semibold">
            {phone ? 'Apr 2027' : MATURITY_DATE}
          </text>
          <text x={x(TERM_DAYS) + 14} y={ptTop - 14} className="fill-foreground text-[12px] font-semibold">
            Maturity
          </text>

          {/* Today: the sim date, with a dot on each line. */}
          {day < TERM_DAYS && (
            <line x1={x(day)} x2={x(day)} y1={ptTop - 6} y2={axisY} className="stroke-muted-foreground" strokeDasharray="2 3" />
          )}
          <circle cx={x(day)} cy={ptY(day)} r={5} className="fill-pt stroke-background" strokeWidth={2} />
          <circle cx={x(day)} cy={ytY(day)} r={5} className="fill-yt stroke-background" strokeWidth={2} />
          {!phone && (
            <>
              <text
                x={x(day) + (day > TERM_DAYS - 30 ? -10 : 10)}
                y={ptY(day) + 20}
                textAnchor={day > TERM_DAYS - 30 ? 'end' : 'start'}
                className="num fill-foreground text-[13px] font-semibold"
              >
                {ptPrice(day).toFixed(4)}
              </text>
              <text
                x={x(day) + (day > TERM_DAYS - 30 ? -10 : 10)}
                y={ytY(day) - 10}
                textAnchor={day > TERM_DAYS - 30 ? 'end' : 'start'}
                className="num fill-yt text-[13px] font-semibold"
              >
                {ytValue(day).toFixed(4)}
              </text>
            </>
          )}
        </svg>
      )}
    </div>
  )
}
