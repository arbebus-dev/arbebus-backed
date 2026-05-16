const { normalizeText } = require("./utils/normalizeText");
const { rankResults, dedupeResults } = require("./utils/rankSearchResults");
const { getCache, setCache, cacheStats } = require("./cache/searchCache");
const {
  searchLocalPoi,
  localPoiHealth,
} = require("./providers/localPoi.provider");
const {
  searchNominatim,
  reverseNominatim,
} = require("./providers/nominatim.provider");
const { searchOverpass } = require("./providers/overpass.provider");
const {
  searchGooglePlaces,
  getGooglePlaceDetails,
  searchNearbyGooglePlaces,
  getGooglePhotoMediaUrl,
} = require("./providers/googlePlaces.provider");
const {
  searchGtfsStops,
  gtfsHealth,
  loadGtfsStops,
} = require("./providers/gtfsStops.provider");
const { searchFastIndex, searchIndexHealth } = require("./index/searchIndex");
const {
  searchLocalAddresses,
  getLocalAddressDetails,
  localAddressHealth,
} = require("./providers/localAddress.provider");
const { searchMeili, meiliHealth } = require("./providers/meili.provider");
const { getPool } = require("../../db/pool");

const DEFAULT_LIMIT = 12;
const MAX_LIMIT = 30;

const FAST_INDEX_TIMEOUT_MS = Number(
  process.env.SEARCH_FAST_INDEX_TIMEOUT_MS || 120,
);

const LOCAL_ADDRESS_TIMEOUT_MS = Number(
  process.env.SEARCH_LOCAL_ADDRESS_TIMEOUT_MS || 1200,
);

const RC_ADDRESS_TIMEOUT_MS = Number(
  process.env.SEARCH_RC_ADDRESS_TIMEOUT_MS || 900,
);

const MEILI_TIMEOUT_MS = Number(process.env.MEILI_TIMEOUT_MS || 1200);

function limitValue(value) {
  return Math.min(Math.max(Number(value || DEFAULT_LIMIT), 1), MAX_LIMIT);
}

function envBool(name, fallback = false) {
  const v = process.env[name];
  if (v == null || v === "") return fallback;
  return String(v).toLowerCase() === "true";
}

async function runProvider(name, fn, timeoutMs = 1600) {
  let timer = null;

  try {
    const timeout = new Promise((_, reject) => {
      timer = setTimeout(
        () => reject(new Error(`provider timeout ${timeoutMs}ms`)),
        timeoutMs,
      );
    });

    const results = await Promise.race([Promise.resolve().then(fn), timeout]);

    return {
      name,
      ok: true,
      results: Array.isArray(results) ? results : [],
      error: null,
    };
  } catch (error) {
    return {
      name,
      ok: false,
      results: [],
      error: error?.message || String(error),
    };
  } finally {
    if (timer) clearTimeout(timer);
  }
}

function searchCacheKey(q, type, limit, query = {}) {
  const lat = Number(query.lat ?? query.latitude);
  const lon = Number(query.lon ?? query.lng ?? query.longitude);

  const locationBucket =
    Number.isFinite(lat) && Number.isFinite(lon)
      ? `${lat.toFixed(2)},${lon.toFixed(2)}`
      : "no-gps";

  return `v16:${normalizeText(q)}:${String(type || "all").toLowerCase()}:${Number(
    limit || DEFAULT_LIMIT,
  )}:${locationBucket}`;
}

function hasHouseNumberQuery(value = "") {
  return /\b\d+[a-z]?\b/i.test(String(value || ""));
}

function isAddressLikeQuery(value = "") {
  const q = String(value || "").trim();

  return (
    /\d/.test(q) ||
    /\b(g|g\.|gatv[eė]|pr|pr\.|prospektas|al|al\.|pl|pl\.|kelias)\b/i.test(q) ||
    q.split(/\s+/).length >= 2
  );
}

function isStreetOnlyQuery(value = "") {
  return isAddressLikeQuery(value) && !hasHouseNumberQuery(value);
}

