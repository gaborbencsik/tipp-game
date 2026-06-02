# Scoring Config Simplification — Design

> **Date:** 2026-06-02
> **Status:** Draft for review

## Goal

A `scoring_configs` jelenlegi 6-mezős abszolút modelljét felváltani egy 3-mezős stackelhető bónusz modellre, amely megfelel a UX-028 modal-ban prezentált logikának. A frozen mechanizmust automatikussá tenni a liga kezdő dátuma alapján.

## Background

A UX-028 scoring explainer modal egy stackelhető szabályrendszert mutat:

- Helyes kimenetel: **1p**
- Pontos eredmény bónusz: **+1p**
- Hosszabbítás/tizenegyes kimenetel bónusz: **+1p** (csak döntetlenre tippelt + döntetlennel végződő meccsen)
- Kedvenc csapat ×2 multiplier (csoport-szinten flag)

A `scoring_configs` tábla viszont 6 abszolút mezőt tárol (`exact_score=3, correct_winner_and_diff=2, correct_winner=1, correct_draw=2, correct_outcome=1, incorrect=0`), és a `scoring.service.ts` ezt a régi modellt számolja. A modal és a backend nincs szinkronban.

A VB még nem indult (2026-06-11 az első meccs), eredmény-alapú pontok még nincsenek — biztonságosan átállhatunk hard cut migrációval.

## Architecture

### 1. DB schema változások

**`scoring_configs` tábla:**

| Régi mező | Sors | Új mező | Default |
|-|-|-|-|
| `exact_score` smallint (3) | átnev + új default | `exact_bonus_points` smallint NOT NULL | 1 |
| `correct_outcome` smallint (1) | átnev | `correct_outcome_points` smallint NOT NULL | 1 |
| — | új | `extra_time_bonus_points` smallint NOT NULL | 1 |
| `correct_winner_and_diff` smallint | DROP | — | — |
| `correct_winner` smallint | DROP | — | — |
| `correct_draw` smallint | DROP | — | — |
| `incorrect` smallint | DROP | — | — |
| `frozen_at` timestamptz | DROP | — | — |
| `id`, `name`, `is_global_default`, `created_at`, `updated_at` | változatlan | — | — |

**`leagues` tábla:**

Új mező: `starts_at TIMESTAMPTZ NULL` — a liga első meccsének kezdési ideje. Ha NULL → a liga nem indult, a config szerkeszthető. Seed-ben a VB ligához fix érték: `2026-06-11 18:00:00+00:00`.

### 2. Pontozási logika (új `calculatePoints`)

```typescript
export function calculatePoints(
  prediction: PredictionScore,
  result: ResultScore,
  config: ScoringConfig,
): number {
  const predDiff = prediction.homeGoals - prediction.awayGoals
  const resDiff = result.homeGoals - result.awayGoals
  const predWinner = Math.sign(predDiff)
  const resWinner = Math.sign(resDiff)

  // Helyes kimenetel: győztes vagy döntetlen egyezik
  if (predWinner !== resWinner) return 0

  let pts = config.correctOutcomePoints

  // Pontos eredmény bónusz
  if (
    prediction.homeGoals === result.homeGoals &&
    prediction.awayGoals === result.awayGoals
  ) {
    pts += config.exactBonusPoints
  }

  // Hosszabbítás/tizenegyes kimenetel bónusz (csak döntetlenre)
  if (
    result.homeGoals === result.awayGoals &&
    prediction.outcomeAfterDraw != null &&
    result.outcomeAfterDraw != null &&
    prediction.outcomeAfterDraw === result.outcomeAfterDraw
  ) {
    pts += config.extraTimeBonusPoints
  }

  return pts
}
```

**Példák (default 1+1+1):**
- Tipp 2-1, eredmény 2-1: `1 (kimenetel) + 1 (pontos) = 2p`
- Tipp 1-1 ET-vel "home", eredmény 1-1 ET "home": `1 + 1 + 1 = 3p`
- Tipp 1-1, eredmény 1-1 ET nélkül vagy ET nem egyezik: `1 + 1 = 2p`
- Tipp 2-1, eredmény 3-2: `1p` (helyes győztes, nem pontos)
- Tipp 2-1, eredmény 1-2: `0p`

