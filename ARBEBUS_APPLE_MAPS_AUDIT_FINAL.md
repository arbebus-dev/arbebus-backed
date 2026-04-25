# Arbebus Apple Maps struktūros final audit

Atlikta pagal paskutinį ZIP paketą.

## Palikta kaip tikras produkto branduolys

- `backend/` – Render API, GTFS, PostgreSQL planner, live buses, places, news.
- `backend/data/gtfs/` ir `backend/services/data/gtfs/` – GTFS failai išliko.
- `render.yaml` – Render start command išliko: `node backend/server.js`.
- `constants/api.ts` – frontend kviečia Render backend: `EXPO_PUBLIC_API_BASE` arba fallback `https://arbebus-backed.onrender.com`.
- `app/(tabs)/index.tsx` – aktyvus app entry kelias į `core/features/map/MapScreen.tsx`.

## Išvalyta / pašalinta iš frontend paketo

- root `data/` – senas leave-alert/news/stops frontend dubliavimas.
- root `services/` – senas frontend services sluoksnis.
- root `utils/` – senas home/weather sluoksnis.

Šitie folderiai nebuvo reikalingi Apple Maps transit ekranui ir kėlė TypeScript klaidas.

## Sutvarkyta Apple Maps struktūra

Aktyvi struktūra:

```txt
app/(tabs)/index.tsx
  -> core/features/map/MapScreen.tsx

core/features/map/
  MapScreen.tsx
  MapCanvas.tsx
  TopSearchBar.tsx
  SearchResultsSheet.tsx
  JourneySheet.tsx
  RouteOptionCard.tsx
  StepInstructionCard.tsx
  hooks/
  layers/

core/features/transit/
  hooks/
  models/
  services/transitApi.ts
```

## Pataisyta

- `TransitRouteOption`, `TransitStep`, `LiveBus`, `Bus`, `PlaceSearchResult` suvienodinti per `transitTypes.ts`.
- `LiveBusesLayer.tsx` importuoja tikrą `LiveBus` tipą.
- `MapCanvas.tsx` pataisytas, kad `onPress` tipas nelaužytų `MapView`.
- `useMapScreenController.ts` išvalytas nuo seno `home`, `TravelMode`, `PlaceSuggestion`, `rideBooking` importų.
- `useRideState.ts` perrašytas į Apple Maps transit būsenas.
- `RouteOptionCard.tsx` ir `StepInstructionCard.tsx` importuoja iš `transitTypes.ts`.
- `GlassCard.tsx`, `ModeChip.tsx`, `UltraPressable.tsx` sutvarkyti, kad nebūtų nereikalingų strict klaidų.
- `tsconfig.json` paliktas realiam produkto testui, bet be `baseUrl` / `ignoreDeprecations` klaidų.

## Paleidimas

```bash
npm install
npx tsc --noEmit
npx expo start -c
```

Backend:

```bash
npm run backend
```

Render:

```txt
startCommand: node backend/server.js
```
