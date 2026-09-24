// Who sees what in one private PT trade: the data behind the privacy section.
//
// The trade is step 2 of the worked example (docs/exodus.md §9): Alice buys
// 500 PT from Bank at 0.9750 through RFQ, and pays 487.50 USDC. It settles in
// one Quote_Accept transaction (atomic DvP).
//
// On Canton, each party's node only receives the parts of a transaction that
// party is entitled to see (its "projection"). The page shows the trade as
// three stacked plates, one per part, and each party's node holds only some:
//   - price and rate (the Quote): Alice and Bank only,
//   - the PT leg (a PrincipalToken, signed by the Operator): Alice, Bank, Operator,
//   - the cash leg (USDC holdings, signed by the USDC issuer): Alice, Bank, UsdcIssuer.
// These rules come from the privacy model in docs/exodus.md §10. The planned
// contract test checks the key one: Operator and UsdcIssuer see zero Quote contracts.
import { FIXED_APY_LABEL, QUOTE } from './demo-numbers.ts'

export type Seat = 'alice' | 'bank' | 'operator' | 'usdcIssuer'

export const SEATS: { seat: Seat; name: string; role: string }[] = [
  { seat: 'alice', name: 'Alice', role: 'Buyer · treasury desk' },
  { seat: 'bank', name: 'Bank', role: 'Dealer' },
  { seat: 'operator', name: 'Operator', role: 'Protocol · issues PT and YT' },
  { seat: 'usdcIssuer', name: 'USDC Issuer', role: 'Cash issuer (party UsdcIssuer)' },
]

/** Which plate image in public/privacy/ shows a part. */
export type PlateLayer = 'terms' | 'pt' | 'cash'

/** One part of the transaction, and the parties whose node stores it. */
export type TradePart = {
  layer: PlateLayer
  label: string
  value: string
  /** The contract that carries this part on the ledger. */
  contract: string
  visibleTo: Seat[]
}

/** Top to bottom, the same order as the plates in the stack. */
export const PARTS: TradePart[] = [
  {
    layer: 'terms',
    label: 'Price and rate',
    value: `${QUOTE.price} per PT · ${FIXED_APY_LABEL} fixed`,
    contract: 'Quote',
    visibleTo: ['alice', 'bank'],
  },
  {
    layer: 'pt',
    label: 'PT leg',
    value: `${QUOTE.pt}.00 PT · Bank → Alice`,
    contract: 'PrincipalToken, signed by the Operator',
    visibleTo: ['alice', 'bank', 'operator'],
  },
  {
    layer: 'cash',
    label: 'Cash leg',
    value: `${QUOTE.cash} USDC · Alice → Bank`,
    contract: 'USDC holdings, signed by the USDC issuer',
    visibleTo: ['alice', 'bank', 'usdcIssuer'],
  },
]

/** One sentence per seat, shown next to the stack. */
export const SEAT_NOTES: Record<Seat, string> = {
  alice: 'She asked for the quote and paid for it, so her node holds the whole trade.',
  bank: 'It quoted the price and delivered the PT, so its node holds the whole trade.',
  operator:
    'It signs every PT, so its node stores the PT moving from Bank to Alice. The price, the rate and the cash never reach it.',
  usdcIssuer:
    'It signs every USDC holding, so its node stores 487.50 USDC moving from Alice to Bank. It never learns what the cash paid for.',
}
