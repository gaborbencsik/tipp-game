# VB Tippjáték – Projekt Terv és User Story-k

> Nyári labdarúgó világbajnokság tippjáték platform
> Verzió: 1.0 | Dátum: 2026-03-27

---

## Tartalom

1. [Epic-ek áttekintése](#1-epic-ek-áttekintése)
2. [User Story-k](#2-user-story-k)
3. [Prioritás összefoglaló](#3-prioritás-összefoglaló)
4. [Story map (vázlat)](#4-story-map-vázlat)

---

## 1. Epic-ek áttekintése

| Epic | Leírás | Prioritás |
|------|--------|-----------|
| E0 – Dev infrastruktúra | Monorepo setup, Docker dev környezet, CI alap | Must Have |
| E1 – Meccsek | Mérkőzések megjelenítése és kezelése | Must Have |
| E2 – Tippelés | Tippek leadása, módosítása, megjelenítése | Must Have |
| E3 – Auth | Felhasználói azonosítás (Supabase Auth – Google OAuth) | Must Have |
| E4 – Pontszámítás | Automatikus pontozási logika | Must Have |
| E5 – Ranglista | Globális és csoportos ranglista | Must Have |
| E6 – Csoportok | Privát csoportok létrehozása és kezelése | Must Have |
| E7 – Role kezelés | User/Admin szerepkörök | Must Have |
| E8 – Admin panel | Mérkőzés CRUD, eredmény rögzítés, user kezelés | Must Have |
| E9 – Stat. tippek | Gólkirály, bajnok, egyéb statisztikai tippek | Should Have |
| E10 – UX/Polish | Értesítések, animációk, PWA, stb. | Nice to Have |
| E11 – Támogatás | Donation lehetőség a projekt fenntartásához | Should Have |
| E12 – Adatszinkron | Automatikus meccs- és eredményadat szinkron külső API-ból | Should Have |

---

## 2. User Story-k

### E0 – Fejlesztői infrastruktúra

#### US-001: Monorepo és fejlesztői környezet felállítása

**Story:**
Mint **fejlesztő**, szeretnék **egy paranccsal elindítani a teljes alkalmazást Docker-ben lokálisan**, hogy **ne kelljen manuálisan konfigurálni a környezetet, és minden service egységesen fusson**.

**Elfogadási kritériumok:**
- [ ] A repository gyökerében `docker-compose.yml` van, amely elindítja: PostgreSQL 18.3, Koa backend (hot reload), Vue frontend (Vite dev server)
- [ ] `docker compose up` után elérhető: `http://localhost:5173` (frontend), `http://localhost:3000` (backend API)
- [ ] A backend induláskor automatikusan futtatja a Drizzle migrációkat (`db:migrate`)
- [ ] Hot reload működik: backend és frontend forrás változásakor a konténer újratölt, konténer rebuild nélkül
- [ ] A `.env.example` tartalmaz minden szükséges változót kommenttel; a `README` leírja a setup lépéseit
- [ ] `VITE_DEV_AUTH_BYPASS=true` env változóval a bejelentkezés gomb mock userrel lép be, OAuth redirect nélkül
- [ ] Minden service health check-kel rendelkezik a `docker-compose.yml`-ben

**Komplexitás:** M
**Prioritás:** Must Have

---

#### US-002: Adatbázis schema és seed adatok

**Story:**
Mint **fejlesztő**, szeretnék **egy paranccsal létrehozni a teljes DB sémát és feltölteni alap seed adatokkal**, hogy **fejlesztés közben valós adatokon dolgozhassak**.

**Elfogadási kritériumok:**
- [ ] `npm run db:generate` – Drizzle Kit generálja a migrációs fájlokat a schema alapján
- [ ] `npm run db:migrate` – futtatja az összes migrációt a target DB-n
- [ ] `npm run db:seed` – feltölti az adatbázist: 32 VB-csapat, ~10 meccs (különböző státuszban: scheduled, live, finished), 1 admin user, 1 alap scoring config
- [ ] A seed script idempotens: kétszer futtatva nem duplikál adatot
- [ ] A migrációk verziókövetésben vannak; kézzel nem módosíthatók

**Komplexitás:** S
**Prioritás:** Must Have

---

#### US-003: Tesztelési infrastruktúra

**Story:**
Mint **fejlesztő**, szeretnék **egy paranccsal futtatni az összes unit tesztet**, hogy **folyamatosan ellenőrizhessem a változtatások helyességét**.

**Elfogadási kritériumok:**
- [ ] `npm test` a monorepo gyökeréből futtatja mindkét package tesztjeit
- [ ] `npm test --workspace=packages/backend` és `npm test --workspace=packages/frontend` külön is működik
- [ ] A backend scoring service unit tesztjei zöldek (legalább 17 eset)
- [ ] Coverage report generálható (`npm run test:coverage`)
- [ ] CI-ban (GitHub Actions) minden PR-on automatikusan fut: lint → typecheck → test

**Komplexitás:** S
**Prioritás:** Must Have

---

#### US-004: Production deploy pipeline

**Story:**
Mint **fejlesztő**, szeretnék **egy automatizált pipeline-t, amely a `main` branch minden változásakor kideployolja az alkalmazást**, hogy **a legfrissebb verzió mindig elérhető legyen éles környezetben**.

**Elfogadási kritériumok:**
- [ ] Frontend deployolva Vercelre; minden `main` push után automatikusan buildel és kiad
- [ ] Backend deployolva Render-re; production `Dockerfile` (multi-stage build, nem dev server)
- [ ] `render.yaml` Blueprint definiálja a backend service-t és env var referenciákat (IaC)
- [ ] Supabase projekt konfigurálva: prod DB, Google OAuth callback URL beállítva
- [ ] Minden szükséges env var beállítva Vercelen és Render-en (nem `.env` fájlból)
- [ ] `https://` végpont elérhető: frontend URL-ről az API hívások működnek (CORS)
- [ ] `npm run db:migrate` fut Render deploy hook-ként (pre-deploy command)
- [ ] GitHub Actions CI: typecheck + test zöld marad minden merge előtt
- [ ] Rollback: Render dashboard-ról bármely korábbi deploy visszaállítható

**Komplexitás:** M
**Prioritás:** Must Have

---

### E1 – Meccsek listázása

#### US-101: Mérkőzések böngészése

**Story:**
Mint **bejelentkezett felhasználó**, szeretnék **napokra lebontva, kronológiai sorrendben látni minden VB-mérkőzést**, hogy **könnyen áttekinthessem mikor, kit játszik ki**.

**Elfogadási kritériumok:**
- [ ] A meccsek napok szerint csoportosítva jelennek meg (pl. "2026. június 11. – csütörtök")
- [ ] Minden meccsnél látható: hazai csapat, vendég csapat, kezdési időpont (helyi idő), helyszín (stadion + város), csoport/szakasz (pl. "A csoport – 1. forduló", "Negyeddöntő")
- [ ] Letelt mérkőzéseknél a végeredmény kiemelten látható (pl. 2 – 1)
- [ ] A lista szűrhető csoport/szakasz szerint
- [ ] Jelenleg folyamatban lévő meccsek vizuálisan megkülönböztethetők (pl. "ÉLŐBEN" badge)

**Komplexitás:** M
**Prioritás:** Must Have

---

#### US-102: Mérkőzés részletek

**Story:**
Mint **bejelentkezett felhasználó**, szeretnék **egy mérkőzésre kattintva részletes nézetet látni**, hogy **megtudjam a pontos adatokat és a saját tippemet**.

**Elfogadási kritériumok:**
- [ ] A részletes nézetben látható: mindkét csapat neve és zászlója/logója, pontos időpont, helyszín, csoport/szakasz
- [ ] Ha a meccs lezárult: végeredmény és a saját tipp egymás mellett jelenik meg, a kapott pontszámmal együtt
- [ ] Ha a meccs még nyitott: a tippelő form elérhető ebből a nézetből is

**Komplexitás:** S
**Prioritás:** Must Have

---

### E2 – Tippelési rendszer

#### US-201: Tipp leadása mérkőzésre

**Story:**
Mint **bejelentkezett felhasználó**, szeretnék **egy nyitott mérkőzésre pontostipp-et adni (hazai:vendég gólszám)**, hogy **részt vehessek a versenyben**.

**Elfogadási kritériumok:**
- [ ] Csak a meccs kezdési időpontja ELŐTT lehet tippet leadni (szerver-oldali zárolás is)
- [ ] A tipp beviteli mezők: két szám-input (0–99 tartomány), mentés gomb
- [ ] Sikeres mentés után vizuális visszajelzés (pl. toast értesítés: "Tipp elmentve!")
- [ ] Ha a felhasználónak már van tippje az adott meccsre, azt az értéket tölti be alapból a form

**Komplexitás:** M
**Prioritás:** Must Have

---

#### US-202: Tipp módosítása

**Story:**
Mint **bejelentkezett felhasználó**, szeretnék **egy korábban leadott tippet módosítani, amíg a meccs nem zárult le**, hogy **javíthassam a döntésemet**.

**Elfogadási kritériumok:**
- [ ] A tipp módosítása ugyanazon az interfészen keresztül történik, mint a leadás (előre kitöltött form)
- [ ] A módosítás gomb / lehetőség csak nyitott meccseknél érhető el
- [ ] Lezárt meccseknél a form read-only módban jelenik meg, egyértelműen jelezve, hogy "Tippelés lezárva"
- [ ] Az utolsó módosítás időpontja megjelenik (pl. "Utoljára módosítva: 2026. jún. 10. 18:45")

**Komplexitás:** S
**Prioritás:** Must Have

---

#### US-203: Saját tippek összesítő nézet

**Story:**
Mint **bejelentkezett felhasználó**, szeretnék **egy oldalon látni az összes leadott és hiányzó tippemet**, hogy **nyomon kövessem, melyik meccsre nem tippeltem még**.

**Elfogadási kritériumok:**
- [ ] Az összesítő oldalon minden meccs szerepel (tippelt és nem tippelt is)
- [ ] Vizuálisan elkülönülnek: ✅ tippelt nyitott, 🔒 lezárt tippelt, ❌ lezárt nem tippelt, ⏳ nyitott nem tippelt
- [ ] Lezárt meccseknél a tipp mellé kerül a kapott pontszám
- [ ] A hiányzó, még tippelhető meccsek kiemelve jelennek meg (pl. figyelmeztető szín)

**Komplexitás:** M
**Prioritás:** Must Have

---

#### US-204: Más felhasználók tippjeinek megtekintése

**Story:**
Mint **bejelentkezett felhasználó**, szeretnék **a meccsek lezárása után megnézni más játékosok tippjeit**, hogy **összehasonlíthassam az eredményeket**.

**Elfogadási kritériumok:**
- [ ] Más felhasználók tippjei csak az adott meccs lezárása után válnak láthatóvá (szerver-oldali is)
- [ ] A meccs detail oldalon megjelennek a többi játékos tippjei (név + tipp + kapott pont)
- [ ] Az adat nem szivárog ki nyitott meccsek esetén (API szinten is ellenőrzött)

**Komplexitás:** M
**Prioritás:** Should Have

---

### E3 – Felhasználókezelés / Auth

#### US-301: Regisztráció és bejelentkezés Supabase Auth + Google OAuth-szal

**Story:**
Mint **új látogató**, szeretnék **Google-fiókommal egyszerűen regisztrálni és belépni**, hogy **ne kelljen külön jelszót megjegyeznem**.

**Elfogadási kritériumok:**
- [ ] A főoldalon / login oldalon "Bejelentkezés Google-lel" gomb látható
- [ ] A Supabase Auth kezeli a teljes Google OAuth flow-t (consent screen, callback, session)
- [ ] Sikeres auth után a Supabase session tokent a frontend tárolja (Supabase JS client)
- [ ] A backend minden védett API híváshoz ellenőrzi a Supabase JWT-t (`Authorization: Bearer <token>`)
- [ ] Sikeres belépés után a Koa backend upsert-eli a `users` táblát a Supabase user adataival (email, display name, avatar URL)
- [ ] Ha az email már létezik (visszatérő felhasználó), nem hoz létre új profilt, hanem belép
- [ ] A felhasználó a sikeres auth után automatikusan a főoldalra irányítódik

**Megjegyzés:** Az auth session kezelését a Supabase Auth végzi. A Koa backend a `SUPABASE_JWT_SECRET`-tel validálja a tokeneket – nincs szükség külön refresh token logikára a backendben.

**Komplexitás:** M
**Prioritás:** Must Have

---

#### US-302: Bejelentkezés / kijelentkezés

**Story:**
Mint **regisztrált felhasználó**, szeretnék **biztonságosan belépni és kilépni az alkalmazásból**, hogy **a fiókom védve legyen**.

**Elfogadási kritériumok:**
- [x] Bejelentkezés: Google OAuth gombbal működik (Supabase Auth), redirect a visszatérési URL-re
- [x] Kijelentkezés: egy kattintással működik, Supabase session törlése kliens-oldalon
- [x] Lejárt session esetén automatikus átirányítás a login oldalra
- [x] Védett route-ok (pl. tippelés, ranglista) csak bejelentkezett állapotban elérhetők
- [x] **Dev mode bypass:** ha `VITE_DEV_AUTH_BYPASS=true`, a bejelentkezés gombra kattintva a rendszer azonnal belép egy előre definiált mock userrel (nincs Google redirect), és a főoldalra irányít
- [x] Oldal újratöltéskor a router guard megvárja az auth session helyreállítását (`ready` flag), mielőtt dönt a redirect-ről – nincs race condition

**Komplexitás:** S
**Prioritás:** Must Have

**Státusz:** ✅ Kész

---

#### US-303: Saját profil megtekintése és szerkesztése

**Story:**
Mint **bejelentkezett felhasználó**, szeretnék **a profilomat megtekinteni és a megjelenítendő nevemet módosítani**, hogy **személyre szabhassam a megjelenésemet a ranglistán**.

**Elfogadási kritériumok:**
- [ ] A profiloldalon látható: avatar, display name, email (csak olvasható), regisztrációs dátum
- [ ] A display name szerkeszthető (max. 30 karakter, kötelező mező)
- [ ] Mentés után a ranglista és más helyeken is azonnal frissül a megjelenített név
- [ ] Az email cím nem szerkeszthető (Supabase Auth-ból/Google-ből jön)

**Komplexitás:** S
**Prioritás:** Should Have

---

#### US-304: Email + jelszó regisztráció (alternatív auth)

**Story:**
Mint **új látogató, aki nem akar Google-t használni**, szeretnék **email-cím és jelszó kombinációval regisztrálni**, hogy **hagyományos módon is részt vehessek**.

**Elfogadási kritériumok:**
- [ ] Supabase Auth email+jelszó provider engedélyezve (dashboard beállítás)
- [ ] Regisztrációs form: email, jelszó (min. 8 karakter), display name
- [ ] Supabase kezeli az email verifikációt és a jelszó visszaállítást
- [ ] Duplikált email esetén hibaüzenet: "Ez az email cím már regisztrálva van"

**Komplexitás:** M
**Prioritás:** Should Have
> *Megjegyzés: Elsődleges implementáció a Google OAuth (US-301). Ez a story egy jövőbeli iteráció – a Supabase Auth miatt a komplexitás kisebb, mint saját implementációnál.*

---

#### US-305: Session perzisztencia oldal-újratöltés után

**Story:**
Mint **bejelentkezett felhasználó**, szeretnék **ha oldal-újratöltés után is bejelentkezve maradnék**, hogy **ne kelljen minden alkalommal újra belépni**.

**Elfogadási kritériumok:**
- [ ] Valódi OAuth mód: a Supabase JS client automatikusan visszaállítja a sessiont localStorage-ból (`onAuthStateChange` – `INITIAL_SESSION` event) – ez már működik
- [ ] Dev bypass mód: a session `sessionStorage`-ban tárolódik TTL-el (alapértelmezett: 8 óra); oldal-újratöltés után visszaállítódik, ha a TTL nem járt le
- [ ] TTL lejárta után a dev bypass session törlődik, a felhasználó a login oldalra kerül
- [ ] A TTL értéke konstansban van definiálva (nem hardcoded magic number)
- [ ] A megoldás kizárólag a frontend érint – backend változtatás nem szükséges

**Komplexitás:** S
**Prioritás:** Must Have

---

### E4 – Pontozási rendszer

#### US-401: Automatikus pontszámítás eredmény rögzítése után

**Story:**
Mint **rendszer**, szeretnék **mérkőzés eredményének rögzítésekor automatikusan kiszámítani minden tippre a pontszámot**, hogy **a felhasználóknak ne kelljen manuálisan követni az eredményt**.

**Elfogadási kritériumok:**
- [ ] Az admin által rögzített eredmény mentésekor egy background job / service automatikusan végigmegy az összes tipp-en az adott meccsre
- [ ] Minden tipphez pontszámot rendel a konfiguráció szerint (ld. alap pontrendszer)
- [ ] Ha egy meccshez már voltak pontok, újraszámítás esetén felülírja őket
- [ ] A számítás idempotens: kétszer futtatva ugyanazt az eredményt adja

**Komplexitás:** M
**Prioritás:** Must Have

---

#### US-402: Konfigurálható pontrendszer

**Story:**
Mint **admin**, szeretnék **a pontszabályokat konfigurálni adatbázisban**, hogy **az egyedi csoportok eltérő pontozást használhassanak**.

**Elfogadási kritériumok:**
- [ ] Az alapértelmezett pontrendszer adatbázisban tárolódik (nem hardcoded):
  - Pontos találat: 3 pont
  - Helyes győztes + azonos gólkülönbség: 2 pont
  - Helyes győztes: 1 pont
  - Döntetlen tipp döntetlenre: 2 pont
  - Helytelen: 0 pont
- [ ] Csoportonként override-olható a pontrendszer
- [ ] Az admin felületen a globális konfig szerkeszthető

**Komplexitás:** M
**Prioritás:** Must Have

---

#### US-403: Pontszámítási logika tesztelhetősége

**Story:**
Mint **fejlesztő**, szeretnék **a pontszámítási logikát izoláltan, unit tesztekkel tesztelni**, hogy **biztosítsam a helyes működést minden edge case-re**.

**Elfogadási kritériumok:**
- [ ] A pontozási logika egy dedikált `scoring.service.ts`-ben van, nem tartalmaz DB-hívást
- [ ] Unit tesztek lefedik legalább: pontos találat, győztes + gólkülönbség, csak győztes, döntetlen helyes/helytelen eseteket
- [ ] A service egy tiszta függvény: `calculatePoints(prediction, result, config) => number`

**Komplexitás:** S
**Prioritás:** Must Have

---

### E5 – Ranglista

#### US-501: Globális ranglista megtekintése

**Story:**
Mint **bejelentkezett felhasználó**, szeretnék **az összes játékos ranglistáját látni az összesített pontszám szerint csökkenő sorrendben**, hogy **tudjam hol állok a versenyben**.

**Elfogadási kritériumok:**
- [ ] A ranglista tartalmazza: helyezés, avatar, display name, összes pont, tipek száma, helyes tippek száma
- [ ] A saját sor vizuálisan kiemelve jelenik meg
- [ ] Nagy userbázisnál lapozás (page size: 20-50 sor) VAGY végtelen scroll
- [ ] A ranglista az utolsó eredményrögzítés után automatikusan frissül

**Komplexitás:** M
**Prioritás:** Must Have

---

#### US-502: Ranglista szűrése / keresése

**Story:**
Mint **bejelentkezett felhasználó**, szeretnék **a ranglistán keresni / szűrni**, hogy **gyorsan megtaláljam egy adott játékos helyezését**.

**Elfogadási kritériumok:**
- [ ] Szabad szöveges keresés display name alapján
- [ ] A keresési eredmény megmutatja a találat helyezési számát is
- [ ] Szűrés forduló/szakasz szerint (pl. "Csoportkör után", "Negyeddöntők után")

**Komplexitás:** M
**Prioritás:** Should Have

---

### E6 – Csoportok

#### US-601: Csoport létrehozása

**Story:**
Mint **bejelentkezett felhasználó**, szeretnék **saját csoportot létrehozni egyedi névvel**, hogy **barátaimmal privát versenyt szervezhessek**.

**Elfogadási kritériumok:**
- [ ] Csoport létrehozás form: csoport neve (max. 50 karakter, egyedi), opcionális leírás
- [ ] Létrehozás után a rendszer generál egy egyedi meghívó kódot (6-8 karakteres alfanumerikus)
- [ ] A létrehozó automatikusan a csoport admin tagja lesz
- [ ] Egy user legfeljebb 5 csoportot hozhat létre (spamvédelem)
- [ ] Ha a usernek még nincs egyetlen csoportja sem, a `/groups` oldalon középen egy "Csoport létrehozása" CTA gomb jelenik meg (üres állapot)
- [ ] A "Csoport létrehozása" gomb/form a `/groups` oldalon érhető el (nem külön route)

**Komplexitás:** M
**Prioritás:** Must Have

---

#### US-606: Csoportok mint főoldal és navigáció

**Story:**
Mint **bejelentkezett felhasználó**, szeretnék **bejelentkezés után közvetlenül a csoportjaim oldalát látni**, hogy **azonnal a versenyeim áttekintésével kezdjek**.

**Elfogadási kritériumok:**
- [ ] Bejelentkezés után (és a `/` root route-ra navigálva) a rendszer a `/groups` oldalra irányít (nem `/matches`)
- [ ] A bal oldali navigációs sávban a **Csoportok az első elem** (aktív router-link, nem disabled placeholder)
- [ ] A Meccsek a második nav item marad
- [ ] A `/groups` route létezik és `requiresAuth: true` védelem alatt áll
- [ ] Az AppLayout sidebar Csoportok gombjánál az aktív stílus (`bg-blue-100 text-blue-800 font-semibold`) helyesen jelenik meg a `/groups` oldalon

**Komplexitás:** S
**Prioritás:** Must Have

---

#### US-602: Csatlakozás csoporthoz meghívó kóddal

**Story:**
Mint **bejelentkezett felhasználó**, szeretnék **meghívó kód vagy link segítségével csatlakozni egy csoporthoz**, hogy **barátaim csoportjához bejelentkezhessek**.

**Elfogadási kritériumok:**
- [ ] Csatlakozás lehetséges meghívó kód bevitelével (form) VAGY meghívó link megnyitásával
- [ ] Ha a user már tagja a csoportnak: hibaüzenet "Már tagja vagy ennek a csoportnak"
- [ ] Sikeres csatlakozás után megjelenik a csoport a saját csoportjaid listájában
- [ ] Deaktivált meghívó kód esetén hibaüzenet

**Komplexitás:** M
**Prioritás:** Must Have

---

#### US-603: Csoportonkénti ranglista

**Story:**
Mint **csoport tagja**, szeretnék **a csoport ranglistáját látni csak a tagok pontjaival**, hogy **az én barátaim körében versenyezzek**.

**Elfogadási kritériumok:**
- [ ] A csoport oldalán megjelenik a csoportspecifikus ranglista (csak tagok)
- [ ] A ranglista a csoport pontrendszere alapján számítódik (ha override van)
- [ ] A saját sor kiemelve megjelenik
- [ ] A csoport admin látja ki mikor csatlakozott

**Komplexitás:** M
**Prioritás:** Must Have

---

#### US-604: Csoport kezelése (admin)

**Story:**
Mint **csoport admin**, szeretnék **a csoportot kezelni (tagok, meghívó, pontrendszer)**, hogy **a verseny szabályait én határozzam meg**.

**Elfogadási kritériumok:**
- [ ] Admin látja és kezeli a taglistát (tag eltávolítása lehetséges)
- [ ] Meghívó kód újragenerálható / deaktiválható
- [ ] Admin beállíthatja a csoportszintű pontrendszer override-ot (ha eltér a globálistól)
- [ ] Admin átadhatja az admin szerepkört másik tagnak
- [ ] Platform admin (US-805) az összes csoport taglistáját látja az admin panelen (melyik user melyik csoportban van)

**Komplexitás:** L
**Prioritás:** Must Have

---

#### US-605: Több csoporthoz való tartozás

**Story:**
Mint **bejelentkezett felhasználó**, szeretnék **egyszerre több csoporthoz is tartozni**, hogy **különböző baráti körökkel egyidejűleg versenyezhessek**.

**Elfogadási kritériumok:**
- [ ] Egy user legfeljebb 20 csoporthoz tartozhat egyszerre
- [ ] A "Saját csoportjaim" oldal listázza az összes csoportot, amelynek tagja
- [ ] Minden csoport esetén látható az adott csoport ranglistán elfoglalt helye

**Komplexitás:** S
**Prioritás:** Must Have

---

### E7 – Role kezelés

#### US-701: User és Admin szerepkörök

**Story:**
Mint **rendszer**, szeretnék **minden felhasználóhoz szerepkört rendelni (user/admin)**, hogy **az admin funkciókat csak arra jogosultak érjék el**.

**Elfogadási kritériumok:**
- [ ] Az összes felhasználó alapból `user` szerepkörrel jön létre
- [ ] Admin szerepkör kizárólag egy már admin jogú felhasználó által adható meg
- [ ] API szinten minden admin endpoint ellenőrzi a szerepkört (middleware)
- [ ] Frontend route-okon is érvényesül az admin-only hozzáférés

**Komplexitás:** M
**Prioritás:** Must Have

---

### E8 – Admin panel

#### US-801: Mérkőzés létrehozása

**Story:**
Mint **admin**, szeretnék **új mérkőzést felvinni a rendszerbe**, hogy **a felhasználók elkezdjenek tippelni rá**.

**Elfogadási kritériumok:**
- [ ] Form mezők: hazai csapat, vendég csapat, kezdési időpont (datetime-picker), helyszín, csoport/szakasz, státusz (tervezett/folyamatban/lezárt)
- [ ] Mindkét csapatnak létezőnek kell lennie az adatbázisban (dropdown listából választható)
- [ ] Validáció: nem lehet ugyanarra az időpontra és helyszínre két meccset felvinni
- [ ] Mentés után a meccs azonnal megjelenik a felhasználói nézetben

**Komplexitás:** M
**Prioritás:** Must Have

---

#### US-802: Mérkőzés szerkesztése és törlése

**Story:**
Mint **admin**, szeretnék **mérkőzés adatait módosítani vagy törölni**, hogy **a hibásan felvitt adatokat javíthassam**.

**Elfogadási kritériumok:**
- [ ] Szerkeszthető mezők: időpont, helyszín, csapatok, státusz
- [ ] Törlés: soft delete (deleted_at mező), a hozzá tartozó tippek nem törlődnek
- [ ] Ha már van tipp a meccsre, figyelmeztetés jelenik meg törlés előtt
- [ ] Törölt meccsek egy külön "Archív" szekción láthatók (admin nézetben)

**Komplexitás:** M
**Prioritás:** Must Have

---

#### US-803: Eredmény rögzítése

**Story:**
Mint **admin**, szeretnék **egy lejárt mérkőzés végeredményét rögzíteni**, hogy **a rendszer automatikusan kiszámítsa a pontokat**.

**Elfogadási kritériumok:**
- [ ] Az eredmény rögzítő form csak lezárt státuszú meccseknél érhető el
- [ ] Form: hazai gólszám, vendég gólszám (integer, 0+)
- [ ] Mentés után automatikusan triggerelődik a pontszámítás az összes vonatkozó tippre
- [ ] Az eredmény módosítható (pl. VAR döntés után), ebben az esetben a pontok újraszámítódnak
- [ ] Audit log bejegyzés keletkezik: ki, mikor, mit rögzített

**Komplexitás:** M
**Prioritás:** Must Have

---

#### US-804: Csapatok kezelése

**Story:**
Mint **admin**, szeretnék **a VB-n résztvevő csapatokat felvinni és szerkeszteni**, hogy **a meccsek felépítésekor kiválaszthassam őket**.

**Elfogadási kritériumok:**
- [ ] Csapat adatok: név, rövid kód (pl. "HUN"), zászló/logó URL, csoport (A-H)
- [ ] 32 csapat felvihető (vagy importálható JSON/CSV-ből)
- [ ] Csapat törlése nem engedélyezett, ha meccshez van rendelve

**Komplexitás:** M
**Prioritás:** Must Have

---

#### US-805: Felhasználók kezelése

**Story:**
Mint **admin**, szeretnék **a felhasználókat listázni, szerepkörüket módosítani és tiltani**, hogy **a platform moderálható legyen**.

**Elfogadási kritériumok:**
- [ ] Felhasználók listája: email, display name, szerepkör, regisztráció dátuma, státusz (aktív/tiltott)
- [ ] Szerepkör módosítás: user ↔ admin
- [ ] Tiltás: soft ban (banned_at mező), tiltott user nem tud bejelentkezni
- [ ] Saját magát az admin nem tilthatja / foszthatja meg admin jogától
- [ ] Minden felhasználónál látható, hogy melyik csoport(ok)nak tagja (csoport nevek felsorolva)

**Komplexitás:** M
**Prioritás:** Must Have

---

### E9 – Statisztikai tippek

#### US-901: Statisztikai tipp leadása

**Story:**
Mint **bejelentkezett felhasználó**, szeretnék **a torna egészére vonatkozó statisztikai tippeket leadni** (pl. gólkirály, bajnok csapat), hogy **az egyéni meccs-tippeken túl is versenyezhessek**.

**Elfogadási kritériumok:**
- [ ] A torna megkezdése előtt elérhető egy "Statisztikai tippek" oldal
- [ ] A tippelhető mezők adminisztrátorilag konfigurálhatók (típus: szabad szöveges, dropdown, stb.)
- [ ] Minden mező esetén configban megadott határidőig lehet tippelni
- [ ] A tippek lezárása és kiértékelése is admin feladat

**Komplexitás:** L
**Prioritás:** Should Have

---

#### US-902: Statisztikai tipp típus konfigurálása (admin)

**Story:**
Mint **admin**, szeretnék **statisztikai tipp típusokat létrehozni, szerkeszteni, és pontszámot rendelni hozzájuk**, hogy **flexibilis torna-szintű tippjátékot konfigurálhassak**.

**Elfogadási kritériumok:**
- [ ] Admin felületen tipp típus létrehozása: név, leírás, bemenet típusa (szöveges/dropdown), határidő, pontszám
- [ ] Dropdown típusnál a válaszlehetőségek listája megadható
- [ ] Az adminisztrált értékelés: admin megadja a helyes választ, a rendszer kiszámolja a pontokat
- [ ] A statisztikai tippek pontjai hozzáadódnak a globális ranglistához

**Komplexitás:** L
**Prioritás:** Should Have

---

### E10 – UX / Mobil

#### US-1001: Hamburger menü mobil nézeten

**Story:**
Mint **mobil eszközön böngésző felhasználó**, szeretnék **egy hamburger menüt látni a fejlécben**, hogy **a navigációs elemek ne torlódjanak össze kis képernyőn**.

**Elfogadási kritériumok:**
- [x] Mobil nézeten (< 768px) a sidebar alapból rejtett, helyette hamburger ikon jelenik meg a topbarban
- [x] A hamburger ikonra kattintva overlay drawer nyílik meg a nav itemekkel
- [x] A menü bezárul: nav itemre kattintáskor, vagy a backdrop-ra kattintva
- [x] Desktop nézeten (≥ 768px) az oldalsáv mindig látható (összecsukvható: csak ikonok ↔ ikon + szöveg)
- [x] Topbar: hamburger gomb + "VB Tippjáték" cím + UserMenuButton minden breakpointon egységesen

**Komplexitás:** S
**Prioritás:** Should Have
**Státusz:** ✅ Kész

---

#### US-1002: Felhasználói felület lokalizációja (i18n)

**Story:**
Mint **felhasználó**, szeretnék **az alkalmazást a saját nyelvemen használni (magyar vagy angol)**, hogy **akkor is kényelmes legyen a platform, ha nem vagyok magyar anyanyelvű**.

**Elfogadási kritériumok:**
- [ ] A fordítások külön JSON fájlokban vannak: `src/locales/hu.json` és `src/locales/en.json`
- [ ] Az alkalmazás minden látható szövege (feliratok, gombok, hibaüzenetek, státusz badge-ek) a locale fájlokból töltődik – nincs hardcoded UI szöveg a komponensekben
- [ ] A Profil oldalon egy toggle gomb vált a két nyelv között (pl. "Magyar / English")
- [ ] A kiválasztott nyelv `localStorage`-ban tárolódik, oldal-újratöltés után megmarad
- [ ] Alapértelmezett nyelv: magyar (`hu`)
- [ ] A nyelv váltás azonnali, oldal-újratöltés nélkül

**Technikai megjegyzések:**
- `vue-i18n` v9+ (Composition API mód)
- `useI18n()` composable a komponensekben, `$t()` a template-ben
- A Pinia `locale.store.ts` kezeli az aktív locale-t és a `localStorage` szinkront
- Backend szövegek (API hibaüzenetek) egyelőre angolul maradnak – csak a frontend UI lokalizálódik

**Komplexitás:** M
**Prioritás:** Should Have

---

#### US-1101: Donation gomb és pop-up (dummy fázis)

**Story:**
Mint **bejelentkezett felhasználó**, szeretnék **látni egy diszkrét támogatási lehetőséget az alkalmazásban**, hogy **ha szeretném, könnyen megtehetem a projekt fenntartásához való hozzájárulást**.

**Elfogadási kritériumok:**
- [ ] Az alkalmazás minden oldalán megjelenik egy állandó, de visszafogott "Támogatás" elem (pl. kis szív/kávé ikon a footer-ben vagy a nav jobb sarkában)
- [ ] Az elemre kattintva egy modal / pop-up jelenik meg köszönettel és rövid leírással
- [ ] Ebben a fázisban a pop-up csak egy "Köszönjük!" üzenetet tartalmaz, funkcionális fizetési link nélkül
- [ ] A gomb nem tolakodó: nem nyílik meg automatikusan, csak kattintásra
- [ ] A vizuális stílus illeszkedik az app többi eleméhez (Tailwind, kis méret, muted szín)

**Komplexitás:** S
**Prioritás:** Should Have

---

#### US-1102: Donation átirányítás (valós link fázis)

**Story:**
Mint **bejelentkezett felhasználó**, szeretnék **a donation gombra kattintva egy valós fizetési platformra átirányítódni**, hogy **ténylegesen támogathassam a projektet**.

**Elfogadási kritériumok:**
- [ ] A pop-up tartalmaz egy "Támogatom" gombot, amely egy külső donation platformra irányít (pl. Ko-fi, Buy Me a Coffee, PayPal.me)
- [ ] Az URL a `.env`-ből érkezik (`VITE_DONATION_URL`), nem hardcoded a kódban
- [ ] Az átirányítás új tabban nyílik meg (`target="_blank"`, `rel="noopener noreferrer"`)
- [ ] Ha a `VITE_DONATION_URL` nincs beállítva, a gomb nem jelenik meg (graceful degradation)

**Komplexitás:** S
**Prioritás:** Should Have

---

### E12 – Automatikus adatszinkron

#### US-1201: Futball API kiválasztása és integrációs kutatás

**Story:**
Mint **fejlesztő**, szeretnék **megvizsgálni és kiválasztani a legmegfelelőbb külső futball API-t**, hogy **a meccs- és eredményadatok automatikusan, megbízhatóan és alacsony költséggel szinkronizálhatók legyenek a rendszerbe**.

**Háttér (kutatási összefoglaló):**

| API | Live adat | Coverage | Ár/hó |
|-----|-----------|----------|-------|
| API-Football | ✅ | Top ligák, válogatott, NB I | ~$10–15 (starter) |
| Live-Football-API | ✅ | 1000+ liga | ~$9.99 |
| Sportmonks | ✅ | Minden liga, profi | ~€29 (drágább) |
| football-data.org | ❌ | Korlátozott liga | Ingyenes |
| FootyStats | ⚠️ nem live | Stat-heavy | Ingyenes/olcsó |

**Elfogadási kritériumok:**
- [ ] Legalább két API tesztelve sandbox/free tier-en: API-Football és Live-Football-API
- [ ] Dokumentálva: endpoint struktúra, response format, rate limit, quota/nap
- [ ] Döntési mátrix elkészítve: ár, coverage (VB + NB I), live adat minőség, response latencia, dokumentáció minősége
- [ ] Kiválasztott API rögzítve a `plans/03-tech-stack.md`-ben indoklással
- [ ] A szükséges env változók dokumentálva (`.env.example`: `FOOTBALL_API_KEY`, `FOOTBALL_API_BASE_URL`)
- [ ] Meghatározva: mely endpointok kellenek (fixtures, live scores, teams, standings)

**Komplexitás:** S
**Prioritás:** Should Have

---

#### US-1202: Futball API szinkronizációs service

**Story:**
Mint **fejlesztő**, szeretnék **a kiválasztott futball API-ból meccs- és csapatadatokat lekérdezni és a saját adatbázisba szinkronizálni**, hogy **az admin ne kelljen manuálisan vigye fel az összes mérkőzést és eredményt**.

**Elfogadási kritériumok:**
- [ ] `packages/backend/src/services/football-api.service.ts` – typed HTTP wrapper a külső API fölé; minden közvetlen API hívás itt van, domain logika nélkül
- [ ] `packages/backend/src/services/sync.service.ts` – szinkronizációs logika: fixtures upsert, results upsert, teams upsert; csak a saját DB-t írja
- [ ] Fixtures upsert: mérkőzések betöltése a `matches` táblába (`ON CONFLICT DO UPDATE`)
- [ ] Results upsert: befejezett meccsek eredménye → `match_results` tábla + `matches.status = 'finished'`
- [ ] Teams upsert: csapatok (név, shortCode, flagUrl, group) → `teams` tábla
- [ ] Minden szinkron futás írja az `audit_logs` táblát (`type: 'sync'`, mit szinkronizált, hány rekord)
- [ ] Hibakezelés: API timeout, rate limit (429) → exponential backoff; részleges siker logolva, nem dob el mindent
- [ ] Unit tesztek: `sync.service.test.ts` – mock API válaszokkal, upsert logika, hibakezelés
- [ ] `.env.example` frissítve: `FOOTBALL_API_KEY`, `FOOTBALL_API_BASE_URL`, `FOOTBALL_API_COMPETITION_ID`

**Technikai megjegyzések:**
- `football-api.service.ts` csak typed HTTP wrapper – domain logika tilos benne
- `sync.service.ts` nem hívható közvetlenül HTTP-n – csak a cron job (US-1203) és az admin trigger hívja
- Native `fetch` (Node 18+) – nincs axios dependency

**Komplexitás:** M
**Prioritás:** Should Have

---

#### US-1203: Automatikus adatszinkron cron job

**Story:**
Mint **fejlesztő**, szeretnék **egy ütemezett cron job-ot, amely percenként fut és a DB aktuális állapota alapján dönti el mit kell éppen szinkronizálni**, hogy **az API quota ne pazarlódjon és az adatok mindig naprakészek legyenek**.

**Adaptív döntési logika:**

| DB állapot | Mit hív | Megjegyzés |
|------------|---------|------------|
| Van `status = 'live'` meccs | `sync.service` → live eredmények | Minden percben |
| Nincs live, de van `scheduled` a következő 24 órában | `sync.service` → fixtures frissítés | 10 percenként |
| Meccs `live` → `finished` átment | `sync.service` → végeredmény zárás | Következő futásban azonnal |
| Nincs live és nincs közeli meccs | `sync.service` → csapatok + teljes fixture lista | Naponta egyszer, 03:00 UTC |

**Elfogadási kritériumok:**
- [ ] `packages/backend/src/jobs/sync.job.ts` – a cron job belépési pontja; lekérdezi a DB állapotát, dönt, meghívja a `sync.service` megfelelő metódusait
- [ ] A job percenként fut (`node-cron`); az első lépés mindig egy olcsó DB `SELECT` – ez dönti el a következő lépéseket
- [ ] Rate limit védelem: ha az előző API hívás kevesebb mint X másodperce volt, skip
- [ ] A scheduler indítása `app.ts`-ben, csak `NODE_ENV !== 'test'` esetén
- [ ] Minden futás loggol: mit döntött, mit hívott, hány rekord változott, esetleges hiba
- [ ] Admin manuális trigger: `POST /api/admin/sync` endpoint (csak adminoknak) – azonnali futtatás, ugyanazt a `sync.service`-t hívja

**Technikai megjegyzések:**
- `node-cron` csomag az ütemezéshez – lightweight, nem igényel külső infrastruktúrát
- A cron job a meglévő Railway web service-en belül fut – nincs szükség külön Cron Service-re
- A döntési logika tesztelhető: `sync.job.ts` egy `decideWhatToSync(dbState)` pure függvényt exportál

**Komplexitás:** M
**Prioritás:** Should Have

---

### E13 – Schema evolúció / Liga kezelés

#### US-1301: Liga entitás bevezetése a meccsekhez

**Story:**
Mint **fejlesztő**, szeretnék **a `matches` táblán egy `league_id` foreign key-t bevezetni egy `leagues` táblára hivatkozva**, hogy **a meccsek ligához rendelhetők legyenek (NB I, NB II, VB 2026, stb.) és a frontend szűrni tudjon liga szerint**.

**Elfogadási kritériumok:**
- [ ] Új `leagues` tábla: `id` (UUID PK), `name` (varchar 100), `shortName` (varchar 20), `description` (text, nullable), `createdAt`, `updatedAt`
- [ ] `matches.group_name` (varchar 1) helyett: `matches.league_id` (UUID FK → leagues.id, nullable) + `matches.round` (varchar 20, nullable — pl. "28. forduló", "Group Stage")
- [ ] Drizzle migráció generálva és alkalmazva
- [ ] Backend `League` és `LeagueInput` típusok hozzáadva
- [ ] `Match` API objektumon `league` mező megjelenik (id + name + shortName)
- [ ] Seed SQL fájlok frissítve: liga INSERT + league_id használata a matches INSERT-ben
- [ ] Az összes érintett teszt zöld marad

**Technikai megjegyzések:**
- `group_name varchar(1)` eltávolítandó (VB csoportokhoz a `round` mező elég: "Group A", "Group B")
- `leagues` tábla seed adatok: NB I, NB II, FIFA World Cup 2026, UEFA Nations League
- A `match_number` mező maradhat (VB-s sorrend nyilvántartáshoz)

**Komplexitás:** M
**Prioritás:** Should Have

---

### E14 – Bugok és stabilitás

#### BUG-001: Admin users oldalon minden usernél ugyanaz a Név jelenik meg

**Story:**
Mint **admin**, szeretném, hogy **az admin felhasználók listájában minden user a saját megjelenítési nevét mutassa**, mert jelenleg minden sornál ugyanaz a név szerepel.

**Elfogadási kritériumok:**
- [ ] `GET /api/admin/users` response-ban minden user objektum saját `displayName`-jét tartalmazza
- [ ] Ha a backend helyes adatot ad vissza, a frontend is helyesen rendereli soronként a különböző neveket
- [ ] A hiba forrása azonosítva (backend query / frontend store / template rendering)

**Technikai megjegyzések:**
- Gyanús helyek: `admin-users.service.ts` `getUsers()` query, `admin-users.store.ts` store state, `AdminUsersView.vue` template
- A `upsertUser` displayName-fix (2026-04-03) nem érintette az admin users list query-t
- Debug lépés: network tab-on a `/api/admin/users` response tartalmát ellenőrizni

**Komplexitás:** S
**Prioritás:** Should Have

---

| Story ID | Megnevezés | Komplexitás | Prioritás |
|----------|-----------|-------------|-----------|
| US-001 | Monorepo és dev környezet (Docker) | M | Must Have |
| US-002 | DB schema és seed adatok | S | Must Have |
| US-003 | Tesztelési infrastruktúra | S | Must Have |
| US-004 | Production deploy pipeline | M | Must Have |
| US-101 | Mérkőzések böngészése | M | Must Have |
| US-102 | Mérkőzés részletek | S | Must Have |
| US-201 | Tipp leadása | M | Must Have |
| US-202 | Tipp módosítása | S | Must Have |
| US-203 | Saját tippek összesítő | M | Must Have |
| US-204 | Mások tippjeinek megtekintése | M | Should Have |
| US-301 | Regisztráció Google OAuth-szal | M | Must Have |
| US-302 | Bejelentkezés / kijelentkezés | S | Must Have |
| US-303 | Profil szerkesztése | S | Should Have |
| US-304 | Email + jelszó auth | L | Should Have |
| US-305 | Session perzisztencia oldal-újratöltés után | S | Must Have |
| US-401 | Automatikus pontszámítás | M | Must Have |
| US-402 | Konfigurálható pontrendszer | M | Must Have |
| US-403 | Pontozás tesztelhetősége | S | Must Have |
| US-501 | Globális ranglista | M | Must Have |
| US-502 | Ranglista szűrés/keresés | M | Should Have |
| US-601 | Csoport létrehozása | M | Must Have |
| US-602 | Csatlakozás csoporthoz | M | Must Have |
| US-603 | Csoportonkénti ranglista | M | Must Have |
| US-604 | Csoport kezelése (admin) | L | Must Have |
| US-605 | Több csoporthoz tartozás | S | Must Have |
| US-606 | Csoportok mint főoldal és navigáció | S | Must Have |
| US-701 | User/Admin szerepkörök | M | Must Have |
| US-801 | Mérkőzés létrehozása | M | Must Have |
| US-802 | Mérkőzés szerkesztése/törlése | M | Must Have |
| US-803 | Eredmény rögzítése | M | Must Have |
| US-804 | Csapatok kezelése | M | Must Have |
| US-805 | Felhasználók kezelése | M | Must Have |
| US-901 | Statisztikai tipp leadása | L | Should Have |
| US-902 | Statisztikai tipp típus konfig | L | Should Have |
| US-1001 | Hamburger menü mobil nézeten | S | Should Have |
| US-1002 | Felhasználói felület lokalizációja (i18n) | M | Should Have |
| US-1101 | Donation gomb és pop-up | S | Should Have |
| US-1102 | Donation átirányítás (valós link) | S | Should Have |
| US-1201 | Futball API kiválasztása (kutatás) | S | Should Have |
| US-1202 | Futball API szinkronizációs service | M | Should Have |
| US-1203 | Automatikus adatszinkron cron job | M | Should Have |
| US-1301 | Liga entitás bevezetése a meccsekhez | M | Should Have |
| BUG-001 | Admin users lista: minden sornál ugyanaz a név | S | Should Have |

**Összesítés:**
- Must Have: 26 story (4 technikai + 22 product)
- Should Have: 13 story
- Nice to Have: 0 (ld. E10 epic – részletezés a 04-extras.md-ben)

**Méret szerinti bontás:**
- S (Small): 11 story
- M (Medium): 20 story
- L (Large): 5 story

## 4. Story map (vázlat)

```
FELHASZNÁLÓI AKTIVITÁS FOLYAM
═══════════════════════════════════════════════════════════════════════════

FELFEDEZÉS       BELÉPÉS          TIPPELÉS           VERSENY
─────────────    ────────────     ─────────────────  ───────────────────
Meccsek           Google OAuth     Tipp leadása       Ranglista
böngészése    →   bejelentkezés →  Tipp módosítása →  megtekintése
(US-101)          (US-301)         (US-201,202)       (US-501)

Meccs részletek   Profil setup     Tippek             Csoport
(US-102)          (US-303)         összesítője    →   ranglista
                                   (US-203)           (US-603)

ADMIN FOLYAM
─────────────────────────────────────────────────────────────────────────
Csapatok       Meccsek        Eredmény         Pontok        Ranglisták
kezelése   →   kezelése   →   rögzítése    →   számítása  →  frissülése
(US-804)       (US-801,802)   (US-803)         (US-401)      (auto)
```
