---
id: PUSH-006
title: "Push feliratkozás per-böngésző kezelése (egységes lista + 'kikapcsolás mindenhol')"
priority: Should Have
status: Open
dependencies: ["PUSH-001"]
complexity: L
epic: E15 – Értesítések (webpush)
---

# PUSH-006: Push feliratkozás per-böngésző kezelése

## Leírás

Mint **felhasználó**, szeretném, hogy **a profil push panelén egységes listában lássam az összes aktív feliratkozásomat (a jelenleg használt böngészőm kiemelve), és böngészőnként tudjam ki/bekapcsolni vagy eltávolítani a feliratkozást**, hogy **csak azokra a böngészőkre kapjak értesítéseket, amelyeken valóban engedélyt adtam, és egy másik böngészőben végzett művelet ne szüntesse meg a többi feliratkozást**.

## Jelenlegi helyzet

A PUSH-001 implementálta a globális `users.push_enabled` flag-et és a per-böngésző `push_subscriptions` táblát. A profil UI csak ezt az egy globális flag-et mutatja, ezért ha A böngészőben bekapcsolja a pusht, B böngészőben az UI "be van kapcsolva" állapotot mutat, de B-nek nincs aktív feliratkozása. Az egyedüli megoldás (B-ben ki + bekapcsol) szétdobja A feliratkozását.

## Tervezési döntések

- **Egységes lista UI**: nincs külön "fő toggle", a jelenlegi böngésző a lista első sora "Jelenlegi" badge-dzsel és inline akciókkal. Ha a jelenlegi böngészőnek nincs aktív feliratkozása, a lista tetején egy "Engedélyezés ebben a böngészőben" CTA jelenik meg.
- **Confirm modal minden törléshez**: egy böngésző eltávolítása és a "Kikapcsolás minden böngészőben" akció is megerősítő modalt mutat (UX-005 optimista törlés tudatos eltérése: a sub-ok visszaállíthatatlan szerver-állapotot érintenek).
- **Master flag belül megmarad**: `users.push_enabled` továbbra is master gate a `webpush.service.sendToUser()`-ben (PUSH-001 szerint). A UI nem mutatja közvetlenül; backend automatikusan szinkronizálja: új subscribe → `true`, utolsó device törlése → `false`, "kikapcsolás mindenhol" → `false`.
- **Backwards compatibility**: a meglévő `GET /api/push/status` válaszában a `pushEnabled` és `activeSubscriptions` mezők szemantikája NEM változik (admin oldal és régi kliensek továbbra is működnek). Új mezőkkel bővül.
- **Current device azonosítás frontend-side**: a frontend a saját `pushManager.getSubscription().endpoint`-ját veti össze a `GET /devices` válaszával. A backend nem ismeri, melyik a "current".
- **User-Agent parse a backenden** `ua-parser-js`-szel.

## Elfogadási kritériumok

### Frontend

1. **Egységes eszköz-lista a profil push paneljén**
   - A meglévő `bg-white rounded shadow p-6` kártyán belül egy `PushDeviceList` komponens vagy inline szekció.
   - Header: cím (`profile.pushTitle`) + leírás (`profile.pushDesc`).
   - Ha a jelenlegi böngészőnek **nincs** aktív sub-ja (Notification permission granted vagy default állapot):
     - Felül egy CTA gomb: "Engedélyezés ebben a böngészőben" (`profile.pushEnableHere`).
     - A gomb permission promptot indít, majd subscribe-ol.
   - Ha permission `denied`: figyelmeztető szöveg (meglévő `profile.pushPermissionDenied`).
   - Ha unsupported: figyelmeztető szöveg (meglévő `profile.pushUnsupported`).
   - **Lista** (csak a `deletedAt IS NULL` sorok), soronként:
     - Olvasható böngésző-név (pl. "Chrome (macOS)", "Safari (iPhone)").
     - "Jelenlegi" badge ha az endpoint megegyezik a frontend `getCurrentDeviceEndpoint()` által visszaadottal. A jelenlegi sor halvány kék háttér (`bg-blue-50`), max 1 ilyen sor.
     - `Hozzáadva: <createdAt>` + `Utolsó értesítés: <lastUsedAt>` (ha `null` → "Még nem érkezett értesítés").
     - Eltávolítás gomb (×, `aria-label` kötelező). Min 44×44 px touch target.
   - Ha a lista üres ÉS a jelenlegi böngészőnek sincs sub-ja: empty state szöveg (`profile.pushDevicesFirstUse`): "Engedélyezd a push értesítéseket, hogy ne maradj le egy meccsről sem."
   - Lista alatt link-stílusú akció: "Kikapcsolás minden böngészőben" (`profile.pushDisableAll`). Csak akkor jelenik meg, ha legalább 1 aktív sub van.

