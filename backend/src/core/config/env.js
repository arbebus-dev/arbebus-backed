const env = {
  NODE_ENV: process.env.NODE_ENV || 'development',
  PORT: Number(process.env.PORT || 3000),
  CORS_ORIGIN: process.env.CORS_ORIGIN || '*',
  DATABASE_URL: process.env.DATABASE_URL || '',
  REDIS_URL: process.env.REDIS_URL || '',
  ORS_API_KEY: process.env.ORS_API_KEY || '',
  SENTRY_DSN: process.env.SENTRY_DSN || '',
  STOPS_LT_GPS_URL: process.env.STOPS_LT_GPS_URL || 'https://www.stops.lt/klaipeda/gps_full.txt',
  GTFS_STATIC_URL: process.env.GTFS_STATIC_URL || 'https://www.stops.lt/klaipeda/klaipeda/gtfs.zip',
  GTFS_RT_VEHICLE_POSITIONS_URL:
    process.env.GTFS_RT_VEHICLE_POSITIONS_URL ||
    process.env.KKT_GTFS_RT_VEHICLE_POSITIONS_URL ||
    'https://www.stops.lt/klaipeda/gtfs_realtime.pb',
  GTFS_RT_TRIP_UPDATES_URL:
    process.env.GTFS_RT_TRIP_UPDATES_URL ||
    process.env.KKT_GTFS_RT_TRIP_UPDATES_URL ||
    'https://www.stops.lt/klaipeda/trip_updates.pb',
  GTFS_RT_SERVICE_ALERTS_URL:
    process.env.GTFS_RT_SERVICE_ALERTS_URL ||
    process.env.KKT_GTFS_RT_SERVICE_ALERTS_URL ||
    'https://www.stops.lt/klaipeda/service_alerts.pb',
};

module.exports = { env };
