# Implementációs terv – US-201 + US-202 (Tipp leadása és módosítása)

## Kontextus

Az E2 epic első story-ja. A felhasználó már látja a meccseket (US-101 kész) – most tippelni is tudjon. US-202 (módosítás) egyszerre kerül implementálásra, mert ugyanaz az interfész: az API `onConflictDoUpdate`-tel kezeli mindkettőt.

---

## Érintett fájlok

### Új fájlok
| Fájl | Tartalom |
|------|----------|
| `packages/backend/src/services/predictions.service.ts` | `upsertPrediction`, `getMatchPredictionsForUser` |
| `packages/backend/src/routes/predictions.routes.ts` | `POST /api/predictions`, `GET /api/users/:userId/predictions` |
| `packages/backend/tests/predictions.service.test.ts` | Unit tesztek (DB mock) |
| `packages/frontend/src/stores/predictions.store.ts` | Pinia store: fetch + upsert + lookup |
| `packages/frontend/src/stores/predictions.store.test.ts` | Store unit tesztek |

### Módosított fájlok
| Fájl | Változás |
|------|----------|
| `packages/backend/src/types/index.ts` | `Prediction`, `PredictionInput` interface-ek |
| `packages/backend/src/app.ts` | `predictionsRouter` regisztrálás |
| `packages/frontend/src/types/index.ts` | `Prediction`, `PredictionInput` interface-ek |
| `packages/frontend/src/api/index.ts` | `api.predictions.mine`, `api.predictions.upsert` |
| `packages/frontend/src/views/MatchesView.vue` | Tipp form inline a meccs kártyában |
| `packages/frontend/src/views/MatchesView.test.ts` | Tipp form tesztek |

---

## Backend

### 1. Types bővítés (`packages/backend/src/types/index.ts`)

```typescript
export interface PredictionInput {
  readonly matchId: string
  readonly homeGoals: number
  readonly awayGoals: number
}

export interface Prediction {
  readonly id: string
  readonly userId: string
  readonly matchId: string
  readonly homeGoals: number
  readonly awayGoals: number
  readonly pointsGlobal: number | null
  readonly createdAt: string
  readonly updatedAt: string
}
```

### 2. `predictions.service.ts`

```typescript
export async function upsertPrediction(
  supabaseId: string,
  input: PredictionInput
): Promise<Prediction>
```

Lépések:
1. `users` táblából belső UUID lekérdezése `supabaseId` alapján → ha nincs: `AppError(404)`
2. `matches` táblából `scheduledAt` + `status` lekérdezése → ha nincs: `AppError(404)`
3. Ha `scheduledAt <= new Date()` VAGY `status !== 'scheduled'` → `AppError(409, 'Tippelési határidő lejárt')`
4. `db.insert(predictions).values({ userId, matchId, homeGoals, awayGoals }).onConflictDoUpdate({ target: [predictions.userId, predictions.matchId], set: { homeGoals, awayGoals, updatedAt: new Date() } }).returning()`
5. `Prediction` visszaadása (timestamp-ek `.toISOString()`)

```typescript
export async function getPredictionsForUser(
  requestingSupabaseId: string,
  targetUserId: string
): Promise<Prediction[]>
```

Lépések:
1. `users` táblából a requesting user belső UUID-jának ellenőrzése (auth check) → ha nincs: `AppError(404)`
2. `targetUserId` validálása: létező user-e → ha nincs: `AppError(404)`
3. Jogosultság: requesting user UUID === targetUserId VAGY requesting user `role === 'admin'` → különben `AppError(403)`
4. `db.select().from(predictions).where(eq(predictions.userId, targetUserId)).orderBy(predictions.createdAt)`
5. `Prediction[]` visszaadása

### 3. `predictions.routes.ts`