function isLikelyStreetQuery(value = "") {
  const q = normalizeText(value).trim();

  if (q.length < 3) return false;
  if (hasHouseNumberQuery(q)) return true;

  return /^[a-ząčęėįšųūž\s.-]+$/i.test(q);
}

function shouldUseExternalSearch(query = {}) {
  const explicit = String(
    query.external ?? query.includeExternal ?? "",
  ).toLowerCase();

  if (explicit === "false" || explicit === "0") return false;
  if (explicit === "true" || explicit === "1") return true;

  return envBool("SEARCH_EXTERNAL_ENABLED", true);
}

function filterUnsafeSearchResults(items, query) {
  const streetOnly = isStreetOnlyQuery(query) || isLikelyStreetQuery(query);
  const addressWithNumber = hasHouseNumberQuery(query);

  if (!streetOnly && !addressWithNumber) return items;

  return items.filter((item) => {
    const type = String(item.type || "").toLowerCase();

    if (["city", "region", "village"].includes(type)) return false;

    if (
      type === "stop" &&
      !/\b(st|stotele|stotis|bus|autobus)\b/i.test(String(query))
    ) {
      return false;
    }

    if (streetOnly) {
      return ["street", "address", "poi", "station", "ferry"].includes(type);
    }

    if (addressWithNumber) {
      return ["address", "street", "poi", "station", "ferry"].includes(type);
    }

    return true;
  });
}

function forceExactAddressPriority(items, query) {
  const qHasNumber = hasHouseNumberQuery(query);
  if (!qHasNumber) return items;

  return [...items].sort((a, b) => {
    const aType = String(a.type || "").toLowerCase();
    const bType = String(b.type || "").toLowerCase();
    const aSource = String(a.source || "").toLowerCase();
    const bSource = String(b.source || "").toLowerCase();

    const power = (item, type, source) => {
      let value = Number(item.score || 0);

      if (type === "address") value += 7000;
      if (source === "postgres_address") value += 6000;
      if (source === "google_geocoding") value += 2500;
      if (source === "nominatim") value += 900;
      if (type === "street") value -= 1500;
      if (type === "stop") value -= 2500;
      if (item.selectable === false || item.requiresHouseNumber === true) {
        value -= 3000;
      }

      return value;
    };

    return power(b, bType, bSource) - power(a, aType, aSource);
  });
}

function compactProviderMeta(providers) {
  return providers.map((p) => ({
    name: p.name,
    ok: p.ok,
    count: p.results.length,
    error: p.error,
  }));
}

let lastRcAddressError = null;
let lastRcAddressCount = null;
let lastRcAddressHealthCheck = 0;

const LT_FROM = "ĄČĘĖĮŠŲŪŽąčęėįšųūž";
const LT_TO = "ACEEISUUZaceeisuuz";
const NORMALIZE_SQL = (column) => `lower(translate(COALESCE(${column}, ''), '${LT_FROM}', '${LT_TO}'))`;

