import { eq, and, isNull, desc, sql, inArray, or } from 'drizzle-orm'
import { alias } from 'drizzle-orm/pg-core'
import { db } from '../db/client.js'
import { predictions, matches, matchResults, teams, players, groups, groupMembers, groupPredictionPoints, userLeagueFavorites, groupLeagues, groupMatches } from '../db/schema/index.js'
import type { GroupMatchPrediction } from '../types/index.js'

class AppError extends Error {
  readonly status: number
  constructor(status: number, message: string) {
    super(message)
    this.status = status
    this.name = 'AppError'
  }
}

async function assertGroupExists(groupId: string): Promise<void> {
  const rows = await db
    .select({ id: groups.id })
    .from(groups)
    .where(and(eq(groups.id, groupId), isNull(groups.deletedAt)))
    .limit(1)
  if (!rows[0]) throw new AppError(404, 'Group not found')
}

async function assertGroupMember(groupId: string, userId: string): Promise<void> {
  const rows = await db
    .select({ id: groupMembers.id })
    .from(groupMembers)
    .where(and(eq(groupMembers.groupId, groupId), eq(groupMembers.userId, userId)))
    .limit(1)
  if (!rows[0]) throw new AppError(403, 'Not a member of this group')
}

export async function getMyGroupPredictions(
  groupId: string,
  userId: string,
): Promise<{ predictions: GroupMatchPrediction[]; totalPoints: number }> {
  await assertGroupExists(groupId)
  await assertGroupMember(groupId, userId)

  const groupRow = await db
    .select({ favoriteTeamDoublePoints: groups.favoriteTeamDoublePoints })
    .from(groups)
    .where(eq(groups.id, groupId))
    .limit(1)

  const favoriteTeamDoublePoints = groupRow[0]?.favoriteTeamDoublePoints ?? false

  const allowedLeagueRows = await db
    .select({ leagueId: groupLeagues.leagueId })
    .from(groupLeagues)
    .where(eq(groupLeagues.groupId, groupId))
  const allowedLeagueIds = allowedLeagueRows.map(r => r.leagueId)

  // US-953: hand-picked matches count too, independent of the group's leagues.
  const handPickedRows = await db
    .select({ matchId: groupMatches.matchId })
    .from(groupMatches)
    .where(eq(groupMatches.groupId, groupId))
  const groupMatchIds = handPickedRows.map(r => r.matchId)

  const homeTeam = alias(teams, 'home_team')
  const awayTeam = alias(teams, 'away_team')

  const whereConditions = [eq(predictions.userId, userId)]
  const scopeConditions = []
  if (allowedLeagueIds.length > 0) {
    scopeConditions.push(inArray(matches.leagueId, allowedLeagueIds))
  }
  if (groupMatchIds.length > 0) {
    scopeConditions.push(inArray(matches.id, groupMatchIds))
  }
  if (scopeConditions.length === 1) {
    whereConditions.push(scopeConditions[0]!)
  } else if (scopeConditions.length > 1) {
    whereConditions.push(or(...scopeConditions)!)
  }

  const rows = await db
    .select({
      predictionId: predictions.id,
      matchId: matches.id,
      scheduledAt: matches.scheduledAt,
      leagueId: matches.leagueId,
      homeTeamId: matches.homeTeamId,
      awayTeamId: matches.awayTeamId,
      homeTeamName: homeTeam.name,
      homeTeamShortCode: homeTeam.shortCode,
      homeTeamFlagUrl: homeTeam.flagUrl,
      awayTeamName: awayTeam.name,
      awayTeamShortCode: awayTeam.shortCode,
      awayTeamFlagUrl: awayTeam.flagUrl,
      predHomeGoals: predictions.homeGoals,
      predAwayGoals: predictions.awayGoals,
      resultHomeGoals: matchResults.homeGoals,
      resultAwayGoals: matchResults.awayGoals,
      pointsGlobal: predictions.pointsGlobal,
      groupPoints: groupPredictionPoints.points,
      scorerBonusPoints: predictions.scorerBonusPoints,
      scorerPlayerNameSnapshot: predictions.scorerPlayerNameSnapshot,
      playerShortName: players.shortName,
    })
    .from(predictions)
    .innerJoin(matches, and(eq(predictions.matchId, matches.id), eq(matches.status, 'finished'), isNull(matches.deletedAt)))
    .innerJoin(homeTeam, eq(matches.homeTeamId, homeTeam.id))
    .innerJoin(awayTeam, eq(matches.awayTeamId, awayTeam.id))
    .innerJoin(matchResults, eq(matchResults.matchId, matches.id))
    .leftJoin(groupPredictionPoints, sql`${groupPredictionPoints.predictionId} = ${predictions.id} AND ${groupPredictionPoints.groupId} = ${groupId}::uuid`)
    .leftJoin(players, eq(predictions.scorerPickPlayerId, players.id))
    .where(and(...whereConditions))
    .orderBy(desc(matches.scheduledAt))

  let userFavorites: Array<{ leagueId: string; teamId: string }> = []
  if (favoriteTeamDoublePoints) {
    userFavorites = await db
      .select({ leagueId: userLeagueFavorites.leagueId, teamId: userLeagueFavorites.teamId })
      .from(userLeagueFavorites)
      .where(eq(userLeagueFavorites.userId, userId))
  }

  const result: GroupMatchPrediction[] = rows.map(row => {
    const points = row.groupPoints ?? row.pointsGlobal ?? 0
    const rawScorerBonus = row.scorerBonusPoints ?? 0
    const scorerPickPlayerName = row.scorerPlayerNameSnapshot ?? row.playerShortName ?? null

    let doubledByFavorite = false
    if (favoriteTeamDoublePoints && row.leagueId) {
      const fav = userFavorites.find(f => f.leagueId === row.leagueId)
      if (fav && (fav.teamId === row.homeTeamId || fav.teamId === row.awayTeamId)) {
        doubledByFavorite = true
      }
    }

    // The favorite-team multiplier is applied to (resultPoints + scorerBonus)
    // before being saved into groupPredictionPoints.points, but the raw
    // predictions.scorerBonusPoints column is stored undoubled. To keep the UI
    // breakdown additive (matchPoints + scorerBonusPoints === points), surface
    // the doubled scorer bonus when the row was doubled.
    const scorerBonusPoints = doubledByFavorite ? rawScorerBonus * 2 : rawScorerBonus
    const matchPoints = points - scorerBonusPoints

    return {
      predictionId: row.predictionId,
      matchId: row.matchId,
      scheduledAt: row.scheduledAt.toISOString(),
      homeTeam: { id: row.homeTeamId, name: row.homeTeamName, shortCode: row.homeTeamShortCode, flagUrl: row.homeTeamFlagUrl },
      awayTeam: { id: row.awayTeamId, name: row.awayTeamName, shortCode: row.awayTeamShortCode, flagUrl: row.awayTeamFlagUrl },
      homeGoals: row.predHomeGoals,
      awayGoals: row.predAwayGoals,
      resultHomeGoals: row.resultHomeGoals,
      resultAwayGoals: row.resultAwayGoals,
      points,
      matchPoints,
      scorerBonusPoints,
      scorerPickPlayerName,
      doubledByFavorite,
    }
  })

  const totalPoints = result.reduce((sum, p) => sum + p.points, 0)

  return { predictions: result, totalPoints }
}