A `applyFavoriteTeamMultiplier` (csoport-szintű ×2) változatlan.

### 3. Auto-freeze logika

A `frozen_at` oszlopot eldobjuk. A frozen státusz most read-time számolódik:

```typescript
function isConfigEffectivelyFrozen(
  configRelevantLeagues: ReadonlyArray<{ startsAt: Date | null }>,
  now: Date = new Date(),
): boolean {
  return configRelevantLeagues.some(l => l.startsAt != null && l.startsAt <= now)
}
```

**Relevant leagues meghatározása:**
- Global default config: minden `leagues` sor a táblában
- Per-group config: csak a csoport `group_leagues`-ben listázott ligák. Ha a csoport-listában nincs liga → minden liga (legacy fallback, jelenleg minden csoport mindenre tippel)

**Frozen API kontraktus:**
- A `scoring-explainer.service.ts` `defaultFrozenAt` és per-group `configFrozenAt` mezője már a számolt időt adja vissza (a `min(starts_at)`-et a relevant ligákra), ha az már elmúlt. Ha nem, `null`.
- A scoring-config admin POST/PUT endpoint elutasítja a write-ot 423 Locked státussal, ha az érintett liga `starts_at` <= now.

### 4. Admin UI

A scoring config admin oldal csak 3 mezőt szerkeszt: `correctOutcomePoints`, `exactBonusPoints`, `extraTimeBonusPoints`. A frozen állapotot read-only-ként mutatja, write-kor 423 Locked-et kap és toast-ot mutat.

### 5. Migráció (hard cut)

Egy SQL migration:

1. `ALTER TABLE leagues ADD COLUMN starts_at TIMESTAMPTZ NULL`
2. `ALTER TABLE scoring_configs DROP COLUMN correct_winner_and_diff, DROP COLUMN correct_winner, DROP COLUMN correct_draw, DROP COLUMN incorrect, DROP COLUMN frozen_at`
3. `ALTER TABLE scoring_configs RENAME COLUMN exact_score TO exact_bonus_points`
4. `ALTER TABLE scoring_configs RENAME COLUMN correct_outcome TO correct_outcome_points`
5. `ALTER TABLE scoring_configs ADD COLUMN extra_time_bonus_points SMALLINT NOT NULL DEFAULT 1`
6. `UPDATE scoring_configs SET exact_bonus_points = 1, correct_outcome_points = 1` — **minden** sor (global default + per-group override) resetelve az új 1/1/1 default-ra. **Indok:** a régi `exact_score=3` semantikailag egy abszolút pont volt; az új `exact_bonus_points=3` egy stackelhető +3p bónuszt jelentene (összesen 4p egy pontos találatra), ami félreértelmezné a custom admin szándékát. A reset után a csoport admin saját maga újraállíthatja az értékeket ha akarja.

Seed update: VB liga `starts_at = '2026-06-11 18:00:00+00'`. Global default config értékei `1/1/1`.

A `predictions.points_global` és `group_prediction_points.points` rowsai megmaradnak — eredmény még nincs, így természetesen újraszámolódnak az új logikával amikor jön az első match result.

### 6. Files affected

**Backend:**
- `packages/backend/src/db/schema/index.ts` — `scoringConfigs` és `leagues` schema
- `packages/backend/src/db/migrations/NNNN_simplify_scoring_config.sql` — új migration (drizzle-kit generate)
- `packages/backend/scripts/seed.ts` — új mezők, VB liga `starts_at`
- `packages/backend/src/services/scoring.service.ts` — `calculatePoints` átírás
- `packages/backend/src/services/scoring-explainer.service.ts` — `toApiConfig` (3 mező), auto-freeze read-time számolás
- `packages/backend/src/services/scoring-config.service.ts` — payload (3 mező), 423 Locked write block
- `packages/backend/src/services/scoring-freeze.service.ts` — auto-freeze helper (új vagy meglévő bővítése)
- `packages/backend/src/routes/scoring-config.routes.ts` — payload schema 3 mezőre
- `packages/backend/src/routes/admin.routes.ts` — ha érinti a freeze endpointot, eltávolítjuk
- `packages/backend/src/types/index.ts` — `ScoringConfig`, `ScoringConfigFull` types

