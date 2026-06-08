---
id: SCORER-003
title: "Góllövő tipp – manuális kiértékelés és pontozás integrációja"
priority: Should Have
status: Open
dependencies: [SCORER-002]
complexity: M
---

# SCORER-003: Góllövő tipp – manuális kiértékelés és pontozás integrációja

## Leírás

Az admin a meccs eredmény szerkesztőjében kijelölheti a meccsen gólt szerző játékosokat; a backend integrálja a góllövő bónuszt a meglévő `calculateAndSavePoints` folyamatba (képlet: `(resultPoints + scorerBonus) * favoriteTeamMultiplier`); a felhasználók a leaderboardon és a meccs kartyákon látják a kiértékelt bónusz badgeket.

A feature **SCORER-002 előfeltételén** alapul (tipp leadás, `predictions.scorer_pick_player_id` és `match_results.scorer_player_ids` oszlopok, `PlayerSelectCombobox` multi-select bővítés).

## Jelenlegi helyzet

- SCORER-002 leszállította a tipp leadás réteget: DB migration, upsert validáció, UI input.
- A tippek **pending** állapotban vannak: `predictions.scorer_bonus_points = null`.
- A `match_results.scorer_player_ids uuid[]` oszlop létezik, de mindig üres (a szinkronizáció, SCORER-004, még nem érkezett meg).
- Nincsenek kiértékelt badge-ek a UI-n.

## Elfogadási kritériumok

### 1. Pure pontozási függvények

- [ ] **`calculateScorerBonus(ctx)`** új pure függvény a `scoring.service.ts`-ben
  - Bemenet: `scorerPickPlayerId: string | null`, `matchScorerPlayerIds: readonly string[]`
  - Kimenet: `0` (nincs tipp vagy nem talált) vagy `1` (talált)
  - Nincs DB-hívás, teljesen testelhető
  - Hardcoded `+1` v1-ben (config override később, SCORER-005)

- [ ] **`calculatePoints` bővítés** a meglévő `scoring.service.ts::calculatePoints`-et úgy módosítom, hogy
  - Bemenet kibővül: `scorerPickPlayerId`, `matchScorerPlayerIds`, `favoriteTeamMultiplier`
  - Kimenet: `{ pointsGlobal: number, scorerBonusPoints: number }`
  - `pointsGlobal = (resultPoints + scorerBonus) * favoriteTeamMultiplier` képlet alkalmazódik
  - `scorerBonusPoints` a nyers 0/1 érték (audit, UI badge)
  - Kedvenc csapat meccsen a bónusz is duplázódik: `(3 + 1) * 2 = 8` pont

- [ ] **`calculateAndSavePoints(matchId)` integrációja**
  - Beolvassa `match_results.scorer_player_ids` tömböt (1 query)
  - Minden `predictions` sorra hívja `calculatePoints`-ot a teljes logikával
  - UPDATE: `predictions.points_global` és `scorer_bonus_points` (idempotens: set, nem add)

### 2. Admin meccs eredmény UI – Gólszerzők szerkesztés

- [ ] Admin `PUT /api/admin/matches/:id/result` endpoint body bővül: `scorerPlayerIds?: readonly string[]`
  - Dedup: `new Set(input.scorerPlayerIds)` → array vissza
  - Validáció: minden id a meccs egyik csapatához tartozik (2 DB JOIN vagy meglévő csapat context)
  - Ha hiba: `400 Bad Request` (`scorer_ids_invalid_team` / `scorer_ids_player_not_found`)

- [ ] Admin frontend `AdminMatchEditView.vue` vagy meccs szerkesztő form
  - Új szekció: "⚽ Gólszerzők" multi-select
  - `<PlayerSelectCombobox :restrict-to-teams="[homeTeam, awayTeam]" multiple :allow-explicit-clear="true" />`
  - A komponens **multi-select módra** van beállítva: chip-lista vagy szöveg lista a kiválasztottakkal
  - Placeholder: "Válassz gólszerzőket a meccs mérkőzésről…"
  - Mentéskor `PUT /api/admin/matches/:id/result` -be járul az `scorerPlayerIds` tömb
  - Ha az admin kitörli az egész listát (mentés 0 játékossal), a korábbi `+1`-ek korrigálódnak (recalc)