function parseQueryParts(value = "") {
  const raw = String(value || "").trim();
  const normalized = normalizeText(raw)
    .replace(/\./g, " ")
    .replace(/\s+/g, " ")
    .trim();

  const houseMatch = normalized.match(/\b(\d+[a-zA-Z]?)\b/);
  const house = houseMatch ? houseMatch[1].toUpperCase() : null;

  const cityHints = [
    { keys: ["klaipeda", "klaipedos"], pattern: "klaip%", city: "Klaipėda" },
    { keys: ["gargzdai", "gargzdu"], pattern: "gargzd%", city: "Gargždai" },
    { keys: ["palanga", "palangos"], pattern: "palang%", city: "Palanga" },
    { keys: ["vilnius", "vilniaus"], pattern: "viln%", city: "Vilnius" },
    { keys: ["kaunas", "kauno"], pattern: "kaun%", city: "Kaunas" },
    { keys: ["siauliai", "siauliu"], pattern: "siaul%", city: "Šiauliai" },
    { keys: ["panevezys", "panevezio"], pattern: "panevez%", city: "Panevėžys" },
    { keys: ["kretinga", "kretingos"], pattern: "kreting%", city: "Kretinga" },
    { keys: ["neringa", "neringos"], pattern: "nering%", city: "Neringa" },
    { keys: ["nida", "nidos"], pattern: "nida%", city: "Nida" },
    { keys: ["priekule", "priekules"], pattern: "priekul%", city: "Priekulė" },
  ];

  const cityHint =
    cityHints.find((item) => item.keys.some((key) => normalized.includes(key))) ||
    { pattern: "klaip%", city: "Klaipėda", keys: [] };

  let streetText = normalized
    .replace(/\b\d+[a-zA-Z]?\b/g, " ")
    .replace(/\b(g|gatve|pr|prospektas|pl|plentas|al|aleja|kelias)\b/g, " ");

  for (const city of cityHints) {
    for (const key of city.keys) {
      streetText = streetText.replace(new RegExp(`\\b${key}\\b`, "g"), " ");
    }
  }

  streetText = streetText.replace(/\s+/g, " ").trim();

  const tokens = normalized
    .split(/\s+/)
    .map((item) => item.trim())
    .filter((item) => item.length >= 2 && !/^\d/.test(item))
    .slice(0, 6);

  return { raw, normalized, house, streetText: streetText || tokens[0] || normalized, tokens, cityHint };
}

function lks94ToWgs84(x, y) {
  const easting = Number(x);
  const northing = Number(y);

  if (!Number.isFinite(easting) || !Number.isFinite(northing)) return null;

  // Already WGS84.
  if (
    northing >= 53 &&
    northing <= 57 &&
    easting >= 20 &&
    easting <= 27
  ) {
    return { latitude: northing, longitude: easting };
  }

  // Lithuanian LKS94 / EPSG:3346 to WGS84.
  // Formula implemented locally so production search does not depend on proj4.
  const a = 6378137.0;
  const f = 1 / 298.257222101;
  const k0 = 0.9998;
  const lon0 = (24 * Math.PI) / 180;
  const falseEasting = 500000.0;

  const e2 = 2 * f - f * f;
  const e1 = (1 - Math.sqrt(1 - e2)) / (1 + Math.sqrt(1 - e2));

  const xAdj = easting - falseEasting;
  const m = northing / k0;
  const mu =
    m /
    (a *
      (1 -
        e2 / 4 -
        (3 * e2 * e2) / 64 -
        (5 * e2 * e2 * e2) / 256));

  const j1 = (3 * e1) / 2 - (27 * Math.pow(e1, 3)) / 32;
  const j2 = (21 * e1 * e1) / 16 - (55 * Math.pow(e1, 4)) / 32;
  const j3 = (151 * Math.pow(e1, 3)) / 96;
  const j4 = (1097 * Math.pow(e1, 4)) / 512;

  const fp =
    mu +
    j1 * Math.sin(2 * mu) +
    j2 * Math.sin(4 * mu) +
    j3 * Math.sin(6 * mu) +
    j4 * Math.sin(8 * mu);

  const sinFp = Math.sin(fp);
  const cosFp = Math.cos(fp);
  const tanFp = Math.tan(fp);

  const ep2 = e2 / (1 - e2);
  const c1 = ep2 * cosFp * cosFp;
  const t1 = tanFp * tanFp;
  const n1 = a / Math.sqrt(1 - e2 * sinFp * sinFp);
  const r1 = (a * (1 - e2)) / Math.pow(1 - e2 * sinFp * sinFp, 1.5);
  const d = xAdj / (n1 * k0);

  const q1 = d * d / 2;
  const q2 =
    ((5 + 3 * t1 + 10 * c1 - 4 * c1 * c1 - 9 * ep2) * Math.pow(d, 4)) /
    24;
  const q3 =
    ((61 +
      90 * t1 +
      298 * c1 +
      45 * t1 * t1 -
      252 * ep2 -
      3 * c1 * c1) *
      Math.pow(d, 6)) /
    720;

  const lat =
    fp -
    ((n1 * tanFp) / r1) *
      (q1 - q2 + q3);

  const q4 = d;
  const q5 = ((1 + 2 * t1 + c1) * Math.pow(d, 3)) / 6;
  const q6 =
    ((5 -
      2 * c1 +
      28 * t1 -
      3 * c1 * c1 +
      8 * ep2 +
      24 * t1 * t1) *
      Math.pow(d, 5)) /
    120;

  const lon = lon0 + (q4 - q5 + q6) / cosFp;

  const latitude = (lat * 180) / Math.PI;
  const longitude = (lon * 180) / Math.PI;

  if (
    !Number.isFinite(latitude) ||
    !Number.isFinite(longitude) ||
    latitude < 53 ||
    latitude > 57 ||
    longitude < 20 ||
    longitude > 27
  ) {
    return null;
  }

  return { latitude, longitude };
}

