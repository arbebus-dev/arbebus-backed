const { normalizeText } = require("../utils/normalizeText");
const { toResult } = require("../utils/mapSearchResult");
const { getPool } = require("../../../db/pool");

const LT_FROM = "ĄČĘĖĮŠŲŪŽąčęėįšųūž";
const LT_TO = "ACEEISUUZaceeisuuz";
const NORMALIZE_SQL = (column) => `lower(translate(COALESCE(${column}, ''), '${LT_FROM}', '${LT_TO}'))`;

const DEFAULT_CITY = {
  city: "Klaipėda",
  pattern: "klaip%",
  latitude: 55.7033,
  longitude: 21.1443,
};

const CITY_HINTS = [
  { keys: ["klaipeda", "klaipedos", "klaipėda", "klaipėdos"], city: "Klaipėda", pattern: "klaip%", latitude: 55.7033, longitude: 21.1443 },
  { keys: ["gargzdai", "gargždai", "gargzdu", "gargždų"], city: "Gargždai", pattern: "gargzd%", latitude: 55.7093, longitude: 21.3949 },
  { keys: ["palanga", "palangos"], city: "Palanga", pattern: "palang%", latitude: 55.9175, longitude: 21.0686 },
  { keys: ["vilnius", "vilniaus"], city: "Vilnius", pattern: "viln%", latitude: 54.6872, longitude: 25.2797 },
  { keys: ["kaunas", "kauno"], city: "Kaunas", pattern: "kaun%", latitude: 54.8985, longitude: 23.9036 },
  { keys: ["siauliai", "šiauliai", "siauliu", "šiaulių"], city: "Šiauliai", pattern: "siaul%", latitude: 55.9349, longitude: 23.3137 },
  { keys: ["panevezys", "panevėžys", "panevezio", "panevėžio"], city: "Panevėžys", pattern: "panevez%", latitude: 55.7348, longitude: 24.3575 },
  { keys: ["kretinga", "kretingos"], city: "Kretinga", pattern: "kreting%", latitude: 55.8888, longitude: 21.2445 },
  { keys: ["neringa", "neringos"], city: "Neringa", pattern: "nering%", latitude: 55.3712, longitude: 21.0646 },
  { keys: ["nida", "nidos"], city: "Nida", pattern: "nida%", latitude: 55.3039, longitude: 21.0058 },
  { keys: ["priekule", "priekulė", "priekules", "priekulės"], city: "Priekulė", pattern: "priekul%", latitude: 55.5546, longitude: 21.3185 },
];

let lastDbError = null;
let lastDbCount = null;
let lastDbHealthCheck = 0;

