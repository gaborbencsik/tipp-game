# API-Football – Megerősített liga ID-k és POC eredmények

> Dátum: 2026-04-29 | POC script: `packages/backend/scripts/football-api-poc.ts`

## Megerősített liga ID-k

| Liga | league_id | season param | Validált |
|------|-----------|--------------|----------|
| FIFA World Cup | **1** | `2022` (Free), `2026` (Pro) | ✅ 64 fixture, 32 team |
| Magyar NB I | **271** | `2022` (Free), `2025` (Pro) | ✅ 198 fixture, 12 team |
| Magyar NB II | **272** (verify) | `2025` (Pro) | ❌ Nem tesztelve (Nice to Have) |

## Free tier korlát

A Free tier (100 req/nap) **csak 2022-2024 szezonokhoz** ad hozzáférést. Aktuális szezon (2025, 2026) → Pro ($19/hó) szükséges.

Hibaüzenet: `"Free plans do not have access to this season, try from 2022 to 2024."`

## Response struktúra quirks

1. **Venue ID néha null** — WC meccseknél a `fixture.venue.id` lehet null, de `name` és `city` mindig jön
2. **Team code** — 3 betűs (BEL, FRA, CRO), NB I-nél is van (HON, VID) — mappelhető `teams.short_code`-ra
3. **Round formátum** — `"Group Stage - 1"`, `"Regular Season - 22"` — parsolni kell stage + group_name-re
4. **Paging** — Nem paginated: 1 kérés = teljes szezon (64 WC, 198 NB I fixture)
5. **Teams endpoint venue** — A csapathoz tartozó "hazai" venue-t adja (address, capacity, surface), nem a meccs venue-ját
6. **Score struktúra** — `goals` = végeredmény, `score.fulltime` = ugyanaz, `score.penalty` = ha büntetőkkel dőlt el

## Rate limit headerek (Free tier)

```
x-ratelimit-requests-limit: 100
x-ratelimit-remaining: 95 (5 kérés után)
```

## Kvóta összefoglaló

- Teljes WC + NB I import: **4 kérés** (2 teams + 2 fixtures)
- Játékos keretimport: **44 kérés** (32 WC + 12 NB I csapat)
- Napi sync: **2 kérés** (fixtures refresh)
- Live meccskövetés: **~90 kérés/meccs** (2 percenként, 90 perc)
