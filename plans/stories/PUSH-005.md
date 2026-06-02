---
id: PUSH-005
title: "Frequency cap és csendes órák a webpush küldéshez"
priority: Should Have
status: Open
dependencies: [PUSH-001]
complexity: S
epic: E15 – Értesítések (webpush)
---

# PUSH-005: Frequency cap és csendes órák a webpush küldéshez

## Leírás

Mint **user**, szeretném, hogy ne kapjak túl sokat egy napon és hajnalban push-t, hogy ne kelljen leiratkoznom.

## Jelenlegi helyzet

A PUSH-002/003/004 cron triggerek és a PUSH-001 admin trigger önállóan idempotensek, de globális spam-védelem nélkül egy buggos cron vagy egy adminflame mindenkit kiírathat. A 2026 VB Észak-Amerikában van — egyes meccsek CET hajnalra esnek, a napi reminder cron csendes órák szabály nélkül 03:00-kor csörögne.

## Elfogadási kritériumok

### Csendes órák (Europe/Budapest fix)

1. **Globális csendes órák implementációja**
   - `webpush.service.ts` `sendToUser()` minden hívásakor ellenőrzi: most a 22:00–07:00 ablakban vagyunk-e Europe/Budapest szerint?
   - Ha igen → skip push, log sor: `INSERT INTO push_notification_log (..., skipped_reason = 'quiet_hours')`
   - **NEM defer-eljük** később – a 30 perces reminder 5 órával később értelmetlen

2. **Override paraméter az admin broadcast-hoz**
   - `sendToUser(userId, payload, { bypassQuietHours?: boolean })` – optional 3. paraméter
   - Admin `/admin/push` UI checkbox: "Csendes órákban is küldje" (data-testid: `push-bypass-quiet-hours`)
   - Ha checked: `bypassQuietHours: true` → a `sendToUser()` hívás bypass-olja a quiet hours check-et

3. **Tesztek: csendes órák**
   - Test: Europe/Budapest 23:30 → skip
   - Test: Europe/Budapest 06:30 → skip
   - Test: Europe/Budapest 07:01 → küld
   - Test: Europe/Budapest 21:59 → küld
   - Test: DST átállás (március – UTC +1 → +2, október – UTC +2 → +1)
   - Mock `Date.now()` és timezone library függvényeket a konzisztencia érdekében

### Frequency cap (24 órás rolling window, max 5 push / nap)

4. **Globális frequency cap implementációja**
   - `webpush.service.ts` `sendToUser()` minden hívásakor ellenőrzi: a user az utolsó 24 órában hány push-t kapott?
   - Lekérdezés: `SELECT COUNT(*) FROM push_notification_log WHERE user_id = $1 AND skipped_reason IS NULL AND sent_at > now() - interval '24 hours'`
   - Ha count >= 5 → skip push, log sor: `INSERT INTO push_notification_log (..., skipped_reason = 'rate_limit')`

5. **Konstans és env override**
   - Konstans `PUSH_DAILY_CAP = 5` (TypeScript konstans)
   - Env override: `PUSH_DAILY_CAP` (parse int, default 5)
   - Admin bypass flag: `bypassRateLimit: true` paraméter a `sendToUser()` hívásban
   - Admin `/admin/push` UI checkbox: "Rate limit megkerülése" (data-testid: `push-bypass-rate-limit`)

6. **Tesztek: frequency cap**
   - Test: user 4 push → 5. küld
   - Test: user 5 push → 6. skip
   - Test: user 5 push + `bypassRateLimit: true` → 6. küld (admin override)
   - Test: 23 órás push az új 24h window-ba beleszámít
   - Test: 25 órás push már nem számít (rolling window)

### Logolás és auditálhatóság

7. **Push notification log táblában skipped_reason**
   - `push_notification_log.skipped_reason` (TEXT, nullable)
   - Lehetséges értékek: `'quiet_hours'`, `'rate_limit'`, `'push_disabled'`, `'no_subscription'`
   - Skipped push is kerüljön logba: külön sor `type`, `scope_key`, `user_id` kitöltve, `endpoint` nélkül, `skipped_reason` kitöltve
   - SQL auditálás: `SELECT COUNT(*) FROM push_notification_log WHERE skipped_reason = 'quiet_hours' AND sent_at > now() - interval '1 day'`

### Konstansok és config

8. **Environment variables**
   - `PUSH_QUIET_HOURS_START=22` (integer, hour)
   - `PUSH_QUIET_HOURS_END=7` (integer, hour)
   - `PUSH_DAILY_CAP=5` (integer)
   - `PUSH_TIMEZONE=Europe/Budapest` (string, IANA)
   - Default értékek a kódban, env override lehetséges

9. **Centralizált implementáció**
   - Mindez a `webpush.service.ts`-ben egy helyen, NEM ismételjük a cronokban
   - Cronok hívják a `sendToUser()` függvényt, az már tartalmazza az összes check-et

## Technikai megjegyzések

### Service függvény szignatura

```typescript
interface SendToUserOptions {
  bypassQuietHours?: boolean;
  bypassRateLimit?: boolean;
}

export async function sendToUser(
  userId: string,
  payload: IPushPayload,
  options?: SendToUserOptions
): Promise<void> {
  // Check push_enabled
  const user = await db.query.users.findFirst(...);
  if (!user.pushEnabled) {
    // Log skip
    return;
  }

  // Check quiet hours (unless bypass)
  if (!options?.bypassQuietHours && isInQuietHours()) {
    // Log skip
    return;
  }

  // Check frequency cap (unless bypass)
  if (!options?.bypassRateLimit && exceedsFrequencyCap(userId)) {
    // Log skip
    return;
  }

  // Actually send
  const subscriptions = await db.query.pushSubscriptions.findMany(...);
  for (const sub of subscriptions) {
    try {
      await webPush.sendNotification(sub, JSON.stringify(payload));
      // Log success
    } catch (err) {
      // Handle 410, log error
    }
  }
}
```

### Timezone helper

```typescript
function isInQuietHours(): boolean {
  const now = utcToZonedTime(new Date(), PUSH_TIMEZONE);
  const hour = getHours(now);
  const start = parseInt(process.env.PUSH_QUIET_HOURS_START || '22', 10);
  const end = parseInt(process.env.PUSH_QUIET_HOURS_END || '7', 10);
  
  if (start < end) {
    return hour >= start && hour < end; // Normal case: 22-7 (22, 23, 0-6)
  } else {
    return hour >= start || hour < end; // Wrapping case
  }
}

function exceedsFrequencyCap(userId: string): boolean {
  const cap = parseInt(process.env.PUSH_DAILY_CAP || '5', 10);
  const count = await db.query.pushNotificationLogs.count(
    where: (t, { and, eq, gt, isNull }) =>
      and(
        eq(t.userId, userId),
        isNull(t.skippedReason),
        gt(t.sentAt, sql`now() - interval '24 hours'`)
      )
  );
  return count >= cap;
}
```

## Kizárások

- Nem tartalmaz per-user fine-grained preferences-okat (pl. "felhasználó saját quiet hours" – csak globális)
- Nem tartalmaz push típus-specifikus cap-et (pl. csak match reminderek számlálódnak) – minden push a cap-be beleszámít
- Nem tartalmaz delay/retry mechanizmust a skipped push-ekhez
