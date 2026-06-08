# SCORER-001 — API research: góllövő tipp idempotens kiértékelése

> Kutatási dokumentum a "ki szerez gólt a meccsen" feature backendjéhez.
> Forrás: api-football (api-sports.io) v3 + a `tipp-game` kódbázis aktuális állapota.
> A dokumentum a meglévő `football-api.service.ts` / `sync.service.ts` / `player-sync.service.ts` mintáit követi.

---

## 0. TL;DR

- **Egy végpont elég:** `GET /fixtures/events?fixture={id}` minden gól-eseményt tartalmaz.
- **Player ID forrás:** az events response `player.id` mezője **ugyanaz** az api-football player ID, mint amit a `player-sync.service.ts` `players.externalId`-be már elment a `/players/squads` hívásból.
- **Dropdown forrása a tipp UI-on:** `GET /players/squads?team={teamId}` (már szinkronizálva van) — a `lineups` nem alkalmas, mert csak meccs előtt ~1 órával válik elérhetővé.
- **Tárolás:** **nincs új tábla**. A meccsen valós gólt szerző játékosok id-jait egyetlen `match_results.scorer_player_ids uuid[]` oszlop tartja halmaz-szemantikával. A tipp 3 oszlopot kap a `predictions`-en (`scorer_pick_player_id`, `scorer_player_name_snapshot`, `scorer_bonus_points`).
- **Idempotencia:** a sync minden lefutáskor teljesen újraírja a `scorer_player_ids` tömböt; a scoring service `set`-tel cseréli a `points_global`-t és `scorer_bonus_points`-t. VAR-utáni újraszámolás triviális — egy `calculateAndSavePoints` recalc.
- **Shootout szűrés (validálva 2026-06-08):** **single-source-of-truth a `comments` mező**. Az api-football a büntetőpárbaj rúgásait `comments="Penalty Shootout"` jelölővel küldi, a 90 perces és hosszabbításbeli büntetőket `comments=null`-lal. Nincs `time.elapsed > 120` heurisztika, nincs `is_shootout` flag — egyetlen filter a sync-ben.
- **API hívás overhead:** 1 plusz hívás / lezárult meccs (`/fixtures/events?fixture={id}`). A free plan 100 hívás/nap; a VB ~64 meccsén ez ~64 hívás összesen.

---

## 1. Kódbázis audit (mit csinálunk most?)

### 1.1 api-football kliens — `football-api.service.ts`

A `FootballApiClient` interface jelenleg ezeket a végpontokat fedi le:

| Metódus                          | Végpont                             | Használat              |
| -------------------------------- | ----------------------------------- | ---------------------- |
| `fetchFixtures`                  | `/fixtures?league=&season=`         | meccs lista + eredmény |
| `fetchTeams`                     | `/teams?league=&season=`            | csapatok               |
| `fetchSquad`                     | `/players/squads?team=`             | aktuális keret         |
| `fetchPlayers`                   | `/players?team=&season=&page=`      | szezon statisztikák    |
| `fetchTeamFixtures` / `ByDate`   | `/fixtures?team=&season=` stb.      | csapat-szűrt fixture-k |

A retry/timeout/rate-limit (`FootballApiRateLimitError`, exponenciális backoff 3x) **újra használható**: új metódushoz csak az URL-építés kell.

### 1.2 Eredmény-szinkron — `sync.service.ts::upsertResults`

A jelenlegi pipeline (relevant rész):

```ts
// FT/AET/PEN → finished
// finalizeLiveToResult({ matchId, homeGoals, awayGoals, outcomeAfterDraw })
// ha wasInserted || scoreChanged:
//   calculateAndSavePoints(...)
//   calculateAndSaveGroupPoints(...)
//   matchResults.pointsCalculatedAt = now()
```

Két fontos invariáns:

- A `scoring.service.ts` **PURE**: `calculatePoints(prediction, result, config) => number`, nincs DB-hívás benne.
- A `matchResults.pointsCalculatedAt` már szolgálja az "egyszer értékeltük ki" idempotencia-jelölőt a meccs eredmény szintjén.
  → **ehhez illeszkedjen a góllövő-bónusz is**, ne csináljunk párhuzamos állapotgépet.

### 1.3 Players szinkron — `player-sync.service.ts`

- `syncPlayers()` minden national team-re lehívja a `/players/squads`-ot (`fetchSquad`).
- A `players` tábla:
  - `externalId integer UNIQUE` — **ez az api-football player ID**.
  - `name`, `teamId`, `position`, `shirtNumber`.
- A `playerStats` táblában (`player_stats_player_season_league_idx`) van szezon-statisztika.

