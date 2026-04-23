# US-901 / US-902 – Statisztikai Tippek: Lebontott Story-k

> Eredeti story-k: US-901 (Should Have, L) és US-902 (Should Have, L)
> Cél: 7 önállóan szállítható story S/M méretben
> Dátum: 2026-04-23

---

## Összefoglalás és függőségi sorrend

```
US-901-A  (DB migráció)
    └── US-901-B  (Backend: type CRUD)
            └── US-901-C  (Backend: prediction submit/fetch)
                    └── US-901-D  (Backend: kiértékelés)
                            └── US-901-E  (Backend: ranglista integráció)
US-901-B ─┐
US-901-C ─┼── US-902-A  (Frontend: admin konfig UI)
US-901-D ─┘
US-901-C ──── US-902-B  (Frontend: tag tipp UI)
```

A frontend story-k (US-902-A, US-902-B) a backend story-k (US-901-B, US-901-C, US-901-D) befejezése után kezdhetők el.

---

## US-901-A – DB migráció: groupId FK hozzáadása a special_prediction_types táblához

### User Story
"As a developer,
I want `special_prediction_types` to have a `group_id` foreign key referencing `groups.id`,
so that stat prediction types are scoped to a single group and cascade-deleted when a group is deleted."

### Acceptance Criteria
- [ ] Drizzle schema: `specialPredictionTypes` táblán új mező: `groupId: uuid('group_id').notNull().references(() => groups.id, { onDelete: 'cascade' })`
- [ ] Index hozzáadva: `index('spt_group_idx').on(t.groupId)`
- [ ] `specialPredictionTypesRelations` frissítve: `one(groups, ...)` reláció hozzáadva
- [ ] `groupsRelations` frissítve: `specialTypes: many(specialPredictionTypes)` hozzáadva
- [ ] Drizzle migráció generálva és elnevezve: `0009_special_prediction_types_group_id.sql`
- [ ] A migráció `ALTER TABLE special_prediction_types ADD COLUMN group_id UUID NOT NULL REFERENCES groups(id) ON DELETE CASCADE` utasítást tartalmaz
- [ ] Ha a táblában már vannak sorok, a migráció kezeli a NOT NULL constraintet (pl. ha nincs seed adat, nincs probléma; ha van, a migráció ezt dokumentálja)
- [ ] Az összes meglévő teszt zöld marad

### Technical Notes
- A `specialPredictions` táblán **nem** kell `groupId` — a `typeId` JOIN-on keresztül mindig megkapható a `group_id`
- A `specialPredictionInputTypeEnum` értékei (`text`, `dropdown`, `number`, `team_select`, `player_select`) változatlanok maradnak; UI és validáció csak `text` és `dropdown` értékeket kezel
- `options` JSONB: `string[]` dropdown esetén, `null` text esetén
- `correctAnswer`: nullable text, kiértékeléskor tölti ki az admin

**Komplexitás:** S
**Prioritás:** Should Have
**Függőség:** nincs

---

## US-901-B – Backend: Statisztikai tipp típus CRUD (csoport admin)

### User Story
"As a group admin,
I want to create, list, update, and deactivate stat prediction types for my group via API,
so that I can configure what statistical questions group members can answer."

### Acceptance Criteria

**Endpoints (mind `authMiddleware` mögött, csoport admin ellenőrzéssel):**
- [ ] `GET /api/groups/:groupId/special-types` — 200: aktív típusok listája; 403 ha nem tag; 404 ha a csoport nem létezik
- [ ] `POST /api/groups/:groupId/special-types` — 201: új típus létrehozva; 403 ha nem csoport admin; 400 validációs hiba esetén
- [ ] `PUT /api/groups/:groupId/special-types/:typeId` — 200: frissítve; 403 ha nem csoport admin; 404 ha a típus nem létezik vagy más csoporthoz tartozik
- [ ] `DELETE /api/groups/:groupId/special-types/:typeId` — 204: `isActive = false` (nem fizikai törlés); 403 ha nem csoport admin

