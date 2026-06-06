---
id: PUSH-008
title: Admin toggle az automatikus push-okra (kickoff reminder + daily review)
priority: Should Have
status: Done
dependencies: [PUSH-002, PUSH-004]
complexity: S
epic: E15 – Értesítések (webpush)
---

# PUSH-008: Admin toggle az automatikus push-okra

## Háttér

A PUSH-002 (kickoff reminder, 15 percenként) és PUSH-004 (daily review, naponta 12:00 CET) cron jobok automatikusan küldenek értesítéseket. Üzemeltetési helyzetekben (pl. teszt, hiba, váratlan torna-szünet) szükség lehet **gyors leállításra a kód módosítása nélkül**.

## Story

Mint **admin**, szeretném a `/admin/push` oldalon **ki/be kapcsolni** a 2 automatikus push job-ot (kickoff reminder, daily review), hogy a Render cron service változtatása nélkül megállíthassam vagy újraindíthassam őket.

## Elfogadási kritériumok

### DB

- [x] Új `push_settings` tábla, singleton row-val:
  - `id` UUID PK
  - `kickoff_reminder_enabled` BOOLEAN NOT NULL DEFAULT true
  - `daily_review_enabled` BOOLEAN NOT NULL DEFAULT true
  - `updated_at` TIMESTAMPTZ NOT NULL DEFAULT now()
- [x] Migration: `0064_push_settings.sql` — tábla létrehozása + 1 default row beszúrása.

### Backend

- [x] `services/push-settings.service.ts`:
  - `getPushSettings()` — singleton row visszaadása (default ha nincs sor)
  - `setKickoffReminderEnabled(enabled)`, `setDailyReviewEnabled(enabled)` — `ensureRow()` + UPDATE
- [x] A 2 cron job a futás elején `getPushSettings()`-et hív; ha a flag false → silent skip, log: `"kickoff reminder skipped: disabled"` vagy `"daily review skipped: disabled"`, a return értékben `sent: 0`.
- [x] Új admin endpointok:
  - `GET /api/admin/push/settings` → `{ kickoffReminderEnabled, dailyReviewEnabled }`
  - `PUT /api/admin/push/settings` body: `{ kickoffReminderEnabled?, dailyReviewEnabled? }` (legalább egyik); validálás: csak boolean.
- [x] Job tesztek bővülnek: ha disabled → 0 sent, `sendToUser` nincs hívva.

### Frontend

- [x] `AdminPushView.vue` új szekció **„Automatikus push-ok"** a manuális küldés fölött:
  - 2 checkbox: **Kickoff reminder** és **Daily review**, leírással
  - Kattintásra auto-save (`change` event), backend mentés után 2s-os „Elmentve." visszajelzés
  - Loading + error állapotok
- [x] API kliens: `getSettings(token)`, `updateSettings(token, params)`
- [x] `data-testid` attribútumok: `admin-push-automation-section`, `admin-push-toggle-kickoff-reminder`, `admin-push-toggle-daily-review`

### Tesztek

- [x] Job tesztek bővülnek a disabled esettel (mindkét cronra).
- [x] Mocknak default `kickoffReminderEnabled: true, dailyReviewEnabled: true` kell.

## Kizárások (nem ebben a story-ban)

- Per-user opt-out a daily review-ból (post-MVP user beállítás).
- Globális „minden push tiltása" master switch — most a 2 flag elég, az admin broadcast (PUSH-007) explicit, manuális akció.
- Audit log a toggle-eseményekhez — az `updated_at` mező alapján visszanyomozható, részletes audit külön story.

## Technikai megjegyzések

- A flag check a `webpush.service.sendToUser()`-en kívül történik (a job legelején), így a `push_notification_log`-ba sem kerül `skipped_reason` bejegyzés disabled állapotban — a job egyszerűen ki sem indul.
- Az admin broadcast (PUSH-007) ezeket a flag-eket **nem** veszi figyelembe; manuális küldést mindig lehet, függetlenül a cron állapottól.
- Az 0064 migráció egy alkalommal `AUTO_BASELINE_UP_TO_IDX` környezeti változó miatt baseline-olódhat (csak journal-ba kerül, SQL nem fut le); ilyen esetben kézi alkalmazás szükséges.

**Komplexitás:** S
**Prioritás:** Should Have
