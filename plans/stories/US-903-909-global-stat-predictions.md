# E9-B – Globális/Fix Statisztikai Tippek

## Kontextus

A csoportszintű stat tippek (US-901/902) már implementálva vannak. Ezek a story-k egy **új módot** vezetnek be: rendszeradmin által előre definiált, minden felhasználónak elérhető globális stat tippek (pl. Gólkirály, Világbajnok csapat), amelyek a **globális ranglistába** számítanak be.

**A jelenlegi `special_prediction_types` tábla `group_id` mezője `NOT NULL`** — ez a mód ezért nem kiegészítés, hanem schema-szintű változás, amelyet egy önálló DB migráció vezet be.

**Architekturális döntés:** A `group_id` nullable lesz. Ha `group_id IS NULL`, a tipp globális. Ez minimalizálja az érintett kód mennyiségét és újrahasználja a meglévő táblastruktúrát. Egy új `is_global` boolean flag helyett a null érték az egyértelmű jelző.

**Játékos kiválasztása:** Nincs `players` tábla a projektben. A legegyszerűbb megközelítés: az admin a típust `team_select` `inputType`-szal hozza létre csapatoknál (ezek a `teams` táblából jönnek), `text` inputType-szal pedig szabadszöveges játékosnévnél — a `text` inputType elegendő a Gólkirály use case-hez, akárcsak a csoport szintű tippek esetén.

**Pontozás:** A globális stat tippek pontjai a `specialPredictions.points` mezőbe kerülnek, a globális ranglista service pedig kibővül ezek összegzésével.

---

## US-903 — DB migráció: group_id nullálhatóvá tétele a special_prediction_types táblán

**Leírás:**
Mint **fejlesztő**, szeretnék a `special_prediction_types.group_id` mezőt `nullable`-lé tenni, hogy az `IS NULL` érték jelölje a globális (nem csoporthoz kötött) tipp típusokat.

**Elfogadási kritériumok:**
- [ ] Drizzle schema: `specialPredictionTypes.groupId` mező megváltozik `notNull()`-ről nullable-re
- [ ] Drizzle migráció generálva és elnevezve: `0010_global_special_prediction_types.sql`
- [ ] A migráció tartalmaz `ALTER TABLE special_prediction_types ALTER COLUMN group_id DROP NOT NULL` utasítást
- [ ] Az `spt_group_idx` index megmarad (nullable mezőn is hatékony)
- [ ] `specialPredictionTypesRelations` nem változik (a `one(groups, ...)` reláció nullable FK-n is működik)
- [ ] Az összes meglévő teszt (US-901/902 tesztjei) változatlanul zöld marad

**Szélső esetek:**
- A meglévő csoporthoz kötött típusok `group_id`-ja nem változik — visszamenőleges kompatibilitás garantált
- A migráció éles DB-re is biztonságosan futtatható, mert csak egy constraint enyhítése történik (NOT NULL eltávolítása)

**Prioritás:** Should Have
**Komplexitás:** S
**Függőség:** US-901-A (már kész)

---

## US-904 — Backend: Globális stat tipp típus CRUD (platform admin)

**Leírás:**
Mint **platform admin**, szeretnék globális stat tipp típusokat létrehozni, szerkeszteni és deaktiválni az admin API-n keresztül, hogy előre definiálhassam a VB-hez kapcsolódó statisztikai kérdéseket minden felhasználó számára.

**Elfogadási kritériumok:**

*Endpoint-ok (mind `authMiddleware + adminMiddleware` mögött):*
- [ ] `GET /api/admin/special-types` — 200: az összes globális (`group_id IS NULL`) aktív típus listája
- [ ] `POST /api/admin/special-types` — 201: új globális típus létrehozva; `groupId` értéke `null`
- [ ] `PUT /api/admin/special-types/:typeId` — 200: frissítve; 404 ha nem létezik vagy nem globális
- [ ] `DELETE /api/admin/special-types/:typeId` — 204: `isActive = false` (soft deaktiválás); 404 ha nem létezik vagy nem globális

*Validáció:*
- [ ] `name`: kötelező, max 100 karakter
- [ ] `inputType`: `'text'`, `'dropdown'`, vagy `'team_select'`; más érték 400-at ad
- [ ] `options`: ha `inputType = 'dropdown'`, kötelező (min. 2 elem, max 20 elem); `text` és `team_select` esetén null/hiányzó
- [ ] `deadline`: kötelező, ISO 8601, jövőbeli időpont létrehozáskor
- [ ] `points`: kötelező, integer 1–100

