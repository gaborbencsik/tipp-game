---
id: UX-017
title: Leadott speciális tipp kártyán UUID helyett játékosnév és határidő megjelenítése
priority: Should Have
status: Open
complexity: S
---

# UX-017: Leadott speciális tipp kártyán UUID helyett játékosnév és határidő megjelenítése

## Leírás

Mint **bejelentkezett felhasználó**, szeretnék **a leadott "player_select" típusú speciális tipp kártyán a kiválasztott játékos nevét látni**, hogy **visszaigazolást kapjak arról, kit választottam, és ne egy értelmezhetetlen UUID-et kelljen elolvasnom**.

## Elfogadási kritériumok

### Játékosnév megjelenítése

- [ ] A `player_select` típusú speciális tipp kártyán "Leadva" állapotban a tipp értéke (az `answer` mező) a `players` táblából feloldott játékosnévként jelenik meg (pl. "Kylian Mbappé"), nem UUID-ként
- [ ] Ha a játékos UUID alapján nem található (pl. törölték a DB-ből), a kártya "Ismeretlen játékos" szöveget jelenít meg, nem hibát dob és nem marad üres
- [ ] Más típusú (`text`, `number`, stb.) speciális tippek megjelenítése változatlan marad

### "NaN nap múlva" javítása

- [ ] Ha a speciális kérdéshez nincs `deadline` vagy `matchDate` rendelve, a kártyán **nem jelenik meg** az időszámláló ("X nap múlva" szöveg), hanem az egész mező rejtett
- [ ] Ha `deadline` létezik és érvényes dátum, az időszámláló helyesen mutatja a hátralévő napokat
- [ ] Negatív érték (lejárt határidő) esetén a szöveg "Lejárt" (nem "−X nap múlva" és nem "NaN nap múlva")

### Regresszió

- [ ] Más speciális tipp típusok (`text`, `number`, `team_select`) kártyái vizuálisan nem változnak
- [ ] A tipp leadási flow (player picker, submit) nem érintett

## Technikai megjegyzések

### Frontend-first megközelítés

- Az `answer` mező UUID-ot tartalmaz `player_select` típusnál — a frontendnek fel kell oldania névre
- Két megközelítés, prioritás sorrendben:
  1. **API join (preferált):** a speciális tipp lekérdező endpoint (`GET /api/special-predictions` vagy a megfelelő route) a `player_select` típusoknál joinolja a `players` táblát, és az `answerLabel` mezőt is visszaadja (pl. `{ answer: "<uuid>", answerLabel: "Kylian Mbappé" }`)
  2. **Frontend lookup (fallback):** ha a backend módosítása nem indokolt, a frontend a már betöltött `players` store-ból oldja fel az UUID-et rendereléskor
- A `players` store (`packages/frontend/src/stores/`) valószínűleg már létezik és tartalmaz játékos listát — ellenőrizni kell betöltési állapotát a speciális tipp kártya renderelése előtt
- Az érintett komponens feltehetőleg: `packages/frontend/src/components/predictions/` alatt, a speciális tipp kártyát megjelenítő `.vue` fájl

### "NaN nap múlva" javítása

- A `NaN` abból ered, hogy a `deadline` / `matchDate` `null` vagy `undefined`, és a dátumszámítás nem véd ellene
- Javítás: `deadline` meglétét ellenőrizni renderelés előtt — `v-if="question.deadline != null"` feltétel a határidő blokkra
- A `isNaN()` guard önmagában nem elegendő, a `null` check a forrás

### Nem szükséges

- Új endpoint létrehozása, ha az `answerLabel` join minimális változtatással hozzáadható a meglévő route-hoz
- Backend módosítás, ha a players store-ból feloldás megvalósítható és a store garantáltan betöltött a kártya megjelenésekor

## Nem tartalmazza

- Más speciális tipp típusok label-jeinek feloldása (pl. `team_select` csapatnév)
- A speciális tipp kártya teljes vizuális redesignja
