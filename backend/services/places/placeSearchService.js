const { getPool } = require('../db/pool');
const pois = require('../data/poi/klaipedaPois.json');

const KLAIPEDA_CENTER = { latitude: 55.7033, longitude: 21.1443 };

const IMPORTANT_POI_ALIASES = [
  {
    id: 'poi-akropolis-klaipeda',
    title: 'Akropolis',
    name: 'Akropolis Klaipėda',
    subtitle: 'Taikos pr. 61, Klaipėda',
    type: 'shopping',
    latitude: 55.684946,
    longitude: 21.158473,
    keywords: [
      'akropolis',
      'akropolis klaipeda',
      'klaipedos akropolis',
      'pc akropolis',
      'prekybos centras akropolis',
      'taikos 61',
      'taikos pr 61',
    ],
    priority: 500,
  },
  {
    id: 'poi-klaipeda-bus-station',
    title: 'Klaipėdos autobusų stotis',
    name: 'Klaipėdos autobusų stotis',
    subtitle: 'Butkų Juzės g. 9, Klaipėda',
    type: 'transport',
    latitude: 55.71737,
    longitude: 21.13437,
    keywords: [
      'autobusu stotis',
      'autobusų stotis',
      'klaipedos autobusu stotis',
      'klaipėdos autobusų stotis',
      'bus station',
      'stotis',
    ],
    priority: 450,
  },
  {
    id: 'poi-palanga',
    title: 'Palanga',
    name: 'Palanga',
    subtitle: 'Palanga, Lietuva',
    type: 'city',
    latitude: 55.92073,
    longitude: 21.06737,
    keywords: ['palanga', 'palangos miestas'],
    priority: 350,
  },
  {
    id: 'poi-palanga-airport',
    title: 'Palangos oro uostas',
    name: 'Palangos oro uostas',
    subtitle: 'Liepojos pl. 1, Palanga',
    type: 'airport',
    latitude: 55.97323,
    longitude: 21.09361,
    keywords: [
      'palangos oro uostas',
      'oro uostas',
      'airport',
      'palanga airport',
      'plq',
    ],
    priority: 360,
  },
];

