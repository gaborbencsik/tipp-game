---
id: SCORER-005
title: "Gólszerző tippek megjelenítése a Statisztikáim oldalon"
priority: Should Have
status: Open
dependencies: ["SCORER-003"]
complexity: M
---

# SCORER-005: Gólszerző tippek megjelenítése a Statisztikáim oldalon

## Leírás

Mint **felhasználó**, szeretném, hogy a Statisztikáim (MyTipsView) oldalon **minden saját tippnél** megjelenjen a gólszerző tipp — ha leadtam egy góllövő tippet (`scorerPickPlayerId` nem null). A kiértékelt meccseken láthassam, hogy **eltaláltam-e a góllövőt**, valamint egy részstatisztika a tetején összefoglalja: "Gólszerző tippek: X leadva / Y eltalálva".

## Jelenlegi helyzet

A Statisztikáim oldal jelenleg **nem jeleníti meg** a gólszerző tippeket. A góllövő tippek csak a Mérkőzések listán és a Meccs-detail oldalon láthatók (`SCORER-003`). A `MyStats` interface és `computeMyStats` függvény szintén **nem számítja** a gólszerző statisztikákat.

## Elfogadási kritériumok

### 1. Részstatisztika a tetején (KPI sorban)

- Az 4 KPI kártyát követően — ha legalább 1 gólszerző tipp van leadva — megjelenik egy **5. KPI kártya**:
  - **Label**: "Gólszerző tippek" vagy "⚽ Gólszerző" (ikonnal)
  - **Value**: `Y / X` (eltalált / leadott, pl. "3 / 5")
  - **Hint** (opcionális): ha 0 pont szerzett gólszerző tippen: "0 pont szerzett", ha >0: `Z pont` vagy `Z / W pont` (szerzett / lehetséges)
  - **Tone**: `positive` ha az accuracy ≥ 50%, egyébként `default`
  - **Megjelenés**: csak ha `scorerSubmittedCount > 0`

### 2. Gólszerző tipp megjelenítése az egyes tippsoroknál

- A tipp kártyákon (List oldalon, a Szűrős tab alatt) **az eredménytipp mellett** (a pontos badge után) megjelenik a gólszerző tipp:
  - **Leadott, de még nem értékelt** (élő meccs): `⚽ Szoboszlai D. [?]` — semleges kék badge (`bg-blue-50 text-blue-700 border-blue-200`)
  - **Eltalálva** (meccs vége): `⚽ Szoboszlai D. [+1]` — zöld badge (`bg-green-50 text-green-700 border-green-200`), és a teljes pont sor megjelenik (pl. `+4 pont` vagy `+2 pont`)
  - **Nem talált** (meccs vége): `⚽ ~~Szoboszlai D.~~ [0 pont]` — szürke, line-through (`text-gray-500 decoration-gray-300`)
  - A megjelenítés szabálya: **csak akkor**, ha `scorerPickPlayerId !== null` és a `scorerPlayerNameSnapshot` elérhető
  - **Vizuális stílus**: azonos `pointsBadgeClass` gradiens, mint az eredménytipp (monoton teal → emerald)
  - **Elrendezés**: az eredménytipp mellett szeparátor (`·`), egy sorban ha szétfér, 360px-nél flexol 2 sorra

### 3. MyStats interface bővítés

- Az `MyStats` interface új mezőket kapjon:
  - `scorerSubmittedCount: number` — leadott gólszerző tippek száma
  - `scorerHitCount: number` — eltalált gólszerző tippek száma
  - `scorerTotalBonus: number` — szerzett gólszerző bónusz pontok összege (a kedvenc csapat multiplikátor már beépítve; csak az eltalált tippek pontja)

### 4. computeMyStats függvény bővítés

