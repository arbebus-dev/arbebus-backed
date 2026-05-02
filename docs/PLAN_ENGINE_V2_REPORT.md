# Arbebus PLAN ENGINE v2 – Final Patch Report

## Kas įdėta

Šis paketas uždaro pagrindinį `PLAN ENGINE v2` etapą pagal esamą Arbebus monorepo struktūrą.

### Backend

Pagrindinis failas:

```text
backend/src/modules/transit/transit.service.js
```

Įgyvendinta:

- GPS / `from` koordinačių pririšimas prie artimiausių GTFS stotelių.
- Destination / `to` koordinačių pririšimas prie artimiausių GTFS stotelių.
- Tiesioginių maršrutų paieška per `routes.txt`, `trips.txt`, `stop_times.txt`.
- Persėdimų paieška per bendras stoteles tarp dviejų route tinklų.
- Realūs `stop_times.txt` laikai: departure / arrival / countdown.
- Realūs `trips.txt` ir `routes.txt`: route label, headsign, route color.
- Realūs `shapes.txt`: polyline pagal `shape_id`, su fallback į stotelių koordinates.
- ETA modelis pagal artimiausią išvykimą ir live buses feed.
- `journeySteps`: walk → board → ride → transfer → alight → walk.
- `legs`: atskiri bus segmentai mobile UI renderinimui.

### API

Palikti ir sujungti esami endpointai:

```text
GET  /api/transit/live-buses
GET  /api/transit/live-eta
POST /api/transit/plan
GET  /api/transit/plan
GET  /api/transit/shape
GET  /api/transit/shape/:shapeId
GET  /api/transit/departures?stopId=...
GET  /api/transit/stops/:stopId/departures
GET  /api/transit/vehicle/:id
GET  /api/transit/alerts
GET  /api/transit/trip-updates
```

### Mobile

Pagrindiniai failai:

```text
mobile/constants/api.ts
mobile/core/features/transit/services/transitApi.ts
mobile/core/features/transit/hooks/useTransitPlanner.ts
mobile/core/features/map/MapScreen.tsx
mobile/core/features/map/JourneySheet.tsx
mobile/core/features/map/layers/RoutePolylineLayer.tsx
mobile/core/features/map/layers/StopsLayer.tsx
mobile/core/features/map/layers/LiveBusesLayer.tsx
```

Įgyvendinta / sujungta:

- Mobile naudoja `/api/transit/plan`.
- Route card skaito ETA, transfers, stops, routeNumbers.
- StepsList / JourneySheet skaito `journeySteps`.
- Žemėlapis rodo polyline iš backend `shapes.txt`.
- Stops layer rodo įlipimo / išlipimo / tarpines stoteles.
- Live buses layer pažymi pasirinktą maršrutą ir pasirinktą autobusą.
- GPS location focus veikia per `useUserLocation`.
- Navigation flow states paruošti: `walking_to_stop`, `waiting_bus`, `onboard`, `transfer`, `arriving`.

## Lokalus backend testas

```bash
cd backend
node -e "const s=require('./src/modules/transit/transit.service'); (async()=>{ const p=await s.plan({from:{latitude:55.71984,longitude:21.13578},to:{latitude:55.6905,longitude:21.1444},selectedDestination:{title:'Akropolis'}}); console.log(p.ok,p.source,p.routes.length,p.plan.title,p.plan.totalMinutes,p.plan.polyline.length,p.plan.journeySteps.length); })()"
```

Šiame ZIP testas grąžino:

```text
ok=true
source=gtfs+stops.lt
routes=4
example=Autobusas 28
polyline=153 points
journeySteps=4
```

Departure board testas:

```bash
node -e "const s=require('./src/modules/transit/transit.service'); (async()=>{ const d=await s.departures({stopId:'3808'}); console.log(d.ok,d.count,d.stop.name,d.departures[0]); })()"
```

Rezultatas:

```text
ok=true
count=20
stop=Autobusų stotis
```

## Paleidimas po pakeitimo

Backend:

```bash
cd backend
npm install
npm run dev
```

Test URL:

```text
http://localhost:3000/api/transit/live-buses
http://localhost:3000/api/search/stops?q=stotis
http://localhost:3000/api/transit/departures?stopId=3808
http://localhost:3000/api/transit/plan
```

POST plan testas:

```bash
curl -X POST http://localhost:3000/api/transit/plan ^
  -H "Content-Type: application/json" ^
  -d "{\"from\":{\"latitude\":55.71984,\"longitude\":21.13578},\"to\":{\"latitude\":55.6905,\"longitude\":21.1444},\"selectedDestination\":{\"title\":\"Akropolis\"}}"
```

Mobile:

```bash
cd mobile
npm install
npx expo start -c
```

## Kas dar nėra 100% Apple Maps

Šis etapas uždaro realų route engine bazinį branduolį. Dar likę kiti etapai:

1. Tikra walking polyline per ORS, ne tik tiesi pėsčiųjų atkarpa.
2. GTFS-RT trip updates, jeigu KKT duos oficialų realtime arrival delay feed.
3. Background notifications: artėji prie išlipimo stotelės.
4. Full rerouting, kai vartotojas nukrypsta nuo kelio.
5. Premium animation polish.
