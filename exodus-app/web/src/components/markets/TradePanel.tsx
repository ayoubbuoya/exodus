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
import { LoaderCircleIcon, LockIcon } from 'lucide-react'
import { formatAmount, previewQuoteCash } from '@exodus/ledger'
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
import { FormError } from '@/components/FormError'
import { Button } from '@/components/ui/button'
import { Field, FieldDescription, FieldError, FieldGroup, FieldLabel } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { isTokenAmount, trimZeros } from '@/lib/amount'
import { formatPercent } from '@/lib/format'
import { findAnsweringQuote, formatSecondsLeft, quoteFlowStatus, type QuoteFlowStatus } from '@/lib/markets'
import { useNow } from '@/useNow'

// One "Get firm quote" click: what was asked, and when.
type Ask = { side: RfqSide; ptAmount: string; askedAtMs: number }

// A request is "ours" if it was sent around the time we asked (the server
// stamps requestedAt with its own clock, a few ms after our click).
const REQUEST_MATCH_MARGIN_MS = 5000

export function TradePanel({ market }: { market: MarketView }) {
  const [side, setSide] = useState<RfqSide>('BuyPt')
  const [ptAmount, setPtAmount] = useState('')
  const [ask, setAsk] = useState<Ask | null>(null)
  // The quote that answered our ask. Kept after it leaves the ledger (accepted,
  // or withdrawn after expiry) so the screen does not flicker to "declined".
  const [seenQuote, setSeenQuote] = useState<QuoteView | null>(null)
  const now = useNow(500)

  const watching = ask !== null && seenQuote === null
  const quoteRequests = useQuoteRequests(watching)
  const quotes = useQuotes(watching)
  const requestQuote = useRequestQuote()

  // Remember the answering quote the first time it shows up. Setting state
  // while rendering is React's documented way to adjust state from new data.
  const answering = ask === null ? null : findAnsweringQuote(quotes.data?.items ?? [], { marketId: market.marketId, ...ask })
  if (answering !== null && seenQuote === null) {
    setSeenQuote(answering)
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
    requestQuote.mutate(
      { marketId: market.marketId, side, ptAmount },
      { onSuccess: () => setAsk({ side, ptAmount, askedAtMs }) },
    )
  }

  const tradingClosed = market.indicative === null
  const busy = status === 'waiting' || status === 'quoted'
  return (
    <div className="flex flex-col gap-6">
      <form onSubmit={handleAsk}>
        <FieldGroup>
          <Tabs value={side} onValueChange={(value) => handleSideChange(value as RfqSide)}>
            <TabsList className="w-full" aria-label="Buy or sell PT">
              <TabsTrigger value="BuyPt" disabled={busy}>Buy PT</TabsTrigger>
              <TabsTrigger value="SellPt" disabled={busy}>Sell PT</TabsTrigger>
            </TabsList>
          </Tabs>
          <AmountField
            market={market}
            side={side}
            ptAmount={ptAmount}
            onChange={setPtAmount}
            error={fieldErrorOf(requestQuote.error, 'ptAmount')}
            disabled={busy}
          />
          <FormError error={requestQuote.error} />
          {tradingClosed && (
            <p className="text-sm text-muted-foreground">PT trading closed at maturity. Redeem your PT in the "At maturity" tab.</p>
          )}
          <Button
            type="submit"
            size="lg"
            disabled={tradingClosed || busy || !isTokenAmount(ptAmount) || requestQuote.isPending}
          >
            {requestQuote.isPending ? 'Sending…' : 'Get firm quote'}
          </Button>
        </FieldGroup>
      </form>

      <QuoteStatus status={status} quote={seenQuote} market={market} now={now} onDone={startOver} />

      <p className="flex items-start gap-2 text-xs text-muted-foreground">
        <LockIcon className="mt-0.5 size-3.5 shrink-0" aria-hidden />
        Private: only you and the dealer see the request and the price. The Operator moves the PT but never sees what
        you paid.
      </p>
    </div>
  )
}

type AmountFieldProps = {
  market: MarketView
  side: RfqSide
  ptAmount: string
  onChange: (value: string) => void
  error: string | undefined
  disabled: boolean
}