- Az `computeMyStats` függvény számítsa ki a 3 új statisztikai értéket:
  - `scorerSubmittedCount`: azon `predictions` száma, ahol `scorerPickPlayerId !== null`
  - `scorerHitCount`: azon `predictions` száma, ahol `scorerPickPlayerId !== null` **és** `scorerBonusPoints === 1` (eltalálva)
  - `scorerTotalBonus`: azon `predictions` összeg, ahol `scorerBonusPoints !== null && scorerBonusPoints === 1` → **szerzett pont** (amely már tartalmazza a `favoriteTeamMultiplier`-t a `pointsGlobal`-on belül, a `scorerBonusPoints` mezzőben azonban csak a nyers 0/1 érték van; ezért a szerzett pont kiszámítása: ha a tipp kiértékelt (`pointsGlobal !== null`) **és** `scorerBonusPoints === 1` **és** a meccs a kedvenc csapat meccs, akkor +2, egyébként +1)
  - **Alternatív és egyszerűbb megközelítés**: a `scorerTotalBonus`-t külön nem számítjuk ki, az apenas UI-hint ("Y eltalálva = Y pont"), és mivel a KPI általában nem nézi a pont részletességét

### 5. TDD: tesztek a bővítésekhez

- **`useMyStats.test.ts`** — új tesztek:
  - `computeMyStats` alapeset: `scorerSubmittedCount = 0`, `scorerHitCount = 0` (ha nincs scorer tipp)
  - `computeMyStats` + 1 eltalált scorer tipp: `scorerSubmittedCount = 1`, `scorerHitCount = 1`
  - `computeMyStats` + 1 nem talált scorer tipp: `scorerSubmittedCount = 1`, `scorerHitCount = 0`
  - `computeMyStats` + vegyes (3 leadott, 2 eltalálva): `scorerSubmittedCount = 3`, `scorerHitCount = 2`
  - Scorer tipp kiértékelés előtt: `scorerBonusPoints === null` → 0-nak számít az accuracy-ban

- **`MyTipsView.test.ts`** — integration teszt:
  - KPI kártya megjelenítése: scorer kártya nem jelenik meg, ha `scorerSubmittedCount === 0`
  - KPI kártya megjelenítése: scorer kártya **megjelenik**, ha `scorerSubmittedCount > 0`
  - Scorer badge megjelenítése a tipp sorban (eltalált/nem talált/pending)
  - Szűrés után is látható a scorer badge

## Technikai megjegyzések

### Frontend

- **Módosított fájlok**:
  - `packages/frontend/src/composables/useMyStats.ts` — `MyStats` interface + `computeMyStats` logika bővítés
  - `packages/frontend/src/views/MyTipsView.vue` — KPI kártya render + scorer badge a tipp sorban
  - `packages/frontend/src/composables/useMyStats.test.ts` — unit tesztek az új számításokhoz
  - `packages/frontend/src/views/MyTipsView.test.ts` — integration tesztek a UI rendereléshez

- **Adatmodell** — már meglévő mezők:
  - `Prediction.scorerPickPlayerId` — tippelt játékos ID
  - `Prediction.scorerPlayerNameSnapshot` — játékos neve a tipp leadásának pillanatában
  - `Prediction.scorerBonusPoints` — `null` (még nem értékelt) | `0` (nem talált) | `1` (talált)
  - `Prediction.pointsGlobal` — teljes pont (már tartalmazza a kedvenc csapat multiplikációt és a scorer bonuszt)

- **Badge stílus** — újrafelhasználás:
  - Talált scorer tipp: `pointsBadgeClass` (zöld gradiens, mint az eredménytipp)
  - Nem talált: szürke (`text-gray-500 decoration-gray-300`)
  - Pending: kék (`bg-blue-50 text-blue-700`)

### Backend — NEM szükséges

- Az `SCORER-003` már biztosítja az összes szükséges adatot
- Nincs új API endpoint, nincs séma módosítás

## Kizárások

- **Nincs** gólszerző tipp szerkesztés a MyTipsView-ből — szerkesztés csak a Meccs-detail vagy Meccs-lista oldalról
- **Nincs** külön "Gólszerző tippek" filter tab — a meglévő Szűrős tabban megjelenik
- **Nincs** gólszerző tipp megosztás / export — csak a "Pontozási szabályzat" gomb-hoz hasonlóan info tooltip az info ikon mellett (ha kell)
- **Nincs** "Top golscorers" globális ranglista — csak a saját tippek statisztikája
- **Nincs** gólszerző tipp részletezés (mely játékosok, mely meccsen, stb.) — csak az összegzett "X leadva / Y eltalálva"
