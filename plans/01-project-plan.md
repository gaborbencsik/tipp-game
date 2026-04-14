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
| E14 – Biztonság | Adatbázis-szintű hozzáférés-szabályozás (RLS) | Must Have |

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

#### US-206: Kedvenc csapat beállítása ligánként

**Story:**
Mint **bejelentkezett felhasználó**, szeretnék **ligánként (pl. VB 2026, NB I) egy kedvenc csapatot megjelölni**, hogy **az adott csapat meccseire szerzett pontjaim duplán számítsanak azokban a csoportokban, ahol ez a szabály be van kapcsolva**.

**Kontextus:**
A dupla pont szabály csoportonként kapcsolható be (US-607). Ha egy csoportban be van kapcsolva, a user kedvenc csapatának mérkőzéseire szerzett tipp pontjai automatikusan × 2-re módosulnak. A kedvenc csapat beállítható az adott liga első meccsének kezdetéig — utána csak a még le nem játszott meccsekre vonatkozik a hatás.

**Elfogadási kritériumok:**
- [ ] Profil oldalon (vagy dedikált "Kedvenc csapat" szekcióban) ligánként egy csapatot lehet kijelölni
- [ ] A beállítás az adott liga **első meccsének kezdetéig** szabadon módosítható; utána a már lejátszott meccsekre visszamenőleg nem érvényes
- [ ] Ha a user az első meccs után állít be kedvenc csapatot, a dupla pont csak az ezt követő meccsekre vonatkozik
- [ ] A kedvenc csapat a ranglistán és a csoport ranglistán egy kis ikon/badge-dzsel jelölve van a user neve mellett (pl. a csapat zászlója / shortCode)
- [ ] Ha a user nem állított be kedvenc csapatot, nincs dupla pont — semmi sem kötelező
- [ ] Backend: `favorite_teams` tábla: `userId`, `teamId`, `leagueId` (vagy `tournamentId`), `setAt` — unique constraint `(userId, leagueId)`

**Megjegyzés:**
A dupla pont számítás csak akkor aktív, ha az adott csoportban a `favoriteTeamDoublePoints` flag be van kapcsolva (US-607). Csoporton kívül (globális ranglista) a kedvenc csapat nem hat a pontszámra.

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

#### US-404: Kedvenc csapat dupla pont számítás

**Story:**
Mint **rendszer**, szeretnék **eredmény rögzítésekor a kedvenc csapat dupla pont szabályt alkalmazni a csoportonkénti pontszámítás során**, hogy **a csoportban bekapcsolt szabály automatikusan érvényesüljön**.

**Kontextus:**
Az alap `calculatePoints()` (US-401/403) változatlan marad — a dupla pont egy wrapper logika a csoportonkénti pontmentésnél. Csak azokat a `group_prediction_points` rekordokat érinti, ahol a csoport `favoriteTeamDoublePoints = true` és a user kedvenc csapata részt vesz az adott meccsen.

**Elfogadási kritériumok:**
- [ ] `calculateGroupPoints(matchId, groupId)` service: lekéri a csoport `favoriteTeamDoublePoints` flagét; ha igaz, minden user esetén megnézi, hogy a kedvenc csapata (az adott liga szerint) szerepel-e a meccsen; ha igen, a pont × 2
- [ ] Az alap `calculatePoints()` pure function érintetlen marad
- [ ] A dupla pont csak a `group_prediction_points` táblában jelenik meg, a `predictions.pointsGlobal` nem változik
- [ ] Idempotens: újraszámítás felülírja a régi értéket
- [ ] Unit tesztek: dupla pont aktív + kedvenc csapat játszik → ×2; dupla pont aktív + nem kedvenc csapat → ×1; dupla pont inaktív → ×1; user nincs kedvenc csapat → ×1

**Függőség:** US-206 (favorite_teams tábla), US-607 (favoriteTeamDoublePoints flag)

**Komplexitás:** M
**Prioritás:** Should Have

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

#### US-604-A: Csoport tagkezelés (admin)

**Story:**
Mint **csoport admin**, szeretnék **a csoport tagjait kezelni** — listázni, eltávolítani, admin szerepkört átadni —, hogy **a csoport összetételét én kontrolláljam**.

**Elfogadási kritériumok:**
- [ ] `GET /api/groups/:groupId/members` — taglista (csak csoport tagoknak), tartalmazza: userId, displayName, avatarUrl, isAdmin, joinedAt
- [ ] `DELETE /api/groups/:groupId/members/:userId` — tag eltávolítása (csak csoport admin, saját magát nem távolíthatja el)
- [ ] `PUT /api/groups/:groupId/members/:userId/role` — admin szerep átadása (csak csoport admin, saját magától elveheti ha van másik admin)
- [ ] Backend: mindhárom endpoint `authMiddleware` + csoport-admin jogosultság ellenőrzés
- [ ] `GroupMember` típus (backend + frontend): `userId`, `displayName`, `avatarUrl`, `isAdmin`, `joinedAt`
- [ ] Frontend: `GroupDetailView` kiegészítve „Tagok" tabon — taglista táblázat (avatar, név, szerep badge, csatlakozás dátuma, Eltávolít / Admin átadás gombok)
- [ ] Saját sor kiemelve, saját magát eltávolítani nem lehet (gomb disabled)
- [ ] Törlés előtt confirm dialog
- [ ] Unit tesztek: taglista, eltávolítás, jogosultság ellenőrzés

**Komplexitás:** S
**Prioritás:** Must Have

---

#### US-604-B: Meghívó kód kezelése (admin)

**Story:**
Mint **csoport admin**, szeretnék **a csoport meghívó kódját újragenerálni vagy deaktiválni**, hogy **megakadályozzam illetéktelenek csatlakozását**.

