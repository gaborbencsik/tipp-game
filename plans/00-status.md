# VB Tippjáték – Implementációs státusz

> Utoljára frissítve: 2026-03-28

## Kész user story-k

| Story ID | Megnevezés | Megjegyzés |
|----------|-----------|------------|
| **US-001** | Monorepo és fejlesztői környezet (Docker) | ✅ Kész |
| **US-002** | DB schema és seed adatok | ✅ Kész |
| **US-003** | Tesztelési infrastruktúra | ✅ Kész |

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
- ✅ Frontend: 23 unit teszt (api client, auth store, LoginView, HomeView)
- ✅ Coverage report: `npm run test:coverage` – Istanbul provider, `text` + `html` riporter
- ✅ GitHub Actions CI: `.github/workflows/ci.yml` – typecheck → test minden push/PR-on

---

## Folyamatban / következő

| Story ID | Megnevezés | Prioritás |
|----------|-----------|-----------|
| US-301 | Regisztráció és bejelentkezés (Google OAuth) | Must Have |
| US-302 | Bejelentkezés / kijelentkezés | Must Have |
| US-101 | Mérkőzések böngészése | Must Have |
| US-102 | Mérkőzés részletek | Must Have |

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
| US-301 | Regisztráció Google OAuth-szal | ⬜ Nem kezdett | Must Have |
| US-302 | Bejelentkezés / kijelentkezés | ⬜ Nem kezdett | Must Have |
| US-303 | Profil szerkesztése | ⬜ Nem kezdett | Should Have |
| US-304 | Email + jelszó auth | ⬜ Nem kezdett | Should Have |
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

**Haladás: 4 / 33 story kész** (3 + US-403 részeként) — Must Have: 4/25 ✅
