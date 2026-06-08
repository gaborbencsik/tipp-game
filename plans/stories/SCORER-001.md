---
id: SCORER-001
title: "Góllövő tipp – +1 pont ha a tippelt játékos gólt szerez a meccsen"
priority: Should Have
status: Open
dependencies: []
complexity: L
---

# SCORER-001: Góllövő tipp – +1 pont ha a tippelt játékos gólt szerez a meccsen

## Leírás

Mint **felhasználó**, szeretném, hogy a meccs eredménytippje **mellett** egy góllövő tippet is adhatok — a meccs két csapatának keretéből válaszok **egy** játékost. Ha a választott játékos a meccsen (a **rendes játékidőben vagy hosszabbításban**) legalább 1 **rendes** gólt vagy **a játék alatti megítélt büntetőt** szerez, **+1 plusz pont** jár, függetlenül a meccs tipp eredményétől. Ez a bónusz **öngólokra** nem jár, és a knockout szakaszban a **meccs végi büntetőpárbaj (shootout)** során rúgott gólok **NEM számítanak** — kizárólag a meccs alatt (90 perc + esetleges hosszabbítás) szerzett gólok.

A **kedvenc csapat meccsén** (`favoriteTeamId` érintett) a teljes meccs pontja **× `favoriteTeamMultiplier`** (alapértelmezetten 2) — **a góllövő bónusz is duplázódik**, függetlenül attól, hogy a tippelt játékos a kedvenc csapatban van-e. Tehát egy talált góllövő tipp kedvenc csapat meccsén **+2 pont**.

**Tipp leadás megkötés:** a góllövő mezőt csak akkor lehet kitölteni, ha a meccs **eredménytippje (gólszám) is kitöltött**. Önmagában csak góllövő tipp nem leadható.

## Jelenlegi helyzet

Nincs góllövő tipp lehetőség — a felhasználó csak meccs eredményt (gólszám és kimenetel) tippelhet.

## Elfogadási kritériumok

### 1. Góllövő tipp felhasználói flow (List oldal – MatchesView)

- A tippelhető meccsnél a gólszám inputok alatt megjelenik egy új sor: **"⚽ Góllövő:"** + select dropdown (placeholder: "Válassz játékost… (opcionális)")
- A select trigger magassága **h-8** (megegyezik a gólszám inputokkal), stílusa konzisztens a meglévő design tokenekkel (`border-[1.5px] border-gray-300 rounded-md`, focus `border-blue-500 focus:ring-blue-500/10`)
- A dropdown megnyitásakor a meccs **két csapatának összes játékosa** megjelenik, **csapatonként csoportosítva**: csapatcímke (`🇭🇺 Magyarország (HUN)`), alatta a játékosok (`• Szoboszlai Dominik · #10`, stb.)
- A felhasználó beírhat szöveget a szűréshez (kereső); a lista mindkét csapat összes játékosán szűr
- Kiválasztás után a trigger megjeleníti a zászló ikont + játékos rövid nevét (`Szoboszlai D.`) + egy `×` törlés gomb
- **Dirty állapot** (nem mentett módosítás): border `border-blue-500 bg-indigo-50` (mint a gólszám inputnál)
- **Autosave** ugyanúgy működik: 2 másodperc inaktivitás után mentődik, `saveStatus` toast megjelenik
- Törléshez a felhasználó az `×` gombra kattint (`event.stopPropagation()`), vagy a dropdownban a legalján a "⊘ Töröl (nincs góllövő tipp)" sort választja

### 2. Góllövő tipp felhasználói flow (Details oldal – MatchDetailView)

- A tipp kártya alszekciójában (az első separátor után) megjelenik az új subszekcó: "⚽ Góllövő tipp" (opcionális felirat jobbra + ⓘ info ikon)
- A select **nagyobb**: `h-10 text-base`, teljes szélességű (`w-full`), placeholder: "Keresés vagy válassz a listából…"
- Az info ikon (`ⓘ`) **csak knockout meccsen** jelenik meg és tap-re (vagy hover) felfedi az üzenetet:
  > "A büntetőpárbaj gólok nem számítanak. A rendes játékidőben (és hosszabbításban) szerzett gólok és büntetők igen. Öngólt nem fogadunk el."