2. **Egy böngésző eltávolítása**
   - × gomb kattintás → confirm modal: "Eltávolítod ezt a böngészőt? Ezen a böngészőn nem fogsz több értesítést kapni." (`profile.pushRemoveConfirm*`)
   - Confirm után: `DELETE /api/push/devices/:id`.
   - Sikeres válasz: a sor eltűnik a listából, sikeres toast (`profile.pushDeviceRemoved`).
   - Ha a saját (jelenlegi) böngészőt távolítja el: lokálisan is `pushSubscription.unsubscribe()` és a CTA megjelenik újra.
   - Hibakezelés: hibatoast a meglévő hibaüzenet konvenció szerint, lista nem változik.

3. **"Kikapcsolás minden böngészőben"**
   - Link kattintás → confirm modal: "Egyik böngésződben sem fogsz több értesítést kapni. Bármikor visszakapcsolhatod." (`profile.pushDisableAllConfirm*`)
   - Confirm után: `POST /api/push/disable-all`.
   - A frontend lokálisan is `unsubscribe()`-ol (ha van saját sub).
   - Lista kiürül, CTA visszajön (ha permission még granted).

4. **i18n kulcsok (hu/en)**
   - `profile.pushEnableHere` — hu: "Engedélyezés ebben a böngészőben" / en: "Enable in this browser"
   - `profile.pushCurrentBadge` — hu: "Jelenlegi" / en: "Current"
   - `profile.pushAddedAt` — hu: "Hozzáadva" / en: "Added"
   - `profile.pushLastNotified` — hu: "Utolsó értesítés" / en: "Last notification"
   - `profile.pushNeverNotified` — hu: "Még nem érkezett értesítés" / en: "No notifications yet"
   - `profile.pushRemoveDevice` — hu: "Eltávolítás" / en: "Remove"
   - `profile.pushRemoveConfirmTitle` — hu: "Böngésző eltávolítása" / en: "Remove browser"
   - `profile.pushRemoveConfirmBody` — hu: "Ezen a böngészőn nem fogsz több értesítést kapni." / en: "You won't receive notifications on this browser anymore."
   - `profile.pushDisableAll` — hu: "Kikapcsolás minden böngészőben" / en: "Disable in all browsers"
   - `profile.pushDisableAllConfirmTitle` — hu: "Kikapcsolás mindenhol" / en: "Disable everywhere"
   - `profile.pushDisableAllConfirmBody` — hu: "Egyik böngésződben sem fogsz több értesítést kapni. Bármikor visszakapcsolhatod." / en: "You won't receive notifications in any browser. You can re-enable any time."
   - `profile.pushDevicesFirstUse` — hu: "Engedélyezd a push értesítéseket, hogy ne maradj le egy meccsről sem." / en: "Enable push notifications so you don't miss any match."
   - `profile.pushDeviceRemoved` — hu: "Böngésző eltávolítva" / en: "Browser removed"
   - `profile.pushAllDisabled` — hu: "Minden feliratkozás eltávolítva" / en: "All subscriptions removed"
   - `profile.pushNotifiedRelative` (helper formátum) — relatív idő, pl. "2 napja", "1 órája" (a meglévő relatív idő helperek használhatók)
   - `common.cancel`, `common.remove`, `common.disable` — meglévő vagy új közös kulcsok

5. **A11y**
   - A lista `role="list"`, sorok `role="listitem"`.
   - "Jelenlegi" badge `aria-label="Jelenleg használt böngésző"`.
   - Eltávolítás gomb `aria-label` a böngésző nevével ("Chrome (macOS) eltávolítása").
   - Modal: `role="dialog"`, `aria-modal="true"`, focus trap, ESC zár, az első fókusz a Cancel gombon.
   - Touch targetek min 44×44 px.

