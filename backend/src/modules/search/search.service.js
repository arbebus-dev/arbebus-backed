const path = require('path');
const fs = require('fs');
const { normalizeText } = require('./searchnormalizer');

const DEFAULT_SEARCH_LIMIT = 20;
const MAX_SEARCH_LIMIT = 80;
const DATA_ROOT = path.join(__dirname, '../../data');
const GTFS_ROOT = path.join(DATA_ROOT, 'gtfs');
const LT_BBOX = { minLon: 20.6, minLat: 53.8, maxLon: 26.9, maxLat: 56.6 };

let cache = null;

function readFileSafe(filePath) {
  try {
    if (!fs.existsSync(filePath)) return '';
    return fs.readFileSync(filePath, 'utf8');
  } catch {
    return '';
  }
}

function readJsonSafe(relativePath, fallback = []) {
  try {
    const filePath = path.join(DATA_ROOT, relativePath);
    if (!fs.existsSync(filePath)) return fallback;
    const raw = fs.readFileSync(filePath, 'utf8').trim();
    if (!raw) return fallback;
    return JSON.parse(raw);
  } catch {
    return fallback;
  }
}

function parseCsvLine(line) {
  const out = [];
  let current = '';
  let quoted = false;

  for (let i = 0; i < line.length; i += 1) {
    const char = line[i];
    const next = line[i + 1];

    if (char === '"' && quoted && next === '"') {
      current += '"';
      i += 1;
    } else if (char === '"') {
      quoted = !quoted;
    } else if (char === ',' && !quoted) {
      out.push(current);
      current = '';
    } else {
      current += char;
    }
  }
  out.push(current);
  return out.map((v) => v.trim());
}

function parseCsv(text) {
  const rows = String(text || '')
    .replace(/^\uFEFF/, '')
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);

  if (rows.length < 2) return [];
  const headers = parseCsvLine(rows[0]);

  return rows.slice(1).map((line) => {
    const values = parseCsvLine(line);
    return headers.reduce((obj, header, index) => {
      obj[header] = values[index] ?? '';
      return obj;
    }, {});
  });
}

function toNumber(value) {
  const number = Number(String(value ?? '').replace(',', '.'));
  return Number.isFinite(number) ? number : null;
}

function distanceMeters(a, b) {
  const R = 6371000;
  const dLat = ((b.latitude - a.latitude) * Math.PI) / 180;
  const dLon = ((b.longitude - a.longitude) * Math.PI) / 180;
  const lat1 = (a.latitude * Math.PI) / 180;
  const lat2 = (b.latitude * Math.PI) / 180;
  const x = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) ** 2;
  return Math.round(2 * R * Math.atan2(Math.sqrt(x), Math.sqrt(1 - x)));
}

function safeLimit(limit) {
  return Math.min(Math.max(Number(limit || DEFAULT_SEARCH_LIMIT), 1), MAX_SEARCH_LIMIT);
}

function normalizeRouteName(route = {}) {
  return String(route.route_short_name || route.route_long_name || route.route_id || '').trim();
}

function buildStopRoutes(gtfs) {
  const routeById = new Map(gtfs.routes.map((route) => [String(route.route_id), normalizeRouteName(route)]));
  const tripRouteByTripId = new Map(gtfs.trips.map((trip) => [String(trip.trip_id), String(trip.route_id)]));
  const routesByStopId = new Map();

  for (const stopTime of gtfs.stopTimes) {
    const stopId = String(stopTime.stop_id || '');
    const tripId = String(stopTime.trip_id || '');
    const routeId = tripRouteByTripId.get(tripId);
    const routeName = routeById.get(routeId) || routeId;
    if (!stopId || !routeName) continue;
    if (!routesByStopId.has(stopId)) routesByStopId.set(stopId, new Set());
    routesByStopId.get(stopId).add(String(routeName));
  }

  return routesByStopId;
}

function itemKey(name) {
  return normalizeText(name).replace(/\s+/g, '-');
}

