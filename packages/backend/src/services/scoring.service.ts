import { eq, and, or, isNotNull, isNull } from 'drizzle-orm'
import { db } from '../db/client.js'
import { predictions, scoringConfigs, groupMembers, groups, groupPredictionPoints, userLeagueFavorites, matches } from '../db/schema/index.js'
import type { ScoringConfig, ScoreLine, MatchOutcome } from '../types/index.js'

export interface PredictionScore {
  readonly homeGoals: number
  readonly awayGoals: number
  readonly outcomeAfterDraw?: MatchOutcome | null
}

export interface ResultScore {
  readonly homeGoals: number
  readonly awayGoals: number
  readonly outcomeAfterDraw?: MatchOutcome | null
}

export function calculatePoints(
  prediction: PredictionScore,
  result: ResultScore,
  config: ScoringConfig
): number {
  const predDiff = prediction.homeGoals - prediction.awayGoals
  const resDiff = result.homeGoals - result.awayGoals

  // Pontos találat: mindkét gólszám egyezik
  if (prediction.homeGoals === result.homeGoals && prediction.awayGoals === result.awayGoals) {
    const base = config.exactScore
    return base + outcomeBonus(prediction, result, config)
  }

  const predWinner = Math.sign(predDiff)
  const resWinner = Math.sign(resDiff)

  // Döntetlen tipp döntetlenre (de nem pontos találat)
  if (predWinner === 0 && resWinner === 0) {
    return config.correctDraw + outcomeBonus(prediction, result, config)
  }

  // Helyes győztes
  if (predWinner === resWinner) {
    // Azonos gólkülönbség
    if (predDiff === resDiff) {
      return config.correctWinnerAndDiff
    }
    return config.correctWinner
  }

  return config.incorrect
}

function outcomeBonus(
  prediction: PredictionScore,
  result: ResultScore,
  config: ScoringConfig
): number {
  // Outcome bónusz csak döntetlen eredményre értelmezett
  if (result.homeGoals !== result.awayGoals) return 0
  if (
    result.outcomeAfterDraw != null &&
    prediction.outcomeAfterDraw != null &&
    prediction.outcomeAfterDraw === result.outcomeAfterDraw
  ) {
    return config.correctOutcome
  }
  return 0
}

export async function calculateAndSavePoints(
  matchId: string,
  result: ResultScore,
): Promise<void> {
  const [matchPredictions, configs] = await Promise.all([
    db.select().from(predictions).where(eq(predictions.matchId, matchId)),
    db.select().from(scoringConfigs).where(eq(scoringConfigs.isGlobalDefault, true)),
  ])

  const config = configs[0]
  if (!config) throw new Error('No global scoring config found')

  await Promise.all(
    matchPredictions.map((pred) => {
      const points = calculatePoints(
        {
          homeGoals: pred.homeGoals,
          awayGoals: pred.awayGoals,
          outcomeAfterDraw: pred.outcomeAfterDraw as MatchOutcome | null,
        },
        result,
        config,
      )
      return db
        .update(predictions)
        .set({ pointsGlobal: points, updatedAt: new Date() })
        .where(eq(predictions.id, pred.id))
        .returning()
    })
  )
}

export interface FavoriteTeamContext {
  readonly userId: string
  readonly groupFavoriteTeamDoublePoints: boolean
  readonly match: { readonly homeTeamId: string; readonly awayTeamId: string; readonly leagueId: string | null }
  readonly userFavorites: ReadonlyArray<{ readonly userId: string; readonly leagueId: string; readonly teamId: string }>
}

export function applyFavoriteTeamMultiplier(basePoints: number, ctx: FavoriteTeamContext): number {
  if (!ctx.groupFavoriteTeamDoublePoints) return basePoints
  if (!ctx.match.leagueId) return basePoints

  const fav = ctx.userFavorites.find(
    f => f.userId === ctx.userId && f.leagueId === ctx.match.leagueId,
  )
  if (!fav) return basePoints

  if (fav.teamId === ctx.match.homeTeamId || fav.teamId === ctx.match.awayTeamId) {
    return basePoints * 2
  }
  return basePoints
}

export async function calculateAndSaveGroupPoints(
  matchId: string,
  result: ResultScore,
): Promise<void> {
  const [matchPredictions, matchRows] = await Promise.all([
    db.select().from(predictions).where(eq(predictions.matchId, matchId)),
    db.select({ homeTeamId: matches.homeTeamId, awayTeamId: matches.awayTeamId, leagueId: matches.leagueId })
      .from(matches)
      .where(eq(matches.id, matchId))
      .limit(1),
  ])

  if (matchPredictions.length === 0) return

  const matchRow = matchRows[0]
  if (!matchRow) return

  const userIds = [...new Set(matchPredictions.map(p => p.userId))]

  const allFavorites = matchRow.leagueId
    ? await db.select({ userId: userLeagueFavorites.userId, leagueId: userLeagueFavorites.leagueId, teamId: userLeagueFavorites.teamId })
        .from(userLeagueFavorites)
        .where(and(
          eq(userLeagueFavorites.leagueId, matchRow.leagueId!),
        ))
    : []

  const globalConfig = await db.select().from(scoringConfigs).where(eq(scoringConfigs.isGlobalDefault, true))
  const defaultConfig = globalConfig[0]

  await Promise.all(
    matchPredictions.map(async (pred) => {
      const userGroups = await db
        .select({
          groupId: groupMembers.groupId,
          scoringConfigId: groups.scoringConfigId,
          favoriteTeamDoublePoints: groups.favoriteTeamDoublePoints,
          config: scoringConfigs,
        })
        .from(groupMembers)
        .innerJoin(groups, eq(groupMembers.groupId, groups.id))
        .leftJoin(scoringConfigs, eq(groups.scoringConfigId, scoringConfigs.id))
        .where(and(
          eq(groupMembers.userId, pred.userId),
          or(
            isNotNull(groups.scoringConfigId),
            eq(groups.favoriteTeamDoublePoints, true),
          ),
        ))

      await Promise.all(
        userGroups.map(({ groupId, scoringConfigId, favoriteTeamDoublePoints, config }) => {
          const scoringConfig = config ?? defaultConfig
          if (!scoringConfig) return Promise.resolve()

          let points = calculatePoints(
            {
              homeGoals: pred.homeGoals,
              awayGoals: pred.awayGoals,
              outcomeAfterDraw: pred.outcomeAfterDraw as MatchOutcome | null,
            },
            result,
            scoringConfig,
          )

          points = applyFavoriteTeamMultiplier(points, {
            userId: pred.userId,
            groupFavoriteTeamDoublePoints: favoriteTeamDoublePoints,
            match: matchRow,
            userFavorites: allFavorites,
          })

          return db
            .insert(groupPredictionPoints)
            .values({
              predictionId: pred.id,
              groupId,
              points,
            })
            .onConflictDoUpdate({
              target: [groupPredictionPoints.predictionId, groupPredictionPoints.groupId],
              set: { points, calculatedAt: new Date() },
            })
        })
      )
    })
  )
}