function compactQuery(value) {
  return normalizeText(value).replace(/\./g, " ").replace(/\s+/g, " ").trim();
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

function extractHouseNumber(query) {
  const match = String(query || "").match(/\b(\d+[a-zA-Z]?)\b/);
  return match ? match[1].toUpperCase() : null;
}

function detectCity(query) {
  const nq = compactQuery(query);
  return CITY_HINTS.find((item) => item.keys.some((key) => nq.includes(compactQuery(key)))) || DEFAULT_CITY;
}

function parseAddressQuery(query) {
  const raw = String(query || "").trim();
  const normalized = compactQuery(raw);
  const house = extractHouseNumber(normalized);
  const cityHint = detectCity(normalized);

  let street = normalized
    .replace(/\b\d+[a-zA-Z]?\b/g, " ")
    .replace(/\b(g|gatve|gatvė|pr|prospektas|pl|plentas|al|aleja|kelias)\b/gi, " ");

  for (const city of CITY_HINTS) {
    for (const key of city.keys) {
      street = street.replace(new RegExp(`\\b${compactQuery(key)}\\b`, "gi"), " ");
    }
  }

  street = street.replace(/\s+/g, " ").trim();

  return {
    raw,
    normalized,
    house,
    cityHint,
    street: street || normalized,
  };
}

function buildTitle(row) {
  const street = String(row.street || row.name || "Gatvė").trim();
  if (row.suggestion_type === "street" || !row.house_number) return street;
  return row.name || `${street} ${row.house_number}`;
}

function buildSubtitle(row) {
  return [row.city, row.postcode].filter(Boolean).join(", ") || "Adresas";
}

function rowToAddressResult(row, query) {
  const latitude = Number(row.lat);
  const longitude = Number(row.lon);
  const hasRealCoordinate = validCoordinate(latitude, longitude);
  const type = row.suggestion_type === "street" ? "street" : "address";
  const exactHouse = Boolean(extractHouseNumber(query));

  return toResult({
    id: `address-${row.id}`,
    placeId: `address-${row.id}`,
    type,
    title: buildTitle(row),
    name: buildTitle(row),
    subtitle: hasRealCoordinate ? buildSubtitle(row) : `${buildSubtitle(row)} · pasirinkite namo numerį`,
    latitude,
    longitude,
    coordinate: { latitude, longitude },
    source: "postgres_address",
    category: type === "street" ? "Gatvė" : "Adresas",
    priority: exactHouse ? 360 : 240,
    score: Number(row.rank_score || 0),
    selectable: type === "address" && hasRealCoordinate,
    requiresHouseNumber: type === "street",
    needsGeocoding: !hasRealCoordinate,
    keywords: [row.name, row.street, row.house_number, row.city, row.postcode].filter(Boolean),
  });
}

async function queryAddressRows({ query, limit }) {
  const pool = getPool();
  const parsed = parseAddressQuery(query);
  const streetPrefix = compactQuery(parsed.street).slice(0, 80);
  if (streetPrefix.length < 2) return [];

  const streetNorm = NORMALIZE_SQL("street");
  const cityNorm = NORMALIZE_SQL("city");
  const cityPattern = parsed.cityHint?.pattern || DEFAULT_CITY.pattern;

  if (parsed.house) {
    const sql = `
      SELECT id, name, street, house_number, city, postcode, lat, lon,
        'address'::text AS suggestion_type,
        (
          CASE WHEN ${cityNorm} LIKE $3 THEN 160000 ELSE 0 END +
          CASE WHEN upper(house_number) = upper($2) THEN 120000 ELSE 0 END +
          CASE WHEN upper(house_number) LIKE upper($2) || '%' THEN 45000 ELSE 0 END +
          CASE WHEN ${streetNorm} = $1 THEN 30000 ELSE 0 END +
          CASE WHEN ${streetNorm} LIKE $1 || '%' THEN 20000 ELSE 0 END +
          CASE WHEN lat IS NOT NULL AND lon IS NOT NULL AND lat <> 0 AND lon <> 0 THEN 8000 ELSE 0 END
        ) AS rank_score
      FROM public.addresses
      WHERE lat IS NOT NULL AND lon IS NOT NULL AND lat <> 0 AND lon <> 0
        AND ${streetNorm} LIKE $1 || '%'
        AND upper(house_number) LIKE upper($2) || '%'
        AND ${cityNorm} LIKE $3
      ORDER BY rank_score DESC, city ASC, street ASC, house_number ASC
      LIMIT $4
    `;

    const result = await pool.query(sql, [streetPrefix, parsed.house, cityPattern, limit]);
    return result.rows;
  }

  const sql = `
    WITH street_candidates AS (
      SELECT DISTINCT ON (${streetNorm}, ${cityNorm})
        id,
        street,
        city,
        postcode,
        lat,
        lon,
        (
          CASE WHEN ${cityNorm} LIKE $2 THEN 160000 ELSE 0 END +
          CASE WHEN ${streetNorm} = $1 THEN 30000 ELSE 0 END +
          CASE WHEN ${streetNorm} LIKE $1 || '%' THEN 20000 ELSE 0 END +
          CASE WHEN lat IS NOT NULL AND lon IS NOT NULL AND lat <> 0 AND lon <> 0 THEN 8000 ELSE 0 END
        ) AS rank_score
      FROM public.addresses
      WHERE ${streetNorm} LIKE $1 || '%'
        AND ${cityNorm} LIKE $2
        AND lat IS NOT NULL AND lon IS NOT NULL AND lat <> 0 AND lon <> 0
      ORDER BY ${streetNorm}, ${cityNorm}, rank_score DESC, id ASC
      LIMIT $3
    )
    SELECT id, street AS name, street, NULL::text AS house_number, city, postcode, lat, lon,
      'street'::text AS suggestion_type, rank_score
    FROM street_candidates
    ORDER BY rank_score DESC, city ASC, street ASC
  `;

  const result = await pool.query(sql, [streetPrefix, cityPattern, Math.min(Math.max(limit, 8), 20)]);
  return result.rows;
}

async function searchLocalAddresses(query, options = {}) {
  try {
    const limit = Math.min(Math.max(Number(options.limit || 8), 1), 20);
    const rows = await queryAddressRows({ query, limit: Math.max(limit, 12) });
    lastDbError = null;
    return rows.map((row) => rowToAddressResult(row, query)).filter(Boolean).slice(0, limit);
  } catch (error) {
    lastDbError = error?.message || String(error);
    return [];
  }
}

async function getLocalAddressDetails(placeId) {
  const rawId = String(placeId || "").replace(/^address-/, "").trim();
  if (!rawId) return null;

  try {
    const result = await getPool().query(
      `SELECT id, name, street, house_number, city, postcode, lat, lon
       FROM public.addresses
       WHERE id::text = $1
       LIMIT 1`,
      [rawId],
    );
    const row = result.rows?.[0];
    if (!row) return null;
    lastDbError = null;
    return rowToAddressResult({ ...row, suggestion_type: "address" }, row.name || "");
  } catch (error) {
    lastDbError = error?.message || String(error);
    return null;
  }
}

async function refreshDbCount() {
  if (Date.now() - lastDbHealthCheck < 30000) return lastDbCount;
  lastDbHealthCheck = Date.now();

  try {
    const result = await getPool().query("SELECT COUNT(*)::int AS count FROM public.addresses");
    lastDbCount = Number(result.rows?.[0]?.count || 0);
    lastDbError = null;
  } catch (error) {
    lastDbError = error?.message || String(error);
  }

  return lastDbCount;
}

function localAddressHealth() {
  refreshDbCount().catch(() => undefined);
  return {
    postgresAddressProvider: true,
    postgresAddressCount: lastDbCount,
    postgresAddressError: lastDbError,
  };
}

module.exports = {
  searchLocalAddresses,
  getLocalAddressDetails,
  localAddressHealth,
};