// The PT amount, with what you have and the dealer's indicative price.
// Example (buy 20 PT on Oct 1): "Indicative 0.975503 USDC per PT: about 19.51 USDC, 5.10 % fixed."
function AmountField({ market, side, ptAmount, onChange, error, disabled }: AmountFieldProps) {
  const wallet = useWallet()
  const portfolio = usePortfolio()
  const position = portfolio.data?.positions.find((candidate) => candidate.marketId === market.marketId)
  const freePt = position?.ptFree ?? '0'
  const usdcBalance = wallet.data?.balances.USDC ?? '0'

  const price = side === 'BuyPt' ? market.indicative?.askPrice : market.indicative?.bidPrice
  const fixedApy = side === 'BuyPt' ? market.indicative?.askFixedApyPercent : market.indicative?.bidFixedApyPercent
  const cash = price !== undefined && isTokenAmount(ptAmount) ? previewQuoteCash(price, ptAmount) : null

  return (
    <Field data-invalid={error !== undefined}>
      <div className="flex items-center justify-between">
        <FieldLabel htmlFor="trade-amount">{side === 'BuyPt' ? 'PT to buy' : 'PT to sell'}</FieldLabel>
        {side === 'SellPt' ? (
          <button type="button" className="text-xs text-primary hover:underline" onClick={() => onChange(trimZeros(freePt))}>
            Max: <span className="num">{formatAmount(freePt)} PT</span>
          </button>
        ) : (
          <span className="text-xs text-muted-foreground">
            You have <span className="num">{formatAmount(usdcBalance)} USDC</span>
          </span>
        )}
      </div>
      <Input
        id="trade-amount"
        className="num text-lg"
        inputMode="decimal"
        placeholder="0.00"
        autoComplete="off"
        value={ptAmount}
        disabled={disabled}
        onChange={(event) => onChange(event.target.value.trim())}
        aria-invalid={error !== undefined}
      />
      <FieldDescription>
        {price === undefined ? (
          'Each PT pays 1 USD of USYC at maturity.'
        ) : (
          <>
            Indicative <span className="num text-foreground">{formatAmount(price, 6)} USDC</span> per PT
            {cash !== null && (
              <>
                : {side === 'BuyPt' ? 'you pay' : 'you get'} about{' '}
                <span className="num text-foreground">{formatAmount(cash)} USDC</span>
              </>
            )}
            , <span className="num text-primary">{formatPercent(fixedApy ?? null)}</span> fixed. Each PT pays 1 USD of
            USYC at maturity. The firm quote may differ a little.
          </>
        )}
      </FieldDescription>
      {error !== undefined && <FieldError>{error}</FieldError>}
    </Field>
  )
}

type QuoteStatusProps = {
  status: QuoteFlowStatus
  quote: QuoteView | null
  market: MarketView
  now: number
  onDone: () => void
}

// What happens after "Get firm quote": waiting, the quote, expired or declined.
function QuoteStatus({ status, quote, market, now, onDone }: QuoteStatusProps) {
  if (status === 'idle') {
    return null
  }
  if (status === 'waiting') {
    return (
      <div role="status" className="flex items-center gap-2 rounded-md border p-4 text-sm">
        <LoaderCircleIcon className="size-4 animate-spin text-primary" aria-hidden />
        The house dealer is pricing your request…
        {!market.dealerAutoQuote && <span className="text-muted-foreground">(quotes are manual right now)</span>}
      </div>
    )
  }
  if (status === 'declined') {
    return (
      <div role="status" className="flex flex-col gap-3 rounded-md border border-warning/40 p-4 text-sm">
        <p>
          The dealer declined this request. It may be above the dealer's size limit, or the dealer does not have
          enough PT or USDC right now. Try a smaller amount.
        </p>
        <Button variant="outline" size="sm" className="self-start" onClick={onDone}>
          Ask again
        </Button>
      </div>
    )
  }
  if (quote === null) {
    return null
  }
  return <QuoteBox quote={quote} expired={status === 'expired'} now={now} onDone={onDone} />
}

// The firm quote: price, cash, fixed APY, countdown, Accept / Reject.
function QuoteBox({ quote, expired, now, onDone }: { quote: QuoteView; expired: boolean; now: number; onDone: () => void }) {
  const accept = useAcceptQuote()
  const reject = useRejectQuote()
  const isBuy = quote.side === 'BuyPt'

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
    <section aria-label="Firm quote" className="flex flex-col gap-3 rounded-md border border-primary/40 p-4">
      <div className="flex items-center justify-between text-sm">
        <span className="font-medium">Firm quote from the house dealer</span>
        <span className="num text-muted-foreground" aria-live="off">
          {expired ? 'Expired' : `Valid ${formatSecondsLeft(quote.validUntil, now)}`}
        </span>
      </div>
      <dl className="grid grid-cols-3 gap-2 text-sm">
        <div>
          <dt className="text-xs text-muted-foreground">Price</dt>
          <dd className="num">{formatAmount(quote.price, 6)}</dd>
        </div>
        <div>
          <dt className="text-xs text-muted-foreground">{isBuy ? 'You pay' : 'You get'}</dt>
          <dd className="num">{formatAmount(quote.usdcAmount)} USDC</dd>
        </div>
        <div>
          <dt className="text-xs text-muted-foreground">Fixed APY</dt>
          <dd className="num text-primary">{formatPercent(quote.fixedApyPercent)}</dd>
        </div>
      </dl>
      <p className="text-xs text-muted-foreground">
        {isBuy ? 'You get' : 'You give'} <span className="num">{formatAmount(quote.ptAmount)} PT</span>. Both sides move
        in one ledger transaction, or nothing moves.
      </p>
      <FormError error={accept.error ?? reject.error} />
      {expired ? (
        <Button variant="outline" onClick={onDone}>
          Ask for a new quote
        </Button>
      ) : (
        <div className="flex gap-2">
          <Button className="flex-1" onClick={handleAccept} disabled={accept.isPending || reject.isPending}>
            {accept.isPending ? 'Settling…' : 'Accept'}
          </Button>
          <Button variant="outline" onClick={handleReject} disabled={accept.isPending || reject.isPending}>
            Reject
          </Button>
        </div>
      )}
    </section>
  )
}
