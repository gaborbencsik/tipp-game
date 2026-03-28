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
