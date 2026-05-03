const path = require('path');
const fs = require('fs');
const { normalizeText } = require('./searchnormalizer');
const geocoder = require('./geocoder.service');

const DEFAULT_SEARCH_LIMIT = 20;
const MAX_SEARCH_LIMIT = 80;
const DATA_ROOT = path.join(__dirname, '../../data');
const GTFS_ROOT = path.join(DATA_ROOT, 'gtfs');

let cache = null;

const IMPORTANT_POIS = [
  {
    id: 'poi-akropolis-klaipeda',
    title: 'Akropolis',
    name: 'Akropolis Klaipėda',
    subtitle: 'Taikos pr. 61, Klaipėda',
    type: 'poi',
    latitude: 55.68962,
    longitude: 21.14691,
    keywords: ['akropolis', 'akro', 'akropoli', 'pc akropolis', 'prekybos centras', 'prekybcentris', 'shopping', 'mall', 'taikos 61', 'taikos pr 61'],
  },
  {
    id: 'poi-svyturio-arena',
    title: 'Švyturio arena',
    name: 'Švyturio arena',
    subtitle: 'Dubysos g. 10, Klaipėda',
    type: 'poi',
    latitude: 55.6891,
    longitude: 21.1439,
    keywords: ['svyturio arena', 'švyturio arena', 'arena', 'dubysos 10'],
  },
  {
    id: 'poi-klaipedos-baseinas',
    title: 'Klaipėdos baseinas',
    name: 'Klaipėdos baseinas',
    subtitle: 'Dubysos g., Klaipėda',
    type: 'poi',
    latitude: 55.68695,
    longitude: 21.14776,
    keywords: ['baseinas', 'klaipedos baseinas', 'klaipėdos baseinas', 'swimming pool'],
  },
  {
    id: 'city-radailiai',
    title: 'Radailiai',
    name: 'Radailiai',
    subtitle: 'Klaipėdos rajonas',
    type: 'region',
    latitude: 55.7868,
    longitude: 21.1618,
    keywords: ['radailiai', 'radailiu', 'radailių', 'radailiu st', 'radailių stotelė'],
  },
  {
    id: 'poi-klaipeda-train-station',
    title: 'Klaipėdos geležinkelio stotis',
    name: 'Klaipėdos geležinkelio stotis',
    subtitle: 'Priestočio g., Klaipėda',
    type: 'poi',
    latitude: 55.72029,
    longitude: 21.13553,
    keywords: ['gelezinkelio stotis', 'geležinkelio stotis', 'traukiniu stotis', 'traukinių stotis', 'train station', 'ltg'],
  },
  {
    id: 'poi-senoji-perkela',
    title: 'Senoji perkėla',
    name: 'Senoji perkėla',
    subtitle: 'Danės g. / Šiaurinis ragas, Klaipėda',
    type: 'poi',
    latitude: 55.70933,
    longitude: 21.12762,
    keywords: ['senoji perkela', 'senoji perkėla', 'keltas', 'kelto perkela', 'smiltyne', 'smiltynė', 'old ferry'],
  },
  {
    id: 'poi-naujoji-perkela',
    title: 'Naujoji perkėla',
    name: 'Naujoji perkėla',
    subtitle: 'Nemuno g., Klaipėda',
    type: 'poi',
    latitude: 55.68696,
    longitude: 21.13028,
    keywords: ['naujoji perkela', 'naujoji perkėla', 'keltas', 'kelto perkela', 'smiltyne', 'smiltynė', 'new ferry', 'nemuno perkela'],
  },
  {
    id: 'city-klaipeda',
    title: 'Klaipėda',
    name: 'Klaipėda',
    subtitle: 'Miestas',
    type: 'city',
    latitude: 55.7033,
    longitude: 21.1443,
    keywords: ['klaipeda', 'klaipėda', 'klaipedos miestas'],
  },
  {
    id: 'city-palanga',
    title: 'Palanga',
    name: 'Palanga',
    subtitle: 'Klaipėdos regionas',
    type: 'city',
    latitude: 55.9175,
    longitude: 21.0688,
    keywords: ['palanga', 'palangos'],
  },
  {
    id: 'city-kretinga',
    title: 'Kretinga',
    name: 'Kretinga',
    subtitle: 'Klaipėdos regionas',
    type: 'city',
    latitude: 55.8888,
    longitude: 21.2445,
    keywords: ['kretinga', 'kretingos'],
  },
];

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

function distanceMeters(a, b) {
  const R = 6371000;
  const dLat = ((b.latitude - a.latitude) * Math.PI) / 180;
  const dLon = ((b.longitude - a.longitude) * Math.PI) / 180;
  const lat1 = (a.latitude * Math.PI) / 180;
  const lat2 = (b.latitude * Math.PI) / 180;
  const x = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) ** 2;
  return Math.round(2 * R * Math.atan2(Math.sqrt(x), Math.sqrt(1 - x)));
}

