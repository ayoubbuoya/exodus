// "Fixed Yield": buy or sell PT privately with the house dealer (Bank).
//
// Pendle trades PT on an AMM with a public price. Exodus uses a private RFQ
// instead (spec sections 8.2 and 10):
//   1. Alice picks Buy or Sell and an amount; she sees the dealer's
//      indicative price (0.975503 on Oct 1 = 5.10 % fixed).
//   2. "Get firm quote" sends an RFQ. The dealer bot answers in about 2 s with
//      a firm quote, valid about 60 s.
//   3. Accept: her USDC and the PT change hands in ONE ledger transaction.
//      The Operator settles the PT but never sees the price.
// If the dealer cannot fill it (for example above its size limit), the
// request disappears without a quote: we show "declined".
import { useState, type FormEvent } from 'react'
import { InfoIcon, LoaderCircleIcon, LockIcon } from 'lucide-react'
import { cn } from 'cn'
import { formatAmount, formatUsd, previewQuoteCash } from '@exodus/ledger'
import { toast } from 'sonner'
import { fieldErrorOf } from '@/api/client'
import { useWallet } from '@/api/hooks'
import {
  useAcceptQuote,
  usePortfolio,
  useQuoteRequests,
  useQuotes,
  useRejectQuote,
  useRequestQuote,
} from '@/api/market-hooks'
import type { MarketView, QuoteView, RfqSide } from '@/api/types'
import { AmountInput } from '@/components/finance/AmountInput'
import { SummaryRows, type SummaryRow } from '@/components/finance/SummaryRows'
import { FormError } from '@/components/FormError'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { FieldError } from '@/components/ui/field'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { isTokenAmount, trimZeros } from '@/lib/amount'
import { formatDemoDate, formatPercent } from '@/lib/format'
import {
  findAnsweringQuote,
  formatSecondsLeft,
  quoteFlowStatus,
  quoteTimeLeftShare,
  type QuoteFlowStatus,
} from '@/lib/markets'
import { useNow } from '@/useNow'

// One "Get firm quote" click: what was asked, and when.
// `replacedQuoteId`: the quote on screen when the user asked again (expired,
// for example). It can never be the answer to this new ask. Why: a quote shows
// "Expired" 2 s before its real end (a safety margin), so for those 2 s it
// still looks "valid after the ask" and would be picked up again.
type Ask = { side: RfqSide; ptAmount: string; askedAtMs: number; replacedQuoteId: string | null }

// A request is "ours" if it was sent around the time we asked (the server
// stamps requestedAt with its own clock, a few ms after our click).
const REQUEST_MATCH_MARGIN_MS = 5000

// The countdown bar turns amber in the last seconds, so an Accept is not
// attempted on a quote that will expire on its way to the ledger.
const HURRY_SECONDS = 10