**Validáció:**
- [ ] `name`: kötelező, max 100 karakter
- [ ] `inputType`: `'text'` vagy `'dropdown'` (más értékek 400-at adnak)
- [ ] `options`: kötelező ha `inputType = 'dropdown'` (legalább 2 elem, max 20 elem, minden elem max 100 karakter); `text` esetén null/hiányzó
- [ ] `deadline`: kötelező, ISO 8601, jövőbeli időpont (létrehozáskor)
- [ ] `points`: kötelező, integer 1–100

**Service:**
- [ ] `packages/backend/src/services/special-prediction-types.service.ts` létrehozva
- [ ] `listActiveTypes(groupId: string, requesterId: string): Promise<SpecialPredictionType[]>`
- [ ] `createType(groupId: string, requesterId: string, input: SpecialTypeInput): Promise<SpecialPredictionType>`
- [ ] `updateType(groupId: string, typeId: string, requesterId: string, input: Partial<SpecialTypeInput>): Promise<SpecialPredictionType>`
- [ ] `deactivateType(groupId: string, typeId: string, requesterId: string): Promise<void>`
- [ ] Minden függvény dob `AppError(403)` ha a requester nem csoport admin
- [ ] Minden függvény dob `AppError(404)` ha a csoport nem létezik vagy a típus más csoporthoz tartozik

**Routes:**
- [ ] `packages/backend/src/routes/special-predictions.routes.ts` létrehozva
- [ ] A router csatolva `app.ts`-ben: `app.use(specialPredictionsRouter.routes())`

**Tesztek:**
- [ ] `special-prediction-types.service.test.ts`: listázás, létrehozás, frissítés, deaktiválás, jogosultság ellenőrzés (403), hiányzó csoport (404), hibás inputType (400), dropdown validáció
- [ ] Minimum 10 unit teszt, DB mock-kal (vitest mock)

### Technical Notes
- Csoport admin ellenőrzés: `groupMembers` táblában `groupId + userId + isAdmin = true` sor létezik
- Tag ellenőrzés (listázáshoz): `groupMembers` táblában `groupId + userId` sor létezik
- `SpecialPredictionType` interface: `id`, `groupId`, `name`, `description`, `inputType`, `options`, `deadline`, `points`, `correctAnswer`, `isActive`, `createdAt`, `updatedAt`
- `SpecialTypeInput` interface: `name`, `description?`, `inputType`, `options?`, `deadline`, `points`

**Komplexitás:** M
**Prioritás:** Should Have
**Függőség:** US-901-A

---

## US-901-C – Backend: Statisztikai tipp beküldése és lekérdezése (csoport tag)

### User Story
"As a group member,
I want to submit or update my answer to a stat prediction type and retrieve my existing answers,
so that I can participate in the group's statistical prediction questions."

### Acceptance Criteria

**Endpoints:**
- [ ] `GET /api/groups/:groupId/special-predictions` — 200: a requester összes tippje az adott csoporthoz tartozó aktív típusokhoz (típus metaadatával együtt); 403 ha nem tag
- [ ] `POST /api/groups/:groupId/special-predictions` — 201/200: tipp létrehozása vagy felülírása (`ON CONFLICT DO UPDATE` userId + typeId-n); 403 ha nem tag; 400 validációs hiba; 409 ha a határidő lejárt

**Validáció:**
- [ ] `typeId`: létező, aktív típus; a típus `groupId`-ja egyezik az URL `groupId`-jával, különben 404
- [ ] `answer`: kötelező, max 500 karakter
- [ ] Ha `inputType = 'dropdown'`: az `answer` értékének szerepelnie kell a `options` tömbben, különben 400
- [ ] Határidő ellenőrzés: `deadline < now()` esetén 409 `"Deadline has passed for this prediction type"` üzenettel
- [ ] Határidő ellenőrzés **szerver-oldali** (kliens időpontja irreleváns)

**Service:**
- [ ] `packages/backend/src/services/special-predictions.service.ts` létrehozva
- [ ] `getMyPredictions(groupId: string, userId: string): Promise<SpecialPredictionWithType[]>`
- [ ] `upsertPrediction(groupId: string, userId: string, input: SpecialPredictionInput): Promise<SpecialPrediction>`
- [ ] `getMyPredictions` JOIN-olja a `specialPredictionTypes` táblát hogy minden tipphez visszaadja a típus nevét, leírását, határidejét, pontszámát, inputType-ját, options-jét

