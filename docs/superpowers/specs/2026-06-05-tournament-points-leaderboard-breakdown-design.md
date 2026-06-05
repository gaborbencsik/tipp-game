# Torna-tipp pontok kategória-bontása a leaderboardon

**Dátum:** 2026-06-05
**Státusz:** Design — implementáció előtt
**Story-ID:** TBD (backlog felvételkor)

## Probléma

A torna-tipp pontok ma **rejtve maradnak** a felhasználó elől:

- A `GroupDetailView.vue` leaderboard-tábláján a "Speciális pontok" oszlop el van rejtve egy hardkódolt `SHOW_SPECIAL_TIPS = false` flag mögött (`packages/frontend/src/views/GroupDetailView.vue:907`).
- A globális leaderboard (`packages/backend/src/services/leaderboard.service.ts:50`) `specialPredictionPoints: 0`-t ad vissza hardkódolva, és a `totalPoints` query nem JOIN-olja a `special_predictions`-t — vagyis globálisan **egyáltalán nem** számítanak a torna-tipp pontok.
- A `scoreBracketProgression` (`packages/backend/src/services/bracket-progression.service.ts:329-335`) placeholder, mindig 0-t ad — a Last 32 → Champion körök tényleges pontozása nincs implementálva, csak a `ScoringExplainerModal`-ban van leírva.

A felhasználó nem látja, hogyan oszlanak meg a pontjai a bracket-körök, csoport-bónuszok, gólkirály-tipp között — pedig a torna előrehaladtával ennek motivációs ereje nő.

## Cél

A torna-tipp pontok **kategóriánként látszódjanak** a leaderboard táblázatokban (csoport és globális egyaránt), egy új `pointsByCategory: Record<LeaderboardCategory, number>` API-mezőn keresztül, kibontható sor-interakcióval. A `SHOW_SPECIAL_TIPS` flag és a hozzá kötött elavult tab-UI törlődik. A bracket-progression scoring kibővül körönkénti pontozásra (Last 32 → Champion), és bekerülnek a hiányzó torna-tipp típusok (top scorer).

## Hatókör

**Benne:**
- Adatmodell: `special_prediction_category` enum + `category` mező + `bracket_round_points` JSONB konfig
- Backfill: meglévő típusok kategorizálása `input_type` alapján
- Új seed: `top_scorer` típus (player_select, 5p)
- Bracket scoring kibővítése per-round bontással (kumulatív, csapatonként)
- Backend leaderboard agregáció: csoport és globális, `pointsByCategory` mezővel
- Globális leaderboard `totalPoints` korrekció (special_predictions JOIN)
- `SHOW_SPECIAL_TIPS` flag és kapcsolódó UI törlése (tab, deep-link, member-szintű listázás)
- Új komponens: `LeaderboardCategoryBreakdown` — kétszer használva (csoport és globális)
- Recalc szkript bracket-típusokra (deployment-időben)

**Nincs benne:**
- Wide-layout / oszlopos UI design (külön UX-story)
- Custom (admin által létrehozott) tippek kategória-mező admin-UI-ja (külön story)
- A `bracket_round_points` admin-UI-szerkesztője (későbbi enhancement)

## Adatmodell

### Új PG enum: `special_prediction_category`

5 érték: `group_stage_bonus`, `group_standings`, `upset_special`, `knockout`, `top_scorer`.

### Új mezők

```ts
specialPredictionTypes: {
  category: specialPredictionCategoryEnum('category')
    .notNull()
    .default('group_stage_bonus'),
}

scoringConfigs: {
  bracketRoundPoints: jsonb('bracket_round_points')
    .$type<BracketRoundPoints>()
    .notNull()
    .default(sql`'{"last_32":2,"last_16":3,"qf":4,"sf":6,"final":8,"champion":10}'::jsonb`),
}
```

### Backfill

```sql
UPDATE special_prediction_types SET category = 'upset_special'    WHERE input_type = 'multi_team_weighted';
UPDATE special_prediction_types SET category = 'group_standings'  WHERE input_type = 'all_groups_standing';
UPDATE special_prediction_types SET category = 'knockout'         WHERE input_type = 'bracket_progression';
UPDATE special_prediction_types SET category = 'top_scorer'       WHERE input_type = 'player_select';
-- A többi (4 db gólos bónusz) marad default 'group_stage_bonus' kategórián.
```

### Új seed: top_scorer típus

```ts
{
  name: 'Gólkirály',
  inputType: 'player_select',
  points: 5,
  category: 'top_scorer',
  isGlobal: true,
}
```

Idempotens (`ON CONFLICT DO NOTHING` vagy létezés-ellenőrzés).

