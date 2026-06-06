---
id: PUSH-009
title: Admin push címzettek részletes listája (popup)
priority: Should Have
status: Done
dependencies: [PUSH-007]
complexity: S
epic: E15 – Értesítések (webpush)
---

# PUSH-009: Admin push címzettek részletes listája

## Háttér

Az `/admin/push` oldalon jelenleg csak az **aggregált címzett-szám** látszik („Aktív címzettek (push engedélyezve, nem törölt): 3"). Az adminnak nincs lehetősége megnézni, **konkrétan kik** kapnák meg a broadcast-ot a kiválasztott szegmensben — ez fontos lehet validáláskor, hibakeresésnél, vagy ha gyanús, hogy egy szegmens nem azt találja, amit várunk.

## Story

Mint **admin**, szeretném a `/admin/push` oldalon a címzett-számláló mellett **kiklikkelni a teljes névsort** (popup vagy lenyíló), hogy **megnézzem, kik kapnák meg** a kiválasztott szegmens broadcast-ját, mielőtt elküldöm.

## Elfogadási kritériumok

### Frontend – „Részletek" gomb és popup

- [ ] A meglevő `data-testid="admin-push-targets"` szövegblokk mellett (jobbra) egy **„Részletek" gomb** jelenik meg, amíg a számláló be van töltve és > 0.
- [ ] Ha `targetCount === 0` → a gomb **ne jelenjen meg** (vagy disabled állapotban legyen, „Nincsenek címzettek" tooltippal).
- [ ] Kattintásra **modal popup** nyílik („Címzettek (szegmens neve)"):
  - Cím: pl. „Címzettek – Hiányzó torna tippek (3 felhasználó)"
  - Tartalom: scrollable lista, soronként **felhasználónév + email**
  - Loading állapot („Betöltés…") amíg a lista érkezik
  - Error állapot („Nem sikerült betölteni: <hibaüzenet>")
  - „Bezárás" gomb (és háttér + Esc is bezár)
- [ ] Ha a szegmens-rádiót átkapcsolja a felhasználó **nyitott modal mellett**, a modal automatikusan újratölt az új szegmenshez (vagy bezáródik, fejlesztő dönti).
- [ ] **A modal nem küld push-t**, csak listáz — a Küldés gomb ettől függetlenül működik.
- [ ] `data-testid` attribútumok: `admin-push-targets-details-button`, `admin-push-targets-modal`, `admin-push-targets-list`, `admin-push-targets-list-row`, `admin-push-targets-modal-close`.

### Backend – részletes lista endpoint

- [ ] **Új endpoint:** `GET /api/admin/push/targets/details?segment=<all|missing-tournament-tips|missing-today-match-tips>`
- [ ] Visszaadott shape:
  ```json
  { "segment": "all", "users": [{ "id": "...", "displayName": "Elek", "email": "elek@x.hu" }, ...] }
  ```
- [ ] Validáció: ismeretlen segment → 400 (mint a meglévő `/targets`).
- [ ] **Felelős service:** `admin-push.service.ts` új függvény `listEligibleUsersBySegment(segment): Promise<UserSummary[]>` ami a meglevő `listEligibleUserIdsBySegment` mintáját követi, csak `displayName + email`-t is visszaad.
- [ ] **Sorrendezés:** ABC szerint `displayName` (NULL utolsónak), majd email. A nagy lista (>200 fő) MVP-ben nem kerül lapozásra — a 2026 VB-n a max user-szám várhatóan elfér 1 modálban.
- [ ] **Privacy:** csak admin role férhet hozzá (a meglévő admin middleware lánc miatt automatikusan).

### Tesztek

- [ ] **Service teszt** `admin-push.service.test.ts` bővítés: `listEligibleUsersBySegment` mind a 3 szegmensre — visszaadja a `displayName + email` mezőket, sorrendezve.
- [ ] **Route teszt** `admin-push.routes.test.ts` bővítés: `GET /admin/push/targets/details` átadja a segmentet, 400 invalid segment-re.
- [ ] **Frontend nem kötelező** komponens-teszt — az `AdminPushView`-ra most sincs (PUSH-007 sem kapott), kézi teszt.

### Edge case-ek

- [ ] **0 felhasználó az adott szegmensben** → modal megnyitható ugyan (vagy a gomb el van rejtve, fejlesztő dönti), tartalom: „Nincsenek címzettek a kiválasztott szegmensben."
- [ ] **Soft-deleted user** a meglevő `isNull(deletedAt)` szűréssel kizárva — nincs változás.
- [ ] **Túl sok felhasználó (>500)** — MVP nincs lapozás, max 500 sort ad vissza, alul „… és további N rejtve" megjegyzés. A 2026 VB user-szám ezt MVP-ben nem éri el.

## Kizárások (post-MVP, külön story)

- A felhasználói sor mellett **„kihagy"** gomb (a kiválasztott szegmensből a konkrét usert kizárja).
- Lapozás / lazy load nagy listához.
- CSV/JSON export.
- Push log historikus listája user szerint („Mit kapott eddig?").

## Technikai megjegyzések

- A `listEligibleUserIdsBySegment` átalakítható úgy, hogy egy közös belső `eligibleUsersBaseQuery(segment)` adja vissza a kondíciókat, és az ID-only + a teljes-row variánsok azon osztoznak.
- A modal a meglévő frontend-stílushoz illeszkedjen (Tailwind, mint pl. a `confirm modal` mintája — hierarchikusan a `AdminPushView.vue` saját komponens-fájlja vagy egy közös `Modal.vue` ha van).
- Ha a frontendben nincs még generikus Modal komponens: ez a story használja az inline `<dialog>` HTML elemet (browser-natív, ESM nélkül), egyszerű és accessible.

**Komplexitás:** S
**Prioritás:** Should Have
