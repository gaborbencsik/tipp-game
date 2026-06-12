# US-934 — Komplex inputType-ok aggregált megjelenítése

> Forrás: US-934 story — "Mások tippjeinek megjelenítése határidő után – aggregált bontás típusonként" — komplex inputType scope.
> Dátum: 2026-06-10.
> Hatókör: 4 komplex inputType vizuális megjelenítése a `GroupDetailView` "Torna tippek" tabján, határidő után. Az egyszerű típusok meglévő chip-mintáját kiegészíti.

---

## 1. Tervezési alapelvek

A meglévő egyszerű típus minta (`text`, `dropdown`, `team_select`, `player_select`, `number`) **inline distinction** logikájára építünk:

- **Saját pick:** `ring-2 ring-blue-300 bg-blue-50`, szöveg `text-blue-700 font-medium`, count `text-blue-400`.
- **Csoport pick:** `bg-gray-100`, szöveg `text-gray-700 font-medium`, count `text-gray-400`.
- **Header:** `text-xs text-gray-400 mb-2` — `"N tipp a csoportból"`.
- **Rendezés:** count desc — konszenzus felül.
- **Empty:** `totalResponses === 0` → szekció rejtve.
- **Saját tipp érzelmi pozíció:** a user a csoportban fedezi fel magát; "distinction without division".

A komplex típusok ezt az ipart **örökölik**, csak a tartalmat strukturálják sűrűbben.

### Univerzális építőelemek

```html
<!-- TeamChip — minden komplex típus alapja. teamLogoUrl + name + count -->
<span
  class="inline-flex items-center gap-1.5 rounded-full bg-gray-100 px-2 py-1 text-xs"
  :class="{ 'ring-2 ring-blue-300 bg-blue-50': isMine }"
>
  <img :src="teamLogoUrl" alt="" class="h-4 w-4 rounded-sm object-contain" />
  <span :class="isMine ? 'text-blue-700 font-medium' : 'text-gray-700 font-medium'">
    {{ teamName }}
  </span>
  <span :class="isMine ? 'text-blue-400' : 'text-gray-400'">({{ count }})</span>
</span>
```

- Logo: **16px** (h-4 w-4) — chip-magassággal arányos, mobilon nem dominál.
- Logo `object-contain` + `rounded-sm` — átlátszó PNG-ket nem vág le.
- Lokális fallback `:src="teamLogoUrl ?? '/assets/team-fallback.svg'"` — backend `null`-t adhat törölt csapatra.
- Súlyozott típus pontérték (Upset Special) → külön `<PointBadge />` (ld. 2.1).

### Sűrűségi sáv (vizuális hierarchia)

| Típus | Sűrűség | UI minta |
|-------|---------|----------|
| Egyszerű (`text`, `team_select`, …) | 1 sor chipek | meglévő |
| `multi_team_weighted` (US-936) | 1 chip-grid + pontbadge | flat list, jobb felső sarok pontérték |
| `multi_team_select` (US-937) | 1 chip-grid (max N=12+) | flat list, "top 8 + N egyéb" összecsukás |
| `all_groups_standing` (US-945) | 12 csoport × 4 hely + 4 best 3rd | 1-soros mini-blokkok, accordion |
| `bracket_progression` (US-946) | 6 kör × halmaz | tabos kör-választás, csak "továbbjutott" halmaz |

---

## 2. Inputtype-onkénti dizájn

### 2.1 `multi_team_weighted` — Upset Special (US-936)

**Tipp**: legfeljebb 2 csapat (halmaz), csapatonként súlyozott pontérték a típus `options.choices`-ban (2–18p).

**Aggregálás**: csapatonként hány felhasználó pickelte (a halmaz tagjaként). Egy felhasználó kétszer is jelenhet (két csapat = két chip). Header továbbra is `totalResponses` = unique tippelő.

**Vizualizáció**: chip-grid, pontbadge a logo előtt, count utána. `flex flex-wrap gap-2`.