*Service:*
- [ ] `packages/backend/src/services/global-special-prediction-types.service.ts` létrehozva
- [ ] `listGlobalTypes()` — szűr: `group_id IS NULL AND is_active = true`
- [ ] `createGlobalType(input)` — `groupId: null`
- [ ] `updateGlobalType(typeId, input)`
- [ ] `deactivateGlobalType(typeId)`
- [ ] Minden metódus dob `AppError(404)` ha a `typeId` nem globális típusra mutat

*Routes:*
- [ ] Az új route-ok az `admin.routes.ts`-be kerülnek

*Tesztek:*
- [ ] `global-special-prediction-types.service.test.ts`: min. 8 unit teszt

**Szélső esetek:**
- Ha egy `typeId` létezik, de `group_id IS NOT NULL` (csoportszintű), 404-et ad — nem keverhető a két scope
- A `team_select` inputType esetén az `options` mező null; az elérhető csapatok a `teams` táblából jönnek

**Prioritás:** Should Have
**Komplexitás:** M
**Függőség:** US-903

---

## US-905 — Backend: Globális stat tipp beküldése és lekérdezése (felhasználó)

**Leírás:**
Mint **bejelentkezett felhasználó**, szeretnék globális stat tippeket leadni és a korábban leadott tippjeimet visszakérdezni.

**Elfogadási kritériumok:**

*Endpoint-ok (mind `authMiddleware` mögött):*
- [ ] `GET /api/special-predictions` — 200: a bejelentkezett user összes globális stat tippje, a típus metaadatával együtt
- [ ] `POST /api/special-predictions` — 201/200: tipp beküldése vagy felülírása (`ON CONFLICT DO UPDATE` userId + typeId-n)

*Validáció:*
- [ ] `typeId`: létező, aktív, globális (`group_id IS NULL`) típus, különben 404
- [ ] `answer`: kötelező, max 500 karakter
- [ ] Ha `inputType = 'dropdown'`: az answer értéke szerepel az `options` tömbben, különben 400
- [ ] Ha `inputType = 'team_select'`: az answer egy létező csapat UUID-ja, különben 400
- [ ] Határidő ellenőrzés szerver-oldalon: `deadline < now()` esetén 409

*Service:*
- [ ] `packages/backend/src/services/global-special-predictions.service.ts` létrehozva
- [ ] `getMyGlobalPredictions(userId)` — LEFT JOIN: visszaadja az összes aktív globális típust akkor is, ha nincs még tipp

*Tesztek:*
- [ ] Min. 8 unit teszt

**Szélső esetek:**
- `team_select` esetén az `answer` csapat UUID-t tárol szövegként — a megjelenítési nevet a frontend a `teams` listából oldja fel
- A `correctAnswer` mező nem jelenik meg a GET response-ban, amíg a határidő le nem járt vagy a pontok be nem lettek állítva

**Prioritás:** Should Have
**Komplexitás:** M
**Függőség:** US-903, US-904

---

## US-906 — Backend: Globális stat tipp kiértékelése (platform admin)

**Leírás:**
Mint **platform admin**, szeretnék egy globális stat tipp típushoz helyes választ rögzíteni, és a rendszer automatikusan számítsa ki minden felhasználó pontjait.

**Elfogadási kritériumok:**
- [ ] `PUT /api/admin/special-types/:typeId/answer` — body: `{ correctAnswer: string }`
- [ ] A `correctAnswer` beállítása után azonnal lefut a pontszámítás az összes érintett `specialPredictions` sorra
- [ ] Idempotens: újra meghívva a pontok felülíródnak
- [ ] `evaluateSpecialPrediction()` pure function **újrafelhasználva** az US-901-D-ből
- [ ] `team_select` inputType esetén: `answer === correctAnswer` (UUID összehasonlítás)
- [ ] `text`/`dropdown` esetén: normalizált összehasonlítás (trim + toLowerCase + NFD)

*Tesztek:*
- [ ] Min. 6 unit teszt

**Szélső esetek:**
- Ha a `typeId` csoportszintű típusra mutat, 404-et ad
- Ha a `correctAnswer`-t módosítják, a pontok újraszámolódnak

**Prioritás:** Should Have
**Komplexitás:** M
**Függőség:** US-903, US-904, US-905, US-901-D (már kész)

---

## US-907 — Backend: Globális ranglista integráció (stat tipp pontok)

