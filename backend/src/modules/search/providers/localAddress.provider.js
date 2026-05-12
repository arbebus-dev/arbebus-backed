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
    keys: ["kretinga"],
    city: "Kretinga",
    latitude: 55.8888,
    longitude: 21.2445,
    dbPatterns: ["kreting"],
  },
  {
    keys: ["palanga"],
    city: "Palanga",
    latitude: 55.9175,
    longitude: 21.0686,
    dbPatterns: ["palang"],
  },
  {
    keys: ["gargzdai", "gargždai"],
    city: "Gargždai",
    latitude: 55.7093,
    longitude: 21.3949,
    dbPatterns: ["gargžd", "gargzd"],
  },
  {
    keys: ["vilnius"],
    city: "Vilnius",
    latitude: 54.6872,
    longitude: 25.2797,
    dbPatterns: ["viln"],
  },
  {
    keys: ["kaunas"],
    city: "Kaunas",
    latitude: 54.8985,
    longitude: 23.9036,
    dbPatterns: ["kaun"],
  },
  {
    keys: ["siauliai", "šiauliai"],
    city: "Šiauliai",
    latitude: 55.9349,
    longitude: 23.3137,
    dbPatterns: ["šiaul", "siaul"],
  },
  {
    keys: ["panevezys", "panevėžys"],
    city: "Panevėžys",
    latitude: 55.7348,
    longitude: 24.3575,
    dbPatterns: ["panevėž", "panevez"],
  },
];

let lastDbError = null;
let lastDbCount = null;
let lastDbHealthCheck = 0;

function extractHouseNumber(query) {
  const match = String(query || "").match(/\b(\d+[a-zA-Z]?)\b/);
  return match ? match[1].toUpperCase() : null;
}

