# Playwright E2E teszt terv

## Infrastruktúra

- **Futtatási környezet:** Docker Compose (frontend + backend + PostgreSQL 17)
- **Auth:** `VITE_DEV_AUTH_BYPASS=true` — login skip, dev-bypass-token, admin user
- **Többfelhasználós tesztek:** `sessionStorage` injection különböző user object-ekkel
- **Meglévő `data-testid` attribútumok:** ~50+ hook már elérhető a kódban
- **Teszt DB:** Minden suite előtt seed, minden suite után cleanup

---

## Szcenáriók prioritás szerint

### P0 — Kritikus útvonalak (core flows)

#### 1. Autentikáció és session

| # | Szcenárió | Elvárt eredmény |
|---|-----------|-----------------|
| 1.1 | Login dev bypass módban (email + pw kitöltés → submit) | Redirect → `/app/matches`, navbar megjelenik |
| 1.2 | Nem bejelentkezett user védett route-ra navigál | Redirect → `/login?redirect=<original>` |
| 1.3 | Login után redirect a kívánt oldalra | A `?redirect` paraméter érvényesül |
| 1.4 | Logout | Session törlődik, redirect → `/login` |
| 1.5 | Session expiry (lejárt session) | Automatikus kijelentkeztetés |

#### 2. Tipp leadás (match prediction)

| # | Szcenárió | Elvárt eredmény |
|---|-----------|-----------------|
| 2.1 | Jövőbeli meccsre tipp beírás (home + away) | 2s debounce után "Tipp elmentve! ✓" megjelenik |
| 2.2 | Tipp módosítás (új értékek beírása) | Felülírja, success újra megjelenik |
| 2.3 | Döntetlen tipp knockout meccsen → outcome gombok | Extra-time/penalty gombok megjelennek, kiválasztás mentődik |
| 2.4 | Lezárt (finished) meccsre nem lehet tippelni | Input disabled/readonly, nincs submit |
| 2.5 | Érvénytelen input (negatív szám, üres) | Nem küld POST-ot / hibajelzés |
| 2.6 | Meccs részletes nézet → saját tipp megjelenik | `/app/matches/:id` mutatja a leadott tippet |

#### 3. Csoport létrehozás és csatlakozás

| # | Szcenárió | Elvárt eredmény |
|---|-----------|-----------------|
| 3.1 | Új csoport létrehozás (név + liga kiválasztás) | Csoport megjelenik a listában invite kóddal |
| 3.2 | Csatlakozás invite kóddal (modal) | User bekerül, csoport detail megnyílik |
| 3.3 | Csatlakozás `/app/join/:code` URL-lel | Direkt join, redirect → group detail |
| 3.4 | Érvénytelen invite kód | Hibaüzenet: "Group not found" |
| 3.5 | Inaktivált invite kóddal csatlakozás | Hibaüzenet: "Invite code is no longer active" |
| 3.6 | Már tag → újra csatlakozás | Hibaüzenet: "Already a member" |

#### 4. Ranglista

| # | Szcenárió | Elvárt eredmény |
|---|-----------|-----------------|
| 4.1 | Globális ranglista betöltés | Táblázat renderelődik, saját sor kiemelve |
| 4.2 | Csoport ranglista váltás (scope dropdown) | Csoport-specifikus adatok jelennek meg |
| 4.3 | 0 tipp esetén üres/alapértelmezett megjelenés | Nem crashel, rank megjelenik (utolsó) |

---

### P1 — Fontos user journey-k

#### 5. Csoport admin műveletek

| # | Szcenárió | Elvárt eredmény |
|---|-----------|-----------------|
| 5.1 | Invite kód másolás | Clipboard-ra kerül |
| 5.2 | Invite kód újragenerálás (confirm dialog) | Új kód jelenik meg |
| 5.3 | Invite deaktiválás/aktiválás toggle | Állapot változik, API hívás sikeres |
| 5.4 | Tag eltávolítás (admin → member) | Member eltűnik a listából |
| 5.5 | Admin jog adás/elvétel | Szerepkör változik |
| 5.6 | Csoport törlés (confirm dialog) | Csoport eltűnik, redirect → groups lista |
| 5.7 | Favorite team double points toggle | Beállítás mentődik |

#### 6. Speciális tippek

| # | Szcenárió | Elvárt eredmény |
|---|-----------|-----------------|
| 6.1 | Speciális tipp kitöltés (free text) | Mentés sikeres, válasz megjelenik |
| 6.2 | Speciális tipp kitöltés (dropdown) | Kiválasztás mentődik |
| 6.3 | Speciális tipp kitöltés (team select) | Csapat kiválasztás mentődik |
| 6.4 | Speciális tipp kitöltés (player select) | Játékos keresés + kiválasztás mentődik |
| 6.5 | Deadline után nem módosítható | Input disabled/nincs submit gomb |
| 6.6 | Kiértékelés után pontok megjelennek | Pont megjelenik a speciális tippeknél |

#### 7. Profil

| # | Szcenárió | Elvárt eredmény |
|---|-----------|-----------------|
| 7.1 | Display name módosítás | Mentés sikeres, navbar frissül |
| 7.2 | Kedvenc csapat kiválasztás | Mentés sikeres |
| 7.3 | Zárolt kedvenc csapat (meccs elindult) | Selector disabled |

