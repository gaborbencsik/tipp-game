---
id: SCORING-001
title: "Pontozási konfig egyszerűsítés – 6 mezőből 3 stackelhető bónuszra"
priority: Should Have
status: Open
dependencies: [UX-028]
complexity: XL
epic: E1 – Pontozás és eredmény
---

# SCORING-001: Pontozási konfig egyszerűsítés – 6 mezőből 3 stackelhető bónuszra

## Leírás

Mint **admin felhasználó**, szeretném, hogy **a `scoring_configs` tábla 6 abszolút mezőjét (exact_score, correct_winner_and_diff, stb.) felváltsa egy 3-mezős stackelhető bónusz modell** (`correct_outcome_points=1`, `exact_bonus_points=1`, `extra_time_bonus_points=1`), hogy **a pontozási szabályrendszer szinkronban legyen az UX-028 modal-ban prezentált logikával, és egyszerűbb legyen a konfigurálás az adminok számára**.

## Jelenlegi helyzet

Az UX-028 scoring explainer modal már egy stackelhető 3-szintű pontozási modellt mutat (1p helyes kimenetel + 1p pontos bónusz + 1p hosszabbítás bónusz), de a backend `scoring_configs` tábla még a régi 6-mezős abszolút modellt használja (`exact_score=3, correct_winner_and_diff=2, correct_winner=1, correct_draw=2, correct_outcome=1, incorrect=0`). A VB még nem indult (2026-06-11 az első meccs, még nincs éles eredmény), így biztonságosan átállhatunk hard cut migrációval.

Emellett a `frozen_at` manuális mezőt felváltjuk az új `leagues.starts_at` mezővel — az automatikus freeze a liga kezdési dátuma alapján.

## Elfogadási kritériumok

### 1. Adatbázis séma módosítások

1. **`scoring_configs` tábla**
   - `exact_score` mező átnevezve `exact_bonus_points`-ra (default: 1)
   - `correct_outcome` mező átnevezve `correct_outcome_points`-ra (default: 1)
   - Új mező: `extra_time_bonus_points` (SMALLINT NOT NULL DEFAULT 1) — hosszabbítás/tizenegyes kimenetel bónusz
   - Régi mezők eldobva: `correct_winner_and_diff`, `correct_winner`, `correct_draw`, `incorrect`, `frozen_at`
   - Az `id`, `name`, `is_global_default`, `created_at`, `updated_at` mezők változatlanok

2. **`leagues` tábla**
   - Új mező: `starts_at TIMESTAMPTZ NULL` — a liga első meccsének kezdési ideje
   - Seed frissítés: VB liga `starts_at = '2026-06-11 18:00:00+00'`
   - Seed frissítés: összes `scoring_configs` sor (`correct_outcome_points=1, exact_bonus_points=1, extra_time_bonus_points=1`)

### 2. Pontozási logika (scoring.service.ts) + virtual-points.service.ts

3. **`calculatePoints(prediction, result, config): number` függvény**
   - Helyes kimenetel ellenőrzés: győztes vagy döntetlen egyezik-e
   - Ha helyes kimenetel: alappont `config.correctOutcomePoints` (default 1p)
   - Ha pontos eredmény (home és away gólok egyezik): `+= config.exactBonusPoints` (default +1p)
   - Ha döntetlen és hosszabbítás/tizenegyes kimenetel is egyezik (`outcomeAfterDraw` mező): `+= config.extraTimeBonusPoints` (default +1p)
   - Max pont egy meccsre (default config): 1 + 1 + 1 = 3p
   - Ha nem helyes kimenetel: 0p
   - Kedvenc csapat ×2 multiplier a csoport-szintű flag alapján (`applyFavoriteTeamMultiplier`) **után** alkalmazza a bonuszokat (max 6p = 3p × 2)
   - **Megjegyzés:** A régi `correctDraw=2` (döntetlen tipp döntetlen kimenetelre) szándékoltan 1p-re csökken az új modellben — szándékos breaking change a stackelhető logika érdekében

4. **`virtual-points.service.ts` átírás**
   - Jelenleg a 6 régi mezőt (`exactScore`, `correctWinnerAndDiff`, stb.) használja
   - Átírva az új 3 mezős struktúrára (`correctOutcomePoints`, `exactBonusPoints`, `extraTimeBonusPoints`)
   - `resolveScoringConfig` függvény visszatérési típusa frissítve
   - Compile-error elkerülése: minden hivatkozás új mezőkre cserélve