## Display kategóriák (frontend)

10 sor, fix sorrendben:

| # | Display kulcs | Storage forrás | Pont |
| - | ------------- | -------------- | ---- |
| 1 | `group_stage_bonus` | category=group_stage_bonus (4 típus) | 3p × 4 |
| 2 | `group_standings`   | category=group_standings              | 3p |
| 3 | `upset_special`     | category=upset_special                | admin |
| 4 | `last_32`           | category=knockout, virtuális kör      | 2p × csapat |
| 5 | `last_16`           | category=knockout, virtuális kör      | 3p × csapat |
| 6 | `qf`                | category=knockout, virtuális kör      | 4p × csapat |
| 7 | `sf`                | category=knockout, virtuális kör      | 6p × csapat |
| 8 | `final`             | category=knockout, virtuális kör      | 8p × csapat |
| 9 | `champion`          | category=knockout, Final-győztes      | 10p |
| 10 | `top_scorer`       | category=top_scorer                   | 5p |

A `knockout` storage-kategória 6 display-sort ad (4–9), a többi 1:1 a saját kategóriájából.

## Bracket scoring

### Új signature

```ts
export function scoreBracketProgression(
  predicted: BracketProgressionAnswer,
  correct: BracketProgressionAnswer,
  pointsByRound: BracketRoundPoints,
): BracketRoundBreakdown

interface BracketRoundBreakdown {
  last_32: number
  last_16: number
  qf: number
  sf: number
  final: number
  champion: number
}
```

### Pontozási szabály (csapatonként, kumulatív monoton)

A user **X pontot** kap egy adott körhöz, **ha az általa előrejutónak tippelt csapat valóban eljutott (legalább) addig a körig**. A pontok körönként **összeadódnak**: aki a döntős csapatot eltalálta, az minden alacsonyabb kör pontját (L32+L16+QF+SF+F) is megkapja arra a csapatra.

```
last_32  := |teams_predicted_to_reach_L32 ∩ teams_actually_in_L32| × pointsByRound.last_32
last_16  := |teams_predicted_to_reach_L16 ∩ teams_actually_in_L16| × pointsByRound.last_16
qf       := |teams_predicted_to_reach_QF  ∩ teams_actually_in_QF|  × pointsByRound.qf
sf       := |teams_predicted_to_reach_SF  ∩ teams_actually_in_SF|  × pointsByRound.sf
final    := |teams_predicted_to_reach_F   ∩ teams_actually_in_F|   × pointsByRound.final
champion := (predicted_champion === actual_champion ? 1 : 0)        × pointsByRound.champion
```

A `special_predictions.points` numeric oszlopba a 6 round **összege** kerül. A per-round bontást a leaderboard service futási időben számolja a `correct_answer`-ből — nem perzisztáljuk (YAGNI; ha lassú lesz, későbbi optimalizáció).

## API DTO

```ts
export type LeaderboardCategory =
  | 'group_stage_bonus' | 'group_standings' | 'upset_special'
  | 'last_32' | 'last_16' | 'qf' | 'sf' | 'final' | 'champion'
  | 'top_scorer'

export interface LeaderboardEntry {
  // ... meglévő mezők
  matchPoints: number
  specialPredictionPoints: number
  pointsByCategory: Record<LeaderboardCategory, number>  // ÚJ — minden 10 kulcs jelen, 0 ha nincs pont
  totalPoints: number
}
```

**Invariáns:** `specialPredictionPoints === sum(values(pointsByCategory))` — tesztben asszertáljuk.

## Backend agregáció

### Csoport-leaderboard

Két lépésben épül a `pointsByCategory`:

1. **Egyszerű kategóriák** (`group_stage_bonus`, `group_standings`, `upset_special`, `top_scorer`):
   ```sql
   SELECT sp.user_id, spt.category, SUM(sp.points) AS pts
   FROM special_predictions sp
   JOIN special_prediction_types spt ON spt.id = sp.type_id
   WHERE sp.group_id = $1
   GROUP BY sp.user_id, spt.category
   ```

2. **Knockout (bracket)**: a (user, type=bracket) sorok + `correct_answer` → `scoreBracketProgression(predicted, correct, bracketRoundPoints)` futási időben → 6 round-bontás userenként.

### Globális leaderboard

**Distinct user+typeId**: minden válasz **egyszer** számít, függetlenül attól, hány csoportba van duplikálva (mert a tournament-tips.service.ts:396-403 minden globális tippet az összes feliratkozott csoportba másol):

```sql
-- N csoportbeli replika közül egyetlen érték (mert mindegyik ugyanaz)
SELECT user_id, type_id, MAX(points) AS pts
FROM special_predictions sp
JOIN special_prediction_types spt ON spt.id = sp.type_id
WHERE spt.is_global = true
GROUP BY user_id, type_id
```

