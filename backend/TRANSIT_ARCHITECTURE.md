# Arbebus DB-based transit architecture

## Esmė
Dabartinis produktinis kelias nėra RAM-based GTFS loaderis. Visi transit duomenys keliauja į PostgreSQL + PostGIS, o planneris skaito iš DB.

## Kas šiame pakete jau yra
- PostgreSQL schema transit duomenims
- GTFS importer į DB
- `shapes.txt` importas
- planner service su:
  - nearest stops
  - direct bus
  - bus -> bus transfer (1 persėdimas)
  - journey steps frontendui
- `POST /transit/plan`
- bootstrap scriptai schema + importui
- Render/DB paleidimo bazė

## Lentelės
- `transit.import_runs`
- `transit.agencies`
- `transit.routes`
- `transit.stops`
- `transit.calendar`
- `transit.calendar_dates`
- `transit.trips`
- `transit.stop_times`
- `transit.transfers`
- `transit.shapes`
- `transit.shape_points`
- materialized views:
  - `transit.service_days`
  - `transit.route_stop_pairs`

## Planner flow
1. Frontendas kviečia `POST /transit/plan`.
2. Backendas suranda artimiausias pradžios ir tikslo stoteles per PostGIS.
3. Tikrinami direct variantai aktyviai dienai.
4. Jei reikia, tikrinamas 1 persėdimas.
5. Sugeneruojami `journeySteps`, `summary`, `previewPoints`.
6. Frontendas rodo:
   - kur eiti
   - į ką lipti
   - kur persėsti
   - kur išlipti

## Import flow
1. `applySchema.js` uždeda schemą.
2. `importGtfs.js` paima GTFS ZIP iš URL arba lokalaus failo.
3. CSV failai streaminami eilutėmis, nekeliamas visas feed į RAM.
4. Užpildomos lentelės.
5. Atnaujinami materialized views.

## Start command
Render gali likti:
```bash
node backend/server.js
```

## Scriptai
```bash
npm run backend:schema
npm run backend:import-gtfs
npm run backend:bootstrap-transit
npm run backend
```

## Pirmas paleidimas
1. Susikuri PostgreSQL su PostGIS.
2. Užsidedi `DATABASE_URL`.
3. Užsidedi `GTFS_SOURCE_URL` arba paduodi ZIP path.
4. Paleidi:
```bash
npm run backend:bootstrap-transit
```

## Kas dar liks kitam etapui
- live vehicle matching prie planned trip
- real-time ETA refinement pagal GPS
- 2+ persėdimų planneris
- RAPTOR/CSA lygio planneris visai Lietuvai
- fares / tickets / operators business logika