function rcAddressToResult(row, query) {
  const converted = lks94ToWgs84(row.lon, row.lat);
  if (!converted) return null;

  const title =
    row.name ||
    [row.street, row.house_number].filter(Boolean).join(" ") ||
    "Adresas";

  const exactHouse = hasHouseNumberQuery(query);

  return {
    id: `address-rc-${row.id}`,
    placeId: `address-rc-${row.id}`,
    type: exactHouse ? "address" : "street",
    title,
    name: title,
    subtitle: [row.city, row.postcode].filter(Boolean).join(", ") || "Adresas",
    latitude: converted.latitude,
    longitude: converted.longitude,
    coordinate: converted,
    source: "postgres_rc_address",
    category: "Adresas",
    priority: exactHouse ? 340 : 220,
    score: Number(row.rank_score || 0),
    selectable: exactHouse,
    requiresHouseNumber: !exactHouse,
    keywords: [
      row.name,
      row.street,
      row.house_number,
      row.city,
      row.postcode,
    ].filter(Boolean),
  };
}

async function searchRcAddresses(query, options = {}) {
  const q = String(query || "").trim();
  const parsed = parseQueryParts(q);
  if (parsed.normalized.length < 2 || parsed.streetText.length < 2) return [];

  const limit = Math.min(Math.max(Number(options.limit || 8), 1), 20);
  const pool = getPool();
  const streetNorm = NORMALIZE_SQL("street");
  const cityNorm = NORMALIZE_SQL("city");
  const streetPrefix = parsed.streetText.slice(0, 80);
  const cityPattern = parsed.cityHint?.pattern || "klaip%";

  const params = [streetPrefix, cityPattern];
  let sql;

  if (parsed.house) {
    params.push(parsed.house, limit);
    sql = `
      SELECT id, name, street, house_number, city, postcode, lat, lon,
        (
          CASE WHEN ${cityNorm} LIKE $2 THEN 120000 ELSE 0 END +
          CASE WHEN upper(house_number) = upper($3) THEN 90000 ELSE 0 END +
          CASE WHEN upper(house_number) LIKE upper($3) || '%' THEN 25000 ELSE 0 END +
          CASE WHEN ${streetNorm} = $1 THEN 20000 ELSE 0 END +
          CASE WHEN ${streetNorm} LIKE $1 || '%' THEN 15000 ELSE 0 END
        ) AS rank_score
      FROM public.addresses_rc_import
      WHERE ${streetNorm} LIKE $1 || '%'
        AND ${cityNorm} LIKE $2
        AND upper(house_number) LIKE upper($3) || '%'
      ORDER BY rank_score DESC, city ASC, street ASC, house_number ASC
      LIMIT $4
    `;
  } else {
    params.push(limit);
    sql = `
      WITH street_candidates AS (
        SELECT DISTINCT ON (${streetNorm}, ${cityNorm})
          id, name, street, NULL::text AS house_number, city, postcode, lat, lon,
          (
            CASE WHEN ${cityNorm} LIKE $2 THEN 120000 ELSE 0 END +
            CASE WHEN ${streetNorm} = $1 THEN 20000 ELSE 0 END +
            CASE WHEN ${streetNorm} LIKE $1 || '%' THEN 15000 ELSE 0 END
          ) AS rank_score
        FROM public.addresses_rc_import
        WHERE ${streetNorm} LIKE $1 || '%'
          AND ${cityNorm} LIKE $2
        ORDER BY ${streetNorm}, ${cityNorm}, rank_score DESC, id ASC
        LIMIT $3
      )
      SELECT * FROM street_candidates
      ORDER BY rank_score DESC, city ASC, street ASC
    `;
  }

  try {
    const result = await pool.query(sql, params);
    lastRcAddressError = null;

    return result.rows
      .map((row) => rcAddressToResult(row, q))
      .filter(Boolean);
  } catch (error) {
    lastRcAddressError = error?.message || String(error);
    return [];
  }
}

