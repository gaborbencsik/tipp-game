---
id: SCORER-004
title: "Góllövő auto-sync az api-football /fixtures/events-ből"
priority: Should Have
status: Open
dependencies: [SCORER-002, SCORER-003]
complexity: M
---

# SCORER-004: Góllövő auto-sync az api-football /fixtures/events-ből

## Leírás

Mint **rendszer**, szeretnék, hogy a meccs lezárásának pillanatában (`finalizeResult.wasInserted === true` a `sync.service.ts::upsertResults`-ben) automatikusan lehívjam az api-football `/fixtures/events` végpont-ot, a valós góllövőket szűrjem a kutatásban validált szabályok alapján (`comments !== "Penalty Shootout"` + szopont-ellenőrzés), és frissítsem a `match_results.scorer_player_ids` oszlopot. Ezáltal az admin már nem kell kézzel rögzítenie, hogy ki szerzett gólt — az eredmény-leadás után azonnal fusson az auto-scoring.

## Jelenlegi helyzet

SCORER-002 és SCORER-003 kész: a felhasználó góllövő tippet ad le, az admin manuálisan kitölti a `match_results.scorer_player_ids` oszlopot egy multi-select combobox-szal. Most automatizáljuk az admin lépést az api-football adat-szinkronizációval.

## Elfogadási kritériumok

1. **API hívás az api-football-hoz**
   - Új `football-api.service.ts::fetchFixtureEvents({ fixtureId: number })` metódus, amely `GET /fixtures/events?fixture={id}`-re hívódik
   - Retry / timeout / rate-limit logika a meglévő `fetchWithRetry` mintáját követi (`FootballApiRateLimitError` örökölve)
   - `ApiFootballFixtureEvent` type a `packages/backend/src/types/index.ts`-ben a research §6.2 szerint (`time.{elapsed,extra}`, `team.{id,name,logo}`, `player.{id,name}`, `type`, `detail`, `comments`)

2. **Pure helper a góllövő szűréshez**
   - `sync.service.ts::mapEventsToScorerPlayerIds(events, playerIdMap)` — 4-feltételes filter (`type === 'Goal'` && `detail !== 'Missed Penalty'` && `detail !== 'Own Goal'` && `comments !== 'Penalty Shootout'`)
   - VAR-cancel cross-check: `time.elapsed|extra|player.id` kulcs alapján azonosított törölt gólok kihagyása
   - Halmaz-szemantika: external `player.id` → internal UUID mapping a `playerIdMap`-en, végeredmény `new Set()` → `Array`
   - Privát helper `loadPlayerIdMap(externalIds: readonly number[])` — `SELECT id, externalId FROM players WHERE externalId IN (...)`
   - `null` / ismeretlen `player.id` kezelés (drop + sync log warning)

3. **Integráció az `upsertResults` workflow-ba**
   - Az `if (finalizeResult.wasInserted)` ágon belül, a `calculateAndSavePoints` **előtt**:
     - `fetchFixtureEvents({ fixtureId: fixture.fixture.id })`
     - `mapEventsToScorerPlayerIds(events.response, playerIdMap)` → `scorerPlayerIds`
     - `UPDATE match_results SET scorer_player_ids = scorerPlayerIds WHERE matchId = …`
     - (Meglévő) `calculateAndSavePoints(match.id, result)` és `calculateAndSaveGroupPoints(…)` futtatása
   - Exception kezelés: ha `fetchFixtureEvents` hiba, a meccs eredmény attól még mentődik, `scorer_player_ids = []` marad, sync log warning `scorer_sync_failed`, admin később SCORER-003 UI-on manuálisan rögzíthet

4. **Idempotens viselkedés**
   - Minden sync teljesen újraírja a `match_results.scorer_player_ids` tömböt (UPDATE, nem INSERT)
   - VAR-utáni gólvisszavonás: a következő sync UPDATE-tel automatikusan korrigál, `calculateAndSavePoints` újrafutása helyesre állítja a pontokat
   - Shootout szűrés: **single-source-of-truth a `comments !== "Penalty Shootout"` feltétel** — semmilyen `time.elapsed > 120` heurisztika vagy `is_shootout` flag, validálva 2026-06-08-án az ARG–FRA WC2022 döntőn és NED–ARG negyeddöntőn

5. **TDD tesztek**
   - `mapEventsToScorerPlayerIds` unit tesztje: 8+ eset
     - Regular rendes idős akciógól (detail: `Normal Goal`, comments: null) → include
     - ET gól (elapsed: 110, comments: null) → include
     - ET büntető (elapsed: 118, comments: null) → include (kritikus: `time.elapsed > 120` heurisztika hibás lenne)
     - Shootout scored (comments: `"Penalty Shootout"`) → exclude
     - Shootout kihagyott (detail: `Missed Penalty`, comments: `"Penalty Shootout"`) → exclude
     - Öngól (detail: `Own Goal`) → exclude
     - Kihagyott rendes idős büntető (detail: `Missed Penalty`, comments: null) → exclude
     - VAR cancel-t gól (time + player key = cancelledKeys) → exclude
     - Hat-trick: 3 gól ugyanattól a játékostól → halmaz 1 idot tartalmaz
     - Ismeretlen player.id (nincs playerIdMap-ben) → skip (drop) + warning
     - `player.id = null` event → skip
     - `time.elapsed = null` event → skip (ritka de kezel)
     - Üres events tömb → üres result
   - `sync.service.test.ts` integráció tesztek (mockolt api-football válasszal):
     - Sikeres sync: `scores_player_ids` helyesen kitöltve, `calculateAndSavePoints` hívódott
     - API hiba: exception → `scorer_player_ids = []`, meccs eredmény mentett, warning log