### 3. Kiértékelés badge UI – List oldal (`MatchesView.vue`)

- [ ] Tippelhető meccs (nem lezárult): a góllövő select a SCORER-002 ui-nt mutatja
- [ ] Lezárult meccs, kiértékelt:
  - Talált: `⚽ Szoboszlai D. [✓ +1]` zöld badge (`bg-green-50 text-green-700 border-green-200`)
  - Nem talált: `⚽ ~~Szoboszlai D.~~` szürke + line-through (`text-gray-500 decoration-gray-300`), badge elhagyható vagy `[× 0]` szürke
  - Pending (élő): `⚽ Szoboszlai D. [?]` kék badge (`bg-blue-50 text-blue-700 border-blue-200`)
  - A badge mellett (vagy alatt mobile-on): kedvenc csapat meccsen `(×2)` jelzés (a `pointsGlobal` már tartalmazza)

- [ ] Nincs góllövő tipp: nem mutatunk semmit (zaj kerülés)

### 4. Kiértékelés badge UI – Details oldal (`MatchDetailView.vue`)

- [ ] Kiértékelt, talált: `⚽ Góllövőm: 🇭🇺 Szoboszlai Dominik  [✓ +1 pont]` zöld badge
- [ ] Kiértékelt, nem talált: `[× 0 pont]` szürke badge, név line-through
- [ ] Pending: `[? várható]` kék badge
- [ ] Nincsenek tipp: "Nincs góllövő tipp" optional szürke sor (vagy nem mutatjuk)

### 5. Leaderboard konzisztencia – regression test

- [ ] Leaderboard SQL **nem változik**: a query továbbra is `SUM(points_global)` a `predictions`-ből
- [ ] A `scorer_bonus_points` **NEM** kerül külön összeadásra (double-counting elkerülés)
- [ ] Teszteset: egy user, kedvenc csapat, 1–1 tipp + scorer hit = `(3 + 1) * 2 = 8` pont, leaderboard ugyanez

### 6. Teszt lefedettség

- [ ] Unit: `calculateScorerBonus` – 8+ eset (nincs tipp, talált, nem talált, hat-trick=1, üres array, stb.)
- [ ] Unit: `calculatePoints` favoriteTeamMultiplier × scorer – 4+ eset
  - Talált kedvenc nélkül: `(3 + 1) * 1 = 4`
  - Talált kedvencvel: `(3 + 1) * 2 = 8`
  - Nem talált kedvenc nélkül: `(3 + 0) * 1 = 3`
  - Nem talált kedvencvel: `(3 + 0) * 2 = 6`
- [ ] Integration: idempotencia – `calculateAndSavePoints` kétszer futva ugyanaz az eredmény
- [ ] Integration: admin endpoint validáció – `scorerPlayerIds` dedup, team check, 400 hiba
- [ ] E2E / manual: admin kitölt gólszerzőket → meccs lezárva → felhasználó látja az eltalált +1 badge-et
- [ ] E2E / manual: admin módosítja a gólszerzőket (pl. VAR után) → `calculateAndSavePoints` újra fut → pontok korrigálódnak

## Technikai megjegyzések

### Backend service réteg

**`scoring.service.ts`:**
- Új export `calculateScorerBonus(ctx: ScorerBonusContext): number` — 0 vagy 1
- `calculatePoints` szignatúra bővül; kimenet: `{ pointsGlobal, scorerBonusPoints }`
- `calculateAndSavePoints` beolvassa a `match_results.scorer_player_ids` tömböt; UPDATE: `points_global` és `scorer_bonus_points`

**`matches.service.ts`** (admin eredmény-rögzítés):
- `PUT /api/admin/matches/:id/result` handler a body `scorerPlayerIds` mezőt fogadja
- Dedup + team validation
- UPDATE `match_results.scorer_player_ids`-t, majd `calculateAndSavePoints`-ot hívja

