# Globális stat tipp típusok – Implementálható User Story-k

> Lebontás dátuma: 2026-04-27
> Kapcsolódó US-ok: US-901-A..E (stat tipp alap), US-902-A..B (stat tipp UI), US-910 (team_select), US-921 (player_select)
> Függőség: US-901-A..E és US-902-A..B mind kész

---

## Kontextus

Jelenleg minden stat tipp típus (`special_prediction_types`) egy konkrét csoporthoz tartozik (`groupId NOT NULL`). A csoport admin létrehozza, kiértékeli – minden csoport teljesen független. Ez azt jelenti, hogy ha 10 csoport is akar "Gólkirály" tippet, mind a 10 csoport adminjának egyenként kell kiértékelni ugyanazt a választ.

A tervezett megoldás: a platform admin globális típusokat hoz létre (pl. "Gólkirály", "Világbajnok csapat"). A csoport adminok ezeket feliratkozással "behúzzák" a saját csoportjukba. A platform admin egyszer értékeli ki a helyes választ, és az eredmény automatikusan minden feliratkozott csoportban pontokat ad.

A saját, csoport-specifikus tipp típusok (custom types) megmaradnak és zavartalanul működnek tovább.

---

## Implementálási sorrend

1. **US-925** – Séma bővítés, globális típusok platform admin CRUD (backend + frontend)
2. **US-926** – Csoport admin feliratkozás / leiratkozás globális típusokra (backend + frontend)
3. **US-927** – Globális kiértékelés: helyes válasz egyszeri rögzítése + pontszámítás minden érintett csoportban

US-926 **csak US-925 után** kezdhető — a junction tábla és a globális típus entitás szükséges.
US-927 **csak US-926 után** kezdhető — a feliratkozott csoportok azonosítása a junction táblán múlik.

---

## US-925 – Globális stat tipp típusok (platform admin CRUD)

### Felhasználói story

"Mint **platform admin**,
szeretnék **globális stat tipp típusokat létrehozni, szerkeszteni és inaktiválni az admin panelen**,
hogy **a csoport adminok ezeket feliratkozással használhassák a saját csoportjukban, és ne kelljen minden csoportban külön konfigurálni ugyanazt a tipp típust**."

### Elfogadási kritériumok

**Adatbázis:**
- [ ] A `special_prediction_types` tábla `groupId` oszlopa nullable-re változik (`uuid('group_id').references(() => groups.id, { onDelete: 'cascade' })` — a `notNull()` eltávolítva)
- [ ] Új `group_global_type_subscriptions` junction tábla a Drizzle schemában:
  - `id` (UUID PK)
  - `globalTypeId` (UUID FK → `special_prediction_types.id`, `onDelete: 'cascade'`, NOT NULL)
  - `groupId` (UUID FK → `groups.id`, `onDelete: 'cascade'`, NOT NULL)
  - `subscribedAt` (TIMESTAMPTZ NOT NULL, defaultNow)
  - Unique index: `(globalTypeId, groupId)`
  - Index: `globalTypeId`, `groupId` külön-külön is
- [ ] Új `isGlobal` boolean oszlop a `special_prediction_types` táblán: `NOT NULL DEFAULT false`
- [ ] DB invariáns (constraint szinten nem kényszerítve, service szinten igen): ha `isGlobal = true` akkor `groupId IS NULL`; ha `isGlobal = false` akkor `groupId IS NOT NULL`
- [ ] Drizzle migráció generálva, az összes meglévő rekord `isGlobal = false`, `groupId` változatlan marad
- [ ] A migráció idempotensen alkalmazható

**Backend:**
- [ ] `GlobalSpecialType` és `GlobalSpecialTypeInput` interface a `packages/backend/src/types/index.ts`-ben
  - `GlobalSpecialTypeInput`: `name`, `description?`, `inputType`, `options?`, `deadline`, `points`
  - `GlobalSpecialType`: fenti mezők + `id`, `isGlobal: true`, `groupId: null`, `correctAnswer`, `isActive`, `createdAt`, `updatedAt`
- [ ] `global-special-prediction-types.service.ts` (új fájl):
  - `listGlobalTypes(): GlobalSpecialType[]` — `isGlobal = true` szűrés
  - `createGlobalType(input, requesterId): GlobalSpecialType` — `groupId: null`, `isGlobal: true`
  - `updateGlobalType(typeId, input, requesterId): GlobalSpecialType` — csak ha `isGlobal = true`, egyébként 404
  - `deactivateGlobalType(typeId, requesterId): void` — `isActive = false`
