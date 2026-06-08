---
id: SCORER-002
title: "Góllövő tipp – tipp leadása és tárolása"
priority: Should Have
status: Open
dependencies: []
complexity: M
---

# SCORER-002: Góllövő tipp – tipp leadása és tárolása

## Leírás

Mint **felhasználó**, szeretném a meccs **eredménytippje mellett** egy góllövő tippet is leadni — a meccs két csapatának keretéből egy játékost választok, és ha ő a meccsen gólt szerez, **+1 pont** jár (kedvenc csapat meccsén `× favoriteTeamMultiplier`, alapértelmezetten +2). A tipp **csak teljes meccs tipp mellé** (gólszámokkal) menthető, és a **meccs kezdetéig módosítható** (ugyanaz a deadline mint a meccs tipp). A kiértékelés és admin szerkesztés (SCORER-003 és SCORER-004) továbbra is nyitott — ez a story csak a **tipp leadást, tárolását és validációját** fedi le.

## Jelenlegi helyzet

- A `predictions` táblán nincs góllövő tipp mező.
- A `match_results` táblán nincs helye a meccsen gólt szerző játékosok listájának.
- A frontend `MatchesView` és `MatchDetailView` csak meccs eredménytippet támogat.
- A backend `predictions.service.ts::upsertPrediction` nem validál / nem fogad góllövő mezőt.

## Elfogadási kritériumok

### 1. **Adatbázis migration és séma**

- [ ] **Migration `0065_scorer_prediction.sql` létrejött** az alábbi változásokkal:
  - `predictions` tábla: `scorer_pick_player_id UUID FK (players.id, ON DELETE RESTRICT)`, `scorer_player_name_snapshot TEXT`, `scorer_bonus_points SMALLINT` oszlopok
  - `predictions_scorer_pick_idx` index `scorer_pick_player_id`-ra
  - `match_results` tábla: `scorer_player_ids UUID[] NOT NULL DEFAULT '{}'::uuid[]` oszlop
  - `match_results_scorer_ids_idx` GIN index `scorer_player_ids`-ra
  - Az `0065` a `meta/_journal.json` drizzle-kit journalban szerepel

### 2. **Backend séma és típusok**

- [ ] **`PredictionInput` (types/index.ts)** bővítve: `scorerPickPlayerId?: string | null` mező
- [ ] **`Prediction` (types/index.ts)** bővítve: `scorerPickPlayerId: string | null`, `scorerPlayerNameSnapshot: string | null`, `scorerBonusPoints: number | null` mezők
- [ ] **`AdminMatchResultInput` (types/index.ts)** bővítve: `scorerPlayerIds?: readonly string[]` opcionális mező
- [ ] **Drizzle schema (src/db/schema/index.ts)** szinkronban az 0065 migrationnel

### 3. **Backend validáció és üzleti logika**

- [ ] **`predictions.service.ts::upsertPrediction` validáció** az alábbi 400-as hibákat dobja:
  - `scorer_requires_full_prediction`: ha `scorerPickPlayerId != null` de `homeGoals == null || awayGoals == null`
  - `scorer_player_not_in_match`: ha `scorerPickPlayerId != null` de a játékos `team_id`-je nem egyezik a meccs `homeTeamId` vagy `awayTeamId`-jével
- [ ] **`predictions.service.ts::upsertPrediction` snapshot kitöltés**: a `scorer_player_name_snapshot`-ot a backend tölti ki a `players.name` oszlopból leadáskor; mindegy, hogy INSERT vagy UPDATE (onConflictDoUpdate is ide kerül)
- [ ] **Tipp leadás deadline**: a `upsertPrediction` őr a meccs `scheduledAt`-jét vizsgálja (nem fog új speciális règle a góllövőhöz)
- [ ] **Tesztek (TDD)**:
  - Sikeres tipp: `scorerPickPlayerId` + `homeGoals` + `awayGoals` → INSERT/UPDATE sikeres, `scorer_player_name_snapshot` kitöltött
  - Csak scorer tipp: `scorerPickPlayerId` + nincs gólszám → 400 (`scorer_requires_full_prediction`)
  - Nem meccscsapat-játékos: `scorerPickPlayerId` + érvényes gólszám de a játékos nem a meccs egyik csapatában → 400 (`scorer_player_not_in_match`)
  - Scorer törlés (`scorerPickPlayerId = null`): sikeres UPDATE, `scorer_player_name_snapshot` is NULL-ázódik
  - Deadline-ütközés: lezárult meccsre scorer tipp nem lehetséges (meglévő guard újrahasznosított)

### 4. **API végpontok**

