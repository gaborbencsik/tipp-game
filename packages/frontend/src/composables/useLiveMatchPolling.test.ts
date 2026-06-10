import { describe, it, expect } from 'vitest'
import { hasAnyLiveMatch } from './useLiveMatchPolling.js'

describe('hasAnyLiveMatch', () => {
  it('returns false for empty list', () => {
    expect(hasAnyLiveMatch([])).toBe(false)
  })

  it('returns false when all matches are scheduled', () => {
    expect(hasAnyLiveMatch([{ status: 'scheduled' }, { status: 'scheduled' }])).toBe(false)
  })

  it('returns false when all matches are finished', () => {
    expect(hasAnyLiveMatch([{ status: 'finished' }, { status: 'finished' }])).toBe(false)
  })

  it('returns false when matches are cancelled', () => {
    expect(hasAnyLiveMatch([{ status: 'cancelled' }, { status: 'finished' }])).toBe(false)
  })

  it('returns true when at least one match is live', () => {
    expect(hasAnyLiveMatch([{ status: 'scheduled' }, { status: 'live' }, { status: 'finished' }])).toBe(true)
  })

  it('returns true when only one live match exists', () => {
    expect(hasAnyLiveMatch([{ status: 'live' }])).toBe(true)
  })
})
