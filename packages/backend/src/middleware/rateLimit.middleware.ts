import type { Context, Next } from 'koa'

interface RateLimitOptions {
  windowMs: number
  max: number
}

export function createRateLimit(options: RateLimitOptions) {
  const { windowMs, max } = options
  const hits = new Map<string, number[]>()

  return async function rateLimitMiddleware(ctx: Context, next: Next): Promise<void> {
    const ip = ctx.ip
    const now = Date.now()
    const windowStart = now - windowMs

    const timestamps = (hits.get(ip) ?? []).filter(t => t > windowStart)

    if (timestamps.length >= max) {
      ctx.status = 429
      ctx.body = { error: 'Too many requests, please try again later' }
      return
    }

    timestamps.push(now)
    hits.set(ip, timestamps)

    await next()
  }
}
