# SCORER-001 — Góllövő tipp: DB és architektúra terv

> Cél: meccsenként **egy** játékos választható, akire a user góllövőként tippel. Ha a választott játékos a meccsen (rendes játékidő + hosszabbítás) legalább 1 **rendes** gólt vagy a játék alatti büntetőt szerez, **+1 pont** jár; **kedvenc csapat meccsén `× favoriteTeamMultiplier`** (alapértelmezetten 2 → +2). Öngól és büntetőpárbaj NEM számít. A bónusz független a meccs tipp pontjától.

## Összefoglaló (TL;DR)

- **Bővítés a `predictions` táblán**: `scorer_pick_player_id` (FK `players.id`, **`ON DELETE RESTRICT`**), `scorer_player_name_snapshot` (text), `scorer_bonus_points` (smallint, idempotenciához nyers 0/1).
- **A `players` tábla már létezik** (`packages/backend/src/db/schema/index.ts:107`), `external_id` az api-football player ID. Új tábla nem kell, új oszlop sem (`photo_url` későbbi story).
- **A meccs góllövői külön táblába NEM kerülnek** — egyetlen `match_results.scorer_player_ids uuid[]` oszlop tárolja halmaz-szemantikával (default `'{}'`). GIN indexszel.
- **Pure pontszámítás**: `calculateScorerBonus(...)` (nyers 0/1) + a meglévő `calculatePoints(...)` bővítése úgy, hogy a `(resultPoints + scorerBonus) * favoriteTeamMultiplier` alkalmazódjon.
- **Hardcoded `+1` v1-ben** — nincs új `scoring_configs.scorer_bonus_points` oszlop. Csoport-szintű override későbbi story.
- **Idempotenciát** a `predictions.scorer_bonus_points` és a teljes-recalc `points_global` UPDATE biztosítja (mindig set, sosem add).
- **Shootout szűrés** a sync-ben (egyetlen filter: `comments !== "Penalty Shootout"`), ami a `match_results.scorer_player_ids`-be kerül, az **már szűrt**. A scoring service nem foglalkozik shootouttal.
- **Migration**: **`0065_scorer_prediction.sql`** — egyetlen migration, mind a séma változás benne (4 alter: 3 oszlop predictions-en + 1 oszlop match_results-en + 1 GIN index).

---

## 1. Hol tároljuk a tippet és hol a tényadatot?

### Tipp oldal: a `predictions` tábla bővítése

A jelenlegi `predictions` (`schema/index.ts:314-328`) az eredménytipp + outcomeAfterDraw + pointsGlobal. A góllövő tipp ugyanannak a user-meccs entitásnak a része (ugyanaz a deadline, ugyanaz a életciklus), tehát **3 új oszlop kerül a `predictions`-be**:

```ts
// schema/index.ts diff – predictions tábla:
export const predictions = pgTable('predictions', {
  // ... a meglévő mezők változatlanul ...
  pointsGlobal:                smallint('points_global'),
  scorerPickPlayerId:          uuid('scorer_pick_player_id').references(() => players.id, { onDelete: 'restrict' }),
  scorerPlayerNameSnapshot:    text('scorer_player_name_snapshot'),  // a játékos neve a tipp leadásakor
  scorerBonusPoints:           smallint('scorer_bonus_points'),       // null = még nem értékelt; 0 = nem talált; 1 = talált
  createdAt:                   ...,
  updatedAt:                   ...,
}, (t) => ({
  uniquePrediction:    uniqueIndex('predictions_user_match_unique').on(t.userId, t.matchId),
  userIdx:             index('predictions_user_idx').on(t.userId),
  matchIdx:            index('predictions_match_idx').on(t.matchId),
  scorerPickIdx:       index('predictions_scorer_pick_idx').on(t.scorerPickPlayerId),
}))
```

**Miért `ON DELETE RESTRICT` és nem `SET NULL`?**

A `players` táblában lévő sorok az api-football sync során állandóak; ha admin merge-eli két duplikált játékos sorát egyé, az audit-ot megőrizzük: a tipp nem nullázódik el csendben. A `scorer_player_name_snapshot` text oszlop a leadás pillanatának nevét tartja (pl. "Szoboszlai Dominik"), így a UI-n akkor is megjeleníthető a tipp, ha a forrás játékos sora időközben átnevezésen / merge-en esett át. RESTRICT garantálja, hogy közvetlen DELETE-tel sem semmisíthetjük meg a hivatkozott történetet — admin merge esetén a hivatkozó tippeknek először át kell mutatniuk a győztes sorra (UPDATE), és csak utána lehet a vesztes sort törölni.

### Miért nem külön `match_scorer_predictions` tábla?