```text
12 tipp a csoportból

[18p 🇪🇸 Spain   (7)]   [18p 🇫🇷 France  (5)]   ← saját chip kék ring-gel
[12p 🇧🇷 Brazil  (4)]   [10p 🇩🇪 Germany (3)]
[6p  🇧🇪 Belgium (2)]   [4p  🇭🇷 Croatia (1)]
```

**Pontbadge**:
```html
<span class="inline-flex h-4 items-center rounded bg-amber-100 px-1 text-[10px] font-bold text-amber-800 tabular-nums">
  18p
</span>
```
- Amber, **nem** kék — különbözik a "saját pick" kék jelzéstől, így a kettő egyértelműen olvasható egymás mellett.
- Tabular-nums: 4p / 18p egyforma szélességű.

**Interakció**: tap-pelve a chip-en a csapat US-936 picker-modallal nyílik meg (ugyanaz, mint amikor a user maga állítja be) read-only állapotban — opcionális, későbbi enhancement.

---

### 2.2 `multi_team_select` — Progresszió (US-937)

**Tipp**: max N csapat halmaz (Last 16 → 16, QF → 8, …). Pontozás: `points_per_correct × |prediction ∩ result|`.

**Aggregálás**: csapatonként hány felhasználó tette be a halmazba.

**Vizualizáció**: ugyanaz a chip-grid mint Upset, **pontbadge nélkül**. Mert a max N-érték 16 is lehet, kell egy **összecsukási küszöb**:

- Top 8 csapat default-ban látszik.
- Ha több unique csapat van: szürke `+ N további` link gomb → expand all.

```text
14 tipp a csoportból

[🇫🇷 France (12)]  [🇪🇸 Spain (11)]  [🇧🇷 Brazil (10)]  [🇩🇪 Germany (9)]
[🇦🇷 Argentina (8)] [🇳🇱 Netherlands (7)] [🇵🇹 Portugal (6)] [🇧🇪 Belgium (5)]

+ 6 további csapat ▾    ← összecsukva
```

A küszöb: ha unique csapatok > 8, akkor csak top 8 + "+ N további csapat ▾". Tap-on `flex flex-wrap gap-2` bővül.

**Mobil**: 2-3 chip per sor max. `gap-1.5` mobile, `gap-2` md+.

---

### 2.3 `all_groups_standing` — Csoport végeredmény (US-945)

**Tipp**: 12 csoport (A–L), csoportonként 4 hely (1.→4.) sorrendben + 4 db best 3rd csapat.

**Aggregálás**: csoportonként, pozíciónként top csapatok count-tal. Best 3rd külön halmazaggregáció.

**Vizualizáció (DÖNTÉS):** **default collapsed accordion**, két fő blokkal — fent **Best 3rd** (kompakt chip-lista), alatta **12 csoport** mini-blokkokként.

#### 2.3.1 Best 3rd blokk (mindig nyitva)

A leggyakoribb decision-point — a user kíváncsi rá, hogy a csoport kiket vár 3rd-ként továbbjutónak.

```text
─── Továbbjutó 3. helyezettek ─────────────────────
[🇨🇿 Czechia (8)]  [🇧🇦 Bosnia (6)]  [🇨🇮 Côte d'Ivoire (5)]
[🇯🇵 Japan (4)]    [🇲🇽 Mexico (3)]   [🇰🇷 Korea (2)]
```

Ugyanaz a chip-grid mint a 2.2.

#### 2.3.2 Csoport sorrendek (default collapsed)

12 csoport: A B C D E F G H I J K L. **Default-ban** mindegyik 1-soros összegző preview-t mutat — a 4 helyezésen a **legnépszerűbb** csapat:

```text
─── Csoport sorrend (12 csoport) ─────────────────
A  ▸  1.🇲🇽  2.🇰🇷  3.🇨🇿  4.🇿🇦      [N=10 tipp]
B  ▸  1.🇨🇦  2.🇨🇭  3.🇧🇦  4.🇪🇨      [N=9  tipp]
C  ▸  1.🇪🇸  2.🇳🇬  3.🇨🇮  4.🇸🇦      [N=10 tipp]
…
```