function compactQuery(value) {
  return normalizeText(value)
    .replace(/\./g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function normalizeSearchText(value) {
  return compactQuery(value)
    .replace(/\b(g|gatve|gatvė|pr|prospektas|pl|plentas|al|aleja|kelias)\b/g, " ")
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

function cityPatterns(cityHint) {
  const source = cityHint || DEFAULT_CENTER;
  const patterns = Array.isArray(source.dbPatterns) && source.dbPatterns.length
    ? source.dbPatterns
    : [source.city];

  return patterns
    .map((item) => `%${String(item).toLowerCase()}%`)
    .filter(Boolean);
}

function detectCity(query, options = {}) {
  const nq = compactQuery(query);

  const explicit = CITY_HINTS.find((item) =>
    item.keys.some((key) => nq.includes(compactQuery(key))),
  );

  if (explicit) {
    return { ...explicit, reason: "query" };
  }

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

function removeCityWordsFromStreet(query, cityHint) {
  let value = compactQuery(query);

  for (const city of CITY_HINTS) {
    for (const key of city.keys) {
      value = value.replace(new RegExp(`\\b${compactQuery(key)}\\b`, "gi"), " ");
    }
  }

  if (cityHint?.city) {
    value = value.replace(new RegExp(`\\b${compactQuery(cityHint.city)}\\b`, "gi"), " ");
  }

  return value.replace(/\s+/g, " ").trim();
}

function buildTitle(row) {
  return row.name || [row.street, row.house_number].filter(Boolean).join(" ");
}

function buildSubtitle(row) {
  return [row.city, row.postcode].filter(Boolean).join(", ") || "Adresas";
}

function geocoderQuery(row, originalQuery, targetCity) {
  const city = row.city || targetCity?.city || DEFAULT_CENTER.city;
  const parts = [row.street, row.house_number, city, "Lietuva"].filter(Boolean);
  const query = parts.join(" ").replace(/\s+/g, " ").trim();

  if (query.length >= 6) return query;
  return `${originalQuery} ${city} Lietuva`.trim();
}

function readResultCoordinate(item) {
  const latitude = Number(item?.latitude ?? item?.lat ?? item?.coordinate?.latitude);
  const longitude = Number(item?.longitude ?? item?.lon ?? item?.lng ?? item?.coordinate?.longitude);

  if (!validCoordinate(latitude, longitude)) return null;
  return { latitude, longitude };
}

async function updateAddressCoordinate(id, coordinate) {
  if (!id || !validCoordinate(coordinate?.latitude, coordinate?.longitude)) return;

  await getPool().query(
    `UPDATE public.addresses
     SET lat = $2, lon = $3
     WHERE id = $1
       AND (lat IS NULL OR lon IS NULL OR lat = 0 OR lon = 0)`,
    [id, coordinate.latitude, coordinate.longitude],
  );
}

async function geocodeMissingCoordinate(row, originalQuery, targetCity) {
  const title = geocoderQuery(row, originalQuery, targetCity);
  const key = `address-geocode:v4:${compactQuery(title)}`;
  const cached = await getCache(key);

  if (cached && validCoordinate(Number(cached.latitude), Number(cached.longitude))) {
    return cached;
  }

  const providers = [
    () => searchGooglePlaces(title, { limit: 3 }),
    () => searchNominatim(title, { limit: 3 }),
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
      // Keep local address search resilient if an external geocoder fails.
    }
  }

  return null;
}

function cityMatches(rowCity, targetCity) {
  if (!rowCity || !targetCity) return false;

  const cityText = String(rowCity).toLowerCase();
  return cityPatterns(targetCity).some((pattern) =>
    cityText.includes(pattern.replace(/%/g, "")),
  );
}

function resultSortKey(item) {
  const score = Number(item.score || 0);
  const distance = Number.isFinite(Number(item.distanceMeters))
    ? Number(item.distanceMeters)
    : Number.MAX_SAFE_INTEGER;

  return {
    score,
    distance,
    title: String(item.title || item.name || ""),
  };
}

function sortAddressResults(items) {
  return [...items].sort((a, b) => {
    const ak = resultSortKey(a);
    const bk = resultSortKey(b);

    if (bk.score !== ak.score) return bk.score - ak.score;
    if (ak.distance !== bk.distance) return ak.distance - bk.distance;
    return ak.title.localeCompare(bk.title, "lt");
  });
}

async function rowToAddressResult(row, query, options = {}) {
  let latitude = Number(row.lat);
  let longitude = Number(row.lon);
  let geocoded = false;

  const targetCity = detectCity(query, options);
  const userLocation = normalizeInputLocation(options);
  const rowMatchesTargetCity = cityMatches(row.city, targetCity);

  if (!validCoordinate(latitude, longitude)) {
    const resolved = await geocodeMissingCoordinate(row, query, targetCity);

    if (resolved) {
      latitude = resolved.latitude;
      longitude = resolved.longitude;
      geocoded = true;
    }
  }

  const hasRealCoordinate = validCoordinate(latitude, longitude);
  const fallbackCoordinate = userLocation || targetCity || DEFAULT_CENTER;
  const finalLatitude = hasRealCoordinate ? latitude : fallbackCoordinate.latitude;
  const finalLongitude = hasRealCoordinate ? longitude : fallbackCoordinate.longitude;
  const exactHouse = extractHouseNumber(query);
  const userDistance =
    userLocation && hasRealCoordinate
      ? distanceMeters(userLocation, { latitude, longitude })
      : null;

  let score = Number(row.rank_score || 0);

  // Hard priorities:
  // 1) Explicit city in query always wins.
  // 2) If no explicit city, GPS nearest city wins.
  // 3) If no GPS, Klaipėda wins by default.
  if (rowMatchesTargetCity) score += 100000;
  if (targetCity?.reason === "query" && rowMatchesTargetCity) score += 150000;
  if (targetCity?.reason === "gps" && rowMatchesTargetCity) score += 120000;
  if (targetCity?.reason === "default" && rowMatchesTargetCity) score += 110000;

  if (hasRealCoordinate) score += 6000;
  else score -= 12000;

  if (userDistance != null) {
    // Distance ranking only after city priority. The closer result wins inside the same city/region.
    score += Math.max(0, 50000 - Math.min(userDistance, 50000));
  }

  return toResult({
    id: `address-${row.id}`,
    type: "address",
    title: buildTitle(row),
    name: buildTitle(row),
    subtitle: hasRealCoordinate
      ? buildSubtitle(row)
      : `${buildSubtitle(row)} · koordinatės tikslinamos`,
    latitude: finalLatitude,
    longitude: finalLongitude,
    coordinate: { latitude: finalLatitude, longitude: finalLongitude },
    source: geocoded ? "postgres_address_geocoded" : "postgres_address",
    category: "Adresas",
    priority: exactHouse ? 320 : 210,
    score,
    selectable: true,
    requiresHouseNumber: false,
    distanceMeters: userDistance ?? undefined,
    keywords: [row.name, row.street, row.house_number, row.city, row.postcode].filter(Boolean),
  });
}

async function queryAddressRows({ q, nq, streetPart, house, targetCity, limit, cityFirst }) {
  const pool = getPool();
  const patterns = cityPatterns(targetCity);

  if (house) {
    const sql = `
      SELECT
        id,
        name,
        street,
        house_number,
        city,
        postcode,
        lat,
        lon,
        (
          CASE WHEN lower(street) = lower($1) THEN 9000 ELSE 0 END +
          CASE WHEN lower(street) LIKE lower($1) || '%' THEN 5000 ELSE 0 END +
          CASE WHEN upper(house_number) = upper($2) THEN 9000 ELSE 0 END +
          CASE WHEN upper(house_number) LIKE upper($2) || '%' THEN 3500 ELSE 0 END +
          CASE WHEN lower(COALESCE(city, '')) LIKE ANY($3::text[]) THEN 50000 ELSE 0 END +
          CASE WHEN lat IS NOT NULL AND lon IS NOT NULL AND lat <> 0 AND lon <> 0 THEN 2500 ELSE 0 END
        ) AS rank_score
      FROM public.addresses
      WHERE
        lower(street) LIKE lower($1) || '%'
        AND upper(house_number) LIKE upper($2) || '%'
        AND (
          $5::boolean = false
          OR lower(COALESCE(city, '')) LIKE ANY($3::text[])
        )
      ORDER BY rank_score DESC, city ASC, street ASC, house_number ASC
      LIMIT $4
    `;

    const result = await pool.query(sql, [
      streetPart || nq,
      house,
      patterns,
      limit,
      Boolean(cityFirst),
    ]);

    return result.rows;
  }

  const sql = `
    SELECT
      id,
      name,
      street,
      house_number,
      city,
      postcode,
      lat,
      lon,
      (
        CASE WHEN lower(street) = lower($1) THEN 9000 ELSE 0 END +
        CASE WHEN lower(street) LIKE lower($1) || '%' THEN 5000 ELSE 0 END +
        CASE WHEN lower(COALESCE(city, '')) LIKE ANY($2::text[]) THEN 50000 ELSE 0 END +
        CASE WHEN lat IS NOT NULL AND lon IS NOT NULL AND lat <> 0 AND lon <> 0 THEN 2500 ELSE 0 END
      ) AS rank_score
    FROM public.addresses
    WHERE
      lower(street) LIKE lower($1) || '%'
      AND (
        $4::boolean = false
        OR lower(COALESCE(city, '')) LIKE ANY($2::text[])
      )
    ORDER BY rank_score DESC, city ASC, street ASC, house_number ASC
    LIMIT $3
  `;

  const result = await pool.query(sql, [
    streetPart || nq,
    patterns,
    limit,
    Boolean(cityFirst),
  ]);

  return result.rows;
}

async function searchPostgresAddresses(query, options = {}) {
  const q = String(query || "").trim();
  const nq = compactQuery(q);
  if (nq.length < 2) return [];

  const limit = Math.min(Math.max(Number(options.limit || 8), 1), 20);
  const house = extractHouseNumber(q);
  const targetCity = detectCity(q, options);
  const qWithoutCity = removeCityWordsFromStreet(q, targetCity);
  const streetPartRaw = qWithoutCity.replace(/\b\d+[a-z]?\b/gi, " ").trim();
  const streetPart = normalizeSearchText(streetPartRaw || nq);

  // First pass: hard filter by selected city.
  // This is the core product rule:
  // - explicit city in query wins;
  // - otherwise user GPS nearest city wins;
  // - otherwise Klaipėda wins.
  let rows = await queryAddressRows({
    q,
    nq,
    streetPart,
    house,
    targetCity,
    limit: Math.max(limit, 12),
    cityFirst: true,
  });

  // Second pass: if selected city has no such address, fall back to all Lithuania.
  if (!rows.length) {
    rows = await queryAddressRows({
      q,
      nq,
      streetPart,
      house,
      targetCity,
      limit: Math.max(limit, 12),
      cityFirst: false,
    });
  }

  const mapped = await Promise.all(
    rows.map((row) => rowToAddressResult(row, q, options)),
  );

  return sortAddressResults(mapped.filter(Boolean)).slice(0, limit);
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

module.exports = { searchLocalAddresses, localAddressHealth };
