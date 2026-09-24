import type { ReactNode } from 'react'
import { cn } from 'cn'
import { MATURITY_DATE, OUTCOME, VAULT } from '@/landing/demo-numbers'

// "The maths adds up." The landing page's ONE light section.
//
// It is set like an institutional term sheet (chalk paper, ruled lines, big
// display figures) on purpose: after the dark product sections, the page stops and shows
// the proof. The spec's worked example (docs/exodus.md §9), from split to maturity:
//   Alice, fixed:    +$12.50
//   Bank, floating:  +$37.50   (copper: floating exposure is yield)
//   Fund yield:       $50.00 = 1,000 USYC × (1.05 − 1.00)
// then two reconciliations: who earned what, and every USYC the vault paid out.
//
// `theme-light` switches this block to the light palette (styles/tokens.css),
// even though the rest of the landing page is dark.

export function ProofSection() {
  return (
    <section id="maths" aria-labelledby="maths-title" className="theme-light scroll-mt-[72px] bg-background text-foreground">
      <div className="mx-auto max-w-[1280px] px-4 py-20 sm:px-6 lg:px-10 lg:py-28">
        <div className="flex flex-wrap items-end justify-between gap-6 border-b-2 border-foreground pb-6">
          <h2
            id="maths-title"
            className="font-display text-[40px] leading-none sm:text-[56px] xl:text-[72px]"
          >
            The maths adds up.
          </h2>
          <p className="max-w-[36ch] text-[15px] leading-6 text-muted-foreground">
            The worked example from the spec, from the split on 01 Oct 2026 to maturity on {MATURITY_DATE}. Values
            at the maturity index, 1.05.
          </p>
        </div>

        {/* The three results, written as the equation they form. */}
        <div className="grid items-start gap-y-10 py-12 md:grid-cols-[1fr_auto_1fr_auto_1fr] md:gap-x-6 lg:gap-x-10">
          <Figure label="Alice · fixed return" value={`+$${OUTCOME.alice.profit}`}>
            Paid {OUTCOME.alice.start} for 500 PT. Redeemed {OUTCOME.alice.end}. The rate was known on day one.
          </Figure>
          <Operator>+</Operator>
          <Figure label="Bank · floating return" value={`+$${OUTCOME.bank.profit}`} yieldTone>
            Split 1,000 USYC, sold 500 PT to Alice and kept all 1,000 YT, so Bank took the floating yield.
          </Figure>
          <Operator>=</Operator>
          <Figure label="Total fund yield" value={`$${OUTCOME.fundYield}`}>
            1,000 USYC × (1.05 − 1.00). The split created nothing and lost nothing: it only moved risk.
          </Figure>
        </div>

        <div className="grid gap-12 border-t border-input pt-10 lg:grid-cols-2 lg:gap-16">
          <Ledger title="Who earned what">
            <thead>
              <tr>
                <Th>Party</Th>
                <Th>Start</Th>
                <Th>End</Th>
                <Th right>Result</Th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <Td strong>Alice</Td>
                <Td>{OUTCOME.alice.start}</Td>
                <Td>{OUTCOME.alice.end}</Td>
                <Td right strong>
                  +{OUTCOME.alice.profit}
                </Td>
              </tr>
              <tr>
                <Td strong>Bank</Td>
                <Td>{OUTCOME.bank.start}</Td>
                <Td>{OUTCOME.bank.end}</Td>
                <Td right strong className="text-yt">
                  +{OUTCOME.bank.profit}
                </Td>
              </tr>
            </tbody>
            <tfoot>
              <tr className="border-t-2 border-foreground">
                <Td strong>Total</Td>
                <Td colSpan={2} muted>
                  = the fund&rsquo;s yield, 1,000 × (1.05 − 1.00)
                </Td>
                <Td right strong>
                  +{OUTCOME.fundYield}
                </Td>
              </tr>
            </tfoot>
          </Ledger>

          <Ledger title="The vault reconciles (USYC)">
            <tbody>
              <tr>
                <Td strong>Deposited by the split</Td>
                <Td muted>Bank, 01 Oct 2026</Td>
                <Td right strong>
                  {VAULT.deposited}
                </Td>
              </tr>
              {VAULT.payouts.map((payout) => (
                <tr key={payout.label}>
                  <Td>{payout.label}</Td>
                  <Td muted>{payout.formula}</Td>
                  <Td right>−{payout.amount}</Td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="border-t-2 border-foreground">
                <Td strong>Left in the vault</Td>
                <Td muted>rounding dust, never negative</Td>
                <Td right strong>
                  {VAULT.dust}
                </Td>
              </tr>
            </tfoot>
          </Ledger>
        </div>
        <p className="mt-8 text-[13px] text-muted-foreground">
          Every payout rounds down to 6 decimals, so the vault can never pay out more than it holds.
        </p>
      </div>
    </section>
  )
}

type FigureProps = {
  label: string
  value: string
  yieldTone?: boolean
  children: ReactNode
}

// One big result, in the display face: these are the page's conclusions.
function Figure({ label, value, yieldTone = false, children }: FigureProps) {
  return (
    <div>
      <p className="label-caps">{label}</p>
      <p
        className={cn(
          'num mt-3 font-display text-[56px] leading-none sm:text-[64px] xl:text-[84px]',
          yieldTone && 'text-yt',
        )}
      >
        {value}
      </p>
      <p className="mt-4 max-w-[34ch] text-sm leading-6 text-muted-foreground">{children}</p>
    </div>
  )
}

function Operator({ children }: { children: ReactNode }) {
  return (
    <p aria-hidden="true" className="hidden pt-9 font-display text-[56px] leading-none font-light text-faint md:block xl:pt-11 xl:text-[72px]">
      {children}
    </p>
  )
}

function Ledger({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="min-w-0">
      <h3 className="text-sm font-semibold">{title}</h3>
      <div className="mt-4 overflow-x-auto">
        <table className="num w-full min-w-[480px] border-collapse text-sm">{children}</table>
      </div>
    </div>
  )
}

function Th({ children, right = false }: { children: ReactNode; right?: boolean }) {
  return (
    <th className={cn('label-caps border-b border-input py-2 pr-4 font-medium last:pr-0', right ? 'text-right' : 'text-left')}>
      {children}
    </th>
  )
}

type TdProps = {
  children: ReactNode
  right?: boolean
  strong?: boolean
  muted?: boolean
  colSpan?: number
  className?: string
}

function Td({ children, right = false, strong = false, muted = false, colSpan, className }: TdProps) {
  return (
    <td
      colSpan={colSpan}
      className={cn(
        'border-b border-border py-3 pr-4 align-top last:pr-0',
        right && 'text-right whitespace-nowrap',
        strong && 'font-semibold',
        muted && 'text-muted-foreground',
        className,
      )}
    >
      {children}
    </td>
  )
}
