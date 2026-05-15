const { normalizeText } = require("../utils/normalizeText");
const { getCache, setCache } = require("../cache/searchCache");
const { toResult } = require("../utils/mapSearchResult");
const { getPool } = require("../../../db/pool");
const { searchGooglePlaces } = require("./googlePlaces.provider");
const { searchNominatim } = require("./nominatim.provider");

const DEFAULT_CENTER = {
  city: "Klaipėda",
  latitude: 55.7033,
  longitude: 21.1443,
  dbPatterns: ["klaipėd", "klaiped"],
};

const CITY_HINTS = [
  {
    keys: ["klaipeda", "klaipėda"],
    city: "Klaipėda",
    latitude: 55.7033,
    longitude: 21.1443,
    dbPatterns: ["klaipėd", "klaiped"],
  },
  {
    keys: ["gargzdai", "gargždai"],
    city: "Gargždai",
    latitude: 55.7093,
    longitude: 21.3949,
    dbPatterns: ["gargžd", "gargzd"],
  },
  {
    keys: ["neringa"],
    city: "Neringa",
    latitude: 55.3712,
    longitude: 21.0646,
    dbPatterns: ["nering"],
  },
  {
    keys: ["nida"],
    city: "Nida",
    latitude: 55.3039,
    longitude: 21.0058,
    dbPatterns: ["nida"],
  },
  {
    keys: ["priekule", "priekulė"],
    city: "Priekulė",
    latitude: 55.5546,
    longitude: 21.3185,
    dbPatterns: ["priekul"],
  },
  {
    keys: ["dreverna"],
    city: "Dreverna",
    latitude: 55.5184,
    longitude: 21.2466,
    dbPatterns: ["drevern"],
  },
  {
    keys: ["karkle", "karklė"],
    city: "Karklė",
    latitude: 55.8113,
    longitude: 21.0727,
    dbPatterns: ["karkl"],
  },
  {
    keys: ["slengiai"],
    city: "Slengiai",
    latitude: 55.7654,
    longitude: 21.2315,
    dbPatterns: ["sleng"],
  },
  {
    keys: ["kretingale", "kretingalė"],
    city: "Kretingalė",
    latitude: 55.8322,
    longitude: 21.1907,
    dbPatterns: ["kretingal"],
  },
  {
    keys: ["dovilai"],
    city: "Dovilai",
    latitude: 55.6762,
    longitude: 21.3789,
    dbPatterns: ["dovil"],
  },
];

const REGION_PATTERNS = [
  "%klaip%",
  "%nering%",
  "%nida%",
  "%gargžd%",
  "%gargzd%",
  "%priekul%",
  "%drevern%",
  "%karkl%",
  "%sleng%",
  "%sendvar%",
  "%kretingal%",
  "%dovil%",
  "%veivirž%",
  "%veivirz%",
  "%judrėn%",
  "%judren%",
  "%agluonėn%",
  "%agluonen%",
  "%ketverg%",
  "%lapiai%",
  "%pliki%",
  "%endriejav%",
  "%venck%",
  "%saug%",
  "%girul%",
  "%melnrag%",
  "%smiltyn%",
  "%juodkrant%",
  "%preil%",
  "%pervalk%",
];

let lastDbError = null;
let lastDbCount = null;
let lastDbHealthCheck = 0;

function compactQuery(value) {
  return normalizeText(value).replace(/\./g, " ").replace(/\s+/g, " ").trim();
}

function extractHouseNumber(query) {
  const match = String(query || "").match(/\b(\d+[a-zA-Z]?)\b/);
  return match ? match[1].toUpperCase() : null;
}

function normalizeSearchText(value) {
  return compactQuery(value)
    .replace(
      /\b(g|gatve|gatvė|pr|prospektas|pl|plentas|al|aleja|kelias)\b/g,
      " ",
    )
    .replace(/\s+/g, " ")
    .trim();
}

