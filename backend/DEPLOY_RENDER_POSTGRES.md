# Arbebus Render + PostgreSQL paleidimas

## 1. PostgreSQL
Reikia PostgreSQL su PostGIS.

Jei turi atskirą DB hostą:
- įjunk `postgis` extension
- pasiimk pilną `DATABASE_URL`

## 2. Backend ENV
Render Web Service ENV:

```env
DATABASE_URL=postgres://...
GTFS_SOURCE_URL=https://.../gtfs.zip
PORT=10000
HOST=0.0.0.0
ENABLE_CORS=true
TRANSFER_RADIUS_METERS=300
DEFAULT_ORIGIN_STOP_RADIUS_METERS=700
DEFAULT_DESTINATION_STOP_RADIUS_METERS=700
MAX_NEARBY_STOPS=8
```

## 3. Install / Start
Build Command:
```bash
npm install
```

Start Command:
```bash
node backend/server.js
```

## 4. Pirmas DB užpildymas
Lokaliai arba Render shell paleisk:
```bash
npm run backend:bootstrap-transit
```

Arba atskirai:
```bash
npm run backend:schema
npm run backend:import-gtfs
```

## 5. Tikrinimas
Health:
```bash
GET /health
```

Planner:
```bash
POST /transit/plan
Content-Type: application/json

{
  "origin": { "latitude": 55.7033, "longitude": 21.1443 },
  "destination": { "latitude": 55.7100, "longitude": 21.1300 },
  "serviceDate": "2026-04-20"
}
```

## 6. Svarbu
- Planneris dabar nebekrauna pilno GTFS į RAM.
- Sunkus darbas vyksta importo metu ir SQL užklausose.
- Dideliam LT mastui vėliau logiška pereiti į RAPTOR / CSA plannerį, bet ši bazė jau yra tikras produkto pagrindas.
