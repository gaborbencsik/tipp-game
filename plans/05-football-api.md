# VB Tippjáték – Futball API kutatás és döntés

> US-1201 kutatási dokumentum | Dátum: 2026-04-03

---

## 1. Összefoglaló döntés

**Választott API: api-football.com (api-sports.io)**

**Indoklás:**
- Egyetlen, olcsó tier ($19/hó Pro) lefedi az összes szükséges ligát
- Magyar **NB I** elérhető mindkét tier-en
- Free tier (100 req/nap) elegendő fejlesztéshez és alacsony forgalmú teszteléshez
- Fixture response struktúra könnyen térképezhető a meglévő Drizzle schemára
- Közvetlen elérés (nem RapidAPI-n át) — nincs extra overhead
- NB II is elérhető (Nice to Have — US-1204)

---

## 2. Döntési mátrix

| Szempont | **api-football.com** | football-data.org | apifootball.com | Sportmonks |
|----------|---------------------|-------------------|-----------------|-----------|
| Magyar NB I | ✅ | ✅ (€49+/hó) | ✅ (paid) | ✅ (paid) |
| Magyar NB II | ✅ | ❌ nincs | ✅ (paid) | ✅ (Enterprise) |
| FIFA World Cup 2026 | ✅ | ✅ | ✅ (paid) | ✅ (paid) |
| UEFA Nations League | ✅ | ✅ (paid) | ✅ (paid) | ✅ (paid) |
| Internacionális barátságos | ✅ | ⚠️ részleges | ✅ (paid) | ✅ (paid) |
| Free tier | 100 req/nap | 12 liga, 10 req/perc | 2 liga (CH + L2) | ❌ 14 nap trial |
| Legolcsóbb all-in | **$19/hó** | €49/hó | $42/hó | €99/hó |
| Live scores | ✅ minden tier-en | €12/hó addon | ✅ | ✅ (paid) |
| Auth módszer | Header: `x-apisports-key` | Header: `X-Auth-Token` | Query param: `APIkey=` | Query param / Bearer |
| Dokumentáció minőség | Jó | Jó | Közepes | Jó |

### Miért esett ki football-data.org?
A Magyar NB II-t **egyetlen tier-en sem** fedezi — kizáró feltétel, mivel a tesztelési stratégia az NB II subset-re épül.

### Miért esett ki Sportmonks?
A legolcsóbb érdemi tier (Pro, €249/hó) túl drága, és a Hungarian ligák elérhetősége a leagek számának korlátja miatt bizonytalan az olcsóbb tier-eken.

---

## 3. Hozzáférési adatok

### Közvetlen API-Sports elérés (ajánlott)

```
Base URL: https://v3.football.api-sports.io
Auth:     x-apisports-key: YOUR_API_KEY   (request header)
```

### RapidAPI elérés (alternatíva, nem ajánlott prod-ra)

```
Base URL: https://api-football-v1.p.rapidapi.com/v3
Auth:     x-rapidapi-key: YOUR_KEY
          x-rapidapi-host: api-football-v1.p.rapidapi.com
```

---

## 4. Szükséges endpointok

| Cél | Method + Path | Fontosabb query paraméterek |
|-----|---------------|----------------------------|
| Liga lista keresés | `GET /leagues` | `country=Hungary` / `type=league` |
| Csapatok listája | `GET /teams` | `league=271&season=2026` |
| Szezon mérkőzések | `GET /fixtures` | `league=271&season=2026&status=NS` |
| Befejezett meccsek | `GET /fixtures` | `league=271&season=2026&status=FT` |
| Élő meccsek | `GET /fixtures` | `live=all` |
| Egy meccs részlet | `GET /fixtures` | `id=FIXTURE_ID` |
| WC 2026 meccsek | `GET /fixtures` | `league=1&season=2026` |
| Válogatott barátságos | `GET /fixtures` | `league=10&season=2026` |
| UEFA Nations League | `GET /fixtures` | `league=5&season=2024` |

### Meccs státusz kódok (API-Football → saját match_status leképezés)

| API-Football `status.short` | Leírás | Saját MatchStatus |
|-----------------------------|--------|------------------|
| `NS` | Not Started | `scheduled` |
| `1H`, `HT`, `2H`, `ET`, `P`, `LIVE` | Folyamatban | `live` |
| `FT`, `AET`, `PEN` | Befejezett | `finished` |
| `CANC`, `SUSP`, `ABD`, `AWD`, `WO` | Törölve/Elhalasztva | `cancelled` |

---

## 5. Liga ID-k

> ⚠️ Az alábbi ID-k a kutatás alapján várható értékek. Implementáció előtt **kötelező verifikálni** a `GET /leagues?country=Hungary` hívással a saját API key-jel.

