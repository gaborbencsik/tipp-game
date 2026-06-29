import {
  pgTable, uuid, varchar, text, integer, boolean,
  timestamp, pgEnum, uniqueIndex, index,
  jsonb, smallint, doublePrecision
} from 'drizzle-orm/pg-core'
import { relations, sql } from 'drizzle-orm'

// ─── ENUMS ────────────────────────────────────────────────────────────────────

export const userRoleEnum = pgEnum('user_role', ['user', 'admin'])

export const teamTypeEnum = pgEnum('team_type', ['national', 'club'])

export const matchStatusEnum = pgEnum('match_status', [
  'scheduled',
  'live',
  'finished',
  'cancelled',
])

export const matchStageEnum = pgEnum('match_stage', [
  'group',
  'round_of_32',
  'round_of_16',
  'quarter_final',
  'semi_final',
  'third_place',
  'final',
])

export const specialPredictionInputTypeEnum = pgEnum(
  'special_prediction_input_type',
  ['text', 'dropdown', 'number', 'team_select', 'player_select', 'multi_team_weighted', 'multi_team_select', 'all_groups_standing', 'bracket_progression']
)

export const auditActionEnum = pgEnum('audit_action', [
  'create', 'update', 'delete', 'result_set', 'ban', 'role_change', 'push_send', 'group_member_paid_set', 'user_supporter_set'
])

export const pushNotificationTypeEnum = pgEnum('push_notification_type', [
  'match_kickoff_reminder',
  'tournament_tip_deadline',
  'daily_match_review',
  'admin_broadcast',
])

export const pushSkippedReasonEnum = pgEnum('push_skipped_reason', [
  'quiet_hours',
  'rate_limit',
  'push_disabled',
  'no_subscription',
])

export const waitlistSourceEnum = pgEnum('waitlist_source', ['hero', 'footer', 'admin'])

export const insightTypeEnum = pgEnum('insight_type', [
  'raw_stats',
  'defense',
  'attack',
  'form',
  'set_pieces',
  'key_matchup',
  'fatigue',
  'historical',
])

// ─── USERS ────────────────────────────────────────────────────────────────────

export const users = pgTable('users', {
  id:          uuid('id').primaryKey().defaultRandom(),
  supabaseId:  uuid('supabase_id').notNull().unique(),
  email:       varchar('email', { length: 255 }).notNull().unique(),
  displayName: varchar('display_name', { length: 30 }).notNull(),
  avatarUrl:   text('avatar_url'),
  role:        userRoleEnum('role').notNull().default('user'),
  preferredLocale: varchar('preferred_locale', { length: 5 }).notNull().default('hu'),
  pushEnabled: boolean('push_enabled').notNull().default(false),
  onboardingCompletedAt: timestamp('onboarding_completed_at', { withTimezone: true }),
  bannedAt:    timestamp('banned_at', { withTimezone: true }),
  banReason:   text('ban_reason'),
  supporterAt: timestamp('supporter_at', { withTimezone: true }),
  createdAt:   timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt:   timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  deletedAt:   timestamp('deleted_at', { withTimezone: true }),
}, (t) => ({
  emailIdx:      uniqueIndex('users_email_idx').on(t.email),
  supabaseIdIdx: uniqueIndex('users_supabase_id_idx').on(t.supabaseId),
}))

// ─── TEAMS ────────────────────────────────────────────────────────────────────

export const teams = pgTable('teams', {
  id:          uuid('id').primaryKey().defaultRandom(),
  name:        varchar('name', { length: 100 }).notNull(),
  shortCode:   varchar('short_code', { length: 4 }).notNull().unique(),
  flagUrl:     text('flag_url'),
  group:       varchar('group', { length: 20 }),
  teamType:    teamTypeEnum('team_type').notNull().default('national'),
  countryCode: varchar('country_code', { length: 10 }),
  externalId:       integer('external_id').unique(),
  transfermarktId:  integer('transfermarkt_id'),
  squadMarketValue: integer('squad_market_value'),
  createdAt:        timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt:        timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
})

// ─── PLAYERS ─────────────────────────────────────────────────────────────────