```typescript
// Tipp leadása / módosítása
router.post('/api/predictions', authMiddleware, async (ctx) => {
  const body = ctx.request.body as Record<string, unknown>
  // validálás: matchId (string), homeGoals + awayGoals (0-99 integer)
  ctx.body = await upsertPrediction(ctx.state.user.supabaseId, input)
})

// Saját / más user tippjeinek lekérése
router.get('/api/users/:userId/predictions', authMiddleware, async (ctx) => {
  const { userId } = ctx.params
  ctx.body = await getPredictionsForUser(ctx.state.user.supabaseId, userId)
})
```

Validátor (route fájlban):
```typescript
function isValidGoals(val: unknown): val is number {
  return typeof val === 'number' && Number.isInteger(val) && val >= 0 && val <= 99
}
```

### 4. Backend tesztek (`predictions.service.test.ts`)

`vi.hoisted()` pattern a `matches.service.test.ts` alapján. Két DB mock szükséges: `select` (users + matches + predictions lekérdezés) és `insert` (predictions upsert). A több egymást követő `db.select()` hívást `mockReturnValueOnce()` sorozattal kezeljük.

| Teszteset | Elvárt |
|-----------|--------|
| Ismeretlen supabaseId → `upsertPrediction` | `AppError(404)` |
| Ismeretlen matchId → `upsertPrediction` | `AppError(404)` |
| `scheduledAt` múltban → `upsertPrediction` | `AppError(409)` |
| `status !== 'scheduled'` → `upsertPrediction` | `AppError(409)` |
| Érvényes input → `upsertPrediction` | `db.insert` meghívva, `Prediction` visszaadva |
| Conflict (meglévő tipp) → `upsertPrediction` | `onConflictDoUpdate` meghívva |
| Ismeretlen user → `getPredictionsForUser` | `AppError(404)` |
| Más user tippjei, nem admin → `getPredictionsForUser` | `AppError(403)` |
| Saját tippek lekérése | `Prediction[]` visszaadva |
| Admin más user tippjeit kéri | `Prediction[]` visszaadva |
| Nincs tipp → `getPredictionsForUser` | `[]` visszaadva |

---

## Frontend

### 5. Frontend types (`packages/frontend/src/types/index.ts`)

Azonos `Prediction`, `PredictionInput` interface-ek mint a backenden.

### 6. `api/index.ts` bővítés

```typescript
predictions: {
  mine: (token: string, userId: string) =>
    request<Prediction[]>(`/users/${userId}/predictions`, {
      headers: { Authorization: `Bearer ${token}` },
    }),
  upsert: (token: string, input: PredictionInput) =>
    request<Prediction>('/predictions', {
      method: 'POST',
      body: JSON.stringify(input),
      headers: { Authorization: `Bearer ${token}` },
    }),
},
```

### 7. `predictions.store.ts`

```typescript
export const usePredictionsStore = defineStore('predictions', () => {
  const predictions = ref<Prediction[]>([])
  const isLoading = ref(false)
  const error = ref<string | null>(null)
  const saveStatus = ref<Record<string, 'saving' | 'saved' | 'error'>>({})

  // matchId → Prediction | undefined
  const predictionByMatchId = computed(() =>
    (matchId: string): Prediction | undefined =>
      predictions.value.find(p => p.matchId === matchId)
  )

  async function fetchMyPredictions(): Promise<void>
  // getAccessToken() + authStore.user.id alapján hívja api.predictions.mine

  async function upsertPrediction(input: PredictionInput): Promise<void>
  // saveStatus[matchId] = 'saving' → api.predictions.upsert → in-place update/push
  // saveStatus[matchId] = 'saved' | 'error'
})
```

**saveStatus:** `Record<matchId, 'saving' | 'saved' | 'error'>` – a kártya visszajelzéséhez.

**In-place upsert:** ha az adott `matchId`-hoz már létezik tipp a tömbben, frissíti; ha nem, push-olja.

### 8. `MatchesView.vue` módosítás

A meccs kártya alján, a venue sor után, inline tipp form:

```
ha match.status === 'scheduled' ÉS scheduledAt > now:
  → 2 number input (0-99), Mentés gomb
  → Mentés közben: disabled + "Mentés..."
  → Siker: "Tipp elmentve! ✓" (saveStatus === 'saved')
  → Ha volt korábbi tipp: updatedAt megjelenítve ("Utoljára módosítva: ...")
  → Hiba: hibaüzenet

ha status !== 'scheduled' VAGY scheduledAt <= now:
  → ha van saját tipp: "Az én tippem: X – Y"
  → "Tippelés lezárva"
```

**Draft state:** `const draftGoals = ref<Record<string, { home: number | null, away: number | null }>>({})` – inicializálva meglévő tippből ha van.

**`now`:** `const now = ref(new Date())` – oldal betöltéskori érték (MVP-hez elegendő).

`onMounted`:
```typescript
await matchesStore.fetchMatches()
await predictionsStore.fetchMyPredictions()
// draftGoals inicializálása meglévő tippekből
```

### 9. Frontend tesztek

**`predictions.store.test.ts`:**
| Teszteset | Elvárt |
|-----------|--------|
| Kezdetben üres `predictions` | `[]` |
| `fetchMyPredictions()` siker | `predictions` beállítva |
| `fetchMyPredictions()` hiba | `error` beállítva |
| `predictionByMatchId('match-1')` | helyes `Prediction` |
| `predictionByMatchId('ismeretlen')` | `undefined` |
| `upsertPrediction()` új tipp | bekerül a tömbbe, `saveStatus === 'saved'` |
| `upsertPrediction()` meglévő frissítés | in-place update, tömb méret változatlan |
| `upsertPrediction()` API hiba | `saveStatus === 'error'`, `error` beállítva |

**`MatchesView.test.ts` kiegészítés:**
| Teszteset | Elvárt |
|-----------|--------|
| `scheduled` meccs → tipp form látható | ✅ |
| `finished` meccs → tipp form nem látható | ✅ |
| `live` meccs → tipp form nem látható | ✅ |
| Meglévő tipp → inputok előre kitöltve | ✅ |
| Mentés gomb kattintás → `upsertPrediction` meghívva | ✅ |
| `saveStatus === 'saved'` → visszajelzés látható | ✅ |
| `saveStatus === 'saving'` → gomb disabled | ✅ |

---

## Implementációs sorrend

1. Backend types bővítése (`Prediction`, `PredictionInput`)
2. `predictions.service.test.ts` (Red)
3. `predictions.service.ts` (Green)
4. `predictions.routes.ts` + `app.ts`
5. Frontend types bővítése
6. `api/index.ts` bővítése
7. `predictions.store.test.ts` (Red)
8. `predictions.store.ts` (Green)
9. `MatchesView.test.ts` kiegészítése (Red)
10. `MatchesView.vue` módosítása (Green)
11. `npm test --workspaces` + `npm run typecheck --workspaces`

---

## Architekturális döntések

**`/api/users/:userId/predictions` URL:**
A legtisztább REST hierarchia – a predictions a user resource alá rendelt. Ugyanez az endpoint használható majd US-204-nél (mások tippjei megtekintése), csak jogosultság-ellenőrzéssel bővítve. A frontenden az `authStore.user.id` (DB UUID) áll rendelkezésre a saját userId-hoz.

**`supabaseId` → `userId` lookup a service-ben:**
Az `authMiddleware` `AuthenticatedUser`-t rak a state-re (csak `supabaseId`). A belső DB UUID lekérés service-szintű felelősség – konzisztens a meglévő `auth.routes.ts` + `user.service.ts` megközelítéssel.

**`onConflictDoUpdate` – US-201 és US-202 egyben:**
A `predictions_user_match_unique` constraint már létezik. Drizzle `onConflictDoUpdate` atomikusan kezeli insert/update esetét – nincs race condition, nincs külön endpoint a módosításhoz.

**Inline form, nem külön komponens (MVP):**
Ha a tipp form logikája növekszik (US-102 meccs részletek nézethez), akkor érdemes kiemelni külön komponensbe – de ez refaktor lépés, nem ebben a story-ban.
