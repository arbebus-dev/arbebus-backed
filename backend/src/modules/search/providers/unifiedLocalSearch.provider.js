const { getPool } = require("../../../db/pool");
const { toResult } = require("../utils/mapSearchResult");
const { normalizeText } = require("../utils/normalizeText");
const { searchLocalPoi, localPoiHealth } = require("./localPoi.provider");
const { searchGtfsStops, gtfsHealth } = require("./gtfsStops.provider");

/**
 * Arbebus Unified Local Search Engine.
 *
 * One local provider for instant Apple Maps style autocomplete:
 * - public.addresses              -> exact addresses / streets / house numbers
 * - public.adr_gyvenvietoves      -> settlements/districts such as Melnragė, Smiltynė, Giruliai
 * - local POI JSON provider       -> important places, ferries, districts, schools, etc.
 * - GTFS stops provider           -> transit stops, ranked lower unless user searches for a stop
 *
 * IMPORTANT: this provider does not require public.addresses.full_address and does not require unaccent().
 * It uses Postgres translate() for Lithuanian accent-insensitive matching.
 */

const PROVIDER_VERSION =
  "unified-local-search-v1-addresses-settlements-poi-stops";
const DEFAULT_LIMIT = 12;
const MAX_LIMIT = 30;
const CACHE_TTL_MS = Number(
  process.env.SEARCH_UNIFIED_LOCAL_CACHE_TTL_MS || 5 * 60 * 1000,
);
const MAX_CACHE_SIZE = Number(
  process.env.SEARCH_UNIFIED_LOCAL_CACHE_MAX || 3000,
);

const LT_FROM = "ąčęėįšųūžĄČĘĖĮŠŲŪŽ";
const LT_TO = "aceeisuuzACEEISUUZ";

const memoryCache = new Map();
const schemaCache = new Map();
let lastError = null;
let lastQueryMs = null;
let lastCounts = null;

const MANUAL_PLACES = [
  {
    id: "manual-settlement-melnrage",
    type: "settlement",
    title: "Melnragė",
    subtitle: "Klaipėda · Gyvenvietė",
    latitude: 55.7509,
    longitude: 21.0887,
    source: "manual_settlement",
    keywords: ["melnrage", "melnrages", "melnragės", "klaipeda"],
    priority: 620,
  },
  {
    id: "manual-settlement-smiltyne",
    type: "settlement",
    title: "Smiltynė",
    subtitle: "Klaipėda · Gyvenvietė",
    latitude: 55.7064,
    longitude: 21.1056,
    source: "manual_settlement",
    keywords: ["smiltyne", "smiltynė", "klaipeda", "keltas"],
    priority: 600,
  },
  {
    id: "manual-settlement-giruliai",
    type: "settlement",
    title: "Giruliai",
    subtitle: "Klaipėda · Gyvenvietė",
    latitude: 55.7833,
    longitude: 21.0833,
    source: "manual_settlement",
    keywords: ["giruliai", "klaipeda"],
    priority: 580,
  },
  {
    id: "manual-settlement-nida",
    type: "settlement",
    title: "Nida",
    subtitle: "Neringa · Gyvenvietė",
    latitude: 55.3039,
    longitude: 21.0058,
    source: "manual_settlement",
    keywords: ["nida", "neringa", "keltas"],
    priority: 560,
  },
];

function limitValue(value) {
  return Math.min(Math.max(Number(value || DEFAULT_LIMIT), 1), MAX_LIMIT);
}

function cacheGet(key) {
  const item = memoryCache.get(key);
  if (!item) return null;
  if (Date.now() > item.expiresAt) {
    memoryCache.delete(key);
    return null;
  }
  memoryCache.delete(key);
  memoryCache.set(key, item);
  return item.value;
}

function cacheSet(key, value) {
  memoryCache.set(key, { value, expiresAt: Date.now() + CACHE_TTL_MS });
  while (memoryCache.size > MAX_CACHE_SIZE) {
    const first = memoryCache.keys().next().value;
    if (!first) break;
    memoryCache.delete(first);
  }
}

function tokenise(query) {
  return normalizeText(query)
    .replace(/[^a-z0-9\s\-/]/g, " ")
    .split(/\s+/)
    .map((t) => t.trim())
    .filter(Boolean)
    .slice(0, 8);
}

function hasHouseNumber(value) {
  return /\d+[a-z]?([-/]\d+[a-z]?)?/i.test(String(value || ""));
}

function wantsStops(query) {
  return /\b(st|stotele|stotelė|stotis|autobus|bus)\b/i.test(
    String(query || ""),
  );
}