async function getRcAddressDetails(placeId) {
  const rawId = String(placeId || "").replace(/^address-rc-/, "").trim();
  if (!rawId) return null;

  try {
    const result = await getPool().query(
      `
      SELECT id, name, street, house_number, city, postcode, lat, lon
      FROM public.addresses_rc_import
      WHERE id::text = $1
      LIMIT 1
      `,
      [rawId],
    );

    const row = result.rows?.[0];
    if (!row) return null;

    lastRcAddressError = null;
    return rcAddressToResult(row, row.name || "");
  } catch (error) {
    lastRcAddressError = error?.message || String(error);
    return null;
  }
}

async function refreshRcAddressCount() {
  if (Date.now() - lastRcAddressHealthCheck < 30000) return lastRcAddressCount;
  lastRcAddressHealthCheck = Date.now();

  try {
    const result = await getPool().query(
      "SELECT COUNT(*)::int AS count FROM public.addresses_rc_import",
    );
    lastRcAddressCount = Number(result.rows?.[0]?.count || 0);
    lastRcAddressError = null;
  } catch (error) {
    lastRcAddressError = error?.message || String(error);
  }

  return lastRcAddressCount;
}

function rcAddressHealth() {
  refreshRcAddressCount().catch(() => undefined);

  return {
    rcAddressProvider: true,
    rcAddressCount: lastRcAddressCount,
    rcAddressError: lastRcAddressError,
  };
}

