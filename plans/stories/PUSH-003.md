---
id: PUSH-003
title: "Push: torna tipp deadline előtt 1 nappal"
priority: Should Have
status: Open
dependencies: [PUSH-001]
complexity: M
epic: E15 – Értesítések (webpush)
---

# PUSH-003: Push: torna tipp deadline előtt 1 nappal

## Vezérelv

**Minél kevesebb push. Konzervatív küldés: csak akkor menjen ki, ha a usernek tényleges hiányzó tipje / lejáró határideje van és észszerű időablakban. Soha ne küldjünk megerősítő ("minden megvan") vagy redundáns push-t. Bővíthető post-MVP, ha szükséges.**

## Leírás

Mint **játékos**, szeretném, hogy **24 órával azelőtt, hogy lejárjon a torna tippek (pl. legjobb gólszerzők, döntő végeredménye) leadási határideje, egy webpush emlékeztetőt kapjak**, hogy **ne maradjak le a leadási határidőről**.

## Jelenlegi helyzet

A rendszerben vannak globális speciális tipp típusok (`special_prediction_types` ahol `is_global = true` és `is_active = true`), amelyeknek van `deadline` mezőjük. Ebből a story-ból az automatikus reminder.

## Elfogadási kritériumok

### Scheduled job

1. **Cron job futása**
   - Futási intervallum: naponta 1× (pl. 09:00 UTC vagy 10:00 CET – ajánlott: a bejelentkezési csúcs után)
   - Env variable: `CRON_ENABLED=true`
   - Scheduler: ugyanaz a cron infrastructure, mint PUSH-002

2. **Konzervatív küldés: válasz hiánya ellenőrzése**
   - `SELECT * FROM special_prediction_types WHERE is_global = true AND is_active = true`
   - Szűrés: `deadline` a következő 24 és 30 óra között van (ma 10:00-kor futtuk, akkor a holnap 10:00 ± ablak közötti deadline-okat keressük)
   - SQL: `deadline > now() + interval '24 hours' AND deadline <= now() + interval '30 hours'`
   - **Azon userek, akik nem adtak le még választ** erre a `special_prediction_type_id`-ra
   - Kombinálás: csak aktív webpush subscription-nel rendelkezők
   - Szűrés: `users.push_enabled = TRUE`
   - SQL:
     ```sql
     SELECT DISTINCT ps.user_id
     FROM push_subscriptions ps
     JOIN users u ON ps.user_id = u.id
     WHERE ps.deleted_at IS NULL
     AND u.push_enabled = TRUE
     AND u.deleted_at IS NULL
     AND ps.user_id NOT IN (
       SELECT user_id FROM special_predictions 
       WHERE special_prediction_type_id = $1 AND deleted_at IS NULL
     )
     ```

### Idempotencia

3. **Push notification log fájl**
   - Meglévő `push_notification_log` tábla (PUSH-001-ből):
     - `user_id` (UUID FK)
     - `special_type_id` (UUID FK `special_prediction_types.id`, nullable)
     - `type` (TEXT = `tournament_tip_deadline`)
     - `scope_key` (TEXT = `special_type_id`)
     - `sent_at` (TIMESTAMPTZ DEFAULT now())
   - **Unique constraint:** `UNIQUE(user_id, type, scope_key)` – garantálja max 1 reminder per user per torna tipp típus

4. **Küldés logikája**
   - `INSERT ... ON CONFLICT (user_id, type, scope_key) DO NOTHING`
   - Garantáltan idempotens: ha a job többször fut ugyanazon az intervallumon, nem lesz duplumküldés

### Notification tartalom

5. **Push payload**
   - Cím: `"Holnap lejár: {special_prediction_type.name}"`
   - Body: `"Még nem adtál le választ! Leadási határidő: {deadline időpontja HH:MM CET/CEST}"`
   - URL: `/predictions` (vagy a torna tipp form route – frontend/admin dönti)
   - Badge: `/icons/push-badge-72.png`
   - Tag: `tournament-deadline-{special_type_id}` – avoid duplikációt
   - LogId: a `push_notification_log` insert után visszakapott `id`