function normSql(expr) {
  return `translate(lower(COALESCE(${expr}::text, '')), $1, $2)`;
}

function textExpr(columns) {
  return columns.map((c) => `COALESCE(${c}::text, '')`).join(" || ' ' || ");
}

async function tableColumns(tableName) {
  if (schemaCache.has(tableName)) return schemaCache.get(tableName);
  try {
    const { rows } = await getPool().query(
      `SELECT column_name FROM information_schema.columns WHERE table_schema = 'public' AND table_name = $1`,
      [tableName],
    );
    const set = new Set(rows.map((r) => String(r.column_name)));
    schemaCache.set(tableName, set);
    return set;
  } catch (error) {
    lastError = error?.message || String(error);
    const empty = new Set();
    schemaCache.set(tableName, empty);
    return empty;
  }
}

function toSearchResult(input) {
  return toResult({
    ...input,
    latitude: input.latitude ?? input.lat ?? 55.7033,
    longitude: input.longitude ?? input.lon ?? 21.1443,
    selectable: input.selectable ?? true,
  });
}

function manualResults(qNorm, limit) {
  return MANUAL_PLACES.map((place) => {
    const fields = [place.title, place.subtitle, ...(place.keywords || [])]
      .map(normalizeText)
      .join(" ");
    let score = 0;
    if (fields === qNorm) score = 2000;
    else if (fields.startsWith(qNorm)) score = 1600;
    else if (fields.includes(qNorm)) score = 1200;
    else if (qNorm.includes(normalizeText(place.title))) score = 1000;
    return score > 0
      ? toSearchResult({ ...place, score: score + Number(place.priority || 0) })
      : null;
  })
    .filter(Boolean)
    .slice(0, limit);
}

function dedupe(items) {
  const seen = new Map();
  for (const item of items.filter(Boolean)) {
    const key = [
      normalizeText(item.title || item.name),
      normalizeText(item.subtitle || ""),
      Number(item.latitude).toFixed(5),
      Number(item.longitude).toFixed(5),
    ].join("|");
    const previous = seen.get(key);
    const power = Number(item.score || 0) + Number(item.priority || 0);
    const previousPower =
      Number(previous?.score || 0) + Number(previous?.priority || 0);
    if (!previous || power >= previousPower) seen.set(key, item);
  }
  return [...seen.values()];
}

async function searchAddresses(query, options = {}) {
  const columns = await tableColumns("addresses");
  if (!columns.has("name") || !columns.has("lat") || !columns.has("lon"))
    return [];

  const limit = limitValue(options.limit || DEFAULT_LIMIT);
  const qNorm = normalizeText(query);
  const tokens = tokenise(query);
  if (qNorm.length < 2 || !tokens.length) return [];

  const searchableColumns = [
    "name",
    "street",
    "house_number",
    "city",
    "postcode",
  ].filter((c) => columns.has(c));
  const combined = normSql(textExpr(searchableColumns));
  const tokenClauses = tokens
    .map((_, i) => `${combined} LIKE $${i + 5}`)
    .join(" AND ");
  const nameNorm = normSql("name");
  const streetNorm = columns.has("street") ? normSql("street") : "''";
  const cityNorm = columns.has("city") ? normSql("city") : "''";
  const houseExpr = columns.has("house_number") ? "house_number" : "NULL";
  const streetExpr = columns.has("street") ? "street" : "NULL";
  const cityExpr = columns.has("city") ? "city" : "NULL";
  const postcodeExpr = columns.has("postcode") ? "postcode" : "NULL";

  const values = [
    LT_FROM,
    LT_TO,
    `%${qNorm}%`,
    `${qNorm}%`,
    ...tokens.map((t) => `%${t}%`),
    limit,
  ];
  const limitParam = values.length;

  const sql = `
    SELECT
      id::text AS id,
      CASE WHEN NULLIF(TRIM(COALESCE(${houseExpr}::text, '')), '') IS NOT NULL THEN 'address' ELSE 'street' END AS type,
      name::text AS title,
      name::text AS name,
      ${streetExpr}::text AS street,
      ${houseExpr}::text AS house_number,
      ${cityExpr}::text AS city,
      ${postcodeExpr}::text AS postcode,
      lat::double precision AS latitude,
      lon::double precision AS longitude,
      'postgres_address' AS source,
      (
        CASE WHEN ${nameNorm} = $4 THEN 2600 ELSE 0 END +
        CASE WHEN ${nameNorm} LIKE $4 THEN 1800 ELSE 0 END +
        CASE WHEN ${streetNorm} LIKE $4 THEN 1200 ELSE 0 END +
        CASE WHEN ${nameNorm} LIKE $3 THEN 850 ELSE 0 END +
        CASE WHEN ${streetNorm} LIKE $3 THEN 650 ELSE 0 END +
        CASE WHEN ${cityNorm} LIKE $3 THEN 250 ELSE 0 END +
        CASE WHEN NULLIF(TRIM(COALESCE(${houseExpr}::text, '')), '') IS NOT NULL THEN ${hasHouseNumber(query) ? 900 : 250} ELSE 120 END +
        CASE WHEN ${cityNorm} LIKE '%klaiped%' THEN 120 ELSE 0 END
      )::int AS score
    FROM public.addresses
    WHERE lat IS NOT NULL
      AND lon IS NOT NULL
      AND (${nameNorm} LIKE $3 OR ${streetNorm} LIKE $3 OR ${cityNorm} LIKE $3 OR (${tokenClauses}))
    ORDER BY score DESC, name ASC
    LIMIT $${limitParam}
  `;

  const { rows } = await getPool().query(sql, values);
  return rows
    .map((row) =>
      toSearchResult({
        id: `address-${row.id}`,
        type: row.type,
        title: row.title,
        name: row.title,
        subtitle:
          row.type === "address"
            ? `${row.city || "Lietuva"} · Adresas`
            : `${row.city || "Lietuva"} · Gatvė`,
        latitude: row.latitude,
        longitude: row.longitude,
        source: row.source,
        category: row.type === "address" ? "Adresas" : "Gatvė",
        score: Number(row.score || 0),
        priority: row.type === "address" ? 900 : 650,
        keywords: [
          row.title,
          row.street,
          row.house_number,
          row.city,
          row.postcode,
        ].filter(Boolean),
      }),
    )
    .filter(Boolean);
}

