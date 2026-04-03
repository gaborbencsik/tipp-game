# VB Tippjáték – Tech Stack Döntési Mátrix

> Verzió: 1.0 | Dátum: 2026-03-27

---

## Tartalom

1. [Stack áttekintés (TL;DR)](#1-stack-áttekintés-tldr)
2. [Frontend döntési mátrix](#2-frontend-döntési-mátrix)
3. [Backend döntési mátrix](#3-backend-döntési-mátrix)
4. [Adatbázis és ORM döntési mátrix](#4-adatbázis-és-orm-döntési-mátrix)
5. [Auth megoldás összehasonlítása](#5-auth-megoldás-összehasonlítása)
6. [Real-time frissítés](#6-real-time-frissítés)
7. [State management](#7-state-management)
8. [Hosting és deployment](#8-hosting-és-deployment)
9. [Teljes projekt struktúra](#9-teljes-projekt-struktúra)
10. [Függőségi lista](#10-függőségi-lista)

---

## 1. Stack áttekintés (TL;DR)

| Réteg | Választás | Változat |
|-------|-----------|---------|
| Frontend | **Vue 3** + Vite | TypeScript, Composition API |
| Backend | **Koa.js** | TypeScript, @koa/router |
| DB | **Supabase Postgres** (prod) / **PostgreSQL Docker** (local dev) | |
| ORM | **Drizzle ORM** | Lightweight, type-safe |
| Auth | **Supabase Auth** (Google OAuth 2.0) | @supabase/supabase-js |
| Session | **Supabase JWT** (access + refresh, kezeli a Supabase) | |
| Real-time | **Server-Sent Events (SSE)** | Ranglista frissítés |
| State mgmt | **Pinia** | Vue 3 natív store |
| API stílus | **REST** | JSON |
| Hosting | **Railway** (backend) + **Supabase** (DB + Auth) + **Vercel** (frontend) | |
| Monorepo | **npm workspaces** | |
| Runtime | **Node.js 24.14.1** (LTS) | |
| DB verzió | **PostgreSQL 18.3** (Supabase / Docker) | |

---

## 2. Frontend döntési mátrix

| Opció | Előny | Hátrány | Ajánlott? |
|-------|-------|---------|-----------|
| **Vue 3 + Vite** | - Composition API elegáns TypeScript integrációval<br>- Vite: villámgyors dev szerver<br>- Pinia: natív, lightweight state mgmt<br>- Kisebb bundle méret, mint React | - Kisebb ökoszisztéma, mint React<br>- Kevesebb enterprise support | ✅ **IGEN** (user választása) |
| Next.js (React) | - Legnagyobb ökoszisztéma<br>- Vercel natív support<br>- SSR/SSG built-in | - React overhead<br>- App Router tanulási görbe | Alternatíva |
| Nuxt.js | - Vue + SSR combo<br>- Auto-imports | - Komplexebb konfig<br>- Overengineered egy SPA-hoz | Nem ajánlott |
| SvelteKit | - Legkisebb bundle<br>- Natív TypeScript | - Legkisebb ökoszisztéma<br>- Kevesebb Vue/React-hoz szokott dev ismeri | Alternatíva |

**Döntés: Vue 3 + Vite (SPA)**

A projekt természetéből adódóan (autentikált felhasználók, dinamikus adatok) egy kliens-oldali SPA teljesítménye elegendő. SSR nem szükséges – SEO nem prioritás (login-fal mögött van az app).

---

## 3. Backend döntési mátrix

| Opció | Előny | Hátrány | Ajánlott? |
|-------|-------|---------|-----------|
| **Koa.js** | - Minimális, Express-nél modernebb (async/await native)<br>- Teljesen moduláris middleware<br>- TypeScript-friendly<br>- Kis overhead | - Kisebb ökoszisztéma, mint Express/Fastify<br>- Manuálisabb konfiguráció | ✅ **IGEN** (user választása) |
| Fastify | - Nagyon gyors (benchmark-ok)<br>- TypeScript plugin rendszer<br>- OpenAPI support | - Plugin rendszer boilerplate-es | Alternatíva |
| Express.js | - Legnagyobb ökoszisztéma<br>- Rengeteg middleware elérhető | - Régi callback-alapú minták<br>- Kevésbé TypeScript-natív | Alternatíva |
| NestJS | - Enterprise-grade<br>- DI, decoratorok | - Overengineered ehhez a projekthez<br>- Meredek tanulási görbe | Nem ajánlott |

**Döntés: Koa.js + TypeScript**

```
Backend struktúra:
src/
  middleware/     – auth, errorHandler, rateLimiter
  routes/         – matches, predictions, groups, admin, auth
  services/       – scoring.service.ts, prediction.service.ts, ...
  db/             – drizzle schema, migrations, client
  types/          – shared TypeScript típusok
```

**Koa middleware stack:**
1. `koa-helmet` – security headers
2. `koa-cors` – CORS kezelés
3. `koa-compress` – gzip
4. `koa-bodyparser` – JSON body parsing
5. `koa-router` – route kezelés
6. `koa-jwt` / custom JWT middleware – auth
7. Custom rate limiter (Redis vagy in-memory)

---

## 4. Adatbázis és ORM döntési mátrix

### Adatbázis

| Opció | Előny | Hátrány | Ajánlott? |
|-------|-------|---------|-----------|
| **PostgreSQL 16** | - ACID compliant<br>- JSONB támogatás (pl. audit log)<br>- Robusztus, production-proven<br>- Railway, Supabase, Render mind támogatja | - Nehezebb mint SQLite local devhez | ✅ **IGEN** |
| MySQL 8 | - Széles hosting support | - Gyengébb JSONB<br>- Kevésbé feature-rich | Nem ajánlott |
| SQLite | - Zero-setup local dev | - Nem alkalmas multi-user prodhoz | Dev only |
| Supabase | - Managed PG + Auth + Realtime | - Vendor lock-in<br>- Ingyenes tier korlátok | Alternatíva |

### ORM

| Opció | Előny | Hátrány | Ajánlott? |
|-------|-------|---------|-----------|
| **Drizzle ORM** | - Lightweight (zero runtime overhead)<br>- SQL-közeli, átlátható<br>- Kiváló TypeScript type inference<br>- Drizzle Kit: built-in migration tool<br>- Performantabb, mint Prisma nagy query-knél | - Fiatalabb projekt (2022–)<br>- Kevesebb community tartalom | ✅ **IGEN** |
| Prisma | - Legnagyobb ORM ökoszisztéma<br>- Prisma Studio UI<br>- Generált client típusok | - Runtime overhead (query engine binary)<br>- N+1 problémák<br>- Nehezebb raw SQL | Alternatíva |
| Knex.js | - SQL-közeli, régi megbízható | - Nincs type inference<br>- Manuális típusok | Nem ajánlott |
| TypeORM | - Decoratorok, Active Record | - Buggy migrations<br>- Karbantartási problémák | Nem ajánlott |

---

## 5. Auth megoldás összehasonlítása

### A) Supabase Auth + Google OAuth (Elsődleges, implementálandó)

**Flow:**
```
User → "Bejelentkezés Google-lel" gomb
  → Frontend: supabase.auth.signInWithOAuth({ provider: 'google' })
  → Supabase Auth kezeli a Google OAuth consent screen-t
  → Callback: Supabase session (access_token + refresh_token)
  → Frontend: session tárolása (Supabase JS client auto-kezeli)
  → Backend API hívásokhoz: Authorization: Bearer <supabase_access_token>
  → Backend: Supabase JWT validálás (SUPABASE_JWT_SECRET-tel) – nincs DB hívás
  → Backend: upsert users tábla Drizzle-lel (első belépésnél)
```

**Dev mode bypass (VITE_DEV_AUTH_BYPASS=true):**
```
User → "Bejelentkezés" gomb
  → Frontend: ha VITE_DEV_AUTH_BYPASS=true, nincs OAuth redirect
  → Mock user session felállítása (előre definiált test user adatok)
  → Redirect a főoldalra – azonnal, valódi auth nélkül
  → Backend hívásokhoz: fejlesztői mock JWT (vagy backend bypass middleware)
```

**Tech:**
- `@supabase/supabase-js` – Supabase JS client (auth + potenciálisan realtime)
- Supabase JWT: access token auto-refresh a Supabase client által
- Backend: `SUPABASE_JWT_SECRET` env változóval validálás (`jsonwebtoken` vagy Supabase admin SDK)
- Nincs szükség `passport-google-oauth20`-ra és saját refresh token logikára

**Előnyök:**
- Supabase kezeli a teljes OAuth flow-t, token rotationt, session managementet
- Nincs jelszókezelés, nincs saját refresh token tábla a DB-ben
- Email + jelszó auth hozzáadása dashboard toggle – zero extra kód (Should Have fázis)
- Dev bypass pattern: gyors fejlesztés auth nélkül

**Hátrányok:**
- Supabase vendor dependency (auth + DB)
- Supabase ingyenes tier korlátok (50.000 MAU – MVP-hez elegendő)

**Komplexitás:** M

---

### B) Email + Jelszó (Jövőbeli iteráció, Should Have)

**Flow:**
```
Supabase Auth email+jelszó provider bekapcsolása (dashboard toggle)
  → Frontend: supabase.auth.signUp({ email, password })
  → Supabase kezeli az email verifikációt, jelszó hashelést, reset flow-t
  → Nincs extra backend logika – azonos JWT validáció mint OAuth esetén
```

**Előnyök:**
- Supabase miatt a komplexitás töredéke a saját implementációhoz képest
- Email template-ek konfigurálhatók a Supabase dashboardon

**Komplexitás:** S (Supabase-szel – korábban L volt saját implementációval)

---

### Összehasonlítás

| Szempont | Supabase Auth | Saját Google OAuth + JWT |
|----------|--------------|--------------------------|
| Fejlesztési idő | ~1 nap | ~2-3 nap |
| Token kezelés | Auto (Supabase client) | Manuális refresh logika |
| Email+jelszó hozzáadása | Dashboard toggle | ~5-7 nap fejlesztés |
| Karbantartás | Alacsony | Közepes |
| Vendor lock-in | Supabase | Nincs |
| Dev bypass | Könnyű | Könnyű |
| Ajánlott | ✅ IGEN | Alternatíva |

---

## 6. Real-time frissítés

### Döntés: Server-Sent Events (SSE)

| Opció | Előny | Hátrány | Ajánlott? |
|-------|-------|---------|-----------|
| **SSE** | - HTTP/1.1 kompatibilis<br>- Egyszerű implementáció (EventSource API)<br>- Automatikus reconnect<br>- Nincs extra csomag frontend-en | - Csak szerver → kliens irány<br>- HTTP/1.1 connection limit (6 per domain) | ✅ **IGEN** |
| WebSocket | - Kétirányú kommunikáció<br>- Alacsony latency | - Komplexebb infrastruktúra<br>- Nincs szükség kétirányúra | Nem ajánlott |
| Polling | - Legegyszerűbb | - Felesleges terhelés<br>- Lassabb frissítés | Nem ajánlott |

**SSE használati esetek:**
- Ranglista frissítése eredmény rögzítés után
- Meccs státusz változás (scheduled → live → finished)
- Torna-szintű értesítések (pl. "Az eredmény rögzítve, pontjaid frissültek!")

**Implementáció vázlat:**
```typescript
// Koa SSE endpoint
router.get('/api/events', async (ctx) => {
  ctx.set({
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    'Connection': 'keep-alive',
  })
  ctx.status = 200

  const stream = new PassThrough()
  ctx.body = stream

  const listener = (event: AppEvent) => {
    stream.write(`data: ${JSON.stringify(event)}\n\n`)
  }

  eventBus.on('leaderboard:update', listener)
  ctx.req.on('close', () => eventBus.off('leaderboard:update', listener))
})
```

---

## 7. State management

### Döntés: Pinia

| Opció | Előny | Hátrány | Ajánlott? |
|-------|-------|---------|-----------|
| **Pinia** | - Vue 3 official state megoldás<br>- TypeScript-natív, auto inference<br>- DevTools integráció<br>- Moduláris stores<br>- Composition API stílusú | - Kisebb feature-set, mint Vuex (de nincs rá szükség) | ✅ **IGEN** |
| Vuex 4 | - Régi, ismert | - Legacy pattern (mutations)<br>- Pinia váltotta fel | Nem ajánlott |
| Tanstack Query | - Server state management<br>- Cache, invalidation, refetch | - Extra dependency<br>- Átfedés Pinia-val | Opcionális addon |

**Store struktúra:**
```
stores/
  auth.store.ts      – user, token, login/logout actions
  matches.store.ts   – meccsek listája, szűrők
  predictions.store.ts – saját tippek cache
  leaderboard.store.ts – ranglista adatok
  groups.store.ts    – csoportok, tagság
```

**Tip:** `@tanstack/vue-query` is hozzáadható a Pinia mellé server state kezeléshez (cache invalidation eredmény rögzítés után), de az MVP-hez Pinia elegendő.

---

## 8. Hosting és deployment

### Ajánlott konfiguráció

```
┌──────────────────────────────────────────────────────────────────────┐
│                          DEPLOYMENT                                   │
│                                                                      │
│  ┌──────────┐       ┌──────────────┐       ┌──────────────────────┐  │
│  │  Vercel  │       │   Railway    │       │      Supabase        │  │
│  │          │       │              │       │                      │  │
│  │ Vue SPA  │ HTTPS │  Koa.js API  │ SQL   │  ┌────────────────┐  │  │
│  │ (Static  │──────►│  (REST +     │──────►│  │ PostgreSQL 18.3│  │  │
│  │  Build)  │       │   SSE)       │       │  └────────────────┘  │  │
│  └──────────┘       └──────────────┘       │  ┌────────────────┐  │  │
│                                            │  │  Supabase Auth │  │  │
│                                            │  │ (Google OAuth) │  │  │
│                                            │  └────────────────┘  │  │
│                                            └──────────────────────┘  │
└──────────────────────────────────────────────────────────────────────┘
```

| Komponens | Platform | Indoklás |
|-----------|----------|----------|
| Frontend (Vue SPA) | **Vercel** | Ingyenes, CDN, preview deployments PR-onként |
| Backend (Koa) | **Railway** | Egyszerű Node.js deploy, env vars kezelés |
| PostgreSQL | **Supabase** | Managed PG 18.3, ingyenes tier (500MB), connection pooling |
| Auth | **Supabase Auth** | Google OAuth, session kezelés, email+jelszó opció |
| Alternatíva all-in-one | **Render** | Ingyenes tier, de lassabb cold start |

**Environment-ek:**
- `development` – local Docker Compose (sima PostgreSQL 18.3 – Supabase API nélkül, Supabase Auth bypass)
- `staging` – Supabase staging project + Railway preview
- `production` – Vercel + Railway + Supabase prod project

**Local dev Docker Compose felépítés:**
```yaml
# docker-compose.yml
services:
  db:
    image: postgres:18.3
    environment:
      POSTGRES_DB: tippgame
      POSTGRES_USER: tippgame
      POSTGRES_PASSWORD: tippgame
    ports:
      - "5432:5432"
    volumes:
      - pgdata:/var/lib/postgresql/data

  backend:
    build:
      context: ./packages/backend
      dockerfile: Dockerfile
    # Dockerfile: FROM node:24.14.1-alpine
    environment:
      DATABASE_URL: postgres://tippgame:tippgame@db:5432/tippgame
      NODE_ENV: development
      # Supabase JWT secret – dev-ben mock értékkel
      SUPABASE_JWT_SECRET: dev-secret
    ports:
      - "3000:3000"
    depends_on:
      - db
    volumes:
      - ./packages/backend:/app
      - /app/node_modules

  frontend:
    build:
      context: ./packages/frontend
      dockerfile: Dockerfile
    # Dockerfile: FROM node:24.14.1-alpine
    environment:
      VITE_API_URL: http://localhost:3000
      # Dev auth bypass: bejelentkezés gomb mock userrel lép be
      VITE_DEV_AUTH_BYPASS: "true"
    ports:
      - "5173:5173"
    depends_on:
      - backend
    volumes:
      - ./packages/frontend:/app
      - /app/node_modules

volumes:
  pgdata:
```

**Dev auth bypass viselkedés (`VITE_DEV_AUTH_BYPASS=true`):**
- A login gombra kattintva nincs OAuth redirect
- Mock user session töltődik be (előre definiált name, email, avatar)
- A backend `NODE_ENV=development` + `SUPABASE_JWT_SECRET=dev-secret` kombóval elfogad egy mock JWT-t
- Gyors fejlesztés és UI tesztelés auth setup nélkül

**Minden Dockerfile base image:** `node:24.14.1-alpine`

**CI/CD:**
- GitHub Actions: lint → test → build → deploy
- PR preview: Vercel automatic preview deployments

---

## 9. Teljes projekt struktúra

```
tipp-game/
├── packages/
│   ├── frontend/                 # Vue 3 SPA
│   │   ├── src/
│   │   │   ├── components/
│   │   │   │   ├── matches/
│   │   │   │   ├── predictions/
│   │   │   │   ├── leaderboard/
│   │   │   │   ├── groups/
│   │   │   │   └── admin/
│   │   │   ├── views/
│   │   │   ├── stores/           # Pinia stores
│   │   │   ├── composables/      # Vue composables
│   │   │   ├── router/           # Vue Router
│   │   │   ├── api/              # API client (fetch wrappers)
│   │   │   └── types/
│   │   ├── index.html
│   │   ├── vite.config.ts
│   │   └── package.json
│   │
│   └── backend/                  # Koa.js API
│       ├── src/
│       │   ├── routes/
│       │   │   ├── auth.routes.ts
│       │   │   ├── matches.routes.ts
│       │   │   ├── predictions.routes.ts
│       │   │   ├── leaderboard.routes.ts
│       │   │   ├── groups.routes.ts
│       │   │   ├── admin.routes.ts
│       │   │   └── events.routes.ts     # SSE
│       │   ├── middleware/
│       │   │   ├── auth.middleware.ts   # JWT verify
│       │   │   ├── admin.middleware.ts  # role check
│       │   │   ├── rateLimit.middleware.ts
│       │   │   └── error.middleware.ts
│       │   ├── services/
│       │   │   ├── scoring.service.ts   # PURE function, testelhető
│       │   │   ├── prediction.service.ts
│       │   │   ├── leaderboard.service.ts
│       │   │   ├── group.service.ts
│       │   │   └── notification.service.ts  # SSE event bus
│       │   ├── db/
│       │   │   ├── schema/
│       │   │   │   └── index.ts         # Drizzle schema
│       │   │   ├── migrations/
│       │   │   └── client.ts            # Drizzle client init
│       │   ├── types/
│       │   └── app.ts                   # Koa app setup
│       ├── tests/
│       │   └── scoring.service.test.ts  # Unit tesztek
│       └── package.json
│
├── package.json                   # npm workspaces root
├── .nvmrc                         # 24.14.1
└── docker-compose.yml             # Local dev (teljes stack: frontend + backend + PG 18.3)
```

---

## 10. Függőségi lista

> **Szabály:** minden verzió exact (nincs `^` vagy `~`) – reprodukálható buildek garantálása érdekében.

### Root `package.json` (npm workspaces)

```json
{
  "name": "tipp-game",
  "version": "0.0.1",
  "private": true,
  "workspaces": ["packages/*"],
  "engines": {
    "node": "24.14.1",
    "npm": ">=10"
  }
}
```

### Backend (Koa + TypeScript)

```json
{
  "dependencies": {
    "koa": "3.1.2",
    "@koa/router": "15.4.0",
    "@koa/cors": "5.0.0",
    "koa-bodyparser": "4.4.1",
    "koa-helmet": "9.0.0",
    "koa-compress": "5.2.1",
    "@supabase/supabase-js": "2.50.0",
    "jsonwebtoken": "9.0.3",
    "drizzle-orm": "0.45.2",
    "pg": "8.20.0",
    "zod": "4.3.6"
  },
  "devDependencies": {
    "drizzle-kit": "0.31.10",
    "typescript": "6.0.2",
    "tsx": "4.21.0",
    "vitest": "4.1.2",
    "@vitest/coverage-v8": "4.1.2",
    "@types/koa": "3.0.2",
    "@types/pg": "8.20.0",
    "@types/jsonwebtoken": "9.0.10",
    "@types/koa__router": "12.0.5",
    "@types/koa__cors": "5.0.1",
    "@types/koa-bodyparser": "4.3.13",
    "@types/koa-compress": "4.0.7",
    "@types/node": "25.5.0"
  }
}
```

### Frontend (Vue 3 + Vite)

```json
{
  "dependencies": {
    "vue": "3.5.31",
    "vue-router": "5.0.4",
    "pinia": "3.0.4",
    "@vueuse/core": "14.2.1",
    "@supabase/supabase-js": "2.50.0",
    "zod": "4.3.6"
  },
  "devDependencies": {
    "vite": "8.0.3",
    "@vitejs/plugin-vue": "6.0.5",
    "typescript": "6.0.2",
    "vue-tsc": "3.2.6",
    "@vue/test-utils": "2.4.6",
    "vitest": "4.1.2",
    "tailwindcss": "4.2.2",
    "autoprefixer": "10.4.27",
    "postcss": "8.5.8",
    "@types/node": "25.5.0"
  }
}
```

**CSS framework: Tailwind CSS v4**
- Utility-first, mobile-first design
- v4: CSS-first konfiguráció (`@import "tailwindcss"` – nincs `tailwind.config.js`)
- Kis bundle (built-in tree-shaking)

---

## 11. E12 – Futball API (Adatszinkron)

### Döntés: api-football.com (api-sports.io)

**Választott API:** https://www.api-football.com

| Szempont | Érték |
|----------|-------|
| Base URL | `https://v3.football.api-sports.io` |
| Auth | Header: `x-apisports-key: YOUR_KEY` |
| Free tier | 100 req/nap (fejlesztés + NB II tesztelés) |
| Pro tier | $19/hó – 7,500 req/nap (MVP, VB 2026 alatt) |

**Fedezett ligák (projekt szempontjából):**
- FIFA World Cup 2026 (league ID: 1)
- UEFA Nations League (league ID: ~5)
- Internacionális barátságos (league ID: ~10)
- Magyar NB I – Nemzeti Bajnokság I (league ID: ~271)
- Magyar NB II (league ID: ~272) — tesztelési célra

> ⚠️ Liga ID-kat verifikálni kell a `GET /leagues?country=Hungary` hívással a saját API key-jel (implementáció előtt, US-1202 részeként).

**Szinkronizációs mód (`FOOTBALL_SYNC_MODE` env változó):**

| Érték | Leírás | Req/nap |
|-------|--------|---------|
| `off` | Nincs API hívás (dev, CI) | 0 |
| `final_only` | Csak végeredmény meccs után | ~20–40 |
| `adaptive` | Live alatt 2 percenként, egyébként ritka (alapértelmezett) | ~100–300 |
| `full_live` | Minden percben live lekérdezés | max kvóta |

**Indoklás:** Egyetlen $19/hó-os tier lefedi az összes szükséges ligát. Az egyetlen API, ahol a Magyar NB II elérhető — football-data.org-on NB II nem létezik egyik tier-en sem.

**Részletes kutatási összefoglaló:** `plans/05-football-api.md`
