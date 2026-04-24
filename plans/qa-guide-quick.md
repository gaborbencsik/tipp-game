# Tesztelési útmutató — VB Tippjáték

> Nyisd meg az oldalt és kövesd végig a lépéseket sorban.

---

## 1. Bejelentkezés

- [ ] Nyisd meg: https://tipp-game.vercel.app/login
- [ ] Kattints a bejelentkezés gombra
- [ ] A Meccsek oldalra kerülsz

## 2. Onboarding

- [ ] Első bejelentkezéskor megjelenik egy bemutató overlay (3 lépés)
- [ ] Kattints végig a "Tovább" gombokkal, vagy nyomj "Kihagyás"-t
- [ ] Frissítsd az oldalt → NEM jelenik meg újra
- [ ] Jobb felső avatar → "Bemutató újranézése" → újra megjelenik

## 3. Meccsek és tippek

- [ ] Meccsek listáján nézd meg, hogy a csapatlobogók megjelennek-e
- [ ] Kattints egy jövőbeli meccsre → írd be a tipped (pl. 2-1) → Mentés
- [ ] Módosítsd a tippet → más eredményre → Mentés
- [ ] Ha vannak lejátszott meccsek: a lista tetején összecsukva jelennek meg → kattintással kinyitható

## 4. Csoport létrehozása

- [ ] Bal menü → Csoportok → "Csoport létrehozása"
- [ ] Adj nevet (pl. "Teszt csoport") → Létrehozás
- [ ] Megjelenik a csoport részletek oldal

## 5. Csoport ranglista

- [ ] A Ranglista tab automatikusan aktív
- [ ] Látszanak az oszlopok: #, Játékos, Tipp, Helyes, **Stat**, Pont
- [ ] A saját sorod kéken kiemelve, "(te)" jelöléssel

## 6. Stat tipp létrehozása (admin)

- [ ] Beállítások tab → görgess le a "Stat tipp típusok" szekcióhoz
- [ ] "+ Új stat tipp típus" → töltsd ki:
  - Név: "Gólkirály"
  - Típus: Szabad szöveg
  - Pont: 5
  - Határidő: holnapi dátum
- [ ] Létrehozás → megjelenik a kártya a listában

## 7. Stat tipp leadása

- [ ] Stat tippek tab → a "Gólkirály" kártya megjelenik
- [ ] Írd be a tipped (pl. "Mbappé") → Leadás → "Mentve!"
- [ ] Módosítsd (pl. "Messi") → Módosít → "Mentve!"

## 8. Stat tipp kiértékelése (admin)

- [ ] Beállítások tab → a "Gólkirály" kártyán kattints "Kiértékel"
- [ ] Írd be a helyes választ (pl. "Messi") → Kiértékelés
- [ ] "Helyes válasz: Messi" megjelenik a kártyán
- [ ] Stat tippek tab → a kártyán megjelenik a pontszám (+5 vagy 0)
- [ ] Ranglista tab → a Stat oszlopban megjelenik a pont

## 9. Meghívó és csatlakozás

- [ ] Tagok tab → Meghívó kód szekció
- [ ] "Link másolása" → küldd el másnak → ő ezzel tud csatlakozni
- [ ] Próbáld ki: "Deaktiválás" → "Aktiválás" → kód állapota változik
- [ ] "Újragenerálás" → megerősítés után új kód

## 10. Tagkezelés

- [ ] Ha más is csatlakozott: az "Eltávolít" és "Admin" gombok működnek
- [ ] A saját sorod gombjai szürkék (nem kattinthatók)

## 11. Csoport törlése

- [ ] Tagok tab alján → "Csoport törlése" → megerősítés → visszakerülsz a csoportlistára

## 12. Ranglista

- [ ] Bal menü → Ranglista → globális ranglista megjelenik
