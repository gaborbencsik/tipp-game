# 05 – Torna-tipp pontozási terv

> Forrás-story: PLAN-001 · Implementáció: US-1311 (lightweight MVP).
> Verzió: 1.1 · Dátum: 2026-06-13 · Státusz: Elfogadott (PO megerősítve)
>
> Változások v1.0 (2026-06-12) → v1.1 (2026-06-13):
> - `team_select` / `player_select` → search-as-you-type combobox az admin UI-ban (a meglévő `TeamSelectDropdown` és `PlayerSelectCombobox` újrahasznosítva)
> - `multi_team_weighted` (Biztos kieső) → **auto-derived** a bracket helyes válaszából, nem manuális JSON
> - Az „auto-derive" csak akkor futtatható, ha a Csoport végeredmény (incl. 8 best3rd) helyes válasza rögzítve van

## 1. Hatókör

A doksi **a globális (`is_global = true`) speciális tippek** kiértékelési rendszerét írja le.
Csoport-szintű (`is_global = false`) speciális tippeket **nem érint** — azokra a meglévő `setCorrectAnswer()` flow marad érvényben (`packages/backend/src/services/special-prediction-evaluation.service.ts`).

Forrás-séma:
- `packages/backend/src/db/schema/index.ts` — `specialPredictionTypes` (365–381), `specialPredictions` (385–398), `auditLogs` (429–443).
- A `correctAnswer` a `specialPredictionTypes.correctAnswer` (text) mezőben tárolódik.
- A felhasználói tippek pontja a `specialPredictions.points` (smallint) mezőbe íródik vissza.

## 2. Típus-katalógus (élő globális típusok)

| Típus ID | Név | Input type | Pont | Forrás migráció |
|---|---|---|---|---|
| `11111111-…-000000000001` | Csoportkör – legtöbb gólt szerző csapat | `team_select` | 3 | `0044_seed_tournament_bonus_types.sql` |
| `11111111-…-000000000002` | Csoportkör – legkevesebb gólt szerző csapat | `team_select` | 3 | `0044` |
| `11111111-…-000000000003` | Csoportkör – legtöbb gólt kapó csapat | `team_select` | 3 | `0044` |
| `11111111-…-000000000004` | Csoportkör – legkevesebb gólt kapó csapat | `team_select` | 3 | `0044` |
| `33333333-…-000000000936` | Upset Special – kiesett favoritok | `multi_team_weighted` | 0 (per choice 2–18) | `0046_seed_upset_special.sql` |
| `44444444-…-000000000945` | Csoport végeredmény (12 csoport sorrendje) | `all_groups_standing` | per-szelet (lásd 4.) | `0049_seed_all_groups_standing.sql` |
| `44444444-…-000000000946` | Bracket-progresszió (32 meccs) | `bracket_progression` | per-szelet (lásd 4.) | `0054_seed_bracket_progression.sql` |

A `points` oszlop önmagában **nem elegendő** a strukturált típusokhoz (`all_groups_standing`, `bracket_progression`); ezekre per-szelet konstansok használatosak (lásd 4.).

## 3. Kiértékelési stratégia típusonként

| Típus | Helyes válasz forrása (MVP) | Auto-derivation lehetőség (későbbi) |
|---|---|---|
| `team_select` (gólkirály-csoport, gólvétő-csoport) | Admin manuális (UUID a `teams` táblából — search-as-you-type dropdown az admin UI-ban). | `match_results.scorerPlayerIds` aggregáció a csoportkörre. |
| `player_select` | Admin manuális (UUID a `players` táblából — search-as-you-type combobox az admin UI-ban). | `match_results` aggregáció a torna meccsein. |
| `multi_team_weighted` (Biztos kieső) | **Auto-derived a Bracket-progresszió helyes válaszából** — `kiesett = options.choices ∖ {32-be jutottak}`. Külön `correctAnswer` nem szükséges. | — |
| `all_groups_standing` | Admin manuális (12 csoport végeredmény + 8 best3rd JSON, `GroupStandingsPicker` widget). | `match_results` aggregáció + tiebreak FIFA Annex C. |
| `bracket_progression` | Admin manuális (winners map, 32 meccs, `BracketProgressionPicker` widget). | `match_results` knockout-meccsek alapján. |

