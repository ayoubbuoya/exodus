// How the house dealer (Bank) prices PT, kept apart from NestJS so it is easy
// to read and to test.
//
// WE FOLLOW PENDLE. Pendle's market prices PT from an implied APY:
//   PT price = 1 / (1 + APY)^years
// and charges its swap fee as a RATE (lnFeeRateRoot in MarketMathCore.sol):
// a PT buyer gets the implied APY minus the fee, a seller plus the fee. Our
// dealer does the same with a spread in APY points. Example with 182 days
// left (0.4986 years), target 5.2 %, spread 0.10 %:
//
//   Alice buys PT  at 5.1 %  -> 1 / 1.051^0.4986 = 0.97550216 -> 0.975503 (rounded UP)
//   mid            at 5.2 %  -> 0.975039
//   Alice sells PT at 5.3 %  -> 1 / 1.053^0.4986 = 0.97457785 -> 0.974577 (rounded DOWN)
//
// Rounding always goes in the dealer's favour (like Pendle rounds in the
// protocol's favour), so the spread never shrinks by rounding.
//
// WHERE THE TARGET COMES FROM (decision 2B, Phase 6): like Pendle's implied
// rate follows what traders expect from the underlying, our target is the
// underlying's 30-day APY plus an offset the admin sets. Until there is enough
// history (7 demo days), a fallback of 5.2 % is used.
//
// Number maths is fine here: the result is a quoted price that both sides
// see before they agree; the cash amount itself is computed exactly on the
// ledger (roundDown6 (price * ptAmount)).
import { fixedApyFromPrice, priceForApy, type RfqSide } from "@exodus/ledger";

// The admin's settings that shape the price, all in percent (5.2 means 5.2 %).
export type DealerRateSettings = {
  apyOffsetPercent: number;
  fallbackApyPercent: number;
  spreadPercent: number;
};

export type DealerPrices = {
  targetApyPercent: number; // for example 5.2
  midPrice: string; // at the target APY; used to value PT and YT
  askPrice: string; // the client BUYS PT at this price (the dealer sells)
  bidPrice: string; // the client SELLS PT at this price (the dealer buys)
  // The fixed APY each side locks in, in percent with 2 decimals; null at maturity.
  askFixedApyPercent: number | null;
  bidFixedApyPercent: number | null;
};

const PRICE_DECIMALS = 6;
const PRICE_STEP = 10 ** PRICE_DECIMALS;
// The smallest price the ledger accepts (Rfq_Quote needs price > 0).
const MIN_PRICE = 1 / PRICE_STEP;

// The target APY in percent: underlying + offset, or the fallback without history.
// Examples: (10.29, offset -0.5) -> 9.79; (null, fallback 5.2) -> 5.2.
export function targetApyPercent(underlyingApyPercent: number | null, settings: DealerRateSettings): number {
  if (underlyingApyPercent === null) {
    return settings.fallbackApyPercent;
  }
  return underlyingApyPercent + settings.apyOffsetPercent;
}

// The dealer's prices for one market, `years` before maturity.
export function dealerPrices(targetPercent: number, spreadPercent: number, years: number): DealerPrices {
  // At or after maturity a PT is worth exactly 1 USD, and nobody trades it.
  if (years <= 0) {
    return {
      targetApyPercent: targetPercent,
      midPrice: "1.000000",
      askPrice: "1.000000",
      bidPrice: "1.000000",
      askFixedApyPercent: null,
      bidFixedApyPercent: null,
    };
  }
  const target = targetPercent / 100;
  const spread = spreadPercent / 100;
  // A buyer's rate below 0 % would mean a price above 1; a PT never costs more than 1 USD.
  const askPrice = clampPrice(roundUp6(priceForApy(Math.max(0, target - spread), years)));
  const bidPrice = clampPrice(roundDown6(priceForApy(target + spread, years)));
  return {
    targetApyPercent: targetPercent,
    midPrice: clampPrice(roundDown6(priceForApy(Math.max(0, target), years))),
    askPrice,
    bidPrice,
    askFixedApyPercent: fixedApyPercent(askPrice, years),
    bidFixedApyPercent: fixedApyPercent(bidPrice, years),
  };
}

// The price for one RFQ side (from the CLIENT's side, as in the contract):
//   BuyPt  -> askPrice (Alice buys, Bank sells)
//   SellPt -> bidPrice (Alice sells, Bank buys)
export function priceForSide(prices: DealerPrices, side: RfqSide): string {
  return side === "BuyPt" ? prices.askPrice : prices.bidPrice;
}

// The fixed APY of a price, in percent with 2 decimals, or null at maturity.
// Example: fixedApyPercent("0.975", 0.5) -> 5.19.
export function fixedApyPercent(price: string, years: number): number | null {
  if (years <= 0) {
    return null;
  }
  return Math.round(fixedApyFromPrice(Number(price), years) * 10_000) / 100;
}

// 0.97550216... -> "0.975503". The tiny subtraction keeps float noise such as
// 975000.0000000001 from rounding up to 975001.
function roundUp6(price: number): number {
  return Math.ceil(price * PRICE_STEP - 1e-6) / PRICE_STEP;
}

function roundDown6(price: number): number {
  return Math.floor(price * PRICE_STEP + 1e-6) / PRICE_STEP;
}

// Keeps a price inside (0, 1] and writes it with 6 decimals, like the ledger wants.
function clampPrice(price: number): string {
  return Math.min(1, Math.max(MIN_PRICE, price)).toFixed(PRICE_DECIMALS);
}
