# Liga-epic – függőségi gráf (US-940 / US-949 follow-up)

> Utoljára frissítve: 2026-07-22. A ✅ = kész (history-ban), üres = nyitott (backlog).
> Amíg nem lesz minden kész, ezt a fájlt csak **frissítsd** (jelöld ✅-vel a lezártakat), ne generáld újra.

## Gráf

```
✅ US-940 (Liga archiválás)          ✅ US-949 (Ligák DB-alapú, backend-1)
   │         │                          │       │        │
   ▼         ▼                          ▼       │        ▼
US-954    US-948 ◄──────────────────────┘       │     US-950 (backend-2: sync-mezők CRUD)
(archived  (admin liga-oldal:                    │        │        │
 torna     státusz badge +                       │        │        │
 tippek)   archiválás/restore)                   │        │        │
              │                                   │        │        │
              │         ┌─────────────────────────┘        │        │
              ▼         ▼                                    ▼        │
           US-951 (admin liga-menedzsment UI ◄──────────────┘        │
              │         létrehozás/szerkesztés sync-mezőkkel)         │
              │                                                        │
              └──────────────┬─────────────────────────────────────────┘
                             ▼
                          US-956 (per-liga on-demand szinkron az admin UI-ból)


Független (nincs 940/949 függőség, de a batch része):
US-952 (több liga egy csoportban) ──► US-953 (egyedi meccs behúzása csoportba)
US-955 (globális ranglista nézet eltávolítása)  [önálló]
```

## Élek

| Story | Státusz | Cím | Függ ettől |
|-------|---------|-----|-----------|
| US-940 | ✅ | Liga archiválás (soft-hide) | — |
| US-949 | ✅ | Ligák DB-alapúvá tétele (backend-1) | — |
| US-948 | ✅ | Admin liga-oldal (frontend) – státusz badge + archiválás/restore | ✅US-940, ✅US-949 |
| US-950 | ✅ | Liga-CRUD kiterjesztés (backend-2) – sync-mezők a create/update-ben | ✅US-949 |
| US-951 |  | Admin liga-menedzsment UI – létrehozás/szerkesztés sync-mezőkkel | US-948, US-950 |
| US-952 |  | Több liga egy csoportban | — |
| US-953 |  | Egyedi meccs behúzása csoportba | US-952 |
| US-954 |  | Archivált liga → torna tippek elrejtése | ✅US-940 |
| US-955 |  | „Összesített" (globális) ranglista nézet eltávolítása | — |
| US-956 |  | Per-liga on-demand szinkron az admin UI-ból | ✅US-949, US-950, US-951 |

## Kritikus lánc

**US-949 → US-950 → US-951 → US-956** (leghosszabb út). US-948 az US-951 másik előfeltétele.
