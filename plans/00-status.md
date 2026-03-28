# VB Tippjáték – Implementációs státusz

> Utoljára frissítve: 2026-03-28 (US-304)

## Kész user story-k

| Story ID | Megnevezés | Megjegyzés |
|----------|-----------|------------|
| **US-001** | Monorepo és fejlesztői környezet (Docker) | ✅ Kész |
| **US-002** | DB schema és seed adatok | ✅ Kész |
| **US-003** | Tesztelési infrastruktúra | ✅ Kész |
| **US-301** | Regisztráció és bejelentkezés (Google OAuth) | ✅ Kész |
| **US-302** | Bejelentkezés / kijelentkezés | ✅ Kész |
| **US-304** | Email + jelszó auth | ✅ Kész |

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
- ✅ 66 teszt (28 backend + 38 frontend), typecheck CLEAN

---

| Story ID | Megnevezés | Prioritás |
|----------|-----------|-----------|
| US-701 | User/Admin szerepkörök (admin middleware) | Must Have |
| US-101 | Mérkőzések böngészése | Must Have |
| US-102 | Mérkőzés részletek | Must Have |
| US-201 | Tipp leadása | Must Have |
| US-202 | Tipp módosítása | Must Have |

---

## Összes story státusz

| Story ID | Megnevezés | Státusz | Prioritás |
|----------|-----------|---------|-----------|
| US-001 | Monorepo és dev környezet | ✅ Kész | Must Have |
| US-002 | DB schema és seed adatok | ✅ Kész | Must Have |
| US-003 | Tesztelési infrastruktúra | ✅ Kész | Must Have |
| US-101 | Mérkőzések böngészése | ⬜ Nem kezdett | Must Have |
| US-102 | Mérkőzés részletek | ⬜ Nem kezdett | Must Have |
| US-201 | Tipp leadása | ⬜ Nem kezdett | Must Have |
| US-202 | Tipp módosítása | ⬜ Nem kezdett | Must Have |
| US-203 | Saját tippek összesítő | ⬜ Nem kezdett | Must Have |
| US-204 | Mások tippjeinek megtekintése | ⬜ Nem kezdett | Should Have |
| US-301 | Regisztráció Google OAuth-szal | ✅ Kész | Must Have |
| US-302 | Bejelentkezés / kijelentkezés | ✅ Kész | Must Have |
| US-303 | Profil szerkesztése | ⬜ Nem kezdett | Should Have |
| US-304 | Email + jelszó auth | ✅ Kész | Should Have |
| US-401 | Automatikus pontszámítás | ⬜ Nem kezdett | Must Have |
| US-402 | Konfigurálható pontrendszer | ⬜ Nem kezdett | Must Have |
| US-403 | Pontozás tesztelhetősége | ✅ Kész (US-003 részeként) | Must Have |
| US-501 | Globális ranglista | ⬜ Nem kezdett | Must Have |
| US-502 | Ranglista szűrés/keresés | ⬜ Nem kezdett | Should Have |
| US-601 | Csoport létrehozása | ⬜ Nem kezdett | Must Have |
| US-602 | Csatlakozás csoporthoz | ⬜ Nem kezdett | Must Have |
| US-603 | Csoportonkénti ranglista | ⬜ Nem kezdett | Must Have |
| US-604 | Csoport kezelése (admin) | ⬜ Nem kezdett | Must Have |
| US-605 | Több csoporthoz tartozás | ⬜ Nem kezdett | Must Have |
| US-701 | User/Admin szerepkörök | ⬜ Nem kezdett | Must Have |
| US-801 | Mérkőzés létrehozása | ⬜ Nem kezdett | Must Have |
| US-802 | Mérkőzés szerkesztése/törlése | ⬜ Nem kezdett | Must Have |
| US-803 | Eredmény rögzítése | ⬜ Nem kezdett | Must Have |
| US-804 | Csapatok kezelése | ⬜ Nem kezdett | Must Have |
| US-805 | Felhasználók kezelése | ⬜ Nem kezdett | Must Have |
| US-901 | Statisztikai tipp leadása | ⬜ Nem kezdett | Should Have |
| US-902 | Statisztikai tipp típus konfig | ⬜ Nem kezdett | Should Have |
| US-1101 | Donation gomb és pop-up | ⬜ Nem kezdett | Should Have |
| US-1102 | Donation átirányítás | ⬜ Nem kezdett | Should Have |

---

**Haladás: 7 / 33 story kész** (6 + US-403 részeként) — Must Have: 6/25 ✅, Should Have: 1/7 ✅