async function searchSettlements(query, options = {}) {
  const columns = await tableColumns("adr_gyvenvietoves");
  if (!columns.size) return [];

  const nameCol = columns.has("VARDAS")
    ? '"VARDAS"'
    : columns.has("vardas")
      ? "vardas"
      : null;
  const nameKCol = columns.has("VARDAS_K")
    ? '"VARDAS_K"'
    : columns.has("vardas_k")
      ? "vardas_k"
      : nameCol;
  const typeCol = columns.has("TIPAS")
    ? '"TIPAS"'
    : columns.has("tipas")
      ? "tipas"
      : "NULL";
  const codeCol = columns.has("GYV_KODAS")
    ? '"GYV_KODAS"'
    : columns.has("gyv_kodas")
      ? "gyv_kodas"
      : null;
  if (!nameCol) return [];

  const limit = limitValue(options.limit || 8);
  const qNorm = normalizeText(query);
  const tokens = tokenise(query);
  if (qNorm.length < 2 || !tokens.length) return [];

  const combined = normSql(
    textExpr([nameCol, nameKCol, typeCol].filter(Boolean)),
  );
  const tokenClauses = tokens
    .map((_, i) => `${combined} LIKE $${i + 5}`)
    .join(" AND ");
  const displayName = `COALESCE(NULLIF(${nameKCol}::text, ''), ${nameCol}::text)`;
  const displayNorm = normSql(displayName);
  const values = [
    LT_FROM,
    LT_TO,
    `%${qNorm}%`,
    `${qNorm}%`,
    ...tokens.map((t) => `%${t}%`),
    limit,
  ];
  const limitParam = values.length;

  const sql = `
    SELECT
      ${codeCol ? `${codeCol}::text` : "md5(" + displayName + ")"} AS id,
      ${displayName} AS title,
      ${typeCol}::text AS settlement_type,
      55.7033::double precision AS latitude,
      21.1443::double precision AS longitude,
      (
        CASE WHEN ${displayNorm} = $4 THEN 1900 ELSE 0 END +
        CASE WHEN ${displayNorm} LIKE $4 THEN 1400 ELSE 0 END +
        CASE WHEN ${displayNorm} LIKE $3 THEN 850 ELSE 0 END +
        280
      )::int AS score
    FROM public.adr_gyvenvietoves
    WHERE ${displayNorm} LIKE $3 OR (${tokenClauses})
    ORDER BY score DESC, title ASC
    LIMIT $${limitParam}
  `;

  const { rows } = await getPool().query(sql, values);
  return rows
    .map((row) =>
      toSearchResult({
        id: `settlement-${row.id}`,
        type: "settlement",
        title: row.title,
        name: row.title,
        subtitle: `${row.settlement_type || "Lietuva"} · Gyvenvietė`,
        latitude: row.latitude,
        longitude: row.longitude,
        source: "rc_settlement",
        category: "Gyvenvietė",
        score: Number(row.score || 0),
        priority: 520,
        keywords: [row.title, row.settlement_type].filter(Boolean),
      }),
    )
    .filter(Boolean);
}

