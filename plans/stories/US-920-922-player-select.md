# Player Select – Implementálható User Story-k

> Lebontás dátuma: 2026-04-24
> Kapcsolódó US-ok: US-910 (team_select input típus), US-911 (sablon tipp típusok)
> Függőség: US-901-A..E, US-902-A..B mind kész

---

## Implementálási sorrend

1. **US-920** – `players` tábla + admin CRUD (backend + frontend)
2. **US-921** – `player_select` input típus (backend validáció + frontend combobox + kiértékelés)
3. **US-922** – Gólkirály sablon átállítása `player_select`-re

US-921 **csak US-920 után** kezdhető — a player UUID validáció a `players` táblát igényli.
US-922 **csak US-921 után** kezdhető — az inputType értéknek már validnak kell lennie.

---

## US-920 – Játékosok kezelése (admin)

### Felhasználói story

"Mint **platform admin**,
szeretnék **játékosokat felvenni, szerkeszteni és törölni az admin panelen**,
hogy **a csoport adminok a stat tippeknél játékosnév-választót konfigurálhassanak anélkül, hogy seed scriptet kellene futtatni**."

### Elfogadási kritériumok

**Adatbázis:**
- [ ] Új `players` tábla a Drizzle schemában: `id` (UUID PK), `name` (varchar 100, not null), `teamId` (UUID FK → `teams.id`, nullable), `position` (varchar 30, nullable), `shirtNumber` (smallint, nullable), `createdAt`, `updatedAt`
- [ ] Index: `players_team_id_idx` a `teamId` oszlopon
- [ ] Drizzle migráció generálva (`npm run db:generate`), fájl elnevezve szabályosan
- [ ] A migráció idempotens módon alkalmazható kétszer futtatva is

**Backend:**
- [ ] `players.service.ts`: `getPlayers(teamId?: string): Player[]`, `getPlayerById(id): Player`, `createPlayer(input): Player`, `updatePlayer(id, input): Player`, `deletePlayer(id): void`
- [ ] `AppError` pattern a service-ben: 404 ha nem található, 409 ha FK violation (`23503`)
- [ ] `Player` és `PlayerInput` interface a `packages/backend/src/types/index.ts`-ben
- [ ] `GET /api/admin/players` — opcionális `?teamId=` query filter — `authMiddleware + adminMiddleware`
- [ ] `GET /api/admin/players/:id` — `authMiddleware + adminMiddleware`
- [ ] `POST /api/admin/players` — `authMiddleware + adminMiddleware`, 201 válasz
- [ ] `PUT /api/admin/players/:id` — `authMiddleware + adminMiddleware`
- [ ] `DELETE /api/admin/players/:id` — `authMiddleware + adminMiddleware`, 204 válasz
- [ ] Az endpointok regisztrálva az `admin.routes.ts`-ben
- [ ] Backend unit tesztek: CRUD műveletek, 404 eset, teamId filter

**Frontend:**
- [ ] `Player` és `PlayerInput` típusok a frontend `src/types`-ban (vagy `api/index.ts`-ben)
- [ ] `api.admin.players.list(token, teamId?)`, `create(token, input)`, `update(token, id, input)`, `delete(token, id)` metódusok az `api/index.ts`-ben
- [ ] `admin-players.store.ts` Pinia store: `players`, `loading`, `error` state; `fetchPlayers(teamId?)`, `createPlayer(input)`, `updatePlayer(id, input)`, `deletePlayer(id)` akciók
- [ ] `AdminPlayersView.vue`: táblázat (játékos neve, csapat neve, poszíció, mezszám, szerkesztés/törlés gombok); inline create/edit form (név, csapat dropdown a meglévő `teams` listából, poszíció, mezszám); törlés confirm dialog; csapat szerinti szűrő dropdown a lista felett
- [ ] `/admin/players` route — `requiresAuth + requiresAdmin`
- [ ] Admin pill tab navigáció kiegészítve "Játékosok" tabbal (az összes admin nézetben)
- [ ] Frontend unit tesztek: store fetch/create/update/delete, `AdminPlayersView` renderelés és form submit

