# Pontozási konfig egyszerűsítés — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A `scoring_configs` tábla 6 abszolút mezőjét (`exact_score`, `correct_winner_and_diff`, `correct_winner`, `correct_draw`, `correct_outcome`, `incorrect`) lecseréljük 3-mezős stackelhető bónusz modellre (`correct_outcome_points`, `exact_bonus_points`, `extra_time_bonus_points`), eldobjuk a `frozen_at` oszlopot, bevezetünk egy `leagues.starts_at` mezőt az automatikus, read-time számolt frozen állapothoz, és átállunk 409 → 423 Locked státuszra a frozen write-blokknál. A VB még nem indult, így hard cut migráció biztonságos.

**Architecture:**
- Backend: Drizzle schema változások (scoring_configs + leagues), tranzakcionált SQL migráció, a `calculatePoints` és `virtual-points.service` átírása 3 mezős logikára, a `scoring-explainer.service` `isConfigEffectivelyFrozen()` helperrel read-time frozen számolás, `freezeApplicableConfigs` és teljes `scoring-freeze.service` törlése, `assertNotFrozen` 409 → 423.
- Frontend: `AdminScoringView.vue` 6 → 3 mezős form + frozen disabled state, `admin-scoring.store.ts` `isFrozen` átállítás az új API mezőre + 423 toast, `ScoringExplainerModal.vue` és `scoring-explainer.store.ts` típus-frissítés, locale kulcsok.
- Tesztek: Vitest unit-ok (scoring, virtual-points, scoring-explainer, scoring-config, admin/groups routes, admin-scoring store, AdminScoringView), Playwright E2E (admin happy path frozen + non-frozen).

**Tech Stack:** Koa.js + @koa/router + Drizzle + PostgreSQL 18.3 (backend), Vue 3 + Pinia + vue-i18n + Tailwind v4 (frontend), Vitest, Playwright.

**Spec:** `docs/superpowers/specs/2026-06-02-scoring-config-simplification.md`
**Story:** `plans/stories/SCORING-001.md` (22 AC)

---

## File Structure

**Új backend fájlok:**
- `packages/backend/src/db/migrations/0061_simplify_scoring_config.sql` — tranzakcionált hard cut migráció

**Módosított backend fájlok:**
- `packages/backend/src/db/schema/index.ts` — `scoringConfigs` 3 mezős, `leagues.startsAt` új mező
- `packages/backend/scripts/seed.ts` — VB liga `startsAt` + scoring_configs reset 1/1/1
- `packages/backend/src/types/index.ts` — `ScoringConfig`, `ScoringConfigFull`, `ScoringConfigInput`
- `packages/backend/src/services/scoring.service.ts` — `calculatePoints` átírás
- `packages/backend/src/services/virtual-points.service.ts` — `resolveScoringConfig` 3 mezős
- `packages/backend/src/services/scoring-explainer.service.ts` — `toApiConfig` 3 mező + `isConfigEffectivelyFrozen` integráció
- `packages/backend/src/services/scoring-config.service.ts` — `assertNotFrozen` 409 → 423, payload 3 mező
- `packages/backend/src/services/predictions.service.ts` — `freezeApplicableConfigs` hívás eltávolítása
- `packages/backend/src/routes/admin.routes.ts` — audit log 3 mező
- `packages/backend/src/routes/groups.routes.ts` — audit log 3 mező
- `packages/backend/src/services/scoring.service.test.ts` — új logika full coverage
- `packages/backend/src/services/scoring-explainer.service.test.ts` — auto-freeze + 3 mező
- `packages/backend/src/services/scoring-config.service.test.ts` — 423 Locked
- `packages/backend/src/services/predictions.service.test.ts` — `freezeApplicableConfigs` mock-ok eltávolítása

**Törölt backend fájlok:**
- `packages/backend/src/services/scoring-freeze.service.ts`
- `packages/backend/src/services/scoring-freeze.service.test.ts` (ha létezik)

**Módosított frontend fájlok:**
- `packages/frontend/src/views/AdminScoringView.vue` — 6 → 3 mező + frozen disabled
- `packages/frontend/src/stores/admin-scoring.store.ts` — `isFrozen` API mező alapján + 423 handling
- `packages/frontend/src/components/ScoringExplainerModal.vue` — type fix (a 3 mező a configból jön)
- `packages/frontend/src/stores/scoring-explainer.store.ts` — type igazítás
- `packages/frontend/src/locales/hu.json` — `errors.scoringConfigFrozen`, ET/PKK label
- `packages/frontend/src/locales/en.json` — tükör fordítás
- `packages/frontend/src/views/__tests__/AdminScoringView.spec.ts`
- `packages/frontend/src/stores/__tests__/admin-scoring.store.spec.ts`
- `packages/frontend/src/components/__tests__/ScoringExplainerModal.spec.ts`
- `packages/frontend/src/stores/__tests__/scoring-explainer.store.spec.ts`

**Új E2E fájl:**
- `e2e/scoring-config-simplification.spec.ts` — admin happy path (frozen + non-frozen)

---

## Phase 1 — DB foundation

## Task 1: Drizzle schema módosítás

**Files:**
- Modify: `packages/backend/src/db/schema/index.ts`

- [ ] **Step 1: `leagues` táblához `startsAt` mező hozzáadása**

A `leagues` definíciójához (jelenleg ~143-149. sor):

```ts
export const leagues = pgTable('leagues', {
  id:        uuid('id').primaryKey().defaultRandom(),
  name:      varchar('name', { length: 100 }).notNull(),
  shortName: varchar('short_name', { length: 20 }).notNull(),
  startsAt:  timestamp('starts_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
})
```

- [ ] **Step 2: `scoringConfigs` schema 3 mezősre**

A `scoringConfigs` definíció helyére (jelenleg ~253-266. sor):

```ts
export const scoringConfigs = pgTable('scoring_configs', {
  id:                    uuid('id').primaryKey().defaultRandom(),
  name:                  varchar('name', { length: 100 }).notNull(),
  isGlobalDefault:       boolean('is_global_default').notNull().default(false),
  correctOutcomePoints:  smallint('correct_outcome_points').notNull().default(1),
  exactBonusPoints:      smallint('exact_bonus_points').notNull().default(1),
  extraTimeBonusPoints:  smallint('extra_time_bonus_points').notNull().default(1),
  createdAt:             timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt:             timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
})
```

A régi mezők (`exactScore`, `correctWinnerAndDiff`, `correctWinner`, `correctDraw`, `correctOutcome`, `incorrect`, `frozenAt`) törlésre kerülnek.

- [ ] **Step 3: Type-check**

Run: `cd packages/backend && npx tsc --noEmit 2>&1 | head -50`
Expected: type errors a régi mezőkre hivatkozó helyeken (scoring.service, virtual-points.service, scoring-explainer.service, scoring-config.service, scoring-freeze.service, types/index.ts, admin.routes, groups.routes) — ezek a következő task-okban javításra kerülnek.

- [ ] **Step 4: Commit**

```bash
git add packages/backend/src/db/schema/index.ts
git commit -m "feat(scoring-config): replace 6 absolute fields with 3 stackable bonus fields in schema"
```

---

## Task 2: SQL migráció

**Files:**
- Create: `packages/backend/src/db/migrations/0061_simplify_scoring_config.sql`

**Depends on:** Task 1

- [ ] **Step 1: A migráció fájl létrehozása**

Create `packages/backend/src/db/migrations/0061_simplify_scoring_config.sql`:

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

-- 5. Reset minden config sort az új 1/1/1 default-ra (lásd spec: a régi exact_score=3
--    abszolút pont semantikailag nem örökíthető a stackelhető +3p bónusz modellbe)
UPDATE scoring_configs SET
  exact_bonus_points = 1,
  correct_outcome_points = 1,
  extra_time_bonus_points = 1;

