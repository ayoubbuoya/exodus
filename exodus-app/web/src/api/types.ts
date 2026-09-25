// The shapes the backend returns, written by hand to match exodus-app/api.
// (Dates arrive as ISO strings, for example "2026-09-23T11:49:36.029Z".)
// If you change a response in the API, change it here too.

export type Role = 'CLIENT' | 'ADMIN'

// PENDING: waiting for an admin. APPROVED: wallet created. REJECTED: may apply again.
export type ApplicationStatus = 'PENDING' | 'APPROVED' | 'REJECTED'

export type AuthUser = {
  id: string
  email: string
  role: Role
}

// GET /api/auth/me: who is logged in and how far they are in onboarding.
export type Profile = AuthUser & {
  application: {
    status: ApplicationStatus
    fullName: string
    country: string
    rejectionReason: string | null
    createdAt: string
  } | null
  // Set once an admin approved the application, for example { partyId: "client-bea33f0558af::1220..." }.
  wallet: { partyId: string } | null
}

// What the client sends in the access form.
export type ApplicationForm = {
  fullName: string
  country: string // ISO code, for example "FR"
  acceptsSimulatedTokens: boolean
}

// One row of the admin's review table.
export type ApplicationForReview = {
  id: string
  fullName: string
  country: string
  acceptedSimulationTerms: boolean
  status: ApplicationStatus
  rejectionReason: string | null
  reviewedAt: string | null
  createdAt: string
  user: {
    id: string
    email: string
    wallet: { partyId: string } | null
  }
}

// A page of a list, for example { items: [...20], total: 45, page: 1, limit: 20, totalPages: 3 }.
export type Page<T> = {
  items: T[]
  total: number
  page: number
  limit: number
  totalPages: number
}

// ---------------------------------------------------------------------------
// Dashboard (/app)
// ---------------------------------------------------------------------------

// GET /api/prices/usyc/latest: the price strip.
export type LatestPrice = {
  index: string // for example "1.0125000000" (USD per USYC)
  simTime: string // the demo date of this price
  publishedAt: string
  validUntil: string
  // false = the oracle bot is stopped and Subscribe would fail ("No valid USYC price").
  isLive: boolean
  daysToMaturity: number
  apy30dPercent: number | null // 10.31 means 10.31 %
}

// GET /api/prices/usyc: one point of the chart.
export type PricePoint = {
  index: string
  simTime: string
  publishedAt: string
}

// GET /api/wallet
export type WalletOverview = {
  partyId: string
  balances: Record<string, string> // { USDC: "60.0000000000", USYC: "30.0000000000" }
  holdings: { contractId: string; instrument: string; amount: string }[]
  nextFaucetClaimAt: string | null // null = the faucet can be used now
}

export type Instrument = 'USYC' | 'USDC'

// GET /api/wallet/activity: one token movement, rebuilt from the ledger history.
export type ActivityRow = {
  updateId: string
  kind: ActivityKind
  at: string
  // { USDC: "-40.0000000000", USYC: "39.9201590000" }, or with market tokens:
  // { USYC: "-30", "PT-USYC-APR2027": "30", "YT-USYC-APR2027": "30" }
  changes: Record<string, string>
}

export type ActivityKind =
  // The USYC fund (the simulated on-ramp).
  | 'RECEIVED'
  | 'SENT'
  | 'SUBSCRIBED'
  | 'REDEEM_REQUESTED'
  | 'REDEEMED'
  | 'REDEEM_CANCELLED'
  // The markets (PT and YT). Payouts show once the Operator has paid them.
  | 'SPLIT'
  | 'BOUGHT_PT'
  | 'SOLD_PT'
  | 'CLAIMED'
  | 'REDEEMED_PT'
  | 'MERGED'
  | 'OTHER'

export type FaucetClaimResult = {
  amount: string
  instrument: 'USDC'
  nextClaimAt: string
}

export type TransferRequest = {
  receiverPartyId: string
  instrument: Instrument
  amount: string
}

