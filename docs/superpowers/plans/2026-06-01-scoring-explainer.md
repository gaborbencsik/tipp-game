# Pontozási szabályzat modal — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A bejelentkezett felhasználók 4 belépési pontról egy `ScoringExplainerModal.vue`-ban megnézhetik a saját csoportjuk(aik)ban érvényes pontozási szabályokat, példákkal és a default-tól való eltérés-jelzéssel.

**Architecture:**
- Backend: új read-only aggregátor service (`scoring-explainer.service.ts`) + új public route (`GET /api/scoring/explainer`) `authMiddleware` mögött, ami a default + minden csoport effektív configját visszaadja, csoport-saját + feliratkozott globális special tippekkel együtt.
- Frontend: Pinia store `useScoringExplainerStore` (lazy load, session-cache), `ScoringExplainerModal.vue` (1 / 2+ csoport mód, frozen lakat, fetch-error toast), `ScoringExplainerTrigger.vue` 4 belépési ponton, vue-i18n `scoringExplainer.*` namespace-ben.
- Tesztek: Vitest unit (service, route, store, modal), Playwright E2E (2 happy path).

**Tech Stack:** Koa.js + @koa/router + Drizzle + PostgreSQL (backend), Vue 3 + Pinia + vue-i18n + Tailwind v4 (frontend), Vitest, Playwright.

**Spec:** `docs/superpowers/specs/2026-06-01-scoring-explainer-design.md`

---

## File Structure

**Új backend fájlok:**
- `packages/backend/src/services/scoring-explainer.service.ts` — aggregátor (default + groups + special types)
- `packages/backend/tests/scoring-explainer.service.test.ts` — service unit teszt (mockolt DB)
- `packages/backend/src/routes/scoring.routes.ts` — `GET /api/scoring/explainer`
- `packages/backend/tests/scoring.routes.test.ts` — route integráció

**Módosított backend fájlok:**
- `packages/backend/src/app.ts` — `scoringRouter` regisztráció

**Új frontend fájlok:**
- `packages/frontend/src/stores/scoring-explainer.store.ts` — Pinia store
- `packages/frontend/src/stores/scoring-explainer.store.test.ts`
- `packages/frontend/src/components/ScoringExplainerModal.vue`
- `packages/frontend/src/components/__tests__/ScoringExplainerModal.spec.ts`
- `packages/frontend/src/components/ScoringExplainerTrigger.vue`

**Módosított frontend fájlok:**
- `packages/frontend/src/api/index.ts` — `api.scoring.explainer(token)` hozzáadása
- `packages/frontend/src/types/index.ts` — `ScoringExplainerResponse`, `ScoringExplainerGroup`, `ScoringExplainerSpecialType` típusok
- `packages/frontend/src/locales/hu.json` és `en.json` — `scoringExplainer.*` namespace
- `packages/frontend/src/App.vue` — modal mount (egy globális instance)
- `packages/frontend/src/components/AppNav.vue` — főmenü trigger (asztal + mobil)
- `packages/frontend/src/views/LeaderboardView.vue` — fejléc trigger (link variáns)
- `packages/frontend/src/views/GroupDetailView.vue` — csoport név melletti (i) ikon
- `packages/frontend/src/components/predictions/<match tip header>` — meccs tipp képernyő (i) ikon (a konkrét fájl Task 14-ben azonosítva)
- `packages/frontend/src/views/TournamentTipsView.vue` (vagy a special tipp form) — special tipp (i) ikon (Task 15-ben azonosítva)

**Új E2E fájl:**
- `e2e/scoring-explainer.spec.ts` — 2 happy path

---

## Task 1: Backend — types

**Files:**
- Modify: `packages/backend/src/types/index.ts`

- [ ] **Step 1: Új típusok hozzáadása `packages/backend/src/types/index.ts` végéhez**

```ts
export interface ScoringExplainerSpecialType {
  readonly id: string
  readonly name: string
  readonly description: string | null
  readonly points: number
  readonly source: 'group-owned' | 'subscribed-global'
}

export interface ScoringExplainerGroup {
  readonly id: string
  readonly name: string
  readonly config: ScoringConfigFull
  readonly configFrozenAt: string | null
  readonly favoriteTeamDoublePoints: boolean
  readonly specialTypes: ReadonlyArray<ScoringExplainerSpecialType>
}

export interface ScoringExplainerResponse {
  readonly default: ScoringConfigFull
  readonly defaultFrozenAt: string | null
  readonly groups: ReadonlyArray<ScoringExplainerGroup>
}
```

- [ ] **Step 2: tsc futtatása, hogy a típusok stimmeljenek**

Run: `cd packages/backend && npx tsc --noEmit`
Expected: sikeres lefordulás (vagy meglévő hibák, de a most hozzáadott típusoknál ne legyen új hiba)

- [ ] **Step 3: Commit**

```bash
git add packages/backend/src/types/index.ts
git commit -m "feat(scoring-explainer): add response types"
```

---

## Task 2: Backend — service vázlat (failing test first)

**Files:**
- Create: `packages/backend/tests/scoring-explainer.service.test.ts`
- Create: `packages/backend/src/services/scoring-explainer.service.ts`

- [ ] **Step 1: Failing teszt írása — 1 csoportos user**

Create `packages/backend/tests/scoring-explainer.service.test.ts`:

```ts
import { describe, it, expect, vi, beforeEach } from 'vitest'

const { mockSelect, mockFrom, mockWhere, mockInnerJoin, mockLimit } = vi.hoisted(() => ({
  mockSelect: vi.fn(),
  mockFrom: vi.fn(),
  mockWhere: vi.fn(),
  mockInnerJoin: vi.fn(),
  mockLimit: vi.fn(),
}))

vi.mock('../src/db/client.js', () => ({
  db: { select: mockSelect },
}))

import { getScoringExplainer } from '../src/services/scoring-explainer.service.js'

describe('scoring-explainer.service', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('1-csoport user → 1 elemű groups, helyes config', async () => {
    // Adunk egy default + 1 group + 0 special type fixture-t
    // (A részletes mock-set up Step 3-ban kerül implementációba)
    const userId = 'user-1'
    const result = await getScoringExplainer(userId)
    expect(result.default).toBeDefined()
    expect(result.groups).toHaveLength(1)
    expect(result.groups[0]?.config).toBeDefined()
  })
})
```

- [ ] **Step 2: Teszt futtatás → fail (modul hiányzik)**

Run: `cd packages/backend && npx vitest run tests/scoring-explainer.service.test.ts`
Expected: FAIL — `Cannot find module '../src/services/scoring-explainer.service.js'`

- [ ] **Step 3: Service skeleton írása**

Create `packages/backend/src/services/scoring-explainer.service.ts`:

```ts
import { eq, isNull, and, inArray } from 'drizzle-orm'
import { db } from '../db/client.js'
import {
  scoringConfigs,
  groups,
  groupMembers,
  specialPredictionTypes,
  groupGlobalTypeSubscriptions,
} from '../db/schema/index.js'
import type {
  ScoringConfigFull,
  ScoringExplainerResponse,
  ScoringExplainerGroup,
  ScoringExplainerSpecialType,
} from '../types/index.js'

function toApiConfig(row: typeof scoringConfigs.$inferSelect): ScoringConfigFull {
  return {
    id: row.id,
    name: row.name,
    exactScore: row.exactScore,
    correctWinnerAndDiff: row.correctWinnerAndDiff,
    correctWinner: row.correctWinner,
    correctDraw: row.correctDraw,
    correctOutcome: row.correctOutcome,
    incorrect: row.incorrect,
    frozenAt: row.frozenAt ? row.frozenAt.toISOString() : null,
  }
}

export async function getScoringExplainer(userId: string): Promise<ScoringExplainerResponse> {
  // TODO: implement in next task
  throw new Error('not implemented')
}
```

- [ ] **Step 4: Service váz commit**

```bash
git add packages/backend/src/services/scoring-explainer.service.ts \
        packages/backend/tests/scoring-explainer.service.test.ts
git commit -m "test(scoring-explainer): scaffold failing service test"
```

---

## Task 3: Backend — service implementáció

**Files:**
- Modify: `packages/backend/src/services/scoring-explainer.service.ts`
- Modify: `packages/backend/tests/scoring-explainer.service.test.ts`

- [ ] **Step 1: Service implementálása**

Replace `getScoringExplainer` body in `scoring-explainer.service.ts`:

