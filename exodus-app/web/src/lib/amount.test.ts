// Unit tests for the amount helpers of the dashboard forms (run: npm test -w @exodus/web).
import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { isPositiveAmount, previewUsyc, trimZeros } from './amount.ts'

describe('isPositiveAmount', () => {
  it('accepts what the API accepts', () => {
    assert.equal(isPositiveAmount('100'), true)
    assert.equal(isPositiveAmount('12.5'), true)
    assert.equal(isPositiveAmount('0.0000000001'), true)
  })

  it('refuses half-typed or invalid input', () => {
    for (const text of ['', '0', '0.00', '5.', '.5', '-1', '1e3', '1.12345678901']) {
      assert.equal(isPositiveAmount(text), false, `"${text}" should be refused`)
    }
  })
})

describe('previewUsyc', () => {
  it('divides and rounds down to 6 decimals, like the fund contract', () => {
    // Spec example: 500 USDC at 1.025 -> 487.804878 USYC.
    assert.equal(previewUsyc('500', '1.025'), '487.8048780000')
  })

  it('shows nothing while the amount is not valid yet', () => {
    assert.equal(previewUsyc('5.', '1.025'), null)
  })
})

describe('trimZeros', () => {
  it('turns a ledger decimal into what a person would type', () => {
    assert.equal(trimZeros('60.0000000000'), '60')
    assert.equal(trimZeros('12.5000000000'), '12.5')
    assert.equal(trimZeros('100'), '100')
  })
})
