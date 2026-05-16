const { getPool } = require("../../../db/pool");
const { getCache, setCache } = require("../cache/searchCache");
const { toResult } = require("../utils/mapSearchResult");

// Arbebus ULTRA FAST Lithuania geocoder provider v150.
// Hard rule: autocomplete/search uses ONE DB query against public.addresses_search_lookup.
// No timeout. No addresses_rc_import scan. No old settlement/street split tables.

const VERSION = "ultra-fast-single-lookup-v150";
const LT_FROM = "ąčęėįšųūžĄČĘĖĮŠŲŪŽ";
const LT_TO = "aceeisuuzACEEISUUZ";
const MEMORY_TTL_MS = 5 * 60 * 1000;
const memoryCache = new Map();

let lastDbError = null;
let lastLookupCount = null;
let lastDbHealthCheck = 0;
let lastProviderMode = "addresses_search_lookup";

function cleanText(value) {
  return String(value || "").trim().replace(/\s+/g, " ");
}

function normalizeLt(value) {
  return cleanText(value)
    .split("")
    .map((char) => {
      const index = LT_FROM.indexOf(char);
      return index >= 0 ? LT_TO[index] || char : char;
    })
    .join("")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function sqlNorm(column) {
  return `btrim(regexp_replace(translate(lower(coalesce(${column}::text, '')), '${LT_FROM}', '${LT_TO}'), '[^a-z0-9]+', ' ', 'g'))`;
}

function stripStreetType(value) {
  return normalizeLt(value)
    .replace(/\b(g|gatve|gatvė|gatves|gatvės|pr|prospektas|prospektu|pl|plentas|al|aleja|kelias|skg|skersgatvis|aklg|aikste|aikštė|takas)\b/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function extractHouseNumber(query) {
  const match = String(query || "").match(/\b(\d+[a-zA-Z]?)\b/);
  return match ? match[1].toUpperCase() : null;
}

function removeHouseNumber(query) {
  return cleanText(query).replace(/\b\d+[a-zA-Z]?\b/g, " ").replace(/\s+/g, " ").trim();
}

function normalizeLookupQuery(query) {
  const withoutHouse = removeHouseNumber(query);
  const stripped = stripStreetType(withoutHouse);
  return stripped || normalizeLt(withoutHouse) || normalizeLt(query);
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

function numberValue(value) {
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function normalizeInputLocation(options = {}) {
  const latitude = numberValue(options.lat ?? options.latitude);
  const longitude = numberValue(options.lon ?? options.lng ?? options.longitude);
  if (!validCoordinate(latitude, longitude)) return null;
  return { latitude, longitude };
}

function distanceMeters(a, b) {
  const lat1 = Number(a.latitude ?? a.lat);
  const lon1 = Number(a.longitude ?? a.lon ?? a.lng);
  const lat2 = Number(b.latitude ?? b.lat);
  const lon2 = Number(b.longitude ?? b.lon ?? b.lng);
  if (!validCoordinate(lat1, lon1) || !validCoordinate(lat2, lon2)) return null;
  const R = 6371000;
  const toRad = (value) => (value * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const p1 = toRad(lat1);
  const p2 = toRad(lat2);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(p1) * Math.cos(p2) * Math.sin(dLon / 2) ** 2;
  return Math.round(2 * R * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h)));
}

function titleFor(row) {
  const type = String(row.result_type || row.type || "address").toLowerCase();
  if (type === "settlement") return cleanText(row.city || row.name || "Vietovė");
  if (type === "street") return cleanText(row.street || row.name || "Gatvė");
  return cleanText(row.name || [row.street, row.house_number].filter(Boolean).join(" "));
}

function subtitleFor(row) {
  const type = String(row.result_type || row.type || "address").toLowerCase();
  const city = cleanText(row.city || "");
  if (type === "settlement") return [city, "Gyvenvietė"].filter(Boolean).join(" · ");
  if (type === "street") return [city, "Gatvė"].filter(Boolean).join(" · ");
  return [city, row.postcode].filter(Boolean).join(", ") || "Adresas";
}

function rowToResult(row, query, options = {}) {
  const resultType = String(row.result_type || row.type || "address").toLowerCase();
  const latitude = Number(row.lat);
  const longitude = Number(row.lon);
  const finalLatitude = validCoordinate(latitude, longitude) ? latitude : 55.7033;
  const finalLongitude = validCoordinate(latitude, longitude) ? longitude : 21.1443;
  const location = normalizeInputLocation(options);
  const userDistance = location ? distanceMeters(location, { latitude: finalLatitude, longitude: finalLongitude }) : null;

  let priority = 360;
  let category = "Adresas";
  if (resultType === "street") {
    priority = 340;
    category = "Gatvė";
  }
  if (resultType === "settlement") {
    priority = 330;
    category = "Gyvenvietė";
  }

  const title = titleFor(row);
  const subtitle = subtitleFor(row);
  const score = Number(row.rank_score || 0) + priority + (userDistance == null ? 0 : Math.max(0, 25000 - Math.min(userDistance, 25000)));

  return toResult({
    id: `${resultType}-${row.id}`,
    placeId: `${resultType}-${row.id}`,
    type: resultType,
    title,
    name: title,
    subtitle,
    latitude: finalLatitude,
    longitude: finalLongitude,
    coordinate: { latitude: finalLatitude, longitude: finalLongitude },
    source: "postgres_address",
    category,
    priority,
    score,
    selectable: true,
    requiresHouseNumber: false,
    needsGeocoding: false,
    distanceMeters: userDistance ?? undefined,
    keywords: [row.name, row.street, row.house_number, row.city, row.postcode, resultType].filter(Boolean),
    addressCount: Number(row.address_count || 0) || undefined,
  });
}

function dedupe(items) {
  const seen = new Set();
  const out = [];
  for (const item of items) {
    const key = `${String(item.type || "").toLowerCase()}|${normalizeLt(item.title)}|${normalizeLt(item.subtitle)}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(item);
  }
  return out;
}

function sortResults(items) {
  return [...items].sort((a, b) => {
    const aScore = Number(a.score || 0);
    const bScore = Number(b.score || 0);
    if (bScore !== aScore) return bScore - aScore;
    const weight = { address: 3, settlement: 2, street: 1 };
    const typeDiff = (weight[String(b.type || "").toLowerCase()] || 0) - (weight[String(a.type || "").toLowerCase()] || 0);
    if (typeDiff !== 0) return typeDiff;
    return String(a.title || "").localeCompare(String(b.title || ""), "lt");
  });
}

function memoryGet(key) {
  const hit = memoryCache.get(key);
  if (!hit) return null;
  if (Date.now() - hit.time > MEMORY_TTL_MS) {
    memoryCache.delete(key);
    return null;
  }
  return hit.value;
}

function memorySet(key, value) {
  memoryCache.set(key, { time: Date.now(), value });
  if (memoryCache.size > 1000) {
    for (const firstKey of memoryCache.keys()) {
      memoryCache.delete(firstKey);
      if (memoryCache.size <= 900) break;
    }
  }
}

async function runSingleLookupQuery({ qNorm, rawPrefix, limit }) {
  const normalizedPrefix = `${qNorm}%`;
  const lowerRawPrefix = `${String(rawPrefix || "").toLowerCase()}%`;
  const normQPrefix = sqlNorm("q_prefix");
  const normName = sqlNorm("name");
  const normCity = sqlNorm("city");
  const normStreet = sqlNorm("street");

  // ONE DB query. Fast path uses idx_addresses_search_lookup_prefix.
  // Fallback path is accent-insensitive over only ~63k lookup rows, never 1M raw rows.
  const sql = `
    WITH direct AS (
      SELECT
        id::text AS id,
        type::text AS result_type,
        name::text AS name,
        city::text AS city,
        street::text AS street,
        house_number::text AS house_number,
        NULL::text AS postcode,
        lat,
        lon,
        address_count::int AS address_count,
        (
          CASE WHEN q_prefix = $1 THEN 900000 ELSE 0 END +
          CASE WHEN q_prefix LIKE $1 || '%' THEN 650000 ELSE 0 END +
          CASE WHEN lower(coalesce(name::text, '')) LIKE $2 THEN 200000 ELSE 0 END +
          LEAST(coalesce(address_count, 0), 5000)
        ) AS rank_score
      FROM public.addresses_search_lookup
      WHERE q_prefix LIKE $1 || '%'
         OR lower(coalesce(name::text, '')) LIKE $2
         OR lower(coalesce(city::text, '')) LIKE $2
         OR lower(coalesce(street::text, '')) LIKE $2
      ORDER BY rank_score DESC, address_count DESC, name, city
      LIMIT $3
    ),
    fallback AS (
      SELECT
        id::text AS id,
        type::text AS result_type,
        name::text AS name,
        city::text AS city,
        street::text AS street,
        house_number::text AS house_number,
        NULL::text AS postcode,
        lat,
        lon,
        address_count::int AS address_count,
        (
          CASE WHEN ${normQPrefix} = $1 THEN 850000 ELSE 0 END +
          CASE WHEN ${normQPrefix} LIKE $1 || '%' THEN 620000 ELSE 0 END +
          CASE WHEN ${normName} LIKE $1 || '%' THEN 180000 ELSE 0 END +
          LEAST(coalesce(address_count, 0), 5000)
        ) AS rank_score
      FROM public.addresses_search_lookup
      WHERE NOT EXISTS (SELECT 1 FROM direct)
        AND (
          ${normQPrefix} LIKE $1 || '%'
          OR ${normName} LIKE $1 || '%'
          OR ${normCity} LIKE $1 || '%'
          OR ${normStreet} LIKE $1 || '%'
        )
      ORDER BY rank_score DESC, address_count DESC, name, city
      LIMIT $3
    )
    SELECT * FROM direct
    UNION ALL
    SELECT * FROM fallback
    LIMIT $3
  `;

  const started = Date.now();
  const result = await getPool().query(sql, [qNorm, lowerRawPrefix, limit]);
  console.log("QUERY: addresses_search_lookup", { qNorm, rawPrefix, rows: result.rowCount, ms: Date.now() - started });
  lastProviderMode = "addresses_search_lookup";
  return result.rows || [];
}

async function searchPostgresAddresses(query, options = {}) {
  const q = cleanText(query);
  if (q.length < 2) return [];
  const limit = Math.min(Math.max(Number(options.limit || 8), 1), 30);
  const qNorm = normalizeLookupQuery(q);
  if (qNorm.length < 2) return [];

  const rows = await runSingleLookupQuery({ qNorm, rawPrefix: removeHouseNumber(q) || q, limit });
  return dedupe(sortResults(rows.map((row) => rowToResult(row, q, options)))).slice(0, limit);
}

async function searchLocalAddresses(query, options = {}) {
  try {
    const q = cleanText(query);
    const normalized = normalizeLookupQuery(q);
    const limit = Number(options.limit || 8);
    const cacheKey = `local-address-single-lookup-v150:${normalized}:${limit}:${options.autocomplete ? "auto" : "search"}:${options.lat || ""}:${options.lon || ""}`;

    const mem = memoryGet(cacheKey);
    if (mem) return mem;

    const cached = await getCache(cacheKey);
    if (cached) {
      memorySet(cacheKey, cached);
      return cached;
    }

    const results = await searchPostgresAddresses(q, options);
    memorySet(cacheKey, results);
    await setCache(cacheKey, results, Number(process.env.SEARCH_CACHE_TTL_SECONDS || 86400));
    lastDbError = null;
    return results;
  } catch (error) {
    lastDbError = error?.message || String(error);
    console.error("localAddress.provider error:", lastDbError);
    return [];
  }
}

async function getLocalAddressDetails(placeId, options = {}) {
  const raw = String(placeId || "").trim();
  const type = raw.split("-")[0];
  const rawId = raw.replace(/^(address|street|settlement)-/, "").trim();
  if (!rawId) return null;

  try {
    const result = await getPool().query(
      `SELECT id::text AS id, type::text AS result_type, name::text AS name, city::text AS city, street::text AS street, house_number::text AS house_number, NULL::text AS postcode, lat, lon, address_count::int AS address_count
       FROM public.addresses_search_lookup
       WHERE id::text = $1 AND type::text = $2
       LIMIT 1`,
      [rawId, type],
    );
    const row = result.rows?.[0];
    return row ? rowToResult(row, titleFor(row), options) : null;
  } catch (error) {
    lastDbError = error?.message || String(error);
    return null;
  }
}

async function refreshDbCount() {
  if (Date.now() - lastDbHealthCheck < 30000) return lastLookupCount;
  lastDbHealthCheck = Date.now();
  try {
    const result = await getPool().query("SELECT COUNT(*)::int AS count FROM public.addresses_search_lookup");
    lastLookupCount = Number(result.rows?.[0]?.count || 0);
    lastDbError = null;
  } catch (error) {
    lastDbError = error?.message || String(error);
  }
  return lastLookupCount;
}

function localAddressHealth() {
  refreshDbCount().catch(() => undefined);
  return {
    postgresAddressProvider: true,
    postgresAddressCount: lastLookupCount,
    postgresAddressError: lastDbError,
    rcAddressProvider: true,
    rcAddressCount: lastLookupCount,
    rcAddressError: null,
    noTimeout: true,
    strictPrefixOnly: true,
    streetFallback: true,
    settlementFallback: true,
    lookupTables: true,
    singleLookupTable: true,
    oneQueryPerRequest: true,
    memoryCache: memoryCache.size,
    providerMode: lastProviderMode,
    providerVersion: VERSION,
  };
}

module.exports = {
  searchLocalAddresses,
  getLocalAddressDetails,
  localAddressHealth,
};