COMMIT;
```

- [ ] **Step 2: Migráció lefuttatása lokálisan a Docker DB-n**

Run: `cd packages/backend && npx drizzle-kit push 2>&1 | tail -20`
(Vagy a projekt szokásos migration runner parancsával — a `drizzle-kit push` szinkronizálja a sémát; ha a projekt `drizzle-kit migrate`-et használ, ott az `0061_*` fájl külön snapshot-tal kerül beolvasásra.)
Expected: a migráció hibamentesen lefut, az új sémában 3 mező + `leagues.starts_at` + `extra_time_bonus_points` szerepel.

- [ ] **Step 3: DB state ellenőrzés**

Run:
```bash
docker compose exec -T postgres psql -U postgres -d tipp_game -c "\d scoring_configs"
docker compose exec -T postgres psql -U postgres -d tipp_game -c "\d leagues"
```
Expected: `scoring_configs`-ban csak `id, name, is_global_default, correct_outcome_points, exact_bonus_points, extra_time_bonus_points, created_at, updated_at` mezők. `leagues`-ben látszik a `starts_at TIMESTAMPTZ`.

- [ ] **Step 4: Commit**

```bash
git add packages/backend/src/db/migrations/0061_simplify_scoring_config.sql
git commit -m "feat(scoring-config): hard-cut migration to 3-field scoring config and leagues.starts_at"
```

---

## Task 3: Backend types

**Files:**
- Modify: `packages/backend/src/types/index.ts`

**Depends on:** Task 1

- [ ] **Step 1: A `ScoringConfig`, `ScoringConfigFull`, `ScoringConfigInput` típusok átírása**

Replace a `ScoringConfig`, `ScoringConfigFull`, `ScoringConfigInput` blokkokat (jelenleg 31-50 és 78-85. sor):

```ts
export interface ScoringConfig {
  readonly correctOutcomePoints: number
  readonly exactBonusPoints: number
  readonly extraTimeBonusPoints: number
}

export interface ScoringConfigFull {
  readonly id: string
  readonly name: string
  readonly correctOutcomePoints: number
  readonly exactBonusPoints: number
  readonly extraTimeBonusPoints: number
  readonly frozenAt: string | null
}

export interface ScoringConfigWithImpact extends ScoringConfigFull {
  readonly affectedMatches: number
  readonly affectedPredictions: number
}

export interface ScoringConfigInput {
  readonly correctOutcomePoints: number
  readonly exactBonusPoints: number
  readonly extraTimeBonusPoints: number
}
```

> A `ScoringConfigFull.frozenAt` mező megmarad mint API-szintű attribútum (read-time számolt érték a `scoring-explainer.service.ts`-ből), de DB szinten már nincs hozzá oszlop.

- [ ] **Step 2: Type-check**

Run: `cd packages/backend && npx tsc --noEmit 2>&1 | head -30`
Expected: a régi mezőkre hivatkozó hibák a service-ekben (Task 4–9-ben javítjuk).

- [ ] **Step 3: Commit**

```bash
git add packages/backend/src/types/index.ts
git commit -m "feat(scoring-config): update TypeScript types to 3-field stackable model"
```

---

## Task 4: Seed update

**Files:**
- Modify: `packages/backend/scripts/seed.ts`

**Depends on:** Task 1, 2

- [ ] **Step 1: Scoring config seed értékek frissítése**

A `scoringConfigs` insert blokkját (5–17. sor körül):

```ts
await db.insert(scoringConfigs).values({
  name: 'Global Default',
  isGlobalDefault: true,
  correctOutcomePoints: 1,
  exactBonusPoints: 1,
  extraTimeBonusPoints: 1,
}).onConflictDoNothing()
```

- [ ] **Step 2: VB liga `startsAt` seed értéke**

A leagues seed blokkban (keresd meg a "VB" / "FIFA 2026" liga insert sorát) — vagy egy update lépéssel a seed végén:

```ts
// VB liga starts_at backfill (idempotens)
await db.update(leagues)
  .set({ startsAt: new Date('2026-06-11T18:00:00Z') })
  .where(eq(leagues.shortName, 'VB2026'))
```

> A `shortName` érték a tényleges seed alapján igazítandó — a meglévő VB liga shortName-jét grep-pel ellenőrzd:
> ```bash
> grep -n "VB\|FIFA\|World" packages/backend/scripts/seed.ts | head -5
> ```

- [ ] **Step 3: Seed lefuttatása lokálisan**

Run: `cd packages/backend && npm run seed 2>&1 | tail -10`
Expected: hibamentesen lefut, a `scoring_configs.correct_outcome_points = 1`, `exact_bonus_points = 1`, `extra_time_bonus_points = 1`, és a VB liga `starts_at = 2026-06-11 18:00:00+00`.

Verify SQL:
```bash
docker compose exec -T postgres psql -U postgres -d tipp_game \
  -c "SELECT name, correct_outcome_points, exact_bonus_points, extra_time_bonus_points FROM scoring_configs;"
docker compose exec -T postgres psql -U postgres -d tipp_game \
  -c "SELECT name, short_name, starts_at FROM leagues;"
```

- [ ] **Step 4: Commit**

```bash
git add packages/backend/scripts/seed.ts
git commit -m "feat(scoring-config): seed default 1/1/1 scoring and VB league starts_at"
```

---

## Phase 2 — Pontozási logika

## Task 5: scoring.service.ts átírás (TDD)

**Files:**
- Modify: `packages/backend/src/services/scoring.service.test.ts` (a tesztfájl tényleges path-jának megerősítése: `cd packages/backend && find src tests -name "scoring.service.test.ts"`)
- Modify: `packages/backend/src/services/scoring.service.ts`

**Depends on:** Task 3

- [ ] **Step 1: Failing tesztek írása az új logikára**

A `scoring.service.test.ts`-ben cseréld le a régi 6 mezős teszteket az alábbiakra:

```ts
import { describe, it, expect } from 'vitest'
import { calculatePoints, applyFavoriteTeamMultiplier } from './scoring.service.js'
import type { ScoringConfig } from '../types/index.js'

const cfg: ScoringConfig = {
  correctOutcomePoints: 1,
  exactBonusPoints: 1,
  extraTimeBonusPoints: 1,
}

describe('calculatePoints (3-field stackable)', () => {
  it('helyes kimenetel + pontos eredmény → 2p (1 + 1)', () => {
    expect(calculatePoints({ homeGoals: 2, awayGoals: 1 }, { homeGoals: 2, awayGoals: 1 }, cfg)).toBe(2)
  })

  it('helyes kimenetel + nem pontos → 1p', () => {
    expect(calculatePoints({ homeGoals: 2, awayGoals: 1 }, { homeGoals: 3, awayGoals: 2 }, cfg)).toBe(1)
  })

  it('döntetlen tipp döntetlen kimenetelre + ET/PKK egyezés → 3p (1 + 1 + 1)', () => {
    expect(calculatePoints(
      { homeGoals: 1, awayGoals: 1, outcomeAfterDraw: 'penalties_home' },
      { homeGoals: 1, awayGoals: 1, outcomeAfterDraw: 'penalties_home' },
      cfg,
    )).toBe(3)
  })

  it('döntetlen tipp döntetlenre, ET nem egyezik → 2p (1 + 1, mert pontos eredmény)', () => {
    expect(calculatePoints(
      { homeGoals: 1, awayGoals: 1, outcomeAfterDraw: 'penalties_home' },
      { homeGoals: 1, awayGoals: 1, outcomeAfterDraw: 'penalties_away' },
      cfg,
    )).toBe(2)
  })

  it('döntetlen tipp 2-1 eredményre → 0p (rossz kimenetel)', () => {
    expect(calculatePoints({ homeGoals: 1, awayGoals: 1 }, { homeGoals: 2, awayGoals: 1 }, cfg)).toBe(0)
  })

  it('rossz győztes → 0p', () => {
    expect(calculatePoints({ homeGoals: 2, awayGoals: 1 }, { homeGoals: 1, awayGoals: 2 }, cfg)).toBe(0)
  })

  it('ET/PKK bónusz NEM jár nem-döntetlen eredményre', () => {
    expect(calculatePoints(
      { homeGoals: 2, awayGoals: 1, outcomeAfterDraw: 'penalties_home' },
      { homeGoals: 2, awayGoals: 1, outcomeAfterDraw: 'penalties_home' },
      cfg,
    )).toBe(2) // 1 + 1, nincs ET bónusz mert nem volt döntetlen
  })

  it('custom config: 2/3/1 → helyes + pontos = 5p', () => {
    const custom: ScoringConfig = { correctOutcomePoints: 2, exactBonusPoints: 3, extraTimeBonusPoints: 1 }
    expect(calculatePoints({ homeGoals: 2, awayGoals: 1 }, { homeGoals: 2, awayGoals: 1 }, custom)).toBe(5)
  })
})

