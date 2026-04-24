# Changelog (2026-04-10 – 2026-04-24)

## Csoport kezelés

- **US-604-A** — Csoport tagkezelés: tagok listázása, eltávolítás, admin jog adása/visszavonása
- **US-604-B** — Meghívó kód kezelés: kód megjelenítés, link másolás, aktiválás/deaktiválás, újragenerálás
- **US-604-C** — Csoport törlése: megerősítő dialógussal, soft delete

## Pontrendszer

- **US-402** — Konfigurálható pontrendszer: admin UI a globális pontértékek beállításához
- **US-608** — Csoport szintű pontrendszer override: csoportadmin saját pontértékeket állíthat, a csoport ranglista ezt használja

## Stat tippek (csoport szintű)

- **US-901-A** — DB: `groupId` FK a `special_prediction_types` táblára
- **US-901-B** — Backend: stat tipp típus CRUD (admin létrehoz/szerkeszt/deaktivál)
- **US-901-C** — Backend: stat tipp beküldés és lekérdezés (tagok)
- **US-901-D** — Backend: kiértékelés — helyes válasz rögzítése + ékezet-normalizált pontozás (NFD)
- **US-901-E** — Backend: csoport ranglista integráció (stat pontok hozzáadva a ranglistához)
- **US-902-A** — Frontend: admin stat tipp típus kezelő UI a Beállítások tabban
- **US-902-B** — Frontend: tag stat tipp leadási UI ("Stat tippek" tab)

## UX fejlesztések

- **US-1003** — Lejátszott meccsek összecsukható szekció (collapsed by default)
- **US-806/UX-006** — Csapatlobogók + NB I klub támogatás
- **UX-007** — Lejátszott meccsek szekció a lista tetejére mozgatva
- **UX-008** — Regisztráció utáni onboarding overlay (3 lépéses bemutató, "Bemutató újranézése" menüpont)

## Landing page és waitlist

- **E13/DISC-001** — Landing page + `/app/` route prefix migráció
- **US-1103** — Email waitlist: feliratkozás mentése honeypot anti-spam védelemmel
- **US-1104** — Admin waitlist dashboard: szűrés forrás és keresés alapján
- **US-1105** — Admin waitlist CRUD: törlés + kézi hozzáadás

## Biztonság

- **SEC-001** — Row-Level Security bekapcsolása minden Supabase táblán

## Admin UX

- Összecsukható admin menü szekció a sidebarban
- Admin pill tab navigáció (Mérkőzések / Csapatok / Felhasználók / Pontrendszer / Waitlist)

## Egyéb

- **US-605** — Felhasználói rang badge a csoportok listájában
- Login után `/app/matches`-re navigál (nem a landing page-re)

---

## Tervdokumentumok

- US-903–909 story-k megírva: globális/fix stat tippek (Gólkirály, Világbajnok csapat — `team_select` inputType)
- AI insights terv + stadion banner story
- Meccsek redesign UX review story-k (UX-009–UX-013)
