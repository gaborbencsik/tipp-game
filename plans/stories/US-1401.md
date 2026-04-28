# US-1401: Stadion banner kep a meccs reszletes nezeten

> Datum: 2026-04-22
> Agentek: UX Design Expert + Story Writer
> Fajl: `plans/09-stadium-banner-story.md`

---

## User Story

**Mint** bejelentkezett felhasznalo,
**szeretnek** a meccs reszletes nezeten (`/app/matches/:id`) **egy banner kepet latni a stadionrol**, ahol a merkozest jatsszak, rajta a helyszin nevevel (stadion + varos),
**hogy** vizualisan is aterezzhessem a merkozesek hangulatat, es azonnal lassam hol jatszak a meccset.

---

## Story ID

**US-1401**

---

## Kontextus

A `MatchDetailView.vue` jelenleg mutatja a stadion nevet es varost szoveges formaban (59-61. sor), de vizualis elem nincs. A VB 2026 16 stadionban zajlik (USA, Kanada, Mexiko) -- fix szamu helyszin, amelyekhez statikus vagy URL-alapu kepek rendelhetok.

**Jelenlegi allapot:**
- A `venues` tabla tartalmaz 6 stadion (seed adat), de nincs `imageUrl` mezo
- A `MatchVenue` frontend type: `{ name: string, city: string }` -- nincs kep mezo
- A `MatchDetailView.vue` a venue-t szoveges formaban jelenitik meg a meccs kartya aljaban

---

## Elfogadasi kriteriumok

### 1. Adatbazis migracio

- [ ] A `venues` tablara uj mezo: `image_url TEXT` (nullable)
- [ ] Drizzle schema frissitese: `imageUrl: text('image_url')` a `venues` tablaban
- [ ] Drizzle migracio generalva es elnevezve (pl. `0006_venue_image_url.sql`)
- [ ] Seed script frissitese: a meglevo 6 helyszinhez `imageUrl` ertekek beallitasa (VB 2026 stadionok kepeivel)
- [ ] Ujabb VB 2026 helyszinek hozzaadasa a seed-hez (osszesen 16 stadion)

### 2. Backend

- [ ] Backend `Venue` / `MatchVenue` tipus frissitese: `imageUrl: string | null` mezo hozzaadasa
- [ ] `GET /api/matches` es `GET /api/matches/:id` valasz tartalmazza a `venue.imageUrl` mezot
- [ ] A `matches.service.ts` lekerdezese tartalmazza az `imageUrl` mezot a venue join-bol

### 3. Frontend — tipus es API

- [ ] `MatchVenue` interface bovitese: `readonly imageUrl: string | null`
- [ ] Nincs uj API endpoint — a meglevo match response-bol jon az adat

### 4. Frontend — banner megjelenes (`MatchDetailView.vue`)

- [ ] A meccs adatai folott (a `<- Vissza` link alatt, a stage label felett) megjelenik egy **stadion banner kep**
- [ ] A banner a teljes szelesseget kitolti a content arean belul
- [ ] A banner magassaga fix: **mobilon 160px**, **tableten 200px**, **desktoppon 240px**
- [ ] A kep `object-fit: cover` + `object-position: center` beallitassal jelenik meg
- [ ] A banner also reszen **sotetitoett gradient overlay** van (atlatszotol fekete fele, ~50% opacity)
- [ ] A gradiensre ra van irva a **stadion neve** (feher, felkover, nagyobb) es alatta a **varos + orszag** (feher, kisebb, halvanyabb)
- [ ] A szoveg a banner bal also sarkaban van pozicionalva (padding: 16-24px)
- [ ] A banner sarkait `rounded-lg` lekerekites adja (konzisztens a kartya stilussal)
- [ ] Ha a `venue` `null` (nincs helyszin rendelve a meccshez): a banner **nem jelenik meg**, a layout valtozatlan marad
- [ ] Ha a `venue.imageUrl` `null` (van helyszin, de nincs kep): **fallback szines hatter** jelenik meg (sotet gradient, pl. `from-slate-700 to-slate-900`) a stadion nevevel es varossal — ugyanolyan overlay stilusban

