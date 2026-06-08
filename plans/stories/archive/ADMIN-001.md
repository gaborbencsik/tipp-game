---
id: ADMIN-001
title: "Csoport tag fizetett státusz bejelölése (admin)"
priority: Should Have
status: Open
dependencies: []
complexity: M
---

# ADMIN-001: Csoport tag fizetett státusz bejelölése (admin)

## Leírás

Mint **globális admin** (`users.role = 'admin'`), szeretném, hogy egy csoport tetszőleges tagjára rákapcselhessem a "paid" (fizetett) státuszt csoportonként, hogy jelezzem, mely tagok fizető tagok, és ezt a felhasználó neve mellett egy 💰 emoji mutassa meg az alkalmazásban.

## Jelenlegi helyzet

Az alkalmazásban jelenleg nem lehet megjelölni, hogy egy felhasználó egy adott csoporton belül fizetett-e. A `group_members` tábla nem tartalmaz ilyen információt.

## Elfogadási kritériumok

1. **DB séma bővítés**
   - `group_members` tábla új oszlopa: `paid_at TIMESTAMPTZ` (nullable)
   - Ha `paid_at` NOT NULL, akkor a tag "fizetett" státuszban van az adott csoportban
   - Drizzle migráció legenerálva és dokumentálva

2. **Admin backend endpoint**
   - Végpont: `PUT /api/admin/groups/:groupId/members/:userId/paid`
   - Body: `{ paid: boolean }`
   - Csak globális admin (`users.role = 'admin'`) hívhatja meg
   - Ha `paid: true` → `paid_at = NOW()`
   - Ha `paid: false` → `paid_at = NULL`
   - Audit log bejegyzés: `action: 'group_member_paid_set'`, bevont adatok: `groupId`, `userId`, `paid` érték
   - 403 Forbidden, ha a felhasználó nem globális admin
   - 404 Not Found, ha a csoport vagy a tag nem létezik

3. **Admin UI – csoport admin felület**
   - Új toggle gomb/checkbox minden egyes csoporttag mellett az admin módban
   - Toggle label/tooltip: "Fizetett" (hu), "Paid" (en) – i18n kulcs: `admin.groupDetail.memberPaid`
   - Kattintás után: `PUT` kérés az endpointra
   - Optimista UI frissítés (toggle azonnal reagál)
   - Ha hiba: toast notification a hibáról, UI visszaáll

4. **Fizetett státusz megjelenítés – leaderboard**
   - Csoport leaderboard (`GroupDetailView` ranglista): ha `member.isPaid`, a név mellett 💰 emoji
   - API endpoint (`getGroupLeaderboard`) kiterjesztve `isPaid` mezővel
   - Tooltip (title attribútum): "Fizetett"

5. **Fizetett státusz megjelenítés – tag lista**
   - Csoport tagok listája (`GroupDetailView` tag lista): ha `member.isPaid`, a név mellett 💰 emoji
   - API endpoint (`getGroupMembers`) kiterjesztve `isPaid` mezővel
   - Tooltip: "Fizetett"

6. **Fizetett státusz megjelenítés – mások tippjei**
   - Meccs részletes nézetben (`MatchDetailView`), ahol más csoporttagok tippjei láthatók
   - Ha a tipp beadó csoporttagja fizetett: 💰 emoji a neve mellett
   - API endpoint (`getMatchPredictions` vagy hasonló) kiterjesztve `isPaid` mezővel
   - Tooltip: "Fizetett"

7. **Globális leaderboard – NEM jelenik meg**
   - A globális (`GlobalLeaderboardView`) nézetben a paid státusz NEM jelenik meg
   - Indok: csoport-specifikus jelölés, nincs egyértelmű globális értelme

8. **Jogosultság ellenőrzés**
   - Csoport-admin (nem globális admin) NEM tudja beállítani a paid státuszt
   - Kísérletre: 403 Forbidden
   - UI: a toggle gomb nem jelenik meg csoport-adminok számára, csak globális admin számára

9. **Tesztek**
   - Backend: PUT endpoint teszt globális adminnal (200 OK, audit log)
   - Backend: PUT endpoint teszt nem-adminnal (403 Forbidden)
   - Backend: `getGroupLeaderboard`, `getGroupMembers` API tesztek az `isPaid` mező jelenlétére
   - Frontend: AdminGroupDetailView tag toggle render tesztek
   - Frontend: `GroupDetailView` leaderboard és tag lista emoji render tesztek

## Technikai megjegyzések

### Schema

```typescript
// packages/backend/src/db/schema/index.ts
// group_members táblára új oszlop:
paid_at: timestamp('paid_at').notNull().default(sql`null`),  // nullable, default NULL
```

Migráció: `0065_group_members_paid_at.ts` (a sorszám a meglévő migrációk után)

### Backend

- Endpoint: `PUT /api/admin/groups/:groupId/members/:userId/paid` (route: `routes/admin.ts` vagy új admin submodul)
- Middleware: `admin.middleware` (globális admin check)
- Service: `groupMemberService.setPaidStatus(groupId, userId, paid: boolean)` → `Promise<void>`
- Audit: `auditLog.create({ action: 'group_member_paid_set', ... })`
- Существующие endpoints módosítása:
  - `routes/groups.ts`: `getGroupLeaderboard`, `getGroupMembers` → `isPaid` mező hozzáadása

### Frontend

- Component: `AdminGroupDetailView` (vagy az admin csoport nézet) → toggle per tag
- Component: `GroupDetailView` → emoji render logika az `isPaid` alapján
- Store: `groupsStore` (Pinia) → `isPaid` szinc az API adatokkal
- i18n: `hu.json`, `en.json` → `admin.groupDetail.memberPaid` key

### API Response

```typescript
// getGroupLeaderboard, getGroupMembers
{
  id: UUID;
  name: string;
  isPaid: boolean;
  points: number;
  // ... többi mező
}
```

## Kizárások

- A paid státusz NEM szűri ki a tagokat sehonnan, csak megjelöli őket (nincs szúrős logika, pl. "csak fizetett tagok leaderboardja").
- Az admin UI a meglévő csoport-admin nézetbe integrálódik; nincs új admin-oldal ehhez.
- Az i18n key elsősorban a tooltip-hez; az emoji önmagyarázó.
- Nem része: push notification, email értesítés a paid státusz megváltozásakor.
