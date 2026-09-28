import { useRef, useState, type CSSProperties, type KeyboardEvent } from 'react'
import { cn } from 'cn'
import { artSize, artX, artY } from '@/landing/artboard'
import { PARTS, SEATS, type Seat, type TradePart } from '@/landing/privacy-lens-data'
import { LABEL_X, PLATE_EDGE, PRIVACY_FRAME as F, STACK_HEIGHT, STACK_WIDTH } from '@/landing/privacy-geometry'

// Signature C: "One trade. Four ledgers." (the flagship).
//
// ONE transaction (Alice buys 500 PT from Bank at 0.9750, pays 487.50 USDC),
// drawn as three stacked plates, one per part of the trade:
//   blue glass    = price and rate (the Quote),
//   silver        = the PT leg,
//   dark metal    = the cash leg.
// Pick a party and the plates its node does NOT store fade to a ghost, and
// their labels say "Not on X's ledger". Next to the stack, one big count says
// how many parts that node holds.
// The blue of the glass plate is the render's material (glass = the private
// part), not the yield ink: no text here uses the yield blue, since none of
// these parts is yield.
// The rules live in landing/privacy-lens-data.ts (from spec §10).

const nameOf = (seat: Seat) => SEATS.find((entry) => entry.seat === seat)?.name ?? seat
const partsStoredBy = (seat: Seat) => PARTS.filter((part) => part.visibleTo.includes(seat))

// The hatch used for "this does not exist on this ledger".
const HATCH = 'bg-[repeating-linear-gradient(-45deg,var(--hatch)_0_1px,transparent_1px_7px)]'

export function PrivacyLens() {
  const [seat, setSeat] = useState<Seat>('alice')
  const name = nameOf(seat)
  const stored = partsStoredBy(seat)

  // Layout:
  //   up to 1279 px: the party tabs in a row, the count, then the plates;
  //   wide screens (xl, 1280 px and up): the plates on the left, and a column
  //   on the right with the four parties as a vertical list and the count
  //   under them. The panel is
  //   then about as tall as the plates (~410 px at 1280 px wide), so it fits
  //   a laptop screen, and the right side is no longer a big empty area.
  return (
    <div className="grid gap-8 xl:grid-cols-[minmax(0,1fr)_300px] xl:items-center xl:gap-14">
      <div className="xl:col-start-2 xl:row-start-1">
        <SeatTabs seat={seat} onChange={setSeat} />

        <div className="mt-8">
          <p className="text-[15px] text-muted-foreground">On {name}&rsquo;s node</p>
          {/* A live region, so screen readers hear the new count when the seat changes. */}
          <p aria-live="polite" className="mt-3 font-display text-[40px] leading-none">
            <span className="num">{stored.length} of 3</span>{' '}
            <span className="text-muted-foreground">parts</span>
          </p>
        </div>
      </div>

      <div
        role="tabpanel"
        id="lens-panel"
        aria-labelledby={`seat-${seat}`}
        className="xl:col-start-1 xl:row-start-1"
      >
        <PlateStack seat={seat} name={name} />

        {/* The parts as a list. Phones see it (the labels beside the plates
            are hidden there); on bigger screens it is for screen readers only. */}
        <ul className="mt-6 grid border-t border-border sm:sr-only">
          {PARTS.map((part) => (
            <PartRow key={part.layer} part={part} stored={part.visibleTo.includes(seat)} name={name} />
          ))}
        </ul>
      </div>
    </div>
  )
}

// ----------------------------------------------------------------------------

type SeatTabsProps = {
  seat: Seat
  onChange: (seat: Seat) => void
}

// Four tabs, one per party. A row up to 1279 px wide, a vertical list on
// wide screens (xl), where the selected tab's line moves from the bottom edge to
// the left edge. Arrow keys move between them (and select): left/right for
// the row, up/down for the list (both work everywhere).
function SeatTabs({ seat, onChange }: SeatTabsProps) {
  const buttons = useRef<(HTMLButtonElement | null)[]>([])

  function onKeyDown(event: KeyboardEvent<HTMLButtonElement>, index: number) {
    const forward = event.key === 'ArrowRight' || event.key === 'ArrowDown'
    const back = event.key === 'ArrowLeft' || event.key === 'ArrowUp'
    const delta = forward ? 1 : back ? -1 : 0
    if (delta === 0) return
    event.preventDefault()
    const next = (index + delta + SEATS.length) % SEATS.length
    buttons.current[next]?.focus()
    onChange(SEATS[next].seat)
  }

  return (
    <div role="tablist" aria-label="View the trade as" className="grid grid-cols-2 border-b border-input sm:grid-cols-4 xl:grid-cols-1 xl:border-b-0 xl:border-l">
      {SEATS.map((entry, index) => {
        const selected = entry.seat === seat
        const count = partsStoredBy(entry.seat).length
        return (
          <button
            key={entry.seat}
            id={`seat-${entry.seat}`}
            ref={(element) => {
              buttons.current[index] = element
            }}
            type="button"
            role="tab"
            aria-selected={selected}
            aria-controls="lens-panel"
            tabIndex={selected ? 0 : -1}
            onClick={() => onChange(entry.seat)}
            onKeyDown={(event) => onKeyDown(event, index)}
            className={cn(
              'relative grid gap-1 py-4 pr-4 text-left transition-colors duration-200 xl:py-3 xl:pl-5',
              selected ? 'text-foreground' : 'text-faint hover:text-muted-foreground',
            )}
          >
            <span className={cn('text-lg font-semibold sm:text-xl', selected ? 'text-foreground' : 'text-muted-foreground')}>
              {entry.name}
            </span>
            {/* One tick per part of the trade this party's node stores. */}
            <span className="mt-2 flex items-center gap-1" aria-hidden="true">
              {PARTS.map((part, tick) => (
                <i key={part.layer} className={cn('h-[3px] w-4', tick < count ? 'bg-foreground' : 'bg-input')} />
              ))}
              <span className="num ml-2 text-xs">{count}/3</span>
            </span>
            {/* The selected tab's line sits on the tab bar's line: at the
                bottom in a row, on the left edge in the xl list. */}
            <span
              aria-hidden="true"
              className={cn(
                'absolute inset-x-0 -bottom-px h-0.5 transition-colors duration-200 xl:top-0 xl:right-auto xl:bottom-0 xl:-left-px xl:h-auto xl:w-0.5',
                selected ? 'bg-foreground' : 'bg-transparent',
              )}
            />
          </button>
        )
      })}
    </div>
  )
}