- [ ] **`PUT /api/predictions`** body-ja elfogad `scorerPickPlayerId` mezőt, az `upsertPrediction` kezeli
- [ ] **`PUT /api/admin/matches/:id/result`** body-ja opcionálisan elfogad `scorerPlayerIds` tömböt; ha van, a `match_results.scorer_player_ids` UPDATE-ödik
- [ ] **`GET /api/predictions`** response tartalmazza az új 3 skorér mezőt (null értékek is)
- [ ] **`GET /api/players?teamId=...` (meglévő)** a frontend a góllövő select-hez kétszer hívja ezt (`homeTeamId` + `awayTeamId`); nincs új endpoint

### 5. **Frontend – MatchesView (list oldal)**

- [ ] **Tippelhető meccs kártyán** új sor a gólszám inputok ALATT:
  - `⚽ Góllövő:` label balra (`text-xs text-gray-500 font-medium`)
  - `PlayerSelectCombobox` komponent `size="compact"` (`h-8`), `restrictToTeams="[homeTeam, awayTeam]"`, `allowExplicitClear="true"`
  - Placeholder: "Válassz játékost… (opcionális)"
  - Empty state: `disabled` trigger, szöveg: "⟳ Játékosok betöltése…" (ha loading) vagy "Keretek még nem érhetők el" (ha üres)
  - Kitöltött state: zászló + rövid név (`Szoboszlai D.`) + `×` törlés gomb
  - Dirty állapot: border `border-blue-500 bg-indigo-50` (mint a gólszám inputnál)
- [ ] **Autosave**: a 2s debounce **csak akkor küld payloadot**, ha a gólszámok is be vannak töltve; scorer-only payload nem trigger-eli a mentést
- [ ] **Locked/lezárt meccs**: a sort nem mutassuk (később SCORER-003 az eredmény-badge rendszert hozza)
- [ ] **Komponens prop bővítés** `PlayerSelectCombobox`:
  - `restrictToTeams?: Array<{ id, name, shortCode, flagUrl }>` — csak ezen csapatok játékosai, csapatonként csoportolva
  - `allowExplicitClear?: boolean` — explicit "⊘ Töröl" sor a dropdown alján
  - `showPlayerMeta?: boolean` — pozíció + mezszám a sorban (MatchesView: `false`, MatchDetailView: `true`)
  - `size?: 'compact' | 'comfortable'` — trigger magasság `h-8` vs `h-10`

### 6. **Frontend – MatchDetailView (details oldal)**

- [ ] **Tipp kártya alszekciója** (az első separátor után):
  - Fejléc: `⚽ Góllövő tipp` label + jobbra `Opcionális` felirat `text-xs text-gray-400`
  - Knockout meccsen: `ⓘ` info ikon (szöveg: "A büntetőpárbaj gólok nem számítanak. A rendes játékidőben (és hosszabbításban) szerzett gólok és büntetők igen. Öngólt nem fogadunk el.")
  - `PlayerSelectCombobox` komponent `size="comfortable"` (`h-10`), `restrictToTeams="[homeTeam, awayTeam]"`, `showPlayerMeta="true"`, `allowExplicitClear="true"`
  - Placeholder: "Keresés vagy válassz a listából…"
- [ ] **Dropdown csapat-csoportosítás**: csoport fejléc (`text-xs font-semibold` zászló + csapatnév), játékos sor (`név` balra, `FW · #10` jobbra ha `showPlayerMeta=true`)
- [ ] **Autosave** ugyanaz mint a list oldalon: csak gólszámokkal együtt küld
- [ ] **`KnockoutScorerInfoTooltip` komponens** (apró, ~30 sor): az `ⓘ` ikon mellett tap/hover tooltip megjeleníti az üzenetet

### 7. **Frontend – Pinia store**

- [ ] **`predictions.store.ts`**:
  - `PredictionInput` bővítés `scorerPickPlayerId` mezővel
  - `Prediction` bővítés az új 3 skoórer mezővel
  - `upsertPrediction` action: payload tartalmazza `scorerPickPlayerId`-t; a `savePrediction` őr **csak akkor küld**, ha gólszámok is megvannak
  - Külön store action **nem szükséges** a góllövőhöz (meglévő upsert-flow elég)

### 8. **i18n – helyesírás**

- [ ] **Új namespace: `matches.scorer.*`** magyar + angol fordítással:
  - `label`: "Góllövő:" / "Scorer:"
  - `optional`: "Opcionális" / "Optional"
  - `placeholderCompact`: "Válassz játékost… (opcionális)" / "Select player… (optional)"
  - `placeholderComfortable`: "Keresés vagy válassz a listából…" / "Search or select from list…"
  - `loadingPlayers`: "Játékosok betöltése…" / "Loading players…"
  - `noRoster`: "Keretek még nem érhetők el" / "Rosters not available yet"
  - `tooltipKnockout`: "A büntetőpárbaj gólok nem számítanak. A rendes játékidőben (és hosszabbításban) szerzett gólok és büntetők igen. Öngólt nem fogadunk el." / "Shootout goals don't count. Regular time (and extra time) goals and penalties do. Own goals don't count."
  - `delete`: "Góllövő tipp törlése" / "Delete scorer pick"