- [ ] Validáció ugyanaz mint a meglévő `special-prediction-types.service.ts` `validateInput()` függvénye (újrafelhasználás vagy közös helper kiszervezés)
- [ ] `GET /api/admin/global-special-types` — `authMiddleware + adminMiddleware`
- [ ] `POST /api/admin/global-special-types` — `authMiddleware + adminMiddleware`, 201 válasz
- [ ] `PUT /api/admin/global-special-types/:typeId` — `authMiddleware + adminMiddleware`
- [ ] `DELETE /api/admin/global-special-types/:typeId` — `authMiddleware + adminMiddleware`, `isActive = false`-ra állítja (soft deactivate), 204 válasz
- [ ] Endpointok regisztrálva az `admin.routes.ts`-ben
- [ ] Backend unit tesztek: `listGlobalTypes`, `createGlobalType` (érvényes input, invalid inputType, lejárt deadline), `updateGlobalType` (nem létező id → 404), `deactivateGlobalType`

**Frontend:**
- [ ] `GlobalSpecialType` és `GlobalSpecialTypeInput` típusok a frontend `src/types`-ban
- [ ] `api.admin.globalSpecialTypes.list(token)`, `create(token, input)`, `update(token, id, input)`, `deactivate(token, id)` metódusok az `api/index.ts`-ben
- [ ] `admin-global-special-types.store.ts` Pinia store: `types`, `loading`, `error` state; `fetchTypes()`, `createType(input)`, `updateType(id, input)`, `deactivateType(id)` akciók
- [ ] `AdminGlobalStatTypesView.vue`: lista (típus neve, inputType badge, pontszám, deadline, aktív/inaktív jelzés, szerkesztés/inaktiválás gombok); inline create/edit form (név, leírás, inputType dropdown, options — csak dropdown esetén, deadline, pontszám); inaktiválás confirm dialog
- [ ] `/admin/global-stat-types` route — `requiresAuth + requiresAdmin`
- [ ] Admin pill tab navigáció kiegészítve "Globális stat tippek" tabbal (minden meglévő admin nézetben)
- [ ] Frontend unit tesztek: store fetch/create/update/deactivate, `AdminGlobalStatTypesView` renderelés és form submit

**Hibaesetek:**
- [ ] Üres `name` → frontend validáció (required mező), backend 400
- [ ] `inputType: 'dropdown'` és `options` < 2 elemű → backend 400
- [ ] `inputType: 'dropdown'` és `options` > 20 elemű → backend 400
- [ ] Múltbeli `deadline` → backend 400 "deadline must be in the future"
- [ ] Nem létező `typeId` PUT/DELETE esetén → backend 404
- [ ] Nem globális típus ID-val PUT/DELETE hívás → backend 404 (a service csak `isGlobal = true` rekordot talál meg)

### Érintett fájlok

```
packages/backend/src/db/schema/index.ts                          (groupId nullable, isGlobal oszlop, junction tábla + relations)
packages/backend/src/db/migrations/XXXX_global_special_types.sql
packages/backend/src/types/index.ts                              (GlobalSpecialType, GlobalSpecialTypeInput)
packages/backend/src/services/global-special-prediction-types.service.ts  (ÚJ)
packages/backend/src/routes/admin.routes.ts                      (új endpointok)
packages/frontend/src/api/index.ts                               (api.admin.globalSpecialTypes.*)
packages/frontend/src/stores/admin-global-special-types.store.ts (ÚJ)
packages/frontend/src/views/AdminGlobalStatTypesView.vue         (ÚJ)
packages/frontend/src/router/index.ts                            (/admin/global-stat-types route)
packages/frontend/src/views/AdminMatchesView.vue + többi admin nézet  (tab nav bővítés)
```

### Megjegyzések

- A `groupId` nullable-re állítása **migrációval elvégezhető, de az összes meglévő service-ben a `groupId` kezelést ellenőrizni kell**: a meglévő `special-prediction-types.service.ts` minden lekérdezésén a `groupId NOT NULL` feltétel implicit volt — a migráció után explicit `isGlobal = false` vagy `isNull(groupId)` szűrést kell hozzáadni ahol szükséges, nehogy globális típusok véletlenül megjelenjenek a csoport-specifikus listákban
- Az `isGlobal` boolean redundáns a `groupId IS NULL` feltétellel, de sokkal olvashatóbbá teszi a lekérdezéseket — az extra oszlop megéri
- A `global-special-prediction-types.service.ts` az `AppError` pattern és a `toApi()` mapper mintáját követi, pontosan mint a meglévő `special-prediction-types.service.ts`
- Az input validáció közös logikája kiszervezhető egy `validateSpecialTypeInput(input)` shared helper függvénybe (pl. `src/services/special-prediction-types.helpers.ts`)

