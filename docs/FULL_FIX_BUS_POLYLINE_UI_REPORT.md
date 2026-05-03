# FULL FIX – BUS + POLYLINE + UI

## Pakeisti failai

Perkelti 1:1:

```text
backend/src/modules/transit/transit.service.js
mobile/core/features/map/layers/RoutePolylineLayer.tsx
mobile/core/features/map/layers/LiveBusesLayer.tsx
mobile/core/features/transit/hooks/useLiveBuses.ts
mobile/core/features/map/JourneySheet.tsx
docs/FULL_FIX_BUS_POLYLINE_UI_REPORT.md
```

## Kas pataisyta

### 1. Autobusų markeriai
- Markeriai dabar ima koordinates iš `latitude/longitude`, `lat/lon`, `lng` arba `coordinate`.
- `tracksViewChanges` įjungiamas pradiniam renderiui, kad iOS markeriai nedingtų.
- Sumažinti markeriai, mažesni tekstai, aiškesnis route numeris.

### 2. Polyline be ilgų tiesių fallback linijų
- Mobile pirmiausia piešia realią `shapePolyline/routePolyline/polyline`, jei yra 3+ taškai.
- Ilgos 2 taškų fallback linijos nebepiešiamos kaip pagrindinis maršrutas.
- Backend `shapeForTrip` dabar pjauna GTFS `shapes.txt` pagal boarding/alighting stoteles, o ne braižo visą miesto maršruto kilpą.

### 3. Apple tipo UI mastelis
- Sumažinti per dideli šriftai.
- Kompaktiškesnis bottom sheet.
- Sumažinti CTA, header, route card, line badge dydžiai.

## Ko neliesti

```text
.env
node_modules/
.expo/
package-lock.json
app.json
eas.json
backend/src/data/gtfs/
```

## Po perkėlimo

Backend Render update:

```bash
git add .
git commit -m "Fix buses polyline and Apple-style UI scale"
git push
```

Mobile build tik jei pakeitimai turi patekti į TestFlight:

```bash
cd mobile
eas build --platform ios --profile production --clear-cache
```
