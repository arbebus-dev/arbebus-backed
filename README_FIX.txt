ARBEBUS SEARCH + LIVE BUSES STABILIZATION FIX

Keisti tik siuos failus:
1. mobile/constants/api.ts
2. mobile/core/features/transit/services/transitApi.ts
3. mobile/core/features/transit/hooks/useTransitPlanner.ts
4. mobile/app.json
5. mobile/tsconfig.json
6. backend/src/modules/transit/transit.service.js
7. backend/Dockerfile
8. render.yaml
9. tsconfig.json

Kas pataisyta:
- Mobile API base stabilizuotas ir valomas vienoje vietoje.
- Mobile search/live-buses endpointai dabar turi kelis suderinamus fallback URL.
- Search fetch nebemetamas iškart dėl vieno blogo endpointo; bando kitą.
- Live buses backend nebeatiduoda HTTP klaidos, jeigu GTFS-RT/stops.lt feed laikinai nepasiekiamas.
- Render Dockerfile/render.yaml suderintas su monorepo root context.
- TypeScript ignoreDeprecations pataisytas is neteisingo 6.0 i 5.0.

Po idejimo:
git add .
git commit -m "Stabilize search API and live buses"
git push

Tada Render Live, ir mobile:
cd mobile
npx expo start --clear

Testai:
https://arbebus-backed.onrender.com/api/search?q=Akropolis
https://arbebus-backed.onrender.com/api/transit/live-buses
