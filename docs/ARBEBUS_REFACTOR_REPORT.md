# Arbebus refaktoringo ataskaita

Sutvarkyta pagal PDF santraukos kritinius punktus.

## Pakeista

| Sritis | Veiksmas | Būsena |
|---|---|---|
| Expo Router | `mobile/core/app` perkelta į `mobile/app` | Atlikta |
| MapScreen importas | `index.tsx` naudoja `@/core/features/map/MapScreen` | Atlikta |
| Mobile API endpointai | Visi pagrindiniai keliai pakeisti į `/api/...` | Atlikta |
| Mobile priklausomybės | Pridėti `expo-location`, `expo-haptics`, `expo-blur`, `expo-device`, AsyncStorage, NetInfo, Sentry | Atlikta |
| Backend search | Įdėtas lokalus POI/alias paieškos servisas | Atlikta |
| Backend transit | Įdėti minimalūs `/api/transit/plan`, `/live-buses`, `/live-eta`, `/shape/:shapeId` endpointai | Atlikta |
| Backend routing | Įdėtas `/api/routing/walk` stub maršrutas | Atlikta |
| Saugumas | `infrastructure/.env` išimtas, paliktas `.env.example` | Atlikta |
| CI | Pridėtas `.github/workflows/ci.yml` | Atlikta |

## Komandos

```bash
npm install
npm --workspace backend run dev
npm --workspace mobile start
```

## Pastaba

Šitas ZIP yra struktūriškai sutvarkytas ir turi minimalius veikiančius backend stub'us, kad API negrąžintų 404/tuščių failų klaidų. Realiam produkciniam tranzito planavimui dar reikia prijungti pilną GTFS/GTFS-RT/ORS logiką ir testuoti su Klaipėdos duomenimis.
