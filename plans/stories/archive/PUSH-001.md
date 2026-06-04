---
id: PUSH-001
title: "Webpush infrastruktúra és admin trigger UI"
priority: Should Have
status: Open
dependencies: []
complexity: XL
epic: E15 – Értesítések (webpush)
---

# PUSH-001: Webpush infrastruktúra és admin trigger UI

## Vezérelv

**Minél kevesebb push. Konzervatív küldés: csak akkor menjen ki, ha a usernek tényleges hiányzó tipje / lejáró határideje van és észszerű időablakban. Soha ne küldjünk megerősítő ("minden megvan") vagy redundáns push-t. Bővíthető post-MVP, ha szükséges.**

## Leírás

Mint **admin felhasználó**, szeretném, hogy **egy új `/admin/push` nézeten keresztül egyedi webes push értesítéseket tudjak küldeni kiválasztott felhasználó csoportoknak** (mindenki), hogy **azonnali komunikáció lehetséges legyen a játékosokkal**.

## Jelenlegi helyzet

A rendszerben nincs push notification infrastruktúra. A jelenlegi UX-013 polling-alapú in-app értesítéseket biztosít. Ez a story a webpush-t (Web Push API) integrálja, amely mellett az in-app értesítések továbbra is működnek.

## Elfogadási kritériumok

### Backend infrastruktúra

1. **VAPID kulcsok és konfigurálás**
   - VAPID kulcsok: `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY` env változók
   - `VAPID_SUBJECT` env változó (contact email)
   - Kulcsok (test env) az `.env.local`-ban, prod Render secrets-ben
   - `npm install web-push` csomag hozzáadva a backend-hez

2. **Push subscriptions adatbázis tábla**
   - `push_subscriptions` tábla:
     - `id` (UUID PK)
     - `user_id` (UUID FK `users.id`, NOT NULL, `ON DELETE CASCADE`)
     - `endpoint` (TEXT, NOT NULL) – Web Push API végpont
     - `auth` (TEXT, NOT NULL) – auth kulcs
     - `p256dh` (TEXT, NOT NULL) – p256dh kulcs
     - `user_agent` (TEXT) – böngésző/eszköz azonosítás
     - `created_at` (TIMESTAMPTZ DEFAULT now())
     - `last_used_at` (TIMESTAMPTZ) – utolsó sikeres push időpontja
     - `deleted_at` (TIMESTAMPTZ) – soft delete
     - **Uniqueness:** `(user_id, endpoint)` – egy user egy eszközről csak egyszer subscribe-olhat

3. **Push notification log tábla**
   - `push_notification_log` tábla (idempotencia és tracking):
     - `id` (UUID PK)
     - `user_id` (UUID FK)
     - `type` (TEXT) – `match_kickoff_reminder`, `tournament_tip_deadline`, `daily_match_review` vagy `admin_broadcast`
     - `scope_key` (TEXT, nullable) – `match_id`, `special_type_id`, `date_key` vagy broadcast azonosító
     - `endpoint` (TEXT, nullable) – ha sikeres push: mely subscription végpontra
     - `sent_at` (TIMESTAMPTZ DEFAULT now())
     - `clicked_at` (TIMESTAMPTZ, nullable) – ha user rákattintott az értesítésre
     - `skipped_reason` (TEXT, nullable) – ha skip: `quiet_hours`, `rate_limit`, `push_disabled`, `no_subscription`
     - Unique constraint: `UNIQUE(user_id, type, scope_key)` – garantálja egyedi log per user/trigger

4. **Push opt-out profil oldalon**
   - `users.push_enabled` (BOOLEAN DEFAULT TRUE)
   - Profil/Settings oldalon toggle: „Push értesítések" – be/ki (data-testid: `profile-push-toggle`)
   - Ha kikapcsol: backend `webpush.service.ts` `sendToUser()` skip-pel a `push_enabled = false` user-eknél (silent skip + log `skipped_reason = 'push_disabled'`)
   - NE törlünk subscription-öket kikapcsoláskor (csak a flag váltódik) – visszakapcsolásnál ne kelljen böngésző permission
   - Default: ON. Új user-nél a flag TRUE, az első sikeres push subscribe után aktivizálódik