**Hibaesetek:**
- [ ] Üres `name` → validáció a frontenden (required mező), backend 400
- [ ] Nem létező `teamId` küldésekor → backend 409 FK error → frontend hibaüzenet
- [ ] Törlés: ha a játékos UUID-ja `correct_answer`-ként van rögzítve egy `special_prediction_types`-ban → csak figyelmeztetés (nem blokkol), a delete végrehajtódik

### Érintett fájlok

```
packages/backend/src/db/schema/index.ts            (players tábla + relations)
packages/backend/src/db/migrations/XXXX_players.sql
packages/backend/src/types/index.ts                (Player, PlayerInput)
packages/backend/src/services/players.service.ts   (ÚJ)
packages/backend/src/routes/admin.routes.ts        (új endpointok)
packages/frontend/src/api/index.ts                 (api.admin.players.*)
packages/frontend/src/stores/admin-players.store.ts (ÚJ)
packages/frontend/src/views/AdminPlayersView.vue   (ÚJ)
packages/frontend/src/router/index.ts              (/admin/players route)
packages/frontend/src/views/AdminTeamsView.vue     (+ többi admin nézet: tab nav bővítés)
```

### Megjegyzések

- A `players.service.ts` a `teams.service.ts` mintáját követi: `AppError` osztály, `toApiPlayer()` mapper, Drizzle `eq()` szűrés
- A `teamId` nullable — egy játékos létrehozható csapat nélkül is (pl. edző, kapus jelölt még nem besorolt csapatnál)
- Soft delete **nem szükséges** a `players` táblán — az egyszerűbb hard delete elegendő; az FK kötésnél a `specialPredictionTypes.correctAnswer` csak szöveg (UUID), nem FK, így a törlés nem blokkol DB szinten
- A csapat dropdown az `api.admin.teams.list()` eredményét tölti be (azonos minta mint az `AdminMatchesView` csapat select-jénél)

**Prioritás:** Should Have
**Komplexitás:** M

---

## US-921 – `player_select` input típus stat tippekhez

### Felhasználói story

"Mint **csoport admin és csoport tag**,
szeretnék **stat tipp típusoknál `player_select` input módot használni**,
hogy **a gólkirály és hasonló tippekben a tagok egy kereshető játékoslistából válasszanak, ne szövegesen gépeljenek**."

### Elfogadási kritériumok

**Backend – validáció és kiértékelés:**
- [ ] `SpecialPredictionInputType` union type kibővítve: `'text' | 'dropdown' | 'team_select' | 'player_select'` a `packages/backend/src/types/index.ts`-ben
- [ ] `specialPredictionInputTypeEnum` a Drizzle schemában már tartalmazza a `'player_select'` értéket (a `0009_special_prediction_types_group_id.sql` migráció már alkalmazta) — nincs új migráció szükséges
- [ ] `POST /api/groups/:groupId/special-prediction-types` és `PUT` — `inputType: 'player_select'` elfogadva; validálja, hogy az `options` mező ilyenkor `null` (player_select esetén nincs options lista)
- [ ] `POST /api/groups/:groupId/special-predictions` — `player_select` típusnál az `answer` értéke player UUID-nak kell lennie; validálja, hogy a megadott UUID létezik a `players` táblában → érvénytelen UUID: 422
- [ ] `PUT /api/groups/:groupId/special-prediction-types/:typeId/evaluate` — `correctAnswer` értéke player UUID; validálja a players táblában → érvénytelen UUID: 422; a pontszámítás logikája változatlan (pontos egyezés = teljes pont)
- [ ] `GET /api/groups/:groupId/special-predictions/mine` — `player_select` típusnál az `answer` mellé visszaadja a játékos nevét és csapatát is (`answerLabel: string | null` mező a response-ban)
- [ ] Backend unit tesztek: player UUID validáció érvényes/érvénytelen UUID-dal, kiértékelés helyes/helytelen player UUID-dal

