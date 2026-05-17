# Knowledge Base átszervezési javaslat

> Dátum: 2026-05-15 | v2 — kiegészítve wiki skill és Quarto értékelésével

---

## Jelenlegi problémák

| Probléma | Hatás |
|----------|-------|
| `plans/` flat mappa heterogén tartalmakkal | Referencia doc, UX review, concept doc, QA guide mind egymás mellett — nincs szemantikai struktúra |
| Referencia doksik elavulnak | `02-database-schema.md` (48 sor) nem tükrözi a 27 migrációt; kézzel karbantartott "tükör" a kódról |
| Nagy terv-dokumentumok (759 sor AI insights plan) | Kontextus-ablakot zabálja, ritkán kell egészben |
| Nincs döntési napló (ADR) | Miért Koa és nem Express? Miért SSE és nem WebSocket? Elvész a fejből |
| Story format inkonzisztens | Régi: plain heading; Új: YAML front-matter — nincs validálás, nincs lekérdezhetőség |
| Nincs kereshető index a stories felett | "Melyik story érinti a scoring service-t?" — grep kell, nincs tag/area rendszer |
| Changelog/QA doksik dátummal — nincs lifecycle | `changelog-2026-04-10.md` örökre ott marad |
| Nincs cross-referencia rendszer | Doksik nem hivatkoznak egymásra strukturáltan — döntés → story → modul összefüggés elvész |
| Implicit tudás nincs rögzítve | "Miért van itt ez a workaround?" típusú kontextus elvész session-ök között |

---

## Megvizsgált megközelítések

### QMD (tobi/qmd) — KIEGÉSZÍTŐ ESZKÖZ

**Mi ez:** On-device hybrid search engine markdown knowledge base-ekhez. BM25 full-text + vektor szemantikus keresés + LLM re-ranking. MCP szerveren keresztül Claude-nak is elérhető.

| Előny | Hátrány |
|-------|---------|
| Lokális szemantikus keresés (nem csak grep) | ~2GB modell letöltés (embedding + reranker + query expansion) |
| MCP integráció — Claude tool-ként használhatja | Node.js ≥22 kell (megvan: 24.14.1) |
| Kontextus metadata (path-hierarchia, leírások) | Indexelés idő (első build) |
| Hybrid: keyword + meaning + reranking | Csak szöveges fájlok (md, ts, py) |
| Fuzzy search, kód AST-aware chunking | Nincs Windows CUDA support (nem releváns) |

**Hogyan illeszkedik a rendszerbe:**

```
┌─────────────────────────────────────────────────────┐
│  Claude Code session                                │
│                                                     │
│  1. wiki/index.md → gyors áttekintés (READ)        │
│  2. qmd query "scoring lifecycle" → szemantikus     │
│     keresés az egész KB-ben (MCP tool)              │
│  3. wiki/pages/mod-scoring.md → részletes oldal     │
└─────────────────────────────────────────────────────┘
```

- **Indexelendő:** `wiki/pages/`, `plans/stories/`, `plans/concepts/`, `plans/guides/`
- **Nem indexelendő:** `plans/stories/archive/` (100+ régi fájl, ritkán kell)
- **Kontextusok:**
  ```bash
  qmd context add wiki://pages "Project wiki — architecture, modules, flows, decisions"
  qmd context add plans://stories "Active user stories with acceptance criteria"
  qmd context add plans://concepts "Feature research and design documents"
  ```

**Verdikt:** QMD a wiki FÖLÉ kerül mint keresési réteg — nem helyettesíti a struktúrát, hanem kereshetővé teszi. A wiki adja a tudást, QMD adja a retrieval-t. Önmagában a wiki is működik (grep + index.md), de QMD-vel "kérdezni" is lehet a tudásbázistól.

**Kérdés:** Megéri-e bevezetni? Egy ~20-30 oldalas wiki-nél még a grep + index.md elég. QMD akkor lesz igazán értékes, ha:
- 50+ wiki oldal van
- Story archívumot is keresni akarjuk (120+ fájl)
- "Melyik modul érint X-et?" típusú kérdések gyakoriak

