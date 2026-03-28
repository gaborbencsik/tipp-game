export interface ScoringConfig {
  readonly exactScore: number
  readonly correctWinnerAndDiff: number
  readonly correctWinner: number
  readonly correctDraw: number
  readonly incorrect: number
}

export interface ScoreLine {
  readonly homeGoals: number
  readonly awayGoals: number
}

export interface ApiError {
  readonly status: number
  readonly message: string
  readonly code?: string
}
