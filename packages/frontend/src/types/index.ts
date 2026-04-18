export interface User {
  readonly id: string
  readonly supabaseId: string
  readonly email: string
  readonly displayName: string
  readonly avatarUrl: string | null
  readonly role: 'user' | 'admin'
}

export interface ApiResponse<T> {
  readonly data: T
}

export interface ApiErrorResponse {
  readonly error: string
}

export type MatchStatus = 'scheduled' | 'live' | 'finished' | 'cancelled'
export type MatchStage = 'group' | 'round_of_16' | 'quarter_final' | 'semi_final' | 'third_place' | 'final'

export interface MatchTeam {
  readonly id: string
  readonly name: string
  readonly shortCode: string
  readonly flagUrl: string | null
  readonly teamType: 'national' | 'club'
  readonly countryCode: string | null
}

export interface MatchVenue {
  readonly name: string
  readonly city: string
}

export type MatchOutcome = 'extra_time_home' | 'extra_time_away' | 'penalties_home' | 'penalties_away'

export interface MatchResult {
  readonly homeGoals: number
  readonly awayGoals: number
  readonly outcomeAfterDraw?: MatchOutcome | null
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

export interface MatchResultInput {
  readonly homeGoals: number
  readonly awayGoals: number
  readonly outcomeAfterDraw?: MatchOutcome | null
}

export interface MatchDateGroup {
  readonly date: string
  readonly label: string
  readonly matches: Match[]
}

export interface Team {
  readonly id: string
  readonly name: string
  readonly shortCode: string
  readonly flagUrl: string | null
  readonly group: string | null
  readonly teamType: 'national' | 'club'
  readonly countryCode: string | null
}

export interface TeamInput {
  readonly name: string
  readonly shortCode: string
  readonly flagUrl?: string | null
  readonly group?: string | null
  readonly teamType?: 'national' | 'club'
  readonly countryCode?: string | null
}

export interface PredictionInput {
  readonly matchId: string
  readonly homeGoals: number
  readonly awayGoals: number
  readonly outcomeAfterDraw?: MatchOutcome | null
}

export interface Prediction {
  readonly id: string
  readonly userId: string
  readonly matchId: string
  readonly homeGoals: number
  readonly awayGoals: number
  readonly outcomeAfterDraw: MatchOutcome | null
  readonly pointsGlobal: number | null
  readonly createdAt: string
  readonly updatedAt: string
}

export interface AdminUser {
  readonly id: string
  readonly email: string
  readonly displayName: string
  readonly role: 'user' | 'admin'
  readonly bannedAt: string | null
  readonly createdAt: string
}

export interface Group {
  readonly id: string
  readonly name: string
  readonly description: string | null
  readonly inviteCode: string
  readonly inviteActive: boolean
  readonly createdBy: string
  readonly memberCount: number
  readonly isAdmin: boolean
  readonly createdAt: string
}

export interface GroupMember {
  readonly id: string
  readonly userId: string
  readonly displayName: string
  readonly avatarUrl: string | null
  readonly isAdmin: boolean
  readonly joinedAt: string
}

export interface GroupInput {
  readonly name: string
  readonly description?: string | null
}

export interface JoinGroupInput {
  readonly inviteCode: string
}

export interface LeaderboardEntry {
  readonly rank: number
  readonly userId: string
  readonly displayName: string
  readonly avatarUrl: string | null
  readonly totalPoints: number
  readonly predictionCount: number
  readonly correctCount: number
}

export interface ScoringConfigFull {
  readonly id: string
  readonly name: string
  readonly exactScore: number
  readonly correctWinnerAndDiff: number
  readonly correctWinner: number
  readonly correctDraw: number
  readonly correctOutcome: number
  readonly incorrect: number
}

export interface ScoringConfigInput {
  readonly exactScore: number
  readonly correctWinnerAndDiff: number
  readonly correctWinner: number
  readonly correctDraw: number
  readonly correctOutcome: number
  readonly incorrect: number
}
