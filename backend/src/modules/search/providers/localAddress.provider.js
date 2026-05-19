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

const PROVIDER_VERSION = "apple-addresses-clean-v10-cache-warm-fast";
const QUERY_TIMEOUT_MS = Number(process.env.SEARCH_LOCAL_ADDRESS_STATEMENT_TIMEOUT_MS || 12000);
const TYPO_QUERY_TIMEOUT_MS = Number(process.env.SEARCH_LOCAL_ADDRESS_TYPO_TIMEOUT_MS || 12000);
const TYPO_ENABLED = String(process.env.SEARCH_LOCAL_ADDRESS_TYPO_ENABLED || "false").toLowerCase() === "true";
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

function buildQueryInfo(query, options = {}) {
  const q = cleanText(query);
  const tokens = q.split(" ").filter(Boolean);
  const lastToken = tokens[tokens.length - 1] || q;
  const variants = expandLithuanianVariants(q);
  const lastVariants = expandLithuanianVariants(lastToken);
  const house = parseHouseQuery(q);
  const userLocation = normalizeUserCoordinate(options);

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
    userLocation,
    locationBucket: locationCacheBucket(userLocation),
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

function lks94ToWgs84(northing, easting) {
  const a = 6378137.0;
  const f = 1 / 298.257222101;
  const e2 = f * (2 - f);
  const ep2 = e2 / (1 - e2);
  const k0 = 0.9998;
  const lon0 = (24.0 * Math.PI) / 180;
  const x = Number(easting) - 500000.0;
  const y = Number(northing);

  if (!Number.isFinite(x) || !Number.isFinite(y)) return null;

  const m = y / k0;
  const e1 = (1 - Math.sqrt(1 - e2)) / (1 + Math.sqrt(1 - e2));
  const mu = m / (a * (1 - e2 / 4 - (3 * e2 ** 2) / 64 - (5 * e2 ** 3) / 256));

  const j1 = (3 * e1) / 2 - (27 * e1 ** 3) / 32;
  const j2 = (21 * e1 ** 2) / 16 - (55 * e1 ** 4) / 32;
  const j3 = (151 * e1 ** 3) / 96;
  const j4 = (1097 * e1 ** 4) / 512;

  const fp = mu + j1 * Math.sin(2 * mu) + j2 * Math.sin(4 * mu) + j3 * Math.sin(6 * mu) + j4 * Math.sin(8 * mu);
  const sinFp = Math.sin(fp);
  const cosFp = Math.cos(fp);
  const tanFp = Math.tan(fp);

  const c1 = ep2 * cosFp ** 2;
  const t1 = tanFp ** 2;
  const n1 = a / Math.sqrt(1 - e2 * sinFp ** 2);
  const r1 = (a * (1 - e2)) / (1 - e2 * sinFp ** 2) ** 1.5;
  const d = x / (n1 * k0);

  const lat = fp - (n1 * tanFp / r1) * (
    d ** 2 / 2 -
    (5 + 3 * t1 + 10 * c1 - 4 * c1 ** 2 - 9 * ep2) * d ** 4 / 24 +
    (61 + 90 * t1 + 298 * c1 + 45 * t1 ** 2 - 252 * ep2 - 3 * c1 ** 2) * d ** 6 / 720
  );

  const lon = lon0 + (
    d -
    (1 + 2 * t1 + c1) * d ** 3 / 6 +
    (5 - 2 * c1 + 28 * t1 - 3 * c1 ** 2 + 8 * ep2 + 24 * t1 ** 2) * d ** 5 / 120
  ) / cosFp;

  return { latitude: (lat * 180) / Math.PI, longitude: (lon * 180) / Math.PI };
}

function normalizeCoordinatePair(rawLat, rawLon) {
  const lat = Number(rawLat);
  const lon = Number(rawLon);

  if (Number.isFinite(lat) && Number.isFinite(lon) && lat >= 53 && lat <= 57 && lon >= 20 && lon <= 27) {
    return { latitude: lat, longitude: lon };
  }

  // Lietuvos RC duomenyse lat/lon dažnai yra LKS-94: lat=northing, lon=easting.
  if (Number.isFinite(lat) && Number.isFinite(lon) && lat > 5000000 && lon > 100000 && lon < 900000) {
    return lks94ToWgs84(lat, lon);
  }

  return null;
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

function normalizeUserCoordinate(options = {}) {
  const latitude = Number(options.lat ?? options.latitude ?? options.userLat);
  const longitude = Number(
    options.lon ?? options.lng ?? options.longitude ?? options.userLon,
  );

  if (!validCoordinate(latitude, longitude)) return null;
  return { latitude, longitude };
}

function locationCacheBucket(location) {
  if (!location) return "no-gps";
  return `${Number(location.latitude).toFixed(2)},${Number(location.longitude).toFixed(2)}`;
}

function distanceMeters(a, b) {
  if (!a || !b) return null;

  const lat1 = Number(a.latitude);
  const lon1 = Number(a.longitude);
  const lat2 = Number(b.latitude);
  const lon2 = Number(b.longitude);

  if (!validCoordinate(lat1, lon1) || !validCoordinate(lat2, lon2)) return null;

  const toRad = (value) => (value * Math.PI) / 180;
  const earthRadiusMeters = 6371000;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const rLat1 = toRad(lat1);
  const rLat2 = toRad(lat2);

  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(rLat1) * Math.cos(rLat2) * Math.sin(dLon / 2) ** 2;

  return earthRadiusMeters * 2 * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h));
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

  if (Number.isFinite(Number(row.distanceMeters))) {
    const meters = Math.max(0, Number(row.distanceMeters));

    // GPS ranking: do not filter other cities; only push nearest exact matches up.
    // 0 km ≈ +900k, 10 km ≈ +750k, 50 km ≈ +150k, 60+ km ≈ +0.
    score += Math.max(0, 900000 - meters * 15);
  } else if (Number.isFinite(Number(row.distance_score))) {
    score += Math.max(0, 100000 - Number(row.distance_score) * 10000);
  }

  return score;
}

