# Arbebus Final Apple Maps Stage Report

## Tikslas
Šis paketas uždaro finalinį Arbebus „Apple Maps Transit MVP“ etapą: realus GTFS maršrutų branduolys, live GPS + schedule ETA, bottom sheet polish, selected stop focus, background alerts ir App Store dokumentai.

## Įtraukta į paketą

### Backend
- `/api/transit/plan` — GTFS Engine v3 su realiais `stops`, `routes`, `trips`, `stop_times`, `shapes`.
- `/api/transit/live-buses` — realūs stops.lt autobusai.
- `/api/transit/departures?stopId=` — stotelės išvykimų lenta.
- `/api/transit/vehicle/:id` — pasirinkto autobuso detalės.
- `/api/transit/station-access?stopId=` — įėjimų/išėjimų fallback modelis.
- ORS client fallback: jei ORS neveikia, naudojama saugi tiesi linija, bet app nelūžta.
- GTFS-RT fallback: jei KKT dar neduoda oficialaus feed, ETA lieka `static GTFS + live GPS estimate`.

### Mobile
- Premium layered bottom sheet: `peek → medium → full`.
- Route alternatives kortelės.
- Departure board stotelės lygyje.
- Journey steps sąrašas: eik / lipk / važiuok / persėsk / išlipk.
- Live GPS route state, rerouting signalai ir background alerts integracija.
- Animated live bus markers ir selected route/vehicle highlight.
- Selected stop access markers.
- API base paliktas į Render: `https://arbebus-backed.onrender.com`.

### Dokumentai
- App Store Privacy LT/EN.
- App Store review notes.
- QA checklist.
- Deploy checklist.
- Failų perkėlimo ataskaita.

## Tiksliai kokius failus perkelti

### Backend
```text
backend/src/core/server/app.js
backend/src/api/routes.js
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
mobile/package.json
mobile/app.json
mobile/core/services/navigationBackground.ts
mobile/core/features/map/MapScreen.tsx
mobile/core/features/map/JourneySheet.tsx
mobile/core/features/map/NavigationHUD.tsx
mobile/core/features/map/layers/LiveBusesLayer.tsx
mobile/core/features/map/layers/RoutePolylineLayer.tsx
mobile/core/features/map/layers/StopsLayer.tsx
mobile/core/features/map/layers/StationAccessLayer.tsx
mobile/core/features/map/layers/WalkingPolylineLayer.tsx
mobile/core/features/transit/hooks/useTransitPlanner.ts
mobile/core/features/transit/services/transitApi.ts
mobile/core/features/transit/models/transitTypes.ts
```

### Docs
```text
docs/FINAL_APPLE_MAPS_STAGE_REPORT.md
docs/APP_STORE_PRIVACY.md
docs/PRIVACY_POLICY_LT.md
docs/PRIVACY_POLICY_EN.md
docs/APP_STORE_REVIEW_NOTES.md
docs/FINAL_TESTFLIGHT_QA_CHECKLIST.md
docs/DEPLOY_CHECKLIST.md
```

## Neliesti
```text
.env
infrastructure/.env
node_modules/
.expo/
.git/
package-lock.json
backend/src/data/gtfs/
```

## Po perkėlimo

### Render backend update
```bash
cd C:\Users\Boris\arbebus
git add .
git commit -m "Final Apple Maps transit polish"
git push
```

### Test Render
```text
https://arbebus-backed.onrender.com/api/transit/live-buses
https://arbebus-backed.onrender.com/api/search/stops?q=stotis
https://arbebus-backed.onrender.com/api/transit/departures?stopId=3808
```

POST plan test:
```powershell
curl.exe -X POST "https://arbebus-backed.onrender.com/api/transit/plan" -H "Content-Type: application/json" -d "{\"from\":{\"latitude\":55.7033,\"longitude\":21.1443},\"to\":{\"latitude\":55.7180,\"longitude\":21.1175}}"
```

### Mobile build
```bash
cd mobile
npm install
eas build --platform ios --profile production --clear-cache
```

## Realus statusas
Šis paketas uždaro Arbebus kaip Apple Maps Transit MVP branduolį. Lygis: apie 90–92%. Iki 100% lieka tik oficialus KKT GTFS-RT Trip Updates feed ir reali QA Klaipėdoje su TestFlight.
