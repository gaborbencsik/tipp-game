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
  readonly preferredLocale: string
  readonly onboardingCompletedAt: string | null
  readonly isSupporter: boolean
}

export type MatchOutcome = 'extra_time_home' | 'extra_time_away' | 'penalties_home' | 'penalties_away'

export interface ScoringConfig {
  readonly correctOutcomePoints: number
  readonly exactBonusPoints: number
  readonly extraTimeBonusPoints: number
}

export interface ScoringConfigFull {
  readonly id: string
  readonly name: string
  readonly correctOutcomePoints: number
  readonly exactBonusPoints: number
  readonly extraTimeBonusPoints: number
  readonly frozenAt: string | null
}

export interface ScoringConfigWithImpact extends ScoringConfigFull {
  readonly affectedMatches: number
  readonly affectedPredictions: number
}

export interface ScoringOverrideInput {
  readonly values: ScoringConfigInput
  readonly reason: 'wrong_setup' | 'organizer_request' | 'technical_fix' | 'other'
  readonly comment?: string | null
  readonly recalculate: boolean
}

export interface RecalcResult {
  readonly matchesRecalculated: number
  readonly predictionsUpdated: number
  readonly durationMs: number
  readonly groupId: string | null
  readonly finishedAt: string
  readonly error?: string
}

export interface RecalcStatus {
  readonly status: 'idle' | 'running'
  readonly lastResult: RecalcResult | null
}

export interface ScoringConfigInput {
  readonly correctOutcomePoints: number
  readonly exactBonusPoints: number
  readonly extraTimeBonusPoints: number
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
  readonly imageUrl: string | null
}

export interface MatchResult {
  readonly homeGoals: number
  readonly awayGoals: number
  readonly outcomeAfterDraw?: MatchOutcome | null
  readonly scorerPlayerIds?: ReadonlyArray<string>
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
  readonly leagueIds?: readonly string[]
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
  readonly externalId: number | null
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
  readonly teamFlagUrl: string | null
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
  readonly isSupporter: boolean
  readonly createdAt: string
}

export interface AdminStatsSummary {
  readonly userCount: number
  readonly activeUsers7d: number
  readonly predictionCount: number
  readonly fillRate: number
  readonly groupCount: number
  readonly avgGroupSize: number
  readonly zeroTipUsers: number
}

export interface AdminStatsUser {
  readonly id: string
  readonly avatarUrl: string | null
  readonly displayName: string
  readonly tipCount: number
  readonly fillPercent: number
  readonly points: number
  readonly groupCount: number
  readonly lastActivity: string | null
  readonly isBanned: boolean
}

export interface AdminStatsResponse {
  readonly summary: AdminStatsSummary
  readonly users: AdminStatsUser[]
}

export interface AdminStatsMatch {
  readonly matchId: string
  readonly homeTeam: string
  readonly awayTeam: string
  readonly date: string
  readonly tippedCount: number
  readonly totalUsers: number
  readonly fillPercent: number
  readonly result: string | null
}

export interface AdminStatsMatchesResponse {
  readonly matches: AdminStatsMatch[]
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
  readonly league: { readonly id: string; readonly name: string; readonly shortName: string } | null
  readonly createdAt: string
}

export interface GroupMember {
  readonly id: string
  readonly userId: string
  readonly displayName: string
  readonly avatarUrl: string | null
  readonly isAdmin: boolean
  readonly isPaid: boolean
  readonly isSupporter: boolean
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
  readonly scorerPickPlayerId?: string | null
}

export interface AdminMatchResultInput {
  readonly homeGoals: number
  readonly awayGoals: number
  readonly outcomeAfterDraw?: MatchOutcome | null
  readonly scorerPlayerIds?: readonly string[]
}

