const { getPool } = require("../../../db/pool");
const { toResult } = require("../utils/mapSearchResult");

// Arbebus FINAL local geocoder provider v170
// Goal:
// - one DB query per autocomplete request
// - reads only public.addresses_search_lookup
// - supports Lithuanian text without accents: silute -> Šilutė, laivu -> Laivų
// - supports combined search: slengiai l -> Slengių gatvės, silute lietu -> Lietuvininkų g., Šilutė
// - no provider timeout, no old addresses_rc_import scan, no POI/Meili/OSM fallback here

const PROVIDER_VERSION = "ultra-fast-v172-trigram-autocomplete";
const CACHE_TTL_MS = Number(process.env.SEARCH_MEMORY_CACHE_TTL_MS || 300000);
const MAX_CACHE_SIZE = Number(process.env.SEARCH_MEMORY_CACHE_MAX || 5000);

const memoryCache = new Map();
let lastDbError = null;
let lastQueryMs = null;
let lastLookupCount = null;
let lastHealthCheck = 0;

const MANUAL_PLACE_ALIASES = [
  {
    keys: ["nida"],
    id: "settlement-manual-nida",
    type: "settlement",
    name: "Nida",
    city: "Nida",
    street: null,
    house_number: null,
    lat: 55.3039,
    lon: 21.0058,
    q_prefix: "nida",
    address_count: 1,
    source: "manual_alias",
  },
  {
    keys: ["smiltyne", "smiltynė"],
    id: "settlement-manual-smiltyne",
    type: "settlement",
    name: "Smiltynė",
    city: "Smiltynė",
    street: null,
    house_number: null,
    lat: 55.7064,
    lon: 21.1056,
    q_prefix: "smiltyne",
    address_count: 1,
    source: "manual_alias",
  },
  {
    keys: ["melnrage", "melnragė", "melnrages", "melnragės", "melnrag"],
    id: "settlement-manual-melnrage",
    type: "settlement",
    name: "Melnragė",
    city: "Klaipėda",
    street: null,
    house_number: null,
    lat: 55.7509,
    lon: 21.0912,
    q_prefix: "melnrage",
    address_count: 1,
    source: "manual_alias",
  },
  {
    keys: ["giruliai", "giruliu", "girulių"],
    id: "settlement-manual-giruliai",
    type: "settlement",
    name: "Giruliai",
    city: "Klaipėda",
    street: null,
    house_number: null,
    lat: 55.7822,
    lon: 21.0786,
    q_prefix: "giruliai",
    address_count: 1,
    source: "manual_alias",
  },
];