5. **Pontozási logika tesztelése**
   - Helyes bónusz számítása (1+1+1 default, max 3p)
   - Helyes resultado-utánszámítás (helytelen kimenetel → 0p)
   - Hosszabbítás/tizenegyes kimenetel bónusz csak döntetlenre (ha `outcomeAfterDraw` mező egyezik)
   - Multiplier alkalmazása után (6p max)
   - **Üres `group_leagues` edge case test:** csoport ahol nincs explicit liga → globális default frozen-iness alkalmazódik

### 3. Auto-freeze logika (frozen read-time) + legacy `frozen_at` cleanup

6. **`isConfigEffectivelyFrozen()` függvény**
   - Bemeneti paraméter: `configRelevantLeagues` (relevant ligák `startsAt` értékeivel)
   - Globális default config esetén: minden liga a `leagues` táblában
   - Per-csoport config esetén: csak a csoport `group_leagues`-ben felsorolt ligák (fallback: minden liga, ha üres)
   - Visszatérési érték: `true` ha bármelyik relevant liga `startsAt <= now`

7. **`scoring-explainer.service.ts` frissítés**
   - `toApiConfig()` - `defaultFrozenAt` és per-group `configFrozenAt` mező: a min(`starts_at`) értéke a relevant ligákra, **ha már lejárt** (null egyébként)
   - 3 mező csak az API-ban: `correctOutcomePoints`, `exactBonusPoints`, `extraTimeBonusPoints`

8. **Legacy `freezeApplicableConfigs` és `scoring-freeze.service.ts` eltávolítás**
   - A `frozen_at` oszlop drop-jával a `scoring-freeze.service.ts:freezeApplicableConfigs()` halott kód, runtime exception-t dobna
   - Hívási hely eltávolítva: `predictions.service.ts:82` (vagy ahol hívja)
   - `scoring-freeze.service.ts` fájl törlése (ha más helyről nem hívódik) **vagy** újradefiniálni mint no-op
   - Tesztek: `predictions.service.test.ts` (mock-ok eltávolítva), `scoring-freeze.service.test.ts` (törlés)

9. **Scoring config admin endpointok (423 Locked, 409 → 423 átállás)**
   - `POST /api/admin/scoring-config` és `PUT /api/admin/scoring-config/:id`
   - Ha az érintett liga `starts_at <= now`: **423 Locked** státusz (jelenleg `assertNotFrozen` 409 Conflict-ot ad → átállítva 423-ra)
   - Hibaüzenet kulcs: `errors.scoringConfigFrozen` (`hu.json` és `en.json`-ban definiálva)
   - Frontend toast handler frissítve: 409 helyett 423-ra reagál
   - Frontend tesztek frissítve: `admin-scoring.store.test.ts` és minden 409 assertion → 423

10. **Audit log payload frissítés**
    - `groups.routes.ts` (override endpoint, `event: 'scoring_config_override'`) és `admin.routes.ts` (system config endpoint) audit log payload-ja a 3 új mezőt tartalmazza
    - Régi 6 mezős payload struktúra megszűnik

### 4. Frontend – Admin UI (AdminScoringView)

11. **`AdminScoringView.vue` admin szerkesztő form** (a tényleges fájl: `packages/frontend/src/views/AdminScoringView.vue`, NEM `ScoringConfigAdmin.vue`)
    - 6 mezős táblázat (jelenleg `exactScore`, `correctWinnerAndDiff`, `correctWinner`, `correctDraw`, `correctOutcome`, `incorrect`) átírva 3 mezősre
    - Csak 3 szerkeszthető mező: `correctOutcomePoints`, `exactBonusPoints`, `extraTimeBonusPoints`
    - Jelenlegi értékek előtöltve
    - Frozen állapot read-only jelzés: "Ez a konfig a liga indulása után szerkeszthetetlen"
    - Submit gomb: PUT, error kezelés 423-ra → toast: "Szerkesztés nem lehetséges, a konfig frozen"
    - Tesztek frissítve: `AdminScoringView.test.ts` 6 mezős assertions → 3 mezős

12. **`admin-scoring.store.ts` átírás**
    - `isFrozen` computed: jelenleg `config.value?.frozenAt`-ből számol → új API mezőre (`defaultFrozenAt` / `configFrozenAt`) cserélve
    - Type-ok igazítása az új 3 mezős API response-hoz
    - Tesztek frissítve

13. **Pontozási explainer modal (UX-028 illeszkedés)**
    - Modal már a stackelhető logikát mutatja
    - Type-ok igazítása: `correctOutcomePoints`, `exactBonusPoints`, `extraTimeBonusPoints`
    - Vizuális megjelenítés: "1p helyes kimenetel + 1p pontos bónusz + 1p ET/PKK bónusz = max 3p (+ ×2 kedvenc csapat)"

### 5. Tesztelés – Backend

