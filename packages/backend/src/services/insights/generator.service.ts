import { eq } from 'drizzle-orm'
import { alias } from 'drizzle-orm/pg-core'
import { db } from '../../db/client.js'
import { matchInsights, matches, teams } from '../../db/schema/index.js'
import type { RawMatchStats } from './stats.types.js'
import { buildInsightPrompt } from './prompt.builder.js'
import { createLlmClient, LlmClientError, type InsightType, type LlmInsight } from './llm.client.js'
import { translateInsightsForMatch } from './translator.service.js'

export class InsightGenerationError extends Error {
  constructor(message: string, public readonly code: string) {
    super(message)
    this.name = 'InsightGenerationError'
  }
}

const FRESH_THRESHOLD_MS = 24 * 60 * 60 * 1000
const TARGET_INSIGHT_COUNT = 5
const ALL_TYPES: readonly InsightType[] = ['defense', 'attack', 'form', 'set_pieces', 'key_matchup', 'fatigue', 'historical']

interface ExistingInsight {
  readonly type: string
  readonly data: unknown
  readonly generatedAt: Date
}

async function loadMatchTeams(matchId: string): Promise<{ homeTeamName: string; awayTeamName: string } | null> {
  const homeTeam = alias(teams, 'home_team')
  const awayTeam = alias(teams, 'away_team')
  const rows = await db
    .select({ homeTeamName: homeTeam.name, awayTeamName: awayTeam.name })
    .from(matches)
    .innerJoin(homeTeam, eq(matches.homeTeamId, homeTeam.id))
    .innerJoin(awayTeam, eq(matches.awayTeamId, awayTeam.id))
    .where(eq(matches.id, matchId))
    .limit(1)
  return rows[0] ?? null
}

async function loadExistingInsights(matchId: string): Promise<readonly ExistingInsight[]> {
  return db
    .select({ type: matchInsights.type, data: matchInsights.data, generatedAt: matchInsights.generatedAt })
    .from(matchInsights)
    .where(eq(matchInsights.matchId, matchId))
}

function isFresh(generatedAt: Date, now: Date): boolean {
  return now.getTime() - generatedAt.getTime() < FRESH_THRESHOLD_MS
}

async function upsertInsight(matchId: string, insight: LlmInsight): Promise<void> {
  const summary = insight.body.split('. ')[0]?.slice(0, 200) ?? insight.body.slice(0, 200)
  const now = new Date()
  await db
    .insert(matchInsights)
    .values({
      matchId,
      type: insight.type,
      data: { title: insight.title, body: insight.body, dataPoints: insight.dataPoints },
      summary,
      generatedAt: now,
    })
    .onConflictDoUpdate({
      target: [matchInsights.matchId, matchInsights.type],
      set: {
        data: { title: insight.title, body: insight.body, dataPoints: insight.dataPoints },
        summary,
        generatedAt: now,
        updatedAt: now,
      },
    })
}

export async function generateInsightsForMatch(matchId: string, now: Date = new Date()): Promise<void> {
  const teamsRow = await loadMatchTeams(matchId)
  if (!teamsRow) {
    throw new InsightGenerationError(`Match not found: ${matchId}`, 'MATCH_NOT_FOUND')
  }

  const existing = await loadExistingInsights(matchId)
  const rawStatsRow = existing.find(e => e.type === 'raw_stats')
  if (!rawStatsRow) {
    throw new InsightGenerationError(`No raw_stats for match ${matchId} — run raw stats sync first`, 'NO_RAW_STATS')
  }

  const skipTypes = ALL_TYPES.filter(t => {
    const row = existing.find(e => e.type === t)
    return row !== undefined && isFresh(row.generatedAt, now)
  })
  const targetCount = TARGET_INSIGHT_COUNT - skipTypes.length
  if (targetCount <= 0) return

  const prompt = buildInsightPrompt({
    homeTeamName: teamsRow.homeTeamName,
    awayTeamName: teamsRow.awayTeamName,
    stats: rawStatsRow.data as RawMatchStats,
    skipTypes,
    insightCount: targetCount,
  })

  const client = createLlmClient()
  let insights: readonly LlmInsight[] | null = null
  let lastError: unknown = null
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      insights = await client.generateInsights({ prompt, matchId })
      break
    } catch (err) {
      lastError = err
      if (!(err instanceof LlmClientError)) throw err
    }
  }
  if (!insights) {
    throw new InsightGenerationError(
      `LLM generation failed after retry: ${lastError instanceof Error ? lastError.message : 'unknown'}`,
      'LLM_FAILED',
    )
  }

  for (const insight of insights) {
    await upsertInsight(matchId, insight)
  }

  if (process.env['INSIGHT_AUTO_TRANSLATE'] !== 'false') {
    try {
      await translateInsightsForMatch(matchId, now)
    } catch {
      // Translation failures must not break generation success — they surface via the lazy fallback.
    }
  }
}
