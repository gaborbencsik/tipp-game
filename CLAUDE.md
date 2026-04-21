# VB Tippjáték – Claude útmutató

## A projekt

Nyári labdarúgó VB tippjáték platform. Monorepo (npm workspaces):

```
tipp-game/
├── packages/
│   ├── frontend/   # Vue 3 + Vite + TypeScript + Tailwind v4 + Pinia
│   └── backend/    # Koa.js + TypeScript + Drizzle ORM + PostgreSQL 18.3
├── plans/          # Tervdokumentumok (csak olvasni)
├── .nvmrc          # 24.14.1
└── docker-compose.yml  # Teljes stack: frontend + backend + PG 18.3
```

**Hosting:** Vercel (frontend) + Railway (backend + PG)

## Tech stack

| Réteg | Technológia |
|-------|-------------|
| Frontend | Vue 3, Vite, TypeScript, Composition API, Pinia, Tailwind v4 |
| Backend | Koa.js, TypeScript, @koa/router |
| DB / ORM | PostgreSQL 18.3, Drizzle ORM |
| Runtime | Node.js 24.14.1 (LTS) |
| Auth | Google OAuth 2.0 + JWT (access 15 min / refresh 30 nap) |
| Real-time | Server-Sent Events (SSE) |
| Tesztek | Vitest (mindkét csomag) |
| Helyi dev | Docker Compose (frontend + backend + DB együtt) |

## Adatbázis konvenciók

- **PK:** UUID (nem serial)
- **Soft delete:** `deleted_at TIMESTAMPTZ` – érintett táblák: `users`, `matches`, `groups`
- **Lekérdezéseknél mindig:** `.where(isNull(table.deletedAt))`
- **Audit log:** dedikált `audit_logs` tábla – kritikus műveletek: `result_set`, `ban`, `role_change`
- **Pontrendszer:** DB-ben tárolva (`scoring_configs`), nem hardcoded – csoportonként override-olható
- **Minden timestamp:** `TIMESTAMPTZ`

## Backend struktúra

```
src/
  routes/       # auth, matches, predictions, leaderboard, groups, admin, events (SSE)
  middleware/   # auth.middleware.ts (JWT), admin.middleware.ts (role check), error, rateLimit
  services/     # scoring.service.ts (PURE), prediction, leaderboard, group, notification
  db/
    schema/     # Drizzle schema (index.ts)
    migrations/ # NE módosítsd kézzel
    client.ts
```

`scoring.service.ts` szignatúra: `calculatePoints(prediction, result, config) => number` – nincs DB-hívás, unit testelhető.

## Frontend struktúra

```
src/
  components/   # matches/, predictions/, leaderboard/, groups/, admin/
  views/
  stores/       # auth, matches, predictions, leaderboard, groups (Pinia)
  composables/
  router/
  api/          # fetch wrappers
```

## Kódolási szabályok (kötelező)

### TypeScript
- **`any` tilos** – használj `unknown`-t vagy union type-ot helyette
- Explicit visszatérési típus minden függvénynél
- `interface` szerződésekhez (service-ek, portok), `type` union/összetett típusokhoz
- `readonly` ahol lehetséges

### Tesztelés – TDD
- **Minden üzleti logikához kötelező teszt** – teszt nélküli logika nem elfogadható
- TDD sorrend: **Red → Green → Refactor**
- Minden változtatás után **az összes teszt fusson le** és legyen zöld
- Mockolni csak: infrastruktúrát, IO-t, külső service-eket – domain logikát **tilos**
- Tesztfájl: `*.test.ts` vagy `*.spec.ts`, az implementáció mellett

### Clean Code / SOLID
- Egy függvény = egy felelősség
- Ne keverd a domain logikát, infrastruktúrát és framework kódot
- Dependency Inversion: magas szintű modulok interface-re támaszkodnak, nem konkrét implementációra
- Nincs mágikus szám, nincs duplikált logika, nincs mély egymásba ágyazás

### Hibakezelés és async
- Custom error osztályok, ne nyeld el a hibákat
- `async/await` mindig, callback-alapú megoldások kerülendők
- Promise visszatérési típus legyen explicit

## Mit NE csinálj

- Ne módosíts migrations fájlokat kézzel
- Ne írj hardcoded konfigot (portok, pontértékek, stb.)
- Ne adj hozzá nem kért feature-t, kommentet, docstringet
- Ne hagyj félkész, nem futtatható kódot

## Tervdokumentumok

| Fájl | Tartalom |
|------|----------|
| `plans/00-status.md` | Story-k aktuális státusza (kész / folyamatban / TODO) |
| `plans/01-project-plan.md` | User story-k (E1–E10, US-101–US-902) |
| `plans/02-database-schema.md` | Drizzle schema, ER-diagram, indexek |
| `plans/03-tech-stack.md` | Döntési mátrix, auth flow, projekt struktúra |
| `plans/04-extras.md` | Nice-to-have ötletek (post-MVP) |

**User story-kkal kapcsolatos munka esetén** (írás, módosítás, státusz kérdés, implementálás):
- **Kötelező** először elolvasni: `plans/00-status.md` + `plans/01-project-plan.md`
- Nézd meg a teljes `plans/` mappát is a kontextusért (schema, tech stack, extras)

## Prioritások

- **Must Have (22 story):** E1–E8 epic-ek – ezek az MVP
- **Should Have (6 story):** stat tippek, email auth, mások tippjei, profil szerk.
- **Nice to Have:** E10 epic (lásd 04-extras.md) – csak az MVP után

## Alapelv

> Először teszt. Utána egyszerű, típusos megoldás. Refaktor csak zöld tesztekkel.

## Orchestrator szabály

Minden felhasználói kérést először a `product-orchestrator` agenten keresztül dolgozz fel. Az orchestrator dönti el, melyik specialist agentet kell meghívni.

**Kivételek** (ezeket NE küldd az orchestratornak):
- Egyszerű, közvetlen kérdések ("mi ez a fájl?", "magyarázd el ezt a kódot")
- Explicit agent-hívás ("hívd a story-writer-t", "kérdezd meg a system-architect-et")
- Git műveletek (commit, push, PR, branch)
- Fájl olvasás/szerkesztés amit a user konkrétan kér
- Memory műveletek (remember, forget)
- Rövid, egyértelmű bugfix vagy typo javítás