describe('applyFavoriteTeamMultiplier', () => {
  it('×2 multiplier max 3p alapra → 6p', () => {
    const ctx = {
      userId: 'u1',
      groupFavoriteTeamDoublePoints: true,
      match: { homeTeamId: 't-home', awayTeamId: 't-away', leagueId: 'l1' },
      userFavorites: [{ userId: 'u1', leagueId: 'l1', teamId: 't-home' }],
    }
    expect(applyFavoriteTeamMultiplier(3, ctx)).toBe(6)
  })

  it('flag kikapcsolva → nincs multiplier', () => {
    const ctx = {
      userId: 'u1',
      groupFavoriteTeamDoublePoints: false,
      match: { homeTeamId: 't-home', awayTeamId: 't-away', leagueId: 'l1' },
      userFavorites: [{ userId: 'u1', leagueId: 'l1', teamId: 't-home' }],
    }
    expect(applyFavoriteTeamMultiplier(3, ctx)).toBe(3)
  })
})
```

- [ ] **Step 2: Tesztek futtatása → FAIL**

Run: `cd packages/backend && npx vitest run src/services/scoring.service.test.ts`
Expected: FAIL — a régi `calculatePoints` még a 6 mezős logikát futtatja.

- [ ] **Step 3: `calculatePoints` átírása**

Replace a teljes `calculatePoints` és a régi `outcomeBonus` segédfüggvény implementációját a `scoring.service.ts`-ben:

```ts
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

  // ET/PKK kimenetel bónusz csak döntetlen kimenetelre
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

- [ ] **Step 4: A `calculateAndSavePoints` és `calculateAndSaveGroupPoints` függvényekben a `config` mezők (most 3 mező) automatikusan stimmelnek a Drizzle inferenciából — semmi átírás nem kell, mert csak a `calculatePoints`-on keresztül használja**

- [ ] **Step 5: Tesztek → PASS**

Run: `cd packages/backend && npx vitest run src/services/scoring.service.test.ts`
Expected: PASS (10 test).

- [ ] **Step 6: Commit**

```bash
git add packages/backend/src/services/scoring.service.ts \
        packages/backend/src/services/scoring.service.test.ts
git commit -m "feat(scoring): rewrite calculatePoints to 3-field stackable bonus model"
```

---

## Task 6: virtual-points.service.ts átírás

**Files:**
- Modify: `packages/backend/src/services/virtual-points.service.ts`
- Modify: `packages/backend/src/services/virtual-points.service.test.ts` (ha létezik; ellenőrzés: `cd packages/backend && find . -name "virtual-points*.test.ts"`)

**Depends on:** Task 3, 5

- [ ] **Step 1: `resolveScoringConfig` átírása**

A `virtual-points.service.ts` 40-51. sora:

```ts
async function resolveScoringConfig(groupId: string): Promise<ScoringConfig> {
  const groupConfig = await getGroupConfig(groupId)
  const cfg = groupConfig ?? await getGlobalConfig()
  return {
    correctOutcomePoints: cfg.correctOutcomePoints,
    exactBonusPoints: cfg.exactBonusPoints,
    extraTimeBonusPoints: cfg.extraTimeBonusPoints,
  }
}
```

- [ ] **Step 2: Type-check + meglévő virtual-points test futtatása**

Run: `cd packages/backend && npx tsc --noEmit 2>&1 | grep virtual-points`
Expected: nincs hiba a virtual-points-ra.

Run: `cd packages/backend && npx vitest run src/services/virtual-points.service.test.ts 2>&1 | tail -20`
Expected: zöld vagy a régi 6 mezős fixture-ök frissítését igénylő failing tesztek.

- [ ] **Step 3: Ha vannak failing tesztek a 6 mezős fixture miatt — frissítés**

A teszt config fixture-jeit cseréld 3 mezősre:

```ts
const cfg: ScoringConfig = {
  correctOutcomePoints: 1,
  exactBonusPoints: 1,
  extraTimeBonusPoints: 1,
}
```

A teszt elvárt értékeket az új logika szerint igazítsd (max 3p alappont, max 6p ×2 multiplierrel).

- [ ] **Step 4: Tesztek → PASS**

Run: `cd packages/backend && npx vitest run src/services/virtual-points.service.test.ts`

- [ ] **Step 5: Commit**

```bash
git add packages/backend/src/services/virtual-points.service.ts \
        packages/backend/src/services/virtual-points.service.test.ts
git commit -m "refactor(virtual-points): adopt 3-field scoring config"
```

---

## Phase 3 — Auto-freeze + cleanup

## Task 7: `isConfigEffectivelyFrozen` helper + scoring-explainer integráció (TDD)

**Files:**
- Modify: `packages/backend/src/services/scoring-explainer.service.ts`
- Modify: `packages/backend/src/services/scoring-explainer.service.test.ts` (path verify: `cd packages/backend && find . -name "scoring-explainer*.test.ts"`)

**Depends on:** Task 1, 3

- [ ] **Step 1: Failing tesztek hozzáadása**

A `scoring-explainer.service.test.ts`-be (a meglévő tesztek mellé):

```ts
describe('isConfigEffectivelyFrozen integration', () => {
  it('globális default frozen, ha BÁRMELYIK liga starts_at <= now', async () => {
    const past = new Date('2026-06-01T00:00:00Z')
    const future = new Date('2026-12-01T00:00:00Z')
    const defaultConfig = {
      id: 'cfg-default', name: 'Default', isGlobalDefault: true,
      correctOutcomePoints: 1, exactBonusPoints: 1, extraTimeBonusPoints: 1,
    }
    // mock setup: loadDefaultConfig → defaultConfig; loadAllLeagues → [{startsAt: past}, {startsAt: future}]
    // loadUserGroups → []
    // ...

    const result = await getScoringExplainer('user-1')
    expect(result.defaultFrozenAt).toBe(past.toISOString())
  })

  it('globális default NEM frozen, ha minden liga starts_at > now vagy null', async () => {
    const future = new Date('2027-01-01T00:00:00Z')
    // mock: két liga, mindkettő future vagy null
    // ...
    const result = await getScoringExplainer('user-1')
    expect(result.defaultFrozenAt).toBeNull()
  })

  it('per-csoport config frozen csak a csoport ligái alapján', async () => {
    // mock: groupId=g1, group_leagues = [{leagueId: l1, startsAt: past}]
    //       másik liga (l2) future de NEM tartozik a csoporthoz → nem számít
    // ...
    const result = await getScoringExplainer('user-1')
    expect(result.groups[0]?.configFrozenAt).not.toBeNull()
  })

  it('üres group_leagues → fallback minden ligára (legacy)', async () => {
    // mock: groupId=g1, group_leagues = [] üres
    //       leagues táblában van past liga → frozen
    // ...
    const result = await getScoringExplainer('user-1')
    expect(result.groups[0]?.configFrozenAt).not.toBeNull()
  })

  it('API response 3 mezős config-ot ad vissza (correctOutcomePoints/exactBonusPoints/extraTimeBonusPoints)', async () => {
    const result = await getScoringExplainer('user-1')
    expect(result.default).toEqual(expect.objectContaining({
      correctOutcomePoints: expect.any(Number),
      exactBonusPoints: expect.any(Number),
      extraTimeBonusPoints: expect.any(Number),
    }))
    // explicitly assert removed fields are gone:
    expect(result.default).not.toHaveProperty('exactScore')
    expect(result.default).not.toHaveProperty('correctWinner')
  })
})
```

