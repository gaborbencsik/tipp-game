---
id: AUTH-001
title: Supabase jelszó-helyreállítás támogatása (frontend)
priority: Should Have
status: Open
epic: Auth / Account management
dependencies: []
complexity: M
---

# AUTH-001: Supabase jelszó-helyreállítás támogatása (frontend)

## Probléma

Jelenleg nincs módja a felhasználónak a jelszót helyreállítani, ha elfelejtette. A Supabase biztosít egy email-alapú password recovery flow-t (az admin manuálisan küldi a recovery linket a Dashboard-ból), de az alkalmazásnak nincs UI-ja, amely ezt a linket kezelne és a user új jelszót tudna beállítani.

A recovery link `{{ .SiteURL }}/auth/reset-password#access_token=...&type=recovery` formátumon érkezik, és a Supabase kliens automatikusan session-t épít a hash-ből.

---

## Story

Mint **felhasználó**, szeretném, hogy **a Supabase recovery linket követve az alkalmazásban tudok új jelszót beállítani**, hogy **helyreállíthassam a fiókot, ha elfelejtette a jelszót**.

---

## Elfogadási kritériumok

### A — Reset Password view

1. [ ] Új Vue 3 komponens: `packages/frontend/src/views/ResetPasswordView.vue`
2. [ ] Megjelenik az `/auth/reset-password` routon
3. [ ] Tartalmaz:
   - Képernyő-cím ("Jelszó helyreállítása")
   - Alcím ("Adj meg egy új jelszót a fiók helyreállításához")
   - Jelszó input (`type="password"`)
   - Jelszó megerősítés input (`type="password"`)
   - "Jelszó beállítása" gomb (alapértelmezés szerint letiltva, ha a form üres vagy hibás)
   - Locale toggle a fejlécben (ahogy a `LoginView.vue`-ban is van)

### B — Validáció

1. [ ] **Minimum hossz:** 8 karakter (a Supabase default-ja)
   - Ha < 8 karakter: inline hibaüzenet: "Legalább 8 karakternek kell lennie"
   - Gomb letiltva
2. [ ] **Egyezés:** a jelszó és megerősítés mezőnek azonosnak kell lennie
   - Ha nem egyezik: inline hibaüzenet: "A jelszavak nem egyeznek"
   - Gomb letiltva
3. [ ] Csak akkor működhet a submit, ha mindkét felhasználót kitöltötte és valid a jelszó

### C — Supabase session és update

1. [ ] A component mountesakor: `supabase.auth.getSession()`
   - Ha nincs session: "Sajnos a helyreállítási link lejárt vagy nem érvényes. Kérj egy új linket az adminisztrátortól." hibaüzenet, a form inputok letiltottak
   - Ha van session: a form aktív marad
2. [ ] Submit: `supabase.auth.updateUser({ password: newPassword })`
3. [ ] Sikerkor: zöld üzenet "Jelszó sikeresen beállítva!" + 2 mp késleltetés után auto-redirect `/app/matches`-re
4. [ ] Hiba:
   - Ha gyenge jelszó (a Supabase-ből jön az error): "Az új jelszó nem felel meg a biztonsági követelményeknek"
   - Ha egyéb error: "Hiba történt. Kérj egy új helyreállítási linket az adminisztrátortól."
   - Az error üzenet 5 mp után eltűnik vagy closeButton van rá
5. [ ] Loading state: submit közben a gomb "Beállítás alatt..." szövegben, letiltva

### D — I18n kulcsok

Mindkét lokalizáció (HU + EN) kötelező a `packages/frontend/src/i18n/locales/hu.json` és `en.json` fájlokba:

```
resetPassword.title
resetPassword.subtitle
resetPassword.newPasswordLabel
resetPassword.newPasswordPlaceholder
resetPassword.confirmLabel
resetPassword.confirmPlaceholder
resetPassword.submit
resetPassword.submitting
resetPassword.successMessage
resetPassword.errors.linkExpired
resetPassword.errors.weakPassword
resetPassword.errors.mismatch
resetPassword.errors.generic
login.forgotPassword.label
login.forgotPassword.hint
```

Értékek lehetőség:
- HU: "Elfelejtett jelszó?", EN: "Forgot password?"
- HU: "Az adminisztrátortól kérhetsz egy helyreállítási linket.", EN: "Ask an administrator for a recovery link."
- Mismatch: HU: "A jelszavak nem egyeznek", EN: "Passwords do not match"
- Min length: HU: "Legalább 8 karakternek kell lennie", EN: "Password must be at least 8 characters"
- Link expired: HU: "Sajnos a helyreállítási link lejárt vagy nem érvényes. Kérj egy új linket az adminisztrátortól.", EN: "The recovery link has expired or is invalid. Request a new link from an administrator."
- Weak password: HU: "Az új jelszó nem felel meg a biztonsági követelményeknek", EN: "The new password does not meet security requirements"
- Generic error: HU: "Hiba történt. Kérj egy új helyreállítási linket az adminisztrátortól.", EN: "An error occurred. Request a new recovery link from an administrator."
- Success: HU: "Jelszó sikeresen beállítva!", EN: "Password successfully set!"

### E — LoginView módosítás

1. [ ] `LoginView.vue` "Elfelejtett jelszó?" linkje vagy szöveg beágyazva (statikus információ, nem clickable link — nem self-service flow)
   - Szöveg: "Elfelejtett jelszó? Vedd fel a kapcsolatot az adminnal a helyreállítási linkért."
   - Csak informatív, az admin küldi majd a recovery linket az emailben

### F — Router

1. [ ] Új route: `{ path: '/auth/reset-password', name: 'reset-password', component: ResetPasswordView }`
   - **NEM kell** `requiresAuth: true` meta — a recovery session a hash parsing révén épül fel
   - Public route

