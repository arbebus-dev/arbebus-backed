const { getPool } = require("../../../db/pool");
const { getCache, setCache } = require("../cache/searchCache");
const { toResult } = require("../utils/mapSearchResult");

// Arbebus ULTRA FAST Lithuania geocoder provider.
// Production rules:
// - NO provider timeout / NO Promise.race.
// - Autocomplete uses tiny derived lookup tables first:
//   public.addresses_search_settlements + public.addresses_search_streets.
// - Strict prefix queries only: norm LIKE 'query%'.
// - addresses_rc_import is used for exact house-number results.
// - Falls back safely if derived tables are not created yet.

const LT_FROM = "ąčęėįšųūžĄČĘĖĮŠŲŪŽ";
const LT_TO = "aceeisuuzACEEISUUZ";
const MEMORY_TTL_MS = 60_000;
const memoryCache = new Map();

let lastDbError = null;
let lastRcCount = null;
let lastDbHealthCheck = 0;
let lastProviderMode = "lookup";

function cleanText(value) {
  return String(value || "").trim().replace(/\s+/g, " ");
}

function normalizeLt(value) {
  const from = LT_FROM;
  const to = LT_TO;
  return cleanText(value)
    .split("")
    .map((char) => {
      const index = from.indexOf(char);
      return index >= 0 ? to[index] || char : char;
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

function normalizeStreetQuery(query) {
  return stripStreetType(removeHouseNumber(query));
}

function normalizeSettlementQuery(query) {
  return stripStreetType(query);
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
  const resultType = String(row.result_type || "address").toLowerCase();
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
  if (memoryCache.size > 500) {
    for (const firstKey of memoryCache.keys()) {
      memoryCache.delete(firstKey);
      if (memoryCache.size <= 450) break;
    }
  }
}

async function runSql(label, sql, params) {
  const started = Date.now();
  console.log("QUERY:", label, params);
  const res = await getPool().query(sql, params);
  console.log("ROWS:", label, res.rowCount, `${Date.now() - started}ms`);
  return res.rows || [];
}

async function queryAddresses({ streetNorm, house, limit }) {
  if (!streetNorm || streetNorm.length < 2 || !house) return [];
  const normStreet = sqlNorm("street");
  return runSql(
    "address-prefix",
    `
    SELECT
      id::text AS id,
      name::text AS name,
      street::text AS street,
      house_number::text AS house_number,
      city::text AS city,
      postcode::text AS postcode,
      lat,
      lon,
      'address' AS result_type,
      1::int AS address_count,
      (
        CASE WHEN ${normStreet} = $1 THEN 700000 ELSE 0 END +
        CASE WHEN ${normStreet} LIKE $1 || '%' THEN 520000 ELSE 0 END +
        CASE WHEN upper(coalesce(house_number::text, '')) = upper($2) THEN 700000 ELSE 0 END +
        CASE WHEN upper(coalesce(house_number::text, '')) LIKE upper($2) || '%' THEN 350000 ELSE 0 END
      ) AS rank_score
    FROM public.addresses_rc_import
    WHERE ${normStreet} LIKE $1 || '%'
      AND upper(coalesce(house_number::text, '')) LIKE upper($2) || '%'
      AND lat IS NOT NULL AND lon IS NOT NULL AND lat <> 0 AND lon <> 0
    ORDER BY rank_score DESC, length(house_number::text), house_number::text, city::text
    LIMIT $3
    `,
    [streetNorm, house, limit],
  );
}

async function querySettlementLookup({ qNorm, limit }) {
  if (!qNorm || qNorm.length < 2) return [];
  try {
    lastProviderMode = "lookup";
    return await runSql(
      "settlement-lookup-prefix",
      `
      SELECT
        id::text AS id,
        city::text AS city,
        city::text AS name,
        NULL::text AS street,
        NULL::text AS house_number,
        NULL::text AS postcode,
        lat,
        lon,
        'settlement' AS result_type,
        address_count::int AS address_count,
        (
          CASE WHEN city_norm = $1 THEN 900000 ELSE 0 END +
          CASE WHEN city_norm LIKE $1 || '%' THEN 650000 ELSE 0 END +
          LEAST(address_count, 5000)
        ) AS rank_score
      FROM public.addresses_search_settlements
      WHERE city_norm LIKE $1 || '%'
      ORDER BY rank_score DESC, city
      LIMIT $2
      `,
      [qNorm, limit],
    );
  } catch (error) {
    if (String(error?.message || "").includes("addresses_search_settlements")) return [];
    throw error;
  }
}

async function queryStreetLookup({ qNorm, limit }) {
  if (!qNorm || qNorm.length < 2) return [];
  try {
    lastProviderMode = "lookup";
    return await runSql(
      "street-lookup-prefix",
      `
      SELECT
        id::text AS id,
        street::text AS street,
        street::text AS name,
        city::text AS city,
        NULL::text AS house_number,
        NULL::text AS postcode,
        lat,
        lon,
        'street' AS result_type,
        address_count::int AS address_count,
        (
          CASE WHEN street_norm = $1 THEN 820000 ELSE 0 END +
          CASE WHEN street_norm LIKE $1 || '%' THEN 600000 ELSE 0 END +
          LEAST(address_count, 5000)
        ) AS rank_score
      FROM public.addresses_search_streets
      WHERE street_norm LIKE $1 || '%'
      ORDER BY rank_score DESC, street, city
      LIMIT $2
      `,
      [qNorm, limit],
    );
  } catch (error) {
    if (String(error?.message || "").includes("addresses_search_streets")) return [];
    throw error;
  }
}

async function querySettlementRawFallback({ qNorm, limit }) {
  if (!qNorm || qNorm.length < 2) return [];
  lastProviderMode = "raw-fallback";
  const normCity = sqlNorm("city");
  return runSql(
    "settlement-raw-prefix",
    `
    SELECT
      md5(${normCity}) AS id,
      min(city::text) AS city,
      min(city::text) AS name,
      NULL::text AS street,
      NULL::text AS house_number,
      NULL::text AS postcode,
      avg(lat)::double precision AS lat,
      avg(lon)::double precision AS lon,
      'settlement' AS result_type,
      count(*)::int AS address_count,
      550000 + LEAST(count(*)::int, 5000) AS rank_score
    FROM public.addresses_rc_import
    WHERE ${normCity} LIKE $1 || '%'
      AND lat IS NOT NULL AND lon IS NOT NULL AND lat <> 0 AND lon <> 0
    GROUP BY ${normCity}
    ORDER BY rank_score DESC, min(city::text)
    LIMIT $2
    `,
    [qNorm, limit],
  );
}

async function queryStreetRawFallback({ qNorm, limit }) {
  if (!qNorm || qNorm.length < 2) return [];
  lastProviderMode = "raw-fallback";
  const normStreet = sqlNorm("street");
  const normCity = sqlNorm("city");
  return runSql(
    "street-raw-prefix",
    `
    SELECT
      md5(${normStreet} || '|' || ${normCity}) AS id,
      min(street::text) AS street,
      min(street::text) AS name,
      min(city::text) AS city,
      NULL::text AS house_number,
      NULL::text AS postcode,
      avg(lat)::double precision AS lat,
      avg(lon)::double precision AS lon,
      'street' AS result_type,
      count(*)::int AS address_count,
      500000 + LEAST(count(*)::int, 5000) AS rank_score
    FROM public.addresses_rc_import
    WHERE ${normStreet} LIKE $1 || '%'
      AND lat IS NOT NULL AND lon IS NOT NULL AND lat <> 0 AND lon <> 0
    GROUP BY ${normStreet}, ${normCity}
    ORDER BY rank_score DESC, min(street::text), min(city::text)
    LIMIT $2
    `,
    [qNorm, limit],
  );
}

async function searchPostgresAddresses(query, options = {}) {
  const q = cleanText(query);
  if (q.length < 2) return [];
  const limit = Math.min(Math.max(Number(options.limit || 8), 1), 30);
  const house = extractHouseNumber(q);
  const streetNorm = normalizeStreetQuery(q);
  const settlementNorm = normalizeSettlementQuery(q);
  const rows = [];

  if (house && streetNorm.length >= 2) {
    rows.push(...(await queryAddresses({ streetNorm, house, limit })));
  }

  if (!house && rows.length < limit && settlementNorm.length >= 2) {
    let settlementRows = await querySettlementLookup({ qNorm: settlementNorm, limit: limit - rows.length });
    if (settlementRows.length === 0) {
      settlementRows = await querySettlementRawFallback({ qNorm: settlementNorm, limit: limit - rows.length });
    }
    rows.push(...settlementRows);
  }

  if (rows.length < limit && streetNorm.length >= 2) {
    let streetRows = await queryStreetLookup({ qNorm: streetNorm, limit: limit - rows.length });
    if (streetRows.length === 0) {
      streetRows = await queryStreetRawFallback({ qNorm: streetNorm, limit: limit - rows.length });
    }
    rows.push(...streetRows);
  }

  if (house && rows.length < limit && settlementNorm.length >= 2) {
    let settlementRows = await querySettlementLookup({ qNorm: settlementNorm, limit: limit - rows.length });
    if (settlementRows.length === 0) settlementRows = await querySettlementRawFallback({ qNorm: settlementNorm, limit: limit - rows.length });
    rows.push(...settlementRows);
  }

  return dedupe(sortResults(rows.map((row) => rowToResult(row, q, options)))).slice(0, limit);
}

async function searchLocalAddresses(query, options = {}) {
  try {
    const q = cleanText(query);
    const normalized = normalizeLt(q);
    const limit = Number(options.limit || 8);
    const cacheKey = `local-address-ultra-v140:${normalized}:${limit}:${options.autocomplete ? "auto" : "search"}:${options.lat || ""}:${options.lon || ""}`;

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
    if (type === "settlement") {
      const result = await getPool().query(
        `SELECT id::text, city::text, city::text AS name, NULL::text AS street, NULL::text AS house_number, NULL::text AS postcode, lat, lon, 'settlement' AS result_type, address_count::int FROM public.addresses_search_settlements WHERE id::text = $1 LIMIT 1`,
        [rawId],
      );
      if (result.rows?.[0]) return rowToResult(result.rows[0], result.rows[0].city, options);
    }

    if (type === "street") {
      const result = await getPool().query(
        `SELECT id::text, street::text, street::text AS name, city::text, NULL::text AS house_number, NULL::text AS postcode, lat, lon, 'street' AS result_type, address_count::int FROM public.addresses_search_streets WHERE id::text = $1 LIMIT 1`,
        [rawId],
      );
      if (result.rows?.[0]) return rowToResult(result.rows[0], result.rows[0].street, options);
    }

    const result = await getPool().query(
      `SELECT id::text AS id, name::text AS name, street::text AS street, house_number::text AS house_number, city::text AS city, postcode::text AS postcode, lat, lon, 'address' AS result_type FROM public.addresses_rc_import WHERE id::text = $1 LIMIT 1`,
      [rawId],
    );
    const row = result.rows?.[0];
    return row ? rowToResult(row, titleFor(row), options) : null;
  } catch (error) {
    lastDbError = error?.message || String(error);
    return null;
  }
}

async function refreshDbCount() {
  if (Date.now() - lastDbHealthCheck < 30000) return lastRcCount;
  lastDbHealthCheck = Date.now();
  try {
    const result = await getPool().query("SELECT COUNT(*)::int AS count FROM public.addresses_rc_import");
    lastRcCount = Number(result.rows?.[0]?.count || 0);
    lastDbError = null;
  } catch (error) {
    lastDbError = error?.message || String(error);
  }
  return lastRcCount;
}

function localAddressHealth() {
  refreshDbCount().catch(() => undefined);
  return {
    postgresAddressProvider: true,
    postgresAddressCount: lastRcCount,
    postgresAddressError: lastDbError,
    rcAddressProvider: true,
    rcAddressCount: lastRcCount,
    rcAddressError: null,
    noTimeout: true,
    strictPrefixOnly: true,
    streetFallback: true,
    settlementFallback: true,
    lookupTables: true,
    memoryCache: memoryCache.size,
    providerMode: lastProviderMode,
    providerVersion: "ultra-fast-lookup-v140",
  };
}

module.exports = {
  searchLocalAddresses,
  getLocalAddressDetails,
  localAddressHealth,
};
