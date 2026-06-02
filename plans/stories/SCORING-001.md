---
id: SCORING-001
title: "Pontozási konfig egyszerűsítés – 6 mezőből 3 stackelhető bónuszra"
priority: Should Have
status: Open
dependencies: [UX-028]
complexity: L
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

### 2. Pontozási logika (scoring.service.ts)

3. **`calculatePoints(prediction, result, config): number` függvény**
   - Helyes kimenetel ellenőrzés: győztes vagy döntetlen egyezik-e
   - Ha helyes kimenetel: alappont `config.correctOutcomePoints` (default 1p)
   - Ha pontos eredmény (home és away gólok egyezik): `+= config.exactBonusPoints` (default +1p)
   - Ha döntetlen és hosszabbítás/tizenegyes kimenetel is egyezik (`outcomeAfterDraw` mező): `+= config.extraTimeBonusPoints` (default +1p)
   - Max pont egy meccsre (default config): 1 + 1 + 1 = 3p
   - Ha nem helyes kimenetel: 0p
   - Kedvenc csapat ×2 multiplier a csoport-szintű flag alapján (`applyFavoriteTeamMultiplier`) **után** alkalmazza a bonuszokat (max 6p = 3p × 2)

4. **Pontozási logika tesztelése**
   - Helyes bónusz számítása (1+1+1 default, max 3p)
   - Helyes resultado-utánszámítás (helytelen kimenetel → 0p)
   - Hosszabbítás/tizenegyes kimenetel bónusz csak döntetlenre (ha `outcomeAfterDraw` mező egyezik)
   - Multiplier alkalmazása után (6p max)

### 3. Auto-freeze logika (frozen read-time)

5. **`isConfigEffectivelyFrozen()` függvény**
   - Bemeneti paraméter: `configRelevantLeagues` (relevant ligák `startsAt` értékeivel)
   - Globális default config esetén: minden liga a `leagues` táblában
   - Per-csoport config esetén: csak a csoport `group_leagues`-ben felsorolt ligák (fallback: minden liga, ha üres)
   - Visszatérési érték: `true` ha bármelyik relevant liga `startsAt <= now`

6. **`scoring-explainer.service.ts` frissítés**
   - `toApiConfig()` - `defaultFrozenAt` és per-group `configFrozenAt` mező: a min(`starts_at`) értéke a relevant ligákra, **ha már lejárt** (null egyébként)
   - 3 mező csak az API-ban: `correctOutcomePoints`, `exactBonusPoints`, `extraTimeBonusPoints`

7. **Scoring config admin endpointok (423 Locked)**
   - `POST /api/admin/scoring-config` és `PUT /api/admin/scoring-config/:id`
   - Ha az érintett liga `starts_at <= now`: **423 Locked** státusz
   - Hibaüzenet: "Ez a pontozási konfig összekapcsolt liga már elindult, nem szerkeszthető"
   - Egyéb kérések (GET, szoktatas) nem limitáltak

### 4. Frontend – Admin UI (ScoringConfigAdmin komponens vagy hasonló)

8. **Admin szerkesztő form**
   - Csak 3 szerkeszthető mező: `correctOutcomePoints`, `exactBonusPoints`, `extraTimeBonusPoints`
   - Jelenlegi értékek előtöltve
   - Frozen állapot read-only jelzés: "Ez a konfig a liga indulása után szerkeszthetetlen"
   - Submit gomb: DELETE/PUT, error kezelés 423-ra → toast: "Szerkesztés nem lehetséges, a konfig frozen"

9. **Pontozási explainer modal (UX-028 illeszkedés)**
   - Modal már a stackelhető logikát mutatja
   - Type-ok igazítása: `correctOutcomePoints`, `exactBonusPoints`, `extraTimeBonusPoints`
   - Vizuális megjelenítés: "1p helyes kimenetel + 1p pontos bónusz + 1p ET/PKK bónusz = max 3p (+ ×2 kedvenc csapat)"

### 5. Tesztelés – Backend

10. **`scoring.service.test.ts` – új logika full coverage**
    - Helyes kimenetel + pontos eredmény: 2p
    - Helyes kimenetel + ET/PKK egyezés: 2p
    - Mind a hármat: helyes + pontos + ET/PKK: 3p
    - Helytelen kimenetel: 0p
    - ET/PKK bónusz CSAK döntetlenre (nem 2-1-hez)
    - ×2 multiplier után max 6p

