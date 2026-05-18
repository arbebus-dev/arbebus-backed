const { getPool } = require("../../../db/pool");
const { toResult } = require("../utils/mapSearchResult");

/**
 * Arbebus local address provider – FINAL robust DB version.
 *
 * Why this file exists:
 * - production DB has public.addresses with columns:
 *   id, name, street, house_number, city, postcode, lat, lon, location
 * - older code searched only public.addresses_search_lookup.q_prefix
 * - SQL examples with full_address fail because public.addresses has no full_address column
 * - unaccent can be missing from search_path, so this provider does NOT require unaccent()
 *
 * Search behavior:
 * - supports LT accents and non-accent typing: "melnrages" -> "Melnragės"
 * - supports full addresses: "Taikos 32", "Taikos 32A", "Liepu 10-2"
 * - checks public.addresses directly, then optional public.addresses_search_lookup if present
 * - keeps in-memory cache for instant repeated autocomplete
 */

const PROVIDER_VERSION = "local-address-final-v181-addresses-direct";
const CACHE_TTL_MS = Number(process.env.SEARCH_MEMORY_CACHE_TTL_MS || 300000);
const MAX_CACHE_SIZE = Number(process.env.SEARCH_MEMORY_CACHE_MAX || 5000);

const memoryCache = new Map();
let lastDbError = null;
let lastQueryMs = null;
let lastAddressCount = null;
let lastHealthCheck = 0;

// Postgres translate() source/target. Used instead of unaccent().
const LT_FROM = "ąčęėįšųūž";
const LT_TO = "aceeisuuz";

const MANUAL_PLACE_ALIASES = [
  {
    id: "settlement-manual-melnrage",
    type: "settlement",
    name: "Melnragė",
    city: "Klaipėda",
    street: null,
    house_number: null,
    lat: 55.7509,
    lon: 21.0887,
    source: "manual_alias",
    address_count: 1,
  },
  {
    id: "settlement-manual-giruliai",
    type: "settlement",
    name: "Giruliai",
    city: "Klaipėda",
    street: null,
    house_number: null,
    lat: 55.7833,
    lon: 21.0833,
    source: "manual_alias",
    address_count: 1,
  },
  {
    id: "settlement-manual-smiltyne",
    type: "settlement",
    name: "Smiltynė",
    city: "Klaipėda",
    street: null,
    house_number: null,
    lat: 55.7064,
    lon: 21.1056,
    source: "manual_alias",
    address_count: 1,
  },
  {
    id: "settlement-manual-nida",
    type: "settlement",
    name: "Nida",
    city: "Nida",
    street: null,
    house_number: null,
    lat: 55.3039,
    lon: 21.0058,
    source: "manual_alias",
    address_count: 1,
  },
];

