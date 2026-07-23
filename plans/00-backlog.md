# VB Tippjáték – Backlog

> Utoljára frissítve: 2026-07-23 (US-959, US-960 lezárva; fókusz: US-954, US-956, UX-048, UX-049)

## 🎯 Jelenlegi fókusz

A legutóbb felvett story-k — ezek az aktív munka. Deklarált függőségeik mind KÉSZ, így egymást nem blokkolják, de van egy fájl-szintű koordináció.

| Story ID | Cím | Prioritás | Függőség | Megjegyzés |
|----------|-----|-----------|----------|------------|
| US-954 | Archivált liga esetén a torna tippek ne jelenjenek meg a mostani formában | Should Have | ~~US-940~~ | önálló |
| US-956 | Csoport pontozás kikapcsolása és csoportos recalc gomb | Should Have | ~~US-952~~ | folyamatban (uncommitted munka) |
| UX-048 | Match Detail oldalon a tippek CSV exportálása | Should Have | — | önálló |
| UX-049 | Pontozási szabályzat feature toggle — config flag-gel elrejtés | Nice to Have | ~~UX-028~~ | `LeaderboardView.vue` — US-955 kész, indítható |

## Nyitott story-k

| Story ID | Cím | Prioritás | Függőség |
|----------|-----|-----------|----------|
| NOTIF-001 | Admin announcement broadcast – in-app modal SSE push-sal és dismiss perzisztenciával | Should Have | — |
| US-1310 | Match Detail – AI-generált összefoglaló a legeredményesebb játékosokról (player_stats) | Should Have | — |
| OPS-001 | Strukturált logolás és frontend hibakezelés (MVP) | Should Have | — |
| OPS-003 | Auto-generált DB schema referencia agentnek és fejlesztőnek | Should Have | — |
| OPS-007 | Polymarket raw_payload tárolás kivezetése | Nice to Have | — |
| PWA-003 | PWA telepítés smart banner + onboarding integráció | Should Have | ~~PWA-002~~ |
| US-1204 | NB II liga szinkronizáció támogatás | Nice to Have | ~~US-1202~~, ~~US-1203~~ |
| US-1303 | Match Pulse – automatikus insight generálás cron jobban | Should Have | ~~US-1302~~, ~~US-1203~~ |
| US-1304 | Match Pulse – insight megjelenítése a meccs kártyán | Should Have | ~~US-1302~~, ~~US-1310~~ |
| US-1305 | Match Pulse – in-tournament statisztikák integrálása | Should Have | US-1303, US-1304 |
| US-1306 | Match Pulse – insight felfedése felhasználónként és admin reveal statisztika | Should Have | ~~US-1302~~, US-1304, ~~US-1309~~ |
| US-934 | Mások tippjeinek megjelenítése (speciális) | Should Have | — |
| UX-004 | Focilabda kurzor ikon | Nice to Have | — |
| UX-005 | Optimista törlés az admin listákon | Should Have | — |
| UX-013 | Értesítési rendszer (notification bell + panel) | Nice to Have | — |
| UX-020 | Onboarding overlay átalakítása mockup alapján – 5 lépés | Should Have | — |
| UX-021 | Döntés a speciális tippek tab sorsáról (törlés vagy újra-aktiválás) | Should Have | — |
| UX-022 | Torna tippek kitöltöttsége az admin statisztikákban | Should Have | UX-021 |
| UX-029 | Pontozási szabályzat modal – polished error state | Nice to Have | ~~UX-028~~ |
| UX-032 | Torna tippek – lejárt deadline után is mutassa a tippet (read-only lock) | Should Have | — |
| SEC-002 | HMAC-aláírt meghívó URL-ek | Nice to Have | — |
| US-954 | Archivált liga esetén a torna tippek ne jelenjenek meg a mostani formában | Should Have | ~~US-940~~ |
| US-956 | Csoport pontozás kikapcsolása és csoportos recalc gomb | Should Have | ~~US-952~~ |
| UX-048 | Match Detail oldalon a tippek CSV exportálása | Should Have | — |
| UX-049 | Pontozási szabályzat feature toggle — config flag-gel elrejtés | Nice to Have | ~~UX-028~~ |

> UX-019 felülírva — UX-020 implementálja a frissített, mockup-alapú 5 lépéses onboardingot.
> US-1307 felülírva — UX-030 a Match Detail oldalon (insights alatt) jeleníti meg a Transfermarkt csapatértékeket, nem a Match Pulse-ban.

---

**Haladás: 202 / 206 story kész** — Must Have: 33/33, Should Have: 169/169, Nice to Have: 0/6