function toNumber(value) {
  const number = Number(String(value ?? '').replace(',', '.'));
  return Number.isFinite(number) ? number : null;
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

function pointFromItem(item) {
  const latitude = toNumber(item.latitude ?? item.lat ?? item.stop_lat);
  const longitude = toNumber(item.longitude ?? item.lon ?? item.lng ?? item.stop_lon);
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return null;
  return { latitude, longitude };
}

function mapGtfsStop(stop, routesByStopId) {
  const coordinate = pointFromItem(stop);
  if (!coordinate) return null;

  const id = String(stop.stop_id || stop.stop_code || normalizeText(stop.stop_name)).trim();
  const name = String(stop.stop_name || stop.name || id).trim();
  const routes = Array.from(routesByStopId.get(String(stop.stop_id)) || []).sort((a, b) => a.localeCompare(b, 'lt'));

  return {
    id,
    stopId: id,
    stopCode: stop.stop_code || null,
    title: name,
    name,
    subtitle: routes.length ? `Maršrutai: ${routes.slice(0, 7).join(', ')}` : 'Klaipėdos stotelė',
    type: 'stop',
    source: 'gtfs',
    latitude: coordinate.latitude,
    longitude: coordinate.longitude,
    coordinate,
    routes,
    routeIds: routes,
    keywords: [stop.stop_code, stop.stop_desc, name, `${name} st`, `${name} stotele`, `${name} stotelė`].filter(Boolean),
  };
}

function mapSeedStop(stop) {
  const coordinate = pointFromItem(stop);
  const name = String(stop.stop_name || stop.name || '').trim();
  if (!name || !coordinate) return null;
  const routes = Array.isArray(stop.routes) ? stop.routes.map(String) : [];
  const id = stop.stop_id || `seed-${normalizeText(name).replace(/\s+/g, '-')}`;

  return {
    id,
    stopId: id,
    title: name,
    name,
    subtitle: routes.length ? `Maršrutai: ${routes.join(', ')}` : 'Klaipėdos stotelė',
    type: 'stop',
    source: 'seed',
    latitude: coordinate.latitude,
    longitude: coordinate.longitude,
    coordinate,
    routes,
    routeIds: routes,
    keywords: [name, `${name} st`, `${name} stotelė`, ...(routes.map((r) => `autobusas ${r}`))],
  };
}

function normalizePlaceType(value) {
  const type = String(value || '').toLowerCase();
  if (['stop', 'address', 'city', 'region'].includes(type)) return type;
  return 'poi';
}

function mapPoi(item) {
  const coordinate = pointFromItem(item);
  if (!coordinate) return null;
  const name = String(item.title || item.name || item.id || '').trim();
  if (!name) return null;

  return {
    id: item.id || `poi-${normalizeText(name).replace(/\s+/g, '-')}`,
    title: item.title || item.name,
    name: item.name || item.title,
    subtitle: item.subtitle || item.address || 'Klaipėda',
    type: normalizePlaceType(item.type),
    source: item.source || 'poi',
    latitude: coordinate.latitude,
    longitude: coordinate.longitude,
    coordinate,
    routes: item.routes || [],
    routeIds: item.routes || [],
    keywords: item.keywords || [],
  };
}

function dedupeItems(items) {
  const seen = new Map();

  for (const item of items.filter(Boolean)) {
    const key = normalizeText(item.id || `${item.title}-${item.latitude}-${item.longitude}`);
    const titleKey = `${normalizeText(item.title || item.name)}:${Number(item.latitude).toFixed(5)}:${Number(item.longitude).toFixed(5)}`;
    const existingKey = seen.has(key) ? key : seen.has(titleKey) ? titleKey : null;

    if (existingKey) {
      const existing = seen.get(existingKey);
      seen.set(existingKey, {
        ...existing,
        keywords: Array.from(new Set([...(existing.keywords || []), ...(item.keywords || [])])),
      });
    } else {
      seen.set(key, item);
      seen.set(titleKey, item);
    }
  }

  return Array.from(new Set(seen.values()));
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
  const poisFromFile = readJsonSafe('poi/klaipedaPois.json', []).map(mapPoi).filter(Boolean);
  const importantPois = IMPORTANT_POIS.map(mapPoi).filter(Boolean);
  const aliases = readJsonSafe('poi/placeAliases.json', []);

  const stops = gtfsStops.length > 0 ? gtfsStops : seedStops;
  const pois = dedupeItems([...importantPois, ...poisFromFile]);
  const places = dedupeItems([...pois, ...stops]);

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
      geocoder: 'nominatim-fallback',
    },
  };

  return cache;
}

