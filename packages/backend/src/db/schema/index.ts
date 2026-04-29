import {
  pgTable, uuid, varchar, text, integer, boolean,
  timestamp, pgEnum, uniqueIndex, index,
  jsonb, smallint
} from 'drizzle-orm/pg-core'
import { relations } from 'drizzle-orm'

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
  'round_of_16',
  'quarter_final',
  'semi_final',
  'third_place',
  'final',
])

export const specialPredictionInputTypeEnum = pgEnum(
  'special_prediction_input_type',
  ['text', 'dropdown', 'number', 'team_select', 'player_select']
)

export const auditActionEnum = pgEnum('audit_action', [
  'create', 'update', 'delete', 'result_set', 'ban', 'role_change'
])

export const waitlistSourceEnum = pgEnum('waitlist_source', ['hero', 'footer', 'admin'])

// ─── USERS ────────────────────────────────────────────────────────────────────

export const users = pgTable('users', {
  id:          uuid('id').primaryKey().defaultRandom(),
  supabaseId:  uuid('supabase_id').notNull().unique(),
  email:       varchar('email', { length: 255 }).notNull().unique(),
  displayName: varchar('display_name', { length: 30 }).notNull(),
  avatarUrl:   text('avatar_url'),
  role:        userRoleEnum('role').notNull().default('user'),
  onboardingCompletedAt: timestamp('onboarding_completed_at', { withTimezone: true }),
  bannedAt:    timestamp('banned_at', { withTimezone: true }),
  banReason:   text('ban_reason'),
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
  createdAt:   timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt:   timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
})

// ─── PLAYERS ─────────────────────────────────────────────────────────────────

export const players = pgTable('players', {
  id:          uuid('id').primaryKey().defaultRandom(),
  name:        varchar('name', { length: 100 }).notNull(),
  teamId:      uuid('team_id').references(() => teams.id),
  position:    varchar('position', { length: 30 }),
  shirtNumber: smallint('shirt_number'),
  createdAt:   timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt:   timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
}, (t) => ({
  teamIdIdx: index('players_team_id_idx').on(t.teamId),
}))

// ─── VENUES ───────────────────────────────────────────────────────────────────

export const venues = pgTable('venues', {
  id:       uuid('id').primaryKey().defaultRandom(),
  name:     varchar('name', { length: 150 }).notNull(),
  city:     varchar('city', { length: 100 }).notNull(),
  country:  varchar('country', { length: 100 }).notNull(),
  capacity: integer('capacity'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
})

// ─── LEAGUES ─────────────────────────────────────────────────────────────────

export const leagues = pgTable('leagues', {
  id:        uuid('id').primaryKey().defaultRandom(),
  name:      varchar('name', { length: 100 }).notNull(),
  shortName: varchar('short_name', { length: 20 }).notNull(),
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
  recordedBy:       uuid('recorded_by').notNull().references(() => users.id),
  recordedAt:       timestamp('recorded_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt:        timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
}, (t) => ({
  matchIdIdx: uniqueIndex('match_results_match_id_idx').on(t.matchId),
}))

// ─── SCORING CONFIGS ──────────────────────────────────────────────────────────

export const scoringConfigs = pgTable('scoring_configs', {
  id:                   uuid('id').primaryKey().defaultRandom(),
  name:                 varchar('name', { length: 100 }).notNull(),
  isGlobalDefault:      boolean('is_global_default').notNull().default(false),
  exactScore:           smallint('exact_score').notNull().default(3),
  correctWinnerAndDiff: smallint('correct_winner_and_diff').notNull().default(2),
  correctWinner:        smallint('correct_winner').notNull().default(1),
  correctDraw:          smallint('correct_draw').notNull().default(2),
  correctOutcome:       smallint('correct_outcome').notNull().default(1),
  incorrect:            smallint('incorrect').notNull().default(0),
  createdAt:            timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt:            timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
})

// ─── GROUPS ───────────────────────────────────────────────────────────────────

export const groups = pgTable('groups', {
  id:              uuid('id').primaryKey().defaultRandom(),
  name:            varchar('name', { length: 50 }).notNull().unique(),
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
  nameIdx:       uniqueIndex('groups_name_idx').on(t.name),
}))

// ─── GROUP MEMBERS ────────────────────────────────────────────────────────────

export const groupMembers = pgTable('group_members', {
  id:       uuid('id').primaryKey().defaultRandom(),
  groupId:  uuid('group_id').notNull().references(() => groups.id, { onDelete: 'cascade' }),
  userId:   uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  isAdmin:  boolean('is_admin').notNull().default(false),
  joinedAt: timestamp('joined_at', { withTimezone: true }).notNull().defaultNow(),
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
  createdAt:        timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt:        timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
}, (t) => ({
  uniquePrediction: uniqueIndex('predictions_user_match_unique').on(t.userId, t.matchId),
  userIdx:          index('predictions_user_idx').on(t.userId),
  matchIdx:         index('predictions_match_idx').on(t.matchId),
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
  id:           uuid('id').primaryKey().defaultRandom(),
  groupId:      uuid('group_id').notNull().references(() => groups.id, { onDelete: 'cascade' }),
  globalTypeId: uuid('global_type_id').notNull().references(() => specialPredictionTypes.id, { onDelete: 'cascade' }),
  subscribedAt: timestamp('subscribed_at', { withTimezone: true }).notNull().defaultNow(),
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

export const playersRelations = relations(players, ({ one }) => ({
  team: one(teams, { fields: [players.teamId], references: [teams.id] }),
}))

export const matchesRelations = relations(matches, ({ one, many }) => ({
  homeTeam: one(teams, { fields: [matches.homeTeamId], references: [teams.id], relationName: 'homeTeam' }),
  awayTeam: one(teams, { fields: [matches.awayTeamId], references: [teams.id], relationName: 'awayTeam' }),
  venue: one(venues, { fields: [matches.venueId], references: [venues.id] }),
  league: one(leagues, { fields: [matches.leagueId], references: [leagues.id] }),
  result: one(matchResults, { fields: [matches.id], references: [matchResults.matchId] }),
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
