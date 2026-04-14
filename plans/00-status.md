# VB Tippjáték – Implementációs státusz

> Utoljára frissítve: 2026-04-14 (US-604-A, US-604-B, US-604-C, US-402 kész; SEC-002 backlogba felvéve)

## Kész user story-k

| Story ID | Megnevezés | Megjegyzés |
|----------|-----------|------------|
| **US-001** | Monorepo és fejlesztői környezet (Docker) | ✅ Kész |
| **US-002** | DB schema és seed adatok | ✅ Kész |
| **US-003** | Tesztelési infrastruktúra | ✅ Kész |
| **US-301** | Regisztráció és bejelentkezés (Google OAuth) | ✅ Kész |
| **US-302** | Bejelentkezés / kijelentkezés | ✅ Kész |
| **US-304** | Email + jelszó auth | ✅ Kész |
| **US-101** | Mérkőzések böngészése | ✅ Kész |
| **US-201** | Tipp leadása | ✅ Kész |
| **US-202** | Tipp módosítása | ✅ Kész (US-201-gyel együtt) |
| **US-701** | User/Admin szerepkörök | ✅ Kész |
| **US-804** | Csapatok kezelése (admin) | ✅ Kész |
| **US-305** | Session perzisztencia oldal-újratöltés után | ✅ Kész |
| **US-303** | Profil megtekintése és szerkesztése | ✅ Kész |
| **US-805** | Felhasználók kezelése (admin) | ✅ Kész |
| **US-1001** | Hamburger menü / AppLayout (Gmail-stílus) | ✅ Kész |
| **US-601** | Csoport létrehozása | ✅ Kész |
| **US-602** | Csatlakozás csoporthoz | ✅ Kész |
| **US-1201** | Futball API kiválasztása (kutatás) | ✅ Kész |
| **US-205** | Hosszabbítás/tizenegyes kimenetel tipp | ✅ Kész |
| **US-604-A** | Csoport tagkezelés (admin) | ✅ Kész |
| **US-604-B** | Meghívó kód kezelése (admin) | ✅ Kész |
| **US-604-C** | Csoport törlése (admin) | ✅ Kész |
| **US-402** | Konfigurálható pontrendszer | ✅ Kész |

### US-001 – Elfogadási kritériumok teljesítve

- ✅ `docker-compose.yml`: PostgreSQL 17, Koa backend (hot reload), Vue frontend (Vite dev server)
- ✅ `docker compose up` után elérhető: `http://localhost:5173`, `http://localhost:3000/api/health`
- ✅ Backend induláskor automatikusan futtatja a Drizzle migrációkat
- ✅ Hot reload: volumes mount-on keresztül, konténer rebuild nélkül
- ✅ `.env.example` minden szükséges változóval; `README.md` leírja a setup lépéseit
- ✅ `VITE_DEV_AUTH_BYPASS=true` – mock userrel bejelentkezés OAuth redirect nélkül
- ✅ Minden service health check-kel rendelkezik
- ⚠️ Docker DB verzió: lokálisan `postgres:17` (a `postgres:18` image még nem érhető el); prod: Supabase Postgres 18.3

### US-002 – Elfogadási kritériumok teljesítve

- ✅ `npm run db:generate` – Drizzle Kit generálja a migrációs fájlokat
- ✅ `npm run db:migrate` – futtatja a migrációkat
- ✅ `npm run db:seed` – 32 csapat, 10 meccs (scheduled/live/finished/cancelled), 1 admin user, 1 scoring config
- ✅ Seed idempotens (`ON CONFLICT DO NOTHING`)
- ✅ Migrációk verziókövetésben vannak (`src/db/migrations/`)

### US-003 – Elfogadási kritériumok teljesítve

- ✅ `npm test` a monorepo gyökeréből mindkét package tesztjeit futtatja
- ✅ Workspace-szintű futtatás is működik (`--workspace=packages/backend` / `--workspace=packages/frontend`)
- ✅ Backend scoring service: 19 unit teszt, 100% coverage
- ✅ Frontend: 10 unit teszt (api client, auth store, LoginView, HomeView)
- ✅ Coverage report: `npm run test:coverage` – Istanbul provider, `text` + `html` riporter
- ✅ GitHub Actions CI: `.github/workflows/ci.yml` – typecheck → test minden push/PR-on

### US-301 – Elfogadási kritériumok teljesítve