**Frontend – `PlayerSelectCombobox` komponens:**
- [ ] `PlayerSelectCombobox.vue` komponens (`src/components/predictions/`) — fogad `modelValue: string | null` (player UUID) és `groupId: string` propot
- [ ] A komponens betölti a csoport statisztikai tipp típusához tartozó játékoslistát: `GET /api/groups/:groupId/players` (lásd backend endpoint alább)
- [ ] Kereshető combobox: szöveg beírásakor a lista szűrődik (játékos neve + csapat neve alapján, case-insensitive)
- [ ] A lenyíló listában minden sor: "Játékos neve (Csapat shortCode)" formátum
- [ ] Nincs találat esetén: "Nincs ilyen játékos" üres állapot
- [ ] Kiválasztott érték: a `modelValue` UUID; a displayben a játékos neve látszik
- [ ] Törlés/visszaállítás: az X gombra a `modelValue` null-ra áll

**Backend – játékoslista lekérdezés csoport kontextusban:**
- [ ] `GET /api/groups/:groupId/players` — `authMiddleware` + csoport tagság ellenőrzés; visszaadja az összes játékost (id, name, teamId, teamName, teamShortCode, position, shirtNumber); nem szükséges szűrés: a combobox kliens oldalon szűr
- [ ] Az endpoint publikus a csoport tagok számára (nem csak admin)

**Frontend – stat tipp leadási UI:**
- [ ] `GroupDetailView.vue` stat tipp szekciójában: `player_select` típusú tipp esetén a szöveg input helyett `PlayerSelectCombobox` jelenik meg
- [ ] Elmentett tipp megjelenítésénél (`answer` UUID → játékos neve): a `SpecialPredictionWithType` response-ban lévő `answerLabel` mező alapján rendereli ki a nevet (nem UUID-t)
- [ ] Ha az `answerLabel` null (pl. a játékos törölve lett), fallback: az UUID rövidítve vagy "Ismeretlen játékos"

**Frontend – admin kiértékelő UI:**
- [ ] Az admin kiértékelő formban (`GroupDetailView.vue` evaluate dialog) `player_select` típusnál a helyes válasz szöveg inputja helyett szintén `PlayerSelectCombobox` jelenik meg
- [ ] A kiértékelés után a `correctAnswer` UUID-ot tárolja a DB; a megjelenítésnél a `answerLabel` logika alkalmazandó

**Hibaesetek:**
- [ ] Helytelen formátumú `answer` (nem UUID): backend 422, frontend "Érvénytelen játékos azonosító" hibaüzenet
- [ ] `player_select` típusnál `options` mező megadása esetén: backend 400 "player_select type does not accept options"
- [ ] A játékosnév-keresés közben hálózati hiba: "Nem sikerült betölteni a játékoslistát" hibaüzenet a combobox alatt

### Érintett fájlok

```
packages/backend/src/types/index.ts                    (SpecialPredictionInputType bővítés, SpecialPredictionWithType answerLabel mező)
packages/backend/src/services/special-prediction-types.service.ts   (player_select validáció)
packages/backend/src/services/special-predictions.service.ts        (answer UUID validáció, answerLabel join)
packages/backend/src/routes/groups.routes.ts            (GET /api/groups/:groupId/players endpoint)
packages/frontend/src/components/predictions/PlayerSelectCombobox.vue  (ÚJ)
packages/frontend/src/api/index.ts                      (api.groups.players(token, groupId))
packages/frontend/src/views/GroupDetailView.vue         (player_select ág a tipp és kiértékelő UI-ban)
```

### Megjegyzések

