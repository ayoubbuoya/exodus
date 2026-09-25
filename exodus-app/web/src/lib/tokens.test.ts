// Unit tests for the token helpers (badges and short symbols).
import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { shortSymbol, tokenKindOf } from './tokens.ts'

describe('tokenKindOf', () => {
  it('tells PT, YT, USYC and USDC apart', () => {
    assert.equal(tokenKindOf('PT-USYC-APR2027'), 'pt')
    assert.equal(tokenKindOf('YT-USYC-APR2027'), 'yt')
    assert.equal(tokenKindOf('PT'), 'pt')
    assert.equal(tokenKindOf('USYC'), 'usyc')
    assert.equal(tokenKindOf('USDC'), 'usdc')
  })

  it('shows anything unknown like cash, never as PT or YT', () => {
    assert.equal(tokenKindOf('EURC'), 'usdc')
  })
})

describe('shortSymbol', () => {
  it('shortens only the market tokens', () => {
    assert.equal(shortSymbol('PT-USYC-APR2027'), 'PT')
    assert.equal(shortSymbol('YT-USYC-APR2027'), 'YT')
    assert.equal(shortSymbol('USYC'), 'USYC')
  })
})
