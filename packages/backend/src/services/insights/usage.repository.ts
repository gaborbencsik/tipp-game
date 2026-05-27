import { sql } from 'drizzle-orm'
import { db } from '../../db/client.js'
import { llmUsageLog } from '../../db/schema/index.js'

export interface UsageRecord {
  readonly provider: string
  readonly model: string
  readonly matchId: string | null
  readonly inputTokens: number
  readonly outputTokens: number
  readonly latencyMs: number
  readonly success: boolean
  readonly errorCode: string | null
}

export interface DailyStats {
  readonly date: string
  readonly requests: number
  readonly inputTokens: number
  readonly outputTokens: number
  readonly generateRequests: number
  readonly translateRequests: number
}

export interface DailyBreakdown {
  readonly date: string
  readonly requests: number
  readonly tokens: number
}

export async function recordUsage(record: UsageRecord): Promise<void> {
  await db.insert(llmUsageLog).values({
    provider:     record.provider,
    model:        record.model,
    matchId:      record.matchId,
    inputTokens:  record.inputTokens,
    outputTokens: record.outputTokens,
    latencyMs:    record.latencyMs,
    success:      record.success,
    errorCode:    record.errorCode,
  })
}

function toDateKey(date: Date): string {
  return date.toISOString().slice(0, 10)
}

export async function getDailyStats(date: Date): Promise<DailyStats> {
  const dateKey = toDateKey(date)
  const rows = await db
    .select({
      requests:          sql<number>`COALESCE(COUNT(*), 0)::int`,
      inputTokens:       sql<number>`COALESCE(SUM(${llmUsageLog.inputTokens}), 0)::int`,
      outputTokens:      sql<number>`COALESCE(SUM(${llmUsageLog.outputTokens}), 0)::int`,
      translateRequests: sql<number>`COALESCE(SUM(CASE WHEN ${llmUsageLog.provider} LIKE '%-translate' THEN 1 ELSE 0 END), 0)::int`,
    })
    .from(llmUsageLog)
    .where(sql`DATE(${llmUsageLog.createdAt} AT TIME ZONE 'UTC') = ${dateKey}`)
  const row = rows[0] ?? { requests: 0, inputTokens: 0, outputTokens: 0, translateRequests: 0 }
  return {
    date: dateKey,
    requests: row.requests,
    inputTokens: row.inputTokens,
    outputTokens: row.outputTokens,
    generateRequests: row.requests - row.translateRequests,
    translateRequests: row.translateRequests,
  }
}

export async function getLast7Days(): Promise<readonly DailyBreakdown[]> {
  const rows = await db
    .select({
      date:     sql<string>`TO_CHAR(${llmUsageLog.createdAt} AT TIME ZONE 'UTC', 'YYYY-MM-DD')`,
      requests: sql<number>`COUNT(*)::int`,
      tokens:   sql<number>`COALESCE(SUM(${llmUsageLog.inputTokens} + ${llmUsageLog.outputTokens}), 0)::int`,
    })
    .from(llmUsageLog)
    .where(sql`${llmUsageLog.createdAt} >= NOW() - INTERVAL '7 days'`)
    .groupBy(sql`TO_CHAR(${llmUsageLog.createdAt} AT TIME ZONE 'UTC', 'YYYY-MM-DD')`)
    .orderBy(sql`TO_CHAR(${llmUsageLog.createdAt} AT TIME ZONE 'UTC', 'YYYY-MM-DD') DESC`)
  return rows
}