- Egy soros, csak logo + helyszám. Tap-on expand.
- Right-aligned `[N=10 tipp]` jelzi mennyien tippeltek arra a csoportra (egyes csoportok lehetnek üresek a részleges tipp miatt).
- Saját pick visual cue: ha mind a 4 helyezésen saját top pick-em egyezik a többségével → a sor `bg-blue-50` (egyszerűsítés).

**Expanded állapot** (tap-pal kibontva):

```text
A ▾  N=10 tipp
   1. helyezett:  [🇲🇽 Mexico (8)]   [🇰🇷 Korea (2)]
   2. helyezett:  [🇰🇷 Korea (5)]    [🇲🇽 Mexico (3)]   [🇨🇿 Czechia (2)]
   3. helyezett:  [🇨🇿 Czechia (6)]  [🇿🇦 South Africa (3)]  [🇰🇷 Korea (1)]
   4. helyezett:  [🇿🇦 South Africa (7)]  [🇨🇿 Czechia (3)]
```

Soronként a saját tipp inline kék ring-gel (ha eltér a többségtől, ez a fő insight forrása).

**Sticky helyzeti label**: `1. h.` `2. h.` `3. h.` `4. h.` `text-xs text-gray-400 font-mono w-12 shrink-0` — fix oszlopszélesség.

#### 2.3.3 Tailwind szerkezet

```html
<section class="space-y-4">
  <!-- Best 3rd -->
  <div>
    <h4 class="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-gray-500">
      <Trophy class="h-3.5 w-3.5 text-amber-500" /> Továbbjutó 3. helyezettek
    </h4>
    <p class="mb-2 text-xs text-gray-400">{{ totalResponses }} tipp a csoportból</p>
    <div class="flex flex-wrap gap-1.5"><TeamChip v-for="..."/></div>
  </div>

  <!-- 12 csoport accordion -->
  <div>
    <h4 class="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-500">Csoport sorrend (12 csoport)</h4>
    <div class="divide-y divide-gray-100 rounded-lg border border-gray-200">
      <details v-for="g in groups" :key="g.key" class="group">
        <summary class="flex cursor-pointer items-center gap-2 px-3 py-2 hover:bg-gray-50">
          <span class="w-4 font-mono text-sm font-bold text-gray-500">{{ g.key }}</span>
          <ChevronRight class="h-3.5 w-3.5 text-gray-400 transition group-open:rotate-90" />
          <!-- 4 mini logo preview -->
          <div class="flex items-center gap-2 text-xs text-gray-500">
            <span v-for="(p, i) in g.previewTop4" class="inline-flex items-center gap-1">
              <span class="text-gray-400">{{ i+1 }}.</span>
              <img :src="p.logoUrl" class="h-3.5 w-3.5"/>
            </span>
          </div>
          <span class="ml-auto text-[10px] text-gray-400 tabular-nums">N={{ g.totalResponses }}</span>
        </summary>
        <div class="space-y-2 px-3 pb-3 pt-1">
          <div v-for="pos in [1,2,3,4]" class="flex items-start gap-2">
            <span class="mt-1 w-12 shrink-0 font-mono text-xs text-gray-400">{{ pos }}. h.</span>
            <div class="flex flex-wrap gap-1.5">
              <TeamChip v-for="t in g.positions[pos-1].top" v-bind="t"/>
            </div>
          </div>
        </div>
      </details>
    </div>
  </div>
</section>
```

A `<details>` natív HTML accordion — accessible, JS nélkül működik, animatable.

---

### 2.4 `bracket_progression` — Bracket pár-pick (US-946)

**Tipp**: 31 mérkőzés (Last 32: 16 + Last 16: 8 + QF: 4 + SF: 2 + döntő: 1 + bronz: 1 = 32 — bronz külön), körönként győztes-pick.