> **Megjegyzés:** A teljes mock-setup a meglévő `scoring-explainer.service.test.ts` mintáját követi (lásd a 2026-06-01-scoring-explainer plan Task 3-jában). Minden lekérdezéshez (`loadDefaultConfig`, `loadUserGroups`, `loadConfigsByIds`, `loadAllLeagues`, `loadGroupLeaguesForGroups`, `loadGroupOwnedSpecialTypes`, `loadSubscribedGlobalSpecialTypes`) `mockSelect.mockReturnValueOnce(...)` chain-t kell konfigurálni.

- [ ] **Step 2: Tesztek → FAIL**

Run: `cd packages/backend && npx vitest run src/services/scoring-explainer.service.test.ts`
Expected: FAIL — sem a `loadAllLeagues`, sem a `loadGroupLeaguesForGroups`, sem az `isConfigEffectivelyFrozen` még nem létezik.

- [ ] **Step 3: `scoring-explainer.service.ts` átírás**

Replace a `toApiConfig` és helper-blokkot:

```ts
import { eq, isNull, and, inArray } from 'drizzle-orm'
import { db } from '../db/client.js'
import {
  scoringConfigs, groups, groupMembers, leagues, groupLeagues,
  specialPredictionTypes, groupGlobalTypeSubscriptions,
} from '../db/schema/index.js'
import type {
  ScoringConfigFull,
  ScoringExplainerResponse,
  ScoringExplainerGroup,
  ScoringExplainerSpecialType,
} from '../types/index.js'

function toApiConfig(
  row: typeof scoringConfigs.$inferSelect,
  effectiveFrozenAt: Date | null,
): ScoringConfigFull {
  return {
    id: row.id,
    name: row.name,
    correctOutcomePoints: row.correctOutcomePoints,
    exactBonusPoints: row.exactBonusPoints,
    extraTimeBonusPoints: row.extraTimeBonusPoints,
    frozenAt: effectiveFrozenAt ? effectiveFrozenAt.toISOString() : null,
  }
}

function effectiveFrozenAt(
  configRelevantLeagues: ReadonlyArray<{ startsAt: Date | null }>,
  now: Date = new Date(),
): Date | null {
  const past = configRelevantLeagues
    .map(l => l.startsAt)
    .filter((d): d is Date => d != null && d <= now)
  if (past.length === 0) return null
  return past.reduce((min, d) => (d < min ? d : min))
}

export function isConfigEffectivelyFrozen(
  configRelevantLeagues: ReadonlyArray<{ startsAt: Date | null }>,
  now: Date = new Date(),
): boolean {
  return effectiveFrozenAt(configRelevantLeagues, now) !== null
}

async function loadAllLeagues(): Promise<Array<{ id: string; startsAt: Date | null }>> {
  return db.select({ id: leagues.id, startsAt: leagues.startsAt }).from(leagues)
}

async function loadGroupLeaguesForGroups(
  groupIds: ReadonlyArray<string>,
): Promise<Map<string, Array<string>>> {
  const result = new Map<string, Array<string>>()
  if (groupIds.length === 0) return result
  const rows = await db
    .select({ groupId: groupLeagues.groupId, leagueId: groupLeagues.leagueId })
    .from(groupLeagues)
    .where(inArray(groupLeagues.groupId, groupIds as string[]))
  for (const r of rows) {
    const list = result.get(r.groupId) ?? []
    list.push(r.leagueId)
    result.set(r.groupId, list)
  }
  return result
}
```

A `getScoringExplainer` body-ban használd:

```ts
const allLeagues = await loadAllLeagues()
const groupLeaguesMap = await loadGroupLeaguesForGroups(groupIds)

const defaultEffective = effectiveFrozenAt(allLeagues)

const groupsOut: Array<ScoringExplainerGroup> = userGroups.map(g => {
  const configRow = g.scoringConfigId ? configs.get(g.scoringConfigId) ?? defaultRow : defaultRow
  const explicitLeagueIds = groupLeaguesMap.get(g.id) ?? []
  const relevantLeagues = explicitLeagueIds.length === 0
    ? allLeagues
    : allLeagues.filter(l => explicitLeagueIds.includes(l.id))
  const groupEffective = effectiveFrozenAt(relevantLeagues)

  return {
    id: g.id,
    name: g.name,
    config: toApiConfig(configRow, groupEffective),
    configFrozenAt: groupEffective ? groupEffective.toISOString() : null,
    favoriteTeamDoublePoints: g.favoriteTeamDoublePoints,
    specialTypes: [
      ...(owned.get(g.id) ?? []).map(t => mapSpecialType(t, 'group-owned')),
      ...(subscribed.get(g.id) ?? []).map(t => mapSpecialType(t, 'subscribed-global')),
    ],
  }
})

return {
  default: toApiConfig(defaultRow, defaultEffective),
  defaultFrozenAt: defaultEffective ? defaultEffective.toISOString() : null,
  groups: groupsOut,
}
```

- [ ] **Step 4: Tesztek → PASS**

Run: `cd packages/backend && npx vitest run src/services/scoring-explainer.service.test.ts`
Expected: PASS minden teszt.

- [ ] **Step 5: Commit**

```bash
git add packages/backend/src/services/scoring-explainer.service.ts \
        packages/backend/src/services/scoring-explainer.service.test.ts
git commit -m "feat(scoring-explainer): read-time auto-freeze via leagues.starts_at and 3-field API config"
```

---

## Task 8: `freezeApplicableConfigs` és teljes `scoring-freeze.service` cleanup

**Files:**
- Modify: `packages/backend/src/services/predictions.service.ts`
- Delete: `packages/backend/src/services/scoring-freeze.service.ts`
- Delete: `packages/backend/src/services/scoring-freeze.service.test.ts` (ha létezik)
- Modify: `packages/backend/src/services/predictions.service.test.ts`

**Depends on:** Task 1 (a `frozen_at` oszlop drop a freeze service-t halottá teszi)

- [ ] **Step 1: A `freezeApplicableConfigs` import + hívás eltávolítása `predictions.service.ts`-ből**

A `packages/backend/src/services/predictions.service.ts`-ben:
- Töröld a 5. sort: `import { freezeApplicableConfigs } from './scoring-freeze.service.js'`
- Töröld a 82. sort: `await freezeApplicableConfigs(user.id)`

- [ ] **Step 2: A `predictions.service.test.ts`-ben a `freezeApplicableConfigs` mock-ok eltávolítása**

Keresd meg a mock-ot:
```bash
grep -n "freezeApplicableConfigs\|scoring-freeze" packages/backend/src/services/predictions.service.test.ts
```

Töröld a `vi.mock('./scoring-freeze.service.js', ...)` blokkot, az ezzel összefüggő `mockFreezeApplicableConfigs`/`vi.hoisted` deklarációkat és minden `expect(mockFreezeApplicableConfigs).toHaveBeenCalled...` assertion-t.

- [ ] **Step 3: A `scoring-freeze.service.ts` és tesztje törlése**