| Liga | Ország | Várható league_id | Szezon param |
|------|--------|------------------|--------------|
| FIFA World Cup 2026 | World | **1** | `2026` |
| UEFA Nations League B | World | **5** (verify) | `2024` |
| Internacionális barátságos (válogatott) | World | **10** (verify) | aktuális év |
| Magyar NB I (Nemzeti Bajnokság I) | Hungary | **271** (verify) | `2025` |
| Magyar NB II (Nice to Have — US-1204) | Hungary | **272** (verify) | `2025` |

### Verifikálási parancs (bash, az API key megszerzése után)

```bash
curl -s "https://v3.football.api-sports.io/leagues?country=Hungary" \
  -H "x-apisports-key: YOUR_KEY" | jq '.response[] | {id: .league.id, name: .league.name, type: .league.type}'
```

---

## 6. Fixture response struktúra

A releváns mezők és a saját schema leképezése:

```json
{
  "fixture": {
    "id": 215662,
    "date": "2026-06-11T18:00:00+00:00",
    "timestamp": 1749664800,
    "status": {
      "long": "Not Started",
      "short": "NS",
      "elapsed": null
    },
    "venue": {
      "id": 556,
      "name": "SoFi Stadium",
      "city": "Los Angeles"
    }
  },
  "league": {
    "id": 1,
    "name": "FIFA World Cup",
    "country": "World",
    "season": 2026,
    "round": "Group Stage - 1"
  },
  "teams": {
    "home": {
      "id": 6,
      "name": "Brazil",
      "logo": "https://media.api-sports.io/football/teams/6.png",
      "winner": null
    },
    "away": {
      "id": 24,
      "name": "Argentina",
      "logo": "https://media.api-sports.io/football/teams/24.png",
      "winner": null
    }
  },
  "goals": { "home": null, "away": null },
  "score": {
    "halftime": { "home": null, "away": null },
    "fulltime": { "home": null, "away": null },
    "extratime": { "home": null, "away": null },
    "penalty": { "home": null, "away": null }
  }
}
```

### Leképezés a saját Drizzle schemára

| API-Football mező | Saját tábla / mező |
|-------------------|--------------------|
| `fixture.id` | (külső referencia, nem tárolva vagy opcionálisan `external_id` kolumn) |
| `fixture.date` | `matches.scheduled_at` |
| `fixture.status.short` | `matches.status` (státusz map fent) |
| `fixture.venue.name` | `venues.name` |
| `fixture.venue.city` | `venues.city` |
| `league.round` | `matches.group_name` (group stage round info) |
| `teams.home.id` | → lookup `teams` tábla by external_id |
| `teams.away.id` | → lookup `teams` tábla by external_id |
| `score.fulltime.home` | `match_results.home_goals` |
| `score.fulltime.away` | `match_results.away_goals` |
| `teams.home.name` | `teams.name` |
| `teams.home.logo` | `teams.flag_url` |
| `teams.home.id` (API id) | `teams.short_code` (kell external_id mező — ld. US-1202) |

---

## 7. Rate limit és kvóta stratégia

### Tier összehasonlítás

| Tier | Ár/hó | Req/nap | Mikor szükséges |
|------|-------|---------|-----------------|
| Free | $0 | 100 | Fejlesztés, tesztelés, NB II subset |
| Pro | $19 | 7,500 | MVP (VB 2026 alatt, live meccsek) |
| Ultra | $29 | 75,000 | Ha nagyobb igény mutatkozik |

---

## 7a. FOOTBALL_SYNC_MODE – Szinkronizációs mód env változó

A cron job viselkedése `FOOTBALL_SYNC_MODE` env változóval hangolható. Ez lehetővé teszi, hogy fejlesztés közben, teszteléskor vagy éles VB alatt eltérő API-kvótát használjunk, és az admin döntsön az eredményfrissítés sűrűségéről.

### Értékek

| `FOOTBALL_SYNC_MODE` | Leírás | Cron futás | API hívás / nap (becslés) |
|----------------------|--------|------------|--------------------------|
| `off` | Teljes szinkron letiltva (fejlesztés, CI) | — | 0 |
| `final_only` | Csak meccs vége után kérdez le eredményt; nem követ live státuszt | 5 percenként; csak `FT`/`AET`/`PEN` figyel | ~20–40 |
| `adaptive` | Live meccs alatt 2 percenként frissít, egyébként ritka daily sync | 1 percenként (a döntési logika belül van) | ~100–300 |
| `full_live` | Minden live meccs percenként frissítve, legkisebb latencia | 1 percenként, minden `live=all` kérés | ~90 × concurrent_matches |

**Alapértelmezés ha nincs beállítva:** `adaptive`

### Mód részletei

