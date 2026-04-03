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
  readonly role: 'user' | 'admin'
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

export interface MatchInput {
  readonly homeTeamId: string
  readonly awayTeamId: string
  readonly venueId?: string | null
  readonly stage: MatchStage
  readonly groupName?: string | null
  readonly matchNumber?: number | null
  readonly scheduledAt: string
  readonly status?: MatchStatus
}

export interface MatchRow {
  readonly id: string
  readonly homeTeamId: string
  readonly awayTeamId: string
  readonly venueId: string | null
  readonly stage: MatchStage
  readonly groupName: string | null
  readonly matchNumber: number | null
  readonly scheduledAt: Date
  readonly status: MatchStatus
  readonly createdAt: Date
  readonly updatedAt: Date
  readonly deletedAt: Date | null
}

export interface MatchResultRow {
  readonly id: string
  readonly matchId: string
  readonly homeGoals: number
  readonly awayGoals: number
  readonly recordedBy: string
  readonly recordedAt: Date
  readonly updatedAt: Date
}

export interface Team {
  readonly id: string
  readonly name: string
  readonly shortCode: string
  readonly flagUrl: string | null
  readonly group: string | null
}

export interface TeamInput {
  readonly name: string
  readonly shortCode: string
  readonly flagUrl?: string | null
  readonly group?: string | null
}

export interface AdminUser {
  readonly id: string
  readonly email: string
  readonly displayName: string
  readonly role: 'user' | 'admin'
  readonly bannedAt: string | null
  readonly createdAt: string
}

export interface PredictionInput {
  readonly matchId: string
  readonly homeGoals: number
  readonly awayGoals: number
}

export interface Prediction {
  readonly id: string
  readonly userId: string
  readonly matchId: string
  readonly homeGoals: number
  readonly awayGoals: number
  readonly pointsGlobal: number | null
  readonly createdAt: string
  readonly updatedAt: string
}