export function TradePanel({ market }: { market: MarketView }) {
  const [side, setSide] = useState<RfqSide>('BuyPt')
  const [ptAmount, setPtAmount] = useState('')
  const [ask, setAsk] = useState<Ask | null>(null)
  // The quote that answered our ask. Kept after it leaves the ledger (accepted,
  // or withdrawn after expiry) so the screen does not flicker to "declined".
  const [seenQuote, setSeenQuote] = useState<QuoteView | null>(null)
  // When that quote first showed up, to draw how much of its life is left.
  const [seenAtMs, setSeenAtMs] = useState(0)
  // The last quote cleared from the screen ("Ask for a new quote", Reject,
  // Accept), so the next ask never mistakes it for its answer (see Ask).
  const [retiredQuoteId, setRetiredQuoteId] = useState<string | null>(null)
  const now = useNow(500)

  const watching = ask !== null && seenQuote === null
  const quoteRequests = useQuoteRequests(watching)
  const quotes = useQuotes(watching)
  const requestQuote = useRequestQuote()

  // Remember the answering quote the first time it shows up. Setting state
  // while rendering is React's documented way to adjust state from new data.
  const candidateQuotes = (quotes.data?.items ?? []).filter((quote) => quote.quoteId !== ask?.replacedQuoteId)
  const answering =
    ask === null ? null : findAnsweringQuote(candidateQuotes, { marketId: market.marketId, side: ask.side, askedAtMs: ask.askedAtMs })
  if (answering !== null && seenQuote === null) {
    setSeenQuote(answering)
    setSeenAtMs(now)
  }

  const hasOpenRequest =
    ask !== null &&
    (quoteRequests.data?.items ?? []).some(
      (request) =>
        request.marketId === market.marketId &&
        request.side === ask.side &&
        Date.parse(request.requestedAt) > ask.askedAtMs - REQUEST_MATCH_MARGIN_MS,
    )
  const status = quoteFlowStatus({
    askedAtMs: ask?.askedAtMs ?? null,
    seenQuote,
    hasOpenRequest,
    listsRefreshedAfterAsk:
      ask !== null && quoteRequests.dataUpdatedAt > ask.askedAtMs && quotes.dataUpdatedAt > ask.askedAtMs,
    nowMs: now,
  })

  function startOver() {
    if (seenQuote !== null) {
      setRetiredQuoteId(seenQuote.quoteId)
    }
    setAsk(null)
    setSeenQuote(null)
  }

  // Switching between Buy and Sell starts a fresh ask.
  function handleSideChange(newSide: RfqSide) {
    setSide(newSide)
    startOver()
  }

  function handleAsk(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const askedAtMs = Date.now()
    const replacedQuoteId = seenQuote?.quoteId ?? retiredQuoteId
    requestQuote.mutate(
      { marketId: market.marketId, side, ptAmount },
      {
        onSuccess: () => {
          // Forget any earlier (expired or declined) answer: otherwise the old
          // quote would keep the screen on "Expired" and hide the new one.
          setSeenQuote(null)
          setAsk({ side, ptAmount, askedAtMs, replacedQuoteId })
        },
      },
    )
  }

  const tradingClosed = market.indicative === null
  const busy = status === 'waiting' || status === 'quoted'
  return (
    <div className="grid gap-5">
      <form onSubmit={handleAsk} className="grid gap-4">
        <Tabs value={side} onValueChange={(value) => handleSideChange(value as RfqSide)}>
          <TabsList className="w-full" aria-label="Buy or sell PT">
            <TabsTrigger value="BuyPt" disabled={busy}>
              Buy PT
            </TabsTrigger>
            <TabsTrigger value="SellPt" disabled={busy}>
              Sell PT
            </TabsTrigger>
          </TabsList>
        </Tabs>
        <AmountSection
          market={market}
          side={side}
          ptAmount={ptAmount}
          onChange={setPtAmount}
          error={fieldErrorOf(requestQuote.error, 'ptAmount')}
          disabled={busy}
        />
        <FormError error={requestQuote.error} />
        {tradingClosed && (
          <Alert variant="info">
            <InfoIcon />
            <AlertDescription>PT trading closed at maturity. Redeem your PT in the "At maturity" tab.</AlertDescription>
          </Alert>
        )}
        {/* While a quote is on screen, its own Accept is the main action. */}
        {!busy && (
          <Button
            type="submit"
            variant="bright"
            size="lg"
            disabled={tradingClosed || !isTokenAmount(ptAmount) || requestQuote.isPending}
          >
            {requestQuote.isPending ? 'Sending…' : 'Get firm quote'}
          </Button>
        )}
      </form>

      <QuoteStatus status={status} quote={seenQuote} seenAtMs={seenAtMs} market={market} now={now} onDone={startOver} />

      <p className="flex items-start gap-2 text-xs leading-5 text-muted-foreground">
        <LockIcon className="mt-0.5 size-3.5 shrink-0" aria-hidden />
        Private: only you and the dealer see the request and the price. The Operator moves the PT but never sees what
        you paid.
      </p>
    </div>
  )
}

type AmountSectionProps = {
  market: MarketView
  side: RfqSide
  ptAmount: string
  onChange: (value: string) => void
  error: string | undefined
  disabled: boolean
}