**Ez azt jelenti**: a "tipp: ki szerez gólt" frontend dropdown-hoz **már most** elérhető a két csapat kerete a `players.team_id` alapján — nem kell új sync, sem új tábla.

### 1.4 Hiányzó darabok

- Nincs `fixtures/events` lekérés.
- Nincs góllövő-tipp mező a `predictions` táblán.
- Nincs `match_results.scorer_player_ids` oszlop.
- Nincs góllövő-pontozás a `scoring.service.ts`-ben.

---

## 2. Az `/fixtures/events` végpont

### 2.1 Hívás

```
GET https://v3.football.api-sports.io/fixtures/events?fixture={fixtureId}
Headers: x-apisports-key: <FOOTBALL_API_KEY>
```

Opcionális szűrők (számunkra **nem kellenek**, mindent akarunk auditra):
- `team={teamId}` — csak az adott csapat eseményei
- `player={playerId}` — csak az adott játékoshoz
- `type=Goal` — csak gól-események

> **Javaslat:** ne szűrjünk `type=Goal`-lal, mert akkor pl. a kártyák/cserék nem kerülnek a raw cache-be, és egy későbbi feature (pl. "ki kap sárgát") hívni kényszerít még egyszer ugyanezt.

### 2.2 Response váz (rövidített, de teljes mezőlista)

```json
{
  "get": "fixtures/events",
  "parameters": { "fixture": "215662" },
  "errors": [],
  "results": 18,
  "paging": { "current": 1, "total": 1 },
  "response": [
    {
      "time":   { "elapsed": 25, "extra": null },
      "team":   { "id": 463, "name": "Aldosivi", "logo": "..." },
      "player": { "id": 6126, "name": "Federico Andrada" },
      "assist": { "id": 6262, "name": "Cristian Chimino" },
      "type":   "Goal",
      "detail": "Normal Goal",
      "comments": null
    },
    {
      "time":   { "elapsed": 33, "extra": null },
      "team":   { "id": 442, "name": "Defensa Y Justicia", "logo": "..." },
      "player": { "id": 5955, "name": "Neri Bandiera" },
      "assist": { "id": null, "name": null },
      "type":   "Goal",
      "detail": "Penalty",
      "comments": null
    },
    {
      "time":   { "elapsed": 57, "extra": null },
      "team":   { "id": 463, "name": "Aldosivi" },
      "player": { "id": 35759, "name": "Fernando Roman Marquez" },
      "assist": { "id": null, "name": null },
      "type":   "Goal",
      "detail": "Own Goal",
      "comments": null
    },
    {
      "time":   { "elapsed": 78, "extra": null },
      "team":   { "id": 442, "name": "Defensa Y Justicia" },
      "player": { "id": 5959, "name": "Lisandro Martinez" },
      "assist": { "id": null, "name": null },
      "type":   "Goal",
      "detail": "Missed Penalty",
      "comments": null
    },
    {
      "time":   { "elapsed": 90, "extra": 3 },
      "team":   { "id": 463, "name": "Aldosivi" },
      "player": { "id": 6126, "name": "Federico Andrada" },
      "assist": { "id": null, "name": null },
      "type":   "Var",
      "detail": "Goal cancelled",
      "comments": "Goal cancelled - Offside"
    }
  ]
}
```

### 2.3 `type` mező — lehetséges értékek

| `type`      | Mit jelent                                         |
| ----------- | -------------------------------------------------- |
| `Goal`      | Gól (lásd `detail`)                                |
| `Card`      | Sárga / piros kártya                               |
| `subst`     | Csere (kis "s"!)                                   |
| `Var`       | VAR-döntés (gól érvénytelen, 11-es ad/vissza, …)   |

### 2.4 `type: "Goal"` — `detail` lehetséges értékei

| `detail`         | Aki **gólt szerzett** (számít a `player.id`-re)?         |
| ---------------- | -------------------------------------------------------- |
| `Normal Goal`    | **Igen** — `player.id` = gólszerző                       |
| `Penalty`        | **Igen** — büntetőből, `player.id` = értékesítő          |
| `Own Goal`       | **NEM** — `player.id` = saját kapuba lövő (és a `team` is a saját csapat) |
| `Missed Penalty` | **NEM** — kihagyott 11-es; nincs gól               |

> **Kritikus megfigyelés:** öngólnál a `team` ÉS a `player.team` is a saját (lövő) csapat — a gól viszont a *másik* csapatnak ér. A "ki szerez gólt" tipp szempontjából **az öngólos játékos NEM gólszerző**: nem szabad neki bónuszt adni.

### 2.5 Büntetőpárbaj (penalty shootout) — validált felismerés

