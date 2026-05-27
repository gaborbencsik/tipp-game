import { and, eq, isNull } from 'drizzle-orm'
import { db } from '../../db/client.js'
import { matches } from '../../db/schema/index.js'
import { generateInsightsForMatch, InsightGenerationError } from './generator.service.js'
import { translateInsightsForMatch } from './translator.service.js'
import { LlmDailyLimitExceededError } from './rate-limiter.js'
import { getDailyStats, getLast7Days } from './usage.repository.js'

export interface InsightsRunResult {
  readonly generated: number
  readonly skipped: number
  readonly errors: readonly { matchId: string; error: string }[]
}

export interface TranslationsRunResult {
  readonly translated: number
  readonly skipped: number
  readonly errors: readonly { matchId: string; insightId?: string; error: string }[]
}

export async function runInsightsBatch(matchId?: string): Promise<InsightsRunResult> {
  const targetIds: string[] = []
  if (matchId) {
    targetIds.push(matchId)
  } else {
    const rows = await db
      .select({ id: matches.id })
      .from(matches)
      .where(and(eq(matches.status, 'scheduled'), isNull(matches.deletedAt)))
    targetIds.push(...rows.map(r => r.id))
  }

  let generated = 0
  let skipped = 0
  const errors: { matchId: string; error: string }[] = []

  for (const id of targetIds) {
    try {
      await generateInsightsForMatch(id)
      generated++
    } catch (err) {
      if (err instanceof LlmDailyLimitExceededError) {
        errors.push({ matchId: id, error: 'Daily LLM limit exceeded' })
        break
      }
      if (err instanceof InsightGenerationError && err.code === 'NO_RAW_STATS') {
        skipped++
        continue
      }
      errors.push({ matchId: id, error: err instanceof Error ? err.message : 'Unknown error' })
    }
  }

  return { generated, skipped, errors }
}

export async function runTranslationsBatch(matchId?: string): Promise<TranslationsRunResult> {
  const targetIds: string[] = []
  if (matchId) {
    targetIds.push(matchId)
  } else {
    const rows = await db
      .select({ id: matches.id })
      .from(matches)
      .where(and(eq(matches.status, 'scheduled'), isNull(matches.deletedAt)))
    targetIds.push(...rows.map(r => r.id))
  }

  let translated = 0
  let skipped = 0
  const errors: { matchId: string; insightId?: string; error: string }[] = []

  for (const id of targetIds) {
    try {
      const r = await translateInsightsForMatch(id)
      translated += r.translated
      skipped += r.skipped
      const dailyHit = r.errors.find(e => e.error === 'Daily LLM limit exceeded')
      if (dailyHit) {
        errors.push({ matchId: id, insightId: dailyHit.insightId, error: 'Daily LLM limit exceeded' })
        break
      }
      for (const e of r.errors) {
        errors.push({ matchId: id, insightId: e.insightId, error: e.error })
      }
    } catch (err) {
      errors.push({ matchId: id, error: err instanceof Error ? err.message : 'Unknown error' })
    }
  }

  return { translated, skipped, errors }
}

export interface InsightsUsageStats {
  readonly date: string
  readonly requestsToday: { readonly generate: number; readonly translate: number; readonly total: number }
  readonly inputTokensToday: number
  readonly outputTokensToday: number
  readonly dailyLimit: number
  readonly remaining: number
  readonly last7Days: readonly { date: string; requests: number; tokens: number }[]
}

export async function getInsightsUsage(): Promise<InsightsUsageStats> {
  const dailyLimit = Number(process.env['INSIGHT_LLM_DAILY_LIMIT'] ?? 450)
  const today = await getDailyStats(new Date())
  const last7Days = await getLast7Days()
  return {
    date: today.date,
    requestsToday: {
      generate: today.generateRequests,
      translate: today.translateRequests,
      total: today.requests,
    },
    inputTokensToday: today.inputTokens,
    outputTokensToday: today.outputTokens,
    dailyLimit,
    remaining: Math.max(0, dailyLimit - today.requests),
    last7Days,
  }
}