```bash
rm packages/backend/src/services/scoring-freeze.service.ts
test -f packages/backend/src/services/scoring-freeze.service.test.ts && rm packages/backend/src/services/scoring-freeze.service.test.ts
```

- [ ] **Step 4: Type-check + tesztek**

Run: `cd packages/backend && npx tsc --noEmit 2>&1 | grep -i "freeze\|scoring-freeze"`
Expected: nincs találat — semmi referencia.

Run: `cd packages/backend && npx vitest run src/services/predictions.service.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add packages/backend/src/services/predictions.service.ts \
        packages/backend/src/services/predictions.service.test.ts
git rm packages/backend/src/services/scoring-freeze.service.ts \
       packages/backend/src/services/scoring-freeze.service.test.ts 2>/dev/null || true
git commit -m "chore(scoring): remove legacy freezeApplicableConfigs and scoring-freeze service"
```

---

## Task 9: `assertNotFrozen` 409 → 423 + 3 mezős payload (TDD)

**Files:**
- Modify: `packages/backend/src/services/scoring-config.service.ts`
- Modify: `packages/backend/src/services/scoring-config.service.test.ts` (path verify: `cd packages/backend && find . -name "scoring-config.service*.test.ts"`)

**Depends on:** Task 3, 7

- [ ] **Step 1: A teszt failing-re hozása**

A `scoring-config.service.test.ts`-ben:
- Cseréld a 6 mezős fixture-öket 3 mezősre (`correctOutcomePoints`, `exactBonusPoints`, `extraTimeBonusPoints`).
- Új/módosított test cases:

```ts
describe('updateGlobalConfig', () => {
  it('frozen config → AppError 423 Locked', async () => {
    // mock loadGlobalConfigRow: row {... frozen_at semantically replaced via leagues.starts_at past}
    // The new assertNotFrozen kell hogy egy 423-as AppError-t dobjon
    await expect(updateGlobalConfig({
      correctOutcomePoints: 1, exactBonusPoints: 1, extraTimeBonusPoints: 1,
    })).rejects.toMatchObject({ status: 423 })
  })

  it('non-frozen config → 200 OK, payload 3 mezős', async () => {
    const result = await updateGlobalConfig({
      correctOutcomePoints: 2, exactBonusPoints: 3, extraTimeBonusPoints: 1,
    })
    expect(result).toEqual(expect.objectContaining({
      correctOutcomePoints: 2,
      exactBonusPoints: 3,
      extraTimeBonusPoints: 1,
    }))
  })
})
```

- [ ] **Step 2: Tesztek → FAIL**

Run: `cd packages/backend && npx vitest run src/services/scoring-config.service.test.ts`

- [ ] **Step 3: `scoring-config.service.ts` átírás**

A `toApiConfig` (19-31. sor) → 3 mezős, a `frozenAt` mező az új read-time számolásból (vagy átmenetileg `null`-ra; lásd alább):

```ts
async function effectiveFrozenAtForConfig(configId: string, isGlobalDefault: boolean): Promise<Date | null> {
  // Globális default → minden liga; per-csoport → annak group_leagues; üres fallback → minden liga
  const allLeagues = await db.select({ id: leagues.id, startsAt: leagues.startsAt }).from(leagues)
  if (isGlobalDefault) {
    return effectiveFrozenAtFromLeagues(allLeagues)
  }
  // per-csoport: a csoport ID kell — ezt a hívó (loadGroupConfigRow) átadhatja, vagy lookup
  const groupRows = await db.select({ id: groups.id })
    .from(groups)
    .where(eq(groups.scoringConfigId, configId))
    .limit(1)
  if (!groupRows[0]) return effectiveFrozenAtFromLeagues(allLeagues)
  const gl = await db.select({ leagueId: groupLeagues.leagueId })
    .from(groupLeagues)
    .where(eq(groupLeagues.groupId, groupRows[0].id))
  if (gl.length === 0) return effectiveFrozenAtFromLeagues(allLeagues)
  const explicitIds = new Set(gl.map(r => r.leagueId))
  return effectiveFrozenAtFromLeagues(allLeagues.filter(l => explicitIds.has(l.id)))
}

function effectiveFrozenAtFromLeagues(rows: ReadonlyArray<{ startsAt: Date | null }>): Date | null {
  const past = rows.map(r => r.startsAt).filter((d): d is Date => d != null && d <= new Date())
  if (past.length === 0) return null
  return past.reduce((min, d) => (d < min ? d : min))
}
```

A `toApiConfig` async-é válik vagy a hívó fél átadja az `effectiveFrozenAt`-et — válaszd a hívó-átadásos mintát (mint a `scoring-explainer.service.ts`-ben):

```ts
function toApiConfig(
  row: typeof scoringConfigs.$inferSelect,
  effectiveFrozenAt: Date | null,
): ScoringConfigFull {
  return {
    id: row.id,
    name: row.name,
    correctOutcomePoints: row.correctOutcomePoints,
    exactBonusPoints: row.exactBonusPoints,
    extraTimeBonusPoints: row.extraTimeBonusPoints,
    frozenAt: effectiveFrozenAt ? effectiveFrozenAt.toISOString() : null,
  }
}
```

A `assertNotFrozen` átírás:

```ts
async function assertNotFrozen(
  row: typeof scoringConfigs.$inferSelect,
  groupId: string | null,
): Promise<void> {
  const allLeagues = await db.select({ id: leagues.id, startsAt: leagues.startsAt }).from(leagues)
  let relevant = allLeagues
  if (groupId) {
    const gl = await db.select({ leagueId: groupLeagues.leagueId })
      .from(groupLeagues)
      .where(eq(groupLeagues.groupId, groupId))
    if (gl.length > 0) {
      const ids = new Set(gl.map(r => r.leagueId))
      relevant = allLeagues.filter(l => ids.has(l.id))
    }
  }
  if (effectiveFrozenAtFromLeagues(relevant) !== null) {
    throw new AppError(423, 'Scoring config is frozen')
  }
}
```

A `updateGlobalConfig`, `setGroupConfig`, `overrideGlobalConfig`, `overrideGroupConfig` body-jaiban a 6 mezős `db.update().set({...})` hívásokat cseréld 3 mezősre:

```ts
.set({
  correctOutcomePoints: input.correctOutcomePoints,
  exactBonusPoints: input.exactBonusPoints,
  extraTimeBonusPoints: input.extraTimeBonusPoints,
  updatedAt: new Date(),
})
```

A `frozenAt: null` set-eket az override függvényekből töröld (nincs ilyen oszlop).

A `assertNotFrozen` hívási pontoknál add át a `groupId`-t (`updateGlobalConfig`: `null`; `setGroupConfig`: a paraméter `groupId`).

- [ ] **Step 4: Tesztek → PASS**

Run: `cd packages/backend && npx vitest run src/services/scoring-config.service.test.ts`

- [ ] **Step 5: Commit**

```bash
git add packages/backend/src/services/scoring-config.service.ts \
        packages/backend/src/services/scoring-config.service.test.ts
git commit -m "feat(scoring-config): switch frozen check to 423 Locked and 3-field payload"
```

---

## Phase 4 — Routes + audit log

## Task 10: `scoring-config.routes.ts` payload schema (3 mező)

**Files:**
- Inspect/Modify: `packages/backend/src/routes/scoring-config.routes.ts`
- Modify (ha az endpoint POST/PUT máshol van — admin.routes.ts vagy groups.routes.ts payload validáció): lásd Task 11

**Depends on:** Task 3, 9

- [ ] **Step 1: A jelenlegi `scoring-config.routes.ts` áttekintése**

A jelenlegi fájl csak egy `GET /api/scoring-config/default` route-ot tartalmaz (lásd a 11 soros teljes tartalom). Ez automatikusan az új `getGlobalConfig()` típust adja vissza Task 9 után — semmi változtatás a route szinten itt.