**Response shape (`GET`):**
```typescript
interface SpecialPredictionWithType {
  readonly id: string
  readonly typeId: string
  readonly typeName: string
  readonly typeDescription: string | null
  readonly inputType: 'text' | 'dropdown'
  readonly options: string[] | null
  readonly deadline: string  // ISO 8601
  readonly maxPoints: number
  readonly answer: string
  readonly points: number | null  // null ha még nem értékelték ki
  readonly createdAt: string
  readonly updatedAt: string
}
```

**Tesztek:**
- [ ] `special-predictions.service.test.ts`: tipp beküldés, felülírás, határidő lejárt (409), dropdown validáció (400), jogosultság (403), hiányzó típus (404)
- [ ] Minimum 8 unit teszt

### Technical Notes
- Az upsert `ON CONFLICT (user_id, type_id) DO UPDATE SET answer = excluded.answer, updated_at = now()` logikát követ, összhangban a predictions tábla mintájával
- Ha a tippet beküldik, a `points` mező null marad egészen a kiértékelésig
- A lekérdezés visszaadja a típust akkor is, ha a usernek még nincs tippje rá (LEFT JOIN logika a service-ben)

**Komplexitás:** M
**Prioritás:** Should Have
**Függőség:** US-901-A, US-901-B

---

## US-901-D – Backend: Kiértékelés – helyes válasz rögzítése és pontszámítás

### User Story
"As a group admin,
I want to set the correct answer for a stat prediction type and trigger automatic point calculation for all group members,
so that the leaderboard reflects everyone's stat prediction scores."

### Acceptance Criteria

**Endpoint:**
- [ ] `PUT /api/groups/:groupId/special-types/:typeId/answer` — body: `{ correctAnswer: string }`; 200: a típus visszaadva frissített `correctAnswer`-rel; 403 ha nem csoport admin; 404 ha a típus nem létezik
- [ ] A `correctAnswer` beállítása után automatikusan lefut a pontszámítás minden, az adott `typeId`-hez tartozó `specialPredictions` sorra
- [ ] A pontszámítás idempotens: újra meghívva a pontok felülíródnak

**Kiértékelési logika:**
- [ ] `packages/backend/src/services/special-prediction-evaluation.service.ts` létrehozva
- [ ] `setCorrectAnswer(groupId: string, typeId: string, requesterId: string, correctAnswer: string): Promise<SpecialPredictionType>`
- [ ] `evaluateSpecialPrediction(answer: string, correctAnswer: string, maxPoints: number): number` — pure function, exportálva
- [ ] Az összehasonlítás normalizál: `trim()` + `toLowerCase()` + NFD unicode normalizálás (ékezetek eltávolítása)
- [ ] Helyes válasz → `maxPoints` pont; helytelen → 0 pont
- [ ] A számítás frissíti a `specialPredictions.points` mezőt minden érintett sornál (`UPDATE ... WHERE type_id = :typeId`)

**Tesztek:**
- [ ] `special-prediction-evaluation.service.test.ts`
- [ ] `evaluateSpecialPrediction` unit tesztek (pure function): pontos egyezés, kis/nagybetű különbség, vezető/záró szóköz, ékezetes karakterek (pl. "Messi" === "messi", "Varga" === "vàrga"), helytelen válasz
- [ ] `setCorrectAnswer` integrációs tesztek: admin jogosultság, pontok frissülnek, idempotens újrafutás, 403, 404
- [ ] Minimum 10 unit teszt

### Technical Notes
- A normalizáló függvény:
  ```typescript
  const normalize = (s: string): string =>
    s.trim().toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '')
  ```
- A `correctAnswer` rögzítése után a `specialPredictionTypes.correctAnswer` mező frissül a DB-ben
- Az `evaluateSpecialPrediction` pure function — nem tartalmaz DB-hívást, önállóan unit tesztelhető
- A batch pontfrissítés egyetlen `UPDATE` utasítással történik, nem N+1 lekérdezéssel