function cleanText(value) {
  return String(value || "")
    .toLowerCase()
    .replace(/[.,;:()\[\]{}]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function stripLithuanian(value) {
  return cleanText(value)
    .replace(/[ąáàâä]/g, "a")
    .replace(/[č]/g, "c")
    .replace(/[ęėéèêë]/g, "e")
    .replace(/[įíìîï]/g, "i")
    .replace(/[š]/g, "s")
    .replace(/[ųūúùûü]/g, "u")
    .replace(/[ž]/g, "z");
}

function uniq(values) {
  return [...new Set(values.filter(Boolean))];
}

function expandLithuanianVariants(value) {
  const base = cleanText(value);
  if (!base) return [];

  // Keep this intentionally small and deterministic. These variants cover the practical cases
  // the app needs most often: Šilutė/Silute, Klaipėda/Klaipeda, Laivų/Laivu, etc.
  const replacements = [
    ["silute", "šilutė"],
    ["silutes", "šilutės"],
    ["klaipeda", "klaipėda"],
    ["klaipedos", "klaipėdos"],
    ["siauliai", "šiauliai"],
    ["panevezys", "panevėžys"],
    ["gargzdai", "gargždai"],
    ["kretinga", "kretinga"],
    ["palanga", "palanga"],
    ["slengiai", "slengiai"],
    ["radailiai", "radailiai"],
    ["nida", "nida"],
    ["neringa", "neringa"],
    ["melnrage", "melnragė"],
    ["melnrages", "melnragės"],
    ["giruliu", "girulių"],
    ["laivu", "laivų"],
    ["liuties", "liūties"],
    ["vesos", "vėsos"],
    ["sviesos", "šviesos"],
    ["zaliakelio", "žaliakelio"],
    ["zvaigzdyno", "žvaigždyno"],
    ["ezer", "ežer"],
    ["klipsciu", "klipščių"],
  ];

  const variants = new Set([base]);
  for (const [plain, accented] of replacements) {
    for (const current of [...variants]) {
      if (current.includes(plain))
        variants.add(current.replaceAll(plain, accented));
      if (current.includes(accented))
        variants.add(current.replaceAll(accented, plain));
    }
  }

  return [...variants].slice(0, 32);
}

function buildPrefixSets(query) {
  const q = cleanText(query);
  const tokens = q.split(" ").filter(Boolean);
  const lastToken = tokens[tokens.length - 1] || q;

  const fullVariants = expandLithuanianVariants(q).map((item) => `${item}%`);
  const lastTokenVariants = expandLithuanianVariants(lastToken).map(
    (item) => `${item}%`,
  );

  // Full prefix handles: "slengiai l", "silute lietu".
  // Last token prefix handles Apple/Google-like fallback: "silute lietu" -> also "lietu%".
  const allPrefixes = uniq([...fullVariants, ...lastTokenVariants]);

  return {
    q,
    tokens,
    fullPrefixes: uniq(fullVariants),
    lastTokenPrefixes: uniq(lastTokenVariants),
    allPrefixes,
  };
}

function looksLikeHouseNumberQuery(value) {
  return /\d+[a-ząčęėįšųūž]?([\-/]\d+)?/i.test(String(value || ""));
}

function tokenLikePatterns(queryInfo) {
  return queryInfo.tokens.map((token) => `%${stripLithuanian(token)}%`);
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

function rowTitle(row) {
  if (row.type === "settlement") return row.name || row.city || "Gyvenvietė";
  const street = row.street || row.name || "Gatvė";
  const house = String(row.house_number || "").trim();
  if (row.type === "address" || house) return `${street} ${house}`.trim();
  return street;
}

function rowSubtitle(row) {
  if (row.type === "settlement") return `${row.city || row.name} · Gyvenvietė`;
  if (row.type === "address" || row.house_number)
    return `${row.city || "Lietuva"} · Adresas`;
  return `${row.city || "Lietuva"} · Gatvė`;
}

function scoreRow(row, queryInfo) {
  const qNorm = stripLithuanian(queryInfo.q);
  const prefixNorm = stripLithuanian(row.q_prefix || "");
  const nameNorm = stripLithuanian(row.name || "");
  const cityNorm = stripLithuanian(row.city || "");
  const streetNorm = stripLithuanian(row.street || "");
  const tokenCount = queryInfo.tokens.length;

  let score = Number(row.address_count || 0);

  if (prefixNorm === qNorm) score += 1200000;
  else if (prefixNorm.startsWith(qNorm)) score += 900000;

  if (tokenCount > 1 && prefixNorm.startsWith(qNorm)) score += 450000;
  if (tokenCount > 1 && cityNorm && qNorm.startsWith(cityNorm)) score += 250000;

  if (row.type === "settlement") score += 250000;
  if (row.type === "street") score += 180000;

  if (nameNorm.startsWith(qNorm)) score += 120000;
  if (streetNorm && streetNorm.startsWith(qNorm)) score += 120000;

  if (row.source === "manual_alias") score += 200000;

  return score;
}

function rowToResult(row, queryInfo) {
  const latitude = Number(row.lat);
  const longitude = Number(row.lon);
  const hasCoordinate = validCoordinate(latitude, longitude);
  const finalLat = hasCoordinate ? latitude : 55.7033;
  const finalLon = hasCoordinate ? longitude : 21.1443;
  const type =
    row.type === "settlement"
      ? "settlement"
      : row.house_number
        ? "address"
        : "street";
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
    category:
      type === "settlement"
        ? "Gyvenvietė"
        : type === "address"
          ? "Adresas"
          : "Gatvė",
    score: scoreRow(row, queryInfo),
    priority: type === "settlement" ? 330 : type === "address" ? 360 : 340,
    selectable: true,
    requiresHouseNumber: false,
    keywords: [row.name, row.street, row.city, type].filter(Boolean),
  });
}

function dedupe(items) {
  const seen = new Set();
  const out = [];
  for (const item of items) {
    const key = `${stripLithuanian(item.title)}|${stripLithuanian(item.subtitle)}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(item);
  }
  return out;
}

function manualAliasRows(queryInfo) {
  const qNorm = stripLithuanian(queryInfo.q);
  return MANUAL_PLACE_ALIASES.filter((item) =>
    item.keys.some(
      (key) =>
        stripLithuanian(key).startsWith(qNorm) ||
        qNorm.startsWith(stripLithuanian(key)),
    ),
  );
}

async function queryLookup(queryInfo, limit) {
  const pool = getPool();
  const hasHouseNumber = looksLikeHouseNumberQuery(queryInfo.q);

  // PRO autocomplete query:
  // 1) prefix match: name/street/city ILIKE 'query%' for instant typing
  // 2) full address prefix: name ILIKE 'taikos 32%'
  // 3) trigram similarity: name % query / street % query for typo tolerance
  // No unaccent() here because this DB does not expose the unaccent(text) function.
  // Lithuanian no-accent input is handled by expandLithuanianVariants() before SQL.
  const plainQ = stripLithuanian(queryInfo.q);
  const fullPrefixPatterns = uniq(
    expandLithuanianVariants(queryInfo.q)
      .map((item) => cleanText(item))
      .filter(Boolean)
      .map((item) => `${item}%`),
  );
  const lastToken = queryInfo.tokens[queryInfo.tokens.length - 1] || queryInfo.q;
  const tokenPrefixPatterns = uniq(
    expandLithuanianVariants(lastToken)
      .map((item) => cleanText(item))
      .filter(Boolean)
      .map((item) => `${item}%`),
  );
  const allPrefixPatterns = uniq([...fullPrefixPatterns, ...tokenPrefixPatterns]);

  const similarityNeedle = cleanText(
    expandLithuanianVariants(queryInfo.q)[0] || queryInfo.q,
  );
  const limitValue = Math.max(limit * 5, 30);

  const sql = `
    SELECT
      id::text AS id,
      CASE WHEN NULLIF(house_number, '') IS NOT NULL THEN 'address' ELSE 'street' END AS type,
      name::text AS name,
      city::text AS city,
      street::text AS street,
      house_number::text AS house_number,
      lat::double precision AS lat,
      lon::double precision AS lon,
      name::text AS q_prefix,
      1::int AS address_count,
      'postgres_addresses'::text AS source,
      GREATEST(
        similarity(COALESCE(name, ''), $2),
        similarity(COALESCE(street, ''), $2),
        similarity(COALESCE(city, ''), $2)
      ) AS trigram_score
    FROM public.addresses
    WHERE
      name ILIKE ANY($1::text[])
      OR street ILIKE ANY($1::text[])
      OR city ILIKE ANY($1::text[])
      OR name % $2
      OR street % $2
      OR city % $2
    ORDER BY
      CASE
        WHEN lower(name) = lower($2) THEN 0
        WHEN name ILIKE ANY($3::text[]) THEN 1
        WHEN street ILIKE ANY($3::text[]) THEN 2
        WHEN $4::boolean AND name ILIKE ANY($3::text[]) THEN 3
        WHEN name % $2 THEN 4
        WHEN street % $2 THEN 5
        ELSE 9
      END,
      trigram_score DESC,
      city NULLS LAST,
      street NULLS LAST,
      house_number NULLS LAST
    LIMIT $5
  `;

  const started = Date.now();
  const result = await pool.query(sql, [
    allPrefixPatterns,
    similarityNeedle || plainQ,
    fullPrefixPatterns.length ? fullPrefixPatterns : allPrefixPatterns,
    hasHouseNumber,
    limitValue,
  ]);
  lastQueryMs = Date.now() - started;
  return result.rows || [];
}

async function searchLocalAddresses(query, options = {}) {
  const queryInfo = buildPrefixSets(query);
  if (!queryInfo.q || queryInfo.q.length < 2) return [];

  const limit = Math.min(Math.max(Number(options.limit || 8), 1), 20);
  const cacheKey = `local-address:${PROVIDER_VERSION}:${queryInfo.q}:${limit}:${options.autocomplete ? "auto" : "search"}`;
  const cached = cacheGet(cacheKey);
  if (cached) return cached;

  try {
    const dbRows = await queryLookup(queryInfo, limit);
    const rows = [...dbRows, ...manualAliasRows(queryInfo)];
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

async function getLocalAddressDetails(placeId, options = {}) {
  const id = String(placeId || "")
    .replace(/^address-/, "")
    .trim();
  if (!id) return null;

  const manual = MANUAL_PLACE_ALIASES.find((item) => String(item.id) === id);
  if (manual) {
    const queryInfo = buildPrefixSets(manual.name || manual.city || id);
    return rowToResult(manual, queryInfo);
  }

  const cacheKey = `local-address-details:${PROVIDER_VERSION}:${id}`;
  const cached = cacheGet(cacheKey);
  if (cached) return cached;

  try {
    const result = await getPool().query(
      `SELECT id::text AS id,
              CASE WHEN NULLIF(house_number, '') IS NOT NULL THEN 'address' ELSE 'street' END AS type,
              name::text AS name,
              city::text AS city,
              street::text AS street,
              house_number::text AS house_number,
              lat::double precision AS lat,
              lon::double precision AS lon,
              name::text AS q_prefix,
              1::int AS address_count,
              'postgres_addresses'::text AS source
       FROM public.addresses
       WHERE id::text = $1
       LIMIT 1`,
      [id],
    );

    const row = result.rows?.[0];
    if (!row) return null;
    const queryInfo = buildPrefixSets(row.name || row.city || row.street || id);
    const mapped = rowToResult(row, queryInfo);
    cacheSet(cacheKey, mapped);
    lastDbError = null;
    return mapped;
  } catch (error) {
    lastDbError = error?.message || String(error);
    return null;
  }
}

async function refreshLookupCount() {
  if (Date.now() - lastHealthCheck < 30000) return lastLookupCount;
  lastHealthCheck = Date.now();
  try {
    const result = await getPool().query(
      "SELECT COUNT(*)::int AS count FROM public.addresses",
    );
    lastLookupCount = Number(result.rows?.[0]?.count || 0);
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
    postgresAddressCount: lastLookupCount,
    postgresAddressError: lastDbError,
    rcAddressProvider: true,
    rcAddressCount: lastLookupCount,
    rcAddressError: null,
    providerMode: "public.addresses_trigram",
    providerVersion: PROVIDER_VERSION,
    oneQueryPerRequest: true,
    dualPrefixFallback: true,
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
