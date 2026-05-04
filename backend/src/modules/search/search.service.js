const { normalizeText } = require('./utils/normalizeText');
const { rankResults, dedupeResults } = require('./utils/rankSearchResults');
const { cacheStats } = require('./cache/searchCache');
const { searchLocalPoi, localPoiHealth } = require('./providers/localPoi.provider');
const { searchNominatim } = require('./providers/nominatim.provider');
const { searchOverpass } = require('./providers/overpass.provider');
const { searchGooglePlaces } = require('./providers/googlePlaces.provider');
const { searchGtfsStops, gtfsHealth, loadGtfsStops } = require('./providers/gtfsStops.provider');

const DEFAULT_LIMIT = 12;
const MAX_LIMIT = 30;

function limitValue(value) {
  return Math.min(Math.max(Number(value || DEFAULT_LIMIT), 1), MAX_LIMIT);
}

function envBool(name, fallback = false) {
  const v = process.env[name];
  if (v == null || v === '') return fallback;
  return String(v).toLowerCase() === 'true';
}

async function runProvider(name, fn) {
  try {
    const results = await fn();
    return { name, ok: true, results: Array.isArray(results) ? results : [], error: null };
  } catch (error) {
    return { name, ok: false, results: [], error: error?.message || String(error) };
  }
}

async function index(query = {}) {
  const q = String(query.q || query.query || query.text || query.search || '').trim();
  const type = String(query.type || 'all').toLowerCase();
  const limit = limitValue(query.limit);
  const nq = normalizeText(q);

  if (nq.length < 2) {
    return { ok: true, query: q, count: 0, results: [], places: [], stops: [], addresses: [], meta: healthMeta() };
  }

  const local = await runProvider('local_poi', () => searchLocalPoi(q, { limit: 10 }));
  const nominatim = await runProvider('nominatim', () => searchNominatim(q, { limit: 10 }));
  const overpass = await runProvider('overpass', () => searchOverpass(q, { limit: 10 }));
  const google = await runProvider('google_places', () => searchGooglePlaces(q, { limit: 8 }));
  const stops = await runProvider('gtfs', () => searchGtfsStops(q, { limit: 12 }));

  let combined = [
    ...local.results,
    ...nominatim.results,
    ...overpass.results,
    ...google.results,
    ...stops.results,
  ];

  if (type !== 'all') combined = combined.filter((item) => item.type === type);

  const ranked = rankResults(dedupeResults(combined), q);
  const results = dedupeResults(ranked).slice(0, limit);

  return {
    ok: true,
    query: q,
    count: results.length,
    results,
    places: results.filter((item) => item.type !== 'stop'),
    stops: results.filter((item) => item.type === 'stop'),
    addresses: results.filter((item) => item.type === 'address'),
    meta: {
      ...healthMeta(),
      providers: [local, nominatim, overpass, google, stops].map((p) => ({ name: p.name, ok: p.ok, count: p.results.length, error: p.error })),
    },
  };
}

async function debug(query = {}) {
  const payload = await index({ ...query, limit: query.limit || 20 });
  return {
    ...payload,
    debug: {
      firstType: payload.results[0]?.type || null,
      firstSource: payload.results[0]?.source || null,
      expectedPriority: 'exact local_poi > address/city from nominatim > overpass/google > gtfs stop fallback',
    },
  };
}

async function stops(query = {}) {
  const q = String(query.q || query.query || query.text || query.search || '').trim();
  const results = await searchGtfsStops(q, { limit: limitValue(query.limit) });
  return { ok: true, query: q, count: results.length, results, places: results, stops: results, meta: healthMeta() };
}

function healthMeta() {
  return {
    module: 'dynamic_search',
    env: {
      ORS_API_KEY: Boolean(process.env.ORS_API_KEY),
      GOOGLE_PLACES_API_KEY: Boolean(process.env.GOOGLE_PLACES_API_KEY),
      SEARCH_PROVIDER_OSM_ENABLED: envBool('SEARCH_PROVIDER_OSM_ENABLED', true),
      SEARCH_PROVIDER_OVERPASS_ENABLED: envBool('SEARCH_PROVIDER_OVERPASS_ENABLED', true),
      SEARCH_PROVIDER_GOOGLE_ENABLED: envBool('SEARCH_PROVIDER_GOOGLE_ENABLED', false),
      SEARCH_CACHE_TTL_SECONDS: process.env.SEARCH_CACHE_TTL_SECONDS || '86400',
      SEARCH_REGION_LAT: process.env.SEARCH_REGION_LAT || '55.7033',
      SEARCH_REGION_LNG: process.env.SEARCH_REGION_LNG || '21.1443',
      SEARCH_REGION_RADIUS_METERS: process.env.SEARCH_REGION_RADIUS_METERS || '55000',
    },
    ...localPoiHealth(),
    ...gtfsHealth(),
    cache: cacheStats(),
  };
}

function health() {
  return { ok: true, routes: ['/api/search', '/api/search/debug', '/api/search/health', '/api/search/stops'], meta: healthMeta() };
}

function allStops() {
  return loadGtfsStops();
}

function findNearestStop(input) {
  const latitude = Number(input?.latitude ?? input?.lat);
  const longitude = Number(input?.longitude ?? input?.lon ?? input?.lng);
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return null;
  const R = 6371000;
  const distance = (a, b) => {
    const dLat = ((b.latitude - a.latitude) * Math.PI) / 180;
    const dLon = ((b.longitude - a.longitude) * Math.PI) / 180;
    const lat1 = (a.latitude * Math.PI) / 180;
    const lat2 = (b.latitude * Math.PI) / 180;
    const h = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) ** 2;
    return Math.round(2 * R * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h)));
  };
  return loadGtfsStops().map((s) => ({ ...s, distanceMeters: distance({ latitude, longitude }, s) })).sort((a, b) => a.distanceMeters - b.distanceMeters)[0] || null;
}

module.exports = { index, debug, stops, health, healthMeta, allStops, findNearestStop, normalizeText };
