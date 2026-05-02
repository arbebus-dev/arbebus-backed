/* eslint-env node */
const { fetchTripUpdatesRaw } = require('./gtfsRT.client');

let cache = { fetchedAt: 0, data: null };
const CACHE_MS = Number(process.env.GTFS_RT_CACHE_MS || 15000);

async function getTripUpdates() {
  const now = Date.now();
  if (cache.data && now - cache.fetchedAt < CACHE_MS) return cache.data;

  const raw = await fetchTripUpdatesRaw();
  const response = {
    ok: true,
    realtimeReady: true,
    hasOfficialFeed: raw.source === 'gtfs-rt' && raw.ok,
    source: raw.source,
    delays: [],
    tripUpdates: raw.entities || [],
    fetchedAt: raw.fetchedAt || new Date().toISOString(),
    fallback: raw.source !== 'gtfs-rt',
    message: raw.source === 'gtfs-rt'
      ? 'GTFS-RT endpoint reached. Parser can be enabled when KKT provides feed schema.'
      : 'No official GTFS-RT delay feed configured. Using static GTFS schedules.',
    debug: raw.reason ? { reason: raw.reason } : undefined,
  };

  cache = { fetchedAt: now, data: response };
  return response;
}

module.exports = { getTripUpdates };
