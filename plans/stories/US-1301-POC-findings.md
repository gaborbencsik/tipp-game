# US-1301-POC Findings: Csapat KPI-ok gyűjtése (api-football.com)

> Dátum: 2026-05-14

## Összefoglaló

A POC validálta, hogy az api-football.com v3 API-ból hatékonyan gyűjthetők válogatott csapat KPI-ok. A megközelítés működik, az adatok hasznosak.

## API hívás stratégia

**Megoldás:** `GET /fixtures?team={externalId}&season={year}` — season-enként 1 hívás, 3 season (2024, 2025, 2026) lefedi a 24 hónapos ablakot.

**Miért nem `from`/`to` dátumszűrés:** A subscriptionünk nem támogatja a `from`/`to` paramétert — 0 eredményt ad vissza. A `season` paraméter viszont működik.

**Hívások száma:** 3 API hívás / csapat (season-enként 1). 48 VB-csapatra: 144 hívás összesen.

**Rate limit:** Az api-football.com 10 req/min limitet ad free tier-en. 144 hívás ≈ 15 perc. Pro tier-en nincs ilyen korlát.

## Számolt KPI-ok

| KPI | Leírás | Példa (Belgium, 24 hó) |
|-----|--------|------------------------|
| totalMatches | Befejezett meccsek száma | 24 |
| wins / draws / losses | W/D/L bontás | 11 / 6 / 7 |
| winRate | Győzelmi arány (0-1) | 0.46 |
| goalsScored / goalsScoredPerMatch | Lőtt gólok + átlag | 52 / 2.17 |
| goalsConceded / goalsConcededPerMatch | Kapott gólok + átlag | 24 / 1.0 |
| cleanSheets / cleanSheetRate | Kapott gól nélküli meccsek | 9 / 0.38 |
| formString | Utolsó 5 meccs (legújabb jobbra) | "WDWWD" |

## Versenytípusok lefedése

Egy hívás tartalmazza az összes versenyt amiben a csapat részt vett az adott szezonban:
- VB-selejtezők (league id: 32)
- UEFA Nations League (league id: 5)
- Barátságos mérkőzések (league id: 10)
- VB (league id: 1)

Belgium 24 hónapja: **4 különböző versenyből** érkezett adat.

## Fixture status kezelés

Befejezett meccs statusok: `FT` (full time), `AET` (after extra time), `PEN` (penalty). Minden más (NS, 1H, HT, 2H, stb.) kiszűrve.

Null goals edge case: előfordulhat FT statusszal is — ezeket szintén skip-eljük.

## Team externalId párosítás

**Probléma:** A DB-ben a csapatok `externalId`-je null volt a sync után, mert a `shortCode` matchelés nem volt elég (pl. AUS = Australia és Austria is).

**Megoldás (commitolva):** A `upsertTeams` logikában name-based fallback:
1. `externalId` match → frissít
2. `shortCode` match + **név egyezés** (case-insensitive) → claimeli
3. **Név alapú fallback** (case-insensitive, shortCode-tól független) → claimeli
4. Semmi nem matchel → új csapat

**Eredmény:** Sync után 60/100 csapat párosítva (48 VB + 12 NB I).

## Következő lépések (US-1301 teljes implementáció)

1. `match_insights` tábla létrehozása (migráció)
2. A `collectTeamStats` logika beépítése a service-be (a POC kódot újra kell írni, a `fetchTeamFixtures` metódust hozzá kell adni a FootballApiClient-hez)
3. Meccs-páronként mindkét csapat statjának gyűjtése és DB-be mentése
4. A `SEASONS` konstanst dinamikussá tenni (ne legyen hardcoded 2024/2025/2026)
5. Rate limit kezelés: batch-elni a hívásokat ha sok csapathoz kell egyszerre

## Elvetett megoldások

- **`/teams/statistics` endpoint:** Gazdag adatot ad (gól timing, kártyák, büntetők), de competition-enként kell hívni — 3-4× több request per csapat. A fixtures-ből saját aggregálás egyszerűbb és elég.
- **`from`/`to` dátumszűrés:** Nem működik a mi subscriptionünkkel.
- **H2H (head-to-head):** Kikerült a scope-ból — nem releváns az insight generáláshoz.