#### `off`
- Semmilyen API hívás nem történik
- A cron job elindul, logol, de azonnal visszatér
- Hasznos: CI, unit tesztelés, local dev API key nélkül

#### `final_only`
- A cron 5 percenként fut és megnézi: van-e `live` státuszú meccs a DB-ben, aminek az API-n már `FT`/`AET`/`PEN` státusza van
- Ha igen: lezárja a meccset és elmenti a végeredményt
- **Nem követ** halftime, elapsed, részeredményt
- Legjobb: korlátozott API kvóta, NB II tesztelés, stageing
- `GET /fixtures?id=X` — csak a konkrét live meccseket kérdezi le (nem `live=all`)

#### `adaptive` (ajánlott prod-ra MVP alatt)
- Nincs live meccs ÉS nincs scheduled < 24h → naponta 1x teljes fixture sync (< 5 req)
- Van scheduled < 24h, de nincs live → 10 percenként fixture status check
- Van live meccs → 2 percenként `GET /fixtures?live=all`
- Meccs `live` → `finished` átmenet → azonnal végeredmény mentés

#### `full_live`
- Minden percben `GET /fixtures?live=all`, függetlenül a DB állapottól
- Minimum latencia az eredményeknél
- Csak Pro tier-rel ($19/hó) fenntartható VB alatt (párhuzamos meccsek esetén)

### Env változó és `.env.example` kiegészítés

```bash
# Szinkronizációs mód (off | final_only | adaptive | full_live)
# Alapértelmezett: adaptive
# - off:         nincs API hívás (fejlesztés, CI)
# - final_only:  csak végeredmény, nincs live követés (~20-40 req/nap)
# - adaptive:    live alatt 2 percenként, egyébként ritka (~100-300 req/nap)
# - full_live:   minden percben live lekérdezés (max kvóta)
FOOTBALL_SYNC_MODE=final_only
```

### Implementációs iránymutatás (US-1202/US-1203-hoz)

A `sync.job.ts`-ben a belépési pontnál:

```typescript
type SyncMode = 'off' | 'final_only' | 'adaptive' | 'full_live'

function getSyncMode(): SyncMode {
  const val = process.env['FOOTBALL_SYNC_MODE'] ?? 'adaptive'
  if (['off', 'final_only', 'adaptive', 'full_live'].includes(val)) {
    return val as SyncMode
  }
  return 'adaptive'
}
```

A `decideWhatToSync(dbState, mode)` pure függvény a DB állapot + mode alapján adja vissza a szinkron műveletek listáját — unit tesztelhető DB és API hívás nélkül.

---

### Adaptív cron döntési logika (részletes, `adaptive` módhoz)

```
DB állapot               → API hívások         → Becsült req/nap
─────────────────────────────────────────────────────────────────
Van live meccs           → /fixtures?live=all  → ~90 (1/perc × 90 perc)
Van scheduled < 24h      → /fixtures (szűrt)   → ~144 (1/10 perc)
Csak távoli scheduled    → napi full sync       → ~5-10
Nincs meccs              → skip                → 0
```

### Free tier elegendősége teszteléshez

Az NB II-ben tipikusan 10-16 csapat van, hetenként ~8-10 forduló meccs. Egy szezon-importhoz:
- `GET /fixtures?league=272&season=2025` → 1 kérés (~300 meccs az egész szezonra)
- `GET /teams?league=272&season=2025` → 1 kérés
- Összesen: **~5-10 req/nap** a tesztelési fázisban — a 100 req/nap free limiten belül.

---

## 8. Env változók

Az alábbi változókat kell hozzáadni `.env.example`-be és Railway/Vercel konfig-ba:

```bash
# Football API (api-football.com / api-sports.io)
# Ingyenes key: https://dashboard.api-football.com/register
FOOTBALL_API_KEY=your_api_sports_key_here
FOOTBALL_API_BASE_URL=https://v3.football.api-sports.io

# Liga ID-k (verifikáld GET /leagues?country=Hungary hívással!)
FOOTBALL_API_WC_LEAGUE_ID=1
FOOTBALL_API_NBI_LEAGUE_ID=271
FOOTBALL_API_NBII_LEAGUE_ID=272
```

---

## 9. Szinkronizációs terv (POC validálás után)

> A POC igazolta (2022-es szezonnal): 1 kérés/liga = teljes fixture lista (64 WC, 198 NB I), 1 kérés/liga = összes csapat+venue.

### 9a. Szükséges endpointok és fedettség

| # | Endpoint | Params | Mit ad vissza | Hívás/szezon |
|---|----------|--------|---------------|--------------|
| 1 | `GET /teams` | `league, season` | Csapatok + venue (1 response = összes) | **1** |
| 2 | `GET /fixtures` | `league, season` | Összes meccs + eredmény + venue + round | **1** |
| 3 | `GET /fixtures` | `live=all` | Élő meccsek frissítése | per-poll |
| 4 | `GET /players/squads` | `team=X` | Keret (név, pozíció, szám) | 1/csapat |

