---
id: PUSH-004
title: "Push: napi első meccs előtt 1 órával (Europe/Budapest)"
priority: Should Have
status: Open
dependencies: [PUSH-001]
complexity: M
epic: E15 – Értesítések (webpush)
---

# PUSH-004: Push: napi első meccs előtt 1 órával (Europe/Budapest)

## Vezérelv

**Minél kevesebb push. Konzervatív küldés: csak akkor menjen ki, ha a usernek tényleges hiányzó tipje / lejáró határideje van és észszerű időablakban. Soha ne küldjünk megerősítő ("minden megvan") vagy redundáns push-t. Bővíthető post-MVP, ha szükséges.**

## Leírás

Mint **játékos**, szeretném, hogy **naponta a mai (Europe/Budapest időzónában) első meccs kezdete előtt 1 órával egy webpush értesítést kapjak**, amely informálja a napi tipp státuszomról (mennyi meccsre kell még tippelnem, de CSAK ha nincs tippem), hogy **tudjam a napi ritmusomban amikor érdemes átvenni a tippemet**.

## Elfogadási kritériumok

### Scheduled job

1. **Cron futási intervallum és időzóna**
   - Futási intervallum: 5 percenként
   - Időzóna: Europe/Budapest (CET/CEST kezelés)
   - Az aktuális mai nap (Europe/Budapest) meghatározása: `now() AT TIME ZONE 'Europe/Budapest'`
   - Annak a napnak az első meccs `kickoff_time`-ja (UTC-ben) azonosítása, majd –1 óra kiszámítása

2. **Mai nap első meccsének azonosítása**
   - Query: `SELECT * FROM matches WHERE date(kickoff_time AT TIME ZONE 'Europe/Budapest') = date(now() AT TIME ZONE 'Europe/Budapest') AND kicked_at IS NULL AND deleted_at IS NULL ORDER BY kickoff_time ASC LIMIT 1`
   - Ha nincs ilyen meccs (ma nincsenek meccsek): job silent return, nincs push küldés
   - Ha van: `first_match.kickoff_time - 1 hour` a trigger idő

3. **Trigger ablak: „első meccs - 1 óra" ± 5 perc**
   - Job 5 percenként fut, ezért egy 5 perces ablak elegendő az idempotenciához
   - Küldés csak akkor, ha `now()` között van `[trigger_time, trigger_time + 5 minutes]`

### Konzervatív küldés: csak ha nincs tippje

4. **Küldés CSAK ha a felhasználónak van legalább 1 tipp nélküli mai meccs**
   - **NEM küldjünk ha minden mai meccsre van már tippje** – silent skip, ne küldjünk "minden megvan" megerősítő push-t
   - **Szükséges:** van legalább 1 tipp nélküli mai meccs
   - Kombinálás: `push_subscriptions` – csak az aktív webpush subscription-nel rendelkező userek
   - Szűrés: `users.push_enabled = TRUE`
   - SQL:
     ```sql
     SELECT DISTINCT ps.user_id
     FROM push_subscriptions ps
     JOIN users u ON ps.user_id = u.id
     WHERE ps.deleted_at IS NULL
     AND u.push_enabled = TRUE
     AND u.deleted_at IS NULL
     -- Check if user is missing at least one prediction for today's matches
     AND ps.user_id IN (
       SELECT id FROM (
         SELECT u2.id FROM users u2
         WHERE NOT EXISTS (
           SELECT 1 FROM predictions p
           WHERE p.user_id = u2.id
           AND p.match_id IN (
             SELECT m.id FROM matches m
             WHERE date(m.kickoff_time AT TIME ZONE 'Europe/Budapest') = date(now() AT TIME ZONE 'Europe/Budapest')
             AND m.kicked_at IS NULL AND m.deleted_at IS NULL
           )
         )
       ) missing_predictions
     )
     ```

### Idempotencia

5. **Push notification log fájl**
   - Meglévő `push_notification_log` tábla (PUSH-001-ből):
     - `user_id` (UUID FK)
     - `date_key` (TEXT vagy DATE, a mai nap Europe/Budapest-ben, pl. '2026-06-01')
     - `type` (TEXT = `daily_match_review`)
     - `scope_key` (TEXT = `date_key`)
     - `sent_at` (TIMESTAMPTZ DEFAULT now())
   - **Unique constraint:** `UNIQUE(user_id, type, scope_key)` – garantálja, hogy minden user naponta max 1× kap daily review-t

