# VB Tippjáték

Nyári labdarúgó VB tippjáték platform – monorepo (npm workspaces).

## Tech stack

- **Frontend**: Vue 3 + Vite + TypeScript + Tailwind v4 + Pinia
- **Backend**: Koa.js + TypeScript + Drizzle ORM
- **DB (local)**: PostgreSQL 17 (Docker) – prod: Supabase Postgres 18.3
- **Auth**: Supabase Auth (Google OAuth)

> **Megjegyzés a DB verzióról:** A tervdokumentum PostgreSQL 18.3-at ír elő. Prodban a Supabase Postgres 18.3-at futtat. Lokálisan `postgres:17` Docker image-t használunk (a `postgres:18` image még nem érhető el Dockerhub-on, mert a PG 18 béta), az ORM-szintű kompatibilitás azonos.

## Fejlesztői környezet felállítása

### Előfeltételek

- Node.js 24.14.1 (`nvm use`)
- Docker + Docker Compose

### Első indítás

```bash
# 1. Függőségek telepítése
npm install

# 2. .env létrehozása
cp .env.example .env
# → szerkeszd a Supabase credentials-eket

# 3. Docker stack indítása
docker compose up -d

# 4. Migrációk futtatása (backend containerben vagy lokálisan)
npm run db:migrate --workspace=packages/backend

# 5. Seed adatok betöltése
npm run db:seed --workspace=packages/backend

# 6. Fejlesztés indítása
npm run dev
```

### Elérési pontok

| Szolgáltatás | URL |
|---|---|
| Frontend | http://localhost:5173 |
| Backend API | http://localhost:3000/api/health |
| PostgreSQL | localhost:5432 |

### Tesztek futtatása

```bash
npm test               # minden workspace
npm run typecheck      # TypeScript ellenőrzés
```

### Lokális dev auth bypass

A `VITE_DEV_AUTH_BYPASS=true` env-változó beállításával a bejelentkezés gomb Google OAuth helyett azonnal mock userrel lép be – így OAuth redirect nélkül is fejleszthető a védett UI.

---

## Production sync (Render cron jobs)

Production-ben a 3 internal sync endpointot Render cron service-ek hívják (`render.yaml`):

| Cron service | Schedule (UTC) | Endpoint | Cél |
|---|---|---|---|
| `tipp-game-cron-tick` | `* * * * *` (percenként) | `POST /api/internal/sync/tick` | Meccs eredmény + gólszerzők; 24h-ként player sync. A backend `sync-gate` dönti el a tényleges futást a `sync_state.mode` alapján. |
| `tipp-game-cron-polymarket` | `*/15 * * * *` | `POST /api/internal/sync/polymarket-tick` | Polymarket odds frissítés. On/off az admin UI-ról kapcsolható. |
| `tipp-game-cron-transfermarkt` | `0 4 * * *` (napi 04:00 UTC) | `POST /api/internal/sync/transfermarkt-tick` | Csapat-piaci értékek. Belső 24h-os interval gate az endpointon. |

A 3 cron service és a backend web service is a `frankfurt` régióban fut, így az internal hívás (`http://tipp-game-backend:3000`) a Render belső hálózatán megy. A cron-ok a `cron/Dockerfile` által épített közös alpine + curl image-ből futnak, a célendpontot a service-szintű `ENDPOINT` env var választja ki.

### `SYNC_SERVICE_TOKEN` setup

Az endpoint-okat a `serviceTokenMiddleware` őrzi `Authorization: Bearer <token>` header alapján. A token azonos kell legyen a backend-en és mindhárom cron service-en.

```bash
# Token generálás (lokálisan)
openssl rand -hex 32
```

Render dashboard-on kézzel kell beállítani — a `render.yaml` mind a négy service-nél `sync: false`-szel jelöli, ezért nem kerül a repo-ba:

1. **`tipp-game-backend`** → Environment → Add `SYNC_SERVICE_TOKEN` = `<generált érték>`
2. **`tipp-game-cron-tick`** → Environment → Add `SYNC_SERVICE_TOKEN` = `<ugyanaz>`
3. **`tipp-game-cron-polymarket`** → ugyanígy
4. **`tipp-game-cron-transfermarkt`** → ugyanígy

Lokálisan a `.env`-ben opcionális; ha nincs beállítva, az internal endpointok 401-et adnak vissza (a fejlesztéshez nem szükséges, mert lokálisan az admin `/admin/sync/*` triggerekkel manuálisan tesztelhető a sync).

### Verifikáció

- Render dashboard → cron job logs: zöld futások a megadott schedule szerint
- Backend logs: `sync.tick.received`, `polymarket.sync.completed`, `transfermarkt.sync.completed` események
- Élő meccs alatt: percenként hívódik a `/tick`, de csak `adaptive` módban 2 percenként ténylegesen futtat (gate skip-eli a többit `interval not elapsed` reason-nel)

---

## Implementációs státusz

### Kész

| Story | Leírás | Tesztek |
|-------|--------|---------|
| US-001 | Monorepo, Docker dev környezet, CI | ✅ |
| US-002 | DB schema (13 tábla), seed adatok | ✅ |
| US-003 | Vitest infrastruktúra, scoring unit tesztek | ✅ 19 |
| US-301 | Supabase Auth + Google OAuth flow, JWT validálás, user upsert | ✅ 9 |
| US-302 | Login / logout (OAuth + dev bypass), session restore, `/auth/callback` | ✅ 6 |

**Összesen: 57 / 57 teszt zöld · typecheck CLEAN (backend + frontend)**

### Következő (javasolt sorrend)

| Story | Leírás | Epic |
|-------|--------|------|
| US-701 | Admin middleware, role-check | E7 |
| US-101 | Mérkőzések listázása (BE route + FE nézet) | E1 |
| US-102 | Mérkőzés részletek | E1 |
| US-201 | Tipp leadása | E2 |
| US-202 | Tipp módosítása | E2 |
| US-203 | Saját tippek összesítője | E2 |
| US-401 | Automatikus pontszámítás | E4 |
| US-402 | Konfigurálható pontrendszer | E4 |
| US-501 | Globális ranglista | E5 |
| US-601–605 | Csoportok | E6 |
| US-801–805 | Admin panel | E8 |
