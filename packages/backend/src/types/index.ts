export interface SupabaseUserClaims {
  readonly sub: string
  readonly email: string
  readonly user_metadata: {
    readonly full_name?: string
    readonly avatar_url?: string
  }
}

export interface AuthenticatedUser {
  readonly supabaseId: string
  readonly email: string
  readonly displayName: string
  readonly avatarUrl: string | null
}

export interface DbUser {
  readonly id: string
  readonly supabaseId: string
  readonly email: string
  readonly displayName: string
  readonly avatarUrl: string | null
  readonly role: 'user' | 'admin'
}

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

export type MatchStatus = 'scheduled' | 'live' | 'finished' | 'cancelled'
export type MatchStage = 'group' | 'round_of_16' | 'quarter_final' | 'semi_final' | 'third_place' | 'final'

export interface MatchTeam {
  readonly id: string
  readonly name: string
  readonly shortCode: string
  readonly flagUrl: string | null
}

export interface MatchVenue {
  readonly name: string
  readonly city: string
}

export interface MatchResult {
  readonly homeGoals: number
  readonly awayGoals: number
}

export interface Match {
  readonly id: string
  readonly homeTeam: MatchTeam
  readonly awayTeam: MatchTeam
  readonly venue: MatchVenue | null
  readonly stage: MatchStage
  readonly groupName: string | null
  readonly matchNumber: number | null
  readonly scheduledAt: string
  readonly status: MatchStatus
  readonly result: MatchResult | null
}

export interface MatchesFilters {
  readonly stage?: MatchStage
  readonly status?: MatchStatus
}