**Komplexitás:** M
**Prioritás:** Should Have
**Függőség:** US-901-A, US-901-B, US-901-C

---

## US-901-E – Backend: Csoport ranglista integráció

### User Story
"As a group member,
I want the group leaderboard to include points from stat predictions in addition to match predictions,
so that my total standing reflects all my group contributions."

### Acceptance Criteria
- [ ] `getGroupLeaderboard(groupId, requesterId)` módosítva: a visszaadott `totalPoints` tartalmazza a `specialPredictions.points` összegét is
- [ ] Új mező a `LeaderboardEntry`-n: `specialPredictionPoints: number` (default 0 ha nincs stat tipp)
- [ ] A `specialPredictionPoints` csak az adott `groupId`-hoz tartozó `specialPredictionTypes`-ok tippjeit adja össze (WHERE `special_prediction_types.group_id = :groupId`)
- [ ] A subquery csak kiértékelt (nem null) pontokat összesít: `coalesce(sum(sp.points), 0)`
- [ ] Ha egy tagnak nincs egyetlen stat tippje sem, `specialPredictionPoints = 0` és nem dob hibát
- [ ] A rendezés (`totalPoints` csökkenő) figyelembe veszi az összesített pontot (meccs + stat)
- [ ] Az API response visszaadja az `specialPredictionPoints` mezőt (opcionális bontás a frontendnek)
- [ ] Az összes meglévő `getGroupLeaderboard` teszt zöld marad
- [ ] Új tesztek: stat pont nélküli tag (0), stat ponttal rendelkező tag, vegyes (van aki adott tippet, van aki nem), rendezés helyessége

### Technical Notes
- A módosítás a `packages/backend/src/services/group-leaderboard.service.ts` fájlt érinti
- Megvalósítás: LEFT JOIN subquery a `specialPredictions` és `specialPredictionTypes` táblákra, szűrve `spt.group_id = :groupId`
- A `totalPoints` számítás: `coalesce(sum(gpp.points), 0) + coalesce(specialPredictionPoints, 0)`
- A frontend `LeaderboardEntry` type-ot is frissíteni kell: `specialPredictionPoints?: number`

**Komplexitás:** M
**Prioritás:** Should Have
**Függőség:** US-901-A, US-901-C, US-901-D

---

## US-902-A – Frontend: Admin stat tipp konfigurációs UI

### User Story
"As a group admin,
I want a dedicated section in the GroupDetailView settings tab where I can create, edit, and deactivate stat prediction types,
so that I can configure statistical questions for my group without leaving the app."

### Acceptance Criteria

**Tab és elhelyezés:**
- [ ] A `GroupDetailView` Beállítások tabjában egy új „Statisztikai tippek" szekció jelenik meg a meglévő pontrendszer szekció alatt
- [ ] Csak csoport adminnak látható (ugyanaz a `canManageSettings` guard mint a Beállítások tab)

**Típuslista:**
- [ ] A szekció betöltéskor meghívja `GET /api/groups/:groupId/special-types` endpointot
- [ ] Aktív típusok listázva: név, inputType badge, határidő, pontszám, szerkesztés és deaktiválás gomb
- [ ] Ha nincs egyetlen típus sem: üres állapot üzenet: „Még nincs statisztikai tipp konfigurálva."
- [ ] Deaktiválás előtt megerősítő dialog: „Biztosan deaktiválod ezt a tipp típust? A tagok tippjei megmaradnak."
- [ ] Sikeres deaktiválás után a típus eltűnik a listából (optimista frissítés)

**Létrehozás / szerkesztés form:**
- [ ] „+ Új tipp típus" gombra megnyílik egy inline form (vagy dialog)
- [ ] Form mezők: Név (text input), Leírás (textarea, opcionális), Típus (dropdown: Szöveges / Dropdown-lista), Határidő (datetime-local input), Pontszám (number input 1–100)
- [ ] Ha „Dropdown-lista" a típus: dinamikusan megjelenő Options szekció: vesszővel elválasztott értékek beviteli mező VAGY egyenként hozzáadható tag-input
- [ ] Mentés gomb: POST/PUT hívás, loading állapot, sikeres mentés után a forma bezárul és a lista frissül
- [ ] Validáció kliens-oldalon is: kötelező mezők, deadline jövőbeli, dropdown esetén legalább 2 option
- [ ] Hibaüzenet megjelenik ha a backend 400-at ad vissza