### 9. **Tesztek – unit + integráció (TDD)**

- [ ] **Backend:**
  - `predictions.service.test.ts`: 4+ teszt (sikeres tipp + snapshot, scorer-only 400, nem-meccscsapat-játékos 400, törlés)
  - `routes/predictions.routes.test.ts` vagy integrációs: POST/PUT a `/api/predictions` végponton, validáció 400-as kezelése
  - **Nem szükséges** admin teszt (az `PUT /api/admin/matches/:id/result` már létezik, az új `scorerPlayerIds` opcionális)
- [ ] **Frontend:**
  - `PlayerSelectCombobox.spec.ts` bővítés: `restrictToTeams`, `allowExplicitClear`, `showPlayerMeta`, `size` propok tesztelése
  - `MatchesView.test.ts` bővítés: scorer-only nem küld upsert-et, autosave a gólszámokkal együtt, törlés (× gomb)
  - `MatchDetailView.test.ts` bővítés: ugyanezek + knockout ikon render
  - **Nem szükséges** `KnockoutScorerInfoTooltip.spec.ts` (apró komponens, visual regession teszt elég)

### 10. **Érvényesítés – edge case-ek**

- [ ] **Meccs kerete nincs lekérdezve** (loading): select `disabled`, placeholder: "Játékosok betöltése…"
- [ ] **Keretek üresek** (nincs play az egyik csapatban): select `disabled`, placeholder: "Keretek még nem érhetők el"
- [ ] **Játékos kikerül a keretből a deadline után**: tipp marad, a backend a `scorer_player_name_snapshot`-ból megjeleníti a nevet a UI-n
- [ ] **Játékos kikerül a deadline előtt**: select frissül (refetch), a játékos eltűnik; a tippelt érték a DB-ben marad, UI warning: `text-xs text-amber-600` "A választott játékos már nem szerepel a keretben — válassz másikat"
- [ ] **Deadline zárul**: az `isTippable(match)` guard ugyanaz mint a meccs tipphez, a select **read-only** válik
- [ ] **0:0 resultat + góllövő tipp**: érvényes — ha a játékos nem szerez gólt, 0 pont; ha szerez, +1

## Technikai megjegyzések

### Adatbázis

- **Migration**: egyetlen `0065_scorer_prediction.sql` — az 0064 után futtatható atomikusan.
- **Schema**: Drizzle-szinkronizálva az `schema/index.ts`-ben a `predictions` és `match_results` táblákon.
- **RLS**: az új oszlopok az `ON DELETE RESTRICT` FK-t leszámítva öröklődnek az RLS policy-kból.

### Backend service

- **`predictions.service.ts::upsertPrediction`**: a `scorer_player_name_snapshot`-ot a backend **tölti ki** a játékos leadáskori nevéből; az `onConflictDoUpdate`-ben is be van véve.
- **Pont-számítás**: a `calculateScorerBonus` és `calculatePoints` függvények a SCORER-001-arch.md-ben vannak — **ezek a SCORER-003 része**, nem tartoznak ide. Itt csak a **tipp leadás** van.

### Frontend komponensek

- **`PlayerSelectCombobox` bővítés**: nem új komponens, hanem 4 új prop. Az `MatchesView` és `MatchDetailView` közvetlenül használják, **nincs `MatchScorerPicker` wrapper** (felesleges absztrakció).
- **Csapat-csoportosítás**: a dropdown `restrictToTeams` prop alapján renderel `<li role="group">` szekciót csapatonként.

### Autosave logika

- A `predictions.store.ts::savePrediction` őr: **csak akkor küldi a payloadot az API-nak**, ha `homeGoals != null && awayGoals != null`. Az `scorerPickPlayerId` önmagában nem trigger-eli a mentést; ez UI-szinten is (dirty-állapot vizuális).

## Kizárások

- **Nincs kiértékelés**: a pontszámítás (calculateScorerBonus, calculatePoints) a SCORER-003 része.
- **Nincs kiértékelt badge/UI**: a `prediction.scorer_bonus_points` még `NULL` a leadáskor; az adatok csak később kerülnek ki (SCORER-003).
- **Nincs admin meccs eredmény szerkesztő bővítés az UI-ban**: a `scorerPlayerIds` manuális feltöltésének UI-ja out-of-scope; az API opcionálisan elfogad ilyet, de az admin nem nyúl hozzá GUI-ból ebben a story-ban.
- **Nincs live scorer szinkronizáció**: csak a meccs **zárásakor** (SCORER-003) — a tipp leadása után nincsen frissítés.
- **Nincs special_predictions integráció**: a góllövő tipp a `predictions` tábla része, nem új típus.
- **Nincs `calculateAndSavePoints` hívás a leadáskor**: a tipp „pending" marad a kiértékelésig.
- **Nincs csoport-szintű scorer override**: hardcoded `+1` v1-ben; az `scoring_configs` módosítása out-of-scope.