**Aggregálás döntés (DÖNTÉS):** **kör-szintű "továbbjutott halmaz"**, mérkőzés-szintű NEM. Mert a user saját bracket-jét a saját US-945 csoport-tippje inicializálja, így 2 felhasználó **különböző párokkal** indulhat — egy "12-13 vs Brazília" mérkőzés-szintű aggregálás csak a SF-től kezdene konvergálni. A kör-szintű "ki ér el legalább a Last 16-ig?" / "QF-ig?" / "SF-ig?" mindig értelmes, mert a halmaz aggregál.

**Vizualizáció**: kör-szegmens (segmented control), alatta a továbbjutott csapatok chip-grid-je (mint 2.2).

```text
[Last 32] [Last 16] [QF] [SF] [Döntő] [Bronz]
─────────────────────────────────────────────
14 tipp a csoportból — továbbjutottak a Last 16-ba

[🇫🇷 France (13)]  [🇪🇸 Spain (12)]  [🇧🇷 Brazil (11)] …

Megjegyzés: minden tippelő a saját Csoport végeredmény tippje
alapján indul; a Last 32 párosítások felhasználónként eltérnek.
```

**Segmented control** (Tailwind):
```html
<div role="tablist" class="flex gap-1 rounded-full bg-gray-100 p-1 text-xs overflow-x-auto">
  <button v-for="r in rounds" :key="r.key"
    :aria-selected="active === r.key"
    @click="active = r.key"
    class="rounded-full px-3 py-1.5 font-medium whitespace-nowrap transition"
    :class="active === r.key ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'">
    {{ r.label }}
  </button>
</div>
```

- Mobilon vízszintesen scrollozható (`overflow-x-auto`), nem törik 2 sorba.
- "Bronz" külön tab, mert eltérő logika (vesztesek mérkőzése).
- Default tab: **Last 16** (legtöbb megosztó döntés van benne).

**Saját pick highlight a bracket-en**: a saját körönként továbbjutott csapataim chipje kék ring-gel. Ha a saját US-934 tippet a user nem töltötte ki erre a típusra → fejléc alatt finom prompt: `"Te nem tippeltél bracket-et — csak a csoport vélemény látszik."`

**Top 8 + N összecsukás** itt is: pl. Last 32-ben akár 24+ unique csapat is továbbjuthat.

---

## 3. Sub-komponens fa

```
SpecialPredictionsTab.vue                  ← extractálva GroupDetailView-ból (12. AC)
├─ SpecialCard.vue                         ← 1 darab típus kártya (header, deadline, saját tipp, pontok)
│  └─ SpecialSummary.vue                   ← dispatch by inputType
│     ├─ SpecialSummarySimple.vue          ← meglévő AC (chip lista)
│     ├─ SpecialSummaryMultiTeam.vue       ← 2.1 + 2.2
│     ├─ SpecialSummaryGroupStanding.vue   ← 2.3 (Best3rd + 12 collapsible)
│     └─ SpecialSummaryBracket.vue         ← 2.4 (segmented + chip grid)
└─ TeamChip.vue                            ← univerzális, isMine prop
```

`SpecialSummary.vue` props:
```ts
defineProps<{
  inputType: SpecialPredictionInputType
  breakdown: SpecialPredictionSummaryBreakdown   // discriminated union
  totalResponses: number
  myAnswer: SpecialPredictionAnswer | null       // a saját tipp, hogy isMine-t számolhassuk
}>()
```

`isMine` számolása sub-komponensenként:

| Típus | `isMine` predikátum (per chip) |
|-------|---------------------------------|
| `multi_team_weighted` | `myAnswer.teams.includes(chip.teamId)` |
| `multi_team_select` | `myAnswer.teams.includes(chip.teamId)` |
| `all_groups_standing` (pozíció) | `myAnswer.groups[g.key][pos-1] === chip.teamId` |
| `all_groups_standing` (best3rd) | `myAnswer.best3rds.includes(chip.teamId)` |
| `bracket_progression` | `myWinningTeams[round].has(chip.teamId)` (a user round-szintű halmaza) |

