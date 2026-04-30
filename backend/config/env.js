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

module.exports = {
  env: {
    PORT: readNumber('PORT', 10000),
    HOST: process.env.HOST || '0.0.0.0',
    DATABASE_URL: process.env.DATABASE_URL || '',
    REDIS_URL: process.env.REDIS_URL || '',
    GTFS_IMPORT_TMP_DIR: process.env.GTFS_IMPORT_TMP_DIR || '/tmp/arbebus-gtfs',
    GTFS_SOURCE_URL: primaryGtfsSource,
    GTFS_SOURCE_URLS:
      gtfsSourceUrls.length > 0
        ? gtfsSourceUrls
        : primaryGtfsSource
        ? [primaryGtfsSource]
        : [],
    TRANSFER_RADIUS_METERS: readNumber('TRANSFER_RADIUS_METERS', 300),
    DEFAULT_ORIGIN_STOP_RADIUS_METERS: readNumber('DEFAULT_ORIGIN_STOP_RADIUS_METERS', 700),
    DEFAULT_DESTINATION_STOP_RADIUS_METERS: readNumber('DEFAULT_DESTINATION_STOP_RADIUS_METERS', 700),
    MAX_WALKING_METERS: readNumber('MAX_WALKING_METERS', 800),
    MAX_TRANSFERS: readNumber('MAX_TRANSFERS', 2),
    MAX_NEARBY_STOPS: readNumber('MAX_NEARBY_STOPS', 8),
    LEAVE_ALERT_ENGINE_INTERVAL_MS: readNumber('LEAVE_ALERT_ENGINE_INTERVAL_MS', 30000),
    ENABLE_CORS: readBoolean('ENABLE_CORS', true),
    CORS_ORIGIN: process.env.CORS_ORIGIN || '*',
    GTFS_FEED_CODE: process.env.GTFS_FEED_CODE || 'lt_national',
    GTFS_FEED_REGION: process.env.GTFS_FEED_REGION || 'LT',
  },
};