# US-1105: Admin waitlist CRUD -- egyedi torles es manualis hozzaadas

## Story

Mint **platform admin**, szeretnek **a waitlist tablazatban egyedi bejegyzeseket torolni es uj email-cimeket manualis hozzaadni**, hogy **a waitlist adatait karbantarthassam (teszt email-ek eltavolitasa, manualis felvitel)**.

## Kontextus

Az US-1104 implementalta az `/admin/waitlist` read-only dashboardot (`GET /api/admin/waitlist`). Ez a story boviti a muveletek korет ket uj kepesseggel: egyedi torles es manualis hozzaadas.

**Meglevo DB schema:**
```
waitlist_entries:
  id:        UUID PK (defaultRandom)
  email:     varchar(255), unique, NOT NULL
  source:    enum('hero' | 'footer' | 'admin'), NOT NULL
  created_at: timestamptz, NOT NULL, defaultNow
```

**Megjegyzes a source enum boviteserol:** az `'admin'` erteket hozza kell adni a meglevo `waitlist_source` pgEnum-hoz (Drizzle migraciot igenyel). Ez egyrtelmu naplovezhetoseget biztosit (ki irta be kezzel), masreszt a szuro is hasznalhatova valik ra, es nem kever be hamis `hero`/`footer` adatot az analitikaba.

---

## Elfogadasi kriteriumok

### Backend

#### Torles

- [ ] `DELETE /api/admin/waitlist/:id` endpoint -- `authMiddleware + adminMiddleware`
- [ ] Sikeres torles: 204 No Content
- [ ] Nem leteo id: 404 `{ error: 'Waitlist entry not found' }`
- [ ] Ervenytelen UUID format: 400 (Drizzle/PG hibat kap az app, AppError-kent kezeli)
- [ ] `waitlist.service.ts`: `deleteWaitlistEntry(id: string): Promise<void>` -- AppError(404) ha nincs ilyen rekord
- [ ] Unit teszt: sikeres torles, nem leteo id → 404

#### Hozzaadas

- [ ] `POST /api/admin/waitlist` endpoint -- `authMiddleware + adminMiddleware`
- [ ] Request body: `{ email: string, source?: 'hero' | 'footer' | 'admin' }` -- `source` elhagyasa eseten default `'admin'`
- [ ] Szerver-oldali email validacio: regex + max 255 karakter -- ervenytelen: 400 `{ error: 'Invalid email' }`
- [ ] Duplikalt email: 409 `{ error: 'Email already on waitlist' }`
- [ ] Sikeres hozzaadas: 201 + az uj `WaitlistEntry` objektum (`id`, `email`, `source`, `createdAt`)
- [ ] `waitlist.service.ts`: `addWaitlistEntry(email: string, source: WaitlistSource): Promise<WaitlistEntry>` -- AppError(409) duplikalt email eseten
- [ ] Unit teszt: sikeres hozzaadas, duplikalt email → 409, ervenytelen email → 400, hianyzó email → 400

#### Schema bovites

- [ ] `waitlist_source` pgEnum kiegeszul az `'admin'` ertekkel
- [ ] Drizzle migracio generalva (nem kezzel modositva)
- [ ] A meglevo `POST /api/waitlist` publikus endpoint valtozatlan marad (csak `'hero'` | `'footer'` fogadja el)

### Frontend

#### Torles

- [ ] A tablazat minden soraban megjelenik egy trash ikon gomb (csak admin latja -- mar az egesz nezet admin-only)
- [ ] A gombra kattintva egy megerosito dialog jelenik meg: „Biztosan torlod ezt a bejegyzest? Ez a muvelet nem vonhato vissza."
- [ ] Megerosites utan az API hivast elvegzi (`DELETE /api/admin/waitlist/:id`)
- [ ] Sikeres torles utan a lista es a szamlalo automatikusan frissul (store `fetchWaitlist()`)
- [ ] Hiba eseten egy error banner jelenik meg a tablazat felett
- [ ] A torles kozben az adott sor gombjain loading spinner / disabled allapot (dupla kattintas megelozes)

#### Hozzaadas

- [ ] A tablazat felett egy „+ Email hozzaadasa" gomb jelenik meg
- [ ] A gombra kattintva egy inline form nyilik meg a tablazat felett (VAGY egy modal -- implementacio dontese), a kovetkezo mezokkel:
  - Email cim (text input, required)
  - Forras (source) dropdown: Admin / Hero / Footer (default: Admin)
