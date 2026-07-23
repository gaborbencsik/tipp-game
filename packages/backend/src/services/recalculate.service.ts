import { eq, inArray } from 'drizzle-orm'
import { db } from '../db/client.js'
import { matchResults, matches, predictions, groupPredictionPoints, groupMembers, groupLeagues, groupMatches } from '../db/schema/index.js'
import { calculateAndSavePoints, calculateAndSaveGroupPoints } from './scoring.service.js'
import { markRecalcStarted, markRecalcFinished } from './sync-state.service.js'
import type { MatchOutcome, RecalcResult } from '../types/index.js'

export interface RecalculateOptions {
  readonly groupId?: string
}

export async function recalculateAll(opts: RecalculateOptions = {}): Promise<RecalcResult> {
  const startedAt = Date.now()

  const results = await db
    .select({
      matchId: matchResults.matchId,
      homeGoals: matchResults.homeGoals,
      awayGoals: matchResults.awayGoals,
      outcomeAfterDraw: matchResults.outcomeAfterDraw,
    })
    .from(matchResults)

  // Per-group recalc: restrict to matches relevant to the group — either
  // belonging to one of the group's leagues, or hand-picked into the group.
  let allowedMatchIds: Set<string> | null = null
  if (opts.groupId) {
    const leagueMatchRows = await db
      .select({ matchId: matches.id })
      .from(matches)
      .innerJoin(groupLeagues, eq(matches.leagueId, groupLeagues.leagueId))
      .where(eq(groupLeagues.groupId, opts.groupId))
    const handPickedRows = await db
      .select({ matchId: groupMatches.matchId })
      .from(groupMatches)
      .where(eq(groupMatches.groupId, opts.groupId))
    allowedMatchIds = new Set([
      ...leagueMatchRows.map(r => r.matchId),
      ...handPickedRows.map(r => r.matchId),
    ])
  }

  let predictionsUpdated = 0
  let matchesRecalculated = 0

  for (const row of results) {
    if (allowedMatchIds && !allowedMatchIds.has(row.matchId)) continue
    matchesRecalculated++

    const result = {
      homeGoals: row.homeGoals,
      awayGoals: row.awayGoals,
      outcomeAfterDraw: (row.outcomeAfterDraw ?? null) as MatchOutcome | null,
    }

    if (opts.groupId) {
      // Per-group recalc: only re-score predictions of group members for this match
      const memberRows = await db
        .select({ userId: groupMembers.userId })
        .from(groupMembers)
        .where(eq(groupMembers.groupId, opts.groupId))
      const memberIds = new Set(memberRows.map(m => m.userId))

      // Clear existing group_prediction_points for this group + match's predictions
      const matchPredictions = await db
        .select({ id: predictions.id, userId: predictions.userId })
        .from(predictions)
        .where(eq(predictions.matchId, row.matchId))

      const targetPredIds = matchPredictions
        .filter(p => memberIds.has(p.userId))
        .map(p => p.id)

      for (const predId of targetPredIds) {
        await db
          .delete(groupPredictionPoints)
          .where(eq(groupPredictionPoints.predictionId, predId))
        predictionsUpdated++
      }

      await calculateAndSaveGroupPoints(row.matchId, result)
    } else {
      await calculateAndSavePoints(row.matchId, result)
      await calculateAndSaveGroupPoints(row.matchId, result)
      const matchPredictions = await db
        .select({ id: predictions.id })
        .from(predictions)
        .where(eq(predictions.matchId, row.matchId))
      predictionsUpdated += matchPredictions.length
    }

    await db
      .update(matchResults)
      .set({ pointsCalculatedAt: new Date() })
      .where(eq(matchResults.matchId, row.matchId))
  }

  return {
    matchesRecalculated,
    predictionsUpdated,
    durationMs: Date.now() - startedAt,
    groupId: opts.groupId ?? null,
    finishedAt: new Date().toISOString(),
  }
}

export async function startRecalculation(opts: RecalculateOptions = {}): Promise<boolean> {
  const acquired = await markRecalcStarted()
  if (!acquired) return false

  void Promise.resolve().then(async () => {
    try {
      const result = await recalculateAll(opts)
      await markRecalcFinished(result)
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error during recalculation'
      await markRecalcFinished({
        matchesRecalculated: 0,
        predictionsUpdated: 0,
        durationMs: 0,
        groupId: opts.groupId ?? null,
        finishedAt: new Date().toISOString(),
        error: message,
      })
    }
  })

  return true
}