async function index(query = {}) {
  const startedAt = Date.now();

  const q = String(
    query.q || query.query || query.text || query.search || "",
  ).trim();

  const type = String(query.type || "all").toLowerCase();
  const limit = limitValue(query.limit);
  const nq = normalizeText(q);

  if (nq.length < 2) {
    return {
      ok: true,
      query: q,
      count: 0,
      results: [],
      places: [],
      stops: [],
      addresses: [],
      meta: healthMeta(),
    };
  }

  const cacheKey = searchCacheKey(q, type, limit, query);
  const cached = await getCache(cacheKey);

  if (cached) {
    return {
      ...cached,
      meta: {
        ...(cached.meta || {}),
        cached: true,
        tookMs: Date.now() - startedAt,
      },
    };
  }

  const addressLike = isAddressLikeQuery(q);
  const streetLike = isLikelyStreetQuery(q);
  const includeExternal = shouldUseExternalSearch(query);

  // Instant Search PRO: address/street typing must not wait for POI/GTFS/Google/OSM.
  // It uses prefix-indexed official local address tables first and returns immediately.
  if (addressLike || streetLike) {
    const localAddress = await runProvider(
      "local_address",
      () =>
        searchLocalAddresses(q, {
          limit: Math.max(8, limit),
          lat: query.lat ?? query.latitude,
          lon: query.lon ?? query.lng ?? query.longitude,
        }),
      LOCAL_ADDRESS_TIMEOUT_MS,
    );

    const rcAddress = localAddress.results.length
      ? { name: "rc_address", ok: true, results: [], error: null }
      : await runProvider(
          "rc_address",
          () => searchRcAddresses(q, { limit: Math.max(8, limit) }),
          RC_ADDRESS_TIMEOUT_MS,
        );

    const officialAddressResults = [...localAddress.results, ...rcAddress.results];
    const localOnlyResults = forceExactAddressPriority(
      dedupeResults(rankResults(officialAddressResults, q)),
      q,
    ).slice(0, limit);

    const payload = {
      ok: true,
      query: q,
      count: localOnlyResults.length,
      results: localOnlyResults,
      places: localOnlyResults,
      stops: [],
      addresses: localOnlyResults.filter((item) => item.type === "address"),
      meta: {
        ...healthMeta(),
        cached: false,
        instant: true,
        autocomplete: String(query.autocomplete || query.mode || "").toLowerCase().includes("autocomplete"),
        externalEnabled: includeExternal,
        externalSkipped: true,
        addressLocalFirst: true,
        strictLocalAddressOnly: true,
        tookMs: Date.now() - startedAt,
        providers: compactProviderMeta([localAddress, rcAddress]),
      },
    };

    await setCache(cacheKey, payload, 180);
    return payload;
  }

  const [fastIndex, localPoi, gtfsStops, meili] = await Promise.all([
    runProvider(
      "fast_local_index",
      () => searchFastIndex(q, { limit: Math.max(18, limit) }),
      FAST_INDEX_TIMEOUT_MS,
    ),
    runProvider("local_poi", () => searchLocalPoi(q, { limit: Math.max(8, limit) }), 250),
    runProvider("gtfs_stops", () => searchGtfsStops(q, { limit: Math.max(8, limit) }), 250),
    runProvider(
      "meilisearch",
      () => searchMeili(q, { limit: Math.max(12, limit) }),
      MEILI_TIMEOUT_MS,
    ),
  ]);

  let combined = [
    ...localPoi.results,
    ...gtfsStops.results,
    ...meili.results,
    ...fastIndex.results,
  ];

  const providers = [localPoi, gtfsStops, meili, fastIndex];
  const rankedFast = rankResults(dedupeResults(combined), q);
  const hasStrongFastResult = rankedFast.some((item) => Number(item.score || 0) >= 360);

  if (includeExternal && !hasStrongFastResult) {
    const [google, nominatim, overpass] = await Promise.all([
      runProvider("google_places", () => searchGooglePlaces(q, { limit: 8 }), 4500),
      runProvider("nominatim", () => searchNominatim(q, { limit: 8 }), 4500),
      runProvider("overpass", () => searchOverpass(q, { limit: 6 }), 2500),
    ]);

    providers.push(google, nominatim, overpass);
    combined = [
      ...combined,
      ...google.results.map((item) => ({ ...item, photoUrls: undefined, photos: undefined })),
      ...nominatim.results,
      ...overpass.results,
    ];
  }

  if (type !== "all") {
    combined = combined.filter((item) => item.type === type);
  }

  const ranked = rankResults(dedupeResults(combined), q);
  const safeRanked = filterUnsafeSearchResults(ranked, q);
  const priorityRanked = forceExactAddressPriority(safeRanked, q);
  const results = dedupeResults(priorityRanked).slice(0, limit);

  const payload = {
    ok: true,
    query: q,
    count: results.length,
    results,
    places: results.filter((item) => item.type !== "stop"),
    stops: results.filter((item) => item.type === "stop"),
    addresses: results.filter((item) => item.type === "address"),
    meta: {
      ...healthMeta(),
      cached: false,
      instant: true,
      externalEnabled: includeExternal,
      externalSkipped: !includeExternal || hasStrongFastResult,
      tookMs: Date.now() - startedAt,
      providers: compactProviderMeta(providers),
    },
  };

  await setCache(cacheKey, payload, 300);
  return payload;
}

async function debug(query = {}) {
  const payload = await index({ ...query, limit: query.limit || 20 });

  return {
    ...payload,
    debug: {
      firstType: payload.results[0]?.type || null,
      firstSource: payload.results[0]?.source || null,
      expectedPriority:
        "postgres_address > exact local_poi > google/nominatim/overpass > gtfs stop fallback",
    },
  };
}

async function stops(query = {}) {
  const q = String(
    query.q || query.query || query.text || query.search || "",
  ).trim();

  const results = await searchGtfsStops(q, { limit: limitValue(query.limit) });

  return {
    ok: true,
    query: q,
    count: results.length,
    results,
    places: results,
    stops: results,
    meta: healthMeta(),
  };
}

