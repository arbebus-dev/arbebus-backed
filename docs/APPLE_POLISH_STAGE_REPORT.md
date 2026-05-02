# Arbebus Apple Maps Polish Stage

Šis ZIP yra paruoštas pagal esamą Arbebus struktūrą, ne nuo nulio.

## Įdėta šiame etape

### 1. Tikra walking polyline per ORS
- `backend/src/modules/routing/ors.client.js`
- `backend/src/modules/transit/transit.service.js`

`/api/transit/plan` dabar bando gauti walking segmentų geometriją per OpenRouteService `foot-walking`. Jei `ORS_API_KEY` nėra arba ORS neatsako, naudojamas saugus fallback į tiesią liniją, kad planavimas nelūžtų.

### 2. GTFS-RT trip updates ready
- `backend/src/modules/transit/realtime/gtfsRT.client.js`
- `backend/src/modules/transit/realtime/tripUpdates.js`
- `backend/src/modules/transit/transit.controller.js`

Kai KKT duos oficialų GTFS-RT trip updates URL, į Render ENV įdėti:

```env
GTFS_RT_TRIP_UPDATES_URL=https://...
```

Kol feed nėra, endpointas saugiai grąžina fallback į static GTFS.

### 3. Background notifications
- `mobile/core/services/navigationBackground.ts`
- `mobile/core/features/transit/hooks/useTransitPlanner.ts`
- `mobile/app.json`
- `mobile/package.json`

Pridėta:
- `expo-task-manager`
- `expo-notifications`
- background location config iOS/Android
- artėjimo prie išlipimo stotelės notification logika

Svarbu: iOS background location/notifications pilnai testuojama per Development Build/TestFlight, ne Expo Go.

### 4. Full rerouting
`useTransitPlanner.ts` turi nukrypimo nuo polyline detektorių. Jei vartotojas nukrypsta nuo route, automatiškai daromas naujas `/api/transit/plan`.

### 5. Premium animation polish
Palikti ir papildyti esami:
- `NavigationHUD`
- route progress
- camera focus pagal būseną
- haptics + local notifications
- active step logic

## Minimalūs failai, kuriuos galima perkelti tiesiogiai

### Backend
```text
backend/src/modules/routing/ors.client.js
backend/src/modules/transit/transit.service.js
backend/src/modules/transit/transit.controller.js
backend/src/modules/transit/realtime/gtfsRT.client.js
backend/src/modules/transit/realtime/tripUpdates.js
```

### Mobile
```text
mobile/core/services/navigationBackground.ts
mobile/core/features/transit/hooks/useTransitPlanner.ts
mobile/package.json
mobile/app.json
```

### Docs
```text
docs/APPLE_POLISH_STAGE_REPORT.md
```

## Po perkėlimo

Backend:
```bash
cd backend
npm run dev
```

Mobile:
```bash
cd mobile
npm install
npx expo start -c
```

Development/TestFlight build background režimui:
```bash
cd mobile
eas build --platform ios --profile development --clear-cache
```

## Render ENV

```env
ORS_API_KEY=realus_ors_raktas
GTFS_RT_TRIP_UPDATES_URL=jeigu_kkt_duos
STOPS_LT_GPS_URL=https://www.stops.lt/klaipeda/gps_full.txt
```
