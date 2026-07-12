# UX-045 – Bracket-progresszió kiértékelt tipp nézet (UX terv)

> Kapcsolódó: UX-039 / UX-040 / UX-041 (per-csoport + Upset Special kiértékelt design nyelv),
> UX-044 (új `participants` shape `BracketProgressionCorrectAnswer`).
> **Ez a fájl NEM story** — csak UX / vizuális terv a story-writer számára.

---

## 1. UX diagnózis

### Mi történik most (post-eval, bracket_progression)

- A `TournamentTipsView` a kártya tetején megjeleníti a felhasználó **összpontszámát** (`sp.points`).
- Kiértékelés (`sp.points !== null`) után a bracket UI **eltűnik**: a `BracketProgressionPicker` read-only nézete nem renderelődik, csak egy szöveges összegzés marad ("Helyes válasz: …" vagy hasonló defenzív fallback).
- A felhasználó **nem látja a saját tippjét körönként**, **nem látja a bontást**, **nem tudja, mely csapatot találta el vagy hibázta el**.

### Miért rossz UX ez

1. **Bezárt visszacsatolási hurok.** A tippjáték core motivációja: "hogyan teljesítettem?" Ha csak egy szám marad ("kaptál 27 pontot"), a felhasználó nem érti a *miértet* — nincs tanulás, nincs sztori, nincs share-elhető pillanat.
2. **Aszimmetria a többi tipp-típussal.** UX-039/040/041 után a csoport-tipp és az Upset Special szépen vizualizálva mutatja a helyes/hibás pickeket. A bracket kártya viszont "üres marad" — a felhasználó azt hiheti, hogy az adat elveszett vagy hibás.
3. **Adatpazarlás.** A backend `scoreBracketProgressionWithParticipants` már körönként számol pontot (last_32/last_16/qf/sf/final + champion). Ezt az információt a UI **nem használja fel**.
4. **Bizalmi rés.** "27 pontot kaptam, de miért nem 30-at?" → a felhasználó nem tudja auditálni saját pontszámát. A leaderboard-hitelesség csorbul.

### Üzleti hatás

- **Retention:** post-tournament revisit ("nézzük vissza, mit tippeltem") elmarad, mert nincs mit visszanézni.
- **Engagement / megosztás:** a bracket a legvizuálisabb tipp-típus. Egy jól kiértékelt nézet screenshot-tolható és megosztható — organikus növekedés.
- **Percieved fairness:** a pontozás transzparenciája közvetlenül hat a leaderboard iránti bizalomra.

---

## 2. Root problémák

| # | Probléma | Következmény |
|---|----------|--------------|
| P1 | A saját tipp bracket-struktúra kiértékelés után nem látható | Nincs önreflexió, nincs sztori |
| P2 | A pontszám nem bomlik le körönként a UI-on (csak a backend tud róla) | A felhasználó nem érti a pontokat |
| P3 | Nincs vizuális jelölés arra, mely csapatot találta el / hibázta el | Nincs mikrotanulás, nincs "közel jártam" élmény |
| P4 | A champion / bronzeWinner tipp elveszik a nézetből | Két legérzelmesebb pick teljesen láthatatlan |
| P5 | Nincs jól definiált fallback ha a `correctAnswer` részleges (pl. csak `last_32`) | Vagy összeomlik, vagy semmit se mutat |

---

## 3. Stratégiai irányok (választható)

### A. Full bracket tree + inline visszajelzés (a piros / zöld közvetlenül a csapatokon)

**Változás:** A meglévő read-only bracket-fa (kör-oszlopok layout) minden csapat-chipjén zöld/piros háttér attól függően, hogy a csapat *benne van-e* a tényleges kör-halmazban (`correct.participants[round]`).

**Miért működik:** A tippfa mentális modellje már kialakult a leadás során — nem kell új struktúrát megtanulni. Csak "réteget" adunk.

**Impact:** Erős vizuális pillanat ("meddig jutottak *az én* csapataim"). Screenshot-barát. Ez a legmagasabb "engagement per pixel" opció.

**Kockázat:** Mobilon a teljes fa nehezen fér el (6 kör × 2-32 pár). A meglévő read-only pickerben már megoldott a kör-per-kör scroll, tehát ez nem új probléma.

---

### B. Kompakt "round summary" chip-lista (à la UX-039 collapsed)

