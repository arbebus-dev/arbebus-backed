# Arbebus v1 – Apple Maps for buses

## Kas sutvarkyta

- Palikta tik švari v1 struktūra: `app`, `core/features/map`, `core/features/transit`, `constants`, `assets`.
- Pašalintos senos build lūžtančios kryptys: auth, pay, menu, taxi, scooter, airport, RevenueCat, leave alerts.
- `app/(tabs)/index.tsx` dabar krauna tik `MapScreen`.
- `MapCanvas` naudoja iOS tinkamą `PROVIDER_DEFAULT`, kad matytųsi Apple žemėlapis.
- Įdėta pilna state machine:
  - idle
  - searching
  - destination_selected
  - routes_loading
  - route_options
  - route_selected
  - walking_to_stop
  - waiting_bus
  - onboard
  - transfer
  - arriving
  - completed
- Search flow:
  - įvedi tekstą
  - rodomi stotelių / vietų rezultatai
  - pasirenki rezultatą
  - kraunami route options
  - pasirenki maršrutą
  - spaudi GO
  - eini iki stotelės
  - lauki autobuso
  - važiuoji
  - atvykai

## Pagrindiniai failai

```txt
app/_layout.tsx
app/(tabs)/_layout.tsx
app/(tabs)/index.tsx

core/features/map/MapScreen.tsx
core/features/map/MapCanvas.tsx
core/features/map/TopSearchBar.tsx
core/features/map/SearchResultsSheet.tsx
core/features/map/JourneySheet.tsx
core/features/map/RouteOptionCard.tsx
core/features/map/StepInstructionCard.tsx

core/features/map/layers/UserLocationLayer.tsx
core/features/map/layers/StopsLayer.tsx
core/features/map/layers/LiveBusesLayer.tsx
core/features/map/layers/RoutePolylineLayer.tsx
core/features/map/layers/WalkingPolylineLayer.tsx
core/features/map/layers/DestinationMarkerLayer.tsx

core/features/transit/hooks/useTransitPlanner.ts
core/features/transit/hooks/useLiveBuses.ts
core/features/transit/hooks/useUserLocation.ts
core/features/transit/services/transitApi.ts
core/features/transit/models/transitRoute.ts
core/features/transit/models/transitFlowState.ts
```

## Paleidimas

```bash
npm install
npx expo start --clear
```

## TestFlight build

```bash
eas build --platform ios --profile production --clear-cache
```

## API

`constants/api.ts` naudoja:

```txt
EXPO_PUBLIC_API_BASE
```

Jeigu env nėra, default:

```txt
https://arbebus-backed.onrender.com
```