// The PT amount, then what the dealer's indicative price means for it.
// Example (buy 20 PT at 0.975503): pay about 19.51 USDC, 5.10 % fixed, and at
// maturity the 20 PT pay 20 USD of USYC.
function AmountSection({ market, side, ptAmount, onChange, error, disabled }: AmountSectionProps) {
  const wallet = useWallet()
  const portfolio = usePortfolio()
  const position = portfolio.data?.positions.find((candidate) => candidate.marketId === market.marketId)
  const freePt = position?.ptFree ?? '0'
  const usdcBalance = wallet.data?.balances.USDC ?? '0'
  const isBuy = side === 'BuyPt'

  const price = isBuy ? market.indicative?.askPrice : market.indicative?.bidPrice
  const fixedApy = isBuy ? market.indicative?.askFixedApyPercent : market.indicative?.bidFixedApyPercent
  const hasAmount = isTokenAmount(ptAmount)
  const cash = price !== undefined && hasAmount ? previewQuoteCash(price, ptAmount) : null

  const rows: SummaryRow[] =
    price === undefined
      ? []
      : [
          { label: 'Indicative price', value: `${formatAmount(price, 6)} USDC per PT` },
          { label: isBuy ? 'You pay about' : 'You get about', value: cash === null ? '—' : `${formatAmount(cash)} USDC` },
          { label: 'Fixed APY', value: formatPercent(fixedApy ?? null), tone: 'strong' },
        ]
  // The whole point of PT, in one line: what the PT pays on the maturity date.
  if (price !== undefined && isBuy) {
    rows.push({
      label: 'At maturity',
      value: hasAmount ? `$${formatUsd(Number(ptAmount))} of USYC · ${formatDemoDate(market.maturity)}` : `1 USD of USYC per PT`,
    })
  }

  return (
    <div className="grid gap-3">
      <AmountInput
        id="trade-amount"
        label={isBuy ? 'You buy' : 'You sell'}
        unit="PT"
        value={ptAmount}
        onChange={onChange}
        balance={isBuy ? usdcBalance : freePt}
        balanceUnit={isBuy ? 'USDC' : 'PT'}
        onMax={isBuy ? undefined : () => onChange(trimZeros(freePt))}
        invalid={error !== undefined}
        disabled={disabled}
      />
      {error !== undefined && <FieldError>{error}</FieldError>}
      {rows.length > 0 && <SummaryRows rows={rows} />}
      {rows.length > 0 && <p className="px-1 text-xs text-faint">The firm quote may differ a little from the indicative price.</p>}
    </div>
  )
}

type QuoteStatusProps = {
  status: QuoteFlowStatus
  quote: QuoteView | null
  seenAtMs: number
  market: MarketView
  now: number
  onDone: () => void
}

// What happens after "Get firm quote": waiting, the quote, expired or declined.
function QuoteStatus({ status, quote, seenAtMs, market, now, onDone }: QuoteStatusProps) {
  if (status === 'idle') {
    return null
  }
  if (status === 'waiting') {
    return (
      <div role="status" className="glass-strong flex items-center gap-3 rounded-3xl p-5 text-sm">
        <LoaderCircleIcon className="size-5 shrink-0 animate-spin text-muted-foreground" aria-hidden />
        <div className="grid">
          <span className="font-medium">The house dealer is pricing your request…</span>
          <span className="text-muted-foreground">
            {market.dealerAutoQuote ? 'Usually about 2 seconds.' : 'Quotes are manual right now: a person answers.'}
          </span>
        </div>
      </div>
    )
  }
  if (status === 'declined') {
    return (
      <div role="status" className="grid gap-3 rounded-3xl border border-warning/30 bg-warning/8 p-5 text-sm">
        <p>
          <span className="font-medium">The dealer declined this request.</span>{' '}
          <span className="text-muted-foreground">
            It may be above the dealer's size limit, or the dealer does not have enough PT or USDC right now. Try a
            smaller amount.
          </span>
        </p>
        <Button variant="glass" size="sm" className="justify-self-start" onClick={onDone}>
          Ask again
        </Button>
      </div>
    )
  }
  if (quote === null) {
    return null
  }
  return <QuoteCard quote={quote} seenAtMs={seenAtMs} expired={status === 'expired'} now={now} onDone={onDone} />
}