// GET /api/wallet/redemptions: one redeem request the fund has not paid yet.
// The USYC is already burned; the USDC arrives when the fund settles.
export type OpenRedemption = {
  requestId: string // a ledger contract id, for example "00d1..."
  usycAmount: string // for example "100.0000000000"
  requestedAt: string
}

// ---------------------------------------------------------------------------
// Markets (the Pendle part): /markets, /portfolio, /quote-requests, /quotes, /dealer
// ---------------------------------------------------------------------------

// From the client's side, the same words as the Daml contract:
// BuyPt = I buy PT and pay USDC; SellPt = I sell PT and get USDC.
export type RfqSide = 'BuyPt' | 'SellPt'

// The house dealer's prices for one market. Prices are USDC per PT with 6
// decimals; APYs are percent (5.1 means 5.1 %), null at maturity.
export type DealerPrices = {
  targetApyPercent: number
  midPrice: string
  askPrice: string // you BUY PT at this price
  bidPrice: string // you SELL PT at this price
  askFixedApyPercent: number | null
  bidFixedApyPercent: number | null
}

// GET /api/markets: one market card.
export type MarketView = {
  marketId: string // for example "PT-USYC-APR2027"
  symbols: { pt: string; yt: string }
  instrument: string // "USYC" (simulated)
  maturity: string // on the demo clock
  daysToMaturity: number
  matured: boolean
  maturityIndex: string | null // the frozen index once matured
  currentIndex: string
  priceIsLive: boolean
  underlyingApyPercent: number | null
  indicative: DealerPrices | null // null once PT trading has closed (maturity)
  dealerAutoQuote: boolean
}

export type MarketRequestKind = 'CLAIM' | 'PT_REDEEM' | 'MERGE'

// GET /api/portfolio
export type PortfolioPosition = {
  marketId: string
  symbols: { pt: string; yt: string }
  matured: boolean
  ptTotal: string
  ptLocked: string // a dealer's PT reserved for a live quote
  ptFree: string
  ytTotal: string
  ytPieces: { amount: string; lastIndex: string }[]
  claimableUsyc: string
  index: string
  ptPrice: string
  value: { ptUsd: number; ytUsd: number; claimableUsd: number; totalUsd: number }
}

export type OpenMarketRequest = {
  requestId: string
  kind: MarketRequestKind
  marketId: string
  amount: string
  estimatedUsyc: string
  requestedAt: string
}

export type Portfolio = {
  positions: PortfolioPosition[]
  openRequests: OpenMarketRequest[]
  totalUsd: number
}

// GET /api/quote-requests: a request the dealer has not answered yet.
export type QuoteRequestView = {
  requestId: string
  marketId: string
  side: RfqSide
  ptAmount: string
  requestedAt: string
}

// GET /api/quotes: a firm, private quote.
export type QuoteView = {
  quoteId: string
  marketId: string
  side: RfqSide
  ptAmount: string
  price: string // USDC per PT, for example "0.9755030000"
  usdcAmount: string // what changes hands, for example "19.5100600000"
  validUntil: string
  isLive: boolean
  fixedApyPercent: number | null
}

// GET /api/dealer/quote-requests (admins)
export type DealerRequestView = QuoteRequestView & {
  requester: string
  suggestedPrice: string | null
  suggestedFixedApyPercent: number | null
}

// GET /api/dealer/position (admins): the house dealer Bank's inventory.
export type DealerPosition = {
  markets: {
    marketId: string
    ptTotal: string
    ptLocked: string
    ptFree: string
    ytTotal: string
    claimableUsyc: string | null
  }[]
  usdc: string
  usdcSetAside: string
  usyc: string
  liveQuotes: (QuoteView & { requester: string })[]
}

// GET / PUT /api/dealer/settings (admins). Percentages: 5.2 means 5.2 %.
export type DealerSettings = {
  autoQuote: boolean
  apyOffsetPercent: number
  fallbackApyPercent: number
  spreadPercent: number
  maxPtPerQuote: string
  quoteValidSeconds: number
}
