# Arbebus GTFS Engine v3 Ultra

## Kas įdėta

### Backend
- `backend/src/modules/transit/transit.service.js`
  - GTFS loader: `stops.txt`, `routes.txt`, `trips.txt`, `stop_times.txt`, `shapes.txt`
  - Tikras A → B planavimas pagal artimiausias stoteles
  - Tiesioginiai maršrutai
  - Persėdimai per bendras stoteles
  - ETA pagal `stop_times`
  - `journeySteps`: walk → board → ride → transfer → ride → walk
  - `route alternatives`: `options` / `routes`
  - Reali `shapes.txt` polyline autobusų segmentams
  - ORS walking polyline su fallback į tiesią liniją
  - Live GPS + schedule merge bazė per `/live-eta` ir `/vehicle/:id`

- `backend/src/modules/routing/ors.client.js`
  - ORS walking directions klientas
  - Naudoja `ORS_API_KEY`
  - Jei ORS neveikia arba nėra rakto — saugus fallback

- `backend/src/api/routes/transit.routes.js`
  - `/api/transit/plan`
  - `/api/transit/live-buses`
  - `/api/transit/live-eta`
  - `/api/transit/departures`
  - `/api/transit/vehicle/:id`
  - `/api/transit/shape/:shapeId`
  - `/api/transit/station-access`

- `backend/src/modules/transit/transit.controller.js`
  - Controlleriai visiems endpointams

### Mobile
- `mobile/constants/api.ts`
  - Visi API endpointai su Render fallback

- `mobile/core/features/transit/services/transitApi.ts`
  - Plan Engine API jungtis
  - Normalize route / steps / live buses / walking geometry

- `mobile/core/features/transit/hooks/useTransitPlanner.ts`
  - Route planning state
  - Plan alternatives
  - Selected route
  - Loading/error states

- `mobile/core/features/map/*`
  - RouteCard / RouteOptionCard
  - Steps list / step cards
  - Departure board / selected stop focus integracija
  - Polyline / walking line / live buses / stops layers

## Tikslūs failai, kuriuos saugu perkelti 1:1

### Backend
```text
backend/src/api/routes/transit.routes.js
backend/src/modules/transit/transit.controller.js
backend/src/modules/transit/transit.service.js
backend/src/modules/transit/realtime/gtfsRT.client.js
backend/src/modules/transit/realtime/tripUpdates.js
backend/src/modules/routing/ors.client.js
backend/src/data/stations/entrances.json
```

### Mobile
```text
mobile/constants/api.ts
mobile/core/features/transit/
mobile/core/features/map/
```

### Docs
```text
docs/GTFS_ENGINE_V3_ULTRA_REPORT.md
```

## Ko nekeisti
```text
.env
node_modules/
.expo/
.git/
package-lock.json
mobile/package.json
mobile/app.json
eas.json
backend/src/data/gtfs/
```

GTFS duomenis palik savo, jeigu jie jau realūs ir veikia.

## Testai lokaliai

Backend:
```bash
cd backend
npm run dev
```

GET:
```text
http://localhost:3000/api/search/stops?q=stotis
http://localhost:3000/api/transit/live-buses
http://localhost:3000/api/transit/departures?stopId=3808
http://localhost:3000/api/transit/station-access?stopId=3808
```

POST `/api/transit/plan`:
```bash
curl -X POST http://localhost:3000/api/transit/plan ^
  -H "Content-Type: application/json" ^
  -d "{\"from\":{\"latitude\":55.71984,\"longitude\":21.13578},\"to\":{\"latitude\":55.68962,\"longitude\":21.14691}}"
```

Render testas:
```text
https://arbebus-backed.onrender.com/api/transit/live-buses
https://arbebus-backed.onrender.com/api/transit/departures?stopId=3808
```

## Environment
Render turi turėti:
```env
ORS_API_KEY=...
STOPS_LT_GPS_URL=https://www.stops.lt/klaipeda/gps_full.txt
GTFS_RT_TRIP_UPDATES_URL=
```

`GTFS_RT_TRIP_UPDATES_URL` gali likti tuščias, kol KKT neduos oficialaus trip updates feed.

## Reali būsena
Šitas etapas uždaro GTFS Engine branduolį iki Apple Maps tipo MVP:
- realūs GTFS maršrutai
- tvarkaraščiai
- realios shapes polyline
- persėdimai
- ORS walking
- route alternatives
- mobile route cards / steps / departure board

Toliau reikia nebe naujos struktūros, o TestFlight QA realiame iPhone: GPS, rerouting, background alerts, camera follow ir UI polish pagal realų naudojimą.