**Store:**
- [ ] `groups.store.ts` bővítve: `specialTypes`, `specialTypesLoading`, `specialTypesError` state per `groupId`
- [ ] `fetchSpecialTypes(groupId)`, `createSpecialType(groupId, input)`, `updateSpecialType(groupId, typeId, input)`, `deactivateSpecialType(groupId, typeId)` akciók

**API client:**
- [ ] `api.groups.specialTypes.list(token, groupId)`
- [ ] `api.groups.specialTypes.create(token, groupId, input)`
- [ ] `api.groups.specialTypes.update(token, groupId, typeId, input)`
- [ ] `api.groups.specialTypes.deactivate(token, groupId, typeId)`
- [ ] `api.groups.specialTypes.setAnswer(token, groupId, typeId, correctAnswer)`

**Helyes válasz rögzítése:**
- [ ] Lezárt (határidő lejárt) típusoknál megjelenik egy „Helyes válasz rögzítése" gomb
- [ ] Gombra megnyíló input mező + mentés: `PUT /api/groups/:groupId/special-types/:typeId/answer`
- [ ] Sikeres rögzítés után a listában megjelenik a helyes válasz és a pontszámítás lezárt állapot

**Tesztek:**
- [ ] `GroupDetailView` meglévő tesztek zöldek maradnak
- [ ] Új tesztek: típuslista megjelenik, üres állapot, form megnyílik, deaktiválás dialog, helyes válasz input
- [ ] Minimum 8 új unit teszt

### Technical Notes
- A form datetime-local input `value` formátumát ISO 8601-re kell konvertálni az API hívás előtt (`new Date(value).toISOString()`)
- A Options mező UX-a: egyszerűbb a vesszővel elválasztott szöveg (`textarea` + `split(',')`) mint a teljes tag-input, az MVP scope-hoz ez elegendő
- A szekció feletti állapot jelzők: betöltés spinner, hiba üzenet — azonos minta mint a többi tab szekció

**Komplexitás:** M
**Prioritás:** Should Have
**Függőség:** US-901-A, US-901-B, US-901-C, US-901-D

---

## US-902-B – Frontend: Tag stat tipp leadási UI

### User Story
"As a group member,
I want to see and answer stat prediction questions in my group's leaderboard tab,
so that I can participate in statistical predictions alongside match predictions."

### Acceptance Criteria

**Megjelenés és elhelyezés:**
- [ ] A `GroupDetailView` Ranglista tabján a ranglista tábla ALATT megjelenik egy „Statisztikai tippek" szekció, ha a csoportban van legalább egy aktív típus
- [ ] Ha nincs egyetlen aktív típus sem: a szekció nem jelenik meg (nem üres állapot kártya, csak teljesen rejtve)
- [ ] A szekció betöltéskor meghívja `GET /api/groups/:groupId/special-predictions`

**Tipp kártyák:**
- [ ] Minden aktív típushoz egy tipp kártya jelenik meg: típus neve, leírása (ha van), határidő, maximális pontszám
- [ ] Határidő megjelenítése: „Határidő: 2026. jún. 10. 20:00" — ha lejárt: szürke + „Lezárva" badge
- [ ] Ha van már leadott tipp: az aktuális válasz megjelenik a kártyán
- [ ] Ha nincs tipp és a határidő nem járt le: szerkeszthető input megjelenik

**Tipp leadás:**
- [ ] `inputType = 'text'`: text input mező, max 500 karakter
- [ ] `inputType = 'dropdown'`: `<select>` elem az `options` tömbből töltve
- [ ] Mentés gomb: POST kérés, loading állapot, `saveStatus` visszajelzés: „Tipp elmentve!"
- [ ] Hálózati hiba esetén: „Hiba a mentés során" inline hibaüzenet a kártyán
- [ ] Határidő lejárta után az input disabled + „Tippelés lezárva" szöveg