- ✅ Login oldalon "Bejelentkezés" gomb látható; Google OAuth flow-t a Supabase Auth kezeli
- ✅ Supabase Auth kezeli a consent screen → callback → session folyamatot
- ✅ Sikeres auth után a Supabase JS client tárolja a session tokent (auto-refresh)
- ✅ Backend minden védett API híváshoz ellenőrzi a Supabase JWT-t (`Authorization: Bearer <token>`) – `auth.middleware.ts`, `SUPABASE_JWT_SECRET`
- ✅ Sikeres belépés után a backend upsert-eli a `users` táblát (`user.service.ts` – email, display name, avatar URL)
- ✅ Visszatérő felhasználónál nem hoz létre új profilt (`ON CONFLICT DO UPDATE`)
- ✅ Sikeres auth után `/auth/callback` → főoldalra irányítás (`AuthCallbackView.vue`)

### US-302 – Elfogadási kritériumok teljesítve

- ✅ Bejelentkezés: Google OAuth gombbal, Supabase Auth, redirect `/auth/callback`-re
- ✅ Kijelentkezés: `supabase.auth.signOut()` + `user.value = null` + navigate `/login`
- ✅ Session restore: `restoreSession()` a mountolás előtt fut (`main.ts`), `onAuthStateChange` feliratkozás token refresh kezeléshez
- ✅ Védett route-ok route guard mögött (`router/index.ts` – `requiresAuth: true`)
- ✅ Dev mode bypass: `VITE_DEV_AUTH_BYPASS=true` → mock userrel azonnali bejelentkezés, nincs Google redirect

### US-304 – Elfogadási kritériumok teljesítve

- ✅ Email + jelszó alapú bejelentkezés: `loginWithEmail()` a Supabase `signInWithPassword` API-t használja
- ✅ Email + jelszó alapú regisztráció: `registerWithEmail()` a Supabase `signUp` API-t használja (`full_name` opción át)
- ✅ Hiba esetén `AuthError` dobva (pl. hibás jelszó, duplikált email)
- ✅ LoginView login/register mód váltással, hibakezeléssel (`errorMessage`), loading állapottal
- ✅ Google OAuth gomb megmarad alternatív belépési módként
- ✅ `VITE_DEV_AUTH_BYPASS=true` esetén `loginWithEmail()` és `registerWithEmail()` is mock userrel lép be, Supabase nélkül
- ✅ 66 teszt (28 backend + 38 frontend), typecheck CLEAN

### US-101 – Elfogadási kritériumok teljesítve

- ✅ `GET /api/matches` endpoint – authMiddleware mögött, opcionális `stage` és `status` query filter
- ✅ Drizzle `alias()` double-join: `home_team` + `away_team` ugyanarra a `teams` táblára
- ✅ Soft delete szűrés: `isNull(matches.deletedAt)`
- ✅ Frontend: `MatchesView` – meccsek napok szerint csoportosítva, hu-HU dátum fejléccel
- ✅ Státusz badge-ek: ÉLŐBEN (piros), Befejezett (szürke), Tervezett (kék)
- ✅ Szűrő gombok: Összes / Csoportkör / Egyenes kiesés
- ✅ Pinia store: `fetchMatches()`, `filteredMatches`, `matchesByDate` computed property-k
- ✅ Dev bypass: `getAccessToken()` helper – bypass módban `dev-bypass-token`-t küld, nem hív Supabase-t
- ✅ Docker: `VITE_API_URL: http://backend:3000` (Docker hálózaton belüli service név)
- ✅ Kezdőképernyő (`/`): bejelentkezés után közvetlenül a meccslistát mutatja
- ✅ 97 teszt (35 backend + 62 frontend), typecheck CLEAN

### US-201/202 – Elfogadási kritériumok teljesítve

- ✅ `POST /api/predictions` endpoint – tipp leadása és módosítása egy route-on (`onConflictDoUpdate`)
- ✅ `GET /api/users/:userId/predictions` endpoint – saját tippek lekérdezése
- ✅ Validáció: meccs `scheduled` státusz + `scheduledAt` jövőbeli, különben 409
- ✅ Jogosultság: saját adatot kér, vagy admin – egyébként 403
- ✅ Frontend: `predictions.store.ts` – `fetchMyPredictions()`, `upsertPrediction()`, `saveStatus` per-meccs feedback
- ✅ MatchesView inline tipp form: `scheduled` meccsre input + Mentés gomb; lezárt meccsre "Tippelés lezárva"
- ✅ Meglévő tipp előtöltése az inputokba (`initDrafts()`)
- ✅ `saveStatus`: `saving` → disabled gomb, `saved` → "Tipp elmentve!" visszajelzés, `error` → hibaüzenet
- ✅ Fix: `api/index.ts` request helper – `Content-Type: application/json` már nem íródik felül a headers spread miatt
- ✅ Backend error message-ek angolra cserélve
- ✅ `seed.ts` és `migrate.ts` kiszervezve `src/db/`-ből `scripts/` mappába
- ✅ 128 teszt (47 backend + 81 frontend), typecheck CLEAN