11. **`scoring-explainer.service.test.ts` – auto-freeze + API mezők**
    - Globális config frozen: bármelyik liga elindult
    - Per-csoport config frozen: csak a csoport ligái között
    - `defaultFrozenAt` és `configFrozenAt` NULL (nem lejárt liga)
    - `defaultFrozenAt` és `configFrozenAt` = `min(starts_at)` (lejárt liga)
    - API response: 3 mező van csak

12. **`scoring-config.service.test.ts` – 423 Locked**
    - PUT request egy frozen config-hoz → 423 Locked
    - PUT request egy nem frozen config-hoz → 200 OK
    - Audit log frissítés még helyes

13. **Admin routes endpoint teszt**
    - POST/PUT scoring-config frozen ligához → 423 Locked
    - Error üzenet szöveges teszt

### 6. Tesztelés – Frontend

14. **ScoringExplainerModal.vue + store unit/component teszt**
    - Type-ok helyesen mappolódnak az API response-ből
    - 3 mező megjelenítése: correctOutcomePoints, exactBonusPoints, extraTimeBonusPoints

15. **Admin UI form komponens teszt**
    - 3 mező szerkesztő form
    - Frozen állapot: read-only megjelenítés, form disable
    - 423 error toast megjelenítés

16. **E2E – scoring explainer modal**
    - Admin login → scoring config admin nézet
    - Form kitöltés (3 mező) → submit
    - Sikeres submit: toast "Konfig mentve"
    - Frozen config szerkesztése: 423 error, toast megjelenítés

## Technikai megjegyzések

### Migráció (hard cut)

```sql
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

-- 5. Reset az összes config-ra az új 1/1/1 default-ra
UPDATE scoring_configs SET 
  exact_bonus_points = 1, 
  correct_outcome_points = 1, 
  extra_time_bonus_points = 1;
```

### Seed frissítés

- VB liga: `starts_at = '2026-06-11 18:00:00+00'`
- Összes `scoring_configs` sor: `correct_outcome_points=1, exact_bonus_points=1, extra_time_bonus_points=1`

### Érintett fájlok

**Backend:**
- `packages/backend/src/db/schema/index.ts` — `scoringConfigs` és `leagues` schema
- `packages/backend/src/db/migrations/NNNN_simplify_scoring_config.sql` — új migration
- `packages/backend/scripts/seed.ts` — seed frissítés
- `packages/backend/src/services/scoring.service.ts` — `calculatePoints` átírás
- `packages/backend/src/services/scoring-explainer.service.ts` — auto-freeze + API mezők
- `packages/backend/src/services/scoring-config.service.ts` — 423 Locked logika
- `packages/backend/src/services/scoring-freeze.service.ts` — helper (új vagy bővítés)
- `packages/backend/src/routes/scoring-config.routes.ts` — payload validáció (3 mező)
- `packages/backend/src/types/index.ts` — `ScoringConfig`, `ScoringConfigFull` types
- `packages/backend/src/services/scoring.service.test.ts`
- `packages/backend/src/services/scoring-explainer.service.test.ts`
- `packages/backend/src/services/scoring-config.service.test.ts`

**Frontend:**
- `packages/frontend/src/components/ScoringExplainerModal.vue` — type frissítés
- `packages/frontend/src/stores/scoring-explainer.store.ts` — type frissítés
- `packages/frontend/src/views/admin/ScoringConfigAdmin.vue` (vagy hasonló) — 3 mezős form + frozen state
- `packages/frontend/src/locales/hu.json`, `en.json` — labelek (ET/PKK bónusz)
- `packages/frontend/src/components/__tests__/ScoringExplainerModal.spec.ts`
- `packages/frontend/src/stores/__tests__/scoring-explainer.store.spec.ts`
- `e2e/scoring-explainer.spec.ts` — E2E happy path

### Korábbi pontok újraszámolása

Mivel még nincs éles eredmény beírva, a `predictions.points_global` és `group_prediction_points.points` sorok a természetes újraszámolódást kapják az első match result-tel az új logika szerint.

## Kizárások

- Specifikus tipp típusok (special predictions, tournament tips) — külön táblákban vannak, nem érinti ez a story
- Per-csoport override eltávolítása — a `groups.scoring_config_id` és `favorite_team_double_points` változatlan marad
- Manuális freeze override — csak auto-freeze marad
- Frozen status push notification / banner UX — külön story
- Visszamenőleges pontok újraszámolása (pl. admin force-rescore) — nincs szükség, nincs éles pont még

## Referencia

Spec: `docs/superpowers/specs/2026-06-02-scoring-config-simplification.md`