> A POST/PUT scoring-config payload validációi az `admin.routes.ts`-ben (`/scoring-config/override`) és `groups.routes.ts`-ben (`/groups/:groupId/scoring-config/override`) találhatóak — Task 11 kezeli őket.

- [ ] **Step 2: Smoke test**

Run: `cd packages/backend && npx vitest run`
Expected: minden teszt zöld a Task 9 után.

- [ ] **Step 3: Nincs commit szükséges, ha a fájl nem változott; egyéb esetben:**

```bash
git add packages/backend/src/routes/scoring-config.routes.ts
git commit -m "chore(scoring-config-routes): no payload changes needed (only GET endpoint)"
```

> Ha a Task 9 után a fájl változatlan, ez a task no-op és átléphető — a következő commit a Task 11.

---

## Task 11: Audit log payload + route payload validáció (3 mező)

**Files:**
- Modify: `packages/backend/src/routes/admin.routes.ts`
- Modify: `packages/backend/src/routes/groups.routes.ts`
- Modify: `packages/backend/src/routes/admin.routes.test.ts` (ha létezik) és `groups.routes.test.ts`

**Depends on:** Task 9

- [ ] **Step 1: `admin.routes.ts` `/scoring-config/override` payload mezőlista cseréje**

A 187-189. sornál:

```ts
const fields: Array<keyof ScoringConfigInput> = [
  'correctOutcomePoints', 'exactBonusPoints', 'extraTimeBonusPoints',
]
```

Ugyanitt a 199-208 sor körüli audit log payload változtatás nem szükséges, mert már `configId`-t logol — viszont ha a meglévő `values` payload kerül az auditba, akkor az új 3 mező nevével kerül logolásra automatikusan (mivel a `values` objektum struktúrája 3 mezős input-ra változott).

- [ ] **Step 2: `groups.routes.ts` `/groups/:groupId/scoring-config/override` payload mezőlista cseréje**

A 163-165. sornál ugyanaz a változás:

```ts
const fields: Array<keyof ScoringConfigInput> = [
  'correctOutcomePoints', 'exactBonusPoints', 'extraTimeBonusPoints',
]
```

- [ ] **Step 3: A meglévő route tesztek (ha vannak) frissítése**

Keresd:
```bash
cd packages/backend && grep -rln "scoring_config_override\|scoring-config/override" src/ tests/ 2>/dev/null
```

A talált test fájlokban a payload fixture-öket cseréld 3 mezősre, és az audit log assertion-okat frissítsd.

- [ ] **Step 4: Tesztek**

Run: `cd packages/backend && npx vitest run`
Expected: minden zöld.

- [ ] **Step 5: Commit**

```bash
git add packages/backend/src/routes/admin.routes.ts \
        packages/backend/src/routes/groups.routes.ts \
        packages/backend/src/routes/admin.routes.test.ts \
        packages/backend/src/routes/groups.routes.test.ts 2>/dev/null
git commit -m "feat(admin/groups-routes): validate 3-field scoring config payload and update audit log"
```

---

## Phase 5 — Frontend admin

## Task 12: `AdminScoringView.vue` 6 → 3 mezős refactor + frozen state

**Files:**
- Modify: `packages/frontend/src/views/AdminScoringView.vue`

**Depends on:** Task 11

- [ ] **Step 1: A `fields` definíció cseréje**

A 112-119. sor:

```ts
const fields: Array<{ key: keyof ScoringConfigInput; label: string }> = [
  { key: 'correctOutcomePoints', label: 'Helyes kimenetel (alappont)' },
  { key: 'exactBonusPoints', label: 'Pontos eredmény bónusz' },
  { key: 'extraTimeBonusPoints', label: 'ET / 11-esek kimenetel bónusz' },
]
```

- [ ] **Step 2: A `DraftConfig` típus + reactive object cseréje**

A 121-137. sor:

```ts
type DraftConfig = {
  correctOutcomePoints: number
  exactBonusPoints: number
  extraTimeBonusPoints: number
}

const draft = reactive<DraftConfig>({
  correctOutcomePoints: 0,
  exactBonusPoints: 0,
  extraTimeBonusPoints: 0,
})
```

- [ ] **Step 3: A `watch` blokk cseréje (139-151)**

```ts
watch(
  () => store.config,
  (cfg) => {
    if (!cfg) return
    draft.correctOutcomePoints = cfg.correctOutcomePoints
    draft.exactBonusPoints = cfg.exactBonusPoints
    draft.extraTimeBonusPoints = cfg.extraTimeBonusPoints
  },
  { immediate: true },
)
```

- [ ] **Step 4: Frozen banner szöveg lokalizálása**

A 17. sorban a hardcoded magyar szöveg megmarad MVP-ként (vagy lokalizálható egy következő task-ban). A `disabled="store.isFrozen"` és a "Felülírás" gomb logikája változatlan — a `store.isFrozen` Task 13 után a `frozenAt`-ből származtatott computed marad.

- [ ] **Step 5: Type-check**

Run: `cd packages/frontend && npx tsc --noEmit 2>&1 | grep AdminScoringView`
Expected: nincs hiba.

- [ ] **Step 6: Commit**

```bash
git add packages/frontend/src/views/AdminScoringView.vue
git commit -m "feat(admin-scoring-view): reduce form to 3 stackable bonus fields"
```

---

## Task 13: `admin-scoring.store.ts` 423 handling + tesztek

**Files:**
- Modify: `packages/frontend/src/stores/admin-scoring.store.ts`
- Modify: `packages/frontend/src/stores/__tests__/admin-scoring.store.spec.ts`

**Depends on:** Task 11, 12

- [ ] **Step 1: Failing teszt írás a 423 → toast/conflict viselkedésre**

A `admin-scoring.store.spec.ts`-ben (a meglévő 409-es assertion-okat cseréld):

```ts
it('updateConfig 423 Locked → conflictError set, fetchConfig hívva, toast errors.scoringConfigFrozen', async () => {
  const error = new Error('errors.scoringConfigFrozen')
  ;(error as any).status = 423
  mockApi.admin.scoringConfig.update.mockRejectedValueOnce(error)
  mockApi.admin.scoringConfig.get.mockResolvedValueOnce({
    id: 'c1', name: 'Default',
    correctOutcomePoints: 1, exactBonusPoints: 1, extraTimeBonusPoints: 1,
    frozenAt: '2026-06-11T18:00:00Z',
    affectedMatches: 0, affectedPredictions: 0,
  })

  const store = useAdminScoringStore()
  await store.updateConfig({ correctOutcomePoints: 2, exactBonusPoints: 1, extraTimeBonusPoints: 1 })

  expect(store.conflictError).toBe('errors.scoringConfigFrozen')
  expect(store.saveStatus).toBe('error')
  expect(mockToastStore.addToast).toHaveBeenCalledWith(expect.stringContaining('zárolt'), 'error')
})

it('isFrozen computed true ha frozenAt nem null', () => {
  const store = useAdminScoringStore()
  store.config = {
    id: 'c1', name: 'Default',
    correctOutcomePoints: 1, exactBonusPoints: 1, extraTimeBonusPoints: 1,
    frozenAt: '2026-06-11T18:00:00Z',
    affectedMatches: 0, affectedPredictions: 0,
  } as any
  expect(store.isFrozen).toBe(true)
})
```

- [ ] **Step 2: Tesztek → FAIL**

Run: `cd packages/frontend && npx vitest run src/stores/__tests__/admin-scoring.store.spec.ts`

- [ ] **Step 3: Store átírás**