### 5. Responsive viselkedes

- [ ] **Mobil** (< 640px): banner magassag 160px, szoveg 14px/12px meret, padding 12px
- [ ] **Tablet** (640px-1024px): banner magassag 200px, szoveg 16px/14px, padding 16px
- [ ] **Desktop** (> 1024px): banner magassag 240px, szoveg 18px/14px, padding 24px
- [ ] A banner vizszintesen a content area szelessegere igazodik (nem tor ki a layout-bol)

### 6. Accessibility

- [ ] A `<img>` elem tartalmaz `alt` attributumot: `"{stadion neve}, {varos}"` formaval
- [ ] A gradient overlay szoveg kontrasztja megfelel WCAG AA szintnek (feher szoveg sotet hatteron)
- [ ] A banner diszelem — `role="img"` es `aria-label` a teljes helyszin leirassal
- [ ] Ha a kep nem toltodik be (torott URL), a fallback szines hatter jelenik meg (same as `imageUrl === null` eset)

### 7. Teljesitmeny

- [ ] A kepek `loading="lazy"` attributummal toltodnek
- [ ] A banner kontener fix magassaggal rendelkezik (nincs CLS — Cumulative Layout Shift)
- [ ] Ajanlott kep meret: 1200x400px vagy hasonlo 3:1 arany (az `object-fit: cover` kezeli az eltereseket)

### 8. Tesztek

- [ ] **Backend unit teszt:** `getMatches()` es `getMatchById()` valasz tartalmazza a `venue.imageUrl` mezot
- [ ] **Frontend unit teszt:** banner megjelenik ha `venue` es `imageUrl` letezik
- [ ] **Frontend unit teszt:** banner NEM jelenik meg ha `venue === null`
- [ ] **Frontend unit teszt:** fallback hatter jelenik meg ha `venue` letezik de `imageUrl === null`
- [ ] **Frontend unit teszt:** torott kep eseten fallback hatter jelenik meg (`onerror` handler)
- [ ] **Frontend unit teszt:** stadion neve es varos szoveg megjelenik a banner-en
- [ ] Typecheck CLEAN mindket package-ben

---

## UX Design iranymutatas

### Vizualis koncept

A banner egy **hero kep** elem, ami a meccs reszletes nezetenek tetejere kerul — a sportos, stadion-hangulatu vizualis elmenyt adja a felhasznalonak. A kep maga a stadion kulso vagy belso fotoja, rajta egy enyhe sotetites es a helyszin neve.

```
+----------------------------------------------------------+
|                                                          |
|              [stadion foto, object-fit: cover]            |
|                                                          |
|  ░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░  |  <- gradient overlay
|  MetLife Stadium                                         |  <- feher, font-semibold, text-lg
|  East Rutherford, USA                                    |  <- feher/70%, text-sm
+----------------------------------------------------------+
```

### Gradient overlay specifikacio

```css
/* Tailwind v4 osztalyok */
bg-gradient-to-t from-black/60 via-black/20 to-transparent
```

A gradient az also 40%-ot fedi le, biztositva a szoveg olvashatolsagat anelkul, hogy a kep nagy reszet eltakarjuk.

### Szoveg pozicionalas

- **Bal also sarok** (`absolute bottom-0 left-0`)
- Padding: `p-3 sm:p-4 lg:p-6`
- Stadion neve: `text-white font-semibold text-sm sm:text-base lg:text-lg`
- Varos + orszag: `text-white/70 text-xs sm:text-sm`
- Kozott: `gap-0.5` (minimal terkoz)

### Fallback (nincs kep)

Ha `imageUrl === null`, a banner hatter egy **szines gradient**:

```
bg-gradient-to-br from-slate-700 via-slate-800 to-slate-900
```

Ez biztositja, hogy a helyszin neve es varosa akkor is szepen megjelenik, ha nincs eppen kep hozzarendelve. A felhasznalo szempontjabol konzisztens az elmeny.

### Torott kep kezelese

Ha a kep URL letezik de a kep nem toltodik be (`onerror` event), a komponens automatikusan fallback modba valt:
- Az `<img>` `display: none` lesz
- A hatter gradient megjelenik