**Kiértékelt tippek:**
- [ ] Ha a `points` mező nem null: megjelenik a kapott pontszám a kártyán (pl. „5 / 5 pont" vagy „0 / 5 pont")
- [ ] Ha a `correctAnswer` ismert (a backend visszaadja a típus adataival együtt): megjelenik a helyes válasz

**Store:**
- [ ] `groups.store.ts` bővítve: `mySpecialPredictions`, `specialPredictionsLoading`, `specialPredictionsError` state per `groupId`
- [ ] `fetchMySpecialPredictions(groupId)`, `upsertSpecialPrediction(groupId, typeId, answer)` akciók

**API client:**
- [ ] `api.groups.specialPredictions.list(token, groupId)`
- [ ] `api.groups.specialPredictions.upsert(token, groupId, input)`

**Tesztek:**
- [ ] Tipp kártya megjelenik aktív típussal, üres állapot (nincs típus → szekció rejtve), dropdown input opciók, text input, saveStatus visszajelzés, lezárt állapot (disabled input), kiértékelt pontszám megjelenítése
- [ ] Minimum 8 új unit teszt

### Technical Notes
- A `GET /api/groups/:groupId/special-predictions` response tartalmaz minden aktív típust, akár van a usernek tippje rá, akár nem (LEFT JOIN) — a frontend ebből tudja, melyik kártyán kell inputot mutatni
- A `correctAnswer` csak akkor kerül a response-ba, ha a határidő lejárt VAGY a `points` már be van állítva — ezt a backend kontrollálja (ne szivárogjon ki a válasz a határidő előtt)
- A szekció `onMounted` hívja a `fetchMySpecialPredictions`-t, párhuzamosan a ranglista fetch-csel

**Komplexitás:** M
**Prioritás:** Should Have
**Függőség:** US-901-A, US-901-B, US-901-C, US-901-D

---

## Érintett fájlok (összesítés)

**Backend (új fájlok):**
- `packages/backend/src/services/special-prediction-types.service.ts`
- `packages/backend/src/services/special-predictions.service.ts`
- `packages/backend/src/services/special-prediction-evaluation.service.ts`
- `packages/backend/src/routes/special-predictions.routes.ts`

**Backend (módosítandó fájlok):**
- `packages/backend/src/db/schema/index.ts` — groupId FK, relations frissítés
- `packages/backend/src/db/migrations/0009_special_prediction_types_group_id.sql` — generálandó
- `packages/backend/src/app.ts` — új router csatolása
- `packages/backend/src/services/group-leaderboard.service.ts` — stat pont integráció

**Frontend (módosítandó fájlok):**
- `packages/frontend/src/views/GroupDetailView.vue` — két új szekció (admin konfig + tag tipp UI)
- `packages/frontend/src/stores/groups.store.ts` — új state és akciók
- `packages/frontend/src/api/index.ts` — új API client metódusok
- `packages/frontend/src/types/index.ts` — `SpecialPredictionType`, `SpecialPrediction`, `SpecialPredictionWithType`, `LeaderboardEntry` frissítés

---

## Nyitott kérdések és rögzített döntések

| Kérdés | Döntés |
|--------|--------|
| A `correctAnswer` mikor válik láthatóvá a tagoknak? | Csak határidő lejárta vagy pontszámítás után (backend kontrollálja) |
| A stat pontok beleszámítanak-e a globális ranglistába? | Nem — csak a csoport ranglistában összegzett (`specialPredictions.points`) |
| Részleges pont lehetséges-e? | Nem — vagy `maxPoints` vagy 0 (binális kiértékelés) |
| Több helyes válasz lehetséges-e (pl. szinonimák)? | Nem az MVP-ben — az admin egy helyes választ ad meg, a normalizálás kezeli a kis/nagybetű és ékezet különbségeket |
| A tag látja-e mások válaszait a határidő előtt? | Nem — a `GET /api/groups/:groupId/special-predictions` csak a saját tippeket adja vissza |