- [ ] „Hozzaadas" gomb submit-olja a formt
- [ ] Validacio: ures email vagy nem email formatumu bevitel eseten a form megjeleníti a hibat, API hivás nélkül
- [ ] Sikeres hozzaadas utan: a form kiurul / bezarul, a lista es a szamlalo frissul
- [ ] Duplikalt email eseten (API 409): a form alatt hibauzenet: „Ez az email-cim mar szerepel a waitlisten."
- [ ] Submit kozben a „Hozzaadas" gomb disabled

#### Store (`admin-waitlist.store.ts` bovites)

- [ ] `deleteEntry(id: string)` action: API hivás, siker utan `fetchWaitlist()` meghivasa, hiba eseten `error` state beallitasa
- [ ] `addEntry(email: string, source: WaitlistSource)` action: API hivás, siker utan `fetchWaitlist()` meghivasa, duplikalt email eseten kulon `addError` state beallitasa

#### API client (`api/index.ts` bovites)

- [ ] `api.admin.waitlist.delete(token, id)` -- `DELETE /api/admin/waitlist/:id`
- [ ] `api.admin.waitlist.add(token, email, source?)` -- `POST /api/admin/waitlist`

### Tesztek

- [ ] Backend unit tesztek (waitlist.service.ts): `deleteWaitlistEntry` siker, nem leteo → 404; `addWaitlistEntry` siker, duplikalt → 409
- [ ] Backend route tesztek: `DELETE` 204/404; `POST` 201/409/400
- [ ] Frontend store tesztek: `deleteEntry` → API hivás + fetchWaitlist, hiba → error state; `addEntry` → API hivás + fetchWaitlist, 409 → addError state
- [ ] Frontend komponens tesztek: megerosito dialog megjelenese, torles utan frissites; add form nyitasa, submit → API hivás, duplikalt email → hibauzenet

---

## Edge case-ek

| Eset | Elvart viselkedes |
|------|-------------------|
| Torles kozben a user ranyom a gombra megegyszer | Gomb disabled, csak egy API hivás megy el |
| Hozzaadas kozben a user becsukja a formt | Form allapota resetelodik, nincs API hivás |
| Torolt entry-t megprobaljak torolni (versenyhelyzet) | Backend 404-et ad, frontend error banner mutatja |
| Admin `source: 'admin'`-nal vesz fel emailt | A forras badge-et az admin-waitlist tablazatban is megjelenik (uj „Admin" badge szinnel, pl. lila) |
| A tablazatban 0 entry van | A torles gomb logikailag nem latszik (ures allapot uzenet marad) |
| Hozzaadas utan a szuro aktiv | `fetchWaitlist()` a meglevo szurokkel hivodik meg, az uj entry csak akkor latszik, ha nem szurodik ki |
| Ures email mező submittalasa | Frontend validacio megelozi az API hivást (nincs felesleges request) |

---

## Technikai megjegyzesek

- A `waitlist.service.ts` mar letezik -- bovitjuk `deleteWaitlistEntry` es `addWaitlistEntry` fuggvenyekkel
- A `addWaitlistEntry` a meglevo publikus `addToWaitlist` fuggvenytol KULONALLO -- az admin verzio 409-et dob duplikalt esetben (a publikus endpoint 201-et ad vissza GDPR okokbol)
- Az `admin.routes.ts`-ben uj route-ok a meglevo `adminRouter`-be keszulnek (`/waitlist/:id` DELETE, `/waitlist` POST)
- A 204 No Content valasz kezelesere az `api/index.ts` request helpere mar kepes (US-604-C-bol orokolt minta)
- A `source` badge szinezese: Hero → kek, Footer → zold, Admin → lila
- TypeScript: `WaitlistSource = 'hero' | 'footer' | 'admin'` union type frissitendo

---

## Nem tartalmazza (scope-on kivul)

- Tombos torles (tobb bejegyzes egyidejuleg)
- Szerkesztes (email vagy source modositasa)
- CSV export
- Email kuldese a waitlist feliratkozoknak (kulon story)
- Paginacio

---

## Fuggosegek

- **US-1104** (Admin waitlist dashboard) -- ✅ Kesz
- **US-1103** (Email waitlist -- feliratkozas mentese) -- ✅ Kesz
- **US-701** (User/Admin szerepkorok) -- ✅ Kesz

---

**Story ID:** US-1105
**Epic:** E8 -- Admin panel
**Komplexitas:** S
**Prioritas:** Should Have
