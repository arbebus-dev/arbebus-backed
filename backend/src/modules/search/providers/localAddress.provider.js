const { getPool } = require("../../../db/pool");
const { getCache, setCache } = require("../cache/searchCache");
const { toResult } = require("../utils/mapSearchResult");

// Arbebus FINAL Lithuania geocoder provider.
// Hard rules:
// - NO Promise.race, NO provider timeout.
// - DB first: public.addresses_rc_import.
// - Simple indexed prefix queries only.
// - Supports address, selectable street, selectable settlement/city/village.

const LT_FROM = "ąčęėįšųūžĄČĘĖĮŠŲŪŽ";
const LT_TO = "aceeisuuzACEEISUUZ";

let lastDbError = null;
let lastRcCount = null;
let lastDbHealthCheck = 0;

function cleanText(value) {
  return String(value || "").trim().replace(/\s+/g, " ");
}

function normalizeLt(value) {
  const map = new Map([...LT_FROM].map((char, index) => [char, LT_TO[index] || char]));
  return cleanText(value)
    .split("")
    .map((char) => map.get(char) || char)
    .join("")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function sqlNorm(column) {
  // Must match backend/src/db/search_engine_indexes.sql expression exactly.
  return `btrim(regexp_replace(translate(lower(coalesce(${column}::text, '')), '${LT_FROM}', '${LT_TO}'), '[^a-z0-9]+', ' ', 'g'))`;
}

function extractHouseNumber(query) {
  const match = String(query || "").match(/\b(\d+[a-zA-Z]?)\b/);
  return match ? match[1].toUpperCase() : null;
}

function removeHouseNumber(query) {
  return cleanText(query).replace(/\b\d+[a-zA-Z]?\b/g, " ").replace(/\s+/g, " ").trim();
}

function normalizeStreetQuery(query) {
  return normalizeLt(removeHouseNumber(query))
    .replace(/\b(g|gatve|gatvė|pr|prospektas|pl|plentas|al|aleja|kelias|skg|skersgatvis|aikste|aikštė)\b/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function normalizeSettlementQuery(query) {
  return normalizeLt(query)
    .replace(/\b(g|gatve|gatvė|pr|prospektas|pl|plentas|al|aleja|kelias|skg|skersgatvis|aikste|aikštė)\b/g, " ")
    .replace(/\s+/g, " ")
    .trim();
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
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(p1) * Math.cos(p2) * Math.sin(dLon / 2) ** 2;
  return Math.round(2 * R * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h)));
}

function titleFor(row) {
  const type = String(row.result_type || row.type || "address").toLowerCase();
  if (type === "settlement") return cleanText(row.city || row.name || "Vietovė");
  if (type === "street") return cleanText(row.street || row.name || "Gatvė");
  const street = cleanText(row.street || "");
  const house = cleanText(row.house_number || "");
  return cleanText(row.name || [street, house].filter(Boolean).join(" "));
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
  const location = normalizeInputLocation(options);
  const finalLatitude = validCoordinate(latitude, longitude) ? latitude : 55.7033;
  const finalLongitude = validCoordinate(latitude, longitude) ? longitude : 21.1443;
  const userDistance = location
    ? distanceMeters(location, { latitude: finalLatitude, longitude: finalLongitude })
    : null;

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

  const score =
    Number(row.rank_score || 0) +
    priority +
    (userDistance == null ? 0 : Math.max(0, 25000 - Math.min(userDistance, 25000)));

  const title = titleFor(row);
  const subtitle = subtitleFor(row);

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
    addressCount: row.address_count,
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

async function runSql(label, sql, params) {
  console.log("QUERY:", label, params);
  const res = await getPool().query(sql, params);
  console.log("ROWS:", label, res.rowCount);
  return res.rows || [];
}

async function queryAddresses({ qNorm, house, limit }) {
  if (!qNorm || qNorm.length < 2 || !house) return [];
  const streetNorm = sqlNorm("street");
  const rows = await runSql(
    "address",
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
      (
        CASE WHEN ${streetNorm} = $1 THEN 600000 ELSE 0 END +
        CASE WHEN ${streetNorm} LIKE $1 || '%' THEN 450000 ELSE 0 END +
        CASE WHEN upper(coalesce(house_number::text, '')) = upper($2) THEN 600000 ELSE 0 END +
        CASE WHEN upper(coalesce(house_number::text, '')) LIKE upper($2) || '%' THEN 300000 ELSE 0 END
      ) AS rank_score
    FROM public.addresses_rc_import
    WHERE ${streetNorm} LIKE $1 || '%'
      AND upper(coalesce(house_number::text, '')) LIKE upper($2) || '%'
      AND lat IS NOT NULL AND lon IS NOT NULL AND lat <> 0 AND lon <> 0
    ORDER BY rank_score DESC, length(house_number::text), house_number::text, city::text
    LIMIT $3
    `,
    [qNorm, house, limit],
  );
  return rows;
}

async function queryStreets({ qNorm, limit }) {
  if (!qNorm || qNorm.length < 2) return [];
  const streetNorm = sqlNorm("street");
  return runSql(
    "street",
    `
    SELECT DISTINCT ON (${streetNorm}, city::text)
      id::text AS id,
      name::text AS name,
      street::text AS street,
      NULL::text AS house_number,
      city::text AS city,
      postcode::text AS postcode,
      lat,
      lon,
      'street' AS result_type,
      1::int AS address_count,
      (
        CASE WHEN ${streetNorm} = $1 THEN 560000 ELSE 0 END +
        CASE WHEN ${streetNorm} LIKE $1 || '%' THEN 420000 ELSE 0 END
      ) AS rank_score
    FROM public.addresses_rc_import
    WHERE ${streetNorm} LIKE $1 || '%'
      AND lat IS NOT NULL AND lon IS NOT NULL AND lat <> 0 AND lon <> 0
    ORDER BY ${streetNorm}, city::text, rank_score DESC, id::bigint
    LIMIT $2
    `,
    [qNorm, limit],
  );
}

async function querySettlements({ qNorm, limit }) {
  if (!qNorm || qNorm.length < 2) return [];
  const cityNorm = sqlNorm("city");
  return runSql(
    "settlement",
    `
    SELECT DISTINCT ON (${cityNorm})
      id::text AS id,
      city::text AS city,
      city::text AS name,
      NULL::text AS street,
      NULL::text AS house_number,
      NULL::text AS postcode,
      lat,
      lon,
      'settlement' AS result_type,
      1::int AS address_count,
      (
        CASE WHEN ${cityNorm} = $1 THEN 580000 ELSE 0 END +
        CASE WHEN ${cityNorm} LIKE $1 || '%' THEN 460000 ELSE 0 END
      ) AS rank_score
    FROM public.addresses_rc_import
    WHERE ${cityNorm} LIKE $1 || '%'
      AND lat IS NOT NULL AND lon IS NOT NULL AND lat <> 0 AND lon <> 0
    ORDER BY ${cityNorm}, rank_score DESC, id::bigint
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
    rows.push(...(await queryAddresses({ qNorm: streetNorm, house, limit })));
  }

  if (rows.length < limit && settlementNorm.length >= 2 && !house) {
    rows.push(...(await querySettlements({ qNorm: settlementNorm, limit: limit - rows.length })));
  }

  if (rows.length < limit && streetNorm.length >= 2) {
    rows.push(...(await queryStreets({ qNorm: streetNorm, limit: limit - rows.length })));
  }

  if (rows.length < limit && settlementNorm.length >= 2 && house) {
    rows.push(...(await querySettlements({ qNorm: settlementNorm, limit: limit - rows.length })));
  }

  return dedupe(sortResults(rows.map((row) => rowToResult(row, q, options)))).slice(0, limit);
}

async function searchLocalAddresses(query, options = {}) {
  try {
    const q = cleanText(query);
    const cacheKey = `local-address-final-no-timeout-v130:${normalizeLt(q)}:${Number(options.limit || 8)}:${options.autocomplete ? "auto" : "search"}:${options.lat || ""}:${options.lon || ""}`;
    const cached = await getCache(cacheKey);
    if (cached) return cached;

    const results = await searchPostgresAddresses(q, options);
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
  const rawId = String(placeId || "").replace(/^(address|street|settlement)-/, "").trim();
  if (!rawId) return null;

  try {
    const result = await getPool().query(
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
        'address' AS result_type
      FROM public.addresses_rc_import
      WHERE id::text = $1
      LIMIT 1
      `,
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
    streetFallback: true,
    settlementFallback: true,
    providerVersion: "final-no-timeout-v130",
  };
}

module.exports = {
  searchLocalAddresses,
  getLocalAddressDetails,
  localAddressHealth,
};