export const players = pgTable('players', {
  id:          uuid('id').primaryKey().defaultRandom(),
  name:        varchar('name', { length: 100 }).notNull(),
  shortName:   varchar('short_name', { length: 100 }),
  teamId:      uuid('team_id').references(() => teams.id),
  position:    varchar('position', { length: 30 }),
  shirtNumber: smallint('shirt_number'),
  externalId:  integer('external_id').unique(),
  createdAt:   timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt:   timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
}, (t) => ({
  teamIdIdx: index('players_team_id_idx').on(t.teamId),
}))

// ─── PLAYER STATS ────────────────────────────────────────────────────────────

export const playerStats = pgTable('player_stats', {
  id:           uuid('id').primaryKey().defaultRandom(),
  playerId:     uuid('player_id').notNull().references(() => players.id, { onDelete: 'cascade' }),
  season:       smallint('season').notNull(),
  leagueName:   varchar('league_name', { length: 100 }).notNull(),
  appearances:  smallint('appearances').notNull().default(0),
  goals:        smallint('goals').notNull().default(0),
  assists:      smallint('assists').notNull().default(0),
  conceded:     smallint('conceded').notNull().default(0),
  passes:       integer('passes').notNull().default(0),
  keyPasses:    smallint('key_passes').notNull().default(0),
  passAccuracy: smallint('pass_accuracy'),
  duelsTotal:   integer('duels_total').notNull().default(0),
  duelsWon:     integer('duels_won').notNull().default(0),
  yellowCards:  smallint('yellow_cards').notNull().default(0),
  redCards:     smallint('red_cards').notNull().default(0),
  createdAt:    timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt:    timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
}, (t) => ({
  playerSeasonLeagueIdx: uniqueIndex('player_stats_player_season_league_idx').on(t.playerId, t.season, t.leagueName),
}))

// ─── VENUES ───────────────────────────────────────────────────────────────────

