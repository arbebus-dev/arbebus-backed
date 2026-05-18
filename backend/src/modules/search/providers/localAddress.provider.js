const { getPool } = require("../../../db/pool");
const { toResult } = require("../utils/mapSearchResult");

// Arbebus ULTIMATE local address provider
// Designed for the rebuilt public.addresses table:
// id, name, street, house_number, city, postcode, lat, lon
// Goals:
// - local DB first
// - autocomplete-friendly
// - typo tolerant via pg_trgm KNN indexes
// - no joins to addresses_rc_import during search
// - no match_key during search
// - bounded candidate sets before JS ranking

const PROVIDER_VERSION = "rc-addresses-ultimate-v3";
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
    ["vilnius", "vilnius"],
    ["kaunas", "kaunas"],
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

  const variants = new Set([base, stripLithuanian(base)]);
  for (const [plain, accented] of replacements) {
    for (const current of [...variants]) {
      if (current.includes(plain)) variants.add(current.replaceAll(plain, accented));
      if (current.includes(accented)) variants.add(current.replaceAll(accented, plain));
    }
  }

  return [...variants].filter(Boolean).slice(0, 32);
}

function normalizeStreetQuery(value) {
  return cleanText(value)
    .replace(/\b(g|g\.|gatve|gatvė)\b/g, "")
    .replace(/\b(pr|pr\.|prospektas)\b/g, "")
    .replace(/\b(al|al\.|aleja)\b/g, "")
    .replace(/\b(pl|pl\.|plentas)\b/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function parseHouseQuery(q) {
  const normalized = cleanText(q);
  const match = normalized.match(/\b(\d+[a-ząčęėįšųūž]?)(?:[-/]\d+)?\b/i);
  if (!match) return null;

  const houseNumber = match[1].toLowerCase();
  const before = normalized.slice(0, match.index).trim();
  const after = normalized.slice(match.index + match[0].length).trim();
  const streetText = normalizeStreetQuery(before || after);

  return {
    houseNumber,
    streetText,
    streetVariants: expandLithuanianVariants(streetText),
  };
}

function buildQueryInfo(query) {
  const q = cleanText(query);
  const tokens = q.split(" ").filter(Boolean);
  const lastToken = tokens[tokens.length - 1] || q;
  const variants = expandLithuanianVariants(q);
  const lastVariants = expandLithuanianVariants(lastToken);
  const house = parseHouseQuery(q);

  return {
    q,
    tokens,
    variants,
    lastVariants,
    house,
    prefixPatterns: uniq([...variants, ...lastVariants].map((item) => `${item}%`)),
    streetPrefixPatterns: uniq((house?.streetVariants || variants).map((item) => `${item}%`)),
    cityPrefixPatterns: uniq([...variants, ...lastVariants].map((item) => `${item}%`)),
    hasHouseNumber: Boolean(house),
  };
}

function cacheGet(key) {
  const cached = memoryCache.get(key);
  if (!cached) return null;
  if (cached.expiresAt <= Date.now()) {
    memoryCache.delete(key);
    return null;
  }
  memoryCache.delete(key);
  memoryCache.set(key, cached);
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
  const houseNorm = stripLithuanian(row.house_number || "");
  const streetQueryNorm = stripLithuanian(queryInfo.house?.streetText || queryInfo.q);

  let score = Number(row.rank_score || 0);
  if (row.type === "settlement") score += 700000;
  if (row.type === "address") score += 300000;
  if (row.source === "manual_alias") score += 800000;

  if (nameNorm === qNorm) score += 700000;
  if (nameNorm.startsWith(qNorm)) score += 420000;
  if (streetNorm.startsWith(qNorm)) score += 280000;
  if (cityNorm.startsWith(qNorm)) score += 120000;

  if (queryInfo.hasHouseNumber && row.house_number) {
    score += 250000;
    if (houseNorm === stripLithuanian(queryInfo.house.houseNumber)) score += 650000;
    if (streetQueryNorm && streetNorm.startsWith(streetQueryNorm)) score += 350000;
    if (nameNorm.includes(`${streetQueryNorm}${houseNorm}`.replace(/\s+/g, ""))) score += 120000;
  }

  if (Number.isFinite(Number(row.distance_score))) {
    score += Math.max(0, 100000 - Number(row.distance_score) * 10000);
  }

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
    priority: type === "settlement" ? 360 : type === "address" ? 390 : 350,
    selectable: true,
    requiresHouseNumber: false,
    keywords: [row.name, row.street, row.city, type].filter(Boolean),
  });
}