function parseCoordinate(input, keys) {
  for (const key of keys) {
    const value = Number(input?.[key]);
    if (Number.isFinite(value)) return value;
  }
  return null;
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

function normalizeInputLocation(options = {}) {
  const latitude = parseCoordinate(options, ["lat", "latitude"]);
  const longitude = parseCoordinate(options, ["lon", "lng", "longitude"]);
  if (!validCoordinate(latitude, longitude)) return null;
  return { latitude, longitude };
}

function distanceMeters(a, b) {
  const lat1 = Number(a.latitude ?? a.lat);
  const lon1 = Number(a.longitude ?? a.lon ?? a.lng);
  const lat2 = Number(b.latitude ?? b.lat);
  const lon2 = Number(b.longitude ?? b.lon ?? b.lng);

  if (!validCoordinate(lat1, lon1) || !validCoordinate(lat2, lon2)) {
    return Number.POSITIVE_INFINITY;
  }

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

function detectCity(query, options = {}) {
  const nq = compactQuery(query);
  const explicit = CITY_HINTS.find((item) =>
    item.keys.some((key) => nq.includes(compactQuery(key))),
  );

  if (explicit) return { ...explicit, reason: "query" };

  const location = normalizeInputLocation(options);
  if (location) {
    const nearest = [...CITY_HINTS]
      .map((item) => ({
        ...item,
        distanceMeters: distanceMeters(location, item),
      }))
      .sort((a, b) => a.distanceMeters - b.distanceMeters)[0];

    return { ...(nearest || DEFAULT_CENTER), reason: "gps" };
  }

  return { ...DEFAULT_CENTER, reason: "default" };
}

function cityPatterns(cityHint) {
  const source = cityHint || DEFAULT_CENTER;
  const patterns =
    Array.isArray(source.dbPatterns) && source.dbPatterns.length
      ? source.dbPatterns
      : [source.city];

  return patterns
    .map((item) => `%${String(item).toLowerCase()}%`)
    .filter(Boolean);
}

function cityMatches(rowCity, targetCity) {
  if (!rowCity || !targetCity) return false;
  const cityText = String(rowCity).toLowerCase();

  return cityPatterns(targetCity).some((pattern) =>
    cityText.includes(pattern.replace(/%/g, "")),
  );
}

function removeCityWordsFromStreet(query) {
  let value = compactQuery(query);

  for (const city of CITY_HINTS) {
    for (const key of city.keys) {
      value = value.replace(
        new RegExp(`\\b${compactQuery(key)}\\b`, "gi"),
        " ",
      );
    }
  }

  return value.replace(/\s+/g, " ").trim();
}

function buildTitle(row) {
  return row.name || [row.street, row.house_number].filter(Boolean).join(" ");
}

function buildSubtitle(row) {
  return [row.city, row.postcode].filter(Boolean).join(", ") || "Adresas";
}

function readResultCoordinate(item) {
  const latitude = Number(
    item?.latitude ?? item?.lat ?? item?.coordinate?.latitude,
  );
  const longitude = Number(
    item?.longitude ?? item?.lon ?? item?.lng ?? item?.coordinate?.longitude,
  );

  if (!validCoordinate(latitude, longitude)) return null;
  return { latitude, longitude };
}

function geocoderQuery(row, originalQuery, targetCity) {
  const city = row.city || targetCity?.city || DEFAULT_CENTER.city;
  const parts = [row.street, row.house_number, city, "Lietuva"].filter(Boolean);
  const query = parts.join(" ").replace(/\s+/g, " ").trim();

  if (query.length >= 6) return query;
  return `${originalQuery} ${city} Lietuva`.trim();
}

async function updateAddressCoordinate(id, coordinate) {
  if (!id || !validCoordinate(coordinate?.latitude, coordinate?.longitude))
    return;

  await getPool().query(
    `
    UPDATE public.addresses
    SET lat = $2, lon = $3
    WHERE id = $1
      AND (lat IS NULL OR lon IS NULL OR lat = 0 OR lon = 0)
    `,
    [id, coordinate.latitude, coordinate.longitude],
  );
}

async function geocodeMissingCoordinate(row, originalQuery, targetCity) {
  const title = geocoderQuery(row, originalQuery, targetCity);
  const key = `address-geocode:v5:${compactQuery(title)}`;
  const cached = await getCache(key);

  if (
    cached &&
    validCoordinate(Number(cached.latitude), Number(cached.longitude))
  ) {
    return cached;
  }

  const providers = [
    () => searchGooglePlaces(title, { limit: 1 }),
    () => searchNominatim(title, { limit: 1 }),
  ];

  for (const provider of providers) {
    try {
      const results = await provider();
      const first = Array.isArray(results)
        ? results.map(readResultCoordinate).find(Boolean)
        : null;

      if (first) {
        await setCache(key, first, 86400 * 30);
        updateAddressCoordinate(row.id, first).catch(() => undefined);
        return first;
      }
    } catch {
      // External geocoder must never break local autocomplete.
    }
  }

  return null;
}

function rowToAddressResult(row, query, options = {}) {
  const targetCity = detectCity(query, options);
  const userLocation = normalizeInputLocation(options);
  const latitude = Number(row.lat);
  const longitude = Number(row.lon);
  const hasRealCoordinate = validCoordinate(latitude, longitude);
  const fallbackCoordinate = userLocation || targetCity || DEFAULT_CENTER;
  const finalLatitude = hasRealCoordinate
    ? latitude
    : fallbackCoordinate.latitude;
  const finalLongitude = hasRealCoordinate
    ? longitude
    : fallbackCoordinate.longitude;
  const userDistance =
    userLocation && hasRealCoordinate
      ? distanceMeters(userLocation, { latitude, longitude })
      : null;

  const rowMatchesTargetCity = cityMatches(row.city, targetCity);
  const exactHouse = extractHouseNumber(query);

  let score = Number(row.rank_score || 0);
  if (rowMatchesTargetCity) score += 300000; // 🔥 stipriai boostinam miestą
  if (targetCity?.reason === "query" && rowMatchesTargetCity) score += 150000;
  if (!rowMatchesTargetCity) score -= 200000; // 🔥 numušam kitus miestus
  if (targetCity?.reason === "gps" && rowMatchesTargetCity) score += 120000;
  if (targetCity?.reason === "default" && rowMatchesTargetCity) score += 110000;
  if (hasRealCoordinate) score += 6000;
  else score -= 4000;
  if (userDistance != null)
    score += Math.max(0, 50000 - Math.min(userDistance, 50000));

  return toResult({
    id: `address-${row.id}`,
    placeId: `address-${row.id}`,
    type: "address",
    title: buildTitle(row),
    name: buildTitle(row),
    subtitle: hasRealCoordinate
      ? buildSubtitle(row)
      : `${buildSubtitle(row)} · koordinatės tikslinamos`,
    latitude: finalLatitude,
    longitude: finalLongitude,
    coordinate: { latitude: finalLatitude, longitude: finalLongitude },
    source: "postgres_address",
    category: "Adresas",
    priority: exactHouse ? 320 : 210,
    score,
    selectable: true,
    requiresHouseNumber: false,
    needsGeocoding: !hasRealCoordinate,
    distanceMeters: userDistance ?? undefined,
    keywords: [
      row.name,
      row.street,
      row.house_number,
      row.city,
      row.postcode,
    ].filter(Boolean),
  });
}

async function mapAddressDetail(row, query, options = {}) {
  let latitude = Number(row.lat);
  let longitude = Number(row.lon);
  let geocoded = false;
  const targetCity = detectCity(query || buildTitle(row), options);

  if (!validCoordinate(latitude, longitude)) {
    const resolved = await geocodeMissingCoordinate(
      row,
      query || buildTitle(row),
      targetCity,
    );
    if (resolved) {
      latitude = resolved.latitude;
      longitude = resolved.longitude;
      geocoded = true;
    }
  }

  const base = rowToAddressResult(
    { ...row, lat: latitude, lon: longitude },
    query || buildTitle(row),
    options,
  );

  return {
    ...base,
    source: geocoded ? "postgres_address_geocoded" : base.source,
    needsGeocoding: !validCoordinate(latitude, longitude),
  };
}

async function queryAddressRows({ nq, streetPart, house, targetCity, limit }) {
  const pool = getPool();
  const cityPreferredPatterns = cityPatterns(targetCity);
  const street = normalizeSearchText(streetPart || nq);

  if (!street || street.length < 2) return [];

  if (house) {
    const sql = `
      SELECT id, name, street, house_number, city, postcode, lat, lon,
        (
          CASE WHEN lower(street) = lower($1) THEN 9000 ELSE 0 END +
          CASE WHEN lower(street) LIKE lower($1) || '%' THEN 6000 ELSE 0 END +
          CASE WHEN upper(house_number) = upper($2) THEN 10000 ELSE 0 END +
          CASE WHEN lower(COALESCE(city, '')) LIKE ANY($3::text[]) THEN 70000 ELSE 0 END +
          CASE WHEN lat IS NOT NULL AND lon IS NOT NULL AND lat <> 0 AND lon <> 0 THEN 5000 ELSE 0 END
        ) AS rank_score
      FROM public.addresses
      WHERE lower(COALESCE(city, '')) LIKE ANY($4::text[])
        AND upper(house_number) = upper($2)
        AND (
          lower(street) = lower($1)
          OR lower(street) LIKE lower($1) || '%'
          OR lower(street) LIKE '%' || lower($1) || '%'
        )
      ORDER BY rank_score DESC, city ASC, street ASC, house_number ASC
      LIMIT $5
    `;

    const result = await pool.query(sql, [
      street,
      house,
      cityPreferredPatterns,
      REGION_PATTERNS,
      limit,
    ]);

    return result.rows;
  }

  const sql = `
    SELECT id, name, street, house_number, city, postcode, lat, lon,
      (
        CASE WHEN lower(street) = lower($1) THEN 9000 ELSE 0 END +
        CASE WHEN lower(street) LIKE lower($1) || '%' THEN 6000 ELSE 0 END +
        CASE WHEN lower(COALESCE(city, '')) LIKE ANY($2::text[]) THEN 70000 ELSE 0 END +
        CASE WHEN lat IS NOT NULL AND lon IS NOT NULL AND lat <> 0 AND lon <> 0 THEN 5000 ELSE 0 END
      ) AS rank_score
    FROM public.addresses
    WHERE lower(COALESCE(city, '')) LIKE ANY($3::text[])
      AND (
        lower(street) = lower($1)
        OR lower(street) LIKE lower($1) || '%'
        OR lower(street) LIKE '%' || lower($1) || '%'
      )
    ORDER BY rank_score DESC, city ASC, street ASC, house_number ASC
    LIMIT $4
  `;

  const result = await pool.query(sql, [
    street,
    cityPreferredPatterns,
    REGION_PATTERNS,
    limit,
  ]);

  return result.rows;
}

function sortAddressResults(items) {
  return [...items].sort((a, b) => {
    const aScore = Number(a.score || 0);
    const bScore = Number(b.score || 0);
    if (bScore !== aScore) return bScore - aScore;

    const aDistance = Number.isFinite(Number(a.distanceMeters))
      ? Number(a.distanceMeters)
      : Number.MAX_SAFE_INTEGER;
    const bDistance = Number.isFinite(Number(b.distanceMeters))
      ? Number(b.distanceMeters)
      : Number.MAX_SAFE_INTEGER;

    if (aDistance !== bDistance) return aDistance - bDistance;
    return String(a.title || "").localeCompare(String(b.title || ""), "lt");
  });
}

async function searchPostgresAddresses(query, options = {}) {
  const q = String(query || "").trim();
  const nq = compactQuery(q);
  if (nq.length < 2) return [];

  const limit = Math.min(Math.max(Number(options.limit || 8), 1), 20);
  const house = extractHouseNumber(q);
  const targetCity = detectCity(q, options);
  const qWithoutCity = removeCityWordsFromStreet(q);
  const streetPartRaw = qWithoutCity.replace(/\b\d+[a-z]?\b/gi, " ").trim();
  const streetPart = normalizeSearchText(streetPartRaw || nq);

  const rows = await queryAddressRows({
    nq,
    streetPart,
    house: house || null,
    targetCity,
    limit: Math.max(limit, 14),
  });

  return sortAddressResults(
    rows.map((row) => rowToAddressResult(row, q, options)),
  ).slice(0, limit);
}

async function searchLocalAddresses(query, options = {}) {
  try {
    const dbResults = await searchPostgresAddresses(query, options);
    lastDbError = null;
    return dbResults;
  } catch (error) {
    lastDbError = error?.message || String(error);
    return [];
  }
}

async function getLocalAddressDetails(placeId, options = {}) {
  const rawId = String(placeId || "")
    .replace(/^address-/, "")
    .trim();
  if (!rawId) return null;

  try {
    const result = await getPool().query(
      `
      SELECT id, name, street, house_number, city, postcode, lat, lon
      FROM public.addresses
      WHERE id::text = $1
      LIMIT 1
      `,
      [rawId],
    );

    const row = result.rows?.[0];
    if (!row) return null;

    lastDbError = null;
    return mapAddressDetail(row, buildTitle(row), options);
  } catch (error) {
    lastDbError = error?.message || String(error);
    return null;
  }
}

async function refreshDbCount() {
  if (Date.now() - lastDbHealthCheck < 30000) return lastDbCount;
  lastDbHealthCheck = Date.now();

  try {
    const result = await getPool().query(
      "SELECT COUNT(*)::int AS count FROM public.addresses",
    );
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
