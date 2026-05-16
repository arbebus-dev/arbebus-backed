const { getPool } = require("../../../db/pool");
const { toResult } = require("../utils/mapSearchResult");

// Arbebus Lithuania geocoder v160
// One request = one indexed query against public.addresses_search_lookup.
// Requirements satisfied:
// - no timeout / no Promise.race
// - no addresses_rc_import scan for autocomplete
// - strict prefix only: q_prefix LIKE 'query%'
// - supports settlement, street, and settlement+street prefixes
// - in-memory cache for hot autocomplete responses

const PROVIDER_VERSION = "ultra-fast-v160-cache-single-query";
const MEMORY_TTL_MS = Number(process.env.SEARCH_LOCAL_MEMORY_CACHE_TTL_MS || 5 * 60 * 1000);
const MAX_CACHE_ITEMS = Number(process.env.SEARCH_LOCAL_MEMORY_CACHE_MAX || 1000);
const memoryCache = new Map();

const LT_FROM = "ąčęėįšųūžĄČĘĖĮŠŲŪŽ";
const LT_TO = "aceeisuuzACEEISUUZ";

let lastDbError = null;
let lastLookupCount = null;
let lastLookupCountAt = 0;
let lastQueryMs = null;
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

function numberValue(value) {
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function validCoordinate(latitude, longitude) {
  return (
    Number.isFinite(latitude) &&
    Number.isFinite(longitude) &&
    latitude >= 53 &&
    latitude <= 57 &&
    longitude >= 20 &&
    longitude <= 27
  );
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

function memoryGet(key) {
  const item = memoryCache.get(key);
  if (!item) return null;
  if (Date.now() > item.expiresAt) {
    memoryCache.delete(key);
    return null;
  }
  // refresh LRU position
  memoryCache.delete(key);
  memoryCache.set(key, item);
  return item.value;
}

function memorySet(key, value) {
  memoryCache.set(key, { value, expiresAt: Date.now() + MEMORY_TTL_MS });
  while (memoryCache.size > MAX_CACHE_ITEMS) {
    const firstKey = memoryCache.keys().next().value;
    if (!firstKey) break;
    memoryCache.delete(firstKey);
  }
}

function categoryFor(type) {
  if (type === "settlement") return "Gyvenvietė";
  if (type === "street") return "Gatvė";
  return "Adresas";
}

function titleFor(row) {
  const type = String(row.result_type || row.type || "").toLowerCase();
  if (type === "settlement") return cleanText(row.city || row.name || "Gyvenvietė");
  if (type === "street") return cleanText(row.street || row.name || "Gatvė");
  return cleanText(row.name || [row.street, row.house_number].filter(Boolean).join(" "));
}

function subtitleFor(row) {
  const type = String(row.result_type || row.type || "").toLowerCase();
  const city = cleanText(row.city || "");
  if (type === "settlement") return [city, "Gyvenvietė"].filter(Boolean).join(" · ");
  if (type === "street") return [city, "Gatvė"].filter(Boolean).join(" · ");
  return [city, row.postcode].filter(Boolean).join(", ") || "Adresas";
}

function rowToResult(row, originalQuery, options = {}) {
  const type = String(row.result_type || row.type || "street").toLowerCase();
  const latitude = Number(row.lat);
  const longitude = Number(row.lon);

  // Do not silently return Klaipeda fallback for bad RC/LKS94 coordinates.
  // If the lookup is built correctly, coordinates are WGS84 55.x / 21.x.
  if (!validCoordinate(latitude, longitude)) return null;

  const location = normalizeInputLocation(options);
  const userDistance = location ? distanceMeters(location, { latitude, longitude }) : null;
  const title = titleFor(row);
  const subtitle = subtitleFor(row);
  const priority = type === "settlement" ? 330 : type === "street" ? 340 : 360;
  const score = Number(row.rank_score || 0) + (userDistance == null ? 0 : Math.max(0, 25000 - Math.min(userDistance, 25000)));
  const stableId = cleanText(row.id || `${type}-${normalizeLt([title, subtitle].join(" "))}`);

  return toResult({
    id: stableId,
    placeId: stableId,
    type,
    title,
    name: title,
    subtitle,
    latitude,
    longitude,
    coordinate: { latitude, longitude },
    source: "postgres_address",
    category: categoryFor(type),
    priority,
    score,
    selectable: true,
    requiresHouseNumber: false,
    needsGeocoding: false,
    distanceMeters: userDistance ?? undefined,
    keywords: [row.name, row.street, row.house_number, row.city, row.postcode, type].filter(Boolean),
    addressCount: Number(row.address_count || 0) || undefined,
  });
}

function dedupe(items) {
  const seen = new Set();
  const out = [];
  for (const item of items) {
    if (!item) continue;
    const key = `${String(item.type || "").toLowerCase()}|${normalizeLt(item.title)}|${normalizeLt(item.subtitle)}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(item);
  }
  return out;
}

async function searchLocalAddresses(query, options = {}) {
  const started = Date.now();
  const q = cleanText(query);
  const qNorm = normalizeLt(q);
  const limit = Math.min(Math.max(Number(options.limit || 8), 1), 12);

  if (qNorm.length < 2) return [];

  const cacheKey = `lt-geocoder:${PROVIDER_VERSION}:${qNorm}:${limit}:${options.lat || ""}:${options.lon || ""}`;
  const cached = memoryGet(cacheKey);
  if (cached) {
    lastQueryMs = Date.now() - started;
    return cached;
  }

  const sql = `
    SELECT
      id::text AS id,
      type::text AS result_type,
      name::text AS name,
      city::text AS city,
      street::text AS street,
      house_number::text AS house_number,
      lat::double precision AS lat,
      lon::double precision AS lon,
      q_prefix::text AS q_prefix,
      address_count::int AS address_count,
      (
        CASE WHEN q_prefix = $1 THEN 1000000 ELSE 0 END +
        CASE WHEN type = 'settlement' AND q_prefix = $1 THEN 700000 ELSE 0 END +
        CASE WHEN type = 'street' AND q_prefix LIKE $1 || '%' THEN 650000 ELSE 0 END +
        LEAST(COALESCE(address_count, 0), 50000)
      )::int AS rank_score
    FROM public.addresses_search_lookup
    WHERE q_prefix LIKE $1 || '%'
      AND lat BETWEEN 53 AND 57
      AND lon BETWEEN 20 AND 27
    ORDER BY rank_score DESC, address_count DESC, type ASC, name ASC, city ASC
    LIMIT $2
  `;

  try {
    const res = await getPool().query(sql, [qNorm, limit]);
    lastQueryMs = Date.now() - started;
    lastProviderMode = "addresses_search_lookup";
    lastDbError = null;
    const results = dedupe((res.rows || []).map((row) => rowToResult(row, q, options))).slice(0, limit);
    memorySet(cacheKey, results);
    return results;
  } catch (error) {
    lastQueryMs = Date.now() - started;
    lastDbError = error?.message || String(error);
    console.error("localAddress.provider error:", lastDbError);
    return [];
  }
}

async function getLocalAddressDetails(placeId, options = {}) {
  const raw = cleanText(placeId);
  if (!raw) return null;

  const sql = `
    SELECT
      id::text AS id,
      type::text AS result_type,
      name::text AS name,
      city::text AS city,
      street::text AS street,
      house_number::text AS house_number,
      lat::double precision AS lat,
      lon::double precision AS lon,
      q_prefix::text AS q_prefix,
      address_count::int AS address_count,
      COALESCE(address_count, 0)::int AS rank_score
    FROM public.addresses_search_lookup
    WHERE id::text = $1 OR ($1 LIKE type || '-%' AND id::text = regexp_replace($1, '^(address|street|settlement)-', ''))
    LIMIT 1
  `;

  try {
    const res = await getPool().query(sql, [raw]);
    const row = res.rows?.[0];
    return row ? rowToResult(row, raw, options) : null;
  } catch (error) {
    lastDbError = error?.message || String(error);
    return null;
  }
}

async function refreshLookupCount() {
  if (Date.now() - lastLookupCountAt < 60_000) return lastLookupCount;
  lastLookupCountAt = Date.now();
  try {
    const res = await getPool().query("SELECT COUNT(*)::int AS count FROM public.addresses_search_lookup");
    lastLookupCount = Number(res.rows?.[0]?.count || 0);
    lastDbError = null;
  } catch (error) {
    lastDbError = error?.message || String(error);
  }
  return lastLookupCount;
}

function localAddressHealth() {
  refreshLookupCount().catch(() => undefined);
  return {
    postgresAddressProvider: true,
    postgresAddressCount: null,
    postgresAddressError: lastDbError,
    rcAddressProvider: true,
    rcAddressCount: lastLookupCount,
    rcAddressError: lastDbError,
    noTimeout: true,
    strictPrefixOnly: true,
    streetFallback: true,
    settlementFallback: true,
    lookupTables: true,
    singleLookupTable: true,
    oneQueryPerRequest: true,
    memoryCache: memoryCache.size,
    memoryCacheTtlMs: MEMORY_TTL_MS,
    lastQueryMs,
    providerMode: lastProviderMode,
    providerVersion: PROVIDER_VERSION,
  };
}

module.exports = {
  searchLocalAddresses,
  getLocalAddressDetails,
  localAddressHealth,
};