### US-701 – Elfogadási kritériumok teljesítve

- ✅ `ADMIN_EMAILS` env változó (vesszővel elválasztott lista, case-insensitive) – admin hozzáférés email alapján
- ✅ `auth.middleware.ts`: `resolveRole()` minden kérésnél frissen olvassa az env-et, beállítja `AuthenticatedUser.role`-t
- ✅ `upsertUser`: a `role` értéket DB-be írja – a DB mindig szinkronban van az `ADMIN_EMAILS` env-vel
- ✅ Új `adminMiddleware` – admin route-ok előtt ellenőrzi a szerepkört, 403-at ad vissza ha nem admin
- ✅ Frontend `auth.store`: `isAdmin()` getter
- ✅ Router: `requiresAdmin: true` meta – admin-only route-ok védelmére készen áll
- ✅ 146 teszt (58 backend + 88 frontend), typecheck CLEAN

### US-305 – Elfogadási kritériumok teljesítve

- ✅ Dev bypass módban `login()`, `loginWithEmail()`, `registerWithEmail()` sessionStorage-ba írja a session-t 8 órás TTL-lel
- ✅ `restoreSession()` dev bypass módban sessionStorage-ból állítja vissza a usert (TTL ellenőrzéssel)
- ✅ Lejárt session: user null marad, sessionStorage kulcs törlődik
- ✅ `logout()` dev bypass módban törli a sessionStorage bejegyzést
- ✅ Production OAuth módban a logika változatlan (Supabase JS client kezeli)
- ✅ 177 teszt (67 backend + 110 frontend), typecheck CLEAN

### US-804 – Elfogadási kritériumok teljesítve

- ✅ `teams.service.ts`: `getTeams`, `getTeamById`, `createTeam`, `updateTeam`, `deleteTeam` – AppError pattern, FK violation (23503) → 409
- ✅ `admin.routes.ts`: `GET/POST/PUT/DELETE /api/admin/teams(/:id)` – `authMiddleware + adminMiddleware`
- ✅ Frontend `Team`, `TeamInput` típusok, `api.admin.teams.*` metódusok
- ✅ `admin-teams.store.ts`: Pinia store – CRUD + loading/error state
- ✅ `AdminTeamsView.vue`: táblázat, inline form (új/szerkesztés), törlés confirm, error banner, loading spinner
- ✅ `/admin/teams` route – `requiresAuth + requiresAdmin`
- ✅ Admin link a `MatchesView` fejlécében – csak adminoknak látható (computed reaktív)
- ✅ Dev bypass: `restoreSession()` azonnal beállítja a mock admin usert, route guard átenged
- ✅ 170 teszt (67 backend + 103 frontend), typecheck CLEAN

### US-102 – Elfogadási kritériumok teljesítve

- ✅ `MatchDetailView.vue`: `/matches/:id` route – részletes nézetoldal
- ✅ Mindkét csapat neve, végeredmény (vagy tervezett időpont), helyszín (stadion + város), szakasz/csoport
- ✅ Státusz badge (ÉLŐBEN / Befejezett / Tervezett)
- ✅ Lezárt meccs + van tipp: "Az én tippem: X – X | Pontok: N"
- ✅ Lezárt meccs + nincs tipp: "Nem adtál tippet erre a mérkőzésre"
- ✅ Nyitott meccs: tipp form (input–input–Mentés) elérhető ebből a nézetből is
- ✅ Vissza link (`← Vissza`) → `/matches`
- ✅ Router: `/matches/:id` route hozzáadva (`requiresAuth: true`)
- ✅ `MatchesView`: meccs kártyák felső része kattintható `router-link`-ként
- ✅ 117 frontend teszt, typecheck CLEAN

### US-801/802/803 – Elfogadási kritériumok teljesítve

- ✅ `matches.service.ts`: `createMatch`, `updateMatch`, `deleteMatch` (soft delete), `setResult` (upsert + match status → finished)
- ✅ `admin.routes.ts`: `POST/PUT/DELETE /api/admin/matches(/:id)` + `POST /api/admin/matches/:id/result`
- ✅ `MatchInput`, `MatchResultInput`, `MatchRow`, `MatchResultRow` típusok (backend + frontend)
- ✅ `api.admin.matches.*` API client metódusok (create/update/delete/setResult)
- ✅ `admin-matches.store.ts`: Pinia store – CRUD + setResult + loading/error state
- ✅ `AdminMatchesView.vue`: táblázat, inline create/edit form (csapat dropdown, időpont, szakasz, státusz), eredmény rögzítő form, törlés confirm
- ✅ `/admin/matches` route – `requiresAuth + requiresAdmin`
- ✅ Admin – Mérkőzések link a `MatchesView` fejlécébe kerül (csak adminoknak)
- ✅ 75 backend + 135 frontend teszt, typecheck CLEAN