14. **`scoring.service.test.ts` – új logika full coverage**
    - Helyes kimenetel + pontos eredmény: 2p
    - Helyes kimenetel + ET/PKK egyezés: 2p
    - Mind a hármat: helyes + pontos + ET/PKK: 3p
    - Helytelen kimenetel: 0p
    - ET/PKK bónusz CSAK döntetlenre (nem 2-1-hez)
    - ×2 multiplier után max 6p

15. **`scoring-explainer.service.test.ts` – auto-freeze + API mezők**
    - Globális config frozen: bármelyik liga elindult
    - Per-csoport config frozen: csak a csoport ligái között
    - `defaultFrozenAt` és `configFrozenAt` NULL (nem lejárt liga)
    - `defaultFrozenAt` és `configFrozenAt` = `min(starts_at)` (lejárt liga)
    - API response: 3 mező van csak
    - **Üres `group_leagues` edge case:** csoport nincs explicit liga → globális default frozen-iness alkalmazódik

16. **`scoring-config.service.test.ts` – 423 Locked**
    - PUT request egy frozen config-hoz → 423 Locked
    - PUT request egy nem frozen config-hoz → 200 OK
    - Audit log payload tartalmazza a 3 új mezőt

17. **Admin routes endpoint teszt**
    - POST/PUT scoring-config frozen ligához → 423 Locked
    - Error üzenet kulcs: `errors.scoringConfigFrozen`
    - Audit log entry létrejön az új payload-dal

18. **`virtual-points.service.test.ts` (vagy hozzátartozó teszt)**
    - Új 3 mezős konfig integrációja
    - Compile-error elkerülése verifikálva

### 6. Tesztelés – Frontend

19. **ScoringExplainerModal.vue + store unit/component teszt**
    - Type-ok helyesen mappolódnak az API response-ből
    - 3 mező megjelenítése: correctOutcomePoints, exactBonusPoints, extraTimeBonusPoints

20. **`AdminScoringView.test.ts` form komponens teszt**
    - 3 mező szerkesztő form
    - Frozen állapot: read-only megjelenítés, form disable
    - 423 error toast megjelenítés
    - Régi 6 mezős assertions teljesen átírva

21. **`admin-scoring.store.test.ts`**
    - `isFrozen` computed az új API mező alapján működik
    - Minden 409 assertion → 423

22. **E2E – scoring explainer modal**
    - Admin login → AdminScoringView nézet
    - Form kitöltés (3 mező) → submit
    - Sikeres submit: toast "Konfig mentve"
    - Frozen config szerkesztése: 423 error, toast megjelenítés

## Technikai megjegyzések

### Migráció (hard cut)

A teljes migráció **egy tranzakcióban** fut (`BEGIN`/`COMMIT`), Postgres atomi DDL támogatással. Hiba esetén a tranzakció visszagörget, így nincs köztes állapot. Forward-only — explicit rollback SQL nincs (greenfield migration), de a tranzakciós keret elegendő safety net.

```sql
BEGIN;

-- 1. Új mező a leagues táblához
ALTER TABLE leagues ADD COLUMN starts_at TIMESTAMPTZ NULL;

-- 2. scoring_configs régi mezők eldobása
ALTER TABLE scoring_configs 
  DROP COLUMN correct_winner_and_diff,
  DROP COLUMN correct_winner,
  DROP COLUMN correct_draw,
  DROP COLUMN incorrect,
  DROP COLUMN frozen_at;

-- 3. Mezők átnevezése
ALTER TABLE scoring_configs RENAME COLUMN exact_score TO exact_bonus_points;
ALTER TABLE scoring_configs RENAME COLUMN correct_outcome TO correct_outcome_points;

-- 4. Új mező hozzáadása
ALTER TABLE scoring_configs 
  ADD COLUMN extra_time_bonus_points SMALLINT NOT NULL DEFAULT 1;

-- 5. Reset az összes config-ra az új 1/1/1 default-ra (értelmezés-megőrzés érdekében:
--    a régi `exact_score=3` semantikusan abszolút pont, az új `exact_bonus_points` 
--    stackelhető bónusz — a custom értékeket NEM örökítjük át)
UPDATE scoring_configs SET 
  exact_bonus_points = 1, 
  correct_outcome_points = 1, 
  extra_time_bonus_points = 1;

COMMIT;
```

### Seed frissítés

- VB liga: `starts_at = '2026-06-11 18:00:00+00'`
- Összes `scoring_configs` sor: `correct_outcome_points=1, exact_bonus_points=1, extra_time_bonus_points=1`

### Érintett fájlok

