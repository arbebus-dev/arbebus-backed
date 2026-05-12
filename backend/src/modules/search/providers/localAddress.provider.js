const { normalizeText } = require("../utils/normalizeText");
const { getCache, setCache } = require("../cache/searchCache");
const { toResult } = require("../utils/mapSearchResult");
const { getPool } = require("../../../db/pool");
const { searchGooglePlaces } = require("./googlePlaces.provider");
const { searchNominatim } = require("./nominatim.provider");

const DEFAULT_CENTER = {
  city: "Klaipėda",
  latitude: 55.7033,
  longitude: 21.1443,
};

const CITY_HINTS = [
  { keys: ["klaipeda", "klaipėda"], city: "Klaipėda", latitude: 55.7033, longitude: 21.1443 },
  { keys: ["kretinga"], city: "Kretinga", latitude: 55.8888, longitude: 21.2445 },
  { keys: ["palanga"], city: "Palanga", latitude: 55.9175, longitude: 21.0686 },
  { keys: ["gargzdai", "gargždai"], city: "Gargždai", latitude: 55.7093, longitude: 21.3949 },
  { keys: ["vilnius"], city: "Vilnius", latitude: 54.6872, longitude: 25.2797 },
  { keys: ["kaunas"], city: "Kaunas", latitude: 54.8985, longitude: 23.9036 },
  { keys: ["siauliai", "šiauliai"], city: "Šiauliai", latitude: 55.9349, longitude: 23.3137 },
  { keys: ["panevezys", "panevėžys"], city: "Panevėžys", latitude: 55.7348, longitude: 24.3575 },
];

let lastDbError = null;
let lastDbCount = null;
let lastDbHealthCheck = 0;

function extractHouseNumber(query) {
  const match = String(query || "").match(/\b(\d+[a-zA-Z]?)\b/);
  return match ? match[1].toUpperCase() : null;
}

function compactQuery(value) {
  return normalizeText(value).replace(/\./g, " ").replace(/\s+/g, " ").trim();
}

