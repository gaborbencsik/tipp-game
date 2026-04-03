# VB Tippjáték – Futball API kutatás és döntés

> US-1201 kutatási dokumentum | Dátum: 2026-04-03

---

## 1. Összefoglaló döntés

**Választott API: api-football.com (api-sports.io)**

**Indoklás:**
- Egyetlen, olcsó tier ($19/hó Pro) lefedi az összes szükséges ligát
- Magyar **NB I és NB II** mindkét tier-en elérhető — ez az egyetlen API ahol az NB II is megvan
- Free tier (100 req/nap) elegendő fejlesztéshez és alacsony forgalmú teszteléshez
- Fixture response struktúra könnyen térképezhető a meglévő Drizzle schemára
- Közvetlen elérés (nem RapidAPI-n át) — nincs extra overhead

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
| Magyar NB II | Hungary | **272** (verify) | `2025` |

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

### Adaptív cron döntési logika (US-1203-hoz)

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

## 9. Következő lépések (US-1202)

Az implementáció során szükséges lesz:

1. **`teams` tábla bővítése** `external_id INTEGER` kolumnnal — az API-Football csapat ID-k tárolásához, hogy az upsert determinisztikus legyen
2. **`matches` tábla bővítése** `external_id INTEGER` kolumnnal — fixture ID tárolás, duplikálás elkerülése
3. `football-api.service.ts` — typed HTTP wrapper native fetch-szel (Node 18+), visszatérő típusok: `ApiFixture`, `ApiTeam`, `ApiLeague`
4. `sync.service.ts` — mapping + upsert logika; idempotens `ON CONFLICT DO UPDATE`

---

## 10. Hivatkozások

- API dokumentáció: https://www.api-football.com/documentation-v3
- Árazás: https://www.api-football.com/pricing
- Coverage lista: https://www.api-football.com/coverage
- Dashboard / API key igénylés: https://dashboard.api-football.com/register
