const { normalizeText } = require("../utils/normalizeText");
const { getCache, setCache } = require("../cache/searchCache");
const { toResult } = require("../utils/mapSearchResult");
const { getPool } = require("../../../db/pool");

const DEFAULT_CENTER = {
  city: "Klaipėda",
  latitude: 55.7033,
  longitude: 21.1443,
  dbPatterns: ["%klaip%", "%klaipėd%", "%klaiped%"],
};

const CITY_HINTS = [
  { keys: ["klaipeda", "klaipėda", "klaipedos", "klaipėdos"], city: "Klaipėda", latitude: 55.7033, longitude: 21.1443, dbPatterns: ["%klaip%", "%klaipėd%", "%klaiped%"] },
  { keys: ["gargzdai", "gargždai"], city: "Gargždai", latitude: 55.7093, longitude: 21.3949, dbPatterns: ["%gargžd%", "%gargzd%"] },
  { keys: ["kretinga"], city: "Kretinga", latitude: 55.8888, longitude: 21.2445, dbPatterns: ["%kreting%"] },
  { keys: ["palanga"], city: "Palanga", latitude: 55.9175, longitude: 21.0686, dbPatterns: ["%palang%"] },
  { keys: ["neringa"], city: "Neringa", latitude: 55.3712, longitude: 21.0646, dbPatterns: ["%nering%"] },
  { keys: ["nida"], city: "Nida", latitude: 55.3039, longitude: 21.0058, dbPatterns: ["%nida%"] },
  { keys: ["vilnius"], city: "Vilnius", latitude: 54.6872, longitude: 25.2797, dbPatterns: ["%viln%"] },
  { keys: ["kaunas"], city: "Kaunas", latitude: 54.8985, longitude: 23.9036, dbPatterns: ["%kaun%"] },
  { keys: ["siauliai", "šiauliai"], city: "Šiauliai", latitude: 55.9349, longitude: 23.3137, dbPatterns: ["%šiaul%", "%siaul%"] },
  { keys: ["panevezys", "panevėžys"], city: "Panevėžys", latitude: 55.7348, longitude: 24.3575, dbPatterns: ["%panevėž%", "%panevez%"] },
];

const REGION_PATTERNS = [
  "%klaip%", "%klaipėd%", "%klaiped%", "%nering%", "%nida%", "%gargžd%", "%gargzd%",
  "%priekul%", "%drevern%", "%karkl%", "%sleng%", "%sendvar%", "%kretingal%", "%dovil%",
  "%viln%", "%kaun%", "%palang%", "%kreting%",
];

let lastDbError = null;
let lastDbCount = null;
let lastRcCount = null;
let lastDbHealthCheck = 0;

function compactQuery(value) {
  return normalizeText(value).replace(/\./g, " ").replace(/\s+/g, " ").trim();
}

function extractHouseNumber(query) {
  const match = String(query || "").match(/\b(\d+[a-zA-Z]?)\b/);
  return match ? match[1].toUpperCase() : null;
}

function normalizeSearchText(value) {
  return compactQuery(value)
    .replace(/\b(g|g\.|gatve|gatvė|pr|pr\.|prospektas|pl|pl\.|plentas|al|al\.|aleja|kelias)\b/gi, " ")
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
  return Number.isFinite(latitude) && Number.isFinite(longitude) && latitude !== 0 && longitude !== 0 && Math.abs(latitude) <= 90 && Math.abs(longitude) <= 180;
}