- A dropdown csapatonként csoportosított listát mutat (mint a list oldalon), **plusz** minden játékos sorban a pozíciót és mezszámot is (`FW · #10`), a legalján pedig explicit "⊘ Töröl" gomb
- Szerkesztés és mentés ugyanúgy történik, mint a list oldalon

### 3. Lezárt/kiértékelt állapot (List oldal)

- Ha a meccs lezárult és kiértékeltünk, és volt góllövő tipp:
  - Talált: `⚽ Szoboszlai D. [+1]` — zöld badge (`bg-green-50 text-green-700 border-green-200`), valamint a teljes pont sors megjelenik (`+4 pont` vagy a pontos összeg)
  - Nem talált: `⚽ ~~Szoboszlai D.~~` — szürke, line-through (`text-gray-500 decoration-gray-300`)
  - Még nem értékelt (élő meccs): `⚽ Szoboszlai D. [?]` — semleges kék badge (`bg-blue-50 text-blue-700 border-blue-200`)
- Meccs tipp mellett szeparátor (`·`), így egy sorban jelennek meg (360px-nél 2 sorra törik flex-col-lal)

### 4. Lezárt/kiértékelt állapot (Details oldal)

- Talált: `⚽ Góllövőm: 🇭🇺 Szoboszlai Dominik  [✓ +1 pont]` — zöld badge
- Nem talált: `[× 0 pont]` — szürke badge, név line-through
- Pending (még értékelés alatt): `[? várható]` — kék badge

### 5. Tipp leadás szabályai

- **Csak teljes tipp mellé**: a góllövő tipp **csak akkor menthető**, ha a meccs eredménytippje (mindkét gólszám) is ki van töltve. A `predictions.home_goals` és `away_goals` továbbra is `NOT NULL` — séma migráció **nem szükséges** ezen a fronton.
- **Deadline**: ugyanaz, mint a meccs tipp — `match.scheduledAt` után nem módosítható
- **Validáció**: a kiválasztott játékos valóban a meccs egyik csapatában szerepel-e (backend check). Ha csak `scorerPickPlayerId` érkezne gólszámok nélkül, a backend **400 Bad Request**-tel utasítja vissza.

### 6. Pontozás – üzleti logika

- **Számít** (a meccs alatt = rendes játékidő 0–90' + esetleges hosszabbítás 91–120'+):
  - Rendes gól (`detail: "Normal Goal"`)
  - A játék alatti megítélt büntető (`detail: "Penalty"`) — beleértve a hosszabbításban kapott büntetőt is
  - Fejes gól (`detail: "Header"`) — szintén `type: "Goal"`
- **NEM számít**:
  - Öngól (`detail: "Own Goal"`)
  - Kihagyott büntető (`detail: "Missed Penalty"`)
  - **Meccs végi büntetőpárbaj (shootout) gólok** a knockout szakaszban — még akkor sem, ha a tippelt játékos szerez gólt a párbajban
