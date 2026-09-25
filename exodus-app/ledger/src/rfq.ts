// Private PT trading: request for quote (RFQ), then atomic delivery versus
// payment (DvP). The contracts are in Exodus.Rfq (spec sections 8.2 and 10).
//
// Example (spec section 9, step 2): Alice wants a fixed rate.
//   1. requestQuote   (Alice)  RfqRequest(BuyPt, 500 PT) to Bank
//   2. quoteRfq       (Bank)   Quote(price 0.975 -> 487.5 USDC, valid 60 s),
//                              500 of Bank's PT locked for Alice
//   3. acceptQuote    (Alice)  487.5 USDC -> Bank and 500 PT -> Alice, one transaction
//   or rejectQuote    (Alice)  the lock is released at once
//   withdrawExpiredQuotes (Bank, after expiry) removes the quote and unlocks the PT
//
// PRIVACY: only Alice and Bank see the RfqRequest and the Quote. Contracts
// one of them cannot see are read by a party that can and DISCLOSED to the
// command, never shown in a list:
//   - Bank's quote needs Alice's pass     -> read as the Operator (it signs every pass)
//   - Alice's accept needs Bank's pass    -> read as the Operator
//   - Alice's accept needs a price        -> read as the Operator (it observes prices)
//   - Alice selling needs Bank's USDC     -> read as UsdcIssuer (it signs every USDC holding)
import type { ContractId } from "@daml/types";
import { exerciseCommand, type LedgerClient, type LedgerCommand } from "./client.ts";
import { decimalToUnits } from "./decimal.ts";
import { pickInputs } from "./inputs.ts";
import { previewQuoteCash } from "./market-math.ts";
import {
  checkTokenAmount,
  hasReachedMaturity,
  requireMarket,
  requireMarketRate,
  requireOwnPass,
  withOneRetry,
} from "./markets.ts";
import { getClientAccess, getDisclosable, getOwnedHoldings, type Contract, type Disclosable } from "./queries.ts";
import { getPrincipalTokens, isFreePt } from "./tokens.ts";
import {
  Holding,
  PrincipalToken,
  Quote,
  RfqRequest,
  type ClientAccess,
  type RateIndex,
  type RfqSide,
} from "./templates.ts";

// How long a quote stays firm by default (decision R1: a short expiry).
export const DEFAULT_QUOTE_VALID_SECONDS = 60;

// Ledger time and this machine's clock can differ a little. We wait this long
// past validUntil before calling Quote_Withdraw / PT_Unlock, which the
// contract only allows once ledger time has reached validUntil.
const EXPIRY_MARGIN_MS = 2000;

// ---------------------------------------------------------------------------
// Reading
// ---------------------------------------------------------------------------

// The open RFQs `party` can see, oldest first.
//   As Alice (requester): the requests she sent that nobody answered yet.
//   As Bank (dealer):     the requests waiting for its quote.
export async function getRfqRequests(ledger: LedgerClient, party: string): Promise<Contract<RfqRequest>[]> {
  const events = await ledger.getActiveContracts(party, {
    TemplateFilter: { value: { templateId: RfqRequest.templateId } },
  });
  const requests = events.map((event) => ({
    contractId: event.contractId,
    payload: RfqRequest.decoder.runWithException(event.createArgument),
  }));
  requests.sort((a, b) => Date.parse(a.payload.requestedAt) - Date.parse(b.payload.requestedAt));
  return requests;
}

// The live quotes `party` is part of (as requester or dealer), soonest expiry first.
// Expired quotes stay on the ledger until the dealer withdraws them; check
// validUntil before showing an Accept button.
export async function getQuotes(ledger: LedgerClient, party: string): Promise<Contract<Quote>[]> {
  const events = await ledger.getActiveContracts(party, {
    TemplateFilter: { value: { templateId: Quote.templateId } },
  });
  const quotes = events.map((event) => ({
    contractId: event.contractId,
    payload: Quote.decoder.runWithException(event.createArgument),
  }));
  quotes.sort((a, b) => Date.parse(a.payload.validUntil) - Date.parse(b.payload.validUntil));
  return quotes;
}

// True while the quote can still be accepted, with a small safety margin
// because the command needs a moment to reach the ledger.
export function isQuoteLive(quote: Quote, marginMs = 2000, nowMs = Date.now()): boolean {
  return nowMs + marginMs < Date.parse(quote.validUntil);
}

// ---------------------------------------------------------------------------
// Requester side (Alice)
// ---------------------------------------------------------------------------

export type QuoteRequestInput = {
  requester: string; // full party id, for example "client-7f3a...::1220ab..."
  dealer: string; // who to ask, for example Bank (the house dealer, decision D2)
  operator: string; // the market's operator
  usdcIssuer: string; // the only USDC accepted as cash (decision R4)
  marketId: string; // for example "PT-USYC-APR2027"
  side: RfqSide; // "BuyPt" or "SellPt", from the requester's side
  ptAmount: string; // for example "500"
};

