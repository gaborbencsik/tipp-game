# Scoring Explainer — Design Spec

**Date:** 2026-06-01
**Status:** Draft (awaiting user review)
**Owner:** Product + UX (brainstorming session)

## 1. Probléma és cél

A pontozási szabályok ma csak a backend kódjában (`scoring.service.ts`) és az admin felületen érhetők el. A játékosok nem értik, miért kaptak X pontot egy meccsre, és nem tudnak tudatosan stratégiázni (pl. érdemes-e kockáztatni a pontos eredményt). Csoportonként eltérhet a pontozás, ezt sehol nem látják.

**Cél:** bárhonnan a tippjáték oldaláról 1 kattintással elérhető, csoport-specifikus, példákkal magyarázott pontozási szabályzat.

**Sikerkritérium:** a felhasználó saját szavaival el tudja mondani a 6 alap-pontozást, és tudja, hogy a csoportja eltér-e a globális defaulttól.

## 2. Megjelenés (UX)

**Komponens:** egyetlen `ScoringExplainerModal.vue`, mind a 4 belépési pontról ugyanaz nyílik.

**Belépési pontok:**
- **Főmenü:** "Pontozás" menüpont (asztal: nav, mobil: hamburger menü)
- **Ranglista oldal:** a fejlécben "Hogyan kapok pontot?" link (ikon + szöveg)
- **Csoport oldal:** a csoport neve mellett `(i)` ikon — kontextuálisan az adott csoport pontozása
- **Tipp képernyő (Match + Special):** a tipp form fejlécében `(i)` ikon

**Modal layout:**
- **Asztal:** középre igazított dialog, max szélesség ~640px, scrollozható törzs
- **Mobil:** teljes képernyős sheet, alulról csúszik fel, sticky fejléc + bezáró
- **Fejléc:** cím + bezáró X, frozen állapotnál lakat-ikon + tooltip
- **Törzs:** 3 fő szekció (lásd 3. pont)
- **Lábléc:** "Értem" CTA gomb

**A11y:** focus trap, ESC zár, trigger gombokon `aria-label`, modal `role="dialog"` + `aria-labelledby`, `aria-describedby`.

**Állapotkezelés:** Pinia store (`useScoringExplainerStore`) — `isOpen`, `data`, `loading`, `error`, `lastSource`, `open(source)`, `close()`. Bárhonnan ugyanúgy nyitható.

## 3. Tartalom

### 3.1 Csoport-kontextus logika

| Eset | Mit lát |
|------|---------|
| 0 csoport (vendég/új user) | csak a globális default szabályok |
| 1 csoport | annak a csoportnak az effektív configja egyetlen táblaként; fejléc: "[Csoportnév] pontozása" |
| 2+ csoport | default config a fő nézet; minden eltérő csoport sora kap egy "Eltérés a [Csoportnév]-ben" badge-et az érintett mező mellett |

### 3.2 Meccs-pontozás (mindig látszik)

Táblázat 3 oszloppal: **Eset / Pontok / Példa**. A 6 szabály a `scoring.service.ts:18–67` szerint:

| Eset | Default | Példa |
|------|---------|-------|
| Pontos eredmény | 3 | Te: 2-1, Eredmény: 2-1 |
| Helyes győztes + gólkülönbség | 2 | Te: 3-1, Eredmény: 2-0 |
| Helyes győztes | 1 | Te: 2-0, Eredmény: 3-1 |
| Helyes döntetlen | 2 | Te: 1-1, Eredmény: 2-2 |
| Helyes kimenetel (11-esek után) | 1 | Te: hazai továbbjutás, valódi: hazai 11-esekkel |
| Hibás | 0 | Te: 1-0, Eredmény: 0-2 |

### 3.3 Bónuszok

Csak akkor jelenik meg, ha a felhasználó legalább egy csoportjában `favoriteTeamDoublePoints = true`:

> **Kedvenc csapat: dupla pont** — Ha a kedvenc csapatod meccsét tippeled, az ott szerzett pont ×2.
> *Aktív: [Csoportnév1, Csoportnév2]*

### 3.4 Speciális tippek

