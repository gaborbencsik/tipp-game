# VB Tippjáték – Kiegészítő Ötletek és Nice-to-Have Funkciók

> Verzió: 1.0 | Dátum: 2026-03-27

---

## E10 – UX / Engagement / Gamification

Az alábbi ötletek mind értéket adnak a platformhoz, de nem blokkolják az MVP kiadását.
Prioritásuk: **Nice to Have** – a Must Have és Should Have funkciók után implementálhatók.

---

### 🏆 1. Jelvény (Badge) rendszer

Automatikusan adható jelvények teljesítmények alapján, pl.:
- "Pontosságkirály" – 5 egymást követő pontos találat
- "Szerencsehozó" – első meccs lezárásakor pont
- "Csoportgyőztes" – egy csoport ranglistáján az 1. hely

**Hozzáadott érték:** Gamification, visszatérő látogatást ösztönöz, a profil oldalt gazdagabbá teszi.

---

### 📊 2. Tippelési statisztikák (egyéni dashboard)

Személyes statisztikai oldal minden felhasználónak:
- Pontos találatok aránya (%)
- Legjobb/legrosszabb forduló
- Gólszám-tippek pontossága (pl. átlagos eltérés)
- Eredmény-előrejelzés bias vizualizálva (túl sok hazai? túl sok döntetlen?)

**Hozzáadott érték:** Felhasználók mélyebben foglalkoznak az adataikkal, hosszabb session idő.

---

### ⏰ 3. Email / Push értesítések (nyitott meccsek)

- Tippelési emlékeztető: X órával a meccs előtt email/push értesítés, ha nincs még tipp leadva
- Eredmény értesítő: meccs lezárása után "X pontot kaptál a [meccs] tippedre"
- Csoport értesítő: "Valaki megelőzött a csoportban!"

**Hozzáadott érték:** Visszahozza a felhasználókat az appba, csökkenti a lemaradt tippek számát.

---

### 📅 4. Tippelési határidő-számláló (countdown)

Minden nyitott meccsnél visszaszámláló mutatja, mennyi idő van a tippelésig.
Real-time frissülő (`setInterval` vagy Vue `useIntervalFn`).

**Hozzáadott érték:** Sürgősség érzete, vizuálisan vonzó UI elem. Emlékezteti a usert, hogy hamarosan zár.

---

### 🗺️ 5. VB brakett / csoportkör vizualizáció

Interaktív torna brakett nézet, ahol:
- A csoportkör eredményei és a továbbjutók láthatók
- A kieső szakaszban a mérkőzések automatikusan töltik a brakettet az eredmények alapján
- Opcionálisan: a user saját tippjei is megjelennek a braketten

**Hozzáadott érték:** Vizuálisan leglátványosabb feature. Nagyon megosztható (social virality).

---

### 👥 6. Csoport chat / kommentszekció

Csoportonként egy egyszerű szöveges üzenetfal (nem real-time, csak frissítéskor tölt), ahol a tagok kommentálhatnak meccsek után.

**Hozzáadott érték:** Közösségépítés, a barátok élménye gazdagabb. Nem kell Whatsapp-ba visszamenni megvitatni az eredményt.

---

### 🌍 7. Publikus csoport könyvtár

Nyilvános csoportok listája, amelyekhez bárki csatlakozhat (nem invite-only).
Pl. "Szurkolói klub ranglista", "Kolléga bajnokság (nyílt)".

**Hozzáadott érték:** Organikus felhasználószerzés, nagyobb verseny élmény annak, akinek nincs baráti csoportja.

---

### 📱 8. PWA (Progressive Web App) támogatás

A Vue frontend manifest.json és service worker hozzáadásával telepíthető az asztali/telefonos home screen-re.
Push értesítések Web Push API-n keresztül.

**Hozzáadott érték:** Natív app élmény telepítés nélkül. Android-on különösen erős alternatíva.

---

### 🔄 9. Meccs adatok automatikus importálása

Integráció egy ingyenes / fizetős labdarúgás API-val (pl. api-football.com, football-data.org):
- Meccsek automatikus importálása az admin panelbe
- Élő eredmények lekérdezése (live score polling)
- Csapat adatok és zászlók automatikus szinkronizálása

**Hozzáadott érték:** Csökkenti az admin munkaterhelést, kevesebb manuális adatbevitel, csökkenti az emberi hibák esélyét.

---

### 📈 10. Trend / forma chart a ranglistán

A ranglistán minden játékosnál egy mini spark chart mutatja az utolsó N meccs után szerzett pontjait.
Vizualizálja a "formát" – ki van jól teljesítve mostanában.

**Hozzáadott érték:** Adatvizualizáció, engrossing élmény, a leadboard nem csak egy unalmas szám-lista.

---

### 🎯 11. Head-to-head összehasonlítás

Két felhasználó egymás ellen mutatva:
- Meccsenként melyikük tippelt közelebb
- Összesített nyerési arány
- Jelenlegi "sorozat" (pl. 3 meccs óta X vezet)

**Hozzáadott érték:** Baráti rivalizálás szítása, extra motiváció a rendszeres visszatérésre.

---

### 🔒 12. Tipp-felfedés időzítő (Blackout period)

Beállítható konfig: mások tippjei csak X perccel/óával a meccs zárása UTÁN láthatók – így senki nem tud a "többi tipp alapján igazodni" az utolsó percben.

**Hozzáadott érték:** Fair play garantálása, versenyszerűbb élmény.

---

### 🌐 13. Többnyelvűség (i18n)

`vue-i18n` integrációval magyar és angol nyelv támogatása.
Az admin felületen is kapcsolható.

**Hozzáadott érték:** Ha a csoport tagjainak egy része nem magyar, mindenki a saját nyelvén használhatja az appot.

---

## Összefoglalás – prioritás

| # | Ötlet | Hozzáadott érték | Impl. nehézség |
|---|-------|-----------------|----------------|
| 1 | Badge rendszer | Magas | M |
| 2 | Személyes statisztika | Magas | M |
| 3 | Email értesítések | Magas | M |
| 4 | Countdown timer | Közepes | S |
| 5 | VB brakett vizualizáció | Nagyon magas | L |
| 6 | Csoport chat | Közepes | M |
| 7 | Publikus csoportkönyvtár | Közepes | S |
| 8 | PWA | Közepes | S |
| 9 | API auto-import | Nagyon magas (admin UX) | L |
| 10 | Trend/forma chart | Közepes | M |
| 11 | Head-to-head | Magas | M |
| 12 | Blackout period | Közepes | S |
| 13 | i18n | Alacsony-Közepes | M |

**Top 3 javasolt post-MVP feature:**
1. **Countdown timer** (S – gyors win, jó UX)
2. **Email értesítések** (M – visszahozza a usereket)
3. **VB brakett vizualizáció** (L – legnagyobb wow-factor)