```ts
async function loadDefaultConfig(): Promise<typeof scoringConfigs.$inferSelect> {
  const rows = await db
    .select()
    .from(scoringConfigs)
    .where(eq(scoringConfigs.isGlobalDefault, true))
    .limit(1)
  if (!rows[0]) throw new Error('Global scoring config not found')
  return rows[0]
}

async function loadUserGroups(userId: string): Promise<Array<{
  id: string
  name: string
  scoringConfigId: string | null
  favoriteTeamDoublePoints: boolean
}>> {
  const rows = await db
    .select({
      id: groups.id,
      name: groups.name,
      scoringConfigId: groups.scoringConfigId,
      favoriteTeamDoublePoints: groups.favoriteTeamDoublePoints,
    })
    .from(groups)
    .innerJoin(groupMembers, eq(groupMembers.groupId, groups.id))
    .where(and(eq(groupMembers.userId, userId), isNull(groups.deletedAt)))
  return rows
}

async function loadConfigsByIds(ids: ReadonlyArray<string>): Promise<Map<string, typeof scoringConfigs.$inferSelect>> {
  if (ids.length === 0) return new Map()
  const rows = await db
    .select()
    .from(scoringConfigs)
    .where(inArray(scoringConfigs.id, ids as string[]))
  return new Map(rows.map(r => [r.id, r]))
}

async function loadGroupOwnedSpecialTypes(groupIds: ReadonlyArray<string>): Promise<Map<string, Array<typeof specialPredictionTypes.$inferSelect>>> {
  const grouped = new Map<string, Array<typeof specialPredictionTypes.$inferSelect>>()
  if (groupIds.length === 0) return grouped
  const rows = await db
    .select()
    .from(specialPredictionTypes)
    .where(inArray(specialPredictionTypes.groupId, groupIds as string[]))
  for (const row of rows) {
    if (!row.groupId) continue
    const list = grouped.get(row.groupId) ?? []
    list.push(row)
    grouped.set(row.groupId, list)
  }
  return grouped
}

async function loadSubscribedGlobalSpecialTypes(groupIds: ReadonlyArray<string>): Promise<Map<string, Array<typeof specialPredictionTypes.$inferSelect>>> {
  const grouped = new Map<string, Array<typeof specialPredictionTypes.$inferSelect>>()
  if (groupIds.length === 0) return grouped
  const rows = await db
    .select({
      groupId: groupGlobalTypeSubscriptions.groupId,
      type: specialPredictionTypes,
    })
    .from(groupGlobalTypeSubscriptions)
    .innerJoin(
      specialPredictionTypes,
      eq(specialPredictionTypes.id, groupGlobalTypeSubscriptions.specialPredictionTypeId),
    )
    .where(inArray(groupGlobalTypeSubscriptions.groupId, groupIds as string[]))
  for (const row of rows) {
    const list = grouped.get(row.groupId) ?? []
    list.push(row.type)
    grouped.set(row.groupId, list)
  }
  return grouped
}

function mapSpecialType(
  row: typeof specialPredictionTypes.$inferSelect,
  source: 'group-owned' | 'subscribed-global',
): ScoringExplainerSpecialType {
  return {
    id: row.id,
    name: row.name,
    description: row.description ?? null,
    points: row.points,
    source,
  }
}

export async function getScoringExplainer(userId: string): Promise<ScoringExplainerResponse> {
  const defaultRow = await loadDefaultConfig()
  const userGroups = await loadUserGroups(userId)

  const groupIds = userGroups.map(g => g.id)
  const configIdsToLoad = userGroups
    .map(g => g.scoringConfigId)
    .filter((id): id is string => id !== null)

  const [configs, owned, subscribed] = await Promise.all([
    loadConfigsByIds(configIdsToLoad),
    loadGroupOwnedSpecialTypes(groupIds),
    loadSubscribedGlobalSpecialTypes(groupIds),
  ])

  const groupsOut: Array<ScoringExplainerGroup> = userGroups.map(g => {
    const configRow = g.scoringConfigId ? configs.get(g.scoringConfigId) ?? defaultRow : defaultRow
    const specialTypes: Array<ScoringExplainerSpecialType> = [
      ...(owned.get(g.id) ?? []).map(t => mapSpecialType(t, 'group-owned')),
      ...(subscribed.get(g.id) ?? []).map(t => mapSpecialType(t, 'subscribed-global')),
    ]
    return {
      id: g.id,
      name: g.name,
      config: toApiConfig(configRow),
      configFrozenAt: configRow.frozenAt ? configRow.frozenAt.toISOString() : null,
      favoriteTeamDoublePoints: g.favoriteTeamDoublePoints,
      specialTypes,
    }
  })

  return {
    default: toApiConfig(defaultRow),
    defaultFrozenAt: defaultRow.frozenAt ? defaultRow.frozenAt.toISOString() : null,
    groups: groupsOut,
  }
}
```

- [ ] **Step 2: Teszt kibővítése reális mock-ekkel**

Replace test body with full mock setup that exercises:

```ts
describe('scoring-explainer.service', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    // chain helpers — minden select() vissza adja az adott DB lekérdezés mockját.
    // A mockSelect-et úgy konfiguráljuk, hogy mind a 4 belső lekérdezésre
    // (default config, user groups, group configs, special types) más-más choice-ot adjon vissza.
  })

  it('1-csoport user → 1 elemű groups, helyes config + frozenAt + favoriteTeamDoublePoints', async () => {
    const defaultConfig = {
      id: 'cfg-default', name: 'Default', isGlobalDefault: true,
      exactScore: 3, correctWinnerAndDiff: 2, correctWinner: 1, correctDraw: 2,
      correctOutcome: 1, incorrect: 0, frozenAt: null,
    }
    const groupRow = { id: 'g1', name: 'Pulykák', scoringConfigId: 'cfg-g1', favoriteTeamDoublePoints: true }
    const groupConfig = { ...defaultConfig, id: 'cfg-g1', isGlobalDefault: false, exactScore: 4 }

    // Sorrend: loadDefaultConfig → loadUserGroups → loadConfigsByIds → loadGroupOwnedSpecialTypes → loadSubscribedGlobalSpecialTypes
    mockSelect
      .mockReturnValueOnce({ from: () => ({ where: () => ({ limit: () => Promise.resolve([defaultConfig]) }) }) })
      .mockReturnValueOnce({ from: () => ({ innerJoin: () => ({ where: () => Promise.resolve([groupRow]) }) }) })
      .mockReturnValueOnce({ from: () => ({ where: () => Promise.resolve([groupConfig]) }) })
      .mockReturnValueOnce({ from: () => ({ where: () => Promise.resolve([]) }) })
      .mockReturnValueOnce({ from: () => ({ innerJoin: () => ({ where: () => Promise.resolve([]) }) }) })

    const result = await getScoringExplainer('user-1')

    expect(result.default.exactScore).toBe(3)
    expect(result.groups).toHaveLength(1)
    expect(result.groups[0]).toMatchObject({
      id: 'g1', name: 'Pulykák', favoriteTeamDoublePoints: true,
    })
    expect(result.groups[0]?.config.exactScore).toBe(4)
    expect(result.groups[0]?.specialTypes).toEqual([])
  })

  it('csoport without scoringConfigId → öröklődő default config', async () => {
    const defaultConfig = {
      id: 'cfg-default', name: 'Default', isGlobalDefault: true,
      exactScore: 3, correctWinnerAndDiff: 2, correctWinner: 1, correctDraw: 2,
      correctOutcome: 1, incorrect: 0, frozenAt: null,
    }
    const groupRow = { id: 'g1', name: 'Default-örökös', scoringConfigId: null, favoriteTeamDoublePoints: false }

    mockSelect
      .mockReturnValueOnce({ from: () => ({ where: () => ({ limit: () => Promise.resolve([defaultConfig]) }) }) })
      .mockReturnValueOnce({ from: () => ({ innerJoin: () => ({ where: () => Promise.resolve([groupRow]) }) }) })
      .mockReturnValueOnce({ from: () => ({ where: () => Promise.resolve([]) }) })
      .mockReturnValueOnce({ from: () => ({ where: () => Promise.resolve([]) }) })
      .mockReturnValueOnce({ from: () => ({ innerJoin: () => ({ where: () => Promise.resolve([]) }) }) })

    const result = await getScoringExplainer('user-1')

    expect(result.groups[0]?.config.exactScore).toBe(3) // default-ból
  })

  it('special tippek: csoport-saját + feliratkozott globális, helyes source címkével', async () => {
    const defaultConfig = {
      id: 'cfg-default', name: 'Default', isGlobalDefault: true,
      exactScore: 3, correctWinnerAndDiff: 2, correctWinner: 1, correctDraw: 2,
      correctOutcome: 1, incorrect: 0, frozenAt: null,
    }
    const groupRow = { id: 'g1', name: 'Pulykák', scoringConfigId: null, favoriteTeamDoublePoints: false }
    const owned = { id: 'sp-owned', name: 'Csoport saját', description: 'd1', points: 5, groupId: 'g1' }
    const subscribed = { id: 'sp-global', name: 'Globális', description: 'd2', points: 7, groupId: null }

    mockSelect
      .mockReturnValueOnce({ from: () => ({ where: () => ({ limit: () => Promise.resolve([defaultConfig]) }) }) })
      .mockReturnValueOnce({ from: () => ({ innerJoin: () => ({ where: () => Promise.resolve([groupRow]) }) }) })
      .mockReturnValueOnce({ from: () => ({ where: () => Promise.resolve([]) }) })
      .mockReturnValueOnce({ from: () => ({ where: () => Promise.resolve([owned]) }) })
      .mockReturnValueOnce({ from: () => ({ innerJoin: () => ({ where: () => Promise.resolve([{ groupId: 'g1', type: subscribed }]) }) }) })

    const result = await getScoringExplainer('user-1')

    expect(result.groups[0]?.specialTypes).toEqual([
      { id: 'sp-owned', name: 'Csoport saját', description: 'd1', points: 5, source: 'group-owned' },
      { id: 'sp-global', name: 'Globális', description: 'd2', points: 7, source: 'subscribed-global' },
    ])
  })

  it('frozenAt érték helyesen propagálódik (default + group szinten)', async () => {
    const frozen = new Date('2026-06-01T00:00:00Z')
    const defaultConfig = {
      id: 'cfg-default', name: 'Default', isGlobalDefault: true,
      exactScore: 3, correctWinnerAndDiff: 2, correctWinner: 1, correctDraw: 2,
      correctOutcome: 1, incorrect: 0, frozenAt: frozen,
    }
    const groupRow = { id: 'g1', name: 'X', scoringConfigId: 'cfg-g1', favoriteTeamDoublePoints: false }
    const groupConfig = { ...defaultConfig, id: 'cfg-g1', isGlobalDefault: false, frozenAt: frozen }

    mockSelect
      .mockReturnValueOnce({ from: () => ({ where: () => ({ limit: () => Promise.resolve([defaultConfig]) }) }) })
      .mockReturnValueOnce({ from: () => ({ innerJoin: () => ({ where: () => Promise.resolve([groupRow]) }) }) })
      .mockReturnValueOnce({ from: () => ({ where: () => Promise.resolve([groupConfig]) }) })
      .mockReturnValueOnce({ from: () => ({ where: () => Promise.resolve([]) }) })
      .mockReturnValueOnce({ from: () => ({ innerJoin: () => ({ where: () => Promise.resolve([]) }) }) })

    const result = await getScoringExplainer('user-1')

    expect(result.defaultFrozenAt).toBe(frozen.toISOString())
    expect(result.groups[0]?.configFrozenAt).toBe(frozen.toISOString())
  })

  it('0-csoport user → üres groups array', async () => {
    const defaultConfig = {
      id: 'cfg-default', name: 'Default', isGlobalDefault: true,
      exactScore: 3, correctWinnerAndDiff: 2, correctWinner: 1, correctDraw: 2,
      correctOutcome: 1, incorrect: 0, frozenAt: null,
    }
    mockSelect
      .mockReturnValueOnce({ from: () => ({ where: () => ({ limit: () => Promise.resolve([defaultConfig]) }) }) })
      .mockReturnValueOnce({ from: () => ({ innerJoin: () => ({ where: () => Promise.resolve([]) }) }) })

    const result = await getScoringExplainer('user-1')
    expect(result.groups).toEqual([])
  })
})
```