type QuoteCardProps = { quote: QuoteView; seenAtMs: number; expired: boolean; now: number; onDone: () => void }

// The firm quote: a countdown bar that drains, the price, the cash, the fixed
// APY, then Accept / Reject. Accept settles both legs in one transaction.
function QuoteCard({ quote, seenAtMs, expired, now, onDone }: QuoteCardProps) {
  const accept = useAcceptQuote()
  const reject = useRejectQuote()
  const isBuy = quote.side === 'BuyPt'
  const share = expired ? 0 : quoteTimeLeftShare(quote.validUntil, seenAtMs, now)
  const secondsLeft = (Date.parse(quote.validUntil) - now) / 1000
  const hurry = !expired && secondsLeft <= HURRY_SECONDS

  function handleAccept() {
    accept.mutate(quote.quoteId, {
      onSuccess: () => {
        const verb = isBuy ? `Bought ${formatAmount(quote.ptAmount)} PT for` : `Sold ${formatAmount(quote.ptAmount)} PT for`
        toast.success(`${verb} ${formatAmount(quote.usdcAmount)} USDC, settled in one transaction.`)
        onDone()
      },
    })
  }

  function handleReject() {
    reject.mutate(quote.quoteId, { onSuccess: onDone })
  }

  return (
    <section aria-label="Firm quote" className="glass-strong overflow-hidden rounded-3xl">
      {/* The quote's remaining life, draining from full to empty. */}
      <div className="h-1 bg-foreground/8" aria-hidden>
        <div
          className={cn('h-full transition-[width] duration-500 ease-linear', hurry ? 'bg-warning' : 'bg-foreground/70')}
          style={{ width: `${share * 100}%` }}
        />
      </div>
      <div className="grid gap-4 p-5">
        <div className="flex items-center gap-2 text-sm">
          <LockIcon className="size-4 text-muted-foreground" aria-hidden />
          <span className="font-medium">Firm quote</span>
          <span className="text-muted-foreground">· only you and the dealer see it</span>
          <span className={cn('num ml-auto', hurry ? 'text-warning' : 'text-muted-foreground')} aria-live="off">
            {expired ? 'Expired' : formatSecondsLeft(quote.validUntil, now)}
          </span>
        </div>
        <p className="num">
          <span className="font-display text-[34px] leading-none">{formatAmount(quote.price, 6)}</span>
          <span className="ml-2 text-sm text-muted-foreground">USDC per PT</span>
        </p>
        <SummaryRows
          rows={[
            { label: isBuy ? 'You pay' : 'You get', value: `${formatAmount(quote.usdcAmount)} USDC`, tone: 'strong' },
            { label: isBuy ? 'You get' : 'You give', value: `${formatAmount(quote.ptAmount)} PT` },
            { label: 'Fixed APY', value: formatPercent(quote.fixedApyPercent), tone: 'strong' },
          ]}
        />
        <p className="text-xs text-muted-foreground">Both sides move in one ledger transaction, or nothing moves.</p>
        <FormError error={accept.error ?? reject.error} />
        {expired ? (
          <Button variant="glass" onClick={onDone}>
            Ask for a new quote
          </Button>
        ) : (
          <div className="flex gap-2">
            <Button variant="bright" size="lg" className="flex-1" onClick={handleAccept} disabled={accept.isPending || reject.isPending}>
              {accept.isPending ? 'Settling…' : 'Accept'}
            </Button>
            <Button variant="glass" size="lg" onClick={handleReject} disabled={accept.isPending || reject.isPending}>
              Reject
            </Button>
          </div>
        )}
      </div>
    </section>
  )
}