A `admin-scoring.store.ts` `updateConfig` handler-ben (54-64. sor) cseréld a `message.includes('frozen')` heuristikát explicit 423 státusz-érzékeny logikára. Mivel a meglévő API wrapper csak `Error`-t dob (a status nincs a message-ben), módosítsd a wrapper-t hogy az error message vagy a `cause` a status kódot tartalmazza. Egyszerű megoldás: a backend hibaüzenete `errors.scoringConfigFrozen` kulcs, és a frontend ezt fordítja:

```ts
async function updateConfig(input: ScoringConfigInput): Promise<void> {
  saveStatus.value = 'saving'
  error.value = null
  conflictError.value = null
  const toast = useToastStore()
  try {
    const token = await getAccessToken()
    const updated = await api.admin.scoringConfig.update(token, input)
    mergeUpdated(updated)
    saveStatus.value = 'saved'
    toast.addToast('Pontrendszer frissítve', 'success')
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Ismeretlen hiba'
    const status = (err as { status?: number }).status
    if (status === 423 || message === 'errors.scoringConfigFrozen' || message.toLowerCase().includes('frozen')) {
      conflictError.value = message
      await fetchConfig()
      toast.addToast('Pontrendszer zárolt — már nem szerkeszthető', 'error')
    } else {
      error.value = message
      toast.addToast(`Hiba: ${message}`, 'error')
    }
    saveStatus.value = 'error'
  }
}
```

> A `(err as { status?: number }).status` része feltételezi, hogy az API wrapper az `Error.cause`-be vagy az error objektumra mountolja a HTTP statust. Ha jelenleg nem teszi, akkor a wrapper-t (`packages/frontend/src/api/index.ts`) is módosítani kell — ezt egy mellékhatás-task-ként kezeld a Task 13 részeként, ha a meglévő tesztek megkövetelik.

- [ ] **Step 4: Tesztek → PASS**

Run: `cd packages/frontend && npx vitest run src/stores/__tests__/admin-scoring.store.spec.ts`

- [ ] **Step 5: Commit**

```bash
git add packages/frontend/src/stores/admin-scoring.store.ts \
        packages/frontend/src/stores/__tests__/admin-scoring.store.spec.ts \
        packages/frontend/src/api/index.ts 2>/dev/null
git commit -m "feat(admin-scoring-store): handle 423 Locked and surface scoring frozen toast"
```

---

## Task 14: Locale kulcsok (`hu.json` + `en.json`)

**Files:**
- Modify: `packages/frontend/src/locales/hu.json`
- Modify: `packages/frontend/src/locales/en.json`

**Depends on:** Task 13

- [ ] **Step 1: `errors` namespace létrehozása `hu.json`-ban**

Mivel a `hu.json`-ban jelenleg nincs `errors` top-level kulcs (a `common` után közvetlenül érdemes elhelyezni), add hozzá:

```json
"errors": {
  "scoringConfigFrozen": "A pontrendszer zárolt — a liga elindult, már nem szerkeszthető. Felülírás funkcióval lehet javítani."
}
```

Ha létezik már a `errors` blokk (verify: `grep '\"errors\":' packages/frontend/src/locales/hu.json`), akkor csak a kulcsot add hozzá belé.

- [ ] **Step 2: `scoring` / `scoringExplainer` ET/PKK label hozzáadása**

A `scoringExplainer` blokkban (jelenleg ~637-tól) ellenőrizd, hogy az `extraTimeBonus` / `correctOutcome` / `exactBonus` kulcsok megvannak-e — ha nem, add hozzá:

```json
"scoringExplainer": {
  "rules": {
    "correctOutcome": "Helyes kimenetel",
    "exactBonus": "Pontos eredmény bónusz",
    "extraTimeBonus": "ET / 11-esek kimenetel bónusz"
  }
}
```

(A szerkezetbe a `rules` objektum mintáját illeszd; a meglévő kulcsneveket ne duplikáld.)

- [ ] **Step 3: EN tükör fordítás**

`packages/frontend/src/locales/en.json`-ben:

```json
"errors": {
  "scoringConfigFrozen": "Scoring rules are locked — the league has started. Use Override to amend."
}
```

ET/PKK labelek:

```json
"scoringExplainer": {
  "rules": {
    "correctOutcome": "Correct outcome",
    "exactBonus": "Exact score bonus",
    "extraTimeBonus": "ET / penalty shootout outcome bonus"
  }
}
```

- [ ] **Step 4: Locale parity check**

```bash
cd packages/frontend && node -e "
const hu = JSON.parse(require('fs').readFileSync('./src/locales/hu.json', 'utf8'));
const en = JSON.parse(require('fs').readFileSync('./src/locales/en.json', 'utf8'));
function flat(o, p='') { return Object.keys(o).flatMap(k => typeof o[k] === 'object' && o[k] !== null ? flat(o[k], p+k+'.') : [p+k]) }
const h = flat(hu).sort(), e = flat(en).sort();
console.log('hu only:', h.filter(k => !e.includes(k)));
console.log('en only:', e.filter(k => !h.includes(k)));
"
```
Expected: üres arrays.

- [ ] **Step 5: Commit**

```bash
git add packages/frontend/src/locales/hu.json packages/frontend/src/locales/en.json
git commit -m "feat(i18n): add errors.scoringConfigFrozen and ET/PKK bonus labels"
```

---

## Phase 6 — Frontend modal

## Task 15: `ScoringExplainerModal.vue` + `scoring-explainer.store.ts` type frissítés

**Files:**
- Modify: `packages/frontend/src/components/ScoringExplainerModal.vue`
- Modify: `packages/frontend/src/stores/scoring-explainer.store.ts`
- Modify: `packages/frontend/src/types/index.ts`
- Modify: `packages/frontend/src/components/__tests__/ScoringExplainerModal.spec.ts`
- Modify: `packages/frontend/src/stores/__tests__/scoring-explainer.store.spec.ts`

**Depends on:** Task 3, 7

- [ ] **Step 1: Frontend `ScoringConfigFull` típus frissítése**

A `packages/frontend/src/types/index.ts`-ben (keresd meg: `grep -n "ScoringConfigFull\|exactScore" packages/frontend/src/types/index.ts`):

```ts
export interface ScoringConfigFull {
  readonly id: string
  readonly name: string
  readonly correctOutcomePoints: number
  readonly exactBonusPoints: number
  readonly extraTimeBonusPoints: number
  readonly frozenAt: string | null
}

export interface ScoringConfigInput {
  readonly correctOutcomePoints: number
  readonly exactBonusPoints: number
  readonly extraTimeBonusPoints: number
}

export interface ScoringConfigWithImpact extends ScoringConfigFull {
  readonly affectedMatches: number
  readonly affectedPredictions: number
}
```

- [ ] **Step 2: `ScoringExplainerModal.vue` type igazítás**

A modal jelenleg hardcoded értékeket használ (`points: 1` a 14-19. sornál). A `MATCH_RULES`-ot dinamikusan a configból kell felépíteni:

```ts
import { computed } from 'vue'
// ...
const config = computed(() => {
  const sg = singleGroup.value
  return sg ? sg.config : (data.value?.default ?? null)
})

const matchRules = computed<ReadonlyArray<MatchRule>>(() => {
  const c = config.value
  if (!c) return []
  return [
    { key: 'correctOutcome', kind: 'base', points: c.correctOutcomePoints },
    { key: 'exactBonus', kind: 'bonus', points: c.exactBonusPoints },
    { key: 'extraTimeBonus', kind: 'bonus', points: c.extraTimeBonusPoints },
    { key: 'favoriteTeamMultiplier', kind: 'multiplier', multiplier: 2 },
  ]
})
```

A template-ben a `MATCH_RULES` referenciákat cseréld `matchRules`-ra.

- [ ] **Step 3: `scoring-explainer.store.ts` változatlan**

A store csak `ScoringExplainerResponse`-t fogad — a típus frissítés a `types/index.ts`-ben automatikusan propagálódik.

- [ ] **Step 4: Tesztek frissítése**