- [ ] **Step 3: Tesztek futtatása → minden passol**

Run: `cd packages/backend && npx vitest run tests/scoring-explainer.service.test.ts`
Expected: PASS (5 test)

- [ ] **Step 4: Commit**

```bash
git add packages/backend/src/services/scoring-explainer.service.ts \
        packages/backend/tests/scoring-explainer.service.test.ts
git commit -m "feat(scoring-explainer): aggregator service for default + groups + special types"
```

---

## Task 4: Backend — route + integráció

**Files:**
- Create: `packages/backend/src/routes/scoring.routes.ts`
- Create: `packages/backend/tests/scoring.routes.test.ts`
- Modify: `packages/backend/src/app.ts`

- [ ] **Step 1: Failing route teszt írása**

Create `packages/backend/tests/scoring.routes.test.ts`:

```ts
import { describe, it, expect, vi, beforeEach } from 'vitest'
import request from 'supertest'

const { mockGetScoringExplainer } = vi.hoisted(() => ({
  mockGetScoringExplainer: vi.fn(),
}))

vi.mock('../src/services/scoring-explainer.service.js', () => ({
  getScoringExplainer: mockGetScoringExplainer,
}))

vi.mock('../src/middleware/auth.middleware.js', () => ({
  authMiddleware: async (ctx: any, next: any) => {
    if (ctx.headers.authorization === 'Bearer valid') {
      ctx.state.user = { id: 'user-1' }
      await next()
    } else {
      ctx.status = 401
      ctx.body = { error: 'Unauthorized' }
    }
  },
}))

import app from '../src/app.js'

describe('GET /api/scoring/explainer', () => {
  beforeEach(() => vi.clearAllMocks())

  it('200 valid tokennel', async () => {
    mockGetScoringExplainer.mockResolvedValue({ default: { exactScore: 3 }, defaultFrozenAt: null, groups: [] })
    const res = await request(app.callback()).get('/api/scoring/explainer').set('Authorization', 'Bearer valid')
    expect(res.status).toBe(200)
    expect(res.body.default.exactScore).toBe(3)
    expect(mockGetScoringExplainer).toHaveBeenCalledWith('user-1')
  })

  it('401 token nélkül', async () => {
    const res = await request(app.callback()).get('/api/scoring/explainer')
    expect(res.status).toBe(401)
  })
})
```

- [ ] **Step 2: Teszt futtatása → fail**

Run: `cd packages/backend && npx vitest run tests/scoring.routes.test.ts`
Expected: FAIL — `Cannot find module '../src/routes/scoring.routes.js'` (vagy 404 a route-ra, ha az app.ts-be sem kötjük be)

- [ ] **Step 3: Route fájl írása**

Create `packages/backend/src/routes/scoring.routes.ts`:

```ts
import Router from '@koa/router'
import { authMiddleware } from '../middleware/auth.middleware.js'
import { getScoringExplainer } from '../services/scoring-explainer.service.js'

const router = new Router()

router.get('/api/scoring/explainer', authMiddleware, async (ctx) => {
  const userId = ctx.state.user.id as string
  ctx.body = await getScoringExplainer(userId)
})

export { router as scoringRouter }
```

- [ ] **Step 4: Route bekötése `app.ts`-be**

In `packages/backend/src/app.ts`:

```ts
// Az import szekcióban:
import { scoringRouter } from './routes/scoring.routes.js'

// A scoringConfigRouter regisztráció után (a fájl végén):
app.use(scoringRouter.routes())
app.use(scoringRouter.allowedMethods())
```

- [ ] **Step 5: Tesztek futtatása → mind passol**

Run: `cd packages/backend && npx vitest run tests/scoring.routes.test.ts`
Expected: PASS (2 test)

- [ ] **Step 6: Teljes backend teszt suite futtatása**

Run: `cd packages/backend && npx vitest run`
Expected: minden meglévő teszt zöld (regresszió-mentes)

- [ ] **Step 7: Commit**

```bash
git add packages/backend/src/routes/scoring.routes.ts \
        packages/backend/tests/scoring.routes.test.ts \
        packages/backend/src/app.ts
git commit -m "feat(scoring-explainer): add GET /api/scoring/explainer route"
```

---

## Task 5: Frontend — types + API wrapper

**Files:**
- Modify: `packages/frontend/src/types/index.ts`
- Modify: `packages/frontend/src/api/index.ts`

- [ ] **Step 1: Frontend típusok hozzáadása `packages/frontend/src/types/index.ts` végéhez**

```ts
export interface ScoringExplainerSpecialType {
  readonly id: string
  readonly name: string
  readonly description: string | null
  readonly points: number
  readonly source: 'group-owned' | 'subscribed-global'
}

export interface ScoringExplainerGroup {
  readonly id: string
  readonly name: string
  readonly config: ScoringConfigFull
  readonly configFrozenAt: string | null
  readonly favoriteTeamDoublePoints: boolean
  readonly specialTypes: ReadonlyArray<ScoringExplainerSpecialType>
}

export interface ScoringExplainerResponse {
  readonly default: ScoringConfigFull
  readonly defaultFrozenAt: string | null
  readonly groups: ReadonlyArray<ScoringExplainerGroup>
}
```

- [ ] **Step 2: API wrapper hozzáadása `packages/frontend/src/api/index.ts`-be**

A meglévő `scoringConfig.default` után, ugyanazon a szinten:

```ts
import type { /* ... */ ScoringExplainerResponse } from '../types/index.js'

// majd a `scoringConfig` blokk után:
scoring: {
  explainer: (token: string) =>
    request<ScoringExplainerResponse>('/scoring/explainer', {
      headers: { Authorization: `Bearer ${token}` },
    }),
},
```

- [ ] **Step 3: tsc check**

Run: `cd packages/frontend && npx tsc --noEmit`
Expected: nincs új típushiba

- [ ] **Step 4: Commit**

```bash
git add packages/frontend/src/types/index.ts packages/frontend/src/api/index.ts
git commit -m "feat(scoring-explainer): add frontend types and api wrapper"
```

---

## Task 6: Frontend — Pinia store (failing tests first)

**Files:**
- Create: `packages/frontend/src/stores/scoring-explainer.store.test.ts`
- Create: `packages/frontend/src/stores/scoring-explainer.store.ts`

- [ ] **Step 1: Failing store teszt**

Create `packages/frontend/src/stores/scoring-explainer.store.test.ts`:

```ts
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'

const { mockExplainer } = vi.hoisted(() => ({ mockExplainer: vi.fn() }))

vi.mock('../api/index.js', () => ({
  api: { scoring: { explainer: mockExplainer } },
}))

vi.mock('./auth.store.js', () => ({
  useAuthStore: () => ({ token: 'tok' }),
}))

vi.mock('./toast.store.js', () => ({
  useToastStore: () => ({ addToast: vi.fn() }),
}))

import { useScoringExplainerStore } from './scoring-explainer.store'

describe('useScoringExplainerStore', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    vi.clearAllMocks()
  })

  it('open() lazy fetch + isOpen=true sikeres válasznál', async () => {
    mockExplainer.mockResolvedValue({ default: {}, defaultFrozenAt: null, groups: [] })
    const store = useScoringExplainerStore()
    await store.open('menu')
    expect(store.isOpen).toBe(true)
    expect(store.data).not.toBeNull()
    expect(store.lastSource).toBe('menu')
    expect(mockExplainer).toHaveBeenCalledTimes(1)
  })

  it('második open() nem fetch-el (cache)', async () => {
    mockExplainer.mockResolvedValue({ default: {}, defaultFrozenAt: null, groups: [] })
    const store = useScoringExplainerStore()
    await store.open('menu')
    store.close()
    await store.open('leaderboard')
    expect(mockExplainer).toHaveBeenCalledTimes(1)
    expect(store.lastSource).toBe('leaderboard')
  })

  it('fetch hiba → isOpen marad false, error set, toast hívva', async () => {
    mockExplainer.mockRejectedValue(new Error('boom'))
    const store = useScoringExplainerStore()
    await store.open('menu')
    expect(store.isOpen).toBe(false)
    expect(store.error).toBe('boom')
    expect(store.data).toBeNull()
  })

  it('close() → isOpen=false', async () => {
    mockExplainer.mockResolvedValue({ default: {}, defaultFrozenAt: null, groups: [] })
    const store = useScoringExplainerStore()
    await store.open('menu')
    store.close()
    expect(store.isOpen).toBe(false)
  })
})
```

- [ ] **Step 2: Teszt → FAIL (modul hiányzik)**

Run: `cd packages/frontend && npx vitest run src/stores/scoring-explainer.store.test.ts`
Expected: FAIL

- [ ] **Step 3: Store implementáció**

Create `packages/frontend/src/stores/scoring-explainer.store.ts`:

```ts
import { defineStore } from 'pinia'
import { ref } from 'vue'
import { api } from '../api/index.js'
import { useAuthStore } from './auth.store.js'
import { useToastStore } from './toast.store.js'
import type { ScoringExplainerResponse } from '../types/index.js'

export type ScoringExplainerSource = 'menu' | 'leaderboard' | 'group' | 'match-tip' | 'special-tip'

export const useScoringExplainerStore = defineStore('scoringExplainer', () => {
  const isOpen = ref(false)
  const data = ref<ScoringExplainerResponse | null>(null)
  const loading = ref(false)
  const error = ref<string | null>(null)
  const lastSource = ref<ScoringExplainerSource | null>(null)

  async function open(source: ScoringExplainerSource): Promise<void> {
    lastSource.value = source
    if (data.value) {
      isOpen.value = true
      return
    }
    const auth = useAuthStore()
    if (!auth.token) return
    loading.value = true
    error.value = null
    try {
      data.value = await api.scoring.explainer(auth.token)
      isOpen.value = true
    } catch (e) {
      error.value = e instanceof Error ? e.message : 'Unknown error'
      const toast = useToastStore()
      toast.addToast('scoringExplainer.fetchError', 'error')
    } finally {
      loading.value = false
    }
  }

  function close(): void {
    isOpen.value = false
  }

  return { isOpen, data, loading, error, lastSource, open, close }
})
```

> **Note:** A toast `message` mező kulcsa nem fordított string — a `ToastContainer.vue` jelenleg literal string-et vár. A meglévő toast store API miatt a kulcsot a hívó fél fordítja. Ha a `ToastContainer.vue` már használ `$t()`-t, kulcsot küldj; ha nem, a hívó fél fordítson `useI18n` helperrel a store-ban (lásd Task 8 commit előtt verify).

- [ ] **Step 4: Verify toast i18n consumption**

Run: `grep -n '\$t\|useI18n\|t(' packages/frontend/src/components/ToastContainer.vue`
Expected: ha nincs `$t`/`useI18n` használat, módosítsd a store-t hogy a hívás előtt fordítson:

```ts
import { useI18n } from 'vue-i18n'
// ...
const { t } = useI18n()
toast.addToast(t('scoringExplainer.fetchError'), 'error')
```

> A `useI18n` Pinia setup store-ban hívható, mert a `defineStore` callback minden `open()` híváskor (helyesebben: első setup-kor) inicializálódik. Ha a Vitest unit teszt nem tudja a `useI18n`-t mockolni, akkor a teszt mock-eljen rá:
> ```ts
> vi.mock('vue-i18n', () => ({ useI18n: () => ({ t: (k: string) => k }) }))
> ```

- [ ] **Step 5: Tesztek → PASS**

Run: `cd packages/frontend && npx vitest run src/stores/scoring-explainer.store.test.ts`
Expected: PASS (4 test)

- [ ] **Step 6: Commit**

```bash
git add packages/frontend/src/stores/scoring-explainer.store.ts \
        packages/frontend/src/stores/scoring-explainer.store.test.ts
git commit -m "feat(scoring-explainer): add Pinia store with lazy load + toast on error"
```

---

## Task 7: Frontend — i18n keys

**Files:**
- Modify: `packages/frontend/src/locales/hu.json`
- Modify: `packages/frontend/src/locales/en.json`

- [ ] **Step 1: HU kulcsok hozzáadása**

A `packages/frontend/src/locales/hu.json` legfelső objektumába egy új top-level kulcs (a meglévő szekciók — pl. `nav`, `common` — mintájára):

```json
"scoringExplainer": {
  "title": "Pontozási szabályzat",
  "groupTitle": "{groupName} pontozása",
  "subtitleSingle": "Az ebben a csoportban érvényes szabályok",
  "subtitleMulti": "A te csoportjaidban érvényes szabályok",
  "frozenTooltip": "Ez a szabályzat véglegesítve, a torna alatt nem változik.",
  "matchScoring": "Meccs-pontozás",
  "rules": {
    "exactScore": "Pontos eredmény",
    "correctWinnerAndDiff": "Helyes győztes + gólkülönbség",
    "correctWinner": "Helyes győztes",
    "correctDraw": "Helyes döntetlen",
    "correctOutcome": "Helyes kimenetel (11-esek után)",
    "incorrect": "Hibás"
  },
  "examples": {
    "you": "Te",
    "result": "Eredmény",
    "exactScore": "Te: 2-1, Eredmény: 2-1",
    "correctWinnerAndDiff": "Te: 3-1, Eredmény: 2-0",
    "correctWinner": "Te: 2-0, Eredmény: 3-1",
    "correctDraw": "Te: 1-1, Eredmény: 2-2",
    "correctOutcome": "Te: hazai továbbjutás, valódi: hazai 11-esekkel",
    "incorrect": "Te: 1-0, Eredmény: 0-2"
  },
  "columns": {
    "case": "Eset",
    "points": "Pontok",
    "example": "Példa"
  },
  "diffBadge": "Eltérés a {groupName}-ben",
  "bonus": {
    "heading": "Bónuszok",
    "favoriteTeamTitle": "Kedvenc csapat: dupla pont",
    "favoriteTeamDesc": "Ha a kedvenc csapatod meccsét tippeled, az ott szerzett pont ×2.",
    "active": "Aktív: {groups}"
  },
  "special": {
    "heading": "Speciális tippek"
  },
  "footnote": "A pontok a meccs lefújása után automatikusan kerülnek jóváírásra. Ha a szabályzat változik a torna közben, a már kiosztott pontokat nem érinti.",
  "close": "Bezárás",
  "ack": "Értem",
  "fetchError": "Nem sikerült betölteni a szabályokat",
  "trigger": {
    "menu": "Pontozás",
    "leaderboard": "Hogyan kapok pontot?",
    "iconAria": "Pontozás megnyitása"
  }
}
```

- [ ] **Step 2: EN tükörfordítások hozzáadása**

Ugyanaz a struktúra `packages/frontend/src/locales/en.json`-ben:

```json
"scoringExplainer": {
  "title": "Scoring rules",
  "groupTitle": "{groupName} scoring",
  "subtitleSingle": "Rules in effect for this group",
  "subtitleMulti": "Rules in effect for your groups",
  "frozenTooltip": "These rules are locked and won't change during the tournament.",
  "matchScoring": "Match scoring",
  "rules": {
    "exactScore": "Exact score",
    "correctWinnerAndDiff": "Correct winner + goal difference",
    "correctWinner": "Correct winner",
    "correctDraw": "Correct draw",
    "correctOutcome": "Correct outcome (after penalties)",
    "incorrect": "Wrong"
  },
  "examples": {
    "you": "You",
    "result": "Result",
    "exactScore": "You: 2-1, Result: 2-1",
    "correctWinnerAndDiff": "You: 3-1, Result: 2-0",
    "correctWinner": "You: 2-0, Result: 3-1",
    "correctDraw": "You: 1-1, Result: 2-2",
    "correctOutcome": "You: home win, actual: home on penalties",
    "incorrect": "You: 1-0, Result: 0-2"
  },
  "columns": {
    "case": "Case",
    "points": "Points",
    "example": "Example"
  },
  "diffBadge": "Differs in {groupName}",
  "bonus": {
    "heading": "Bonuses",
    "favoriteTeamTitle": "Favorite team: double points",
    "favoriteTeamDesc": "When you tip your favorite team's match, points earned there ×2.",
    "active": "Active in: {groups}"
  },
  "special": {
    "heading": "Special predictions"
  },
  "footnote": "Points are awarded automatically after the final whistle. If the rules change during the tournament, already-awarded points are not affected.",
  "close": "Close",
  "ack": "Got it",
  "fetchError": "Could not load scoring rules",
  "trigger": {
    "menu": "Scoring",
    "leaderboard": "How do I earn points?",
    "iconAria": "Open scoring rules"
  }
}
```