**Változás:** A fa helyett round-onként egy sor, mindegyikben chip-lista a userr *által tippelt* csapatokból zöld/piros háttérrel + jobbra egy pont-pirula.

**Miért működik:** Kicsi, ismerős, illeszkedik a `GroupStandingCard` collapsed nyelvhez.

**Impact:** Kis footprint, de kevesebb "wow"-faktor. Nem szemlélteti a bracket-fát mint sportágra jellemző struktúrát.

**Kockázat:** Elveszik a bracket sajátos vizuális identitása.

---

### C. Hibrid — collapsed kör-összefoglaló + expandálva a fa (JAVASOLT)

**Változás:**
- Első pillantásra a felhasználó egy **kompakt round-lista** kártyát lát: 5 sor (last_32 → final) + 2 sor (champion, bronze), mindegyik sorban `X / N eltalálva` + pont-pirula.
- Egy `Bracket megjelenítése` (accordion) toggle-lel kinyitható a **teljes bracket-fa** a picker read-only + `correctAnswer` propjával — chip-szintű zöld/piros overlay.

**Miért ez a legjobb:** Progresszív feltárás. A lusta felhasználó megkapja a lényeget (bontás + összpont) egy kis kártyán; az érdeklődő felhasználó lemehet a részletbe (mely konkrét csapatokat talált el melyik körben). Konzisztens a UX-039/040 pattern-nel (chip summary → expand → részletes lista).

**Impact:** Legjobb clarity vs. footprint arány mobilon, és megőrzi a bracket vizuális erejét desktopon.

---

## 4. Ajánlott irány: **C (hibrid)**

### Miért C, nem A vagy B

- **A** önmagában — a teljes bracket-fa alapból nyitva — telefonon bombasztikusnak tűnik, de a `TournamentTipsView` listás layout-jában ez az egyetlen kártya elviszi a fél képernyőt. A felhasználó a *listát* látogatja, egy tipp részleteit *proaktívan* nyitja.
- **B** önmagában — csak chip-lista — konzisztens a `GroupStandingCard` collapsed módhoz, viszont sunk-cost: ha valakit érdekel *melyik konkrét pár melyik ágán bukott meg*, azt nem tudja megnézni.
- **C** egyesíti a kettőt. A default megjelenés (`B`) elég a leaderboard-tranzitív scroll-hoz; az expand (`A`) a "mélyülni akarok" nézet.

### Tradeoff

- Két rendering-módot kell fenntartani. Ez elfogadható, mert az expand-mód a meglévő `BracketProgressionPicker` read-only + `correctAnswer` prop kombinációja lesz (nem új komponens).

---

## 5. Layout / információ-hierarchia

### 5.1 Kártya vázlat — kollapszolt (default post-eval nézet)

```
┌────────────────────────────────────────────────────────────┐
│ Bracket-progresszió                       [összesen 27 p]  │  ← header (nem változik)
│ (határidő: 2026-06-15 · lezárt)                            │
├────────────────────────────────────────────────────────────┤
│ Te tipped: – (nincs "Te tipped: X" sor, mert a bracket     │
│              szöveges összegzése értelmetlen)              │
├────────────────────────────────────────────────────────────┤
│ Kör            Eltalált       Pont                         │
│ ─────────────  ─────────────  ──────────                   │
│ Nyolcaddöntő   16 / 16 csapat  +32 p    ✓✓✓✓✓✓  (zöld)     │
│ Legjobb 16     12 / 16 csapat  +36 p    ✓✓✓✓✓✓  (zöld)     │
│ Negyeddöntő     4 / 8  csapat  +16 p    ✓✓✓·   (részleges) │
│ Elődöntő        1 / 4  csapat   +6 p    ✓···    (kevés)   │
│ Döntő           0 / 2  csapat    0 p    ····    (nulla)   │
│ ─────────────                                              │
│ Bajnok:         Argentína  ✓            +10 p              │
│ Bronzérmes:     Portugália ✗ (Franciaország)   0 p         │
├────────────────────────────────────────────────────────────┤
│ ▸ Bracket megjelenítése (16 pár)                           │  ← toggle
└────────────────────────────────────────────────────────────┘
```

### 5.2 Kártya vázlat — expandált

