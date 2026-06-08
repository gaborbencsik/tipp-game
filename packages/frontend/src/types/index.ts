export interface User {
  readonly id: string
  readonly supabaseId: string
  readonly email: string
  readonly displayName: string
  readonly avatarUrl: string | null
  readonly role: 'user' | 'admin'
  readonly preferredLocale: string
  readonly onboardingCompletedAt: string | null
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
  readonly imageUrl: string | null
}

export type MatchOutcome = 'extra_time_home' | 'extra_time_away' | 'penalties_home' | 'penalties_away'

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

export interface VirtualPointEntry {
  readonly matchId: string
  readonly scheduledAt: string
  readonly homeTeam: { readonly shortCode: string; readonly name: string; readonly flagUrl: string | null }
  readonly awayTeam: { readonly shortCode: string; readonly name: string; readonly flagUrl: string | null }
  readonly predHomeGoals: number
  readonly predAwayGoals: number
  readonly liveHomeScore: number
  readonly liveAwayScore: number
  readonly minute: number | null
  readonly virtualPoints: number
}

export interface MatchOdds {
  readonly homeTeam: { readonly name: string; readonly odds: number }
  readonly draw: number | null
  readonly awayTeam: { readonly name: string; readonly odds: number }
  readonly oneDayChange: { readonly home: number | null; readonly draw: number | null; readonly away: number | null }
  readonly volume: number | null
  readonly avgVolume: number | null
  readonly competitive: number | null
  readonly contextDescription: string | null
  readonly source: string
  readonly sourceUrl: string | null
  readonly updatedAt: string
}

export interface MatchOddsResponse {
  readonly odds: MatchOdds | null
  readonly revealed: boolean
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

export interface MatchResultInput {
  readonly homeGoals: number
  readonly awayGoals: number
  readonly outcomeAfterDraw?: MatchOutcome | null
  readonly scorerPlayerIds?: ReadonlyArray<string>
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
  readonly scorerPickPlayerId?: string | null
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

export interface MatchPrediction {
  readonly userId: string
  readonly displayName: string
  readonly homeGoals: number
  readonly awayGoals: number
  readonly pointsGlobal: number | null
  readonly isPaid?: boolean
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

export interface GroupMyPredictionsResult {
  readonly predictions: GroupMatchPrediction[]
  readonly totalPoints: number
}

export interface AdminUser {
  readonly id: string
  readonly email: string
  readonly displayName: string
  readonly role: 'user' | 'admin'
  readonly bannedAt: string | null
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

export interface LeaderboardEntry {
  readonly rank: number
  readonly userId: string
  readonly displayName: string
  readonly avatarUrl: string | null
  readonly totalPoints: number
  readonly predictionCount: number
  readonly correctCount: number
  readonly specialPredictionPoints: number
  readonly favoriteTeam?: { readonly countryCode: string; readonly name: string } | null
  readonly isPaid?: boolean
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

export interface StatPredictionTemplate {
  readonly id: string
  readonly name: string
  readonly description: string
  readonly inputType: SpecialPredictionInputType
  readonly options: string[] | null
  readonly defaultPoints: number
}

export interface ScoringConfigFull {
  readonly id: string
  readonly name: string
  readonly correctOutcomePoints: number
  readonly exactBonusPoints: number
  readonly extraTimeBonusPoints: number
  readonly frozenAt?: string | null
}

export interface ScoringConfigWithImpact extends ScoringConfigFull {
  readonly affectedMatches: number
  readonly affectedPredictions: number
}

export interface ScoringConfigInput {
  readonly correctOutcomePoints: number
  readonly exactBonusPoints: number
  readonly extraTimeBonusPoints: number
}

export interface ScoringOverrideInput {
  readonly values: ScoringConfigInput
  readonly reason: string
  readonly comment?: string
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

export type WaitlistSource = 'hero' | 'footer' | 'admin'

export interface WaitlistEntry {
  readonly id: string
  readonly email: string
  readonly source: WaitlistSource
  readonly createdAt: string
}

export interface WaitlistFilters {
  readonly source?: WaitlistSource
  readonly search?: string
}

export interface WaitlistListResult {
  readonly totalCount: number
  readonly entries: WaitlistEntry[]
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

export interface UserLeagueFavorite {
  readonly id: string
  readonly userId: string
  readonly leagueId: string
  readonly teamId: string
  readonly setAt: string
  readonly isLocked: boolean
}

export interface LeagueTeam {
  readonly id: string
  readonly name: string
  readonly shortCode: string
  readonly flagUrl: string | null
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