A backend `myAnswer`-t a meglévő `getMyPredictions` útján szolgáltatja, frontend store-ban már elérhető — **nincs új endpoint** csak a saját tippért.

---

## 4. Nyitott UX kérdések — DÖNTÉSEK

| # | Kérdés | Döntés |
|---|--------|--------|
| Q1 | `all_groups_standing` default collapsed vs heatmap? | **Default collapsed accordion** (Best 3rd nyitva, 12 csoport zárva). Egyszerűbb, scannelhető, Best 3rd a legfontosabb decision-point. Heatmap mobilon olvashatatlan lenne. |
| Q2 | `bracket_progression` tabok vs lista? | **Segmented control kör-tabokkal** (Last 32 / Last 16 / QF / SF / Döntő / Bronz). Default tab: **Last 16**. Mobilon `overflow-x-auto`. |
| Q3 | Multi-team típusoknál pontérték a chipen? | **Igen, csak `multi_team_weighted`-nél** (Upset Special). Külön `<PointBadge />` amber színű, `18p` formátum, logo előtt. `multi_team_select`-nél NEM (mert ott a pont fix per-correct, nem csapatfüggő). |
| Q4 | Csapat logo méret? | **16px** (h-4 w-4) chipben, 14px (h-3.5 w-3.5) accordion-preview-ben. `object-contain rounded-sm`. |
| Q5 | Saját tipp inline highlight komplex típusokon? | **Egységes `ring-2 ring-blue-300 bg-blue-50`** mindenhol (chip, accordion sor, bracket csapat). A `isMine` predikátum sub-komponensenként eltér (ld. 3. szakasz). Külön "Te:" panel **nincs**. |
| Q6 | `multi_team_select` (max N nagyobb halmaz) megjelenítése? | **Top 8 + "+ N további csapat ▾"** összecsukás. Tap-on flex bővül. |
| Q7 | `bracket_progression` mérkőzés-szintű aggregálás? | **NEM.** Felhasználónkénti slot-eltérés miatt értelmetlen <SF-ben. **Csak kör-szintű halmaz aggregálás.** |
| Q8 | Üres állapot pl. egy csoport `all_groups_standing`-ban (senki nem tippelt rá)? | A csoport sor `text-gray-400`, `[N=0 tipp]` jelzéssel. Tap-on üzenet: `"Erre a csoportra még senki sem tippelt."` (a backend ezt a csoportot kihagyhatja vagy üres `positions[]`-szel adhatja vissza). |
| Q9 | Saját tipp highlight `bracket_progression`-ben, ahol top 8-ban lehet bárhol? | A user saját `winners[round]` halmazát chiponként ellenőrizzük (`Set` lookup), nem pozíció-alapon. Ha a saját pick a top 8-on kívül van, akkor expand-pel kattint és ott látja. |
| Q10 | Render perf — 12 csoport × 4 pozíció × N csapat? | A `<details>` lazy nem renderel zárt állapotban semmit (Vue `<details>`-en is működik). Defaultban csak Best 3rd + 12 preview-sor render. Nem szükséges virtualization. |

---

## 5. Tipográfia és spacing

- **Header (típusonként):** meglévő `SpecialCard` cím (változatlan).
- **Sub-header (block-szint):** `text-xs font-semibold uppercase tracking-wide text-gray-500` — pl. "Továbbjutó 3. helyezettek".
- **"N tipp a csoportból":** `text-xs text-gray-400 mb-2`.
- **Pozíciójelölő (1. h., 2. h.):** `font-mono text-xs text-gray-400 w-12 shrink-0`.
- **Chip (alap):** `text-xs px-2 py-1 rounded-full`.
- **Chip count (parenthesis):** `tabular-nums` — sose ugráljon a hely.
- **Gap chipek között:** `gap-1.5` (mobile), `gap-2` (md+).
- **Section között:** `space-y-4`.
- **Border accordion:** `divide-y divide-gray-100` belül, `border border-gray-200 rounded-lg` keret.