function healthMeta() {
  return {
    module: "dynamic_search",
    env: {
      ORS_API_KEY: Boolean(process.env.ORS_API_KEY),
      GOOGLE_PLACES_API_KEY: Boolean(process.env.GOOGLE_PLACES_API_KEY),
      SEARCH_PROVIDER_GOOGLE_ACTIVE:
        Boolean(process.env.GOOGLE_PLACES_API_KEY) &&
        String(
          process.env.SEARCH_PROVIDER_GOOGLE_ENABLED || "true",
        ).toLowerCase() !== "false",
      SEARCH_PROVIDER_OSM_ENABLED: envBool("SEARCH_PROVIDER_OSM_ENABLED", true),
      SEARCH_PROVIDER_OVERPASS_ENABLED: envBool(
        "SEARCH_PROVIDER_OVERPASS_ENABLED",
        true,
      ),
      SEARCH_PROVIDER_GOOGLE_ENABLED: envBool(
        "SEARCH_PROVIDER_GOOGLE_ENABLED",
        false,
      ),
      SEARCH_CACHE_TTL_SECONDS: process.env.SEARCH_CACHE_TTL_SECONDS || "86400",
      SEARCH_REGION_LAT: process.env.SEARCH_REGION_LAT || "55.7033",
      SEARCH_REGION_LNG: process.env.SEARCH_REGION_LNG || "21.1443",
      SEARCH_REGION_RADIUS_METERS:
        process.env.SEARCH_REGION_RADIUS_METERS || "55000",
      SEARCH_LOCAL_ADDRESS_TIMEOUT_MS: String(LOCAL_ADDRESS_TIMEOUT_MS),
      SEARCH_RC_ADDRESS_TIMEOUT_MS: String(RC_ADDRESS_TIMEOUT_MS),
    },
    ...localAddressHealth(),
    ...rcAddressHealth(),
    ...localPoiHealth(),
    ...gtfsHealth(),
    ...searchIndexHealth(),
    meiliConfigured: Boolean(
      process.env.MEILI_HOST || process.env.SEARCH_ENGINE,
    ),
    meili: meiliHealth(),
    cache: cacheStats(),
  };
}

async function reverse(query = {}) {
  const latitude = Number(query.lat ?? query.latitude);
  const longitude = Number(query.lng ?? query.lon ?? query.longitude);

  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
    return {
      ok: false,
      error: "lat/lng required",
      place: null,
      result: null,
      meta: healthMeta(),
    };
  }

  const fallback = {
    id: `map-${latitude.toFixed(6)}-${longitude.toFixed(6)}`,
    type: "address",
    title: "Pasirinkta vieta",
    name: "Pasirinkta vieta",
    subtitle: `${latitude.toFixed(5)}, ${longitude.toFixed(5)}`,
    latitude,
    longitude,
    coordinate: { latitude, longitude },
    source: "map_tap",
    score: 1,
    priority: 0,
    keywords: [],
  };

  const googleNearby = await runProvider("google_nearby", () =>
    searchNearbyGooglePlaces(latitude, longitude, { limit: 3 }),
  );

  let result = googleNearby.results[0] || null;

  const nominatim = !result
    ? await runProvider("nominatim_reverse", async () => {
        const item = await reverseNominatim(latitude, longitude, {
          zoom: query.zoom || 18,
        });
        return item ? [item] : [];
      })
    : { name: "nominatim_reverse", ok: true, results: [], error: null };

  if (!result) result = nominatim.results[0] || null;
  if (!result) result = fallback;

  result = {
    ...fallback,
    ...result,
    latitude: Number(result.latitude ?? latitude),
    longitude: Number(result.longitude ?? longitude),
    coordinate: result.coordinate || {
      latitude: Number(result.latitude ?? latitude),
      longitude: Number(result.longitude ?? longitude),
    },
    source: result.source || "reverse",
  };

  return {
    ok: true,
    query: { latitude, longitude },
    result,
    place: result,
    results: [result],
    meta: {
      ...healthMeta(),
      providers: [
        {
          name: googleNearby.name,
          ok: googleNearby.ok,
          count: googleNearby.results.length,
          error: googleNearby.error,
        },
        {
          name: nominatim.name,
          ok: nominatim.ok,
          count: nominatim.results.length,
          error: nominatim.error,
        },
      ],
    },
  };
}