6. **Küldés logikája**
   - `INSERT ... ON CONFLICT (user_id, type, scope_key) DO NOTHING`
   - Idempotens: többszöri job futás ugyanarra a napra → csak 1 push

### Notification tartalom és payload

7. **Push payload formátum (CSAK hiányos esetben)**
   - `title`: `"⏰ Még {N} tipp hiányzik"` (N = hány meccsre nincs még tippje)
   - `body`: `"Az első meccs {HH:MM}-kor kezdődik. Pótold most!"` (HH:MM Europe/Budapest időzónában)
   - `url`: `/matches?date=today`
   - `badge`: `/icons/push-badge-72.png`
   - `tag`: `daily-review-pending-{YYYY-MM-DD}` (Europe/Budapest szerinti dátummal)
   - `logId`: a `push_notification_log` insert után visszakapott `id`

8. **Küldés és hibakezelés**
   - `sendToUser(userId, payload)` (PUSH-001 service – tartalmazhatja az csendes órák check, frequency cap-et)
   - Hiba: log + continue (ne szakadjon meg a job)

9. **Csendes órák interakció (KRITIKUS pont)**
   - Ha a mai első meccs `kickoff_time - 1 hour` Europe/Budapest 22:00–07:00 időablakra esik (pl. 06:00 helyi kickoff → 05:00 reminder → csendes óra), **NEM küld push-t**
   - **NEM tolja el later-re** (a "napi review" 09:00-kor már értelmetlen, az első meccs már megy)
   - Silent skip + log `skipped_reason = 'quiet_hours'`
   - 2026 VB-n ez gyakori az amerikai host miatt

10. **TOURNAMENT_ACTIVE check**
    - Cron job legelején: `if (!isTournamentActive()) return;`

### Tesztek

11. **Unit teszt: timezone konverzió**
    - Test: UTC→Budapest +1 óra offset (tél)
    - Test: UTC→Budapest +2 óra offset (nyár, DST)
    - Test: mai nap definiálása Europe/Budapest-ben
    - Mock: `now()` = 2026-06-01 16:00 UTC (= 18:00 CET), első meccs 21:00 UTC (= 23:00 CET) – trigger 20:00 UTC-kor (= 22:00 CET)
    - DST teszt (március és október)

12. **Unit teszt: mai nap meccskeresése**
    - Mock matches: mai nap, tegnap, holnap
    - Test: csak mai nap (Europe/Budapest) meccsek kerülnek kiválasztásra
    - Test: ha nincs mai meccs, silent return
    - Test: ORDER BY kickoff_time, LIMIT 1 működése

13. **Unit teszt: konzervatív küldés (hiányos eset CSAK)**
    - Mock scenario A: user 8/8 meccsre tipett → **NEM küld push** (silent skip)
    - Mock scenario B: user 5/8 meccsre tipett → küld, body: `"Még 3 tipp hiányzik"`
    - Test: helyes szám számolódik
    - Test: teljes user (8/8) nem kapja meg az értesítést

14. **Unit teszt: trigger ablak**
    - Test: trigger time = T, now = T – küld
    - Test: trigger time = T, now = T + 5 minutes – küld
    - Test: trigger time = T, now = T + 6 minutes – nem küld (már lejárt)
    - Test: trigger time = T, now = T – 1 minute – nem küld (még nem itt az ideje)

15. **Unit teszt: idempotencia**
    - Test: második futáson ugyanarra a napra + user-re → ON CONFLICT miatt nincs dupla küldés
    - Test: unique constraint violation kezelése (silent ignore)

16. **Unit teszt: csendes órák skip (2026 VB feltétel)**
    - Test: mai első meccs 06:00 UTC (= 08:00 CET) → trigger 05:00 UTC (= 07:00 CET) → küld (07:00 már nem csendes óra)
    - Test: mai első meccs 00:30 UTC (= 02:30 CET) → trigger 23:30 UTC előző nap (= 01:30 CET) → skip (quiet hours)
    - Test: mai első meccs 04:30 UTC (= 06:30 CET) → trigger 03:30 UTC (= 05:30 CET) → skip (quiet hours)

17. **Integrációs teszt**
    - Mock: 3 user, 8 meccs mai napra, szétszórt prediction statusz (2 user hiányos, 1 teljes)
    - Mock: 1 user-nek van subscription, 2-nek van (1 kikapcsolt, 1 aktív)
    - Run job, verify: 2 push küldés (a hiányos, aktív usereknek), jó payload-ok, log entries