**Üzleti szabály:** Az egyenes kieséses (knockout) szakaszban a meccs végi döntetlen utáni
**büntetőpárbaj góljai NEM számítanak** a góllövő tippnek. Csak a **rendes játékidőben + hosszabbításban**
(90 perc + ET) szerzett gólok (Normal Goal + Header + a játékban megítélt Penalty) számítanak.

#### Validációs eredmény (2026-06-08)

Két múltbeli WC2022 PEN-meccsen futtattuk a `/fixtures/events?fixture=...`-ot:

| Fixture | Mérkőzés | Eseménytípusok |
|---|---|---|
| `979139` | Argentína 3 (4) – (2) 3 Franciaország (döntő) | 6 regular/ET goal + 8 shootout event (5 berúgott, 3 kihagyott) |
| `977794` | Hollandia 2 (3) – (4) 2 Argentína (negyeddöntő) | 4 regular/ET goal + 10 shootout event (5 berúgott, 5 kihagyott) |

**Eredmény:** **A `comments` mező egyetlen, abszolút biztonságos jelölő.**

| esemény típusa | `type` | `detail` | `comments` | `time.elapsed` |
|---|---|---|---|---|
| Rendes idős akciógól (pl. Di María 36') | `Goal` | `Normal Goal` | `null` | 0..90 |
| Rendes idős büntető (pl. Messi 23') | `Goal` | `Penalty` | `null` | 0..90 |
| Rendes idős kihagyott pen | `Goal` | `Missed Penalty` | `null` | 0..90 |
| **Hosszabbításbeli akciógól (Messi 108', 2022 final)** | `Goal` | `Normal Goal` | **`null`** | 91..120 |
| **Hosszabbításbeli büntető (Mbappé 118', 2022 final)** | `Goal` | `Penalty` | **`null`** | 91..120 |
| Öngól | `Goal` | `Own Goal` | `null` | bármely |
| **Shootout berúgott (Montiel WC final)** | `Goal` | `Penalty` | **`Penalty Shootout`** | 120 (`extra` 1..N) |
| **Shootout kihagyott (Coman WC final, van Dijk QF)** | `Goal` | `Missed Penalty` | **`Penalty Shootout`** | 120 (`extra` 1..N) |

**Mi NEM működne:**
- Csak `time.elapsed > 120` → false-positive Mbappé 118'-es büntetőjére: `null` `comments`-szel jön, `elapsed=118`. Az algoritmus szerint nem shootout (helyes), de ha `elapsed >= 120`-ra állítanánk, az ET végi sérülés-idejű gól (pl. `elapsed: 120, extra: 3`) hibásan shootoutnak tűnne. Egyik küszöb sem stabil.
- Csak `fixture.status === "PEN"` → globális gating-szabály lenne, a meccsen lévő ET-büntetőt is kiszórná.

**Single-source-of-truth filter:**

```ts
function isCountedGoal(e: ApiFootballFixtureEvent): boolean {
  return e.type === "Goal"
      && e.detail !== "Missed Penalty"   // berúgott (kihagyott pen is type=Goal)
      && e.detail !== "Own Goal"         // öngól nem számít a góllövőnek
      && e.comments !== "Penalty Shootout" // shootout (akár berúgott, akár kihagyott) ki
}
```

**Tanulság a `player.name` mezőről:** néha szemét van benne (pl. `"W. Weghorst                                  1"` a NED-ARG 90+11-en a 2022-es VB-n). **Mindig `player.id`-t használj** — ez stabil int (Messi=154, Mbappé=278, Weghorst=1124 stb.), és a `players.externalId`-vel közvetlenül joinolható.

### 2.6 `type: "Var"` — visszavont gól

VAR-ral törölt gól potenciálisan két alakban jelenhet meg:

1. **A gól megjelenik `Goal` eseményként, majd egy `Var`/`Goal cancelled` követi** — ekkor a sync algoritmusnak el kell dobnia az adott gól-eventet.
2. **A gól sosem jelenik meg** (a játékvezető hangoz előtte fut a VAR-hoz) — ilyenkor a `/events` válaszban már egyáltalán nincs is gól-event.

A 2026-06-08-i validációs hívás (2 PEN-meccs) egyiken sem szerepelt `Var/Goal cancelled` event — ez nem zárja ki, de ritka. A VB során 1-2 ilyen eset előfordulhat.

**Védekezés:**

```ts
function actualScorerExternalIds(events: readonly ApiFootballFixtureEvent[]): readonly number[] {
  // 1) Időpont+játékos kulcsok, ahol VAR cancel-t látunk
  const cancelledKeys = new Set<string>()
  for (const e of events) {
    if (e.type === "Var" && /cancel/i.test(e.detail) && e.player.id != null) {
      cancelledKeys.add(`${e.time.elapsed}|${e.time.extra ?? 0}|${e.player.id}`)
    }
  }
  // 2) Csak a számító gólokat tartjuk meg (lásd 2.5 isCountedGoal), majd a cancel-eltetteket kivesszük
  const set = new Set<number>()
  for (const e of events) {
    if (!isCountedGoal(e)) continue
    if (e.player.id == null) continue
    const k = `${e.time.elapsed}|${e.time.extra ?? 0}|${e.player.id}`
    if (cancelledKeys.has(k)) continue
    set.add(e.player.id)
  }
  return Array.from(set)
}
```

**Idempotens by design:** mivel a sync minden lefutáskor a fenti algoritmussal újraépíti és **teljesen újraírja** a `match_results.scorer_player_ids` tömböt, az api-football oldalán bekövetkező korrekciók (pl. utólagos VAR-felülbírálás) automatikusan átkerülnek a következő syncbe, és a `calculateAndSavePoints` újrafutása korrigálja a pontokat. Nincs külön `cancelled` flag a DB-ben.

---

## 3. Player ID stabilitás

- **Szezonon belül:** stabil. (`player.id` az api-football globális, perzisztens ID-ja.)
- **Szezonok között / klubváltáskor:** **ugyanaz az ID marad** — az ID a játékoshoz tartozik, nem a klubhoz.
- **Tornán (VB):** a játékosok klub-szezonjuk ID-jával jelennek meg a national team squad-ban is; ugyanaz az ID kerül a `/fixtures/events.player.id`-ba.
- **Következmény:** `players.externalId` (a `player-sync` által feltöltve) **megbízhatóan** egyezik az events response `player.id`-jával — extra mapping-tábla nem kell.

---

## 4. Dropdown adatforrás — `squads` vs `lineups`

| Forrás                    | Tartalom                       | Mikor elérhető?                     | Alkalmas dropdown-nak? |
| ------------------------- | ------------------------------ | ----------------------------------- | ---------------------- |
| `/players/squads?team={}` | A csapat teljes aktuális kerete | Folyamatosan (~tornakezdéstől)      | **Igen**               |
| `/fixtures/lineups?fixture={}` | Csak az adott meccs kezdő XI + cserepad | ~1 órával kezdés előtt            | Nem (későn jön)        |

→ **A felhasználónak a meccs ELŐTT kell tippelnie**, ezért a `squads`-ot használjuk. Ez **már szinkronizálva van** a `player-sync.service.ts`-ben — a `players` tábla tartalmazza azt a 23–26 főt csapatonként, akik közül a user választhat.

Edge case: a tipp leadása után egy játékos kihúzódik a keretből (sérülés). Ez ritka, és a user maga látja a frissített keretet a dropdownban — ha már elküldte a tippet, az saját kockázat. Külön kezelés **nem javasolt** az MVP-hez.

---

## 5. Idempotens kiértékelés — adatmodell

### 5.1 Tárolás: `match_results.scorer_player_ids uuid[]`

Külön `match_scorer_events` táblát NEM hozunk létre. A sync az events filterezéséből egyetlen halmazt épít, és azt egyetlen oszlopként a `match_results`-be írja:

```ts
// packages/backend/src/db/schema/index.ts (match_results bővítés)
export const matchResults = pgTable('match_results', {
  // ... a meglévő mezők ...
  scorerPlayerIds: uuid('scorer_player_ids').array().notNull().default(sql`'{}'::uuid[]`),
}, (t) => ({
  // ... meglévő indexek ...
  scorerIdsGin: index('match_results_scorer_ids_idx').using('gin', t.scorerPlayerIds),
}))
```

**Miért ez elég és miért nem új tábla?**
- Egy meccs valós góllövői ⊆ {homeTeam.players ∪ awayTeam.players}, max ~10 különböző játékos egy meccsen — natív tömb tökéletesen kezeli.
- A scoring service `includes()` ellenőrzést végez egy id-ra → 1×N összehasonlítás, N <10. Index nem szükséges a pont-számoláshoz; a GIN index csak admin-kereséshez kell ("mely meccseken szerzett X gólt?").
- A halmaz-szemantikát a sync biztosítja (egy `Set` → `Array`). Egy hat-trick is csak 1 id (nincs dupla pont, a v1-es szabály szerint).
- Ha valaha kell raw event audit (pl. perc, assist, comments), a sync ezt egyszerű JSONL log-ba írhatja — de a v1 nem igényli.
- VAR korrekció esetén a sync újrafut és teljesen újraírja a tömböt — egyetlen UPDATE.

A `Missed Penalty` és `Own Goal` események egyszerűen kimaradnak a tömbből (a sync filter szűri, nem kerülnek be auditra sem).

### 5.2 `predictions` mezők bővítése

Három új mező a `predictions` táblán:

```ts
scorerPickPlayerId:        uuid('scorer_pick_player_id').references(() => players.id, { onDelete: 'restrict' }),
scorerPlayerNameSnapshot:  text('scorer_player_name_snapshot'),
// null = még nem értékelt; 0 = értékelt-de-nem-talált; 1 = értékelt-és-talált
scorerBonusPoints:         smallint('scorer_bonus_points'),
```

- `scorer_pick_player_id` `ON DELETE RESTRICT`: ha admin törölné a `players.id`-t (pl. duplikált sor merge után), a hivatkozó tippeknek először át kell mutatniuk a győztes sorra. Audit megőrizve.
- `scorer_player_name_snapshot`: a leadáskor a backend kitölti a `players.name`-mel. UI így akkor is megjeleníthet egy nevet, ha a forrás játékos sora közben átnevezésen / merge-en esett át.
- `scorer_bonus_points`: idempotens jelölő + nyers 0/1 érték. A leaderboard összegzéshez **NEM** használjuk (a `points_global` már tartalmazza multiplied formában); csak audit / UI badge.

A teljes meccs pont (`predictions.points_global`) tartalmazza a multiplied scorer bónuszt is:
`pointsGlobal = (resultPoints + scorerBonus) * favoriteTeamMultiplier`. A `scorer_bonus_points` továbbra is csak a nyers 0/1, hogy a UI a "+1 góllövő" magyarázatot mutatni tudja.

Index: `predictions_scorer_pick_idx` az `scorer_pick_player_id`-ra (FK lookup gyorsítás).

### 5.3 Ne új táblát csináljunk a `special_predictions` helyett?

A `special_predictions` (lásd `db/schema/index.ts:377`) a "torna szintű" tippekre van (pl. "ki lesz a gólkirály a tornán"). A "ki szerez gólt **ezen a meccsen**" attribútum **a meccs-tipp része**, mert:
- a meccshez kötődik (1:1 a `predictions` sorral),
- ugyanakkor zárul, mint a meccs eredmény,
- ugyanaz a UI-flow (meccs-kártya).

→ **A `predictions` táblán bővítsünk**, ne új típus a `special_predictions`-ben.

---

## 6. Sync flow — hova illesszük be?

A `sync.service.ts::upsertResults` minden lefutásakor azon a meccsen, ami **most ment át finished-be** (`finalizeResult.wasInserted === true` ÁGON), a `match_results` UPDATE-jébe **be is építjük** a `scorer_player_ids` írást egyetlen tranzakcióban:

```ts
// pszeudokód, az upsertResults blokkban,
// a fixture-events lekérés és filterezés után:
if (finalizeResult.wasInserted) {
  const events    = await client.fetchFixtureEvents({ fixtureId: fixture.fixture.id })
  const scorerIds = await mapEventsToScorerPlayerIds(events.response, playerIdMap)
  await db.update(matchResults)
    .set({ scorerPlayerIds })
    .where(eq(matchResults.matchId, match.id))
  await calculateAndSavePoints(match.id, /* ... */)
  await calculateAndSaveGroupPoints(match.id, /* ... */)
}
```

A `scoreChanged` ágon **NEM** hívjuk újra automatikusan — a góllövő-listát csak a meccs-zárást követően kérdezzük le. Ha utólag manuálisan kell (VAR-utáni korrekcióhoz), **nincs szükség külön admin endpointra**: a meglévő admin meccs eredmény szerkesztő végpont (`PUT /api/admin/matches/:id/result`) bővíthető egy opcionális `scorerPlayerIds` body-mezővel, vagy maga az admin újraindíthatja a syncet az adott fixture-re. A `calculateAndSavePoints` újrafuttatása korrigálja a pontokat — `set`, nem `add`, idempotens.

### 6.1 Új kliens-metódus

```ts
// football-api.service.ts
export interface FixtureEventsParams {
  readonly fixtureId: number
}

interface FootballApiClient {
  // ... a meglévők ...
  fetchFixtureEvents(params: FixtureEventsParams):
    Promise<ApiFootballResponse<ApiFootballFixtureEvent>>
}

// implementáció
async fetchFixtureEvents(params: FixtureEventsParams) {
  const url = new URL(`${config.baseUrl}/fixtures/events`)
  url.searchParams.set('fixture', String(params.fixtureId))
  return fetchWithRetry(url)
}
```

### 6.2 Új types

```ts
// packages/backend/src/types/index.ts
export interface ApiFootballFixtureEvent {
  readonly time:   { elapsed: number | null; extra: number | null }
  readonly team:   { id: number; name: string; logo: string | null }
  readonly player: { id: number | null; name: string | null }
  readonly assist: { id: number | null; name: string | null }
  readonly type:   'Goal' | 'Card' | 'subst' | 'Var'
  readonly detail: string
  readonly comments: string | null  // "Penalty Shootout" a shootout eseményeknél, általában null
}
```

`player.id` lehet `null` (ritka, hibás API adatnál) — kezelni kell, gólnak nem számít. `time.elapsed` is lehet `null` ritkán (sync-during-extra-time hibás állapot) — a sync ezt is dobja.

### 6.3 events → scorer_player_ids helper

```ts
// sync.service.ts
async function mapEventsToScorerPlayerIds(
  events: readonly ApiFootballFixtureEvent[],
  playerIdMap: ReadonlyMap<number, string>,  // externalId → internal UUID
): Promise<readonly string[]> {
  // 1) cancelled keys
  const cancelledKeys = new Set<string>()
  for (const e of events) {
    if (e.type === 'Var' && /cancel/i.test(e.detail) && e.player.id != null) {
      cancelledKeys.add(`${e.time.elapsed}|${e.time.extra ?? 0}|${e.player.id}`)
    }
  }
  // 2) számító gólok → internal UUID-k halmaza
  const set = new Set<string>()
  for (const e of events) {
    if (e.type !== 'Goal') continue
    if (e.detail === 'Missed Penalty') continue
    if (e.detail === 'Own Goal') continue
    if (e.comments === 'Penalty Shootout') continue
    if (e.player.id == null) continue
    const key = `${e.time.elapsed}|${e.time.extra ?? 0}|${e.player.id}`
    if (cancelledKeys.has(key)) continue
    const uuid = playerIdMap.get(e.player.id)
    if (!uuid) continue       // ismeretlen játékos → drop (sync log warning)
    set.add(uuid)
  }
  return Array.from(set)
}
```

---

## 7. Pontozási algoritmus (pure, unit-testelhető)

A `scoring.service.ts` mintáját követve két új pure helper. Az egyik a sync-ben fut le (a tömbbe-mentés előtt), a másik a scoring során minden tippre.

### 7.1 Sync-oldali helper — `mapEventsToScorerPlayerIds`

Lásd §6.3 fent. A `comments !== "Penalty Shootout"` filterrel + VAR-cancel cross-check-kel előállít egy `readonly string[]` halmazt.

### 7.2 Scoring-oldali pure függvény — `calculateScorerBonus`

```ts
// scoring.service.ts (új pure függvény, 0 DB-hívás)

export interface ScorerBonusContext {
  readonly scorerPickPlayerId: string | null
  readonly matchScorerPlayerIds: readonly string[]   // a match_results.scorer_player_ids tartalma
}

export function calculateScorerBonus(ctx: ScorerBonusContext): number {
  if (!ctx.scorerPickPlayerId) return 0
  return ctx.matchScorerPlayerIds.includes(ctx.scorerPickPlayerId) ? 1 : 0
}
```

**Hardcoded `+1` v1-ben:** a `scoring_configs` tábla **nem kap új oszlopot**. A "csoportonként override-olható" igényt későbbi story fedi le egy `ALTER TABLE ... ADD COLUMN scorer_bonus_points smallint NOT NULL DEFAULT 1` migrationnel és a függvény-szignatúra bővítéssel — 5 perc, ha kell.

### 7.3 `calculatePoints` integráció — favoriteTeamMultiplier × scorerBonus

A meglévő pure `calculatePoints` szignatúra kibővül és a végső `points_global` számolásánál a `(resultPoints + scorerBonus) * favoriteTeamMultiplier` képletet alkalmazza:

```ts
const resultPoints = computeResultPoints(/* meglévő logika */)
const scorerBonus  = calculateScorerBonus({ scorerPickPlayerId, matchScorerPlayerIds })
const isFavoriteMatch = isUserFavoriteInvolved(/* meglévő logika */)
const multiplier = isFavoriteMatch ? favoriteTeamMultiplier : 1
const pointsGlobal = (resultPoints + scorerBonus) * multiplier
return { pointsGlobal, scorerBonusPoints: scorerBonus }   // raw 0/1 audit
```

### 7.4 Corner case-ek — checklist

| Eset                                                      | Az algoritmus mit ad? | Helyes? |
| --------------------------------------------------------- | --------------------- | ------- |
| Saját játékosa szerez 1 gólt                              | 1                     | ✓       |
| Saját játékosa szerez 2-t                                 | 1 (nem dupla)         | ✓       |
| Saját játékosa csak öngólt szerez                         | 0                     | ✓       |
| Saját játékosa kihagyott 11-est lőtt                      | 0                     | ✓       |
| Saját játékosa gólját VAR visszavonta                     | 0                     | ✓       |
| Saját játékosa **csak shootout-ban** szerzett gólt        | 0                     | ✓       |
| Saját játékosa rendes időben gólt + shootout-ban is gólt  | 1 (csak a rendes számít) | ✓    |
| Saját játékosa **hosszabbításban** szerzett gólt          | 1                     | ✓       |
| Saját játékosa gólt szerzett, ÉS öngólt is                | 1                     | ✓       |
| User nem tippelt gólszerzőt (`scorer_pick_player_id IS NULL`) | 0                 | ✓       |
| Gól nélküli meccs (0:0)                                   | 0                     | ✓       |
| Az api `player.id = null` mezővel ad vissza egy gólt      | 0 erre az eseményre   | ✓       |
| User olyan játékosra tippelt, aki nem is játszott         | 0                     | ✓       |
| **Kedvenc csapat meccs + saját játékos gólt szerez**      | `(resultPoints+1)*2`  | ✓       |

### 7.5 Tudatos egyszerűsítések (MVP)

- **Nincs többszörös bónusz** több gólnál (hat-trick bonus későbbi story).
- **Nincs assist-bónusz** — a response tartalmazza, de nem része a feature-nek.
- **Nincs first/last scorer megkülönböztetés** — szintén későbbi story.
- **Nincs csoport-szintű scorer override** — `+1` hardcoded, ALTER TABLE 5 perc, ha kell.

---

## 8. Rate limit & cache

- **Free plan:** 100 hívás / nap; **paid:** 7 500–150 000 / nap (jelenlegi `FootballApiRateLimitError` retry már megfelelő.)
- **Hívás-budget a feature-re:** **1 hívás / lezárult meccs**. VB: ~64 meccs → ~64 hívás összesen, eloszlatva a torna 1 hónapja alatt → **napi átlag ≪ 10**.
- **Nincs raw event cache:** a `match_results.scorer_player_ids uuid[]` az aggregált végeredmény. Ha a sync logból audit kell (perc, comments, type), a `sync-runner` debug-log írhatja JSONL fájlba — de a v1 nem igényli.
- **Nincs polling élő közben:** csak egyszer kérdezünk, a meccs zárásakor. (Live góllövő-frissítést **ne** vegyünk be MVP-be: drágább API-call mintázat és nem hoz user-értéket — a meccs zárásig úgyis nem zárhatjuk a tippet.)

---

## 9. Konkrét javaslat összefoglaló

1. **Új migration** — `0065_scorer_prediction.sql`:
   - `predictions` + `scorer_pick_player_id uuid REFERENCES players(id) ON DELETE RESTRICT`
   - `predictions` + `scorer_player_name_snapshot text`
   - `predictions` + `scorer_bonus_points smallint` (idempotens jelölő, nyers 0/1)
   - `predictions_scorer_pick_idx`
   - `match_results` + `scorer_player_ids uuid[] NOT NULL DEFAULT '{}'::uuid[]`
   - `match_results_scorer_ids_idx` (GIN)
2. **`football-api.service.ts`** — új `fetchFixtureEvents` metódus.
3. **`types/index.ts`** — `ApiFootballFixtureEvent` interface; `PredictionInput` + `Prediction` bővítés (3 új mező); `AdminMatchResultInput` + opcionális `scorerPlayerIds`.
4. **`sync.service.ts`** — új helper `mapEventsToScorerPlayerIds(events, playerIdMap)` (4-feltételes filter + VAR-cancel cross-check + Set→Array). Az `upsertResults` `wasInserted` ágon UPDATE-tel cseréli a `match_results.scorer_player_ids`-t, majd `calculateAndSavePoints`-ot hív.
5. **`scoring.service.ts`** — új pure `calculateScorerBonus` (2 sor, hardcoded `+1`); a `calculatePoints` szignatúra bővül és a `(resultPoints + scorerBonus) * favoriteTeamMultiplier` képletet alkalmazza; unit-tesztek minden 7.4-es corner case-re.
6. **`predictions.service.ts`** — `upsertPrediction` validáció (két 400 case: scorer-without-full-prediction, scorer-not-in-match) + `scorer_player_name_snapshot` kitöltés.
7. **Admin** — a meglévő `PUT /api/admin/matches/:id/result` body bővül opcionális `scorerPlayerIds`-szel (manuális override / VAR utáni javítás). Új admin endpoint **NEM** szükséges.
8. **Frontend** — meccs-tipp formra player-dropdown a két csapat aktuális keretéből (meglévő `GET /api/players?teamId=...`); a tipp a `scorerPickPlayerId`-t küldi a `PUT /api/predictions` body-ban. A tipp **csak akkor menthető**, ha gólszámok is megvannak (ez UI-szabály, backend safety-net).

### 9.1 Mit NE tegyünk (MVP)

- Ne polling/élő scorer-frissítés.
- Ne új special_predictions típus — közvetlenül a `predictions` táblán bővítsünk.
- Ne hívjunk `/fixtures/events`-et lineup nélküli meccsre, ha a fixture nem `FT/AET/PEN`.
- Ne tárolj raw events-t a DB-ben — a `match_results.scorer_player_ids` aggregáltja elég, az audit log-fájlba mehet.
- Ne adj új `match_scorer_events` / `match_goal_scorers` táblát.
- Ne adj új `scoring_configs.scorer_bonus_points` oszlopot v1-ben — `+1` hardcoded a service-ben.
- Ne adj új `MatchScorerPicker.vue` wrapper-t — a `PlayerSelectCombobox` közvetlenül használható.

---

## 10. Validációs eredmények (2026-06-08)

A merge előtt egy ad-hoc curl-t futtattunk **két múltbeli WC2022 PEN-meccsen**, és a §2.5 / §2.6 / §6 algoritmusok minden kérdéses viselkedését rögzítettük.

```bash
curl -H "x-apisports-key: $FOOTBALL_API_KEY" \
  "https://v3.football.api-sports.io/fixtures/events?fixture=979139" | jq .  # ARG–FRA döntő
curl -H "x-apisports-key: $FOOTBALL_API_KEY" \
  "https://v3.football.api-sports.io/fixtures/events?fixture=977794" | jq .  # NED–ARG negyeddöntő
```

| Kérdés | Eredmény |
|---|---|
| `type` mező pontos casing-je | `Goal`, `Card`, `subst` (kis 's'), `Var` — ahogy vártuk |
| `Var` esemény jelen van? | A két validációs meccsen 0 Var-event volt, de a séma alapján bármikor előfordulhat — a §2.6 cancelledKeys cross-check védelem a helyén marad |
| `assist.id` default? | `null`, nem 0 (a `time.elapsed` is lehet `null`, ezt a sync szűri) |
| ET (hosszabbítás) eseményei a response-ban | Igen, `time.elapsed` 91..120, `time.extra` extra-time-ot jelöli (ET végi sérülés-idő) |
| `paging.total > 1` előfordul-e? | Nem, egy meccs eseményei egy oldalon (results: 17/35/42 a vizsgált meccseken) |
| **Shootout-rúgások az events-ben?** | **Igen, bekerülnek** `type: Goal`, `detail: Penalty` vagy `Missed Penalty`, **`comments: "Penalty Shootout"`** |
| Shootout `time.elapsed`? | `120` (ET vége), `time.extra` 1..N a rúgás sorszáma |
| Shootout `comments` mindig kitöltött? | **Igen**, mindkét meccsen minden shootout eventnek `comments="Penalty Shootout"` (kivétel nincs) |
| ET utolsó perceiben szerzett gól megkülönböztethető? | **Igen, abszolút biztosan**: `comments=null` az ET-gólnál, `comments="Penalty Shootout"` a shootoutnál. Az `time.elapsed` mindkettő lehet `120`. |
| Mbappé 118' ET-büntető (regular, kell számoljon) | `type=Goal`, `detail=Penalty`, **`comments=null`** ✓ |
| Montiel 120+8' shootout (NEM kell számoljon) | `type=Goal`, `detail=Penalty`, **`comments="Penalty Shootout"`** ✓ |
| `player.name` mező megbízhatósága | **Néha szemét** (pl. `"W. Weghorst                                  1"`). Mindig `player.id`-t használj a sync során. |
| `isShootoutEvent` heurisztika szükséges? | **Nem.** A `comments` mező egyetlen filter-feltétel elég. A korábbi tervben szereplő `time.elapsed > 120` és `is_shootout` flag **el lett vetve** ezen validáció alapján. |

**Konklúzió:** a SCORER-001 architektúra (single-source-of-truth `comments !== "Penalty Shootout"` filter, `match_results.scorer_player_ids uuid[]` tárolás) merge-re kész. Külön research-followup nincs.
