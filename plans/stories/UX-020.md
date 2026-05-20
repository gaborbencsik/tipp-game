---
id: UX-020
title: Mérkőzések oldal liga-szűrés javítása – csoport-ligák alapú szűrés
priority: Should Have
status: Open
complexity: M
dependencies: []
---

# UX-020: Mérkőzések oldal liga-szűrés javítása

## Leírás

Mint **bejelentkezett felhasználó**, szeretnék, hogy **a Mérkőzések oldalon csak azoknak az ligáknak a meccseit lássam, amelyekhez csoportjaimban tartozom**,
hogy **ne lássak olyan ligákat (pl. NB I), amelyekre nem csatlakozott csoportjuk és így tippelni sem tudok**.

## Jelenlegi helyzet

- Backend `/api/matches` nem szűr a user csoportligái alapján – minden ligát visszaad (opcionális query filterekkel)
- Frontend `MatchesView.vue` csak egyedi csoportligát szűr automatán, ha a usernek **pontosan 1** csoportligája van
- Liga dropdown az **összes** ligát listázza (`favStore.leagues`-ből), nem csak a user csoportligáit
- Felhasználó számára kaotikus: olyan ligák meccseit látja, amelyekre nincs csoportja

## Elfogadási kritériumok

### Backend – Szűrési kapacitás

1. **Array szűrés támogatása**
   - Az `/api/matches` endpoint fogad `leagueIds` query paramétert (array formátum: `?leagueIds=uuid1&leagueIds=uuid2`)
   - Drizzle `inArray(matches.leagueId, leagueIds)` ahol-sel szűr, ha a paraméter jelen van
   - Üres array vagy hiányzó paraméter → nem szűr ligára (a jelenlegi viselkedés marad)

2. **Típus frissítés**
   - `MatchesFilters` típus (`packages/backend/src/services/matches.service.ts`) bővítődik: `leagueIds?: readonly string[]`

### Frontend – Default szűrés minden esetben

3. **User csoportligáinak automatikus gyűjtése**
   - Adott egy user 0 csoportligával → **empty state CTA** jelenik meg: "Csatlakozz egy csoporthoz, hogy láthasd a meccseket." linkkel a Csoportok oldalra
   - Adott egy user 1 csoportligával → az egyetlen csoportliga **automatikusan** kiválasztva (leagueId default), csak az csoportligával szűrve
   - Adott egy user 2+ csoportligával → **mindkét (összes) csoportliga** meccseit látja default-ban szűrve

4. **Liga selector dropdown csak csoportligákat mutat**
   - Dropdown forrása: `groupsStore.groups[].league` (nem `favStore.leagues` teljes lista)
   - Csak azok a ligák listázódnak, amelyekhez van legalább egy csoportja a usernek
   - Ha nincs csoportja, dropdown nem jelenik meg (empty state CTA helyette)

5. **Megjelenített meccsek szűrése**
   - `/api/matches?leagueIds=uuid1&uuid2&...` hívás az automatikus default alapján
   - Felhasználó válthat a dropdown segítségével egyedi liga(k) kiválasztására
   - Nem ugorhat vissza olyan ligára, amire nincs csoportja

### Edge case-ek

6. **Nincs csoportligája**
   - Empty state CTA: "Csatlakozz egy csoporthoz, hogy láthasd a meccseket." + link a Csoportok oldalra
   - Sem meccsek, sem dropdown nem jelenik meg

7. **Csoportigazi de league=null**
   - Olyan felhasználó, aki csoportban van, de a csoport `league_id` mezője `NULL` (edge case)
   - Ilyenkor is empty state CTA jelenik meg (az adott user nincs jó csoportligában)

8. **Ligák közötti váltás**
   - Ha a felhasználó 2+ csoportligával rendelkezik, a dropdown lehetőséget biztosít szűrésre
   - Opcó: "Összes saját liga" (default kijelölve) + egyedi ligaválasztás
   - Frontend hívása: `/api/matches?leagueIds=uuid1` vagy `/api/matches?leagueIds=uuid1&leagueIds=uuid2`

## Technikai megjegyzések

### Backend

- **Fájl:** `packages/backend/src/services/matches.service.ts` – `getMatches(filters)` metódus
- **Drizzle where:** ha `leagueIds` jelen van és nem üres: `and(where, inArray(matches.leagueId, leagueIds))`
- **Típus:** `MatchesFilters` bővítése: `leagueIds?: readonly string[]`
- **API route:** `packages/backend/src/routes/matches.routes.ts` – query parse a standard Koa `ctx.query` formátummal

### Frontend

- **Fájl:** `packages/frontend/src/views/MatchesView.vue`
- **Logika:** `onMounted`-ben a `userLeagueIds` Set már ki van számítva (482-es sor körül)
  - 0 liiga: empty state CTA
  - 1 liga: default szűrés az egyedüli ligára
  - 2+ liga: default szűrés az összesre
- **Dropdown forrása:** nem `favStore.leagues`, hanem `groupsStore.groups.filter(g => g.league !== null).map(g => g.league)` (unique)
- **Store:** `packages/frontend/src/stores/matches.store.ts` – `fetchMatches()` hívás már `leagueId` szűréssel megy, bővítendő: `leagueIds: string[]`
- **Típus:** `Group.league: { id, name, shortName } | null` – már jelen van `packages/frontend/src/types/index.ts:231`

### Tesztelés

- **Backend unit:** `getMatches({ leagueIds: ['uuid1', 'uuid2'] })` csak az adott ligák meccseit adja; üres array → 0 sor
- **Frontend unit:** `MatchesView.test.ts`
  - 0 csoportliga → empty state CTA
  - 1 csoportliga → auto default
  - 2+ csoportliga → multi-league szűrés
  - Dropdown csak csoportligákat listáz
- **E2E:** ha a suite már fed hasonló UX flow-t, frissítendő

## Kizárások

- Backend nem implicit JWT-alapú szűrésre változik – frontend dönti el az alapértelmezést
- Más végpont nem érintett (csak `/api/matches`)
- Régi `leagueId` query paraméter marad, nem törlendő – kompatibilitás
- Az összes korábbi "Liga szűrés" feature és UI logika marad, csak az alapértelmezés és a dropdown forrása változik
