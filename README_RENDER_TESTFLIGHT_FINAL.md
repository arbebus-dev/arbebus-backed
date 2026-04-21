ARBEBUS FINAL DEPLOY FLOW

1. Uždėk šį ZIP ant projekto viršaus.
2. VS Code terminale iš root paleisk:
   git add .
   git commit -m "final transit max"
   git push
3. Render backend: Deploy latest commit.
4. Render env turi turėti:
   DATABASE_URL=...
   GTFS_SOURCE_URLS=https://www.visimarsrutai.lt/gtfs/google_transit.zip,https://www.visimarsrutai.lt/gtfs/gtfs_all.zip
   GTFS_SOURCE_URL=https://www.visimarsrutai.lt/gtfs/google_transit.zip
   PORT=10000
   HOST=0.0.0.0
   NODE_ENV=production
   TRANSFER_RADIUS_METERS=300
   DEFAULT_ORIGIN_STOP_RADIUS_METERS=700
   DEFAULT_DESTINATION_STOP_RADIUS_METERS=700
   MAX_NEARBY_STOPS=8
   ENABLE_CORS=true
   CORS_ORIGIN=*
   GTFS_FEED_CODE=lt_national
   GTFS_FEED_REGION=LT
5. Render Shell arba lokaliai iš projekto root paleisk:
   npm run backend:bootstrap-transit
6. Patikrink:
   /health turi rodyti gtfs.routeTypeCounts ir pageidautina ir "2" ir "3".
7. Tada naujas TestFlight build:
   npx eas build -p ios
   npx eas submit -p ios