async function searchDbPoi(query, options = {}) {
  const columns = await tableColumns("poi");
  if (!columns.size) return [];

  const titleCol = ["name", "title", "pavadinimas"].find((c) => columns.has(c));
  const latCol = ["lat", "latitude"].find((c) => columns.has(c));
  const lonCol = ["lon", "lng", "longitude"].find((c) => columns.has(c));
  if (!titleCol || !latCol || !lonCol) return [];

  const subtitleCol = [
    "subtitle",
    "address",
    "description",
    "category",
    "type",
  ].find((c) => columns.has(c));
  const typeCol = ["type", "category"].find((c) => columns.has(c));
  const idCol = ["id", "poi_id"].find((c) => columns.has(c));
  const limit = limitValue(options.limit || 8);
  const qNorm = normalizeText(query);
  const tokens = tokenise(query);
  if (qNorm.length < 2 || !tokens.length) return [];

  const searchable = [titleCol, subtitleCol, typeCol].filter(Boolean);
  const combined = normSql(textExpr(searchable));
  const tokenClauses = tokens
    .map((_, i) => `${combined} LIKE $${i + 5}`)
    .join(" AND ");
  const titleNorm = normSql(titleCol);
  const values = [
    LT_FROM,
    LT_TO,
    `%${qNorm}%`,
    `${qNorm}%`,
    ...tokens.map((t) => `%${t}%`),
    limit,
  ];
  const limitParam = values.length;

  const sql = `
    SELECT
      ${idCol ? `${idCol}::text` : `md5(${titleCol}::text)`} AS id,
      ${titleCol}::text AS title,
      ${subtitleCol ? `${subtitleCol}::text` : "''"} AS subtitle,
      ${typeCol ? `${typeCol}::text` : "'poi'"} AS poi_type,
      ${latCol}::double precision AS latitude,
      ${lonCol}::double precision AS longitude,
      (
        CASE WHEN ${titleNorm} = $4 THEN 1400 ELSE 0 END +
        CASE WHEN ${titleNorm} LIKE $4 THEN 950 ELSE 0 END +
        CASE WHEN ${titleNorm} LIKE $3 THEN 650 ELSE 0 END +
        180
      )::int AS score
    FROM public.poi
    WHERE ${latCol} IS NOT NULL
      AND ${lonCol} IS NOT NULL
      AND (${titleNorm} LIKE $3 OR (${tokenClauses}))
    ORDER BY score DESC, title ASC
    LIMIT $${limitParam}
  `;

  const { rows } = await getPool().query(sql, values);
  return rows
    .map((row) =>
      toSearchResult({
        id: `poi-${row.id}`,
        type: "poi",
        title: row.title,
        subtitle: row.subtitle || "Vieta",
        latitude: row.latitude,
        longitude: row.longitude,
        source: "postgres_poi",
        category: row.poi_type || "poi",
        score: Number(row.score || 0),
        priority: 420,
        keywords: [row.title, row.subtitle, row.poi_type].filter(Boolean),
      }),
    )
    .filter(Boolean);
}

function boostAndSort(items, query) {
  const qNorm = normalizeText(query);
  const queryHasHouseNumber = hasHouseNumber(query);
  const stopIntent = wantsStops(query);

  return items
    .map((item) => {
      const type = String(item.type || "").toLowerCase();
      const source = String(item.source || "").toLowerCase();
      const title = normalizeText(item.title || item.name || "");
      const subtitle = normalizeText(item.subtitle || "");
      let score = Number(item.score || 0) + Number(item.priority || 0);

      if (title === qNorm) score += 2400;
      if (title.startsWith(qNorm)) score += 1200;
      if (`${title} ${subtitle}`.includes(qNorm)) score += 650;

      if (queryHasHouseNumber) {
        if (type === "address") score += 4000;
        if (type === "street") score += 800;
        if (type === "stop") score -= 2500;
        if (type === "poi") score -= 200;
      } else {
        if (type === "settlement" || type === "city" || type === "village")
          score += 500;
        if (type === "address") score += 350;
        if (type === "street") score += 450;
        if (type === "poi") score += 220;
        if (type === "stop") score += stopIntent ? 900 : -250;
      }

      if (source.includes("postgres_address")) score += 500;
      if (source.includes("manual_settlement")) score += 650;
      if (source.includes("local_poi")) score += 220;

      return { ...item, score };
    })
    .sort((a, b) => Number(b.score || 0) - Number(a.score || 0));
}