Ugyanaz a fejléc + a round-táblázat, alatta a **meglévő** `BracketProgressionPicker` read-only + `correctAnswer` proppal. A picker minden pár-chipje kap egy vizuális réteget:

- **zöld chip** — a user által ide tippelt csapat *benne van* a `correct.participants[round]` halmazban;
- **piros chip** — a user által tippelt csapat *nincs benne* a helyes halmazban;
- **halvány szürke csapat-label** a chip alatt (opcionális, ha van hely) — a tényleges "továbbjutók" közül *melyik csapat* jutott ide.

```
┌────────────────────────────────────────────────────────────┐
│ … fejléc … kör-táblázat …                                  │
│ ▾ Bracket elrejtése                                        │
├────────────────────────────────────────────────────────────┤
│                                                            │
│   L32       L16       QF       SF       F        Champ     │
│  ┌─────┐                                                   │
│  │🇦🇷 ✓ │┐                                                  │
│  ├─────┤├─┐ ┌─────┐                                       │
│  │🇸🇦 ✗ │┘ │ │🇦🇷 ✓ │┐                                     │
│  └─────┘   ├─┤     ├─┐                                     │
│  ┌─────┐   │ └─────┘ │  …                                  │
│  │🇲🇽 ✗ │┐  │         │                                     │
│  ├─────┤├──┘         │                                     │
│  │🇵🇱 ✓ │┘            │                                     │
│  └─────┘             │                                     │
│                                                            │
└────────────────────────────────────────────────────────────┘
```

### 5.3 Mobile ↔ Desktop

| Elem | Mobile | Desktop |
|------|--------|---------|
| Round-táblázat | egyoszlopos, "Kör" + "N/M" + "+p" 3 részre osztva `justify-between` | 3 oszlop grid, "Kör" bal, "Eltalált" közép, "Pont" jobb |
| Bajnok / bronze | két külön sor, teljes szélesség | egy közös 2-oszlopos sor |
| Bracket expand | horizontális scroll snap kör-oszloponként (már megvan a pickerben) | teljes fa látszik egyszerre |
| Champion badge helye | pont-pirula alá, teljes szélesség | pont-pirula jobbra |

### 5.4 Hierarchia sorrend (fentről lefelé)

1. **Összpont** (`points-pill`, emerald, top-right, változatlan) — a legerősebb visszajelzés.
2. **Round-táblázat** — az "áttörés" új tartalom: minden sor egy önálló mikropont-sztori.
3. **Champion + Bronze sorok** — érzelmi horgony, külön szekció alul.
4. **Bracket expand toggle** — utolsó, mert a legmélyebb réteg.

---

## 6. Vizuális jelölésrendszer (design tokens)

### 6.1 Színek (Tailwind v4 osztálynevekkel — csak javaslat)

| Állapot | Háttér | Border | Szöveg | Ikon |
|---------|--------|--------|--------|------|
| Helyes csapat / kör pontot ért | `bg-emerald-50` | `border-emerald-500` | `text-emerald-900` | `text-emerald-600` ✓ |
| Helytelen csapat / kör 0 pont | `bg-rose-50` | `border-rose-400` | `text-rose-900` | `text-rose-500` ✗ |
| Részleges (a round pontot ért, de nem maxot) | `bg-amber-50` | `border-amber-300` | `text-amber-900` | — |
| Bracket-chip semleges (bronze, ha nem tippelt) | `bg-slate-50` | `border-slate-200` | `text-slate-500` | — |
| Pont-pirula (körönként) | `bg-emerald-500 text-white` (pozitív) / `bg-slate-200 text-slate-500` (nulla) | — | — | — |

### 6.2 Ikonok / mikrokopik (magyar)

- **✓** — helyes eltalált csapat/pick
- **✗** — helytelen pick
- **·** — nem tippelt slot (üres pont-progress)
- Round címek: `Nyolcaddöntő` (last_32), `Legjobb 16` (last_16), `Negyeddöntő` (qf), `Elődöntő` (sf), `Döntő` (final), `Bajnok`, `Bronzérmes`.
- "N / M csapat" formula (nem "meccs", mert set-based a pontozás).
- Bajnok helyes: `Argentína ✓` + `+10 p` zöld pirula
- Bajnok helytelen: `Portugália ✗ (helyes: Franciaország)` + `0 p` szürke pirula
- Ha a user nem tippelt bajnokot: `— (helyes: Franciaország)` + `0 p`

