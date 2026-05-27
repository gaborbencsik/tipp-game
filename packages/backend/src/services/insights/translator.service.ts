import { eq } from 'drizzle-orm'
import { db } from '../../db/client.js'
import { matchInsights } from '../../db/schema/index.js'
import { buildTranslatorPrompt } from './translator.prompt.builder.js'
import { createLlmClient, LlmClientError, LlmDailyLimitExceededError } from './llm.client.js'

export class InsightTranslationError extends Error {
  constructor(message: string, public readonly code: string) {
    super(message)
    this.name = 'InsightTranslationError'
  }
}

const FRESH_THRESHOLD_MS = 7 * 24 * 60 * 60 * 1000

interface InsightRow {
  readonly id: string
  readonly matchId: string
  readonly type: string
  readonly data: unknown
  readonly titleHu: string | null
  readonly bodyHu: string | null
  readonly translatedAt: Date | null
}

interface InsightContent {
  readonly title: string
  readonly body: string
}

export interface TranslationBatchResult {
  readonly translated: number
  readonly skipped: number
  readonly errors: readonly { insightId: string; error: string }[]
}

function extractContent(data: unknown): InsightContent | null {
  if (!data || typeof data !== 'object') return null
  const obj = data as Record<string, unknown>
  const title = typeof obj['title'] === 'string' ? (obj['title'] as string) : null
  const body = typeof obj['body'] === 'string' ? (obj['body'] as string) : null
  if (!title || !body) return null
  return { title, body }
}

function isFresh(translatedAt: Date | null, now: Date): boolean {
  if (!translatedAt) return false
  return now.getTime() - translatedAt.getTime() < FRESH_THRESHOLD_MS
}

async function loadInsightById(id: string): Promise<InsightRow | null> {
  const rows = await db
    .select({
      id: matchInsights.id,
      matchId: matchInsights.matchId,
      type: matchInsights.type,
      data: matchInsights.data,
      titleHu: matchInsights.titleHu,
      bodyHu: matchInsights.bodyHu,
      translatedAt: matchInsights.translatedAt,
    })
    .from(matchInsights)
    .where(eq(matchInsights.id, id))
  return rows[0] ?? null
}

async function loadInsightsByMatch(matchId: string): Promise<readonly InsightRow[]> {
  return db
    .select({
      id: matchInsights.id,
      matchId: matchInsights.matchId,
      type: matchInsights.type,
      data: matchInsights.data,
      titleHu: matchInsights.titleHu,
      bodyHu: matchInsights.bodyHu,
      translatedAt: matchInsights.translatedAt,
    })
    .from(matchInsights)
    .where(eq(matchInsights.matchId, matchId))
}

async function writeTranslation(insightId: string, titleHu: string, bodyHu: string, now: Date): Promise<void> {
  await db
    .update(matchInsights)
    .set({ titleHu, bodyHu, translatedAt: now, updatedAt: now })
    .where(eq(matchInsights.id, insightId))
}

async function translateRow(row: InsightRow, now: Date): Promise<void> {
  const content = extractContent(row.data)
  if (!content) {
    throw new InsightTranslationError(`Insight ${row.id} has no title/body to translate`, 'NO_CONTENT')
  }

  const prompt = buildTranslatorPrompt({ title: content.title, body: content.body })
  const client = createLlmClient()

  let result: { titleHu: string; bodyHu: string } | null = null
  let lastError: unknown = null
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      result = await client.translate({ prompt, matchId: row.matchId })
      break
    } catch (err) {
      lastError = err
      if (err instanceof LlmDailyLimitExceededError) throw err
      if (!(err instanceof LlmClientError)) throw err
    }
  }
  if (!result) {
    throw new InsightTranslationError(
      `Translation failed after retry: ${lastError instanceof Error ? lastError.message : 'unknown'}`,
      'LLM_FAILED',
    )
  }

  await writeTranslation(row.id, result.titleHu, result.bodyHu, now)
}

export async function translateInsight(insightId: string, now: Date = new Date()): Promise<void> {
  const row = await loadInsightById(insightId)
  if (!row) {
    throw new InsightTranslationError(`Insight not found: ${insightId}`, 'NOT_FOUND')
  }
  await translateRow(row, now)
}

export async function translateInsightsForMatch(matchId: string, now: Date = new Date()): Promise<TranslationBatchResult> {
  const rows = await loadInsightsByMatch(matchId)
  const candidates = rows.filter(r => r.type !== 'raw_stats')

  let translated = 0
  let skipped = 0
  const errors: { insightId: string; error: string }[] = []

  for (const row of candidates) {
    if (row.titleHu && row.bodyHu && isFresh(row.translatedAt, now)) {
      skipped++
      continue
    }
    try {
      await translateRow(row, now)
      translated++
    } catch (err) {
      if (err instanceof LlmDailyLimitExceededError) {
        errors.push({ insightId: row.id, error: 'Daily LLM limit exceeded' })
        break
      }
      errors.push({ insightId: row.id, error: err instanceof Error ? err.message : 'Unknown error' })
    }
  }

  return { translated, skipped, errors }
}