async function searchUnifiedLocal(query, options = {}) {
  const startedAt = Date.now();
  const qNorm = normalizeText(query);
  const limit = limitValue(options.limit || DEFAULT_LIMIT);
  if (!qNorm || qNorm.length < 2) return [];

  const cacheKey = `unified:${PROVIDER_VERSION}:${qNorm}:${limit}:${options.autocomplete ? "a" : "s"}`;
  const cached = cacheGet(cacheKey);
  if (cached) return cached;

  try {
    const queryHasHouseNumber = hasHouseNumber(query);
    const stopIntent = wantsStops(query);

    const [addresses, settlements, dbPoi, localPoi, stops] = await Promise.all([
      searchAddresses(query, {
        limit: queryHasHouseNumber
          ? Math.max(limit * 2, 18)
          : Math.max(limit, 12),
      }),
      searchSettlements(query, { limit: 8 }),
      searchDbPoi(query, { limit: 8 }),
      searchLocalPoi(query, { limit: 8 }).catch(() => []),
      searchGtfsStops(query, { limit: stopIntent ? 10 : 4 }).catch(() => []),
    ]);

    const manual = manualResults(qNorm, 6);
    const combined = dedupe([
      ...manual,
      ...addresses,
      ...settlements,
      ...dbPoi,
      ...localPoi,
      ...stops,
    ]);

    const ranked = boostAndSort(combined, query).slice(0, limit);
    lastQueryMs = Date.now() - startedAt;
    lastError = null;
    cacheSet(cacheKey, ranked);
    return ranked;
  } catch (error) {
    lastError = error?.message || String(error);
    lastQueryMs = Date.now() - startedAt;
    return [];
  }
}

async function getUnifiedLocalDetails(id) {
  const raw = String(id || "");
  const match = raw.match(/^address-(\d+)$/);
  if (!match) return null;
  try {
    const { rows } = await getPool().query(
      `SELECT id::text, name, street, house_number, city, postcode, lat::double precision AS latitude, lon::double precision AS longitude
       FROM public.addresses WHERE id = $1 LIMIT 1`,
      [match[1]],
    );
    const row = rows[0];
    if (!row) return null;
    return toSearchResult({
      id: `address-${row.id}`,
      type: row.house_number ? "address" : "street",
      title: row.name,
      subtitle: row.house_number
        ? `${row.city || "Lietuva"} · Adresas`
        : `${row.city || "Lietuva"} · Gatvė`,
      latitude: row.latitude,
      longitude: row.longitude,
      source: "postgres_address",
      category: row.house_number ? "Adresas" : "Gatvė",
      score: 1000,
      keywords: [
        row.name,
        row.street,
        row.house_number,
        row.city,
        row.postcode,
      ].filter(Boolean),
    });
  } catch (error) {
    lastError = error?.message || String(error);
    return null;
  }
}

async function refreshCounts() {
  try {
    const { rows } = await getPool().query(`
      SELECT 'addresses' AS table_name, COUNT(*)::int AS count FROM public.addresses
      UNION ALL
      SELECT 'adr_gyvenvietoves', COUNT(*)::int FROM public.adr_gyvenvietoves
      UNION ALL
      SELECT 'poi', COUNT(*)::int FROM public.poi
    `);
    lastCounts = rows.reduce((acc, row) => {
      acc[row.table_name] = Number(row.count || 0);
      return acc;
    }, {});
  } catch (error) {
    lastError = error?.message || String(error);
  }
}

function unifiedLocalHealth() {
  refreshCounts().catch(() => undefined);
  return {
    unifiedLocalSearchProvider: true,
    unifiedLocalSearchVersion: PROVIDER_VERSION,
    unifiedLocalSearchSources: [
      "public.addresses",
      "public.adr_gyvenvietoves",
      "public.poi",
      "local_poi_json",
      "gtfs_stops",
    ],
    unifiedLocalSearchCounts: lastCounts,
    unifiedLocalSearchLastQueryMs: lastQueryMs,
    unifiedLocalSearchLastError: lastError,
    unifiedLocalSearchMemoryCache: memoryCache.size,
    unifiedLocalSearchRequiresFullAddressColumn: false,
    unifiedLocalSearchRequiresUnaccentExtension: false,
    localPoi: localPoiHealth(),
    gtfs: gtfsHealth(),
  };
}

module.exports = {
  searchUnifiedLocal,
  getUnifiedLocalDetails,
  unifiedLocalHealth,
};