#### 8. Onboarding

| # | Szcenárió | Elvárt eredmény |
|---|-----------|-----------------|
| 8.1 | Első login → overlay megjelenik | 3 lépés navigálható (next/next/finish) |
| 8.2 | Skip gomb → overlay bezáródik | `onboardingCompletedAt` beállítódik |
| 8.3 | Újratöltés után nem jelenik meg újra | Csak egyszer mutatja |

---

### P2 — Admin felület

#### 9. Admin match management

| # | Szcenárió | Elvárt eredmény |
|---|-----------|-----------------|
| 9.1 | Meccs létrehozás (home/away team + dátum) | Megjelenik a listában |
| 9.2 | Meccs szerkesztés | Módosítás mentődik |
| 9.3 | Eredmény beállítás | Pontszámítás triggerelődik |
| 9.4 | Meccs törlés | Eltűnik a listából |

#### 10. Admin user management

| # | Szcenárió | Elvárt eredmény |
|---|-----------|-----------------|
| 10.1 | User lista betöltés | Összes user megjelenik |
| 10.2 | User tiltás (ban) | Badge megjelenik, user nem tud tippelni |
| 10.3 | User role változtatás | Szerepkör frissül |

#### 11. Admin sync

| # | Szcenárió | Elvárt eredmény |
|---|-----------|-----------------|
| 11.1 | Sync mód váltás | Beállítás mentődik |
| 11.2 | Manuális sync indítás | Futás elindul, státusz megjelenik |

#### 12. Admin scoring config

| # | Szcenárió | Elvárt eredmény |
|---|-----------|-----------------|
| 12.1 | Pontértékek módosítás | Mentés sikeres |
| 12.2 | Érvénytelen érték (negatív) | Validáció hibaüzenet |

---

### P3 — Edge case-ek és hibakezelés

#### 13. Hálózati hibák és edge case-ek

| # | Szcenárió | Elvárt eredmény |
|---|-----------|-----------------|
| 13.1 | API timeout tipp leadásnál | Error jelzés, retry lehetőség |
| 13.2 | 500-as hiba admin műveletnél | Toast/error banner megjelenik |
| 13.3 | Üres állapotok (0 meccs, 0 csoport) | Empty state UI renderelődik, nem crashel |
| 13.4 | Nem-admin user admin route-ra navigál | Redirect → `/app/matches` |
| 13.5 | Párhuzamos tipp módosítás (gyors input) | Debounce kezel, csak utolsó mentődik |
| 13.6 | Nagyon hosszú csoportnév / leírás | Truncálás vagy validáció működik |

#### 14. Navigáció és reszponzivitás

| # | Szcenárió | Elvárt eredmény |
|---|-----------|-----------------|
| 14.1 | Mobile hamburger menü nyit/zár | Menü megjelenik/eltűnik |
| 14.2 | Liga filter a meccslistán | Csak a szűrt liga meccsei látszanak |
| 14.3 | Lezárt meccsek szekció toggle | Kinyit/bezár, nem tölt újra |
| 14.4 | Deep link megosztás (meccs, csoport) | Oldal betöltődik a megfelelő tartalommal |

---

## Többfelhasználós szcenáriók

| # | Szcenárió | Setup | Elvárt |
|---|-----------|-------|--------|
| M1 | User A létrehoz csoportot, User B csatlakozik | 2 browser context | B megjelenik A taglistáján |
| M2 | Admin beállít eredményt → User ranglistája frissül | Admin + User context | Pontszám megjelenik |
| M3 | Group admin eltávolít tagot → tag nem lát csoportot | Admin + Member context | Csoport eltűnik a member listájáról |

---

## Implementációs javaslatok

### Teszt helper-ek

```typescript
// login helper — sessionStorage injection
async function loginAs(page: Page, user: TestUser): Promise<void>

// seed helper — API-n keresztül vagy direct DB
async function seedMatch(match: MatchInput): Promise<Match>
async function seedGroup(group: GroupInput, userId: string): Promise<Group>

// cleanup
async function resetDatabase(): Promise<void>
```

### Futtatási stratégia

- **CI:** Docker Compose up → Playwright → Docker Compose down
- **Lokális:** `docker compose up -d` → `npx playwright test`
- **Parallelizáció:** Független szcenáriók párhuzamosan (browser context isolation)
- **Flakiness prevention:** `data-testid` használat (nem CSS selector), explicit wait-ek

### Ajánlott Playwright config

- Browsers: Chromium (primary) + Firefox (secondary)
- Mobile viewport: 1 project (375×667)
- Screenshot on failure
- Video on retry
- Max 2 retry

---

## Prioritási összefoglaló

| Prioritás | Szcenáriók | Db | Érték |
|-----------|-----------|-----|-------|
| **P0** | Auth, Tipp leadás, Csoport CRUD, Ranglista | 18 | Core flow védelem |
| **P1** | Group admin, Speciális tipp, Profil, Onboarding | 18 | Fontos journey-k |
| **P2** | Admin felület | 10 | Admin műveletek |
| **P3** | Edge case-ek, navigáció | 10 | Robusztusság |
| **Multi** | Többfelhasználós | 3 | Integrációs biztonság |
| **Összesen** | | **59** | |

MVP: P0 (18 teszt) → teljes lefedettség: 59 teszt.