### US-303 – Elfogadási kritériumok teljesítve

- ✅ `user.service.ts`: `updateProfile(userId, displayName)` – DB update, AppError 404 ha nem található
- ✅ `auth.routes.ts`: `PUT /api/users/me` – authMiddleware, upsertUser, displayName validáció, updateProfile
- ✅ `api.users.updateProfile(token, displayName)` API client metódus
- ✅ `auth.store.ts`: `updateProfile(displayName)` action – API hívás, `user.value` frissítés, dev bypass sessionStorage szinkron
- ✅ `ProfileView.vue`: `/profile` route – email (readonly), avatar, displayName szerkesztés, mentés visszajelzés
- ✅ Profil link a `MatchesView` fejlécében (minden bejelentkezett usernek)
- ✅ 77 backend + 142 frontend teszt, typecheck CLEAN

### US-1001 – Elfogadási kritériumok teljesítve

- ✅ `AppLayout.vue` létrehozva – közös layout komponens minden auth-olt nézethez
- ✅ Topbar: hamburger gomb + "VB Tippjáték" cím + `UserMenuButton` minden breakpointon
- ✅ Desktop (≥ 768px): oldalsáv `w-14` (ikonok) ↔ `w-56` (ikon + szöveg), hamburger toggleli
- ✅ Mobil (< 768px): sidebar alapból rejtett (`w-0`), hamburger overlay drawer-ként nyitja
- ✅ Drawer bezárása: backdrop kattintás, nav itemre kattintás
- ✅ Gmail-stílusú aktív item: `rounded-full bg-blue-100 text-blue-800 font-semibold`
- ✅ Disabled nav itemek (Ranglista, Csoportok) placeholder-ként, jövőbeli bővítésre előkészítve
- ✅ `UserMenuButton` kizárólag `AppLayout`-ban él, a nézetekből eltávolítva
- ✅ 153 frontend teszt, typecheck CLEAN

### US-805 – Elfogadási kritériumok teljesítve

- ✅ `admin-users.service.ts`: `getUsers`, `updateUserRole`, `banUser` – AppError pattern, önmaga módosítása → 403
- ✅ `admin.routes.ts`: `GET /api/admin/users`, `PUT /api/admin/users/:id/role`, `PUT /api/admin/users/:id/ban`
- ✅ Audit log: `role_change` és `ban` akciók `audit_logs` táblába írva
- ✅ `AdminUser` típus (backend + frontend)
- ✅ `api.admin.users.*` API client metódusok (list/updateRole/ban)
- ✅ `admin-users.store.ts`: Pinia store – fetchUsers, updateUserRole, banUser + loading/error state
- ✅ `AdminUsersView.vue`: táblázat (email, név, szerepkör badge, státusz badge, regisztrálva, műveletek)
- ✅ Szerepkör toggle gomb és tiltás/feloldás gomb soronként – saját fiók gombjai disabled
- ✅ Admin – Felhasználók link a `UserMenuButton` dropdown-ban (csak adminoknak)
- ✅ `/admin/users` route – `requiresAuth + requiresAdmin`
- ✅ 89 backend + 183 frontend teszt, typecheck CLEAN

### US-1201 – Elfogadási kritériumok teljesítve

- ✅ 4 API elemezve: api-football.com, football-data.org, apifootball.com, Sportmonks (+ OpenLigaDB kizárva: csak németes)
- ✅ Döntési mátrix: ár, NB I/NB II/WC 2026 coverage, live adat, free tier kvóta
- ✅ **Kiválasztott API: api-football.com (api-sports.io)** — rögzítve `plans/03-tech-stack.md`-ben indoklással
- ✅ Magyar NB I (liga ID: ~271) és NB II (liga ID: ~272) fedezete megerősítve; NB II az egyetlen kizáró kritérium
- ✅ Szükséges endpointok: `GET /fixtures`, `GET /teams`, `GET /leagues`
- ✅ Fixture response struktúra és leképezés a saját Drizzle schemára dokumentálva
- ✅ Adaptív rate limit stratégia: free (100 req/nap) fejlesztéshez, Pro ($19/hó) VB 2026-hoz
- ✅ `.env.example` frissítve: `FOOTBALL_API_KEY`, `FOOTBALL_API_BASE_URL`, `FOOTBALL_API_*_LEAGUE_ID`
- ✅ Részletes kutatási dokumentum: `plans/05-football-api.md`

### US-203 – Elfogadási kritériumok teljesítve