A **lightweight MVP** (US-1311) **manuális admin-bevitelt** használ minden típusra **kivéve** a `multi_team_weighted`-et, ami a bracket helyes válaszából automatikusan származtatódik. További auto-derivation post-MVP story.

### 3.1. `multi_team_weighted` (Biztos kieső) auto-derive

A „Biztos kieső" típusnál nincs külön `correctAnswer` — a kiesett halmaz a Bracket-progresszió helyes válaszából számolódik:

```
eliminated = options.choices ∖ deriveBracket(template, correctGroupStandings, winners).last_32_participants
```

Ahol a `last_32_participants` a `last_32` kör meccseinek `slotA + slotB` uniója (csoportgyőztesek + második helyezettek + 8 best 3rd).

**Előfeltételek a kiértékeléshez:**
- A `Csoport végeredmény` típus `correctAnswer`-je rögzítve (12 csoport sorrend + **legalább 8 best3rd** csapat)
- A `Bracket-progresszió` template-jének minden last_32 slotja resolvolható (W_X1, RU_X1, 3rd_XXXXX) — különben a derive `null`-t ad és a kiértékelés 400-zal hibát ad

A frontend a „Kiértékelés (auto-derive)" gombot **letiltja** és sárga bannerrel jelzi a hiányzó előfeltételt; a backend `evaluateGlobalTypeSlice` szintén 400-at ad ha a derive nem teljes (második védvonal).

## 4. Pontozási képlet

PO által rögzítve (2026-06-12):

| Kategória | Pont | Halmaz forrás |
|---|---|---|
| Helyes csoport sorrend (per csoport) | **3** / csoport | `all_groups_standing.groups[X]` exact match (4 csapat sorrendje) |
| 32-be jutott csapat | **2** / csapat | `deriveBracket().last_32` slotA + slotB unió |
| 16-ba jutott csapat | **3** / csapat | `last_32` round winners (16 csapat) |
| 8-ba jutott csapat | **4** / csapat | `last_16` round winners (8 csapat) |
| 4-be jutott csapat | **6** / csapat | `qf` round winners (4 csapat) |
| Döntős csapat | **8** / csapat | `sf` round winners (2 csapat) |
| Világbajnok | **10** | `final` round winner |

**Csoport sorrend:** all-or-nothing. 4 csapat pontosan a megfelelő pozícióban → 3p, **bármely** eltérés → 0p. Részleges pont **nincs**.

**Kieséses körök:** csapatonként halmaz-egyezés (sorrend nem számít) → fenti pontok ahányszor a metszet csapatait találta el a user.

**Bronze meccs:** **nincs** külön pont (PO döntés).

**Best 3rd:** **nincs** önálló pontkategória (PO döntés). A best 3rd csapatok a `last_32` halmaz részeként pontozódnak, csapatonként 2p.

A pontok a `specialPredictions.points` smallint mezőbe íródnak vissza (a típus teljes recompute-jával — lásd 5.).

## 5. Időzítés és trigger

- **Indítás:** admin gombnyomás per-szelet (`/admin/tournament-evaluation` view).
- **Szelet kódok:**
  - `all_groups_standing`: `group_A`, `group_B`, …, `group_L` (12 darab) vagy `null` (mind).
  - `bracket_progression`: `last_32`, `last_16`, `qf`, `sf`, `final`, `bronze` (6 darab) vagy `null` (mind).
  - Egyéb típusok: csak `null` (a teljes típus egy szelet).
- **Recompute stratégia (idempotencia):** minden szelet-futtatás a **teljes** `specialPredictions.points` értéket újraszámolja az adott típusra (összes csoport + összes kör együtt). A szelet-paraméter csak a **gomb felelőssége** és az audit log JSON-jében jelenik meg, nem korlátozza a recompute-ot. Ez biztosítja, hogy többszöri klikk → ugyanaz a végállapot, és nem kell per-szelet részpontot tárolni.
- **Soft-delete kezelés:** `users.deletedAt IS NOT NULL` → user kihagyva.
- **Inaktív típus (`isActive = false`)**: kiértékelés tiltva (404 vagy 400 hiba).
- **Cron / SSE:** post-MVP. MVP-ben csak admin gomb.

## 6. Holtversenyek és edge case-ek

