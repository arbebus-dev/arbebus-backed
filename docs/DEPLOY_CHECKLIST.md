# Arbebus Render / EAS Deploy Checklist

## Render backend

Environment variables:

```env
NODE_ENV=production
STOPS_LT_GPS_URL=https://www.stops.lt/klaipeda/gps_full.txt
ORS_API_KEY=...
GTFS_RT_TRIP_UPDATES_URL=
LIVE_BUSES_CACHE_MS=7000
CORS_ORIGIN=*
```

Render settings:

```text
Root Directory: backend
Build Command: npm install
Start Command: node src/core/server.js
```

Test endpoints:

```text
/api/health
/api/search/stops?q=stotis
/api/transit/live-buses
/api/transit/departures?stopId=3808
/api/transit/station-access?stopId=3808
/api/transit/plan
```

## EAS iOS

Before build:

1. Increase `mobile/app.json` → `ios.buildNumber`.
2. Confirm background modes are present: `location`, `fetch`, `remote-notification`.
3. Confirm dependencies: `expo-location`, `expo-task-manager`, `expo-notifications`, `expo-apple-authentication`.

Build:

```bash
cd mobile
eas build --platform ios --profile production --clear-cache
```

## TestFlight validation

- route plan returns real options
- walking polyline uses ORS when key exists
- selected stop shows departures
- station access markers appear for stop 3808
- background alerts are tested outside Expo Go