6. **E2E teszt az end-to-end flow-hoz**
   - `e2e/scorer-auto-sync.spec.ts`
   - Setup: 2-3 user GOALs tippel a meccsen
   - Meccs fixture statusza FT-re (vagy AET/PEN), mockolt api-football `/fixtures/events` response a research §10 valós shape-jéből
   - Sync trigger: `sync-runner` vagy manual API call (dev env)
   - Assert: `match_results.scorer_player_ids` kitöltve, a tippelt játékosok közül a góllövők pontot kapnak, leaderboard badge zöldre vált

7. **Admin fallback-ség**
   - SCORER-003 manuális override UI továbbra is működik: admin `PUT /api/admin/matches/:id/result` body-ban `scorerPlayerIds` tömbdel felülírhatja az auto-syncet
   - API hiba esetén az admin UI-ból manuálisan rögzíthet (fallback path mindig nyitva van)

## Technikai megjegyzések

### Backend struktúra

- **Fájlok bővítése:**
  - `packages/backend/src/types/index.ts`: `ApiFootballFixtureEvent` interface
  - `packages/backend/src/services/football-api.service.ts`: `fetchFixtureEvents` metódus
  - `packages/backend/src/services/sync.service.ts`: `mapEventsToScorerPlayerIds` + `loadPlayerIdMap` helper-ek; `upsertResults` integráció

- **Függvények szignatúrája:**
  ```ts
  export async function fetchFixtureEvents(params: { fixtureId: number }): Promise<ApiFootballResponse<ApiFootballFixtureEvent>>
  
  export async function mapEventsToScorerPlayerIds(
    events: readonly ApiFootballFixtureEvent[],
    playerIdMap: ReadonlyMap<number, string>, // externalId → internal UUID
  ): Promise<readonly string[]>
  
  async function loadPlayerIdMap(externalIds: readonly number[]): Promise<Map<number, string>>
  ```

- **Rate limit:** +1 hívás / lezárult meccs. VB ~64 meccs → ~64 hívás összesen, free plan 100/nap bőven elég.

- **Hibatűrés:** Sync exception nem állítja meg az `upsertResults` pipeline-t (a `calculateAndSavePoints` akkor is fut, `scorer_player_ids` marad üres vagy az utolsó érvényes érték).

### Migration

- Semmilyen új migration nem szükséges (a `match_results.scorer_player_ids` uuid[] oszlop már SCORER-001-ben létrejött a `0065_scorer_prediction.sql`-ben).

## Kizárások

- **Nem** tartalmaz live polling közben (meccs alatt) — csak a meccs lezárása után (`finalizeResult.wasInserted`)
- **Nem** tartalmaz külön admin `POST /admin/matches/:id/rescore-scorers` endpoint-ot — a meglévő `PUT /api/admin/matches/:id/result` body bővítés a SCORER-003-ban már lefedi
- **Nem** tartalmaz új `match_scorer_events` / `match_goal_scorers` tábla — az aggregált `match_results.scorer_player_ids` uuid[] tömb elég
- **Nem** tartalmaznak raw API events JSONB-ben tárolást — a szűrt UUID-k tömbje az egész pipeline-nak elég
- **Nem** tartalmaz csoport-szintű scorer override — hardcoded `+1` pont, v1-re
- **Nem** tartalmaz player foto / statisztika — az autosync csak a gólszerzésre fókuszál

## Cleanup a 3 slice (SCORER-002 + SCORER-003 + SCORER-004) lezárása után

Amikor mind a három slice teljesült és lezárult (a `00-history.md`-be került), a `plans/stories/` alatti **referencia doksik törölhetők**, mert a tudásukat a 3 implementált story és a kód már magában hordozza:

- `plans/stories/SCORER-001.md` (umbrella story)
- `plans/stories/SCORER-001-arch.md` (DB és architektúra terv)
- `plans/stories/SCORER-001-api-research.md` (api-football events research)
- `plans/stories/SCORER-001-ux.md` (UX terv)
- `plans/stories/SCORER-001-council-review.md` (council review)

A 3 slice story (`SCORER-002.md`, `SCORER-003.md`, `SCORER-004.md`) az archive-ba mozogjon (`plans/stories/archive/`) a szokásos lezárási lépésekkel — ezek a doksik tartalmaznak elég referenciát ahhoz, hogy később vissza lehessen olvasni a feature-t.

**Csak akkor töröld a SCORER-001* doksikat, ha mind a 3 slice (002 + 003 + 004) lezárt és sikeresen deployolt.**