// Alice asks the dealer for a price. Nothing is locked yet; that happens
// when the dealer quotes.
export async function requestQuote(ledger: LedgerClient, input: QuoteRequestInput): Promise<void> {
  checkTokenAmount(input.ptAmount, "PT amount");
  if (input.requester === input.dealer) {
    throw new Error("You cannot ask yourself for a quote.");
  }

  const market = await requireMarket(ledger, input.operator, input.marketId);
  if (market.payload.matured) {
    throw new Error("This market has matured: PT trading is closed, redeem instead.");
  }
  const access = await requireOwnPass(ledger, input.requester, input.operator, "trade");
  // The dealer must be an approved client too (read as the Operator). The
  // contract checks it when the dealer quotes; we say it now.
  const dealerAccess = await getClientAccess(ledger, input.operator, input.dealer);
  if (dealerAccess === null) {
    throw new Error("This dealer is not an approved Exodus client.");
  }

  await ledger.create(input.requester, RfqRequest, {
    operator: input.operator,
    requester: input.requester,
    dealer: input.dealer,
    usdcIssuer: input.usdcIssuer,
    requesterAccessCid: access.contractId as ContractId<ClientAccess>,
    terms: market.payload.terms,
    side: input.side,
    ptAmount: input.ptAmount,
    // Only used to show and answer the oldest request first.
    requestedAt: new Date().toISOString(),
  });
}

// Alice withdraws a request the dealer has not answered yet.
export async function cancelRfq(ledger: LedgerClient, requester: string, rfqId: string): Promise<void> {
  const rfq = await requireRfq(ledger, requester, rfqId);
  if (rfq.payload.requester !== requester) {
    throw new Error("Only the requester can cancel this request.");
  }
  await ledger.exercise(requester, RfqRequest.Rfq_Cancel, rfq.contractId, {});
}

export type AcceptQuoteInput = {
  requester: string; // Alice
  quoteId: string; // the Quote's contract id
};

// Alice accepts: both legs move in ONE transaction, or nothing moves.
//   BuyPt:  Alice pays usdcAmount USDC, Bank's locked PT becomes Alice's.
//   SellPt: Alice's exact PT goes to Bank, Bank's set-aside USDC to Alice.
// Retries once on a stale contract (for example when Alice's USDC holding
// was spent a moment ago by another of her commands).
export async function acceptQuote(ledger: LedgerClient, input: AcceptQuoteInput): Promise<{ retried: boolean }> {
  return withOneRetry(() => acceptOnce(ledger, input));
}

async function acceptOnce(ledger: LedgerClient, input: AcceptQuoteInput): Promise<void> {
  const quote = await requireQuote(ledger, input.requester, input.quoteId);
  const { operator, dealer, usdcIssuer, terms, side } = quote.payload;
  if (quote.payload.requester !== input.requester) {
    throw new Error("Only the requester can accept this quote.");
  }
  if (!isQuoteLive(quote.payload)) {
    throw new Error("This quote has expired: ask for a new one.");
  }

  // 1. Both passes. Alice reads her own; Bank's is read by the Operator and
  //    must be the exact pass the quote names.
  const access = await requireOwnPass(ledger, input.requester, operator, "trade");
  const dealerAccess = await requirePassById(ledger, operator, dealer, quote.payload.dealerAccessCid, "dealer");

  // 2. A live price, only to prove the market has not reached maturity
  //    (PT trading stops at maturity, like Pendle).
  const rate = await requireMarketRate(ledger, operator, terms);
  if (hasReachedMaturity(rate.payload, terms)) {
    throw new Error("This market has reached its maturity date: PT trading is closed, redeem instead.");
  }

  const disclosedContracts = [dealerAccess.disclosure, rate.disclosure];
  let usdcCids: ContractId<Holding>[] = [];
  let ptCids: ContractId<PrincipalToken>[] = [];

  if (side === "BuyPt") {
    // 3a. Alice's USDC from the accepted issuer. The locked PT needs no
    //     disclosure: Alice is its lock holder, so she already sees it.
    const owned = await getOwnedHoldings(ledger, input.requester);
    const usdc = owned.filter(
      (holding) => holding.payload.instrumentId.id === "USDC" && holding.payload.instrumentId.admin === usdcIssuer,
    );
    usdcCids = pickInputs(usdc, quote.payload.usdcAmount, "USDC").map((input) => input.contractId as ContractId<Holding>);
  } else {
    // 3b. Alice's free PT of this market, and Bank's set-aside USDC, which
    //     only Bank and UsdcIssuer see (read as UsdcIssuer, disclosed).
    const pts = (await getPrincipalTokens(ledger, input.requester, terms.marketId)).filter(isFreePt);
    ptCids = pickInputs(pts, quote.payload.ptAmount, "PT").map((pt) => pt.contractId as ContractId<PrincipalToken>);
    const dealerUsdcCid = quote.payload.dealerUsdcCid;
    if (dealerUsdcCid === null) {
      throw new Error("This sell quote has no USDC set aside.");
    }
    const dealerUsdc = await findHoldingAsIssuer(ledger, usdcIssuer, dealerUsdcCid);
    if (dealerUsdc === null) {
      throw new Error("The dealer no longer has the USDC it set aside for this quote. Ask for a new quote.");
    }
    disclosedContracts.push(dealerUsdc.disclosure);
  }

  await ledger.exercise(
    input.requester,
    Quote.Quote_Accept,
    quote.contractId,
    {
      requesterAccessCid: access.contractId as ContractId<ClientAccess>,
      rateCid: rate.contractId as ContractId<RateIndex>,
      usdcCids,
      ptCids,
    },
    { disclosedContracts },
  );
}

