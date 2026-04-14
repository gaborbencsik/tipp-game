import { eq, isNotNull } from 'drizzle-orm'
import { db } from '../db/client.js'
import { predictions, scoringConfigs, groupMembers, groups, groupPredictionPoints } from '../db/schema/index.js'
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

export async function calculateAndSaveGroupPoints(
  matchId: string,
  result: ResultScore,
): Promise<void> {
  const matchPredictions = await db
    .select()
    .from(predictions)
    .where(eq(predictions.matchId, matchId))

  if (matchPredictions.length === 0) return

  await Promise.all(
    matchPredictions.map(async (pred) => {
      const groupsWithConfig = await db
        .select({
          groupId: groupMembers.groupId,
          config: scoringConfigs,
        })
        .from(groupMembers)
        .innerJoin(groups, eq(groupMembers.groupId, groups.id))
        .innerJoin(scoringConfigs, eq(groups.scoringConfigId, scoringConfigs.id))
        .where(eq(groupMembers.userId, pred.userId))

      await Promise.all(
        groupsWithConfig.map(({ groupId, config }) => {
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