**WC + NB I teljes import = 4 kérés.** A `/fixtures` response tartalmazza az eredményeket is — nincs külön results endpoint.

### 9b. Frissítési stratégia

| Szituáció | Endpoint | Gyakoriság | ~Req/nap |
|-----------|----------|------------|----------|
| Szezon eleje (egyszeri) | `/teams` + `/players/squads` | 1× | 2 + 32 + 12 = 46 |
| Napi fixture sync | `/fixtures?league=X&season=Y` | 1×/nap | 2 |
| Live meccs frissítés | `/fixtures?live=all` | 1-2 percenként | ~90/meccs |
| Meccs végi eredmény | — (fixture response-ból jön) | — | 0 |
| Játékos keret frissítés | `/players/squads?team=X` | heti 1× | 44 |

### 9c. API kvóta kalkuláció (Pro, 7500 req/nap)

| Forgatókönyv | Req/nap |
|--------------|---------|
| Hétköznap, nincs meccs | 2 |
| Meccsnapon (adaptive, 2 percenként) | ~90 |
| VB csúcs (full_live, 4 párhuzamos meccs) | ~360 |
| Szezon eleji teljes import (egyszeri) | ~50 |

**Bőven a 7500-as napi limit alatt minden forgatókönyvben.**

### 9d. Free tier korlát (POC tanulság)

A Free tier (100 req/nap) **csak 2022-2024 szezonokat** engedi lekérdezni. Aktuális szezon (2025, 2026) nem elérhető — Pro ($19/hó) kell hozzá. A Free tier továbbra is használható fejlesztéshez régi adatokkal (structure validáció, integration tesztek).

### 9e. Adatleképezés (validált a POC response-okból)

| API mező | Saját tábla.mező | Megjegyzés |
|----------|-----------------|------------|
| `fixture.id` | `matches.external_id` | Upsert kulcs |
| `fixture.date` | `matches.scheduled_at` | |
| `fixture.status.short` | `matches.status` | NS→scheduled, 1H/HT/2H/LIVE→live, FT/AET/PEN→finished |
| `fixture.venue.name/city` | `venues.name/city` | Venue-t a fixture-ből nyerjük ki |
| `league.round` | `matches.group_name` | "Group Stage - 1" → group mapping |
| `teams.home.id` | → `teams.external_id` lookup | |
| `teams.home.name` | `teams.name` | |
| `teams.home.code` | `teams.short_code` | 3 betűs kód (BRA, HUN, FRA) |
| `teams.home.logo` | `teams.flag_url` | |
| `goals.home/away` | `match_results.home_goals/away_goals` | Csak ha status=FT/AET/PEN |
| `score.penalty` | `match_results.outcome_after_draw` | Ha nem null → "penalties" |
| `team.national` | `teams.team_type` | true→national, false→club |

### 9f. Játékosok

A `/players/squads?team=X` endpoint csapatonként 1 kérés:
- WC 32 csapat = 32 kérés (egyszeri, szezon elején)
- NB I 12 csapat = 12 kérés
- Összesen 44 kérés — heti 1× frissítés elegendő

Szükséges a `player_select` típusú speciális tippekhez ("Ki lesz a gólkirály?").

### 9g. Schema módosítások (US-1202 előfeltétel)

1. `teams` tábla: + `external_id INTEGER UNIQUE` (api-football team ID)
2. `matches` tábla: + `external_id INTEGER UNIQUE` (api-football fixture ID)
3. `players` tábla: + `external_id INTEGER UNIQUE` (api-football player ID)
4. `match_results.recorded_by`: nullable (sync-nél nincs user) VAGY system user

---

## 10. Következő lépések (US-1202)

Az implementáció során szükséges lesz:

1. **Schema migráció** — `external_id INTEGER UNIQUE` kolumn a `teams`, `matches`, `players` táblákra
2. **`match_results.recorded_by`** — nullable vagy system user a sync-hez
3. `football-api.service.ts` — typed HTTP wrapper native fetch-szel (Node 18+), visszatérő típusok: `ApiFixture`, `ApiTeam`, `ApiSquad`
4. `sync.service.ts` — mapping + upsert logika; idempotens `ON CONFLICT DO UPDATE`

---

## 10. Hivatkozások

- API dokumentáció: https://www.api-football.com/documentation-v3
- Árazás: https://www.api-football.com/pricing
- Coverage lista: https://www.api-football.com/coverage
- Dashboard / API key igénylés: https://dashboard.api-football.com/register