- ✅ `MyTipsView.vue`: `/my-tips` route – saját tippek összesítő nézet AppLayout-ban
- ✅ Meccsek napok szerint csoportosítva, hu-HU dátumcímkével
- ✅ Státusz ikonok: ✅ (tippelt, nyitott), ⏳ (nem tippelt, nyitott), 🔒 (lezárt + tippelt), ❌ (lezárt + kimaradt)
- ✅ Sorok kiemelése: sárga szegély (`border-amber-300`) ha tippelhető + nincs tipp; piros ha lezárt + kimaradt
- ✅ Inline szerkesztés: "Tippelj!" gombra vagy meglévő tippre kattintva megnyílik a két input mező
- ✅ Autosave debounce (2s) + blur-on-save (100ms delay a same-match fókuszváltás elkerüléséhez)
- ✅ Automata ugrás: szám leütésekor hazai inputból automatikusan ugrik az idegenbeli inputra
- ✅ Nincs spinner nyíl a szám inputokon (`[appearance:textfield]` Tailwind osztályok)
- ✅ Lezárt meccs: megjelenő tipp (szürke) + pontszám (kék) ha `pointsGlobal` nem null
- ✅ AppLayout nav: "Tippjeim" link hozzáadva (clipboard-check ikon)
- ✅ 205 frontend teszt, typecheck CLEAN

### US-601/602/606 – Elfogadási kritériumok teljesítve

- ✅ `groups.service.ts`: `getMyGroups`, `createGroup` (max 5 létrehozott, 8 char invite code retry), `joinGroup` (404/410/409/422 hibák)
- ✅ `groups.routes.ts`: `GET /api/groups/mine`, `POST /api/groups`, `POST /api/groups/join`
- ✅ `groups.store.ts` (frontend Pinia): `fetchMyGroups`, `createGroup`, `joinGroup` + loading/error state
- ✅ `GroupsView.vue`: csoport lista, inline create/join form, invite code megjelenítés + copy gomb ("Másolva!" 2s visszajelzés)
- ✅ `/groups` route – `requiresAuth: true`
- ✅ AppLayout nav: Meccsek (első), Csoportok (második)
- ✅ Kezdőoldal (`/`) → `MatchesView` (nem GroupsView)
- ✅ 205 frontend + 100 backend teszt, typecheck CLEAN

### US-401 – Elfogadási kritériumok teljesítve

- ✅ `calculateAndSavePoints(matchId, result)` — lekéri az összes tippet a meccsre + global scoring config, kiszámolja és elmenti a `pointsGlobal`-t minden tippre
- ✅ `setResult` meghívja `calculateAndSavePoints`-t eredmény rögzítése után
- ✅ Idempotens: újraszámítás felülírja a régi pontokat
- ✅ Ha nincs global scoring config → `Error: No global scoring config found`
- ✅ 5 új teszt (`calculate-and-save-points.test.ts`), 105 backend teszt, typecheck CLEAN

### UX-001 – Elfogadási kritériumok teljesítve

- ✅ **Autosave debounce:** 2s inaktivitás után automatikusan elmenti a tippet, nincs szükség "Mentés" gombra
- ✅ **Fókusz → select:** mezőbe lépéskor a tartalom azonnal ki van jelölve
- ✅ **Üres mező fókuszáláskor → 0:** ha a mező üres, fókuszkor `0` kerül bele és ki van jelölve
- ✅ **Szám beütése → következő mező:** `preventDefault()` + érték beállítása + fókusz a következő inputra (meccshatárokon átlépve is)
- ✅ Érintett komponensek: `MatchesView.vue`, `MatchDetailView.vue`
- ✅ 205 frontend teszt, typecheck CLEAN

### UX-002 – Elfogadási kritériumok teljesítve

- ✅ Csak `finished`/`cancelled` meccsekből álló nap-csoportok alapból össze vannak csukva
- ✅ A dátumcímkére kattintva kinyílik a csoport (chevron ikon jelzi az állapotot)
- ✅ Kinyitás után először az utolsó 5 meccs látható
- ✅ Ha több mint 5 van, megjelenik az "Összes mutatása (N db)" gomb
- ✅ `scheduled`/`live` meccseket tartalmazó csoportok mindig nyitva maradnak
- ✅ 208 frontend teszt, typecheck CLEAN

### UX-003 – Elfogadási kritériumok teljesítve

- ✅ A mai naptól >7 napra lévő, csak `scheduled` meccseket tartalmazó csoportok alapból rejtve vannak
- ✅ A lista alján megjelenik: "▶ N további tervezett mérkőzés megjelenítése" gomb
- ✅ Gombra kattintva az összes jövőbeli csoport láthatóvá válik
- ✅ `live`/`finished` meccsek mindig láthatók dátumtól függetlenül
- ✅ 212 frontend teszt, typecheck CLEAN

