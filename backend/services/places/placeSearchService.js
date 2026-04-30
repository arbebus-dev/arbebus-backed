const { getPool } = require('../../db/pool');
const pois = require('../../data/poi/klaipedaPois.json');
const aliases = require('../../data/poi/placeAliases.json');

const KLAIPEDA_CENTER = { latitude: 55.7033, longitude: 21.1443 };
const DEFAULT_COUNTRY_CODE = 'lt';
const LT_FROM = 'ĄČĘĖĮŠŲŪŽąčęėįšųūž';
const LT_TO = 'ACEEEISUUZaceeeisuuz';

function normalizeText(value) {
  return String(value || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[ąĄ]/g, 'a')
    .replace(/[čČ]/g, 'c')
    .replace(/[ęĘėĖ]/g, 'e')
    .replace(/[įĮ]/g, 'i')
    .replace(/[šŠ]/g, 's')
    .replace(/[ųŲūŪ]/g, 'u')
    .replace(/[žŽ]/g, 'z')
    .replace(/[^a-z0-9\s.-]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function compactText(value) {
  return normalizeText(value).replace(/[\s.-]+/g, '');
}

function removeLithuanianEndings(token) {
  const value = normalizeText(token);
  if (value.length <= 4) return value;

  const endings = [
    'uose', 'iuose', 'omis', 'iams', 'iais', 'uose',
    'oje', 'eje', 'ais', 'iam', 'ios', 'ius', 'iai', 'ims',
    'as', 'is', 'ys', 'us', 'es', 'os', 'ai', 'ui', 'iu', 'io', 'ia', 'a', 'e', 'u', 'i', 'o'
  ];

  for (const ending of endings) {
    if (value.endsWith(ending) && value.length - ending.length >= 4) {
      return value.slice(0, -ending.length);
    }
  }

  return value;
}

function queryTokens(value) {
  return normalizeText(value)
    .split(' ')
    .map((token) => token.trim())
    .filter((token) => token.length >= 2);
}

function expandedQueryTerms(value) {
  const normalized = normalizeText(value);
  const tokens = queryTokens(normalized);
  const stems = tokens.map(removeLithuanianEndings).filter((item) => item.length >= 2);
  const terms = new Set([normalized, compactText(normalized), ...tokens, ...stems]);

  for (const item of aliases) {
    const all = [item.canonical, ...(item.aliases || []), ...(item.keywords || [])];
    const normalizedAliases = all.map(normalizeText).filter(Boolean);
    const compactAliases = normalizedAliases.map(compactText).filter(Boolean);
    const match = normalizedAliases.some((alias) => alias.includes(normalized) || normalized.includes(alias)) ||
      compactAliases.some((alias) => alias.includes(compactText(normalized)) || compactText(normalized).includes(alias));

    if (match) {
      all.forEach((alias) => {
        queryTokens(alias).forEach((token) => terms.add(token));
        terms.add(normalizeText(alias));
        terms.add(compactText(alias));
      });
    }
  }

  return Array.from(terms).filter((term) => term.length >= 2).slice(0, 24);
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

function scoreTextFields(fields, query, terms) {
  const normalizedQuery = normalizeText(query);
  const compactQuery = compactText(query);
  const normalizedFields = fields.map(normalizeText).filter(Boolean);
  const compactFields = normalizedFields.map(compactText).filter(Boolean);
  const haystack = normalizedFields.join(' ');
  const compactHaystack = compactFields.join(' ');

  let score = 0;

  for (const field of normalizedFields) {
    if (field === normalizedQuery) score = Math.max(score, 600);
    else if (field.startsWith(normalizedQuery)) score = Math.max(score, 480);
    else if (field.includes(normalizedQuery)) score = Math.max(score, 360);
  }

  if (compactQuery && compactFields.some((field) => field === compactQuery)) score = Math.max(score, 560);
  else if (compactQuery && compactFields.some((field) => field.startsWith(compactQuery))) score = Math.max(score, 430);
  else if (compactQuery && compactHaystack.includes(compactQuery)) score = Math.max(score, 320);

  const matchedTerms = terms.filter((term) => haystack.includes(term) || compactHaystack.includes(compactText(term))).length;
  if (matchedTerms > 0) score += Math.min(220, matchedTerms * 45);

  return score;
}

function poiScore(poi, q, terms) {
  const item = normalizePoi(poi);
  const aliasBoost = aliases.some((entry) => normalizeText(entry.canonical) === normalizeText(item.title)) ? 80 : 0;
  return scoreTextFields([item.title, item.name, item.subtitle, ...(item.keywords || [])], q, terms) + aliasBoost;
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

  if (!Number.isFinite(lat) || !Number.isFinite(lon)) return '20.2,54.8,22.8,56.4';

  const deltaLat = 0.9;
  const deltaLon = 1.25;
  return `${lon - deltaLon},${lat - deltaLat},${lon + deltaLon},${lat + deltaLat}`;
}

function classifyOpenCageType(components = {}) {
  if (components.road || components.street || components.house_number) return 'address';
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
  const settlement = components.city || components.town || components.village || components.hamlet || components.municipality || components.county || null;
  const road = components.road || components.street || null;
  const house = components.house_number || null;

  if (road && house && settlement) return `${road} ${house}, ${settlement}`;
  if (road && settlement) return `${road}, ${settlement}`;
  if (settlement && components.state) return `${settlement}, ${components.state}`;
  if (settlement) return `${settlement}, Lietuva`;
  return String(result.formatted || 'Lietuva');
}

async function searchOpenCage(q, userPoint, limit) {
  const apiKey = getOpenCageKey();
  if (!apiKey || typeof fetch !== 'function') return [];

  const url = new URL('https://api.opencagedata.com/geocode/v1/json');
  url.searchParams.set('q', q);
  url.searchParams.set('key', apiKey);
  url.searchParams.set('limit', String(Math.min(Math.max(limit, 4), 8)));
  url.searchParams.set('countrycode', DEFAULT_COUNTRY_CODE);
  url.searchParams.set('language', 'lt');
  url.searchParams.set('no_annotations', '1');
  url.searchParams.set('bounds', openCageBounds(userPoint));
  url.searchParams.set('proximity', `${userPoint.longitude},${userPoint.latitude}`);

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 5000);
    const response = await fetch(url.toString(), {
      signal: controller.signal,
      headers: { 'User-Agent': 'Arbebus/1.0 contact@arbebus.com' },
    }).finally(() => clearTimeout(timeout));

    if (!response.ok) return [];
    const data = await response.json();

    return (data.results || [])
      .map((result, index) => {
        const latitude = Number(result?.geometry?.lat);
        const longitude = Number(result?.geometry?.lng);
        if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return null;

        const title = openCageTitle(result, q);
        const subtitle = openCageSubtitle(result);
        const confidence = Number(result.confidence || 0);
        const textScore = scoreTextFields([title, subtitle, result.formatted || ''], q, expandedQueryTerms(q));

        return {
          id: `opencage-${index}-${latitude.toFixed(5)}-${longitude.toFixed(5)}`,
          title,
          name: title,
          subtitle,
          type: classifyOpenCageType(result.components || {}),
          latitude,
          longitude,
          distanceMeters: distanceMeters(userPoint, { latitude, longitude }),
          score: 500 + confidence * 20 + textScore - index * 8,
          source: 'opencage',
        };
      })
      .filter(Boolean);
  } catch (error) {
    console.error('OpenCage search failed:', error.message);
    return [];
  }
}

async function searchStops(q, userPoint, limit, terms) {
  const pool = getPool();
  const searchTerms = terms.length ? terms : [normalizeText(q)];

  const sql = `
    WITH query_terms AS (
      SELECT unnest($1::text[]) AS term
    ), stop_candidates AS (
      SELECT
        stop_id AS id,
        stop_code,
        stop_name AS name,
        stop_lat AS latitude,
        stop_lon AS longitude,
        geom,
        lower(translate(stop_name, $5, $6)) AS normalized_name,
        lower(translate(COALESCE(stop_code, ''), $5, $6)) AS normalized_code
      FROM transit.stops
    )
    SELECT
      id,
      stop_code,
      name,
      latitude,
      longitude,
      ST_DistanceSphere(geom, ST_SetSRID(ST_MakePoint($2, $3), 4326)) AS distance_meters,
      MAX(
        CASE
          WHEN normalized_name = lower(term) THEN 680
          WHEN normalized_code = lower(term) THEN 660
          WHEN normalized_name LIKE lower(term || '%') THEN 560
          WHEN normalized_name LIKE lower('%' || term || '%') THEN 430
          WHEN normalized_code LIKE lower(term || '%') THEN 390
          ELSE 0
        END
      ) AS text_score
    FROM stop_candidates, query_terms
    WHERE
      normalized_name LIKE lower('%' || term || '%')
      OR normalized_code LIKE lower('%' || term || '%')
      OR stop_name ILIKE '%' || $4 || '%'
      OR stop_code ILIKE '%' || $4 || '%'
      OR id ILIKE '%' || $4 || '%'
    GROUP BY id, stop_code, name, latitude, longitude, geom
    HAVING MAX(
      CASE
        WHEN normalized_name = lower(term) THEN 680
        WHEN normalized_code = lower(term) THEN 660
        WHEN normalized_name LIKE lower(term || '%') THEN 560
        WHEN normalized_name LIKE lower('%' || term || '%') THEN 430
        WHEN normalized_code LIKE lower(term || '%') THEN 390
        ELSE 0
      END
    ) > 0
    ORDER BY text_score DESC, distance_meters ASC, name ASC
    LIMIT $7
  `;

  const params = [searchTerms, userPoint.longitude, userPoint.latitude, q, LT_FROM, LT_TO, limit];
  const result = await pool.query(sql, params);

  return result.rows.map((row) => ({
    id: String(row.id),
    title: String(row.name),
    name: String(row.name),
    subtitle: row.stop_code ? `Stotelė • ${row.stop_code}` : 'Stotelė',
    type: 'stop',
    latitude: Number(row.latitude),
    longitude: Number(row.longitude),
    distanceMeters: Number(row.distance_meters || 0),
    score: Number(row.text_score || 0) + 90,
    source: 'stop',
  }));
}

function searchLocalPois(q, userPoint, limit, terms) {
  const list = Array.isArray(pois) ? pois : [];
  return list
    .map((poi) => {
      const normalized = normalizePoi(poi);
      const score = poiScore(normalized, q, terms);
      if (!score) return null;
      return normalizeResult({ ...normalized, score: score + 60 }, userPoint, normalized.type || 'place');
    })
    .filter(Boolean)
    .sort((a, b) => Number(b.score || 0) - Number(a.score || 0))
    .slice(0, limit);
}

function dedupeResults(results) {
  const map = new Map();

  for (const item of results) {
    if (!item) continue;
    const titleKey = normalizeText(item.title);
    const coordKey = `${Number(item.latitude).toFixed(5)}:${Number(item.longitude).toFixed(5)}`;
    const key = item.type === 'stop' ? `stop:${item.id}` : `${titleKey}:${coordKey}`;
    const current = map.get(key);

    if (!current || Number(item.score || 0) > Number(current.score || 0)) map.set(key, item);
  }

  return Array.from(map.values());
}

function sortResults(results) {
  return [...results].sort((a, b) => {
    const typeBoost = (item) => (item.type === 'stop' ? 25 : 0);
    const scoreA = Number(a.score || 0) + typeBoost(a);
    const scoreB = Number(b.score || 0) + typeBoost(b);
    const scoreDiff = scoreB - scoreA;
    if (Math.abs(scoreDiff) > 20) return scoreDiff;

    const distanceDiff = Number(a.distanceMeters || 0) - Number(b.distanceMeters || 0);
    if (Math.abs(distanceDiff) > 80) return distanceDiff;

    return String(a.title || '').localeCompare(String(b.title || ''), 'lt');
  });
}

function toPayload(results, query, limit) {
  const items = sortResults(dedupeResults(results)).slice(0, limit).map((item) => ({
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

  return { ok: true, query, count: items.length, items, results: items, suggestions: items };
}

async function searchPlaces({ q, query, text, lat, lon, latitude, longitude, limit = 12, mode = 'search' }) {
  const rawQuery = String(q || query || text || '').trim();
  if (rawQuery.length < 2) return { ok: true, query: rawQuery, count: 0, items: [], results: [], suggestions: [] };

  const userPoint = Number.isFinite(Number(lat ?? latitude)) && Number.isFinite(Number(lon ?? longitude))
    ? { latitude: Number(lat ?? latitude), longitude: Number(lon ?? longitude) }
    : KLAIPEDA_CENTER;

  const safeLimit = Math.min(Math.max(Number(limit) || 12, 1), mode === 'autocomplete' ? 12 : 30);
  const terms = expandedQueryTerms(rawQuery);

  const [stopMatches, poiMatches, geocodeMatches] = await Promise.all([
    searchStops(rawQuery, userPoint, Math.max(10, safeLimit), terms).catch((error) => {
      console.error('Stop autocomplete failed:', error.message);
      return [];
    }),
    Promise.resolve(searchLocalPois(rawQuery, userPoint, Math.max(6, safeLimit), terms)),
    mode === 'autocomplete'
      ? Promise.resolve([])
      : searchOpenCage(rawQuery, userPoint, Math.max(6, safeLimit)).catch((error) => {
          console.error('OpenCage fallback failed:', error.message);
          return [];
        }),
  ]);

  return toPayload([...stopMatches, ...poiMatches, ...geocodeMatches], rawQuery, safeLimit);
}

async function autocompletePlaces(params) {
  return searchPlaces({ ...params, mode: 'autocomplete', limit: params.limit || 10 });
}

module.exports = {
  searchPlaces,
  autocompletePlaces,
  normalizeText,
  expandedQueryTerms,
};