A globális `totalPoints = matchPoints + sum(pointsByCategory)`. **Ez user-látható változás:** a globális ranglistán mostantól bekerülnek a torna-tipp pontok (előtte 0 volt).

## Frontend

### Kódtörlés (SHOW_SPECIAL_TIPS flag eltávolítása)

A `GroupDetailView.vue:907` `const SHOW_SPECIAL_TIPS = false` és minden használata:

| Sor | Művelet |
| --- | ------- |
| 47  | "Speciális" tab gomb — **törlés** |
| 103 | "Speciális pontok" oszlop-fejléc — **`v-if` eltávolítás** (mindig látszik) |
| 135 | "Speciális pontok" cella — **`v-if` eltávolítás**, kibontható sorrá alakítás |
| 399 | Admin "Hivatalos speciális tippek" panel — **`v-if="isGroupAdmin"`-re cserélni** |
| 444 | Admin "Egyedi speciális tippek" panel — **`v-if="isGroupAdmin"`-re cserélni** |
| 664 | "Speciális" tab tartalom — **törlés** |
| 1377 | `?tab=special` deep-link kezelés — **törlés** |
| 907 | A flag konstans maga — **törlés** |

A `groups.store.ts`-ben a `specialPredictionsMap` (member-szintű listázás) **csak akkor törlődik**, ha más nézet/composable nem használja. A `usePendingSpecialTips` composable hivatkozik rá — ezért a store-mező **valószínűleg marad**, csak a view-blokk törlődik.

### `LeaderboardCategoryBreakdown` komponens

```ts
defineProps<{
  pointsByCategory: Record<LeaderboardCategory, number>
}>()
```

- Pure presentation, nincs store/API
- 10 sor fix display-sorrendben, magyar/angol i18n labellel
- 0p sorok `opacity-50` (a kategória létezik, de még nincs pont)
- Unit-tesztelhető (Vitest + @vue/test-utils)

### Integráció két helyen

- `GroupDetailView.vue` — a "Speciális pontok" cella kattintásra (vagy ▾ chevronnel) kibontja a panelt
- `LeaderboardView.vue` — új "Speciális" oszlop, ugyanaz a kibontás-interakció

### i18n kulcsok

Új (10 db):
```json
"leaderboard.category.group_stage_bonus": "Csoportkör bónusz",
"leaderboard.category.group_standings":   "Csoport végeredmény",
"leaderboard.category.upset_special":     "Meglepetés-tipp",
"leaderboard.category.last_32":           "Last 32",
"leaderboard.category.last_16":           "Nyolcaddöntő",
"leaderboard.category.qf":                "Negyeddöntő",
"leaderboard.category.sf":                "Elődöntő",
"leaderboard.category.final":             "Döntő",
"leaderboard.category.champion":          "Bajnok",
"leaderboard.category.top_scorer":        "Gólkirály"
```

Törölt: `groupDetail.tabSpecial`, `specialTabEmpty`, `specialPointsTitle`, `specialMaxPoints`, és minden tab-os key, amit csak a törölt blokk használt. Implementáció előtt grep-pel verifikáljuk, hogy nincs dinamikus hivatkozás máshonnan.

## Tesztek

### Backend (pure / service)

- `bracket-progression.service.test.ts` — a `scoreBracketProgression` új tesztjei: perfect, champion-only, miss, partial. A meglévő `=== 0`-t váró teszt frissítendő.
- `group-leaderboard.service.test.ts` — `pointsByCategory` minden 10 kulcs jelen, invariáns teljesül; mock-séma kibővítendő a `category` mezővel.
- `leaderboard.service.test.ts` (globális) — distinct user+typeId teszt: 3 csoportos top_scorer csak egyszer.

### Frontend

- `LeaderboardCategoryBreakdown.spec.ts` — render, fix sorrend, halványítás
- `GroupDetailView.test.ts` — `special-tab` tesztek **törölve**; kibontás-interakció új teszt
- `LeaderboardView.test.ts` — új "Speciális" oszlop és kibontás teszt
- `bracketDerive.test.ts` — frontend bracket-scoring tesztek frissítése (új return type)

### E2E

- Playwright: a két leaderboard mindegyikén megjelenik a kategória-bontás, amikor a usernek van bracket+csoportkör+top_scorer tippje

## Migráció és deployment

### Sorrend

1. Schema módosítás → `npm run db:generate`
2. Backfill SQL (külön migrációs fájl, idempotens)
3. Top_scorer seed (idempotens)
4. Backend deploy
5. Frontend deploy