| Szempont | Egy oszlop a `predictions`-ben | Külön 1:1 tábla |
| --- | --- | --- |
| Kapcsolat a meccs tippel | 1:1, ugyanaz a deadline → ugyanaz az életciklus | szigorúan szinkronban kell tartani |
| Upsert egy körben | 1 SQL statement (a meglévő `upsertPrediction`) | join + két insert/update |
| Lock guard | a meglévő `match.scheduledAt > now()` check fedi | duplázni kell |
| Migráció költsége | 3 oszlop ALTER + index | új tábla + RLS + FK + relations |
| Lekérdezés | a `predictions` minden helyen tartalmazza | minden GET-be join kell |
| NULL semleges | `null` = nem tippelt – egyértelmű | row-hiánnyal kódolt – csapdás |

**Döntés: 3 új oszlop a `predictions`-ben.**

### Tényadat oldal: `match_results` bővítése egyetlen oszloppal

A meccsen ténylegesen gólt szerző játékosok id-jait **NEM külön táblában** tároljuk — egyetlen tömb a meglévő `match_results`-en:

```ts
// schema/index.ts diff – match_results tábla:
export const matchResults = pgTable('match_results', {
  // ... a meglévő mezők változatlanul ...
  scorerPlayerIds: uuid('scorer_player_ids').array().notNull().default(sql`'{}'::uuid[]`),
}, (t) => ({
  // ... meglévő indexek ...
  scorerIdsGin: index('match_results_scorer_ids_idx').using('gin', t.scorerPlayerIds),
}))
```

**Halmaz-szemantika**: minden id legfeljebb 1× szerepel a tömbben. Egy hat-trick is csak 1 id. A scoring service `includes()`-szel ellenőrzi a tippelt id-t. A halmaz-tulajdonságot a sync biztosítja (egy `Set` → `Array`).

**Mit tartalmaz a tömb?**
- ✅ Rendes idős akciógól (`type=Goal`, `detail=Normal Goal`, `comments=null`)
- ✅ Rendes idős fejes (`type=Goal`, `detail=Header`, `comments=null`)
- ✅ Játék közbeni büntető — rendes idő vagy hosszabbítás (`type=Goal`, `detail=Penalty`, `comments=null`)
- ✅ Hosszabbításbeli akciógól / fejes
- ❌ Öngól (`detail=Own Goal`)
- ❌ Kihagyott büntető (`detail=Missed Penalty`)
- ❌ **Büntetőpárbaj rúgások** (`comments=Penalty Shootout`) — sem a berúgott, sem a kihagyott
- ❌ Egyéb event típusok (Card, subst, Var) — sosem `type=Goal`

A szűrés a `sync.service.ts`-ben történik egy 4-feltételes filterrel (lásd §3.1 alatt), és a végeredmény tömb az, ami a `match_results.scorer_player_ids`-be kerül. A scoring service **vakon** bízik benne — nincs `is_shootout` flag, nincs heurisztika.

**Miért nem külön tábla?**
- Egyetlen 1:1 hozzárendelés meccs ↔ góllövők — ugyanaz az életciklus, mint a `match_results`-é.
- Nincs n:m, nincs külön darabszám-igény (a +1 bónusz nem skálázódik a góldarabszámmal).
- A halmaz natív Postgres tömbként trivian tárolható, a GIN index gyors id-tartalmaz lookup-ot ad.
- Egy tranzakcióban íródik a meccs eredménnyel — `UPDATE match_results SET home_goals=…, away_goals=…, scorer_player_ids=…` egyetlen statement-tel.

**Multiset alternatíva (elvetve):** felmerült, hogy a tömb tartsa annyiszor egy id-t, ahányszor lőtt (későbbi hat-trick bonus feature-höz). v1-re egyhangú döntés a halmaz mellett — a `+1` pontozási logika nem igényel multisetet, és ha később mégis kell, a sync módosítható (a `predictions.scorer_bonus_points` továbbra is 0/1 marad, a hat-trick külön oszlopba mehetne).

---

## 2. Players tábla – állapot

**Létezik már** (`schema/index.ts:107-118`):

```ts
export const players = pgTable('players', {
  id:          uuid('id').primaryKey().defaultRandom(),
  name:        varchar('name', { length: 100 }).notNull(),
  teamId:      uuid('team_id').references(() => teams.id),
  position:    varchar('position', { length: 30 }),
  shirtNumber: smallint('shirt_number'),
  externalId:  integer('external_id').unique(),  // api-football player.id
  createdAt:   ...,
  updatedAt:   ...,
}, (t) => ({
  teamIdIdx: index('players_team_id_idx').on(t.teamId),
}))
```

