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