6. **Frontend helper bővítés**
   - `packages/frontend/src/lib/push.ts`:
     - `getCurrentDeviceEndpoint(): Promise<string | null>` (a meglévő `getCurrentSubscription().endpoint` wrapper-e).
   - `packages/frontend/src/api/index.ts` — új wrapper-ek:
     - `api.push.listDevices(token)` → `GET /api/push/devices`
     - `api.push.removeDevice(token, deviceId)` → `DELETE /api/push/devices/:id`
     - `api.push.disableAll(token)` → `POST /api/push/disable-all`

### Backend

7. **`GET /api/push/devices` (új, authMiddleware)**
   - Csak a request user `deletedAt IS NULL` sub-jait listázza.
   - Response: `{ devices: Array<{ id: string, browserName: string, createdAt: string, lastUsedAt: string | null }> }`
   - **Nem** ad vissza `endpoint`-ot publikusan (privacy: az FCM/Mozilla URL-ek tokenezettek). Az `id` (UUID) elég a törléshez.
   - **Nem** ad vissza `isCurrentDevice` mezőt — frontend feladata az endpoint-egyezés.
   - Várj, korrekció: a frontend nem kapja meg az endpoint-ot, így nem tud egyezést keresni. **Megoldás**: vagy az `endpoint` is része a response-nak (csak a saját user-é, ennyire nem érzékeny), vagy egy `endpointHash` (SHA-256(endpoint), 16 karakter prefix) amit a frontend a saját endpoint-jából is ki tud számolni. **Választás: `endpoint` mező a response-ban** — egyszerűbb, és a user a saját endpoint-jait amúgy is ismeri. Marad: `{ id, endpoint, browserName, createdAt, lastUsedAt }`.
   - `browserName` parse: `ua-parser-js`-szel a `userAgent` mezőből; fallback `"Ismeretlen böngésző"` (en: `"Unknown browser"`) — a backend angolul adja vissza, frontend i18n nem szükséges (UA parser output amúgy sem fordítható). Empty/null UA → fallback.

8. **`DELETE /api/push/devices/:id` (új, authMiddleware)**
   - Csak a request user saját sub-ját törli (owner check); idegenre 404.
   - Soft delete: `deletedAt = now()`. Idempotens: ha már törölve, 200 + no-op.
   - Ha az utolsó aktív sub volt → ugyanabban a tranzakcióban `users.push_enabled = false`. **Kötelező** (nem opcionális).
   - Response: `{ success: true, remainingDevices: number, pushEnabled: boolean }`.

9. **`POST /api/push/disable-all` (új, authMiddleware)**
   - A request user összes aktív `push_subscriptions` sorának `deletedAt = now()`.
   - `users.push_enabled = false`.
   - Egy tranzakcióban.
   - Response: `{ success: true }`.

10. **`POST /api/push/subscribe` módosítás**
    - A meglévő upsert működik (PUSH-001 szerint `onConflictDoUpdate` + `deletedAt: null`).
    - **Új viselkedés**: ha a user `push_enabled = false`, állítsa `true`-ra ugyanabban a tranzakcióban. Indok: különben a `webpush.service.sendToUser()` line 129-en silent skipel; a user új böngészőben subscribe-olt, mégsem kap pusht.

11. **`GET /api/push/status` bővítése (backwards compatible)**
    - Meglévő mezők szemantikája **változatlan**: `pushEnabled` (master flag), `activeSubscriptions` (count).
    - Új mezők: `totalDevices: number` (= `activeSubscriptions`, alias jövőbeli kiterjesztéshez), `hasCurrentDevice: boolean` (a backend itt sem ismeri a current-et — ez a mező marad ki, helyette a frontend a `listDevices` válaszából + a saját endpoint-jából deriválja).
    - **Korrekció**: a `status` endpoint-ot nem kell új mezőkkel bővíteni. A frontend így használja:
      - `GET /api/push/status` — a `pushEnabled` és `activeSubscriptions` továbbra is releváns admin oldalra és belső gate-ekre.
      - `GET /api/push/devices` — a profil panel ebből renderel mindent.
    - **Döntés**: `status` endpoint **változatlan marad**. Csak az új `devices` endpoint kerül bevezetésre.

12. **Service réteg**
    - Új függvények a `packages/backend/src/services/push.service.ts`-ben:
      - `listDevices(userId): Promise<DeviceDto[]>`
      - `removeDevice(userId, deviceId): Promise<{ remainingDevices: number, pushEnabled: boolean }>`
      - `disableAll(userId): Promise<void>`
    - A `subscribe()` (meglévő) bővítése a `push_enabled = true` upsert-tel.
    - UA parser helper: `packages/backend/src/services/user-agent.service.ts` (új), `parseBrowserName(ua: string | null): string`.