### US-303 bugfix – displayName persistencia javítva
- ✅ Csak INSERT állítja be az initial `displayName`-t a JWT-ből
- ✅ `updateProfile` által mentett név megmarad oldal-újratöltés után is

### US-501 – Elfogadási kritériumok teljesítve

- ✅ `leaderboard.service.ts`: `getLeaderboard()` – SQL aggregáció, `coalesce(sum(pointsGlobal), 0)`, `count(case when pointsGlobal > 0)`, döntetlen kezelés (tied rank)
- ✅ `GET /api/leaderboard` endpoint – `authMiddleware` mögött
- ✅ `leaderboard.store.ts` (Pinia): `fetchLeaderboard()`, `getAccessToken()` helper (dev bypass kompatibilis)
- ✅ `LeaderboardView.vue`: rangsor táblázat (helyezés, avatar, név, tippszám, helyes tipp, pont), saját sor kiemelve (kék háttér + "(te)" jelzés)
- ✅ `/leaderboard` route – `requiresAuth: true`
- ✅ AppLayout Ranglista nav link engedélyezve (nem disabled)
- ✅ 205 frontend teszt, typecheck CLEAN

### US-603 – Elfogadási kritériumok teljesítve

- ✅ `group-leaderboard.service.ts`: `getGroupLeaderboard(groupId, requesterId)` — tagok szűrése `groupMembers` JOIN-nal, 404 ha a csoport nem létezik, 403 ha a kérelmező nem tag
- ✅ `GET /api/groups/:groupId/leaderboard` endpoint — `authMiddleware` mögött
- ✅ 4 backend teszt (ranked entries, 404, 403, tied rank), 114 backend teszt összesen
- ✅ `api.groups.leaderboard(token, groupId)` API client metódus
- ✅ `GroupDetailView.vue`: csoportranglista táblázat (azonos stílus mint a global ranglista), saját sor kiemelve, csoport neve a fejlécben
- ✅ `/groups/:id` route — `requiresAuth: true`
- ✅ `GroupsView`: csoport neve router-link → detail view
- ✅ 205 frontend teszt, typecheck CLEAN

### US-205 – Elfogadási kritériumok teljesítve

