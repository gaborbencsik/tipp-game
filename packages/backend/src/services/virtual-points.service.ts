import { eq, and, inArray } from 'drizzle-orm'
import { alias } from 'drizzle-orm/pg-core'
import { db } from '../db/client.js'
import { predictions, liveMatchStates, groups, groupMembers, matches, teams } from '../db/schema/index.js'
import { calculatePoints } from './scoring.service.js'
import { getGroupConfig, getGlobalConfig } from './scoring-config.service.js'
import type { ScoringConfig, MatchOutcome } from '../types/index.js'

class AppError extends Error {
  readonly status: number
  constructor(status: number, message: string) {
    super(message)
    this.status = status
    this.name = 'AppError'
  }
}

export interface VirtualPointEntry {
  readonly matchId: string
  readonly scheduledAt: string
  readonly homeTeam: { readonly shortCode: string; readonly name: string; readonly flagUrl: string | null }
  readonly awayTeam: { readonly shortCode: string; readonly name: string; readonly flagUrl: string | null }
  readonly predHomeGoals: number
  readonly predAwayGoals: number
  readonly liveHomeScore: number
  readonly liveAwayScore: number
  readonly minute: number | null
  readonly virtualPoints: number
}

async function assertGroupMember(groupId: string, userId: string): Promise<void> {
  const rows = await db
    .select({ id: groupMembers.id })
    .from(groupMembers)
    .where(and(eq(groupMembers.groupId, groupId), eq(groupMembers.userId, userId)))
    .limit(1)
  if (!rows[0]) throw new AppError(403, 'Not a member of this group')
}

async function resolveScoringConfig(groupId: string): Promise<ScoringConfig> {
  const groupConfig = await getGroupConfig(groupId)
  const cfg = groupConfig ?? await getGlobalConfig()
  return {
    exactScore: cfg.exactScore,
    correctWinnerAndDiff: cfg.correctWinnerAndDiff,
    correctWinner: cfg.correctWinner,
    correctDraw: cfg.correctDraw,
    correctOutcome: cfg.correctOutcome,
    incorrect: cfg.incorrect,
  }
}

export async function getVirtualPointsForUserInGroup(
  groupId: string,
  userId: string,
): Promise<VirtualPointEntry[]> {
  const groupRows = await db.select({ id: groups.id }).from(groups).where(eq(groups.id, groupId)).limit(1)
  if (!groupRows[0]) throw new AppError(404, 'Group not found')

  await assertGroupMember(groupId, userId)

  const userPredictions = await db
    .select({
      matchId: predictions.matchId,
      homeGoals: predictions.homeGoals,
      awayGoals: predictions.awayGoals,
      outcomeAfterDraw: predictions.outcomeAfterDraw,
    })
    .from(predictions)
    .where(eq(predictions.userId, userId))

  if (userPredictions.length === 0) return []

  const matchIds = userPredictions.map(p => p.matchId)

  const homeTeam = alias(teams, 'home_team')
  const awayTeam = alias(teams, 'away_team')

  const liveRows = await db
    .select({
      matchId: liveMatchStates.matchId,
      homeScore: liveMatchStates.homeScore,
      awayScore: liveMatchStates.awayScore,
      minute: liveMatchStates.minute,
      scheduledAt: matches.scheduledAt,
      homeTeamShortCode: homeTeam.shortCode,
      homeTeamName: homeTeam.name,
      homeTeamFlagUrl: homeTeam.flagUrl,
      awayTeamShortCode: awayTeam.shortCode,
      awayTeamName: awayTeam.name,
      awayTeamFlagUrl: awayTeam.flagUrl,
    })
    .from(liveMatchStates)
    .innerJoin(matches, eq(matches.id, liveMatchStates.matchId))
    .innerJoin(homeTeam, eq(homeTeam.id, matches.homeTeamId))
    .innerJoin(awayTeam, eq(awayTeam.id, matches.awayTeamId))
    .where(inArray(liveMatchStates.matchId, matchIds))

  if (liveRows.length === 0) return []

  const config = await resolveScoringConfig(groupId)
  const predictionsByMatch = new Map(userPredictions.map(p => [p.matchId, p]))

  return liveRows.map(state => {
    const prediction = predictionsByMatch.get(state.matchId)
    if (!prediction) return null
    const points = calculatePoints(
      {
        homeGoals: prediction.homeGoals,
        awayGoals: prediction.awayGoals,
        outcomeAfterDraw: prediction.outcomeAfterDraw as MatchOutcome | null,
      },
      { homeGoals: state.homeScore, awayGoals: state.awayScore, outcomeAfterDraw: null },
      config,
    )
    return {
      matchId: state.matchId,
      scheduledAt: state.scheduledAt.toISOString(),
      homeTeam: { shortCode: state.homeTeamShortCode, name: state.homeTeamName, flagUrl: state.homeTeamFlagUrl },
      awayTeam: { shortCode: state.awayTeamShortCode, name: state.awayTeamName, flagUrl: state.awayTeamFlagUrl },
      predHomeGoals: prediction.homeGoals,
      predAwayGoals: prediction.awayGoals,
      liveHomeScore: state.homeScore,
      liveAwayScore: state.awayScore,
      minute: state.minute,
      virtualPoints: points,
    }
  }).filter((e): e is VirtualPointEntry => e !== null)
}
