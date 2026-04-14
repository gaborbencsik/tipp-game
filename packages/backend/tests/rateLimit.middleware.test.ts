import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { Context, Next } from 'koa'
import { createRateLimit } from '../src/middleware/rateLimit.middleware.js'

function makeCtx(ip: string): Context {
  return { ip, status: 200, body: undefined } as unknown as Context
}

describe('createRateLimit', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  it('allows requests under the limit', async () => {
    const middleware = createRateLimit({ windowMs: 60_000, max: 3 })
    const next = vi.fn<[], Promise<void>>().mockResolvedValue(undefined)
    const ctx = makeCtx('1.2.3.4')

    await middleware(ctx, next)
    await middleware(ctx, next)
    await middleware(ctx, next)

    expect(next).toHaveBeenCalledTimes(3)
    expect(ctx.status).toBe(200)
  })

  it('blocks the request when limit is exceeded', async () => {
    const middleware = createRateLimit({ windowMs: 60_000, max: 2 })
    const next = vi.fn<[], Promise<void>>().mockResolvedValue(undefined)
    const ctx = makeCtx('1.2.3.4')

    await middleware(ctx, next)
    await middleware(ctx, next)
    await middleware(ctx, next)

    expect(next).toHaveBeenCalledTimes(2)
    expect(ctx.status).toBe(429)
  })

  it('different IPs have independent counters', async () => {
    const middleware = createRateLimit({ windowMs: 60_000, max: 1 })
    const next = vi.fn<[], Promise<void>>().mockResolvedValue(undefined)
    const ctxA = makeCtx('1.1.1.1')
    const ctxB = makeCtx('2.2.2.2')

    await middleware(ctxA, next)
    await middleware(ctxB, next)

    expect(next).toHaveBeenCalledTimes(2)
  })

  it('allows requests again after the window expires', async () => {
    const middleware = createRateLimit({ windowMs: 60_000, max: 1 })
    const next = vi.fn<[], Promise<void>>().mockResolvedValue(undefined)
    const ctx = makeCtx('1.2.3.4')

    await middleware(ctx, next)
    expect(next).toHaveBeenCalledTimes(1)

    vi.advanceTimersByTime(61_000)

    const ctx2 = makeCtx('1.2.3.4')
    await middleware(ctx2, next)
    expect(next).toHaveBeenCalledTimes(2)
    expect(ctx2.status).toBe(200)
  })
})