És van **`player-sync.service.ts`** is, ami `client.fetchSquad({ team })` segítségével szinkronizálja a nemzeti csapatok teljes keretét. A foreign key `predictions.scorer_pick_player_id → players.id` (ON DELETE RESTRICT) tehát közvetlenül használható.

### Hiányzó / megjegyzendő mezők

- `photo_url` jelenleg **nincs** a `players`-en. A v1 scope-ban **nem adunk hozzá** — a UI dropdown név + pozíció + mezszámmal dolgozik, foto későbbi story.
- `position` és `shirt_number` kitöltött a sync során – elég a UI-hoz.
- `external_id` az api-football `player.id` (validációból: pl. Messi=154, Mbappé=278) — stabil, ezt használjuk a sync során a tömb építésekor.

### Keret-szinkronizálás

A jelenlegi `syncPlayers()` (`player-sync.service.ts:21`) az **összes nemzeti csapat** keretét frissíti. **Ne nyúljunk hozzá**, de a story scope-jába tartozik:
- Frissítési ütem: a meccs előtt min. 24 órával futtassuk (cron job már létezik a sync runneren keresztül – `sync-runner.ts`). Ha a kerethirdetés a meccs előtt 1 nappal érkezik, ezt a sync gondoskodja.
- A frontend a meccs `homeTeamId` + `awayTeamId` alapján lekéri a két csapat aktuális játékosait a meglévő `GET /api/players?teamId=...` segítségével.

**Story scope-ba ne adjunk új sync-et, és ne adjunk új oszlopot a `players` táblához** – a meglévő mezők elegendőek.

---

## 3. Kiértékelési hely – pure függvény és integráció

### Új pure függvény (`scoring.service.ts`)

```ts
export interface ScorerBonusContext {
  readonly scorerPickPlayerId: string | null
  /**
   * A meccsen rendes / hosszabbítás idő alatt gólt szerző játékosok id-jai (halmaz-szemantika).
   * Forrás: `match_results.scorer_player_ids` — ami a sync-ben már szűrt (öngól / shootout / kihagyott pen NÉLKÜL).
   * A scoring service vakon bízik benne, nincs is_shootout flag itt sem.
   */
  readonly matchScorerPlayerIds: readonly string[]
}

export function calculateScorerBonus(ctx: ScorerBonusContext): number {
  if (!ctx.scorerPickPlayerId) return 0
  return ctx.matchScorerPlayerIds.includes(ctx.scorerPickPlayerId) ? 1 : 0
}
```

- **Pure**, nincs DB-hívás, unit-testelhető.
- **Hardcoded `+1`** — nincs config paraméter v1-ben.
- A `ReadonlySet<string>` helyett `readonly string[]` — közvetlenül megfeleltethető a Postgres `uuid[]` tömbnek és a `matchResults.scorerPlayerIds` JSON-szerializálásának. Az `includes()` lookup itt 1×N-es, de N legfeljebb a meccs góldarabszáma (általában <5), nincs jelentős perf-impact.

### Integráció a meglévő `calculatePoints`-be (kedvenc csapat × szorzó)

A meglévő pure `calculatePoints(...)` (`scoring.service.ts`) a meccs eredmény-tippjéből számol pontot, és a végén alkalmazza a `favoriteTeamMultiplier`-t, ha a user kedvenc csapata érintett. **Ezt egy paraméterrel bővítjük:**

```ts
export interface CalculatePointsContext {
  // ... meglévő mezők ...
  readonly scorerPickPlayerId: string | null
  readonly matchScorerPlayerIds: readonly string[]
  readonly favoriteTeamMultiplier: number  // változatlan a meglévő configból
  readonly userFavoriteTeamId: string | null  // változatlan
}

export function calculatePoints(ctx: CalculatePointsContext): {
  readonly pointsGlobal: number      // a végső, multiplied pont (eredmény + scorer bonus, kedvenc esetén ×)
  readonly scorerBonusPoints: number // nyers 0/1 (audit / UI badge)
} {
  const resultPoints = computeResultPoints(ctx)        // meglévő logika (1/2/3 + outcomeAfterDraw)
  const scorerBonus  = calculateScorerBonus({
    scorerPickPlayerId:    ctx.scorerPickPlayerId,
    matchScorerPlayerIds:  ctx.matchScorerPlayerIds,
  })

  const isFavoriteMatch = isUserFavoriteInvolved(ctx)  // meglévő helper
  const multiplier      = isFavoriteMatch ? ctx.favoriteTeamMultiplier : 1
  const pointsGlobal    = (resultPoints + scorerBonus) * multiplier

  return { pointsGlobal, scorerBonusPoints: scorerBonus }
}
```