Az adott kontextusú special tipp típusok listája (`specialPredictionTypes` + feliratkozott globálisok). Oszlopok: **Tipp neve / Leírás / Pontok**. Ha 2+ csoport és eltérnek, csoportonként alszekció.

A backend `source` mezővel jelöli az eredetet (`group-owned` | `subscribed-global`); a UI-ban most ezt nem mutatjuk vizuálisan, csak debug célból elérhető.

### 3.5 Lábjegyzet

> A pontok a meccs lefújása után automatikusan kerülnek jóváírásra. Ha a szabályzat változik a torna közben, a már kiosztott pontokat nem érinti.

## 4. Backend

### 4.1 Új public endpoint

`GET /api/scoring/explainer` — auth opcionális (vendégnek is működik).

**Response shape:**

```ts
{
  default: ScoringConfig,
  defaultFrozenAt: string | null,
  groups: Array<{
    id: string,
    name: string,
    config: ScoringConfig,
    configFrozenAt: string | null,
    favoriteTeamDoublePoints: boolean,
    specialTypes: Array<SpecialType & {
      source: 'group-owned' | 'subscribed-global'
    }>
  }>,
  globalSpecialTypes: SpecialType[]
}
```

`groups[].specialTypes` mind a csoport-saját (`group_id = X`), mind a `groupGlobalTypeSubscriptions`-ön keresztül feliratkozott globálisokat tartalmazza. `globalSpecialTypes` a `global_special_types` katalógus, vendégnek is látszik.

A soft-delete-tett csoportok kihagyva (`isNull(groups.deletedAt)`).

### 4.2 Új middleware (net-new infra)

`packages/backend/src/middleware/optionalAuth.middleware.ts` — ha van valid Bearer token, beállítja `ctx.state.user`-t; ha nincs vagy invalid, csendben tovább. A meglévő `authMiddleware` keményen 401-zik, ezért külön middleware kell. Egységtesztelve.

### 4.3 Service és route

- `packages/backend/src/services/scoring-explainer.service.ts` — **csak olvasó aggregátor** a meglévő `scoring-config.service.ts`, `global-special-types.service.ts`, `global-type-subscriptions.service.ts` fölött. Üzleti logika nem kerül bele.
- `packages/backend/src/routes/scoring.routes.ts` — új public route a `/api/scoring` prefixen, az `optionalAuthMiddleware`-rel.

### 4.4 Caching

**Nincs cache.** A query triviális (3 kis tábla, kulcs-lookup), és az admin recalc flow után azonnal pontos szabályzatot mutat — pont akkor, amikor számít.

### 4.5 Frozen state

A backend visszaadja a `frozenAt` időbélyeget. Ha nem null, a UI lakat-ikont jelenít meg + tooltip: *"Ez a szabályzat véglegesítve, a torna alatt nem változik."*

## 5. Frontend

### 5.1 Modulok

- `packages/frontend/src/api/scoring.ts` — fetch wrapper a `/api/scoring/explainer`-hez
- `packages/frontend/src/stores/scoring-explainer.store.ts` — Pinia: `isOpen`, `data`, `loading`, `error`, `lastSource`, `open(source)`, `close()`
- `packages/frontend/src/components/ScoringExplainerModal.vue` — a tényleges modal
- `packages/frontend/src/components/ScoringExplainerTrigger.vue` — kis ikon/link komponens, props: `source`, `variant: 'icon' | 'link'`

### 5.2 Adatfolyam

- **Lazy load:** a fetch csak az első nyitáskor fut le, az adat session végéig a store-ban marad
- **Diff számítás (frontend):** a default és group config között az alábbi 6 mezőt hasonlítja össze: `exactScore`, `correctWinnerAndDiff`, `correctWinner`, `correctDraw`, `correctOutcome`, `incorrect`. Ha a schema bővül, a spec és a diff field set bővül.
- **Hibakezelés:** ha a fetch elhasal, a modal mutat egy "Nem sikerült betölteni a szabályokat" üzenetet + retry gombot. **A 6 alapszabály statikus copy-ja attól függetlenül megjelenik** — a felhasználó mindig lát szabályokat, soha nem üres a modal.

### 5.3 Lokalizáció (i18n)

A projekt már használ `vue-i18n`-t (`packages/frontend/src/i18n/index.ts`, `hu`/`en` locale).