function mapGtfsStop(stop, routesByStopId) {
  const latitude = toNumber(stop.stop_lat);
  const longitude = toNumber(stop.stop_lon);
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return null;

  const id = String(stop.stop_id || stop.stop_code || itemKey(stop.stop_name)).trim();
  const name = String(stop.stop_name || stop.name || id).trim();
  const routes = Array.from(routesByStopId.get(String(stop.stop_id)) || []).sort((a, b) => a.localeCompare(b, 'lt'));

  return {
    id: `stop-${id}`,
    stopId: String(stop.stop_id || id),
    stopCode: stop.stop_code || null,
    title: name,
    name,
    subtitle: routes.length ? `Stotelė • maršrutai: ${routes.slice(0, 8).join(', ')}` : 'Klaipėdos stotelė',
    type: 'stop',
    source: 'gtfs',
    latitude,
    longitude,
    coordinate: { latitude, longitude },
    routes,
    routeIds: routes,
    keywords: [stop.stop_code, stop.stop_desc, name, name.replace(/\s+st\.?$/i, ''), ...(routes.map((r) => `autobusas ${r}`))].filter(Boolean),
  };
}

function mapSeedStop(stop) {
  const latitude = toNumber(stop.stop_lat ?? stop.latitude ?? stop.lat);
  const longitude = toNumber(stop.stop_lon ?? stop.longitude ?? stop.lon ?? stop.lng);
  const name = String(stop.stop_name || stop.name || '').trim();
  if (!name || !Number.isFinite(latitude) || !Number.isFinite(longitude)) return null;
  const routes = Array.isArray(stop.routes) ? stop.routes.map(String) : [];
  return {
    id: stop.stop_id ? `stop-${stop.stop_id}` : `seed-${itemKey(name)}`,
    stopId: stop.stop_id || `seed-${itemKey(name)}`,
    title: name,
    name,
    subtitle: routes.length ? `Stotelė • maršrutai: ${routes.join(', ')}` : 'Klaipėdos stotelė',
    type: 'stop',
    source: 'seed',
    latitude,
    longitude,
    coordinate: { latitude, longitude },
    routes,
    routeIds: routes,
    keywords: [name, ...(routes.map((r) => `autobusas ${r}`))],
  };
}

function mapPoi(item) {
  const latitude = toNumber(item.latitude ?? item.lat);
  const longitude = toNumber(item.longitude ?? item.lon ?? item.lng);
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return null;
  const name = String(item.title || item.name || item.id || '').trim();
  if (!name) return null;
  return {
    id: item.id || `poi-${itemKey(name)}`,
    title: item.title || item.name,
    name: item.name || item.title,
    subtitle: item.subtitle || item.address || 'Lietuva',
    type: item.type || 'poi',
    source: 'poi',
    latitude,
    longitude,
    coordinate: { latitude, longitude },
    routes: item.routes || [],
    routeIds: item.routes || [],
    keywords: item.keywords || [],
  };
}

function loadData() {
  if (cache) return cache;

  const gtfs = {
    stops: parseCsv(readFileSafe(path.join(GTFS_ROOT, 'stops.txt'))),
    routes: parseCsv(readFileSafe(path.join(GTFS_ROOT, 'routes.txt'))),
    trips: parseCsv(readFileSafe(path.join(GTFS_ROOT, 'trips.txt'))),
    stopTimes: parseCsv(readFileSafe(path.join(GTFS_ROOT, 'stop_times.txt'))),
  };

  const routesByStopId = buildStopRoutes(gtfs);
  const gtfsStops = gtfs.stops.map((stop) => mapGtfsStop(stop, routesByStopId)).filter(Boolean);
  const seedStops = readJsonSafe('gtfs/klaipedaSeedStops.json', []).map(mapSeedStop).filter(Boolean);
  const pois = readJsonSafe('poi/klaipedaPois.json', []).map(mapPoi).filter(Boolean);
  const aliases = readJsonSafe('poi/placeAliases.json', []);

  const stops = gtfsStops.length > 0 ? gtfsStops : seedStops;
  const places = [...pois, ...stops];

  cache = {
    gtfs,
    aliases,
    stops,
    pois,
    places,
    meta: {
      stopSource: gtfsStops.length > 0 ? 'gtfs' : 'seed',
      gtfsStopsCount: gtfsStops.length,
      seedStopsCount: seedStops.length,
      poiCount: pois.length,
      geocoder: process.env.ORS_API_KEY ? 'ors' : 'disabled_missing_ORS_API_KEY',
    },
  };

  return cache;
}

function resetCache() {
  cache = null;
}

function aliasesForItem(item, aliases) {
  const name = normalizeText(item.name || item.title || '');
  const title = normalizeText(item.title || item.name || '');

  return aliases
    .filter((entry) => {
      const canonical = normalizeText(entry.canonical || '');
      if (!canonical) return false;
      return canonical === name || canonical === title || name.includes(canonical) || canonical.includes(name) || title.includes(canonical);
    })
    .flatMap((entry) => [...(entry.aliases || []), ...(entry.keywords || [])]);
}

