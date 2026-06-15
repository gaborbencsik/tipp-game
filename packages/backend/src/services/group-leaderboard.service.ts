import { eq, sql, and, or, inArray, isNull } from 'drizzle-orm'
import { db } from '../db/client.js'
import { users, predictions, groupMembers, groups, groupPredictionPoints, specialPredictions, specialPredictionTypes, groupGlobalTypeSubscriptions, groupLeagues, matches, userLeagueFavorites, teams } from '../db/schema/index.js'
import type { LeaderboardEntry } from './leaderboard.service.js'

class AppError extends Error {
  readonly status: number
  constructor(status: number, message: string) {
    super(message)
    this.status = status
    this.name = 'AppError'
  }
}

export async function getGroupLeaderboard(groupId: string, requesterId: string): Promise<LeaderboardEntry[]> {
  const group = await db
    .select({ id: groups.id, scoringConfigId: groups.scoringConfigId, favoriteTeamDoublePoints: groups.favoriteTeamDoublePoints })
    .from(groups)
    .where(eq(groups.id, groupId))
    .limit(1)

  if (!group[0]) throw new AppError(404, 'Group not found')

  const membership = await db
    .select({ userId: groupMembers.userId, paidAt: groupMembers.paidAt })
    .from(groupMembers)
    .where(eq(groupMembers.groupId, groupId))

  const memberIds = membership.map(m => m.userId)
  if (!memberIds.includes(requesterId)) throw new AppError(403, 'Not a member of this group')
  const paidByUser = new Map(membership.map(m => [m.userId, m.paidAt !== null]))

  const leagueRows = await db
    .select({ leagueId: groupLeagues.leagueId })
    .from(groupLeagues)
    .where(eq(groupLeagues.groupId, groupId))
  const leagueIds = leagueRows.map(r => r.leagueId)

  const useGroupPoints = group[0].scoringConfigId !== null || group[0].favoriteTeamDoublePoints

  let rows: Array<{
    userId: string
    displayName: string
    avatarUrl: string | null
    supporterAt: Date | null
    totalPoints: number
    predictionCount: number
    correctCount: number
    scorerBonusPoints: number
    matchCorrectCount: number
    scorerCorrectCount: number
  }>

  // League / soft-delete filter goes into the matches JOIN ON clause — keeping it
  // in WHERE would turn the LEFT JOIN into an inner join for any member whose
  // predictions all belong to other leagues, dropping that member entirely.
  // Multi-league groups: include matches from ANY subscribed league.
  const matchesJoinOn = leagueIds.length > 0
    ? sql`${matches.id} = ${predictions.matchId} AND ${matches.deletedAt} IS NULL AND ${matches.leagueId} IN (${sql.join(leagueIds.map(id => sql`${id}::uuid`), sql`, `)})`
    : sql`${matches.id} = ${predictions.matchId} AND ${matches.deletedAt} IS NULL`

  if (useGroupPoints) {
    rows = await db
      .select({
        userId: users.id,
        displayName: users.displayName,
        avatarUrl: users.avatarUrl,
        supporterAt: users.supporterAt,
        totalPoints: sql<number>`coalesce(sum(case when ${matches.id} is not null then ${groupPredictionPoints.points} end), 0)`,
        predictionCount: sql<number>`count(case when ${matches.id} is not null then ${predictions.id} end)`,
        correctCount: sql<number>`count(case when ${matches.id} is not null and ${groupPredictionPoints.points} > 0 then 1 end)`,
        scorerBonusPoints: sql<number>`coalesce(sum(case when ${matches.id} is not null then ${predictions.scorerBonusPoints} end), 0)`,
        matchCorrectCount: sql<number>`count(case when ${matches.id} is not null and (coalesce(${predictions.pointsGlobal}, 0) - coalesce(${predictions.scorerBonusPoints}, 0)) > 0 then 1 end)`,
        scorerCorrectCount: sql<number>`count(case when ${matches.id} is not null and ${predictions.scorerBonusPoints} > 0 then 1 end)`,
      })
      .from(groupMembers)
      .innerJoin(users, and(eq(users.id, groupMembers.userId), isNull(users.deletedAt)))
      .leftJoin(predictions, eq(predictions.userId, users.id))
      .leftJoin(matches, matchesJoinOn)
      .leftJoin(
        groupPredictionPoints,
        sql`${groupPredictionPoints.predictionId} = ${predictions.id} AND ${groupPredictionPoints.groupId} = ${groupId}::uuid`,
      )
      .where(eq(groupMembers.groupId, groupId))
      .groupBy(users.id, users.displayName, users.avatarUrl, users.supporterAt)
      .orderBy(sql`coalesce(sum(case when ${matches.id} is not null then ${groupPredictionPoints.points} end), 0) desc, ${users.id} asc`)
  } else {
    rows = await db
      .select({
        userId: users.id,
        displayName: users.displayName,
        avatarUrl: users.avatarUrl,
        supporterAt: users.supporterAt,
        totalPoints: sql<number>`coalesce(sum(case when ${matches.id} is not null then ${predictions.pointsGlobal} end), 0)`,
        predictionCount: sql<number>`count(case when ${matches.id} is not null then ${predictions.id} end)`,
        correctCount: sql<number>`count(case when ${matches.id} is not null and ${predictions.pointsGlobal} > 0 then 1 end)`,
        scorerBonusPoints: sql<number>`coalesce(sum(case when ${matches.id} is not null then ${predictions.scorerBonusPoints} end), 0)`,
        matchCorrectCount: sql<number>`count(case when ${matches.id} is not null and (coalesce(${predictions.pointsGlobal}, 0) - coalesce(${predictions.scorerBonusPoints}, 0)) > 0 then 1 end)`,
        scorerCorrectCount: sql<number>`count(case when ${matches.id} is not null and ${predictions.scorerBonusPoints} > 0 then 1 end)`,
      })
      .from(groupMembers)
      .innerJoin(users, and(eq(users.id, groupMembers.userId), isNull(users.deletedAt)))
      .leftJoin(predictions, eq(predictions.userId, users.id))
      .leftJoin(matches, matchesJoinOn)
      .where(eq(groupMembers.groupId, groupId))
      .groupBy(users.id, users.displayName, users.avatarUrl, users.supporterAt)
      .orderBy(sql`coalesce(sum(case when ${matches.id} is not null then ${predictions.pointsGlobal} end), 0) desc, ${users.id} asc`)
  }

  // Fetch stat prediction points per user for this group
  // Includes both group-scoped types AND subscribed global types, filtered by sp.groupId
  const statPointRows = await db
    .select({
      userId: specialPredictions.userId,
      statPoints: sql<number>`coalesce(sum(${specialPredictions.points}), 0)`,
    })
    .from(specialPredictions)
    .innerJoin(specialPredictionTypes, eq(specialPredictions.typeId, specialPredictionTypes.id))
    .where(and(
      eq(specialPredictions.groupId, groupId),
      or(
        // Group-scoped types belonging to this group
        and(eq(specialPredictionTypes.groupId, groupId), eq(specialPredictionTypes.isGlobal, false)),
        // Global types subscribed by this group
        sql`(${specialPredictionTypes.isGlobal} = true AND ${specialPredictionTypes.id} IN (
          SELECT ${groupGlobalTypeSubscriptions.globalTypeId} FROM ${groupGlobalTypeSubscriptions}
          WHERE ${groupGlobalTypeSubscriptions.groupId} = ${groupId}::uuid
        ))`,
      ),
    ))
    .groupBy(specialPredictions.userId)

  const statPointsByUser = new Map(statPointRows.map(r => [r.userId, Number(r.statPoints)]))

  // Merge stat points and compute total
  const merged = rows.map(row => {
    const matchAndScorer = Number(row.totalPoints)
    const statPoints = statPointsByUser.get(row.userId) ?? 0
    const scorerBonusPoints = Number(row.scorerBonusPoints)
    const predictionCount = Number(row.predictionCount)
    const correctCount = Number(row.correctCount)
    const matchCorrectCount = Number(row.matchCorrectCount)
    const scorerCorrectCount = Number(row.scorerCorrectCount)
    return {
      userId: row.userId,
      displayName: row.displayName,
      avatarUrl: row.avatarUrl ?? null,
      supporterAt: row.supporterAt,
      // matchPoints is the result-only contribution (favorite-team multiplier
      // is included in totalPoints when useGroupPoints=true; in that case
      // matchPoints + scorerBonusPoints !== totalPoints by design — the doubled
      // amount is reflected in totalPoints, not in the bare match cell).
      matchPoints: matchAndScorer - scorerBonusPoints,
      scorerBonusPoints,
      specialPredictionPoints: statPoints,
      totalPoints: matchAndScorer + statPoints,
      predictionCount,
      correctCount,
      successRate: predictionCount > 0 ? Math.round((correctCount / predictionCount) * 100) : null,
      matchSuccessRate: predictionCount > 0 ? Math.round((matchCorrectCount / predictionCount) * 100) : null,
      scorerSuccessRate: predictionCount > 0 ? Math.round((scorerCorrectCount / predictionCount) * 100) : null,
    }
  })

  // Sort by total (match + stat) descending; userId asc as a stable tie-breaker
  // so the response is deterministic across requests (required for ETag stability).
  merged.sort((a, b) => b.totalPoints - a.totalPoints || a.userId.localeCompare(b.userId))

  // Fetch favorite teams if feature is enabled
  let favoritesByUser = new Map<string, { countryCode: string; name: string }>()
  if (group[0].favoriteTeamDoublePoints && leagueIds.length > 0) {
    const favRows = await db
      .select({
        userId: userLeagueFavorites.userId,
        countryCode: teams.countryCode,
        teamName: teams.name,
      })
      .from(userLeagueFavorites)
      .innerJoin(teams, eq(teams.id, userLeagueFavorites.teamId))
      .where(and(
        inArray(userLeagueFavorites.userId, memberIds),
        inArray(userLeagueFavorites.leagueId, leagueIds),
      ))
    for (const row of favRows) {
      if (row.countryCode) {
        favoritesByUser.set(row.userId, { countryCode: row.countryCode, name: row.teamName })
      }
    }
  }

  let rank = 1
  return merged.map((row, i) => {
    if (i > 0 && row.totalPoints < merged[i - 1]!.totalPoints) {
      rank = i + 1
    }
    return {
      rank,
      userId: row.userId,
      displayName: row.displayName,
      avatarUrl: row.avatarUrl,
      totalPoints: row.totalPoints,
      predictionCount: row.predictionCount,
      correctCount: row.correctCount,
      matchPoints: row.matchPoints,
      scorerBonusPoints: row.scorerBonusPoints,
      successRate: row.successRate,
      matchSuccessRate: row.matchSuccessRate,
      scorerSuccessRate: row.scorerSuccessRate,
      specialPredictionPoints: row.specialPredictionPoints,
      favoriteTeam: favoritesByUser.get(row.userId) ?? null,
      isPaid: paidByUser.get(row.userId) ?? false,
      isSupporter: row.supporterAt !== null,
    }
  })
}