13. **Tesztek**
    - Backend unit: `listDevices` (csak aktívak, csak saját, parse-eli a UA-t).
    - Backend unit: `removeDevice` happy path + idempotens + utolsó device → flag=false + foreign user → not-found.
    - Backend unit: `disableAll` happy path + üres lista + flag=false utána.
    - Backend unit: `subscribe` flag re-aktiválás (`push_enabled` false → true).
    - Backend unit: `parseBrowserName` (Chrome/Safari/Firefox/Edge variációk + null/üres fallback).
    - Backend integration (route-szint): authMiddleware, owner check, payload validáció.
    - Frontend (ha Vitest+Vue Test Utils elérhető): `PushDeviceList` komponens render + interakció. **Ha nem konfigurált**: csak Playwright E2E.
    - Playwright E2E: profil → permission grant → device megjelenik → eltávolítás → CTA visszajön.
    - Playwright E2E: két browser context, mindkettő subscribe-ol → A-ban látszik B sora is → A "disable all"-t hív → B-ben empty state.

## Technikai megjegyzések

### Frontend: jelenlegi endpoint összevetés

```typescript
// packages/frontend/src/lib/push.ts
export async function getCurrentDeviceEndpoint(): Promise<string | null> {
  if (!('serviceWorker' in navigator)) return null
  const reg = await navigator.serviceWorker.ready
  const sub = await reg.pushManager.getSubscription()
  return sub?.endpoint ?? null
}

// View komponensben:
const currentEndpoint = await getCurrentDeviceEndpoint()
const devicesWithCurrent = devices.map(d => ({
  ...d,
  isCurrent: d.endpoint === currentEndpoint,
}))
```

### Backend: UA parser

Új dependency: `ua-parser-js` (~25KB, backend-only, nem érinti frontend bundle-t).

```typescript
import { UAParser } from 'ua-parser-js'

export function parseBrowserName(ua: string | null): string {
  if (!ua) return 'Unknown browser'
  const parser = new UAParser(ua)
  const browser = parser.getBrowser().name
  const os = parser.getOS().name
  if (!browser) return 'Unknown browser'
  return os ? `${browser} (${os})` : browser
}
```

### Idempotencia és race conditions

- `DELETE /devices/:id`: ha már `deletedAt IS NOT NULL`, no-op + 200. Két tab egyszerre törlés → mindkettő 200, második no-op.
- `POST /subscribe`: az `onConflictDoUpdate` + `deletedAt: null` reset továbbra is OK; a flag re-aktiválás ugyanabban a tranzakcióban.
- Concurrent toggle ugyanazon böngészőből: az endpoint-szintű idempotencia elég, atomikus state machine post-MVP.

### Modal komponens

A projektben jelenlegileg nincs reusable confirm modal komponens (ellenőrzés szükséges). Ha nincs: új `ConfirmModal.vue` komponens hozhat létre a `packages/frontend/src/components/`-ben (props: `title`, `body`, `confirmLabel`, `cancelLabel`, `variant: 'default' | 'danger'`, emit: `confirm`, `cancel`). Reusable más helyeken is.

### Implementációs sorrend

1. **Fázis 1 — backend**: UA parser service + service réteg + új route-ok + tesztek. Subscribe flag re-aktiválás. Egy PR.
2. **Fázis 2 — frontend**: `api/index.ts` wrapper-ek, `lib/push.ts` helper, ConfirmModal komponens (ha kell), `ProfileView.vue` push szekció refaktor, i18n kulcsok. Egy PR vagy a backenddel közös.
3. **Fázis 3 — verification**: Playwright E2E + manuális smoke (két böngésző) + admin broadcast regressziós ellenőrzés.

## Kizárások

- Custom device név / alias.
- Per-device granular notification preferences (pl. "csak meccs reminder").
- Per-device mute/silence külön az eltávolítástól.
- Geolocation, device-type ikon (mobil/tablet/desktop) — csak `ua-parser-js` szöveges output.
- "Optimistic delete + Undo" pattern — ezen a story-n confirm modal a választott UX (UX-005-től tudatos eltérés).
- Quiet hours / rate-limit állapot UI-ban való kommunikálása (külön nice-to-have).
- Cascade-érintés user soft-delete-nél (külön tisztítandó, nem ennek a story-nak része).