**Elfogadási kritériumok:**
- [ ] `PUT /api/groups/:groupId/invite` — új 8 karakteres kód generálása (régi érvénytelenül), `inviteActive = true`
- [ ] `PATCH /api/groups/:groupId/invite` — invite aktív/inaktív togglelása (`inviteActive` mező)
- [ ] Csak csoport admin hívhatja
- [ ] Frontend: `GroupDetailView` beállítások szekcióban megjelenik a meghívó kód + Másolás gomb + Újragenerálás gomb + Deaktiválás toggle
- [ ] Újragenerálás előtt figyelmeztető üzenet: „A régi meghívó link érvénytelen lesz"
- [ ] Ha `inviteActive = false`, a GroupsView-ban a meghívó kód „Inaktív" felirattal jelenik meg
- [ ] Unit tesztek: újragenerálás, deaktiválás, jogosultság ellenőrzés

**Komplexitás:** S
**Prioritás:** Must Have

---

#### US-604-C: Csoport törlése (admin)

**Story:**
Mint **csoport admin**, szeretnék **a csoportomat törölni**, hogy **ha már nincs rá szükség, el tudjam távolítani**.

**Elfogadási kritériumok:**
- [ ] `DELETE /api/groups/:groupId` — soft delete (`deletedAt` mező), csak csoport admin
- [ ] Törlés előtt confirm dialog: „A csoport és a csoport ranglista véglegesen törlődik"
- [ ] Törlés után a tagok a `/groups` oldalra kerülnek, a csoport eltűnik a listájukból
- [ ] Platform admin (US-805) bármely csoportot törölheti
- [ ] Unit tesztek: törlés, jogosultság ellenőrzés, soft delete szűrés

**Komplexitás:** S
**Prioritás:** Should Have

---

#### US-608: Csoportszintű pontrendszer override

**Story:**
Mint **csoport admin**, szeretnék **a csoportomban eltérő pontértékeket beállítani a globálistól**, hogy **saját szabályok szerint versenyezzünk**.

**Kontextus:**
A `groups.scoringConfigId` FK már létezik a DB-ben, de a csoport ranglista jelenleg a globális `predictions.pointsGlobal`-t használja. Ez a story bevezeti a `groupPredictionPoints` tábla tényleges használatát és a csoportszintű pontszámítást.

**Elfogadási kritériumok:**
- [ ] `PUT /api/groups/:groupId/scoring` — csoport scoring config beállítása (pontos tipp, helyes győztes, gólkülönbség, döntetlen, outcome értékek)
- [ ] Ha nincs override (`scoringConfigId = null`), a globális config érvényes
- [ ] `calculateGroupPoints(matchId, groupId)` service: lekéri a csoport scoring config-ját, kiszámolja és elmenti a `groupPredictionPoints` rekordokat
- [ ] `setResult()` meghívja `calculateGroupPoints()`-t minden csoportra amely tartalmazza a meccs ligáját
- [ ] `getGroupLeaderboard()` átírva: `groupPredictionPoints` összege helyett (jelenleg global `pointsGlobal`)
- [ ] A pontrendszer változtatása csak jövőbeli meccsekre hat
- [ ] Frontend: `GroupDetailView` beállítások tabon scoring form (6 input mező, alapértelmezett értékek a globálisból)
- [ ] Unit tesztek: override érvényesül, globális fallback, idempotens újraszámítás

**Függőség:** US-604-A (GroupDetailView settings tab alapja)

**Komplexitás:** M
**Prioritás:** Must Have

---

#### US-609: Liga filter csoportonként

**Story:**
Mint **csoport admin**, szeretnék **beállítani, hogy a csoport melyik liga(k) meccseit számolja a ranglistához**, hogy **pl. csak VB 2026 meccseken versenyezzünk, NB I nélkül**.

**Kontextus:**
Ez a story az US-1301 (liga entitás bevezetése) után valósítható meg, mert a liga filter liga ID-kra hivatkozik.

**Elfogadási kritériumok:**
- [ ] `group_leagues` junction tábla: `groupId`, `leagueId` — melyik ligák meccsei számítanak a csoportban
- [ ] Ha a tábla üres (nincs filter), minden meccs számít
- [ ] `PUT /api/groups/:groupId/leagues` — liga filter beállítása (liga ID-k listája)
- [ ] `calculateGroupPoints()` figyelembe veszi a liga filtert: csak a filterben szereplő ligák meccseit számolja
- [ ] Frontend: liga filter multi-select a csoport beállításokban
- [ ] Unit tesztek: filter aktív, filter üres (minden meccs), filter módosítás

**Függőség:** US-1301 (liga entitás), US-608 (calculateGroupPoints service)

**Komplexitás:** M
**Prioritás:** Should Have

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

#### US-607: Kedvenc csapat dupla pont szabály bekapcsolása csoportonként

**Story:**
Mint **csoport admin**, szeretnék **a csoportban bekapcsolni egy opcionális szabályt, amely szerint a tagok kedvenc csapatának meccsein szerzett pontjai duplán számítanak**, hogy **extra izgalmat adjak a versenynek**.

**Kontextus:**
A kedvenc csapat profilszinten van beállítva ligánként (US-206) — csoportonként nem felülírható. A dupla pont szabály csak azt kapcsolja be/ki, hogy ez a profilszintű beállítás hat-e a csoport pontszámítására.

