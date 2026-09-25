// Which kind of token a symbol is, for the round badges (TokenIcon) and colours.
//   "PT-USYC-APR2027" -> "pt"   (principal: silver)
//   "YT-USYC-APR2027" -> "yt"   (yield: the yield blue)
//   "USYC"            -> "usyc" (the simulated fund share)
//   "USDC"            -> "usdc" (simulated cash; also the fallback)
export type TokenKind = 'pt' | 'yt' | 'usyc' | 'usdc'

export function tokenKindOf(symbol: string): TokenKind {
  if (symbol === 'PT' || symbol.startsWith('PT-')) return 'pt'
  if (symbol === 'YT' || symbol.startsWith('YT-')) return 'yt'
  if (symbol === 'USYC') return 'usyc'
  return 'usdc'
}

// "PT-USYC-APR2027" is long for a row on a phone: "PT". Other symbols stay.
export function shortSymbol(symbol: string): string {
  const kind = tokenKindOf(symbol)
  return kind === 'pt' ? 'PT' : kind === 'yt' ? 'YT' : symbol
}