A meglévő app **Inter / system-ui** alapot használ — ez a spec azt megtartja, mert a refinement a sűrűségben és a chip-stílusban van, nem egyedi font-ban. Nem vezetünk be új font-ot ezért a story-ért.

---

## 6. Mobil-first ellenőrzések

| Méret | Teszt |
|-------|-------|
| 360px (iPhone SE) | Bracket tabok scrollozhatók, csapat-chipek 1-2 / sor, accordion szöveg nem törik furán |
| 414px (iPhone 14) | Top 8 chip 2 sorban, "+ N" link látszik |
| Tablet 768px | `gap-2`, csoport-accordion sor 1-soros, preview 4 logo elfér |

Ahol a `<details>` tap-zónája < 44px lenne, `py-2.5` használandó. Tap-zóna **44×44px** minimum az accessibility-vel.

---

## 7. Empty / error / loading állapotok

- **Loading**: skeleton `h-8 w-full rounded-full bg-gray-100 animate-pulse` × 4 a chip-grid helyén.
- **Error (endpoint failed)**: az aggregált bontás csendesen kimarad (story 17. AC) — nincs hibapanel.
- **Üres aggregálás (`totalResponses === 0`)**: szekció nem jelenik meg.
- **Részleges tipp** (`all_groups_standing`-ben pl. csak A-F csoport): a hiányzó csoportok sor `text-gray-400`, `N=0 tipp`.
- **Bracket részleges**: az adott körre `breakdown.rounds` megfelelő `advancing: []`, megjelenik: `"Erre a körre még senki sem tippelt."`.

---

## 8. Implementációs hatás (becslés)

| Komponens | Kb. LoC | Új teszt |
|-----------|---------|----------|
| `TeamChip.vue` | ~30 | + 2 unit |
| `SpecialSummary.vue` (dispatch) | ~25 | + 1 |
| `SpecialSummarySimple.vue` (meglévő AC kiemelve) | ~50 | meglévő |
| `SpecialSummaryMultiTeam.vue` | ~70 | + 3 |
| `SpecialSummaryGroupStanding.vue` | ~150 | + 4 |
| `SpecialSummaryBracket.vue` | ~120 | + 3 |
| Backend aggregátor + endpoint | meglévő story 18-22. AC | + 9 |

Effort frissítés: **M → L** (~6–10 óra), mert a komplex típusok 4 új sub-komponenst és aggregátort hoznak.

---

## 9. Mit nem csinálunk (out of scope)

- **Mérkőzés-szintű bracket aggregálás** — különálló kérdés, későbbi story (US-934-utódban).
- **Heatmap / chart vizualizáció** a csoport-sorrendekhez — text-based marad, mobilon olvashatóbb.
- **Real-time SSE frissítés** — eredeti story scope-ban már kizárva.
- **Százalékos megjelenítés** — count-only.
- **Felhasználónév-szintű bontás** — GDPR/fair play (eredeti story).
- **Animáció/scroll-trigger** — natív `<details>` open/close + Tailwind `transition` a chevron-on; nem viszünk be Motion lib-et erre.

---

## 10. Hivatkozások

- Story: `plans/stories/US-934.md` (v2 — 2026-06-10 frissítés)
- Egyszerű típus baseline: `MatchPredictionsList.vue` chip mintája
- Komplex típusok adatmodellje:
  - `multi_team_weighted` — `plans/stories/archive/US-936.md`
  - `multi_team_select` — `plans/stories/archive/US-937.md`
  - `all_groups_standing` — `plans/stories/archive/US-945.md`
  - `bracket_progression` — `plans/stories/archive/US-946.md`
- Tervezési skill output: ez a fájl.