- A `PlayerSelectCombobox` a `team_select` input típus meglévő UI megközelítését követi: különálló komponens, `v-model` alapú, prop-driven
- A játékosnév-feloldás (UUID → megjelenített szöveg) a `answerLabel` mezőn keresztül szerver oldalon történik, nem a frontenden — ez megakadályozza a "stale UUID" problémát (ha a játékost átnevezik)
- A `GET /api/groups/:groupId/players` endpoint nem paginálja az eredményt — a játékosok száma várhatóan nem haladja meg a néhány százat
- Combobox megvalósítás: natív HTML `<input>` + `<datalist>` helyett `<input>` + `v-show` dropdown (a datalist böngésző-kompatibilitása korlátozott Tailwind stílusokkal); könyvtár ne legyen hozzáadva

**Prioritás:** Should Have
**Komplexitás:** M

---

## US-922 – Gólkirály sablon átállítása `player_select`-re

### Felhasználói story

"Mint **platform admin**,
szeretnék **a beépített 'Gólkirály' stat tipp sablon inputType értékét `text`-ről `player_select`-re módosítani**,
hogy **az adminok a csoportjukban automatikusan a jobb UX-ű játékos-választót kapják a gólkirály tipphez**."

### Elfogadási kritériumok

**Backend – sablon konstans:**
- [ ] A `SPECIAL_PREDICTION_TEMPLATES` konstans (vagy hasonló nevű preset lista) a `Gólkirály` bejegyzésénél az `inputType` értéke `'text'`-ről `'player_select'`-re változik
- [ ] A sablonnál az `options` mező `null` marad (player_select nem igényel options-t)
- [ ] A konstans fájl típusellenőrzése (`tsc`) zöld marad a változás után

**Frontend – sablon konfig UI:**
- [ ] Admin stat tipp típus létrehozó formban (`GroupDetailView.vue` vagy `AdminStatTypesView.vue`): ha a felhasználó a "Gólkirály" sablont választja ki, az inputType dropdown automatikusan `player_select`-re áll, és az options szekció elrejtésre kerül
- [ ] Az inputType dropdown manuálisan visszaállítható `text`-re (a sablon csak alapértéket ad, nem zárolja le)
- [ ] A sablon leírása (description) és pontszám értéke nem változik

**Visszafelé kompatibilitás:**
- [ ] Meglévő `special_prediction_types` rekordok amelyek `inputType = 'text'` értékkel tárolódtak a DB-ben, érintetlenek maradnak — csak az újonnan létrehozandó típusoknál érvényesül az új alapérték
- [ ] Ha egy csoportban korábban már `text` típusú Gólkirály tipp volt felvéve, az marad `text` típusú; az admin manuálisan módosíthatja

**Tesztek:**
- [ ] Unit teszt: a `SPECIAL_PREDICTION_TEMPLATES` konstansban a `Gólkirály` elem `inputType === 'player_select'`
- [ ] Frontend teszt: sablon kiválasztásakor a form állapota `inputType = 'player_select'`-re áll

### Érintett fájlok

```
packages/backend/src/constants/special-prediction-templates.ts   (vagy ahol a sablon lista él)
packages/frontend/src/constants/special-prediction-templates.ts  (frontend oldali sablon lista, ha külön létezik)
packages/frontend/src/views/GroupDetailView.vue                   (sablon alkalmazás logika)
```

### Megjegyzések

- Ez egy konfigurációs változtatás, nem séma-migráció — a DB enum már tartalmazza a `player_select` értéket
- Ha a sablon konstans csak a backenden létezik és a frontend REST API-n keresztül kéri le, akkor csak a backend konstans fájl módosul
- A story szándékosan kicsi: az US-921 implementálja az összes logikát, ez csak az alapértéket állítja át

**Prioritás:** Should Have
**Komplexitás:** S

---

## Összefoglaló

| Story | Függőség | Prioritás | Komplexitás |
|-------|----------|-----------|-------------|
| US-920 Játékosok kezelése (admin) | US-804 (teams CRUD minta) | Should Have | M |
| US-921 `player_select` input típus | US-920, US-902-A/B | Should Have | M |
| US-922 Gólkirály sablon átállítása | US-921 | Should Have | S |