**Frontend:**
- `packages/frontend/src/components/ScoringExplainerModal.vue` — már stackelhető layoutot mutat, type-ok igazítása ha kell
- `packages/frontend/src/stores/scoring-explainer.store.ts` — type igazítás
- `packages/frontend/src/views/admin/ScoringConfigAdmin.vue` (vagy hasonló) — 3 mezős form
- `packages/frontend/src/locales/hu.json`, `en.json` — admin labelek (modal explainer kulcsok valószínűleg OK)

**Tesztek:**
- `packages/backend/src/services/scoring.service.test.ts` — új logika full coverage
- `packages/backend/src/services/scoring-explainer.service.test.ts` — auto-freeze + 3 mező
- `packages/backend/src/services/scoring-config.service.test.ts` — 423 Locked írásnál
- `packages/frontend/src/components/__tests__/ScoringExplainerModal.spec.ts` — type igazítás
- `packages/frontend/src/stores/__tests__/scoring-explainer.store.spec.ts` — type igazítás
- E2E `e2e/scoring-explainer.spec.ts` — happy path, valószínűleg OK marad
- Új unit teszt az auto-freeze logikára

## Out of scope

- Visszamenőleges pontok újraszámolása (nincs még pontosan, így nem releváns)
- Manuális freeze override (csak auto-freeze marad)
- Specifikus tipp típusok (special predictions, tournament tips) — ezek külön táblákban vannak, nem érinti
- Per-csoport override eltávolítása (a `groups.scoring_config_id` és `favorite_team_double_points` változatlan)
- Frozen status push notification / banner UX

## Open questions

Egy nyitott kérdés: a global default config a VB liga első meccse után effektíven frozen — de az NB I (`FOOTBALL_API_NBI_LEAGUE_ID=271`) liga konfigja mikor freeze-eljen? Mivel az is fut, ott is kell `starts_at`. **Javaslat:** mindenedik liga `starts_at` mezője külön. A global default config bármelyik liga indulására érzékeny → ha bármelyik liga elindult, a global default frozen. Per-csoport configok csak a csoport ligáira érzékenyek.

## Acceptance criteria

- [ ] DB migráció lefut, `scoring_configs` 3 új mezővel rendelkezik (`correct_outcome_points`, `exact_bonus_points`, `extra_time_bonus_points`), 4 régi drop-olva, `frozen_at` drop-olva
- [ ] `leagues.starts_at TIMESTAMPTZ NULL` mező létezik, VB liga seed-ben `2026-06-11 18:00:00+00`
- [ ] `calculatePoints` az új stackelhető logikát számolja, max 3p (1+1+1) bázisra
- [ ] Az `applyFavoriteTeamMultiplier` ×2 multipliert a stackelhető pont után alkalmazza, max 6p egy meccsre
- [ ] `scoring-explainer.service.ts` `defaultFrozenAt` / `configFrozenAt` mezőt read-time számolja (`min(relevant_leagues.starts_at)` ha <= now)
- [ ] Scoring config admin POST/PUT 423 Locked választ ad, ha érintett liga elindult
- [ ] Admin UI csak 3 mezőt szerkeszt
- [ ] Backend unit tesztek lefutnak: scoring.service (új logika full coverage), scoring-explainer.service (frozen + mezők), scoring-config.service (423 Locked)
- [ ] Frontend tesztek és E2E zöldek
- [ ] Modal megjelenése változatlan (a UX-028 explainer már a stackelhető modellt mutatja)