**Javaslat:** Fázis 3 — a wiki bootstrap után, ha a grep már nem elég.

---

### LLM Wiki pattern (Karpathy) — ADAPTÁLVA

A Karpathy-féle "LLM Wiki" lényege: az LLM egyszer szintetizálja a tudást wiki oldalakra, utána mindig a kompilált tudást olvassa vissza — nem a nyers forrásokat. Ez pont a mi problémánkra ad választ.

**Amit átveszünk:**
- `[[slug]]` cross-referenciák oldalak között
- YAML front-matter minden oldalon (title, tags, sources, updated)
- Flat page directory (könnyű grep, egyértelmű slug → fájl mapping)
- Index fájl mint katalógus (gyors áttekintés a teljes tudásbázisról)
- Append-only log (ki, mikor, mit változtatott)
- overview.md mint élő szintézis

**Amit NEM veszünk át:**
- `raw/` mappa immutable forrásokkal — nekünk a kód a forrás, nem külső paper-ek
- Nehéz citation rendszer (footnote + locator) — túl sok overhead egy 1-fős projektben
- `wiki-ingest` teljes ceremónia (3-5 takeaway, user confirmation) — mi gyorsabban dolgozunk

---

## Javasolt rendszer: Hybrid (plans/ átrendezés + wiki réteg)

### Mappastruktúra

```
plans/
├── README.md              ← Navigációs hub (egyetlen belépési pont)
├── backlog.md             ← Nyitott story-k táblázat (marad)
├── history.md             ← Kész story-k (marad)
│
├── stories/               ← Aktív story-k (változatlan lifecycle)
│   └── archive/           ← Kész story-k (változatlan)
│
├── decisions/             ← Architecture Decision Records (ADR)
│   ├── 001-koa-over-express.md
│   ├── 002-sse-over-websocket.md
│   ├── 003-supabase-auth.md
│   ├── 004-drizzle-orm.md
│   └── ...
│
├── concepts/              ← Feature kutatás/tervezés (nem story, nem döntés)
│   ├── match-pulse-insights.md
│   ├── stat-predictions.md
│   └── football-api-integration.md
│
├── guides/                ← Fejlesztői operatív útmutatók
│   ├── qa-checklist.md
│   ├── e2e-test-plan.md
│   └── security-baseline.md
│
└── archive/               ← Elavult egyszeri doksik
    ├── changelog-2026-04-10.md
    └── matches-redesign-ux-review.md

wiki/                      ← ÚJ: LLM-optimalizált tudásbázis (a projekt gyökerében)
├── SCHEMA.md              ← Konvenciók, kategóriák, cross-ref szabályok
├── index.md               ← Katalógus: minden oldal, kategóriánként
├── log.md                 ← Append-only változásnapló
├── overview.md            ← Élő szintézis: "mi ez a projekt, hogyan áll össze"
└── pages/                 ← Flat, slug-named oldalak
    ├── mod-backend-routes.md
    ├── mod-frontend-stores.md
    ├── mod-scoring-service.md
    ├── mod-sync-pipeline.md
    ├── api-predictions.md
    ├── api-matches.md
    ├── flow-auth-login.md
    ├── flow-prediction-lifecycle.md
    ├── flow-match-sync.md
    ├── dec-supabase-over-firebase.md
    ├── dec-sse-over-websocket.md
    ├── dec-drizzle-orm.md
    └── ...
```

---

## A két réteg szerepe

| | `plans/` | `wiki/` |
|---|---|---|
| **Célja** | Munka menedzselés | Tudás rögzítés |
| **Tartalom** | Mi a teendő, mi kész | Hogyan működik, miért így |
| **Életciklus** | Story: nyitott → archív | Oldal: létrejön → frissül → stale jelölés |
| **Ki írja** | Claude (story-writer) / te | Claude (wiki-ingest, wiki-update) / te |
| **Ki olvassa** | Claude (implementáláskor) / te | Claude (kontextus-építéskor) / te |
| **Formátum** | Story: YAML + AC lista | Wiki: YAML + prózai szintézis + [[link]]-ek |

