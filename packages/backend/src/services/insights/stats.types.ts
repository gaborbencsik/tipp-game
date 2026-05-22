export interface RecentMatch {
  readonly date: string
  readonly competition: string
  readonly opponent: string
  readonly goalsFor: number
  readonly goalsAgainst: number
  readonly result: 'W' | 'D' | 'L'
}

export interface TeamStats {
  readonly externalId: number
  readonly totalMatches: number
  readonly wins: number
  readonly draws: number
  readonly losses: number
  readonly winRate: number
  readonly goalsScored: number
  readonly goalsScoredPerMatch: number
  readonly goalsConceded: number
  readonly goalsConcededPerMatch: number
  readonly cleanSheets: number
  readonly cleanSheetRate: number
  readonly formString: string
  readonly recentMatches: readonly RecentMatch[]
}

export interface RawMatchStats {
  readonly homeTeam: TeamStats
  readonly awayTeam: TeamStats
}

export class StatsCollectionError extends Error {
  constructor(
    message: string,
    public readonly cause?: unknown,
  ) {
    super(message)
    this.name = 'StatsCollectionError'
  }
}
