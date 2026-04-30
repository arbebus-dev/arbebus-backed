const path = require('path');
const dotenv = require('dotenv');

const rootDir = process.cwd();
dotenv.config({ path: path.resolve(rootDir, '.env') });
dotenv.config({ path: path.resolve(rootDir, 'backend/.env') });
dotenv.config({ path: path.resolve(rootDir, 'app/.env') });

function readNumber(name, fallback) {
  const raw = process.env[name];
  if (raw === undefined || raw === null || raw === '') return fallback;
  const parsed = Number(raw);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function readBoolean(name, fallback = false) {
  const raw = String(process.env[name] ?? '').trim().toLowerCase();
  if (!raw) return fallback;
  return ['1', 'true', 'yes', 'on'].includes(raw);
}

function readList(name, fallback = []) {
  const raw = String(process.env[name] ?? '').trim();
  if (!raw) return fallback;
  return raw
    .split(/[\r\n,]+/)
    .map((item) => item.trim())
    .filter(Boolean);
}

const gtfsSourceUrls = readList('GTFS_SOURCE_URLS', []);
const primaryGtfsSource =
  process.env.GTFS_SOURCE_URL ||
  process.env.KLAIPEDA_GTFS_URL ||
  gtfsSourceUrls[0] ||
  '';

const corsOrigins = readList('CORS_ORIGIN', []);

module.exports = {
  env: {
    NODE_ENV: process.env.NODE_ENV || 'development',
    PORT: readNumber('PORT', 10000),
    HOST: process.env.HOST || '0.0.0.0',

    DATABASE_URL: process.env.DATABASE_URL || '',
    REDIS_URL: process.env.REDIS_URL || '',
    REDIS_QUEUE_ENABLED: readBoolean('REDIS_QUEUE_ENABLED', false),

    GTFS_IMPORT_TMP_DIR: process.env.GTFS_IMPORT_TMP_DIR || '/tmp/arbebus-gtfs',
    GTFS_SOURCE_URL: primaryGtfsSource,
    GTFS_SOURCE_URLS:
      gtfsSourceUrls.length > 0
        ? gtfsSourceUrls
        : primaryGtfsSource
        ? [primaryGtfsSource]
        : [],
    USE_REMOTE_GTFS_FIRST: readBoolean('USE_REMOTE_GTFS_FIRST', false),
    GTFS_RT_URL: process.env.GTFS_RT_URL || '',
    GTFS_FEED_CODE: process.env.GTFS_FEED_CODE || 'klaipeda',
    GTFS_FEED_REGION: process.env.GTFS_FEED_REGION || 'klaipeda',

    OPENCAGE_API_KEY: process.env.OPENCAGE_API_KEY || process.env.OPEN_CAGE_API_KEY || '',
    OPENROUTESERVICE_API_KEY:
      process.env.OPENROUTESERVICE_API_KEY || process.env.ORS_API_KEY || '',

    TRANSFER_RADIUS_METERS: readNumber('TRANSFER_RADIUS_METERS', 300),
    DEFAULT_ORIGIN_STOP_RADIUS_METERS: readNumber('DEFAULT_ORIGIN_STOP_RADIUS_METERS', 700),
    DEFAULT_DESTINATION_STOP_RADIUS_METERS: readNumber('DEFAULT_DESTINATION_STOP_RADIUS_METERS', 700),
    MAX_WALKING_METERS: readNumber('MAX_WALKING_METERS', 700),
    MAX_TRANSFERS: readNumber('MAX_TRANSFERS', 2),
    MAX_NEARBY_STOPS: readNumber('MAX_NEARBY_STOPS', 12),

    LEAVE_ALERT_ENGINE_INTERVAL_MS: readNumber('LEAVE_ALERT_ENGINE_INTERVAL_MS', 10000),

    ENABLE_CORS: readBoolean('ENABLE_CORS', true),
    CORS_ORIGIN: process.env.CORS_ORIGIN || '*',
    CORS_ORIGINS: corsOrigins,

    CACHE_TTL: readNumber('CACHE_TTL', 60),
    RATE_LIMIT_MAX: readNumber('RATE_LIMIT_MAX', 300),
    RATE_LIMIT_WINDOW_MS: readNumber('RATE_LIMIT_WINDOW_MS', 60000),

    LOG_LEVEL: process.env.LOG_LEVEL || 'debug',
    SENTRY_DSN: process.env.SENTRY_DSN || '',
    MIXPANEL_TOKEN: process.env.MIXPANEL_TOKEN || '',
  },
};
