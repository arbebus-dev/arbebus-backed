const { getPool } = require('../../db/pool');
const pois = require('../../data/poi/klaipedaPois.json');

const KLAIPEDA_CENTER = { latitude: 55.7033, longitude: 21.1443 };
const DEFAULT_COUNTRY_CODE = 'lt';

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
    subtitle: String(poi.subtitle ?? poi.address ?? 'Vieta'),
    type: poi.type || 'place',
    latitude: Number(poi.latitude),
    longitude: Number(poi.longitude),
    keywords: Array.isArray(poi.keywords) ? poi.keywords : [],
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

  if (title === query || name === query) return 420;
  if (keywords.some((keyword) => keyword === query)) return 390;
  if (title.startsWith(query) || name.startsWith(query)) return 340;
  if (title.includes(query) || name.includes(query)) return 290;
  if (keywords.some((keyword) => keyword.includes(query))) return 260;
  if (haystack.includes(query)) return 220;

  const matchedTokens = tokens.filter((token) => haystack.includes(token)).length;
  if (matchedTokens > 0 && tokens.length > 0) {
    return Math.round((matchedTokens / tokens.length) * 160);
  }

  return 0;
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
    distanceMeters: userPoint
      ? distanceMeters(userPoint, { latitude, longitude })
      : distanceMeters(KLAIPEDA_CENTER, { latitude, longitude }),
    score: Number(item.score || 0),
    source,
  };
}

function getOpenCageKey() {
  return process.env.OPENCAGE_API_KEY || process.env.OPEN_CAGE_API_KEY || null;
}

function openCageBounds(userPoint) {
  const center = userPoint || KLAIPEDA_CENTER;
  const lat = Number(center.latitude);
  const lon = Number(center.longitude);

  if (!Number.isFinite(lat) || !Number.isFinite(lon)) {
    return '20.2,54.8,22.8,56.4';
  }

  const deltaLat = 0.9;
  const deltaLon = 1.25;

  return `${lon - deltaLon},${lat - deltaLat},${lon + deltaLon},${lat + deltaLat}`;
}

function classifyOpenCageType(components = {}) {
  if (components.road || components.street || components.house_number) return 'address';
  if (components.city || components.town || components.village || components.hamlet) return 'place';
  if (components.shopping || components.shop || components.commercial) return 'place';
  if (components.aeroway || components.airport) return 'airport';
  return 'place';
}

function openCageTitle(result, query) {
  const components = result.components || {};

  return String(
    components.name ||
      components.shopping ||
      components.shop ||
      components.attraction ||
      components.building ||
      components.amenity ||
      components.road ||
      components.street ||
      components.village ||
      components.town ||
      components.city ||
      components.hamlet ||
      result.formatted ||
      query
  );
}

function openCageSubtitle(result) {
  const components = result.components || {};

  const settlement =
    components.city ||
    components.town ||
    components.village ||
    components.hamlet ||
    components.municipality ||
    components.county ||
    null;

  const road = components.road || components.street || null;
  const house = components.house_number || null;

  if (road && house && settlement) return `${road} ${house}, ${settlement}`;
  if (road && settlement) return `${road}, ${settlement}`;
  if (settlement && components.state) return `${settlement}, ${components.state}`;
  if (settlement) return `${settlement}, Lietuva`;

  return String(result.formatted || 'Lietuva');
}

function openCageScore(result, index, query, userPoint) {
  const confidence = Number(result.confidence || 0);
  const title = normalizeText(openCageTitle(result, query));
  const formatted = normalizeText(result.formatted || '');
  const normalizedQuery = normalizeText(query);

  let score = 700 + confidence * 35 - index * 6;

  if (title === normalizedQuery) score += 260;
  else if (title.startsWith(normalizedQuery)) score += 180;
  else if (formatted.includes(normalizedQuery)) score += 120;

  const geometry = {
    latitude: Number(result?.geometry?.lat),
    longitude: Number(result?.geometry?.lng),
  };

  const distance = distanceMeters(userPoint, geometry);
  if (distance < 30000) score += 70;
  else if (distance < 80000) score += 35;

  return score;
}