**Backend:**
- `packages/backend/src/db/schema/index.ts` — `scoringConfigs` és `leagues` schema
- `packages/backend/src/db/migrations/NNNN_simplify_scoring_config.sql` — új migration (tranzakcionált)
- `packages/backend/scripts/seed.ts` — seed frissítés
- `packages/backend/src/services/scoring.service.ts` — `calculatePoints` átírás
- `packages/backend/src/services/scoring-explainer.service.ts` — auto-freeze + API mezők
- `packages/backend/src/services/scoring-config.service.ts` — 423 Locked logika (409 → 423)
- `packages/backend/src/services/scoring-freeze.service.ts` — **TÖRLÉS vagy no-op refactor** (legacy `freezeApplicableConfigs`)
- `packages/backend/src/services/predictions.service.ts` — `freezeApplicableConfigs(...)` hívás eltávolítás
- `packages/backend/src/services/virtual-points.service.ts` — `resolveScoringConfig` és minden 6 mezős hivatkozás átírás
- `packages/backend/src/routes/scoring-config.routes.ts` — payload validáció (3 mező), 423 status
- `packages/backend/src/routes/admin.routes.ts` — audit log payload (3 mező)
- `packages/backend/src/routes/groups.routes.ts` — audit log payload `scoring_config_override` event-en (3 mező)
- `packages/backend/src/types/index.ts` — `ScoringConfig`, `ScoringConfigFull` types
- `packages/backend/src/services/scoring.service.test.ts`
- `packages/backend/src/services/scoring-explainer.service.test.ts`
- `packages/backend/src/services/scoring-config.service.test.ts`
- `packages/backend/src/services/predictions.service.test.ts` — `freezeApplicableConfigs` mock-ok eltávolítása
- `packages/backend/src/services/scoring-freeze.service.test.ts` — **TÖRLÉS** (a service-szel együtt)

**Frontend:**
- `packages/frontend/src/components/ScoringExplainerModal.vue` — type frissítés
- `packages/frontend/src/stores/scoring-explainer.store.ts` — type frissítés
- `packages/frontend/src/views/AdminScoringView.vue` — 6 → 3 mezős táblázat refactor + frozen state
- `packages/frontend/src/stores/admin-scoring.store.ts` — `isFrozen` computed új API mezőre
- `packages/frontend/src/locales/hu.json`, `en.json` — új kulcsok: `errors.scoringConfigFrozen`, ET/PKK bónusz labelek
- `packages/frontend/src/components/__tests__/ScoringExplainerModal.spec.ts`
- `packages/frontend/src/stores/__tests__/scoring-explainer.store.spec.ts`
- `packages/frontend/src/stores/__tests__/admin-scoring.store.spec.ts` — 409 → 423 assertions
- `packages/frontend/src/views/__tests__/AdminScoringView.spec.ts` — 6 → 3 mezős assertions
- `e2e/scoring-explainer.spec.ts` — E2E happy path

### Korábbi pontok újraszámolása

Mivel még nincs éles eredmény beírva, a `predictions.points_global` és `group_prediction_points.points` sorok a természetes újraszámolódást kapják az első match result-tel az új logika szerint.

## Kizárások

- Specifikus tipp típusok (special predictions, tournament tips) — külön táblákban vannak, nem érinti ez a story
- Per-csoport override eltávolítása — a `groups.scoring_config_id` és `favorite_team_double_points` változatlan marad
- Manuális freeze override — csak auto-freeze marad
- Frozen status push notification / banner UX — külön story
- Visszamenőleges pontok újraszámolása (pl. admin force-rescore) — nincs szükség, nincs éles pont még

## Architect review megjegyzések

Az architect review (2026-06-02) az alábbi pontokat ellenőrizte és integráltuk a story-ba:

- ✅ `freezeApplicableConfigs` cleanup — AC §3.8
- ✅ `virtual-points.service.ts` átírás — AC §2.4
- ✅ `AdminScoringView.vue` (helyes fájlnév, NEM `ScoringConfigAdmin.vue`) — AC §4.11
- ✅ `admin-scoring.store.ts` `isFrozen` computed átírás — AC §4.12
- ✅ 409 → 423 status code átállás — AC §3.9, §6.21
- ✅ Migráció tranzakcionált — Technikai megjegyzések
- ✅ Audit log payload (3 mező) — AC §3.10
- ✅ Üres `group_leagues` edge case test — AC §5.15

Az alábbi aggályokat tudatosan **kizártuk**:
- NB I production safety — az NB I jelenleg nem releváns (kizárás)
- `correctDraw=2 → 1p` szándékos breaking change — AC §2.3 megjegyzésében dokumentálva

## Referencia

Spec: `docs/superpowers/specs/2026-06-02-scoring-config-simplification.md`
