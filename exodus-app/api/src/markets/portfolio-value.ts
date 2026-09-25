// The USD value of a PT/YT position, for the portfolio page. Kept apart from
// NestJS so it is easy to read and to test.
//
// WE FOLLOW PENDLE: 1 PT + 1 YT together are worth 1 unit of the underlying
// (they can be merged back into it), so
//   YT price = 1 - PT price
// and the yield a YT has already earned (claimable) is counted on top.
//
// Example on Jan 1 (index 1.025), PT mid price 0.975, Bank holds 500 PT and
// 1000 YT with 24.390243 USYC claimable:
//   PT         500 * 0.975             = 487.50 USD
//   YT         1000 * (1 - 0.975)      =  25.00 USD
//   claimable  24.390243 USYC * 1.025  =  25.00 USD
//   total                              = 537.50 USD
// After maturity the PT price is 1 (it redeems for 1 USD of USYC) and a YT is
// only worth its last claim.
//
// Number maths is fine: the result is only displayed, never paid.

export type PositionValueInput = {
  ptAmount: string; // for example "500.0000000000"
  ytAmount: string;
  claimableUsyc: string; // yield the YT can claim now, in USYC
  index: string; // USYC price in USD, for example "1.0250000000"
  ptPrice: string; // the dealer's mid price before maturity, "1" after
};

export type PositionValue = {
  ptUsd: number;
  ytUsd: number;
  claimableUsd: number;
  totalUsd: number;
};

export function positionUsdValue(input: PositionValueInput): PositionValue {
  const ptPrice = Number(input.ptPrice);
  const ytPrice = Math.max(0, 1 - ptPrice);
  const ptUsd = toCents(Number(input.ptAmount) * ptPrice);
  const ytUsd = toCents(Number(input.ytAmount) * ytPrice);
  const claimableUsd = toCents(Number(input.claimableUsyc) * Number(input.index));
  return { ptUsd, ytUsd, claimableUsd, totalUsd: toCents(ptUsd + ytUsd + claimableUsd) };
}

function toCents(usd: number): number {
  return Math.round(usd * 100) / 100;
}
