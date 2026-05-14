---
id: US-1301-POC
title: Match Pulse – csapat KPI-ok POC (24 hónapos időablak)
priority: Should Have
status: Open
dependencies: ~~US-1202~~, ~~US-1203~~
complexity: S
---

# US-1301-POC: Match Pulse – csapat KPI-ok POC (24 hónapos időablak)

## Leírás

Mint **fejlesztő**, szeretnék egy izolált POC-ot futtatni, amely **validálja, hogy a 24 hónapos időablakban lekért nemzeti csapat meccsekből számítható KPI-ok helyesen működnek**, mielőtt az US-1301 teljes implementációja megkezdődik.

## Jelenlegi helyzet

- `FootballApiClient` létezik (`packages/backend/src/services/football-api.service.ts`) — van auth, retry, de csak `/fixtures?league=X&season=Y` és `/teams?league=X&season=Y` végpontot támogat
- A `teams` táblában az `external_id` (api-football team ID) elérhető (US-1202 eredménye)
- `ApiFootballFixture` típus már definiált: `packages/backend/src/types/index.ts`
- Nincs meglévő `insights/` mappa a services alatt
- Nincs H2H adat — a user explicit kizárta

## Elfogadási kritériumok

### FootballApiClient bővítés

- [ ] Új metódus a `FootballApiClient` interfészben: `fetchTeamFixtures(teamId: number, from: string, to: string): Promise<ApiFootballResponse<ApiFootballFixture>>`
- [ ] Az implementáció az `GET /fixtures?team={teamId}&from={from}&to={to}` endpointot hívja — egyetlen kérésben adja vissza az összes versenyt (selejtező, Nations League, barátságos)
- [ ] A `from` / `to` paraméterek `YYYY-MM-DD` formátumú stringek
- [ ] Unit teszt: helyes URL felépítés ellenőrzése (`/fixtures?team=X&from=Y&to=Z`)

### Típusdefiníciók

- [ ] Új fájl: `packages/backend/src/services/insights/stats.types.ts`
- [ ] Exportált `TeamStats` interface:
  ```typescript
  interface TeamStats {
    readonly externalId: number;
    readonly totalMatches: number;
    readonly wins: number;
    readonly draws: number;
    readonly losses: number;
    readonly winRate: number;           // 0–1 arány
    readonly goalsScored: number;
    readonly goalsScoredPerMatch: number;
    readonly goalsConceded: number;
    readonly goalsConcededPerMatch: number;
    readonly cleanSheets: number;
    readonly cleanSheetRate: number;    // 0–1 arány
    readonly formString: string;        // pl. "WWDLW" — utolsó 5 meccs, legújabb jobbra
    readonly recentMatches: RecentMatch[];
  }
  ```
- [ ] Exportált `RecentMatch` interface:
  ```typescript
  interface RecentMatch {
    readonly date: string;              // ISO date string
    readonly competition: string;       // pl. "World Cup Qualification"
    readonly opponent: string;
    readonly goalsFor: number;
    readonly goalsAgainst: number;
    readonly result: 'W' | 'D' | 'L';
  }
  ```

### stats-collector.service.ts

- [ ] Új fájl: `packages/backend/src/services/insights/stats-collector.service.ts`
- [ ] Exportált függvény: `collectTeamStats(externalId: number): Promise<TeamStats>`
- [ ] A függvény a mai dátumtól visszaszámolja a 24 hónapos `from` dátumot (nem hardcoded — `new Date()` alapú)
- [ ] A `fetchTeamFixtures` hívás után az összes befejezett meccsből (`fixture.status.short === 'FT'` vagy `'AET'` vagy `'PEN'`) számítja a KPI-okat
- [ ] A `formString` az utolsó 5 befejezett meccset tükrözi, dátum szerint rendezve — legújabb eredmény kerül a string végére
- [ ] A `recentMatches` tömb tartalmazza az összes befejezett meccset, dátum szerint csökkenő sorrendben
- [ ] Ha nincs egyetlen befejezett meccs sem (üres vagy csak jövőbeli eredmények) → `totalMatches: 0`, `formString: ''`, `recentMatches: []` — nem dob hibát
- [ ] Ha az API 4xx/5xx-et dob → `StatsCollectionError` dobódik a hiba részleteivel — nem nyeli el
- [ ] A service nem ír DB-be — csak visszaadja a kiszámított `TeamStats` objektumot

### KPI számítási logika

- [ ] `winRate` = `wins / totalMatches` (ha `totalMatches === 0` → `0`)
- [ ] `goalsScoredPerMatch` = `goalsScored / totalMatches` (ha `totalMatches === 0` → `0`)
- [ ] `goalsConcededPerMatch` = `goalsConceded / totalMatches` (ha `totalMatches === 0` → `0`)
- [ ] `cleanSheetRate` = `cleanSheets / totalMatches` (ha `totalMatches === 0` → `0`)
- [ ] Clean sheet: az adott csapat számára 0 kapott gól az adott meccsen
- [ ] A csapat szemszöge meghatározható: ha `teams.home.id === externalId` → hazai, különben vendég

### Unit tesztek

- [ ] Teszt: vegyes eredményű fixtures response → helyes KPI-ok (`wins`, `draws`, `losses`, `winRate`, `goalsScored`, `cleanSheets`, `formString`)
- [ ] Teszt: üres fixtures response (`response: []`) → nullázott KPI-ok, üres `formString`, üres `recentMatches`, nem dob hibát
- [ ] Teszt: API hiba (HTTP 500) → `StatsCollectionError` dobódik
- [ ] Teszt: csak jövőbeli meccsek a válaszban (status `NS`) → ugyanúgy kezeli mint az üres válasz
- [ ] Teszt: kevesebb mint 5 befejezett meccs → `formString` hossza = a befejezett meccsek száma (nem pad-el)

### Opcionális debug endpoint

- [ ] `GET /api/admin/team-stats/:externalId` → meghívja a `collectTeamStats`-t és JSON-ben visszaadja az eredményt
- [ ] Az endpoint admin middleware mögött van (azonos védelemmel mint a többi `/api/admin/` route)
- [ ] Ha a `externalId` nem szám → `400 Bad Request`
- [ ] Ha az API hiba → `502 Bad Gateway` + hibaüzenet

## Output artifacts

- `packages/backend/src/services/insights/stats.types.ts`
- `packages/backend/src/services/insights/stats-collector.service.ts`
- `packages/backend/src/services/insights/stats-collector.service.test.ts`
- `packages/backend/src/services/football-api.service.ts` (bővítve)

## Nem tartalmazza

- DB írás / `match_insights` tábla (US-1301 feladata)
- AI insight generálás (US-1302)
- Cron job ütemezés (US-1303)
- Frontend megjelenítés (US-1304)
- H2H (head-to-head) adatok
- Szezon-szintű statisztikák (`/teams/statistics` endpoint) — ez US-1301 hatóköre

## Kérdések amiket a POC válaszol meg

1. A `/fixtures?team={id}&from=...&to=...` endpoint lefedi-e az összes releváns versenyt (selejtező, NL, barátságos)?
2. A `fixture.status.short` értékkészlete konzisztens-e? (FT, AET, PEN, NS stb.)
3. 24 hónap alatt egy átlagos nemzeti csapatnak hány meccse van? (Rate limit szempontból fontos US-1301-hez)
4. A `teams.home.id` / `teams.away.id` mindig egyezik-e az `external_id` értékünkkel?
5. Van-e olyan fixture ahol a `goals` mező null (pl. elhalasztott, de FT státuszú meccs)?

## Komplexitás

S