5. **Service Worker (`public/sw.js`)**
   - Service worker bejegyzéspontja `sw.js`-ben az `index.html`-ben (`navigator.serviceWorker.register('/sw.js')`)
   - Push event listener: `self.addEventListener('push', ...)` – payload Parse, user-friendly notification UI
   - Notification click handler: `self.addEventListener('notificationclick', ...)` – ha van `url` a payloadban, ablak nyit, egyéb esetben a lapot fókuszálja
   - Click tracking: notification click handler `fetch('/api/push/clicked', ...)` meghívása fire-and-forget (nem blokkolja a navigation-t)

6. **Click tracking endpoint**
   - `POST /api/push/clicked` – nyilvános, nem auth szükséges
   - Payload: `{ logId: UUID }` – a notification payload-ban szereplő `logId` mező
   - Backend update: `UPDATE push_notification_log SET clicked_at = now() WHERE id = $1 AND clicked_at IS NULL`
   - Idempotens: második click is OK silent, nincs update (unique timestamp az elsőhöz)
   - Log: minden click (success/skip) auditálható SQL-lel (CTR számítás)

7. **Frontend feliratkozás flow**
   - Új oldal / komponens: `/settings` vagy `/account` push notification szekciója
   - UI: toggle gomb "Webpush értesítéseket szeretnék kapni" (data-testid: `push-toggle`)
   - Toggle=ON esetén: `requestPermission()` + `getSubscription()` + `POST /api/push/subscribe` (frontend küldi be az endpoint-ot, auth-t, p256dh-t)
   - Toggle=OFF esetén: `DELETE /api/push/subscribe` (frontend old delete)
   - Hibaállapot: ha a böngésző nem támogatja a Service Worker API-t, UI letiltott + "Nem támogatott böngésződ"-üzenet
   - User Agent store a subscribe request-ben (frontend `navigator.userAgent`)

8. **Backend webpush service (`src/services/webpush.service.ts`)**
   - **`sendToUser(userId: string, payload: IPushPayload, options?: { bypassQuietHours?: boolean; bypassRateLimit?: boolean }): Promise<void>`**
     - Signature: `interface IPushPayload { title: string; body: string; url?: string; badge?: string; tag?: string; logId?: string; }`
     - Az adott userhez tartozó összes aktív subscription-t lekérdezi
     - `push_enabled = FALSE` user: silent skip + log `skipped_reason = 'push_disabled'`
     - Csendes órák check (Europe/Budapest 22:00–07:00): skip + log `skipped_reason = 'quiet_hours'` (hacsak `bypassQuietHours = true` az admin broadcast-hez)
     - Frequency cap (24 órás rolling window, max 5 push): skip + log `skipped_reason = 'rate_limit'` (hacsak `bypassRateLimit = true` az admin broadcast-hez)
     - `web-push.sendNotification(subscription, JSON.stringify(payload))` hívás mindegyikre
     - Hibakezelés: ha `410 Gone` (subscription lejárt), soft delete (`deleted_at = now()`)
     - Ha mások a hiba, log + re-throw (később retry queue lehet)
     - Pure function – kívülről inject-elhető, unit testelhető

9. **Backend API endpointok**
   - `POST /api/push/subscribe` – authMiddleware, payload: `{ endpoint, auth, p256dh }` – insert/update `push_subscriptions` bejegyzés
   - `DELETE /api/push/subscribe` – authMiddleware, delete/soft-delete az aktuális user összes subscription-je vagy specifikus endpoint-ot
   - `POST /api/admin/push/send` – adminMiddleware, payload: `{ title, body, url?, bypassQuietHours?, bypassRateLimit? }` – lásd **Admin UI** szekció
   - `POST /api/push/clicked` – nyilvános, payload: `{ logId: UUID }`

### Frontend

10. **Settings oldal webpush section**
    - Path: `/settings` push notification szekciója
    - Toggle gomb + status ikon (zöld/szürke, data-testid: `profile-push-toggle`)
    - Jelenlegi subscription info (ha van): "X eszközön aktív"
    - Tesztelés gomb (send test notification, data-testid: `push-test-button`)
    - Data-testid: `push-status`

### Admin UI