async function details(query = {}) {
  const placeId = String(
    query.placeId || query.id || query.googlePlaceId || "",
  ).trim();

  if (!placeId) {
    return {
      ok: false,
      error: "placeId required",
      result: null,
      place: null,
      meta: healthMeta(),
    };
  }

  if (placeId.startsWith("address-rc-")) {
    const rcAddress = await getRcAddressDetails(placeId);

    return {
      ok: Boolean(rcAddress),
      placeId,
      result: rcAddress,
      place: rcAddress,
      results: rcAddress ? [rcAddress] : [],
      meta: {
        ...healthMeta(),
        providers: [
          {
            name: "rc_address_details",
            ok: Boolean(rcAddress),
            count: rcAddress ? 1 : 0,
            error: rcAddress ? null : "address not found",
          },
        ],
      },
    };
  }

  if (placeId.startsWith("address-")) {
    const localAddress = await getLocalAddressDetails(placeId, {
      lat: query.lat ?? query.latitude,
      lon: query.lon ?? query.lng ?? query.longitude,
    });

    return {
      ok: Boolean(localAddress),
      placeId,
      result: localAddress,
      place: localAddress,
      results: localAddress ? [localAddress] : [],
      meta: {
        ...healthMeta(),
        providers: [
          {
            name: "local_address_details",
            ok: Boolean(localAddress),
            count: localAddress ? 1 : 0,
            error: localAddress ? null : "address not found",
          },
        ],
      },
    };
  }

  const google = await runProvider("google_details", async () => {
    const result = await getGooglePlaceDetails(placeId);
    return result ? [result] : [];
  });

  const result = google.results[0] || null;

  return {
    ok: Boolean(result),
    placeId,
    result,
    place: result,
    results: result ? [result] : [],
    meta: {
      ...healthMeta(),
      providers: [
        {
          name: google.name,
          ok: google.ok,
          count: google.results.length,
          error: google.error,
        },
      ],
    },
  };
}

async function photo(query = {}) {
  const name = String(query.name || "").trim();

  const maxWidthPx =
    query.maxWidthPx ||
    query.max_width_px ||
    process.env.GOOGLE_PLACES_PHOTO_MAX_WIDTH ||
    900;

  if (!name) return { ok: false, error: "name required", url: null };

  const url = await getGooglePhotoMediaUrl(name, maxWidthPx);

  return { ok: Boolean(url), url };
}

function health() {
  return {
    ok: true,
    routes: [
      "/api/search",
      "/api/search/debug",
      "/api/search/health",
      "/api/search/stops",
      "/api/search/reverse",
      "/api/search/details",
      "/api/search/photo",
      "/api/search/autocomplete",
    ],
    meta: healthMeta(),
  };
}

function allStops() {
  return loadGtfsStops();
}

function findNearestStop(input) {
  const latitude = Number(input?.latitude ?? input?.lat);
  const longitude = Number(input?.longitude ?? input?.lon ?? input?.lng);

  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return null;

  const R = 6371000;

  const distance = (a, b) => {
    const dLat = ((b.latitude - a.latitude) * Math.PI) / 180;
    const dLon = ((b.longitude - a.longitude) * Math.PI) / 180;
    const lat1 = (a.latitude * Math.PI) / 180;
    const lat2 = (b.latitude * Math.PI) / 180;

    const h =
      Math.sin(dLat / 2) ** 2 +
      Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) ** 2;

    return Math.round(2 * R * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h)));
  };

  return (
    loadGtfsStops()
      .map((s) => ({
        ...s,
        distanceMeters: distance({ latitude, longitude }, s),
      }))
      .sort((a, b) => a.distanceMeters - b.distanceMeters)[0] || null
  );
}

module.exports = {
  index,
  debug,
  reverse,
  details,
  photo,
  stops,
  health,
  healthMeta,
  allStops,
  findNearestStop,
  normalizeText,
};
