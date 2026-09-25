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
  kind: 'RECEIVED' | 'SENT' | 'SUBSCRIBED' | 'REDEEM_REQUESTED' | 'REDEEMED' | 'REDEEM_CANCELLED' | 'OTHER'
  at: string
  changes: Record<string, string> // { USDC: "-40.0000000000", USYC: "39.9201590000" }
}

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