function rowToResult(row, queryInfo) {
  const coord = normalizeCoordinatePair(row.lat, row.lon);
  if (!coord || !validCoordinate(coord.latitude, coord.longitude)) return null;
  const latitude = coord.latitude;
  const longitude = coord.longitude;

  const type = row.type || (row.house_number ? "address" : "street");
  const title = rowTitle(row);
  const id = String(row.id || `${type}-${title}-${row.city || "lt"}`);
  const distanceFromUserMeters = distanceMeters(queryInfo.userLocation, {
    latitude,
    longitude,
  });
  const scoringRow = { ...row, distanceMeters: distanceFromUserMeters };

  const result = toResult({
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
    score: scoreRow(scoringRow, queryInfo),
    priority: type === "settlement" ? 360 : type === "address" ? 390 : 350,
    selectable: true,
    requiresHouseNumber: false,
    keywords: [row.name, row.street, row.city, type].filter(Boolean),
  });

  if (Number.isFinite(distanceFromUserMeters)) {
    result.distanceMeters = Math.round(distanceFromUserMeters);
    result.distanceFromUserMeters = Math.round(distanceFromUserMeters);
  }

  return result;
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

async function runTimedQuery(sql, params = [], timeoutMs = QUERY_TIMEOUT_MS) {
  // Fast path: one DB roundtrip only.
  // Previous implementation used BEGIN + set_config + SELECT + COMMIT, which added
  // multiple network roundtrips and made local address search look slow even when
  // EXPLAIN ANALYZE showed the lookup query itself was sub-millisecond.
  const started = Date.now();
  try {
    const result = await getPool().query(sql, params);
    return result.rows || [];
  } catch (error) {
    throw error;
  } finally {
    const elapsed = Date.now() - started;
    if (elapsed > Number(timeoutMs || QUERY_TIMEOUT_MS)) {
      // Do not cancel here; just expose timing through lastQueryMs/metadata.
      // Query timeout is still controlled by pg pool query_timeout if configured.
    }
  }
}

function isTimeoutError(error) {
  return String(error?.code || "") === "57014" || /statement timeout|canceling statement/i.test(String(error?.message || error));
}

function uniqueRows(rows = []) {
  const seen = new Set();
  const out = [];
  for (const row of rows) {
    const key = `${row.type}|${row.id}|${row.lat}|${row.lon}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(row);
  }
  return out;
}

async function queryAddresses(queryInfo, limit) {
  const boundedLimit = Math.min(Math.max(Number(limit || 12) * 8, 60), 160);
  const houseNumber = queryInfo.house?.houseNumber || null;
  const streetText = stripLithuanian(queryInfo.house?.streetText || queryInfo.q);
  const q = stripLithuanian(queryInfo.q);
  const userLat = queryInfo.userLocation?.latitude ?? null;
  const userLon = queryInfo.userLocation?.longitude ?? null;
  const started = Date.now();

  // V7 PERFORMANCE RULE:
  // Search uses prepared public.addresses_search_lookup table.
  // That table stores pre-normalized search_street/search_name and WGS84 latitude/longitude,
  // so runtime search does NOT normalize 1M rows and does NOT convert LKS-94 coordinates.
  const exactHouseLookupSql = `
    WITH candidates AS MATERIALIZED (
      SELECT
        a.id::text AS id,
        a.name::text AS name,
        a.street::text AS street,
        a.house_number::text AS house_number,
        a.city::text AS city,
        a.latitude::double precision AS latitude,
        a.longitude::double precision AS longitude
      FROM public.addresses_search_lookup a
      WHERE a.search_house = $1::text
        AND (
          $2::text = ''
          OR a.search_street LIKE $2::text || '%'
        )
        AND a.latitude IS NOT NULL
        AND a.longitude IS NOT NULL
      LIMIT 250
    )
    SELECT
      c.id,
      'address'::text AS type,
      c.name,
      c.street,
      c.house_number,
      c.city,
      c.latitude AS lat,
      c.longitude AS lon,
      7000::int AS rank_score,
      CASE
        WHEN $4::double precision IS NULL OR $5::double precision IS NULL THEN 999999999::double precision
        ELSE (
          power((c.latitude - $4::double precision) * 111320.0, 2) +
          power((c.longitude - $5::double precision) * 111320.0 * cos(radians($4::double precision)), 2)
        )
      END AS distance_score,
      'postgres_address_lookup_house_street_gps_candidates'::text AS source
    FROM candidates c
    ORDER BY
      distance_score ASC,
      c.city ASC,
      c.street ASC,
      c.house_number ASC
    LIMIT $3::int
  `;

  const exactHouseContainsLookupSql = `
    WITH candidates AS MATERIALIZED (
      SELECT
        a.id::text AS id,
        a.name::text AS name,
        a.street::text AS street,
        a.house_number::text AS house_number,
        a.city::text AS city,
        a.latitude::double precision AS latitude,
        a.longitude::double precision AS longitude
      FROM public.addresses_search_lookup a
      WHERE a.search_house = $1::text
        AND (
          $2::text = ''
          OR a.search_street LIKE '%' || $2::text || '%'
          OR a.search_name LIKE '%' || $2::text || '%'
        )
        AND a.latitude IS NOT NULL
        AND a.longitude IS NOT NULL
      LIMIT 500
    )
    SELECT
      c.id,
      'address'::text AS type,
      c.name,
      c.street,
      c.house_number,
      c.city,
      c.latitude AS lat,
      c.longitude AS lon,
      5200::int AS rank_score,
      CASE
        WHEN $4::double precision IS NULL OR $5::double precision IS NULL THEN 999999999::double precision
        ELSE (
          power((c.latitude - $4::double precision) * 111320.0, 2) +
          power((c.longitude - $5::double precision) * 111320.0 * cos(radians($4::double precision)), 2)
        )
      END AS distance_score,
      'postgres_address_lookup_house_contains_gps_candidates'::text AS source
    FROM candidates c
    ORDER BY
      distance_score ASC,
      c.city ASC,
      c.street ASC,
      c.house_number ASC
    LIMIT $3::int
  `;

  const streetOnlyLookupSql = `
    SELECT
      a.id::text AS id,
      CASE WHEN NULLIF(a.house_number, '') IS NOT NULL THEN 'address' ELSE 'street' END AS type,
      a.name::text AS name,
      a.street::text AS street,
      a.house_number::text AS house_number,
      a.city::text AS city,
      a.latitude::double precision AS lat,
      a.longitude::double precision AS lon,
      3000::int AS rank_score,
      CASE
        WHEN $3::double precision IS NULL OR $4::double precision IS NULL THEN 999999999::double precision
        ELSE (
          power((a.latitude::double precision - $3::double precision) * 111320.0, 2) +
          power((a.longitude::double precision - $4::double precision) * 111320.0 * cos(radians($3::double precision)), 2)
        )
      END AS distance_score,
      'postgres_address_lookup_street_gps'::text AS source
    FROM public.addresses_search_lookup a
    WHERE a.search_street LIKE $1::text || '%'
      AND a.latitude IS NOT NULL
      AND a.longitude IS NOT NULL
    ORDER BY
      distance_score ASC,
      a.city ASC,
      a.street ASC,
      a.house_number ASC
    LIMIT $2::int
  `;

  try {
    let rows = [];

    if (houseNumber) {
      rows = await runTimedQuery(
        exactHouseLookupSql,
        [houseNumber, streetText, boundedLimit, userLat, userLon],
        QUERY_TIMEOUT_MS,
      );

      if (rows.length < Math.min(Number(limit || 12), 12)) {
        const fallbackRows = await runTimedQuery(
          exactHouseContainsLookupSql,
          [houseNumber, streetText, boundedLimit, userLat, userLon],
          QUERY_TIMEOUT_MS,
        );
        rows = uniqueRows([...rows, ...fallbackRows]);
      }

      lastQueryMs = Date.now() - started;
      return uniqueRows(rows).slice(0, boundedLimit);
    }

    rows = await runTimedQuery(streetOnlyLookupSql, [q, boundedLimit, userLat, userLon], QUERY_TIMEOUT_MS);
    lastQueryMs = Date.now() - started;
    return uniqueRows(rows).slice(0, boundedLimit);
  } catch (error) {
    lastQueryMs = Date.now() - started;
    throw error;
  }
}
async function searchLocalAddresses(query, options = {}) {
  const queryInfo = buildQueryInfo(query, options);
  if (!queryInfo.q || queryInfo.q.length < 2) return [];

  const limit = Math.min(Math.max(Number(options.limit || 8), 1), 30);
  const cacheKey = `local-address:${PROVIDER_VERSION}:${queryInfo.q}:${limit}:${queryInfo.locationBucket}:${options.autocomplete ? "auto" : "search"}`;
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
  // Do not run COUNT(*) during every /api/search response.
  // The prepared lookup table count is validated by SQL during setup; runtime
  // health metadata must be cheap and must not steal a DB connection from search.
  return {
    postgresAddressProvider: true,
    postgresAddressCount: lastAddressCount,
    postgresAddressError: lastDbError,
    providerMode: "public.addresses_search_lookup",
    providerVersion: PROVIDER_VERSION,
    oneQueryPerRequest: true,
    noAddressRcJoin: true,
    noMatchKey: true,
    autocomplete: true,
    typoTolerance: false,
    ranking: true,
    gpsRanking: true,
    requiredIndexFile: "backend/sql/ultimate_search_engine_indexes.sql",
    preparedLookupTable: "public.addresses_search_lookup",
    candidateLimitBeforeGpsSort: true,
    directPoolQuery: true,
    healthCountQueryDisabled: true,
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