function normalizeSearchText(value) {
  return compactQuery(value)
    .replace(/\b(g|gatve|gatvė|pr|prospektas|pl|plentas|al|aleja|kelias)\b/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function parseCoordinate(input, keys) {
  for (const key of keys) {
    const value = Number(input?.[key]);
    if (Number.isFinite(value)) return value;
  }
  return null;
}

function validCoordinate(latitude, longitude) {
  return (
    Number.isFinite(latitude) &&
    Number.isFinite(longitude) &&
    latitude !== 0 &&
    longitude !== 0 &&
    Math.abs(latitude) <= 90 &&
    Math.abs(longitude) <= 180
  );
}

function normalizeInputLocation(options = {}) {
  const latitude = parseCoordinate(options, ["lat", "latitude"]);
  const longitude = parseCoordinate(options, ["lon", "lng", "longitude"]);
  if (!validCoordinate(latitude, longitude)) return null;
  return { latitude, longitude };
}

function detectCity(query, options = {}) {
  const nq = compactQuery(query);
  const explicit = CITY_HINTS.find((item) => item.keys.some((key) => nq.includes(compactQuery(key))));
  if (explicit) return explicit;

  const location = normalizeInputLocation(options);
  if (location) {
    return [...CITY_HINTS]
      .map((item) => ({ ...item, distanceMeters: distanceMeters(location, item) }))
      .sort((a, b) => a.distanceMeters - b.distanceMeters)[0];
  }

  return DEFAULT_CENTER;
}

function distanceMeters(a, b) {
  const lat1 = Number(a.latitude ?? a.lat);
  const lon1 = Number(a.longitude ?? a.lon ?? a.lng);
  const lat2 = Number(b.latitude ?? b.lat);
  const lon2 = Number(b.longitude ?? b.lon ?? b.lng);
  if (!validCoordinate(lat1, lon1) || !validCoordinate(lat2, lon2)) return Number.POSITIVE_INFINITY;

  const R = 6371000;
  const toRad = (value) => (value * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const p1 = toRad(lat1);
  const p2 = toRad(lat2);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(p1) * Math.cos(p2) * Math.sin(dLon / 2) ** 2;
  return Math.round(2 * R * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h)));
}

function buildTitle(row) {
  return row.name || [row.street, row.house_number].filter(Boolean).join(" ");
}

function buildSubtitle(row) {
  return [row.city, row.postcode].filter(Boolean).join(", ") || "Adresas";
}

function geocoderQuery(row, originalQuery) {
  const parts = [row.street, row.house_number, row.city || DEFAULT_CENTER.city, "Lietuva"].filter(Boolean);
  const query = parts.join(" ").replace(/\s+/g, " ").trim();
  if (query.length >= 6) return query;
  return `${originalQuery} ${DEFAULT_CENTER.city} Lietuva`.trim();
}

function readResultCoordinate(item) {
  const latitude = Number(item?.latitude ?? item?.lat ?? item?.coordinate?.latitude);
  const longitude = Number(item?.longitude ?? item?.lon ?? item?.lng ?? item?.coordinate?.longitude);
  if (!validCoordinate(latitude, longitude)) return null;
  return { latitude, longitude };
}

async function geocodeMissingCoordinate(row, originalQuery) {
  const title = geocoderQuery(row, originalQuery);
  const key = `address-geocode:v2:${compactQuery(title)}`;
  const cached = await getCache(key);
  if (cached && validCoordinate(Number(cached.latitude), Number(cached.longitude))) return cached;

  const providers = [
    () => searchGooglePlaces(title, { limit: 3 }),
    () => searchNominatim(title, { limit: 3 }),
  ];

  for (const provider of providers) {
    try {
      const results = await provider();
      const first = Array.isArray(results) ? results.map(readResultCoordinate).find(Boolean) : null;
      if (first) {
        await setCache(key, first, 86400 * 30);
        updateAddressCoordinate(row.id, first).catch(() => undefined);
        return first;
      }
    } catch {
      // Keep local address search resilient even if external geocoder fails.
    }
  }

  return null;
}

async function updateAddressCoordinate(id, coordinate) {
  if (!id || !validCoordinate(coordinate?.latitude, coordinate?.longitude)) return;
  await getPool().query(
    `UPDATE public.addresses
     SET lat = $2, lon = $3
     WHERE id = $1
       AND (lat IS NULL OR lon IS NULL OR lat = 0 OR lon = 0)`,
    [id, coordinate.latitude, coordinate.longitude],
  );
}

async function rowToAddressResult(row, query, options = {}) {
  let latitude = Number(row.lat);
  let longitude = Number(row.lon);
  let geocoded = false;

  if (!validCoordinate(latitude, longitude)) {
    const resolved = await geocodeMissingCoordinate(row, query);
    if (resolved) {
      latitude = resolved.latitude;
      longitude = resolved.longitude;
      geocoded = true;
    }
  }

  const targetCity = detectCity(query, options);
  const userLocation = normalizeInputLocation(options);
  const hasRealCoordinate = validCoordinate(latitude, longitude);
  const fallbackCoordinate = userLocation || targetCity || DEFAULT_CENTER;
  const finalLatitude = hasRealCoordinate ? latitude : fallbackCoordinate.latitude;
  const finalLongitude = hasRealCoordinate ? longitude : fallbackCoordinate.longitude;
  const exactHouse = extractHouseNumber(query);
  const userDistance = userLocation && hasRealCoordinate ? distanceMeters(userLocation, { latitude, longitude }) : null;
  const cityBoost = row.city && targetCity?.city && compactQuery(row.city).includes(compactQuery(targetCity.city)) ? 7000 : 0;

  return toResult({
    id: `address-${row.id}`,
    type: "address",
    title: buildTitle(row),
    name: buildTitle(row),
    subtitle: hasRealCoordinate
      ? buildSubtitle(row)
      : `${buildSubtitle(row)} · koordinatės tikslinamos`,
    latitude: finalLatitude,
    longitude: finalLongitude,
    coordinate: { latitude: finalLatitude, longitude: finalLongitude },
    source: geocoded ? "postgres_address_geocoded" : "postgres_address",
    category: "Adresas",
    priority: exactHouse ? 320 : 210,
    score:
      Number(row.rank_score || 0) +
      cityBoost +
      (hasRealCoordinate ? 3000 : -4000) +
      (userDistance != null ? Math.max(0, 5000 - Math.min(userDistance, 5000)) : 0),
    selectable: true,
    requiresHouseNumber: false,
    distanceMeters: userDistance ?? undefined,
    keywords: [row.name, row.street, row.house_number, row.city, row.postcode].filter(Boolean),
  });
}

async function searchPostgresAddresses(query, options = {}) {
  const q = String(query || "").trim();
  const nq = compactQuery(q);
  if (nq.length < 2) return [];

  const limit = Math.min(Math.max(Number(options.limit || 8), 1), 20);
  const house = extractHouseNumber(q);
  const pool = getPool();
  const targetCity = detectCity(q, options);
  const streetPartRaw = nq.replace(/\b\d+[a-z]?\b/gi, " ").replace(compactQuery(targetCity?.city || ""), " ").trim();
  const streetPart = normalizeSearchText(streetPartRaw || nq);

  let sql;
  let params;

  if (house) {
    sql = `
      SELECT
        id,
        name,
        street,
        house_number,
        city,
        postcode,
        lat,
        lon,
        (
          CASE WHEN lower(street) = lower($1) THEN 9000 ELSE 0 END +
          CASE WHEN lower(street) LIKE lower($1) || '%' THEN 5000 ELSE 0 END +
          CASE WHEN upper(house_number) = upper($2) THEN 9000 ELSE 0 END +
          CASE WHEN upper(house_number) LIKE upper($2) || '%' THEN 3500 ELSE 0 END +
          CASE WHEN COALESCE(city, '') ILIKE '%' || $3 || '%' THEN 7000 ELSE 0 END +
          CASE WHEN lat IS NOT NULL AND lon IS NOT NULL AND lat <> 0 AND lon <> 0 THEN 2500 ELSE 0 END
        ) AS rank_score
      FROM public.addresses
      WHERE
        lower(street) LIKE lower($1) || '%'
        AND upper(house_number) LIKE upper($2) || '%'
      ORDER BY rank_score DESC, city ASC, street ASC, house_number ASC
      LIMIT $4
    `;
    params = [streetPart || nq, house, targetCity?.city || DEFAULT_CENTER.city, limit];
  } else {
    sql = `
      SELECT
        id,
        name,
        street,
        house_number,
        city,
        postcode,
        lat,
        lon,
        (
          CASE WHEN lower(street) = lower($1) THEN 9000 ELSE 0 END +
          CASE WHEN lower(street) LIKE lower($1) || '%' THEN 5000 ELSE 0 END +
          CASE WHEN COALESCE(city, '') ILIKE '%' || $2 || '%' THEN 7000 ELSE 0 END +
          CASE WHEN lat IS NOT NULL AND lon IS NOT NULL AND lat <> 0 AND lon <> 0 THEN 2500 ELSE 0 END
        ) AS rank_score
      FROM public.addresses
      WHERE lower(street) LIKE lower($1) || '%'
      ORDER BY rank_score DESC, city ASC, street ASC, house_number ASC
      LIMIT $3
    `;
    params = [streetPart || nq, targetCity?.city || DEFAULT_CENTER.city, limit];
  }

  const result = await pool.query(sql, params);
  const mapped = await Promise.all(result.rows.map((row) => rowToAddressResult(row, q, options)));
  return mapped.filter(Boolean);
}

async function searchLocalAddresses(query, options = {}) {
  try {
    const dbResults = await searchPostgresAddresses(query, options);
    lastDbError = null;
    return dbResults;
  } catch (error) {
    lastDbError = error?.message || String(error);
    return [];
  }
}

async function refreshDbCount() {
  if (Date.now() - lastDbHealthCheck < 30000) return lastDbCount;
  lastDbHealthCheck = Date.now();

  try {
    const result = await getPool().query("SELECT COUNT(*)::int AS count FROM public.addresses");
    lastDbCount = Number(result.rows?.[0]?.count || 0);
    lastDbError = null;
  } catch (error) {
    lastDbError = error?.message || String(error);
  }

  return lastDbCount;
}

function localAddressHealth() {
  refreshDbCount().catch(() => undefined);
  return {
    postgresAddressProvider: true,
    postgresAddressCount: lastDbCount,
    postgresAddressError: lastDbError,
  };
}

module.exports = { searchLocalAddresses, localAddressHealth };