**Kulcs invariáns:** a `favoriteTeamMultiplier` a `(resultPoints + scorerBonus)` összeget szorozza, nem külön. Tehát kedvenc csapat meccsén:
- 1-1 + Magyarország + talált scorer = `(3 + 1) * 2 = 8` pont
- 1-1 + Magyarország + nem talált scorer = `(3 + 0) * 2 = 6` pont
- 1-1 + nem kedvenc + talált scorer = `(3 + 1) * 1 = 4` pont
- 1-1 + nem kedvenc + nincs scorer tipp = `(3 + 0) * 1 = 3` pont

A `scorer_bonus_points` DB oszlop a **nyers 0/1** értéket tárolja audit célból (a UI a "+1" / "+2" badge-et a multiplier alapján renderelheti, vagy a teljes különbséget mutatja a leaderboardon).

### `calculateAndSavePoints` integráció

A `calculateAndSavePoints` (`scoring.service.ts:49`) bővítése:

```ts
export async function calculateAndSavePoints(
  matchId: string,
  result: ResultScore,
): Promise<void> {
  const [matchPredictions, configs, matchResultRow] = await Promise.all([
    db.select().from(predictions).where(eq(predictions.matchId, matchId)),
    db.select().from(scoringConfigs).where(eq(scoringConfigs.isGlobalDefault, true)),
    db.select({ scorerPlayerIds: matchResults.scorerPlayerIds })
      .from(matchResults)
      .where(eq(matchResults.matchId, matchId))
      .limit(1),
  ])

  const config = configs[0]
  if (!config) throw new Error('No global scoring config found')
  const scorerIds = matchResultRow[0]?.scorerPlayerIds ?? []

  await Promise.all(
    matchPredictions.map(pred => {
      const { pointsGlobal, scorerBonusPoints } = calculatePoints({
        // ... a meglévő ctx ...
        scorerPickPlayerId:     pred.scorerPickPlayerId,
        matchScorerPlayerIds:   scorerIds,
        favoriteTeamMultiplier: config.favoriteTeamMultiplier,
        userFavoriteTeamId:     /* a user kedvence — meglévő join */,
      })
      return db.update(predictions)
        .set({ pointsGlobal, scorerBonusPoints, updatedAt: new Date() })
        .where(eq(predictions.id, pred.id))
    }),
  )
}
```

**Mit ad a leaderboard?**

A `points_global` MÁR multiplied — tehát:

```sql
SUM(COALESCE(p.points_global, 0))
```

A `scorer_bonus_points` **NEM kerül külön összegzésre** — ezt csak audit / UI célból tartjuk. (Korábbi terv azt javasolta, hogy `SUM(points_global) + SUM(scorer_bonus_points)` legyen — ez DUPLA SZÁMOLÁST okozna, mert a scorer bónusz már benne van a `points_global`-ben. Egyszerűbb a model: `points_global` = "minden, ami a meccsre jár, multiplied".)

**Miért külön mező a `scorer_bonus_points` akkor egyáltalán?**
1. Audit / UI badge: a felhasználónak kimutathatjuk, "+1 góllövő bónusz miatt" érkezett pont (vagy "+2 kedvenc miatt"). A frontend a multiplier-t önmaga is tudja a configból.
2. Idempotencia jelölő: `null` = még nem értékelt, `0` = értékelt-de-nem-talált, `1` = értékelt-és-talált.
3. Ha valaha bevezetjük a csoport-szintű scorer override-ot, ez a nyers érték közvetlenül használható lesz a csoport-leaderboard pure függvényében.

### 3.1 Shootout szűrés a sync-ben — validált

**Szabály:** a knockout szakaszban a büntetőpárbaj rúgásai (sem berúgott, sem kihagyott) **NEM** kerülnek a `match_results.scorer_player_ids`-be.

**Forrás-truth (validálva 2026-06-08-án 2 múltbeli VB-meccsen — `fixture=979139` ARG–FRA döntő, `fixture=977794` NED–ARG negyeddöntő, mindkettő PEN-nel végződött):**

Az api-football `/fixtures/events` az 5 fő event-mezővel ad vissza minden gólt:

| esemény típusa | `type` | `detail` | `comments` | `time.elapsed` |
|---|---|---|---|---|
| Rendes idős akciógól | `Goal` | `Normal Goal` | `null` | 0..90 |
| Rendes idős fejes | `Goal` | `Header` | `null` | 0..90 |
| Rendes idős büntető (berúgott) | `Goal` | `Penalty` | `null` | 0..90 |
| Rendes idős büntető (kihagyott) | `Goal` | `Missed Penalty` | `null` | 0..90 |
| Öngól | `Goal` | `Own Goal` | `null` | bármely |
| **Hosszabbításbeli** akciógól / fejes / büntető | `Goal` | `Normal Goal` / `Header` / `Penalty` | `null` | 91..120 |
| **Shootout berúgott** | `Goal` | `Penalty` | **`Penalty Shootout`** | 120 (`time.extra` 1..N) |
| **Shootout kihagyott** | `Goal` | `Missed Penalty` | **`Penalty Shootout`** | 120 (`time.extra` 1..N) |