**Prioritás:** Should Have
**Komplexitás:** M

---

## US-926 – Csoport admin feliratkozás globális stat tipp típusokra

### Felhasználói story

"Mint **csoport admin**,
szeretnék **platform szinten elérhető globális stat tipp típusokat feliratkozással aktiválni a csoportomban**,
hogy **a csoport tagjai tippelhessenek rájuk, és nekem ne kelljen ugyanazt a tipp típust manuálisan konfigurálni**."

### Elfogadási kritériumok

**Backend:**
- [ ] `GET /api/admin/global-special-types` visszaadja az összes aktív globális típust — elérhető csoport adminoknak is (nem csak platform adminnak), ehhez `authMiddleware` elegendő
- [ ] `POST /api/groups/:groupId/global-type-subscriptions` — `authMiddleware` + csoport admin ellenőrzés; body: `{ globalTypeId: string }`; 201 válasz; ha már feliratkozott → 409 "Already subscribed"
- [ ] `DELETE /api/groups/:groupId/global-type-subscriptions/:globalTypeId` — `authMiddleware` + csoport admin ellenőrzés; 204 válasz; ha nem volt feliratkozva → 404
- [ ] `GET /api/groups/:groupId/global-type-subscriptions` — `authMiddleware` + csoport tagság ellenőrzés; visszaadja a feliratkozott globális típusokat (a `GlobalSpecialType` struktúrával), beleértve az inaktív globális típusokat is (hogy az admin lássa, hogy egy típus inaktívvá vált platform szinten)
- [ ] `GET /api/groups/:groupId/special-prediction-types` (meglévő, US-901-B): a response kiegészül a feliratkozott globális típusokkal — a típuslista tartalmazza mind a csoport-specifikus custom típusokat, mind a feliratkozott globális típusokat; minden eleménél `isGlobal` mező jelzi a forrást
- [ ] Ha egy globális típus `isActive = false` lesz platform szinten, a feliratkozott csoportokban is inaktívként jelenik meg (a subscription nem törlődik, csak nem jelenik meg a tipp leadási UI-ban)
- [ ] Backend unit tesztek: subscribe (érvényes), subscribe (duplikált → 409), unsubscribe (érvényes), unsubscribe (nem feliratkozott → 404), listSubscriptions, `GET /api/groups/:groupId/special-prediction-types` vegyes lista (custom + globális)

**Frontend:**
- [ ] `api.groups.globalTypeSubscriptions.list(token, groupId)`, `subscribe(token, groupId, globalTypeId)`, `unsubscribe(token, groupId, globalTypeId)` metódusok az `api/index.ts`-ben
- [ ] `groups.store.ts` kiegészítése: `groupSubscriptions` map (`groupId → GlobalSpecialType[]`), `fetchGroupSubscriptions(groupId)`, `subscribeToGlobalType(groupId, globalTypeId)`, `unsubscribeFromGlobalType(groupId, globalTypeId)` akciók
- [ ] `GroupDetailView.vue` — "Stat tippek" tab (csak csoport admin számára látható szekció): "Globális tipp típusok" szekció — listázza az összes aktív globális típust platform szintről; minden sorban toggle (feliratkozott / nem feliratkozott); toggle-ra azonnali API hívás + store frissítés; betöltés közben loading state a toggle-on
- [ ] `GroupDetailView.vue` — "Stat tippek" tab (minden csoport tag számára): a feliratkozott globális típusok megjelennek a csoport-specifikus custom típusok mellett — forrás szerint vizuálisan megkülönböztetve (`isGlobal` alapján badge vagy jelölés)
- [ ] Ha egy feliratkozott globális típus `isActive = false` platform szinten: "Inaktív (platform szinten letiltva)" label jelenik meg, tipp leadás nem elérhető
- [ ] Frontend unit tesztek: store subscribe/unsubscribe, `GroupDetailView` globális típusok szekció renderelés, toggle

**Hibaesetek:**
- [ ] Subscribe nem létező `globalTypeId`-val → backend 404
- [ ] Subscribe inaktív globális típusra → backend 400 "Global type is not active"
- [ ] Csoport tag (nem admin) próbál feliratkozni → backend 403
- [ ] Hálózati hiba toggle közben → frontend a toggle állapota visszaáll az előző értékre, hibaüzenet jelenik meg

### Érintett fájlok

