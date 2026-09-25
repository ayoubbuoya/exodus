// Unit tests for the appearance rules.
import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { themeForPage, themeFromSaved } from './theme.ts'

describe('themeFromSaved', () => {
  it('is dark unless the user picked light', () => {
    assert.equal(themeFromSaved('light'), 'light')
    assert.equal(themeFromSaved('dark'), 'dark')
    assert.equal(themeFromSaved(null), 'dark')
    assert.equal(themeFromSaved('LIGHT'), 'dark')
  })
})

describe('themeForPage', () => {
  it('keeps the landing page dark whatever the choice', () => {
    assert.equal(themeForPage('light', '/'), 'dark')
    assert.equal(themeForPage('dark', '/'), 'dark')
  })

  it('follows the choice everywhere else', () => {
    assert.equal(themeForPage('light', '/app'), 'light')
    assert.equal(themeForPage('light', '/markets/PT-USYC-APR2027'), 'light')
    assert.equal(themeForPage('dark', '/login'), 'dark')
  })
})
