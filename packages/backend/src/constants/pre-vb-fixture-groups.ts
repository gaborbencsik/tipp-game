// Statikus, kézzel kurált fixture csoportok a Pre-VB Edzőmeccsek 1./2./3. ligákhoz.
// Egyetlen forrása az igazságnak: a sync csak ezeket a meccseket tölti be.
// Új fixture nem kerül be automatikusan; eltűnő/törlődő API fixture-rel a meccs
// a DB-ben marad (státusza nem frissül a konkrét eseményig).
//
// Csoportonként pontosan 22 meccs (összesen 66). A short_name kulcsa megegyezik
// a leagues tábla short_name oszlopával (lásd 0032_pre_wc_friendly_league_split.sql).

export type PreVbGroupShortName = 'PRE-VB-1' | 'PRE-VB-2' | 'PRE-VB-3'

export const PRE_VB_FIXTURE_GROUPS: Readonly<Record<PreVbGroupShortName, readonly number[]>> = {
  'PRE-VB-1': [
    1545695, // 2026-05-21 15:30  Qatar vs Sudan
    1528281, // 2026-05-23 02:00  Mexico vs Ghana
    1545261, // 2026-05-26 16:00  Morocco vs Burundi
    1543816, // 2026-05-28 12:00  Egypt vs Russia
    1528282, // 2026-05-28 18:45  Rep. Of Ireland vs Qatar
    1544803, // 2026-05-29 12:00  Iran vs Gambia
    1543817, // 2026-05-29 16:00  South Africa vs Nicaragua
    1544356, // 2026-05-29 16:00  Andorra vs Iraq
    1540947, // 2026-05-29 18:30  Bosnia & Herzegovina vs FYR Macedonia
    1511779, // 2026-05-30 12:00  Scotland vs Curaçao
    1540948, // 2026-05-30 23:30  Ecuador vs Saudi Arabia
    1545263, // 2026-05-31 01:00  South Korea vs Trinidad and Tobago
    1527865, // 2026-05-31 02:00  Mexico vs Australia
    1540351, // 2026-05-31 10:25  Japan vs Iceland
    1528283, // 2026-05-31 13:00  Switzerland vs Jordan
    1543819, // 2026-05-31 13:30  Cape Verde Islands vs Serbia
    1545035, // 2026-05-31 14:00  Czech Republic vs Kosovo
    1501818, // 2026-05-31 18:45  Germany vs Finland
    1503008, // 2026-05-31 19:30  USA vs Senegal
    1536926, // 2026-05-31 21:30  Brazil vs Panama
    1543821, // 2026-06-01 16:30  Türkiye vs FYR Macedonia
    1536927, // 2026-06-01 17:00  Norway vs Sweden
  ],
  'PRE-VB-2': [
    1511733, // 2026-06-01 18:45  Austria vs Tunisia
    1537648, // 2026-06-01 23:00  Colombia vs Costa Rica
    1514472, // 2026-06-02 01:00  Canada vs Uzbekistan
    1512766, // 2026-06-02 16:00  Croatia vs Belgium
    1545264, // 2026-06-02 17:00  Morocco vs Madagascar
    1536929, // 2026-06-02 18:45  Wales vs Ghana
    1544806, // 2026-06-03 00:00  Haiti vs New Zealand
    1543822, // 2026-06-03 18:00  Denmark vs Congo DR
    1536930, // 2026-06-03 18:45  Netherlands vs Algeria
    1542891, // 2026-06-04 00:45  Panama vs Dominican Republic
    1544807, // 2026-06-04 01:00  South Korea vs El Salvador
    1542552, // 2026-06-04 17:00  Sweden vs Greece
    1544359, // 2026-06-04 19:00  Spain vs Iraq
    1536931, // 2026-06-04 19:10  France vs Ivory Coast
    1542893, // 2026-06-05 00:00  Guatemala vs Czech Republic
    1528284, // 2026-06-05 02:00  Mexico vs Serbia
    1543828, // 2026-06-05 22:15  Paraguay vs Nicaragua
    1528285, // 2026-06-05 23:30  Canada vs Rep. Of Ireland
    1544811, // 2026-06-06 00:00  Haiti vs Peru
    1512767, // 2026-06-06 13:00  Belgium vs Tunisia
    1528286, // 2026-06-06 17:45  Portugal vs Chile
    1502474, // 2026-06-06 18:30  USA vs Germany
  ],
  'PRE-VB-3': [
    1542181, // 2026-06-06 19:00  Australia vs Switzerland
    1544360, // 2026-06-06 19:00  Panama vs Bosnia & Herzegovina
    1525492, // 2026-06-06 20:00  England vs New Zealand
    1528287, // 2026-06-06 20:00  Brazil vs Egypt
    1540949, // 2026-06-06 20:00  Bolivia vs Scotland
    1544361, // 2026-06-06 20:00  Qatar vs El Salvador
    1543829, // 2026-06-06 23:00  Venezuela vs Türkiye
    1537650, // 2026-06-07 00:00  Curaçao vs Aruba
    1540355, // 2026-06-07 00:00  Argentina vs Honduras
    1512768, // 2026-06-07 18:45  Croatia vs Slovenia
    1540950, // 2026-06-07 19:00  Morocco vs Norway
    1542182, // 2026-06-07 20:00  Ecuador vs Guatemala
    1528288, // 2026-06-07 23:00  Colombia vs Jordan
    1544812, // 2026-06-08 18:45  Netherlands vs Uzbekistan
    1542183, // 2026-06-08 19:10  France vs Northern Ireland
    1540356, // 2026-06-09 02:00  Peru vs Spain
    1544367, // 2026-06-09 16:00  Congo DR vs Chile
    1544368, // 2026-06-09 23:00  Saudi Arabia vs Senegal
    1540357, // 2026-06-10 00:30  Iceland vs Argentina
    1540358, // 2026-06-10 19:45  Portugal vs Nigeria
    1525494, // 2026-06-10 20:00  England vs Costa Rica
    1542184, // 2026-06-11 04:00  Austria vs Guatemala
  ],
} as const

export const PRE_VB_GROUP_SHORT_NAMES: readonly PreVbGroupShortName[] = [
  'PRE-VB-1',
  'PRE-VB-2',
  'PRE-VB-3',
]

export const PRE_VB_ALL_FIXTURE_IDS: readonly number[] = Object.values(PRE_VB_FIXTURE_GROUPS).flat()