export const venues = pgTable('venues', {
  id:       uuid('id').primaryKey().defaultRandom(),
  name:     varchar('name', { length: 150 }).notNull(),
  city:     varchar('city', { length: 100 }).notNull(),
  country:  varchar('country', { length: 100 }).notNull(),
  capacity: integer('capacity'),
  imageUrl: text('image_url'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
})

// ─── LEAGUES ─────────────────────────────────────────────────────────────────

export const leagues = pgTable('leagues', {
  id:        uuid('id').primaryKey().defaultRandom(),
  name:      varchar('name', { length: 100 }).notNull(),
  shortName: varchar('short_name', { length: 20 }).notNull(),
  startsAt:  timestamp('starts_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
})

// ─── MATCHES ──────────────────────────────────────────────────────────────────

export const matches = pgTable('matches', {
  id:          uuid('id').primaryKey().defaultRandom(),
  homeTeamId:  uuid('home_team_id').notNull().references(() => teams.id),
  awayTeamId:  uuid('away_team_id').notNull().references(() => teams.id),
  venueId:     uuid('venue_id').references(() => venues.id),
  leagueId:    uuid('league_id').references(() => leagues.id),
  stage:       matchStageEnum('stage').notNull(),
  groupName:   varchar('group_name', { length: 20 }),
  matchNumber: smallint('match_number'),
  scheduledAt: timestamp('scheduled_at', { withTimezone: true }).notNull(),
  status:      matchStatusEnum('status').notNull().default('scheduled'),
  externalId:  integer('external_id').unique(),
  polymarketSlug: text('polymarket_slug'),
  createdAt:   timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt:   timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  deletedAt:   timestamp('deleted_at', { withTimezone: true }),
}, (t) => ({
  scheduledAtIdx: index('matches_scheduled_at_idx').on(t.scheduledAt),
  statusIdx:      index('matches_status_idx').on(t.status),
  stageIdx:       index('matches_stage_idx').on(t.stage),
}))

// ─── MATCH RESULTS ────────────────────────────────────────────────────────────

export const matchResults = pgTable('match_results', {
  id:               uuid('id').primaryKey().defaultRandom(),
  matchId:          uuid('match_id').notNull().unique().references(() => matches.id),
  homeGoals:        smallint('home_goals').notNull(),
  awayGoals:        smallint('away_goals').notNull(),
  outcomeAfterDraw: text('outcome_after_draw'),
  recordedBy:       uuid('recorded_by').references(() => users.id),
  recordedAt:       timestamp('recorded_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt:        timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  pointsCalculatedAt: timestamp('points_calculated_at', { withTimezone: true }),
  scorerPlayerIds:  uuid('scorer_player_ids').array().notNull().default(sql`'{}'::uuid[]`),
}, (t) => ({
  matchIdIdx: uniqueIndex('match_results_match_id_idx').on(t.matchId),
  scorerIdsIdx: index('match_results_scorer_ids_idx').using('gin', t.scorerPlayerIds),
}))

// ─── LIVE MATCH STATES ────────────────────────────────────────────────────────

export const liveMatchStates = pgTable('live_match_states', {
  matchId:    uuid('match_id').primaryKey().references(() => matches.id, { onDelete: 'cascade' }),
  homeScore:  smallint('home_score').notNull(),
  awayScore:  smallint('away_score').notNull(),
  minute:     smallint('minute'),
  apiStatus:  text('api_status'),
  updatedAt:  timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
})

// ─── MATCH MARKET DATA ───────────────────────────────────────────────────────

export const matchMarketData = pgTable('match_market_data', {
  id:                  uuid('id').primaryKey().defaultRandom(),
  matchId:             uuid('match_id').notNull().references(() => matches.id),
  source:              text('source').notNull().default('polymarket'),
  homeWin:             doublePrecision('home_win').notNull(),
  draw:                doublePrecision('draw'),
  awayWin:             doublePrecision('away_win').notNull(),
  oneDayChangeHome:    doublePrecision('one_day_change_home'),
  oneDayChangeDraw:    doublePrecision('one_day_change_draw'),
  oneDayChangeAway:    doublePrecision('one_day_change_away'),
  oneWeekChangeHome:   doublePrecision('one_week_change_home'),
  oneWeekChangeDraw:   doublePrecision('one_week_change_draw'),
  oneWeekChangeAway:   doublePrecision('one_week_change_away'),
  marketVolume:        doublePrecision('market_volume'),
  marketLiquidity:     doublePrecision('market_liquidity'),
  bestBidHome:         doublePrecision('best_bid_home'),
  bestAskHome:         doublePrecision('best_ask_home'),
  lastTradePriceHome:  doublePrecision('last_trade_price_home'),
  competitive:         doublePrecision('competitive'),
  contextDescription:  text('context_description'),
  rawPayload:          jsonb('raw_payload'),
  fetchedAt:           timestamp('fetched_at', { withTimezone: true }).notNull().defaultNow(),
  createdAt:           timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
}, (t) => ({
  matchFetchedIdx: index('idx_match_market_data_match_fetched').on(t.matchId, t.fetchedAt),
}))

// ─── MATCH INSIGHTS ──────────────────────────────────────────────────────────

export const matchInsights = pgTable('match_insights', {
  id:           uuid('id').primaryKey().defaultRandom(),
  matchId:      uuid('match_id').notNull().references(() => matches.id, { onDelete: 'cascade' }),
  type:         insightTypeEnum('type').notNull(),
  data:         jsonb('data').notNull(),
  summary:      varchar('summary', { length: 200 }),
  titleHu:      text('title_hu'),
  bodyHu:       text('body_hu'),
  translatedAt: timestamp('translated_at', { withTimezone: true }),
  generatedAt:  timestamp('generated_at', { withTimezone: true }).notNull().defaultNow(),
  version:      smallint('version').notNull().default(1),
  createdAt:    timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt:    timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
}, (t) => ({
  matchTypeIdx: uniqueIndex('match_insights_match_id_type_idx').on(t.matchId, t.type),
  matchIdIdx:   index('match_insights_match_id_idx').on(t.matchId),
}))

// ─── SCORING CONFIGS ──────────────────────────────────────────────────────────

export const scoringConfigs = pgTable('scoring_configs', {
  id:                    uuid('id').primaryKey().defaultRandom(),
  name:                  varchar('name', { length: 100 }).notNull(),
  isGlobalDefault:       boolean('is_global_default').notNull().default(false),
  correctOutcomePoints:  smallint('correct_outcome_points').notNull().default(1),
  exactBonusPoints:      smallint('exact_bonus_points').notNull().default(1),
  extraTimeBonusPoints:  smallint('extra_time_bonus_points').notNull().default(1),
  createdAt:             timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt:             timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
})

// ─── GROUPS ───────────────────────────────────────────────────────────────────

export const groups = pgTable('groups', {
  id:              uuid('id').primaryKey().defaultRandom(),
  name:            varchar('name', { length: 50 }).notNull(),
  description:     text('description'),
  inviteCode:      varchar('invite_code', { length: 8 }).notNull().unique(),
  inviteActive:    boolean('invite_active').notNull().default(true),
  createdBy:       uuid('created_by').notNull().references(() => users.id),
  scoringConfigId: uuid('scoring_config_id').references(() => scoringConfigs.id),
  favoriteTeamDoublePoints: boolean('favorite_team_double_points').notNull().default(false),
  createdAt:       timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt:       timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  deletedAt:       timestamp('deleted_at', { withTimezone: true }),
}, (t) => ({
  inviteCodeIdx: uniqueIndex('groups_invite_code_idx').on(t.inviteCode),
}))

// ─── GROUP MEMBERS ────────────────────────────────────────────────────────────

export const groupMembers = pgTable('group_members', {
  id:       uuid('id').primaryKey().defaultRandom(),
  groupId:  uuid('group_id').notNull().references(() => groups.id, { onDelete: 'cascade' }),
  userId:   uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  isAdmin:  boolean('is_admin').notNull().default(false),
  joinedAt: timestamp('joined_at', { withTimezone: true }).notNull().defaultNow(),
  paidAt:   timestamp('paid_at',   { withTimezone: true }),
}, (t) => ({
  uniqueMember: uniqueIndex('group_members_unique').on(t.groupId, t.userId),
  groupIdx:     index('group_members_group_idx').on(t.groupId),
  userIdx:      index('group_members_user_idx').on(t.userId),
}))

// ─── PREDICTIONS ──────────────────────────────────────────────────────────────

export const predictions = pgTable('predictions', {
  id:               uuid('id').primaryKey().defaultRandom(),
  userId:           uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  matchId:          uuid('match_id').notNull().references(() => matches.id, { onDelete: 'cascade' }),
  homeGoals:        smallint('home_goals').notNull(),
  awayGoals:        smallint('away_goals').notNull(),
  outcomeAfterDraw: text('outcome_after_draw'),
  pointsGlobal:     smallint('points_global'),
  scorerPickPlayerId:        uuid('scorer_pick_player_id').references(() => players.id, { onDelete: 'restrict' }),
  scorerPlayerNameSnapshot:  text('scorer_player_name_snapshot'),
  scorerBonusPoints:         smallint('scorer_bonus_points'),
  createdAt:        timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt:        timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
}, (t) => ({
  uniquePrediction: uniqueIndex('predictions_user_match_unique').on(t.userId, t.matchId),
  userIdx:          index('predictions_user_idx').on(t.userId),
  matchIdx:         index('predictions_match_idx').on(t.matchId),
  scorerPickIdx:    index('predictions_scorer_pick_idx').on(t.scorerPickPlayerId),
}))

// ─── INSIGHT REVEALS ──────────────────────────────────────────────────────────

export const insightReveals = pgTable('insight_reveals', {
  id:         uuid('id').primaryKey().defaultRandom(),
  userId:     uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  matchId:    uuid('match_id').notNull().references(() => matches.id, { onDelete: 'cascade' }),
  revealedAt: timestamp('revealed_at', { withTimezone: true }).notNull().defaultNow(),
}, (t) => ({
  uniqueReveal: uniqueIndex('insight_reveals_user_match_unique').on(t.userId, t.matchId),
  matchIdx:     index('insight_reveals_match_idx').on(t.matchId),
}))

// ─── GROUP PREDICTION POINTS ──────────────────────────────────────────────────

export const groupPredictionPoints = pgTable('group_prediction_points', {
  id:           uuid('id').primaryKey().defaultRandom(),
  predictionId: uuid('prediction_id').notNull().references(() => predictions.id, { onDelete: 'cascade' }),
  groupId:      uuid('group_id').notNull().references(() => groups.id, { onDelete: 'cascade' }),
  points:       smallint('points').notNull(),
  calculatedAt: timestamp('calculated_at', { withTimezone: true }).notNull().defaultNow(),
}, (t) => ({
  uniqueGroupPrediction: uniqueIndex('group_pred_points_unique').on(t.predictionId, t.groupId),
  groupIdx:              index('group_pred_points_group_idx').on(t.groupId),
}))

// ─── SPECIAL PREDICTION TYPES ─────────────────────────────────────────────────

export const specialPredictionTypes = pgTable('special_prediction_types', {
  id:            uuid('id').primaryKey().defaultRandom(),
  groupId:       uuid('group_id').references(() => groups.id, { onDelete: 'cascade' }),
  name:          varchar('name', { length: 100 }).notNull(),
  description:   text('description'),
  inputType:     specialPredictionInputTypeEnum('input_type').notNull(),
  options:       jsonb('options'),
  deadline:      timestamp('deadline', { withTimezone: true }).notNull(),
  points:        smallint('points').notNull().default(5),
  correctAnswer: text('correct_answer'),
  isGlobal:      boolean('is_global').notNull().default(false),
  isActive:      boolean('is_active').notNull().default(true),
  createdAt:     timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt:     timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
}, (t) => ({
  groupIdx: index('spt_group_idx').on(t.groupId),
}))

// ─── SPECIAL PREDICTIONS ──────────────────────────────────────────────────────

export const specialPredictions = pgTable('special_predictions', {
  id:        uuid('id').primaryKey().defaultRandom(),
  userId:    uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  typeId:    uuid('type_id').notNull().references(() => specialPredictionTypes.id),
  groupId:   uuid('group_id').references(() => groups.id),
  answer:    text('answer').notNull(),
  points:    smallint('points'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
}, (t) => ({
  uniqueSpecialPred: uniqueIndex('special_predictions_unique').on(t.userId, t.typeId, t.groupId),
  userIdx:           index('special_predictions_user_idx').on(t.userId),
  groupIdx:          index('special_predictions_group_idx').on(t.groupId),
}))

// ─── GROUP GLOBAL TYPE SUBSCRIPTIONS ─────────────────────────────────────────

export const groupGlobalTypeSubscriptions = pgTable('group_global_type_subscriptions', {
  id:               uuid('id').primaryKey().defaultRandom(),
  groupId:          uuid('group_id').notNull().references(() => groups.id, { onDelete: 'cascade' }),
  globalTypeId:     uuid('global_type_id').notNull().references(() => specialPredictionTypes.id, { onDelete: 'cascade' }),
  subscribedAt:     timestamp('subscribed_at', { withTimezone: true }).notNull().defaultNow(),
  deadlineOverride: timestamp('deadline_override', { withTimezone: true }),
}, (t) => ({
  uniqueSub:     uniqueIndex('ggts_unique').on(t.groupId, t.globalTypeId),
  groupIdx:      index('ggts_group_idx').on(t.groupId),
  globalTypeIdx: index('ggts_global_type_idx').on(t.globalTypeId),
}))

// ─── GROUP LEAGUES ───────────────────────────────────────────────────────────

export const groupLeagues = pgTable('group_leagues', {
  id:       uuid('id').primaryKey().defaultRandom(),
  groupId:  uuid('group_id').notNull().references(() => groups.id, { onDelete: 'cascade' }),
  leagueId: uuid('league_id').notNull().references(() => leagues.id, { onDelete: 'cascade' }),
  addedAt:  timestamp('added_at', { withTimezone: true }).notNull().defaultNow(),
}, (t) => ({
  uniqueGroupLeague: uniqueIndex('group_leagues_unique').on(t.groupId, t.leagueId),
  groupIdx:          index('group_leagues_group_idx').on(t.groupId),
  leagueIdx:         index('group_leagues_league_idx').on(t.leagueId),
}))

// ─── AUDIT LOGS ───────────────────────────────────────────────────────────────

export const auditLogs = pgTable('audit_logs', {
  id:            uuid('id').primaryKey().defaultRandom(),
  actorId:       uuid('actor_id').references(() => users.id),
  action:        auditActionEnum('action').notNull(),
  entityType:    varchar('entity_type', { length: 50 }).notNull(),
  entityId:      uuid('entity_id').notNull(),
  previousValue: jsonb('previous_value'),
  newValue:      jsonb('new_value'),
  ipAddress:     varchar('ip_address', { length: 45 }),
  createdAt:     timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
}, (t) => ({
  actorIdx:     index('audit_logs_actor_idx').on(t.actorId),
  entityIdx:    index('audit_logs_entity_idx').on(t.entityType, t.entityId),
  createdAtIdx: index('audit_logs_created_at_idx').on(t.createdAt),
}))

// ─── WAITLIST ────────────────────────────────────────────────────────────────

export const waitlistEntries = pgTable('waitlist_entries', {
  id:        uuid('id').primaryKey().defaultRandom(),
  email:     varchar('email', { length: 255 }).notNull().unique(),
  source:    waitlistSourceEnum('source').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
})

// ─── USER LEAGUE FAVORITES ───────────────────────────────────────────────────

export const userLeagueFavorites = pgTable('user_league_favorites', {
  id:       uuid('id').primaryKey().defaultRandom(),
  userId:   uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  leagueId: uuid('league_id').notNull().references(() => leagues.id, { onDelete: 'cascade' }),
  teamId:   uuid('team_id').notNull().references(() => teams.id, { onDelete: 'cascade' }),
  setAt:    timestamp('set_at', { withTimezone: true }).notNull().defaultNow(),
}, (t) => ({
  userLeagueUnique: uniqueIndex('ulf_user_league_unique').on(t.userId, t.leagueId),
  userIdx:          index('ulf_user_idx').on(t.userId),
  leagueIdx:        index('ulf_league_idx').on(t.leagueId),
}))

// ─── PUSH NOTIFICATIONS ──────────────────────────────────────────────────────

export const pushSubscriptions = pgTable('push_subscriptions', {
  id:         uuid('id').primaryKey().defaultRandom(),
  userId:     uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  endpoint:   text('endpoint').notNull(),
  auth:       text('auth').notNull(),
  p256dh:     text('p256dh').notNull(),
  userAgent:  text('user_agent'),
  createdAt:  timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  lastUsedAt: timestamp('last_used_at', { withTimezone: true }),
  deletedAt:  timestamp('deleted_at', { withTimezone: true }),
}, (t) => ({
  userEndpointUnique: uniqueIndex('push_sub_user_endpoint_unique').on(t.userId, t.endpoint),
  userIdx:            index('push_sub_user_idx').on(t.userId),
}))

export const pushNotificationLog = pgTable('push_notification_log', {
  id:            uuid('id').primaryKey().defaultRandom(),
  userId:        uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  type:          pushNotificationTypeEnum('type').notNull(),
  scopeKey:      text('scope_key'),
  endpoint:      text('endpoint'),
  sentAt:        timestamp('sent_at', { withTimezone: true }).notNull().defaultNow(),
  clickedAt:     timestamp('clicked_at', { withTimezone: true }),
  skippedReason: pushSkippedReasonEnum('skipped_reason'),
}, (t) => ({
  userTypeScopeUnique: uniqueIndex('push_log_user_type_scope_unique').on(t.userId, t.type, t.scopeKey),
  userIdx:             index('push_log_user_idx').on(t.userId),
  sentAtIdx:           index('push_log_sent_at_idx').on(t.sentAt),
}))

// ─── RELATIONS ────────────────────────────────────────────────────────────────

export const usersRelations = relations(users, ({ many }) => ({
  predictions: many(predictions),
  groupMemberships: many(groupMembers),
  createdGroups: many(groups),
  specialPredictions: many(specialPredictions),
  leagueFavorites: many(userLeagueFavorites),
}))

export const teamsRelations = relations(teams, ({ many }) => ({
  homeMatches: many(matches, { relationName: 'homeTeam' }),
  awayMatches: many(matches, { relationName: 'awayTeam' }),
  players: many(players),
}))

export const playersRelations = relations(players, ({ one, many }) => ({
  team: one(teams, { fields: [players.teamId], references: [teams.id] }),
  stats: many(playerStats),
}))

export const playerStatsRelations = relations(playerStats, ({ one }) => ({
  player: one(players, { fields: [playerStats.playerId], references: [players.id] }),
}))

export const matchesRelations = relations(matches, ({ one, many }) => ({
  homeTeam: one(teams, { fields: [matches.homeTeamId], references: [teams.id], relationName: 'homeTeam' }),
  awayTeam: one(teams, { fields: [matches.awayTeamId], references: [teams.id], relationName: 'awayTeam' }),
  venue: one(venues, { fields: [matches.venueId], references: [venues.id] }),
  league: one(leagues, { fields: [matches.leagueId], references: [leagues.id] }),
  result: one(matchResults, { fields: [matches.id], references: [matchResults.matchId] }),
  liveState: one(liveMatchStates, { fields: [matches.id], references: [liveMatchStates.matchId] }),
  predictions: many(predictions),
}))

export const leaguesRelations = relations(leagues, ({ many }) => ({
  matches: many(matches),
  userFavorites: many(userLeagueFavorites),
  groupLeagues: many(groupLeagues),
}))

export const matchResultsRelations = relations(matchResults, ({ one }) => ({
  match: one(matches, { fields: [matchResults.matchId], references: [matches.id] }),
  recordedByUser: one(users, { fields: [matchResults.recordedBy], references: [users.id] }),
}))

export const liveMatchStatesRelations = relations(liveMatchStates, ({ one }) => ({
  match: one(matches, { fields: [liveMatchStates.matchId], references: [matches.id] }),
}))

export const predictionsRelations = relations(predictions, ({ one, many }) => ({
  user: one(users, { fields: [predictions.userId], references: [users.id] }),
  match: one(matches, { fields: [predictions.matchId], references: [matches.id] }),
  groupPoints: many(groupPredictionPoints),
}))

export const groupsRelations = relations(groups, ({ one, many }) => ({
  createdByUser: one(users, { fields: [groups.createdBy], references: [users.id] }),
  scoringConfig: one(scoringConfigs, { fields: [groups.scoringConfigId], references: [scoringConfigs.id] }),
  members: many(groupMembers),
  groupPoints: many(groupPredictionPoints),
  specialTypes: many(specialPredictionTypes),
  globalTypeSubscriptions: many(groupGlobalTypeSubscriptions),
  leagues: many(groupLeagues),
}))

export const groupMembersRelations = relations(groupMembers, ({ one }) => ({
  group: one(groups, { fields: [groupMembers.groupId], references: [groups.id] }),
  user: one(users, { fields: [groupMembers.userId], references: [users.id] }),
}))

export const specialPredictionTypesRelations = relations(specialPredictionTypes, ({ one, many }) => ({
  group: one(groups, { fields: [specialPredictionTypes.groupId], references: [groups.id] }),
  predictions: many(specialPredictions),
  subscriptions: many(groupGlobalTypeSubscriptions),
}))

export const specialPredictionsRelations = relations(specialPredictions, ({ one }) => ({
  user: one(users, { fields: [specialPredictions.userId], references: [users.id] }),
  type: one(specialPredictionTypes, { fields: [specialPredictions.typeId], references: [specialPredictionTypes.id] }),
  group: one(groups, { fields: [specialPredictions.groupId], references: [groups.id] }),
}))

export const groupGlobalTypeSubscriptionsRelations = relations(groupGlobalTypeSubscriptions, ({ one }) => ({
  group: one(groups, { fields: [groupGlobalTypeSubscriptions.groupId], references: [groups.id] }),
  globalType: one(specialPredictionTypes, { fields: [groupGlobalTypeSubscriptions.globalTypeId], references: [specialPredictionTypes.id] }),
}))

export const userLeagueFavoritesRelations = relations(userLeagueFavorites, ({ one }) => ({
  user: one(users, { fields: [userLeagueFavorites.userId], references: [users.id] }),
  league: one(leagues, { fields: [userLeagueFavorites.leagueId], references: [leagues.id] }),
  team: one(teams, { fields: [userLeagueFavorites.teamId], references: [teams.id] }),
}))

export const groupLeaguesRelations = relations(groupLeagues, ({ one }) => ({
  group: one(groups, { fields: [groupLeagues.groupId], references: [groups.id] }),
  league: one(leagues, { fields: [groupLeagues.leagueId], references: [leagues.id] }),
}))

// ─── SYNC STATE ──────────────────────────────────────────────────────────────

export const syncState = pgTable('sync_state', {
  id:                   uuid('id').primaryKey().defaultRandom(),
  mode:                 text('mode').notNull().default('off'),
  lastSuccessfulSyncAt: timestamp('last_successful_sync_at', { withTimezone: true }),
  apiCallsToday:        integer('api_calls_today').notNull().default(0),
  apiCallsDate:         text('api_calls_date').notNull().default(''),
  syncInProgress:       boolean('sync_in_progress').notNull().default(false),
  polymarketSyncEnabled: boolean('polymarket_sync_enabled').notNull().default(false),
  lastPolymarketSyncAt:      timestamp('last_polymarket_sync_at', { withTimezone: true }),
  playerSyncEnabled:         boolean('player_sync_enabled').notNull().default(false),
  lastPlayerSyncAt:          timestamp('last_player_sync_at', { withTimezone: true }),
  transfermarktSyncEnabled:  boolean('transfermarkt_sync_enabled').notNull().default(false),
  lastTransfermarktSyncAt:   timestamp('last_transfermarkt_sync_at', { withTimezone: true }),
  rawStatsSyncEnabled:       boolean('raw_stats_sync_enabled').notNull().default(false),
  lastRawStatsSyncAt:        timestamp('last_raw_stats_sync_at', { withTimezone: true }),
  rawStatsSkipFresh:         boolean('raw_stats_skip_fresh').notNull().default(false),
  recalcInProgress:          boolean('recalc_in_progress').notNull().default(false),
  lastRecalcResult:          jsonb('last_recalc_result'),
  insightsSyncEnabled:       boolean('insights_sync_enabled').notNull().default(false),
  lastInsightsSyncAt:        timestamp('last_insights_sync_at', { withTimezone: true }),
  updatedAt:                 timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
})

// ─── PUSH SETTINGS (singleton) ───────────────────────────────────────────────

export const pushSettings = pgTable('push_settings', {
  id:                       uuid('id').primaryKey().defaultRandom(),
  kickoffReminderEnabled:   boolean('kickoff_reminder_enabled').notNull().default(true),
  dailyReviewEnabled:       boolean('daily_review_enabled').notNull().default(true),
  updatedAt:                timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
})

// ─── LLM USAGE LOG ───────────────────────────────────────────────────────────

export const llmUsageLog = pgTable('llm_usage_log', {
  id:           uuid('id').primaryKey().defaultRandom(),
  provider:     varchar('provider', { length: 32 }).notNull(),
  model:        varchar('model', { length: 64 }).notNull(),
  matchId:      uuid('match_id').references(() => matches.id, { onDelete: 'set null' }),
  inputTokens:  integer('input_tokens').notNull().default(0),
  outputTokens: integer('output_tokens').notNull().default(0),
  latencyMs:    integer('latency_ms').notNull().default(0),
  success:      boolean('success').notNull(),
  errorCode:    varchar('error_code', { length: 64 }),
  createdAt:    timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
}, (t) => ({
  createdAtIdx: index('llm_usage_log_created_at_idx').on(t.createdAt),
}))
