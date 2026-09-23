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
