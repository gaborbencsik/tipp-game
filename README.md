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
