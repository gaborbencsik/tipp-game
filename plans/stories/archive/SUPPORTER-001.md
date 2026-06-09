---
id: SUPPORTER-001
title: "Globális lelkes támogató badge beállítása"
priority: Should Have
status: Open
dependencies: ["ADMIN-001"]
complexity: M
---

# SUPPORTER-001: Globális lelkes támogató badge beállítása

## Leírás

Mint **globális admin** (`users.role = 'admin'`), szeretném, hogy egy tetszőleges felhasználóra rákapcselhessem a "lelkes támogató" (supporter) globális státuszt, hogy jelezzem, mely felhasználók a játék aktív támogatói, és ezt a felhasználó neve mellett egy ⭐ emoji mutassa meg az alkalmazás minden pontján.

## Jelenlegi helyzet

Az `ADMIN-001` story bevezetett egy csoport-szintű "paid" státuszt (`group_members.paid_at`). Most egy globális, felhasználó-szintű státuszra van szükség, amely független attól, hogy az adott felhasználó mely csoportoknak a tagja.

## Elfogadási kritériumok

1. **DB séma bővítés**
   - `users` tábla új oszlopa: `supporter_at TIMESTAMPTZ` (nullable)
   - Ha `supporter_at` NOT NULL, akkor a felhasználó "lelkes támogató" státuszban van (globálisan)
   - Drizzle migráció legenerálva és dokumentálva

2. **Admin backend endpoint**
   - Végpont: `PUT /api/admin/users/:userId/supporter`
   - Body: `{ supporter: boolean }`
   - Csak globális admin (`users.role = 'admin'`) hívhatja meg
   - Ha `supporter: true` → `supporter_at = NOW()`
   - Ha `supporter: false` → `supporter_at = NULL`
   - Audit log bejegyzés: `action: 'user_supporter_set'`, bevont adatok: `userId`, `supporter` érték (`previousValue` / `newValue` boolean-ként)
   - 403 Forbidden, ha a felhasználó nem globális admin
   - 404 Not Found, ha a felhasználó nem létezik

3. **API módosítások – user listák és leaderboard**
   - Nyilvános API végpontok (leaderboard, members, predictions) tartalmaznak egy új `isSupporter: boolean` mezőt
   - Érinti: `getMe()`, `getGroupLeaderboard()`, `getGroupMembers()`, `getMatchPredictions()`, `getGlobalLeaderboard()`
   - Backend: `UserService.formatUserResponse()` vagy hasonló helper-ben a `supporter_at` → `isSupporter` transzformáció

4. **Admin UI – globális users lista**
   - `/admin/users` oldal: minden felhasználó soránál új toggle gomb/checkbox
   - Toggle label/tooltip: "Lelkes támogató" (hu), "Supporter" (en) – i18n kulcs: `admin.users.supporterToggle`
   - Kattintás után: `PUT` kérés az endpointra
   - Optimista UI frissítés (toggle azonnal reagál)
   - Ha hiba: toast notification a hibáról, UI visszaáll
   - A user neve mellett egy kis ⭐ badge (vagy 💎), ha `isSupporter`

5. **Supporter státusz megjelenítés – globális leaderboard**
   - Globális ranglista (`LeaderboardView` globális scope): ha `user.isSupporter`, a név mellett ⭐ emoji
   - Tooltip (title attribútum): "Lelkes támogató – köszönjük!" (hu), "Supporter – thank you!" (en) – i18n kulcs: `users.supporterBadgeTooltip`

6. **Supporter státusz megjelenítés – csoport leaderboard**
   - Csoport leaderboard (`GroupDetailView` ranglista): ha `member.isSupporter`, a név mellett ⭐ emoji
   - Tooltip: ugyanaz mint fentebb
   - Megjegyzés: a 💰 (paid, csoport-szintű) és a ⭐ (supporter, globális) **egyszerre** is megjelenhet egy tag mellett

7. **Supporter státusz megjelenítés – tag lista**
   - Csoport tagok listája (`GroupDetailView` tag lista): ha `member.isSupporter`, a név mellett ⭐ emoji
   - Tooltip: ugyanaz mint fentebb

8. **Supporter státusz megjelenítés – mások tippjei**
   - Meccs részletes nézetben (`MatchDetailView`), ahol más felhasználók tippjei láthatók
   - Ha a tipp beadó supporter: ⭐ emoji a neve mellett
   - Tooltip: ugyanaz mint fentebb