**Validáció `predictions.service.ts::upsertPrediction`-ben** (SCORER-002 már tartalmazza):
- 400 ha `scorerPickPlayerId != null` de `homeGoals === null || awayGoals === null`
- 400 ha `scorerPickPlayerId` nem a meccs egyik csapatához tartozik

### Frontend bővítés

**`PlayerSelectCombobox.vue` multi-select mód** (függőség: már van a komponensben vagy bővítés szükséges):
- `multiple?: boolean` prop — chip-lista vagy szöveg-lista a kiválasztottakkal
- Az admin form visszaadja a kiválasztott ID-kat array formában

**Admin form** – `AdminMatchEditView.vue` vagy dedikált meccs-szerkesztő:
- Gólszerzők section a meglévő `homeGoals`, `awayGoals`, `extraTime`, `penalties` inputok után
- `<PlayerSelectCombobox :multiple="true" :restrict-to-teams="[homeTeam, awayTeam]" />`
- Button: "Mentés" → `PUT /api/admin/matches/:id/result` a teljes payload-dal

**UI badge-ek:**
- `MatchesView.vue`: a locked állapotú kártyában a meccs tipp sora után (`⚽ Szoboszlai D. [✓ +1]`)
- `MatchDetailView.vue`: a tipp kártya alszekciójában (`⚽ Góllövőm: … [✓ +1 pont]`)

### i18n

- `admin.matches.scorerListLabel` = "Gólszerzők"
- `admin.matches.scorerListPlaceholder` = "Válassz gólszerzőket…"
- `admin.matches.scorerListHelp` = "A meccs alatt gólt szerző játékosok (rendes idő + hosszabbítás, büntetőpárbaj NEM)"
- `matches.scorer.hit` = "Talált: +1"
- `matches.scorer.miss` = "Nem talált: 0"
- `matches.scorer.pending` = "Kiértékelés alatt"
- `matches.scorer.favoriteDoubled` = "(×2 a meccsen)" (ha kedvenc csapat)

## Edge case-ek

1. **Admin törli a teljes gólszerzőlistát** → korábbi `+1`-ek 0-ra korrigálódnak
2. **Admin elment 0 játékossal** → `match_results.scorer_player_ids = '{}'` → minden scorer tipp `+0` pont
3. **0–0 meccs + scorer pick** → 0 pont (no goals in array)
4. **Játékos kikerül a keretből, de már góllövő tipp róla** → FK `ON DELETE RESTRICT` megakadályozza a törlést; a tipp érvényes marad audit célból
5. **Szinkronizáció vs. admin manuális**: a SCORER-004 sync és ez az admin UI párhuzamosan írhatja az `scorer_player_ids`-t. Az utolsó UPDATE nyer (az admin felülírja a syncet, vagy vv). Nyitott kérdés: szükség van-e egy flag-re, hogy "admin lock" után ne felülírja az auto-sync? Javaslat: **az MVP-ben NEM szükséges** — a VB alatt az admin által szerkesztett meccsek közben nem futat szinkron.

## Kizárások

- **NEM tartalmaz** `fetchFixtureEvents` API kliens (`SCORER-004`)
- **NEM tartalmaz** `mapEventsToScorerPlayerIds` szinkronizációs helper (`SCORER-004`)
- **NEM tartalmaz** csoportonkénti config override (`SCORER-005`)
- **NEM tartalmaz** élő scorer frissítés (polling) — csak meccs záráskor
- **NEM tartalmaz** VAR-ral visszavont gól audit log — csak a recalc
- **NEM tartalmaz** csak-scorer-tipp validáció a UI-n (már a SCORER-002-ben van)

## Közvetlen referenciák

- `SCORER-001.md` §3 (kiértékelési hely, pure függvény), §4 (idempotens kiértékelés)
- `SCORER-001-arch.md` §3 (scoring service), §5 (API végpontok — admin result input)
- `SCORER-001-ux.md` §3–4 (details / list badge-ek), §5.3 (knockout tooltip)
