---
id: PUSH-002
title: "Push: meccs előtt 30 perccel, ha nincs tipp"
priority: Should Have
status: Open
dependencies: [PUSH-001]
complexity: M
epic: E15 – Értesítések (webpush)
---

# PUSH-002: Push: meccs előtt 30 perccel, ha nincs tipp

## Vezérelv

**Minél kevesebb push. Konzervatív küldés: csak akkor menjen ki, ha a usernek tényleges hiányzó tipje / lejáró határideje van és észszerű időablakban. Soha ne küldjünk megerősítő ("minden megvan") vagy redundáns push-t. Bővíthető post-MVP, ha szükséges.**

## Leírás

Mint **játékos**, szeretném, hogy **30 perccel a meccs kezdete előtt automatikus webpush értesítést kapjak, ha még nem adtam le tippemet** az adott mérkőzésre, hogy **ne maradjak le a tipp leadási határidőről**.

## Elfogadási kritériumok

### Scheduled job infrastruktúra

1. **Cron/Scheduler konfigurálás**
   - Futási intervallum: 5 percenként (vagy 1 percenként, döntés: egyensúly a precizitás és a terhelés között)
   - Időzóna: UTC (a `kickoff_time` TIMESTAMPTZ, mindig UTC-ben tárolt)
   - Render cron service (javasolt az OPS-002 mintájára külön service, nem a sync-kel keveredik)
   - Env variable: `CRON_ENABLED=true` (dev-ben lehetne `false`)

2. **Match kiválasztás logika**
   - Lekérdezés: `matches WHERE kicked_at IS NULL AND kickoff_time BETWEEN now() AND now() + 35 minutes AND deleted_at IS NULL`
   - Ennek az ablaknak a vége a küldési határidő (35 perc, hogy ne küldjünk túl hamar, de még bőven 30 perc előtt)
   - SQL: `SELECT * FROM matches WHERE deleted_at IS NULL AND kicked_at IS NULL AND kickoff_time > now() AND kickoff_time <= now() + interval '35 minutes'`

3. **Konzervatív küldés: tipp hiánya ellenőrzése**
   - Minden olyan user akinek **nincs** `predictions` bejegyzése az adott `match_id`-hez
   - **Üres tipp / null score-ral leadott tipp TIPP-nek számít** – nem küldünk reminder-t
   - Kombinálás: `push_subscriptions` – csak az van aktív webpush subscription-nel rendelkező userek
   - Szűrés: `users.push_enabled = TRUE` – kikapcsolt usernek nem küldünk
   - SQL:
     ```sql
     SELECT DISTINCT ps.user_id
     FROM push_subscriptions ps
     JOIN users u ON ps.user_id = u.id
     WHERE ps.deleted_at IS NULL
     AND u.push_enabled = TRUE
     AND u.deleted_at IS NULL
     AND ps.user_id NOT IN (
       SELECT user_id FROM predictions WHERE match_id = $1 AND deleted_at IS NULL
     )
     ```

### Idempotencia

4. **Push notification log tábla bejegyzés**
   - Meglévő `push_notification_log` tábla (PUSH-001-ből):
     - `user_id` (UUID FK)
     - `type` (TEXT = `match_kickoff_reminder`)
     - `scope_key` (TEXT = `match_id`)
     - `sent_at` (TIMESTAMPTZ DEFAULT now())
   - **Unique constraint:** `UNIQUE(user_id, type, scope_key)` – garantálja, hogy egy user egy meccsre maximum 1x kap reminder-t
   - Job logic: `INSERT ... ON CONFLICT (user_id, type, scope_key) DO NOTHING` – csak ha nem létezik, küld push és log-ol

### Notification tartalom

5. **Push payload**
   - Cím: `"{Hazai csapat neve} – {Vendég csapat neve} hamarosan"` vagy `"Meccs hamarosan kezdődik"`
   - Body: `"Még nem tippeltél! Kezdés: {Kezdés ideje HH:MM CET/CEST}"` (időzóna: Europe/Budapest)
   - URL: `/matches?focus={match_id}` – a frontend match-card auto-scroll erre (ha nincs implementálva, story megemlíti hogy route.query.focus alapján scroll-oljon)
   - Badge: `/icons/push-badge-72.png`
   - Tag: `match-kickoff-{match_id}` – hogy ne sokszorozódjon az értesítés
   - LogId: a `push_notification_log` insert után visszakapott `id`

