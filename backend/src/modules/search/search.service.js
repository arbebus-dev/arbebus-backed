const { normalizeText } = require('./utils/normalizeText');
const { rankResults, dedupeResults } = require('./utils/rankSearchResults');
const { cacheStats } = require('./cache/searchCache');
const { searchLocalPoi, localPoiHealth } = require('./providers/localPoi.provider');
const { searchNominatim, reverseNominatim } = require('./providers/nominatim.provider');
const { searchOverpass } = require('./providers/overpass.provider');
const { searchGooglePlaces, getGooglePlaceDetails, searchNearbyGooglePlaces, getGooglePhotoMediaUrl } = require('./providers/googlePlaces.provider');
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
      SEARCH_PROVIDER_GOOGLE_ACTIVE: Boolean(process.env.GOOGLE_PLACES_API_KEY) && String(process.env.SEARCH_PROVIDER_GOOGLE_ENABLED || 'true').toLowerCase() !== 'false',
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



async function reverse(query = {}) {
  const latitude = Number(query.lat ?? query.latitude);
  const longitude = Number(query.lng ?? query.lon ?? query.longitude);

  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
    return {
      ok: false,
      error: 'lat/lng required',
      place: null,
      result: null,
      meta: healthMeta(),
    };
  }

  const fallback = {
    id: `map-${latitude.toFixed(6)}-${longitude.toFixed(6)}`,
    type: 'address',
    title: 'Pasirinkta vieta',
    name: 'Pasirinkta vieta',
    subtitle: `${latitude.toFixed(5)}, ${longitude.toFixed(5)}`,
    latitude,
    longitude,
    coordinate: { latitude, longitude },
    source: 'map_tap',
    score: 1,
    priority: 0,
    keywords: [],
  };

  const googleNearby = await runProvider('google_nearby', () => searchNearbyGooglePlaces(latitude, longitude, { limit: 3 }));
  let result = googleNearby.results[0] || null;

  const nominatim = !result
    ? await runProvider('nominatim_reverse', async () => {
        const item = await reverseNominatim(latitude, longitude, { zoom: query.zoom || 18 });
        return item ? [item] : [];
      })
    : { name: 'nominatim_reverse', ok: true, results: [], error: null };

  if (!result) result = nominatim.results[0] || null;
  if (!result) result = fallback;

  result = {
    ...fallback,
    ...result,
    latitude: Number(result.latitude ?? latitude),
    longitude: Number(result.longitude ?? longitude),
    coordinate: result.coordinate || { latitude: Number(result.latitude ?? latitude), longitude: Number(result.longitude ?? longitude) },
    source: result.source || 'reverse',
  };

  return {
    ok: true,
    query: { latitude, longitude },
    result,
    place: result,
    results: [result],
    meta: {
      ...healthMeta(),
      providers: [
        { name: googleNearby.name, ok: googleNearby.ok, count: googleNearby.results.length, error: googleNearby.error },
        { name: nominatim.name, ok: nominatim.ok, count: nominatim.results.length, error: nominatim.error },
      ],
    },
  };
}


async function details(query = {}) {
  const placeId = String(query.placeId || query.id || query.googlePlaceId || '').trim();
  if (!placeId) {
    return { ok: false, error: 'placeId required', result: null, place: null, meta: healthMeta() };
  }

  const google = await runProvider('google_details', async () => {
    const result = await getGooglePlaceDetails(placeId);
    return result ? [result] : [];
  });

  const result = google.results[0] || null;
  return {
    ok: Boolean(result),
    placeId,
    result,
    place: result,
    results: result ? [result] : [],
    meta: {
      ...healthMeta(),
      providers: [{ name: google.name, ok: google.ok, count: google.results.length, error: google.error }],
    },
  };
}

async function photo(query = {}) {
  const name = String(query.name || '').trim();
  const maxWidthPx = query.maxWidthPx || query.max_width_px || process.env.GOOGLE_PLACES_PHOTO_MAX_WIDTH || 900;
  if (!name) return { ok: false, error: 'name required', url: null };
  const url = await getGooglePhotoMediaUrl(name, maxWidthPx);
  return { ok: Boolean(url), url };
}

function health() {
  return { ok: true, routes: ['/api/search', '/api/search/debug', '/api/search/health', '/api/search/stops', '/api/search/reverse', '/api/search/details', '/api/search/photo'], meta: healthMeta() };
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

module.exports = { index, debug, reverse, details, photo, stops, health, healthMeta, allStops, findNearestStop, normalizeText };