- [ ] **Step 3: i18n key parity check**

Run (gyors sanity):
```bash
cd packages/frontend && node -e "
const hu = require('./src/locales/hu.json').scoringExplainer;
const en = require('./src/locales/en.json').scoringExplainer;
function flatten(o, p='') { return Object.keys(o).flatMap(k => typeof o[k] === 'object' ? flatten(o[k], p+k+'.') : [p+k]) }
const h = flatten(hu).sort(), e = flatten(en).sort();
console.log('hu only:', h.filter(k => !e.includes(k)));
console.log('en only:', e.filter(k => !h.includes(k)));
console.log('total:', h.length, e.length);
"
```
Expected: `hu only: []`, `en only: []`, azonos count.

- [ ] **Step 4: Commit**

```bash
git add packages/frontend/src/locales/hu.json packages/frontend/src/locales/en.json
git commit -m "feat(scoring-explainer): add hu/en i18n keys"
```

---

## Task 8: Frontend — Trigger komponens

**Files:**
- Create: `packages/frontend/src/components/ScoringExplainerTrigger.vue`

- [ ] **Step 1: Trigger komponens írása**

Create `packages/frontend/src/components/ScoringExplainerTrigger.vue`:

```vue
<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import { useScoringExplainerStore, type ScoringExplainerSource } from '../stores/scoring-explainer.store.js'

interface Props {
  source: ScoringExplainerSource
  variant?: 'icon' | 'link'
  label?: string
}

const props = withDefaults(defineProps<Props>(), { variant: 'icon' })
const store = useScoringExplainerStore()
const { t } = useI18n()

function handleClick(): void {
  void store.open(props.source)
}
</script>

<template>
  <button
    v-if="variant === 'icon'"
    type="button"
    class="inline-flex w-4 h-4 rounded-full border border-blue-600 text-blue-600 items-center justify-center text-[10px] font-bold italic cursor-pointer hover:bg-blue-50"
    :aria-label="t('scoringExplainer.trigger.iconAria')"
    :data-testid="`scoring-explainer-trigger-${source}`"
    @click="handleClick"
  >
    i
  </button>
  <button
    v-else
    type="button"
    class="inline-flex items-center gap-1.5 text-blue-700 font-medium text-sm hover:underline"
    :data-testid="`scoring-explainer-trigger-${source}`"
    @click="handleClick"
  >
    <span class="inline-flex w-4 h-4 rounded-full border border-current items-center justify-center text-[10px] font-bold italic">i</span>
    {{ label ?? t('scoringExplainer.trigger.leaderboard') }}
  </button>
</template>
```

- [ ] **Step 2: Build/typecheck**

Run: `cd packages/frontend && npx tsc --noEmit`
Expected: no new errors.

- [ ] **Step 3: Commit**

```bash
git add packages/frontend/src/components/ScoringExplainerTrigger.vue
git commit -m "feat(scoring-explainer): add trigger component"
```

---

## Task 9: Frontend — Modal komponens (failing tests first)

**Files:**
- Create: `packages/frontend/src/components/__tests__/ScoringExplainerModal.spec.ts`
- Create: `packages/frontend/src/components/ScoringExplainerModal.vue`

- [ ] **Step 1: Failing teszt írása**

Create `packages/frontend/src/components/__tests__/ScoringExplainerModal.spec.ts`:

```ts
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount } from '@vue/test-utils'
import { setActivePinia, createPinia } from 'pinia'
import { createI18n } from 'vue-i18n'
import hu from '../../locales/hu.json'
import en from '../../locales/en.json'
import ScoringExplainerModal from '../ScoringExplainerModal.vue'
import { useScoringExplainerStore } from '../../stores/scoring-explainer.store'

const i18n = createI18n({ legacy: false, locale: 'hu', messages: { hu, en } })

function makeData(overrides: any = {}) {
  const baseConfig = {
    id: 'cfg', name: 'Default',
    exactScore: 3, correctWinnerAndDiff: 2, correctWinner: 1,
    correctDraw: 2, correctOutcome: 1, incorrect: 0, frozenAt: null,
  }
  return {
    default: baseConfig,
    defaultFrozenAt: null,
    groups: [],
    ...overrides,
  }
}

describe('ScoringExplainerModal', () => {
  beforeEach(() => setActivePinia(createPinia()))

  it('1 csoport — fejléc a csoportnévvel', () => {
    const store = useScoringExplainerStore()
    store.isOpen = true
    store.data = makeData({
      groups: [{ id: 'g1', name: 'Pulykák', config: { exactScore: 4, correctWinnerAndDiff: 2, correctWinner: 1, correctDraw: 2, correctOutcome: 1, incorrect: 0 }, configFrozenAt: null, favoriteTeamDoublePoints: false, specialTypes: [] }],
    })
    const wrapper = mount(ScoringExplainerModal, { global: { plugins: [i18n] } })
    expect(wrapper.text()).toContain('Pulykák pontozása')
  })

  it('2+ csoport — eltérés badge ott, ahol a config eltér a defaulttól', () => {
    const store = useScoringExplainerStore()
    store.isOpen = true
    store.data = makeData({
      groups: [
        { id: 'g1', name: 'Pulykák', config: { exactScore: 4, correctWinnerAndDiff: 2, correctWinner: 1, correctDraw: 2, correctOutcome: 1, incorrect: 0 }, configFrozenAt: null, favoriteTeamDoublePoints: false, specialTypes: [] },
        { id: 'g2', name: 'Office', config: { exactScore: 3, correctWinnerAndDiff: 2, correctWinner: 2, correctDraw: 2, correctOutcome: 1, incorrect: 0 }, configFrozenAt: null, favoriteTeamDoublePoints: false, specialTypes: [] },
      ],
    })
    const wrapper = mount(ScoringExplainerModal, { global: { plugins: [i18n] } })
    expect(wrapper.text()).toMatch(/Eltérés a Pulykák/)
    expect(wrapper.text()).toMatch(/Eltérés a Office/)
  })

  it('frozen lakat ikon megjelenik defaultFrozenAt != null esetén', () => {
    const store = useScoringExplainerStore()
    store.isOpen = true
    store.data = makeData({ defaultFrozenAt: '2026-06-01T00:00:00Z' })
    const wrapper = mount(ScoringExplainerModal, { global: { plugins: [i18n] } })
    expect(wrapper.find('[data-testid="scoring-explainer-frozen"]').exists()).toBe(true)
  })

  it('bónusz blokk csak akkor látszik, ha legalább egy csoport favoriteTeamDoublePoints=true', () => {
    const store = useScoringExplainerStore()
    store.isOpen = true
    store.data = makeData({
      groups: [{ id: 'g1', name: 'X', config: { exactScore: 3, correctWinnerAndDiff: 2, correctWinner: 1, correctDraw: 2, correctOutcome: 1, incorrect: 0 }, configFrozenAt: null, favoriteTeamDoublePoints: true, specialTypes: [] }],
    })
    const wrapper = mount(ScoringExplainerModal, { global: { plugins: [i18n] } })
    expect(wrapper.text()).toContain('Kedvenc csapat: dupla pont')
  })

  it('ESC bezárja a modalt', async () => {
    const store = useScoringExplainerStore()
    store.isOpen = true
    store.data = makeData()
    const wrapper = mount(ScoringExplainerModal, { global: { plugins: [i18n] }, attachTo: document.body })
    await wrapper.trigger('keydown', { key: 'Escape' })
    expect(store.isOpen).toBe(false)
    wrapper.unmount()
  })

  it('isOpen=false → nem renderel semmit', () => {
    const store = useScoringExplainerStore()
    store.isOpen = false
    const wrapper = mount(ScoringExplainerModal, { global: { plugins: [i18n] } })
    expect(wrapper.find('[role="dialog"]').exists()).toBe(false)
  })
})
```

- [ ] **Step 2: Teszt → FAIL**

Run: `cd packages/frontend && npx vitest run src/components/__tests__/ScoringExplainerModal.spec.ts`
Expected: FAIL — module not found

- [ ] **Step 3: Modal komponens írása**

Create `packages/frontend/src/components/ScoringExplainerModal.vue`:

```vue
<script setup lang="ts">
import { computed, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { useScoringExplainerStore } from '../stores/scoring-explainer.store.js'
import type { ScoringExplainerGroup } from '../types/index.js'

const store = useScoringExplainerStore()
const { t } = useI18n()

type RuleKey = 'exactScore' | 'correctWinnerAndDiff' | 'correctWinner' | 'correctDraw' | 'correctOutcome' | 'incorrect'
const RULE_KEYS: ReadonlyArray<RuleKey> = ['exactScore', 'correctWinnerAndDiff', 'correctWinner', 'correctDraw', 'correctOutcome', 'incorrect']

const data = computed(() => store.data)
const groups = computed(() => data.value?.groups ?? [])
const isSingle = computed(() => groups.value.length === 1)
const isMulti = computed(() => groups.value.length >= 2)

const headerTitle = computed(() => {
  if (isSingle.value) return t('scoringExplainer.groupTitle', { groupName: groups.value[0]!.name })
  return t('scoringExplainer.title')
})

const headerSubtitle = computed(() => isSingle.value
  ? t('scoringExplainer.subtitleSingle')
  : t('scoringExplainer.subtitleMulti'))

const isFrozen = computed(() => {
  if (!data.value) return false
  if (data.value.defaultFrozenAt) return true
  return groups.value.some(g => g.configFrozenAt !== null)
})

const displayRules = computed(() => {
  if (!data.value) return []
  const baseConfig = isSingle.value ? groups.value[0]!.config : data.value.default
  return RULE_KEYS.map(key => ({
    key,
    points: baseConfig[key] as number,
    diffs: isMulti.value
      ? groups.value
          .filter(g => (g.config[key] as number) !== (data.value!.default[key] as number))
          .map(g => ({ groupName: g.name, points: g.config[key] as number }))
      : [],
  }))
})

const bonusGroups = computed(() => groups.value.filter(g => g.favoriteTeamDoublePoints).map(g => g.name))
const showBonus = computed(() => bonusGroups.value.length > 0)

function pointsPillClass(points: number): string {
  return points === 0
    ? 'bg-gray-200 text-gray-600'
    : 'bg-blue-100 text-blue-700'
}

function specialTypesByGroup(): Array<{ group: ScoringExplainerGroup }> {
  return groups.value.filter(g => g.specialTypes.length > 0).map(group => ({ group }))
}

function close(): void {
  store.close()
}

function onKeydown(e: KeyboardEvent): void {
  if (e.key === 'Escape') close()
}

watch(() => store.isOpen, (open) => {
  if (open) {
    document.addEventListener('keydown', onKeydown)
  } else {
    document.removeEventListener('keydown', onKeydown)
  }
}, { immediate: true })
</script>

<template>
  <div
    v-if="store.isOpen && data"
    class="fixed inset-0 bg-black/40 flex items-end sm:items-center justify-center z-50"
    role="dialog"
    aria-modal="true"
    aria-labelledby="scoring-explainer-title"
    data-testid="scoring-explainer-modal"
    @click.self="close"
    @keydown="onKeydown"
  >
    <div class="bg-white w-full sm:max-w-[640px] sm:rounded-xl rounded-t-2xl shadow-xl max-h-[90vh] flex flex-col overflow-hidden">
      <header class="px-5 py-4 border-b border-gray-200 bg-gray-50 flex items-center justify-between gap-3">
        <div class="flex items-center gap-2.5 min-w-0">
          <span
            v-if="isFrozen"
            class="inline-flex w-7 h-7 items-center justify-center bg-amber-100 text-amber-700 rounded-lg shrink-0"
            :title="t('scoringExplainer.frozenTooltip')"
            data-testid="scoring-explainer-frozen"
          >
            <svg class="w-4 h-4" fill="currentColor" viewBox="0 0 20 20"><path fill-rule="evenodd" d="M5 9V7a5 5 0 0110 0v2a2 2 0 012 2v5a2 2 0 01-2 2H5a2 2 0 01-2-2v-5a2 2 0 012-2zm8-2v2H7V7a3 3 0 016 0z" clip-rule="evenodd"/></svg>
          </span>
          <div class="min-w-0">
            <h2 id="scoring-explainer-title" class="text-base font-bold text-gray-900 truncate">{{ headerTitle }}</h2>
            <p class="text-xs text-gray-500 mt-0.5">{{ headerSubtitle }}</p>
          </div>
        </div>
        <button
          type="button"
          class="w-8 h-8 rounded-lg text-gray-400 hover:bg-gray-200 hover:text-gray-600 flex items-center justify-center shrink-0"
          :aria-label="t('scoringExplainer.close')"
          data-testid="scoring-explainer-close"
          @click="close"
        >
          <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/></svg>
        </button>
      </header>

      <div class="flex-1 overflow-y-auto px-5 py-4">
        <h3 class="text-xs uppercase tracking-wider font-semibold text-gray-500 mb-2">{{ t('scoringExplainer.matchScoring') }}</h3>
        <div class="bg-white border border-gray-200 rounded-xl overflow-hidden">
          <table class="w-full text-sm">
            <thead>
              <tr class="border-b border-gray-200 text-gray-500 text-left text-xs">
                <th class="px-3 py-2.5 font-medium">{{ t('scoringExplainer.columns.case') }}</th>
                <th class="px-3 py-2.5 font-medium text-center w-20">{{ t('scoringExplainer.columns.points') }}</th>
                <th class="px-3 py-2.5 font-medium">{{ t('scoringExplainer.columns.example') }}</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="rule in displayRules" :key="rule.key" class="border-b border-gray-100 last:border-0">
                <td class="px-3 py-2.5 text-gray-800">
                  {{ t(`scoringExplainer.rules.${rule.key}`) }}
                  <span
                    v-for="d in rule.diffs"
                    :key="d.groupName"
                    class="inline-flex items-center gap-1 ml-2 px-2 py-0.5 rounded-full text-[0.7rem] font-semibold bg-amber-50 text-amber-700 border border-amber-200"
                    data-testid="scoring-explainer-diff-badge"
                  >
                    ⚠ {{ t('scoringExplainer.diffBadge', { groupName: d.groupName }) }}: {{ d.points }}
                  </span>
                </td>
                <td class="px-3 py-2.5 text-center">
                  <span :class="['inline-flex items-center justify-center min-w-[2rem] px-2.5 py-0.5 rounded-full font-bold text-sm tabular-nums', pointsPillClass(rule.points)]">
                    {{ rule.points }}
                  </span>
                </td>
                <td class="px-3 py-2.5 text-gray-500 text-xs">{{ t(`scoringExplainer.examples.${rule.key}`) }}</td>
              </tr>
            </tbody>
          </table>
        </div>

        <section v-if="showBonus" class="mt-5">
          <h3 class="text-xs uppercase tracking-wider font-semibold text-gray-500 mb-2">{{ t('scoringExplainer.bonus.heading') }}</h3>
          <div class="bg-amber-50 border-l-4 border-amber-500 rounded-lg p-3.5">
            <div class="font-semibold text-amber-900 text-sm mb-0.5">{{ t('scoringExplainer.bonus.favoriteTeamTitle') }}</div>
            <div class="text-sm text-amber-800">{{ t('scoringExplainer.bonus.favoriteTeamDesc') }}</div>
            <div class="text-xs text-amber-700 italic mt-1">{{ t('scoringExplainer.bonus.active', { groups: bonusGroups.join(', ') }) }}</div>
          </div>
        </section>

        <section v-if="specialTypesByGroup().length > 0" class="mt-5">
          <h3 class="text-xs uppercase tracking-wider font-semibold text-gray-500 mb-2">{{ t('scoringExplainer.special.heading') }}</h3>
          <div v-for="entry in specialTypesByGroup()" :key="entry.group.id">
            <div v-if="isMulti" class="flex items-center gap-2 mt-3 mb-2">
              <span class="w-1.5 h-1.5 rounded-full bg-blue-600"></span>
              <span class="font-semibold text-sm text-gray-700">{{ entry.group.name }}</span>
            </div>
            <div v-for="s in entry.group.specialTypes" :key="s.id" class="border border-gray-200 rounded-lg p-3 mb-2 last:mb-0 bg-white">
              <div class="flex items-start justify-between gap-3">
                <div class="min-w-0">
                  <div class="font-medium text-gray-800 text-sm">{{ s.name }}</div>
                  <div v-if="s.description" class="text-gray-500 text-xs mt-0.5">{{ s.description }}</div>
                </div>
                <span :class="['inline-flex items-center justify-center min-w-[2rem] px-2.5 py-0.5 rounded-full font-bold text-sm tabular-nums', pointsPillClass(s.points)]">{{ s.points }}</span>
              </div>
            </div>
          </div>
        </section>

        <p class="mt-5 text-xs text-gray-500 bg-gray-50 border border-gray-200 rounded-lg p-3">
          {{ t('scoringExplainer.footnote') }}
        </p>
      </div>

      <footer class="px-5 py-3 border-t border-gray-200 bg-gray-50 flex justify-end">
        <button
          type="button"
          class="bg-blue-600 hover:bg-blue-700 text-white font-semibold text-sm px-5 py-2 rounded-lg"
          data-testid="scoring-explainer-ack"
          @click="close"
        >
          {{ t('scoringExplainer.ack') }}
        </button>
      </footer>
    </div>
  </div>
</template>
```

- [ ] **Step 4: Tesztek → PASS**

Run: `cd packages/frontend && npx vitest run src/components/__tests__/ScoringExplainerModal.spec.ts`
Expected: PASS (6 test)

- [ ] **Step 5: Frontend teljes teszt suite**

Run: `cd packages/frontend && npx vitest run`
Expected: minden meglévő teszt zöld + új tesztek zöldek.

