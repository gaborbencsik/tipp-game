import { computed, type ComputedRef, type Ref } from 'vue'
import type { Match, Prediction } from '../types/index.js'

export interface ScoringBuckets {
  readonly correctOutcomePoints: number
  readonly exactBonusPoints: number
  readonly extraTimeBonusPoints: number
}

export interface PointDistribution {
  readonly exact: number
  readonly winner: number
  readonly incorrect: number
  readonly missed: number
}

export interface MyStats {
  readonly submittedCount: number
  readonly totalAvailable: number
  readonly totalPoints: number
  readonly evaluatedCount: number
  readonly correctCount: number
  readonly accuracyPercent: number
  readonly bestStreak: number
  readonly currentStreak: number
  readonly distribution: PointDistribution
  readonly exactHits: number | null
  readonly scorerSubmittedCount: number
  readonly scorerHitCount: number
  readonly scorerTotalBonus: number
  readonly finishedMatchCount: number
}

const AVAILABLE_STATUSES: ReadonlyArray<Match['status']> = ['scheduled', 'live', 'finished']

export function computeMyStats(
  predictions: readonly Prediction[],
  matches: readonly Match[],
  config: ScoringBuckets | null,
): MyStats {
  const matchById = new Map(matches.map(m => [m.id, m] as const))
  const joined = predictions
    .map(p => {
      const m = matchById.get(p.matchId)
      return m ? { prediction: p, match: m } : null
    })
    .filter((x): x is { prediction: Prediction; match: Match } => x !== null)

  const submittedCount = joined.length
  const totalAvailable = matches.filter(m => AVAILABLE_STATUSES.includes(m.status)).length

  const evaluated = joined.filter(({ prediction }) => prediction.pointsGlobal !== null)
  const evaluatedCount = evaluated.length
  const totalPoints = evaluated.reduce((sum, { prediction }) => sum + (prediction.pointsGlobal ?? 0), 0)
  const correctCount = evaluated.filter(({ prediction }) => (prediction.pointsGlobal ?? 0) > 0).length
  const accuracyPercent = evaluatedCount === 0 ? 0 : Math.round((correctCount / evaluatedCount) * 100)

  const evalSorted = [...evaluated].sort(
    (a, b) => new Date(a.match.scheduledAt).getTime() - new Date(b.match.scheduledAt).getTime(),
  )

  let bestStreak = 0
  let runLen = 0
  for (const { prediction } of evalSorted) {
    if ((prediction.pointsGlobal ?? 0) > 0) {
      runLen += 1
      if (runLen > bestStreak) bestStreak = runLen
    } else {
      runLen = 0
    }
  }

  let currentStreak = 0
  if (evalSorted.length > 0) {
    const last = evalSorted[evalSorted.length - 1]!.prediction
    const sign = (last.pointsGlobal ?? 0) > 0 ? 1 : -1
    let n = 0
    for (let i = evalSorted.length - 1; i >= 0; i--) {
      const points = evalSorted[i]!.prediction.pointsGlobal ?? 0
      const isCorrect = points > 0
      if ((sign === 1 && isCorrect) || (sign === -1 && !isCorrect)) {
        n += 1
      } else {
        break
      }
    }
    currentStreak = sign * n
  }

  const distribution = computeDistribution(evaluated.map(e => e.prediction), matches, predictions, config)
  const exactHits = config === null ? null : distribution.exact

  const scorerPicks = joined.filter(({ prediction }) => prediction.scorerPickPlayerId !== null)
  const scorerSubmittedCount = scorerPicks.length
  const scorerHits = scorerPicks.filter(({ prediction }) => prediction.scorerBonusPoints === 1)
  const scorerHitCount = scorerHits.length
  const scorerTotalBonus = scorerHits.reduce(
    (sum, { prediction }) => sum + (prediction.scorerBonusPoints ?? 0),
    0,
  )
  const finishedMatchCount = matches.filter(m => m.status === 'finished').length

  return {
    submittedCount,
    totalAvailable,
    totalPoints,
    evaluatedCount,
    correctCount,
    accuracyPercent,
    bestStreak,
    currentStreak,
    distribution,
    exactHits,
    scorerSubmittedCount,
    scorerHitCount,
    scorerTotalBonus,
    finishedMatchCount,
  }
}

function computeDistribution(
  evaluatedPreds: readonly Prediction[],
  matches: readonly Match[],
  allPreds: readonly Prediction[],
  config: ScoringBuckets | null,
): PointDistribution {
  const predMatchIds = new Set(allPreds.map(p => p.matchId))
  const missed = matches.filter(m => m.status === 'finished' && !predMatchIds.has(m.id)).length

  const buckets = { exact: 0, winner: 0, incorrect: 0 }

  for (const p of evaluatedPreds) {
    const points = p.pointsGlobal ?? 0
    if (points === 0) {
      buckets.incorrect += 1
      continue
    }
    if (config === null) {
      const maxPoints = Math.max(...allPreds.map(x => x.pointsGlobal ?? 0))
      if (points === maxPoints) buckets.exact += 1
      else buckets.winner += 1
      continue
    }
    const exactThreshold = config.correctOutcomePoints + config.exactBonusPoints
    if (points >= exactThreshold) buckets.exact += 1
    else buckets.winner += 1
  }

  return { ...buckets, missed }
}

export interface UseMyStatsArgs {
  readonly predictions: Ref<readonly Prediction[]> | ComputedRef<readonly Prediction[]>
  readonly matches: Ref<readonly Match[]> | ComputedRef<readonly Match[]>
  readonly scoringConfig: Ref<ScoringBuckets | null> | ComputedRef<ScoringBuckets | null>
}

export function useMyStats(args: UseMyStatsArgs): ComputedRef<MyStats> {
  return computed(() => computeMyStats(args.predictions.value, args.matches.value, args.scoringConfig.value))
}
