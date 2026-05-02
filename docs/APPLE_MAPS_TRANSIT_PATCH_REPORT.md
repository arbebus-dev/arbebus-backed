# Arbebus Apple Maps Transit Patch

## Įdiegta šiame ZIP

### Backend
- `GET /api/transit/live-buses` – realūs autobusai iš stops.lt.
- `POST/GET /api/transit/plan` – realus GTFS maršruto planas pagal `stops.txt`, `routes.txt`, `trips.txt`, `stop_times.txt`, `shapes.txt`.
- `GET /api/transit/departures?stopId=...` – stotelės išvykimų lenta.
- `GET /api/transit/vehicle/:id` – vieno autobuso detalės, artimiausia stotelė ir artimiausi išvykimai.
- `GET /api/transit/shape/:shapeId` – GTFS polyline.
- `GET /api/transit/live-eta` – ETA pagal live autobusą ir įlipimo stotelę.

### Mobile
- Papildyti API endpointai `departures` ir `vehicle`.
- Į `JourneySheet` pridėta Apple Maps tipo išvykimų lenta.
- Route card / steps / live ETA / live buses / stops / polyline sluoksniai palikti esamoje struktūroje.

## Svarbu
- `.env`, `node_modules`, `.expo`, `.git` į ZIP neįtraukti.
- Paleidus lokaliai: `cd backend && npm install && npm run dev`.
- Mobile: `cd mobile && npm install && npx expo start -c`.
- Render: Root Directory `backend`, Build `npm install`, Start `node src/core/server.js`.

## Testuota
- Backend smoke test: OK.
- GTFS load: 922 stops, 68 routes, 7029 trips iš pateikto GTFS.
- Plan testas su Klaipėdos koordinatėmis grąžino realų GTFS maršrutą su stotelėmis ir polyline.