- [ ] **Step 6: Commit**

```bash
git add packages/frontend/src/components/ScoringExplainerModal.vue \
        packages/frontend/src/components/__tests__/ScoringExplainerModal.spec.ts
git commit -m "feat(scoring-explainer): add modal component with diff badges and frozen state"
```

---

## Task 10: Frontend — globális modal mount

**Files:**
- Modify: `packages/frontend/src/App.vue`

- [ ] **Step 1: A modal mount-ja az `App.vue` template végéhez**

A `<ToastContainer />` (vagy a meglévő toast mount) mellé:

```vue
<script setup lang="ts">
import ScoringExplainerModal from './components/ScoringExplainerModal.vue'
// ... meglévő import-ok
</script>

<template>
  <!-- meglévő tartalom -->
  <ScoringExplainerModal />
  <ToastContainer />
</template>
```

> Megjegyzés: csak akkor render-eli magát, ha `store.isOpen === true`, így nem terheli a felhasználói flow-t.

- [ ] **Step 2: Frontend dev szerver indítása és kézi smoke**

Run: `cd packages/frontend && npm run dev`
Manual check: bejelentkezés után a böngésző DevTools console-ban:

```js
const s = window.__pinia__?.state?.value?.scoringExplainer
// vagy: importálva: useScoringExplainerStore().open('menu')
```

Várt: a fetch megtörténik, a modal megjelenik a screenen. Ha nem, ellenőrizd a Pinia mount-ot.

> A kézi smoke a következő task után könnyebb (mert lesz trigger gomb a UI-ban). Ha most kihagyod, jelöld TODO-nak és Task 11 után térj vissza.

- [ ] **Step 3: Commit**

```bash
git add packages/frontend/src/App.vue
git commit -m "feat(scoring-explainer): mount modal globally in App.vue"
```

---

## Task 11: Trigger — főmenü integráció

**Files:**
- Modify: `packages/frontend/src/components/AppNav.vue` (a meglévő nav komponens, ami a `nav.matches`, `nav.groups` stb. menüpontokat tartalmazza)

- [ ] **Step 1: A meglévő nav komponens megtalálása**

Run: `grep -rn "nav.matches\|nav.groups\|nav.leaderboard" packages/frontend/src/components/ packages/frontend/src/App.vue 2>/dev/null | head -20`
Expected: a nav komponens fájlja kiderül (pl. `AppNav.vue`, `MainNav.vue`, `Header.vue` — a tényleges név Step 2-ben kerül beillesztésre).

- [ ] **Step 2: "Pontozás" menüpont hozzáadása asztali nézethez**

A nav fő `<nav>` blokkjába (pl. a `nav.leaderboard` után), a meglévő nav-elemek mintájára:

```vue
<button
  type="button"
  class="<existing-nav-item-classes>"
  :data-testid="'nav-scoring-explainer'"
  @click="openScoringExplainer"
>
  {{ t('scoringExplainer.trigger.menu') }}
</button>
```

A `<script setup>`-ba:
```ts
import { useScoringExplainerStore } from '../stores/scoring-explainer.store.js'
const scoringExplainer = useScoringExplainerStore()
function openScoringExplainer(): void {
  void scoringExplainer.open('menu')
}
```

- [ ] **Step 3: Mobil hamburger menübe is**

A mobil dropdown szekciójához ugyanaz a button (a meglévő mobile-only `nav` elemek között).

- [ ] **Step 4: Kézi smoke**

`npm run dev` → asztali nézet → "Pontozás" menüpont → modal megnyílik. Mobil: hamburger → "Pontozás" → modal.

- [ ] **Step 5: Commit**

```bash
git add packages/frontend/src/components/AppNav.vue
git commit -m "feat(scoring-explainer): add main menu trigger (desktop + mobile)"
```

---

## Task 12: Trigger — ranglista oldal

**Files:**
- Modify: `packages/frontend/src/views/LeaderboardView.vue`

- [ ] **Step 1: A "Hogyan kapok pontot?" link beillesztése**

A `<script setup>`-ba:
```ts
import ScoringExplainerTrigger from '../components/ScoringExplainerTrigger.vue'
```

A fejléchez (a leaderboard cím vagy a fő tartalom közelébe), a meglévő layout patternjével konzisztensen:

```vue
<ScoringExplainerTrigger source="leaderboard" variant="link" />
```

- [ ] **Step 2: Kézi smoke**

`/app/leaderboard` → "Hogyan kapok pontot?" link kattintható → modal megnyílik.

- [ ] **Step 3: Commit**

```bash
git add packages/frontend/src/views/LeaderboardView.vue
git commit -m "feat(scoring-explainer): add leaderboard trigger link"
```

---

## Task 13: Trigger — csoport oldal

**Files:**
- Modify: `packages/frontend/src/views/GroupDetailView.vue`

- [ ] **Step 1: (i) ikon a csoport név mellett**

A meglévő csoport-név header közelébe:

```vue
<script setup lang="ts">
import ScoringExplainerTrigger from '../components/ScoringExplainerTrigger.vue'
</script>

<template>
  <h1 class="...">
    {{ group.name }}
    <ScoringExplainerTrigger source="group" variant="icon" />
  </h1>
</template>
```

- [ ] **Step 2: Kézi smoke**

`/app/groups/<id>` → (i) ikon kattintható → modal megnyílik a csoport-fókuszú nézettel (ha az csak egy csoport tagja, "Pulykák pontozása" cím; ha 2+ csoport, akkor a default fő nézet eltérés-badge-ekkel).

- [ ] **Step 3: Commit**

```bash
git add packages/frontend/src/views/GroupDetailView.vue
git commit -m "feat(scoring-explainer): add group page trigger icon"
```

---

## Task 14: Trigger — meccs tipp képernyő

**Files:**
- Modify: a meccs tipp form fejléc komponense

- [ ] **Step 1: A komponens megtalálása**

Run: `grep -rn "predictions/match\|MatchPrediction\|tipp" packages/frontend/src/components/predictions/ packages/frontend/src/views/ 2>/dev/null | grep -v test | head -10`
Expected: a meccs tipp form komponens fájlja (pl. `MatchTipForm.vue`, `MatchPredictionCard.vue`). Az aktuális fájlnevet a fenti grep eredményéből kell kinyerni.

- [ ] **Step 2: (i) ikon hozzáadása a fejlécbe**

```vue
<script setup lang="ts">
import ScoringExplainerTrigger from '../ScoringExplainerTrigger.vue' // adjust path
</script>

<template>
  <header class="... flex items-center gap-2">
    <!-- meglévő tartalom -->
    <ScoringExplainerTrigger source="match-tip" variant="icon" />
  </header>
</template>
```

- [ ] **Step 3: Kézi smoke**

Egy meccs tipp form megnyitása → (i) ikon kattintható → modal megjelenik.

- [ ] **Step 4: Commit**

```bash
git add <konkrét fájl>
git commit -m "feat(scoring-explainer): add match tip screen trigger icon"
```

---

## Task 15: Trigger — special tipp képernyő

**Files:**
- Modify: a special / torna tipp form fejléc komponense

- [ ] **Step 1: Komponens megtalálása**

Run: `grep -rn "special-prediction\|torna tipp\|tournament-tip\|SpecialPrediction" packages/frontend/src/components/ packages/frontend/src/views/ 2>/dev/null | grep -v test | head -10`
Expected: a special tipp form (pl. `TournamentTipsView.vue` egy szekciója vagy `SpecialPredictionForm.vue`).

- [ ] **Step 2: (i) ikon a fejlécbe**

```vue
<ScoringExplainerTrigger source="special-tip" variant="icon" />
```

- [ ] **Step 3: Kézi smoke**

Special tipp form → (i) ikon → modal megnyílik.

- [ ] **Step 4: Commit**

```bash
git add <konkrét fájl>
git commit -m "feat(scoring-explainer): add special tip screen trigger icon"
```

---

## Task 16: Telemetria események

**Files:**
- Modify: `packages/frontend/src/stores/scoring-explainer.store.ts`

- [ ] **Step 1: Telemetria utility ellenőrzése**

Run: `grep -rln "trackEvent\|analytics\|amplitude\|mixpanel" packages/frontend/src 2>/dev/null | head -3`
Expected:
- ha **nincs** telemetria utility, lépj a Step 2-be (no-op stub).
- ha **van**, használd azt és Step 2-t hagyd ki, helyette a meglévő helper hívd meg az alábbi paraméterekkel.

- [ ] **Step 2: No-op telemetria stub a store-ban**

A store fájl tetejére (vagy `useScoringExplainerStore` callback-en kívül egy egyszerű function):

```ts
function track(event: string, props: Record<string, unknown>): void {
  // Future-proof stub: a `console.debug` jelzi a fejlesztőnek, és könnyen lecserélhető analytics SDK hívásra.
  // eslint-disable-next-line no-console
  console.debug('[telemetry]', event, props)
}
```

A store `open()` body-ban a sikeres set után:
```ts
isOpen.value = true
const groupCount: '1' | '2+' = (data.value!.groups.length === 1) ? '1' : '2+'
const auth = useAuthStore()
track('scoring_explainer_opened', { source, groupCount, userId: auth.user?.id ?? null })
openedAt.value = Date.now()
```