- ✅ DB migráció: `outcome_after_draw` nullable text oszlop a `predictions` és `match_results` táblákban
- ✅ DB migráció: `correct_outcome` smallint (default: 1) a `scoring_configs` táblában
- ✅ `MatchOutcome` union type: `'extra_time_home' | 'extra_time_away' | 'penalties_home' | 'penalties_away'`
- ✅ Scoring service: döntetlen eredmény + helyes outcome tipp → `+correctOutcome` bónuszpont (rendes pontok mellé)
- ✅ Backend API validáció: `outcomeAfterDraw` opcionálisan fogadva `POST /api/predictions` és admin result endpoint-on
- ✅ `MatchesView` + `MatchDetailView`: egyenes kieséses meccsnél döntetlen tipp esetén 4 gombos outcome selector jelenik meg (Hossz./Tizenegyes × Hazai/Vendég); toggle-olható
- ✅ `AdminMatchesView`: döntetlen eredmény rögzítésekor outcome dropdown jelenik meg knockout meccsekre
- ✅ `MyTipsView`: lezárt meccsnél az outcome tipp megjelenik a tipp mellett (pl. „1–1 · H+hossz.")
- ✅ 120 backend + 212 frontend teszt, typecheck CLEAN

### US-604-A – Elfogadási kritériumok teljesítve

- ✅ `groups.service.ts`: `getGroupMembers`, `removeMember`, `setMemberAdmin` — AppError pattern (404/403)
- ✅ `GET /api/groups/:groupId/members` — requester tagságát ellenőrzi
- ✅ `DELETE /api/groups/:groupId/members/:userId` — csak admin távolíthat el tagot, magát nem
- ✅ `PUT /api/groups/:groupId/members/:userId/role` — csak admin módosíthat, magán nem, utolsó admin védett
- ✅ `GroupDetailView.vue`: Ranglista + Tagok tab; Tagok tab csak csoport adminnak látható
- ✅ Tagok táblázat: avatar, név, szerep badge, csatlakozás dátuma, Admin/visszavon + Eltávolít gombok
- ✅ Saját sor gombjai disabled, megerősítő dialog az eltávolításhoz
- ✅ `groups.store.ts`: `fetchGroupMembers`, `removeMember`, `toggleMemberAdmin` actions + `membersMap`, `membersError`
- ✅ 141 backend + 241 frontend teszt, typecheck CLEAN

### US-604-B – Elfogadási kritériumok teljesítve

- ✅ `groups.service.ts`: `regenerateInviteCode` (új kód generálása, uniqueness retry max 10), `setInviteActive`
- ✅ `PUT /api/groups/:groupId/invite` — meghívó kód újragenerálása, `inviteActive = true` visszaállítással
- ✅ `PATCH /api/groups/:groupId/invite` — meghívó aktiválás/deaktiválás (`active: boolean` validációval)
- ✅ Rate limit: `POST /api/groups/join` — 10 kérés/perc/IP, in-memory sliding window (külső csomag nélkül)
- ✅ `rateLimit.middleware.ts`: `createRateLimit({ windowMs, max })` — 4 unit teszt
- ✅ Frontend `api/index.ts`: `regenerateInvite`, `setInviteActive` metódusok
- ✅ `groups.store.ts`: `regenerateInvite`, `setInviteActive` actions (frissítik a `groups` listát)
- ✅ `GroupDetailView.vue`: "Meghívó kód" szekció (csak admin, Tagok tab alján) — kód display, Kód másolás, Link másolása, Deaktiválás/Aktiválás, Újragenerálás (confirm dialoggal)
- ✅ `GroupsView.vue`: inaktív meghívójú csoportnál admin usernek piros "Meghívó inaktív" badge
- ✅ Másolás gombokon zöld ✓ animáció 2 másodpercig (`copiedInvite` / `copiedState` ref)
- ✅ `/join/:code` route + `JoinView.vue` — automatikusan join-ol és a csoport detail oldalra irányít
- ✅ Router guard: `redirect` query param megőrzése bejelentkezés előtt; `LoginView` bejelentkezés után visszairányít
- ✅ Join URL = `window.location.origin + /join/` + kód (dinamikus, domain-független)
- ✅ 145 backend + 241 frontend teszt, typecheck CLEAN

### US-604-C – Elfogadási kritériumok teljesítve

- ✅ `groups.service.ts`: `deleteGroup(groupId, requesterId, isGlobalAdmin)` — soft delete (`deletedAt`), 404 ha nem létezik, 403 ha nem admin (platform admin bypass-szal)
- ✅ `DELETE /api/groups/:groupId` endpoint — `authMiddleware` mögött, 204 No Content válasz
- ✅ `api/index.ts` request helper: 204 No Content → JSON parse kihagyva (`undefined as T`)
- ✅ Frontend `api/index.ts`: `groups.delete(token, groupId)` metódus
- ✅ `groups.store.ts`: `deleteGroup(groupId)` action — API hívás után a csoportot kiszűri a `groups` listából
- ✅ `GroupDetailView.vue`: "Csoport törlése" gomb (admin only, Tagok tab alján) — megerősítő dialog, törlés után `/groups` redirect
- ✅ 150 backend + 247 frontend teszt, typecheck CLEAN

### US-402 – Elfogadási kritériumok teljesítve

- ✅ `scoring-config.service.ts`: `getGlobalConfig()` (404 ha nincs), `updateGlobalConfig(input)`
- ✅ `GET /api/admin/scoring-config` + `PUT /api/admin/scoring-config` — `authMiddleware + adminMiddleware`
- ✅ PUT validáció: minden mező `typeof !== 'number'` → 400
- ✅ `ScoringConfigFull` + `ScoringConfigInput` interface (backend + frontend types)
- ✅ `api.admin.scoringConfig.get/update` API client metódusok
- ✅ `admin-scoring.store.ts`: `fetchConfig`, `updateConfig`, `saveStatus` ('idle'/'saving'/'saved'/'error')
- ✅ `AdminScoringView.vue`: form 6 szerkeszthető mezővel, előtöltve, "Elmentve!" visszajelzés
- ✅ `/admin/scoring` route + "Admin – Pontrendszer" link a `UserMenuButton` dropdown-ban
- ✅ 154 backend + 259 frontend teszt, typecheck CLEAN

---

| US-001 | Monorepo és dev környezet | ✅ Kész | Must Have |
| US-002 | DB schema és seed adatok | ✅ Kész | Must Have |
| US-003 | Tesztelési infrastruktúra | ✅ Kész | Must Have |
| US-004 | Production deploy pipeline | ✅ Kész | Must Have |
| US-101 | Mérkőzések böngészése | ✅ Kész | Must Have |
| US-102 | Mérkőzés részletek | ✅ Kész | Must Have |
| US-201 | Tipp leadása | ✅ Kész | Must Have |
| US-202 | Tipp módosítása | ✅ Kész | Must Have |
| US-203 | Saját tippek összesítő | ✅ Kész | Must Have |
| US-205 | Hosszabbítás/tizenegyes outcome tipp | ✅ Kész | Should Have |
| US-301 | Regisztráció Google OAuth-szal | ✅ Kész | Must Have |
| US-302 | Bejelentkezés / kijelentkezés | ✅ Kész | Must Have |
| US-303 | Profil szerkesztése | ✅ Kész | Should Have |
| US-304 | Email + jelszó auth | ✅ Kész | Should Have |
| US-305 | Session perzisztencia oldal-újratöltés után | ✅ Kész | Must Have |
| US-401 | Automatikus pontszámítás | ✅ Kész | Must Have |
| US-402 | Konfigurálható pontrendszer | ✅ Kész | Must Have |
| US-403 | Pontozás tesztelhetősége | ✅ Kész (US-003 részeként) | Must Have |
| US-501 | Globális ranglista | ✅ Kész | Must Have |
| US-502 | Ranglista nézet-váltó (globális + csoportok dropdown) | ✅ Kész | Should Have |
| US-601 | Csoport létrehozása | ✅ Kész | Must Have |
| US-602 | Csatlakozás csoporthoz | ✅ Kész | Must Have |
| US-603 | Csoportonkénti ranglista | ✅ Kész | Must Have |
| US-604-A | Csoport tagkezelés (admin) | ✅ Kész | Must Have |
| US-604-B | Meghívó kód kezelése (admin) | ✅ Kész | Must Have |
| US-604-C | Csoport törlése (admin) | ✅ Kész | Should Have |
| US-608 | Csoportszintű pontrendszer override | ⬜ Nem kezdett | Must Have |
| US-609 | Liga filter csoportonként | ⬜ Nem kezdett | Should Have |
| US-605 | Több csoporthoz tartozás | ⬜ Nem kezdett | Must Have |
| US-606 | Csoportok navigáció (AppLayout) | ✅ Kész | Must Have |
| US-701 | User/Admin szerepkörök | ✅ Kész | Must Have |
| US-801 | Mérkőzés létrehozása | ✅ Kész | Must Have |
| US-802 | Mérkőzés szerkesztése/törlése | ✅ Kész | Must Have |
| US-803 | Eredmény rögzítése | ✅ Kész | Must Have |
| US-804 | Csapatok kezelése | ✅ Kész | Must Have |
| US-805 | Felhasználók kezelése | ✅ Kész | Must Have |
| US-901 | Statisztikai tipp leadása | ⬜ Nem kezdett | Should Have |
| US-902 | Statisztikai tipp típus konfig | ⬜ Nem kezdett | Should Have |
| US-1001 | Hamburger menü / AppLayout | ✅ Kész | Should Have |
| US-1002 | Felhasználói felület lokalizációja (i18n) | ⬜ Nem kezdett | Should Have |
| US-1101 | Donation gomb és pop-up | ⬜ Nem kezdett | Should Have |
| US-1102 | Donation átirányítás | ⬜ Nem kezdett | Should Have |
| US-1201 | Futball API kiválasztása (kutatás) | ✅ Kész | Should Have |
| US-1202 | Futball API szinkronizációs service | ⬜ Nem kezdett | Should Have |
| US-1203 | Automatikus adatszinkron cron job | ⬜ Nem kezdett | Should Have |
| BUG-001 | Admin users lista: minden sornál ugyanaz a név | ✅ Kész | Should Have |
| UX-001 | Tipp input UX javítások | ✅ Kész | Should Have |
| UX-002 | Befejezett meccsek összecsukvása | ✅ Kész | Should Have |
| UX-003 | Távoli jövőbeli meccsek összecsukvása | ✅ Kész | Should Have |
| UX-004 | Focilabda kurzor ikon | ⬜ Nem kezdett | Nice to Have |
| UX-005 | Optimista törlés az admin listákon | ⬜ Nem kezdett | Should Have |
| UX-006 | Csapat zászló/logo megjelenítése (flag-icons) | ⬜ Nem kezdett | Should Have |
| US-806 | Csapat típus és country code mezők (DB migráció) | ⬜ Nem kezdett | Should Have |
| US-206 | Kedvenc csapat beállítása ligánként | ⬜ Nem kezdett | Should Have |
| US-404 | Kedvenc csapat dupla pont számítás | ⬜ Nem kezdett | Should Have |
| US-607 | Kedvenc csapat dupla pont szabály (csoport beállítás) | ⬜ Nem kezdett | Should Have |
| DISC-001 | Landing oldal discovery (design + marketing + social) | ⬜ Nem kezdett | Should Have |
| SEC-001 | Row-Level Security bekapcsolása (Supabase RLS) | ⬜ Nem kezdett | Must Have |
| SEC-002 | HMAC-aláírt meghívó URL-ek | ⬜ Nem kezdett | Nice to Have |

---

**Haladás: 34 / 60 story kész** — Must Have: 25/33 ✅, Should Have: 9/23 ✅, Nice to Have: 0/2
