import { eq, and, or, isNotNull, isNull } from 'drizzle-orm'
import { db } from '../db/client.js'
import { predictions, scoringConfigs, groupMembers, groups, groupPredictionPoints, userLeagueFavorites, matches, matchResults, groupLeagues, groupMatches } from '../db/schema/index.js'
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
  const predWinner = Math.sign(prediction.homeGoals - prediction.awayGoals)
  const resWinner = Math.sign(result.homeGoals - result.awayGoals)

  if (predWinner !== resWinner) return 0

  let pts = config.correctOutcomePoints

  if (
    prediction.homeGoals === result.homeGoals &&
    prediction.awayGoals === result.awayGoals
  ) {
    pts += config.exactBonusPoints
  }

  if (
    result.homeGoals === result.awayGoals &&
    prediction.outcomeAfterDraw != null &&
    result.outcomeAfterDraw != null &&
    prediction.outcomeAfterDraw === result.outcomeAfterDraw
  ) {
    pts += config.extraTimeBonusPoints
  }

  return pts
}

export interface ScorerBonusContext {
  readonly scorerPickPlayerId: string | null
  readonly matchScorerPlayerIds: ReadonlyArray<string>
}

export function calculateScorerBonus(ctx: ScorerBonusContext): 0 | 1 {
  if (ctx.scorerPickPlayerId === null) return 0
  return ctx.matchScorerPlayerIds.includes(ctx.scorerPickPlayerId) ? 1 : 0
}

/**
 * UX-033: Az eredménytippből származó pont, scorer bonus nélkül.
 * A `predictions.pointsGlobal` mező a (resultPoints + scorerBonusPoints) értéket tárolja
 * (favorite-team multiplier nélkül — az csak a `groupPredictionPoints` táblába kerül),
 * ezért egyszerű kivonás visszaadja a tiszta eredmény-pontot a UI-nak.
 */
export function derivePointsResult(pointsGlobal: number | null, scorerBonusPoints: number | null): number | null {
  if (pointsGlobal === null) return null
  return pointsGlobal - (scorerBonusPoints ?? 0)
}

export interface ScoredPrediction {
  readonly pointsGlobal: number
  readonly scorerBonusPoints: 0 | 1
}

export function calculatePointsWithScorer(
  prediction: PredictionScore,
  result: ResultScore,
  config: ScoringConfig,
  scorer: ScorerBonusContext,
  favCtx: FavoriteTeamContext,
): ScoredPrediction {
  const resultPoints = calculatePoints(prediction, result, config)
  const scorerBonusPoints = calculateScorerBonus(scorer)
  const subtotal = resultPoints + scorerBonusPoints
  const pointsGlobal = applyFavoriteTeamMultiplier(subtotal, favCtx)
  return { pointsGlobal, scorerBonusPoints }
}

export async function calculateAndSavePoints(
  matchId: string,
  result: ResultScore,
): Promise<void> {
  const [matchPredictions, configs, scorerRows] = await Promise.all([
    db.select().from(predictions).where(eq(predictions.matchId, matchId)),
    db.select().from(scoringConfigs).where(eq(scoringConfigs.isGlobalDefault, true)),
    db.select({ scorerPlayerIds: matchResults.scorerPlayerIds })
      .from(matchResults)
      .where(eq(matchResults.matchId, matchId))
      .limit(1),
  ])

  const config = configs[0]
  if (!config) throw new Error('No global scoring config found')

  const matchScorerPlayerIds: ReadonlyArray<string> = scorerRows[0]?.scorerPlayerIds ?? []

  await Promise.all(
    matchPredictions.map((pred) => {
      const resultPoints = calculatePoints(
        {
          homeGoals: pred.homeGoals,
          awayGoals: pred.awayGoals,
          outcomeAfterDraw: pred.outcomeAfterDraw as MatchOutcome | null,
        },
        result,
        config,
      )
      const scorerBonusPoints = calculateScorerBonus({
        scorerPickPlayerId: pred.scorerPickPlayerId ?? null,
        matchScorerPlayerIds,
      })
      const pointsGlobal = resultPoints + scorerBonusPoints
      return db
        .update(predictions)
        .set({ pointsGlobal, scorerBonusPoints, updatedAt: new Date() })
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
  const [matchPredictions, matchRows, scorerRows] = await Promise.all([
    db.select().from(predictions).where(eq(predictions.matchId, matchId)),
    db.select({ homeTeamId: matches.homeTeamId, awayTeamId: matches.awayTeamId, leagueId: matches.leagueId })
      .from(matches)
      .where(eq(matches.id, matchId))
      .limit(1),
    db.select({ scorerPlayerIds: matchResults.scorerPlayerIds })
      .from(matchResults)
      .where(eq(matchResults.matchId, matchId))
      .limit(1),
  ])

  if (matchPredictions.length === 0) return

  const matchRow = matchRows[0]
  if (!matchRow) return

  const matchScorerPlayerIds: ReadonlyArray<string> = scorerRows[0]?.scorerPlayerIds ?? []

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

  const allGroupLeagues = await db
    .select({ groupId: groupLeagues.groupId, leagueId: groupLeagues.leagueId })
    .from(groupLeagues)
  const groupLeagueMap = new Map<string, Set<string>>()
  for (const row of allGroupLeagues) {
    let set = groupLeagueMap.get(row.groupId)
    if (!set) { set = new Set(); groupLeagueMap.set(row.groupId, set) }
    set.add(row.leagueId)
  }

  // US-953: groups that hand-picked THIS match bypass the league gate below.
  const handPickedRows = await db
    .select({ groupId: groupMatches.groupId })
    .from(groupMatches)
    .where(eq(groupMatches.matchId, matchId))
  const handPickedGroupIds = new Set(handPickedRows.map((r) => r.groupId))

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
          const allowedLeagues = groupLeagueMap.get(groupId)
          if (allowedLeagues && allowedLeagues.size > 0 && !handPickedGroupIds.has(groupId)) {
            if (!matchRow.leagueId || !allowedLeagues.has(matchRow.leagueId)) return Promise.resolve()
          }

          const scoringConfig = config ?? defaultConfig
          if (!scoringConfig) return Promise.resolve()

          const resultPoints = calculatePoints(
            {
              homeGoals: pred.homeGoals,
              awayGoals: pred.awayGoals,
              outcomeAfterDraw: pred.outcomeAfterDraw as MatchOutcome | null,
            },
            result,
            scoringConfig,
          )

          const scorerBonusPoints = calculateScorerBonus({
            scorerPickPlayerId: pred.scorerPickPlayerId ?? null,
            matchScorerPlayerIds,
          })

          const subtotal = resultPoints + scorerBonusPoints

          const points = applyFavoriteTeamMultiplier(subtotal, {
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