// Alice says no. Before expiry, a buy quote's locked PT goes back to Bank at once.
export async function rejectQuote(ledger: LedgerClient, requester: string, quoteId: string): Promise<void> {
  const quote = await requireQuote(ledger, requester, quoteId);
  if (quote.payload.requester !== requester) {
    throw new Error("Only the requester can reject this quote.");
  }
  await ledger.exercise(requester, Quote.Quote_Reject, quote.contractId, {});
}

// ---------------------------------------------------------------------------
// Dealer side (Bank)
// ---------------------------------------------------------------------------

export type QuoteRfqInput = {
  dealer: string; // Bank
  rfqId: string; // the RfqRequest's contract id
  price: string; // USDC per PT, in (0, 1], for example "0.975"
  validForSeconds?: number; // default DEFAULT_QUOTE_VALID_SECONDS
};

// Bank answers a request with a firm price.
//   BuyPt  (Alice buys):  exactly ptAmount of Bank's free PT gets locked for Alice.
//   SellPt (Alice sells): exactly roundDown6 (price * ptAmount) of Bank's USDC is set aside.
// Example: 500 PT at "0.975" -> Quote(usdcAmount 487.5, valid for 60 s).
export async function quoteRfq(ledger: LedgerClient, input: QuoteRfqInput): Promise<void> {
  const price = decimalToUnits(input.price);
  if (price === 0n || price > decimalToUnits("1")) {
    throw new Error("The price must be greater than 0 and at most 1 (a PT never costs more than 1 USD).");
  }
  const validForSeconds = input.validForSeconds ?? DEFAULT_QUOTE_VALID_SECONDS;
  if (validForSeconds <= 0) {
    throw new Error("validForSeconds must be greater than 0");
  }

  const rfq = await requireRfq(ledger, input.dealer, input.rfqId);
  const { operator, requester, usdcIssuer, terms, side, ptAmount } = rfq.payload;
  if (rfq.payload.dealer !== input.dealer) {
    throw new Error("This request was sent to another dealer.");
  }

  // 1. Both passes: the dealer's own, and Alice's (read by the Operator,
  //    disclosed; it must be the exact pass her request names).
  const dealerAccess = await requireOwnPass(ledger, input.dealer, operator, "quote");
  const requesterAccess = await requirePassById(ledger, operator, requester, rfq.payload.requesterAccessCid, "requester");

  // 2. What the dealer puts aside.
  let dealerPtCids: ContractId<PrincipalToken>[] = [];
  let dealerUsdcCids: ContractId<Holding>[] = [];
  if (side === "BuyPt") {
    const pts = (await getPrincipalTokens(ledger, input.dealer, terms.marketId)).filter(isFreePt);
    dealerPtCids = pickInputs(pts, ptAmount, "free PT").map((pt) => pt.contractId as ContractId<PrincipalToken>);
  } else {
    const owned = await getOwnedHoldings(ledger, input.dealer);
    const usdc = owned.filter(
      (holding) => holding.payload.instrumentId.id === "USDC" && holding.payload.instrumentId.admin === usdcIssuer,
    );
    const cash = previewQuoteCash(input.price, ptAmount);
    dealerUsdcCids = pickInputs(usdc, cash, "USDC").map((holding) => holding.contractId as ContractId<Holding>);
  }

  // 3. validUntil uses this machine's clock; the contract checks it is in
  //    the future in LEDGER time.
  const validUntil = new Date(Date.now() + validForSeconds * 1000).toISOString();
  await ledger.exercise(
    input.dealer,
    RfqRequest.Rfq_Quote,
    rfq.contractId,
    {
      price: input.price,
      validUntil,
      dealerAccessCid: dealerAccess.contractId as ContractId<ClientAccess>,
      dealerPtCids,
      dealerUsdcCids,
    },
    { disclosedContracts: [requesterAccess.disclosure] },
  );
}