11. **Admin Push Sender nézet (`/admin/push`)**
    - **Szövegbeviteli mezők:**
      - Cím (required, max 100 karakter)
      - Body (required, max 240 karakter)
      - URL (opcionális, max 500 karakter)
    - **Targeting (rádiógombok):**
      - "Mindenki" – az összes aktív subscription-ű user (ahol `push_enabled = TRUE`)
      - (Megjegyzés: az "aktív userek (utolsó 7 nap)" és "csoport tagjai" post-MVP, külön story – v1-ben csak "Mindenki")
    - **Opcionális override checkboxok:**
      - "Csendes órákban is küldje" (data-testid: `push-bypass-quiet-hours`) – `bypassQuietHours: true`
      - "Rate limit megkerülése" (data-testid: `push-bypass-rate-limit`) – `bypassRateLimit: true`
    - **Submit gomb** – `data-testid="push-send-button"`
    - **Előnézet** – submit előtt egy modal: "Biztosan küldhetsz N felhasználónak, szöveg: [title / body preview]"
    - **Sikeres küldés után:** toast üzenet "Értesítés elküldve N felhasználónak"
    - **Hibaállapot:** toast error, ha valamiért sikertelen

12. **Audit log bejegyzés**
    - Admin push küldéskor új sor `audit_logs` táblához:
      - `action` = `push_send`
      - `admin_id` (ki küldte)
      - `target_count` (hány felhasználónak)
      - `payload` (JSON – title, body, url, bypassQuietHours, bypassRateLimit)
      - `timestamp` = now()

### Tesztek

13. **Backend unit tesztek (`src/services/webpush.service.test.ts`)**
    - Mock `web-push` library
    - Test case: sikeres küldés egy subscription-hez
    - Test case: 410 Gone hiba → soft delete subscription-t
    - Test case: egyéb hiba → nem szürkül el a subscription, re-throw
    - Test case: nincs subscription az adott userhez → silent return
    - Test case: payload validálás (title, body kötelezők)
    - Test case: `push_enabled = FALSE` user → skip + log `skipped_reason = 'push_disabled'`
    - Test case: csendes órák 22:00–07:00 Europe/Budapest → skip + log (DST teszt: március, október)
    - Test case: frequency cap 5 push 24h-ban → 6. skip + log
    - Test case: frequency cap bypass flag → 6. push küld (admin)

14. **Backend endpoint tesztek (POST /api/admin/push/send)**
    - Test: admin auth ellenőrzés (non-admin 403-at kap)
    - Test: targeting "everyone" – lekérdezés összes aktív subscription (csak `push_enabled = TRUE`)
    - Test: audit log bejegyzés létrehozása
    - Test: bypass flags működése

15. **Frontend component tesztek**
    - Settings toggle: click → `POST /api/push/subscribe` vagy `DELETE /api/push/subscribe`
    - Permission denied → UI hibaüzenet
    - Admin UI: targeting radio buttons – kiválasztás működik
    - Előnézet modal submit → `POST /api/admin/push/send`
    - Click tracking: notification click → `fetch('/api/push/clicked', ...)`

## Technikai megjegyzések

### Service Worker regisztráció

Frontend `main.ts` vagy app komponens:

```typescript
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('/sw.js').catch(err => 
    console.error('SW registration failed:', err)
  );
}
```

### Admin targeting query (v1: csak "Mindenki")

```typescript
// "Mindenki" – FROM push_subscriptions WHERE deleted_at IS NULL AND
//   user_id IN (SELECT id FROM users WHERE push_enabled = TRUE AND deleted_at IS NULL)
```

### Payload struktúra (JSON)

```json
{
  "title": "Hamarosan kezdődik a meccs!",
  "body": "Hollandia – Franciaország, 19:30",
  "url": "/matches",
  "badge": "/icons/push-badge-72.png",
  "tag": "match-reminder",
  "logId": "uuid-of-push-notification-log-entry"
}
```

### Integrációs megjegyzés (UX-013-hoz)

Ez a story **webpush-t** implementálja. Az UX-013 **in-app/polling** értesítéseket biztosít. Később kombinálható a kettő.

## Kizárások

- Nem tartalmaz automatikus trigger logikát (pl. match kickoff reminder) – ezt PUSH-002, PUSH-003, PUSH-004 valósítja meg
- Nem tartalmaz retry mechanizmust a sikertelen küldésekhez (csak log)
- Nem tartalmaz user-level notification preferences-ot granularitás szintjén (pl. "csak match reminders") – elég a globális toggle
- Nem tartalmaz batch email fallback-ot (akik kikapcsolták a push-t)
- Admin targeting v1-ben csak "Mindenki" (az "aktív 7 nap" és "csoport" post-MVP)
