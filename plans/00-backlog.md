# VB Tippjáték – Backlog

> Utoljára frissítve: 2026-06-02

## Nyitott story-k

| Story ID | Cím | Prioritás | Függőség |
|----------|-----|-----------|----------|
| OPS-002 | Render cron service konfigurálása az adaptive sync-hez | Must Have | — |
| OPS-001 | Strukturált logolás és frontend hibakezelés (MVP) | Should Have | — |
| PUSH-001 | Webpush infrastruktúra és admin trigger UI | Should Have | — |
| PUSH-002 | Push: meccs előtt 30 perccel, ha nincs tipp | Should Have | PUSH-001 |
| PUSH-003 | Push: torna tipp deadline előtt 1 nappal | Should Have | PUSH-001 |
| PUSH-004 | Push: napi első meccs előtt 1 órával (Europe/Budapest) | Should Have | PUSH-001 |
| PUSH-005 | Frequency cap és csendes órák a webpush küldéshez | Should Have | PUSH-001 |
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

**Haladás: 136 / 161 story kész** — Must Have: 31/32, Should Have: 105/124, Nice to Have: 0/5 (US-937 won't do)
