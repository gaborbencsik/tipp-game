# VB Tippjáték – Tech Stack összefoglaló

> A döntések véglegesek. Részletek: kódból olvashatók (package.json, docker-compose.yml, .env.example).

## Architektúra

```
┌──────────┐       ┌──────────────┐       ┌──────────────────────┐
│  Vercel  │       │    Render    │       │      Supabase        │
│ Vue SPA  │─HTTPS─│  Koa.js API  │──SQL──│  PostgreSQL 18.3     │
│ (Static) │       │  (REST+SSE)  │       │  Supabase Auth       │
└──────────┘       └──────────────┘       └──────────────────────┘
```

## Auth flow

```
User → Google OAuth gomb
  → supabase.auth.signInWithOAuth({ provider: 'google' })
  → Supabase Auth → callback → session (access_token + refresh_token)
  → Backend: Authorization: Bearer <token> → SUPABASE_JWT_SECRET validálás
  → Backend: upsert users tábla (első belépésnél)
```

Dev bypass: `VITE_DEV_AUTH_BYPASS=true` → mock user, nincs OAuth redirect.

## Real-time: SSE

- Koa endpoint: `GET /api/events` (text/event-stream)
- Használat: ranglista frissítés, meccs státusz változás
- Egyirányú (szerver → kliens), EventSource API, auto reconnect

## Futball API

- **api-football.com** (api-sports.io) — $19/hó Pro tier VB 2026 alatt
- Szinkron mód (`FOOTBALL_SYNC_MODE`): `off` | `final_only` | `adaptive` | `full_live`
- Fedezett ligák: FIFA WC 2026, NL, Magyar NB I/II
- Részletes kutatás: `plans/05-football-api.md`

## Render deploy

- Build: `npm run build` (TS → dist/)
- Pre-deploy: `npm run migrate:prod` (Drizzle migráció)
- Start: `npm run start` (node dist/index.js)