// ----------------------------------------------------------------------------
// The stack of plates, with one label per plate (sm and up).

type ViewProps = {
  seat: Seat
  name: string
}

// A plate the party cannot see fades to a grey ghost: still there as a shape
// (the transaction has three parts), but empty for this node.
function plateStyle(stored: boolean): CSSProperties {
  return {
    opacity: stored ? 1 : 0.1,
    filter: stored ? 'none' : 'grayscale(1)',
    transition: 'opacity 360ms var(--ease-standard), filter 360ms var(--ease-standard)',
  }
}

function PlateStack({ seat, name }: ViewProps) {
  const storedNames = PARTS.filter((part) => part.visibleTo.includes(seat)).map((part) => part.label.toLowerCase())
  const missingNames = PARTS.filter((part) => !part.visibleTo.includes(seat)).map((part) => part.label.toLowerCase())
  const label =
    missingNames.length === 0
      ? `Three stacked plates: price and rate, the PT leg and the cash leg. ${name}'s node stores all three.`
      : `Three stacked plates. ${name}'s node stores: ${storedNames.join(', ')}. Not stored: ${missingNames.join(', ')}.`

  return (
    // The artboard: a CSS size container, so labels can size themselves in cqw.
    // Phones have no labels, so there the artboard is just the stack (1070 × 920);
    // from sm up it is 1700 wide with the label column on the right.
    <div role="img" aria-label={label} className="@container relative aspect-[1070/920] w-full sm:aspect-[1700/920]">
      {/* The stack, on the left part of the artboard, in back-to-front order.
          1070 / 1700 = 62.94% of the artboard from sm up. */}
      <div className="absolute top-0 left-0 h-full w-full sm:w-[62.94%]">
        <Plate name="shadow" style={{ opacity: 0.8 }} />
        {[...PARTS].reverse().map((part) => (
          <Plate key={part.layer} name={part.layer} style={plateStyle(part.visibleTo.includes(seat))} />
        ))}
      </div>

      {/* One label per plate, joined to its right edge. Hidden on phones. */}
      {PARTS.map((part) => {
        const stored = part.visibleTo.includes(seat)
        const edge = PLATE_EDGE[part.layer]
        return (
          <div key={part.layer} aria-hidden="true" className="hidden sm:block">
            <span
              className={cn(
                'absolute h-0 border-t transition-colors duration-300',
                stored ? 'border-foreground/50' : 'border-dashed border-input',
              )}
              style={{
                left: artX(F, edge.x + 14),
                top: artY(F, edge.y),
                width: `${((LABEL_X - edge.x - 26) / F.width) * 100}%`,
              }}
            />
            <div className="absolute -translate-y-1/2" style={{ left: artX(F, LABEL_X), top: artY(F, edge.y) }}>
              <p className="label-caps" style={{ fontSize: artSize(F, 22, 10) }}>
                {part.label}
              </p>
              {stored ? (
                <p className="num mt-0.5 font-semibold tracking-[-0.01em]" style={{ fontSize: artSize(F, 34, 13) }}>
                  {part.value}
                </p>
              ) : (
                <p
                  className={cn('mt-1 inline-block rounded-md px-2 py-0.5 text-faint', HATCH)}
                  style={{ fontSize: artSize(F, 26, 11) }}
                >
                  Not on {name}&rsquo;s ledger
                </p>
              )}
            </div>
          </div>
        )
      })}
    </div>
  )
}

function Plate({ name, style }: { name: string; style?: CSSProperties }) {
  return (
    <img
      src={`/privacy/${name}.webp`}
      srcSet={`/privacy/${name}-sm.webp 535w, /privacy/${name}.webp 1070w`}
      sizes="(min-width: 1024px) 40vw, 70vw"
      width={STACK_WIDTH}
      height={STACK_HEIGHT}
      alt=""
      decoding="async"
      loading="lazy"
      className="absolute inset-0 size-full"
      style={style}
    />
  )
}

// One part in the phone / screen-reader list.
function PartRow({ part, stored, name }: { part: TradePart; stored: boolean; name: string }) {
  return (
    <li
      className={cn(
        'grid grid-cols-[112px_minmax(0,1fr)] items-center gap-3 border-b border-border py-2.5 text-sm',
        !stored && HATCH,
      )}
    >
      <span className={stored ? 'text-muted-foreground' : 'text-faint'}>{part.label}</span>
      <span className={cn('num', !stored && 'text-xs text-faint')}>
        {stored ? part.value : `Not on ${name}’s ledger`}
      </span>
    </li>
  )
}