function scoreItem(item, query, aliases) {
  const terms = [
    item.id,
    item.stopId,
    item.stopCode,
    item.title,
    item.name,
    item.subtitle,
    ...(item.routes || []),
    ...(item.routeIds || []),
    ...(item.keywords || []),
    ...aliasesForItem(item, aliases),
  ].map(normalizeText).filter(Boolean);

  let score = 0;
  const parts = query.split(' ').filter(Boolean);

  for (const term of terms) {
    if (term === query) score = Math.max(score, 120);
    else if (term.startsWith(query)) score = Math.max(score, 100);
    else if (term.includes(query)) score = Math.max(score, 82);
    else if (parts.length && parts.every((part) => term.includes(part))) score = Math.max(score, 64);
    else if (parts.length && parts.some((part) => part.length >= 4 && term.includes(part))) score = Math.max(score, 42);
  }

  if (item.type === 'poi' && score > 0) score += 12;
  if (item.type === 'city' && score > 0) score += 10;
  if (item.type === 'region' && score > 0) score += 8;
  if (item.type === 'stop' && /\bst\b|stotele|stotel|autobus/.test(query)) score += 8;

  return score;
}

function searchItems(items, q, limit, type) {
  const query = normalizeText(q);
  if (!query || query.length < 1) return [];
  const { aliases } = loadData();

  return items
    .map((item) => ({ item, score: scoreItem(item, query, aliases) }))
    .filter(({ item, score }) => score > 0 && (!type || type === 'all' || item.type === type))
    .sort((a, b) => b.score - a.score || String(a.item.name).localeCompare(String(b.item.name), 'lt'))
    .slice(0, safeLimit(limit))
    .map(({ item, score }) => ({ ...item, score }));
}

function searchStops(q, limit = DEFAULT_SEARCH_LIMIT) {
  return searchItems(loadData().stops, q, limit, 'stop');
}

function searchLocal(q, limit = DEFAULT_SEARCH_LIMIT, type = 'all') {
  return searchItems(loadData().places, q, limit, type);
}

function allStops() {
  return loadData().stops;
}

function allPlaces() {
  return loadData().places;
}

function inLithuania(lon, lat) {
  return lon >= LT_BBOX.minLon && lon <= LT_BBOX.maxLon && lat >= LT_BBOX.minLat && lat <= LT_BBOX.maxLat;
}

function classifyOrsFeature(feature) {
  const layer = String(feature?.properties?.layer || '').toLowerCase();
  if (layer.includes('address')) return 'address';
  if (layer.includes('street')) return 'address';
  if (layer.includes('venue')) return 'poi';
  if (layer.includes('locality') || layer.includes('localadmin')) return 'city';
  if (layer.includes('county') || layer.includes('region')) return 'region';
  return 'address';
}

function mapOrsFeature(feature, index) {
  const coords = feature?.geometry?.coordinates;
  if (!Array.isArray(coords) || coords.length < 2) return null;
  const longitude = Number(coords[0]);
  const latitude = Number(coords[1]);
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return null;
  if (!inLithuania(longitude, latitude)) return null;

  const p = feature.properties || {};
  const title = String(p.name || p.label || p.street || p.locality || p.region || 'Vieta').trim();
  const locality = p.locality || p.localadmin || p.county || p.region || 'Lietuva';
  const label = String(p.label || [p.street, p.housenumber, locality].filter(Boolean).join(' ') || locality).trim();
  const type = classifyOrsFeature(feature);

  return {
    id: `ors-${type}-${index}-${itemKey(label)}`,
    title,
    name: title,
    subtitle: label,
    type,
    source: 'ors',
    latitude,
    longitude,
    coordinate: { latitude, longitude },
    confidence: p.confidence,
    layer: p.layer,
    keywords: [label, locality, p.street, p.housenumber].filter(Boolean),
    score: Math.round((Number(p.confidence) || 0.5) * 50),
  };
}