### G — Tesztek (TDD kötelező)

1. [ ] `packages/frontend/src/views/ResetPasswordView.test.ts`:
   - **Mount és renderelés:** a komponens rendereli a jelszó inputokat, a labelt, a gombot, locale togglet
   - **Validáció < 8 karakter:** ha jelszó < 8 karakter, inline error megjelenik ("Legalább 8..."), gomb letiltva, **nem** megy API hívás
   - **Validáció mismatch:** ha jelszavak nem egyeznek, inline error ("nem egyeznek"), gomb letiltva, **nem** megy API hívás
   - **Nincs session:** `supabase.auth.getSession()` returál `null` → "lejárt link" error kijelzve, inputok letiltottak
   - **Sikeres jelszó beállítás:** 
     - Session aktív (`getSession()` van)
     - User kitölt két helyes jelszó-t
     - Submit → `supabase.auth.updateUser({ password })` meghívva, success üzenet kijelzve
     - 2 mp után `router.push('/app/matches')` meghívva
   - **`updateUser` error (weak password):** error state kijelzve, error message látható
   - **`updateUser` error (generic):** error state kijelzve
   - Loading state: submit közben gomb szövege "Beállítás alatt...", letiltva
   - Mock: `supabase.auth`, `router.push`, i18n

2. [ ] `packages/frontend/src/router/index.test.ts` (ha már létezik):
   - `/auth/reset-password` route létezik
   - Nincs `requiresAuth` meta az útvonalon

### H — Meglévő tesztek

1. [ ] Egy futtatás után az **összes** teszt zöld marad (LoginView teszt, router teszt, auth store teszt, stb.)

---

## Technikai megjegyzések

### Supabase setup (operátor teendő — NEM fejlesztői feladat)

Ezek az alábbi konfigurációk **csak dokumentáció** — az implementáció után az üzemeltető/admin konfigurálni kell:

1. **Supabase Dashboard → Authentication → URL Configuration → Redirect URLs**
   - Add: `https://app.example.com/auth/reset-password` (prod URL)
   - Add: `http://localhost:5173/auth/reset-password` (local dev URL)
   - Save

2. **Supabase Dashboard → Authentication → Email Templates → Reset Password**
   - **Current template:** valami hasonló a `{{ .ConfirmationURL }}`-hez
   - **Beállítandó template:**
     ```
     <a href="{{ .SiteURL }}/auth/reset-password#access_token={{ .Token }}&type=recovery">
       Jelszó helyreállítása
     </a>
     ```
   - Ezzel a linkkel a `#access_token=...&type=recovery` hash a Supabase kliens automatikusan beépíti a session-be
   - **Alternatíva (gyakorlat):** az üzemeltető a Supabase Dashboard-ról **Generate Link** gombbal kér linket manuálisan, ezt poszt-mailben küldi a usernek

### Érintett fájlok

**Új fájlok:**
- `packages/frontend/src/views/ResetPasswordView.vue` (komponens)
- `packages/frontend/src/views/ResetPasswordView.test.ts` (tesztek)

**Módosított fájlok:**
- `packages/frontend/src/router/index.ts` (route hozzáadása)
- `packages/frontend/src/views/LoginView.vue` (infotext "Elfelejtett jelszó?")
- `packages/frontend/src/i18n/locales/hu.json` (i18n kulcsok + értékek)
- `packages/frontend/src/i18n/locales/en.json` (i18n kulcsok + értékek)
- `packages/frontend/src/router/index.test.ts` (ha létezik — route teszt)

### Komponens-felépítés referencia

Inspiráció: `packages/frontend/src/views/LoginView.vue`
- LocaleToggle a header-ben
- `useI18n()` hook a szövegekhez
- `useRouter()` auto-redirect-hez
- Supabase kliens import: `import { useSupabase } from '@/composables/useSupabase'` (vagy direktben `supabase` az auth store-ból)
- Tailwind v4 stílusok (ahogy LoginView)
- Error/success toast vagy inline alert (a projekt stílusa szerint — lásd `UX-012: Toast notification rendszer`)

---

## Mit NE csinálj

- Ne írj **self-service** "Elfelejtettem a jelszót" UI-t, amely `supabase.auth.resetPasswordForEmail()` hívást végez — ez egy **jövőbeli story** lehet (AUTH-002)
- Ne módosítsd a backend-et — az Auth szerver (Supabase) intézi
- Ne adj hozzá DB migrációt vagy schema-változást
- Ne audit-logozd a password change-et — a Supabase már logol
- Ne az admin email-hez kötöd a recovery linket (az **egy jövőbeli feature** lehet)

---

## Kizárások

Nem része ennek a story-nak:

- Self-service password reset form (`supabase.auth.resetPasswordForEmail()` egy másik view-ban) — jövő: AUTH-002
- Email template fine-tuning (HTML design, branding) — szysadmin feladata, nem dev
- Multi-factor auth (MFA) a password reset-hez — jövő: AUTH-003
- Password strength meter/rating UI — jövő: UX story
- Audit log / compliance reporting — jövő: OPS story

---

## Komplexitás

**M** — fél nap (~4-5 óra)

- ResetPasswordView komponens: ~1 óra
- Validáció + session check: ~45 perc
- I18n kulcsok: ~30 perc
- LoginView módosítás: ~15 perc
- Router: ~15 perc
- Tesztek (mock + assertions): ~1.5 óra
- Manual smoke test (lejárt link, sikeres reset): ~30 perc

---

## Prioritás

Should Have — felhasználó számára kritikus, de jelen pillanatban az admin manuálisan kezeli a recovery linkeket.

---

## Függőségek

—
