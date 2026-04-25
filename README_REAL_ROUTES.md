# Arbebus v1 REAL ROUTES

Šitas paketas paruoštas Apple Maps principui:

search → rezultatai → route options → GO → eik iki stotelės → lauk autobuso → važiuok → persėsk → atvykai.

## Kas pridėta / sutvarkyta

- `backend/db/schema.sql` — pilna PostgreSQL + PostGIS GTFS schema.
- `backend/scripts/applySchema.js` paliktas ir naudoja naują schema.sql.
- `backend/scripts/importGtfs.js` dabar gali importuoti ne tik ZIP/URL, bet ir lokalų folderį `backend/services/data/gtfs`.
- `backend/server.js` pridėtas su endpointais:
  - `GET /health`
  - `GET /live-buses`
  - `GET /stops/search?q=...`
  - `POST /transit/plan`
  - `GET /transit/plan` suderinamumui
- Frontend `transitApi.ts` prijungtas prie realaus `POST /transit/plan`.
- `useTransitPlanner.ts` perrašytas pagal state machine.

## State machine

```txt
idle
searching
destination_selected
routes_loading
route_options
route_selected
walking_to_stop
waiting_bus
onboard
transfer
arriving
completed
```

## Lokalus paleidimas

Frontend:

```bash
npm install
npx expo start --clear
```

Backend:

```bash
npm install
npm run backend
```

DB schema:

```bash
npm run db:schema
```

GTFS importas iš įdėto folderio:

```bash
npm run db:import-gtfs
```

arba su konkrečiu ZIP/URL:

```bash
node backend/scripts/importGtfs.js ./path/to/gtfs.zip
```

## Svarbu

Reikia `DATABASE_URL` Render arba lokaliai. `.env` į ZIP nedėtas dėl saugumo.
