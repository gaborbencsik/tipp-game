import { describe, it, expect } from 'vitest'
import { shouldRunSync } from '../src/services/sync-gate.js'

describe('shouldRunSync', () => {
  const now = new Date('2026-06-15T18:00:00Z')

  function minutesAgo(min: number): Date {
    return new Date(now.getTime() - min * 60 * 1000)
  }

  it('mode=off → always skip', () => {
    const result = shouldRunSync('off', null, false, now)
    expect(result).toEqual({ run: false, reason: 'sync disabled' })
  })

  it('mode=final_only, never ran → run', () => {
    const result = shouldRunSync('final_only', null, false, now)
    expect(result).toEqual({ run: true, reason: 'interval elapsed' })
  })

  it('mode=final_only, ran 10 min ago → skip', () => {
    const result = shouldRunSync('final_only', minutesAgo(10), false, now)
    expect(result).toEqual({ run: false, reason: 'interval not elapsed (need 30m)' })
  })

  it('mode=final_only, ran 31 min ago → run', () => {
    const result = shouldRunSync('final_only', minutesAgo(31), false, now)
    expect(result).toEqual({ run: true, reason: 'interval elapsed' })
  })

  it('mode=adaptive, live match, ran 1 min ago → skip', () => {
    const result = shouldRunSync('adaptive', minutesAgo(1), true, now)
    expect(result).toEqual({ run: false, reason: 'interval not elapsed (need 2m)' })
  })

  it('mode=adaptive, live match, ran 3 min ago → run', () => {
    const result = shouldRunSync('adaptive', minutesAgo(3), true, now)
    expect(result).toEqual({ run: true, reason: 'interval elapsed' })
  })

  it('mode=adaptive, no live match, ran 10 min ago → skip', () => {
    const result = shouldRunSync('adaptive', minutesAgo(10), false, now)
    expect(result).toEqual({ run: false, reason: 'interval not elapsed (need 15m)' })
  })

  it('mode=adaptive, no live match, ran 16 min ago → run', () => {
    const result = shouldRunSync('adaptive', minutesAgo(16), false, now)
    expect(result).toEqual({ run: true, reason: 'interval elapsed' })
  })

  it('mode=full_live, ran 30 sec ago → skip', () => {
    const lastRun = new Date(now.getTime() - 30 * 1000)
    const result = shouldRunSync('full_live', lastRun, false, now)
    expect(result).toEqual({ run: false, reason: 'interval not elapsed (need 1m)' })
  })

  it('mode=full_live, ran 2 min ago → run', () => {
    const result = shouldRunSync('full_live', minutesAgo(2), false, now)
    expect(result).toEqual({ run: true, reason: 'interval elapsed' })
  })
})