```
packages/backend/src/services/global-special-prediction-types.service.ts  (subscribe, unsubscribe, listSubscriptions)
packages/backend/src/services/special-prediction-types.service.ts          (listActiveTypes bővítve: custom + global merged lista)
packages/backend/src/routes/groups.routes.ts                               (új subscription endpointok)
packages/frontend/src/api/index.ts                                         (api.groups.globalTypeSubscriptions.*)
packages/frontend/src/stores/groups.store.ts                               (subscription state + akciók)
packages/frontend/src/views/GroupDetailView.vue                            (globális típusok szekció + tag UI bővítés)
```

### Megjegyzések

- A `GET /api/admin/global-special-types` endpoint jogosultságát ki kell bővíteni: a platform admin mellett csoport admin is elérheti — a route guard változzon `authMiddleware` + "csoport tag és admin" ellenőrzésre; a legegyszerűbb megoldás egy dedikált `GET /api/global-special-types` (platform szintű, publikus auth-olt endpoint) bevezetése az admin route külön tartásával
- A `listActiveTypes` service metódus (US-901-B) a merged listát a következő JOIN-nal oldja meg: `specialPredictionTypes WHERE groupId = :groupId AND isGlobal = false UNION ALL specialPredictionTypes WHERE isGlobal = true AND id IN (SELECT globalTypeId FROM group_global_type_subscriptions WHERE groupId = :groupId)`
- A "globális típus forrás" vizuális megkülönböztetése a frontenden elég egy kis badge-del (pl. "Platform" pill) — ne legyen túl komplex

**Prioritás:** Should Have
**Komplexitás:** M

---

## US-927 – Globális stat tipp kiértékelés és pontszámítás

### Felhasználói story

"Mint **platform admin**,
szeretnék **egy globális stat tipp típushoz egyszer rögzíteni a helyes választ**,
hogy **az eredmény automatikusan érvényesüljön minden csoportban, amelyik feliratkozott erre a típusra, és ne kelljen csoportonként külön kiértékelni**."

### Elfogadási kritériumok

**Backend:**
- [ ] `PUT /api/admin/global-special-types/:typeId/evaluate` — `authMiddleware + adminMiddleware`; body: `{ correctAnswer: string }`; menti a `correctAnswer`-t a `special_prediction_types` rekordon
- [ ] A kiértékelés lefuttatja a pontszámítást az összes feliratkozott csoportban: minden `group_global_type_subscriptions` rekordon végig iterál, ahol `globalTypeId = typeId`; minden csoportban lefuttatja az eddigi csoport-szintű pontszámítást a meglévő `special-predictions.service.ts` evaluate logikájára támaszkodva (az `evaluateType` függvény paraméterezve van `typeId`-vel — ez változatlan)
- [ ] A pontszámítás idempotens: ha korábban már volt `correctAnswer` és most felülírják (pl. javítás), az összes érintett csoport összes `special_predictions.points` értéke újraszámolódik
- [ ] `GET /api/admin/global-special-types` — a `correctAnswer` mező visszaadja az aktuális értéket (lehet null ha még nem értékelték ki)
- [ ] Audit log: `result_set` akció rögzítve az `audit_logs` táblában (`entityType: 'global_special_type'`, `entityId: typeId`, `newValue: { correctAnswer }`)
- [ ] Backend unit tesztek: evaluate (helyes válasz rögzítve, pontok kiosztva 2 feliratkozott csoport esetén), evaluate idempotens (helyes válasz módosítva → pontok újraszámolva), evaluate nem globális typeId-val → 404

**Frontend:**
- [ ] `AdminGlobalStatTypesView.vue`: minden globális típus sorában "Kiértékelés" gomb (platform admin számára) — megnyit egy dialog-ot a helyes válasz input mezőjével (az `inputType` alapján: text input, team select, player select combobox, dropdown select)
- [ ] Kiértékelés után a `correctAnswer` megjelenik a lista sorában (pl. "Helyes válasz: Kylian Mbappé")
- [ ] Ha már van `correctAnswer` és az admin ismét rákattint a "Kiértékelés" gombra: a dialog előtölti az aktuális helyes választ, és figyelmeztető üzenet jelenik meg: "Ez már ki lett értékelve. A módosítás minden feliratkozott csoportban újraszámolja a pontokat."
- [ ] `api.admin.globalSpecialTypes.evaluate(token, typeId, correctAnswer)` metódus az `api/index.ts`-ben
- [ ] `admin-global-special-types.store.ts`: `evaluateType(id, correctAnswer)` akció + `evaluateSaveStatus` map (`typeId → 'idle' | 'saving' | 'saved' | 'error'`)
- [ ] Frontend unit tesztek: `evaluateType` store akció, `AdminGlobalStatTypesView` kiértékelés dialog megnyitás és submit