function dedupe(items) {
  const seen = new Set();
  const out = [];
  for (const item of items.filter(Boolean)) {
    const key = `${stripLithuanian(item.title)}|${stripLithuanian(item.subtitle)}|${item.latitude.toFixed(5)}|${item.longitude.toFixed(5)}`;
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
  const boundedLimit = Math.min(Math.max(Number(limit || 12) * 5, 30), 80);

  const houseNumber = queryInfo.house?.houseNumber || null;
  const q = stripLithuanian(queryInfo.q);
  const prefixPatterns = queryInfo.prefixPatterns.length ? queryInfo.prefixPatterns : [`${queryInfo.q}%`];
  const streetPrefixPatterns = queryInfo.streetPrefixPatterns.length ? queryInfo.streetPrefixPatterns : prefixPatterns;
  const cityPrefixPatterns = queryInfo.cityPrefixPatterns.length ? queryInfo.cityPrefixPatterns : prefixPatterns;

  const sql = `
    WITH params AS (
      SELECT
        $1::text AS q,
        $2::text AS house_number,
        $3::text[] AS prefix_patterns,
        $4::text[] AS street_prefix_patterns,
        $5::text[] AS city_prefix_patterns,
        $6::int AS bounded_limit
    ),
    house_results AS (
      SELECT
        a.id::text AS id,
        'address'::text AS type,
        a.name::text AS name,
        a.street::text AS street,
        a.house_number::text AS house_number,
        a.city::text AS city,
        a.lat::double precision AS lat,
        a.lon::double precision AS lon,
        2200::int AS rank_score,
        0::double precision AS distance_score,
        'postgres_address'::text AS source
      FROM public.addresses a, params p
      WHERE p.house_number IS NOT NULL
        AND a.lat BETWEEN 53 AND 57
        AND a.lon BETWEEN 20 AND 27
        AND lower(a.house_number) = p.house_number
        AND lower(a.street) LIKE ANY(p.street_prefix_patterns)
      ORDER BY a.city, a.name
      LIMIT (SELECT bounded_limit FROM params)
    ),
    prefix_results AS (
      SELECT
        a.id::text AS id,
        CASE WHEN NULLIF(a.house_number, '') IS NOT NULL THEN 'address' ELSE 'street' END AS type,
        a.name::text AS name,
        a.street::text AS street,
        a.house_number::text AS house_number,
        a.city::text AS city,
        a.lat::double precision AS lat,
        a.lon::double precision AS lon,
        1500::int AS rank_score,
        0::double precision AS distance_score,
        'postgres_address'::text AS source
      FROM public.addresses a, params p
      WHERE a.lat BETWEEN 53 AND 57
        AND a.lon BETWEEN 20 AND 27
        AND (
          lower(a.name) LIKE ANY(p.prefix_patterns)
          OR lower(a.street) LIKE ANY(p.prefix_patterns)
          OR lower(a.city) LIKE ANY(p.city_prefix_patterns)
        )
      ORDER BY a.name
      LIMIT (SELECT bounded_limit FROM params)
    ),
    knn_name AS (
      SELECT
        a.id::text AS id,
        CASE WHEN NULLIF(a.house_number, '') IS NOT NULL THEN 'address' ELSE 'street' END AS type,
        a.name::text AS name,
        a.street::text AS street,
        a.house_number::text AS house_number,
        a.city::text AS city,
        a.lat::double precision AS lat,
        a.lon::double precision AS lon,
        900::int AS rank_score,
        (lower(a.name) <-> (SELECT q FROM params))::double precision AS distance_score,
        'postgres_address_typo'::text AS source
      FROM public.addresses a, params p
      WHERE a.lat BETWEEN 53 AND 57
        AND a.lon BETWEEN 20 AND 27
      ORDER BY lower(a.name) <-> p.q
      LIMIT (SELECT bounded_limit FROM params)
    ),
    knn_street AS (
      SELECT
        a.id::text AS id,
        CASE WHEN NULLIF(a.house_number, '') IS NOT NULL THEN 'address' ELSE 'street' END AS type,
        a.name::text AS name,
        a.street::text AS street,
        a.house_number::text AS house_number,
        a.city::text AS city,
        a.lat::double precision AS lat,
        a.lon::double precision AS lon,
        780::int AS rank_score,
        (lower(a.street) <-> (SELECT q FROM params))::double precision AS distance_score,
        'postgres_street_typo'::text AS source
      FROM public.addresses a, params p
      WHERE a.lat BETWEEN 53 AND 57
        AND a.lon BETWEEN 20 AND 27
      ORDER BY lower(a.street) <-> p.q
      LIMIT (SELECT bounded_limit FROM params)
    )
    SELECT * FROM house_results
    UNION ALL
    SELECT * FROM prefix_results
    UNION ALL
    SELECT * FROM knn_name
    UNION ALL
    SELECT * FROM knn_street
    LIMIT (SELECT bounded_limit FROM params)
  `;

  const started = Date.now();
  const result = await pool.query(sql, [
    q,
    houseNumber,
    prefixPatterns,
    streetPrefixPatterns,
    cityPrefixPatterns,
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
    providerMode: "public.addresses_clean_rc_ultimate",
    providerVersion: PROVIDER_VERSION,
    oneQueryPerRequest: true,
    noAddressRcJoin: true,
    noMatchKey: true,
    autocomplete: true,
    typoTolerance: true,
    ranking: true,
    requiredIndexFile: "backend/sql/ultimate_search_engine_indexes.sql",
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