A migráció **forward-kompatibilis**: a régi backend és frontend ignore-olja az új oszlopokat / mezőket.

### Bracket recalc szkript

A jelenlegi placeholder miatt minden bracket `points = 0` van DB-ben. Deploymentkor egy szkript:
- Minden `bracket_progression` típushoz, ahol `correct_answer != null`
- Iterál a `special_predictions` során, futtatja az új `scoreBracketProgression`-t
- Update-eli a `points` mezőt (összeg)

Ha a `correct_answer` még üres (a torna nem ért véget), a 0 érték marad — nincs mit újraszámolni.

## Breaking change kockázatok

| Sz. | Hely | Probléma | Mitigáció |
| --- | ---- | -------- | --------- |
| 1 | `special-prediction-evaluation.service.ts:51,95-105,153-165` | `scoreBracketProgression` régi `number` return-t kap, új objektum-t fog | Bracket ágban összegezzük: `Object.values(b).reduce((a,b)=>a+b, 0)` a numeric `points`-hez |
| 2 | `leaderboard.service.ts:50` | `specialPredictionPoints: 0` hardcode | Lecserélni distinct user+typeId queryre |
| 3 | `leaderboard.service.ts:18-52` | `totalPoints` query nincs JOIN-olva special_predictions-szel | LEFT JOIN + sum hozzáadása |
| 4 | DB-ben minden bracket `points=0` (placeholder örökség) | Deployment után 0p marad, ha admin nem nyom recalc-ot | Deployment-szkript: minden `correct_answer != null` bracket típusra újraszámolás |
| 5a | `bracket-progression.service.test.ts:240-246` | `=== 0` várás | Új return type-tal frissíteni |
| 5b | `frontend/src/lib/bracketDerive.test.ts:8,240-246` | Frontend duplikáció (vagy import) | Implementáció Fázis 2 első lépése: ellenőrizni, hogy duplikáció vagy import; mindkét helyen szinkron |
| 6 | `group-leaderboard.service.test.ts:51` | Mock-séma nem tartalmazza a `category` mezőt | Mock kibővítés |
| 7 | `scoring-config.service.ts:75,93` `select()` `*` | Új JSONB oszlop hallgatólag bekerül | Frontend `ScoringConfigFull` DTO (`packages/frontend/src/types/index.ts:427-434`) kibővítése |
| 8 | `recalculate.service.ts:12-82` | Nem kezeli a bracket pontokat | Story scope: kibővítés a bracket-bontás recalc-jával |
| 9 | `seed-local.ts:98-99,397` | INSERT-ek a special_prediction_types-ba | Audit: minden seed sor kapja a megfelelő category értéket |
| 10 | i18n key törlés | Dinamikus hivatkozás máshol? | Grep előtte; csak ha üres a találat, töröljük |
| 11 | E2E `?tab=special` | Verifikálva: nincs hivatkozás | — |
| 12 | `usePendingSpecialTips` composable | A `specialPredictionsMap`-en dolgozik | Store-mező marad, csak a view-blokk törlődik |

## Implementációs sorrend (TDD fázisok)

1. **Fázis 0:** Story-fájl + backlog felvétel
2. **Fázis 1:** DB schema + migráció + backfill + seed
3. **Fázis 2:** Bracket scoring (pure service, K1+K5+K5b kezelése)
4. **Fázis 3:** Backend leaderboard agregáció (K2+K3+K6 kezelése)
5. **Fázis 3.5:** Bracket recalc szkript + deployment integráció (K4)
6. **Fázis 4:** Frontend kódtisztulás (`SHOW_SPECIAL_TIPS` eltávolítás, K10+K12)
7. **Fázis 4.5:** Frontend `ScoringConfigFull` DTO bővítés (K7)
8. **Fázis 5:** `LeaderboardCategoryBreakdown` komponens + integráció két view-ban
9. **Fázis 6:** E2E + manuális verifikáció (`/run` skill)
10. **Fázis 7:** Story lezárás (backlog → history, archive)

## Függőségek és kapcsolódó story-k

- `UX-021` (Speciális tippek tab sorsa) — **megelőzve**: ez a story dönt a tab törléséről. UX-021 vagy redundánssá válik, vagy fókuszt vált.
- `UX-022` (Torna tippek kitöltöttsége admin statban) — független.

## Nyitott kérdések

- Drizzle workflow: a backfill SQL külön migrációs fájl-e (a generált migráción túl), vagy a seed-mechanizmusba illeszthető? Implementációkor verifikálandó a projekt-konvenció szerint.
- Frontend `scoreBracketProgression` duplikált logika vagy import? Fázis 2 első lépése.
