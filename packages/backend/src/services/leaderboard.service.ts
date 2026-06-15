import { eq, sum, count, isNull, isNotNull, sql, and, inArray } from 'drizzle-orm'
import { db } from '../db/client.js'
import { users, predictions, matches, userLeagueFavorites, teams, specialPredictions, specialPredictionTypes } from '../db/schema/index.js'

export interface LeaderboardEntry {
  readonly rank: number
  readonly userId: string
  readonly displayName: string
  readonly avatarUrl: string | null
  readonly totalPoints: number
  readonly predictionCount: number
  readonly correctCount: number
  readonly matchPoints: number
  readonly scorerBonusPoints: number
  readonly successRate: number | null
  readonly matchSuccessRate: number | null
  readonly scorerSuccessRate: number | null
  readonly specialPredictionPoints: number
  readonly favoriteTeam?: { readonly countryCode: string; readonly name: string } | null
  readonly isPaid?: boolean
  readonly isSupporter: boolean
}

export async function getLeaderboard(): Promise<LeaderboardEntry[]> {
  const rows = await db
    .select({
      userId: users.id,
      displayName: users.displayName,
      avatarUrl: users.avatarUrl,
      supporterAt: users.supporterAt,
      totalPoints: sql<number>`coalesce(sum(${predictions.pointsGlobal}), 0)`,
      predictionCount: count(predictions.id),
      correctCount: sql<number>`count(case when ${predictions.pointsGlobal} > 0 then 1 end)`,
      scorerBonusPoints: sql<number>`coalesce(sum(${predictions.scorerBonusPoints}), 0)`,
      matchCorrectCount: sql<number>`count(case when (coalesce(${predictions.pointsGlobal}, 0) - coalesce(${predictions.scorerBonusPoints}, 0)) > 0 then 1 end)`,
      scorerCorrectCount: sql<number>`count(case when ${predictions.scorerBonusPoints} > 0 then 1 end)`,
    })
    .from(users)
    .leftJoin(predictions, eq(predictions.userId, users.id))
    .leftJoin(matches, eq(matches.id, predictions.matchId))
    .where(and(
      isNull(users.deletedAt),
      sql`(${predictions.id} IS NULL OR ${matches.deletedAt} IS NULL)`,
    ))
    .groupBy(users.id, users.displayName, users.avatarUrl, users.supporterAt)
    .orderBy(sql`coalesce(sum(${predictions.pointsGlobal}), 0) desc, ${users.id} asc`)

  // Pick each user's earliest favorite team (stable across requests).
  const userIds = rows.map(r => r.userId)
  const favoritesByUser = new Map<string, { countryCode: string; name: string }>()
  if (userIds.length > 0) {
    const favRows = await db
      .select({
        userId: userLeagueFavorites.userId,
        setAt: userLeagueFavorites.setAt,
        countryCode: teams.countryCode,
        teamName: teams.name,
      })
      .from(userLeagueFavorites)
      .innerJoin(teams, eq(teams.id, userLeagueFavorites.teamId))
      .where(inArray(userLeagueFavorites.userId, userIds))
      .orderBy(userLeagueFavorites.setAt)
    for (const row of favRows) {
      if (row.countryCode && !favoritesByUser.has(row.userId)) {
        favoritesByUser.set(row.userId, { countryCode: row.countryCode, name: row.teamName })
      }
    }
  }

  // UX-034: Global tournament points — sum of special predictions whose type is
  // global (is_global=true) and whose row is not group-scoped (group_id IS NULL).
  const tournamentRows = userIds.length > 0
    ? await db
        .select({
          userId: specialPredictions.userId,
          tournamentPoints: sql<number>`coalesce(sum(${specialPredictions.points}), 0)`,
        })
        .from(specialPredictions)
        .innerJoin(specialPredictionTypes, eq(specialPredictions.typeId, specialPredictionTypes.id))
        .where(and(
          eq(specialPredictionTypes.isGlobal, true),
          isNull(specialPredictions.groupId),
          inArray(specialPredictions.userId, userIds),
        ))
        .groupBy(specialPredictions.userId)
    : []
  const tournamentByUser = new Map(tournamentRows.map(r => [r.userId, Number(r.tournamentPoints)]))

  // Merge match + tournament points and re-sort: tournament points contribute
  // to the displayed total, so the ranking must reflect the combined value.
  const merged = rows.map(row => {
    const matchAndScorer = Number(row.totalPoints)
    const tournamentPoints = tournamentByUser.get(row.userId) ?? 0
    const scorerBonusPoints = Number(row.scorerBonusPoints)
    const predictionCount = Number(row.predictionCount)
    const correctCount = Number(row.correctCount)
    const matchCorrectCount = Number(row.matchCorrectCount)
    const scorerCorrectCount = Number(row.scorerCorrectCount)
    return {
      userId: row.userId,
      displayName: row.displayName,
      avatarUrl: row.avatarUrl,
      supporterAt: row.supporterAt,
      matchPoints: matchAndScorer - scorerBonusPoints,
      scorerBonusPoints,
      tournamentPoints,
      totalPoints: matchAndScorer + tournamentPoints,
      predictionCount,
      correctCount,
      successRate: predictionCount > 0 ? Math.round((correctCount / predictionCount) * 100) : null,
      matchSuccessRate: predictionCount > 0 ? Math.round((matchCorrectCount / predictionCount) * 100) : null,
      scorerSuccessRate: predictionCount > 0 ? Math.round((scorerCorrectCount / predictionCount) * 100) : null,
    }
  })
  merged.sort((a, b) => b.totalPoints - a.totalPoints || a.userId.localeCompare(b.userId))

  let rank = 1
  return merged.map((row, i) => {
    if (i > 0 && row.totalPoints < merged[i - 1]!.totalPoints) {
      rank = i + 1
    }
    return {
      rank,
      userId: row.userId,
      displayName: row.displayName,
      avatarUrl: row.avatarUrl ?? null,
      totalPoints: row.totalPoints,
      predictionCount: row.predictionCount,
      correctCount: row.correctCount,
      matchPoints: row.matchPoints,
      scorerBonusPoints: row.scorerBonusPoints,
      successRate: row.successRate,
      matchSuccessRate: row.matchSuccessRate,
      scorerSuccessRate: row.scorerSuccessRate,
      specialPredictionPoints: row.tournamentPoints,
      favoriteTeam: favoritesByUser.get(row.userId) ?? null,
      isSupporter: row.supporterAt !== null,
    }
  })
}