// Bank does not want to quote (for example the size is over its limit).
export async function declineRfq(ledger: LedgerClient, dealer: string, rfqId: string): Promise<void> {
  const rfq = await requireRfq(ledger, dealer, rfqId);
  if (rfq.payload.dealer !== dealer) {
    throw new Error("This request was sent to another dealer.");
  }
  await ledger.exercise(dealer, RfqRequest.Rfq_Decline, rfq.contractId, {});
}

export type WithdrawReport = {
  withdrawnQuotes: number; // expired quotes removed
  unlockedPts: number; // PT pieces unlocked
};

// Cleans up after expired quotes, for the dealer bot:
//   1. Each expired quote is withdrawn, and its locked PT unlocked, in ONE
//      transaction (so a crash between the two can never leave a quote-less lock).
//   2. Any other PT whose lock has run out is unlocked too. Example: Alice
//      rejected AFTER expiry, which removes the quote but leaves the lock
//      (the lock had already run out, so the contract lets Bank unlock it).
export async function withdrawExpiredQuotes(ledger: LedgerClient, dealer: string, nowMs = Date.now()): Promise<WithdrawReport> {
  const report: WithdrawReport = { withdrawnQuotes: 0, unlockedPts: 0 };
  const isOver = (time: string) => Date.parse(time) + EXPIRY_MARGIN_MS <= nowMs;

  // 1. Expired quotes of this dealer.
  const quotes = (await getQuotes(ledger, dealer)).filter(
    (quote) => quote.payload.dealer === dealer && isOver(quote.payload.validUntil),
  );
  const handledPtIds = new Set<string>();
  for (const quote of quotes) {
    const commands: LedgerCommand[] = [exerciseCommand(Quote.Quote_Withdraw, quote.contractId, {})];
    const lockedPtCid = quote.payload.lockedPtCid;
    if (lockedPtCid !== null) {
      commands.push(exerciseCommand(PrincipalToken.PT_Unlock, lockedPtCid, {}));
      handledPtIds.add(lockedPtCid);
      report.unlockedPts += 1;
    }
    await ledger.submitCommands(dealer, commands);
    report.withdrawnQuotes += 1;
  }

  // 2. Other PT with a lock that has run out.
  const pts = await getPrincipalTokens(ledger, dealer);
  const stale = pts.filter(
    (pt) => pt.payload.lock !== null && isOver(pt.payload.lock.lockedUntil) && !handledPtIds.has(pt.contractId),
  );
  if (stale.length > 0) {
    await ledger.submitCommands(
      dealer,
      stale.map((pt) => exerciseCommand(PrincipalToken.PT_Unlock, pt.contractId, {})),
    );
    report.unlockedPts += stale.length;
  }
  return report;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

async function requireRfq(ledger: LedgerClient, party: string, rfqId: string): Promise<Contract<RfqRequest>> {
  const rfq = (await getRfqRequests(ledger, party)).find((candidate) => candidate.contractId === rfqId);
  if (rfq === undefined) {
    throw new Error("No open request with this id. It may already be quoted, declined or cancelled.");
  }
  return rfq;
}

async function requireQuote(ledger: LedgerClient, party: string, quoteId: string): Promise<Contract<Quote>> {
  const quote = (await getQuotes(ledger, party)).find((candidate) => candidate.contractId === quoteId);
  if (quote === undefined) {
    throw new Error("No live quote with this id. It may already be accepted, rejected or withdrawn.");
  }
  return quote;
}

// The pass of `client` read by the Operator, which must be exactly `expectedId`
// (the pass named in the request or quote). If the admin revoked and
// re-approved the client meanwhile, the ids differ and the contract would fail
// anyway, so we say it clearly.
async function requirePassById(
  ledger: LedgerClient,
  operator: string,
  client: string,
  expectedId: string,
  role: string,
): Promise<Disclosable<ClientAccess>> {
  const pass = await getClientAccess(ledger, operator, client);
  if (pass === null || pass.contractId !== expectedId) {
    throw new Error(`The ${role}'s access pass has changed or was revoked. Ask for a new quote.`);
  }
  return pass;
}

// One USDC (or USYC) holding by id, read by its issuer so it can be disclosed.
async function findHoldingAsIssuer(
  ledger: LedgerClient,
  issuer: string,
  holdingId: string,
): Promise<Disclosable<Holding> | null> {
  const holdings = await getDisclosable(ledger, issuer, Holding);
  return holdings.find((holding) => holding.contractId === holdingId) ?? null;
}
