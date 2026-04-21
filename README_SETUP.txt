REPLACE THESE FILES
- backend/server.js
- backend/services/transit/gtfsLoader.js
- backend/services/transit/klaipedaGateway.js
- hooks/useSmartRoute.ts

RENDER ENV FOR REAL BUS + TRAIN PLANNING
KLAIPEDA_GTFS_URL=https://www.visimarsrutai.lt/gtfs/gtfs_all.zip
USE_REMOTE_GTFS_FIRST=1
TRANSFER_RADIUS_METERS=350

NOTES
- Bus GPS stays live from stops.lt Klaipeda feed.
- Train legs come from GTFS schedule data when the all-Lithuania GTFS feed is used.
- If the upstream all-Lithuania GTFS feed is unavailable, the backend falls back to local GTFS files.