### 6.3 Round-találati progress-mini-vizualizáció

Ne pie-chart legyen, ne progress bar — hanem **N pötty**, ahol N = a kör csapat-halmazának mérete:

- `last_32` → 16 pötty (mert 16 csapat képes bejutni — nem 32! a kör *utáni* halmaz mérete)
- `last_16` → 16 pötty (a kör *bemenete*, ami egyben a `last_32` győztesei halmaza)

**Egyszerűsítés (javaslat):** ne pötty, csak szöveges `12 / 16 csapat`, mert 16 pötty mobilon zsúfolt. A pötty-vizu csak akkor tér vissza, ha a kör kis halmazú (final = 2, sf = 4, qf = 8).

Egységes szabály: ha `total ≤ 8` → mutatunk `total` darab pöttyöt (megjelenítés a szöveges arányon **kívül**), különben csak szöveg.

---

## 7. Interakciók

### 7.1 Kollapszolt → expandált átmenet

- **Trigger:** a `▸ Bracket megjelenítése (16 pár)` felirat egy `button` (nem link), `aria-expanded` toggle-lel.
- **Kattintás:** a bracket egy `max-height` transition-nel kinyílik. Nincs router-navigáció, minden lokális state.
- **Perzisztencia:** MVP-ben *nem* perzisztáljuk a `localStorage`-be (ellentétben pl. az UX-021 sidebar-scope-jával); alapból mindig kollapszolt, mert a lista több tippet tartalmaz és az auto-nyitás összenyomná a scrollt.

### 7.2 Hover / tap részletek

- **Desktop:** a round-táblázat egy sora fölé hover-elve tooltip: "Nyolcaddöntő: 12 / 16 csapat helyes × 2 p = 24 p". A tooltip a bontás matematikáját mutatja — audit / trust-építés.
- **Mobile:** a sor `tap`-re nem nyílik ki külön modalba (túl sok interaktív layer). A round-táblázat statikus. Ha a felhasználó több részletet akar, kinyitja a bracketet.
- **A bajnok / bronze sor** desktopon és mobilon egyaránt statikus (nincs hover-info; a szöveges "Helyes: X" mindent elmond).

### 7.3 Bracket expand — chip interakció

- A chipek **nem** klikkelhetők (nem lehet módosítani a tippet). Cursor `default`.
- **Egyetlen kivétel:** hosszan érintés / hover a chipen → tooltip a csapat teljes nevével és zászlóval (a rövid kód mellett), *ha* a bracket layout miatt a hely szűkös.

---

## 8. Edge cases

### 8.1 Az admin csak részben töltötte fel a `correctAnswer`-t

Példa: `participants.last_32` és `participants.last_16` megvan, de `qf`, `sf`, `final` üres array.

**UX kezelés:**
- A round-táblázatban a hiányzó körök sora **halvány szürke** (`text-slate-400`), a "Pont" oszlopban `— (értékelés folyamatban)`. A "N / M csapat" oszlop pedig `– / 8 csapat`.
- Ez ne blokkolja a többi kör megjelenítését.
- A `champion` / `bronzeWinner` külön kezelendő: ha `correct.champion === null`, akkor a Bajnok sor `— (még nincs kihirdetve)` szöveggel jelenik meg semleges színnel.
- Fontos: **az összpont NEM változik** — a backend már kiszámolta a részleges válaszra a pontot; a UI csak vizuálisan jelzi, hogy mely körök még nem véglegesek.

### 8.2 A user nem tippelt egy körre (pl. nincs `sf` mérkőzésre pick)

- A backend a `deriveBracket`-tel csak azokat a csapatokat számolja a user set-jébe, ahol a slot már felold (nincs `null` team). Tehát a round-tábla `N / M`-jében a *user oldal* zérus, a *helyes oldal* teljes.
- **Megjelenítés:** `0 / 4 csapat · +0 p` szürke pirula. Nem piros — a felhasználó nem *hibázott*, csak nem tippelt.
- Az expandált fában ezen a körön a user csapat-chipek helyett egy `— nincs tipp` placeholder chip (`border-dashed border-slate-200`) jelenjen meg.

### 8.3 A user 0 pontot kapott az egész bracket-re

