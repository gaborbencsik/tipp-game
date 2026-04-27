# Wave 1 – Torna Tippek: Build-Ready User Story-k

> Státusz: Ready – 2026-04-27
> Epic: E9 – Torna Tippek
> Scope: Must Have / Wave 1 (VB indulás előtt, ~5 hét)
> Becsült össz effort: ~2–3 fejlesztői nap

---

## Tartalom

1. [US-930 – Átnevezés: "Torna tippek" tab + "Hivatalos" badge](#us-930)
2. [US-931 – Határidő sürgősségi jelzés](#us-931)
3. [US-932 – Új csoportok automatikus feliratkozása Hivatalos típusokra](#us-932)
4. [US-933 – Badge counter a "Torna tippek" tabon](#us-933)
5. [US-934 – Mások tippjeinek megjelenítése határidő után (aggregált)](#us-934)
6. [BUG-002 – correctAnswer nyers UUID megjelenítés javítása](#bug-002)

---

## US-930

### Cím

Átnevezés: "Stat tippek" tab → "Torna tippek" + "Platform" badge → "Hivatalos"

### User Story

Mint csoporttag, szeretném, hogy a csoport oldal tabján "Torna tippek" felirat álljon és a típuskártyákon "Hivatalos" badge látsszon, hogy az alkalmazás szövegezése érthető legyen zsargon helyett.

### Elfogadási kritériumok

1. A `GroupDetailView.vue` tab barjában a `data-testid="tab-special"` gombon megjelenő szöveg "Stat tippek" helyett "Torna tippek".
2. A Torna tippek tab üres állapot szövege ("Ebben a csoportban még nincsenek stat tippek.") átnevezésre kerül: "Ebben a csoportban még nincsenek torna tippek."
3. A tagoknak megjelenő kártyán (`v-if="activeTab === 'special'"` szekció) a `v-if="sp.isGlobal"` badge szövege "Platform" helyett "Hivatalos".
4. A badge háttérszíne változatlan marad (jelenlegi: `bg-purple-100 text-purple-700`).
5. A Beállítások tabon az admin "Globális torna tippek" szekció fejléce (jelenlegi: "Globális stat tipp típusok" vagy hasonló) és az alatta lévő leírás szövege egységesen "Hivatalos torna tipp típusok" nevet kap.
6. Az admin "Stat tipp típusok" szekció fejléce ("Stat tipp típusok kezelése") átnevezésre kerül: "Egyedi torna tipp típusok".
7. Az admin "+ Új stat tipp típus" gomb szövege: "+ Új torna tipp típus".
8. A form üres állapot szövege ("Még nincs stat tipp típus.") átírva: "Még nincs egyedi torna tipp típus."
9. Az URL (`/app/groups/:id`), a route név, a Pinia store neve, a TypeScript típusnevek és a backend API endpoint nevek nem változnak.
10. A ranglista táblázat `<th>` fejlécében a "Stat" szöveg (sor ~66, `title="Stat tipp pontok"`) átnevezésre kerül: "Torna" (`title="Torna tipp pontok"`).
11. Az összes meglévő teszt (frontend + backend) változtatás nélkül zöldben marad.

### Edge case-ek

- Azon tesztek, amelyek a "Stat tippek" string-et keresik a DOM-ban, frissítésre szorulnak az új "Torna tippek" szövegre. Minden érintett spec fájlban a string literált cseréld le.
- A `data-testid="tab-special"` attribútum értéke ne változzon — a tesztek erre hivatkoznak.

### Technikai megjegyzések

- Érintett fájl: `packages/frontend/src/views/GroupDetailView.vue`
  - Sor ~23: `"Stat tippek"` → `"Torna tippek"`
  - Sor ~442: üres állapot string cseréje
  - Sor ~453: `"Platform"` badge szöveg → `"Hivatalos"`
  - Sor ~311–312: admin szekció fejléc + leírás cseréje
  - Sor ~366: üres állapot szöveg cseréje (admin lista)
  - Sor ~389: gomb szöveg cseréje
- Keress rá a "stat tipp" és "Platform" string-ekre a fájlban, hogy egy átfutással megtaláld az összes előfordulást.
- Érintett spec fájlok: `GroupDetailView.spec.ts` és bármely más fájl, amely a régi szövegre hivatkozik.

### Hatókörön kívül

- DB-szintű átnevezés (`special_prediction_types` tábla neve változatlan).
- Backend API endpoint nevei változatlanok (`/api/groups/:id/special-predictions`, stb.).
- TypeScript típusnevek változatlanok (`SpecialPredictionWithType`, `SpecialPredictionType`, stb.).
- AppLayout sidebar szöveg (ha van ilyen hivatkozás) változatlan.

### Prioritás

**Must Have – Wave 1**

### Effort

**XS (~30 perc)**

### Függőségek

Nincs.

---

## US-931

### Cím

Határidő sürgősségi jelzés a torna tipp kártyákon (relatív idő + színkódolás)

### User Story

Mint csoporttag, szeretném, hogy a torna tipp kártyákon a határidő ne statikus dátumként, hanem relatív időként jelenjen meg ("3 nap múlva"), és színnel jelezze a sürgősséget, hogy ne maradjak le a tippelési lehetőségről.

### Elfogadási kritériumok

1. A Torna tippek tabon minden kártyán a "Határidő: [dátum]" szöveg helyett egy relatív időfelirat jelenik meg, a következő formátumban:
   - `>= 48 óra`: "N nap múlva" (szürke: `text-gray-500`)
   - `>= 2 óra és < 48 óra`: "N óra múlva" (amber: `text-amber-600 font-medium`)
   - `> 0 és < 2 óra`: "N perc múlva" (piros, pulzáló: `text-red-600 font-semibold animate-pulse`)
   - Lejárt (`<= 0`): lakat ikon (`🔒`) + "Lezárva" felirat (szürke: `text-gray-400`)
2. A relatív idő frissítése: 60 másodpercenként `setInterval`-lal (`onUnmounted`-ban tisztítva).
3. A relatív időfelirat a kártyán ott jelenik meg, ahol korábban a `formatDateTime(sp.deadline)` volt (a "Max N pont ·" melletti `<span>` elem).
4. Ha a határidő pontosan 1 napra van, a kiírás "1 nap múlva" (nem "24 óra múlva").
5. Ha a határidő lejárt és a tipp még nincs kiértékelve (`sp.points === null`), a kártyán a lakat ikon is megjelenik a "Kiértékelésre vár" szöveg mellett.
6. Az admin Beállítások tabon a típuslistában a határidő marad statikus formátumban (`formatDateTime`) – csak a tag tipp kártyákon kell a relatív idő.
7. A `formatRelativeDeadline(deadline: string, now: number): { label: string; cssClass: string }` helper pure function — a `now` paramétert kívülről kapja (nem hív `Date.now()`-t belülről), ezáltal unit tesztelhető. Nem hív API-t vagy DOM-ot.
8. Unit teszt: legalább 5 eset (`> 48h`, `1–48h`, `< 2h`, lejárt, pontosan 0).

### Edge case-ek

| Helyzet | Elvárt viselkedés |
|---------|-------------------|
| Pontosan 48 óra van hátra | `>= 48h` ág: szürke "2 nap múlva" |
| Pontosan 2 óra van hátra | amber ág: "2 óra múlva" |
| 90 perc van hátra | piros pulzáló: "90 perc múlva" |
| Lejárt 5 perccel ezelőtt | lakat + "Lezárva" szürke |
| A kiértékelés már megtörtént (`sp.points !== null`) | A határidő felirat nem látszik (a kiértékelt állapot blokk veszi át) |

### Technikai megjegyzések

- Érintett fájl: `packages/frontend/src/views/GroupDetailView.vue`
- Hozz létre egy `formatRelativeDeadline(deadline: string, now: number): { label: string; cssClass: string }` pure helper funkciót a view `<script setup>` blokkjában vagy külön `src/lib/deadline.ts` fájlban. A `now` paraméter kívülről jön, nem `Date.now()` belülről — ez teszi unit tesztelhetővé.
- A `setInterval` regisztrálása `onMounted`-ban, törlése `onUnmounted`-ban. Egy `ref<number | null>(null)` tárolhatja a timer ID-t.
- A komponens-szintű reaktivitáshoz: egy `now = ref(Date.now())` ref-et frissíts 60 másodpercenként; a `formatRelativeDeadline` ezt kapja paraméterként, nem `Date.now()`-t belülről — ez teszi unit tesztelhetővé.
- Az `animate-pulse` osztály Tailwind v4-ben is elérhető; CSS-first importnál nincs teendő.
- Tesztfájl: `packages/frontend/src/lib/deadline.test.ts` (vagy `.spec.ts`).

### Hatókörön kívül

- Push értesítés vagy email emlékeztető.
- Valós idejű visszaszámláló (másodperces frissítés).
- Az admin oldali kártyákon való megjelenítés.

### Prioritás

**Must Have – Wave 1**

### Effort

**S (~2–3 óra)**

### Függőségek

Nincs (US-930 nem blokkolja, de célszerű utána implementálni a kód kontextusa miatt).

---

## US-932

### Cím

Új csoportok automatikus feliratkozása minden aktív Hivatalos torna tipp típusra

### User Story

Mint csoport adminisztrátor, szeretném, hogy az általam létrehozott csoport automatikusan feliratkozzék minden létező Hivatalos torna tipp típusra, hogy ne kelljen manuálisan feliratkoznom minden egyes típusra a Beállítások tabon.

### Elfogadási kritériumok

1. A `createGroup` service függvény (`packages/backend/src/services/groups.service.ts`) a csoport és az első `groupMembers` sor létrehozása után lekérdezi az összes aktív globális stat tipp típust (`WHERE isGlobal = true AND isActive = true`).
2. Minden megtalált globális típushoz egy `groupGlobalTypeSubscriptions` sor kerül `INSERT`-elésre az új csoport ID-jával.
3. Az INSERT `onConflictDoNothing`-ot használ — ha valamilyen okból már létezne a sor, nem dob hibát.
4. Ha nincsenek aktív globális típusok (0 sor), a csoport létrehozása sikeresen lefut, feliratkozás nélkül.
5. Ha a globális típusok lekérdezése DB hibát dob, a csoport létrehozása sem sikerül — a teljes művelet egy tranzakcióban fut (vagy a hiba propagálódik és 500-at ad vissza).
6. A `createGroup` visszatérési értéke és a `POST /api/groups` endpoint válaszformátuma nem változik.
7. A frontend (Beállítások tab, globális feliratkozások toggle-lista) az automatikusan hozzáadott feliratkozásokat "Aktív" állapotban mutatja — az admin manuálisan le tud iratkozni, mint korábban.
8. Unit teszt: `createGroup` meghívásakor a `groupGlobalTypeSubscriptions` táblába N sor kerül, ahol N az aktív globális típusok száma (mock DB-vel vagy integrációs teszttel).
9. Unit teszt: ha nincs aktív globális típus, a `createGroup` hiba nélkül fut le.

### Edge case-ek

| Helyzet | Elvárt viselkedés |
|---------|-------------------|
| Nincsenek globális típusok a DB-ben | Normál csoport létrehozás, 0 feliratkozás |
| 1 globális típus létezik | 1 sor kerül a `groupGlobalTypeSubscriptions`-be |
| 5 globális típus létezik | 5 sor kerül be |
| A feliratkozás INSERT ütközik (már létezik) | `onConflictDoNothing` – nem dob hibát |
| Retroaktív feliratkozás (már meglévő csoportok) | Nem érintett – ez a story csak új csoportokra vonatkozik |

### Technikai megjegyzések

- Érintett fájl: `packages/backend/src/services/groups.service.ts`, `createGroup` függvény (sor ~83).
- Lekérdezés minta a `createGroup` bővítéséhez (a meglévő INSERT-ek után):
  ```ts
  const globalTypes = await db
    .select({ id: specialPredictionTypes.id })
    .from(specialPredictionTypes)
    .where(and(
      eq(specialPredictionTypes.isGlobal, true),
      eq(specialPredictionTypes.isActive, true),
    ))

  if (globalTypes.length > 0) {
    await db
      .insert(groupGlobalTypeSubscriptions)
      .values(globalTypes.map(gt => ({ groupId: group.id, globalTypeId: gt.id })))
      .onConflictDoNothing()
  }
  ```
- A `groupGlobalTypeSubscriptions` és `specialPredictionTypes` **NINCS importálva** a `groups.service.ts`-ben — hozzá kell adni az importot a `'../db/schema/index.js'`-ból. (Jelenleg csak a `special-predictions.service.ts`-ben van importálva.)
- Nincs frontend változás szükséges.
- Tesztfájl: `packages/backend/src/services/groups.service.test.ts` (ha létezik), vagy hozz létre egyet a meglévő service test fájlok mintájára.

### Hatókörön kívül

- Retroaktív feliratkozás a már létező csoportokra (az admin manuális workflow marad).
- Frontend UI változás.
- Az auto-feliratkozás az adminon keresztüli leiratkozást nem akadályozza meg.

### Prioritás

**Must Have – Wave 1**

### Effort

**S (~1–2 óra, csak backend)**

### Függőségek

Nincs. (US-925, US-926, US-927 már kész — a globális típus infrastruktúra teljes.)

---

## US-933

### Cím

Badge counter a "Torna tippek" tabon (nyitott, le nem adott tippek száma)

### User Story

Mint csoporttag, szeretném, hogy a "Torna tippek" tab gombján egy piros badge mutassa a nyitott (határidő még nem járt le, tippet még nem adtam le) torna tippek számát, hogy azonnal lássam, van-e tennivalóm.

### Elfogadási kritériumok

1. A `data-testid="tab-special"` gombon a "Torna tippek" szöveg után egy `<span>` badge jelenik meg, ha a nyitott, le nem adott tippek száma > 0.
2. Badge stílus: `bg-red-500 text-white text-xs font-bold rounded-full px-1.5 py-0.5 ml-1`.
3. A badge számértéke: azon `SpecialPredictionWithType` elemek száma a `specialPredictionsMap[groupId]` listából, amelyekre `sp.answer === null AND !isDeadlinePassed(sp.deadline)`.
4. Ha a count 0, a badge nem jelenik meg (nem nulla értékkel, hanem teljesen elrejtve: `v-if`).
5. A badge frissül, ha a user lead egy tippet (a `specialPredictionsMap` reaktívan frissül a store-ban a `upsertSpecialPrediction` action után).
6. Ha a `specialPredictionsMap[groupId]` még nincs betöltve (undefined), a badge nem jelenik meg.
7. Ha minden tippet leadtak (count = 0), a badge eltűnik.
8. A badge nem jelenik meg a Tagok, Beállítások vagy Ranglista tabokon.
9. Unit teszt: badge megjelenik, ha van nyitott le nem adott tipp; nem jelenik meg, ha mind leadva vagy mind lejárt.

### Edge case-ek

| Helyzet | Elvárt viselkedés |
|---------|-------------------|
| Nincs betöltve `specialPredictionsMap` | Nincs badge |
| Minden tipp leadva | Nincs badge (count = 0) |
| Minden tipp lejárt határidős | Nincs badge (lejárt, nem "nyitott") |
| 1 nyitott, 2 leadott tipp | Badge: "1" |
| 5 nyitott tipp | Badge: "5" |
| Éppen a "Torna tippek" tabon vagyok | Badge változatlanul látszik a tab gombján |

### Technikai megjegyzések

- Érintett fájl: `packages/frontend/src/views/GroupDetailView.vue`
- Adja hozzá a tab bar-ban a `data-testid="tab-special"` gombhoz:
  ```html
  <button data-testid="tab-special" ...>
    Torna tippek
    <span
      v-if="openPredictionCount > 0"
      class="bg-red-500 text-white text-xs font-bold rounded-full px-1.5 py-0.5 ml-1"
    >
      {{ openPredictionCount }}
    </span>
  </button>
  ```
- A `computed` property a `<script setup>`-ban:
  ```ts
  const openPredictionCount = computed(() => {
    const preds = groupsStore.specialPredictionsMap[groupId]
    if (!preds) return 0
    return preds.filter(sp => sp.answer === null && !isDeadlinePassed(sp.deadline)).length
  })
  ```
- A `specialPredictionsMap` a `upsertSpecialPrediction` action meghívása után automatikusan frissül — ha a store action frissíti a map-et (az `answer` mezőt beállítja), a badge automatikusan eltűnik.
- A `isDeadlinePassed` helper már létezik a view-ban (sor ~910).
- A `specialPredictionsMap` betöltése a `switchToSpecialTab` függvényen keresztül történik (sor ~1034). A badge már az `onMounted` előtt is 0-t mutat (undefined → 0 fallback), ami helyes.

### Hatókörön kívül

- Push értesítés vagy app-szintű badge.
- Sidebar-szintű badge megjelenítés.
- Badge más tabokon (Tagok, Beállítások).

### Prioritás

**Must Have – Wave 1**

### Effort

**S (~30–45 perc)**

### Függőségek

US-930 (a tab szöveg már "Torna tippek" kell legyen, de a badge a régi tab szöveg mellett is működik — párhuzamosan implementálható).

---

## US-934

### Cím

Mások tippjeinek megjelenítése határidő után – aggregált bontás típusonként

### User Story

Mint csoporttag, szeretném, hogy a határidő lejárta után minden torna tipp kártyán lássam, hogy a többi csoporttag mit tippelt összesítve (pl. "Mbappé (5), Vinicius (3), Haaland (2)"), hogy a csoport véleményét megismerhessem és összehasonlíthassam a saját tippemmel.

### Elfogadási kritériumok

#### Backend

1. Új endpoint: `GET /api/groups/:groupId/special-predictions/summary`
   - Auth: `authMiddleware` — bejelentkezés szükséges.
   - Tagság ellenőrzés: a kérelmező csak akkor kap adatot, ha tagja a csoportnak (403 egyébként).
   - 404, ha a csoport nem létezik.
2. Az endpoint **csak lejárt határidős típusokra** ad vissza adatot (`WHERE deadline <= now()`). Határidő előtt álló típusoknál a válaszban az adott típus nem szerepel, vagy üres `answers` tömbbel szerepel.
3. A válasz formátuma:
   ```json
   {
     "data": [
       {
         "typeId": "uuid",
         "typeName": "Gólkirály",
         "answers": [
           { "label": "Mbappé", "count": 5 },
           { "label": "Vinicius Jr.", "count": 3 },
           { "label": "Erling Haaland", "count": 2 }
         ],
         "totalResponses": 10
       }
     ]
   }
   ```
4. A `label` mező `team_select` és `player_select` típusoknál az UUID helyett a csapat/játékos nevét tartalmazza (ugyanaz a batch resolve logika, mint `getMyPredictions`-ban, a `teamNameMap` / `playerNameMap` megközelítéssel).
5. `text` és `dropdown` típusoknál a `label` maga a beírt szöveg/opció string.
6. Az `answers` tömb csökkenő `count` szerint rendezett.
7. Ha egy típusra senki sem adott le tippet, a `answers` üres tömb, `totalResponses: 0`.
8. Az endpoint csak azon típusokat adja vissza, amelyekhez a csoport hozzáfér (csoport saját típusai + aktív globális feliratkozások) — az `assertGroupMember` + a `getMyPredictions`-ban meglévő típuslekérdező logika alapján.
9. Unit teszt (backend): legalább 3 eset: lejárt típusra aggregált adatot ad; határidő előtti típusra nem ad adatot; nem tag 403-at kap.

#### Frontend

10. A `GroupDetailView.vue` `switchToSpecialTab` függvényében (nem `onMounted`-ban — csak akkor tölt, amikor a user tényleg megnyitja a tabot) a `fetchSpecialPredictions(groupId)` hívás mellé egy `fetchSpecialPredictionsSummary(groupId)` hívás is lefut.
11. Új Pinia state a `groups.store.ts`-ben: `specialPredictionsSummaryMap: ref<Record<string, SpecialPredictionSummary[]>>({})`.
12. A "Torna tippek" tabon minden lejárt kártyán (`isDeadlinePassed(sp.deadline) === true` AND `sp.points === null`, vagyis "Kiértékelésre vár" állapot) megjelenik az aggregált bontás:
    ```
    Csoporttippek: Mbappé (5) · Vinicius Jr. (3) · Haaland (2)
    ```
13. Ha `totalResponses === 0`, a sor nem jelenik meg ("Még senki sem tippelt").
14. A kiértékelt kártyákon (`sp.points !== null`) szintén megjelenik az aggregált bontás a helyes válasz és a pontok alatt.
15. A saját tipp és mások aggregált tippjei egymástól vizuálisan elkülönülnek (pl. saját: `text-gray-800`, mások: `text-gray-500 text-xs`).
16. Ha az endpoint hibát dob (pl. hálózati hiba), az aggregált bontás csendesen kimarad — hibaüzenet nem jelenik meg a kártyán.

### Edge case-ek

| Helyzet | Elvárt viselkedés |
|---------|-------------------|
| Határidő még nem járt le | Az endpoint nem ad adatot erre a típusra (szivárgás megelőzése) |
| Senki sem tippelt még | `answers: []`, `totalResponses: 0` — nem jelenik meg a kártyán |
| Mindenki ugyanazt tippelte | `answers: [{ label: "X", count: N }]` |
| A kérelmező nem tag | 403 |
| A csoport nem létezik | 404 |
| A `label` egy UUID (team/player ID), de a csapat/játékos törölve lett | A UUID-et kell visszaadni fallbackként (`teamNameMap.get(id) ?? id`) |
| 1 db válasz érkezik | Megjelenik, nincs minimum-darabszám korlát |

### Technikai megjegyzések

- Új backend service függvény: `getSpecialPredictionsSummary(groupId: string, userId: string): Promise<SpecialPredictionSummaryItem[]>` a `packages/backend/src/services/special-predictions.service.ts` fájlban.
- A típuslista lekérdezéséhez újra felhasználható az `assertGroupExists` és `assertGroupMember` (már léteznek a service-ben).
- Az aggregálás SQL-ben hatékonyabb, de a meglévő service minta alapján (ahol a `getMyPredictions` is alkalmazás szinten aggregál) elfogadható a JS-szintű aggregálás is kisebb csoportoknál — dönts a szokásos minta alapján.
- SQL aggregálási alternatíva:
  ```ts
  // GROUP BY typeId, answer — majd JOIN teams/players a labelhez
  const rows = await db
    .select({
      typeId: specialPredictions.typeId,
      answer: specialPredictions.answer,
      count: sql<number>`count(*)::int`,
    })
    .from(specialPredictions)
    .where(and(
      eq(specialPredictions.groupId, groupId),
      inArray(specialPredictions.typeId, activeTypeIds),
    ))
    .groupBy(specialPredictions.typeId, specialPredictions.answer)
  ```
- Új típus a `packages/backend/src/types/index.ts`-ben:
  ```ts
  export interface SpecialPredictionSummaryAnswer {
    readonly label: string
    readonly count: number
  }
  export interface SpecialPredictionSummaryItem {
    readonly typeId: string
    readonly typeName: string
    readonly answers: SpecialPredictionSummaryAnswer[]
    readonly totalResponses: number
  }
  ```
- Ugyanezt add hozzá a `packages/frontend/src/types/index.ts`-hez.
- Új API client metódus: `api.groups.specialPredictionsSummary(token, groupId)` a `packages/frontend/src/api/index.ts`-ben.
- A határidő-check az endpointban szerver oldali `new Date()` összehasonlítással történik, nem a frontend `isDeadlinePassed`-re támaszkodva — ez garantálja az adatszivárgás megelőzését.

### Hatókörön kívül

- Egyéni felhasználónevekkel ellátott tipp-megjelenítés (GDPR/fair play).
- Valós idejű frissítés (SSE).
- Vizuális chart/diagram.
- Százalékos bontás (csak darabszám kell).

### Prioritás

**Must Have – Wave 1**

### Effort

**M (~4–6 óra, backend + frontend)**

### Függőségek

US-930 (ajánlott, de nem blokkoló). A backend és frontend párhuzamosan fejleszthető.

---

## BUG-002

### Cím

Kiértékelt torna tipp kártyákon a "Helyes válasz" mező nyers UUID-et mutat `team_select` és `player_select` típusoknál

### Leírás

Kiértékelt állapotban (`sp.points !== null`) a tag kártyán a "Helyes válasz:" sorban `sp.correctAnswer` értéke egy nyers UUID string jelenik meg (pl. `3f4a1b2c-...`) a csapat vagy játékos neve helyett. Az `answerLabel` (a tag saját válaszának feloldása) már működik, de a `correctAnswer` megjelenítésnél nincs ilyen feloldás.

### Gyökérok

A `getMyPredictions` service függvény (`packages/backend/src/services/special-predictions.service.ts`, sor ~98–122) csak az `answerLabel`-t oldja fel a tag válaszához (UUID → név). A `correctAnswer` mező raw UUID-ként kerül vissza a válaszban, és a frontend (`GroupDetailView.vue`, sor ~471) közvetlenül `sp.correctAnswer`-t jeleníti meg.

### Elfogadási kritériumok

1. A `getMyPredictions` service a visszatérési objektumban a `correctAnswer` UUID mellé visszaad egy `correctAnswerLabel: string | null` mezőt is.
2. A `correctAnswerLabel` feloldása: ha az adott típus `inputType === 'team_select'`, a `teamNameMap`-ből kéri le a nevet (a már meglévő batch resolve logikával együtt); ha `player_select`, a `playerNameMap`-ből.
3. A `correctAnswer`-hez kapcsolódó ID-k belekerülnek a batch fetch-be — azaz a `teamIds` és `playerIds` tömb feltöltésekor nem csak a tag `pred.answer`-ét, hanem a `t.correctAnswer`-t is belefoglalja, ha az nem null.
4. A `SpecialPredictionWithType` interface bővül egy `correctAnswerLabel: string | null` mezővel (backend és frontend `types/index.ts`).
5. A `GroupDetailView.vue`-ban a kiértékelt blokknál (`v-if="sp.points !== null"`) a "Helyes válasz:" sorban `sp.correctAnswerLabel ?? sp.correctAnswer ?? '–'` jelenik meg a jelenlegi `sp.correctAnswer` helyett.
6. `text` és `dropdown` típusoknál a `correctAnswerLabel` null, és a `correctAnswer` maga a szöveg — ez a jelenlegi viselkedés megmarad.
7. Unit teszt (backend): `team_select` típusnál a `correctAnswerLabel` a csapat nevét tartalmazza, nem UUID-ot.
8. Unit teszt (backend): `player_select` típusnál a `correctAnswerLabel` a játékos nevét tartalmazza.
9. Unit teszt (backend): `text` típusnál a `correctAnswerLabel` null.
10. A jelenlegi tesztek módosítás nélkül zöldben maradnak (visszafelé kompatibilis bővítés).

### Edge case-ek

| Helyzet | Elvárt viselkedés |
|---------|-------------------|
| A `correctAnswer` null (még nincs kiértékelve) | `correctAnswerLabel` is null; megjelenítés: `sp.correctAnswerLabel ?? sp.correctAnswer ?? '–'` → '–' |
| A `correctAnswer` egy UUID, de a csapat/játékos törölve lett | `teamNameMap.get(id) ?? null` → null, tehát a raw UUID jelenik meg fallbackként |
| `text` input típus | `correctAnswerLabel: null`, a `correctAnswer` string maga jelenik meg |
| `dropdown` input típus | `correctAnswerLabel: null`, a `correctAnswer` a választott opció szövege |

### Technikai megjegyzések

- Érintett backend fájl: `packages/backend/src/services/special-predictions.service.ts`
  - A `teamIds` és `playerIds` tömbök feltöltésekor (sor ~78–84) adja hozzá a `correctAnswer` UUID-jét is, ha az adott típus `team_select` / `player_select` és a `correctAnswer` nem null:
    ```ts
    if (t.inputType === 'team_select') {
      if (pred?.answer) teamIds.push(pred.answer)
      if (t.correctAnswer) teamIds.push(t.correctAnswer)
    }
    if (t.inputType === 'player_select') {
      if (pred?.answer) playerIds.push(pred.answer)
      if (t.correctAnswer) playerIds.push(t.correctAnswer)
    }
    ```
  - A `return allTypes.map(t => { ... })` blokkban (sor ~98) a visszatérési objektumba add hozzá:
    ```ts
    correctAnswerLabel: t.inputType === 'team_select'
      ? (t.correctAnswer ? teamNameMap.get(t.correctAnswer) ?? null : null)
      : t.inputType === 'player_select'
        ? (t.correctAnswer ? playerNameMap.get(t.correctAnswer) ?? null : null)
        : null,
    ```
- Érintett type fájlok:
  - `packages/backend/src/types/index.ts`: `SpecialPredictionWithType` interface-hez `readonly correctAnswerLabel: string | null` mező hozzáadása.
  - `packages/frontend/src/types/index.ts`: ugyanez.
- Érintett frontend fájl: `packages/frontend/src/views/GroupDetailView.vue`, sor ~471:
  ```html
  <!-- Előtte: -->
  <span class="font-medium text-green-700">{{ sp.correctAnswer }}</span>
  <!-- Utána: -->
  <span class="font-medium text-green-700">{{ sp.correctAnswerLabel ?? sp.correctAnswer ?? '–' }}</span>
  ```

### Hatókörön kívül

- Frontend-only cache megoldás (a backend az autoritatív forrás — a fix a backend service-ben kell legyen).
- A `correctAnswer` mezőt ne távolítsd el a válaszból (visszafelé kompatibilitás).

### Prioritás

**Must Have – Wave 1**

### Effort

**S (~1–2 óra)**

### Függőségek

Nincs.

---

## Összefoglaló

| Story | Effort | Backend | Frontend | Tesztelés szükséges |
|-------|--------|---------|----------|---------------------|
| US-930 Átnevezés | XS | Nem | Igen | Meglévő spec-ek frissítése |
| US-931 Határidő jelzés | S | Nem | Igen | Új unit teszt (helper) |
| US-932 Auto-feliratkozás | S | Igen | Nem | Új backend unit teszt |
| US-933 Badge counter | S | Nem | Igen | Új frontend unit teszt |
| US-934 Aggregált tippek | M | Igen | Igen | Backend + frontend unit tesztek |
| BUG-002 correctAnswerLabel | S | Igen | Igen | Backend unit teszt + type update |

**A 6 story párhuzamosítható** — nincs köztük blokkoló függőség. Az egyetlen ajánlott sorrend: US-930 elsőként, hogy az összes többi story a végleges szövegkontextusban dolgozhassa fel a fájlokat.