6. **Küldés és hibakezelés**
   - `sendToUser(userId, payload)` meghívása (PUSH-001 service – tartalmazhatja az csendes órák check, frequency cap-et)
   - Ha hiba: log, de ne szakadjon meg a job (next match feldolgozása folytatódjon)
   - 410 Gone: már kezeli a PUSH-001 service (soft delete subscription)
   - TOURNAMENT_ACTIVE check (G): a cron job legelején `if (!isTournamentActive()) return;` – env flag vagy DB-alapú, fejlesztő dönti

7. **Csendes órák (Europe/Budapest 22:00–07:00)**
   - Az `sendToUser()` dentro a PUSH-001 service-ben centralizálva
   - Ha most Europe/Budapest 22:00–07:00 között vagyunk: **skip + log `skipped_reason = 'quiet_hours'`**, nem defer-eljünk
   - 2026 VB Mexikó/USA/Kanada host → amerikai 21:00 kickoff = 03:00 CET, hajnali push uninstall-driver lenne

8. **Frequency cap (24 órás, max 5 push / nap)**
   - Az `sendToUser()` dentro a PUSH-001 service-ben centralizálva
   - Ha a user az utolsó 24 órában >= 5 push-t kapott (`push_notification_log` count, ahol `skipped_reason IS NULL`): skip + log `skipped_reason = 'rate_limit'`
   - Admin override: PUSH-001-ben `bypassRateLimit: true` paraméter

### Tesztek

9. **Unit tesztek az ablakkeresésre**
   - Mock match data: kickoff time 30 percen belül, 35 percen belül, előtte, után
   - Test: csak a 30–35 perces ablakon belüli meccsek jelölve
   - Test: `kicked_at IS NOT NULL` meccsek kizárva
   - Test: `deleted_at IS NOT NULL` meccsek kizárva

10. **Unit tesztek a konzervatív küldésre**
    - Mock push subscriptions + predictions
    - Test: user WITHOUT prediction a match-hez → targetálva
    - Test: user WITH prediction a match-hez (nullás score is) → NOT targetálva
    - Test: user bez push subscription → NOT targetálva
    - Test: user `push_enabled = FALSE` → NOT targetálva
    - Test: deleted subscription → NOT targetálva

11. **Idempotencia teszt**
    - Mock DB: `push_notification_log` tábla
    - Test: második futáson ugyanarról a match/user párról → `ON CONFLICT` miatt nincs új küldés
    - Test: unique constraint violation kezelése (nem error, silent ignore)

12. **Integrációs teszt**
    - Mock scheduler, mock webpush service, mock DB
    - Run job, verify: correct payloads, correct user count, log entries created
    - Mock egy match-et és egy user-t, run job, check push service hívások száma

## Technikai megjegyzések

### Cron job fájl

`src/jobs/matchKickoffReminder.ts`:

```typescript
export async function matchKickoffReminderJob(): Promise<void> {
  // Check tournament active
  if (!isTournamentActive()) return;

  const matches = await db.query
    .matches
    .findMany({
      where: (t, { isNull, and, gt, lte }) =>
        and(
          isNull(t.deletedAt),
          isNull(t.kickedAt),
          gt(t.kickoffTime, sql`now()`),
          lte(t.kickoffTime, sql`now() + interval '35 minutes'`)
        ),
    });

  for (const match of matches) {
    // Get users without prediction + with active subscription + push_enabled
    const targetUsers = await db.query.pushSubscriptions
      .findMany({ /* WHERE logic */ });

    for (const subscription of targetUsers) {
      const logExists = await db.query.pushNotificationLogs
        .findFirst({
          where: (t, { eq, and }) =>
            and(
              eq(t.userId, subscription.userId),
              eq(t.type, 'match_kickoff_reminder'),
              eq(t.scopeKey, match.id)
            ),
        });

      if (!logExists) {
        const log = await db.insert(pushNotificationLogs).values({
          userId: subscription.userId,
          type: 'match_kickoff_reminder',
          scopeKey: match.id,
        }).returning();

        await sendToUser(subscription.userId, {
          title: `${match.homeTeam.name} – ${match.awayTeam.name}`,
          body: `Még nem tippeltél!`,
          url: `/matches?focus=${match.id}`,
          badge: '/icons/push-badge-72.png',
          tag: `match-kickoff-${match.id}`,
          logId: log[0].id,
        });
      }
    }
  }
}
```

### Scheduling integráció (OPS-002 referencia)

Ha OPS-002 már alapot biztosít egy cron infrastructure-hoz, ezt a job-ot abba integráljuk. Ha nem, külön cron runner (pl. `node-cron` vagy Render's background worker).

## Kizárások

- Nem tartalmaz múltbeli meccsek feldolgozása (csak a jövőbeli, 30–35 perc között)
- Nem személyre szabott az értesítés a felhasználó beállításai alapján (pl. "csak favoritok")