A `close()`-ban:
```ts
function close(): void {
  isOpen.value = false
  if (openedAt.value !== null) {
    track('scoring_explainer_closed', { durationMs: Date.now() - openedAt.value })
    openedAt.value = null
  }
}
```

A reactive state-be:
```ts
const openedAt = ref<number | null>(null)
```

- [ ] **Step 3: Store teszt frissítése**

A meglévő `scoring-explainer.store.test.ts`-ben mockold a console.debug-ot vagy az új track-helpert, és írj egy új tesztet:

```ts
it('open() trackeli a scoring_explainer_opened eseményt', async () => {
  mockExplainer.mockResolvedValue({ default: {}, defaultFrozenAt: null, groups: [{ id: 'g1', name: 'X', config: {}, configFrozenAt: null, favoriteTeamDoublePoints: false, specialTypes: [] }] })
  const debugSpy = vi.spyOn(console, 'debug').mockImplementation(() => {})
  const store = useScoringExplainerStore()
  await store.open('menu')
  expect(debugSpy).toHaveBeenCalledWith('[telemetry]', 'scoring_explainer_opened', expect.objectContaining({ source: 'menu', groupCount: '1' }))
})

it('close() trackeli a scoring_explainer_closed eseményt durationMs-szel', async () => {
  mockExplainer.mockResolvedValue({ default: {}, defaultFrozenAt: null, groups: [] })
  const debugSpy = vi.spyOn(console, 'debug').mockImplementation(() => {})
  const store = useScoringExplainerStore()
  await store.open('menu')
  store.close()
  expect(debugSpy).toHaveBeenCalledWith('[telemetry]', 'scoring_explainer_closed', expect.objectContaining({ durationMs: expect.any(Number) }))
})
```

- [ ] **Step 4: Tesztek → PASS**

Run: `cd packages/frontend && npx vitest run src/stores/scoring-explainer.store.test.ts`
Expected: minden teszt zöld.

- [ ] **Step 5: Commit**

```bash
git add packages/frontend/src/stores/scoring-explainer.store.ts \
        packages/frontend/src/stores/scoring-explainer.store.test.ts
git commit -m "feat(scoring-explainer): track open/close events with duration"
```

---

## Task 17: E2E tesztek

**Files:**
- Create: `e2e/scoring-explainer.spec.ts`

- [ ] **Step 1: A 2 happy path teszt írása**

Create `e2e/scoring-explainer.spec.ts`:

```ts
import { test, expect } from '@playwright/test'
import { injectSession } from './helpers/auth.js'
import { ensureUser } from './helpers/api.js'

test.describe('Scoring Explainer modal', () => {
  test.beforeAll(async () => {
    await ensureUser()
  })

  test('Bejelentkezett user a ranglistáról nyitja a modalt → látja a saját csoportja szabályait → bezárja', async ({ page }) => {
    await injectSession(page)
    await page.goto('/app/leaderboard')

    await page.getByTestId('scoring-explainer-trigger-leaderboard').click()
    await expect(page.getByTestId('scoring-explainer-modal')).toBeVisible()
    await expect(page.getByText('Meccs-pontozás')).toBeVisible()

    await page.getByTestId('scoring-explainer-close').click()
    await expect(page.getByTestId('scoring-explainer-modal')).not.toBeVisible()
  })

  test('Főmenüből nyitva — címsor megjelenik', async ({ page }) => {
    await injectSession(page)
    await page.goto('/app/matches')

    await page.getByTestId('nav-scoring-explainer').click()
    await expect(page.getByTestId('scoring-explainer-modal')).toBeVisible()

    // ESC billentyű is bezárja
    await page.keyboard.press('Escape')
    await expect(page.getByTestId('scoring-explainer-modal')).not.toBeVisible()
  })
})
```

- [ ] **Step 2: E2E futtatása**

Run (lokálisan, dev szerver elindítása után — vagy a meglévő E2E launcher script):
```bash
cd <repo root> && npm run e2e -- scoring-explainer
```
Expected: 2 teszt zöld.

- [ ] **Step 3: Commit**

```bash
git add e2e/scoring-explainer.spec.ts
git commit -m "test(scoring-explainer): add e2e happy-path tests"
```

---

## Task 18: Backlog / story kezelés

**Files:**
- Modify: `plans/00-backlog.md`
- Modify: `plans/00-history.md`

- [ ] **Step 1: A "Pontozási szabályzat MVP" sor hozzáadása a backlog history-jához**

(Megjegyzés: a writing-plans skill szerint MVP nem volt külön story-ként rögzítve a backlogban — csak a `UX-029` követelte ezt. Az implementálás MVP-ként kezelhető, de a backlog ezzel a story-ID-val nem kell foglalkozzon. Ha a felhasználó kéri a story-t a history-be, használj egy ID-t a `UX-028` típusú sorrendben.)

Ha a felhasználó hozzá szeretné adni a history-hoz, javasolt sor:

```markdown
| UX-028 | Pontozási szabályzat modal MVP | Should Have |
```

A "Haladás" számláló frissítése: `135 / 161 story kész` — Should Have: `104/124`.

- [ ] **Step 2: Verify**

Run: `grep "Haladás\|UX-028\|UX-029" plans/00-backlog.md plans/00-history.md`
Expected: a counters konzisztensek és a UX-029 továbbra is open.

- [ ] **Step 3: Commit**

```bash
git add plans/00-backlog.md plans/00-history.md
git commit -m "chore(plans): record scoring-explainer MVP completion"
```

---

## Task 19: Záró sanity + fő branch

**Files:** (csak ellenőrzés, nem módosítás)

- [ ] **Step 1: Backend full suite**

Run: `cd packages/backend && npx vitest run && npx tsc --noEmit`
Expected: zöld.

- [ ] **Step 2: Frontend full suite**

Run: `cd packages/frontend && npx vitest run && npx tsc --noEmit`
Expected: zöld.

- [ ] **Step 3: Lint (ha létezik)**

Run: `npm run lint --workspaces --if-present 2>/dev/null`
Expected: nincs új hiba.

- [ ] **Step 4: Manual smoke checklist**

- [ ] Bejelentkezés → "Pontozás" menü → modal nyílik → bezáródik (X / Értem / ESC mind működik)
- [ ] Ranglista → "Hogyan kapok pontot?" → modal
- [ ] Csoport oldal → (i) ikon → modal a csoport-fókuszú fejléccel
- [ ] Meccs tipp form → (i) ikon → modal
- [ ] Special tipp form → (i) ikon → modal
- [ ] 1 csoportos user: "Pulykák pontozása" cím, eltérés-badge nincs
- [ ] 2+ csoportos user (eltérő configgal egy csoportban): default fő nézet, eltérés-badge a megfelelő soron
- [ ] frozen=true egy csoportban: lakat ikon a fejlécben
- [ ] Network throttle (offline) → trigger kattintás → toast "Nem sikerült betölteni a szabályokat", modal nem nyílik
- [ ] Mobile width (<640px): bottom sheet variáns
- [ ] EN locale-re váltva: minden szöveg fordítva, ugyanaz a layout

- [ ] **Step 5: Záró commit (csak ha nem volt módosítás)**

Ha a manual smoke nyomán nem született kód-változtatás, nincs commit szükséges. Egyéb esetben minimal commit a fix-szel:

```bash
git add <files>
git commit -m "fix(scoring-explainer): <konkrét probléma>"
```

---

## Self-review jegyzetek

1. **Spec coverage:**
   - 1. Probléma/cél — Task 1–19 összesítve
   - 2. UX (4 belépési pont, layout, a11y, store) — Task 6 (store), 9 (modal), 11–15 (triggers)
   - 3. Tartalom (csoport-kontextus, 6 szabály, bónuszok, special tippek, lábjegyzet) — Task 9
   - 4. Backend (endpoint, service, no cache, frozen) — Task 1–4
   - 5. Frontend (modulok, lazy load, error MVP, i18n) — Task 5–10, 16
   - 6. Tesztelés (backend, frontend, e2e) — Task 3, 4, 6, 9, 16, 17
   - 7. Telemetria — Task 16
   - 8. YAGNI — figyelembe véve (nem tervezünk dedikált oldalt, retry gombot, etc.)
   - 9. Érintett fájlok — File Structure szekcióban felsorolva

2. **Placeholders:** A Task 11, 14, 15 grep-alapú komponens-feltáró lépéseit szándékosan így hagytuk — a pontos fájlnevek a kódbázisban változhatnak, és a writing-plans skill engedi, hogy a kódbázis-szintű felfedezést a végrehajtás során végezzük (nem találgatás). A grep query specifikus.

3. **Type/Method consistency:** A `getScoringExplainer` szignatúra (Task 2 → Task 3 → Task 4) egységes. A `ScoringExplainerSource` union (`'menu' | 'leaderboard' | 'group' | 'match-tip' | 'special-tip'`) Task 6-ban kerül definiálásra és Task 11–15-ben pontosan ugyanezekkel a stringekkel használódik. A `data-testid="nav-scoring-explainer"` Task 11-ben definiálódik és Task 17 E2E-ben hivatkozik rá. A `data-testid="scoring-explainer-trigger-{source}"` mintát Task 8 (Trigger) és Task 17 használja.