- **Pont (alap)**: ha a tippelt játékos legalább 1 olyan gólt szerzett, ami a "Számít" listán szerepel → **+1 pont** (több gól esetén is csak +1, nincs duplázás)
- **Kedvenc csapat meccsén**: a teljes meccs pontja `× favoriteTeamMultiplier` (alapértelmezetten 2) — **a +1 góllövő bónusz is duplázódik**, függetlenül attól, hogy a tippelt játékos a kedvenc csapatban van-e. Találat esetén tehát **+2 pont**.
- **Hosszabbítás (extra time, 91–120') – akciógól, fejes és büntető is számít**: ha a tippelt játékos a hosszabbításban szerez akció- vagy fejesgólt vagy a játék alatt megítélt büntetőt értékesít, az ugyanúgy +1-et ér (kedvenc meccsen +2). Az api-football oldalán ezek `time.elapsed` értéke 91 és 120 között van, `comments: null`.
- **Példa knockout meccsre**:
  - A meccs 1–1 a 120. percben, majd 4–3 lesz a büntetőpárbajban.
  - Ha a tippelt játékos a **110. percben** (ET) szerez akciógólt → **+1 pont** (kedvenc meccsén +2).
  - Ha a tippelt játékos a **105. percben** értékesít egy hosszabbításban kapott büntetőt → **+1 pont** (kedvenc meccsén +2).
  - Ha a tippelt játékos **csak a büntetőpárbajban** rúg gólt (nem a meccs alatt) → **0 pont**.
- **Shootout szűrés** — single-source-of-truth: az api-football minden shootout rúgást `type: "Goal"` event-ként ad vissza, viszont **kizárólag a shootout eseményeknél** állítja be a `comments` mezőt `"Penalty Shootout"` értékre (a 90 perc / ET közbeni büntetőknél `comments: null`). A scoring service tehát:
  ```ts
  e.type === "Goal"
  && e.detail !== "Missed Penalty"      // berúgott (kihagyott pen is type=Goal)
  && e.detail !== "Own Goal"            // öngólt nem fogadunk el
  && e.comments !== "Penalty Shootout"  // regular + ET, NEM shootout
  ```
  Nincs `time.elapsed > 120` heurisztika és nincs `is_shootout` flag — ezt a 2026-06-08-i validációs hívás (`/fixtures/events?fixture=979139` és `977794`) bizonyította.

### 7. Edge case-ek

- **Játékos nincs lekérdezve**: a select `disabled`, szöveg: "⟳ Játékosok betöltése…" (loading) vagy "Keretek még nem érhetők el" (üres/hiba)
- **Játékos kikerül a keretből a deadline után**: a tipp érvényes marad; kiértékelés a tényleges meccsen alapul (ha nem lép pályára, 0 pont)
- **Játékos kikerül a deadline előtt**: a select frissül, a játékos eltűnik; a meglévő tipp értéke megmarad a DB-ben, de a select alatt diszkrét figyelmeztetés: `text-xs text-amber-600` "A választott játékos már nem szerepel a keretben — válassz másikat"
- **Két azonos nevű játékos**: a dropdown megkülönböztet csapat + mezszám alapján (`Müller · DEU · #25` vs. `Müller · NED · #14`)
- **Mobile billentyűzet**: a select tap-re megnyit egy dropdown-ot és bezárja a numerikus billentyűzetet
- **VAR-ral visszavont gól**: az admin szerkesztheti a meccs eredményét és gólszerzőit → a `match_results.scorer_player_ids` újraírásra kerül → újra-kiértékelés futtatja a `calculatePoints` függvényt minden tippre, a pontok automágikusan helyesre állnak
- **Tippelt játékos törlődik a `players` táblából** (pl. admin merge után): nem fordul elő — a `predictions.scorer_pick_player_id` FK `ON DELETE RESTRICT`. A leadáskor mentett `scorer_player_name_snapshot` szöveg oszlop pedig garantálja, hogy a UI-n akkor is megjeleníthető a név, ha a forrás játékos sor időközben jelentősen változott (pl. átnevezés)

### 8. Idempotens kiértékelés

- Ha a `calculateAndSavePoints()` kétszer fut le ugyanazon az eredményen, a pont **soha nem duplázódik**
- Megoldás: a `predictions.scorer_bonus_points` mező tárolja a kiszámolt értéket (`null` = még nem értékeltük, `0` = nem talált, `1` = talált — kedvenc csapat meccsén a `favoriteTeamMultiplier` a végső pontszámra alkalmazódik a `points_global`-on, a `scorer_bonus_points` továbbra is csak a nyers 0/1 értéket tartja, a duplázás a leaderboard összegzésnél történik)
- A források igazsága: `match_results.scorer_player_ids uuid[]` — ez egyetlen tömb, halmaz-szemantikával (egy játékos egyszer szerepel akkor is, ha többször lőtt). A scoring service `includes()`-szel ellenőrzi a tippelt játékos id-ját
- Leaderboard összegzés egyszerűsítve: a `pointsGlobal` már tartalmazza a `favoriteTeamMultiplier`-t és a duplázott scorer-bónuszt is, a `scorer_bonus_points` csak audithoz tárolt nyers 0/1
- Nincs `match_goal_scorers` tábla, nincs `is_shootout` flag — a shootout-szűrés a sync során a `comments !== "Penalty Shootout"` filter alapján történik, és ami a `match_results.scorer_player_ids`-be bekerül, az **már szűrt** (csak rendes/ET valós gólok)

## Technikai megjegyzések

### DB séma – [SCORER-001-arch.md §1-4]

- **Új oszlopok `predictions` táblán**:
  - `scorer_pick_player_id` (UUID, FK → `players.id`, **nullable**, **`ON DELETE RESTRICT`**) — a tippelt játékos
  - `scorer_player_name_snapshot` (text, nullable) — a játékos teljes neve a tipp leadásának pillanatában; UI-megjelenítéshez akkor is, ha a játékos sora később változik
  - `scorer_bonus_points` (smallint, nullable — `null` = még nem értékelt, `0` = nem talált, `1` = talált; a kedvenc csapat × multiplier itt **nem** jelenik meg, csak a `points_global`-ban)
  - Index: `predictions_scorer_pick_idx` (`scorer_pick_player_id`)

- **Új oszlop `match_results` táblán**:
  - `scorer_player_ids` (uuid[], **NOT NULL**, default `'{}'`) — halmaz-szemantikával: a meccsen rendes / ET időben gólt szerző játékosok id-jai. Egy hat-trick is csak 1× szerepel. Shootout rúgások **nem** kerülnek bele. Az admin UI a meccs eredmény szerkesztése közben szerkesztheti.
  - GIN index: `match_results_scorer_ids_idx` (`scorer_player_ids`) — admin-keresésekhez ("mely meccseken szerzett X gólt?")

- **Új mező `scoring_configs` táblán**: **nincs új mező v1-ben**. A scorer bónusz hardcoded `+1` (a `scoring.service.ts` konstansa). Csoport-szintű override későbbi story-ban (`ALTER TABLE … ADD COLUMN` 5 perc, ha kell).

- **`favoriteTeamMultiplier` viselkedés**: változatlan — a `scoring_configs.favoriteTeamMultiplier` (default 2) a teljes meccs pontot szorozza, beleértve a scorer +1-et is. A scoring service ezt egyetlen multiplikációként alkalmazza a végén.

- **Migration**: **egyetlen** `0065_scorer_prediction.sql` — a 4 séma-változás (predictions: 3 oszlop + index, match_results: 1 oszlop + GIN index) atomikusan

- **Nincs új tábla** — eredetileg felmerült `match_goal_scorers` és/vagy `match_scorer_events` koncepció **el lett vetve**: az api-football events-ből szűrt játékos id-k tömbje a `match_results.scorer_player_ids`-be kerül, többi nem szükséges.

- **Nincs új oszlop a `players` táblán** — a `photo_url` későbbi story.

### Backend service réteg – [SCORER-001-arch.md §3]

- **Pure függvény** `scoring.service.ts::calculateScorerBonus`:
  ```ts
  export function calculateScorerBonus(ctx: ScorerBonusContext): number {
    if (!ctx.scorerPickPlayerId) return 0
    return ctx.matchScorerPlayerIds.includes(ctx.scorerPickPlayerId) ? 1 : 0
  }
  ```
  - Nincs DB-hívás, unit-testelhető
  - `matchScorerPlayerIds` a `match_results.scorer_player_ids` mezőből jön — már szűrt (csak rendes/ET valós gólok, nincs öngól, nincs shootout)
  - A `+1` érték hardcoded; a kedvenc csapat × multiplier-t a hívó oldal alkalmazza a teljes meccs ponton

- **Bővítés `scoring.service.ts::calculatePoints`** (a végső pontot számoló pure függvényen):
  - Bemenet bővítése `matchScorerPlayerIds: readonly string[]`-tel
  - `total = (resultPoints + scorerBonus) * favoriteTeamMultiplier`
  - A `favoriteTeamMultiplier` a `scoring_configs`-ból jön (változatlan)

- **Bővítés `scoring.service.ts::calculateAndSavePoints`**:
  - A meccs `match_results.scorer_player_ids` tömbjét beolvassa (1 query)
  - Minden prediction-höz kiszámítja a teljes pontot a fenti pure logika szerint
  - `predictions.points_global` és `scorer_bonus_points` (nyers 0/1) UPDATE-ödik

- **Validáció `predictions.service.ts::upsertPrediction`**:
  - Ha `scorerPickPlayerId != null`, de `homeGoals === null || awayGoals === null` → **400 Bad Request** ("scorer csak teljes tipp mellé adható")
  - Ha `scorerPickPlayerId != null`: játékos `team_id`-je egyezik-e a meccs `homeTeamId` vagy `awayTeamId`-jével? (400 Bad Request ha nem)
  - Leadáskor a `scorer_player_name_snapshot`-ot a backend tölti ki a játékos akkori neve alapján (egy join `players` táblára)

- **Tesztek (TDD)**:
  - `calculateScorerBonus` — 7+ teszt: nincs tipp, talált rendes idős akciógól, talált rendes idős büntető, talált fejes (eltér a `Header` detail-tól, de a sync már `scorer_player_ids`-be tette), talált hosszabbításbeli gól, nem talált, üres `scorer_player_ids` tömb
  - `calculatePoints` (favoriteTeamMultiplier × scorer): 4+ teszt — találat kedvenc nélkül +1, találat kedvenc meccsén +2, nincs találat kedvenc nélkül +0, nincs találat kedvenc meccsén +0
  - Idempotens recalc teszt: kétszer lefutva ugyanaz az eredmény
  - Integration teszt: `upsertPrediction` (csak scorer → 400) + `calculateAndSavePoints` flow

### API végpontok – [SCORER-001-arch.md §5]

- **PUT /api/predictions** — body bővítés:
  ```ts
  export interface PredictionInput {
    readonly matchId: string
    readonly homeGoals: number
    readonly awayGoals: number
    readonly outcomeAfterDraw?: MatchOutcome | null
    readonly scorerPickPlayerId?: string | null  // ÚJ
  }
  ```
  - `upsertPrediction` az `onConflictDoUpdate`-ben is bekerül a `scorer_pick_player_id` és `scorer_player_name_snapshot`
  - 400-zal utasítja vissza, ha `scorerPickPlayerId != null` és gólszámok hiányzanak

- **GET /api/predictions** — válasz bővítés:
  ```ts
  export interface Prediction {
    readonly scorerPickPlayerId: string | null
    readonly scorerPlayerNameSnapshot: string | null
    readonly scorerBonusPoints: number | null  // null = még nem értékelt, 0|1 = érték
  }
  ```

- **A meglévő `GET /api/players?teamId=...` újra felhasználható** — a frontend ezt kétszer hívja (`homeTeamId` és `awayTeamId`-vel)

- **Admin szerkesztés** — a meglévő `PUT /api/admin/matches/:id/result` body bővül:
  ```ts
  scorerPlayerIds?: readonly string[]  // halmaz, csak rendes/ET, nincs shootout
  ```

### Frontend komponensek – [SCORER-001-ux.md §6-9]

- **`PlayerSelectCombobox.vue` bővítés** — új propok (additív, nem törő):
  - `restrictToTeams?: Array<{ id, name, shortCode, flagUrl }>`
  - `showPlayerMeta?: boolean` (pozíció + mezszám a sorban)
  - `size?: 'compact' | 'comfortable'` (h-8 vs. h-10)
  - `allowExplicitClear?: boolean` (explicit "Töröl" gomb a legalján)
  - **Nincs külön `MatchScorerPicker.vue` wrapper** — a `MatchesView` és `MatchDetailView` közvetlenül használja a `PlayerSelectCombobox`-ot a megfelelő propokkal. A knockout `ⓘ` tooltip-et a kártya / details template renderel mellette.

- **Integráció**:
  - `MatchesView.vue` — tippelhető meccs kártyáján közvetlenül `<PlayerSelectCombobox :restrict-to-teams="[homeTeam, awayTeam]" size="compact" :allow-explicit-clear="true" />` a gólszám inputok alatt; a tipp **csak akkor menthető**, ha mindkét gólszám is ki van töltve (autosave logika ezt validálja, scorer-only nem küld payloadot)
  - `MatchDetailView.vue` — tipp kártya alszekciójában `<PlayerSelectCombobox … size="comfortable" :show-player-meta="true" :allow-explicit-clear="true" />` az outcome selector után
  - `predictions.store.ts` — `upsertPrediction` payload-ja elfogad `scorerPickPlayerId`-t; store action `setScorerPick(matchId, playerId | null)` delegál az upsert-re, és csak akkor küldi, ha gólszámok már léteznek

- **Tesztek (component level)**:
  - `PlayerSelectCombobox.spec.ts` bővítés: `restrictToTeams` szűrés, csapat-grouping, `allowExplicitClear` viselkedés, `showPlayerMeta` rendelés
  - `MatchesView.test.ts` / `MatchDetailView.test.ts`: scorer-only nem küld upsert-et, autosave a gólszámokkal együtt küldi, törlés (× gomb), knockout tooltip megjelenése

### API integráció (futuro) – [SCORER-001-api-research.md §6]

- A góllövők szinkronizálása: később `sync.service.ts::upsertResults` után hívódik, és ugyanabban a tranzakcióban tölti fel a `match_results.scorer_player_ids` tömböt
- Végpont: `GET /fixtures/events?fixture={fixtureId}` (api-football v3)
- Szűrés (single-source-of-truth):
  ```ts
  events
    .filter(e => e.type === "Goal"
              && e.detail !== "Missed Penalty"
              && e.detail !== "Own Goal"
              && e.comments !== "Penalty Shootout")
    .map(e => playerIdMap.get(e.player.id))   // external player id → internal UUID
    .filter((id): id is string => id != null) // ismeretlen játékos esetén drop
  ```
  Eredményt halmazba (`new Set()`) majd újra tömbbe rendezzük, hogy hat-trick is csak 1× szerepeljen.
- A `scorer_player_ids` írás **idempotens**: minden sync az aktuális api-football válaszból teljesen újraírja a tömböt (UPDATE, nem INSERT). Ez VAR-ral visszavont gólokra is helyesen reagál.

---

## Kizárások

- **Nincs player foto/avatar** a UI-ban — MVP után beépítendő
- **Nincs többszörös góllövő tipp** — egy meccsre egy játékos
- **Nincs hat-trick bonus, dupla pont** — mindig +1 (kedvenc meccsén +2 a `favoriteTeamMultiplier` × miatt), függetlenül a darabszámtól
- **Nincs assist-bónusz** — csak gólszerzés
- **Nincs élő scorer-frissítés** — a kiértékelés csak a meccs lezárása után történik
- **Nincs új `GET /matches/:id/players` végpont** — a meglévő `GET /api/players?teamId=...` újra felhasználható
- **Nincs új `match_scorer_events` / `match_goal_scorers` tábla** — a góllövők id-jai a `match_results.scorer_player_ids uuid[]` oszlopban tárolódnak
- **Nincs új `MatchScorerPicker.vue` wrapper** — a `PlayerSelectCombobox` közvetlenül használható
- **Nincs scoring_configs.scorer_bonus_points oszlop v1-ben** — `+1` hardcoded; csoport-szintű override későbbi story
- **Nincs csak-góllövő-tipp** — a góllövő mező csak teljes meccs tipp mellé menthető (gólszámok kötelezőek)
- **Nincs `is_shootout` flag** — a shootout-szűrés a sync-ben a `comments !== "Penalty Shootout"` filterrel történik, az aggregált `scorer_player_ids` már szűrt
- **Nincs special_predictions típus** — közvetlen `predictions` tábla bővítés
- **Nincs player foto/statisztika** — csak név + pozíció + mezszám a dropdownban