async function searchOrsGeocoder(q, limit = 8) {
  const key = process.env.ORS_API_KEY;
  const query = String(q || '').trim();
  if (!key || query.length < 3 || typeof fetch !== 'function') return [];

  const url = new URL('https://api.openrouteservice.org/geocode/search');
  url.searchParams.set('api_key', key);
  url.searchParams.set('text', query);
  url.searchParams.set('size', String(Math.min(Math.max(Number(limit) || 8, 1), 12)));
  url.searchParams.set('boundary.country', 'LT');
  url.searchParams.set('layers', 'venue,address,street,locality,localadmin,county,region');
  url.searchParams.set('boundary.rect.min_lon', String(LT_BBOX.minLon));
  url.searchParams.set('boundary.rect.min_lat', String(LT_BBOX.minLat));
  url.searchParams.set('boundary.rect.max_lon', String(LT_BBOX.maxLon));
  url.searchParams.set('boundary.rect.max_lat', String(LT_BBOX.maxLat));

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 4200);

  try {
    const response = await fetch(url, { signal: controller.signal });
    if (!response.ok) return [];
    const json = await response.json();
    return (json.features || []).map(mapOrsFeature).filter(Boolean);
  } catch {
    return [];
  } finally {
    clearTimeout(timer);
  }
}

function dedupeResults(items) {
  const seen = new Set();
  const out = [];

  for (const item of items) {
    const latKey = Number(item.latitude).toFixed(4);
    const lonKey = Number(item.longitude).toFixed(4);
    const key = `${normalizeText(item.title || item.name)}:${latKey}:${lonKey}`;
    const titleKey = `${normalizeText(item.title || item.name)}:${normalizeText(item.subtitle || '')}`;
    if (seen.has(key) || seen.has(titleKey)) continue;
    seen.add(key);
    seen.add(titleKey);
    out.push(item);
  }

  return out;
}

function rankMixedResults(results, query) {
  const nq = normalizeText(query);
  return results
    .map((item) => {
      let score = Number(item.score || 0);
      const title = normalizeText(item.title || item.name || '');
      const subtitle = normalizeText(item.subtitle || '');
      if (title === nq) score += 60;
      else if (title.startsWith(nq)) score += 40;
      else if (title.includes(nq)) score += 22;
      if (subtitle.includes(nq)) score += 8;
      if (item.source === 'poi') score += 20;
      if (item.source === 'gtfs') score += 10;
      if (item.type === 'address') score += 6;
      return { ...item, score };
    })
    .sort((a, b) => b.score - a.score || String(a.title).localeCompare(String(b.title), 'lt'));
}

function findNearestStop(input, options = {}) {
  const latitude = toNumber(input?.latitude ?? input?.lat);
  const longitude = toNumber(input?.longitude ?? input?.lon ?? input?.lng);
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return null;

  const routeId = options.routeId ? String(options.routeId) : null;
  const point = { latitude, longitude };
  const candidates = allStops()
    .filter((stop) => !routeId || !stop.routes?.length || stop.routes.map(String).includes(routeId))
    .map((stop) => ({ ...stop, distanceMeters: distanceMeters(point, stop.coordinate) }))
    .sort((a, b) => a.distanceMeters - b.distanceMeters);

  return candidates[0] || null;
}

async function index(query = {}) {
  const q = query.q || query.query || query.text || query.search || '';
  const type = query.type || 'all';
  const limit = safeLimit(query.limit);
  const data = loadData();

  const localResults = type === 'stop' ? searchStops(q, limit) : searchLocal(q, limit, type);
  const shouldUseGeocoder = type === 'all' || type === 'address' || type === 'city' || type === 'region' || type === 'poi';
  const geocoderResults = shouldUseGeocoder ? await searchOrsGeocoder(q, Math.min(12, limit)) : [];
  const combined = rankMixedResults(dedupeResults([...localResults, ...geocoderResults]), q).slice(0, limit);

  return {
    ok: true,
    query: q,
    source: data.meta.stopSource,
    count: combined.length,
    results: combined,
    places: combined,
    stops: combined.filter((item) => item.type === 'stop'),
    addresses: combined.filter((item) => item.type === 'address'),
    meta: {
      ...data.meta,
      localCount: localResults.length,
      geocoderCount: geocoderResults.length,
      geocoderEnabled: Boolean(process.env.ORS_API_KEY),
    },
  };
}

async function stops(query = {}) {
  const q = query.q || query.query || query.text || query.search || '';
  const results = searchStops(q, query.limit);
  const data = loadData();

  return {
    ok: true,
    query: q,
    source: data.meta.stopSource,
    count: results.length,
    results,
    places: results,
    stops: results,
    meta: data.meta,
  };
}

module.exports = {
  index,
  stops,
  searchStops,
  searchLocal,
  searchOrsGeocoder,
  normalizeText,
  allStops,
  allPlaces,
  findNearestStop,
  resetCache,
  distanceMeters,
};