**Leírás:**
Mint **rendszer**, szeretnék a globális ranglistát kiegészíteni a globális stat tipp pontokkal.

**Elfogadási kritériumok:**
- [ ] `getLeaderboard()` módosítva: a `totalPoints` tartalmazza a stat tipp pontokat is, ahol a típus `group_id IS NULL`
- [ ] `specialPredictionPoints: number` mező a `LeaderboardEntry`-n (default 0)
- [ ] A rendezés figyelembe veszi a meccs + stat pontok összegét
- [ ] Ha nincs stat tipp, `specialPredictionPoints = 0`, a sor nem tűnik el
- [ ] Meglévő `getLeaderboard` tesztek zöldek + új tesztek

**Szélső esetek:**
- Csoportszintű stat tipp pontok NEM kerülnek a globális ranglistára

**Prioritás:** Should Have
**Komplexitás:** M
**Függőség:** US-903, US-905, US-906

---

## US-908 — Frontend: Admin globális stat tipp kezelő UI

**Leírás:**
Mint **platform admin**, szeretnék az admin felületen globális stat tipp típusokat kezelni.

**Elfogadási kritériumok:**
- [ ] Új admin tab: „Stat tippek" — `/admin/special-predictions`
- [ ] Típuslista: név, inputType badge, határidő, pont, státusz, műveletek
- [ ] Létrehozás/szerkesztés form: Név, Leírás, Típus (text/dropdown/team_select), Határidő, Pont
- [ ] `team_select` esetén az Options mező nem jelenik meg
- [ ] Helyes válasz rögzítése dialog: `team_select`-nél csapat dropdown, `text`/`dropdown`-nál text input
- [ ] Új Pinia store: `admin-special-predictions.store.ts`
- [ ] Min. 8 unit teszt

**Szélső esetek:**
- `team_select` inputType esetén a form beküldésekor az `answer` a csapat UUID-je

**Prioritás:** Should Have
**Komplexitás:** M
**Függőség:** US-903, US-904, US-906

---

## US-909 — Frontend: Globális stat tipp leadási UI (felhasználó)

**Leírás:**
Mint **bejelentkezett felhasználó**, szeretném a globális ranglistán a stat tippeket megtekinteni és megválaszolni.

**Elfogadási kritériumok:**
- [ ] A `LeaderboardView.vue`-ban a ranglistatábla ALATT „Statisztikai tippek" szekció (ha van aktív globális típus)
- [ ] Tipp kártyák: típus neve, leírás, határidő, max pont
- [ ] `text`: text input; `dropdown`: select; `team_select`: csapat dropdown (TeamBadge-dzsel)
- [ ] Mentés gomb → „Tipp elmentve!" visszajelzés
- [ ] Lejárt határidő: disabled input + „Tippelés lezárva"
- [ ] Kiértékelt tipp: pontszám megjelenítés
- [ ] `team_select` helyes válasznál csapatnév megjelenítés (UUID → teams store)
- [ ] Min. 8 unit teszt

**Szélső esetek:**
- Csapat lista betöltés: ha a matches store már tartalmazza, dupla API hívás kerülendő

**Prioritás:** Should Have
**Komplexitás:** M
**Függőség:** US-903, US-905, US-906, US-907

---

## Függőségi sorrend

```
US-903  (DB migráció: group_id nullable)
    └── US-904  (Backend: globális típus CRUD)
            └── US-905  (Backend: user tipp beküldés/lekérdezés)
                    └── US-906  (Backend: kiértékelés)
                            └── US-907  (Backend: globális ranglista integráció)
US-904 ──────────────────────── US-908  (Frontend: admin UI)
US-905, US-906, US-907 ──────── US-909  (Frontend: user UI)
```

## Döntések

| Kérdés | Döntés | Indoklás |
|--------|--------|----------|
| Külön tábla vagy nullable FK? | Nullable `group_id` | Minimális schema változás, meglévő kód érintetlen |
| Játékos kiválasztása? | `text` inputType + szabadszöves név | Nincs `players` tábla; NFD normalizálás kezeli ékezeteket |
| Csapat kiválasztása? | `team_select` inputType + csapat UUID | `teams` tábla már létezik; UUID egyezés egyszerűbb |
| Hol jelenik meg a user UI? | `LeaderboardView`-ban a ranglista alatt | Globális ranglista + globális stat tippek egymás mellett |
| `players` tábla szükséges? | Nem az MVP-ben | `text` inputType elegendő; bővíthető később |