export interface Prediction {
  readonly id: string
  readonly userId: string
  readonly matchId: string
  readonly homeGoals: number
  readonly awayGoals: number
  readonly outcomeAfterDraw: MatchOutcome | null
  readonly pointsGlobal: number | null
  readonly scorerPickPlayerId: string | null
  readonly scorerPlayerNameSnapshot: string | null
  readonly scorerBonusPoints: number | null
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

export type SpecialPredictionInputType = 'text' | 'dropdown' | 'team_select' | 'player_select' | 'multi_team_weighted' | 'multi_team_select' | 'all_groups_standing' | 'bracket_progression'

export interface MultiTeamWeightedChoice {
  readonly teamId: string
  readonly points: number
}

export interface MultiTeamWeightedOptions {
  readonly maxPicks: number
  readonly minPicks: number
  readonly choices: readonly MultiTeamWeightedChoice[]
}

export interface MultiTeamSelectOptions {
  readonly maxPicks: number
  readonly minPicks: number
  readonly teamIds: readonly string[]
}

export interface AllGroupsStandingOptions {
  readonly groups: readonly string[]
  readonly teamsPerGroup: number
  readonly best3rdPicks: number
}

export interface AllGroupsStandingAnswer {
  readonly groups: Record<string, readonly (string | null)[]>
  readonly best3rds: readonly string[]
}

export interface AllGroupsStandingCompletion {
  readonly groupsDone: number
  readonly best3rdsDone: number
  readonly totalDone: number
  readonly totalSteps: number
}

export type BracketRound = 'last_32' | 'last_16' | 'qf' | 'sf' | 'final' | 'bronze'

export interface BracketMatch {
  readonly id: string
  readonly round: BracketRound
  readonly slotA: string
  readonly slotB: string
  readonly winnerTo: string | null
}

export interface BracketProgressionOptions {
  readonly bracketTemplate: { readonly matches: readonly BracketMatch[] }
}

export interface BracketProgressionAnswer {
  readonly winners: Readonly<Record<string, string>>
}

export interface BracketProgressionRoundCompletion {
  readonly done: number
  readonly total: number
}

export interface BracketProgressionCompletion {
  readonly picksByRound: Readonly<Record<BracketRound, BracketProgressionRoundCompletion>>
  readonly totalDone: number
  readonly totalSteps: number
}

export type SpecialPredictionOptions = string[] | MultiTeamWeightedOptions | MultiTeamSelectOptions | AllGroupsStandingOptions | BracketProgressionOptions | null

export interface SpecialPredictionType {
  readonly id: string
  readonly groupId: string | null
  readonly name: string
  readonly description: string | null
  readonly inputType: SpecialPredictionInputType
  readonly options: SpecialPredictionOptions
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
  readonly options: SpecialPredictionOptions
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
  readonly completion?: AllGroupsStandingCompletion | BracketProgressionCompletion
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
  readonly isPaid?: boolean
  readonly isSupporter: boolean
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
  readonly options: SpecialPredictionOptions
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
  readonly paging: { readonly current: number; readonly total: number }
  readonly response: readonly T[]
}

// ─── PLAYER SYNC (api-football.com) ──────────────────────────────────────────

export interface ApiFootballSquadPlayer {
  readonly id: number
  readonly name: string
  readonly age: number | null
  readonly number: number | null
  readonly position: string | null
  readonly photo: string | null
}

export interface ApiFootballSquad {
  readonly team: { readonly id: number; readonly name: string; readonly logo: string }
  readonly players: readonly ApiFootballSquadPlayer[]
}

export interface ApiFootballPlayerStat {
  readonly team: { readonly id: number }
  readonly league: { readonly id: number | null; readonly name: string | null; readonly season: number }
  readonly games: { readonly appearences: number | null; readonly position: string | null; readonly number: number | null }
  readonly goals: { readonly total: number | null; readonly assists: number | null; readonly conceded: number | null }
  readonly passes: { readonly total: number | null; readonly key: number | null; readonly accuracy: number | null }
  readonly duels: { readonly total: number | null; readonly won: number | null }
  readonly cards: { readonly yellow: number | null; readonly red: number | null }
}

export interface ApiFootballPlayerEntry {
  readonly player: {
    readonly id: number
    readonly name: string
    readonly firstname: string
    readonly lastname: string
    readonly age: number | null
    readonly photo: string | null
  }
  readonly statistics: readonly ApiFootballPlayerStat[]
}

export interface PlayerSyncResult {
  readonly inserted: number
  readonly updated: number
  readonly statsUpserted: number
  readonly skipped: number
  readonly errors: readonly string[]
}

export interface TransfermarktSyncResult {
  readonly updated: number
  readonly skipped: number
  readonly errors: readonly string[]
}

export interface ScoringExplainerSpecialType {
  readonly id: string
  readonly name: string
  readonly description: string | null
  readonly points: number
  readonly source: 'group-owned' | 'subscribed-global'
}

export interface ScoringExplainerGroup {
  readonly id: string
  readonly name: string
  readonly config: ScoringConfigFull
  readonly configFrozenAt: string | null
  readonly favoriteTeamDoublePoints: boolean
  readonly specialTypes: ReadonlyArray<ScoringExplainerSpecialType>
}

export interface ScoringExplainerResponse {
  readonly default: ScoringConfigFull
  readonly defaultFrozenAt: string | null
  readonly groups: ReadonlyArray<ScoringExplainerGroup>
}