Implementacios javaslat:
```vue
<script setup>
const imageError = ref(false)
function onImageError(): void {
  imageError.value = true
}
</script>
```

### Animacio (opcio)

- A banner bejovetelkor enyhe **fade-in** effektus (`transition-opacity duration-300`) a kep betoltesekor
- A szoveg nem animalt — azonnal lathato (CLS elkerulese)

### Kep forrasok

A VB 2026 16 stadinojahoz jogmentes stadion kepek szuksegesek. Forrasok:

1. **Unsplash** (unsplash.com) — "stadium" kereses, license: ingyenes, attribution nem kotelezo
2. **Pexels** (pexels.com) — hasonlo, ingyenes license
3. **Wikimedia Commons** — stadion-specifikus fotok, CC-BY vagy Public Domain

Ajanlott merete: **1200x400px** (3:1 arany, optimalizalt websre). A kepek lehetnek:
- Statikus fajlok a repository-ban (`/public/venues/metlife.jpg`)
- Vagy kulso URL-ek a `venues.imageUrl` mezoben (pl. Unsplash CDN linkek)

**Javaslat:** Kulso URL-ek hasznalata a `imageUrl` mezoben — igy nem noveli a repo meretet, es a kepek egyszeruen cserelhetok az adatbazisban.

---

## Technikai megjegyzesek

### DB valtozas

```typescript
// packages/backend/src/db/schema/index.ts — venues tabla bovites
export const venues = pgTable('venues', {
  id:        uuid('id').primaryKey().defaultRandom(),
  name:      varchar('name', { length: 150 }).notNull(),
  city:      varchar('city', { length: 100 }).notNull(),
  country:   varchar('country', { length: 100 }).notNull(),
  capacity:  integer('capacity'),
  imageUrl:  text('image_url'),  // <-- UJ MEZO
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
})
```

### Frontend tipus valtozas

```typescript
// packages/frontend/src/types/index.ts
export interface MatchVenue {
  readonly name: string
  readonly city: string
  readonly imageUrl: string | null  // <-- UJ MEZO
}
```

### Erintett fajlok

| Reteg | Fajl | Valtozas |
|-------|------|---------|
| DB | `packages/backend/src/db/schema/index.ts` | `imageUrl` mezo hozzaadasa a `venues` tablahoz |
| DB | Uj migracio | `ALTER TABLE venues ADD COLUMN image_url TEXT` |
| DB | `packages/backend/scripts/seed.ts` | Helyszinek bovitese `imageUrl` ertekekkel (16 stadion) |
| Backend | `packages/backend/src/services/matches.service.ts` | `imageUrl` mezo lekerdezese a venue join-ban |
| Backend | `packages/backend/src/types/index.ts` | `MatchVenue` tipus bovitese |
| Frontend | `packages/frontend/src/types/index.ts` | `MatchVenue` interface bovitese |
| Frontend | `packages/frontend/src/views/MatchDetailView.vue` | Banner komponens hozzaadasa |
| Frontend | (opcionalis) `packages/frontend/src/components/VenueBanner.vue` | Kulon komponens a banner-hez (ujrafelhasznalhato) |

### Component kiszervezes javasalt

A banner logika kiszervezheto egy kulon `VenueBanner.vue` komponensbe:

```vue
<!-- VenueBanner.vue -->
<template>
  <div v-if="venue" class="relative w-full rounded-lg overflow-hidden h-40 sm:h-[200px] lg:h-60">
    <!-- Kep vagy fallback -->
    <img
      v-if="venue.imageUrl && !imageError"
      :src="venue.imageUrl"
      :alt="`${venue.name}, ${venue.city}`"
      class="absolute inset-0 w-full h-full object-cover"
      loading="lazy"
      @error="onImageError"
    />
    <div
      v-else
      class="absolute inset-0 bg-gradient-to-br from-slate-700 via-slate-800 to-slate-900"
    />
    <!-- Gradient overlay -->
    <div class="absolute inset-0 bg-gradient-to-t from-black/60 via-black/20 to-transparent" />
    <!-- Szoveg -->
    <div class="absolute bottom-0 left-0 p-3 sm:p-4 lg:p-6 flex flex-col gap-0.5">
      <span class="text-white font-semibold text-sm sm:text-base lg:text-lg">
        {{ venue.name }}
      </span>
      <span class="text-white/70 text-xs sm:text-sm">
        {{ venue.city }}, {{ venue.country }}
      </span>
    </div>
  </div>
</template>
```

