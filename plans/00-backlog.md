# VB Tippjáték – Backlog

> Utoljára frissítve: 2026-06-08 (SCORER-002 lezárult)

## Nyitott story-k

| Story ID | Cím | Prioritás | Függőség |
|----------|-----|-----------|----------|
| SCORER-003 | Góllövő tipp – manuális kiértékelés és pontozás integrációja | Should Have | ~~SCORER-002~~ |
| SCORER-004 | Góllövő auto-sync az api-football /fixtures/events-ből | Should Have | SCORER-003 |
| OPS-002 | Render cron service-ek konfigurálása az automatikus sync-hez (tick + polymarket + transfermarkt) | Must Have | — |
| OPS-001 | Strukturált logolás és frontend hibakezelés (MVP) | Should Have | — |
| OPS-003 | Auto-generált DB schema referencia agentnek és fejlesztőnek | Should Have | — |
| PWA-003 | PWA telepítés smart banner + onboarding integráció | Should Have | ~~PWA-002~~ |
| US-1204 | NB II liga szinkronizáció támogatás | Nice to Have | ~~US-1202~~, ~~US-1203~~ |
| US-1303 | Match Pulse – automatikus insight generálás cron jobban | Should Have | ~~US-1302~~, ~~US-1203~~ |
| US-1304 | Match Pulse – insight megjelenítése a meccs kártyán | Should Have | ~~US-1302~~, ~~US-1310~~ |
| US-1305 | Match Pulse – in-tournament statisztikák integrálása | Should Have | US-1303, US-1304 |
| US-1306 | Match Pulse – insight felfedése felhasználónként és admin reveal statisztika | Should Have | ~~US-1302~~, US-1304, ~~US-1309~~ |
| US-1307 | Match Pulse – csapat-piaci értékek megjelenítése | Should Have | US-1304, US-1306, ~~US-1406~~ |
| US-934 | Mások tippjeinek megjelenítése (speciális) | Should Have | — |
| UX-004 | Focilabda kurzor ikon | Nice to Have | — |
| UX-005 | Optimista törlés az admin listákon | Should Have | — |
| UX-013 | Értesítési rendszer (notification bell + panel) | Nice to Have | — |
| UX-016 | Kedvenc csapat dupla pont jelzés a meccs kártyán | Should Have | — |
| UX-020 | Onboarding overlay átalakítása mockup alapján – 5 lépés | Should Have | — |
| UX-021 | Döntés a speciális tippek tab sorsáról (törlés vagy újra-aktiválás) | Should Have | — |
| UX-022 | Torna tippek kitöltöttsége az admin statisztikákban | Should Have | UX-021 |
| UX-029 | Pontozási szabályzat modal – polished error state | Nice to Have | ~~UX-028~~ |
| SEC-002 | HMAC-aláírt meghívó URL-ek | Nice to Have | — |

> UX-019 felülírva — UX-020 implementálja a frissített, mockup-alapú 5 lépéses onboardingot.

---

**Haladás: 151 / 172 story kész** — Must Have: 31/32, Should Have: 120/134, Nice to Have: 0/5 (US-937, PUSH-003 won't do)