function normalizeText(value) {
  return String(value || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/ė/g, 'e')
    .replace(/ų/g, 'u')
    .replace(/ū/g, 'u')
    .replace(/š/g, 's')
    .replace(/ž/g, 'z')
    .replace(/č/g, 'c')
    .replace(/ą/g, 'a')
    .replace(/ę/g, 'e')
    .replace(/į/g, 'i')
    .replace(/[^a-z0-9\s.-]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function queryTokens(value) {
  return normalizeText(value)
    .split(' ')
    .map((token) => token.trim())
    .filter((token) => token.length >= 2);
}

function distanceMeters(a, b) {
  if (!a || !b) return 0;
  const lat1 = Number(a.latitude);
  const lon1 = Number(a.longitude);
  const lat2 = Number(b.latitude);
  const lon2 = Number(b.longitude);
  if (![lat1, lon1, lat2, lon2].every(Number.isFinite)) return 0;

  const R = 6371000;
  const toRad = (deg) => (deg * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const s1 = Math.sin(dLat / 2);
  const s2 = Math.sin(dLon / 2);
  const x = s1 * s1 + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * s2 * s2;
  return Math.round(R * 2 * Math.atan2(Math.sqrt(x), Math.sqrt(1 - x)));
}

function normalizePoi(poi) {
  return {
    id: String(poi.id ?? poi.title ?? poi.name),
    title: String(poi.title ?? poi.name ?? 'Vieta'),
    name: String(poi.name ?? poi.title ?? 'Vieta'),
    subtitle: String(poi.subtitle ?? poi.address ?? 'Vieta Klaipėdoje'),
    type: poi.type || 'place',
    latitude: Number(poi.latitude),
    longitude: Number(poi.longitude),
    keywords: Array.isArray(poi.keywords) ? poi.keywords : [],
    priority: Number(poi.priority || 0),
  };
}

function poiScore(poi, q) {
  const item = normalizePoi(poi);
  const query = normalizeText(q);
  if (!query) return 0;

  const title = normalizeText(item.title);
  const name = normalizeText(item.name);
  const subtitle = normalizeText(item.subtitle);
  const keywords = item.keywords.map(normalizeText);
  const haystack = normalizeText([title, name, subtitle, ...keywords].join(' '));
  const tokens = queryTokens(query);

  let score = Number(item.priority || 0);

  if (title === query || name === query) score += 1000;
  else if (keywords.some((keyword) => keyword === query)) score += 950;
  else if (title.startsWith(query) || name.startsWith(query)) score += 850;
  else if (title.includes(query) || name.includes(query)) score += 760;
  else if (keywords.some((keyword) => keyword.includes(query))) score += 720;
  else if (haystack.includes(query)) score += 620;
  else {
    const matchedTokens = tokens.filter((token) => haystack.includes(token)).length;
    if (matchedTokens > 0 && tokens.length > 0) {
      score += Math.round((matchedTokens / tokens.length) * 420);
    }
  }

  if (score <= Number(item.priority || 0)) return 0;

  if (item.type === 'shopping' || item.type === 'transport' || item.type === 'airport') score += 40;
  return score;
}

function normalizeResult(item, userPoint, source) {
  const latitude = Number(item.latitude);
  const longitude = Number(item.longitude);
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return null;

  return {
    id: String(item.id),
    title: String(item.title ?? item.name ?? 'Vieta'),
    name: String(item.name ?? item.title ?? 'Vieta'),
    subtitle: String(item.subtitle ?? item.address ?? source),
    type: item.type || source,
    latitude,
    longitude,
    distanceMeters: userPoint ? distanceMeters(userPoint, { latitude, longitude }) : distanceMeters(KLAIPEDA_CENTER, { latitude, longitude }),
    score: Number(item.score || 0),
    source,
  };
}

async function searchStops(q, userPoint, limit) {
  const pool = getPool();
  const hasPoint = userPoint && Number.isFinite(userPoint.latitude) && Number.isFinite(userPoint.longitude);
  const params = hasPoint ? [q, userPoint.longitude, userPoint.latitude, limit] : [q, KLAIPEDA_CENTER.longitude, KLAIPEDA_CENTER.latitude, limit];

  const sql = `
    SELECT
      stop_id AS id,
      stop_name AS name,
      stop_lat AS latitude,
      stop_lon AS longitude,
      ST_DistanceSphere(
        geom,
        ST_SetSRID(ST_MakePoint($2, $3), 4326)
      ) AS distance_meters,
      CASE
        WHEN lower(unaccent(stop_name)) = lower(unaccent($1)) THEN 500
        WHEN lower(unaccent(stop_name)) LIKE lower(unaccent($1 || '%')) THEN 360
        WHEN lower(unaccent(stop_name)) LIKE lower(unaccent('%' || $1 || '%')) THEN 260
        ELSE 80
      END AS text_score
    FROM transit.stops
    WHERE
      stop_name ILIKE '%' || $1 || '%'
      OR stop_code ILIKE '%' || $1 || '%'
      OR stop_id ILIKE '%' || $1 || '%'
    ORDER BY text_score DESC, distance_meters ASC, stop_name ASC
    LIMIT $4
  `;

  const result = await pool.query(sql, params);
  return result.rows.map((row) => ({
    id: String(row.id),
    title: String(row.name),
    name: String(row.name),
    subtitle: 'Stotelė',
    type: 'stop',
    latitude: Number(row.latitude),
    longitude: Number(row.longitude),
    distanceMeters: Number(row.distance_meters || 0),
    score: Number(row.text_score || 0),
    source: 'stop',
  }));
}

function dedupeResults(results) {
  const map = new Map();

  for (const item of results) {
    if (!item) continue;

    const key = `${normalizeText(item.title)}:${Number(item.latitude).toFixed(5)}:${Number(item.longitude).toFixed(5)}`;
    const current = map.get(key);

    if (!current || Number(item.score || 0) > Number(current.score || 0)) {
      map.set(key, item);
    }
  }

  return Array.from(map.values());
}

function sortResults(results) {
  return [...results].sort((a, b) => {
    const scoreDiff = Number(b.score || 0) - Number(a.score || 0);
    if (Math.abs(scoreDiff) > 15) return scoreDiff;

    const distanceDiff = Number(a.distanceMeters || 0) - Number(b.distanceMeters || 0);
    if (Math.abs(distanceDiff) > 50) return distanceDiff;

    return String(a.title || '').localeCompare(String(b.title || ''), 'lt');
  });
}

async function searchPlaces({ q, lat, lon, limit = 12 }) {
  const query = String(q || '').trim();
  if (query.length < 2) return [];

  const userPoint = Number.isFinite(Number(lat)) && Number.isFinite(Number(lon))
    ? { latitude: Number(lat), longitude: Number(lon) }
    : KLAIPEDA_CENTER;

  const allPois = [
    ...IMPORTANT_POI_ALIASES,
    ...(Array.isArray(pois) ? pois : []),
  ];

  const poiMatches = allPois
    .map((poi) => {
      const normalized = normalizePoi(poi);
      const score = poiScore(normalized, query);
      if (!score) return null;

      return normalizeResult(
        {
          ...normalized,
          score,
        },
        userPoint,
        normalized.type || 'place'
      );
    })
    .filter(Boolean);

  let stopMatches = [];
  try {
    stopMatches = await searchStops(query, userPoint, Math.max(8, limit));
  } catch (error) {
    console.error('POI stop fallback failed:', error.message);
  }

  const results = dedupeResults([...poiMatches, ...stopMatches]);

  return sortResults(results)
    .slice(0, limit)
    .map((item) => ({
      id: item.id,
      title: item.title,
      name: item.name,
      subtitle: item.subtitle,
      type: item.type,
      latitude: item.latitude,
      longitude: item.longitude,
      distanceMeters: item.distanceMeters,
      score: item.score,
      source: item.source,
    }));
}

module.exports = { searchPlaces };