**A lényeg:** `plans/` mondja meg MIT csinálj. `wiki/` mondja meg HOGYAN és MIÉRT van az ami van.

---

## Wiki page formátum

```markdown
---
title: Scoring Service
tags: [module, backend, scoring]
sources: [packages/backend/src/services/scoring.service.ts]
updated: 2026-05-15
---

# Scoring Service

A pontszámítás tisztán funkcionális: `calculatePoints(prediction, result, config) → number`.

## Működés

- Nincs DB-hívás — pure function, unit testelhető
- Config csoportonként override-olható ([[dec-scoring-config]])
- Ponttípusok: exact (3pt), winner+diff (2pt), winner (1pt), zero (0pt)

## Kapcsolódó oldalak

- [[flow-prediction-lifecycle]] — hol hívódik meg
- [[api-predictions]] — melyik endpoint triggereli
- [[mod-backend-routes]] — hol van regisztrálva
```

---

## Wiki kategóriák (index.md beosztása)

```
Modules | APIs | Flows | Decisions
```

- **Modules** — backend service-ek, frontend store-ok, fő komponens-csoportok (`mod-` prefix)
- **APIs** — endpoint csoportok, request/response szerződések (`api-` prefix)
- **Flows** — end-to-end user journey-k: auth, tippelés, sync pipeline (`flow-` prefix)
- **Decisions** — architekturális döntések (sourced + reconstructed) (`dec-` prefix)

---

## Cross-referencia rendszer: `[[slug]]`

```markdown
A sync pipeline ([[flow-match-sync]]) az API-football szolgáltatást használja,
aminek a választásáról a [[dec-api-football-provider]] oldalon írtunk.
```

- Slug = fájlnév `.md` nélkül
- Bidirekcionális: ha A hivatkozik B-re, B "Kapcsolódó oldalak" szekciójába is bekerül A
- `wiki-lint` validálja: broken link = hiba, orphan page = warning

---

## Hogyan épül fel a wiki (bootstrap sorrend)

1. `wiki-init` — SCHEMA.md + üres struktúra
2. CLAUDE.md ingest — projekt áttekintés
3. Key entry points: `src/index.ts`, route fájlok → `mod-` és `api-` oldalak
4. Döntések rekonstruálása kódból/git history-ból → `dec-` oldalak
5. 3-4 fő flow trace → `flow-` oldalak
6. overview.md kitöltése

**Nem kell egyszerre mindent:** 5 mély oldal > 50 felszínes. Fokozatosan épül, ahogy dolgozunk.

---

## ADR formátum (plans/decisions/)

```markdown
# ADR-001: Koa választása Express helyett

**Dátum:** 2026-03-15
**Státusz:** Elfogadva

## Kontextus
Express 5 még nem stabil, Koa middleware modell tisztább async/await-tel.

## Döntés
Koa 2 + @koa/router.

## Következmények
- Nincs beépített body parser → koa-bodyparser kell
- Middleware sorrend explicit (nincs magic)
```

**ADR vs wiki `dec-` oldal:** Az ADR a tömör döntési rekord. A wiki `dec-` oldal lehet bővebb, cross-linkelt szintézis. Kis projektnél akár egybe is vonható — a wiki `dec-` oldalak TARTALMAZHATJÁK az ADR részt, és akkor nem kell külön `plans/decisions/` mappa.

**Javaslat:** Kezdjük CSAK a wiki `dec-` oldalakkal. Ha kiderül hogy szükség van különálló, formális ADR-ekre (pl. review process), akkor bővítünk.

---

## Story YAML front-matter egységesítés

```yaml
---
id: US-1304
title: Match Pulse – insight megjelenítése
priority: Should Have
status: Open
area: [match-pulse, frontend]
dependencies: [US-1302]
complexity: M
created: 2026-05-01
---
```

Fix `area` készlet:
```
scoring, predictions, matches, groups, leaderboard, auth, admin,
match-pulse, players, sync, ux, security, infra
```

---

## CLAUDE.md frissítés

A "Tervdokumentumok" szekció helyett:

```markdown
## Keresési útmutató

| Kérdés típusa | Hol keresd |
|---------------|------------|
| "Hogyan működik X?" | wiki/pages/ (grep: `mod-`, `flow-`, `api-`) |
| "Miért így van?" | wiki/pages/dec-* |
| "Mi a teendő?" | plans/backlog.md → plans/stories/<ID>.md |
| "Hogyan teszteljek?" | plans/guides/ |
| "Mi a feature koncepció?" | plans/concepts/ |

## Wiki használat
- Claude kontextus-építéshez: `wiki/index.md` → releváns oldalak
- Új feature implementálásnál: először wiki/overview.md + érintett mod/flow oldalak
- Implementáció után: `wiki-update` a frissült modulokhoz
```

---

## Concept doc méretkorlát

**Szabály:** Max 150 sor per fájl. Ha nagyobb → bontás.

Példa: `08-ai-insights-plan.md` (759 sor) → 3-4 fájl `concepts/` alatt

---

## Karbantartás és lifecycle

| Trigger | Akció |
|---------|-------|
| Story lezárás | wiki-update az érintett mod/flow oldalakhoz |
| Új döntés | wiki-ingest (dec- oldal létrehozás) |
| 5-10 módosítás után | wiki-lint (egészségügyi audit) |
| Refaktor után | wiki-update (stale oldalak frissítése) |
| "Ez hogyan működik?" kérdés | wiki-query (először a wikiből válaszol) |

---

## Ami NEM változik

- Story lifecycle (nyitott → archív)
- Backlog/history tábla formátum
- CLAUDE.md mint fő instrukció (session bootstrap)
- Memory rendszer (.claude/memory/) — más célú (feedback, user context)
- Story prefix konvenció (US, UX, BUG, SEC)

---

## Migráció lépések

### Fázis 1: plans/ átrendezés (azonnali)
1. Új mappák: `concepts/`, `guides/`, `plans/archive/`
2. Fájlok átmozgatása az új helyükre
3. `02-database-schema.md` és `03-tech-stack.md` törlése (redundáns)
4. `plans/README.md` létrehozása
5. CLAUDE.md "Tervdokumentumok" szekció frissítése
6. Aktív story-k YAML front-matter egységesítése (`area` tag)
7. Nagy concept doc-ok darabolása (150 sor limit)

### Fázis 2: wiki bootstrapping (1-2 session)
1. `wiki-init` futtatása (codebase domain, Modules|APIs|Flows|Decisions kategóriák)
2. overview.md kitöltése (projekt összefoglaló)
3. Top 5 modul oldal (scoring, predictions, matches, sync, auth)
4. Top 3 flow oldal (auth, prediction lifecycle, match sync)
5. 4-5 decision oldal rekonstruálása (Koa, SSE, Supabase, Drizzle, monorepo)
6. Első wiki-lint futtatás

### Fázis 3: QMD szemantikus keresés (opcionális, ha wiki elég nagy)
1. `npm install -g @tobilu/qmd`
2. Collection-ök beállítása: `wiki/pages/`, `plans/stories/`, `plans/concepts/`
3. Kontextusok hozzáadása (leírások a collection-ökhöz)
4. MCP szerver bekötése Claude Code-ba (settings.json)
5. Indexelés: `qmd index`
6. Tesztelés: `qmd query "hogyan működik a scoring?"`

### Fázis 4: integráció a munkafolyamatba (ongoing)
- Story lezáráskor: wiki-update érintett oldalakhoz
- Minden 5. session: wiki-lint
- Új feature terv előtt: wiki-query → megvannak-e a releváns oldalak

---

## Döntés szükséges

| Kérdés | Opció A | Opció B |
|--------|---------|---------|
| ADR-ek hol éljenek? | Csak wiki `dec-` oldalak (egyszerűbb) | Külön `plans/decisions/` + wiki `dec-` (formálisabb) |
| Wiki helye? | Projekt gyökér: `wiki/` | Plans alatt: `plans/wiki/` |
| Mikor bootstrappoljuk? | Most azonnal (Fázis 2) | Később, ha tényleg kelleni fog |
| QMD bevezetése? | Fázis 3 után, ha 50+ oldal | Kihagyjuk, grep elég | 
