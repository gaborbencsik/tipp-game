# VB Tippjáték – Adatbázis Terv

> PostgreSQL + Drizzle ORM
> Verzió: 1.0 | Dátum: 2026-03-27

---

## Tartalom

1. [Tervezési döntések](#1-tervezési-döntések)
2. [Drizzle Schema](#2-drizzle-schema)
3. [ER-diagram (Mermaid)](#3-er-diagram-mermaid)
4. [Kardinalitások összefoglalója](#4-kardinalitások-összefoglalója)
5. [Indexelési stratégia](#5-indexelési-stratégia)
6. [Soft delete és Audit log stratégia](#6-soft-delete-és-audit-log-stratégia)

---

## 1. Tervezési döntések

| Döntés | Választás | Indoklás |
|--------|-----------|----------|
| Soft delete | `deleted_at TIMESTAMPTZ` | Adatvédelem, visszaállíthatóság, tippek megőrzése |
| Audit log | Dedikált `audit_logs` tábla | Kritikus entitásokon (matches, results, users) |
| UUID vs. SERIAL | `UUID` primary key-ek | Biztonság (nem kitalálható ID-k), distributed-ready |
| Timezone | Minden timestamp `TIMESTAMPTZ` | Nyári VB – globális felhasználók, timezone-safe |
| Pontrendszer | DB-ben tárolva, nem hardcoded | Csoportonkénti override, runtime módosíthatóság |
| Csoport invite | Random 8-karakteres kód | Egyszerű megoszthatóság, regenerálható |
| Auth | Supabase Auth + `supabase_id` FK | A Supabase kezeli az OAuth session-t; a mi DB-nk csak profil adatokat tárol |
| DB (prod) | Supabase Postgres | Managed PG 18.3, connection pooling, ingyenes tier |
| DB (local dev) | Docker PostgreSQL 18.3 | Supabase API nélkül, csak sima Postgres; azonos Drizzle séma |

---

## 2. Drizzle Schema

```typescript
// schema/index.ts
// Drizzle ORM schema – PostgreSQL

import {
  pgTable, uuid, varchar, text, integer, boolean,
  timestamp, pgEnum, uniqueIndex, index, check,
  jsonb, smallint
} from 'drizzle-orm/pg-core'
import { relations } from 'drizzle-orm'

// ─── ENUMS ────────────────────────────────────────────────────────────────────

export const userRoleEnum = pgEnum('user_role', ['user', 'admin'])

export const matchStatusEnum = pgEnum('match_status', [
  'scheduled',   // Tervezett, tippelhető
  'live',        // Folyamatban
  'finished',    // Lezárult, eredmény rögzíthető
  'cancelled',   // Törölve (soft delete helyett státusz)
])

export const matchStageEnum = pgEnum('match_stage', [
  'group',           // Csoportkör
  'round_of_16',     // Nyolcaddöntő
  'quarter_final',   // Negyeddöntő
  'semi_final',      // Elődöntő
  'third_place',     // 3. helyért
  'final',           // Döntő
])

export const specialPredictionInputTypeEnum = pgEnum(
  'special_prediction_input_type',
  ['text', 'dropdown', 'number', 'team_select', 'player_select']
)

export const auditActionEnum = pgEnum('audit_action', [
  'create', 'update', 'delete', 'result_set', 'ban', 'role_change'
])

// ─── USERS ────────────────────────────────────────────────────────────────────

/**
 * Felhasználók – Supabase Auth által kezelt azonosítással
 * A supabase_id a Supabase Auth user UUID-ja (auth.users.id)
 * Jelszó, token, OAuth mezők NEM kerülnek ide – azokat a Supabase Auth kezeli
 */
export const users = pgTable('users', {
  id:            uuid('id').primaryKey().defaultRandom(),
  supabaseId:    uuid('supabase_id').notNull().unique(),  // Supabase auth.users.id
  email:         varchar('email', { length: 255 }).notNull().unique(),
  displayName:   varchar('display_name', { length: 30 }).notNull(),
  avatarUrl:     text('avatar_url'),
  role:          userRoleEnum('role').notNull().default('user'),

  // Moderáció
  bannedAt:      timestamp('banned_at', { withTimezone: true }),
  banReason:     text('ban_reason'),

  // Timestamps
  createdAt:     timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt:     timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  deletedAt:     timestamp('deleted_at', { withTimezone: true }),  // soft delete
}, (t) => ({
  emailIdx:      uniqueIndex('users_email_idx').on(t.email),
  supabaseIdIdx: uniqueIndex('users_supabase_id_idx').on(t.supabaseId),
}))

// ─── TEAMS ────────────────────────────────────────────────────────────────────

/**
 * VB-n résztvevő csapatok (32 csapat)
 */
export const teams = pgTable('teams', {
  id:        uuid('id').primaryKey().defaultRandom(),
  name:      varchar('name', { length: 100 }).notNull(),
  shortCode: varchar('short_code', { length: 3 }).notNull().unique(), // pl. "HUN"
  flagUrl:   text('flag_url'),
  group:     varchar('group', { length: 1 }),  // 'A'-'H', NULL a selejtezők után

  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
})

// ─── VENUES ───────────────────────────────────────────────────────────────────

/**
 * Helyszínek / stadionok
 */
export const venues = pgTable('venues', {
  id:       uuid('id').primaryKey().defaultRandom(),
  name:     varchar('name', { length: 150 }).notNull(),
  city:     varchar('city', { length: 100 }).notNull(),
  country:  varchar('country', { length: 100 }).notNull(),
  capacity: integer('capacity'),

  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
})

// ─── MATCHES ──────────────────────────────────────────────────────────────────

/**
 * Mérkőzések – a platform magja
 */
export const matches = pgTable('matches', {
  id:           uuid('id').primaryKey().defaultRandom(),
  homeTeamId:   uuid('home_team_id').notNull().references(() => teams.id),
  awayTeamId:   uuid('away_team_id').notNull().references(() => teams.id),
  venueId:      uuid('venue_id').references(() => venues.id),
  stage:        matchStageEnum('stage').notNull(),
  groupName:    varchar('group_name', { length: 1 }),  // 'A'-'H', csak csoportkörben
  matchNumber:  smallint('match_number'),              // pl. 1-64, sorrendhez
  scheduledAt:  timestamp('scheduled_at', { withTimezone: true }).notNull(),
  status:       matchStatusEnum('status').notNull().default('scheduled'),

  // Timestamps
  createdAt:    timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt:    timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  deletedAt:    timestamp('deleted_at', { withTimezone: true }),  // soft delete
}, (t) => ({
  scheduledAtIdx: index('matches_scheduled_at_idx').on(t.scheduledAt),
  statusIdx:      index('matches_status_idx').on(t.status),
  stageIdx:       index('matches_stage_idx').on(t.stage),
}))

// ─── MATCH RESULTS ────────────────────────────────────────────────────────────

/**
 * Meccs végeredmények – külön táblában az egyértelmű audit trail miatt
 */
export const matchResults = pgTable('match_results', {
  id:          uuid('id').primaryKey().defaultRandom(),
  matchId:     uuid('match_id').notNull().unique().references(() => matches.id),
  homeGoals:   smallint('home_goals').notNull(),
  awayGoals:   smallint('away_goals').notNull(),
  recordedBy:  uuid('recorded_by').notNull().references(() => users.id),
  recordedAt:  timestamp('recorded_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt:   timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
}, (t) => ({
  matchIdIdx: uniqueIndex('match_results_match_id_idx').on(t.matchId),
}))

// ─── SCORING CONFIGS ──────────────────────────────────────────────────────────

/**
 * Pontrendszer konfiguráció – globális + csoportszintű override
 * Minden rekord egy teljes pontrendszert ír le.
 */
export const scoringConfigs = pgTable('scoring_configs', {
  id:                  uuid('id').primaryKey().defaultRandom(),
  name:                varchar('name', { length: 100 }).notNull(),
  isGlobalDefault:     boolean('is_global_default').notNull().default(false),

  // Pontértékek
  exactScore:          smallint('exact_score').notNull().default(3),
  correctWinnerAndDiff: smallint('correct_winner_and_diff').notNull().default(2),
  correctWinner:       smallint('correct_winner').notNull().default(1),
  correctDraw:         smallint('correct_draw').notNull().default(2),
  incorrect:           smallint('incorrect').notNull().default(0),

  createdAt:           timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt:           timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
})

// ─── GROUPS (felhasználói csoportok) ──────────────────────────────────────────

/**
 * Privát verseny-csoportok
 */
export const groups = pgTable('groups', {
  id:              uuid('id').primaryKey().defaultRandom(),
  name:            varchar('name', { length: 50 }).notNull().unique(),
  description:     text('description'),
  inviteCode:      varchar('invite_code', { length: 8 }).notNull().unique(),
  inviteActive:    boolean('invite_active').notNull().default(true),
  createdBy:       uuid('created_by').notNull().references(() => users.id),
  scoringConfigId: uuid('scoring_config_id').references(() => scoringConfigs.id),  // override

  createdAt:       timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt:       timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  deletedAt:       timestamp('deleted_at', { withTimezone: true }),  // soft delete
}, (t) => ({
  inviteCodeIdx: uniqueIndex('groups_invite_code_idx').on(t.inviteCode),
  nameIdx:       uniqueIndex('groups_name_idx').on(t.name),
}))

// ─── GROUP MEMBERS ────────────────────────────────────────────────────────────

/**
 * N:M – user ↔ group tag-kapcsolat, admin flag-gel
 */
export const groupMembers = pgTable('group_members', {
  id:       uuid('id').primaryKey().defaultRandom(),
  groupId:  uuid('group_id').notNull().references(() => groups.id, { onDelete: 'cascade' }),
  userId:   uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  isAdmin:  boolean('is_admin').notNull().default(false),
  joinedAt: timestamp('joined_at', { withTimezone: true }).notNull().defaultNow(),
}, (t) => ({
  uniqueMember:   uniqueIndex('group_members_unique').on(t.groupId, t.userId),
  groupIdx:       index('group_members_group_idx').on(t.groupId),
  userIdx:        index('group_members_user_idx').on(t.userId),
}))

// ─── PREDICTIONS (meccs tippek) ───────────────────────────────────────────────

/**
 * Felhasználók tippjei a meccsekre
 */
export const predictions = pgTable('predictions', {
  id:            uuid('id').primaryKey().defaultRandom(),
  userId:        uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  matchId:       uuid('match_id').notNull().references(() => matches.id, { onDelete: 'cascade' }),
  homeGoals:     smallint('home_goals').notNull(),
  awayGoals:     smallint('away_goals').notNull(),

  // Kiszámított pontok (NULL amíg nincs eredmény)
  pointsGlobal:  smallint('points_global'),

  createdAt:     timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt:     timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
}, (t) => ({
  uniquePrediction: uniqueIndex('predictions_user_match_unique').on(t.userId, t.matchId),
  userIdx:          index('predictions_user_idx').on(t.userId),
  matchIdx:         index('predictions_match_idx').on(t.matchId),
}))

// ─── GROUP PREDICTION POINTS ──────────────────────────────────────────────────

/**
 * Csoportspecifikus pontok, ha a csoport eltérő pontrendszert használ.
 * Csak akkor keletkezik bejegyzés, ha a csoport rendelkezik override-dal.
 */
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

/**
 * Statisztikai tipp típusok (admin által konfigurált)
 * Pl. "Gólkirály", "Bajnok csapat", "Legjobb kapus"
 */
export const specialPredictionTypes = pgTable('special_prediction_types', {
  id:           uuid('id').primaryKey().defaultRandom(),
  name:         varchar('name', { length: 100 }).notNull(),
  description:  text('description'),
  inputType:    specialPredictionInputTypeEnum('input_type').notNull(),
  options:      jsonb('options'),  // dropdown esetén: string[]
  deadline:     timestamp('deadline', { withTimezone: true }).notNull(),
  points:       smallint('points').notNull().default(5),
  correctAnswer: text('correct_answer'),  // admin tölti ki kiértékeléskor
  isActive:     boolean('is_active').notNull().default(true),

  createdAt:    timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt:    timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
})

// ─── SPECIAL PREDICTIONS ──────────────────────────────────────────────────────

/**
 * Felhasználók statisztikai tippjei
 */
export const specialPredictions = pgTable('special_predictions', {
  id:             uuid('id').primaryKey().defaultRandom(),
  userId:         uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  typeId:         uuid('type_id').notNull().references(() => specialPredictionTypes.id),
  answer:         text('answer').notNull(),
  points:         smallint('points'),  // NULL amíg nem értékelték ki

  createdAt:      timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt:      timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
}, (t) => ({
  uniqueSpecialPred: uniqueIndex('special_predictions_unique').on(t.userId, t.typeId),
  userIdx:           index('special_predictions_user_idx').on(t.userId),
}))

// ─── AUDIT LOGS ───────────────────────────────────────────────────────────────

/**
 * Kritikus műveletek naplózása (eredmény rögzítés, ban, role változás stb.)
 */
export const auditLogs = pgTable('audit_logs', {
  id:           uuid('id').primaryKey().defaultRandom(),
  actorId:      uuid('actor_id').references(() => users.id),  // NULL = system
  action:       auditActionEnum('action').notNull(),
  entityType:   varchar('entity_type', { length: 50 }).notNull(),  // pl. "match", "user"
  entityId:     uuid('entity_id').notNull(),
  previousValue: jsonb('previous_value'),
  newValue:      jsonb('new_value'),
  ipAddress:    varchar('ip_address', { length: 45 }),
  createdAt:    timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
}, (t) => ({
  actorIdx:     index('audit_logs_actor_idx').on(t.actorId),
  entityIdx:    index('audit_logs_entity_idx').on(t.entityType, t.entityId),
  createdAtIdx: index('audit_logs_created_at_idx').on(t.createdAt),
}))

// ─── RELATIONS ────────────────────────────────────────────────────────────────

export const usersRelations = relations(users, ({ many }) => ({
  predictions: many(predictions),
  groupMemberships: many(groupMembers),
  createdGroups: many(groups),
  specialPredictions: many(specialPredictions),
}))

export const teamsRelations = relations(teams, ({ many }) => ({
  homeMatches: many(matches, { relationName: 'homeTeam' }),
  awayMatches: many(matches, { relationName: 'awayTeam' }),
}))

export const matchesRelations = relations(matches, ({ one, many }) => ({
  homeTeam: one(teams, { fields: [matches.homeTeamId], references: [teams.id], relationName: 'homeTeam' }),
  awayTeam: one(teams, { fields: [matches.awayTeamId], references: [teams.id], relationName: 'awayTeam' }),
  venue: one(venues, { fields: [matches.venueId], references: [venues.id] }),
  result: one(matchResults),
  predictions: many(predictions),
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
}))

export const groupMembersRelations = relations(groupMembers, ({ one }) => ({
  group: one(groups, { fields: [groupMembers.groupId], references: [groups.id] }),
  user: one(users, { fields: [groupMembers.userId], references: [users.id] }),
}))

export const specialPredictionTypesRelations = relations(specialPredictionTypes, ({ many }) => ({
  predictions: many(specialPredictions),
}))

export const specialPredictionsRelations = relations(specialPredictions, ({ one }) => ({
  user: one(users, { fields: [specialPredictions.userId], references: [users.id] }),
  type: one(specialPredictionTypes, { fields: [specialPredictions.typeId], references: [specialPredictionTypes.id] }),
}))
```

---

## 3. ER-diagram (Mermaid)

```mermaid
erDiagram

    USERS {
        uuid id PK
        uuid supabase_id UK
        varchar email UK
        varchar display_name
        text avatar_url
        user_role role
        timestamp banned_at
        timestamp created_at
        timestamp deleted_at
    }

    TEAMS {
        uuid id PK
        varchar name
        varchar short_code UK
        text flag_url
        varchar group
        timestamp created_at
    }

    VENUES {
        uuid id PK
        varchar name
        varchar city
        varchar country
        integer capacity
    }

    MATCHES {
        uuid id PK
        uuid home_team_id FK
        uuid away_team_id FK
        uuid venue_id FK
        match_stage stage
        varchar group_name
        smallint match_number
        timestamp scheduled_at
        match_status status
        timestamp deleted_at
    }

    MATCH_RESULTS {
        uuid id PK
        uuid match_id FK_UK
        smallint home_goals
        smallint away_goals
        uuid recorded_by FK
        timestamp recorded_at
    }

    SCORING_CONFIGS {
        uuid id PK
        varchar name
        boolean is_global_default
        smallint exact_score
        smallint correct_winner_and_diff
        smallint correct_winner
        smallint correct_draw
        smallint incorrect
    }

    GROUPS {
        uuid id PK
        varchar name UK
        text description
        varchar invite_code UK
        boolean invite_active
        uuid created_by FK
        uuid scoring_config_id FK
        timestamp deleted_at
    }

    GROUP_MEMBERS {
        uuid id PK
        uuid group_id FK
        uuid user_id FK
        boolean is_admin
        timestamp joined_at
    }

    PREDICTIONS {
        uuid id PK
        uuid user_id FK
        uuid match_id FK
        smallint home_goals
        smallint away_goals
        smallint points_global
        timestamp created_at
        timestamp updated_at
    }

    GROUP_PREDICTION_POINTS {
        uuid id PK
        uuid prediction_id FK
        uuid group_id FK
        smallint points
        timestamp calculated_at
    }

    SPECIAL_PREDICTION_TYPES {
        uuid id PK
        varchar name
        text description
        special_pred_input_type input_type
        jsonb options
        timestamp deadline
        smallint points
        text correct_answer
        boolean is_active
    }

    SPECIAL_PREDICTIONS {
        uuid id PK
        uuid user_id FK
        uuid type_id FK
        text answer
        smallint points
        timestamp created_at
    }

    AUDIT_LOGS {
        uuid id PK
        uuid actor_id FK
        audit_action action
        varchar entity_type
        uuid entity_id
        jsonb previous_value
        jsonb new_value
        varchar ip_address
        timestamp created_at
    }

    %% Kapcsolatok

    USERS ||--o{ PREDICTIONS : "lead"
    USERS ||--o{ GROUP_MEMBERS : "tagja"
    USERS ||--o{ GROUPS : "létrehozza"
    USERS ||--o{ SPECIAL_PREDICTIONS : "lead"
    USERS ||--o{ MATCH_RESULTS : "rögzíti"
    USERS ||--o{ AUDIT_LOGS : "elvégzi"

    TEAMS ||--o{ MATCHES : "hazai csapat"
    TEAMS ||--o{ MATCHES : "vendég csapat"

    VENUES ||--o{ MATCHES : "helyszín"

    MATCHES ||--o| MATCH_RESULTS : "1 eredmény"
    MATCHES ||--o{ PREDICTIONS : "tippek"

    SCORING_CONFIGS ||--o{ GROUPS : "pontrendszer override"

    GROUPS ||--o{ GROUP_MEMBERS : "tagsági rekordok"
    GROUPS ||--o{ GROUP_PREDICTION_POINTS : "csopont-pontok"

    PREDICTIONS ||--o{ GROUP_PREDICTION_POINTS : "csoportszintű pont"

    SPECIAL_PREDICTION_TYPES ||--o{ SPECIAL_PREDICTIONS : "típus"
```

---

## 4. Kardinalitások összefoglalója

| Táblák | Kapcsolat | Leírás |
|--------|-----------|--------|
| `users` → `predictions` | 1:N | Egy user sok tippet adhat |
| `matches` → `predictions` | 1:N | Egy meccsre sok tipp érkezhet |
| `users` × `matches` → `predictions` | N:M (junction) | Egy usernek egy meccsre PONTOSAN 1 tippje lehet (UNIQUE constraint) |
| `matches` → `match_results` | 1:1 | Egy meccsnek legfeljebb 1 eredménye van (UNIQUE FK) |
| `teams` → `matches` (hazai) | 1:N | Egy csapat sok meccsen hazai |
| `teams` → `matches` (vendég) | 1:N | Egy csapat sok meccsen vendég |
| `venues` → `matches` | 1:N | Egy helyszínen sok meccs |
| `users` → `group_members` | 1:N | Egy user sok csoportban lehet |
| `groups` → `group_members` | 1:N | Egy csoportnak sok tagja lehet |
| `users` × `groups` → `group_members` | N:M (junction) | UNIQUE constraint: user × group |
| `scoring_configs` → `groups` | 1:N | Egy konfig több csoporthoz rendelhető |
| `predictions` → `group_prediction_points` | 1:N | Egy tipphez több csoportszintű pont is tartozhat |
| `groups` → `group_prediction_points` | 1:N | Egy csoportnak sok pontbejegyzése van |
| `predictions` × `groups` → `group_pred_points` | N:M (junction) | UNIQUE constraint: prediction × group |
| `special_prediction_types` → `special_predictions` | 1:N | Egy típusra sok tipp |
| `users` × `special_pred_types` → `special_predictions` | N:M | UNIQUE constraint: user × type |
| `users` → `audit_logs` | 1:N | Egy user sok audit eseményt generál |

---

## 5. Indexelési stratégia

### Kötelező (PRIMARY KEY-eken felül)

| Tábla | Mező(k) | Index típus | Indoklás |
|-------|---------|-------------|----------|
| `users` | `email` | UNIQUE | Bejelentkezés keresési alap |
| `users` | `supabase_id` | UNIQUE | Supabase Auth callback lookup |
| `matches` | `scheduled_at` | INDEX | Időrendi rendezés, szűrés |
| `matches` | `status` | INDEX | Nyitott/lezárt szűrés |
| `matches` | `stage` | INDEX | Szakasz szerinti szűrés |
| `predictions` | `(user_id, match_id)` | UNIQUE | 1 user = 1 tipp / meccs kényszer |
| `predictions` | `user_id` | INDEX | Saját tippek listázása |
| `predictions` | `match_id` | INDEX | Meccshez tartozó tippek |
| `group_members` | `(group_id, user_id)` | UNIQUE | Duplikált tagság megelőzése |
| `group_members` | `group_id` | INDEX | Tagok listázása csoporthoz |
| `group_members` | `user_id` | INDEX | Felhasználó csoportjainak listázása |
| `groups` | `invite_code` | UNIQUE | Meghívó kód lookup |
| `groups` | `name` | UNIQUE | Névütközés megelőzése |
| `group_prediction_points` | `(prediction_id, group_id)` | UNIQUE | Duplikált pontszámítás megelőzése |
| `match_results` | `match_id` | UNIQUE | Egy meccsnek 1 eredménye |
| `special_predictions` | `(user_id, type_id)` | UNIQUE | 1 user = 1 tipp / típus |
| `audit_logs` | `(entity_type, entity_id)` | INDEX | Entitásonkénti audit keresés |
| `audit_logs` | `created_at` | INDEX | Időrendi lekérdezés |

### Opcionális (teljesítmény, ha adatbázis nő)

| Tábla | Mező(k) | Indoklás |
|-------|---------|----------|
| `users` | `role` | WHERE role = 'admin' szűrés |
| `users` | `banned_at` | Tiltott userek szűrése |
| `predictions` | `points_global` | Ranglista számítás |

---

## 6. Soft delete és Audit log stratégia

### Soft Delete

A soft delete `deleted_at TIMESTAMPTZ` mezővel van implementálva a következő táblákon:

| Tábla | Indoklás |
|-------|----------|
| `users` | GDPR: adat anonimizálható, de az ID-referenciák megmaradnak |
| `matches` | Törölt meccshez tartozó tippek és pontok auditálhatók maradnak |
| `groups` | Törölt csoportok tagságai és pontjai visszaállíthatók |

**Konvenció:**
- Drizzle lekérdezéseknél mindig szűrünk: `.where(isNull(table.deletedAt))`
- A DB layer-ben egy `withoutDeleted()` helper segíti ezt
- Admin nézetben külön flag-gel láthatók a törölt rekordok

### Audit Log

Az `audit_logs` tábla a következő kritikus eseményeket naplózza:

| `action` | Mikor | `entity_type` | Mit tárol |
|----------|-------|---------------|-----------|
| `create` | Meccs létrehozásakor | `match` | Teljes meccs adat |
| `update` | Meccs módosításakor | `match` | `previous_value` + `new_value` diff |
| `result_set` | Eredmény rögzítésekor | `match_result` | Korábbi és új eredmény |
| `delete` | Soft delete esetén | `match` / `group` | Teljes rekord |
| `ban` | User tiltásakor | `user` | `banned_at`, `ban_reason` |
| `role_change` | Role módosításkor | `user` | `previous_role`, `new_role` |

**Auditált táblák:** `matches`, `match_results`, `users` (ban, role)

**Nem auditált** (túl magas volume): `predictions` (tippek módosítása), `audit_logs` maga