6. **Küldés és hibakezelés**
   - `sendToUser(userId, payload)` hívása (PUSH-001 service – tartalmazhatja az csendes órák check, frequency cap-et)
   - Hiba: log, de ne szakadjon meg a job
   - A PUSH-001 service már kezel 410 Gone és egyéb hibákat

7. **TOURNAMENT_ACTIVE check**
   - Cron job legelején: `if (!isTournamentActive()) return;` – env flag vagy DB-alapú, fejlesztő dönti

### Tesztek

8. **Unit tesztek az ablaklekérdezésre**
   - Mock special types: deadline 24h-n belül, 25-30h között, előtte, után
   - Test: csak a 24–30 órás ablakban lévő típusok kerülnek feldolgozásra
   - Test: `is_active = false` típusok kizárva
   - Test: `is_global = false` típusok kizárva

9. **Unit tesztek a konzervatív küldésre**
   - Mock special predictions + push subscriptions
   - Test: user WITHOUT special prediction → targetálva
   - Test: user WITH special prediction → NOT targetálva
   - Test: user bez push subscription → NOT targetálva
   - Test: user `push_enabled = FALSE` → NOT targetálva
   - Test: deleted subscription → NOT targetálva

10. **Idempotencia teszt**
    - Test: második futáson ugyanarról a special_type/user párról → ON CONFLICT miatt nincs új küldés
    - Test: unique constraint violation kezelése (silent ignore)

11. **Integrációs teszt**
    - Mock special_prediction_types (deadline 26 óra múlva)
    - Mock push subscriptions, users
    - Run job, verify: payloads, target user count, log entries

## Technikai megjegyzések

### Cron job

`src/jobs/tournamentDeadlineReminder.ts`:

```typescript
export async function tournamentDeadlineReminderJob(): Promise<void> {
  // Check tournament active
  if (!isTournamentActive()) return;

  const specialTypes = await db.query.specialPredictionTypes.findMany({
    where: (t, { and, eq, gte, lte, sql }) =>
      and(
        eq(t.isGlobal, true),
        eq(t.isActive, true),
        gte(t.deadline, sql`now() + interval '24 hours'`),
        lte(t.deadline, sql`now() + interval '30 hours'`)
      ),
  });

  for (const specialType of specialTypes) {
    // Get target users: no special prediction + has subscription + push_enabled
    const targetUsers = await db.query.pushSubscriptions.findMany({
      where: (t, { and, isNull }) => and(isNull(t.deletedAt), /* targeting logic */),
    });

    for (const subscription of targetUsers) {
      const logExists = await db.query.pushNotificationLogs.findFirst({
        where: (t, { and, eq }) =>
          and(
            eq(t.userId, subscription.userId),
            eq(t.type, 'tournament_tip_deadline'),
            eq(t.scopeKey, specialType.id)
          ),
      });

      if (!logExists) {
        const log = await db.insert(pushNotificationLogs).values({
          userId: subscription.userId,
          type: 'tournament_tip_deadline',
          scopeKey: specialType.id,
        }).returning();

        await sendToUser(subscription.userId, {
          title: `Holnap lejár: ${specialType.name}`,
          body: `Még nem adtál le választ!`,
          url: `/predictions`,
          badge: '/icons/push-badge-72.png',
          tag: `tournament-deadline-${specialType.id}`,
          logId: log[0].id,
        });
      }
    }
  }
}
```

### Cron futási idő

Javasolt: naponta egyszer, korán reggel (pl. 09:00–10:00 UTC), amikor a legtöbb user online van, de még van ideje reagálni.

## Kizárások

- Nem alkalmaz felhasználói preference-okat (pl. "ne küldjék a tournament reminders-t")
- Nem tartalmaz személyre szabott kategória-szűrést (pl. csak a "favorit" torna tipekhez reminder)
- Nem tartalmaz csoport-specifikus speciális tipp típusokat (MVP: csak globális)
