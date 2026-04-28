# VB Tippjáték – Adatbázis séma index

> Az aktuális schema: `packages/backend/src/db/schema/index.ts` (ez az igazság forrása)
> Migrációk: `packages/backend/src/db/migrations/`

## Táblák

| Tábla | Leírás | Soft delete |
|-------|--------|-------------|
| `users` | Felhasználói profilok (supabase_id FK) | ✓ |
| `teams` | Csapatok (national/club, flag) | — |
| `players` | Játékosok (teamId FK) | — |
| `venues` | Stadionok (név, város) | — |
| `matches` | Mérkőzések (home/away team, venue, stage, status) | ✓ |
| `match_results` | Eredmények (homeScore, awayScore, outcomeAfterDraw) | — |
| `scoring_configs` | Pontrendszer konfiguráció (global + group override) | — |
| `groups` | Tippcsoportok (invite code, scoringConfigId) | ✓ |
| `group_members` | Csoport tagság (userId, groupId, role, joinedAt) | — |
| `predictions` | Meccs tippek (userId, matchId, homeScore, awayScore, outcomeAfterDraw, pointsGlobal) | — |
| `group_prediction_points` | Csoport-szintű pontok (predictionId, groupId, points) | — |
| `special_prediction_types` | Speciális tipp típusok (groupId nullable = globális, inputType, options, deadline) | — |
| `special_predictions` | Speciális tipp válaszok (userId, typeId, answer, points) | — |
| `group_global_type_subscriptions` | Csoport feliratkozás globális típusra | — |
| `audit_logs` | Audit napló (action, userId, targetId, meta) | — |
| `waitlist_entries` | Email waitlist (email, név) | — |

## Enumerációk

- `user_role`: user, admin
- `team_type`: national, club
- `match_status`: scheduled, live, finished, cancelled

## Fő kapcsolatok

- `matches` → `teams` (homeTeamId, awayTeamId), `venues` (venueId)
- `predictions` → `users`, `matches`
- `groups` → `scoring_configs` (opcionális override)
- `group_members` → `users`, `groups`
- `special_prediction_types` → `groups` (nullable = globális)
- `special_predictions` → `users`, `special_prediction_types`
- `players` → `teams`

## Konvenciók

- PK: UUID minden táblán
- Soft delete: `deleted_at TIMESTAMPTZ` (users, matches, groups)
- Lekérdezéseknél: `.where(isNull(table.deletedAt))`
- Minden timestamp: `TIMESTAMPTZ`
