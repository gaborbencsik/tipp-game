import { eq } from 'drizzle-orm'
import { db } from '../db/client.js'
import { predictions, scoringConfigs } from '../db/schema/index.js'
import type { ScoringConfig, ScoreLine } from '../types/index.js'

export function calculatePoints(
  prediction: ScoreLine,
  result: ScoreLine,
  config: ScoringConfig
): number {
  const predDiff = prediction.homeGoals - prediction.awayGoals
  const resDiff = result.homeGoals - result.awayGoals

  // Pontos találat: mindkét gólszám egyezik
  if (prediction.homeGoals === result.homeGoals && prediction.awayGoals === result.awayGoals) {
    return config.exactScore
  }

  const predWinner = Math.sign(predDiff)
  const resWinner = Math.sign(resDiff)

  // Döntetlen tipp döntetlenre (de nem pontos találat, mert az fentebb kezelt)
  if (predWinner === 0 && resWinner === 0) {
    return config.correctDraw
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

export async function calculateAndSavePoints(
  matchId: string,
  result: ScoreLine,
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
        { homeGoals: pred.homeGoals, awayGoals: pred.awayGoals },
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
