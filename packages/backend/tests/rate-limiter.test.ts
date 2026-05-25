import { describe, it, expect, vi, beforeEach } from 'vitest'

const { mockGetDailyStats } = vi.hoisted(() => ({
  mockGetDailyStats: vi.fn(),
}))

vi.mock('../src/services/insights/usage.repository.js', () => ({
  getDailyStats: mockGetDailyStats,
}))

import {
  createRateLimiter,
  LlmDailyLimitExceededError,
} from '../src/services/insights/rate-limiter.js'

function freshStats(requests = 0): { date: string; requests: number; inputTokens: number; outputTokens: number } {
  return { date: '2026-05-25', requests, inputTokens: 0, outputTokens: 0 }
}

describe('rate-limiter', () => {
  beforeEach(() => {
    mockGetDailyStats.mockReset()
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-05-25T12:00:00.000Z'))
  })

  it('first call runs immediately', async () => {
    mockGetDailyStats.mockResolvedValue(freshStats(0))
    const limiter = createRateLimiter({ minIntervalMs: 4000, dailyLimit: 450 })
    const fn = vi.fn().mockResolvedValue('ok')

    const promise = limiter.run(fn)
    await vi.runAllTimersAsync()
    const result = await promise

    expect(fn).toHaveBeenCalledTimes(1)
    expect(result).toBe('ok')
  })

  it('second call waits at least minIntervalMs', async () => {
    mockGetDailyStats.mockResolvedValue(freshStats(0))
    const limiter = createRateLimiter({ minIntervalMs: 4000, dailyLimit: 450 })
    const fn = vi.fn().mockResolvedValue('ok')

    const p1 = limiter.run(fn)
    await vi.advanceTimersByTimeAsync(0)
    await p1
    expect(fn).toHaveBeenCalledTimes(1)

    const p2 = limiter.run(fn)
    await vi.advanceTimersByTimeAsync(3000)
    expect(fn).toHaveBeenCalledTimes(1)
    await vi.advanceTimersByTimeAsync(1500)
    await p2
    expect(fn).toHaveBeenCalledTimes(2)
  })

  it('throws LlmDailyLimitExceededError when daily count reaches limit', async () => {
    mockGetDailyStats.mockResolvedValue(freshStats(450))
    const limiter = createRateLimiter({ minIntervalMs: 4000, dailyLimit: 450 })
    const fn = vi.fn().mockResolvedValue('ok')

    await expect(limiter.run(fn)).rejects.toBeInstanceOf(LlmDailyLimitExceededError)
    expect(fn).not.toHaveBeenCalled()
  })

  it('serializes concurrent calls (no parallel execution)', async () => {
    mockGetDailyStats.mockResolvedValue(freshStats(0))
    const limiter = createRateLimiter({ minIntervalMs: 1000, dailyLimit: 450 })
    const order: number[] = []
    const fn = (n: number) => async (): Promise<number> => {
      order.push(n)
      return n
    }

    const p1 = limiter.run(fn(1))
    const p2 = limiter.run(fn(2))
    const p3 = limiter.run(fn(3))

    await vi.advanceTimersByTimeAsync(0)
    expect(order).toEqual([1])
    await vi.advanceTimersByTimeAsync(1000)
    expect(order).toEqual([1, 2])
    await vi.advanceTimersByTimeAsync(1000)
    expect(order).toEqual([1, 2, 3])

    await Promise.all([p1, p2, p3])
  })
})