## Technikai megjegyzések

### Cron job

`src/jobs/dailyMatchReviewReminder.ts`:

```typescript
export async function dailyMatchReviewReminderJob(): Promise<void> {
  if (!isTournamentActive()) return;

  const now = new Date();
  const nowBudapest = utcToZonedTime(now, 'Europe/Budapest');
  const todayBudapest = startOfDay(nowBudapest);
  const todayUTC = zonedTimeToUtc(todayBudapest, 'Europe/Budapest');

  // Get first match of today (Budapest tz)
  const firstMatch = await db.query.matches.findFirst({
    where: (t, { and, isNull, gte, lt, sql }) =>
      and(
        isNull(t.kickedAt),
        isNull(t.deletedAt),
        gte(t.kickoffTime, todayUTC),
        lt(t.kickoffTime, addDays(todayUTC, 1))
      ),
    orderBy: (t) => t.kickoffTime,
  });

  if (!firstMatch) {
    // No matches today
    return;
  }

  const triggerTime = subHours(firstMatch.kickoffTime, 1);
  const triggerWindow = addMinutes(triggerTime, 5);

  if (now < triggerTime || now > triggerWindow) {
    // Not in trigger window
    return;
  }

  // Get all today's matches
  const todaysMatches = await db.query.matches.findMany({
    where: (t, { and, isNull, gte, lt }) =>
      and(
        isNull(t.kickedAt),
        isNull(t.deletedAt),
        gte(t.kickoffTime, todayUTC),
        lt(t.kickoffTime, addDays(todayUTC, 1))
      ),
  });

  // Get users with active subscription who are missing at least one prediction
  const usersWithMissingPredictions = await db.query.users.findMany({
    where: (t, { and, isNull, eq }) =>
      and(
        isNull(t.deletedAt),
        eq(t.pushEnabled, true)
      ),
    // Filter: users without ALL of today's predictions
  });

  const dateKey = format(todayBudapest, 'yyyy-MM-dd');

  for (const user of usersWithMissingPredictions) {
    // Count predictions for today's matches
    const predictionCount = await db.query.predictions.findMany({
      where: (t, { and, eq, inArray, isNull }) =>
        and(
          eq(t.userId, user.id),
          inArray(t.matchId, todaysMatches.map((m) => m.id)),
          isNull(t.deletedAt)
        ),
    });

    // ONLY send if missing at least one prediction
    if (predictionCount.length < todaysMatches.length) {
      const logExists = await db.query.pushNotificationLogs.findFirst({
        where: (t, { and, eq }) =>
          and(
            eq(t.userId, user.id),
            eq(t.type, 'daily_match_review'),
            eq(t.scopeKey, dateKey)
          ),
      });

      if (!logExists) {
        const missingCount = todaysMatches.length - predictionCount.length;
        const firstMatchTime = format(
          utcToZonedTime(firstMatch.kickoffTime, 'Europe/Budapest'),
          'HH:mm'
        );

        const log = await db.insert(pushNotificationLogs).values({
          userId: user.id,
          type: 'daily_match_review',
          scopeKey: dateKey,
        }).returning();

        await sendToUser(user.id, {
          title: `⏰ Még ${missingCount} tipp hiányzik`,
          body: `Az első meccs ${firstMatchTime}-kor kezdődik. Pótold most!`,
          url: `/matches?date=today`,
          badge: '/icons/push-badge-72.png',
          tag: `daily-review-pending-${dateKey}`,
          logId: log[0].id,
        });
      }
    }
  }
}
```

### Timezone könyvtár

Frontend/Backend: `date-fns` + `date-fns-tz` (már használatban van a projekt)

```typescript
import { utcToZonedTime, zonedTimeToUtc, format } from 'date-fns-tz';
import { startOfDay, addDays, subHours, addMinutes } from 'date-fns';

const nowBudapest = utcToZonedTime(new Date(), 'Europe/Budapest');
const todayUTC = zonedTimeToUtc(startOfDay(nowBudapest), 'Europe/Budapest');
```

### DB séma frissítés

`push_notification_log` tábla: már létezik PUSH-001-ből, a `scope_key` field általános, az összes trigger típushoz használható.

## Kizárások

- Nem tartalmaz személyre szabott torna tippek megjelenítést (csak match tippeknél aktiválva)
- Nem alkalmaz granulált user preference-okat (pl. „ne küldjék az éjjel" — a csendes órák globális, nem user-specific)