function cleanText(value) {
  return String(value || "")
    .toLowerCase()
    .replace(/[.,;:()[\]{}]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function stripLithuanian(value) {
  return cleanText(value)
    .replace(/[ąáàâä]/g, "a")
    .replace(/č/g, "c")
    .replace(/[ęėéèêë]/g, "e")
    .replace(/[įíìîï]/g, "i")
    .replace(/š/g, "s")
    .replace(/[ųūúùûü]/g, "u")
    .replace(/ž/g, "z");
}

function normalizeQuery(value) {
  return stripLithuanian(value)
    .replace(/[^\p{L}\p{N}\s\-\/]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function queryTokens(query) {
  return normalizeQuery(query)
    .split(" ")
    .map((token) => token.trim())
    .filter((token) => token.length >= 1)
    .slice(0, 8);
}

function cacheGet(key) {
  const cached = memoryCache.get(key);
  if (!cached) return null;
  if (cached.expiresAt <= Date.now()) {
    memoryCache.delete(key);
    return null;
  }
  return cached.value;
}

function cacheSet(key, value) {
  if (memoryCache.size >= MAX_CACHE_SIZE) {
    const first = memoryCache.keys().next().value;
    if (first) memoryCache.delete(first);
  }
  memoryCache.set(key, { value, expiresAt: Date.now() + CACHE_TTL_MS });
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

function hasHouseNumber(query) {
  return /\d+[a-ząčęėįšųūž]?([-/]\d+[a-ząčęėįšųūž]?)?/i.test(String(query || ""));
}

function rowTitle(row) {
  if (row.type === "settlement") return row.name || row.city || "Gyvenvietė";
  if (row.type === "address") return row.name || [row.street, row.house_number].filter(Boolean).join(" ") || "Adresas";
  return row.street || row.name || "Gatvė";
}

function rowSubtitle(row) {
  if (row.type === "settlement") return `${row.city || row.name || "Lietuva"} · Gyvenvietė`;
  if (row.type === "address") return `${row.city || "Lietuva"} · Adresas`;
  return `${row.city || "Lietuva"} · Gatvė`;
}

function scoreRow(row, qNorm, tokens) {
  const haystack = stripLithuanian(
    [row.name, row.street, row.house_number, row.city, row.postcode].filter(Boolean).join(" "),
  );
  const nameNorm = stripLithuanian(row.name || "");
  const streetNorm = stripLithuanian(row.street || "");
  const cityNorm = stripLithuanian(row.city || "");

  let score = 0;
  if (haystack === qNorm) score += 2000000;
  if (nameNorm === qNorm) score += 1800000;
  if (nameNorm.startsWith(qNorm)) score += 1200000;
  if (streetNorm && streetNorm.startsWith(qNorm)) score += 900000;
  if (haystack.includes(qNorm)) score += 650000;

  const matchingTokens = tokens.filter((t) => haystack.includes(t)).length;
  score += matchingTokens * 120000;

  if (row.type === "address") score += hasHouseNumber(qNorm) ? 500000 : 180000;
  if (row.type === "street") score += 220000;
  if (row.type === "settlement") score += 260000;
  if (cityNorm.includes("klaiped")) score += 80000;
  if (row.source === "manual_alias") score += 300000;

  return score + Number(row.address_count || 0);
}

function rowToResult(row, qNorm, tokens) {
  const latitude = Number(row.lat);
  const longitude = Number(row.lon);
  const hasCoordinate = validCoordinate(latitude, longitude);
  const finalLat = hasCoordinate ? latitude : 55.7033;
  const finalLon = hasCoordinate ? longitude : 21.1443;
  const type = row.type || (row.house_number ? "address" : "street");
  const title = rowTitle(row);

  return toResult({
    id: String(row.id || `${type}-${title}-${row.city || "lt"}`),
    placeId: String(row.id || `${type}-${title}-${row.city || "lt"}`),
    type,
    title,
    name: title,
    subtitle: rowSubtitle(row),
    latitude: finalLat,
    longitude: finalLon,
    coordinate: { latitude: finalLat, longitude: finalLon },
    source: row.source || "postgres_address",
    category: type === "settlement" ? "Gyvenvietė" : type === "address" ? "Adresas" : "Gatvė",
    score: scoreRow(row, qNorm, tokens),
    priority: type === "address" ? 420 : type === "street" ? 360 : 330,
    selectable: true,
    requiresHouseNumber: false,
    keywords: [row.name, row.street, row.house_number, row.city, type].filter(Boolean),
  });
}

function dedupe(items) {
  const seen = new Set();
  const out = [];
  for (const item of items) {
    const key = `${stripLithuanian(item.title)}|${stripLithuanian(item.subtitle)}|${item.latitude}|${item.longitude}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(item);
  }
  return out;
}

function manualAliasRows(qNorm) {
  return MANUAL_PLACE_ALIASES.filter((item) => {
    const name = stripLithuanian(item.name);
    const city = stripLithuanian(item.city);
    return name.includes(qNorm) || name.startsWith(qNorm) || qNorm.includes(name) || city.includes(qNorm);
  });
}

async function queryAddressesDirect(qNorm, tokens, limit) {
  const pool = getPool();

  // Accent-insensitive expression without unaccent extension.
  // IMPORTANT: keep this as translate(lower(...), LT_FROM, LT_TO).
  const haystackExpr = `
    translate(
      lower(concat_ws(' ', name, street, house_number, city, postcode)),
      $4,
      $5
    )
  `;

  const sql = `
    SELECT
      id::text,
      'address'::text AS type,
      name::text,
      city::text,
      street::text,
      house_number::text,
      postcode::text,
      lat::double precision,
      lon::double precision,
      1::int AS address_count,
      'public.addresses'::text AS source
    FROM public.addresses
    WHERE
      ${haystackExpr} LIKE $1
      OR NOT EXISTS (
        SELECT 1
        FROM unnest($3::text[]) AS token
        WHERE ${haystackExpr} NOT LIKE ('%' || token || '%')
      )
    ORDER BY
      CASE
        WHEN translate(lower(coalesce(name, '')), $4, $5) = $2 THEN 0
        WHEN translate(lower(coalesce(name, '')), $4, $5) LIKE ($2 || '%') THEN 1
        WHEN translate(lower(coalesce(street, '')), $4, $5) LIKE ($2 || '%') THEN 2
        ELSE 3
      END,
      CASE WHEN house_number IS NULL OR house_number = '' THEN 1 ELSE 0 END,
      city ASC NULLS LAST,
      name ASC
    LIMIT $6
  `;

  const started = Date.now();
  const result = await pool.query(sql, [`%${qNorm}%`, qNorm, tokens, LT_FROM, LT_TO, Math.max(limit * 4, 30)]);
  lastQueryMs = Date.now() - started;
  return result.rows || [];
}

async function queryLookupOptional(qNorm, tokens, limit) {
  const pool = getPool();

  // Optional old optimized table. If it fails or is empty, direct public.addresses search still works.
  const sql = `
    SELECT
      id::text,
      COALESCE(type, 'street')::text AS type,
      name::text,
      city::text,
      street::text,
      house_number::text,
      NULL::text AS postcode,
      lat::double precision,
      lon::double precision,
      COALESCE(address_count, 0)::int AS address_count,
      'addresses_search_lookup'::text AS source
    FROM public.addresses_search_lookup
    WHERE
      translate(lower(concat_ws(' ', name, street, house_number, city, q_prefix)), $3, $4) LIKE $1
      OR NOT EXISTS (
        SELECT 1
        FROM unnest($5::text[]) AS token
        WHERE translate(lower(concat_ws(' ', name, street, house_number, city, q_prefix)), $3, $4) NOT LIKE ('%' || token || '%')
      )
    ORDER BY
      address_count DESC,
      name ASC
    LIMIT $2
  `;

  try {
    const result = await pool.query(sql, [`%${qNorm}%`, Math.max(limit * 2, 20), LT_FROM, LT_TO, tokens]);
    return result.rows || [];
  } catch (_) {
    return [];
  }
}

async function searchLocalAddresses(query, options = {}) {
  const qNorm = normalizeQuery(query);
  const tokens = queryTokens(query);
  if (!qNorm || qNorm.length < 2 || tokens.length === 0) return [];

  const limit = Math.min(Math.max(Number(options.limit || 8), 1), 20);
  const cacheKey = `local-address:${PROVIDER_VERSION}:${qNorm}:${limit}:${options.autocomplete ? "auto" : "search"}`;
  const cached = cacheGet(cacheKey);
  if (cached) return cached;

  try {
    const directRows = await queryAddressesDirect(qNorm, tokens, limit);
    let lookupRows = [];
    if (directRows.length < limit) {
      lookupRows = await queryLookupOptional(qNorm, tokens, limit);
    }

    const rows = [...manualAliasRows(qNorm), ...directRows, ...lookupRows];
    const results = dedupe(rows.map((row) => rowToResult(row, qNorm, tokens)))
      .sort((a, b) => Number(b.score || 0) - Number(a.score || 0))
      .slice(0, limit);

    cacheSet(cacheKey, results);
    lastDbError = null;
    return results;
  } catch (error) {
    lastDbError = error?.message || String(error);
    return [];
  }
}

async function getLocalAddressDetails(placeId) {
  const id = String(placeId || "").replace(/^address-/, "").trim();
  if (!id) return null;

  const cacheKey = `local-address-details:${PROVIDER_VERSION}:${id}`;
  const cached = cacheGet(cacheKey);
  if (cached) return cached;

  const manual = MANUAL_PLACE_ALIASES.find((item) => String(item.id) === id);
  if (manual) {
    const qNorm = normalizeQuery(manual.name);
    const tokens = queryTokens(manual.name);
    const mapped = rowToResult(manual, qNorm, tokens);
    cacheSet(cacheKey, mapped);
    return mapped;
  }

  try {
    const result = await getPool().query(
      `SELECT id::text, 'address'::text AS type, name::text, city::text, street::text,
              house_number::text, postcode::text, lat::double precision, lon::double precision,
              1::int AS address_count, 'public.addresses'::text AS source
       FROM public.addresses
       WHERE id::text = $1
       LIMIT 1`,
      [id],
    );

    const row = result.rows?.[0];
    if (!row) return null;

    const qNorm = normalizeQuery(row.name || row.street || row.city || id);
    const tokens = queryTokens(qNorm);
    const mapped = rowToResult(row, qNorm, tokens);
    cacheSet(cacheKey, mapped);
    lastDbError = null;
    return mapped;
  } catch (error) {
    lastDbError = error?.message || String(error);
    return null;
  }
}

async function refreshAddressCount() {
  if (Date.now() - lastHealthCheck < 30000) return lastAddressCount;
  lastHealthCheck = Date.now();
  try {
    const result = await getPool().query("SELECT COUNT(*)::int AS count FROM public.addresses");
    lastAddressCount = Number(result.rows?.[0]?.count || 0);
    lastDbError = null;
  } catch (error) {
    lastDbError = error?.message || String(error);
  }
  return lastAddressCount;
}

function localAddressHealth() {
  refreshAddressCount().catch(() => undefined);
  return {
    postgresAddressProvider: true,
    postgresAddressCount: lastAddressCount,
    postgresAddressError: lastDbError,
    providerMode: "public.addresses-direct",
    providerVersion: PROVIDER_VERSION,
    requiresFullAddressColumn: false,
    requiresUnaccentExtension: false,
    supportsHouseNumber: true,
    supportsAccentlessLithuanian: true,
    memoryCache: memoryCache.size,
    memoryCacheTtlMs: CACHE_TTL_MS,
    lastQueryMs,
  };
}

module.exports = { searchLocalAddresses, getLocalAddressDetails, localAddressHealth };
