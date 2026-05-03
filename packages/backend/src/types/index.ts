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
  readonly onboardingCompletedAt: string | null
}

export type MatchOutcome = 'extra_time_home' | 'extra_time_away' | 'penalties_home' | 'penalties_away'

export interface ScoringConfig {
  readonly exactScore: number
  readonly correctWinnerAndDiff: number
  readonly correctWinner: number
  readonly correctDraw: number
  readonly correctOutcome: number
  readonly incorrect: number
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
  readonly teamType: 'national' | 'club'
  readonly countryCode: string | null
}

export interface MatchVenue {
  readonly name: string
  readonly city: string
}

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
  readonly league: { id: string; name: string; shortName: string } | null
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
  readonly leagueId?: string
}

export interface MatchInput {
  readonly homeTeamId: string
  readonly awayTeamId: string
  readonly venueId?: string | null
  readonly leagueId?: string | null
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
  readonly leagueId: string | null
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
  readonly outcomeAfterDraw: string | null
  readonly recordedBy: string | null
  readonly recordedAt: Date
  readonly updatedAt: Date
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

export interface Player {
  readonly id: string
  readonly name: string
  readonly teamId: string | null
  readonly teamName: string | null
  readonly teamShortCode: string | null
  readonly position: string | null
  readonly shirtNumber: number | null
  readonly createdAt: string
  readonly updatedAt: string
}

export interface PlayerInput {
  readonly name: string
  readonly teamId?: string | null
  readonly position?: string | null
  readonly shirtNumber?: number | null
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
  readonly userRank: number | null
  readonly favoriteTeamDoublePoints: boolean
  readonly leagues: ReadonlyArray<{ readonly id: string; readonly name: string; readonly shortName: string }>
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
  readonly leagueId: string
}

export interface JoinGroupInput {
  readonly inviteCode: string
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

export interface GroupMatchPrediction {
  readonly predictionId: string
  readonly matchId: string
  readonly scheduledAt: string
  readonly homeTeam: { readonly id: string; readonly name: string; readonly shortCode: string; readonly flagUrl: string | null }
  readonly awayTeam: { readonly id: string; readonly name: string; readonly shortCode: string; readonly flagUrl: string | null }
  readonly homeGoals: number
  readonly awayGoals: number
  readonly resultHomeGoals: number
  readonly resultAwayGoals: number
  readonly points: number
  readonly doubledByFavorite: boolean
}

export type SpecialPredictionInputType = 'text' | 'dropdown' | 'team_select' | 'player_select'

export interface SpecialPredictionType {
  readonly id: string
  readonly groupId: string | null
  readonly name: string
  readonly description: string | null
  readonly inputType: SpecialPredictionInputType
  readonly options: string[] | null
  readonly deadline: string
  readonly points: number
  readonly correctAnswer: string | null
  readonly isGlobal: boolean
  readonly isActive: boolean
  readonly createdAt: string
  readonly updatedAt: string
}

export interface SpecialTypeInput {
  readonly name: string
  readonly description?: string | null
  readonly inputType: SpecialPredictionInputType
  readonly options?: string[] | null
  readonly deadline: string
  readonly points: number
}

export interface SpecialPrediction {
  readonly id: string
  readonly userId: string
  readonly typeId: string
  readonly answer: string
  readonly points: number | null
  readonly createdAt: string
  readonly updatedAt: string
}

export interface SpecialPredictionWithType {
  readonly id: string | null
  readonly typeId: string
  readonly typeName: string
  readonly typeDescription: string | null
  readonly inputType: SpecialPredictionInputType
  readonly options: string[] | null
  readonly deadline: string
  readonly maxPoints: number
  readonly answer: string | null
  readonly answerLabel: string | null
  readonly points: number | null
  readonly correctAnswer: string | null
  readonly correctAnswerLabel: string | null
  readonly isGlobal: boolean
  readonly createdAt: string | null
  readonly updatedAt: string | null
}

export interface League {
  readonly id: string
  readonly name: string
  readonly shortName: string
  readonly createdAt: string
  readonly updatedAt: string
}

export interface LeagueInput {
  readonly name: string
  readonly shortName: string
}

export interface MatchPrediction {
  readonly userId: string
  readonly displayName: string
  readonly homeGoals: number
  readonly awayGoals: number
  readonly pointsGlobal: number | null
}

export interface SpecialPredictionInput {
  readonly typeId: string
  readonly answer: string
}

export interface GlobalTypeWithSubscription {
  readonly id: string
  readonly name: string
  readonly description: string | null
  readonly inputType: SpecialPredictionInputType
  readonly options: string[] | null
  readonly deadline: string
  readonly points: number
  readonly correctAnswer: string | null
  readonly isActive: boolean
  readonly createdAt: string
  readonly updatedAt: string
  readonly subscribed: boolean
}

export interface UserLeagueFavorite {
  readonly id: string
  readonly userId: string
  readonly leagueId: string
  readonly teamId: string
  readonly setAt: string
  readonly isLocked: boolean
}

export interface SetFavoriteInput {
  readonly teamId: string
}

// ─── FOOTBALL API SYNC ─────────────────────────────────────────────────────────

export type SyncMode = 'off' | 'final_only' | 'adaptive' | 'full_live'

export interface SyncRunResult {
  readonly startedAt: string
  readonly finishedAt: string
  readonly mode: SyncMode
  readonly leaguesSynced: number
  readonly fixturesUpserted: number
  readonly teamsUpserted: number
  readonly resultsUpserted: number
  readonly errors: readonly string[]
  readonly partial: boolean
}

export interface ApiFootballFixtureStatus {
  readonly short: string
  readonly long: string
  readonly elapsed: number | null
}

export interface ApiFootballVenue {
  readonly id: number | null
  readonly name: string | null
  readonly city: string | null
}

export interface ApiFootballTeamEntry {
  readonly id: number
  readonly name: string
  readonly code: string | null
  readonly logo: string
  readonly national: boolean
}

export interface ApiFootballFixture {
  readonly fixture: {
    readonly id: number
    readonly date: string
    readonly status: ApiFootballFixtureStatus
    readonly venue: ApiFootballVenue
  }
  readonly league: {
    readonly id: number
    readonly round: string
  }
  readonly teams: {
    readonly home: ApiFootballTeamEntry
    readonly away: ApiFootballTeamEntry
  }
  readonly goals: {
    readonly home: number | null
    readonly away: number | null
  }
  readonly score: {
    readonly fulltime: { readonly home: number | null; readonly away: number | null }
    readonly penalty: { readonly home: number | null; readonly away: number | null }
  }
}

export interface ApiFootballTeam {
  readonly team: ApiFootballTeamEntry
  readonly venue: ApiFootballVenue | null
}

export interface ApiFootballResponse<T> {
  readonly results: number
  readonly response: readonly T[]
}