| Eset | Kezelés (MVP) |
|---|---|
| Több gólkirály (azonos gólszám) | Admin manuálisan választ — egy player UUID-ot ír be. Multi-answer support post-MVP. |
| `correctAnswer` parse hiba (érvénytelen JSON) | A `parseAllGroupsStandingAnswer` / `parseBracketProgressionAnswer` `null`-t ad → minden user 0p. Admin hibaüzenetet kap a frontenden. |
| Késleltetett `match_results` korrekció | Admin újra-kiértékel (idempotens) — pontok automatikusan korrigálódnak. |
| Időközben törölt csapat / játékos | A `correctAnswer`-be írt UUID maradhat — a pontozás egyszerű string-egyezést végez. |
| Határidő (`deadline`) utáni admin-módosítás | Megengedett (admin role). Audit log rögzíti. |
| Hiányos bracket-tipp (winners < 32 meccs) | Csak a kitöltött meccsek pontozódnak, hiányzó = 0p ott. |

## 7. Auditálhatóság

Minden `POST /api/admin/global-special-types/:typeId/evaluate` hívás új `audit_logs` rekordot ír:

```ts
{
  actorId: <admin user UUID>,
  action: 'result_set',
  entityType: 'special_prediction_type',
  entityId: <typeId>,
  newValue: { slice: 'group_A' | null, evaluatedCount: 24, totalPoints: 480 },
  ipAddress: <request IP>,
}
```

`previousValue` a régi `correctAnswer` szöveg (PATCH endpointnál) vagy `null` (POST evaluate-nél, ahol nincs érték-csere).

**Visszafordíthatóság:** admin a `correctAnswer`-t felülírhatja → újraértékel → idempotens. Külön „undo" feature post-MVP.

## 8. UI érintettsége

- **Leaderboard:** változatlan. A `specialPredictions.points` már be van számolva a teljes user pontba — torna-pontok és meccs-pontok továbbra is **összevonva** jelennek meg. Külön torna-pont oszlop post-MVP story.
- **My Tips nézet (`MyTipsView.vue`):** a torna-tippek `points` mezője már látszik. UI változás nincs.
- **Pontozási szabályzat modal (`ScoringExplainerModal.vue`):** **már mutatja a 7-soros pontrendszert** (`TOURNAMENT_RULES` konstans, 24–32. sor). Egyezik a 4. szakasszal — UI változás nincs.
- **Admin UI:** új `/admin/tournament-evaluation` view (US-1311). A meglévő `/admin/global-types` (CRUD nézet) változatlan marad.

## 9. Implementációs lépések

| # | Story | Típus | Becslés |
|---|---|---|---|
| 1 | **US-1311** Admin-vezérelt torna-tipp kiértékelés (lightweight MVP) | Backend + Frontend + E2E | M |
| 2 | (Future) Auto-derivation `match_results`-ból (gólkirály, vb-győztes) | Backend service | M |
| 3 | (Future) Leaderboard torna-pont szelet (külön oszlop / breakdown) | Frontend + Backend | M |
| 4 | (Future) Admin „undo" / per-szelet részpont-tárolás | Backend (új tábla) + Frontend | L |
| 5 | (Future) CSV export torna-pontok bontásban | Backend | S |
| 6 | (Future) Cron-vezérelt automatikus kiértékelés torna-vég után | Backend (cron) + SSE push | M |

## 10. Döntési pontok (PO által lezárva 2026-06-12)

| Kérdés | Döntés |
|---|---|
| Részleges pont csoportonként? | **Nem** — exact match all-or-nothing. |
| Auto vs. manuális kiértékelés MVP-ben? | **Manuális** (admin gombnyomás per szelet). |
| Holtverseny-kezelés (több gólkirály)? | Admin egyet választ; multi-answer post-MVP. |
| Leaderboard összevon vagy szétválaszt? | **Összevon** (jelenlegi viselkedés). Külön szelet post-MVP. |
| Bronze meccs külön pont? | **Nem**. |
| Best 3rd külön pont? | **Nem**. |
| Pontkategóriák | 3/2/3/4/6/8/10 (lásd 4.). |

## Következő lépések

- ✅ Doksi elfogadva (2026-06-12, PO).
- 🟢 US-1311 implementáció — ezzel a doksival párhuzamosan készül.
- ⏳ Post-MVP story-k (auto-derivation, leaderboard breakdown, undo) — backlog-ba később kerülnek a torna-vég után begyűjtött tapasztalatok alapján.