- A round-táblázat végig `0 p` pirulákkal.
- Az összpont `0` — a top-right pirula legyen `bg-slate-200 text-slate-500` (nem emerald, mert az félreérthető: "kaptál 0 pontot" ≠ "sikerült").
- **NE jelenjen meg negatív / vádoló copy** ("Sajnos elbuktad"). Semleges: `0 pont — próbáld meg jobban a következő tippnél.` — de MVP-ben *ne is legyen* külön szöveges copy, csak a szám.

### 8.4 A user nem választott bajnokot

- A bajnok sor: `— (helyes: Franciaország)` szürke pirula `0 p`.
- **NE** jelenjen meg piros ✗ — a "nem tippelt" ≠ "rosszul tippelt". Semantikai különbség fontos.

### 8.5 A bronze pontot nem ér, de a user tippelt bronze-t

- A bronze sor **mindig 0 pont** — ez látszódjon: `Bronzérmes: Portugália · 0 p (nem pontoz)` halvány szürke pirula, kiegészítő tooltip "A bronzérmes tipp jelenleg nem ad pontot."
- Ha `bronzeWinner === null` a helyes válaszban: `Bronzérmes: Portugália · 0 p (helyes: —)`.

### 8.6 A bracket-fa túl széles mobilon (16 pár × 6 kör)

- A meglévő `BracketProgressionPicker` már megoldja horizontális `overflow-x-auto` + `scroll-snap-x`. Kiértékelt módban ez változatlanul működik.
- **Új javaslat:** az expand-toggle mellé egy `Kör-választó` (chip-tabs: `L32 | L16 | QF | SF | F`) — csak mobilon, ami az expand-kor kiválasztott körre snap-el. (Optional; MVP-ben elhagyható.)

---

## 9. Konzisztencia meglévő pattern-ekkel

| Meglévő pattern (story) | Amit átveszünk | Amit másképp csinálunk |
|---|---|---|
| UX-039 `GroupStandingCard` collapsed | Zöld/piros chip színek, semleges card border | Nem chip-lista, hanem táblázat — a bracket kör-modellje más |
| UX-040 pont-pirula (`+3 p`) | Ugyanaz a stílus per-round és per-champion pontokra | A `perGroup` konstans helyett `perTeam[round]` × N |
| UX-041 UpsetSpecial "Tényleges" badge | Ugyanaz a `Tényleges` label bracket-chipeken (halvány zöld szaggatott) | Csak akkor, ha a felhasználó nem tippelte és az adott csapat helyes |
| `TournamentTipsView` kártya-fejléc | Változatlan `points-pill` a top-right-en | — |

---

## 10. Mit ír a story-writer (lépések a következőhöz)

**A story-writer ne implementációt írjon, hanem a következőket tervezze el a UX-045 (vagy 046, ID a backlog szerint) storyban:**

1. **Új komponens: `BracketProgressionScoredSummary.vue`** — csak a *kollapszolt* round-táblázat + champion/bronze sorok. Bemenete: `answer: BracketProgressionAnswer`, `correctAnswer: BracketProgressionCorrectAnswer`, `template: BracketMatch[]`, `groupStandings: AllGroupsStandingAnswer | null`. Kimenete: a `BracketBreakdown` render + pont-pirulák.
2. **Új pure helper: `bracketBreakdown.ts` a frontend `lib/`-jében** — a set-intersect logikát *tükrözve* a backend `scoreBracketProgressionWithParticipants`-ből. Ugyanaz a matematika, ne duplikáljon; a tesztek biztosítsák, hogy a frontend total == backend total (property-based teszt).
   - Kimenet: `{ perRound: [{round, userCount, correctCount, matchedCount, points, pointsPerTeam}], championHit: bool, bronzeHit: bool, total: number }`.
3. **`BracketProgressionPicker` bővítése** — új `correctAnswer?: BracketProgressionCorrectAnswer | null` prop, chip-szintű overlay: zöld ha `user winner-a benne van a correct.participants[round+1]`-ben, piros ha nincs. Champion match külön highlight.
4. **`TournamentTipsView` integráció** — ha `sp.points !== null && sp.inputType === 'bracket_progression'`:
   - Render `BracketProgressionScoredSummary` mindig
   - Render `BracketProgressionPicker` readOnly `v-if="expanded"` — toggle button-nal
   - Töröld a szöveges "Helyes válasz: …" fallback-et bracket típusra
   - Tartsd meg a defenzív fallback-et arra az esetre, ha a `correctAnswer` nem parse-olható vagy nem a `participants`-shape