function normalizeInputLocation(options = {}) {
  const latitude = parseCoordinate(options, ["lat", "latitude"]);
  const longitude = parseCoordinate(options, ["lon", "lng", "longitude"]);
  if (!validCoordinate(latitude, longitude)) return null;
  return { latitude, longitude };
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

function detectCity(query, options = {}) {
  const nq = compactQuery(query);
  const explicit = CITY_HINTS.find((item) => item.keys.some((key) => nq.includes(compactQuery(key))));
  if (explicit) return { ...explicit, reason: "query" };

  const location = normalizeInputLocation(options);
  if (location) {
    const nearest = [...CITY_HINTS]
      .map((item) => ({ ...item, distanceMeters: distanceMeters(location, item) }))
      .sort((a, b) => a.distanceMeters - b.distanceMeters)[0];
    return { ...(nearest || DEFAULT_CENTER), reason: "gps" };
  }

  return { ...DEFAULT_CENTER, reason: "default" };
}

function cityPatterns(cityHint) {
  const source = cityHint || DEFAULT_CENTER;
  const patterns = Array.isArray(source.dbPatterns) && source.dbPatterns.length ? source.dbPatterns : [source.city];
  return patterns.map((item) => String(item).includes("%") ? String(item).toLowerCase() : `%${String(item).toLowerCase()}%`).filter(Boolean);
}

function cityMatches(rowCity, targetCity) {
  if (!rowCity || !targetCity) return false;
  const cityText = String(rowCity).toLowerCase();
  return cityPatterns(targetCity).some((pattern) => cityText.includes(pattern.replace(/%/g, "")));
}

function removeCityWordsFromStreet(query) {
  let value = compactQuery(query);
  for (const city of CITY_HINTS) {
    for (const key of city.keys) {
      value = value.replace(new RegExp(`\\b${compactQuery(key)}\\b`, "gi"), " ");
    }
  }
  return value.replace(/\s+/g, " ").trim();
}

function buildTitle(row) {
  const street = String(row.street || "").trim();
  const house = String(row.house_number || "").trim();
  if (house) return row.name || [street, house].filter(Boolean).join(" ");
  return street || row.name || "Adresas";
}

function buildSubtitle(row) {
  return [row.city, row.postcode].filter(Boolean).join(", ") || "Adresas";
}

function rowToAddressResult(row, query, options = {}) {
  const targetCity = detectCity(query, options);
  const userLocation = normalizeInputLocation(options);
  const latitude = Number(row.lat);
  const longitude = Number(row.lon);
  const hasRealCoordinate = validCoordinate(latitude, longitude);
  const fallbackCoordinate = userLocation || targetCity || DEFAULT_CENTER;
  const finalLatitude = hasRealCoordinate ? latitude : fallbackCoordinate.latitude;
  const finalLongitude = hasRealCoordinate ? longitude : fallbackCoordinate.longitude;
  const userDistance = userLocation && hasRealCoordinate ? distanceMeters(userLocation, { latitude, longitude }) : null;
  const rowMatchesTargetCity = cityMatches(row.city, targetCity);
  const exactHouse = extractHouseNumber(query);
  const hasHouse = Boolean(String(row.house_number || "").trim());

  let score = Number(row.rank_score || 0);
  if (rowMatchesTargetCity) score += 300000;
  if (targetCity?.reason === "query" && rowMatchesTargetCity) score += 150000;
  if (!rowMatchesTargetCity) score -= 200000;
  if (hasHouse) score += 25000;
  if (hasRealCoordinate) score += 6000;
  if (userDistance != null) score += Math.max(0, 50000 - Math.min(userDistance, 50000));

  return toResult({
    id: `address-${row.id}`,
    placeId: `address-${row.id}`,
    type: "address",
    title: buildTitle(row),
    name: buildTitle(row),
    subtitle: hasHouse ? buildSubtitle(row) : `${buildSubtitle(row)} · pasirinkite namo numerį`,
    latitude: finalLatitude,
    longitude: finalLongitude,
    coordinate: { latitude: finalLatitude, longitude: finalLongitude },
    source: row.source || "postgres_address",
    category: hasHouse ? "Adresas" : "Gatvė",
    priority: exactHouse ? 360 : 260,
    score,
    selectable: hasHouse,
    requiresHouseNumber: !hasHouse,
    needsGeocoding: !hasRealCoordinate,
    distanceMeters: userDistance ?? undefined,
    keywords: [row.name, row.street, row.house_number, row.city, row.postcode].filter(Boolean),
  });
}

async function queryTable({ table, source, street, house, targetCity, limit, preferHouseRows }) {
  const pool = getPool();
  const patterns = cityPatterns(targetCity);
  const region = targetCity?.reason === "query" ? patterns : REGION_PATTERNS;
  const tableName = table === "rc" ? "public.addresses_rc_import" : "public.addresses";
  const sourceName = source || (table === "rc" ? "rc_address" : "postgres_address");

  if (house) {
    const sql = `
      SELECT id, name, street::text AS street, house_number::text AS house_number, city::text AS city, postcode::text AS postcode, lat, lon, '${sourceName}' AS source,
        (
          CASE WHEN lower(street::text) = lower($1) THEN 160000 ELSE 0 END +
          CASE WHEN lower(street::text) LIKE lower($1) || '%' THEN 120000 ELSE 0 END +
          CASE WHEN upper(COALESCE(house_number::text, '')) = upper($2) THEN 160000 ELSE 0 END +
          CASE WHEN upper(COALESCE(house_number::text, '')) LIKE upper($2) || '%' THEN 70000 ELSE 0 END +
          CASE WHEN lower(COALESCE(city::text, '')) LIKE ANY($3::text[]) THEN 120000 ELSE 0 END +
          CASE WHEN lat IS NOT NULL AND lon IS NOT NULL AND lat <> 0 AND lon <> 0 THEN 15000 ELSE 0 END
        ) AS rank_score
      FROM ${tableName}
      WHERE lower(street::text) LIKE lower($1) || '%'
        AND upper(COALESCE(house_number::text, '')) LIKE upper($2) || '%'
        AND lower(COALESCE(city::text, '')) LIKE ANY($4::text[])
      ORDER BY rank_score DESC, city::text ASC, street::text ASC, length(house_number::text), house_number::text ASC
      LIMIT $5
    `;
    const result = await pool.query(sql, [street, house, patterns, region, Math.min(Math.max(limit, 8), 30)]);
    return result.rows;
  }

  if (preferHouseRows) {
    const sql = `
      SELECT id, name, street::text AS street, house_number::text AS house_number, city::text AS city, postcode::text AS postcode, lat, lon, '${sourceName}' AS source,
        (
          CASE WHEN lower(street::text) = lower($1) THEN 130000 ELSE 0 END +
          CASE WHEN lower(street::text) LIKE lower($1) || '%' THEN 100000 ELSE 0 END +
          CASE WHEN lower(COALESCE(city::text, '')) LIKE ANY($2::text[]) THEN 100000 ELSE 0 END +
          CASE WHEN COALESCE(house_number::text, '') <> '' THEN 50000 ELSE 0 END +
          CASE WHEN lat IS NOT NULL AND lon IS NOT NULL AND lat <> 0 AND lon <> 0 THEN 15000 ELSE 0 END
        ) AS rank_score
      FROM ${tableName}
      WHERE lower(street::text) LIKE lower($1) || '%'
        AND lower(COALESCE(city::text, '')) LIKE ANY($3::text[])
        AND COALESCE(house_number::text, '') <> ''
      ORDER BY rank_score DESC, city::text ASC, street::text ASC, length(house_number::text), house_number::text ASC
      LIMIT $4
    `;
    const result = await pool.query(sql, [street, patterns, region, Math.min(Math.max(limit, 8), 20)]);
    return result.rows;
  }

  const sql = `
    WITH ranked AS (
      SELECT DISTINCT ON (lower(street::text), lower(city::text))
        id, name, street::text AS street, NULL::text AS house_number, city::text AS city, postcode::text AS postcode, lat, lon, '${sourceName}' AS source,
        (
          CASE WHEN lower(street::text) = lower($1) THEN 130000 ELSE 0 END +
          CASE WHEN lower(street::text) LIKE lower($1) || '%' THEN 100000 ELSE 0 END +
          CASE WHEN lower(COALESCE(city::text, '')) LIKE ANY($2::text[]) THEN 100000 ELSE 0 END +
          CASE WHEN lat IS NOT NULL AND lon IS NOT NULL AND lat <> 0 AND lon <> 0 THEN 10000 ELSE 0 END
        ) AS rank_score
      FROM ${tableName}
      WHERE lower(street::text) LIKE lower($1) || '%'
        AND lower(COALESCE(city::text, '')) LIKE ANY($3::text[])
      ORDER BY lower(street::text), lower(city::text), rank_score DESC, id ASC
    )
    SELECT * FROM ranked
    ORDER BY rank_score DESC, city ASC, street ASC
    LIMIT $4
  `;
  const result = await pool.query(sql, [street, patterns, region, Math.min(Math.max(limit, 8), 20)]);
  return result.rows;
}

function sortAddressResults(items) {
  return [...items].sort((a, b) => {
    const aScore = Number(a.score || 0);
    const bScore = Number(b.score || 0);
    if (bScore !== aScore) return bScore - aScore;
    const aDistance = Number.isFinite(Number(a.distanceMeters)) ? Number(a.distanceMeters) : Number.MAX_SAFE_INTEGER;
    const bDistance = Number.isFinite(Number(b.distanceMeters)) ? Number(b.distanceMeters) : Number.MAX_SAFE_INTEGER;
    if (aDistance !== bDistance) return aDistance - bDistance;
    return String(a.title || "").localeCompare(String(b.title || ""), "lt");
  });
}

function dedupeAddressResults(items) {
  const seen = new Set();
  const out = [];
  for (const item of items) {
    const key = `${String(item.title || "").toLowerCase()}|${String(item.subtitle || "").toLowerCase()}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(item);
  }
  return out;
}

async function searchPostgresAddresses(query, options = {}) {
  const q = String(query || "").trim();
  const nq = compactQuery(q);
  if (nq.length < 2) return [];

  const limit = Math.min(Math.max(Number(options.limit || 8), 1), 30);
  const house = extractHouseNumber(q);
  const targetCity = detectCity(q, options);
  const qWithoutCity = removeCityWordsFromStreet(q);
  const streetPartRaw = qWithoutCity.replace(/\b\d+[a-z]?\b/gi, " ").trim();
  const streetPart = normalizeSearchText(streetPartRaw || nq);
  if (!streetPart || streetPart.length < 2) return [];

  const preferHouseRows = Boolean(options.autocomplete) && !house && streetPart.length >= 4;
  let rows = await queryTable({ table: "public", source: "postgres_address", street: streetPart, house, targetCity, limit, preferHouseRows });

  if (!rows.length && streetPart.length >= 3) {
    try {
      rows = await queryTable({ table: "rc", source: "rc_address", street: streetPart, house, targetCity, limit, preferHouseRows });
    } catch (error) {
      lastDbError = error?.message || String(error);
    }
  }

  return dedupeAddressResults(sortAddressResults(rows.map((row) => rowToAddressResult(row, q, options)))).slice(0, limit);
}

async function searchLocalAddresses(query, options = {}) {
  try {
    const cacheKey = `local-address-v100:${compactQuery(query)}:${Number(options.limit || 8)}:${options.autocomplete ? "auto" : "search"}:${options.lat || ""}:${options.lon || ""}`;
    const cached = await getCache(cacheKey);
    if (cached) return cached;
    const dbResults = await searchPostgresAddresses(query, options);
    await setCache(cacheKey, dbResults, Number(process.env.SEARCH_CACHE_TTL_SECONDS || 86400));
    lastDbError = null;
    return dbResults;
  } catch (error) {
    lastDbError = error?.message || String(error);
    return [];
  }
}

async function getLocalAddressDetails(placeId, options = {}) {
  const rawId = String(placeId || "").replace(/^address-/, "").trim();
  if (!rawId) return null;
  try {
    let result = await getPool().query(
      `SELECT id, name, street::text AS street, house_number::text AS house_number, city::text AS city, postcode::text AS postcode, lat, lon, 'postgres_address' AS source
       FROM public.addresses
       WHERE id::text = $1
       LIMIT 1`,
      [rawId],
    );
    if (!result.rows?.[0]) {
      result = await getPool().query(
        `SELECT id, name, street::text AS street, house_number::text AS house_number, city::text AS city, postcode::text AS postcode, lat, lon, 'rc_address' AS source
         FROM public.addresses_rc_import
         WHERE id::text = $1
         LIMIT 1`,
        [rawId],
      );
    }
    const row = result.rows?.[0];
    if (!row) return null;
    lastDbError = null;
    return rowToAddressResult(row, buildTitle(row), options);
  } catch (error) {
    lastDbError = error?.message || String(error);
    return null;
  }
}

async function refreshDbCount() {
  if (Date.now() - lastDbHealthCheck < 30000) return lastDbCount;
  lastDbHealthCheck = Date.now();
  try {
    const result = await getPool().query("SELECT COUNT(*)::int AS count FROM public.addresses");
    lastDbCount = Number(result.rows?.[0]?.count || 0);
    try {
      const rc = await getPool().query("SELECT COUNT(*)::int AS count FROM public.addresses_rc_import");
      lastRcCount = Number(rc.rows?.[0]?.count || 0);
    } catch {
      lastRcCount = null;
    }
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
    rcAddressProvider: true,
    rcAddressCount: lastRcCount,
    rcAddressError: null,
  };
}

module.exports = { searchLocalAddresses, getLocalAddressDetails, localAddressHealth };
