# VB Tippjáték – Claude útmutató

## Orchestrator szabály

Minden felhasználói kérést először a `product-orchestrator` agenten keresztül dolgozz fel. Az orchestrator dönti el, melyik specialist agentet kell meghívni.

**Kivételek** (ezeket NE küldd az orchestratornak):

- Egyszerű, közvetlen kérdések ("mi ez a fájl?", "magyarázd el ezt a kódot")
- Explicit agent-hívás ("hívd a story-writer-t", "kérdezd meg a system-architect-et")
- Git műveletek (commit, push, PR, branch)
- Fájl olvasás/szerkesztés amit a user konkrétan kér
- Memory műveletek (remember, forget)
- Rövid, egyértelmű bugfix vagy typo javítás
- Egyértelmű implementációs feladat ahol a story és terv már ismert

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

**Hosting:** Vercel (frontend) + Render (backend) + Supabase (DB + Auth)

## Tech stack

| Réteg     | Technológia                                                  |
| --------- | ------------------------------------------------------------ |
| Frontend  | Vue 3, Vite, TypeScript, Composition API, Pinia, Tailwind v4 |
| Backend   | Koa.js, TypeScript, @koa/router                              |
| DB / ORM  | PostgreSQL 18.3, Drizzle ORM                                 |
| Runtime   | Node.js 24.14.1 (LTS)                                        |
| Auth      | Google OAuth 2.0 + JWT (access 15 min / refresh 30 nap)      |
| Real-time | Server-Sent Events (SSE)                                     |
| Tesztek   | Vitest (mindkét csomag)                                      |
| Helyi dev | Docker Compose (frontend + backend + DB együtt)              |

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

| Fájl                          | Tartalom                                              |
| ----------------------------- | ----------------------------------------------------- |
| `plans/00-backlog.md`         | Nyitott story-k (ID, cím, prioritás, függőségek)      |
| `plans/00-history.md`         | Kész story-k kompakt listája                          |
| `plans/stories/<ID>.md`       | Egyedi story fájlok (elfogadási kritériumok, tech)    |
| `plans/02-database-schema.md` | Drizzle schema, ER-diagram, indexek                   |
| `plans/03-tech-stack.md`      | Döntési mátrix, auth flow, projekt struktúra          |
| `plans/04-extras.md`          | Nice-to-have ötletek (post-MVP)                       |

**User story-kkal kapcsolatos munka esetén** (írás, módosítás, státusz kérdés, implementálás):

- **Kötelező** először elolvasni: `plans/00-backlog.md`
- Aztán nyisd meg a konkrét story fájlt: `plans/stories/<ID>.md`
- Referencia (csak ha kell): `02-database-schema.md`, `03-tech-stack.md`

**Story lezárása** (amikor egy story implementálása kész és a tesztek zöldek):

1. Töröld a sort a `plans/00-backlog.md` táblából
2. Add hozzá a sort a `plans/00-history.md` tábla végéhez (ID, cím, prioritás)
3. Frissítsd a `00-backlog.md` fejlécében a "Haladás" számlálót
4. Mozgasd a story fájlt: `plans/stories/<ID>.md` → `plans/stories/archive/<ID>.md`

**`plans/stories/archive/`** — kész story-k archívuma. Csak explicit kérésre olvasd (pl. "nézd meg a régi US-201 story-t").

## Prioritások

- **Must Have:** mind kész (31/31)
- **Nyitott feladatok:** lásd `plans/00-backlog.md` (prioritás + függőségek)

## Modell stratégia (költségoptimalizálás)

- **Kutatás, fájl keresés, grep:** subagent `model: "sonnet"` vagy `"haiku"`
- **Implementáció, refaktor, architektúra:** Opus (fő session)
- **Párhuzamos független kutatások:** több haiku/sonnet subagent egyszerre
- **Git műveletek (commit, push, status):** subagent `model: "haiku"`

## Output minimalizálás (kötelező)

- **Minden szöveges output max 1 mondat, max 120 karakter** – tool hívások előtt, között, után egyaránt
- **Tilos:** többmondatos magyarázat, indoklás, felsorolás hogy mit fogsz csinálni, diff összefoglalás
- **Ha nincs mondanivaló:** ne írj semmit, csak hívd a toolt
- **Végén:** 1 mondat – mi változott

## Kontextus optimalizálás

- Nagy fájlok (>200 sor): `offset`/`limit` paraméterrel olvasd, ne egészben
- Ha egy fájlt teljes egészében kell beolvasni (>200 sor), **kérdezz rá** mielőtt megteszed
- Grep > Read: ha csak egy szekciót keresel, grep-pelj, ne olvasd be az egészet
- plans/ fájlok: a backlog/history fejléc elég a státuszhoz, ne olvasd végig ha nem kell
- Subagent delegálás: izolált kutatás nem terheli a fő kontextust

## Alapelv

> Először teszt. Utána egyszerű, típusos megoldás. Refaktor csak zöld tesztekkel.