**Megjegyzes:** A fenti kod illusztrativ — a vegleges implementaciot a `software-engineer` agent kesziti TDD-vel.

---

## VB 2026 helyszinek (16 stadion)

A seed script-nek az alabbi 16 helyszint kell tartalmaznia:

| Stadion | Varos | Orszag | Kapacitas |
|---------|-------|--------|-----------|
| MetLife Stadium | East Rutherford, NJ | USA | 82,500 |
| AT&T Stadium | Arlington, TX | USA | 80,000 |
| SoFi Stadium | Inglewood, CA | USA | 70,240 |
| Hard Rock Stadium | Miami Gardens, FL | USA | 64,767 |
| Lincoln Financial Field | Philadelphia, PA | USA | 69,176 |
| NRG Stadium | Houston, TX | USA | 72,220 |
| Lumen Field | Seattle, WA | USA | 68,740 |
| Levi's Stadium | Santa Clara, CA | USA | 68,500 |
| Mercedes-Benz Stadium | Atlanta, GA | USA | 71,000 |
| Arrowhead Stadium | Kansas City, MO | USA | 76,416 |
| Gillette Stadium | Foxborough, MA | USA | 65,878 |
| Estadio Azteca | Mexico City | Mexico | 87,523 |
| Estadio AKRON | Guadalajara | Mexico | 49,850 |
| Estadio BBVA | Monterrey | Mexico | 53,500 |
| BC Place | Vancouver | Canada | 54,500 |
| BMO Field | Toronto | Canada | 30,000 |

---

## Komplexitas

**S (Small)**

Indoklas:
- Egy uj nullable mezo a `venues` tablaban (trivialis migracio)
- A backend valtozas minimalis (meglevo query bovitese egy mezovel)
- A frontend egy uj vizualis elem (banner) hozzaadasa a meglevo nezethez
- Nincs uj endpoint, nincs uj route, nincs uj store
- A kepek kulso URL-kent tarolodnak — nincs fajlfeltoltes logika

---

## Prioritas

**Should Have**

Indoklas:
- Vizualis upgrade, nem blokkol semmilyen funkcionalitast
- Javitja a felhasznaloi elmenyt es a "premium" erzest
- A VB 2026 kornyezeteben relevansan hozzaad a hangulathoz
- A 16 stadion fix szamu — nem igenyel dinamikus kepfeltoltest

---

## Fuggosegek

- Nincs fuggoseg mas story-tol — onalloan implementalhato
- A `venues` tabla mar letezik a DB-ben
- A `venueId` FK mar letezik a `matches` tablan
- A `GET /api/matches` mar visszaadja a venue adatokat

---

## Megjegyzesek az implementalonak

1. **Migracio:** `npm run db:generate --workspace=packages/backend` utan ellenorizd, hogy a generallt SQL megfelel az elvartnak (`ALTER TABLE venues ADD COLUMN image_url TEXT`)
2. **Seed:** A 16 stadion kepeihez Unsplash CDN linkeket hasznalj (pl. `https://images.unsplash.com/photo-...?w=1200&h=400&fit=crop`). A kepek kikeresese a seed script irasanak resze.
3. **Teszt:** A `VenueBanner` komponenshez kulon teszt fajl (`VenueBanner.spec.ts`), ne a `MatchDetailView` tesztjebe keverve
4. **Tailwind v4:** A responsive osztalyok (`sm:`, `lg:`) a Tailwind v4-ben valtozatlanul mukodnek. A `h-40` = 160px, `h-[200px]` = 200px, `h-60` = 240px.
5. **Kep optimalizalas:** Ha a felhasznalok nagy resze mobilrol hasznalja az appot, erdemes a kep URL-be `w=800` parametert tenni az Unsplash CDN-en (kisebb fajlmeret).