A `ScoringExplainerModal.spec.ts` minden `exactScore`/`correctWinner`-rel rendelkező fixture-t cserélj:

```ts
const baseConfig = {
  id: 'cfg', name: 'Default',
  correctOutcomePoints: 1, exactBonusPoints: 1, extraTimeBonusPoints: 1,
  frozenAt: null,
}
```

A `scoring-explainer.store.spec.ts`-ben ugyanígy a mock response-okat.

- [ ] **Step 5: Tesztek → PASS**

Run: `cd packages/frontend && npx vitest run src/components/__tests__/ScoringExplainerModal.spec.ts src/stores/__tests__/scoring-explainer.store.spec.ts`

- [ ] **Step 6: Commit**

```bash
git add packages/frontend/src/components/ScoringExplainerModal.vue \
        packages/frontend/src/stores/scoring-explainer.store.ts \
        packages/frontend/src/types/index.ts \
        packages/frontend/src/components/__tests__/ScoringExplainerModal.spec.ts \
        packages/frontend/src/stores/__tests__/scoring-explainer.store.spec.ts
git commit -m "feat(scoring-explainer-modal): bind 3-field config and update fixtures"
```

---

## Phase 7 — E2E

## Task 16: E2E admin happy path (frozen + non-frozen)

**Files:**
- Create: `e2e/scoring-config-simplification.spec.ts`

**Depends on:** Task 12, 13, 14, 15

- [ ] **Step 1: E2E teszt írása**

Create `e2e/scoring-config-simplification.spec.ts`:

```ts
import { test, expect } from '@playwright/test'
import { injectAdminSession } from './helpers/auth.js'
import { ensureAdminUser, setLeagueStartsAt } from './helpers/api.js'

test.describe('Scoring config simplification', () => {
  test.beforeAll(async () => {
    await ensureAdminUser()
  })

  test('admin szerkeszti a 3 mezős scoring configot non-frozen állapotban', async ({ page }) => {
    await setLeagueStartsAt('VB2026', '2030-12-31T00:00:00Z') // future → non-frozen
    await injectAdminSession(page)
    await page.goto('/admin/scoring')

    await expect(page.getByTestId('scoring-form')).toBeVisible()
    await expect(page.getByTestId('frozen-banner')).not.toBeVisible()

    await page.getByTestId('field-correctOutcomePoints').fill('2')
    await page.getByTestId('field-exactBonusPoints').fill('3')
    await page.getByTestId('field-extraTimeBonusPoints').fill('1')
    await page.getByTestId('submit-btn').click()
    await expect(page.getByTestId('save-status')).toHaveText(/Elmentve/)
  })

  test('frozen állapotban a form disabled, override gomb látszik', async ({ page }) => {
    await setLeagueStartsAt('VB2026', '2026-06-01T00:00:00Z') // past → frozen
    await injectAdminSession(page)
    await page.goto('/admin/scoring')

    await expect(page.getByTestId('frozen-banner')).toBeVisible()
    await expect(page.getByTestId('field-correctOutcomePoints')).toBeDisabled()
    await expect(page.getByTestId('override-btn')).toBeVisible()
    await expect(page.getByTestId('submit-btn')).not.toBeVisible()
  })
})
```

> **Megjegyzés:** A `setLeagueStartsAt` helpert (`e2e/helpers/api.js`) ki kell egészíteni — ha még nincs, írj egy minimal POST/SQL helpert ami a backend admin endpointján vagy directly a DB-n állítja a liga `starts_at` mezőt teszt-időre. Az `ensureAdminUser` és `injectAdminSession` a meglévő pattern alapján.

- [ ] **Step 2: E2E futtatása**

```bash
cd <repo root> && npm run e2e -- scoring-config-simplification
```

Expected: 2 teszt zöld.

- [ ] **Step 3: Záró backend + frontend full suite**

```bash
cd packages/backend && npx vitest run && npx tsc --noEmit
cd packages/frontend && npx vitest run && npx tsc --noEmit
```

Expected: minden zöld.

- [ ] **Step 4: Commit**

```bash
git add e2e/scoring-config-simplification.spec.ts e2e/helpers/api.js 2>/dev/null
git commit -m "test(e2e): add admin scoring config 3-field happy path with frozen/non-frozen states"
```

---

## Self-Review

22 elfogadási kritérium lefedettsége task-szinten:

| AC § | Téma | Task |
|-|-|-|
| §1.1 | `scoring_configs` 3 mezős | Task 1, 2 |
| §1.2 | `leagues.starts_at` + seed | Task 1, 2, 4 |
| §2.3 | `calculatePoints` átírás + `correctDraw=2 → 1p` breaking change | Task 5 |
| §2.4 | `virtual-points.service` átírás | Task 6 |
| §2.5 | Pontozási logika tesztelése (1/2/3p, 0p, ET csak döntetlenre, ×2 multi, üres group_leagues) | Task 5, 6, 7 |
| §3.6 | `isConfigEffectivelyFrozen()` helper | Task 7 |
| §3.7 | `scoring-explainer.service` `defaultFrozenAt`/`configFrozenAt` read-time | Task 7 |
| §3.8 | `freezeApplicableConfigs` cleanup + `scoring-freeze.service` törlés | Task 8 |
| §3.9 | 409 → 423 átállás | Task 9 |
| §3.10 | Audit log payload (3 mező) | Task 11 |
| §4.11 | `AdminScoringView.vue` 6 → 3 mezős + frozen state | Task 12 |
| §4.12 | `admin-scoring.store.ts` `isFrozen` computed + 423 handling | Task 13 |
| §4.13 | `ScoringExplainerModal.vue` type igazítás | Task 15 |
| §5.14 | `scoring.service.test.ts` full coverage | Task 5 |
| §5.15 | `scoring-explainer.service.test.ts` üres `group_leagues` edge case | Task 7 |
| §5.16 | `scoring-config.service.test.ts` 423 Locked | Task 9 |
| §5.17 | Admin routes endpoint teszt (3 mező + 423) | Task 11 |
| §5.18 | `virtual-points.service.test.ts` integráció | Task 6 |
| §6.19 | `ScoringExplainerModal.vue` + store unit teszt | Task 15 |
| §6.20 | `AdminScoringView.test.ts` 3 mezős form + frozen + 423 toast | Task 12, 13 |
| §6.21 | `admin-scoring.store.test.ts` 409 → 423 + isFrozen | Task 13 |
| §6.22 | E2E admin happy path frozen + non-frozen | Task 16 |

**Phase összefoglaló:**
- Phase 1 (DB): Task 1–4 (schema, migráció, types, seed)
- Phase 2 (logika): Task 5–6 (scoring + virtual-points)
- Phase 3 (frozen + cleanup): Task 7–9 (auto-freeze, freeze service törlés, 423)
- Phase 4 (routes): Task 10–11 (payload + audit log)
- Phase 5 (admin UI): Task 12–14 (view, store, locales)
- Phase 6 (modal): Task 15
- Phase 7 (E2E): Task 16

**Open kérdések (story és spec alapján):**
- A Task 4 `setLeagueStartsAt` helper-t (E2E) feltétlezésként a meglévő `e2e/helpers/api.js`-be kell írni — a story nem definiálja, de az E2E AC §6.22 megköveteli.
- A Task 9-ben az `assertNotFrozen` per-csoport scope-ja (`groupId` átadás) implicit a story-ban — a spec §3.9 csak "az érintett liga" kifejezést használja. A plan a `groupId == null` → globális, egyébként a csoport `group_leagues` (üres fallback: minden liga) interpretációt követi.
- A Task 13 frontend store 423-érzékenységéhez az `api/index.ts` wrappert lehet módosítani, ha jelenleg az `Error` nem hordozza a HTTP statust — ez a meglévő implementáció ellenőrzésén múlik.
