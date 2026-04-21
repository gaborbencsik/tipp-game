# US-1104: Admin waitlist dashboard -- feliratkozott email-ek megtekintese

## Story

Mint **platform admin**, szeretnek **egy admin dashboardon latni az osszes feliratkozott waitlist email-cimet es a teljes szamot**, hogy **atvekintessem legyen a landing oldal teljesitmenyerol es a feliratkozok szamarol**.

## Kontextus

A `waitlist_entries` tabla mar letezik a DB-ben (US-1103), a `POST /api/waitlist` endpoint muködik. Jelenleg azonban az admin feluleten nincs mod megtekinteni a feliratkozott email-cimeket. Ez a story egy uj admin nézetet és a hozza tartozo backend endpoint(eke)t vezeti be.

Az admin szekcionak mar van egységes pill tab navigacioja (Merkozes / Csapatok / Felhasznalok / Pontrendszer) -- ez egy uj "Waitlist" tabbal bovul.

**Meglevo DB schema:**
```
waitlist_entries:
  id:        UUID PK (defaultRandom)
  email:     varchar(255), unique, NOT NULL
  source:    enum('hero' | 'footer'), NOT NULL
  created_at: timestamptz, NOT NULL, defaultNow
```

---

## Elfogadasi kriteriumok

### Backend

- [ ] `GET /api/admin/waitlist` endpoint -- `authMiddleware + adminMiddleware`
- [ ] Response tartalmazza:
  - `totalCount: number` -- osszes waitlist bejegyzes szama
  - `entries: WaitlistEntry[]` -- a bejegyzesek listaja
- [ ] Minden `WaitlistEntry` objektum: `id`, `email`, `source`, `createdAt`
- [ ] Az entries `createdAt` szerint csokkeno sorrendben (legujabb elol)
- [ ] Opcionalisan szurheto query parameterekkel:
  - `source` (string: `'hero'` | `'footer'`) -- csak az adott forrasbol szur
  - `search` (string) -- email reszletre szures (`ILIKE '%...%'`)
- [ ] A `totalCount` mindig a szures UTANI erteket mutatja (ha van szuro, szurt count; ha nincs szuro, teljes count)
- [ ] `waitlist.service.ts` bovitese: `getWaitlistEntries(filters?)` -- Drizzle query a szuresekkel

### Frontend

- [ ] `/admin/waitlist` route -- `requiresAuth + requiresAdmin`
- [ ] `AdminWaitlistView.vue` nézet:
  - **Felul:** osszes feliratkozott szama kiemelten megjelenik egy szamlalo kartyaban (pl. nagy szam + "feliratkozott" felirat)
  - **Szuro sor:** source dropdown (Osszes / Hero / Footer) + szabad szoveges email kereso
  - **Tablazat:** email, forras badge (Hero/Footer), feliratkozas datuma (hu-HU formatumban)
  - **Ures allapot:** ha nincs egyetlen bejegyzes sem, "Meg nincs feliratkozott" uzenet
- [ ] Admin pill tab navigacio kiegeszul egy "Waitlist" tabbal (a Pontrendszer tab utan)
- [ ] `admin-waitlist.store.ts` Pinia store: `fetchWaitlist()`, `entries`, `totalCount`, `loading`, `error`, `filters` (source, search)
- [ ] `api.admin.waitlist.list(token, filters?)` API client metodus az `api/index.ts`-ben

### Tesztek

- [ ] Backend unit tesztek: lista lekeres (rendezett), source szures, email keresés, üres eredmeny
- [ ] Frontend tesztek: store fetch + state, tablazat rendereles, szures mukodese, ures allapot

---

## Edge case-ek

| Eset | Elvart viselkedes |
|------|-------------------|
| Nincs egyetlen waitlist entry sem | Szamlalo: 0, tablazat helyett "Meg nincs feliratkozott" uzenet |
| 1000+ bejegyzes | A lista scrollozhato; ha kesobb paginacio kell, a backend egybol `offset/limit`-tel bovitheto (most nem kotelezo) |
| Source szuro + kereso egyidejuleg | Mindket szuro AND kapcsolatban mukodik |
| Specialis karakterek a keresőben | Az `ILIKE` parameterized query-n megy at, nincs SQL injection veszelye |
| Tobbszor betoltött oldal | A store mindig frissen keri az adatokat (nem cachelunk) |

---

## Technikai megjegyzesek

- A backend `waitlist.service.ts` mar letezik (`isValidEmail`, `addToWaitlist`) -- ezt bovitjuk a `getWaitlistEntries` fuggvennyel
- A `totalCount` SQL `count(*)` aggregacioval kerheto, kulon query-vel VAGY a Drizzle `sql` helperrel a foquery melle
- Az admin route-ok a `/api/admin` prefix alatt vannak, a `adminRouter` az `admin.routes.ts`-ben van definiálva -- ide kerül az uj endpoint
- A `waitlistSourceEnum` mar letezik a schema-ban: `pgEnum('waitlist_source', ['hero', 'footer'])`
- Az admin pill tab navigáció `AdminTabNav` komponensben van -- uj tab hozzaadasa: `{ label: 'Waitlist', to: '/admin/waitlist' }`
- Frontend típusok: `WaitlistEntry` interface hozzáadandó a frontend `types`-hoz
- A `source` badge szinezese: Hero -> kek, Footer -> zold (vagy hasonlo vizualis megkulonboztetes)

---

## Nem tartalmazza (scope-on kivul)

- CSV/Excel export (kesobb bovitheto)
- Email kuldese a waitlist feliratkozoknak (kulon story, email service kell hozza)
- Egyenkénti torles/szerkesztes (nincs ra szukseg, a waitlist read-only az admin szamara)
- Paginacio (ha 1000+ entry lesz, kulon story)

---

## Fuggosegek

- **US-1103** (Email waitlist -- feliratkozas mentese) -- ✅ Kesz
- **US-701** (User/Admin szerepkorok) -- ✅ Kesz
- **Admin pill tab navigacio** -- ✅ Kesz (meglevo pattern)

---

**Story ID:** US-1104
**Epic:** E8 -- Admin panel
**Komplexitas:** S
**Prioritas:** Should Have
