const { getPool } = require("../../../db/pool");
const { toResult } = require("../utils/mapSearchResult");

// Arbebus RC address provider - clean public.addresses dataset version
// Works with the rebuilt public.addresses table:
// id, name, street, house_number, city, postcode, lat, lon
// Rules:
// - never joins addresses_rc_import during search
// - never uses old match_key
// - local DB first, one bounded query
// - accepts house numbers and partial autocomplete
// - returns only rows with valid WGS84 Lithuanian coordinates

const PROVIDER_VERSION = "rc-addresses-clean-v1";
const CACHE_TTL_MS = Number(process.env.SEARCH_MEMORY_CACHE_TTL_MS || 300000);
const MAX_CACHE_SIZE = Number(process.env.SEARCH_MEMORY_CACHE_MAX || 5000);

const memoryCache = new Map();
let lastDbError = null;
let lastQueryMs = null;
let lastAddressCount = null;
let lastHealthCheck = 0;

const MANUAL_PLACE_ALIASES = [
  {
    keys: ["nida"],
    id: "manual-settlement-nida",
    type: "settlement",
    name: "Nida",
    city: "Nida",
    street: null,
    house_number: null,
    lat: 55.3039,
    lon: 21.0058,
    source: "manual_alias",
  },
  {
    keys: ["smiltyne", "smiltynė"],
    id: "manual-settlement-smiltyne",
    type: "settlement",
    name: "Smiltynė",
    city: "Klaipėda",
    street: null,
    house_number: null,
    lat: 55.7064,
    lon: 21.1056,
    source: "manual_alias",
  },
  {
    keys: ["melnrage", "melnragė", "melnrages", "melnragės", "melnrag"],
    id: "manual-settlement-melnrage",
    type: "settlement",
    name: "Melnragė",
    city: "Klaipėda",
    street: null,
    house_number: null,
    lat: 55.7509,
    lon: 21.0912,
    source: "manual_alias",
  },
  {
    keys: ["giruliai", "giruliu", "girulių"],
    id: "manual-settlement-giruliai",
    type: "settlement",
    name: "Giruliai",
    city: "Klaipėda",
    street: null,
    house_number: null,
    lat: 55.7822,
    lon: 21.0786,
    source: "manual_alias",
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

function uniq(values) {
  return [...new Set(values.filter(Boolean))];
}

function expandLithuanianVariants(value) {
  const base = cleanText(value);
  if (!base) return [];

  const replacements = [
    ["klaipeda", "klaipėda"],
    ["klaipedos", "klaipėdos"],
    ["silute", "šilutė"],
    ["silutes", "šilutės"],
    ["siauliai", "šiauliai"],
    ["panevezys", "panevėžys"],
    ["gargzdai", "gargždai"],
    ["melnrage", "melnragė"],
    ["melnrages", "melnragės"],
    ["giruliu", "girulių"],
    ["laivu", "laivų"],
    ["juru", "jūrų"],
    ["taikos pr", "taikos prospektas"],
    ["h manto", "herkaus manto"],
  ];

  const variants = new Set([base]);
  for (const [plain, accented] of replacements) {
    for (const current of [...variants]) {
      if (current.includes(plain)) variants.add(current.replaceAll(plain, accented));
      if (current.includes(accented)) variants.add(current.replaceAll(accented, plain));
    }
  }

  return [...variants].slice(0, 32);
}

function buildQueryInfo(query) {
  const q = cleanText(query);
  const tokens = q.split(" ").filter(Boolean);
  const lastToken = tokens[tokens.length - 1] || q;
  const variants = expandLithuanianVariants(q);
  const lastVariants = expandLithuanianVariants(lastToken);

  return {
    q,
    tokens,
    variants,
    prefixPatterns: uniq([...variants, ...lastVariants].map((item) => `${item}%`)),
    containsPatterns: uniq(variants.map((item) => `%${item}%`)),
    tokenContainsPatterns: uniq(tokens.flatMap((token) => expandLithuanianVariants(token)).map((item) => `%${item}%`)),
    hasHouseNumber: /\d+[a-ząčęėįšųūž]?([-/]\d+)?/i.test(q),
  };
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

function normalizeStreetForTitle(street) {
  return String(street || "").trim();
}

function rowTitle(row) {
  if (row.type === "settlement") return row.name || row.city || "Gyvenvietė";

  // Prefer DB full address. It is the canonical value from rebuilt public.addresses.
  if (row.name) return String(row.name).trim();

  const street = normalizeStreetForTitle(row.street) || "Adresas";
  const house = String(row.house_number || "").trim();
  return `${street} ${house}`.trim();
}

function rowSubtitle(row) {
  if (row.type === "settlement") return `${row.city || row.name} · Gyvenvietė`;
  if (row.house_number) return `${row.city || "Lietuva"} · Adresas`;
  return `${row.city || "Lietuva"} · Gatvė`;
}

function scoreRow(row, queryInfo) {
  const qNorm = stripLithuanian(queryInfo.q);
  const nameNorm = stripLithuanian(row.name || "");
  const streetNorm = stripLithuanian(row.street || "");
  const cityNorm = stripLithuanian(row.city || "");

  let score = Number(row.rank_score || 0);
  if (row.type === "settlement") score += 500000;
  if (row.type === "address") score += 300000;
  if (nameNorm === qNorm) score += 500000;
  if (nameNorm.startsWith(qNorm)) score += 250000;
  if (streetNorm.startsWith(qNorm)) score += 180000;
  if (cityNorm.startsWith(qNorm)) score += 50000;
  if (queryInfo.hasHouseNumber && row.house_number) score += 250000;
  if (row.source === "manual_alias") score += 600000;
  return score;
}

function rowToResult(row, queryInfo) {
  const latitude = Number(row.lat);
  const longitude = Number(row.lon);
  if (!validCoordinate(latitude, longitude)) return null;

  const type = row.type || (row.house_number ? "address" : "street");
  const title = rowTitle(row);
  const id = String(row.id || `${type}-${title}-${row.city || "lt"}`);

  return toResult({
    id,
    placeId: id,
    type,
    title,
    name: title,
    subtitle: rowSubtitle(row),
    latitude,
    longitude,
    coordinate: { latitude, longitude },
    source: row.source || "postgres_address",
    category: type === "settlement" ? "Gyvenvietė" : type === "address" ? "Adresas" : "Gatvė",
    score: scoreRow(row, queryInfo),
    priority: type === "settlement" ? 330 : type === "address" ? 370 : 340,
    selectable: true,
    requiresHouseNumber: false,
    keywords: [row.name, row.street, row.city, type].filter(Boolean),
  });
}

function dedupe(items) {
  const seen = new Set();
  const out = [];
  for (const item of items.filter(Boolean)) {
    const key = `${stripLithuanian(item.title)}|${stripLithuanian(item.subtitle)}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(item);
  }
  return out;
}

function manualAliasRows(queryInfo) {
  const qNorm = stripLithuanian(queryInfo.q);
  if (!qNorm || qNorm.length < 2) return [];

  return MANUAL_PLACE_ALIASES.filter((item) =>
    item.keys.some((key) => {
      const k = stripLithuanian(key);
      return k.startsWith(qNorm) || qNorm.startsWith(k);
    }),
  );
}

async function queryAddresses(queryInfo, limit) {
  const pool = getPool();
  const boundedLimit = Math.max(Number(limit || 12) * 4, 24);

  const sql = `
    WITH prefix_results AS (
      SELECT
        id::text AS id,
        CASE WHEN NULLIF(house_number, '') IS NOT NULL THEN 'address' ELSE 'street' END AS type,
        name::text AS name,
        street::text AS street,
        house_number::text AS house_number,
        city::text AS city,
        lat::double precision AS lat,
        lon::double precision AS lon,
        1000::int AS rank_score,
        'postgres_address'::text AS source
      FROM public.addresses
      WHERE
        lat BETWEEN 53 AND 57
        AND lon BETWEEN 20 AND 27
        AND (
          name ILIKE ANY($1::text[])
          OR street ILIKE ANY($1::text[])
          OR city ILIKE ANY($1::text[])
        )
      ORDER BY name
      LIMIT $4
    ),
    contains_results AS (
      SELECT
        id::text AS id,
        CASE WHEN NULLIF(house_number, '') IS NOT NULL THEN 'address' ELSE 'street' END AS type,
        name::text AS name,
        street::text AS street,
        house_number::text AS house_number,
        city::text AS city,
        lat::double precision AS lat,
        lon::double precision AS lon,
        650::int AS rank_score,
        'postgres_address'::text AS source
      FROM public.addresses
      WHERE
        lat BETWEEN 53 AND 57
        AND lon BETWEEN 20 AND 27
        AND (
          name ILIKE ANY($2::text[])
          OR (
            cardinality($3::text[]) > 1
            AND name ILIKE ALL($3::text[])
          )
        )
      ORDER BY name
      LIMIT $4
    )
    SELECT * FROM prefix_results
    UNION ALL
    SELECT * FROM contains_results
    LIMIT $4
  `;

  const started = Date.now();
  const result = await pool.query(sql, [
    queryInfo.prefixPatterns.length ? queryInfo.prefixPatterns : [`${queryInfo.q}%`],
    queryInfo.containsPatterns.length ? queryInfo.containsPatterns : [`%${queryInfo.q}%`],
    queryInfo.tokenContainsPatterns,
    boundedLimit,
  ]);
  lastQueryMs = Date.now() - started;
  return result.rows || [];
}

async function searchLocalAddresses(query, options = {}) {
  const queryInfo = buildQueryInfo(query);
  if (!queryInfo.q || queryInfo.q.length < 2) return [];

  const limit = Math.min(Math.max(Number(options.limit || 8), 1), 30);
  const cacheKey = `local-address:${PROVIDER_VERSION}:${queryInfo.q}:${limit}:${options.autocomplete ? "auto" : "search"}`;
  const cached = cacheGet(cacheKey);
  if (cached) return cached;

  try {
    const dbRows = await queryAddresses(queryInfo, limit);
    const rows = [...manualAliasRows(queryInfo), ...dbRows];
    const results = dedupe(rows.map((row) => rowToResult(row, queryInfo)))
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

  const manual = MANUAL_PLACE_ALIASES.find((item) => String(item.id) === id);
  if (manual) {
    const queryInfo = buildQueryInfo(manual.name || manual.city || id);
    return rowToResult(manual, queryInfo);
  }

  const cacheKey = `local-address-details:${PROVIDER_VERSION}:${id}`;
  const cached = cacheGet(cacheKey);
  if (cached) return cached;

  try {
    const result = await getPool().query(
      `SELECT
         id::text AS id,
         CASE WHEN NULLIF(house_number, '') IS NOT NULL THEN 'address' ELSE 'street' END AS type,
         name::text AS name,
         street::text AS street,
         house_number::text AS house_number,
         city::text AS city,
         lat::double precision AS lat,
         lon::double precision AS lon,
         'postgres_address'::text AS source
       FROM public.addresses
       WHERE id::text = $1
         AND lat BETWEEN 53 AND 57
         AND lon BETWEEN 20 AND 27
       LIMIT 1`,
      [id],
    );

    const row = result.rows?.[0];
    if (!row) return null;
    const queryInfo = buildQueryInfo(row.name || row.street || row.city || id);
    const mapped = rowToResult(row, queryInfo);
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
    providerMode: "public.addresses_clean_rc",
    providerVersion: PROVIDER_VERSION,
    oneQueryPerRequest: true,
    noAddressRcJoin: true,
    noMatchKey: true,
    memoryCache: memoryCache.size,
    memoryCacheTtlMs: CACHE_TTL_MS,
    lastQueryMs,
  };
}

module.exports = {
  searchLocalAddresses,
  getLocalAddressDetails,
  localAddressHealth,
};
