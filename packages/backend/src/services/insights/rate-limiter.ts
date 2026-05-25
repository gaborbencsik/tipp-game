import { getDailyStats } from './usage.repository.js'

export class LlmDailyLimitExceededError extends Error {
  constructor(public readonly limit: number, public readonly used: number) {
    super(`Daily LLM limit exceeded: ${used}/${limit}`)
    this.name = 'LlmDailyLimitExceededError'
  }
}

export interface RateLimiterConfig {
  readonly minIntervalMs: number
  readonly dailyLimit: number
}

export interface RateLimiter {
  run<T>(fn: () => Promise<T>): Promise<T>
}

export function createRateLimiter(config: RateLimiterConfig): RateLimiter {
  let lastRunAt = 0
  let chain: Promise<unknown> = Promise.resolve()

  async function execute<T>(fn: () => Promise<T>): Promise<T> {
    const stats = await getDailyStats(new Date())
    if (stats.requests >= config.dailyLimit) {
      throw new LlmDailyLimitExceededError(config.dailyLimit, stats.requests)
    }
    const now = Date.now()
    const elapsed = now - lastRunAt
    if (lastRunAt > 0 && elapsed < config.minIntervalMs) {
      await new Promise(resolve => setTimeout(resolve, config.minIntervalMs - elapsed))
    }
    lastRunAt = Date.now()
    return fn()
  }

  return {
    run<T>(fn: () => Promise<T>): Promise<T> {
      const next = chain.then(() => execute(fn))
      chain = next.catch(() => undefined)
      return next
    },
  }
}

let singleton: RateLimiter | null = null

export function getRateLimiter(): RateLimiter {
  if (!singleton) {
    const minIntervalMs = Number(process.env['INSIGHT_LLM_MIN_INTERVAL_MS'] ?? 4000)
    const dailyLimit = Number(process.env['INSIGHT_LLM_DAILY_LIMIT'] ?? 450)
    singleton = createRateLimiter({ minIntervalMs, dailyLimit })
  }
  return singleton
}

export function resetRateLimiterForTests(): void {
  singleton = null
}