function resetCache() {
  cache = null;
}

function aliasesForItem(item, aliases) {
  const fields = [item.name, item.title, item.subtitle, ...(item.keywords || [])].map(normalizeText).filter(Boolean);

  return aliases
    .filter((entry) => {
      const canonical = normalizeText(entry.canonical || '');
      if (!canonical) return false;
      return fields.some((field) => field === canonical || field.includes(canonical));
    })
    .flatMap((entry) => [entry.canonical, ...(entry.aliases || []), ...(entry.keywords || [])])
    .filter(Boolean);
}

function expandedQueries(query, aliases) {
  const q = normalizeText(query);
  const set = new Set([q]);

  for (const entry of aliases) {
    const canonical = normalizeText(entry.canonical || '');
    const values = [canonical, ...(entry.aliases || []), ...(entry.keywords || [])].map(normalizeText).filter(Boolean);
    const matches = values.some((value) => value === q || value.startsWith(q) || (q.startsWith(value) && value.length >= 8));
    if (!matches) continue;

    for (const value of values) set.add(value);
    if (canonical) set.add(canonical);
  }

  return Array.from(set).filter(Boolean);
}

function scoreAgainstTerm(term, query, parts) {
  if (!term || !query) return 0;
  if (term === query) return 130;
  if (term.startsWith(query)) return 108;
  if (term.includes(query)) return 86;
  if (parts.length && parts.every((part) => term.includes(part))) return 64;
  return 0;
}

function scoreItem(item, query, aliases) {
  const itemAliases = aliasesForItem(item, aliases);
  const terms = [
    item.id,
    item.stopId,
    item.stopCode,
    item.title,
    item.name,
    item.subtitle,
    item.source,
    item.type,
    ...(item.routes || []),
    ...(item.routeIds || []),
    ...(item.keywords || []),
    ...itemAliases,
  ].map(normalizeText).filter(Boolean);

  const queries = expandedQueries(query, aliases);
  let score = 0;

  for (const q of queries) {
    const parts = q.split(' ').filter(Boolean);
    for (const term of terms) {
      score = Math.max(score, scoreAgainstTerm(term, q, parts));
    }
  }

  if (score > 0) {
    if (item.type === 'poi') score += 6;
    if (item.type === 'stop') score += 3;
    if (item.source === 'geocoder') score = Math.max(1, score - 4);
  }

  return score;
}

function safeLimit(limit) {
  return Math.min(Math.max(Number(limit || DEFAULT_SEARCH_LIMIT), 1), MAX_SEARCH_LIMIT);
}

function typeMatches(item, type) {
  if (!type || type === 'all') return true;
  if (type === 'place') return item.type === 'poi' || item.type === 'city' || item.type === 'region' || item.type === 'address';
  if (type === 'poi') return item.type === 'poi';
  return item.type === type;
}

function searchItems(items, q, limit, type) {
  const query = normalizeText(q);
  if (!query || query.length < 1) return [];
  const { aliases } = loadData();

  return items
    .map((item) => ({ item, score: scoreItem(item, query, aliases) }))
    .filter(({ item, score }) => score > 0 && typeMatches(item, type))
    .sort((a, b) => b.score - a.score || String(a.item.title).localeCompare(String(b.item.title), 'lt'))
    .slice(0, safeLimit(limit))
    .map(({ item, score }) => ({ ...item, score }));
}

function mergeResults(local, remote, limit) {
  const merged = [];
  const keys = new Set();

  for (const item of [...local, ...remote]) {
    if (!item) continue;
    const key = `${normalizeText(item.title || item.name)}:${Number(item.latitude).toFixed(5)}:${Number(item.longitude).toFixed(5)}`;
    if (keys.has(key)) continue;
    keys.add(key);
    merged.push(item);
  }

  return merged.slice(0, safeLimit(limit));
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

  let geocoderResults = [];
  if (type !== 'stop' && String(q || '').trim().length >= 3 && (localResults.length < limit || geocoder.isLikelyAddressQuery(q))) {
    geocoderResults = await geocoder.geocode(q, { limit: Math.min(6, limit) });
  }

  const results = mergeResults(localResults, geocoderResults, limit);

  return {
    ok: true,
    query: q,
    source: data.meta.stopSource,
    count: results.length,
    results,
    places: results,
    stops: results.filter((item) => item.type === 'stop'),
    meta: {
      ...data.meta,
      localCount: localResults.length,
      geocoderCount: geocoderResults.length,
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
  normalizeText,
  allStops,
  allPlaces,
  findNearestStop,
  resetCache,
  distanceMeters,
};
