# Arbebus MAX setup

Šitas paketas yra sudėtas tam, kad galėtum **copy/paste ir paleisti** DB-based transit pagrindą be papildomų "etapų".

## Kas jau yra viduje

- Expo / React Native frontend bazė
- Node / Express backend
- PostgreSQL + PostGIS schema
- GTFS importer į DB
- `POST /transit/plan` planner endpoint
- frontend jungtis į planner API
- Render deploy config
- Docker Compose lokalus Postgres paleidimui
- bootstrap scriptai transit schemai ir GTFS importui

## Greitas startas lokaliai

### 1. Susikurk `.env`
Naudok `backend/.env.example` kaip pagrindą.

### 2. Paleisk lokalų Postgres su PostGIS
```bash
docker compose -f deploy/docker-compose.postgres.yml up -d
```

### 3. Įrašyk dependencies
```bash
npm install
```

### 4. Sukurk DB schemą + importuok GTFS
Jei turi nuotolinį feed URL `.env` faile:
```bash
npm run backend:bootstrap-transit
```

Jei turi lokalų GTFS ZIP:
```bash
npm run backend:schema
npm run backend:import-gtfs -- ./backend/services/data/gtfs.zip
```

### 5. Paleisk backend
```bash
npm run backend
```

### 6. Paleisk Expo frontend
```bash
npm start
```

## Render produkcinis kelias

1. Susikurk PostgreSQL su PostGIS (pvz. Neon / Supabase Postgres su PostGIS / Render Postgres + extension)
2. Į Render service sudėk ENV iš `backend/.env.example`
3. Start Command palik:
```bash
node backend/server.js
```
4. Po pirmo deploy paleisk vienkartinį bootstrap:
```bash
npm install && npm run backend:bootstrap-transit
```
5. Patikrink:
- `GET /health`
- `POST /transit/plan`
- frontend `EXPO_PUBLIC_API_BASE`

## Svarbiausi failai

### Backend
- `backend/server.js`
- `backend/db/schema.sql`
- `backend/scripts/bootstrapTransit.js`
- `backend/scripts/importGtfs.js`
- `backend/services/transit/planner/`

### Frontend
- `hooks/useSmartRoute.ts`
- `core/services/transit/plannerApi.ts`
- `core/services/transit/plannerTypes.ts`
- `components/home/HomeBottomSheet.tsx`

## Ko tikėtis realiai

Šitas paketas duoda rimtą produkto pagrindą, bet ant tavo **realaus GTFS feedo** gali reikėti vieno pravažiavimo dėl:
- konkrečių feed stulpelių skirtumų
- service calendar niuansų
- route naming niuansų
- produkcinio `DATABASE_URL`

Tai jau nebe RAM-based variantas. Tai DB-based bazė, nuo kurios galima tęsti:
- shapes based polyline
- live vehicles pririšimą prie trip
- persėdimų plėtrą
- vėliau RAPTOR/CSA plannerį