5. **i18n kulcsok (hu / en):**
   - `bracketProgression.roundLabels.{last_32,last_16,qf,sf,final,champion,bronze}`
   - `bracketProgression.matchedOfTotal` — `{matched} / {total} csapat`
   - `bracketProgression.pointsPill.positive` / `.zero`
   - `bracketProgression.expandLabel` / `.collapseLabel`
   - `bracketProgression.notYetEvaluated` — `— (értékelés folyamatban)`
   - `bracketProgression.notTipped` — `— (nincs tipp)`
   - `bracketProgression.bronzeNoPoints` — `A bronzérmes tipp jelenleg nem ad pontot.`
6. **Tesztelés:**
   - Unit — `bracketBreakdown` teljes matrix (0/N, N/N, részleges, hiányzó `correctAnswer.participants[round]`).
   - Property-based — a `BracketProgressionScoredSummary` `total` === backend `scoreBracketProgressionWithParticipants` ugyanazokra a bemenetekre.
   - Component — `BracketProgressionScoredSummary` render zöld/piros pirulák, edge case-ek (nincs bajnok, üres kör).
   - Component — `BracketProgressionPicker` `correctAnswer` prop → chip osztályok.
7. **Kizárások (story scope-ból):**
   - Bronze pontozás bevezetése (jelenleg 0 p szándékosan) — külön PO döntés kell.
   - A bracket-fa animált "továbbjutás" mozgás — out of scope.
   - Megosztható link / OG-image a kiértékelt bracketről — nice-to-have jövőbeli story.

---

## 11. Kockázatok / anti-pattern-ek

| Kockázat | Miért probléma | Ellenlépés |
|----------|---------------|-----------|
| **Túl sok szín** — piros / zöld / sárga / szürke egyszerre az expand-módban | Kognitív zaj, a bracket-fa amúgy is sűrű | Kerüld a sárgát ("részleges") a chipeken; sárga csak a round-táblázat során |
| **A "Bronze 0 pont" nem magyarázott** | Confusing: "miért nulla ha eltaláltam?" | Kötelező tooltip / kis szöveg mellette |
| **Screen-reader nem érti a zöld/piros színt** | A11y probléma | Minden chip-hez `aria-label="helyes"` / `"helytelen"`; ne csak szín |
| **A round-táblázat és a bracket-fa duplikáció** | Ha *mind a kettőben* van szín/ikon, redundancia | A táblázat *aggregát*, a fa *chip-szintű* — más granularitás, nem duplikáció |
| **A kollapszolt táblázat pontszám-összege nem ==-e a top-right pirulával** | Bizalmi kudarc | A `bracketBreakdown.total` legyen a top-right pirula forrása is (single source) |
| **Az admin részleges `correctAnswer`-je "false negatívot" mutat** | User azt hiszi, hibázott, pedig még nincs kiértékelve | Külön "értékelés folyamatban" vizuális állapot, nem "0 p" |

---

## 12. Mit kérdezzek meg a felhasználótól még

1. **Bronze pontozás** — továbbra is 0 pont a szándékos állapot, vagy szeretnénk +N pontot a bronze eltalálásáért? (Ha módosul, PO döntés + `TOURNAMENT_POINTS.perTeam.bronze` bevezetés kell.)
2. **Round-táblázat "részleges" (sárga) állapot** — kell-e egyáltalán vagy elég a zöld/szürke bináris? (Én sárgát javasoltam, mert a `qf: 3/8` jobban kommunikál mint zöld/nem-zöld.)
3. **Champion mint önálló sor** vagy a `final` sorába integrált piktogram? (Külön sort javasoltam a `+10 p` súlya miatt.)
4. **Expand alapból zárva marad-e per session** vagy legyen valamiféle "első látogatáskor nyissuk ki auto" mikroanimáció? (Én zárva javasoltam MVP-re — a `TournamentTipsView` egy lista, nem detail-view.)
5. **Screenshot-optimalizáció** — akarunk-e külön "share" gombot, ami egy screenshot-barát verziót nyit (fejléc + bracket egyben, no scroll)? Nem MVP, de tervezéshez fontos tudni, hogy szempont-e.