**Hibaesetek:**
- [ ] Nem létező `typeId` → backend 404
- [ ] Nem globális típus ID-val hívás → backend 404
- [ ] Üres `correctAnswer` → backend 400 "correctAnswer is required"
- [ ] `inputType: 'player_select'` és a `correctAnswer` nem létező player UUID → backend 422 (az evaluate logika validálja a player UUID-t, US-921 mintájára)
- [ ] `inputType: 'team_select'` és a `correctAnswer` nem létező team UUID → backend 422
- [ ] Nincs feliratkozott csoport: a kiértékelés sikeres, a `correctAnswer` mentődik, pontszámítás nem fut (nincs mit számolni) — nem hiba
- [ ] A pontszámítás részlegesen sikerül (pl. DB hiba az egyik csoport feldolgozásakor): az egész művelet visszagörgetendő (tranzakció) — vagy ha tranzakció nem megvalósítható, az endpoint 500-at ad vissza és a hibát logolja

### Érintett fájlok

```
packages/backend/src/services/global-special-prediction-types.service.ts  (evaluateGlobalType)
packages/backend/src/services/special-predictions.service.ts              (evaluateType újrafelhasználva — paraméterezés ellenőrzendő)
packages/backend/src/routes/admin.routes.ts                               (PUT /api/admin/global-special-types/:typeId/evaluate)
packages/frontend/src/api/index.ts                                        (api.admin.globalSpecialTypes.evaluate)
packages/frontend/src/stores/admin-global-special-types.store.ts          (evaluateType akció)
packages/frontend/src/views/AdminGlobalStatTypesView.vue                  (kiértékelés dialog)
```

### Megjegyzések

- A pontszámítás hívási láncának áttekintése szükséges: a meglévő `evaluateType(groupId, typeId, requesterId, correctAnswer)` service függvény (US-901-D) feltehetőleg csoport-specifikusan fut; a globális kiértékelés ezt a függvényt fogja hívni minden feliratkozott `groupId`-ra iterálva — a függvény szignatúrája és logikája várhatóan változatlan marad
- Ha az iteráció sok csoportot érint, a DB terhelés megnőhet — Promise.all párhuzamos végrehajtással csökkenthető, de Railway single-instance-nél a sorban futás is elfogadható az MVP-hez
- A tranzakció-kezelés: Drizzle ORM támogatja a `db.transaction()` API-t; a `evaluateGlobalType` service metódus ideálisan egy tranzakcióban futtatja a `correctAnswer` mentését és az összes csoportban a pontszámítást; ha ez komplexnek bizonyul az MVP-hez, elfogadható hogy a `correctAnswer` mentése és a pontok kiosztása külön, egymást követő lépésként fut — de az idempotens újraszámítás ezt tolerálja

**Prioritás:** Should Have
**Komplexitás:** M

---

## Összefoglaló

| Story | Függőség | Prioritás | Komplexitás |
|-------|----------|-----------|-------------|
| US-925 Globális stat típusok platform admin CRUD | US-901-A..E, US-902-A..B | Should Have | M |
| US-926 Csoport admin feliratkozás globális típusokra | US-925 | Should Have | M |
| US-927 Globális kiértékelés és pontszámítás | US-926 | Should Have | M |

---

## Nyitott kérdések implementáció előtt

1. **`groupId` nullable migration backward compatibility**: Az összes meglévő lekérdezés a `special-prediction-types.service.ts`-ben implicit NOT NULL feltételt használ. A migráció előtt minden érintett service-t át kell vizsgálni — főleg a `listActiveTypes` és az `evaluateType` függvényeket.

2. **Globális típus és csoport custom deadline kezelés**: A globális típusnak van saját `deadline`-ja. Ha egy csoport feliratkozik rá, de a globális deadline már lejárt, a csoport tagjai nem tudnak tippelni. Ez a jelenlegi deadline-logika (backend: `deadline > now()` validáció tipp leadáskor) automatikusan kezeli — nincs külön teendő, de dokumentálni kell.

3. **Visszafelé kompatibilitás a `GET /api/groups/:groupId/special-prediction-types` endpointnál**: A meglévő frontend kód (US-902-B) ezt az endpointot hívja. Az US-926 bővíti a response-t globális típusokkal és `isGlobal` mezővel — ez additive változás, nem breaking, de a frontend kódban az `isGlobal` mező kezelést hozzá kell adni.