**Single-source-of-truth filter (a `comments` mező):**

```ts
// sync.service.ts - syncMatchResult(matchId, fixtureId)
const events: ApiFootballEvent[] = await client.fetchEvents({ fixture: fixtureId })
const scorerSet = new Set<string>()
for (const e of events) {
  if (e.type !== "Goal") continue                       // Card, subst, Var skip
  if (e.detail === "Missed Penalty") continue            // berúgott (kihagyott pen is type=Goal)
  if (e.detail === "Own Goal") continue                  // öngól nem számít
  if (e.comments === "Penalty Shootout") continue        // shootout (akár berúgott is) ki
  const internalId = playerIdMap.get(e.player.id)        // external (int) → internal (uuid)
  if (!internalId) continue                              // ismeretlen játékos drop
  scorerSet.add(internalId)
}
const scorerPlayerIds = Array.from(scorerSet)
await db.update(matchResults)
  .set({ scorerPlayerIds })
  .where(eq(matchResults.matchId, matchId))
```

**Miért egyetlen filter és nem heurisztika?**

A korábbi terv `time.elapsed > 120` heurisztikát + `is_shootout` flag oszlopot javasolt, hogy elkerüljük a hamis-pozitív hosszabbításbeli büntetőt. A 2026-06-08-i validációs hívás megmutatta: **az api-football a `comments="Penalty Shootout"` mezővel egyértelműen jelöli a shootout eseményeket, és kizárólag azokat**. Egy hosszabbításbeli büntető (pl. Mbappé 118' a 2022-es döntőben) `comments=null`-lal érkezik. Tehát:

- Nincs `is_shootout` flag a `match_results.scorer_player_ids` tömbben (és nincs külön `match_goal_scorers` tábla).
- Nincs `time.elapsed > 120` hasonlítás.
- Nincs `fixture.status === "PEN"` előfeltétel — a filter univerzális, csoportkörre is alkalmazható (ott egyszerűen nem fognak `Penalty Shootout` eventek megjelenni).
- Nincs külön shootout kód-útvonal a scoring service-ben.

**Tanulság a validációból:** a `player.name` mező néha tartalmaz szemetet (pl. `"W. Weghorst                                  1"` a NED-ARG 90+11-en). **Mindig `player.id`-t használj** a sync során, ne nevet. A `scorer_player_name_snapshot` (a tipp leadásakor) viszont a saját `players.name` oszlopunkból töltődik, nem az api-football válaszából.

**Idempotencia + VAR-ral visszavont gól:**
A sync **mindig teljes újraírást** végez: az aktuális `events` válaszból építi újra a `scorerSet`-et és `UPDATE`-tel cseréli a tömböt. Ha az api-football utólag visszavonja a gólt, a következő sync elvégzi a korrekciót. Ezután a `calculateAndSavePoints` újrafuttatása korrigálja minden érintett tipp `points_global` és `scorer_bonus_points` értékét.

---

## 4. Migration sorrend

### Következő migration száma: `0065_scorer_prediction.sql`

(legutolsó: `0064_push_settings.sql`).

### Egy migration legyen vagy több?

**Egy migration.** A négy séma-változás (predictions: 3 oszlop + index, match_results: 1 oszlop + GIN index) szorosan összefügg, atomikusan kell érvénybe lépniük.

### Migration SQL (`0065_scorer_prediction.sql`)

```sql
-- 1. Predictions: a tipp 3 új oszlopa
ALTER TABLE "predictions"
  ADD COLUMN "scorer_pick_player_id" uuid
    REFERENCES "players"("id") ON DELETE RESTRICT,
  ADD COLUMN "scorer_player_name_snapshot" text,
  ADD COLUMN "scorer_bonus_points" smallint;

CREATE INDEX "predictions_scorer_pick_idx"
  ON "predictions" ("scorer_pick_player_id");

-- 2. Match results: a meccsen ténylegesen gólt szerző játékosok halmaza
ALTER TABLE "match_results"
  ADD COLUMN "scorer_player_ids" uuid[] NOT NULL DEFAULT '{}'::uuid[];

CREATE INDEX "match_results_scorer_ids_idx"
  ON "match_results" USING gin ("scorer_player_ids");
```

**A `meta/_journal.json`-be `"idx": 65, "tag": "0065_scorer_prediction"` bejegyzés kerül** – ezt a `drizzle-kit generate` automatikusan írja, manuálisan **ne** szerkeszd.

**Mi NEM kerül a migrationbe (szándékosan):**
- ❌ `players.photo_url` — későbbi story
- ❌ `scoring_configs.scorer_bonus_points` — v1-ben hardcoded `+1` a service-ben
- ❌ Új `match_goal_scorers` / `match_scorer_events` tábla — egyetlen tömb a `match_results`-en elég

### RLS

A `predictions` és a `match_results` táblákon már van RLS — az új oszlopok automatikusan örökölik a sor-szintű policy-kat, nincs új policy a migrationben. A `match_results` írását továbbra is csak admin végezheti (a meglévő admin guard a `matches.service.ts`-ben), az olvasás publikus marad.

A `predictions.scorer_pick_player_id` `ON DELETE RESTRICT` kényszer biztosítja, hogy a `players` tábla törlési művelete (admin merge) nem engedi el csendben a tippet — a hivatkozásokat előbb át kell irányítani.

---

## 5. API végpontok hatása

### `PUT /api/predictions` (most: `upsertPrediction` – `predictions.service.ts:40`)

**Body bővítés:**
```ts
export interface PredictionInput {
  readonly matchId: string
  readonly homeGoals: number
  readonly awayGoals: number
  readonly outcomeAfterDraw?: MatchOutcome | null
  readonly scorerPickPlayerId?: string | null   // ÚJ – null vagy hiány = nincs góllövő tipp
}
```

A `upsertPrediction` body-jában (a `scorer_player_name_snapshot`-ot a service tölti ki, a kliens nem küldi):

```ts
const playerNameSnapshot = input.scorerPickPlayerId
  ? await fetchPlayerName(input.scorerPickPlayerId)  // SELECT players.name WHERE id = ...
  : null

await db.insert(predictions)
  .values({
    userId, matchId, homeGoals, awayGoals,
    outcomeAfterDraw:           input.outcomeAfterDraw ?? null,
    scorerPickPlayerId:         input.scorerPickPlayerId ?? null,
    scorerPlayerNameSnapshot:   playerNameSnapshot,
  })
  .onConflictDoUpdate({
    target: [predictions.userId, predictions.matchId],
    set: {
      homeGoals: input.homeGoals,
      awayGoals: input.awayGoals,
      outcomeAfterDraw:           input.outcomeAfterDraw ?? null,
      scorerPickPlayerId:         input.scorerPickPlayerId ?? null,
      scorerPlayerNameSnapshot:   playerNameSnapshot,
      updatedAt: new Date(),
    },
  })
```

**Validációk** (a service-ben, mielőtt mentenénk):
1. Ha `scorerPickPlayerId != null`, **de** `homeGoals === null || awayGoals === null` → **400 Bad Request** (`scorer_requires_full_prediction`). Az UX-ben a frontend ezt nem hagyja előfordulni — ez backend safety net.
2. Ha `scorerPickPlayerId != null`: a player `team_id`-je egyezzen a meccs `homeTeamId` vagy `awayTeamId` mezőjével – különben `400 Bad Request` (`scorer_player_not_in_match`). Egyetlen extra SELECT a `players` táblából (a name-snapshot lekéréssel egy helyre vonható).

### GET-ekben

A `Prediction` API típus (`types/index.ts:305`) bővül:
```ts
export interface Prediction {
  // ... meglévő mezők ...
  readonly scorerPickPlayerId: string | null
  readonly scorerPlayerNameSnapshot: string | null
  readonly scorerBonusPoints: number | null  // null = még nem értékelt; 0 = nem talált; 1 = talált
}
```

A `toApiPrediction` mapper egészüljön ki a három új mezővel. A frontend a `scorerPlayerNameSnapshot`-ot tudja használni a UI-n akkor is, ha a `players` lookup közben még nincs cache-elve a teljes lista.

### `PUT /api/admin/matches/:id/result` (eredmény-rögzítés)

A meglévő admin végpont body-ja bővül:

```ts
export interface AdminMatchResultInput {
  readonly homeGoals: number
  readonly awayGoals: number
  readonly extraTime?: { home: number; away: number } | null
  readonly penalties?:  { home: number; away: number } | null
  readonly scorerPlayerIds?: readonly string[]   // ÚJ – halmaz, csak rendes/ET valós gólok
}
```

Ha a kliens elküldi a `scorerPlayerIds`-t (pl. admin manuálisan szerkeszti, vagy a sync hívja meg), a backend egyszerűen átírja a `match_results.scorer_player_ids`-t a kapott tömbbel, majd hívja a `calculateAndSavePoints`-ot a teljes recalc-hoz. Ha nem küld semmit (régi kliens), a tömb változatlan marad.

### Kell külön `GET /matches/:id/players`?

**Nem kell új végpont.** Már létezik `GET /api/players?teamId=...` és a `players.service.ts` támogatja. A frontend kétszer hívja: `?teamId=<homeTeamId>` és `?teamId=<awayTeamId>`. Egy esetleges optimization (`teamIds[]=h,a`) **nem része v1-nek** — két párhuzamos GET teljesen elfogadható.

---

## 6. Lock logika

A meglévő guard (`predictions.service.ts:54`):
```ts
if (match.status !== 'scheduled' || match.scheduledAt <= new Date()) {
  throw new AppError(409, 'Prediction deadline has passed')
}
```

**Teljesen újrahasznosítható** – a góllövő tipp ugyanannak a `predictions` rownak része, így automatikusan ugyanaz a deadline-érvényesítés vonatkozik rá. **Nincs új lock kód.**

---

## 7. Idempotens kiértékelés

### Probléma

Ha a `calculateAndSavePoints(matchId, result)` kétszer fut le (recalc, vagy admin újra menti az eredményt), nem akarjuk, hogy a bónusz „2-szer" beleszámoljon a leaderboardba.

### Megoldás

A bónusz **érték** tárolva van a `predictions.scorer_bonus_points` mezőben (nem flag, hanem kiszámolt nyers 0/1). A teljes pont a `points_global`-be kerül (multiplied). Az értékelés **idempotens by design**:

- `scorer_bonus_points = null` (default) → még nem értékeltük
- `scorer_bonus_points = 0` → értékeltük, nem talált
- `scorer_bonus_points = 1` → értékeltük, talált

A `calculateAndSavePoints` minden futáskor `set`-tel **felülírja** a `points_global` és `scorer_bonus_points` mezőket – ugyanazokkal az értékekkel, ha az inputok nem változtak. **Soha nem ad hozzá**, mindig cseréli.

A leaderboard így:
```sql
SUM(COALESCE(p.points_global, 0))  -- a multiplier és a scorer már benne van
```

A `scorer_bonus_points` csak audit / UI célt szolgál (badge, magyarázó tooltip), a leaderboard-számolás nem hivatkozik rá. **NE add hozzá külön a `points_global`-hoz** — duplán számolnál.

### Shootout szűrés mint sync pipeline lépés

A shootout szűrés **a sync-ben** történik (`sync.service.ts` — lásd §3.1), nem a scoring service-ben. A `match_results.scorer_player_ids` tömb tehát mindig **már szűrt**:
- A pipeline idempotens marad: ugyanaz a `events` válasz → ugyanaz a `scorerSet` → ugyanaz a `points_global` és `scorer_bonus_points`.
- VAR-ral visszavont gól: egy újabb sync UPDATE-tel cseréli a tömböt; majd a `calculateAndSavePoints` újrafutása korrigálja a pontokat.
- Nincs külön „shootout-stripping" függvény a scoring service-ben — a felelősség egy helyen él.

### Mit ne csinálj

- **Ne** vezess be `scorer_bonus_awarded BOOLEAN` flag-et + `INSERT INTO scoring_log`-ot – ez delta-alapú kalkuláció, nehezen idempotens.
- **Ne** számolj a `match_results.scorer_player_ids` változásakor delta-pontot a leaderboardra – mindig teljes recalc.
- **Ne** add hozzá a `scorer_bonus_points`-ot a `points_global`-hoz a leaderboard SQL-ben — már benne van a multiplied `points_global`-ben.

### Tesztek (TDD)

```ts
// scoring.service.test.ts
describe('calculateScorerBonus', () => {
  it('returns 0 when no scorer was picked', () => {
    expect(calculateScorerBonus({ scorerPickPlayerId: null, matchScorerPlayerIds: ['p1'] })).toBe(0)
  })
  it('returns 0 when picked player did not score', () => {
    expect(calculateScorerBonus({ scorerPickPlayerId: 'p2', matchScorerPlayerIds: ['p1'] })).toBe(0)
  })
  it('returns 1 when picked player scored', () => {
    expect(calculateScorerBonus({ scorerPickPlayerId: 'p1', matchScorerPlayerIds: ['p1', 'p3'] })).toBe(1)
  })
  it('returns 1 only once even if a hat-trick (Set in match_results, includes() truthy)', () => {
    // a sync halmazba szervezte → 'p1' egyszer szerepel a tömbben
    expect(calculateScorerBonus({ scorerPickPlayerId: 'p1', matchScorerPlayerIds: ['p1'] })).toBe(1)
  })
  it('treats own goals as not present (sync responsibility)', () => {
    expect(calculateScorerBonus({ scorerPickPlayerId: 'p1', matchScorerPlayerIds: [] })).toBe(0)
  })
  it('ignores shootout goals (sync responsibility — array already filtered)', () => {
    // knockout meccs, p1 csak büntetőpárbajban szerzett gólt → a sync nem tette a tömbbe
    expect(calculateScorerBonus({ scorerPickPlayerId: 'p1', matchScorerPlayerIds: [] })).toBe(0)
  })
})

describe('calculatePoints (integráció: favoriteTeamMultiplier × scorer)', () => {
  it('regular match, no scorer pick: result only', () => {
    // 1-1, exact-hit (3p), no scorer, no favorite → 3
    expect(calculatePoints({ /* ... */ scorerPickPlayerId: null, favoriteTeamMultiplier: 2, isFavoriteMatch: false })).toEqual({
      pointsGlobal: 3, scorerBonusPoints: 0,
    })
  })
  it('regular match, scorer hit: +1', () => {
    expect(calculatePoints({ /* ... 1-1 exact */ scorerPickPlayerId: 'p1', matchScorerPlayerIds: ['p1'], isFavoriteMatch: false })).toEqual({
      pointsGlobal: 4, scorerBonusPoints: 1,
    })
  })
  it('favorite match, scorer hit: (3+1) * 2 = 8', () => {
    expect(calculatePoints({ /* ... 1-1 exact */ scorerPickPlayerId: 'p1', matchScorerPlayerIds: ['p1'], isFavoriteMatch: true, favoriteTeamMultiplier: 2 })).toEqual({
      pointsGlobal: 8, scorerBonusPoints: 1,
    })
  })
  it('favorite match, no scorer hit: (3+0) * 2 = 6 — scorerBonusPoints stays 0', () => {
    expect(calculatePoints({ /* ... 1-1 exact */ scorerPickPlayerId: 'p1', matchScorerPlayerIds: ['p2'], isFavoriteMatch: true, favoriteTeamMultiplier: 2 })).toEqual({
      pointsGlobal: 6, scorerBonusPoints: 0,
    })
  })
})
```

---

## Változás-lista (összefoglaló)

| Fájl | Változás |
| --- | --- |
| `db/schema/index.ts` | `predictions` + 3 oszlop (`scorer_pick_player_id`, `scorer_player_name_snapshot`, `scorer_bonus_points`) + index; `match_results` + 1 oszlop (`scorer_player_ids uuid[]`) + GIN index |
| `db/migrations/0065_scorer_prediction.sql` | egyetlen új migration |
| `db/migrations/meta/_journal.json` | drizzle-kit generálja, ne írd kézzel |
| `services/scoring.service.ts` | új pure `calculateScorerBonus`, `calculatePoints` bővítés (favoriteTeamMultiplier × scorerBonus), `calculateAndSavePoints` integráció |
| `services/scoring.service.test.ts` | TDD: 6+ pure függvényre + 4+ integrációs (favoriteTeamMultiplier × scorer) |
| `services/predictions.service.ts` | upsert + mapper új mezőkkel, validáció (scorer_requires_full_prediction + scorer_player_not_in_match), name-snapshot kitöltés |
| `services/predictions.service.test.ts` | validáció (két 400 case) + happy path |
| `services/sync.service.ts` | új helper `extractScorerPlayerIds(events, playerIdMap)`: 4-feltételes filter (`comments !== "Penalty Shootout"` és társai), Set → Array; `match_results.scorer_player_ids` UPDATE-tel cseréje |
| `services/sync.service.test.ts` | 6+ teszt a filterre (regular goal, ET goal, shootout scored, shootout missed, own goal, missed regular pen) |
| `services/matches.service.ts` (admin eredmény-rögzítés) | body fogadja a `scorerPlayerIds`-t (opcionális); átírja a `match_results.scorer_player_ids`-t |
| `routes/predictions.routes.ts` | a body séma elfogad `scorerPickPlayerId`-t |
| `types/index.ts` | `PredictionInput` + `Prediction` bővítés (3 mező); `AdminMatchResultInput` + `scorerPlayerIds` |

**Migration:** **egy** db – `0065_scorer_prediction.sql`.
**Lock:** **újrahasznosított** (`scheduledAt > now()`).
**Idempotencia:** mező-érték cseréje (set, nem add).
**Külön tábla a tippnek:** **NEM**. 3 oszlop a `predictions`-ben.
**Külön tábla a tényadatnak:** **NEM**. 1 oszlop (`uuid[]`) a `match_results`-en.
**Új players tábla:** **NEM** – már létezik. Új players oszlop sincs.
**`scoring_configs` új oszlop v1-ben:** **NEM** – `+1` hardcoded.