9. **Profil oldal**
   - Saját profil (`UserProfileView`) megmutatja, ha az adott user supporter
   - ⭐ emoji és tooltip a felhasználó neve mellett
   - Admin nem tudja az oldalan módosítani, csak az `/admin/users` oldal által

10. **Jogosultság ellenőrzés**
    - Csak globális admin (`users.role = 'admin'`) tudja beállítani a supporter státuszt
    - Kísérletre nem-adminnal: 403 Forbidden
    - UI: a toggle gomb csak globális admin számára jelenik meg az `/admin/users` oldal soraiban

11. **i18n**
    - `admin.users.supporterToggle` / `admin.users.supporterToggleOn` / `admin.users.supporterToggleOff` – toggle label
    - `users.supporterBadgeTooltip` – "Lelkes támogató – köszönjük!" (hu), "Supporter – thank you!" (en)

12. **Tesztek**
    - Backend: `setSupporterStatus(userId, supporter: boolean)` unit tesztek:
      - User nem létezik → 404
      - Nem-admin hívás → 403
      - Globális admin: `supporter: true` → `supporter_at = NOW()` + audit log
      - Globális admin: `supporter: false` → `supporter_at = NULL` + audit log
      - Idempotens (kétszer beállítva ugyanarra az értékre → same result)
    - Backend: API endpoint integrációs tesztek (401, 403, 200 szituációkra)
    - Backend: `getGlobalLeaderboard()`, `getGroupLeaderboard()`, `getGroupMembers()`, `getMatchPredictions()` API tesztek az `isSupporter` mező jelenlétére
    - Frontend: AdminUsersView tag toggle render tesztek
    - Frontend: `LeaderboardView`, `GroupDetailView`, `MatchDetailView` supporter badge emoji render tesztek

## Technikai megjegyzések

### Schema

```typescript
// packages/backend/src/db/schema/index.ts
// users táblára új oszlop:
supporter_at: timestamp('supporter_at').default(sql`null`),  // nullable, default NULL
```

Migráció: sorszám után `NNNN_users_supporter_at.ts`

### Backend

- Endpoint: `PUT /api/admin/users/:userId/supporter` (route: `routes/admin.ts`)
- Middleware: `admin.middleware` (globális admin check)
- Service: `users.service.ts` → `setSupporterStatus(userId: string, supporter: boolean): Promise<void>`
- Audit: `auditLog.create({ action: 'user_supporter_set', userId, supporterId: admin.id, previousValue: {...}, newValue: {...} })`
- Helper: `formatUserResponse(dbUser)` → a `supporter_at` → `isSupporter: boolean` konverzió
- Modify endpoints:
  - `routes/auth.ts`: `getMe()` → `isSupporter` mező
  - `routes/groups.ts`: `getGroupLeaderboard()`, `getGroupMembers()` → `isSupporter` mező
  - `routes/matches.ts`: `getMatchPredictions()` → `isSupporter` mező
  - `routes/leaderboard.ts`: `getGlobalLeaderboard()` → `isSupporter` mező

### Frontend

- Component: `AdminUsersView` (vagy admin users lista) → toggle per user, ⭐ badge render
- Component: `LeaderboardView`, `GroupDetailView`, `MatchDetailView` → supporter badge emoji render logika
- Store: `usersStore` (Pinia) → `isSupporter` szinc az API adatokkal
- i18n: `hu.json`, `en.json` → `admin.users.supporterToggle`, `users.supporterBadgeTooltip` keys

### API Response

```typescript
// getMe, getGlobalLeaderboard, getGroupLeaderboard, getGroupMembers, getMatchPredictions
{
  id: UUID;
  displayName: string;
  isSupporter: boolean;  // új mező
  isPaid?: boolean;      // (ha csoport context)
  points: number;
  // ... többi mező
}
```

## Kizárások

- A supporter státusz NEM szűri ki a felhasználókat sehonnan, csak megjelöli őket
- Az admin UI az `/admin/users` globális user listában integrálódik; nincs új admin-oldal ehhez
- Nem része: supporter "tier" (egyszerű boolean)
- Nem része: payment integráció — ez kézi state
- A supporter státusz nem korlátozza az adatokhoz való hozzáférést (pl. a supporter értékelés száma nem változik meg)
- Nem része: push notification, email értesítés a supporter státusz megváltozásakor
