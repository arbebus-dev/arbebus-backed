const env = {
  NODE_ENV: process.env.NODE_ENV || 'development',
  PORT: Number(process.env.PORT || 3000),
  CORS_ORIGIN: process.env.CORS_ORIGIN || '*',
  DATABASE_URL: process.env.DATABASE_URL || '',
  REDIS_URL: process.env.REDIS_URL || '',
  ORS_API_KEY: process.env.ORS_API_KEY || '',
  SENTRY_DSN: process.env.SENTRY_DSN || '',
  STOPS_LT_GPS_URL: process.env.STOPS_LT_GPS_URL || 'https://www.stops.lt/klaipeda/gps_full.txt',
};

module.exports = { env };
