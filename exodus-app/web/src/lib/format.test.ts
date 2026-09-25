// Unit tests for the dashboard's display helpers.
import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { formatCountdown, formatDemoDate, formatPercent, formatSignedAmount } from './format.ts'

describe('formatDemoDate', () => {
  it('formats in UTC, so midnight demo dates never show the day before', () => {
    assert.equal(formatDemoDate('2026-11-15T00:00:00Z'), 'Nov 15, 2026')
  })
})

describe('formatCountdown', () => {
  it('shows hours:minutes:seconds', () => {
    assert.equal(formatCountdown(23 * 3600 + 59 * 60 + 12), '23:59:12')
  })

  it('never goes below zero', () => {
    assert.equal(formatCountdown(-5), '00:00:00')
  })
})

describe('formatSignedAmount', () => {
  it('adds a sign and the token', () => {
    const plain = (value: string) => value
    assert.equal(formatSignedAmount('100', 'USDC', plain), '+100 USDC')
    assert.equal(formatSignedAmount('-40', 'USDC', plain), '−40 USDC')
  })
})

describe('formatPercent', () => {
  it('shows 2 decimals, or a dash when there is no value', () => {
    assert.equal(formatPercent(5.1), '5.10%')
    assert.equal(formatPercent(10.29), '10.29%')
    assert.equal(formatPercent(null), '—')
  })
})
