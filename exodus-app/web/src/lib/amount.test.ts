// Unit tests for the amount helpers of the dashboard forms (run: npm test -w @exodus/web).
import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { isPositiveAmount, isUsycAmount, previewUsdc, previewUsyc, trimZeros } from './amount.ts'

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

describe('isUsycAmount', () => {
  it('accepts at most 6 decimals, like a holding', () => {
    assert.equal(isUsycAmount('100'), true)
    assert.equal(isUsycAmount('0.000001'), true)
    assert.equal(isUsycAmount('0.0000001'), false)
    assert.equal(isUsycAmount('0'), false)
  })
})

describe('previewUsdc', () => {
  it('multiplies and rounds down to 6 decimals, like the redeem contract', () => {
    // Alice redeems 100 USYC at 1.03 -> 103 USDC.
    assert.equal(previewUsdc('100', '1.03'), '103.0000000000')
    // 487.804878 * 1.025 = 499.99999995 -> 499.999999 (never rounded up).
    assert.equal(previewUsdc('487.804878', '1.025'), '499.9999990000')
  })

  it('shows nothing for an amount the contract would refuse', () => {
    assert.equal(previewUsdc('0.0000001', '1.03'), null)
  })
})

describe('trimZeros', () => {
  it('turns a ledger decimal into what a person would type', () => {
    assert.equal(trimZeros('60.0000000000'), '60')
    assert.equal(trimZeros('12.5000000000'), '12.5')
    assert.equal(trimZeros('100'), '100')
  })
})