- A modal minden user-facing stringje a `hu.json` / `en.json` fájlokba kerül, namespace: `scoringExplainer.*`
- Trigger ikonok/linkek `aria-label`-je is i18n-en
- A 3.2 táblázat példáinak **kísérőszövege** fordítva ("Te:", "Eredmény:") — a gólszámok nyilván nem
- A backend nyers adatokat ad (számok, enum-szerű kulcsok), a UI fordít
- `specialPredictionTypes.name` és `description` (DB-ben tárolt user content) most **nem** fordítva — külön story

## 6. Tesztelés

### 6.1 Backend (Vitest)

`scoring-explainer.service.test.ts`:
- vendég → csak `default` + `globalSpecialTypes`, `groups: []`
- 1-csoport user → 1 elemű `groups`, helyes `config`, `frozenAt`, `favoriteTeamDoublePoints`
- 2+ csoport eltérő configgal → mindegyik a saját configjával
- special tippek: csoport-saját + feliratkozott globális összeadva, helyes `source` címkével
- `frozenAt` érték helyesen propagálódik (default + group szinten)
- soft-delete-tett csoportok kihagyva

`optionalAuth.middleware.test.ts`:
- nincs token → `ctx.state.user` undefined, 200
- valid token → user beállítva, 200
- invalid/expired token → user undefined, 200 (nem 401)

Route-szintű integráció: `GET /api/scoring/explainer` 200, helyes shape, mindkét üzemmódban.

### 6.2 Frontend (Vitest)

- `scoring-explainer.store.test.ts`: `open()` lazy fetch, `close()`, retry hibára, második nyitás cache-ből
- `ScoringExplainerModal.test.ts`: 0/1/2+ csoport mód helyes renderelése, "Eltérés" badge, frozen lakat, fallback render fetch hiba esetén, focus trap + ESC, i18n key-ek léteznek `hu` és `en` alatt

### 6.3 E2E (Playwright)

- Bejelentkezett user a ranglistáról nyitja a modalt → látja a saját csoportja szabályait → bezárja
- Vendég, főmenüből nyitja → csak default szabályok látszanak

## 7. Telemetria

Esemény-szintű analytics:
- `scoring_explainer_opened` — props: `source` (`menu` | `leaderboard` | `group` | `match-tip` | `special-tip`), `groupCount` (0 | 1 | 2+), `userId` ha bejelentkezett
- `scoring_explainer_closed` — props: `durationMs`

Nem mérünk most: scrolldepth, szekciónkénti idő, A/B variánsokat.

## 8. Most NEM csináljuk (YAGNI)

- Dedikált `/scoring` SEO-oldal
- Inline lehajtható verzió
- DB-ben tárolt special prediction type nevek/leírások fordítása (külön story)
- Scrolldepth / szekciós analytics + A/B tesztek
- Vizuális magyarázók (animált példák, ikonok minden sorhoz)
- Csoportonkénti összehasonlító mátrix (2+ csoportnál csak diff badge)
- PDF export / nyomtatás-barát nézet
- Push értesítés a szabályzat változásakor

## 9. Érintett fájlok (összegzés)

**Backend (új):**
- `packages/backend/src/middleware/optionalAuth.middleware.ts` (+ test)
- `packages/backend/src/services/scoring-explainer.service.ts` (+ test)
- `packages/backend/src/routes/scoring.routes.ts` (+ integration test)

**Backend (módosított):** route registry (a `scoring.routes.ts` bekötése).

**Frontend (új):**
- `packages/frontend/src/api/scoring.ts`
- `packages/frontend/src/stores/scoring-explainer.store.ts` (+ test)
- `packages/frontend/src/components/ScoringExplainerModal.vue` (+ test)
- `packages/frontend/src/components/ScoringExplainerTrigger.vue`

**Frontend (módosított):**
- főmenü navigáció (a "Pontozás" menüpont hozzáadása)
- ranglista view (link)
- csoport view (ikon)
- match tip view (ikon)
- special tip view (ikon)
- `packages/frontend/src/locales/hu.json` és `en.json` (új `scoringExplainer.*` namespace)

**E2E (új):**
- `e2e/scoring-explainer.spec.ts` (2 happy path)