async function searchOpenCage(q, userPoint, limit) {
  const apiKey = getOpenCageKey();
  if (!apiKey || typeof fetch !== 'function') return [];

  const url = new URL('https://api.opencagedata.com/geocode/v1/json');
  url.searchParams.set('q', q);
  url.searchParams.set('key', apiKey);
  url.searchParams.set('limit', String(Math.min(Math.max(limit, 5), 10)));
  url.searchParams.set('countrycode', DEFAULT_COUNTRY_CODE);
  url.searchParams.set('language', 'lt');
  url.searchParams.set('no_annotations', '1');
  url.searchParams.set('bounds', openCageBounds(userPoint));
  url.searchParams.set('proximity', `${userPoint.longitude},${userPoint.latitude}`);

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 6500);

    const response = await fetch(url.toString(), {
      signal: controller.signal,
      headers: {
        'User-Agent': 'Arbebus/1.0 contact@arbebus.com',
      },
    }).finally(() => clearTimeout(timeout));

    if (!response.ok) {
      console.error('OpenCage failed:', response.status);
      return [];
    }

    const data = await response.json();

    return (data.results || [])
      .map((result, index) => {
        const latitude = Number(result?.geometry?.lat);
        const longitude = Number(result?.geometry?.lng);

        if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return null;

        const title = openCageTitle(result, q);
        const subtitle = openCageSubtitle(result);
        const type = classifyOpenCageType(result.components || {});

        return {
          id: `opencage-${index}-${latitude.toFixed(5)}-${longitude.toFixed(5)}`,
          title,
          name: title,
          subtitle,
          type,
          latitude,
          longitude,
          distanceMeters: distanceMeters(userPoint, { latitude, longitude }),
          score: openCageScore(result, index, q, userPoint),
          source: 'opencage',
        };
      })
      .filter(Boolean);
  } catch (error) {
    console.error('OpenCage search failed:', error.message);
    return [];
  }
}

async function searchStops(q, userPoint, limit) {
  const pool = getPool();
  const params = [q, userPoint.longitude, userPoint.latitude, limit];

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
        WHEN lower(unaccent(stop_name)) = lower(unaccent($1)) THEN 520
        WHEN lower(unaccent(stop_name)) LIKE lower(unaccent($1 || '%')) THEN 420
        WHEN lower(unaccent(stop_name)) LIKE lower(unaccent('%' || $1 || '%')) THEN 300
        ELSE 100
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

function searchLocalPois(q, userPoint, limit) {
  const list = Array.isArray(pois) ? pois : [];

  return list
    .map((poi) => {
      const normalized = normalizePoi(poi);
      const score = poiScore(normalized, q);
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
    .filter(Boolean)
    .sort((a, b) => Number(b.score || 0) - Number(a.score || 0))
    .slice(0, limit);
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

  const [geocodeMatches, stopMatches] = await Promise.all([
    searchOpenCage(query, userPoint, Math.max(8, limit)).catch((error) => {
      console.error('OpenCage fallback failed:', error.message);
      return [];
    }),
    searchStops(query, userPoint, Math.max(8, limit)).catch((error) => {
      console.error('Stop search failed:', error.message);
      return [];
    }),
  ]);

  const poiMatches = searchLocalPois(query, userPoint, Math.max(4, Math.floor(limit / 3)));

  // Production order:
  // 1) OpenCage real geocoder for addresses, villages, cities, POIs.
  // 2) GTFS stops.
  // 3) Local POI JSON only as weak fallback, never as hardcoded override.
  const results = dedupeResults([
    ...geocodeMatches,
    ...stopMatches,
    ...poiMatches,
  ]);

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