**Elfogadási kritériumok:**
- [ ] `groups` táblán új boolean mező: `favoriteTeamDoublePoints` (default: `false`)
- [ ] Csoport admin be- és kikapcsolhatja a szabályt a csoport beállításaiban
- [ ] Ha be van kapcsolva, a csoport ranglistán egy ikon/badge jelzi az aktív szabályt
- [ ] A csoport tagjai látják az aktív szabályt (csoport detail oldalon: „Kedvenc csapat dupla pont: aktív")
- [ ] A szabály változtatása csak jövőbeli meccsekre hat, visszamenőleg nem módosít
- [ ] Ha egy tag nem állított be kedvenc csapatot (US-206), a szabály rá nem vonatkozik (nincs büntetés)

**Függőség:** US-604-A (csoport kezelés admin felület), US-206 (profilszintű kedvenc csapat)

**Komplexitás:** S
**Prioritás:** Should Have

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

#### UX-005: Optimista törlés az admin mérkőzés-listán

**Story:**
Mint **admin**, szeretném, hogy **ha törlök egy meccset és az API kérés sikeres, a sor azonnal eltűnjön a listából**, anélkül hogy újra kellene tölteni az oldalt.

**Elfogadási kritériumok:**
- [ ] Törlés gombra kattintva (és confirm után) az API hívás indul
- [ ] Ha az API sikeres (2xx), a sor azonnal eltűnik a táblázatból (`store.matches`-ből kivesszük optimistán)
- [ ] Ha az API hibát ad vissza, a sor visszakerül a listába és hibaüzenet jelenik meg
- [ ] A viselkedés a csapatok admin listáján is azonos legyen (`AdminTeamsView`)

**Komplexitás:** S
**Prioritás:** Should Have

---

#### UX-006: Csapat zászló/logo megjelenítése a frontend nézetekben

**Story:**
Mint **felhasználó**, szeretném, hogy **a meccslistán, meccs részlet nézetben, saját tippjeimnél és a ranglistán a csapatok neve mellett megjelenjen a zászló/logo ikon**, hogy **a meccseket vizuálisan is könnyen azonosítsam**.

**Kontextus:**
A `teams` táblán lesz `teamType` enum (`national` / `club`), `countryCode` (ISO alpha-2, pl. `hu`, `de`) és `flagUrl` (klub logo URL) mező (lásd US-806). A frontend ezek alapján dönti el mit renderel.

**Renderelési logika (prioritás sorrendben):**
1. `teamType = 'national'` + `countryCode` van → `flag-icons` CSS osztály (`<span class="fi fi-de">`) — SVG zászló, nulla hálózati kérés
2. `teamType = 'club'` + `flagUrl` van → `<img>` a logo URL-lel, törött kép esetén shortCode fallback
3. minden más → `shortCode` szöveg fallback (pl. „GER", „FTC")

**Technikai részletek:**
- `flag-icons` npm csomag telepítése (`npm install flag-icons`) — CSS import, SVG sprite alapú
- FIFA shortCode → ISO alpha-2 mapping: hardcoded konstans a frontenden (~32 VB csapat + NB I klubok country code-ja a DB-ben tárolva)
- Fallback hierarchia garantálja, hogy mindig jelenik meg valami

**Elfogadási kritériumok:**
- [ ] `flag-icons` csomag telepítve, CSS importálva
- [ ] `TeamBadge` komponens létrehozva: fogad `team: { shortCode, teamType, countryCode, flagUrl }` propot, rendereli a fenti logika szerint
- [ ] `MatchesView`: hazai és vendég csapat neve mellett `TeamBadge` megjelenik
- [ ] `MatchDetailView`: mindkét csapatnál `TeamBadge` megjelenik
- [ ] `MyTipsView`: a tippelt meccs soraiban `TeamBadge` megjelenik
- [ ] Törött kép (`onerror`) → automatikusan shortCode szövegre vált
- [ ] A badge fix méretű (`w-6 h-6`)

**Függőség:** US-806 (teamType + countryCode DB migráció) előfeltétel

**Komplexitás:** S
**Prioritás:** Should Have

---

#### US-806: Csapat típus és country code mezők a teams táblában

**Story:**
Mint **fejlesztő**, szeretném, hogy **a `teams` táblán legyen egy `teamType` enum mező (`national` / `club`) és egy `countryCode` mező (ISO alpha-2)**, hogy **a frontend meg tudja különböztetni a válogatottakat a klub csapatoktól, és ennek megfelelően zászlót vagy klub logót tudjon megjeleníteni**.

**Elfogadási kritériumok:**
- [ ] `pgEnum('team_type', ['national', 'club'])` létrehozva a Drizzle schemában
- [ ] `teams` tábla: `teamType: teamTypeEnum('team_type').notNull().default('national')`
- [ ] `teams` tábla: `countryCode: varchar('country_code', { length: 10 })` — nullable (ISO alpha-2, ill. `gb-sct`, `gb-eng` speciális esetekhez)
- [ ] Drizzle migráció generálva és elnevezve (`0003_team_type_country_code.sql`)
- [ ] Backend `Team` és `TeamInput` típusok frissítve (`teamType`, `countryCode` mezőkkel)
- [ ] Frontend `Team` típus frissítve
- [ ] Admin csapatkezelő form (`AdminTeamsView`): `teamType` dropdown (Válogatott / Klub), `countryCode` input mező (csak national esetén látható)
- [ ] `scripts/wc2026-teams.sql` futtatva: 48 VB 2026 csapat (12 csoport, A–L) bekerül a DB-be `ON CONFLICT DO NOTHING`-gal
- [ ] A meglévő seed csapatok lecserélődnek / kiegészülnek a valós VB-s adatokkal
- [ ] Minden meglévő csapathoz `teamType = 'national'` és a megfelelő `countryCode` beállítva (migrációs UPDATE a SQL fájlban)
- [ ] Az összes meglévő teszt zöld marad

**Technikai megjegyzés:**
A `countryCode` ISO alpha-2 formátumban tárolódik (pl. `'hu'`, `'de'`, `'fr'`), kivéve Skócia (`gb-sct`) és Anglia (`gb-eng`) ahol a `flag-icons` csomag az összetett kódot várja. A `flagUrl` mező megmarad klub csapatokhoz. A `scripts/wc2026-teams.sql` fájl tartalmazza mind a 48 csapatot a country code-okkal kommentben — US-806 implementációjakor ezek az oszlopba kerülnek.

**Komplexitás:** S
**Prioritás:** Should Have

---

#### US-807: Admin használati statisztikák (dashboard)

**Story:**
Mint **platform admin**, szeretnék **egy áttekintő statisztikai dashboardot**, hogy **lássam a platform aktivitását, azonosítsam az aktív és inaktív felhasználókat, és döntéseket hozzak a fejlesztési prioritásokról**.

**Javasolt metrikák**

*Összesített mutatók (top kártyák):*

| Metrika | Leírás |
|---------|--------|
| Regisztrált felhasználók | `users` tábla nem-törölt sorok száma |
| Aktív felhasználók (7 nap) | Legalább 1 tippet adott le az elmúlt 7 napban |
| Összes leadott tipp | `predictions` tábla sor száma |
| Kitöltési arány | `predictions / (users × meccsek)` — hány % a tényleges részvétel |
| Csoportok száma | Nem-törölt csoportok |
| Átlagos csoport méret | `group_members` tagok / csoportok |

*Felhasználónkénti táblázat (rangsorolt, szűrhető):*

| Oszlop | Forrás |
|--------|--------|
| Felhasználó (avatar + név) | `users` |
| Regisztrálva | `users.createdAt` |
| Összes tipp | `count(predictions)` |
| Kitöltési % | `predictions / meccsek_száma × 100` |
| Szerzett pont | `sum(predictions.pointsGlobal)` |
| Csoportok száma | `count(group_members)` |
| Utolsó aktivitás | `max(predictions.createdAt)` |
| Tiltott? | `users.isBanned` badge |

*Meccs-szintű statisztikák (táblázat):*

| Oszlop | Leírás |
|--------|--------|
| Meccs | csapatok + dátum |
| Tippelt / összes user | hányan tippeltek erre |
| Kitöltési % | részvétel aránya |
| Átlag hazai tipp | összes leadott hazai gólszám átlaga |
| Átlag vendég tipp | összes leadott vendég gólszám átlaga |
| Eredmény | ha már van |

*Aktivitási trend (opcionális, Nice to Have szinten):*
- Napi/heti tipp leadások száma az elmúlt 30 napban (egyszerű bar chart vagy sparkline)

**Elfogadási kritériumok:**
- [ ] `GET /api/admin/stats` endpoint — `authMiddleware + adminMiddleware`
- [ ] Response tartalmazza: `userCount`, `activeUsersLast7Days`, `predictionCount`, `fillRate`, `groupCount`, `avgGroupSize`
- [ ] `GET /api/admin/stats/users` — felhasználónkénti aggregált adatok (tipp db, pontszám, csoport db, utolsó aktivitás)
- [ ] `GET /api/admin/stats/matches` — meccs-szintű részvételi statisztikák
- [ ] Frontend: `/admin/stats` route — `requiresAuth + requiresAdmin`
- [ ] Admin menüben "Statisztikák" link megjelenik
- [ ] Top kártyák renderelve (összesített mutatók)
- [ ] Felhasználónkénti táblázat: rendezhető tipp db / pont / kitöltés szerint
- [ ] Meccs-szintű táblázat: kitöltési % alapján rendezhető
- [ ] Minden adat valós idejű (nem cachelt) — az oldal betöltésekor friss lekérdezés
- [ ] Backend unit tesztek az aggregációs service-hez
- [ ] Frontend tesztek az `AdminStatsView`-hoz

**Technikai megjegyzések:**
- Külön `stats.service.ts` — ne keveredjen a meglévő service-ekkel
- Az összes aggregáció egy SQL-lekérdezéssel vagy néhány hatékony Drizzle query-vel megoldható (nem N+1)
- `fillRate` = `predictionCount / (userCount × matchCount) × 100`, ahol `matchCount` az összes nem-törölt meccs

**Komplexitás:** M
**Prioritás:** Should Have

---

### E9 – Statisztikai tippek

#### US-901: Statisztikai tipp leadása (csoportszinten)

**Story:**
Mint **bejelentkezett felhasználó**, szeretnék **a csoportomban konfigurált statisztikai tippeket leadni** (pl. gólkirály, bajnok csapat), hogy **az egyéni meccs-tippeken túl is versenyezhessek a csoporton belül**.

**Kontextus:**
A stat tippek nem globálisak — minden csoport admin külön kapcsolhatja be és konfigurálhatja őket a csoportjában (US-604-A). A stat tippek pontjai kizárólag a csoport ranglistájához adódnak hozzá.

**Elfogadási kritériumok:**
- [ ] Ha a csoportban a stat tippek be vannak kapcsolva, a csoport oldalán megjelenik egy "Statisztikai tippek" szekció
- [ ] Csak az adott csoport által konfigurált tipp típusok jelennek meg
- [ ] Minden mező esetén a csoport admin által megadott határidőig lehet tippelni
- [ ] A tippek lezárása és kiértékelése a csoport admin feladata
- [ ] Ha nincs a csoportban stat tipp konfigurálva, a szekció nem jelenik meg

**Komplexitás:** L
**Prioritás:** Should Have

---

#### US-902: Statisztikai tipp típus konfigurálása (csoport admin)

**Story:**
Mint **csoport admin**, szeretnék **a csoportomban statisztikai tipp típusokat létrehozni, szerkeszteni és pontszámot rendelni hozzájuk**, hogy **flexibilis, csoportspecifikus torna-szintű tippjátékot konfigurálhassak**.

**Kontextus:**
A stat tipp típusok csoporthoz kötöttek, nem globálisak. Minden csoport admin a saját csoportjához hozhat létre tipp típusokat.

**Elfogadási kritériumok:**
- [ ] Csoport admin felületen tipp típus létrehozása: név, leírás, bemenet típusa (szöveges/dropdown), határidő, pontszám
- [ ] Dropdown típusnál a válaszlehetőségek listája megadható (pl. csapat nevek)
- [ ] Admin megadja a helyes választ kiértékeléskor, a rendszer kiszámolja a pontokat
- [ ] A stat tippek pontjai csak a csoport ranglistájához adódnak hozzá, a globális ranglistához **nem**
- [ ] Egy csoport admin más csoportok stat tipp konfigját nem látja / nem szerkeszti

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
- [ ] A bal oldali navigációs sávban (AppLayout sidebar) a nav itemek alatt, az aljára rögzítve megjelenik egy "🍺 Támogasd a projektet" gomb
- [ ] A gomb stílusa visszafogott (amber szín), illeszkedik a nav többi eleméhez; összecsukott sidebarban csak az emoji látható
- [ ] A gombra kattintva egy modal / pop-up jelenik meg köszönettel és rövid leírással
- [ ] Ebben a fázisban a pop-up csak egy "Köszönjük!" üzenetet tartalmaz, funkcionális fizetési link nélkül
- [ ] A gomb nem tolakodó: nem nyílik meg automatikusan, csak kattintásra
- [ ] A vizuális stílus illeszkedik az app többi eleméhez (Tailwind, kis méret, muted szín)

**Technikai megjegyzések (AppLayout layout fix — szükséges előfeltétel):**
- A gyökér `div` legyen `h-screen flex flex-col overflow-hidden` (jelenleg `min-h-screen`)
- A `flex flex-1 min-h-0` container kapjon `h-full`-t
- Az `<aside>` kapjon `md:h-full`-t
- A `<nav>` legyen `flex-1` hogy a donation gomb `mt-auto`-val az aljára kerüljön
- A main content area kapjon `overflow-y-auto`-t, hogy a tartalom scrollozható maradjon

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

#### UX-001: Tipp input UX javítások

**Story:**
Mint **felhasználó**, szeretném, hogy **a tipp beviteli mezők kényelmesebben használhatók legyenek**, hogy **gyorsabban és kevesebb kattintással tudjak tippet rögzíteni**.

**Elfogadási kritériumok:**
- [ ] **Autosave debounce:** tipp automatikusan mentésre kerül 2 másodperccel az utolsó gombnyomás után (nincs szükség "Mentés" gombra kattintani)
- [ ] **Fókusz → select:** mezőbe kattintáskor / tab-bal belépéskor a tartalom azonnal ki van jelölve (felülírható anélkül, hogy törölni kellene)
- [ ] **Üres mező fókuszáláskor → 0:** ha a mező üres volt, fókuszáláskor `0` kerül bele és az ki is van jelölve
- [ ] **Szám beütése → következő mező:** ha a user begépel egy számot (0-9), a fókusz automatikusan a másik (away/home) mezőre ugrik
- [ ] A "Mentés" gomb maradhat fallback-ként manuális mentéshez
- [ ] `saveStatus` visszajelzés ("Tipp elmentve!") az autosave után is megjelenik

**Technikai megjegyzések:**
- Debounce: `setTimeout` + `clearTimeout` az input event handlerben, 2000ms
- Select on focus: `input.select()` a `@focus` event handlerben
- Következő mező: `@keydown` figyelés `0-9` billentyűkre, `nextTick` után `nextInput.focus()` + `nextInput.select()`
- Érintett komponensek: `MatchesView.vue` inline tipp form, `MatchDetailView.vue` tipp form

**Komplexitás:** S
**Prioritás:** Should Have

---

#### UX-003: Távoli jövőbeli meccsek összecsukvása a meccslistán

**Story:**
Mint **felhasználó**, szeretném, hogy **a mérkőzések listáján csak a következő 7 napban esedékes meccsek legyenek alapból láthatók**, hogy **ne kelljen a messze jövőbeli meccsek között görgetni**.

**Elfogadási kritériumok:**
- [ ] A mai naptól számított 7 napnál távolabbi, `scheduled` státuszú meccsek alapból össze vannak csukva — egyetlen "Korábbi mérkőzések megjelenítése (N db)" gombban
- [ ] A gombra kattintva az összes ilyen meccs megjelenik napokra bontva (a meglévő dátumcsoportok szerint)
- [ ] Az összecsukott állapotban egy összefoglaló sor jelenik meg (pl. "▶ 42 további tervezett mérkőzés") a lista alján
- [ ] `finished`, `live`, és a 7 napon belüli `scheduled` meccsek érintetlenek maradnak
- [ ] A 7 napos ablak a kliens aktuális dátumához képest számítódik

**Technikai megjegyzések:**
- `showFutureMatches` ref: `boolean` — alapból `false`
- A `matchesByDate` computed eredményét a view-ban kell szűrni: dátum < today+7 napig megjelenik, a többi csak ha `showFutureMatches === true`
- Érintett fájl: `MatchesView.vue`

**Komplexitás:** S
**Prioritás:** Should Have

**Story:**
Mint **felhasználó**, szeretném, hogy **a mérkőzések listáján a már befejezett meccsek alapból össze legyenek csukva**, hogy **ne kelljen görgetni rajtuk keresztül és a nyitott meccsekre fókuszálhassak**.

**Elfogadási kritériumok:**
- [ ] A `finished` státuszú meccseket tartalmazó nap-csoportok alapból össze vannak csukva (csak a dátumcímke látható)
- [ ] A dátumcímkére kattintva kinyílik a csoport, először csak az **utolsó 5** befejezett meccset mutatja
- [ ] Ha több mint 5 befejezett meccs van, megjelenik egy "Összes mutatása (N db)" gomb, amely az összeset megjeleníti
- [ ] `scheduled` és `live` meccseket tartalmazó csoportok mindig nyitva vannak (nem csukhatók össze)
- [ ] Az összecsukott állapot vizuálisan egyértelmű (pl. chevron ikon a dátumcímke mellett)

**Technikai megjegyzések:**
- A `matchesByDate` computed-ból kiolvasható hogy egy nap-csoport csak `finished` meccseket tartalmaz-e
- `collapsedDates` ref: `Set<string>` — inicializáláskor minden csak-finished napot hozzáad
- `expandedCount` ref: `Record<string, number>` — 5-ről indul, "Összes mutatása" gombra az összes meccs számára ugrik
- Érintett fájl: `MatchesView.vue`

**Komplexitás:** S
**Prioritás:** Should Have

---

#### UX-004: Focilabda kurzor ikon

**Story:**
Mint **felhasználó**, szeretném, hogy **az alkalmazás loading állapotában és kattintható elemeken egy focilabda emoji kurzor jelenjen meg**, hogy **az oldal sportos hangulata vizuálisan is megjelenjen a legapróbb részletekben is**.

**Elfogadási kritériumok:**
- [ ] Loading spinner helyén (vagy mellett) a kurzor ⚽ focilabda emoji ikonra változik
- [ ] Kattintható gombokra és linkekre húzva a kurzor focilabda ikonra vált
- [ ] Normál (nem interaktív) szövegen a kurzor alapértelmezett marad
- [ ] A custom kurzor CSS-sel valósul meg (`cursor: url(...)`) fallback-kel (`cursor: pointer`)
- [ ] Mobilon (ahol nincs kurzor) a változás nem okoz vizuális hibát

**Technikai megjegyzések:**
- CSS `cursor` property SVG vagy PNG data URL-lel: `cursor: url("data:image/svg+xml,..."), auto`
- Tailwind v4-ben custom `cursor-soccer` utility osztály definiálható `@theme` block-ban
- Érintett fájlok: `style.css` (global cursor definíció), opcionálisan `AppLayout.vue` és spinner komponensek

**Komplexitás:** S
**Prioritás:** Nice to Have

---

### E14 – Biztonság

#### SEC-001: Row-Level Security bekapcsolása minden Supabase táblán

**Story:**
Mint **fejlesztő és rendszergazda**, szeretném, hogy **minden adatbázis-tábla Row-Level Security (RLS) védelemmel rendelkezzen**, hogy **a Supabase PostgREST API-n keresztül senki ne férhessen hozzá közvetlenül az adatokhoz az anon key segítségével**, még ha a JWT-alapú backend API is teljesen el van zárva a frontendtől.

**Kontextus:**
A Supabase email-figyelmeztetést küldött: az összes tábla nyilvánosan elérhető, mert nincs RLS bekapcsolva. Bár az alkalmazás nem használja a Supabase PostgREST API-t (minden adat a Koa backend API-n megy át), az `anon` key publikus a frontend bundle-ban, és valaki közvetlen PostgREST hívásokkal olvashatna/írhatna az adatbázisba.

**Megoldás:**
- `ALTER TABLE ... ENABLE ROW LEVEL SECURITY` minden táblára egy új Drizzle migrációban
- Explicit `DENY` policy nélkül az RLS bekapcsolása automatikusan blokkol minden PostgREST/anon hozzáférést
- A backend `DATABASE_URL` connection string-et (service role / direkt psql user) **nem érinti** az RLS — az app tovább működik változtatás nélkül
- Supabase service role (`service_role` key) automatikusan bypass-olja az RLS-t

**Elfogadási kritériumok:**
- [ ] Minden táblán (`users`, `teams`, `venues`, `matches`, `match_results`, `scoring_configs`, `groups`, `group_members`, `predictions`, `group_prediction_points`, `special_prediction_types`, `special_predictions`, `audit_logs`) be van kapcsolva az RLS
- [ ] Új Drizzle migráció generálva és elnevezve (`0003_enable_rls.sql`)
- [ ] A backend összes meglévő tesztje változatlanul zöld (a backend nem érinti az RLS-t)
- [ ] A Supabase dashboard biztonsági figyelmeztetése eltűnik a migráció futtatása után
- [ ] Manuálisan tesztelve: Supabase anon key-jel közvetlen `curl` hívás → 401/403 visszaadva

**Megjegyzés a migrációs stratégiáról:**
Mivel a backend Drizzle ORM-et használ és direkt DB kapcsolaton ér el mindent, az RLS bekapcsolása **kizárólag a PostgREST réteget zárja le**. Nincs szükség `POLICY` definíciókra — az "implicit deny all" elég.

**Komplexitás:** S
**Prioritás:** Must Have (biztonsági javítás)

---

### E13 – Landing & Marketing

#### DISC-001: Landing oldal discovery (design + marketing + social stratégia)

**Story:**
Mint **projekt tulajdonos**, szeretném, hogy **legyen egy átgondolt landing oldal terv** — design struktúrával, szövegekkel, social stratégiával és a megvalósításhoz szükséges erőforrások listájával —, hogy **a VB 2026 előtt hatékonyan tudjuk bevezetni az appot barátok, munkahelyi közösségek és általános focifanok körében**.

> Ez egy **thinking/discovery story**: az output egy részletes terv, nem kód. Az implementáció külön story-kban kerül majd lebontásra.

---

**Elfogadási kritériumok:**

- [ ] **Design terv** elkészül (oldaltérkép + szekciók)
- [ ] **Marketingszöveg** minden szekcióhoz megvan (headline, subheadline, CTA szöveg)
- [ ] **Social stratégia** leírva (platformok, poszt típusok, ütemezés)
- [ ] **Gerilla marketing ötletek** dokumentálva
- [ ] **Szükséges erőforrások** listázva (design assets, domain, email tool, stb.)
- [ ] **Waitlist / értesítési megoldás** kiválasztva

---

**1. Design terv – oldalstruktúra**

Javasolt szekciók (egy hosszú scrollolható oldal, opcionális anchor-alapú almenüvel):

| # | Szekció | Funkció |
|---|---------|---------|
| 1 | **Hero** | Fő headline + subheadline + email waitlist CTA |
| 2 | **Hogyan működik?** | 3 lépéses vizuális flow (regisztrálj → tippelj → nyerj) |
| 3 | **Funkciók** | Feature kártyák: csoportok, ranglista, autosave tipp, pontrendszer |
| 4 | **Kinek szól?** | Két persona kártya: barátok / munkahely |
| 5 | **Screenshots / preview** | App mockup képernyőképek vagy animált demo |
| 6 | **Közösség** | Social proof: „X ember már feliratkozott / vár" |
| 7 | **FAQ** | 4-5 leggyakoribb kérdés (ingyenes-e? mobilon működik? stb.) |
| 8 | **Footer CTA** | Ismételt email waitlist + social linkek + donation link |

Opcionális sticky nav anchor linkekkel: `Funkciók | Hogyan működik? | FAQ | Értesítés`

**Vizuális irány:**
- Sportos, de modern — nem „foci fan shop" hangulat, hanem tech + focilabda ⚽
- Sötétzöld + fehér + sárga akcentus (VB szín asszociáció)
- Hero háttér: subtilis pályaminta vagy stadion blur fotó
- Responsive first — mobilon barátok körében terjed

---

**2. Marketingszövegek**

**Hero szekció:**
> **Headline:** Tippelj. Vezess. Győzz a barátaid között.
> **Subheadline:** A VB 2026 legjobb tippjátéka — csoportok, ranglista, automatikus pontozás. Értesítünk, amikor elindul.
> **CTA gomb:** Értesíts a megjelenéskor →
> **Microcopy:** Ingyenes. Spam nélkül. Leiratkozhatsz egy kattintással.

**Hogyan működik?**
> 1. **Hozz létre egy csoportot** — hívd meg a barátaidat vagy kollégáidat meghívó kóddal
> 2. **Tippeld meg a meccseket** — eredmény, hosszabbítás, tizenegyes — minden mérkőzés előtt
> 3. **Kövesd a ranglista** — pontok automatikusan számolódnak, te csak élvezed

**Feature kártyák:**
> ⚽ **Csoportok** — Privát vagy publikus csoportot hozhatsz létre, a ranglista csak a tagoknak látszik
> 📊 **Automatikus pontozás** — Pontos tipp, helyes győztes, gólkülönbség — minden pontot ér
> 🔔 **Meccs előtti figyelmeztetés** — Nem maradsz le egy tippről sem
> 🏆 **Globális ranglista** — Mérd össze magad nemcsak a barátaiddal, hanem mindenkivel

**Kinek szól? – Két persona:**
> **👨‍👩‍👧‍👦 Baráti társaságok**
> „Minden VB-n van egy WhatsApp-csoport és egy Excel. Most legyen egy igazi app."
>
> **🏢 Munkahelyek**
> „A legjobb csapatépítő, amit a főnök is megenged."

**FAQ:**
> *Ingyenes?* Igen, teljesen ingyenes.
> *Kell regisztrálni?* Google-fiókkal egy kattintás.
> *Mobilon is működik?* Igen, böngészőből mobilon is elérhető.
> *Mikor indul?* A VB 2026 előtt. Iratkozz fel, értesítünk.
> *Kell-e focit érteni?* Nem — elég, ha szurkolsz.

---

**3. Social stratégia**

**Platformok és hangnem:**

| Platform | Hangnem | Tartalom típus | Frekvencia |
|----------|---------|----------------|-----------|
| **Facebook** | Közösségi, barátságos | Csoportok, megosztható képek, event | 3–4x/hét VB előtt |
| **Instagram** | Vizuális, sportos | Stories, Reels, mockup képek | 2–3x/hét |

**Tartalom pillérök (mindkét platformon):**
1. **Hype építés** — visszaszámláló a VB-ig, „X nap múlva kezdődik"
2. **Oktatás** — „Tudtad, hogy...?" poszt a pontrendszerről, hogyan működik a tipp
3. **Social proof** — „Már N-en feliratkoztak" milestone poszток
4. **UGC ösztönzés** — „Hívd meg a haverodat, aki mindig tudja a tippet" → megosztható kártya
5. **Meccs közbeni engagement** — „Megvan a tipped?" – live reminder poszт meccs napján

**Instagram Reels ötletek:**
- 15 mp-es „Hogyan működik" animált walkthrough
- „Barátod mindig megmondja előre az eredményt? Tedd próbára." hook
- Visszaszámláló stories sorozat (D-30 → D-1)

**Facebook specifikus:**
- Foci-témájú Magyar FB csoportokban organikus megosztás (pl. „Magyar szurkolók", VB-s csoportok)
- Facebook Event a VB indulásához kötve

---

**4. Gerilla marketing ötletek**

- **WhatsApp/Telegram forward bait:** Egy tömör, vicces szöveg ami természetesen terjed: „Megcsináltuk azt az appot amit mindenki hiányolt VB-n. Tippeljetek ti is: [link]"
- **Reddit / programozói fórumok:** r/hungary, r/webdev — „Megcsináltam egy VB tippjátékot, tesztelőket keresek" — autentikus, nem reklám hangvétel
- **QR-kód matricák** irodákban, kocsmákban VB idején: „Ki nyer a VB-n? Tippelj itt." → landing oldal
- **Meghívó kártyák**: PDF letölthető „csoportindító csomag" — formális és vicces változat — amit a szervező kinyomtathat és kioszthat
- **„Challenged":** barátok egymás között challange-elhetik a landing oldalon (waitlist mellé egy „Hívj meg valakit" flow)
- **Sportbárok / közvetítések:** VB meccsek alatt QR kód a pultosoknak kiosztva

---

**5. Szükséges erőforrások**

| Erőforrás | Leírás | Eszköz / Forrás |
|-----------|--------|-----------------|
| **Domain** | pl. `vbtipp.hu` vagy `tippjatek.hu` | domains.google, tarhely.eu |
| **Landing oldal** | Statikus HTML/Vue oldal VAGY no-code megoldás | Astro / Nuxt / Framer / Webflow |
| **Email waitlist** | Feliratkozók kezelése, értesítő kiküldés | Mailchimp free tier / Brevo / Resend |
| **OG image** | Social share preview kép (1200×630px) | Figma / Canva |
| **Hero fotó / illusztráció** | Pályakép, focilabda, stadion — jogmentes | Unsplash, Pexels, Freepik |
| **App screenshots** | Valódi vagy mockup képernyőképek | macOS Screenshot + Screely.com |
| **Analytics** | Látogatók és konverzió mérése | Plausible (privacy-first) / GA4 |
| **Social accounts** | Facebook oldal + Instagram profil | Létrehozandó, egységes arculattal |
| **Logo / brand** | Minimális: szöveges logo + ⚽ ikon | Figma / Canva |
| **Hosting** | Landing statikus deployja | Vercel (már megvan) / Netlify |

---

**Komplexitás:** L
**Prioritás:** Should Have

---

### E14 – Biztonság (kiegészítés)

#### SEC-002: HMAC-aláírt meghívó URL-ek

**Story:**
Mint **fejlesztő**, szeretném, hogy **a meghívó URL-ek kriptográfiai aláírással legyenek védve**, hogy **a join endpoint rate limit nélkül is biztonságos legyen, és a meghívó kód brute-force kipörgetése matematikailag lehetetlenné váljon**.

**Kontextus:**
Jelenleg a join endpoint IP-alapú rate limittel van védve. Ez elegendő a legtöbb esethez, de a HMAC megközelítés infrastruktúra-független védelmet nyújt: a kód maga tartalmazza az aláírást, így érvénytelen kód soha nem ér el DB-t.

**Megoldás:**
- Az invite URL formátuma: `/join/ABCD1234.a3f2b1c4d5e6f7a8b9c0...` (kód + HMAC-SHA256 signature)
- A signature az `INVITE_HMAC_SECRET` env változóval generálódik
- A backend validálja a signature-t a DB lookup előtt — érvénytelen signature → 400, nincs DB hit
- A meglévő `inviteCode` mező és `inviteActive` logika változatlan marad
- Regenerálásnál az új kód új signature-t kap

**Elfogadási kritériumok:**
- [ ] `INVITE_HMAC_SECRET` env változó bevezetve mindkét környezetbe
- [ ] `generateSignedInviteCode(code, secret): string` pure helper függvény
- [ ] `verifyInviteCode(signedCode, secret): string | null` — visszaadja a raw kódot vagy null-t
- [ ] `/api/groups/join` endpoint validálja a signature-t DB lookup előtt
- [ ] Meglévő join tesztek frissítve, új unit tesztek a helper függvényekhez
- [ ] A rate limit megmarad (defense in depth)

**Komplexitás:** S
**Prioritás:** Nice to Have

---


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
| US-205 | Hosszabbítás/tizenegyes outcome tipp | M | Should Have |
| US-206 | Kedvenc csapat beállítása ligánként | M | Should Have |
| US-301 | Regisztráció Google OAuth-szal | M | Must Have |
| US-302 | Bejelentkezés / kijelentkezés | S | Must Have |
| US-303 | Profil szerkesztése | S | Should Have |
| US-304 | Email + jelszó auth | L | Should Have |
| US-305 | Session perzisztencia oldal-újratöltés után | S | Must Have |
| US-401 | Automatikus pontszámítás | M | Must Have |
| US-402 | Konfigurálható pontrendszer | M | Must Have |
| US-403 | Pontozás tesztelhetősége | S | Must Have |
| US-404 | Kedvenc csapat dupla pont számítás | M | Should Have |
| US-501 | Globális ranglista | M | Must Have |
| US-502 | Ranglista szűrés/keresés | M | Should Have |
| US-601 | Csoport létrehozása | M | Must Have |
| US-602 | Csatlakozás csoporthoz | M | Must Have |
| US-603 | Csoportonkénti ranglista | M | Must Have |
| US-604-A | Csoport tagkezelés (admin) | S | Must Have |
| US-604-B | Meghívó kód kezelése (admin) | S | Must Have |
| US-604-C | Csoport törlése (admin) | S | Should Have |
| US-605 | Több csoporthoz tartozás | S | Must Have |
| US-606 | Csoportok mint főoldal és navigáció | S | Must Have |
| US-607 | Kedvenc csapat dupla pont szabály (csoport beállítás) | S | Should Have |
| US-608 | Csoportszintű pontrendszer override | M | Must Have |
| US-609 | Liga filter csoportonként | M | Should Have |
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
| UX-001 | Tipp input UX javítások (autosave, select, autonext) | S | Should Have |
| UX-002 | Befejezett meccsek összecsukvása a meccslistán | S | Should Have |
| UX-003 | Távoli jövőbeli meccsek összecsukvása a meccslistán | S | Should Have |
| UX-004 | Focilabda kurzor ikon | S | Nice to Have |
| UX-005 | Optimista törlés az admin listákon | S | Should Have |
| UX-006 | Csapat zászló/logo megjelenítése (flag-icons) | S | Should Have |
| US-806 | Csapat típus és country code mezők (DB migráció) | S | Should Have |
| US-807 | Admin használati statisztikák (dashboard) | M | Should Have |
| DISC-001 | Landing oldal discovery (design + marketing + social) | L | Should Have |
| SEC-001 | Row-Level Security bekapcsolása (Supabase RLS) | S | Must Have |
| SEC-002 | HMAC-aláírt meghívó URL-ek | S | Nice to Have |

**Összesítés:**
- Must Have: 30 story (4 technikai + 26 product)
- Should Have: 24 story
- Nice to Have: 2 (UX-004, SEC-002 + ld. E10 epic – részletezés a 04-extras.md-ben)

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
