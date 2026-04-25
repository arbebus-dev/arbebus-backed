# Arbebus v1 = Apple Maps for buses

Šis ZIP yra išvalyta v1 versija: tik autobusų žemėlapis, live autobusai, stotelės, paieška ir /transit/plan maršrutai.

## Palikta struktūra

```txt
app/
  _layout.tsx
  (tabs)/_layout.tsx
  (tabs)/index.tsx

core/features/map/
  MapScreen.tsx
  MapCanvas.tsx
  TopSearchBar.tsx
  JourneySheet.tsx

core/features/map/layers/
  UserLocationLayer.tsx
  StopsLayer.tsx
  LiveBusesLayer.tsx
  RoutePolylineLayer.tsx

core/features/transit/
  hooks/useTransitPlanner.ts
  hooks/useLiveBuses.ts
  hooks/useUserLocation.ts
  services/transitApi.ts
  models/transitRoute.ts
```

## Išimta iš v1

- taxi
- scooter
- airport
- train
- RevenueCat / PRO
- leave alerts
- notifications/background tasks
- driver simulation
- senas 835 eilučių app/(tabs)/index.tsx

## Paleidimas

```bash
npm install
npx expo start --clear
```

## API

App naudoja `EXPO_PUBLIC_API_BASE`, default:

```txt
https://arbebus-backed.onrender.com
```

Reikalingi endpointai:

```txt
GET /live-buses
GET /stops/search?q=...
GET /transit/plan?fromLat=...&fromLng=...&toLat=...&toLng=...
```
